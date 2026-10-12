import { debugDownloads } from './debugPanel.js';
import { h, starsEl } from './dom.js';

export function mountResults(root, go, { song, speed, summary, isBest }) {
  const { score, max, stars, counts } = summary;
  const stat = (label, value, cls = '') =>
    h('div', {}, h('b', { class: cls }, String(value)), label);

  root.append(
    h('div', { class: 'label' }, song.title),
    h('div', { class: 'big orange' }, `${score}`),
    h('p', {}, `out of ${max}${isBest ? ', a new best' : ''}`),
    starsEl(stars),
    h('div', { class: 'counts' },
      stat('Perfect', counts.perfect, 'perfect'),
      stat('Good', counts.good),
      stat('Missed', counts.miss)),
    h('div', { class: 'row' },
      h('button', { class: 'primary', onclick: () => go('play', { song, speed }) }, 'Play again'),
      h('button', { onclick: () => go('list') }, 'All songs')),
    debugDownloads(),
  );
}
