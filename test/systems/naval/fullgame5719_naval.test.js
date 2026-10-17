import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sea } from '../../navalSea.mjs';
import { createShipDamage, FIRE_HP, FIRE_STACK } from '../../../src/systems/naval/navalDamage.js';
import { giveNavalItems } from '../../../src/systems/naval/navalTransfer.js';
import { mintStores } from '../../../src/systems/naval/navalStores.js';
import { goldStack, carriedWeight } from '../../../src/systems/inventory.js';

test('FG-05: real naval save/load preserves stacked fires, fractional damage and crew-burn progress', async () => {
  const s = await sea({ hull: 2 });
  const d = s.host._myState(s.boat).damage;
  d.apply({ hull: 0, sail: 0, crew: 0, fire: 2 });
  d.step(0.37);
  d.apply({ hull: 0, sail: 0, crew: 0, fire: 1 });
  d.step(0.71);
  d.apply({ hull: 0, sail: 0, crew: 0, fire: 2 });
  assert.equal(d.fires, 3);
  assert.equal(s.host.saveRefused(), false);
  const saved = structuredClone(s.host.getSaveData());
  const expected = [];
  for (const dt of [1, 2.3, 0.1, 4, 10]) { d.step(dt); expected.push(d.saveData()); }
  s.host.restoreSaveData(saved);
  const restored = s.host._myState(s.boat).damage;
  for (const [i, dt] of [1, 2.3, 0.1, 4, 10].entries()) {
    restored.step(dt);
    assert.deepEqual(restored.saveData(), expected[i], `elapsed segment ${i}`);
  }
});

test('FG-05: old fire records still load; malformed new fire fields are bounded and copied', () => {
  const d = createShipDamage({ hullHp: 100, sailHp: 100, crew: 20, player: true });
  d.restore({ hull: 90, sail: 90, crew: 20, fire: 8 });
  assert.equal(d.fires, 1);
  d.step(1);
  assert.equal(d.hull, 90 - FIRE_HP);
  d.restore({ fires: [{ hp: Infinity, t: 12 }, { hp: FIRE_HP, t: -1 }, { hp: FIRE_HP, t: 1000 }], crewBurn: Infinity });
  assert.equal(d.fires, 1);
  assert.equal(d.fire, 15);
  assert.equal(d.saveData().crewBurn, 0);
  d.restore({ fires: Array(20).fill({ hp: FIRE_HP, t: 3 }), crewBurn: 3.5 });
  assert.equal(d.fires, FIRE_STACK);
  const saved = d.saveData(); saved.fires[0].t = 0;
  assert.equal(d.fire, 3, 'saved arrays do not alias live damage');
  assert.equal(d.snapshot().fires, undefined, 'compact wire snapshot remains unchanged');
});

const player = () => ({ stats: { strength: 10 }, items: [], goldPieces: 0, activeEffects: [] });
test('FG-06: partial on-foot plunder takes only capacity and returns the remaining stack once', () => {
  const p = player(), stack = mintStores(100);
  const result = giveNavalItems([stack], null, p);
  assert.equal(p.items[0].stackCount, 1);
  assert.equal(carriedWeight(p), 10);
  assert.equal(result.left.length, 1);
  assert.equal(result.left[0].stackCount, 99);
  assert.notEqual(result.left[0], p.items[0]);
  const next = giveNavalItems(result.left, null, p);
  assert.equal(p.items[0].stackCount, 1);
  assert.equal(next.left[0].stackCount, 99);
  assert.equal(next.over, 0);
});

test('FG-06: boat cargo, gold and forced crew returns retain their existing transfer rules', () => {
  const p = player(), boat = { Cargo: { Items: [] } };
  assert.deepEqual(giveNavalItems([mintStores(100)], boat, p), { left: [], over: 0 });
  assert.equal(boat.Cargo.Items[0].stackCount, 100);
  assert.equal(p.items.length, 0);
  assert.deepEqual(giveNavalItems([goldStack(20)], null, p), { left: [], over: 0 });
  assert.equal(p.goldPieces, 20);
  assert.deepEqual(giveNavalItems([mintStores(100)], null, p, { force: true }), { left: [], over: 1 });
  assert.equal(p.items[0].stackCount, 100);
});
