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
  it('flags double stops only where a sounding note goes unjudged', () => {
    expect(hasUnscoredDoubleStops(EXERCISES[0])).toBe(false);
    expect(hasUnscoredDoubleStops(LESSONS[0])).toBe(true);
  });
  it('has no NaN timing in any lesson', () => {
    for (const l of LESSONS) {
      for (const n of l.notes) {
        expect(Number.isFinite(n.beat) && Number.isFinite(n.durationBeats)).toBe(true);
      }
    }
  });
});
