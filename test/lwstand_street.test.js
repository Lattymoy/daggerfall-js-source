// LW-STAND (field, 2026-10-05, Mac: "NPCs will get stuck over bodies of water, or be stuck running into walls";
// bible/06-Systems/Living-World.md, the LW-STAND record): A PLACE TO STAND IS ON THE STREET. The stands about a spot -
// one alone up to 3.5 m out, a circle further for each circle - were drawn by geometry alone, and a spot stands a few
// cells before a door, or at a port's dock on the water's edge: the stand fell in a building's wall or over the harbour
// and the walker walked straight into it; the way to a stand was straight, round a corner or not. And a walker whose
// next walk was not searched yet kept its stride and walked on the spot, then cut straight across to where the walk's
// clock had got to. The towns are the synthetic ones (test/lwTown.mjs: the open one, and one built solid to its
// streets); the street is read here off the net itself, never through the predicate under test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { synthTown, closeTown } from './lwTown.mjs';
import { townPlaces, harbourDock, onStreet, STAND_REACH_M } from '../src/systems/livingWorld/places.js';
import { circleStands, circleMiddle, aloneStand, standOn, streetReach, STAND_STEP_M, CIRCLE_OUT } from '../src/systems/livingWorld/meetups.js';
import { LivingTown } from '../src/systems/livingWorld/livingTown.js';
import { ResidentWalker } from '../src/characters/residentWalker.js';
import { PERSON_MOVE_SPEED, PERSON_IDLE_RECORD, PERSON_GUARD_IDLE_RECORD } from '../src/characters/mobilePerson.js';
import { NAV_CELL } from '../src/world/cityNavigation.js';
import { DAY_MIN, isOutdoor } from '../src/systems/livingWorld/dayPlan.js';
import { CLASSIC_MINUTES_PER_SECOND } from '../src/systems/worldTick.js';

const RATE = CLASSIC_MINUTES_PER_SECOND;
const MPM = PERSON_MOVE_SPEED / RATE;
const TOWN = Object.freeze({ mapId: 12345, blocks: 9, region: 17, people: 3, port: false });

/** The street, read off the net itself: the point's cell and each side within a body's reach the net's. */
function streetOf(nav, places) {
  const cell = (x, z) => {
    const cx = Math.floor(x / NAV_CELL), cy = Math.floor(z / NAV_CELL);
    return cx >= 0 && cy >= 0 && cx < nav.width && cy < nav.height && places.net[cy * nav.width + cx] === places.netId;
  };
  return (x, z) => [[0, 0], [0.4, 0], [-0.4, 0], [0, 0.4], [0, -0.4]].every(([a, b]) => cell(x + a, z + b));
}
/** Every point of the straight line from `a` to `b`, a tenth of a metre apart, on the street. */
const lineOn = (on, a, b) => {
  const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(d / 0.1));
  for (let i = 0; i <= n; i++) if (!on(a.x + ((b.x - a.x) * i) / n, a.z + ((b.z - a.z) * i) / n)) return false;
  return true;
};

test('LW-STAND the law: a stand is sounded out from its anchor and stops short of the first step the street does not hold - one alone and every place in a circle on the street with a body\'s reach, the walk out to it from the spot over open street, and a stand the street holds as drawn; with no `clear`, as drawn; the street a building\'s footprint and the water are none of; a circle\'s place seen from the spot as well as from its middle (mutants: the step unread; the end alone read; the reach dropped; the circle\'s middle unkept, a circle facing into the wall; a circle\'s place unseen from the spot)', () => {
  assert.equal(STAND_REACH_M, 0.4);
  assert.ok(STAND_STEP_M > 0 && STAND_STEP_M <= NAV_CELL / 5, 'under a fifth of a cell: no cell of wall is stepped over');
  for (const blocks of [3, 6]) {
    const { nav, buildings, doors } = synthTown({ blocksW: blocks, blocksH: blocks });
    const places = townPlaces(nav, doors, buildings);
    const on = streetOf(nav, places);
    const clear = (x, z) => onStreet(nav, places, x, z);
    // a spot on the street's edge, as a harbour's dock is (the street cell nearest a berth off the shore): here the
    // nearest to a point inside a building, the footprint standing for the water
    const d0 = doors[0];
    const edge = harbourDock(nav, places, d0.x - d0.nx * 6, d0.z - d0.nz * 6);
    assert.ok(edge, 'the fixture has a spot on the street\'s edge');
    let off = 0, kept = 0, middleOff = 0;
    for (const spot of [...places.social, ...places.market, edge]) {
      assert.ok(on(spot.x, spot.z), `${spot.key}: a spot is the street's own`);
      for (let i = 0; i < 120; i++) {
        const drawn = aloneStand(spot, `L1.${i}`), st = aloneStand(spot, `L1.${i}`, clear);
        if (!on(drawn.x, drawn.z)) off++;
        assert.ok(on(st.x, st.z), `${spot.key} L1.${i}: alone, on the street`);
        assert.ok(lineOn(on, spot, st), `${spot.key} L1.${i}: walked out to over open street`);
        assert.equal(st.yaw, drawn.yaw, 'facing the spot as drawn');
        if (on(drawn.x, drawn.z) && lineOn(on, spot, drawn)) { kept++; assert.deepEqual([st.x, st.z], [drawn.x, drawn.z], 'a stand the street holds is as drawn'); }
      }
      for (let index = 0; index < 4; index++) {
        for (const size of [2, 3]) {
          const circle = { index, members: Array.from({ length: size }, (_, k) => ({ id: `m${k}` })) };
          const stands = circleStands(spot, circle, clear);
          assert.equal(stands.length, size);
          const middle = circleMiddle(spot, circle, clear), drawnMiddle = circleMiddle(spot, circle);
          if (!on(drawnMiddle.x, drawnMiddle.z)) middleOff++;
          assert.ok(on(middle.x, middle.z) && lineOn(on, spot, middle), `${spot.key} circle ${index}: its middle on the street, seen from the spot`);
          for (const st of stands) {
            assert.ok(on(st.x, st.z), `${spot.key} circle ${index}: on the street`);
            assert.ok(lineOn(on, spot, st), `${spot.key} circle ${index}: seen from the spot - walked out to over open street`);
            assert.ok(Math.abs(Math.atan2(middle.x - st.x, middle.z - st.z) - st.yaw) < 1e-9, `${spot.key} circle ${index}: facing in to its middle`);
          }
        }
      }
    }
    assert.ok(off > 20 && middleOff > 0, `the fixture's drawn stands fall off the street (${off}), and circles' middles (${middleOff}) - else this pins nothing`);
    assert.ok(kept > 500, `most stands are kept as drawn (${kept})`);
  }
  // the sounding itself: no `clear`, as drawn; a wall two metres out stops it short of the wall, on the near side
  const st = { x: 5, z: 0 };
  assert.equal(standOn({ x: 0, z: 0 }, st, null), st);
  const wallAt2 = (x) => x < 2;
  const short = standOn({ x: 0, z: 0 }, st, (x) => wallAt2(x));
  assert.ok(short.x < 2 && short.x >= 2 - STAND_STEP_M - 1e-9, `${short.x}: the last step before the wall`);
  assert.deepEqual(standOn({ x: 0, z: 0 }, st, () => false), { x: 0, z: 0 }, 'nothing clear: at the anchor itself');
  // the reach of a straight way: the whole of it when the street holds every step (or with no `clear`), else up to the
  // last step it holds
  assert.equal(streetReach(0, 0, 3, 4, null), 5);
  assert.equal(streetReach(0, 0, 3, 4, () => true), 5);
  assert.equal(streetReach(0, 0, 5, 0, wallAt2), short.x);
  assert.equal(streetReach(0, 0, 5, 0, () => false), 0);
  // a circle's place seen from its middle but not from the spot (a wall between): sounded from the spot as well, short
  // of the wall - the walk out to it from the spot over open street
  const wall = (x, z) => !(x >= 0.25 && x <= 0.6 && z >= 0.5 && z <= 1.05);
  const fine = (a, b) => { for (let i = 0; i <= 400; i++) if (!wall(a.x + ((b.x - a.x) * i) / 400, a.z + ((b.z - a.z) * i) / 400)) return false; return true; };
  const origin = { x: 0, z: 0 }, three = { index: 0, members: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] };
  const drawn = circleStands(origin, three);
  const middle = { x: 0, z: CIRCLE_OUT };
  assert.ok(drawn.some((d) => fine(middle, d) && !fine(origin, d)), 'the fixture: a place the wall hides from the spot, not from the middle');
  for (const d of circleStands(origin, three, wall)) assert.ok(fine(origin, d), `(${d.x.toFixed(2)}, ${d.z.toFixed(2)}): seen from the spot`);
});

function makeTown(minute) {
  const { nav, buildings, doors } = synthTown();
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

test('LW-STAND the pause: a resident in view whose next walk is not searched yet stands where they are, idle - never walking on the spot into whatever they face - and the pause\'s minutes are owed as the politeness gate\'s are: the walk searched, they walk it on from where they stood, never cut straight across to where its clock had got to (mutants: the stride kept; the pause unowed)', () => {
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
      if (!p.armed) assert.equal(out.record, p.guard ? PERSON_GUARD_IDLE_RECORD : PERSON_IDLE_RECORD, 'the idle picture (the watch\'s own)');
      assert.deepEqual([p.pos[0], p.pos[2]], at.get(p), 'where they were');
      assert.ok(Math.abs(read - began.get(p)) < 1e-6, `${p.living.res.id}: the walk's clock held while it waits (${(read - began.get(p)).toFixed(3)} min on)`);
    }
  }
  assert.ok(began.size > 0, `some in view wait on a walk (${began.size}) - else this pins nothing`);
  // searched: the walk read from the minute the pause began (the pause owed), the body walks on from there
  delete t.town._line;
  frame();
  let resumed = 0;
  for (const [p, t0] of began) {
    if (!p.living) continue;
    const lag = t.town._lag.get(p.living.res.id) ?? 0;
    const w = t.town.where(p.living.res, t.clock.t - lag, false);
    if (!w || w.pending || !w.moving) continue;
    resumed++;
    assert.ok(Math.abs(t.clock.t - lag - t0) <= dt * RATE + 1e-6, `${p.living.res.id}: walked on from the minute it paused (${(t.clock.t - lag - t0).toFixed(3)} min on, ${(3 * RATE).toFixed(2)} paused)`);
  }
  assert.ok(resumed > 0, `some walk on once searched (${resumed})`);
  let onward = 0;
  for (let i = 0; i < 60; i++) frame();
  for (const p of began.keys()) if (p.living && p.moving) onward++;
  assert.ok(onward > 0, `and walk (${onward})`);
});

test('LW-STAND the way to a stand: a body walks to its stand over the street - straight when the way is open, by its spot when it is not (a new round\'s place round a building\'s corner from the last): every frame on the street, and at the stand (mutants: the straight way unread)', () => {
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
    const on = (x, z) => { const cx = Math.floor(x / NAV_CELL), cy = Math.floor(z / NAV_CELL); return cx >= 0 && cy >= 0 && cx < nav.width && cy < nav.height && town.places.net[cy * nav.width + cx] === town.places.netId; };
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
