// @ts-check
// SD-ONELIFE, AUDIT SD III (H1) - THE HOLLOWS' SLOTS KEPT ON THE DEVICE: the Hours I went through (the Rift admits me again
// during their collapse) and the Hours I died in (it never does), by the signed-in account (bible/11-Multiplayer/
// Super-Dungeons.md). Out of scenes/world.js bootWorld whole (WITCH1, 2026-10-20 - the host's room for the Witches'
// Festival's wiring, HOST-SPLIT); the world host keeps the two memories it makes of it.
import { appStorage } from '../appStorage.js';
import { SD_ENTERED_MAX } from '../../world/superDungeon/sdDungeon.js';
import { SD_REZ_MS } from '../../net/superDungeon/sdLaw.js';   // SD-REZ: the realm's window for a friend's Resurrect

/** SD-REZ: the page gives up on a raise this long before the realm's window shuts - a rise asked at its edge would be
 *  refused at the door (ms). */
export const SD_REZ_PAGE_SLACK_MS = 10_000;

/** A set of Hollows' slots kept on the device under `key`, its last SD_ENTERED_MAX (a store that refuses: the session's).
 *  AUDIT SD III (H1): ONE ACCOUNT'S - under the signed-in account's own key (`<key>:<id>`; with none, the device's, as it
 *  was), as the realm keeps its dead by the token's account (SD_NO_FALLEN): one account's death refused another on the
 *  same device a Hollow its realm would admit. And READ AS IT IS ASKED - a second tab's write merged, never written
 *  over: each tab wrote its own boot-time copy back over the other's. A read the store has not changed is not parsed
 *  again.
 *  `me()` the signed-in account's id (null: none), `storage()` the store (systems/appStorage.js's).
 *  SD-REZ (EVENT-RULES, 2026-10-25, the owner: "Resurrect allowed"): and a slot let go again - `rise(s)`, the body a friend
 *  raised in the Hour it fell in, inside the realm's window (`mayRise(s)`: the last add of `s`, SD_REZ_MS less the page's
 *  slack ago at most; a slot never added, or none, may always).
 * @param {string} key @param {() => string|null|undefined} me @param {() => any} [storage] @param {() => number} [clock]
 * @returns {{ has: (s: number) => boolean, add: (s: number) => void, mayRise: (s: number|null|undefined) => boolean, rise: (s: number|null|undefined) => void }} */
export function sdSlotsKept(key, me, storage = appStorage, clock = () => Date.now()) {
  const read = new Map(), own = new Map();   // per key: the store's last read ({ raw, set }), and this session's own adds
  /** SD-REZ: the last slot added and its moment. @type {{ s: number, at: number } | null} */
  let last = null;
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
      if (last?.s !== s) last = { s, at: clock() };   // AUDIT WORLD-EVENTS L1-6: the death's own moment - the world host adds the slot every frame of the death screen, and the window it stamped never shut (a rise clears it, so a second death stamps its own)
      if (!own.has(k)) own.set(k, new Set());
      own.get(k).add(s);
      const now = stored(k);
      if (now.has(s)) return;
      try { storage()?.setItem?.(k, JSON.stringify([...now, s].slice(-SD_ENTERED_MAX))); } catch { /* this session's memory holds it */ }
    },
    mayRise: (s) => s == null || last?.s !== s || clock() - last.at <= SD_REZ_MS - SD_REZ_PAGE_SLACK_MS,
    rise: (s) => {
      if (s == null || last?.s !== s || clock() - last.at > SD_REZ_MS - SD_REZ_PAGE_SLACK_MS) return;   // past the window the realm keeps the death - so does the page
      last = null;
      const k = keyNow();
      own.get(k)?.delete(s);
      const now = stored(k);
      if (!now.has(s)) return;
      try { storage()?.setItem?.(k, JSON.stringify([...now].filter((x) => x !== s))); } catch { /* this session's memory holds it */ }
    },
  };
}
