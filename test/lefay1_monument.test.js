// LEFAY1 (2026-10-08): THE MONUMENT TO JULIAN LEFAY in the middle of Gothway Garden, and the flowers laid at it -
// world/lefayMonument.js (where, what, the flowers' law), world/lefayArt.js (its stone and its plaque),
// scenes/lefayMonumentHost.js (the pool) and the wiring in the four hosts and the save.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LEFAY_TOWN, LEFAY_REGION, isLefayTown, LEFAY_TEXT, LEFAY_ROWS, LEFAY_KEY, MONUMENT_CLEAR_M, MONUMENT_CARVE_M,
  MONUMENT_ROAD_COST, discCells, lefaySpot, lefaySpotOf, carveLefay, LEFAY_ARCHIVE, LEFAY_GRANITE, LEFAY_MARBLE,
  LEFAY_GILT, LEFAY_PLAQUE, LEFAY_BRONZE, MONUMENT_STEPS, MONUMENT_FOOT, PEDESTAL, OBELISK, PLAQUE, MONUMENT_BOXES,
  buildLefayModel, LEFAY_FLOWERS, FLOWER_RINGS, MONUMENT_FLOWERS_KEPT, TOSS_MS, TOSS_ARC, TOSS_EVERY_MS, TOSS_SPREAD,
  tossRest, flowerPlace, tossPoint, normalTribute, layFlower,
} from '../src/world/lefayMonument.js';
import { lefayArt, lefayPlaqueArt, LEFAY_GLYPHS, lefayGlyph, lineWidth, PLAQUE_SCALES, LEFAY_PLAQUE_W, LEFAY_PLAQUE_H, GLYPH_H } from '../src/world/lefayArt.js';
import { createLefayMonument, bodyTrapped, LEFAY_REACH, TOSS_HAND_DROP } from '../src/scenes/lefayMonumentHost.js';
import { CAPSULE_RADIUS, CAPSULE_HEIGHT } from '../src/player/motor.js';
import { CityNavigation, NAV_CELL, HALF_CELL } from '../src/world/cityNavigation.js';
import { THROWN_FLOWERS } from '../src/systems/arenaCrowd.js';
import { REGION_NAMES } from '../src/formats/mapsTables.js';
import { STATIC_NPC_ACTIVATION_DISTANCE, RAY_DISTANCE } from '../src/player/activate.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(root, f), 'utf8');

/** A navgrid of `w` x `h` cells, every cell `weight` (stored as CityNavigation stores it). */
function navOf(w, h, weight = 12) {
  const nav = { width: w, height: h, grid: new Uint8Array(w * h).fill(weight << 4) };
  nav.inBounds = (gx, gy) => gx >= 0 && gy >= 0 && gx < w && gy < h;
  nav.weightAt = (gx, gy) => (nav.inBounds(gx, gy) ? nav.grid[gy * w + gx] >> 4 : 0);
  nav.set = (gx, gy, wt) => { nav.grid[gy * w + gx] = wt << 4; };
  return nav;
}

test('LEFAY1: THE TOWN - Gothway Garden in the Daggerfall region, by its names (a pack\'s read keeps both)', () => {
  assert.equal(LEFAY_REGION, 17);
  assert.equal(REGION_NAMES[LEFAY_REGION], 'Daggerfall');
  assert.equal(LEFAY_TOWN, 'Gothway Garden');
  assert.equal(isLefayTown({ regionIndex: 17, name: 'Gothway Garden' }), true);
  assert.equal(isLefayTown({ regionIndex: 18, name: 'Gothway Garden' }), false, 'another region\'s town of the name');
  assert.equal(isLefayTown({ regionIndex: 17, name: 'Daggerfall' }), false);
  assert.equal(isLefayTown(null), false);
});

test('LEFAY1: THE SPOT - the open ground nearest the grid\'s middle, all of MONUMENT_CLEAR_M round it open, a road counted against it', () => {
  assert.equal(MONUMENT_CLEAR_M, 5.8);   // PIN MOVED (AUDIT LEFAY1 C3): 4.0 -> 5.8, a ring round the carve
  const disc = discCells(MONUMENT_CLEAR_M);
  assert.equal(disc.length, 45, 'the cells within 5.8 m of a cell\'s centre (3.625 cells)');
  // AUDIT LEFAY1 C3: every cell beside a carved one is in it - the people's way round the monument, wherever it stands
  const clear = new Set(disc.map((c) => `${c}`));
  for (const [x, y] of discCells(MONUMENT_CARVE_M)) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) assert.ok(clear.has(`${[x + a, y + b]}`), `${x + a},${y + b} beside the carve is open`);
  assert.deepEqual(disc[0], [0, 0], 'nearest first');
  // all open: the middle (an even grid's middle is a cell corner - the lower row and column win the tie)
  const open = navOf(128, 128);
  const s = lefaySpot(open);
  assert.deepEqual([s.gx, s.gy], [63, 63]);
  assert.deepEqual([s.x, s.z], [63 * NAV_CELL + HALF_CELL, 63 * NAV_CELL + HALF_CELL], 'the cell\'s centre, the location frame (navToWorld\'s)');
  // a building over the middle: the nearest cell with its whole disc clear of it
  const built = navOf(128, 128);
  for (let y = 60; y <= 67; y++) for (let x = 60; x <= 67; x++) built.set(x, y, 0);
  const b = lefaySpot(built);
  for (const [dx, dy] of disc) assert.ok(built.weightAt(b.gx + dx, b.gy + dy) > 0, 'its whole disc is open');
  assert.deepEqual([b.gx, b.gy], [63, 56], 'its disc\'s edge on the building\'s, its lower rows first');
  // a road down the middle: a green beside it wins while it is nearer than the road's cost
  const road = navOf(128, 128);
  for (let y = 0; y < 128; y++) for (let x = 62; x <= 65; x++) road.set(x, y, 15);
  const r = lefaySpot(road);
  assert.deepEqual([r.gx, r.gy], [58, 63], 'beside the road: the cell nearer with five road cells under its edge (1.5) costs more than this one, which touches none');
  for (const [dx, dy] of disc) assert.ok(r.gx + dx < 62 || road.weightAt(r.gx + dx, r.gy + dy) === 15);
  assert.ok(MONUMENT_ROAD_COST > 0);
  // a town all road: it stands on the road at the middle
  assert.deepEqual([lefaySpot(navOf(128, 128, 15)).gx, lefaySpot(navOf(128, 128, 15)).gy], [63, 63]);
  // water (weight 0) everywhere but a corner too small: none
  const sea = navOf(64, 64, 0);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) sea.set(x, y, 12);
  assert.equal(lefaySpot(sea), null);
  assert.equal(lefaySpot(null), null);
});

test('LEFAY1: THE SPOT OF A LAID-OUT TOWN - its blocks carved as the people\'s navgrid is (the automap, the row flip, the ground)', () => {
  // two blocks side by side; the first's automap closes its east half, the second's ground is water in its west quarter
  const auto = (closed) => { const a = new Uint8Array(64 * 64); for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (closed(x, y)) a[y * 64 + x] = 1; return a; };
  const tiles = (rec) => Array.from({ length: 16 }, (_, tx) => Array.from({ length: 16 }, (_, ty) => ({ textureRecord: rec(tx, ty) })));
  const block = (x, autoMapData, groundTiles) => ({ x, y: 0, dfBlock: { rmbBlock: { fldHeader: { autoMapData, groundData: { groundTiles } } } } });
  const loc = {
    width: 2, height: 1,
    blocks: [
      block(0, auto((x) => x >= 32), tiles(() => 2)),   // grass (12), its east half built over
      block(1, auto(() => false), tiles((tx) => (tx < 4 ? 0 : 2))),   // its west quarter water (0)
    ],
  };
  const s = lefaySpotOf(loc);
  // the same answer as the people's own navgrid carved by hand
  const nav = new CityNavigation(2, 1);
  for (const b of loc.blocks) nav.setBlockData(b.x, b.y, b.dfBlock.rmbBlock.fldHeader.autoMapData, (tx, ty) => b.dfBlock.rmbBlock.fldHeader.groundData.groundTiles[tx][ty].textureRecord, { enhancedWater: true });
  assert.deepEqual(s, lefaySpot(nav));
  // open land begins at x 80 (block 1's water to 79): the middle (64) is shut both ways, so the first clear cell east
  assert.deepEqual([s.gx, s.gy], [83, 31]);
  assert.equal(lefaySpotOf({ width: 0, height: 0, blocks: [] }), null);
  // AUDIT LEFAY1 A3: the shallows the classic table walks (record 8, a shore the player wades) are water to it on every
  // lane - one spot for every client, never in the water
  const shallows = { width: 1, height: 1, blocks: [block(0, auto(() => false), tiles((tx, ty) => (tx >= 6 && tx < 10 && ty >= 6 && ty < 10 ? 8 : 2)))] };
  const dry = lefaySpotOf(shallows);
  for (const [dx, dy] of discCells(MONUMENT_CLEAR_M)) {
    const gx = dry.gx + dx, gy = 63 - (dry.gy + dy);   // the block's own row (setBlockData flips it)
    assert.equal(gx >= 24 && gx < 40 && gy >= 24 && gy < 40, false, 'none of its disc in the shallows');
  }
});

test('LEFAY1: THE CARVE - the people\'s navgrid closed within MONUMENT_CARVE_M of its middle, and only there', () => {
  const nav = new CityNavigation(1, 1);
  nav.grid.fill(12 << 4);
  const spot = { gx: 30, gy: 20 };
  const n = carveLefay(nav, spot);
  const disc = discCells(MONUMENT_CARVE_M);
  assert.equal(n, disc.length);
  assert.equal(disc.length, 21, 'within 3.6 m of its centre - its clear disc\'s cells (AUDIT LEFAY1 A4: a walker\'s sprite clear of the ground ring)');
  for (const [dx, dy] of disc) assert.equal(nav.weightAt(30 + dx, 20 + dy), 0);
  assert.equal(nav.weightAt(30 + 3, 20), 12, 'beyond it the ground stays');
  assert.equal(nav.weightAt(32, 22), 12, 'the disc\'s corner stays');
  assert.equal(nav.weightAt(32, 21), 0, 'the knight\'s move closed');
  assert.ok(Math.hypot(2, 2) * NAV_CELL - 3.3 > 1, 'the nearest open cell\'s centre a metre past the ground ring');
  assert.equal(carveLefay(nav, spot), 0, 'twice is once');
  assert.ok(MONUMENT_CARVE_M <= MONUMENT_CLEAR_M);
});

test('LEFAY1: THE STONE - three granite steps, a marble pedestal with four bronze plaques, a marble obelisk tipped in gilt', () => {
  const m = buildLefayModel();
  const tris = m.indices.length / 3;
  const per = Object.fromEntries(m.subMeshes.map((s) => [s.textureRecord, s.primitiveCount]));
  assert.deepEqual(per, {
    [LEFAY_GRANITE]: 3 * 8 * 3,   // three octagons: two triangles a side and one of the cap
    [LEFAY_MARBLE]: 3 * 4 * 3 + 4 + 4 * 2,   // the pedestal's three blocks and the cornice's underside, the obelisk's four sides
    [LEFAY_GILT]: 4,   // the point
    [LEFAY_PLAQUE]: 4 * 2,
    [LEFAY_BRONZE]: 4 * 4 * 2,
  });
  assert.equal(tris, 72 + 48 + 4 + 8 + 32);
  assert.ok(m.subMeshes.every((s) => s.textureArchive === LEFAY_ARCHIVE));
  assert.equal(LEFAY_ARCHIVE, 38211);
  // its extent: the lowest step's corners, its foot sunk, its gilt point
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < m.positions.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], m.positions[i + k]); hi[k] = Math.max(hi[k], m.positions[i + k]); }
  assert.ok(Math.abs(lo[1] + MONUMENT_FOOT) < 1e-6 && Math.abs(hi[1] - OBELISK.apex) < 1e-6);
  assert.ok(hi[0] <= MONUMENT_STEPS[0].r + 1e-6 && hi[0] > MONUMENT_STEPS[0].r * 0.9);
  assert.deepEqual(MONUMENT_BOXES.map((b) => [...b]), [[-2.8, 0, -2.8, 2.8, 0.9, 2.8], [-0.84, 0, -0.84, 0.84, OBELISK.apex, 0.84]], 'its steps, and its column - not the air between');
  // EVERY FACE OUTWARD (the renderer culls the back): a side away from the axis, a top up, only the plaques' feet and
  // the cornice's underside down (AUDIT LEFAY1 A2: it overhangs the die - without it the sky showed through it)
  let down = 0, underCornice = 0;
  for (let t = 0; t < tris; t++) {
    const i = t * 9, n = [m.normals[i], m.normals[i + 1], m.normals[i + 2]];
    const c = [0, 1, 2].map((k) => (m.positions[i + k] + m.positions[i + 3 + k] + m.positions[i + 6 + k]) / 3);
    assert.ok(Math.abs(Math.hypot(...n) - 1) < 1e-5, `triangle ${t} has a normal`);
    if (n[1] < -0.5) { down++; if (Math.abs(c[1] - PEDESTAL.dieTop) < 1e-6) underCornice++; continue; }
    if (n[1] > 0.5) continue;
    assert.ok(n[0] * c[0] + n[2] * c[2] > 0, `triangle ${t} faces its axis`);
  }
  assert.equal(down, 4 * 2 + 4, 'the plaques\' four feet and the cornice\'s underside, and nothing else faces down');
  assert.equal(underCornice, 4, 'the cornice\'s underside at the die\'s top');
});

test('LEFAY1: THE PLAQUE\'S FACE - its picture\'s top-left at the plaque\'s top, on the viewer\'s left, on every face (the world left-handed, as the game draws it)', () => {
  const m = buildLefayModel();
  const sm = m.subMeshes.find((s) => s.textureRecord === LEFAY_PLAQUE);
  const faces = new Map();
  for (let v = sm.startIndex; v < sm.startIndex + sm.primitiveCount * 3; v++) {
    const p = [m.positions[v * 3], m.positions[v * 3 + 1], m.positions[v * 3 + 2]], uv = [m.uvs[v * 2], m.uvs[v * 2 + 1]];
    const n = [m.normals[v * 3], m.normals[v * 3 + 1], m.normals[v * 3 + 2]].map(Math.round);
    const k = n.join(',');
    if (!faces.has(k)) faces.set(k, { n, verts: [] });
    faces.get(k).verts.push({ p, uv });
  }
  assert.equal(faces.size, 4, 'one plaque to a face of the die');
  for (const { n, verts } of faces.values()) {
    // the viewer stands out along n, looking back at it
    // AUDIT LEFAY1 A1: the world is DFU's, LEFT-handed, and drawn so (world/mat4.js THE HANDEDNESS LAW: +x lands
    // screen-right) - facing north, east is on the right; facing back along -n, the right is (-n.z, n.x)
    const right = [-n[2], 0, n[0]];
    for (const { p, uv } of verts) {
      const across = p[0] * right[0] + p[2] * right[2];
      assert.equal(uv[0], across > 0 ? 1 : 0, 'u runs left to right as the viewer sees it');
      assert.equal(uv[1], p[1] > PLAQUE.mid ? 0 : 1, 'v runs down from its top');
      assert.ok(Math.abs(p[0] * n[0] + p[2] * n[2] - (PEDESTAL.dieHalf + PLAQUE.proud)) < 1e-6, 'proud of the die');
    }
  }
  assert.ok(Math.abs(PLAQUE.w / PLAQUE.h - LEFAY_PLAQUE_W / LEFAY_PLAQUE_H) < 1e-9, 'the picture is the plaque\'s shape');
});

test('LEFAY1: THE ART - five pictures, opaque, the same on every client; the plaque cut with the inscription', () => {
  const a = lefayArt(), b = lefayArt();
  assert.deepEqual(a.map(([r]) => r), [LEFAY_GRANITE, LEFAY_MARBLE, LEFAY_GILT, LEFAY_PLAQUE, LEFAY_BRONZE]);
  for (let i = 0; i < a.length; i++) {
    const img = a[i][1];
    assert.equal(img.colors.length, img.width * img.height * 4);
    for (let k = 3; k < img.colors.length; k += 4) assert.equal(img.colors[k], 255);
    assert.deepEqual(img.colors, b[i][1].colors, 'deterministic');
  }
  const plaque = a[3][1];
  assert.deepEqual([plaque.width, plaque.height], [LEFAY_PLAQUE_W, LEFAY_PLAQUE_H]);
  assert.deepEqual(LEFAY_TEXT.plaque, ['JULIAN LEFAY', '1965 - 2025', 'FATHER OF', 'THE ELDER SCROLLS']);
  // every letter it carries is drawn, and every line fits inside the bevel
  for (const [i, line] of LEFAY_TEXT.plaque.entries()) {
    for (const ch of line) assert.ok(lefayGlyph(ch), `the plaque has a glyph for "${ch}"`);
    assert.ok(lineWidth(line, PLAQUE_SCALES[i]) <= LEFAY_PLAQUE_W - 16, `"${line}" fits`);
  }
  for (const g of Object.values(LEFAY_GLYPHS)) { assert.equal(g.length, GLYPH_H); for (const row of g) assert.match(row, /^[#.]{5}$/); }
  // the cut letters are the darkest bronze on it, and there are as many as the glyphs say
  const dark = (img) => { let n = 0; for (let k = 0; k < img.colors.length; k += 4) if (img.colors[k] === 34 && img.colors[k + 1] === 22 && img.colors[k + 2] === 10) n++; return n; };
  const inked = LEFAY_TEXT.plaque.reduce((n, line, i) => n + [...line].reduce((m, ch) => m + lefayGlyph(ch).join('').split('#').length - 1, 0) * PLAQUE_SCALES[i] ** 2, 0);
  assert.equal(dark(plaque), inked);
  assert.equal(dark(lefayPlaqueArt([])), 0, 'a plaque with no lines has no letters');
});

test('LEFAY1: A THROW\'S REST - the ring by its share, the thrower\'s side, a flower of the arena crowd\'s', () => {
  assert.equal(LEFAY_FLOWERS, THROWN_FLOWERS, 'the arena crowd\'s flowers - one table, imported');
  assert.ok(Math.abs(FLOWER_RINGS.reduce((n, r) => n + r.share, 0) - 1) < 1e-9);
  const seq = (...v) => { let i = 0; return () => v[i++]; };
  assert.deepEqual(tossRest(0, seq(0, 0.5, 0, 0)), [0, 0, 0, 0], 'the first draw low: the top step, straight at the thrower');
  assert.deepEqual(tossRest(0, seq(0.34, 0.5, 0, 0))[2], 0);
  assert.deepEqual(tossRest(0, seq(0.36, 0.5, 0, 0))[2], 1);
  assert.deepEqual(tossRest(0, seq(0.66, 0.5, 0, 0))[2], 2);
  assert.deepEqual(tossRest(0, seq(0.86, 0.5, 0, 0))[2], 3, 'the last share: the ground at its foot');
  assert.deepEqual(tossRest(0, seq(0.99999, 0.5, 0.99999, 0.99999)), [0, LEFAY_FLOWERS.length - 1, 3, 9]);
  const deg = (a) => Math.round((a * 180) / Math.PI);
  assert.equal(tossRest(Math.PI / 2, seq(0, 1 - 1e-12, 0, 0))[0], deg(Math.PI / 2 + TOSS_SPREAD), 'the spread\'s edge');
  assert.equal(tossRest(0, seq(0, 0, 0, 0))[0], (360 + deg(-TOSS_SPREAD)) % 360, 'whole degrees, 0..359');
  // the place: on its ring, at its height, on the thrower's bearing
  for (let ring = 0; ring < FLOWER_RINGS.length; ring++) {
    for (const across of [0, 9]) {
      const p = flowerPlace([90, 0, ring, across]);
      assert.ok(Math.abs(p[0] - (across ? FLOWER_RINGS[ring].r1 : FLOWER_RINGS[ring].r0)) < 1e-9 && Math.abs(p[2]) < 1e-9, 'east of the middle at 90');
      assert.equal(p[1], FLOWER_RINGS[ring].y);
    }
  }
  // each ring stands on its step's top: inside its face, outside the next step's corners
  const steps = MONUMENT_STEPS, apothem = (r) => r * Math.cos(Math.PI / 8);
  assert.ok(FLOWER_RINGS[0].r0 > PEDESTAL.baseHalf * Math.SQRT2 && FLOWER_RINGS[0].r1 < apothem(steps[2].r) && FLOWER_RINGS[0].y === steps[2].top);
  assert.ok(FLOWER_RINGS[1].r0 > steps[2].r && FLOWER_RINGS[1].r1 < apothem(steps[1].r) && FLOWER_RINGS[1].y === steps[1].top);
  assert.ok(FLOWER_RINGS[2].r0 > steps[1].r && FLOWER_RINGS[2].r1 < apothem(steps[0].r) && FLOWER_RINGS[2].y === steps[0].top);
  // AUDIT LEFAY1 B6: the ground ring inside the ground the spot's search holds open - the nearest point of any cell
  // outside the clear disc (5.6 m, on the axes), not MONUMENT_CLEAR_M itself
  const inDisc = new Set(discCells(MONUMENT_CLEAR_M).map(([dx, dy]) => `${dx},${dy}`));
  let openTo = Infinity;
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    if (!inDisc.has(`${dx},${dy}`)) openTo = Math.min(openTo, Math.hypot(Math.max(Math.abs(dx) - 0.5, 0), Math.max(Math.abs(dy) - 0.5, 0)) * NAV_CELL);
  }
  assert.ok(Math.abs(openTo - 3.5 * NAV_CELL) < 1e-9, `open to ${openTo.toFixed(3)} m`);
  assert.ok(FLOWER_RINGS[3].r0 > steps[0].r && FLOWER_RINGS[3].r1 < openTo && FLOWER_RINGS[3].y === 0);
  // the flight: from the hand to the rest, its arc TOSS_ARC over the line at its middle
  const from = [4, 1.4, 0], to = [1.3, 0.9, 0];
  assert.deepEqual(tossPoint(from, to, 0), from);
  assert.deepEqual(tossPoint(from, to, 1), to);
  assert.ok(Math.abs(tossPoint(from, to, 0.5)[1] - ((from[1] + to[1]) / 2 + TOSS_ARC)) < 1e-9);
  assert.deepEqual(tossPoint(from, to, 7), to, 'clamped');
});

test('LEFAY1: THE TRIBUTE - the count and the newest MONUMENT_FLOWERS_KEPT where they lay; junk reads as none laid', () => {
  assert.deepEqual(normalTribute(undefined), { count: 0, laid: [] });
  assert.deepEqual(normalTribute('junk'), { count: 0, laid: [] });
  assert.deepEqual(normalTribute({ count: -3, laid: [[10, 0, 0, 0], [360, 0, 0, 0], [1, 9, 0, 0], [1, 0, 4, 0], [1, 0, 0, 10], [1.5, 0, 0, 0], 'x', [1, 1, 1], new Array(4)] }), { count: 1, laid: [[10, 0, 0, 0]] }, 'only the whole entries in range, and never fewer counted than kept');
  let t = undefined;
  for (let i = 0; i < MONUMENT_FLOWERS_KEPT + 5; i++) t = layFlower(t, [i % 360, i % LEFAY_FLOWERS.length, i % FLOWER_RINGS.length, i % 10]);
  assert.equal(t.count, MONUMENT_FLOWERS_KEPT + 5);
  assert.equal(t.laid.length, MONUMENT_FLOWERS_KEPT);
  assert.deepEqual(t.laid[0], [5, 0, 1, 5], 'the oldest let go');
  assert.deepEqual(layFlower(t, [400, 0, 0, 0]), normalTribute(t), 'a bad entry lays nothing');
  // through the save's own envelope
  const entity = { name: 'Hero', items: [], lefayTribute: t };
  const snap = snapshotPlayer(entity, {});
  assert.deepEqual(snap.lefayTribute, t);
  const back = {};
  restorePlayer(back, JSON.parse(JSON.stringify(snap)));
  assert.deepEqual(back.lefayTribute, t);
  const old = JSON.parse(JSON.stringify(snap));
  delete old.lefayTribute;
  const back2 = {};
  restorePlayer(back2, old);
  assert.deepEqual(back2.lefayTribute, { count: 0, laid: [] }, 'a save from before it laid none');
});

/** A renderer and a collider that record what the pool asks of them. */
function rig({ site = [100, 50], ground = 2, feet = null } = {}) {
  const log = { uploads: [], meshes: 0, destroyedMeshes: 0, batches: [], destroyed: [], buckets: new Map(), say: [], mid: [], sounds: 0 };
  const renderer = {
    uploadTexture: (a, r) => log.uploads.push([a, r]),
    createMesh: () => { log.meshes++; return { mesh: log.meshes }; },
    destroyMesh: () => { log.destroyedMeshes++; },
    drawMesh: (...a) => { log.drawn = a; },
    createBillboardBatch: (a, r, size, centers) => { const b = { a, r, size, centers }; log.batches.push(b); return b; },
    destroyBillboardBatch: (b) => log.destroyed.push(b),
  };
  const collider = {
    addMesh: (key, pos, idx, m) => log.buckets.set(key, { pos, idx, m }),
    removeBucket: (key) => log.buckets.delete(key),
  };
  const tex = { size: { width: 20, height: 30 } };
  const st = { site, ground, feet, eye: [100, 3.6, 55], t: 1000, tribute: undefined };
  const deps = {
    renderer, collider: () => collider,
    getTexture: async () => tex, uploadRecord: (a, r) => log.uploads.push([a, r]), billboardSize: () => ({ w: 1, h: 2 }),
    site: () => st.site, groundAt: () => st.ground, eye: () => st.eye, feet: () => st.feet,
    tribute: () => st.tribute, keep: (next) => { st.tribute = next; },
    say: (t) => log.say.push(t), midText: (t) => log.mid.push(t), sound: () => { log.sounds++; },
    now: () => st.t, rand: () => 0.5,
  };
  return { log, st, deps };
}

test('LEFAY1: THE POOL STANDS IT - on its site\'s ground, its stone, its bucket under its key, its box met at its stone', async () => {
  const { log, st, deps } = rig();
  const m = createLefayMonument(deps);
  assert.deepEqual(m.frame(), [100, 2, 50]);
  assert.equal(log.meshes, 1);
  assert.deepEqual(log.uploads.filter(([a]) => a === LEFAY_ARCHIVE).map(([, r]) => r), [0, 1, 2, 3, 4], 'its five pictures, under its own archive');
  assert.ok(log.buckets.has(LEFAY_KEY), 'its collider under the key the eye\'s box answers to');
  assert.deepEqual([...log.buckets.get(LEFAY_KEY).m].slice(12, 15), [100, 2, 50]);
  assert.equal(m.draw(deps.renderer), 1);
  const [t, col] = m.targets();
  assert.equal(m.targets().length, 2);
  assert.ok([t, col].every((x) => x.key === LEFAY_KEY && x.reach === LEFAY_REACH && x.distance === RAY_DISTANCE && x.meshCollider === true));
  assert.deepEqual(t.aabb, { min: [97.2, 2, 47.2], max: [102.8, 2.9, 52.8] });
  assert.deepEqual(col.aabb.min.map((v) => Math.round(v * 100) / 100), [99.16, 2, 49.16]);
  assert.deepEqual(col.aabb.max.map((v) => Math.round(v * 100) / 100), [100.84, 2 + OBELISK.apex, 50.84]);
  assert.equal(LEFAY_REACH, STATIC_NPC_ACTIVATION_DISTANCE);
  // a recentre moves it: the bucket stood again where it stands
  st.site = [90, 50];
  m.frame();
  assert.deepEqual([...log.buckets.get(LEFAY_KEY).m].slice(12, 15), [90, 2, 50]);
  assert.equal(m.targets()[0].aabb.min[0], 87.2, 'the box made again');
  assert.equal(log.meshes, 1, 'the mesh made once');
  // its town not built: down
  st.site = null;
  assert.equal(m.frame(), null);
  assert.equal(log.buckets.has(LEFAY_KEY), false);
  assert.deepEqual(m.targets(), []);
  assert.equal(m.draw(deps.renderer), 0);
  // no ground under it (its pixel not built yet): it does not stand
  st.site = [90, 50]; st.ground = -Infinity;
  assert.equal(m.frame(), null);
  assert.equal(log.buckets.has(LEFAY_KEY), false);
});

test('LEFAY1: THE POOL HOLDS ITS STONE BACK from a body standing where it would rise, and stands it once they step off', () => {
  const { log, st, deps } = rig({ feet: [100.5, 2, 50.2] });
  const m = createLefayMonument(deps);
  m.frame();
  assert.equal(log.buckets.has(LEFAY_KEY), false, 'a body inside the pedestal: no walls rise round it');
  assert.equal(bodyTrapped([100, 2, 50], [100.5, 2, 50.2]), true);
  // AUDIT LEFAY1 C1: its whole footprint - a body on the green inside its steps is walled in by them too (their tops over
  // the motor's step), so it is held back there; past the lowest step's corner and a capsule's radius it is not
  assert.equal(bodyTrapped([100, 2, 50], [102.5, 2, 50]), true, 'on the green inside its lowest step');
  assert.equal(bodyTrapped([100, 2, 50], [100 + (MONUMENT_STEPS[0].r + CAPSULE_RADIUS) * Math.SQRT1_2 - 0.01, 2, 50 + (MONUMENT_STEPS[0].r + CAPSULE_RADIUS) * Math.SQRT1_2 - 0.01]), true, 'by its corner');
  assert.equal(bodyTrapped([100, 2, 50], [100 + MONUMENT_STEPS[0].r + CAPSULE_RADIUS + 0.01, 2, 50]), false, 'beyond the lowest step\'s corner and a capsule\'s radius');
  assert.equal(bodyTrapped([100, 2, 50], [100.5, 2 + OBELISK.apex + 0.1, 50]), false, 'over its point');
  assert.equal(bodyTrapped([100, 2, 50], [100.5, 2 - MONUMENT_FOOT - CAPSULE_HEIGHT - 0.1, 50]), false, 'under its sunk foot');
  assert.equal(bodyTrapped([100, 2, 50], [100.5, 2 - CAPSULE_HEIGHT - 0.2, 50]), true, 'a head in its sunk foot');
  st.feet = [102.5, 2, 50];
  m.frame();
  assert.equal(log.buckets.has(LEFAY_KEY), false, 'still on its steps\' ground: held back');
  st.feet = [104, 2, 50];
  m.frame();
  assert.equal(log.buckets.has(LEFAY_KEY), true);
  // a body standing on its steps as the land moves under them both (a recentre) keeps them: never held back as it moves
  st.feet = [101.8, 2.6, 50];
  st.site = [90, 50]; st.feet = [91.8, 2.6, 50];
  m.frame();
  assert.deepEqual([...log.buckets.get(LEFAY_KEY).m].slice(12, 15), [90, 2, 50], 'stood again where it moved, under the body on it');
});

test('LEFAY1: THE PRESS - Read (or Info) reads it, Steal takes nothing, anything else throws a flower that lands and is laid', async () => {
  const { log, st, deps } = rig();
  const m = createLefayMonument(deps);
  m.frame();
  await new Promise((r) => setTimeout(r, 0));   // the flowers' pictures come
  m.frame();
  assert.equal(m.state().flowers, 'loaded');
  assert.deepEqual(log.uploads.filter(([a]) => a === 254).map(([, r]) => r), THROWN_FLOWERS.map(([, r]) => r));
  assert.equal(m.activate('grave:1', 'grab'), false, 'not its key');
  assert.equal(m.activate(LEFAY_KEY, 'info'), true);
  assert.deepEqual(log.say, [...LEFAY_TEXT.read]);
  assert.equal(m.activate(LEFAY_KEY, 'grab', 'read'), true, 'the lit Read row in any mode');
  assert.equal(log.say.length, 2 * LEFAY_TEXT.read.length);
  m.activate(LEFAY_KEY, 'steal');
  assert.deepEqual(log.mid, [LEFAY_TEXT.steal]);
  assert.equal(st.tribute, undefined, 'nothing thrown yet');
  // a throw: in flight from the hand, at its rest TOSS_MS later, laid in the character's pile
  m.activate(LEFAY_KEY, 'grab', 'flowers');
  assert.equal(log.sounds, 1);
  assert.deepEqual(log.mid, [LEFAY_TEXT.steal, LEFAY_TEXT.laid]);
  assert.equal(m.state().tosses, 1);
  const flight = m.batches().at(-1);
  st.t += TOSS_MS / 2; m.frame();
  const entry = tossRest(Math.atan2(st.eye[0] - 100, st.eye[2] - 50), deps.rand);
  const mid = tossPoint([0, st.eye[1] - TOSS_HAND_DROP - 2, 5], flowerPlace(entry), 0.5);
  assert.deepEqual(flight.origin.map((v) => Math.round(v * 1e6) / 1e6), [100 + mid[0], 2 + mid[1], 50 + mid[2]].map((v) => Math.round(v * 1e6) / 1e6), 'on its arc, riding the monument\'s middle');
  assert.equal(st.tribute, undefined, 'not laid in the air');
  st.t += TOSS_MS / 2; m.frame();
  assert.deepEqual(st.tribute, { count: 1, laid: [entry] });
  assert.ok(log.destroyed.includes(flight), 'the flight\'s batch freed');
  assert.equal(m.state().tosses, 0);
  const pile = m.batches();
  assert.equal(pile.length, 1);
  assert.deepEqual(pile[0].centers, [flowerPlace(entry)]);
  assert.deepEqual(pile[0].origin, [100, 2, 50]);
  // at most one throw every TOSS_EVERY_MS
  m.activate(LEFAY_KEY, 'grab');
  assert.equal(log.sounds, 1, 'too soon after the last');
  st.t += TOSS_EVERY_MS; m.activate(LEFAY_KEY, 'talk');
  assert.equal(log.sounds, 2);
  // a transition lays what is in flight and takes its collider down
  m.destroyAll();
  assert.equal(st.tribute.count, 2);
  assert.equal(log.buckets.has(LEFAY_KEY), false);
  // the hover: its years, the man, what this character laid, its rows
  m.frame();
  assert.deepEqual(m.hoverName(LEFAY_KEY), {
    title: 'Monument to Julian LeFay', subs: ['1965 - 2025', 'Father of The Elder Scrolls', 'You have laid 2 flowers here'],
    actions: [{ id: 'flowers', label: 'Throw flowers' }, { id: 'read', label: 'Read the inscription' }],
  });
  assert.deepEqual(LEFAY_ROWS.map((r) => r.id), ['flowers', 'read']);
  assert.equal(LEFAY_TEXT.count(1), 'You have laid 1 flower here');
  assert.equal(m.hoverName(7), null, 'a door\'s bare number is not its key');
  // a loaded character's pile is read again
  st.tribute = normalTribute({ count: 9, laid: [[0, 1, 2, 3], [90, 1, 0, 0], [180, 4, 3, 9]] });
  m.frame();
  assert.deepEqual(m.batches().map((b) => b.r).sort((a, b) => a - b), [27, 29]);
  // the scene ends: everything freed
  m.dispose();
  assert.equal(log.destroyedMeshes, 1);
  assert.deepEqual(m.batches(), []);
});

test('LEFAY1: THE FOUR HOSTS - world.js and exterior.js stand it, the street press both share reaches it, the save carries it', () => {
  const world = read('src/scenes/world.js'), ext = read('src/scenes/exterior.js'), modes = read('src/scenes/worldModes.js'), save = read('src/systems/save.js');
  const dungeon = read('src/scenes/dungeonContext.js');
  for (const [name, src] of [['world.js', world], ['exterior.js', ext]]) {
    assert.match(src, /lefaySpotOf\(loc\)/, `${name} finds the spot off the town's own navgrid`);
    assert.match(src, /if \(lefaySpot\) carveLefay\((nav|cityNav), lefaySpot\);/, `${name} carves the people's navgrid`);
    assert.match(src, /createLefayMonument\(\{/, `${name} makes the pool`);
    assert.match(src, /lefay\??\.frame\(\)/, `${name} frames it`);
    assert.match(src, /lefay\??\.draw\(renderer\)/, `${name} draws it`);
    assert.match(src, /\.\.\.lefay\.batches\(\)/, `${name} draws its flowers`);
    assert.match(src, /monumentTargets: \(\) => lefay\??\.targets\(\)/, `${name} hands the street's ray its box`);
    assert.match(src, /activateMonument: \(key, mode, verb\) => lefay\??\.activate\(key, mode, verb\)/, `${name} hands it the press`);
    assert.match(src, /\(key\) => lefay\??\.hoverName\(key\)/, `${name} names it on the plaque`);
    assert.match(src, /lefay\??\.destroyAll\(\);/, `${name} takes it down at a change of place`);
    assert.match(src, /tribute: \(\) => playerEntity\.lefayTribute, keep: \(next\) => \{ playerEntity\.lefayTribute = next; \}/, `${name} keeps the pile on the character`);
  }
  assert.match(world, /lefay: lefaySpot,/, 'the pixel keeps its spot');
  assert.match(modes, /for \(const t of host\.monumentTargets\?\.\(\) \?\? \[\]\) targets\.push\(t\);/);
  assert.match(modes, /return host\.activateMonument\?\.\(key, getInteractionMode\(\), plaqueActionFor\(key\)\) \?\? true;/);
  assert.match(modes, /key\.startsWith\('lefay:'\)\) \{[^\n]*\n\s*if \(_hitDist > _hitReach\) \{ setMidScreenText\(TOO_FAR_AWAY_TEXT\); return true; \}/, 'too far speaks the refusal');
  assert.equal(/lefay/i.test(dungeon), false, 'the dungeon host stands no street, and nothing of it');
  assert.match(save, /snap\.lefayTribute = normalTribute\(entity\.lefayTribute\);/);
  assert.match(save, /entity\.lefayTribute = normalTribute\(snap\.lefayTribute\);/);
  assert.equal(LEFAY_KEY.startsWith('lefay:'), true, 'the press\'s arm reads its key\'s prefix');
});

// ── AUDIT LEFAY1 (lens B): the host's lifecycle, the pool's own laws, the plaque read as a reader reads it ──────────
test('AUDIT LEFAY1 B1: a flower thrown before a load lands nowhere - never in the loaded pile, by any load; one thrown after it is laid', async () => {
  const { log, st, deps } = rig();
  st.restores = 0;
  deps.restores = () => st.restores;
  const m = createLefayMonument(deps);
  m.frame();
  await new Promise((r) => setTimeout(r, 0));
  m.frame();
  m.activate(LEFAY_KEY, 'grab', 'flowers');
  const flight = m.batches().at(-1);
  st.restores++;   // a load: systems/save.js restorePlayer counts it, whichever host's load it is
  st.tribute = normalTribute({ count: 4, laid: [[0, 0, 0, 0]] });   // the loaded character's own pile
  const loaded = st.tribute;
  st.t += TOSS_MS; m.frame();
  assert.equal(st.tribute, loaded, 'nothing laid in the loaded pile');
  assert.ok(log.destroyed.includes(flight), 'its batch freed');
  assert.equal(m.state().tosses, 0);
  st.t += TOSS_EVERY_MS;
  m.activate(LEFAY_KEY, 'grab', 'flowers');
  m.destroyAll();   // a transition lays one thrown since
  assert.equal(st.tribute.count, 5);
  // the world host hands it the save's own count
  assert.match(read('src/scenes/world.js'), /restores: restoresSoFar,/);
});

test('AUDIT LEFAY1 C2: a vertical recentre (the site\'s compensation) re-reads its ground at once', () => {
  const { log, st, deps } = rig();
  st.site = [100, 50, 0];
  const m = createLefayMonument(deps);
  assert.deepEqual(m.frame(), [100, 2, 50]);
  st.ground = 2 - 500; st.site = [100, 50, -500];
  assert.deepEqual(m.frame(), [100, -498, 50], 'the next frame, not LEFAY_GROUND_EVERY frames on');
  assert.deepEqual([...log.buckets.get(LEFAY_KEY).m].slice(12, 15), [100, -498, 50]);
  assert.match(read('src/scenes/world.js'), /_lefaySite\[2\] = state\.compensation\[1\];/);
});

test('AUDIT LEFAY1 B2: THE POOL\'S OWN LAWS - a flight laid when its town goes, the lit row over the mode, no count line before a flower, the work done once', async () => {
  const { log, st, deps } = rig();
  let grounds = 0;
  deps.groundAt = () => { grounds++; return st.ground; };
  let adds = 0;
  const col = deps.collider(), add = col.addMesh;
  col.addMesh = (...a) => { adds++; return add(...a); };
  const m = createLefayMonument(deps);
  m.frame();
  await new Promise((r) => setTimeout(r, 0));
  m.frame();
  // no flower yet: no "You have laid 0 flowers here"
  assert.deepEqual(m.hoverName(LEFAY_KEY).subs, ['1965 - 2025', 'Father of The Elder Scrolls']);
  // the lit Throw row throws in Info and in Steal (the row is the verb; the mode speaks only with no row lit)
  m.activate(LEFAY_KEY, 'info', 'flowers');
  assert.equal(log.sounds, 1);
  assert.deepEqual(log.say, [], 'nothing read');
  st.t += TOSS_EVERY_MS;
  m.activate(LEFAY_KEY, 'steal', 'flowers');
  assert.equal(log.sounds, 2);
  assert.equal(log.mid.includes(LEFAY_TEXT.steal), false);
  // its town goes with two in the air: both laid, counted
  st.site = null; m.frame();
  assert.equal(st.tribute.count, 2);
  assert.equal(m.state().tosses, 0);
  // the work done once: the ground read on a move and every LEFAY_GROUND_EVERY frames, the collider and the pile's
  // batches made again only when they change
  st.site = [100, 50]; m.frame();
  const g0 = grounds, a0 = adds, b0 = log.batches.length;
  for (let i = 0; i < 29; i++) m.frame();
  assert.equal(grounds, g0, 'not read again within its frames');
  m.frame();
  assert.equal(grounds, g0 + 1, 'read again at LEFAY_GROUND_EVERY');
  assert.equal(adds, a0, 'the collider stood once');
  assert.equal(log.batches.length, b0, 'the pile\'s batches made once');
  // dispose frees the pile's batches too
  const pile = m.batches().slice();
  assert.ok(pile.length > 0);
  m.dispose();
  for (const b of pile) assert.ok(log.destroyed.includes(b), 'every pile batch freed');
});

test('AUDIT LEFAY1 B3: A THROW WITH NO BEARING (the eye\'s NaN) lands straight on, counted - and a saved entry out of range at any edge reads as none', async () => {
  const { st, deps } = rig();
  const m = createLefayMonument(deps);
  m.frame();
  st.eye = [NaN, 3.6, NaN];
  m.activate(LEFAY_KEY, 'grab');
  st.t += TOSS_MS; m.frame();
  assert.deepEqual(st.tribute, { count: 1, laid: [tossRest(0, deps.rand)] });
  // the draws in their order: the ring, the spread, the flower, the place across
  const seq = (...v) => { let i = 0; return () => v[i++]; };
  assert.deepEqual(tossRest(0, seq(0, 0.5, 0.99999, 0)), [0, LEFAY_FLOWERS.length - 1, 0, 0]);
  assert.deepEqual(tossRest(0, seq(0, 0.5, 0, 0.99999)), [0, 0, 0, 9]);
  // every edge of a saved entry
  const K = LEFAY_FLOWERS.length, R = FLOWER_RINGS.length;
  for (const bad of [[0, K, 0, 0], [0, -1, 0, 0], [-1, 0, 0, 0], [0, 0, R, 0], [0, 0, -1, 0], [0, 0, 0, -1], [0, 0, 0, 0, 0], [0, 0, 0]]) {
    assert.deepEqual(normalTribute({ laid: [bad] }).laid, [], `${JSON.stringify(bad)} reads as none`);
  }
  assert.deepEqual(normalTribute({ laid: [[359, K - 1, R - 1, 9]] }).laid, [[359, K - 1, R - 1, 9]], 'the far edge of each is kept');
  assert.equal(normalTribute({ count: 2.5, laid: [] }).count, 0, 'a count not whole reads as none');
  // a save holding more than it keeps: the newest MONUMENT_FLOWERS_KEPT
  const many = Array.from({ length: MONUMENT_FLOWERS_KEPT + 3 }, (_, i) => [i, 0, 0, 0]);
  const t = normalTribute({ count: 99, laid: many });
  assert.equal(t.laid.length, MONUMENT_FLOWERS_KEPT);
  assert.deepEqual(t.laid[0], [3, 0, 0, 0]);
});

test('AUDIT LEFAY1 B4: THE SPOT\'S SEARCH - found as far as MONUMENT_SEARCH_CELLS, never past it; nearest by distance, the road\'s cost after', () => {
  const ring = (w, open) => { const n = navOf(w, w, 0); for (const [x, y] of open) for (const [dx, dy] of discCells(MONUMENT_CLEAR_M)) n.set(x + dx, y + dy, 12); return n; };
  const near = lefaySpot(ring(160, [[80 + 40, 80]]));
  assert.deepEqual([near.gx, near.gy], [120, 80], '40 cells out: found');
  assert.equal(lefaySpot(ring(160, [[80 + 50, 80]])), null, '50 cells out: past the search');
  assert.equal(lefaySpot(ring(160, [[80 + 40, 80 + 40]])), null, '40 cells out on both axes (56.6 cells): past the search, which is round');
  assert.equal(MONUMENT_ROAD_COST, 0.3, 'a road cell under it costs 0.3 cells');
  // two greens: the nearer one stands it even though a cell further would cost the same road as it
  const two = ring(128, [[65, 58], [69, 64]]);
  const s = lefaySpot(two);
  assert.deepEqual([s.gx, s.gy], [69, 64], 'the nearer (5.52 cells) over the further (5.70)');
});

test('AUDIT LEFAY1 B5: THE PLAQUE READS - its letters the right way round and the right way up, centred inside its bevel (read off the picture, not the glyph table)', () => {
  const img = lefayPlaqueArt(), W = img.width, H = img.height;
  const dark = (x, y) => { const k = (y * W + x) * 4; return img.colors[k] === 34 && img.colors[k + 1] === 22 && img.colors[k + 2] === 10; };
  const runs = (n, has) => { const out = []; let a = -1; for (let i = 0; i <= n; i++) { const on = i < n && has(i); if (on && a < 0) a = i; if (!on && a >= 0) { out.push([a, i - 1]); a = -1; } } return out; };
  const bands = runs(H, (y) => { for (let x = 0; x < W; x++) if (dark(x, y)) return true; return false; });
  assert.deepEqual(bands.map(([a, b]) => b - a + 1), [14, 14, 7, 7], 'four lines: the name and the years twice the size');
  // centred, inside the bevel
  const top = bands[0][0], bottom = H - 1 - bands[3][1];
  assert.ok(Math.abs(top - bottom) <= 1 && top > 4, `centred top to bottom (${top}, ${bottom})`);
  const letters = bands.map(([y0, y1]) => runs(W, (x) => { for (let y = y0; y <= y1; y++) if (dark(x, y)) return true; return false; }));
  for (const [i, ls] of letters.entries()) {
    const l = ls[0][0], r = W - 1 - ls.at(-1)[1];
    assert.ok(Math.abs(l - r) <= 2 && l > 4, `line ${i} centred across (${l}, ${r})`);
  }
  // "JULIAN LEFAY": eleven letters, the space wider than the gaps between letters
  const name = letters[0];
  assert.equal(name.length, 11);
  const gaps = name.slice(1).map((g, k) => g[0] - name[k][1]);
  assert.equal(gaps.indexOf(Math.max(...gaps)), 5, 'the space after JULIAN');
  const [y0, y1] = bands[0];
  const box = (k) => ({ x0: name[k][0], x1: name[k][1], y0, y1 });
  // J: its bar at the top right, its hook at the bottom left; L: its stroke on the left, its foot at the bottom; F: its
  // arm at the top right, nothing at the bottom right
  const J = box(0), L = box(2), F = box(8);
  assert.ok(dark(J.x1, J.y0) && !dark(J.x0, J.y0) && dark(J.x0, J.y1 - 2), 'J reads right');
  assert.ok(dark(L.x0, L.y0) && !dark(L.x1, L.y0) && dark(L.x1, L.y1), 'L reads right');
  assert.ok(dark(F.x1, F.y0) && dark(F.x0, F.y1) && !dark(F.x1, F.y1), 'F reads right');
  // the bevel lit along its top and left, in shadow along its bottom and right; a cut letter's lip below and right of it
  const is = (x, y, c) => { const k = (y * W + x) * 4; return img.colors[k] === c[0] && img.colors[k + 1] === c[1] && img.colors[k + 2] === c[2]; };
  const LIT = [176, 138, 76], SHADOW = [44, 30, 14], LIP = [196, 160, 92];
  assert.ok(is(1, H >> 1, LIT) && is(W >> 1, 1, LIT) && is(W - 2, H >> 1, SHADOW) && is(W >> 1, H - 2, SHADOW), 'the light from the top left');
  assert.ok(is(L.x0 + 2, L.y0, LIP), 'the lip right of L\'s stroke');
});
