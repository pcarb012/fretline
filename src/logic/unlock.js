/**
 * Lesson N+1 opens when lesson N has at least one star at any speed.
 * bests is the saved map keyed `${songId}@${speed}`; lessonIds are in lesson order.
 */
export function isUnlocked(lessonIndex, bests, lessonIds) {
  if (lessonIndex <= 0) return true;
  const prefix = `${lessonIds[lessonIndex - 1]}@`;
  return Object.entries(bests).some(([key, best]) => key.startsWith(prefix) && best?.stars >= 1);
}
