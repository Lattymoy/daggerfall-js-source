// AUDIT CARDS-3 (2026-10-08, bible/01-Overview/Audit-Cards-3.md, lane D): THE PINS THAT COULD NOT FAIL, MADE TO. Each
// test names the mutants of tools/mutants/auditcards3.json it kills - the relay's table law (its blinds, its button,
// its words both ways, its clock), the client's catch-up and clock, the regulars' looks, the hand's grab and betting
// ground, the riffle, and the host lines no driven test reaches.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  newTable, publicView, sit, stand, actAt, tick, tableLook, validHoldemIn, validHoldemOut, HOLDEM_FIRST_MS, HOLDEM_NAME_MAX,
} from '../src/net/holdemTable.js';
import { RemoteCardTable } from '../src/systems/cardRemoteTable.js';
import { regularLook } from '../src/world/cardRegulars.js';
import { onStack, inBetZone, heldMatrices, PEEK_RISE, STACK_GRAB_M } from '../src/world/cardHand.js';
import { riffleAt, RIFFLE_S, RIFFLE_PART } from '../src/world/cardMotion.js';
import { tablePlaces } from '../src/world/cardScene.js';
import { tableFrame, cardTableSeats } from '../src/world/cardTables.js';
import { lookAt } from '../src/world/mat4.js';
import { invert4 } from '../src/player/tapRay.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const seeded = (seed = 99) => { let x = seed >>> 0; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; return x >>>= 0; }; };
const ofRoom = (msgs) => msgs.filter((m) => m.to === null);
const twoSeats = (bb = 10, seed = 4) => {
  const t = newTable({ chairs: 2, bb });
  sit(t, { id: 'a', name: 'Ann', chair: 0, now: 0 });
  sit(t, { id: 'b', name: 'Bob', chair: 1, now: 0 });
  const msgs = tick(t, HOLDEM_FIRST_MS, seeded(seed));
  return { t, msgs };
};
const idToAct = (t) => t.seats[t.handSeats[t.hand.toAct]].id;

test('AUDIT CARDS-3 pins, the relay\'s table (mutants D-sb-floor2, D-button-stuck, D-last-forgotten, D-deal-alone, D-stand-refold, D-third-sitter-delays, D-sit-chair-unchecked, D-name-unbounded)', () => {
  assert.equal(newTable({ chairs: 2, bb: 2 }).sb, 1, 'the 1/2 table\'s small blind is 1');
  const { t } = twoSeats();
  const b1 = t.button;
  actAt(t, { id: idToAct(t), action: { type: 'fold' }, now: 3000 });
  assert.equal(t.hand, null);
  assert.equal(publicView(t).last?.t, 'showdown', 'the hand\'s end kept for the panel');
  tick(t, t.nextDealAt, seeded(5));
  assert.notEqual(t.button, b1, 'the button moves on');
  // one seat deals nothing, however long it waits
  const one = newTable({ chairs: 2, bb: 10 });
  sit(one, { id: 'a', name: 'Ann', chair: 0, now: 0 });
  one.nextDealAt = 0;
  assert.deepEqual(tick(one, 1e9, seeded(1)), []);
  // a leaver folded already: a second stand says nothing new (three at the table, so the hand goes on)
  const u = newTable({ chairs: 3, bb: 10 });
  for (const [i, id] of ['a', 'b', 'c'].entries()) sit(u, { id, name: id, chair: i, now: 0 });
  tick(u, HOLDEM_FIRST_MS, seeded(7));
  stand(u, { id: 'a', now: 1 });
  assert.ok(u.hand, 'the hand goes on');
  const again = stand(u, { id: 'a', now: 2 });
  assert.deepEqual(again.flatMap((m) => m.frame.events ?? []), [], 'no second fold');
  // a third sitter never pushes back a deal already due
  const v = newTable({ chairs: 3, bb: 10 });
  sit(v, { id: 'a', name: 'Ann', chair: 0, now: 0 });
  sit(v, { id: 'b', name: 'Bob', chair: 1, now: 0 });
  const due = v.nextDealAt;
  sit(v, { id: 'c', name: 'Cat', chair: 2, now: 2000 });
  assert.equal(v.nextDealAt, due);
  assert.equal(sit(newTable({ chairs: 2, bb: 10 }), { id: 'x', name: 'X', chair: 2, now: 0 }), 'no such chair');
  const w = newTable({ chairs: 2, bb: 10 });
  sit(w, { id: 'x', name: 'N'.repeat(200), chair: 0, now: 0 });
  assert.equal(w.seats[0].name.length, HOLDEM_NAME_MAX);
});

test('AUDIT CARDS-3 pins, the relay\'s words of the hand (mutants D-allin-unsaid, D-bet-unsaid, D-street-twice, D-only-flop-said, D-timeout-always-fold, D-look-no-turn)', () => {
  // a bet into an unopened street says it is a bet; a shove says all in; a check on the flop says no street again
  const { t } = twoSeats(10, 11);
  actAt(t, { id: idToAct(t), action: { type: 'call' }, now: 1 });
  const flop = actAt(t, { id: idToAct(t), action: { type: 'check' }, now: 2 });
  assert.deepEqual(ofRoom(flop)[0].frame.events.filter((e) => e.t === 'street').map((e) => e.street), ['flop']);
  const chk = actAt(t, { id: idToAct(t), action: { type: 'check' }, now: 3 });
  assert.deepEqual(ofRoom(chk)[0].frame.events.filter((e) => e.t === 'street'), [], 'a check that turns no card says no street');
  const bet = actAt(t, { id: idToAct(t), action: { type: 'raise', to: 20 }, now: 4 });
  assert.equal(ofRoom(bet)[0].frame.events[0].bet, true);
  const k = t.hand.toAct, max = t.hand.seats[k].stack + t.hand.seats[k].bet;
  const shove = actAt(t, { id: idToAct(t), action: { type: 'raise', to: max }, now: 5 });
  assert.equal(ofRoom(shove)[0].frame.events[0].allIn, true);
  const call = actAt(t, { id: idToAct(t), action: { type: 'call' }, now: 6 });
  assert.deepEqual(ofRoom(call)[0].frame.events.filter((e) => e.t === 'street').map((e) => e.street), ['turn', 'river'], 'the run-out says each street once');
  // the clock: a seat that may check is checked, not folded
  const { t: u } = twoSeats(10, 12);
  actAt(u, { id: idToAct(u), action: { type: 'call' }, now: 1 });
  const out = tick(u, u.clockAt, seeded(2));
  assert.equal(ofRoom(out)[0].frame.events[0].type, 'check');
  // a look by the seat to act is told the turn too
  const look = tableLook(u, idToAct(u), 9);
  assert.ok(look.some((m) => m.frame.turn), 'its turn');
  assert.ok(look.some((m) => m.frame.hole), 'and its cards');
});

test('AUDIT CARDS-3 pins, the words both ways (mutants D-out-*, D-in-chairs-min)', () => {
  const st = publicView(twoSeats().t);
  assert.equal(validHoldemOut({ table: 0, error: 'x'.repeat(41) }), false);
  assert.equal(validHoldemOut({ table: 0, error: 'taken' }), true);
  assert.equal(validHoldemOut({ table: 0, turn: { handNo: 1, legal: {} } }), false, 'a turn without its clock');
  assert.equal(validHoldemOut({ table: 0, events: Array.from({ length: 33 }, () => ({ t: 'x' })), state: st }), false);
  assert.equal(validHoldemOut({ table: 0, events: [], state: { ...st, seats: [{ ...st.seats[0], stack: -1 }, st.seats[1]] } }), false);
  assert.equal(validHoldemOut({ table: 0, events: [], state: { ...st, bb: 7 } }), false);
  assert.equal(validHoldemOut({ table: 0, events: [], state: st }), true);
  assert.equal(validHoldemIn({ op: 'sit', table: 0, chair: 0, chairs: 1, bb: 10 }), null);
});

test('AUDIT CARDS-3 pins, the client\'s catch-up, clock and showdown (mutants D-remote-*)', () => {
  const { t } = twoSeats(10, 21);
  actAt(t, { id: idToAct(t), action: { type: 'call' }, now: 1 });
  actAt(t, { id: idToAct(t), action: { type: 'check' }, now: 2 });   // the flop
  const late = new RemoteCardTable({ myId: 'z' });
  late.ingest({ t: 'holdem', table: 0, now: 10, ...tableLook(t, 'z', 10)[0].frame, at: 50000 });
  const caught = late.drain();
  assert.deepEqual(caught.filter((e) => e.t === 'street').map((e) => e.street), ['flop'], 'the streets already turned');
  late.ingest({ t: 'holdem', table: 0, now: 11, ...tableLook(t, 'z', 11)[0].frame, at: 50001 });
  assert.deepEqual(late.drain(), [], 'told once a hand');
  // a fold already made is caught too
  const three = newTable({ chairs: 3, bb: 10 });
  for (const [i, id] of ['a', 'b', 'c'].entries()) sit(three, { id, name: id, chair: i, now: 0 });
  tick(three, HOLDEM_FIRST_MS, seeded(3));
  const folder = three.handSeats[three.hand.toAct];
  actAt(three, { id: idToAct(three), action: { type: 'fold' }, now: 1 });
  const w = new RemoteCardTable({ myId: 'z' });
  w.ingest({ t: 'holdem', table: 0, now: 1, ...tableLook(three, 'z', 1)[0].frame, at: 9 });
  assert.ok(w.drain().some((e) => e.t === 'act' && e.type === 'fold' && e.seat === folder));
  // my clock never below nothing; between hands the last showdown is the view's
  const me = new RemoteCardTable({ myId: idToAct(three), chair: three.handSeats[three.hand.toAct] });
  for (const m of tableLook(three, idToAct(three), 1)) me.ingest({ t: 'holdem', table: 0, now: 1, ...m.frame, at: 1 });
  assert.ok(me.legal());
  assert.equal(me.clockLeft(1e15), 0);
  const { t: done } = twoSeats(10, 22);
  actAt(done, { id: idToAct(done), action: { type: 'fold' }, now: 1 });
  const v = new RemoteCardTable({ myId: 'z' });
  v.ingest({ t: 'holdem', table: 0, now: 1, ...tableLook(done, 'z', 1)[0].frame, at: 1 });
  assert.equal(v.view().showdown?.t, 'showdown');
});

test('AUDIT CARDS-3 pins, the regulars\' looks, the hand\'s grab and ground, the peek, the riffle (mutants D-look-*, D-stack-grab-strict, D-betzone-margin, D-peek-no-rise, D-riffle-*)', () => {
  const faces = new Set(), variants = new Set();
  for (let s = 1; s <= 60; s++) { const l = regularLook(s * 7919, 0, s % 2); faces.add(l.faceIndex); for (const it of l.items) variants.add(it.variant); }
  assert.ok(faces.size > 3, 'many faces');
  assert.deepEqual([...variants].sort(), [0, 1], 'both variants of a garment');
  const table = { aabb: { min: [10, 0, 20], max: [12, 0.8, 21] } };
  const seats = cardTableSeats(table, () => true);
  const places = tablePlaces(tableFrame(table), seats, seats.map((_, i) => i));
  const pl = places.seats[0];
  assert.equal(onStack([pl.stack[0] + STACK_GRAB_M * 0.97, 0.8, pl.stack[2]], pl), true, 'the grab\'s whole reach');
  const f = [Math.sin(pl.yaw), Math.cos(pl.yaw)];
  const at = (d) => [pl.holes[0][0] + f[0] * d, 0.8, pl.holes[0][2] + f[1] * d];
  assert.equal(inBetZone(at(0.01), pl), false, 'two centimetres past the cards, not one');
  assert.equal(inBetZone(at(0.03), pl), true);
  const view = lookAt([0, 1.2, 0], [0, 1.2, -1], [0, 1, 0]);
  const cam = invert4(view);
  const up = (m) => (m[12] - cam[12]) * cam[4] + (m[13] - cam[13]) * cam[5] + (m[14] - cam[14]) * cam[6];
  assert.ok(Math.abs(up(heldMatrices(view, 1, 1)[0]) - up(heldMatrices(view, 1, 0)[0]) - PEEK_RISE) < 1e-6, 'a peek comes up');
  // the riffle across the dealer's own facing, the halves bent and lifted while they part
  const yaw = Math.PI / 2;
  const mid = riffleAt(RIFFLE_S * 0.3, 0, [0, 0.8, 0], yaw);
  const across = [Math.cos(yaw), -Math.sin(yaw)];
  const spread = Math.max(...mid.map((c) => Math.abs(c.pos[0] * across[0] + c.pos[2] * across[1])));
  assert.ok(spread > RIFFLE_PART * 0.5, `the halves part across his facing (${spread})`);
  assert.ok(mid.every((c) => Math.abs(c.pos[0] * Math.sin(yaw) + c.pos[2] * Math.cos(yaw)) < 1e-9), 'never along it');
  assert.ok(mid.some((c) => Math.abs(c.roll - Math.PI) > 0.05), 'bent');
  assert.ok(mid[0].pos[0] * across[0] + mid[0].pos[2] * across[1] < 0, 'the first half to his left, as the seat\'s own across runs (tablePlaces)');
  const restY = riffleAt(RIFFLE_S * 0.999, 0, [0, 0.8, 0], yaw).map((c) => c.pos[1]);
  assert.ok(Math.max(...mid.map((c) => c.pos[1])) > Math.max(...restY) + 0.004, 'lifted');
});

test('AUDIT CARDS-3 pins, the host lines no driven test reaches (mutants D-host-*, D-world-*)', () => {
  const wm = read('src/scenes/worldModes.js'), w = read('src/scenes/world.js');
  assert.match(wm, /silenceTorch\(\);[^\n]*? if \(next !== 'interior'\) closeCardWatches\(\);[^\n]*? mode = next;/, 'the watches go with the interior');
  assert.match(w, /    cardOnline: \{ ok: \(\) => !!online\?\.holdemOk, send: \(w\) => !!online\?\.sendHoldem\(w\),/, 'the host hands the modes the relay that deals');
  assert.match(wm, /return \{ \.\.\.r, say: b && now < b\.until \? b\.text : null \};/, 'a bark ends');
  assert.match(wm, /g\.drag\.off = !onTable\(q, g\.scene\?\.places\.table\);[^\n]*\n\s*if \(!g\.drag\.off\) g\.drag\.point = q;/, 'a carried bet follows the cursor on the table');
  assert.match(wm, /action: id === 'raise' \? \{ type: 'raise', to: Math\.floor\(Number\(value\) \|\| 0\) \} : \{ type: id \} \}\);/, 'a raise in whole chips');
  assert.match(wm, /online: g\.remote \? \{ waiting: g\.remote\.seated < 2 && !g\.remote\.state\?\.hand,/, 'waiting only between hands');
  assert.match(w, /if \(d > CREW_SAY_RANGE \|\| !at\.front\) continue;\n\s*points\.push\(\{ x: at\.x, y: at\.y, text: b\.text, who: `card:\$\{b\.id\}`/, 'a regular heard within the crew\'s range');
});

test('AUDIT CARDS-3 pins, the fixes\' own small seams: an old refusal cleared by the table moving on; a regulars\' layer let go frees its dolls; the carried chips off the stack', async () => {
  const t = newTable({ chairs: 2, bb: 10 });
  const me = new RemoteCardTable({ myId: 'a', chair: 0 });
  for (const m of sit(t, { id: 'a', name: 'Ann', chair: 0, now: 0 })) me.ingest({ t: 'holdem', table: 0, now: 0, ...m.frame, at: 0 });
  me.ingest({ t: 'holdem', table: 0, now: 0, error: 'not your turn', at: 0 });
  assert.equal(me.error, 'not your turn');
  for (const m of sit(t, { id: 'b', name: 'Bob', chair: 1, now: 1 })) if (m.to === null) me.ingest({ t: 'holdem', table: 0, now: 1, ...m.frame, at: 1 });
  assert.equal(me.error, null, 'the table moved on');
  const { createFamilyBodies } = await import('../src/world/familyBodies.js');
  let freed = 0;
  const fam = createFamilyBodies({ dolls: { sync() {}, batches: () => [], destroy() { freed++; } }, bodies: null });
  fam.clear();
  assert.equal(freed, 0, 'clear keeps the dolls for the next stand');
  fam.destroy();
  assert.equal(freed, 1, 'destroy lets their textures go');
  const { CardScene } = await import('../src/world/cardScene.js');
  const table = { aabb: { min: [10, 0, 20], max: [12, 0.8, 21] } };
  const seats = cardTableSeats(table, () => true);
  const scene = new CardScene({ places: tablePlaces(tableFrame(table), seats, [0, 1]), playerSeat: 0 });
  const view = { seats: [{ stack: 500, gone: false }, { stack: 500, gone: false }], handSeats: [], hand: null };
  const worth = (p) => p.chips.reduce((a, d) => a + d.value, 0);
  assert.equal(worth(scene.poses(1, view)), 1000);
  assert.equal(worth(scene.poses(1, view, { seat: 0, amount: 400 })), 600, 'carrying 400: it is off the stack (the drag draws it under the cursor)');
});
