// Turn a parsed Guitar Pro score (alphaTab's model) into a Fretline song.
// Same rules as tools/gp2fretline.py: beats count quarter notes, a shuffle feel moves each
// off-beat eighth to two thirds of the beat, ties extend the previous note, rests and grace
// notes are skipped, dead and ghost notes are kept with judge:false, and when a beat has
// several notes only the highest pitch is judged. Only voice 1 and the first tempo are used.
import { judgeTopNotes } from './tabImport.js';
import { validateSong } from './song.js';

const QUARTER = 960; // alphaTab ticks per quarter note
const SHUFFLE_SPLIT = QUARTER / 2;
const SHUFFLE_TO = (QUARTER * 2) / 3;
const TRIPLET_8TH = 2; // alphaTab TripletFeel.Triplet8th
const round4 = (x) => Math.round(x * 10000) / 10000;

/** Move a straight-eighth tick to its shuffled position within the quarter. */
export function warp(tick) {
  const quarter = Math.floor(tick / QUARTER);
  let rest = tick - quarter * QUARTER;
  rest = rest <= SHUFFLE_SPLIT
    ? (rest * SHUFFLE_TO) / SHUFFLE_SPLIT
    : SHUFFLE_TO + ((rest - SHUFFLE_SPLIT) * (QUARTER - SHUFFLE_TO)) / (QUARTER - SHUFFLE_SPLIT);
  return quarter * QUARTER + rest;
}

const sixStrings = (track) => {
  const staff = track.staves?.[0];
  return Boolean(staff && !track.isPercussion && !staff.isPercussion && staff.tuning?.length === 6);
};

/** Tracks that can be played on a six-string guitar: [{ index, name }]. */
export function guitarTracks(score) {
  return score.tracks
    .map((track, index) => ({ index, name: track.name || `Track ${index + 1}`, ok: sixStrings(track) }))
    .filter((t) => t.ok)
    .map(({ index, name }) => ({ index, name }));
}

/** Returns { song } or { error }. */
export function songFromScore(score, { id, title, trackIndex = guitarTracks(score)[0]?.index }) {
  const track = score.tracks[trackIndex];
  if (!track || !sixStrings(track)) return { error: 'The file has no six-string guitar track.' };
  const staff = track.staves[0];
  const capo = staff.capo || 0;
  // alphaTab lists the tuning high string first; Fretline wants low to high, with the capo added
  // so the frets stay as written.
  const tuning = [...staff.tuning].reverse().map((m) => m + capo);
  const strings = staff.tuning.length;

  const notes = [];
  const lastOnString = new Map();
  staff.bars.forEach((bar, b) => {
    const masterBar = score.masterBars[b];
    const shuffle = masterBar.tripletFeel === TRIPLET_8TH;
    for (const beat of bar.voices[0]?.beats ?? []) {
      if (beat.isRest || beat.graceType || !(beat.playbackDuration > 0)) continue;
      let start = beat.absolutePlaybackStart;
      let end = start + beat.playbackDuration;
      if (shuffle && !beat.hasTuplet) [start, end] = [warp(start), warp(end)];
      for (const n of beat.notes) {
        // alphaTab numbers strings from the lowest; Fretline's string 1 is the high e.
        const string = strings + 1 - n.string;
        const prev = lastOnString.get(string);
        if (n.isTieDestination && prev) {
          prev.durationBeats = round4(end / QUARTER - prev.beat);
          continue;
        }
        const note = { beat: round4(start / QUARTER), string, fret: n.fret, durationBeats: round4((end - start) / QUARTER) };
        if (n.isDead || n.isGhost) note.judge = false;
        notes.push(note);
        lastOnString.set(string, note);
      }
    }
  });
  if (notes.length === 0) return { error: 'That track has no notes.' };

  const sections = score.masterBars
    .filter((mb) => mb.section?.text)
    .map((mb) => ({ beat: round4(mb.start / QUARTER), name: mb.section.text }));
  const song = {
    id,
    title,
    bpm: score.tempo,
    tuning,
    ...(sections.length ? { sections } : {}),
    notes: judgeTopNotes(notes, tuning),
  };
  return validateSong(song) ? { song } : { error: 'That track could not be turned into a playable song (frets above 24?).' };
}
