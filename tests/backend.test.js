import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSupabase, setSupabaseForTests } from '../src/backend/client.js';
import { getUser, onAuthChange, signIn, signOut, signUp } from '../src/backend/auth.js';
import { pushBest, syncOnSignIn } from '../src/backend/sync.js';
import { fetchPracticeDays, getGoal, logSession, setGoal } from '../src/backend/practice.js';
import { loadCatalog } from '../src/backend/catalog.js';
import { allBest, getSpeed, getTuning, replaceAllBest, saveBest, setSpeed } from '../src/store.js';
import { fakeSupabase } from './helpers/fakeSupabase.js';

let warn;
beforeEach(() => {
  const data = new Map();
  globalThis.localStorage = {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
  };
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  setSupabaseForTests(undefined);
  delete globalThis.localStorage;
  vi.restoreAllMocks();
});

const use = (opts) => {
  const fake = fakeSupabase(opts);
  setSupabaseForTests(fake);
  return fake;
};

describe('client', () => {
  it('is null without VITE_ settings', () => {
    expect(getSupabase()).toBeNull();
  });
});

describe('with no backend', () => {
  it('every call answers safely', async () => {
    setSupabaseForTests(null);
    expect(await getUser()).toBeNull();
    expect(onAuthChange(() => {})).toBeTypeOf('function');
    expect((await signIn('a', 'b')).user).toBeNull();
    expect((await signUp('a', 'b')).error).toBeTruthy();
    expect(await signOut()).toBe(false);
    expect(await pushBest('a', 1, 5, 1)).toBe(false);
    expect(await syncOnSignIn()).toBe(false);
    expect(await logSession({ songId: 'a', speed: 1, seconds: 30, score: 1, stars: 0 })).toBe(false);
    expect(await fetchPracticeDays()).toEqual([]);
    expect(await getGoal()).toBe(10);
    expect(await setGoal(20)).toBe(false);
    const bundled = { exercises: [{ id: 'e' }], lessons: [] };
    expect((await loadCatalog(bundled)).exercises).toEqual(bundled.exercises);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('auth', () => {
  it('returns the user from the saved session', async () => {
    use();
    expect(await getUser()).toEqual({ id: 'u1' });
  });
  it('is null when signed out', async () => {
    use({ user: null });
    expect(await getUser()).toBeNull();
  });
  it('signs in and up, passing credentials through', async () => {
    const fake = use();
    expect(await signIn('a@b.c', 'pw')).toEqual({ user: { id: 'u1' }, error: null });
    await signUp('a@b.c', 'pw');
    expect(fake.calls.filter((c) => c.table === 'auth').map((c) => c.op)).toEqual(['signIn', 'signUp']);
  });
  it('turns a rejected sign-in into a message', async () => {
    use({ responses: { 'auth.signIn': { data: {}, error: { message: 'Invalid login' } } } });
    expect(await signIn('a', 'b')).toEqual({ user: null, error: 'Invalid login' });
  });
  it('survives a network failure and warns once', async () => {
    use({ throwOn: ['auth.signIn'] });
    const res = await signIn('a', 'b');
    expect(res.user).toBeNull();
    expect(res.error).toMatch(/connection/);
    await signIn('a', 'b');
    expect(warn).toHaveBeenCalledTimes(1);
  });
  it('listens for changes and can stop', () => {
    const fake = use();
    const seen = [];
    const stop = onAuthChange((u) => seen.push(u));
    fake.listeners[0]('SIGNED_IN', { user: { id: 'u1' } });
    fake.listeners[0]('SIGNED_OUT', null);
    expect(seen).toEqual([{ id: 'u1' }, null]);
    stop();
    expect(fake.listeners).toHaveLength(0);
  });
  it('signs out', async () => {
    use();
    expect(await signOut()).toBe(true);
    use({ responses: { 'auth.signOut': { error: { message: 'x' } } } });
    expect(await signOut()).toBe(false);
  });
});

describe('pushBest', () => {
  it('calls save_best and reports a new best', async () => {
    const fake = use({ responses: { 'rpc.save_best': { data: true, error: null } } });
    expect(await pushBest('a', 0.75, 900, 2)).toBe(true);
    expect(fake.calls[0].args).toEqual({ p_song_id: 'a', p_speed: 0.75, p_score: 900, p_stars: 2 });
  });
  it('returns false when signed out or on error', async () => {
    const fake = use({ user: null });
    expect(await pushBest('a', 1, 1, 0)).toBe(false);
    expect(fake.calls).toHaveLength(0);
    use({ throwOn: ['rpc.save_best'] });
    expect(await pushBest('a', 1, 1, 0)).toBe(false);
  });
});

describe('syncOnSignIn', () => {
  const remoteBests = [
    { song_id: 'a', speed: 1, score: 700, stars: 2 },
    { song_id: 'c', speed: 0.5, score: 50, stars: 0 },
  ];

  it('pushes local bests, merges remote ones into storage', async () => {
    saveBest('a', 1, 500, 1);
    saveBest('b', 1, 900, 3);
    const fake = use({
      responses: {
        'best_scores.select': { data: remoteBests, error: null },
        'profiles.select': { data: { settings: {} }, error: null },
      },
    });
    expect(await syncOnSignIn()).toBe(true);
    const pushed = fake.calls.filter((c) => c.op === 'save_best').map((c) => c.args.p_song_id).sort();
    expect(pushed).toEqual(['a', 'b']);
    expect(allBest()).toEqual({
      'a@1': { score: 700, stars: 2 },
      'b@1': { score: 900, stars: 3 },
      'c@0.5': { score: 50, stars: 0 },
    });
  });

  it('pushes local settings when the server has none', async () => {
    setSpeed(0.75);
    const fake = use({
      responses: { 'best_scores.select': { data: [], error: null }, 'profiles.select': { data: { settings: {} }, error: null } },
    });
    await syncOnSignIn();
    const update = fake.calls.find((c) => c.table === 'profiles' && c.op === 'update');
    expect(update.row.settings.speed).toBe(0.75);
    expect(update.filters).toEqual([['id', 'u1']]);
  });

  it('lets remote settings win', async () => {
    setSpeed(1);
    const fake = use({
      responses: {
        'best_scores.select': { data: [], error: null },
        'profiles.select': {
          data: { settings: { speed: 0.5, tuning: { clarityMin: 0.8, rmsGate: 0.02, toleranceCents: 40 } } },
          error: null,
        },
      },
    });
    expect(await syncOnSignIn()).toBe(true);
    expect(getSpeed()).toBe(0.5);
    expect(getTuning().toleranceCents).toBe(40);
    expect(fake.calls.some((c) => c.op === 'update')).toBe(false);
  });

  it('keeps local data and reports false when the pull fails', async () => {
    saveBest('a', 1, 500, 1);
    use({ throwOn: ['best_scores.select', 'profiles.select'] });
    expect(await syncOnSignIn()).toBe(false);
    expect(allBest()).toEqual({ 'a@1': { score: 500, stars: 1 } });
  });

  it('does nothing when signed out', async () => {
    const fake = use({ user: null });
    expect(await syncOnSignIn()).toBe(false);
    expect(fake.calls).toHaveLength(0);
  });
});

describe('store.replaceAllBest', () => {
  it('overwrites the saved bests', () => {
    saveBest('a', 1, 1, 0);
    replaceAllBest({ 'z@1': { score: 9, stars: 1 } });
    expect(allBest()).toEqual({ 'z@1': { score: 9, stars: 1 } });
  });
});

describe('practice', () => {
  it('logs a session with the local day', async () => {
    const fake = use();
    expect(await logSession({ songId: 'a', speed: 1, seconds: 61.6, score: 5, stars: 1 })).toBe(true);
    const row = fake.calls[0].row;
    expect(row).toMatchObject({ user_id: 'u1', song_id: 'a', seconds: 62, score: 5, stars: 1 });
    expect(row.local_day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('caps long sessions and skips empty ones', async () => {
    const fake = use();
    await logSession({ songId: 'a', speed: 1, seconds: 99999, score: 0, stars: 0 });
    expect(fake.calls[0].row.seconds).toBe(7200);
    expect(await logSession({ songId: 'a', speed: 1, seconds: 0.2, score: 0, stars: 0 })).toBe(false);
    expect(fake.calls).toHaveLength(1);
  });
  it('returns false on a server error', async () => {
    use({ responses: { 'practice_sessions.insert': { data: null, error: { message: 'bad' } } } });
    expect(await logSession({ songId: 'a', speed: 1, seconds: 10, score: 0, stars: 0 })).toBe(false);
  });
  it('fetches practice days, newest first', async () => {
    const days = [{ local_day: '2026-10-13', seconds: 60 }];
    const fake = use({ responses: { 'practice_days.select': { data: days, error: null } } });
    expect(await fetchPracticeDays()).toEqual(days);
    expect(fake.calls[0].order).toEqual(['local_day', { ascending: false }]);
  });
  it('returns an empty list when signed out or failing', async () => {
    use({ user: null });
    expect(await fetchPracticeDays()).toEqual([]);
    use({ throwOn: ['practice_days.select'] });
    expect(await fetchPracticeDays()).toEqual([]);
  });
  it('reads the goal, defaulting to 10', async () => {
    use({ responses: { 'profiles.select': { data: { daily_goal_minutes: 25 }, error: null } } });
    expect(await getGoal()).toBe(25);
    use({ throwOn: ['profiles.select'] });
    expect(await getGoal()).toBe(10);
  });
  it('saves the goal within 1 to 240', async () => {
    const fake = use();
    expect(await setGoal(15.4)).toBe(true);
    await setGoal(0);
    await setGoal(9999);
    expect(fake.calls.map((c) => c.row.daily_goal_minutes)).toEqual([15, 1, 240]);
    use({ user: null });
    expect(await setGoal(15)).toBe(false);
  });
});

describe('loadCatalog', () => {
  const note = { beat: 0, string: 1, fret: 0, durationBeats: 1 };
  const bundled = { exercises: [], lessons: [{ id: 'l1', title: 'L1', bpm: 80, tuning: [40, 45, 50, 55, 59, 64], notes: [note] }] };

  it('merges server rows over the bundled songs', async () => {
    const catalog = [
      { id: 'l2', title: 'L2', kind: 'lesson', position: 2, bpm: 90, is_premium: true },
    ];
    const songs = [{ id: 'l0', title: 'L0', kind: 'lesson', position: 1, bpm: 70, tuning: [40, 45, 50, 55, 59, 64], notes: [note], sections: null, is_premium: false }];
    use({ responses: { 'song_catalog.select': { data: catalog, error: null }, 'songs.select': { data: songs, error: null } } });
    const out = await loadCatalog(bundled);
    expect(out.lessons.map((s) => s.id)).toEqual(['l0', 'l1']);
    expect(out.locked.map((s) => s.id)).toEqual(['l2']);
  });
  it('keeps the bundled songs when a fetch fails', async () => {
    use({ throwOn: ['song_catalog.select'] });
    expect((await loadCatalog(bundled)).lessons).toEqual(bundled.lessons);
    use({ responses: { 'song_catalog.select': { data: [], error: null } }, throwOn: ['songs.select'] });
    const out = await loadCatalog(bundled);
    expect(out.lessons).toEqual(bundled.lessons);
    expect(out.locked).toEqual([]);
  });
});
