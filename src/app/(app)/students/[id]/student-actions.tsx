"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, RefreshCw, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/modal";
import { Field, Select } from "@/components/ui/field";
import { assignClassAction, linkParentAction, regenerateQrAction, setStudentStatusAction, unlinkParentAction } from "../actions";
import type { ActionState } from "@/lib/validation/common";

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionState>, after?: () => void) =>
    start(async () => {
      try {
        const r = await fn();
        if (r.ok) {
          toast.success(r.message ?? "Berhasil disimpan.");
          after?.();
          router.refresh();
        } else {
          toast.error(r.message ?? "Tindakan gagal. Data belum tersimpan.");
        }
      } catch {
        toast.error("Tidak dapat terhubung ke server. Data belum tersimpan.");
      }
    });
  return { pending, run };
}

export function RegenerateQrButton({ studentId }: { studentId: string }) {
  const [open, setOpen] = useState(false);
  const { pending, run } = useRun();
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}><RefreshCw className="h-4 w-4" aria-hidden />Terbitkan QR baru</Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        loading={pending}
        tone="danger"
        title="Terbitkan QR baru?"
        description="QR lama langsung dinonaktifkan dan kartu lama tidak dapat dipakai lagi. Cetak ulang kartu setelahnya."
        confirmLabel="Terbitkan QR baru"
        onConfirm={() => run(() => regenerateQrAction(studentId), () => setOpen(false))}
      />
    </>
  );
}

export function StatusButton({ studentId, status }: { studentId: string; status: string }) {
  const [open, setOpen] = useState(false);
  const { pending, run } = useRun();
  const deactivate = status === "active";
  return (
    <>
      <Button variant={deactivate ? "outline" : "primary"} size="sm" onClick={() => setOpen(true)}>
        <Ban className="h-4 w-4" aria-hidden />{deactivate ? "Nonaktifkan siswa" : "Aktifkan kembali"}
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        loading={pending}
        tone={deactivate ? "danger" : "primary"}
        title={deactivate ? "Nonaktifkan siswa ini?" : "Aktifkan kembali siswa ini?"}
        description={deactivate
          ? "Siswa tidak akan muncul pada absensi harian dan QR-nya tidak dapat dipakai. Seluruh riwayat tetap tersimpan. Untuk siswa pindah atau lulus, gunakan menu Ubah."
          : "Siswa akan kembali muncul pada absensi harian."}
        confirmLabel={deactivate ? "Nonaktifkan" : "Aktifkan"}
        onConfirm={() => run(() => setStudentStatusAction(studentId, deactivate ? "inactive" : "active"), () => setOpen(false))}
      />
    </>
  );
}

export function AssignClassForm({ studentId, classes, currentClassId }: { studentId: string; classes: { id: string; name: string }[]; currentClassId: string | null }) {
  const [classId, setClassId] = useState(currentClassId ?? "");
  const { pending, run } = useRun();
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label htmlFor="assign-class" className="field-label">Pindahkan / tempatkan ke kelas</label>
        <Select id="assign-class" value={classId} onChange={(e) => setClassId(e.target.value)}>
          <option value="">Pilih kelas</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </div>
      <Button variant="secondary" disabled={!classId || classId === currentClassId} loading={pending} onClick={() => run(() => assignClassAction(studentId, classId))}>
        Simpan kelas
      </Button>
    </div>
  );
}

const initial: ActionState = { ok: false };

export function LinkParentForm({ studentId, parents }: { studentId: string; parents: { id: string; label: string }[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(async (p: ActionState, fd: FormData) => {
    const r = await linkParentAction(p, fd);
    if (r.ok) { toast.success(r.message ?? "Berhasil."); router.refresh(); }
    return r;
  }, initial);
  const e = state.fieldErrors ?? {};

  if (parents.length === 0) {
    return <p className="text-sm text-ink-muted">Belum ada akun orang tua. Buat akun orang tua di Pengaturan &gt; Pengguna, lalu hubungkan di sini.</p>;
  }
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end">
      <input type="hidden" name="student_id" value={studentId} />
      <Field label="Orang tua / wali" htmlFor="parent_id" error={e.parent_id}>
        <Select id="parent_id" name="parent_id" defaultValue="">
          <option value="" disabled>Pilih akun</option>
          {parents.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </Select>
      </Field>
      <Field label="Hubungan" htmlFor="relationship" error={e.relationship}>
        <Select id="relationship" name="relationship" defaultValue="ibu">
          <option value="ayah">Ayah</option>
          <option value="ibu">Ibu</option>
          <option value="wali">Wali</option>
        </Select>
      </Field>
      <Button type="submit" variant="secondary" loading={pending}>Hubungkan</Button>
      {state.message && !state.ok && <p role="alert" className="text-xs text-danger sm:col-span-3">{state.message}</p>}
    </form>
  );
}

export function UnlinkButton({ linkId, studentId, name }: { linkId: string; studentId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const { pending, run } = useRun();
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} aria-label={`Putuskan hubungan ${name}`}><Unlink className="h-4 w-4" aria-hidden />Putuskan</Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        loading={pending}
        tone="danger"
        title="Putuskan hubungan?"
        description={`${name} tidak akan lagi dapat melihat data siswa ini. Pengajuan yang sudah ada tetap tersimpan.`}
        confirmLabel="Putuskan"
        onConfirm={() => run(() => unlinkParentAction(linkId, studentId), () => setOpen(false))}
      />
    </>
  );
}
