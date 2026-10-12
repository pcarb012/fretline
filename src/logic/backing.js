// Timing for a backing track that plays along with a song.
// offsetS is where beat 0 of the song falls in the audio file, in seconds of audio.

/**
 * When to start the audio (AudioContext time) and from which position in the file,
 * so that audio position offsetS plays at songStart. rate is the playback speed.
 */
export function backingStart({ now, songStart, offsetS, rate = 1 }) {
  const when = songStart - offsetS / rate;
  if (when >= now) return { when, offset: 0 };
  return { when: now, offset: (now - when) * rate };
}

/** Earliest song start that lets the whole intro before beat 0 play. */
export const songStartWithIntro = (normalStart, now, offsetS, rate = 1) =>
  Math.max(normalStart, now + Math.max(0, offsetS) / rate);

/** Count-in clicks are only needed when the track does not lead in by at least the count-in. */
export const needsCountIn = (offsetS, rate, countInS) => offsetS / rate < countInS;

/** Where the audio should be at a given AudioContext time (for drift correction). */
export const backingPosition = (time, songStart, offsetS, rate = 1) => offsetS + (time - songStart) * rate;
