import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addCount, emptyCounts, notRecorded } from "@/lib/attendance-calc";

/** Ringkasan satu tanggal (semua kelas yang boleh dilihat peran pemanggil). Memakai fungsi yang sama dengan dashboard. */
export async function loadDaySummary(date: string) {
  const supabase = await createClient();
  const [totals, summary, isDay, session] = await Promise.all([
    supabase.rpc("active_students_by_class"),
    supabase.rpc("attendance_summary", { p_from: date, p_to: date, p_class: null }),
    supabase.rpc("is_school_day", { d: date }),
    supabase.from("attendance_sessions").select("id, status").eq("session_date", date).maybeSingle(),
  ]);
  const total = ((totals.data ?? []) as { total: number | string }[]).reduce((s, r) => s + Number(r.total), 0);
  const counts = emptyCounts();
  for (const r of (summary.data ?? []) as { status: string; total: number | string }[]) addCount(counts, r.status, Number(r.total));
  return {
    total,
    counts,
    unrecorded: notRecorded(counts, total),
    isSchoolDay: isDay.data !== false,
    sessionStatus: (session.data?.status as "open" | "closed" | undefined) ?? null,
    error: totals.error?.message ?? summary.error?.message ?? null,
  };
}
