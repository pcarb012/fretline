import { LOAD_FAILURES } from '../songs/index.js';
import { SPEEDS, hasUnscoredDoubleStops, loadNotice } from '../logic/song.js';
import { isUnlocked } from '../logic/unlock.js';
import { practiceSummary } from '../logic/practiceCard.js';
import { localDay } from '../logic/streak.js';
import { allBest, getBest, getInputDevice, getLatencyMs, getSpeed, setSpeed } from '../store.js';
import { getUser, onAuthChange } from '../backend/auth.js';
import { getSupabase } from '../backend/client.js';
import { fetchPracticeDays, getGoal } from '../backend/practice.js';
import { getCatalog, onListChange } from './catalogState.js';
import { h, starsEl } from './dom.js';

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

/** A song only a premium account can open: no notes to count, no Play. */
function premiumRow(song, speed) {
  const best = getBest(song.id, speed);
  return h(
    'div',
    { class: 'song locked' },
    h('div', {}, h('h3', {}, song.title), h('small', {}, `${song.bpm} BPM`)),
    h('div', { class: 'row' }, starsEl(best ? best.stars : 0),
      h('button', { disabled: '', title: 'Part of the premium library' }, 'Premium')),
  );
}

function practiceCard({ rows, goal }) {
  const s = practiceSummary(rows, goal, localDay());
  const stat = (value, label) => h('div', { class: 'stat' }, h('b', {}, String(value)), label);
  const minutes = Math.round(s.minutes * 10) / 10;
  return h('div', { class: 'practice' },
    h('div', { class: 'practice-stats' },
      stat(s.current, s.current === 1 ? 'Day streak' : 'Days streak'),
      stat(s.best, 'Best streak'),
      h('div', { class: 'stat goal' },
        h('b', {}, `${minutes} / ${s.goal}`), 'Minutes today',
        h('div', {
          class: 'bar', role: 'progressbar', 'aria-label': 'Daily goal',
          'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(s.percent),
        }, h('span', { style: `width: ${s.percent}%` })))),
    h('div', { class: 'week', 'aria-label': 'Practice minutes, last 7 days' },
      ...s.week.map((d) =>
        h('div', { class: 'day', title: `${d.day}: ${Math.round(d.minutes)} min` },
          h('div', { class: 'col' }, h('span', { style: `height: ${d.height}%` })),
          h('small', {}, d.letter)))));
}

export function mountSongList(root, go) {
  let speed = getSpeed();
  const backend = getSupabase() !== null;
  let user = null;
  let gone = false;
  let practiceToken = 0;
  const exercises = h('div', { class: 'songs' });
  const lessons = h('div', { class: 'songs' });
  const speedRow = h('div', { class: 'row' });
  const failures = h('div', { class: 'notice error' });
  const accountBtn = backend ? h('button', { onclick: () => go('account') }, 'Sign in') : null;
  const signInHint = backend
    ? h('p', { class: 'hint' }, 'Sign in to keep your progress on every device.') : null;
  const practice = backend ? h('div', {}) : null;

  function render() {
    const catalog = getCatalog();
    const lessonIds = catalog.lessons.map((l) => l.id);
    const bests = allBest();
    const locked = (kind) => catalog.locked.filter((s) => s.kind === kind).map((s) => premiumRow(s, speed));
    exercises.replaceChildren(...catalog.exercises.map((s) => songRow(s, go, speed)), ...locked('exercise'));
    lessons.replaceChildren(
      ...catalog.lessons.map((s, i) => songRow(s, go, speed, !isUnlocked(i, bests, lessonIds))),
      ...locked('lesson'),
    );
    const failed = [...LOAD_FAILURES, ...catalog.failures];
    failures.textContent = loadNotice(failed);
    failures.hidden = failed.length === 0;
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

  async function renderPractice() {
    const token = ++practiceToken;
    accountBtn.textContent = user ? 'Account' : 'Sign in';
    signInHint.hidden = user !== null;
    if (!user) return practice.replaceChildren();
    practice.replaceChildren(h('p', { class: 'quiet' }, 'Loading your practice...'));
    try {
      const [rows, goal] = await Promise.all([fetchPracticeDays(), getGoal()]);
      if (gone || token !== practiceToken) return;
      practice.replaceChildren(practiceCard({ rows, goal }));
    } catch {
      if (!gone && token === practiceToken) practice.replaceChildren();
    }
  }

  render();
  const stopList = onListChange(() => {
    render();
    if (backend) renderPractice();
  });
  let stopAuth = () => {};
  if (backend) {
    const setUser = (u) => {
      if ((u?.id ?? null) === (user?.id ?? null) && practice.hasChildNodes()) return;
      user = u;
      renderPractice();
    };
    // Supabase must not be called from inside its own auth callback, so hop out of it first.
    stopAuth = onAuthChange((u) => setTimeout(() => !gone && setUser(u), 0));
    getUser().then((u) => !gone && setUser(u));
  }

  root.append(
    h('h1', {}, 'Pick it up. ', h('em', {}, 'Hit every note.')),
    h('p', { class: 'lede' }, 'Fretline listens to your guitar and scores each note as it crosses the line.'),
    signInHint,
    h('div', { class: 'row' },
      h('button', { onclick: () => go('tuner') }, 'Tuner'),
      h('button', { onclick: () => go('calibrate') }, `Calibrate latency (${getLatencyMs(getInputDevice())} ms)`),
      accountBtn),
    practice,
    h('div', { class: 'label' }, 'Speed'),
    speedRow,
    failures,
    h('div', { class: 'label' }, 'Exercises'),
    exercises,
    h('div', { class: 'label' }, 'Blues Masterclass lessons'),
    lessons,
  );

  return () => {
    gone = true;
    stopList();
    stopAuth();
  };
}
