"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Menyalin teks laporan ke papan klip. Bila peramban menolak, teks ditampilkan agar bisa disalin manual. */
export function CopyReport({ text, label = "Salin laporan" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("ok");
      setTimeout(() => setState("idle"), 2500);
    } catch {
      setState("fail");
    }
  }
  return (
    <div>
      <Button type="button" variant="outline" size="sm" onClick={copy} aria-live="polite">
        {state === "ok" ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
        {state === "ok" ? "Tersalin" : label}
      </Button>
      {state === "fail" && (
        <textarea readOnly value={text} onFocus={(e) => e.currentTarget.select()} className="mt-2 min-h-28 w-full rounded-lg border border-line bg-surface p-2 text-xs" aria-label="Teks laporan, pilih lalu salin manual" />
      )}
    </div>
  );
}