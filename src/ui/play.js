import { click, getContext, onFrame, startMic } from '../audio/engine.js';
import { createOnsetTracker } from '../logic/onsets.js';
import { createSession } from '../logic/session.js';
import { COUNT_IN_BEATS, beatSeconds, songLengthSeconds } from '../logic/song.js';
import { getLatencyMs, saveBest } from '../store.js';
import { backButton, h, micError } from './dom.js';
import { drawHighway } from './highway.js';

const START_DELAY_S = 0.4;
const TAIL_S = 1.2;

function scheduleCountIn(songStart, beatSec) {
  for (let i = 0; i < COUNT_IN_BEATS; i++) {
    click(songStart - (COUNT_IN_BEATS - i) * beatSec, i === 0);
  }
}

function run(root, go, { song, speed }, ui) {
  const audio = getContext();
  const beatSec = beatSeconds(song.bpm, speed);
  const songStart = audio.currentTime + START_DELAY_S + COUNT_IN_BEATS * beatSec;
  const latencyS = getLatencyMs() / 1000;
  const session = createSession(song, speed);
  const tracker = createOnsetTracker();
  const labels = [];
  let rafId = 0;
  let stopped = false;

  scheduleCountIn(songStart, beatSec);

  const addLabel = (r, now) =>
    labels.push({ ...r, string: song.notes[r.index].string, at: now });

  const offFrame = onFrame(({ time, note }) => {
    ui.detected.textContent = note ? note.name : '';
    const onset = tracker.push({ time: time - latencyS - songStart, note });
    const verdict = onset && session.onOnset(onset);
    if (verdict) addLabel(verdict, audio.currentTime - songStart);
  });

  function finish() {
    const summary = session.summary();
    const isBest = saveBest(song.id, summary.score, summary.stars);
    go('results', { song, speed, summary, isBest });
  }

  function loop() {
    if (stopped) return;
    const now = audio.currentTime - songStart;
    for (const r of session.tick(now)) addLabel(r, now);
    ui.count.textContent = now < 0 ? String(Math.ceil(-now / beatSec)) : '';
    drawHighway(ui.canvas, { song, beatSec, now, results: session.results, labels });
    if (now > songLengthSeconds(song, speed) + TAIL_S) return finish();
    rafId = requestAnimationFrame(loop);
  }
  rafId = requestAnimationFrame(loop);

  return () => {
    stopped = true;
    cancelAnimationFrame(rafId);
    offFrame();
  };
}

export function mountPlay(root, go, args) {
  const ui = {
    canvas: h('canvas'),
    detected: h('div', { class: 'detected', 'aria-live': 'polite' }),
    count: h('div', { class: 'count' }),
  };
  const status = h('div', {});
  root.append(
    backButton(go),
    h('h2', {}, args.song.title),
    h('div', { class: 'hud' }, ui.detected, ui.count),
    ui.canvas,
    status,
  );
  let stop = null;
  let gone = false;
  startMic()
    .then(() => {
      if (!gone) stop = run(root, go, args, ui);
    })
    .catch((err) => status.append(micError(err)));
  return () => {
    gone = true;
    if (stop) stop();
  };
}
