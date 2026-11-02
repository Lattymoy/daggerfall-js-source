// Catalogue favourites. Kept on this device (appStorage), keyed by the catalogue's
// own id (`m41000`, `f210.3`) — a renamed piece stays a favourite. Never the account.
import { appStorage } from '../appStorage.js';

const KEY = 'dfdecor-fav';
/** A catalogue id, not a display name. */
const ID_RE = /^(?:m\d{1,6}|f\d{1,5}\.\d{1,5})$/;

/** The saved ids, or none when the store is missing or unreadable. */
export function loadDecorFavourites(storage = appStorage()) {
  try {
    const raw = storage?.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.filter((k) => typeof k === 'string' && ID_RE.test(k)) : []);
  } catch {
    return new Set();
  }
}

/** Write `ids`. A store that refuses the write leaves the last good copy. */
export function saveDecorFavourites(ids, storage = appStorage()) {
  try {
    storage?.setItem(KEY, JSON.stringify([...ids]));
    return true;
  } catch {
    return false;
  }
}

export const decorIsFavourite = (key, storage = appStorage()) => loadDecorFavourites(storage).has(key);

/** Mark or unmark `key`. Answers the ids now saved. */
export function toggleDecorFavourite(key, storage = appStorage()) {
  const ids = loadDecorFavourites(storage);
  if (typeof key !== 'string' || !ID_RE.test(key)) return ids;
  if (ids.has(key)) ids.delete(key);
  else ids.add(key);
  saveDecorFavourites(ids, storage);
  return ids;
}
