import { deleteTrack, getTrack, saveSong, saveTrack } from '../library.js';
import { guitarTracks, songFromScore } from '../logic/gpImport.js';
import { parseAsciiTab, parseSongJson, titleFromFileName, userSongId } from '../logic/tabImport.js';
import { backButton, h } from './dom.js';

const GP_EXT = /\.(gp|gp3|gp4|gp5|gpx)$/i;
const TAB_ACCEPT = '.gp,.gp3,.gp4,.gp5,.gpx,.txt,.tab,.json';

/** Parse a Guitar Pro file with alphaTab, loaded only when needed (it is large). */
async function readScore(file) {
  const alphaTab = await import('@coderline/alphatab');
  const bytes = new Uint8Array(await file.arrayBuffer());
  return alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes, new alphaTab.Settings());
}

const field = (label, input, hint) =>
  h('div', { class: 'field' }, h('label', {}, label, input), hint ? h('small', {}, hint) : null);

/** Backing-track inputs. Returns the element and read(), which gives the track to save or null. */
function backingFields(existing) {
  const file = h('input', { type: 'file', accept: 'audio/*' });
  const offset = h('input', { type: 'number', step: '0.01', value: String(existing?.offsetS ?? 0) });
  const volume = h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(existing?.volume ?? 0.8) });
  const current = existing ? h('small', {}, `Current track: ${existing.name}`) : null;
  const el = h('div', {},
    h('div', { class: 'label' }, 'Backing track'),
    field('Audio file ', file, 'MP3, WAV, OGG or M4A. It stays in this browser.'),
    current,
    field('Beat 1 starts at (seconds into the audio) ', offset,
      'Use this to skip an intro or line the track up with the tab. Tune it until the notes land on the beat.'),
    field('Volume ', volume));
  return {
    el,
    read() {
      const blob = file.files[0];
      if (!blob && !existing) return null;
      return {
        blob: blob ?? existing.blob,
        name: blob ? blob.name : existing.name,
        offsetS: Number(offset.value) || 0,
        volume: Number(volume.value),
      };
    },
  };
}

/** Edit the backing track of an existing song. */
async function mountTrackEditor(root, go, song) {
  const existing = await getTrack(song.id);
  const backing = backingFields(existing);
  const status = h('div', {});
  const save = async () => {
    const track = backing.read();
    if (!track) return status.replaceChildren(h('div', { class: 'notice error' }, 'Choose an audio file first.'));
    try {
      await saveTrack(song.id, track);
      go('list');
    } catch {
      status.replaceChildren(h('div', { class: 'notice error' }, 'Could not save the track. The browser may be out of storage.'));
    }
  };
  const remove = async () => {
    await deleteTrack(song.id);
    go('list');
  };
  root.append(
    backButton(go),
    h('h2', {}, song.title),
    backing.el,
    status,
    h('div', { class: 'row' },
      h('button', { class: 'primary', onclick: save }, 'Save'),
      existing ? h('button', { onclick: remove }, 'Remove track') : ''),
  );
}

/** Upload a new tab (Guitar Pro, plain-text tab or Fretline JSON), with an optional backing track. */
function mountTabUpload(root, go) {
  const file = h('input', { type: 'file', accept: TAB_ACCEPT });
  const title = h('input', { type: 'text', placeholder: 'Song title' });
  const options = h('div', {});
  const preview = h('div', {});
  const backing = backingFields(null);
  let parse = null; // () => { song } | { error }

  const show = () => {
    if (!parse) return preview.replaceChildren();
    const result = parse();
    preview.replaceChildren(result.error
      ? h('div', { class: 'notice error' }, result.error)
      : h('div', { class: 'notice' }, `Ready: ${result.song.notes.length} notes at ${result.song.bpm} BPM.`));
  };
  title.addEventListener('input', show);

  function asciiOptions(text) {
    const bpm = h('input', { type: 'number', min: '20', max: '300', value: '80' });
    const rhythm = h('select', {},
      h('option', { value: 'even' }, 'Every note the same length'),
      h('option', { value: 'spacing' }, 'Follow the spacing in the tab'));
    const amount = h('input', { type: 'number', min: '0.125', step: '0.125', value: '1' });
    const amountLabel = h('span', {});
    const syncLabel = () => {
      amountLabel.textContent = rhythm.value === 'even' ? 'Beats per note ' : 'Characters per beat ';
      amount.value = rhythm.value === 'even' ? '1' : '4';
    };
    syncLabel();
    rhythm.addEventListener('change', () => {
      syncLabel();
      show();
    });
    for (const input of [bpm, amount]) input.addEventListener('input', show);
    options.replaceChildren(
      field('Tempo (BPM) ', bpm),
      field('Rhythm ', rhythm, 'Text tab has no rhythm, so pick how to time the notes.'),
      h('div', { class: 'field' }, h('label', {}, amountLabel, amount)),
    );
    return () => parseAsciiTab(text, {
      id: 'preview',
      title: title.value.trim() || 'Untitled',
      bpm: Number(bpm.value),
      rhythm: rhythm.value,
      noteBeats: Number(amount.value),
      columnsPerBeat: Number(amount.value),
    });
  }

  function gpOptions(score) {
    const tracks = guitarTracks(score);
    const pick = h('select', {}, ...tracks.map((t) => h('option', { value: String(t.index) }, t.name)));
    pick.addEventListener('change', show);
    options.replaceChildren(tracks.length > 1 ? field('Track ', pick) : '');
    if (score.title) title.value = score.title;
    return () => songFromScore(score, {
      id: 'preview',
      title: title.value.trim() || 'Untitled',
      trackIndex: tracks.length ? Number(pick.value) : undefined,
    });
  }

  file.addEventListener('change', async () => {
    const f = file.files[0];
    parse = null;
    options.replaceChildren();
    if (!f) return show();
    title.value = titleFromFileName(f.name);
    preview.replaceChildren(h('div', { class: 'notice' }, 'Reading…'));
    try {
      if (GP_EXT.test(f.name)) {
        parse = gpOptions(await readScore(f));
      } else {
        const text = await f.text();
        parse = /\.json$/i.test(f.name) || text.trimStart().startsWith('{')
          ? () => parseSongJson(text, { id: 'preview', title: title.value.trim() })
          : asciiOptions(text);
      }
    } catch {
      parse = () => ({ error: 'Could not read that file. Is it a Guitar Pro (.gp3 to .gp7), text tab or JSON file?' });
    }
    show();
  });

  const status = h('div', {});
  const save = async () => {
    const result = parse?.();
    if (!result || result.error) return status.replaceChildren(h('div', { class: 'notice error' }, result?.error ?? 'Choose a tab file first.'));
    const song = { ...result.song, id: userSongId(result.song.title) };
    try {
      await saveSong(song);
      const track = backing.read();
      if (track) await saveTrack(song.id, track);
      go('list');
    } catch {
      status.replaceChildren(h('div', { class: 'notice error' }, 'Could not save. The browser may be out of storage.'));
    }
  };

  root.append(
    backButton(go),
    h('h2', {}, 'Upload a tab'),
    h('p', { class: 'lede' }, 'Guitar Pro files (.gp3 to .gp7), plain-text tab or Fretline JSON. Uploads are kept in this browser only.'),
    h('div', { class: 'label' }, 'Tab'),
    field('File ', file),
    field('Title ', title),
    options,
    preview,
    backing.el,
    status,
    h('div', { class: 'row' }, h('button', { class: 'primary', onclick: save }, 'Save song')),
  );
}

/** args.song set: edit that song's backing track. Otherwise: upload a new tab. */
export function mountUpload(root, go, args = {}) {
  if (args.song) mountTrackEditor(root, go, args.song);
  else mountTabUpload(root, go);
}
