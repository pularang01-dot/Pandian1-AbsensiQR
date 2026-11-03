import type { ReactNode } from "react";
import { GraduationCap } from "lucide-react";

export function AuthShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between bg-navy p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
            <GraduationCap className="h-6 w-6" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-wide">PANDIAN SMART ATTENDANCE</p>
            <p className="text-xs text-white/70">SDN PANDIAN 1 SUMENEP</p>
          </div>
        </div>
        <div className="max-w-md">
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
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy text-white">
              <GraduationCap className="h-6 w-6" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">PANDIAN SMART ATTENDANCE</p>
              <p className="text-xs text-ink-muted">SDN PANDIAN 1 SUMENEP</p>
            </div>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          <p className="mt-1.5 text-sm text-ink-muted">{description}</p>
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </main>
  );
}
