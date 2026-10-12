// Original exercises plus a public-domain melody (Beethoven, "Ode to Joy"),
// and the Blues Masterclass lessons converted by tools/gp2fretline.py.
import { partitionSongs } from '../logic/song.js';

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

// Chords: [shape, durationBeats], shape low E to high e ('x' muted). The top note is the
// scored one, the rest are marked judge:false; the whole strum is judged as one chord.
function chordSong(id, title, bpm, rows) {
  let beat = 0;
  const notes = rows.flatMap(([shape, durationBeats]) => {
    const strings = [...shape].map((c, i) => [6 - i, c]).filter(([, c]) => c !== 'x');
    const top = Math.min(...strings.map(([string]) => string));
    const chord = strings.map(([string, c]) => ({
      beat, string, fret: Number(c), durationBeats, ...(string === top ? {} : { judge: false }),
    }));
    beat += durationBeats;
    return chord;
  });
  return { id, title, bpm, tuning: TUNING, notes };
}

const openChords = ['320003', 'x32010', 'xx0232', '022000', 'x02210', '022100', 'x02220', 'xx0231',
  '020100', 'x02020', 'x21202', '022100'].map((shape) => [shape, 2]);
// E5, G5, A5, C5, D5, E5: the E- and A-string shapes moved along the neck.
const powerChords = ['022xxx', '355xxx', 'x022xx', 'x355xx', 'x577xx', '022xxx'].map((shape) => [shape, 2]);

const exerciseList = [
  build('open-strings', 'Open strings', 70, openStrings),
  build('chromatic-low-e', 'Chromatic, low E frets 1-4', 70, chromatic),
  build('c-major-scale', 'C major scale, first position', 80, cScale),
  build('ode-to-joy', 'Ode to Joy', 90, ode),
  chordSong('open-chords', 'Open chords', 70, openChords),
  chordSong('power-chords', 'Power chords', 70, powerChords),
];

const lessonFiles = import.meta.glob('./blues/*.json', { eager: true, import: 'default' });
const lessonList = Object.keys(lessonFiles).sort().map((path) => lessonFiles[path]);

// Songs that fail validation are dropped; the song list shows which ones.
const exercises = partitionSongs(exerciseList);
const lessons = partitionSongs(lessonList);
export const EXERCISES = exercises.valid;
export const LESSONS = lessons.valid;
export const LOAD_FAILURES = [...exercises.failedIds, ...lessons.failedIds];
