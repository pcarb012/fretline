import { normalizeTuning } from './logic/tuning.js';

const BEST_KEY = 'fretline.best';
const SPEED_KEY = 'fretline.speed';
const LATENCY_KEY = 'fretline.latencyMs';
const DEVICE_KEY = 'fretline.inputDevice';
const TUNING_KEY = 'fretline.tuning';

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

export function allBest() {
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

/** Replace every saved best with this map (used after a sign-in merge). */
export const replaceAllBest = (map) => write(BEST_KEY, JSON.stringify(map));

const latencyKey =(deviceId) => `${LATENCY_KEY}.${deviceId || 'default'}`;

/** Latency for one input device. Falls back to the old single value saved before devices were tracked. */
export function getLatencyMs(deviceId = '') {
  for (const key of [latencyKey(deviceId), LATENCY_KEY]) {
    const raw = read(key);
    const n = raw === null ? NaN : Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

export const setLatencyMs = (ms, deviceId = '') => write(latencyKey(deviceId), String(Math.round(ms)));

export const getInputDevice = () => read(DEVICE_KEY) ?? '';

export const setInputDevice = (deviceId) => write(DEVICE_KEY, deviceId);

export function getTuning() {
  try {
    return normalizeTuning(JSON.parse(read(TUNING_KEY)));
  } catch {
    return normalizeTuning(null);
  }
}

export const setTuning = (tuning) => write(TUNING_KEY, JSON.stringify(normalizeTuning(tuning)));

export function getSpeed() {
  const n = Number(read(SPEED_KEY));
  return [0.5, 0.75, 1].includes(n) ? n : 1;
}

export const setSpeed = (speed) => write(SPEED_KEY, String(speed));
