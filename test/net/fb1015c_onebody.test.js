// FIELD BUGS 2026-10-15c - ONE-BODY, the Discord: "Happened after a server restart. can interact with them with menu.
// friend who is a duplicate of them is able to move around and can see them in world as well". A relay deploy drops
// every socket; a tab or a half-open socket that outlived it stood beside the account's new one in the cell - two bodies
// of one player, the friend's own page seeing the copy. Mac: "One body per account": a cell's room (`world:x,y`) and a
// world room (a dungeon's `dungeon:m<id>`, a building's `interior:m<id>.<n>`) close an account's older socket when it
// says hello again under another id (CLOSE_REPLACED, its leave said), as a gate's court, a siege's field and a Super
// dungeon's realm already did (server/src/index.js the hello's one-socket law). `01-Overview/bugs/Field-Bugs-2026-10-15c.md`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLOSE_REPLACED } from '../../src/net/wire.js';
import { fakeRoom } from '../fakeRoom.mjs';

const PLACES = ['world:3,12', 'dungeon:m123', 'interior:m100.200'];
const tobi = { name: 'Tobi', tokenSub: 'acct-tobi' };
const welcome = (ws) => ws.sent.find((m) => m.t === 'welcome');
const said = (ws, t, id) => ws.sent.filter((m) => m.t === t && m.id === id).length;

test('ONE-BODY: a place stands one body an account - in a cell, a dungeon and a building a second hello of the account under another id closes the older socket CLOSE_REPLACED, the new one\'s welcome names only the others, and the room hears the older one\'s leave (mutants: the cell rooms left out; the world rooms left out)', async () => {
  for (const key of PLACES) {
    const r = fakeRoom(key);
    const old = r.connect(); await r.hello(old, 'tobi-old1', null, tobi);
    const joker = r.connect(); await r.hello(joker, 'joker-001', null, { name: 'Joker', tokenSub: 'acct-joker' });
    assert.equal(old.closed, null, `${key}: one socket of the account stands`);
    const neu = r.connect(); await r.hello(neu, 'tobi-new1', null, tobi);
    assert.equal(old.closed?.code, CLOSE_REPLACED, `${key}: the older socket closed, replaced`);
    assert.deepEqual(old.sent.at(-1), { t: 'error', m: 'replaced' }, `${key}: and told why first`);
    assert.equal(neu.closed, null, `${key}: the new one stands`);
    assert.deepEqual(welcome(neu)?.peers.map((p) => p.id), ['joker-001'], `${key}: its welcome names the others alone, never its own older body`);
    assert.equal(said(joker, 'leave', 'tobi-old1'), 1, `${key}: the room hears the older body leave`);
    assert.equal(said(joker, 'join', 'tobi-new1'), 1, `${key}: and the new one join`);
    assert.equal(joker.closed, null, `${key}: another account is untouched`);
    assert.deepEqual(r.sockets, [joker, neu], `${key}: two sockets in the room, one an account`);
  }
});

test('ONE-BODY: the same peer id reconnecting is the reconnect it always was - its old socket closed CLOSE_REPLACED having lost the id first, silently (no error said, no leave for an id that lives on), the new one\'s welcome naming the others (mutants: none of the law\'s - this is what it must leave as it was)', async () => {
  for (const key of PLACES) {
    const r = fakeRoom(key);
    const old = r.connect(); await r.hello(old, 'tobi-old1', null, tobi);
    const joker = r.connect(); await r.hello(joker, 'joker-001', null, { name: 'Joker', tokenSub: 'acct-joker' });
    const again = r.connect(); await r.hello(again, 'tobi-old1', null, tobi);
    assert.equal(old.closed?.code, CLOSE_REPLACED, `${key}: replaced by its own id`);
    assert.equal(old.att.id, null, `${key}: the id lost before the close`);
    assert.equal(old.att.replaced, true);
    assert.equal(old.sent.some((m) => m.t === 'error'), false, `${key}: a reconnect is no refusal - nothing said to the old socket`);
    assert.equal(said(joker, 'leave', 'tobi-old1'), 0, `${key}: no leave for an id that lives on`);
    assert.equal(again.closed, null);
    assert.deepEqual(welcome(again)?.peers.map((p) => p.id), ['joker-001'], `${key}: the reconnect's welcome`);
    assert.deepEqual(r.sockets, [joker, again], `${key}: one socket an id`);
  }
});

test('ONE-BODY: two different accounts both stand in a place - the law is one body an ACCOUNT, never one a room (mutants: the cell rooms left out; the world rooms left out)', async () => {
  for (const key of PLACES) {
    const r = fakeRoom(key);
    const a = r.connect(); await r.hello(a, 'tobi-old1', null, tobi);
    const b = r.connect(); await r.hello(b, 'joker-001', null, { name: 'Joker', tokenSub: 'acct-joker' });
    const c = r.connect(); await r.hello(c, 'mira-0001', null, { name: 'Tobi', tokenSub: 'acct-mira' });   // even under the same name: a name is not an account
    assert.deepEqual([a.closed, b.closed, c.closed], [null, null, null], `${key}: three accounts, three bodies`);
    assert.deepEqual(welcome(c)?.peers.map((p) => p.id).sort(), ['joker-001', 'tobi-old1'], `${key}: each named to the next`);
    assert.equal(said(a, 'leave', 'joker-001') + said(b, 'leave', 'tobi-old1'), 0, `${key}: nobody's leave said`);
  }
  // and the mutants' own reach: each kind of place stands one body only while its own predicate is in the law
  const one = async (key) => { const r = fakeRoom(key); const x = r.connect(); await r.hello(x, 'tobi-old1', null, tobi); const y = r.connect(); await r.hello(y, 'tobi-new1', null, tobi); return x.closed?.code ?? null; };
  assert.equal(await one('world:-3,12'), CLOSE_REPLACED, 'a cell west of the Bay (a negative key) is a cell too');
  assert.equal(await one('dungeon:m123.s'), CLOSE_REPLACED, 'a re-laid dungeon\'s room is a world room too');
});
