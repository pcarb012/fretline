import { validateSong } from './song.js';

const KINDS = ['exercise', 'lesson'];

/** Turn a songs table row into a plain song object the app already understands. */
function rowToSong(row) {
  const song = {
    id: row.id, title: row.title, bpm: Number(row.bpm), tuning: row.tuning, notes: row.notes,
  };
  if (row.sections) song.sections = row.sections;
  return song;
}

const byPosition = (a, b) => a.position - b.position;

/**
 * Merge the server library over the bundled songs.
 * bundled is { exercises, lessons }. Returns { exercises, lessons, locked, failures }.
 * With catalogRows null (offline or no backend) the bundled songs come back unchanged.
 */
export function mergeCatalog(bundled, catalogRows, songRows) {
  if (!catalogRows) return { ...bundled, locked: [], failures: [] };

  const failures = [];
  const serverByKind = { exercise: [], lesson: [] };
  for (const row of [...(songRows ?? [])].sort(byPosition)) {
    const song = rowToSong(row);
    if (KINDS.includes(row.kind) && validateSong(song)) serverByKind[row.kind].push(song);
    else failures.push(row.id ?? 'unknown');
  }

  const haveSong = new Set((songRows ?? []).map((r) => r.id));
  const lockedRows = catalogRows.filter((c) => c.is_premium && !haveSong.has(c.id));
  const lockedIds = new Set(lockedRows.map((c) => c.id));

  // A bundled copy of a premium song stays locked for players without premium.
  const combine = (server, local) => {
    const ids = new Set(server.map((s) => s.id));
    return [...server, ...local.filter((s) => !ids.has(s.id) && !lockedIds.has(s.id))];
  };

  const locked = lockedRows
    .sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) || byPosition(a, b))
    .map((c) => ({ id: c.id, title: c.title, kind: c.kind, bpm: Number(c.bpm), locked: true }));

  return {
    exercises: combine(serverByKind.exercise, bundled.exercises),
    lessons: combine(serverByKind.lesson, bundled.lessons),
    locked,
    failures,
  };
}
