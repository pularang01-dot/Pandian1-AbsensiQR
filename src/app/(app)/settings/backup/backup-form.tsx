"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";

export function BackupForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError("");
    setBusy(true);
    try {
      const fd = new FormData(form);
      const res = await fetch("/api/backup", { method: "POST", body: fd });
      if (res.ok && !(res.headers.get("Content-Type") ?? "").includes("octet-stream")) {
        setError("Sesi Anda berakhir. Masuk kembali lalu coba lagi.");
        return;
      }
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(j?.message ?? "Cadangan gagal dibuat.");
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const name = /filename="([^"]+)"/.exec(cd)?.[1] ?? "cadangan-pandian.psabak";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Cadangan terunduh. Simpan berkas dan kata sandinya di tempat terpisah.");
      form.reset();
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      setError("Unduhan terputus. Cadangan tidak lengkap dan tidak boleh dipakai. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-5 p-5 sm:p-6">
      <h2 className="text-base font-semibold">Buat cadangan baru</h2>
      <p className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
        Cadangan memuat data pribadi anak (nama, NIS, NISN, kehadiran, alasan izin). Perlakukan sebagai dokumen rahasia sekolah: jangan dikirim lewat grup chat dan jangan disimpan di perangkat bersama.
      </p>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Kata sandi cadangan (minimal 12 karakter)" htmlFor="passphrase" required>
          <PasswordInput id="passphrase" name="passphrase" autoComplete="new-password" minLength={12} required />
        </Field>
        <Field label="Ulangi kata sandi cadangan" htmlFor="passphrase2" required>
          <PasswordInput id="passphrase2" name="passphrase2" autoComplete="new-password" minLength={12} required />
        </Field>
      </div>
      <p className="text-xs text-ink-muted">Ini bukan kata sandi akun Anda. Catat di tempat aman. Jika hilang, cadangan tidak dapat dibuka.</p>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="ack" value="ya" required className="mt-1 h-5 w-5" />
        <span>Saya memahami bahwa berkas ini berisi data pribadi siswa dan bertanggung jawab menyimpannya dengan aman.</span>
      </label>
      {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
      <Button type="submit" loading={busy}><Download className="h-4 w-4" aria-hidden />{busy ? "Menyusun cadangan..." : "Buat dan unduh cadangan"}</Button>
      {busy && <p className="text-xs text-ink-muted" role="status">Mohon tunggu dan jangan tutup halaman ini. Proses bisa memakan waktu sampai beberapa menit.</p>}
    </form>
  );
}