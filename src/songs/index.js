// Original exercises plus a public-domain melody (Beethoven, "Ode to Joy").
// Each row is [string, fret, durationBeats]; beats are laid end to end.
const TUNING = [40, 45, 50, 55, 59, 64];

function build(id, title, bpm, rows) {
  let beat = 0;
  const notes = rows.map(([string, fret, durationBeats]) => {
    const note = { beat, string, fret, durationBeats };
    beat += durationBeats;
    return note;
  });
  return { id, title, bpm, tuning: TUNING, notes };
}

const openStrings = [6, 5, 4, 3, 2, 1, 2, 3, 4, 5, 6].map((s) => [s, 0, 1]);
const chromatic = [1, 2, 3, 4, 4, 3, 2, 1].map((f) => [6, f, 1]);

// C major, first position: A string fret 3 up to B string fret 1, and back.
const cScaleUp = [[5, 3], [4, 0], [4, 2], [4, 3], [3, 0], [3, 2], [2, 0], [2, 1]];
const cScale = [...cScaleUp, ...cScaleUp.slice(0, -1).reverse()].map(([s, f]) => [s, f, 1]);

// Ode to Joy: E=(1,0) F=(1,1) G=(1,3) D=(2,3) C=(2,1)
const E = [1, 0];
const F = [1, 1];
const G = [1, 3];
const D = [2, 3];
const C = [2, 1];
const q = (n) => [...n, 1];
const phraseA = [E, E, F, G, G, F, E, D, C, C, D, E].map(q);
const ode = [
  ...phraseA, [...E, 1.5], [...D, 0.5], [...D, 2],
  ...phraseA, [...D, 1.5], [...C, 0.5], [...C, 2],
];

export const SONGS = [
  build('open-strings', 'Open strings', 70, openStrings),
  build('chromatic-low-e', 'Chromatic, low E frets 1-4', 70, chromatic),
  build('c-major-scale', 'C major scale, first position', 80, cScale),
  build('ode-to-joy', 'Ode to Joy', 90, ode),
];
