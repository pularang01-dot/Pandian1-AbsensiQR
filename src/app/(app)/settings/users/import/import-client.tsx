"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_STAFF_ROWS, type StaffImportResult } from "@/lib/validation/staff-import";
import { importStaffAction } from "./actions";

type Row = { full_name: string; email: string; phone: string; role: string; class_name: string };

const ALIASES: Record<keyof Row, string[]> = {
  full_name: ["nama", "nama lengkap", "full_name", "name"],
  email: ["email", "e-mail"],
  phone: ["telepon", "telp", "hp", "phone", "no hp"],
  role: ["peran", "role", "jabatan"],
  class_name: ["kelas", "wali kelas", "class", "class_name"],
};
const MAX_BYTES = 1024 * 1024;

function normalize(raw: Record<string, unknown>): Row {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) lower[k.trim().toLowerCase()] = String(v ?? "").trim();
  const pick = (f: keyof Row) => ALIASES[f].map((a) => lower[a]).find((v) => v !== undefined) ?? "";
  return { full_name: pick("full_name"), email: pick("email"), phone: pick("phone"), role: pick("role"), class_name: pick("class_name") };
}

export function StaffImportClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<StaffImportResult | null>(null);
  const [mode, setMode] = useState<"invite" | "google">("invite");
  const input = useRef<HTMLInputElement>(null);

  async function onFile(file: File | undefined) {
    setResult(null); setParseError(""); setRows([]);
    if (!file) return;
    if (file.size > MAX_BYTES) return setParseError("Ukuran berkas maksimal 1 MB.");
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) return setParseError("Gunakan berkas .xlsx, .xls, atau .csv.");
    setFileName(file.name);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) return setParseError("Berkas tidak memiliki lembar data.");
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
      const parsed = json.map(normalize).filter((r) => r.email || r.full_name);
      if (parsed.length === 0) return setParseError("Tidak ada baris data. Baris pertama harus berisi judul kolom: Nama, Email, Telepon, Peran, Kelas.");
      if (parsed.length > MAX_STAFF_ROWS) return setParseError(`Maksimal ${MAX_STAFF_ROWS} baris per impor. Pecah berkas menjadi beberapa bagian.`);
      setRows(parsed);
    } catch {
      setParseError("Berkas tidak dapat dibaca. Pastikan formatnya benar dan tidak dilindungi kata sandi.");
    }
  }

  async function submit() {
    setBusy(true); setResult(null);
    try {
      const r = await importStaffAction(rows, mode);
      setResult(r);
      if (r.ok) {
        toast.success(`${r.created ?? 0} akun dibuat.`);
        setRows([]); setFileName("");
        if (input.current) input.current.value = "";
      } else toast.error(r.message ?? "Impor gagal.");
    } catch {
      toast.error("Koneksi terputus. Sebagian akun mungkin sudah dibuat; periksa daftar Pengguna sebelum mengulang.");
    } finally { setBusy(false); }
  }

  function template() {
    const csv = "﻿Nama,Email,Telepon,Peran,Kelas\r\nContoh Guru Kelas,contoh.guru@example.com,,Guru,1A\r\nContoh Operator,contoh.operator@example.com,,Operator,\r\n";
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = "templat-impor-staf.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <section className="card space-y-5 p-5 sm:p-6">
        <div className="space-y-3">
          <div>
            <label htmlFor="mode" className="field-label">Cara masuk akun yang dibuat</label>
            <select id="mode" value={mode} onChange={(e) => setMode(e.target.value as "invite" | "google")} className="h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm sm:w-80">
              <option value="invite">Email dan kata sandi (undangan email)</option>
              <option value="google">Akun Google (tanpa email undangan)</option>
            </select>
          </div>
          <Button variant="outline" onClick={template}><Download className="h-4 w-4" aria-hidden />Unduh templat CSV</Button>
        </div>
        <div>
          <label htmlFor="file" className="field-label">Berkas Excel atau CSV</label>
          <input ref={input} id="file" type="file" accept=".xlsx,.xls,.csv" onChange={(e) => onFile(e.target.files?.[0])}
            className="block w-full text-sm file:mr-3 file:h-11 file:rounded-lg file:border-0 file:bg-brand-light file:px-4 file:text-sm file:font-medium file:text-brand" />
          <p className="mt-1 text-xs text-ink-muted">Kolom wajib: Nama, Email, Peran (Guru, Operator, Kepala Sekolah, Admin). Kelas opsional dan hanya untuk Guru: guru menjadi wali kelas tersebut bila kelasnya belum punya wali. Orang tua dibuat lewat form Pengguna.</p>
          {parseError && <p role="alert" className="mt-2 text-sm font-medium text-danger">{parseError}</p>}
        </div>
      </section>

      {rows.length > 0 && (
        <section className="card">
          <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-5 w-5 text-brand" aria-hidden />
              <div><p className="text-sm font-semibold">{fileName}</p><p className="tabular text-xs text-ink-muted">{rows.length} baris. {mode === "invite" ? "Undangan email dikirim ke setiap alamat." : "Tidak ada email dikirim; pengguna masuk dengan Google."} Periksa pratinjau sebelum melanjutkan.</p></div>
            </div>
            <Button onClick={submit} loading={busy}>Buat {rows.length} akun</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b border-line bg-canvas/60 text-xs uppercase tracking-wide text-ink-muted">
                {["Nama", "Email", "Peran", "Kelas"].map((h) => <th key={h} scope="col" className="px-4 py-2.5 font-semibold">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-line">
                {rows.map((r, i) => <tr key={i}><td className="px-4 py-2.5">{r.full_name}</td><td className="px-4 py-2.5">{r.email}</td><td className="px-4 py-2.5">{r.role}</td><td className="px-4 py-2.5">{r.class_name || "-"}</td></tr>)}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {result && !result.ok && <p role="alert" className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{result.message}</p>}
      {result?.ok && result.results && (
        <section className="card p-5" role="status">
          <p className="text-sm font-semibold">{result.created} akun dibuat dari {result.results.length} baris.</p>
          <ul className="mt-3 max-h-80 divide-y divide-line overflow-y-auto rounded-lg border border-line text-sm">
            {result.results.map((r) => (
              <li key={r.line} className="flex flex-col gap-0.5 px-4 py-2 sm:flex-row sm:justify-between">
                <span className="tabular">Baris {r.line} | {r.email || "tanpa email"} | <strong>{r.status === "dibuat" ? "Dibuat" : r.status === "dilewati" ? "Dilewati" : "Gagal"}</strong></span>
                <span className="text-ink-muted">{r.message}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-muted">Perbaiki baris yang gagal di berkas, lalu unggah ulang hanya baris tersebut.</p>
        </section>
      )}
    </div>
  );
}