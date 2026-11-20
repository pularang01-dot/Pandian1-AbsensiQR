"use client";

import { useEffect, useState } from "react";
import { Toaster } from "sonner";

/** Notifikasi ikut tema yang sedang aktif di halaman. */
export function ThemedToaster() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const read = () => setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return <Toaster position="top-right" richColors closeButton theme={theme} />;
}