import { describe, expect, it } from 'vitest';
import { MIN_QUIT_SECONDS, dayLetter, practiceSummary, quitSeconds } from '../src/logic/practiceCard.js';

describe('dayLetter', () => {
  it('gives the weekday initial', () => {
    expect(dayLetter('2026-10-13')).toBe('T'); // Tuesday
    expect(dayLetter('2026-10-11')).toBe('S'); // Sunday
    expect(dayLetter('2026-10-12')).toBe('M');
  });
});

describe('practiceSummary', () => {
  const rows = [
    { local_day: '2026-10-13', seconds: 300 },
    { local_day: '2026-10-12', seconds: 1200 },
    { local_day: '2026-10-11', seconds: 60 },
    { local_day: '2026-10-01', seconds: 60 },
  ];
  const s = practiceSummary(rows, 10, '2026-10-13');

  it('counts streaks and today', () => {
    expect(s.current).toBe(3);
    expect(s.best).toBe(3);
    expect(s.minutes).toBe(5);
    expect(s.percent).toBe(50);
  });
  it('lists seven days ending today with letters', () => {
    expect(s.week).toHaveLength(7);
    expect(s.week[6]).toMatchObject({ day: '2026-10-13', letter: 'T' });
    expect(s.week[0].height).toBe(0);
  });
  it('scales bars to the busiest day and keeps a sliver for short ones', () => {
    expect(s.week[5].height).toBe(100); // 20 min is the max
    expect(s.week[4].height).toBe(6); // 1 min of 20
    expect(s.week[6].height).toBe(25);
  });
  it('caps the goal bar at 100 percent and handles no data', () => {
    expect(practiceSummary([{ local_day: '2026-10-13', seconds: 6000 }], 10, '2026-10-13').percent).toBe(100);
    const empty = practiceSummary([], 10, '2026-10-13');
    expect(empty).toMatchObject({ current: 0, best: 0, minutes: 0, percent: 0 });
  });
});

describe('quitSeconds', () => {
  it('ignores quits under the minimum', () => {
    expect(quitSeconds(MIN_QUIT_SECONDS - 0.1)).toBe(0);
    expect(quitSeconds(MIN_QUIT_SECONDS)).toBe(MIN_QUIT_SECONDS);
    expect(quitSeconds(42)).toBe(42);
  });
});
