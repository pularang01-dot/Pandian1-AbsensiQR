import { redirect } from "next/navigation";

// Laporan absensi terpusat di modul Laporan agar perhitungan seragam.
export default function AttendanceReportsRedirect() {
  redirect("/reports");
}
