import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { Input, Select } from "@/components/ui/field";
import { ReportView } from "@/components/reports/report-view";
import { buildMonthly } from "@/lib/data/reports";
import { asUuid, loadClasses } from "@/lib/data/lookups";

export const metadata: Metadata = { title: "Laporan Bulanan" };
export const dynamic = "force-dynamic";

export default async function MonthlyReportPage({ searchParams }: { searchParams: Promise<{ month?: string; class?: string }> }) {
  await requireRole(["super_admin", "school_admin", "principal", "teacher"]);
  const sp = await searchParams;
  const [t, classes] = await Promise.all([buildMonthly(sp.month, sp.class), loadClasses()]);
  const classId = asUuid(sp.class) ?? "";
  return (
    <>
      <PageHeader title="Laporan bulanan" description="Rekap per siswa untuk satu bulan." />
      <div className="card mb-6">
        <FilterBar action="/reports/monthly" resetHref="/reports/monthly">
          <FilterField label="Bulan" htmlFor="month"><Input id="month" name="month" type="month" defaultValue={t.month} /></FilterField>
          <FilterField label="Kelas" htmlFor="class">
            <Select id="class" name="class" defaultValue={classId}>
              <option value="">Semua kelas</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </FilterField>
        </FilterBar>
      </div>
      <ReportView table={t} exportQuery={`type=monthly&month=${t.month}&class=${classId}`} detailBase="/reports/students/" />
    </>
  );
}
