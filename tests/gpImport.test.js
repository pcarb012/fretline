import * as alphaTab from '@coderline/alphatab';
import { describe, expect, it } from 'vitest';
import { guitarTracks, songFromScore, warp } from '../src/logic/gpImport.js';

const settings = new alphaTab.Settings();

/** Build a score from alphaTex, round-tripped through a Guitar Pro 7 file like an upload. */
function score(tex) {
  const importer = new alphaTab.importer.AlphaTexImporter();
  importer.initFromString(tex, settings);
  const bytes = new alphaTab.exporter.Gp7Exporter().export(importer.readScore(), settings);
  return alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes, settings);
}

const STANDARD = '\\tuning e4 b3 g3 d3 a2 e2';

describe('songFromScore', () => {
  it('converts strings, frets, tempo, chords and rests', () => {
    const s = score(`\\tempo 96 . \\track "Lead" \\staff {tabs} ${STANDARD} . 0.1.4 3.1.4 (5.2 7.3).4 r.4`);
    const { song } = songFromScore(s, { id: 'g', title: 'G' });
    expect(song.bpm).toBe(96);
    expect(song.tuning).toEqual([40, 45, 50, 55, 59, 64]);
    expect(song.notes).toEqual([
      { beat: 0, string: 1, fret: 0, durationBeats: 1 },
      { beat: 1, string: 1, fret: 3, durationBeats: 1 },
      { beat: 2, string: 2, fret: 5, durationBeats: 1 },
      { beat: 2, string: 3, fret: 7, durationBeats: 1, judge: false },
    ]);
  });
  it('extends ties, marks dead notes and adds the capo to the tuning', () => {
    const s = score(`. \\track "G" \\staff {tabs} ${STANDARD} \\capo 2 . 2.5.4 -.5.2 x.6.4`);
    const { song } = songFromScore(s, { id: 'g', title: 'G' });
    expect(song.tuning).toEqual([42, 47, 52, 57, 61, 66]);
    expect(song.notes).toEqual([
      { beat: 0, string: 5, fret: 2, durationBeats: 3 },
      { beat: 3, string: 6, fret: 0, durationBeats: 1, judge: false },
    ]);
  });
  it('keeps section names', () => {
    const s = score(`. \\track "G" \\staff {tabs} ${STANDARD} . \\section "A" 0.1.1 | \\section "B" 0.1.1`);
    expect(songFromScore(s, { id: 'g', title: 'G' }).song.sections).toEqual([
      { beat: 0, name: 'A' }, { beat: 4, name: 'B' },
    ]);
  });
  it('lists only six-string tracks and reports bad input', () => {
    const s = score(`. \\track "Bass" \\staff {tabs} \\tuning g2 d2 a1 e1 . 0.1.4 \\track "Gtr" \\staff {tabs} ${STANDARD} . 0.1.4`);
    expect(guitarTracks(s)).toEqual([{ index: 1, name: 'Gtr' }]);
    expect(songFromScore(s, { id: 'g', title: 'G' }).song.notes).toHaveLength(1);
    expect(songFromScore(s, { id: 'g', title: 'G', trackIndex: 0 }).error).toMatch(/six-string/);
    const rests = score(`. \\track "G" \\staff {tabs} ${STANDARD} . r.1`);
    expect(songFromScore(rests, { id: 'g', title: 'G' }).error).toMatch(/no notes/);
    const high = score(`. \\track "G" \\staff {tabs} ${STANDARD} . 30.1.4`);
    expect(songFromScore(high, { id: 'g', title: 'G' }).error).toMatch(/playable/);
  });
});

describe('warp', () => {
  it('moves the off-beat eighth to two thirds of the beat', () => {
    expect(warp(0)).toBe(0);
    expect(warp(480)).toBe(640);
    expect(warp(960)).toBe(960);
    expect(warp(960 + 720)).toBe(960 + 800);
  });
});
