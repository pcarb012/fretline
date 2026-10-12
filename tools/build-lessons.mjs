// Convert the Blues Masterclass .gp5 files to src/songs/blues/NN.json.
// Run with `npm run lessons`. Set LESSONS_DIR to read from another folder.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = process.env.LESSONS_DIR ?? 'C:/Users/peter/Music/Blues Masterclass';
const pyDir = process.env.GP_PY_DIR ?? 'C:/Users/peter/projects/guitar-pro-mcp';
const outDir = join(root, 'src', 'songs', 'blues');

mkdirSync(outDir, { recursive: true });
const files = readdirSync(srcDir).filter((f) => /^\d\d - .*\.gp5$/.test(f)).sort();
for (const file of files) {
  const num = file.slice(0, 2);
  const title = file.slice(5, -4);
  const json = execFileSync(
    'uv',
    ['--directory', pyDir, 'run', 'python', join(root, 'tools', 'gp2fretline.py'),
      join(srcDir, file), '--id', `blues-${num}`, '--title', title],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
  );
  writeFileSync(join(outDir, `${num}.json`), json);
  process.stdout.write(`${num}.json  ${title}\n`);
}
