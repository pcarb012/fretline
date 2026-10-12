# Fretline

A browser guitar trainer. It listens through your microphone, scrolls notes toward a hit line and scores each one. Clean-room build: no code, art, songs or names from any other app.

## Run it

1. Install Node 20 or newer.
2. Double-click `start.bat` (or run `npm install` then `npm run dev`).
3. Open http://localhost:3939 and allow the microphone.

Other commands: `npm test` (tests and coverage), `npm run build` (production build in `dist/`).

Use headphones for the click and plug a guitar into the computer, or hold the mic near an acoustic. Run **Calibrate latency** once; the offset is saved in the browser.

## How scoring works

- A note is hit when the pitch is within 50 cents of the expected note (any string that gives the same pitch counts).
- Timing: within 60 ms is Perfect (100 points), within 140 ms is Good (60 points, labelled Early or Late), anything else is a Miss.
- Stars: 1 at 50% of the maximum, 2 at 75%, 3 at 90%.

## Add a song

Open `src/songs/index.js` and add a line to `SONGS`:

```js
build('my-song', 'My song', 80, [
  [1, 0, 1],   // [string, fret, durationBeats]; string 1 = high e, 6 = low E
  [1, 3, 1],
  [2, 1, 2],
])
```

Notes are placed one after another. For gaps or chords, write the objects by hand:
`{ beat, string, fret, durationBeats }`. Standard tuning is `[40, 45, 50, 55, 59, 64]` (MIDI, low to high). The song-list screen picks it up automatically. Keep songs original or public domain.

## Blues lessons

`src/songs/blues/*.json` come from the Blues Masterclass .gp5 files. Rebuild them with `npm run lessons` (needs `uv` and the guitar-pro-mcp project; see `tools/gp2fretline.py`). Lesson N+1 unlocks after one star on lesson N. Notes marked `judge: false` (dead, ghost and the lower notes of double stops) are drawn in outline and not scored.

## Debug mode and replay tests

Add `?debug` to the address (for example http://localhost:3939/?debug) to show a panel with:

- live pitch, clarity and level, and why a frame was rejected
- sliders for the clarity minimum, level gate and pitch tolerance (saved in the browser, applied to detection and judging)
- a "Record take" box; with it ticked, the next play is saved as a 16-bit mono WAV

The results screen then offers "Download session log" (JSON of every frame and judging event) and "Download take". On the calibrate screen, pick the input device; latency is stored per device.

`npm run e2e` makes synthetic recordings of two exercises and replays them through Chrome's fake microphone; both must score 100%. Set `FRETLINE_CHROMIUM` to a Chrome/Chromium binary to use it instead of Playwright's bundled browser (Claude Code cloud sessions set this automatically).
To replay any recording: `node e2e/replay.mjs <wav> <songId> [--speed 0.5] [--pad-ms 40] [--record-take out.wav] [--save-log out.json]`.
Make test audio with `node e2e/genwav.mjs <songId> <out.wav>`. Real takes go in `e2e/fixtures/` (not committed).

## Layout

- `src/logic/` pure functions with tests (pitch, judging, score, songs, latency, onsets, session)
- `src/audio/` microphone, AudioWorklet, pitch detection (`pitchy`), click sound
- `src/ui/` screens and the canvas highway
- `tests/` Vitest tests
- `e2e/` Playwright fake-microphone scripts
