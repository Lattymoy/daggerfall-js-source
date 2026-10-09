// AUDIT CARDS-3 (2026-10-08, bible/01-Overview/Audit-Cards-3.md): THE RELAY'S CARD TABLES, AUDITED. Driven on the fake
// room (server/src/index.js): a refused sit moves nothing at another table (A1); one seat an account (A2); seats whose
// sockets the relay closed itself, or an empty room left behind, stood up - no ghost deals for ever, nobody takes its
// cards by its id (A3); the room's sits on one gate, and a word that moved nothing writes nothing (A4); a table open at
// other chairs or stakes refused (A5); a dropped player sits again in his own chair (E-N1); a run-out's streets on the
// cloth before the next deal (C4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newTable, sit, stand, tick, actAt, HOLDEM_FIRST_MS, HOLDEM_CLOCK_MS, HOLDEM_GAP_MS, HOLDEM_RUNOUT_MS } from '../src/net/holdemTable.js';
import { HOLDEM_SIT_ROOM_HZ_MAX } from '../src/net/wire.js';
import { HOLDEM_REFUSALS } from '../src/ui/cardTableHud.js';
import { fakeRoom } from './fakeRoom.mjs';

const seeded = (seed = 99) => { let x = seed >>> 0; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; return x >>>= 0; }; };
async function withRoom(key, fn) {
  const r = fakeRoom(key);
  const realNow = Date.now; let clock = 1e12; Date.now = () => clock;
  const tickMs = (ms) => { clock += ms; };
  try { await fn({ r, tickMs, setClock: (t) => { clock = Math.max(clock, t); } }); } finally { Date.now = realNow; }
}
const holdem = (ws) => ws.sent.filter((m) => m.t === 'holdem');
const word = (r, ws, o) => r.raw(ws, JSON.stringify({ t: 'holdem', ...o }));
const sitW = (table, chair, chairs = 2, bb = 10) => ({ op: 'sit', table, chair, chairs, bb });
// PIN MOVED (TAVERN-TABLES, world179): table 1 is the room's gold table now (net/holdemTable.js HOLDEM_GOLD_TABLE) and
// seats a stake alone - the chips sits below that stood at "another table" stand at table 2, and A4's four at 0, 2, 3, 4.
const CHIPS = [0, 2, 3, 4];

test('AUDIT CARDS-3 A1: a sit refused at another table stands nobody up - no fold unsaid, nothing unsaved', () => withRoom('interior:m100.200', async ({ r, tickMs }) => {
  const a = r.connect(); await r.hello(a, 'peer-a', null, { name: 'Ann' });
  const b = r.connect(); await r.hello(b, 'peer-b', null, { name: 'Bob' });
  const c = r.connect(); await r.hello(c, 'peer-c', null, { name: 'Cat' });
  await word(r, a, sitW(0, 0)); await word(r, b, sitW(0, 1)); await word(r, c, sitW(2, 0));
  tickMs(HOLDEM_FIRST_MS); await r.fire();
  const before = JSON.stringify(r.store.get('holdem')[0]);
  for (const ws of [a, b, c]) ws.sent.length = 0;
  await word(r, a, sitW(2, 0));   // Cat's chair
  assert.deepEqual(holdem(a), [{ t: 'holdem', table: 2, now: Date.now(), error: 'taken' }], 'refused, to her alone');
  assert.deepEqual([holdem(b), holdem(c)], [[], []], 'the room told nothing - because nothing moved');
  const t0 = r.room._holdem.get(0);
  assert.ok(t0.hand && t0.seats[0]?.id === 'peer-a' && !t0.seats[0].leaving, 'still in her hand at table 0');
  assert.equal(JSON.stringify(r.store.get('holdem')[0]), before, 'storage and memory agree');
  // a sit that takes stands her up at the other table - said and saved
  await word(r, c, { op: 'stand', table: 2 });
  for (const ws of [a, b, c]) ws.sent.length = 0;
  await word(r, a, sitW(2, 1));
  assert.ok(holdem(b).some((m) => m.table === 0 && m.events?.some((e) => e.t === 'act' && e.type === 'fold' && e.seat === 0)), 'folded at table 0, and the room told');
  assert.equal(r.store.get('holdem')[2].seats[1].id, 'peer-a');
  assert.ok(r.store.get('holdem')[0].seats[0]?.leaving || !r.store.get('holdem')[0].seats[0], 'stood up there, saved');
}));

test('AUDIT CARDS-3 A2: one seat an account - a second tab under another id is refused while the first sits', () => withRoom('interior:m100.200', async ({ r }) => {
  const m1 = r.connect(); await r.hello(m1, 'peer-m1', null, { name: 'Mal', tokenSub: 'acct-mal' });
  const m2 = r.connect(); await r.hello(m2, 'peer-m2', null, { name: 'Mal', tokenSub: 'acct-mal' });
  const o = r.connect(); await r.hello(o, 'peer-o', null, { name: 'Oth' });
  await word(r, m1, sitW(0, 0, 3));
  m2.sent.length = 0;
  await word(r, m2, sitW(0, 1, 3));
  assert.equal(holdem(m2).at(-1).error, 'account seated');
  assert.ok(HOLDEM_REFUSALS['account seated'], 'the panel says it in words');
  await word(r, m2, sitW(2, 0, 3));
  assert.equal(holdem(m2).at(-1).error, 'account seated', 'at any table of the room');
  await word(r, o, sitW(0, 1, 3));
  assert.deepEqual(r.room._holdem.get(0).seats.map((s) => s?.id ?? null), ['peer-m1', 'peer-o', null]);
  await word(r, m1, { op: 'stand', table: 0 });
  await word(r, m2, sitW(0, 2, 3));
  assert.equal(r.room._holdem.get(0).seats[2]?.id, 'peer-m2', 'the first up, the second may sit');
}));

test('AUDIT CARDS-3 A3: a seat whose socket the relay closed itself is stood up on the alarm - no ghost hands, the room forgets, nobody takes its cards by its id', () => withRoom('interior:m100.200', async ({ r, tickMs, setClock }) => {
  const a = r.connect(); await r.hello(a, 'peer-aaaa', null, { name: 'Ann' });
  const b = r.connect(); await r.hello(b, 'peer-bbbb', null, { name: 'Bob' });
  await word(r, a, sitW(0, 0)); await word(r, b, sitW(0, 1));
  r.store.set('world:0', { kept: true });
  tickMs(HOLDEM_FIRST_MS); await r.fire();
  a.closed = { code: 1006 }; b.closed = { code: 1006 };   // both connections dead: a send throws, and no close will come
  tickMs(HOLDEM_CLOCK_MS); await r.fire();
  assert.equal(r.room._dead.size, 0, 'the alarm reaped the sockets it closed');
  r.wake();
  let fires = 0;
  while (r.alarm.at != null && fires < 50) { setClock(r.alarm.at); await r.fire(); fires++; }
  assert.equal(r.store.get('holdem'), undefined, 'the table forgotten with its last seat');
  assert.equal(r.store.has('world:0'), false, 'and the alarm the room\'s again: its forgetting ran');
  assert.ok(fires < 50, `the alarm stopped dealing to nobody (${fires} fires)`);
  // a socket gone with no close and no reap (a hibernation forgot it): the tick finds its seat empty of a player
  const g1 = r.connect(); await r.hello(g1, 'peer-g1', null, { name: 'G1' });
  const g2 = r.connect(); await r.hello(g2, 'peer-g2', null, { name: 'G2' });
  const keep = r.connect(); await r.hello(keep, 'peer-keep', null, { name: 'Keep' });
  await word(r, g1, sitW(0, 0)); await word(r, g2, sitW(0, 1));
  r.sockets.splice(r.sockets.indexOf(g1), 1);
  r.wake();
  setClock(r.alarm.at); await r.fire();
  const left = r.room._holdem.get(0);
  assert.ok(!left || !left.seats[0] || left.seats[0].leaving, 'the ghost stood up by the tick');
  r.sockets.splice(r.sockets.indexOf(g2), 1); r.sockets.splice(r.sockets.indexOf(keep), 1);
  // an empty room's hello sweeps every seat (the secrets go with it - an id is anyone's after)
  const r2Table = { 0: (() => { const t = newTable({ chairs: 2, bb: 10 }); sit(t, { id: 'peer-ghost', name: 'G', chair: 0, now: 0 }); sit(t, { id: 'peer-gh2', name: 'H', chair: 1, now: 0 }); tick(t, HOLDEM_FIRST_MS, seeded(3)); return t; })() };
  r.store.set('holdem', r2Table);
  r.wake();
  const imp = r.connect(); await r.hello(imp, 'peer-ghost', null, { name: 'Imp', secret: 'any-secret-at-all', tokenSub: 'acct-imp' });
  imp.sent.length = 0;
  await word(r, imp, { op: 'look', table: 0 });
  assert.ok(!holdem(imp).some((m) => m.hole), 'the ghost\'s cards never reach whoever says its id');
  const kept = r.store.get('holdem')?.[0];
  assert.ok(!kept || kept.seats.every((s) => !s || s.leaving), 'every seat of the empty room stood up');
}));

test('AUDIT CARDS-3 A4: the room\'s sits on one gate - ten sockets toggling get "busy", not a megabyte; a word that moved nothing writes nothing', () => withRoom('interior:m100.200', async ({ r, tickMs }) => {
  const socks = [];
  for (let i = 0; i < 10; i++) { const w = r.connect(); await r.hello(w, `peer-t${i}`, null, { name: `T${i}`, tokenSub: `acct-t${i}` }); socks.push(w); }
  let puts = 0;
  const put = r.state.storage.put.bind(r.state.storage);
  r.state.storage.put = async (k, v) => { if (k === 'holdem') puts++; return put(k, v); };
  let refused = 0, sat = 0;
  for (let round = 0; round < 3; round++) {
    for (const [i, w] of socks.entries()) { w.sent.length = 0; await word(r, w, sitW(CHIPS[i % 4], 0)); const last = holdem(w).at(-1); if (last?.error === 'busy') refused++; else if (last?.state) sat++; await word(r, w, { op: 'stand', table: CHIPS[i % 4] }); }
    tickMs(100);
  }
  assert.ok(sat <= HOLDEM_SIT_ROOM_HZ_MAX + 2, `sits through the room's gate: ${sat}`);
  assert.ok(refused >= 15, `refused busy: ${refused}`);
  assert.ok(puts <= sat * 2 + 2, `storage writes ${puts} for ${sat} sits`);
  tickMs(2000);
  await word(r, socks[1], sitW(5, 0));   // a table the room keeps
  puts = 0;
  await word(r, socks[0], { op: 'stand', table: 5 });   // not seated there: nothing moves
  assert.equal(puts, 0, 'a stand by nobody seated writes nothing');
}));

test('AUDIT CARDS-3 A5: a table open at other chairs or stakes refuses the sit - the first sitter never decides the room\'s cloth', () => withRoom('interior:m100.200', async ({ r }) => {
  const a = r.connect(); await r.hello(a, 'peer-a', null, { name: 'Ann' });
  const b = r.connect(); await r.hello(b, 'peer-b', null, { name: 'Bob' });
  await word(r, a, sitW(0, 0, 2, 50));
  b.sent.length = 0;
  await word(r, b, sitW(0, 1, 6, 2));
  assert.equal(holdem(b).at(-1).error, 'table differs');
  await word(r, b, sitW(0, 1, 2, 2));
  assert.equal(holdem(b).at(-1).error, 'table differs', 'the stakes too');
  await word(r, b, sitW(0, 1, 2, 50));
  assert.equal(r.room._holdem.get(0).seats[1]?.id, 'peer-b');
}));

test('AUDIT CARDS-3 E-N1 and C4: a dropped player sits again in his own chair mid-hand; a run-out lengthens the pause before the next deal', () => {
  const t = newTable({ chairs: 3, bb: 10 });
  sit(t, { id: 'a', name: 'Ann', chair: 0, now: 0 });
  sit(t, { id: 'b', name: 'Bob', chair: 1, now: 0 });
  sit(t, { id: 'c', name: 'Cat', chair: 2, now: 0 });
  tick(t, HOLDEM_FIRST_MS, seeded(5));
  stand(t, { id: 'a', now: HOLDEM_FIRST_MS + 1 });   // his socket dropped: folded, leaving
  assert.equal(t.seats[0].leaving, true);
  const back = sit(t, { id: 'a', name: 'Ann', chair: 2, now: HOLDEM_FIRST_MS + 2 });
  assert.ok(Array.isArray(back), 'never "taken" by his own ghost');
  assert.equal(t.seats[0].leaving, undefined, 'his own chair, kept - whichever he named');
  assert.equal(t.seats[2].id, 'c');
  // a run-out: two all in preflop - the flop, the turn and the river said at the hand's end, the pause that much longer
  const u = newTable({ chairs: 2, bb: 10 });
  sit(u, { id: 'a', name: 'Ann', chair: 0, now: 0 });
  sit(u, { id: 'b', name: 'Bob', chair: 1, now: 0 });
  tick(u, HOLDEM_FIRST_MS, seeded(9));
  const now = HOLDEM_FIRST_MS + 10;
  const first = u.seats[u.handSeats[u.hand.toAct]].id;
  const k = u.hand.toAct;
  actAt(u, { id: first, action: { type: 'raise', to: u.hand.seats[k].stack + u.hand.seats[k].bet }, now });
  const second = u.seats[u.handSeats[u.hand.toAct]].id;
  const out = actAt(u, { id: second, action: { type: 'call' }, now });
  assert.equal(out[0].frame.events.filter((e) => e.t === 'street').length, 3, 'the run-out said in one');
  assert.equal(u.nextDealAt, now + HOLDEM_GAP_MS + HOLDEM_RUNOUT_MS * 3);
});

test('AUDIT CARDS-3 the relay\'s look and leave: a look answers its asker alone; a leaver between hands is stood up and saved', () => withRoom('interior:m100.200', async ({ r }) => {
  const a = r.connect(); await r.hello(a, 'peer-a', null, { name: 'Ann' });
  const b = r.connect(); await r.hello(b, 'peer-b', null, { name: 'Bob' });
  await word(r, a, sitW(0, 0));
  a.sent.length = 0; b.sent.length = 0;
  await word(r, b, { op: 'look', table: 0 });
  assert.equal(holdem(b).length, 1);
  assert.deepEqual(holdem(b)[0].state.seats.map((s) => s?.id ?? null), ['peer-a', null]);
  assert.deepEqual(holdem(a), [], 'the asker alone');
  await r.drop(a);
  assert.equal(r.store.get('holdem'), undefined, 'her seat gone, saved - the table with it');
}));

test('AUDIT CARDS-3 A3: the tick that stands the last ghosts gives the alarm back at once - the room forgets in that same firing', () => withRoom('interior:m100.200', async ({ r, setClock }) => {
  const a = r.connect(); await r.hello(a, 'peer-a', null, { name: 'Ann' });
  const b = r.connect(); await r.hello(b, 'peer-b', null, { name: 'Bob' });
  await word(r, a, sitW(0, 0)); await word(r, b, sitW(0, 1));
  r.store.set('world:1', { kept: true });
  r.sockets.splice(0, r.sockets.length);   // both gone with no close, and the room hibernated - nothing will reap them
  r.wake();
  setClock(r.alarm.at); await r.fire();
  assert.equal(r.store.get('holdem'), undefined, 'the ghosts stood up, the table forgotten');
  assert.equal(r.store.has('world:1'), false, 'one firing: the forgetting ran');
}));
