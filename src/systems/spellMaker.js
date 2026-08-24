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
import { goldAmount, deductGold } from './court.js';

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
