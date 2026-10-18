import { useSyncExternalStore } from 'react';

/** אפקטי קול מסונתזים (WebAudio), בלי קבצים. ההשתקה נשמרת ב-localStorage. */

const KEY = 'muted';
const read = (): boolean => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
let muted = read();
const subs = new Set<() => void>();

export const isMuted = () => muted;
export function setMuted(v: boolean) {
  muted = v;
  try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* */ }
  subs.forEach((f) => f());
}
export function useMuted(): boolean {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => muted, () => false);
}

let ctx: AudioContext | null = null;
let noiseBuf: AudioBuffer | null = null;
function ac(): AudioContext | null {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}
// הדפדפן מאפשר קול רק אחרי מגע ראשון
if (typeof window !== 'undefined') window.addEventListener('pointerdown', () => { ac(); }, { once: true, passive: true });

function noise(a: AudioContext): AudioBuffer {
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate * 0.5, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function tone(a: AudioContext, freq: number, at: number, dur: number, gain = 0.12, type: OscillatorType = 'sine', toFreq?: number) {
  const o = a.createOscillator(); const g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, at);
  if (toFreq) o.frequency.exponentialRampToValueAtTime(toFreq, at + dur);
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(gain, at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(a.destination); o.start(at); o.stop(at + dur + 0.02);
}

function swish(a: AudioContext, at: number, dur: number, f0: number, f1: number, gain = 0.18) {
  const s = a.createBufferSource(); s.buffer = noise(a);
  const f = a.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.9;
  f.frequency.setValueAtTime(f0, at); f.frequency.exponentialRampToValueAtTime(f1, at + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(gain, at + dur * 0.25); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  s.connect(f).connect(g).connect(a.destination); s.start(at); s.stop(at + dur + 0.02);
}

function run(fn: (a: AudioContext, t: number) => void) {
  if (muted) return;
  const a = ac();
  if (a && a.state === 'running') fn(a, a.currentTime + 0.01);
}

export const sfx = {
  /** החלקת קלף על השולחן */
  slide: () => run((a, t) => swish(a, t, 0.13, 2600, 900, 0.16)),
  /** ערבוב וחלוקה */
  shuffle: () => run((a, t) => { for (let i = 0; i < 9; i++) swish(a, t + i * 0.09, 0.07, 3200, 1400, 0.1); }),
  /** חיתוך ב-2: סוויש עולה */
  cut: () => run((a, t) => { swish(a, t, 0.32, 500, 5200, 0.26); tone(a, 180, t, 0.25, 0.08, 'sawtooth', 70); }),
  /** דילוג: שני צלילים קצרים יורדים */
  skip: () => run((a, t) => { tone(a, 660, t, 0.09, 0.1, 'square'); tone(a, 440, t + 0.1, 0.12, 0.1, 'square'); }),
  /** רביעייה: ארפג'יו חגיגי */
  four: () => run((a, t) => { [523, 659, 784, 1047].forEach((f, i) => tone(a, f, t + i * 0.08, 0.28, 0.1, 'triangle')); }),
  /** התור שלך: תזכורת עדינה */
  turn: () => run((a, t) => { tone(a, 880, t, 0.1, 0.07); tone(a, 1175, t + 0.11, 0.14, 0.07); }),
  /** ניצחון */
  win: () => run((a, t) => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(a, f, t + i * 0.11, 0.35, 0.09, 'triangle')); }),
};

/** רטט קצר בטלפון (מכבד השתקה) */
export function buzz(ms = 45) {
  if (muted) return;
  try { navigator.vibrate?.(ms); } catch { /* */ }
}
