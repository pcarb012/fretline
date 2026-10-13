// Upserts the bundled exercises and lessons into the Supabase `songs` table.
// Usage: node tools/seed-songs.mjs [--dry-run]
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { exerciseList } from '../src/songs/exercises.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const bluesDir = join(root, 'src', 'songs', 'blues');

function toRows(songs, kind) {
  return songs.map((song, position) => ({
    id: song.id,
    title: song.title,
    kind,
    position,
    bpm: song.bpm,
    tuning: song.tuning,
    sections: song.sections ?? null,
    notes: song.notes,
  }));
}

function buildRows() {
  const lessons = readdirSync(bluesDir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => JSON.parse(readFileSync(join(bluesDir, name), 'utf8')));
  return [...toRows(exerciseList, 'exercise'), ...toRows(lessons, 'lesson')];
}

function fail(message) {
  console.error(`seed-songs: ${message}`);
  process.exit(1);
}

const rows = buildRows();

if (process.argv.includes('--dry-run')) {
  console.log(`${rows.length} rows (dry run, nothing sent). First row id: ${rows[0].id}`);
  process.exit(0);
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url) fail('set SUPABASE_URL (or VITE_SUPABASE_URL).');
if (!key) fail('set SUPABASE_SERVICE_ROLE_KEY.');

let response;
try {
  response = await fetch(`${url.replace(/\/+$/, '')}/rest/v1/songs?on_conflict=id`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
} catch (error) {
  fail(`request failed: ${error.message}`);
}

if (!response.ok) {
  fail(`Supabase answered ${response.status}: ${await response.text()}`);
}
console.log(`Seeded ${rows.length} songs.`);
