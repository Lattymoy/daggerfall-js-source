// GATE-CLEAR (2026-09-28, Mac: "the gate can spawn inside the rock geometry from world of daggerfall"; the field, on
// Discord: "gate under the rock didnt go away stayed there") - World of Daggerfall's rock keeps off the Oblivion Gate.
// The gate's spot is the clock's and the map files' alone (every client rolls it alike), and the mod stands a site on
// 114,087 of the pixels the gate may take; nothing kept the two apart. world/gateClearance.js is the law, ROADS-CLEAR's
// shape: a whole site reaching the clearing is refused at its pick, any other piece reaching it is not stood, and the
// streamer's sweep builds a pixel again when the gate the clock is about turns.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  gateClearFor, gatePointIn, ritePointIn, boxNearGate, pointNearGate, wodSiteOffGate, gateSiteTest, reachNearGate, createGateClearSweep,
  GATE_CLEAR_M, WOD_FLAT_GATE_CLEAR_M, GATE_REACH_STRIDE, RITE_CLEAR_M,
} from '../src/world/gateClearance.js';
import { riteLocalOf } from '../src/net/gateRite.js';
import { RITE_TENT_R, RITE_BRAZIER_R, RITE_FIRE_R } from '../src/world/riteModel.js';
import { wodPiecewise, WOD_SITE_OBJECT_RADIUS_M } from '../src/world/roadClearance.js';
import { PIXEL_M, gateSpotLocal, GATE_SPOT_SPREAD_M } from '../src/net/gateLaw.js';
import { PLINTH_R } from '../src/world/gateModel.js';
import { GATE_LANDING_M } from '../src/world/gateArena.js';
import { CAGE_R, BROKER_BOX_HX, BROKER_BOX_HZ } from '../src/scenes/sigilBrokerPool.js';   // BROKER-CAGE: she stands caged at the faithful's circle
import { LocationSession, pickLocations } from '../src/world/wodLocationLoader.js';
import { decodeRegionPack } from '../src/world/wodLocationPack.js';
import { loadLocationPrefab } from '../src/world/wodLocationData.js';
import { pathsDataPoint } from '../src/systems/travelPaths.js';
import { wodSiteClear } from '../src/world/roadClearance.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const site = (day, px, py, x, z) => ({ day, px, py, spot: [x, z] });

test('GATE-CLEAR: the clearing holds the gate and its way home (BROKER-CAGE: the Broker\'s cage the circle\'s), and is a gate site\'s pixel and spot', () => {
  assert.equal(GATE_CLEAR_M, 24);
  assert.ok(GATE_CLEAR_M >= PLINTH_R * 2, 'twice the plinth at least');
  assert.ok(GATE_CLEAR_M > GATE_LANDING_M + 8, 'the way home lands on open ground');
  assert.ok(RITE_CLEAR_M > CAGE_R + Math.hypot(BROKER_BOX_HX, BROKER_BOX_HZ) + 4, 'BROKER-CAGE: the Broker\'s cage stands in the circle\'s clearing, clear of any rock');
  const c = gateClearFor(site(538, 412, 207, 300.5, 511.25));
  const [rx, rz] = riteLocalOf(538);
  assert.deepEqual({ ...c }, { key: '538:412,207', day: 538, px: 412, py: 207, x: 300.5, z: 511.25, rx, rz }, 'AUDIT WB12d (G12): and the faithful\'s circle');
  assert.ok(Object.isFrozen(c));
  assert.equal(gateClearFor(null), null);
  assert.equal(gateClearFor({ day: 1, px: 3, py: 4, spot: [NaN, 1] }), null);
  assert.equal(gateClearFor({ day: 1, px: 3.5, py: 4, spot: [1, 1] }), null);
  assert.equal(gateClearFor(site(538, 412, 207, 300.5, 511.25)).key, c.key, 'one site, one key: a pixel remembers what it was built against');
});

test('GATE-CLEAR: the gate\'s foot in another pixel\'s frame - east by the columns, NORTH by the rows above (py - 1)', () => {
  const c = gateClearFor(site(7, 500, 200, 100, 700));
  assert.deepEqual(gatePointIn(c, 500, 200), [100, 700], 'its own pixel: the spot');
  assert.deepEqual(gatePointIn(c, 499, 200), [PIXEL_M + 100, 700], 'from the pixel west of it, one pixel east');
  assert.deepEqual(gatePointIn(c, 500, 201), [100, PIXEL_M + 700], 'from the pixel SOUTH of it (the row below), one pixel north');
  assert.deepEqual(gatePointIn(c, 500, 199), [100, 700 - PIXEL_M], 'from the pixel north of it, one pixel south');
});

test('GATE-CLEAR: a box is near by its nearest point on the ground, the margin grows the clearing, and no gate keeps nothing off', () => {
  const c = gateClearFor(site(7, 500, 200, 400, 400));
  assert.equal(pointNearGate(c, 500, 200, 400 + 23.9, 400), true);
  assert.equal(pointNearGate(c, 500, 200, 400 + 24.1, 400), false);
  assert.equal(pointNearGate(c, 500, 200, 400 + 24.1, 400, 2), true, 'a flat\'s margin');
  assert.equal(pointNearGate(c, 500, 200, 400 + 16.9, 400 + 16.9), true, '23.9 m off on the diagonal');
  assert.equal(pointNearGate(c, 500, 200, 400 + 17, 400 + 17), false, '24.04 m off on the diagonal: a round clearing, not a square one');
  assert.equal(boxNearGate(c, 500, 200, 300, 390, 500, 410), true, 'a boulder straddling the gate');
  assert.equal(boxNearGate(c, 500, 200, 425, 350, 450, 450), false, 'its near face 25 m off');
  assert.equal(boxNearGate(c, 500, 200, 423, 350, 450, 450), true, 'its near face 23 m off');
  assert.equal(boxNearGate(c, 500, 200, 380, 380, 390, 390, 1e9), true);
  // a mountain's piece in the NEXT pixel east, reaching back over the edge toward a gate 5 m from it
  const edge = gateClearFor(site(7, 500, 200, PIXEL_M - 5, 400));
  assert.equal(boxNearGate(edge, 501, 200, 10, 380, 60, 420), true, 'from pixel 501 the gate stands at x = -5; the box starts 15 m off');
  assert.equal(boxNearGate(edge, 501, 200, 20, 380, 60, 420), false, '25 m off');
  assert.equal(boxNearGate(null, 500, 200, 0, 0, PIXEL_M, PIXEL_M), false, 'offline, or before the scan: the mod exactly');
});

test('AUDIT WB12d (G12): the faithful\'s circle keeps its own clearing - its braziers, its tents and its fire - in the gate\'s pixel by the day\'s law, every frame reading it as the gate\'s foot is read; a whole site reaching it refused, a box kept off it (mutants: no clearing at the circle; the circle in the gate\'s frame turned; too small for its tents)', () => {
  assert.equal(RITE_CLEAR_M, 20);
  assert.ok(RITE_CLEAR_M >= RITE_TENT_R + 3 && RITE_CLEAR_M > RITE_FIRE_R + 3 && RITE_CLEAR_M > RITE_BRAZIER_R + 8, 'its tents stand clear of any rock');
  const day = 7, c = gateClearFor(site(day, 500, 200, ...gateSpotLocal(day)));
  const [rx, rz] = riteLocalOf(day);
  assert.deepEqual(ritePointIn(c, 500, 200), [rx, rz], 'its own pixel: the law\'s point');
  assert.deepEqual(ritePointIn(c, 499, 201), [PIXEL_M + rx, PIXEL_M + rz], 'from the pixel south-west of it, east and north by a pixel');
  assert.equal(pointNearGate(c, 500, 200, rx + RITE_CLEAR_M - 0.1, rz), true);
  assert.equal(pointNearGate(c, 500, 200, rx + RITE_CLEAR_M + 0.1, rz), false);
  assert.equal(pointNearGate(c, 500, 200, rx + RITE_CLEAR_M + 0.1, rz, 0.5), true, 'its margin');
  assert.equal(boxNearGate(c, 499, 200, PIXEL_M + rx + 5, rz - 30, PIXEL_M + rx + 9, rz + 30), true, 'a box across it, from the pixel west');
  assert.ok(Math.hypot(rx - c.x, rz - c.z) > GATE_CLEAR_M + RITE_CLEAR_M, 'two clearings, never one');
  const prefab = { obj: [{ pos: { x: 3, z: 3 } }] };
  assert.equal(wodSiteOffGate(c, 500, 200, 'WOD_Camp_01', prefab, { x: Math.floor((rx - 3) / 6.4), y: Math.floor((rz - 3) / 6.4) }), false, 'a camp on the circle refused at its pick');
  assert.equal(gateClearFor({ day: 'x', px: 1, py: 2, spot: [1, 1] }).rx, NaN, 'no day, no circle');
  assert.equal(pointNearGate(gateClearFor({ day: 'x', px: 1, py: 2, spot: [100, 100] }), 1, 2, 400, 400), false);
});

test('GATE-CLEAR: a whole site reaching the clearing is refused at its pick - a continue, so a later instance takes the pixel; a rock field answers piece by piece; the ledger says what it cost and what stood', () => {
  const camp = { width: 2, height: 2, obj: [{ pos: { x: 0, y: 0, z: 0 } }, { pos: { x: 30, y: 0, z: 0 } }] };
  // tile 40, 64 is (256, 409.6) m; the second object 30 m east of it, at (286, 409.6)
  const near = gateClearFor(site(9, 500, 200, 286 + GATE_CLEAR_M + WOD_SITE_OBJECT_RADIUS_M - 1, 409.6));
  const far = gateClearFor(site(9, 500, 200, 286 + GATE_CLEAR_M + WOD_SITE_OBJECT_RADIUS_M + 1, 409.6));
  const rect = { x: 40, y: 64, width: 2, height: 2 };
  assert.equal(wodSiteOffGate(near, 500, 200, 'WOD_BanditCamp_01', camp, rect), false, 'an object inside the clearing and the site margin');
  assert.equal(wodSiteOffGate(far, 500, 200, 'WOD_BanditCamp_01', camp, rect), true);
  assert.equal(wodSiteOffGate(near, 500, 200, 'WOD_Rocks_Large_04r1', camp, rect), true, 'a rock field is asked piece by piece, with its meshes, at placement');
  assert.equal(wodSiteOffGate(null, 500, 200, 'WOD_BanditCamp_01', camp, rect), true);
  // the pick, through the host's own composition: the road first, then the gate
  const session = new LocationSession();
  session.appendRegion(1, {
    count: 2, worldX: [500, 500], worldY: [200, 200], terrainX: [40, 90], terrainY: [64, 64], type: [2, 2], locationID: [1, 2],
    name: ['a', 'b'], prefab: ['WOD_BanditCamp_01', 'WOD_BanditCamp_01'],
  });
  const tile = { mapPixelX: 500, mapPixelY: 200, hasLocation: false, mapRegionIndex: -1, worldHeight: 10 };
  const get = () => camp;
  const pick = (clear, ledger) => pickLocations(tile, session, get, null, (n, pf, r) => wodSiteClear(null, 500, 200, n, pf, r) && gateSiteTest(clear, 500, 200, ledger)(n, pf, r)).map((p) => p.index);
  const none = { refused: false, reach: [] };
  assert.deepEqual(pick(null, none), [0], 'no gate: the mod exactly - the first instance takes the pixel');
  assert.deepEqual(none, { refused: false, reach: [256, 409.6, 256, 409.6, WOD_SITE_OBJECT_RADIUS_M, 286, 409.6, 286, 409.6, WOD_SITE_OBJECT_RADIUS_M] }, 'what stood is in the reach, at the site\'s margin');
  const ledger = { refused: false, reach: [] };
  assert.deepEqual(pick(near, ledger), [1], 'the first reaches the gate, so the second stands');
  assert.equal(ledger.refused, true, 'and the pixel remembers the gate cost it a site');
  assert.deepEqual(ledger.reach, [576, 409.6, 576, 409.6, WOD_SITE_OBJECT_RADIUS_M, 606, 409.6, 606, 409.6, WOD_SITE_OBJECT_RADIUS_M]);
  const rocks = { refused: false, reach: [] };
  assert.equal(gateSiteTest(near, 500, 200, rocks)('WOD_Rocks_Large_00', camp, rect), true);
  assert.deepEqual(rocks, { refused: false, reach: [] }, 'a rock field\'s pieces go in the reach at placement, by their own boxes');
});

test('GATE-CLEAR: the sweep asks exactly what the pick and the placement ask - each stride of the reach is boxNearGate at its own margin', () => {
  let seed = 0x6a7e;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  let near = 0, far = 0;
  for (let i = 0; i < 4000; i++) {
    const c = gateClearFor(site(i, 500 + Math.floor(rnd() * 3), 200 + Math.floor(rnd() * 3), rnd() * PIXEL_M, rnd() * PIXEL_M));
    const [gx, gz] = gatePointIn(c, 501, 201);   // boxes about the gate's foot, so both answers come often
    const x0 = gx + (rnd() - 0.5) * 120, z0 = gz + (rnd() - 0.5) * 120, x1 = x0 + rnd() * 30, z1 = z0 + rnd() * 30;
    const margin = [0, WOD_FLAT_GATE_CLEAR_M, WOD_SITE_OBJECT_RADIUS_M][i % 3];
    const want = boxNearGate(c, 501, 201, x0, z0, x1, z1, margin);
    assert.equal(reachNearGate(Float32Array.from([x0, z0, x1, z1, margin]), c, 501, 201), boxNearGate(c, 501, 201, Math.fround(x0), Math.fround(z0), Math.fround(x1), Math.fround(z1), Math.fround(margin)));
    assert.equal(reachNearGate([1e6, 1e6, 1e6, 1e6, 0, x0, z0, x1, z1, margin], c, 501, 201), want, 'any stride of many');
    if (want) near++; else far++;
  }
  assert.ok(near > 20 && far > 20, `both answers driven: ${near} near, ${far} far`);
  assert.equal(GATE_REACH_STRIDE, 5);
  assert.equal(reachNearGate(null, gateClearFor(site(1, 1, 1, 1, 1)), 1, 1), false);
  assert.equal(reachNearGate([0, 0, 1e4, 1e4, 0], null, 1, 1), false);
});

test('GATE-CLEAR: the sweep - the turn asks every built pixel once; one the old clearing cost, or one standing a piece in the new clearing, is built again; any other is marked current; one building at the turn is asked as it publishes', () => {
  const A = gateClearFor(site(538, 500, 200, 400, 400));
  const B = gateClearFor(site(539, 600, 100, 100, 100));
  const px = (x, y, over) => ({ px: x, py: y, gateClearKey: null, gateRefused: false, wodReach: null, ...over });
  const built = new Map([
    ['500,200', px(500, 200, { wodReach: Float32Array.from([395, 395, 405, 405, 0]) })],   // a boulder where A rises
    ['501,200', px(501, 200, { wodReach: Float32Array.from([300, 300, 310, 310, 0]) })],   // nothing near A
    ['502,200', px(502, 200)],                                                           // no site at all
  ]);
  const sweep = createGateClearSweep();
  assert.deepEqual(sweep.step(null, built), [], 'no gate yet: nothing to do');
  assert.deepEqual(sweep.state(), { swept: null, due: 0 });
  // the clock turns to A: the boulder's pixel is built again, the others are marked current
  assert.deepEqual(sweep.step(A, built).map((p) => `${p.px},${p.py}`), ['500,200']);
  assert.equal(built.get('501,200').gateClearKey, A.key);
  assert.equal(built.get('502,200').gateClearKey, A.key);
  assert.equal(built.get('500,200').gateClearKey, null, 'the one to build again keeps its old key until it stands again');
  assert.deepEqual(sweep.step(A, built), [], 'asked once a turn');
  // it stands again against A, the boulder refused
  built.set('500,200', px(500, 200, { gateClearKey: A.key, gateRefused: true, wodReach: null }));
  sweep.published('500,200', A.key);
  assert.deepEqual(sweep.step(A, built), [], 'built against the clearing the sweep holds: nothing to ask');
  // a pixel that began building before the turn to B and publishes after it: asked as it publishes
  const late = new Map(built);
  // the turn to B: the pixel A cost a boulder gets it back; the rest are marked current
  assert.deepEqual(sweep.step(B, built).map((p) => `${p.px},${p.py}`), ['500,200'], 'the old clearing\'s rock comes back');
  late.set('503,200', px(503, 200, { gateClearKey: A.key, gateRefused: true }));
  sweep.published('503,200', A.key);
  assert.equal(sweep.state().due, 1);
  assert.deepEqual(sweep.step(B, late).map((p) => `${p.px},${p.py}`), ['503,200'], 'built on the clearing before the turn, asked once it stands');
  sweep.published('504,200', B.key);
  assert.equal(sweep.state().due, 0, 'built on the clearing the sweep holds: not asked');
  // a pixel torn down before its turn came is dropped - its fresh build reads the clearing then
  sweep.published('505,200', A.key);
  assert.equal(sweep.state().due, 1);
  assert.deepEqual(sweep.step(B, new Map()), []);
  assert.equal(sweep.state().due, 0);
  // the turn to NO gate (offline, or the scan lost): every pixel a clearing cost is built again, whole
  const off = new Map([['1,1', px(1, 1, { gateClearKey: B.key, gateRefused: true })], ['2,2', px(2, 2, { gateClearKey: B.key })]]);
  const sweep2 = createGateClearSweep();
  sweep2.step(B, new Map());
  assert.deepEqual(sweep2.step(null, off).map((p) => `${p.px},${p.py}`), ['1,1']);
  assert.equal(off.get('2,2').gateClearKey, null);
});

test('GATE-CLEAR over the shipped lists: a gate\'s spot DOES land in the mod\'s rock, and the clearing leaves nothing the mod stands within it', () => {
  const V = join(ROOT, 'vendor/world-of-daggerfall');
  const rb = (n) => new Uint8Array(readFileSync(join(ROOT, 'vendor/roads-hazelnut', n)));
  const net = { roads: rb('roadData.bytes'), tracks: rb('trackData.bytes') };
  const prefabs = new Map();
  for (const f of readdirSync(join(V, 'LocationPrefab'))) prefabs.set(f.replace(/\.txt$/, ''), loadLocationPrefab(readFileSync(join(V, 'LocationPrefab', f), 'utf8')));
  const session = new LocationSession();
  // the room's order (world/worldOfDaggerfall.js): 17 first, then ascending - the gate is online's alone
  const regions = readdirSync(join(V, 'Locations')).map((f) => [parseInt(f, 10), f]).sort((a, b) => (a[0] === 17 ? -1 : b[0] === 17 ? 1 : a[0] - b[0]));
  for (const [r, f] of regions) session.appendRegion(r, decodeRegionPack(new Uint8Array(readFileSync(join(V, 'Locations', f)))));
  const pixels = [];
  const seen = new Set();
  for (let i = 0; i < session.count; i++) { const k = session.worldX[i] + session.worldY[i] * 1000; if (!seen.has(k)) { seen.add(k); pixels.push([session.worldX[i], session.worldY[i]]); } }
  const getPrefab = (n) => prefabs.get(n) ?? null;
  const paths = (a, b) => pathsDataPoint(net, a, b);
  const tile = (x, y) => ({ mapPixelX: x, mapPixelY: y, hasLocation: false, mapRegionIndex: -1, worldHeight: 10 });
  // what stands within the clearing of a gate on (x, y): every stood object's own position (a mesh box holds its
  // position, so a position inside the clearing is a piece the placement refuses) - the pixel's own sites only
  const within = (x, y, clear, siteClear) => {
    let n = 0;
    for (const p of pickLocations(tile(x, y), session, getPrefab, paths, siteClear)) {
      for (const o of p.prefab.obj) {
        if (Math.abs(o.pos.y) > 1000) continue;   // the mountains' inert giant, 83 km down
        const lx = p.rect.x * 6.4 + o.pos.x, lz = p.rect.y * 6.4 + o.pos.z;
        if (pointNearGate(clear, x, y, lx, lz, 0)) n++;
      }
    }
    return n;
  };
  // the gate's own spots, day by day (net/gateLaw.js gateSpotLocal), laid on the pixels the lists name
  let spots = 0, hit = 0, refused = 0, left = 0, leftWhole = 0;
  for (let day = 0; day < 6000; day++) {
    const [x, y] = pixels[(day * 7919) % pixels.length];
    const spot = gateSpotLocal(day);
    assert.ok(Math.hypot(spot[0] - PIXEL_M / 2, spot[1] - PIXEL_M / 2) <= GATE_SPOT_SPREAD_M + 1e-9);
    const clear = gateClearFor({ day, px: x, py: y, spot });
    spots++;
    const before = within(x, y, clear, null);
    if (before) hit++;
    // the port: the pick's gate test beside the road's, then each piece's own - a whole site's objects stand or go together
    const ledger = { refused: false, reach: [] };
    const siteClear = (n, pf, r) => wodSiteClear(net, x, y, n, pf, r) && gateSiteTest(clear, x, y, ledger)(n, pf, r);
    for (const p of pickLocations(tile(x, y), session, getPrefab, paths, siteClear)) {
      const whole = !wodPiecewise(session.prefab[p.index]);
      for (const o of p.prefab.obj) {
        if (Math.abs(o.pos.y) > 1000) continue;
        const lx = p.rect.x * 6.4 + o.pos.x, lz = p.rect.y * 6.4 + o.pos.z;
        if (!pointNearGate(clear, x, y, lx, lz, 0)) continue;
        if (whole) leftWhole++; else left++;   // a piece: the placement's own box test refuses it
      }
    }
    if (ledger.refused) refused++;
  }
  assert.ok(hit >= 150, `of ${spots} gate spots on the pixels the lists name, ${hit} stand within ${GATE_CLEAR_M} m of an object the mod stands`);
  assert.ok(refused > 0, `the pick refused a whole site on ${refused} of them`);
  assert.equal(leftWhole, 0, 'no camp, fort, shrine, ruin, cave or nature spot stands in the clearing once its pick is asked');
  assert.ok(left > 0, `the rock fields' and mountains' pieces are the placement's to refuse, box by box: ${left} such positions`);
});

test('GATE-CLEAR by source: the build reads the clearing once and asks it at the pick, of each piece and flat before it stands, and remembers what it cost; the sweep runs between builds; the clearing is the omen\'s own roll, online alone', () => {
  const w = rd('src/scenes/world.js');
  assert.equal(w.match(/_gateClearNow\(\)/g)?.length, 3, 'read by the build, by the sweep and by the hub\'s word of the site (DISCORD-GATES) - nowhere else');
  assert.match(w, /const gateClear = _gateClearNow\(\);\n\s*const gateLedger = \{ refused: false, reach: \[\] \};[^\n]*\n\s*const gateSite = gateSiteTest\(gateClear, px, py, gateLedger\);\n\s*if \(wod && await wodOpened\) \{/, 'read once, before the pick');
  assert.match(w, /\}, wodPathsPoint, \(name, prefab, rect\) => wodSiteClear\(terrainGen\.roads\(\), px, py, name, prefab, rect\) && gateSite\(name, prefab, rect\)\);/, 'the road asked first, then the gate');
  assert.match(w, /\{ _wodOffRoad\+\+; continue; \}\n(?:\s*\/\/[^\n]*\n)*\s*if \(boxNearGate\(gateClear, px, py, box\[0\], box\[2\], box\[3\], box\[5\]\)\) \{ gateLedger\.refused = true; _wodOffGate\+\+; continue; \}\n\s*gateLedger\.reach\.push\(box\[0\], box\[2\], box\[3\], box\[5\], 0\);\n\s*unionBox\(box\);/,
    'a piece whose mesh box reaches the clearing is refused before it joins the bounds, the batch or the collider - and what stands is kept');
  // PIN MOVED (VERGE1, 2026-10-07): the clear roadsides' ask may stand between the road's and the gate's - a road refusal too
  assert.match(w, /for \(const f of place\.flats\) \{\n[^\n]*_wodOffRoad\+\+; continue; \}[^\n]*\n(?:\s*\/\/[^\n]*\n|\s*if \(vergeNet && [^\n]*\{ _wodOffRoad\+\+; continue; \}\n)*\s*if \(pointNearGate\(gateClear, px, py, f\.base\[0\], f\.base\[2\], WOD_FLAT_GATE_CLEAR_M\)\) \{ gateLedger\.refused = true; _wodOffGate\+\+; continue; \}[^\n]*\n\s*gateLedger\.reach\.push\(f\.base\[0\], f\.base\[2\], f\.base\[0\], f\.base\[2\], WOD_FLAT_GATE_CLEAR_M\);\n\s*if \(f\.scale\.x === 1/,
    'a flat too, before it is added');
  assert.match(w, /gateClearKey: gateClear\?\.key \?\? null,[^\n]*\n\s*gateRefused: gateLedger\.refused,[^\n]*\n\s*wodReach: gateLedger\.reach\.length \? Float32Array\.from\(gateLedger\.reach\) : null,/);
  assert.match(w, /built\.set\(key, \{[\s\S]{0,9000}\n\s*for \(const pile of wodKept\.piles \?\? \[\]\) standWodPile\(key, wodLife, pile\);[^\n]*\n\s*gateClearSweep\.published\(key, gateClear\?\.key\);/, 'asked as it publishes');
  assert.match(w, /if \(_wodLate\.size && !building\) sweepWodLate\(\);[^\n]*\n\s*if \(!building\) sweepGateClear\(\);/, 'the sweep on the frame, between builds');
  assert.match(w, /function sweepGateClear\(\) \{\n\s*const clear = _gateClearNow\(\);\n\s*const again = gateClearSweep\.step\(clear, built\)\.map\(\(p\) => \(\{ px: p\.px, py: p\.py \}\)\);\n\s*if \(!again\.length\) return;\n[^\n]*\n[^\n]*_seasonHoldKey = under;\n\s*for \(const k of again\) destroyPixel\(k\.px, k\.py, \{ collectLoose: false \}\);[^\n]*\n\s*queue\.push\(\.\.\.again\.sort\(nearestFirstFrom\(state\.current\)\)\);/,
    'torn down and queued nearest first, the player held on a pixel built again under them - the late sweep\'s shape');
  assert.match(w, /let _gateClearNow = \(\) => null;/, 'offline, and until the gate\'s section installs it: the mod exactly');
  assert.match(w, /if \(gateOmen\) _gateClearNow = \(\) => \{\n\s*if \(!_gateScan\) return null;\n\s*const day = gateAt\(Date\.now\(\) \+ _sharedOffsetMs\)\.day;\n\s*if \(_gateClearOf\.day !== day\) \{\n\s*let site = null;\n\s*try \{ site = findGateSite\(day, _gateScan\); \}[^\n]*\n\s*_gateClearOf = \{ day, site, clear: gateClearFor\(site\) \};/,
    'the gate the relay\'s clock is about, on the omen\'s own scan and roll');
  assert.match(w, /site: \(day\) => \{\n\s*if \(!maps\) return null;\n\s*try \{ const scan = gateScanOf\(\); return scan \? findGateSite\(day, scan\) : null; \}/, 'the omen names the same site the clearing keeps');
  assert.ok(w.indexOf('let _gateClearNow = () => null;') < w.indexOf('async function buildPixelNow('), 'declared before the build that reads it');
});
