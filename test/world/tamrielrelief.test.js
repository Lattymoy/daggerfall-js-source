// TAMRIEL-RELIEF (2026-10-24, bible/03-World/Tamriel.md TAMRIEL-RELIEF; the owner: "This is the heightmap. Use it"): the
// owner's heightmap of the continent laid on the trace (tools/bakeTamrielRelief.mjs), the land past the Bay standing at
// its heights (world/tamriel/tamrielGround.js authoredHeightByte) and the peaks zones on its high ground
// (world/tamriel/tamrielBiomes.js biomeAtPicture) - the coast the trace's, the authored law with no trace. Where
// ARENA2_PATH names the data, the bake re-run and held to the module byte for byte, and the player's own trace read.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { RELIEF_DATA } from '../../src/world/tamriel/tamrielReliefData.js';
import {
  decodeRelief, reliefStands, reliefAt, peaksLine, namedSummit, RELIEF_SCALE, RELIEF_COAST_REACH, PEAKS_SHARE, PEAKS_FLOOR,
  NAMED_SEEK, NAMED_REACH,
} from '../../src/world/tamriel/tamrielRelief.js';
import { setTamrielTrace, coastDistanceAt } from '../../src/world/tamriel/tamrielLand.js';
import { setTamrielFit } from '../../src/world/tamriel/tamrielFrame.js';
import { authoredHeightByte, SHORE_BYTE } from '../../src/world/tamriel/tamrielGround.js';
import { biomeAtPicture } from '../../src/world/tamriel/tamrielBiomes.js';
import { MOUNTAIN_RANGES } from '../../src/world/tamriel/tamrielGeography.js';
import { CEILING_BYTE, TOP_RANK, calibrate, encodeCells, bakeRelief, moduleText, FIT, SOURCE, OUT } from '../../tools/bakeTamrielRelief.mjs';

const ROOT = new URL('../..', import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

/** A 320 x 200 trace of Morrowind in a box (picture units 200..290 x 30..100), with relief: a plain at 20, Vvardenfell's
 *  cone (120 at 235, 54) and the Valus' ridge (128 at 215, 88) - or none. */
function morrowindTrace({ relief = true } = {}) {
  const w = 320, h = 200, land = new Uint8Array(w * h), province = new Uint8Array(w * h);
  for (let y = 30; y < 100; y++) for (let x = 200; x < 290; x++) { land[y * w + x] = 1; province[y * w + x] = 4; }
  if (!relief) return { w, h, land, province };
  const s = RELIEF_SCALE, cells = new Uint8Array(w * s * h * s);
  for (let j = 0; j < h * s; j++) for (let i = 0; i < w * s; i++) {
    const px = (i + 0.5) / s, py = (j + 0.5) / s;
    if (!land[Math.floor(py) * w + Math.floor(px)]) continue;
    const cone = 120 - 8 * Math.hypot(px - 235, py - 54), ridge = 128 - 8 * Math.hypot(px - 215, py - 88);
    cells[j * w * s + i] = Math.max(20, Math.round(cone), Math.round(ridge));
  }
  return { w, h, land, province, relief: cells };
}

test('TAMRIEL-RELIEF the module: a 640 x 400 grid, two cells a picture unit, its land in WOODS bytes under CEILING_BYTE; the curve never falls, the Bay\'s own ranks to TOP_RANK, a line to the ceiling after (mutants: the cells\' runs misread; the curve falling)', () => {
  assert.deepEqual([RELIEF_DATA.w, RELIEF_DATA.h, RELIEF_DATA.scale, RELIEF_SCALE], [640, 400, 2, 2]);
  const cells = decodeRelief(RELIEF_DATA);
  assert.equal(cells.length, 640 * 400);
  let land = 0, max = 0;
  for (const v of cells) if (v) { land++; max = Math.max(max, v); }
  assert.ok(land > 100_000 && land < 110_000, `the trace's land, four cells a unit (${land})`);
  assert.ok(max <= CEILING_BYTE && max > 150, `the highest cell ${max}`);
  const curve = Buffer.from(RELIEF_DATA.curve, 'base64');
  assert.equal(curve.length, 256);
  for (let g = 1; g < 256; g++) assert.ok(curve[g] >= curve[g - 1], `the curve never falls (${g})`);
  assert.equal(curve[255], CEILING_BYTE);
  // the run code round-trips, a run of sea longer than 255 split
  const back = decodeRelief({ w: 600, h: 1, scale: 2, cells: encodeCells(Uint8Array.from({ length: 600 }, (_, i) => (i % 290 === 7 ? 9 : 0))) });
  assert.deepEqual([...back].map((v, i) => [v, i]).filter(([v]) => v).map(([, i]) => i), [7, 297, 587]);
  // calibrate: the Bay's ranks, then a line from TOP_RANK to the ceiling
  const pairs = Array.from({ length: 1000 }, (_, i) => [i / 10, Math.round(i / 20)]);
  const c = calibrate(pairs);
  assert.equal(c[50], 25, 'a brightness takes the byte at its rank');
  assert.equal(TOP_RANK, 0.99);
  assert.equal(c[255], CEILING_BYTE);
  assert.ok(c[150] > c[99] && c[150] < CEILING_BYTE, 'past the Bay\'s brightest, the line');
});

test('TAMRIEL-RELIEF the height: where the trace carries the relief the land stands at it - eased up from SHORE_BYTE over RELIEF_COAST_REACH from the trace\'s coast, the lattice hash on it, never under SHORE_BYTE, 0 at sea; a trace without it stands the authored law (mutants: the relief unread; the coast\'s ease gone; the floor gone)', () => {
  try {
    setTamrielTrace(morrowindTrace({ relief: false }));
    assert.equal(reliefStands(), false, 'a trace without cells');
    const authored = authoredHeightByte(235.2, 54.2);
    setTamrielTrace(morrowindTrace());
    assert.equal(reliefStands(), true);
    assert.equal(authoredHeightByte(150, 150), 0, 'the sea');
    const peak = authoredHeightByte(235.2, 54.2);
    assert.ok(Math.abs(peak - Math.round(reliefAt(235.2, 54.2))) <= 0, `Vvardenfell's cone (${peak})`);
    assert.ok(peak > 100 && peak !== authored, 'the heightmap, not the authored law');
    assert.ok(Math.abs(authoredHeightByte(260.2, 70.2, 1.6) - authoredHeightByte(260.2, 70.2) - 2) <= 0, 'the noise added');
    // the coast's ease: a land point a fraction of RELIEF_COAST_REACH inland stands that fraction up from the shore
    const px = 200.3, py = 70.2, d = coastDistanceAt(px, py);
    assert.ok(d < RELIEF_COAST_REACH);
    assert.equal(authoredHeightByte(px, py), Math.round(SHORE_BYTE + (reliefAt(px, py) - SHORE_BYTE) * (d / RELIEF_COAST_REACH)));
    assert.equal(authoredHeightByte(260.2, 70.2, -40), SHORE_BYTE, 'never under the shore');
    setTamrielTrace(null);
    assert.equal(reliefStands(), false, 'no trace: the authored law');
  } finally { setTamrielTrace(null); }
});

test('TAMRIEL-RELIEF the peaks: a province\'s peaks zone is its highest PEAKS_SHARE of land by the relief, never under PEAKS_FLOOR; a named range (Red Mountain) at the heightmap\'s summit nearest its authored spine, within NAMED_REACH of it - Vvardenfell\'s cone Red Mountain, the Valus\' ridge the Velothi, the plain neither (mutants: the share; the floor; the summit\'s seek; the named reach; the peaks unread)', () => {
  assert.deepEqual([PEAKS_SHARE, PEAKS_FLOOR, NAMED_SEEK, NAMED_REACH], [0.08, 40, 30, 10]);
  try {
    const t = morrowindTrace();
    setTamrielTrace(t);
    const vals = [...t.relief].filter((v) => v).sort((a, b) => b - a);
    const share = vals[Math.floor(vals.length * PEAKS_SHARE)];
    assert.ok(share > PEAKS_FLOOR, 'the fixture\'s highest share over the floor');
    assert.equal(peaksLine('Morrowind'), share, 'the relief its highest share stands at');
    assert.equal(peaksLine('Skyrim'), 256, 'a province with no land holds no peaks');
    const red = MOUNTAIN_RANGES.find((m) => m.name === 'Red Mountain');
    const s = namedSummit('Morrowind', 'Red Mountain', red.pts);
    assert.ok(s && Math.hypot(s[0] - 235, s[1] - 54) < 1, `Red Mountain's summit Vvardenfell's cone (${s})`);
    assert.equal(biomeAtPicture('Morrowind', 235.2, 54.2)?.key, 'morrowindRedMountain');
    assert.equal(biomeAtPicture('Morrowind', 215.2, 88.2)?.key, 'morrowindVelothi', 'the ridge past NAMED_REACH: the province\'s peaks');
    const low = biomeAtPicture('Morrowind', 270.2, 35.2);
    assert.ok(low && !low.peaks, `the plain a seeded zone (${low?.key})`);
    // the floor: a province whose highest share stands under PEAKS_FLOOR holds no peaks
    const flat = morrowindTrace();
    flat.relief = flat.relief.map((v) => (v ? 30 : 0));
    setTamrielTrace(flat);
    assert.equal(peaksLine('Morrowind'), PEAKS_FLOOR);
    assert.ok(!biomeAtPicture('Morrowind', 235.2, 54.2)?.peaks, 'flat land: no peaks');
  } finally { setTamrielTrace(null); }
});

test('TAMRIEL-RELIEF the wiring, by source: the data its own chunk (no static import of it), hung on the trace as it is made, carried by every copy of the trace - its install, the terrain worker\'s message (transferred), the roads worker\'s - and in the roads\' cache print; the zones\' version moved (mutants: the trace\'s copy dropping it; the worker\'s message dropping it; the print blind to it)', () => {
  const statics = [];
  const walk = (dir) => {
    for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (p.endsWith('.js') && /^\s*import\s[^(]*tamrielReliefData/m.test(read(p))) statics.push(p);
    }
  };
  walk('src');
  assert.deepEqual(statics, [], 'nothing imports the data statically');
  assert.match(read('src/world/tamriel/tamrielRelief.js'), /const \{ RELIEF_DATA \} = await import\('\.\/tamrielReliefData\.js'\);/);
  assert.match(read('src/ui/tamrielTrace.js'), /if \(trace\) trace\.relief = await loadRelief\(trace\);/);
  assert.match(read('src/world/tamriel/tamrielLand.js'), /relief: trace\.relief \?\? null \};/);
  const client = read('src/world/terrain/terrainGenClient.js');
  assert.match(client, /relief: trace\.relief \? trace\.relief\.slice\(\) : null \}/);
  assert.match(client, /\.\.\.\(t\.relief \? \[t\.relief\.buffer\] : \[\]\)/);
  assert.match(read('src/scenes/tamrielRoadsHost.js'), /const trace = tamrielTrace\(\), fit = tamrielFit\(\);/, 'the roads worker takes the installed trace whole');
  assert.match(read('src/world/tamrielRoads.js'), /if \(trace\?\.relief\) for \(let i = 0; i < trace\.relief\.length; i \+= 7\) mix\(trace\.relief\[i\] \* 131 \+ i\);/);
  assert.match(read('src/world/tamriel/tamrielGround.js'), /if \(reliefStands\(\)\) \{\n\s+const ease = Math\.min\(1, coastDistanceAt\(px, py\) \/ RELIEF_COAST_REACH\);/);
  assert.match(read('src/world/tamriel/tamrielBiomes.js'), /export const BIOMES_VERSION = [34];/);   // IC-RING moved it on
  assert.ok(existsSync(join(ROOT, SOURCE)), 'the owner\'s heightmap is committed as the bake\'s source');
});

const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'MAP.PAL', 'ART_PAL.COL', 'WOODS.WLD'].every((f) => existsSync(join(ARENA2, f)));
test('TAMRIEL-RELIEF with ARENA2: the bake re-run is the module byte for byte; on the player\'s own trace the relief stands, the coast is the trace\'s to the pixel, Skyrim\'s summit stands in the High Peaks and Vvardenfell\'s is Red Mountain', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const fetchBytes = async (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const { DFPalette } = await import('../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../src/ui/tamrielTrace.js');
  const { WoodsFile } = await import('../../src/formats/woodsFile.js');
  const { bayToPicture, pictureToBay, tamrielFrameInBay } = await import('../../src/world/tamriel/tamrielFrame.js');
  const { groundWoods, bayEdgeDistance, SEAM_PX, BLEND_PX } = await import('../../src/world/tamriel/tamrielGround.js');
  const { provinceKeyAt } = await import('../../src/world/tamriel/tamrielLand.js');
  const { tamrielBiomeAt } = await import('../../src/world/tamriel/tamrielBiomes.js');
  const pal = new DFPalette(); pal.load(await fetchBytes('ART_PAL.COL'), 'ART_PAL.COL');
  const trace = await preloadTamrielTrace({ fetchBytes, palette: pal });
  const woods = new WoodsFile(); woods.load(await fetchBytes('WOODS.WLD'));
  try {
    setTamrielFit(FIT);
    const r = await bakeRelief({ heightmapBytes: readFileSync(join(ROOT, SOURCE)), trace: { ...trace, relief: null }, woods, bayToPicture });
    assert.equal(moduleText(r), read(OUT), 'the module is the bake\'s');
    assert.ok(r.iouWarp > r.iouFit && r.iouWarp > 0.9, `the warp brings the coasts on (${r.iouFit} -> ${r.iouWarp})`);
    assert.ok(trace.relief, 'the trace carries the relief');
    setTamrielTrace(trace);
    assert.equal(reliefStands(), true);
    const g = groundWoods(woods), f = tamrielFrameInBay();
    let bad = 0;
    for (let y = f.y0; y < f.y0 + f.h; y += 23) for (let x = f.x0; x < f.x0 + f.w; x += 23) {
      if (bayEdgeDistance(x, y) <= SEAM_PX + BLEND_PX) continue;
      const [px, py] = bayToPicture(x + 0.5, y + 0.5);
      if ((g.getHeightMapValue(x, y) > 3) !== !!provinceKeyAt(px, py)) bad++;
    }
    assert.equal(bad, 0, 'land where the trace has land, sea where it has sea');
    const at = (px, py) => pictureToBay(px, py).map(Math.floor);
    const [sx, sy] = at(171.75, 63.75), [rx, ry] = at(234.75, 53.75);
    assert.ok(g.getHeightMapValue(sx, sy) > 160, 'Skyrim\'s summit, over the Bay\'s highest common ground');
    assert.equal(tamrielBiomeAt(sx, sy)?.key, 'skyrimPeaks');
    assert.equal(tamrielBiomeAt(rx, ry)?.key, 'morrowindRedMountain');
  } finally { setTamrielTrace(null); setTamrielFit(null); }
});
