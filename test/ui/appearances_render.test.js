// APPEARANCES (2026-10-27; bible/04-Characters/Wardrobe.md): EVERY RENDERER READS IT. The paperdoll's layer, the Morrowind
// body's worn armour, Layered Gearing's outfit and the Morrowind arms' held weapon each draw a piece wearing a look as the
// look; the classic first-person sheet, the Weapon Widget's clone and the head's helm read it through the same door. The
// pack's own pictures stay the piece's: what it IS, while the body shows what it looks like.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { paperdollItemImage } from '../../src/ui/paperDoll.js';
import { dfWornArmor } from '../../src/formats/morrowind/mwItemMap.js';
import { outfitOfSlots, outfitPieces } from '../../src/player/eyeOfTheBeholder/layeredArmor.js';
import { createFpArm } from '../../src/combat/fpArm.js';
import { inventoryItemImage, setItemFields, mintCondition } from '../../src/systems/item/itemTemplates.js';
import { createWeapon, ARMOR_ENUM } from '../../src/combat/enemyEquipment.js';
import { equipItem, equipTableOf, EQUIP_SLOTS } from '../../src/systems/equip.js';
import { WEAPONS } from '../../src/characters/weapons.js';
import { ARMOR_MATERIAL } from '../../src/systems/armorMaterials.js';
import { drawnPiece } from '../../src/net/appearanceLaw.js';
import { itemInfoBoxes } from '../../src/ui/enhanced/enhancedInventory.js';
import { createArtifact } from '../../src/systems/loot/loot.js';
import { readMagicDef, MAGIC_ITEM_RECORD_SIZE } from '../../src/formats/magicDef.js';
import { DFU_MAGIC_ITEMS } from '../dfuMagicItems.mjs';
import * as WG from '../../src/systems/weaponGlow.js';
import { fixtureBodyDeps, countingRenderer } from '../fixtures/mw/bodyRig.mjs';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const armour = (templateIndex, material, variant = 0) => mintCondition(setItemFields({ group: 'Armor', templateIndex, material, variant }));
const look = ({ archive, record, dye, target }) => ({ archive, record, dye, target });
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

test('APPEARANCES THE DOLL: a piece wearing a look draws the look\'s layer - its record, its style\'s clamp, its metal\'s dye, an Either-hand weapon\'s right-hand record - for the player and every peer\'s stand-in; an artifact wearing a plain look leaves its own archive; the pack\'s picture stays the piece\'s (mutants: the doll reads the piece; the look\'s style unclamped)', () => {
  const me = { items: [] };
  const chest = armour(102, ARMOR_MATERIAL.Iron, 2), sword = createWeapon(WEAPONS.Longsword, 1);
  me.items.push(chest, sword);
  equipItem(me, chest); equipItem(me, sword);
  const ownChest = look(paperdollItemImage(chest)), ownSword = look(paperdollItemImage(sword));
  chest.appearance = { t: 102, m: ARMOR_MATERIAL.Daedric, v: 3 };
  sword.appearance = { t: WEAPONS.Katana, m: 7, v: 0 };
  const asDaedric = armour(102, ARMOR_MATERIAL.Daedric, 3), asKatana = createWeapon(WEAPONS.Katana, 7);
  asDaedric.equipSlot = chest.equipSlot; asKatana.equipSlot = sword.equipSlot;
  assert.deepEqual(look(paperdollItemImage(chest)), look(paperdollItemImage(asDaedric)), 'the cuirass drawn as the Daedric one');
  assert.notDeepEqual(look(paperdollItemImage(chest)), ownChest);
  assert.equal(paperdollItemImage(chest).record, 3 + 3, 'its record: the cuirass\'s 3 and its style');
  assert.deepEqual(look(paperdollItemImage(sword)), look(paperdollItemImage(asKatana)), 'the longsword drawn as the katana');
  assert.equal(paperdollItemImage(sword).record, 9 + 1, 'an Either-hand weapon in the right hand: its record and one');
  assert.notDeepEqual(look(paperdollItemImage(sword)), ownSword);
  assert.deepEqual(inventoryItemImage(sword), inventoryItemImage(createWeapon(WEAPONS.Longsword, 1)), 'the pack\'s picture is the piece\'s own');
  const said = (it) => itemInfoBoxes(it, { rows: () => [] }).flat().map((r) => r.text);
  assert.ok(said(sword).includes('Looks like Ebony Katana'), 'the Info box says the look it wears');
  assert.ok(!said(createWeapon(WEAPONS.Longsword, 1)).some((x) => x.startsWith('Looks like')), 'a piece in its own says nothing');
  const razor = createArtifact(MAGIC, ARTIFACTS.findIndex((t) => t.name === 'The Mehrunes Razor'));
  equipItem({}, razor);
  const ownRazor = paperdollItemImage(razor);
  razor.appearance = { t: WEAPONS.Dagger, m: 1, v: 0 };
  const plain = createWeapon(WEAPONS.Dagger, 1); plain.equipSlot = razor.equipSlot;
  assert.deepEqual(look(paperdollItemImage(razor)), look(paperdollItemImage(plain)), 'an artifact wearing a plain look draws it');
  assert.notEqual(paperdollItemImage(razor).archive, ownRazor.archive, 'out of the artifact archive');
});

test('APPEARANCES THE BODY: the Morrowind body\'s worn armour and a shield in the hand are the looks\' - a Tower Shield as a Buckler - and Layered Gearing\'s outfit is the looks\' families and metals (mutants: the Morrowind map reads the piece; the strip\'s code reads the piece)', () => {
  const me = { items: [] };
  const chest = armour(102, ARMOR_MATERIAL.Iron, 2), legs = armour(104, ARMOR_MATERIAL.Chain), helm = armour(107, ARMOR_MATERIAL.Leather, 1), shield = armour(112, ARMOR_MATERIAL.Ebony);
  for (const it of [chest, legs, helm, shield]) { me.items.push(it); equipItem(me, it); }
  const before = outfitPieces(outfitOfSlots(equipTableOf(me)));
  assert.deepEqual(before, { head: 'l', top: 'p0', legs: 'c', cloak: null, weapon: null, offhand: null, spell: null });   // PIN MOVED (LAYERED-DUAL): a pair's second
  chest.appearance = { t: 102, m: ARMOR_MATERIAL.Leather, v: 0 };
  legs.appearance = { t: 104, m: ARMOR_MATERIAL.Daedric, v: 5 };
  helm.appearance = { t: 107, m: ARMOR_MATERIAL.Ebony, v: 3 };
  shield.appearance = { t: 109, m: ARMOR_MATERIAL.Silver, v: 0 };
  assert.deepEqual(outfitPieces(outfitOfSlots(equipTableOf(me))), { head: 'p4', top: 'l', legs: 'p6', cloak: null, weapon: null, offhand: null, spell: null }, 'an Ebony helm (the strips\' fifth metal), a leather top, Daedric legs');
  const worn = dfWornArmor(equipTableOf(me), EQUIP_SLOTS, ARMOR_ENUM);
  assert.deepEqual(worn.map((p) => [p.templateIndex, p.material]).sort((a, b) => a[0] - b[0]), [[102, ARMOR_MATERIAL.Leather], [104, ARMOR_MATERIAL.Daedric], [107, ARMOR_MATERIAL.Ebony], [109, ARMOR_MATERIAL.Silver]]);
});

test('APPEARANCES THE ARMS: the Morrowind rig - the player\'s, the pack\'s figure, every peer\'s body - holds the look its weapon wears from its build on; the hand already holding it is no swap, a new look is one, and its glow is laid on the weapon it holds (mutants: the build holds the piece; setWeapon holds the piece; the glow\'s weapon the piece)', async () => {
  const cam = () => ({ pos: [0, 0, 0], yaw: 0, pitch: 0, move: { forward: 0, speed: 0, grounded: true } });
  const rig = createFpArm(); rig.attach(countingRenderer(), cam);
  const blade = createWeapon(WEAPONS.Longsword, 1, () => 0.5);
  blade.appearance = { t: WEAPONS.Katana, m: 7, v: 0 };
  assert.equal((await rig.build({ race: 'fprace', deps: fixtureBodyDeps(), weapon: blade })).ok, true);
  const run = () => { for (let i = 0; i < 200; i++) rig.update(0.05); };
  const spec = WG.glowSpec('fire', 2);
  rig.setSheathed(false); run();
  rig.setWeaponGlow(spec, blade);
  assert.equal(rig.weaponGlow(), spec, 'the glow laid on the look the hand holds');
  assert.equal(rig.setWeapon(blade), false, 'the hand already holds its look - no swap');
  blade.appearance = { t: WEAPONS.Saber, m: 2, v: 0 };
  const swap = rig.setWeapon(blade);
  assert.ok(swap, 'a new look is a swap');
  rig.setWeaponGlow(spec, blade);
  assert.equal(rig.weaponGlow(), null, 'mid-swap: the hand still holds the old look');
  await swap; run();
  assert.equal(rig.weaponGlow(), spec, 'the new look in hand');
});

test('APPEARANCES THE SHEET, THE CLONE AND THE HELM: the classic first-person sheet is loaded for the look the held weapon wears, its glow and its type the weapon\'s own; the Weapon Widget\'s clone is handed the look (one copy - it compares its weapon by identity); the head\'s key reads the helm drawn (mutants: the sheet\'s piece; the clone\'s piece; the helm\'s piece)', () => {
  const rig = strip(read('src/combat/weapon/weaponRig.js'));
  assert.match(rig, /function artFor\(held\) \{\s*const plain = !!glowOf\(held\);\s*const type = heldType\(held\);\s*if \(type === WEAPON_TYPES\.None\) return null;\s*const item = drawnPiece\(held\);/);
  // PIN MOVED (HAND-WRAPS, AUDIT C2): a bare fist's clone its wraps' outline
  assert.match(rig, /art: c \? artFor\(item\) : null, weapon: drawnPiece\(item\),\s*weaponType: heldType\(item\), material: drawnPiece\(item\)\?\.material \?\? -1, glow: item \? glowOf\(item\) : handGlowOf\(hand\),/);
  assert.match(strip(read('src/characters/headPortraits.js')), /const helm = drawnPiece\(entity\?\.equip \? equipTableOf\(entity\)\?\.\[EQUIP_SLOTS\.Head\] \?\? null : null\);/);
  const sword = createWeapon(WEAPONS.Longsword, 1);
  sword.appearance = { t: WEAPONS.Katana, m: 7, v: 0 };
  assert.equal(drawnPiece(sword), drawnPiece(sword), 'one copy, so the clone sees one weapon');
});
