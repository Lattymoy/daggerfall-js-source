// @ts-check
// SD-ONELIFE, AUDIT SD III (H1) - THE HOLLOWS' SLOTS KEPT ON THE DEVICE: the Hours I went through (the Rift admits me again
// during their collapse) and the Hours I died in (it never does), by the signed-in account (bible/11-Multiplayer/
// Super-Dungeons.md). Out of scenes/world.js bootWorld whole (WITCH1, 2026-10-20 - the host's room for the Witches'
// Festival's wiring, HOST-SPLIT); the world host keeps the two memories it makes of it.
import { appStorage } from '../appStorage.js';
import { SD_ENTERED_MAX } from '../../world/superDungeon/sdDungeon.js';

/** A set of Hollows' slots kept on the device under `key`, its last SD_ENTERED_MAX (a store that refuses: the session's).
 *  AUDIT SD III (H1): ONE ACCOUNT'S - under the signed-in account's own key (`<key>:<id>`; with none, the device's, as it
 *  was), as the realm keeps its dead by the token's account (SD_NO_FALLEN): one account's death refused another on the
 *  same device a Hollow its realm would admit. And READ AS IT IS ASKED - a second tab's write merged, never written
 *  over: each tab wrote its own boot-time copy back over the other's. A read the store has not changed is not parsed
 *  again.
 *  `me()` the signed-in account's id (null: none), `storage()` the store (systems/appStorage.js's).
 * @param {string} key @param {() => string|null|undefined} me @param {() => any} [storage]
 * @returns {{ has: (s: number) => boolean, add: (s: number) => void }} */
export function sdSlotsKept(key, me, storage = appStorage) {
  const read = new Map(), own = new Map();   // per key: the store's last read ({ raw, set }), and this session's own adds
  const keyNow = () => { const id = me(); return id ? `${key}:${id}` : key; };
  const stored = (k) => {
    let raw = null;
    try { raw = storage()?.getItem?.(k) ?? null; } catch { raw = null; }
    let r = read.get(k);
    if (!r || r.raw !== raw) {
      let list = [];
      try { const v = JSON.parse(raw ?? '[]'); if (Array.isArray(v)) list = v.filter(Number.isSafeInteger); } catch { list = []; }
      r = { raw, set: new Set(list) };
      read.set(k, r);
    }
    return r.set;
  };
  return {
    has: (s) => { const k = keyNow(); return stored(k).has(s) || !!own.get(k)?.has(s); },
    add: (s) => {
      const k = keyNow();
      if (!own.has(k)) own.set(k, new Set());
      own.get(k).add(s);
      const now = stored(k);
      if (now.has(s)) return;
      try { storage()?.setItem?.(k, JSON.stringify([...now, s].slice(-SD_ENTERED_MAX))); } catch { /* this session's memory holds it */ }
    },
  };
}
