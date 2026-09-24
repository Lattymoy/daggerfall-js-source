// @ts-check
// DUEL1 (2026-09-24, Mac: duels "traps both players" in a ring, and asked - "Yes: weapons, bows, spells"): THE BLOW
// BETWEEN TWO DUELLISTS, BOTH HALVES. Pure over the game's own formula - no scene, no socket - so the pins drive a
// strike from one sheet to another without a browser.
//
// DEFENDER-AUTHORITATIVE, the port's law for any blow at a body (scenes/dungeonContext.js "the host decided the swing;
// I decide the hit"; systems/onlineLane.js "a blow AT a body is mitigated where it lands"). Every input on the TARGET's
// side of CalculateAttackDamage - the armour on each part, the enchantment channels, Dodging, luck and agility, the
// biography's avoid-hit, the adrenaline rush, PCAAO's shield block and natural resistance - lives on the defender's
// machine and nowhere else, and the armour a blow wears is the defender's own save. So the ATTACKER sends what its
// sheet brings to the blow (duelAttackerOf: level, race, the eight live attributes, the four skills a blow reads, the
// career's bitfields, health; the weapon's template, material and condition - duelWeaponOf), never a number of
// damage; and the DEFENDER stands that sheet up as a stub attacker (duelStub) and runs the one formula
// (resolveDuelStrike) against itself. A crafted sheet is bounded by the wire (net/wire.js validDuelData) at what the
// strongest honest character holds.
//
// THE SPELL, the same way: the attacker sends the spell's HARMFUL effects (duelSpellOf - the families a fight is made
// of) and its level; the defender applies them as any caster's spell at it (duelSpellFromWire keeps those families
// alone and the range the spell reached it by, so the save it owes is rolled), tagged as the duel's (effects.js
// bundleDuel), so a duel's damage over time stops at the floor too, and the duel's end strips it.
//
// Not a DFU member: Daggerfall Unity has no other players. Ledger A (ONLINE).
import { calculateAttackDamage, baseDamageMax, damageModifier, WEAPON_MATERIAL_MODIFIER } from './formulas.js';
import { weaponDamageMods } from '../systems/entityMods.js';
import { SWING_MODS, WEAPON_REACH } from './playerWeapon.js';
import { createWeapon } from './enemyEquipment.js';
import { SKILLS, skillValue } from '../systems/skills.js';
import { liveStat } from '../systems/statMods.js';
import { STAT_KEYS_ORDER } from '../systems/chargen.js';
import { weaponSkillUsed } from '../characters/weapons.js';
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

/** THE ATTACKER'S SHEET, as the wire carries it (`a`), clamped at the wire's bounds so an honest frame is never refused. */
export function duelAttackerOf(entity, weapon = null) {
  const ws = skillForTemplate(weapon?.templateIndex);
  return {
    lv: clamp(entity?.level ?? 1, 1, DUEL_LEVEL_MAX),
    r: clamp(entity?.raceId ?? 0, 0, DUEL_RACE_MAX),
    st: STAT_KEYS_ORDER.map((k) => clamp(liveStat(entity, k), 0, DUEL_STAT_MAX)),
    sk: [ws, SKILLS.HandToHand, SKILLS.CriticalStrike, SKILLS.Backstabbing].map((id) => clamp(skillValue(entity, id), 0, DUEL_SKILL_MAX)),
    cf: [clamp(entity?.career?.attackModifierFlags ?? 0, 0, 255), u32(entity?.career?.weaponArmorShieldsBitfield), u32(entity?.career?.abilityFlagsAndSpellPointsBitfield)],
    h: [clamp(entity?.health ?? 0, 0, CARD_VITAL_MAX), clamp(entity?.maxHealth ?? 1, 1, CARD_VITAL_MAX)],
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

/** THE STUB the defender runs the formula with: the wire's sheet as an attacker entity the formula reads (a player -
 *  the player arm's proficiency and racial mods are the striker's - marked `peer` so the formula's HUD report stays
 *  quiet on the machine that was struck), and a FRESH weapon off the template at the condition the striker's has, so
 *  the wear the formula lands on the striker's weapon lands on nothing of the defender's. */
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
  };
  return { stub, weapon };
}

/**
 * THE DEFENDER'S RESOLUTION of one strike (`d`, validDuelData's projection): the formula, the stub against my own sheet,
 * with the striker's swing mods (a bow's shaft is the release's StrikeDown - playerWeapon.js playerAttackOptions) and a
 * backstab's chance when the striker stood behind me (`backFacing`, my own facing decides). `{ hit, dmg }`; nothing is
 * taken from anyone here - the host lands the damage through the one door, with the duel's floor.
 */
export function resolveDuelStrike(d, defender, { rolls = Math.random, backFacing = false } = {}) {
  const { stub, weapon } = duelStub(d.a, d.w ?? null);
  const swing = SWING_MODS[d.sw ?? (d.by === 'arrow' ? 'StrikeDown' : '')] ?? { damage: 0, toHit: 0 };
  const dmg = calculateAttackDamage(stub, defender, {
    weapon, damageMod: swing.damage, toHitMod: swing.toHit,
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
