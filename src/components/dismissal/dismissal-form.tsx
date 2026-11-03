"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import type { ActionState } from "@/lib/validation/common";

const initial: ActionState = { ok: false };

export function DismissalForm({
  action, students, cancelHref, onBehalf = false,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  students: { id: string; label: string }[];
  cancelHref: string;
  onBehalf?: boolean;
}) {
  const [state, run, pending] = useActionState(action, initial);
  const e = state.fieldErrors ?? {};
  return (
    <form action={run} className="card space-y-5 p-5 sm:p-6" noValidate>
      {onBehalf && <p className="rounded-lg bg-info/10 px-3.5 py-3 text-sm text-info">Pencatatan atas nama pemohon yang datang atau menelepon. Identitas pemohon tetap wajib diverifikasi oleh kepala sekolah atau administrator sebelum persetujuan.</p>}
      {state.message && <div role="alert" className="rounded-lg border border-danger/20 bg-danger/10 px-3.5 py-3 text-sm text-danger">{state.message}</div>}

      <Field label="Siswa" htmlFor="student_id" error={e.student_id} required>
        <Select id="student_id" name="student_id" defaultValue={students.length === 1 ? students[0].id : ""}>
          {students.length !== 1 && <option value="" disabled>Pilih siswa</option>}
          {students.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </Select>
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Hubungan pemohon dengan siswa" htmlFor="requester_relation" error={e.requester_relation} required hint="Contoh: ayah, ibu, wali.">
          <Input id="requester_relation" name="requester_relation" maxLength={50} />
        </Field>
        <Field label="Waktu penjemputan (WIB)" htmlFor="requested_time" error={e.requested_time} required>
          <Input id="requested_time" name="requested_time" type="datetime-local" />
        </Field>
      </div>
      <Field label="Alasan" htmlFor="reason" error={e.reason} required hint="Tulis alasan umum. Tidak perlu diagnosis medis.">
        <Textarea id="reason" name="reason" maxLength={500} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nama penjemput yang diizinkan" htmlFor="authorized_pickup_name" error={e.authorized_pickup_name} required>
          <Input id="authorized_pickup_name" name="authorized_pickup_name" maxLength={100} />
        </Field>
        <Field label="Hubungan penjemput dengan siswa" htmlFor="authorized_pickup_relation" error={e.authorized_pickup_relation} required>
          <Input id="authorized_pickup_relation" name="authorized_pickup_relation" maxLength={50} />
        </Field>
      </div>
      <p className="rounded-lg bg-canvas px-3.5 py-3 text-xs text-ink-muted">Permintaan tidak otomatis disetujui. Siswa baru diserahkan setelah sekolah menyetujui dan petugas memverifikasi identitas penjemput secara langsung. Kode QR tidak dapat dipakai untuk menjemput siswa.</p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link href={cancelHref} className="inline-flex h-11 items-center justify-center rounded-lg border border-line px-4 text-sm font-medium hover:bg-canvas">Batal</Link>
        <Button type="submit" loading={pending}>{pending ? "Mengirim" : "Kirim permintaan"}</Button>
      </div>
    </form>
  );
}
