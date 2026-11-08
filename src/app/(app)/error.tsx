"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ErrorState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { reportClientErrorAction } from "./error-actions";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const path = usePathname();
  useEffect(() => {
    // Error yang berasal dari server (punya digest) sudah dicatat oleh instrumentation; cukup catat yang murni di peramban.
    if (!error.digest) void reportClientErrorAction({ message: error.message, route: path });
  }, [error, path]);

  return (
    <div className="card">
      <ErrorState
        title="Terjadi kesalahan"
        message="Halaman tidak dapat dimuat. Periksa koneksi internet Anda lalu coba lagi. Data yang belum disimpan tidak tercatat."
        action={<Button onClick={reset}>Coba lagi</Button>}
      />
      {error.digest && <p className="px-6 pb-4 text-center text-xs text-ink-muted">Kode kesalahan: {error.digest}. Sebutkan kode ini bila melapor ke administrator.</p>}
    </div>
  );
}