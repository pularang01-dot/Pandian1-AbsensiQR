"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCheck, Eraser, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn, formatWaktu } from "@/lib/utils";
import { recordClassAttendanceAction } from "../actions";

export type RosterStudent = {
  id: string; name: string; nis: string;
  existing: { status: string; source: string; at: string | null } | null;
};

type Choice = "present" | "late" | "sick" | "permission" | "unexcused";
const OPTIONS: { key: Choice; label: string; short: string; on: string }[] = [
  { key: "present", label: "Hadir", short: "Hadir", on: "border-success bg-success/10 text-success" },
  { key: "late", label: "Terlambat", short: "Telat", on: "border-warning bg-warning/15 text-[#9a6510]" },
  { key: "sick", label: "Sakit", short: "Sakit", on: "border-info bg-info/10 text-info" },
  { key: "permission", label: "Izin", short: "Izin", on: "border-info bg-info/10 text-info" },
  { key: "unexcused", label: "Alpa", short: "Alpa", on: "border-danger bg-danger/10 text-danger" },
];
const LABEL = Object.fromEntries(OPTIONS.map((o) => [o.key, o.label])) as Record<Choice, string>;
const NEEDS_NOTE: Choice[] = ["sick", "permission", "unexcused"];
const SOURCE: Record<string, string> = { qr: "QR", manual: "Manual", permission: "Izin disetujui", dispensation: "Dispensasi", system: "Sistem" };

type Sel = { status: Choice; note: string };

export function ClassRoster({ classId, className, students }: { classId: string; className: string; students: RosterStudent[] }) {
  const router = useRouter();
  const [sel, setSel] = useState<Record<string, Sel>>({});
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const open = useMemo(() => students.filter((s) => !s.existing), [students]);
  const chosen = open.filter((s) => sel[s.id]);
  const unchosen = open.length - chosen.length;
  const counts = useMemo(() => {
    const c: Record<Choice, number> = { present: 0, late: 0, sick: 0, permission: 0, unexcused: 0 };
    for (const s of chosen) c[sel[s.id].status]++;
    return c;
  }, [chosen, sel]);

  function pick(id: string, status: Choice) {
    setSel((p) => {
      if (p[id]?.status === status) { const rest = { ...p }; delete rest[id]; return rest; } // ketuk lagi = batal pilih
      return { ...p, [id]: { status, note: p[id]?.note ?? "" } };
    });
  }
  const setNote = (id: string, note: string) => setSel((p) => (p[id] ? { ...p, [id]: { ...p[id], note } } : p));
  function allPresent() {
    setSel((p) => { const n = { ...p }; for (const s of open) if (!n[s.id]) n[s.id] = { status: "present", note: "" }; return n; });
  }

  async function save() {
    setBusy(true);
    try {
      const r = await recordClassAttendanceAction({
        class_id: classId,
        entries: chosen.map((s) => ({ student_id: s.id, status: sel[s.id].status, note: sel[s.id].note.trim() || undefined })),
      });
      if (r.ok) {
        toast.success(r.message);
        setSel({});
        setConfirm(false);
        router.refresh();
      } else {
        toast.error(r.message);
        setConfirm(false);
      }
    } catch {
      toast.error("Tidak dapat terhubung ke server. Data BELUM tersimpan.");
    } finally {
      setBusy(false);
    }
  }

  if (students.length === 0) {
    return <div className="card p-6 text-sm text-ink-muted">Kelas {className} belum memiliki siswa aktif.</div>;
  }

  return (
    <div className="pb-28">
      <div className="card mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm" role="status" aria-live="polite">
          <span className="font-semibold">Kelas {className}</span>
          <span className="tabular text-ink-muted"> | {students.length} siswa | sudah tercatat {students.length - open.length} | dipilih {chosen.length} | belum dipilih {unchosen}</span>
        </p>
        {open.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={allPresent}><CheckCheck className="h-4 w-4" aria-hidden />Pilih Hadir untuk yang belum dipilih</Button>
            <Button variant="ghost" size="sm" onClick={() => setSel({})} disabled={chosen.length === 0}><Eraser className="h-4 w-4" aria-hidden />Kosongkan pilihan</Button>
          </div>
        )}
      </div>

      <ul className="card divide-y divide-line">
        {students.map((s, i) => {
          const cur = sel[s.id];
          return (
            <li key={s.id} className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold"><span className="tabular mr-2 text-ink-muted">{i + 1}.</span>{s.name}</p>
                  <p className="tabular text-xs text-ink-muted">NIS {s.nis}</p>
                </div>
                {s.existing ? (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                    <StatusBadge status={s.existing.status} />
                    <span>{SOURCE[s.existing.source] ?? s.existing.source}{s.existing.at ? ` ${formatWaktu(s.existing.at)}` : ""}. Untuk mengubah, gunakan Koreksi di Data absensi.</span>
                  </div>
                ) : (
                  <div role="group" aria-label={`Status kehadiran ${s.name}`} className="grid grid-cols-5 gap-1.5 sm:w-[28rem]">
                    {OPTIONS.map((o) => (
                      <button
                        key={o.key}
                        type="button"
                        aria-pressed={cur?.status === o.key}
                        aria-label={`${o.label}: ${s.name}`}
                        onClick={() => pick(s.id, o.key)}
                        className={cn(
                          "flex h-11 items-center justify-center rounded-lg border px-1 text-xs font-medium transition-colors sm:text-sm",
                          cur?.status === o.key ? cn(o.on, "border-2 font-semibold") : "border-line bg-surface text-ink hover:bg-canvas",
                        )}
                      >
                        {cur?.status === o.key && <span aria-hidden className="mr-0.5">✓</span>}{o.short}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {cur && NEEDS_NOTE.includes(cur.status) && (
                <div className="mt-3">
                  <label htmlFor={`note-${s.id}`} className="sr-only">Catatan untuk {s.name} (opsional)</label>
                  <input
                    id={`note-${s.id}`}
                    value={cur.note}
                    maxLength={300}
                    onChange={(e) => setNote(s.id, e.target.value)}
                    placeholder={`Catatan ${LABEL[cur.status].toLowerCase()} (opsional), misalnya kata orang tua`}
                    className="h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm"
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 p-3 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <p className="text-xs text-ink-muted sm:text-sm">
            {chosen.length === 0 ? "Belum ada pilihan." : `${chosen.length} siswa dipilih.`}
            {unchosen > 0 && chosen.length > 0 ? ` ${unchosen} siswa belum dipilih tidak dicatat.` : ""}
          </p>
          <Button onClick={() => setConfirm(true)} disabled={chosen.length === 0}><Save className="h-4 w-4" aria-hidden />Simpan {chosen.length > 0 ? `${chosen.length} catatan` : ""}</Button>
        </div>
      </div>

      <Modal
        open={confirm}
        onClose={() => !busy && setConfirm(false)}
        title="Simpan absensi kelas?"
        description={`Kelas ${className}. Periksa ringkasan sebelum menyimpan.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(false)} disabled={busy}>Kembali</Button>
            <Button onClick={save} loading={busy}>Simpan</Button>
          </>
        }
      >
        <ul className="mb-3 space-y-1 text-sm">
          {OPTIONS.filter((o) => counts[o.key] > 0).map((o) => (
            <li key={o.key} className="flex justify-between"><span>{o.label}</span><span className="tabular font-semibold">{counts[o.key]}</span></li>
          ))}
        </ul>
        <p className="text-sm text-ink-muted">
          Siswa yang tidak dipilih tidak dicatat dan tidak otomatis Alpa{unchosen > 0 ? ` (${unchosen} siswa)` : ""}. Catatan yang sudah tersimpan tidak dapat diubah dari halaman ini; perubahan dilakukan lewat Koreksi dengan alasan dan tercatat.
        </p>
      </Modal>
    </div>
  );
}