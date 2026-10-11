const RISE_RATIO = 1.8;

/**
 * Turns a stream of analysis frames into note onsets: a note appearing after
 * silence, a change of note, or a sharp rise in level (a re-pluck).
 * Feed push() one frame per window: { time, note } where note may be null.
 */
export function createOnsetTracker() {
  let prev = null;
  return {
    push({ time, note }) {
      let onset = null;
      if (note) {
        const isNew = !prev || prev.midi !== note.midi || note.rms > prev.rms * RISE_RATIO;
        if (isNew) onset = { time, midiFloat: note.midiFloat, midi: note.midi };
      }
      prev = note;
      return onset;
    },
    reset() {
      prev = null;
    },
  };
}
