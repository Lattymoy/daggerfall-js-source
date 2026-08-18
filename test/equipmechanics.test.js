// U8f: the equip MECHANICS layer (systems/equip.js over the C5c
// assignment foundation) + the paperdoll base render on real art.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EQUIP_SLOTS, getEquipSlot, equipItem, unequipSlot, isEquipped, armorValuesOf, BODY_PARTS, seedStartingEquipment } from '../src/systems/equip.js';
import { filterByTab, armorLabelValue } from '../src/ui/nativeInventory.js';
import { preloadPaperDollArt, drawPaperDoll, paperDollArtLoaded, refreshPaperDoll, slotAtPaperDoll, paperdollItemImage, clampArmorVariant, _debugPaperDoll, WAIST_HEIGHT, PAPERDOLL_ORIGIN, ARMOR_LABEL_POS } from '../src/ui/paperDoll.js';
import { getTemplate } from '../src/characters/paperdoll.js';
import { TextureFile } from '../src/formats/textureFile.js';
import { DFPalette } from '../src/formats/dfPalette.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;

const ent = () => ({ items: [] });

test('equipMechanics: EquipItem over string-group bag items - hands, 2H, shields, arrows, stacks', () => {
  const e = ent();
  // Either-hand weapons fill right then left (GetFirstSlot)
  const sword = { group: 'Weapons', templateIndex: 120, name: 'Longsword' };
  const dagger = { group: 'Weapons', templateIndex: 113, name: 'Dagger' };
  assert.deepEqual(equipItem(e, sword), []);
  assert.equal(sword.equipSlot, EQUIP_SLOTS.RightHand);
  assert.deepEqual(equipItem(e, dagger), []);
  assert.equal(dagger.equipSlot, EQUIP_SLOTS.LeftHand);
  // a 2H clears BOTH hands
  const claymore = { group: 'Weapons', templateIndex: 122, name: 'Claymore' };
  const out = equipItem(e, claymore);
  assert.deepEqual(out.map((i) => i.name).sort(), ['Dagger', 'Longsword']);
  assert.equal(claymore.equipSlot, EQUIP_SLOTS.RightHand);
  assert.equal(isEquipped(sword), false);
  // a shield bumps the held 2H
  const shield = { group: 'Armor', templateIndex: 109, name: 'Buckler' };
  assert.deepEqual(equipItem(e, shield).map((i) => i.name), ['Claymore']);
  assert.equal(shield.equipSlot, EQUIP_SLOTS.LeftHand);
  // with a 2H held, the next weapon replaces it in the RIGHT hand
  equipItem(e, claymore);   // re-equip 2H (bumps the shield)
  assert.equal(getEquipSlot(e, dagger), EQUIP_SLOTS.RightHand, 'the 2H-replace rule');
  // arrows never equip; wands resolve nowhere (the string boundary)
  assert.equal(equipItem(e, { group: 'Weapons', templateIndex: 131, name: 'Arrow', stackCount: 20 }), null);
  assert.equal(equipItem(e, { group: 'Jewellery', templateIndex: 140, name: 'Wand' }), null);
  // the slot swap: a second cuirass returns the first
  const c1 = { group: 'Armor', templateIndex: 102, name: 'Iron Cuirass' };
  const c2 = { group: 'Armor', templateIndex: 102, name: 'Steel Cuirass' };
  equipItem(e, c1);
  assert.deepEqual(equipItem(e, c2).map((i) => i.name), ['Iron Cuirass']);
  // a stack splits ONE off (SplitStack); the single joins the bag
  const rings = { group: 'Jewellery', templateIndex: 135, name: 'Rings', stackCount: 2 };
  e.items.push(rings);
  equipItem(e, rings);
  assert.equal(rings.stackCount, 1, 'the stack keeps the rest');
  assert.equal(rings.equipSlot, undefined);
  const worn = e.items.find((i) => i !== rings && i.name === 'Rings');
  assert.equal(worn.stackCount, 1);
  assert.ok(worn.equipSlot != null);
  // FilterLocalItems: worn items leave the tab lists; unequip returns them
  const bag = [c2, sword];
  assert.deepEqual(filterByTab(bag, 'weapons').map((i) => i.name), ['Longsword'], 'the worn cuirass hides');
  unequipSlot(e, EQUIP_SLOTS.ChestArmor);
  assert.deepEqual(filterByTab(bag, 'weapons').map((i) => i.name), ['Steel Cuirass', 'Longsword']);
});

test('equipMechanics: the item image laws (GetItemImage forPaperDoll)', () => {
  // armor: firstMaleArchive 249 + Human morphology 2; the SetVariant
  // clamp (plate cuirass variant 0 -> 1); plate iron dyes Iron (15)
  const plate = paperdollItemImage({ group: 'Armor', templateIndex: 102, material: 0x0200, variant: 0, equipSlot: 18 });
  assert.deepEqual([plate.archive, plate.record, plate.dye], [251, 3 + 1, 15]);
  // leather cuirass: variant clamps to 0, dye Unchanged (the identity None table)
  const leather = paperdollItemImage({ group: 'Armor', templateIndex: 102, material: 0x0000, variant: 2, equipSlot: 18 });
  assert.deepEqual([leather.archive, leather.record, leather.dye], [251, 3, 18]);
  // chain greaves clamp to variant 6
  assert.equal(clampArmorVariant(104, 0x0100, 3), 6);
  // an Either-hand weapon worn RIGHT draws record + 1
  const t120 = getTemplate(120);
  const right = paperdollItemImage({ group: 'Weapons', templateIndex: 120, material: 0, equipSlot: EQUIP_SLOTS.RightHand });
  const left = paperdollItemImage({ group: 'Weapons', templateIndex: 120, material: 0, equipSlot: EQUIP_SLOTS.LeftHand });
  assert.equal(right.record, t120.playerTextureRecord + 1);
  assert.equal(left.record, t120.playerTextureRecord);
  // clothing rides its template archive + morphology, dye defaults Blue (0)
  const shirt = paperdollItemImage({ group: 'MensClothing', templateIndex: 165, variant: 1, equipSlot: 17 });
  assert.deepEqual([shirt.archive, shirt.record, shirt.dye], [getTemplate(165).playerTextureArchive + 2, getTemplate(165).playerTextureRecord + 1, 0]);
  // jewellery blits only when equipped to BODY (slot > 11)
  assert.equal(paperdollItemImage({ group: 'Jewellery', templateIndex: 135, equipSlot: 4 }), null);
  // books have no paperdoll layer
  assert.equal(paperdollItemImage({ group: 'Books', templateIndex: 277, equipSlot: 18 }), null);
});

test('equipMechanics: the composite doll - layers, click mask, real art', { skip: skipReal }, async () => {
  const palette = new DFPalette();
  palette.load(new Uint8Array(readFileSync(join(ARENA2, 'ART_PAL.COL'))), 'ART_PAL.COL');
  let uploaded = null;
  const renderer = {
    uploadTexture: (g, name, bmp) => { uploaded = { name, w: bmp.width, h: bmp.height }; return `tex:${name}`; },
    drawScreenQuad: () => {},
  };
  const texCache = new Map();
  const getTexture = async (archive) => {
    if (!texCache.has(archive)) {
      const name = `TEXTURE.${String(archive).padStart(3, '0')}`;
      const tf = new TextureFile();
      tf.load(new Uint8Array(readFileSync(join(ARENA2, name))), name, palette);
      texCache.set(archive, tf);
    }
    return texCache.get(archive);
  };
  await preloadPaperDollArt({ renderer, palette, getTexture, fetchBytes: async (n) => new Uint8Array(readFileSync(join(ARENA2, n))) });
  assert.ok(paperDollArtLoaded());
  // equip a plate cuirass + a longsword, compose
  const e = ent();
  equipItem(e, { group: 'Armor', templateIndex: 102, material: 0x0200, variant: 1, name: 'Cuirass' });
  equipItem(e, { group: 'Weapons', templateIndex: 120, material: 0, name: 'Longsword' });
  await refreshPaperDoll(e);
  const dbg = _debugPaperDoll();
  assert.ok(dbg.live, 'the composite uploaded');
  assert.deepEqual([...dbg.layers].sort((a, b) => a - b), [EQUIP_SLOTS.ChestArmor, EQUIP_SLOTS.RightHand]);
  assert.equal(uploaded.w, 110);
  assert.equal(uploaded.h, 184);
  // GetEquipIndex: some panel pixel resolves each worn slot; walking
  // every pixel must find both layers and nothing else
  const found = new Set();
  for (let y = 0; y < 184; y++) for (let x = 0; x < 110; x++) {
    const s = slotAtPaperDoll(x, y);
    if (s != null) found.add(s);
  }
  assert.deepEqual([...found].sort((a, b) => a - b), [EQUIP_SLOTS.ChestArmor, EQUIP_SLOTS.RightHand]);
  // unequip -> recompose empties the layout
  unequipSlot(e, EQUIP_SLOTS.ChestArmor);
  unequipSlot(e, EQUIP_SLOTS.RightHand);
  await refreshPaperDoll(e);
  assert.deepEqual(_debugPaperDoll().layers, []);
  assert.ok(PAPERDOLL_ORIGIN[0] === 200 && WAIST_HEIGHT === 40);
  const m = { s: 1, ox: 0, oy: 0 };
  assert.ok(drawPaperDoll(renderer, m, e, 49, 13));
});

test('equipMechanics: U8h armor values (UpdateEquippedArmorValues verbatim)', () => {
  const e = ent();
  // the classic no-armor baseline: 100 per part
  assert.deepEqual(armorValuesOf(e), [100, 100, 100, 100, 100, 100, 100]);
  // leather cuirass: chest -= 3*5
  const cuirass = { group: 'Armor', templateIndex: 102, material: 0x0000, name: 'Leather Cuirass' };
  equipItem(e, cuirass);
  assert.equal(e.armorValues[BODY_PARTS.Chest], 85);
  // steel greaves: legs -= 9*5
  equipItem(e, { group: 'Armor', templateIndex: 104, material: 0x0201, name: 'Steel Greaves' });
  assert.equal(e.armorValues[BODY_PARTS.Legs], 55);
  // a DAEDRIC buckler is material-blind: LeftArm/Hands -= 1*5 only
  equipItem(e, { group: 'Armor', templateIndex: 109, material: 0x0209, name: 'Daedric Buckler' });
  assert.equal(e.armorValues[BODY_PARTS.LeftArm], 95);
  assert.equal(e.armorValues[BODY_PARTS.Hands], 95);
  // a tower shield covers Head too (swap returns the buckler's 5s)
  equipItem(e, { group: 'Armor', templateIndex: 112, material: 0x0200, name: 'Tower Shield' });
  assert.equal(e.armorValues[BODY_PARTS.Head], 80);
  assert.equal(e.armorValues[BODY_PARTS.LeftArm], 80);
  assert.equal(e.armorValues[BODY_PARTS.Legs], 55 - 20);
  // unequip restores; the displayed value law: (100 - av)/5
  unequipSlot(e, EQUIP_SLOTS.ChestArmor);
  assert.equal(e.armorValues[BODY_PARTS.Chest], 100);
  // AUDIT 17e F36 / A PIN MUST FAIL: this asserted
  // Math.trunc((100-55)/5) === 9 - literal arithmetic touching no
  // port code (mutation-proven: changing the divisor kept it green),
  // and the 55 was stale besides. Pinned against the LIVE table now.
  assert.equal(armorLabelValue(e.armorValues[BODY_PARTS.Legs]),
    Math.trunc((100 - e.armorValues[BODY_PARTS.Legs]) / 5));
  assert.equal(armorLabelValue(100), 0, 'unarmored reads 0');
  assert.equal(armorLabelValue(85), 3, 'leather reads its material value');
  // weapons/clothing never touch the table
  equipItem(e, { group: 'Weapons', templateIndex: 120, material: 9, name: 'Daedric Longsword' });
  equipItem(e, { group: 'MensClothing', templateIndex: 165, variant: 0, name: 'Shirt' });
  assert.equal(e.armorValues[BODY_PARTS.Chest], 100);
  // the verbatim label positions (PaperDoll.armourLabelPos)
  assert.deepEqual(ARMOR_LABEL_POS.map((p) => [...p]), [[70, 12], [20, 38], [86, 38], [12, 58], [6, 90], [18, 120], [22, 168]]);
});

test('equipMechanics: U8h the starting seed + the worn-weapon binding shape', () => {
  const e = ent();
  seedStartingEquipment(e);
  const worn = e.equip.slots[EQUIP_SLOTS.RightHand];
  assert.equal(worn?.name, 'Dagger');
  assert.equal(worn.templateIndex, 113);
  assert.equal(worn.material, 0);
  assert.ok(e.items.includes(worn), 'the dagger lives IN the bag, worn');
  // idempotent: a second seed adds nothing
  seedStartingEquipment(e);
  assert.equal(e.items.length, 1);
  // a bag-carrying entity never seeds (probe bags stay untouched)
  const e2 = { items: [{ group: 'Books', templateIndex: 277 }] };
  seedStartingEquipment(e2);
  assert.equal(e2.equip, undefined);
  // the binding law the hosts run per frame: slots[RightHand] ?? null
  assert.equal(e.equip.slots[EQUIP_SLOTS.RightHand] ?? null, worn);
  unequipSlot(e, EQUIP_SLOTS.RightHand);
  assert.equal(e.equip.slots[EQUIP_SLOTS.RightHand] ?? null, null, 'bare hands -> the unarmed path');
});
