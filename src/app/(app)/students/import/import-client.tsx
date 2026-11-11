"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { assignExistingStudentsAction, importStudentsAction, type AssignResult, type ImportResult } from "../actions";

type Row = { nis: string; nisn: string; full_name: string; gender: string; class_name: string };

const HEADER_ALIASES: Record<keyof Row, string[]> = {
  nis: ["nis", "no induk", "nomor induk", "nomor induk siswa"],
  nisn: ["nisn", "nomor induk siswa nasional"],
  full_name: ["nama", "nama siswa", "nama lengkap", "nama peserta didik", "peserta didik", "nama murid", "siswa", "full_name", "full name", "name"],
  gender: ["jk", "l/p", "lp", "jenis kelamin", "kelamin", "gender"],
  class_name: ["kelas", "rombel", "class", "class_name"],
};
const MAX_BYTES = 2 * 1024 * 1024;

const key = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/[._]+/g, " ").replace(/\s+/g, " ");

/** Cari baris judul (dalam 15 baris pertama) yang memuat kolom nama siswa. */
function findHeaderRow(matrix: unknown[][]): number {
  const names = new Set([...HEADER_ALIASES.full_name, ...HEADER_ALIASES.nis]);
  for (let i = 0; i < Math.min(matrix.length, 15); i++) if (matrix[i].some((c) => names.has(key(c)))) return i;
  return -1;
}

function toRow(header: string[], cells: unknown[], defaultClass: string): Row {
  const lower: Record<string, string> = {};
  header.forEach((h, i) => { if (h && lower[h] === undefined) lower[h] = String(cells[i] ?? "").trim(); });
  const pick = (f: keyof Row) => HEADER_ALIASES[f].map((a) => lower[a]).find((v) => v !== undefined && v !== "") ?? "";
  const g = pick("gender").toUpperCase();
  const gender = g.startsWith("L") ? "L" : g.startsWith("P") ? "P" : g.slice(0, 1);
  let nisn = pick("nisn").replace(/\s+/g, "");
  // NISN selalu 10 digit; Excel membuang angka nol di depan, jadi dilengkapi kembali.
  if (/^\d{7,9}$/.test(nisn)) nisn = nisn.padStart(10, "0");
  return { nis: pick("nis"), nisn, full_name: pick("full_name"), gender, class_name: pick("class_name") || defaultClass };
}

export function ImportClient({ years, classes, defaultYearId }: { years: { id: string; name: string }[]; classes: { id: string; name: string; academic_year_id: string }[]; defaultYearId: string }) {
  const [yearId, setYearId] = useState(defaultYearId);
  const [defaultClass, setDefaultClass] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [mode, setMode] = useState<"add" | "assign">("add");
  const [move, setMove] = useState(false);
  const [assignResult, setAssignResult] = useState<AssignResult | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function onFile(file: File | undefined) {
    setResult(null);
    setAssignResult(null);
    setParseError("");
    setRows([]);
    if (!file) return;
    if (file.size > MAX_BYTES) return setParseError("Ukuran berkas maksimal 2 MB.");
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) return setParseError("Gunakan berkas .xlsx, .xls, atau .csv.");
    setFileName(file.name);
    try {
      // Pustaka dimuat saat dibutuhkan agar halaman lain tidak ikut berat.
      const XLSX = await import("xlsx");
      const isCsv = /\.csv$/i.test(file.name);
      // CSV dibaca sebagai teks apa adanya agar angka nol di depan NISN tidak hilang.
      const wb = isCsv
        ? XLSX.read(await file.text(), { type: "string", raw: true })
        : XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) return setParseError("Berkas tidak memiliki lembar data.");
      const all = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false, blankrows: false });
      const h = findHeaderRow(all);
      if (h < 0) return setParseError("Kolom NIS atau nama siswa tidak ditemukan. Pastikan ada judul kolom 'NIS' atau 'Nama Siswa' di baris pertama.");
      const header = all[h].map(key);
      const body = all.slice(h + 1);
      const parsed = body.map((c) => toRow(header, c, "")).filter((r) => r.nis || r.full_name);
      if (parsed.length === 0) return setParseError("Tidak ada baris data siswa di bawah judul kolom.");
      if (parsed.length > 1000) return setParseError("Maksimal 1000 baris per impor. Pecah berkas menjadi beberapa bagian.");
      setRows(parsed);
    } catch {
      setParseError("Berkas tidak dapat dibaca. Pastikan formatnya benar dan tidak dilindungi kata sandi.");
    }
  }

  // Kelas bawaan dipakai untuk baris yang kolom Kelasnya kosong atau tidak ada.
  const finalRows = rows.map((r) => ({ ...r, class_name: r.class_name || defaultClass }));
  const yearClasses = classes.filter((c) => c.academic_year_id === yearId);
  const missingNis = finalRows.filter((r) => !r.nis).length;

  async function submitAssign() {
    setBusy(true);
    setAssignResult(null);
    try {
      const r = await assignExistingStudentsAction({ rows: finalRows, year_id: yearId, move });
      setAssignResult(r);
      if (r.ok) {
        toast.success(`${(r.assigned ?? 0) + (r.moved ?? 0)} siswa ditempatkan ke kelas.`);
        setRows([]);
        setFileName("");
        if (input.current) input.current.value = "";
      } else toast.error(r.message ?? "Proses gagal. Tidak ada data yang berubah.");
    } catch {
      toast.error("Tidak dapat terhubung ke server. Tidak ada data yang berubah.");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setResult(null);
    try {
      const r = await importStudentsAction({ rows: finalRows, year_id: yearId });
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
    const csv = mode === "assign"
      ? "﻿NIS,Nama,Kelas\r\n1001,Contoh Nama Siswa,VI-A\r\n"
      : "﻿NIS,NISN,Nama,JK,Kelas\r\n1001,0123456789,Contoh Nama Siswa,L,VI-A\r\n";
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = mode === "assign" ? "templat-penempatan-kelas.csv" : "templat-impor-siswa.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <section className="card space-y-5 p-5 sm:p-6">
        <fieldset>
          <legend className="field-label">Apa yang ingin dilakukan?</legend>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            <label className={`flex min-h-11 cursor-pointer gap-2.5 rounded-lg border p-3 text-sm ${mode === "add" ? "border-brand bg-brand-light" : "border-line"}`}>
              <input type="radio" name="mode" checked={mode === "add"} onChange={() => { setMode("add"); setRows([]); setFileName(""); setResult(null); setAssignResult(null); }} className="mt-0.5 accent-brand" />
              <span><span className="block font-medium">Tambah siswa baru</span><span className="text-ink-muted">Siswa belum ada di aplikasi. NIS yang sudah terdaftar dilewati.</span></span>
            </label>
            <label className={`flex min-h-11 cursor-pointer gap-2.5 rounded-lg border p-3 text-sm ${mode === "assign" ? "border-brand bg-brand-light" : "border-line"}`}>
              <input type="radio" name="mode" checked={mode === "assign"} onChange={() => { setMode("assign"); setRows([]); setFileName(""); setResult(null); setAssignResult(null); }} className="mt-0.5 accent-brand" />
              <span><span className="block font-medium">Tempatkan siswa yang sudah ada ke kelas</span><span className="text-ink-muted">Data siswa sudah lengkap, hanya kelasnya yang belum diisi. Tidak membuat siswa baru.</span></span>
            </label>
          </div>
        </fieldset>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Tahun ajaran untuk penempatan kelas" htmlFor="year">
            <Select id="year" value={yearId} onChange={(e) => setYearId(e.target.value)}>
              {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </Select>
          </Field>
          <Field label="Kelas untuk semua siswa di berkas (opsional)" htmlFor="defclass">
            <Select id="defclass" value={defaultClass} onChange={(e) => setDefaultClass(e.target.value)}>
              <option value="">Ikuti kolom Kelas di berkas</option>
              {yearClasses.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </Select>
          </Field>
          <div>
            <span className="field-label">Templat</span>
            <Button variant="outline" onClick={template}><Download className="h-4 w-4" aria-hidden />Unduh templat CSV</Button>
          </div>
        </div>

        {mode === "assign" && (
          <label className="flex min-h-11 items-start gap-2.5 text-sm">
            <input type="checkbox" checked={move} onChange={(e) => setMove(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-line accent-brand" />
            <span>Pindahkan juga siswa yang sudah punya kelas lain pada tahun ajaran ini. <span className="text-ink-muted">Bila tidak dicentang, siswa yang sudah punya kelas dilewati. Riwayat absensi lama tetap tersimpan.</span></span>
          </label>
        )}

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
          {mode === "assign" ? (
            <p className="mt-1 text-xs text-ink-muted">Kolom yang dibaca: Kelas, lalu NIS (disarankan) atau Nama Siswa. Bila hanya ada nama, siswa dicocokkan dengan nama yang persis sama; nama ganda dilewati dan dilaporkan. Hanya siswa berstatus aktif. Nama kelas harus sudah ada pada tahun ajaran terpilih. Kolom lain diabaikan.</p>
          ) : (
          <p className="mt-1 text-xs text-ink-muted">Kolom yang dibaca: NIS dan Nama (atau Nama Siswa) wajib. NISN, JK atau L/P, dan Kelas opsional. Kolom lain, termasuk kolom tanggal 1-31 pada daftar hadir, diabaikan dan tidak diimpor. Jika berkas tidak punya kolom Kelas, pilih kelas di atas. Nama kelas harus sudah ada pada tahun ajaran terpilih.</p>
          )}
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
                <p className="tabular text-xs text-ink-muted">{rows.length} baris siap {mode === "assign" ? "diproses" : "diimpor"}{defaultClass ? ` ke kelas ${defaultClass}` : ""}. Pratinjau 8 baris pertama.{mode === "add" && missingNis > 0 ? ` ${missingNis} baris tanpa NIS akan dilewati.` : ""}</p>
              </div>
            </div>
            <Button onClick={mode === "assign" ? submitAssign : submit} loading={busy}>{mode === "assign" ? `Tempatkan ${rows.length} siswa` : `Impor ${rows.length} siswa`}</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b border-line bg-canvas/60 text-xs uppercase tracking-wide text-ink-muted">
                {["NIS", "NISN", "Nama", "JK", "Kelas"].map((h) => <th key={h} scope="col" className="px-4 py-2.5 font-semibold">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-line">
                {finalRows.slice(0, 8).map((r, i) => (
                  <tr key={i}><td className="tabular px-4 py-2.5">{r.nis}</td><td className="tabular px-4 py-2.5">{r.nisn || "-"}</td><td className="px-4 py-2.5">{r.full_name}</td><td className="px-4 py-2.5">{r.gender || "-"}</td><td className="px-4 py-2.5">{r.class_name || "-"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {assignResult && !assignResult.ok && (
        <p role="alert" className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{assignResult.message}</p>
      )}
      {assignResult?.ok && (
        <section className="card p-5" role="status">
          <p className="text-sm"><span className="font-semibold text-success">{assignResult.assigned} siswa ditempatkan ke kelas{(assignResult.moved ?? 0) > 0 ? `, ${assignResult.moved} dipindahkan` : ""}.</span> {assignResult.skipped && assignResult.skipped.length > 0 ? `${assignResult.skipped.length} baris dilewati:` : "Tidak ada baris yang dilewati."}</p>
          {assignResult.skipped && assignResult.skipped.length > 0 && (
            <ul className="mt-3 max-h-64 divide-y divide-line overflow-y-auto rounded-lg border border-line text-sm">
              {assignResult.skipped.map((s, i) => (
                <li key={i} className="flex justify-between gap-3 px-4 py-2"><span className="tabular">Baris {s.row}{s.nis ? ` | NIS ${s.nis}` : ""}</span><span className="text-ink-muted">{s.reason}</span></li>
              ))}
            </ul>
          )}
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