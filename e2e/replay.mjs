// Replay a recording against a song and print the score and each verdict.
// usage: node e2e/replay.mjs <wav> <songId> [--speed 0.5] [--pad-ms 0] [--url http://localhost:3939/]
//        [--record-take out.wav] [--save-log out.json] [--shot out.png] [--mid-shot out.png --mid-ms 15000] [--min-percent 100] [--headed]
import { replay, startServer } from './lib.mjs';

function parseArgs(argv) {
  const [wav, songId, ...rest] = argv;
  const flags = {};
  for (let i = 0; i < rest.length; i++) {
    const key = rest[i];
    flags[key] = key === '--headed' ? true : rest[++i];
  }
  return { wav, songId, flags };
}

const { wav, songId, flags } = parseArgs(process.argv.slice(2));
if (!wav || !songId) {
  process.stderr.write('usage: node e2e/replay.mjs <wav> <songId> [--speed n] [--pad-ms n] [--url u] [--record-take f] [--save-log f] [--shot f] [--min-percent n] [--headed]\n');
  process.exit(2);
}

const server = flags['--url'] ? null : await startServer();
try {
  const r = await replay({
    wav,
    songId,
    url: flags['--url'] ?? server.url,
    speed: Number(flags['--speed'] ?? 1),
    padMs: Number(flags['--pad-ms'] ?? 0),
    recordTake: Boolean(flags['--record-take']),
    takePath: flags['--record-take'],
    logPath: flags['--save-log'],
    shot: flags['--shot'],
    midShot: flags['--mid-shot'],
    midMs: Number(flags['--mid-ms'] ?? 15000),
    headless: !flags['--headed'],
  });
  const percent = Math.round((r.score / r.max) * 100);
  process.stdout.write(`${songId}: score ${r.score}/${r.max} (${percent}%), ${r.stars}, ${r.unmatched} unmatched onsets\n`);
  process.stdout.write(`${r.verdicts.join(' ')}\n`);
  if (r.errors.length) process.stdout.write(`page errors: ${r.errors.join('; ')}\n`);
  const min = Number(flags['--min-percent'] ?? 0);
  if (r.errors.length || percent < min) process.exitCode = 1;
} finally {
  if (server) await server.close();
}
