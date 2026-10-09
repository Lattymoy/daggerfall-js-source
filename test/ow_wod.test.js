// OW-WOD (2026-09-29, Mac: "There's an issue with the overworld. 1. When near mountains from WOD, the game lags insane
// 2. Pathing doesnt go around mountains 3. Pathing doesnt follow the road around cities"). Three root causes, pinned here:
//
// OW-WOD-LAG - the collider's wide faces. World of Daggerfall's Mountains layouts stand rocks scaled by hundreds and
//   thousands, and the collider filed their faces on a 64-unit XZ grid, so a query near a massif took every face whose
//   footprint covered its column - above and below alike - and tested each exactly. A tree over each bucket's wide faces
//   (with a box a face) hands a query only the faces it can reach. The road-clearance walk is bounded to the map.
// OW-WOD-PATH - the Overworld's planner knew only the MAPS climate's peaks; a WOD massif's pixel was refused to an open
//   step, as the Mountain climate's was - until MOUNTAINS WALKABLE (the owner, the Wrothgarian zone's merge) removed the
//   on-foot restriction everywhere: the host still hands the massifs over, and the planner walks them.
// OW-TOWN-RING - a route through a town's pixel aimed a leg at the town's heart; it walks the border ring now, the
//   ring Travel Options' own follow key walks and the roads' painter paves.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Collider, wideCandidates, wideRayCandidates } from '../src/player/collider.js';
import { objectMatrix } from '../src/world/wodLocationObjects.js';
import { loadLocationPrefab } from '../src/world/wodLocationData.js';
import { WOD_TERRAIN_SIZE_MULTI, LocationSession } from '../src/world/wodLocationLoader.js';
import { decodeRegionPack } from '../src/world/wodLocationPack.js';
import { WodWorld, WOD_MOUNTAIN_PREFAB } from '../src/world/worldOfDaggerfall.js';
import { boxNearPath } from '../src/world/roadClearance.js';
import { planRoute, routeLegs, routeGround } from '../src/systems/travelRoute.js';
import { ringPassPoints, ringSideOf, locationRectsOf, RING_ORDER } from '../src/systems/travelOptions.js';
import { DIR_DELTA } from '../src/world/roadNetwork.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const V = join(ROOT, 'vendor/world-of-daggerfall');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');

// ── OW-WOD-LAG ──────────────────────────────────────────────────────────

/** A unit icosphere, subdivided - the stand-in for model 60711 (ARENA2 is the player's). */
function ico(sub = 1) {
  const t = (1 + Math.sqrt(5)) / 2;
  let v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map((p) => { const l = Math.hypot(...p); return p.map((c) => c / l); });
  let f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let s = 0; s < sub; s++) {
    const mid = new Map(), out = [];
    const m = (a, b) => { const k = a < b ? `${a},${b}` : `${b},${a}`; if (!mid.has(k)) { const p = v[a].map((c, i) => (c + v[b][i]) / 2); const l = Math.hypot(...p); v.push(p.map((c) => c / l)); mid.set(k, v.length - 1); } return mid.get(k); };
    for (const [a, b, c] of f) { const ab = m(a, b), bc = m(b, c), ca = m(c, a); out.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
    f = out;
  }
  return { positions: new Float32Array(v.flat().map((x) => x * 0.6)), indices: new Uint32Array(f.flat()) };
}
/** A Mountains layout stood as the host stands it: every model piece a mesh in one bucket, the real transforms. */
function massif(name = 'WOD_Mountain_01r1', sub = 1) {
  const p = loadLocationPrefab(readFileSync(join(V, 'LocationPrefab', `${name}.txt`), 'utf8'));
  const base = 64 * WOD_TERRAIN_SIZE_MULTI, rock = ico(sub);
  const c = new Collider(() => 0);
  for (const o of p.obj) if (o.type === 0) c.addMesh('k', rock.positions, rock.indices, objectMatrix([base + o.pos.x, o.pos.y, base + o.pos.z], o.rot, o.scale));
  return { c, base, pieces: p.obj.filter((o) => o.type === 0).length };
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function closest(p, a, b, c) {
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a); const d1 = dot(ab, ap), d2 = dot(ac, ap); if (d1 <= 0 && d2 <= 0) return a;
  const bp = sub(p, b); const d3 = dot(ab, bp), d4 = dot(ac, bp); if (d3 >= 0 && d4 <= d3) return b;
  const vc = d1 * d4 - d3 * d2; if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return [a[0] + ab[0] * v, a[1] + ab[1] * v, a[2] + ab[2] * v]; }
  const cp = sub(p, c); const d5 = dot(ab, cp), d6 = dot(ac, cp); if (d6 >= 0 && d5 <= d6) return c;
  const vb = d5 * d2 - d1 * d6; if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return [a[0] + ac[0] * w, a[1] + ac[1] * w, a[2] + ac[2] * w]; }
  const va = d3 * d6 - d5 * d4; if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return [b[0] + (c[0] - b[0]) * w, b[1] + (c[1] - b[1]) * w, b[2] + (c[2] - b[2]) * w]; }
  const den = 1 / (va + vb + vc); const v = vb * den, w = vc * den; return [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w];
}
function rayTri(o, d, a, b, c) {
  const e1 = sub(b, a), e2 = sub(c, a), p = cross(d, e2), det = dot(e1, p);
  if (Math.abs(det) < 1e-12) return null;
  const inv = 1 / det, s = sub(o, a), u = dot(s, p) * inv; if (u < 0 || u > 1) return null;
  const q = cross(s, e1), v = dot(d, q) * inv; if (v < 0 || u + v > 1) return null;
  const t = dot(e2, q) * inv; return t >= 0 ? t : null;
}
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

test('OW-WOD-LAG: a query near a World of Daggerfall massif is handed only the faces it can reach - a few leaves\' worth, where the coarse grid handed it every face over its column (hundreds) - and the tree is one entry a face', () => {
  const { c, base, pieces } = massif();
  const b = c._buckets.get('k');
  assert.equal(pieces, 36, 'WOD_Mountain_01r1 stands 36 pieces, its giant (object 2) among them');
  assert.equal(b.grid.size, 0, 'every face of it is wide');
  assert.equal(b.wide.length, b.tris.length, 'each face once in the wide list');
  assert.ok(b.tris.every((t) => t[3] && t[4]), 'each wide face carries its own box');
  // the column the bench walked: the massif's footprint, at the ground
  const counts = [];
  for (let i = 0; i < 400; i++) counts.push(wideCandidates(c, 'k', [base - 1200 + rnd() * 1600, 0.5, base - 600 + rnd() * 1600], 0.35 + 2));
  counts.sort((x, y) => x - y);
  assert.ok(counts[200] <= 25 && counts[399] <= 80, `the tree hands a query a few leaves' faces (median ${counts[200]}, max ${counts[399]}) of ${b.tris.length}`);
  // a feeler's ray (the travel steering casts a dozen a frame, travelSteer.js) is handed the faces along it alone
  const rays = [];
  for (let i = 0; i < 200; i++) { const a = rnd() * Math.PI * 2; rays.push(wideRayCandidates(c, 'k', [base - 1200 + rnd() * 1600, 1, base - 600 + rnd() * 1600], [Math.cos(a), 0, Math.sin(a)], 20)); }
  rays.sort((x, y) => x - y);
  assert.ok(rays[100] <= 25 && rays[199] <= 120, `a 20-unit feeler is handed a few leaves' faces (median ${rays[100]}, max ${rays[199]})`);
  assert.ok(counts[200] * 100 < b.tris.length, 'under one face in a hundred of the massif\'s, where the coarse grid handed a query every face over its 192-unit column (the lag investigation\'s bench: median 151, max 579)');
});

test('OW-WOD-LAG: the tree finds exactly what a walk of every face finds - spheres, rays and a body standing on a face, over a real massif\'s transforms (the giant\'s faces, a million times scaled, included)', () => {
  for (const [name, s] of [['WOD_Mountain_01r1', 1], ['WOD_Mountain_03r2', 2]]) {
    const { c, base } = massif(name, s);
    const b = c._buckets.get('k');
    let sphHits = 0;
    for (let i = 0; i < 600; i++) {
      const tri = b.tris[Math.floor(rnd() * b.tris.length)];
      const u = rnd(), v = rnd() * (1 - u), w = 1 - u - v;
      const near = rnd() < 0.5;
      const p = near ? [0, 1, 2].map((k) => tri[0][k] * u + tri[1][k] * v + tri[2][k] * w + (rnd() - 0.5) * 4) : [base - 1200 + rnd() * 1600, rnd() * 900, base - 600 + rnd() * 1600];
      const r = 0.05 + rnd() * 1.85;
      let want = false;
      for (const q of b.tris) { const cp = closest(p, q[0], q[1], q[2]); if ((p[0] - cp[0]) ** 2 + (p[1] - cp[1]) ** 2 + (p[2] - cp[2]) ** 2 < r * r) { want = true; break; } }
      if (want) sphHits++;
      assert.equal(c.sphereOverlaps(p, r), want, `${name}: sphere ${p.map((x) => x.toFixed(1))} r ${r.toFixed(2)}`);
    }
    assert.ok(sphHits > 50, `${name}: spheres touch (${sphHits})`);
    let rayHits = 0;
    for (let i = 0; i < 300; i++) {
      const o = [base - 1200 + rnd() * 1600, rnd() * 900, base - 600 + rnd() * 1600];
      let d = [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]; const l = Math.hypot(...d); d = d.map((x) => x / l);
      let want = Infinity;
      for (const q of b.tris) { const t = rayTri(o, d, q[0], q[1], q[2]); if (t !== null && t <= 600 && t < want) want = t; }
      const got = c.raycastHit(o, d, 600).dist;
      if (Number.isFinite(want)) rayHits++;
      assert.ok(got === want || Math.abs(got - want) < 1e-6 * Math.max(1, want), `${name}: ray ${i} ${got} vs ${want}`);
    }
    assert.ok(rayHits > 30, `${name}: rays hit (${rayHits})`);
  }
});

test('OW-WOD-LAG: the tree is raised by the host\'s build (settle), once, and a later mesh in the bucket raises it again on the query that needs it', () => {
  const { c } = massif();
  const b = c._buckets.get('k');
  assert.equal(b.wideTree, null, 'no tree until asked');
  c.settle('k');
  const tree = b.wideTree;
  assert.ok(tree && tree.n === b.wide.length, 'settle builds it now');
  c.settle('k');
  assert.equal(b.wideTree, tree, 'a second settle keeps it');
  c.settle('none');   // a bucket that is not there: nothing
  const rock = ico(0);
  c.addMesh('k', rock.positions, rock.indices, objectMatrix([0, 0, 0], { x: 0, y: 0, z: 0, w: 1 }, { x: 900, y: 900, z: 900 }));
  assert.ok(b.wide.length > tree.n, 'a later wide mesh joins the list');
  c.sphereOverlaps([0, 540, 0], 1);
  assert.ok(b.wideTree !== tree && b.wideTree.n === b.wide.length, 'and the next query raises the tree again');
  assert.match(rd('src/scenes/world.js'), /collider\.settle\(key\);\n\s*await breather\.breathe\(\);\n\n\s*\/\/ SIB1:/, 'the host settles the pixel once every mesh is in, inside its build');
});

test('OW-WOD-LAG: the road-clearance walk asks only the map\'s pixels - a box the giant\'s size (thousands of pixels, most off the map) answers at once, and the same', () => {
  const W = 1000, H = 500;
  const roads = new Uint8Array(W * H), tracks = new Uint8Array(W * H);
  const net = { roads, tracks };
  const t0 = performance.now();
  assert.equal(boxNearPath(net, 500, 250, -1e12, -1e12, 1e12, 1e12, 0), false, 'no road anywhere: none');
  assert.ok(performance.now() - t0 < 1000, `the whole map walked once at most (${(performance.now() - t0).toFixed(0)} ms) - unbounded, it was 10^14 pixels`);
  roads[3 + 7 * W] = 4;   // one road's east edge at pixel (3, 7), far from (500, 250)
  assert.equal(boxNearPath(net, 500, 250, -1e12, -1e12, 1e12, 1e12, 0), true, 'a road inside the map is still found');
  // the edges: a box to the map's corner pixel and one wholly off the map
  assert.equal(boxNearPath(net, 0, 0, -1e9, -1e9, -5e8, -5e8, 0), false, 'a box wholly off the map asks nothing');
});

// ── OW-WOD-PATH ─────────────────────────────────────────────────────────

test('OW-WOD-PATH: the mod\'s massifs are the pixels a Mountains instance names - 2,492 on the shipped list (three more lie on row -1, off the map), the rock fields never among them', () => {
  const session = new LocationSession();
  const dir = join(V, 'Locations');
  for (const f of readdirSync(dir).sort((a, b) => parseInt(a, 10) - parseInt(b, 10))) session.appendRegion(parseInt(f, 10), decodeRegionPack(new Uint8Array(readFileSync(join(dir, f)))));
  const off = Object.create(WodWorld.prototype);
  off.session = session; off.mountains = false;   // WOD-PEAKS: the spires off (the default) - no massif for a route to go round
  assert.equal(off.mountainPixels().reduce((n, v) => n + v, 0), 0, 'with the Mountains layouts off no pixel is a massif');
  const w = Object.create(WodWorld.prototype);
  w.session = session; w.mountains = true;   // PIN MOVED (WOD-PEAKS): the switch on, as the mod ships it
  const t = w.mountainPixels();
  assert.equal(t.length, 1000 * 500);
  let n = 0; for (const v of t) n += v;
  assert.equal(n, 2492, 'the massifs\' pixels on the map (region 16 names three at y -1: none)');
  assert.equal(w.mountainPixels(), t, 'kept for the list it was read from');
  let rocks = 0;
  for (let i = 0; i < session.count; i++) if (/^WOD_Rocks_Large/.test(session.prefab[i]) && !t[session.worldX[i] + session.worldY[i] * 1000]) rocks++;
  assert.ok(rocks > 50000, `a rock field's pixel is no massif (${rocks} of them unmarked)`);
  assert.ok(WOD_MOUNTAIN_PREFAB.test('WOD_Mountain_02r3') && !WOD_MOUNTAIN_PREFAB.test('WOD_Rocks_Large_00'));
});

/** A little world: open ground, the sea nowhere, a massif's block of pixels straight between the two ends. */
function massifWorld() {
  const W = 60, H = 30;
  const rocks = new Uint8Array(W * H);
  for (let y = 5; y <= 25; y++) for (let x = 28; x <= 31; x++) rocks[x + y * W] = 1;
  const g = routeGround(() => 231, () => 60, 2, W, H);
  return { W, H, rocks, g };
}

test('OW-WOD-PATH, then MOUNTAINS WALKABLE (the owner, the Wrothgarian zone\'s merge): a massif refuses no step any more - handed to the ground or not, the route walks straight through it (it went round, never an open step into its pixels), and none of its pixels is a peak; a road laid through it is walked; a traveller among its rocks walks out', () => {
  const { W, H, rocks, g } = massifWorld();
  const from = { x: 20, y: 15 }, to = { x: 40, y: 15 };
  const base = { width: W, height: H, ...g };
  const straight = planRoute(from, to, base);
  assert.ok(straight.pixels.some((p) => rocks[p.x + p.y * W]), 'without the massifs the route walks through them');
  g.setRocks(rocks);
  const through = planRoute(from, to, { width: W, height: H, ...g });
  assert.deepEqual(through.pixels, straight.pixels, 'MOUNTAINS WALKABLE: the massifs handed - the same route, straight through them');
  assert.ok(!g.peakAt(29, 15) && !g.peakAt(20, 15), 'MOUNTAINS WALKABLE: a massif\'s pixel is no peak (the spot there is walked to)');
  // a road laid straight through is walked (the mod stands no site on a path's pixel - the host drops those)
  const roads = new Uint8Array(W * H);
  for (let x = 20; x < 40; x++) { roads[x + 15 * W] |= DIR_DELTA.find(([, dx, dy]) => dx === 1 && dy === 0)[0]; roads[x + 1 + 15 * W] |= DIR_DELTA.find(([, dx, dy]) => dx === -1 && dy === 0)[0]; }
  const byRoad = planRoute(from, to, { width: W, height: H, roads, ...g });
  assert.ok(byRoad.kinds.every((k) => k === 'road'), 'the road through the pass');
  // standing among the rocks: out
  const out = planRoute({ x: 29, y: 15 }, { x: 20, y: 15 }, { width: W, height: H, ...g });
  assert.ok(out, 'the traveller in the massif walks out of it');
  g.setRocks(null);
  assert.deepEqual(planRoute(from, to, { width: W, height: H, ...g }).pixels, straight.pixels, 'the table taken away: the same route');
});

test('OW-WOD-PATH: the host hands its planner the massifs less every pixel a road or a track crosses, again when the list, the roads or the open zone change (MOUNTAINS WALKABLE: the planner walks them now - above); a spot the ground names a peak is refused', () => {
  const w = rd('src/scenes/world.js');
  // PIN MOVED (WILD1): no World of Daggerfall, no list - and the open zone's mask kept beside the list and the roads
  assert.match(w, /const src = wod \? wod\.mountainPixels\(\) : null;/);
  assert.match(w, /if \(src === _tvRocksFrom && net === _tvRocksRoads && wm === _tvRocksMask && _tvRocks\) return _tvRocks;/, 'kept for the list, the roads and the zone it was read with');
  assert.match(w, /const onRoad = \(i\) => \(\(net\?\.roads\?\.\[i\] \?\? 0\) \| \(net\?\.tracks\?\.\[i\] \?\? 0\)\);\n\s*if \(src\) for \(let i = 0; i < n; i\+\+\) if \(src\[i\] && !onRoad\(i\)\) out\[i\] = 1;/, 'a path\'s pixel is no massif');
  // PIN MOVED (TV-BEYOND): the ground past the Bay handed in before the massifs (routeGround's `beyond`)
  assert.match(w, /WATER_BYTE, 1000, 500, \(x, y\) => !tvWater\(x, y\)\)\)\.setRocks\(tvWodRocks\(\)\);[^\n]*\n\s*return _tvRouteGround;\n {2}\};/);
  assert.match(w, /if \(!door && !water && tvRouteGround\(\)\.peakAt\(pix\.x, pix\.y\)\) \{ tvSay\(TRAVEL_VIEW_TEXT\.mountains\); return false; \}/);
});

// ── OW-TOWN-RING ────────────────────────────────────────────────────────

/** A town's rects at a pixel whose origin is (0, 0): the tile rect 40..88 on both axes, a city's border. */
const TOWN = locationRectsOf(0, 0, { x: 40, y: 40, width: 48, height: 48 }, true);
const MID = { x: 16384, z: 16384 };
const inBand = (p) => {
  const L = TOWN.locationRect, B = TOWN.locationBorderRect;
  const inB = p.x >= B.xMin && p.x <= B.xMax && p.z >= B.zMin && p.z <= B.zMax;
  const inL = p.x > L.xMin && p.x < L.xMax && p.z > L.zMin && p.z < L.zMax;
  return inB && !inL;
};

test('OW-TOWN-RING: the ring a route walks - in on the side it arrives from, round the shorter way corner by corner, out on the side it leaves by; every point in the border band, never inside the town', () => {
  // the compass: map Y runs south
  assert.deepEqual([ringSideOf(0, -1), ringSideOf(1, -1), ringSideOf(1, 0), ringSideOf(1, 1), ringSideOf(0, 1), ringSideOf(-1, 1), ringSideOf(-1, 0), ringSideOf(-1, -1)], RING_ORDER);
  const sides = (from, to) => ringPassPoints(TOWN.locationRect, TOWN.locationBorderRect, from, to, MID);
  // Daggerfall's own byte (207,213): N|SE|W - a route in from the north and out to the south-east
  const ns = sides([0, -1], [1, 1]);
  assert.equal(ns.length, 3, 'north side, the north-east corner, the south-east corner');
  assert.ok(ns[0].z > TOWN.locationRect.zMax && ns[1].x > TOWN.locationRect.xMax && ns[2].z < TOWN.locationRect.zMin, 'n, ne, se');
  // straight through, west to east: round the north (the tie goes clockwise)
  const we = sides([-1, 0], [1, 0]);
  assert.equal(we.length, 4);
  assert.ok(we[0].x < TOWN.locationRect.xMin && we[3].x > TOWN.locationRect.xMax, 'in on the west, out on the east');
  assert.ok(we[1].z > TOWN.locationRect.zMax && we[2].z > TOWN.locationRect.zMax, 'the two northern corners between');
  // out the way it came: one point
  assert.equal(sides([0, 1], [0, 1]).length, 1);
  for (const [f, t] of [[[0, -1], [1, 1]], [[-1, 0], [1, 0]], [[1, -1], [-1, 1]], [[0, 1], [-1, 0]], [[1, 0], [0, -1]]]) {
    for (const p of sides(f, t)) assert.ok(inBand(p), `${f} -> ${t}: ${p.x},${p.z} in the ring`);
  }
  // a side's point sits on the road's line (the pixel's middle), where the road meets the ring
  assert.equal(we[0].z, MID.z);
});

test('OW-TOWN-RING: a route through a town\'s pixel walks its ring - no leg aimed at the town, the run before it ending before it, the town\'s own pixel the place\'s arrival when it is the end', () => {
  // a road east along row 10 through a town at (5, 10)
  const pixels = []; for (let x = 0; x <= 10; x++) pixels.push({ x, y: 10 });
  const kinds = pixels.slice(1).map(() => 'road');
  const asked = [];
  const ringAt = (x, y, from, to) => { asked.push([x, y, from, to]); return x === 5 && y === 10 ? ringPassPoints(TOWN.locationRect, TOWN.locationBorderRect, from, to, MID) : null; };
  const legs = routeLegs(pixels, kinds, { ringAt });
  const ring = legs.filter((l) => l.ring);
  assert.equal(ring.length, 4, 'the ring\'s four points, west to east round the north');
  assert.ok(ring.every((l) => l.x === 5 && l.y === 10 && l.at && l.kind === 'road'), 'each aimed at its own point in the town\'s pixel, on the road\'s kind');
  assert.ok(!legs.some((l) => l.x === 5 && !l.ring), 'no leg aimed at the town\'s middle');
  const i = legs.indexOf(ring[0]);
  assert.deepEqual([legs[i - 1].x, legs[i - 1].y], [4, 10], 'the run before it ends at the pixel before the town');
  assert.deepEqual([legs.at(-1).x, legs.at(-1).y, legs.at(-1).ring], [10, 10, undefined], 'and the road after it runs on to the end');
  assert.deepEqual(asked.find((a) => a[0] === 5), [5, 10, [-1, 0], [1, 0]], 'asked with the steps toward the pixels either side');
  assert.ok(!asked.some((a) => a[0] === 10), 'never the route\'s last pixel - the place itself is arrived at');
  // no ring: the fold as it always was
  assert.deepEqual(routeLegs(pixels, kinds), routeLegs(pixels, kinds, { ringAt: () => null }));
});

test('OW-TOWN-RING: the host rings every location on the way (the build\'s own tile rect, from the blocks when the pixel is not built), and Travel Options walks the ring point to point - no ring point skipped on a resume, none taken for a road join', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const legs = routeLegs\(plan\.pixels, plan\.kinds, \{ ringAt: tvRingAt \}\);/);
  assert.match(w, /const r = built\.get\(key\)\?\.locationRect \?\? setLocationTiles\(loc, maps, blocks, new Uint8Array\(128 \* 128\)\);/, 'the build\'s rect, or the same law over the location\'s blocks');
  assert.match(w, /rects = locationRectsOf\(o\.x, o\.z, \{ x: r\.xMin, y: r\.yMin, width: r\.xMax - r\.xMin, height: r\.yMax - r\.yMin \}, loc\.mapTableData\.locationType === LOCATION_TYPES\.TownCity, hasCustomLocationPosition\(loc\)\);/, 'Travel Options\' own rects');
  const t = rd('src/systems/travelOptions.js');
  assert.match(t, /\.\.\.\(l\.ring \? \{ ring: true \} : \{\}\)/, 'the journey keeps the mark');
  assert.match(t, /if \(cur && !cur\.ring && cur\.x === mp\.x && cur\.y === mp\.y\) best = r\.i \+ 1;/, 'standing in the town\'s pixel skips no ring point');
  assert.match(t, /if \(r\.legs\[best\]\?\.at && !r\.legs\[best\]\.ring && best \+ 1 < r\.legs\.length\) best\+\+;/, 'a ring point is no join');
  assert.match(t, /if \(!leg \|\| !prev \|\| leg\.kind === 'open' \|\| leg\.ring \|\| prev\.ring\) return null;/, 'and no road lane is rejoined between ring points');
  assert.match(t, /: leg\.at \? spotRect\(leg\.at\) :/, 'each leg with its own point is aimed at that point');
});

test('WOD-PEAKS: with the Mountains switch off (the default) a Mountains instance is no prefab - its pick stands nothing and levels nothing; on, it stands as the mod has it; a flip is a new world', async () => {
  const prefabs = new Map([['WOD_Mountain_01r1', { width: 4, height: 4, obj: [] }], ['WOD_Rocks_Large_00', { width: 4, height: 4, obj: [] }]]);
  const asked = [];
  const mk = (mountains) => {
    const w = Object.create(WodWorld.prototype);
    w.mountains = mountains; w.prefabs = prefabs; w.session = new LocationSession();
    return w;
  };
  // the pick's prefab door, as picksFor hands it to pickLocations
  const src = readFileSync(new URL('../src/world/worldOfDaggerfall.js', import.meta.url), 'utf8');
  assert.match(src, /const prefabOf = this\.mountains \? \(name\) => this\.prefabs\.get\(name\) \?\? null : \(name\) => \(WOD_MOUNTAIN_PREFAB\.test\(name \?\? ''\) \? null : this\.prefabs\.get\(name\) \?\? null\);\n\s*return pickLocations\(tile, session, prefabOf, pathsPoint, siteClear\)/);
  const body = src.slice(src.indexOf('const prefabOf = '), src.indexOf('return pickLocations(tile, session, prefabOf'));
  for (const on of [false, true]) {
    const w = mk(on);
    const prefabOf = new Function('WOD_MOUNTAIN_PREFAB', `${body}; return prefabOf;`).call(w, WOD_MOUNTAIN_PREFAB);
    asked.push([on, prefabOf('WOD_Mountain_01r1') != null, prefabOf('WOD_Rocks_Large_00') != null]);
  }
  assert.deepEqual(asked, [[false, false, true], [true, true, true]], 'off: the spires are no prefab, the rock fields stand; on: both');
  assert.match(src, /export function openWodWorld\(\{ online = false, sources = browserWodSources, mountains = wodMountainsOn\(\) \} = \{\}\) \{\n\s*if \(!_world \|\| _world\.online !== online \|\| _world\.mountains !== !!mountains\)/, 'the world is built for the switch it was opened with');
  const lane = readFileSync(new URL('../src/systems/onlineLane.js', import.meta.url), 'utf8');
  assert.match(lane, /'world-of-daggerfall': Object\.freeze\(\{ Enabled: true, Mountains: false \}\)/, 'online the room\'s - off');
});

test('ROCK-SEAT: a rock field\'s piece set into the ground but hanging over ground that falls away under it is lowered until its foot is WOD_ROCK_SEAT_M under the lowest ground beneath it - one already in the ground, or resting on another\'s crown, keeps the mod\'s height, and none is raised', async () => {
  const { rockSeatDrop, WOD_ROCK_SEAT_M } = await import('../src/world/wodLocationObjects.js');
  assert.equal(WOD_ROCK_SEAT_M, 0.5);
  assert.equal(rockSeatDrop(100, 40), 0, 'its foot 60 under the lowest ground: in the ground, untouched');
  assert.equal(rockSeatDrop(100, 99.5), 0, 'exactly the seat under it: untouched');
  assert.equal(rockSeatDrop(20, 40), -20.5, 'the slope falls 20 under its foot: lowered 20.5');
  assert.ok(rockSeatDrop(20, 40) < 0 && rockSeatDrop(-5, 10) === -15.5, 'never raised, whatever the ground');
  assert.equal(rockSeatDrop(NaN, 10), 0, 'no ground read: untouched');
  const W = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(W, /if \(rockPick\(m\.pick\) && box\[1\] < surfaceHeightAt\(samples, [^\n]*\)\) \{ const dy = rockSeatDrop\(lowestGroundUnder\(samples, box\), box\[1\]\); if \(dy < 0\) \{ m\.matrix\[13\] \+= dy; box\[1\] \+= dy; box\[4\] \+= dy; \} \}/, 'the rock fields\' pieces set into the ground (foot under the ground at its middle) are seated, collider and all, before the roads and the gate ask of their box');
  const at = W.indexOf('rockSeatDrop(lowestGroundUnder');
  assert.ok(at > 0 && at < W.indexOf('if (boxNearPath(_roadsNow, px, py, box[0]', at), 'before the roads ask');
});
