// Synthetic guitar audio for tests: Karplus-Strong plucks with a seeded random source.
import { PitchDetector } from 'pitchy';
import { rms, toNote } from '../../src/logic/pitch.js';

export const SR = 48000;

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Add one plucked note into buf. */
export function pluck(buf, midi, startS, durS, { seed = 1, gain = 0.5 } = {}) {
  const rand = rng(seed);
  const freq = 440 * 2 ** ((midi - 69) / 12);
  const n = Math.round(SR / freq);
  const delay = new Float32Array(n).map(() => rand() * 2 - 1);
  for (let i = 1; i < n; i++) delay[i] = 0.5 * delay[i] + 0.5 * delay[i - 1];
  const first = Math.round(startS * SR);
  const len = Math.round(durS * SR);
  let idx = 0;
  for (let i = 0; i < len && first + i < buf.length; i++) {
    const next = (idx + 1) % n;
    const v = delay[idx];
    delay[idx] = 0.9965 * 0.5 * (delay[idx] + delay[next]);
    idx = next;
    buf[first + i] += v * gain;
  }
}

/** A downstroke: each note 12 ms after the one below it. */
export function strum(buf, midis, startS, durS = 1.2, seed = 1) {
  [...midis].sort((a, b) => a - b).forEach((m, i) => pluck(buf, m, startS + i * 0.012, durS, { seed: seed + i, gain: 0.35 }));
}

/** Feed a buffer to fn as the engine would: 2048-sample windows every 1024 samples. Returns fn's non-null results. */
export function frames(buf, fn) {
  const detector = PitchDetector.forFloat32Array(2048);
  const out = [];
  for (let end = 2048; end <= buf.length; end += 1024) {
    const win = buf.subarray(end - 2048, end);
    const [hz, clarity] = detector.findPitch(win, SR);
    const level = rms(win);
    const r = fn({
      time: (end - 1024) / SR,
      note: toNote(hz, clarity, level),
      raw: { hz, clarity, rms: level },
      fresh: buf.subarray(end - 1024, end),
      sampleRate: SR,
    });
    if (r) out.push(r);
  }
  return out;
}

/** Strums heard in a buffer. */
export function hearStrums(buf, tracker) {
  return frames(buf, (f) => tracker.push(f));
}
