// Shared helpers for the fake-microphone end-to-end scripts.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

/** Every song in the catalogue. It uses import.meta.glob, so it is loaded through Vite, not plain Node. */
async function loadSongs() {
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  try {
    const catalogue = await vite.ssrLoadModule('/src/songs/index.js');
    return JSON.parse(JSON.stringify(Object.values(catalogue).flat().filter((s) => s?.id)));
  } finally {
    await vite.close();
  }
}

export async function findSong(id) {
  const song = (await loadSongs()).find((s) => s.id === id);
  if (!song) throw new Error(`No song with id "${id}"`);
  return song;
}

/** Start the Vite dev server on a free port and return { url, close }. */
export async function startServer() {
  const server = await createServer({ server: { port: 0, strictPort: false, open: false }, logLevel: 'error' });
  await server.listen();
  return { url: server.resolvedUrls.local[0], close: () => server.close() };
}

/** Copy a 16-bit PCM WAV with silence added at the start. Returns the new path (or the same one for 0 ms). */
export function padWav(wavPath, padMs) {
  if (!padMs) return wavPath;
  const src = fs.readFileSync(wavPath);
  const dataAt = src.indexOf('data', 12, 'latin1');
  const channels = src.readUInt16LE(22);
  const rate = src.readUInt32LE(24);
  const silence = Buffer.alloc(Math.round((rate * padMs) / 1000) * channels * 2);
  const size = src.readUInt32LE(dataAt + 4) + silence.length;
  const head = Buffer.from(src.subarray(0, dataAt + 8));
  head.writeUInt32LE(size, dataAt + 4);
  head.writeUInt32LE(head.length - 8 + size, 4);
  const out = path.join(os.tmpdir(), `fretline-pad-${Date.now()}.wav`);
  fs.writeFileSync(out, Buffer.concat([head, silence, src.subarray(dataAt + 8)]));
  return out;
}

/**
 * Play one song against a WAV through Chrome's fake microphone, with ?debug on.
 * options: { wav, songId, url, speed, padMs, recordTake, takePath, logPath, shot, midShot, midMs, headless }.
 * Returns { score, max, stars, verdicts, unmatched, log, errors }.
 */
export async function replay(options) {
  const { wav, songId, url, speed = 1, padMs = 0, recordTake, takePath, logPath, shot, midShot, midMs = 15000, headless = true } = options;
  const songs = await loadSongs();
  const song = songs.find((s) => s.id === songId);
  if (!song) throw new Error(`No song with id "${songId}"`);
  // Lessons unlock one star at a time, so give every other song a star at every speed.
  const bests = Object.fromEntries(
    songs.filter((s) => s.id !== songId).flatMap((s) => [0.5, 0.75, 1].map((sp) => [`${s.id}@${sp}`, { score: 1, stars: 1 }])),
  );
  const fakeWav = path.resolve(padWav(wav, padMs));
  const browser = await chromium.launch({
    headless,
    executablePath: process.env.FRETLINE_CHROMIUM || undefined,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${fakeWav}`,
      '--autoplay-policy=no-user-gesture-required',
    ],
  });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true, permissions: ['microphone'] });
    await context.addInitScript(([sp, seed]) => {
      localStorage.setItem('fretline.speed', String(sp));
      localStorage.setItem('fretline.best', JSON.stringify(seed));
    }, [speed, bests]);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${url}?debug`);
    await page.waitForSelector('.songs');
    if (recordTake) await page.check('.dbg-check input');
    const row = page.locator('.song').filter({ has: page.getByRole('heading', { name: song.title, exact: true }) });
    await row.getByRole('button', { name: 'Play' }).click();
    if (midShot) {
      await page.waitForTimeout(midMs);
      await page.screenshot({ path: midShot });
    }
    await page.waitForSelector('.big', { timeout: 180000 });
    if (shot) await page.screenshot({ path: shot });
    const result = await readResults(page, song);
    if (takePath) await saveDownload(page, /Download take/, takePath);
    if (logPath) await saveDownload(page, /Download session log/, logPath);
    return { ...result, errors };
  } finally {
    await browser.close();
  }
}

async function saveDownload(page, label, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: label }).click()]);
  await download.saveAs(target);
}

async function readResults(page, song) {
  const score = Number(await page.locator('.big').innerText());
  const max = song.notes.length * 100;
  const stars = await page.locator('.stars').getAttribute('aria-label');
  const log = await page.evaluate(() => window.__fretlineDebug.log());
  const byIndex = new Map();
  for (const e of log.events) {
    if (e.type === 'verdict') byIndex.set(e.index, `${e.label}(${Math.round(e.dt * 1000)}ms)`);
    if (e.type === 'miss') byIndex.set(e.index, 'Miss(timeout)');
  }
  const verdicts = song.notes.map((_, i) => `${i}:${byIndex.get(i) ?? '?'}`);
  const unmatched = log.events.filter((e) => e.type === 'unmatched').length;
  return { score, max, stars, verdicts, unmatched, log };
}
