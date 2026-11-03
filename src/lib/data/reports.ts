import "server-only";
import { endOfMonth, format, isValid, parse } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { addCount, attendanceRate, emptyCounts, formatRate, notRecorded, type StatusCounts } from "@/lib/attendance-calc";
import { asDate, asUuid, loadClasses } from "@/lib/data/lookups";
import { formatTanggal, todayISO } from "@/lib/utils";

export type ReportTable = {
  title: string;
  subtitle: string;
  head: string[];
  rows: (string | number)[][];
  notes: string[];
  error: string | null;
  /** Opsional: id siswa per baris (laporan per siswa), untuk tautan ke rincian. */
  rowIds?: string[];
};

export type ReportKind = "daily" | "monthly" | "students";

const NOTE_RULES = [
  "Kehadiran fisik = Hadir + Terlambat. Sakit, Izin, dan Kegiatan Resmi Sekolah bukan kehadiran fisik.",
  "Persentase kehadiran = kehadiran fisik / (jumlah siswa - Kegiatan Resmi Sekolah). Kegiatan Resmi Sekolah ditampilkan terpisah.",
  "Siswa tanpa catatan tidak dihitung Alpa otomatis. Kolom Belum Tercatat menunjukkan siswa yang belum direkonsiliasi.",
];

export function monthRange(month: string | null | undefined): { month: string; from: string; to: string } {
  const parsed = month && /^\d{4}-\d{2}$/.test(month) ? parse(month, "yyyy-MM", new Date()) : null;
  const base = parsed && isValid(parsed) ? parsed : parse(todayISO().slice(0, 7), "yyyy-MM", new Date());
  return { month: format(base, "yyyy-MM"), from: format(base, "yyyy-MM-dd"), to: format(endOfMonth(base), "yyyy-MM-dd") };
}

export function dateRange(from?: string | null, to?: string | null) {
  const t = todayISO();
  let f = asDate(from) ?? `${t.slice(0, 7)}-01`;
  let e = asDate(to) ?? t;
  if (f > e) [f, e] = [e, f];
  return { from: f, to: e };
}

type SummaryRow = {
  student_id: string; nis: string; full_name: string; class_name: string | null;
  present: number | string; late: number | string; sick: number | string; permission: number | string;
  official_activity: number | string; unexcused: number | string; unverified: number | string; school_days: number | string;
};

async function studentRows(from: string, to: string, classId: string | null) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("student_attendance_summary", { p_from: from, p_to: to, p_class: classId });
  const src = (data ?? []) as SummaryRow[];
  const ids = src.map((r) => r.student_id);
  const rows = src.map((r) => {
    const c: StatusCounts = {
      present: Number(r.present), late: Number(r.late), sick: Number(r.sick), permission: Number(r.permission),
      official_activity: Number(r.official_activity), unexcused: Number(r.unexcused), unverified: Number(r.unverified),
    };
    const days = Number(r.school_days);
    return [r.nis, r.full_name, r.class_name ?? "Tanpa kelas", days, c.present, c.late, c.sick, c.permission, c.official_activity, c.unexcused, c.unverified, formatRate(attendanceRate(c, days))];
  });
  return { rows, ids, error: error ? "Data laporan tidak dapat dimuat." : null };
}

const STUDENT_HEAD = ["NIS", "Nama", "Kelas", "Hari Sekolah", "Hadir", "Terlambat", "Sakit", "Izin", "Kegiatan Resmi", "Alpa", "Belum Diverifikasi", "Kehadiran"];

export async function buildDaily(dateParam: string | null | undefined, classParam: string | null | undefined): Promise<ReportTable & { date: string }> {
  const date = asDate(dateParam) ?? todayISO();
  const classId = asUuid(classParam);
  const supabase = await createClient();
  const [classes, totals, summary] = await Promise.all([
    loadClasses(),
    supabase.rpc("active_students_by_class", { p_class: classId }),
    supabase.rpc("attendance_summary", { p_from: date, p_to: date, p_class: classId }),
  ]);

  const names = new Map(classes.map((c) => [c.id, c.name]));
  const perClass = new Map<string, { total: number; counts: StatusCounts }>();
  const slot = (k: string) => { if (!perClass.has(k)) perClass.set(k, { total: 0, counts: emptyCounts() }); return perClass.get(k)!; };
  for (const r of (totals.data ?? []) as { class_id: string | null; total: number | string }[]) slot(r.class_id ?? "none").total += Number(r.total);
  for (const r of (summary.data ?? []) as { class_id: string | null; status: string; total: number | string }[]) addCount(slot(r.class_id ?? "none").counts, r.status, Number(r.total));

  const entries = [...perClass.entries()].sort((a, b) => (names.get(a[0]) ?? "~").localeCompare(names.get(b[0]) ?? "~", "id", { numeric: true }));
  const sum = { total: 0, counts: emptyCounts() };
  const rows = entries.map(([k, v]) => {
    sum.total += v.total;
    for (const key of Object.keys(v.counts) as (keyof StatusCounts)[]) sum.counts[key] += v.counts[key];
    return [names.get(k) ?? "Tanpa kelas", v.total, v.counts.present, v.counts.late, v.counts.sick, v.counts.permission, v.counts.official_activity, v.counts.unexcused, v.counts.unverified, notRecorded(v.counts, v.total), formatRate(attendanceRate(v.counts, v.total))];
  });
  if (rows.length > 0) {
    rows.push(["Total", sum.total, sum.counts.present, sum.counts.late, sum.counts.sick, sum.counts.permission, sum.counts.official_activity, sum.counts.unexcused, sum.counts.unverified, notRecorded(sum.counts, sum.total), formatRate(attendanceRate(sum.counts, sum.total))]);
  }
  return {
    date,
    title: "Laporan Absensi Harian",
    subtitle: formatTanggal(date) + (classId ? ` | Kelas ${names.get(classId) ?? ""}` : " | Semua kelas"),
    head: ["Kelas", "Siswa Aktif", "Hadir", "Terlambat", "Sakit", "Izin", "Kegiatan Resmi", "Alpa", "Belum Diverifikasi", "Belum Tercatat", "Kehadiran"],
    rows, notes: NOTE_RULES, error: totals.error || summary.error ? "Data laporan tidak dapat dimuat." : null,
  };
}

export async function buildMonthly(monthParam: string | null | undefined, classParam: string | null | undefined): Promise<ReportTable & { month: string }> {
  const { month, from, to } = monthRange(monthParam);
  const classId = asUuid(classParam);
  const [classes, r] = await Promise.all([loadClasses(), studentRows(from, to, classId)]);
  return {
    month,
    title: "Laporan Absensi Bulanan",
    subtitle: `${formatTanggal(from, "MMMM yyyy")}${classId ? ` | Kelas ${classes.find((c) => c.id === classId)?.name ?? ""}` : " | Semua kelas"}`,
    head: STUDENT_HEAD, rows: r.rows,
    notes: [...NOTE_RULES, "Hari Sekolah = jumlah sesi absensi pada periode. Hari libur tidak memiliki sesi."], error: r.error,
  };
}

export async function buildStudents(fromParam: string | null | undefined, toParam: string | null | undefined, classParam: string | null | undefined, q?: string): Promise<ReportTable & { from: string; to: string }> {
  const { from, to } = dateRange(fromParam, toParam);
  const classId = asUuid(classParam);
  const [classes, r] = await Promise.all([loadClasses(), studentRows(from, to, classId)]);
  const needle = (q ?? "").trim().toLowerCase();
  const keep = r.rows.map((x, i) => (!needle || String(x[1]).toLowerCase().includes(needle) || String(x[0]).toLowerCase().includes(needle) ? i : -1)).filter((i) => i >= 0);
  const rows = keep.map((i) => r.rows[i]);
  return {
    from, to, rowIds: keep.map((i) => r.ids[i]),
    title: "Laporan Absensi per Siswa",
    subtitle: `${formatTanggal(from, "d MMM yyyy")} s.d. ${formatTanggal(to, "d MMM yyyy")}${classId ? ` | Kelas ${classes.find((c) => c.id === classId)?.name ?? ""}` : " | Semua kelas"}`,
    head: STUDENT_HEAD, rows, notes: NOTE_RULES, error: r.error,
  };
}

export async function buildReport(kind: ReportKind, sp: URLSearchParams): Promise<ReportTable> {
  if (kind === "daily") return buildDaily(sp.get("date"), sp.get("class"));
  if (kind === "monthly") return buildMonthly(sp.get("month"), sp.get("class"));
  return buildStudents(sp.get("from"), sp.get("to"), sp.get("class"), sp.get("q") ?? "");
}
