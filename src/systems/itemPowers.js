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
//     that power's arm names - or, for the three CastWhen*, the SPELL.
//
// The lists are DFU's own English strings (Internal_Strings: itemPowers,
// extraSpellPtsTimes, ...) - this box's words, which are NOT always the
// enchantment picker's (the picker says "During Winter", the box says
// "during Winter"). The creature and skill names are the ones the picker
// already carries (enchantmentCatalogue, skills.js), which ARE the
// strings DFU reads at those arms. The spell is NOT the picker's: see
// castSpellName (FB 2026-09-29).

import { ENCHANTMENT_TYPES as T } from '../formats/magicDef.js';
import { enchantmentParamName } from './enchantmentCatalogue.js';
import { SKILL_NAMES } from './skills.js';
import { localizedText, localizedTextList } from './textManager.js';   // L10N3d: DFU's Internal_Strings, read in the player's language
import { spellRecordOfIndex } from './loot.js';   // FB 2026-09-29: the SPELLS.STD registry loadMagicRegistries sets

/** Internal_Strings `itemPowers`, indexed by EnchantmentTypes - read
 *  where MagicPowers reads it (:291). */
export const itemPowers = () => localizedTextList('itemPowers', [
  'Cast when used:', 'Cast when held:', 'Cast when strikes:', 'Extra spell pts', 'Potent vs',
  'Regens health', 'Vampiric effect', 'Increased weight allowance', 'Repairs objects', 'Absorbs spells',
  'Enhances skill', 'Feather weight', 'Strengthens armor', 'Improves talents', 'Good rep with',
  'Soul bound', 'Item deteriorates', 'User takes damage', 'Vision problems', 'Walking problems',
  'Low damage vs', 'Health leech', 'Bad reactions from', 'Extra weight', 'Weakens armor', 'Bad rep with',
]);

/** The parameter lists MagicPowers names, by power (:293-343), each read
 *  by its own Internal_Strings key when a power is listed. */
const enemyGroupNames = () => localizedTextList('enemyGroupNames', ['undead', 'Daedra', 'humanoids', 'animals']);
const repWithGroups = () => localizedTextList('repWithGroups', ['Commoners', 'Merchants', 'Scholars', 'Nobility', 'Underworld', 'All']);
const PARAM_LISTS = Object.freeze({
  [T.ExtraSpellPts]: () => localizedTextList('extraSpellPtsTimes', ['during Winter', 'during Spring', 'during Summer', 'during Fall', 'during Full Moon',
    'during Half Moon', 'during New Moon', 'near undead', 'near daedra', 'near humanoids', 'near animals']),
  [T.PotentVs]: enemyGroupNames,
  [T.LowDamageVs]: enemyGroupNames,
  [T.RegensHealth]: () => localizedTextList('regensHealthTimes', ['all the time', 'in sunlight', 'in darkness']),
  [T.VampiricEffect]: () => localizedTextList('vampiricEffectRanges', ['at range', 'when strikes']),
  [T.IncreasedWeightAllowance]: () => localizedTextList('increasedWeightAllowances', ['25% additional', '50% additional']),
  [T.ImprovesTalents]: () => localizedTextList('improvedTalents', ['hearing', 'athleticism', 'adrenaline rush']),
  [T.GoodRepWith]: repWithGroups,
  [T.BadRepWith]: repWithGroups,
  [T.ItemDeteriorates]: () => localizedTextList('itemDeteriorateLocations', ['all the time', 'in sunlight', 'in holy places']),
  [T.UserTakesDamage]: () => localizedTextList('userTakesDamageLocations', ['in sunlight', 'in holy places']),
  [T.HealthLeech]: () => localizedTextList('healthLeechStopConditions', ['whenever used', 'unless used daily', 'unless used weekly']),
  [T.BadReactionsFrom]: () => localizedTextList('badReactionFromEnemyGroups', ['humanoids', 'animals', 'Daedra']),
});

/** Internal_Strings `powersUnknown`. */
export const POWERS_UNKNOWN_TEXT = 'Powers unknown.';
/** The artifact descriptions: 8700 + ArtifactsSubTypes. */
export const ARTIFACT_POWERS_TEXT_BASE = 8700;

/** THE CastWhen* ARM'S SPELL (:345-363). MagicPowers walks the WHOLE of
 *  SPELLS.STD (DaggerfallSpellReader.ReadSpellsFile) for the record
 *  whose index is the param and prints GetLocalizedSpellName - it never
 *  asks which spells the item maker OFFERS for that power. This arm used
 *  to ask exactly that (enchantmentParamName over the power's own list),
 *  and MAGIC.DEF's *%it of Featherweight* is CastWhenUsed at spell 37,
 *  Slowfalling, which the maker offers only as Cast When Held: every one
 *  minted read "Cast when used: ERROR" (FB 2026-09-29, a Mark). The
 *  table is the registry the hosts' loadMagicRegistries sets (exterior,
 *  world and dungeonContext boot it; worldModes' interiors run inside
 *  the first two). Until it lands - a boot, a headless suite - the
 *  catalogue answers: its three CastWhen* lists are SPELLS.STD's own
 *  names by the same ids, and an id is one spell whichever power lists
 *  it. '' when neither knows the id, which is MagicPowers' "ERROR". */
const CAST_WHEN_KEYS = Object.freeze(['CastWhenUsed', 'CastWhenHeld', 'CastWhenStrikes']);
const castSpellName = (id) => spellRecordOfIndex(id)?.name
  || CAST_WHEN_KEYS.map((k) => enchantmentParamName(k, id)).find(Boolean) || '';

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
  if (!identified) return [localizedText('powersUnknown', POWERS_UNKNOWN_TEXT)];
  const powers = itemPowers();
  const out = [];
  for (const e of item.enchantments ?? []) {
    // DFU breaks at the first None (and at 65535, an old save's unsigned read)
    if (!e || e.type === T.None || e.type === 65535 || e.type == null) break;
    const first = `${powers[e.type] ?? ''} `;
    const list = PARAM_LISTS[e.type]?.();
    if (e.type === T.SoulBound && e.param !== -1) out.push(first + enchantmentParamName('SoulBound', e.param));
    else if (list) out.push(first + (list[e.param] ?? ''));
    else if (e.type === T.EnhancesSkill) out.push(first + (SKILL_NAMES[e.param] ?? ''));
    else if (e.type <= T.CastWhenStrikes) out.push(first + (castSpellName(e.param) || 'ERROR'));
    else out.push(first);
  }
  return out.map((t) => t.trimEnd());
}
