import { click, getContext, onFrame, startMic, stopMic } from '../audio/engine.js';
import { calibrationResult } from '../logic/latency.js';
import { createOnsetTracker } from '../logic/onsets.js';
import { getInputDevice, getLatencyMs, setLatencyMs } from '../store.js';
import { createDevicePicker } from './devicePicker.js';
import { backButton, h, micError } from './dom.js';

const CLICKS = 8;
const GAP_S = 0.8;
const LEAD_S = 1.2;
const TAIL_MS = 1500;

const RETRY = {
  few: 'Too few plucks were heard. Try again with a louder pluck on every click.',
  range: 'That run looks off, so it was not saved. Try again and pluck right on each click.',
  spread: 'Your plucks were too uneven to measure, so nothing was saved. Try again, steady and on the beat.',
};

function runClicks(audio) {
  const first = audio.currentTime + LEAD_S;
  const times = Array.from({ length: CLICKS }, (_, i) => first + i * GAP_S);
  times.forEach((t) => click(t));
  return times;
}

export function mountCalibrate(root, go) {
  const message = h('p', {}, 'Eight clicks will play. Pluck any string on each click, as evenly as you can.');
  const result = h('div', {});
  const startBtn = h('button', { class: 'primary' }, 'Start');
  const offset = h('p', {});
  const showOffset = () => {
    offset.textContent = `Current offset for this input: ${getLatencyMs(getInputDevice())} ms`;
  };
  showOffset();
  const picker = createDevicePicker(() => {
    stopMic();
    showOffset();
  });
  root.append(backButton(go), h('h2', {}, 'Latency calibration'), picker.el, message,
    offset, startBtn, result);

  let off = null;
  let timer = 0;
  let gone = false;

  async function start() {
    startBtn.disabled = true;
    result.replaceChildren();
    try {
      await startMic();
    } catch (err) {
      result.append(micError(err));
      startBtn.disabled = false;
      return;
    }
    picker.refresh();
    const tracker = createOnsetTracker();
    const onsets = [];
    off = onFrame((f) => {
      const onset = tracker.push(f);
      if (onset) onsets.push(onset.time);
    });
    const clicks = runClicks(getContext());
    message.textContent = 'Pluck on every click...';
    const wait = TAIL_MS + (LEAD_S + CLICKS * GAP_S) * 1000;
    timer = setTimeout(() => finish(clicks, onsets), wait);
  }

  function finish(clicks, onsets) {
    if (off) off();
    off = null;
    startBtn.disabled = false;
    if (gone) return;
    const r = calibrationResult(clicks, onsets);
    if (!r.ok) {
      message.textContent = RETRY[r.reason];
      return;
    }
    setLatencyMs(r.ms, getInputDevice());
    showOffset();
    message.textContent = `Saved. Your offset is ${Math.round(r.ms)} ms.`;
  }

  startBtn.addEventListener('click', start);
  return () => {
    gone = true;
    clearTimeout(timer);
    if (off) off();
    stopMic();
  };
}
