const WAIT_BEFORE_S = 0.15;
const WAIT_AFTER_S = 0.6;
const MIN_MATCHES = 4;

export function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const OFFSET_MIN_MS = -100;
const OFFSET_MAX_MS = 400;
const MAX_SPREAD_MS = 60;

/** Offset in ms between each click and the first detected onset near it. */
export function clickOffsetsMs(clickTimes, onsetTimes) {
  const offsets = [];
  for (const click of clickTimes) {
    const onset = onsetTimes.find((t) => t >= click - WAIT_BEFORE_S && t <= click + WAIT_AFTER_S);
    if (onset !== undefined) offsets.push((onset - click) * 1000);
  }
  return offsets;
}

/** Median offset in ms, or null if too few clicks got a pluck. */
export function medianOffsetMs(clickTimes, onsetTimes) {
  const offsets = clickOffsetsMs(clickTimes, onsetTimes);
  return offsets.length < MIN_MATCHES ? null : median(offsets);
}

/** Median absolute deviation: how scattered the offsets are. */
export function spreadMs(values) {
  const mid = median(values);
  return median(values.map((v) => Math.abs(v - mid)));
}

/**
 * Decide whether a calibration run is trustworthy.
 * Returns { ok: true, ms } or { ok: false, reason: 'few' | 'range' | 'spread' }.
 */
export function calibrationResult(clickTimes, onsetTimes) {
  const offsets = clickOffsetsMs(clickTimes, onsetTimes);
  if (offsets.length < MIN_MATCHES) return { ok: false, reason: 'few' };
  const ms = median(offsets);
  if (ms < OFFSET_MIN_MS || ms > OFFSET_MAX_MS) return { ok: false, reason: 'range' };
  if (spreadMs(offsets) > MAX_SPREAD_MS) return { ok: false, reason: 'spread' };
  return { ok: true, ms };
}
