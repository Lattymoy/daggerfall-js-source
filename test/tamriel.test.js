// TAMRIEL1 (2026-10-08, bible/03-World/Tamriel.md) - THE WHOLE OF TAMRIEL ROUND THE BAY, pinned.
//
// Mac: "building the entirety of tamriel that connects accurately to Daggerfall. Not actually traversalable but used
// and connected as a gigantic map that can be used for later use and be seen by players ingame", then "Performance
// should also not be affected".
//
// Four modules, each pinned against its own law: the FRAME (world/tamrielFrame.js - one offset, no scale, the Bay's
// pixel is Tamriel's), the GEOGRAPHY (world/tamrielGeography.js - rings of named vertices whose shared edges ARE the
// borders, held by classifyEdges), the INK (ui/tamrielInk.js - clipped to the outside of the Bay, stitched to its
// coast, painted only when the view leaves it) and the RASTER (world/tamrielRaster.js - the frame in WOODS' own
// shape, the Bay's bytes composed over it). Then the clamp's origin (ui/inkMap.js), the continent band, the switch
// and the source sweeps. The window's own behaviour is in test/heldmap.test.js (TAMRIEL1 there).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  PICTURE_W, PICTURE_H, PIXELS_PER_PICTURE_UNIT, TAMRIEL_W, TAMRIEL_H, BAY_W, BAY_H, BAY_ORIGIN, KM_PER_PIXEL,
  bayToTamriel, tamrielToBay, pictureToBay, bayToPicture, inBay, bayPictureRect, tamrielFrameInBay, pixelsToKm,
} from '../src/world/tamrielFrame.js';
import {
  V, COAST, ISLANDS, BORDERS, PROVINCES, MOUNTAIN_RANGES, RIVERS, SEAS, CITIES, coastRun, classifyEdges, inRing, provinceAt, seaAt,
  landBounds, pt, pts, closedRing, provinceByKey,
} from '../src/world/tamrielGeography.js';
import {
  STITCH_REACH, FRET_CALM, CONTINENT_BELOW, CITY_HIT_PX, TAMRIEL_TEXT,
  clipOutsideRect, fretRing, bayCoastEnds, stitchToBay, buildTamrielInk, tamrielInkFor, viewLeavesBay, onContinent,
  paintTamrielInk, tamrielPlaceAt,
} from '../src/ui/tamrielInk.js';
import { rasterizeTamriel, composeBay, PROVINCE_NONE, SHORE_BYTE, SNOW_BYTE } from '../src/world/tamrielRaster.js';
import { clampView, scaleMinOf, CONTINENT_BAND, BAND_MARKS, CARET_STEP, buildInkModel, paintInkStatic, PEN, penOf, spacedName } from '../src/ui/inkMap.js';
import { PROVINCE_NAMES, INERT_REGION } from '../src/ui/provinceMap.js';
import { CLIMATES } from '../src/formats/mapsTables.js';
import { MAP_WIDTH, MAP_HEIGHT } from '../src/formats/woodsFile.js';
import { PIXEL_UNITS } from '../src/net/wire.js';
import { FEATURES } from '../src/systems/features.js';
import { tamrielMapOn } from '../src/ui/mapSkin.js';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import { SNOWLINE_BYTE } from '../src/ui/overworldModel.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** A recording 2D context: every call and every style set, in order (test/heldmap.test.js's own). */
function recordingCtx() {
  const calls = [];
  const state = {};
  return new Proxy({}, {
    get: (_, k) => {
      if (k === 'calls') return calls;
      if (k === 'measureText') return (t) => ({ width: t.length * 6 });
      if (k in state) return state[k];
      return (...args) => { calls.push({ fn: k, args, strokeStyle: state.strokeStyle, fillStyle: state.fillStyle, lineWidth: state.lineWidth, font: state.font }); };
    },
    set: (_, k, v) => { state[k] = v; return true; },
  });
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

// ── THE FRAME ────────────────────────────────────────────────────

test('TAMRIEL1 frame: a Tamriel pixel is the Bay\'s pixel - 819.2 m, MapsFile\'s own 32768 units at 40 a metre - and the continent is the picture grid at one authored ratio', () => {
  assert.equal(KM_PER_PIXEL * 1000, PIXEL_UNITS / 40, 'the scale is the wire\'s own world units a pixel, over the metre');
  assert.equal(PICTURE_W, 320); assert.equal(PICTURE_H, 200);
  assert.equal(TAMRIEL_W, PICTURE_W * PIXELS_PER_PICTURE_UNIT);
  assert.equal(TAMRIEL_H, PICTURE_H * PIXELS_PER_PICTURE_UNIT);
  assert.equal(TAMRIEL_W, 6000); assert.equal(TAMRIEL_H, 3750);
  assert.equal(BAY_W, MAP_WIDTH); assert.equal(BAY_H, MAP_HEIGHT);
  assert.equal(KM_PER_PIXEL, 0.8192);
  assert.ok(near(pixelsToKm(TAMRIEL_W), 4915.2) && near(pixelsToKm(TAMRIEL_H), 3072), 'four thousand nine hundred km across');
});

test('TAMRIEL1 frame: the Bay stands whole inside the frame by ONE offset, and every conversion is the inverse of its partner', () => {
  assert.ok(BAY_ORIGIN.x > 0 && BAY_ORIGIN.y > 0 && BAY_ORIGIN.x + BAY_W < TAMRIEL_W && BAY_ORIGIN.y + BAY_H < TAMRIEL_H, 'the Bay is inside, with the continent on every side');
  for (const [x, y] of [[0, 0], [999, 499], [12.5, 480.25], [-30, 700]]) {
    assert.deepEqual(tamrielToBay(...bayToTamriel(x, y)), [x, y]);
    const [px, py] = bayToPicture(x, y);
    const back = pictureToBay(px, py);
    assert.ok(near(back[0], x) && near(back[1], y), 'picture and back');
  }
  assert.deepEqual(bayToTamriel(0, 0), [BAY_ORIGIN.x, BAY_ORIGIN.y], 'no scale: the Bay\'s origin IS the offset');
  assert.deepEqual(bayToTamriel(1000, 500), [BAY_ORIGIN.x + 1000, BAY_ORIGIN.y + 500]);
  const r = bayPictureRect();
  assert.ok(r.x0 > 0 && r.y0 > 0 && r.x1 < PICTURE_W && r.y1 < PICTURE_H, 'the Bay\'s rectangle lies on the picture grid');
  assert.ok(near(r.x1 - r.x0, BAY_W / PIXELS_PER_PICTURE_UNIT) && near(r.y1 - r.y0, BAY_H / PIXELS_PER_PICTURE_UNIT));
  const f = tamrielFrameInBay();
  assert.deepEqual(f, { x0: -BAY_ORIGIN.x, y0: -BAY_ORIGIN.y, w: TAMRIEL_W, h: TAMRIEL_H }, 'the frame in the sheet\'s coordinates has the Bay at (0, 0)');
  assert.ok(inBay(0, 0) && inBay(999.9, 499.9) && !inBay(1000, 0) && !inBay(-0.1, 10) && !inBay(10, 500));
});

// ── THE GEOGRAPHY ───────────────────────────────────────────────

test('TAMRIEL1 geography: nine provinces, Daggerfall\'s own names (SUMURSET, the Imperial Province), each ring closed over named vertices that exist', () => {
  assert.equal(PROVINCES.length, 9);
  const names = new Set(PROVINCES.map((p) => p.name));
  for (const n of Object.values(PROVINCE_NAMES)) assert.ok(names.has(n), `the picker's province ${n} is on the continent`);
  assert.equal(provinceByKey('Imperial').name, INERT_REGION.name, 'the ninth region is the picker\'s own inert one');
  assert.equal(provinceByKey('Imperial').race, null);
  for (const p of PROVINCES) {
    assert.ok(p.rings.length >= 1);
    for (const r of p.rings) {
      assert.ok(r.length >= 4, `${p.key}: a ring is at least a quadrilateral`);
      assert.equal(new Set(r).size, r.length, `${p.key}: no vertex twice in one ring`);
      for (const n of r) assert.ok(V[n], `${p.key} names ${n}, which the table lacks`);
    }
    assert.ok(Object.values(CLIMATES).includes(p.climate), `${p.key}'s climate is a CLIMATE.PAK value`);
    assert.equal(provinceAt(...p.label)?.key, p.key, `${p.key}'s name sits on its own ground`);
  }
  assert.throws(() => pt('nowhere'), /no vertex/);
  assert.throws(() => coastRun('c01', 'j_hr_hf_sk'), /not on the coast/);
  assert.equal(closedRing(ISLANDS.auridon).length, 5, 'closed: the first point repeated last');
});

test('TAMRIEL1 geography: THE TOPOLOGY - every edge is coast (one ring) or a border (two rings, two provinces), the borders table IS the shared edges and the coast IS the loops, and nothing else', () => {
  const { coast, border, bad } = classifyEdges();
  assert.deepEqual(bad, [], 'no edge in three rings, none in two rings of one province');
  const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const expectBorder = new Map();
  for (const [name, b] of Object.entries(BORDERS)) {
    for (let i = 0; i + 1 < b.run.length; i++) expectBorder.set(key(b.run[i], b.run[i + 1]), [name, b.between]);
  }
  assert.equal(border.size, expectBorder.size, 'as many border edges as the borders table spells');
  for (const [k, owners] of border) {
    const e = expectBorder.get(k);
    assert.ok(e, `shared edge ${k} is not in BORDERS`);
    assert.deepEqual([...owners].sort(), [...e[1]].sort(), `${k} is between the provinces ${e[0]} names`);
  }
  const expectCoast = new Set();
  const loops = [COAST, ...Object.values(ISLANDS)];
  for (const loop of loops) for (let i = 0; i < loop.length; i++) expectCoast.add(key(loop[i], loop[(i + 1) % loop.length]));
  assert.equal(coast.size, expectCoast.size);
  for (const k of coast.keys()) assert.ok(expectCoast.has(k), `coast edge ${k} is on no loop`);
  // the mutant that breaks a ring: a vertex dropped from one province's ring and not its neighbour's
  const broken = PROVINCES.map((p) => (p.key === 'Skyrim' ? { ...p, rings: [p.rings[0].filter((n) => n !== 'b_skcy2')] } : p));
  assert.ok(classifyEdges(broken).bad.length > 0 || classifyEdges(broken).coast.size !== coast.size, 'a dropped vertex is caught');
  // an edge in THREE rings, and an edge two rings of ONE province share, are errors and never borders
  const three = [{ key: 'A', rings: [['p', 'q', 'r']] }, { key: 'B', rings: [['p', 'q', 's']] }, { key: 'C', rings: [['p', 'q', 't']] }];
  const t3 = classifyEdges(three);
  assert.deepEqual(t3.bad, ['p|q: A,B,C']); assert.ok(!t3.border.has('p|q'));
  const twice = [{ key: 'A', rings: [['p', 'q', 'r'], ['p', 'q', 's']] }];
  const t2 = classifyEdges(twice);
  assert.deepEqual(t2.bad, ['p|q: A,A']); assert.ok(!t2.border.has('p|q'));
});

test('TAMRIEL1 geography: every city stands in the province it is listed under and outside the Bay\'s own rectangle; every province but High Rock has one capital (Daggerfall is the Bay\'s own); the seas, the ranges and the rivers are on the grid', () => {
  const r = bayPictureRect();
  const inRect = (x, y) => x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1;
  assert.ok(CITIES.length >= 60, 'the continent is peopled');
  for (const c of CITIES) {
    assert.equal(provinceAt(...c.at)?.key, c.province, `${c.name} is in ${c.province}`);
    assert.ok(!inRect(...c.at), `${c.name} is beyond the Bay (its own towns are MAPS.BSA's)`);
  }
  for (const p of PROVINCES) {
    const caps = CITIES.filter((c) => c.province === p.key && c.capital);
    assert.equal(caps.length, p.key === 'HighRock' ? 0 : 1, `${p.key}: one capital`);
  }
  assert.equal(new Set(CITIES.map((c) => c.name)).size, CITIES.length, 'no city twice');
  for (const s of SEAS) assert.equal(provinceAt(...s.at), null, `${s.name} is at sea`);
  assert.equal(seaAt(0, 60).name, 'Eltheric Ocean');
  assert.equal(seaAt(260, 56).name, 'Inner Sea');
  const b = landBounds();
  assert.ok(b.x0 >= 0 && b.y0 >= 0 && b.x1 <= PICTURE_W && b.y1 <= PICTURE_H, 'the land is on the picture');
  for (const rg of MOUNTAIN_RANGES) { assert.ok(rg.pts.length >= 2 && rg.w > 0 && rg.gain > 0 && rg.gain <= 1); }
  for (const rv of RIVERS) assert.ok(rv.pts.length >= 3, `${rv.name} has a course`);
  // the Bay's edge classification the authored shape commits to: its north edge is High Rock, its south Hammerfell,
  // its east land, and its west edge opens to the sea in the middle (the probe measures the data against this)
  assert.equal(provinceAt(r.x0 + 20, r.y0 - 0.5)?.key, 'HighRock');
  assert.equal(provinceAt(r.x0 + 20, r.y1 + 0.5)?.key, 'Hammerfell');
  assert.equal(provinceAt(r.x1 + 0.5, r.y0 + 4)?.key, 'HighRock');
  assert.equal(provinceAt(r.x1 + 0.5, r.y1 - 4)?.key, 'Hammerfell');
  assert.equal(provinceAt(r.x0 - 0.5, (r.y0 + r.y1) / 2), null, 'the Bay opens west to the Eltheric');
  assert.ok(inRing(pts(ISLANDS.vvardenfell), 252, 40) && !inRing(pts(ISLANDS.vvardenfell), 200, 100));
});

// ── THE INK ─────────────────────────────────────────────────────

test('TAMRIEL1 ink: clipOutsideRect cuts a chain exactly at the rectangle\'s edge, keeps a ring that never touches it closed, and joins a ring\'s wrapping run', () => {
  const R = { x0: 0, y0: 0, x1: 100, y1: 50 };
  // in through the west edge and out through the south
  const runs = clipOutsideRect([{ x: -20, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 70 }, { x: 60, y: 70 }], R);
  assert.equal(runs.length, 2);
  assert.deepEqual(runs[0], [{ x: -20, y: 10 }, { x: 0, y: 10 }], 'cut on the west edge');
  assert.deepEqual(runs[1], [{ x: 20, y: 50 }, { x: 20, y: 70 }, { x: 60, y: 70 }], 'resumed on the south edge');
  // a corner clip: both ends outside, the segment through the box
  const corner = clipOutsideRect([{ x: -10, y: 40 }, { x: 40, y: 60 }], { x0: 0, y0: 0, x1: 100, y1: 50 });
  assert.equal(corner.length, 2, 'cut twice where it passed through');
  // a ring that never touches
  const far = [{ x: 200, y: 200 }, { x: 300, y: 200 }, { x: 300, y: 300 }, { x: 200, y: 200 }];
  assert.deepEqual(clipOutsideRect(far, R), [far]);
  // a ring starting inside: no run wraps; one starting outside: the first and last runs are joined
  const ringIn = [{ x: 50, y: 25 }, { x: 150, y: 25 }, { x: 150, y: 100 }, { x: 50, y: 100 }, { x: 50, y: 25 }];
  const a = clipOutsideRect(ringIn, R);
  assert.equal(a.length, 1);
  assert.deepEqual(a[0][0], { x: 100, y: 25 }); assert.deepEqual(a[0][a[0].length - 1], { x: 50, y: 50 });
  const ringOut = [{ x: 150, y: 100 }, { x: 50, y: 100 }, { x: 50, y: 25 }, { x: 150, y: 25 }, { x: 150, y: 100 }];
  const b = clipOutsideRect(ringOut, R);
  assert.equal(b.length, 1, 'the wrap is one run');
  assert.deepEqual(b[0][0], { x: 100, y: 25 }); assert.deepEqual(b[0][b[0].length - 1], { x: 50, y: 50 });
  assert.equal(b[0].length, 5, 'the two outside corners between them');
  // a ring with NO vertex inside whose one edge cuts the box's corner: it is not rotated, and the run that wraps
  // the ring's start is joined into one
  const corner2 = [{ x: -10, y: 40 }, { x: 40, y: 60 }, { x: 60, y: 60 }, { x: 60, y: -20 }, { x: -10, y: 40 }];
  const c2 = clipOutsideRect(corner2, R);
  assert.equal(c2.length, 3, 'the ring passes through the box twice: three runs outside it, not four');
  const wrap = c2.find((run) => run.some((p) => p.x === -10 && p.y === 40));
  assert.equal(wrap.length, 3); assert.deepEqual(wrap[1], { x: -10, y: 40 }, 'the ring\'s start point stands INSIDE its run - the wrap joined');
  for (const run of c2) for (const p of [run[0], run[run.length - 1]]) assert.ok(p.x === 0 || p.x === 100 || p.y === 0 || p.y === 50, 'every run ends on the box');
  assert.deepEqual(clipOutsideRect([{ x: 10, y: 10 }], R), []);
  assert.deepEqual(clipOutsideRect([{ x: -10, y: 10 }], R), [[{ x: -10, y: 10 }]]);
});

test('TAMRIEL1 ink: the fret keeps every authored vertex, moves the coast between them, and is calm beside the Bay\'s rectangle', () => {
  const ring = [{ x: 10, y: 10 }, { x: 40, y: 10 }, { x: 40, y: 40 }, { x: 10, y: 40 }, { x: 10, y: 10 }];
  const calm = { x0: 100, y0: 100, x1: 150, y1: 150 };
  const f = fretRing(ring, calm);
  assert.ok(f.length > ring.length * 10, 'subdivided');
  for (const v of ring) assert.ok(f.some((p) => near(p.x, v.x, 1e-9) && near(p.y, v.y, 1e-9)), `vertex ${v.x},${v.y} kept`);
  assert.deepEqual(f[f.length - 1], f[0], 'closed');
  const moved = f.filter((p) => !(near(p.x, 10, 1e-6) || near(p.x, 40, 1e-6) || near(p.y, 10, 1e-6) || near(p.y, 40, 1e-6)));
  assert.ok(moved.length > 20, 'the shore between vertices is displaced');
  // beside the rectangle nothing moves: a straight run a unit off the box stays straight, the same run far off does not
  const run = (y) => fretRing([{ x: 100, y }, { x: 150, y }, { x: 150, y: y + 0.5 }, { x: 100, y: y + 0.5 }, { x: 100, y }], calm);
  for (const p of run(99)) assert.ok(near(p.y, 99, 1e-9) || near(p.y, 99.5, 1e-9) || near(p.x, 100, 1e-9) || near(p.x, 150, 1e-9), 'calm beside the box');
  assert.ok(run(60).some((p) => !(near(p.y, 60, 1e-9) || near(p.y, 60.5, 1e-9) || near(p.x, 100, 1e-9) || near(p.x, 150, 1e-9))), 'free far from it');
  assert.ok(FRET_CALM >= 2);
});

test('TAMRIEL1 ink: the Bay\'s open coast ends are the chain ends on its edge, and the stitch moves a cut end onto the nearest free Bay end on the SAME edge within reach - once each', () => {
  const bay = [
    [{ x: 0, y: 120 }, { x: 30, y: 140 }, { x: 60, y: 170 }],          // off the west edge
    [{ x: 200, y: 0 }, { x: 220, y: 30 }, { x: 250, y: 0 }],           // on and off the north edge
    [{ x: 400, y: 200 }, { x: 420, y: 230 }],                          // inland: no end
    [{ x: 1000, y: 300 }, { x: 900, y: 310 }],                         // off the east edge
  ];
  const ends = bayCoastEnds(bay);
  assert.deepEqual(ends, [{ x: 0, y: 120 }, { x: 200, y: 0 }, { x: 250, y: 0 }, { x: 1000, y: 300 }]);
  const chains = [
    [{ x: -300, y: 100 }, { x: 0, y: 135 }],       // west edge, 15 off: joined to (0,120)
    [{ x: 0, y: 300 }, { x: -200, y: 320 }],       // west edge, 180 off: left
    [{ x: 215, y: 0 }, { x: 240, y: -100 }],       // north edge: joined to (200,0), the nearer
    [{ x: 0, y: 125 }, { x: -50, y: 100 }],        // west edge, 5 off (0,120) - but that end is taken: left
    [{ x: 300, y: 500 }, { x: 300, y: 700 }],      // south edge: no Bay end there
  ];
  const { chains: out, joined } = stitchToBay(chains, ends);
  assert.equal(joined, 2);
  assert.deepEqual(out[0][1], { x: 0, y: 120 });
  assert.deepEqual(out[1][0], { x: 0, y: 300 });
  assert.deepEqual(out[2][0], { x: 200, y: 0 });
  assert.deepEqual(out[3][0], { x: 0, y: 125 }, 'a Bay end is used once');
  assert.deepEqual(out[4][0], { x: 300, y: 500 });
  assert.equal(stitchToBay(chains, ends, 1).joined, 0, 'reach is the law');
  // a cut end on the west edge beside a Bay end on the NORTH edge, within reach: never joined across edges
  const corner = stitchToBay([[{ x: 0, y: 10 }, { x: -40, y: 10 }]], [{ x: 20, y: 0 }]);
  assert.equal(corner.joined, 0); assert.deepEqual(corner.chains[0][0], { x: 0, y: 10 });
  assert.equal(STITCH_REACH, 40);
});

test('TAMRIEL1 ink: the built model has no coast point on the Bay\'s own ground, its cut ends lie on the Bay\'s edge, every city beyond the Bay, and the model is minted once a coast array', () => {
  const bayCoast = [[{ x: 0, y: 430 }, { x: 40, y: 420 }], [{ x: 263, y: 0 }, { x: 260, y: 20 }]];
  const ink = buildTamrielInk({ bayCoast });
  assert.ok(ink.coast.length >= 3 && ink.borders.length >= Object.keys(BORDERS).length - 1, 'the mainland and the islands, and the borders (one is cut by the Bay)');
  let total = 0;
  for (const c of ink.coast) for (const p of c) { total++; assert.ok(!(p.x > 0 && p.x < BAY_W && p.y > 0 && p.y < BAY_H), 'no coast point inside the Bay'); }
  for (const c of ink.borders) for (const p of c) assert.ok(!(p.x > 0 && p.x < BAY_W && p.y > 0 && p.y < BAY_H), 'no border point inside the Bay');
  for (const h of ink.carets) assert.ok(!inBay(h.x, h.y), 'no caret inside the Bay');
  for (const c of ink.cities) assert.ok(!inBay(c.x, c.y));
  assert.ok(total < 4000, `the coast is ${total} points - a budget, not a bay`);
  assert.ok(ink.carets.length < 3000, `${ink.carets.length} carets`);
  const onEdge = (p) => near(p.x, 0, 1e-6) || near(p.x, BAY_W, 1e-6) || near(p.y, 0, 1e-6) || near(p.y, BAY_H, 1e-6);
  const cut = ink.coast.flatMap((c) => [c[0], c[c.length - 1]]).filter(onEdge);
  assert.equal(cut.length, 2, 'the mainland\'s coast is cut twice by the Bay: once going in, once coming out');
  assert.equal(ink.bayEnds, 2);
  assert.equal(ink.joined, 2, 'both joined to the Bay\'s own ends placed within reach');
  assert.ok(cut.some((p) => near(p.x, 0) && near(p.y, 430)) && cut.some((p) => near(p.x, 263) && near(p.y, 0)), 'ON the Bay\'s ends');
  assert.deepEqual(ink.frame, tamrielFrameInBay());
  assert.equal(ink.provinces.length, 9); assert.equal(ink.seas.length, SEAS.length);
  assert.equal(ink.cities.length, CITIES.length, 'every authored city is beyond the Bay');
  // minted once a coast array
  const model = { coast: bayCoast };
  assert.equal(tamrielInkFor(model), tamrielInkFor(model));
  assert.notEqual(tamrielInkFor(model), tamrielInkFor({ coast: bayCoast.slice() }));
  assert.equal(tamrielInkFor(null), tamrielInkFor(undefined), 'no Bay model: one shared continent');
});

test('TAMRIEL1 ink: viewLeavesBay is one rectangle test, onContinent is CONTINENT_BELOW of the Bay\'s fit, and the paint does NOTHING - not a call - while the view is on the Bay', () => {
  assert.equal(viewLeavesBay({ ox: 0, oy: 0, scale: 1 }, 1000, 500), false, 'exactly the Bay');
  assert.equal(viewLeavesBay({ ox: 100, oy: 100, scale: 4 }, 800, 600), false);
  assert.equal(viewLeavesBay({ ox: -1, oy: 0, scale: 4 }, 800, 600), true);
  assert.equal(viewLeavesBay({ ox: 0, oy: 0, scale: 0.5 }, 800, 600), true, 'the sheet shows past the east edge');
  assert.equal(viewLeavesBay({ ox: 800, oy: 400, scale: 2 }, 800, 600), true, 'past the south-east corner');
  assert.equal(viewLeavesBay({ ox: 500, oy: 0, scale: 2 }, 1200, 600), true, 'past the east edge alone');
  assert.equal(viewLeavesBay({ ox: 0, oy: 200, scale: 2 }, 1200, 800), true, 'past the south edge alone');
  assert.equal(CONTINENT_BELOW, 0.85);
  assert.equal(onContinent(0.84, 1), true); assert.equal(onContinent(0.85, 1), false); assert.equal(onContinent(2, 1), false);
  const ink = buildTamrielInk();
  const ctx = recordingCtx();
  assert.equal(paintTamrielInk(ctx, { ox: 100, oy: 50, scale: 2 }, ink, { paperW: 900, paperH: 560 }), false);
  assert.equal(ctx.calls.length, 0, 'not one canvas call on the Bay');
  assert.equal(paintTamrielInk(ctx, { ox: 0, oy: 0, scale: 1 }, null, { paperW: 900, paperH: 560 }), false, 'no model, nothing');
});

test('TAMRIEL1 ink: off the Bay the paint strokes the coast in the Bay\'s own pen (wash under line), the borders dashed, the Bay\'s edge dotted, the capitals at any zoom and every city once the sheet is in, and the names in the sheet\'s faces', () => {
  const ink = buildTamrielInk();
  const continent = { ox: -2000, oy: -1500, scale: 0.15 };
  const ctx = recordingCtx();
  assert.equal(paintTamrielInk(ctx, continent, ink, { paperW: 900, paperH: 560, continent: true, bayFit: 0.9 }), true);
  const strokes = ctx.calls.filter((c) => c.fn === 'stroke');
  assert.ok(strokes.length >= 6);
  assert.equal(strokes[0].strokeStyle, PEN.wash, 'the shore\'s wash first');
  assert.equal(strokes[1].strokeStyle, PEN.line, 'then the line');
  assert.equal(strokes[1].lineWidth, 1.3);
  assert.equal(strokes[2].strokeStyle, PEN.relief, 'the high ground\'s carets');
  const dashes = ctx.calls.filter((c) => c.fn === 'setLineDash').map((c) => c.args[0]);
  assert.ok(dashes.some((d) => d.length === 2 && d[0] === 4 && d[1] === 3), 'the borders dashed as the Bay\'s');
  assert.ok(dashes.some((d) => d.length === 2 && d[0] === 2 && d[1] === 4), 'the Bay\'s edge dotted');
  const fills = ctx.calls.filter((c) => c.fn === 'fillText').map((c) => c.args[0]);
  const spaced = spacedName;
  assert.ok(fills.includes(spaced('Skyrim')) && fills.includes(spaced('Sumurset Isle')), 'the provinces, letter-spaced as the Bay\'s regions');
  assert.ok(fills.includes(spaced('Sea of Ghosts')), 'the seas');
  assert.ok(fills.includes('Solitude') && fills.includes('Imperial City'), 'the capitals');
  assert.ok(!fills.includes('Whiterun'), 'not the towns, on the continent');
  const haloed = ctx.calls.filter((c) => c.fn === 'strokeText');
  assert.ok(haloed.length >= 8 && haloed.every((c) => c.strokeStyle === PEN.halo), 'every city name haloed in the parchment');
  const regionFont = ctx.calls.filter((c) => c.fn === 'fillText' && c.args[0] === spaced('Skyrim'))[0].font;
  assert.match(regionFont, /^300 15px/, 'the continent\'s province name is the far band\'s size');
  // in to the Bay's own fit: every city, and the names a size larger
  const ctx2 = recordingCtx();
  assert.equal(paintTamrielInk(ctx2, { ox: -1000, oy: -450, scale: 0.4 }, ink, { paperW: 900, paperH: 560, continent: false, bayFit: 0.4 }), true);
  const fills2 = ctx2.calls.filter((c) => c.fn === 'fillText').map((c) => c.args[0]);
  assert.ok(fills2.includes('Hegathe') && fills2.includes('Northpoint'), 'the towns, in');
  assert.ok(!fills2.includes('Helstrom'), 'a city off the sheet is not lettered');
  // the carets thin with the zoom: fewer caret strokes out than in, on the same ground
  const carets = (c) => c.calls.filter((x) => x.fn === 'lineTo' && x.strokeStyle === PEN.relief).length;
  const ctxFar = recordingCtx(), ctxNear = recordingCtx();
  paintTamrielInk(ctxFar, { ox: 1000, oy: -200, scale: 0.2 }, ink, { paperW: 900, paperH: 560 });
  paintTamrielInk(ctxNear, { ox: 1000, oy: -200, scale: 1.2 }, ink, { paperW: 900, paperH: 560 });
  assert.ok(carets(ctxFar) > 0 && carets(ctxNear) > 0);
  // the context is restored, and nothing is cleared: the Bay's ink under this layer stands
  assert.ok(!ctx.calls.some((c) => c.fn === 'clearRect'), 'never clears the Bay\'s ink');
  assert.equal(ctx.calls.filter((c) => c.fn === 'save').length, ctx.calls.filter((c) => c.fn === 'restore').length);
});

test('TAMRIEL1 ink: a hover beyond the Bay answers a city within CITY_HIT_PX, else the province, else the sea, and nothing on the Bay\'s own ground', () => {
  const ink = buildTamrielInk();
  const view = { ox: -2000, oy: -1500, scale: 0.5 };
  assert.equal(tamrielPlaceAt(500, 250, view, ink), null, 'the Bay\'s reads are the window\'s');
  const solitude = ink.cities.find((c) => c.name === 'Solitude');
  assert.equal(tamrielPlaceAt(solitude.x + 2, solitude.y - 3, view, ink), TAMRIEL_TEXT.city('Skyrim', 'Solitude'));
  assert.equal(tamrielPlaceAt(solitude.x + (CITY_HIT_PX + 1) / view.scale, solitude.y, view, ink), TAMRIEL_TEXT.land('Skyrim'), 'past reach, the province');
  // the reach is PAPER pixels: zoomed out it is more map pixels, zoomed in fewer
  assert.equal(tamrielPlaceAt(solitude.x + 12, solitude.y, view, ink), TAMRIEL_TEXT.city('Skyrim', 'Solitude'), '12 map px at scale 0.5 is 6 paper px: hit');
  assert.equal(tamrielPlaceAt(solitude.x + 6, solitude.y, { ...view, scale: 2 }, ink), TAMRIEL_TEXT.land('Skyrim'), '6 map px at scale 2 is 12 paper px: missed');
  const [sx, sy] = pictureToBay(26, 66);
  assert.equal(tamrielPlaceAt(sx, sy, view, ink), 'Eltheric Ocean');
  assert.equal(tamrielPlaceAt(solitude.x, solitude.y, view, null), TAMRIEL_TEXT.land('Skyrim'), 'no model: no cities, the province still');
  assert.equal(TAMRIEL_TEXT.city('Skyrim', 'Solitude'), 'Skyrim : Solitude (beyond the Bay)', 'the sheet\'s own "Region : Location" reading');
  assert.equal(TAMRIEL_TEXT.land('Skyrim'), 'Skyrim (beyond the Bay)');
});

// ── THE RASTER ──────────────────────────────────────────────────

test('TAMRIEL1 raster: the frame in WOODS\' own shape - sea bytes 0 and Ocean, land the province\'s climate and from SHORE_BYTE up, a range lifted toward the snowline - and deterministic', () => {
  const r = rasterizeTamriel({ cell: 25 });
  assert.equal(r.width, Math.ceil(TAMRIEL_W / 25)); assert.equal(r.height, Math.ceil(TAMRIEL_H / 25));
  let sea = 0, land = 0;
  for (let i = 0; i < r.province.length; i++) {
    if (r.province[i] === PROVINCE_NONE) { sea++; assert.equal(r.heightBytes[i], 0); assert.equal(r.climate[i], CLIMATES.Ocean); } else {
      land++;
      assert.equal(r.climate[i], PROVINCES[r.province[i]].climate);
      assert.ok(r.heightBytes[i] >= SHORE_BYTE);
    }
  }
  assert.ok(land > r.province.length * 0.3 && sea > r.province.length * 0.3, 'a continent in an ocean');
  // Red Mountain: the cell under its spine is at the snowline
  const [mx, my] = [MOUNTAIN_RANGES.find((g) => g.name === 'Red Mountain').pts[0][0] * PIXELS_PER_PICTURE_UNIT / 25, MOUNTAIN_RANGES.find((g) => g.name === 'Red Mountain').pts[0][1] * PIXELS_PER_PICTURE_UNIT / 25];
  const peak = r.heightBytes[Math.floor(my) * r.width + Math.floor(mx)];
  assert.ok(peak >= SNOWLINE_BYTE, `the peak ${peak} is over the snowline ${SNOWLINE_BYTE}`);
  assert.ok(SNOW_BYTE > SNOWLINE_BYTE);
  // a cell of Skyrim's label is Skyrim, in the Mountain climate
  const p = provinceByKey('Skyrim');
  const i = Math.floor(p.label[1] * PIXELS_PER_PICTURE_UNIT / 25) * r.width + Math.floor(p.label[0] * PIXELS_PER_PICTURE_UNIT / 25);
  assert.equal(PROVINCES[r.province[i]].key, 'Skyrim'); assert.equal(r.climate[i], CLIMATES.Mountain);
  const r2 = rasterizeTamriel({ cell: 25 });
  assert.deepEqual(r2.heightBytes, r.heightBytes); assert.deepEqual(r2.province, r.province);
});

test('TAMRIEL1 raster: composeBay lays the Bay\'s own height and climate over its rectangle - every cell on the Bay, none beside it - and keeps the authored province', () => {
  const r = rasterizeTamriel({ cell: 25 });
  const before = r.heightBytes.slice();
  const heightBytes = new Uint8Array(BAY_W * BAY_H);
  for (let y = 0; y < BAY_H; y++) for (let x = 0; x < BAY_W; x++) heightBytes[y * BAY_W + x] = 100 + (x % 7);
  const written = composeBay(r, { heightBytes, climateAt: (x, y) => (y < 250 ? CLIMATES.Swamp : CLIMATES.Desert2) });
  const cells = Math.floor(BAY_W / 25) * Math.floor(BAY_H / 25);
  assert.ok(written >= cells && written <= (Math.floor(BAY_W / 25) + 1) * (Math.floor(BAY_H / 25) + 1), `${written} cells on the Bay`);
  let changed = 0;
  for (let y = 0; y < r.height; y++) {
    for (let x = 0; x < r.width; x++) {
      const i = y * r.width + x;
      const bx = (x + 0.5) * 25 - BAY_ORIGIN.x, by = (y + 0.5) * 25 - BAY_ORIGIN.y;
      const on = bx >= 0 && by >= 0 && bx < BAY_W && by < BAY_H;
      if (on) {
        assert.equal(r.heightBytes[i], heightBytes[Math.floor(by) * BAY_W + Math.floor(bx)], 'the Bay\'s own byte');
        assert.equal(r.climate[i], by < 250 ? CLIMATES.Swamp : CLIMATES.Desert2);
        changed++;
      } else assert.equal(r.heightBytes[i], before[i], 'beside the Bay nothing moves');
    }
  }
  assert.equal(changed, written);
  // the province byte is the rings' word: High Rock north of the water, Hammerfell south
  const [nx, ny] = bayToTamriel(500, 20), [sx, sy] = bayToTamriel(500, 480);
  assert.equal(PROVINCES[r.province[Math.floor(ny / 25) * r.width + Math.floor(nx / 25)]].key, 'HighRock');
  assert.equal(PROVINCES[r.province[Math.floor(sy / 25) * r.width + Math.floor(sx / 25)]].key, 'Hammerfell');
  // a climate the Bay cannot answer (-1, the edge of the data) is left
  const r3 = rasterizeTamriel({ cell: 125 });
  const [cx, cy] = bayToTamriel(500, 250);
  const ci = Math.floor(cy / 125) * r3.width + Math.floor(cx / 125);
  const authored = r3.climate[ci];
  composeBay(r3, { heightBytes, climateAt: () => -1 });
  assert.equal(r3.climate[ci], authored, 'the authored climate stands where the data answers -1');
});

// ── THE CLAMP, THE BAND, THE SWITCH ─────────────────────────────

test('TAMRIEL1 clamp: clampView takes the map\'s own origin - absent, nothing moves; present, the rest centres on the frame and a pan is held at ITS edges', () => {
  const lim = { mapW: 1000, mapH: 500, paperW: 1000, paperH: 600 };
  assert.deepEqual(clampView({ ox: -30, oy: -30, scale: 4 }, lim), clampView({ ox: -30, oy: -30, scale: 4 }, { ...lim, mapX0: 0, mapY0: 0 }), 'absent is zero');
  const frame = { mapW: 6000, mapH: 3750, mapX0: -862, mapY0: -975, paperW: 900, paperH: 560 };
  const rest = clampView({ ox: 0, oy: 0, scale: 0 }, frame);
  assert.equal(rest.scale, scaleMinOf(frame));
  const mid = [rest.ox + 450 / rest.scale, rest.oy + 280 / rest.scale];
  assert.ok(near(mid[0], -862 + 3000) && near(mid[1], -975 + 1875), 'the rest looks at the frame\'s middle');
  const west = clampView({ ox: -1e6, oy: 100, scale: 2 }, frame);
  assert.equal(west.ox, -862, 'held at the frame\'s west edge');
  const east = clampView({ ox: 1e6, oy: 100, scale: 2 }, frame);
  assert.ok(near(east.ox, -862 + 6000 - 450), 'held at the east edge');
  const inside = clampView({ ox: -500, oy: -300, scale: 2 }, frame);
  assert.deepEqual(inside, { ox: -500, oy: -300, scale: 2 }, 'free inside the frame - west and north of the Bay');
  const nan = clampView({ ox: 0, oy: 0, scale: NaN }, frame);
  assert.equal(nan.scale, scaleMinOf(frame), 'a NaN view rests, on the frame');
});

test('TAMRIEL1 continent: the flag thins the Bay\'s carets to CARET_STEP.continent and letters no region name; the band\'s own roads, tracks and marks stand as the band says', () => {
  assert.equal(CONTINENT_BAND, 'continent');
  assert.equal(BAND_MARKS.continent, undefined, 'not a band');
  assert.equal(CARET_STEP.continent, 12);
  assert.ok(CARET_STEP.continent > CARET_STEP.far);
  // a 30x30 fixture of high ground with two regions and a road
  const w = 30, h = 30;
  const bytes = new Uint8Array(w * h).fill(80);
  const roads = new Uint8Array(w * h), tracks = new Uint8Array(w * h);
  for (let x = 1; x < 29; x++) { roads[15 * w + x] = 32 | 2; tracks[10 * w + x] = 32 | 2; }
  const model = buildInkModel({ width: w, height: h, heightBytes: bytes, climateAt: () => CLIMATES.Woodlands, regionAt: (x) => (x < 15 ? 0 : 1), regionCount: 2, roads: { source: 'basic-roads', roads, tracks } });
  assert.equal(model.highBands.continent.length, model.high.filter((p) => p.x % 12 === 0 && p.y % 12 === 0).length);
  assert.ok(model.highBands.continent.length < model.highBands.far.length);
  const paint = (band, continent = false) => {
    const ctx = recordingCtx();
    paintInkStatic(ctx, model, { ox: 0, oy: 0, scale: 5 }, { paperW: 150, paperH: 150, band, continent, regionNames: ['West', 'East'] });
    return ctx.calls;
  };
  const cont = paint('far', true), far = paint('far');
  assert.ok(!cont.some((c) => c.fn === 'fillText'), 'no region name on the continent');
  assert.ok(far.some((c) => c.fn === 'fillText' && c.args[0] === spacedName('West')), 'far letters them');
  const dashes = (calls) => calls.filter((c) => c.fn === 'setLineDash').map((c) => c.args[0]);
  assert.ok(!dashes(cont).some((d) => d.length === 2 && d[0] === 2 && d[1] === 3), 'no tracks at far, continent or not');
  const roadStroke = (calls) => calls.filter((c) => c.fn === 'stroke' && c.strokeStyle === PEN.line && c.lineWidth === 1);
  assert.ok(roadStroke(cont).length >= 1, 'the roads at the far width');
  assert.equal(paint('mid', true).filter((c) => c.fn === 'fillText').length, 0, 'the flag silences the names at any band');
  const caretsOf = (calls) => calls.filter((c) => c.fn === 'lineTo' && c.strokeStyle === PEN.relief).length;
  assert.ok(caretsOf(cont) < caretsOf(far) && caretsOf(cont) > 0);
  // penOf is the one pen: exported for the continent's layer, culled per segment as before
  const ctx = recordingCtx();
  const { stroke, visible } = penOf(ctx, { ox: 0, oy: 0, scale: 1 }, 100, 100);
  stroke([[{ x: 500, y: 500 }, { x: 600, y: 600 }]], 1, PEN.line);
  assert.ok(!ctx.calls.some((c) => c.fn === 'lineTo'), 'a chain off the sheet draws nothing');
  assert.equal(visible(50, 50), true); assert.equal(visible(500, 50), false);
});

test('TAMRIEL1 switch: the Features row `tamriel-map` is on by default on the player\'s own prefs key, tamrielMapOn follows it, and `?tamriel=off` is the kill door', () => {
  const row = FEATURES.find((f) => f.id === 'tamriel-map');
  assert.ok(row, 'the row');
  assert.equal(row.group, 'interface');
  assert.deepEqual([...row.kinds], ['enhanced']);
  assert.deepEqual(row.control, { store: 'prefs', key: 'tamrielMap', initial: true, online: 'player' });
  assert.match(row.effect, /next time a map is opened/);
  assert.match(row.note, /Nothing beyond the Bay can be travelled to/, 'the note says what the map is not');
  _resetForTests();
  try {
    assert.equal(tamrielMapOn(), true, 'on by default');
    setPref('tamrielMap', false);
    assert.equal(tamrielMapOn(), false);
    setPref('tamrielMap', true);
    assert.equal(tamrielMapOn(), true);
    globalThis.location = { search: '?tamriel=off' };
    _resetForTests();
    assert.equal(tamrielMapOn(), false, 'the kill door');
  } finally { delete globalThis.location; _resetForTests(); }
});

// ── THE SOURCE SWEEPS ───────────────────────────────────────────

test('TAMRIEL1 sweep: the window paints the continent AFTER the Bay\'s ink and under the zone map\'s, hands the frame and the home view through the sheet, answers the hover beyond the Bay, and reads the switch once at open; the layer reads no game data', () => {
  const held = read('src/ui/heldMap.js');
  const sheet = held.slice(held.indexOf('  _worldSheet() {'), held.indexOf('  _showChrome('));
  assert.ok(sheet.indexOf('paintInkStatic(ctx, env.model, env.view, {') < sheet.indexOf('paintTamrielInk(ctx, env.view, tamrielInkFor(env.model)'), 'the Bay\'s ink first - it clears the canvas');
  assert.ok(sheet.indexOf('paintTamrielInk(') < sheet.indexOf("part: 'over'"), 'under the zone map\'s wash');
  assert.match(sheet, /if \(this\._tamriel && !this\._zoneMap\) \{/, 'never on the zone map');
  assert.match(sheet, /frame: \(\) => \(this\._tamriel \? tamrielFrameInBay\(\) : null\)/, 'the frame through the sheet, off when the switch is');
  assert.match(sheet, /homeView: \(lim\) => \(this\._tamriel && lim/, 'the home view is the Bay\'s fit while the frame is round it');
  assert.match(sheet, /band: env\.band,\n/, 'the band is the band');
  assert.match(sheet, /continent: this\._tamriel && onContinent\(env\.view\.scale, this\._bayFit\(\)\),/, 'the flag the Bay\'s ink thins for');
  assert.match(held, /this\._tamriel = tamrielMapOn\(\);/, 'read once, at open');
  assert.match(held, /const frame = this\._sheet\?\.frame\?\.\(\) \?\? null;\n    if \(frame\) return \{ mapW: frame\.w, mapH: frame\.h, mapX0: frame\.x0, mapY0: frame\.y0/, 'the limits carry the origin');
  const hover = held.slice(held.indexOf('  _hoverLabel(sx, sy) {'), held.indexOf('  _pickAt(sx, sy) {'));
  assert.match(hover, /const place = tamrielPlaceAt\(mx, my, this\._view, tamrielInkFor\(this\._model\)\);/);
  assert.match(hover, /if \(!this\._tamriel \|\| this\._zoneMap\) return null;/, 'off, or on the zone map, the old null');
  const pick = held.slice(held.indexOf('  _pickAt(sx, sy) {'), held.indexOf('  _pickAt(sx, sy) {') + 4000);
  assert.ok(!/tamriel/i.test(pick), 'a press beyond the Bay picks nothing: not traversable');
  const ink = read('src/ui/tamrielInk.js');
  for (const bad of ['woodsFile', 'mapsFile.js', 'pakFile', 'mapDirectory', 'fetch(']) assert.ok(!ink.includes(bad), `the layer never reads ${bad}`);
  assert.match(ink, /if \(!ink \|\| !viewLeavesBay\(view, paperW, paperH\)\) return false;/, 'the one rectangle test, first');
  assert.match(ink, /const _inks = new WeakMap\(\);/, 'one model a data set');
  const geo = read('src/world/tamrielGeography.js');
  assert.ok(!/TMAP00I0\.IMG|readFileSync|import .*imgFile/.test(geo), 'authored, never traced from the picture');
  const frame = read('src/world/tamrielFrame.js');
  assert.match(frame, /export const BAY_ORIGIN = Object\.freeze\(\{ x: 862, y: 975 \}\);/, 'the one authored offset, named once');
  assert.ok(!/from '\.\.\/net\//.test(frame + geo + read('src/world/tamrielGround.js')), 'TAMRIEL2-WORKER: nothing of net/ under the frame, the geography or the ground - the terrain worker reads them');
  assert.ok(!/BAY_ORIGIN\s*=|862, 975/.test(ink + geo + read('src/world/tamrielRaster.js')), 'and nowhere else');
});
