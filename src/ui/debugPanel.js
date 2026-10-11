import { tapFrames } from '../audio/engine.js';
import { TUNING_RANGES } from '../logic/tuning.js';
import {
  activeTuning, getRecordTake, isDebug, lastRun, recentEvents, setRecordTake, updateTuning,
} from './debugState.js';
import { h } from './dom.js';

const NARROW_PX = 700;

const SLIDERS = [
  ['clarityMin', 'Clarity min', 2],
  ['rmsGate', 'Level gate', 3],
  ['toleranceCents', 'Pitch tolerance (cents)', 0],
];

function slider(key, label, places) {
  const range = TUNING_RANGES[key];
  const value = h('b', {}, activeTuning()[key].toFixed(places));
  const input = h('input', { type: 'range', min: range.min, max: range.max, step: range.step });
  input.value = activeTuning()[key];
  input.addEventListener('input', () => {
    updateTuning({ [key]: Number(input.value) });
    value.textContent = activeTuning()[key].toFixed(places);
  });
  return h('label', { class: 'dbg-slider' }, h('span', {}, label, ' ', value), input);
}

function liveText(frame) {
  const { hz, clarity, rms } = frame.raw;
  const gate = frame.reason ? `rejected: ${frame.reason}` : `ok ${frame.note.name}`;
  const fmt = (n, places) => (Number.isFinite(n) ? n.toFixed(places) : '--');
  return `${fmt(hz, 1)} Hz  clarity ${fmt(clarity, 2)}  level ${fmt(rms, 3)}  ${gate}`;
}

/** Fixed overlay with live detector values, threshold sliders and the latest events. Debug mode only. */
export function mountDebugPanel() {
  const live = h('div', { class: 'dbg-live' }, 'mic closed');
  const events = h('pre', { class: 'dbg-events' });
  const record = h('input', { type: 'checkbox' });
  record.checked = getRecordTake();
  record.addEventListener('change', () => setRecordTake(record.checked));
  const body = h('div', { class: 'dbg-body' }, live, ...SLIDERS.map((s) => slider(...s)),
    h('label', { class: 'dbg-check' }, record, ' Record take (next play)'), events);
  if (window.innerWidth < NARROW_PX) body.classList.add('hidden');
  const toggle = h('button', { onclick: () => body.classList.toggle('hidden') }, 'Debug');
  const panel = h('aside', { class: 'debug', 'aria-label': 'Debug panel' }, toggle, body);
  document.body.append(panel);
  document.body.classList.add('debug-on');
  tapFrames((frame) => {
    live.textContent = liveText(frame);
    events.textContent = recentEvents().join('\n');
  });
}

function download(name, blob) {
  const url = URL.createObjectURL(blob);
  const link = h('a', { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

/** Download buttons for the results screen, or null outside debug mode. */
export function debugDownloads() {
  const run = isDebug() ? lastRun() : null;
  if (!run) return null;
  const json = run.log.toJSON();
  const base = `fretline-${json.meta.songId}-${json.meta.speed}-${stamp()}`;
  const buttons = [
    h('button', {
      onclick: () => download(`${base}.json`, new Blob([JSON.stringify(json)], { type: 'application/json' })),
    }, 'Download session log'),
  ];
  if (run.recorder && run.recorder.sampleCount() > 0) {
    buttons.push(h('button', {
      onclick: () => download(`${base}.wav`, new Blob([run.recorder.toWav()], { type: 'audio/wav' })),
    }, `Download take (WAV, ${run.recorder.seconds().toFixed(1)} s)`));
  }
  return h('div', { class: 'row debug-downloads' }, ...buttons);
}
