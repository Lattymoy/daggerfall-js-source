// FB 2026-09-29 (Discord #bug-reports, Cruor, relayed by Mac): "Bugged
// Mark item with an error! I have no idea what this does but it scares
// me." - an Enhanced card for a MARK OF FEATHERWEIGHT whose one power
// line read "Cast when used: ERROR".
//
// THE ITEM IS DFU'S OWN AND IT IS WHOLE. MAGIC.DEF's *%it of
// Featherweight* is one CastWhenUsed slot at classic spell 37,
// Slowfalling (DFU's MagicItemTemplates.txt - its JSON dump of the
// patched file - carries the same record: group 0, 1500 uses), and
// CreateRegularMagicItem put it on a Mark. Used, it casts Slowfalling on
// its user and pays 10 of its 1500 condition. The 0.25 kg on the card is
// the Mark's own base weight, not a Feather Weight enchantment.
//
// THE READER COULD NOT NAME IT. DaggerfallUnityItemMCP.MagicPowers
// (:345-363) finds a CastWhen* spell in the WHOLE of SPELLS.STD and prints
// its name; systems/item/itemPowers.js looked in the item maker's list for
// THAT power - and the maker offers Slowfalling only as Cast When Held -
// so the lookup missed and the box printed MagicPowers' not-found word.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MAGIC_ITEM_RECORD_SIZE, ENCHANTMENT_TYPES as T, readMagicDef } from '../../../src/formats/magicDef.js';
import { SPELL_RECORD_SIZE, readSpellsStd, spellsByIndexMap } from '../../../src/formats/spellsStd.js';
import { loadMagicRegistries } from '../../../src/scenes/shared.js';
import { createRegularMagicItem, setSpellRecordsByIndex } from '../../../src/systems/loot/loot.js';
import { magicPowersLines } from '../../../src/systems/item/itemPowers.js';
import { resolveItemName } from '../../../src/systems/item/itemInfo.js';
import { templateByIndex } from '../../../src/systems/item/itemTemplates.js';
import { setDefaultEnchantCtx, DURABILITY_LOSS_ON_USE } from '../../../src/systems/enchantments.js';
import { useItem } from '../../../src/systems/useItem.js';
import { isEnchanted } from '../../../src/systems/inventory.js';

const arena2 = process.env.ARENA2_PATH;
const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };

/** One MAGIC.DEF record (MagicItemsFile.ReadNextMagicItem's 62 bytes). */
function magicDefBytes(records) {
  const buf = new Uint8Array(4 + records.length * MAGIC_ITEM_RECORD_SIZE);
  const v = new DataView(buf.buffer);
  v.setInt32(0, records.length, true);
  let o = 4;
  for (const r of records) {
    for (let i = 0; i < r.name.length; i++) buf[o + i] = r.name.charCodeAt(i);
    o += 32;
    buf[o++] = r.type; buf[o++] = r.group; buf[o++] = 0;
    for (let i = 0; i < 10; i++) { v.setInt8(o++, r.ench[i]?.[0] ?? -1); v.setInt8(o++, r.ench[i]?.[1] ?? -1); }
    v.setInt16(o, r.uses, true); o += 2;
    v.setInt32(o, r.value, true); o += 4;
    buf[o++] = 0;
  }
  return buf;
}
/** DFU's MagicItemTemplates.txt row for it, byte for byte. */
const FEATHERWEIGHT = { name: '%it of Featherweight', type: 0, group: 0, ench: [[T.CastWhenUsed, 37]], uses: 1500, value: 550 };

/** SPELLS.STD records (DaggerfallSpellReader's 89 bytes): the name at 47,
 *  the index at 73, one live effect so the reader's gate passes. */
function spellsStdBytes(spells) {
  const buf = new Uint8Array(spells.length * SPELL_RECORD_SIZE);
  spells.forEach(({ index, name, rangeType = 0 }, n) => {
    const o = n * SPELL_RECORD_SIZE;
    const v = new DataView(buf.buffer, o, SPELL_RECORD_SIZE);
    for (let i = 0; i < 3; i++) { v.setInt8(i * 2, i === 0 ? 16 : -1); v.setInt8(i * 2 + 1, -1); }
    buf[o + 7] = rangeType;
    v.setUint16(8, 24, true);
    for (let i = 0; i < name.length; i++) buf[o + 47 + i] = name.charCodeAt(i);
    buf[o + 73] = index;
  });
  return buf;
}

/** The four hosts' own door (scenes/shared.js loadMagicRegistries) over
 *  the given files - it sets both registries, as a boot does. */
const bootRegistries = (files) => loadMagicRegistries(async (name) => {
  if (!files[name]) throw new Error(`${name} absent`);
  return files[name];
});

test('FB 2026-09-29: the Mark of Featherweight names its spell - "Cast when used: Slowfalling", not ERROR', async () => {
  const { spellsByIndex, magicItemTemplates } = await bootRegistries({
    'SPELLS.STD': spellsStdBytes([{ index: 37, name: 'Slowfalling' }]),
    'MAGIC.DEF': magicDefBytes([FEATHERWEIGHT]),
  });
  assert.ok(spellsByIndex.has(37));
  // the producer: the one regular record, group 0's seventh group (Jewellery), the fifth jewel (the Mark)
  const mark = createRegularMagicItem(magicItemTemplates, 1, 'female', seq(0, 0.9, 0.5));
  assert.equal(templateByIndex(mark.templateIndex)?.name, 'Mark');
  assert.deepEqual(mark.enchantments, [{ type: T.CastWhenUsed, param: 37 }], 'DFU mints Slowfalling WHEN USED - nothing to repair at the producer');
  assert.deepEqual([mark.maxCondition, mark.currentCondition], [1500, 1500]);
  mark.isIdentified = true;   // the Identify service's write - the name and the powers read only once it is known
  assert.equal(resolveItemName(mark), 'Mark of Featherweight');
  assert.deepEqual(magicPowersLines(mark), ['Cast when used: Slowfalling']);
});

test('FB 2026-09-29: the CastWhen* arm reads SPELLS.STD itself, whichever power casts the spell - MagicPowers :345-363', async () => {
  // a table whose names are NOT the catalogue's, so the line can only have come from the table
  await bootRegistries({ 'SPELLS.STD': spellsStdBytes([
    { index: 37, name: 'Featherfall' }, { index: 31, name: 'Sky Lash' }, { index: 64, name: 'Mend' },
  ]) });
  const lines = (type, param) => magicPowersLines({ enchantments: [{ type, param }] });
  assert.deepEqual(lines(T.CastWhenUsed, 37), ['Cast when used: Featherfall']);
  assert.deepEqual(lines(T.CastWhenHeld, 37), ['Cast when held: Featherfall']);
  assert.deepEqual(lines(T.CastWhenStrikes, 31), ['Cast when strikes: Sky Lash'], 'Lightning, offered by the maker only as Cast When Used');
  assert.deepEqual(lines(T.CastWhenHeld, 64), ['Cast when held: Mend']);
  // a spell SPELLS.STD does not hold, and no list names: DFU's own not-found word
  assert.deepEqual(lines(T.CastWhenUsed, 120), ['Cast when used: ERROR']);
});

test('FB 2026-09-29: before SPELLS.STD lands, the catalogue names the id whichever power lists it; an unknown id is still ERROR', () => {
  setSpellRecordsByIndex(null);   // a headless suite, or the boot before loadMagicRegistries resolves
  const lines = (type, param) => magicPowersLines({ enchantments: [{ type, param }] });
  assert.deepEqual(lines(T.CastWhenUsed, 37), ['Cast when used: Slowfalling'], 'named by the Cast When Held list');
  assert.deepEqual(lines(T.CastWhenStrikes, 31), ['Cast when strikes: Lightning'], 'named by the Cast When Used list');
  assert.deepEqual(lines(T.CastWhenHeld, 55), ['Cast when held: Sphere of Negation'], 'named by the Cast When Strikes list');
  assert.deepEqual(lines(T.CastWhenUsed, 4), ['Cast when used: Levitate'], 'its own list still answers');
  assert.deepEqual(lines(T.CastWhenStrikes, 120), ['Cast when strikes: ERROR']);
});

test('FB 2026-09-29: USED, the Mark casts Slowfalling on its user and pays 10 condition - the item works, only its name line did not', async () => {
  const { spellsByIndex, magicItemTemplates } = await bootRegistries({
    'SPELLS.STD': spellsStdBytes([{ index: 37, name: 'Slowfalling', rangeType: 0 }]),   // CasterOnly
    'MAGIC.DEF': magicDefBytes([FEATHERWEIGHT]),
  });
  const mark = createRegularMagicItem(magicItemTemplates, 1, 'male', seq(0, 0.9, 0.5));
  const self = [];
  const readied = [];
  setDefaultEnchantCtx({
    spellsByIndex: () => spellsByIndex,
    applySpellToSelf: (record, entity, item) => self.push([record.name, item]),
    setReadySpell: (record) => readied.push(record.name),
  });
  try {
    const entity = { isPlayer: true, items: [mark] };
    const r = useItem(mark, entity.items, { entity, isEnchanted, nowMinute: 0 });
    assert.equal(r.enchanted, true);
    assert.deepEqual(self, [['Slowfalling', mark]], 'CastWhenUsed.cs: a CasterOnly spell is assigned straight to the user');
    assert.deepEqual(readied, []);
    assert.equal(DURABILITY_LOSS_ON_USE, 10);
    assert.equal(mark.currentCondition, 1500 - DURABILITY_LOSS_ON_USE);
  } finally {
    setDefaultEnchantCtx(null);
  }
});

test('FB 2026-09-29: over the REAL MAGIC.DEF and SPELLS.STD, no regular magic item reads ERROR',
  { skip: !arena2 && 'ARENA2_PATH unset' }, () => {
    const read = (name) => new Uint8Array(readFileSync(join(arena2, name)));
    setSpellRecordsByIndex(spellsByIndexMap(readSpellsStd(read('SPELLS.STD'))));
    const templates = readMagicDef(read('MAGIC.DEF'));
    const regular = templates.filter((t) => t.type === 0);
    const errors = [];
    regular.forEach((t, i) => {
      const item = createRegularMagicItem(templates, 1, 'male', seq(0), i);
      for (const line of magicPowersLines(item)) if (/ERROR$/.test(line)) errors.push(`${t.name}: ${line}`);
    });
    assert.deepEqual(errors, []);
    const fw = regular.findIndex((t) => t.name === '%it of Featherweight');
    assert.ok(fw >= 0);
    assert.deepEqual(magicPowersLines(createRegularMagicItem(templates, 1, 'male', seq(0), fw)), ['Cast when used: Slowfalling']);
  });
