"use client";

/** Error pada tata letak utama. Harus memuat html dan body sendiri. Server sudah mencatatnya lewat instrumentation. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="id">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f6f8fb", margin: 0 }}>
        <main style={{ maxWidth: 480, margin: "15vh auto", padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 20 }}>Terjadi kesalahan</h1>
          <p style={{ color: "#4b5563", fontSize: 14 }}>Aplikasi tidak dapat dimuat. Periksa koneksi internet lalu coba lagi.</p>
          {error.digest && <p style={{ color: "#6b7280", fontSize: 12 }}>Kode kesalahan: {error.digest}</p>}
          <button onClick={reset} style={{ height: 44, padding: "0 20px", borderRadius: 8, border: 0, background: "#2f6fcc", color: "#fff", fontSize: 14, cursor: "pointer" }}>Coba lagi</button>
        </main>
      </body>
    </html>
  );
}