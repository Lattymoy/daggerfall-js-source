// CARRY-CLAIMS (2026-10-30). A take off a shared pile - a room's
// chest or body, a peer's foe, a building's cupboard, a fallen player's remains - is lifted back OUT of the pack until the
// pile's authority grants it. The carry gate (itemTransfer.js planTake) read the pack without it, so every take inside
// that wait passed, and the grants then landed past the limit. The laws pinned here:
//   - systems/inventory.js claimedCarryKg sums what every keeper's takes in flight weigh, and lets a keeper go once it
//     holds none;
//   - planTake counts it as carried;
//   - systems/loot/claimLedger.js (bodies, cupboards) and net/wild/wildRemains.js (PvP remains) say theirs;
//   - scenes/roomLootHost.js (a dungeon's and a street's containers) says its own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import '../../src/systems/item/itemLaw.js';   // the item law registers itself with the wire, as the game's boot does
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { entityMaxEncumbrance } from '../../src/combat/formulas.js';
import { addItem, carriedWeight, claimedCarryKg, addCarryClaims, stacksWith } from '../../src/systems/inventory.js';
import { planTake } from '../../src/systems/item/itemTransfer.js';
import { createClaimLedger } from '../../src/systems/loot/claimLedger.js';
import { createWildRemains } from '../../src/net/wild/wildRemains.js';

/** A piece of `kg` (the instance weight unitWeightInKg honours). */
const piece = (kg, t = 0) => ({ ...createWeapon(t, 0, () => 0), weightInKg: kg });
/** Strength 20: 30 kg the most, carrying 20. */
const player = () => { const e = { stats: { strength: 20 }, items: [], goldPieces: 0 }; addItem(e.items, piece(20, 1)); return e; };   // another template: nothing taken stacks into it
const fits = (e, item) => planTake(item, { bag: e.items, entity: e, dryRun: true }).ok;

test('CARRY-CLAIMS: a keeper\'s weight counts on the gate, and a keeper with nothing in flight is let go', () => {
  const e = player();
  assert.equal(entityMaxEncumbrance(e), 30);
  assert.ok(fits(e, piece(8)), '20 + 8 under 30');
  let open = 9;
  const key = {};
  addCarryClaims(key, (who) => (open ? (who === e ? open : 0) : null));
  assert.equal(claimedCarryKg(e), 9);
  assert.equal(claimedCarryKg({ items: [] }), 0, 'another entity carries none of it');
  assert.ok(!fits(e, piece(8)), '20 + 9 in flight + 8 is past 30');
  open = 0;
  assert.equal(claimedCarryKg(e), 0, 'nothing in flight');
  open = 9;
  assert.equal(claimedCarryKg(e), 0, 'and the keeper was let go - its next take registers it again');
});

test('CARRY-CLAIMS: a body\'s or a cupboard\'s claim in flight weighs on the gate until its verdict', () => {
  const e = player();
  const ledger = createClaimLedger({ entity: e, newId: (() => { let n = 0; return () => `me:1:${++n}`; })() });
  // the window's take: the piece into the pack (the gate passed it), then lifted out as a claim
  const a = piece(8);
  assert.ok(fits(e, a));
  addItem(e.items, a);
  const c = ledger.take('body:1', { p: 0 }, a, 1, {}, 0);
  assert.equal(carriedWeight(e), 20, 'lifted back out of the pack');
  assert.ok(!fits(e, piece(8)), 'the second take is refused while the first waits on its verdict');
  // refused: the piece never comes, the weight is free again
  ledger.resolve(c.id, 0);
  assert.ok(fits(e, piece(8)), 'nothing in flight after the refusal');
  // granted: the piece lands, and the real weight refuses the next
  addItem(e.items, a);
  const c2 = ledger.take('body:1', { p: 0 }, a, 1, {}, 0);
  ledger.resolve(c2.id, 1);
  assert.equal(carriedWeight(e), 28);
  assert.equal(claimedCarryKg(e), 0);
  assert.ok(!fits(e, piece(8)), '28 + 8 is past 30');
});

test('CARRY-CLAIMS: a take off a fallen player\'s remains weighs on the gate until the room answers', () => {
  const e = player();
  const piles = [];
  const pool = { seedPile: (items) => { const p = { items, dead: false }; piles.push(p); return p; }, removePile: (p) => { const i = piles.indexOf(p); if (i >= 0) piles.splice(i, 1); } };
  const sent = [];
  const book = createWildRemains({
    send: (d) => { sent.push(d); return true; }, pool: () => pool, toScene: (x) => x, mine: () => false,
    pack: () => e.items, mint: (l) => l.map((x) => ({ ...x })), addItem: (list, item) => addItem(list, item), stacksWith, now: () => 0,
  });
  book.setRoom('cell:1,1'); book.setPool(pool);
  book.onWord({ k: 'ri', r: 'rrrrrr01', p: [0, 0, 0], nm: 'Them', os: null, oid: 'them', ttl: 600_000, off: 0, items: [piece(8), piece(8)], end: 2 }, 'cell:1,1');
  const pile = piles[0];
  const [a, b] = pile.items;
  // the window's take of the first: the gate passes it, it moves into the pack, the frame lifts it and asks the room
  assert.ok(fits(e, a));
  pile.items.splice(pile.items.indexOf(a), 1); addItem(e.items, a);
  book.tick();
  assert.deepEqual(sent.map((d) => [d.k, d.i]), [['take', 0]]);
  assert.equal(carriedWeight(e), 20, 'lifted back out until the room answers');
  assert.ok(!fits(e, b), 'the second take is refused while the first is in flight');
  // the room's `got`: the piece lands, and the real weight refuses the next
  book.onWord({ k: 'got', r: 'rrrrrr01', i: 0, it: { ...a } }, 'cell:1,1');
  assert.equal(carriedWeight(e), 28);
  assert.equal(claimedCarryKg(e), 0);
  assert.ok(!fits(e, b));
});

test('CARRY-CLAIMS: a room container\'s claims in flight are weighed (scenes/roomLootHost.js)', () => {
  const src = readFileSync(new URL('../../src/scenes/roomLootHost.js', import.meta.url), 'utf8');
  assert.match(src, /const give = roomLift\(obj, k\);\n\s+_roomMine\.set\([^\n]+\n\s+addCarryClaims\(roomClaimedKg, roomClaimedKg\);/);
  assert.match(src, /if \(!m\.claim \|\| m\.lapsed\) continue;/);
});
