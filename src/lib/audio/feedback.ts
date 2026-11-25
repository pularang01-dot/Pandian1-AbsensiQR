/** Suara penanda absensi, dibuat langsung oleh peramban (tanpa berkas audio). */
export type Cue = "success" | "warning" | "error";

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

/** Panggil dari ketukan pengguna agar peramban mengizinkan suara. */
export function primeAudio() {
  const c = context();
  if (c && c.state === "suspended") void c.resume();
}

type Note = { f: number; at: number; dur: number; type: OscillatorType; vol: number };
const CUES: Record<Cue, Note[]> = {
  // Dua nada naik: tercatat.
  success: [{ f: 880, at: 0, dur: 0.11, type: "sine", vol: 0.28 }, { f: 1319, at: 0.1, dur: 0.18, type: "sine", vol: 0.28 }],
  // Dua nada sama yang pendek: sudah tercatat atau perlu perhatian.
  warning: [{ f: 600, at: 0, dur: 0.1, type: "triangle", vol: 0.3 }, { f: 600, at: 0.16, dur: 0.1, type: "triangle", vol: 0.3 }],
  // Satu nada rendah panjang: gagal.
  error: [{ f: 190, at: 0, dur: 0.38, type: "sawtooth", vol: 0.2 }],
};

export function playCue(kind: Cue) {
  const c = context();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  const t0 = c.currentTime;
  for (const n of CUES[kind]) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = n.type;
    osc.frequency.value = n.f;
    const start = t0 + n.at;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(n.vol, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + n.dur);
    osc.connect(gain).connect(c.destination);
    osc.start(start);
    osc.stop(start + n.dur + 0.02);
  }
}