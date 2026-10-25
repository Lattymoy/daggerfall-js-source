// The decorator's hotbar. Ten catalogue pieces, the same 1-0 the character's bar uses,
// kept on this device (appStorage), in the catalogue's own ids (`m41000`, `f210.3`).
// Never a placed piece, never the account.
import { appStorage } from '../appStorage.js';

const KEY = 'dfdecor-hotbar';
export const DECOR_HOT_SLOTS = 10;
/** A catalogue id, not a placed piece and not a display name. */
const ID_RE = /^(?:m\d{1,6}|f\d{1,5}\.\d{1,5})$/;

export const decorHotId = (key) => typeof key === 'string' && ID_RE.test(key);

const empty = () => Array(DECOR_HOT_SLOTS).fill(null);

/** The ten saved ids, empty slots null. A shorter save grows; a longer one is cut. */
export function loadDecorHotbar(storage = appStorage()) {
  try {
    const raw = storage?.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    const out = empty();
    if (!Array.isArray(list)) return out;
    for (let i = 0; i < DECOR_HOT_SLOTS; i++) out[i] = decorHotId(list[i]) ? list[i] : null;
    return out;
  } catch {
    return empty();
  }
}

/** Write `slots`. A store that refuses the write leaves the last good copy. */
export function saveDecorHotbar(slots, storage = appStorage()) {
  try {
    const out = Array.from({ length: DECOR_HOT_SLOTS }, (_, i) => (decorHotId(slots?.[i]) ? slots[i] : null));
    storage?.setItem(KEY, JSON.stringify(out));
    return true;
  } catch {
    return false;
  }
}
