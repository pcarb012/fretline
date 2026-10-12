import { deleteSong, listSongs, trackIds } from '../library.js';
import { EXERCISES, LESSONS, LOAD_FAILURES } from '../songs/index.js';
import { SPEEDS, hasUnscoredDoubleStops, loadNotice } from '../logic/song.js';
import { isUnlocked } from '../logic/unlock.js';
import { CHORD_LIBRARY } from '../logic/chords.js';
import {
  allBest, getBest, getChordTemplates, getInputDevice, getLatencyMs, getSpeed, setSpeed,
} from '../store.js';
import { h, starsEl } from './dom.js';

const LESSON_IDS = LESSONS.map((l) => l.id);

function songRow(song, go, speed, { locked = false, hasTrack = false, onDelete = null } = {}) {
  const best = getBest(song.id, speed);
  const note = hasUnscoredDoubleStops(song) ? ' - some notes are not scored' : '';
  const action = locked
    ? h('button', { disabled: '', title: 'Earn one star on the lesson before it' }, 'Locked')
    : h('button', { class: 'primary', onclick: () => go('play', { song, speed }) }, 'Play');
  const track = h('button', {
    class: hasTrack ? 'on' : '',
    title: hasTrack ? 'Change or remove the backing track' : 'Add a backing track',
    onclick: () => go('upload', { song }),
  }, hasTrack ? 'Track ✓' : '+ Track');
  const remove = onDelete ? h('button', { onclick: onDelete }, 'Delete') : null;
  return h(
    'div',
    { class: locked ? 'song locked' : 'song' },
    h('div', {}, h('h3', {}, song.title),
      h('small', {}, `${song.notes.length} notes, ${song.bpm} BPM${hasTrack ? ', backing track' : ''}${note}`)),
    h('div', { class: 'row' }, starsEl(best ? best.stars : 0), track, remove, action),
  );
}

const chordsDone = () => {
  const saved = getChordTemplates(getInputDevice());
  return CHORD_LIBRARY.filter((c) => saved[c.name]).length;
};

export function mountSongList(root, go) {
  let speed = getSpeed();
  const exercises = h('div', { class: 'songs' });
  const lessons = h('div', { class: 'songs' });
  const mine = h('div', { class: 'songs' });
  const speedRow = h('div', { class: 'row' });
  let uploads = [];
  let withTrack = new Set();

  const remove = (song) => async () => {
    if (!confirm(`Delete "${song.title}" and its backing track?`)) return;
    await deleteSong(song.id);
    await refresh();
  };

  function render() {
    const bests = allBest();
    const opts = (song, extra = {}) => ({ hasTrack: withTrack.has(song.id), ...extra });
    mine.replaceChildren(...(uploads.length
      ? uploads.map((s) => songRow(s, go, speed, opts(s, { onDelete: remove(s) })))
      : [h('p', { class: 'empty' }, 'Nothing yet. Upload a Guitar Pro file or a text tab.')]));
    exercises.replaceChildren(...EXERCISES.map((s) => songRow(s, go, speed, opts(s))));
    lessons.replaceChildren(
      ...LESSONS.map((s, i) => songRow(s, go, speed, opts(s, { locked: !isUnlocked(i, bests, LESSON_IDS) }))),
    );
    speedRow.replaceChildren(
      ...SPEEDS.map((s) =>
        h('button', {
          class: s === speed ? 'on' : '',
          onclick: () => {
            speed = s;
            setSpeed(s);
            render();
          },
        }, `${s * 100}%`),
      ),
    );
  }
  async function refresh() {
    [uploads, withTrack] = await Promise.all([listSongs(), trackIds()]);
    render();
  }
  render();
  refresh();

  root.append(
    h('h1', {}, 'Pick it up. ', h('em', {}, 'Hit every note.')),
    h('p', { class: 'lede' }, 'Fretline listens to your guitar and scores each note as it crosses the line.'),
    h('div', { class: 'row' },
      h('button', { onclick: () => go('tuner') }, 'Tuner'),
      h('button', { onclick: () => go('calibrate') }, `Calibrate latency (${getLatencyMs(getInputDevice())} ms)`),
      h('button', { onclick: () => go('chords') }, `Calibrate chords (${chordsDone()}/${CHORD_LIBRARY.length})`),
      h('button', { onclick: () => go('upload') }, 'Upload a tab')),
    h('div', { class: 'label' }, 'Speed'),
    speedRow,
    LOAD_FAILURES.length ? h('div', { class: 'notice error' }, loadNotice(LOAD_FAILURES)) : '',
    h('div', { class: 'label' }, 'Your songs'),
    mine,
    h('div', { class: 'label' }, 'Exercises'),
    exercises,
    h('div', { class: 'label' }, 'Blues Masterclass lessons'),
    lessons,
  );
}
