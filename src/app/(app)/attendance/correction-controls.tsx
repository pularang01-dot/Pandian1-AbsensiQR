"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PencilLine, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Field, Select, Textarea } from "@/components/ui/field";
import { ATTENDANCE_STATUS } from "@/components/ui/status-badge";
import { correctAttendanceAction, reconcileAction } from "./actions";

export function CorrectButton({ recordId, studentName, currentStatus }: { recordId: string; studentName: string; currentStatus: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(currentStatus);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      setError("");
      try {
        const r = await correctAttendanceAction({ record_id: recordId, new_status: status, reason });
        if (r.ok) { toast.success(r.message); setOpen(false); setReason(""); router.refresh(); }
        else setError(r.message ?? "Koreksi gagal. Data belum diubah.");
      } catch {
        setError("Tidak dapat terhubung ke server. Data belum diubah.");
      }
    });

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => { setStatus(currentStatus); setOpen(true); }} aria-label={`Koreksi absensi ${studentName}`}><PencilLine className="h-4 w-4" aria-hidden />Koreksi</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Koreksi absensi"
        description={`${studentName}. Status lama, status baru, alasan, dan nama Anda akan tersimpan permanen dalam riwayat perubahan.`}
        footer={<><Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Batal</Button><Button onClick={submit} loading={pending} disabled={status === currentStatus || reason.trim().length < 5}>Simpan koreksi</Button></>}
      >
        <div className="space-y-4">
          {error && <p role="alert" className="rounded-lg border border-danger/20 bg-danger/10 px-3.5 py-3 text-sm text-danger">{error}</p>}
          <Field label="Status baru" htmlFor="c-status">
            <Select id="c-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              {Object.entries(ATTENDANCE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          </Field>
          <Field label="Alasan koreksi" htmlFor="c-reason" required hint="Minimal 5 karakter.">
            <Textarea id="c-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
          </Field>
        </div>
      </Modal>
    </>
  );
}

export function ReconcileButton({ date, classId, className }: { date: string; classId?: string; className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const submit = () =>
    start(async () => {
      try {
        const r = await reconcileAction(date, classId);
        if (r.ok) { toast.success(r.message); setOpen(false); router.refresh(); }
        else toast.error(r.message ?? "Rekonsiliasi gagal.");
      } catch {
        toast.error("Tidak dapat terhubung ke server. Rekonsiliasi belum dilakukan.");
      }
    });
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}><ClipboardCheck className="h-4 w-4" aria-hidden />{classId ? `Rekonsiliasi kelas ${className ?? ""}` : "Rekonsiliasi hari ini"}</Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        loading={pending}
        tone="danger"
        title="Lakukan rekonsiliasi?"
        description={classId ? `Siswa aktif kelas ${className ?? ""} yang belum memiliki catatan pada tanggal ini akan ditandai Alpa. Kelas lain tidak terpengaruh. Pastikan izin dan sakit sudah diproses. Perubahan selanjutnya hanya lewat koreksi beralasan.` : "Semua siswa aktif yang belum memiliki catatan pada tanggal ini akan ditandai Alpa dan sesi absensi ditutup. Pastikan izin, sakit, dan kegiatan resmi sudah diproses. Perubahan selanjutnya hanya lewat koreksi beralasan."}
        confirmLabel="Ya, rekonsiliasi"
        onConfirm={submit}
      />
    </>
  );
}