"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Flag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Textarea } from "@/components/ui/field";
import { completeDispensationAction, confirmParticipationAction, reviewDispensationAction } from "../actions";

type Action = "approve" | "reject" | "cancel";
const COPY: Record<Action, { title: string; desc: string; confirm: string; required: boolean; danger?: boolean }> = {
  approve: { title: "Setujui dispensasi?", desc: "Persetujuan tidak mencatat kehadiran. Absensi Kegiatan Resmi Sekolah baru dibuat setelah guru pendamping mengonfirmasi siswa ikut serta.", confirm: "Setujui", required: false },
  reject: { title: "Tolak dispensasi?", desc: "Alasan penolakan akan terlihat oleh pengaju.", confirm: "Tolak", required: true, danger: true },
  cancel: { title: "Batalkan dispensasi?", desc: "Dispensasi dibatalkan. Catatan absensi yang sudah dibuat tidak diubah otomatis; tinjau secara manual bila perlu.", confirm: "Batalkan dispensasi", required: true, danger: true },
};

export function ApprovalPanel({ id, status, isApprover, canCancel }: { id: string; status: string; isApprover: boolean; canCancel: boolean }) {
  const router = useRouter();
  const [action, setAction] = useState<Action | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const canDecide = isApprover && status === "pending";
  const canCancelNow = canCancel && (status === "pending" || status === "approved");
  if (!canDecide && !canCancelNow) return <p className="text-sm text-ink-muted">Tidak ada keputusan yang tersedia untuk Anda pada status ini.</p>;

  const copy = action ? COPY[action] : null;
  const tooShort = !!copy?.required && note.trim().length < 3;
  const close = () => { setAction(null); setNote(""); setError(""); };
  const submit = () => action && start(async () => {
    setError("");
    try {
      const r = await reviewDispensationAction({ id, action, note: note.trim() || undefined });
      if (r.ok) { toast.success(r.message); close(); router.refresh(); } else setError(r.message ?? "Keputusan gagal disimpan.");
    } catch { setError("Tidak dapat terhubung ke server. Keputusan BELUM tersimpan."); }
  });

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {canDecide && <Button onClick={() => setAction("approve")}><Check className="h-4 w-4" aria-hidden />Setujui</Button>}
        {canDecide && <Button variant="danger" onClick={() => setAction("reject")}><X className="h-4 w-4" aria-hidden />Tolak</Button>}
        {canCancelNow && <Button variant="outline" onClick={() => setAction("cancel")}>Batalkan</Button>}
      </div>
      <Modal open={action !== null} onClose={close} title={copy?.title ?? ""} description={copy?.desc}
        footer={<><Button variant="outline" onClick={close} disabled={pending}>Kembali</Button><Button variant={copy?.danger ? "danger" : "primary"} onClick={submit} loading={pending} disabled={tooShort}>{copy?.confirm}</Button></>}>
        <div className="space-y-3">
          {error && <p role="alert" className="rounded-lg border border-danger/20 bg-danger/10 px-3.5 py-3 text-sm text-danger">{error}</p>}
          <Field label={copy?.required ? "Alasan (wajib)" : "Catatan (opsional)"} htmlFor="d-note"><Textarea id="d-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></Field>
        </div>
      </Modal>
    </>
  );
}

export function ParticipationButtons({ dispensationId, studentId, name, current }: { dispensationId: string; studentId: string; name: string; current: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const send = (participated: boolean) => start(async () => {
    setError("");
    try {
      const r = await confirmParticipationAction({ dispensation_id: dispensationId, student_id: studentId, participated });
      if (r.ok) { toast.success(r.message); router.refresh(); } else setError(r.message ?? "Gagal menyimpan.");
    } catch { setError("Tidak dapat terhubung ke server. Konfirmasi BELUM tersimpan."); }
  });
  return (
    <div>
      <div className="flex gap-2">
        <Button variant={current === "participated" ? "primary" : "outline"} onClick={() => send(true)} loading={pending} aria-label={`Konfirmasi ${name} ikut serta`}>Ikut serta</Button>
        <Button variant={current === "not_participated" ? "danger" : "outline"} onClick={() => send(false)} loading={pending} aria-label={`Tandai ${name} tidak ikut`}>Tidak ikut</Button>
      </div>
      {error && <p role="alert" className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

export function CompleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const submit = () => start(async () => {
    setError("");
    try {
      const r = await completeDispensationAction(id);
      if (r.ok) { toast.success(r.message); setOpen(false); router.refresh(); } else setError(r.message ?? "Gagal menyimpan.");
    } catch { setError("Tidak dapat terhubung ke server."); }
  });
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}><Flag className="h-4 w-4" aria-hidden />Tandai kegiatan selesai</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Tandai kegiatan selesai?" description="Siswa yang belum dikonfirmasi akan ditandai perlu ditinjau. Tidak ada absensi yang dibuat untuk mereka."
        footer={<><Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Kembali</Button><Button onClick={submit} loading={pending}>Tandai selesai</Button></>}>
        {error && <p role="alert" className="rounded-lg border border-danger/20 bg-danger/10 px-3.5 py-3 text-sm text-danger">{error}</p>}
      </Modal>
    </>
  );
}
