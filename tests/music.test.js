import { describe, expect, it } from 'vitest';
import { fretMidi, hzToMidiFloat, midiToHz, noteName, splitMidi, STANDARD_TUNING } from '../src/logic/music.js';
import { rms, toNote } from '../src/logic/pitch.js';

describe('Hz to MIDI and cents', () => {
  it('maps A440 to MIDI 69', () => {
    expect(hzToMidiFloat(440)).toBeCloseTo(69, 6);
  });
  it('maps low E (82.41 Hz) to MIDI 40', () => {
    expect(hzToMidiFloat(82.407)).toBeCloseTo(40, 2);
  });
  it('round-trips through midiToHz', () => {
    expect(midiToHz(hzToMidiFloat(196))).toBeCloseTo(196, 6);
  });
  it('reports cents off the nearest note', () => {
    const hz = 440 * 2 ** (30 / 1200);
    const { midi, cents } = splitMidi(hzToMidiFloat(hz));
    expect(midi).toBe(69);
    expect(cents).toBeCloseTo(30, 4);
  });
  it('reports negative cents when flat', () => {
    expect(splitMidi(68.8).cents).toBeCloseTo(-20, 4);
    expect(splitMidi(68.8).midi).toBe(69);
  });
  it('names notes with octave', () => {
    expect(noteName(60)).toBe('C4');
    expect(noteName(40)).toBe('E2');
    expect(noteName(61)).toBe('C#4');
  });
});

describe('fretMidi', () => {
  it('maps string 6 to the low E and string 1 to the high e', () => {
    expect(fretMidi(STANDARD_TUNING, 6, 0)).toBe(40);
    expect(fretMidi(STANDARD_TUNING, 1, 0)).toBe(64);
  });
  it('adds the fret', () => {
    expect(fretMidi(STANDARD_TUNING, 2, 1)).toBe(60);
  });
  it('gives the same pitch on different strings', () => {
    expect(fretMidi(STANDARD_TUNING, 6, 5)).toBe(fretMidi(STANDARD_TUNING, 5, 0));
  });
});

describe('toNote', () => {
  it('accepts a clear, loud reading', () => {
    const n = toNote(220, 0.97, 0.05);
    expect(n.midi).toBe(57);
    expect(n.name).toBe('A3');
  });
  it('rejects low clarity', () => {
    expect(toNote(220, 0.9, 0.05)).toBeNull();
    expect(toNote(220, 0.5, 0.05)).toBeNull();
  });
  it('rejects quiet input below the noise gate', () => {
    expect(toNote(220, 0.99, 0.005)).toBeNull();
  });
  it('rejects frequencies outside guitar range', () => {
    expect(toNote(20, 0.99, 0.1)).toBeNull();
    expect(toNote(5000, 0.99, 0.1)).toBeNull();
    expect(toNote(NaN, 0.99, 0.1)).toBeNull();
  });
  it('computes rms', () => {
    expect(rms(new Float32Array([0.5, -0.5, 0.5, -0.5]))).toBeCloseTo(0.5, 6);
    expect(rms(new Float32Array(4))).toBe(0);
  });
});
