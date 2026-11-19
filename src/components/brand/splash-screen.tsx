"use client";

import { useEffect, useState } from "react";

const TITLE = "Pandian Smart Attendance";
const KEY = "pandian-splash-seen";

/** Skrip kecil yang berjalan sebelum hidrasi: kunjungan berikutnya pada sesi yang sama tidak melihat animasi lagi. */
const SKIP_SCRIPT = `try{if(sessionStorage.getItem("${KEY}")){var e=document.getElementById("splash");if(e)e.style.display="none"}}catch(_){}`;

/**
 * Animasi pembuka: logo membesar perlahan, lalu nama aplikasi diketik di bawahnya.
 * Tampil sekali per sesi peramban, dapat dilewati dengan mengetuk, dan tanpa gerak bila pengguna mengurangi animasi.
 */
export function SplashScreen() {
  const [open, setOpen] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [typed, setTyped] = useState(0);

  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem(KEY) === "1"; } catch { /* penyimpanan tidak tersedia */ }
    if (seen) { setOpen(false); return; }
    try { sessionStorage.setItem(KEY, "1"); } catch { /* abaikan */ }

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let iv: ReturnType<typeof setInterval> | undefined;

    if (reduce) {
      setTyped(TITLE.length);
      timers.push(setTimeout(() => setLeaving(true), 900), setTimeout(() => setOpen(false), 1300));
    } else {
      timers.push(
        setTimeout(() => {
          let n = 0;
          iv = setInterval(() => {
            n += 1;
            setTyped(n);
            if (n >= TITLE.length && iv) clearInterval(iv);
          }, 55);
        }, 900),
        setTimeout(() => setLeaving(true), 3000),
        setTimeout(() => setOpen(false), 3600),
      );
    }
    return () => { timers.forEach(clearTimeout); if (iv) clearInterval(iv); };
  }, []);

  if (!open) return null;

  function skip() {
    setLeaving(true);
    setTimeout(() => setOpen(false), 350);
  }

  return (
    <>
      <div
        id="splash"
        role="status"
        aria-label="Memuat Pandian Smart Attendance"
        onClick={skip}
        className={`splash fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center px-6 text-white transition-opacity duration-500 ${leaving ? "opacity-0" : "opacity-100"}`}
      >
        <div className="splash-logo relative flex h-32 w-32 items-center justify-center rounded-[2rem] bg-white p-4 shadow-pop sm:h-40 sm:w-40">
          <span aria-hidden className="splash-ring absolute inset-0 rounded-[2rem] border-2 border-[#F5B82E]" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-full w-auto" />
        </div>
        <p className="mt-8 flex min-h-8 items-center text-xl font-semibold tracking-wide sm:text-2xl" aria-hidden>
          <span>{TITLE.slice(0, typed)}</span>
          <span className="splash-caret ml-0.5 inline-block h-6 w-0.5 bg-[#F5B82E] sm:h-7" />
        </p>
        <p className="mt-3 text-xs text-white/50">Ketuk untuk melewati</p>
      </div>
      <script dangerouslySetInnerHTML={{ __html: SKIP_SCRIPT }} />
    </>
  );
}