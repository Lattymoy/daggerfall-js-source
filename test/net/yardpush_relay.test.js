// YARD-CELL YC2 (bible/11-Multiplayer/Yard-Cells.md section 3.6) - THE HUB'S YARD ARM, over the real relay Room
// (server/src/yardWords.js): the hub's welcome says it hears yard orders; a carried order it verifies is said to every
// socket in the hub as one frame a second at most, each cell's highest version kept; a forged, expired or other kind's
// order is dropped; an order outside the hub is junk; a carrier's orders are metered.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fakeRoom } from '../fakeRoom.mjs';
import { SOCIAL_ROOM, parseClient } from '../../src/net/wire.js';
import { mintYardOrder, mintHomeOrder } from '../../src/net/identityToken.js';
import { YARD_FAN_MS, YARD_WELCOME_FIELD, YARD_ORDER_HZ_MAX } from '../../src/net/yardWordLaw.js';

const { subtle } = globalThis.crypto;
const T0 = 1_800_000_000;
const yardFrames = (ws) => ws.sent.filter((m) => m.t === 'yard');

test('YARD-CELL YC2 the client frame\'s shape: `{t:\'yard\', order}` after a hello, an order a string of 1,024 at most', () => {
  assert.deepEqual(parseClient(JSON.stringify({ t: 'yard', order: 'x.y.z' }), { hasHello: true }), { t: 'yard', order: 'x.y.z' });
  assert.ok('error' in parseClient(JSON.stringify({ t: 'yard', order: 'x.y.z' }), { hasHello: false }), 'before a hello');
  assert.ok('error' in parseClient(JSON.stringify({ t: 'yard', order: 'x'.repeat(1025) }), { hasHello: true }));
  assert.ok('error' in parseClient(JSON.stringify({ t: 'yard', order: 7 }), { hasHello: true }));
});

test('YARD-CELL YC2 the hub says it hears yard orders; what it verifies is said to everyone in it as one frame a second, a cell\'s highest version kept; a forged, expired or home order is dropped (mutants: the welcome field, the fan\'s second, the highest version, the kind)', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: T0 * 1000 });
  const hub = fakeRoom(SOCIAL_ROOM);
  const kp = await hub.signer();
  const a = hub.connect();
  const b = hub.connect();
  await hub.hello(a, 'aldric-0001');
  await hub.hello(b, 'questr-0002');
  const welcome = b.sent.find((m) => m.t === 'welcome');
  assert.equal(welcome?.[YARD_WELCOME_FIELD], 1, 'the hub\'s welcome');
  const nowS = Math.floor(Date.now() / 1000);
  const order = (c, v, over = {}) => mintYardOrder({ s: 'acct-0001', m: 7, c, v, ...over }, kp.privateKey, { subtle, nowS });
  const carry = async (o) => hub.raw(a, JSON.stringify({ t: 'yard', order: o }));

  await carry(await order(1, 2));
  t.mock.timers.tick(0);
  await Promise.resolve();
  for (const ws of [a, b]) assert.deepEqual(yardFrames(ws), [{ t: 'yard', l: [[7, 1, 2]] }], 'everyone in the hub, the carrier too');
  // inside the second: owed, the highest version of a cell kept
  t.mock.timers.tick(YARD_FAN_MS * 0.4);
  await carry(await order(1, 4));
  t.mock.timers.tick(YARD_FAN_MS * 0.4);
  await carry(await order(1, 3));
  await hub.raw(b, JSON.stringify({ t: 'yard', order: await order(5, 1) }));   // another carrier: this one's meter is spent
  assert.equal(yardFrames(b).length, 1, 'no second frame inside the second');
  t.mock.timers.tick(YARD_FAN_MS * 0.2);
  assert.deepEqual(yardFrames(b).slice(1).map((m) => m.l), [[[7, 1, 4], [7, 5, 1]]], 'one frame, cell 1 at its highest');

  // dropped: a forged seal, an expired order, a home order sent as a yard one
  const good = await order(9, 1);
  const forged = `${good.slice(0, good.lastIndexOf('.'))}.${'A'.repeat(86)}`;
  const other = await fakeRoom(SOCIAL_ROOM).signer();
  const stranger = await mintYardOrder({ s: 'acct-0001', m: 7, c: 9, v: 1 }, other.privateKey, { subtle, nowS });
  const home = await mintHomeOrder({ s: 'acct-0001', bm: 7, bu: [300] }, kp.privateKey, { subtle, nowS });
  const expired = await mintYardOrder({ s: 'acct-0001', m: 7, c: 9, v: 1 }, kp.privateKey, { subtle, nowS: nowS - 600 });
  for (const o of [forged, stranger, home, expired]) {
    t.mock.timers.tick(YARD_FAN_MS);
    await carry(o);
  }
  t.mock.timers.tick(YARD_FAN_MS * 2);
  assert.equal(yardFrames(b).length, 2, 'none said');
});

test('YARD-CELL YC2 a yard order outside the hub is junk, and a carrier past YARD_ORDER_HZ_MAX is metered', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: T0 * 1000 });
  const town = fakeRoom('world-100-100');
  const kp = await town.signer();
  const ws = town.connect();
  await town.hello(ws, 'aldric-0001');
  const welcome = ws.sent.find((m) => m.t === 'welcome');
  assert.equal(welcome?.[YARD_WELCOME_FIELD], undefined, 'no room but the hub says it');
  const o = await mintYardOrder({ s: 'acct-0001', m: 7, c: 1, v: 2 }, kp.privateKey, { subtle, nowS: Math.floor(Date.now() / 1000) });
  await town.raw(ws, JSON.stringify({ t: 'yard', order: o }));
  t.mock.timers.tick(YARD_FAN_MS);
  assert.equal(yardFrames(ws).length, 0, 'not fanned in a town');

  const hub = fakeRoom(SOCIAL_ROOM);
  const hk = await hub.signer();
  const h = hub.connect();
  await hub.hello(h, 'aldric-0001');
  const nowS = Math.floor(Date.now() / 1000);
  for (let c = 1; c <= 4 * YARD_ORDER_HZ_MAX; c++) {
    await hub.raw(h, JSON.stringify({ t: 'yard', order: await mintYardOrder({ s: 'acct-0001', m: 7, c, v: 1 }, hk.privateKey, { subtle, nowS }) }));
  }
  t.mock.timers.tick(YARD_FAN_MS);
  const said = yardFrames(h).flatMap((m) => m.l);
  assert.ok(said.length >= 1 && said.length < 4 * YARD_ORDER_HZ_MAX, `metered: ${said.length} of ${4 * YARD_ORDER_HZ_MAX} in one instant`);
});
