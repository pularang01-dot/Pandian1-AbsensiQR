"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/field";
import { graduateClassAction, previewGraduateClassAction, type GraduatePreview } from "@/app/(app)/classes/actions";

/** Meluluskan seluruh siswa aktif satu kelas. Pratinjau, peringatan, dan konfirmasi ketik LULUS. */
export function GraduateClassDialog({ classId, className }: { classId: string; className: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<GraduatePreview | null>(null);
  const [word, setWord] = useState("");
  const [parents, setParents] = useState(true);

  async function openDialog() {
    setOpen(true);
    setWord("");
    setParents(true);
    setPreview(null);
    setLoading(true);
    try {
      setPreview(await previewGraduateClassAction(classId));
    } catch {
      setPreview({ ok: false, message: "Tidak dapat terhubung ke server. Tidak ada data yang diubah." });
    } finally {
      setLoading(false);
    }
  }

  function confirm() {
    start(async () => {
      try {
        const r = await graduateClassAction(classId, parents, word);
        if (!r.ok) return void toast.error(r.message ?? "Gagal. Tidak ada data yang diubah.");
        toast.success(r.message ?? "Kelulusan diproses.");
        setOpen(false);
        router.refresh();
      } catch {
        toast.error("Tidak dapat terhubung ke server. Tidak ada data yang diubah.");
      }
    });
  }

  const ready = !!preview?.ok && word === "LULUS";

  return (
    <>
      <Button variant="outline" size="md" onClick={openDialog}><GraduationCap className="h-4 w-4" aria-hidden />Luluskan kelas {className}</Button>
      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title={`Luluskan seluruh siswa kelas ${className}`}
        description="Gunakan hanya untuk kelas akhir saat kelulusan."
        footer={<>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Batal</Button>
          <Button variant="danger" onClick={confirm} loading={pending} disabled={!ready}>Luluskan{preview?.students ? ` (${preview.students} siswa)` : ""}</Button>
        </>}
      >
        <div className="space-y-4 text-sm">
          <div role="alert" className="flex gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-[#8a5a0e]">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <div>
              <p className="font-semibold">Perhatian: perubahan ini memengaruhi banyak data sekaligus.</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px]">
                <li>Status siswa menjadi Lulus. Mereka tidak lagi muncul pada absensi harian.</li>
                <li>Kode QR mereka dicabut dan kartu tidak dapat dipakai lagi.</li>
                <li>Orang tua tidak lagi dapat melihat data anak yang sudah lulus.</li>
                <li>Data tidak dihapus. Seluruh riwayat absensi dan izin tetap tersimpan sebagai arsip.</li>
                <li>Bila salah, status siswa dapat dikembalikan satu per satu lewat menu Siswa, tetapi QR harus diterbitkan ulang.</li>
              </ul>
            </div>
          </div>

          {loading && <p className="text-ink-muted" role="status">Menghitung dampak...</p>}
          {preview && !preview.ok && <p role="alert" className="font-medium text-danger">{preview.message}</p>}
          {preview?.ok && (
            <div role="status" className="space-y-1 rounded-lg bg-canvas px-4 py-3">
              <p><span className="tabular font-semibold">{preview.students}</span> siswa aktif kelas {preview.className} akan diluluskan.</p>
              <p><span className="tabular font-semibold">{preview.parentsLinked}</span> akun orang tua terhubung ke siswa ini; <span className="tabular font-semibold">{preview.parentsToDeactivate}</span> di antaranya tidak punya anak aktif lain.</p>
            </div>
          )}

          {preview?.ok && (
            <label className="flex items-start gap-2.5">
              <input type="checkbox" checked={parents} onChange={(e) => setParents(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-line accent-brand" />
              <span>Nonaktifkan akun orang tua yang tidak punya anak aktif lain ({preview.parentsToDeactivate} akun). Akun dapat diaktifkan kembali kapan saja. Orang tua yang masih punya anak aktif tidak disentuh.</span>
            </label>
          )}

          {preview?.ok && (
            <div>
              <label htmlFor="grad-confirm" className="field-label">Ketik <span className="font-mono font-bold">LULUS</span> untuk melanjutkan</label>
              <Input id="grad-confirm" value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="LULUS" />
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}