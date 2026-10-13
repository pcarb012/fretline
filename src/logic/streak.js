const pad = (n) => String(n).padStart(2, '0');

/** Today's calendar date in the player's own time zone, as YYYY-MM-DD. */
export const localDay = (date = new Date()) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Calendar math in UTC so a daylight-saving shift never moves a date. */
function addDays(day, n) {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Map of day -> seconds, summing duplicates. */
function secondsByDay(rows) {
  const map = new Map();
  for (const r of rows ?? []) map.set(r.local_day, (map.get(r.local_day) ?? 0) + r.seconds);
  return map;
}

const practiced = (map, day) => (map.get(day) ?? 0) > 0;

/** Consecutive practice days ending today, or ending yesterday if today is still empty. */
export function currentStreak(rows, today) {
  const map = secondsByDay(rows);
  let day = practiced(map, today) ? today : addDays(today, -1);
  let count = 0;
  while (practiced(map, day)) {
    count += 1;
    day = addDays(day, -1);
  }
  return count;
}

/** Longest run of consecutive practice days anywhere in the history. */
export function bestStreak(rows) {
  const map = secondsByDay(rows);
  let best = 0;
  for (const day of map.keys()) {
    if (!practiced(map, day) || practiced(map, addDays(day, -1))) continue;
    let length = 0;
    for (let d = day; practiced(map, d); d = addDays(d, 1)) length += 1;
    best = Math.max(best, length);
  }
  return best;
}

export const todayMinutes = (rows, today) => (secondsByDay(rows).get(today) ?? 0) / 60;

export const goalMet = (rows, today, goalMinutes) => todayMinutes(rows, today) >= goalMinutes;

/** Seven entries, oldest first, ending today; days with no practice show 0 minutes. */
export function lastSevenDays(rows, today) {
  const map = secondsByDay(rows);
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(today, i - 6);
    return { day, minutes: (map.get(day) ?? 0) / 60 };
  });
}
