"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Camera, CameraOff, CheckCircle2, ClipboardList, FlipHorizontal, History, Search, ShieldCheck, UserSearch, WifiOff, XCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { lookupQrAction, recordAttendanceAction, searchStudentsAction, type StudentHit } from "@/app/(app)/attendance/actions";
import { RESULT_MESSAGE, type RpcResult } from "@/lib/validation/attendance";
import { cn } from "@/lib/utils";

type Summary = { total: number; present: number; late: number; sick: number; permission: number; official: number; unexcused: number; unverified: number; unrecorded: number };
type Phase = "idle" | "starting" | "scanning" | "confirm" | "saving";
type CamIssue = null | "unsupported" | "denied" | "nodevice" | "failed";
type LogItem = { id: number; ok: boolean; text: string; time: string };

const CAM_TEXT: Record<Exclude<CamIssue, null>, string> = {
  unsupported: "Peramban ini tidak mendukung kamera, atau halaman tidak dibuka lewat HTTPS. Gunakan pencarian manual di bawah.",
  denied: "Izin kamera ditolak. Aktifkan izin kamera untuk situs ini pada pengaturan peramban, lalu tekan Mulai pemindai lagi. Sementara itu gunakan pencarian manual.",
  nodevice: "Kamera tidak ditemukan pada perangkat ini. Gunakan pencarian manual.",
  failed: "Kamera tidak dapat dimulai. Tutup aplikasi lain yang memakai kamera, lalu coba lagi.",
};

export function Scanner({ summary, isAdmin, dateLabel, scanAllowed, autoRecord = false }: { summary: Summary; isAdmin: boolean; dateLabel: string; scanAllowed: boolean; autoRecord?: boolean }) {
  const router = useRouter();
  // Kamera depan atau webcam laptop ditampilkan seperti cermin, supaya gerakan di layar searah dengan gerakan tangan.
  const [mirror, setMirror] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const busyRef = useRef(false);
  const lastRef = useRef<{ token: string; at: number }>({ token: "", at: 0 });
  const logId = useRef(0);

  const [phase, setPhase] = useState<Phase>("idle");
  const [camIssue, setCamIssue] = useState<CamIssue>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState<{ token: string; student: RpcResult } | null>(null);
  const [banner, setBanner] = useState<{ tone: "success" | "warning" | "danger"; text: string } | null>(null);
  const [log, setLog] = useState<LogItem[]>([]);

  // Manual
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<StudentHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<StudentHit | null>(null);
  const [mStatus, setMStatus] = useState("present");
  const [mNote, setMNote] = useState("");
  const [mBusy, setMBusy] = useState(false);

  const addLog = useCallback((ok: boolean, text: string) => {
    logId.current += 1;
    const time = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLog((l) => [{ id: logId.current, ok, text, time }, ...l].slice(0, 8));
  }, []);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);

  const stopScanner = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    busyRef.current = false;
    setPhase("idle");
  }, []);

  useEffect(() => () => { controlsRef.current?.stop(); }, []);

  const recordQr = useCallback(async (token: string, student: RpcResult, direct = false) => {
    if (!student.student_id) return;
    if (!direct) setPhase("saving");
    try {
      const r = await recordAttendanceAction({ source: "qr", student_id: student.student_id, token });
      if (r.result === "recorded") {
        const label = r.status === "late" ? "Terlambat" : "Hadir";
        setBanner({ tone: "success", text: `${r.full_name ?? student.full_name} tercatat ${label}.` });
        addLog(true, `${r.full_name ?? student.full_name}: ${label}`);
        navigator.vibrate?.(60);
        router.refresh();
      } else {
        const text = r.message ?? RESULT_MESSAGE[r.result] ?? "Absensi tidak tercatat.";
        setBanner({ tone: r.result === "duplicate" ? "warning" : "danger", text });
        addLog(false, text);
      }
    } catch {
      setBanner({ tone: "danger", text: "Gagal terhubung ke server. Absensi BELUM tersimpan. Pindai ulang setelah koneksi pulih." });
      addLog(false, "Gagal menyimpan (koneksi)");
    }
    setPending(null);
    setPhase("scanning");
    setTimeout(() => { busyRef.current = false; }, 1200);
  }, [addLog, router]);

  const handleToken = useCallback(async (token: string) => {
    const now = Date.now();
    if (busyRef.current) return;
    if (lastRef.current.token === token && now - lastRef.current.at < 4000) return;
    lastRef.current = { token, at: now };
    busyRef.current = true;
    setBanner(null);
    try {
      const r = await lookupQrAction(token);
      if (r.result === "ok" && autoRecord && r.student_id) {
        // Mode cepat (diatur admin): tanpa konfirmasi visual, langsung dicatat.
        await recordQr(token, r, true);
        return;
      }
      if (r.result === "ok") {
        setPending({ token, student: r });
        setPhase("confirm");
        return; // busyRef tetap true sampai operator memutuskan
      }
      const text = r.message ?? RESULT_MESSAGE[r.result] ?? "QR tidak dapat diproses.";
      if (r.result === "duplicate") {
        setBanner({ tone: "warning", text: `${r.full_name ?? "Siswa"} sudah tercatat hari ini sebagai ${r.existing_status ?? "-"}. Tidak dicatat ulang.` });
        addLog(false, `Scan ganda: ${r.full_name ?? "siswa"}`);
      } else {
        setBanner({ tone: "danger", text });
        addLog(false, text);
      }
      navigator.vibrate?.(150);
    } catch {
      setBanner({ tone: "danger", text: "Gagal terhubung ke server. Data BELUM tersimpan. Periksa koneksi internet." });
      addLog(false, "Gagal terhubung ke server");
    }
    setTimeout(() => { busyRef.current = false; }, 1200);
  }, [addLog, autoRecord, recordQr]);

  const handleRef = useRef(handleToken);
  useEffect(() => { handleRef.current = handleToken; }, [handleToken]);

  async function startScanner(chosen?: string) {
    setCamIssue(null);
    setBanner(null);
    if (!navigator.mediaDevices?.getUserMedia) return setCamIssue("unsupported");
    if (!videoRef.current) return;
    setPhase("starting");
    try {
      controlsRef.current?.stop();
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const devices = await BrowserQRCodeReader.listVideoInputDevices();
      if (devices.length === 0) { setPhase("idle"); return setCamIssue("nodevice"); }
      setCameras(devices.map((d, i) => ({ id: d.deviceId, label: d.label || `Kamera ${i + 1}` })));
      const back = devices.find((d) => /back|rear|belakang|environment/i.test(d.label));
      const use = chosen || deviceId || back?.deviceId || devices[devices.length - 1].deviceId;
      setDeviceId(use);
      setMirror(!/back|rear|belakang|environment/i.test(devices.find((d) => d.deviceId === use)?.label ?? ""));
      const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 150 });
      controlsRef.current = await reader.decodeFromVideoDevice(use, videoRef.current, (result) => {
        if (result) void handleRef.current(result.getText());
      });
      busyRef.current = false;
      setPhase("scanning");
    } catch (err) {
      setPhase("idle");
      const name = err instanceof Error ? err.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") setCamIssue("denied");
      else if (name === "NotFoundError" || name === "OverconstrainedError") setCamIssue("nodevice");
      else setCamIssue("failed");
    }
  }

  function confirmQr() {
    if (pending) void recordQr(pending.token, pending.student);
  }

  function cancelQr() {
    setPending(null);
    setPhase("scanning");
    setBanner({ tone: "warning", text: "Dibatalkan. Tidak ada data yang dicatat." });
    setTimeout(() => { busyRef.current = false; }, 800);
  }

  // Pencarian manual dengan jeda ketik
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try { setHits(await searchStudentsAction(q)); } catch { setHits([]); } finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  async function saveManual() {
    if (!picked) return;
    setMBusy(true);
    try {
      const r = await recordAttendanceAction({ source: "manual", student_id: picked.id, status: mStatus, note: mNote });
      if (r.result === "recorded") {
        setBanner({ tone: "success", text: `${picked.name} tercatat secara manual.` });
        addLog(true, `${picked.name}: manual (${mStatus})`);
        setPicked(null); setQ(""); setHits([]); setMNote(""); setMStatus("present");
        router.refresh();
      } else {
        const text = r.message ?? RESULT_MESSAGE[r.result] ?? "Absensi tidak tercatat.";
        setBanner({ tone: r.result === "duplicate" ? "warning" : "danger", text });
        addLog(false, text);
      }
    } catch {
      setBanner({ tone: "danger", text: "Gagal terhubung ke server. Absensi BELUM tersimpan." });
    } finally { setMBusy(false); }
  }

  const bannerStyle = {
    success: "border-success/20 bg-success/10 text-success",
    warning: "border-warning/30 bg-warning/10 text-[#8a5a0e]",
    danger: "border-danger/20 bg-danger/10 text-danger",
  } as const;
  const BannerIcon = banner?.tone === "success" ? CheckCircle2 : banner?.tone === "warning" ? AlertTriangle : XCircle;
  const scanning = phase === "scanning" || phase === "confirm" || phase === "saving";
  const recorded = Math.max(0, summary.total - summary.unrecorded);
  const recordedPct = summary.total > 0 ? Math.round((recorded / summary.total) * 100) : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        {!online && (
          <div role="alert" className="flex items-start gap-3 rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p><strong>Tidak ada koneksi internet.</strong> Absensi tidak dapat disimpan. Jangan anggap siswa sudah tercatat; gunakan prosedur absensi manual (daftar kertas) lalu input setelah koneksi pulih.</p>
          </div>
        )}
        {!scanAllowed && (
          <p role="status" className="rounded-lg border border-info/20 bg-info/10 px-4 py-3 text-sm text-info">Hari ini bukan hari sekolah menurut kalender. Pencatatan absensi akan ditolak.</p>
        )}

        <section className="card overflow-hidden">
          <div className="scanner-stage relative overflow-hidden aspect-[3/4] w-full bg-navy sm:aspect-video">
            <video ref={videoRef} className={cn("h-full w-full object-cover", !scanning && "hidden", mirror && "[transform:scaleX(-1)]")} playsInline muted aria-label="Pratinjau kamera pemindai" />
            <div className="absolute left-3 top-3 flex flex-wrap gap-2 text-xs font-medium">
              <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 backdrop-blur", phase === "scanning" ? "bg-success/90 text-white" : "bg-black/45 text-white")}>
                <span aria-hidden className={cn("h-2 w-2 rounded-full", phase === "scanning" ? "scan-pulse bg-white" : "bg-white/60")} />
                {phase === "scanning" ? "Pemindai aktif" : phase === "confirm" || phase === "saving" ? "Menunggu konfirmasi" : phase === "starting" ? "Memulai kamera" : "Pemindai siap"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-white backdrop-blur">
                {autoRecord ? <Zap className="h-3.5 w-3.5 text-[#F5B82E]" aria-hidden /> : <ShieldCheck className="h-3.5 w-3.5" aria-hidden />}
                {autoRecord ? "Mode cepat" : "Dengan konfirmasi"}
              </span>
            </div>
            {scanning && phase === "scanning" && (
              <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative h-3/5 max-h-72 w-3/5 max-w-72 shadow-[0_0_0_9999px_rgba(10,22,40,0.55)]">
                  <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-2xl border-l-4 border-t-4 border-[#F5B82E]" />
                  <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-2xl border-r-4 border-t-4 border-[#F5B82E]" />
                  <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-2xl border-b-4 border-l-4 border-[#F5B82E]" />
                  <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-2xl border-b-4 border-r-4 border-[#F5B82E]" />
                  <span className="scan-line absolute inset-x-3 top-0 h-0.5 rounded-full bg-[#F5B82E]/90" />
                </div>
              </div>
            )}
            {!scanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center text-white">
                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 ring-8 ring-white/5">
                  {camIssue ? <CameraOff className="h-9 w-9" aria-hidden /> : <Camera className="h-9 w-9" aria-hidden />}
                </span>
                <p className="max-w-sm text-sm leading-relaxed text-white/80">{camIssue ? CAM_TEXT[camIssue] : phase === "starting" ? "Memulai kamera. Setujui permintaan izin kamera bila muncul." : "Tekan Mulai pemindai lalu arahkan kamera ke kartu QR siswa."}</p>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3 border-t border-line bg-surface p-4 sm:flex-row sm:items-end">
            {!scanning ? (
              <Button size="lg" onClick={() => startScanner()} loading={phase === "starting"} disabled={!online}><Camera className="h-5 w-5" aria-hidden />Mulai pemindai</Button>
            ) : (
              <>
                <Button size="lg" variant="outline" onClick={stopScanner}>Hentikan pemindai</Button>
                <Button size="lg" variant="ghost" onClick={() => setMirror((m) => !m)} aria-pressed={mirror}><FlipHorizontal className="h-5 w-5" aria-hidden />Balik tampilan</Button>
              </>
            )}
            {cameras.length > 1 && (
              <div className="flex-1">
                <label htmlFor="camera" className="sr-only">Pilih kamera</label>
                <Select id="camera" value={deviceId} onChange={(e) => { setDeviceId(e.target.value); if (scanning) void startScanner(e.target.value); }}>
                  {cameras.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </Select>
              </div>
            )}
          </div>
        </section>

        {banner && (
          <div role="status" aria-live="polite" className={cn("flex items-start gap-3 rounded-xl border px-4 py-3.5 text-base font-semibold shadow-card", bannerStyle[banner.tone])}>
            <BannerIcon className="mt-0.5 h-6 w-6 shrink-0" aria-hidden />
            <p>{banner.text}</p>
          </div>
        )}

        {pending && (
          <section className="card overflow-hidden border-brand ring-2 ring-brand/20" aria-live="polite">
            <div className="flex items-center gap-2 bg-brand-light px-5 py-2.5 text-sm font-medium text-brand">
              <ShieldCheck className="h-4 w-4" aria-hidden />Konfirmasi identitas siswa
            </div>
            <div className="flex items-start gap-4 p-5">
              <span aria-hidden className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-navy text-xl font-semibold text-white">
                {(pending.student.full_name ?? "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-2xl font-semibold leading-tight tracking-tight">{pending.student.full_name}</p>
                <p className="mt-1 flex flex-wrap gap-2 text-sm">
                  <span className="tabular rounded-full bg-canvas px-2.5 py-0.5 text-ink-muted">NIS {pending.student.nis}</span>
                  {pending.student.class_name && <span className="rounded-full bg-canvas px-2.5 py-0.5 text-ink-muted">Kelas {pending.student.class_name}</span>}
                </p>
                <p className="mt-3 rounded-lg bg-canvas px-3 py-2 text-sm">Pastikan siswa yang berdiri di depan Anda adalah siswa ini. QR saja bukan bukti kehadiran.</p>
              </div>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-line bg-canvas/50 px-5 py-4 sm:flex-row sm:justify-end">
              <Button variant="outline" size="lg" onClick={cancelQr} disabled={phase === "saving"}>Bukan siswa ini / batal</Button>
              <Button size="lg" onClick={confirmQr} loading={phase === "saving"}>Konfirmasi hadir</Button>
            </div>
          </section>
        )}

        <section className="card p-5">
          <h2 className="flex items-center gap-2.5 text-base font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-light text-brand"><UserSearch className="h-4 w-4" aria-hidden /></span>
            Absensi manual
          </h2>
          <p className="mb-4 mt-1 text-sm text-ink-muted">Untuk QR rusak/hilang atau kondisi khusus. Catatan alasan wajib dan tercatat atas nama Anda.</p>
          <Field label="Cari nama atau NIS" htmlFor="manual-q">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
              <Input id="manual-q" value={q} onChange={(e) => { setQ(e.target.value); setPicked(null); }} className="pl-9" placeholder="Ketik minimal 2 huruf" autoComplete="off" />
            </div>
          </Field>
          {searching && <p className="mt-2 text-xs text-ink-muted">Mencari</p>}
          {!picked && hits.length > 0 && (
            <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
              {hits.map((h) => (
                <li key={h.id}>
                  <button type="button" onClick={() => setPicked(h)} className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-2 text-left hover:bg-canvas">
                    <span className="text-sm font-medium">{h.name}</span>
                    <span className="tabular text-xs text-ink-muted">{h.nis}{h.className ? ` | ${h.className}` : ""}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!picked && !searching && q.trim().length >= 2 && hits.length === 0 && <p className="mt-2 text-sm text-ink-muted">Tidak ada siswa yang cocok.</p>}
          {picked && (
            <div className="mt-4 space-y-4 rounded-lg border border-line p-4">
              <p className="text-sm"><span className="font-semibold">{picked.name}</span> <span className="tabular text-ink-muted">| NIS {picked.nis}{picked.className ? ` | ${picked.className}` : ""}</span></p>
              <Field label="Status" htmlFor="m-status">
                <Select id="m-status" value={mStatus} onChange={(e) => setMStatus(e.target.value)}>
                  <option value="present">Hadir</option>
                  <option value="late">Terlambat</option>
                  {isAdmin && <><option value="sick">Sakit</option><option value="permission">Izin</option><option value="unexcused">Alpa</option></>}
                </Select>
              </Field>
              <Field label="Alasan pencatatan manual" htmlFor="m-note" required>
                <Textarea id="m-note" value={mNote} onChange={(e) => setMNote(e.target.value)} placeholder="Contoh: kartu QR hilang, identitas dipastikan wali kelas" maxLength={500} />
              </Field>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={() => setPicked(null)} disabled={mBusy}>Ganti siswa</Button>
                <Button onClick={saveManual} loading={mBusy} disabled={mNote.trim().length < 3 || !online}>Catat manual</Button>
              </div>
            </div>
          )}
        </section>
      </div>

      <aside className="space-y-4 lg:col-span-2">
        <section className="card overflow-hidden">
          <div className="dash-hero p-5 text-white">
            <h2 className="flex items-center gap-2 text-base font-semibold"><ClipboardList className="h-4 w-4" aria-hidden />Ringkasan hari ini</h2>
            <p className="mt-0.5 text-sm text-white/70">{dateLabel}</p>
            <p className="tabular mt-4 text-3xl font-bold leading-none">{recorded}<span className="text-lg font-medium text-white/70"> dari {summary.total}</span></p>
            <p className="mt-1 text-xs text-white/70">siswa sudah tercatat ({recordedPct}%)</p>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuemin={0} aria-valuemax={summary.total} aria-valuenow={recorded} aria-label="Siswa yang sudah tercatat">
              <div className="h-full rounded-full bg-[#F5B82E]" style={{ width: `${recordedPct}%` }} />
            </div>
          </div>
          <div className="p-5">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {([
                ["Hadir", summary.present, "bg-success"], ["Terlambat", summary.late, "bg-warning"], ["Sakit", summary.sick, "bg-info"], ["Izin", summary.permission, "bg-info"],
                ["Kegiatan resmi", summary.official, "bg-ink-muted"], ["Alpa", summary.unexcused, "bg-danger"], ["Belum diverifikasi", summary.unverified, "bg-ink-muted"], ["Siswa aktif", summary.total, "bg-brand"],
              ] as const).map(([k, v, dot]) => (
                <div key={k} className="rounded-lg bg-canvas px-3 py-2.5">
                  <dt className="flex items-center gap-1.5 text-xs text-ink-muted"><span aria-hidden className={cn("h-2 w-2 rounded-full", dot)} />{k}</dt>
                  <dd className="tabular text-xl font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="tabular mt-3 text-sm text-ink-muted">{summary.unrecorded} siswa belum memiliki catatan. Siswa tanpa catatan tidak otomatis dianggap alpa sebelum rekonsiliasi.</p>
          </div>
        </section>

        <section className="card">
          <div className="border-b border-line px-5 py-4">
            <h2 className="flex items-center gap-2.5 text-base font-semibold">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-light text-brand"><History className="h-4 w-4" aria-hidden /></span>
              Aktivitas sesi ini
            </h2>
          </div>
          {log.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-muted">Belum ada pemindaian pada sesi ini.</p>
          ) : (
            <ul className="divide-y divide-line">
              {log.map((l) => (
                <li key={l.id} className="flex items-start gap-2.5 px-5 py-3 text-sm">
                  {l.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-label="Berhasil" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-label="Tidak tercatat" />}
                  <span className="flex-1">{l.text}</span>
                  <span className="tabular shrink-0 text-xs text-ink-muted">{l.time}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}