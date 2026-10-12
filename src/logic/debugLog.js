const DEFAULT_MAX_FRAMES = 12000;
const DEFAULT_MAX_EVENTS = 3000;

const round = (value, places) => {
  if (!Number.isFinite(value)) return null;
  const k = 10 ** places;
  return Math.round(value * k) / k;
};

/**
 * Capped log of detector frames and judging events for one play.
 * Frame times are raw audio-clock seconds; setOrigin() shifts them to song time on export.
 * Event times are already song time. When a cap is hit the oldest entries are dropped.
 */
export function createDebugLog({ maxFrames = DEFAULT_MAX_FRAMES, maxEvents = DEFAULT_MAX_EVENTS } = {}) {
  let frames = [];
  let events = [];
  let dropped = { frames: 0, events: 0 };
  let origin = 0;
  let meta = {};

  function push(list, kind, max, entry) {
    list.push(entry);
    if (list.length > max) {
      list.shift();
      dropped[kind] += 1;
    }
  }

  return {
    setMeta(next) {
      meta = { ...meta, ...next };
    },
    setOrigin(seconds) {
      origin = seconds;
    },
    /** raw = { hz, clarity, rms }; reason is null when the frame was accepted. */
    frame({ time, raw, note, reason }) {
      push(frames, 'frames', maxFrames, {
        t: time,
        hz: round(raw.hz, 2),
        clarity: round(raw.clarity, 3),
        rms: round(raw.rms, 4),
        midi: note ? note.midi : null,
        ok: !reason,
        reason: reason ?? null,
      });
    },
    /** type: 'onset' | 'verdict' | 'miss' | 'unmatched'. */
    event(type, time, data = {}) {
      const rounded = Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, typeof v === 'number' ? round(v, 4) : v]),
      );
      push(events, 'events', maxEvents, { type, t: round(time, 4), ...rounded });
    },
    clear() {
      frames = [];
      events = [];
      dropped = { frames: 0, events: 0 };
    },
    toJSON() {
      return {
        version: 1,
        meta,
        frames: frames.map((f) => ({ ...f, t: round(f.t - origin, 4) })),
        events,
        dropped: { ...dropped },
      };
    },
  };
}
