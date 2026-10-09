// @ts-check
// ═══════════════════════════════════════════════════════════════════
// INT5 (2026-10-09, the INTEGRITY arc - bible/06-Systems/Integrity-Arc.md): THE WEALTH BUDGET. Realm-Arc section 4's
// "budgets per hour of online play the service measured itself", built.
//
// THE QUESTION IT ANSWERS. The world runs on the player's own machine (Multiplayer.md's first decision), so a kill, a
// chest and a counter's price are the client's word, and the item law (systems/itemLaw.js) can prove only that a piece
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
/** The config standing: staff's, else the first setting. */
export async function budgetConfig(/** @type {any} */ db) {
  const row = await db.prepare("SELECT value FROM realm_config WHERE key = 'budget'").first();
  let c = null;
  try { c = budgetConfigOf(JSON.parse(row?.value ?? 'null')); } catch { c = null; }
  return c ?? BUDGET_DEFAULT;
}
/** The band a level plays in: the first whose top it does not pass, else the last. */
export const bandOf = (/** @type {{ bands: readonly any[] }} */ config, /** @type {number} */ level) => config.bands.find((b) => level <= b.upTo) ?? config.bands[config.bands.length - 1];

/**
 * ONE STEP OF THE BUCKET, pure: `allowance` (null - the character's first judgement, the cutover's baseline: full, and
 * nothing charged), filled by `played` seconds at the band's rate up to its cap, then spent by `gain` (the rise no
 * witness explains; a fall spends nothing and refills nothing - spending gold is not earning it). Answers the bucket after
 * and whether the gain went past it (`over`, the gold past).
 * @param {{ allowance: number | null, played: number, gain: number, band: { rate: number, cap: number } }} s
 */
export function stepBudget({ allowance, played, gain, band }) {
  if (allowance == null) return { allowance: band.cap, over: 0 };
  const filled = Math.min(band.cap, Math.max(allowance, allowance + Math.floor((band.rate * Math.max(0, played)) / 3600)));
  const left = filled - Math.max(0, gain);
  return { allowance: left, over: left < 0 ? -left : 0 };
}

/**
 * A SIGNED WIN'S SPOILS, as the bucket's fill: the playing character of the account (the one holding a lease - one an
 * account) gains spoilsGrant at its level, once a receipt is RECORDED (a claim answered again grants nothing). A
 * character not yet judged has no bucket to fill; its first judgement starts it full.
 * @param {any} db @param {string} playerId
 */
export async function grantSpoils(db, playerId) {
  await db.prepare(
    "UPDATE realm_characters SET allowance = allowance + ?2 + ?3 * MAX(1, COALESCE(json_extract(summary, '$.level'), 1))"
    + ' WHERE player = ?1 AND lease IS NOT NULL AND allowance IS NOT NULL AND dead_at IS NULL',
  ).bind(playerId, SPOILS_GRANT_BASE, SPOILS_GRANT_PER_LEVEL).run();
}
