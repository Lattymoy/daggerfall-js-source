// HELD-WEAR, SWAP-PACE, CANDLE-POV (2026-10-28, Dudey): a Cast When Held piece wears 1 point every 36 rounds, the swap
// pause drains twice as fast outside the open PvP zone, and my own Light candle is drawn only out of first person.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENCHANTMENT_TYPES as T, enchantmentMagicRound, HELD_DEGRADE_RATE } from '../../src/systems/enchantments.js';
import { swapPace, PVE_SWAP_PACE } from '../../src/combat/weapon/swapPace.js';
import { createMagicCandle } from '../../src/scenes/magicCandle.js';

test('HELD-WEAR: a worn Cast When Held piece loses 1 condition every 36 rounds', () => {
  assert.equal(HELD_DEGRADE_RATE, 36);
  const ring = { name: 'R', templateIndex: 135, group: 'Jewellery', currentCondition: 100, maxCondition: 100, equipSlot: 9, enchantments: [{ type: T.CastWhenHeld, param: -1 }] };
  const w = { isPlayer: true, name: 'W', health: 20, maxHealth: 30, items: [ring], level: 5, stats: {}, skills: [40, 40, 40, 40] };
  for (let r = 1; r <= 72; r++) enchantmentMagicRound(w, r);
  assert.equal(ring.currentCondition, 98);
});

test('SWAP-PACE: twice as fast in PvE, unchanged in the open PvP zone', () => {
  assert.equal(PVE_SWAP_PACE, 2);
  assert.equal(swapPace(false), 2);
  assert.equal(swapPace(true), 1);
});

test('CANDLE-POV: with sprite false the light stays and no candle is drawn', () => {
  let asked = 0;
  const c = createMagicCandle({ renderer: {}, getTexture: () => { asked++; return new Promise(() => {}); }, uploadRecord: () => {} });
  c.update(0.016, { active: true, feet: [0, 0, 0], height: 1.8, forward: [0, 0, 1], sprite: false });
  assert.ok(c.light(), 'the light burns');
  assert.equal(asked, 0, 'no sprite is fetched');
  c.update(0.016, { active: true, feet: [0, 0, 0], height: 1.8, forward: [0, 0, 1] });
  assert.equal(asked, 1, 'third person (and every peer mount) still draws it');
});
