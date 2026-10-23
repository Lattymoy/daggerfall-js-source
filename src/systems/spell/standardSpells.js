// DEX4a (2026-10-20, bible/04-Characters/Enemy-Expansion.md section 8) - THE STANDARD SPELLS AS DFU BUILDS THEM:
// EntityEffectBroker.RebuildClassicSpellsDict (EntityEffectBroker.cs:736-756) reads SPELLS.STD, merges every enabled
// mod's `SpellRecords.json` into that list (TextAssetReader.Merge, AssetInjection/TextAssetReader.cs:132-181, matched
// by index), and folds it first-wins. The port read SPELLS.STD and folded it, in two places (the hosts' magic
// registries and chargen's); both build it here now, so a mod's spells are in every list or none.
// THE MERGE, item by item, in the mod's order: the first record of the item's index takes the item's fields over its
// own (a field the item does not name is kept); an index the list lacks is a new record from SpellRecordData's
// defaults (a name of "", every number -1, three blank effects) with the item's fields on it - appended, so it folds
// behind any record already holding that index. `effects`, where named, is the item's array whole (fullSerializer
// replaces an array), each effect EffectRecordData's zeros under the item's fields.
// A LEAF over the file reader.
import { readSpellsStd, spellsByIndexMap } from '../../formats/spellsStd.js';

/** EffectRecordData's fields the port's records carry (SpellRecord.cs:77-94), a struct's zeros where unnamed. */
const EFFECT_FIELDS = Object.freeze(['type', 'subType', 'durationBase', 'durationMod', 'durationPerLevel', 'chanceBase', 'chanceMod',
  'chancePerLevel', 'magnitudeBaseLow', 'magnitudeBaseHigh', 'magnitudeLevelBase', 'magnitudeLevelHigh', 'magnitudePerLevel']);
/** SpellRecordData's own (SpellRecord.cs:58-75) under the port's names - `spellName` is the record's `name`. */
const RECORD_FIELDS = Object.freeze({ spellName: 'name', element: 'element', rangeType: 'rangeType', cost: 'cost', index: 'index', icon: 'icon' });

const blankEffect = () => Object.fromEntries(EFFECT_FIELDS.map((k) => [k, 0]));
const effectOf = (item) => { const e = blankEffect(); for (const k of EFFECT_FIELDS) if (Number.isInteger(item?.[k])) e[k] = item[k]; return e; };

const _assets = [];
/** A mod's `SpellRecords.json` (its parsed list), merged in the order mods register - DFU's mod order. */
export function registerSpellRecordsAsset(source, items) {
  if (!Array.isArray(items)) throw new Error(`registerSpellRecordsAsset: ${source}'s SpellRecords.json is no list`);
  _assets.push({ source, items });
}
/** The test seam. */
export function _resetSpellRecordsAssets() { _assets.length = 0; }

/** One item deserialised onto `base` (a copy), or onto SpellRecordData's defaults. */
export function spellRecordFromJson(item, base = null) {
  const r = base ? structuredClone(base) : { effects: [blankEffect(), blankEffect(), blankEffect()], element: -1, rangeType: -1, cost: -1, name: '', icon: -1, index: -1 };
  for (const [json, field] of Object.entries(RECORD_FIELDS)) {
    if (!(json in item)) continue;
    r[field] = field === 'name' ? String(item[json]) : item[json];
  }
  if (Array.isArray(item.effects)) r.effects = item.effects.map(effectOf);
  return r;
}

/** TextAssetReader.Merge over SPELLS.STD's list (in place, as the C#'s): answers the list. */
export function mergeSpellRecords(records) {
  for (const { items } of _assets) {
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const at = records.findIndex((r) => r.index === item.index);   // isItemData: record.index == data["index"]
      if (at !== -1) records[at] = spellRecordFromJson(item, records[at]);
      else records.push(spellRecordFromJson(item));
    }
  }
  return records;
}

/** RebuildClassicSpellsDict: SPELLS.STD's bytes to the index -> record dictionary every list reads. */
export const standardSpellsByIndex = (bytes) => spellsByIndexMap(mergeSpellRecords(readSpellsStd(bytes)));
