import type { Metadata } from "next";
import Link from "next/link";
import { ADMIN_ROLES, STAFF_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/states";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
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

  type Row = (typeof classes)[number];
  const columns: Column<Row>[] = [
    { key: "name", header: "Kelas", cell: (c) => <Link href={`/classes/${c.id}`} className="font-medium hover:text-brand">{c.name}</Link> },
    { key: "teacher", header: "Wali kelas", cell: (c) => {
      if (!c.homeroom_teacher_id) return <span className="text-ink-muted">Belum ditentukan</span>;
      const p = profiles.get(c.homeroom_teacher_id);
      const inactive = isAdmin && !activeTeacher.has(c.homeroom_teacher_id);
      return <span>{p?.name ?? "Akun guru"}{inactive && <span className="ml-2 text-xs font-medium text-warning">(tidak aktif, perlu diganti)</span>}</span>;
    } },
    { key: "count", header: "Siswa aktif", className: "text-right", cell: (c) => <span className="tabular">{count.get(c.id) ?? 0}</span> },
    { key: "status", header: "Status", hideOnMobile: true, cell: (c) => (c.is_active ? "Aktif" : "Nonaktif") },
  ];

  return (
    <>
      <PageHeader
        title="Kelas"
        description="Kelola kelas, wali kelas, dan penempatan siswa per tahun ajaran."
        actions={isAdmin && year ? <ClassFormButton values={{ academic_year_id: year.id }} years={years.filter((y) => !y.is_archived).map((y) => ({ id: y.id, name: y.name }))} teachers={teachers} /> : undefined}
      />
      {needsTeacher.length > 0 && (
        <div role="note" className="mb-4 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-[#8a5a0e]">
          <p className="font-medium">{needsTeacher.length} kelas aktif belum memiliki wali kelas yang bertugas</p>
          <p className="mt-1">Absensi kelas ini tidak dapat dicatat oleh guru sampai wali ditetapkan: {needsTeacher.map((c, i) => <span key={c.id}>{i > 0 && ", "}<Link href={`/classes/${c.id}`} className="font-medium underline">{c.name}</Link></span>)}.</p>
        </div>
      )}
      <div className="card">
        <FilterBar action="/classes" resetHref="/classes">
          <FilterField label="Tahun ajaran" htmlFor="year">
            <Select id="year" name="year" defaultValue={year?.id ?? ""}>
              {years.map((y) => <option key={y.id} value={y.id}>{y.name}{y.is_active ? " (aktif)" : ""}{y.is_archived ? " (arsip)" : ""}</option>)}
            </Select>
          </FilterField>
        </FilterBar>
        {!year ? (
          <EmptyState title="Belum ada tahun ajaran" description={isAdmin ? "Buat tahun ajaran terlebih dahulu di Pengaturan > Tahun Ajaran." : "Hubungi administrator sekolah."} action={isAdmin ? <Link href="/settings/academic-year" className="inline-flex h-11 items-center rounded-lg bg-brand px-4 text-sm font-medium text-white">Buka pengaturan</Link> : undefined} />
        ) : (
          <DataTable caption="Daftar kelas" columns={columns} rows={classes} rowKey={(c) => c.id} emptyTitle="Belum ada kelas" emptyDescription={isAdmin ? "Gunakan tombol Tambah kelas untuk membuat kelas pertama." : undefined} />
        )}
      </div>
    </>
  );
}