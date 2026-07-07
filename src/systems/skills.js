// The skills MODEL (extracted from chargen in the 2026-07-06d audit
// - entity-layer concepts, not creation logic; formulas, advancement,
// chargen, and the scenes all consume it from here).
export const SKILLS = Object.freeze({
  Medical: 0, Etiquette: 1, Streetwise: 2, Jumping: 3, Orcish: 4,
  Harpy: 5, Giantish: 6, Dragonish: 7, Nymph: 8, Daedric: 9,
  Spriggan: 10, Centaurian: 11, Impish: 12, Lockpicking: 13,
  Mercantile: 14, Pickpocket: 15, Stealth: 16, Swimming: 17,
  Climbing: 18, Backstabbing: 19, Dodging: 20, Running: 21,
  Destruction: 22, Restoration: 23, Illusion: 24, Alteration: 25,
  Thaumaturgy: 26, Mysticism: 27, ShortBlade: 28, LongBlade: 29,
  HandToHand: 30, Axe: 31, BluntWeapon: 32, Archery: 33,
  CriticalStrike: 34,
});
export const SKILL_COUNT = 35;
/** Display names, index-ordered (the enum inverted once). */
export const SKILL_NAMES = Object.freeze(Object.entries(SKILLS).reduce((a, [k, v]) => { a[v] = k; return a; }, new Array(SKILL_COUNT)));

/** DaggerfallUnityItem.GetWeaponSkillUsed -> skill id, by name. */
export const WEAPON_SKILL = Object.freeze({
  Dagger: SKILLS.ShortBlade, Tanto: SKILLS.ShortBlade, Wakazashi: SKILLS.ShortBlade, Shortsword: SKILLS.ShortBlade,
  Broadsword: SKILLS.LongBlade, Longsword: SKILLS.LongBlade, Saber: SKILLS.LongBlade,
  Katana: SKILLS.LongBlade, Claymore: SKILLS.LongBlade, 'Dai-Katana': SKILLS.LongBlade,
  'Battle Axe': SKILLS.Axe, 'War Axe': SKILLS.Axe,
  Staff: SKILLS.BluntWeapon, Mace: SKILLS.BluntWeapon, Flail: SKILLS.BluntWeapon, Warhammer: SKILLS.BluntWeapon,
  'Short Bow': SKILLS.Archery, 'Long Bow': SKILLS.Archery,
});

/** Skill read across both entity shapes: enemies carry the
 *  SetEnemyCareer FLAT number (every skill equal, verbatim); the
 *  player carries the rolled 35-array after chargen (and the flat
 *  interim before it). */
export function skillValue(entity, skillId) {
  const s = entity.skills;
  if (typeof s === 'number') return s;
  return s?.[skillId] ?? 0;
}

/** TallySkill (the E3c flag clears): count a use toward advancement.
 *  The 20000 clamp is VERBATIM (PlayerEntity.TallySkill) - and it is
 *  what keeps the source's (uses * reflexesMod) >> 16 inside int32:
 *  20000 * 0x14000 fits; an unclamped tally would overflow the shift
 *  in C# and JS alike (caught by S3b's own test). */
export function tallySkill(entity, skillId, amount = 1) {
  if (!entity.skillUses) return;
  entity.skillUses[skillId] += amount;
  if (entity.skillUses[skillId] > 20000) entity.skillUses[skillId] = 20000;
}
