"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/field";
import { deleteYearAction, previewDeleteYearAction, type DeleteYearResult } from "@/app/(app)/settings/actions";

/** Hapus permanen satu tahun ajaran yang tidak berisi data (kelas kosong ikut terhapus). Yang berriwayat dilindungi. */
export function DeleteYearDialog({ yearId, name }: { yearId: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<DeleteYearResult | null>(null);
  const [word, setWord] = useState("");

  async function openDialog() {
    setOpen(true);
    setWord("");
    setPreview(null);
    setLoading(true);
    try {
      setPreview(await previewDeleteYearAction(yearId));
    } catch {
      setPreview({ ok: false, message: "Tidak dapat terhubung ke server. Tidak ada data yang dihapus." });
    } finally {
      setLoading(false);
    }
  }

  function confirm() {
    start(async () => {
      try {
        const r = await deleteYearAction(yearId, word);
        if (!r.ok) return void toast.error(r.message ?? "Penghapusan gagal. Tidak ada data yang dihapus.");
        toast.success(r.message ?? "Tahun ajaran dihapus.");
        setOpen(false);
        router.refresh();
      } catch {
        toast.error("Tidak dapat terhubung ke server. Tidak ada data yang dihapus.");
      }
    });
  }

  const ready = !!preview?.ok && preview.deletable === true && word === "HAPUS";

  return (
    <>
      <Button variant="outline" size="sm" onClick={openDialog} className="text-danger"><Trash2 className="h-4 w-4" aria-hidden />Hapus</Button>
      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="Peringatan: hapus tahun ajaran permanen"
        description={`Anda akan menghapus tahun ajaran ${name}.`}
        footer={<>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Batal</Button>
          <Button variant="danger" onClick={confirm} loading={pending} disabled={!ready}>Hapus tahun ajaran</Button>
        </>}
      >
        <div className="space-y-4 text-sm">
          <div role="alert" className="flex gap-3 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-danger">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <div>
              <p className="font-semibold">Tindakan ini tidak dapat dibatalkan.</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px]">
                <li>Hanya tahun ajaran yang tidak aktif dan tanpa kelas berisi yang dapat dihapus.</li>
                <li>Kelas kosong di dalamnya ikut terhapus.</li>
                <li>Penghapusan dicatat di Aktivitas beserta pelakunya.</li>
              </ul>
            </div>
          </div>

          {loading && <p className="text-ink-muted" role="status">Memeriksa tahun ajaran...</p>}
          {preview && !preview.ok && <p role="alert" className="font-medium text-danger">{preview.message}</p>}
          {preview?.ok && preview.deletable === false && (
            <div role="status" className="rounded-lg bg-canvas px-4 py-3">
              <p className="font-medium">Tahun ajaran ini tidak dapat dihapus karena:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {(preview.reasons ?? []).map((x) => <li key={x}>{x}</li>)}
              </ul>
              <p className="mt-2 text-ink-muted">Untuk tahun ajaran yang sudah selesai dan berisi riwayat, gunakan Arsipkan. Datanya tetap tersimpan.</p>
            </div>
          )}
          {preview?.ok && preview.deletable === true && (
            <>
              <p role="status" className="rounded-lg bg-canvas px-4 py-3">
                Tahun ajaran {name} dapat dihapus{(preview.emptyClasses ?? 0) > 0 ? `, bersama ${preview.emptyClasses} kelas kosong di dalamnya` : ""}.
              </p>
              <div>
                <label htmlFor="del-year-confirm" className="field-label">Ketik <span className="font-mono font-bold">HAPUS</span> untuk melanjutkan</label>
                <Input id="del-year-confirm" value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="HAPUS" />
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}