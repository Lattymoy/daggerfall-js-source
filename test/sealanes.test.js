// SEA-LANES (2026-10-02, Mac: "ships should be more persistant and actively engage with multiple docks and multiple
// pathways around daggerfall") - the sea's traffic was the director's alone: ships stood on a ring about the player and
// were let go out of sight for good; a harbour's errands reached only a port the player had stood by. A ship seen
// leaving a port was never the ship met at the next, and none sailed between two. Now THE BAY'S PACKETS:
//   the lanes   - every port town with open sea by it (its roadstead, within ROADSTEAD_PX) runs packets to its
//                 LANE_NEIGHBOURS nearest such ports within LANE_MAX_PX: the coast a chain of lanes, every port two at
//                 least; a lane's way the water's (an A* over the map's water pixels, no corner cut past land, no longer
//                 than LANE_PATH_PX), straightened where a line holds to the water
//   the packets - a lane's ships sail it out and back for ever on the SHARED CLOCK (out, LANE_DWELL_S at the far port,
//                 home, LANE_DWELL_S at hers), so where each is is the clock's alone: every player meets her in the same
//                 water, and the ship watched out of one port is the one that berths at the next; one a LANE_HEADWAY_S
//                 each way, a merchantman or on LANE_NAVY of them a crown's ship, never a galley; her voyage her cycle
//   the host    - stands a packet under way within LINER_STAND_M (LINERS_MAX by the Ships at sea), one lying in a
//                 harbour it knows at its last open berth, steers each by her lane - out of her berth through the mouth
//                 first, on along her leg from where she is (AUDIT BAY A6), into a berth at her port or lying off it -
//                 lets her go past LINER_DROP_M (she fades, SHIP-FADE) unless she fights, and spends one sunk or taken
//                 for her voyage
//   the world   - hands the host every packet of the lanes about the player each LANE_LIST_MS (AUDIT BAY A19), by the
//                 map's own ports, water and climate, at the shared clock
// The pure law (systems/naval/seaLanes.js) over a coast of its own; the real host (scenes/navalHost.js liners) through
// real frames over Come Sail Away's pool (test/navalSea.mjs); world.js's feed lifted from its source and run. Each is
// red on the record's code (168bf2587). `03-World/Naval-Combat.md` (SEA-LANES).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  roadsteadOf, laneNetwork, lanePixels, straighten, laneWay, laneSeed, packetOf, packetsAt, packetAt,
  ROADSTEAD_PX, LANE_NEIGHBOURS, LANE_MAX_PX, LANE_PATH_PX, LANE_SEARCH, LANE_STRAIGHT_STEPS, LANE_CRUISE, LANE_DWELL_S, LANE_HEADWAY_S, LANE_NAVY, LANE_LEVEL,
} from '../src/systems/naval/seaLanes.js';
import { HULL, classById, classFor } from '../src/systems/naval/navalShips.js';
import { NATIVE_PIXEL, nativeOfPixel, pixelOfNative } from '../src/systems/seaRaiders.js';
import { LINER_STAND_M, LINER_DROP_M, LINERS_MAX, LINER_LOOKAHEAD_M, LINER_PORT_M, SHIP_FADE_S } from '../src/scenes/navalHost.js';
import { DENSITY } from '../src/systems/naval/navalDirector.js';
import { SHIP_STATES } from '../src/systems/naval/navalDamage.js';
import { findHarbour, alongside } from '../src/systems/naval/shipLife.js';
import { hash32 } from '../src/world/spawnedDungeons.js';
import { mulberry32 } from '../src/combat/bloodArt.js';
import { sea } from './navalSea.mjs';

const WORLD = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
const M_PER_NATIVE = 819.2 / NATIVE_PIXEL;

// ── a coast of its own: land north of map row 200 (y < 200), the sea south of it; a jetty of land down x = 120 from
//    the shore to row 215; and a lake inland, its water cut off from the sea ─────────────────────────────────────────
const JETTY = 215;
const lake = (x, y) => x >= 600 && x < 610 && y >= 100 && y < 110;
const water = (x, y) => x >= 0 && y >= 0 && x < 1000 && y < 500 && ((y >= 200 && !(x === 120 && y < JETTY)) || lake(x, y));
const open = (x, y) => water(x, y) && !lake(x, y);
const waterNative = (x, z) => { const p = pixelOfNative(x, z); return water(p.x, p.y); };
/** A port on the shore at map pixel x (row 199, the sea a row south of it). */
const port = (id, x, y = 199, name = `Port ${id}`) => ({ id, name, px: x, py: y });

test('SEA-LANES THE ROADSTEAD: a port\'s roadstead is the nearest pixel of open sea within ROADSTEAD_PX of its town - ring by ring outward, the nearest in a ring - and none for a town with no sea by it, nor a lake\'s', () => {
  assert.deepEqual(roadsteadOf(port(1, 100), open), { x: 100, y: 200 }, 'straight south of the town');
  assert.deepEqual(roadsteadOf(port(1, 121, 199), open), { x: 121, y: 200 });
  assert.deepEqual(roadsteadOf(port(1, 100, 200 - ROADSTEAD_PX), open), { x: 100, y: 200 }, `${ROADSTEAD_PX} rows inland: still`);
  assert.equal(roadsteadOf(port(1, 100, 199 - ROADSTEAD_PX), open), null, 'farther: no port of the sea');
  assert.equal(roadsteadOf(port(1, 605, 105), open), null, 'a lake is no roadstead');
  // ring before distance: the ring-1 corner (d² 2) before a ring-2 pixel straight off (d² 4)
  const corner = (x, y) => (x === 11 && y === 11) || (x === 10 && y === 12);
  assert.deepEqual(roadsteadOf({ id: 1, px: 10, py: 10 }, corner), { x: 11, y: 11 });
  const two = (x, y) => (x === 12 && y === 10) || (x === 12 && y === 11);
  assert.deepEqual(roadsteadOf({ id: 1, px: 10, py: 10 }, two), { x: 12, y: 10 }, 'the nearest of a ring');
});

test('SEA-LANES THE NETWORK: each port with a roadstead runs lanes to its LANE_NEIGHBOURS nearest within LANE_MAX_PX - each pair once, the lower id first, its key theirs - so a coast is a chain; a port too far from any runs none, an inland one none; the same lanes whatever order the ports are read in', () => {
  assert.equal(LANE_NEIGHBOURS, 2);
  const ports = [port(100, 100), port(110, 110), port(111, 112, 199 - ROADSTEAD_PX), port(125, 125), port(150, 150), port(200, 200), port(300, 300, 150), port(900, 900)];
  const net = laneNetwork(ports, open);
  assert.deepEqual(net.map((l) => l.key).sort(), ['100-110', '100-125', '110-125', '125-150'], 'the chain: 150 to 125 alone (110 is 40 off), 200 none (50), 111 and 300 inland, 900 alone');
  for (const l of net) {
    assert.ok(l.a.id < l.b.id);
    assert.equal(l.key, `${l.a.id}-${l.b.id}`);
    assert.deepEqual(l.a.road, { x: l.a.px, y: 200 });
    assert.ok(Math.hypot(l.a.road.x - l.b.road.x, l.a.road.y - l.b.road.y) <= LANE_MAX_PX);
  }
  const shuffled = [ports[4], ports[2], ports[7], ports[6], ports[0], ports[5], ports[3], ports[1]];
  assert.deepEqual(laneNetwork(shuffled, open).map((l) => l.key), net.map((l) => l.key), 'every client the same, in the same order');
  // the two NEAREST of each port's: a third within reach is no lane of hers (1 to 4, 25 off, is neither's two)
  assert.deepEqual(laneNetwork([port(1, 100), port(2, 104), port(3, 108), port(4, 125)], open).map((l) => l.key).sort(), ['1-2', '1-3', '2-3', '2-4', '3-4']);
  // at the edge of LANE_MAX_PX
  assert.deepEqual(laneNetwork([port(1, 100), port(2, 100 + LANE_MAX_PX)], open).map((l) => l.key), ['1-2']);
  assert.deepEqual(laneNetwork([port(1, 100), port(2, 101 + LANE_MAX_PX)], open), []);
});

test('SEA-LANES THE WAY: the water\'s way between two roadsteads - every pixel water, a step to one of its eight neighbours, never a corner cut past land - round the jetty and no farther than it must; none where the water joins them not, past LANE_PATH_PX, or from land; straightened where a line holds to the water, its length in metres', () => {
  const from = { x: 112, y: 205 }, to = { x: 128, y: 205 };
  const px = lanePixels(from, to, water);
  assert.ok(px, 'round the jetty');
  assert.deepEqual(px[0], from); assert.deepEqual(px.at(-1), to);
  let len = 0;
  for (let i = 0; i < px.length; i++) {
    assert.ok(water(px[i].x, px[i].y), `(${px[i].x}, ${px[i].y}) water`);
    if (!i) continue;
    const dx = px[i].x - px[i - 1].x, dy = px[i].y - px[i - 1].y;
    assert.ok(Math.max(Math.abs(dx), Math.abs(dy)) === 1, 'a neighbour');
    if (dx && dy) assert.ok(water(px[i - 1].x + dx, px[i - 1].y) && water(px[i - 1].x, px[i - 1].y + dy), 'no corner cut past land');
    len += dx && dy ? Math.SQRT2 : 1;
  }
  assert.ok(px.some((p) => p.x === 120 && p.y >= JETTY), 'under the jetty\'s end');
  // the shortest: seven diagonals and three rows down to the jetty's end, two across it (a diagonal round its corner
  // would cut it), and up again
  const best = 2 * (7 * Math.SQRT2 + 3) + 2;
  assert.ok(Math.abs(len - best) < 1e-9, `the shortest way: ${len.toFixed(3)} of ${best.toFixed(3)}`);
  // the shortest way through walls - against a plain search of every way (each step its own length, a diagonal never
  // past a wall's corner)
  const octile = (path) => path.reduce((sum, p, i) => sum + (!i ? 0 : p.x !== path[i - 1].x && p.y !== path[i - 1].y ? Math.SQRT2 : 1), 0);
  const shortest = (a, b, wet) => {
    const dist = new Map([[`${a.x},${a.y}`, 0]]), open = [[0, a.x, a.y]];
    while (open.length) {
      open.sort((p, q) => p[0] - q[0]);
      const [d, x, y] = open.shift();
      if (x === b.x && y === b.y) return d;
      if (d > dist.get(`${x},${y}`)) continue;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dy) || !wet(x + dx, y + dy) || (dx && dy && (!wet(x + dx, y) || !wet(x, y + dy)))) continue;
        const nd = d + (dx && dy ? Math.SQRT2 : 1), k = `${x + dx},${y + dy}`;
        if (nd < (dist.get(k) ?? Infinity)) { dist.set(k, nd); open.push([nd, x + dx, y + dy]); }
      }
    }
    return Infinity;
  };
  for (const { walls, from: a, to: b } of [
    { walls: [[318, 312, 7, 1], [321, 309, 8, 5]], from: { x: 317, y: 321 }, to: { x: 320, y: 304 } },
    { walls: [[302, 320, 1, 8], [311, 313, 4, 1], [301, 314, 2, 1]], from: { x: 318, y: 314 }, to: { x: 301, y: 321 } },
  ]) {
    const wet = (x, y) => x >= 300 && y >= 300 && x < 324 && y < 324 && !walls.some(([wx, wy, w, h]) => x >= wx && x < wx + w && y >= wy && y < wy + h);
    const way = lanePixels(a, b, wet);
    assert.ok(Math.abs(octile(way) - shortest(a, b, wet)) < 1e-9, `the shortest: ${octile(way).toFixed(3)} of ${shortest(a, b, wet).toFixed(3)}`);
  }
  assert.equal(lanePixels({ x: 100, y: 199 }, to, water), null, 'from land');
  assert.equal(lanePixels({ x: 605, y: 105 }, to, water), null, 'a lake: no way to the sea');
  assert.equal(lanePixels({ x: 100, y: 300 }, { x: 101 + LANE_PATH_PX, y: 300 }, water), null, 'past LANE_PATH_PX');
  assert.ok(lanePixels({ x: 100, y: 300 }, { x: 100 + LANE_PATH_PX, y: 300 }, water), 'at it');
  assert.ok(LANE_SEARCH >= 4 * LANE_PATH_PX * LANE_PATH_PX, 'the search room for a way LANE_PATH_PX long');
  // straightened: the ends kept, each leg held to the water, far fewer points
  const pts = straighten(px, waterNative);
  const centre = (p) => { const o = nativeOfPixel(p.x, p.y); return { x: o.x + NATIVE_PIXEL / 2, z: o.z + NATIVE_PIXEL / 2 }; };
  assert.deepEqual(pts[0], centre(from)); assert.deepEqual(pts.at(-1), centre(to));
  assert.ok(pts.length >= 3 && pts.length < px.length / 3, `${pts.length} legs' ends of ${px.length} pixels`);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const n = Math.ceil((Math.hypot(b.x - a.x, b.z - a.z) / NATIVE_PIXEL) * LANE_STRAIGHT_STEPS);
    for (let k = 0; k <= n; k++) assert.ok(waterNative(a.x + ((b.x - a.x) * k) / n, a.z + ((b.z - a.z) * k) / n), 'each leg on the water');
  }
  assert.deepEqual(straighten([{ x: 300, y: 300 }, { x: 301, y: 300 }, { x: 302, y: 300 }, { x: 303, y: 301 }], waterNative), [centre({ x: 300, y: 300 }), centre({ x: 303, y: 301 })], 'open water: one leg');
  const way = laneWay({ a: { road: from }, b: { road: to } }, water, waterNative);
  let m = 0;
  for (let i = 1; i < way.pts.length; i++) m += Math.hypot(way.pts[i].x - way.pts[i - 1].x, way.pts[i].z - way.pts[i - 1].z) * M_PER_NATIVE;
  assert.deepEqual(way.pts, pts);
  assert.ok(Math.abs(way.len - m) < 1e-6 && way.len > 16 * 819.2 && way.len < best * 819.2, `${way.len.toFixed(0)} m`);
  assert.equal(laneWay({ a: { road: { x: 605, y: 105 } }, b: { road: to } }, water, waterNative), null);
});

/** A lane of the coast and its way. */
function laneOf(a = 200, b = 225) {
  const [lane] = laneNetwork([port(a, a, 199, 'Glenpoint'), port(b, b, 199, 'Wayrest')], open);
  return { lane, way: laneWay(lane, water, waterNative) };
}
const flat = (p, q) => Math.hypot(p.x - q.x, p.z - q.z) * M_PER_NATIVE;

test('SEA-LANES THE PACKET: a lane\'s packet is drawn off the lane\'s own seed (its two ports\') and her place in it - a merchantman, or on LANE_NAVY of the lanes a crown\'s ship, at LANE_LEVEL for every player and never a galley - her cruise LANE_CRUISE of her class\'s best', () => {
  const { lane } = laneOf();
  const p = packetOf(lane, 0, 1);
  assert.deepEqual(packetOf(lane, 0, 1), p, 'the same on every client');
  assert.equal(p.seed, hash32(laneSeed(lane), 0, 0x1a4e5));
  assert.equal(p.speed, p.cls.speed * LANE_CRUISE);
  const r = mulberry32(p.seed);
  const faction = r() < LANE_NAVY ? 'navy' : 'merchant';
  const drawn = classFor(faction, LANE_LEVEL, r());
  assert.equal(p.cls.id, (drawn.hull === HULL.LargeGalley ? classFor(faction, 1, r()) : drawn).id);
  assert.notEqual(packetOf(lane, 1, 2).seed, p.seed, 'her sister another ship');
  const base = mulberry32(laneSeed(lane))();
  assert.equal(p.phase, base, 'her share of the cycle, the lane\'s');
  for (const [k, n] of [[1, 3], [2, 3], [3, 4]]) assert.ok(Math.abs(packetOf(lane, k, n).phase - ((base + k / n) % 1)) < 1e-12, 'her sisters spread over it');
  let navy = 0, n = 0;
  for (let a = 0; a < 40; a++) for (let b = a + 1; b < a + 30; b++) {
    const q = packetOf({ a: { id: a * 1009 }, b: { id: b * 7919 } });
    n++;
    if (q.cls.faction === 'navy') navy++;
    assert.ok(['merchant', 'navy'].includes(q.cls.faction));
    assert.notEqual(q.cls.hull, HULL.LargeGalley, 'a galley never - she moors');
  }
  assert.ok(Math.abs(navy / n - LANE_NAVY) < 0.06, `a crown's on ${navy} of ${n}`);
});

test('SEA-LANES ON THE SHARED CLOCK: a packet sails her lane out at her cruise, lies LANE_DWELL_S at the far port, sails home and lies LANE_DWELL_S at hers - where she is a function of the clock alone, the same twice and on every client; a lane sails one every LANE_HEADWAY_S each way; her voyage is her cycle, and the next is another ship', () => {
  const { lane, way } = laneOf();
  assert.ok(way && way.len > 24 * 819.2 && way.pts.length === 2, 'open water: one leg');
  const first = packetOf(lane);
  const leg = way.len / first.speed, period = 2 * (leg + LANE_DWELL_S);
  const count = Math.max(1, Math.round(period / LANE_HEADWAY_S));
  const T0 = 1.7e12;
  assert.equal(packetsAt(lane, way, T0).length, count, `${count} packets on a round of ${period.toFixed(0)} s`);
  assert.deepEqual(packetsAt(lane, way, T0), packetsAt(lane, way, T0), 'the clock alone');
  // one packet through a whole cycle and more, a second at a time
  const k = 0;
  let last = packetAt(lane, way, T0, k, count), phases = [last.phase], voyages = new Set([last.voyage]);
  const cruise = packetOf(lane, k, count).speed;
  for (let t = 1; t <= period * 1.2; t += 1) {
    const p = packetAt(lane, way, T0 + t * 1000, k, count);
    if (p.voyage === last.voyage) {
      assert.ok(flat(p.at, last.at) <= cruise * 1.0001 + 1e-6, `no jump at ${t} s: ${flat(p.at, last.at).toFixed(2)} m`);
      if (p.phase === 'sail') assert.ok(Math.hypot(p.dir.x, p.dir.z) > 0, 'a way under her');
    }
    if (p.phase !== phases.at(-1)) phases.push(p.phase);
    voyages.add(p.voyage);
    last = p;
  }
  assert.ok(phases.length >= 4 && phases.every((x, i) => !i || x !== phases[i - 1]) && phases.every((x) => x === 'sail' || x === 'dwell'), `the cycle: ${phases}`);
  assert.equal(voyages.size, 2, 'a voyage a cycle');
  // the cycle itself, from her voyage's own first second
  const p0 = packetOf(lane, k, count);
  const start = (v) => (v * period - p0.phase * period) * 1000;
  const v = packetAt(lane, way, T0, k, count).voyage + 1;
  const at = (s) => packetAt(lane, way, start(v) + s * 1000, k, count);
  const out = at(1);
  assert.deepEqual([out.phase, out.from.id, out.to.id, out.port, out.voyage], ['sail', lane.a.id, lane.b.id, null, v], 'out from her home port');
  assert.ok(flat(out.at, way.pts[0]) < cruise * 1.01 + 1, 'from its roadstead');
  assert.ok(out.leg === way.pts, 'her leg her way out (AUDIT BAY A6 PIN MOVED: the leg she is steered along, for her place ahead)');
  assert.equal(at(leg + LANE_DWELL_S - 1).phase, 'dwell', 'the whole of her dwell');
  assert.equal(at(2 * leg + 2 * LANE_DWELL_S - 1).phase, 'dwell');
  const there = at(leg + 1);
  assert.deepEqual([there.phase, there.port.id, there.to.id, there.at, there.until], ['dwell', lane.b.id, lane.a.id, way.pts.at(-1), start(v) / 1000 + leg + LANE_DWELL_S], 'lying at the far port till her dwell ends');
  assert.ok(there.leg === way.pts, 'the leg that brought her');
  const back = at(leg + LANE_DWELL_S + 1);
  assert.deepEqual([back.phase, back.from.id, back.to.id], ['sail', lane.b.id, lane.a.id], 'home');
  assert.deepEqual(back.leg, [...way.pts].reverse(), 'her way home');
  const home = at(2 * leg + LANE_DWELL_S + 1);
  assert.deepEqual([home.phase, home.port.id, home.until], ['dwell', lane.a.id, start(v) / 1000 + period]);
  assert.deepEqual(home.leg, back.leg);
  assert.equal(at(period + 1).voyage, v + 1, 'and out again: her next voyage');
  assert.notEqual(at(period + 1).seed, at(1).seed, 'another ship');
  assert.equal(at(1).id, `L${lane.key}.${k}.${v}`);
  // a lane's count: her round trip over LANE_HEADWAY_S, to the nearest (lanes of four lengths, one rounding down)
  let down = 0;
  for (const b of [205, 212, 218, 225, 229]) {
    const l2 = laneOf(200, b);
    const p = packetOf(l2.lane);
    const round = (2 * (l2.way.len / p.speed + LANE_DWELL_S)) / LANE_HEADWAY_S;
    if (round % 1 < 0.5) down++;
    assert.equal(packetsAt(l2.lane, l2.way, 0).length, Math.max(1, Math.round(round)), `200-${b}: ${round.toFixed(2)}`);
  }
  assert.ok(down >= 1, 'one rounds down');
  // a lane's packets spread over her cycle: one a LANE_HEADWAY_S each way
  const all = packetsAt(lane, way, T0);
  assert.equal(new Set(all.map((p) => p.id)).size, count);
  assert.equal(new Set(all.map((p) => p.seed)).size, count);
});

// ── the host ─────────────────────────────────────────────────────────────────────────────────────────────────────

const GLEN = { key: 'port:1', name: 'Glenpoint' }, WAYR = { key: 'port:2', name: 'Wayrest' };
/** A packet under way in the scene, her leg running north through her place (AUDIT BAY A6/A9/A17 PIN MOVED: her leg,
 *  her seeds and her ports by key - her place ahead and her ports' names were the list's). */
const under = (id, seed, x, z, o = {}) => ({ id, seed, seeds: [seed], classId: 'merchantGalleon', region: -1, phase: 'sail', pos: [x, 0, z], yaw: 0, leg: [[x, z - 3000], [x, z + 3000]], port: null, to: WAYR, from: GLEN, ...o });
const liners = (h) => [...h.host._sea.values()].filter((e) => e.liner);

test('SEA-LANES THE HOST STANDS THEM: a packet under way within LINER_STAND_M stands - the nearest first, LINERS_MAX of them by the Ships at sea (none with it off) - fading in, steered along her leg; never twice, never one whose copy (her seed) is in my sea, nor one off the water or too far', async () => {
  const list = [under('L1-2.0.5', 11, 300, 0), under('L1-2.1.5', 22, 0, 500), under('L3-4.0.9', 33, -700, 0), under('L5-6.0.1', 44, 0, -900), under('L7-8.0.2', 55, 1100, 100)];
  for (const [key, want] of [['off', 0], ['few', 1], ['some', 2], ['many', 3]]) {
    const h = await sea({ hull: 2, settings: { ShipsAtSea: key } });
    assert.equal(LINERS_MAX[DENSITY[key]], want);
    h.host.liners([...list].reverse(), { now: 0 });
    h.host.liners(list, { now: 2 });
    assert.deepEqual(liners(h).map((e) => e.liner.id), list.slice(0, want).map((l) => l.id), `${key}: the nearest ${want}, whatever the list's order`);
    for (const e of liners(h)) {
      const l = list.find((x) => x.id === e.liner.id);
      assert.deepEqual([e.ship.seed, e.ship.cls.id, e.ship.pos[0], e.ship.pos[2], e.fade], [l.seed, l.classId, l.pos[0], l.pos[2], 0], 'where her lane puts her, coming into the world');
      assert.deepEqual([e.ship.errand, e.ship.course?.map((q) => +q.toFixed(6))], [null, [l.pos[0], l.pos[2] + LINER_LOOKAHEAD_M]], 'along her leg, LINER_LOOKAHEAD_M on (AUDIT BAY A6 PIN MOVED: for her place ahead)');
    }
  }
  const h = await sea({ hull: 2, settings: { ShipsAtSea: 'many' }, water: (x) => x < 1000 });
  const twin = h.host._sea.get(h.host.spawnShip('merchantCoaster', { range: 600 }));
  twin.ship.seed = 22;   // a peer's copy of the second, taken over
  h.host.liners([under('far', 1, 0, LINER_STAND_M + 1), under('land', 2, 1050, 0), ...list.slice(0, 2)], { now: 0 });
  assert.deepEqual(liners(h).filter((e) => e !== twin).map((e) => e.liner.id), ['L1-2.0.5'], 'too far, on land, a copy in my sea: none');
  assert.equal(twin.liner?.id, 'L1-2.1.5', 'the copy known by her seed (AUDIT BAY A3 PIN MOVED: she was nobody\'s packet)');
});

test('SEA-LANES STEERED BY HER LANE: under way, out of her berth through the harbour\'s mouth first, then along her leg from where she is (AUDIT BAY A6 PIN MOVED: for her place ahead, on past it where she outsailed it); at her port, into the last open berth of a harbour I know (AUDIT BAY A7), moored till her clock sails her on - else lying off her leg\'s end', async () => {
  const coast = (x, z) => !(z > 200 || (x > 300 && x < 400 && z > -300));
  const PORT = { key: WAYR.key, name: 'Wayrest', rect: { minX: -100, maxX: 100, minZ: 220, maxZ: 420 } };
  const HERE = WAYR;
  const h = await sea({ hull: null, water: coast, settings: { ShipsAtSea: 'many' } });   // three under way: the carrack lying off her far port, the one berthing at home, and the galley
  h.view.feet = [0, 0, 300];
  h.deps.harbourNear = () => PORT;
  h.run(1);
  const harbour = findHarbour({ rect: PORT.rect, isWater: coast });
  // lying at her port: at its last open berth, sails stowed
  h.host.liners([under('L1-2.0.3', 77, 0, 100, { classId: 'merchantCarrack', phase: 'dwell', port: HERE, to: GLEN, from: GLEN, leg: [[0, -3000], [0, 100]] })], { now: 400 });
  const [e] = liners(h);
  assert.ok(e, 'stood at her berth');
  const r = e.ship.errand;
  assert.deepEqual([r.kind, r.harbour, r.berth], ['moored', PORT.key, harbour.berths.length - 1]);
  const b = harbour.berths[r.berth];
  // (SHIPS-2: alongside it - Mac's carrack lies 1.73 m in toward its quay from the berth's point, sounded for the mod's)
  const along = alongside(b, 4, harbour.hull);
  assert.ok(Math.hypot(e.ship.pos[0] - along[0], e.ship.pos[2] - along[1]) < 0.5 && e.ship.sails === 0, 'at the berth, sails stowed');
  assert.equal(r.until, Infinity, 'moored till her clock sails her on (AUDIT BAY A6 PIN MOVED: her dwell\'s end, on the shared clock, as her own)');
  // under way: through the mouth first
  const sail = under('L1-2.0.3', 77, 0, 100, { classId: 'merchantCarrack', from: HERE, to: GLEN, leg: [[0, 100], [0, -3000]], yaw: Math.PI });
  h.host.liners([sail], { now: 501 });
  assert.equal(e.ship.errand.kind, 'depart', 'out through the harbour\'s mouth');
  assert.equal(e.ship.course, null);
  h.host.liners([sail], { now: 503 });
  assert.equal(e.ship.errand.kind, 'depart', 'kept till she is out');
  e.ship.errand = null;
  e.ship.pos = [0, 0, -100];
  h.host.liners([sail], { now: 505 });
  assert.deepEqual(e.ship.course.map((q) => +q.toFixed(6)), [0, -100 - LINER_LOOKAHEAD_M], 'along her leg');
  // her place on the clock wherever it is: never steered for, never back for it
  h.host.liners([{ ...sail, pos: [0, 0, -2000] }], { now: 507 });
  assert.deepEqual(e.ship.course.map((q) => +q.toFixed(6)), [0, -100 - LINER_LOOKAHEAD_M], 'her place far ahead: on along her leg');
  h.host.liners([{ ...sail, pos: [0, 0, 50] }], { now: 509 });
  assert.deepEqual(e.ship.course.map((q) => +q.toFixed(6)), [0, -100 - LINER_LOOKAHEAD_M], 'her place behind her: never back for it');
  // at her far port, whose harbour I know not: lying off her leg's end (AUDIT BAY A22: her own leg's - the clock's turns
  // under a packet behind it)
  e.ship.pos = [0, 0, -3000 + LINER_PORT_M - 10];
  h.host.liners([sail], { now: 1500 });
  assert.equal(e.ship.errand.kind, 'lurk');
  assert.deepEqual(e.ship.errand.at, [0, -3000], 'off the port, on her ring');
  const ring = e.ship.errand;
  h.host.liners([sail], { now: 1502 });
  assert.ok(e.ship.errand === ring, 'kept, her way about it with it');
  assert.deepEqual([e.liner.phase, e.liner.dest.name], ['sail', 'Glenpoint'], 'what her tag reads');
  // at a port whose harbour I know: into its last open berth
  const home = under('L1-2.0.4', 78, 0, -100, { classId: 'merchantCarrack', to: HERE, from: GLEN, leg: [[0, -3000], [0, 100]] });
  h.host.liners([sail, home], { now: 1504 });
  const f = liners(h).find((x) => x.liner.id === home.id);
  assert.deepEqual([f?.ship.errand?.kind, f?.ship.errand?.harbour, f?.ship.course], ['arrive', PORT.key, null], 'into a berth');
  // a galley never moors: one lying at her port stands off it, never at a berth
  const galleyAt = (phase) => under('L5-6.0.1', 91, 60, 0, { classId: 'navyGalley', phase, port: phase === 'dwell' ? HERE : null, leg: [[60, -3000], [60, 0]] });
  h.host.liners([galleyAt('dwell'), sail, home], { now: 1506 });
  assert.ok(!liners(h).some((x) => x.liner.id === 'L5-6.0.1'), 'a galley lying at a port: not stood at a berth');
  h.host.liners([galleyAt('sail'), sail, home], { now: 1508 });
  const galley = liners(h).find((x) => x.liner.id === 'L5-6.0.1');
  assert.ok(galley, 'under way: stood');
  h.host.liners([galleyAt('dwell'), sail, home], { now: 1510 });
  assert.equal(galley.ship.errand.kind, 'lurk', 'at her port: lying off it');
  // the Ships at sea off: none, not even at a berth (AUDIT BAY A5: another player launching the sea's traffic stands none of mine)
  const off = await sea({ hull: null, water: coast, settings: { ShipsAtSea: 'off' } });
  off.view.feet = [0, 0, 300];
  off.deps.harbourNear = () => PORT;
  off.run(1);
  off.host.liners([under('L1-2.0.3', 77, 0, 100, { classId: 'merchantCarrack', phase: 'dwell', port: HERE, leg: [[0, -3000], [0, 100]] })], { now: 400 });
  assert.equal(liners(off).length, 0);
});

test('SEA-LANES LET GO AND SPENT: one past LINER_DROP_M sails on and fades (SHIP-FADE) - unless she fights; back as she fades, she stays; out of the list she is her lane\'s no more but sails on, the sea\'s (AUDIT BAY A19 PIN MOVED: she faded out beside the player), her lane\'s again by her seed; one sunk or taken is spent for her voyage - never stood again, and the next voyage is another ship', async () => {
  const h = await sea({ hull: 2, settings: { ShipsAtSea: 'some' } });
  const a = under('L1-2.0.5', 11, 300, 0), b = under('L1-2.1.5', 22, 0, 500);
  h.host.liners([a, b], { now: 0 });
  h.run(SHIP_FADE_S + 0.5);
  const [ea, eb] = liners(h);
  h.host.liners([a], { now: 5 });
  assert.deepEqual([ea.retiring, eb.retiring, eb.liner, eb.ship.course], [false, false, null, null], 'out of the list: the sea\'s, never faded');
  assert.ok(h.host._sea.has(eb.id));
  h.host.liners([a, b], { now: 6 });
  assert.equal(eb.liner?.id, b.id, 'back in it: her lane\'s again, by her seed');
  eb.ship.pos = [0, 0, LINER_DROP_M + 50];
  h.host.liners([a, b], { now: 7 });
  assert.equal(eb.retiring, true, 'past LINER_DROP_M');
  eb.ship.pos = [0, 0, LINER_DROP_M - 50];
  h.host.liners([a, b], { now: 8 });
  assert.equal(eb.retiring, false, 'back as she fades: she stays');
  eb.ship.pos = [0, 0, LINER_DROP_M + 50];
  h.host.liners([a, b], { now: 9 });
  h.run(SHIP_FADE_S + 0.5);
  assert.equal(h.host._sea.has(eb.id), false, 'gone');
  // fighting: never let go, nor steered
  provokeMe(ea);
  h.run(1);
  assert.equal(ea.ship.mode === 'flee' || ea.ship.mode === 'engage', true, `she answers a blow (${ea.ship.mode})`);
  ea.ship.course = null;
  h.host.liners([a], { now: 10 });
  assert.equal(ea.ship.course, null, 'her fight hers: no lane steers her');
  ea.ship.pos = [0, 0, LINER_DROP_M + 50];
  h.host.liners([a], { now: 11 });
  assert.equal(ea.retiring, false, 'fighting: kept');
  // spent
  ea.ship.damage.apply({ hull: 1e6, sail: 0, crew: 0 }, 0);
  h.run(0.2);
  assert.equal(ea.ship.damage.state, SHIP_STATES.sinking);
  h.host._sea.delete(ea.id);   // she has gone down
  h.host.liners([a], { now: 12 });
  assert.equal(liners(h).length, 0, 'spent for her voyage: never stood again');
  h.host.liners([under('L1-2.0.6', 12, 300, 0)], { now: 13 });
  assert.deepEqual(liners(h).map((e) => e.liner.id), ['L1-2.0.6'], 'her lane\'s next voyage: another ship');
});
/** A blow of mine on a ship (navalAI.js provoke, the host's own clock long run). */
function provokeMe(e) { e.ship.provoked.set('local', 1e9); }

// ── the world's feed, lifted from world.js and run ──────────────────────────────────────────────────────────────────

function liftFeed() {
  const i = WORLD.indexOf('  const LANE_LIST_MS = 2000, LANE_NEAR_PX = 4;');
  const j = WORLD.indexOf('    naval.liners(list);\n  }\n', i);
  assert.ok(i > 0 && j > i, 'the feed lifted');
  return WORLD.slice(i, j + '    naval.liners(list);\n  }\n'.length);
}
const FEED_PORTS = [{ id: 199200, x: 200, y: 199, name: 'Glenpoint' }, { id: 199225, x: 225, y: 199, name: 'Wayrest' }, { id: 199900, x: 900, y: 199, name: 'Far Harbour' },
  { id: 99601, x: 601, y: 99, name: 'Lakeside' }, { id: 99608, x: 608, y: 99, name: 'Mere' }];   // two towns on the lake: water, but no sea's
/** The feed over the coast: three ports, one far, the player at the first's roadstead. */
function feedOn({ at = { x: 200, y: 200 }, clock = 1.7e12 } = {}) {
  const OCEAN = 223;
  const PORTS = FEED_PORTS;
  const S = 40;   // native units a scene metre (SCENE_MAP_RATIO)
  const origin = nativeOfPixel(at.x, at.y);
  const calls = { liners: [], ways: 0 };
  const env = {
    tvWater: (px, py) => water(px, py), maps: { getClimateIndex: (px, py) => (open(px, py) ? OCEAN : 1), getRegion: (ri) => ({ mapNames: PORTS.map((p) => p.name) }) },
    CLIMATES: { Ocean: OCEAN }, RAID_NATIVE_PIXEL: NATIVE_PIXEL, pixelOfNative,
    PORT_LOCATION_IDS: [...PORTS.map((p) => p.id), PORTS[0].id, 5],   // a repeat, and an id the map has not
    mapDict: new Map(PORTS.map((p, k) => [p.id & 0xfffff, { id: p.y * 1000 + p.x, regionIndex: 1, mapIndex: k }])),
    getPixelFromPixelID: (id) => ({ x: id % 1000, y: Math.floor(id / 1000) }),
    laneNetwork, laneWay: (...a) => { calls.ways++; return laneWay(...a); }, packetsAt, LANE_PATH_PX, LANE_MAX_PX,
    performance: { now: () => env.t }, t: 10000,
    naval: { enabled: true, liners: (list) => calls.liners.push({ list }) },
    playerTravelPixel: () => ({ ...at }), player: { feetAt: () => [NATIVE_PIXEL / 2 / S, 0, NATIVE_PIXEL / 2 / S] }, raidNowMs: () => clock,
    state: { localFromWorld: (x, z) => [(x - origin.x) / S, (z - origin.z) / S] },
  };
  const names = Object.keys(env).filter((k) => k !== 't');
  // eslint-disable-next-line no-new-func
  const run = new Function(...names, `${liftFeed()}\nreturn { laneShips, laneNet };`)(...names.map((k) => env[k]));
  return { ...run, calls, env, PORTS, S, origin };
}

test('SEA-LANES THE WORLD\'S FEED: before the frame poses the sea\'s ships, every LANE_LIST_MS the world hands the host every packet of the lanes about the player at the shared clock (AUDIT BAY A19 PIN MOVED: those within LANE_LIST_M of the player) - the lanes of the map\'s own ports (Travel Options\' list, by its water and the ocean\'s climate), a lane\'s way sounded once and only near the player, each packet in the scene with her seeds, her leg, her ports by key and name and her home port\'s region', () => {
  assert.match(WORLD, /if \(_mode\(\) === 'exterior' && !gamePaused\(\) && !_loading\) laneShips\(\);[^\n]*\n\s*naval\.frame\(dt \* worldTimeScale\(\)/, 'stood and steered before the frame poses them, outdoors and running');
  assert.match(WORLD, /return \{ key: `port:\$\{t\.id\}`, name: t\.name, rect, ready \};/, 'the harbour named, its key a lane port\'s');   // PIN MOVED (AUDIT HOLDINGS O1): and whether its scan's pixels are built
  // the clock where the lane's first packet lies at her home port, by the player
  const [lane] = laneNetwork(FEED_PORTS.map((p) => ({ id: p.y * 1000 + p.x, name: p.name, px: p.x, py: p.y, region: 1 })), open);
  const way = laneWay(lane, water, waterNative);
  const count = packetsAt(lane, way, 0).length, p0 = packetOf(lane, 0, count);
  const leg = way.len / p0.speed, period = 2 * (leg + LANE_DWELL_S), v = Math.floor(1.7e9 / period);
  const clock = ((v - p0.phase) * period + 2 * leg + LANE_DWELL_S + 10) * 1000;
  const f = feedOn({ clock });
  assert.deepEqual(f.laneNet().map((l) => [l.key, l.a.name, l.b.name, l.a.region]), [['199200-199225', 'Glenpoint', 'Wayrest', 1]], 'the map\'s ports: the far harbour too far for a lane, the lake\'s towns none (its water no ocean\'s)');
  assert.match(WORLD, /town = \{ id: summary\.id, loc, x: p\.x \+ dx, y: p\.y \+ dy, name: maps\.getRegion\(summary\.regionIndex\)\?\.mapNames\?\.\[summary\.mapIndex\] \?\? null \};/, 'the harbour\'s town by its name');
  f.laneShips();
  assert.equal(f.calls.liners.length, 1);
  const { list } = f.calls.liners[0];   // AUDIT BAY A6 PIN MOVED: her phase on the clock sails her - the clock's second was the host's to time a dwell by
  const want = packetsAt(lane, way, clock);
  assert.ok(want[0].phase === 'dwell' && want[0].port.id === lane.a.id, 'her first packet at home');
  assert.deepEqual(list.map((l) => l.id), want.map((p) => p.id), 'every packet of the lane');
  const scene = (q) => f.env.state.localFromWorld(q.x, q.z);
  const key = (q) => (q ? { key: `port:${q.id}`, name: q.name } : null);
  for (const l of list) {
    const p = want.find((q) => q.id === l.id);
    const [x, z] = scene(p.at);
    assert.deepEqual(l.pos, [x, 0, z], 'in the scene');
    assert.deepEqual([l.seed, l.seeds, l.classId, l.phase, l.region], [p.seed, p.seeds, p.cls.id, p.phase, 1]);
    assert.deepEqual([l.to, l.from, l.port], [key(p.to), key(p.from), key(p.port)]);
    assert.deepEqual(l.leg, p.leg.map(scene));
  }
  // under way: her heading the lane's, in the scene
  const sailing = feedOn({ clock: clock + (LANE_DWELL_S + 60) * 1000 });
  sailing.laneShips();
  const out = sailing.calls.liners[0].list.find((l) => l.id.startsWith(`L${lane.key}.0.`));
  assert.ok(out && out.phase === 'sail', 'out of her home port');
  const [ax, az] = out.leg[1];
  assert.ok(Math.abs(out.yaw - Math.atan2(ax - out.pos[0], az - out.pos[2])) < 1e-9, `her heading her leg's (${out.yaw})`);
  f.env.t += 1999;
  f.laneShips();
  assert.equal(f.calls.liners.length, 1, 'not again within LANE_LIST_MS');
  f.env.t += 1;
  f.laneShips();
  assert.equal(f.calls.liners.length, 2);
  assert.equal(f.calls.ways, 1, 'a lane\'s way sounded once');
  // far from every lane: none sounded
  const far = feedOn({ at: { x: 500, y: 450 } });
  far.laneShips();
  assert.deepEqual([far.calls.ways, far.calls.liners[0].list.length], [0, 0]);
  // the host off, or the map not read: nothing
  const off = feedOn();
  off.env.naval.enabled = false;
  off.laneShips();
  assert.equal(off.calls.liners.length, 0);
});
