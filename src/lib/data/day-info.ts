import "server-only";
import { createClient } from "@/lib/supabase/server";

export type DayInfo = {
  isSchoolDay: boolean;
  /** Alasan tidak ada sesi: libur yang ditetapkan di Kalender Sekolah, atau di luar hari sekolah biasa (mis. Sabtu/Minggu). */
  reason: "holiday" | "non_school_day" | null;
  /** Keterangan libur dari Kalender Sekolah. */
  description: string | null;
};

/** Apakah tanggal ini hari sekolah? Memakai fungsi basis data yang sama dengan yang menolak pencatatan. */
export async function loadDayInfo(date: string): Promise<DayInfo> {
  const supabase = await createClient();
  const [isDay, cal] = await Promise.all([
    supabase.rpc("is_school_day", { d: date }),
    supabase.from("school_calendar").select("kind, description").eq("calendar_date", date),
  ]);
  const isSchoolDay = isDay.data !== false;
  if (isSchoolDay) return { isSchoolDay: true, reason: null, description: null };
  const holiday = (cal.data ?? []).find((r) => r.kind === "holiday");
  return holiday
    ? { isSchoolDay: false, reason: "holiday", description: holiday.description as string }
    : { isSchoolDay: false, reason: "non_school_day", description: null };
}

/** Teks pemberitahuan untuk hari tanpa sesi absensi. */
export function noSessionText(info: DayInfo): { title: string; text: string } | null {
  if (info.isSchoolDay) return null;
  if (info.reason === "holiday") {
    return {
      title: `Hari libur${info.description ? `: ${info.description}` : ""}`,
      text: "Tidak ada sesi absensi pada tanggal ini. Absensi tidak dibuka dan tidak ada siswa yang dihitung alpa.",
    };
  }
  return {
    title: "Bukan hari sekolah",
    text: "Tidak ada sesi absensi pada tanggal ini. Absensi tidak dibuka dan tidak ada siswa yang dihitung alpa.",
  };
}