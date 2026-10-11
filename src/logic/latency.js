const WAIT_BEFORE_S = 0.15;
const WAIT_AFTER_S = 0.6;
const MIN_MATCHES = 4;

export function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Median offset in milliseconds between each click and the first detected onset
 * near it. Returns null if too few clicks got a pluck.
 */
export function medianOffsetMs(clickTimes, onsetTimes) {
  const offsets = [];
  for (const click of clickTimes) {
    const onset = onsetTimes.find((t) => t >= click - WAIT_BEFORE_S && t <= click + WAIT_AFTER_S);
    if (onset !== undefined) offsets.push((onset - click) * 1000);
  }
  return offsets.length < MIN_MATCHES ? null : median(offsets);
}
