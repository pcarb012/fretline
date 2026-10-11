import { GOOD_S, judgeNote, pitchMatches } from './judge.js';
import { expectedMidiList, isJudged, judgedCount, noteTimes } from './song.js';
import { countGrades, maxScore, starsFor, totalScore } from './score.js';

/** Extra time to wait for a late-arriving detection before calling a miss. */
export const MISS_GRACE_S = 0.25;

/**
 * Judging state for one play. Times are seconds from song beat 0.
 * onOnset() judges a heard note; tick() turns overdue notes into misses.
 * options.toleranceCents overrides the pitch tolerance (debug tuning).
 */
export function createSession(song, speed = 1, { toleranceCents } = {}) {
  const times = noteTimes(song, speed);
  const midis = expectedMidiList(song);
  const results = new Array(times.length).fill(null);
  const judged = song.notes.map(isJudged);

  function bestCandidate(onset) {
    return times
      .map((t, i) => ({ i, dt: onset.time - t }))
      .filter(({ i, dt }) => judged[i] && results[i] === null && Math.abs(dt) <= GOOD_S)
      .filter(({ i }) => pitchMatches(midis[i], onset.midiFloat, toleranceCents))
      .sort((a, b) => Math.abs(a.dt) - Math.abs(b.dt))[0];
  }

  return {
    times,
    results,
    onOnset(onset) {
      const best = bestCandidate(onset);
      if (!best) return null;
      const verdict = judgeNote({
        expectedMidi: midis[best.i], midiFloat: onset.midiFloat, dt: best.dt, toleranceCents,
      });
      results[best.i] = { ...verdict, dt: best.dt };
      return { index: best.i, ...results[best.i] };
    },
    tick(now) {
      const missed = [];
      times.forEach((t, i) => {
        if (judged[i] && results[i] === null && now > t + GOOD_S + MISS_GRACE_S) {
          results[i] = { grade: 'miss', label: 'Miss', dt: null };
          missed.push({ index: i, ...results[i] });
        }
      });
      return missed;
    },
    summary() {
      const grades = results.filter((_, i) => judged[i]).map((r) => r?.grade ?? 'miss');
      const score = totalScore(grades);
      const max = maxScore(judgedCount(song));
      return { score, max, stars: starsFor(score, max), counts: countGrades(grades) };
    },
  };
}
