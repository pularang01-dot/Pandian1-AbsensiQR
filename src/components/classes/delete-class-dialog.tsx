"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/field";
import { deleteClassAction, previewDeleteClassAction, type DeleteClassResult } from "@/app/(app)/classes/actions";

/** Hapus permanen satu kelas KOSONG. Kelas berriwayat dilindungi oleh basis data; sarannya adalah menonaktifkan. */
export function DeleteClassDialog({ classId, className }: { classId: string; className: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<DeleteClassResult | null>(null);
  const [word, setWord] = useState("");

  async function openDialog() {
    setOpen(true);
    setWord("");
    setPreview(null);
    setLoading(true);
    try {
      setPreview(await previewDeleteClassAction(classId));
    } catch {
      setPreview({ ok: false, message: "Tidak dapat terhubung ke server. Tidak ada data yang dihapus." });
    } finally {
      setLoading(false);
    }
  }

  function confirm() {
    start(async () => {
      try {
        const r = await deleteClassAction(classId, word);
        if (!r.ok) return void toast.error(r.message ?? "Penghapusan gagal. Tidak ada data yang dihapus.");
        toast.success(r.message ?? "Kelas dihapus.");
        setOpen(false);
        router.push("/classes");
      } catch {
        toast.error("Tidak dapat terhubung ke server. Tidak ada data yang dihapus.");
      }
    });
  }

  const ready = !!preview?.ok && preview.deletable === true && word === "HAPUS";

  return (
    <>
      <Button variant="outline" size="md" onClick={openDialog} className="text-danger"><Trash2 className="h-4 w-4" aria-hidden />Hapus kelas {className}</Button>
      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="Peringatan: hapus kelas permanen"
        description={`Anda akan menghapus kelas ${className}.`}
        footer={<>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Batal</Button>
          <Button variant="danger" onClick={confirm} loading={pending} disabled={!ready}>Hapus kelas</Button>
        </>}
      >
        <div className="space-y-4 text-sm">
          <div role="alert" className="flex gap-3 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-danger">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <div>
              <p className="font-semibold">Tindakan ini tidak dapat dibatalkan.</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px]">
                <li>Hanya kelas kosong yang dapat dihapus: tanpa siswa dan tanpa catatan absensi.</li>
                <li>Riwayat wali kelas untuk kelas ini ikut terhapus.</li>
                <li>Penghapusan dicatat di Aktivitas beserta pelakunya.</li>
              </ul>
            </div>
          </div>

          {loading && <p className="text-ink-muted" role="status">Memeriksa kelas...</p>}
          {preview && !preview.ok && <p role="alert" className="font-medium text-danger">{preview.message}</p>}
          {preview?.ok && preview.deletable === false && (
            <div role="status" className="rounded-lg bg-canvas px-4 py-3">
              <p className="font-medium">Kelas ini tidak dapat dihapus karena:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {(preview.reasons ?? []).map((x) => <li key={x}>{x}</li>)}
              </ul>
              <p className="mt-2 text-ink-muted">Bila kelas tidak dipakai lagi, nonaktifkan lewat tombol Ubah. Kelas nonaktif tidak muncul di pilihan baru, dan riwayatnya tetap aman.</p>
            </div>
          )}
          {preview?.ok && preview.deletable === true && (
            <>
              <p role="status" className="rounded-lg bg-canvas px-4 py-3">Kelas {className} kosong dan dapat dihapus.</p>
              <div>
                <label htmlFor="del-class-confirm" className="field-label">Ketik <span className="font-mono font-bold">HAPUS</span> untuk melanjutkan</label>
                <Input id="del-class-confirm" value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="HAPUS" />
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}