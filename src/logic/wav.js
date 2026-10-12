const HEADER_BYTES = 44;
const DEFAULT_MAX_SECONDS = 600;

/** Join Float32 chunks into a 16-bit mono PCM WAV file (Uint8Array). */
export function encodeWav(chunks, sampleRate) {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const bytes = new Uint8Array(HEADER_BYTES + total * 2);
  const view = new DataView(bytes.buffer);
  const text = (at, s) => [...s].forEach((ch, i) => view.setUint8(at + i, ch.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + total * 2, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, total * 2, true);
  let at = HEADER_BYTES;
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i++, at += 2) {
      const s = Math.max(-1, Math.min(1, chunk[i]));
      view.setInt16(at, s < 0 ? Math.round(s * 32768) : Math.round(s * 32767), true);
    }
  }
  return bytes;
}

/** Collects mic samples for a "take". Chunks are copied; recording stops at the maximum length. */
export function createTakeRecorder(sampleRate, maxSeconds = DEFAULT_MAX_SECONDS) {
  const maxSamples = Math.floor(sampleRate * maxSeconds);
  const chunks = [];
  let count = 0;
  return {
    push(samples) {
      const room = maxSamples - count;
      if (room <= 0) return;
      const copy = Float32Array.from(samples.subarray(0, room));
      chunks.push(copy);
      count += copy.length;
    },
    sampleCount: () => count,
    seconds: () => count / sampleRate,
    toWav: () => encodeWav(chunks, sampleRate),
  };
}
