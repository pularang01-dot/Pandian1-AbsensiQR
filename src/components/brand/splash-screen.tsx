"use client";

import { useEffect, useState } from "react";

const TITLE = "Pandian Smart Attendance";
const KEY = "pandian-splash-seen";

/** Skrip kecil yang berjalan sebelum hidrasi: kunjungan berikutnya pada sesi yang sama tidak melihat animasi lagi. */
const SKIP_SCRIPT = `try{if(sessionStorage.getItem("${KEY}")){var e=document.getElementById("splash");if(e)e.style.display="none"}}catch(_){}`;

/**
 * Animasi pembuka: bingkai pemindai menutup, garis emas menyapu dan menampakkan lambang, lalu nama aplikasi muncul huruf demi huruf.
 * Tampil sekali per sesi peramban, dapat dilewati dengan mengetuk, dan tanpa gerak bila pengguna mengurangi animasi.
 */
export function SplashScreen() {
  const [open, setOpen] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem(KEY) === "1"; } catch { /* penyimpanan tidak tersedia */ }
    if (seen) { setOpen(false); return; }
    try { sessionStorage.setItem(KEY, "1"); } catch { /* abaikan */ }

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t1 = setTimeout(() => setLeaving(true), reduce ? 900 : 4000);
    const t2 = setTimeout(() => setOpen(false), reduce ? 1300 : 4600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (!open) return null;

  function skip() {
    setLeaving(true);
    setTimeout(() => setOpen(false), 350);
  }

  const bracket = "splash-corner absolute h-10 w-10 border-[#F5B82E] sm:h-12 sm:w-12";

  return (
    <>
      <div
        id="splash"
        suppressHydrationWarning
        role="status"
        aria-label="Memuat Pandian Smart Attendance"
        onClick={skip}
        className={`splash fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center px-6 text-white transition-all duration-500 ${leaving ? "scale-[1.03] opacity-0" : "scale-100 opacity-100"}`}
      >
        <div className="relative h-44 w-44 sm:h-56 sm:w-56">
          <span aria-hidden className="splash-glow absolute inset-0 rounded-[2.5rem] bg-[#F5B82E]/30 blur-2xl" />
          <span aria-hidden className={`${bracket} left-0 top-0 rounded-tl-2xl border-l-4 border-t-4`} />
          <span aria-hidden className={`${bracket} right-0 top-0 rounded-tr-2xl border-r-4 border-t-4`} />
          <span aria-hidden className={`${bracket} bottom-0 left-0 rounded-bl-2xl border-b-4 border-l-4`} />
          <span aria-hidden className={`${bracket} bottom-0 right-0 rounded-br-2xl border-b-4 border-r-4`} />
          <div className="absolute inset-5 sm:inset-6">
            <div className="splash-tile flex h-full w-full items-center justify-center rounded-[1.75rem] bg-white p-4 shadow-[0_24px_60px_rgba(0,0,0,0.45)] sm:p-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" className="h-full w-auto" />
            </div>
            <span aria-hidden className="splash-scan absolute inset-x-[-0.5rem] top-0 h-0.5 rounded-full bg-[#F5B82E] shadow-[0_0_14px_3px_rgba(245,184,46,0.8)]" />
          </div>
        </div>

        <h1 className="mt-10 text-center text-2xl font-semibold tracking-wide sm:text-4xl" aria-hidden>
          {TITLE.split("").map((ch, i) =>
            ch === " " ? <span key={i} className="inline-block w-[0.3em]" /> : <span key={i} className="splash-letter inline-block" style={{ ["--i" as string]: i }}>{ch}</span>,
          )}
        </h1>
        <span aria-hidden className="splash-rule mt-5 block h-px bg-[#F5B82E]" />
        <p aria-hidden className="splash-sub mt-4 text-center text-xs font-medium tracking-[0.28em] text-white/70 sm:text-sm">SDN PANDIAN 1 SUMENEP</p>
        <p className="absolute bottom-6 text-xs text-white/40">Ketuk untuk melewati</p>
      </div>
      <script dangerouslySetInnerHTML={{ __html: SKIP_SCRIPT }} />
    </>
  );
}