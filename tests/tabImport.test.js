import { describe, expect, it } from 'vitest';
import {
  judgeTopNotes, labelMidi, parseAsciiTab, parseSongJson, titleFromFileName, userSongId,
} from '../src/logic/tabImport.js';
import { STANDARD_TUNING } from '../src/logic/music.js';

const opts = { id: 'x', title: 'T', bpm: 90 };
const tab = `
Intro riff
e|-------0-----|
B|-----1-------|
G|---0---------|
D|-2-----------|
A|-------------|
E|-------------|
`;

describe('parseAsciiTab', () => {
  it('reads notes high e first, one beat each by default', () => {
    const { song, error } = parseAsciiTab(tab, opts);
    expect(error).toBeUndefined();
    expect(song.tuning).toEqual(STANDARD_TUNING);
    expect(song.notes).toEqual([
      { beat: 0, string: 4, fret: 2, durationBeats: 1 },
      { beat: 1, string: 3, fret: 0, durationBeats: 1 },
      { beat: 2, string: 2, fret: 1, durationBeats: 1 },
      { beat: 3, string: 1, fret: 0, durationBeats: 1 },
    ]);
  });
  it('uses the tab spacing when asked', () => {
    const { song } = parseAsciiTab(tab, { ...opts, rhythm: 'spacing', columnsPerBeat: 2 });
    expect(song.notes.map((n) => n.beat)).toEqual([0.5, 1.5, 2.5, 3.5]);
    expect(song.notes.map((n) => n.durationBeats)).toEqual([1, 1, 1, 3]);
  });
  it('joins blocks, reads two-digit frets, chords and dead notes', () => {
    const text = `e|--12--|\nB|--10--|\nG|------|\nD|------|\nA|------|\nE|--x---|\n\ne|-3--|\nB|----|\nG|----|\nD|----|\nA|----|\nE|----|`;
    const { song } = parseAsciiTab(text, { ...opts, noteBeats: 0.5 });
    expect(song.notes).toEqual([
      { beat: 0, string: 1, fret: 12, durationBeats: 0.5 },
      { beat: 0, string: 2, fret: 10, durationBeats: 0.5, judge: false },
      { beat: 0, string: 6, fret: 0, durationBeats: 0.5, judge: false },
      { beat: 0.5, string: 1, fret: 3, durationBeats: 0.5 },
    ]);
  });
  it('takes the tuning from string labels', () => {
    const text = 'e|-0--|\nB|----|\nG|----|\nD|----|\nA|----|\nD|-0--|';
    expect(parseAsciiTab(text, opts).song.tuning).toEqual([38, 45, 50, 55, 59, 64]);
    const flat = 'eb|-0--|\nbb|----|\ngb|----|\ndb|----|\nab|----|\neb|----|';
    expect(parseAsciiTab(flat, opts).song.tuning).toEqual([39, 44, 49, 54, 58, 63]);
  });
  it('explains what is wrong', () => {
    expect(parseAsciiTab('just some words', opts).error).toMatch(/No tab found/);
    expect(parseAsciiTab(tab, { ...opts, bpm: 0 }).error).toMatch(/tempo/);
    expect(parseAsciiTab(tab, { ...opts, rhythm: 'spacing', columnsPerBeat: 0 }).error).toMatch(/per beat/);
    const empty = Array(6).fill('|-----|').join('\n');
    expect(parseAsciiTab(empty, opts).error).toMatch(/no fret numbers/);
    const dead = `e|-x--|\n${Array(5).fill('|---|').join('\n')}`;
    expect(parseAsciiTab(dead, opts).error).toMatch(/playable/);
  });
  it('ignores lines that are not tab and needs six lines', () => {
    expect(parseAsciiTab('e|--0--|\nB|--1--|', opts).error).toMatch(/No tab found/);
  });
});

describe('judgeTopNotes', () => {
  it('judges only the highest pitch at each beat', () => {
    const notes = [
      { beat: 0, string: 5, fret: 3, durationBeats: 1 },
      { beat: 0, string: 4, fret: 2, durationBeats: 1 },
      { beat: 1, string: 1, fret: 0, durationBeats: 1, judge: false },
      { beat: 1, string: 6, fret: 0, durationBeats: 1 },
    ];
    expect(judgeTopNotes(notes, STANDARD_TUNING).map((n) => n.judge)).toEqual([false, undefined, false, undefined]);
  });
});

describe('labelMidi', () => {
  it('picks the octave nearest the standard string', () => {
    expect(labelMidi('D', 40)).toBe(38);
    expect(labelMidi('C#', 45)).toBe(49);
    expect(labelMidi('H', 40)).toBeNull();
  });
});

describe('parseSongJson', () => {
  const song = { id: 'orig', title: 'Orig', bpm: 80, tuning: STANDARD_TUNING, notes: [{ beat: 0, string: 1, fret: 0, durationBeats: 1 }] };
  it('accepts a valid song with a new id', () => {
    expect(parseSongJson(JSON.stringify(song), { id: 'new', title: '' }).song).toMatchObject({ id: 'new', title: 'Orig' });
    expect(parseSongJson(JSON.stringify(song), { id: 'new', title: 'Mine' }).song.title).toBe('Mine');
  });
  it('rejects broken JSON and invalid songs', () => {
    expect(parseSongJson('{nope', { id: 'a' }).error).toMatch(/not valid JSON/);
    expect(parseSongJson('{"bpm":80}', { id: 'a' }).error).toMatch(/not a valid Fretline song/);
  });
});

describe('names', () => {
  it('makes readable unique ids and titles from file names', () => {
    expect(userSongId('My Song!', () => 0.5)).toBe('user-my-song-i');
    expect(userSongId('???', () => 0.123456)).toMatch(/^user-song-/);
    expect(titleFromFileName('C:\\tabs\\Blues in A.gp5')).toBe('Blues in A');
  });
});
