// RELIEF-PEAKS (2026-10-27, bible/03-World/Tamriel.md RELIEF-PEAKS; KPbICA on the game's Discord, forwarded by the owner:
// "No mountains ... Instead we're getting strange looking canyons", "No 'Red Mountain' in Morrowind", "Strange projections
// above the horizon line"). Pinned here:
//   - the large map past the Bay is WOODS.WLD's own law of the small byte (it was a swell about 4.5: the continent stood
//     a third under the Bay's height at the same byte), blended in from the Bay's edge as the bytes are (it handed over at
//     the seam, a wall of some 600 m along the Wrothgarians);
//   - the continent's landforms' frames ease into a fixed frame where their direction is weak (they handed one field to
//     another inside a sample: walls of 80 to 116 m - the canyons);
//   - the ranges under the heightmap's grain and Red Mountain's cone (world/tamriel/tamrielRanges.js), in the shaper;
//   - the far views stand on the kernel's own ground at their vertices (the far ring at a pixel's centre, the far field at
//     a node), the large map and the ranges with it - nothing drawn over the ground's own horizon.
// Where ARENA2_PATH names the data, the freeware's ranges, Red Mountain, the Bay's edge and the far views on its ground.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { LARGE_LAW, largeOfByte, groundWoods, tamrielLargeMap, tamrielHeightByte, dropGroundCache, SEAM_PX, BLEND_PX, groundBefore, largeMapBefore, LARGE_SWELL_BEFORE } from '../../src/world/tamriel/tamrielGround.js';
import {
  RANGE_DIALS, RANGE_MEAN, ridges, rangeSwing, rangeCentre, rangeCeiling, rangeUp, tamrielRangeAt, rangeBound, waterDistance,
} from '../../src/world/tamriel/tamrielRanges.js';
import { landformLattice, tamrielLandformAt, ORIENT_FULL, STRUCTURE_REACH } from '../../src/world/tamriel/tamrielLandforms.js';
import { nodeGround, centreGround, nodeGroundAt, meanGroundField, groundTopOf, cliffFadeAt, groundMovedField, createLandforms, LANDFORM_KNEE, CONTINENT_CEILING, LANDFORM_CEILING, reliefLift, continentLift, CONTINENT_LIFT } from '../../src/world/landforms.js';
import { kernelTerms, sampleKernel, cubicInterpolator, BASE_HEIGHT_SCALE, NOISE_MAP_SCALE, MAX_TERRAIN_HEIGHT, EXTRA_NOISE_SCALE, STREAMING_TERRAIN_SCALE, SCALED_OCEAN_ELEVATION, GROUND_FRAME_LAW, RELIEF_FRAME_LAW, LIFT_FRAME_LAW, RECORD_GROUND_STAMP } from '../../src/world/terrain/terrainSampler.js';
import { farFieldCell, buildFarFieldBytes } from '../../src/world/terrain/midRingGrid.js';
import { ringGroundAt, ringHeight } from '../../src/render/farRing.js';
import { redMountainFrame, redMountainLiftAt, redMountainNodeLift } from '../../src/world/tamriel/redMountain.js';   // RED-MOUNTAIN: Red Mountain, the merge's one
import { setTamrielTrace } from '../../src/world/tamriel/tamrielLand.js';
import { setTamrielFit } from '../../src/world/tamriel/tamrielFrame.js';
import { RELIEF_SCALE } from '../../src/world/tamriel/tamrielRelief.js';
import { recordFrame } from '../../src/scenes/groundFrameHost.js';
import { CLIMATES } from '../../src/formats/mapsTables.js';
import { MAP_WIDTH, MAP_HEIGHT } from '../../src/formats/woodsFile.js';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const U = STREAMING_TERRAIN_SCALE;

/** A WoodsFile's reads over a buffer, on a prototype as the real reader's are (the composition is a prototype child), its
 *  large map the law's of each byte (the Bay's own, measured below with ARENA2). */
class StubWoods {
  constructor(fill) { this.heightMapBuffer = new Uint8Array(MAP_WIDTH * MAP_HEIGHT); for (let i = 0; i < this.heightMapBuffer.length; i++) this.heightMapBuffer[i] = fill(i % MAP_WIDTH, Math.floor(i / MAP_WIDTH)); }
  getHeightMapValue(x, y) {
    if (x < 0) x = 0; if (x >= MAP_WIDTH - 1) x = MAP_WIDTH - 1; if (y < 0) y = 0; if (y >= MAP_HEIGHT - 1) y = MAP_HEIGHT - 1;
    return this.heightMapBuffer[y * MAP_WIDTH + x];
  }
  getHeightMapValuesRange1Dim(x0, y0, dim) { const d = new Uint8Array(dim * dim); for (let y = 0; y < dim; y++) for (let x = 0; x < dim; x++) d[x + y * dim] = this.getHeightMapValue(x0 + x, y0 + y); return d; }
  getLargeMapData(x, y) { const v = Math.round(largeOfByte(this.getHeightMapValue(x, y))), d = []; for (let i = 0; i < 5; i++) d.push(new Uint8Array(5).fill(v)); return d; }
  getLargeHeightMapValuesRange(x0, y0, dim) {
    const side = dim * 3, dst = new Uint8Array(side * side);
    for (let y = 0; y < dim; y++) for (let x = 0; x < dim; x++) {
      const src = this.getLargeMapData(x0 + x, y0 - y);
      for (let iy = 1; iy < 4; iy++) for (let ix = 1; ix < 4; ix++) dst[(y * 3 + iy - 1) * side + (x * 3 + ix - 1)] = src[ix][4 - iy];
    }
    return dst;
  }
}
/** Morrowind in a box with relief (tamrielrelief.test.js's shape): a plain at 60 bytes, a cone to 123 at picture (235, 54) -
 *  Red Mountain's summit (namedSummit) - and Skyrim's strip north of it at 150. */
function reliefTrace() {
  const w = 320, h = 200, land = new Uint8Array(w * h), province = new Uint8Array(w * h);
  for (let y = 30; y < 100; y++) for (let x = 200; x < 290; x++) { land[y * w + x] = 1; province[y * w + x] = 4; }
  for (let y = 20; y < 30; y++) for (let x = 240; x < 260; x++) { land[y * w + x] = 1; province[y * w + x] = 3; }
  const s = RELIEF_SCALE, cells = new Uint8Array(w * s * h * s);
  for (let j = 0; j < h * s; j++) for (let i = 0; i < w * s; i++) {
    const px = (i + 0.5) / s, py = (j + 0.5) / s, k = Math.floor(py) * w + Math.floor(px);
    if (!land[k]) continue;
    cells[j * w * s + i] = province[k] === 3 ? 150 : Math.max(60, Math.round(123 - 9 * Math.hypot(px - 235, py - 54)));
  }
  return { w, h, land, province, relief: cells };
}
const FIT = Object.freeze({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });   // the freeware's fit
const withRelief = async (fn) => {
  setTamrielFit(FIT); setTamrielTrace(reliefTrace()); dropGroundCache();
  try { return await fn(); } finally { setTamrielTrace(null); setTamrielFit(null); dropGroundCache(); }
};

// ── THE LARGE MAP ─────────────────────────────────────────────────

test('RELIEF-PEAKS the large map\'s law: 1.18 times the small byte to byte 85, the byte itself by the Bay\'s top (109) - continuous and never falling there - and past it the kernel\'s own height (the small term and the large) running on to DFU\'s ceiling less the ground noise and a cell at byteTop, never over it, so no byte past the Bay\'s tallest stands on the clamp as a plateau; 0 at sea (mutants: the gain, the knee, the top, the run past it)', () => {
  const { gain, knee, top, byteTop } = LARGE_LAW;
  assert.deepEqual([gain, knee, top, byteTop], [1.18, 85, 109, 180]);
  assert.equal(largeOfByte(0), 0); assert.equal(largeOfByte(-3), 0);
  assert.ok(Math.abs(largeOfByte(50) - 59) < 1e-9, 'the Bay\'s 59.0 at byte 50');
  for (let b = 1; b <= knee; b += 0.5) assert.ok(Math.abs(largeOfByte(b) - gain * b) < 1e-9, `${gain} times the byte to the knee (${b})`);
  assert.ok(largeOfByte(knee + 1) < gain * (knee + 1), 'and less past it');
  assert.ok(Math.abs(largeOfByte(top) - top) < 1e-9, 'the byte itself at the top');
  let last = 0;
  for (let b = 0; b <= top; b += 0.25) { const v = largeOfByte(b); assert.ok(v >= last - 1e-9, `never falls to the top (${b})`); last = v; }
  const h1 = MAX_TERRAIN_HEIGHT - EXTRA_NOISE_SCALE - NOISE_MAP_SCALE, h = (b) => BASE_HEIGHT_SCALE * b + NOISE_MAP_SCALE * largeOfByte(b);
  assert.ok(Math.abs(h(byteTop) - h1) < 1e-9, 'the kernel\'s height at byteTop: the ceiling less the noise and a cell');
  let prev = h(top);
  for (let b = top + 1; b <= byteTop; b++) { assert.ok(h(b) > prev, `the kernel's height still rising at ${b}`); prev = h(b); }
  for (let b = 0; b <= byteTop; b++) assert.ok(h(b) <= h1 + 1e-9, `never over the ceiling to byteTop (${b})`);
  for (let b = 0; b <= 255; b++) assert.ok(largeOfByte(b) >= 0, `never negative (${b}): past byteTop the small term's own, DFU's clamp holding it`);
});

test('RELIEF-PEAKS the continent\'s large map is the law of its bytes: each cell the law of the small term where the kernel reads that cell (DFU\'s cubic of the bytes about the pixel\'s node, a third of a pixel apart), rounded; none at sea - so the kernel\'s large term is the law of its small one at every sample, to the cells\' rounding (mutants: the cell read bilinearly; a cell\'s place off by its third; the sea\'s detail)', () => {
  dropGroundCache();
  try {
    for (const [x, y] of [[2200, -300], [3000, 100], [1500, 1300]]) {
      const lm = tamrielLargeMap(x, y), b = (i, j) => tamrielHeightByte(x + i, y + j);
      if (b(0, 0) === 0) { assert.ok(lm.every((c) => c.every((v) => v === 0)), 'none at sea'); continue; }
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          const fx = (i - 2) / 3, fy = (j - 2) / 3, X = Math.floor(fx), tx = fx - X, Y = Math.floor(fy), ty = fy - Y;
          const row = (r) => cubicInterpolator(b(X - 1, r), b(X, r), b(X + 1, r), b(X + 2, r), tx);
          assert.equal(lm[i][j], Math.round(largeOfByte(cubicInterpolator(row(Y + 2), row(Y + 1), row(Y), row(Y - 1), 1 - ty))), `${x},${y} cell ${i},${j}`);
        }
      }
    }
    // the kernel: its large term the law of its small, sample for sample, within the cells' rounding and their cubic
    const g = groundWoods(new StubWoods(() => 20));
    let worst = 0;
    for (const [px, py] of [[2200, -300], [2600, 500], [1800, 1200]]) {
      const { base, noise } = kernelTerms(g, px, py);
      for (let y = 0; y <= 128; y += 16) for (let x = 0; x <= 128; x += 16) worst = Math.max(worst, Math.abs(noise(x, y) - largeOfByte(base(x, y))));
    }
    assert.ok(worst < 1.2, `the large term the law of the small within ${worst.toFixed(2)} of a cell`);
    assert.ok(tamrielLargeMap(-2000, 100).every((c) => c.every((v) => v === 0)), 'none at sea');
    // nor on the sea by a coast, where the bytes about it are the land's (WOODS.WLD's own sea carries none, TAMRIEL-DEEP)
    let coast = null;
    for (let x = 1100; x < 4000 && !coast; x++) if (tamrielHeightByte(x, 100) === 0 && (tamrielHeightByte(x - 1, 100) > 0 || tamrielHeightByte(x + 1, 100) > 0)) coast = x;
    assert.ok(coast !== null, 'a coast on the row');
    assert.ok(tamrielLargeMap(coast, 100).every((c) => c.every((v) => v === 0)), `the sea by the coast at ${coast},100`);
  } finally { dropGroundCache(); }
});

test('RELIEF-PEAKS the large map blends in from the Bay\'s edge over the bytes\' own BLEND_PX - the clamp\'s answer in the seam band, the edge\'s own large map mixed toward the continent\'s past it - where it handed over at the seam (mutants: no blend; the blend\'s share)', () => {
  dropGroundCache();
  try {
    const woods = new StubWoods((x, y) => (y < 20 ? 90 : 20)), g = groundWoods(woods);
    for (let d = 0; d <= SEAM_PX; d++) assert.deepEqual(g.getLargeMapData(400, -d), woods.getLargeMapData(400, 0), `the seam band (${d})`);
    const edge = woods.getLargeMapData(400, 0);
    for (let d = SEAM_PX + 1; d < SEAM_PX + BLEND_PX; d++) {
      const own = tamrielLargeMap(400, -d), t = (d - SEAM_PX) / BLEND_PX, got = g.getLargeMapData(400, -d);
      for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) assert.equal(got[i][j], Math.round(edge[i][j] * (1 - t) + own[i][j] * t), `${d}: cell ${i},${j}`);
    }
    assert.deepEqual(g.getLargeMapData(400, -(SEAM_PX + BLEND_PX)), tamrielLargeMap(400, -(SEAM_PX + BLEND_PX)), 'the continent\'s whole past the blend');
  } finally { dropGroundCache(); }
});

// ── THE FRAMES ────────────────────────────────────────────────────

test('RELIEF-PEAKS the landforms\' frames: the direction is the land\'s structure about a node (its gradients\' doubled angles over STRUCTURE_REACH pixels), left at its length - and under ORIENT_FULL the oriented families ease into the fixed frame, so where the direction turns fast (a summit, a saddle, the slow field\'s own turn) no family hands one field to another inside a sample: over a cone\'s summit, no step between two samples a sample apart over 10 m past the macro\'s (the High Peaks\' ridges\' own steepest some 7 m, on flat ground 4), where the frames stood walls of 93 m here and up to 116 m on the freeware\'s ground (mutants: the strength unread; the direction made a unit at the node; the fixed frame\'s share dropped)', () => {
  assert.equal(ORIENT_FULL, 0.5); assert.equal(STRUCTURE_REACH, 2);
  // a cone of a land (bytes' ground, kernel units) round byte node (2000, 300), its zone the High Peaks' (ridges alone)
  const G = {
    mapH: MAP_HEIGHT, knee: LANDFORM_KNEE,
    height: (x, y) => 1400 + 900 * Math.max(0, 1 - Math.hypot(x - 2000, y - 300) / 9),
    zoneAt: () => ({ key: 'skyrimPeaks', climate: CLIMATES.Mountain }), climateAt: () => CLIMATES.Mountain,
  };
  const span = 128, ox = 1996 * span, oy = (MAP_HEIGHT - 304) * span, size = 8 * span;
  const L = landformLattice(G, ox, oy, size, span);
  const macro = (gx, gy) => { const x = gx / span - 1, y = MAP_HEIGHT - gy / span; return 1400 + 900 * Math.max(0, 1 - Math.hypot(x - 2000, y - 300) / 9); };
  let worst = 0, at = null;
  for (let sy = 0; sy < size; sy += 3) {
    let prev = null;
    for (let sx = 0; sx < size; sx++) {
      const gx = ox + sx, gy = oy + sy, h = macro(gx, gy) + tamrielLandformAt(L, gx, gy, macro(gx, gy));
      if (prev !== null) { const d = Math.abs(h - prev) - Math.abs(macro(gx, gy) - macro(gx - 1, gy)); if (d > worst) { worst = d; at = [sx, sy]; } }
      prev = h;
    }
  }
  assert.ok(worst * U < 10, `the landforms' steepest step a sample past the macro's: ${(worst * U).toFixed(2)} m at ${at}`);
  // and where the direction is weak the families stand in the fixed frame, never fade out with it: no pit at the summit -
  // the landforms over it (20 samples each way) within 40 m of the lowest of theirs a pixel off each way (with the fixed
  // frame's share dropped they fell 70 m under it, every family's centre left standing alone)
  const meanAbout = (cx, cy) => { let t = 0, n = 0; for (let sy = cy - 20; sy <= cy + 20; sy++) for (let sx = cx - 20; sx <= cx + 20; sx++) { const gx = ox + sx, gy = oy + sy; t += tamrielLandformAt(L, gx, gy, macro(gx, gy)); n++; } return (t / n) * U; };
  const summit = meanAbout(640, 512), off = Math.min(...[[768, 512], [512, 512], [640, 384], [640, 640]].map(([x, y]) => meanAbout(x, y)));
  assert.ok(summit > off - 40, `the summit's landforms ${summit.toFixed(0)} m, a pixel off ${off.toFixed(0)} m at the least`);
});

// ── THE RANGES ────────────────────────────────────────────────────

test('RELIEF-PEAKS the ranges\' parts: the ridged field 0..1 about RANGE_MEAN (measured); the swing none to the foot and whole from `full`; the centre the field\'s mean with room under the ceiling and its crest at it; the ceiling byte 180\'s ground, CONTINENT_CEILING under the world\'s; the rise\'s bound; the cone\'s profile 1 to its rim, falling, concave, 0 at its foot (mutants: the field\'s mean; the swing\'s law; the centre at the top; the profile)', () => {
  let s = 0, n = 0, lo = 1, hi = 0;
  for (let i = 0; i < 40000; i++) { const v = ridges(((i * 7919) % 400000) * 1.37 + 260000, Math.floor(i / 400) * 613.7 - 30000); s += v; n++; lo = Math.min(lo, v); hi = Math.max(hi, v); }
  assert.ok(Math.abs(s / n - RANGE_MEAN) < 0.01, `the field's mean ${(s / n).toFixed(4)} against RANGE_MEAN ${RANGE_MEAN}`);
  assert.ok(lo >= 0 && hi <= 1 && hi > 0.95 && lo < 0.1, `0..1 (${lo.toFixed(3)}..${hi.toFixed(3)})`);
  const units = (m) => m / U + SCALED_OCEAN_ELEVATION;
  assert.equal(rangeSwing(units(RANGE_DIALS.foot)), 0);
  assert.equal(rangeSwing(units(RANGE_DIALS.foot - 300)), 0);
  assert.ok(Math.abs(rangeSwing(units(RANGE_DIALS.full)) * U - RANGE_DIALS.high) < 1e-6);
  assert.ok(RANGE_DIALS.high >= 1200, 'the swing a kilometre and more where the land stands whole (the Bay\'s Dragontails span 1.4 km)');
  assert.ok(rangeSwing(units(1600)) > 0 && rangeSwing(units(1600)) < rangeSwing(units(2000)));
  assert.equal(rangeCentre(units(1500)), RANGE_MEAN, 'the mean with room above it');
  assert.ok(Math.abs(rangeCentre(rangeCeiling()) - 1) < 1e-12, 'the crest at the ceiling');
  assert.ok(Math.abs(rangeCeiling() - nodeGround(RANGE_DIALS.ceilingByte, 1, 1)) < 1e-9);
  assert.equal(RANGE_DIALS.ceilingByte, CONTINENT_LIFT.top / BASE_HEIGHT_SCALE);
  assert.ok(CONTINENT_CEILING <= LANDFORM_CEILING, 'the continent under the world\'s ceiling');
  assert.ok(rangeCeiling() <= MAX_TERRAIN_HEIGHT + reliefLift(127 * 8) + continentLift(CONTINENT_LIFT.top) + 1e-9, 'the ranges\' ceiling the land\'s');
  for (let h = SCALED_OCEAN_ELEVATION; h < rangeCeiling(); h += 37) assert.ok(rangeSwing(h) * (1 - rangeCentre(h)) <= rangeUp() + 1e-9, `the rise's bound at ${h}`);
  // PIN MOVED (RED-MOUNTAIN, the merge): the cone's profile went with the cone - Red Mountain is test/world/redmountain.test.js's
});

test('RELIEF-PEAKS the ranges on the land (a relief standing): none with no relief, none on the low ground; centred where the land has room, the crests the land\'s own at the ceiling and never over it; never under the land and the foot, whichever is lower; none by a carved river or a lake; pure in world position; Red Mountain\'s cone at its relief\'s summit, the land inside its rim the cone, the ranges quiet about it; the bound (mutants: the floor; the clip; the waters\' valleys; the cone\'s summit; its foot)', async () => {
  assert.equal(tamrielRangeAt(3000 * 128, 600 * 128, 1800), 0, 'no relief: the authored law\'s land is its own shape');
  await withRelief(() => {
    const units = (m) => m / U + SCALED_OCEAN_ELEVATION, foot = units(RANGE_DIALS.foot), ceiling = rangeCeiling();
    assert.equal(tamrielRangeAt(2000 * 128, 200 * 128, units(600)), 0, 'the low ground stands as it stood');
    let sum = 0, n = 0;
    for (let i = 0; i < 3000; i++) {
      const gx = (2100 + (i % 60) * 0.73) * 128, gy = (MAP_HEIGHT - 200 - Math.floor(i / 60) * 0.61) * 128;
      for (const m of [1200, 1800, 2400, 3000, 3250]) {
        const h = units(m), d = tamrielRangeAt(gx, gy, h);
        assert.ok(h + d >= Math.min(h, foot) - 1e-9, `never under the land and the foot (${m})`);
        assert.ok(h + d <= Math.max(h, ceiling) + 1e-9, `never over the ceiling (${m})`);
        if (m >= 3250) assert.ok(d <= 1e-9, 'the crests the land\'s own at the top');
      }
      sum += tamrielRangeAt(gx, gy, units(2000)); n++;
    }
    assert.ok(Math.abs(sum / n) * U < 0.07 * RANGE_DIALS.high, `centred where the land has room (${(sum / n * U).toFixed(0)} m)`);
    // the soft clip: a rise past `knee` under the ceiling held by q / (1 + q) of the room left (a crest's own law)
    let clipped = 0;
    for (let i = 0; i < 2000; i++) {
      const gx = (2100 + i * 0.37) * 128, gy = (MAP_HEIGHT - 200) * 128 + (i % 7) * 911, h = units(3000), raw = h + rangeSwing(h) * (ridges(gx, gy) - rangeCentre(h));
      const from = Math.max(h, ceiling - RANGE_DIALS.knee / U), q = (raw - from) / (ceiling - from), want = raw > from ? from + (ceiling - from) * (q / (1 + q)) : raw;
      assert.ok(Math.abs(h + tamrielRangeAt(gx, gy, h) - want) < 1e-9, `the clip at ${gx}`);
      if (raw > from) clipped++;
    }
    assert.ok(clipped > 10, `crests held under the ceiling (${clipped})`);
    // pure in world position: the same sample, whatever pixel asks
    assert.equal(tamrielRangeAt(2101 * 128, 300 * 128, units(2100)), tamrielRangeAt(2101 * 128, 300 * 128, units(2100)));
    // the waters' valleys: none on a carved river's course (the Corbolo's first point, Lake Arrius)
    const [rx, ry] = [196.62 * FIT.ppu - FIT.ox, 86.2 * FIT.ppu - FIT.oy];
    assert.equal(waterDistance(rx, ry), 0);
    assert.equal(tamrielRangeAt(rx * 128, (MAP_HEIGHT + 1 - ry) * 128, units(2000)), 0, 'the river runs down a valley of the mountains, never a gorge');
    assert.notEqual(tamrielRangeAt((rx + 10) * 128, (MAP_HEIGHT + 1 - ry - 10) * 128, units(2000)), 0, 'the ranges whole past its reach');
    // PIN MOVED (RED-MOUNTAIN, the merge): no cone of the ranges' own - Red Mountain is RED-MOUNTAIN's
    // (test/world/redmountain.test.js); the bound is the ridges' rise alone, at its summit too
    const land = nodeGround(100, 1, 1), s = redMountainFrame();
    assert.equal(rangeBound(Math.floor(s.bx), Math.floor(s.by), land), Math.min(ceiling, land + rangeUp()));
    assert.equal(rangeBound(2100, 300, land), Math.min(ceiling, land + rangeUp()));
  });
});

// ── THE FAR VIEWS ─────────────────────────────────────────────────

test('RELIEF-PEAKS the far views stand on the kernel\'s own ground: the far ring at a pixel\'s centre (centreGround - the small term\'s cubic there, the large map by its law, the lift faded by its nodes\' fades) and the far field at a byte\'s node (nodeGroundAt), each the kernel\'s mean ground there to the cells\' rounding - with the ranges where a relief stands; ringHeight a byte\'s node with the large map (mutants: the large map left out; the byte at the centre; the ranges unread)', async () => {
  dropGroundCache();
  try {
    // a rolling land of bytes 30 to 80 (a land's grain, as the heightmap's - white noise of a byte a pixel is no land's:
    // there DFU's cubic of the cells is no law of the bytes' at all)
    const woods = new StubWoods((x, y) => 30 + Math.round(25 * (1 + Math.sin(x / 6) * Math.cos(y / 7)))), g = groundWoods(woods), byteAt = (x, y) => g.getHeightMapValue(x, y);
    let worstC = 0, worstN = 0;
    for (const [x, y] of [[300, 200], [301, 200], [640, 420], [2200, -300], [2600, 500]]) {
      worstC = Math.max(worstC, Math.abs(centreGround(byteAt, x, y) - meanGroundField(g, x, y, true)(64, 64)));
      worstN = Math.max(worstN, Math.abs(nodeGroundAt(byteAt, x, y) - meanGroundField(g, x, y, true)(128, 0)));
    }
    assert.ok(worstC * U < 4, `the ring's centre on the kernel's mean ground (${(worstC * U).toFixed(2)} m)`);
    assert.ok(worstN * U < 4, `a node on it (${(worstN * U).toFixed(2)} m)`);
    assert.ok(Math.abs(ringGroundAt(300, 200, byteAt, true) - centreGround(byteAt, 300, 200, true) * U) < 1e-9);
    assert.ok(Math.abs(ringHeight(60, true) - nodeGround(60, 1, 0, true) * U) < 1e-9, 'a byte\'s node: the large map with it');
    assert.ok(ringHeight(60) > 60 * BASE_HEIGHT_SCALE * U + 200, 'the large map, some 350 m at byte 60');
    // the far field's vertex: the node its centre is - the byte north-west of it - and the ground there
    const c = farFieldCell(g, 270, 40, 8, 3, null, true);
    assert.equal(c[0], g.getHeightMapValue(270 * 8 + 3, 40 * 8 + 3));
    assert.ok(Math.abs(c[3] - nodeGroundAt(byteAt, 270 * 8 + 3, 40 * 8 + 3, true) * U) < 1e-9);
    const f = buildFarFieldBytes({ woods: g, baseCX: 270, baseCY: 40, radius: 2, relief: true });
    assert.ok(f.ground instanceof Float32Array && f.ground.length === 25 && Math.abs(f.ground[12] - c[3]) < 1e-3);
    // beside the sea the lift faded by its nodes' own cliffFadeAt when no fades are handed (the travel view's call)
    const cliff = new StubWoods((x) => (x < 300 ? 0 : 100)), cg = groundWoods(cliff), cb = (x, y) => cg.getHeightMapValue(x, y);
    assert.equal(centreGround(cb, 301, 200), centreGround(cb, 301, 200, true, (x, y) => cliffFadeAt(cb, x, y)));
    assert.ok(centreGround(cb, 301, 200) < centreGround(cb, 301, 200, true, () => 1) - 50, 'faded beside the sea');
  } finally { dropGroundCache(); }
  await withRelief(() => {
    const woods = new StubWoods(() => 60), g = groundWoods(woods), byteAt = (x, y) => g.getHeightMapValue(x, y), s = redMountainFrame();
    const x = Math.floor(s.bx), y = Math.floor(s.by);
    // PIN MOVED (RED-MOUNTAIN, the merge): at Red Mountain's summit the far ring adds its smooth cone (ringGroundAt), as the mean ground does
    assert.ok(Math.abs(centreGround(byteAt, x, y) + redMountainLiftAt(x, y) - meanGroundField(g, x, y, true)(64, 64)) * U < 4, 'with the ranges and the cone');
    assert.ok(Math.abs(nodeGroundAt(byteAt, x, y) + redMountainNodeLift(x + 1, y + 1) - meanGroundField(g, x, y, true)(128, 0)) * U < 4, 'and the far field\'s node, the cone at its point');
    assert.ok(groundTopOf(g, x, y, true) >= (meanGroundField(g, x, y, true)(64, 64)), 'the bound over the cone');
  });
});

test('RELIEF-PEAKS the far views\' wiring (by source): the far ring\'s grid on ringGroundAt with its nodes\' fades once a node; the far field\'s vertex the worker\'s ground (asked with the Landforms row, kept by it, transferred, assembled, read); the travel view\'s ground past the grid the ring\'s; the shaper lays the ranges under the landforms; the mean ground and the bound count them (mutants: the far field on its highest byte; the ground not transferred)', () => {
  const ring = read('src/render/farRing.js'), worker = read('src/world/terrain/terrainGenWorker.js'), client = read('src/world/terrain/terrainGenClient.js'), lf = read('src/world/landforms.js');
  assert.match(ring, /heights\[j \* hside \+ i\] = ringGroundAt\(baseX - radius - 1 \+ i, baseY - radius - 1 \+ j, gridByte, relief, fadeAt\);/);
  assert.match(ring, /heightOf: \(byte, x, y, v\) => answer\.ground\[v\] \+ \(inputs\.relief \? redMountainNodeLift\(x, y\) \* STREAMING_TERRAIN_SCALE : 0\),/);   // PIN MOVED (RED-MOUNTAIN, the merge): and the cone at the node
  assert.match(ring, /farField\?\.\(\{ baseCX, baseCY, radius: FAR_RADIUS, cell: FAR_CELL, seaByte, relief: !!inputs\.relief \}\)/);
  assert.match(worker, /farFieldCell\(woods, cx, cy, m\.cell, m\.seaByte, farCellClimate, !!m\.relief\)/);
  assert.match(worker, /\[high\.buffer, low\.buffer, clim\.buffer, ground\.buffer\]/);
  assert.match(client, /ground\.set\(m\.ground, j0 \* side\);/);
  assert.match(read('src/scenes/world.js'), /return \[x, ringGroundAt\(px\.x, px\.y, ground \? \(bx, by\) => woods\.getHeightMapValue\(bx, by\) : \(\) => 0, !!landform\)/);
  assert.match(lf, /const land = macro \+ lift \* fade, r = ranges \? ranges\(gx, gy, land\) : 0;/);
  assert.match(lf, /const c = r \+ tamrielLandformAt\(tl, gx, gy, land \+ r, deepCont\);/);
  assert.match(lf, /return \(share > 0 \? land \+ share \* tamrielRangeAt\(ox \+ x, oy \+ y, land\) : land\) \+ \(beyond \? redMountainSmooth\(ox \+ x, oy \+ y\) : 0\);/);   // PIN MOVED (RED-MOUNTAIN, the merge): and its smooth cone
  assert.match(lf, /if \(continentPixel\(px, py\)\) return rangeBound\(px, py, h \+ reliefLift\(lowTop\) \+ continentLift\(lowTop\)\) \+ Math\.max\(hill, TAMRIEL_TOP\) \+ redMountainTopNear\(px, py\);/);   // PIN MOVED (RED-MOUNTAIN, the merge): and the volcano's bound
  assert.match(lf, /height: \(x, y\) => nodeGround\(woods\.getHeightMapValue\(x, y\), 1, byteBeyond\(x, y\)\),/);
});

// ── THE RECORDS PAST THE BAY ──────────────────────────────────────

test('RELIEF-PEAKS the records\' frame (GROUND_FRAME_LAW 3): a record past the Bay written before it stood DFU\'s ground of its day, so it rides that ground\'s own move - with the row on or off, its height over the ground kept; a stamped record and the Bay\'s take none; D5\'s old lift still LIFT_FRAME_LAW\'s (mutants: the move dropped; dropped with the row off; taken by a stamped record; taken on the Bay; the old lift by the new law)', () => {
  assert.deepEqual([GROUND_FRAME_LAW, RELIEF_FRAME_LAW, LIFT_FRAME_LAW], [6, 3, 2]);   // PIN MOVED (RMB-CONTRACTS RMBC3): the stamp 6, a settlement's carve; PIN MOVED (FB1029 ACROSS-EDGE): the stamp 5 (test/world/fb1029_ground.test.js); PIN MOVED (FB1028 TOWN-GROUND): the stamp 4, RELIEF-PEAKS' own law RELIEF_FRAME_LAW (test/world/terrain/fb1028_townground_frame.test.js)
  assert.equal(RECORD_GROUND_STAMP.groundFrame, 6);   // PIN MOVED (RMB-CONTRACTS RMBC3): records now stamp 6
  const now = (x) => 100 + x, before = (x) => 40 + x, moved = (x) => 25 + x / 4;   // the lift now and on the old law's ground; DFU's ground's move
  const liftAt = (x, z, o = {}) => (o.before ? before(x) : now(x));
  const ground = 500;   // DFU's ground today at the spot: ground - moved(x) when the record was written
  const state = { compensation: [0, 7, 0], localFromWorld: (nx, nz) => [nx - 100, nz - 200] };
  const heightAt = (x) => ground + now(x) + 7;
  const frame = (landform, bay) => recordFrame({ landform, liftAt, heightAt: landform ? heightAt : () => ground + 7, state, bayAt: () => bay, movedAt: (x) => moved(x) });
  const off = 3.5, x = 12, then = ground - moved(x);
  // the row on: a record of LIFT_FRAME_LAW (DFU's frame of its day) and one before it (the shaped ground of its day)
  assert.equal(frame(true, false).restandHeight(then + off, x, 0, STREAMING_TERRAIN_SCALE, 2), ground + now(x) + off, 'law 2: the move, then the lift');
  assert.equal(frame(true, false).restandHeight(then + before(x) + off, x, 0, STREAMING_TERRAIN_SCALE, null), ground + now(x) + off, 'before the stamp: its day\'s lift off, the move, today\'s lift');
  assert.equal(frame(true, false).restandHeight(ground + off, x, 0, STREAMING_TERRAIN_SCALE, 3), ground + now(x) + off, 'law 3: none');
  // the row off: the large map is the kernel's own term, so the move stands without it
  assert.equal(frame(false, false).restandHeight(then + off, x, 0, STREAMING_TERRAIN_SCALE, 2), ground + off);
  assert.equal(frame(false, false).restandHeight(ground + off, x, 0, STREAMING_TERRAIN_SCALE, 3), ground + off);
  // on the Bay nothing moved
  assert.equal(frame(true, true).restandHeight(ground + off, x, 0, STREAMING_TERRAIN_SCALE, 2), ground + now(x) + off);
  assert.equal(frame(false, true).restandHeight(ground + off, x, 0, STREAMING_TERRAIN_SCALE, null), ground + off);
  // none handed (a host with no continent): as before it
  assert.equal(recordFrame({ landform: false, liftAt, heightAt, state, bayAt: () => false }).restandHeight(ground + off, x, 0, STREAMING_TERRAIN_SCALE, 2), ground + off);
  assert.equal(frame(true, false).restandHeight(NaN, x, 0, STREAMING_TERRAIN_SCALE, 2), NaN);
});

test('RELIEF-PEAKS DFU\'s own ground\'s move under a record: the reader of before answers the large map a record was written on past the Bay\'s seam (BREATHTAKER3\'s swell), the Bay\'s and the seam band\'s their own; the move is the kernel\'s ground over today\'s reader less over that one, and over a location\'s rect its blend\'s own - the town\'s level moved by its pixel\'s mean move (mutants: the move on today\'s large map; the town read a sample at a time)', () => {
  dropGroundCache();
  try {
    const woods = new StubWoods((x, y) => 30 + Math.round(25 * (1 + Math.sin(x / 6) * Math.cos(y / 7)))), g = groundWoods(woods), b = groundBefore(g);
    assert.deepEqual(b.getLargeMapData(2200, -300), largeMapBefore(2200, -300), 'past the seam: the swell of before');
    assert.deepEqual(b.getLargeMapData(400, -SEAM_PX), g.getLargeMapData(400, -SEAM_PX), 'the seam band its own');
    assert.deepEqual(b.getLargeMapData(400, 200), g.getLargeMapData(400, 200), 'the Bay its own');
    const swell = largeMapBefore(2200, -300).flatMap((c) => [...c]);
    assert.ok(swell.every((v) => v >= 2 && v <= 7), `the swell about ${LARGE_SWELL_BEFORE.mean} (${swell})`);
    const px = 2200, py = -300, f = groundMovedField(g, px, py), H = 129;
    const nowK = sampleKernel(g, px, py, H, true, null), wasK = sampleKernel(b, px, py, H, true, null);
    for (const [sx, sy] of [[0, 0], [64, 64], [128, 17], [40, 100]]) assert.ok(Math.abs(f(sx, sy) - (Math.fround(nowK(sx, sy)) - Math.fround(wasK(sx, sy))) * MAX_TERRAIN_HEIGHT) < 1e-6, `(${sx}, ${sy})`);
    assert.ok(f(64, 64) * U > 100, `the land a third higher at its byte (${(f(64, 64) * U).toFixed(0)} m)`);
    assert.equal(groundMovedField(g, 400, 200)(64, 64), 0, 'the Bay: nothing moved');
    // a location's rect: DFU flattens it to its pixel's mean, so it moves by the mean's move
    const rect = { xMin: 40, xMax: 88, yMin: 40, yMax: 88 };
    let mean = 0;
    for (let x = 0; x < H; x++) for (let y = 0; y < H; y++) mean += f(x, y);
    mean /= H * H;
    const town = groundMovedField(g, px, py, rect);
    assert.ok(Math.abs(town(64, 64) - mean) < 1e-3 && Math.abs(town(50, 80) - mean) < 1e-3, `the town's level by the mean move (${town(64, 64).toFixed(2)} against ${mean.toFixed(2)})`);
    assert.ok(Math.abs(town(0, 0) - f(0, 0)) < 1e-3, 'its pixel\'s corner as the ground');
  } finally { dropGroundCache(); }
});

test('RELIEF-PEAKS the records\' wiring (by source): the host hands its frame the ground\'s move over the build\'s rect, kept a pixel at a time; the old law\'s landforms leave the ranges out; a site\'s level past the Bay counts them (mutants: the move unhanded; the old law with the ranges; the option unread; the level without them)', async () => {
  // the landforms with no ranges, where a relief stands them: the ground of before, on the high ground they shape
  await withRelief(() => {
    const g = groundWoods(new StubWoods(() => 60)), px = 3286, py = -470;
    const k = (o) => sampleKernel(g, px, py, 129, true, createLandforms({ woods: g, ...o }))(64, 64) * MAX_TERRAIN_HEIGHT;
    assert.notEqual(k({}), k({ ranges: false }), 'the ranges laid, or not');
    assert.equal(k({ ranges: false }), sampleKernel(g, px, py, 129, true, createLandforms({ woods: g, ranges: false }))(64, 64) * MAX_TERRAIN_HEIGHT);
  });
  const host = read('src/scenes/groundFrameHost.js'), w = read('src/scenes/world.js'), lf = read('src/world/landforms.js');
  assert.match(host, /movedAt: groundMovedAt, townMovedAt, meetMovedAt, padsMovedAt \}\);/);   // PIN MOVED (RMB-CONTRACTS RMBC3): and a settlement's carve   // PIN MOVED (FB1028 TOWN-GROUND): the town's blend's move handed beside it; PIN MOVED (FB1029 ACROSS-EDGE): and the meets'
  assert.match(host, /moved = groundMovedField\(woods, px, py, rect\);/);
  assert.match(host, /const t = host\.state\.pixelTranslation\(px, py\), rect = liftRectAt\(px, py\);\n\s*const key = `\$\{px\},\$\{py\},\$\{rect \?/);
  assert.match(w, /climates: _landformClimates, ranges: !before \}\) : null\);/);
  assert.match(lf, /const ranges = tl && ground\.hills && ground\.ranges !== false \? rangeShaper\(sx, sy\) : null;/);
  assert.match(lf, /const land = macro \+ lift \* fade, r = ranges \? ranges\(ox \+ x, oy \+ y, land\) : 0, c = r \+ tamrielLandformAt\(tl, ox \+ x, oy \+ y, land \+ r\);/);
});

// ── WITH ARENA2: THE FREEWARE'S GROUND ────────────────────────────

const A = process.env.ARENA2_PATH;
const HAVE = !!A && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'ART_PAL.COL', 'WOODS.WLD', 'MAPS.BSA', 'CLIMATE.PAK', 'POLITIC.PAK'].every((f) => existsSync(join(A, f)));
const skip = HAVE ? false : 'no ARENA2 (sh tools/fetch-data.sh)';
let _world = null;
async function world() {
  if (_world) return _world;
  const bytes = (n) => new Uint8Array(readFileSync(join(A, n)));
  const { DFPalette } = await import('../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../src/ui/tamrielTrace.js');
  const { MapsFile } = await import('../../src/formats/mapsFile.js');
  const { WoodsFile } = await import('../../src/formats/woodsFile.js');
  const { groundMaps } = await import('../../src/world/tamriel/tamrielGround.js');
  const { createLandforms, landformClimates } = await import('../../src/world/landforms.js');
  const { sampleKernel } = await import('../../src/world/terrain/terrainSampler.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  const trace = await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal });
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  const bay = new WoodsFile(); bay.load(bytes('WOODS.WLD'));
  setTamrielFit(FIT); setTamrielTrace(trace); dropGroundCache(); groundMaps(maps);
  const woods = groundWoods(bay), lf = createLandforms({ woods, climates: landformClimates((x, y) => maps.getClimateIndex(x, y)) });
  const kernels = new Map();
  const H = (px, py, x = 64, y = 64) => {
    const k = `${px},${py}`;
    let f = kernels.get(k);
    if (!f) { if (kernels.size > 3000) kernels.clear(); kernels.set(k, f = sampleKernel(woods, px, py, 129, true, lf)); }
    return (f(x, y) * MAX_TERRAIN_HEIGHT - SCALED_OCEAN_ELEVATION) * U;   // metres over the sea
  };
  _world = { bay, woods, H, byteAt: (x, y) => woods.getHeightMapValue(x, y) };
  return _world;
}
const done = () => { setTamrielTrace(null); setTamrielFit(null); dropGroundCache(); _world = null; };

test('RELIEF-PEAKS with ARENA2: WOODS.WLD\'s large map is the law of its small byte - every land byte\'s median inner 3 x 3 within 3.5 of the law to the Bay\'s top, and the quartiles within two of the median (mutants: the gain; the knee)', { skip }, async () => {
  const { bay } = await world();
  const by = Array.from({ length: 110 }, () => []);
  for (let y = 0; y < 500; y += 2) for (let x = 0; x < 1000; x += 2) {
    const b = bay.getHeightMapValue(x, y);
    if (b < 6 || b > 109) continue;
    const d = bay.getLargeMapData(x, y);
    let s = 0; for (let i = 1; i <= 3; i++) for (let j = 1; j <= 3; j++) s += d[i][j];
    by[b].push(s / 9);
  }
  let n = 0;
  for (let b = 6; b <= 109; b++) {
    if (by[b].length < 40) continue;
    const v = by[b].sort((p, q) => p - q), med = v[v.length >> 1];
    assert.ok(Math.abs(med - largeOfByte(b)) < 3.5, `byte ${b}: WOODS.WLD's ${med.toFixed(1)}, the law's ${largeOfByte(b).toFixed(1)}`);
    assert.ok(v[Math.floor(v.length * 0.75)] - v[Math.floor(v.length * 0.25)] <= 4, `byte ${b}: its quartiles`);
    n++;
  }
  assert.ok(n > 40, `bytes measured: ${n}`);
});

test('RELIEF-PEAKS with ARENA2: the ranges past the Bay stand as mountains - over 10 km about each summit the High Peaks, the Jerall, the Reach\'s shoulder and the Velothi span 0.8 km and more (the heightmap alone: 274 to 442 m), the Bay\'s Dragontails 1.4; the steep faces about Bruma the frames\' walls no longer (over 50 degrees under 0.2%, where 2%); Red Mountain the volcano at its summit, over everything about it; the Bay\'s north edge no wall (mutants: the ranges unlaid; the swing; the frames\' strength; the cone; the edge\'s blend)', { skip, timeout: 1200000 }, async () => {
  try {
    const { H } = await world();
    const span = (cx, cy, r = 6, st = 16) => {
      let lo = Infinity, hi = -Infinity;
      for (let py = cy - r; py <= cy + r; py++) for (let px = cx - r; px <= cx + r; px++) for (let y = 0; y < 128; y += st) for (let x = 0; x < 128; x += st) { const h = H(px, py, x, y); lo = Math.min(lo, h); hi = Math.max(hi, h); }
      return { lo, hi, span: hi - lo };
    };
    for (const [name, x, y] of [['the Throat', 2076, 106], ['the Jerall', 2202, 332], ['the Reach\'s shoulder', 1490, 198], ['the Velothi', 2743, 485]]) {
      const s = span(x, y);
      assert.ok(s.span > 800, `${name} spans ${s.span.toFixed(0)} m`);
      assert.ok(s.hi < (CONTINENT_CEILING - SCALED_OCEAN_ELEVATION) * U, `${name} under the ceiling (${s.hi.toFixed(0)} m)`);
    }
    assert.ok(span(940, 440).span > 1000, 'the Bay\'s Dragontails, the measure they are held to');
    // the frames' walls about Bruma
    let steep = 0, n = 0;
    for (let py = 320; py <= 330; py += 2) for (let px = 2040; px <= 2052; px += 2) for (let y = 0; y < 127; y += 4) for (let x = 0; x < 127; x += 4) {
      const h = H(px, py, x, y), g = Math.hypot(H(px, py, x + 1, y) - h, H(px, py, x, y + 1) - h) / 6.4;
      n++; if (g > Math.tan(50 * Math.PI / 180)) steep++;
    }
    assert.ok(steep / n < 0.002, `about Bruma ${(100 * steep / n).toFixed(2)}% over 50 degrees`);
    // PIN MOVED (RED-MOUNTAIN, the merge): Red Mountain's height is test/world/redmountain.test.js's (with ARENA2: its rim over 6.5 km)
    // the Bay's north edge, the Wrothgarians: no step over 120 m between samples 102 m apart (it fell some 600 m in half a pixel)
    let worst = 0, prev = null;
    for (let py = 5; py >= -8; py--) for (let y = 0; y < 128; y += 16) { const h = H(951, py, 64, y); if (prev !== null) worst = Math.max(worst, Math.abs(h - prev)); prev = h; }
    assert.ok(worst < 120, `the edge's steepest step ${worst.toFixed(0)} m`);
  } finally { done(); }
});

test('RELIEF-PEAKS with ARENA2: the far ring\'s vertex on the kernel\'s mean ground - past the Bay within 2 m, on the Bay within 35 m (the law of WOODS.WLD\'s own large map), where it stood 410 to 500 m off in the ranges (mutants: the large map left out of the far views; the byte at the centre)', { skip, timeout: 600000 }, async () => {
  try {
    const { woods, byteAt } = await world();
    for (const [name, cx, cy, most] of [['the Jerall', 2202, 332, 2], ['Skyrim', 2076, 106, 2], ['Red Mountain', 3051, -51, 2], ['the Bay\'s Dragontails', 940, 440, 35]]) {
      let sum = 0, n = 0;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const x = cx + dx, y = cy + dy;
        sum += Math.abs(ringGroundAt(x, y, byteAt, true) - meanGroundField(woods, x, y, true)(64, 64) * U); n++;
      }
      assert.ok(sum / n < most, `${name}: ${(sum / n).toFixed(1)} m`);
    }
  } finally { done(); }
});
