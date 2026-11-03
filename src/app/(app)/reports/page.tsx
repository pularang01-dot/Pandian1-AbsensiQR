import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, CalendarRange, GraduationCap } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Laporan" };

const ITEMS = [
  { href: "/reports/daily", title: "Laporan harian", desc: "Rekap per kelas untuk satu tanggal, termasuk siswa yang belum tercatat.", icon: CalendarDays },
  { href: "/reports/monthly", title: "Laporan bulanan", desc: "Rekap per siswa untuk satu bulan dengan persentase kehadiran.", icon: CalendarRange },
  { href: "/reports/students", title: "Laporan per siswa", desc: "Rekap rentang tanggal dan rincian riwayat satu siswa.", icon: GraduationCap },
];

export default async function ReportsPage() {
  await requireRole(["super_admin", "school_admin", "principal", "teacher"]);
  return (
    <>
      <PageHeader title="Laporan" description="Semua laporan memakai perhitungan yang sama dengan dashboard. Guru hanya melihat kelasnya." />
      <div className="grid gap-4 md:grid-cols-3">
        {ITEMS.map((i) => (
          <Link key={i.href} href={i.href} className="card block p-5 hover:border-brand">
            <i.icon className="mb-3 h-6 w-6 text-brand" aria-hidden />
            <h2 className="text-base font-semibold">{i.title}</h2>
            <p className="mt-1 text-sm text-ink-muted">{i.desc}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
