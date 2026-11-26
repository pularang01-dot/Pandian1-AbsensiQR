"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Garis emas di atas layar yang langsung muncul saat tautan diketuk, sebelum halaman baru selesai dimuat.
 * Tanpa ini layar tampak diam beberapa detik dan terasa seperti tombol tidak bekerja.
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  // Halaman baru sudah tampil: selesaikan garis.
  useEffect(() => {
    setState((s) => (s === "loading" ? "done" : s));
    const t = setTimeout(() => setState("idle"), 700);
    return () => clearTimeout(t);
  }, [pathname, search]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest("a");
      if (!a || !a.href || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setState("loading");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Pengaman: garis tidak boleh menggantung bila navigasi dibatalkan.
  useEffect(() => {
    if (state !== "loading") return;
    const t = setTimeout(() => setState("idle"), 15000);
    return () => clearTimeout(t);
  }, [state]);

  if (state === "idle") return null;
  return <div aria-hidden className="nav-bar" data-state={state} />;
}