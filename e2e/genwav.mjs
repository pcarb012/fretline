// Make a synthetic plucked-string recording of a song, to play through Chrome's fake microphone.
// usage: node e2e/genwav.mjs <songId> <out.wav> [extraLeadSec] [speed]
import fs from 'node:fs';
import path from 'node:path';
import { findSong } from './lib.mjs';

const SR = 48000;
const [, , id, out, extra = '0', speed = '1'] = process.argv;
const song = out ? await findSong(id) : null;
if (!song) {
  process.stderr.write('usage: node e2e/genwav.mjs <songId> <out.wav> [extraLeadSec] [speed]\n');
  process.exit(1);
}

const beatSec = 60 / (song.bpm * Number(speed));
const lead = 0.4 + 3 * beatSec + Number(extra);
const total = lead + Math.max(...song.notes.map((n) => n.beat + n.durationBeats)) * beatSec + 6;
const buf = new Float32Array(Math.ceil(total * SR));

// Karplus-Strong pluck.
function pluck(freq, start, dur) {
  const n = Math.round(SR / freq);
  const delay = new Float32Array(n).map(() => Math.random() * 2 - 1);
  for (let i = 1; i < n; i++) delay[i] = 0.5 * delay[i] + 0.5 * delay[i - 1];
  const len = Math.round(dur * SR);
  const first = Math.round(start * SR);
  let idx = 0;
  for (let i = 0; i < len && first + i < buf.length; i++) {
    const next = (idx + 1) % n;
    const v = delay[idx];
    delay[idx] = 0.9965 * 0.5 * (delay[idx] + delay[next]);
    idx = next;
    buf[first + i] += v * 0.7;
  }
}

// Notes marked judge:false (chord extras, dead notes) are skipped; only judged notes matter.
for (const note of song.notes.filter((n) => n.judge !== false)) {
  const midi = song.tuning[6 - note.string] + note.fret;
  pluck(440 * 2 ** ((midi - 69) / 12), lead + note.beat * beatSec, Math.min(note.durationBeats * beatSec * 0.95, 1.5));
}

const pcm = Buffer.alloc(buf.length * 2 + 44);
pcm.write('RIFF', 0);
pcm.writeUInt32LE(36 + buf.length * 2, 4);
pcm.write('WAVEfmt ', 8);
pcm.writeUInt32LE(16, 16);
pcm.writeUInt16LE(1, 20);
pcm.writeUInt16LE(1, 22);
pcm.writeUInt32LE(SR, 24);
pcm.writeUInt32LE(SR * 2, 28);
pcm.writeUInt16LE(2, 32);
pcm.writeUInt16LE(16, 34);
pcm.write('data', 36);
pcm.writeUInt32LE(buf.length * 2, 40);
for (let i = 0; i < buf.length; i++) pcm.writeInt16LE((Math.max(-1, Math.min(1, buf[i])) * 32000) | 0, 44 + i * 2);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, pcm);
process.stdout.write(`${id}: lead ${lead.toFixed(2)} s, length ${total.toFixed(2)} s -> ${out}\n`);
