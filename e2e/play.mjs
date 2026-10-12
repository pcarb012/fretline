// Play one exercise by its position in the song list against a WAV and screenshot the results.
// usage: node e2e/play.mjs <wav> <songIndex> <tag> [midScreenshotMs]
// Needs the dev server running (npm run dev). Set FRETLINE_URL to use another address.
import fs from 'node:fs';
import { chromium } from 'playwright';

const [, , wav, idx, tag, midMs] = process.argv;
const url = process.env.FRETLINE_URL ?? 'http://localhost:3939/';
fs.mkdirSync('e2e/out', { recursive: true });

const browser = await chromium.launch({
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${wav}`,
    '--autoplay-policy=no-user-gesture-required',
  ],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['microphone'] });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(url);
await page.waitForSelector('.songs');
await page.click(`.song >> nth=${idx} >> text=Play`);
if (midMs) {
  await page.waitForTimeout(Number(midMs));
  await page.screenshot({ path: `e2e/out/mid-${tag}.png` });
}
await page.waitForSelector('.big', { timeout: 60000 });
await page.screenshot({ path: `e2e/out/results-${tag}.png` });
const text = await page.evaluate(() => document.querySelector('main').innerText.replace(/\n+/g, ' | '));
const stars = await page.locator('.stars').getAttribute('aria-label');
process.stdout.write(`${tag} ${text} ${stars} ${errors.join('; ')}\n`);
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: `e2e/out/results-${tag}-m.png` });
await browser.close();
