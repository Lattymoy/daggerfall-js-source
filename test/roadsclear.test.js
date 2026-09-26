// ROADS-CLEAR (2026-09-25, Mac: "Camps, mountains from WOD, shouldnt be placed on roads") - World of Daggerfall's
// sites and pieces, and the wilderness camps, stand off the painted road network. The mod's own test
// (LocationLoader.cs:146-151) asks only the site's own pixel for a road or track; the shipped layouts reach far
// past it (mountains ~1.9 km, large rock fields ~500 m: 41,349 of 114,087 sites spill into the next pixel), and a
// camp is pitched wherever its ring lands. world/roadClearance.js asks the footprint instead.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { segmentHitsRect, boxNearPath, pointNearPath, wodSiteClear, wodPiecewise, PATH_HALF_WIDTH, UNITS_PER_METRE, WOD_PIECE_ROAD_CLEAR } from '../src/world/roadClearance.js';
import { playerOnPath, pathsDataPoint, N, E, S, W, NE, MP_WORLD_UNITS, HALF_MP_WORLD_UNITS } from '../src/systems/travelPaths.js';
import { MAP_W, MAP_H } from '../src/world/roadNetwork.js';
import { LocationSession, pickLocations } from '../src/world/wodLocationLoader.js';
import { decodeRegionPack } from '../src/world/wodLocationPack.js';
import { loadLocationPrefab } from '../src/world/wodLocationData.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const netWith = (cells) => {
  const roads = new Uint8Array(MAP_W * MAP_H), tracks = new Uint8Array(MAP_W * MAP_H);
  for (const [x, y, bits, kind = 'roads'] of cells) (kind === 'tracks' ? tracks : roads)[x + y * MAP_W] = bits;
  return { roads, tracks };
};
const C = HALF_MP_WORLD_UNITS, P = MP_WORLD_UNITS;

test('ROADS-CLEAR: a segment crosses a box or it does not (Liang-Barsky), end points and grazes included', () => {
  assert.equal(segmentHitsRect(0, 0, 10, 10, 4, 4, 6, 6), true, 'through the middle');
  assert.equal(segmentHitsRect(0, 0, 10, 0, 4, 1, 6, 2), false, 'passes beside it');
  assert.equal(segmentHitsRect(0, 0, 10, 0, 4, -1, 6, 2), true, 'along it');
  assert.equal(segmentHitsRect(0, 0, 3, 3, 4, 4, 6, 6), false, 'stops short');
  assert.equal(segmentHitsRect(0, 0, 4, 4, 4, 4, 6, 6), true, 'touches its corner');
});

test('ROADS-CLEAR: the band is the network\'s own - the mod\'s on-path test for the four straight arms, point for point inside the pixel', () => {
  for (const bit of [N, E, S, W]) {
    const net = netWith([[500, 200, bit]]);
    let checked = 0;
    for (let x = 64; x < P; x += 512) {
      for (let z = 64; z < P; z += 512) {
        assert.equal(pointNearPath(net, 500, 200, x, z, 0), !!playerOnPath(bit, x, z), `bit ${bit} at ${x},${z}`);
        checked++;
      }
    }
    assert.equal(checked, 64 * 64);
  }
});

test('ROADS-CLEAR: a box reaching into the NEXT pixel meets that pixel\'s road; north is the row above; tracks count; the clearance grows the band', () => {
  // this pixel (500,200) bare; the pixel to the east carries a W arm - its band runs from its centre to the shared edge
  const east = netWith([[501, 200, W]]);
  assert.equal(boxNearPath(east, 500, 200, P - 4000, C - 100, P - 1000, C + 100), false, 'short of the edge: the W arm starts at the edge');
  assert.equal(boxNearPath(east, 500, 200, P - 4000, C - 100, P + 2000, C + 100), true, 'spilling over the edge onto the arm');
  assert.equal(boxNearPath(east, 500, 200, P - 4000, C + 2000, P + 2000, C + 2400), false, 'spilling over beside it');
  // the pixel to the NORTH is py - 1, and its S arm meets this pixel's north edge
  const north = netWith([[500, 199, S, 'tracks']]);
  assert.equal(boxNearPath(north, 500, 200, C - 50, P - 10, C + 50, P + 800), true, 'a track counts, one row up');
  assert.equal(boxNearPath(netWith([[500, 201, N]]), 500, 200, C - 50, P - 10, C + 50, P + 800), false, 'the row below is south, not north');
  // a diagonal arm
  const diag = netWith([[500, 200, NE]]);
  assert.equal(pointNearPath(diag, 500, 200, C + 5000, C + 5000, 0), true);
  assert.equal(pointNearPath(diag, 500, 200, C + 5000, C - 5000, 0), false);
  // clearance: a point just outside the band is on it once the clearance reaches it
  const straight = netWith([[500, 200, E]]);
  const off = PATH_HALF_WIDTH + 200;
  assert.equal(pointNearPath(straight, 500, 200, C + 8000, C + off, 0), false);
  assert.equal(pointNearPath(straight, 500, 200, C + 8000, C + off, 300), true);
  assert.equal(boxNearPath(null, 500, 200, 0, 0, P, P), false, 'no network yet: nothing is drawn to avoid');
});

test('ROADS-CLEAR: a whole WoD site whose pieces reach a road is refused, a terrain layout is left to its pieces, and a refused instance lets a later one take the pixel', () => {
  assert.equal(wodPiecewise('WOD_Rocks_Large_04r1'), true);
  assert.equal(wodPiecewise('WOD_Mountain_02r3'), true);
  assert.equal(wodPiecewise('WOD_Rocks_Cave_00'), false, 'the cave is a place, not a rock field');
  assert.equal(wodPiecewise('WOD_BanditCamp_03'), false);
  const camp = { width: 2, height: 2, obj: [{ pos: { x: 0, y: 0, z: 0 } }, { pos: { x: 30, y: 0, z: 0 } }] };
  const east = netWith([[501, 200, W]]);
  // tile 124 is 793.6 m in; the second piece at +30 m lands 4.4 m past the edge, on the east pixel's arm at the centre row
  const onEdge = { x: 124, y: 64, width: 2, height: 2 };
  assert.equal(wodSiteClear(east, 500, 200, 'WOD_BanditCamp_01', camp, onEdge), false);
  assert.equal(wodSiteClear(east, 500, 200, 'WOD_BanditCamp_01', camp, { ...onEdge, x: 40 }), true, 'the same camp further in');
  assert.equal(wodSiteClear(east, 500, 200, 'WOD_Rocks_Large_00', camp, onEdge), true, 'a rock field answers piece by piece at placement');
  assert.equal(wodSiteClear(null, 500, 200, 'WOD_BanditCamp_01', camp, onEdge), true, 'no network: the mod exactly');
  // pickLocations: the refusal is a `continue`, as the mod's own road test is
  const session = new LocationSession();
  session.appendRegion(1, {
    count: 2, worldX: [500, 500], worldY: [200, 200], terrainX: [124, 40], terrainY: [64, 64], type: [2, 2], locationID: [1, 2],
    name: ['a', 'b'], prefab: ['WOD_BanditCamp_01', 'WOD_BanditCamp_01'],
  });
  const tile = { mapPixelX: 500, mapPixelY: 200, hasLocation: false, mapRegionIndex: -1, worldHeight: 10 };
  const get = () => camp;
  assert.deepEqual(pickLocations(tile, session, get, null).map((p) => p.index), [0], 'the mod: the first instance takes the pixel');
  assert.deepEqual(pickLocations(tile, session, get, null, (n, pf, r) => wodSiteClear(east, 500, 200, n, pf, r)).map((p) => p.index), [1],
    'the port: the first reaches the road, so the second stands');
});

test('ROADS-CLEAR over the shipped lists and Basic Roads: WoD pieces DO land on roads, and every one is a rock field or mountain piece', () => {
  const V = join(ROOT, 'vendor/world-of-daggerfall');
  const rb = (n) => new Uint8Array(readFileSync(join(ROOT, 'vendor/roads-hazelnut', n)));
  const net = { roads: rb('roadData.bytes'), tracks: rb('trackData.bytes') };
  const prefabs = new Map();
  for (const f of readdirSync(join(V, 'LocationPrefab'))) prefabs.set(f.replace(/\.txt$/, ''), loadLocationPrefab(readFileSync(join(V, 'LocationPrefab', f), 'utf8')));
  const session = new LocationSession();
  for (const f of readdirSync(join(V, 'Locations')).sort((a, b) => parseInt(a, 10) - parseInt(b, 10))) session.appendRegion(parseInt(f, 10), decodeRegionPack(new Uint8Array(readFileSync(join(V, 'Locations', f)))));
  const pixels = new Map();
  for (let i = 0; i < session.count; i++) pixels.set(`${session.worldX[i]},${session.worldY[i]}`, [session.worldX[i], session.worldY[i]]);
  let near = 0, nearWhole = 0;
  for (const [, [x, y]] of pixels) {
    for (const p of pickLocations({ mapPixelX: x, mapPixelY: y, hasLocation: false, mapRegionIndex: -1, worldHeight: 10 }, session, (n) => prefabs.get(n) ?? null, (a, b) => pathsDataPoint(net, a, b))) {
      for (const o of p.prefab.obj) {
        if (Math.abs(o.pos.y) > 1000) continue;   // the mountains' inert giant, 83 km down (World-Of-Daggerfall.md B1)
        const lx = (p.rect.x * 6.4 + o.pos.x) * UNITS_PER_METRE, lz = (p.rect.y * 6.4 + o.pos.z) * UNITS_PER_METRE;
        if (pointNearPath(net, x, y, lx, lz, WOD_PIECE_ROAD_CLEAR)) { near++; if (!wodPiecewise(session.prefab[p.index])) nearWhole++; }
      }
    }
  }
  assert.ok(near > 300, `pieces whose own position is on a road band: ${near} (their mesh boxes reach more)`);
  assert.equal(nearWhole, 0, 'no camp, fort, shrine or ruin piece is - the mod\'s own pixel test already holds those back');
});

test('ROADS-CLEAR by source: the world host asks the site at its pick, each piece and flat by its own box before it stands, and each camp anchor and member', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /\}, wodPathsPoint, \(name, prefab, rect\) => wodSiteClear\(terrainGen\.roads\(\), px, py, name, prefab, rect\)\);/);
  assert.match(w, /const box = transformedAabb\(archAabb\(m\.modelId, cpu\.positions\), m\.matrix\);\n(?:\s*\/\/[^\n]*\n)*\s*if \(boxNearPath\(_roadsNow, px, py, box\[0\] \* UNITS_PER_METRE, box\[2\] \* UNITS_PER_METRE, box\[3\] \* UNITS_PER_METRE, box\[5\] \* UNITS_PER_METRE, WOD_PIECE_ROAD_CLEAR\)\) \{ _wodOffRoad\+\+; continue; \}\n\s*unionBox\(box\);/,
    'the piece is refused before it joins the bounds, the batch or the collider');
  assert.match(w, /for \(const f of place\.flats\) \{\n\s*if \(pointNearPath\(_roadsNow, px, py, f\.base\[0\] \* UNITS_PER_METRE, f\.base\[2\] \* UNITS_PER_METRE, WOD_PIECE_ROAD_CLEAR\)\) \{ _wodOffRoad\+\+; continue; \}/);
  assert.match(w, /const _roadsNow = terrainGen\.roads\(\);/);
  assert.match(w, /if \(anchor && _nearRoad\(\[anchor\.x, anchor\.y, anchor\.z\], \(hit\.spacing \?\? 0\) \+ CAMP_ROAD_CLEAR_M\)\) anchor = null;/, 'the camp ring clear of the road');
  assert.match(w, /if \(spot && _nearRoad\(\[spot\.x, spot\.y, spot\.z\], CAMP_ROAD_CLEAR_M\)\) spot = null;/, 'and each member');
  assert.match(w, /const _nearRoad = \(pos, radiusM\) => \{\n\s*const net = terrainGen\.roads\(\);\n\s*if \(!net\) return false;\n\s*const wc = state\.worldCoords\(pos\);\n\s*const p = worldCoordToMapPixel\(wc\.x, wc\.z\);\n\s*const o = mapPixelToWorldCoords\(p\.x, p\.y\);\n\s*return pointNearPath\(net, p\.x, p\.y, wc\.x - o\.x, wc\.z - o\.z, radiusM \* UNITS_PER_METRE\);/,
    'a scene position into its pixel\'s own frame, the network\'s units');
});
