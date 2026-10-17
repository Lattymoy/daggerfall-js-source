// SHIP-LIFE (2026-09-30, Mac's item 1 of the six-part sea ask: ships that berth at ports, depart, voyage and keep their
// own errands; `01-Overview/handoffs/Handoff-Naval-Crew-and-Ship-Life.md` slice E) - systems/naval/shipLife.js driven directly on
// a coast of its own (a shore along z = 200 with a town behind it, a headland to the east reaching 500 m out), the
// real captains (navalAI.js stepCaptain) sailing its errands, and the real naval host over Come Sail Away's pool
// (test/navalSea.mjs) and in a room (test/navalRoom.mjs) standing a port's harbour.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  findHarbour, createWaterGrid, errandFor, stepErrand, footprintClear, hullSize, offsetErrand, alongside,
  HARBOUR_REACH, BERTH_SPACING, BERTH_HULL, MOUTH_CLEAR, PATH_NODES, DWELL_S, BERTH_SNAP_M, STALL_S, VOYAGE_DIST, LURK_R, PATROL_R,
} from '../../../src/systems/naval/shipLife.js';
import { createSeaShip, stepCaptain, WIND_RATED } from '../../../src/systems/naval/navalAI.js';
import { SHIP_STATES } from '../../../src/systems/naval/navalDamage.js';
import { HARBOUR_ROLL, HARBOUR_LEAVE, OWNER_SWEEP_S, SHIP_FADE_S } from '../../../src/scenes/naval/navalHost.js';
import { DENSITY } from '../../../src/systems/naval/navalDirector.js';
import { sea } from '../../navalSea.mjs';
import { room } from '../../navalRoom.mjs';

const WORLD = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
/** The coast: land north of z = 200, and a headland x 300-400 reaching south to z = -300. */
const coast = (x, z) => !(z > 200 || (x > 300 && x < 400 && z > -300));
const TOWN = { minX: -100, maxX: 100, minZ: 220, maxZ: 420 };
const PORT = { key: 'port:1', rect: TOWN };
const DEG = Math.PI / 180;
const wrapD = (a) => Math.abs(((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
/** The captains' door to the errands over the coast: one harbour, the grids, every berth free unless `taken`. */
function lifeOn(harbour, taken = new Set(), isWater = coast) {
  const grids = new Map();
  const grid = (h) => grids.get(h) ?? (grids.set(h, createWaterGrid({ isWater, hull: h })), grids.get(h));
  return { harbour: (k) => (k === 'port' ? harbour : null), grid, free: (_k, i) => !taken.has(i), harbours: () => [{ key: 'port', harbour, free: (i) => !taken.has(i) }] };
}
const worldOf = (life, o = {}) => ({ now: 0, dt: 0.1, seaY: 0, wind: [0, 0, WIND_RATED], isWater: (x, z) => coast(x, z), contacts: [], random: () => 0.5, life, ...o });

test('SHIP-LIFE THE HARBOUR OFF THE TERRAIN: a port town\'s berths are found along its shore - each her whole footprint in the water, lying parallel to the shore, a length and a quarter from the next, within HARBOUR_REACH of the town, the nearest the town first, with open water astern to come in by; the mouth has MOUTH_CLEAR of open water all round; a town with no shore, or a harbour with no way out, has none', () => {
  const h = findHarbour({ rect: TOWN, isWater: coast });
  assert.ok(h && h.berths.length >= 3, `berths: ${h?.berths.length}`);
  const { length } = hullSize(BERTH_HULL);
  const cx = 0, cz = 320;
  let last = -Infinity;
  for (const b of h.berths) {
    assert.ok(footprintClear(b.pos, b.yaw, BERTH_HULL, coast), `the berth at ${b.pos} floats her whole`);
    assert.ok(footprintClear(b.approach, b.yaw, BERTH_HULL, coast), 'her approach astern of it too');
    const along = wrapD(b.yaw - Math.atan2(b.normal[0], b.normal[1]));
    assert.ok(Math.abs(along - Math.PI / 2) < 1 * DEG, `parallel to the shore (${(along / DEG).toFixed(1)} deg off its normal)`);
    assert.ok(b.pos[1] < 200 && b.pos[1] > 200 - HARBOUR_REACH, 'off the town\'s shore');
    const d = Math.hypot(b.pos[0] - cx, b.pos[1] - cz);
    assert.ok(d >= last - 1e-9, 'the nearest the town first');
    last = d;
    for (const o of h.berths) if (o !== b) assert.ok(Math.hypot(o.pos[0] - b.pos[0], o.pos[1] - b.pos[1]) >= length * BERTH_SPACING - 1e-6, 'spaced');
  }
  for (let k = 0; k < 24; k++) { const a = (k / 24) * 2 * Math.PI; assert.ok(coast(h.mouth[0] + Math.sin(a) * MOUTH_CLEAR, h.mouth[1] + Math.cos(a) * MOUTH_CLEAR), 'the mouth open all round'); }
  // no shore: a town in the middle of the land
  assert.equal(findHarbour({ rect: { minX: -100, maxX: 100, minZ: 900, maxZ: 1100 }, isWater: coast }), null);
  // a shore only past HARBOUR_REACH of the town - off its corner, within the scan's square but not its reach
  const far = (x, z) => (x - TOWN.maxX) + (TOWN.minZ - z) > 450 * Math.SQRT2;   // a diagonal shore 450 m off the town's corner, open sea beyond
  assert.equal(findHarbour({ rect: TOWN, isWater: far }), null, 'no berth past HARBOUR_REACH');
  // a pond by the town, with no open water anywhere: berths, but no mouth - no harbour
  const pond = (x, z) => Math.hypot(x, z - 150) < 70;
  assert.equal(findHarbour({ rect: TOWN, isWater: pond }), null);
});

test('SHIP-LIFE A WAY THROUGH THE WATER: round the headland the grid finds a way - from where she is to where she goes, every leg in the water with the margin the captains\' lookout keeps, nowhere over land; a goal the water never reaches is no way, found within PATH_NODES', () => {
  const g = createWaterGrid({ isWater: coast, hull: 2 });
  const from = [600, -100], to = [100, -100];
  const p = g.path(from, to);
  assert.ok(p && p.length >= 3, 'a way with corners - the straight line crosses the headland');
  assert.deepEqual(p[0], from); assert.deepEqual(p[p.length - 1], to);
  for (let i = 0; i < p.length - 1; i++) {
    assert.ok(g.clear(p[i], p[i + 1]), `leg ${i} clear`);
    for (let t = 0; t <= 1; t += 0.01) assert.ok(coast(p[i][0] + (p[i + 1][0] - p[i][0]) * t, p[i][1] + (p[i + 1][1] - p[i][1]) * t), 'never over land');
  }
  assert.ok(Math.min(...p.map((q) => q[1])) < -300, 'round the headland\'s end');
  // a lake inland: no way to it
  const lake = (x, z) => coast(x, z) || Math.hypot(x, z - 800) < 60;
  const gl = createWaterGrid({ isWater: lake, hull: 2 });
  assert.equal(gl.path([0, 0], [0, 800]), null);
  assert.ok(gl.expansions <= PATH_NODES + 1, `bounded: ${gl.expansions}`);
});

test('SHIP-LIFE THE ERRAND DRAWN AGAIN: off her seed and where she is - a ship lying still at a berth is moored there; a merchantman makes for a free berth, never a taken one; a navy patrols the harbour\'s approaches; a pirate lurks LURK_R off its mouth; with no harbour near, a merchantman sails out of the world over open water and a pirate keeps her own cruise; any client draws the same', () => {
  const harbour = findHarbour({ rect: TOWN, isWater: coast });
  const hs = (taken = new Set()) => [{ key: 'port', harbour, free: (i) => !taken.has(i) }];
  const b1 = harbour.berths[1];
  const moored = errandFor({ seed: 9, faction: 'merchant', hull: 2, pos: [b1.pos[0] + 3, 0, b1.pos[1]], speed: 0, clock: 50, harbours: hs() });
  assert.equal(moored.kind, 'moored'); assert.equal(moored.berth, 1);
  assert.ok(moored.until >= 50 + DWELL_S[0] && moored.until <= 50 + DWELL_S[1], 'her dwell off her stream');
  const arrive = errandFor({ seed: 9, faction: 'merchant', hull: 2, pos: [600, 0, -600], harbours: hs(new Set([0, 1])) });
  assert.equal(arrive.kind, 'arrive'); assert.equal(arrive.berth, 2, 'the first free berth');
  assert.deepEqual(errandFor({ seed: 9, faction: 'merchant', hull: 2, pos: [600, 0, -600], harbours: hs(new Set([0, 1])) }), arrive, 'drawn the same again');
  const patrol = errandFor({ seed: 9, faction: 'navy', hull: 2, pos: [600, 0, -600], clock: 7, harbours: hs() });
  assert.equal(patrol.kind, 'patrol'); assert.equal(patrol.since, 7);
  const lurk = errandFor({ seed: 9, faction: 'pirate', hull: 2, pos: [600, 0, -600], harbours: hs() });
  assert.equal(lurk.kind, 'lurk');
  assert.ok(Math.abs(Math.hypot(lurk.at[0] - harbour.mouth[0], lurk.at[1] - harbour.mouth[1]) - LURK_R) < 1e-6);
  const g = createWaterGrid({ isWater: coast, hull: 2 });
  const out = errandFor({ seed: 9, faction: 'merchant', hull: 2, pos: [0, 0, 150], harbours: [], clear: g.clear });
  assert.equal(out.kind, 'voyage'); assert.equal(out.harbour, null);
  assert.ok(Math.abs(Math.hypot(out.to[0], out.to[1] - 150) - VOYAGE_DIST) < 1e-6);
  const dir = [(out.to[0]) / VOYAGE_DIST, (out.to[1] - 150) / VOYAGE_DIST];
  assert.ok(g.clear([0, 150], [dir[0] * 800, 150 + dir[1] * 800]), 'out over open water, never inland');
  for (let seed = 1; seed <= 20; seed++) {   // half of every bearing from under the shore is inland
    const v = errandFor({ seed, faction: 'merchant', hull: 2, pos: [0, 0, 150], harbours: [], clear: g.clear });
    const u = [(v.to[0]) / VOYAGE_DIST, (v.to[1] - 150) / VOYAGE_DIST];
    assert.ok(g.clear([0, 150], [u[0] * 800, 150 + u[1] * 800]), `seed ${seed}: out over open water`);
  }
  assert.equal(errandFor({ seed: 9, faction: 'pirate', hull: 2, pos: [0, 0, 150], harbours: [] }), null, 'her own cruise');
});

test('SHIP-LIFE THE LIFE OF A MERCHANTMAN, by the real captains: in from the sea to a free berth - a galleon and a carrack round the headland, a coaster warped out of its lee on her sweeps - she moors alongside it, her way off and her sails stowed, and lies still through her dwell; then she departs, clears the harbour\'s mouth and sails out of the world; never a stride over land', () => {
  const harbour = findHarbour({ rect: TOWN, isWater: coast });
  for (const [cls, start, seed] of [['merchantGalleon', [600, 0, -400], 7], ['merchantCarrack', [-500, 0, -500], 11], ['merchantCoaster', [800, 0, 100], 13]]) {
    const life = lifeOn(harbour);
    const ship = createSeaShip({ id: 's', seed, classId: cls, pos: start, yaw: 0 });
    ship.errand = errandFor({ seed, faction: 'merchant', hull: ship.hull, pos: ship.pos, harbours: life.harbours() });
    assert.equal(ship.errand.kind, 'arrive');
    const berth = harbour.berths[ship.errand.berth];
    const world = worldOf(life);
    const seen = [];
    let at = null, held = null;
    for (let t = 0; t < 2400; t += 0.1) {
      world.now = t; stepCaptain(ship, world);
      assert.ok(coast(ship.pos[0], ship.pos[2]), `${cls} over land at ${ship.pos}`);
      const k = ship.errand?.kind;
      if (seen[seen.length - 1] !== k) seen.push(k);
      if (k === 'moored' && at == null) at = t;
      if (k === 'moored' && at != null && t - at > 60 && !held) held = { pos: [...ship.pos], yaw: ship.yaw, t };   // eased on over MOOR_EASE_S
      if (k === 'moored' && held && t - held.t > 30 && t - held.t < 31) {
        // PIN MOVED (QUAYS): alongside its quay for her own hull (shipLife.js alongside) - a coaster lies in by the
        // Carrack's beam less hers, where the berth's own point left her six metres off the quay's face
        const quayside = alongside(berth, ship.hull, harbour.hull);
        assert.ok(Math.hypot(ship.pos[0] - quayside[0], ship.pos[2] - quayside[1]) < 1, `${cls} alongside her berth`);
        assert.ok(wrapD(ship.yaw - berth.yaw) < 2 * DEG, 'lying along it');
        assert.ok(ship.speed === 0 && ship.sails < 0.05, 'her way off, her sails stowed');
        assert.ok(Math.hypot(ship.pos[0] - held.pos[0], ship.pos[2] - held.pos[2]) < 0.01, 'still');
      }
      if (k === 'voyage') break;
    }
    assert.deepEqual(seen, ['arrive', 'moored', 'depart', 'voyage'], `${cls}: ${seen}`);
    assert.ok(Math.hypot(ship.pos[0] - harbour.mouth[0], ship.pos[2] - harbour.mouth[1]) < 60, 'out through the mouth');
  }
});

test('SHIP-LIFE A FIGHT COMES FIRST: a navy cutter moored at her berth answers a pirate in sight and a merchantman moored runs from one - her berth left behind; the fight over, she makes for her berth again and moors there', () => {
  const harbour = findHarbour({ rect: TOWN, isWater: coast });
  for (const [cls, faction] of [['navyCutter', 'navy'], ['merchantGalleon', 'merchant']]) {
    const life = lifeOn(harbour);
    const b = harbour.berths[0];
    const ship = createSeaShip({ id: 's', seed: 5, classId: cls, pos: [b.pos[0], 0, b.pos[1]], yaw: b.yaw });
    ship.errand = errandFor({ seed: 5, faction, hull: ship.hull, pos: ship.pos, harbours: life.harbours() });
    ship.sails = 0;
    assert.equal(ship.errand.kind, 'moored');
    const pirate = createSeaShip({ id: 'p', seed: 3, classId: 'pirateBrig', pos: [b.pos[0] + 60, 0, b.pos[1] - 260], yaw: 0, temper: 'bold' });
    const contact = () => ({ id: 'p', kind: 'ship', faction: 'pirate', pos: pirate.pos, vel: [0, 0, 0], speed: 0, yaw: pirate.yaw, hull: pirate.hull, ship: pirate });
    const world = worldOf(life);
    let fought = false;
    for (let t = 0; t < 60; t += 0.1) {
      world.now = t; world.contacts = [contact()];
      stepCaptain(ship, world);
      if (ship.mode === 'engage' || ship.mode === 'flee') fought = true;
    }
    assert.ok(fought, `${cls} takes the fight up (${ship.mode})`);
    assert.ok(Math.hypot(ship.pos[0] - b.pos[0], ship.pos[2] - b.pos[1]) > BERTH_SNAP_M * 2, 'her berth left behind');
    world.contacts = [];
    let back = false, sailedBack = false;
    for (let t = 60; t < 1500 && !back; t += 0.1) {
      world.now = t; stepCaptain(ship, world);
      if (ship.errand?.kind === 'arrive' && ship.speed > 1) sailedBack = true;
      const quayside = alongside(b, ship.hull, harbour.hull);   // PIN MOVED (QUAYS): alongside its quay for her hull
      back = ship.errand?.kind === 'moored' && Math.hypot(ship.pos[0] - quayside[0], ship.pos[2] - quayside[1]) < 2;
    }
    assert.ok(sailedBack, 'she sails back to it - never slid across the water');
    assert.ok(back, `${cls} moored again (${ship.errand?.kind} at ${ship.pos.map((v) => v.toFixed(0))})`);
  }
  // a way the fight took her off is planned anew from where it left her
  const life = lifeOn(harbour);
  const ship = createSeaShip({ id: 's', seed: 5, classId: 'navyCutter', pos: [-300, 0, -200], yaw: 0 });
  ship.mode = 'engage';   // the step after her fight
  ship.errand = { kind: 'arrive', harbour: 'port', berth: 0, path: [[9e3, 9e3], [9e3, 9e3]], i: 0 };   // planned before it
  stepCaptain(ship, worldOf(life));
  assert.ok(Math.hypot(ship.errand.path[0][0] - ship.pos[0], ship.errand.path[0][1] - ship.pos[2]) < 5, 'her way planned anew from where she is');
});

test('SHIP-LIFE A STALL: a ship coming in whose way a struck hulk lies across - pressed against it, no way on - takes a detour abeam after STALL_S and moors all the same (was: she lay against the hulk for good)', () => {
  const harbour = findHarbour({ rect: TOWN, isWater: coast });
  const life = lifeOn(harbour);
  const b = harbour.berths[0];
  const ship = createSeaShip({ id: 's', seed: 5, classId: 'navyCutter', pos: [b.approach[0] - 320, 0, b.approach[1] - 80], yaw: 90 * DEG });
  ship.errand = { kind: 'arrive', harbour: 'port', berth: 0, path: null, i: 0 };
  const world = worldOf(life);
  // her first leg, planned: a struck hulk laid across it 60 m on
  stepCaptain(ship, world);
  const next = ship.errand.path[1], d = Math.hypot(next[0] - ship.pos[0], next[1] - ship.pos[2]);
  const hulk = createSeaShip({ id: 'h', seed: 4, classId: 'merchantGalleon', pos: [ship.pos[0] + (next[0] - ship.pos[0]) / d * 60, 0, ship.pos[2] + (next[1] - ship.pos[2]) / d * 60], yaw: Math.atan2(next[0] - ship.pos[0], next[1] - ship.pos[2]) + Math.PI / 2 });
  hulk.damage.apply({ hull: Math.ceil(hulk.damage.maxHull * 0.8), sail: 0, crew: 0 });
  assert.equal(hulk.damage.state, SHIP_STATES.struck);
  const hc = { id: 'h', kind: 'ship', faction: 'merchant', pos: hulk.pos, vel: [0, 0, 0], speed: 0, yaw: hulk.yaw, hull: hulk.hull, ship: hulk, struck: true };
  let detoured = false, moored = false, prev = null, sameSide = 0;
  for (let t = 0; t < 1500 && !moored; t += 0.1) {
    world.now = t; world.contacts = [hc];
    // the hulk holds her: no way through it (the host's separateHulls)
    const was = [...ship.pos];
    stepCaptain(ship, world);
    const hd = Math.hypot(ship.pos[0] - hulk.pos[0], ship.pos[2] - hulk.pos[2]);
    if (hd < 30) { ship.pos[0] = was[0]; ship.pos[2] = was[2]; ship.speed = 0; }
    const det = ship.errand?.detour ?? null;
    if (det) detoured = true;
    // a detour that held her gives way to one on the other side. PIN MOVED (AUDIT GALLEON T2): the new galleon's first
    // detour clears this hulk, so none holds her here - the law, and the arrival's shortened sail, are pinned on their own
    // in auditgalleon_sea.test.js
    if (prev && det && det !== prev.det && prev.det) { if (ship.errand.side === prev.side) sameSide++; }
    prev = det ? { det, side: ship.errand.side } : prev && !det ? null : prev;
    moored = ship.errand?.kind === 'moored';
  }
  assert.ok(detoured, `a detour taken after ${STALL_S} s`);
  assert.equal(sameSide, 0, 'a detour that held her is followed by one on the other side');
  assert.ok(moored, `and moored (${ship.errand?.kind} at ${ship.pos.map((v) => v.toFixed(0))})`);
});

test('SHIP-LIFE THE HARBOUR ROLL, by the real host: ashore in a port town, its harbour is found and HARBOUR_ROLL of its berths hold ships moored, sails stowed and lying still - the port\'s and the day\'s, the same on another client; the sea\'s density never counts them; past HARBOUR_LEAVE they go, and back they stand again the same; one that sailed today is not stood at her berth again', async () => {
  const stand = async (feet = [0, 0, 300]) => {
    const h = await sea({ hull: null, water: coast, settings: { ShipsAtSea: 'few' } });
    h.view.feet = feet;
    h.deps.harbourNear = () => PORT;
    return h;
  };
  const h = await stand();
  h.run(1);
  const moored = () => [...h.host._sea.values()].filter((e) => e.ship.errand?.kind === 'moored');
  const m = moored();
  assert.ok(m.length >= HARBOUR_ROLL[0] && m.length <= HARBOUR_ROLL[1], `moored: ${m.length}`);
  const harbour = findHarbour({ rect: TOWN, isWater: coast });
  for (const e of m) {
    const b = alongside(harbour.berths[e.ship.errand.berth], e.ship.hull, harbour.hull);   // PIN MOVED (QUAYS): stood alongside its quay for her hull
    assert.ok(Math.hypot(e.ship.pos[0] - b[0], e.ship.pos[2] - b[1]) < 0.5 && e.ship.sails === 0, 'at her berth, sails stowed');
    assert.notEqual(e.ship.hull, 3, 'no galley moors');
  }
  const key = (hh) => [...hh.host._sea.values()].map((e) => `${e.ship.seed}:${e.ship.cls.id}:${e.ship.errand?.berth}`).sort().join('|');
  const other = await stand();
  other.run(1);
  assert.equal(key(other), key(h), 'another client in the port stands the same ships at the same berths');
  // the sea's density: a player on the water off the port still meets the director's own
  const w = await sea({ hull: 2, water: coast, settings: { ShipsAtSea: 'few' } });
  w.boat.GameObject.position = [0, 0, -150]; w.view.feet = [0, 0, -150];
  w.deps.harbourNear = () => PORT;
  w.run(200);
  const open = [...w.host._sea.values()].filter((e) => e.ship.errand?.kind !== 'moored' && e.ship.damage.state === SHIP_STATES.afloat);
  assert.ok(open.length >= 1 && open.length <= DENSITY.few + 1, `the sea's traffic beside the harbour's: ${open.length}`);
  // far off and back
  const seeds = key(h);
  h.view.feet = [0, 0, 300 + HARBOUR_LEAVE + 800];
  h.run(1 + SHIP_FADE_S);   // SHIP-FADE (2026-10-02) PIN MOVED: they fade as they go
  assert.equal(moored().length, 0, 'gone once the port is far');
  h.view.feet = [0, 0, 300];
  h.run(1);
  assert.equal(key(h), seeds, 'stood again the same');
  // one sails: not stood again today
  const first = moored()[0];
  first.ship.errand.until = 0;
  h.run(2);
  assert.notEqual(first.ship.errand?.kind, 'moored', 'she sails');
  h.run(1);
  h.view.feet = [0, 0, 300 + HARBOUR_LEAVE + 800];
  h.run(1);
  for (const e of [...h.host._sea.values()]) if (e.ship.seed === first.ship.seed) h.host._sea.delete(e.id);   // she sailed out of the world
  h.view.feet = [0, 0, 300];
  h.run(1);
  assert.ok(!moored().some((e) => e.ship.seed === first.ship.seed), 'not at her berth again the same day');
});

test('SHIP-LIFE THE SEA NEAR A PORT GOES SOMEWHERE: on the water off a port the director\'s ships are given errands - a merchantman arrives, a navy patrols, a pirate lurks - while a hunter and a pair already at it keep their fight; far from any port the traffic keeps its cruise as before', async () => {
  const w = await sea({ hull: 2, water: coast, settings: { ShipsAtSea: 'many' }, level: 9 });
  w.boat.GameObject.position = [0, 0, -150]; w.view.feet = [0, 0, -150];
  w.deps.harbourNear = () => PORT;
  const kinds = new Map();
  for (let t = 0; t < 900; t += 30) {
    w.run(30);
    for (const e of w.host._sea.values()) if (!e.fromHarbour && e.ship.errand && !kinds.has(e.id)) kinds.set(e.id, `${e.ship.cls.faction}:${e.ship.errand.kind}`);
  }
  const seen = new Set(kinds.values());
  assert.ok([...seen].some((k) => k === 'merchant:arrive' || k === 'merchant:moored'), `a merchantman comes in: ${[...seen]}`);
  for (const k of seen) {
    const [faction, kind] = k.split(':');
    assert.ok({ merchant: ['arrive', 'moored', 'depart', 'voyage'], navy: ['patrol', 'voyage', 'arrive', 'moored', 'depart'], pirate: ['lurk'] }[faction].includes(kind), `${k} is her trade's`);
  }
  // no port: the cruise
  const far = await sea({ hull: 2, water: coast, settings: { ShipsAtSea: 'many' } });
  far.boat.GameObject.position = [0, 0, -150]; far.view.feet = [0, 0, -150];
  far.run(400);
  assert.ok(far.host._sea.size > 0);
  for (const e of far.host._sea.values()) assert.equal(e.ship.errand, null, 'her own cruise');
});

test('SHIP-LIFE THE WORLD MOVES: the floating origin\'s shift moves a harbour\'s berths, approaches and mouth, and a ship\'s way, her goal and her detour, by the shift - and the grids are made again in the moved scene', async () => {
  const h = await sea({ hull: null, water: coast, settings: { ShipsAtSea: 'few' } });
  h.view.feet = [0, 0, 300];
  h.deps.harbourNear = () => PORT;
  h.run(1);
  const e = [...h.host._sea.values()].find((x) => x.ship.errand?.kind === 'moored');
  const berthBefore = [...h.host._sea.values()].map((x) => x.ship.pos.slice());
  e.ship.errand = { kind: 'voyage', harbour: null, to: [5000, 100], path: [[1, 2], [3, 4]], i: 0, detour: [7, 8] };
  h.host.offsetAll([100, 0, -50]);
  assert.deepEqual(e.ship.errand.to, [5100, 50]);
  assert.deepEqual(e.ship.errand.path, [[101, -48], [103, -46]]);
  assert.deepEqual(e.ship.errand.detour, [107, -42]);
  // a moored sister lies still where the shift put her: her berth moved with her
  const sister = [...h.host._sea.values()].find((x) => x !== e && x.ship.errand?.kind === 'moored');
  const before = sister.ship.pos.slice();
  h.run(5);
  assert.ok(Math.hypot(sister.ship.pos[0] - before[0], sister.ship.pos[2] - before[2]) < 0.01, 'her berth moved with the world - she holds where she lies');
  assert.ok(berthBefore.length > 1);
  // the pure door, as the host calls it
  const x = { to: [0, 0], at: [1, 1], path: [[2, 2]], detour: null };
  offsetErrand(x, [10, 0, 20]);
  assert.deepEqual(x, { to: [10, 20], at: [11, 21], path: [[12, 22]], detour: null });
});

test('SHIP-LIFE A SHIP TAKEN OVER: her errand never rides the word - the heir who takes a departed stander\'s moored ship draws it again where she lies, moored at the same berth; and stands no twin of her at it', async () => {
  const r = await room([{ id: 'a', hull: null, water: coast }, { id: 'b', hull: null, water: coast }]);
  const A = r.get('a'), B = r.get('b');
  for (const c of [A, B]) { c.s.view.feet = [0, 0, 300]; c.s.deps.harbourNear = () => PORT; }
  for (let t = 0; t < 3; t += 1 / 30) {   // b never stands one of her own, not for a frame, while a stands
    r.tick(1 / 30);
    assert.equal([...B.s.host._sea.values()].filter((e) => !e.owner).length, 0, `b stood her own at ${t.toFixed(2)} s`);
  }
  const mine = [...A.s.host._sea.values()].filter((e) => e.ship.errand?.kind === 'moored');
  assert.ok(mine.length >= HARBOUR_ROLL[0], 'a stands the harbour');
  const onB = () => [...B.s.host._sea.values()];
  assert.equal(onB().filter((e) => !e.owner).length, 0, 'b stands none of her own while a stands');
  A.present = false;
  r.run(OWNER_SWEEP_S + 1);
  const adopted = onB().filter((e) => !e.owner);
  assert.equal(adopted.length, mine.length, 'b took every one over');
  for (const e of adopted) {
    const was = mine.find((x) => x.ship.seed === e.ship.seed);
    assert.equal(e.ship.errand?.kind, 'moored', 'moored still');
    assert.equal(e.ship.errand.berth, was.ship.errand.berth, 'at the same berth');
  }
  r.run(2);
  const seeds = onB().map((e) => e.ship.seed);
  assert.equal(new Set(seeds).size, seeds.length, 'no twin stood beside her');
});

test('SHIP-LIFE the world\'s wiring by source: the host is handed the port near the player, its footprint in the scene from its native rect through the floating origin, asked once a pixel', () => {
  assert.match(WORLD, /harbourNear: navalHarbourNear,/);
  assert.match(WORLD, /const r = locationWorldRect\(t\.loc, t\.x, t\.y\);\n\s*const \[ax, az\] = state\.localFromWorld\(r\.minX, r\.minZ\), \[bx, bz\] = state\.localFromWorld\(r\.maxX, r\.maxZ\);/);
  assert.match(WORLD, /if \(_navalHarbourAt\?\.key !== key\) \{/);
});
