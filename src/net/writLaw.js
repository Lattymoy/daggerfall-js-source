// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF6 (2026-09-29, Mac: "continue") - THE WRITS' LAW BESIDE THE COURT'S:
// a guild's writs, paid from its Marks treasury and delivered from the
// Stores into the guild Stores; a player's commission, naming a crafter and
// a piece of their make; the guild Stores' bounds; the seat week an
// Officer's writ budget is counted in. Pure, both ends - the service
// (server-account/src/writs.js) decides by it, the Work tab says it.
// bible/06-Systems/Professions-Arc.md 7, 11 and 28.
//
// The Court's writs stay professionLaw.js's (PROF1): they mint Marks and
// Renown; these move Marks a guild or a player already holds.
// ═══════════════════════════════════════════════════════════════════

import { material } from './nodeLaw.js';
import { STORES_MAX } from './professionLaw.js';
import { MARKS_MAX } from './marksLaw.js';
import { marketCatalogue, pieceListable, priceOk, UNYIELDED } from './marketLaw.js';
import { recipeById, takesQuality, MASTERWORK } from './recipeLaw.js';
import { RAID_KEY_RE } from './raidLaw.js';   // SILVER-WAYS: a contract's raid, by its key

const DAY_S = 86_400;

// ─── GUILD WRITS (11) ────────────────────────────────────────────────

/** A guild writ, and a commission, stands seven days (11: "unfilled after 7 days, the escrow returns"). */
export const WRIT_S = 7 * DAY_S;
/** The open writs a guild may stand at once (28: a buy order's twenty). */
export const GUILD_WRITS_MAX = 20;
/** A guild writ's units: 1 up to a character's Stores' most of a material (28). */
export const WRIT_UNITS_MAX = STORES_MAX;
/** A writ's pay each is at most this share of the material's Marks value, in hundredths (11: "1.5 x the materials'
 *  value", so a writ cannot be a disguised transfer to an alt - 13). */
export const WRIT_PAY_PCT = 150;
/** An Officers' writ budget a week, at most: the Marks cap (28). 0 until the Guildmaster sets it. */
export const WRIT_BUDGET_MAX = MARKS_MAX;
/** Writ posts an account may make an hour - a guild writ's and a commission's together (20: "writ posts 20"). */
export const WRIT_POSTS_MAX = 20;
/** Every other writ act an account may make an hour - a delivery, a fill, a withdrawal, a decline, a guild Stores move
 *  (the market's acts' number, 20: PROF5's 120). */
export const WRIT_OPS_MAX = 120;
export const WRIT_WINDOW_S = 3600;
/** The rows one sweep of expired writs and one settle of an account's commissions work, at most (the market's). */
export const WRIT_SETTLE_MAX = 20;
/** The most a region's board shows of each kind, and how long a closed commission stays in "Yours". */
export const WRIT_SHOWN = 50;
export const WRIT_RECENT_S = 7 * DAY_S;
/** A writ's, a commission's and a guild Stores move's request id - every account act's shape. */
export const WRIT_RID_RE = /^[A-Za-z0-9_-]{8,40}$/;
/** A writ's or a commission's id - the service's own (SOC1's `mintId` shape, as the market's). */
export const WRIT_ID_RE = /^[A-Za-z0-9_-]{4,40}$/;

/** Whether a guild writ may ask this material: one the market takes - PROF5's catalogue, what something yields. */
export const writMaterialOk = (key) => typeof key === 'string' && marketCatalogue().some((m) => m.key === key);
/** A writ's units: a whole number, 1 to 5,000. */
export const writUnitsOk = (n) => Number.isSafeInteger(n) && n >= 1 && n <= WRIT_UNITS_MAX;
/** The most a guild writ may pay a unit of `key`: 1.5 x its Marks value, rounded down (a tier-1 material pays 1). */
export const writPayMax = (key) => {
  const m = material(key);
  return m ? Math.floor((m.value * WRIT_PAY_PCT) / 100) : 0;
};
/** A writ's pay each: a whole number of Marks, 1 up to its material's most. */
export const writPayOk = (key, pay) => Number.isSafeInteger(pay) && pay >= 1 && pay <= writPayMax(key);
/** An Officers' writ budget: a whole number of Marks, 0 to the cap. */
export const writBudgetOk = (n) => Number.isSafeInteger(n) && n >= 0 && n <= WRIT_BUDGET_MAX;

// ─── THE SEAT WEEK (Seats-Arc 3) ─────────────────────────────────────

/** The week an Officer's writ budget is counted in is the seat week (28): Sunday 18:00 UTC to Sunday 18:00, week 0
 *  beginning at the first Turning, Sunday 2026-09-20 18:00 UTC (Seats-Arc 3: `ONLINE_EPOCH_MS` + 6 days 18 hours). */
export const SEAT_WEEK_S = 7 * DAY_S;
export const SEAT_WEEK_ZERO_S = Date.UTC(2026, 8, 20, 18, 0, 0) / 1000;
/** The seat week a moment falls in (before the first Turning, a negative one). */
export const seatWeek = (nowS) => Math.floor((nowS - SEAT_WEEK_ZERO_S) / SEAT_WEEK_S);
/** When a seat week begins. */
export const seatWeekStart = (week) => SEAT_WEEK_ZERO_S + week * SEAT_WEEK_S;

// ─── THE GUILD STORES (7) ────────────────────────────────────────────

/** A guild's Stores hold at most this many of a material (28: ten characters' Stores - a seat's works ask hundreds). */
export const GUILD_STORES_MAX = 50_000;
/** A guild Stores move's units: a whole number, 1 to a character's Stores' most. */
export const guildMoveOk = (n) => Number.isSafeInteger(n) && n >= 1 && n <= STORES_MAX;
/** The moves of the guild Stores a Guild tab shows. */
export const GUILD_STORE_MOVES_SHOWN = 20;

// ─── COMMISSIONS (11) ────────────────────────────────────────────────

/** An account's open commissions (28), and those naming one crafter (so no one can bury a crafter's list). */
export const COMMISSIONS_MAX = 5;
export const COMMISSIONS_FOR_MAX = 20;
/** A commission's pay: a listing's price bounds, 1 to 1,000,000 Marks. */
export const commissionPayOk = (n) => priceOk(n);
/** AUDIT 31 L2: whether a recipe asks a material nothing yields yet (a Daedric or Warforged piece; PROF7: a garment in
 *  Standard-bearer's Silk) - no one could make it, so no one may be asked to. */
export const commissionUnyielded = (recipeId) => !!recipeById(recipeId)?.inputs.some((i) => UNYIELDED.includes(i.key));
/** Whether a recipe may be commissioned: a piece the market lists (weapons, armour, staves, bows, tools, kits,
 *  furniture; PROF7's leather armour, clothing and furnishings) - never arrows or a siege work - that someone could make
 *  now. */
export const commissionable = (recipeId) => pieceListable(recipeId) && !commissionUnyielded(recipeId);
/** Whether a recipe's piece takes a quality - a kit does not, so its commission asks none. */
export const commissionTakesQuality = (recipeId) => {
  const r = recipeById(recipeId);
  return !!r && takesQuality(r);
};
/** A commission's least quality: 0 (Crude) to Masterwork where the recipe takes one; none (null) where it does not. */
export const commissionQualityOk = (recipeId, q) => (commissionTakesQuality(recipeId)
  ? Number.isInteger(q) && q >= 0 && q <= MASTERWORK
  : q === null);
/** Whether a piece answers a commission: the recipe asked, and at least the quality asked. */
export const commissionFilledBy = (c, piece) => !!piece && piece.recipe === c.recipe
  && (c.quality == null || (Number.isInteger(piece.quality) && piece.quality >= c.quality));

/**
 * WHAT EACH GUILD RANK MAY DO OF PROF6'S (the ranks that may - GUILD1's ranks, 0 the Guildmaster, 1 an Officer): post a
 * guild writ (an Officer within the week's budget, 11), set the Officers' budget, withdraw from the guild Stores (7 -
 * any member deposits, GUILD1's own `deposit`). Kept here, not in guildLaw.js's GUILD_POWERS: the relay bundles
 * guildLaw.js (SLAM13, test/relayversion.test.js), and powers it never reads must not move its law.
 */
export const WRIT_POWERS = Object.freeze({
  postWrit: Object.freeze([0, 1]),
  writBudget: Object.freeze([0]),
  storesWithdraw: Object.freeze([0, 1]),
});
/** Whether a rank may do one of PROF6's guild acts (AUDIT 31 L9: a power's own name only - never `toString`'s). */
export const writMay = (rank, power) => (Object.hasOwn(WRIT_POWERS, power) ? WRIT_POWERS[power] : []).includes(rank);
/** AUDIT 31 R1: whether a character of this rank may take `units` of a material out of its guild's Stores, holding
 *  `ownDeposit` of it there: an Officer or the Guildmaster any of it, any member back what they put in of their own. */
export const guildTakeMay = (rank, units, ownDeposit) => writMay(rank, 'storesWithdraw')
  || (Number.isSafeInteger(rank) && Number.isSafeInteger(ownDeposit) && units <= ownDeposit);
/** AUDIT 31 S6: whether an account holding `rank` in a writ's guild (null, none) may deliver to that writ - not a rank
 *  that takes the guild Stores out, which could sell the guild the same units again and again (its writ budget, or the
 *  treasury, become its own Marks - GUILD1's law: only the Guildmaster withdraws). */
export const writDeliverMay = (rank) => rank == null || !writMay(rank, 'storesWithdraw');

// ─── GUILD CONTRACTS (SILVER-WAYS) ───────────────────────────────────

/**
 * SILVER-WAYS (2026-10-03, Mac: "Do it"): A GUILD CONTRACT - a writ for DEEDS where a guild writ asks materials. A guild
 * puts up `pay` silver for each defender of a raid in a region, `deeds` of them, from its treasury (escrowed, as a
 * writ's pay is); every account a raid's receipt pays there is paid by the contract as its claim is counted, less the
 * market's 5% tax. It mints nothing: it moves a guild's silver to the fighters who hold its towns, so a guild of
 * gatherers can pay a guild's fighters without any new silver being struck.
 *
 * RAIDS ONLY, for now: a raid's region is in its key, read against the day's roll by the relay (RAID-ROLL), so a claim
 * cannot name another region's contract; a gate's region is still the claiming client's word until three claims agree
 * (seatInfluence.js), and a contract paid on one account's word would be one account's to empty.
 */
export const CONTRACT_KINDS = Object.freeze(['raid']);
/** A contract stands a guild writ's seven days. */
export const CONTRACT_S = WRIT_S;
/** The open contracts a guild may stand at once. */
export const GUILD_CONTRACTS_MAX = 5;
/** A contract's pay a defender: 1 to 50 silver (the raid's own faucet is 30 - a contract may pay more, never a fortune
 *  an alt could be fed by). */
export const CONTRACT_PAY_MAX = 50;
/** A contract's deeds: 1 to 500 defenders. */
export const CONTRACT_DEEDS_MAX = 500;
/** The contracts one raid's claim is paid by, at most - the best-paying first (a claim's batch stays bounded). */
export const CONTRACTS_PAID_MAX = 3;
export const contractKindOk = (k) => typeof k === 'string' && CONTRACT_KINDS.includes(k);
export const contractPayOk = (n) => Number.isSafeInteger(n) && n >= 1 && n <= CONTRACT_PAY_MAX;
export const contractDeedsOk = (n) => Number.isSafeInteger(n) && n >= 1 && n <= CONTRACT_DEEDS_MAX;
/** The region a raid's key names (`region:location:day`, raidLaw.js RAID_KEY_RE), or null for no key. */
export const contractRegionOfRaid = (key) => {
  if (typeof key !== 'string' || !RAID_KEY_RE.test(key)) return null;
  return Number(key.slice(0, key.indexOf(':')));
};
/** Whether an account holding `rank` in a contract's guild (null, none) may be paid by it - not a rank that may post or
 *  withdraw one (the Guildmaster's and the Officers'), who could pay themselves the treasury a raid at a time. Any other
 *  member may: paying its own fighters is what a contract is for. */
export const contractPaidMay = (rank) => rank == null || !writMay(rank, 'postWrit');
