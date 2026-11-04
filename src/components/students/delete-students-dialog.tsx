"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/field";
import { deleteStudentsAction, previewDeleteStudentsAction, type DeleteStudentsResult, type DeleteTarget } from "@/app/(app)/students/actions";

/**
 * Hapus permanen data siswa dengan peringatan resmi dan konfirmasi ketik HAPUS.
 * Hanya siswa tanpa riwayat yang dapat dihapus; siswa berriwayat dilindungi oleh basis data.
 */
export function DeleteStudentsDialog({ target, subject, buttonLabel, redirectTo, size = "sm" }: {
  target: DeleteTarget; subject: string; buttonLabel: string; redirectTo?: string; size?: "sm" | "md";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<DeleteStudentsResult | null>(null);
  const [word, setWord] = useState("");

  async function openDialog() {
    setOpen(true);
    setWord("");
    setPreview(null);
    setLoading(true);
    try {
      setPreview(await previewDeleteStudentsAction(target));
    } catch {
      setPreview({ ok: false, message: "Tidak dapat terhubung ke server. Tidak ada data yang dihapus." });
    } finally {
      setLoading(false);
    }
  }

  function confirm() {
    start(async () => {
      try {
        const r = await deleteStudentsAction(target, word);
        if (!r.ok) return void toast.error(r.message ?? "Penghapusan gagal. Tidak ada data yang dihapus.");
        toast.success(r.message ?? "Data dihapus.");
        if ((r.skipped?.length ?? 0) > 0) toast.warning(`${r.skipped!.length} siswa tidak dihapus karena memiliki riwayat.`);
        setOpen(false);
        if (redirectTo) router.push(redirectTo); else router.refresh();
      } catch {
        toast.error("Tidak dapat terhubung ke server. Tidak ada data yang dihapus.");
      }
    });
  }

  const deletable = preview?.deletable ?? 0;
  const skipped = preview?.skipped ?? [];
  const ready = !!preview?.ok && deletable > 0 && word === "HAPUS";

  return (
    <>
      <Button variant="outline" size={size} onClick={openDialog} className="text-danger"><Trash2 className="h-4 w-4" aria-hidden />{buttonLabel}</Button>
      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="Peringatan: hapus data siswa permanen"
        description={`Anda akan menghapus ${subject}.`}
        footer={<>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Batal</Button>
          <Button variant="danger" onClick={confirm} loading={pending} disabled={!ready}>Hapus permanen{deletable > 0 ? ` (${deletable} siswa)` : ""}</Button>
        </>}
      >
        <div className="space-y-4 text-sm">
          <div role="alert" className="flex gap-3 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-danger">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <div>
              <p className="font-semibold">Tindakan ini tidak dapat dibatalkan.</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px]">
                <li>Data siswa, penempatan kelas, tautan orang tua, dan kode QR dihapus selamanya.</li>
                <li>Kartu QR yang sudah dicetak tidak berlaku lagi.</li>
                <li>Penghapusan dicatat di log audit beserta pelakunya.</li>
                <li>Siswa yang sudah memiliki riwayat absensi, izin, dispensasi, atau pulang awal tidak akan dihapus. Untuk mereka gunakan status Pindah, Lulus, atau Nonaktif.</li>
              </ul>
            </div>
          </div>

          {loading && <p className="text-ink-muted" role="status">Memeriksa data siswa...</p>}
          {preview && !preview.ok && <p role="alert" className="font-medium text-danger">{preview.message}</p>}
          {preview?.ok && (
            <div role="status" className="rounded-lg bg-canvas px-4 py-3">
              <p><span className="tabular font-semibold">{deletable}</span> dari <span className="tabular font-semibold">{preview.total}</span> siswa dapat dihapus.</p>
              {skipped.length > 0 && (
                <>
                  <p className="mt-2 font-medium">{skipped.length} siswa dilindungi dan tidak akan dihapus:</p>
                  <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto text-xs text-ink-muted">
                    {skipped.map((s) => <li key={s.id}><span className="font-medium text-ink">{s.name}</span> (NIS {s.nis}): {s.reason}</li>)}
                  </ul>
                </>
              )}
              {deletable === 0 && <p className="mt-2 text-ink-muted">Tidak ada siswa yang dapat dihapus.</p>}
            </div>
          )}

          {preview?.ok && deletable > 0 && (
            <div>
              <label htmlFor="del-confirm" className="field-label">Ketik <span className="font-mono font-bold">HAPUS</span> untuk melanjutkan</label>
              <Input id="del-confirm" value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="HAPUS" />
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}