import { bestsToRows, mergeBests } from '../logic/mergeBests.js';
import { allBest, getSpeed, getTuning, replaceAllBest, setSpeed, setTuning } from '../store.js';
import { SPEEDS } from '../logic/song.js';
import { getUser } from './auth.js';
import { safely } from './client.js';

const saveBestRpc = (sb, { song_id, speed, score, stars }) =>
  sb.rpc('save_best', { p_song_id: song_id, p_speed: speed, p_score: score, p_stars: stars });

/** Send one finished run to the server. True when it was a new best there. */
export async function pushBest(songId, speed, score, stars) {
  if (!(await getUser())) return false;
  const res = await safely('pushBest', (sb) => saveBestRpc(sb, { song_id: songId, speed, score, stars }));
  return res?.data === true;
}

async function syncBests() {
  const rows = bestsToRows(allBest());
  await Promise.all(rows.map((row) => safely('push best', (sb) => saveBestRpc(sb, row))));
  // One request; Supabase caps it at 1000 rows (333 songs at three speeds), plenty for now.
  const res = await safely('pull bests', (sb) => sb.from('best_scores').select('song_id, speed, score, stars'));
  if (!res) return false;
  replaceAllBest(mergeBests(allBest(), res.data));
  return true;
}

/** Remote settings win when present; otherwise the local ones are pushed up. */
async function syncSettings(user) {
  const res = await safely('pull settings', (sb) =>
    sb.from('profiles').select('settings').eq('id', user.id).maybeSingle());
  if (!res) return false;
  const remote = res.data?.settings ?? {};
  if (remote.speed === undefined && remote.tuning === undefined) {
    const push = await safely('push settings', (sb) =>
      sb.from('profiles').update({ settings: { speed: getSpeed(), tuning: getTuning() } }).eq('id', user.id));
    return push !== null;
  }
  if (SPEEDS.includes(remote.speed)) setSpeed(remote.speed);
  if (remote.tuning !== undefined) setTuning(remote.tuning);
  return true;
}

/** Run once after sign-in: push local bests, pull and merge remote ones, then sync settings. */
export async function syncOnSignIn() {
  const user = await getUser();
  if (!user) return false;
  const bestsOk = await syncBests();
  const settingsOk = await syncSettings(user);
  return bestsOk && settingsOk;
}
