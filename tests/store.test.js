import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getInputDevice, getLatencyMs, getTuning, setInputDevice, setLatencyMs, setTuning,
} from '../src/store.js';

beforeEach(() => {
  const data = new Map();
  globalThis.localStorage = {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
  };
});
afterEach(() => {
  delete globalThis.localStorage;
});

describe('latency per device', () => {
  it('stores each device on its own key', () => {
    setLatencyMs(120.4, 'usb');
    setLatencyMs(45, 'mic');
    expect(getLatencyMs('usb')).toBe(120);
    expect(getLatencyMs('mic')).toBe(45);
    expect(localStorage.getItem('fretline.latencyMs.usb')).toBe('120');
  });
  it('falls back to the old single value, then to zero', () => {
    expect(getLatencyMs('usb')).toBe(0);
    localStorage.setItem('fretline.latencyMs', '80');
    expect(getLatencyMs('usb')).toBe(80);
    expect(getLatencyMs()).toBe(80);
  });
  it('prefers the device value over the old one', () => {
    localStorage.setItem('fretline.latencyMs', '80');
    setLatencyMs(30, 'usb');
    expect(getLatencyMs('usb')).toBe(30);
  });
  it('uses a default key when no device is chosen', () => {
    setLatencyMs(70);
    expect(localStorage.getItem('fretline.latencyMs.default')).toBe('70');
    expect(getLatencyMs()).toBe(70);
  });
});

describe('input device', () => {
  it('remembers the chosen device and clears it', () => {
    expect(getInputDevice()).toBe('');
    setInputDevice('abc');
    expect(getInputDevice()).toBe('abc');
    setInputDevice('');
    expect(getInputDevice()).toBe('');
  });
});

describe('tuning settings', () => {
  it('defaults, saves and clamps', () => {
    expect(getTuning().clarityMin).toBe(0.9);
    setTuning({ clarityMin: 0.8, rmsGate: 0.02, toleranceCents: 40 });
    expect(getTuning()).toEqual({ clarityMin: 0.8, rmsGate: 0.02, toleranceCents: 40 });
    localStorage.setItem('fretline.tuning', '{bad json');
    expect(getTuning().rmsGate).toBe(0.01);
  });
});

describe('blocked storage', () => {
  it('still answers when localStorage throws', () => {
    globalThis.localStorage = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    };
    expect(getLatencyMs('x')).toBe(0);
    expect(getTuning().clarityMin).toBe(0.9);
    expect(() => setTuning({})).not.toThrow();
  });
});
