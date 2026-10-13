import { localDay } from '../logic/streak.js';
import { getUser } from './auth.js';
import { safely } from './client.js';

export const DEFAULT_GOAL_MINUTES = 10;
const MAX_SESSION_SECONDS = 7200;

/** Record one play-through. Sessions under a second are skipped; long ones are capped at two hours. */
export async function logSession({ songId, speed, seconds, score, stars }) {
  const user = await getUser();
  const secs = Math.min(Math.round(seconds), MAX_SESSION_SECONDS);
  if (!user || !(secs >= 1)) return false;
  const res = await safely('logSession', (sb) =>
    sb.from('practice_sessions').insert({
      user_id: user.id, song_id: songId, speed, seconds: secs, score, stars, local_day: localDay(),
    }));
  return res !== null;
}

/** Practice per day, newest first, as [{ local_day, seconds }]. Empty when signed out. */
export async function fetchPracticeDays() {
  if (!(await getUser())) return [];
  const res = await safely('fetchPracticeDays', (sb) =>
    sb.from('practice_days').select('local_day, seconds').order('local_day', { ascending: false }).limit(1000));
  return res?.data ?? [];
}

/** Daily goal in minutes. Falls back to the default when signed out or offline. */
export async function getGoal() {
  const user = await getUser();
  if (!user) return DEFAULT_GOAL_MINUTES;
  const res = await safely('getGoal', (sb) =>
    sb.from('profiles').select('daily_goal_minutes').eq('id', user.id).maybeSingle());
  return res?.data?.daily_goal_minutes ?? DEFAULT_GOAL_MINUTES;
}

/** Save the daily goal (kept within 1 to 240 minutes). True when saved. */
export async function setGoal(minutes) {
  const user = await getUser();
  if (!user) return false;
  const goal = Math.min(240, Math.max(1, Math.round(minutes)));
  const res = await safely('setGoal', (sb) =>
    sb.from('profiles').update({ daily_goal_minutes: goal }).eq('id', user.id));
  return res !== null;
}
