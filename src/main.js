import './style.css';
import { mountSongList } from './ui/songList.js';
import { mountPlay } from './ui/play.js';
import { mountResults } from './ui/results.js';
import { mountTuner } from './ui/tuner.js';
import { mountCalibrate } from './ui/calibrate.js';
import { mountDebugPanel } from './ui/debugPanel.js';
import { mountAccount } from './ui/account.js';
import { initDebug, isDebug } from './ui/debugState.js';
import { notifyListChange, setCatalog } from './ui/catalogState.js';
import { EXERCISES, LESSONS } from './songs/index.js';
import { getSupabase } from './backend/client.js';
import { onAuthChange } from './backend/auth.js';
import { loadCatalog } from './backend/catalog.js';
import { syncOnSignIn } from './backend/sync.js';

const root = document.getElementById('app');
const screens = {
  list: mountSongList,
  play: mountPlay,
  results: mountResults,
  tuner: mountTuner,
  calibrate: mountCalibrate,
  account: mountAccount,
};
let cleanup = null;

function go(name, args = {}) {
  if (cleanup) cleanup();
  root.replaceChildren();
  const main = document.createElement('main');
  root.append(main);
  cleanup = screens[name](main, go, args) ?? null;
}

async function refreshCatalog() {
  try {
    setCatalog(await loadCatalog({ exercises: EXERCISES, lessons: LESSONS }));
  } catch {
    // Keep showing the songs we already have.
  }
  notifyListChange();
}

/** With a backend: load the server library, and sync once whenever someone signs in or out. */
function startBackend() {
  if (!getSupabase()) return;
  refreshCatalog();
  let lastId = null;
  onAuthChange((user) => {
    const id = user?.id ?? null;
    if (id === lastId) return; // token refreshes fire this too
    lastId = id;
    // Supabase must not be called from inside its own auth callback, so hop out of it first.
    setTimeout(async () => {
      if (id) await syncOnSignIn().catch(() => {});
      await refreshCatalog();
    }, 0);
  });
}

initDebug();
if (isDebug()) mountDebugPanel();
go('list');
startBackend();
