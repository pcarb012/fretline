export const POINTS = { perfect: 100, good: 60, miss: 0 };
const STAR_STEPS = [0.9, 0.75, 0.5];

export const maxScore = (noteCount) => noteCount * POINTS.perfect;

export function totalScore(grades) {
  return grades.reduce((sum, g) => sum + (POINTS[g] ?? 0), 0);
}

export function starsFor(score, max) {
  if (max <= 0) return 0;
  const ratio = score / max;
  const hit = STAR_STEPS.findIndex((step) => ratio >= step);
  return hit === -1 ? 0 : 3 - hit;
}

export function countGrades(grades) {
  const counts = { perfect: 0, good: 0, miss: 0 };
  for (const g of grades) counts[g] += 1;
  return counts;
}
