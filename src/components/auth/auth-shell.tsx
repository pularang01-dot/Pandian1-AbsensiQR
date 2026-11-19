import type { ReactNode } from "react";
import { QrCode, ScrollText, ShieldCheck } from "lucide-react";
import { SchoolLogo } from "@/components/brand/school-logo";
import { CopyrightFooter } from "@/components/layout/copyright-footer";

const FEATURES = [
  { icon: QrCode, label: "Absensi kartu QR" },
  { icon: ShieldCheck, label: "Izin dan penjemputan terverifikasi" },
  { icon: ScrollText, label: "Jejak audit permanen" },
];

/** Lambang besar dengan bingkai pemindai emas dan garis pindai: gambaran langsung dari fungsi aplikasi. */
function LogoStage({ size, className = "" }: { size: number; className?: string }) {
  return (
    <div className={`relative ${className}`} style={{ width: size + 64, height: size * 1.018 + 64 }}>
      <span aria-hidden className="absolute left-0 top-0 h-10 w-10 rounded-tl-2xl border-l-4 border-t-4 border-[#F5B82E]" />
      <span aria-hidden className="absolute right-0 top-0 h-10 w-10 rounded-tr-2xl border-r-4 border-t-4 border-[#F5B82E]" />
      <span aria-hidden className="absolute bottom-0 left-0 h-10 w-10 rounded-bl-2xl border-b-4 border-l-4 border-[#F5B82E]" />
      <span aria-hidden className="absolute bottom-0 right-0 h-10 w-10 rounded-br-2xl border-b-4 border-r-4 border-[#F5B82E]" />
      <div className="absolute inset-4 flex items-center justify-center overflow-hidden rounded-[2rem] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <SchoolLogo size={size} priority />
        <span aria-hidden className="scan-line absolute inset-x-4 top-0 h-0.5 rounded-full bg-[#F5B82E]" />
      </div>
    </div>
  );
}

export function AuthShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.15fr_1fr]">
      {/* Panel kiri (layar lebar) */}
      <section className="auth-hero relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:items-center lg:justify-between lg:px-14 lg:py-12">
        <span aria-hidden className="auth-wave pointer-events-none absolute left-1/2 top-[34%] h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
        <span aria-hidden className="auth-wave pointer-events-none absolute left-1/2 top-[34%] h-[50rem] w-[50rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.07]" style={{ ["--d" as string]: "1.2s" }} />
        <span aria-hidden className="pointer-events-none absolute left-1/2 top-[34%] h-[68rem] w-[68rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/5" />
        <span aria-hidden className="pointer-events-none absolute -bottom-48 left-1/2 h-96 w-[40rem] -translate-x-1/2 rounded-full bg-[#F5B82E]/10 blur-3xl" />

        <div className="relative pt-4">
          <p className="auth-rise text-center text-xs font-medium tracking-[0.3em] text-white/60" style={{ ["--d" as string]: "0ms" }}>SELAMAT DATANG</p>
        </div>

        <div className="relative flex flex-col items-center text-center">
          <LogoStage size={176} className="auth-pop" />
          <h2 className="auth-rise mt-10 text-4xl font-bold tracking-tight xl:text-5xl" style={{ ["--d" as string]: "250ms" }}>Pandian Smart Attendance</h2>
          <p className="auth-rise mt-3 text-lg font-semibold tracking-wide text-[#F5B82E]" style={{ ["--d" as string]: "330ms" }}>SDN PANDIAN 1 SUMENEP</p>
          <p className="auth-rise mt-5 max-w-lg text-base leading-relaxed text-white/70" style={{ ["--d" as string]: "410ms" }}>
            Kehadiran siswa tercatat tertib, aman, dan dapat ditelusuri, dari gerbang sekolah sampai laporan akhir semester.
          </p>
          <ul className="mt-8 flex flex-wrap justify-center gap-3">
            {FEATURES.map((f, i) => (
              <li key={f.label} className="auth-rise flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm ring-1 ring-white/15" style={{ ["--d" as string]: `${500 + i * 100}ms` }}>
                <f.icon className="h-4 w-4 text-[#F5B82E]" aria-hidden />{f.label}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-center text-xs text-white/50">Data siswa bersifat rahasia dan hanya untuk keperluan administrasi sekolah.</p>
      </section>

      {/* Panel kanan: formulir */}
      <section className="flex flex-col bg-canvas lg:bg-surface">
        {/* Spanduk untuk ponsel dan tablet */}
        <div className="auth-hero relative overflow-hidden px-5 pb-20 pt-10 text-center text-white lg:hidden">
          <span aria-hidden className="auth-wave pointer-events-none absolute left-1/2 top-[40%] h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
          <span aria-hidden className="pointer-events-none absolute left-1/2 top-[40%] h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/5" />
          <div className="relative flex flex-col items-center">
            <LogoStage size={104} className="auth-pop" />
            <p className="mt-6 text-xl font-bold tracking-tight">Pandian Smart Attendance</p>
            <p className="mt-1 text-sm font-semibold tracking-wide text-[#F5B82E]">SDN PANDIAN 1 SUMENEP</p>
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