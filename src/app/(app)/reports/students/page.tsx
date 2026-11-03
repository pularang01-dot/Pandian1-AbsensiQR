import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { Input, Select } from "@/components/ui/field";
import { ReportView } from "@/components/reports/report-view";
import { buildStudents } from "@/lib/data/reports";
import { asUuid, loadClasses } from "@/lib/data/lookups";
import { sanitizeSearch } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Laporan per Siswa" };
export const dynamic = "force-dynamic";

export default async function StudentsReportPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; class?: string; q?: string }> }) {
  await requireRole(["super_admin", "school_admin", "principal", "teacher"]);
  const sp = await searchParams;
  const q = sanitizeSearch(sp.q);
  const [t, classes] = await Promise.all([buildStudents(sp.from, sp.to, sp.class, q), loadClasses()]);
  const classId = asUuid(sp.class) ?? "";
  return (
    <>
      <PageHeader title="Laporan per siswa" description="Pilih nama siswa untuk melihat riwayat kehadiran, ketidakhadiran, izin, dispensasi, dan koreksi." />
      <div className="card mb-6">
        <FilterBar action="/reports/students" resetHref="/reports/students">
          <FilterField label="Dari" htmlFor="from"><Input id="from" name="from" type="date" defaultValue={t.from} /></FilterField>
          <FilterField label="Sampai" htmlFor="to"><Input id="to" name="to" type="date" defaultValue={t.to} /></FilterField>
          <FilterField label="Kelas" htmlFor="class">
            <Select id="class" name="class" defaultValue={classId}>
              <option value="">Semua kelas</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Nama atau NIS" htmlFor="q" grow><Input id="q" name="q" defaultValue={q} /></FilterField>
        </FilterBar>
      </div>
      <ReportView table={t} exportQuery={`type=students&from=${t.from}&to=${t.to}&class=${classId}&q=${encodeURIComponent(q)}`} detailBase={`/reports/students/`} />
    </>
  );
}
