import { prepareBacking, startBacking } from '../audio/backing.js';
import { click, getContext, onFrame, startMic, stopMic } from '../audio/engine.js';
import { getTrack } from '../library.js';
import { needsCountIn, songStartWithIntro } from '../logic/backing.js';
import { createOnsetTracker } from '../logic/onsets.js';
import { createSession } from '../logic/session.js';
import { COUNT_IN_BEATS, beatSeconds, songLengthSeconds } from '../logic/song.js';
import { getInputDevice, getLatencyMs, saveBest } from '../store.js';
import { activeTuning, beginRun } from './debugState.js';
import { backButton, h, micError } from './dom.js';
import { drawHighway } from './highway.js';

const START_DELAY_S = 0.4;
const TAIL_S = 1.2;

function scheduleCountIn(songStart, beatSec) {
  for (let i = 0; i < COUNT_IN_BEATS; i++) {
    click(songStart - (COUNT_IN_BEATS - i) * beatSec, i === 0);
  }
}

function finishRun(go, song, speed, session) {
  const summary = session.summary();
  const isBest = saveBest(song.id, speed, summary.score, summary.stars);
  go('results', { song, speed, summary, isBest });
}

function run(root, go, { song, speed }, ui, dbg, backing) {
  const audio = getContext();
  const beatSec = beatSeconds(song.bpm, speed);
  const countInS = COUNT_IN_BEATS * beatSec;
  const now0 = audio.currentTime + START_DELAY_S;
  const songStart = backing ? songStartWithIntro(now0 + countInS, now0, backing.track.offsetS, speed) : now0 + countInS;
  const latencyS = getLatencyMs(getInputDevice()) / 1000;
  const session = createSession(song, speed, { toleranceCents: activeTuning().toleranceCents });
  const tracker = createOnsetTracker();
  const labels = [];
  let rafId = 0;
  let stopped = false;

  if (!backing || needsCountIn(backing.track.offsetS, speed, countInS)) scheduleCountIn(songStart, beatSec);
  const stopBacking = backing ? startBacking(audio, backing.prepared, backing.track, { songStart, speed }) : null;
  dbg.setStart(songStart, audio.sampleRate);

  // What the player sees and hears lags the audio clock by the output latency.
  const visualNow = () => audio.currentTime - (audio.outputLatency || 0) - songStart;
  const addLabel = (r) =>
    labels.push({ ...r, string: song.notes[r.index].string, at: visualNow() });

  const offFrame = onFrame(({ time, note }) => {
    ui.detected.textContent = note ? note.name : '';
    const onset = tracker.push({ time: time - latencyS - songStart, note });
    if (!onset) return;
    const verdict = session.onOnset(onset);
    dbg.onset(onset, verdict);
    if (verdict) addLabel(verdict);
  });

  function loop() {
    if (stopped) return;
    const now = audio.currentTime - songStart;
    for (const r of session.tick(now)) {
      addLabel(r);
      dbg.miss(r.index, session.times[r.index]);
    }
    ui.count.textContent = now < 0 ? String(Math.ceil(-now / beatSec)) : '';
    drawHighway(ui.canvas, { song, beatSec, now: visualNow(), results: session.results, labels });
    if (now > songLengthSeconds(song, speed) + TAIL_S) return finishRun(go, song, speed, session);
    rafId = requestAnimationFrame(loop);
  }
  rafId = requestAnimationFrame(loop);

  return () => {
    stopped = true;
    cancelAnimationFrame(rafId);
    offFrame();
    if (stopBacking) stopBacking();
  };
}

/** Load and decode the song's backing track, if it has one. */
async function loadBacking(song, speed) {
  const track = await getTrack(song.id);
  if (!track) return null;
  return { track, prepared: await prepareBacking(getContext(), track, speed) };
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
  const deviceId = getInputDevice();
  const dbg = beginRun({
    songId: args.song.id,
    speed: args.speed,
    deviceId,
    latencyMs: getLatencyMs(deviceId),
  });
  let stop = null;
  let gone = false;
  startMic()
    .then(() => loadBacking(args.song, args.speed).catch(() => {
      status.append(h('div', { class: 'notice error' }, 'The backing track could not be played; playing without it.'));
      return null;
    }))
    .then((backing) => {
      if (!gone) stop = run(root, go, args, ui, dbg, backing);
    })
    .catch((err) => status.append(micError(err)));
  return () => {
    gone = true;
    if (stop) stop();
    dbg.stop();
    stopMic();
  };
}
