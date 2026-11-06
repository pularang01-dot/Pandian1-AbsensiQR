"use client";

import { useEffect } from "react";

/** Mendaftarkan service worker (hanya produksi). Kegagalan tidak memengaruhi aplikasi. */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
  }, []);
  return null;
}