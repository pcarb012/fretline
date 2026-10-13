import { mergeCatalog } from '../logic/catalog.js';
import { safely } from './client.js';

/**
 * Fetch the server library and merge it over the bundled songs ({ exercises, lessons }).
 * If either fetch fails, or there is no backend, the bundled songs come back unchanged.
 */
export async function loadCatalog(bundled) {
  const catalog = await safely('fetch catalog', (sb) =>
    sb.from('song_catalog').select('id, title, kind, position, bpm, is_premium'));
  const songs = catalog && await safely('fetch songs', (sb) =>
    sb.from('songs').select('id, title, kind, position, bpm, tuning, sections, notes, is_premium'));
  if (!catalog || !songs) return mergeCatalog(bundled, null, null);
  return mergeCatalog(bundled, catalog.data, songs.data);
}
