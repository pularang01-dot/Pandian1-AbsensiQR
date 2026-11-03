import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, CalendarDays, GraduationCap, ShieldCheck, Users } from "lucide-react";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SimpleForm } from "@/components/settings/simple-form";
import { loadSettings, str } from "@/lib/data/settings";
import { saveSchoolAction } from "./actions";

export const metadata: Metadata = { title: "Pengaturan" };
export const dynamic = "force-dynamic";

const LINKS = [
  { href: "/settings/users", title: "Pengguna", desc: "Buat akun, atur peran, aktifkan atau nonaktifkan.", icon: Users },
  { href: "/settings/academic-year", title: "Tahun ajaran", desc: "Buat, aktifkan, dan arsipkan tahun ajaran.", icon: GraduationCap },
  { href: "/settings/school-calendar", title: "Kalender sekolah", desc: "Hari libur, hari sekolah tambahan, kegiatan khusus.", icon: CalendarDays },
  { href: "/settings/attendance", title: "Aturan absensi", desc: "Jam masuk, batas terlambat, penutupan, hari sekolah.", icon: CalendarClock },
  { href: "/settings/roles", title: "Peran dan hak akses", desc: "Ringkasan wewenang setiap peran.", icon: ShieldCheck },
];

export default async function SettingsPage() {
  await requireRole(ADMIN_ROLES);
  const s = await loadSettings();
  return (
    <>
      <PageHeader title="Pengaturan" description="Semua perubahan pengaturan tercatat di jejak audit." />
      <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="card block p-5 hover:border-brand">
            <l.icon className="mb-3 h-6 w-6 text-brand" aria-hidden />
            <h2 className="text-base font-semibold">{l.title}</h2>
            <p className="mt-1 text-sm text-ink-muted">{l.desc}</p>
          </Link>
        ))}
      </div>
      <section className="card max-w-2xl p-5 sm:p-6">
        <h2 className="mb-1 text-base font-semibold">Identitas sekolah</h2>
        <p className="mb-4 text-sm text-ink-muted">Dipakai pada laporan. Isi sesuai data resmi sekolah; sistem tidak mengisi alamat atau kontak sendiri.</p>
        <SimpleForm action={saveSchoolAction}>
          <Field label="Nama sekolah" htmlFor="name" required><Input id="name" name="name" defaultValue={str(s["school.name"])} maxLength={150} /></Field>
          <Field label="Alamat" htmlFor="address"><Textarea id="address" name="address" defaultValue={str(s["school.address"])} maxLength={300} /></Field>
          <Field label="Telepon" htmlFor="phone"><Input id="phone" name="phone" defaultValue={str(s["school.phone"])} maxLength={30} /></Field>
        </SimpleForm>
      </section>
    </>
  );
}
