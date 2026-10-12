// Play a backing track in time with a song.
// At full speed the decoded audio is scheduled on the AudioContext clock, sample-accurate.
// Slowed down, an <audio> element plays it so the pitch stays the same; it is started on
// a timer and nudged once if it lands more than DRIFT_S off.
import { backingPosition, backingStart } from '../logic/backing.js';

const DRIFT_S = 0.03;

/** Decode a stored track ahead of time. Returns { buffer, url } (buffer only at full speed). */
export async function prepareBacking(ctx, track, speed) {
  if (speed === 1) return { buffer: await ctx.decodeAudioData(await track.blob.arrayBuffer()) };
  return { url: URL.createObjectURL(track.blob) };
}

/**
 * Start the prepared track so audio position track.offsetS plays at songStart.
 * Returns a stop function.
 */
export function startBacking(ctx, prepared, track, { songStart, speed }) {
  const gain = ctx.createGain();
  gain.gain.value = track.volume ?? 1;
  gain.connect(ctx.destination);
  const { when, offset } = backingStart({ now: ctx.currentTime, songStart, offsetS: track.offsetS, rate: speed });

  if (prepared.buffer) {
    const src = ctx.createBufferSource();
    src.buffer = prepared.buffer;
    src.connect(gain);
    src.start(when, offset);
    return () => {
      try {
        src.stop();
      } catch {
        // Already stopped.
      }
      gain.disconnect();
    };
  }

  const el = new Audio(prepared.url);
  el.preservesPitch = true;
  el.playbackRate = speed;
  el.currentTime = offset;
  const node = ctx.createMediaElementSource(el);
  node.connect(gain);
  el.addEventListener('playing', () => {
    const expected = backingPosition(ctx.currentTime, songStart, track.offsetS, speed);
    if (Math.abs(el.currentTime - expected) > DRIFT_S) el.currentTime = expected;
  }, { once: true });
  const timer = setTimeout(() => el.play().catch(() => {}), Math.max(0, (when - ctx.currentTime) * 1000));
  return () => {
    clearTimeout(timer);
    el.pause();
    node.disconnect();
    gain.disconnect();
    URL.revokeObjectURL(prepared.url);
  };
}
