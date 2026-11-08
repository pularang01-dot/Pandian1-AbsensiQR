/** Kontak pengembang untuk laporan error. Diberikan sendiri oleh pengembang; ubah di sini bila nomor berganti. */
export const DEVELOPER = {
  name: "Viky Aditama",
  role: "Pengembang",
  /** Format nasional untuk ditampilkan. */
  phoneDisplay: "0823-3727-5370",
  /** Format internasional tanpa tanda + untuk tautan wa.me. */
  phoneIntl: "6282337275370",
} as const;

export function waLink(text: string): string {
  return `https://wa.me/${DEVELOPER.phoneIntl}?text=${encodeURIComponent(text.slice(0, 1200))}`;
}

export function errorReportText(e: { message: string; route: string | null; source: string; occurrences: number; digest: string | null; last_seen: string }, schoolName = "SDN Pandian 1 Sumenep"): string {
  return [
    `Halo Pak Viky, ada kesalahan di aplikasi Pandian Smart Attendance (${schoolName}).`,
    "",
    `Pesan: ${e.message}`,
    e.route ? `Halaman: ${e.route}` : "",
    `Jenis: ${e.source}`,
    `Terjadi: ${e.occurrences} kali, terakhir ${e.last_seen}`,
    e.digest ? `Kode: ${e.digest}` : "",
  ].filter(Boolean).join("\n");
}