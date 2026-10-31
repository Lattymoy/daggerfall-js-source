// TAMRIEL-RELIEF (2026-10-24, bible/03-World/Tamriel.md TAMRIEL-RELIEF; the owner: "This is the heightmap. Use it"): the
// owner's heightmap of the continent laid on the trace (tools/bakeTamrielRelief.mjs), the land past the Bay standing at
// its heights (world/tamriel/tamrielGround.js authoredHeightByte) and the peaks zones on its high ground
// (world/tamriel/tamrielBiomes.js biomeAtPicture) - the coast the trace's, the authored law with no trace. Where
// ARENA2_PATH names the data, the bake re-run and held to the module byte for byte, and the player's own trace read.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RELIEF_DATA } from '../../src/world/tamriel/tamrielReliefData.js';
import {
  decodeRelief, maskRelief, reliefStands, reliefAt, peaksLine, namedSummit, RELIEF_SCALE, RELIEF_COAST_REACH, RELIEF_FLOOR, PEAKS_SHARE,
  PEAKS_FLOOR, NAMED_SEEK, NAMED_REACH,
} from '../../src/world/tamriel/tamrielRelief.js';
import { setTamrielTrace, coastDistanceAt, coastDepthAt } from '../../src/world/tamriel/tamrielLand.js';
import { setTamrielFit } from '../../src/world/tamriel/tamrielFrame.js';
import { authoredHeightByte, SHORE_BYTE, straitAt, STRAIT_PX } from '../../src/world/tamriel/tamrielGround.js';
import { biomeAtPicture, PEAKS_SEEK } from '../../src/world/tamriel/tamrielBiomes.js';
import { WATER_BYTE } from '../../src/world/roadsProducer.js';
import { bayPictureRect } from '../../src/world/tamriel/tamrielFrame.js';
import { MOUNTAIN_RANGES } from '../../src/world/tamriel/tamrielGeography.js';
import { CEILING_BYTE, TOP_RANK, LAND_LEVEL, calibrate, encodeCells, bakeRelief, bakeFit, moduleText, SOURCE, OUT } from '../../tools/bakeTamrielRelief.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

/** A 320 x 200 trace of Morrowind in a box (picture units 200..290 x 30..100), with relief: a plain at 20, Vvardenfell's
 *  cone (120 at 235, 54), the Valus' ridge (128 at 215, 88) and a lone height far from every range (100 at 280, 90) - or
 *  none. AUDIT TESA II G7: and a strip of Skyrim north of it (240..260 x 20..30) higher than the cone (150), within
 *  NAMED_SEEK of Red Mountain's spine - a summit of another province, which Red Mountain's is never. */
function morrowindTrace({ relief = true } = {}) {
  const w = 320, h = 200, land = new Uint8Array(w * h), province = new Uint8Array(w * h);
  for (let y = 30; y < 100; y++) for (let x = 200; x < 290; x++) { land[y * w + x] = 1; province[y * w + x] = 4; }
  for (let y = 20; y < 30; y++) for (let x = 240; x < 260; x++) { land[y * w + x] = 1; province[y * w + x] = 3; }
  if (!relief) return { w, h, land, province };
  const s = RELIEF_SCALE, cells = new Uint8Array(w * s * h * s);
  for (let j = 0; j < h * s; j++) for (let i = 0; i < w * s; i++) {
    const px = (i + 0.5) / s, py = (j + 0.5) / s, k = Math.floor(py) * w + Math.floor(px);
    if (!land[k]) continue;
    if (province[k] === 3) { cells[j * w * s + i] = 150; continue; }
    const cone = 120 - 8 * Math.hypot(px - 235, py - 54), ridge = 128 - 8 * Math.hypot(px - 215, py - 88), lone = 100 - 8 * Math.hypot(px - 280, py - 90);
    const spine = 100 - 16 * Math.hypot(px - 253, py - 40);   // on Red Mountain's authored spine, past NAMED_REACH of the cone
    cells[j * w * s + i] = Math.max(20, Math.round(cone), Math.round(ridge), Math.round(lone), Math.round(spine));
  }
  return { w, h, land, province, relief: cells };
}

test('TAMRIEL-RELIEF the module: a 640 x 400 grid, two cells a picture unit, every cell a height in WOODS bytes under CEILING_BYTE - the sea\'s too, so the module carries no land of the trace\'s (AUDIT TESA II G1); the curve never falls, the Bay\'s own ranks to TOP_RANK, a line to the ceiling after (mutants: the cells\' runs misread; the curve falling; the bake masking the cells)', () => {
  assert.deepEqual([RELIEF_DATA.w, RELIEF_DATA.h, RELIEF_DATA.scale, RELIEF_SCALE], [640, 400, 2, 2]);
  const cells = decodeRelief(RELIEF_DATA);
  assert.equal(cells.length, 640 * 400);
  let zeros = 0, max = 0;
  for (const v of cells) { if (!v) zeros++; max = Math.max(max, v); }
  assert.equal(zeros, 0, 'no cell is 0 - the module holds no sea, the trace\'s or any (Port-Doctrine: A RENDER OF GAME DATA IS GAME DATA)');
  assert.ok(max <= CEILING_BYTE && max > 150, `the highest cell ${max}`);
  const curve = Buffer.from(RELIEF_DATA.curve, 'base64');
  assert.equal(curve.length, 256);
  for (let g = 1; g < 256; g++) assert.ok(curve[g] >= curve[g - 1], `the curve never falls (${g})`);
  assert.equal(curve[255], CEILING_BYTE);
  // the run code round-trips - a run of one byte longer than 255 split, a short one written out - and refuses a 0
  const raw = Uint8Array.from({ length: 600 }, (_, i) => (i % 290 === 7 ? 9 : i < 3 ? 40 + i : 4));
  assert.deepEqual([...decodeRelief({ w: 600, h: 1, scale: 2, cells: encodeCells(raw) })], [...raw]);
  assert.ok(Buffer.from(encodeCells(raw), 'base64').length < 30, 'the runs coded');
  assert.throws(() => encodeCells(Uint8Array.of(5, 0, 5)), /a cell of 0/);
  // the mask is the player's machine's: a cell whose picture pixel is sea on the trace is 0, the rest as they were
  const t = morrowindTrace({ relief: false }), every = new Uint8Array(640 * 400).fill(33);
  const masked = maskRelief(Uint8Array.from(every), t);
  for (const [i, j] of [[400, 60], [401, 61], [399, 60], [400, 59], [579, 199], [580, 200]]) {
    assert.equal(masked[j * 640 + i], t.land[Math.floor(j / 2) * 320 + Math.floor(i / 2)] ? 33 : 0, `cell ${i}, ${j}`);
  }
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
    // AUDIT TESA II G7: a cell's height stands at its centre, and half-way between two cells their mean (the grid's half cell)
    const cells = morrowindTrace().relief, ci = 476, cj = 108, c0 = cells[cj * 640 + ci], c1 = cells[cj * 640 + ci + 1];
    assert.ok(c0 !== c1, 'a slope of the cone');
    assert.equal(reliefAt((ci + 0.5) / RELIEF_SCALE, (cj + 0.5) / RELIEF_SCALE), c0, 'at its centre, the cell');
    assert.equal(reliefAt((ci + 1) / RELIEF_SCALE, (cj + 0.5) / RELIEF_SCALE), (c0 + c1) / 2, 'between two centres, their mean');
    const peak = authoredHeightByte(235.2, 54.2);
    assert.ok(Math.abs(peak - Math.round(reliefAt(235.2, 54.2))) <= 0, `Vvardenfell's cone (${peak})`);
    assert.ok(peak > 100 && peak !== authored, 'the heightmap, not the authored law');
    assert.ok(Math.abs(authoredHeightByte(260.2, 70.2, 1.6) - authoredHeightByte(260.2, 70.2) - 2) <= 0, 'the noise added');
    // AUDIT TESA II G4: the coast's ease is the WATERLINE's - a land point a fraction of RELIEF_COAST_REACH in from the
    // waterline stands that fraction up from the shore, and the waterline the shore itself. PIN MOVED (SMOOTH-LAND,
    // test/world/smoothland.test.js): the waterline the land's own smooth one, its distance the law's (coastDepthAt: 0
    // at it), where the trace's sea field read 0.5 at the picture pixel's edge
    assert.deepEqual([RELIEF_COAST_REACH, RELIEF_FLOOR, SHORE_BYTE, WATER_BYTE], [1, 8, 6, 5]);
    assert.ok(Math.abs(coastDistanceAt(200.001, 70.5) - 0.5) < 0.01 && Math.abs(coastDepthAt(200.001, 70.5)) < 0.01, 'the waterline on a straight run the pixel\'s edge, the law\'s 0');
    assert.equal(authoredHeightByte(200.001, 70.5), SHORE_BYTE, 'the shore at the waterline');
    for (const px of [200.3, 200.7]) {
      const py = 70.2, ease = Math.min(1, coastDepthAt(px, py) / RELIEF_COAST_REACH);
      assert.ok(ease > 0 && ease < 1, `${px} inside the ease`);
      assert.equal(authoredHeightByte(px, py), Math.max(Math.round(SHORE_BYTE + (RELIEF_FLOOR - SHORE_BYTE) * ease), Math.round(SHORE_BYTE + (reliefAt(px, py) - SHORE_BYTE) * ease)), `${px}: eased from the waterline`);
    }
    // AUDIT TESA II G12/R1: inland never under RELIEF_FLOOR, at the waterline never under SHORE_BYTE - one over the beach line
    // every reader calls water at or under (roadsProducer.js WATER_BYTE)
    assert.equal(authoredHeightByte(260.2, 70.2, -40), RELIEF_FLOOR, 'never under the floor inland');
    assert.equal(authoredHeightByte(200.001, 70.5, -40), SHORE_BYTE, 'never under the shore');
    assert.ok(SHORE_BYTE > WATER_BYTE, 'the shore over the beach line');
    setTamrielTrace(null);
    assert.equal(reliefStands(), false, 'no trace: the authored law');
    assert.ok(authoredHeightByte(235.2, 54.2, -40) > WATER_BYTE, 'the authored law\'s land over the beach line too');
  } finally { setTamrielTrace(null); }
});

test('TESA x AUDIT TESA II a strait at a corner: where two of the trace\'s sea pixels meet on the diagonal (the other two land), the land within STRAIT_PX Bay pixels of their corner is the sea\'s - a boat\'s step through it, never through a corner of the land; a corner of three seas or of none, or a point past the reach, stays the land it was (mutants: the straits closed; a strait every corner)', () => {
  const w = 4, h = 4, land = new Uint8Array(w * h).fill(1), province = new Uint8Array(w * h).fill(4);
  land[1 * w + 1] = 0; land[2 * w + 2] = 0;   // sea at (1, 1) and (2, 2): they meet at the corner (2, 2)
  try {
    setTamrielTrace({ w, h, land, province });
    setTamrielFit({ ox: 0, oy: 0, ppu: 15.5 });
    const u = 1 / 15.5;
    assert.equal(STRAIT_PX, 1.5);
    assert.equal(straitAt(2 + 1.4 * u, 2 - 1.4 * u), true, 'within the reach of the corner');
    assert.equal(straitAt(2 + 1.6 * u, 2), false, 'past it');
    assert.equal(authoredHeightByte(2 + u, 2 - u), 0, 'its land the sea\'s');
    // PIN MOVED (SMOOTH-LAND, test/world/smoothland.test.js): the land's smooth law opens the strait itself, wider than its
    // own reach - its corners cut a third of a picture pixel along the diagonal - and the shore past that the land's
    assert.equal(authoredHeightByte(2 + 2 * u, 2 - 2 * u), 0, 'the smooth law\'s channel');
    assert.ok(authoredHeightByte(2 + 8 * u, 2 - 8 * u) > WATER_BYTE, 'the shore past it the land\'s');
    assert.equal(straitAt(1, 2), false, 'a corner of one sea pixel stays land');
    land[1 * w + 2] = 0;   // a third sea at the corner: no strait to open, the sea already round it
    setTamrielTrace({ w, h, land, province });
    assert.equal(straitAt(2 + u, 2 - u), false);
  } finally { setTamrielTrace(null); setTamrielFit(null); }
});

test('TAMRIEL-RELIEF the peaks: a province\'s peaks zone is its highest PEAKS_SHARE of land past the Bay by the relief (AUDIT TESA II G11), never under PEAKS_FLOOR, and near its ranges (G5: within PEAKS_SEEK of a peaks range it names none of); a named range (Red Mountain) at the highest cell of its province within NAMED_SEEK of its authored spine (G7: never another province\'s), within NAMED_REACH of it - Vvardenfell\'s cone Red Mountain, the Valus\' ridge the Velothi, a lone height and the plain neither (mutants: the share; the floor; the summit\'s seek; the summit any province\'s; the named reach; the peaks unread; the peaks far from their ranges; the Bay\'s cells counted)', () => {
  assert.deepEqual([PEAKS_SHARE, PEAKS_FLOOR, NAMED_SEEK, NAMED_REACH, PEAKS_SEEK], [0.08, 40, 30, 10, 12]);
  try {
    const t = morrowindTrace();
    setTamrielTrace(t);
    const vals = [...t.relief].filter((v, i) => v && t.province[Math.floor(i / 1280) * 320 + Math.floor((i % 640) / 2)] === 4).sort((a, b) => b - a);
    const share = vals[Math.floor(vals.length * PEAKS_SHARE)];
    assert.ok(share > PEAKS_FLOOR, 'the fixture\'s highest share over the floor');
    assert.equal(peaksLine('Morrowind'), share, 'the relief its highest share stands at');
    assert.equal(peaksLine('Elsweyr'), 256, 'a province with no land holds no peaks');
    const red = MOUNTAIN_RANGES.find((m) => m.name === 'Red Mountain');
    const s = namedSummit('Morrowind', 'Red Mountain', red.pts);
    assert.ok(s && Math.hypot(s[0] - 235, s[1] - 54) < 1, `Red Mountain's summit Vvardenfell's cone, never Skyrim's higher strip within NAMED_SEEK (${s})`);
    assert.equal(biomeAtPicture('Morrowind', 235.2, 54.2)?.key, 'morrowindRedMountain');
    assert.equal(biomeAtPicture('Morrowind', 215.2, 88.2)?.key, 'morrowindVelothi', 'the ridge past NAMED_REACH: the province\'s peaks');
    assert.ok(t.relief[Math.floor(90.2 * 2) * 640 + Math.floor(280.2 * 2)] >= peaksLine('Morrowind'), 'the lone height over the line');
    const lone = biomeAtPicture('Morrowind', 280.2, 90.2);
    assert.ok(lone && !lone.peaks, `a lone height ${PEAKS_SEEK} and more from every range is no range's peaks (${lone?.key})`);
    const low = biomeAtPicture('Morrowind', 270.2, 35.2);
    assert.ok(low && !low.peaks, `the plain a seeded zone (${low?.key})`);
    // AUDIT TESA II G5: a range a zone names is sought by that zone alone - high land on Red Mountain's authored spine, past
    // NAMED_REACH of the cone, is no peaks zone's; nor is a range whose gain the law calls hills (the Colovian Highlands, 0.6)
    assert.ok(t.relief[80 * 640 + 506] >= peaksLine('Morrowind'), 'the spine\'s height over the line');
    const onSpine = biomeAtPicture('Morrowind', 253.2, 40.2);
    assert.ok(onSpine && !onSpine.peaks, `Red Mountain's spine past its reach no other zone's peaks (${onSpine?.key})`);
    // AUDIT TESA II G11: the line is of the land past the Bay - a province's cells inside the Bay's rectangle (WOODS' ground,
    // where no zone stands) are not counted
    const bay = bayPictureRect(), inside = morrowindTrace();
    for (let y = Math.ceil(bay.y0); y < Math.floor(bay.y1); y++) for (let x = Math.ceil(bay.x0); x < Math.floor(bay.x1); x++) { inside.land[y * 320 + x] = 1; inside.province[y * 320 + x] = 4; }
    inside.relief = Uint8Array.from(inside.relief, (v, i) => { const x = (i % 640) / 2, y = Math.floor(i / 640) / 2; return x >= bay.x0 && x < bay.x1 && y >= bay.y0 && y < bay.y1 ? 250 : v; });
    setTamrielTrace(inside);
    assert.equal(peaksLine('Morrowind'), share, 'the Bay\'s own cells move no line');
    // AUDIT TESA II G11: the lines are the land's AND the fit's - the Bay's rectangle moves with the fit, and its cells with it
    setTamrielFit({ ox: 0, oy: 0, ppu: 15.5 });
    assert.ok(peaksLine('Morrowind') > share, `the Bay's rectangle moved off them, its 250s are Morrowind's (${peaksLine('Morrowind')})`);
    setTamrielFit(null);
    assert.equal(peaksLine('Morrowind'), share, 'and back');
    const colovia = (bump) => {
      const w = 320, h = 200, land = new Uint8Array(w * h), province = new Uint8Array(w * h);
      for (let y = 80; y < 112; y++) for (let x = 120; x < 160; x++) { land[y * w + x] = 1; province[y * w + x] = 9; }
      const relief = new Uint8Array(w * 2 * h * 2);
      for (let j = 0; j < h * 2; j++) for (let i = 0; i < w * 2; i++) {
        const px = (i + 0.5) / 2, py = (j + 0.5) / 2;
        if (land[Math.floor(py) * w + Math.floor(px)]) relief[j * w * 2 + i] = bump ? Math.max(20, Math.round(120 - 8 * Math.hypot(px - 136, py - 98))) : 20;
      }
      return { w, h, land, province, relief };
    };
    setTamrielTrace(colovia(false));
    const plain = biomeAtPicture('Imperial', 136.2, 98.2)?.key;
    setTamrielTrace(colovia(true));
    assert.ok(reliefAt(136.2, 98.2) >= peaksLine('Imperial'), 'the Colovian Highlands\' height over the line');
    assert.equal(biomeAtPicture('Imperial', 136.2, 98.2)?.key, plain, `the Colovian Highlands' height its country's (${plain}), never the Jerall's snow`);
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
  assert.match(read('src/world/tamriel/tamrielRelief.js'), /return maskRelief\(decodeRelief\(RELIEF_DATA\), trace\);/, 'AUDIT TESA II G1: the trace\'s mask laid on the player\'s machine');
  assert.match(read('src/ui/tamrielTrace.js'), /if \(trace && relief\) trace\.relief = await loadRelief\(trace\)\.catch\(\(e\) => \{ console\.warn\([^\n]*; return null; \}\);/, 'AUDIT TESA II G2: a relief that does not load is its own loss');
  assert.match(read('tools/bakeTamrielRelief.mjs'), /import \{ RELIEF_SCALE \} from '\.\.\/src\/world\/tamriel\/tamrielRelief\.js';/, 'AUDIT TESA II G8: the grid\'s one home');
  assert.match(read('tools/bakeTamrielRelief.mjs'), /const trace = await preloadTamrielTrace\(\{ fetchBytes, palette: pal, relief: false, niben: false \}\);/, 'AUDIT TESA II G2: the bake never reads its own output - PIN MOVED (NIBEN-SEA): and reads the painting\'s own coasts');
  assert.doesNotMatch(read('tools/bakeTamrielRelief.mjs'), /export const (RELIEF_SCALE|FIT) =/, 'AUDIT TESA II G8: no second literal of the grid or the fit');
  assert.match(read('src/world/tamriel/tamrielLand.js'), /relief: trace\.relief \?\? null \};/);
  const client = read('src/world/terrain/terrainGenClient.js');
  assert.match(client, /relief: trace\.relief \? trace\.relief\.slice\(\) : null \}/);
  assert.match(client, /\.\.\.\(t\.relief \? \[t\.relief\.buffer\] : \[\]\)/);
  assert.match(read('src/scenes/tamrielRoadsHost.js'), /const trace = tamrielTrace\(\), fit = tamrielFit\(\);/, 'the roads worker takes the installed trace whole');
  assert.match(read('src/world/tamrielRoads.js'), /if \(trace\?\.relief\) for \(let i = 0; i < trace\.relief\.length; i\+\+\) mix\(trace\.relief\[i\] \+ 256\);/);   // PIN MOVED (AUDIT TESA II R6): every cell
  assert.match(read('src/world/tamriel/tamrielGround.js'), /if \(reliefStands\(\)\) \{\n\s+const ease = Math\.min\(1, Math\.max\(0, \/\*\* @type \{number\} \*\/ \(coastDepthAt\(px, py\)\)\) \/ RELIEF_COAST_REACH\);/);   // AUDIT TESA II G4 (PIN MOVED, and again SMOOTH-LAND): the waterline's ease, the smooth law's own distance
  assert.match(read('src/world/tamriel/tamrielBiomes.js'), /export const BIOMES_VERSION = 5;/);   // IC-RING moved it on; AUDIT TESA II (PIN MOVED) on again
  assert.ok(existsSync(join(ROOT, SOURCE)), 'the owner\'s heightmap is committed as the bake\'s source');
});

const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'MAP.PAL', 'ART_PAL.COL', 'WOODS.WLD', 'MAPS.BSA', 'CLIMATE.PAK', 'POLITIC.PAK'].every((f) => existsSync(join(ARENA2, f)));
test('TAMRIEL-RELIEF with ARENA2: the bake re-run is the module byte for byte, on the fit the world host makes; the module is not the trace (AUDIT TESA II G1 - its own land is the heightmap\'s, and the trace\'s mask laid here gives the cells the module once carried); on the player\'s own trace the relief stands, the coast is the land\'s smooth law\'s (SMOOTH-LAND) and every land pixel past the blend stands over the beach line (R1); the coasts never a cliff at the water (G4); the peaks near their ranges (G5: Deshaan\'s heart none of the Velothi\'s); Skyrim\'s summit in the High Peaks and Vvardenfell\'s Red Mountain', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const fetchBytes = async (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const { DFPalette } = await import('../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../src/ui/tamrielTrace.js');
  const { WoodsFile } = await import('../../src/formats/woodsFile.js');
  const { MapsFile } = await import('../../src/formats/mapsFile.js');
  const { bayToPicture, pictureToBay, tamrielFrameInBay } = await import('../../src/world/tamriel/tamrielFrame.js');
  const { groundWoods, bayEdgeDistance, SEAM_PX, BLEND_PX } = await import('../../src/world/tamriel/tamrielGround.js');
  const { provinceKeyAt } = await import('../../src/world/tamriel/tamrielLand.js');
  const { rumareMouthPixel } = await import('../../src/world/rumareWaters.js');
  const { tamrielBiomeAt } = await import('../../src/world/tamriel/tamrielBiomes.js');
  const pal = new DFPalette(); pal.load(await fetchBytes('ART_PAL.COL'), 'ART_PAL.COL');
  const trace = await preloadTamrielTrace({ fetchBytes, palette: pal });
  const woods = new WoodsFile(); woods.load(await fetchBytes('WOODS.WLD'));
  const maps = new MapsFile(); maps.load(await fetchBytes('MAPS.BSA'), await fetchBytes('CLIMATE.PAK'), await fetchBytes('POLITIC.PAK'));
  try {
    const fit = bakeFit({ trace, woods, maps });
    assert.deepEqual(fit, { ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 }, 'the freeware\'s fit (test/ui/tamriel4.test.js)');
    setTamrielFit(fit);
    const painted = await preloadTamrielTrace({ fetchBytes, palette: pal, relief: false, niben: false });   // PIN MOVED (NIBEN-SEA): the bake's own reading
    const r = await bakeRelief({ heightmapBytes: readFileSync(join(ROOT, SOURCE)), trace: painted, woods, bayToPicture });
    assert.equal(moduleText(r), read(OUT), 'the module is the bake\'s');
    assert.ok(r.iouWarp > r.iouFit && r.iouWarp > 0.9, `the warp brings the coasts on (${r.iouFit} -> ${r.iouWarp})`);
    // AUDIT TESA II G1: the module carries none of the trace - its own land (the heightmap's, at LAND_LEVEL's byte) is not the
    // trace's - and the player's own trace masks it to the cells it once shipped
    const raw = decodeRelief(RELIEF_DATA), lvl = Buffer.from(RELIEF_DATA.curve, 'base64')[LAND_LEVEL];
    let differ = 0;
    for (let y = 0; y < trace.h; y++) for (let x = 0; x < trace.w; x++) {
      const m = (raw[2 * y * 640 + 2 * x] + raw[2 * y * 640 + 2 * x + 1] + raw[(2 * y + 1) * 640 + 2 * x] + raw[(2 * y + 1) * 640 + 2 * x + 1]) / 4;
      if ((m >= lvl) !== !!trace.land[y * trace.w + x]) differ++;
    }
    assert.ok(differ > 1000, `the module's land is not the trace's (${differ} picture pixels apart)`);
    assert.ok(trace.relief && trace.relief.every((v, i) => v === (trace.land[Math.floor(i / 1280) * trace.w + Math.floor((i % 640) / 2)] ? raw[i] : 0)), 'the trace carries the cells, masked by its own land');
    assert.equal(trace.relief.filter((v) => v).length, 4 * trace.land.reduce((n, v) => n + v, 0), 'four cells a land pixel');
    setTamrielTrace(trace);
    assert.equal(reliefStands(), true);
    // the coast the land's smooth law's, and AUDIT TESA II R1: every land pixel past the blend over the beach line the roads,
    // the places and the gates call water at or under - every pixel of the frame; G4: no shore a cliff at the water
    const g = groundWoods(woods), f = tamrielFrameInBay();
    let bad = 0, wet = 0, cliff = 0, blendWet = 0, straits = 0;
    for (let y = Math.ceil(f.y0); y < f.y0 + f.h; y++) for (let x = Math.ceil(f.x0); x < f.x0 + f.w; x++) {
      const d = bayEdgeDistance(x, y);
      if (d <= SEAM_PX) continue;   // the seam band: the Bay's own clamped read (THE BAY IS NOT MOVED BY A BYTE)
      // PIN MOVED (SMOOTH-LAND, test/world/smoothland.test.js): every coast the land's smooth law's (provinceKeyAt) - the
      // trace's own side at each of its pixels' centres, a smooth waterline between them; CYRODIIL-SHORES' lakes' own
      // shore folded into it
      const [qx, qy] = bayToPicture(x + 0.5, y + 0.5), strait = straitAt(qx, qy), v = g.getHeightMapValue(x, y);   // TESA x AUDIT TESA II: a traced strait's corner the sea's
      // PIN MOVED (RUMARE-WATER, test/world/rumarewater.test.js): the Imperial City's three span pixels the Waterfront's mouth
      // crosses the sea's (world/rumareWaters.js rumareMouthPixel), the canal's water laid on into the city
      const land = !!provinceKeyAt(qx, qy) && !strait && !rumareMouthPixel(x, y);
      if (d <= SEAM_PX + BLEND_PX) { if (land && v <= WATER_BYTE) blendWet++; continue; }
      if (strait) straits++;
      if ((v > 3) !== land) bad++;
      if (land && v <= WATER_BYTE) wet++;
      if (land && v > 40 && (g.getHeightMapValue(x + 1, y) === 0 || g.getHeightMapValue(x - 1, y) === 0 || g.getHeightMapValue(x, y + 1) === 0 || g.getHeightMapValue(x, y - 1) === 0)) cliff++;
    }
    assert.equal(bad, 0, 'land where the land\'s smooth law has land, sea where it has sea - and at the trace\'s straits\' corners');
    assert.ok(straits > 0, `the trace's diagonal straits open (${straits} pixels; Ebonheart's water to the sea among them)`);
    assert.equal(wet, 0, 'no land pixel past the blend at or under the beach line');
    assert.equal(blendWet, 0, 'nor in the blend toward the Bay (an edge at sea had blended the trace\'s land under it)');
    assert.equal(cliff, 0, 'no shore over byte 40 beside the water (68 stood by a lake in Craglorn\'s heights)');
    const at = (px, py) => pictureToBay(px, py).map(Math.floor);
    const [sx, sy] = at(171.75, 63.75), [rx, ry] = at(234.75, 53.75), [dx, dy] = at(268.25, 80.25);
    assert.ok(g.getHeightMapValue(sx, sy) > 160, 'Skyrim\'s summit, over the Bay\'s highest common ground');
    assert.equal(tamrielBiomeAt(sx, sy)?.key, 'skyrimPeaks');
    assert.equal(tamrielBiomeAt(rx, ry)?.key, 'morrowindRedMountain');
    assert.ok(g.getHeightMapValue(dx, dy) * 1 > 0 && !tamrielBiomeAt(dx, dy)?.peaks, `AUDIT TESA II G5: Deshaan's heart no range's snow (${tamrielBiomeAt(dx, dy)?.key})`);
    assert.deepEqual(['Skyrim', 'Imperial', 'Hammerfell', 'Morrowind', 'HighRock', 'Sumurset'].map((k) => peaksLine(k)), [128, 123, 112, 75, 72, 49], 'AUDIT TESA II G7/G11: the lines on the freeware, of the land past the Bay');
  } finally { setTamrielTrace(null); setTamrielFit(null); }
});
