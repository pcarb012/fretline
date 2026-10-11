// npm run e2e: make synthetic recordings of two exercises and check each still scores 100%.
import { execFileSync } from 'node:child_process';
import { replay, startServer } from './lib.mjs';

const CASES = ['open-strings', 'c-major-scale'];
const out = (id) => `e2e/out/${id}.wav`;

for (const id of CASES) execFileSync('node', ['e2e/genwav.mjs', id, out(id)], { stdio: 'inherit' });

const server = await startServer();
let failed = false;
try {
  for (const id of CASES) {
    const r = await replay({ wav: out(id), songId: id, url: server.url });
    const percent = Math.round((r.score / r.max) * 100);
    const ok = percent === 100 && r.errors.length === 0;
    failed ||= !ok;
    process.stdout.write(`${ok ? 'PASS' : 'FAIL'} ${id}: ${r.score}/${r.max} ${r.stars}\n`);
    if (!ok) process.stdout.write(`${r.verdicts.join(' ')} ${r.errors.join('; ')}\n`);
  }
} finally {
  await server.close();
}
process.exitCode = failed ? 1 : 0;
