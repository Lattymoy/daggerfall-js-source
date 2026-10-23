// @ts-check
// DUEL1 (2026-09-24, Mac: duels "traps both players" in a ring, and asked - "Yes: weapons, bows, spells"): THE BLOW
// BETWEEN TWO PLAYERS. Pure over the game's own formula - no scene, no socket - so the pins drive a strike without a
// browser.
//
// THE STRIKER'S HALF ALONE (INT8, INT9, INT10 - bible/06-Systems/Integrity-Arc.md 5). Every blow and spell between
// players - a duel's, a siege's and its works', a Royal Tourney's, the open zone's - is counted on the STRIKER's machine
// and sent as a number, which the relay's referee clips (net/duel/duelRef.js, siegeRef.js, wildRef.js); no defender's
// machine resolves anything, and nothing of the defender's sheet - its armour, Dodging, attributes, live effects -
// reaches any roll. The striker's sheet is its own LIVE one (duelAttackerOf: level, race, the eight attributes by
// liveStat - a Fortify's, a disease's, a Boons tier's - the four skills a blow reads, the career's bitfields, health;
// the weapon's template, material and condition - duelWeaponOf), stood up as the attacker (duelStub) and rolled
// (resolveDuelStrike) against a NEUTRAL stand-in (duelStandIn), on which a spell's harm is counted too
// (combat/siegeCombat.js siegeSpellNumbers). AUDIT C&C H5: the stand-in was a stub of the striker's own sheet, so
// every attribute it brought cancelled itself and PCAAO charged it for the "target's" luck, its own.
//
// DORMANT since INT8, DUEL1's defender-authoritative half (the defender stood the striker's sheet up and resolved the
// blow against itself): duelSpellFromWire (a spell's families applied as a caster's at the defender, effects.js
// bundleDuel) and duelBlowPlausible (where a blow could come from). No host calls them; they stand as DUEL1 left them.
//
// Not a DFU member: Daggerfall Unity has no other players. Ledger A (ONLINE).
import { calculateAttackDamage, baseDamageMax, damageModifier, WEAPON_MATERIAL_MODIFIER } from './formulas.js';
import { weaponDamageMods } from '../systems/entityMods.js';
import { SWING_MODS, WEAPON_REACH } from './playerWeapon.js';
import { createWeapon } from './enemyEquipment.js';
import { SKILLS, skillValue } from '../systems/skills.js';
import { liveStat } from '../systems/statMods.js';
import { offHandToHit, OFF_HAND_BLOW } from './twoHands/handsLaw.js';   // TWO-HANDS (AUDIT): the off hand's terms on a blow between players
import { STAT_KEYS_ORDER } from '../systems/chargen.js';
import { weaponSkillUsed } from '../characters/weapons.js';
import { armorValuesOf } from '../systems/equip.js';   // AUDIT C&C H5: the stand-in's unarmoured table, DFU's own 100s
import { clawMetalDamage, CLAW_METAL_MAX } from './clawMetal.js';   // AUDIT CLAWS A1: the beast's claws' metal rides the sheet
import { DUEL_LEVEL_MAX, DUEL_STAT_MAX, DUEL_SKILL_MAX, DUEL_RACE_MAX, DUEL_TEMPLATE_MAX, DUEL_MATERIAL_MAX, CARD_VITAL_MAX, CAST_EFFECTS_MAX, DUEL_SWINGS } from '../net/wire.js';

/** The four skills a blow reads, in the order the wire carries them (`sk`): the weapon's own (Archery for a bow, the
 *  blade's or the axe's ...), HandToHand, CriticalStrike, Backstabbing. The weapon's slot is resolved on each end off
 *  the template, so a sheet cannot name a skill the weapon does not use. */
export const DUEL_SKILL_SLOTS = Object.freeze(['weapon', SKILLS.HandToHand, SKILLS.CriticalStrike, SKILLS.Backstabbing]);
/** How far past a weapon's reach a melee strike may be claimed from, metres - the eased pose a striker saw trails the
 *  body by an interval and the wire (exteriorFoes.js PUPPET_LEAP_SLACK's two metres, the same allowance). */
export const DUEL_MELEE_SLACK_M = 2;
/** How far the striker's own claim of where it stood may be from where this machine sees it, metres. */
export const DUEL_POS_SLACK_M = 4;
/** AUDIT DUEL1 B6: ...and for a SWING, less - a claim four metres off plus the reach and its slack let a crafted swing
 *  land from eight and a half metres. Three still covers a charging striker's pose trailing its body (a run's 8 m/s
 *  over the pose's age and a relay leg). */
export const DUEL_MELEE_POS_SLACK_M = 3;
/** AUDIT DUEL1 B6: how far back MY OWN recent feet count for a swing's reach, ms - the striker measured its reach
 *  against where it saw me, which is where I was a pose's age and a relay leg or two ago; a defender running away
 *  measured only where it stands NOW dropped real connects. The host hands the trail (world.js _duelTrail). */
export const DUEL_TRAIL_MS = 500;
/** AUDIT DUEL1 A2: a result's damage wears the striker's own weapon ((10 dmg + 50) / 100, DFU's wear), and the
 *  damage is the DEFENDER's word - a forged 99999 broke a Daedric blade with one answer. The most a weapon can
 *  honestly deal is its own top roll with its material and the striker's strength, trebled by a backstab and at
 *  most doubled by the combat overhaul's critical strike: six of that bounds the wear. */
export const DUEL_WEAR_MULT = 6;
/** The spell families a duel's spell may carry, by classic type: Paralyze (0), Continuous Damage (1), Damage (4),
 *  Disintegrate (5), Drain (7), Silence (19). Everything else stays home: a beneficial spell is ALLY-CAST's, and the
 *  rest (Dispel, Soul Trap, Charm, Transfer's caster heal, Teleport ...) is nothing one player may do to another. */
export const DUEL_SPELL_TYPES = Object.freeze(new Set([0, 1, 4, 5, 7, 19]));

const int = (v) => Math.trunc(Number(v) || 0);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, int(v)));
const u32 = (v) => { const n = Number(v); return Number.isFinite(n) ? (n >>> 0) : 0; };

/** The skill a weapon template swings with - HandToHand for no weapon. */
const skillForTemplate = (t) => (Number.isInteger(t) ? (weaponSkillUsed(t) ?? SKILLS.HandToHand) : SKILLS.HandToHand);

/** THE ATTACKER'S SHEET, as the wire carries it (`a`), clamped at the wire's bounds so an honest frame is never refused.
 *  AUDIT CLAWS A1: `cm`, the beast's claws' metal (combat/clawMetal.js) - read here off the striker's own entity, because
 *  the stub has no equip table to read it from; the duel, the siege, the Royal Tourney, a siege work and the wild zone
 *  all strike through this sheet. Never on the wire since INT8 (a strike carries its rolled `d`). */
export function duelAttackerOf(entity, weapon = null) {
  const ws = skillForTemplate(weapon?.templateIndex);
  return {
    lv: clamp(entity?.level ?? 1, 1, DUEL_LEVEL_MAX),
    r: clamp(entity?.raceId ?? 0, 0, DUEL_RACE_MAX),
    st: STAT_KEYS_ORDER.map((k) => clamp(liveStat(entity, k), 0, DUEL_STAT_MAX)),
    sk: [ws, SKILLS.HandToHand, SKILLS.CriticalStrike, SKILLS.Backstabbing].map((id) => clamp(skillValue(entity, id), 0, DUEL_SKILL_MAX)),
    cf: [clamp(entity?.career?.attackModifierFlags ?? 0, 0, 255), u32(entity?.career?.weaponArmorShieldsBitfield), u32(entity?.career?.abilityFlagsAndSpellPointsBitfield)],
    h: [clamp(entity?.health ?? 0, 0, CARD_VITAL_MAX), clamp(entity?.maxHealth ?? 1, 1, CARD_VITAL_MAX)],
    cm: clamp(clawMetalDamage(entity), 0, CLAW_METAL_MAX),
  };
}

/** THE WEAPON, as the wire carries it (`w`): template, material and condition as a percentage - null for a bare hand
 *  (a werecreature's claws strike as the bare hand: playerWeapon.js strikingWeapon hands none). */
export function duelWeaponOf(item) {
  if (!item || !Number.isInteger(item.templateIndex) || item.templateIndex < 0 || item.templateIndex > DUEL_TEMPLATE_MAX) return null;
  const max = Number(item.maxCondition), cur = Number(item.currentCondition);
  const c = max > 0 && Number.isFinite(cur) ? clamp(Math.round((100 * cur) / max), 0, 100) : 100;
  return { t: item.templateIndex, m: clamp(item.material ?? 0, 0, DUEL_MATERIAL_MAX), c };
}

/** THE STUB the formula reads: a sheet of the wire's shape as an entity - the striker's own as the attacker
 *  (resolveDuelStrike), DUEL_STAND_IN as the body it strikes (duelStandIn). A player - the player arm's proficiency and
 *  racial mods are the striker's - marked `peer` so the formula's HUD report stays quiet (the host says a miss, the
 *  referee's word a hit), and a FRESH weapon off the template at the condition the striker's has, so the wear the
 *  formula lands falls on a copy (the striker's own wears by the referee's word - duelWearDamage). */
export function duelStub(a, w = null) {
  const stats = {};
  STAT_KEYS_ORDER.forEach((k, i) => { stats[k] = a.st[i]; });
  const weapon = w ? createWeapon(w.t, w.m, () => 0.5) : null;
  if (weapon) {
    weapon.poisonType = -1;
    if (Number(weapon.maxCondition) > 0) weapon.currentCondition = Math.max(0, Math.round((weapon.maxCondition * w.c) / 100));
  }
  const skillOverrides = {
    [skillForTemplate(w?.t)]: a.sk[0],
    [SKILLS.HandToHand]: a.sk[1],
    [SKILLS.CriticalStrike]: a.sk[2],
    [SKILLS.Backstabbing]: a.sk[3],
  };
  const stub = {
    isPlayer: true, peer: true,
    level: a.lv, raceId: a.r, stats, skillOverrides,
    career: { attackModifierFlags: a.cf[0], weaponArmorShieldsBitfield: a.cf[1], abilityFlagsAndSpellPointsBitfield: a.cf[2] },
    health: a.h[0], maxHealth: a.h[1],
    activeEffects: [], items: [], equipTable: {},
    // AUDIT CLAWS A1: the claws' metal as the sheet's word, never the gauntlets themselves - the stub has no equip table
    // to wear them from (and AUDIT C&C H5's neutral stand-in, duelStandIn, carries no `cm`: it has no claws)
    clawMetal: clamp(a.cm ?? 0, 0, CLAW_METAL_MAX),
  };
  return { stub, weapon };
}

/** AUDIT C&C H5: THE NEUTRAL SHEET every blow and spell between players is counted on (scenes/world.js duelStrikeOut,
 *  wildStrikeOut, siegeStrikeOut, siegeWorkHit, and siegeSpellNumbers' stand-in) - the defender's is no number the
 *  striker has (INT8). Every attribute at the middle of the wire's own clamp (DUEL_STAT_MAX / 2: the 50 at which every
 *  `stat - 50` term of both cores reads nought - PCAAO's luck charge, its natural resistance), the level at the clamp's
 *  floor (PCAAO's level / 2 reads nought), no race (the wire's 0: no racial save), no skill (nothing dodges), no career
 *  bits (no adrenaline rush), whole at the wire's vital ceiling (nothing here empties it - the referee holds the real
 *  one, so a Disintegrate counts whole and is clipped there). It was a stub of the striker's OWN sheet: every attribute
 *  and the rush the striker brought cancelled, PCAAO charged it for its own luck past 50, its own endurance resisted its
 *  blow, its own willpower and race saved against its spell - Thriving LOWERED its owner's hit chance, 60.59% bare to
 *  59.62% (200,000 seeded swings of the starting Shortsword); it lands 61.62% now, and its +5 Luck alone 60.59%. */
export const DUEL_STAND_IN = Object.freeze({
  lv: 1, r: 0,
  st: Object.freeze(STAT_KEYS_ORDER.map(() => DUEL_STAT_MAX / 2)),
  sk: Object.freeze([0, 0, 0, 0]),
  cf: Object.freeze([0, 0, 0]),
  h: Object.freeze([CARD_VITAL_MAX, CARD_VITAL_MAX]),
});
/** AUDIT C&C H5: THE STAND-IN, the one construction every host's roll and count takes - DUEL_STAND_IN stood up by the one
 *  stub, unarmoured (equip.js armorValuesOf, DFU's 100 on every part: with no table the stock core read 0, an armour
 *  past any armour, and a blow landed 3 in 100), and fresh each call (a spell's count writes on it). */
export function duelStandIn() {
  const { stub } = duelStub(DUEL_STAND_IN);
  armorValuesOf(stub);
  return stub;
}

/**
 * ONE STRIKE ROLLED (`d`: the striker's sheet `a` - duelAttackerOf - its weapon `w`, swing `sw`, a bow's draw `at`): the
 * one formula, the striker's stub against `target` - in every host the neutral stand-in (duelStandIn; INT8 moved the roll
 * to the striker's machine) - with the striker's swing mods (a bow's shaft is the release's StrikeDown - playerWeapon.js
 * playerAttackOptions) and a backstab's chance when `backFacing` (no host's: no referee backstabs a player - BAL8).
 * `{ hit, dmg }`; nothing is taken from anyone here - the number is the referee's to clip.
 */
export function resolveDuelStrike(d, target, { rolls = Math.random, backFacing = false } = {}) {
  const { stub, weapon } = duelStub(d.a, d.w ?? null);
  const swing = SWING_MODS[d.sw ?? (d.by === 'arrow' ? 'StrikeDown' : '')] ?? { damage: 0, toHit: 0 };
  // TWO-HANDS (AUDIT, bible/05-Combat/Two-Hands.md): an OFF-HAND swing between players carries the off hand's terms, as
  // PlayerWeapon.resolveHit's does against a foe - its to-hit by the sheet's Agility, its share of the damage and its weight
  // AUDIT PISTOLET A1: and a pair's off-hand SHOT - a Pistolet's, the one ranged weapon a pair holds
  const off = (d.by === 'melee' || d.by === 'arrow') && d.off === true;
  const dmg = calculateAttackDamage(stub, target, {
    weapon, damageMod: swing.damage, toHitMod: swing.toHit + (off ? offHandToHit(stub.stats.agility) : 0),
    ...(off ? OFF_HAND_BLOW : {}),
    backstabChance: backFacing ? stub.skillOverrides[SKILLS.Backstabbing] : 0,
    weaponAnimTime: d.at ?? 0, rolls, say: null, onInflictPoison: null,
  });
  const n = Math.max(0, int(dmg));
  return { hit: n > 0, dmg: n };
}

/** The ground distance between two world-frame points (natives on x and z), in metres, and their height apart. */
const NATIVES_PER_M = 40;
const worldApart = (a, b) => ({ ground: Math.hypot(a[0] - b[0], a[2] - b[2]) / NATIVES_PER_M, up: Math.abs(a[1] - b[1]) });

/**
 * IS THE BLOW WHERE IT CLAIMS TO BE? The striker's claimed feet (`p`, world frame) must stand near where this machine
 * sees the striker (`seen` - their eased pose; null: not placed, refused) and, for a swing, within a weapon's reach of
 * my own feet (`mine`) with the slack a trailing pose needs; a shaft or a spell within the ring's width. The DEFENDER
 * decides whether a blow could have reached it - a crafted frame from across the ring lands nothing.
 */
export function duelBlowPlausible(d, mine, seen, ringRadius) {
  // `mine`: my feet now, or AUDIT DUEL1 B6's trail - my feet over the last DUEL_TRAIL_MS, now last; a swing reaches if it
  // reached any of them
  const mines = Array.isArray(mine?.[0]) ? mine.filter((m) => Array.isArray(m)) : [mine];
  if (!Array.isArray(d?.p) || !Array.isArray(mines.at(-1)) || !Array.isArray(seen)) return false;
  const melee = d.k === 'strike' && d.by === 'melee';
  const claim = worldApart(d.p, seen);
  const slack = melee ? DUEL_MELEE_POS_SLACK_M : DUEL_POS_SLACK_M;
  if (claim.ground > slack || claim.up > DUEL_POS_SLACK_M) return false;
  if (melee) return mines.some((m) => { const me = worldApart(d.p, m); return me.ground <= WEAPON_REACH + DUEL_MELEE_SLACK_M && me.up <= 3; });
  return worldApart(d.p, mines.at(-1)).ground <= 2 * ringRadius + DUEL_POS_SLACK_M;
}

/** AUDIT DUEL1 A2: the damage a result may wear MY weapon by - the defender's word, never past what this weapon could
 *  honestly have dealt (DUEL_WEAR_MULT). */
export function duelWearDamage(dmg, weapon, attacker) {
  const d = Number.isFinite(dmg) && dmg > 0 ? Math.trunc(dmg) : 0;
  if (!weapon || !d) return 0;
  const top = weaponDamageMods(weapon, baseDamageMax(weapon)) + damageModifier(liveStat(attacker, 'strength'))
    + (WEAPON_MATERIAL_MODIFIER[weapon.material] ?? 0);
  return Math.min(d, Math.max(1, top) * DUEL_WEAR_MULT);
}

/** A spell's duel half: its effects of the DUEL_SPELL_TYPES families, or null when it has none (then it is no blow -
 *  a beneficial spell is ALLY-CAST's, and the rest stays home). */
export function duelSpellOf(spell) {
  const fx = (Array.isArray(spell?.effects) ? spell.effects : []).filter((e) => e && Number.isInteger(e.type) && DUEL_SPELL_TYPES.has(e.type)).slice(0, CAST_EFFECTS_MAX);
  if (!fx.length) return null;
  return {
    name: String(spell?.name ?? ''),
    element: Number.isInteger(spell?.element) ? spell.element : 4,
    rangeType: spell?.rangeType >= 1 && spell.rangeType <= 4 ? spell.rangeType : 1,
    icon: Number.isInteger(spell?.icon) && spell.icon >= 0 ? spell.icon : 0,
    effects: fx,
  };
}

/** The record the DEFENDER applies: the wire's projection of what arrived, reduced to the duel's families, at the range
 *  it reached me by (so the save is rolled: DFU save-scales every bundle that is not CasterOnly). Null when nothing is
 *  left - a crafted spell of anything else lands nothing. */
export function duelSpellFromWire(sp) {
  if (!sp || !Array.isArray(sp.effects)) return null;
  const effects = sp.effects.filter((e) => e && DUEL_SPELL_TYPES.has(e.type)).slice(0, CAST_EFFECTS_MAX);
  if (!effects.length) return null;
  return { name: typeof sp.name === 'string' ? sp.name : '', element: sp.element ?? 4, rangeType: sp.rangeType >= 1 && sp.rangeType <= 4 ? sp.rangeType : 1, effects, icon: Number.isInteger(sp.icon) ? sp.icon : 0, index: -1, custom: true };
}

/** A swing's name as the wire says it (DUEL_SWINGS), or undefined for a state that is not one. */
export const duelSwingOf = (state) => (DUEL_SWINGS.includes(state) ? state : undefined);
