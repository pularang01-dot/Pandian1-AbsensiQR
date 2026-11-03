"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { assignClassAction } from "../../students/actions";

function run(fn: () => Promise<{ ok: boolean; message?: string }>, router: ReturnType<typeof useRouter>, start: (cb: () => void) => void, after?: () => void) {
  start(async () => {
    try {
      const r = await fn();
      if (r.ok) { toast.success(r.message ?? "Berhasil."); after?.(); router.refresh(); }
      else toast.error(r.message ?? "Gagal. Data belum tersimpan.");
    } catch {
      toast.error("Tidak dapat terhubung ke server. Data belum tersimpan.");
    }
  });
}

export function AddStudentToClass({ classId, candidates }: { classId: string; candidates: { id: string; label: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [studentId, setStudentId] = useState("");
  if (candidates.length === 0) return <p className="text-sm text-ink-muted">Semua siswa aktif pada tahun ajaran ini sudah memiliki kelas.</p>;
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label htmlFor="add-student" className="field-label">Tambahkan siswa belum berkelas</label>
        <Select id="add-student" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
          <option value="">Pilih siswa</option>
          {candidates.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </Select>
      </div>
      <Button variant="secondary" disabled={!studentId} loading={pending} onClick={() => run(() => assignClassAction(studentId, classId), router, start, () => setStudentId(""))}>Tambahkan</Button>
    </div>
  );
}

export function TransferStudent({ studentId, name, classes, currentClassId }: { studentId: string; name: string; classes: { id: string; name: string }[]; currentClassId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [target, setTarget] = useState("");
  const options = classes.filter((c) => c.id !== currentClassId);
  if (options.length === 0) return null;
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={`tr-${studentId}`} className="sr-only">Pindahkan {name} ke kelas</label>
      <Select id={`tr-${studentId}`} value={target} onChange={(e) => setTarget(e.target.value)} className="h-9 w-32">
        <option value="">Pindah ke</option>
        {options.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </Select>
      <Button size="sm" variant="outline" disabled={!target} loading={pending} onClick={() => run(() => assignClassAction(studentId, target), router, start, () => setTarget(""))}>Pindahkan</Button>
    </div>
  );
}
