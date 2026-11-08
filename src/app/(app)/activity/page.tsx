import type { Metadata } from "next";
import { addDays, parseISO } from "date-fns";
import { APPROVER_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Input, Select } from "@/components/ui/field";
import { Pagination, PAGE_SIZE, parsePage } from "@/components/ui/pagination";
import { asDate, asUuid } from "@/lib/data/lookups";
import { formatTanggal, formatWaktu } from "@/lib/utils";
import { CATEGORIES, NOISE_TABLES, collectIds, describe, safeData, type AuditRow, type Names } from "@/lib/audit/describe";

export const metadata: Metadata = { title: "Aktivitas Administrasi" };
export const dynamic = "force-dynamic";

type SP = { kategori?: string; pelaku?: string; dari?: string; sampai?: string; semua?: string; page?: string };

async function nameMap(supabase: Awaited<ReturnType<typeof createClient>>, table: "profiles" | "students" | "classes" | "academic_years", col: string, ids: string[]) {
  const out: Record<string, string> = {};
  if (ids.length === 0) return out;
  const { data } = await supabase.from(table).select(`id, ${col}`).in("id", ids.slice(0, 300));
  for (const r of (data ?? []) as unknown as Record<string, string>[]) out[r.id] = r[col];
  return out;
}

export default async function ActivityPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireRole(APPROVER_ROLES);
  const sp = await searchParams;
  const supabase = await createClient();

  const cat = CATEGORIES.find((c) => c.key === sp.kategori) ?? CATEGORIES[0];
  const actor = asUuid(sp.pelaku);
  const from = asDate(sp.dari);
  const to = asDate(sp.sampai);
  const showAll = sp.semua === "1";
  const page = parsePage(sp.page);

  let q = supabase
    .from("audit_logs")
    .select("id, actor_id, action, entity_table, entity_id, old_data, new_data, reason, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (cat.key !== "all") {
    const parts = [];
    if (cat.tables.length) parts.push(`entity_table.in.(${cat.tables.join(",")})`);
    if (cat.actions.length) parts.push(`action.in.(${cat.actions.join(",")})`);
    q = q.or(parts.join(","));
  }
  if (actor) q = q.eq("actor_id", actor);
  // Batas tanggal menurut hari sekolah (WIB), bukan zona server.
  if (from) q = q.gte("created_at", `${from}T00:00:00+07:00`);
  if (to) q = q.lt("created_at", `${addDays(parseISO(to), 1).toISOString().slice(0, 10)}T00:00:00+07:00`);
  if (!showAll) q = q.or(`entity_table.not.in.(${NOISE_TABLES.join(",")}),action.not.in.(insert,update)`);
  const { data, count, error } = await q.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  // Daftar pelaku: staf yang memiliki peran.
  const { data: staffRoles } = await supabase.from("user_roles").select("user_id").in("role", ["super_admin", "school_admin", "principal", "teacher", "operator"]);
  const staffIds = [...new Set((staffRoles ?? []).map((r) => r.user_id as string))];
  const staff = await nameMap(supabase, "profiles", "full_name", staffIds);

  const rows = (data ?? []) as unknown as AuditRow[];
  const ids = collectIds(rows);
  const names: Names = {
    people: { ...staff, ...(await nameMap(supabase, "profiles", "full_name", [...ids.people].filter((i) => !staff[i]))) },
    students: await nameMap(supabase, "students", "full_name", [...ids.students]),
    classes: await nameMap(supabase, "classes", "name", [...ids.classes]),
    years: await nameMap(supabase, "academic_years", "name", [...ids.years]),
  };

  const params = { kategori: cat.key === "all" ? undefined : cat.key, pelaku: actor ?? undefined, dari: from ?? undefined, sampai: to ?? undefined, semua: showAll ? "1" : undefined };

  return (
    <>
      <PageHeader title="Aktivitas administrasi" description="Catatan siapa melakukan apa dan kapan. Catatan ini tidak dapat diubah atau dihapus." />

      <form action="/activity" className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label htmlFor="kategori" className="field-label">Jenis</label>
          <Select id="kategori" name="kategori" defaultValue={cat.key}>
            {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </Select>
        </div>
        <div>
          <label htmlFor="pelaku" className="field-label">Dilakukan oleh</label>
          <Select id="pelaku" name="pelaku" defaultValue={actor ?? ""}>
            <option value="">Semua</option>
            {Object.entries(staff).sort((a, b) => a[1].localeCompare(b[1], "id")).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </Select>
        </div>
        <div>
          <label htmlFor="dari" className="field-label">Dari tanggal</label>
          <Input id="dari" name="dari" type="date" defaultValue={from ?? ""} />
        </div>
        <div>
          <label htmlFor="sampai" className="field-label">Sampai tanggal</label>
          <Input id="sampai" name="sampai" type="date" defaultValue={to ?? ""} />
        </div>
        <div className="flex items-end">
          <button type="submit" className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-[#2b68bd]">Terapkan</button>
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-5">
          <input type="checkbox" name="semua" value="1" defaultChecked={showAll} className="h-5 w-5" />
          Sertakan perubahan rutin pada catatan absensi harian dan notifikasi
        </label>
      </form>

      {error ? (
        <div className="card"><ErrorState message="Aktivitas tidak dapat dimuat. Muat ulang halaman." /></div>
      ) : rows.length === 0 ? (
        <div className="card"><EmptyState title="Tidak ada aktivitas" description="Coba ubah jenis, pelaku, atau rentang tanggal." /></div>
      ) : (
        <div className="card">
          <ul className="divide-y divide-line">
            {rows.map((r) => {
              const d = describe(r, names);
              const detailRows = d.changes.length > 0 ? null : safeData(r, names);
              const hasMore = d.changes.length > 0 || (detailRows && detailRows.length > 0);
              return (
                <li key={r.id} className="px-4 py-3 sm:px-5">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {d.important && <span className="mr-2 rounded border border-warning/50 bg-warning/15 px-1.5 py-0.5 text-xs font-semibold text-[#8a5a0c]">Penting</span>}
                        {d.title}
                      </p>
                      {d.detail && <p className="mt-0.5 text-sm text-ink-muted">{d.detail}</p>}
                      <p className="mt-0.5 text-xs text-ink-muted">Oleh {r.actor_id ? (names.people[r.actor_id] ?? "pengguna tidak dikenal") : "sistem"}</p>
                    </div>
                    <p className="tabular shrink-0 text-xs text-ink-muted sm:text-right">{formatTanggal(r.created_at, "d MMM yyyy")}<br className="hidden sm:block" /> <span className="sm:block">{formatWaktu(r.created_at)} WIB</span></p>
                  </div>
                  {hasMore && (
                    <details className="mt-2 text-sm">
                      <summary className="inline-flex min-h-9 cursor-pointer items-center text-brand">Lihat rincian</summary>
                      <div className="mt-2 overflow-x-auto rounded-lg border border-line">
                        {d.changes.length > 0 ? (
                          <table className="w-full text-left text-xs">
                            <thead><tr className="border-b border-line bg-canvas/60 text-ink-muted"><th scope="col" className="px-3 py-2 font-semibold">Bagian</th><th scope="col" className="px-3 py-2 font-semibold">Sebelum</th><th scope="col" className="px-3 py-2 font-semibold">Sesudah</th></tr></thead>
                            <tbody className="divide-y divide-line">
                              {d.changes.map((c) => <tr key={c.field}><td className="px-3 py-2 font-medium">{c.field}</td><td className="px-3 py-2 break-words">{c.before}</td><td className="px-3 py-2 break-words">{c.after}</td></tr>)}
                            </tbody>
                          </table>
                        ) : (
                          <dl className="grid gap-x-4 gap-y-1 p-3 text-xs sm:grid-cols-[auto_1fr]">
                            {detailRows!.map(([k, v]) => <div key={k} className="contents"><dt className="font-medium text-ink-muted">{k}</dt><dd className="break-words">{v}</dd></div>)}
                          </dl>
                        )}
                      </div>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
          <Pagination page={page} total={count ?? 0} basePath="/activity" params={params} />
        </div>
      )}
    </>
  );
}