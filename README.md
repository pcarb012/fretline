# Fretline

A browser guitar trainer. It listens through your microphone, scrolls notes toward a hit line and scores each one. Clean-room build: no code, art, songs or names from any other app.

## Run it

1. Install Node 20 or newer.
2. Double-click `start.bat` (or run `npm install` then `npm run dev`).
3. Open http://localhost:3939 and allow the microphone.

Other commands: `npm test` (tests and coverage), `npm run build` (production build in `dist/`).

Use headphones for the click and plug a guitar into the computer, or hold the mic near an acoustic. Run **Calibrate latency** once; the offset is saved in the browser.

## Host on DigitalOcean

`.do/app.yaml` deploys the site to DigitalOcean App Platform as a free static site that rebuilds on every push to `main`. Run `doctl apps create --spec .do/app.yaml`, or in the console choose **Create App**, pick this repo and upload the spec. The site is served over HTTPS, which the microphone requires.

## How scoring works

- A note is hit when the pitch is within 50 cents of the expected note (any string that gives the same pitch counts).
- Timing: within 60 ms is Perfect (100 points), within 140 ms is Good (60 points, labelled Early or Late), anything else is a Miss.
- Stars: 1 at 50% of the maximum, 2 at 75%, 3 at 90%.
- Chords (three or more strings struck together, or a two-string power chord) are scored as one item, by strum. See below.

## Chords

Fretline hears a strum as a jump in level, then compares the next ~130 ms of sound with the chord it expects. It uses chroma: how much of each of the 12 note names is sounding. A strum counts when it is close to the expected chord and no other chord explains it clearly better. An extra note is forgiven, so an E7 strum passes for an E. A missing third is not, so an A5 strum does not pass for Am. A single plucked string never counts as a chord.

**Calibrate chords** on the song list teaches it your guitar. Pick a chord, press **Strum**, and strum it 4 times (single downstrokes, about a second apart). It covers C, A, G, E, D, Am, Em, Dm, E7, A7, B7, E5 and A5. Templates are saved in the browser per input device. A calibrated chord also stands in for the same kind of chord on other roots: E5 serves every power chord, E7 every dominant seventh. Chords you skip use built-in sounds. After a strum, the screen shows which chord it heard, which is a quick way to check.

Known limits: a power chord and the major chord on the same root sound almost the same (the major third is an overtone of the root), so an E5 can pass for an E. The Open chords and Power chords exercises are a good first test.

## Add a song

Open `src/songs/index.js` and add a line to `SONGS`:

```js
build('my-song', 'My song', 80, [
  [1, 0, 1],   // [string, fret, durationBeats]; string 1 = high e, 6 = low E
  [1, 3, 1],
  [2, 1, 2],
])
```

Notes are placed one after another. For gaps, write the objects by hand:
`{ beat, string, fret, durationBeats }`. For strummed chords use `chordSong` with shapes like `'x32010'` (see the Open chords exercise). Standard tuning is `[40, 45, 50, 55, 59, 64]` (MIDI, low to high). The song-list screen picks it up automatically. Keep songs original or public domain.

## Upload tabs and backing tracks

Click **Upload a tab** on the song list. It accepts:

- Guitar Pro files (.gp3, .gp4, .gp5, .gpx, .gp). Pick the track if there is more than one guitar. The import follows the same rules as `tools/gp2fretline.py`: shuffle feel, ties, dead and ghost notes, and only the top note of a chord is scored. The capo is added to the tuning.
- Plain-text tab: six lines per block, high e on top. Text tab has no rhythm, so pick a tempo and either the same length for every note or "follow the spacing" (N characters = 1 beat). String labels such as `D|` on the bottom line set the tuning. `x` is a dead note.
- Fretline JSON (the format above).

Any song, including the built-in ones, can have a backing track (MP3, WAV, OGG, M4A). Use **+ Track** on its row. Set **Beat 1 starts at** to the point in the audio where the tab's first beat falls; a longer intro plays in full before the notes arrive, and the count-in clicks are skipped when the track leads in. At 100% speed the track is scheduled on the audio clock; at 50% and 75% it plays through an audio element that keeps the pitch, so the sync can be off by a few tens of milliseconds.

Uploads are stored in the browser (IndexedDB), not on a server, so they stay on that computer and browser. Use headphones so the mic doesn't hear the backing track.

## Blues lessons

`src/songs/blues/*.json` come from the Blues Masterclass .gp5 files. Rebuild them with `npm run lessons` (needs `uv` and the guitar-pro-mcp project; see `tools/gp2fretline.py`). Lesson N+1 unlocks after one star on lesson N. Notes marked `judge: false` (dead, ghost and the lower notes of double stops) are drawn in outline and not scored.

## Debug mode and replay tests

Add `?debug` to the address (for example http://localhost:3939/?debug) to show a panel with:

- live pitch, clarity and level, and why a frame was rejected
- sliders for the clarity minimum, level gate and pitch tolerance (saved in the browser, applied to detection and judging)
- a "Record take" box; with it ticked, the next play is saved as a 16-bit mono WAV

The results screen then offers "Download session log" (JSON of every frame and judging event) and "Download take". On the calibrate screen, pick the input device; latency is stored per device.

`npm run e2e` makes synthetic recordings of four exercises (two single-note, two chord) and replays them through Chrome's fake microphone; each must score 100%. Keep e2e songs short: over ~20 s the fake microphone drifts against the audio clock and late notes slip to Good. Set `FRETLINE_CHROMIUM` to a Chrome/Chromium binary to use it instead of Playwright's bundled browser (Claude Code cloud sessions set this automatically).
To replay any recording: `node e2e/replay.mjs <wav> <songId> [--speed 0.5] [--pad-ms 40] [--record-take out.wav] [--save-log out.json]`.
Make test audio with `node e2e/genwav.mjs <songId> <out.wav>`. Real takes go in `e2e/fixtures/` (not committed).

## Layout

- `src/logic/` pure functions with tests (pitch, judging, score, songs, latency, onsets, session, chords, chroma, strums)
- `src/audio/` microphone, AudioWorklet, pitch detection (`pitchy`), click sound
- `src/library.js` uploaded songs and backing tracks (IndexedDB)
- `src/ui/` screens and the canvas highway
- `tests/` Vitest tests
- `e2e/` Playwright fake-microphone scripts
