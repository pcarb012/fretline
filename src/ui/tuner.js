import { onFrame, startMic, stopMic } from '../audio/engine.js';
import { formatCents } from '../logic/music.js';
import { backButton, h, micError } from './dom.js';

const HOLD_MS = 1000;
const IN_TUNE_CENTS = 5;
const RANGE_CENTS = 50;

export function mountTuner(root, go) {
  const name = h('div', { class: 'big' }, '--');
  const cents = h('p', {}, 'Pluck a string.');
  const needle = h('div', { class: 'needle', style: 'left: 50%' });
  const status = h('div', {});
  root.append(
    backButton(go),
    h('h2', {}, 'Tuner'),
    name,
    cents,
    h('div', { class: 'needle-wrap' }, h('div', { class: 'needle-mid' }), needle),
    h('div', { class: 'ticks' }, h('span', {}, 'flat'), h('span', {}, 'in tune'), h('span', {}, 'sharp')),
    status,
  );

  let lastHeard = 0;
  let off = null;
  let gone = false;

  function show(note) {
    const clamped = Math.max(-RANGE_CENTS, Math.min(RANGE_CENTS, note.cents));
    name.textContent = note.name;
    cents.textContent = `${formatCents(note.cents)} cents`;
    needle.style.left = `${50 + (clamped / RANGE_CENTS) * 50}%`;
    needle.classList.toggle('ok', Math.abs(note.cents) <= IN_TUNE_CENTS);
  }

  startMic()
    .then(() => {
      if (gone) return;
      off = onFrame(({ note }) => {
        const now = performance.now();
        if (note) {
          lastHeard = now;
          show(note);
        } else if (now - lastHeard > HOLD_MS) {
          name.textContent = '--';
          cents.textContent = 'Pluck a string.';
        }
      });
    })
    .catch((err) => status.append(micError(err)));

  return () => {
    gone = true;
    if (off) off();
    stopMic();
  };
}
