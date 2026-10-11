import { fretMidi } from './music.js';

export const SPEEDS = [0.5, 0.75, 1];
export const COUNT_IN_BEATS = 3;

export const beatSeconds = (bpm, speed = 1) => 60 / (bpm * speed);

/** A note counts toward the score unless the song marks it judge:false. */
export const isJudged = (note) => note.judge !== false;

export const judgedCount = (song) => song.notes.filter(isJudged).length;

export const DOUBLE_STOP_SHARE = 0.1;

/** True when at least 10% of the notes are unjudged (top note of a double stop scored). */
export const hasUnscoredDoubleStops = (song) =>
  (song.notes.length - judgedCount(song)) / song.notes.length >= DOUBLE_STOP_SHARE;

export function expectedMidiList(song) {
  return song.notes.map((n) => fretMidi(song.tuning, n.string, n.fret));
}

/** Seconds from the first song beat (beat 0) to each note. */
export function noteTimes(song, speed = 1) {
  const bs = beatSeconds(song.bpm, speed);
  return song.notes.map((n) => n.beat * bs);
}

export function songLengthSeconds(song, speed = 1) {
  const bs = beatSeconds(song.bpm, speed);
  const end = Math.max(...song.notes.map((n) => n.beat + n.durationBeats));
  return end * bs;
}

const noteOk = (n) =>
  n.string >= 1 && n.string <= 6 && n.fret >= 0 && n.beat >= 0 && n.durationBeats > 0 &&
  (n.judge === undefined || typeof n.judge === 'boolean');

const sectionsOk = (sections) =>
  sections === undefined ||
  (Array.isArray(sections) && sections.every((s) => s.beat >= 0 && typeof s.name === 'string' && s.name));

export function validateSong(song) {
  const headOk = song && song.id && song.title && song.bpm > 0 && song.tuning?.length === 6;
  const notesOk = Array.isArray(song?.notes) && song.notes.length > 0 && song.notes.every(noteOk);
  return Boolean(headOk && notesOk && song.notes.some(isJudged) && sectionsOk(song.sections));
}
