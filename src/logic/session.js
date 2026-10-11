import { GOOD_S, judgeNote, pitchMatches } from './judge.js';
import { expectedMidiList, noteTimes } from './song.js';
import { countGrades, maxScore, starsFor, totalScore } from './score.js';

/** Extra time to wait for a late-arriving detection before calling a miss. */
export const MISS_GRACE_S = 0.25;

/**
 * Judging state for one play. Times are seconds from song beat 0.
 * onOnset() judges a heard note; tick() turns overdue notes into misses.
 */
export function createSession(song, speed = 1) {
  const times = noteTimes(song, speed);
  const midis = expectedMidiList(song);
  const results = new Array(times.length).fill(null);

  function bestCandidate(onset) {
    return times
      .map((t, i) => ({ i, dt: onset.time - t }))
      .filter(({ i, dt }) => results[i] === null && Math.abs(dt) <= GOOD_S)
      .filter(({ i }) => pitchMatches(midis[i], onset.midiFloat))
      .sort((a, b) => Math.abs(a.dt) - Math.abs(b.dt))[0];
  }

  return {
    times,
    results,
    onOnset(onset) {
      const best = bestCandidate(onset);
      if (!best) return null;
      const verdict = judgeNote({ expectedMidi: midis[best.i], midiFloat: onset.midiFloat, dt: best.dt });
      results[best.i] = { ...verdict, dt: best.dt };
      return { index: best.i, ...results[best.i] };
    },
    tick(now) {
      const missed = [];
      times.forEach((t, i) => {
        if (results[i] === null && now > t + GOOD_S + MISS_GRACE_S) {
          results[i] = { grade: 'miss', label: 'Miss', dt: null };
          missed.push({ index: i, ...results[i] });
        }
      });
      return missed;
    },
    summary() {
      const grades = results.map((r) => r?.grade ?? 'miss');
      const score = totalScore(grades);
      const max = maxScore(times.length);
      return { score, max, stars: starsFor(score, max), counts: countGrades(grades) };
    },
  };
}
