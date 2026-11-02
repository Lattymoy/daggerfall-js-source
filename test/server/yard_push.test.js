// YARD-CELL YC2 (bible/11-Multiplayer/Yard-Cells.md section 3.6): THE YARD ORDER - a decor write that moved a yard
// answers with the cell's new version and the service's signed word on it, which the acting client carries to the hub.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from '../accountDb.mjs';
import { ORDER_KINDS, orderValid, mintYardOrder, verifyOrder } from '../../src/net/identityToken.js';
import { yardCellOf } from '../../src/net/yardCellLaw.js';
import { HOME_KEY_MAX } from '../../src/net/homeLaw.js';

const { subtle } = globalThis.crypto;
const piece = (over = {}) => ({ id: 'yard1', model: 41000, flat: null, pos: [8, 0, 2], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 120, ...over });

test('YARD-CELL YC2 the yard order\'s law: its own seven keys and no other, a town, a cell and a version past 0; no other kind carries `m`, `c` or `v`', async () => {
  assert.ok(ORDER_KINDS.includes('yard'));
  const good = { o: 'yard', s: 'acct-0001', m: 7, c: 1, v: 3, i: 1000, e: 1060 };
  assert.equal(orderValid(good), true);
  assert.equal(orderValid({ ...good, bm: 7 }), false, 'a home order\'s field on a yard order');
  assert.equal(orderValid({ ...good, x: 1 }), false, 'a key of no kind');
  assert.equal(orderValid({ ...good, v: 0 }), false, 'version 0 is no cell that moved');
  assert.equal(orderValid({ ...good, c: -1 }), false);
  assert.equal(orderValid({ ...good, c: Math.floor(HOME_KEY_MAX / 256) + 1 }), false, 'past the widest cell');
  assert.equal(orderValid({ ...good, c: Math.floor(HOME_KEY_MAX / 256) }), true, 'BUILDING_KEY_0\'s cell');
  assert.equal(orderValid({ ...good, m: -1 }), false);
  assert.equal(orderValid({ o: 'mute', s: 'acct-0001', mu: 0, v: 3, i: 1000, e: 1060 }), false, 'a mute carrying a version');
  assert.equal(orderValid({ o: 'home', s: 'acct-0001', bm: 7, bu: [300], c: 1, i: 1000, e: 1060 }), false, 'a home order carrying a cell');
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const order = await mintYardOrder({ s: 'acct-0001', m: 7, c: 1, v: 3 }, kp.privateKey, { subtle, nowS: 1000 });
  assert.deepEqual((await verifyOrder(order, kp.publicKey, { subtle, nowS: 1001, kind: 'yard' })).claims, good);
  assert.equal((await verifyOrder(order, kp.publicKey, { subtle, nowS: 1001, kind: 'home' })).ok, false, 'read at its own door alone');
  assert.equal((await verifyOrder(order, kp.publicKey, { subtle, nowS: 1061 + 60, kind: 'yard' })).ok, false, 'past its time');
  const forged = `${order.slice(0, order.lastIndexOf('.'))}.${'A'.repeat(86)}`;
  assert.equal((await verifyOrder(forged, kp.publicKey, { subtle, nowS: 1001, kind: 'yard' })).ok, false, 'a forged seal');
});

test('YARD-CELL YC2 over the real Worker: a yard write answers its cell\'s new version and an order for it, each write a higher one; a room\'s write and a refused write answer none', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const svc = await standService();
  const raw = svc.env.DB._raw;
  const owner = await svc.registered('Olga');
  const o = await svc.seatHome(owner, { mapId: 7, buildingKey: 300, region: 17, price: 5000 });
  const at = () => ({ id: o.character, ...raw.prepare('SELECT lease, seq FROM realm_characters WHERE id = ?').get(o.character) });
  const call = (route, body) => svc.call(`/v1/homes/decor/${route}`, { mapId: 7, buildingKey: 300, character: o.character, realm: at(), ...body }, owner.secret);
  const claimsOf = async (body) => (await verifyOrder(body.yardOrder, svc.identityPublic, { subtle, nowS: T0 + 1, kind: 'yard' })).claims;

  const placed = await call('place', { yard: true, piece: piece() });
  assert.equal(placed.status, 200, JSON.stringify(placed.body));
  const first = await claimsOf(placed.body);
  assert.deepEqual([first.o, first.s, first.m, first.c, first.v], ['yard', owner.id, 7, yardCellOf(300), placed.body.yardVer]);
  assert.ok(placed.body.yardVer > 0);
  assert.equal(raw.prepare('SELECT built FROM home_yard_cells WHERE map_id = 7 AND cell = ?').get(yardCellOf(300)).built, placed.body.yardVer, 'the version the settle built');

  const moved = await call('move', { id: 'yard1', place: { pos: [9, 0, 2], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 120 } });
  assert.equal(moved.status, 200, JSON.stringify(moved.body));
  assert.ok(moved.body.yardVer > placed.body.yardVer, 'a move climbs the version');
  assert.equal((await claimsOf(moved.body)).v, moved.body.yardVer);

  const room = await call('place', { piece: piece({ id: 'room1' }) });
  assert.equal(room.status, 200, JSON.stringify(room.body));
  assert.equal(room.body.yardOrder, undefined, 'a room\'s piece moved no yard');
  assert.equal(room.body.yardVer, undefined);

  const refused = await call('place', { yard: true, piece: piece() });
  assert.notEqual(refused.status, 200, 'the same id twice');
  assert.equal(refused.body?.yardOrder, undefined);
});
