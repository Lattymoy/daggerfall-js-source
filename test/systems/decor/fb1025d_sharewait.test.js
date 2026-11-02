// FIELD BUGS 2026-10-25d HOME-SHARE-WAIT ("Disappearing House Storage: Items placed inside house storage randomly
// disappear"; bible/01-Overview/bugs/Field-Bugs-2026-10-25d.md). The owner's shared chest opened the save's window until
// the service said it was shared - and for the whole visit when that answer never came. A shared chest's goods are the
// service's, so the window showed it empty, and what went in there was hidden behind the bin. The owner's chest in an
// online home now opens only once the answer stands, and an answer for an earlier room is not this room's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noteDecorGrants, bindDecorHouse, openOwnChest } from '../../../src/systems/decor/decorGrants.js';

const ROOM = { mapId: 1291010263, buildingKey: 0x10203 };
const flush = () => new Promise((r) => { setTimeout(r, 0); });

/** A grants door whose answers the test hands out, one ask at a time. */
function grantsDoor() {
  const asks = [];
  return {
    asks,
    use: (body) => new Promise((resolve, reject) => { asks.push({ body, resolve, reject }); }),
    answer: (i, data) => asks[i].resolve(data === null ? { ok: false, error: 'offline' } : { ok: true, data }),
    fail: (i) => asks[i].reject(new Error('the network went')),
  };
}

/** The chest door the room binds (decorGrants.js bindDecorHouseFrom's shape), recording what it was asked. */
function chestDoor() {
  const said = [];
  const lists = [];
  const opened = [];
  bindDecorHouse({
    ...ROOM, character: () => 'r0123456789abcdef0123',
    use: async (body) => { lists.push(body); return { ok: true, data: { items: [] } }; },
    open: (spec) => { opened.push(spec); return {}; },
    items: () => [], take() {}, give() {}, realm: () => null,
    say: (line) => said.push(line),
  });
  return { said, lists, opened };
}

/** Presses the owner's chest `id`; answers whether the save's window opened. */
const press = (id, online = true) => {
  let saved = false;
  openOwnChest(id, online, () => { saved = true; });
  return saved;
};

const SHARED_P1 = { storage: ['p1', 'p2'], station: [], bin: ['p1'], use: [{ id: 'p1', mode: 'friends' }] };

test('HOME-SHARE-WAIT the owner\'s chest stays shut until the service says which chests are shared, then a shared one opens the bin and a private one the save', async () => {
  const grants = grantsDoor();
  const door = chestDoor();
  noteDecorGrants(grants, ROOM.mapId, ROOM.buildingKey, 'r0123456789abcdef0123');
  assert.equal(press('p1'), false, 'no save window before the answer');
  assert.deepEqual(door.said, ['The chest stays shut.']);
  assert.equal(grants.asks.length, 1, 'the ask still out is not asked again');
  grants.answer(0, SHARED_P1);
  await flush();
  assert.equal(press('p1'), false, 'a shared chest never opens the save\'s window');
  await flush();
  assert.equal(door.lists.at(-1)?.op, 'list', 'it opens the service\'s bin');
  assert.equal(door.lists.at(-1)?.id, 'p1');
  assert.equal(press('p2'), true, 'a private chest opens the save\'s window');
});

test('HOME-SHARE-WAIT a grants ask refused or unanswered is asked again at the next press, and the chest opens once it is answered', async () => {
  const grants = grantsDoor();
  chestDoor();
  noteDecorGrants(grants, ROOM.mapId, ROOM.buildingKey, 'r0123456789abcdef0123');
  grants.answer(0, null);
  await flush();
  assert.equal(press('p2'), false, 'refused: still shut');
  assert.equal(grants.asks.length, 2, 'and asked again');
  assert.equal(press('p2'), false);
  assert.equal(grants.asks.length, 2, 'once while that ask is out');
  grants.answer(1, SHARED_P1);
  await flush();
  assert.equal(press('p2'), true);
});

test('HOME-SHARE-WAIT a grants ask that throws is asked again at the next press', async () => {
  const grants = grantsDoor();
  chestDoor();
  noteDecorGrants(grants, ROOM.mapId, ROOM.buildingKey, 'r0123456789abcdef0123');
  grants.fail(0);
  await flush();
  assert.equal(press('p2'), false);
  assert.equal(grants.asks.length, 2, 'the thrown ask is no longer out');
});

test('HOME-SHARE-WAIT a room with no grants door shares no chest, and the owner\'s opens the save\'s window', () => {
  chestDoor();
  noteDecorGrants({}, ROOM.mapId, ROOM.buildingKey, 'r0123456789abcdef0123');
  assert.equal(press('p1'), true);
});

test('HOME-SHARE-WAIT an answer for an earlier room never stands for this one', async () => {
  const grants = grantsDoor();
  chestDoor();
  noteDecorGrants(grants, ROOM.mapId, ROOM.buildingKey, 'r0123456789abcdef0123');
  noteDecorGrants(grants, ROOM.mapId, ROOM.buildingKey + 1, 'r0123456789abcdef0123');
  grants.answer(1, { storage: ['p1'], station: [], bin: [], use: [] });
  await flush();
  grants.answer(0, SHARED_P1);
  await flush();
  assert.equal(press('p1'), true, 'this room\'s answer: p1 is private here');
});

test('HOME-SHARE-WAIT outside an online home the owner\'s storage opens the save\'s window at once', () => {
  const grants = grantsDoor();
  chestDoor();
  noteDecorGrants(grants, ROOM.mapId, ROOM.buildingKey, 'r0123456789abcdef0123');
  assert.equal(press('p1', false), true, 'an offline house or a ship: its storage is the save\'s');
});
