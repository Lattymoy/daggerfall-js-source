// WILD1 (2026-10-07, bible/11-Multiplayer/Wild-Zone.md): THE `wild` FRAME - its law at both ends, and the relay that
// routes the directed half and keeps the room's remains.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseClient, validWildData, validWildOut, relaySupportsWild, WILD_RELAY_MIN, WILD_ITEMS_MAX, WILD_REMAINS_ITEMS_MAX,
  RELAY_VERSION, worldRoom, PIXEL_UNITS,
} from '../src/net/wire.js';
import { WILD_REMAINS_MS } from '../src/net/wire.js';
import { newRemains, foldFall, takeFrom, remainsWords, remainsEvict, remainsEmpty, remainsOf, wildRemainsKey } from '../src/net/wildLaw.js';
import { fakeRooms } from './fakeRoom.mjs';

const A = { lv: 5, r: 1, st: [50, 50, 50, 50, 50, 50, 50, 50], sk: [40, 30, 20, 10], cf: [0, 0, 0], h: [80, 100] };
const item = (n) => ({ group: 'Armor', templateIndex: 100 + n, stackCount: 1 });

test('WILD1 wire: the blows are the duel\'s own, projected without its sid; the death\'s three and the room\'s two are bounded', () => {
  const s = validWildData({ k: 'strike', to: 'peer-0002', n: 1, by: 'melee', p: [1000, 2, 1000], a: A, extra: 1 });
  assert.deepEqual(s, { to: 'peer-0002', k: 'strike', n: 1, by: 'melee', p: [1000, 2, 1000], a: A }, 'the duel\'s projection, no `s`, nothing extra');
  assert.equal(validWildData({ k: 'strike', to: 'peer-0002', n: 1, by: 'melee', p: [1000, 2, 1000] }), null, 'half a blow is nobody\'s');
  assert.deepEqual(validWildData({ k: 'worn', to: 'peer-0002', s: 'abcdef12', items: [] }), { to: 'peer-0002', k: 'worn', s: 'abcdef12', items: [] }, 'a body may offer nothing');
  assert.equal(validWildData({ k: 'pick', to: 'peer-0002', s: 'abcdef12', i: WILD_ITEMS_MAX }), null);
  assert.deepEqual(validWildData({ k: 'gave', to: 'peer-0002', s: 'abcdef12', i: 2, it: item(1) }).it, item(1));
  assert.equal(validWildData({ k: 'gave', to: 'peer-0002', s: 'abcdef12', i: 2, it: [1] }), null);
  const fall = { k: 'fall', r: 'rrrrrr01', p: [-5, 1, 12], items: [item(1)], last: 1 };
  assert.deepEqual(validWildData(fall), fall, 'a dungeon\'s point may be negative');
  assert.equal(validWildData({ ...fall, items: [] }), null, 'a deposit of nothing');
  assert.equal(validWildData({ ...fall, items: Array.from({ length: WILD_ITEMS_MAX + 1 }, (_, i) => item(i)) }), null);
  assert.equal(validWildData({ ...fall, last: 2 }), null);
  assert.deepEqual(validWildData({ k: 'take', r: 'rrrrrr01', i: 0, n: 3 }), { k: 'take', r: 'rrrrrr01', i: 0, n: 3 });
  assert.equal(validWildData({ k: 'take', r: 'rrrrrr01', i: WILD_REMAINS_ITEMS_MAX, n: 1 }), null);
  assert.equal(validWildData({ k: 'take', r: 'bad id!', i: 0, n: 1 }), null);
  assert.deepEqual(parseClient(JSON.stringify({ t: 'wild', data: fall }), { hasHello: true }), { t: 'wild', data: fall });
  assert.equal(parseClient(JSON.stringify({ t: 'wild', data: fall })).error, 'wild before hello');
  assert.equal(parseClient(JSON.stringify({ t: 'wild', data: { k: 'nope' } }), { hasHello: true }).error, 'bad wild');
});

test('WILD1 wire: the room\'s words back, and the relay that first carries the frame', () => {
  const ri = { k: 'ri', r: 'rrrrrr01', p: [1, 2, 3], nm: 'Ria', os: 'acct', oid: 'peer-0001', ttl: 1000, off: 0, items: [item(1), null], end: 1 };
  assert.deepEqual(validWildOut(ri), ri);
  assert.equal(validWildOut({ ...ri, ttl: WILD_REMAINS_MS + 1 }), null);   // PVPDUNGEONS: ten minutes after the two minutes' respawn
  assert.deepEqual(validWildOut({ k: 'rm', r: 'rrrrrr01', i: 1, n: 2 }), { k: 'rm', r: 'rrrrrr01', i: 1, n: 2 });
  assert.equal(validWildOut({ k: 'got', r: 'rrrrrr01', i: 1 }), null);
  assert.deepEqual(validWildOut({ k: 'gone', r: 'rrrrrr01' }), { k: 'gone', r: 'rrrrrr01' });
  assert.equal(WILD_RELAY_MIN, 177);   // the zone's one version, renumbered past main's SUPER-DUNGEONS (world176)
  assert.deepEqual(['world176', 'world177', 'junk', null].map(relaySupportsWild), [false, true, false, false]);
  assert.ok(relaySupportsWild(RELAY_VERSION));
});

test('WILD1 law: a remains is filled by its maker alone, taken record by record (a stack by its count), and said in chunks', () => {
  const rec = newRemains({ r: 'rrrrrr01', os: 'acct', oid: 'peer-0001', nm: 'Ria', p: [1, 2, 3], now: 1000 });
  assert.equal(foldFall(rec, { oid: 'peer-0002', items: [item(1)], last: 0 }), null, 'a stranger adds nothing');
  assert.deepEqual(foldFall(rec, { oid: 'peer-0001', items: [item(1), { ...item(2), stackCount: 5 }], last: 0 }).off, 0);
  assert.deepEqual(foldFall(rec, { oid: 'peer-0001', items: Array.from({ length: 16 }, (_, i) => item(i + 3)), last: 1 }).off, 2);
  assert.equal(foldFall(rec, { oid: 'peer-0001', items: [item(99)], last: 1 }), null, 'closed');
  assert.deepEqual(takeFrom(rec, 1, 2), { it: { ...item(2), stackCount: 2 }, n: 2 }, 'part of a stack');
  assert.equal(rec.items[1].stackCount, 3);
  assert.deepEqual(takeFrom(rec, 1, 9).n, 3, 'the rest of it');
  assert.equal(rec.items[1], null);
  assert.equal(takeFrom(rec, 1, 1), null, 'nothing there twice');
  const words = remainsWords(rec, 1500);
  assert.deepEqual(words.map((w) => [w.off, w.items.length, w.end]), [[0, 16, 0], [16, 2, 1]]);
  assert.equal(words[0].ttl, WILD_REMAINS_MS - 500);
  assert.deepEqual(remainsWords(rec, 1000 + WILD_REMAINS_MS), [], 'its time up: nothing said');
  for (let i = 0; i < rec.items.length; i++) takeFrom(rec, i, 99);
  assert.ok(remainsEmpty(rec));
  assert.deepEqual(remainsOf(JSON.parse(JSON.stringify(rec))).r, 'rrrrrr01');
  const map = new Map(Array.from({ length: 24 }, (_, i) => [`r${i}`, { r: `r${i}`, at: 100 - i }]));
  assert.equal(remainsEvict(map), 'r23', 'the oldest makes room');
});

const PX = 400, PY = 120, CELL = worldRoom(PX, PY);
const ON = { x: PX * PIXEL_UNITS + 16384, y: 0, z: (499 - PY) * PIXEL_UNITS + 16384, yaw: 0, pitch: 0 };
const wilds = (ws, k) => ws.sent.filter((m) => m.t === 'wild' && (!k || m.k === k));

test('WILD1 relay: a deposit is kept and said to the room, the first take wins, a late hello hears what is left, a blow is routed with its account', async () => {
  const world = fakeRooms();
  const r = world.room(CELL);
  const a = r.connect(), b = r.connect(), c = r.connect();
  await r.hello(a, 'peer-0001', ON); await r.hello(b, 'peer-0002', ON); await r.hello(c, 'peer-0003', ON);
  const say = (ws, data) => r.raw(ws, JSON.stringify({ t: 'wild', data }));
  await say(a, { k: 'fall', r: 'rrrrrr01', p: [1, 2, 3], items: [item(1), { ...item(2), stackCount: 4 }], last: 1 });
  const ri = wilds(b, 'ri');
  assert.equal(ri.length, 1);
  assert.deepEqual([ri[0].off, ri[0].items.length, ri[0].end, ri[0].oid], [0, 2, 1, 'peer-0001']);
  assert.ok(r.store.get(wildRemainsKey('rrrrrr01')), 'written');
  await say(b, { k: 'take', r: 'rrrrrr01', i: 0, n: 1 });
  await say(c, { k: 'take', r: 'rrrrrr01', i: 0, n: 1 });
  assert.deepEqual(wilds(b, 'got').map((m) => m.it.templateIndex), [101], 'the first take wins the record');
  assert.deepEqual(wilds(c, 'no'), [{ t: 'wild', k: 'no', r: 'rrrrrr01', i: 0 }], 'the second is told no');
  assert.deepEqual(wilds(a, 'rm'), [{ t: 'wild', k: 'rm', r: 'rrrrrr01', i: 0, n: 1 }], 'the room hears what left');
  const d = r.connect();
  await r.hello(d, 'peer-0004', ON);
  assert.deepEqual(wilds(d, 'ri')[0].items, [null, { ...item(2), stackCount: 4 }], 'a late hello hears what is left');
  await say(b, { k: 'take', r: 'rrrrrr01', i: 1, n: 4 });
  assert.deepEqual(wilds(a, 'gone'), [{ t: 'wild', k: 'gone', r: 'rrrrrr01' }], 'emptied: gone');
  assert.equal(r.store.get(wildRemainsKey('rrrrrr01')), undefined);
  await say(a, { k: 'strike', to: 'peer-0002', n: 1, by: 'melee', p: [1000, 2, 1000], a: A });
  const blow = b.sent.filter((m) => m.t === 'wild' && m.data).at(-1);
  assert.equal(blow.id, 'peer-0001');
  assert.equal(typeof blow.sub, 'string', 'the account as the relay verified it');
  assert.equal(c.sent.filter((m) => m.t === 'wild' && m.data).length, 0, 'to its target alone');
});
