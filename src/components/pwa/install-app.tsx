"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

/** Tombol "Pasang aplikasi" di bilah atas. Android/Chrome/Edge memakai dialog bawaan; iPhone/iPad diberi petunjuk. */
export function InstallApp() {
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(true);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone);
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as InstallEvent); };
    const onInstalled = () => { setInstalled(true); setEvt(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  if (installed || (!evt && !ios)) return null;

  async function click() {
    if (evt) {
      await evt.prompt();
      await evt.userChoice.catch(() => undefined);
      setEvt(null);
    } else setHelp((v) => !v);
  }

  return (
    <div className="relative">
      <button type="button" onClick={click} className="flex h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-brand hover:bg-brand-light" aria-expanded={ios ? help : undefined}>
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