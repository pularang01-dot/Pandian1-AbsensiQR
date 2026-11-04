"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/field";
import { deleteAccountsAction, previewDeleteAccountsAction, type DeleteAccountsResult } from "@/app/(app)/settings/users/actions";

/** Hapus permanen akun tanpa aktivitas. Peringatan resmi, pratinjau, dan konfirmasi ketik HAPUS. Khusus Super Admin. */
export function DeleteAccountsDialog({ ids, subject, buttonLabel, size = "sm" }: { ids: string[]; subject: string; buttonLabel: string; size?: "sm" | "md" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<DeleteAccountsResult | null>(null);
  const [word, setWord] = useState("");

  async function openDialog() {
    setOpen(true);
    setWord("");
    setPreview(null);
    setLoading(true);
    try {
      setPreview(await previewDeleteAccountsAction(ids));
    } catch {
      setPreview({ ok: false, message: "Tidak dapat terhubung ke server. Tidak ada akun yang dihapus." });
    } finally {
      setLoading(false);
    }
  }

  function confirm() {
    start(async () => {
      try {
        const r = await deleteAccountsAction(ids, word);
        if (!r.ok) return void toast.error(r.message ?? "Penghapusan gagal. Tidak ada akun yang dihapus.");
        toast.success(r.message ?? "Akun dihapus.");
        if ((r.blocked?.length ?? 0) > 0) toast.warning(`${r.blocked!.length} akun tidak dihapus.`);
        setOpen(false);
        router.refresh();
      } catch {
        toast.error("Tidak dapat terhubung ke server. Tidak ada akun yang dihapus.");
      }
    });
  }

  const deletable = preview?.deletable ?? [];
  const blocked = preview?.blocked ?? [];
  const ready = !!preview?.ok && deletable.length > 0 && word === "HAPUS";

  return (
    <>
      <Button variant="outline" size={size} onClick={openDialog} className="text-danger"><Trash2 className="h-4 w-4" aria-hidden />{buttonLabel}</Button>
      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="Peringatan: hapus akun permanen"
        description={`Anda akan menghapus ${subject}.`}
        footer={<>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Batal</Button>
          <Button variant="danger" onClick={confirm} loading={pending} disabled={!ready}>Hapus permanen{deletable.length > 0 ? ` (${deletable.length} akun)` : ""}</Button>
        </>}
      >
        <div className="space-y-4 text-sm">
          <div role="alert" className="flex gap-3 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-danger">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <div>
              <p className="font-semibold">Tindakan ini tidak dapat dibatalkan.</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px]">
                <li>Akun login, peran, dan tautan ke siswa dihapus selamanya. Pemilik email harus diundang ulang bila ingin memakai sistem lagi.</li>
                <li>Hanya akun yang belum pernah beraktivitas yang dapat dihapus. Akun yang pernah mencatat, meninjau, atau menjadi wali kelas dilindungi.</li>
                <li>Untuk akun yang tidak lagi bertugas tetapi punya riwayat, gunakan Nonaktifkan.</li>
                <li>Penghapusan dicatat di log audit.</li>
              </ul>
            </div>
          </div>

          {loading && <p className="text-ink-muted" role="status">Memeriksa aktivitas akun...</p>}
          {preview && !preview.ok && <p role="alert" className="font-medium text-danger">{preview.message}</p>}
          {preview?.ok && (
            <div role="status" className="space-y-3 rounded-lg bg-canvas px-4 py-3">
              <p><span className="tabular font-semibold">{deletable.length}</span> dari <span className="tabular font-semibold">{preview.total}</span> akun dapat dihapus.</p>
              {deletable.length > 0 && (
                <ul className="max-h-40 space-y-0.5 overflow-y-auto text-xs">
                  {deletable.map((d) => <li key={d.id}><span className="font-medium">{d.name}</span> <span className="text-ink-muted">{d.email ?? ""}</span></li>)}
                </ul>
              )}
              {blocked.length > 0 && (
                <>
                  <p className="font-medium">{blocked.length} akun dilindungi dan tidak akan dihapus:</p>
                  <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-ink-muted">
                    {blocked.map((b) => <li key={b.id}><span className="font-medium text-ink">{b.name}</span>: {b.reason}</li>)}
                  </ul>
                </>
              )}
            </div>
          )}

          {preview?.ok && deletable.length > 0 && (
            <div>
              <label htmlFor="del-acc-confirm" className="field-label">Ketik <span className="font-mono font-bold">HAPUS</span> untuk melanjutkan</label>
              <Input id="del-acc-confirm" value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="HAPUS" />
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}