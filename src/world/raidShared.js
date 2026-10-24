// @ts-check
// RAID2 (2026-09-27, Mac, on World Events - Raiding Parties online: "1. Server 2. Keep ..."): A TOWN'S RAID,
// SHARED. The day's raids were already the same on every client (RAID1 rolls them off the day's own generator), but
// each client would have stood its own raiders, so RAID1 stood down online. Now ONE player runs a raid - WOD7's law
// for a marker two players sprang: the first to claim it keeps it, two claims inside RAID_CLAIM_WINDOW_MS go to the
// smaller id, and with no claim heard the smallest id standing in the town claims it. Its raiders ride its cell
// stream tagged with the raid's key (`rz`) and every reader stands them under an allowance of their own; its
// defenders ride as the watch does, named as the player's allies (`al`), so a reader stands them as its allies too;
// and every owner's word on the raids it fought (`rk`: the raid, the deaths of its own raiders, how long ago it
// claimed the raid) rides beside them - a raid's deaths are every owner's summed, so a runner who stands down keeps
// its share and the next runner counts on from there. Validated here, at the reader; the relay reads a frame's
// record count and nothing else. No wire or relay change. RAID3 moved the count into the relay (Mac's "1. Server" -
// net/raid/raidLaw.js): where the relay speaks raids its count and its cleanse are the raid's, and these words elect the
// runner alone.

import { FOE_SEQ_MAX } from '../net/wire.js';
import { RAID_KEY_RE } from '../net/raid/raidLaw.js';   // RAID3: a raid's key has one home, the relay's law beside it
/** Two claims inside this window (a frame's latency, generously) are a race, settled by id - WOD7's own number
 *  (wodShared.js WOD_CLAIM_WINDOW_MS). */
export const RAID_CLAIM_WINDOW_MS = 5000;
/** A peer's claim unheard this long is gone - the foes stream's own staleness (online.js FOES_STALE_MS: three full
 *  frames missed). */
export const RAID_WORD_STALE_MS = 6000;
/** The raids one frame's word may name. */
export const RAID_WORDS_MAX = 4;
/** A reader's allowance for one owner's raiders: the mod's cap whole (systems/raidingParties.js MAX_RAID_ENEMIES,
 *  Mac's "Keep"), apart from CELL_PUPPETS_MAX as the watch's and the camps' are - twenty-five raiders stood in twelve
 *  slots were thirteen a reader could not see and was killed by. */
export const RAID_PUPPETS_MAX = 25;
/** The most tags a frame may carry - a frame's records (wire.js CELL_FRAME_RECORDS_MAX). */
export const RAID_TAGS_MAX = 64;
/** The most deaths a word may state, and the oldest claim, ms (two real hours - a raid is ten minutes). */
export const RAID_KILLS_WIRE_MAX = 999;
export const RAID_CLAIM_AGE_MAX = 7_200_000;

const recordNumber = (i) => Number.isInteger(i) && i >= 0 && i <= FOE_SEQ_MAX;

/** A frame's word - `[[key, deaths, claimAgeMs], ...]`, claimAgeMs -1 for a raid fought and not claimed - projected:
 *  the valid entries, at most RAID_WORDS_MAX, each raid once. */
export function validRaidWords(raw) {
  /** @type {Array<{key: string, n: number, age: number}>} */
  const out = [];
  if (!Array.isArray(raw)) return out;
  const seen = new Set();
  for (const e of raw) {
    if (out.length >= RAID_WORDS_MAX) break;
    if (!Array.isArray(e) || e.length !== 3) continue;
    const [key, n, age] = e;
    if (typeof key !== 'string' || !RAID_KEY_RE.test(key) || seen.has(key)) continue;
    if (!Number.isInteger(n) || n < 0 || n > RAID_KILLS_WIRE_MAX) continue;
    if (!Number.isInteger(age) || age < -1 || age > RAID_CLAIM_AGE_MAX) continue;
    seen.add(key);
    out.push({ key, n, age });
  }
  return out;
}

/** A frame's raid tags - `[[i, key], ...]`, the owner's record number and the raid it fights for - into a Map. */
export function validRaidTags(raw) {
  /** @type {Map<number, string>} */
  const out = new Map();
  if (!Array.isArray(raw)) return out;
  for (const e of raw) {
    if (out.size >= RAID_TAGS_MAX) break;
    if (!Array.isArray(e) || e.length !== 2) continue;
    const [i, key] = e;
    if (recordNumber(i) && typeof key === 'string' && RAID_KEY_RE.test(key)) out.set(i, key);
  }
  return out;
}

/** A frame's allied watchmen - `[i, ...]`, the owner's record numbers of the watchmen who are its allies (DISC19-F's
 *  defenders, a raid's among them) - into a Set. */
export function validAlliedIds(raw) {
  /** @type {Set<number>} */
  const out = new Set();
  if (!Array.isArray(raw)) return out;
  for (const i of raw) {
    if (out.size >= RAID_TAGS_MAX) break;
    if (recordNumber(i)) out.add(i);
  }
  return out;
}

/**
 * Who runs a raid. The claims heard first, oldest first, WOD7's pairwise law carried down the list: a later claim
 * takes it only inside the window and with the smaller id. With no claim at all, the smallest id standing in the
 * raided town - the one who will claim it, so two players walking in together do not both stand a raid. Every client
 * in the town reaches the same answer from the same words.
 * @param {{ me: string|null, inTown?: string[], claims?: Array<{id: string, age: number}> }} o
 *   me my id; inTown the ids of the peers standing in the raided town; claims every claim heard (mine among them),
 *   each with how long ago it was made, ms
 * @returns {string|null}
 */
export function raidRunnerOf({ me, inTown = [], claims = [] }) {
  const live = claims.filter((c) => c && typeof c.id === 'string' && c.id && Number.isFinite(c.age));
  if (live.length) {
    const oldest = [...live].sort((a, b) => b.age - a.age || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    let win = oldest[0];
    for (const c of oldest.slice(1)) {
      if (Math.abs(win.age - c.age) <= RAID_CLAIM_WINDOW_MS && c.id < win.id) win = c;
    }
    return win.id;
  }
  const ids = [me, ...inTown].filter((id) => typeof id === 'string' && id).sort();
  return ids[0] ?? null;
}
