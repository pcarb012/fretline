import { fretMidi } from './music.js';

export const SPEEDS = [0.5, 0.75, 1];
export const COUNT_IN_BEATS = 3;

export const beatSeconds = (bpm, speed = 1) => 60 / (bpm * speed);

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

export function validateSong(song) {
  const headOk = song && song.id && song.title && song.bpm > 0 && song.tuning?.length === 6;
  const notesOk = song?.notes?.every(
    (n) => n.string >= 1 && n.string <= 6 && n.fret >= 0 && n.beat >= 0 && n.durationBeats > 0,
  );
  return Boolean(headOk && notesOk && song.notes.length > 0);
}
