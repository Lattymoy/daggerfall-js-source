// ROAD-LOOK (2026-10-27, KPbICA on the DFO Online Discord, forwarded by the owner: "1) Texture blending for road tiles and
// surroundings", "4) No bridges across the big rivers (like this one that starts around IC and goes south)"; the owner:
// "No band aids or half assed work"; bible/03-World/Roads.md ROAD-LOOK).
//  - A ROAD'S EDGE BLENDS INTO ITS GROUND (world/road/roadEdge.js, its GLSL twin render/roadEdgeGlsl.js): the share of road
//    the bilinear of the four nearest cells, wandered and drawn across a soft rim; the other kind's picture the nearest
//    cell's, mirrored about its own square - continuous across every seam between a road and the ground, never a larger
//    step at a seam of one kind, the road's middle and the ground past the rim their own, water never blended.
//  - A ROAD OVER A RIVER WIDER THAN A FORD CROSSES ON A BRIDGE (world/road/roadBridges.js, world/road/bridgeModels.js):
//    the crossings off the drawn curves, the fords Basic Roads' own width, the river run under the deck, the deck walked.
//  - A CARVED LAKE IS NO ROAD'S (world/road/roadLand.js `still`, world/tamrielRoads.js lakeRaster): water, never a ford.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { glslFunctions } from '../../glsl.mjs';

import { ROAD_RECORDS, ROAD_PAVING, ROAD_EDGE, ROAD_EDGE_REACH, ROAD_EDGE_WET, roadEdgeAt, roadEdgeHash, roadEdgeNoise, roadEdgeWander, mirroredLocal, isRoadByte, takesRoadEdge, nearWeight } from '../../../src/world/road/roadEdge.js';
import { roadEdgeGlsl, roadEdgesOn } from '../../../src/render/roadEdgeGlsl.js';
import { EL_TERRAIN_FS } from '../../../src/render/enhancedLighting.js';
import { terrainClipFs } from '../../../src/render/renderer.js';
import { snowTerrainFs } from '../../../src/render/snowfallGlsl.js';
import { WATER_DRAW_MASK_TABLE } from '../../../src/world/water/waterCorners.js';
import { ROAD_RECORDS as FABRIC_ROADS } from '../../../src/world/urban/townFabric.js';
import { paintRoads } from '../../../src/world/road/roadPainter.js';
import { assignTiles } from '../../../src/world/terrain/terrainTiles.js';
import { convertTilemap, convertTile } from '../../../src/world/terrain/terrainSurface.js';
import { DIR, route, MAP_W, MAP_H } from '../../../src/world/road/roadNetwork.js';
import { BRIDGE, crossingsOf, bridgesOf, bridgeShape, unpaveBridges, inkBridgeLaw } from '../../../src/world/road/roadBridges.js';
import { buildBridgeMesh, deckTop, openings, standBridges, PIXEL_FRAME } from '../../../src/world/road/bridgeModels.js';
import { landForRoutes, VOYAGER_DIALS } from '../../../src/world/road/roadLand.js';
import { Collider } from '../../../src/player/collider.js';
import { paintPastBay, paintBridges, BRIDGE_MARK } from '../../../src/ui/tamrielInk.js';
import { PEN } from '../../../src/ui/ink/inkMap.js';
import { setWatersInk } from '../../../src/world/tamriel/watersInk.js';
import { setArenaRoads, beyondKey } from '../../../src/world/arenaRoads.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const D = 128, TD = 129;
const GRASS = 2, DIRT = 1;

// ── a pixel's tilemap as the painters mint it ───────────────────
/** The converted tile bytes (the shader's) of a pixel the painters paint: Basic Roads' bytes (`road`, `track`), or the
 *  curves past the Bay (`curve`: the 3 x 3's bytes), over grass with a dirt patch, and `wet` tiles of water. */
function pixelBytes({ road = 0, track = 0, curve = null, rect = null, wet = [] } = {}) {
  const tileData = new Uint8Array(TD * TD).fill(GRASS);
  for (let y = 90; y < 110; y++) for (let x = 10; x < 30; x++) tileData[x + y * TD] = DIRT;   // a dirt patch the squares blend
  for (const [x, y] of wet) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) tileData[x + dx + (y + dy) * TD] = 0;
  const tilemap = new Uint8Array(D * D);
  paintRoads(tileData, tilemap, curve ? curve['0,0'] ?? 0 : road, track, rect, TD, { paths: new Uint8Array(D * D), curve: curve ? { px: 0, py: 0, byteAt: (kind, x, y) => (kind === 'roads' ? curve[`${x},${y}`] ?? 0 : 0) } : null });
  assignTiles(tileData, tilemap, true);
  return convertTilemap(tilemap);
}
const at = (bytes) => (cx, cy) => bytes[Math.min(D - 1, Math.max(0, cy)) * D + Math.min(D - 1, Math.max(0, cx))];
/** GLSL's ROT and TRANS (column-major), read off the lane's program - never restated. */
const tables = (() => {
  const m = /const mat2 ROT\[4\] = mat2\[4\]\(([\s\S]*?)\);\nconst vec2 TRANS\[4\] = vec2\[4\]\(([\s\S]*?)\);/.exec(EL_TERRAIN_FS);
  const nums = (s) => [...s.matchAll(/-?\d+\.\d+/g)].map((x) => Number(x[0]));
  const r = nums(m[1]), t = nums(m[2]);
  return { src: m[0], ROT: [0, 1, 2, 3].map((k) => r.slice(4 * k, 4 * k + 4)), TRANS: [0, 1, 2, 3].map((k) => t.slice(2 * k, 2 * k + 2)) };
})();
/** A picture's colour at its own coordinate: its turned (u, v) and its record - continuous inside a tile, a record's own. */
const colourOf = (d, l) => { const R = tables.ROT[d & 3], T = tables.TRANS[d & 3]; return [R[0] * l[0] + R[2] * l[1] + T[0], R[1] * l[0] + R[3] * l[1] + T[1], (d >> 2) / 64]; };
/** The JS twin's colour at a point: each drawn cell's picture, mirrored about its square, at its weight. */
function shade(byteAt, x, y) {
  const { draw } = roadEdgeAt(byteAt, x, y), c = [0, 0, 0];
  for (const [cx, cy, w] of draw) { const k = colourOf(byteAt(cx, cy), mirroredLocal(cx, cy, x, y)); for (let i = 0; i < 3; i++) c[i] += w * k[i]; }
  return c;
}
const own = (byteAt, x, y) => { const cx = Math.min(D - 1, Math.floor(x)), cy = Math.min(D - 1, Math.floor(y)); return colourOf(byteAt(cx, cy), mirroredLocal(cx, cy, x, y)); };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** The first ground record that carries water (the draw's table), and a tilemap of tiles by hand: grass, a road down
 *  columns 63-64 with water east of it on rows 40-50, and a road along rows 70-71 with water north of it on columns 58-62. */
const WET = [...Array(56).keys()].find((r) => !takesRoadEdge(r << 2));
const shoreBytes = (() => {
  const b = new Uint8Array(D * D).fill(GRASS << 2);
  for (let y = 0; y < D; y++) for (const x of [63, 64]) b[y * D + x] = (ROAD_PAVING << 2) | (y & 3);
  for (let y = 40; y <= 50; y++) b[y * D + 65] = WET << 2;
  for (let x = 0; x < D; x++) for (const y of [70, 71]) b[y * D + x] = (ROAD_PAVING << 2) | (x & 3);
  for (let x = 58; x <= 62; x++) b[72 * D + x] = WET << 2;
  return b;
})();

test('ROAD-LOOK the road\'s records and the water\'s: Daggerfall\'s road tiles have one home (the town\'s fabric reads it); a record takes part when it is ground and dry - every record the draw\'s water table gives a corner of water lends none (mutants: a record dropped; the wet word unread)', () => {
  assert.deepEqual([...ROAD_RECORDS], [46, 47, 55]);
  assert.equal(ROAD_PAVING, 46);
  assert.equal(FABRIC_ROADS, ROAD_RECORDS, 'world/urban/townFabric.js re-exports the one home');
  for (let r = 0; r < 64; r++) {
    let wet = false;
    for (let t = 0; t < 4; t++) if (WATER_DRAW_MASK_TABLE[(r << 2) | t]) wet = true;
    assert.equal(takesRoadEdge(r << 2), r < 56 && !wet, `record ${r}`);
    assert.equal(isRoadByte((r << 2) | 3), r === ROAD_PAVING, `record ${r} turned: the paving alone - its edge tiles the ground's side`);
  }
  assert.ok(!takesRoadEdge(0) && !takesRoadEdge(21 << 2) && !takesRoadEdge(255) && takesRoadEdge(46 << 2) && takesRoadEdge(GRASS << 2), 'water, a shore and the clip mark lend none');
  assert.ok(ROAD_EDGE_REACH < 0.5, 'the rim and the wander inside a half tile: the four nearest cells are all a point needs');
  assert.deepEqual([nearWeight(0.5), nearWeight(0.6)], [0, 0]);
  assert.ok(nearWeight(1e-4) > 1e5 * nearWeight(0.25), 'whole on a seam itself');
});

test('ROAD-LOOK the blend is continuous across every seam between a road and its ground, and never steps more than its own tiles at a seam of one kind - on the Bay\'s painter (a cardinal road, a diagonal, a junction, a track), the curves past it, and a road at a water\'s edge (mutants: the mirror dropped; the nearest weight squared the wrong way; the bilinear\'s corner the wrong cell; a wet neighbour lending its picture)', () => {
  const cases = {
    cardinal: pixelBytes({ road: DIR.N | DIR.S }),
    diagonal: pixelBytes({ road: DIR.NE | DIR.SW }),
    junction: pixelBytes({ road: DIR.N | DIR.E | DIR.SW }),
    track: pixelBytes({ road: DIR.E | DIR.W, track: DIR.N }),
    curve: pixelBytes({ curve: { '0,0': DIR.N | DIR.SE, '0,-1': DIR.S, '1,1': DIR.NW } }),
    shore: pixelBytes({ road: DIR.N | DIR.S, wet: [[65, 40], [66, 40], [65, 41], [62, 70]] }),
  };
  const eps = 1e-7;
  for (const [name, bytes] of Object.entries(cases)) {
    const byteAt = at(bytes);
    let soft = 0, same = 0;
    for (let k = 40; k < 90; k++) {
      for (let j = 2; j < 126; j++) {
        for (const f of [0.17, 0.5, 0.83]) {
          for (const [x0, y0, x1, y1, a, b] of [[k - eps, j + f, k + eps, j + f, [k - 1, j], [k, j]], [j + f, k - eps, j + f, k + eps, [j, k - 1], [j, k]]]) {
            const da = byteAt(a[0], a[1]), db = byteAt(b[0], b[1]);
            const step = dist(shade(byteAt, x0, y0), shade(byteAt, x1, y1)), was = dist(own(byteAt, x0, y0), own(byteAt, x1, y1));
            if (takesRoadEdge(da) && takesRoadEdge(db) && isRoadByte(da) !== isRoadByte(db)) {
              assert.ok(step < 1e-4, `${name}: a road's seam at (${x0.toFixed(3)}, ${y0.toFixed(3)}) steps ${step} (its tiles' own step ${was})`);
              soft++;
            } else {
              assert.ok(step <= was + 1e-4, `${name}: a seam of one kind at (${x0.toFixed(3)}, ${y0.toFixed(3)}) steps ${step}, its tiles' own ${was}`);
              same++;
            }
          }
        }
      }
    }
    assert.ok(soft > 50, `${name}: road seams measured (${soft})`);
    assert.ok(same > 1000, `${name}: seams of one kind measured (${same})`);
  }
});

test('ROAD-LOOK the road is not smeared: past REACH of an edge a point draws its own tile alone - a two-tile road\'s middle, the ground past the rim, a corner of one kind, a water tile and its neighbour\'s side of their seam, a road\'s side on water; and the edge does blend, an inside corner\'s diagonal too where the wander runs deepest (mutants: the rim\'s half width; the wander\'s amplitude; the early answer for a corner of one kind; a wet neighbour lending its picture)', () => {
  const bytes = pixelBytes({ road: DIR.N | DIR.S, wet: [[66, 40]] }), byteAt = at(bytes);
  let blended = 0;
  for (let y = 10.05; y < 118; y += 0.37) {
    for (let x = 60; x < 68; x += 0.013) {
      const { draw } = roadEdgeAt(byteAt, x, y), edge = Math.min(Math.abs(x - 63), Math.abs(x - 65));
      if (edge > ROAD_EDGE_REACH + 1e-9 || (x > 65.5 && Math.abs(y - 40.5) < 1.5)) assert.deepEqual(draw.map((d) => d.slice(0, 2)), [[Math.floor(x), Math.floor(y)]], `(${x.toFixed(3)}, ${y.toFixed(2)}) its own`);
      else if (draw.length > 1) blended++;
    }
  }
  assert.ok(blended > 500, `the edges blend (${blended})`);
  // a road's side on water draws none of it; its side on grass, a row away, does
  const shore = at(shoreBytes);
  let onGrass = 0;
  for (let y = 30.05; y < 60; y += 0.11) {
    const { draw } = roadEdgeAt(shore, 64.97, y);
    for (const [cx, cy] of draw.slice(1)) assert.ok(takesRoadEdge(shore(cx, cy)), `(64.97, ${y.toFixed(2)}) draws no water (${cx}, ${cy})`);
    if (draw.some(([cx]) => cx === 65)) onGrass++;
  }
  assert.ok(onGrass > 20, `the side on grass blends (${onGrass})`);
  // a corner of one kind but its diagonal: where the wander pulls the line deepest (its least on the pixel, 1/16 tile
  // apart) an inside corner of the road shows the diagonal's ground - the four cells all asked
  assert.ok(roadEdgeWander(44, 41) < -0.2, 'the wander\'s deepest');
  const corner = (cx, cy) => (cx === 43 && cy === 40 ? GRASS << 2 : ROAD_PAVING << 2);
  const deep = roadEdgeAt(corner, 44, 41);
  assert.ok(deep.rho < 1 && deep.draw.some(([cx, cy]) => cx === 43 && cy === 40), `the inside corner's diagonal drawn (${JSON.stringify(deep)})`);
  // the wander moves the line: along the west edge the road's share at the seam itself is not one number
  const shares = new Set();
  for (let y = 10.5; y < 118; y += 1) shares.add(roadEdgeAt(byteAt, 63, y).rho.toFixed(3));
  assert.ok(shares.size > 20, `the edge wanders (${shares.size} shares on the seam)`);
  assert.equal(ROAD_EDGE.soft, 0.07);
  assert.deepEqual(ROAD_EDGE.wander.map((w) => [w.cells, w.amp]), [[32, 0.12], [128, 0.06], [512, 0.05]]);
  // a pixel's edge: the lattice taken modulo the pixel - the same wander at x = 0 as at x = 128
  for (const y of [3.3, 50.7, 101.1]) assert.equal(roadEdgeWander(0, y), roadEdgeWander(128, y));
  for (const o of ROAD_EDGE.wander) assert.equal(roadEdgeNoise(0.5, 127.9, o.cells, ROAD_EDGE.salt), roadEdgeNoise(128.5, 127.9, o.cells, ROAD_EDGE.salt));
});

test('ROAD-LOOK the GLSL is the JS: the hash bit for bit, the noise and the wander to the float, and the whole blend - the cells it fetches, the pictures it draws (mirrored, turned by their own transform, at the fragment\'s own gradient turned) and their weights - on the painters\' tilemaps and a road beside water, and the lattice wrapped at the pixel\'s far edges; off, the tile alone (mutants: any term of either side; the switch unread)', () => {
  const chunk = `uniform highp usampler2D uTilemap;\nuniform sampler2DArray uTileArr;\n${tables.src}\n${roadEdgeGlsl('')}`;
  for (const [name, bytes] of Object.entries({ cardinal: pixelBytes({ road: DIR.N | DIR.S }), curve: pixelBytes({ curve: { '0,0': DIR.NE | DIR.W, '1,-1': DIR.SW, '-1,0': DIR.E } }), junction: pixelBytes({ road: DIR.E | DIR.W | DIR.S | DIR.NE }), shore: shoreBytes })) {
    const byteAt = at(bytes);
    const grads = [];
    const fns = glslFunctions(chunk, {
      uRoadEdge: 1,
      texelFetch: (_s, c) => [byteAt(c[0], c[1]), 0, 0, 0],
      textureGrad: (_s, p, gx, gy) => { grads.push([p[2], gx, gy]); return [p[0], p[1], p[2] / 64, 1]; },
    });
    for (const [ix, iy, s] of [[0, 0, 0], [31, 127, ROAD_EDGE.salt], [5, 9, 4294967295]]) assert.equal(fns.reHash([ix, iy], s), roadEdgeHash(ix, iy, s));
    let n = 0;
    for (let y = 30.07; y < 100; y += 0.71) {
      for (let x = 55.03; x < 74; x += 0.19) {
        for (const o of ROAD_EDGE.wander) assert.ok(Math.abs(fns.reNoise([x, y], o.cells, ROAD_EDGE.salt) - roadEdgeNoise(x, y, o.cells, ROAD_EDGE.salt)) < 1e-12);
        assert.ok(Math.abs(fns.reWander([x, y]) - roadEdgeWander(x, y)) < 1e-12);
        const c = Math.min(D - 1, Math.floor(x)), r = Math.min(D - 1, Math.floor(y)), d = byteAt(c, r), t = d & 3;
        const ownC = colourOf(d, mirroredLocal(c, r, x, y));
        const R = tables.ROT[t], du = [0.013, -0.002], dv = [0.001, 0.017];
        const gx = [R[0] * du[0] + R[2] * du[1], R[1] * du[0] + R[3] * du[1]], gy = [R[0] * dv[0] + R[2] * dv[1], R[1] * dv[0] + R[3] * dv[1]];
        grads.length = 0;
        const got = fns.roadEdge(ownC, d, [x, y], gx, gy, t), want = shade(byteAt, x, y);
        assert.ok(dist(got, want) < 1e-9, `${name} at (${x.toFixed(2)}, ${y.toFixed(2)}): ${got} against ${want}`);
        // every neighbour's picture is asked at the coordinate's own gradient, turned by the neighbour's own transform
        const turns = roadEdgeAt(byteAt, x, y).draw.slice(1).map(([cx, cy]) => byteAt(cx, cy));
        assert.equal(grads.length, turns.length, 'a picture a neighbour drawn');
        for (const [layer, ngx] of grads) {
          assert.ok(turns.some((d) => d >> 2 === layer && Math.hypot(ngx[0] - (tables.ROT[d & 3][0] * du[0] + tables.ROT[d & 3][2] * du[1]), ngx[1] - (tables.ROT[d & 3][1] * du[0] + tables.ROT[d & 3][3] * du[1])) < 1e-12), 'the neighbour\'s gradient its own turn of the coordinate\'s');
        }
        if (roadEdgeAt(byteAt, x, y).draw.length > 1) n++;
      }
    }
    // the pixel's far edges, where each lattice's last cell wraps to its first
    for (const [x, y] of [[127.95, 127.95], [127.9, 3.3], [0.02, 127.97], [64.5, 127.99]]) {
      for (const o of ROAD_EDGE.wander) assert.ok(Math.abs(fns.reNoise([x, y], o.cells, ROAD_EDGE.salt) - roadEdgeNoise(x, y, o.cells, ROAD_EDGE.salt)) < 1e-12, `the lattice of ${o.cells} wrapped at (${x}, ${y})`);
      assert.ok(Math.abs(fns.reWander([x, y]) - roadEdgeWander(x, y)) < 1e-12);
    }
    assert.ok(n > 40, `${name}: blended points compared (${n})`);
    fns.globals.uRoadEdge = 0;
    assert.deepEqual(fns.roadEdge([0.2, 0.3, 0.4], byteAt(63, 50), [63.02, 50.5], [0.01, 0], [0, 0.01], 0), [0.2, 0.3, 0.4], 'off: the tile alone');
  }
});

test('ROAD-LOOK both terrain programs blend right after their own tile - the lane decoding the neighbour as its own - before the ecotone; the clip and snow variants still one decode; the renderer\'s switch a frame\'s, taken as the renderer is made from roadEdgesOn: the enhanced skin, the kill door - no host\'s own line (mutants: the call dropped from either program; the lane\'s neighbour undecoded; the switch never uploaded; the renderer never taking it; the classic skin blended; the kill door unread)', async () => {
  const r = read('src/render/renderer.js');
  const classic = r.slice(r.indexOf('const TERRAIN_FS = `'), r.indexOf('}`;', r.indexOf('const TERRAIN_FS = `')));
  // PIN MOVED (COAST-LOOK, render/groundEdgeGlsl.js): its chunk and the bed's follow this one before main, and a
  // transition's two kinds (no road's byte) are drawn between the tile and this call - still before the ecotone
  assert.match(classic, /const vec2 TRANS\[4\] = vec2\[4\]\(\n[^\n]*\n\$\{roadEdgeGlsl\(\)\}\n\$\{groundEdgeGlsl\(\)\}[^\n]*\n\$\{WATER_BED_GLSL\}\nvoid main\(\) \{/);
  const AFTER_TILE = String.raw`(?: {2}(?:\/\/|highp uint geA, geB;|bool ge = groundMix\(|vec2 dux = |vec4 ew = ecoWeights\(|if \(ge\) tex = mix\()[^\n]*\n)+ {2}tex = roadEdge\(tex, data, unwrapped, gx, gy, t\);[^\n]*\n {2}if \(!ge\) tex = ecotone\(`;
  assert.match(classic, new RegExp(String.raw`vec3 tex = textureGrad\(uTileArr, vec3\(tuv, float\(layer\)\), gx, gy\)\.rgb;\n${AFTER_TILE}`));
  assert.match(EL_TERRAIN_FS, new RegExp(String.raw`vec3 tex = elDecode\(textureGrad\(uTileArr, vec3\(tuv, float\(layer\)\), gx, gy\)\.rgb\);\n${AFTER_TILE}`));
  assert.match(EL_TERRAIN_FS, /return elDecode\(textureGrad\(uTileArr, vec3\(ROT\[t\] \* l \+ TRANS\[t\], float\(d >> 2u\)\), ROT\[t\] \* dux, ROT\[t\] \* duy\)\.rgb\);/, 'the lane\'s neighbour in its own linear light');
  assert.equal(terrainClipFs(EL_TERRAIN_FS).split('\n').length, EL_TERRAIN_FS.split('\n').length + 1, 'the clip still one line');
  assert.ok(snowTerrainFs(EL_TERRAIN_FS).includes('vec3 roadEdge('), 'the snow variant still built from the program');
  assert.match(r, /this\.tURoadEdge = gl\.getUniformLocation\(this\.terrainProgram, 'uRoadEdge'\);/);
  assert.match(r, /gl\.uniform1f\(this\.tURoadEdge, this\.roadEdges \? 1 : 0\);/);
  assert.match(r, /\n {2}roadEdges = roadEdgesOn\(\);\n/, 'the renderer takes the page\'s switch as it is made (a new skin reloads the page)');
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) assert.doesNotMatch(read(host), /renderer\.roadEdges|roadEdgesOn/, `${host}: no host's own line (bible/01-Overview/Host-Split.md)`);
  assert.deepEqual([roadEdgesOn('?skin=enhanced'), roadEdgesOn('?skin=enhanced&roadedges=off'), roadEdgesOn('?skin=classic'), roadEdgesOn('?skin=classic&roadedges=on')], [true, false, false, false], 'the enhanced skin\'s, the kill door its own');
});

// ── the bridges ─────────────────────────────────────────────────
/** A law of one river (tamrielWaters' shape): a line down column `x` (Bay pixels) from row `top` for `rows`, `width`
 *  metres wide (or a function of y), at `level` kernel units; its index the pixels its reach meets. */
function riverLaw({ x = 10.5, rows = 20, width = 60, level = 100, key = 'test', bend = 0, top = 0 } = {}) {
  const n = rows * 10 + 1, pts = new Float64Array(2 * n), w = new Float32Array(n), lv = new Float32Array(n);
  for (let i = 0; i < n; i++) { const y = i / 10; pts[2 * i] = x + bend * y; pts[2 * i + 1] = top + y; w[i] = typeof width === 'function' ? width(y) : width; lv[i] = level; }
  const r = { key, name: key, pts, width: w, level: lv, n };
  const index = new Map();
  for (let i0 = 0; i0 < n - 1; i0 += 8) {
    for (let i = i0; i <= Math.min(n - 1, i0 + 8); i++) {
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const k = (Math.floor(pts[2 * i]) + dx) * 65536 + Math.floor(pts[2 * i + 1]) + dy, a = index.get(k) ?? [];
        if (a[a.length - 1] !== i0) a.push(i0);
        index.set(k, a);
      }
    }
  }
  return { version: 1, rivers: [r], lakes: [], index, pixels: new Map() };
}
const layer = (roads, tracks = {}) => (kind, x, y) => (kind === 'roads' ? roads : tracks)[`${x},${y}`] ?? 0;

test('ROAD-LOOK the crossings: where a pixel\'s own drawn curve meets a river\'s line - its point, its heading, the river\'s width and level there - owned by the pixel that holds it; a road along a river crosses none; a junction\'s curves over one river are one crossing, the squarest; a track beside a road\'s crossing is the road\'s (mutants: the owner test; the half-open ends; the merge; the track kept)', () => {
  const law = riverLaw();
  const ew = layer({ '10,10': DIR.E | DIR.W, '9,10': DIR.E | DIR.W, '11,10': DIR.E | DIR.W });
  const c = crossingsOf(10, 10, ew, law);
  assert.equal(c.length, 1);
  assert.ok(Math.abs(c[0].x - 10.5) < 1e-9 && Math.abs(c[0].y - 10.5) < 1e-9, `at the river (${c[0].x}, ${c[0].y})`);
  assert.ok(Math.abs(c[0].sin - 1) < 1e-9 && Math.abs(Math.abs(c[0].ux) - 1) < 1e-9);
  assert.deepEqual([c[0].kind, c[0].width, c[0].level, c[0].river], ['road', 60, 125, 'test'], 'the level in metres (1.25 a unit)');
  assert.deepEqual(crossingsOf(9, 10, ew, law), [], 'the neighbour\'s curve reaches no water of its own');
  // a road down the river's own column, beside it: no crossing
  assert.deepEqual(crossingsOf(10, 10, layer({ '10,10': DIR.N | DIR.S }), riverLaw({ x: 10.3 })), []);
  // a junction on the river: its two straight ways through the centre meet the river at one point - one deck, the squarer
  // (E-W); its two bends cross 102 m either side, their decks clear of it - each its own
  const j = crossingsOf(10, 10, layer({ '10,10': DIR.E | DIR.W | DIR.SW | DIR.NE }), law);
  assert.equal(j.length, 3, `three crossings (${j.length})`);
  const mid = j.filter((o) => Math.abs(o.y - 10.5) < 1e-9);
  assert.equal(mid.length, 1, 'one at the centre');
  assert.ok(Math.abs(mid[0].sin - 1) < 1e-9, 'the squarer');
  for (const o of j) if (o !== mid[0]) assert.ok(Math.abs(Math.abs(o.y - 10.5) - 0.125) < 1e-9 && Math.abs(o.sin - 2 / Math.sqrt(5)) < 0.01, `the bends 0.125 of a pixel off, heading 2 to 1 there (${o.y}, ${o.sin})`);
  // a track crossing beside the road's: the road's bridge carries it
  const both = crossingsOf(10, 10, layer({ '10,10': DIR.E | DIR.W }, { '10,10': DIR.NE | DIR.SW }), law);
  assert.deepEqual(both.map((o) => o.kind), ['road']);
  const trackOnly = crossingsOf(10, 10, layer({}, { '10,10': DIR.E | DIR.W }), law);
  assert.deepEqual(trackOnly.map((o) => o.kind), ['track']);
  // a crossing on a pixel's edge is one pixel's: the river down x = 11 (the edge between 10 and 11)
  const edge = riverLaw({ x: 11 }), two = layer({ '10,10': DIR.E | DIR.W, '11,10': DIR.E | DIR.W });
  assert.equal(crossingsOf(10, 10, two, edge).length + crossingsOf(11, 10, two, edge).length, 1, 'one owner');
});

test('ROAD-LOOK a bridge at every crossing wider than Basic Roads\' own river, a ford at or under it; its length across the water the width over the angle\'s sine (never under minSine), its deck the clearance and the deck over the river\'s level, its ramps down to the level a metre in `ramp`; kept a pixel by its bytes and its law (mutants: the ford\'s width; the sine unread; the floor on the sine; the ramp\'s run; the memo by the bytes alone)', () => {
  assert.equal(BRIDGE.fordMax, 25.6, 'two tiles of water and a bank each side (roadPainter.js RIVER_TILES)');
  const ew = layer({ '10,10': DIR.E | DIR.W });
  assert.deepEqual(bridgesOf(10, 10, ew, riverLaw({ width: 25.5 })), [], 'a ford');
  const b = bridgesOf(10, 10, ew, riverLaw({ width: 26 }));
  assert.equal(b.length, 1);
  const k = BRIDGE.road;
  assert.ok(Math.abs(b[0].half - 13) < 1e-6 && Math.abs(b[0].deck - (125 + k.clearance + k.deck)) < 1e-9);
  assert.ok(Math.abs(b[0].abut - (13 + k.bank)) < 1e-6 && Math.abs(b[0].reach - (b[0].abut + (k.clearance + k.deck) * k.ramp)) < 1e-6);
  const slant = bridgeShape({ kind: 'road', x: 0, y: 0, ux: 1, uy: 0, sin: 0.5, width: 100, level: 0, river: 'r' });
  assert.ok(Math.abs(slant.half - 100) < 1e-9, 'a slant crossing\'s water is longer');
  assert.ok(Math.abs(bridgeShape({ kind: 'road', x: 0, y: 0, ux: 1, uy: 0, sin: 0.1, width: 100, level: 0, river: 'r' }).half - 50 / BRIDGE.minSine) < 1e-9);
  const t = bridgeShape({ kind: 'track', x: 0, y: 0, ux: 1, uy: 0, sin: 1, width: 40, level: 10, river: 'r' });
  assert.equal(t.deck, 10 + BRIDGE.track.clearance + BRIDGE.track.deck);
  // the memo: the same bytes, another law - asked again
  const l1 = riverLaw({ width: 60 }), l2 = riverLaw({ width: 90 });
  assert.equal(bridgesOf(10, 10, ew, l1)[0].width, 60);
  assert.equal(bridgesOf(10, 10, ew, l2)[0].width, 90);
});

test('ROAD-LOOK under a bridge the river runs: the deck\'s tiles over the channel - painted by the curves past the Bay - laid back, road and path, and every other tile kept; a ford keeps all of its; a neighbour\'s bridge reaching over the edge lays this pixel\'s back too (mutants: the channel unasked; the deck\'s width; the neighbours unread; the path left set)', () => {
  const ew = { '10,10': DIR.E | DIR.W, '9,10': DIR.E | DIR.W, '11,10': DIR.E | DIR.W };
  const paint = (px) => {
    const tileData = new Uint8Array(TD * TD).fill(GRASS), tilemap = new Uint8Array(D * D), paths = new Uint8Array(D * D);
    paintRoads(tileData, tilemap, ew[`${px},10`], 0, null, TD, { paths, curve: { px, py: 10, byteAt: layer(ew) } });
    return { tilemap, paths };
  };
  const law = riverLaw({ width: 60 }), inChannel = (x) => Math.abs(x - 10.5) * 819.2 < 30;
  const { tilemap, paths } = paint(10);
  // another way's path beside the road, 16 m off its line and over the channel: no deck over it, so it is kept
  for (let tx = 60; tx <= 68; tx++) { const i = 66 * D + tx; if (!paths[i]) { tilemap[i] = 7; paths[i] = 1; } }
  const before = tilemap.slice(), pathsBefore = paths.slice();
  const n = unpaveBridges(tilemap, paths, 10, 10, layer(ew), law, inChannel);
  // the deck's footprint over the water: within its half and a tile along the line, its half width and a tile across, a
  // corner in the channel - the river 60 m wide down local x 409.6, the road along local z 409.6
  const half = 30 + 6.4, across = BRIDGE.road.width / 2 + 6.4;
  let want = 0;
  for (let ty = 0; ty < D; ty++) {
    for (let tx = 0; tx < D; tx++) {
      const i = ty * D + tx, lx = (tx + 0.5) * 6.4, lz = (ty + 0.5) * 6.4;
      const wet = [tx, tx + 1].some((c) => Math.abs(c * 6.4 - 409.6) < 30), under = Math.abs(lx - 409.6) <= half && Math.abs(lz - 409.6) <= across;
      if (pathsBefore[i] && wet && under) { assert.deepEqual([tilemap[i], paths[i]], [0, 0], `tile (${tx}, ${ty}) over the channel laid back`); want++; }
      else assert.deepEqual([tilemap[i], paths[i]], [before[i], pathsBefore[i]], `tile (${tx}, ${ty}) at ${lx}, ${lz} kept`);
    }
  }
  assert.equal(n, want);
  assert.ok(want >= 30 && [...before].filter((v, i) => v && !tilemap[i]).length >= 18, `the road's tiles and its shoulders' over the channel (${want})`);
  const ford = paint(10);
  assert.equal(unpaveBridges(ford.tilemap, ford.paths, 10, 10, layer(ew), riverLaw({ width: 20 }), inChannel), 0, 'a ford keeps its road');
  // the river down the edge between 10 and 11, 60 m wide: the bridge is one pixel's, both pixels' tiles over it laid back
  const edgeLaw = riverLaw({ x: 11 }), inEdge = (x) => Math.abs(x - 11) * 819.2 < 30;
  const left = paint(10), right = paint(11);
  const nl = unpaveBridges(left.tilemap, left.paths, 10, 10, layer(ew), edgeLaw, inEdge), nr = unpaveBridges(right.tilemap, right.paths, 11, 10, layer(ew), edgeLaw, inEdge);
  assert.ok(nl > 6 && nr > 6, `both sides of the edge (${nl}, ${nr})`);
});

test('ROAD-LOOK the bridge is walked: its deck where deckTop says from ramp\'s foot to ramp\'s foot, no steeper than its ramp, its parapets or rails stopping a body each side, its arches over the water at the clearance with its piers between, the road\'s of the bridges\' stone and the track\'s of timber, its box its own; stood with the pixel\'s statics and its bucket (mutants: the deck\'s height; the ramp\'s run; a parapet dropped; the openings\' count; the art)', () => {
  for (const kind of ['road', 'track']) {
    const k = BRIDGE[kind];
    const b = bridgeShape({ kind, x: 10.5, y: 10.5, ux: 0.8, uy: -0.6, sin: 0.9, width: 90, level: 120, river: 'r' });
    const { mesh, box } = buildBridgeMesh(b, 10, 10);
    assert.deepEqual([...new Set(mesh.subMeshes.map((s) => `${s.textureArchive}:${s.textureRecord}`))], [kind === 'road' ? '38400:4' : '38400:8'], `${kind}: its art`);
    for (const v of mesh.normals) assert.ok(Number.isFinite(v));
    const col = new Collider(() => -1e9);
    col.addMesh('b', mesh.positions, mesh.indices, PIXEL_FRAME);
    const cx = 409.6, cz = 409.6, ax = 0.8, az = 0.6, nx = -az, nz = ax;   // the line's heading in the pixel's frame (north is -y)
    for (let s = -b.reach + 0.5; s < b.reach - 0.5; s += 3.1) {
      for (const n of [-k.width / 2 + k.wall + 0.6, 0, k.width / 2 - k.wall - 0.6]) {
        const x = cx + s * ax + n * nx, z = cz + s * az + n * nz;
        const d = col.raycast([x, 3000, z], [0, -1, 0], 4000), y = 3000 - d;
        assert.ok(Math.abs(y - deckTop(b, s)) < 1e-3, `${kind}: the deck at s ${s.toFixed(1)}, n ${n}: ${y} against ${deckTop(b, s)}`);
      }
      // a body walking across meets the parapet or the rail each side, half a metre over the deck
      for (const side of [-1, 1]) {
        const y = deckTop(b, s) + k.parapet / 2, x = cx + s * ax, z = cz + s * az;
        const d = col.raycast([x, y, z], [side * nx, 0, side * nz], 20);
        assert.ok(d < k.width / 2 + 0.01, `${kind}: stopped each side at s ${s.toFixed(1)} (${d})`);
      }
    }
    for (let s = -b.reach; s < b.reach; s += 0.5) assert.ok(Math.abs(deckTop(b, s + 0.5) - deckTop(b, s)) <= 0.5 / k.ramp + 1e-9, 'no steeper than its ramp');
    assert.equal(deckTop(b, b.reach), b.level, 'down to the river\'s level at its feet');
    const ops = openings(b);
    assert.equal(ops.length, Math.ceil((2 * b.half + k.pier) / (k.span + k.pier)));
    for (const [a, c] of ops) assert.ok(c - a <= k.span + 1e-9);
    if (kind === 'road') {
      // under the deck over each opening's middle the arch's crown, the clearance over the water
      for (const [a, c] of ops) {
        const s = (a + c) / 2, x = cx + s * ax, z = cz + s * az, d = col.raycast([x, b.level + 0.1, z], [0, 1, 0], 50);
        assert.ok(Math.abs(b.level + 0.1 + d - (b.level + k.clearance)) < 1e-3, `the crown over the water (${b.level + 0.1 + d})`);
      }
    }
    const xs = []; for (let i = 0; i < mesh.positions.length; i += 3) xs.push(mesh.positions[i]);
    assert.deepEqual([box[0], box[3]], [Math.min(...xs), Math.max(...xs)]);
  }
  const added = [], solid = [], grown = [];
  const n = standBridges([bridgeShape({ kind: 'road', x: 10.5, y: 10.5, ux: 1, uy: 0, sin: 1, width: 40, level: 50, river: 'r' })], 10, 10, { addStatic: (m, f) => added.push(f), solid: (m, f) => solid.push(f), grow: (b) => grown.push(b) });
  assert.deepEqual([n, added.length, solid.length, grown.length], [1, 1, 1, 1]);
  assert.equal(added[0], PIXEL_FRAME);
});

test('ROAD-LOOK the wiring: the kernel lays the river back under its bridges after the paint and before the smoothing and the waters\' paint, and hands the pixel\'s own bridges back; the host stands them with its statics and its bucket through the gate (mutants: the unpave dropped; the bridges unreturned; the host never standing them)', () => {
  const k = read('src/world/terrain/terrainGen.js');
  const i0 = k.indexOf('curve: arena ? { px, py, byteAt: arenaRoadByte } : null,'), i1 = k.indexOf('if (arena && landforms) { unpaveBridges(tilemap, paths, px, py, arenaRoadByte); bridges = bridgesOf(px, py, arenaRoadByte); }');
  const i2 = k.indexOf('if (roads.smooth !== false) smoothRoadHeights(samples'), i3 = k.indexOf('paintTamrielWaters(tileData, px, py, hasLocation ? locationRect : null, undefined, paths);');
  assert.ok(i0 > 0 && i1 > i0 && i2 > i1 && i3 > i2, 'the paint, the bridges, the smoothing, the waters');
  assert.match(k, /\n {4}bridges,   \/\/ ROAD-LOOK/);
  const p = read('src/scenes/pixelBuild.js');
  assert.match(p, /townGround, arenaRoads, bridges, meets, settlement \} = await terrainGen\.generate\(\{/);   // PIN MOVED (RMB-CONTRACTS RMBC4): and the settlement. PIN MOVED (FB1029 ACROSS-EDGE): the pixel's town meets answered last
  assert.match(p, /standBridges\(bridges, px, py, \{ addStatic: \(m, at\) => addStatic\(m, at, true\), solid: \(m, at\) => late\.add\(key, m\.positions, m\.indices, at, \{ translation: bridgeBucket \}\), grow: unionBox \}\);/);
});

test('ROAD-LOOK a carved lake is water no road crosses: the routes\' land takes it as water (its shore the shore\'s) and never as a ford, where the same strip of the trace\'s water a ford spans; the regions\' build marks the lakes before its nodes; the roads\' version moves (mutants: the still mask unread; the lakes unmarked; the version)', async () => {
  const N = MAP_W * MAP_H, heights = new Uint8Array(N).fill(20), water = new Uint8Array(N), still = new Uint8Array(N);
  for (let y = 0; y < MAP_H; y++) { water[y * MAP_W + 500] = 1; }   // a strip a pixel wide down column 500
  const open = landForRoutes(heights, water, null, MAP_W, MAP_H, VOYAGER_DIALS);
  assert.equal(open.ford[200 * MAP_W + 500], 1, 'the trace\'s strip a ford');
  for (let y = 0; y < MAP_H; y++) still[y * MAP_W + 500] = 1;
  const lake = landForRoutes(heights, water, null, MAP_W, MAP_H, VOYAGER_DIALS, null, still);
  assert.equal(lake.ford[200 * MAP_W + 500], 0, 'a lake\'s never');
  assert.equal(lake.shore[200 * MAP_W + 499], 1, 'its shore the shore\'s');
  const isWater = (u, v) => water[v * MAP_W + u] === 1 && lake.ford[v * MAP_W + u] === 0;
  assert.equal(route({ x: 480, y: 200 }, { x: 520, y: 200 }, { heightAt: () => 20, isWater, existing: new Uint8Array(N), d: {}, terrain: lake }), null, 'no route across a lake');
  const s = read('src/world/tamrielRoads.js');
  const a = s.indexOf('const still = lakeRaster(gx, gy, MAP_W, MAP_H, LAKE_MARGIN);'), b = s.indexOf('for (const n of [...nodes.filter(roadGrade)');
  assert.ok(a > 0 && b > a, 'the lakes marked before the nodes stand on their own land');
  assert.match(s, /\n {2}for \(let i = 0; i < still\.length; i\+\+\) if \(still\[i\] && !bay\[i\]\) water\[i\] = 1;\n/, 'a lake\'s pixel the routes\' water (the Bay\'s own network\'s none of it)');
  assert.match(s, /const land = landForRoutes\(heights, water, bay, MAP_W, MAP_H, VOYAGER_DIALS, \(u, v\) => landGrain\(gx \+ u, gy \+ v\), still\);/);
  const { TAMRIEL_ROADS_VERSION, LAKE_MARGIN } = await import('../../../src/world/tamrielRoads.js');
  assert.deepEqual([TAMRIEL_ROADS_VERSION, LAKE_MARGIN], [8, 0.25]);
});

test('ROAD-LOOK the map marks each bridge the kernel stands: in to the Bay\'s scale (`near`) the road\'s two parapets either side of it, along it over the river\'s width - off the installed layer and the map\'s own copy of the rivers (watersInk: no level, its widths in Float32) - and no mark for a ford, a kind its filter hides, a band out from the Bay\'s scale, or a river north of the Bay\'s first row read as another pixel\'s (mutants: the ink law\'s index; the ford marked; the filter unread; the near band unasked; the key\'s row read down)', () => {
  const PX = 2010;   // past the Bay: the layer's own
  const ew = DIR.E | DIR.W;
  const inkOf = (law) => ({ rivers: law.rivers.map((r) => ({ key: r.key, n: r.n, pts: Float32Array.from(r.pts), width: Float32Array.from(r.width) })), lakes: [] });
  const marks = (ink, view, filters = {}) => {
    const strokes = [];
    let pts = [];
    const ctx = { lineWidth: 1, strokeStyle: '', setLineDash() {}, beginPath() { pts = []; }, moveTo(x, y) { pts.push([x, y]); }, lineTo(x, y) { pts.push([x, y]); }, stroke() { strokes.push({ width: ctx.lineWidth, style: ctx.strokeStyle, pts }); } };
    return { n: paintBridges(ctx, view, 400, 400, ink, filters), strokes };
  };
  try {
    for (const [top, py] of [[0, 10], [-20, -10]]) {
      const law = riverLaw({ x: PX + 0.5, width: 60, top }), ink = inkOf(law);
      setArenaRoads({ roads: new Map([[beyondKey(PX, py), ew], [beyondKey(PX - 1, py), ew], [beyondKey(PX + 1, py), ew]]), tracks: new Map() });
      const kernel = bridgesOf(PX, py, (kind, x, y) => (kind === 'roads' && Math.abs(x - PX) <= 1 && y === py ? ew : 0), law);
      assert.equal(kernel.length, 1);
      const map = bridgesOf(PX, py, (kind, x, y) => (kind === 'roads' && Math.abs(x - PX) <= 1 && y === py ? ew : 0), inkBridgeLaw(ink));
      assert.ok(map.length === 1 && Math.abs(map[0].x - kernel[0].x) < 1e-4 && Math.abs(map[0].y - kernel[0].y) < 1e-4 && Math.abs(map[0].half - kernel[0].half) < 1e-3, `the map's bridge the kernel's (row ${py})`);
      const view = { ox: PX - 1, oy: py - 1, scale: 200 };
      const { n, strokes } = marks(ink, view);
      assert.equal(n, 1, `one bridge on the sheet (row ${py})`);
      assert.equal(strokes.length, 1);
      assert.deepEqual([strokes[0].width, strokes[0].style], [BRIDGE_MARK.width, PEN.line], 'in the line\'s own pen');
      const L = Math.max(kernel[0].half / 819.2, BRIDGE_MARK.least / view.scale) * view.scale, cx = (kernel[0].x - view.ox) * view.scale, cy = (kernel[0].y - view.oy) * view.scale;
      // its two chains (each a pair of points), whichever way the curve runs: each pair's ends sorted west to east, the pairs
      // north to south
      const want = [-1, 1].flatMap((side) => [[cx - L, cy + side * BRIDGE_MARK.gap], [cx + L, cy + side * BRIDGE_MARK.gap]]);
      assert.equal(strokes[0].pts.length, 4);
      const got = [strokes[0].pts.slice(0, 2), strokes[0].pts.slice(2)].map((c) => [...c].sort((a, b) => a[0] - b[0])).sort((a, b) => a[0][1] - b[0][1]).flat();
      for (let i = 0; i < 4; i++) assert.ok(Math.abs(got[i][0] - want[i][0]) < 1e-3 && Math.abs(got[i][1] - want[i][1]) < 1e-3, `a parapet ${BRIDGE_MARK.gap} paper pixels off the road along it (${got[i]} against ${want[i]})`);
      assert.ok(Math.abs(L - 30 / 819.2 * 200) < 1e-3, 'over the river\'s width');
      assert.equal(marks(ink, view, { roads: true }).n, 0, 'the roads hidden: none');
      assert.equal(marks(ink, { ox: PX + 40, oy: py + 40, scale: 200 }).n, 0, 'off the view: none');
      assert.equal(marks(inkOf(riverLaw({ x: PX + 0.5, width: 20, top })), view).n, 0, 'a ford: none');
    }
    // the sheet: the near band marks it, the mid band none
    const law = riverLaw({ x: PX + 0.5, width: 60 });
    setArenaRoads({ roads: new Map([[beyondKey(PX, 10), ew], [beyondKey(PX - 1, 10), ew], [beyondKey(PX + 1, 10), ew]]), tracks: new Map() });
    setWatersInk(inkOf(law));
    const sheet = (band) => {
      const strokes = [];
      let pts = [];
      const ctx = {
        lineWidth: 1, strokeStyle: '', fillStyle: '', lineCap: '', lineJoin: '', globalAlpha: 1, font: '', textAlign: '', textBaseline: '',
        save() {}, restore() {}, setLineDash() {}, beginPath() { pts = []; }, moveTo(x, y) { pts.push([x, y]); }, lineTo(x, y) { pts.push([x, y]); },
        stroke() { strokes.push({ width: ctx.lineWidth, style: ctx.strokeStyle, pts }); }, fill() {}, rect() {}, arc() {}, closePath() {},
        fillText() {}, strokeText() {}, drawImage() {}, setTransform() {}, clearRect() {}, clip() {},
      };
      paintPastBay(ctx, { ox: PX - 1, oy: 9, scale: 40 }, { paperW: 120, paperH: 120, band, continent: false, filters: {} });
      return strokes.filter((s) => s.width === BRIDGE_MARK.width && s.style === PEN.line && s.pts.length === 4).length;
    };
    assert.equal(sheet('near'), 1, 'the near band marks it');
    assert.equal(sheet('mid'), 0, 'the mid band none');
  } finally { setArenaRoads(null); setWatersInk(null); }
});

// ── WITH ARENA2: the freeware's own Cyrodiil ────────────────────
const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'ART_PAL.COL'].every((f) => existsSync(join(ARENA2, f)));
test('ROAD-LOOK on the freeware\'s Cyrodiil: a road across each carved river where it is widest is a bridge at its width and level, a road across a stream under Basic Roads\' width a ford; every carved lake has pixels the routes take as water, its shore within the margin too (mutants: the law\'s width or level unread; the margin unread)', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const { DFPalette } = await import('../../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../../src/ui/tamrielTrace.js');
  const { setTamrielTrace } = await import('../../../src/world/tamriel/tamrielLand.js');
  const { setTamrielFit } = await import('../../../src/world/tamriel/tamrielFrame.js');
  const { tamrielWaters, riverPixel, lakeRaster } = await import('../../../src/world/tamriel/tamrielWaters.js');
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  try {
    const law = tamrielWaters();
    let bridged = 0, forded = 0;
    for (const r of law.rivers) {
      // the pixel at its widest and at its narrowest point, a road square across its flow there
      for (const i of [r.width.indexOf(Math.max(...r.width)), r.width.indexOf(Math.min(...r.width))]) {
        const x = Math.floor(r.pts[2 * i]), y = Math.floor(r.pts[2 * i + 1]), p = riverPixel(x, y);
        if (!p) continue;
        const across = (p.dir & (DIR.N | DIR.S)) ? DIR.E | DIR.W : (p.dir & (DIR.E | DIR.W)) ? DIR.N | DIR.S : (p.dir & (DIR.NE | DIR.SW)) ? DIR.NW | DIR.SE : DIR.NE | DIR.SW;
        const c = crossingsOf(x, y, layer({ [`${x},${y}`]: across }), law);
        const list = bridgesOf(x, y, layer({ [`${x},${y}`]: across }), law);
        if (!c.length) continue;
        for (const o of c) { const q = law.rivers.find((v) => v.key === o.river); assert.ok(o.width >= Math.min(...q.width) - 1e-3 && o.width <= Math.max(...q.width) + 1e-3 && o.level >= Math.min(...q.level) * 1.25 - 1e-3 && o.level <= Math.max(...q.level) * 1.25 + 1e-3, `${o.river}: its own width and level`); }
        if (c.some((o) => o.width > BRIDGE.fordMax)) { assert.ok(list.length > 0, `${r.key}: a bridge`); bridged++; } else { assert.equal(list.length, 0, `${r.key}: a ford`); forded++; }
      }
    }
    assert.ok(bridged >= 8, `the rivers bridged where wide (${bridged})`);
    assert.ok(forded >= 1, `and forded where narrow (${forded})`);
    let lakePixels = 0;
    for (const l of law.lakes) {
      const x0 = Math.floor(l.box[0]) - 2, y0 = Math.floor(l.box[1]) - 2, w = Math.ceil(l.box[2] - l.box[0]) + 5, h = Math.ceil(l.box[3] - l.box[1]) + 5;
      const ras = lakeRaster(x0, y0, w, h, 0.25);
      let n = 0; for (const v of ras) n += v;
      let inside = 0; for (const v of lakeRaster(x0, y0, w, h, 0)) inside += v;
      assert.ok(n > inside, `${l.key}: the margin takes its shore's pixels too (${n} against ${inside})`);
      assert.ok(n > 0, `${l.key}: its pixels`);
      lakePixels += n;
    }
    assert.ok(lakePixels > 10);
  } finally { setTamrielTrace(null); setTamrielFit(null); }
});
