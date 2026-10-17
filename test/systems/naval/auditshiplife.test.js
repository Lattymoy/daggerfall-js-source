// AUDIT SHIP-LIFE (2026-09-30, the pre-merge audit of PR #478, Mac: "let's audit everything before we merge") - the
// ship-life lens's findings, each pinned on the coast it was found on (systems/naval/shipLife.js).
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findHarbour, createWaterGrid, errandFor, stepErrand, DETOUR_GIVEUP } from '../../../src/systems/naval/shipLife.js';
import { createSeaShip, stepCaptain, WIND_RATED } from '../../../src/systems/naval/navalAI.js';

const coast = (x, z) => !(z > 200 || (x > 300 && x < 400 && z > -300));
const TOWN = { minX: -100, maxX: 100, minZ: 220, maxZ: 420 };
const legsWet = (P, w, closed = false) => {
  for (let i = 0; i < P.length - (closed ? 0 : 1); i++) {
    const a = P[i], b = P[(i + 1) % P.length];
    for (let t = 0; t <= 1; t += 0.01) if (!w(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) return false;
  }
  return true;
};

test('AUDIT SHIP-LIFE A1: A HULK ACROSS A BERTHING\'S LAST LEG - the stall counts whatever sail she carries (the berthing\'s shortened sail hid it), and past DETOUR_GIVEUP detours she takes another free berth; before, pinned there for good (mutants: the stall on sail, the give-up gone)', () => {
  const harbour = findHarbour({ rect: TOWN, isWater: coast });
  const grids = new Map();
  const grid = (h) => grids.get(h) ?? (grids.set(h, createWaterGrid({ isWater: coast, hull: h })), grids.get(h));
  const life = { harbour: (k) => (k === 'port' ? harbour : null), grid, free: () => true, harbours: () => [{ key: 'port', harbour, free: () => true }] };
  for (const DIST of [40, 90]) {
    const b = harbour.berths[0];
    const ship = createSeaShip({ id: 's', seed: 5, classId: 'navyCutter', pos: [b.approach[0] - 320, 0, b.approach[1] - 80], yaw: Math.PI / 2 });
    ship.errand = { kind: 'arrive', harbour: 'port', berth: 0, path: null, i: 0 };
    const world = { now: 0, dt: 0.1, seaY: 0, wind: [0, 0, WIND_RATED], isWater: coast, contacts: [], random: () => 0.5, life };
    stepCaptain(ship, world);
    const P = ship.errand.path, last = P[P.length - 2], d = Math.hypot(b.pos[0] - last[0], b.pos[1] - last[1]);
    const hp = [b.pos[0] + (last[0] - b.pos[0]) / d * DIST, 0, b.pos[1] + (last[1] - b.pos[1]) / d * DIST];
    let moored = null;
    for (let t = 0; t < 900 && moored == null; t += 0.1) {
      world.now = t;
      const was = [...ship.pos];
      stepCaptain(ship, world);
      if (Math.hypot(ship.pos[0] - hp[0], ship.pos[2] - hp[2]) < 30) { ship.pos[0] = was[0]; ship.pos[2] = was[2]; ship.speed = 0; }   // the hulk: she cannot pass it
      if (ship.errand?.kind === 'moored') moored = ship.errand.berth;
    }
    assert.ok(moored != null && moored !== 0, `hulk ${DIST} m short of berth 0: moored at another (${moored})`);
  }
  assert.equal(DETOUR_GIVEUP, 3);
});

test('AUDIT SHIP-LIFE A2: NO WAY THROUGH THE WATER GIVES THE ERRAND UP - a voyage round a headland the grid cannot plan leaves her to her own cruise; before, a straight line over the land sailed at the shore for good (mutants: the line kept)', () => {
  const w = (x, z) => !(x > -100 && x < 100 && z > -1000);
  const harbour = { berths: [], mouth: [600, 1000] };
  const g = createWaterGrid({ isWater: w, hull: 2 });
  assert.equal(g.path([-600, 1000], [600, 1000]), null, 'the headland is past the grid\'s reach');
  const life = { harbour: () => harbour, grid: () => g, free: () => true, harbours: () => [] };
  const ship = { pos: [-600, 0, 1000], speed: 5, sails: 1, yaw: 0, hull: 2, clock: 0, seed: 5, errand: { kind: 'voyage', harbour: 'x', to: null, path: null, i: 0 } };
  assert.equal(stepErrand(ship, 0.1, life), null);
  assert.equal(ship.errand, null, 'given up');
});

test('AUDIT SHIP-LIFE A3: A WAY\'S FIRST AND LAST LEGS ARE WATER - the grid\'s nearest open cell is one the water joins to the point (a creek beside a spit); before, the leg to it crossed the spit, and a berthing leg sails with no swing off the shore (mutants: the cell taken across the land)', () => {
  // a creek too narrow for the grid: no way (her own cruise) rather than one across the spit
  const w = (x, z) => z >= 0 || x < 95 || (x > 105 && x < 125) || x > 600;
  const g = createWaterGrid({ isWater: w, hull: 2 });
  for (const [from, to] of [[[115, -400], [-300, -400]], [[-300, -400], [115, -400]]]) {
    const p = g.path(from, to);
    assert.ok(!p || legsWet(p, w), `no way, or every leg water: ${JSON.stringify(p)}`);
  }
  // a creek the grid sails: the way out of it by the water, round the spit's end
  const wide = (x, z) => z >= 0 || x < 95 || (x > 105 && x < 175) || x > 600;
  const gw = createWaterGrid({ isWater: wide, hull: 2 });
  for (const [from, to] of [[[140, -400], [-300, -400]], [[-300, -400], [140, -400]]]) {
    const p = gw.path(from, to);
    assert.ok(p, 'a way');
    // the legs to and from the grid (a waypoint's corner is the straightening's own, LEG_END_M)
    assert.ok(legsWet(p.slice(0, 2), wide) && legsWet(p.slice(-2), wide), `the first and last legs water: ${JSON.stringify(p)}`);
  }
});

test('AUDIT SHIP-LIFE A4: A PIRATE LURKS AND A NAVY PATROLS ON THE WATER - the lurking place a bearing the water from the mouth reaches, the rings\' points and chords water (a chord the land lies across goes by the hub); before, 78 of 200 lurking places and half the rings over the land (mutants: the place unchecked, a ring point unchecked, the chord unrouted)', () => {
  const harbour = findHarbour({ rect: TOWN, isWater: coast });
  const g = createWaterGrid({ isWater: coast, hull: 2 });
  const hs = [{ key: 'p', harbour, free: () => true }];
  let land = 0;
  for (let s = 1; s <= 200; s++) { const e = errandFor({ seed: s, faction: 'pirate', hull: 2, pos: [600, 0, -600], harbours: hs, clear: g.clear }); if (!coast(e.at[0], e.at[1])) land++; }
  assert.equal(land, 0, 'no lurking place on the land');
  const ctx = { harbour: () => harbour, grid: () => g, free: () => true, harbours: () => [] };
  for (const kind of ['patrol', 'lurk']) {
    let bad = 0;
    for (let k = 0; k < 100; k++) {
      const errand = kind === 'patrol' ? { kind, harbour: 'p', since: 0, path: null, i: 0, spin: k / 100 } : errandFor({ seed: k + 1, faction: 'pirate', hull: 2, pos: [600, 0, -600], harbours: hs, clear: g.clear });
      const ship = { pos: [harbour.mouth[0], 0, harbour.mouth[1]], speed: 5, sails: 1, yaw: 0, hull: 2, clock: 0, seed: k, errand };
      stepErrand(ship, 0.1, ctx);
      if (!legsWet(ship.errand.path, coast, true)) bad++;
    }
    assert.equal(bad, 0, `${kind}: no ring over the land`);
  }
  // an island on a chord between two points the mouth reaches: that chord goes by the mouth
  const a = Math.PI / 5, isle = [Math.sin(a) * 364, Math.cos(a) * 364];
  const sea = (x, z) => Math.hypot(x - isle[0], z - isle[1]) > 60;
  const gs = createWaterGrid({ isWater: sea, hull: 2 });
  const port = { berths: [], mouth: [0, 0] };
  const ship = { pos: [0, 0, 0], speed: 5, sails: 1, yaw: 0, hull: 2, clock: 0, seed: 1, errand: { kind: 'patrol', harbour: 'p', since: 0, path: null, i: 0, spin: 0 } };
  stepErrand(ship, 0.1, { harbour: () => port, grid: () => gs, free: () => true, harbours: () => [] });
  assert.ok(legsWet(ship.errand.path, sea, true), `round the island: ${JSON.stringify(ship.errand.path.map((q) => q.map(Math.round)))}`);
  assert.ok(ship.errand.path.some((q) => q[0] === 0 && q[1] === 0), 'by the mouth');
});

test('AUDIT SHIP-LIFE A5: A TOWN ON AN ISTHMUS KEEPS ITS HARBOUR - shores facing apart cancel the berths\' mean normal, so the mouth lies off the nearest berth, and every berth kept reaches it through the water; before, berths on both shores with a mouth half of them could not reach, or no harbour at all (mutants: the mean kept, the reach unchecked)', () => {
  const w = (x, z) => !((x > -150 && x < 150) || (z > 300 && x > -400 && x < 400));
  const h = findHarbour({ rect: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }, isWater: w });
  assert.ok(h, 'a harbour');
  const g = createWaterGrid({ isWater: w, hull: 2 });
  for (const b of h.berths) assert.ok(g.path(b.approach, h.mouth), `berth ${b.pos} reaches the mouth`);
  const side = Math.sign(h.berths[0].pos[0]);
  assert.ok(h.berths.every((b) => Math.sign(b.pos[0]) === side), 'one shore\'s berths');
  // the symmetric strait: the mean is nought - the nearest berth's own normal still finds a mouth
  const strait = (x, z) => !(x > -150 && x < 150);
  assert.ok(findHarbour({ rect: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }, isWater: strait }), 'a harbour on the symmetric strait too');
});
