import { chordGroups, chordMatches } from './chords.js';
import { GOOD_S, judgeNote, judgeTiming, pitchMatches } from './judge.js';
import { expectedMidiList, isJudged, noteTimes } from './song.js';
import { countGrades, maxScore, starsFor, totalScore } from './score.js';

/** Extra time to wait for a late-arriving detection before calling a miss. */
export const MISS_GRACE_S = 0.25;

/**
 * Judging state for one play. Times are seconds from song beat 0.
 * onOnset() judges a heard note, onStrum() a heard chord; tick() turns overdue notes into misses.
 * A chord (see chordGroups) is one scored item, judged only by onStrum.
 * options.toleranceCents overrides the pitch tolerance (debug tuning);
 * options.chordTemplates holds the player's calibrated chords.
 */
export function createSession(song, speed = 1, { toleranceCents, chordTemplates = {} } = {}) {
  const times = noteTimes(song, speed);
  const midis = expectedMidiList(song);
  const results = new Array(times.length).fill(null);
  const judged = song.notes.map(isJudged);
  const chords = chordGroups(song);
  const chordAt = new Map();
  for (const chord of chords) {
    for (const i of chord.members) judged[i] = i === chord.scored;
    if (chord.scored >= 0) chordAt.set(chord.scored, chord);
  }

  /** Record a verdict; for a chord, every note in it shows the same grade. */
  function settle(i, result) {
    for (const j of chordAt.get(i)?.members ?? [i]) results[j] = result;
  }

  function bestCandidate(onset) {
    return times
      .map((t, i) => ({ i, dt: onset.time - t }))
      .filter(({ i, dt }) => judged[i] && !chordAt.has(i) && results[i] === null && Math.abs(dt) <= GOOD_S)
      .filter(({ i }) => pitchMatches(midis[i], onset.midiFloat, toleranceCents))
      .sort((a, b) => Math.abs(a.dt) - Math.abs(b.dt))[0];
  }

  return {
    times,
    results,
    chords,
    onOnset(onset) {
      const best = bestCandidate(onset);
      if (!best) return null;
      const verdict = judgeNote({
        expectedMidi: midis[best.i], midiFloat: onset.midiFloat, dt: best.dt, toleranceCents,
      });
      results[best.i] = { ...verdict, dt: best.dt };
      return { index: best.i, ...results[best.i] };
    },
    /** strum = { time, chroma, single }. Judges the nearest open chord it matches, or returns null. */
    onStrum(strum) {
      if (strum.single) return null;
      const hit = [...chordAt.entries()]
        .map(([i, chord]) => ({ i, chord, dt: strum.time - times[i] }))
        .filter(({ i, dt }) => results[i] === null && Math.abs(dt) <= GOOD_S)
        .sort((a, b) => Math.abs(a.dt) - Math.abs(b.dt))
        .find(({ chord }) => chordMatches(strum.chroma, chord, chordTemplates).ok);
      if (!hit) return null;
      settle(hit.i, { ...judgeTiming(hit.dt), dt: hit.dt });
      return { index: hit.i, name: hit.chord.name, ...results[hit.i] };
    },
    tick(now) {
      const missed = [];
      times.forEach((t, i) => {
        if (judged[i] && results[i] === null && now > t + GOOD_S + MISS_GRACE_S) {
          settle(i, { grade: 'miss', label: 'Miss', dt: null });
          missed.push({ index: i, ...results[i] });
        }
      });
      return missed;
    },
    summary() {
      const grades = results.filter((_, i) => judged[i]).map((r) => r?.grade ?? 'miss');
      const score = totalScore(grades);
      const max = maxScore(judged.filter(Boolean).length);
      return { score, max, stars: starsFor(score, max), counts: countGrades(grades) };
    },
  };
}
