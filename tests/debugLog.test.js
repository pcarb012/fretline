import { describe, expect, it } from 'vitest';
import { createDebugLog } from '../src/logic/debugLog.js';

const accepted = { hz: 220.04, clarity: 0.9734, rms: 0.0512 };

describe('createDebugLog', () => {
  it('records accepted and rejected frames with the reason', () => {
    const log = createDebugLog();
    log.frame({ time: 1, raw: accepted, note: { midi: 57 }, reason: null });
    log.frame({ time: 1.02, raw: { hz: 80, clarity: 0.5, rms: 0.02 }, note: null, reason: 'clarity' });
    const { frames } = log.toJSON();
    expect(frames).toHaveLength(2);
    expect(frames[0]).toMatchObject({ hz: 220.04, clarity: 0.973, rms: 0.0512, midi: 57, ok: true, reason: null });
    expect(frames[1]).toMatchObject({ midi: null, ok: false, reason: 'clarity' });
  });
  it('handles a frame with no usable detector values', () => {
    const log = createDebugLog();
    log.frame({ time: 0, raw: { hz: NaN, clarity: 0, rms: 0 }, note: null, reason: 'range' });
    expect(log.toJSON().frames[0].hz).toBeNull();
  });
  it('records events in order with their type', () => {
    const log = createDebugLog();
    log.event('onset', 2, { midiFloat: 57.02 });
    log.event('verdict', 2, { index: 0, label: 'Perfect', dt: 0.011 });
    log.event('miss', 3, { index: 1 });
    log.event('unmatched', 4, { midiFloat: 60 });
    expect(log.toJSON().events.map((e) => e.type)).toEqual(['onset', 'verdict', 'miss', 'unmatched']);
    expect(log.toJSON().events[1]).toMatchObject({ t: 2, index: 0, label: 'Perfect', dt: 0.011 });
  });
  it('rounds event numbers to keep the file small', () => {
    const log = createDebugLog();
    log.event('verdict', 1.234567891, { dt: -0.0123456789, index: 3, label: 'Early' });
    expect(log.toJSON().events[0]).toEqual({ type: 'verdict', t: 1.2346, dt: -0.0123, index: 3, label: 'Early' });
  });
  it('subtracts the origin from frame times only', () => {
    const log = createDebugLog();
    log.frame({ time: 10.5, raw: accepted, note: null, reason: 'gate' });
    log.event('miss', 11, { index: 0 });
    log.setOrigin(10);
    const json = log.toJSON();
    expect(json.frames[0].t).toBe(0.5);
    expect(json.events[0].t).toBe(11);
  });
  it('keeps only the newest entries past the cap and counts the dropped', () => {
    const log = createDebugLog({ maxFrames: 3, maxEvents: 2 });
    for (let i = 0; i < 5; i++) log.frame({ time: i, raw: accepted, note: null, reason: 'gate' });
    for (let i = 0; i < 4; i++) log.event('miss', i, { index: i });
    const json = log.toJSON();
    expect(json.frames.map((f) => f.t)).toEqual([2, 3, 4]);
    expect(json.events.map((e) => e.index)).toEqual([2, 3]);
    expect(json.dropped).toEqual({ frames: 2, events: 2 });
  });
  it('carries meta and survives a JSON round trip', () => {
    const log = createDebugLog();
    log.setMeta({ songId: 'open-strings', speed: 0.5 });
    log.frame({ time: 0, raw: accepted, note: null, reason: 'gate' });
    const copy = JSON.parse(JSON.stringify(log.toJSON()));
    expect(copy.meta).toEqual({ songId: 'open-strings', speed: 0.5 });
    expect(copy.version).toBe(1);
  });
  it('clears everything', () => {
    const log = createDebugLog();
    log.frame({ time: 0, raw: accepted, note: null, reason: 'gate' });
    log.event('miss', 0, {});
    log.clear();
    const json = log.toJSON();
    expect(json.frames).toEqual([]);
    expect(json.events).toEqual([]);
    expect(json.dropped).toEqual({ frames: 0, events: 0 });
  });
});
