"use client";

import { useState } from "react";
import { Download, X } from "lucide-react";
import { useInstall } from "./use-install";

/** Tombol "Pasang aplikasi" di bilah atas. Android/Chrome/Edge memakai dialog bawaan; iPhone/iPad diberi petunjuk. */
export function InstallApp() {
  const { canPrompt, ios, install } = useInstall();
  const [help, setHelp] = useState(false);
  if (!canPrompt && !ios) return null;

  return (
    <div className="relative">
      <button type="button" onClick={() => (canPrompt ? install() : setHelp((v) => !v))} className="flex h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-brand hover:bg-brand-light" aria-expanded={!canPrompt ? help : undefined}>
        <Download className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">Pasang aplikasi</span>
        <span className="sr-only sm:hidden">Pasang aplikasi</span>
      </button>
      {help && (
        <div role="dialog" aria-label="Cara memasang aplikasi" className="absolute right-0 top-12 z-30 w-72 rounded-lg border border-line bg-surface p-4 text-sm shadow-pop">
          <button type="button" aria-label="Tutup petunjuk" onClick={() => setHelp(false)} className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-canvas"><X className="h-4 w-4" /></button>
          <p className="pr-8 font-semibold">Pasang di iPhone atau iPad</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-ink-muted">
            <li>Buka halaman ini di Safari.</li>
            <li>Ketuk tombol Bagikan.</li>
            <li>Pilih &quot;Tambahkan ke Layar Utama&quot;.</li>
          </ol>
        </div>
      )}
    </div>
  );
}