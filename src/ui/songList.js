import { SONGS } from '../songs/index.js';
import { SPEEDS } from '../logic/song.js';
import { getBest, getLatencyMs } from '../store.js';
import { h, starsEl } from './dom.js';

let speed = 1;

function songRow(song, go, getSpeed) {
  const best = getBest(song.id);
  return h(
    'div',
    { class: 'song' },
    h('div', {}, h('h3', {}, song.title), h('small', {}, `${song.notes.length} notes, ${song.bpm} BPM`)),
    h('div', { class: 'row' }, starsEl(best ? best.stars : 0),
      h('button', { class: 'primary', onclick: () => go('play', { song, speed: getSpeed() }) }, 'Play')),
  );
}

function speedPicker(onChange) {
  const wrap = h('div', { class: 'row' });
  const buttons = SPEEDS.map((s) =>
    h('button', {
      class: s === speed ? 'on' : '',
      onclick: () => {
        speed = s;
        onChange();
        buttons.forEach((b, i) => b.classList.toggle('on', SPEEDS[i] === speed));
      },
    }, `${s * 100}%`),
  );
  wrap.append(...buttons);
  return wrap;
}

export function mountSongList(root, go) {
  const title = h('h1', {}, 'Pick it up. ', h('em', {}, 'Hit every note.'));
  root.append(
    title,
    h('p', { class: 'lede' }, 'Fretline listens to your guitar and scores each note as it crosses the line.'),
    h('div', { class: 'row' },
      h('button', { onclick: () => go('tuner') }, 'Tuner'),
      h('button', { onclick: () => go('calibrate') }, `Calibrate latency (${getLatencyMs()} ms)`)),
    h('div', { class: 'label' }, 'Speed'),
    speedPicker(() => {}),
    h('div', { class: 'label' }, 'Exercises'),
    h('div', { class: 'songs' }, ...SONGS.map((s) => songRow(s, go, () => speed))),
  );
}
