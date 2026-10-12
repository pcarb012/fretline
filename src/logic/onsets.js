const RISE_RATIO = 1.8;
const JUMP_CENTS = 70;
const HISTORY = 3;

/**
 * Turns a stream of analysis frames into note onsets.
 * - A note after silence is an onset.
 * - A different note counts if it is more than 70 cents away, or if the new
 *   note holds for two frames (so pitch wobble near a boundary is ignored).
 * - A re-pluck of the same note is a level more than 1.8x the quietest of the last 3 frames.
 * Feed push() one frame per window: { time, note } where note may be null.
 */
export function createOnsetTracker() {
  let held = null;
  let pending = null;
  let levels = [];

  const reset = () => {
    held = null;
    pending = null;
    levels = [];
  };

  const begin = (time, note) => {
    held = note;
    pending = null;
    return { time, midiFloat: note.midiFloat, midi: note.midi };
  };

  function pitchChange(time, note) {
    const far = Math.abs(note.midiFloat - held.midiFloat) * 100 > JUMP_CENTS;
    if (far) return begin(time, note);
    if (pending && pending.midi === note.midi) return begin(pending.time, note);
    pending = { midi: note.midi, time };
    return null;
  }

  function sameNote(time, note) {
    pending = null;
    const quietest = Math.min(...levels);
    held = note;
    return note.rms > quietest * RISE_RATIO ? begin(time, note) : null;
  }

  return {
    push({ time, note }) {
      if (!note) {
        reset();
        return null;
      }
      let onset;
      if (!held) onset = begin(time, note);
      else if (held.midi !== note.midi) onset = pitchChange(time, note);
      else onset = sameNote(time, note);
      levels = [...levels, note.rms].slice(-HISTORY);
      return onset;
    },
    reset,
  };
}
