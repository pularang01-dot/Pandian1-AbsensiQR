import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, CalendarDays, CalendarRange, CalendarCheck, ChevronRight, GraduationCap, Library } from "lucide-react";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Laporan" };

const GROUPS = [
  {
    title: "Menurut periode",
    desc: "Rekap seluruh kelas pada satu periode waktu.",
    items: [
      { href: "/reports/daily", title: "Laporan harian", desc: "Rekap per kelas untuk satu tanggal, termasuk siswa yang belum tercatat.", icon: CalendarDays },
      { href: "/reports/weekly", title: "Laporan mingguan", desc: "Rekap per siswa untuk satu minggu (Senin sampai Minggu).", icon: CalendarCheck },
      { href: "/reports/monthly", title: "Laporan bulanan", desc: "Rekap per siswa untuk satu bulan dengan persentase kehadiran.", icon: CalendarRange },
      { href: "/reports/semester", title: "Laporan semester", desc: "Rekap per siswa untuk semester Ganjil atau Genap dalam satu tahun ajaran.", icon: Library },
    ],
  },
  {
    title: "Menurut siswa",
    desc: "Telusuri riwayat satu siswa secara rinci.",
    items: [
      { href: "/reports/students", title: "Laporan per siswa", desc: "Rekap rentang tanggal dan rincian riwayat satu siswa.", icon: GraduationCap },
    ],
  },
];

export default async function ReportsPage() {
  await requireRole(["super_admin", "school_admin", "principal", "teacher"]);
  return (
    <>
      <section className="dash-hero mb-8 overflow-hidden rounded-2xl p-6 text-white shadow-pop sm:p-8">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15"><BarChart3 className="h-7 w-7" aria-hidden /></span>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Laporan</h1>
            <p className="mt-1 max-w-2xl text-sm text-white/70">Semua laporan memakai perhitungan yang sama dengan dashboard dan bisa diunduh sebagai XLSX, CSV, atau PDF. Guru hanya melihat kelasnya.</p>
          </div>
        </div>
      </section>
      <div className="space-y-8">
        {GROUPS.map((g) => (
          <section key={g.title} aria-labelledby={`rg-${g.title}`}>
            <h2 id={`rg-${g.title}`} className="text-lg font-semibold">{g.title}</h2>
            <p className="mb-3 text-sm text-ink-muted">{g.desc}</p>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {g.items.map((i) => (
                <Link key={i.href} href={i.href} className="card group flex gap-4 p-5 transition-colors hover:border-brand hover:bg-brand-light/30">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-light text-brand transition-colors group-hover:bg-brand group-hover:text-white"><i.icon className="h-5 w-5" aria-hidden /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-base font-semibold">{i.title}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden />
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-ink-muted">{i.desc}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}