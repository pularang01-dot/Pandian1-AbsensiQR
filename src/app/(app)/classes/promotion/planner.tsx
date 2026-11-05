"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ChevronDown, ChevronRight, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input, Select } from "@/components/ui/field";
import { createNextYearClassesAction, executePromotionAction, previewPromotionAction, type PromotionPlan, type PromotionResult } from "./actions";

type Student = { id: string; nis: string; name: string };
type Source = { id: string; name: string; grade: number | null; students: Student[]; suggestion: string };
type Target = { id: string; name: string; grade: number | null };
type ExAction = "repeat" | "other" | "transfer" | "inactive" | "graduate";
type Exc = { action: ExAction; classId: string };

const EX_LABEL: Record<ExAction, string> = {
  repeat: "Tidak naik kelas (mengulang tingkat yang sama)",
  other: "Pindah ke kelas tujuan lain",
  transfer: "Pindah sekolah",
  inactive: "Berhenti atau nonaktif",
  graduate: "Lulus",
};

export function PromotionPlanner({ fromYear, toYear, sources, targets }: {
  fromYear: { id: string; name: string }; toYear: { id: string; name: string }; sources: Source[]; targets: Target[];
}) {
  const router = useRouter();
  const [classMap, setClassMap] = useState<Record<string, string>>(() => Object.fromEntries(sources.map((s) => [s.id, s.suggestion])));
  const [exc, setExc] = useState<Record<string, Exc>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [creating, startCreate] = useTransition();
  const [review, setReview] = useState(false);

  const effective = (s: Source, st: Student): string => {
    const e = exc[st.id];
    if (e) return e.action;
    const m = classMap[s.id];
    return m === "graduate" ? "graduate" : m ? "promote" : "untouched";
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { promote: 0, repeat: 0, other: 0, transfer: 0, inactive: 0, graduate: 0, untouched: 0 };
    for (const s of sources) for (const st of s.students) c[effective(s, st)]++;
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources, classMap, exc]);

  const incomplete = Object.entries(exc).filter(([, e]) => (e.action === "repeat" || e.action === "other") && !e.classId).length;
  const unmappedClasses = sources.filter((s) => !classMap[s.id]).length;
  const nothing = counts.untouched === sources.reduce((n, s) => n + s.students.length, 0);

  const plan: PromotionPlan = {
    fromYear: fromYear.id, toYear: toYear.id, classMap,
    exceptions: Object.entries(exc).map(([student_id, e]) => ({ student_id, action: e.action, ...(e.classId ? { class_id: e.classId } : {}) })),
    deactivateParents: true,
  };

  function setException(id: string, e: Exc | null) {
    setExc((prev) => { const n = { ...prev }; if (e) n[id] = e; else delete n[id]; return n; });
  }

  function autoCreate() {
    startCreate(async () => {
      try {
        const r = await createNextYearClassesAction(fromYear.id, toYear.id);
        if (r.ok) { toast.success(r.message); if (r.skipped?.length) toast.warning(`Buat manual: ${r.skipped.join("; ")}`); router.refresh(); }
        else toast.error(r.message);
      } catch { toast.error("Tidak dapat terhubung ke server."); }
    });
  }

  const sameGrade = (s: Source) => (s.grade === null ? targets : targets.filter((t) => t.grade === s.grade));

  return (
    <div className="space-y-6">
      <div role="note" className="rounded-lg border border-line bg-surface px-4 py-3 text-sm">
        <p className="font-medium">Cara memakai</p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-ink-muted">
          <li>Pastikan kelas tahun ajaran tujuan ({toYear.name}) sudah ada. Bila belum, buat otomatis dari kelas {fromYear.name}.</li>
          <li>Tentukan kelas tujuan tiap kelas. Kelas tingkat 6 otomatis diluluskan.</li>
          <li>Buka &quot;Pengecualian siswa&quot; untuk siswa yang tidak naik kelas, pindah kelas lain, pindah sekolah, atau berhenti.</li>
          <li>Periksa rencana. Sistem menampilkan ringkasan dan masalah sebelum Anda mengonfirmasi.</li>
        </ol>
        <div className="mt-3"><Button variant="outline" size="sm" onClick={autoCreate} loading={creating}><Wand2 className="h-4 w-4" aria-hidden />Buat kelas {toYear.name} dari kelas {fromYear.name}</Button></div>
        {targets.length === 0 && <p className="mt-2 font-medium text-[#8a5a0e]">Belum ada kelas aktif pada {toYear.name}.</p>}
      </div>

      {sources.map((s) => {
        const isOpen = !!open[s.id];
        const nEx = s.students.filter((st) => exc[st.id]).length;
        return (
          <section key={s.id} className="card" aria-labelledby={`cls-${s.id}`}>
            <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 id={`cls-${s.id}`} className="text-base font-semibold">Kelas {s.name} <span className="text-sm font-normal text-ink-muted">| {s.students.length} siswa aktif{s.grade ? ` | tingkat ${s.grade}` : ""}</span></h2>
                {s.grade === null && <p className="text-xs text-[#8a5a0e]">Tingkat kelas tidak terbaca. Pilih kelas tujuan secara manual.</p>}
              </div>
              <div className="sm:w-72">
                <label htmlFor={`map-${s.id}`} className="mb-1.5 block text-xs font-medium text-ink-muted">Kelas tujuan ({toYear.name})</label>
                <Select id={`map-${s.id}`} value={classMap[s.id] ?? ""} onChange={(e) => setClassMap((m) => ({ ...m, [s.id]: e.target.value }))}>
                  <option value="">Belum diproses</option>
                  {(s.grade === null || s.grade >= 6) && <option value="graduate">Luluskan (kelas akhir)</option>}
                  {targets.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
              </div>
            </div>
            <div className="border-t border-line px-5 py-2">
              <button type="button" aria-expanded={isOpen} onClick={() => setOpen((o) => ({ ...o, [s.id]: !isOpen }))} className="flex items-center gap-1.5 py-1.5 text-sm font-medium text-brand hover:underline">
                {isOpen ? <ChevronDown className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
                Pengecualian siswa{nEx > 0 ? ` (${nEx} diatur)` : ""}
              </button>
              {isOpen && (
                <ul className="divide-y divide-line">
                  {s.students.map((st) => {
                    const e = exc[st.id];
                    const needClass = e && (e.action === "repeat" || e.action === "other");
                    const options = e?.action === "repeat" ? sameGrade(s) : targets;
                    return (
                      <li key={st.id} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 text-sm"><span className="font-medium">{st.name}</span> <span className="tabular text-xs text-ink-muted">NIS {st.nis}</span></div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <label htmlFor={`ex-${st.id}`} className="sr-only">Keputusan untuk {st.name}</label>
                          <Select id={`ex-${st.id}`} value={e?.action ?? ""} className="h-9 sm:w-72"
                            onChange={(ev) => { const v = ev.target.value as ExAction | ""; setException(st.id, v ? { action: v, classId: "" } : null); }}>
                            <option value="">Ikuti kelas tujuan</option>
                            {(Object.keys(EX_LABEL) as ExAction[]).filter((k) => k !== "graduate" || s.grade === null || s.grade >= 6).map((k) => <option key={k} value={k}>{EX_LABEL[k]}</option>)}
                          </Select>
                          {needClass && (
                            <>
                              <label htmlFor={`exc-${st.id}`} className="sr-only">Kelas tujuan {st.name}</label>
                              <Select id={`exc-${st.id}`} value={e.classId} className="h-9 sm:w-40" aria-invalid={!e.classId} onChange={(ev) => setException(st.id, { ...e, classId: ev.target.value })}>
                                <option value="">Pilih kelas</option>
                                {options.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                              </Select>
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        );
      })}

      <section className="card sticky bottom-3 z-10 p-4 shadow-pop" aria-label="Ringkasan rencana">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <p className="tabular text-sm">
            Naik kelas <b>{counts.promote}</b> | Tidak naik <b>{counts.repeat}</b> | Kelas lain <b>{counts.other}</b> | Lulus <b>{counts.graduate}</b> | Pindah sekolah <b>{counts.transfer}</b> | Berhenti <b>{counts.inactive}</b> | Tidak diproses <b>{counts.untouched}</b>
          </p>
          <Button onClick={() => setReview(true)} disabled={incomplete > 0 || nothing}>Periksa rencana</Button>
        </div>
        {incomplete > 0 && <p role="alert" className="mt-2 text-sm font-medium text-danger">{incomplete} siswa memerlukan pilihan kelas tujuan.</p>}
        {unmappedClasses > 0 && <p className="mt-2 text-xs text-ink-muted">{unmappedClasses} kelas belum diberi tujuan dan tidak akan diproses.</p>}
      </section>

      {review && <ReviewDialog plan={plan} fromName={fromYear.name} toName={toYear.name} toYearId={toYear.id} onClose={() => setReview(false)} />}
    </div>
  );
}

function Row({ label, n }: { label: string; n?: number }) {
  return <li className="flex justify-between gap-3"><span>{label}</span><span className="tabular font-semibold">{n ?? 0}</span></li>;
}

function ReviewDialog({ plan, fromName, toName, toYearId, onClose }: { plan: PromotionPlan; fromName: string; toName: string; toYearId: string; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [loading, setLoading] = useState(true);
  const [res, setRes] = useState<PromotionResult | null>(null);
  const [done, setDone] = useState<PromotionResult | null>(null);
  const [word, setWord] = useState("");
  const [parents, setParents] = useState(true);

  // Pemeriksaan dijalankan sekali saat dialog dibuka (rencana tidak berubah selama dialog terbuka).
  useEffect(() => {
    let alive = true;
    previewPromotionAction(plan)
      .then((r) => { if (alive) setRes(r); })
      .catch(() => { if (alive) setRes({ ok: false, message: "Tidak dapat terhubung ke server. Tidak ada data yang diubah." }); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const errors = res?.errors ?? [];
  const ready = !!res?.ok && errors.length === 0 && word === "NAIK";

  function confirm() {
    start(async () => {
      try {
        const r = await executePromotionAction({ ...plan, deactivateParents: parents }, word);
        if (!r.ok) return void toast.error(r.message ?? "Gagal. Tidak ada data yang diubah.");
        toast.success("Kenaikan kelas diproses.");
        setDone(r);
        router.refresh();
      } catch { toast.error("Tidak dapat terhubung ke server. Tidak ada data yang diubah."); }
    });
  }

  if (done) {
    return (
      <Modal open onClose={onClose} title="Kenaikan kelas selesai" description={`${fromName} ke ${toName}`} footer={<><a href={`/classes?year=${toYearId}`} className="inline-flex h-11 items-center rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-[#2b68bd]">Buka daftar kelas {toName}</a><Button variant="outline" onClick={onClose}>Tutup</Button></>}>
        <ul className="space-y-1 text-sm">
          <Row label="Naik kelas" n={done.promoted} /><Row label="Tidak naik kelas" n={done.repeated} /><Row label="Pindah ke kelas lain" n={done.otherClass} />
          <Row label="Lulus" n={done.graduated} /><Row label="Pindah sekolah" n={done.transferred} /><Row label="Berhenti atau nonaktif" n={done.inactive} />
        </ul>
        <p className="mt-4 rounded-lg bg-canvas px-4 py-3 text-sm">Langkah berikutnya: tetapkan wali kelas untuk kelas {toName} di menu Kelas, dan tambahkan siswa baru kelas 1 lewat Impor siswa.</p>
      </Modal>
    );
  }

  return (
    <Modal open onClose={() => !pending && onClose()} title="Periksa dan konfirmasi kenaikan kelas" description={`${fromName} ke ${toName}`}
      footer={<><Button variant="outline" onClick={onClose} disabled={pending}>Batal</Button><Button variant="danger" onClick={confirm} loading={pending} disabled={!ready}>Proses kenaikan kelas</Button></>}>
      <div className="space-y-4 text-sm">
        <div role="alert" className="flex gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-[#8a5a0e]">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">Perhatian: perubahan ini memengaruhi banyak siswa sekaligus.</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px]">
              <li>Penempatan kelas lama ditutup dan tetap tersimpan sebagai riwayat. Tidak ada data yang dihapus.</li>
              <li>Siswa lulus, pindah sekolah, atau berhenti menjadi tidak aktif dan kode QR mereka dicabut.</li>
              <li>Siswa yang tidak diproses tetap di kelas lama.</li>
              <li>Seluruh rencana divalidasi dulu. Bila ada satu masalah, tidak ada yang diubah.</li>
            </ul>
          </div>
        </div>

        {loading && <p className="text-ink-muted" role="status">Memeriksa rencana...</p>}
        {res && !res.ok && <p role="alert" className="font-medium text-danger">{res.message}</p>}
        {res?.ok && (
          <>
            <ul className="space-y-1 rounded-lg bg-canvas px-4 py-3">
              <Row label="Naik kelas" n={res.promoted} /><Row label="Tidak naik kelas" n={res.repeated} /><Row label="Pindah ke kelas lain" n={res.otherClass} />
              <Row label="Lulus" n={res.graduated} /><Row label="Pindah sekolah" n={res.transferred} /><Row label="Berhenti atau nonaktif" n={res.inactive} />
              <Row label="Tidak diproses (tetap di kelas lama)" n={res.untouched} />
              {(res.alreadyPlaced ?? 0) > 0 && <Row label="Sudah ditempatkan di tahun tujuan (dilewati)" n={res.alreadyPlaced} />}
            </ul>
            {errors.length > 0 && (
              <div role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-danger">
                <p className="font-semibold">{errors.length} masalah harus diperbaiki:</p>
                <ul className="mt-1 max-h-40 list-disc space-y-0.5 overflow-y-auto pl-5 text-[13px]">{errors.map((e, i) => <li key={i}><b>{e.student}</b>: {e.message}</li>)}</ul>
              </div>
            )}
            {errors.length === 0 && (
              <>
                <label className="flex items-start gap-2.5">
                  <input type="checkbox" checked={parents} onChange={(e) => setParents(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-line accent-brand" />
                  <span>Nonaktifkan akun orang tua yang semua anaknya lulus, pindah, atau berhenti ({res.parentsToDeactivate} akun). Orang tua yang masih punya anak aktif tidak disentuh.</span>
                </label>
                <div>
                  <label htmlFor="promo-confirm" className="field-label">Ketik <span className="font-mono font-bold">NAIK</span> untuk melanjutkan</label>
                  <Input id="promo-confirm" value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="NAIK" />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}