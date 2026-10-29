// YC4 (bible/11-Multiplayer/Yard-Cells.md section 14.4) - THE HUB'S HOME CELL ARM, over the real relay Room
// (server/src/homeCellWords.js): the hub's welcome says it hears home cell orders; a carried order it verifies is said
// to every socket in the hub as one frame a second at most, each cell's highest version kept; a forged, expired or
// other kind's order is dropped; an order outside the hub is junk; a carrier's orders are metered on their own meter.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fakeRoom } from '../fakeRoom.mjs';
import { SOCIAL_ROOM, parseClient } from '../../src/net/wire.js';
import { mintHomeCellOrder, mintYardOrder } from '../../src/net/identityToken.js';
import {
  HOME_CELL_FAN_MS, HOME_CELL_WELCOME_FIELD, HOME_CELL_ORDER_HZ_MAX, HOME_CELL_WORDS_MAX, validHomeCellWord, validHomeCellFrame,
} from '../../src/net/homeCellWordLaw.js';
import { YARD_WELCOME_FIELD } from '../../src/net/yardWordLaw.js';
import { HOME_KEY_MAX } from '../../src/net/homeLaw.js';

const { subtle } = globalThis.crypto;
const T0 = 1_800_000_000;
const cellFrames = (ws) => ws.sent.filter((m) => m.t === 'hcell');
const yardFrames = (ws) => ws.sent.filter((m) => m.t === 'yard');

test('YC4 the client frame\'s shape: `{t:\'hcell\', order}` after a hello, an order a string of 1,024 at most', () => {
  assert.deepEqual(parseClient(JSON.stringify({ t: 'hcell', order: 'x.y.z' }), { hasHello: true }), { t: 'hcell', order: 'x.y.z' });
  assert.ok('error' in parseClient(JSON.stringify({ t: 'hcell', order: 'x.y.z' }), { hasHello: false }), 'before a hello');
  assert.ok('error' in parseClient(JSON.stringify({ t: 'hcell', order: 'x'.repeat(1025) }), { hasHello: true }));
  assert.deepEqual(parseClient(JSON.stringify({ t: 'hcell', order: 'x'.repeat(1024) }), { hasHello: true }), { t: 'hcell', order: 'x'.repeat(1024) });
  assert.ok('error' in parseClient(JSON.stringify({ t: 'hcell', order: 7 }), { hasHello: true }));
  assert.ok('error' in parseClient(JSON.stringify({ t: 'hcell', order: '' }), { hasHello: true }));
});

test('YC4 the word\'s law: `[m, c, v]`, a town, a cell to the widest and a version past 0; a frame of 1 to HOME_CELL_WORDS_MAX words, every one good', () => {
  const widest = Math.floor(HOME_KEY_MAX / 256);
  assert.deepEqual(validHomeCellWord([7, 1, 2]), [7, 1, 2]);
  assert.deepEqual(validHomeCellWord([7, widest, 1]), [7, widest, 1], 'BUILDING_KEY_0\'s cell');
  assert.equal(validHomeCellWord([7, widest + 1, 1]), null, 'past the widest cell');
  assert.equal(validHomeCellWord([7, -1, 1]), null);
  assert.equal(validHomeCellWord([7, 1, 0]), null, 'version 0 is no cell that moved');
  assert.equal(validHomeCellWord([-1, 1, 1]), null);
  assert.equal(validHomeCellWord([7, 1]), null);
  assert.equal(validHomeCellWord([7, 1.5, 1]), null);
  assert.deepEqual(validHomeCellFrame({ t: 'hcell', l: [[7, 1, 2], [7, 3, 4]] }), [[7, 1, 2], [7, 3, 4]]);
  assert.equal(validHomeCellFrame({ t: 'hcell', l: [] }), null, 'no words');
  assert.equal(validHomeCellFrame({ t: 'hcell', l: [[7, 1, 2], [7, 1, 0]] }), null, 'one bad word spoils the frame');
  const full = Array.from({ length: HOME_CELL_WORDS_MAX }, (_, i) => [7, i, 1]);
  assert.deepEqual(validHomeCellFrame({ t: 'hcell', l: full }), full, 'a full frame');
  assert.equal(validHomeCellFrame({ t: 'hcell', l: [...full, [7, 1, 1]] }), null, 'past the frame\'s bound');
  assert.equal(validHomeCellFrame(null), null);
});

test('YC4 the hub says it hears home cell orders; what it verifies is said to everyone in it as one frame a second, a cell\'s highest version kept; a forged, expired or yard order is dropped; the yards\' fan is apart (mutants: the welcome field, the fan\'s second, the highest version kept, the kind read)', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: T0 * 1000 });
  const hub = fakeRoom(SOCIAL_ROOM);
  const kp = await hub.signer();
  const a = hub.connect();
  const b = hub.connect();
  await hub.hello(a, 'aldric-0001');
  await hub.hello(b, 'questr-0002');
  const welcome = b.sent.find((m) => m.t === 'welcome');
  assert.equal(welcome?.[HOME_CELL_WELCOME_FIELD], 1, 'the hub\'s welcome');
  assert.equal(welcome?.[YARD_WELCOME_FIELD], 1, 'beside the yards\'');
  const nowS = Math.floor(Date.now() / 1000);
  const order = (c, v, over = {}) => mintHomeCellOrder({ s: 'acct-0001', m: 7, c, v, ...over }, kp.privateKey, { subtle, nowS });
  const carry = async (o) => hub.raw(a, JSON.stringify({ t: 'hcell', order: o }));

  await carry(await order(1, 2));
  t.mock.timers.tick(0);
  await Promise.resolve();
  for (const ws of [a, b]) assert.deepEqual(cellFrames(ws), [{ t: 'hcell', l: [[7, 1, 2]] }], 'everyone in the hub, the carrier too');
  assert.deepEqual(yardFrames(b), [], 'no yard word for a home cell');
  // inside the second: owed, the highest version of a cell kept
  t.mock.timers.tick(HOME_CELL_FAN_MS * 0.4);
  await carry(await order(1, 4));
  t.mock.timers.tick(HOME_CELL_FAN_MS * 0.4);
  await carry(await order(1, 3));
  await hub.raw(b, JSON.stringify({ t: 'hcell', order: await order(5, 1) }));   // another carrier: this one's meter is spent
  assert.equal(cellFrames(b).length, 1, 'no second frame inside the second');
  t.mock.timers.tick(HOME_CELL_FAN_MS * 0.2);
  assert.deepEqual(cellFrames(b).slice(1).map((m) => m.l), [[[7, 1, 4], [7, 5, 1]]], 'one frame, cell 1 at its highest');

  // dropped: a forged seal, a stranger's key, a yard order sent as a home cell one, an expired order
  const good = await order(9, 1);
  const forged = `${good.slice(0, good.lastIndexOf('.'))}.${'A'.repeat(86)}`;
  const other = await fakeRoom(SOCIAL_ROOM).signer();
  const stranger = await mintHomeCellOrder({ s: 'acct-0001', m: 7, c: 9, v: 1 }, other.privateKey, { subtle, nowS });
  const yard = await mintYardOrder({ s: 'acct-0001', m: 7, c: 9, v: 1 }, kp.privateKey, { subtle, nowS });
  const expired = await mintHomeCellOrder({ s: 'acct-0001', m: 7, c: 9, v: 1 }, kp.privateKey, { subtle, nowS: nowS - 600 });
  for (const o of [forged, stranger, yard, expired]) {
    t.mock.timers.tick(HOME_CELL_FAN_MS);
    await carry(o);
  }
  t.mock.timers.tick(HOME_CELL_FAN_MS * 2);
  assert.equal(cellFrames(b).length, 2, 'none said');
  assert.equal(yardFrames(b).length, 0, 'a yard order carried as a home cell one is no yard word either');

  // a home cell order carried as a yard one is refused at the yards' door
  await hub.raw(a, JSON.stringify({ t: 'yard', order: await order(11, 1) }));
  t.mock.timers.tick(HOME_CELL_FAN_MS * 2);
  assert.equal(yardFrames(b).length, 0, 'read at its own door alone');
  assert.equal(cellFrames(b).length, 2);
});

test('YC4 a home cell order outside the hub is junk, and a carrier past HOME_CELL_ORDER_HZ_MAX is metered on a meter apart from the yards\' (mutants: the hub alone, the meter shared)', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: T0 * 1000 });
  const town = fakeRoom('world-100-100');
  const kp = await town.signer();
  const ws = town.connect();
  await town.hello(ws, 'aldric-0001');
  const welcome = ws.sent.find((m) => m.t === 'welcome');
  assert.equal(welcome?.[HOME_CELL_WELCOME_FIELD], undefined, 'no room but the hub says it');
  const o = await mintHomeCellOrder({ s: 'acct-0001', m: 7, c: 1, v: 2 }, kp.privateKey, { subtle, nowS: Math.floor(Date.now() / 1000) });
  await town.raw(ws, JSON.stringify({ t: 'hcell', order: o }));
  t.mock.timers.tick(HOME_CELL_FAN_MS);
  assert.equal(cellFrames(ws).length, 0, 'not fanned in a town');

  const hub = fakeRoom(SOCIAL_ROOM);
  const hk = await hub.signer();
  const h = hub.connect();
  await hub.hello(h, 'aldric-0001');
  const nowS = Math.floor(Date.now() / 1000);
  for (let c = 1; c <= 4 * HOME_CELL_ORDER_HZ_MAX; c++) {
    await hub.raw(h, JSON.stringify({ t: 'hcell', order: await mintHomeCellOrder({ s: 'acct-0001', m: 7, c, v: 1 }, hk.privateKey, { subtle, nowS }) }));
  }
  t.mock.timers.tick(HOME_CELL_FAN_MS);
  const said = cellFrames(h).flatMap((m) => m.l);
  assert.ok(said.length >= 1 && said.length < 4 * HOME_CELL_ORDER_HZ_MAX, `metered: ${said.length} of ${4 * HOME_CELL_ORDER_HZ_MAX} in one instant`);
  const yardOrder = await mintYardOrder({ s: 'acct-0001', m: 7, c: 30, v: 1 }, hk.privateKey, { subtle, nowS });
  await hub.raw(h, JSON.stringify({ t: 'yard', order: yardOrder }));
  t.mock.timers.tick(HOME_CELL_FAN_MS);
  assert.deepEqual(yardFrames(h).flatMap((m) => m.l), [[7, 30, 1]], 'a spent home cell meter spends no yard order');
});
