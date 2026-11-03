"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, MessageSquareWarning, Search, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Textarea } from "@/components/ui/field";
import { reviewPermissionAction } from "../actions";

type Action = "start_review" | "request_clarification" | "reject" | "approve" | "cancel_approval";

const COPY: Record<Action, { title: string; desc: string; confirm: string; noteLabel: string; danger?: boolean }> = {
  start_review: { title: "Mulai tinjau pengajuan?", desc: "Status berubah menjadi Sedang Ditinjau.", confirm: "Mulai tinjau", noteLabel: "Catatan (opsional)" },
  request_clarification: { title: "Minta klarifikasi", desc: "Orang tua akan menerima notifikasi beserta pesan Anda.", confirm: "Kirim permintaan", noteLabel: "Pesan untuk orang tua (wajib)" },
  reject: { title: "Tolak pengajuan?", desc: "Pengajuan ditolak dan tidak memengaruhi absensi. Alasan akan terlihat oleh orang tua.", confirm: "Tolak pengajuan", noteLabel: "Alasan penolakan (wajib)", danger: true },
  approve: { title: "Setujui pengajuan?", desc: "Absensi pada hari sekolah dalam rentang tanggal akan ditandai sesuai kategori. Kehadiran fisik (hadir/terlambat) yang sudah tercatat tidak ditimpa. Hari libur dilewati.", confirm: "Setujui", noteLabel: "Catatan peninjauan" },
  cancel_approval: { title: "Batalkan persetujuan?", desc: "Catatan absensi yang dibuat dari persetujuan ini dikembalikan ke Belum Diverifikasi dengan jejak koreksi.", confirm: "Batalkan persetujuan", noteLabel: "Alasan pembatalan (wajib)", danger: true },
};
const NOTE_REQUIRED: Record<Action, (retro: boolean) => boolean> = {
  start_review: () => false, request_clarification: () => true, reject: () => true, approve: (retro) => retro, cancel_approval: () => true,
};

export function ReviewPanel({ requestId, status, retrospective, canCancelApproval }: { requestId: string; status: string; retrospective: boolean; canCancelApproval: boolean }) {
  const router = useRouter();
  const [action, setAction] = useState<Action | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const open = ["pending", "under_review", "needs_clarification"].includes(status);
  const copy = action ? COPY[action] : null;
  const needNote = action ? NOTE_REQUIRED[action](retrospective) : false;
  const minLen = action === "approve" ? 5 : 3;
  const tooShort = needNote && note.trim().length < minLen;

  const close = () => { setAction(null); setNote(""); setError(""); };
  const submit = () => action && start(async () => {
    setError("");
    try {
      const r = await reviewPermissionAction({ request_id: requestId, action, note: note.trim() || undefined });
      if (r.ok) { toast.success(r.message); close(); router.refresh(); } else setError(r.message ?? "Keputusan gagal disimpan.");
    } catch {
      setError("Tidak dapat terhubung ke server. Keputusan BELUM tersimpan.");
    }
  });

  if (!open && !(status === "approved" && canCancelApproval)) {
    return <p className="text-sm text-ink-muted">Pengajuan ini sudah final. Tidak ada tindakan yang tersedia.</p>;
  }

  return (
    <>
      {retrospective && open && <p className="mb-3 rounded-lg border border-warning/30 bg-warning/10 px-3.5 py-3 text-sm text-[#8a5a0e]">Pengajuan ini diajukan setelah tanggal ketidakhadiran. Periksa dokumen dan wajib isi catatan peninjauan sebelum menyetujui.</p>}
      <div className="flex flex-wrap gap-2">
        {status === "pending" && <Button variant="outline" onClick={() => setAction("start_review")}><Search className="h-4 w-4" aria-hidden />Mulai tinjau</Button>}
        {open && <Button onClick={() => setAction("approve")}><Check className="h-4 w-4" aria-hidden />Setujui</Button>}
        {open && <Button variant="outline" onClick={() => setAction("request_clarification")}><MessageSquareWarning className="h-4 w-4" aria-hidden />Minta klarifikasi</Button>}
        {open && <Button variant="danger" onClick={() => setAction("reject")}><X className="h-4 w-4" aria-hidden />Tolak</Button>}
        {status === "approved" && canCancelApproval && <Button variant="danger" onClick={() => setAction("cancel_approval")}><Undo2 className="h-4 w-4" aria-hidden />Batalkan persetujuan</Button>}
      </div>

      <Modal
        open={action !== null}
        onClose={close}
        title={copy?.title ?? ""}
        description={copy?.desc}
        footer={<><Button variant="outline" onClick={close} disabled={pending}>Batal</Button><Button variant={copy?.danger ? "danger" : "primary"} onClick={submit} loading={pending} disabled={tooShort}>{copy?.confirm}</Button></>}
      >
        <div className="space-y-3">
          {error && <p role="alert" className="rounded-lg border border-danger/20 bg-danger/10 px-3.5 py-3 text-sm text-danger">{error}</p>}
          <Field label={copy?.noteLabel ?? ""} htmlFor="review-note" hint="Catatan ini dapat dibaca oleh orang tua. Jangan menulis data sensitif lain.">
            <Textarea id="review-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
