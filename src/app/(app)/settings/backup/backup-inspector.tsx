"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileSearch, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { BackupError, TABLE_LABEL, buildSheets, openBackup, type BackupData } from "@/lib/backup/reader";

/** Memeriksa berkas .psabak di peramban. Berkas dan kata sandi TIDAK dikirim ke server mana pun. */
export function BackupInspector() {
  const fileRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<BackupData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function inspect() {
    setError("");
    setData(null);
    const file = fileRef.current?.files?.[0];
    const pass = passRef.current?.value ?? "";
    if (!file) return setError("Pilih berkas cadangan (.psabak) terlebih dahulu.");
    if (!pass) return setError("Isi kata sandi cadangan.");
    setBusy(true);
    try {
      setData(await openBackup(await file.arrayBuffer(), pass));
    } catch (e) {
      setError(e instanceof BackupError ? e.message : "Berkas tidak dapat dibaca. Pastikan browser Anda versi terbaru (Chrome atau Edge).");
    } finally {
      setBusy(false);
    }
  }

  async function exportExcel() {
    if (!data) return;
    setBusy(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      for (const sh of buildSheets(data)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sh.rows), sh.name);
      XLSX.writeFile(wb, `cadangan-terbaca-${data.meta.created_at.slice(0, 10)}.xlsx`);
      toast.success("Excel terunduh. Berkas ini TIDAK terenkripsi, simpan dan perlakukan sebagai dokumen rahasia.");
    } catch {
      toast.error("Excel gagal dibuat.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card space-y-5 p-5 sm:p-6">
      <div>
        <h2 className="text-base font-semibold">Periksa cadangan</h2>
        <p className="mt-1 text-sm text-ink-muted">Pilih berkas .psabak untuk memastikan cadangan utuh dan melihat isinya. Pemeriksaan dilakukan di komputer Anda; berkas tidak diunggah ke mana pun.</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="bk-file" className="field-label">Berkas cadangan (.psabak)</label>
          <input ref={fileRef} id="bk-file" type="file" accept=".psabak" className="block w-full text-sm file:mr-3 file:h-11 file:rounded-lg file:border-0 file:bg-brand-light file:px-4 file:text-sm file:font-medium file:text-brand" />
        </div>
        <Field label="Kata sandi cadangan" htmlFor="bk-pass">
          <PasswordInput id="bk-pass" ref={passRef} autoComplete="off" />
        </Field>
      </div>
      {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
      <Button variant="outline" onClick={inspect} loading={busy && !data}><FileSearch className="h-4 w-4" aria-hidden />Periksa cadangan</Button>

      {data && (
        <div className="space-y-4" role="status">
          <p className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm font-medium">
            Cadangan utuh dan dapat dibuka. Dibuat pada {new Date(data.meta.created_at).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })}.
          </p>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b border-line bg-canvas/60 text-xs uppercase tracking-wide text-ink-muted"><th scope="col" className="px-4 py-2.5 font-semibold">Isi</th><th scope="col" className="px-4 py-2.5 text-right font-semibold">Jumlah</th></tr></thead>
              <tbody className="divide-y divide-line">
                <tr><td className="px-4 py-2">Akun login</td><td className="tabular px-4 py-2 text-right">{data.auth.length}</td></tr>
                {data.meta.tables.map((t) => (
                  <tr key={t}><td className="px-4 py-2">{TABLE_LABEL[t] ?? t}</td><td className="tabular px-4 py-2 text-right">{data.tables[t]?.length ?? 0}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <Button onClick={exportExcel} loading={busy}><FileSpreadsheet className="h-4 w-4" aria-hidden />Unduh versi Excel (terbaca)</Button>
            <p className="mt-2 text-xs text-ink-muted">Berisi daftar siswa, kelas, rekap dan absensi harian, serta daftar izin (tanpa alasan izin, email, atau kartu QR). Berkas Excel ini tidak terenkripsi.</p>
          </div>
        </div>
      )}
    </section>
  );
}