/**
 * A small stand-in for the Supabase client.
 * responses maps `table.op` (op: select, insert, update) or `rpc.name` to { data, error }.
 * Every call is logged in `calls`. Set throwOn to a key to make that call reject.
 */
export function fakeSupabase({ user = { id: 'u1' }, responses = {}, throwOn = [] } = {}) {
  const calls = [];
  const answer = (key) => {
    if (throwOn.includes(key)) return Promise.reject(new Error(`network down: ${key}`));
    return Promise.resolve(responses[key] ?? { data: null, error: null });
  };
  const builder = (table) => {
    const call = { table, op: 'select', args: [], filters: [] };
    calls.push(call);
    const b = {
      select: (...a) => { call.args.push(...a); return b; },
      insert: (row) => { call.op = 'insert'; call.row = row; return b; },
      update: (row) => { call.op = 'update'; call.row = row; return b; },
      eq: (...a) => { call.filters.push(a); return b; },
      order: (...a) => { call.order = a; return b; },
      limit: (n) => { call.limit = n; return b; },
      maybeSingle: () => b,
      then: (ok, bad) => answer(`${table}.${call.op}`).then(ok, bad),
    };
    return b;
  };
  const listeners = [];
  return {
    calls,
    listeners,
    from: builder,
    rpc: (name, args) => {
      calls.push({ table: 'rpc', op: name, args });
      return answer(`rpc.${name}`);
    },
    auth: {
      getSession: async () => ({ data: { session: user ? { user } : null } }),
      onAuthStateChange: (cb) => {
        listeners.push(cb);
        return { data: { subscription: { unsubscribe: () => listeners.splice(listeners.indexOf(cb), 1) } } };
      },
      signUp: async (creds) => { calls.push({ table: 'auth', op: 'signUp', args: creds }); return responses['auth.signUp'] ?? { data: { user }, error: null }; },
      signInWithPassword: async (creds) => {
        if (throwOn.includes('auth.signIn')) throw new Error('network down');
        calls.push({ table: 'auth', op: 'signIn', args: creds });
        return responses['auth.signIn'] ?? { data: { user }, error: null };
      },
      signOut: async () => responses['auth.signOut'] ?? { error: null },
    },
  };
}
