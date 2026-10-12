// Turn uploaded tabs into Fretline songs: plain-text (ASCII) tab and Fretline JSON.
// Guitar Pro files go through gpImport.js.
import { STANDARD_TUNING, fretMidi } from './music.js';
import { validateSong } from './song.js';

const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const MAX_FRET = 24;
const round4 = (x) => Math.round(x * 10000) / 10000;

/** A unique id for an uploaded song, readable in saved bests: "user-my-song-k3x9". */
export function userSongId(title, random = Math.random) {
  const slug = String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return `user-${slug || 'song'}-${random().toString(36).slice(2, 6)}`;
}

/** File name without folders or extension, for a default title. */
export const titleFromFileName = (name) => String(name).replace(/^.*[\\/]/, '').replace(/\.[^.]*$/, '').trim();

/**
 * Mark which notes are scored: at each beat only the highest sounding pitch is judged,
 * like the Blues lessons. Notes already marked judge:false stay unjudged.
 */
export function judgeTopNotes(notes, tuning) {
  const byBeat = new Map();
  for (const n of notes) {
    if (n.judge === false) continue;
    const top = byBeat.get(n.beat);
    if (!top || fretMidi(tuning, n.string, n.fret) > fretMidi(tuning, top.string, top.fret)) byBeat.set(n.beat, n);
  }
  const tops = new Set(byBeat.values());
  return notes.map((n) => {
    const { judge, ...rest } = n;
    return tops.has(n) ? rest : { ...rest, judge: false };
  });
}

/** Parse a string label like "D", "eb" or "F#" into the MIDI note nearest the standard string pitch. */
export function labelMidi(label, standardMidi) {
  const m = /^([A-Ga-g])([#b]?)$/.exec(label);
  if (!m) return null;
  const pc = (NOTE_INDEX[m[1].toUpperCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
  let best = null;
  for (let midi = standardMidi - 6; midi <= standardMidi + 6; midi++) {
    if (((midi % 12) + 12) % 12 === pc && (best === null || Math.abs(midi - standardMidi) < Math.abs(best - standardMidi))) {
      best = midi;
    }
  }
  return best;
}

const TAB_LINE = /^\s*([A-Ga-g][#b]?)?\s*[|:]?(.*)$/;

function isTabLine(line) {
  const body = line.replace(/^\s*[A-Ga-g][#b]?\s*(?=[|:])/, '').trim();
  return /^[|:-]/.test(body) && (body.match(/-/g) ?? []).length >= 3 && /^[|:\-0-9a-z/\\~().<>^*= ]+$/i.test(body);
}

/** Group tab lines into blocks of six (high e first). Other lines are ignored. */
function tabBlocks(text) {
  const blocks = [];
  let run = [];
  const flush = () => {
    for (let i = 0; i + 6 <= run.length; i += 6) blocks.push(run.slice(i, i + 6));
    run = [];
  };
  for (const line of String(text).split(/\r?\n/)) {
    if (isTabLine(line)) run.push(line);
    else flush();
  }
  flush();
  return blocks;
}

/** Split a block into its string labels and equal-length rows, dropping barline columns. */
function blockRows(block) {
  const parts = block.map((line) => {
    const [, label = null, rest] = TAB_LINE.exec(line);
    return { label, row: rest.replace(/\s+$/, '') };
  });
  const width = Math.max(...parts.map((p) => p.row.length));
  const rows = parts.map((p) => p.row.padEnd(width, '-'));
  const keep = [];
  for (let c = 0; c < width; c++) if (!rows.some((r) => r[c] === '|' || r[c] === ':')) keep.push(c);
  return { labels: parts.map((p) => p.label), rows: rows.map((r) => keep.map((c) => r[c]).join('')), width: keep.length };
}

/** Fret numbers in one row: [{ col, fret, dead }]. "x" is a dead (muted) note. */
function rowNotes(row) {
  const out = [];
  for (let c = 0; c < row.length; c++) {
    if (row[c] === 'x' || row[c] === 'X') {
      out.push({ col: c, fret: 0, dead: true });
    } else if (/\d/.test(row[c])) {
      let digits = row[c];
      if (/\d/.test(row[c + 1] ?? '') && Number(digits + row[c + 1]) <= MAX_FRET) digits += row[++c];
      out.push({ col: c - digits.length + 1, fret: Number(digits), dead: false });
    }
  }
  return out;
}

/**
 * Parse plain-text tab. Six lines per block, high e on top, blocks follow each other in time.
 * Rhythm is not written in ASCII tab, so it is chosen here:
 *   rhythm 'even'    every note (or chord) lasts noteBeats beats
 *   rhythm 'spacing' columnsPerBeat characters of tab make one beat
 * String labels (e.g. "D|" on the bottom line) set the tuning; missing labels mean standard.
 * Returns { song } or { error }.
 */
export function parseAsciiTab(text, { id, title, bpm, rhythm = 'even', noteBeats = 1, columnsPerBeat = 4 }) {
  const blocks = tabBlocks(text);
  if (blocks.length === 0) return { error: 'No tab found. Each block needs six lines like "e|--0--3--|".' };
  if (!(bpm > 0)) return { error: 'Set a tempo (BPM) above zero.' };
  const step = rhythm === 'spacing' ? 1 / columnsPerBeat : null;
  if (step !== null && !(columnsPerBeat > 0)) return { error: 'Characters per beat must be above zero.' };

  let tuning = null;
  const events = []; // { beat, notes: [{ string, fret, dead }] }
  let beat = 0;
  for (const block of blocks) {
    const { labels, rows, width } = blockRows(block);
    if (!tuning) {
      // Top line is string 1 (high e), which is the last tuning entry.
      const midis = labels.map((l, i) => (l ? labelMidi(l, STANDARD_TUNING[5 - i]) : STANDARD_TUNING[5 - i]));
      tuning = midis.every((m) => m !== null) ? midis.reverse() : [...STANDARD_TUNING];
    }
    const cols = new Map();
    rows.forEach((row, i) => {
      for (const n of rowNotes(row)) {
        if (!cols.has(n.col)) cols.set(n.col, []);
        cols.get(n.col).push({ string: i + 1, fret: n.fret, dead: n.dead });
      }
    });
    const starts = [...cols.keys()].sort((a, b) => a - b);
    starts.forEach((col, k) => {
      const at = step === null ? beat + k * noteBeats : beat + col * step;
      const next = step === null ? at + noteBeats : beat + (starts[k + 1] ?? width) * step;
      events.push({ beat: at, durationBeats: Math.max(next - at, step ?? noteBeats), notes: cols.get(col) });
    });
    beat = step === null ? beat + starts.length * noteBeats : beat + width * step;
  }

  const raw = events.flatMap((e) =>
    e.notes.map((n) => ({
      beat: round4(e.beat),
      string: n.string,
      fret: n.fret,
      durationBeats: round4(e.durationBeats),
      ...(n.dead ? { judge: false } : {}),
    })),
  );
  if (raw.length === 0) return { error: 'The tab has no fret numbers.' };
  const song = { id, title, bpm: Number(bpm), tuning, notes: judgeTopNotes(raw, tuning) };
  return validateSong(song) ? { song } : { error: 'The tab could not be turned into a playable song.' };
}

/** Accept a song in Fretline's own JSON format; the id is replaced so it cannot clash. */
export function parseSongJson(text, { id, title }) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: 'That file is not valid JSON.' };
  }
  const song = { ...data, id, title: title || data?.title };
  return validateSong(song) ? { song } : { error: 'The JSON is not a valid Fretline song (see the README for the format).' };
}
