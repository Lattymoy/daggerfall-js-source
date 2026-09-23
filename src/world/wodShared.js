// @ts-check
// WOD7 (2026-09-23, Mac: "and all the enemies are synced online?" ... "yes dude"): WORLD OF DAGGERFALL'S CAMPS,
// SHARED. Every client of a room stands the same sites in the same places (the list is the room's, WOD2), but each
// ran its own markers, so a camp sprang once per player and each fought a private copy (AUDIT BRANCH M1 kept the
// copies home because they took a peer's puppet slots). Now the FIRST player to spring a marker owns what it made:
// its foes ride that player's cell stream tagged with the marker's site, every reader stands them as puppets under
// an allowance of their own, and a reader's own copy of the marker is spent - one camp, everyone's.
//
// A marker's SITE is the key every client shares without a word: the map pixel (one layout stands to a pixel) and the
// marker's objectID - with its index among the pixel's markers of that objectID when there is more than one
// (WOD_Nature_01 numbers two bears 0, WOD_Ruins_04 three warriors; AUDIT WOD7) - or `hold` for Privateer's Hold's camp. The tags and
// the owner's sprung list ride the foes frame beside `c` (SURV3's camps) - validated here, at the reader, never by
// the relay, which reads a frame's record count and nothing else. No wire or relay change.

/** A site id: `px,py:objectID` or `px,py:hold`. */
export const WOD_SITE_RE = /^-?\d{1,5},-?\d{1,5}:(?:\d{1,10}(?:\.\d{1,3})?|hold)$/;
/** The most sites one frame may name, as tags or as the sprung list. */
export const WOD_SITES_MAX = 64;
/** A reader's allowance for one owner's camp foes - apart from CELL_PUPPETS_MAX, as the watch's is (WATCH1): a camp
 *  that spent the encounter allowance was the bug M1 fixed by keeping them home. The biggest shipped camp stands
 *  well under this. */
export const WOD_CAMP_PUPPETS_MAX = 16;
/** Two players who spring one marker inside this window (a frame's latency, generously) are a RACE, settled by id;
 *  past it the one who sprang FIRST keeps it (AUDIT WOD7: each side measured only its own spring's age, so a pair
 *  ten seconds apart doubled or collapsed by id order alone). */
export const WOD_CLAIM_WINDOW_MS = 5000;

/** The longest age a sprung list states, in ms (a day) - older is as old. */
export const WOD_AGE_MAX = 86400000;

/** @param {number} px @param {number} py @param {number|string} oid @param {number} [n] the index among the pixel's
 *  markers of that objectID - 0, the only one, is left unwritten */
export const wodSiteId = (px, py, oid, n = 0) => `${px},${py}:${oid}${n > 0 ? `.${n}` : ''}`;

/** A frame's sprung list - `[[site, ageMs], ...]`, newest first: how long ago the owner sprang each - projected:
 *  the valid entries, at most WOD_SITES_MAX, each site once, the age clamped to [0, WOD_AGE_MAX]. */
export function validSites(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [], seen = new Set();
  for (const e of raw) {
    if (out.length >= WOD_SITES_MAX) break;
    if (!Array.isArray(e) || e.length !== 2) continue;
    const [s, age] = e;
    if (typeof s !== 'string' || !WOD_SITE_RE.test(s) || seen.has(s) || !Number.isFinite(age)) continue;
    seen.add(s);
    out.push([s, Math.max(0, Math.min(WOD_AGE_MAX, age))]);
  }
  return out;
}

/** A frame's tags - `[[i, site], ...]`, the owner's record number and the site it stood for - projected into a Map. */
export function validSiteTags(raw) {
  const out = new Map();
  if (!Array.isArray(raw)) return out;
  for (const e of raw) {
    if (out.size >= WOD_SITES_MAX) break;
    if (!Array.isArray(e) || e.length !== 2) continue;
    const [i, s] = e;
    if (Number.isInteger(i) && i >= 0 && typeof s === 'string' && WOD_SITE_RE.test(s)) out.set(i, s);
  }
  return out;
}

/**
 * Who keeps a marker two players both sprang: the one who sprang it first; inside the claim window (a frame's
 * latency cannot order them), the smaller id. Both sides reach the same answer from the two ages.
 * @param {string} mine my id  @param {string} theirs the peer's id
 * @param {number} myAge how long ago I sprang it, ms  @param {?number} theirAge theirs, as their sprung list says
 * @returns {boolean} true when MY copy yields to theirs; never on an age not yet heard
 */
export function yieldsTo(mine, theirs, myAge, theirAge) {
  if (typeof mine !== 'string' || typeof theirs !== 'string' || !mine || !theirs || mine === theirs) return false;
  if (!Number.isFinite(theirAge) || !Number.isFinite(myAge)) return false;
  if (Math.abs(myAge - theirAge) <= WOD_CLAIM_WINDOW_MS) return theirs < mine;
  return theirAge > myAge;
}
