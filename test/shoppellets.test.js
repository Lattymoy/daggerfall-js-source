// SHOP-PELLETS (2026-10-07; bible/05-Combat/Dwarven-Thunderlock.md "SHOP-PELLETS"; Mac: "allowing the purchase of the
// ammunition in stores"). The laws pinned:
//   - WHERE DAGGERFALL SELLS WEAPONS: every storefront whose pair table carries the Weapons group - and no other.
//   - THE STACK IS THE SHOP'S: its Weapons chance over the Weapon Smith's, of SHOP_PELLETS_MAX, a poor shop half of it.
//   - ON THE COUNTER, FROM NO ROLL, AFTER DFU'S DRAWS: the counter's shelf alone; the classic stream and every item of
//     DFU's on the shelf exactly what they were.
//   - THE SHOT, NEVER THE GUN; a bought stack merges with a found one and a smith buys it back.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stockShopShelf, shopPelletStack, SHOP_PELLETS_MAX, SHOP_ITEM_GROUPS, shopBuysItem } from '../src/systems/shopStock.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { PELLET_TEMPLATE } from '../src/characters/thunderlockIds.js';
import { createPellets, isPellet, isThunderlock, pelletCount } from '../src/systems/thunderlock.js';
import { addItem } from '../src/systems/inventory.js';
import { itemBaseValue } from '../src/systems/itemTemplates.js';

const B = BUILDING_TYPES;

test('SHOP-PELLETS WHERE AND HOW MANY: the four storefronts whose tables carry Weapons - a Weapon Smith 25 to 50, an Armorer or a General Store 7 to 14, a Pawn Shop 4 to 7 - and none elsewhere; quality clamped to 1-20 (mutants: the weight of weapons ignored; quality ignored; a shop without weapons stocking it)', () => {
  assert.equal(SHOP_PELLETS_MAX, 50);
  const at = (b) => [1, 10, 20].map((q) => shopPelletStack(b, q));
  assert.deepEqual(at(B.WeaponSmith), [25, 37, 50]);
  assert.deepEqual(at(B.Armorer), [7, 11, 14]);
  assert.deepEqual(at(B.GeneralStore), [7, 11, 14]);
  assert.deepEqual(at(B.PawnShop), [4, 5, 7]);
  const weaponsShops = Object.keys(SHOP_ITEM_GROUPS).map(Number).filter((b) => {
    const p = SHOP_ITEM_GROUPS[b];
    for (let i = 0; i + 1 < p.length; i += 2) if (p[i] === 0x03 && p[i + 1] > 0) return true;
    return false;
  });
  assert.deepEqual(weaponsShops.sort((x, y) => x - y), [B.Armorer, B.GeneralStore, B.PawnShop, B.WeaponSmith].sort((x, y) => x - y), 'DFU\'s own tables say which');
  for (const b of Object.keys(SHOP_ITEM_GROUPS).map(Number)) if (!weaponsShops.includes(b)) assert.equal(shopPelletStack(b, 20), 0, `building ${b}: no weapons, no shot`);
  assert.equal(shopPelletStack(9999, 20), 0, 'not a shop');
  assert.deepEqual([shopPelletStack(B.WeaponSmith, 0), shopPelletStack(B.WeaponSmith, 21), shopPelletStack(B.WeaponSmith, NaN)], [25, 50, 25], 'clamped');
});

test('SHOP-PELLETS ON THE COUNTER, FROM NO ROLL: the counter\'s shelf carries the stack and every other shelf none; the counter draws exactly the rolls the next shelf does and holds exactly its items besides the shot - DFU\'s stream and stock untouched (mutants: every shelf; a roll drawn; before DFU\'s draws)', () => {
  for (const [b, q] of [[B.WeaponSmith, 14], [B.Armorer, 20], [B.GeneralStore, 9], [B.PawnShop, 3]]) {
    const run = (shelfIndex) => {
      let n = 0, seed = 77;
      const rolls = () => { n++; seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
      const items = stockShopShelf({ buildingType: b, quality: q }, { level: 12 }, { rolls, shelfIndex, torchesFromItems: false });
      return { items, n };
    };
    const counter = run(0), next = run(1);
    const shot = counter.items.filter(isPellet);
    assert.equal(shot.length, 1, `building ${b}: one stack on the counter`);
    assert.equal(shot[0].stackCount, shopPelletStack(b, q));
    assert.equal(next.items.filter(isPellet).length, 0, `building ${b}: none on another shelf`);
    if (b === B.WeaponSmith || b === B.Armorer) {
      // a shop with no counter-only supply of its own: the counter IS the next shelf plus the shot
      assert.equal(counter.n, next.n, `building ${b}: the same draws`);
      assert.deepEqual(JSON.parse(JSON.stringify(counter.items.filter((i) => !isPellet(i)))), JSON.parse(JSON.stringify(next.items)), `building ${b}: the same stock`);
      assert.ok(isPellet(counter.items.at(-1)), 'after every draw of DFU\'s');
    }
  }
});

test('SHOP-PELLETS THE SHOT: a stack of the pellet\'s own mint - Weapons, its template, no metal, the template\'s price a pellet - that merges with a found stack in the pack and that a smith buys back; never the gun (mutants: the stack not merged)', () => {
  const shelf = stockShopShelf({ buildingType: B.WeaponSmith, quality: 20 }, { level: 30 }, { rolls: () => 0.5 });
  const stack = shelf.find(isPellet);
  assert.deepEqual([stack.group, stack.templateIndex, stack.material, stack.stackCount], ['Weapons', PELLET_TEMPLATE, 0, 50]);
  assert.equal(stack.value, itemBaseValue(createPellets(1)), 'priced a pellet, as an arrow is');
  assert.ok(!shelf.some(isThunderlock));
  const pack = [createPellets(7)];
  addItem(pack, { ...stack });
  assert.equal(pack.length, 1, 'one row');
  assert.equal(pelletCount(pack), 57);
  assert.equal(shopBuysItem(B.WeaponSmith, stack), true, 'a smith buys shot, as it buys arrows');
});
