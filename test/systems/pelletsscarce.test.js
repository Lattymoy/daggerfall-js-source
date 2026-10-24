// PELLETS-SCARCE (2026-10-24; bible/05-Combat/Dwarven-Thunderlock.md "PELLETS-SCARCE"; the owner: "Remove their ammo from
// shops and only have ammo has a rare resource drop (not super duper rare but still rare)"). The laws pinned:
//   - NO SHELF SELLS IT: no shop of any kind, quality or shelf carries a Dwemer Pellet, and the shop stock names none
//     (SHOP-PELLETS retired) - though a smith still buys one back, as it buys any weapon.
//   - THE OLD FIND'S PLACE, KEPT: the gun's old find stays registered at its weight and tier and still takes its one
//     mint draw, handing nothing over (Loot-II-Arc law 9).
//   - THE DWEMER FIND: a final find - the loot door's very last draw, after the technique's - on its own curve
//     (PELLET_FIND_WEIGHTS: about 1% a list at tier 1, 2% at tier 6, 3% at tier 10, 4% at tier 14, 6% at most; a pile's
//     x1.3, a boss's x2.5 under the same 6%), never at tier 0, minting PELLET_FIND_STACK from one draw.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stockShopShelf, SHOP_ITEM_GROUPS, shopBuysItem } from '../../src/systems/shopStock.js';
import { BUILDING_TYPES } from '../../src/world/buildingNames.js';
import {
  createPellets, isPellet, PELLET_FIND_WEIGHTS, PELLET_FIND_MIN_TIER, PELLET_FIND_STACK, pelletFindStack, FIND_MIN_TIER,
} from '../../src/systems/thunderlock.js';
import * as LR from '../../src/systems/loot/lootRarity.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { setPref } from '../../src/systems/uiPrefs.js';

const B = BUILDING_TYPES;
const lcg = (seed) => { let x = seed >>> 0; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 0x100000000; }; };

test('PELLETS-SCARCE NO SHELF: no shop of any kind, at any quality, on any shelf, every draw landing or none, carries a Dwemer Pellet - and the shop stock names none; a smith still buys one back (mutants: the counter\'s line restored)', () => {
  const src = readFileSync('src/systems/shopStock.js', 'utf8');
  assert.ok(!/createPellets|PELLET_TEMPLATE|shopPelletStack|SHOP_PELLETS_MAX/.test(src), 'the stock law knows nothing of the shot');
  for (const buildingType of Object.keys(SHOP_ITEM_GROUPS).map(Number)) {
    for (const quality of [1, 7, 14, 20]) {
      for (const shelfIndex of [0, 1, 2]) {
        for (const rolls of [() => 0, () => 0.5, () => 0.999]) {
          const shelf = stockShopShelf({ buildingType, quality }, { level: 30 }, { rolls, shelfIndex, torchesFromItems: false });
          assert.ok(!shelf.some(isPellet), `building ${buildingType}, quality ${quality}, shelf ${shelfIndex}: no Pellet`);
        }
      }
    }
  }
  assert.equal(shopBuysItem(B.WeaponSmith, createPellets(5)), true, 'a smith buys shot back, as it buys arrows');
  assert.equal(shopBuysItem(B.Alchemist, createPellets(5)), false);
});

test('PELLETS-SCARCE THE OLD FIND\'S PLACE: the gun\'s find stays registered at its weight, tier and place, takes its one mint draw and hands nothing over (mutants: the Pellets handed over again; its draw dropped)', () => {
  const finds = LR.uniqueFinds();
  const old = finds.find((f) => f.id === 'dwarven-thunderlock');
  assert.ok(old && !old.late && !old.final, 'still rolled in rollUniqueFinds\' place');
  assert.deepEqual([old.minTier, old.weight, old.weights], [FIND_MIN_TIER, 1, undefined]);
  for (const v of [0, 0.3, 0.9999]) {
    let n = 0;
    assert.deepEqual(old.mint(() => { n++; return v; }), []);
    assert.equal(n, 1, 'one draw, as it always drew');
  }
});

test('PELLETS-SCARCE THE DWEMER FIND: final, from tier 1, on its own curve - about 1% a list at tier 1, 2% at 6, 3% at 10, 4% at 14, 6% at most; x1.3 a pile, x2.5 a boss under the same cap; Luck a nudge; never at tier 0 (mutants: the curve the gun\'s; tier 0; the cap; not final)', () => {
  const f = LR.uniqueFinds().find((x) => x.id === 'dwemer-pellets');
  assert.ok(f, 'registered');
  assert.deepEqual([f.final, f.late ?? false, f.minTier, PELLET_FIND_MIN_TIER], [true, false, 1, 1]);
  assert.deepEqual(PELLET_FIND_WEIGHTS, { base: 6, perTier: 2.5, cap: 60 });
  assert.deepEqual(f.weights, PELLET_FIND_WEIGHTS);
  const at = (tier, o = {}) => LR.uniqueFindChance(f, { kind: 'corpse', tier, luck: 50, ...o });
  assert.equal(at(0), 0, 'a rat\'s nest never');
  assert.deepEqual([1, 6, 10, 14, 21, 30].map((t) => at(t)), [8.5, 21, 31, 41, 58.5, 60], 'per mille: rare, never the gun\'s one in a thousand');
  assert.equal(LR.uniqueFindChance(f, { kind: 'pile', tier: 6, luck: 50 }), 21 * 1.3);
  assert.equal(LR.uniqueFindChance(f, { kind: 'corpse', tier: 30, boss: true, luck: 50 }), 60, 'the cap holds over a boss');
  assert.equal(LR.uniqueFindChance(f, { kind: 'corpse', tier: 6, boss: true, luck: 50 }), 21 * 2.5);
  assert.equal(LR.uniqueFindChance(f, { kind: 'corpse', tier: 10, boss: true, luck: 50 }), 60, 'a boss at the cap from tier 10');
  assert.ok(at(6, { luck: 100 }) > at(6) && at(6, { luck: 0 }) < at(6), 'luck leans');
  // its stack: one draw, PELLET_FIND_STACK across it
  assert.deepEqual(PELLET_FIND_STACK, { min: 4, max: 12 });
  for (const [v, n] of [[0, 4], [0.5, 8], [0.9999, 12]]) {
    let draws = 0;
    assert.equal(pelletFindStack(() => { draws++; return v; }), n);
    assert.equal(draws, 1);
    const minted = f.mint(() => v);
    assert.deepEqual([minted.length, isPellet(minted[0]), minted[0].stackCount], [1, true, n]);
  }
  // rollUniqueFinds and rollLateFinds never roll it; rollFinalFinds rolls it alone
  assert.ok(!LR.rollUniqueFinds({ kind: 'corpse', tier: 20, luck: 50 }, () => 0).some(isPellet));
  assert.ok(!LR.rollLateFinds({ kind: 'corpse', tier: 20, luck: 50 }, () => 0).some(isPellet));
  let draws = 0;
  const finals = LR.rollFinalFinds({ kind: 'corpse', tier: 20, luck: 50 }, () => { draws++; return 0; });
  assert.deepEqual([finals.length, isPellet(finals[0]), draws], [1, true, 2], 'the find\'s roll, then its stack\'s');
  draws = 0;
  assert.deepEqual(LR.rollFinalFinds({ kind: 'corpse', tier: 0, luck: 50 }, () => { draws++; return 0; }), []);
  assert.equal(draws, 0, 'a find under its tier costs a seed no draw');
});

test('PELLETS-SCARCE THE DOOR\'S LAST DRAW: over 29 seeds, every draw before the Dwemer find is the seed\'s own - replayed with it found and not, the rest of the list is the same, the Pellets last (mutants: rolled before the technique; rolled in the finds\' place)', () => {
  setPref('lootRarity', true);
  const src = { kind: 'corpse', tier: 12, boss: false, family: null };
  for (let seed = 1; seed < 30; seed++) {
    const base = lcg(seed);
    const rec = [];
    LR.rollLootRarity([createWeapon(120, 1)], src, { rolls: () => { const v = base(); rec.push(v); return v; } });
    // the last draw or two are the final find's (its roll, and its stack's when it lands): find where the head ends by
    // replaying with the find held off
    const heldRec = [];
    const again = lcg(seed);
    LR._holdFinalFindsForTests(true);
    try { LR.rollLootRarity([createWeapon(120, 1)], src, { rolls: () => { const v = again(); heldRec.push(v); return v; } }); }
    finally { LR._holdFinalFindsForTests(false); }
    const head = heldRec;
    assert.deepEqual(rec.slice(0, head.length), head, `seed ${seed}: every draw before it is the seed's own`);
    assert.ok(rec.length === head.length + 1 || rec.length === head.length + 2, `seed ${seed}: its roll, and its stack's when it lands`);
    const replay = (tail) => { let k = 0; return () => (k < head.length ? head[k++] : tail[(k++) - head.length] ?? 0.5); };
    const a = [createWeapon(120, 1)];
    LR.rollLootRarity(a, src, { rolls: replay([0, 0]) });
    const b = [createWeapon(120, 1)];
    LR.rollLootRarity(b, src, { rolls: replay([0.999]) });
    assert.ok(isPellet(a.at(-1)), `seed ${seed}: found, the list's last`);
    assert.ok(!b.some(isPellet), `seed ${seed}: not found`);
    assert.equal(JSON.stringify(a.slice(0, -1)), JSON.stringify(b), `seed ${seed}: the rest the seed's own`);
  }
});

test('PELLETS-SCARCE THE SWITCH OFF STILL DROPS IT: Loot rarity off, the DFU list is untouched but for the Dwemer find - a find, not a tier - so a gun owned offline is never starved, the shelves selling none (AUDIT SHIP C2; mutants: the switch off a no-op again)', () => {
  setPref('lootRarity', false);
  try {
    const src = { kind: 'corpse', tier: 12, boss: false, family: null };
    const w = createWeapon(120, 1), plain = JSON.stringify(w);
    let drawn = 0;
    const found = LR.rollLootRarity([w], src, { rolls: () => { drawn++; return 0; } });
    assert.equal(JSON.stringify(found[0]), plain, 'the DFU piece untouched');
    assert.equal(found.length, 2); assert.ok(isPellet(found[1]));
    assert.equal(drawn, 2, 'its roll and its stack\'s');
    assert.deepEqual(LR.rollLootRarity([createWeapon(120, 1)], src, { rolls: () => 0.999 }).filter(isPellet), []);
    assert.deepEqual(LR.rollLootRarity([createWeapon(120, 1)], { ...src, tier: 0 }, { rolls: () => 0 }).filter(isPellet), [], 'never at tier 0');
  } finally { setPref('lootRarity', true); }
});
