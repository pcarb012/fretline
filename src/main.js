import './style.css';
import { mountSongList } from './ui/songList.js';
import { mountPlay } from './ui/play.js';
import { mountResults } from './ui/results.js';
import { mountTuner } from './ui/tuner.js';
import { mountCalibrate } from './ui/calibrate.js';
import { mountChordCalibrate } from './ui/chordCalibrate.js';
import { mountUpload } from './ui/upload.js';
import { mountDebugPanel } from './ui/debugPanel.js';
import { initDebug, isDebug } from './ui/debugState.js';

const root = document.getElementById('app');
const screens = {
  list: mountSongList,
  play: mountPlay,
  results: mountResults,
  tuner: mountTuner,
  calibrate: mountCalibrate,
  chords: mountChordCalibrate,
  upload: mountUpload,
};
let cleanup = null;

function go(name, args = {}) {
  if (cleanup) cleanup();
  root.replaceChildren();
  const main = document.createElement('main');
  root.append(main);
  cleanup = screens[name](main, go, args) ?? null;
}

initDebug();
if (isDebug()) mountDebugPanel();
go('list');
