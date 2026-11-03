"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { saveStudentAction } from "./actions";
import { STUDENT_STATUS_LABEL } from "@/lib/validation/student";
import type { ActionState } from "@/lib/validation/common";

export type StudentFormValues = {
  id?: string; nis?: string; nisn?: string | null; full_name?: string; gender?: string | null; status?: string; class_id?: string | null;
};

const initial: ActionState = { ok: false };

export function StudentForm({ values, classes, cancelHref }: { values?: StudentFormValues; classes: { id: string; name: string }[]; cancelHref: string }) {
  const [state, action, pending] = useActionState(saveStudentAction, initial);
  const e = state.fieldErrors ?? {};

  return (
    <form action={action} className="card space-y-5 p-5 sm:p-6" noValidate>
      {values?.id && <input type="hidden" name="id" value={values.id} />}
      {state.message && (
        <div role="alert" className="rounded-lg border border-danger/20 bg-danger/10 px-3.5 py-3 text-sm text-danger">{state.message}</div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nama lengkap" htmlFor="full_name" error={e.full_name} required>
          <Input id="full_name" name="full_name" defaultValue={values?.full_name} autoComplete="off" />
        </Field>
        <Field label="NIS" htmlFor="nis" error={e.nis} required hint="Nomor Induk Siswa sekolah. Harus unik.">
          <Input id="nis" name="nis" defaultValue={values?.nis} autoComplete="off" inputMode="numeric" />
        </Field>
        <Field label="NISN" htmlFor="nisn" error={e.nisn} hint="Opsional. Hanya angka.">
          <Input id="nisn" name="nisn" defaultValue={values?.nisn ?? ""} autoComplete="off" inputMode="numeric" />
        </Field>
        <Field label="Jenis kelamin" htmlFor="gender" error={e.gender}>
          <Select id="gender" name="gender" defaultValue={values?.gender ?? ""}>
            <option value="">Tidak diisi</option>
            <option value="L">Laki-laki</option>
            <option value="P">Perempuan</option>
          </Select>
        </Field>
        <Field label="Kelas" htmlFor="class_id" error={e.class_id} hint="Memilih kelas akan menempatkan atau memindahkan siswa pada tahun ajaran kelas tersebut.">
          <Select id="class_id" name="class_id" defaultValue={values?.class_id ?? ""}>
            <option value="">Belum ditempatkan</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Status siswa" htmlFor="status" error={e.status} required>
          <Select id="status" name="status" defaultValue={values?.status ?? "active"}>
            {Object.entries(STUDENT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
      </div>

      <p className="rounded-lg bg-canvas px-3.5 py-3 text-xs text-ink-muted">
        Kolom data dibatasi pada informasi yang diperlukan untuk administrasi sekolah. Kontak orang tua dikelola melalui akun orang tua yang dihubungkan, bukan pada data siswa.
      </p>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link href={cancelHref} className="inline-flex h-11 items-center justify-center rounded-lg border border-line px-4 text-sm font-medium hover:bg-canvas">Batal</Link>
        <Button type="submit" loading={pending}>{values?.id ? "Simpan perubahan" : "Simpan siswa"}</Button>
      </div>
    </form>
  );
}
