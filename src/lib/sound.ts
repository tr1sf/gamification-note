import { createSignal } from "solid-js";

/**
 * TavernoteX Sound Effects System
 * Uses Web Audio API to synthesize sounds — no audio files needed.
 * All sounds are short, pleasant chimes that fit the medieval tavern theme.
 */

const [soundEnabled, setSoundEnabled] = createSignal(true);

export { soundEnabled, setSoundEnabled };

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

interface ToneOpts {
  freq: number;
  duration: number;
  type?: OscillatorType;
  volume?: number;
  delay?: number;
}

function playTone({ freq, duration, type = "sine", volume = 0.15, delay = 0 }: ToneOpts) {
  const ctx = getCtx();
  if (!ctx) return;

  const startTime = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

function playChord(freqs: number[], duration: number, type: OscillatorType = "sine", volume = 0.12) {
  for (const freq of freqs) {
    playTone({ freq, duration, type, volume });
  }
}

// ── Sound presets ──

const SOUNDS = {
  /** Soft coin ding — note create, coin gain */
  coin() {
    playTone({ freq: 988, duration: 0.12, type: "sine", volume: 0.1 });
    playTone({ freq: 1319, duration: 0.15, type: "sine", volume: 0.08, delay: 0.05 });
  },

  /** Rising chime — XP gain */
  xp() {
    playTone({ freq: 523, duration: 0.08, type: "triangle", volume: 0.12 });
    playTone({ freq: 659, duration: 0.08, type: "triangle", volume: 0.12, delay: 0.06 });
    playTone({ freq: 784, duration: 0.12, type: "triangle", volume: 0.12, delay: 0.12 });
  },

  /** Triumphant fanfare — level up */
  levelUp() {
    playChord([523, 659, 784], 0.15, "triangle", 0.1);
    playChord([587, 740, 880], 0.15, "triangle", 0.1, );
    playTone({ freq: 523, duration: 0.12, type: "triangle", volume: 0.12, delay: 0 });
    playTone({ freq: 659, duration: 0.12, type: "triangle", volume: 0.12, delay: 0.12 });
    playTone({ freq: 784, duration: 0.12, type: "triangle", volume: 0.12, delay: 0.24 });
    playTone({ freq: 1047, duration: 0.3, type: "triangle", volume: 0.15, delay: 0.36 });
  },

  /** Quest complete — satisfying chime */
  quest() {
    playTone({ freq: 659, duration: 0.1, type: "sine", volume: 0.12 });
    playTone({ freq: 880, duration: 0.15, type: "sine", volume: 0.12, delay: 0.08 });
    playTone({ freq: 1047, duration: 0.2, type: "sine", volume: 0.1, delay: 0.16 });
  },

  /** Achievement unlock — bright arpeggio */
  achievement() {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((f, i) => {
      playTone({ freq: f, duration: 0.1, type: "triangle", volume: 0.1, delay: i * 0.05 });
    });
    playTone({ freq: 1568, duration: 0.3, type: "triangle", volume: 0.12, delay: 0.28 });
  },

  /** Boss hit — heavy thud */
  bossHit() {
    playTone({ freq: 150, duration: 0.15, type: "sawtooth", volume: 0.15 });
    playTone({ freq: 100, duration: 0.2, type: "sawtooth", volume: 0.1, delay: 0.02 });
  },

  /** Boss defeated — victory fanfare */
  bossDefeat() {
    playTone({ freq: 392, duration: 0.12, type: "triangle", volume: 0.12 });
    playTone({ freq: 523, duration: 0.12, type: "triangle", volume: 0.12, delay: 0.1 });
    playTone({ freq: 659, duration: 0.12, type: "triangle", volume: 0.12, delay: 0.2 });
    playChord([523, 659, 784, 1047], 0.4, "triangle", 0.1);
    playTone({ freq: 1047, duration: 0.5, type: "triangle", volume: 0.15, delay: 0.3 });
  },

  /** Error — soft descending tone */
  error() {
    playTone({ freq: 440, duration: 0.1, type: "sine", volume: 0.08 });
    playTone({ freq: 330, duration: 0.15, type: "sine", volume: 0.08, delay: 0.08 });
  },

  /** Quiz correct — pleasant ding */
  quizCorrect() {
    playTone({ freq: 784, duration: 0.1, type: "sine", volume: 0.1 });
    playTone({ freq: 1047, duration: 0.12, type: "sine", volume: 0.1, delay: 0.06 });
  },

  /** Quiz wrong — gentle buzz */
  quizWrong() {
    playTone({ freq: 220, duration: 0.15, type: "sawtooth", volume: 0.08 });
  },
};

export type SoundName = keyof typeof SOUNDS;

export function playSound(name: SoundName) {
  if (!soundEnabled()) return;
  try {
    SOUNDS[name]();
  } catch {
    // Audio context not available — silent fallback
  }
}

/** Initialize sound preference from localStorage */
export function initSoundPref() {
  if (typeof localStorage === "undefined") return;
  const stored = localStorage.getItem("soundEnabled");
  if (stored !== null) {
    setSoundEnabled(stored === "true");
  }
}

/** Toggle sound on/off, persist to localStorage */
export function toggleSound(): boolean {
  const next = !soundEnabled();
  setSoundEnabled(next);
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("soundEnabled", String(next));
  }
  return next;
}
