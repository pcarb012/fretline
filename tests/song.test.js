import { describe, expect, it } from 'vitest';
import { beatSeconds, expectedMidiList, noteTimes, songLengthSeconds, validateSong } from '../src/logic/song.js';
import { calibrationResult, median, medianOffsetMs, spreadMs } from '../src/logic/latency.js';
import { createOnsetTracker } from '../src/logic/onsets.js';
import { createSession } from '../src/logic/session.js';
import { EXERCISES as SONGS } from '../src/songs/index.js';

const tuning = [40, 45, 50, 55, 59, 64];
const mini = {
  id: 't',
  title: 'T',
  bpm: 60,
  tuning,
  notes: [
    { beat: 0, string: 6, fret: 0, durationBeats: 1 },
    { beat: 1, string: 5, fret: 2, durationBeats: 1 },
    { beat: 2, string: 1, fret: 3, durationBeats: 2 },
  ],
};

describe('song mapping', () => {
  it('maps notes to expected MIDI', () => {
    expect(expectedMidiList(mini)).toEqual([40, 47, 67]);
  });
  it('maps beats to seconds with speed', () => {
    expect(beatSeconds(60, 1)).toBe(1);
    expect(beatSeconds(60, 0.5)).toBe(2);
    expect(noteTimes(mini, 0.5)).toEqual([0, 2, 4]);
    expect(songLengthSeconds(mini, 1)).toBe(4);
  });
  it('validates songs', () => {
    expect(validateSong(mini)).toBe(true);
    expect(validateSong({ ...mini, notes: [] })).toBe(false);
    expect(validateSong({ ...mini, tuning: [1, 2] })).toBe(false);
    expect(validateSong({ ...mini, notes: [{ beat: 0, string: 7, fret: 0, durationBeats: 1 }] })).toBe(false);
    expect(validateSong(null)).toBe(false);
  });
  it('ships four valid songs with plausible guitar pitches', () => {
    expect(SONGS).toHaveLength(4);
    for (const s of SONGS) {
      expect(validateSong(s)).toBe(true);
      for (const m of expectedMidiList(s)) expect(m).toBeGreaterThanOrEqual(40);
    }
  });
  it('Ode to Joy starts E E F G (MIDI 64 64 65 67)', () => {
    const ode = SONGS.find((s) => s.id === 'ode-to-joy');
    expect(expectedMidiList(ode).slice(0, 4)).toEqual([64, 64, 65, 67]);
  });
});

describe('latency median', () => {
  it('takes the median of values', () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
  it('finds the median click-to-onset offset in ms', () => {
    const clicks = [1, 2, 3, 4, 5, 6, 7, 8];
    const onsets = clicks.map((c, i) => c + [0.1, 0.12, 0.5, 0.11, 0.09, 0.13, 0.1, 0.1][i]);
    expect(medianOffsetMs(clicks, onsets)).toBeCloseTo(105, 3);
  });
  it('returns null when too few clicks were answered', () => {
    expect(medianOffsetMs([1, 2, 3, 4, 5, 6, 7, 8], [1.1, 2.1])).toBeNull();
  });
  it('ignores onsets far from a click', () => {
    expect(medianOffsetMs([1, 2, 3, 4], [1.9, 5.5, 9])).toBeNull();
  });
});

describe('calibration result', () => {
  const clicks = [1, 2, 3, 4, 5, 6, 7, 8];
  const plucks = (offs) => clicks.map((c, i) => c + offs[i] / 1000);
  it('accepts a steady run', () => {
    const r = calibrationResult(clicks, plucks([100, 110, 90, 105, 95, 100, 120, 100]));
    expect(r.ok).toBe(true);
    expect(r.ms).toBeCloseTo(100, 3);
  });
  it('rejects too few plucks', () => {
    expect(calibrationResult(clicks, [1.1])).toEqual({ ok: false, reason: 'few' });
  });
  it('rejects a median outside -100..400 ms', () => {
    expect(calibrationResult(clicks, plucks(Array(8).fill(-130))).reason).toBe('range');
    expect(calibrationResult(clicks, plucks(Array(8).fill(450))).reason).toBe('range');
  });
  it('rejects scattered offsets', () => {
    const r = calibrationResult(clicks, plucks([0, 300, 20, 280, 10, 290, 30, 270]));
    expect(r).toEqual({ ok: false, reason: 'spread' });
  });
  it('computes spread', () => {
    expect(spreadMs([100, 100, 100])).toBe(0);
    expect(spreadMs([90, 100, 110])).toBe(10);
  });
  it('accepts a median just inside the limit', () => {
    expect(calibrationResult(clicks, plucks(Array(8).fill(399))).ok).toBe(true);
  });
});

describe('onset tracker', () => {
  const note = (midi, rms = 0.1, cents = 0) => ({ midi, midiFloat: midi + cents / 100, rms });
  it('fires on a new note, a far change, and a re-pluck, not on a sustain', () => {
    const t = createOnsetTracker();
    expect(t.push({ time: 0, note: null })).toBeNull();
    expect(t.push({ time: 1, note: note(60) }).time).toBe(1);
    expect(t.push({ time: 2, note: note(60, 0.08) })).toBeNull();
    expect(t.push({ time: 3, note: note(62) }).midi).toBe(62);
    expect(t.push({ time: 4, note: note(62, 0.3) }).time).toBe(4);
    t.push({ time: 5, note: null });
    expect(t.push({ time: 6, note: note(62) }).time).toBe(6);
    t.reset();
    expect(t.push({ time: 7, note: note(62) }).time).toBe(7);
  });
  it('ignores one-frame pitch wobble to a neighbouring note', () => {
    const t = createOnsetTracker();
    t.push({ time: 0, note: note(60, 0.1, 45) });
    expect(t.push({ time: 1, note: note(61, 0.1, -45) })).toBeNull();
    expect(t.push({ time: 2, note: note(60, 0.1, 45) })).toBeNull();
    expect(t.push({ time: 3, note: note(61, 0.1, -45) })).toBeNull();
  });
  it('fires when a close new note holds for two frames, at its first frame', () => {
    const t = createOnsetTracker();
    t.push({ time: 0, note: note(60, 0.1, 45) });
    expect(t.push({ time: 1, note: note(61, 0.1, -45) })).toBeNull();
    expect(t.push({ time: 2, note: note(61, 0.1, -45) })).toMatchObject({ time: 1, midi: 61 });
  });
  it('compares a re-pluck against the quietest recent frame', () => {
    const t = createOnsetTracker();
    t.push({ time: 0, note: note(60, 0.1) });
    t.push({ time: 1, note: note(60, 0.03) });
    t.push({ time: 2, note: note(60, 0.05) });
    expect(t.push({ time: 3, note: note(60, 0.07) }).time).toBe(3);
  });
});

describe('session', () => {
  it('judges on-time correct notes Perfect', () => {
    const s = createSession(mini, 1);
    const r = s.onOnset({ time: 0.02, midiFloat: 40.1 });
    expect(r).toMatchObject({ index: 0, grade: 'perfect' });
  });
  it('accepts the same pitch from any string', () => {
    const s = createSession(mini, 1);
    expect(s.onOnset({ time: 1, midiFloat: 47 }).index).toBe(1);
  });
  it('ignores wrong pitch and stray onsets', () => {
    const s = createSession(mini, 1);
    expect(s.onOnset({ time: 0, midiFloat: 55 })).toBeNull();
    expect(s.onOnset({ time: 0.5, midiFloat: 40 })).toBeNull();
  });
  it('does not judge a note twice', () => {
    const s = createSession(mini, 1);
    s.onOnset({ time: 0, midiFloat: 40 });
    expect(s.onOnset({ time: 0.01, midiFloat: 40 })).toBeNull();
  });
  it('marks overdue notes as misses and summarises', () => {
    const s = createSession(mini, 1);
    s.onOnset({ time: 0, midiFloat: 40 });
    expect(s.tick(0.2)).toEqual([]);
    const missed = s.tick(5);
    expect(missed.map((m) => m.index)).toEqual([1, 2]);
    expect(s.tick(6)).toEqual([]);
    const sum = s.summary();
    expect(sum).toMatchObject({ score: 100, max: 300, stars: 0 });
    expect(sum.counts).toEqual({ perfect: 1, good: 0, miss: 2 });
  });
  it('gives three stars for a clean run', () => {
    const s = createSession(mini, 1);
    s.onOnset({ time: 0, midiFloat: 40 });
    s.onOnset({ time: 1, midiFloat: 47 });
    s.onOnset({ time: 2, midiFloat: 67 });
    expect(s.summary().stars).toBe(3);
  });
});
