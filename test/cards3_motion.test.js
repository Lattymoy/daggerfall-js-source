// CARDS3 (2026-10-07, bible/11-Multiplayer/Tavern-Cards.md section 3; Mac: "actual detailed card physics"): THE CARDS'
// MOTION AND THE TABLE'S PICTURE. Driven: a throw's arc, landing, slide and settle - continuous in place and turn, the
// slide stopping exactly on its rest with no speed left, the same seed the same throw; the turn over the long edge; the
// chips stacked greedily and laid in columns; a push; the seed's hash; the table's places; and whole evenings of a real
// session through the scene - every seat dealt two cards in the deal's order, the player's turned up to him and nobody
// else's, a burn and the board turned at each street, a fold slid to the muck, a shown showdown's hands turned over, and
// the chips on the cloth always the table's own numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CARD_W, CARD_L, CARD_T, DEAL_LIFT, FLIGHT_SPEED, FLIGHT_MIN_S, ARC_HEIGHT, SLIDE_DECEL, REST_JITTER, FLIP_S, CHIP_T, CHIP_STACK_MAX, PUSH_S, CHIP_VALUES,
  hashSeed, seedUnits, dealMotion, flipMotion, flipShift, chipStacks, chipDiscs, pushAt,
} from '../src/world/cardMotion.js';
import { cardMatrix } from '../src/render/cardTableDraw.js';
import { tablePlaces, CardScene, HOLE_IN, BET_IN } from '../src/world/cardScene.js';
import { tableFrame, cardTableSeats } from '../src/world/cardTables.js';
import { SEAT_OUT } from '../src/player/seatPose.js';
import { CardTableSession } from '../src/systems/cardTableSession.js';

const r6 = (v) => Math.round(v * 1e6) / 1e6;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const seeded = (seed = 99) => { let x = seed >>> 0; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; return x >>>= 0; }; };

test('CARDS3 the plate, the chip, the throw\'s numbers', () => {
  assert.deepEqual([CARD_W, CARD_L, CARD_T], [0.063, 0.088, 0.001]);
  assert.deepEqual([DEAL_LIFT, FLIGHT_SPEED, ARC_HEIGHT, SLIDE_DECEL, REST_JITTER, FLIP_S], [0.18, 2.4, 0.06, 3.2, 0.008, 0.32]);
  assert.deepEqual([CHIP_T, CHIP_STACK_MAX, PUSH_S, CHIP_VALUES], [0.0033, 20, 0.45, [500, 100, 25, 5, 1]]);
});

test('CARDS3 a throw: from the hand, over the arc, onto the cloth, skidding to a stop exactly at its rest', () => {
  const from = [0, 1, 0], to = [1, 0.8, 0.5];
  const m = dealMotion({ from, to, yaw: 0.3, t0: 2, seed: 77 });
  assert.ok(dist(m.rest, to) <= REST_JITTER * Math.SQRT2 + 1e-9, 'the rest within its jitter of the place');
  assert.equal(m.rest[1], to[1], 'on the cloth');
  assert.deepEqual(m.at(1).pos, from, 'still in the hand before its time');
  assert.equal(m.at(1).held, true);
  // the arc: above the straight line between hand and landing at its middle
  const mid = (m.t0 + m.land) / 2, p = m.at(mid).pos;
  assert.ok(p[1] > (from[1] + to[1]) / 2 + ARC_HEIGHT * 0.9, `the arc's rise: ${p[1]}`);
  // continuous: no jump in place or turn anywhere, the landing and the stop included
  let prev = m.at(m.t0 + 1e-6);
  for (let t = m.t0 + 0.002; t < m.t1 + 0.2; t += 0.002) {
    const q = m.at(t);
    assert.ok(dist(q.pos, prev.pos) < 0.01, `a jump in place at ${t.toFixed(3)}`);
    assert.ok(Math.abs(q.yaw - prev.yaw) < 0.05, `a jump in turn at ${t.toFixed(3)}`);
    prev = q;
  }
  // it stops exactly at its rest, not moving, and stays
  assert.deepEqual(m.at(m.t1).pos.map(r6), m.rest.map(r6));
  assert.equal(m.at(m.t1 + 5).moving, false);
  assert.deepEqual(m.at(m.t1 + 5).pos, m.rest);
  // the slide's last instant is as slow as the cloth makes it: no speed left at the stop
  const e = 1e-4;
  assert.ok(dist(m.at(m.t1 - e).pos, m.at(m.t1).pos) / e < 0.01, 'no speed at the stop');
  // the same seed throws the same; another seed lands elsewhere
  assert.deepEqual(dealMotion({ from, to, yaw: 0.3, t0: 2, seed: 77 }).at(2.2), m.at(2.2));
  assert.notDeepEqual(dealMotion({ from, to, yaw: 0.3, t0: 2, seed: 78 }).rest, m.rest);
  // face down by default, as a deal is
  assert.equal(m.at(m.t1).roll, Math.PI);
  // a throw across a hand's breadth still takes the flight's least time - never a card that blinks into place
  const short = dealMotion({ from: [0, 0.82, 0], to: [0.01, 0.8, 0], yaw: 0, t0: 0, seed: 5 });
  assert.ok(short.land >= FLIGHT_MIN_S - 1e-12, `the short throw's flight: ${short.land}`);
});

test('CARDS3 a turn over the long edge: the card comes over and lies face up a width across', () => {
  const f = flipMotion({ pos: [0, 0.8, 0], yaw: 0, t0: 1 });
  assert.equal(f.t1, 1 + FLIP_S);
  assert.deepEqual(f.at(0.5), { pos: [0, 0.8, 0], yaw: 0, roll: Math.PI, moving: false });
  const half = f.at(1 + FLIP_S / 2);
  assert.ok(Math.abs(half.pos[1] - (0.8 + CARD_W / 2)) < 1e-9, 'standing on its edge at the half');
  const end = f.at(5);
  assert.deepEqual([r6(end.pos[0]), r6(end.pos[1]), r6(end.pos[2])], [r6(CARD_W), 0.8, 0]);
  assert.ok(Math.cos(end.roll) > 0.999, 'face up');
  // AUDIT CARDS-2 M5: through the card's own matrix (the one the GL draws), the edge it turns on stays on the cloth, in
  // place, all the way over, and the far edge rises and comes across - at every facing (the first cut rolled the other
  // way: the pivot edge rose a width and the far edge skidded a width and a half along the cloth)
  for (const yaw of [0, 0.7, 1.9, Math.PI, 4.4]) {
    const g = flipMotion({ pos: [2, 0.8, 3], yaw, t0: 0 });
    const edgeAt = (p, x) => { const m = cardMatrix(p.pos, p.yaw, p.roll); return [m[0] * x + m[12], m[1] * x + m[13], m[2] * x + m[14]]; };
    // face down (roll PI) the card's local -X is its right-hand edge on the cloth - the one it turns on
    const pivot0 = edgeAt(g.at(0), -CARD_W / 2);
    let farTop = 0;
    for (let k = 0; k <= 20; k++) {
      const p = g.at((k / 20) * FLIP_S);
      const e = edgeAt(p, -CARD_W / 2);
      assert.ok(Math.hypot(e[0] - pivot0[0], e[1] - pivot0[1], e[2] - pivot0[2]) < 1e-6, `the pivot edge stays put at yaw ${yaw}, step ${k}`);
      farTop = Math.max(farTop, edgeAt(p, CARD_W / 2)[1]);
    }
    assert.ok(farTop > 0.8 + CARD_W * 0.99, `the far edge comes up and over at yaw ${yaw}: ${farTop}`);
  }
  // thrown a width short (flipShift), the dealer's turn lays it on its place
  for (const yaw of [0, 0.7, Math.PI / 2, -2.3]) {
    const to = [3, 0.8, 4], f2 = flipMotion({ pos: flipShift(to, yaw), yaw, t0: 0 }).at(9).pos;
    assert.deepEqual(f2.map(r6), to.map(r6), `on its place at yaw ${yaw}`);
  }
  // turned at its middle (a player's own, a hand shown): it lies where it lay
  const mid = flipMotion({ pos: [1, 0.8, 1], yaw: 0.4, t0: 0, pivot: 'middle' });
  assert.deepEqual(mid.at(9).pos, [1, 0.8, 1]);
  assert.ok(Math.abs(mid.at(FLIP_S / 2).pos[1] - (0.8 + CARD_W / 2)) < 1e-9, 'lifted at its middle on the way over');
});

test('CARDS3 the chips: the fewest that make the amount, in columns, a push between two places', () => {
  assert.deepEqual(chipStacks(736), [{ value: 500, count: 1 }, { value: 100, count: 2 }, { value: 25, count: 1 }, { value: 5, count: 2 }, { value: 1, count: 1 }]);
  assert.deepEqual(chipStacks(0), []);
  assert.deepEqual(chipStacks(-5), []);
  const discs = chipDiscs(130, [1, 0.8, 1], 0);
  assert.deepEqual(discs.map((d) => d.value), [100, 25, 5]);
  assert.deepEqual(discs.map((d) => r6(d.pos[1])), [r6(0.8 + CHIP_T / 2), r6(0.8 + CHIP_T / 2), r6(0.8 + CHIP_T / 2)], 'three columns of one');
  assert.equal(chipDiscs(45, [0, 0, 0], 0).length, 5, 'greedy: a 25 and four 5s');
  const many = chipDiscs(500 * 21, [0, 0, 0], 0);   // twenty-one 500s: a column of 20 and one of 1
  assert.deepEqual([many.length, Math.max(...many.map((d) => d.pos[1]))].map(r6), [21, r6(CHIP_T * 19.5)]);
  assert.equal(new Set(many.map((d) => r6(d.pos[0]))).size, 2, 'two columns side by side');
  assert.deepEqual(pushAt([0, 0, 0], [1, 0, 0], 1, 0.5), [0, 0, 0]);
  assert.deepEqual(pushAt([0, 0, 0], [1, 0, 0], 1, 1 + PUSH_S / 2).map(r6), [0.5, 0, 0]);
  assert.deepEqual(pushAt([0, 0, 0], [1, 0, 0], 1, 9), [1, 0, 0]);
});

test('CARDS3 the seed: a hash of the deal, three uniforms in [0, 1)', () => {
  assert.equal(hashSeed(1, 2, 3), hashSeed(1, 2, 3));
  assert.notEqual(hashSeed(1, 2, 3), hashSeed(1, 3, 2));
  const u = seedUnits(hashSeed(7));
  assert.equal(u.length, 3);
  for (const x of u) assert.ok(x >= 0 && x < 1);
  assert.deepEqual(seedUnits(5), seedUnits(5));
});

/** A 2 x 1 table at 0.8 m, its seats, and a session seated round it. */
function rig({ patrons = 3, seed = 4 } = {}) {
  const table = { aabb: { min: [10, 0, 20], max: [12, 0.8, 21] } };
  const seats = cardTableSeats(table, () => true);
  const frame = tableFrame(table);
  const seatOf = Array.from({ length: patrons + 1 }, (_, i) => i);   // session seat i at physical seat i
  const places = tablePlaces(frame, seats, seatOf);
  const r = seeded(seed);
  const names = ['Ana', 'Bors', 'Cael', 'Dun', 'Eira'].slice(0, patrons);
  const session = new CardTableSession({ player: { id: 'you', name: 'You', stack: 500 }, patrons: names.map((n, i) => ({ id: `patron:${i}`, name: n, temper: 'loose', stack: 500 })), stakes: { sb: 5, bb: 10 }, rand32: r, now: 0 });
  const scene = new CardScene({ places, playerSeat: 0, tableSeed: 9 });
  return { table, seats, frame, places, session, scene };
}

test('CARDS3 the table\'s places: the holes and the bets in from each seat\'s edge, the board along the long side', () => {
  const { seats, frame, places } = rig();
  assert.deepEqual([r6(frame.centre[0]), r6(frame.centre[1]), r6(frame.centre[2])], [11, 0.8, 20.5]);
  const s = seats[0], p = places.seats[0];   // the +x end, facing -x
  assert.equal(r6(p.holes[0][0]), r6(s.feet[0] - (SEAT_OUT + HOLE_IN)), 'the hole cards HOLE_IN past the edge');
  assert.equal(r6(p.bet[0]), r6(s.feet[0] - (SEAT_OUT + BET_IN)));
  assert.ok(Math.abs(p.holes[0][2] - p.holes[1][2]) > CARD_W, 'side by side');
  assert.deepEqual(places.board.map((b) => r6(b[2])), [20.5, 20.5, 20.5, 20.5, 20.5], 'the board along the long side, through its middle');
  assert.ok(places.board.every((b) => b[0] > 10.5 && b[0] < 11.5));
  assert.equal(r6(places.seats[0].deal[1]), r6(0.8 + DEAL_LIFT));
});

/** Run the session and the scene together, the clock in ms; `stop(e)` ends it at an event. */
function play(r, { until = 120000, stop = () => false, act = (l) => (l.check ? { type: 'check' } : { type: 'call' }), holeOf: told } = {}) {
  const holeOf = told ?? ((seat, k) => { const v = r.session.view(); const i = v.handSeats.indexOf(seat); return v.hand && i >= 0 && v.hand.seats[i].hole ? v.hand.seats[i].hole[k] : -1; });
  for (let now = 0; now < until; now += 50) {
    r.session.tick(now);
    const l = r.session.legal();
    if (l) r.session.playerAct(act(l), now);
    for (const e of r.session.drain()) { r.scene.onEvent(e, holeOf); if (stop(e)) return { now, e }; }
    r.scene.poses(now / 1000, r.session.view());
  }
  return null;
}

test('CARDS3 the deal on the cloth: two cards a seat in the deal\'s order, the player\'s turned up to him and nobody else\'s', () => {
  const r = rig();
  // told every card (a careless host's holeOf): the cloth still turns up only the player's - the others are backs
  const hit = play(r, { stop: (e) => e.t === 'hand', holeOf: (seat, k) => { const i = r.session.handSeats.indexOf(seat); return r.session.hand && i >= 0 ? r.session.hand.seats[i].hole[k] : -1; } });
  const t = hit.now / 1000;
  const early = r.scene.poses(t + 0.05, r.session.view()).cards.filter((c) => c.id);   // the dealt cards (the riffle's deck carries no id)
  assert.ok(early.length < 8, 'cards still in the dealer\'s hand at the start');
  const settled = r.scene.poses(t + 5, r.session.view()).cards;
  assert.equal(settled.length, 8, 'four seats, two cards each');
  const mine = r.scene.cards.filter((c) => c.seat === 0);
  assert.equal(mine.length, 2);
  const view = r.session.view();
  assert.deepEqual(mine.map((c) => c.card), view.hand.seats[view.handSeats.indexOf(0)].hole, 'the player knows his own');
  for (const c of r.scene.cards) {
    const p = c.motions.at(-1).at(t + 5);
    if (c.seat === 0) assert.ok(Math.cos(p.roll) > 0.999, 'his own face up'); else { assert.ok(Math.cos(p.roll) < -0.999, 'the others face down'); assert.equal(c.card, -1, 'and unknown'); }
  }
  // the deal's order: one card a seat round from the dealer's left, then the second - the first throws begin in that order
  const starts = r.scene.cards.map((c) => [c.motions[0].t0, c.id]).sort((a, b) => a[0] - b[0]).map((x) => x[1].split(':').slice(1).join(':'));
  const hand = hit.e, n = hand.seats.length, btn = hand.seats.indexOf(hand.button);
  const want = [];
  for (let k = 0; k < 2; k++) for (let j = 1; j <= n; j++) want.push(`${hand.seats[(btn + j) % n]}:${k}`);
  assert.deepEqual(starts, want);
  // every hole card settles on its seat's place, in from the edge
  for (const c of r.scene.cards) {
    const rest = c.motions[0].rest, place = r.places.seats[c.seat].holes[Number(c.id.split(':')[2])];
    assert.ok(Math.hypot(rest[0] - place[0], rest[2] - place[2]) <= REST_JITTER * Math.SQRT2 + 1e-9);
  }
});

test('CARDS3 a street, a fold, a showdown on the cloth; the chips always the table\'s own numbers', () => {
  const r = rig({ seed: 6 });
  const flop = play(r, { stop: (e) => e.t === 'street' });
  assert.ok(flop, 'a flop came');
  const t = flop.now / 1000 + 5;
  const board = r.scene.cards.filter((c) => c.seat === -1);
  assert.equal(board.length, 3, 'the flop');
  assert.deepEqual(board.map((c) => c.card), flop.e.board, 'the board\'s own cards');
  for (const c of board) assert.ok(Math.cos(c.motions.at(-1).at(t).roll) > 0.999, 'turned face up');
  // each board card lies on its own slot once turned (thrown a width short of it), never under the burn
  board.forEach((c, i) => {
    const p = c.motions.at(-1).at(t).pos, slot = r.places.board[i];
    assert.ok(Math.hypot(p[0] - slot[0], p[2] - slot[2]) <= REST_JITTER * Math.SQRT2 + 1e-9, `the flop's card ${i} on its slot`);
  });
  // and the player's own cards lie on their places, turned up where they lay
  for (const c of r.scene.cards.filter((x) => x.seat === 0)) {
    const p = c.motions.at(-1).at(t).pos, place = r.places.seats[0].holes[Number(c.id.split(':')[2])];
    assert.ok(Math.hypot(p[0] - place[0], p[2] - place[2]) <= REST_JITTER * Math.SQRT2 + 1e-9, 'his card on its place');
  }
  assert.equal(r.scene.cards.filter((c) => c.seat === -2).length, 1, 'one burn before it');
  // the chips on the cloth are the table's numbers: stacks, bets and the pot, once nothing slides
  const v = r.session.view();
  const shown = r.scene.poses(t, v).chips.reduce((a, c) => a + c.value, 0);
  const real = v.seats.reduce((a, s, i) => { const k = v.handSeats.indexOf(i); return a + (k >= 0 && v.hand ? v.hand.seats[k].stack + v.hand.seats[k].total : s.stack); }, 0);
  assert.equal(shown, real, 'every chip on the cloth');
  // a fold: the hand slides to the muck, face down
  const r2 = rig({ seed: 6 });
  const fold = play(r2, { stop: (e) => e.t === 'act' && e.type === 'fold' });
  if (fold) {
    const mucked = r2.scene.cards.filter((c) => c.seat === -3);
    assert.equal(mucked.length, 2);
    for (const c of mucked) { const p = c.motions.at(-1).at(fold.now / 1000 + 5); assert.ok(dist(p.pos, r2.places.muck) < 0.03); assert.ok(Math.cos(p.roll) < -0.999); }
  }
  // a shown showdown turns over every hand still in, its cards now known
  const r3 = rig({ seed: 6, patrons: 1 });
  const show = play(r3, { stop: (e) => e.t === 'showdown' && e.result.shown });
  assert.ok(show, 'a hand shown down');
  const t3 = show.now / 1000 + 5;
  show.e.seats.forEach((seat, k) => {
    if (!show.e.holes[k]) return;
    const cs = r3.scene.cards.filter((c) => c.seat === seat);
    assert.deepEqual(cs.map((c) => c.card), show.e.holes[k], `seat ${seat}'s cards known`);
    for (const c of cs) assert.ok(Math.cos(c.motions.at(-1).at(t3).roll) > 0.999, `seat ${seat} turned up`);
  });
});
