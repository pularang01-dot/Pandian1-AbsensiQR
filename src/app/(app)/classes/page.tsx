import type { Metadata } from "next";
import Link from "next/link";
import { ADMIN_ROLES, STAFF_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ChevronRight, School, UserRound, Users, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/states";
import { Select } from "@/components/ui/field";
import { asUuid, loadClasses, loadYears, pickYear } from "@/lib/data/lookups";
import { loadProfileNames, loadTeachers } from "@/lib/data/teachers";
import { ClassFormButton } from "./class-form";

export const metadata: Metadata = { title: "Kelas" };
export const dynamic = "force-dynamic";

export default async function ClassesPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const user = await requireRole(STAFF_ROLES);
  const isAdmin = user.roles.some((r) => ADMIN_ROLES.includes(r));
  const sp = await searchParams;
  const supabase = await createClient();

  const years = await loadYears();
  const year = pickYear(years, asUuid(sp.year));
  const [classes, teachers, totals] = await Promise.all([
    loadClasses(year?.id),
    isAdmin ? loadTeachers() : Promise.resolve([]),
    supabase.rpc("active_students_by_class"),
  ]);
  const profiles = await loadProfileNames(classes.map((c) => c.homeroom_teacher_id).filter(Boolean) as string[]);
  const activeTeacher = new Set(teachers.map((t) => t.id));
  // Kelas aktif tanpa wali, atau walinya sudah nonaktif / bukan guru lagi (hanya dicek untuk admin).
  const needsTeacher = isAdmin ? classes.filter((c) => c.is_active && (!c.homeroom_teacher_id || !activeTeacher.has(c.homeroom_teacher_id))) : [];

  const count = new Map<string, number>();
  for (const r of (totals.data ?? []) as { class_id: string | null; total: number | string }[]) if (r.class_id) count.set(r.class_id, Number(r.total));

  const totalStudents = classes.filter((c) => c.is_active).reduce((a, c) => a + (count.get(c.id) ?? 0), 0);
  const activeClasses = classes.filter((c) => c.is_active).length;

  // Kelompokkan menurut tingkat (angka pertama pada nama kelas, misalnya 1A -> Kelas 1).
  const groups = new Map<string, typeof classes>();
  for (const c of [...classes].sort((x, y) => x.name.localeCompare(y.name, "id", { numeric: true }))) {
    const g = /\d+/.exec(c.name)?.[0];
    const key = g ? `Kelas ${g}` : "Lainnya";
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  const initials = (n: string) => n.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  return (
    <>
      <section className="dash-hero mb-6 overflow-hidden rounded-2xl p-6 text-white shadow-pop sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-white/70">Tahun ajaran {year?.name ?? "-"}{year?.is_active ? " (aktif)" : ""}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Kelas</h1>
            <p className="mt-1 max-w-xl text-sm text-white/70">Kelola kelas, wali kelas, dan penempatan siswa per tahun ajaran.</p>
          </div>
          <dl className="grid grid-cols-3 gap-5 sm:gap-8">
            <div className="flex flex-col-reverse"><dt className="mt-1.5 text-xs text-white/70">Kelas aktif</dt><dd className="tabular text-3xl font-bold leading-none">{activeClasses}</dd></div>
            <div className="flex flex-col-reverse"><dt className="mt-1.5 text-xs text-white/70">Siswa aktif</dt><dd className="tabular text-3xl font-bold leading-none">{totalStudents}</dd></div>
            <div className="flex flex-col-reverse"><dt className="mt-1.5 text-xs text-white/70">Tanpa wali</dt><dd className="tabular text-3xl font-bold leading-none">{needsTeacher.length}</dd></div>
          </dl>
        </div>
      </section>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <form action="/classes" method="get" className="flex items-end gap-2">
          <div className="w-56">
            <label htmlFor="year" className="mb-1.5 block text-xs font-medium text-ink-muted">Tahun ajaran</label>
            <Select id="year" name="year" defaultValue={year?.id ?? ""}>
              {years.map((y) => <option key={y.id} value={y.id}>{y.name}{y.is_active ? " (aktif)" : ""}{y.is_archived ? " (arsip)" : ""}</option>)}
            </Select>
          </div>
          <button type="submit" className="inline-flex h-11 items-center rounded-lg border border-line bg-surface px-4 text-sm font-medium hover:bg-canvas">Tampilkan</button>
        </form>
        {isAdmin && year && (
          <div className="flex flex-wrap gap-2">
            <Link href="/classes/promotion" className="inline-flex h-11 items-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-medium hover:bg-canvas">Kenaikan kelas</Link>
            <ClassFormButton values={{ academic_year_id: year.id }} years={years.filter((y) => !y.is_archived).map((y) => ({ id: y.id, name: y.name }))} teachers={teachers} />
          </div>
        )}
      </div>

      {needsTeacher.length > 0 && (
        <div role="note" className="mb-6 flex gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-[#8a5a0e]">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">{needsTeacher.length} kelas aktif belum memiliki wali kelas yang bertugas</p>
            <p className="mt-1">Absensi kelas ini tidak dapat dicatat oleh guru sampai wali ditetapkan: {needsTeacher.map((c, i) => <span key={c.id}>{i > 0 && ", "}<Link href={`/classes/${c.id}`} className="font-medium underline">{c.name}</Link></span>)}.</p>
          </div>
        </div>
      )}

      {!year ? (
        <div className="card"><EmptyState title="Belum ada tahun ajaran" description={isAdmin ? "Buat tahun ajaran terlebih dahulu di Pengaturan > Tahun Ajaran." : "Hubungi administrator sekolah."} action={isAdmin ? <Link href="/settings/academic-year" className="inline-flex h-11 items-center rounded-lg bg-brand px-4 text-sm font-medium text-white">Buka pengaturan</Link> : undefined} /></div>
      ) : classes.length === 0 ? (
        <div className="card"><EmptyState title="Belum ada kelas" description={isAdmin ? "Gunakan tombol Tambah kelas untuk membuat kelas pertama." : undefined} /></div>
      ) : (
        <div className="space-y-8">
          {[...groups.entries()].map(([grade, list]) => (
            <section key={grade} aria-label={grade}>
              <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
                <School className="h-4 w-4 text-brand" aria-hidden />{grade}
                <span className="rounded-full bg-canvas px-2 py-0.5 text-xs font-medium text-ink-muted">{list.length} kelas</span>
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {list.map((c) => {
                  const wali = c.homeroom_teacher_id ? profiles.get(c.homeroom_teacher_id)?.name ?? "Akun guru" : null;
                  const noTeacher = c.is_active && isAdmin && (!c.homeroom_teacher_id || !activeTeacher.has(c.homeroom_teacher_id));
                  return (
                    <Link key={c.id} href={`/classes/${c.id}`} className={cn("card group relative flex flex-col gap-4 overflow-hidden p-5 transition-colors hover:border-brand hover:bg-brand-light/30", !c.is_active && "opacity-75")}>
                      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-1", noTeacher ? "bg-warning" : c.is_active ? "bg-brand" : "bg-line")} />
                      <div className="flex items-start justify-between gap-3">
                        <span className="flex h-14 min-w-14 items-center justify-center rounded-2xl bg-navy px-3 text-xl font-bold text-white">{c.name}</span>
                        <div className="flex flex-col items-end gap-1.5">
                          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", c.is_active ? "bg-success/10 text-success" : "bg-canvas text-ink-muted")}>{c.is_active ? "Aktif" : "Nonaktif"}</span>
                          {noTeacher && <span className="rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-medium text-[#8a5a0e]">{c.homeroom_teacher_id ? "Wali tidak aktif" : "Belum ada wali"}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 text-sm">
                        {wali ? (
                          <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-light text-xs font-semibold text-brand">{initials(wali)}</span>
                        ) : (
                          <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-canvas text-ink-muted"><UserRound className="h-4 w-4" /></span>
                        )}
                        <span className="min-w-0">
                          <span className="block text-xs text-ink-muted">Wali kelas</span>
                          <span className={cn("block truncate font-medium", !wali && "font-normal text-ink-muted")}>{wali ?? "Belum ditentukan"}</span>
                        </span>
                      </div>
                      <div className="mt-auto flex items-center justify-between border-t border-line pt-3 text-sm">
                        <span className="flex items-center gap-2 text-ink-muted"><Users className="h-4 w-4" aria-hidden /><span><span className="tabular text-base font-semibold text-ink">{count.get(c.id) ?? 0}</span> siswa aktif</span></span>
                        <ChevronRight className="h-4 w-4 text-ink-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}