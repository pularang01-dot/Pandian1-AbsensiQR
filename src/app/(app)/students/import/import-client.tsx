"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { importStudentsAction, type ImportResult } from "../actions";

type Row = { nis: string; nisn: string; full_name: string; gender: string; class_name: string };

const HEADER_ALIASES: Record<keyof Row, string[]> = {
  nis: ["nis"],
  nisn: ["nisn"],
  full_name: ["nama", "nama lengkap", "full_name", "full name", "name"],
  gender: ["jk", "l/p", "jenis kelamin", "gender"],
  class_name: ["kelas", "class", "class_name"],
};
const MAX_BYTES = 2 * 1024 * 1024;

function normalize(raw: Record<string, unknown>): Row {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) lower[k.trim().toLowerCase()] = String(v ?? "").trim();
  const pick = (f: keyof Row) => HEADER_ALIASES[f].map((a) => lower[a]).find((v) => v !== undefined) ?? "";
  const g = pick("gender").toUpperCase();
  const gender = g.startsWith("L") ? "L" : g.startsWith("P") ? "P" : g.slice(0, 1);
  return { nis: pick("nis"), nisn: pick("nisn"), full_name: pick("full_name"), gender, class_name: pick("class_name") };
}

export function ImportClient({ years, defaultYearId }: { years: { id: string; name: string }[]; defaultYearId: string }) {
  const [yearId, setYearId] = useState(defaultYearId);
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function onFile(file: File | undefined) {
    setResult(null);
    setParseError("");
    setRows([]);
    if (!file) return;
    if (file.size > MAX_BYTES) return setParseError("Ukuran berkas maksimal 2 MB.");
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) return setParseError("Gunakan berkas .xlsx, .xls, atau .csv.");
    setFileName(file.name);
    try {
      // Pustaka dimuat saat dibutuhkan agar halaman lain tidak ikut berat.
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) return setParseError("Berkas tidak memiliki lembar data.");
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
      const parsed = json.map(normalize).filter((r) => r.nis || r.full_name);
      if (parsed.length === 0) return setParseError("Tidak ada baris data. Pastikan baris pertama berisi judul kolom: NIS, NISN, Nama, JK, Kelas.");
      if (parsed.length > 1000) return setParseError("Maksimal 1000 baris per impor. Pecah berkas menjadi beberapa bagian.");
      setRows(parsed);
    } catch {
      setParseError("Berkas tidak dapat dibaca. Pastikan formatnya benar dan tidak dilindungi kata sandi.");
    }
  }

  async function submit() {
    setBusy(true);
    setResult(null);
    try {
      const r = await importStudentsAction({ rows, year_id: yearId });
      setResult(r);
      if (r.ok) {
        toast.success(`${r.inserted ?? 0} siswa berhasil diimpor.`);
        setRows([]);
        setFileName("");
        if (input.current) input.current.value = "";
      } else toast.error(r.message ?? "Impor gagal. Tidak ada data yang tersimpan.");
    } catch {
      toast.error("Tidak dapat terhubung ke server. Tidak ada data yang tersimpan.");
    } finally {
      setBusy(false);
    }
  }

  function template() {
    const csv = "﻿NIS,NISN,Nama,JK,Kelas\r\n1001,0123456789,Contoh Nama Siswa,L,1A\r\n";
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "templat-impor-siswa.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <section className="card space-y-5 p-5 sm:p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Tahun ajaran untuk penempatan kelas" htmlFor="year">
            <Select id="year" value={yearId} onChange={(e) => setYearId(e.target.value)}>
              {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </Select>
          </Field>
          <div>
            <span className="field-label">Templat</span>
            <Button variant="outline" onClick={template}><Download className="h-4 w-4" aria-hidden />Unduh templat CSV</Button>
          </div>
        </div>

        <div>
          <label htmlFor="file" className="field-label">Berkas Excel atau CSV</label>
          <input
            ref={input}
            id="file"
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => onFile(e.target.files?.[0])}
            className="block w-full text-sm file:mr-3 file:h-11 file:rounded-lg file:border-0 file:bg-brand-light file:px-4 file:text-sm file:font-medium file:text-brand"
          />
          <p className="mt-1 text-xs text-ink-muted">Kolom: NIS dan Nama wajib. NISN, JK (L/P), dan Kelas (nama kelas sesuai tahun ajaran) opsional. Kelas yang tidak ditemukan membuat baris dilewati.</p>
          {parseError && <p role="alert" className="mt-2 text-sm font-medium text-danger">{parseError}</p>}
        </div>
      </section>

      {rows.length > 0 && (
        <section className="card">
          <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-5 w-5 text-brand" aria-hidden />
              <div>
                <p className="text-sm font-semibold">{fileName}</p>
                <p className="tabular text-xs text-ink-muted">{rows.length} baris siap diimpor. Pratinjau 8 baris pertama.</p>
              </div>
            </div>
            <Button onClick={submit} loading={busy}>Impor {rows.length} siswa</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b border-line bg-canvas/60 text-xs uppercase tracking-wide text-ink-muted">
                {["NIS", "NISN", "Nama", "JK", "Kelas"].map((h) => <th key={h} scope="col" className="px-4 py-2.5 font-semibold">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-line">
                {rows.slice(0, 8).map((r, i) => (
                  <tr key={i}><td className="tabular px-4 py-2.5">{r.nis}</td><td className="tabular px-4 py-2.5">{r.nisn || "-"}</td><td className="px-4 py-2.5">{r.full_name}</td><td className="px-4 py-2.5">{r.gender || "-"}</td><td className="px-4 py-2.5">{r.class_name || "-"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {result && !result.ok && (
        <p role="alert" className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{result.message}</p>
      )}
      {result?.ok && (
        <section className="card p-5" role="status">
          <p className="text-sm"><span className="font-semibold text-success">{result.inserted} siswa berhasil diimpor.</span> {result.skipped && result.skipped.length > 0 ? `${result.skipped.length} baris dilewati:` : "Tidak ada baris yang dilewati."}</p>
          {result.skipped && result.skipped.length > 0 && (
            <ul className="mt-3 max-h-64 divide-y divide-line overflow-y-auto rounded-lg border border-line text-sm">
              {result.skipped.map((s, i) => (
                <li key={i} className="flex justify-between gap-3 px-4 py-2"><span className="tabular">Baris {s.row}{s.nis ? ` | NIS ${s.nis}` : ""}</span><span className="text-ink-muted">{s.reason}</span></li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
