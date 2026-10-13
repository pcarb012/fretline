import { EXERCISES, LESSONS } from '../songs/index.js';

// The song library the list shows: bundled songs until the server library arrives.
let catalog = { exercises: EXERCISES, lessons: LESSONS, locked: [], failures: [] };
const listeners = new Set();

export const getCatalog = () => catalog;

export function setCatalog(next) {
  catalog = next;
}

/** Ask whoever is showing the song list to draw it again. Returns a function that stops listening. */
export function onListChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notifyListChange() {
  for (const fn of listeners) fn();
}
