import { configureDetector, tapFrames } from '../audio/engine.js';
import { createDebugLog } from '../logic/debugLog.js';
import { DEFAULT_TUNING } from '../logic/tuning.js';
import { createTakeRecorder } from '../logic/wav.js';
import { getTuning, setTuning } from '../store.js';

const RECENT_EVENTS = 8;

let tuning = DEFAULT_TUNING;
let recordTake = false;
let run = null;
let recent = [];

export const isDebug = () => new URLSearchParams(window.location.search).has('debug');

/** The thresholds in force: the saved debug values in debug mode, the defaults otherwise. */
export const activeTuning = () => (isDebug() ? tuning : DEFAULT_TUNING);

export function updateTuning(next) {
  tuning = { ...tuning, ...next };
  setTuning(tuning);
  configureDetector(tuning);
}

export const getRecordTake = () => recordTake;
export const setRecordTake = (on) => {
  recordTake = Boolean(on);
};

export const recentEvents = () => recent;

/** The last play: { log, recorder } or null. */
export const lastRun = () => run;

function remember(type, time, data) {
  const detail = data.label ?? (data.index === undefined ? '' : `#${data.index}`);
  recent = [...recent, `${time.toFixed(2)}s ${type} ${detail}`.trim()].slice(-RECENT_EVENTS);
}

function onTap(frame) {
  if (!run || !run.active) return;
  run.log.frame(frame);
  if (run.wantTake) {
    if (!run.recorder) run.recorder = createTakeRecorder(frame.sampleRate);
    run.recorder.push(frame.fresh);
  }
}

const NOOP_RUN = { setStart() {}, onset() {}, strum() {}, miss() {}, stop() {} };

/**
 * Start logging a play. Call it before the mic opens so the take covers the whole run.
 * Returns hooks for play.js; in normal mode they do nothing.
 */
export function beginRun(meta) {
  if (!isDebug()) return NOOP_RUN;
  const log = createDebugLog();
  log.setMeta({ ...meta, tuning });
  run = { log, recorder: null, active: true, wantTake: recordTake };
  recent = [];
  const mine = run;
  const event = (type, time, data) => {
    log.event(type, time, data);
    remember(type, time, data);
  };
  return {
    setStart(songStart, sampleRate) {
      log.setOrigin(songStart);
      log.setMeta({ sampleRate });
    },
    /** onset is a tracker result; verdict is the session answer or null. */
    onset(onset, verdict) {
      event('onset', onset.time, { midiFloat: onset.midiFloat });
      if (verdict) {
        event('verdict', onset.time, { index: verdict.index, label: verdict.label, dt: verdict.dt });
      } else {
        event('unmatched', onset.time, { midiFloat: onset.midiFloat });
      }
    },
    /** strum is a strum tracker result; verdict is the session answer or null. */
    strum(strum, verdict) {
      if (verdict) {
        event('verdict', strum.time, { index: verdict.index, label: verdict.label, dt: verdict.dt, chord: verdict.name });
      } else {
        event('unmatched-strum', strum.time, {});
      }
    },
    miss(index, time) {
      event('miss', time, { index });
    },
    stop() {
      mine.active = false;
    },
  };
}

/** Load saved thresholds, apply them to the detector and start listening. Debug mode only. */
export function initDebug() {
  if (!isDebug()) return;
  tuning = getTuning();
  configureDetector(tuning);
  tapFrames(onTap);
  window.__fretlineDebug = { log: () => (run ? run.log.toJSON() : null) };
}
