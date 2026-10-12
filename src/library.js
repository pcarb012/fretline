// Uploaded songs and backing tracks, kept in this browser with IndexedDB.
// songs:  key song.id, value the song object
// tracks: key song id, value { blob, name, offsetS, volume }

const DB_NAME = 'fretline';
const STORES = ['songs', 'tracks'];
let dbPromise = null;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        for (const name of STORES) if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }).catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

async function run(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Uploaded songs, oldest first. Resolves to [] when storage is unavailable. */
export async function listSongs() {
  try {
    const songs = await run('songs', 'readonly', (s) => s.getAll());
    return songs.sort((a, b) => (a.addedAt ?? 0) - (b.addedAt ?? 0));
  } catch {
    return [];
  }
}

export const saveSong = (song) => run('songs', 'readwrite', (s) => s.put({ addedAt: Date.now(), ...song }, song.id));

export async function deleteSong(id) {
  await run('songs', 'readwrite', (s) => s.delete(id));
  await deleteTrack(id);
}

/** The backing track for a song, or null. */
export async function getTrack(songId) {
  try {
    return (await run('tracks', 'readonly', (s) => s.get(songId))) ?? null;
  } catch {
    return null;
  }
}

/** Ids of songs that have a backing track. */
export async function trackIds() {
  try {
    return new Set(await run('tracks', 'readonly', (s) => s.getAllKeys()));
  } catch {
    return new Set();
  }
}

export const saveTrack = (songId, track) => run('tracks', 'readwrite', (s) => s.put(track, songId));

export const deleteTrack = (songId) => run('tracks', 'readwrite', (s) => s.delete(songId));
