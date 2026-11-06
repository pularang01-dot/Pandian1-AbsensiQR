import type { ReactNode } from "react";
import { SchoolLogo } from "@/components/brand/school-logo";
import { CopyrightFooter } from "@/components/layout/copyright-footer";

export function AuthShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between bg-navy p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <p className="text-sm font-semibold tracking-wide">PANDIAN SMART ATTENDANCE</p>
        </div>
        <div className="max-w-md">
          <div className="mb-8 inline-flex rounded-2xl bg-white p-4 shadow-pop">
            <SchoolLogo size={112} priority />
          </div>
          <p className="mb-3 text-sm font-semibold tracking-wide text-white/80">SDN PANDIAN 1 SUMENEP</p>
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            Absensi, perizinan, dan administrasi siswa dalam satu sistem yang tertib.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-white/70">
            Setiap catatan kehadiran, persetujuan, dan penjemputan siswa tercatat, dapat ditelusuri, dan dilindungi.
          </p>
        </div>
        <p className="text-xs text-white/50">Data siswa bersifat rahasia dan hanya untuk keperluan administrasi sekolah.</p>
      </section>

      <section className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <SchoolLogo size={52} priority />
            <div>
              <p className="text-sm font-semibold text-ink">PANDIAN SMART ATTENDANCE</p>
              <p className="text-xs text-ink-muted">SDN PANDIAN 1 SUMENEP</p>
            </div>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          <p className="mt-1.5 text-sm text-ink-muted">{description}</p>
          <div className="mt-8">{children}</div>
          <div className="mt-10"><CopyrightFooter /></div>
        </div>
      </section>
    </main>
  );
}