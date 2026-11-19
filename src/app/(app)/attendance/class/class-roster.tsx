"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCheck, Eraser, Lock, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn, formatWaktu } from "@/lib/utils";
import { recordBackdatedAttendanceAction, recordClassAttendanceAction } from "../actions";

export type RosterStudent = {
  id: string; name: string; nis: string;
  existing: { status: string; source: string; at: string | null } | null;
};

type Choice = "present" | "late" | "sick" | "permission" | "unexcused";
const OPTIONS: { key: Choice; label: string; short: string; on: string; bar: string }[] = [
  { key: "present", label: "Hadir", short: "Hadir", on: "border-success bg-success text-white", bar: "bg-success" },
  { key: "late", label: "Terlambat", short: "Telat", on: "border-warning bg-warning text-navy", bar: "bg-warning" },
  { key: "sick", label: "Sakit", short: "Sakit", on: "border-info bg-info text-white", bar: "bg-info" },
  { key: "permission", label: "Izin", short: "Izin", on: "border-info bg-info text-white", bar: "bg-info" },
  { key: "unexcused", label: "Alpa", short: "Alpa", on: "border-danger bg-danger text-white", bar: "bg-danger" },
];
const LABEL = Object.fromEntries(OPTIONS.map((o) => [o.key, o.label])) as Record<Choice, string>;
const NEEDS_NOTE: Choice[] = ["sick", "permission", "unexcused"];
const SOURCE: Record<string, string> = { qr: "QR", manual: "Manual", permission: "Izin disetujui", dispensation: "Dispensasi", system: "Sistem" };

type Sel = { status: Choice; note: string };

export function ClassRoster({ classId, className, students, date }: { classId: string; className: string; students: RosterStudent[]; date?: string }) {
  const router = useRouter();
  const [sel, setSel] = useState<Record<string, Sel>>({});
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const reasonOk = !date || reason.trim().length >= 5;

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
      const entries = chosen.map((s) => ({ student_id: s.id, status: sel[s.id].status, note: sel[s.id].note.trim() || undefined }));
      const r = date
        ? await recordBackdatedAttendanceAction({ class_id: classId, date, reason: reason.trim(), entries })
        : await recordClassAttendanceAction({ class_id: classId, entries });
      if (r.ok) {
        toast.success(r.message);
        setSel({});
        setReason("");
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

  const done = students.length - open.length + chosen.length;
  const donePct = students.length > 0 ? Math.round((done / students.length) * 100) : 0;
  const initials = (n: string) => n.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  return (
    <div className="pb-28">
      <section className="dash-hero mb-4 overflow-hidden rounded-2xl p-5 text-white shadow-pop sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-white/70">{date ? "Absensi susulan" : "Absensi hari ini"}</p>
            <h2 className="text-2xl font-semibold tracking-tight">Kelas {className}</h2>
            <p className="tabular mt-3 text-3xl font-bold leading-none" role="status" aria-live="polite">
              {done}<span className="text-lg font-medium text-white/70"> dari {students.length} siswa</span>
            </p>
            <p className="mt-1 text-xs text-white/70">sudah tercatat atau dipilih ({donePct}%)</p>
          </div>
          {open.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={allPresent} className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#F5B82E] px-4 text-sm font-semibold text-navy transition-colors hover:bg-[#f7c653]">
                <CheckCheck className="h-4 w-4" aria-hidden />Semua yang belum dipilih: Hadir
              </button>
              <button type="button" onClick={() => setSel({})} disabled={chosen.length === 0} className="inline-flex h-11 items-center gap-2 rounded-lg bg-white/10 px-4 text-sm font-medium text-white transition-colors hover:bg-white/20 disabled:opacity-40">
                <Eraser className="h-4 w-4" aria-hidden />Kosongkan pilihan
              </button>
            </div>
          )}
        </div>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuemin={0} aria-valuemax={students.length} aria-valuenow={done} aria-label="Siswa yang sudah tercatat atau dipilih">
          <div className="h-full rounded-full bg-[#F5B82E] transition-all" style={{ width: `${donePct}%` }} />
        </div>
        <p className="tabular mt-3 text-xs text-white/70">Sudah tersimpan {students.length - open.length}, dipilih {chosen.length}, belum dipilih {unchosen}.</p>
      </section>

      <ul className="space-y-2.5">
        {students.map((s, i) => {
          const cur = sel[s.id];
          const curOpt = OPTIONS.find((o) => o.key === cur?.status);
          return (
            <li key={s.id} className="card relative overflow-hidden p-4 pl-5">
              <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1.5", s.existing ? "bg-line" : curOpt ? curOpt.bar : "bg-transparent")} />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-light text-xs font-semibold text-brand">{initials(s.name)}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold"><span className="tabular mr-1.5 font-normal text-ink-muted">{i + 1}.</span>{s.name}</p>
                    <p className="tabular text-xs text-ink-muted">NIS {s.nis}</p>
                  </div>
                </div>
                {s.existing ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg bg-canvas px-3 py-2 text-xs text-ink-muted">
                    <Lock className="h-3.5 w-3.5" aria-hidden />
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
                          cur?.status === o.key ? cn(o.on, "font-semibold shadow-card") : "border-line bg-surface text-ink hover:border-brand/40 hover:bg-brand-light/50",
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

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 p-3 shadow-pop backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="min-w-0 text-xs text-ink-muted sm:text-sm">
            {chosen.length === 0 ? <p>Belum ada pilihan.</p> : (
              <>
                <p className="font-medium text-ink">{chosen.length} siswa dipilih</p>
                <p className="tabular truncate">
                  {OPTIONS.filter((o) => counts[o.key] > 0).map((o) => `${o.label} ${counts[o.key]}`).join(", ")}
                  {unchosen > 0 ? `. ${unchosen} belum dipilih tidak dicatat.` : ""}
                </p>
              </>
            )}
          </div>
          <Button onClick={() => setConfirm(true)} disabled={chosen.length === 0}><Save className="h-4 w-4" aria-hidden />Simpan {chosen.length > 0 ? `${chosen.length} catatan` : ""}</Button>
        </div>
      </div>

      <Modal
        open={confirm}
        onClose={() => !busy && setConfirm(false)}
        title={date ? "Simpan absensi susulan?" : "Simpan absensi kelas?"}
        description={`Kelas ${className}. Periksa ringkasan sebelum menyimpan.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(false)} disabled={busy}>Kembali</Button>
            <Button onClick={save} loading={busy} disabled={!reasonOk}>Simpan</Button>
          </>
        }
      >
        <ul className="mb-3 space-y-1 text-sm">
          {OPTIONS.filter((o) => counts[o.key] > 0).map((o) => (
            <li key={o.key} className="flex justify-between"><span>{o.label}</span><span className="tabular font-semibold">{counts[o.key]}</span></li>
          ))}
        </ul>
        {date && (
          <div className="mb-3">
            <label htmlFor="reason" className="field-label">Alasan absensi susulan (wajib)</label>
            <textarea
              id="reason"
              value={reason}
              maxLength={300}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: internet sekolah mati seharian, absensi dicatat dari buku kelas"
              className="min-h-20 w-full rounded-lg border border-line bg-surface p-3 text-sm"
            />
            {!reasonOk && <p className="mt-1 text-xs text-danger">Isi alasan minimal 5 karakter.</p>}
          </div>
        )}
        <p className="text-sm text-ink-muted">
          Siswa yang tidak dipilih tidak dicatat dan tidak otomatis Alpa{unchosen > 0 ? ` (${unchosen} siswa)` : ""}. Catatan yang sudah tersimpan tidak dapat diubah dari halaman ini; perubahan dilakukan lewat Koreksi dengan alasan dan tercatat.
        </p>
      </Modal>
    </div>
  );
}