// AUDIT CARDS-2 (2026-10-08, bible/01-Overview/Audit-Cards-2.md): THE CLOTH - the cards' motion, the table's picture
// and the plates. Driven over whole evenings at sixty frames a second (lane C's way): every chip the table holds drawn
// once on every frame, a showdown's included (M4: the winner's share and the street's last bets were both drawn for a
// moment); no card jumping, snapping or vanishing between two frames (M6: a fold started from the card's rest, not where
// it was); the call that closes a street slid in from its place (L3); a run-out's streets one after another, a burn
// each, the pot pushed after the last card turns (L1); and, one by one: the edge flip on its edge (M5's own pin is in
// cards3_motion), the board's neighbours never on one plane and the burn clear of them (L4), a stack growing away from
// its seat's cards (L5), a small table's places clear of the middle (L6), and lane E's survivors - the board's facing,
// the stack beside the bet, the deal from the dealer's hand, the burns stacked, a slide at most half the throw, the
// rest's yaw jittered, the plate's edges on the stock and the chip's caps on its colour.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CardTableSession, seatPatrons } from '../src/systems/cardTableSession.js';
import {
  CARD_W, CARD_L, CARD_T, CHIP_R, CHIP_T, YAW_JITTER, REST_JITTER, chipDiscs, dealMotion, hashSeed,
} from '../src/world/cardMotion.js';
import { tablePlaces, CardScene, BOARD_GAP, POT_ACROSS, CHIP_CLEAR, STACK_IN, STACK_SIDE } from '../src/world/cardScene.js';
import { tableFrame, cardTableSeats } from '../src/world/cardTables.js';
import { SEAT_OUT } from '../src/player/seatPose.js';
import { cardModel, chipModel, cellUv, atlasCell, chipCell, CELL_STOCK } from '../src/render/cardTableDraw.js';

const seeded = (seed = 99) => { let x = seed >>> 0; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; return x >>>= 0; }; };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const sum = (xs) => xs.reduce((a, b) => a + b, 0);

/** A 2 x 1 m table, `patrons` regulars, the session and the scene fed as the host feeds them, sixty frames a second. */
function evening({ seed = 1, patrons = 3, seconds = 150, frame = () => {}, onDrain = () => {} } = {}) {
  const table = { aabb: { min: [10, 0, 20], max: [12, 0.8, 21] } };
  const seats = cardTableSeats(table, () => true);
  const places = tablePlaces(tableFrame(table), seats, Array.from({ length: patrons + 1 }, (_, i) => i));
  const r = seeded(seed);
  const session = new CardTableSession({ player: { id: 'you', name: 'You', stack: 500 }, patrons: seatPatrons(['Ana', 'Bors', 'Cael', 'Dun', 'Eira'].slice(0, patrons), { bb: 10 }, r), stakes: { sb: 5, bb: 10 }, rand32: r, now: 0 });
  const scene = new CardScene({ places, playerSeat: 0, tableSeed: seed });
  const total = sum(session.seats.map((s) => s.stack));
  const holeOf = (seat, k) => { const v = session.view(); const i = v.handSeats.indexOf(seat); return v.hand && i >= 0 && v.hand.seats[i].hole ? v.hand.seats[i].hole[k] : -1; };
  const pr = seeded(seed + 1000);
  for (let f = 0; f < seconds * 60 && !session.over; f++) {
    const now = (f * 1000) / 60;
    session.tick(now);
    const l = session.legal();
    if (l && pr() % 4 === 0) {   // the player thinks a few frames, then checks, calls, raises or folds
      const roll = pr() % 10;
      session.playerAct(roll < 1 ? { type: 'fold' } : roll < 3 && l.raise ? { type: 'raise', to: roll === 2 ? l.raise.max : l.raise.min } : l.check ? { type: 'check' } : { type: 'call' }, now);
    }
    const events = session.drain();
    for (const e of events) scene.onEvent(e, holeOf);
    if (events.length) onDrain(events, scene, places);
    frame(scene.poses(now / 1000, session.view()), now / 1000, events, scene);
  }
  return { session, scene, places, total };
}

test('AUDIT CARDS-2 M4: every chip the table holds is drawn once on every frame - through every showdown', () => {
  let frames = 0, showdowns = 0;
  for (const seed of [1, 2, 3, 6]) {
    let total = null;
    const { total: t0 } = evening({
      seed,
      onDrain: (events) => { showdowns += events.filter((e) => e.t === 'showdown').length; },
      frame: (p, t) => { frames++; const drawn = sum(p.chips.map((c) => c.value)); if (total === null) total = drawn; assert.equal(drawn, total, `seed ${seed} at ${t.toFixed(3)} s: ${drawn} drawn, ${total} at the table`); },
    });
    assert.equal(total, t0, 'the chips drawn are the table\'s');
  }
  assert.ok(showdowns > 20 && frames > 20000, `${showdowns} showdowns over ${frames} frames`);
});

test('AUDIT CARDS-2 M6, L3: no card jumps, snaps or vanishes between frames; a street\'s closing call slides in from its place', () => {
  let checked = 0, closers = 0;
  for (const seed of [1, 4, 5]) {
    let last = new Map();
    evening({
      seed,
      onDrain: (events, scene, places) => {
        if (events.some((e) => e.t === 'hand')) last = new Map();   // a new deal clears the cloth
        // the act that closed a street (or the hand) and the street itself in one drain: its chips slid from its place
        const i = events.findIndex((e) => e.t === 'street' || e.t === 'showdown');
        const closer = i > 0 ? events[i - 1] : null;
        if (closer?.t === 'act' && closer.paid > 0) {
          assert.ok(scene.pushes.some((p) => p.from === places.seats[closer.seat].bet && p.amount >= closer.paid), `seed ${seed}: the closing ${closer.type} of ${closer.paid} slides in`);
          closers++;
        }
      },
      frame: (p, t, events, scene) => {
        const now = new Map();
        scene.cards.forEach((c, k) => { const pose = scene._poseOf(c, t); if (!pose.held) now.set(c.id, pose); else if (last.has(c.id)) assert.fail(`seed ${seed}: card ${c.id} vanished at ${t.toFixed(3)}`); void k; });
        for (const [id, q] of now) {
          const was = last.get(id);
          if (!was) continue;
          assert.ok(dist(q.pos, was.pos) < 0.06, `seed ${seed}: ${id} jumped ${dist(q.pos, was.pos).toFixed(3)} m at ${t.toFixed(3)}`);
          assert.ok(Math.abs(q.roll - was.roll) < 0.6, `seed ${seed}: ${id} snapped over at ${t.toFixed(3)}`);
          assert.ok(Math.abs(q.yaw - was.yaw) < 0.4, `seed ${seed}: ${id} spun at ${t.toFixed(3)}`);
          checked++;
        }
        last = now;
      },
    });
  }
  assert.ok(checked > 100000 && closers > 10, `${checked} card-frames, ${closers} closing calls`);
});

test('AUDIT CARDS-2 L1: a run-out\'s streets one after another - a burn each - and the pot pushed after the last card turns', () => {
  let seen = 0;
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    evening({
      seed, seconds: 120,
      onDrain: (events, scene) => {
        const streets = events.filter((e) => e.t === 'street');
        const sd = events.find((e) => e.t === 'showdown');
        if (streets.length < 2 || !sd) return;
        seen++;
        const burns = scene.cards.filter((c) => c.seat === -2);
        const board = scene.cards.filter((c) => c.seat === -1);
        assert.equal(burns.length, board.length === 5 ? 3 : board.length === 4 ? 2 : 1, 'a burn for every street');
        const starts = streets.map((e) => scene.cards.find((c) => c.id === `c${scene.handNo}:${e.board.length - 1}`).motions[0].t0);
        for (let k = 1; k < starts.length; k++) assert.ok(starts[k] > starts[k - 1], 'each street thrown after the last');
        const lastTurn = Math.max(...board.map((c) => c.motions.at(-1).t1));
        const firstPush = Math.min(...scene.pushes.filter((p) => p.potShare).map((p) => p.t0));
        assert.ok(firstPush > lastTurn, `the pot goes at ${firstPush.toFixed(2)}, after the river turns at ${lastTurn.toFixed(2)}`);
      },
    });
    if (seen >= 3) break;
  }
  assert.ok(seen >= 1, 'a run-out was played');
});

test('AUDIT CARDS-2 L4, L5, L6: board neighbours on their own planes, the burn clear of them, stacks away from the cards, a small table\'s places clear', () => {
  // a settled river: neighbours a card thickness apart in height; the burn a gap and a half from the first slot
  let rivers = 0;
  evening({
    seed: 2, seconds: 200,
    frame: (p, t, events, scene) => {
      const board = scene.cards.filter((c) => c.seat === -1);
      if (board.length !== 5 || board.some((c) => t < c.motions.at(-1).t1)) return;
      const ys = board.map((c) => c.motions.at(-1).at(Infinity).pos[1]);
      for (let i = 1; i < 5; i++) assert.ok(Math.abs(ys[i] - ys[i - 1]) > CARD_T / 2, 'neighbours never share a plane');
      rivers++;
    },
  });
  assert.ok(rivers > 0);
  const table = { aabb: { min: [10, 0, 20], max: [12, 0.8, 21] } };
  const seats = cardTableSeats(table, () => true);
  const places = tablePlaces(tableFrame(table), seats, seats.map((_, i) => i));
  assert.ok(dist(places.burn, places.board[0]) >= 1.5 * BOARD_GAP - 1e-9, 'the burn a gap and a half off');
  // a stack's columns grow away from the cards: none reaches back over the seat's second hole card
  for (const amount of [630, 1130, 2630, 9999]) {
    const s = seats[2], place = places.seats[2];
    const r = [Math.cos(s.yaw), -Math.sin(s.yaw)];
    const side = (pt) => (pt[0] - place.holes[1][0]) * r[0] + (pt[2] - place.holes[1][2]) * r[1];
    for (const d of chipDiscs(amount, place.stack, place.yaw, true)) assert.ok(side(d.pos) - CHIP_R > CARD_W / 2, `${amount}: a chip over the card`);
  }
  // on the cloth itself, a whole evening: no chip of any stack inside a hole card it would cut through
  let looked = 0;
  evening({
    seed: 3, seconds: 160,
    frame: (p, t, events, scene) => {
      if (Math.round(t * 60) % 30) return;
      // cards at rest (a throw's last centimetres may skim a stack - recorded in Tavern-Cards section 19)
      const holes = scene.cards.filter((c) => c.seat >= 0 && t >= c.motions[c.motions.length - 1].t1).map((c) => scene._poseOf(c, t));
      for (const ch of p.chips) for (const q of holes) {
        const dx = ch.pos[0] - q.pos[0], dz = ch.pos[2] - q.pos[2];
        const across = Math.abs(dx * Math.cos(q.yaw) - dz * Math.sin(q.yaw)), along = Math.abs(dx * Math.sin(q.yaw) + dz * Math.cos(q.yaw));
        const inside = across < CARD_W / 2 + CHIP_R * 0.5 && along < CARD_L / 2 + CHIP_R * 0.5 && Math.abs(ch.pos[1] - q.pos[1]) < CHIP_T / 2 + CARD_T;
        assert.ok(!inside, `a chip through a hole card at ${t.toFixed(2)}`);
        looked++;
      }
    },
  });
  assert.ok(looked > 10000, `chip-card pairs looked at: ${looked}`);
  // the board turned across the board's own axis: two thousand streets, every card on its slot within the throw's jitter
  {
    const sc = new CardScene({ places, playerSeat: 0, tableSeed: 5 });
    let worst = 0;
    for (let h = 1; h <= 2000; h++) {
      sc.onEvent({ t: 'hand', hand: h, button: 0, seats: [0, 1], at: 0 }, () => -1);
      sc.onEvent({ t: 'street', street: 'river', board: [0, 1, 2, 3, 4], at: 0 }, () => -1);
      for (const c of sc.cards.filter((x) => x.seat === -1)) {
        const end = c.motions.at(-1).at(Infinity).pos, slot = places.board[Number(c.id.split(':')[1])];
        worst = Math.max(worst, Math.hypot(end[0] - slot[0], end[2] - slot[2]));
        // the turn carries it exactly a width along the board's axis from where the throw stopped - never along its
        // own jittered yaw
        const rest = c.motions[0].rest;
        assert.ok(Math.abs(end[0] - (rest[0] + Math.cos(places.boardYaw) * CARD_W)) < 1e-9 && Math.abs(end[2] - (rest[2] - Math.sin(places.boardYaw) * CARD_W)) < 1e-9, `${c.id} turned off the board's axis`);
      }
    }
    assert.ok(worst <= REST_JITTER * Math.SQRT2 + 1e-9, `the worst board card ${(worst * 1000).toFixed(2)} mm off its slot`);
  }
  // a small table (1 x 0.6 m): every bet clear of the pot and the muck
  const small = { aabb: { min: [0, 0, 0], max: [1, 0.8, 0.6] } };
  const ss = cardTableSeats(small, () => true);
  const sp = tablePlaces(tableFrame(small), ss, ss.map((_, i) => i));
  for (const pl of sp.seats) for (const mid of [sp.pot, sp.muck]) assert.ok(dist(pl.bet, mid) >= CHIP_CLEAR - 1e-9, 'a bet clear of the middle');
  for (const pl of sp.seats) for (const b of sp.board) assert.ok(dist(pl.bet, b) > CARD_L / 2, 'and of the board');
  assert.ok(POT_ACROSS > 0);
});

test('AUDIT CARDS-2 E: the board faces across its row, the stack beside the bet, the deal from the dealer\'s hand, burns stacked, a slide at most half the throw, a jittered rest', () => {
  const table = { aabb: { min: [10, 0, 20], max: [12, 0.8, 21] } };
  const seats = cardTableSeats(table, () => true);
  const frame = tableFrame(table);
  const places = tablePlaces(frame, seats, seats.map((_, i) => i));
  assert.equal(places.boardYaw, frame.axisYaw + Math.PI / 2, 'a board card lies across the row');
  // the stack STACK_SIDE to the bet's right, STACK_IN from the edge
  const s = seats[0], p = places.seats[0];
  const f = [Math.sin(s.yaw), Math.cos(s.yaw)], r = [Math.cos(s.yaw), -Math.sin(s.yaw)];
  const off = [p.stack[0] - s.feet[0], p.stack[2] - s.feet[2]];
  assert.ok(Math.abs(off[0] * r[0] + off[1] * r[1] - STACK_SIDE) < 1e-9);
  assert.ok(Math.abs(off[0] * f[0] + off[1] * f[1] - (SEAT_OUT + STACK_IN)) < 1e-9);
  // the deal and the streets thrown from the dealer's hand; burns piled
  let hands = 0;
  evening({
    seed: 3, seconds: 200,
    onDrain: (events, scene, pl) => {
      const hand = events.find((e) => e.t === 'hand');
      if (hand) {
        hands++;
        for (const c of scene.cards) assert.deepEqual(c.motions[0].at(c.motions[0].t0 - 1).pos, pl.seats[hand.button].deal, 'from the button\'s hand');
      }
      if (events.some((e) => e.t === 'street')) {
        const thrown = scene.cards.filter((c) => c.seat === -1 || c.seat === -2);
        for (const c of thrown) assert.deepEqual(c.motions[0].at(c.motions[0].t0 - 1).pos, pl.seats[scene.dealer].deal);
        const burns = scene.cards.filter((c) => c.seat === -2).map((c) => c.motions[0].rest[1]);
        for (let k = 1; k < burns.length; k++) assert.ok(burns[k] > burns[k - 1], 'each burn on the last');
      }
    },
  });
  assert.ok(hands > 3);
  // a slide is never more than half the throw; the rest's yaw jittered, within YAW_JITTER
  const yaws = new Set();
  for (let seed = 0; seed < 200; seed++) {
    // short throws too - a card pushed a few centimetres, where the slide's own length would pass the rest
    const from = seed % 2 ? [0, 1, 0] : [0.02, 0.82, 0.29], to = [0.05 + (seed % 7) * 0.1 * (seed % 2), 0.8, 0.3];
    const m = dealMotion({ from, to, yaw: 0.5, t0: 0, seed: hashSeed(seed) });
    const land = m.at(m.land).pos;
    const flat = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
    assert.ok(flat(land, m.rest) <= flat(from, m.rest) / 2 + 1e-9, 'the slide no more than half the throw');
    const y = m.at(Infinity).yaw - 0.5;
    assert.ok(Math.abs(y) <= YAW_JITTER + 1e-12);
    yaws.add(y.toFixed(4));
  }
  assert.ok(yaws.size > 150, 'and its yaw differs throw to throw');
});

test('AUDIT CARDS-2 E: the plate\'s edges on the stock, the chip\'s caps on its colour and its side on the band', () => {
  const m = cardModel(atlasCell(12));
  const [su0, sv0, su1, sv1] = cellUv(CELL_STOCK);
  for (let i = 8; i < 24; i++) {
    const u = m.uvs[i * 2], v = m.uvs[i * 2 + 1];
    assert.ok(u >= su0 - 1e-6 && u <= su1 + 1e-6 && v >= sv0 - 1e-6 && v <= sv1 + 1e-6, `edge vertex ${i} on the stock`);
  }
  const c = chipModel(1);
  const [u0, v0, u1, v1] = cellUv(chipCell(1));
  const vBody = v0 + (v1 - v0) * 0.35, vBand = v0 + (v1 - v0) * 0.9;
  for (let i = 0; i < c.positions.length / 3; i++) {
    const y = c.positions[i * 3 + 1], u = c.uvs[i * 2], v = c.uvs[i * 2 + 1];
    assert.ok(u >= u0 - 1e-6 && u <= u1 + 1e-6, 'inside the chip\'s cell');
    const cap = Math.abs(c.normals[i * 3 + 1]) === 1;
    if (cap) assert.ok(Math.abs(v - vBody) < 1e-6, 'a cap on the body\'s colour');
    else assert.ok(v >= vBand - 1e-6 && v <= v1 + 1e-6 && Math.abs(Math.abs(y) - CHIP_T / 2) < 1e-6, 'the side on the band');
  }
});
