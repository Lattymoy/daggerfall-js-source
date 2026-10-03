// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF2b (2026-10-03, Mac: "plus we need to build motherloads") - THE
// MOTHERLODES' LAW, both ends (bible/06-Systems/Professions-Arc.md 6, 38):
// the contested veins. Three a UTC day rise server-wide, each a tier-6 vein
// that yields to the first MOTHERLODE_STRIKERS characters to strike it, each
// finding MOTHERLODE_SILVER silver besides the ore; an account finds one a
// day. Pure: no clock, no network.
//
// WHERE (DECIDED here): on WITNESSED ground. The service holds no map - it
// knows a pixel's climate and region only as three accounts confirmed them
// (SEAT0 3.2, nodeLaw witnessedFact) - so the day's three rise on pixels
// confirmed before the day began, picked by `hash(MOTHERLODE_SALT, day, k)`
// from that day's candidates (the mountains' and the deserts' first, every
// vein-bearing climate where they are too few). The service picks and keeps
// them; every client is told them, and stands each at its pixel's rock.
//
// WHEN: each in its own third of the UTC day (so every part of the world's
// day sees one), rising within its third's first six hours, standing two
// hours or until its strikers are spent. THE WARNING is every client's own,
// from the shared clock and the day's list - 10 minutes ahead, a Motherlode
// Sense's 30 - as the gate's omen is (systems/gateOmen.js): no hub push.
//
// WHO: a strike counts only from an account the relay saw on the
// Motherlode's pixel - its Watch receipt (net/watchReceipt.js, `k1`: the
// relay's signature on a pose in its own cell room, the pixel named) issued
// in the MOTHERLODE_WATCH_S before the act's end. A pose is the client's
// claim, so this is a bound, not a proof (PROF0 6) - the cap is the rest.
// ═══════════════════════════════════════════════════════════════════
import { gateHash } from './gateLaw.js';   // the one mix every clock-law rolls with
import { VEIN_TABLES, regionSignature } from './nodeLaw.js';
import { CLIMATES } from '../formats/mapsTables.js';
import { MARKS_FAUCETS } from './marksLaw.js';

export const MOTHERLODE_SALT = 0x6d1d;
/** The Motherlodes a UTC day, server-wide. */
export const MOTHERLODES_A_DAY = 3;
/** The characters a Motherlode yields to - the first to strike it. */
export const MOTHERLODE_STRIKERS = 20;
/** What each finds besides the ore (MARKS_FAUCETS.motherlode - one an account a UTC day). */
export const MOTHERLODE_SILVER = MARKS_FAUCETS.motherlode.amount;
/** A Motherlode's tier - its act is tier 6's. */
export const MOTHERLODE_TIER = 6;
/** DECIDED (PROF2b): the Mining a strike asks - an Apprentice's, not tier 6's 90. A tier-6 vein at a Grandmaster's rank
 *  is one nobody on a young realm could strike; a Motherlode is the realm's event, and its contest is the clock and the
 *  twenty, not the rank. */
export const MOTHERLODE_RANK = 25;
/** Each of the day's three rises in its own third of the UTC day, within that third's first six hours. */
export const MOTHERLODE_THIRD_S = 8 * 3600;
export const MOTHERLODE_RISE_SPREAD_S = 6 * 3600;
/** A Motherlode stands this long once risen - or until its strikers are spent. */
export const MOTHERLODE_OPEN_S = 2 * 3600;
/** The warning ahead of its rising (PROF0 6), and a Motherlode Sense's (Mining 100, PROF0 3.3). */
export const MOTHERLODE_WARN_S = 600;
export const MOTHERLODE_SENSE_WARN_S = 1800;
/** A strike's Watch receipt: issued for the Motherlode's pixel in this many seconds before the act's end. */
export const MOTHERLODE_WATCH_S = 600;
/** AUDIT SILVER-WAYS C1: and no later than the act's end, give the clocks' skew (identityToken.js SKEW_S - pinned equal;
 *  not imported, the law stays a leaf). The act's end is the client's own word, ten minutes late at most (the harvest's
 *  HARVEST_LATE_S): with no ceiling a strike told as ended inside the two hours, sent after them, carried a receipt the
 *  relay issued after the Motherlode had gone - a miner who reached it late struck it anyway. */
export const MOTHERLODE_WATCH_AHEAD_S = 30;
/** Whether a Watch receipt issued at `i` stands for a strike whose act ended at `at` (both epoch seconds). */
export const motherlodeWatchOk = (i, at) => Number.isSafeInteger(i) && i >= at - MOTHERLODE_WATCH_S && i <= at + MOTHERLODE_WATCH_AHEAD_S;
/** The tier-6 ores a Motherlode yields - a region's own where its signature is one of them (PROF0 4.7). */
export const MOTHERLODE_ORES = Object.freeze(['ore:adamantium', 'ore:ebony', 'ore:orichalcum']);
/** The climates a Motherlode rises in first: the mountains' and the deserts' (the richest veins, PROF0 6's table). */
export const MOTHERLODE_CLIMATES = Object.freeze(/** @type {number[]} */ ([CLIMATES.Mountain, CLIMATES.MountainWoods, CLIMATES.Desert, CLIMATES.Desert2]));
/** A strike's ore: 4 to 6, half again for a clean act (every strike on the glint) - twice a vein's (2-3), the act's
 *  bound (+50%) as every harvest's. */
export const MOTHERLODE_YIELD = Object.freeze([4, 6]);

/** A Motherlode's node key - its UTC day and its place in the day (0-2). */
export const motherlodeKey = (day, k) => `mlode:${day}:${k}`;
export const MOTHERLODE_KEY_RE = /^mlode:(0|[1-9]\d{0,6}):([0-2])$/;
/** A key read back - `{ day, k }` - only in its one spelling; null for anything else. */
export function parseMotherlodeKey(key) {
  const m = typeof key === 'string' ? MOTHERLODE_KEY_RE.exec(key) : null;
  return m ? { day: Number(m[1]), k: Number(m[2]) } : null;
}
const unit = (day, k, j) => gateHash(MOTHERLODE_SALT, day, k, j) / 4294967296;

/** When the day's `k`th rises and goes - epoch seconds, a whole minute. */
export function motherlodeTimes(day, k) {
  const opensAt = day * 86400 + k * MOTHERLODE_THIRD_S + Math.floor((unit(day, k, 1) * MOTHERLODE_RISE_SPREAD_S) / 60) * 60;
  return { opensAt, closesAt: opensAt + MOTHERLODE_OPEN_S };
}
/** A Motherlode's ore: its region's signature where that is a tier-6 ore, else one of the three by the day's roll. */
export function motherlodeOre(day, k, region) {
  const sig = region == null ? null : regionSignature(region)?.ore ?? null;
  if (sig && MOTHERLODE_ORES.includes(sig)) return sig;
  return MOTHERLODE_ORES[Math.min(MOTHERLODE_ORES.length - 1, Math.floor(unit(day, k, 2) * MOTHERLODE_ORES.length))];
}
/** Whether a confirmed pixel of `climate` may hold a Motherlode at all: a climate that holds veins. */
export const motherlodeGround = (climate) => !!VEIN_TABLES[climate];

/**
 * THE DAY'S MOTHERLODES picked from `candidates` - the pixels confirmed before the day began, `{ x, y, climate, region }`
 * - in their one order (by y, then x, so every reader of the same ground picks the same): the mountains' and the
 * deserts' (MOTHERLODE_CLIMATES) where there are three, every vein-bearing pixel where they are fewer; three distinct
 * pixels by `hash(MOTHERLODE_SALT, day, k)`. Answers `[{ k, key, x, y, climate, region, material, opensAt, closesAt }]`
 * - fewer where the ground is fewer, none on a realm nobody has walked.
 * @param {number} day @param {Array<{ x: number, y: number, climate: number, region: number }>} candidates
 */
export function motherlodeSites(day, candidates) {
  const all = (candidates ?? []).filter((c) => c && Number.isSafeInteger(c.x) && Number.isSafeInteger(c.y) && motherlodeGround(c.climate))
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const rich = all.filter((c) => MOTHERLODE_CLIMATES.includes(c.climate));
  const pool = (rich.length >= MOTHERLODES_A_DAY ? rich : all).slice();
  const out = [];
  for (let k = 0; k < MOTHERLODES_A_DAY && pool.length; k++) {
    const i = Math.min(pool.length - 1, Math.floor(unit(day, k, 0) * pool.length));
    const [c] = pool.splice(i, 1);
    out.push({ k, key: motherlodeKey(day, k), x: c.x, y: c.y, climate: c.climate, region: c.region, material: motherlodeOre(day, k, c.region), ...motherlodeTimes(day, k) });
  }
  return out;
}
/** Whether a Motherlode stands at `nowS` (risen, not yet gone - its strikers asked apart). */
export const motherlodeOpen = (lode, nowS) => !!lode && nowS >= lode.opensAt && nowS < lode.closesAt;
/** A strike's ore: `roll` 0-2 on the service's dice, half again (floored) for a clean act. */
export const motherlodeYield = (roll, clean) => {
  const base = MOTHERLODE_YIELD[0] + Math.max(0, Math.min(MOTHERLODE_YIELD[1] - MOTHERLODE_YIELD[0], Math.floor(roll)));
  return clean ? Math.floor(base * 1.5) : base;
};
/** How far ahead a Motherlode is warned of - a Motherlode Sense's half hour, else ten minutes. */
export const motherlodeWarnS = (sense) => (sense ? MOTHERLODE_SENSE_WARN_S : MOTHERLODE_WARN_S);
