// @ts-check
// ═══════════════════════════════════════════════════════════════════
// INT5 (2026-10-09, the INTEGRITY arc - bible/06-Systems/Integrity-Arc.md): THE WEALTH BUDGET. Realm-Arc section 4's
// "budgets per hour of online play the service measured itself", built.
//
// THE QUESTION IT ANSWERS. The world runs on the player's own machine (Multiplayer.md's first decision), so a kill, a
// chest and a counter's price are the client's word, and the item law (systems/item/itemLaw.js) can prove only that a piece
// is one the game could mint - never that this player found it. What a modified client gains on its word is bounded
// here instead: between two checkpoints the character's wealth (judge.js wealthOf) may rise by what the service saw
// move in the open (a market sale, a vault's piece - `witnessed`) and by what time spent playing could have earned. The
// latter is a BUCKET (`allowance`): it fills at the level's rate for every second the account played (players.played_s,
// which the service measures itself - accounts.js creditPlay: "The client sends no number"), up to the level's cap, and
// a gain no witness explains spends it. A signed win (a gate's, a raid's, a serpent's, an Abyss Dungeon's receipt)
// fills it by the spoils it pays (spoilsGrant), because those are client-rolled but server-witnessed.
//
// MEASURE FIRST (Mac, 2026-10-09: "Measure 7 days, then enforce"). The budget ships with `enforce` off: every gain is
// recorded by the hour (realm_wealth_hours) and a gain past the bucket is recorded as a `measure` finding - what WOULD
// have held - and nothing is held. Staff read the hours (/v1/mod/realm-budget, tools/realmReview.mjs), set the line
// from them and turn `enforce` on; from then a gain past the bucket holds the character's trade ('budget') until play
// refills it. The numbers below are the first setting, a guess the measure exists to replace.
// ═══════════════════════════════════════════════════════════════════

import { DB_ROOT } from './service.js';   // SCALE4d: the binding a request's counted Proxy wraps - what the config is kept by

/** The first setting, by level band: `upTo` the band's top level, `rate` the gold an hour of play may add, `cap` the most
 *  the bucket holds (hours of rate). OPEN, every one - the measure sets them. */
export const BUDGET_DEFAULT = Object.freeze({
  enforce: false,
  bands: Object.freeze([
    Object.freeze({ upTo: 5, rate: 30_000, cap: 180_000 }),
    Object.freeze({ upTo: 10, rate: 60_000, cap: 360_000 }),
    Object.freeze({ upTo: 20, rate: 120_000, cap: 720_000 }),
    Object.freeze({ upTo: 30, rate: 200_000, cap: 1_200_000 }),
    Object.freeze({ upTo: 1000, rate: 300_000, cap: 1_800_000 }),
  ]),
});
/** The spoils a signed win pays, as a bucket's fill: the gate's gold (gateSpoils.js: 250 x level, up to 1.2x) and its
 *  pieces (Realm-Arc: about 27k at level 10, 33k at 30), with room past the mean - a Regalia piece one time in six. */
export const SPOILS_GRANT_BASE = 60_000;
export const SPOILS_GRANT_PER_LEVEL = 2_000;
/** AUDIT WB14 (WIRE-6): a portent night's receipt pays a piece of Magic or better more for each of its portents
 *  (src/systems/gate/gateSpoils.js SPOILS_PORTENT_BITS) - the fill grows by a piece's room for each (a Magic piece is
 *  the dearer half of the mean's; a guess the measure replaces, as the rest). */
export const SPOILS_GRANT_PIECE = 10_000;
/** How many pieces a receipt's portents (`p`, its bits - net/gate/gateReceipt.js) pay: one a bit, three at most. */
export const portentPieces = (/** @type {unknown} */ p) => (Number.isSafeInteger(p) && /** @type {number} */ (p) > 0 ? [1, 2, 4].filter((b) => (/** @type {number} */ (p) & b) !== 0).length : 0);
export const spoilsGrant = (/** @type {number} */ level) => SPOILS_GRANT_BASE + SPOILS_GRANT_PER_LEVEL * Math.max(1, Math.trunc(Number(level) || 1));

/** A band's shape - whole, positive numbers, rising levels. */
const validBand = (/** @type {any} */ b) => !!b && Number.isSafeInteger(b.upTo) && b.upTo >= 1 && Number.isSafeInteger(b.rate) && b.rate >= 0 && Number.isSafeInteger(b.cap) && b.cap >= 0;
/** A config staff may write, or null: `enforce` a boolean, `bands` one to twelve valid bands with rising tops. */
export function budgetConfigOf(/** @type {unknown} */ v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const c = /** @type {any} */ (v);
  if (typeof c.enforce !== 'boolean' || !Array.isArray(c.bands) || c.bands.length < 1 || c.bands.length > 12 || !c.bands.every(validBand)) return null;
  for (let i = 1; i < c.bands.length; i++) if (c.bands[i].upTo <= c.bands[i - 1].upTo) return null;
  return { enforce: c.enforce, bands: c.bands.map((/** @type {any} */ b) => ({ upTo: b.upTo, rate: b.rate, cap: b.cap })) };
}
/** How long an isolate keeps the config it read (AUDIT INT: every checkpoint asked for it) - a change staff make is
 *  read at once where they made it (forgetBudgetConfig), and within a minute everywhere. */
export const BUDGET_CONFIG_KEEP_MS = 60_000;
/** @type {WeakMap<object, { at: number, config: any }>} */
const kept = new WeakMap();
/** SCALE4d: KEPT BY THE BINDING, never by the object a request hands in (STORM-SHED's DB_ROOT). A deployed service counts
 *  every request's statements through a Proxy made for that request (metrics.js countedDb), so keyed by `db` this kept
 *  nothing past its own request: every realm checkpoint read the config again, the minute it was meant to keep it. */
const keyOf = (/** @type {any} */ db) => (db && typeof db === 'object' ? db[DB_ROOT] ?? db : null);
/** The config standing: staff's, else the first setting. */
export async function budgetConfig(/** @type {any} */ db) {
  return budgetKept(db) ?? budgetFrom(db, await budgetRead(db).first());
}
/** SAVE-BATCH (2026-10-16): the config this isolate keeps (BUDGET_CONFIG_KEEP_MS), or null - so a checkpoint asks its row
 *  in the batch that reads the character's record, and only when it has none. */
export function budgetKept(/** @type {any} */ db) {
  const k = kept.get(keyOf(db) ?? {});
  return k && Date.now() - k.at < BUDGET_CONFIG_KEEP_MS ? k.config : null;
}
/** SAVE-BATCH: the config's row, as a statement. */
export const budgetRead = (/** @type {any} */ db) => db.prepare("SELECT value FROM realm_config WHERE key = 'budget'");
/** The config its row says (staff's, else the first setting), kept for the binding. */
export function budgetFrom(/** @type {any} */ db, /** @type {any} */ row) {
  let c = null;
  try { c = budgetConfigOf(JSON.parse(row?.value ?? 'null')); } catch { c = null; }
  const config = c ?? BUDGET_DEFAULT;
  const key = keyOf(db);
  if (key) kept.set(key, { at: Date.now(), config });
  return config;
}
/** A staff change made here: the next read asks the database. */
export const forgetBudgetConfig = (/** @type {any} */ db) => { const key = keyOf(db); if (key) kept.delete(key); };
/** The band a level plays in: the first whose top it does not pass, else the last. */
export const bandOf = (/** @type {{ bands: readonly any[] }} */ config, /** @type {number} */ level) => config.bands.find((b) => level <= b.upTo) ?? config.bands[config.bands.length - 1];

/**
 * ONE STEP OF THE BUCKET, pure: `allowance` (null - the character's first judgement: full), filled by `played` seconds
 * at the band's rate up to its cap - a bucket a win's spoils filled past the cap is never cut down to it (AUDIT INT: a
 * full bucket's grant was clamped away before the gain was charged) - then spent by `gain` (the rise no witness
 * explains; a fall spends nothing and refills nothing - spending gold is not earning it). Answers the bucket after and
 * whether the gain went past it (`over`, the gold past). While the budget only measures (`enforce` off), the bucket
 * keeps no debt: what went past is the measure's finding, and the line staff later set starts every character even
 * (AUDIT INT: a week's measured debt would have held everyone in it the moment enforce came on).
 * @param {{ allowance: number | null, played: number, gain: number, band: { rate: number, cap: number }, enforce?: boolean }} s
 */
export function stepBudget({ allowance, played, gain, band, enforce = true }) {
  const start = allowance ?? band.cap;
  const fill = Math.floor((band.rate * Math.max(0, played)) / 3600);
  const filled = start >= band.cap ? start : Math.min(band.cap, start + fill);
  const left = filled - Math.max(0, gain);
  return { allowance: enforce ? left : Math.max(0, left), over: left < 0 ? -left : 0 };
}

/**
 * A SIGNED WIN'S SPOILS, as the bucket's fill: the playing character of the account (the one holding a lease - one an
 * account) gains spoilsGrant at the level the realm TRUSTS (verdict.js trustedLevel - never the level its tile claims:
 * AUDIT INT, a level of 1000 written in one save made a win worth two million), once a receipt is RECORDED (a claim
 * answered again grants nothing). A character not yet judged has no bucket to fill; its first judgement starts it full.
 * AUDIT WB14 (WIRE-6): `pieces`, a gate receipt's portents' (portentPieces) - SPOILS_GRANT_PIECE more for each.
 * @param {any} db @param {string} playerId @param {number} [pieces]
 */
export async function grantSpoils(db, playerId, pieces = 0) {
  await spoilsGrantStatement(db, playerId, pieces).run();
}
/**
 * THE FILL AS ONE STATEMENT (AUDIT STARFALL B3): a claim whose own batch writes its receipt's row runs it IN that batch,
 * held to the row by `guard` (an SQL condition of the batch's, its parameters `binds` from ?5 on) - run after the batch,
 * a failure between the two (a 5xx, an isolate gone) lost the fill for good, the retry answered `claimed`.
 * @param {any} db @param {string} playerId @param {number} [pieces] @param {string|null} [guard] @param {...unknown} binds
 */
export function spoilsGrantStatement(db, playerId, pieces = 0, guard = null, ...binds) {
  return db.prepare(
    'UPDATE realm_characters SET allowance = allowance + ?2 + ?3 * MAX(1, COALESCE(level_seen, 1)) + ?4'
    + ' WHERE player = ?1 AND lease IS NOT NULL AND allowance IS NOT NULL AND dead_at IS NULL' + (guard ? ` AND (${guard})` : ''),
  ).bind(playerId, SPOILS_GRANT_BASE, SPOILS_GRANT_PER_LEVEL, SPOILS_GRANT_PIECE * Math.max(0, Math.min(3, Math.trunc(Number(pieces) || 0))), ...binds);   // AUDIT WB14 (WIRE-6): and a portent's pieces
}

/** LW15 (bible/06-Systems/Living-World-II.md "LW15"): THE SERVICE'S OWN FAUCETS - gold it pays that no player paid (a
 *  patron's purchase: market.js reckonPatrons) - kept by the hour and kind (realm_faucets) beside the wealth's hours, so
 *  staff read what the living world mints before the budget is enforced (Living World II decision 7). SUMMON-REPAIR: and
 *  staff's own refunds (review.js `repair`) - gold no player paid, named as its own kind. */
export const FAUCET_KINDS = Object.freeze(['patron', 'repair']);
/** One faucet's gold written to its hour. @param {any} db @param {string} kind @param {number} hour @param {number} gold */
export const faucetStatement = (db, kind, hour, gold) => db.prepare(
  'INSERT INTO realm_faucets (hour, kind, gold, n) VALUES (?1, ?2, ?3, 1) ON CONFLICT (hour, kind) DO UPDATE SET gold = realm_faucets.gold + excluded.gold, n = realm_faucets.n + 1',
).bind(hour, FAUCET_KINDS.includes(kind) ? kind : 'patron', Math.max(0, Math.trunc(Number(gold) || 0)));
