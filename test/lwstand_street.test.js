// LW-STAND (field, 2026-10-05, Mac: "NPCs will get stuck over bodies of water, or be stuck running into walls";
// bible/06-Systems/Living-World.md, the LW-STAND record): A PLACE TO STAND IS ON THE STREET. The stands about a spot -
// one alone up to 3.5 m out, a circle further for each circle - were drawn by geometry alone, and a spot stands a few
// cells before a door, or at a port's dock on the water's edge: the stand fell in a building's wall or over the harbour
// and the walker walked straight into it; the way to a stand was straight, round a corner or not. And a walker whose
// next walk was not searched yet kept its stride and walked on the spot, then cut straight across to where the walk's
// clock had got to. AUDIT LW-STAND: the street is exact (a body's whole square, a way's whole sweep), a stand stands on
// the spot's open bearings at its own distance (never pulled in along a blocked line onto another's place), a circle
// turns about its middle till it fits, and every stand is reached. The towns are the synthetic ones (test/lwTown.mjs:
// the open one, and one built solid to its streets); the street is read here off the net itself, cell by cell under a
// body's whole square, never through the geometry under test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { synthTown, closeTown } from './lwTown.mjs';
import { townPlaces, harbourDock, streetGeometry, STAND_REACH_M } from '../src/systems/livingWorld/places.js';
import { circleStands, circleMiddle, aloneStand, CIRCLE_APART, STAND_BEARINGS, STAND_SOUND_M, STAND_MARGIN_M, ALONE_NEED_M, ALONE_FAR_M } from '../src/systems/livingWorld/meetups.js';
import { LivingTown } from '../src/systems/livingWorld/livingTown.js';
import { ResidentWalker, STAND_FRAME } from '../src/characters/residentWalker.js';   // LW-TALK: PIN MOVED - standing, the wheel's still frame
import { PERSON_MOVE_SPEED, MOVE_RECORDS } from '../src/characters/mobilePerson.js';
import { CityNavigation, NAV_CELL } from '../src/world/cityNavigation.js';
import { DAY_MIN, isOutdoor } from '../src/systems/livingWorld/dayPlan.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';

const RATE = CLASSIC_MINUTES_PER_SECOND;
const MPM = PERSON_MOVE_SPEED / RATE;
const TOWN = Object.freeze({ mapId: 12345, blocks: 9, region: 17, people: 3, port: false });

/** The street, read off the net itself: every cell a body's square overlaps (its corners too) the net's. */
function streetOf(nav, places) {
  const net = (cx, cy) => cx >= 0 && cy >= 0 && cx < nav.width && cy < nav.height && places.net[cy * nav.width + cx] === places.netId;
  const r = STAND_REACH_M - 1e-4;
  return (x, z) => {
    for (let cy = Math.floor((z - r) / NAV_CELL); cy <= Math.floor((z + r) / NAV_CELL); cy++) {
      for (let cx = Math.floor((x - r) / NAV_CELL); cx <= Math.floor((x + r) / NAV_CELL); cx++) if (!net(cx, cy)) return false;
    }
    return true;
  };
}
/** Every point of the straight line from `a` to `b`, a centimetre apart, on the street. */
const lineOn = (on, a, b) => {
  const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(d / 0.01));
  for (let i = 0; i <= n; i++) if (!on(a.x + ((b.x - a.x) * i) / n, a.z + ((b.z - a.z) * i) / n)) return false;
  return true;
};
const turnOf = (y) => Math.atan2(Math.sin(y), Math.cos(y));

test('LW-STAND the street: exact - a body is its whole square of STAND_REACH_M (a corner of a wall stands it off, where four probes on its axes did not), a way holds it where its whole sweep does, so any part of a way the street holds it holds too, and a place is held as the way that stands still on it; the grid\'s outside is no street (mutants: the reach dropped; the cells beside the way unread; a way entered at its start unread)', () => {
  assert.equal(STAND_REACH_M, 0.4);
  // a street of one blocked cell: (5, 5), 8 m to 9.6 m each way
  const nav = new CityNavigation(1, 1);
  const W = nav.width;
  const net = new Int32Array(nav.width * nav.height).fill(1);
  net[5 * W + 5] = 0;
  const street = streetGeometry(nav, { net, netId: 1 });
  assert.equal(street.holds(8.8, 8.8), false, 'in the cell');
  assert.equal(street.holds(8 - 0.41, 8.8), true, 'beside it, past a body\'s reach');
  assert.equal(street.holds(8 - 0.39, 8.8), false, 'within a body\'s reach of its side');
  assert.equal(street.holds(8 - 0.3, 8 - 0.3), false, 'off its corner, within reach both ways: the corner under the body\'s square');
  assert.equal(street.holds(8 - 0.41, 8 - 0.3), true, 'past reach one way');
  // a way toward it stops a body's reach short of it, to the micrometre
  assert.ok(Math.abs(street.reach(2, 8.8, 12, 8.8) - (8 - STAND_REACH_M - 2)) < 1e-5, `${street.reach(2, 8.8, 12, 8.8)}: a reach short of the wall`);
  assert.equal(street.reach(2, 2, 2, 7), 5, 'a way the street holds, whole');
  assert.equal(street.clear(2, 2, 2, 7), true);
  assert.equal(street.clear(8.8, 8.8, 8.8, 20), false, 'begun in the wall');
  assert.equal(street.reach(8.8, 8.8, 8.8, 20), 0);
  // a way that grazes the corner within a body's reach, and one that clears it
  assert.equal(street.clear(7.5, 7.5, 7.7, 10), false, 'past the corner, within reach of it');
  assert.equal(street.clear(7.5, 7.0, 10, 7.5), true, 'along it, past reach');
  // any part of a way the street holds it holds too, and a place is held as the way that stands still on it
  let s = 7, clear = 0;
  const rnd = () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 2 ** 32);
  for (let i = 0; i < 4000; i++) {
    const ax = 4 + rnd() * 9, az = 4 + rnd() * 9, bx = 4 + rnd() * 9, bz = 4 + rnd() * 9;
    assert.equal(street.holds(ax, az), street.clear(ax, az, ax, az));
    if (!street.clear(ax, az, bx, bz)) continue;
    clear++;
    const u = rnd(), v = u + (1 - u) * rnd();
    assert.ok(street.clear(ax + (bx - ax) * u, az + (bz - az) * u, ax + (bx - ax) * v, az + (bz - az) * v), 'a part of a clear way, clear');
    assert.ok(lineOn(streetOf(nav, { net, netId: 1 }), { x: ax, z: az }, { x: bx, z: bz }), 'and clear cell by cell');
  }
  assert.ok(clear > 500, `ways held (${clear})`);
  assert.equal(street.holds(-1, 8), false, 'the grid\'s outside');
  assert.equal(street.holds(0.41, 8), true, 'its edge, within');
});

test('LW-STAND the law: on the open and the close-built towns, every stand at every spot - one alone, and every place in a circle - held by the street, the way out to it from the spot over open street; one alone at their own distance, never on another\'s place; a circle\'s people a pace apart, each facing its middle (the one on it, in a line, facing the spot); at a spot open all round, as drawn (mutants: the bearings not mapped; one alone drawn in along a blocked bearing; the circle not turned; a member facing north; the middle off the open bearings)', () => {
  assert.ok(STAND_BEARINGS >= 64 && STAND_SOUND_M >= 16 && STAND_MARGIN_M > 0 && ALONE_NEED_M === 1 && ALONE_FAR_M === 3.5);
  const towns = [['open 3x3', synthTown()], ['open 6x6', synthTown({ blocksW: 6, blocksH: 6 })], ['close-built', closeTown()]];
  let tightStreet = 0, tightDrawn = 0, lines = 0;
  for (const [name, fx] of towns) {
    const places = townPlaces(fx.nav, fx.doors, fx.buildings);
    const street = streetGeometry(fx.nav, places);
    const on = streetOf(fx.nav, places);
    const d0 = fx.doors[0];
    const edge = harbourDock(fx.nav, places, d0.x - d0.nx * 6, d0.z - d0.nz * 6);
    assert.ok(edge, 'the fixture has a spot on the street\'s edge (a dock\'s, the footprint standing for the water)');
    let off = 0;
    for (const spot of [...places.social, ...places.market, places.square, edge]) {
      assert.ok(on(spot.x, spot.z), `${name} ${spot.key}: a spot is the street's own`);
      const alone = [];
      for (let i = 0; i < 120; i++) {
        const drawn = aloneStand(spot, `L1.${i}`), st = aloneStand(spot, `L1.${i}`, street);
        if (!on(drawn.x, drawn.z)) off++;
        assert.ok(on(st.x, st.z), `${name} ${spot.key} L1.${i}: alone, held`);
        assert.ok(lineOn(on, spot, st), `${name} ${spot.key} L1.${i}: walked out to over open street`);
        assert.ok(Math.abs(turnOf(Math.atan2(spot.x - st.x, spot.z - st.z) - st.yaw)) < 1e-9, 'facing the spot');
        const dDrawn = Math.hypot(drawn.x - spot.x, drawn.z - spot.z), dSt = Math.hypot(st.x - spot.x, st.z - spot.z);
        assert.ok(Math.abs(dSt - dDrawn) < 1e-9 || dSt < dDrawn, 'never farther out than their own place');
        alone.push(st);
      }
      for (let i = 0; i < alone.length; i++) {
        for (let j = i + 1; j < alone.length; j++) {
          const d = Math.hypot(alone[i].x - alone[j].x, alone[i].z - alone[j].z);
          assert.ok(d > 1e-6, `${name} ${spot.key}: two alone never on one place`);
          if (d < 0.1) tightStreet++;
        }
      }
      for (let i = 0; i < 120; i++) for (let j = i + 1; j < 120; j++) { const a = aloneStand(spot, `L1.${i}`), b = aloneStand(spot, `L1.${j}`); if (Math.hypot(a.x - b.x, a.z - b.z) < 0.1) tightDrawn++; }
      for (let index = 0; index < 6; index++) {
        for (const size of [2, 3]) {
          const circle = { index, members: Array.from({ length: size }, (_, k) => ({ id: `m${k}` })) };
          const stands = circleStands(spot, circle, street), middle = circleMiddle(spot, circle, street);
          assert.equal(stands.length, size);
          assert.ok(on(middle.x, middle.z) && lineOn(on, spot, middle), `${name} ${spot.key} circle ${index}: its middle held, seen from the spot`);
          for (let i = 0; i < stands.length; i++) {
            const st = stands[i];
            assert.ok(on(st.x, st.z), `${name} ${spot.key} circle ${index}: held`);
            assert.ok(lineOn(on, spot, st), `${name} ${spot.key} circle ${index}: seen from the spot`);
            for (let j = i + 1; j < stands.length; j++) assert.ok(Math.hypot(st.x - stands[j].x, st.z - stands[j].z) >= 1, `${name} ${spot.key} circle ${index}: a pace apart`);
            const toMiddle = Math.hypot(middle.x - st.x, middle.z - st.z);
            if (toMiddle > 1e-6) {
              const inward = Math.atan2(middle.x - st.x, middle.z - st.z);
              const along = Math.atan2(middle.x - spot.x, middle.z - spot.z);
              assert.ok(Math.abs(turnOf(st.yaw - inward)) < 1e-9 || Math.abs(turnOf(st.yaw - along)) < 1e-9 || Math.abs(turnOf(st.yaw - along - Math.PI)) < 1e-9, `${name} ${spot.key} circle ${index}: facing its middle`);
            } else {
              lines++;
              assert.ok(Math.abs(turnOf(st.yaw - Math.atan2(spot.x - st.x, spot.z - st.z))) < 1e-9, `${name} ${spot.key} circle ${index}: on its middle, facing the spot - never north`);
            }
          }
        }
      }
    }
    assert.ok(off > 20, `${name}: the fixture's drawn stands fall off the street (${off}) - else this pins nothing`);
  }
  assert.ok(tightStreet <= 2 * tightDrawn + 40, `alone, never on one another: ${tightStreet} pairs within 0.1 m, drawn by geometry alone ${tightDrawn}`);
  assert.ok(lines > 0, `a circle with no room to turn in, in a line (${lines})`);
  // a spot open all round: every stand as drawn, exactly
  const open = new CityNavigation(2, 2);
  const openNet = new Int32Array(open.width * open.height).fill(1);
  const openStreet = streetGeometry(open, { net: openNet, netId: 1 });
  const middleSpot = { key: 'm', x: open.width * NAV_CELL / 2, z: open.height * NAV_CELL / 2 };
  for (let i = 0; i < 60; i++) assert.deepEqual(aloneStand(middleSpot, `L1.${i}`, openStreet), aloneStand(middleSpot, `L1.${i}`), 'alone, as drawn');
  for (let index = 0; index < 6; index++) for (const size of [2, 3]) {
    const circle = { index, members: Array.from({ length: size }, (_, k) => ({ id: `m${k}` })) };
    assert.deepEqual(circleStands(middleSpot, circle, openStreet), circleStands(middleSpot, circle), 'a circle, as drawn');
  }
  assert.ok(CIRCLE_APART === 1.25);
  // a circle that does not fit as drawn is turned about its middle till it does: a street open all round but for a post
  // where one of its places would stand
  const spot0 = { key: 'post', x: 0, z: 0 }, three = { index: 1, members: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] };
  const post = circleStands(spot0, three)[1];
  const posted = {
    holds: (x, z) => Math.hypot(x - post.x, z - post.z) > 0.3,
    reach: (ax, az, bx, bz) => Math.hypot(bx - ax, bz - az),
    clear: (ax, az, bx, bz) => Math.hypot(bx - post.x, bz - post.z) > 0.3,
  };
  const turned = circleStands(spot0, three, posted), mid = circleMiddle(spot0, three, posted);
  assert.deepEqual(mid, circleMiddle(spot0, three), 'its middle as drawn, the street open all round');
  assert.ok(turned.every((st) => Math.hypot(st.x - post.x, st.z - post.z) > 0.3), 'clear of the post');
  assert.ok(turned.every((st) => Math.abs(Math.hypot(st.x - mid.x, st.z - mid.z) - CIRCLE_APART / 2) < 1e-9), 'still a circle about its middle - turned, never a line');
});

function makeTown(minute, fx = synthTown()) {
  const { nav, buildings, doors } = fx;
  const clock = { t: minute };
  const town = new LivingTown(nav, {
    town: TOWN, buildings, doors,
    makePerson: (archive, guard) => new ResidentWalker(nav, { archive, guard, frameCount: () => 4, groundY: () => 0.25 }),
    clock: () => clock.t, rate: () => RATE, mpm: MPM, suppressSpawns: () => false,
    relations: () => null, playerName: () => 'Mac', townName: 'Synth', regionName: 'Daggerfall',
  });
  return { town, clock, nav };
}
const SQUARE = [96 * 1.6 + 0.8, 0, 96 * 1.6 + 0.8];

test('LW-STAND the town: every resident at a stay through the day stands where the town puts them on the street (one alone about their spot, the circles at it) - the town hands its stands its own street (mutants: the host\'s stands unkept, alone and in a circle)', () => {
  const day = 100;
  const { town, nav } = makeTown(day * DAY_MIN + 8 * 60);
  const on = streetOf(nav, town.places);
  let stays = 0, circled = 0, aloneOff = 0, circleOff = 0;
  for (let m = 6 * 60; m < 23 * 60; m += 20) {
    const t = day * DAY_MIN + m;
    town._now = t;
    town._tick(SQUARE, 0);   // the census's beat: the circles at every spot this round
    for (const res of town.residents) {
      const w = town.where(res, t, false);
      if (!w || w.pending || w.e.kind === 'walk' || !isOutdoor(w.e)) continue;
      stays++;
      const c = town._inCircle.get(res.id);
      if (c && c.spot === w.e.at) {
        circled++;
        const drawn = circleStands(w.e.at, c.circle)[c.index];
        if (!on(drawn.x, drawn.z)) circleOff++;
      } else if (!on(aloneStand(w.e.at, res.id).x, aloneStand(w.e.at, res.id).z)) aloneOff++;
      assert.ok(on(w.x, w.z), `${res.id} at ${w.e.at.key}, minute ${m}${c ? ' in a circle' : ''}: on the street`);
    }
  }
  assert.ok(stays > 300 && circled > 100, `a day of stays (${stays}), in circles (${circled})`);
  assert.ok(aloneOff > 0 && circleOff > 0, `drawn by geometry alone some stood off the street (alone ${aloneOff}, in a circle ${circleOff}) - else this pins nothing`);
});

test('LW-STAND the pause: a resident in view whose next walk is not searched yet stands where they are, idle - never walking on the spot into whatever they face - and the pause\'s minutes are owed as the politeness gate\'s are: the walk searched, they walk it on from where they stood, never cut straight across to where its clock had got to; and the pause ends there, its minutes walked off (mutants: the stride kept; the pause unowed; the pause kept after the walk is searched)', () => {
  const day = 100;
  const t = makeTown(day * DAY_MIN + 17 * 60);
  const dt = 1 / 30;
  let yaw = 0;
  const frame = () => { t.clock.t += dt * RATE; return t.town.update(dt, SQUARE, yaw, SQUARE, true, () => false); };
  let seats = [];
  for (let i = 0; i < 60; i++) seats = frame();
  assert.ok(seats.length > 4, `a street in view (${seats.length})`);
  // the player turned to face the most of those walking (one waiting on a walk drops from the census's wanted, and goes
  // once out of view)
  const walking = seats.map((x) => x.person).filter((p) => t.town.where(p.living.res, t.clock.t, false)?.moving);
  const facing = (y, p) => (p.pos[0] - SQUARE[0]) * Math.sin(y) + (p.pos[2] - SQUARE[2]) * Math.cos(y) > 1 && Math.hypot(p.pos[0] - SQUARE[0], p.pos[2] - SQUARE[2]) < 100;
  for (let k = 1; k < 16; k++) if (walking.filter((p) => facing((k * Math.PI) / 8, p)).length > walking.filter((p) => facing(yaw, p)).length) yaw = (k * Math.PI) / 8;
  // every walk unsearched from here: each body in view mid-stride, then three seconds of the pause
  t.town._line = () => undefined;
  const bodies = seats.map((x) => x.person);
  for (const p of bodies) p.moving = true;
  const at = new Map(bodies.map((p) => [p, [p.pos[0], p.pos[2]]]));
  /** each paused body's walk's minute when the pause began (the minute its frame read) */
  const began = new Map();
  for (let i = 0; i < 90; i++) {
    for (const { person: p, out } of frame()) {
      if (!at.has(p)) continue;
      const read = t.clock.t - (t.town._lag.get(p.living.res.id) ?? 0);
      if (!t.town.where(p.living.res, read, false)?.pending) continue;
      if (!began.has(p)) began.set(p, read);
      assert.equal(p.moving, false, `${p.living.res.id}: stands, not a walk on the spot`);
      if (!p.armed) assert.ok(MOVE_RECORDS.includes(out.record) && out.frame === STAND_FRAME, 'standing: the walk wheel\'s still frame');   // LW-TALK: PIN MOVED - the idle record is the politeness gate's alone
      assert.deepEqual([p.pos[0], p.pos[2]], at.get(p), 'where they were');
      assert.ok(Math.abs(read - began.get(p)) < 1e-6, `${p.living.res.id}: the walk's clock held while it waits (${(read - began.get(p)).toFixed(3)} min on)`);
    }
  }
  assert.ok(began.size > 0, `some in view wait on a walk (${began.size}) - else this pins nothing`);
  // searched: the walk read from the minute the pause began (the pause owed), the body walks on from there
  delete t.town._line;
  frame();
  let resumed = 0;
  /** @type {Map<any, number>} the minutes each resumed walker owed as it walked on */
  const owed = new Map();
  for (const [p, t0] of began) {
    if (!p.living) continue;
    const lag = t.town._lag.get(p.living.res.id) ?? 0;
    const w = t.town.where(p.living.res, t.clock.t - lag, false);
    if (!w || w.pending || !w.moving) continue;
    resumed++;
    owed.set(p, lag);
    assert.ok(Math.abs(t.clock.t - lag - t0) <= dt * RATE + 1e-6, `${p.living.res.id}: walked on from the minute it paused (${(t.clock.t - lag - t0).toFixed(3)} min on, ${(3 * RATE).toFixed(2)} paused)`);
  }
  assert.ok(resumed > 0, `some walk on once searched (${resumed})`);
  let onward = 0;
  for (let i = 0; i < 60; i++) frame();
  for (const p of began.keys()) if (p.living && p.moving) onward++;
  assert.ok(onward > 0, `and walk (${onward})`);
  // the pause over: no row still marked paused, and the minutes it owed walked off (CATCH_UP), never owed on
  for (const row of t.town.pool) if (row.res && row.visible) assert.equal(!!row.paused, !!t.town.where(row.res, t.clock.t - (t.town._lag.get(row.res.id) ?? 0), false)?.pending, `${row.res.id}: paused only while its walk waits`);
  for (const [p, lag] of owed) if (p.living) assert.ok((t.town._lag.get(p.living.res.id) ?? 0) < lag, `${p.living.res.id}: the pause's minutes walked off (${lag.toFixed(3)} -> ${(t.town._lag.get(p.living.res.id) ?? 0).toFixed(3)})`);
});

test('LW-STAND the way to a stand: a body walks to its stand over the street - straight when the way is open, toward its spot when it is not (a new round\'s place round a building\'s corner from the last): every frame on the street, and at the stand (mutants: the straight way unread)', () => {
  const day = 100;
  const t = makeTown(day * DAY_MIN + 12 * 60);
  const on = streetOf(t.nav, t.town.places);
  // the first block's building stands from cell 6 to 17 each way: a spot off its south-west corner, one place up its
  // west wall and one along its south wall - each seen from the spot, the straight way between them through the corner
  const S = { x: 5 * NAV_CELL + NAV_CELL / 2, z: 5 * NAV_CELL + NAV_CELL / 2 };
  const A = { x: S.x, z: S.z + 3.2 }, B = { x: S.x + 3.2, z: S.z };
  assert.ok(on(S.x, S.z) && lineOn(on, S, A) && lineOn(on, S, B), 'the fixture: both places seen from the spot');
  assert.ok(!lineOn(on, A, B), 'the fixture: the straight way between them through the building');
  const player = [S.x, 0, S.z];
  const dt = 1 / 30;
  let seats = [];
  for (let i = 0; i < 30; i++) { t.clock.t += dt * RATE; seats = t.town.update(dt, player, 0, player, true, () => false); }
  assert.ok(seats.length > 0, 'a body on the street');
  const p = seats[0].person, res = p.living.res;
  const where = t.town.where.bind(t.town);
  t.town.where = (r, m, search) => (r === res ? { x: B.x, z: B.z, yaw: 0, moving: false, e: /** @type {any} */ ({ kind: 'social', at: S }) } : where(r, m, search));
  p.pos[0] = A.x; p.pos[2] = A.z;
  let seen = 0, nearest = Infinity;
  for (let i = 0; i < 30 * 8; i++) {
    t.clock.t += dt * RATE;
    const out = t.town.update(dt, player, 0, player, true, () => false);
    if (!out.some((x) => x.person === p)) continue;
    seen++;
    assert.ok(on(p.pos[0], p.pos[2]), `frame ${i}: (${p.pos[0].toFixed(2)}, ${p.pos[2].toFixed(2)}) on the street`);
    nearest = Math.min(nearest, Math.hypot(p.pos[0] - S.x, p.pos[2] - S.z));
  }
  assert.ok(seen > 100, `in view the while (${seen})`);
  assert.ok(nearest < 1, `round by the spot (${nearest.toFixed(2)} m from it) - straight on from where the way opened`);
  assert.deepEqual([p.pos[0], p.pos[2]], [B.x, B.z], 'at the stand');
  assert.equal(p.moving, false, 'and standing');
  t.town.where = where;
});

test('LW-STAND every stand reached: at the close-built town\'s square, walked to as the frame walks - from the spot to every stand, and from stand to stand - each arrives, every step on the street; never walking on the spot between two answers of the way (mutants: the street sampled, not swept)', () => {
  const { nav, buildings, doors } = closeTown();
  const places = townPlaces(nav, doors, buildings);
  const street = streetGeometry(nav, places);
  const on = streetOf(nav, places);
  const step = (PERSON_MOVE_SPEED * 1.6) / 30, S = places.square;
  const stands = [];
  for (let i = 0; i < 300; i++) stands.push(aloneStand(S, `L777.${i}`, street));
  for (let index = 0; index < 16; index++) for (const size of [2, 3]) stands.push(...circleStands(S, { index, members: Array.from({ length: size }, (_, k) => ({ id: `m${k}` })) }, street));
  // the frame's own approach (livingTown.js update): straight while the way holds, else toward the spot
  const arrives = (from, to) => {
    const p = { ...from };
    for (let n = 0; n < 1500; n++) {
      const d = Math.hypot(to.x - p.x, to.z - p.z);
      if (d <= 0.05) return true;
      let vx = to.x - p.x, vz = to.z - p.z, vd = d;
      const od = Math.hypot(S.x - p.x, S.z - p.z);
      if (od > 0.05 && !street.clear(p.x, p.z, to.x, to.z)) { vx = S.x - p.x; vz = S.z - p.z; vd = od; }
      const k = Math.min(1, step / vd);
      const q = { x: p.x + vx * k, z: p.z + vz * k };
      assert.ok(lineOn(on, p, q), 'every step on the street');
      p.x = q.x; p.z = q.z;
    }
    return false;
  };
  for (const st of stands) assert.ok(arrives(S, st), `from the spot to (${st.x.toFixed(2)}, ${st.z.toFixed(2)})`);
  let seed = 7, pairs = 0, round = 0;
  const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32);
  for (let i = 0; i < 600; i++) {
    const a = stands[Math.floor(rnd() * stands.length)], b = stands[Math.floor(rnd() * stands.length)];
    if (a === b) continue;
    pairs++;
    if (!street.clear(a.x, a.z, b.x, b.z)) round++;
    assert.ok(arrives(a, b), `from (${a.x.toFixed(2)}, ${a.z.toFixed(2)}) to (${b.x.toFixed(2)}, ${b.z.toFixed(2)})`);
  }
  assert.ok(pairs > 500 && round > 10, `stand to stand (${pairs}), round by the spot (${round})`);
});

test('LW-STAND the close-built town: a town built solid to its streets, run as the street runs it through the day - every body in view, every frame, on the street: none in a wall (mutants: the host\'s stands unkept)', () => {
  const { nav, buildings, doors } = closeTown();
  const dt = 1 / 30;
  let frames = 0, stood = 0;
  for (const hour of [8, 13, 18]) {
    const clock = { t: 100 * DAY_MIN + hour * 60 };
    const town = new LivingTown(nav, {
      town: { ...TOWN, mapId: 777, blocks: 16 }, buildings, doors,
      makePerson: (archive, guard) => new ResidentWalker(nav, { archive, guard, frameCount: () => 4, groundY: () => 0.25 }),
      clock: () => clock.t, rate: () => RATE, mpm: MPM, suppressSpawns: () => false,
      relations: () => null, playerName: () => 'Mac', townName: 'Close', regionName: 'Daggerfall',
    });
    const on = streetOf(nav, town.places);
    const player = [24 * NAV_CELL + 2.4, 0, 24 * NAV_CELL + 2.4];   // where two streets cross
    for (let i = 0; i < 30 * 12; i++) {
      clock.t += dt * RATE;
      for (const { person: p } of town.update(dt, player, 0, player, true, () => false)) {
        frames++;
        if (!p.moving) stood++;
        assert.ok(on(p.pos[0], p.pos[2]), `${p.living.res.id} at ${hour}:00 (${p.pos[0].toFixed(2)}, ${p.pos[2].toFixed(2)}): on the street`);
      }
    }
  }
  assert.ok(frames > 20000 && stood > 5000, `a day's street in view (${frames} body-frames, ${stood} standing)`);
});
