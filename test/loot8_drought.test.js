// LOOT8 - THE DROUGHT (2026-10-01; bible/06-Systems/Loot-Arc.md section 10, Mac: "Do you wanna turn this into an arc
// and do all of the above?" - "Bad-luck protection. Track pieces looted since your last Legendary; past a threshold,
// raise the chance"). The laws pinned here:
//   - THE MULTIPLIER: 1 + 0.2 x floor(drought / 25), at most x3 - never above the Rare threshold (the ladder never
//     inverts); a finder, so Foxglove's and it multiply; off, 1.
//   - THE MARK: every eligible piece a source door rolls is `untaken` - whatever its tier, never an ineligible one,
//     none off; the mark is a declared field, so it rides a save, a body's record and a peer's grant.
//   - THE TAKE: the first take of a marked piece clears it and counts - one more below Legendary, none at Legendary or
//     better; a piece taken again, or one no door rolled, counts nothing; gold never; every take seam tells it.
//   - THE RECORD: the character's save carries it (a mod record), a forged one refused.

import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import * as LR from '../src/systems/lootRarity.js';
import * as D from '../src/systems/lootDrought.js';
import { takeOneInto, registerTakeListener, goldStack } from '../src/systems/inventory.js';
import { applyTransfer } from '../src/systems/itemTransfer.js';
import { takeCorpseLoot } from '../src/scenes/corpseMarker.js';
import { modSaveRecords, restoreModSaveRecords } from '../src/systems/modSaveData.js';
import { validLootItem } from '../src/systems/loot.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { isAmmunition } from '../src/systems/itemTemplates.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const on = () => { _resetForTests(); setPref('lootRarity', true); D._setDroughtForTests(0); };
const off = () => { _resetForTests(); setPref('lootRarity', false); D._setDroughtForTests(0); };
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
const marked = (it) => ({ ...it, untaken: true });

test('LOOT8: the multiplier - a fifth more every 25 pieces, at most three times; never above the Rare threshold; a finder; off 1', () => {
  on();
  assert.deepEqual([0, 24, 25, 49, 50, 125, 249, 250, 251, 10000].map((d) => D.droughtMult(d)), [1, 1, 1.2, 1.2, 1.4, 2, 2.8, 3, 3, 3]);
  assert.deepEqual([D.DROUGHT_STEP, D.DROUGHT_STEP_MULT, D.DROUGHT_MAX_MULT], [25, 0.2, 3]);
  D._setDroughtForTests(250);
  assert.equal(LR.legendaryFindMult(), 3, 'the finders\' product: the drought\'s three (Foxglove\'s is unworn here)');
  const src = { kind: 'corpse', tier: 5 };
  const plain = LR.rarityChances(src);
  const dry = LR.rarityChances({ ...src, find: LR.legendaryFindMult() });
  assert.equal(dry.legendary, Math.min(plain.rare, plain.legendary * 3));
  assert.deepEqual([dry.magic, dry.rare], [plain.magic, plain.rare], 'the Legendary threshold alone');
  const top = LR.rarityChances({ kind: 'corpse', tier: 40, boss: true, find: 1e6 });
  assert.equal(top.legendary, top.rare, 'never above the Rare threshold');
  off();
  D._setDroughtForTests(250);
  assert.equal(LR.legendaryFindMult(), 1, 'off: 1');
});

test('LOOT8: the mark - every eligible piece a source door rolls, whatever its tier; never an ineligible one; none off; a declared field', () => {
  on();
  let pieces = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const gold = goldStack(30), arrows = createWeapon(131, 1);
    const items = [createWeapon(113, 1), createWeapon(127, 1), gold, arrows];
    LR.rollLootRarity(items, { kind: 'pile', tier: 6 }, { rolls: lcg(seed) });
    for (const it of items) {
      if (it === gold || it === arrows || LR.gemKindOf(it)) assert.equal(it.untaken, undefined, 'gold, arrows and a found gem are no piece');   // PIN MOVED (GEM2): the door's gem find, after every piece
      else { assert.equal(it.untaken, true, `seed ${seed}: ${it.rarity ?? 'common'} (a unique find too)`); pieces++; }
    }
  }
  assert.ok(pieces >= 120);
  off();
  const plain = [createWeapon(113, 1)];
  LR.rollLootRarity(plain, { kind: 'pile', tier: 6 }, { rolls: lcg(1) });
  assert.equal(plain[0].untaken, undefined, 'off: nothing marked - DFU\'s list untouched');
  on();
  assert.equal(validLootItem(marked(createWeapon(113, 1)))?.untaken, true, 'it rides the wire - a peer\'s grant carries it');
  assert.equal(validLootItem({ ...createWeapon(113, 1), untaken: 'yes' }), null, 'a forged one refused');
});

test('LOOT8: the take - the first take of a marked piece counts and clears it; again nothing; a Legendary empties; unmarked, gold, off nothing', () => {
  on();
  const me = { items: [] };
  const pile = [marked(createWeapon(113, 1)), marked(createWeapon(127, 1)), createWeapon(120, 1)];
  const [a, b, c] = pile;
  assert.ok(takeOneInto(me, pile, a));
  assert.equal(D.droughtOf(), 1);
  assert.equal(a.untaken, undefined, 'the mark cleared');
  assert.ok(takeOneInto(me, pile, c));
  assert.equal(D.droughtOf(), 1, 'a piece no door rolled counts nothing');
  const back = [a];
  me.items.splice(me.items.indexOf(a), 1);
  takeOneInto(me, back, a);
  assert.equal(D.droughtOf(), 1, 'dropped and taken again: nothing');
  takeOneInto(me, pile, b);
  assert.equal(D.droughtOf(), 2);
  const leg = marked(LR.applyRarity(createWeapon(113, 1), 'legendary', lcg(3)));
  takeOneInto(me, [leg], leg);
  assert.equal(D.droughtOf(), 0, 'a Legendary taken empties it');
  const rare = marked(LR.applyRarity(createWeapon(113, 1), 'rare', lcg(5)));
  takeOneInto(me, [rare], rare);
  assert.equal(D.droughtOf(), 1, 'a Rare is below Legendary: one more');
  D._setDroughtForTests(D.DROUGHT_MAX);
  const one = marked(createWeapon(113, 1));
  takeOneInto(me, [one], one);
  assert.equal(D.droughtOf(), D.DROUGHT_MAX, 'never past the ceiling');
  D._setDroughtForTests(0);
  const gold = { ...goldStack(20), untaken: true };
  takeOneInto(me, [gold], gold);
  assert.equal(D.droughtOf(), 0, 'gold never');
  off();
  const o = marked(createWeapon(113, 1));
  takeOneInto(me, [o], o);
  assert.equal(D.droughtOf(), 0, 'off: nothing counted');
});

test('LOOT8: every take seam tells it - the loot window\'s and quick loot\'s (applyTransfer into the pack), a body\'s bulk take and a peer\'s grant (takeOneInto); never a move out of the pack', () => {
  on();
  const told = [];
  registerTakeListener('loot8-test', (it) => told.push(it));
  try {
    const me = { items: [] };
    const w = createWeapon(113, 1);
    const from = [w];
    applyTransfer(w, { ok: true, amount: 1 }, from, me.items, { entity: me, toPlayer: true });
    assert.deepEqual(told, [w], 'into the pack');
    const back = [];
    applyTransfer(w, { ok: true, amount: 1 }, me.items, back, { entity: me, fromLocal: true });
    assert.equal(told.length, 1, 'out of it: nothing');
    const g = goldStack(10);
    applyTransfer(g, { ok: true, amount: 10 }, [g], me.items, { entity: me, toPlayer: true });
    assert.equal(told.length, 1, 'gold never');
    const body = { entity: { items: [marked(createWeapon(113, 1)), marked(createWeapon(127, 1))] }, mobileType: 7 };
    const before = D.droughtOf();
    takeCorpseLoot(body, me, () => {});
    assert.equal(told.length, 3, 'a body\'s bulk take');
    assert.equal(D.droughtOf(), before + 2);
    registerTakeListener('loot8-throws', () => { throw new Error('a listener'); });
    const t = createWeapon(113, 1);
    assert.equal(takeOneInto(me, [t], t), t, 'a listener that throws never stops a take');
    registerTakeListener('loot8-throws', null);
  } finally { registerTakeListener('loot8-test', null); }
  assert.match(read('src/systems/itemTransfer.js'), /if \(toPlayer && landed\) tellTaken\(landed\);/);
  assert.match(read('src/scenes/world.js'), /import '\.\.\/systems\/lootDrought\.js';/, 'the game registers it');
});

test('LOOT8: the record - the character\'s save carries it, a load restores it, a forged one refused, a new game none', () => {
  on();
  D._setDroughtForTests(73);
  assert.deepEqual(modSaveRecords()[D.DROUGHT_SAVE_VENDOR], { drought: 73 });
  D._setDroughtForTests(0);
  restoreModSaveRecords({ [D.DROUGHT_SAVE_VENDOR]: { drought: 140 } });
  assert.equal(D.droughtOf(), 140);
  assert.equal(D.droughtMult(), 2.0);
  for (const bad of [{ drought: -1 }, { drought: 1.5 }, { drought: 'x' }, null, 7]) {
    restoreModSaveRecords({ [D.DROUGHT_SAVE_VENDOR]: bad });
    assert.equal(D.droughtOf(), 0, JSON.stringify(bad));
  }
  restoreModSaveRecords({ [D.DROUGHT_SAVE_VENDOR]: { drought: 1e12 } });
  assert.equal(D.droughtOf(), D.DROUGHT_MAX, 'past the ceiling, the ceiling');
  D._setDroughtForTests(30);
  restoreModSaveRecords({});
  assert.equal(D.droughtOf(), 0, 'a save without one: none');
});

test('LOOT8: the doors in play - a dungeon of commons fills the drought at the take, and a drought makes the next Legendary likelier', () => {
  on();
  const me = { items: [] };
  let n = 0;
  for (let seed = 1; n < 60; seed++) {
    const body = { entity: { items: [createWeapon(113, 1)], level: 4, mobileType: 7 }, mobileType: 7 };
    LR.rollCorpseLoot(body.entity, { level: 4 }, { rolls: lcg(seed) });
    if (LR.rarityRank(body.entity.items[0]) >= LR.RARITIES.legendary.rank) continue;
    takeCorpseLoot(body, me, () => {});
    n++;
  }
  assert.equal(D.droughtOf(), 60, 'sixty taken, sixty counted - at the take, never the roll');
  const legs = (d) => {
    D._setDroughtForTests(d);
    let k = 0;
    for (let seed = 1; seed <= 4000; seed++) {
      const it = [createWeapon(113, 1)];
      LR.rollLootRarity(it, { kind: 'corpse', tier: 8 }, { rolls: lcg(seed) });
      if (it[0].rarity === 'legendary') k++;
    }
    return k;
  };
  const wet = legs(0), dry = legs(250);
  assert.ok(dry > wet * 2.4, `a long drought: three times the Legendaries (${wet} -> ${dry})`);
});

test('LOOT8: a unique find is a found piece too (registered last - the find stays for this file)', () => {
  on();
  LR.registerUniqueFind({ id: 'loot8-test-find', minTier: 0, weight: 100, mint: () => [createWeapon(120, 1), createWeapon(131, 1)] });
  let items = [];
  for (let seed = 1; seed < 20000 && !items.slice(1).some(isAmmunition); seed++) {
    items = [createWeapon(113, 1)];
    LR.rollLootRarity(items, { kind: 'corpse', tier: 10 }, { rolls: lcg(seed) });
  }
  assert.ok(items.slice(1).some(isAmmunition), 'a find came, its arrows with it');
  for (const it of items.slice(1)) assert.equal(it.untaken, isAmmunition(it) ? undefined : true, `${it.name}: every found piece is marked, never its ammunition`);
});
