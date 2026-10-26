// LOOT-GATE (2026-10-25): the roller's level holds Rare and Legendary back; the Imbue at the Mages Guild's Reforge.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rareGate, legendaryGate, droughtHeld, registerRollerLevel } from '../../src/systems/loot/lootLevelGate.js';
import { rarityChances, pileSource, craftedRarityWorth } from '../../src/systems/loot/lootRarity.js';
import { imbuePiece, imbueRefusal, imbuePrice } from '../../src/systems/reforge.js';
import { welkyndShards } from '../../src/systems/gate/gateSpoils.js';
import { createRandomWeapon } from '../../src/systems/loot/loot.js';
import { setPref } from '../../src/systems/uiPrefs.js';

setPref('lootRarity', true);
registerRollerLevel(null);

test('LOOT-GATE the curves: Rare x0.15 to level 7 and whole at 12, Legendary x0.05 to level 9, x0.25 at 10, whole at 15 (mutants: a floor moved; a step moved; Magic gated)', () => {
  assert.deepEqual([1, 7, 8, 12, 30].map((l) => +rareGate(l).toFixed(2)), [0.15, 0.15, 0.32, 1, 1]);
  assert.deepEqual([1, 9, 10, 14, 15].map((l) => +legendaryGate(l).toFixed(2)), [0.05, 0.05, 0.25, 0.85, 1]);
  const crypt = pileSource(9);
  const open = rarityChances(crypt), at1 = rarityChances({ ...crypt, rollerLevel: 1 }), at20 = rarityChances({ ...crypt, rollerLevel: 20 });
  assert.equal(at1.magic, open.magic, 'Magic is never gated');
  assert.ok(Math.abs(at1.rare - open.rare * 0.15) < 1e-9);
  assert.ok(Math.abs(at1.legendary - open.legendary * 0.05) < 1e-9);
  assert.deepEqual(at20, open, 'from level 15 the ladder is the source alone');
  assert.equal(droughtHeld(9), true); assert.equal(droughtHeld(10), false); assert.equal(droughtHeld(null), false);
});

const weapon = () => { for (let i = 0; i < 50; i++) { const w = createRandomWeapon(5); if (w && !w.rarity) return w; } throw new Error('no weapon'); };
const player = (level, gold, shards) => ({ level, items: [welkyndShards(shards)], goldPieces: gold });

test('LOOT-GATE the Imbue: plain to Magic and Magic to Rare at any level, one price at every level, and a counter pays for the piece it was (mutants: a level gate; a price moved; sold at the new worth)', () => {
  const p = player(3, 100000, 50);
  const w = weapon(); p.items.push(w);
  assert.deepEqual(imbuePrice(w), { shards: 2, gold: 2500 });
  assert.equal(imbuePiece(w, p).ok, true);
  assert.equal(w.rarity, 'magic'); assert.equal(w.imbued, true);
  assert.equal(craftedRarityWorth(w) > 0, true, 'its bought worth is taken off a counter');
  assert.equal(imbueRefusal(w, p), null, 'Rare at level 3: the price is the gate');
  assert.deepEqual(imbuePrice(w), { shards: 6, gold: 15000 });
  assert.equal(imbuePiece(w, p).ok, true);
  assert.equal(w.rarity, 'rare');
  assert.equal(imbueRefusal(w, p), 'not', 'never to Legendary');
  p.level = 40;
  assert.equal(imbueRefusal(w, p), 'not', 'never to Legendary, at any level');
});
