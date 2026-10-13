import { describe, expect, it } from 'vitest';
import { bestsToRows, mergeBests } from '../src/logic/mergeBests.js';

describe('mergeBests', () => {
  it('keeps the higher score from either side', () => {
    const local = { 'a@1': { score: 500, stars: 1 }, 'b@0.5': { score: 900, stars: 3 } };
    const remote = [
      { song_id: 'a', speed: 1, score: 700, stars: 2 },
      { song_id: 'b', speed: 0.5, score: 100, stars: 0 },
      { song_id: 'c', speed: 0.75, score: 300, stars: 1 },
    ];
    expect(mergeBests(local, remote)).toEqual({
      'a@1': { score: 700, stars: 2 },
      'b@0.5': { score: 900, stars: 3 },
      'c@0.75': { score: 300, stars: 1 },
    });
  });
  it('keeps the local entry on a tie', () => {
    const merged = mergeBests({ 'a@1': { score: 5, stars: 2 } }, [{ song_id: 'a', speed: 1, score: 5, stars: 1 }]);
    expect(merged['a@1']).toEqual({ score: 5, stars: 2 });
  });
  it('reads numeric speeds sent as strings', () => {
    expect(mergeBests({}, [{ song_id: 'a', speed: '0.50', score: 1, stars: 0 }])).toEqual({ 'a@0.5': { score: 1, stars: 0 } });
  });
  it('does not mutate its inputs', () => {
    const local = { 'a@1': { score: 1, stars: 0 } };
    const remote = [{ song_id: 'a', speed: 1, score: 9, stars: 1 }];
    const before = JSON.stringify([local, remote]);
    mergeBests(local, remote);
    expect(JSON.stringify([local, remote])).toBe(before);
  });
  it('handles missing inputs', () => {
    expect(mergeBests(null, null)).toEqual({});
    expect(mergeBests({ 'a@1': { score: 1, stars: 0 } }, undefined)).toEqual({ 'a@1': { score: 1, stars: 0 } });
  });
});

describe('bestsToRows', () => {
  it('turns the map into rows with numeric speed', () => {
    expect(bestsToRows({ 'a@0.75': { score: 10, stars: 1 } })).toEqual([{ song_id: 'a', speed: 0.75, score: 10, stars: 1 }]);
  });
  it('splits on the last @ so ids may contain one', () => {
    expect(bestsToRows({ 'x@y@1': { score: 1, stars: 0 } })[0]).toMatchObject({ song_id: 'x@y', speed: 1 });
  });
  it('skips malformed keys and entries', () => {
    expect(bestsToRows({ nokey: { score: 1, stars: 0 }, 'a@zz': { score: 1, stars: 0 }, 'a@1': null })).toEqual([]);
    expect(bestsToRows(null)).toEqual([]);
  });
});
