// @ts-check
// MACRO-3 (2026-09-22, the macro audit): %mpw - an item's POWERS, the
// line under "Item powers:" (TEXT.RSC 1016) in the classic inventory's
// info box. DaggerfallUnityItemMCP.MagicPowers (:262-373) is the source,
// and the port had none: the box printed "%mpw" under every enchanted
// item, because nothing ever walked the record and nothing could have
// answered it.
//
// THREE ARMS, DFU's order:
//   - an ARTIFACT reads its own description record, 8700 + its subtype;
//   - an UNIDENTIFIED item says "Powers unknown.";
//   - otherwise each legacy enchantment is one line: the power's name off
//     DFU's `itemPowers` list, a space, and its parameter off the list
//     that power's arm names.
//
// The lists are DFU's own English strings (Internal_Strings: itemPowers,
// extraSpellPtsTimes, ...) - this box's words, which are NOT always the
// enchantment picker's (the picker says "During Winter", the box says
// "during Winter"). The spell, creature and skill names are the ones the
// picker already carries (enchantmentCatalogue), which ARE the same
// strings DFU reads at those three arms.

import { ENCHANTMENT_TYPES as T } from '../formats/magicDef.js';
import { enchantmentParamName } from './enchantmentCatalogue.js';
import { SKILL_NAMES } from './skills.js';

/** Internal_Strings `itemPowers`, indexed by EnchantmentTypes. */
export const ITEM_POWERS = Object.freeze([
  'Cast when used:', 'Cast when held:', 'Cast when strikes:', 'Extra spell pts', 'Potent vs',
  'Regens health', 'Vampiric effect', 'Increased weight allowance', 'Repairs objects', 'Absorbs spells',
  'Enhances skill', 'Feather weight', 'Strengthens armor', 'Improves talents', 'Good rep with',
  'Soul bound', 'Item deteriorates', 'User takes damage', 'Vision problems', 'Walking problems',
  'Low damage vs', 'Health leech', 'Bad reactions from', 'Extra weight', 'Weakens armor', 'Bad rep with',
]);

/** The parameter lists MagicPowers names, by power (:293-343). */
const PARAM_LISTS = Object.freeze({
  [T.ExtraSpellPts]: ['during Winter', 'during Spring', 'during Summer', 'during Fall', 'during Full Moon',
    'during Half Moon', 'during New Moon', 'near undead', 'near daedra', 'near humanoids', 'near animals'],
  [T.PotentVs]: ['undead', 'Daedra', 'humanoids', 'animals'],
  [T.LowDamageVs]: ['undead', 'Daedra', 'humanoids', 'animals'],
  [T.RegensHealth]: ['all the time', 'in sunlight', 'in darkness'],
  [T.VampiricEffect]: ['at range', 'when strikes'],
  [T.IncreasedWeightAllowance]: ['25% additional', '50% additional'],
  [T.ImprovesTalents]: ['hearing', 'athleticism', 'adrenaline rush'],
  [T.GoodRepWith]: ['Commoners', 'Merchants', 'Scholars', 'Nobility', 'Underworld', 'All'],
  [T.BadRepWith]: ['Commoners', 'Merchants', 'Scholars', 'Nobility', 'Underworld', 'All'],
  [T.ItemDeteriorates]: ['all the time', 'in sunlight', 'in holy places'],
  [T.UserTakesDamage]: ['in sunlight', 'in holy places'],
  [T.HealthLeech]: ['whenever used', 'unless used daily', 'unless used weekly'],
  [T.BadReactionsFrom]: ['humanoids', 'animals', 'Daedra'],
});

/** Internal_Strings `powersUnknown`. */
export const POWERS_UNKNOWN_TEXT = 'Powers unknown.';
/** The artifact descriptions: 8700 + ArtifactsSubTypes. */
export const ARTIFACT_POWERS_TEXT_BASE = 8700;

const typeName = (type) => Object.keys(T).find((k) => T[k] === type) ?? '';

/**
 * MagicPowers, as the lines the box shows (one per power).
 * @param {any} item
 * @param {{ identified?: boolean, lines?: (id: number) => any[] }} [io]
 *   `identified` is the item's derived identified state; `lines` reads a
 *   TEXT.RSC record (the artifact arm).
 * @returns {string[]}
 */
export function magicPowersLines(item, { identified = true, lines = null } = {}) {
  if (!item) return [];
  if (item.artifact) {
    // GetArtifactSubType throws on a missing index and MagicPowers logs and
    // returns null - the box shows nothing for it, not a guess
    if (((item.artifactIndexBitfield ?? 0) & 1) === 0) return [];
    const rows = lines?.(ARTIFACT_POWERS_TEXT_BASE + (item.artifactIndexBitfield >> 1)) ?? [];
    return rows.map((r) => (typeof r === 'string' ? r : r?.text ?? '')).filter((t) => t.length);
  }
  if (!identified) return [POWERS_UNKNOWN_TEXT];
  const out = [];
  for (const e of item.enchantments ?? []) {
    // DFU breaks at the first None (and at 65535, an old save's unsigned read)
    if (!e || e.type === T.None || e.type === 65535 || e.type == null) break;
    const first = `${ITEM_POWERS[e.type] ?? ''} `;
    const list = PARAM_LISTS[e.type];
    if (e.type === T.SoulBound && e.param !== -1) out.push(first + enchantmentParamName('SoulBound', e.param));
    else if (list) out.push(first + (list[e.param] ?? ''));
    else if (e.type === T.EnhancesSkill) out.push(first + (SKILL_NAMES[e.param] ?? ''));
    else if (e.type <= T.CastWhenStrikes) out.push(first + (enchantmentParamName(typeName(e.type), e.param) || 'ERROR'));
    else out.push(first);
  }
  return out.map((t) => t.trimEnd());
}
