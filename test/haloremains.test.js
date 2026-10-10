// HALO-REMAINS (2026-10-09, the owner: "i died in the pvp zone again and still my pile isnt there", "other players can
// see the pile but you dont see your own"). The relay says a room's remains at a socket's HELLO alone. Walking back to
// them, a player hello's their cell as a HALO first (from the cell beside it): the halo's words were dropped
// (net/online.js delivered a room's wild word on the primary socket only), and crossing into the cell PROMOTES that
// socket with no new hello - so the remains were never said again and the fallen's own pile never stood. Players who
// were in the cell when it fell heard it at the fall. The laws pinned here:
//   - net/online.js delivers a halo's room word with its room; a take goes to the socket of the room that keeps the pile
//     (INT9's sendWild `{ room }`); heldRooms() names my room and the halo's.
//   - net/wildRemains.js keeps a record per room; a room still held keeps its piles across the crossing; a room let go
//     takes its own alone.
//   - scenes/world.js hands the book every room it holds, and the take's room to sendWild.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createWildRemains } from '../src/net/wildRemains.js';
import { OnlineSession } from '../src/net/online.js';

const pool = () => {
  const piles = [];
  return { piles, seedPile: (items, at) => { const p = { items, at, dead: false }; piles.push(p); return p; }, removePile: (p) => { const i = piles.indexOf(p); if (i >= 0) piles.splice(i, 1); } };
};
const HERE = 'cell:10,10', NEXT = 'cell:11,10';
const ri = (r, oid = 'me') => ({ k: 'ri', r, p: [1, 2, 3], nm: 'Me', os: null, oid, ttl: 600_000, off: 0, items: [{ group: 'Armor', templateIndex: 101 }], end: 1 });

test('HALO-REMAINS: my pile said by the cell beside mine stands, and it stays when I cross into that cell', () => {
  const p = pool(), sent = [];
  const book = createWildRemains({ send: (d, room) => { sent.push([d, room]); return true; }, pool: () => p, toScene: (x) => x, mine: (rec) => rec.oid === 'me', pack: () => [], mint: (l) => l.map((x) => ({ ...x })), addItem: () => {}, stacksWith: () => false, now: () => 0 });
  book.setRooms([HERE, NEXT]); book.setPool(p);
  book.onWord(ri('rrrrrr01'), NEXT);   // the halo's hello says it
  assert.equal(p.piles.length, 1, 'the pile stands though its room is the halo');
  assert.deepEqual(book.mineHere().map((r) => r.r), ['rrrrrr01']);
  book.setRooms([NEXT, HERE]);   // the crossing: promoted, demoted - both still held
  assert.equal(p.piles.length, 1, 'the crossing keeps it (no hello will say it again)');
  // a take from it goes to the room that keeps it
  p.piles[0].items.length = 0;
  book.tick();
  assert.deepEqual(sent.map(([d, room]) => [d.k, room]), [['take', NEXT]]);
  // a room let go takes its own piles alone
  book.onWord(ri('rrrrrr02', 'x'), HERE);
  book.setRooms([NEXT]);
  assert.deepEqual(book.list().map((r) => r.r), ['rrrrrr01'], 'HERE let go takes its pile; the halo\'s stays');
  book.setRooms([]);
  assert.deepEqual(book.list(), [], 'every room let go: every record down');
});

test('HALO-REMAINS: one room named with setRoom keeps the old single-room behaviour', () => {
  const p = pool();
  const book = createWildRemains({ send: () => true, pool: () => p, toScene: (x) => x, mine: () => true, pack: () => [], mint: (l) => l, addItem: () => {}, stacksWith: () => false, now: () => 0 });
  book.setRoom(HERE); book.setPool(p);
  book.onWord(ri('rrrrrr03'));
  assert.equal(p.piles.length, 1);
  book.setRoom(NEXT);
  assert.equal(p.piles.length, 0, 'another room: the piles go');
});

test('HALO-REMAINS: the session delivers a halo\'s room word, sends a take to the pile\'s room, and names the rooms it holds', () => {
  const src = readFileSync(new URL('../src/net/online.js', import.meta.url), 'utf8');
  const arm = src.slice(src.indexOf("} else if (m.t === 'wild') {"), src.indexOf("} else if (m.t === 'arena') {"));
  assert.doesNotMatch(arm, /else if \(primary\)/, 'no primary-only gate on the room\'s word');
  assert.match(arm, /this\._deliver\('wild', \(\) => this\.onWildRoom\?\.\(o, room\)\)/);
  // the take's room: main's INT9 sendWild carries it (`{ room }`) - a held halo's socket while its relay routes the zone
  const s = Object.create(OnlineSession.prototype);
  const out = { own: [], halo: [] };
  const own = { send: (x) => out.own.push(JSON.parse(x).data) }, halo = { send: (x) => out.halo.push(JSON.parse(x).data) };
  Object.assign(s, { id: 'me-0001', room: HERE, status: 'open', wildOk: true, _ws: own, _wildBucket: null, _now: () => 0, stats: { sent: 0 }, _halo: new Map([[NEXT, { ws: halo, status: 'open', wildOk: true }], ['cell:9,9', { ws: null, status: 'connecting' }]]) });
  const take = { k: 'take', r: '0123456789ab', i: 0, n: 1 };
  assert.equal(s.sendWild(take, { room: NEXT }), true);
  assert.equal(out.halo.length, 1, 'a halo\'s room: its socket');
  assert.equal(s.sendWild(take, { room: HERE }), true);
  assert.equal(s.sendWild(take), true);
  assert.equal(out.own.length, 2, 'my room, named or not: my own socket');
  assert.equal(s.sendWild(take, { room: 'cell:9,9' }), false, 'a halo not open: nothing');
  assert.deepEqual(s.heldRooms(), [HERE, NEXT, 'cell:9,9']);
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(w, /send: \(d, room\) => online\?\.sendWild\(d, \{ room \}\) === true,/);
  assert.match(w, /wildRemains\.setRooms\(online\?\.status === 'open' \? online\.heldRooms\(\) : \[\]\);/);
});
