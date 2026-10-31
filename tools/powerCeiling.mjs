#!/usr/bin/env node
// POWER-CEILING (2026-10-27, bible/05-Combat/Power-Ceiling.md): THE CEILINGS, MEASURED. A blow's powers and a hurt's
// guards each come from a few registries; this reads every registry's own most from the records and laws the code reads,
// so the two composite ceilings in src/systems/powerCeiling.js are a product of today's tops, not a guess.
// test/combat/powerceiling.test.js runs the same functions: a record that raises a registry's top fails it.
//
//   node tools/powerCeiling.mjs        the tops, the ceilings and the kit each top is reached with
import { isMain } from './lib/isMain.mjs';
import { AFFIX_RANGES, allLegendaries, powerOf } from '../src/systems/loot/lootRarity.js';
import '../src/systems/thunderlock.js'; // registers The Last Lock, a Legendary record of its own
import { GILDED_RECORDS } from '../src/systems/gilded.js';
import { SIGIL_POWER_MAX, SIGIL_STAGES } from '../src/systems/sigil/sigil.js';
import {
  SIGIL_SETS,
  tierValues,
  SET_STAGE_MAX,
  RAMPAGE_STACKS,
  BLOOD_STACKS,
  COIL_STACKS,
  UNBROKEN_LESS,
} from '../src/systems/sigil/sigilSets.js';
import {
  STAT_DEFS,
  BLOW_CAP,
  BLOW_TOTAL_CAP,
  CAST_COST_CAP,
  blowPct,
  statDef,
  ATTRIBUTES,
  COMBAT_SKILLS,
  LIFE_SKILLS,
  FIRM_ELEMENTS,
  SCHOOLS,
  GATHERING,
  CRAFTING,
  ACTS,
} from '../src/net/firmament/firmamentLaw.js';
import { FIRM_NODES } from '../src/net/firmament/firmamentTree.js';
import { WEAPON_POTENCY_PER_POINT, WEAPON_HALF_PER_POINT, WEAPON_GEAR_PCT_MOST } from '../src/systems/weaponMastery.js';
import { EFFECTIVE_SKILL_MAX, SKILL_SOFT_CAP } from '../src/systems/skillSoftcap.js';
import { MARTIAL_BLOW_MOST } from '../src/systems/martialPowers.js';
import { MARTIAL_NUMBERS } from '../src/systems/martialPaths.js';
import { PATH_NUMBERS } from '../src/systems/arcanePaths.js';
import { WEAPON_HANDS } from '../src/characters/equipRules.js';

/** The places a set is worn (sigilSets.js SET_PLACES: seven body pieces, the shield, one weapon). */
export const SET_PLACE_COUNT = 9;

// ── what each set tier and each Legendary power does to a blow or a hurt ───────────────────────────────────────────
/** A set tier's most onto one blow (per cent), at its numbers `v` - sigilSetPowers.js setBlow, read at its best moment. */
export const SET_TIER_BLOW = Object.freeze({
  bloodfury: (v) => v.more * 2, // twice below half health
  rampage: (v) => v.stack * RAMPAGE_STACKS,
  nightfall: (v) => v.more, // an unaware foe
  wrath: (v) => v.more,
  riposte: (v) => v.more,
  'run-them-down': (v) => v.more,
  'no-escape': (v) => v.more,
  'blood-for-blood': (v) => v.stack * BLOOD_STACKS,
  constrict: (v) => v.stack * COIL_STACKS,
  'tallow-ward': (v) => v.more,
  'battlemages-discipline': (v) => v.armed, // a foe that takes the cast's element whole
  'bound-in-silk': (v) => v.more,
  undertow: (v) => v.more, // the open sea
});
/** A set tier's share off a hurt (per cent) - sigilSetPowers.js setDamageMod. Pools (Iron Hide's ward, the Reprieve's
 *  shield) spend points, not shares, and stand outside the composite as a Shield spell's pool does. */
export const SET_TIER_GUARD = Object.freeze({
  unbroken: () => UNBROKEN_LESS,
  'hold-the-line': (v) => v.less,
  gearward: (v) => v.lighter,
});
/** A Legendary or Gilded power's most onto one blow - lootPowers.js lootBlow - and the moment it needs: `fresh` the
 *  foe's first landed blow, `struck` a foe already struck to every stack, `any` either. */
export const POWER_BLOW = Object.freeze({
  bane: { pct: (p) => p.pct, moment: 'any' },
  unaware: { pct: (p) => p.pct, moment: 'any' },
  sanctified: { pct: (p) => p.pct, moment: 'any' },
  flow: { pct: (p) => p.pct * p.max, moment: 'any' }, // its stacks are mine, from any foe
  moon: { pct: (p) => p.pct + p.beast, moment: 'any' },
  rage: { pct: (p) => p.pct, moment: 'any' },
  execute: { pct: (p) => p.pct, moment: 'any' },
  firstblood: { pct: (p) => p.pct, moment: 'fresh' },
  toll: { pct: (p) => p.pct, moment: 'any' }, // the third shot of the weapon, at any foe
  undertow: { pct: (p) => p.pct * p.max, moment: 'struck' },
  broadside: { pct: (p) => p.pct, moment: 'struck' }, // the other hand's mark: the pistol's shot landed on this foe
});
/** A power's share off a hurt - lootPowers.js lootDamageMod. Dawnward and the Raven turn a blow aside whole (an
 *  avoidance), Bulwark takes points, Unyielding caps a hit by health: none is a share, all stand outside. */
export const POWER_GUARD = Object.freeze({
  hex: (p) => p.less,
  bedrock: (p) => p.less * p.max,
  laststand: (p) => p.less,
});

// ── the sets: every way nine places can be filled ──────────────────────────────────────────────────────────────────
/** Every set's tiers awake at a count of its pieces: 2, 4 or 6 worn wake one, two or all three. */
const tiersAt = (set, n) => set.tiers.filter((t) => n >= t.at);
/** Every way to wear sets in the nine places (each set at 0, 2, 4 or 6 pieces), as `[[set, n]]` lists. */
export function setKits(sets = Object.values(SIGIL_SETS), places = SET_PLACE_COUNT) {
  const out = [];
  const walk = (i, left, kit) => {
    if (i === sets.length) {
      if (kit.length) out.push(kit);
      return;
    }
    for (const n of [0, 2, 4, 6]) if (n <= left) walk(i + 1, left - n, n ? [...kit, [sets[i], n]] : kit);
  };
  walk(0, places, []);
  return out;
}
const ascendant = (t) => tierValues(t, SET_STAGE_MAX);

/** THE SETS' TOP onto one blow: the most any way of filling the nine places wakes, every tier at Ascendant. */
export function setsBlowTop() {
  let best = { pct: 0, kit: [] };
  for (const kit of setKits()) {
    let pct = 0;
    for (const [set, n] of kit) for (const t of tiersAt(set, n)) pct += SET_TIER_BLOW[t.key]?.(ascendant(t)) ?? 0;
    if (pct > best.pct) best = { pct, kit: kit.map(([s, n]) => `${s.id} ${n}`) };
  }
  return best;
}
/** THE SETS' LEAST share of a hurt kept: the guards any way of filling the nine places wakes, multiplied. */
export function setsGuardKeep() {
  let best = { keep: 1, kit: [] };
  for (const kit of setKits()) {
    let keep = 1;
    for (const [set, n] of kit)
      for (const t of tiersAt(set, n)) keep *= 1 - (SET_TIER_GUARD[t.key]?.(ascendant(t)) ?? 0) / 100;
    if (keep < best.keep) best = { keep, kit: kit.map(([s, n]) => `${s.id} ${n}`) };
  }
  return best;
}

// ── the loot: one weapon in hand, every worn power, a slayer line and the other hand's mark ────────────────────────
/** The powers a piece can carry, by where they ride: a weapon's on its own blows, the rest on every blow. */
function lootPowers() {
  const weapons = [],
    worn = [];
  for (const r of allLegendaries()) {
    const p = powerOf(r.id);
    if (!p) continue;
    (r.group === 'Weapons' ? weapons : worn).push({ id: r.id, power: p, templates: r.templates ?? null, slayer: true });
  }
  for (const r of GILDED_RECORDS)
    weapons.push({ id: r.id, power: r.power, templates: [r.templateIndex], slayer: false }); // a static roll: no slayer line is ever added
  return { weapons, worn };
}
/** A weapon record a free hand can go with (any one of its templates held in one hand). */
const oneHanded = (w) => !w.templates || w.templates.some((t) => WEAPON_HANDS[t] !== 'Both');

/** THE LOOT'S TOP onto one blow: the best weapon power, every worn blow power and the best slayer line, at the moment
 *  that pays most - a foe's first blow (First Blood) or a foe already struck (the Undertow's stacks, Broadside's mark). */
export function lootBlowTop() {
  const { weapons, worn } = lootPowers();
  const marks = weapons.filter((w) => w.power.kind === 'broadside');
  const slayerTop = AFFIX_RANGES.slayer.legendary[1]; // an Exalted Legendary's line; a Rare's is lower
  const blowOf = (p, moment) => {
    const b = POWER_BLOW[p.kind];
    return b && (b.moment === 'any' || b.moment === moment) ? b.pct(p) : 0;
  };
  let best = { pct: 0, kit: [] };
  for (const w of [{ id: 'no power', power: null, templates: null, slayer: true }, ...weapons]) {
    if (w.power?.kind === 'broadside') continue; // the mark is the other hand's
    for (const moment of ['fresh', 'struck']) {
      let pct = (w.power ? blowOf(w.power, moment) : 0) + (w.slayer ? slayerTop : 0);
      const kit = [w.id];
      for (const o of worn) {
        const n = blowOf(o.power, moment);
        if (n) {
          pct += n;
          kit.push(o.id);
        }
      }
      if (moment === 'struck' && oneHanded(w))
        for (const m of marks) {
          pct += blowOf(m.power, moment);
          kit.push(`${m.id} (other hand)`);
        }
      if (pct > best.pct) best = { pct, kit: [...kit, `slayer ${w.slayer ? slayerTop : 0}`, moment] };
    }
  }
  return best;
}
/** THE LOOT'S LEAST share of a hurt kept: every guard power worn at once (a power counts once, whatever carries it). */
export function lootGuardKeep() {
  const { worn } = lootPowers();
  let keep = 1;
  const kit = [];
  for (const o of worn) {
    const g = POWER_GUARD[o.power.kind];
    if (g) {
      keep *= 1 - g(o.power) / 100;
      kit.push(o.id);
    }
  }
  return { keep, kit };
}

// ── the laws that cap themselves ───────────────────────────────────────────────────────────────────────────────────
/** The sky's most onto one blow: every channel at its own most, an unaware foe and a wounded wielder (firmamentLaw.js). */
export function firmamentBlowTop() {
  const c = Object.fromEntries(Object.entries(STAT_DEFS).map(([k, d]) => [k, d.max]));
  return blowPct(c, { skill: 'LongBlade', group: 'undead', unaware: true, wounded: true });
}
/** A weapon skill's climb past 100 at its most, at the axe's and the hammer's rate, and, WEAPON-GEAR, its gear's most
 *  (weaponMastery.js weaponPastPct adds them). */
export const masteryBlowTop = () =>
  Math.round(
    (EFFECTIVE_SKILL_MAX - SKILL_SOFT_CAP) * Math.max(WEAPON_POTENCY_PER_POINT, WEAPON_HALF_PER_POINT) * 100 +
      WEAPON_GEAR_PCT_MOST,
  );
/** The most share a path's guard takes off a hurt - one path held at a time, each its own law. */
const lighterTop = (numbers) => Math.max(0, ...Object.values(numbers).map((n) => n.lighter ?? 0));

/** THE BLOW POWERS' TOPS, per cent onto one blow, by registry (entityMods.js weaponBlowMods' order of import). */
export function measureBlowTops() {
  return {
    sigil: (SIGIL_POWER_MAX * SIGIL_STAGES[SIGIL_STAGES.length - 1].share) / 100,
    sets: setsBlowTop().pct,
    loot: lootBlowTop().pct,
    firmament: firmamentBlowTop(),
    mastery: masteryBlowTop(),
    martial: MARTIAL_BLOW_MOST,
  };
}
/** THE GUARDS' KEEPS, the least share of a hurt each registry leaves (playerEntity.js playerDamageMods). */
export function measureGuardKeeps() {
  return {
    loot: lootGuardKeep().keep,
    sets: setsGuardKeep().keep,
    firmament: 1 + Math.min(STAT_DEFS.blowTaken.min, STAT_DEFS.spellTaken.min) / 100,
    martial: 1 - lighterTop(MARTIAL_NUMBERS) / 100,
    arcane: 1 - lighterTop(PATH_NUMBERS) / 100,
  };
}
// ── every number a power or a set tier carries, and the role it plays ────────────────────────────────────────────
/** Set tiers and Legendary/Gilded power kinds that neither add to a blow nor take a share off a hurt - each named, so a
 *  new one has to be measured before the walk passes it. */
export const SET_TIER_OTHER = Object.freeze([
  'orc-hide',
  'spite',
  'ravager',
  'shadows-grace',
  'eventide',
  'forbidden-lore',
  'waters',
  'eye',
  'burning-gate',
  'cleave',
  'watch-oath',
  'keen-eyed',
  'thick-skinned',
  'iron-hide',
  'sea-scale',
  'shed-skin',
  'dwemer-brass',
  'hour-turns',
  'battlemages-bearing',
  'battlemages-reprieve',
  'wyrd-sight',
  'soul-harvest',
  'spinners-thread',
  'mephalas-veil',
  'stormwrack',
  'captains-due',
]);
export const POWER_OTHER = Object.freeze([
  'chain',
  'unyielding',
  'dawnward',
  'fortune',
  'tribute',
  'mastery',
  'venom',
  'quake',
  'conduit',
  'siphon',
  'echo',
  'vigil',
  'haste',
  'fists',
  'evade',
  'bulwark',
  'grace',
  'regen',
  'absorb',
  'climate',
  'school',
  'longroad',
  'bearing',
  'hood',
  'pierce',
  'attune',
  'surge',
  'dragonfire',
  'hammerfall',
]);
/** A number's role by its field's name; `kind.field` (a power's kind, a tier's key) where one name means two things. A
 *  `line:` role is a line's kind, held to the Legendary band's top; `id` names a thing, not an amount. */
export const FIELD_ROLES = Object.freeze({
  more: 'blow',
  stack: 'blow',
  armed: 'blow',
  pct: 'blow',
  beast: 'blow',
  less: 'guard',
  lighter: 'guard',
  armor: 'line:armor',
  strength: 'line:stat',
  endurance: 'line:stat',
  agility: 'line:stat',
  intelligence: 'line:stat',
  willpower: 'line:stat',
  speed: 'line:stat',
  critical: 'line:skill',
  stealth: 'line:skill',
  schools: 'line:skill',
  archery: 'line:skill',
  blunt: 'line:skill',
  fire: 'line:resist',
  frost: 'line:resist',
  shock: 'line:resist',
  poison: 'line:resist',
  magic: 'line:resist',
  resist: 'line:resist',
  heal: 'heal',
  absorb: 'chance',
  chance: 'chance',
  share: 'splash',
  back: 'thorns',
  sear: 'flat',
  flat: 'flat',
  nova: 'burst',
  ward: 'ward',
  shield: 'shield',
  magicka: 'magicka',
  refund: 'mana',
  mana: 'manaFlat',
  recover: 'recover',
  halved: 'seconds',
  seconds: 'seconds',
  rounds: 'rounds',
  below: 'below',
  above: 'above',
  max: 'stacks',
  charges: 'cadence',
  every: 'cadence',
  most: 'hitCap',
  metres: 'reach',
  mult: 'find',
  gold: 'gold',
  heat: 'climate',
  cold: 'climate',
  fatigue: 'road',
  fall: 'road',
  points: 'pierce',
  guns: 'ship',
  hull: 'ship',
  foes: 'id',
  school: 'id',
  skill: 'id',
  standing: 'line:standing',
  'siphon.pct': 'mana',
  'regen.pct': 'regen',
  'regen.low': 'regen',
  'attune.pct': 'regen',
  'attune.low': 'regen',
  'surge.pct': 'spell',
  'mastery.less': 'cost',
  'mastery.low': 'cost',
  'conduit.less': 'cost',
  'school.less': 'cost',
  'waters.less': 'cost',
  'bulwark.less': 'flatGuard',
  'haste.speed': 'buff',
  'hood.more': 'line:skill',
});
/** Roles where the smaller number is the stronger one (a shorter recovery, a trigger on fewer hits, a lower cap). */
export const LOWER_IS_STRONGER = Object.freeze(['recover', 'above', 'cadence', 'hitCap']);
/** Every number of every power and every set tier at Ascendant: `{ where, field, value, role }`. */
export function powerNumbers() {
  const out = [];
  const add = (where, kind, p) => {
    for (const [field, value] of Object.entries(p)) {
      if (typeof value !== 'number' && !Array.isArray(value)) continue;
      out.push({ where, field, value, role: FIELD_ROLES[`${kind}.${field}`] ?? FIELD_ROLES[field] ?? null });
    }
  };
  for (const r of allLegendaries()) {
    const p = powerOf(r.id);
    if (p) add(`${r.id} (${p.name})`, p.kind, p);
  }
  for (const r of GILDED_RECORDS) add(`${r.id} (${r.power.name})`, r.power.kind, r.power);
  for (const s of Object.values(SIGIL_SETS))
    for (const t of s.tiers) add(`${s.id} ${t.at} (${t.name})`, t.key, ascendant(t));
  return out;
}
/** Today's strongest number of each role (lines aside: a line's top is the band's). `lower`: the roles where less is more. */
export function roleTops(numbers = powerNumbers(), lower = LOWER_IS_STRONGER) {
  const tops = {};
  for (const n of numbers) {
    if (!n.role || n.role === 'id' || n.role.startsWith('line:')) continue;
    const low = lower.includes(n.role);
    if (!(n.role in tops) || (low ? n.value < tops[n.role] : n.value > tops[n.role])) tops[n.role] = n.value;
  }
  return Object.fromEntries(Object.entries(tops).sort(([a], [b]) => a.localeCompare(b)));
}

// ── the paths and the sky (AUDIT HORIZONTAL D8): their own numbers, each held to today's strongest of its role ──────
/** A path number's role by its field's name (martialPaths.js MARTIAL_NUMBERS, arcanePaths.js PATH_NUMBERS - shares as
 *  fractions, so the paths keep a table of their own); `entry.field` where one name means two things. */
export const PATH_FIELD_ROLES = Object.freeze({
  pct: 'blow',
  lighter: 'guard',
  stacks: 'stacks',
  seconds: 'seconds',
  rounds: 'rounds',
  recover: 'recover',
  oneIn: 'oneIn',
  below: 'below',
  heal: 'heal',
  health: 'killHeal',
  magicka: 'killMana',
  trapped: 'killMana',
  fatigue: 'fatigue',
  pace: 'pace',
  share: 'extra',
  burn: 'extra',
  back: 'refund',
  leech: 'leech',
  foes: 'foes',
  times: 'times',
  metres: 'reach',
  points: 'pierce',
  perMissing: 'perMissing',
  chance: 'chance',
  agility: 'line:stat',
  speed: 'line:stat',
  personality: 'line:stat',
  dodging: 'line:skill',
  running: 'line:skill',
  jumping: 'line:skill',
  etiquette: 'line:skill',
  streetwise: 'line:skill',
  'flowingSteel.pct': 'blowStack',
  'conflux.pct': 'spellStack',
  'warRhythm.pct': 'pace',
  'grit.health': 'regen',
  'grit.fatigue': 'regen',
  'steadfast.pct': 'regen',
  'spellsteel.pct': 'spell',
  'unseenStrike.pct': 'spell',
  'dawnsWard.pct': 'spell',
  'sanguine.most': 'spell',
  'betweenMoments.pct': 'castSpeed',
  'attunedWards.pct': 'cost',
  'aegisBolt.most': 'shieldCap',
  'dawnbolt.heal': 'leechShare',
  'siphonLife.share': 'leechShare',
  'soulLance.share': 'manaShare',
});
/** The paths' roles where the smaller number is the stronger one. */
export const PATH_LOWER_IS_STRONGER = Object.freeze(['recover', 'oneIn', 'perMissing']);
/** Every number of every martial and arcane path: `{ where, field, value, role }`. */
export function pathNumbers() {
  const out = [];
  for (const [table, numbers] of [
    ['martial', MARTIAL_NUMBERS],
    ['arcane', PATH_NUMBERS],
  ]) {
    for (const [id, p] of Object.entries(numbers)) {
      for (const [field, value] of Object.entries(p))
        out.push({
          where: `${table} ${id}`,
          field,
          value,
          role: PATH_FIELD_ROLES[`${id}.${field}`] ?? PATH_FIELD_ROLES[field] ?? null,
        });
    }
  }
  return out;
}
/** The sky's family channels (firmamentLaw.js statDef's `fam.arg` keys), each by its own args. */
const SKY_FAMILIES = Object.freeze({
  skill: [...COMBAT_SKILLS, ...LIFE_SKILLS],
  skillPct: [...COMBAT_SKILLS, ...LIFE_SKILLS],
  pct: ATTRIBUTES,
  resist: FIRM_ELEMENTS,
  castCost: SCHOOLS,
  yield: GATHERING,
  xp: [...GATHERING, ...CRAFTING],
  act: ACTS,
});
/** A channel that takes off what lands on me: its strength is how far below nothing it may go. */
const SKY_TAKEN = Object.freeze(['blowTaken', 'spellTaken']);
/** Every channel the sky can carry - its fixed ones, its families' and every key a star names - at its cap (the most the
 *  whole sky gives), with the blow's and the spell's group caps: `{ where, field, value, role }`. A role is the channel
 *  (`fam:kind` for a family's, every attribute one), so a new channel fails until it is measured. */
export function skyNumbers() {
  const keys = new Set([
    ...Object.keys(STAT_DEFS),
    ...Object.entries(SKY_FAMILIES).flatMap(([f, args]) => args.map((a) => `${f}.${a}`)),
  ]);
  for (const n of FIRM_NODES.values()) for (const k of Object.keys(n.stats ?? {})) keys.add(k);
  const out = [];
  for (const key of keys) {
    const d = statDef(key);
    const fam = key.includes('.') ? key.slice(0, key.indexOf('.')) : null;
    const role = !d ? null : fam ? `${fam}:${d.kind}` : ATTRIBUTES.includes(key) ? 'attribute' : key;
    out.push({
      where: `the sky ${key}`,
      field: SKY_TAKEN.includes(key) ? 'min' : 'max',
      value: d ? (SKY_TAKEN.includes(key) ? -d.min : d.max) : null,
      role,
    });
  }
  out.push(
    { where: 'the sky BLOW_CAP', field: 'cap', value: BLOW_CAP, role: 'blowCap' },
    { where: 'the sky BLOW_TOTAL_CAP', field: 'cap', value: BLOW_TOTAL_CAP, role: 'blowTotal' },
    { where: 'the sky CAST_COST_CAP', field: 'cap', value: CAST_COST_CAP, role: 'castCostCap' },
  );
  return out;
}

/** A line's kind's top: the Legendary band's last number (lootRarity.js AFFIX_RANGES - validAffix's own `max`). */
export const lineTop = (id) => AFFIX_RANGES[id]?.legendary?.[1] ?? null;
/** THE LINE LAW, as a list: every line of `item` past its kind's top (or of no kind at all), in words. */
export function linesPastCeiling(item) {
  const out = [];
  for (const a of Array.isArray(item?.affixes) ? item.affixes : []) {
    const top = lineTop(a?.id);
    if (top == null) out.push(`a line of no kind (${JSON.stringify(a)})`);
    else if (!(Number.isInteger(a.value) && a.value <= top))
      out.push(`${a.id}${a.param != null ? `:${a.param}` : ''} ${a.value} past ${top}`);
  }
  return out;
}

export const productOf = (tops) => Object.values(tops).reduce((k, p) => k * (1 + p / 100), 1);
export const keepOf = (keeps) => Object.values(keeps).reduce((k, s) => k * s, 1);
export { BLOW_TOTAL_CAP };

if (isMain(import.meta.url)) {
  const blow = measureBlowTops(),
    guard = measureGuardKeeps();
  console.log('THE BLOW POWERS (per cent onto one blow, each registry at its best):');
  for (const [k, v] of Object.entries(blow)) console.log(`  ${k.padEnd(10)} +${v}%`);
  console.log(`  composite x${productOf(blow).toFixed(5)}`);
  console.log(`  sets kit: ${setsBlowTop().kit.join(', ')}`);
  console.log(`  loot kit: ${lootBlowTop().kit.join(', ')}`);
  console.log('THE GUARDS (share of a hurt each leaves, at its strongest):');
  for (const [k, v] of Object.entries(guard)) console.log(`  ${k.padEnd(10)} x${v.toFixed(4)}`);
  console.log(`  composite x${keepOf(guard).toFixed(6)} kept (${(100 - keepOf(guard) * 100).toFixed(2)}% off)`);
  console.log(`  sets kit: ${setsGuardKeep().kit.join(', ')}; loot kit: ${lootGuardKeep().kit.join(', ')}`);
  console.log("EVERY OTHER NUMBER, today's strongest by role:");
  console.log(`  ${JSON.stringify(roleTops())}`);
  const loose = powerNumbers().filter((n) => !n.role);
  if (loose.length) console.log(`  NO ROLE: ${loose.map((n) => `${n.where}.${n.field}`).join(', ')}`);
  console.log("THE PATHS' NUMBERS, today's strongest by role:");
  console.log(`  ${JSON.stringify(roleTops(pathNumbers(), PATH_LOWER_IS_STRONGER))}`);
  console.log("THE SKY'S CHANNELS, each at its cap:");
  console.log(`  ${JSON.stringify(roleTops(skyNumbers(), []))}`);
}
