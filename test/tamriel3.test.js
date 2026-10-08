// TAMRIEL3 (2026-10-08, bible/03-World/Tamriel.md) - THE MAP FROM THE PLAYER'S OWN PICTURE, pinned.
//
// Mac: "Can we fix the map? It doesnt look like the map thats in daggerfall." The continent is TRACED from
// TMAP00I0.IMG and TAMRIEL2.IMG when the world boots (ui/tamrielTrace.js), the Bay's place on the picture FOUND by
// laying its own land over the picture's (world/tamrielLand.js fitBayToPicture), and every conversion, the ink, the
// ground and the raster follow the trace and the fit through two live homes (world/tamrielLand.js,
// world/tamrielFrame.js). No file ships; the pins trace synthetic pictures and hold the law.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { pieces, traceTamrielPicture, paletteReader, preloadTamrielTrace, SPECK_PX } from '../src/ui/tamrielTrace.js';
import {
  PROVINCE_OF_ID, IMPERIAL_ID, seaDistanceField, setTamrielTrace, tamrielTrace, tamrielLandVersion,
  provinceKeyAt, coastDistanceAt, fitBayToPicture,
} from '../src/world/tamrielLand.js';
import {
  BAY_ORIGIN, PIXELS_PER_PICTURE_UNIT, PICTURE_W, PICTURE_H, BAY_W, BAY_H, setTamrielFit, tamrielFit, tamrielSize,
  bayToTamriel, tamrielToBay, pictureToBay, bayToPicture, tamrielFrameInBay, bayPictureRect,
} from '../src/world/tamrielFrame.js';
import { provinceAt, coastDistance, PROVINCES, CITIES, provinceByKey } from '../src/world/tamrielGeography.js';
import { authoredHeightByte, tamrielHeightByte, tamrielClimateAt, dropGroundCache, groundCacheSize, SHORE_BYTE } from '../src/world/tamrielGround.js';
import { rasterizeTamriel, PROVINCE_NONE } from '../src/world/tamrielRaster.js';
import { tracedChains, placeCity, buildTamrielInk, tamrielInkFor, CITY_SNAP_PX } from '../src/ui/tamrielInk.js';
import { RACE_TEMPLATES } from '../src/systems/races.js';
import { TerrainGenClient } from '../src/world/terrainGenClient.js';
import { tamrielTraceOn } from '../src/scenes/shared.js';
import { CLIMATES } from '../src/formats/mapsFile.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// ── FIXTURES: a picture and its picker, 320 x 200, drawn by the picture's own law ───────────────────────
// Palette: 0 parchment (tan), 1 the coastline (blue), 2 ink (dark). The picture is parchment everywhere - its sea IS
// the parchment - with one thin blue line round every land, the Imperial Province's included; the picker names each
// homeland's land exactly (the masks are the provinces' own shapes) and 0 everywhere else.
const PAL = (i) => (i === 1 ? [40, 60, 200] : i === 2 ? [30, 20, 10] : [210, 180, 130]);
const W = PICTURE_W, H = PICTURE_H;
const rect = (x0, y0, x1, y1) => (x, y) => x >= x0 && y >= y0 && x < x1 && y < y1;
/** The homelands: Breton 1 west, Redguard 2 under it, Nord 3 east; between Breton and Nord the Imperial Province,
 *  which no race claims - enclosed by the three masks and the coastline. */
const LANDS = { 1: rect(40, 30, 140, 90), 2: rect(40, 90, 140, 150), 3: rect(180, 30, 280, 90) };
const IMPERIAL = rect(140, 30, 180, 90);
/** Two holes in Breton's mask, each ringed in blue (lakes): the fit's scale hangs on their spacing. */
const LAKES = [rect(50, 36, 56, 42), rect(70, 40, 74, 44)];
/** An unclaimed pocket inside Redguard's mask with no line round it (the Inner Sea's shape): sea, not the remainder. */
const POND = rect(60, 100, 66, 106);
const SPECK = rect(200, 150, 203, 153);   // 9 px of Nord mask in the sea: a painted word
const HELMET = rect(286, 100, 316, 190);   // a blue ring in the sea enclosing MORE parchment than the Imperial Province, touching no mask
const STRIP = rect(100, 0, 200, 3);   // Breton's mask over the picture's top edge: the frame, not land
const GAP = [160, 29];   // one missing pixel of the coastline, north of the Imperial Province
function fixture({ speck = true } = {}) {
  const picture = { width: W, height: H, data: new Uint8Array(W * H) };
  const picker = { width: W, height: H, data: new Uint8Array(W * H) };
  const isLake = (x, y) => LAKES.some((l) => l(x, y));
  const union = (x, y) => (IMPERIAL(x, y) || Object.values(LANDS).some((r) => r(x, y))) && !isLake(x, y);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      for (const id in LANDS) if (LANDS[id](x, y) && !isLake(x, y) && !POND(x, y)) picker.data[i] = Number(id);
      if (STRIP(x, y)) picker.data[i] = 1;
      if (speck && SPECK(x, y)) picker.data[i] = 3;
      let line = false;
      if (!union(x, y)) for (let dy = -1; dy <= 1 && !line; dy++) for (let dx = -1; dx <= 1; dx++) if (union(x + dx, y + dy)) { line = true; break; }
      if (line || (HELMET(x, y) && !rect(287, 101, 315, 189)(x, y))) picture.data[i] = 1;
      if (rect(60, 170, 90, 172)(x, y)) picture.data[i] = 2;   // ink over the sea
    }
  }
  picture.data[GAP[1] * W + GAP[0]] = 0;
  return { picture, picker };
}
const count = (arr, v) => { let n = 0; for (const a of arr) if (a === v) n++; return n; };

afterEach(() => { setTamrielTrace(null); setTamrielFit(null); dropGroundCache(); });

// ── THE TRACE ────────────────────────────────────────────────────

test('TAMRIEL3 trace: pieces are the 4-connected runs of a mask, each knowing whether it touches the edge; the race ids are the picker\'s palette indices and the Imperial Province their ninth', () => {
  const w = 6, h = 4;
  const mask = new Uint8Array([
    1, 1, 0, 0, 0, 0,
    0, 0, 0, 1, 1, 0,
    0, 0, 0, 1, 0, 0,
    0, 0, 0, 0, 0, 1,
  ]);
  const ps = pieces(mask, w, h).map((p) => ({ n: p.cells.length, edge: p.edge, first: Math.min(...p.cells) }));
  assert.deepEqual(ps, [{ n: 2, edge: true, first: 0 }, { n: 3, edge: false, first: 9 }, { n: 1, edge: true, first: 23 }]);
  // a diagonal touch is no connection
  assert.equal(pieces(new Uint8Array([1, 0, 0, 1]), 2, 2).length, 2);
  assert.deepEqual(RACE_TEMPLATES.map((r) => r.id), [1, 2, 3, 4, 5, 6, 7, 8], 'the picker\'s indices');
  for (const r of RACE_TEMPLATES) assert.equal(provinceByKey(PROVINCE_OF_ID[r.id])?.race, r.key, `${r.key} names ${PROVINCE_OF_ID[r.id]}`);
  assert.equal(IMPERIAL_ID, 9); assert.equal(PROVINCE_OF_ID[9], 'Imperial');
  assert.equal(SPECK_PX, 12);
});

test('TAMRIEL3 trace: a pixel is land of a province where the picker names it; a mask\'s piece over the picture\'s edge is cut; a speck is dropped; the Imperial Province is the largest unclaimed region the coastline and the masks enclose that touches a mask - a one-pixel gap in the line closed, the line itself sea, a pocket in a mask sea, a ring in the sea sea; ink over the sea is not an island', () => {
  const { picture, picker } = fixture();
  const t = traceTamrielPicture(picker, picture, PAL);
  assert.ok(t); assert.equal(t.w, W); assert.equal(t.h, H);
  const at = (x, y) => [t.land[y * W + x], t.province[y * W + x]];
  assert.deepEqual(at(90, 60), [1, 1], 'Breton land');
  assert.deepEqual(at(90, 120), [1, 2], 'Redguard land');
  assert.deepEqual(at(230, 60), [1, 3], 'Nord land');
  assert.deepEqual(at(160, 60), [1, IMPERIAL_ID], 'the remainder: enclosed, unclaimed, touching Breton and Nord');
  assert.deepEqual(at(160, 90), [0, 0], 'south of it the sea');
  assert.deepEqual(at(39, 60), [0, 0], 'the coastline is sea');
  assert.deepEqual(at(160, 29), [1, IMPERIAL_ID], 'a one-pixel gap in the line is closed, and the gap itself is land');
  assert.deepEqual(at(150, 1), [0, 0], 'a mask over the picture\'s edge is the frame, not land');
  assert.deepEqual(at(201, 151), [0, 0], 'a 9 px speck is a painted word');
  assert.deepEqual(at(70, 171), [0, 0], 'ink over the sea is claimed by no race and no barrier: not land');
  assert.deepEqual(at(52, 38), [0, 0], 'a lake: a hole in the mask');
  assert.deepEqual(at(63, 103), [0, 0], 'an unclaimed pocket inside a mask (the Inner Sea) is sea, not the remainder');
  assert.deepEqual(at(300, 150), [0, 0], 'a ring in the sea touching no mask (the helmet) is sea, though it encloses more than the Imperial Province');
  assert.equal(count(t.land, 1), 100 * 60 * 3 + 40 * 60 - 36 - 16 - 36 + 1, 'exactly the four lands, less the lakes and the pond, plus the gap');
  assert.equal(count(t.province, IMPERIAL_ID), 40 * 60 + 1);
  // a speck of SPECK_PX stands
  const { picture: p2, picker: k2 } = fixture({ speck: false });
  for (let y = 150; y < 153; y++) for (let x = 200; x < 204; x++) { p2.data[y * W + x] = 0; k2.data[y * W + x] = 3; }
  const t2 = traceTamrielPicture(k2, p2, PAL);
  assert.equal(t2.land[151 * W + 201], 1, `${SPECK_PX} px is an island`);
  // the shapes refused
  assert.equal(traceTamrielPicture(null, picture, PAL), null);
  assert.equal(traceTamrielPicture({ width: 2, height: 2, data: new Uint8Array(4) }, picture, PAL), null, 'the two files must share a grid');
  assert.equal(traceTamrielPicture(picker, { width: W, height: H, data: new Uint8Array(0) }, PAL), null);
});

test('TAMRIEL3 trace: a province painted to the picture\'s border keeps its edge pieces when it has no other (a map painted to the frame); the palette reader is the DFPalette\'s three reads; the preload reads the two files by name through ImgFile', async () => {
  const picture = { width: W, height: H, data: new Uint8Array(W * H) };
  const picker = { width: W, height: H, data: new Uint8Array(W * H) };
  picture.data.fill(1);
  for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) { picture.data[y * W + x] = 0; picker.data[y * W + x] = 4; }
  const t = traceTamrielPicture(picker, picture, PAL);
  assert.equal(count(t.land, 1), 1600, 'the only piece touches the edge and stands');
  assert.equal(t.province[0], 4);
  const pal = { getRed: (i) => i, getGreen: (i) => i * 2, getBlue: (i) => i * 3 };
  assert.deepEqual(paletteReader(pal)(5), [5, 10, 15]);
  const asked = [];
  await assert.rejects(preloadTamrielTrace({ fetchBytes: async (n) => { asked.push(n); throw new Error('no ' + n); }, palette: pal }), /no TMAP00I0\.IMG/);
  assert.deepEqual(asked, ['TMAP00I0.IMG'], 'the picture first; a missing file rejects and the host says so');
  const src = read('src/ui/tamrielTrace.js');
  assert.match(src, /fetchBytes\('TAMRIEL2\.IMG'\)/);
  assert.match(src, /import \{ seaIndices \} from '\.\/provinceMap\.js';/, 'the chargen\'s own blue');
  assert.match(src, /own\.load\(await fetchBytes\(picture\.paletteName\), picture\.paletteName\); pal = own;/, 'the painting on ITS palette (MAP.PAL)');
  assert.ok(!src.includes('inlandRemainder('), 'the chargen\'s remainder is not called: it reads a blue sea the picture has not');
});

// ── THE LAND MODULE ──────────────────────────────────────────────

test('TAMRIEL3 land: the distance field is the chamfer 3-4 over 3 - zero at sea, one a step inland, the diagonal 4/3 - and the install keeps its own; null is the authored shape; the version moves on every install', () => {
  const w = 5, h = 5;
  const land = new Uint8Array(w * h).fill(1);
  for (let x = 0; x < w; x++) { land[x] = 0; land[(h - 1) * w + x] = 0; }
  for (let y = 0; y < h; y++) { land[y * w] = 0; land[y * w + w - 1] = 0; }
  const d = seaDistanceField(land, w, h);
  assert.equal(d[0], 0); assert.equal(d[1 * w + 1], 1); assert.equal(d[2 * w + 2], 2); assert.equal(d[1 * w + 2], 1);
  const one = new Uint8Array([0, 0, 0, 0, 1, 0, 0, 0, 0]);
  assert.equal(seaDistanceField(one, 3, 3)[4], 1);
  const corner = new Uint8Array([1, 1, 1, 1, 1, 1, 1, 1, 0]);   // the only sea south-east: the backward pass's diagonal
  assert.ok(Math.abs(seaDistanceField(corner, 3, 3)[4] - 4 / 3) < 1e-6, 'the diagonal is 4/3, not two steps');
  assert.ok(Math.abs(seaDistanceField(corner, 3, 3)[0] - (4 + 4) / 3) < 1e-6);
  const v0 = tamrielLandVersion();
  assert.equal(tamrielTrace(), null);
  setTamrielTrace({ w, h, land, province: new Uint8Array(w * h).fill(3) });
  assert.equal(tamrielLandVersion(), v0 + 1);
  assert.ok(tamrielTrace().dist instanceof Float32Array, 'the field made at install');
  assert.equal(tamrielTrace().dist[2 * w + 2], 2);
  assert.equal(provinceKeyAt(0.5, 0.5), null, 'the land mask decides: a province byte under sea is no province');
  assert.equal(provinceKeyAt(2.5, 2.5), 'Skyrim');
  setTamrielTrace({ w: 2, h: 2, land: new Uint8Array(3), province: new Uint8Array(3) });
  assert.equal(tamrielTrace(), null, 'a malformed trace is none');
  assert.equal(tamrielLandVersion(), v0 + 2);
  setTamrielTrace(null);
  assert.equal(tamrielLandVersion(), v0 + 3);
});

test('TAMRIEL3 land: provinceKeyAt and coastDistanceAt answer the trace where one is set - the key by id, null at sea and off the grid, the distance bilinear - and the authored rings and edges else', () => {
  assert.equal(provinceKeyAt(82, 38), provinceAt(82, 38)?.key, 'authored: the rings');
  assert.equal(provinceKeyAt(82, 38), 'HighRock');
  assert.equal(coastDistanceAt(82, 38), coastDistance(82, 38));
  const { picture, picker } = fixture();
  setTamrielTrace(traceTamrielPicture(picker, picture, PAL));
  assert.equal(provinceKeyAt(90.4, 60.9), 'HighRock');
  assert.equal(provinceKeyAt(90, 120), 'Hammerfell');
  assert.equal(provinceKeyAt(230, 60), 'Skyrim');
  assert.equal(provinceKeyAt(160, 60), 'Imperial');
  assert.equal(provinceKeyAt(20, 100), null, 'sea');
  assert.equal(provinceKeyAt(-1, 5), null); assert.equal(provinceKeyAt(W, 5), null); assert.equal(provinceKeyAt(5, H), null);
  assert.equal(provinceKeyAt(W + 90, 59), null, 'past the east edge is not the next row\'s land');
  assert.equal(coastDistanceAt(20, 100), 0);
  assert.equal(coastDistanceAt(40.5, 60.5), 1, 'the first pixel in');
  assert.ok(Math.abs(coastDistanceAt(41, 60.5) - 1.5) < 1e-6, 'halfway between the first and second pixel');
  assert.ok(coastDistanceAt(90, 60) > 20, 'deep inland');
  assert.equal(coastDistanceAt(-3, -3), coastDistanceAt(0.5, 0.5), 'clamped to the grid');
});

test('TAMRIEL3 fit: laying the Bay\'s land over the picture finds the offset and the scale it was drawn at - exactly, over a synthetic Bay cut from the fixture at a known place - and reports the cells agreeing', () => {
  const { picture, picker } = fixture();
  const trace = traceTamrielPicture(picker, picture, PAL);
  // the Bay: the picture's land read back at (ox, oy) x ppu, with a stripe of sea to break the symmetry
  const OX = 30, OY = 20, PPU = 18;   // the Bay over Breton land's north-west corner: a coast on both axes
  const bayLand = (x, y) => {
    const px = OX + x / PPU, py = OY + y / PPU;
    if (px >= 60 && px < 64) return false;   // a river of sea the picture has not: the fit survives a disagreement
    return !!trace.land[Math.floor(py) * W + Math.floor(px)];
  };
  const fit = fitBayToPicture({ bayLand, trace, around: { ox: 28, oy: 22 }, span: 8, ppus: [16, 18, 20] });
  assert.equal(fit.ox, OX); assert.equal(fit.oy, OY); assert.equal(fit.ppu, PPU);
  assert.equal(fit.cells, Math.floor(BAY_W / PPU) * Math.floor(BAY_H / PPU));
  assert.ok(fit.score > fit.cells * 0.85 && fit.score < fit.cells, `${fit.score} of ${fit.cells} agree (the river disagrees)`);
  // THE FRACTION wins, not the count: at 16 a picture pixel the Bay lays 1922 cells to 18's 1485, and a count would
  // have chosen it with fewer of them agreeing
  const at16 = fitBayToPicture({ bayLand, trace, around: { ox: 28, oy: 22 }, span: 8, ppus: [16] });
  assert.ok(at16.score > fit.score && at16.score / at16.cells < fit.score / fit.cells, `${at16.score}/${at16.cells} at 16 against ${fit.score}/${fit.cells} at 18`);
  // four samples a cell, the majority: a speckle of one sea pixel in seven never flips a cell, so the fit and its
  // score stand to the cell
  const speckled = (x, y) => (x + y) % 7 !== 0 && bayLand(x, y);
  const sp = fitBayToPicture({ bayLand: speckled, trace, around: { ox: 28, oy: 22 }, span: 8, ppus: [16, 18, 20] });
  assert.deepEqual(sp, fit, 'the majority holds the cell');
  // the search window honoured: a candidate off the picture is skipped, not scored (a row read past the picture's
  // east edge would wrap into the next row)
  const edge = fitBayToPicture({ bayLand, trace, around: { ox: 300, oy: 100 }, span: 2, ppus: [18] });
  assert.equal(edge, null, 'no candidate fits on the picture there');
  assert.equal(fitBayToPicture({ bayLand, trace, around: { ox: 100, oy: 190 }, span: 2, ppus: [18] }), null);
  const src = read('src/world/tamrielLand.js');
  assert.match(src, /around = \{ ox: 46, oy: 52 \}, span = 24, ppus = \[16, 16\.5, 17, 17\.5, 18, 18\.5, 18\.75, 19, 19\.5, 20, 20\.5, 21\]/, 'the defaults round the authored place (862 / 18.75, 975 / 18.75)');
  assert.ok(Math.abs(BAY_ORIGIN.x / PIXELS_PER_PICTURE_UNIT - 46) < 0.1 && Math.abs(BAY_ORIGIN.y / PIXELS_PER_PICTURE_UNIT - 52) < 0.1);
});

// ── THE LIVE FRAME ───────────────────────────────────────────────

test('TAMRIEL3 frame: every conversion reads the live fit - the defaults until one is set, the pair after, the defaults again on null or a bad pair - and the inverses hold at any fit', () => {
  assert.deepEqual(tamrielFit(), { ox: BAY_ORIGIN.x, oy: BAY_ORIGIN.y, ppu: PIXELS_PER_PICTURE_UNIT });
  assert.deepEqual(tamrielSize(), { w: 6000, h: 3750 });
  setTamrielFit({ ox: 900, oy: 720, ppu: 18 });
  assert.deepEqual(tamrielFit(), { ox: 900, oy: 720, ppu: 18 });
  assert.deepEqual(tamrielSize(), { w: 320 * 18, h: 200 * 18 });
  assert.deepEqual(bayToTamriel(0, 0), [900, 720]);
  assert.deepEqual(tamrielToBay(900, 720), [0, 0]);
  assert.deepEqual(pictureToBay(50, 40), [0, 0]);
  assert.deepEqual(bayToPicture(0, 0), [50, 40]);
  assert.deepEqual(bayToPicture(BAY_W, BAY_H), [50 + 1000 / 18, 40 + 500 / 18]);
  assert.deepEqual(tamrielFrameInBay(), { x0: -900, y0: -720, w: 5760, h: 3600 });
  assert.deepEqual(bayPictureRect(), { x0: 50, y0: 40, x1: 50 + 1000 / 18, y1: 40 + 500 / 18 });
  for (const [x, y] of [[0, 0], [999, 499], [-1200, 2000]]) {
    const [px, py] = bayToPicture(x, y); const [bx, by] = pictureToBay(px, py);
    assert.ok(Math.abs(bx - x) < 1e-9 && Math.abs(by - y) < 1e-9);
  }
  setTamrielFit({ ox: NaN, oy: 1, ppu: 18 });
  assert.deepEqual(tamrielFit(), { ox: BAY_ORIGIN.x, oy: BAY_ORIGIN.y, ppu: PIXELS_PER_PICTURE_UNIT }, 'a bad pair is the defaults');
  setTamrielFit({ ox: 1, oy: 1, ppu: 0 });
  assert.equal(tamrielFit().ppu, PIXELS_PER_PICTURE_UNIT, 'a zero scale is the defaults');
  setTamrielFit({ ox: 900, oy: 720, ppu: 18 });
  setTamrielFit(null);
  assert.deepEqual(tamrielFit(), { ox: BAY_ORIGIN.x, oy: BAY_ORIGIN.y, ppu: PIXELS_PER_PICTURE_UNIT });
  assert.equal(PICTURE_W, 320); assert.equal(PICTURE_H, 200);
});

// ── THE GROUND AND THE RASTER ON THE TRACE ───────────────────────

test('TAMRIEL3 ground: with a trace set the height law and the climate read the picture\'s land - sea 0 where the picker claimed sea, the province\'s climate on its land, the Imperial Province Woodlands - and the raster follows at the live scale', () => {
  const { picture, picker } = fixture();
  setTamrielTrace(traceTamrielPicture(picker, picture, PAL));
  setTamrielFit({ ox: 50 * 18, oy: 40 * 18, ppu: 18 });
  assert.equal(authoredHeightByte(20, 100), 0, 'sea');
  assert.ok(authoredHeightByte(90, 60) >= SHORE_BYTE, 'Breton land');
  assert.ok(authoredHeightByte(40.5, 60.5) < authoredHeightByte(90, 60), 'rising inland from the picture\'s own coast');
  // a Bay pixel just west of the Bay: picture (50 - 1/18, ...) = sea in the fixture? x=49.9 -> land of Breton (40..140)
  const [px, py] = bayToPicture(-2 + 0.5, 100 + 0.5);
  assert.ok(px < 50 && px > 40, 'west of the Bay, on Breton land');
  assert.ok(tamrielHeightByte(-2, 100) >= SHORE_BYTE);
  assert.equal(tamrielClimateAt(-2, 100), provinceByKey('HighRock').climate);
  assert.equal(tamrielClimateAt(720, 1440), provinceByKey('Hammerfell').climate, 'the picture\'s Hammerfell is the Desert');
  assert.notEqual(provinceByKey('Hammerfell').climate, CLIMATES.Woodlands);
  assert.equal(tamrielClimateAt(Math.round((20 - 50) * 18), Math.round((100 - 40) * 18)), CLIMATES.Ocean, 'the fixture\'s sea');
  assert.equal(tamrielClimateAt(Math.round((160 - 50) * 18), Math.round((60 - 40) * 18)), CLIMATES.Woodlands, 'the Imperial remainder');
  const r = rasterizeTamriel({ cell: 18 });
  assert.equal(r.width, 320); assert.equal(r.height, 200, 'one cell a picture pixel at the live scale');
  assert.equal(r.province[100 * 320 + 20], PROVINCE_NONE);
  assert.equal(r.heightBytes[100 * 320 + 20], 0);
  assert.equal(r.climate[100 * 320 + 20], CLIMATES.Ocean);
  assert.equal(r.province[60 * 320 + 90], PROVINCES.findIndex((p) => p.key === 'HighRock'));
  assert.equal(r.climate[60 * 320 + 160], CLIMATES.Woodlands);
  assert.ok(r.heightBytes[60 * 320 + 90] >= SHORE_BYTE);
  assert.equal(r.province[60 * 320 + 40], PROVINCES.findIndex((p) => p.key === 'HighRock'), 'the first land cell at the live scale');
  assert.equal(r.province[60 * 320 + 39], PROVINCE_NONE);
  assert.equal(r.province[60 * 320 + 139], PROVINCES.findIndex((p) => p.key === 'HighRock'));
  assert.equal(r.province[60 * 320 + 140], PROVINCES.findIndex((p) => p.key === 'Imperial'), 'the border, to the cell');
  assert.equal(r.province[120 * 320 + 139], PROVINCES.findIndex((p) => p.key === 'Hammerfell'));
  assert.equal(r.province[120 * 320 + 140], PROVINCE_NONE, 'the last land cell at the live scale');
  assert.ok(py > 0);
});

// ── THE INK ON THE TRACE ─────────────────────────────────────────

test('TAMRIEL3 ink: tracedChains links the land mask\'s pixel edges into coast chains and the province changes into border chains, in Bay coordinates at the live fit, softened; a label a province at its clearest point', () => {
  const { picture, picker } = fixture();
  const trace = traceTamrielPicture(picker, picture, PAL);
  setTamrielTrace(trace);
  setTamrielFit({ ox: 50 * 18, oy: 40 * 18, ppu: 18 });
  const ch = tracedChains(trace);
  assert.equal(ch.coast.length, 4, `${ch.coast.length} coast chains: one continent (Breton, the Imperial Province, Nord and Redguard joined), two lakes, the pond`);
  for (const c of ch.coast) for (const p of c) {
    const [px, py] = bayToPicture(p.x, p.y);
    assert.ok(px >= 39 && px <= 281 && py >= 29 && py <= 151, 'every coast point on the lands\' outline');
  }
  assert.ok(ch.borders.length >= 1 && ch.borders.length <= 3, `${ch.borders.length} border chains: Breton|Redguard, Breton|Imperial, Imperial|Nord, meeting at one point`);
  const online = (p) => { const [px, py] = bayToPicture(p.x, p.y); return Math.abs(py - 90) < 1.5 || Math.abs(px - 140) < 1.5 || Math.abs(px - 180) < 1.5; };
  for (const c of ch.borders) for (const p of c) assert.ok(online(p), 'every border point on one of the three province changes - a land-land edge within a province is no border');
  const bpts = ch.borders.flat().map((p) => bayToPicture(p.x, p.y));
  assert.ok(bpts.some(([px]) => px < 42) && bpts.some(([px, py]) => Math.abs(py - 90) < 1.5 && px > 138), 'Breton|Redguard from coast to the meeting point');
  assert.ok(bpts.some(([px, py]) => Math.abs(px - 180) < 1.5 && py < 32), 'Imperial|Nord up to the coast');
  assert.deepEqual(ch.labels.map((l) => l.key).sort(), ['Hammerfell', 'HighRock', 'Imperial', 'Skyrim']);
  const hr = ch.labels.find((l) => l.key === 'HighRock');
  assert.ok(hr.px > 60 && hr.px < 120 && hr.py > 40 && hr.py < 80, 'the label deep in its land');
  const pts = ch.coast.reduce((n, c) => n + c.length, 0);
  assert.ok(pts < 120, `${pts} points: rectangles, the staircase simplified to their corners (unsimplified, near a thousand)`);
});

test('TAMRIEL3 ink: placeCity keeps a city on its own province\'s land, moves one within CITY_SNAP_PX onto it, leaves one further off; and on the authored shape every city stands where it is', () => {
  assert.equal(CITY_SNAP_PX, 10);
  for (const c of CITIES) assert.deepEqual(placeCity(c), c.at, `${c.name} stands (authored)`);
  assert.equal(placeCity({ name: 'x', province: 'Skyrim', at: [0, 0] }), null, 'off any land, no trace: nothing to snap to');
  let wx = 82; while (provinceAt(wx, 38)?.key === 'HighRock') wx--;
  assert.equal(provinceAt(wx, 38), null, 'the authored sea west of High Rock');
  assert.equal(placeCity({ name: 'y', province: 'HighRock', at: [wx, 38] }), null, 'on the authored shape nothing snaps: a city stands or is off');
  const { picture, picker } = fixture();
  setTamrielTrace(traceTamrielPicture(picker, picture, PAL));
  assert.deepEqual(placeCity({ name: 'a', province: 'HighRock', at: [90, 60] }), [90, 60]);
  const moved = placeCity({ name: 'b', province: 'HighRock', at: [36, 60] });
  assert.ok(moved && moved[0] >= 40 && moved[0] < 41 && Math.abs(moved[1] - 60.5) < 1e-9, `snapped east onto the land: ${moved}`);
  assert.equal(placeCity({ name: 'c', province: 'HighRock', at: [20, 60] }), null, '20 px out is left off');
  assert.deepEqual(placeCity({ name: 'c7', province: 'HighRock', at: [33, 23] }), [40.5, 30.5], '7 by 7 (9.9 px) reaches the corner');
  assert.equal(placeCity({ name: 'c8', province: 'HighRock', at: [32, 22] }), null, '8 by 8 (11.3 px) is past the reach, square or not');
  assert.deepEqual(placeCity({ name: 'd', province: 'Imperial', at: [160, 60] }), [160, 60]);
  const wrong = placeCity({ name: 'e', province: 'Skyrim', at: [90, 60] });
  assert.equal(wrong, null, 'on another province\'s land, no Skyrim within reach');
});

test('TAMRIEL3 ink: the built model on a trace is the traced coast and borders (clipped outside the Bay), every province of the trace named, a sea name on the picture\'s land dropped, the cities placed, and `traced`/`version` reported; the cache rebuilds when the version moves', () => {
  const plain = buildTamrielInk();
  assert.equal(plain.traced, false);
  assert.equal(plain.provinces.length, PROVINCES.length);
  const { picture, picker } = fixture();
  setTamrielTrace(traceTamrielPicture(picker, picture, PAL));
  setTamrielFit({ ox: 50 * 18, oy: 40 * 18, ppu: 18 });
  const ink = buildTamrielInk();
  assert.equal(ink.traced, true);
  assert.equal(ink.version, tamrielLandVersion());
  assert.deepEqual(ink.provinces.map((p) => p.key).sort(), ['Hammerfell', 'HighRock', 'Imperial', 'Skyrim']);
  assert.equal(ink.provinces.find((p) => p.key === 'Sumurset'), undefined, 'a province the picture has no land for is not named');
  assert.equal(ink.provinces.find((p) => p.key === 'Imperial').name, 'Imperial Province');
  for (const c of ink.coast) for (const p of c) assert.ok(!(p.x > 1e-9 && p.y > 1e-9 && p.x < BAY_W - 1e-9 && p.y < BAY_H - 1e-9), 'no coast on the Bay (a lake under it is cut; a cut end lies on the edge)');
  assert.ok(ink.borders.length >= 1);
  for (const c of ink.cities) { assert.ok(c.province, 'placed'); assert.ok(!(c.x >= 0 && c.y >= 0 && c.x < BAY_W && c.y < BAY_H)); }
  for (const s of ink.seas) assert.equal(provinceKeyAt(...bayToPicture(s.x, s.y)), null, `${s.name} named at sea`);
  for (const c of ink.carets) assert.ok(provinceKeyAt(...bayToPicture(c.x, c.y)), 'a caret only on the picture\'s land');
  const model = { coast: [] };
  const a = tamrielInkFor(model);
  assert.equal(tamrielInkFor(model), a, 'one model a trace');
  setTamrielTrace(tamrielTrace());
  const b = tamrielInkFor(model);
  assert.notEqual(a, b, 'rebuilt when the version moves');
  assert.equal(b.version, tamrielLandVersion());
});

// ── THE CLIENT, THE WORKER, THE DOOR, THE HOST ────────────────────

test('TAMRIEL3 worker: setTamriel sets the trace and the fit on the host\'s modules, drops the ground cache, and posts copies of the arrays with the fit to the worker (transferred); the worker sets its own the same way', () => {
  const posted = [];
  const factory = () => ({ postMessage: (m, t) => posted.push({ m, t }), terminate() {}, onmessage: null, onerror: null });
  const c = new TerrainGenClient({ woods: { getHeightMapValue: () => 0 }, woodsBytes: new Uint8Array(16), workerFactory: factory });
  const { picture, picker } = fixture();
  const trace = traceTamrielPicture(picker, picture, PAL);
  tamrielHeightByte(-2, 100);
  assert.ok(groundCacheSize() > 0);
  c.setTamriel({ trace, fit: { ox: 900, oy: 720, ppu: 18 } });
  assert.equal(groundCacheSize(), 0, 'the ground\'s cache dropped: every byte it held was the authored shape\'s');
  assert.equal(tamrielTrace().land, trace.land, 'set here');
  assert.deepEqual(tamrielFit(), { ox: 900, oy: 720, ppu: 18 });
  const last = posted[posted.length - 1];
  assert.equal(last.m.t, 'tamriel');
  assert.deepEqual(last.m.fit, { ox: 900, oy: 720, ppu: 18 });
  assert.equal(last.m.trace.w, W); assert.equal(last.m.trace.h, H);
  assert.notEqual(last.m.trace.land, trace.land, 'a copy crosses; the host keeps its own');
  assert.deepEqual(last.t, [last.m.trace.land.buffer, last.m.trace.province.buffer], 'transferred');
  assert.equal(last.m.trace.dist, undefined, 'the field is remade on the far side');
  c.setTamriel({ trace: null, fit: null });
  assert.equal(tamrielTrace(), null); assert.equal(tamrielFit().ppu, PIXELS_PER_PICTURE_UNIT);
  assert.deepEqual(posted[posted.length - 1], { m: { t: 'tamriel', trace: null, fit: null }, t: [] });
  const bare = new TerrainGenClient({ woods: { getHeightMapValue: () => 0 }, woodsBytes: null });
  bare.setTamriel({ trace, fit: { ox: 1, oy: 2, ppu: 18 } });
  assert.equal(tamrielFit().ox, 1, 'the fallback kernel\'s own state, no worker');
  const worker = read('src/world/terrainGenWorker.js');
  assert.match(worker, /if \(m\.t === 'tamriel'\) \{ setTamrielTrace\(m\.trace \?\? null\); setTamrielFit\(m\.fit \?\? null\); dropGroundCache\(\); return; \}/);
  const land = read('src/world/tamrielLand.js');
  for (const bad of ['document', 'globalThis.', 'fetch(', 'localStorage', 'getPref', 'ImgFile']) assert.ok(!land.includes(bad), `pure: no ${bad}`);
});

test('TAMRIEL3 door: `?tamrieltrace=off` keeps the authored shape, and nothing else does; no row (a door for a day the trace reads a picture wrong)', () => {
  assert.equal(tamrielTraceOn(''), true);
  assert.equal(tamrielTraceOn('?tamriel=off'), true);
  assert.equal(tamrielTraceOn('?tamrieltrace=off'), false);
  assert.equal(tamrielTraceOn('?x=1&tamrieltrace=off'), false);
  assert.equal(tamrielTraceOn('?tamrieltrace=on'), true);
  const features = read('src/systems/features.js');
  assert.ok(!features.includes('tamrielTrace'), 'no Features row');
});

test('TAMRIEL3 host: the world host traces the two files after the travel art, fits the Bay by the one water law over the composed reads, installs both through the client, resets the stream\'s frame, and logs the fit; a missing file leaves the authored shape and says so; the held map\'s static key carries the version', () => {
  const src = read('src/scenes/world.js');
  assert.match(src, /import \{ preloadTamrielTrace \} from '\.\.\/ui\/tamrielTrace\.js';/);
  assert.match(src, /import \{ fitBayToPicture \} from '\.\.\/world\/tamrielLand\.js';/);
  const i = src.indexOf('if (tamrielTraceOn()) {');
  assert.ok(i > 0);
  const block = src.slice(i, src.indexOf('preloadTravelControlArt({', i));
  assert.match(block, /preloadTamrielTrace\(\{ fetchBytes, palette \}\)\.then\(\(trace\) => \{/);
  assert.match(block, /if \(!trace\) \{ console\.warn\(/, 'a trace of nothing stands down');
  assert.match(block, /const fit = fitBayToPicture\(\{ bayLand: \(x, y\) => !isWaterPixel\(maps\.getClimateIndex\(x, y\), woods\.getHeightMapValue\(x, y\)\), trace \}\);/, 'the Bay\'s land by the one water law');
  assert.match(block, /const fitPx = fit \? \{ ox: fit\.ox \* fit\.ppu, oy: fit\.oy \* fit\.ppu, ppu: fit\.ppu \} : null;/, 'picture units to Tamriel pixels');
  assert.match(block, /terrainGen\.setTamriel\(\{ trace, fit: fitPx \}\);/);
  assert.match(block, /StreamingWorldState\.frame = tamrielLand \? tamrielFrameInBay\(\) : null;/, 'the stream\'s frame at the new fit');
  assert.match(block, /\.catch\(\(e\) => console\.warn\('\[tamriel\] TMAP00I0\/TAMRIEL2 unavailable; the authored continent stands:'/);
  assert.equal((src.match(/tamrielTraceOn\(\)/g) ?? []).length, 1, 'the door read once');
  assert.ok(src.indexOf('preloadTravelMapArt(') < i, 'after the travel art');
  const held = read('src/ui/heldMap.js');
  assert.match(held, /tamrielLandVersion\(\),   \/\/ TAMRIEL3/, 'the sheet repaints when the trace lands');
  const ground = read('src/world/tamrielGround.js');
  assert.match(ground, /import \{ provinceKeyAt, coastDistanceAt \} from '\.\/tamrielLand\.js';/);
  assert.ok(!/\bprovinceAt\(|\bcoastDistance\(/.test(ground), 'the ground reads the land module, never the authored rings directly');
  const raster = read('src/world/tamrielRaster.js');
  assert.match(raster, /import \{ provinceKeyAt \} from '\.\/tamrielLand\.js';/);
  assert.match(raster, /const \{ ox, oy \} = tamrielFit\(\);/);
  const client = read('src/world/terrainGenClient.js');
  assert.match(client, /import \{ setTamrielTrace \} from '\.\/tamrielLand\.js';/);
});
