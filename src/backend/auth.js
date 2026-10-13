import { getSupabase, warnOnce } from './client.js';

const NO_BACKEND = 'Sign-in is not available right now.';

/** The signed-in user, or null. Reads the saved session, so it needs no network. */
export async function getUser() {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data } = await sb.auth.getSession();
    return data?.session?.user ?? null;
  } catch (error) {
    warnOnce('getUser', error);
    return null;
  }
}

/** Call cb(user) now and on every sign-in or sign-out. Returns a function that stops listening. */
export function onAuthChange(cb) {
  const sb = getSupabase();
  if (!sb) return () => {};
  try {
    const { data } = sb.auth.onAuthStateChange((_event, session) => cb(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  } catch (error) {
    warnOnce('onAuthChange', error);
    return () => {};
  }
}

/** Run an auth call and answer { user, error } where error is a message for the player, or null. */
async function authCall(where, call) {
  const sb = getSupabase();
  if (!sb) return { user: null, error: NO_BACKEND };
  try {
    const { data, error } = await call(sb.auth);
    return { user: data?.user ?? null, error: error ? error.message : null };
  } catch (error) {
    warnOnce(where, error);
    return { user: null, error: 'Could not reach the server. Check your connection.' };
  }
}

export const signUp = (email, password) => authCall('signUp', (auth) => auth.signUp({ email, password }));

export const signIn = (email, password) =>
  authCall('signIn', (auth) => auth.signInWithPassword({ email, password }));

/** True when the player is signed out afterwards. */
export async function signOut() {
  const sb = getSupabase();
  if (!sb) return false;
  try {
    const { error } = await sb.auth.signOut();
    return !error;
  } catch (error) {
    warnOnce('signOut', error);
    return false;
  }
}
