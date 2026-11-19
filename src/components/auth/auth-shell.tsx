import type { ReactNode } from "react";
import { QrCode, ScrollText, ShieldCheck } from "lucide-react";
import { SchoolLogo } from "@/components/brand/school-logo";
import { CopyrightFooter } from "@/components/layout/copyright-footer";

const FEATURES = [
  { icon: QrCode, title: "Absensi cepat dengan kartu QR", text: "Pindai kartu siswa, pastikan identitasnya, dan kehadiran langsung tercatat." },
  { icon: ShieldCheck, title: "Izin dan penjemputan terverifikasi", text: "Setiap izin, dispensasi, dan pulang lebih awal melalui persetujuan yang jelas." },
  { icon: ScrollText, title: "Jejak audit yang tidak bisa diubah", text: "Siapa melakukan apa dan kapan selalu tercatat dan dapat ditelusuri." },
];

export function AuthShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Panel kiri (layar lebar) */}
      <section className="auth-hero relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-between lg:p-14">
        <span aria-hidden className="auth-orb pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full border border-white/10" />
        <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full border border-white/10" />
        <span aria-hidden className="pointer-events-none absolute -bottom-40 -left-24 h-[28rem] w-[28rem] rounded-full bg-[#F5B82E]/10 blur-2xl" />

        <div className="auth-rise relative flex items-center gap-3" style={{ ["--d" as string]: "0ms" }}>
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white p-1.5 shadow-pop"><SchoolLogo size={36} priority /></span>
          <div>
            <p className="text-sm font-semibold tracking-wide">PANDIAN SMART ATTENDANCE</p>
            <p className="text-xs text-white/60">SDN PANDIAN 1 SUMENEP</p>
          </div>
        </div>

        <div className="relative max-w-xl">
          <h2 className="auth-rise text-4xl font-semibold leading-[1.15] tracking-tight xl:text-5xl" style={{ ["--d" as string]: "120ms" }}>
            Kehadiran siswa tercatat tertib, aman, dan dapat ditelusuri.
          </h2>
          <p className="auth-rise mt-5 max-w-md text-base leading-relaxed text-white/70" style={{ ["--d" as string]: "220ms" }}>
            Satu sistem untuk absensi, perizinan, dan administrasi siswa, dari gerbang sekolah sampai laporan akhir semester.
          </p>
          <ul className="mt-10 space-y-5">
            {FEATURES.map((f, i) => (
              <li key={f.title} className="auth-rise flex gap-4" style={{ ["--d" as string]: `${340 + i * 110}ms` }}>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15"><f.icon className="h-5 w-5 text-[#F5B82E]" aria-hidden /></span>
                <div>
                  <p className="text-sm font-semibold">{f.title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-white/65">{f.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/50">Data siswa bersifat rahasia dan hanya untuk keperluan administrasi sekolah.</p>
      </section>

      {/* Panel kanan: formulir */}
      <section className="flex flex-col bg-canvas lg:bg-surface">
        {/* Spanduk ringkas untuk ponsel dan tablet */}
        <div className="auth-hero relative overflow-hidden px-5 pb-16 pt-8 text-white lg:hidden">
          <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full border border-white/10" />
          <div className="relative flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white p-1.5 shadow-pop"><SchoolLogo size={36} priority /></span>
            <div>
              <p className="text-sm font-semibold tracking-wide">PANDIAN SMART ATTENDANCE</p>
              <p className="text-xs text-white/60">SDN PANDIAN 1 SUMENEP</p>
            </div>
          </div>
        </div>

        <div className="-mt-10 flex flex-1 items-start justify-center px-5 pb-10 lg:mt-0 lg:items-center lg:py-12">
          <div className="auth-rise w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-pop sm:p-8 lg:border-0 lg:p-0 lg:shadow-none" style={{ ["--d" as string]: "60ms" }}>
            <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{title}</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{description}</p>
            <div className="mt-8">{children}</div>
            <div className="mt-10"><CopyrightFooter /></div>
          </div>
        </div>
      </section>
    </main>
  );
}