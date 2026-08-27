// S1: THE SPELL MAKER's core - the record builder, the settings law
// and the purchase ladder, verbatim from DaggerfallSpellMakerWindow.cs
// + DaggerfallEffectSettingsEditorWindow.cs (MIT, Daggerfall
// Workshop). The COST math is not re-derived here: the port's
// calculateCastCost (systems/spellcost.js) already IS
// FormulaHelper.CalculateTotalEffectCosts - per-effect component
// costs, the target multiplier, the 5-point floor - so the maker
// prices a spell by building the record and asking that one home.
//
// THE STORAGE SUBSTITUTION (recorded). DFU stores a made spell as an
// EffectBundleSettings carrying effect KEYS ("Damage-Health") plus an
// EffectSettings struct each. The port's whole magic runtime - the
// cost table, the effect library, the cast engine, the spellbook -
// reads the CLASSIC SPELLS.STD record shape ({ effects[3] of
// (type, subType, duration/chance/magnitude fields), element,
// rangeType, name, icon, index }), so a made spell IS one of those
// records, minted in memory. That is the same information DFU's
// bundle carries (its own effects resolve back to classic keys), one
// representation earlier, and it means a made spell casts, prices,
// sorts and displays through the exact code paths a stock spell does.
//
// CUSTOM IDENTITY. Stock spells are keyed by their SPELLS.STD index
// (0..88) and the save envelope stores bare indexes. A made spell has
// no file index, so it takes a NEGATIVE one (-1, -2, ...) - unique,
// never colliding with the file, and still a plain number for every
// consumer that keys by index (the readied-spell round trip). The
// save envelope carries the whole record for these; see save.js.

import { calculateCastCost } from './spellcost.js';
import { MAGIC_ONLY_KEYS } from './effects.js';   // AUDIT 26 F181: the AllowedElements set, already read off the effect classes
import { goldAmount, deductGold } from './court.js';


/** AUDIT 26 F181 - THE ALLOWED TARGET AND ELEMENT SETS.
 *
 *  DaggerfallSpellMakerWindow gates both selections on what the
 *  CHOSEN effects permit. SetSpellTarget (:490-491) and
 *  SetSpellElement (:526-528) return early on a bit that is not in
 *  the allowed set, and UpdateAllowedButtons (:561-594) recomputes
 *  both sets on every slot change - by OPPOSITE rules:
 *
 *    allowedTargets  = TargetFlags_All;              (:574)
 *    allowedElements = ElementFlags_MagicOnly;       (:575)
 *    foreach chosen effect:
 *      allowedTargets  &= effect.AllowedTargets;     (:585) INTERSECTION
 *      allowedElements |= effect.AllowedElements;    (:588) UNION
 *
 *  So a caster-only effect narrows the targets to CasterOnly for the
 *  whole spell, while magic is ALWAYS offered as an element and each
 *  effect only ADDS to what is legal. With no effects chosen at all
 *  the window falls back to the default flags and forces
 *  CasterOnly + Magic (:564-570).
 *
 *  TargetTypes and ElementTypes are declared in the same order the
 *  window's rows cycle (MagicAndEffectsEnums.cs:21-29, :36-44), so a
 *  stored classic INDEX is its bit's position. */
export const TARGET_FLAGS = Object.freeze({
  CasterOnly: 1, ByTouch: 2, SingleTargetAtRange: 4, AreaAroundCaster: 8, AreaAtRange: 16,
});
export const ELEMENT_FLAGS = Object.freeze({ Fire: 1, Cold: 2, Poison: 4, Shock: 8, Magic: 16 });
/** EntityEffectBroker.cs:41-48. */
export const TARGET_FLAGS_ALL = 31;      // every bit
export const TARGET_FLAGS_SELF = 1;      // CasterOnly
export const TARGET_FLAGS_OTHER = 30;    // every bit BUT CasterOnly
export const ELEMENT_FLAGS_ALL = 31;
export const ELEMENT_FLAGS_MAGIC_ONLY = 16;
/** The window stores a classic index 0..4; the enums declare their
 *  bits in that same order. */
export const flagOfIndex = (i) => (1 << i);

/** The effects whose AllowedTargets is NOT TargetFlags_All, by
 *  classic (type, subType) key - read off every effect class under
 *  Game/MagicAndEffects/Effects, not inferred. The two variant
 *  classes build their keys in a loop: ElementalResistance is
 *  (8, 0..4) and is All, PacifyEffect is (33, 0..3) and is Other.
 *  Everything absent from both sets is TargetFlags_All. */
const SELF_TARGET_KEYS = new Set([
  '2,255', '6,0', '6,1', '6,2', '14,255', '15,255', '16,255', '17,255', '25,255',
  '29,255', '39,0', '39,1', '39,2', '40,255', '43,255', '44,255',
]);
const OTHER_TARGET_KEYS = new Set([
  '0,255', '1,0', '1,1', '1,2', '4,0', '4,1', '4,2', '5,255', '7,0',
  '7,1', '7,2', '7,3', '7,4', '7,5', '7,6', '7,7', '11,0', '11,1',
  '11,2', '11,3', '11,4', '11,5', '11,6', '11,7', '11,8', '11,9', '12,255',
  '33,0', '33,1', '33,2', '33,3', '34,255',
]);

export const allowedTargetsOf = (type, subType) => {
  const k = `${type},${subType}`;
  if (SELF_TARGET_KEYS.has(k)) return TARGET_FLAGS_SELF;
  if (OTHER_TARGET_KEYS.has(k)) return TARGET_FLAGS_OTHER;
  return TARGET_FLAGS_ALL;
};
/** The element half needs no second table: MAGIC_ONLY_KEYS already IS
 *  the set of effects whose AllowedElements is ElementFlags_MagicOnly,
 *  read off the same classes for the GetElementType law. The two
 *  derivations were cross-checked key for key and agree exactly. */
export const allowedElementsOf = (type, subType) =>
  (MAGIC_ONLY_KEYS.has(`${type},${subType}`) ? ELEMENT_FLAGS_MAGIC_ONLY : ELEMENT_FLAGS_ALL);

/** UpdateAllowedButtons, verbatim. `slots` is the window's three, of
 *  which any may be empty - DFU's own loop skips a slot with no key. */
export function updateAllowedButtons(slots) {
  const used = (slots ?? []).filter((sl) => sl && sl.type != null);
  // The default arm (:564-570) does NOT merely enforce: it CALLS
  // SetSpellTarget(CasterOnly) and SetSpellElement(Magic), so
  // deleting the last effect snaps a selection of, say, Area At
  // Range back to Caster Only even though the default target set
  // allows it. `forced` carries that distinction to the caller.
  if (used.length === 0) {
    return { targets: TARGET_FLAGS_ALL, elements: ELEMENT_FLAGS_MAGIC_ONLY, forced: true };
  }
  let targets = TARGET_FLAGS_ALL;
  let elements = ELEMENT_FLAGS_MAGIC_ONLY;
  for (const sl of used) {
    targets &= allowedTargetsOf(sl.type, sl.subType);
    elements |= allowedElementsOf(sl.type, sl.subType);
  }
  return { targets, elements, forced: false };
}
/** The two the default arm forces back to. */
export const DEFAULT_TARGET_INDEX = 0;    // TargetTypes.CasterOnly
export const DEFAULT_ELEMENT_INDEX = 4;   // ElementTypes.Magic

/** SelectFirstAllowedTargetType / SelectFirstAllowedElementType
 *  (:605-660): the FIRST set bit in declaration order, which for both
 *  is the lowest. DFU leaves the selection alone when nothing is
 *  allowed (every arm falls through); -1 says so. */
export const firstAllowedIndex = (flags) => {
  for (let i = 0; i < 5; i++) if (flags & flagOfIndex(i)) return i;
  return -1;
};

/** EnforceSelectedButtons (:595-603): only an ILLEGAL selection moves. */
export function enforceSelected(index, flags) {
  if (flags & flagOfIndex(index)) return index;
  const first = firstAllowedIndex(flags);
  return first === -1 ? index : first;
}

/** The window cycles one row where DFU has five buttons, so its
 *  translation of "SetSpell* returns early on a disallowed bit" is to
 *  step OVER the disallowed values: the player can no more land on
 *  one here than they can select one there. */
export function cycleAllowed(index, dir, flags) {
  if (!(flags & (flags - 1))) return firstAllowedIndex(flags) === -1 ? index : firstAllowedIndex(flags);
  let i = index;
  for (let n = 0; n < 5; n++) {
    i = (i + dir + 5) % 5;
    if (flags & flagOfIndex(i)) return i;
  }
  return index;
}

export const MAX_EFFECTS_PER_SPELL = 3;      // maxEffectsPerSpell (SpellMakerWindow:131)
export const DEFAULT_SPELL_ICON = 1;         // defaultSpellIcon (:132)
export const SPELL_ICON_COUNT = 69;          // SpellIconCollection.SpellIconCount
export const MAX_SPELL_NAME = 31;            // TextBox.MaxCharacters default

/** The spinner ranges, inclusive (EffectSettingsEditorWindow's
 *  SetRange calls). Every setting starts at its minimum of 1. */
export const SPINNER_RANGES = Object.freeze({
  durationBase: [1, 60], durationMod: [1, 60], durationPerLevel: [1, 20],
  chanceBase: [1, 100], chanceMod: [1, 100], chancePerLevel: [1, 20],
  magnitudeBaseLow: [1, 100], magnitudeBaseHigh: [1, 100],
  magnitudeLevelBase: [1, 100], magnitudeLevelHigh: [1, 100], magnitudePerLevel: [1, 20],
});

/** A fresh effect's settings: every spinner at 1 (the editor's own
 *  initial state - the ctor's 0 clamped up by SetRange). */
export function blankEffectSettings() {
  const s = {};
  for (const k of Object.keys(SPINNER_RANGES)) s[k] = 1;
  return s;
}

export const clampSetting = (field, v) => {
  const r = SPINNER_RANGES[field];
  if (!r) return v;
  return Math.max(r[0], Math.min(r[1], Math.trunc(v)));
};

/** THE PAIR RULE (the editor's magnitude min/max keepers): raising a
 *  minimum drags its maximum up, lowering a maximum drags its
 *  minimum down - independently for the BASE pair and the PLUS pair.
 *  Mutates and returns the settings. */
export function applyPairRules(settings, changed) {
  if (changed === 'magnitudeBaseLow' && settings.magnitudeBaseLow > settings.magnitudeBaseHigh) {
    settings.magnitudeBaseHigh = settings.magnitudeBaseLow;
  } else if (changed === 'magnitudeBaseHigh' && settings.magnitudeBaseHigh < settings.magnitudeBaseLow) {
    settings.magnitudeBaseLow = settings.magnitudeBaseHigh;
  } else if (changed === 'magnitudeLevelBase' && settings.magnitudeLevelBase > settings.magnitudeLevelHigh) {
    settings.magnitudeLevelHigh = settings.magnitudeLevelBase;
  } else if (changed === 'magnitudeLevelHigh' && settings.magnitudeLevelHigh < settings.magnitudeLevelBase) {
    settings.magnitudeLevelBase = settings.magnitudeLevelHigh;
  }
  return settings;
}

/** One spinner step (the editor's ±1 per click, clamped, then the
 *  pair rule). Answers the new settings object. */
export function stepSetting(settings, field, delta) {
  const next = { ...settings };
  next[field] = clampSetting(field, (next[field] ?? 1) + delta);
  return applyPairRules(next, field);
}

// ---- the record builder --------------------------------------------

let _nextCustomIndex = -1;
/** Mint the next custom index; a restore re-seeds this below the
 *  lowest loaded one so a session that loads then makes cannot
 *  collide with a spell the save already carried. */
export function mintCustomSpellIndex() { return _nextCustomIndex--; }
export function seedCustomSpellIndex(spells) {
  for (const sp of spells ?? []) {
    if (typeof sp?.index === 'number' && sp.index <= _nextCustomIndex) _nextCustomIndex = sp.index - 1;
  }
}
export function _resetCustomIndexForTests() { _nextCustomIndex = -1; }

/** An empty classic effect slot: type -1 is the file's own sentinel
 *  ("no effect"), which every consumer already skips. */
const emptyEffect = () => ({
  type: -1, subType: -1,
  durationBase: 0, durationMod: 0, durationPerLevel: 0,
  chanceBase: 0, chanceMod: 0, chancePerLevel: 0,
  magnitudeBaseLow: 0, magnitudeBaseHigh: 0, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 0,
});

/** Build the classic record. slots = up to 3 { type, subType,
 *  settings } (nulls and gaps allowed - they compact, as
 *  GetEffectEntries drops empty entries). The record is minted with a
 *  fresh negative index unless one is supplied (a save restore
 *  re-hydrating an existing custom spell). */
export function buildCustomSpell({ slots, rangeType = 0, element = 4, name = '', icon = DEFAULT_SPELL_ICON, index = null }) {
  const effects = [];
  for (const s of slots ?? []) {
    if (!s || s.type == null || s.type < 0) continue;
    const st = { ...blankEffectSettings(), ...(s.settings ?? {}) };
    effects.push({
      type: s.type, subType: s.subType ?? -1,
      durationBase: st.durationBase, durationMod: st.durationMod, durationPerLevel: st.durationPerLevel,
      chanceBase: st.chanceBase, chanceMod: st.chanceMod, chancePerLevel: st.chancePerLevel,
      magnitudeBaseLow: st.magnitudeBaseLow, magnitudeBaseHigh: st.magnitudeBaseHigh,
      magnitudeLevelBase: st.magnitudeLevelBase, magnitudeLevelHigh: st.magnitudeLevelHigh,
      magnitudePerLevel: st.magnitudePerLevel,
    });
    if (effects.length >= MAX_EFFECTS_PER_SPELL) break;
  }
  while (effects.length < MAX_EFFECTS_PER_SPELL) effects.push(emptyEffect());
  return {
    effects, element, rangeType, name,
    icon: ((icon % SPELL_ICON_COUNT) + SPELL_ICON_COUNT) % SPELL_ICON_COUNT,   // SetIcon's index % count
    cost: 0,   // the file's u16; nothing in the cast path reads it (the live formula prices every spell)
    index: index ?? mintCustomSpellIndex(),
    custom: true,
  };
}

/** The window's live totals: gold to buy, spell points to cast. One
 *  home - calculateCastCost applies the per-effect component costs,
 *  the caster's magic skills, the target multiplier and the floor. */
export function spellMakerCost(spell, entity) { return calculateCastCost(spell, entity); }

// ---- the purchase ladder -------------------------------------------

export const SPELLBOOK_TEMPLATE_INDEX = 132;   // MiscItems Spellbook (startingGear's own constant)
// The refusal texts, in DFU's order. The classic records are 1702-1705;
// the no-effects line is DFU's own string, not a classic record.
export const NO_SPELLBOOK_ID = 1703;
export const SPELLMAKER_NOT_ENOUGH_GOLD_ID = 1702;
export const MUST_CHOOSE_NAME_ID = 1704;
export const SPELL_INSCRIBED_ID = 1705;
export const NO_EFFECTS_TEXT = 'You must add at least one effect to this spell.';

const hasSpellbook = (entity) => (entity?.items ?? []).some(
  (it) => it.group === 'MiscItems' && it.templateIndex === SPELLBOOK_TEMPLATE_INDEX);

/**
 * BuyButton's validation ladder, in DFU's exact ORDER (:740-777):
 * spellbook, then effects, then gold, then the name - the name is
 * checked LAST on purpose ("only bother the player if everything
 * else is correct"). Answers { ok } or { ok:false, textId? , text? }.
 */
export function validateSpellPurchase({ entity, slots, goldCost, name }) {
  if (!hasSpellbook(entity)) return { ok: false, textId: NO_SPELLBOOK_ID };
  const used = (slots ?? []).filter((s) => s && s.type != null && s.type >= 0);
  if (!used.length) return { ok: false, text: NO_EFFECTS_TEXT };
  if (goldAmount(entity) < goldCost) return { ok: false, textId: SPELLMAKER_NOT_ENOUGH_GOLD_ID };
  if (!name || !String(name).trim()) return { ok: false, textId: MUST_CHOOSE_NAME_ID };
  return { ok: true };
}

/** Deduct, inscribe (PlayerEntity.AddSpell = a plain push onto the
 *  spellbook). The window resets for another spell rather than
 *  closing - DFU's own behavior. */
export function purchaseSpell(entity, spell, goldCost) {
  deductGold(entity, goldCost);
  entity.spells = entity.spells ?? [];
  entity.spells.push(spell);
  return spell;
}
