// @ts-check
// WOD7 (2026-09-23, Mac: "and all the enemies are synced online?" ... "yes dude"): WORLD OF DAGGERFALL'S CAMPS,
// SHARED. Every client of a room stands the same sites in the same places (the list is the room's, WOD2), but each
// ran its own markers, so a camp sprang once per player and each fought a private copy (AUDIT BRANCH M1 kept the
// copies home because they took a peer's puppet slots). Now the FIRST player to spring a marker owns what it made:
// its foes ride that player's cell stream tagged with the marker's site, every reader stands them as puppets under
// an allowance of their own, and a reader's own copy of the marker is spent - one camp, everyone's.
//
// A marker's SITE is the key every client shares without a word: the map pixel and the marker's objectID (unique
// inside its layout, and one layout stands to a pixel), or `hold` for Privateer's Hold's camp. The tags and the
// owner's sprung list ride the foes frame beside `c` (SURV3's camps) - validated here, at the reader, never by the
// relay, which reads a frame's record count and nothing else. No wire or relay change.

/** A site id: `px,py:objectID` or `px,py:hold`. */
export const WOD_SITE_RE = /^-?\d{1,5},-?\d{1,5}:(?:\d{1,10}|hold)$/;
/** The most sites one frame may name, as tags or as the sprung list. */
export const WOD_SITES_MAX = 64;
/** A reader's allowance for one owner's camp foes - apart from CELL_PUPPETS_MAX, as the watch's is (WATCH1): a camp
 *  that spent the encounter allowance was the bug M1 fixed by keeping them home. The biggest shipped camp stands
 *  well under this. */
export const WOD_CAMP_PUPPETS_MAX = 16;
/** Two players who spring one marker inside this window (a frame's latency, generously) are a RACE, settled by id;
 *  past it both camps stand - neither is taken from under a fight already begun. */
export const WOD_CLAIM_WINDOW_MS = 5000;

/** @param {number} px @param {number} py @param {number|string} oid */
export const wodSiteId = (px, py, oid) => `${px},${py}:${oid}`;

/** A frame's sprung list, projected: the valid site ids, at most WOD_SITES_MAX; anything else is none. */
export function validSites(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const s of raw) {
    if (out.length >= WOD_SITES_MAX) break;
    if (typeof s === 'string' && WOD_SITE_RE.test(s) && !out.includes(s)) out.push(s);
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
 * Who keeps a marker two players both sprang: the smaller id, inside the claim window; past it, both.
 * @param {string} mine my id  @param {string} theirs the peer's id
 * @param {number} sprungAt when I sprang it  @param {number} now
 * @returns {boolean} true when MY copy yields to theirs
 */
export function yieldsTo(mine, theirs, sprungAt, now) {
  if (typeof mine !== 'string' || typeof theirs !== 'string' || !mine || !theirs || mine === theirs) return false;
  return now - sprungAt <= WOD_CLAIM_WINDOW_MS && theirs < mine;
}
