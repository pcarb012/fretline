const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const STANDARD_TUNING = [40, 45, 50, 55, 59, 64];

export function hzToMidiFloat(hz) {
  return 69 + 12 * Math.log2(hz / 440);
}

export function midiToHz(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Split a fractional MIDI number into the nearest note and cents off it. */
export function splitMidi(midiFloat) {
  const midi = Math.round(midiFloat);
  return { midi, cents: (midiFloat - midi) * 100 };
}

export function noteName(midi) {
  return NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
}

/** String 1 is the high e (last tuning entry), string 6 the low E. */
export function fretMidi(tuning, string, fret) {
  return tuning[tuning.length - string] + fret;
}
