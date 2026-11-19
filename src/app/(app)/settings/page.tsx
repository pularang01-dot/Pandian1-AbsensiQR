import type { Metadata } from "next";
import Link from "next/link";
import { Bug, CalendarClock, CalendarDays, ChevronRight, Database, GraduationCap, School, ShieldCheck, UserX, Users, type LucideIcon } from "lucide-react";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SimpleForm } from "@/components/settings/simple-form";
import { loadSettings, str } from "@/lib/data/settings";
import { saveSchoolAction } from "./actions";

export const metadata: Metadata = { title: "Pengaturan" };
export const dynamic = "force-dynamic";

type SettingLink = { href: string; title: string; desc: string; icon: LucideIcon; superOnly?: boolean };

const GROUPS: { title: string; desc: string; links: SettingLink[] }[] = [
  {
    title: "Akademik",
    desc: "Tahun ajaran, hari sekolah, dan aturan jam absensi.",
    links: [
      { href: "/settings/academic-year", title: "Tahun ajaran", desc: "Buat, ubah, aktifkan, dan arsipkan tahun ajaran, termasuk awal semester Genap.", icon: GraduationCap },
      { href: "/settings/school-calendar", title: "Kalender sekolah", desc: "Hari libur, hari sekolah tambahan, dan kegiatan khusus.", icon: CalendarDays },
      { href: "/settings/attendance", title: "Aturan absensi", desc: "Jam masuk, batas terlambat, penutupan, hari sekolah, dan cara pencatatan QR.", icon: CalendarClock },
    ],
  },
  {
    title: "Akun dan akses",
    desc: "Siapa yang bisa masuk dan apa yang boleh mereka lakukan.",
    links: [
      { href: "/settings/users", title: "Pengguna", desc: "Buat akun, ubah nama dan telepon, atur peran, aktifkan atau nonaktifkan.", icon: Users },
      { href: "/settings/roles", title: "Peran dan hak akses", desc: "Ringkasan wewenang setiap peran.", icon: ShieldCheck },
      { href: "/settings/hygiene", title: "Kebersihan akun", desc: "Penonaktifan otomatis akun orang tua tanpa anak aktif dan akun tidak terpakai.", icon: UserX },
    ],
  },
  {
    title: "Sistem",
    desc: "Keamanan data dan kesehatan aplikasi. Hanya Super Admin.",
    links: [
      { href: "/settings/backup", title: "Pencadangan data", desc: "Unduh cadangan terenkripsi seluruh data.", icon: Database, superOnly: true },
      { href: "/settings/errors", title: "Pemantauan error", desc: "Catatan kesalahan teknis aplikasi agar masalah terdeteksi tanpa menunggu laporan.", icon: Bug, superOnly: true },
    ],
  },
];

export default async function SettingsPage() {
  const me = await requireRole(ADMIN_ROLES);
  const s = await loadSettings();
  const isSuper = me.roles.includes("super_admin");
  const schoolName = str(s["school.name"]);
  return (
    <>
      <section className="dash-hero mb-8 overflow-hidden rounded-2xl p-6 text-white shadow-pop sm:p-8">
        <div className="flex items-center gap-4 sm:gap-5">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white p-2 shadow-card sm:h-20 sm:w-20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Lambang sekolah" className="h-full w-auto" />
          </span>
          <div className="min-w-0">
            <p className="text-sm text-white/70">Pengaturan</p>
            <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">{schoolName || "Sekolah"}</h1>
            <p className="mt-1 text-sm text-white/70">Semua perubahan pengaturan tercatat di jejak audit.</p>
          </div>
        </div>
      </section>

      <div className="mb-10 space-y-8">
        {GROUPS.map((g) => {
          const links = g.links.filter((l) => !l.superOnly || isSuper);
          if (links.length === 0) return null;
          return (
            <section key={g.title} aria-labelledby={`grp-${g.title}`}>
              <h2 id={`grp-${g.title}`} className="text-lg font-semibold">{g.title}</h2>
              <p className="mb-3 text-sm text-ink-muted">{g.desc}</p>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {links.map((l) => (
                  <Link key={l.href} href={l.href} className="card group flex gap-4 p-5 transition-colors hover:border-brand hover:bg-brand-light/30">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-light text-brand transition-colors group-hover:bg-brand group-hover:text-white"><l.icon className="h-5 w-5" aria-hidden /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-base font-semibold">{l.title}</span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden />
                      </span>
                      <span className="mt-1 block text-sm leading-relaxed text-ink-muted">{l.desc}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <section className="card max-w-3xl overflow-hidden" aria-labelledby="identitas">
        <div className="flex items-center gap-3 border-b border-line px-5 py-4 sm:px-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-light text-brand"><School className="h-5 w-5" aria-hidden /></span>
          <div>
            <h2 id="identitas" className="text-base font-semibold">Identitas sekolah</h2>
            <p className="text-sm text-ink-muted">Dipakai pada laporan. Isi sesuai data resmi sekolah; sistem tidak mengisi alamat atau kontak sendiri.</p>
          </div>
        </div>
        <div className="p-5 sm:p-6">
          <SimpleForm action={saveSchoolAction}>
            <Field label="Nama sekolah" htmlFor="name" required><Input id="name" name="name" defaultValue={schoolName} maxLength={150} /></Field>
            <Field label="Alamat" htmlFor="address"><Textarea id="address" name="address" defaultValue={str(s["school.address"])} maxLength={300} /></Field>
            <Field label="Telepon" htmlFor="phone"><Input id="phone" name="phone" defaultValue={str(s["school.phone"])} maxLength={30} /></Field>
          </SimpleForm>
        </div>
      </section>
    </>
  );
}