"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input } from "@/components/ui/field";
import { updateYearAction } from "@/app/(app)/settings/actions";
import type { ActionState } from "@/lib/validation/common";

const initial: ActionState = { ok: false };

/** Ubah nama dan tanggal tahun ajaran. Data kelas, siswa, dan absensi tidak berubah. */
export function EditYearButton({ id, name, startDate, endDate }: { id: string; name: string; startDate: string; endDate: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, action, pending] = useActionState(updateYearAction, initial);
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
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}><Pencil className="h-4 w-4" aria-hidden />Ubah</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Ubah tahun ajaran ${name}`} description="Hanya nama dan tanggal yang berubah. Kelas, siswa, dan absensi tidak terpengaruh.">
        <form action={action} className="space-y-4" noValidate>
          <input type="hidden" name="id" value={id} />
          {state.message && !state.ok && <div role="alert" className="rounded-lg border border-danger/20 bg-danger/10 px-3.5 py-3 text-sm text-danger">{state.message}</div>}
          <Field label="Nama" htmlFor={`yn-${id}`} error={e.name} required hint="Contoh: 2026/2027"><Input id={`yn-${id}`} name="name" defaultValue={name} autoComplete="off" /></Field>
          <Field label="Mulai" htmlFor={`ys-${id}`} error={e.start_date} required><Input id={`ys-${id}`} name="start_date" type="date" defaultValue={startDate} /></Field>
          <Field label="Selesai" htmlFor={`ye-${id}`} error={e.end_date} required><Input id={`ye-${id}`} name="end_date" type="date" defaultValue={endDate} /></Field>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button type="submit" loading={pending}>Simpan</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}