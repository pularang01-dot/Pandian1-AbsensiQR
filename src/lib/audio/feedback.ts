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

type Note = { f: number; at: number; dur: number; vol: number; kind: "bell" | "buzz" };

// "Tring": dua pukulan lonceng tinggi beruntun. Peringatan: dua dentingan lebih rendah. Gagal: dengung rendah.
const CUES: Record<Cue, Note[]> = {
  success: [{ f: 1760, at: 0, dur: 1.0, vol: 0.9, kind: "bell" }, { f: 2349, at: 0.13, dur: 1.2, vol: 0.9, kind: "bell" }],
  warning: [{ f: 988, at: 0, dur: 0.5, vol: 0.85, kind: "bell" }, { f: 988, at: 0.22, dur: 0.6, vol: 0.85, kind: "bell" }],
  error: [{ f: 200, at: 0, dur: 0.5, vol: 0.6, kind: "buzz" }],
};

// Nada lonceng terdiri dari beberapa nada atas yang tidak selaras, itulah yang membuatnya berdenting.
const BELL_PARTIALS: [number, number][] = [[1, 1], [2.01, 0.55], [2.76, 0.4], [5.4, 0.22]];

let master: GainNode | null = null;
function output(c: AudioContext): AudioNode {
  if (!master) {
    const comp = c.createDynamicsCompressor();
    master = c.createGain();
    master.gain.value = 1;
    master.connect(comp).connect(c.destination);
  }
  return master;
}

export function playCue(kind: Cue) {
  const c = context();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  const out = output(c);
  const t0 = c.currentTime;
  for (const n of CUES[kind]) {
    const start = t0 + n.at;
    const parts: [number, number][] = n.kind === "bell" ? BELL_PARTIALS : [[1, 1]];
    const total = parts.reduce((a, [, amp]) => a + amp, 0);
    for (const [ratio, amp] of parts) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = n.kind === "bell" ? "sine" : "sawtooth";
      osc.frequency.value = n.f * ratio;
      // Nada atas padam lebih cepat daripada nada dasar, seperti lonceng sungguhan.
      const life = n.dur / (n.kind === "bell" ? Math.max(1, ratio * 0.6) : 1);
      const peak = (n.vol * amp) / total;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + life);
      osc.connect(gain).connect(out);
      osc.start(start);
      osc.stop(start + life + 0.03);
    }
  }
}