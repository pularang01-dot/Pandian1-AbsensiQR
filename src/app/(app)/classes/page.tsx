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
import { loadTeachers } from "@/lib/data/teachers";
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
  const teacherName = new Map<string, string>();
  if (!isAdmin) {
    const ids = [...new Set(classes.map((c) => c.homeroom_teacher_id).filter(Boolean))] as string[];
    if (ids.length) {
      const { data } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      for (const p of data ?? []) teacherName.set(p.id, p.full_name);
    }
  } else for (const t of teachers) teacherName.set(t.id, t.name);

  const count = new Map<string, number>();
  for (const r of (totals.data ?? []) as { class_id: string | null; total: number | string }[]) if (r.class_id) count.set(r.class_id, Number(r.total));

  type Row = (typeof classes)[number];
  const columns: Column<Row>[] = [
    { key: "name", header: "Kelas", cell: (c) => <Link href={`/classes/${c.id}`} className="font-medium hover:text-brand">{c.name}</Link> },
    { key: "teacher", header: "Wali kelas", cell: (c) => (c.homeroom_teacher_id ? teacherName.get(c.homeroom_teacher_id) ?? "Akun guru" : <span className="text-ink-muted">Belum ditentukan</span>) },
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
