"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SchoolLogo } from "@/components/brand/school-logo";
import { useInstall } from "./use-install";

const KEY = "pandian.installBanner.dismissedAt";
const SNOOZE_DAYS = 14;
const DELAY_MS = 3000;

function snoozed(): boolean {
  try {
    const t = Number(localStorage.getItem(KEY) ?? 0);
    return t > 0 && Date.now() - t < SNOOZE_DAYS * 86400000;
  } catch { return false; }
}

/** Banner mengambang di atas layar yang mengajak memasang aplikasi. Muncul sekali, dapat ditutup, ditunda 14 hari. */
export function InstallBanner() {
  const { canPrompt, ios, install } = useInstall();
  const [show, setShow] = useState(false);
  const available = canPrompt || ios;

  useEffect(() => {
    if (!available || snoozed()) return;
    const t = setTimeout(() => setShow(true), DELAY_MS);
    return () => clearTimeout(t);
  }, [available]);

  if (!show || !available) return null;

  function dismiss() {
    try { localStorage.setItem(KEY, String(Date.now())); } catch { /* abaikan */ }
    setShow(false);
  }

  return (
    <div role="region" aria-label="Ajakan memasang aplikasi" className="fixed inset-x-3 top-3 z-50 mx-auto max-w-md rounded-xl border border-line bg-surface p-4 shadow-pop">
      <button type="button" onClick={dismiss} aria-label="Tutup ajakan" className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted hover:bg-canvas"><X className="h-4 w-4" /></button>
      <div className="flex items-start gap-3 pr-8">
        <SchoolLogo size={40} />
        <div className="min-w-0 text-sm">
          <p className="font-semibold text-ink">Pasang Pandian Absensi</p>
          {canPrompt ? (
            <p className="mt-0.5 text-ink-muted">Buka lebih cepat dari layar utama, tampil seperti aplikasi biasa.</p>
          ) : (
            <p className="mt-0.5 text-ink-muted">Di Safari, ketuk tombol Bagikan lalu pilih &quot;Tambahkan ke Layar Utama&quot;.</p>
          )}
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={dismiss}>Nanti</Button>
        {canPrompt && <Button size="sm" onClick={async () => { await install(); dismiss(); }}>Pasang</Button>}
        {!canPrompt && <Button size="sm" onClick={dismiss}>Mengerti</Button>}
      </div>
    </div>
  );
}