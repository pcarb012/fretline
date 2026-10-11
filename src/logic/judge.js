export const PERFECT_S = 0.06;
export const GOOD_S = 0.14;
export const PITCH_TOLERANCE_CENTS = 50;

export function pitchMatches(expectedMidi, midiFloat) {
  return Math.abs(midiFloat - expectedMidi) * 100 <= PITCH_TOLERANCE_CENTS;
}

/** dt = detected time minus expected time, in seconds. Negative is early. */
export function judgeTiming(dt) {
  const off = Math.abs(dt);
  if (off <= PERFECT_S) return { grade: 'perfect', label: 'Perfect' };
  if (off <= GOOD_S) return { grade: 'good', label: dt < 0 ? 'Early' : 'Late' };
  return { grade: 'miss', label: 'Miss' };
}

export function judgeNote({ expectedMidi, midiFloat, dt }) {
  if (!pitchMatches(expectedMidi, midiFloat)) return { grade: 'miss', label: 'Miss' };
  return judgeTiming(dt);
}
