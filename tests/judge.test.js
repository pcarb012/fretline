import { describe, expect, it } from 'vitest';
import { judgeNote, judgeTiming, pitchMatches } from '../src/logic/judge.js';
import { countGrades, maxScore, starsFor, totalScore } from '../src/logic/score.js';

describe('judgeTiming', () => {
  it('is Perfect within 60 ms either side', () => {
    expect(judgeTiming(0).label).toBe('Perfect');
    expect(judgeTiming(0.06).grade).toBe('perfect');
    expect(judgeTiming(-0.06).grade).toBe('perfect');
  });
  it('is Early or Late as Good between 60 and 140 ms', () => {
    expect(judgeTiming(-0.1)).toEqual({ grade: 'good', label: 'Early' });
    expect(judgeTiming(0.1)).toEqual({ grade: 'good', label: 'Late' });
    expect(judgeTiming(0.14).grade).toBe('good');
  });
  it('is a Miss beyond 140 ms', () => {
    expect(judgeTiming(0.141)).toEqual({ grade: 'miss', label: 'Miss' });
    expect(judgeTiming(-0.5).grade).toBe('miss');
  });
});

describe('pitchMatches', () => {
  it('allows 50 cents', () => {
    expect(pitchMatches(60, 60.49)).toBe(true);
    expect(pitchMatches(60, 59.51)).toBe(true);
  });
  it('rejects beyond 50 cents', () => {
    expect(pitchMatches(60, 60.6)).toBe(false);
    expect(pitchMatches(60, 61)).toBe(false);
  });
});

describe('judgeNote', () => {
  it('misses a wrong pitch even if on time', () => {
    expect(judgeNote({ expectedMidi: 60, midiFloat: 62, dt: 0 }).grade).toBe('miss');
  });
  it('judges timing when pitch is right', () => {
    expect(judgeNote({ expectedMidi: 60, midiFloat: 60.1, dt: 0.02 }).grade).toBe('perfect');
    expect(judgeNote({ expectedMidi: 60, midiFloat: 60, dt: -0.1 }).label).toBe('Early');
  });
});

describe('score and stars', () => {
  it('scores 100 and 60 and 0', () => {
    expect(totalScore(['perfect', 'good', 'miss'])).toBe(160);
    expect(maxScore(3)).toBe(300);
  });
  it('awards stars at 50, 75 and 90 percent', () => {
    expect(starsFor(49, 100)).toBe(0);
    expect(starsFor(50, 100)).toBe(1);
    expect(starsFor(74, 100)).toBe(1);
    expect(starsFor(75, 100)).toBe(2);
    expect(starsFor(89, 100)).toBe(2);
    expect(starsFor(90, 100)).toBe(3);
    expect(starsFor(100, 100)).toBe(3);
  });
  it('handles an empty song', () => {
    expect(starsFor(0, 0)).toBe(0);
  });
  it('counts grades', () => {
    expect(countGrades(['perfect', 'perfect', 'good', 'miss'])).toEqual({ perfect: 2, good: 1, miss: 1 });
  });
});

describe('custom pitch tolerance', () => {
  it('pitchMatches honours a tighter or looser tolerance', () => {
    expect(pitchMatches(60, 60.3, 25)).toBe(false);
    expect(pitchMatches(60, 60.3, 40)).toBe(true);
    expect(pitchMatches(60, 60.7, 75)).toBe(true);
  });
  it('judgeNote passes the tolerance through', () => {
    const args = { expectedMidi: 60, midiFloat: 60.4, dt: 0 };
    expect(judgeNote(args).grade).toBe('perfect');
    expect(judgeNote({ ...args, toleranceCents: 30 }).grade).toBe('miss');
  });
});
