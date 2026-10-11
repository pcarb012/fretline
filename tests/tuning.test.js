import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING, TUNING_RANGES, normalizeTuning } from '../src/logic/tuning.js';

describe('normalizeTuning', () => {
  it('returns the defaults for missing or broken input', () => {
    expect(normalizeTuning(undefined)).toEqual(DEFAULT_TUNING);
    expect(normalizeTuning(null)).toEqual(DEFAULT_TUNING);
    expect(normalizeTuning('nope')).toEqual(DEFAULT_TUNING);
    expect(normalizeTuning({ clarityMin: 'x', rmsGate: NaN })).toEqual(DEFAULT_TUNING);
  });
  it('keeps valid values and fills the rest', () => {
    expect(normalizeTuning({ rmsGate: 0.02 })).toEqual({ ...DEFAULT_TUNING, rmsGate: 0.02 });
  });
  it('clamps values into their range', () => {
    const t = normalizeTuning({ clarityMin: 5, rmsGate: -1, toleranceCents: 9999 });
    expect(t.clarityMin).toBe(TUNING_RANGES.clarityMin.max);
    expect(t.rmsGate).toBe(TUNING_RANGES.rmsGate.min);
    expect(t.toleranceCents).toBe(TUNING_RANGES.toleranceCents.max);
  });
  it('defaults match the app constants', () => {
    expect(DEFAULT_TUNING).toEqual({ clarityMin: 0.9, rmsGate: 0.01, toleranceCents: 50 });
  });
});
