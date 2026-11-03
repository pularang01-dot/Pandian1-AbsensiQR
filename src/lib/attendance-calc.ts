/**
 * Perhitungan kehadiran TUNGGAL yang dipakai dashboard, laporan, dan ekspor
 * agar angka selalu konsisten di semua halaman.
 *
 * Aturan:
 * - Kehadiran fisik = Hadir + Terlambat. Sakit, Izin, dan Kegiatan Resmi BUKAN kehadiran fisik.
 * - Kegiatan Resmi Sekolah ditampilkan terpisah dari kategori ketidakhadiran biasa.
 * - Persentase kehadiran = kehadiran fisik / (siswa yang diharapkan di sekolah),
 *   di mana yang diharapkan = total siswa - peserta kegiatan resmi.
 */
export const STATUS_KEYS = ["present", "late", "sick", "permission", "official_activity", "unexcused", "unverified"] as const;
export type StatusKey = (typeof STATUS_KEYS)[number];
export type StatusCounts = Record<StatusKey, number>;

export function emptyCounts(): StatusCounts {
  return { present: 0, late: 0, sick: 0, permission: 0, official_activity: 0, unexcused: 0, unverified: 0 };
}

export function isStatusKey(v: unknown): v is StatusKey {
  return typeof v === "string" && (STATUS_KEYS as readonly string[]).includes(v);
}

export function addCount(target: StatusCounts, status: unknown, amount: number) {
  if (isStatusKey(status)) target[status] += Number(amount) || 0;
}

export function recordedTotal(c: StatusCounts) {
  return STATUS_KEYS.reduce((sum, k) => sum + c[k], 0);
}

export function physicalPresent(c: StatusCounts) {
  return c.present + c.late;
}

/** Persentase satu desimal. Mengembalikan null bila tidak ada siswa yang diharapkan. */
export function attendanceRate(c: StatusCounts, totalStudents: number): number | null {
  const expected = totalStudents - c.official_activity;
  if (expected <= 0) return null;
  return Math.round((physicalPresent(c) / expected) * 1000) / 10;
}

/** Siswa aktif yang belum memiliki catatan apa pun pada hari tersebut. */
export function notRecorded(c: StatusCounts, totalStudents: number) {
  return Math.max(0, totalStudents - recordedTotal(c));
}

export function formatRate(rate: number | null) {
  return rate === null ? "-" : `${rate.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}
