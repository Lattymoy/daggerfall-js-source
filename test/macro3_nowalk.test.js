// MACRO-3 (2026-09-22, the macro audit): FOUR BOXES THAT NEVER WALKED.
// The broken-item line (TEXT.RSC 29, "%it is broken."), the drop-gold
// prompt (25, "You have %gii gold pieces"), the classic skin's mastery
// box (4020, "Congratulations, %pcn, You are now a Master of %ski") and
// the item-powers box (1016, "Item powers: %mpw") all handed TEXT.RSC to
// the screen raw. And %mpw had no source anywhere in the port -
// DaggerfallUnityItemMCP.MagicPowers is ported here (systems/itemPowers.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { magicPowersLines, ITEM_POWERS, POWERS_UNKNOWN_TEXT, ARTIFACT_POWERS_TEXT_BASE } from '../src/systems/itemPowers.js';
import { ENCHANTMENT_TYPES as T } from '../src/formats/magicDef.js';
import { powersRows } from '../src/ui/nativeInventory.js';
import { expandRowValues, setMacroWorld } from '../src/systems/quest/questMacros.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('MACRO-3: %mpw is MagicPowers - one line per power, DFU’s words, DFU’s order', () => {
  const ench = (type, param) => ({ type: T[type], param });
  const item = { enchantments: [ench('CastWhenUsed', 4), ench('PotentVs', 1), ench('ExtraSpellPts', 0),
    ench('EnhancesSkill', 0), ench('SoulBound', 0), ench('FeatherWeight', -1), ench('HealthLeech', 2),
    { type: T.None, param: -1 }, ench('RepairsObjects', -1)] };
  assert.deepEqual(magicPowersLines(item), [
    'Cast when used: Levitate', 'Potent vs Daedra', 'Extra spell pts during Winter',
    'Enhances skill Medical', 'Soul bound Rat', 'Feather weight', 'Health leech unless used weekly',
  ], 'the list stops at the first None, as DFU’s loop breaks');
  assert.equal(ITEM_POWERS.length, 26, 'every EnchantmentTypes row from CastWhenUsed to BadRepWith');
  assert.deepEqual(magicPowersLines(item, { identified: false }), [POWERS_UNKNOWN_TEXT], 'unidentified: the powers are unknown');
  // an artifact reads its own description record, identified or not
  const art = { artifact: true, artifactIndexBitfield: (9 << 1) | 1, enchantments: item.enchantments };
  const seen = [];
  assert.deepEqual(magicPowersLines(art, { identified: false, lines: (id) => { seen.push(id); return [{ text: 'Azura’s Star holds a soul.' }]; } }),
    ['Azura’s Star holds a soul.']);
  assert.deepEqual(seen, [ARTIFACT_POWERS_TEXT_BASE + 9]);
  assert.deepEqual(magicPowersLines({ artifact: true, artifactIndexBitfield: 0 }, { lines: () => [{ text: 'x' }] }), [],
    'an artifact with no index shows nothing - GetArtifactSubType throws and MagicPowers returns null');
});

test('MACRO-3: record 1016’s %mpw row becomes one row per power, keeping its alignment', () => {
  const record = [{ text: 'Item powers:', center: false }, { text: '%mpw', center: true }];
  assert.deepEqual(powersRows(record, ['Cast when used: Levitate', 'Feather weight']), [
    { text: 'Item powers:', center: false },
    { text: 'Cast when used: Levitate', center: true },
    { text: 'Feather weight', center: true },
  ]);
});

test('MACRO-3: the four boxes walk their records, each with the source DFU hands it', () => {
  const inv = read('src/ui/nativeInventory.js');
  assert.match(inv, /rows: expandRowValues\(this\.hooks\.rows\?\.\(ITEM_BROKEN_TEXT_ID\)\s+\?\? \[\{ text: 'This item is broken\.', center: true \}\], \{ it: this\._longName\(it\) \}\),/, 'broken: the item names %it');
  assert.match(inv, /lines: expandRowValues\(this\.hooks\.rows\?\.\(GOLD_TO_DROP_TEXT_ID\)[^\n]*, null\),/, 'drop gold: %gii is the world’s');
  assert.match(inv, /powersRows\(rows\(INFO_TEXT_POWERS\) \?\? \[\], magicPowersLines\(it, \{ identified: itemIsIdentified\(it\), lines: rows \}\)\)/, 'item powers: %mpw');
  assert.match(read('src/systems/quickslots.js'), /expandRowValues\(rows\(id\) \?\? \[\], \{ it: itemLongName\(r\.item\) \}\)/, 'the quickslot refusal names the item too');
  assert.match(read('src/scenes/shared.js'), /announceMastery\(id, \{ box, rows: \(\) => expandRowValues\(plainLines\(lines\?\.\(MASTERY_TEXT_ID\)\), null\) \}\);/, 'mastery: %pcn and %ski are globals');
  // and the walks really fill them
  setMacroWorld(() => ({ nowSeconds: () => 0, hooks: { playerName: () => 'Aldric Vane', getGoldPieces: () => 412 } }));
  try {
    assert.deepEqual(expandRowValues([{ text: '%it is broken.', center: true }], { it: 'Dwarven Mace' }), [{ text: 'Dwarven Mace is broken.', center: true }]);
    assert.deepEqual(expandRowValues(['Congratulations, %pcn,'], null), ['Congratulations, Aldric Vane,']);
  } finally { setMacroWorld(null); }
});
