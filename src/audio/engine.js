import { PitchDetector } from 'pitchy';
import { CLARITY_MIN, RMS_GATE, rejectReason, rms, toNote } from '../logic/pitch.js';
import { getInputDevice, setInputDevice } from '../store.js';
import workletUrl from './mic-worklet.js?url';

const WINDOW = 2048;
const HOP = 1024; // must match mic-worklet.js
const AUDIO_CONSTRAINTS = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
let ctx = null;
let micReady = null;
let mic = null;
let generation = 0;
const listeners = new Set();
const taps = new Set();
let detectorTuning = { clarityMin: CLARITY_MIN, rmsGate: RMS_GATE };
const clicks = new Set();

export function getContext() {
  if (!ctx) ctx = new AudioContext({ latencyHint: 'interactive' });
  return ctx;
}

/**
 * Subscribe to analysis frames. Returns an unsubscribe function.
 * Frame: { time, note, raw: { hz, clarity, rms }, reason, fresh, sampleRate }.
 * reason says why note is null ('gate', 'clarity', 'range'); fresh is the new mic samples since the last frame.
 */
export function onFrame(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Like onFrame, but it survives stopMic(). The debug panel uses it. */
export function tapFrames(fn) {
  taps.add(fn);
  return () => taps.delete(fn);
}

/** Change the detector thresholds (debug tuning). Takes effect on the next frame. */
export function configureDetector({ clarityMin, rmsGate }) {
  detectorTuning = { clarityMin, rmsGate };
}

function emit(frame) {
  for (const fn of [...taps, ...listeners]) {
    try {
      fn(frame);
    } catch {
      // One broken listener must not stop the others or the audio stream.
    }
  }
}

function releaseMic(parts) {
  if (parts.node) {
    parts.node.port.onmessage = null;
    parts.node.disconnect();
  }
  if (parts.source) parts.source.disconnect();
  if (parts.stream) parts.stream.getTracks().forEach((t) => t.stop());
}

/** Open the chosen input; a saved device that is gone falls back to the default one. */
async function openStream() {
  const deviceId = getInputDevice();
  const audio = deviceId ? { ...AUDIO_CONSTRAINTS, deviceId: { exact: deviceId } } : AUDIO_CONSTRAINTS;
  try {
    return await navigator.mediaDevices.getUserMedia({ audio });
  } catch (err) {
    if (!deviceId || err.name !== 'OverconstrainedError') throw err;
    setInputDevice('');
    return navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS });
  }
}

async function openMic(token) {
  const audio = getContext();
  await audio.resume();
  const parts = { stream: null, source: null, node: null };
  try {
    parts.stream = await openStream();
    await audio.audioWorklet.addModule(workletUrl);
    if (token !== generation) throw new DOMException('Microphone closed', 'AbortError');
    parts.node = new AudioWorkletNode(audio, 'mic-window');
    const detector = PitchDetector.forFloat32Array(WINDOW);
    let first = true;
    parts.node.port.onmessage = ({ data }) => {
      const [hz, clarity] = detector.findPitch(data.samples, audio.sampleRate);
      const level = rms(data.samples);
      const { clarityMin, rmsGate } = detectorTuning;
      const reason = rejectReason(hz, clarity, level, rmsGate, clarityMin);
      const note = reason ? null : toNote(hz, clarity, level, rmsGate, clarityMin);
      // Windows overlap by one hop, so only the last hop is new (the whole first window is).
      const fresh = first ? data.samples : data.samples.subarray(WINDOW - HOP);
      first = false;
      // Report the window centre, not its end.
      emit({
        time: data.endTime - WINDOW / 2 / audio.sampleRate,
        note,
        raw: { hz, clarity, rms: level },
        reason,
        fresh,
        sampleRate: audio.sampleRate,
      });
    };
    parts.source = audio.createMediaStreamSource(parts.stream);
    parts.source.connect(parts.node);
    mic = parts;
  } catch (err) {
    releaseMic(parts);
    throw err;
  }
}

/** Start the microphone once; later calls reuse it. Rejects if access is denied. */
export function startMic() {
  if (!micReady) {
    micReady = openMic(generation).catch((err) => {
      micReady = null;
      throw err;
    });
  }
  return micReady;
}

/** Schedule a short click at an AudioContext time. */
export function click(time, high = false) {
  const audio = getContext();
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.frequency.value = high ? 1760 : 1100;
  gain.gain.setValueAtTime(0.4, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
  osc.connect(gain).connect(audio.destination);
  clicks.add(osc);
  osc.onended = () => clicks.delete(osc);
  osc.start(time);
  osc.stop(time + 0.06);
}

/** Cancel clicks that have not played yet. */
export function stopClicks() {
  for (const osc of clicks) {
    try {
      osc.stop();
    } catch {
      // Already stopped.
    }
  }
  clicks.clear();
}

/** Release the microphone and audio context. Safe to call at any time. */
export function stopMic() {
  generation += 1;
  stopClicks();
  if (mic) releaseMic(mic);
  mic = null;
  micReady = null;
  listeners.clear();
  if (ctx) ctx.close().catch(() => {});
  ctx = null;
}
