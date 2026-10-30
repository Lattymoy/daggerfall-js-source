// LIGHT-REACH (2026-10-29, the owner: "Increase distance for street and window lighting in overworld without killing
// performance"; which distance: "Both"). Measured first over ARENA2: lanterns lit to 170-280 m but each reached ~9 m;
// window light stopped at 40-64 m (its block full), reached 8 m, and was binned by its reach's sphere, though it lights
// a beam through its glass and a glow beside it. Pinned here: the box builder against the sphere's; a window's box holds
// what it lights and is a fraction of the sphere's; a far row lights what its tiles do; the tiers sum to one; the far
// tier on a long street; the shader's text; the lane's lantern reach and flicker; the loop's back-face skip. AUDIT
// LIGHT-REACH's own pins are test/render/audit_lightreach.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CLUSTER_X, CLUSTER_Y, LC_BOX, createClusterSpace, cellsOfSphere, cellsOfViewBox, buildLightClusters, buildLightClusterBoxes, cellLights, cellOfPoint,
} from '../../src/render/lightClusters.js';
import {
  WindowLightPass, windowAperturesOf, windowLightAt, windowRowAt, windowLightBox, writeWindowLight, lampOf, cellRows, windowLightGlsl,
  WL_VEC4, WL_KIND, WL_MAX_LIGHTS, WL_FAR_MAX, WL_FAR_GATHER, WL_FAR_UBO_BINDING, WL_UBO_BINDING, WL_ROW_TILES, WL_ROW_BASE, WL_ROW_CURTAIN,
  WL_LAMP_RANGE, WL_LAMP_GOBO, WL_SUN_REACH, WL_SPILL_REACH, WL_FADE_FROM, WL_GATHER, WL_GRID_ROW, WL_LIST_BASE, WL_FAR_GRID_ROW, WL_FAR_LIST_BASE,
} from '../../src/render/windowLight.js';
import { ROOM_CURTAIN_EDGE } from '../../src/world/windowRoomArt.js';
import { elAttenuation, EL_MESH_FS, EL_TERRAIN_FS, EL_CHAR_FS, EL_DECAL_FS, EL_BB_FS, EL_SPEC_GLOSS, EL_SPEC_STRENGTH, EL_EXPOSURE, EL_LIGHT_GAIN } from '../../src/render/enhancedLighting.js';
import { CITY_LIGHT_RANGE, STREET_LIGHT_REACH, streetLightRange, streetLanternAnimator } from '../../src/world/city/cityLights.js';
import { CityLightAnimator } from '../../src/world/worldClock.js';
import { perspective, mirrorProjectionX, lookAt, identity } from '../../src/world/mat4.js';
import { hostText } from '../hostText.mjs';
import { rng, norm, cross, inBox, boxVolume, fakeGl, glassAt, crossMask, highAt, front } from '../lightReachRig.mjs';

const PROJ = mirrorProjectionX(perspective(Math.PI / 3, 16 / 9, 0.1, 400));
const VIEW = lookAt([3, 1.7, 2], [-4, 1.2, -9], [0, 1, 0]);   // turned off every axis, so a box's half-axes mix in view
const VP = [0, 0, 1920, 1080];
const near = (a, b, e = 1e-4) => Math.abs(a - b) <= e;
/** A seeded LCG, the same points every run. */
test('LIGHT-REACH LR1: THE BOX BUILDER - a sphere\'s view box takes the sphere\'s own cells, a light given as a box of three half-axes takes exactly the cells of the sphere it bounds when the axes are its radius, every point inside a turned box finds the light in its own cell, and a box of no size takes none (mutants: a half-axis summed without its size, a box\'s depth taken as its width)', () => {
  const R = rng(11), box = new Int16Array(7), box2 = new Int16Array(7);
  for (let k = 0; k < 400; k++) {
    const vx = (R() - 0.5) * 60, vy = (R() - 0.5) * 30, vz = -R() * 120 + 5, r = 0.5 + R() * 20;
    const a = cellsOfSphere(vx, vy, vz, r, PROJ, box, 0), b = cellsOfViewBox(vx - r, vx + r, vy - r, vy + r, -vz - r, -vz + r, PROJ, box2, 0);
    assert.equal(a, b);
    if (a) assert.deepEqual(Array.from(box), Array.from(box2));
  }
  // forty lights as spheres and as boxes of three axis half-axes: the same grid, the same lists
  const n = 40, spheres = new Float32Array(n * 4), boxes = new Float32Array(n * LC_BOX);
  for (let i = 0; i < n; i++) {
    const x = (R() - 0.5) * 80, y = R() * 8, z = -R() * 90, r = 2 + R() * 16;
    spheres.set([x, y, z, r], i * 4);
    boxes.set([x, y, z, r, 0, 0, 0, r, 0, 0, 0, r], i * LC_BOX);
  }
  const A = createClusterSpace(64), B = createClusterSpace(64);
  assert.equal(buildLightClusters(spheres, n, VIEW, PROJ, A), true);
  assert.equal(buildLightClusterBoxes(boxes, n, VIEW, PROJ, B), true);
  // a turned view widens an axis box's view box past the sphere's own: never fewer cells, and every sphere cell kept
  assert.ok(B.total >= A.total, `${B.total} against ${A.total}`);
  for (let c = 0; c < 400; c++) {
    const x = Math.floor(R() * CLUSTER_X), y = Math.floor(R() * CLUSTER_Y), z = Math.floor(R() * 24);
    const sa = cellLights(A, x, y, z), sb = new Set(cellLights(B, x, y, z));
    for (const i of sa) assert.ok(sb.has(i), `cell ${x},${y},${z} light ${i}`);
  }
  // a turned box: a thousand points inside it, each in a cell that lists it
  const ax = norm([1, 0.3, -0.4]), ay = norm(cross([0.2, 1, 0.1], ax)), az = cross(ax, ay);
  const one = new Float32Array([2, 1.5, -14, ...ax.map((v) => v * 6), ...ay.map((v) => v * 1.5), ...az.map((v) => v * 9)]);
  const S = createClusterSpace(4);
  assert.equal(buildLightClusterBoxes(one, 1, VIEW, PROJ, S), true);
  let seen = 0;
  for (let k = 0; k < 1000; k++) {
    const t = [R() * 2 - 1, R() * 2 - 1, R() * 2 - 1], p = [0, 1, 2].map((i) => one[i] + t[0] * one[3 + i] + t[1] * one[6 + i] + t[2] * one[9 + i]);
    const cell = cellOfPoint(p, VIEW, PROJ, VP);
    if (!cell) continue;
    seen++;
    assert.deepEqual(cellLights(S, cell[0], cell[1], cell[2]), [0], `a point inside the box (${p.map((v) => v.toFixed(2))})`);
  }
  assert.ok(seen > 600, `${seen} points on screen`);
  const none = createClusterSpace(4);
  assert.equal(buildLightClusterBoxes(new Float32Array(LC_BOX).fill(0).fill(5, 0, 3), 1, VIEW, PROJ, none), true);
  assert.equal(none.total, 0, 'a box of no size takes no cell');
});

test('LIGHT-REACH LR1b: A LANTERN IS LISTED BY ITS SLICES - in each depth slice a sphere takes the tiles of its widest circle there, not of its whole box: a third fewer entries on a street of lanterns at the lane\'s reach, and every point of every sphere still in a cell that lists it (mutants: the slice not narrowed, the circle taken as the sphere)', () => {
  const R = rng(21), proj = mirrorProjectionX(perspective(Math.PI / 3, 16 / 9, 0.1, 400)), view = lookAt([0, 1.7, 0], [0, 1.7, -1], [0, 1, 0]);
  let sliced = 0, boxed = 0;
  for (let t = 0; t < 20; t++) {
    const n = 48, sp = new Float32Array(n * 4), bx = new Float32Array(n * LC_BOX);
    for (let i = 0; i < n; i++) { const x = (R() - 0.5) * 200, z = -R() * 250 + 10; sp.set([x, 4.1, z, 27], i * 4); bx.set([x, 4.1, z, 27, 0, 0, 0, 27, 0, 0, 0, 27], i * LC_BOX); }
    const A = createClusterSpace(64), B = createClusterSpace(64);
    assert.ok(buildLightClusters(sp, n, view, proj, A) && buildLightClusterBoxes(bx, n, view, proj, B));
    sliced += A.total; boxed += B.total;
    for (let k = 0; k < 300; k++) {   // a point inside a sphere: its cell lists the sphere
      const i = Math.floor(R() * n), u = norm([R() - 0.5, R() - 0.5, R() - 0.5]), d = Math.cbrt(R()) * 27 * 0.999;
      const p = [sp[i * 4] + u[0] * d, sp[i * 4 + 1] + u[1] * d, sp[i * 4 + 2] + u[2] * d], cell = cellOfPoint(p, view, proj, VP);
      if (cell) assert.ok(cellLights(A, cell[0], cell[1], cell[2]).includes(i), `light ${i} at ${p.map((v) => v.toFixed(1))}`);
    }
  }
  assert.ok(sliced < 0.75 * boxed, `the slices hold ${(100 * sliced / boxed).toFixed(0)}% of the boxes' entries`);
});

test('LIGHT-REACH LR2: A WINDOW LIGHT\'S BOX holds every point it lights - the lamp\'s beam through the glass out to its reach, the sun\'s along its rays into a room, the glass\'s glow beside it - by the shader\'s own twin over five hundred lights of every turn, size and skew; and it is under a tenth of the box of the reach\'s sphere, the old bound (mutants: the frustum\'s spread, the soft edge, the glow\'s half-box, the sun\'s run)', () => {
  const R = rng(5);
  let lit = 0, vol = 0, volSphere = 0;
  for (let t = 0; t < 500; t++) {
    const yaw = R() * 6.28, nf = [Math.cos(yaw), 0, Math.sin(yaw)], uh = norm(cross([0, 1, 0], nf));
    const w = 0.6 + R() * 1.6, h = 0.6 + R() * 1.6, skew = (R() - 0.5) * 0.3;
    const U = uh.map((x) => x * w), V = [uh[0] * skew, h, uh[2] * skew], c = [R() * 50, 2 + R() * 6, R() * 50];
    const lamp = t % 2 === 0, dir = norm([-nf[0] * (0.2 + R()), 0.1 + R(), -nf[2] * (0.2 + R()) + (R() - 0.5)]);
    const l = { c, U, V, nf, uv: [0.5, 0.5, 1, 1], src: lamp ? lampOf(c, nf, V) : dir, kind: lamp ? WL_KIND.lamp : WL_KIND.sun, layer: 0, reach: lamp ? WL_LAMP_RANGE : WL_SUN_REACH, area: w * h, gobo: [1, 1, 1], spill: [1, 1, 1], halfDiag: 0.5 * Math.hypot(U[0] + V[0], U[1] + V[1], U[2] + V[2]) };
    const rec = new Float32Array(WL_VEC4 * 4), B = new Float32Array(LC_BOX);
    writeWindowLight(rec, 0, l);
    windowLightBox(l, true, B, 0);
    const Rs = l.reach + l.halfDiag;
    vol += boxVolume(B); volSphere += (2 * Rs) ** 3;
    for (let k = 0; k < 600; k++) {
      const p = [c[0] + (R() * 2 - 1) * Rs, c[1] + (R() * 2 - 1) * Rs, c[2] + (R() * 2 - 1) * Rs], n = norm([R() - 0.5, R() - 0.5, R() - 0.5]);
      if (!(windowLightAt(rec, p, n, () => 1, elAttenuation)[0] > 0)) continue;
      lit++;
      assert.ok(inBox(B, 0, p), `light ${t} (${lamp ? 'lamp' : 'sun'}) lights ${p.map((v) => v.toFixed(2))} outside its box`);
    }
  }
  assert.ok(lit > 2000, `${lit} lit points`);
  assert.ok(vol / volSphere < 0.1, `the boxes are ${(100 * vol / volSphere).toFixed(1)}% of the spheres' boxes`);
  // the soft edge with the glow off (a far row's box): a narrow pane's beam lights a rim past its glass's lines - by the
  // lamp's footprint - and at the far end of its reach that rim is outside a box drawn through the glass's lines alone
  for (const [su, sv] of [[1, 0], [-1, 0], [0, -1]]) {
    const c = [0, 3, 0], nf = [0, 0, 1], U = [0.6, 0, 0], V = [0, 0.8, 0], src = lampOf(c, nf, V);
    const l = { c, U, V, nf, uv: [0.5, 0.5, 1, 1], src, kind: WL_KIND.lamp, layer: 0, reach: WL_LAMP_RANGE, area: 0.48, gobo: [1, 1, 1], spill: [0, 0, 0], halfDiag: 0.5 };
    const rec = new Float32Array(WL_VEC4 * 4), B = new Float32Array(LC_BOX);
    writeWindowLight(rec, 0, l);
    windowLightBox(l, true, B, 0, false);
    let p = null;
    for (let it = 0, tt = 0.85; it < 4; it++) {   // a point 0.97 of the reach out along a ray through the rim, 0.8 of the footprint past the glass
      const C = [c[0] + su * (0.3 + 0.8 * 2 * 0.1 * tt), c[1] + sv * (0.4 + 0.8 * 2 * 0.1 * tt), 0], d = norm([C[0] - src[0], C[1] - src[1], C[2] - src[2]]);
      p = [src[0] + d[0] * 0.97 * WL_LAMP_RANGE, src[1] + d[1] * 0.97 * WL_LAMP_RANGE, src[2] + d[2] * 0.97 * WL_LAMP_RANGE];
      tt = p[2] / (p[2] - src[2]);
    }
    const toLamp = norm([src[0] - p[0], src[1] - p[1], src[2] - p[2]]);
    assert.ok(windowLightAt(rec, p, toLamp, () => 1, elAttenuation)[0] > 0, `the rim lit (${su}, ${sv})`);
    assert.ok(inBox(B, 0, p), `and inside the box (${su}, ${sv}): ${p.map((v) => v.toFixed(2))}`);
  }
  // the glow alone: a pane the sun does not face is its half-box on its own side, WL_SPILL_REACH every way
  const g = new Float32Array(LC_BOX);
  windowLightBox({ c: [0, 3, 0], U: [1, 0, 0], V: [0, 1, 0], nf: [0, 0, 1], src: [0, 1, 0], kind: WL_KIND.sun, reach: WL_SPILL_REACH, halfDiag: 0.7 }, false, g, 0);
  assert.deepEqual(Array.from(g).map((v) => +v.toFixed(5)), [0, 3, WL_SPILL_REACH / 2, WL_SPILL_REACH, 0, 0, 0, WL_SPILL_REACH, 0, 0, 0, WL_SPILL_REACH / 2]);
});

test('LIGHT-REACH LR3: A FAR ROW LIGHTS WHAT ITS TILES LIGHT - a storey\'s run of one wall\'s tiles, each through its own lamp and its own glass: the row\'s walk (the shader\'s twin) equals the sum of the near tier\'s lights of its lit tiles, their glow aside and their curtains at the row\'s mean edges, at every point, on a front turned off the axes; the rows themselves runs of neighbours up to WL_ROW_TILES on one mapping and storey; and every point a row lights inside its box (mutants: the tile step, the shared tt, a dark tile lit, the curtain\'s edges, the box\'s run)', () => {
  assert.equal(WL_ROW_BASE, 3 ** WL_ROW_TILES);
  assert.ok(WL_ROW_BASE * (WL_ROW_TILES + 1) < 2 ** 24, 'a row\'s states are a whole float');
  assert.deepEqual([...WL_ROW_CURTAIN], [ROOM_CURTAIN_EDGE[0] + ROOM_CURTAIN_EDGE[1] / 2, ROOM_CURTAIN_EDGE[2] - ROOM_CURTAIN_EDGE[3] / 2]);
  const pass = new WindowLightPass(fakeGl(), { activeTexture: () => {} });
  pass.addMask('m', crossMask());
  const mask = pass.masks.get('m');
  mask.layer = 0;
  const sub = front(14, 0.7), s = { m: identity(), remap: null, seen: 0, subs: null };
  const R = rng(9), mAt = (u, v) => (glassAt(u, v) ? 1 : 0);
  const frame = [0, 0, 0, 1e-3, 1, 1, 1, 1e6];   // no near cut, no far cut: every lit tile whole
  let rows = 0, lit = 0, curtained = 0;
  // a front of sixteen 1 m tiles: one cell holds more of a storey than a row may
  const narrow = front(16, 0, 1, 2), t1 = pass._cellTiles(s, narrow, 0), f1 = narrow.cells[4];
  const storey = (ty) => t1.rows.filter((r) => narrow.ap[(f1 + r.js[0]) * 18 + 1] === ty);
  assert.ok(storey(0).reduce((n, r) => n + r.js.length, 0) > WL_ROW_TILES, 'more tiles in a storey than a row holds');
  assert.ok(storey(0).length >= 2 && storey(0).every((r) => r.js.length <= WL_ROW_TILES), 'so the storey is two rows');
  for (let ci = 0; ci < sub.cells.length / 6; ci++) {
    const t = pass._cellTiles(s, sub, ci);
    const first = sub.cells[ci * 6 + 4];
    assert.deepEqual(t.rows.map((r) => r.js), cellRows(sub.ap, first, t).map((r) => r.js), 'the cell\'s rows are cellRows\'');
    for (const row of t.rows) {
      const txs = row.js.map((j) => sub.ap[(first + j) * 18]), ty = sub.ap[(first + row.js[0]) * 18 + 1];
      assert.ok(row.js.length <= WL_ROW_TILES && txs.every((x, i) => x === txs[0] + i) && row.js.every((j) => sub.ap[(first + j) * 18 + 1] === ty), 'a run of neighbours on one storey');
      if (!row.lit || !pass._rowRecord({ row, s, sub, ci, t, mask })) continue;
      rows++;
      const tiles = row.js.map((j) => {
        if (!t.street[j]) return null;
        const keep = t.curtains[j];
        if (keep) { t.curtains[j] = WL_ROW_CURTAIN; curtained++; }
        const l = pass._lampLight({ ap: sub.ap, k: (first + j) * 18, s, mask, t, j }, [1, 1, 1], 1 / WL_LAMP_GOBO);
        t.curtains[j] = keep;
        if (!l) return null;
        l.spill = [0, 0, 0];
        const r = new Float32Array(WL_VEC4 * 4);
        writeWindowLight(r, 0, l);
        return r;
      });
      for (let k = 0; k < 2500; k++) {
        const [x, z] = sub.rot((R() - 0.5) * 50, -10 + R() * 14), wp = [x, R() * 6, z], n = norm([R() - 0.5, 0.3 + R(), R() - 0.5]);
        const a = windowRowAt(row.rec, frame, wp, n, mAt, elAttenuation)[0];
        let b = 0;
        for (const r of tiles) if (r) b += windowLightAt(r, wp, n, mAt, elAttenuation)[0];
        assert.ok(near(a, b, 1e-5), `row ${row.js} at ${wp.map((v) => v.toFixed(2))}: ${a} against its tiles' ${b}`);
        if (a > 0) { lit++; assert.ok(inBox(row.box, 0, wp), 'inside the row\'s box'); }
      }
    }
  }
  assert.ok(rows >= 3 && lit > 500 && curtained > 0, `${rows} rows, ${lit} lit points, ${curtained} curtained tiles`);
});

test('LIGHT-REACH LR4: THE TWO TIERS SUM TO ONE - through the near cut\'s fade a tile\'s near light is its share, and the far row gives the rest by the same distance (the coverage centre), so a pool neither doubles nor dims where the tiers meet; past the far cut a row fades out the same way (mutants: the complement, the far fade, the tile\'s centre)', () => {
  const pass = new WindowLightPass(fakeGl(), { activeTexture: () => {} });
  pass.addMask('m', crossMask(64, highAt));
  const mask = pass.masks.get('m');
  mask.layer = 0;
  const sub = front(10), s = { m: identity(), remap: null, seen: 0, subs: null }, mAt = (u, v) => (highAt(u, v) ? 1 : 0);
  const t = pass._cellTiles(s, sub, 0), first = sub.cells[4];
  const row = t.rows.find((r) => r.js.filter((j) => t.street[j] && !t.curtains[j]).length >= 2);
  assert.ok(row && pass._rowRecord({ row, s, sub, ci: 0, t, mask }));
  const eye = [0, 1.7, 30], dist = (j) => Math.hypot(t.cent[3 * j] - eye[0], t.cent[3 * j + 1] - eye[1], t.cent[3 * j + 2] - eye[2]);
  // the near tier's lights of the row's bare tiles, and the row's states cut to those tiles alone
  const bare = row.js.filter((j) => t.street[j] && !t.curtains[j]);
  const lights = bare.map((j) => {
    const l = pass._lampLight({ ap: sub.ap, k: (first + j) * 18, s, mask, t, j }, [1, 1, 1], 1 / WL_LAMP_GOBO);
    l.spill = [0, 0, 0];
    const r = new Float32Array(WL_VEC4 * 4);
    writeWindowLight(r, 0, l);
    return { j, r };
  });
  let st = row.js.length * WL_ROW_BASE;
  row.js.forEach((j, i) => { if (bare.includes(j)) st += 3 ** i; });
  row.rec[27] = st;
  const fade = (c, d) => Math.max(0, Math.min(1, (c - d) / (c * (1 - WL_FADE_FROM))));
  const R = rng(4), n = [0, 1, 0];
  let banded = 0;
  for (let k = 0; k < 60; k++) {
    const wp = [(R() - 0.5) * 20, 0, -10 + 0.5 + R() * 8], band = dist(bare[0]) / (WL_FADE_FROM + 0.2 * R());
    // (a) no far cut, a near cut whose fade crosses the tiles: the near share and the row's sum to the whole
    let whole = 0, nearPart = 0;
    for (const { j, r } of lights) { const v = windowLightAt(r, wp, n, mAt, elAttenuation)[0]; whole += v; nearPart += v * fade(band, dist(j)); }
    const farPart = windowRowAt(row.rec, [...eye, band, 1, 1, 1, 1e6], wp, n, mAt, elAttenuation)[0];
    assert.ok(near(nearPart + farPart, whole, 1e-5), `near ${nearPart} + far ${farPart} against ${whole}`);
    if (nearPart > 1e-4 && farPart > 1e-4) banded++;
    // (b) no near cut, a far cut across the tiles: the row fades as the near tier does at its own cut
    let faded = 0;
    for (const { j, r } of lights) faded += windowLightAt(r, wp, n, mAt, elAttenuation)[0] * fade(band, dist(j));
    assert.ok(near(windowRowAt(row.rec, [...eye, 1e-3, 1, 1, 1, band], wp, n, mAt, elAttenuation)[0], faded, 1e-5), 'the far cut\'s fade');
  }
  assert.ok(banded > 5, `${banded} points lit by both tiers at once`);
});

test('LIGHT-REACH LR5: THE PASS\'S FAR TIER on a long street - the nearest WL_MAX_LIGHTS tiles stay the near tier\'s; the rows past the near fade\'s start, nearest first, fill the far block to WL_FAR_MAX within WL_FAR_GATHER, in a band of the grid of their own (so the near lights\' lists never crowd them out); the frame\'s two words are the eye and the near cut, the lamp through the glass and the far cut; the far block takes the rows written and its words; the renderer uploads both bands; by day, and in a building\'s frame, no rows and an empty band (mutants: the rows\' filter, the far cap, the band, the words, the lamp\'s gate)', () => {
  const log = [];
  const pass = new WindowLightPass(fakeGl(log), { activeTexture: () => {} });
  pass.addMask('m', crossMask());
  const sub = front(8);
  for (let i = 0; i < 70; i++) {   // seventy fronts in rows 2 m apart down the street, 140 m of it
    const m = identity(); m[14] = -2 * i;
    pass.note({ wl: [{ key: 'm', ap: sub.ap, cells: sub.cells }] }, m, null, 'street', 1000);
  }
  const eye = [0, 2, 0], view = lookAt(eye, [0, 2, -10], [0, 1, 0]), proj = perspective(1.1, 1.6, 0.1, 500), lamp = [1, 0.8, 0.5];
  const run = (now, o = {}) => pass.frame({ kind: 'street', eye, view, proj, now, lamp, glass: () => 'window', ...o });
  for (let f = 0; f < 40; f++) run(1000 + f * 16);   // the cells built over a few frames, the cuts eased
  log.length = 0;
  const all = run(1000 + 40 * 16);
  assert.ok(pass.count >= WL_MAX_LIGHTS - 4, `the near tier full but for what its own list trims (${pass.count})`);
  assert.ok(pass.farCount > 0 && pass.farCount <= WL_FAR_MAX && all === pass.count + pass.farCount, `${pass.farCount} rows`);
  const h = WL_FAR_MAX * WL_VEC4 * 4, F = pass.farData, cut = F[h + 3], cutF = F[h + 7];
  assert.deepEqual(Array.from(F.subarray(h, h + 3)), eye, 'the eye');
  assert.ok(cut > 0 && cut <= WL_GATHER && Array.from(pass._ld.subarray(0, pass.count)).every((d) => d < cut), `the near cut the near lights faded by (${cut})`);
  assert.deepEqual(Array.from(F.subarray(h + 4, h + 7)).map((v) => +v.toFixed(5)), lamp.map((v) => +(v * WL_LAMP_GOBO).toFixed(5)), 'the lamp through the glass');
  assert.ok(cutF > cut && cutF <= WL_FAR_GATHER, `the far cut ${cutF}`);
  assert.ok(pass._farCand.slice(0, pass.farCount).every((c) => c.dMax > cut * WL_FADE_FROM), 'every row has a tile past the near fade\'s start');
  for (let i = 0; i < pass.farCount; i++) {
    const o = i * WL_VEC4 * 4;
    assert.equal(Math.floor((F[o + 23] + 0.5) / 256), WL_KIND.row, 'a row\'s kind');
    assert.ok(pass._fd[i] < cutF && (i === 0 || pass._fd[i] >= pass._fd[i - 1]), 'nearest first, inside the far cut');
    assert.ok(boxVolume(pass.farBoxes, i * LC_BOX) > 0, 'its box');
  }
  // the rows reach past the near tier: the farthest row's nearest tile is twice the near cut and more
  assert.ok(pass._fd[pass.farCount - 1] > 2 * cut, `${pass._fd[pass.farCount - 1]} against ${cut}`);
  // the far band lists the rows; the near band holds the near lights alone
  const far = new Set(pass.farSpace.list.subarray(0, pass.farSpace.total)), nearL = new Set(pass.space.list.subarray(0, pass.space.total));
  assert.ok(far.size > 0 && [...far].every((i) => i < pass.farCount), 'the rows in their own band');
  assert.ok([...nearL].every((i) => i < pass.count), 'the near lights in theirs');
  const ups = log.filter((c) => c[0] === 'bufferSubData');
  assert.ok(ups.some((c) => c[2] === 0 && c[5] === pass.farCount * WL_VEC4 * 4) && ups.some((c) => c[2] === WL_FAR_MAX * WL_VEC4 * 16 && c[4] === h && c[5] === 8), 'the far block: the rows written, and its two words');
  // by day the rooms are dark; in a building's frame the sun comes through, near only
  assert.equal(run(2000, { lamp: null }), 0, 'by day: none');
  assert.equal(pass.farCount, 0);
  assert.equal(pass.farSpace.total, 0, 'and an empty band: no cell lists last night\'s rows');
  pass.note({ wl: [{ key: 'm', ap: sub.ap, cells: sub.cells }] }, identity(), null, 'inside', 2000);
  pass.setOutside({ at: 2000, sunDir: [0, 0.6, -0.8], sunColor: [1, 1, 1], sunScale: 1, moonDir: [0, -1, 0], moonColor: [0, 0, 0], moonScale: 0, sky: [0.4, 0.4, 0.4] });
  pass.frame({ kind: 'inside', eye, view, proj, now: 2000, glass: () => 'glass' });
  assert.equal(pass.farCount, 0, 'no rows indoors');
  assert.ok(WL_FAR_MAX <= 255, 'a list entry is one byte');
  assert.ok((WL_FAR_MAX * WL_VEC4 + 2) * 16 <= 16384, 'the far block fits the 16 KB every WebGL2 block may hold');
  assert.notEqual(WL_FAR_UBO_BINDING, WL_UBO_BINDING);
});

test('LIGHT-REACH LR6: THE SHADER\'S TEXT - both sets\' lit programs hold the far block (its rows and the frame\'s two words), walk the near lights\' band and then the far rows\' own band of the fragment\'s cell, each row by the row\'s walk, which is its twin\'s (mutants: the far band\'s row, its list\'s base, the tile step)', () => {
  const g = windowLightGlsl({ atten: 'elAttenuation(rl, r)' });
  assert.ok(g.includes(`layout(std140) uniform WinFar { vec4 uWinF[${WL_FAR_MAX * WL_VEC4}]; vec4 uWinFrame[2]; };`));
  assert.ok(g.includes(`for (int j = 0; j < ${WL_MAX_LIGHTS}; j++) {`), 'the near band as WL1 walked it');
  assert.ok(g.includes(`highp uvec2 fcell = texelFetch(uClusterGrid, ivec2(tc.x + tc.y * ${CLUSTER_X}, zc + ${WL_FAR_GRID_ROW}), 0).rg;`), 'the far band\'s cell');
  assert.ok(g.includes(`highp int at = ${WL_FAR_LIST_BASE} + int(fcell.x) + j;`) && g.includes('acc += winRow(int(texelFetch(uClusterList,'), 'its list, each a row');
  assert.equal(WL_FAR_GRID_ROW, 2 * WL_GRID_ROW); assert.equal(WL_FAR_LIST_BASE, 2 * WL_LIST_BASE);
  for (const line of [
    'float tt = s / (s - sl);',
    'vec3 w0 = rel * (1.0 - tt) + lr * tt;',
    'float a0 = dot(w0, r1.xyz), stp = (1.0 - tt) / r3.w;',
    'highp int st = (code / WL_P3[j]) % 3;',
    'vec3 ray = r4.xyz + r5.xyz * float(j) - wp;',
    'float wt = (1.0 - clamp((uWinFrame[0].w - dq) / (uWinFrame[0].w * 0.2), 0.0, 1.0)) * clamp((uWinFrame[1].w - dq) / (uWinFrame[1].w * 0.2), 0.0, 1.0);',
    'float dq = length(r0.xyz + r6.xyz + r5.xyz * float(j) - uWinFrame[0].xyz);',
  ]) assert.ok(g.includes(line), line);
  assert.ok(g.includes(`const highp int WL_P3[${WL_ROW_TILES}] = int[${WL_ROW_TILES}](1, 3, 9,`));
  for (const fs of [EL_MESH_FS, EL_TERRAIN_FS, EL_CHAR_FS, EL_DECAL_FS, EL_BB_FS]) assert.ok(fs.includes('uniform WinFar') && fs.includes('winRow('), 'every lane program');
  assert.ok(windowLightGlsl({ clusters: true }).includes('uniform WinFar'), 'and the classic set\'s');
});

test('LIGHT-REACH LR7: THE STREET\'S LANTERNS REACH FARTHER ON THE LANE - half again the [City] prefab\'s 18 (DFU\'s, which the classic set keeps), their flicker scaled with them so a lantern flickers by the same share of its range on either set, and both town hosts build their lanterns\' flicker by it under the lane they installed (mutants: the reach, the classic set\'s range, the variance, the step, a host on the prefab\'s range)', () => {
  assert.equal(CITY_LIGHT_RANGE, 18, 'the prefab\'s');
  assert.equal(STREET_LIGHT_REACH, 1.5);
  assert.equal(streetLightRange(true), 27); assert.equal(streetLightRange(false), 18);
  const lane = streetLanternAnimator(32, true), classic = streetLanternAnimator(32, false), dfu = new CityLightAnimator(32, CITY_LIGHT_RANGE);
  assert.deepEqual([lane.variance, lane.speed, lane.ranges[0]], [1.5, 0.4 * 1.5, 27]);
  assert.deepEqual([classic.variance, classic.speed, classic.ranges[0]], [dfu.variance, dfu.speed, 18], 'the classic set: DFU\'s Animate');
  for (let f = 0; f < 200; f++) { lane.tick(1 / 30); classic.tick(1 / 30); dfu.tick(1 / 30); }
  for (let i = 0; i < 32; i++) {
    assert.ok(near(lane.ranges[i] / 27, classic.ranges[i] / 18, 1e-4), `lantern ${i}: the same share of its range`);
    assert.equal(classic.ranges[i], dfu.ranges[i]);
  }
  assert.match(hostText('src/scenes/world.js'), /const worldLightAnimator = streetLanternAnimator\(4096, lightingOn\);/);
  assert.match(hostText('src/scenes/exterior.js'), /const lightAnimator = streetLanternAnimator\(cityLights\.length, lightingOn\);/);
});

test('LIGHT-REACH LR8 (AUDIT LIGHT-REACH S2): A SURFACE TURNED FROM THE LIGHT TAKES NONE OF IT - the lane\'s lantern loop leaves a light behind the surface before its shadow taps, its glint and its wet glint. Before, an eye grazing the surface from the far side of the lamp saw that lamp\'s glint through it (N.H near 1 there): a leak the skip closes, a change a player sees. And the windows\' reach is half again WL1\'s 8 (mutants: the skip after the shadow, the reach)', () => {
  for (const fs of [EL_MESH_FS, EL_TERRAIN_FS, EL_CHAR_FS, EL_DECAL_FS]) {
    const loop = fs.slice(fs.indexOf('vec3 elPointLitWet('), fs.indexOf('vec3 elPointLit(vec3 wp, vec3 n) {'));
    const at = (t) => loop.indexOf(t);
    const skip = at('if (dot(n, Ln) <= 0.0) continue;'), range = at('if (d >= uPointLights[i].w) continue;'), taps = at('int k = uCasterOf[i];');
    assert.ok(range > 0 && skip > range && taps > skip, 'after the range test, before the caster');
    assert.ok(at('float spec = elSpecLobe(') > skip && at('glint += att * g * wetFresnel(') > skip, 'before the glint and the wet glint');
  }
  // the leak: the lamp in the surface's plane (N.L = 0), the eye 5 degrees over it from the other side - the half
  // vector all but the normal, the glint near its whole strength, at the lane's gain and exposure: a thousand steps
  const th = 5 * Math.PI / 180, h = [1 - Math.cos(th), Math.sin(th)], ndoth = h[1] / Math.hypot(h[0], h[1]);
  const leak = ndoth ** EL_SPEC_GLOSS * EL_SPEC_STRENGTH * EL_LIGHT_GAIN * EL_EXPOSURE;
  assert.ok(ndoth > 0.99 && leak * 12.92 * 255 > 100, `N.H ${ndoth.toFixed(3)}, ${(leak * 12.92 * 255).toFixed(0)} display steps`);
  assert.equal(WL_LAMP_RANGE, 12);
});

/** A recording GL (WL1's): every call logged, programs link, a uniform block has index 0. */
function recordingGl(log) {
  let id = 0;
  return new Proxy({}, {
    get: (o, k) => {
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (p, name) => ({ name, p });
      if (k === 'getUniformBlockIndex') return () => 0;
      if (k === 'getAttribLocation') return () => 0;
      if (typeof k === 'string' && k.startsWith('create')) return () => ({ id: ++id, kind: k });
      if (k === 'getParameter') return () => new Float32Array([0, 0, 0, 0]);
      if (k === 'drawingBufferWidth') return 640;
      if (k === 'drawingBufferHeight') return 400;
      if (k === 'TEXTURE0') return 33984;
      if (typeof k === 'string' && k.toUpperCase() === k) return k;
      return (...args) => { log.push([k, ...args]); };
    },
  });
}

test('LIGHT-REACH LR9: THE RENDERER UPLOADS BOTH WINDOW BANDS - a lit street long enough for far rows puts the near lights\' grid and lists where WL1 put them and the far rows\' at their own band\'s rows and list base, every frame the street is lit (mutants: the far band\'s grid row, its list base)', async () => {
  const { Renderer, WORLD_FRAME } = await import('../../src/render/renderer.js');
  const { windowEmissionRGB } = await import('../../src/render/windowEmission.js');
  const log = [];
  const gl = recordingGl(log);
  const r = new Renderer({ getContext: () => gl, clientWidth: 640, clientHeight: 400, width: 640, height: 400 });
  r.setWindowRooms('full');
  r.setWindowEmission(windowEmissionRGB('night'));
  r.uploadTexture(4001, 0, { width: 64, height: 64, colors: new Uint8Array(64 * 64 * 4).fill(200) }, { opaque: true });
  r.uploadEmissionTexture(4001, 0, crossMask(), { window: true });
  const P = [], N = [], UV = [];
  for (const [a, b] of [[0, 0], [1, 0], [1, 1], [0, 1]]) { P.push(-10 + 20 * a, 5 * b, -10); N.push(0, 0, 1); UV.push(8 * a, 2 * b); }
  const mesh = r.createMesh({ positions: new Float32Array(P), normals: new Float32Array(N), uvs: new Float32Array(UV), indices: new Uint32Array([0, 1, 2, 0, 2, 3]), subMeshes: [{ textureArchive: 4001, textureRecord: 0, startIndex: 0, primitiveCount: 2 }] });
  const proj = perspective(1.1, 1.6, 0.1, 500), view = lookAt([0, 2, 0], [0, 2, -10], [0, 1, 0]);
  const draw = () => { r.beginFrame(proj, view, new Float32Array([0, 1, 0]), WORLD_FRAME); for (let i = 0; i < 70; i++) { const m = identity(); m[14] = -2 * i; r.drawMesh(mesh, m); } };
  for (let f = 0; f < 30; f++) draw();
  log.length = 0;
  draw();
  assert.ok(r._wl.count > 0 && r._wl.farCount > 0, `near ${r._wl.count}, far ${r._wl.farCount}`);
  const grids = log.filter((c) => c[0] === 'texSubImage2D' && c[5] === 144).map((c) => c[4]);
  assert.ok(grids.includes(WL_GRID_ROW) && grids.includes(WL_FAR_GRID_ROW), `the two window bands' grids (rows ${grids})`);
  const lists = log.filter((c) => c[0] === 'texSubImage2D' && c[5] === 256).map((c) => c[4]);
  assert.ok(lists.includes(WL_LIST_BASE / 256) && lists.includes(WL_FAR_LIST_BASE / 256), `and their lists (rows ${lists})`);
});
