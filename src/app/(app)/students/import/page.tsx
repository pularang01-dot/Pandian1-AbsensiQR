import type { Metadata } from "next";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { loadClasses, loadYears, pickYear } from "@/lib/data/lookups";
import { ImportClient } from "./import-client";

export const metadata: Metadata = { title: "Impor Siswa" };

export default async function ImportStudentsPage() {
  await requireRole(ADMIN_ROLES);
  const years = await loadYears();
  const year = pickYear(years);
  const classes = await loadClasses();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Impor siswa" description="Unggah berkas Excel (.xlsx) atau CSV. Baris yang bermasalah dilewati dan dilaporkan; baris valid tetap diimpor." />
      {!year ? (
        <div className="card"><EmptyState title="Belum ada tahun ajaran" description="Buat tahun ajaran dan kelas di Pengaturan sebelum mengimpor siswa." /></div>
      ) : (
        <ImportClient years={years.map((y) => ({ id: y.id, name: y.name }))} classes={classes.map((c) => ({ id: c.id, name: c.name, academic_year_id: c.academic_year_id }))} defaultYearId={year.id} />
      )}
    </div>
  );
}