import { PitchDetector } from 'pitchy';
import { rms, toNote } from '../logic/pitch.js';
import workletUrl from './mic-worklet.js?url';

const WINDOW = 2048;
let ctx = null;
let micReady = null;
const listeners = new Set();

export function getContext() {
  if (!ctx) ctx = new AudioContext({ latencyHint: 'interactive' });
  return ctx;
}

/** Subscribe to analysis frames: { time, note }. Returns an unsubscribe function. */
export function onFrame(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function openMic() {
  const audio = getContext();
  await audio.resume();
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  await audio.audioWorklet.addModule(workletUrl);
  const node = new AudioWorkletNode(audio, 'mic-window');
  const detector = PitchDetector.forFloat32Array(WINDOW);
  node.port.onmessage = ({ data }) => {
    const [hz, clarity] = detector.findPitch(data.samples, audio.sampleRate);
    const note = toNote(hz, clarity, rms(data.samples));
    // Report the window centre, not its end.
    const time = data.endTime - WINDOW / 2 / audio.sampleRate;
    for (const fn of listeners) fn({ time, note });
  };
  audio.createMediaStreamSource(stream).connect(node);
}

/** Start the microphone once; later calls reuse it. Rejects if access is denied. */
export function startMic() {
  if (!micReady) {
    micReady = openMic().catch((err) => {
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
  osc.start(time);
  osc.stop(time + 0.06);
}
