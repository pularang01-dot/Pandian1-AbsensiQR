import type { Metadata } from "next";
import { Flag, Plus } from "lucide-react";
import { STAFF_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { HeroAction, StatusTabs, WorkflowHero } from "@/components/workflow/workflow-ui";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination, PAGE_SIZE, parsePage } from "@/components/ui/pagination";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { Input, Select } from "@/components/ui/field";
import { StatusBadge, DISPENSATION_STATUS } from "@/components/ui/status-badge";
import { ErrorState } from "@/components/ui/states";
import { sanitizeSearch } from "@/lib/validation/common";
import { DISPENSATION_CATEGORY } from "@/lib/validation/dispensation";
import { formatTanggal } from "@/lib/utils";

export const metadata: Metadata = { title: "Dispensasi" };
export const dynamic = "force-dynamic";

type Row = {
  id: string; name: string; category: string; starts_at: string; ends_at: string; status: string;
  dispensation_students: { id: string; needs_review: boolean }[];
};

export default async function DispensationsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  await requireRole(STAFF_ROLES);
  const sp = await searchParams;
  const supabase = await createClient();
  const page = parsePage(sp.page);
  const q = sanitizeSearch(sp.q);
  const status = sp.status === "all" ? "" : (Object.keys(DISPENSATION_STATUS) as string[]).includes(sp.status ?? "") ? sp.status! : "pending";

  let query = supabase
    .from("dispensations")
    .select("id, name, category, starts_at, ends_at, status, dispensation_students(id, needs_review)", { count: "exact" })
    .order("starts_at", { ascending: status === "pending" })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) query = query.eq("status", status);
  if (q) query = query.ilike("name", `%${q}%`);
  const { data, count, error } = await query;
  const rows = (data ?? []) as unknown as Row[];

  const keys = Object.keys(DISPENSATION_STATUS);
  const perStatus = await Promise.all(keys.map(async (k) => {
    const { count: n } = await supabase.from("dispensations").select("id", { count: "exact", head: true }).eq("status", k);
    return [k, n ?? 0] as const;
  }));
  const tabs = [
    { key: "", label: "Semua", count: perStatus.reduce((a, [, n]) => a + n, 0) },
    ...perStatus.map(([k, n]) => ({ key: k, label: DISPENSATION_STATUS[k as keyof typeof DISPENSATION_STATUS].label, count: n, attention: k === "pending" })),
  ];

  const columns: Column<Row>[] = [
    { key: "name", header: "Kegiatan", cell: (r) => <span className="flex items-center gap-3"><span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-light text-brand"><Flag className="h-5 w-5" /></span><span className="min-w-0"><span className="block truncate">{r.name}</span><span className="block text-xs font-normal text-ink-muted">{DISPENSATION_CATEGORY[r.category]}</span></span></span> },
    { key: "when", header: "Waktu", cell: (r) => <span className="tabular whitespace-nowrap">{formatTanggal(r.starts_at, "d MMM yyyy, HH:mm")}</span> },
    { key: "n", header: "Peserta", hideOnMobile: true, cell: (r) => <span className="tabular">{r.dispensation_students.length} siswa</span> },
    { key: "rev", header: "Catatan", hideOnMobile: true, cell: (r) => { const n = r.dispensation_students.filter((s) => s.needs_review).length; return n > 0 ? <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-[#9a6510]">{n} perlu ditinjau</span> : null; } },
    { key: "status", header: "Status", cell: (r) => <StatusBadge kind="dispensation" status={r.status} /> },
  ];

  return (
    <>
      <WorkflowHero
        icon={Flag}
        title="Dispensasi kegiatan resmi"
        description="Dispensasi terpisah dari sakit dan izin. Persetujuan bukan bukti siswa ikut serta; guru pendamping wajib mengonfirmasi."
        total={count ?? 0}
        totalLabel={status ? `dispensasi ${DISPENSATION_STATUS[status as keyof typeof DISPENSATION_STATUS].label.toLowerCase()}` : "dispensasi"}
        action={<HeroAction href="/dispensations/new" icon={Plus}>Ajukan dispensasi</HeroAction>}
      />
      <StatusTabs basePath="/dispensations" tabs={tabs} active={status} q={q} />
      <div className="card overflow-hidden">
        <FilterBar action="/dispensations" resetHref="/dispensations">
          <FilterField label="Status" htmlFor="status">
            <Select id="status" name="status" defaultValue={status || "all"}>
              <option value="all">Semua status</option>
              {Object.entries(DISPENSATION_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Cari nama kegiatan" htmlFor="q" grow><Input id="q" name="q" defaultValue={q} placeholder="Ketik nama kegiatan" /></FilterField>
        </FilterBar>
        {error ? <ErrorState message="Daftar dispensasi tidak dapat dimuat." /> : (
          <>
            <DataTable caption="Dispensasi" columns={columns} rows={rows} rowKey={(r) => r.id} rowHref={(r) => `/dispensations/${r.id}`} emptyTitle="Tidak ada dispensasi" emptyDescription="Tidak ada dispensasi dengan filter ini." />
            <Pagination page={page} total={count ?? 0} basePath="/dispensations" params={{ status: sp.status, q }} />
          </>
        )}
      </div>
    </>
  );
}