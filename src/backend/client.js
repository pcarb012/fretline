import { createClient } from '@supabase/supabase-js';

let client;
let warned = false;

function build() {
  const url = import.meta.env?.VITE_SUPABASE_URL;
  const key = import.meta.env?.VITE_SUPABASE_ANON_KEY;
  return url && key ? createClient(url, key) : null;
}

/** The Supabase client, or null when the site has no backend settings. */
export function getSupabase() {
  if (client === undefined) client = build();
  return client;
}

/** Tests inject a fake client here; pass undefined to reset. */
export function setSupabaseForTests(fake) {
  client = fake;
  warned = false;
}

/** Log a backend problem once so a bad network does not flood the console. */
export function warnOnce(where, error) {
  if (warned) return;
  warned = true;
  console.warn(`Fretline backend: ${where} failed`, error?.message ?? error);
}

/**
 * Run fn(supabase) and return its result, or null when there is no client or the call fails.
 * Supabase returns errors in { error } rather than throwing, so both are handled.
 */
export async function safely(where, fn) {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const result = await fn(sb);
    if (result?.error) throw result.error;
    return result;
  } catch (error) {
    warnOnce(where, error);
    return null;
  }
}
