import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, format, parse } from "date-fns";
import { requireRole } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { Input, Select } from "@/components/ui/field";
import { ReportView } from "@/components/reports/report-view";
import { buildWeekly } from "@/lib/data/reports";
import { asUuid, loadClasses } from "@/lib/data/lookups";

export const metadata: Metadata = { title: "Laporan Mingguan" };
export const dynamic = "force-dynamic";

export default async function WeeklyReportPage({ searchParams }: { searchParams: Promise<{ date?: string; class?: string }> }) {
  await requireRole(["super_admin", "school_admin", "principal", "teacher"]);
  const sp = await searchParams;
  const [t, classes] = await Promise.all([buildWeekly(sp.date, sp.class), loadClasses()]);
  const classId = asUuid(sp.class) ?? "";
  const shift = (n: number) => format(addDays(parse(t.from, "yyyy-MM-dd", new Date()), n), "yyyy-MM-dd");
  const link = (d: string) => `/reports/weekly?date=${d}${classId ? `&class=${classId}` : ""}`;
  const nav = "inline-flex h-11 items-center gap-1 rounded-lg border border-line px-3.5 text-sm font-medium hover:bg-canvas";
  return (
    <>
      <PageHeader title="Laporan mingguan" description="Rekap per siswa untuk satu minggu, Senin sampai Minggu." />
      <div className="card mb-6">
        <FilterBar action="/reports/weekly" resetHref="/reports/weekly">
          <FilterField label="Tanggal dalam minggu itu" htmlFor="date"><Input id="date" name="date" type="date" defaultValue={t.anchor} /></FilterField>
          <FilterField label="Kelas" htmlFor="class">
            <Select id="class" name="class" defaultValue={classId}>
              <option value="">Semua kelas</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </FilterField>
        </FilterBar>
      </div>
      <div className="mb-4 flex gap-2 print:hidden">
        <Link href={link(shift(-7))} className={nav}><ChevronLeft className="h-4 w-4" aria-hidden />Minggu sebelumnya</Link>
        <Link href={link(shift(7))} className={nav}>Minggu berikutnya<ChevronRight className="h-4 w-4" aria-hidden /></Link>
      </div>
      <ReportView table={t} exportQuery={`type=weekly&date=${t.anchor}&class=${classId}`} detailBase="/reports/students/" />
    </>
  );
}