// APPEARANCES (2026-10-27; bible/04-Characters/Wardrobe.md): OTHER PLAYERS SEE THE LOOK. A look's item carries the look its
// piece wears as `ap` beside the piece's own fields - omitted when none, so every look without one keeps its bytes - the
// relay keeps it only of the piece's kind, and the peer's stand-in draws it. The piece's own fields never change: the
// siege's referee still finds the weapon a blow claims.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeLook, peerStubEntity, lookKey, LOOK_ITEM_FIELDS } from '../../src/net/remotePlayers.js';
import { validLook, validLookItem } from '../../src/net/wire.js';
import { drawnPiece } from '../../src/net/appearanceLaw.js';
import { siegeHeld } from '../../src/net/siege/siegeRef.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { setItemFields, mintCondition } from '../../src/systems/item/itemTemplates.js';
import { equipItem, EQUIP_SLOTS } from '../../src/systems/equip.js';
import { WEAPONS } from '../../src/characters/weapons.js';
import { ARMOR_MATERIAL } from '../../src/systems/armorMaterials.js';
import { dfWornEquipment } from '../../src/formats/morrowind/mwItemMap.js';
import { ARMOR_ENUM } from '../../src/combat/enemyEquipment.js';
import { outfitOfItems, outfitPieces } from '../../src/player/eyeOfTheBeholder/layeredArmor.js';

const armour = (templateIndex, material, variant = 0) => mintCondition(setItemFields({ group: 'Armor', templateIndex, material, variant }));
/** A player wearing a Steel longsword as an Ebony katana, an Iron cuirass as leather, and a plain Steel helm. */
function dressed() {
  const sword = createWeapon(WEAPONS.Longsword, 1), chest = armour(102, ARMOR_MATERIAL.Iron, 2), helm = armour(107, ARMOR_MATERIAL.Steel, 1);
  const me = { isPlayer: true, race: 'Breton', gender: 'male', faceIndex: 0, items: [sword, chest, helm] };
  for (const it of me.items) equipItem(me, it);
  sword.appearance = { t: WEAPONS.Katana, m: 7, v: 0 };
  chest.appearance = { t: 102, m: ARMOR_MATERIAL.Leather, v: 0 };
  return { me, sword, chest, helm };
}

test('APPEARANCES A LOOK SAYS IT: a piece wearing a look carries `ap` [t, m, v] beside its own six fields, unchanged; a piece in its own look carries none - its bytes as they were; the relay keeps `ap` only of the piece\'s kind and of a look there is (mutants: `ap` always written; the piece\'s fields swapped for the look\'s; the kind unchecked at the relay; `ap` dropped by the relay)', () => {
  const { me, sword, helm } = dressed();
  const look = composeLook(me);
  const s = look.items.find((i) => i.equipSlot === EQUIP_SLOTS.RightHand);
  assert.deepEqual([s.templateIndex, s.material, s.ap], [WEAPONS.Longsword, 1, [121, 7, 0]], 'its own fields, and the look beside them');
  const h = look.items.find((i) => i.templateIndex === helm.templateIndex);
  assert.equal('ap' in h, false, 'a piece in its own look says none');
  assert.deepEqual(Object.keys(validLookItem(h)).sort(), ['equipSlot', 'group', 'material', 'templateIndex', 'variant'], 'and keeps the bytes it had');
  const kept = validLook(look);
  assert.deepEqual(kept.items.find((i) => i.equipSlot === EQUIP_SLOTS.RightHand).ap, [121, 7, 0], 'the relay keeps it');
  assert.equal('ap' in validLookItem({ ...s, ap: [122, 7, 0] }), false, 'a claymore\'s look on a longsword: dropped');
  assert.equal('ap' in validLookItem({ ...s, ap: [121, 7] }), false, 'malformed: dropped');
  assert.equal('ap' in validLookItem({ ...s, ap: [121, 7, 0, 0] }), false, 'four numbers: dropped');
  assert.equal('ap' in validLookItem({ ...s, ap: [121, 7, 1] }), false, 'a style a weapon never draws: dropped');
  assert.equal('ap' in validLookItem({ ...s, ap: { t: 121, m: 7, v: 0 } }), false, 'the item field\'s shape is not the wire\'s');
  assert.ok(validLookItem({ ...s, ap: [122, 7, 0] }), 'the piece itself is never refused for it');
  void sword;
});

test('APPEARANCES THE PEERS DRAW IT: the stand-in\'s item wears the look as its own field, so the doll, the Morrowind body and Layered Gearing draw it through drawnPiece; the look\'s cache key changes with it and a look without one keeps the key it had; the siege\'s referee finds the weapon the blow claims (mutants: the stand-in drops it; the key blind to it; the key changed for every look)', () => {
  const { me, chest } = dressed();
  const look = validLook(composeLook(me));
  const stub = peerStubEntity(look);
  const held = stub.equip.slots[EQUIP_SLOTS.RightHand];
  assert.deepEqual(held.appearance, { t: 121, m: 7, v: 0 });
  assert.deepEqual([drawnPiece(held).templateIndex, drawnPiece(held).material], [121, 7], 'drawn as the look');
  const worn = dfWornEquipment(stub.equip.slots, EQUIP_SLOTS, ARMOR_ENUM);
  assert.deepEqual(worn.find((p) => p.templateIndex === 102), { templateIndex: 102, material: ARMOR_MATERIAL.Leather, kind: 'armor' }, 'the Morrowind body dressed as the look');
  assert.deepEqual(outfitPieces(outfitOfItems(look.items)), { head: 'p1', top: 'l', legs: 'l', cloak: null, shield: null, weapon: null, offhand: null, spell: null, stage: null }, 'Layered Gearing: a Steel helm in its own look, a leather top');
  const bare = { ...look, items: look.items.map(({ ap, ...rest }) => { void ap; return rest; }) };
  const oldKey = (l) => `${l?.race ?? 'Breton'}|${l?.gender ?? 'male'}|${l?.faceIndex ?? 0}|${JSON.stringify((l?.items ?? []).map((it) => LOOK_ITEM_FIELDS.map((k) => it[k] ?? null)))}`;
  assert.equal(lookKey(bare), oldKey(bare), 'a look without one keeps the key it had');
  assert.notEqual(lookKey(look), lookKey(bare), 'a look worn is a new key - the peer is drawn again');
  assert.deepEqual(siegeHeld(look, WEAPONS.Longsword, 1), { w: WEAPONS.Longsword, m: 1 }, 'the referee reads the piece');
  assert.equal(siegeHeld(look, WEAPONS.Katana, 7), null, 'never the look');
  void chest;
});
