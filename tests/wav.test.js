import { describe, expect, it } from 'vitest';
import { createTakeRecorder, encodeWav } from '../src/logic/wav.js';

const view = (bytes) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const text = (bytes, at, n) => String.fromCharCode(...bytes.slice(at, at + n));

describe('encodeWav', () => {
  it('writes a 16-bit mono PCM header', () => {
    const wav = encodeWav([new Float32Array([0, 0.5, -0.5])], 48000);
    const v = view(wav);
    expect(text(wav, 0, 4)).toBe('RIFF');
    expect(text(wav, 8, 4)).toBe('WAVE');
    expect(v.getUint16(20, true)).toBe(1);
    expect(v.getUint16(22, true)).toBe(1);
    expect(v.getUint32(24, true)).toBe(48000);
    expect(v.getUint16(34, true)).toBe(16);
    expect(v.getUint32(40, true)).toBe(6);
    expect(v.getUint32(4, true)).toBe(wav.length - 8);
    expect(wav.length).toBe(44 + 6);
  });
  it('joins chunks in order and scales samples', () => {
    const wav = encodeWav([new Float32Array([1, -1]), new Float32Array([0.5])], 44100);
    const v = view(wav);
    expect(v.getInt16(44, true)).toBe(32767);
    expect(v.getInt16(46, true)).toBe(-32768);
    expect(v.getInt16(48, true)).toBe(16384);
  });
  it('clips samples outside -1 to 1', () => {
    const v = view(encodeWav([new Float32Array([3, -3])], 8000));
    expect(v.getInt16(44, true)).toBe(32767);
    expect(v.getInt16(46, true)).toBe(-32768);
  });
  it('writes an empty file for no audio', () => {
    expect(encodeWav([], 48000).length).toBe(44);
  });
});

describe('createTakeRecorder', () => {
  it('collects chunks, copies them and reports the length', () => {
    const rec = createTakeRecorder(48000);
    const chunk = new Float32Array([0.25, 0.25]);
    rec.push(chunk);
    chunk[0] = 0.9;
    rec.push(new Float32Array(3));
    expect(rec.sampleCount()).toBe(5);
    expect(rec.seconds()).toBeCloseTo(5 / 48000);
    expect(view(rec.toWav()).getInt16(44, true)).toBe(8192);
  });
  it('stops at the maximum length', () => {
    const rec = createTakeRecorder(10, 1);
    rec.push(new Float32Array(8));
    rec.push(new Float32Array(8));
    expect(rec.sampleCount()).toBe(10);
  });
});
