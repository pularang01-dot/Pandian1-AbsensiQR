"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, UserCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Textarea } from "@/components/ui/field";
import { completeHandoverAction, reviewDismissalAction } from "../actions";

type Action = "approve" | "reject" | "cancel";

export function DecisionPanel({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [action, setAction] = useState<Action | null>(null);
  const [note, setNote] = useState("");
  const [verified, setVerified] = useState(false);
  const [vnote, setVnote] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  if (status !== "pending" && status !== "approved") return <p className="text-sm text-ink-muted">Permintaan ini sudah final.</p>;
  const close = () => { setAction(null); setNote(""); setVerified(false); setVnote(""); setError(""); };
  const invalid = action === "approve" ? !verified || vnote.trim().length < 3 : action ? note.trim().length < 3 : true;
  const submit = () => action && start(async () => {
    setError("");
    try {
      const input = action === "approve"
        ? { id, action, requester_verified: verified as true, verification_note: vnote.trim(), note: note.trim() || undefined }
        : { id, action, note: note.trim() };
      const r = await reviewDismissalAction(input);
      if (r.ok) { toast.success(r.message); close(); router.refresh(); } else setError(r.message ?? "Keputusan gagal disimpan.");
    } catch { setError("Tidak dapat terhubung ke server. Keputusan BELUM tersimpan."); }
  });

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {status === "pending" && <Button onClick={() => setAction("approve")}><Check className="h-4 w-4" aria-hidden />Setujui</Button>}
        {status === "pending" && <Button variant="danger" onClick={() => setAction("reject")}><X className="h-4 w-4" aria-hidden />Tolak</Button>}
        <Button variant="outline" onClick={() => setAction("cancel")}>Batalkan</Button>
      </div>
      <Modal open={action !== null} onClose={close}
        title={action === "approve" ? "Setujui permintaan?" : action === "reject" ? "Tolak permintaan?" : "Batalkan permintaan?"}
        description={action === "approve" ? "Persetujuan tidak berarti siswa sudah pulang. Serah terima dicatat terpisah saat penjemput tiba." : undefined}
        footer={<><Button variant="outline" onClick={close} disabled={pending}>Kembali</Button><Button variant={action === "approve" ? "primary" : "danger"} onClick={submit} loading={pending} disabled={invalid}>{action === "approve" ? "Setujui" : action === "reject" ? "Tolak" : "Batalkan permintaan"}</Button></>}>
        <div className="space-y-3">
          {error && <p role="alert" className="rounded-lg border border-danger/20 bg-danger/10 px-3.5 py-3 text-sm text-danger">{error}</p>}
          {action === "approve" ? (
            <>
              <label className="flex min-h-11 items-start gap-3 text-sm"><input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} className="mt-1 h-5 w-5" />Saya sudah memverifikasi identitas pemohon (misalnya melalui telepon balik atau tatap muka).</label>
              <Field label="Catatan verifikasi pemohon (wajib)" htmlFor="vnote" hint="Tulis cara verifikasi, bukan nomor identitas."><Textarea id="vnote" value={vnote} onChange={(e) => setVnote(e.target.value)} maxLength={500} /></Field>
              <Field label="Catatan keputusan (opsional)" htmlFor="note"><Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></Field>
            </>
          ) : (
            <Field label="Alasan (wajib)" htmlFor="note"><Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></Field>
          )}
        </div>
      </Modal>
    </>
  );
}

export function HandoverPanel({ id, authorizedName, authorizedRelation }: { id: string; authorizedName: string; authorizedRelation: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [doc, setDoc] = useState("");
  const [matches, setMatches] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const close = () => { setOpen(false); setError(""); };
  const ready = name.trim().length >= 2 && relation.trim().length >= 2 && doc.trim().length >= 2;
  const send = (outcome: "handed_over" | "verification_failed") => start(async () => {
    setError("");
    try {
      const r = await completeHandoverAction({
        request_id: id, outcome, actual_name: name.trim(), actual_relation: relation.trim(), identity_document: doc.trim(),
        matches_authorized: outcome === "handed_over" ? matches : false, note: note.trim() || undefined,
      });
      if (r.ok) { toast.success(r.message); close(); router.refresh(); } else setError(r.message ?? "Gagal menyimpan.");
    } catch { setError("Tidak dapat terhubung ke server. Serah terima BELUM tercatat."); }
  });

  return (
    <>
      <Button onClick={() => setOpen(true)}><UserCheck className="h-4 w-4" aria-hidden />Catat serah terima</Button>
      <Modal open={open} onClose={close} title="Catat serah terima siswa"
        description={`Periksa dokumen identitas penjemput secara langsung. Penjemput yang diizinkan: ${authorizedName} (${authorizedRelation}).`}
        footer={<>
          <Button variant="outline" onClick={close} disabled={pending}>Kembali</Button>
          <Button variant="danger" onClick={() => send("verification_failed")} loading={pending} disabled={!ready}>Verifikasi gagal</Button>
          <Button onClick={() => send("handed_over")} loading={pending} disabled={!ready || !matches}>Serahkan siswa</Button>
        </>}>
        <div className="space-y-3">
          {error && <p role="alert" className="rounded-lg border border-danger/20 bg-danger/10 px-3.5 py-3 text-sm text-danger">{error}</p>}
          <Field label="Nama penjemput sebenarnya" htmlFor="h-name" required><Input id="h-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} /></Field>
          <Field label="Hubungan dengan siswa" htmlFor="h-rel" required><Input id="h-rel" value={relation} onChange={(e) => setRelation(e.target.value)} maxLength={50} /></Field>
          <Field label="Dokumen identitas yang diperiksa" htmlFor="h-doc" required hint="Jenis dokumen saja, misalnya KTP atau SIM. Jangan catat nomornya."><Input id="h-doc" value={doc} onChange={(e) => setDoc(e.target.value)} maxLength={100} /></Field>
          <label className="flex min-h-11 items-start gap-3 text-sm"><input type="checkbox" checked={matches} onChange={(e) => setMatches(e.target.checked)} className="mt-1 h-5 w-5" />Identitas penjemput cocok dengan penjemput yang diizinkan.</label>
          <Field label="Catatan (opsional)" htmlFor="h-note"><Textarea id="h-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></Field>
          <p className="text-xs text-ink-muted">Bila tidak cocok, pilih Verifikasi gagal. Siswa tetap dalam pengawasan sekolah dan percobaan ini tercatat.</p>
        </div>
      </Modal>
    </>
  );
}
