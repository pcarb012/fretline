import { click, getContext, onFrame, startMic } from '../audio/engine.js';
import { medianOffsetMs } from '../logic/latency.js';
import { createOnsetTracker } from '../logic/onsets.js';
import { getLatencyMs, setLatencyMs } from '../store.js';
import { backButton, h, micError } from './dom.js';

const CLICKS = 8;
const GAP_S = 0.8;
const LEAD_S = 1.2;
const TAIL_MS = 1500;

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
  root.append(backButton(go), h('h2', {}, 'Latency calibration'), message,
    h('p', {}, `Current offset: ${getLatencyMs()} ms`), startBtn, result);

  let off = null;
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
    const tracker = createOnsetTracker();
    const onsets = [];
    off = onFrame((f) => {
      const onset = tracker.push(f);
      if (onset) onsets.push(onset.time);
    });
    const clicks = runClicks(getContext());
    message.textContent = 'Pluck on every click...';
    const wait = TAIL_MS + (LEAD_S + CLICKS * GAP_S) * 1000;
    setTimeout(() => finish(clicks, onsets), wait);
  }

  function finish(clicks, onsets) {
    if (off) off();
    off = null;
    startBtn.disabled = false;
    if (gone) return;
    const ms = medianOffsetMs(clicks, onsets);
    if (ms === null) {
      message.textContent = 'Too few plucks were heard. Try again with a louder pluck.';
      return;
    }
    setLatencyMs(ms);
    message.textContent = `Saved. Your offset is ${Math.round(ms)} ms.`;
  }

  startBtn.addEventListener('click', start);
  return () => {
    gone = true;
    if (off) off();
  };
}
