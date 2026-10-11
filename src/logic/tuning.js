/** Detector and judging thresholds that the debug panel can change. */
export const DEFAULT_TUNING = { clarityMin: 0.9, rmsGate: 0.01, toleranceCents: 50 };

export const TUNING_RANGES = {
  clarityMin: { min: 0.5, max: 0.99, step: 0.01 },
  rmsGate: { min: 0.001, max: 0.1, step: 0.001 },
  toleranceCents: { min: 10, max: 100, step: 1 },
};

/** Fill missing or bad values with defaults and clamp the rest into range. */
export function normalizeTuning(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const [key, { min, max }] of Object.entries(TUNING_RANGES)) {
    const value = Number(source[key]);
    const usable = source[key] !== null && source[key] !== '' && Number.isFinite(value);
    out[key] = usable ? Math.min(max, Math.max(min, value)) : DEFAULT_TUNING[key];
  }
  return out;
}
