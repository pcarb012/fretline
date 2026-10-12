import { describe, expect, it } from 'vitest';
import { chroma, fft, normalize, similarity } from '../src/logic/chroma.js';
import {
  CHORD_LIBRARY, calibratedFor, chordGroups, chordMatches, learnChord, nameChord, parseName,
  rankChords, rotate, shapeMidis, templateFor,
} from '../src/logic/chords.js';
import { createSession } from '../src/logic/session.js';
import { createStrumTracker } from '../src/logic/strums.js';
import { SR, hearStrums, strum } from './helpers/synth.js';

const lib = (name) => CHORD_LIBRARY.find((c) => c.name === name);
const expected = (name) => ({ name, midis: shapeMidis(lib(name).shape) });

/** The strum heard when midis are strummed once. */
function hear(midis, seed = 5) {
  const buf = new Float32Array(SR * 2);
  strum(buf, midis, 0.3, 1.2, seed);
  const strums = hearStrums(buf, createStrumTracker());
  expect(strums).toHaveLength(1);
  return strums[0];
}

describe('chroma', () => {
  it('matches a plain DFT', () => {
    const x = [1, 2, 0, -1, 3, 0.5, -2, 1];
    const re = Float64Array.from(x);
    const im = new Float64Array(8);
    fft(re, im);
    for (let k = 0; k < 8; k++) {
      let r = 0;
      let i = 0;
      x.forEach((v, n) => {
        r += v * Math.cos((-2 * Math.PI * k * n) / 8);
        i += v * Math.sin((-2 * Math.PI * k * n) / 8);
      });
      expect(re[k]).toBeCloseTo(r, 9);
      expect(im[k]).toBeCloseTo(i, 9);
    }
  });
  it('puts a 440 Hz tone in the A bin', () => {
    const samples = Float32Array.from({ length: 6144 }, (_, i) => Math.sin((2 * Math.PI * 440 * i) / SR));
    const c = chroma(samples, SR);
    expect(c.indexOf(Math.max(...c))).toBe(9);
  });
  it('normalizes to a centred unit vector, and silence to zeros', () => {
    const v = normalize([1, 2, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(similarity(v, v)).toBeCloseTo(1, 9);
    expect(v.reduce((a, b) => a + b, 0)).toBeCloseTo(0, 9);
    expect(normalize(new Array(12).fill(2))).toEqual(new Array(12).fill(0));
    expect(chroma(new Float32Array(6144), SR)).toEqual(new Array(12).fill(0));
  });
});

describe('chord names and shapes', () => {
  it('parses names and rejects unknown ones', () => {
    expect(parseName('C#m7')).toEqual({ root: 1, suffix: 'm7' });
    expect(parseName('E5')).toEqual({ root: 4, suffix: '5' });
    expect(parseName('H')).toBeNull();
    expect(parseName('Csus4')).toBeNull();
  });
  it('reads shapes low to high, skipping muted strings', () => {
    expect(shapeMidis('x32010')).toEqual([48, 52, 55, 60, 64]);
    expect(shapeMidis('022xxx')).toEqual([40, 47, 52]);
  });
  it('names chords from their notes, root in the bass first', () => {
    for (const c of CHORD_LIBRARY) expect(nameChord(shapeMidis(c.shape))).toBe(c.name);
    expect(nameChord([52, 55, 60])).toBe('C'); // first inversion, still C
    expect(nameChord([60, 61, 62])).toBeNull();
  });
  it('rotates chroma by semitones', () => {
    const c = [1, 0, 0, 0, 0.5, 0, 0, 0.8, 0, 0, 0, 0];
    expect(rotate(c, 2)).toEqual([0, 0, 1, 0, 0, 0, 0.5, 0, 0, 0.8, 0, 0]);
    expect(rotate(c, -1)[11]).toBe(1);
    expect(rotate(rotate(c, 5), 7)).toEqual(c);
  });
});

describe('chordGroups', () => {
  const tuning = [40, 45, 50, 55, 59, 64];
  const note = (beat, string, fret, judge) => ({ beat, string, fret, durationBeats: 1, ...(judge === false ? { judge } : {}) });
  it('finds 3+ string chords and power chords, not other double stops', () => {
    const song = {
      tuning,
      notes: [
        note(0, 5, 3, false), note(0, 4, 2, false), note(0, 3, 0, false), note(0, 2, 1), // C
        note(1, 6, 0, false), note(1, 5, 2), // E5 (E + B)
        note(2, 2, 1, false), note(2, 1, 0), // C + E: a third, a double stop
        note(3, 1, 3),
      ],
    };
    const groups = chordGroups(song);
    expect(groups.map((g) => [g.beat, g.name, g.scored])).toEqual([[0, 'C', 3], [1, 'E5', 5]]);
  });
  it('scores the highest judged note, or nothing when every note is unjudged', () => {
    const song = { tuning, notes: [note(0, 3, 0), note(0, 2, 0), note(0, 1, 0), note(1, 3, 0, false), note(1, 2, 0, false), note(1, 1, 0, false)] };
    expect(chordGroups(song).map((g) => g.scored)).toEqual([2, -1]);
  });
});

describe('hearing chords', () => {
  it('matches every library chord strummed, and not the others', () => {
    for (const want of CHORD_LIBRARY) {
      expect(chordMatches(hear(shapeMidis(want.shape)).chroma, expected(want.name)).ok, want.name).toBe(true);
    }
    const wrong = [['C', 'G'], ['C', 'Am'], ['Am', 'C'], ['E', 'Em'], ['Em', 'E'], ['A', 'Am'], ['D', 'Dm'], ['G', 'Em'], ['E7', 'E']];
    for (const [want, got] of wrong) {
      expect(chordMatches(hear(shapeMidis(lib(got).shape)).chroma, expected(want)).ok, `${got} for ${want}`).toBe(false);
    }
  });
  it('forgives an extra note but not a missing one', () => {
    expect(chordMatches(hear(shapeMidis(lib('E7').shape)).chroma, expected('E')).ok).toBe(true);
    expect(chordMatches(hear(shapeMidis(lib('E').shape)).chroma, expected('E7')).ok).toBe(false);
  });
  it('ranks the strummed chord first', () => {
    for (const name of ['C', 'G', 'D', 'Am', 'B7']) {
      expect(rankChords(hear(shapeMidis(lib(name).shape)).chroma)[0].name).toBe(name);
    }
  });
  it('tells a chord from a single string', () => {
    for (const c of CHORD_LIBRARY) {
      const midis = shapeMidis(c.shape);
      expect(hear(midis).single, c.name).toBe(false);
      expect(hear([midis[0]]).single, `${c.name} root`).toBe(true);
    }
  });
  it('hears each strum of a quick progression once, on time', () => {
    const buf = new Float32Array(SR * 3);
    ['G', 'C', 'D'].forEach((name, i) => strum(buf, shapeMidis(lib(name).shape), 0.3 + i * 0.7, 0.7, i + 1));
    const strums = hearStrums(buf, createStrumTracker());
    expect(strums).toHaveLength(3);
    strums.forEach((s, i) => expect(Math.abs(s.time - (0.3 + i * 0.7))).toBeLessThan(0.03));
    expect(strums.map((s) => rankChords(s.chroma)[0].name)).toEqual(['G', 'C', 'D']);
  });
  it('hears nothing in silence', () => {
    expect(hearStrums(new Float32Array(SR), createStrumTracker())).toEqual([]);
  });
});

describe('calibration', () => {
  const strums = (name, seeds = [1, 2, 3, 4]) => seeds.map((s) => hear(shapeMidis(lib(name).shape), s).chroma);
  it('learns a chord from consistent strums', () => {
    const r = learnChord('G', strums('G'));
    expect(r.ok).toBe(true);
    expect(r.template).toHaveLength(12);
    expect(similarity(normalize(r.template), templateFor('G'))).toBeGreaterThan(0.8);
  });
  it('refuses too few, uneven, or wrong strums', () => {
    expect(learnChord('G', strums('G', [1, 2]))).toEqual({ ok: false, reason: 'few' });
    expect(learnChord('G', [...strums('G', [1, 2]), ...strums('Dm', [3, 4])]).reason).toBe('uneven');
    expect(learnChord('G', strums('C')).reason).toBe('unlike');
  });
  it('uses a calibrated chord, or one of the same kind moved to the root', () => {
    const e5 = learnChord('E5', strums('E5')).template;
    expect(calibratedFor('E5', { E5: e5 })).toBe(e5);
    expect(calibratedFor('G5', { E5: e5 })).toEqual(rotate(e5, 3));
    expect(calibratedFor('G5', {})).toBeNull();
    expect(calibratedFor('Gm', { E5: e5 })).toBeNull();
    expect(templateFor('C', { E5: e5 })).toEqual(templateFor('C'));
  });
  it('still matches the right chord and rejects a wrong one with calibration', () => {
    const calibrated = Object.fromEntries(['C', 'G', 'Am', 'E', 'Em'].map((n) => [n, learnChord(n, strums(n)).template]));
    expect(chordMatches(hear(shapeMidis(lib('C').shape), 9).chroma, expected('C'), calibrated).ok).toBe(true);
    expect(chordMatches(hear(shapeMidis(lib('Am').shape), 9).chroma, expected('C'), calibrated).ok).toBe(false);
    expect(chordMatches(hear(shapeMidis(lib('E').shape), 9).chroma, expected('Em'), calibrated).ok).toBe(false);
  });
});

describe('session with chords', () => {
  const tuning = [40, 45, 50, 55, 59, 64];
  // C at beat 0, a single note at beat 1, G at beat 2; 60 BPM so a beat is one second.
  const shape = (s, beat) => [...s].map((c, i) => [6 - i, c]).filter(([, c]) => c !== 'x')
    .map(([string, c], i, all) => ({ beat, string, fret: Number(c), durationBeats: 1, ...(i === all.length - 1 ? {} : { judge: false }) }));
  const song = { id: 't', bpm: 60, tuning, notes: [...shape('x32010', 0), { beat: 1, string: 1, fret: 3, durationBeats: 1 }, ...shape('320003', 2)] };
  const chordOf = (name) => hear(shapeMidis(lib(name).shape)).chroma;

  it('scores each chord once, on top of the single notes', () => {
    const s = createSession(song);
    expect(s.chords.map((c) => c.name)).toEqual(['C', 'G']);
    expect(s.summary().max).toBe(300);
  });
  it('judges a strummed chord by timing and colours all its notes', () => {
    const s = createSession(song);
    const v = s.onStrum({ time: 0.1, chroma: chordOf('C'), single: false });
    expect(v).toMatchObject({ name: 'C', grade: 'good', label: 'Late' });
    const cNotes = song.notes.map((n, i) => i).filter((i) => song.notes[i].beat === 0);
    expect(cNotes.every((i) => s.results[i].grade === 'good')).toBe(true);
  });
  it('ignores a wrong chord, a single note, or a strum out of time', () => {
    const s = createSession(song);
    expect(s.onStrum({ time: 0, chroma: chordOf('G'), single: false })).toBeNull();
    expect(s.onStrum({ time: 0, chroma: chordOf('C'), single: true })).toBeNull();
    expect(s.onStrum({ time: 0.5, chroma: chordOf('C'), single: false })).toBeNull();
    // The single-note detector cannot score a chord either.
    expect(s.onOnset({ time: 0, midiFloat: 64 })).toBeNull();
  });
  it('turns an unplayed chord into one miss covering its notes', () => {
    const s = createSession(song);
    s.onStrum({ time: 0, chroma: chordOf('C'), single: false });
    s.onOnset({ time: 1, midiFloat: 67 });
    const missed = s.tick(3);
    expect(missed).toHaveLength(1);
    expect(song.notes.every((n, i) => n.beat !== 2 || s.results[i].grade === 'miss')).toBe(true);
    expect(s.summary()).toMatchObject({ score: 200, max: 300, counts: { perfect: 2, good: 0, miss: 1 } });
  });
});
