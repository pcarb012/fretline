import { describe, expect, it } from 'vitest';
import { mergeCatalog } from '../src/logic/catalog.js';

const note = { beat: 0, string: 1, fret: 0, durationBeats: 1 };
const song = (id, extra = {}) => ({ id, title: id.toUpperCase(), bpm: 80, tuning: [40, 45, 50, 55, 59, 64], notes: [note], ...extra });
const row = (id, kind, position, extra = {}) => ({ ...song(id), kind, position, is_premium: false, ...extra });

const bundled = { exercises: [song('e1'), song('e2')], lessons: [song('l1'), song('l2')] };

describe('mergeCatalog', () => {
  it('returns bundled unchanged when offline', () => {
    const out = mergeCatalog(bundled, null, null);
    expect(out.exercises).toEqual(bundled.exercises);
    expect(out.lessons).toEqual(bundled.lessons);
    expect(out.locked).toEqual([]);
    expect(out.failures).toEqual([]);
  });
  it('lets server songs override bundled by id and sort first', () => {
    const out = mergeCatalog(bundled, [], [row('e2', 'exercise', 1, { title: 'Server E2' })]);
    expect(out.exercises.map((s) => s.title)).toEqual(['Server E2', 'E1']);
  });
  it('orders server songs by position and strips table columns', () => {
    const songs = [row('l9', 'lesson', 2), row('l8', 'lesson', 1)];
    const out = mergeCatalog(bundled, [], songs);
    expect(out.lessons.map((s) => s.id)).toEqual(['l8', 'l9', 'l1', 'l2']);
    expect(out.lessons[0]).not.toHaveProperty('kind');
    expect(out.lessons[0]).not.toHaveProperty('is_premium');
  });
  it('drops songs the validator rejects and lists them', () => {
    const bad = row('bad', 'lesson', 1, { notes: [] });
    const out = mergeCatalog(bundled, [], [bad, row('ok', 'lesson', 2)]);
    expect(out.failures).toEqual(['bad']);
    expect(out.lessons.map((s) => s.id)).toEqual(['ok', 'l1', 'l2']);
  });
  it('hides the bundled copy of a premium song the player cannot load', () => {
    const catalog = [{ id: 'l2', title: 'L2', kind: 'lesson', position: 1, bpm: 80, is_premium: true }];
    const out = mergeCatalog(bundled, catalog, []);
    expect(out.lessons.map((s) => s.id)).toEqual(['l1']);
    expect(out.locked.map((s) => s.id)).toEqual(['l2']);
  });
  it('drops a song with an unknown kind', () => {
    const out = mergeCatalog(bundled, [], [row('w', 'weird', 1)]);
    expect(out.failures).toEqual(['w']);
  });
  it('keeps the bundled copy when the server copy is invalid', () => {
    const out = mergeCatalog(bundled, [], [row('l1', 'lesson', 1, { notes: [] })]);
    expect(out.lessons.map((s) => s.id)).toEqual(['l1', 'l2']);
    expect(out.lessons[0]).toEqual(bundled.lessons[0]);
  });
  it('accepts null sections and string bpm from the database', () => {
    const out = mergeCatalog(bundled, [], [row('z', 'exercise', 1, { sections: null, bpm: '90' })]);
    expect(out.failures).toEqual([]);
    expect(out.exercises[0].bpm).toBe(90);
    expect(out.exercises[0]).not.toHaveProperty('sections');
  });
  it('makes locked entries for premium catalog rows with no song row', () => {
    const catalog = [
      { id: 'p2', title: 'Premium Two', kind: 'lesson', position: 2, bpm: 100, is_premium: true },
      { id: 'p1', title: 'Premium One', kind: 'exercise', position: 1, bpm: 90, is_premium: true },
      { id: 'free', title: 'Free', kind: 'lesson', position: 3, bpm: 80, is_premium: false },
      { id: 'l1', title: 'L1', kind: 'lesson', position: 4, bpm: 80, is_premium: true },
    ];
    const out = mergeCatalog(bundled, catalog, [row('l1', 'lesson', 4, { is_premium: true })]);
    expect(out.locked).toEqual([
      { id: 'p1', title: 'Premium One', kind: 'exercise', bpm: 90, locked: true },
      { id: 'p2', title: 'Premium Two', kind: 'lesson', bpm: 100, locked: true },
    ]);
  });
  it('treats missing song rows as none', () => {
    const out = mergeCatalog(bundled, [{ id: 'p', title: 'P', kind: 'lesson', position: 1, bpm: 1, is_premium: true }], null);
    expect(out.locked).toHaveLength(1);
    expect(out.lessons).toEqual(bundled.lessons);
  });
});
