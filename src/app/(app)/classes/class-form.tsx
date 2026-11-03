"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select } from "@/components/ui/field";
import { saveClassAction } from "./actions";
import type { ActionState } from "@/lib/validation/common";

export type ClassValues = { id?: string; name?: string; academic_year_id: string; grade_level?: number | null; homeroom_teacher_id?: string | null; is_active?: boolean };
const initial: ActionState = { ok: false };

export function ClassFormButton({
  values, years, teachers, variant = "create",
}: {
  values: ClassValues;
  years: { id: string; name: string }[];
  teachers: { id: string; name: string }[];
  variant?: "create" | "edit";
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, action, pending] = useActionState(saveClassAction, initial);
  const e = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.ok) {
      toast.success(state.message ?? "Tersimpan.");
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <>
      <Button variant={variant === "create" ? "primary" : "outline"} onClick={() => setOpen(true)}>
        {variant === "create" ? <><Plus className="h-4 w-4" aria-hidden />Tambah kelas</> : <><Pencil className="h-4 w-4" aria-hidden />Ubah kelas</>}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={variant === "create" ? "Tambah kelas" : "Ubah kelas"}>
        <form action={action} className="space-y-4" noValidate>
          {values.id && <input type="hidden" name="id" value={values.id} />}
          {state.message && !state.ok && <div role="alert" className="rounded-lg border border-danger/20 bg-danger/10 px-3.5 py-3 text-sm text-danger">{state.message}</div>}
          <Field label="Nama kelas" htmlFor="name" error={e.name} required hint="Contoh: 1A, 2B">
            <Input id="name" name="name" defaultValue={values.name} autoComplete="off" />
          </Field>
          <Field label="Tahun ajaran" htmlFor="academic_year_id" error={e.academic_year_id} required>
            <Select id="academic_year_id" name="academic_year_id" defaultValue={values.academic_year_id}>
              {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </Select>
          </Field>
          <Field label="Tingkat" htmlFor="grade_level" error={e.grade_level}>
            <Select id="grade_level" name="grade_level" defaultValue={values.grade_level ? String(values.grade_level) : ""}>
              <option value="">Tidak diisi</option>
              {[1, 2, 3, 4, 5, 6].map((g) => <option key={g} value={g}>Kelas {g}</option>)}
            </Select>
          </Field>
          <Field label="Wali kelas" htmlFor="homeroom_teacher_id" error={e.homeroom_teacher_id} hint="Wali kelas dapat melihat dan mencatat absensi siswa kelasnya.">
            <Select id="homeroom_teacher_id" name="homeroom_teacher_id" defaultValue={values.homeroom_teacher_id ?? ""}>
              <option value="">Belum ditentukan</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </Field>
          <label className="flex min-h-11 items-center gap-2.5 text-sm">
            <input type="checkbox" name="is_active" defaultChecked={values.is_active ?? true} className="h-4 w-4 rounded border-line accent-brand" />
            Kelas aktif
          </label>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button type="submit" loading={pending}>Simpan</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
