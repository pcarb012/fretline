import { describe, expect, it } from 'vitest';
import { backingPosition, backingStart, needsCountIn, songStartWithIntro } from '../src/logic/backing.js';

describe('backing track timing', () => {
  it('starts early enough for the intro when there is time', () => {
    expect(backingStart({ now: 0, songStart: 5, offsetS: 2 })).toEqual({ when: 3, offset: 0 });
  });
  it('skips into the audio when the intro is longer than the wait', () => {
    expect(backingStart({ now: 1, songStart: 2, offsetS: 4 })).toEqual({ when: 1, offset: 3 });
  });
  it('scales by playback rate', () => {
    expect(backingStart({ now: 0, songStart: 10, offsetS: 2, rate: 0.5 })).toEqual({ when: 6, offset: 0 });
    expect(backingStart({ now: 0, songStart: 1, offsetS: 2, rate: 0.5 })).toEqual({ when: 0, offset: 1.5 });
    expect(backingPosition(3, 1, 2, 0.5)).toBe(3);
  });
  it('delays the song so a long intro plays in full', () => {
    expect(songStartWithIntro(2, 0.4, 5)).toBe(5.4);
    expect(songStartWithIntro(2, 0.4, 1)).toBe(2);
    expect(songStartWithIntro(2, 0.4, -3)).toBe(2);
    expect(songStartWithIntro(2, 0, 3, 0.5)).toBe(6);
  });
  it('keeps the count-in only when the track has no lead-in', () => {
    expect(needsCountIn(0, 1, 2)).toBe(true);
    expect(needsCountIn(3, 1, 2)).toBe(false);
    expect(needsCountIn(1.5, 0.5, 2)).toBe(false);
  });
});
