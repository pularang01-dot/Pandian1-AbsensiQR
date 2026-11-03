import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { Input, Select } from "@/components/ui/field";
import { ReportView } from "@/components/reports/report-view";
import { buildDaily } from "@/lib/data/reports";
import { asUuid, loadClasses } from "@/lib/data/lookups";

export const metadata: Metadata = { title: "Laporan Harian" };
export const dynamic = "force-dynamic";

export default async function DailyReportPage({ searchParams }: { searchParams: Promise<{ date?: string; class?: string }> }) {
  await requireRole(["super_admin", "school_admin", "principal", "teacher"]);
  const sp = await searchParams;
  const [t, classes] = await Promise.all([buildDaily(sp.date, sp.class), loadClasses()]);
  const classId = asUuid(sp.class) ?? "";
  return (
    <>
      <PageHeader title="Laporan harian" description="Rekap absensi per kelas untuk satu tanggal." />
      <div className="card mb-6">
        <FilterBar action="/reports/daily" resetHref="/reports/daily">
          <FilterField label="Tanggal" htmlFor="date"><Input id="date" name="date" type="date" defaultValue={t.date} /></FilterField>
          <FilterField label="Kelas" htmlFor="class">
            <Select id="class" name="class" defaultValue={classId}>
              <option value="">Semua kelas</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </FilterField>
        </FilterBar>
      </div>
      <ReportView table={t} exportQuery={`type=daily&date=${t.date}&class=${classId}`} />
    </>
  );
}
