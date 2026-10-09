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
import { readFamily, FAMILY_VERSION, nameAtSeat, nameHouse, leanRecord } from './family.js';
import { mergeNews, mergeHeard } from './influence.js';   // LEGACY6; AUDIT LEGACY III A8: a reader's heard news

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

/** AUDIT LEGACY III A2: THE STORED REV EACH COPY WAS MADE FROM - the store's rev as the page last read it or wrote it,
 *  by the copy itself (the host's family object; a copy nobody noted has none). */
const seenRevs = new WeakMap();
/** The copy `family` was made from the store's record at `rev` (a load, an adopt): the store's own word, kept beside
 *  the copy, which its next write is judged by. */
export function noteSeen(family, rev) {
  if (family && typeof family === 'object' && Number.isSafeInteger(rev)) seenRevs.set(family, rev);
}
/** The stored rev `family` was made from, or null when nothing noted it. */
export const seenRevOf = (family) => (family && typeof family === 'object' ? seenRevs.get(family) ?? null : null);

/**
 * Write a family. AUDIT LEGACY II A4/P1: the store is the authority for the world's facts, so a write never loses one
 * the store already holds. A copy made from the store as it stands is written as it is; one that is not (another tab
 * of the same line wrote since, or this page's copy is an older save's) first takes in the store's facts (`mergeFacts`
 * - into `family` itself, so the page plays on them) and is written one past both. The old law refused the stale copy
 * outright, and a second tab's death, written at the lower rev, was silently dropped - the dead played on.
 * AUDIT LEGACY III A2: STALE BY WHAT IT WAS MADE FROM, never by its own counter. Each page bumps its own rev at every
 * touch, so a copy one rev behind that touched three times before it stored (a child born: childStep, addChild, the
 * news) counted as "ahead", was written whole, and erased the other tab's death and its waiting Succession. `base` is
 * the store's rev the copy was made from (noteSeen - the host's own copy carries it, and every write here renews it);
 * a copy with none is judged by its counter as before (a fresh founding, or one nobody read the store for).
 * Answers whether it wrote (false: the storage refused - the host says so and tries again).
 * @param {any} storage @param {any} family @param {number|null} [base]
 */
export function storeFamily(storage, family, base = seenRevOf(family)) {
  if (!storage || !family?.id) return false;
  try {
    const was = loadFamily(storage, family.id);
    if (was && (base != null ? was.rev !== base : was.rev >= family.rev)) {
      mergeFacts(family, was);
      family.rev = Math.max(was.rev, family.rev) + 1;
    }
    leanRecord(family);   // AUDIT LEGACY III O10/P1
    storage.setItem(keyOf(family.id), JSON.stringify(family));
    seenRevs.set(family, family.rev);
    return true;
  } catch { return false; }
}

/** AUDIT LEGACY III P5: what a member's own save writes of them (legacyHost.js writeCurrent - writePlayer, their
 *  standing, their look, where they were saved) - kept, as a whole, from the copy that saved that member LAST. */
export const MEMBER_SAVE_FIELDS = Object.freeze(['given', 'surname', 'gender', 'race', 'raceId', 'face', 'careerIndex', 'className', 'career', 'groups',
  'level', 'stats', 'skills', 'leveling', 'standing', 'look', 'parked', 'deedsTaken']);   // PERMADEATH-HOUSES: the dead's deeds their save took up

/** AUDIT LEGACY III A3/P3: whether two copies' persons of one id are ONE person. Ids are minted by each copy's own
 *  counter (nextId), so two copies that each minted someone - a child here, a spouse there - gave two people one id. One
 *  person is the same kind, born at the same minute of the same parents, and - wed in - the same townsperson
 *  (residentId) or the same union (realm.sid); their names and what they wear may differ (a save rewrites them). */
export function samePerson(p, o) {
  if (!p || !o || (p.kind ?? 'member') !== (o.kind ?? 'member')) return false;
  if ((p.residentId ?? null) !== (o.residentId ?? null) || (p.realm?.sid ?? null) !== (o.realm?.sid ?? null)) return false;
  if ((Number(p.born) || 0) !== (Number(o.born) || 0)) return false;
  const a = [...(p.parents ?? [])].sort((x, y) => x - y), b = [...(o.parents ?? [])].sort((x, y) => x - y);
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/**
 * AUDIT LEGACY III A3/P3: `mine`'s persons that `other` holds AS OTHERS under their ids, given ids of their own past
 * both counters - in place, every link of `mine` that names them moved with them (parents, children, a spouse, who is
 * played, the waiting fall, the remains and who carries them, the houses' holders). The other copy's ids stand: it is
 * the store's (or the realm's) - the record every other page and the realm's births name its people by. Answers the
 * ids moved, old to new.
 */
export function rekeyClashes(mine, other) {
  const theirs = new Map((other?.people ?? []).map((o) => [o.id, o]));
  const clash = (mine?.people ?? []).filter((p) => theirs.has(p.id) && !samePerson(p, theirs.get(p.id)));
  /** @type {Map<number, number>} */
  const moved = new Map();
  if (!clash.length) return moved;
  let next = Math.max(mine.nextId | 0, other.nextId | 0, ...mine.people.map((p) => p.id + 1), ...other.people.map((o) => o.id + 1));
  for (const p of clash) moved.set(p.id, next++);
  const to = (/** @type {number} */ id) => (moved.has(id) ? /** @type {number} */ (moved.get(id)) : id);
  for (const p of mine.people) {
    p.id = to(p.id);
    p.parents = (p.parents ?? []).map(to);
    p.children = (p.children ?? []).map(to);
    if (p.spouse != null) p.spouse = to(p.spouse);
  }
  mine.currentId = to(mine.currentId);
  if (mine.pending) mine.pending.fallenId = to(mine.pending.fallenId);
  for (const r of mine.remains ?? []) {
    if (Number.isInteger(r.of) && moved.has(r.of)) { r.of = to(r.of); r.id = `r${r.of}`; }
    if (Number.isInteger(r.by)) r.by = to(r.by);
  }
  for (const h of mine.houses ?? []) { if (Number.isInteger(h.by)) h.by = to(h.by); if (Number.isInteger(h.from)) h.from = to(h.from); }   // PERMADEATH-HOUSES: and who left it
  mine.nextId = next;
  return moved;
}

/**
 * THE WORLD'S FACTS of `other` (the store's copy) taken into `mine`, in place - facts only ever ADDED: a death or a
 * retirement either copy knows stands (the first written kept), Arkay's toll and the minutes lived the greater, a
 * character id either knows, every person, remains row and house either holds, the record's counter past both. A fall
 * the other copy left waiting is taken in only while this copy has not heard of that death at all (one it has heard
 * of and has no pending for, it answered). The rest - who is played here, the save's grants - stays this copy's.
 * AUDIT LEGACY III A3/P3: persons are one only when they ARE one (samePerson) - `mine`'s that the other copy holds as
 * others under their ids move to ids of their own first (rekeyClashes), so a member is never wed to another member's
 * newborn, nor a spouse lost. P5: what a member's own save writes of them comes from the copy that saved them last
 * (`savedAt`), and a wedding the other copy made after this copy's spouse died stands.
 */
export function mergeFacts(mine, other) {
  if (!mine || !other || mine.id !== other.id) return mine;
  rekeyClashes(mine, other);
  const knew = new Map(mine.people.map((p) => [p.id, !!p.died]));
  for (const o of other.people) {
    const p = mine.people.find((x) => x.id === o.id);
    if (!p) { mine.people.push(JSON.parse(JSON.stringify(o))); continue; }
    if (!p.died && o.died) p.died = o.died;
    if (p.retired == null && o.retired != null) p.retired = o.retired;
    p.toll = Math.max(p.toll | 0, o.toll | 0);
    p.lived = Math.max(p.lived | 0, o.lived | 0);
    if (!p.characterId && o.characterId) p.characterId = o.characterId;
    if ((Number(o.savedAt) || 0) > (Number(p.savedAt) || 0)) {
      for (const k of MEMBER_SAVE_FIELDS) {
        if (o[k] === undefined) delete p[k];
        else p[k] = o[k] && typeof o[k] === 'object' ? JSON.parse(JSON.stringify(o[k])) : o[k];
      }
      p.savedAt = o.savedAt;
    }
    if (!p.standing && o.standing) p.standing = JSON.parse(JSON.stringify(o.standing));   // LEGACY6: a standing either copy saved
    if (p.died) delete p.heard;   // A8: the dead hear nothing - and the living's, the earlier hearing of each
    else if (p.heard || o.heard) { const h = mergeHeard(p.heard, o.heard); if (h) p.heard = h; else delete p.heard; }
    if (p.childDay == null && o.childDay != null && p.spouse === o.spouse) p.childDay = o.childDay;
    for (const c of o.children ?? []) if (!p.children.includes(c)) p.children.push(c);
  }
  // LEGACY7 part three: a wedding is a fact as a death is - a spouse either copy recorded stands (a stale write's base
  // took the person in above, and lost the member's word that they were wed). AUDIT LEGACY III P5: and the newer
  // wedding stands - the other copy's made after this copy's spouse died (a stale tab's write unwed a member wed again)
  const byId = new Map(mine.people.map((p) => [p.id, p]));
  for (const o of other.people) {
    const p = byId.get(o.id);
    if (!p || o.spouse == null || p.spouse === o.spouse) continue;
    const mineDead = p.spouse != null && !!byId.get(p.spouse)?.died;
    if (p.spouse != null && !(mineDead && (Number(o.wedAt) || 0) > (Number(p.wedAt) || 0))) continue;
    p.spouse = o.spouse;
    p.wedAt = o.wedAt ?? p.wedAt ?? null;
    p.childDay = o.childDay ?? null;
  }
  for (const r of other.remains ?? []) if (!(mine.remains ??= []).some((x) => x.id === r.id)) mine.remains.push(JSON.parse(JSON.stringify(r)));
  for (const h of other.houses ?? []) {
    const same = (x) => (x.mapId | 0) === (h.mapId | 0) && (x.buildingKey | 0) === (h.buildingKey | 0);
    if (!(mine.houses ??= []).some(same)) mine.houses.push({ ...h });
  }
  if (!mine.pending && other.pending && knew.get(other.pending.fallenId) === false) mine.pending = JSON.parse(JSON.stringify(other.pending));
  // FAMILY-SEAT (FIELD BUGS 2026-10-07b): a seat the player moved carries when (`at`), and the later move stands -
  // whichever copy is the base by rev: a stale tab's or device's write carried the old seat back over the move. A seat
  // neither copy moved is the base's, or the other's when the base has none (the first town noted, as ever)
  if (other.seat && (!mine.seat || (Number(other.seat.at) || 0) > (Number(mine.seat.at) || 0))) mine.seat = { ...other.seat };
  // AUDIT FB1007b S1: THE NAME IS THE HOUSE'S, never its seat's - the seat moves now, and a copy that never learned the
  // name (a tab still in Privateer's Hold) named itself for the moved seat: the house's name flipped, the founder's with
  // it. It takes the name the other copy holds; and a member of the blood a stale save left nameless takes the house's
  const houseName = String(mine.surname ?? '').trim() || String(other.surname ?? '').trim();
  if (houseName) nameHouse(mine, houseName);
  nameAtSeat(mine);   // LEGACY-NAME: a nameless house is named with the seat it learned - here, from the copy that saw it
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
  return {
    familyId: b.familyId, personId: Number(b.personId), region: String(b.region ?? ''), loc: String(b.loc ?? ''), estate: Math.max(0, Number(b.estate) | 0),
    ...(b.newborn === true ? { newborn: true } : {}),   // AUDIT LEGACY III A9: the Succession's newborn heir - the towns' news of a birth
  };
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
