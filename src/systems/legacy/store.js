// @ts-check
// LEGACY1 (bible/06-Systems/Legacy-Arc.md section 3): WHERE A FAMILY LIVES, and THE BIRTH'S HANDOFF.
//
// Offline a family is its own record in app storage (`dagger.legacy.family.<id>`) - it outlives any one save, so a
// member's save deleted takes nothing of the line with it - and a copy rides every member's save (`modData`), the
// store's world facts and the save's grants each answering for their own wherever the two meet (scenes/legacyHost.js
// mergeFamily; a write merges with what the store holds - storeFamily). The Hall of Ancestors lists the store.
//
// A BIRTH crosses a reload: the dead's world is torn down and the heir's is built by the boot (`?legacyborn=`). What
// the boot needs - which family, which person, the estate - waits in the TAB's storage (sessionStorage: it survives
// the reload and dies with the tab, so a birth is never taken up by another tab or a later visit).
//
// Storage is handed in (systems/appStorage.js appStorage / tabStorage), so this is headless-testable; every read and
// write is shielded, because storage throws under some privacy modes and a family must never cost the player a game.
import { readFamily, FAMILY_VERSION } from './family.js';
import { mergeNews } from './influence.js';   // LEGACY6

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

/**
 * Write a family. AUDIT LEGACY II A4/P1: the store is the authority for the world's facts, so a write never loses one
 * the store already holds. A copy AHEAD of the store's (`rev` greater - this page wrote last) is written as it is; one
 * that is not (another tab of the same line wrote since, or this page's copy is an older save's) first takes in the
 * store's facts (`mergeFacts` - into `family` itself, so the page plays on them) and is written one past both. The
 * old law refused the stale copy outright, and a second tab's death, written at the lower rev, was silently dropped -
 * the dead played on. Answers whether it wrote (false: the storage refused - the host says so and tries again).
 */
export function storeFamily(storage, family) {
  if (!storage || !family?.id) return false;
  try {
    const was = loadFamily(storage, family.id);
    if (was && was.rev >= family.rev) {
      mergeFacts(family, was);
      family.rev = Math.max(was.rev, family.rev) + 1;
    }
    storage.setItem(keyOf(family.id), JSON.stringify(family));
    return true;
  } catch { return false; }
}

/**
 * THE WORLD'S FACTS of `other` (the store's copy) taken into `mine`, in place - facts only ever ADDED: a death or a
 * retirement either copy knows stands (the first written kept), Arkay's toll and the minutes lived the greater, a
 * character id either knows, every person, remains row and house either holds, the record's counter past both. A fall
 * the other copy left waiting is taken in only while this copy has not heard of that death at all (one it has heard
 * of and has no pending for, it answered). The rest - who is played here, the save's grants - stays this copy's.
 */
export function mergeFacts(mine, other) {
  if (!mine || !other || mine.id !== other.id) return mine;
  const knew = new Map(mine.people.map((p) => [p.id, !!p.died]));
  for (const o of other.people) {
    const p = mine.people.find((x) => x.id === o.id);
    if (!p) { mine.people.push(JSON.parse(JSON.stringify(o))); continue; }
    if (!p.died && o.died) p.died = o.died;
    if (p.retired == null && o.retired != null) p.retired = o.retired;
    p.toll = Math.max(p.toll | 0, o.toll | 0);
    p.lived = Math.max(p.lived | 0, o.lived | 0);
    if (!p.characterId && o.characterId) p.characterId = o.characterId;
    if (!p.standing && o.standing) p.standing = JSON.parse(JSON.stringify(o.standing));   // LEGACY6: a standing either copy saved
    for (const c of o.children ?? []) if (!p.children.includes(c)) p.children.push(c);
  }
  for (const r of other.remains ?? []) if (!(mine.remains ??= []).some((x) => x.id === r.id)) mine.remains.push(JSON.parse(JSON.stringify(r)));
  for (const h of other.houses ?? []) {
    const same = (x) => (x.mapId | 0) === (h.mapId | 0) && (x.buildingKey | 0) === (h.buildingKey | 0);
    if (!(mine.houses ??= []).some(same)) mine.houses.push({ ...h });
  }
  if (!mine.pending && other.pending && knew.get(other.pending.fallenId) === false) mine.pending = JSON.parse(JSON.stringify(other.pending));
  if (!mine.seat && other.seat) mine.seat = { ...other.seat };
  if (!mine.home && other.home) mine.home = { ...other.home };
  mine.news = mergeNews(mine.news, other.news);   // LEGACY6: what the towns heard is never unheard
  mine.nextId = Math.max(mine.nextId | 0, other.nextId | 0, ...mine.people.map((p) => p.id + 1));
  return mine;
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
