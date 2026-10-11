const BEST_KEY = 'fretline.best';
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

export const getBest = (songId) => allBest()[songId] ?? null;

/** Keep the higher score. Returns true if this run is a new best. */
export function saveBest(songId, score, stars) {
  const all = allBest();
  if (all[songId] && all[songId].score >= score) return false;
  write(BEST_KEY, JSON.stringify({ ...all, [songId]: { score, stars } }));
  return true;
}

export function getLatencyMs() {
  const n = Number(read(LATENCY_KEY));
  return Number.isFinite(n) ? n : 0;
}

export const setLatencyMs = (ms) => write(LATENCY_KEY, String(Math.round(ms)));
