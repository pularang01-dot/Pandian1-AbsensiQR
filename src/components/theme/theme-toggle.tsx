"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "light" | "dark" | "auto";
const OPTIONS: { key: Mode; label: string; icon: typeof Sun }[] = [
  { key: "light", label: "Terang", icon: Sun },
  { key: "dark", label: "Gelap", icon: Moon },
  { key: "auto", label: "Otomatis", icon: Monitor },
];

function apply(mode: Mode) {
  const dark = mode === "dark" || (mode === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeToggle({ className }: { className?: string }) {
  const [mode, setMode] = useState<Mode>("auto");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("theme");
      if (saved === "light" || saved === "dark" || saved === "auto") setMode(saved);
    } catch { /* penyimpanan tidak tersedia */ }
  }, []);

  // Mode otomatis mengikuti pengaturan perangkat secara langsung.
  useEffect(() => {
    if (mode !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => apply("auto");
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [mode]);

  const choose = (m: Mode) => {
    setMode(m);
    try { localStorage.setItem("theme", m); } catch { /* abaikan */ }
    apply(m);
  };

  return (
    <div role="radiogroup" aria-label="Tema tampilan" className={cn("inline-flex rounded-lg border border-line bg-canvas p-0.5", className)}>
      {OPTIONS.map(({ key, label, icon: Icon }) => {
        const on = mode === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={label}
            title={label}
            onClick={() => choose(key)}
            className={cn("flex h-9 w-9 items-center justify-center rounded-md transition-colors", on ? "bg-surface text-brand shadow-card" : "text-ink-muted hover:text-ink")}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}