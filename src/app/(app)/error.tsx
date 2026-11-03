"use client";

import { ErrorState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card">
      <ErrorState
        title="Terjadi kesalahan"
        message="Halaman tidak dapat dimuat. Periksa koneksi internet Anda lalu coba lagi. Data yang belum disimpan tidak tercatat."
        action={<Button onClick={reset}>Coba lagi</Button>}
      />
    </div>
  );
}
