// MW-SPELLFX1 (2026-10-07, Mac: "We need to implement morrowind spell casting effects and animations"): WHICH
// MORROWIND VISUALS A DAGGERFALL SPELL IS DRAWN WITH.
//
// Morrowind draws a spell with its magic effects' records (MGEF, components/esm3/loadmgef.cpp): each effect names a
// casting, a bolt, a hit and an area visual by id - a STAT (or a WEAP, for a bolt: projectilemanager.cpp makes the
// projectile from whatever record the id names) - a particle texture the effect's meshes wear (overrideFirstRootTexture)
// and a colour its bolt lights the world with. OpenMW's own defaults stand in where an effect names none
// (VFX_DefaultCast, VFX_DefaultBolt, VFX_DefaultHit, VFX_DefaultArea). Pure: data in, a plan out.
//
// THE RULES, member by member:
//   CastSpell::playSpellCastingEffects (spellcasting.cpp :431-504): one casting visual per EFFECT, a model already
//       added skipped, each wearing its own effect's particle texture
//   getMagicBoltData (projectilemanager.cpp :66-138): a bolt for the TARGET-range effects; the particle texture only
//       when there is ONE such effect - and then the FIRST effect of the whole list's (the reference's own reading);
//       getMagicBoltLightDiffuseColor: the light is the mean of the bolt effects' colours
//   playEffects (spellcasting.cpp :506-540): the hit visual of each effect that lands, its texture the effect's
//   CastSpell::explodeSpell (:41-108): an area visual per effect with an area, at area x 2 its own size
//   CharacterController (character.cpp :1593-1613): VFX_Hands on both hands, wearing the LAST effect's texture
//   MagicEffect::getColor (loadmgef.cpp :793-799): rgb / 255, inverted under NegativeLight
//
// THE MAPPING IS A DEPARTURE, AND ONLY A LOOK. Daggerfall's effects are not Morrowind's (a Daggerfall spell's harm is
// one effect wearing the spell's ELEMENT; Morrowind's fire is its own effect), so each Daggerfall effect is drawn as
// the Morrowind effect nearest it - a fire Damage Health as Fire Damage, a Heal Health as Restore Health, a Levitate as
// Levitate - and a family Morrowind has no word for as its school's plainest member. Nothing here touches what a spell
// DOES: that is Daggerfall's, unchanged.
//
// NOT CARRIED, recorded: VFX_Multiple<n> - a bolt of several effects is the reference's VFX_Multiple frame with every
// effect's bolt hung on its "Dummy0n" nodes; here it is the first effect's bolt alone.

import { SKILLS } from '../systems/skills.js';

/** Morrowind's magic effect indices (loadmgef.cpp sMagicEffectIds, in index order) - the ones the mapping names. */
export const MW_EFFECT = Object.freeze({
  WaterBreathing: 0, WaterWalking: 2, Shield: 3, Feather: 8, Jump: 9, Levitate: 10, SlowFall: 11, Lock: 12, Open: 13,
  FireDamage: 14, ShockDamage: 15, FrostDamage: 16, DrainAttribute: 17, DamageHealth: 23, DamageMagicka: 24,
  DamageFatigue: 25, Poison: 27, DisintegrateWeapon: 37, Invisibility: 39, Chameleon: 40, Light: 41, Charm: 44,
  Paralyze: 45, Silence: 46, Sound: 48, CalmHumanoid: 49, CalmCreature: 50, Dispel: 57, Soultrap: 58, Mark: 60, Recall: 61,
  DetectAnimal: 64, DetectEnchantment: 65, DetectKey: 66, SpellAbsorption: 67, Reflect: 68, CureCommonDisease: 69,
  CurePoison: 72, CureParalyzation: 73, RestoreAttribute: 74, RestoreHealth: 75, RestoreFatigue: 77,
  FortifyAttribute: 79, AbsorbAttribute: 85, AbsorbHealth: 86, AbsorbFatigue: 88, ResistFire: 90, ResistFrost: 91,
  ResistShock: 92, ResistMagicka: 93, ResistPoison: 97, ResistParalysis: 99, TurnUndead: 101, BoundDagger: 120,
});
const E = MW_EFFECT;

/** A Daggerfall element's harm in Morrowind - fire, cold, poison, shock, magic (DFU ElementTypes, the spell's
 *  `element`): Fire Damage, Frost Damage, Poison, Shock Damage, and plain Damage Health. */
export const ELEMENT_DAMAGE = Object.freeze([E.FireDamage, E.FrostDamage, E.Poison, E.ShockDamage, E.DamageHealth]);

/** The Daggerfall families whose look is the spell's ELEMENT where the element is not magic (Daggerfall's harm). */
const ELEMENTAL = new Set([1, 4, 5, 7, 11]);

/** Daggerfall's classic effect key (`type,subType`, spellcost.js's EFFECT_COST_TABLE) to the Morrowind effect it is
 *  drawn as. A family keyed `type,*` takes every subtype. */
const DF_TO_MW = Object.freeze({
  '0,*': E.Paralyze,
  '1,0': E.DamageHealth, '1,1': E.DamageFatigue, '1,2': E.DamageMagicka,   // continuous damage
  '2,*': E.BoundDagger,   // Create Item: a conjured thing
  '3,0': E.CureCommonDisease, '3,1': E.CurePoison, '3,2': E.CureParalyzation,
  '4,0': E.DamageHealth, '4,1': E.DamageFatigue, '4,2': E.DamageMagicka,
  '5,*': E.DisintegrateWeapon,
  '6,0': E.Dispel, '6,1': E.TurnUndead, '6,2': E.Dispel,
  '7,*': E.DrainAttribute,
  '8,0': E.ResistFire, '8,1': E.ResistFrost, '8,2': E.ResistPoison, '8,3': E.ResistShock, '8,4': E.ResistMagicka,
  '9,*': E.FortifyAttribute,
  '10,8': E.RestoreHealth, '10,9': E.RestoreFatigue, '10,*': E.RestoreAttribute,
  '11,8': E.AbsorbHealth, '11,9': E.AbsorbFatigue, '11,*': E.AbsorbAttribute,   // Transfer
  '12,*': E.Soultrap, '13,*': E.Invisibility, '14,*': E.Levitate, '15,*': E.Light, '16,*': E.Lock, '17,*': E.Open,
  '18,*': E.RestoreHealth,   // Regenerate
  '19,*': E.Silence, '20,*': E.SpellAbsorption, '21,*': E.Reflect, '22,*': E.ResistMagicka,
  '23,*': E.Chameleon, '24,*': E.Chameleon,   // Chameleon, Shadow
  '25,*': E.SlowFall, '26,*': E.ResistParalysis, '27,*': E.Jump, '28,*': E.Feather,   // Slowfall, Free Action, Jumping, Climbing
  '30,*': E.WaterBreathing, '31,*': E.WaterWalking,
  '33,2': E.CalmHumanoid, '33,*': E.CalmCreature,   // Pacify
  '34,*': E.Charm, '35,*': E.Shield,
  '39,0': E.DetectEnchantment, '39,1': E.DetectAnimal, '39,2': E.DetectKey,
  '40,*': E.DetectEnchantment,   // Identify
  '43,*': E.Recall,   // Teleport
  '44,*': E.Sound,   // Comprehend Languages
  '45,*': E.RestoreHealth,   // RESURRECT1: the port's own Resurrect
  '46,*': E.Mark,   // PARTY-MAP: the port's own Shared Cartography
});

/** A family the table has no row for: its school's plainest member, by Daggerfall's skill (skills.js SKILLS) -
 *  Destruction's harm, Restoration's heal, Illusion's light, Alteration's shield, Thaumaturgy's and Mysticism's
 *  dispel. */
const SCHOOL_FALLBACK = Object.freeze({
  [SKILLS.Destruction]: E.DamageHealth, [SKILLS.Restoration]: E.RestoreHealth, [SKILLS.Illusion]: E.Light,
  [SKILLS.Alteration]: E.Shield, [SKILLS.Thaumaturgy]: E.Dispel, [SKILLS.Mysticism]: E.Dispel,
});

/** The Morrowind effect a Daggerfall effect is drawn as - `school` the effect's Daggerfall skill, for a family the table
 *  does not name (spellcost.js effectSchool). Elemental harm takes the element unless it is magic. */
export function mwEffectOf(effect, element = 4, school = SKILLS.Destruction) {
  const type = effect?.type | 0;
  const sub = (effect?.subType ?? 255) & 0xff;
  if (ELEMENTAL.has(type) && Number.isInteger(element) && element >= 0 && element <= 3) return ELEMENT_DAMAGE[element];
  return DF_TO_MW[`${type},${sub}`] ?? DF_TO_MW[`${type},*`] ?? SCHOOL_FALLBACK[school] ?? E.DamageHealth;
}

/** The spell's effects as Morrowind effects, in its own order. A spell that carries no effects - another player's cast,
 *  which the wire sends as an element - is its element's harm. */
export function mwEffectsOfSpell(sp, schoolOf = () => SKILLS.Destruction) {
  const element = Number.isInteger(sp?.element) && sp.element >= 0 && sp.element <= 4 ? sp.element : 4;
  const list = (sp?.effects ?? []).filter(Boolean);
  if (!list.length) return [ELEMENT_DAMAGE[element]];
  return list.map((e) => mwEffectOf(e, element, schoolOf(e)));
}

/** OpenMW's own stand-ins where an effect names no visual, and the hands' glow (ids, lowercased as the store keys them). */
export const VFX_DEFAULT = Object.freeze({ cast: 'vfx_defaultcast', bolt: 'vfx_defaultbolt', hit: 'vfx_defaulthit', area: 'vfx_defaultarea', hands: 'vfx_hands' });
/** MGEF flags (loadmgef.hpp): NegativeLight inverts the colour; ContinuousVfx loops the hit visual. */
export const MGEF_FLAG = Object.freeze({ ContinuousVfx: 0x20, NegativeLight: 0x800 });

/** MagicEffect::getColor's rgb: the record's bytes over 255, inverted under NegativeLight. */
export function mgefColour(mgef) {
  const c = (mgef?.color ?? [255, 255, 255]).map((v) => v / 255);
  return (mgef?.flags ?? 0) & MGEF_FLAG.NegativeLight ? c.map((v) => 1 - v) : c;
}

/** A Daggerfall area's radius (metres) as Morrowind's area (feet) - the reference spawns its area visual at twice
 *  that (explodeSpell :80-81). 21.33 units to the foot (Constants::UnitsPerFoot), `unitsPerMetre` to the metre. */
export const MW_UNITS_PER_FOOT = 64 / 3;
export const areaVisualScale = (radiusMetres, unitsPerMetre) => 2 * (radiusMetres * unitsPerMetre) / MW_UNITS_PER_FOOT;

/** Animation::addEffect's sizing for an actor that is not a person (animation.cpp :1742-1757): a body `height` tall and
 *  `radius` round (metres) is max(x, y, z / 2) / 64 of its bounds in Morrowind units, applied as a scale only when it
 *  passes 1, and the effect is lifted - or sunk - off a 128-unit body by `offset` units, times that ratio as the
 *  reference sets it. A person's effect is neither (`isNpc`); a flier's lift is not carried. */
export function actorFxTransform(height, radius, unitsPerMetre) {
  const z = height * unitsPerMetre, xy = 2 * radius * unitsPerMetre;
  const ratio = Math.max(xy, xy, z / 2) / 64;
  let offset = 0;
  if (z < 128) offset = z - 128;
  else if (z < xy + xy) offset = 128 - z;
  return { scale: ratio > 1 ? ratio : 1, offset: offset * ratio };
}

/**
 * THE PLAN for one spell: `{ cast, bolt, hit, area, hands }` - each visual a `{ id, model, texture }` (`model` the
 * archive path), `bolt` with its `colour`, `hands` VFX_Hands. `mgefs` maps a Morrowind effect index to its record
 * (formats/mwFirstPerson.js readMagicEffect); `modelOf(id)` answers a visual id's mesh path or null. A visual whose id
 * resolves to no mesh is left out - the reference would refuse the whole cast; a look is not worth that.
 */
export function spellFxPlan(sp, mgefs, modelOf, { schoolOf } = {}) {
  const ids = mwEffectsOfSpell(sp, schoolOf);
  const effects = ids.map((i) => mgefs?.get?.(i) ?? null);
  const visual = (mgef, slot) => {
    const id = (mgef?.[slot === 'cast' ? 'casting' : slot] || VFX_DEFAULT[slot]).toLowerCase();
    const model = modelOf(id);
    return model ? { id, model, texture: mgef?.particle || null } : null;
  };
  const unique = (list) => {
    const seen = new Set();
    return list.filter((v) => { if (!v) return false; const k = `${v.model}|${v.texture ?? ''}`; if (seen.has(k)) return false; seen.add(k); return true; });
  };
  const ranged = sp?.rangeType === 2 || sp?.rangeType === 4;
  let bolt = null;
  if (ranged) {
    const first = visual(effects[0], 'bolt');
    if (first) {
      const colours = effects.map(mgefColour);
      bolt = {
        ...first,
        texture: effects.length === 1 ? effects[0]?.particle || null : null,   // one projectile effect: the first effect's texture
        colour: [0, 1, 2].map((k) => colours.reduce((a, c) => a + c[k], 0) / colours.length),
      };
    }
  }
  const last = effects[effects.length - 1];
  const handsModel = modelOf(VFX_DEFAULT.hands);
  return {
    effects: ids,
    // the casting visuals: one per model (playSpellCastingEffects' `addedEffects`)
    cast: effects.map((m) => visual(m, 'cast')).filter((v, i, all) => v && all.findIndex((w) => w && w.model === v.model) === i),
    bolt,
    hit: unique(effects.map((m) => visual(m, 'hit'))),
    area: unique(effects.map((m) => visual(m, 'area'))),
    hands: handsModel ? { id: VFX_DEFAULT.hands, model: handsModel, texture: last?.particle || null } : null,
  };
}

/** The bolt's attitude in the Morrowind world (projectilemanager.cpp launchMagicBolt): the caster's pitch about -X,
 *  then its yaw about -Z, so the mesh's +Y runs along `dir` (a Morrowind-world direction). Column-vector 3x3. */
export function boltAttitude(dir) {
  const l = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  const d = [dir[0] / l, dir[1] / l, dir[2] / l];
  const yaw = Math.atan2(d[0], d[1]);
  const pitch = -Math.asin(Math.max(-1, Math.min(1, d[2])));
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  // Rz(-yaw) * Rx(-pitch)
  const rz = [cy, sy, 0, -sy, cy, 0, 0, 0, 1];
  const rx = [1, 0, 0, 0, cp, sp, 0, -sp, cp];
  const o = new Float32Array(9);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = rz[r * 3] * rx[c] + rz[r * 3 + 1] * rx[3 + c] + rz[r * 3 + 2] * rx[6 + c];
  return o;
}

/** RotateCallback (projectilemanager.cpp :194-216): the bolt spins about its own -Y at a turn a second, on the
 *  simulation clock. Column-vector 3x3 for `seconds`. */
export const BOLT_SPIN_PER_S = Math.PI * 2;
export function boltSpin(seconds) {
  const a = -seconds * BOLT_SPIN_PER_S;   // about -Y: Ry(-angle)
  const c = Math.cos(a), s = Math.sin(a);
  return Float32Array.from([c, 0, s, 0, 1, 0, -s, 0, c]);
}
