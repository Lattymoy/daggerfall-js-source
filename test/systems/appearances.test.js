// APPEARANCES (2026-10-27; bible/04-Characters/Wardrobe.md): THE WARDROBE'S LAW AND THE CHARACTER'S LOOKS - the kinds held to
// what every renderer draws a piece with, the catalogue, the collection off the producers' own pieces, the Wardrobe's acts
// and its fee, the save, the item field and the receiver's mark - and that a look never changes a number.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as L from '../../src/net/appearanceLaw.js';
import * as A from '../../src/systems/appearances.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { setItemFields, itemBaseValue, mintCondition } from '../../src/systems/item/itemTemplates.js';
import { equipItem, unequipSlot, EQUIP_SLOTS, getItemHands, itemArmorValue } from '../../src/systems/equip.js';
import { weaponTypeForItem, plainWeaponType, WEAPON_TYPES } from '../../src/combat/fpsWeapon.js';
import { dfWeaponToMw } from '../../src/formats/morrowind/mwFirstPerson.js';
import { WEAPONS, weaponMinDamage, weaponMaxDamage, weaponSkillUsed, buildWeapon } from '../../src/characters/weapons.js';
import { SLOT_RULES } from '../../src/characters/equipRules.js';
import { RRI_CLASSES } from '../../src/systems/roleplayRealismItems/rriItems.js';
import { ARMOR_MATERIAL } from '../../src/systems/armorMaterials.js';
import { BUILDING_TYPES } from '../../src/world/buildingNames.js';
import { validItemFields } from '../../src/systems/item/itemFields.js';
import { RECEIVER_MARKS } from '../../src/net/realm/realmTradeLaw.js';
import { validLootItem } from '../../src/systems/loot/loot.js';
import { createArtifact } from '../../src/systems/loot/loot.js';
import { readMagicDef, MAGIC_ITEM_RECORD_SIZE } from '../../src/formats/magicDef.js';
import { mintGilded, DRAGONFIRE_OATH } from '../../src/systems/gilded.js';
import { createThunderlock } from '../../src/systems/thunderlock.js';
import { snapshotPlayer, restorePlayer } from '../../src/systems/save/save.js';
import { DFU_MAGIC_ITEMS } from '../dfuMagicItems.mjs';

const templates = JSON.parse(readFileSync(new URL('../../src/characters/itemTemplates.json', import.meta.url), 'utf8'));
const templateRow = (i) => (Array.isArray(templates) ? templates : Object.values(templates)).find((r) => r.index === i);
/** A piece of armour as the loot and shop mints write one (loot.js createRandomArmor's setItemFields). */
const armour = (templateIndex, material, variant = 0) => mintCondition(setItemFields({ group: 'Armor', templateIndex, material, variant }));
/** A character holding `items`, with gold. */
const who = (items, gold = 100000) => ({ items, goldPieces: gold });
/** MAGIC.DEF's bytes from DFU's table - the tree carries no ARENA2 (test/ui/fb1025_artifactdoll.test.js's craft). */
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

test('APPEARANCES THE KINDS ARE WHAT THE RENDERERS DRAW: two armour templates share a kind exactly when they take one equip slot (the doll\'s layer, the Morrowind part, Layered Gearing\'s strip), every shield one kind; two weapons exactly when their classic first-person sheet, their Morrowind group and their hands are one - so a look never changes a swing; Roleplay & Realism\'s pieces by their own slot, sheet and hands (mutants: a short blade in with the long; a War Axe in with the Battle Axe; a Flail one-handed; a pauldron\'s side crossed)', () => {
  const armourSlot = (t) => SLOT_RULES.Armor[t]?.slot ?? RRI_CLASSES[t]?.equipSlot;
  const weaponDraw = (t) => {
    const it = { group: 'Weapons', templateIndex: t };
    const cls = RRI_CLASSES[t];
    const sheet = cls ? WEAPON_TYPES[cls.weaponType(false)] : plainWeaponType(weaponTypeForItem(it));
    return `${sheet}|${dfWeaponToMw(it, WEAPONS)}|${cls ? 3 : getItemHands(it, { bowLeftHand: false })}`;
  };
  const ts = Object.keys(L.APPEARANCE_KINDS).map(Number);
  for (const a of ts) for (const b of ts) {
    const ga = L.groupOfTemplate(a), gb = L.groupOfTemplate(b);
    if (ga !== gb) { assert.notEqual(L.APPEARANCE_KINDS[a], L.APPEARANCE_KINDS[b], `${a} ${b}: a weapon is never armour`); continue; }
    const same = ga === 'Armor' ? armourSlot(a) === armourSlot(b) : weaponDraw(a) === weaponDraw(b);
    assert.equal(L.APPEARANCE_KINDS[a] === L.APPEARANCE_KINDS[b], same, `${a} and ${b}`);
  }
  assert.equal(new Set(ts.filter((t) => L.APPEARANCE_KINDS[t] === 'shield')).size, 4, 'the four shields one kind');
  assert.deepEqual(L.LOOK_TEMPLATES, [102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130], 'DFU\'s own armour and weapons, no arrow, no mod\'s');
  assert.deepEqual([...new Set(Object.values(L.APPEARANCE_KINDS))].filter((k) => k !== 'lightFlail').sort(), [...L.LOOK_KIND_ORDER].sort(), 'every kind a look is of is listed once');
  for (const t of [102, 103, 104, 105, 106, 107, 108]) assert.equal(L.LOOK_VARIANTS[t], templateRow(t).variants, `${t}'s styles are its template's`);
  for (const t of L.LOOK_TEMPLATES.filter((x) => !(x in L.LOOK_VARIANTS))) assert.equal(templateRow(t).variants ?? 0, 0, `${t} has one style`);
});

test('APPEARANCES THE CATALOGUE: every look there is - each template\'s materials (leather, chain and ten plates; ten metals for a weapon) and the styles SetVariant\'s clamp draws, a look twice never; 473 in all (mutants: Chain2 a look of its own; a helm\'s styles clamped; a shield given styles; the dagger a short blade)', () => {
  const byKind = {};
  for (const a of L.ALL_LOOKS) byKind[a.kind] = (byKind[a.kind] ?? 0) + 1;
  // PIN MOVED (AUDIT HORIZONTAL E3): 474 -> 473 - chain boots' second style, which no mint makes, is no look (feet 23 -> 22)
  assert.deepEqual(byKind, { head: 72, rightArm: 32, leftArm: 32, chest: 32, hands: 12, legs: 43, feet: 22, shield: 48, dagger: 10, shortBlade: 30, longBlade: 40, greatBlade: 20, axe: 10, greatAxe: 10, mace: 10, flail: 10, warhammer: 10, staff: 10, bow: 20 });
  assert.equal(L.ALL_LOOKS.length, 473);
  assert.equal(new Set(L.ALL_LOOKS.map(L.lookCode)).size, 473, 'no look twice');
  assert.deepEqual(L.lookVariants(102, ARMOR_MATERIAL.Daedric), [1, 2, 3], 'a plate cuirass: three styles');
  assert.deepEqual(L.lookVariants(102, ARMOR_MATERIAL.Leather), [0]);
  assert.deepEqual(L.lookVariants(104, ARMOR_MATERIAL.Leather), [0, 1], 'leather greaves: two');
  assert.deepEqual(L.lookVariants(104, ARMOR_MATERIAL.Iron), [2, 3, 4, 5]);
  assert.deepEqual(L.lookVariants(107, ARMOR_MATERIAL.Chain), [0, 1, 2, 3, 4, 5], 'a helm: six, whatever its metal');
  assert.deepEqual(L.lookVariants(108, ARMOR_MATERIAL.Chain), [1], 'chain boots: the one style a mint makes (AUDIT HORIZONTAL E3)');
  assert.deepEqual(L.lookVariants(112, ARMOR_MATERIAL.Ebony), [0]);
  assert.equal(L.lookOfKey('102.259.4'), null, 'Chain2 is no look of its own');
  assert.equal(L.lookOfKey('131.0.0'), null, 'an arrow is none');
});

test('APPEARANCES A PIECE IS ITS LOOK: the producers\' own pieces - a weapon, a piece of armour of each family, a style past its clamp - read as the look they draw; an artifact\'s and a Gilded piece\'s own art, an arrow, a gun and a mod\'s piece are none (mutants: the clamp unread; Chain2 its own; an artifact collected; a Gilded piece collected)', () => {
  assert.deepEqual(L.lookOfPiece(createWeapon(WEAPONS.Katana, 7)), { t: 121, m: 7, v: 0, kind: 'longBlade' });
  assert.deepEqual(L.lookOfPiece(armour(102, ARMOR_MATERIAL.Iron, 0)), { t: 102, m: 0x200, v: 1, kind: 'chest' }, 'loot\'s variant 0 draws style 1 (SetVariant)');
  assert.deepEqual(L.lookOfPiece(armour(102, ARMOR_MATERIAL.Chain2, 2)), { t: 102, m: 0x100, v: 4, kind: 'chest' }, 'Chain2 draws as chain');
  assert.deepEqual(L.lookOfPiece(armour(107, ARMOR_MATERIAL.Steel, 5)), { t: 107, m: 0x201, v: 5, kind: 'head' });
  const past = armour(107, ARMOR_MATERIAL.Steel, 0); past.variant = 9;   // a style past the helm's six (a classic save's byte, a peer's word)
  assert.deepEqual(L.lookOfPiece(past), { t: 107, m: 0x201, v: 5, kind: 'head' }, 'drawn as its last style');
  assert.equal(L.lookVariant(107, ARMOR_MATERIAL.Steel, 9), 5);
  assert.equal(L.lookOfPiece(artifact('The Mehrunes Razor')), null, 'an artifact wears its own record');
  assert.equal(L.lookOfPiece(mintGilded(DRAGONFIRE_OATH)), null, 'a Gilded piece its own gold');
  assert.equal(L.lookOfPiece(createThunderlock()), null, 'a gun has one look');
  assert.equal(L.lookOfPiece({ ...createWeapon(WEAPONS.Dagger, 0), group: 'Armor' }), null, 'a group that is not its template\'s');
  assert.equal(L.lookOfPiece(setItemFields({ group: 'Armor', templateIndex: 520, material: 0 })), null, 'Roleplay & Realism\'s jerkin is no look');
});

test('APPEARANCES THE SWEEP: every look in the pack, the wagon and the Materials Bag is collected, once, in the catalogue\'s order, the list replaced and never pushed to; a piece re-read when its metal changes; a save carries the list and a load restores it (mutants: the wagon unread; the bag unread; the list pushed; a record never read again; the save\'s field dropped)', () => {
  const sword = createWeapon(WEAPONS.Longsword, 1), helm = armour(107, ARMOR_MATERIAL.Daedric, 2), bow = createWeapon(WEAPONS.Long_Bow, 5);
  const me = { ...who([helm, sword]), wagonItems: [bow], bagItems: [armour(112, ARMOR_MATERIAL.Leather)] };
  assert.equal(A.noteHeldLooks(me), 4);
  assert.deepEqual(me.appearances, ['107.521.2', '112.0.0', '120.1.0', '130.5.0'], 'head, shield, then the weapons - the catalogue\'s order');
  const was = me.appearances;
  assert.equal(A.noteHeldLooks(me), 0, 'nothing new');
  assert.equal(me.appearances, was);
  sword.material = 9;
  assert.equal(A.noteHeldLooks(me), 1, 'a piece whose metal changed is read again');
  assert.notEqual(me.appearances, was, 'a new list');
  assert.deepEqual(was, ['107.521.2', '112.0.0', '120.1.0', '130.5.0'], 'the old one untouched - a save\'s copy may share it');
  assert.deepEqual(me.appearances, ['107.521.2', '112.0.0', '120.1.0', '120.9.0', '130.5.0']);
  assert.deepEqual(A.looksCount(me), { held: 5, total: 473 });   // PIN MOVED (AUDIT HORIZONTAL E3): 473 looks
  me.appearances = ['120.1.0', 'nonsense', '999.0.0', 7];
  assert.deepEqual([...A.appearancesOf(me)], ['120.1.0'], 'a save\'s list read as looks there are');
  // the save
  const e = { name: 'Ysolde', race: 'Breton', gender: 'female', items: [sword], appearances: ['120.1.0', '107.521.2'], chargenDone: true };
  const snap = snapshotPlayer(e, { position: [0, 0, 0], pose: { yaw: 0, pitch: 0 }, classicMinutes: 0 });
  assert.deepEqual(snap.appearances, ['120.1.0', '107.521.2'], 'the envelope carries them');
  const back = {};
  restorePlayer(back, JSON.parse(JSON.stringify(snap)));
  assert.deepEqual(back.appearances, ['120.1.0', '107.521.2'], 'and a load restores them');
  assert.match(readFileSync(new URL('../../src/systems/save/save.js', import.meta.url), 'utf8'), /\n {2}'appearances',\n\];/, 'a field of ENTITY_FIELDS, copied both ways');
  assert.match(readFileSync(new URL('../../src/ui/hud/hud.js', import.meta.url), 'utf8'), /drawRevenantCards\(\{ hidden: cursorActive[^\n]*\n {2}try \{ noteHeldLooks\(vitals\); \}[^\n]*\n {2}\/\/ LOOT-BANNER:/, 'swept once a frame on the HUD\'s one call, outside the skin\'s gate as the loot watcher is - every host, every skin');
});

test('APPEARANCES A LOOK WORN: of its kind only, off the item or the wire; the piece drawn as it - one copy a piece and look, made again when the slot or the look changes - its dye its metal\'s, an artifact\'s and a Gilded piece\'s own art dropped, its enchantments kept (mutants: the kind unchecked; the memo never kept; the memo never renewed; the dye kept; the artifact kept)', () => {
  // a weapon carrying its metal's dyeColor - the shape itemDye.js reads first where a piece has one (characters/weapons.js buildWeapon's)
  const sword = Object.assign(createWeapon(WEAPONS.Longsword, 1), { dyeColor: buildWeapon(WEAPONS.Longsword, 1).dyeColor });
  assert.equal(L.drawnPiece(sword), sword, 'a piece in its own look is itself');
  sword.appearance = { t: WEAPONS.Claymore, m: 9, v: 0 };
  assert.equal(L.appearanceOf(sword), null, 'a two-handed blade is not a longsword\'s look');
  assert.equal(L.drawnPiece(sword), sword);
  sword.appearance = { t: WEAPONS.Katana, m: 9, v: 0 };
  sword.equipSlot = EQUIP_SLOTS.RightHand;
  const d = L.drawnPiece(sword);
  assert.deepEqual([d.templateIndex, d.material, d.variant, d.equipSlot], [121, 9, 0, EQUIP_SLOTS.RightHand]);
  assert.ok(!('appearance' in d) && !('dyeColor' in d), 'its dye follows the look\'s metal');
  assert.equal(L.drawnPiece(sword), d, 'one copy while nothing it read changed');
  sword.equipSlot = EQUIP_SLOTS.LeftHand;
  assert.notEqual(L.drawnPiece(sword), d, 'a new hand, a new copy');
  assert.equal(L.drawnPiece(sword).equipSlot, EQUIP_SLOTS.LeftHand);
  const left = L.drawnPiece(sword);
  sword.appearance = { t: WEAPONS.Saber, m: 5, v: 0 };
  assert.equal(L.drawnPiece(sword).templateIndex, WEAPONS.Saber, 'a new look, a new copy');
  assert.notEqual(L.drawnPiece(sword), left);
  assert.deepEqual(L.appearanceOf({ group: 'Weapons', templateIndex: WEAPONS.Longsword, ap: [119, 5, 0] }), { t: 119, m: 5, v: 0, kind: 'longBlade' }, 'the wire\'s `ap`');
  assert.equal(L.appearanceOf({ group: 'Weapons', templateIndex: WEAPONS.Longsword, ap: [119, 5] }), null);
  assert.equal(L.appearanceOf({ group: 'Weapons', templateIndex: WEAPONS.Longsword, appearance: { t: 119, m: 5, v: 1 } }), null, 'a style a weapon never draws');
  // an artifact wears a plain look: its record and its flag off the copy, its enchantments on it
  const razor = artifact('The Mehrunes Razor');
  razor.appearance = { t: WEAPONS.Dagger, m: 1, v: 0 };
  const rd = L.drawnPiece(razor);
  assert.equal(rd.artifact, undefined);
  assert.equal(rd.playerTextureRecord, undefined);
  assert.equal(rd.enchantments, razor.enchantments, 'its enchantments are its own - the enchanted sheet still swings');
  const oath = mintGilded(DRAGONFIRE_OATH);
  oath.appearance = { t: WEAPONS.Claymore, m: 3, v: 0 };
  assert.equal(L.drawnPiece(oath).rarity, undefined, 'a Gilded piece\'s gold is not the look\'s');
  assert.equal(L.drawnPiece(oath).gilded, undefined);
});

test('APPEARANCES A LOOK NEVER CHANGES A NUMBER: a weapon wearing any look of its kind keeps its damage, its skill, its hands, its value and its swing\'s sheet; a piece of armour its armour value and its value; and the drawn copy swings as the piece does - every look of every weapon kind (mutants: the kinds\' table moved a template; a number read off the drawn copy)', () => {
  for (const kind of L.LOOK_KIND_ORDER) {
    const looks = L.ALL_LOOKS.filter((a) => a.kind === kind);
    for (const t of new Set(looks.map((a) => a.t))) {
      const piece = L.groupOfTemplate(t) === 'Weapons' ? createWeapon(t, 1) : armour(t, ARMOR_MATERIAL.Steel, 2);
      const before = piece.group === 'Weapons'
        ? [weaponMinDamage(piece), weaponMaxDamage(piece), weaponSkillUsed(piece.templateIndex), getItemHands(piece), itemBaseValue(piece), weaponTypeForItem(piece)]
        : [itemArmorValue(piece), itemBaseValue(piece)];
      for (const look of looks) {
        piece.appearance = { t: look.t, m: look.m, v: look.v };
        const after = piece.group === 'Weapons'
          ? [weaponMinDamage(piece), weaponMaxDamage(piece), weaponSkillUsed(piece.templateIndex), getItemHands(piece), itemBaseValue(piece), weaponTypeForItem(piece)]
          : [itemArmorValue(piece), itemBaseValue(piece)];
        assert.deepEqual(after, before, `${t} wearing ${L.lookCode(look)}`);
        const drawn = L.drawnPiece(piece);
        if (piece.group === 'Weapons') {
          assert.equal(weaponTypeForItem(drawn), weaponTypeForItem(piece), `${t} as ${L.lookCode(look)}: the same sheet`);
          assert.equal(getItemHands(drawn), getItemHands(piece), 'the same hands');
          assert.equal(dfWeaponToMw(drawn, WEAPONS), dfWeaponToMw(piece, WEAPONS), 'the same Morrowind group');
        }
      }
    }
  }
});

test('APPEARANCES THE WARDROBE: its shops DFU\'s Clothing Store, Armorer and Weaponsmith; a worn piece takes a collected look of its kind for a twentieth of the look\'s worth (25 gold the least), its own back for nothing - and every refusal in its word, nothing taken (mutants: a General Store\'s; the fee\'s share; the fee\'s floor; an unworn piece dressed; an uncollected look worn; the gold not taken; the clear charged)', () => {
  assert.deepEqual(A.WARDROBE_SHOPS, [BUILDING_TYPES.ClothingStore, BUILDING_TYPES.Armorer, BUILDING_TYPES.WeaponSmith]);
  assert.equal(A.isWardrobeShop(BUILDING_TYPES.GeneralStore), false);
  assert.equal(A.wardrobeFee(L.lookOfKey('102.521.1')), 7680, 'a Daedric cuirass: 153,600 / 20');
  assert.equal(A.wardrobeFee(L.lookOfKey('120.7.0')), 288, 'an Ebony longsword: 5,760 / 20');
  assert.equal(A.wardrobeFee(L.lookOfKey('113.0.0')), 25, 'an Iron dagger: the floor');
  assert.equal(A.wardrobeFee(L.lookOfKey('107.513.2')), 25, 'a Steel helm, 480 / 20 = 24: the floor');
  assert.equal(A.wardrobeFee(L.lookOfKey('107.514.2')), 48, 'a Silver helm: 960 / 20');
  const sword = createWeapon(WEAPONS.Longsword, 1), katana = createWeapon(WEAPONS.Katana, 7), claymore = createWeapon(WEAPONS.Claymore, 9);
  const me = who([sword, katana, claymore], 1000);
  A.noteHeldLooks(me);
  const ebonyKatana = L.lookOfKey('121.7.0');
  assert.equal(A.wearRefusal(me, sword, ebonyKatana), 'worn', 'a piece in the pack is not worn');
  equipItem(me, sword);
  assert.deepEqual(A.wardrobePieces(me).map((p) => [p.slot, p.kind]), [[EQUIP_SLOTS.RightHand, 'longBlade']]);
  assert.deepEqual(A.looksForPiece(me, sword), [ebonyKatana], 'its kind\'s collected looks, never its own, never the claymore\'s');
  assert.equal(A.wearRefusal(me, sword, L.lookOfKey('122.9.0')), 'kind');
  assert.equal(A.wearRefusal(me, sword, L.lookOfKey('120.1.0')), 'own');
  assert.equal(A.wearRefusal(me, sword, L.lookOfKey('119.2.0')), 'uncollected');
  assert.equal(A.wearRefusal(me, sword, { t: 120, m: 1 }), 'look');
  assert.equal(A.wearRefusal(me, sword, ebonyKatana), null);
  const done = A.wearAppearance(me, sword, ebonyKatana);
  assert.deepEqual(done, { ok: true, reason: null, fee: 480 }, 'an Ebony katana: 9,600 / 20');
  assert.equal(me.goldPieces, 520, 'its fee taken');
  assert.deepEqual(sword.appearance, { t: 121, m: 7, v: 0 });
  assert.deepEqual(A.wearAppearance(me, sword, ebonyKatana), { ok: false, reason: 'same', fee: 0 });
  assert.equal(me.goldPieces, 520);
  assert.deepEqual(A.clearAppearance(me, sword), { ok: true, reason: null });
  assert.equal(me.goldPieces, 520, 'its own back costs nothing');
  assert.equal(sword.appearance, undefined);
  assert.deepEqual(A.clearAppearance(me, sword), { ok: false, reason: 'none' });
  me.goldPieces = 479;
  assert.equal(A.wearRefusal(me, sword, ebonyKatana), 'gold');
  assert.deepEqual(A.wearAppearance(me, sword, ebonyKatana), { ok: false, reason: 'gold', fee: 0 });
  assert.equal(me.goldPieces, 479, 'nothing taken');
  me.goldPieces = 1000;
  A.wearAppearance(me, sword, ebonyKatana);
  unequipSlot(me, EQUIP_SLOTS.RightHand);
  assert.deepEqual(sword.appearance, { t: 121, m: 7, v: 0 }, 'taken off, the piece keeps its look - worn again, it wears it');
  assert.deepEqual(A.clearAppearance(me, sword), { ok: false, reason: 'worn' });
});

test('APPEARANCES THE WORDS: a look named by its metal (past the helm and shield gate) and its style where its metal draws more than one; a kind and a slot their page\'s names (mutants: the style 0-based; a style said of a one-style look; the metal dropped)', () => {
  assert.equal(A.lookName(L.lookOfKey('102.513.2')), 'Steel Cuirass, style 2');
  assert.equal(A.lookName(L.lookOfKey('102.0.0')), 'Leather Cuirass');
  assert.equal(A.lookName(L.lookOfKey('107.256.3')), 'Chain Helm, style 4');
  assert.equal(A.lookName(L.lookOfKey('104.512.5')), 'Iron Greaves, style 4');
  assert.equal(A.lookName(L.lookOfKey('112.521.0')), 'Daedric Tower Shield');
  assert.equal(A.lookName(L.lookOfKey('123.9.0')), 'Daedric Dai-katana');
  assert.equal(A.kindName('greatBlade'), 'Two-handed blades');
  assert.equal(A.slotName(EQUIP_SLOTS.LeftHand), 'Left hand');
  const groups = A.lookGroups(who([]));
  assert.deepEqual(groups.map((g) => g.kind), [...L.LOOK_KIND_ORDER]);
  assert.equal(groups.reduce((n, g) => n + g.total, 0), 473);   // PIN MOVED (AUDIT HORIZONTAL E3)
});

test('APPEARANCES THE FIELD AND THE MARK: `appearance` a declared item field, `{ t, m, v }` a look there is; the wearer\'s mark - a piece off the wire, a realm trade\'s record or a wild death\'s arrives in its own look (mutants: the field undeclared; a stray key passed; the mark not stripped)', () => {
  const sword = createWeapon(WEAPONS.Longsword, 1);
  sword.appearance = { t: 121, m: 7, v: 0 };
  assert.ok(validItemFields({ ...sword }), 'a look there is');
  assert.equal(validItemFields({ ...sword, appearance: { t: 121, m: 7, v: 0, x: 1 } }), null, 'a stray key');
  assert.equal(validItemFields({ ...sword, appearance: { t: 131, m: 0, v: 0 } }), null, 'no look');
  assert.equal(validItemFields({ ...sword, appearance: [121, 7, 0] }), null, 'the wire\'s shape is not the field\'s');
  assert.ok(RECEIVER_MARKS.includes('appearance'));
  const over = validLootItem(JSON.parse(JSON.stringify(sword)));
  assert.ok(over, 'the piece crosses');
  assert.equal('appearance' in over, false, 'in its own look');
});
