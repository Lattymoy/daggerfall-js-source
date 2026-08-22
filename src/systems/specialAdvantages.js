// U20b: the SPECIAL ADVANTAGES / DISADVANTAGES window
// (CreateCharSpecialAdvantageWindow.cs, MIT, Daggerfall Workshop -
// original author Numidium). The pure laws: the two primary lists,
// the secondary lists each primary opens, the three "only one of
// these" limits, the incompatible-pair rules, the 50-entry difficulty
// table, and ParseCareerData writing the picks onto a career.
//
// U20a shipped the builder with `difficultyPoints(hp, advantageAdjust,
// disadvantageAdjust)` and NOTHING ever passed the last two, so the
// whole advantage/disadvantage balance was inert: every custom class
// advanced at its HP-only rate. This module is what makes those terms
// real.
//
// THE STRINGS: DFU resolves these through TextManager from
// StreamingAssets/Text/.../Internal_Strings.csv, whose own header says
// it "stores text that was hard-coded in FALL.EXE" - so the display
// text below IS classic's, by way of DFU's recovery of it, and the
// keys are DFU's HardStrings members one for one.

// ---- the two primary lists (:64-90), in DFU's order ----
export const ADVANTAGE_KEYS = Object.freeze([
  'acuteHearing', 'adrenalineRush', 'athleticism', 'bonusToHit',
  'expertiseIn', 'immunity', 'increasedMagery', 'rapidHealing',
  'regenerateHealth', 'resistance', 'spellAbsorption',
]);
export const DISADVANTAGE_KEYS = Object.freeze([
  'criticalWeakness', 'damage', 'darknessPoweredMagery',
  'forbiddenArmorType', 'forbiddenMaterial', 'forbiddenShieldTypes',
  'forbiddenWeaponry', 'inabilityToRegen', 'lightPoweredMagery',
  'lowTolerance', 'phobia',
]);

// ---- the secondary lists (:91-178) ----
const ENEMY_TYPES = Object.freeze(['animals', 'daedra', 'humanoid', 'undead']);
const WEAPON_TYPES = Object.freeze(['axe', 'bluntWeapon', 'handToHand', 'longBlade', 'missileWeapon', 'shortBlade']);
const EFFECT_TYPES = Object.freeze(['toDisease', 'toFire', 'toFrost', 'toMagic', 'toParalysis', 'toPoison', 'toShock']);
const INCREASED_MAGERY = Object.freeze(['intInSpellPoints15', 'intInSpellPoints175', 'intInSpellPoints2', 'intInSpellPoints3', 'intInSpellPoints']);
const EFFECT_ENV = Object.freeze(['general', 'inDarkness', 'inLight']);
const REGEN_HEALTH = Object.freeze(['general', 'inDarkness', 'inLight', 'whileImmersed']);
const DAMAGE_ENV = Object.freeze(['fromHolyPlaces', 'fromSunlight']);
const DARKNESS_POWERED = Object.freeze(['lowerMagicAbilityDaylight', 'unableToUseMagicInDaylight']);
const LIGHT_POWERED = Object.freeze(['lowerMagicAbilityDarkness', 'unableToUseMagicInDarkness']);
const ARMOR_TYPES = Object.freeze(['chain', 'leather', 'plate']);
const MATERIALS = Object.freeze(['adamantium', 'daedric', 'dwarven', 'ebony', 'elven', 'iron', 'mithril', 'orcish', 'silver', 'steel']);
const SHIELD_TYPES = Object.freeze(['buckler', 'kiteShield', 'roundShield', 'towerShield']);

/** PrimaryPicker_OnItemPicked's switch (:325-389). null means the pick
 *  lands with no secondary window at all. */
export function secondaryListFor(primaryKey) {
  switch (primaryKey) {
    case 'bonusToHit': case 'phobia': return ENEMY_TYPES;
    case 'expertiseIn': case 'forbiddenWeaponry': return WEAPON_TYPES;
    case 'immunity': case 'resistance': case 'criticalWeakness': case 'lowTolerance': return EFFECT_TYPES;
    case 'increasedMagery': return INCREASED_MAGERY;
    case 'rapidHealing': case 'spellAbsorption': return EFFECT_ENV;
    case 'regenerateHealth': return REGEN_HEALTH;
    case 'damage': return DAMAGE_ENV;
    case 'darknessPoweredMagery': return DARKNESS_POWERED;
    case 'lightPoweredMagery': return LIGHT_POWERED;
    case 'forbiddenArmorType': return ARMOR_TYPES;
    case 'forbiddenMaterial': return MATERIALS;
    case 'forbiddenShieldTypes': return SHIELD_TYPES;
    default: return null;
  }
}

/** The three primaries DFU limits to ONE per character - the loop that
 *  sets `alreadyAdded` before the secondary window opens (:340-346,
 *  :359-365, :378-384). Note the loop walks advDisList ONLY, not the
 *  other window's list, so this is per-window by construction. */
export const ONLY_ONE_KEYS = Object.freeze(['increasedMagery', 'darknessPoweredMagery', 'lightPoweredMagery']);

/** maxItems (:41) - the add button returns early at seven. */
export const MAX_ITEMS = 7;

// ---- the display text (Internal_Strings.csv; hard-coded in
// FALL.EXE originally, which is why it is not in TEXT.RSC) ----
export const LABELS = Object.freeze({
  acuteHearing: 'Acute Hearing', adrenalineRush: 'Adrenaline Rush', athleticism: 'Athleticism',
  bonusToHit: 'Bonus to hit', expertiseIn: 'Expertise in', immunity: 'Immunity',
  increasedMagery: 'Increased Magery', rapidHealing: 'Rapid Healing',
  regenerateHealth: 'Regenerate Health', resistance: 'Resistance', spellAbsorption: 'Spell Absorption',
  criticalWeakness: 'Critical Weakness', damage: 'Damage',
  darknessPoweredMagery: 'Darkness-Powered Magery', forbiddenArmorType: 'Forbidden Armor Type',
  forbiddenMaterial: 'Forbidden Material', forbiddenShieldTypes: 'Forbidden Shield Types',
  forbiddenWeaponry: 'Forbidden Weaponry', inabilityToRegen: 'Inability To Regen Spell Points',
  lightPoweredMagery: 'Light-Powered Magery', lowTolerance: 'Low Tolerance', phobia: 'Phobia',
  animals: 'Animals', daedra: 'Daedra', humanoid: 'Humanoid', undead: 'Undead',
  axe: 'Axe', bluntWeapon: 'Blunt Weapon', handToHand: 'Hand-to-Hand',
  longBlade: 'Long Blade', missileWeapon: 'Missile Weapon', shortBlade: 'Short Blade',
  toDisease: 'To Disease', toFire: 'To Fire', toFrost: 'To Frost', toMagic: 'To Magic',
  toParalysis: 'To Paralysis', toPoison: 'To Poison', toShock: 'To Shock',
  intInSpellPoints15: '1.5X INT In Spell Points', intInSpellPoints175: '1.75X INT In Spell Points',
  intInSpellPoints2: '2X INT In Spell Points', intInSpellPoints3: '3X INT In Spell Points',
  intInSpellPoints: 'INT In Spell Points',
  general: 'General', inDarkness: 'In Darkness', inLight: 'In Light',
  whileImmersed: 'While Immersed In Water',
  fromHolyPlaces: 'From Holy Places', fromSunlight: 'From Sunlight',
  lowerMagicAbilityDaylight: 'Lower Magic Ability In Daylight',
  unableToUseMagicInDaylight: 'Unable To Use Magic In Daylight',
  lowerMagicAbilityDarkness: 'Lower Magic Ability In Darkness',
  unableToUseMagicInDarkness: 'Unable To Use Magic In Darkness',
  chain: 'Chain', leather: 'Leather', plate: 'Plate',
  adamantium: 'Adamantium', daedric: 'Daedric', dwarven: 'Dwarven', ebony: 'Ebony',
  elven: 'Elven', iron: 'Iron', mithril: 'Mithril', orcish: 'Orcish',
  silver: 'Silver', steel: 'Steel',
  buckler: 'Buckler', kiteShield: 'Kite Shield', roundShield: 'Round Shield', towerShield: 'Tower Shield',
});
export const labelFor = (key) => LABELS[key] ?? '';

// ---- the difficulty table (InitializeAdjustmentDict, :1031-1085) ----
// 50 entries (AUDIT 23: an earlier reading recorded 53). Keyed
// `primary + secondary` except for the eight
// primaries whose secondary does not change the cost.
export const DIFFICULTY = Object.freeze({
  acuteHearing: 1, adrenalineRush: 4, athleticism: 4,
  bonusToHitanimals: 6, bonusToHitdaedra: 3, bonusToHithumanoid: 6, bonusToHitundead: 6,
  expertiseIn: 2, immunity: 10,
  increasedMageryintInSpellPoints: 2, increasedMageryintInSpellPoints15: 4,
  increasedMageryintInSpellPoints175: 6, increasedMageryintInSpellPoints2: 8,
  increasedMageryintInSpellPoints3: 10,
  rapidHealinggeneral: 4, rapidHealinginDarkness: 3, rapidHealinginLight: 2,
  regenerateHealthgeneral: 14, regenerateHealthinDarkness: 10,
  regenerateHealthinLight: 6, regenerateHealthwhileImmersed: 2,
  resistance: 5,
  spellAbsorptiongeneral: 14, spellAbsorptioninDarkness: 12, spellAbsorptioninLight: 8,
  criticalWeakness: -14,
  damagefromHolyPlaces: -6, damagefromSunlight: -10,
  darknessPoweredMagerylowerMagicAbilityDaylight: -7,
  darknessPoweredMageryunableToUseMagicInDaylight: -10,
  forbiddenArmorTypechain: -2, forbiddenArmorTypeleather: -1, forbiddenArmorTypeplate: -5,
  forbiddenMaterialadamantium: -5, forbiddenMaterialdaedric: -2, forbiddenMaterialdwarven: -7,
  forbiddenMaterialebony: -5, forbiddenMaterialelven: -9, forbiddenMaterialiron: -1,
  forbiddenMaterialmithril: -6, forbiddenMaterialorcish: -3, forbiddenMaterialsilver: -6,
  forbiddenMaterialsteel: -10,
  forbiddenShieldTypes: -1, forbiddenWeaponry: -2, inabilityToRegen: -14,
  lightPoweredMagerylowerMagicAbilityDarkness: -10,
  lightPoweredMageryunableToUseMagicInDarkness: -14,
  lowTolerance: -5, phobia: -4,
});

/** GetAdvDisAdjustment (:479-497): eight primaries ignore their
 *  secondary entirely; the rest key on the CONCATENATION. */
const SECONDARY_BLIND = Object.freeze(new Set([
  'expertiseIn', 'immunity', 'resistance', 'criticalWeakness',
  'forbiddenShieldTypes', 'forbiddenWeaponry', 'lowTolerance', 'phobia',
]));
export function advDisAdjustment(primary, secondary = '') {
  return DIFFICULTY[SECONDARY_BLIND.has(primary) ? primary : primary + secondary] ?? 0;
}

/** UpdateDifficultyAdjustment (:534-552) - the window's own total,
 *  handed to the builder as advantageAdjust / disadvantageAdjust. */
export const totalAdjust = (list) => list.reduce((a, s) => a + (s.difficulty ?? 0), 0);

/** IsMatchingAdvPair (:588-598): the pair matches only when the two
 *  primaries are the named pair in either order AND the SECONDARIES
 *  are equal - so Immunity To Fire blocks Resistance To Fire but not
 *  Resistance To Frost. */
function isMatchingAdvPair(str1, str2, candidate, incumbent) {
  return ((candidate.primary === str1 && incumbent.primary === str2)
       || (candidate.primary === str2 && incumbent.primary === str1))
      && candidate.secondary === incumbent.secondary;
}
const EXCLUSIVE_PAIRS = Object.freeze([
  ['bonusToHit', 'phobia'],
  ['expertiseIn', 'forbiddenWeaponry'],
  // no immunity, resistance, low tolerance or critical weakness may co-exist
  ['immunity', 'resistance'], ['immunity', 'criticalWeakness'], ['immunity', 'lowTolerance'],
  ['resistance', 'lowTolerance'], ['resistance', 'criticalWeakness'],
  ['lowTolerance', 'criticalWeakness'],
]);

/** CannotAddAdvantage (:554-586). Walks BOTH windows' lists - the
 *  advantages window is handed the disadvantages list as `otherList`
 *  and vice versa - rejecting an exact duplicate or an incompatible
 *  pair. */
export function cannotAdd(candidate, advDisList, otherList = []) {
  for (const incumbent of [...advDisList, ...otherList]) {
    if (candidate.primary === incumbent.primary && candidate.secondary === incumbent.secondary) return true;
    for (const [a, b] of EXCLUSIVE_PAIRS) if (isMatchingAdvPair(a, b, candidate, incumbent)) return true;
  }
  return false;
}

// ---- ParseCareerData (:953-1029), written onto the port's RAW
// CLASS.CFG career shape rather than DFU's decoded properties ----

/** DFCareer.EffectFlags (:398-412). */
export const EFFECT_BITS = Object.freeze({
  toParalysis: 1, toMagic: 2, toPoison: 4, toFire: 8, toFrost: 16, toShock: 32, toDisease: 64,
});
/** DFCareer.ProficiencyFlags (:313-322). */
export const PROFICIENCY_BITS = Object.freeze({
  shortBlade: 1, longBlade: 2, handToHand: 4, axe: 8, bluntWeapon: 16, missileWeapon: 32,
});
/** DFCareer.ArmorFlags (:302-308) and ShieldFlags (:290-296). */
export const ARMOR_BITS = Object.freeze({ leather: 1, chain: 2, plate: 4 });
export const SHIELD_BITS = Object.freeze({ buckler: 1, roundShield: 2, kiteShield: 4, towerShield: 8 });
/** DFCareer.MaterialFlags (:272-284). */
export const MATERIAL_BITS = Object.freeze({
  iron: 1, steel: 2, silver: 4, elven: 8, dwarven: 16,
  mithril: 32, adamantium: 64, ebony: 128, orcish: 256, daedric: 512,
});
/** DFCareer.SpecialAbilityFlags (:415-424) - the LOW byte of
 *  abilityFlagsAndSpellPointsBitfield. */
export const SPECIAL_ABILITY_BITS = Object.freeze({
  acuteHearing: 1, athleticism: 2, adrenalineRush: 4,
  noRegenSpellPoints: 8, sunDamage: 16, holyDamage: 32,
});
/** SpellAbsorptionFlags (:361-368) and RegenerationFlags (:373-381)
 *  and RapidHealingFlags (:386-393) - whole bytes of their own. */
export const ABSORPTION_FLAGS = Object.freeze({ general: 4, inDarkness: 2, inLight: 1 });
export const REGENERATION_FLAGS = Object.freeze({ general: 8, inDarkness: 2, inLight: 1, whileImmersed: 4 });
export const RAPID_HEALING_FLAGS = Object.freeze({ general: 4, inDarkness: 2, inLight: 1 });
/** The attack-modifier byte's [bonus, phobia] bit per enemy group -
 *  the same table combat/formulas.js reads (GROUP_BITS). */
const ATTACK_BITS = Object.freeze({ undead: [0x01, 0x10], daedra: [0x02, 0x20], humanoid: [0x04, 0x40], animals: [0x08, 0x80] });
/** SpellPointMultipliers, at (bitfield & 0x1C00) >> 8 (DFCareer:782).
 *  DFU's SetMagery writes the enum AND its float; the port's career
 *  carries only the bitfield, and systems/chargen.js decodes it. */
const MAGERY_MULT_BITS = Object.freeze({
  intInSpellPoints: 16, intInSpellPoints15: 12, intInSpellPoints175: 8,
  intInSpellPoints2: 4, intInSpellPoints3: 0,
});
/** The default the builder starts from and the label click restores
 *  (defaultSpellPointMod, :45; AdvantageLabel_OnMouseClick :448-452). */
export const DEFAULT_MAGERY_BITS = 20;   // Times_0_50

const setAbility = (career, bit) => { career.abilityFlagsAndSpellPointsBitfield |= bit; };

/** ParseCareerData: fold a finished pick list onto a career, in place.
 *  Every arm is DFU's Set* helper written against the CFG bitfields
 *  the port's ClassFile mints (TEST THE SHAPE THE PRODUCER MINTS). */
export function parseCareerData(career, list) {
  for (const { primary, secondary } of list) {
    switch (primary) {
      // SetAttackModifier (:598-620)
      case 'bonusToHit': career.attackModifierFlags |= ATTACK_BITS[secondary]?.[0] ?? 0; break;
      case 'phobia': career.attackModifierFlags |= ATTACK_BITS[secondary]?.[1] ?? 0; break;
      // SetProficiency (:622-700) - the port's bitfield packs the
      // FORBIDDEN set at bits 0..5 and the EXPERT set at 16..21
      case 'expertiseIn':
        career.weaponArmorShieldsBitfield |= (PROFICIENCY_BITS[secondary] ?? 0) << 16; break;
      case 'forbiddenWeaponry':
        career.weaponArmorShieldsBitfield |= PROFICIENCY_BITS[secondary] ?? 0; break;
      // SetTolerance (:714-745) - four separate EffectFlags bytes
      case 'immunity': career.immunityFlags |= EFFECT_BITS[secondary] ?? 0; break;
      case 'resistance': career.resistanceFlags |= EFFECT_BITS[secondary] ?? 0; break;
      case 'criticalWeakness': career.criticalWeaknessFlags |= EFFECT_BITS[secondary] ?? 0; break;
      case 'lowTolerance': career.lowToleranceFlags |= EFFECT_BITS[secondary] ?? 0; break;
      // SetMagery (:747-775) - the multiplier REPLACES, it does not or
      case 'increasedMagery': {
        const bits = MAGERY_MULT_BITS[secondary];
        if (bits != null) {
          career.abilityFlagsAndSpellPointsBitfield =
            (career.abilityFlagsAndSpellPointsBitfield & ~0x1C00) | (bits << 8);
        }
        break;
      }
      case 'rapidHealing': career.rapidHealing = RAPID_HEALING_FLAGS[secondary] ?? 0; break;
      case 'spellAbsorption': career.spellAbsorptionFlags = ABSORPTION_FLAGS[secondary] ?? 0; break;
      case 'regenerateHealth': career.regeneration = REGENERATION_FLAGS[secondary] ?? 0; break;
      // SetDamage (:938-951) - the two SpecialAbility bits
      case 'damage':
        setAbility(career, secondary === 'fromSunlight' ? SPECIAL_ABILITY_BITS.sunDamage : SPECIAL_ABILITY_BITS.holyDamage);
        break;
      // SetDarknessMagery (:830-845) at bits 8-9, SetLightMagery
      // (:923-936) at bits 6-7 (DFCareer:619-620)
      case 'darknessPoweredMagery': {
        const v = secondary === 'unableToUseMagicInDaylight' ? 1 : 2;
        career.abilityFlagsAndSpellPointsBitfield =
          (career.abilityFlagsAndSpellPointsBitfield & ~0x300) | (v << 8);
        break;
      }
      case 'lightPoweredMagery': {
        const v = secondary === 'unableToUseMagicInDarkness' ? 1 : 2;
        career.abilityFlagsAndSpellPointsBitfield =
          (career.abilityFlagsAndSpellPointsBitfield & ~0x00C0) | (v << 6);
        break;
      }
      case 'forbiddenArmorType':
        career.weaponArmorShieldsBitfield |= (ARMOR_BITS[secondary] ?? 0) << 6; break;
      case 'forbiddenShieldTypes':
        career.weaponArmorShieldsBitfield |= (SHIELD_BITS[secondary] ?? 0) << 9; break;
      case 'forbiddenMaterial':
        career.forbiddenMaterialsFlags |= MATERIAL_BITS[secondary] ?? 0; break;
      case 'inabilityToRegen': setAbility(career, SPECIAL_ABILITY_BITS.noRegenSpellPoints); break;
      case 'acuteHearing': setAbility(career, SPECIAL_ABILITY_BITS.acuteHearing); break;
      case 'athleticism': setAbility(career, SPECIAL_ABILITY_BITS.athleticism); break;
      case 'adrenalineRush': setAbility(career, SPECIAL_ABILITY_BITS.adrenalineRush); break;
      default: break;
    }
  }
  // the packed fields are u32/u16/u8 in the file; keep them unsigned
  career.weaponArmorShieldsBitfield >>>= 0;
  career.abilityFlagsAndSpellPointsBitfield >>>= 0;
  return career;
}

// ---- the label block (UpdateLabels, :498-532) ----
/** maxLabels (:42), labelSpacing (:43), tandemLabelSpacing (:44) and
 *  the block's origin (:262). */
export const LABEL_ORIGIN = Object.freeze([8, 35]);
export const LABEL_SPACING = 8;
export const TANDEM_SPACING = 6;
// AUDIT 24 ui: labelSpacing (8) and tandemLabelSpacing (6) are ROW
// PITCHES, not label heights. The removal handler hangs off each
// TextLabel (CreateCharSpecialAdvantageWindow.cs:264), so the clickable
// band is the label's own Rectangle - TextLabel.cs:543/588 size it at
// font.GlyphHeight, and DaggerfallUI.SmallFont is FONT0002, whose
// FixedHeight is 5. A click in the 1px gap below a row hits nothing in
// DFU; the port was removing the advantage.
export const LABEL_HIT_HEIGHT = 5;
export const MAX_LABELS = MAX_ITEMS * 2;

/** DFU rebuilds the whole label block on every change: each item's
 *  PRIMARY takes the next free label, its SECONDARY is squished to
 *  +6 beneath it, and every later label resumes the normal +8 step.
 *  Returned as rows so the draw and the click test read ONE layout -
 *  a label click removes the item whose Tag it carries (:436-460). */
export function labelRows(list) {
  const rows = [];
  let y = LABEL_ORIGIN[1];
  for (let i = 0; i < list.length && rows.length < MAX_LABELS; i++) {
    const { primary, secondary } = list[i];
    rows.push({ text: labelFor(primary), y, index: i });
    if (secondary) {
      y += TANDEM_SPACING;
      rows.push({ text: labelFor(secondary), y, index: i });
    }
    y += LABEL_SPACING;
  }
  return rows;
}
