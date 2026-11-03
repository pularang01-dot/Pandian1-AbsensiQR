import "server-only";
import { parseISO, subDays } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { addCount, attendanceRate, emptyCounts, notRecorded, type StatusCounts } from "@/lib/attendance-calc";
import { formatTanggal, todayISO } from "@/lib/utils";

type SummaryRow = { session_date: string; class_id: string | null; status: string; total: number | string };
type ClassTotal = { class_id: string | null; total: number | string };

export type DashboardData = {
  date: string;
  totalStudents: number;
  counts: StatusCounts;
  rate: number | null;
  unrecorded: number;
  hasSession: boolean;
  trend: { label: string; rate: number | null }[];
  byClass: { id: string | null; name: string; total: number; counts: StatusCounts; rate: number | null }[];
  error: string | null;
};

/** Memuat seluruh angka dashboard dari database. Tidak ada angka bawaan. */
export async function loadDashboard(date: string, classId: string | null, classNames: Map<string, string>): Promise<DashboardData> {
  const supabase = await createClient();
  const from = todayISO(subDays(parseISO(date), 13));

  const [totals, summary] = await Promise.all([
    supabase.rpc("active_students_by_class", { p_class: classId }),
    supabase.rpc("attendance_summary", { p_from: from, p_to: date, p_class: classId }),
  ]);

  const error = totals.error?.message ?? summary.error?.message ?? null;
  const totalRows = (totals.data ?? []) as ClassTotal[];
  const rows = (summary.data ?? []) as SummaryRow[];

  const totalByClass = new Map<string | null, number>();
  for (const t of totalRows) totalByClass.set(t.class_id, Number(t.total));
  const totalStudents = [...totalByClass.values()].reduce((a, b) => a + b, 0);

  const counts = emptyCounts();
  const perClass = new Map<string | null, StatusCounts>();
  const perDay = new Map<string, StatusCounts>();
  for (const r of rows) {
    const day = perDay.get(r.session_date) ?? emptyCounts();
    addCount(day, r.status, Number(r.total));
    perDay.set(r.session_date, day);
    if (r.session_date === date) {
      addCount(counts, r.status, Number(r.total));
      const c = perClass.get(r.class_id) ?? emptyCounts();
      addCount(c, r.status, Number(r.total));
      perClass.set(r.class_id, c);
    }
  }

  const trend = [...perDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([d, c]) => ({ label: formatTanggal(d, "d MMM"), rate: attendanceRate(c, totalStudents) }));

  const byClass = [...totalByClass.entries()]
    .map(([id, total]) => {
      const c = perClass.get(id) ?? emptyCounts();
      return { id, name: id ? (classNames.get(id) ?? "Kelas") : "Belum ada kelas", total, counts: c, rate: attendanceRate(c, total) };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "id", { numeric: true }));

  return {
    date,
    totalStudents,
    counts,
    rate: attendanceRate(counts, totalStudents),
    unrecorded: notRecorded(counts, totalStudents),
    hasSession: perDay.has(date),
    trend,
    byClass,
    error,
  };
}
