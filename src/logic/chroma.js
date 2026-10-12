import { hzToMidiFloat } from './music.js';

export const FFT_SIZE = 8192;
const HZ_MIN = 75;
const HZ_MAX = 2000;
// Peaks further than this from a semitone are not notes of the chord. It also drops each
// string's 7th harmonic (31 cents flat), which would otherwise look like a flat seventh.
const MAX_SEMITONE_OFF = 0.2;

/** In-place radix-2 FFT. re and im have the same power-of-two length. */
export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        [cr, ci] = [cr * wr - ci * wi, cr * wi + ci * wr];
      }
    }
  }
}

/**
 * Centre a vector on zero and scale it to unit length, so the dot product of two of them is
 * their correlation. Centring matters: chroma is all positive, so raw vectors all look alike.
 * A flat vector becomes all zeros.
 */
export function normalize(v) {
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const c = v.map((x) => x - mean);
  const len = Math.hypot(...c);
  return len > 0 ? c.map((x) => x / len) : c.map(() => 0);
}

/** Similarity of two normalized vectors, from -1 to 1. */
export const similarity = (a, b) => a.reduce((sum, x, i) => sum + x * b[i], 0);

/**
 * Pitch-class profile of a block of samples: 12 numbers, C first, unit length.
 * Up to FFT_SIZE samples are used (Hann window, zero padded).
 */
export function chroma(samples, sampleRate) {
  const n = Math.min(samples.length, FFT_SIZE);
  const re = new Float64Array(FFT_SIZE);
  const im = new Float64Array(FFT_SIZE);
  for (let i = 0; i < n; i++) re[i] = samples[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  fft(re, im);
  const bins = new Array(12).fill(0);
  const hzPerBin = sampleRate / FFT_SIZE;
  const mag = new Float64Array(FFT_SIZE / 2 + 1);
  for (let k = 0; k <= FFT_SIZE / 2; k++) mag[k] = Math.hypot(re[k], im[k]);
  const last = Math.min(FFT_SIZE / 2 - 1, Math.floor(HZ_MAX / hzPerBin));
  // Only spectral peaks count; the bins around a peak are leakage, not other notes.
  for (let k = Math.ceil(HZ_MIN / hzPerBin); k <= last; k++) {
    const [a, b, c] = [mag[k - 1], mag[k], mag[k + 1]];
    if (!(b > a && b >= c)) continue;
    const shift = (0.5 * (a - c)) / (a - 2 * b + c || 1);
    const midi = hzToMidiFloat((k + shift) * hzPerBin);
    const nearest = Math.round(midi);
    if (Math.abs(midi - nearest) > MAX_SEMITONE_OFF) continue;
    // The square root evens out loud bass strings against quieter treble ones.
    bins[((nearest % 12) + 12) % 12] += Math.sqrt(b);
  }
  return normalize(bins);
}
