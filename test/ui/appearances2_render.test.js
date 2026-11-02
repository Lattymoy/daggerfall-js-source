// APPEARANCES-II (2026-10-27; bible/04-Characters/Wardrobe.md section 5): DIVERSE WEAPONS DRAWS THE LOOK, AND THE CLASSIC
// INFO BOX SAYS IT. Under Diverse Weapons a weapon's first-person sheet is its template's own, an artifact's its own by
// its enchantment - so an artifact wearing a look swung its own art. The copy drawnPiece makes is no artifact now (it
// swings the look's sheet, MAGIC while enchanted, as with the mod off), and the doll's replacement is asked in the look's
// metal. The classic skin's Info popup ends its record with the look, as the Enhanced Plus pack's Info box says it.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { atlasFileName, moddedWeaponFilename } from '../../src/combat/diverseWeapons/diverseWeapons.js';
import { drawnPiece, isLookCopy } from '../../src/net/appearanceLaw.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { createArtifact } from '../../src/systems/loot/loot.js';
import { readMagicDef, MAGIC_ITEM_RECORD_SIZE } from '../../src/formats/magicDef.js';
import { DFU_MAGIC_ITEMS } from '../dfuMagicItems.mjs';
import { WEAPONS } from '../../src/characters/weapons.js';
import { DYE_COLORS } from '../../src/characters/dyes.js';
import { itemDyeColor } from '../../src/systems/item/itemDye.js';
import { NativeInventoryWindow, INV_RECTS, TABS } from '../../src/ui/native/nativeInventory.js';
import { CELL_X, SLOT_H } from '../../src/ui/item/itemScroller.js';
import { equipOf } from '../../src/systems/equip.js';
import { setItemFields, mintCondition } from '../../src/systems/item/itemTemplates.js';
import { ARMOR_MATERIAL } from '../../src/systems/armorMaterials.js';
import { itemInfoBoxes } from '../../src/ui/enhanced/enhancedInventory.js';

function craft(records) {
  const buf = new Uint8Array(4 + records.length * MAGIC_ITEM_RECORD_SIZE);
  const v = new DataView(buf.buffer);
  v.setInt32(0, records.length, true);
  let o = 4;
  for (const r of records) {
    for (let i = 0; i < r.name.length && i < 31; i++) buf[o + i] = r.name.charCodeAt(i);
    o += 32;
    buf[o++] = r.type; buf[o++] = r.group; buf[o++] = r.groupIndex ?? 0;
    for (let i = 0; i < 10; i++) { v.setInt8(o++, r.ench?.[i]?.[0] ?? -1); v.setInt8(o++, r.ench?.[i]?.[1] ?? 0); }
    v.setInt16(o, r.uses ?? 100, true); o += 2;
    v.setInt32(o, r.value ?? 0, true); o += 4;
    buf[o++] = r.material ?? 0;
  }
  return buf;
}
const MAGIC = readMagicDef(craft(DFU_MAGIC_ITEMS));
const ARTIFACTS = MAGIC.filter((t) => t.type === 1 || t.type === 2);
const artifact = (name) => createArtifact(MAGIC, ARTIFACTS.findIndex((t) => t.name === name));
const ON = true;

test('APPEARANCES-II DIVERSE WEAPONS DRAWS THE LOOK: an artifact wearing a look swings the look\'s per-template sheet - MAGIC while enchanted, the plain one while an element shows - never its own; a plain piece wearing one swings the look\'s; its own look, and the mod off, as ever (mutants: the copy read as the artifact; the copy never marked)', () => {
  const razor = artifact('The Mehrunes Razor');
  assert.equal(razor.templateIndex, WEAPONS.Dagger);
  assert.equal(atlasFileName(drawnPiece(razor), 'WEAPON01.CIF', ON), 'MEHRUNESRAZOR.CIF', 'in its own look: its own art');
  assert.equal(isLookCopy(drawnPiece(razor)), false, 'in its own look it is drawn as itself');
  razor.appearance = { t: WEAPONS.Dagger, m: 1, v: 0 };
  const drawn = drawnPiece(razor);
  assert.equal(isLookCopy(drawn), true, 'drawnPiece\'s copy');
  assert.equal(isLookCopy(razor), false, 'never the piece');
  assert.equal(atlasFileName(drawn, 'WEAPON01.CIF', ON), 'DAGGERMAGIC.CIF', 'a Steel Dagger\'s look: the dagger\'s sheet, enchanted');
  assert.equal(atlasFileName(drawn, 'WEAPON01.CIF', ON, false), 'DAGGER.CIF', 'an element shown: the plain one (WEAPON-GLOW1)');
  assert.equal(atlasFileName(drawn, 'WEAPON01.CIF', false), 'WEAPON01.CIF', 'the mod off: the classic sheet');
  const blade = artifact('Ebony Blade');
  assert.equal(moddedWeaponFilename(drawnPiece(blade)), 'EBONYBLADE.CIF');
  blade.appearance = { t: WEAPONS.Longsword, m: 7, v: 0 };
  assert.equal(atlasFileName(drawnPiece(blade), 'WEAPON04.CIF', ON), 'LONGSWORDMAGIC.CIF', 'another template of its kind: that template\'s sheet, not the classic one the artifact table falls to');
  const sword = createWeapon(WEAPONS.Longsword, 1);
  sword.appearance = { t: WEAPONS.Katana, m: 7, v: 0 };
  assert.equal(atlasFileName(drawnPiece(sword), 'WEAPON04.CIF', ON), 'KATANA.CIF', 'a plain piece: the look\'s plain sheet');
});

test('APPEARANCES-II THE DOLL\'S REPLACEMENT IN THE LOOK\'S METAL: the doll asks Diverse Weapons\' picture by the piece as it is drawn - a Steel longsword dressed as an Ebony Katana is asked in Ebony, an artifact dressed in Steel in Steel, never in its own Unchanged (mutant: the ask by the piece)', () => {
  const sword = createWeapon(WEAPONS.Longsword, 1);
  sword.appearance = { t: WEAPONS.Katana, m: 7, v: 0 };
  assert.equal(itemDyeColor(sword), DYE_COLORS.Steel, 'the piece\'s own dye');
  assert.equal(itemDyeColor(drawnPiece(sword)), DYE_COLORS.Ebony, 'the look\'s');
  const razor = artifact('The Mehrunes Razor');
  razor.appearance = { t: WEAPONS.Dagger, m: 1, v: 0 };
  assert.equal(itemDyeColor(razor), DYE_COLORS.Unchanged);
  assert.equal(itemDyeColor(drawnPiece(razor)), DYE_COLORS.Steel);
  // the doll's ask is pinned where it is made (test/systems/dw3_icons.test.js, DW3 wiring: itemDyeColor(drawnPiece(it)))
});

const ICONS = { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() };
const LOCAL_SLOT = (s = 0) => [INV_RECTS.localList[0] + CELL_X + 5, INV_RECTS.localList[1] + s * SLOT_H + 5];
/** TEXT.RSC 1001 (a weapon's) as the classic file has it - four centred rows. */
const RSC = (id) => (id === 1001 ? [{ text: '%mat %wep ', center: true }, { text: '%wdm points of damage', center: true }, { text: 'Condition: %qua', center: true }, { text: 'Weight: %kg kilograms', center: true }] : [{ text: `RECORD ${id}`, center: false }]);
function infoOf(item) {
  const bag = [item];
  const hero = { stats: { strength: 80 }, items: bag };
  equipOf(hero);
  const w = new NativeInventoryWindow({ items: () => bag, icons: ICONS, entity: hero, rows: RSC });
  w.tab = TABS.find((t) => { w.tab = t; return w._filtered().includes(item); }) ?? 'weapons';   // an artifact is the Magic Items page's
  w.mode = 'info';
  w.click(...LOCAL_SLOT(0));
  return w.boxes;
}

test('APPEARANCES-II THE CLASSIC INFO BOX SAYS THE LOOK: a piece wearing a look ends its record\'s box with "Looks like Ebony Katana", in the record\'s alignment; a piece in its own says nothing more; an enchanted one\'s powers still chain behind; the Enhanced Plus pack says it too (mutants: the classic line unsaid; its alignment lost)', () => {
  const plain = infoOf(createWeapon(WEAPONS.Longsword, 1));
  assert.equal(plain.length, 1);
  assert.equal(plain[0].rows.length, 4, 'its own look: the record alone');
  const sword = createWeapon(WEAPONS.Longsword, 1);
  sword.appearance = { t: WEAPONS.Katana, m: 7, v: 0 };
  const boxes = infoOf(sword);
  assert.equal(boxes.length, 1, 'one box - never a click more to read it');
  assert.equal(boxes[0].rows.length, 5);
  assert.deepEqual(boxes[0].rows.at(-1), { text: 'Looks like Ebony Katana', center: true }, 'the record\'s last line, centred as its rows are');
  assert.match(boxes[0].rows[0].text, /Longsword/, 'the record names the piece itself');
  const razor = artifact('The Mehrunes Razor');
  razor.appearance = { t: WEAPONS.Dagger, m: 1, v: 0 };
  const art = infoOf(razor);
  assert.equal(art[0].rows.at(-1).text, 'Looks like Steel Dagger');
  assert.equal(art.length, 2, 'an artifact\'s powers chained behind, as ever');
  // a record laid out to the left: the line keeps its alignment (RSC's other ids here are left-aligned)
  const chest = mintCondition(setItemFields({ group: 'Armor', templateIndex: 102, material: ARMOR_MATERIAL.Iron, variant: 1 }));
  chest.appearance = { t: 102, m: ARMOR_MATERIAL.Daedric, v: 3 };
  assert.deepEqual(infoOf(chest)[0].rows.at(-1), { text: 'Looks like Daedric Cuirass, style 3', center: false });
  assert.ok(itemInfoBoxes(sword, { rows: RSC }).flat().some((r) => r.text === 'Looks like Ebony Katana'), 'the Plus pack\'s Info box says the same words');
});
