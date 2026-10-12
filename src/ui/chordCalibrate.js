import { onFrame, startMic, stopMic } from '../audio/engine.js';
import { CHORD_LIBRARY, MIN_SIMILARITY, learnChord, rankChords } from '../logic/chords.js';
import { createStrumTracker } from '../logic/strums.js';
import { clearChordTemplates, getChordTemplates, getInputDevice, setChordTemplate } from '../store.js';
import { createDevicePicker } from './devicePicker.js';
import { backButton, h, micError } from './dom.js';

const STRUMS = 4;
const TIMEOUT_MS = 15000;

const RETRY = {
  few: 'Too few strums were heard. Strum a little harder, one downstroke at a time.',
  uneven: 'Those strums sounded too different from each other, so nothing was saved. Strum the same shape the same way each time.',
};

/** 'x32010' as a row of strings with their frets. */
function shapeEl(shape) {
  return h('div', { class: 'shape' },
    ...[...shape].map((fret, i) => h('span', {}, h('b', {}, fret), 'EADGBe'[i])));
}

export function mountChordCalibrate(root, go) {
  let templates = getChordTemplates(getInputDevice());
  let selected = CHORD_LIBRARY.find((c) => !templates[c.name]) ?? CHORD_LIBRARY[0];
  let capture = null;
  let off = null;
  let timer = 0;
  let gone = false;

  const grid = h('div', { class: 'chord-grid' });
  const title = h('h3', {});
  const shape = h('div', {});
  const message = h('p', {});
  const dots = h('div', { class: 'dots', 'aria-hidden': 'true' });
  const heard = h('p', { class: 'heard', 'aria-live': 'polite' });
  const listenBtn = h('button', { class: 'primary' }, 'Listen');
  const resetBtn = h('button', {}, 'Forget all chords');
  const status = h('div', {});
  const picker = createDevicePicker(() => {
    stopListening();
    stopMic();
    templates = getChordTemplates(getInputDevice());
    render();
  });

  function render() {
    grid.replaceChildren(...CHORD_LIBRARY.map((c) => h('button', {
      class: [c === selected ? 'on' : '', templates[c.name] ? 'done' : ''].join(' ').trim(),
      'aria-pressed': String(c === selected),
      onclick: () => {
        if (capture) return;
        selected = c;
        message.textContent = '';
        render();
      },
    }, c.name, templates[c.name] ? h('small', {}, ' ✓') : '')));
    title.textContent = selected.name;
    shape.replaceChildren(shapeEl(selected.shape));
    const done = CHORD_LIBRARY.filter((c) => templates[c.name]).length;
    listenBtn.textContent = templates[selected.name] ? `Strum ${selected.name} again` : `Strum ${selected.name}`;
    listenBtn.disabled = Boolean(capture);
    resetBtn.disabled = Boolean(capture) || done === 0;
    dots.replaceChildren(...Array.from({ length: STRUMS }, (_, i) =>
      h('span', { class: capture && i < capture.strums.length ? 'on' : '' })));
  }

  function onStrum(strum) {
    if (strum.single) {
      heard.textContent = 'Heard: a single note, not a chord';
      return;
    }
    const [best] = rankChords(strum.chroma, templates);
    heard.textContent = best.score >= MIN_SIMILARITY ? `Heard: ${best.name}` : 'Heard: not sure';
    if (!capture) return;
    capture.strums.push(strum.chroma);
    render();
    if (capture.strums.length >= STRUMS) finish();
  }

  async function listen() {
    if (off) return true;
    try {
      await startMic();
    } catch (err) {
      status.replaceChildren(micError(err));
      return false;
    }
    if (gone) return false;
    picker.refresh();
    const tracker = createStrumTracker();
    off = onFrame((frame) => {
      const strum = tracker.push(frame);
      if (strum) onStrum(strum);
    });
    return true;
  }

  function stopListening() {
    clearTimeout(timer);
    capture = null;
    if (off) off();
    off = null;
  }

  async function start() {
    status.replaceChildren();
    if (!(await listen())) return;
    capture = { chord: selected, strums: [] };
    message.textContent = `Strum ${selected.name} ${STRUMS} times, one downstroke each, letting it ring for about a second.`;
    render();
    timer = setTimeout(finish, TIMEOUT_MS);
  }

  function finish() {
    clearTimeout(timer);
    const { chord, strums } = capture;
    capture = null;
    const r = learnChord(chord.name, strums);
    if (r.ok) {
      setChordTemplate(chord.name, r.template, getInputDevice());
      templates = getChordTemplates(getInputDevice());
      const next = CHORD_LIBRARY.find((c) => !templates[c.name]);
      message.textContent = next ? `Saved ${chord.name}. Next up: ${next.name}.` : `Saved ${chord.name}. Every chord is calibrated.`;
      if (next) selected = next;
    } else if (r.reason === 'unlike') {
      message.textContent = `That did not sound like ${chord.name}, so it was not saved. Check the shape and that the guitar is in tune.`;
    } else {
      message.textContent = RETRY[r.reason];
    }
    render();
  }

  listenBtn.addEventListener('click', start);
  resetBtn.addEventListener('click', () => {
    if (!confirm('Forget every calibrated chord for this input?')) return;
    clearChordTemplates(getInputDevice());
    templates = {};
    message.textContent = 'Forgotten. Fretline uses the built-in chord sounds until you calibrate again.';
    render();
  });

  root.append(
    backButton(go),
    h('h2', {}, 'Chord calibration'),
    picker.el,
    h('p', {}, 'Strum each chord a few times so Fretline learns how it sounds on your guitar. '
      + 'Chords you skip use built-in sounds. E5 and A5 teach it power chords anywhere on the neck.'),
    grid,
    h('div', { class: 'chord-panel' }, title, shape, dots, h('div', { class: 'row' }, listenBtn, resetBtn), message, heard),
    status,
  );
  render();

  return () => {
    gone = true;
    stopListening();
    stopMic();
  };
}
