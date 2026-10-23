// @ts-check
// ═══════════════════════════════════════════════════════════════════
// FIRM1 (2026-10-13) - THE FIRMAMENT'S LAW: what a star gives, what a character may spend, which allocations are
// whole, what a refund costs, and THE BUDGET - the most the whole sky may ever add to a character, however it is spent.
// The tree is firmamentTree.js; the record is bible/06-Systems/Firmament.md.
//
// ═══ THE TWO PURSES ═════════════════════════════════════════════════
//
//   STARS  - 2 for every Renown level past the first (98 at Renown 50; the lead dev: "make it 2 points per level up"). Renown is the account service's (net/renown.js:
//            the level is derived by the service and signed into the token), so no client can print a Star. A Star is
//            spent ANYWHERE in the sky.
//   CRAFT  - 1 for every 8 ranks across the character's ten profession tracks (125 at ten Masters), the service's own
//            tracks (net/professionLaw.js). A Craft point is spent on the LIFE RING ALONE: a gatherer, a crafter, a
//            trader earns them by doing - Albion's way - and they can never buy a blow, a spell or a ward.
//   An allocation FITS when its combat stars cost no more than the Stars, and all its stars together no more than the
//   Stars and the Craft points together (`fits`): the life ring takes Craft first, then any Stars left over.
//
// ═══ THE BUDGET - WHY PVE STAYS WHERE IT IS ═════════════════════════
//
//   Every number a star carries is summed (`totals`) and then CAPPED (`capped`) channel by channel (STAT_DEFS: a
//   weapon's blow at most +30% from the whole sky, a spell's damage +30%, blows taken at most 15% lighter...), and the
//   blow's and the spell's channels are capped again AS A GROUP at the moment they are read (`blowPct`, `castCostPct`)
//   - so no path through the sky, however it is chosen, adds more than the budget to a fight. Keystones count against
//   the same caps: they trade, they do not stack past them. A LIFE star carries life channels alone (pinned: every life
//   star's stat is `kind: 'life'`), so the Craft purse can never reach a fight at all. And the powers that read the sky
//   (systems/firmamentPowers.js) sleep offline (Daggerfall as it was), in a duel and an arena bout (sigil.js
//   sigilDueling, the word every loot and set power sleeps on), while mentoring, and never touch a blow or a spell at
//   another player (a siege and the Wrothgarian zone keep the pace and the price, as the loot and the sets do).
//
// Pure, no imports but the tree: the account Worker validates and applies it, the client draws and spends it.
// ═══════════════════════════════════════════════════════════════════

import { FIRM_NODES, FIRM_ADJ, START_KEYS, firmNode } from './firmamentTree.js';

// ─── THE PURSES ──────────────────────────────────────────────────────

/** Stars a Renown level brings: 2 for every level past the first (the lead dev, 2026-10-13: "make it 2 points per level"
 *  - 98 at Renown 50, beside up to 125 Craft points: well under half of the 518 stars, every cap still holding). */
export const STARS_PER_RENOWN = 2;
/** The highest Renown the purse reads (net/identityToken.js RENOWN_MAX - restated here so the Worker's graph stays this
 *  file and the tree; test/net/firmament/firm1_law.test.js holds the two equal). */
export const FIRM_RENOWN_MAX = 50;
/** Profession ranks, summed over the ten tracks, for one Craft point. */
export const CRAFT_RANKS_PER_POINT = 8;
/** The most ranks a track gives the purse (net/professionLaw.js PROF_RANK_MAX). */
export const CRAFT_RANK_MAX = 100;

const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.trunc(Number(v) || 0)));
/** The Stars a Renown level gives: 0 at Renown 1, 98 at 50. */
export const starsFor = (renown) => STARS_PER_RENOWN * (clampInt(renown ?? 1, 1, FIRM_RENOWN_MAX) - 1);
/** The Craft points a character's profession ranks give (any iterable of ranks, each 0..100). */
export function craftPointsFor(ranks) {
  let sum = 0;
  for (const r of ranks ?? []) sum += clampInt(r, 0, CRAFT_RANK_MAX);
  return Math.floor(sum / CRAFT_RANKS_PER_POINT);
}

// ─── THE CHANNELS ────────────────────────────────────────────────────

/** The attributes (statMods.js STAT_KEYS_ORDER's names); Personality is a life channel, the rest are a fight's. */
export const ATTRIBUTES = Object.freeze(['strength', 'intelligence', 'willpower', 'agility', 'endurance', 'personality', 'speed', 'luck']);
/** The skills a fight reads (systems/skills.js SKILLS' keys). */
export const COMBAT_SKILLS = Object.freeze(['ShortBlade', 'LongBlade', 'Axe', 'BluntWeapon', 'HandToHand', 'Archery', 'CriticalStrike', 'Backstabbing',
  'Dodging', 'Stealth', 'Running', 'Jumping', 'Destruction', 'Restoration', 'Illusion', 'Alteration', 'Thaumaturgy', 'Mysticism']);
/** The skills a life reads - the counter, the street, the road and the sea. */
export const LIFE_SKILLS = Object.freeze(['Mercantile', 'Etiquette', 'Streetwise', 'Swimming', 'Climbing', 'Medical', 'Lockpicking', 'Pickpocket']);
/** The five elements a saving throw is read against (systems/entityMods.js resist channel). */
export const FIRM_ELEMENTS = Object.freeze(['fire', 'frost', 'poison', 'shock', 'magic']);
/** The six schools a spell's price is read in. */
export const SCHOOLS = Object.freeze(['Destruction', 'Restoration', 'Illusion', 'Alteration', 'Thaumaturgy', 'Mysticism']);
/** The ten professions (net/professionLaw.js PROFESSIONS' ids) - the gathering five and the crafting five. */
export const GATHERING = Object.freeze(['mining', 'logging', 'herbalism', 'hunting', 'fishing']);
export const CRAFTING = Object.freeze(['smithing', 'building', 'outfitting', 'provisioning', 'enchanting']);
/** The gathering acts whose window a star widens (systems/herbAct.js, systems/fishAct.js). */
export const ACTS = Object.freeze(['herbalism', 'fishing']);

const SKILL_WORDS = (n) => (n === 'HandToHand' ? 'Hand-to-Hand' : n.replace(/([a-z])([A-Z])/g, '$1 $2'));
const cap1 = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const signed = (v) => (v >= 0 ? `+${v}` : `${v}`);
const pctLess = (v, what) => (v <= 0 ? `Take ${-v}% less ${what}` : `Take ${v}% more ${what}`);

/**
 * @typedef {{ kind: 'combat'|'life', max: number, min: number, words: (v: number) => string }} StatDef
 */
/** @param {'combat'|'life'} kind @param {number} max @param {(v: number) => string} words @param {number} [min] @returns {StatDef} */
const def = (kind, max, words, min = -max) => Object.freeze({ kind, max, min, words });

/** THE FIXED CHANNELS, each with what the whole sky may add to it (`max`) and take from it (`min`). */
export const STAT_DEFS = Object.freeze({
  ...Object.fromEntries(ATTRIBUTES.map((a) => [a, def(a === 'personality' ? 'life' : 'combat', 15, (v) => `${signed(v)} ${cap1(a)}`)])),
  // the weapon's blow - each channel capped, then the blow's whole group (BLOW_CAP, blowPct)
  weaponDmg: def('combat', 30, (v) => `${signed(v)}% damage with all weapons`, -20),
  meleeDmg: def('combat', 30, (v) => `${signed(v)}% melee weapon damage`, -20),
  bowDmg: def('combat', 30, (v) => `${signed(v)}% damage with bows`),
  fistDmg: def('combat', 30, (v) => `${signed(v)}% hand-to-hand damage`),
  shortDmg: def('combat', 30, (v) => `${signed(v)}% damage with short blades`),
  longDmg: def('combat', 30, (v) => `${signed(v)}% damage with long blades`),
  axeDmg: def('combat', 30, (v) => `${signed(v)}% damage with axes`),
  bluntDmg: def('combat', 30, (v) => `${signed(v)}% damage with blunt weapons`),
  undeadDmg: def('combat', 30, (v) => `${signed(v)}% weapon damage against the undead`),
  daedraDmg: def('combat', 30, (v) => `${signed(v)}% weapon damage against daedra`),
  beastDmg: def('combat', 30, (v) => `${signed(v)}% weapon damage against animals`),
  unawareDmg: def('combat', 40, (v) => `${signed(v)}% weapon damage against unaware foes`, 0),
  rageDmg: def('combat', 25, (v) => `${signed(v)}% weapon damage while below half Health`, 0),
  // the spell
  spellPower: def('combat', 30, (v) => `${signed(v)}% damage from your spells`, -20),
  spellPierce: def('combat', 10, (v) => `-${v} to saving throws against your spells`, 0),
  castCost: def('combat', 25, (v) => (v >= 0 ? `Spells cost ${v}% fewer Spell Points` : `Spells cost ${-v}% more Spell Points`), -20),
  castSpeed: def('combat', 15, (v) => `${signed(v)}% casting speed`),
  // what lands on you
  blowTaken: def('combat', 30, (v) => pctLess(v, 'damage from blows'), -15),
  spellTaken: def('combat', 30, (v) => pctLess(v, 'damage from spells and other harm'), -15),
  armor: def('combat', 10, (v) => `${signed(v)} to Armor Rating`),
  hp: def('combat', 75, (v) => `${signed(v)} maximum Health`, 0),
  mp: def('combat', 75, (v) => `${signed(v)} maximum Spell Points`, 0),
  // RAW ON THE KEY STARS, PERCENT ON THE SMALL (the lead dev, 2026-10-13: "combined with the ascend system you will get
  // waaay to many stat points just add stats with raw numbers to the key nodes and percentages to the smaller ones"): a
  // small star's Health and Spell Points are a share of the character's own, as its attributes and skills are (pct.*,
  // skillPct.* below)
  hpPct: def('combat', 15, (v) => `${signed(v)}% maximum Health`, 0),
  mpPct: def('combat', 15, (v) => `${signed(v)}% maximum Spell Points`, 0),
  hpRegen: def('combat', 10, (v) => `${(v / 10).toFixed(1)}% of Health restored each round`, 0),
  mpRegen: def('combat', 10, (v) => `${(v / 10).toFixed(1)}% of Spell Points restored each round`, 0),
  killHeal: def('combat', 6, (v) => `Slaying a foe restores ${v}% of your Health`, 0),
  killMana: def('combat', 6, (v) => `Slaying a foe restores ${v}% of your Spell Points`, 0),
  evade: def('combat', 10, (v) => `${v}% chance to avoid a blow entirely`, 0),
  absorb: def('combat', 15, (v) => `${v}% chance to absorb Destruction spells`, 0),
  // the life
  carry: def('life', 40, (v) => `Carry ${Math.abs(v)}% ${v < 0 ? 'less' : 'more'} weight`, -25),
  warmth: def('life', 6, (v) => `${signed(v)} warmth`, 0),
  coldDegrees: def('life', 10, (v) => `You feel the cold ${v} degrees less`, 0),
  heatDegrees: def('life', 10, (v) => `You feel the heat ${v} degrees less`, 0),
  dry: def('life', 40, (v) => `${v}% less soaked by rain and snow`, 0),
  fatigueLess: def('life', 40, (v) => `${v}% less Fatigue when traveling`, 0),
  fallLess: def('life', 40, (v) => `${v}% less damage from falling`, 0),
  standing: def('life', 10, (v) => `${signed(v)} reputation with every social group`, 0),
  sailSpeed: def('life', 15, (v) => `${signed(v)}% speed under sail`, 0),
});

/** A channel's definition - the fixed ones, and the families named by a dot: `skill.LongBlade`, `resist.fire`,
 *  `castCost.Destruction`, `yield.mining`, `xp.smithing`, `act.herbalism`. Null for a key no channel is. */
export function statDef(key) {
  if (typeof key !== 'string') return null;
  if (Object.hasOwn(STAT_DEFS, key)) return /** @type {any} */ (STAT_DEFS)[key];
  const dot = key.indexOf('.');
  if (dot < 0) return null;
  const fam = key.slice(0, dot), arg = key.slice(dot + 1);
  return FAMILIES[fam]?.(arg) ?? null;
}
/** @type {Record<string, (arg: string) => StatDef|null>} */
const FAMILIES = Object.freeze({
  skill: (n) => (COMBAT_SKILLS.includes(n) ? SKILL_DEF.combat[n] : LIFE_SKILLS.includes(n) ? SKILL_DEF.life[n] : null),
  resist: (e) => (FIRM_ELEMENTS.includes(e) ? RESIST_DEF[e] : null),
  castCost: (s) => (SCHOOLS.includes(s) ? SCHOOL_COST_DEF[s] : null),
  yield: (p) => (GATHERING.includes(p) ? YIELD_DEF[p] : null),
  xp: (p) => (GATHERING.includes(p) || CRAFTING.includes(p) ? XP_DEF[p] : null),
  act: (p) => (ACTS.includes(p) ? ACT_DEF[p] : null),
  pct: (a) => (ATTRIBUTES.includes(a) ? ATTR_PCT_DEF[a] : null),
  skillPct: (n) => (COMBAT_SKILLS.includes(n) ? SKILL_PCT_DEF.combat[n] : LIFE_SKILLS.includes(n) ? SKILL_PCT_DEF.life[n] : null),
});
/** A share of an attribute or a skill AS THE CHARACTER HAS IT (its permanent value - Ascend's points in it), on the
 *  small stars: `pct.strength` 4 is 4% of the character's Strength, `skillPct.LongBlade` 6 is 6% of its Long Blade. */
const ATTR_PCT_DEF = Object.freeze(Object.fromEntries(ATTRIBUTES.map((a) => [a, def(a === 'personality' ? 'life' : 'combat', 15, (v) => `${signed(v)}% ${cap1(a)}`, 0)])));
const SKILL_PCT_DEF = Object.freeze({
  combat: Object.freeze(Object.fromEntries(COMBAT_SKILLS.map((n) => [n, def('combat', 20, (v) => `${signed(v)}% ${SKILL_WORDS(n)}`, 0)]))),
  life: Object.freeze(Object.fromEntries(LIFE_SKILLS.map((n) => [n, def('life', 25, (v) => `${signed(v)}% ${SKILL_WORDS(n)}`, 0)]))),
});
/** The raw points a share of `base` comes to: whole, toward nothing. */
export const pctOf = (base, pct) => (Number.isFinite(base) && base > 0 && pct > 0 ? Math.floor((base * pct) / 100) : 0);
const profName = (p) => cap1(p);
const SKILL_DEF = Object.freeze({
  combat: Object.freeze(Object.fromEntries(COMBAT_SKILLS.map((n) => [n, def('combat', 15, (v) => `${signed(v)} ${SKILL_WORDS(n)}`)]))),
  life: Object.freeze(Object.fromEntries(LIFE_SKILLS.map((n) => [n, def('life', 20, (v) => `${signed(v)} ${SKILL_WORDS(n)}`)]))),
});
const RESIST_DEF = Object.freeze(Object.fromEntries(FIRM_ELEMENTS.map((e) => [e, def('combat', 20, (v) => `${signed(v)}% chance to resist ${e === 'magic' ? 'magic' : e}`, 0)])));   // a point of resistance is a point on the saving throw's hundred
const SCHOOL_COST_DEF = Object.freeze(Object.fromEntries(SCHOOLS.map((s) => [s, def('combat', 20, (v) => `${s} spells cost ${v}% less`, 0)])));
const YIELD_DEF = Object.freeze(Object.fromEntries(GATHERING.map((p) => [p, def('life', 30, (v) => `${signed(v)}% ${profName(p)} yield`)])));
const XP_DEF = Object.freeze(Object.fromEntries([...GATHERING, ...CRAFTING].map((p) => [p, def('life', 35, (v) => `${signed(v)}% ${profName(p)} experience`, -30)])));
const ACT_DEF = Object.freeze({
  herbalism: def('life', 40, (v) => (v >= 0 ? `A steadier hand when picking herbs (+${v}%)` : `A clumsier hand when picking herbs (${v}%)`), -30),
  fishing: def('life', 40, (v) => `${signed(v)}% more time to set the hook`, -30),
});

/** A stat's line as a player reads it: "+6 Long Blade", "+5% damage with bows". */
export const statWords = (key, v) => statDef(key)?.words(v) ?? `${key} ${signed(v)}`;

// ─── THE GROUPS, READ AT THE MOMENT OF THE BLOW AND THE CAST ─────────

/** The most the sky adds to one weapon blow from its general channels (any weapon, melee, the weapon's family, the foe's
 *  kind) - and the most it takes away. */
export const BLOW_CAP = 30;
export const BLOW_FLOOR = -20;
/** And from everything, the blow's conditions with it (an unaware foe, a wounded wielder). */
export const BLOW_TOTAL_CAP = 50;
/** The most the sky takes off a spell's price, all channels together. */
export const CAST_COST_CAP = 25;

/** The weapon families a blow is read in (systems/skills.js's weapon skills by name). */
const FAMILY_OF_SKILL = Object.freeze({ ShortBlade: 'shortDmg', LongBlade: 'longDmg', Axe: 'axeDmg', BluntWeapon: 'bluntDmg', Archery: 'bowDmg', HandToHand: 'fistDmg' });
const GROUP_KEY = Object.freeze({ undead: 'undeadDmg', daedra: 'daedraDmg', animal: 'beastDmg' });
/**
 * THE PERCENT THE SKY ADDS TO ONE WEAPON BLOW - `c` the capped totals; `skill` the weapon skill's name the blow is
 * struck with (`HandToHand` for fists, `Archery` for a bow); `group` the foe's kind (`undead`, `daedra`, `animal`,
 * `humanoid`, or null); `unaware` the foe had not noticed me; `wounded` I am below half my health.
 * @param {Readonly<Record<string, number>>} c
 * @param {{ skill?: string|null, group?: string|null, unaware?: boolean, wounded?: boolean }} blow
 */
export function blowPct(c, { skill = null, group = null, unaware = false, wounded = false } = {}) {
  const chans = ['weaponDmg'];
  if (skill && skill !== 'Archery') chans.push('meleeDmg');
  const fam = skill ? /** @type {Record<string, string>} */ (FAMILY_OF_SKILL)[skill] : null;
  if (fam) chans.push(fam);
  const g = group ? /** @type {Record<string, string>} */ (GROUP_KEY)[group] : null;
  if (g) chans.push(g);
  // AUDIT UICALM-FIRM1 L1 M2: the group's gains capped, then its prices paid (Night Mother's Embrace's -5 in an open
  // fight was swallowed by a melee and a short-blade sum already past the group's 30)
  const paid = pricesOf(c);
  let gain = 0, price = 0;
  for (const k of chans) { gain += (c[k] ?? 0) - (paid[k] ?? 0); price += paid[k] ?? 0; }
  let pct = Math.max(BLOW_FLOOR, Math.min(BLOW_CAP, gain) + price);
  if (unaware) pct += (c.unawareDmg ?? 0);
  if (wounded) pct += (c.rageDmg ?? 0);
  return Math.min(BLOW_TOTAL_CAP, pct);
}
/** THE PERCENT THE SKY TAKES OFF ONE SPELL'S PRICE - every school's own channel counts only where every effect of the
 *  spell is that school's (`schools` the schools its effects are in). Negative is a dearer spell. */
export function castCostPct(c, schools = []) {
  const chans = ['castCost'];
  const set = new Set(schools);
  if (set.size === 1) chans.push(`castCost.${[...set][0]}`);
  const paid = pricesOf(c);
  let gain = 0, price = 0;
  for (const k of chans) { gain += (c[k] ?? 0) - (paid[k] ?? 0); price += paid[k] ?? 0; }
  return Math.min(CAST_COST_CAP, gain) + price;   // the gains capped, then the price paid (AUDIT UICALM-FIRM1 L1 M2)
}

// ─── AN ALLOCATION ──────────────────────────────────────────────────

/** @typedef {{ start: string|null, keys: string[] }} Tree */
/** The empty sky - no sign chosen. */
export const EMPTY_TREE = Object.freeze({ start: null, keys: Object.freeze([]) });
/** Whether `key` names a start. */
export const isStart = (key) => START_KEYS.includes(key);
/** A list of keys made clean: strings the table holds, no start, no repeat, sorted - a key no table holds (a star taken
 *  out of the sky) is dropped, which is its refund. */
export function cleanKeys(keys) {
  const out = new Set();
  for (const k of Array.isArray(keys) ? keys : []) if (typeof k === 'string' && FIRM_NODES.has(k) && !isStart(k)) out.add(k);
  return [...out].sort();
}
/** What an allocation costs, by purse ring: `{ combat, life }` (a start is free). */
export function firmCostOf(keys) {
  let combat = 0, life = 0;
  for (const k of keys) { const n = firmNode(k); if (!n || n.kind === 'start') continue; if (n.ring === 'life') life++; else combat++; }
  return { combat, life };
}
/** Whether an allocation's cost FITS the purses: its combat stars within the Stars, all of it within both together. */
export function fits(keys, stars, craft) {
  const c = firmCostOf(keys);
  return c.combat <= stars && c.combat + c.life <= stars + craft;
}
/** What is left in each purse: `{ stars, craft }` - the Craft purse spent on the life ring first. */
export function pointsLeft(keys, stars, craft) {
  const c = firmCostOf(keys);
  const craftUsed = Math.min(craft, c.life);
  return { stars: stars - c.combat - (c.life - craftUsed), craft: craft - craftUsed };
}

/** A star a path may walk THROUGH: anything but a start other than its own, and a keystone (a keystone ends a path). */
const passable = (key, start) => { const n = firmNode(key); return !!n && n.kind !== 'keystone' && (n.kind !== 'start' || key === start); };
/** The stars of `set` reachable from `start` through `set` alone. */
function reachFrom(start, set) {
  const seen = new Set([start]);
  const q = [start];
  while (q.length) {
    const k = /** @type {string} */ (q.pop());
    if (k !== start && !passable(k, start)) continue;   // a keystone is reached, never walked through
    for (const nb of FIRM_ADJ.get(k) ?? []) if (set.has(nb) && !seen.has(nb)) { seen.add(nb); q.push(nb); }
  }
  seen.delete(start);
  return seen;
}
/**
 * WHY AN ALLOCATION IS NOT WHOLE, or null when it is: 'firm-start' (no start, or one the sky has not), 'firm-key' (a key
 * the sky has not, a start among the stars, a repeat), 'firm-path' (a star not joined to the start through the stars
 * allocated), 'firm-points' (more than the purses hold).
 * @param {{ start?: any, keys?: any }} tree @param {number} stars @param {number} craft
 */
export function treeFault(tree, stars, craft) {
  const start = tree?.start;
  const keys = tree?.keys;
  if (!Array.isArray(keys)) return 'firm-key';
  if (start == null) return keys.length ? 'firm-start' : null;
  if (!isStart(start)) return 'firm-start';
  const clean = cleanKeys(keys);
  if (clean.length !== keys.length) return 'firm-key';
  const set = new Set(clean);
  if (reachFrom(start, set).size !== set.size) return 'firm-path';
  if (!fits(clean, stars, craft)) return 'firm-points';
  return null;
}
/** The stars a refund of `key` takes with it - `key` and every star that only reached the start through it. */
export function refundTakes(tree, key) {
  if (!tree?.start || !tree.keys?.includes(key)) return [];
  const rest = new Set(tree.keys.filter((k) => k !== key));
  const kept = reachFrom(tree.start, rest);
  return [key, ...tree.keys.filter((k) => k !== key && !kept.has(k))].sort();
}
/**
 * THE SHORTEST WAY FROM WHAT IS ALLOCATED TO `target` - the stars to allocate, nearest first, ending with the target;
 * [] when it is allocated already or no way is open (another sign's start, or through a keystone). With no start yet,
 * none. Breadth-first over the sky, every star one step: PoE's own path preview.
 */
export function pathTo(tree, target) {
  const start = tree?.start;
  if (!start || !FIRM_NODES.has(target) || isStart(target)) return [];
  const have = new Set([start, ...(tree.keys ?? [])]);
  if (have.has(target)) return [];
  /** @type {Map<string, string|null>} */
  const from = new Map();
  const q = [];
  for (const k of have) { if (passable(k, start)) { from.set(k, null); q.push(k); } }
  for (let i = 0; i < q.length; i++) {
    const k = q[i];
    for (const nb of FIRM_ADJ.get(k) ?? []) {
      if (from.has(nb) || isStart(nb)) continue;
      from.set(nb, k);
      if (nb === target) {
        const path = [];
        for (let at = /** @type {string|null} */ (nb); at && !have.has(at); at = from.get(at) ?? null) path.push(at);
        return path.reverse();
      }
      if (passable(nb, start)) q.push(nb);
    }
  }
  return [];
}
/** Whether `key` may be allocated next: joined to the allocation (or the start) by one line. */
export const allocatable = (tree, key) => pathTo(tree, key).length === 1;

/** The keys `next` adds to `prev` and the keys it takes away. */
export function treeDiff(prev, next) {
  const p = new Set(prev?.keys ?? []), n = new Set(next?.keys ?? []);
  const startChanged = (prev?.start ?? null) !== (next?.start ?? null);
  return {
    added: [...n].filter((k) => startChanged || !p.has(k)).sort(),
    removed: [...p].filter((k) => startChanged || !n.has(k)).sort(),
    startChanged,
  };
}

// ─── REFUNDS ─────────────────────────────────────────────────────────

/** A refund is free below this Renown - a new character learns the sky by trying it - and then costs silver a star
 *  (net/marksLaw.js: the service's own currency, so a refund is never a client's word). */
export const REFUND_FREE_BELOW_RENOWN = 10;
export const REFUND_SILVER_PER_STAR = 10;
/** THE RESPEC (the lead dev, 2026-10-13: "let the player respec for 10k gold"): the whole sky taken back at once - every
 *  star and the birthsign, to choose again - for this much gold, whatever the Renown, and no silver. A realm character's
 *  record pays it on the service in the respec's own batch (server-account/src/firmament.js respecFirmament). */
export const FIRM_RESPEC_GOLD = 10_000;
/** What taking `removed` stars back costs a character at `renown`, in silver. Choosing the first sign costs nothing;
 *  changing sign takes every star back. */
export const refundSilver = (removed, renown) => (clampInt(renown ?? 1, 1, FIRM_RENOWN_MAX) < REFUND_FREE_BELOW_RENOWN ? 0 : Math.max(0, removed | 0) * REFUND_SILVER_PER_STAR);

// ─── WHAT THE SKY ADDS ───────────────────────────────────────────────

/** Every channel's raw sum over the start and the stars allocated: `{ key: value }`. */
export function totals(tree) {
  /** @type {Record<string, number>} */
  const out = {};
  if (!tree?.start) return out;
  for (const k of [tree.start, ...(tree.keys ?? [])]) {
    const n = firmNode(k);
    if (!n) continue;
    for (const [s, v] of Object.entries(n.stats)) out[s] = (out[s] ?? 0) + v;
  }
  return out;
}
/** Whether a stat's value is a PRICE - against its holder: less of a good thing, or more damage taken (`blowTaken`,
 *  `spellTaken`). Only a battle keystone carries one (pinned). */
export const isPrice = (key, v) => (/Taken$/.test(key) ? v > 0 : v < 0);
/** The sums over the start and the stars allocated, the gains and the prices apart: `{ gains, prices }`. */
export function treeParts(tree) {
  /** @type {Record<string, number>} */
  const gains = {};
  /** @type {Record<string, number>} */
  const prices = {};
  if (!tree?.start) return { gains, prices };
  for (const k of [tree.start, ...(tree.keys ?? [])]) {
    const n = firmNode(k);
    if (!n) continue;
    for (const [s, v] of Object.entries(n.stats)) { const to = isPrice(s, v) ? prices : gains; to[s] = (to[s] ?? 0) + v; }
  }
  return { gains, prices };
}
/** Where treeStats keeps each channel's price, for the group readers (blowPct, castCostPct) - off the channels' own
 *  entries, so a reader walking the stats sees the channels alone. */
export const PRICES = Symbol('firmament prices');
/** The prices treeStats paid on `c`, by channel (none on stats it did not make). */
const pricesOf = (c) => /** @type {Record<string, number>} */ (/** @type {any} */ (c)?.[PRICES] ?? {});
/** THE BUDGET: every channel held inside its `min`..`max`. A key no channel is drops. */
export function capped(raw) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const [k, v] of Object.entries(raw ?? {})) {
    const d = statDef(k);
    if (!d || !Number.isFinite(v) || v === 0) continue;
    out[k] = Math.max(d.min, Math.min(d.max, v));
  }
  return Object.freeze(out);
}
/**
 * The capped totals of an allocation - what every reader reads. AUDIT UICALM-FIRM1 L1 M2: THE GAINS ARE CAPPED, THEN THE
 * PRICE IS PAID - a keystone's price summed in before the cap was paid by nobody whose gains already stood past it
 * (Martyr's Vow's -4 spell damage left a capped mage at +30). Each channel's price rides on the stats under PRICES, so
 * a group read at the blow or the cast pays it after its own cap too.
 */
export function treeStats(tree) {
  const { gains, prices } = treeParts(tree);
  /** @type {Record<string, number>} */
  const out = {};
  /** @type {Record<string, number>} */
  const paid = {};
  for (const k of new Set([...Object.keys(gains), ...Object.keys(prices)])) {
    const d = statDef(k);
    if (!d) continue;
    const g = Math.max(d.min, Math.min(d.max, gains[k] ?? 0));
    const v = Math.max(d.min, Math.min(d.max, g + (prices[k] ?? 0)));
    if (v !== 0 && Number.isFinite(v)) out[k] = v;
    if (prices[k] && v - g) paid[k] = v - g;
  }
  Object.defineProperty(out, PRICES, { value: Object.freeze(paid) });
  return Object.freeze(out);
}
/** Which channels the budget holds back: `[{ key, raw, held }]` - the sky's sum past a cap, so the window can say so. */
export function overCap(raw) {
  const out = [];
  for (const [k, v] of Object.entries(raw ?? {})) {
    const d = statDef(k);
    if (d && (v > d.max || v < d.min)) out.push({ key: k, raw: v, held: Math.max(d.min, Math.min(d.max, v)) });
  }
  return out;
}

/** A gathering profession's yield and XP, and a craft's XP, as the account service applies them: the percent, and the
 *  quantity a harvest's `qty` becomes - whole units, the fraction a chance (`roll` the service's die in [0, 1)). */
export const yieldPct = (c, profession) => c[`yield.${profession}`] ?? 0;
export const xpPct = (c, profession) => c[`xp.${profession}`] ?? 0;
/** `qty` with `pct` percent more (less, below zero), never under 1 where it was at least 1. */
export function scaleQty(qty, pct, roll) {
  const q = Math.max(0, Math.trunc(Number(qty) || 0));
  if (!q || !pct) return q;
  const exact = (q * (100 + pct)) / 100;
  const whole = Math.floor(exact);
  return Math.max(1, whole + (roll < exact - whole ? 1 : 0));
}
/** XP with `pct` percent more (less), whole. */
export const scaleXp = (xp, pct) => Math.max(0, Math.floor((Math.max(0, Number(xp) || 0) * (100 + (pct || 0))) / 100));

// ─── THE ROW ─────────────────────────────────────────────────────────

/** The most stars an allocation lists (every star in the sky). */
export const FIRM_KEYS_MAX = FIRM_NODES.size;
/** An allocation packed for the service's row and the wire: "<start>|<key>,<key>,..." - empty for none. */
export const packTree = (tree) => (tree?.start ? `${tree.start}|${cleanKeys(tree.keys).join(',')}` : '');
/** A row's allocation, unpacked and made clean - a start the sky has not reads as none. */
export function unpackTree(s) {
  if (typeof s !== 'string' || !s) return { start: null, keys: [] };
  const bar = s.indexOf('|');
  const start = bar < 0 ? s : s.slice(0, bar);
  if (!isStart(start)) return { start: null, keys: [] };
  // AUDIT UICALM-FIRM1 L1 L4: a star the sky no longer has drops (cleanKeys), and every star that reached the start only
  // through it drops with it, free - never left paying stats in a row the law would refuse
  const keys = cleanKeys(bar < 0 ? [] : s.slice(bar + 1).split(','));
  const reached = reachFrom(start, new Set(keys));
  return { start, keys: keys.filter((k) => reached.has(k)) };
}
// ─── THE BUILD CODE ──────────────────────────────────────────────────
// A tree as a line a player pastes in Discord and another loads into the window: `FIRM-<sky>-<stars>`. `<stars>` is a
// bitmask over every key of the sky in sorted order (the start among them), trimmed of its empty tail, in base64 (`-+`),
// each run of three or more empty letters written `.` and its length (a build is one sign's corner of the sky);
// `<sky>` is four hex of this sky's own key list, so a code made under another sky (stars added since) is refused
// rather than read as a different build. Pure, both ends; the window's Share press makes and loads it.

const SKY_KEYS = [...FIRM_NODES.keys()].sort();
const SKY_INDEX = new Map(SKY_KEYS.map((k, i) => [k, i]));
/** Four hex of the sky's key list (FNV-1a): a code names the sky it was made under. */
export const SKY_TAG = (() => {
  let h = 0x811c9dc5;
  for (const ch of SKY_KEYS.join(',')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return (h >>> 16).toString(16).padStart(4, '0');
})();
/** Base64 with `+` for `_`: Discord reads a pair of underscores as italics and a copied code would lose them. */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-+';
export const BUILD_CODE_RE = /^FIRM-([0-9a-f]{4})-([A-Za-z0-9+.-]{0,120})$/;
/** A tree's build code (a tree with no sign: null). */
export function buildCode(tree) {
  if (!tree?.start || !isStart(tree.start)) return null;
  const bits = new Uint8Array(Math.ceil(SKY_KEYS.length / 6));
  for (const k of [tree.start, ...cleanKeys(tree.keys)]) { const i = SKY_INDEX.get(k); bits[Math.floor(i / 6)] |= 1 << (i % 6); }
  let end = bits.length;
  while (end > 0 && bits[end - 1] === 0) end--;
  const raw = [...bits.slice(0, end)].map((b) => B64[b]).join('');
  return `FIRM-${SKY_TAG}-${raw.replace(/A{3,63}/g, (run) => `.${B64[run.length]}`)}`;
}
/** The tree a build code names: `{ tree }`, or `{ error }` - 'build-code' (not one), 'build-sky' (made under another
 *  sky), 'build-start' (no single sign in it). The tree is not judged here: the window asks the law (treeFault). */
export function treeOfCode(code) {
  const m = BUILD_CODE_RE.exec(String(code ?? '').trim());
  if (!m) return { error: 'build-code' };
  if (m[1] !== SKY_TAG) return { error: 'build-sky' };
  const raw = m[2].replace(/\.(.)/g, (_, n) => 'A'.repeat(Math.max(0, B64.indexOf(n))));
  if (raw.includes('.')) return { error: 'build-code' };
  const keys = [];
  for (let c = 0; c < raw.length; c++) {
    const v = B64.indexOf(raw[c]);
    for (let b = 0; b < 6; b++) if (v & (1 << b)) { const k = SKY_KEYS[c * 6 + b]; if (!k) return { error: 'build-code' }; keys.push(k); }
  }
  const starts = keys.filter(isStart);
  if (starts.length !== 1) return { error: 'build-start' };
  return { tree: { start: starts[0], keys: keys.filter((k) => !isStart(k)).sort() } };
}

/** A request id (MARKS_RID_RE's shape), so a request asked twice is answered twice and charged once. */
export const FIRM_RID_RE = /^[A-Za-z0-9_-]{8,40}$/;
