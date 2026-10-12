// Make a steady 110 Hz test tone (40 s), for tuner and gate checks.
// usage: node e2e/gentone.mjs [out.wav]
import fs from 'node:fs';
import path from 'node:path';

const SR = 48000;
const out = process.argv[2] ?? 'e2e/out/tone110.wav';
const n = SR * 40;
const pcm = Buffer.alloc(n * 2 + 44);
pcm.write('RIFF', 0);
pcm.writeUInt32LE(36 + n * 2, 4);
pcm.write('WAVEfmt ', 8);
pcm.writeUInt32LE(16, 16);
pcm.writeUInt16LE(1, 20);
pcm.writeUInt16LE(1, 22);
pcm.writeUInt32LE(SR, 24);
pcm.writeUInt32LE(SR * 2, 28);
pcm.writeUInt16LE(2, 32);
pcm.writeUInt16LE(16, 34);
pcm.write('data', 36);
pcm.writeUInt32LE(n * 2, 40);
for (let i = 0; i < n; i++) {
  const t = i / SR;
  const v = 0.4 * Math.sin(2 * Math.PI * 110 * t) + 0.2 * Math.sin(2 * Math.PI * 220 * t) + 0.1 * Math.sin(2 * Math.PI * 330 * t);
  pcm.writeInt16LE((v * 32000) | 0, 44 + i * 2);
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, pcm);
process.stdout.write(`tone -> ${out}\n`);
