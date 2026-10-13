import { bestStreak, currentStreak, lastSevenDays, todayMinutes } from './streak.js';

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const MIN_QUIT_SECONDS = 5;

/** The weekday letter for a YYYY-MM-DD date. */
export function dayLetter(day) {
  const [y, m, d] = day.split('-').map(Number);
  return DAY_LETTERS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/**
 * Everything the practice card shows. Bars are scaled to the busiest day (or the goal,
 * if higher) so a short week still looks small; a day with any practice gets at least a sliver.
 */
export function practiceSummary(rows, goalMinutes, today) {
  const minutes = todayMinutes(rows, today);
  const days = lastSevenDays(rows, today);
  const scale = Math.max(goalMinutes, ...days.map((d) => d.minutes), 1);
  return {
    current: currentStreak(rows, today),
    best: bestStreak(rows),
    minutes,
    goal: goalMinutes,
    percent: Math.min(100, Math.round((minutes / goalMinutes) * 100)),
    week: days.map((d) => ({
      day: d.day,
      letter: dayLetter(d.day),
      minutes: d.minutes,
      height: d.minutes > 0 ? Math.max(6, Math.round((d.minutes / scale) * 100)) : 0,
    })),
  };
}

/** Seconds worth logging for a run the player quit: 0 when it was too short. */
export const quitSeconds = (seconds) => (seconds >= MIN_QUIT_SECONDS ? seconds : 0);
