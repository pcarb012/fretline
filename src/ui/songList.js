import { SONGS } from '../songs/index.js';
import { SPEEDS } from '../logic/song.js';
import { getBest, getLatencyMs, getSpeed, setSpeed } from '../store.js';
import { h, starsEl } from './dom.js';

function songRow(song, go, speed) {
  const best = getBest(song.id, speed);
  return h(
    'div',
    { class: 'song' },
    h('div', {}, h('h3', {}, song.title), h('small', {}, `${song.notes.length} notes, ${song.bpm} BPM`)),
    h('div', { class: 'row' }, starsEl(best ? best.stars : 0),
      h('button', { class: 'primary', onclick: () => go('play', { song, speed }) }, 'Play')),
  );
}

export function mountSongList(root, go) {
  let speed = getSpeed();
  const list = h('div', { class: 'songs' });
  const speedRow = h('div', { class: 'row' });

  function render() {
    list.replaceChildren(...SONGS.map((s) => songRow(s, go, speed)));
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
      h('button', { onclick: () => go('calibrate') }, `Calibrate latency (${getLatencyMs()} ms)`)),
    h('div', { class: 'label' }, 'Speed'),
    speedRow,
    h('div', { class: 'label' }, 'Exercises'),
    list,
  );
}
