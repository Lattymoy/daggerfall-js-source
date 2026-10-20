// @ts-check
// STEED1 (2026-10-11, the owner: "I want to build the new horse and wagon maintence systems. Horse should have stamina,
// feeding them grows your bond and improves their stats. Every horse should have different stats.") - HORSE CARE
// (bible/06-Systems/Horse-Care.md). The law, pure: every horse's four stats, its bond with its owner, its hunger, what it
// eats, its breath under a gallop. The runtime that runs it a frame at a time is systems/steedRuntime.js; the item's
// fields are systems/item/itemFields.js's (`horseBond`, `horseFed`), on DFU's one Horse template alone (systems/item/itemLaw.js).
//
//  - FOUR STATS, EACH HORSE ITS OWN. A horse's seed is the horse (systems/horse/horseCoats.js - rolled at its birth, never
//    changed), and its stats are its seed's: SPEED (the ride's pace), STAMINA (how long it gallops), ENDURANCE (how fast
//    its breath comes back, and how slowly a gallop spends it) and STRENGTH (what it pulls). Born 20-80, most near 50;
//    no field holds them, so a horse born before STEED1 has had its stats all along.
//  - THE BOND, 0-100 (`horseBond`, in tenths). Grown by feeding: a day's food a day's bond, more for what it loves.
//    Every five points of it are a point on every stat (BOND_STEP) - a Kindred horse is twenty points better than the
//    one bought. A horse traded away comes to its new owner a stranger (net/realm/realmTradeLaw.js RECEIVER_MARKS).
//  - HUNGER (`horseFed`, the minute of the character's clock its food runs out). Fed, then Hungry (its stats ten down,
//    its breath slower back), then STARVING two days on (twenty-five down, no gallop, and the bond fading two points a
//    day). It never dies of it. A horse at the stable is fed there; one left waiting in the world grazes enough never to
//    starve; one with its owner eats from their packs through any span of time they skip (tendHorses), or by hand.
//  - BREATH (stepBreath): a pool of STAMINA_BASE + STAMINA_PER_POINT x Stamina. A gallop spends it, ENDURANCE slowing
//    the spend; at nought the horse is WINDED and will not gallop again until WINDED_UNTIL of it is back. It comes back
//    at a walk or standing, half as fast under a rider at the ride's own pace, slower hungry.
//
// HORSE-TIERS (2026-10-15, Mac: "Allow turn off. Rework this system to be more in line with how we handle climates and
// calories boons."): what the horse PAYS is its tier's (systems/upkeep/upkeepTiers.js - Boons, the default: nothing below
// DFU's plain horse; Hard: the system above as it stood). The laws that charge take the tier's rules as an argument -
// steedStats, stepBreath, steedSpeedScale, teamDraftScale, feedHorse and tendHorses - and a law handed none runs HARD,
// so every pin written before the tiers still pins it. Everything else here is the world's, in every tier.

import { isHorseItem } from './horse/horseCoats.js';
import { UPKEEP_ITEM } from './upkeep/upkeepItemRows.js';
import { HORSE_CARE_HARD } from './upkeep/upkeepTiers.js';   // HORSE-TIERS: what a law handed no rules runs

export const STEED_STATS = Object.freeze(['speed', 'stamina', 'endurance', 'strength']);
export const STEED_STAT_TEXT = Object.freeze({ speed: 'Speed', stamina: 'Stamina', endurance: 'Endurance', strength: 'Strength' });
/** A horse is born with each stat in [STEED_BORN_MIN, STEED_BORN_MAX], the mean of two draws (most near the middle). */
export const STEED_BORN_MIN = 20;
export const STEED_BORN_MAX = 80;
/** A stat with its bond and hunger is held to [1, STEED_STAT_CAP]. */
export const STEED_STAT_CAP = 100;

const SEED_MAX = 65535;
/** A 32-bit mix of two integers (murmur3's finaliser). */
function mix(a, b) {
  let h = Math.imul((a >>> 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b >>> 0) + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
/** A seed the law knows (1..65535), else 0 - a horse not yet born. */
const seedOf = (item) => (isHorseItem(item) && Number.isInteger(item.horseSeed) && item.horseSeed >= 1 && item.horseSeed <= SEED_MAX ? item.horseSeed : 0);

/** The four stats a horse of `seed` is born with - `{ speed, stamina, endurance, strength }` - or null for no seed. */
export function bornStats(seed) {
  if (!Number.isInteger(seed) || seed < 1 || seed > SEED_MAX) return null;
  const span = STEED_BORN_MAX - STEED_BORN_MIN;
  /** @type {Record<string, number>} */
  const out = {};
  STEED_STATS.forEach((k, i) => { out[k] = STEED_BORN_MIN + Math.round(span * (mix(seed, 2 * i + 1) + mix(seed, 2 * i + 2)) / 2); });
  return /** @type {{ speed: number, stamina: number, endurance: number, strength: number }} */ (out);
}
/** A horse item's born stats, or null (not a horse, or not yet born). */
export const horseBornStats = (item) => bornStats(seedOf(item));

// ── the bond ────────────────────────────────────────────────────────
/** The bond is kept in tenths (`horseBond` 1..BOND_TENTHS_MAX; absent, none). */
export const BOND_TENTHS_MAX = 1000;
/** Every BOND_STEP points of bond are a point on every stat. */
export const BOND_STEP = 5;
/** The words a bond is said in, from the points each begins at. */
export const BOND_TIERS = Object.freeze([
  Object.freeze({ min: 0, name: 'Wary' }),
  Object.freeze({ min: 15, name: 'Accepting' }),
  Object.freeze({ min: 35, name: 'Familiar' }),
  Object.freeze({ min: 55, name: 'Trusting' }),
  Object.freeze({ min: 75, name: 'Devoted' }),
  Object.freeze({ min: 95, name: 'Kindred' }),
]);
/** A day's food is DAY_BOND_TENTHS of bond (three points) - the love a food is eaten with times more. */
export const DAY_BOND_TENTHS = 30;
/** A starving horse's bond fades by this many tenths a day (two points). */
export const STARVING_BOND_TENTHS_A_DAY = 20;
const bondTenths = (item) => (Number.isInteger(item?.horseBond) ? Math.max(0, Math.min(BOND_TENTHS_MAX, item.horseBond)) : 0);
/** The bond's word for `points`. */
export const bondTier = (points) => [...BOND_TIERS].reverse().find((t) => points >= t.min)?.name ?? BOND_TIERS[0].name;
/** The points a bond of `points` adds to every stat. */
export const bondBonus = (points) => Math.floor(Math.max(0, points) / BOND_STEP);

// ── hunger ──────────────────────────────────────────────────────────
export const MINUTES_A_DAY = 1440;
/** A horse first seen (bought, or owned before STEED1) comes fed this far ahead. */
export const NEW_HORSE_FED = 12 * 60;
/** A horse fed this far ahead is full - it will not eat. */
export const FULL_AHEAD = 30 * 60;
/** The most food a horse holds ahead of the clock. */
export const FED_AHEAD_MAX = 48 * 60;
/** Its food run out this long, a horse is starving. */
export const STARVING_AFTER = 2 * MINUTES_A_DAY;
export const HUNGER = Object.freeze({
  fed: Object.freeze({ key: 'fed', name: 'Fed', penalty: 0, breath: 1 }),
  hungry: Object.freeze({ key: 'hungry', name: 'Hungry', penalty: 10, breath: 0.7 }),
  starving: Object.freeze({ key: 'starving', name: 'Starving', penalty: 25, breath: 0.4 }),
});
/** The minute a horse's food runs out (`horseFed`), or null where it was never seen fed. */
export const fedUntil = (item) => (Number.isInteger(item?.horseFed) && item.horseFed > 0 ? item.horseFed : null);
/** How hungry a horse is at minute `now`: 'fed', 'hungry' or 'starving'. A horse never seen fed is fed (it comes so). */
export function hungerOf(item, now) {
  const f = fedUntil(item);
  if (f == null || now < f) return 'fed';
  return now - f >= STARVING_AFTER ? 'starving' : 'hungry';
}
/** The bond lost to starving by minute `now`, not yet taken off (tenths). */
const fadeBy = (item, now) => {
  const f = fedUntil(item);
  if (f == null) return 0;
  const starved = now - f - STARVING_AFTER;
  return starved > 0 ? Math.floor((starved / MINUTES_A_DAY) * STARVING_BOND_TENTHS_A_DAY) : 0;
};
/** A horse's bond at minute `now`, in points (a tenth's precision): its kept bond less what starving has faded. */
export const bondAt = (item, now) => Math.max(0, bondTenths(item) - fadeBy(item, now)) / 10;
/** Write a bond (tenths, clamped) - none dropped, as every field is at its default. */
function setBond(item, tenths) {
  const t = Math.max(0, Math.min(BOND_TENTHS_MAX, Math.round(tenths)));
  if (t > 0) item.horseBond = t; else delete item.horseBond;
}
/** Move a horse's food clock to `until`, the fade so far taken off its bond first (so it is never taken twice) - in a
 *  tier whose bond fades (HORSE-TIERS `bondFades`; Boons' never does, so none is owed there). */
function setFed(item, until, now, fades = true) {
  const fade = fades ? fadeBy(item, now) : 0;
  if (fade > 0) setBond(item, bondTenths(item) - fade);
  item.horseFed = Math.max(1, Math.round(until));
}
/** HORSE-TIERS: in a tier whose bond never fades, a starving horse's clock is held at the starving line - Starving still,
 *  the same world - so no fade is owed for the time the tier spent there when the tier turns. Answers whether it moved. */
function holdStarving(item, now) {
  const f = fedUntil(item);
  if (f == null || now - f <= STARVING_AFTER) return false;
  item.horseFed = Math.max(1, Math.round(now - STARVING_AFTER));
  return true;
}

// ── what a horse eats ───────────────────────────────────────────────
/** STEED1's own: the Sack of Oats (systems/upkeep/upkeepItemRows.js). */
export const OATS_TEMPLATE = UPKEEP_ITEM.Oats;
/** Climates & Calories' Apple, and Foraging's. */
export const APPLE_TEMPLATES = Object.freeze([532, 1608]);
/** What a horse eats: `hours` of food, eaten with `love` (bond a day's food x love), a `treat` given by hand alone. */
export const STEED_FOODS = Object.freeze({
  [OATS_TEMPLATE]: Object.freeze({ key: 'oats', name: 'oats', hours: 24, love: 1, treat: false }),
  [APPLE_TEMPLATES[0]]: Object.freeze({ key: 'apple', name: 'an apple', hours: 4, love: 1.5, treat: true }),
  [APPLE_TEMPLATES[1]]: Object.freeze({ key: 'apple', name: 'an apple', hours: 4, love: 1.5, treat: true }),
});
/** The food a horse eats this item as, or null. A quest's piece is never fed. */
export const steedFoodOf = (item) => (item && !item.questItem && Object.hasOwn(STEED_FOODS, item.templateIndex) ? STEED_FOODS[item.templateIndex] : null);
/** The first of `kind` ('oats' or 'apple') a pack holds, or null. */
export const steedFoodIn = (items, kind) => (Array.isArray(items) ? items.find((it) => steedFoodOf(it)?.key === kind) ?? null : null);
/** One of a food item spent from the pack: a stack one less, a last one taken out. */
function spend(items, food) {
  const i = items.indexOf(food);
  if (i < 0) return false;
  if ((food.stackCount ?? 1) > 1) food.stackCount--;
  else items.splice(i, 1);
  return true;
}

export const STEED_TEXT = Object.freeze({
  noHorse: 'You do not own a horse.',
  notHere: 'Your horse is not here to feed.',
  stabled: 'Your horse is at the stable, where it is fed.',
  full: (who) => `${who} is not hungry.`,
  noFood: (kind) => (kind === 'apple' ? 'You have no apples.' : 'You have no oats. A Stable sells them.'),
  ate: (who, food, tier, grew) => `${who} eats ${food}${grew ? `. Your bond grows (${tier}).` : '.'}`,
  winded: 'Your horse is winded.',
  starving: 'Your horse is too weak to gallop. Feed it.',
  rested: 'Your horse has its breath back.',
  ateOnTheRoad: (n) => `Your horse ate ${n === 1 ? 'a sack' : `${n} sacks`} of oats from your packs.`,
});

/**
 * THE FEED: `horse` (a horse item in `items`, the pack) eats one `kind` ('oats' or 'apple') out of the pack at minute
 * `now` - its food clock moved on by the food's hours (from now, or from where it stands ahead, to FED_AHEAD_MAX ahead
 * at most), and its bond grown by a day's bond a day's food times the food's love. A horse full (FULL_AHEAD) refuses.
 * In place: the horse and the pack keep their identity. Answers `{ ok, text, gained }` (gained in tenths). `from` the list
 * the food is taken out of (the pack, or the wagon's load - an inventory's Use), `food` the very piece (else the first).
 * @param {any[]} items @param {any} horse @param {'oats'|'apple'} kind @param {number} now @param {string} [who]
 * @param {{ from?: any[], food?: any, rules?: any }} [o]
 */
export function feedHorse(items, horse, kind, now, who = 'Your horse', { from = items, food = null, rules = HORSE_CARE_HARD } = {}) {
  if (!isHorseItem(horse) || !Array.isArray(items) || !items.includes(horse)) return { ok: false, text: STEED_TEXT.noHorse, gained: 0 };
  const piece = food && steedFoodOf(food)?.key === kind && Array.isArray(from) && from.includes(food) ? food : steedFoodIn(from, kind);
  if (!piece) return { ok: false, text: STEED_TEXT.noFood(kind), gained: 0 };
  return eat(from, horse, piece, now, rules, who);
}
function eat(items, horse, food, now, rules, who) {
  const f = steedFoodOf(food);
  const from = Math.max(now, fedUntil(horse) ?? now);
  if (from - now >= FULL_AHEAD) return { ok: false, text: STEED_TEXT.full(who), gained: 0 };
  const until = Math.min(now + FED_AHEAD_MAX, from + f.hours * 60);
  const gained = Math.round(((until - from) / MINUTES_A_DAY) * DAY_BOND_TENTHS * f.love);
  spend(items, food);
  setFed(horse, until, now, rules.bondFades);
  const before = bondTenths(horse);
  setBond(horse, before + gained);
  const grew = bondTenths(horse) > before;
  return { ok: true, text: STEED_TEXT.ate(who, f.name, bondTier(bondTenths(horse) / 10), grew), gained: bondTenths(horse) - before };
}

/** Where a horse is, for its keep: 'with' its owner (ridden, led, following, in the harness of a wagon with them - or
 *  Horse Cart and Cargo off: always), 'waiting' in the world where they left it (it grazes), or 'stabled' (fed there). */
export const STEED_WHERE = Object.freeze(['with', 'waiting', 'stabled']);
/** A span of the clock at least this long between two ticks was skipped (a rest, a wait, a journey, a load). */
export const SKIP_MINUTES = 60;
/** The stable tops a horse's food up to this far ahead whenever it falls under STABLE_TOP_UNDER. */
export const STABLE_FED = 12 * 60;
const STABLE_TOP_UNDER = 6 * 60;
/** Grazing keeps a waiting horse's food clock no further back than this - hungry, never starving. */
const GRAZED_BACK = STARVING_AFTER - 6 * 60;

/**
 * THE KEEP, a tick: every horse in the pack at minute `now`, its last tick at `since` - each first seen given its
 * food (NEW_HORSE_FED); a stabled one fed by the stable, a waiting one grazing; and one with its owner, across a span
 * skipped (SKIP_MINUTES or more), fed oats each time its food runs out while the oats last - the pack's first, then
 * `stores`' (the wagon's load, where it is with them) - the bond grown as by hand. In place. Answers `{ changed, ate }`
 * - whether any field moved, and how many sacks were eaten. HORSE-TIERS: `rules` the tier's (none: Hard) - where the
 * bond never fades, no fade is taken and a starving horse's clock is held at the starving line (holdStarving).
 * @param {any[]} items @param {number} now @param {{ since?: number|null, where?: string, stores?: any[], rules?: any }} [o]
 */
export function tendHorses(items, now, { since = null, where = 'with', stores = [], rules = HORSE_CARE_HARD } = {}) {
  let changed = false, ate = 0;
  if (!Array.isArray(items) || !Number.isFinite(now)) return { changed, ate };
  for (const horse of items.filter(isHorseItem)) {
    if (fedUntil(horse) == null) { horse.horseFed = Math.max(1, Math.round(now + NEW_HORSE_FED)); changed = true; continue; }
    // AUDIT STEED1 (2026-10-11): a horse grazing or in the stable never starved across the span the keep last ran
    // before (`since` - an inn's rest, a dungeon: no frame ticks indoors) - only a fade owed BEFORE it is taken; with no
    // span known, all of it to now
    const owedTo = since != null && since < now ? since : now;
    if (where === 'stabled') {
      if (/** @type {number} */ (fedUntil(horse)) < now + STABLE_TOP_UNDER) { setFed(horse, now + STABLE_FED, owedTo, rules.bondFades); changed = true; }
      continue;
    }
    if (where === 'waiting') {
      if (now - /** @type {number} */ (fedUntil(horse)) > GRAZED_BACK) { setFed(horse, now - GRAZED_BACK, owedTo, rules.bondFades); changed = true; }
      continue;
    }
    if (since != null && now - since >= SKIP_MINUTES) {
      // the skipped span: each time its food ran out inside it, a sack from the packs - eaten THEN (the fade to then taken)
      for (let f = /** @type {number} */ (fedUntil(horse)); f < now; f = /** @type {number} */ (fedUntil(horse))) {
        const from = steedFoodIn(items, 'oats') ? items : Array.isArray(stores) && steedFoodIn(stores, 'oats') ? stores : null;
        if (!from) break;
        const at = Math.max(f, since);
        const r = eat(from, horse, steedFoodIn(from, 'oats'), at, rules);
        if (!r.ok) break;
        ate++; changed = true;
      }
    }
    if (!rules.bondFades && holdStarving(horse, now)) changed = true;   // HORSE-TIERS: Boons owes no fade, then or later
  }
  return { changed, ate };
}

// ── the stats as they stand ─────────────────────────────────────────
/**
 * A horse's stats at minute `now`: born, then its bond's points on each and its hunger's off each, held to
 * [1, STEED_STAT_CAP]. `{ born, stats, bond, tier, bonus, hunger, penalty }`, or null for a horse not yet born.
 * HORSE-TIERS: `rules` the tier's (none: Hard) - hunger's penalty only where hunger costs, the fade only where the bond
 * fades. The hunger's word is the world's in every tier.
 */
export function steedStats(item, now, rules = HORSE_CARE_HARD) {
  const born = horseBornStats(item);
  if (!born) return null;
  const bond = rules.bondFades ? bondAt(item, now) : bondTenths(item) / 10;
  const hunger = hungerOf(item, now);
  const bonus = bondBonus(bond), penalty = rules.hungerCosts ? HUNGER[hunger].penalty : 0;
  /** @type {Record<string, number>} */
  const stats = {};
  for (const k of STEED_STATS) stats[k] = Math.max(1, Math.min(STEED_STAT_CAP, born[k] + bonus - penalty));
  return { born, stats: /** @type {typeof born} */ (stats), bond, tier: bondTier(bond), bonus, hunger, penalty };
}

/** A horse's price at a Stable by its born stats (`born` - bornStats): DFU's Horse's 1000 at a mean of 50, a fiftieth of
 *  it a point either way (800 at 40, 1200 at 60), never under STEED_PRICE_LEAST. */
export const STEED_PRICE = 1000;
export const STEED_PRICE_LEAST = 400;
export const steedValue = (born) => (born ? Math.max(STEED_PRICE_LEAST, Math.round(STEED_PRICE * (1 + (STEED_STATS.reduce((a, k) => a + born[k], 0) / STEED_STATS.length - 50) / 50))) : STEED_PRICE);

/** SPEED: the ride's pace (the motor's ride base) times this - 1 at 50, 0.85 + 0.003 a point, held to [0.85, 1.15].
 *  HORSE-TIERS: where the tier floors the pace (`paceFloor` - Boons), never under DFU's own, 1. */
export const steedSpeedScale = (speed, rules = HORSE_CARE_HARD) => {
  const k = Math.max(0.85, Math.min(1.15, 0.85 + 0.003 * speed));
  return rules.paceFloor ? Math.max(1, k) : k;
};
/** STRENGTH: a wagon's pace under its load (`load` its share of the wagon's limit, 0-1) times this, for a team of mean
 *  strength `strength` - nothing empty; full, 0.8 at 50 (0.3 - 0.002 a point of the load's share), never under 0.75.
 *  HORSE-TIERS: only where the tier's team drags (`draftDrags` - Hard); else 1, DFU's wagon. */
export const teamDraftScale = (strength, load, rules = HORSE_CARE_HARD) => (rules.draftDrags ? Math.max(0.75, Math.min(1, 1 - Math.max(0, Math.min(1, load)) * (0.3 - 0.002 * strength))) : 1);

// ── breath ──────────────────────────────────────────────────────────
export const STAMINA_BASE = 40;
export const STAMINA_PER_POINT = 1.2;
/** A second of gallop at Endurance 50 spends this (x 1.25 - Endurance / 200). */
export const GALLOP_SPEND = 3.3;
/** A second at a walk or standing at Endurance 50 brings this back (x 0.75 + Endurance / 200; x the hunger's breath). */
export const BREATH_BACK = 2.2;
/** Ridden at the ride's own pace (no gallop), the breath comes back at this share. */
export const RIDDEN_BACK = 0.5;
/** Winded, a horse will not gallop until this share of its breath is back. */
export const WINDED_UNTIL = 0.3;
/** A horse's breath at most (`stats` its stats as they stand). */
export const breathMax = (stats) => STAMINA_BASE + STAMINA_PER_POINT * (stats?.stamina ?? 50);
/** A horse's breath, fresh: `{ spent, winded }` - spent of breathMax. */
export const freshBreath = () => ({ spent: 0, winded: false });
/**
 * A step of a horse's breath, `dt` seconds: galloping it spends, else it comes back (`ridden` at the ride's pace, half;
 * hungry slower). At nought it is winded, until WINDED_UNTIL is back. Answers a new `{ spent, winded }`.
 * HORSE-TIERS: `rules` the tier's (none: Hard) - a hungry horse's breath slower back only where hunger costs.
 * @param {{ spent: number, winded: boolean }} b
 * @param {{ stats: any, hunger?: string, galloping?: boolean, ridden?: boolean, dt: number, rules?: any }} o
 */
export function stepBreath(b, { stats, hunger = 'fed', galloping = false, ridden = false, dt, rules = HORSE_CARE_HARD }) {
  const max = breathMax(stats), end = stats?.endurance ?? 50;
  let spent = Math.max(0, Math.min(max, b?.spent ?? 0)), winded = !!b?.winded;
  const t = Number.isFinite(dt) && dt > 0 ? dt : 0;
  if (galloping && !winded) spent += GALLOP_SPEND * (1.25 - end / 200) * t;
  else spent -= BREATH_BACK * (0.75 + end / 200) * (rules.hungerCosts ? HUNGER[hunger]?.breath ?? 1 : 1) * (ridden ? RIDDEN_BACK : 1) * t;
  spent = Math.max(0, Math.min(max, spent));
  if (spent >= max) winded = true;
  else if (winded && max - spent >= WINDED_UNTIL * max) winded = false;
  return { spent, winded };
}
/** The share of its breath a horse has (0-1). */
export const breathShare = (b, stats) => { const max = breathMax(stats); return max > 0 ? Math.max(0, Math.min(1, (max - (b?.spent ?? 0)) / max)) : 1; };
/** Whether a horse will gallop: not winded, not starving. */
export const canGallop = (b, hunger) => !b?.winded && hunger !== 'starving';

/** The horses of a pack, in its order - the first the one ridden (horseCoats.js activeHorseItem). */
export const horsesIn = (items) => (Array.isArray(items) ? items.filter(isHorseItem) : []);
/**
 * THE HORSE RIDDEN CHOSEN: horse `i` of the pack's horses (horsesIn) made the first - moved before the one ridden now, so
 * every reader of the ridden horse (its look, its stats, its breath) reads it. In place. `{ ok, text }`.
 */
export function chooseRiddenHorse(items, i) {
  const horses = horsesIn(items);
  const pick = horses[i];
  if (!pick) return { ok: false, text: STEED_TEXT.noHorse };
  if (pick === horses[0]) return { ok: true, text: 'You already ride that horse.' };
  items.splice(items.indexOf(pick), 1);
  items.splice(items.indexOf(horses[0]), 0, pick);
  return { ok: true, text: 'You will ride that horse now.' };
}
