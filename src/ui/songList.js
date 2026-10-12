import { EXERCISES, LESSONS, LOAD_FAILURES } from '../songs/index.js';
import { SPEEDS, hasUnscoredDoubleStops, loadNotice } from '../logic/song.js';
import { isUnlocked } from '../logic/unlock.js';
import { allBest, getBest, getInputDevice, getLatencyMs, getSpeed, setSpeed } from '../store.js';
import { h, starsEl } from './dom.js';

const LESSON_IDS = LESSONS.map((l) => l.id);

function songRow(song, go, speed, locked = false) {
  const best = getBest(song.id, speed);
  const note = hasUnscoredDoubleStops(song) ? ' - some notes are not scored' : '';
  const action = locked
    ? h('button', { disabled: '', title: 'Earn one star on the lesson before it' }, 'Locked')
    : h('button', { class: 'primary', onclick: () => go('play', { song, speed }) }, 'Play');
  return h(
    'div',
    { class: locked ? 'song locked' : 'song' },
    h('div', {}, h('h3', {}, song.title),
      h('small', {}, `${song.notes.length} notes, ${song.bpm} BPM${note}`)),
    h('div', { class: 'row' }, starsEl(best ? best.stars : 0), action),
  );
}

export function mountSongList(root, go) {
  let speed = getSpeed();
  const exercises = h('div', { class: 'songs' });
  const lessons = h('div', { class: 'songs' });
  const speedRow = h('div', { class: 'row' });

  function render() {
    const bests = allBest();
    exercises.replaceChildren(...EXERCISES.map((s) => songRow(s, go, speed)));
    lessons.replaceChildren(
      ...LESSONS.map((s, i) => songRow(s, go, speed, !isUnlocked(i, bests, LESSON_IDS))),
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
  render();

  root.append(
    h('h1', {}, 'Pick it up. ', h('em', {}, 'Hit every note.')),
    h('p', { class: 'lede' }, 'Fretline listens to your guitar and scores each note as it crosses the line.'),
    h('div', { class: 'row' },
      h('button', { onclick: () => go('tuner') }, 'Tuner'),
      h('button', { onclick: () => go('calibrate') }, `Calibrate latency (${getLatencyMs(getInputDevice())} ms)`)),
    h('div', { class: 'label' }, 'Speed'),
    speedRow,
    LOAD_FAILURES.length ? h('div', { class: 'notice error' }, loadNotice(LOAD_FAILURES)) : null,
    h('div', { class: 'label' }, 'Exercises'),
    exercises,
    h('div', { class: 'label' }, 'Blues Masterclass lessons'),
    lessons,
  );
}
