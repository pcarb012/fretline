import { describe, expect, it } from 'vitest';
import { createSession } from '../src/logic/session.js';
import { isJudged, judgedCount, validateSong } from '../src/logic/song.js';
import { isUnlocked } from '../src/logic/unlock.js';

const tuning = [40, 45, 50, 55, 59, 64];
const song = {
  id: 't',
  title: 'T',
  bpm: 60,
  tuning,
  sections: [{ beat: 0, name: 'Intro' }],
  notes: [
    { beat: 0, string: 6, fret: 0, durationBeats: 1 },
    { beat: 0, string: 5, fret: 0, durationBeats: 1, judge: false },
    { beat: 1, string: 4, fret: 0, durationBeats: 1, judge: false },
    { beat: 2, string: 3, fret: 0, durationBeats: 1 },
  ],
};

describe('judge flag', () => {
  it('treats notes as judged unless judge is false', () => {
    expect(isJudged(song.notes[0])).toBe(true);
    expect(isJudged(song.notes[1])).toBe(false);
    expect(judgedCount(song)).toBe(2);
  });
  it('validates judge and sections', () => {
    expect(validateSong(song)).toBe(true);
    expect(validateSong({ ...song, notes: [{ ...song.notes[0], judge: 'no' }] })).toBe(false);
    expect(validateSong({ ...song, notes: song.notes.map((n) => ({ ...n, judge: false })) })).toBe(false);
    expect(validateSong({ ...song, sections: [{ beat: -1, name: 'x' }] })).toBe(false);
    expect(validateSong({ ...song, sections: [{ beat: 0 }] })).toBe(false);
    expect(validateSong({ ...song, sections: 'Intro' })).toBe(false);
  });
});

describe('session with unjudged notes', () => {
  it('never matches an unjudged note', () => {
    const s = createSession(song, 1);
    expect(s.onOnset({ time: 0, midiFloat: 45 })).toBeNull();
    expect(s.onOnset({ time: 1, midiFloat: 50 })).toBeNull();
  });
  it('does not turn unjudged notes into misses', () => {
    const s = createSession(song, 1);
    expect(s.tick(10).map((m) => m.index)).toEqual([0, 3]);
  });
  it('counts only judged notes in the maximum score', () => {
    const s = createSession(song, 1);
    s.onOnset({ time: 0, midiFloat: 40 });
    s.onOnset({ time: 2, midiFloat: 55 });
    const sum = s.summary();
    expect(sum).toMatchObject({ score: 200, max: 200, stars: 3 });
    expect(sum.counts).toEqual({ perfect: 2, good: 0, miss: 0 });
  });
});

describe('isUnlocked', () => {
  const bests = (entries) => Object.fromEntries(entries);
  const ids = ['a', 'b', 'c'];
  it('always opens the first lesson', () => {
    expect(isUnlocked(0, {}, ids)).toBe(true);
  });
  it('keeps the next lesson locked until the one before has a star', () => {
    expect(isUnlocked(1, {}, ids)).toBe(false);
    expect(isUnlocked(1, bests([['a@1', { score: 10, stars: 0 }]]), ids)).toBe(false);
  });
  it('opens on one star at any speed', () => {
    expect(isUnlocked(1, bests([['a@0.5', { score: 60, stars: 1 }]]), ids)).toBe(true);
  });
  it('needs the lesson just before, not an earlier one', () => {
    expect(isUnlocked(2, bests([['a@1', { score: 99, stars: 3 }]]), ids)).toBe(false);
    expect(isUnlocked(2, bests([['b@0.75', { score: 99, stars: 2 }]]), ids)).toBe(true);
  });
  it('does not confuse lesson ids that share a prefix', () => {
    expect(isUnlocked(1, bests([['blues-10@1', { score: 1, stars: 3 }]]), ["blues-1", "blues-2"])).toBe(false);
  });
});
