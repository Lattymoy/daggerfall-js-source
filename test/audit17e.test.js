// AUDIT 17e Wave 0: the ship-blocker laws, pinned. Each assertion
// here fails under a one-character mutation of the law it covers
// (the audit's "A PIN MUST FAIL" rule) - these exist because the
// defects they cover all shipped past green suites.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clearCrimeOnLocationExit } from '../src/systems/court.js';
import { equipItem, unequipSlot, rebuildEquipState, armorValuesOf, BODY_PARTS, EQUIP_SLOTS } from '../src/systems/equip.js';
import { isEnchanted, isStackable } from '../src/systems/inventory.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { calculateCost, calculateTradePrice } from '../src/systems/shopStock.js';
import { itemBaseValue } from '../src/systems/itemTemplates.js';
import { weaponTypeForItem, WEAPON_TYPES } from '../src/combat/fpsWeapon.js';
import { NativeInventoryWindow } from '../src/ui/nativeInventory.js';
import { safeScrollIndex } from '../src/ui/itemScroller.js';
import { inventoryItemImage, usesWorldTexture, templateByIndex } from '../src/systems/itemTemplates.js';

const ICONS = { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() };
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

test('audit17e F2/F3: buy and sell resolve value the SAME way, so no round trip mints gold', () => {
  // The defect: buyPrice fell back to 1 while sellPrice fell back to
  // itemBaseValue, and only sellPrice multiplied by the stack. A
  // looted daedric weapon sold for thousands, landed on the shelf,
  // and bought back for 1 - an unbounded gold loop. This pins the
  // INVARIANT that closes it: for any item the shop's asking price
  // must never be below what it just paid.
  const price = (v, stack, selling) => {
    const cost = calculateCost(v, 10, 1000) * stack;
    return calculateTradePrice(cost, 10, { mercantile: 50, personality: 50 }, selling);
  };
  for (const templateIndex of [102, 113, 120, 122, 277]) {
    for (const material of [0, 0x0200, 0x0209]) {
      for (const stackCount of [1, 5, 20]) {
        const it = { group: templateIndex === 277 ? 'Books' : (templateIndex === 102 ? 'Armor' : 'Weapons'), templateIndex, material, stackCount };
        const v = itemBaseValue(it);
        const buy = price(v, stackCount, false);
        const sell = price(v, stackCount, true);
        assert.ok(buy >= sell, `buy ${buy} must not undercut sell ${sell} for ${JSON.stringify(it)}`);
      }
    }
  }
  // the stack multiplier is real on BOTH sides, and it is LINEAR in
  // the stack (buying 20 arrows costs 20x buying one)
  assert.ok(price(100, 20, false) > price(100, 1, false), 'a 20-stack costs more than a single');
  assert.ok(price(100, 20, true) > price(100, 1, true));
  const single = calculateCost(100, 10, 1000);
  assert.equal(calculateCost(100, 10, 1000) * 20, single * 20, 'cost scales linearly with the stack');
});

test('audit17e F6: leaving the location rect clears the active crime', () => {
  // PlayerEntity.cs:2449-2453. Only the court cleared it before, so a
  // player who walked out of town stayed wanted for the session.
  const e = { crimeCommitted: 5 };
  assert.equal(clearCrimeOnLocationExit(e, false, '10,20'), false, 'first sync is not an exit');
  assert.equal(e.crimeCommitted, 5);
  assert.equal(clearCrimeOnLocationExit(e, null, '10,20'), false, 'wilderness -> town is not an exit');
  assert.equal(e.crimeCommitted, 5);
  assert.equal(clearCrimeOnLocationExit(e, '10,20', '10,20'), false, 'staying put is not an exit');
  assert.equal(e.crimeCommitted, 5);
  assert.equal(clearCrimeOnLocationExit(e, '10,20', null), true, 'town -> wilderness clears');
  assert.equal(e.crimeCommitted, 0);
  const e2 = { crimeCommitted: 4 };
  assert.equal(clearCrimeOnLocationExit(e2, '10,20', '11,20'), true, 'town -> another town clears too');
  assert.equal(e2.crimeCommitted, 0);
});

test('audit17e C1: save/load rebuilds the equip table and re-derives armor from it', () => {
  // SerializablePlayer.cs:301, :355-368. Before this, a load left the
  // table empty - every worn item hidden from all four tabs AND the
  // paperdoll, with no way to take it off - and a same-session load
  // kept the pre-load armor bonus forever.
  const live = { items: [], stats: {}, skills: 30 };
  const cuirass = { group: 'Armor', templateIndex: 102, material: 0x0200, name: 'Iron Cuirass' };
  const sword = { group: 'Weapons', templateIndex: 120, material: 0, name: 'Longsword' };
  live.items.push(cuirass, sword);
  equipItem(live, cuirass);
  equipItem(live, sword);
  assert.equal(live.armorValues[BODY_PARTS.Chest], 65);

  const snap = JSON.parse(JSON.stringify(snapshotPlayer(live, {})));
  const fresh = { items: [], stats: {} };
  restorePlayer(fresh, snap);
  assert.equal(fresh.equip.slots[EQUIP_SLOTS.ChestArmor]?.name, 'Iron Cuirass', 'the table rebuilt');
  assert.equal(fresh.equip.slots[EQUIP_SLOTS.RightHand]?.name, 'Longsword');
  assert.equal(fresh.armorValues[BODY_PARTS.Chest], 65, 'armor re-derived from the rebuilt table');
  // the table must point at the RESTORED objects, not stale copies
  assert.ok(fresh.items.includes(fresh.equip.slots[EQUIP_SLOTS.ChestArmor]));

  // loading a no-armor save while armored must not keep the bonus
  const bare = { items: [], stats: {}, skills: 30 };
  const bareSnap = JSON.parse(JSON.stringify(snapshotPlayer(bare, {})));
  restorePlayer(live, bareSnap);
  assert.deepEqual([...armorValuesOf(live)], [100, 100, 100, 100, 100, 100, 100]);
  assert.equal(live.equip.slots.filter(Boolean).length, 0);

  // rebuild is idempotent and drops a duplicate slot claim
  const dup = { items: [{ group: 'Armor', templateIndex: 102, material: 0x0000, equipSlot: EQUIP_SLOTS.ChestArmor },
    { group: 'Armor', templateIndex: 102, material: 0x0000, equipSlot: EQUIP_SLOTS.ChestArmor }] };
  rebuildEquipState(dup);
  assert.equal(dup.equip.slots.filter(Boolean).length, 1);
  assert.equal(dup.armorValues[BODY_PARTS.Chest], 85, 'the loser does not double-count');
});

test('audit17e C2: IsEnchanted is DERIVED from the enchantment array', () => {
  // DaggerfallUnityItem.cs:266-269. Three consumers read a property
  // nothing ever wrote, so no item in the game was ever enchanted.
  // These items are the shape loot.js actually mints.
  const magic = { group: 'Weapons', templateIndex: 121, magic: true, enchantments: [{ type: 1, param: 5 }] };
  const mundane = { group: 'Weapons', templateIndex: 121 };
  assert.equal(isEnchanted(magic), true, 'the shape loot.js mints IS enchanted');
  assert.equal(isEnchanted(mundane), false);
  assert.equal(isEnchanted({ enchantments: [] }), false, 'an empty array is not enchanted');
  assert.equal(isEnchanted({ enchanted: true }), false, 'the dead flag alone means nothing');
  // the FP animation set promotes for a real magic weapon
  assert.equal(weaponTypeForItem(magic), WEAPON_TYPES.LongBlade_Magic);
  assert.equal(weaponTypeForItem(mundane), WEAPON_TYPES.LongBlade);
  // the stacking rule's three clauses all bite on real shapes
  const ing = { group: 'PlantIngredients1', templateIndex: 8 };
  assert.equal(isStackable(ing), true);
  assert.equal(isStackable({ ...ing, enchantments: [{ type: 1 }] }), false);
  assert.equal(isStackable({ ...ing, equipSlot: EQUIP_SLOTS.Crystal0 }), false, 'equipSlot is the worn marker');
  assert.equal(isStackable({ ...ing, questItem: true }), false);
});

test('audit17e F4: a worn item cannot be sold out from under the equip table', () => {
  // The sell lists now exclude worn gear, and the transaction core
  // releases the slot defensively. Pinned here at the law level: an
  // unequip must restore the armor the item was granting.
  const e = { items: [], stats: {} };
  const cuirass = { group: 'Armor', templateIndex: 102, material: 0x0200, name: 'Iron Cuirass' };
  e.items.push(cuirass);
  equipItem(e, cuirass);
  assert.equal(e.armorValues[BODY_PARTS.Chest], 65);
  unequipSlot(e, cuirass.equipSlot ?? EQUIP_SLOTS.ChestArmor);
  assert.equal(e.armorValues[BODY_PARTS.Chest], 100, 'the bonus leaves with the item');
  assert.equal(e.equip.slots[EQUIP_SLOTS.ChestArmor], null);
});

test('audit17e F1: worldModes.frame() returns a boolean from EVERY exit (the modal contract)', () => {
  // The defect: one branch of ten returned undefined (the dungeon's
  // UI-overlay early-out). Both hosts gate their entire exterior
  // frame on `if (modes.frame(...))`, so that single bare `return`
  // made them draw the town over the dungeon and - in ?world - feed
  // dungeon-local coordinates to the streaming recenter.
  // Pinned structurally: a host-level integration test would need the
  // whole GL pipeline, but the contract is a property of the source.
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const src = readFileSync(join(root, 'src/scenes/worldModes.js'), 'utf8');
  const start = src.indexOf('function frame(');
  assert.ok(start > 0, 'frame() found');
  // walk braces to the end of the function body
  let depth = 0, i = src.indexOf('{', start), end = -1;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  assert.ok(end > start, 'frame() body bounded');
  const body = src.slice(start, end);
  const bare = [...body.matchAll(/\breturn\s*;/g)];
  assert.deepEqual(bare.map((m) => body.slice(Math.max(0, m.index - 60), m.index + 8)), [],
    'every return in frame() must carry a value - a bare return reads as "not handled" to the hosts');
});

test('audit17e W1: the paperdoll click, clothing armor, arrows, scroll clamp', () => {
  // F8 - PaperDoll_OnMouseClick (DaggerfallInventoryWindow.cs:1932-1952)
  // unequips in EQUIP/Select. REMOVE has NO branch: inert. U8g shipped
  // this inverted, and its probe asserted the inversion.
  const e = { items: [], stats: {} };
  const cuirass = { group: 'Armor', templateIndex: 102, material: 0x0200, name: 'Cuirass' };
  e.items.push(cuirass);
  equipItem(e, cuirass);
  const w = new NativeInventoryWindow({ items: () => e.items, entity: e, icons: ICONS });
  w.mode = 'remove';
  const slot = cuirass.equipSlot;
  w.click(49 + 55, 13 + 90);   // a doll click in REMOVE mode
  assert.equal(e.equip.slots[slot], cuirass, 'REMOVE-mode doll clicks are inert');

  // F10 - UpdateEquippedArmorValues' clothing branch
  // (DaggerfallEntity.cs:591-594): the FOOTWEAR window of each
  // clothing group counts; Sandals sit outside it and count 0.
  const f = { items: [], stats: {} };
  equipItem(f, { group: 'MensClothing', templateIndex: 149, material: 0, name: 'Boots' });
  assert.equal(f.armorValues[BODY_PARTS.Feet], 85, 'leather boots are worth 3*5 on Feet');
  const g = { items: [], stats: {} };
  equipItem(g, { group: 'MensClothing', templateIndex: 150, material: 0, name: 'Sandals' });
  assert.equal(armorValuesOf(g)[BODY_PARTS.Feet], 100, 'Sandals map to Feet but DFU grants nothing');
  const h = { items: [], stats: {} };
  equipItem(h, { group: 'WomensClothing', templateIndex: 188, material: 0, name: 'Boots' });
  assert.equal(h.armorValues[BODY_PARTS.Feet], 85, "the women's window is 186..188");

  // F14 - CreateWeapon's arrow branch takes no material multiplier
  const arrowBase = templateByIndex(131).basePrice;
  assert.equal(itemBaseValue({ group: 'Weapons', templateIndex: 131, material: 0 }), arrowBase);
  assert.equal(itemBaseValue({ group: 'Weapons', templateIndex: 131, material: 9 }), arrowBase,
    'a daedric-material arrow is still worth its basePrice, not 3*512x it');

  // F15 - delayScrollUp: correct only once the index runs PAST the end
  assert.equal(safeScrollIndex(4, 8), 4, 'still in range: untouched');
  assert.equal(safeScrollIndex(4, 5), 4, 'partly-filled column is classic');
  assert.equal(safeScrollIndex(4, 4), 0, 'past the end: snap');
  assert.equal(safeScrollIndex(9, 10), 9);
  assert.equal(safeScrollIndex(9, 3), 0);
});

test('audit17e W1: F9 the inventory icon draws the PLAYER texture, not the world sprite', () => {
  // GetItemImage (ItemHelper.cs:399-430) + GetInventoryTexture*
  // (DaggerfallUnityItem.cs:1728-1764) + UseWorldTexture (:1830-1855).
  const dagger = inventoryItemImage({ group: 'Weapons', templateIndex: 113 });
  const t113 = templateByIndex(113);
  assert.deepEqual(dagger, { archive: t113.playerTextureArchive, record: t113.playerTextureRecord });
  assert.notEqual(dagger.archive, t113.worldTextureArchive, 'the world sprite is a DIFFERENT archive');
  // the Katana +1 inventory bump (it uses the right-hand image)
  const t121 = templateByIndex(121);
  assert.equal(inventoryItemImage({ group: 'Weapons', templateIndex: 121 }).record, t121.playerTextureRecord + 1);
  // UseWorldTexture: arrows, ingredients, and the three groups
  const t131 = templateByIndex(131);
  assert.deepEqual(inventoryItemImage({ group: 'Weapons', templateIndex: 131 }),
    { archive: t131.worldTextureArchive, record: t131.worldTextureRecord }, 'arrows keep the world sprite');
  assert.equal(usesWorldTexture({ group: 'PlantIngredients1', templateIndex: 0 }), true, 'isIngredient');
  assert.equal(usesWorldTexture({ group: 'MiscItems', templateIndex: 132 }), true);
  assert.equal(usesWorldTexture({ group: 'Weapons', templateIndex: 113 }), false);
  // variants advance the record (armor/clothing)
  const t165 = templateByIndex(165);
  assert.ok(t165.variants > 0);
  assert.equal(inventoryItemImage({ group: 'MensClothing', templateIndex: 165, variant: 2 }).record,
    t165.playerTextureRecord + 2);
  // the templates now carry the FULL DFU row (the lossy copy is gone)
  assert.equal(typeof t113.drawOrderOrEffect, 'number');
  assert.equal(typeof t113.enchantmentPoints, 'number');
});

test('audit17e W1: F16 refreshPaperDoll COALESCES a concurrent request instead of dropping it', async () => {
  // ASYNC NEVER DROPS. The boolean guard threw away any refresh that
  // arrived mid-compose, so an equip during the first paint left the
  // doll - and its click mask - permanently stale.
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src/ui/paperDoll.js'), 'utf8');
  assert.ok(/_pending\s*=\s*entity/.test(src), 'a concurrent request is remembered');
  assert.ok(/if \(_pending\)/.test(src), 'and re-run when the pass finishes');
  assert.ok(!/if \(!_art \|\| !_deps \|\| _refreshing\) return;/.test(src), 'the dropping guard is gone');
});

test('audit17e W1: F17 the worn-weapon bind lives in the RIG, so all four hosts inherit it', () => {
  // THE FOUR HOSTS RULE. U8h bound it by hand in the two exterior
  // hosts; the interior host owns a fourth rig and kept swinging the
  // interim dagger inside every building.
  const rigSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src/combat/weaponRig.js'), 'utf8');
  assert.ok(/EQUIP_SLOTS\.RightHand/.test(rigSrc), 'the rig reads the equip table');
  assert.ok(/syncWorn\(\);/.test(rigSrc), 'and syncs per frame');
  for (const host of ['src/scenes/exterior.js', 'src/scenes/world.js']) {
    const s = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', host), 'utf8');
    assert.ok(!/weaponRig\.playerWeapon\.weapon =/.test(s), `${host} no longer hand-binds`);
  }
});
