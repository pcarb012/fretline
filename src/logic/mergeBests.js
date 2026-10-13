const keyOf = (songId, speed) => `${songId}@${Number(speed)}`;

/**
 * Merge local bests (map keyed `${songId}@${speed}`) with remote best_scores rows.
 * The higher score wins; a tie keeps the local entry. Inputs are not changed.
 */
export function mergeBests(local, remoteRows) {
  const merged = { ...(local ?? {}) };
  for (const row of remoteRows ?? []) {
    const key = keyOf(row.song_id, row.speed);
    if (!merged[key] || row.score > merged[key].score) {
      merged[key] = { score: row.score, stars: row.stars };
    }
  }
  return merged;
}

/** Turn a bests map into best_scores rows. Skips keys that do not parse. */
export function bestsToRows(map) {
  const rows = [];
  for (const [key, best] of Object.entries(map ?? {})) {
    const at = key.lastIndexOf('@');
    const speed = Number(key.slice(at + 1));
    if (at <= 0 || !best || !Number.isFinite(speed)) continue;
    rows.push({ song_id: key.slice(0, at), speed, score: best.score, stars: best.stars });
  }
  return rows;
}
