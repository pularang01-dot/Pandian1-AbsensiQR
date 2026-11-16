import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { Select } from "@/components/ui/field";
import { ReportView } from "@/components/reports/report-view";
import { buildSemester } from "@/lib/data/reports";
import { asUuid, loadClasses, loadYears } from "@/lib/data/lookups";

export const metadata: Metadata = { title: "Laporan Semester" };
export const dynamic = "force-dynamic";

export default async function SemesterReportPage({ searchParams }: { searchParams: Promise<{ year?: string; sem?: string; class?: string }> }) {
  await requireRole(["super_admin", "school_admin", "principal", "teacher"]);
  const sp = await searchParams;
  const [t, years, classes] = await Promise.all([buildSemester(sp.year, sp.sem, sp.class), loadYears(), loadClasses()]);
  const classId = asUuid(sp.class) ?? "";
  return (
    <>
      <PageHeader title="Laporan semester" description="Rekap per siswa untuk semester Ganjil (sampai 31 Desember) atau Genap (mulai 1 Januari) dalam satu tahun ajaran." />
      <div className="card mb-6">
        <FilterBar action="/reports/semester" resetHref="/reports/semester">
          <FilterField label="Tahun ajaran" htmlFor="year">
            <Select id="year" name="year" defaultValue={t.yearId}>
              {years.map((y) => <option key={y.id} value={y.id}>{y.name}{y.is_active ? " (aktif)" : ""}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Semester" htmlFor="sem">
            <Select id="sem" name="sem" defaultValue={String(t.sem)}>
              <option value="1">Ganjil</option>
              <option value="2">Genap</option>
            </Select>
          </FilterField>
          <FilterField label="Kelas" htmlFor="class">
            <Select id="class" name="class" defaultValue={classId}>
              <option value="">Semua kelas</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </FilterField>
        </FilterBar>
      </div>
      <ReportView table={t} exportQuery={`type=semester&year=${t.yearId}&sem=${t.sem}&class=${classId}`} detailBase="/reports/students/" />
    </>
  );
}