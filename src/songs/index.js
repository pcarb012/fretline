// Original exercises plus a public-domain melody (Beethoven, "Ode to Joy"),
// and the Blues Masterclass lessons converted by tools/gp2fretline.py.
import { partitionSongs } from '../logic/song.js';
import { exerciseList } from './exercises.js';

const lessonFiles = import.meta.glob('./blues/*.json', { eager: true, import: 'default' });
const lessonList = Object.keys(lessonFiles).sort().map((path) => lessonFiles[path]);

// Songs that fail validation are dropped; the song list shows which ones.
const exercises = partitionSongs(exerciseList);
const lessons = partitionSongs(lessonList);
export const EXERCISES = exercises.valid;
export const LESSONS = lessons.valid;
export const LOAD_FAILURES = [...exercises.failedIds, ...lessons.failedIds];
