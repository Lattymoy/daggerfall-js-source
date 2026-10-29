// YC4 (bible/11-Multiplayer/Yard-Cells.md section 14.4): THE HOME CELL ORDER - a home write that moved a cell answers
// the service's signed word on each cell it moved, which the acting client carries to the hub.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from '../accountDb.mjs';
import { ORDER_KINDS, orderValid, mintHomeCellOrder, mintYardOrder, verifyOrder } from '../../src/net/identityToken.js';
import { yardCellOf } from '../../src/net/yardCellLaw.js';
import { HOME_KEY_MAX } from '../../src/net/homeLaw.js';

const { subtle } = globalThis.crypto;

test('YC4 the home cell order\'s law: its own seven keys and no other, a town, a cell and a version past 0; the yard order keeps its own; no other kind carries `m`, `c` or `v` (mutants: the rule not widened, the version 0 let in)', async () => {
  assert.ok(ORDER_KINDS.includes('hcell'));
  const good = { o: 'hcell', s: 'acct-0001', m: 7, c: 1, v: 3, i: 1000, e: 1060 };
  assert.equal(orderValid(good), true);
  assert.equal(orderValid({ ...good, o: 'yard' }), true, 'the yard order, the same shape under its own kind');
  assert.equal(orderValid({ ...good, bm: 7 }), false, 'a home order\'s field on a home cell order');
  assert.equal(orderValid({ ...good, x: 1 }), false, 'a key of no kind');
  assert.equal(orderValid({ ...good, v: 0 }), false, 'version 0 is no cell that moved');
  assert.equal(orderValid({ ...good, v: undefined }), false, 'a version it must carry');
  assert.equal(orderValid({ ...good, c: -1 }), false);
  assert.equal(orderValid({ ...good, c: Math.floor(HOME_KEY_MAX / 256) + 1 }), false, 'past the widest cell');
  assert.equal(orderValid({ ...good, c: Math.floor(HOME_KEY_MAX / 256) }), true, 'BUILDING_KEY_0\'s cell');
  assert.equal(orderValid({ ...good, m: -1 }), false);
  assert.equal(orderValid({ o: 'mute', s: 'acct-0001', mu: 0, v: 3, i: 1000, e: 1060 }), false, 'a mute carrying a version');
  assert.equal(orderValid({ o: 'home', s: 'acct-0001', bm: 7, bu: [300], c: 1, i: 1000, e: 1060 }), false, 'a home order carrying a cell');
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const order = await mintHomeCellOrder({ s: 'acct-0001', m: 7, c: 1, v: 3 }, kp.privateKey, { subtle, nowS: 1000 });
  assert.deepEqual((await verifyOrder(order, kp.publicKey, { subtle, nowS: 1001, kind: 'hcell' })).claims, good);
  assert.equal((await verifyOrder(order, kp.publicKey, { subtle, nowS: 1001, kind: 'yard' })).ok, false, 'read at its own door alone');
  const yard = await mintYardOrder({ s: 'acct-0001', m: 7, c: 1, v: 3 }, kp.privateKey, { subtle, nowS: 1000 });
  assert.equal((await verifyOrder(yard, kp.publicKey, { subtle, nowS: 1001, kind: 'hcell' })).ok, false, 'a yard order is no home cell order');
  assert.equal((await verifyOrder(order, kp.publicKey, { subtle, nowS: 1061 + 60, kind: 'hcell' })).ok, false, 'past its time');
  const forged = `${order.slice(0, order.lastIndexOf('.'))}.${'A'.repeat(86)}`;
  assert.equal((await verifyOrder(forged, kp.publicKey, { subtle, nowS: 1001, kind: 'hcell' })).ok, false, 'a forged seal');
  await assert.rejects(mintHomeCellOrder({ s: 'acct-0001', m: 7, c: 1, v: 0 }, kp.privateKey, { subtle, nowS: 1000 }), TypeError, 'it mints none it could not verify');
});

test('YC4 over the real Worker: a home write answers a signed order for the cell it moved, each write a higher version, the version the cells route answers; the internal list never leaves the service; a refused write answers none (mutants: the list kept in the answer, the order\'s version)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const svc = await standService();
  const owner = await svc.registered('Olga');
  const stranger = await svc.registered('Sven');
  const claimsOf = (body) => Promise.all((body.homeCellOrders ?? []).map(async (o) => (await verifyOrder(o, svc.identityPublic, { subtle, nowS: T0 + 1, kind: 'hcell' })).claims));

  const claimed = await svc.seatHome(owner, { mapId: 7, buildingKey: 300, region: 17, price: 5000 });
  assert.equal(claimed.status, 200, JSON.stringify(claimed.body));
  assert.equal('homeCellsMoved' in claimed.body, false, 'the service\'s own list, signed in its place');
  const first = await claimsOf(claimed.body);
  assert.equal(first.length, 1);
  assert.deepEqual([first[0].o, first[0].s, first[0].m, first[0].c], ['hcell', owner.id, 7, yardCellOf(300)]);
  const asked = await svc.call('/v1/homes/cells', { mapId: 7, cells: [[yardCellOf(300), 0]] }, stranger.secret);
  assert.equal(asked.body.cells[0].ver, first[0].v, 'the version a page asking the cell reads');

  const entry = await svc.call('/v1/homes/entry', { mapId: 7, buildingKey: 300, entry: 'public' }, owner.secret);
  assert.equal(entry.status, 200, JSON.stringify(entry.body));
  assert.equal('homeCellsMoved' in entry.body, false);
  const second = await claimsOf(entry.body);
  assert.equal(second.length, 1);
  assert.ok(second[0].v > first[0].v, 'an entry changed climbs the version');

  const refused = await svc.call('/v1/homes/entry', { mapId: 7, buildingKey: 300, entry: 'public' }, stranger.secret);
  assert.notEqual(refused.status, 200, 'not the stranger\'s home');
  assert.equal(refused.body?.homeCellOrders, undefined);
  assert.equal(refused.body?.homeCellsMoved, undefined);
});
