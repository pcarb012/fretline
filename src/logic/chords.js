import { normalize, similarity } from './chroma.js';
import { STANDARD_TUNING, fretMidi } from './music.js';

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Chord qualities as pitch-class intervals from the root, most specific first. */
const QUALITIES = [
  { suffix: '7', intervals: [0, 4, 7, 10] },
  { suffix: 'm7', intervals: [0, 3, 7, 10] },
  { suffix: 'maj7', intervals: [0, 4, 7, 11] },
  { suffix: '', intervals: [0, 4, 7] },
  { suffix: 'm', intervals: [0, 3, 7] },
  { suffix: '5', intervals: [0, 7] },
];

/**
 * The chords on the calibration screen. shape is low E to high e, 'x' for a muted string.
 * A calibrated chord also stands in for the same kind on other roots (see calibratedFor),
 * so E5 and A5 cover every power chord on the neck.
 */
export const CHORD_LIBRARY = [
  ['C', 'x32010'], ['A', 'x02220'], ['G', '320003'], ['E', '022100'], ['D', 'xx0232'],
  ['Am', 'x02210'], ['Em', '022000'], ['Dm', 'xx0231'],
  ['E7', '020100'], ['A7', 'x02020'], ['B7', 'x21202'],
  ['E5', '022xxx'], ['A5', 'x022xx'],
].map(([name, shape]) => ({ name, shape, ...parseName(name) }));

/** 'C#m7' -> { root: 1, suffix: 'm7' }; null when it is not a chord name we know. */
export function parseName(name) {
  const m = /^([A-G]#?)(.*)$/.exec(name);
  const root = m ? NAMES.indexOf(m[1]) : -1;
  if (root === -1 || !QUALITIES.some((q) => q.suffix === m[2])) return null;
  return { root, suffix: m[2] };
}

/** MIDI notes of a shape like 'x32010' in a tuning (low to high). */
export function shapeMidis(shape, tuning = STANDARD_TUNING) {
  return [...shape].flatMap((c, i) => (c === 'x' ? [] : [tuning[i] + Number(c)]));
}

// The 7th harmonic is left out: chroma() drops it as out of tune.
const HARMONICS = [1, 2, 3, 4, 5, 6, 8];
const HARMONIC_FALLOFF = 0.6;

/** Expected chroma for a set of MIDI notes, counting each string's first few harmonics. */
export function templateFromMidis(midis) {
  const v = new Array(12).fill(0);
  for (const midi of midis) {
    for (const h of HARMONICS) {
      const pc = Math.round(midi + 12 * Math.log2(h)) % 12;
      v[pc] += HARMONIC_FALLOFF ** (h - 1);
    }
  }
  return normalize(v.map(Math.sqrt));
}

/** Move a chroma vector up by some semitones (an E5 template becomes a G5 one with 3). */
export const rotate = (v, semitones) => v.map((_, i) => v[(((i - semitones) % 12) + 12) % 12]);

/** Name the chord a set of MIDI notes spells, preferring the lowest note as the root; null if none fits. */
export function nameChord(midis) {
  const pcs = new Set(midis.map((m) => m % 12));
  const bass = Math.min(...midis) % 12;
  const roots = [bass, ...[...pcs].filter((pc) => pc !== bass)];
  for (const root of roots) {
    for (const q of QUALITIES) {
      const want = new Set(q.intervals.map((i) => (root + i) % 12));
      if (want.size === pcs.size && [...want].every((pc) => pcs.has(pc))) return NAMES[root] + q.suffix;
    }
  }
  return null;
}

/**
 * Notes struck together that are scored as one chord: three or more strings at the same beat,
 * or a two-string power chord (root and fifth). Two-note double stops stay single notes.
 * Returns [{ beat, members: [note indexes], scored: index or -1, midis, name }].
 * scored is the highest judged member; a chord with no judged member is not scored.
 */
export function chordGroups(song) {
  const byBeat = new Map();
  song.notes.forEach((n, i) => byBeat.set(n.beat, [...(byBeat.get(n.beat) ?? []), i]));
  const groups = [];
  for (const [beat, members] of byBeat) {
    const strings = new Set(members.map((i) => song.notes[i].string));
    if (strings.size < 3 && members.length !== 2) continue;
    const midis = members.map((i) => fretMidi(song.tuning, song.notes[i].string, song.notes[i].fret));
    const power = strings.size === 2 && (Math.max(...midis) - Math.min(...midis)) % 12 === 7;
    if (strings.size < 3 && !power) continue;
    const judged = members.filter((i) => song.notes[i].judge !== false);
    const scored = judged.length
      ? judged.reduce((a, b) => (midis[members.indexOf(b)] > midis[members.indexOf(a)] ? b : a))
      : -1;
    groups.push({ beat, members, scored, midis, name: nameChord(midis) });
  }
  return groups.sort((a, b) => a.beat - b.beat);
}

/**
 * The player's template for a chord: the same chord calibrated, or a calibrated chord of the
 * same quality moved to this root (a calibrated E5 serves every power chord). Null if neither.
 */
export function calibratedFor(name, calibrated = {}) {
  if (calibrated[name]) return calibrated[name];
  const parsed = name ? parseName(name) : null;
  const kin = parsed && CHORD_LIBRARY.find((c) => c.suffix === parsed.suffix && calibrated[c.name]);
  return kin ? rotate(calibrated[kin.name], parsed.root - kin.root) : null;
}

const libraryTemplate = (name) => {
  const lib = CHORD_LIBRARY.find((c) => c.name === name);
  return lib ? templateFromMidis(shapeMidis(lib.shape)) : null;
};

/** Template for a library chord: calibrated if possible, else its expected sound. */
export const templateFor = (name, calibrated = {}) => calibratedFor(name, calibrated) ?? libraryTemplate(name);

/** Library chords ranked by how well a heard chroma matches them: [{ name, score }], best first. */
export function rankChords(heard, calibrated = {}) {
  return CHORD_LIBRARY
    .map((c) => ({ name: c.name, score: similarity(heard, templateFor(c.name, calibrated)) }))
    .sort((a, b) => b.score - a.score);
}

export const MIN_SIMILARITY = 0.7;
export const MARGIN = 0.03;
export const THINNER_MARGIN = 0.06;

const pitchClasses = (midis) => new Set(midis.map((m) => m % 12));

/**
 * Does a heard chroma match the expected chord? It must be close to the expected template
 * and not clearly closer to a rival library chord. Rivals:
 * - a chord holding every expected note plus more is no rival: an extra note is forgiven;
 * - a chord made of only some of the expected notes (A5 inside Am, E inside E7) sounds a lot
 *   like it, because the root and fifth dominate, so it must win by THINNER_MARGIN to count.
 *   A power chord still passes for its major chord: the major third is an overtone of the root.
 */
export function chordMatches(heard, expected, calibrated = {}) {
  const mine = calibratedFor(expected.name, calibrated);
  // Not calibrated: the song's own voicing, or the library shape of the same name.
  const templates = mine ? [mine] : [templateFromMidis(expected.midis), libraryTemplate(expected.name)].filter(Boolean);
  const score = Math.max(...templates.map((t) => similarity(heard, t)));
  const own = pitchClasses(expected.midis);
  const beaten = CHORD_LIBRARY.some((c) => {
    const pcs = pitchClasses(shapeMidis(c.shape));
    if ([...own].every((pc) => pcs.has(pc))) return false;
    const thinner = [...pcs].every((pc) => own.has(pc));
    return similarity(heard, templateFor(c.name, calibrated)) - score > (thinner ? THINNER_MARGIN : MARGIN);
  });
  return { ok: score >= MIN_SIMILARITY && !beaten, score };
}

const MIN_STRUMS = 3;
const MIN_CONSISTENCY = 0.85;
const MIN_LIKENESS = 0.6;

/**
 * Turn the strums heard while calibrating one chord into a template.
 * Returns { ok: true, template } or { ok: false, reason: 'few' | 'uneven' | 'unlike' }.
 */
export function learnChord(name, strums) {
  if (strums.length < MIN_STRUMS) return { ok: false, reason: 'few' };
  const mean = normalize(strums.reduce((sum, s) => sum.map((x, i) => x + s[i]), new Array(12).fill(0)));
  const consistency = Math.min(...strums.map((s) => similarity(s, mean)));
  if (consistency < MIN_CONSISTENCY) return { ok: false, reason: 'uneven' };
  if (similarity(mean, templateFor(name)) < MIN_LIKENESS) return { ok: false, reason: 'unlike' };
  return { ok: true, template: mean.map((x) => Math.round(x * 10000) / 10000) };
}
