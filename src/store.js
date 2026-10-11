const BEST_KEY = 'fretline.best';
const SPEED_KEY = 'fretline.speed';
const LATENCY_KEY = 'fretline.latencyMs';

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage may be blocked; the app still works without it.
  }
}

function allBest() {
  try {
    return JSON.parse(read(BEST_KEY)) ?? {};
  } catch {
    return {};
  }
}

const bestKey = (songId, speed) => `${songId}@${speed}`;

export const getBest = (songId, speed) => allBest()[bestKey(songId, speed)] ?? null;

/** Keep the higher score. Returns true if this run is a new best. */
export function saveBest(songId, speed, score, stars) {
  const all = allBest();
  const key = bestKey(songId, speed);
  if (all[key] && all[key].score >= score) return false;
  write(BEST_KEY, JSON.stringify({ ...all, [key]: { score, stars } }));
  return true;
}

export function getLatencyMs() {
  const n = Number(read(LATENCY_KEY));
  return Number.isFinite(n) ? n : 0;
}

export const setLatencyMs = (ms) => write(LATENCY_KEY, String(Math.round(ms)));

export function getSpeed() {
  const n = Number(read(SPEED_KEY));
  return [0.5, 0.75, 1].includes(n) ? n : 1;
}

export const setSpeed = (speed) => write(SPEED_KEY, String(speed));
