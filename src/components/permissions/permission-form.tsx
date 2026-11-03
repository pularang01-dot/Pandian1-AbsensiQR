"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import type { ActionState } from "@/lib/validation/common";

const initial: ActionState = { ok: false };

export function PermissionForm({
  action, students, cancelHref, today, manual = false, docDays,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  students: { id: string; label: string }[];
  cancelHref: string;
  today: string;
  manual?: boolean;
  docDays: number;
}) {
  const [state, run, pending] = useActionState(action, initial);
  const [category, setCategory] = useState("sick");
  const [start, setStart] = useState(today);
  const e = state.fieldErrors ?? {};

  return (
    <form action={run} className="card space-y-5 p-5 sm:p-6" noValidate encType="multipart/form-data">
      {manual && <p className="rounded-lg bg-info/10 px-3.5 py-3 text-sm text-info">Pencatatan manual atas nama orang tua yang tidak dapat memakai portal. Pengajuan tetap melalui peninjauan dan persetujuan.</p>}
      {state.message && <div role="alert" className="rounded-lg border border-danger/20 bg-danger/10 px-3.5 py-3 text-sm text-danger">{state.message}</div>}

      <Field label="Siswa" htmlFor="student_id" error={e.student_id} required>
        <Select id="student_id" name="student_id" defaultValue={students.length === 1 ? students[0].id : ""}>
          {students.length !== 1 && <option value="" disabled>Pilih siswa</option>}
          {students.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </Select>
      </Field>

      <Field label="Kategori" htmlFor="category" error={e.category} required>
        <Select id="category" name="category" value={category} onChange={(ev) => setCategory(ev.target.value)}>
          <option value="sick">Sakit</option>
          <option value="permission">Izin biasa</option>
        </Select>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Tanggal mulai" htmlFor="start_date" error={e.start_date} required>
          <Input id="start_date" name="start_date" type="date" value={start} onChange={(ev) => setStart(ev.target.value)} />
        </Field>
        <Field label="Tanggal selesai" htmlFor="end_date" error={e.end_date} required>
          <Input id="end_date" name="end_date" type="date" defaultValue={today} min={start} />
        </Field>
      </div>

      <Field label="Alasan singkat" htmlFor="reason" error={e.reason} required hint={category === "sick" ? "Cukup tulis keluhan umum, misalnya demam. Tidak perlu diagnosis medis." : undefined}>
        <Textarea id="reason" name="reason" maxLength={500} />
      </Field>

      <Field label="Dokumen pendukung (opsional)" htmlFor="document" error={e.document} hint={`PDF, JPG, atau PNG, maksimal 5 MB. ${category === "sick" ? `Wajib bila sakit lebih dari ${docDays} hari.` : ""}`}>
        <input id="document" name="document" type="file" accept="application/pdf,image/jpeg,image/png" className="block w-full text-sm file:mr-3 file:h-11 file:rounded-lg file:border-0 file:bg-brand-light file:px-4 file:text-sm file:font-medium file:text-brand" />
      </Field>

      <p className="rounded-lg bg-canvas px-3.5 py-3 text-xs text-ink-muted">
        Pengajuan tidak otomatis disetujui. Sekolah akan meninjau dan Anda akan diberi tahu. Pengajuan yang dikirim setelah tanggal ketidakhadiran ditandai terlambat dan ditinjau lebih lanjut.
      </p>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link href={cancelHref} className="inline-flex h-11 items-center justify-center rounded-lg border border-line px-4 text-sm font-medium hover:bg-canvas">Batal</Link>
        <Button type="submit" loading={pending}>{pending ? "Mengirim" : manual ? "Catat pengajuan" : "Kirim pengajuan"}</Button>
      </div>
    </form>
  );
}
