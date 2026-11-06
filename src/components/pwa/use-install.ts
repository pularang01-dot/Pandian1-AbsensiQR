"use client";

import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

/**
 * Status pemasangan aplikasi yang dipakai bersama oleh tombol di bilah atas dan banner mengambang.
 * Peristiwa beforeinstallprompt bisa terjadi sebelum komponen tampil, jadi ditangkap di tingkat modul.
 */
let deferred: InstallEvent | null = null;
let installedFlag = false;
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as InstallEvent; notify(); });
  window.addEventListener("appinstalled", () => { installedFlag = true; deferred = null; notify(); });
}

export function useInstall() {
  const [, tick] = useState(0);
  const [env, setEnv] = useState({ ios: false, standalone: true });

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    setEnv({ ios: /iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone, standalone });
    const f = () => tick((n) => n + 1);
    subs.add(f);
    return () => { subs.delete(f); };
  }, []);

  const installed = env.standalone || installedFlag;
  return {
    installed,
    canPrompt: !installed && deferred !== null,
    ios: !installed && env.ios,
    async install() {
      if (!deferred) return;
      const e = deferred;
      deferred = null;
      notify();
      await e.prompt();
      await e.userChoice.catch(() => undefined);
    },
  };
}