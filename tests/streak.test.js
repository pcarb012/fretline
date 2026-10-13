import { describe, expect, it } from 'vitest';
import {
  bestStreak, currentStreak, goalMet, lastSevenDays, localDay, todayMinutes,
} from '../src/logic/streak.js';

const rows = (...days) => days.map((d) => (Array.isArray(d) ? { local_day: d[0], seconds: d[1] } : { local_day: d, seconds: 60 }));

describe('localDay', () => {
  it('formats local calendar date with zero padding', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(localDay(new Date(2026, 11, 31, 0, 1))).toBe('2026-12-31');
  });
  it('defaults to now', () => {
    expect(localDay()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('currentStreak', () => {
  it('counts consecutive days ending today', () => {
    expect(currentStreak(rows('2026-10-11', '2026-10-12', '2026-10-13'), '2026-10-13')).toBe(3);
  });
  it('still counts when today is empty but yesterday had practice', () => {
    expect(currentStreak(rows('2026-10-11', '2026-10-12'), '2026-10-13')).toBe(2);
  });
  it('is zero after a missed day', () => {
    expect(currentStreak(rows('2026-10-10', '2026-10-11'), '2026-10-13')).toBe(0);
  });
  it('is zero with no rows', () => {
    expect(currentStreak([], '2026-10-13')).toBe(0);
    expect(currentStreak(null, '2026-10-13')).toBe(0);
  });
  it('crosses month and year boundaries', () => {
    expect(currentStreak(rows('2025-12-30', '2025-12-31', '2026-01-01'), '2026-01-01')).toBe(3);
    expect(currentStreak(rows('2026-02-27', '2026-02-28', '2026-03-01'), '2026-03-01')).toBe(3);
  });
  it('handles leap day', () => {
    expect(currentStreak(rows('2028-02-28', '2028-02-29', '2028-03-01'), '2028-03-01')).toBe(3);
  });
  it('ignores zero-second days', () => {
    expect(currentStreak(rows(['2026-10-12', 0], '2026-10-13'), '2026-10-13')).toBe(1);
  });
  it('is not broken by DST changes', () => {
    expect(currentStreak(rows('2026-03-07', '2026-03-08', '2026-03-09'), '2026-03-09')).toBe(3);
    expect(currentStreak(rows('2026-10-31', '2026-11-01', '2026-11-02'), '2026-11-02')).toBe(3);
  });
});

describe('bestStreak', () => {
  it('finds the longest run anywhere', () => {
    const r = rows('2026-09-01', '2026-09-02', '2026-09-03', '2026-09-10', '2026-09-11');
    expect(bestStreak(r)).toBe(3);
  });
  it('is zero with nothing', () => {
    expect(bestStreak([])).toBe(0);
    expect(bestStreak(undefined)).toBe(0);
  });
  it('ignores duplicate rows for one day', () => {
    expect(bestStreak(rows('2026-09-01', '2026-09-01', '2026-09-02'))).toBe(2);
  });
});

describe('today and goal', () => {
  const r = rows(['2026-10-13', 600], ['2026-10-12', 60]);
  it('reports minutes today', () => {
    expect(todayMinutes(r, '2026-10-13')).toBe(10);
    expect(todayMinutes(r, '2026-10-14')).toBe(0);
  });
  it('compares against the goal', () => {
    expect(goalMet(r, '2026-10-13', 10)).toBe(true);
    expect(goalMet(r, '2026-10-13', 11)).toBe(false);
    expect(goalMet(r, '2026-10-14', 10)).toBe(false);
  });
});

describe('lastSevenDays', () => {
  it('runs oldest to newest with zero-filled gaps', () => {
    const out = lastSevenDays(rows(['2026-10-13', 120], ['2026-10-10', 30]), '2026-10-13');
    expect(out.map((d) => d.day)).toEqual([
      '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13',
    ]);
    expect(out.map((d) => d.minutes)).toEqual([0, 0, 0, 0.5, 0, 0, 2]);
  });
  it('spans a month boundary', () => {
    expect(lastSevenDays([], '2026-03-03').map((d) => d.day)[0]).toBe('2026-02-25');
  });
});
