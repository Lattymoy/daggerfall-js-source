// @ts-check
// LEGACY1 (bible/06-Systems/Legacy-Arc.md section 3): WHERE A FAMILY LIVES, and THE BIRTH'S HANDOFF.
//
// Offline a family is its own record in app storage (`dagger.legacy.family.<id>`) - it outlives any one save, so a
// member's save deleted takes nothing of the line with it - and a copy rides every member's save (`modData`), the
// newer by `rev` winning wherever the two meet (family.js newerFamily). The Hall of Ancestors lists the store.
//
// A BIRTH crosses a reload: the dead's world is torn down and the heir's is built by the boot (`?legacyborn=`). What
// the boot needs - which family, which person, the estate - waits in the TAB's storage (sessionStorage: it survives
// the reload and dies with the tab, so a birth is never taken up by another tab or a later visit).
//
// Storage is handed in (systems/appStorage.js appStorage / tabStorage), so this is headless-testable; every read and
// write is shielded, because storage throws under some privacy modes and a family must never cost the player a game.
import { readFamily, FAMILY_VERSION } from './family.js';

export const FAMILY_KEY_PREFIX = 'dagger.legacy.family.';
export const BIRTH_KEY = 'dagger.legacy.birth';
/** A birth's handoff older than this is stale (a tab left on the death screen overnight and reloaded) - never taken. */
export const BIRTH_MAX_AGE_MS = 10 * 60 * 1000;

const keyOf = (id) => `${FAMILY_KEY_PREFIX}${id}`;

/** The stored family `id`, read and shaped, or null. */
export function loadFamily(storage, id) {
  if (!storage || !id) return null;
  try { return readFamily(JSON.parse(storage.getItem(keyOf(id)) ?? 'null')); } catch { return null; }
}

/** Write a family; the newer `rev` stands - a stale copy (an older save's) never writes over the store's. Answers
 *  whether it wrote. */
export function storeFamily(storage, family) {
  if (!storage || !family?.id) return false;
  try {
    const was = loadFamily(storage, family.id);
    if (was && was.rev > family.rev) return false;
    storage.setItem(keyOf(family.id), JSON.stringify(family));
    return true;
  } catch { return false; }
}

/** Every stored family (the Hall of Ancestors), newest founded first. */
export function listFamilies(storage) {
  const out = [];
  if (!storage) return out;
  try {
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (!k?.startsWith(FAMILY_KEY_PREFIX)) continue;
      const f = loadFamily(storage, k.slice(FAMILY_KEY_PREFIX.length));
      if (f) out.push(f);
    }
  } catch { /* a storage that throws lists nothing */ }
  return out.sort((a, b) => b.founded - a.founded || (a.id < b.id ? -1 : 1));
}

/**
 * Leave a birth for the boot: `{ familyId, personId, region, loc, estate }`, stamped. One at a time - a second
 * replaces the first (the player chose again).
 */
export function leaveBirth(tab, birth, now = Date.now()) {
  if (!tab) return false;
  try { tab.setItem(BIRTH_KEY, JSON.stringify({ v: FAMILY_VERSION, ...birth, at: now })); return true; } catch { return false; }
}

/** The boot's read of the waiting birth for `personId`, LEFT where it waits - AUDIT LEGACY B7: it was taken at the
 *  read, so a birth whose boot failed (a game file that would not load) left nothing to retry and the line orphaned.
 *  The born member's first save clears it (clearBirth); a reload of the born world then births no one twice, because
 *  the person carries their character id. Null when none waits, it is stale, or it names another person. */
export function readBirth(tab, personId, now = Date.now()) {
  if (!tab) return null;
  let b = null;
  try { b = JSON.parse(tab.getItem(BIRTH_KEY) ?? 'null'); } catch { return null; }
  return birthOf(b, personId, now);
}
/** The birth answered - the born member stands and is saved. */
export function clearBirth(tab) {
  try { tab?.removeItem(BIRTH_KEY); } catch { /* a storage that throws holds nothing to clear */ }
}

function birthOf(b, personId, now) {
  if (!b || b.v !== FAMILY_VERSION || typeof b.familyId !== 'string') return null;
  if (!(now - (Number(b.at) || 0) <= BIRTH_MAX_AGE_MS)) return null;
  if (String(b.personId) !== String(personId)) return null;
  return { familyId: b.familyId, personId: Number(b.personId), region: String(b.region ?? ''), loc: String(b.loc ?? ''), estate: Math.max(0, Number(b.estate) | 0) };
}

/** A played member's newest save: the key whose card names their character id and was written last
 *  (systems/saveSlots.js enumerateSaves' `info`, key -> card). -1 when they have none. */
export function newestSaveOf(info, characterId) {
  let best = -1;
  let bestT = -Infinity;
  for (const [key, card] of info ?? []) {
    if (!characterId || card?.characterId !== characterId) continue;
    const t = Number(card?.dateAndTime?.realTime) || 0;
    if (t > bestT) { bestT = t; best = key; }
  }
  return best;
}
