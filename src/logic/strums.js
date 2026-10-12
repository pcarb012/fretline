import { chroma } from './chroma.js';

const RISE_RATIO = 1.8;
const HISTORY = 3;
const GATE = 0.01;
// A strum sweeps the strings over tens of milliseconds; ignore new rises inside it.
const REFRACTORY_S = 0.15;
const LISTEN_S = 0.13;
// One string is a clean periodic tone the pitch detector locks onto; a chord is not.
// Above this share of clear-pitch frames a "strum" was really one note.
const SINGLE_NOTE_SHARE = 0.85;

/**
 * Turns analysis frames into strums: a jump in level, then the chroma of the next ~130 ms.
 * push({ time, raw: { rms }, note, fresh, sampleRate }) returns { time, chroma, single }
 * once a strum's listening window is full, otherwise null. single is true when it was one
 * string, not a chord: a lone root note carries its chord's fifth and third as overtones,
 * so its chroma alone can pass for the chord.
 */
export function createStrumTracker({ gate = GATE } = {}) {
  let levels = [];
  let lastOnset = -Infinity;
  let open = null;

  function finish() {
    const done = open;
    open = null;
    const samples = new Float32Array(done.chunks.reduce((n, c) => n + c.length, 0));
    let at = 0;
    for (const c of done.chunks) {
      samples.set(c, at);
      at += c.length;
    }
    const single = done.pitched / done.frames >= SINGLE_NOTE_SHARE;
    return { time: done.time, chroma: chroma(samples, done.sampleRate), single };
  }

  return {
    push({ time, raw, note, fresh, sampleRate }) {
      const level = raw.rms;
      const quietest = levels.length ? Math.min(...levels) : 0;
      levels = [...levels, level].slice(-HISTORY);
      const rise = level > gate && level > quietest * RISE_RATIO && time - lastOnset >= REFRACTORY_S;
      let out = null;
      if (rise) {
        if (open) out = finish();
        lastOnset = time;
        open = { time, sampleRate, chunks: [], length: 0, frames: 0, pitched: 0 };
      }
      if (!open) return out;
      open.chunks.push(fresh);
      open.length += fresh.length;
      open.frames += 1;
      if (note) open.pitched += 1;
      if (!out && open.length >= LISTEN_S * sampleRate) out = finish();
      return out;
    },
    reset() {
      levels = [];
      lastOnset = -Infinity;
      open = null;
    },
  };
}
