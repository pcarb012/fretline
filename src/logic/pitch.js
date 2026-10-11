import { hzToMidiFloat, noteName, splitMidi } from './music.js';

export const CLARITY_MIN = 0.9;
export const RMS_GATE = 0.01;
const HZ_MIN = 60;
const HZ_MAX = 1500;

export function rms(samples) {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}

/** Turn a raw detector reading into a note, or null when it is not trustworthy. */
export function toNote(hz, clarity, level, gate = RMS_GATE) {
  if (!(clarity > CLARITY_MIN) || !(level > gate)) return null;
  if (!(hz >= HZ_MIN && hz <= HZ_MAX)) return null;
  const midiFloat = hzToMidiFloat(hz);
  const { midi, cents } = splitMidi(midiFloat);
  return { hz, midiFloat, midi, cents, name: noteName(midi), clarity, rms: level };
}
