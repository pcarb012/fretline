import { describe, expect, it } from 'vitest';
import { EXERCISES, LESSONS } from '../src/songs/index.js';
import { hasUnscoredDoubleStops, validateSong } from '../src/logic/song.js';

describe('song catalogue', () => {
  it('has four exercises and twelve lessons, all valid', () => {
    expect(EXERCISES).toHaveLength(4);
    expect(LESSONS).toHaveLength(12);
    for (const s of [...EXERCISES, ...LESSONS]) expect(validateSong(s)).toBe(true);
  });
  it('gives every song a different id', () => {
    const ids = [...EXERCISES, ...LESSONS].map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('lists lessons in order with section labels', () => {
    expect(LESSONS[1].title).toBe('Pentatonic Across the Neck');
    expect(LESSONS.every((l) => l.sections.length > 0)).toBe(true);
  });
  it('flags double stops only on lessons with at least 10% unjudged notes', () => {
    const flagged = LESSONS.map((l, i) => (hasUnscoredDoubleStops(l) ? i + 1 : null)).filter(Boolean);
    expect(flagged).toEqual([1, 4, 7, 8, 9, 10, 11, 12]);
    expect(hasUnscoredDoubleStops(EXERCISES[0])).toBe(false);
  });
  it('sits exactly on the 10% line', () => {
    const notes = (n, off) => Array.from({ length: n }, (_, i) => ({ judge: i >= off }));
    expect(hasUnscoredDoubleStops({ notes: notes(10, 1) })).toBe(true);
    expect(hasUnscoredDoubleStops({ notes: notes(11, 1) })).toBe(false);
  });
  it('has no NaN timing in any lesson', () => {
    for (const l of LESSONS) {
      for (const n of l.notes) {
        expect(Number.isFinite(n.beat) && Number.isFinite(n.durationBeats)).toBe(true);
      }
    }
  });
});
