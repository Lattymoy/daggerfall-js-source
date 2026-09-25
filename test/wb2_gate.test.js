// WB2 (2026-09-25, Mac: "A gate model would be spawned with a timer that leads to a completely different area, a gate
// of oblivion"): THE GATE IN THE WORLD - its stone (world/gateModel.js), its art (world/gateArt.js), its fire and beacon
// (render/gatePass.js), the pool the world host stands it with (scenes/gatePool.js), the banner, the activation race
// and the world host's seams. Design: bible/11-Multiplayer/World-Bosses.md section 3.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildGateModel, gateArchProfile, GATE_ARCHIVE, GATE_STONE_RECORD, GATE_PLINTH_RECORD, GATE_HEIGHT, HORN_SPINE, HORN_ROOT_R,
  ARCH_Y0, ARCH_Y1, ARCH_PROFILE_N, PLINTH_R, RIM_SPIRE_ANGLES, PLINTH_H, PLINTH_STEP_H, PORTAL_CENTRE_Y, GATE_PART,
} from '../src/world/gateModel.js';
import { gateStoneArt, gatePlinthArt, gateArt, GATE_ART_SIZE, VEIN_HEART, RUNE_GLOW } from '../src/world/gateArt.js';
import {
  GatePassRenderer, GATE_CLOCK_PERIOD, gateClock, MEMBRANE_TURN_SEALED_HZ, MEMBRANE_TURN_OPEN_HZ, MEMBRANE_FLOW_HZ, BEACON_CLIMB_HZ,
  GATE_PASS_MAX, MEMBRANE_VS, MEMBRANE_FS, BEACON_VS, BEACON_FS, BEACON_START_M, BEACON_WIDEN, membraneVertices, beaconVertices,
} from '../src/render/gatePass.js';
import { createGatePool, gatePlacement, gateLocal, openingHalfWidth, fireBox, GATE_BUCKET, GATE_TEXT, GATE_SAY_MS, GATE_BANNER_M } from '../src/scenes/gatePool.js';
import { raceActivation, raceWinner } from '../src/player/activationRace.js';
import { gateTimes, gateYaw, countdownText, GATE_RISE_MS, GATE_COLLAPSE_MS } from '../src/net/gateLaw.js';
import { trs } from '../src/world/mat4.js';
import { drawGateBanner, destroyGateBanner } from '../src/ui/gateBanner.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('WB2 the stone: renderer.createMesh\'s own shape, flat-shaded, two textures of the gate\'s pseudo-archive, the height it claims', () => {
  const m = buildGateModel();
  const n = m.positions.length / 3;
  assert.equal(m.normals.length, n * 3); assert.equal(m.uvs.length, n * 2); assert.equal(m.indices.length, n);
  assert.equal(n % 3, 0, 'whole triangles');
  assert.ok(n / 3 > 600 && n / 3 < 4000, `a gate, not a cube and not a city (${n / 3} triangles)`);
  // the sub-meshes partition the index list, one per texture, all the gate's own archive
  assert.deepEqual(m.subMeshes.map((s) => s.textureRecord), [GATE_STONE_RECORD, GATE_PLINTH_RECORD]);
  assert.ok(m.subMeshes.every((s) => s.textureArchive === GATE_ARCHIVE && GATE_ARCHIVE > 38000), 'far above any classic archive (bloodArt\'s law)');
  let at = 0;
  for (const s of m.subMeshes) { assert.equal(s.startIndex, at); at += s.primitiveCount * 3; }
  assert.equal(at, n, 'every triangle in exactly one sub-mesh');
  // flat shading: a face's three normals are one
  for (let i = 0; i < n; i += 3) for (let k = 0; k < 3; k++) assert.equal(m.normals[i * 3 + k], m.normals[(i + 2) * 3 + k]);
  let top = -Infinity;
  for (let i = 1; i < m.positions.length; i += 3) top = Math.max(top, m.positions[i]);
  assert.ok(top > GATE_HEIGHT - 1.2 && top <= GATE_HEIGHT + 0.5, `its crown at ${top.toFixed(2)} near GATE_HEIGHT`);
  assert.equal(m.triangles, m.positions, 'the collider takes the same triangles');
});

test('WB2 the stone faces out: every horn face away from its spine, every plinth side from its axis, every top up', () => {
  const m = buildGateModel(), P = m.positions;
  const spine = [];
  for (let i = 0; i <= 600; i++) {
    const t = i / 600, u = 1 - t, p = HORN_SPINE;
    const x = u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0];
    const y = u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1];
    spine.push([x, y, 0, t], [-x, y, 0, t]);
  }
  let horn = 0, spikes = 0, spikeRun = 0, bad = [];
  for (let i = 0; i < P.length; i += 9) {
    const a = [P[i], P[i + 1], P[i + 2]], b = [P[i + 3], P[i + 4], P[i + 5]], c = [P[i + 6], P[i + 7], P[i + 8]];
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const nrm = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const cen = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    const top = PLINTH_H + PLINTH_STEP_H;
    if (cen[1] <= top + 1e-6 && Math.abs(nrm[1]) < 1e-9) { if (nrm[0] * cen[0] + nrm[2] * cen[2] <= 0) bad.push(['plinth side', cen]); continue; }
    if (cen[1] <= top + 1e-6 && Math.abs(nrm[0]) < 1e-9 && Math.abs(nrm[2]) < 1e-9) { if (nrm[1] <= 0) bad.push(['plinth top', cen]); continue; }
    const part = m.parts[i / 9];
    if (part === GATE_PART.Spike) {   // a spike against its own axis: spike() lays four faces a spike, one after another
      const f0 = (i / 9) - (spikeRun % 4);
      spikeRun++;
      spikes++;
      // the four faces' corners: the tip is the one they share; the base centre the mean of the rest
      const corners = [];
      for (let q = 0; q < 4; q++) for (let v = 0; v < 3; v++) corners.push([P[(f0 + q) * 9 + v * 3], P[(f0 + q) * 9 + v * 3 + 1], P[(f0 + q) * 9 + v * 3 + 2]]);
      const key = (v) => v.map((x) => x.toFixed(5)).join();
      const count = new Map();
      for (const v of corners) count.set(key(v), (count.get(key(v)) ?? 0) + 1);
      const tip = corners.find((v) => count.get(key(v)) === 4);
      const base = corners.filter((v) => count.get(key(v)) !== 4);
      const B = [0, 1, 2].map((k) => base.reduce((acc, v) => acc + v[k], 0) / base.length);
      const ax = [tip[0] - B[0], tip[1] - B[1], tip[2] - B[2]];
      const al = Math.hypot(...ax), u = ax.map((x) => x / al);
      const w = [cen[0] - B[0], cen[1] - B[1], cen[2] - B[2]];
      const along = w[0] * u[0] + w[1] * u[1] + w[2] * u[2];
      const off = [w[0] - u[0] * along, w[1] - u[1] * along, w[2] - u[2] * along];   // away from the axis
      if (nrm[0] * off[0] + nrm[1] * off[1] + nrm[2] * off[2] <= 0) bad.push(['spike', cen]);
      continue;
    }
    spikeRun = 0;
    let best = null, bd = Infinity;
    for (const s of spine) { const d = Math.hypot(s[0] - cen[0], s[1] - cen[1], s[2] - cen[2]); if (d < bd) { bd = d; best = s; } }
    if (best[3] > 0.96) continue;   // the tip's cap, converging past the spine's end
    horn++;
    const out = [cen[0] - best[0], cen[1] - best[1], cen[2] - best[2]];
    if (nrm[0] * out[0] + nrm[1] * out[1] + nrm[2] * out[2] <= 0) bad.push(['horn', cen]);
  }
  assert.ok(horn > 700, `the horns' faces were measured (${horn})`);
  assert.ok(spikes > 60, `and the spikes counted apart (${spikes})`);
  assert.deepEqual(bad.slice(0, 3), [], `${bad.length} faces face in`);
});

test('WB2 the way in is clear: nothing of the stone stands in the walk through the fire, and the fire\'s opening fits a body', () => {
  const m = buildGateModel(), P = m.positions;
  // the corridor through the portal: a metre and a half either side of the centre, from the step to head height, any depth
  for (let i = 0; i < P.length; i += 3) {
    const [x, y] = [P[i], P[i + 1]];
    assert.ok(!(Math.abs(x) < 1.5 && y > PLINTH_H + PLINTH_STEP_H + 0.01 && y < 2.4), `a vertex in the way in at (${x.toFixed(2)}, ${y.toFixed(2)}, ${P[i + 2].toFixed(2)})`);
  }
  // no rim spire stands within fifty degrees of either way in (+z, -z)
  for (const deg of RIM_SPIRE_ANGLES) {
    const off = Math.min(Math.abs(((deg - 90) % 360 + 540) % 360 - 180), Math.abs(((deg - 270) % 360 + 540) % 360 - 180));
    assert.ok(off >= 50, `a rim spire at ${deg} degrees stands in a way in`);
  }
  const prof = gateArchProfile(m);
  assert.equal(prof.length, ARCH_PROFILE_N);
  assert.ok(prof.every((w) => w >= 0));
  assert.ok(openingHalfWidth(prof, 1.2) > 2.2 && openingHalfWidth(prof, 2) > 2.2, 'a body walks through with room either side');
  assert.ok(prof[ARCH_PROFILE_N - 1] < prof[Math.floor(ARCH_PROFILE_N / 2)], 'the arch closes toward its crown');
  // the measured opening never overlaps the stone: at each height every horn vertex stands outside it
  for (let i = 0; i < P.length; i += 3) {
    const y = P[i + 1];
    if (y <= ARCH_Y0 + 0.2 || y > ARCH_Y1 || Math.abs(P[i + 2]) > 1.2) continue;   // the horns' inner skin either side of the fire's plane
    assert.ok(Math.abs(P[i]) >= openingHalfWidth(prof, y) - 0.06, `the fire overlaps stone at y ${y.toFixed(2)}`);
  }
  assert.equal(openingHalfWidth(prof, ARCH_Y0 - 1), 0);
  assert.equal(openingHalfWidth(prof, ARCH_Y1 + 1), 0);
});

test('WB2 the art: sixty-four texels square, the same stone for every client, fire only in the veins and the runes', () => {
  const s = gateStoneArt(), p = gatePlinthArt();
  for (const a of [s, p]) {
    for (const img of [a.albedo, a.emission]) { assert.equal(img.width, GATE_ART_SIZE); assert.equal(img.height, GATE_ART_SIZE); assert.equal(img.colors.length, GATE_ART_SIZE * GATE_ART_SIZE * 4); }
  }
  assert.deepEqual(gateStoneArt().albedo.colors, s.albedo.colors, 'deterministic');
  const lit = (img) => { let n = 0; for (let i = 0; i < img.colors.length; i += 4) if (img.colors[i] || img.colors[i + 1] || img.colors[i + 2]) n++; return n; };
  const veins = lit(s.emission), runes = lit(p.emission);
  assert.ok(veins > 80 && veins < GATE_ART_SIZE * GATE_ART_SIZE * 0.35, `veins, not a wall of fire (${veins})`);
  assert.ok(runes > 40 && runes < GATE_ART_SIZE * GATE_ART_SIZE * 0.2, `a ring of runes (${runes})`);
  // wherever the emission burns the albedo is the fire's own colour; the stone itself stays dark
  let darkest = 255;
  for (let i = 0; i < s.albedo.colors.length; i += 4) if (!s.emission.colors[i]) darkest = Math.min(darkest, s.albedo.colors[i]);
  assert.ok(darkest < 40, 'the basalt is near black');
  const heart = (img, rgb) => { for (let i = 0; i < img.colors.length; i += 4) if (img.colors[i] === rgb[0] && img.colors[i + 1] === rgb[1] && img.colors[i + 2] === rgb[2]) return true; return false; };
  assert.ok(heart(s.emission, VEIN_HEART) && heart(p.emission, RUNE_GLOW));
  assert.deepEqual(gateArt().map(([rec]) => rec), [GATE_STONE_RECORD, GATE_PLINTH_RECORD]);
});

test('WB2 the fire and the beacon: every rate whole cycles over the clock, the membrane masked to the arch, the beacon never a hair', () => {
  for (const hz of [MEMBRANE_TURN_SEALED_HZ, MEMBRANE_TURN_OPEN_HZ, MEMBRANE_FLOW_HZ, BEACON_CLIMB_HZ]) {
    assert.ok(Math.abs(hz * GATE_CLOCK_PERIOD - Math.round(hz * GATE_CLOCK_PERIOD)) < 1e-9, `${hz} Hz is whole cycles over ${GATE_CLOCK_PERIOD} s`);
  }
  assert.equal(gateClock(GATE_CLOCK_PERIOD + 3), 3);
  assert.equal(gateClock(-1), GATE_CLOCK_PERIOD - 1);
  assert.match(MEMBRANE_FS, /uniform float uProfile\[24\];/, 'the arch\'s own opening');
  assert.match(MEMBRANE_FS, /if \(inside <= 0\.0\) discard;/, 'nothing drawn over the stone');
  assert.doesNotMatch(MEMBRANE_FS, /atan\(/, 'no branch cut to stand in the fire as a seam');
  assert.match(MEMBRANE_VS, /vec3 p = uOrigin \+ vec3\(aXY\.x \* c, aXY\.y, -aXY\.x \* s\);/, 'turned as trs turns the stone');
  assert.match(BEACON_VS, /float rad = max\(uRadius, length\(uEye\.xz - uOrigin\.xz\) \* /, 'the beacon widens with its distance');
  assert.ok(BEACON_WIDEN > 0 && BEACON_START_M >= GATE_HEIGHT - 2, 'and leaves the gate from its crown');
  assert.match(BEACON_FS, /max\(fogFactorAt\(vWorld\), /, 'the fog thins it and never takes it');
  // the membrane's quad turned by the VS equals the stone's matrix turned by trs - one frame for the fire and the stone
  const yaw = 1.1, c = Math.cos(yaw), s = Math.sin(yaw);
  const M = trs(10, 2, -5, 0, (yaw * 180) / Math.PI, 0);
  for (const [x, y] of [[3, 1], [-2.5, 9]]) {
    const vs = [10 + x * c, 2 + y, -5 - x * s];
    const tr = [M[0] * x + M[4] * y + M[12], M[1] * x + M[5] * y + M[13], M[2] * x + M[6] * y + M[14]];
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(vs[k] - tr[k]) < 1e-5, 'the fire hangs in the stone\'s own frame');   // trs answers a Float32Array
  }
  assert.equal(membraneVertices().length, 12);
  assert.equal(beaconVertices(8).length, 8 * 12);
});

function fakeGl() {
  const calls = [];
  const gl = new Proxy({ VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TRIANGLES: 8, BLEND: 9, ONE: 10, CULL_FACE: 11, ONE_MINUS_SRC_ALPHA: 12 }, {
    get(t, k) {
      if (k in t) return t[k];
      return (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; };
    },
  });
  return { gl, calls };
}

test('WB2 the pass: beacons added, fires premultiplied, faded gates skipped and capped, no depth written, the state put back', () => {
  const { gl, calls } = fakeGl();
  const pass = new GatePassRenderer(gl, gateArchProfile());
  calls.length = 0;
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  pass.draw([], I, I, [0, 0, 0], 1);
  assert.equal(calls.length, 0, 'nothing to draw, nothing touched');
  const g = (fade, x = 0) => ({ origin: [x, 0, 0], yaw: 0.3, open: 1, fade });
  pass.draw([g(0, 5), g(1), g(0.5, 30), g(1, 60)], I, I, [0, 0, 0], 12.5);
  assert.ok(!calls.some((c) => c[0] === 'uniform3f' && c[2] === 5), 'the faded gate is not the one drawn - it is skipped before the cap');
  const draws = calls.filter((c) => c[0] === 'drawArrays');
  assert.equal(draws.length, GATE_PASS_MAX * 2, 'a beacon and a fire each, the faded skipped, the rest capped');
  assert.equal(pass.drawn, GATE_PASS_MAX);
  assert.deepEqual(calls.filter((c) => c[0] === 'blendFunc').map((c) => c.slice(1)), [[gl.ONE, gl.ONE], [gl.ONE, gl.ONE_MINUS_SRC_ALPHA]], 'the beacon added; the fire premultiplied, so it hides what stands behind it');
  assert.deepEqual(calls.filter((c) => c[0] === 'depthMask').map((c) => c[1]), [false, true], 'no depth written, and the mask put back');
  const names = calls.map((c) => c[0]);
  assert.ok(names.lastIndexOf('enable') > names.lastIndexOf('drawArrays'), 'culling back on after');
  assert.ok(calls.some((c) => c[0] === 'disable' && c[1] === gl.BLEND) && names.lastIndexOf('disable') > names.lastIndexOf('drawArrays'), 'blending off after');
  assert.ok(calls.some((c) => c[0] === 'uniform1fv' && c[1] === 'uProfile' && c[2].length === ARCH_PROFILE_N), 'the arch\'s opening handed over');
});

/** A world the pool can stand a gate in: a pixel translation, a flat ground, a feet, a collider and a clock. */
function world({ day = 700, ground = 12, feet = null, ready = false } = {}) {
  const t = gateTimes(day);
  const clock = { now: t.riseAt - 1000 };
  const said = [], banners = [], entered = [], col = { adds: [], removes: 0 };
  const shift = { x: 0 };
  const g = { day, px: 400, py: 200, spot: [409.6, 409.6], t, fellAt: null, near: 'Copperham' };
  const pool = createGatePool({
    renderer: null, gl: null,
    collider: () => ({ addMesh: (k, p, i, m) => col.adds.push([k, Array.from(m)]), removeBucket: () => { col.removes++; } }),
    standing: () => ({ ...g, phase: clock.now < t.riseAt ? 'omen' : clock.now < t.riseAt + GATE_RISE_MS ? 'rising' : clock.now < t.openAt ? 'sealed' : clock.now < t.sealAt ? 'open' : 'closed' }),
    pixelTranslation: () => [shift.x, 0, 0],
    heightAt: (x) => (x > 1e6 ? -Infinity : ground),
    now: () => clock.now,
    feet: () => feet?.(),
    say: (s) => said.push(s), banner: (s) => banners.push(s), ready: () => ready, enter: (x) => entered.push(x),
  });
  return { t, clock, pool, said, banners, entered, col, shift, g };
}

test('WB2 the pool: stood where the omen says on the ground, heaving up out of it, its collider only once risen and again when the world moves', () => {
  const w = world();
  assert.equal(w.pool.frame(0.016), null, 'the omen marks the land; nothing stands yet');
  w.clock.now = w.t.riseAt + GATE_RISE_MS / 2;
  const half = w.pool.frame(0.016);
  assert.deepEqual([half.origin[0], half.origin[2]], [409.6, 409.6], 'the spot on its pixel, in the scene');
  assert.ok(half.origin[1] < 12 && half.origin[1] > 12 - GATE_HEIGHT, 'half out of the ground');
  assert.equal(half.yaw, gateYaw(700), 'turned by the day, alike for everyone');
  assert.ok(half.fade > 0.4 && half.fade < 0.6);
  assert.equal(w.col.adds.length, 0, 'no collider while it rises');
  w.clock.now = w.t.riseAt + GATE_RISE_MS;
  const up = w.pool.frame(0.016);
  assert.equal(up.origin[1], 12);
  assert.equal(w.col.adds.length, 1, 'the stone stands in the collider once risen');
  assert.equal(w.col.adds[0][0], GATE_BUCKET);
  w.pool.frame(0.016);
  assert.equal(w.col.adds.length, 1, 'and is not stood again while nothing moves');
  w.shift.x = 50;   // a floating-origin recentre: the pixel's translation moved
  const moved = w.pool.frame(0.016);
  assert.equal(moved.origin[0], 459.6);
  assert.equal(w.col.adds.length, 2, 'stood again where the world put it');
  assert.equal(w.pool.lights().length, 1);
  // a pixel not yet built stands nowhere
  w.shift.x = 2e6;
  assert.equal(w.pool.frame(0.016), null);
});

test('WB2 the pool: the collapse sinks it and takes its collider; the placement law pure', () => {
  const t = gateTimes(710);
  const g = { day: 710, px: 1, py: 1, spot: [0, 0], t, fellAt: t.openAt + 60_000 };
  const at = (now) => gatePlacement(g, { pixelTranslation: () => [0, 0, 0], heightAt: () => 5, now });
  assert.equal(at(t.openAt + 59_000).phase, 'open');
  const sinking = at(t.openAt + 60_000 + GATE_COLLAPSE_MS / 2);
  assert.equal(sinking.phase, 'collapsing');
  assert.ok(sinking.origin[1] < 5 && !sinking.risen && sinking.fade < 0.6);
  assert.equal(at(t.openAt + 60_000 + GATE_COLLAPSE_MS), null, 'gone');
  const w = world({ day: 711 });
  w.clock.now = w.t.openAt;
  w.pool.frame(0.016);
  assert.equal(w.pool.state().collider, true);
  w.pool.destroyAll();
  assert.equal(w.pool.state().collider, false, 'a transition takes the stone out of the collider');
  // the box the eye strikes is the FIRE's, not the stone's: a player on the plinth stands outside it
  const place = w.pool.frame(0.016);
  const box = fireBox(place, gateArchProfile());
  assert.ok(Math.abs(box.max[1] - box.min[1] - (ARCH_Y1 - ARCH_Y0)) < 1e-9, 'the fire\'s height');
  const onPlinth = [place.origin[0] + Math.cos(place.yaw) * 0 + Math.sin(place.yaw) * 4, place.origin[1] + 1, place.origin[2] + Math.cos(place.yaw) * 4];
  const inside = onPlinth.every((v, k) => v >= box.min[k] && v <= box.max[k]);
  assert.ok(!inside || PLINTH_R < 4, 'four metres before the fire on the plinth is not inside its box');
});

test('WB2 the door: sealed says when, open without a relay says not yet, open with one enters; said once a while', () => {
  const w = world({ day: 720 });
  w.clock.now = w.t.riseAt + GATE_RISE_MS + 1000;
  w.pool.frame(0.016);
  assert.equal(w.pool.activate('gate:720'), false);
  assert.deepEqual(w.said, [GATE_TEXT.opensIn(countdownText(w.t.openAt - w.clock.now))]);
  w.pool.activate('gate:720');
  assert.equal(w.said.length, 1, 'not again inside GATE_SAY_MS');
  w.clock.now = w.t.openAt + 1000;
  w.pool.frame(0.016);
  w.clock.now += GATE_SAY_MS;
  assert.equal(w.pool.activate('gate:720'), false);
  assert.equal(w.said[1], GATE_TEXT.notYet, 'a relay that cannot hold the arena: not yet');
  assert.equal(w.entered.length, 0);
  assert.equal(w.pool.activate('camp:1'), false, 'another key is not the gate\'s');
  const r = world({ day: 721, ready: true });
  r.clock.now = r.t.openAt + 1000;
  r.pool.frame(0.016);
  assert.equal(r.pool.activate('gate:721'), true);
  assert.deepEqual({ day: r.entered[0].day, near: r.entered[0].near }, { day: 721, near: 'Copperham' });
  assert.equal(r.pool.activate('camp:9'), false, 'a press on another key is never the gate\'s door');
  assert.equal(r.entered.length, 1);
  // the plaque names it with its countdown
  assert.equal(r.pool.hoverName('gate:721'), `Oblivion Gate (seals in ${countdownText(r.t.sealAt - r.clock.now)})`);
  assert.equal(r.pool.hoverName(7), null, 'a door\'s bare number is not the gate\'s (AUDIT-WH C1)');
});

test('WB2 the walk through: a step across the fire inside its opening enters; beside the horns it does not; the banner near it alone', () => {
  let feet = null;
  const w = world({ day: 730, ready: true, feet: () => feet });
  w.clock.now = w.t.openAt + 1000;
  const place = w.pool.frame(0.016);
  const at = (lx, lz) => { const c = Math.cos(place.yaw), s = Math.sin(place.yaw); return [place.origin[0] + c * lx + s * lz, place.origin[1] + PLINTH_H + PLINTH_STEP_H, place.origin[2] - s * lx + c * lz]; };
  for (const [lx, lz] of [[0, 1], [0, 0.4], [0, -0.4]]) { feet = at(lx, lz); w.pool.frame(0.016); }
  assert.equal(w.entered.length, 1, 'walked through the fire');
  assert.ok(Math.abs(gateLocal(place, at(1.2, -0.7))[0] - 1.2) < 1e-9 && Math.abs(gateLocal(place, at(1.2, -0.7))[2] + 0.7) < 1e-9, 'the gate\'s frame undone exactly');
  const w2 = world({ day: 731, ready: true, feet: () => feet });
  w2.clock.now = w2.t.openAt + 1000;
  const p2 = w2.pool.frame(0.016);
  const at2 = (lx, lz) => { const c = Math.cos(p2.yaw), s = Math.sin(p2.yaw); return [p2.origin[0] + c * lx + s * lz, p2.origin[1] + 1, p2.origin[2] - s * lx + c * lz]; };
  for (const [lx, lz] of [[7, 1], [7, -1]]) { feet = at2(lx, lz); w2.pool.frame(0.016); }
  assert.equal(w2.entered.length, 0, 'past the horns, not through the fire');
  assert.ok(w2.banners.at(-1)?.startsWith('Oblivion Gate - seals in'), 'near it, the countdown stands over the screen');
  feet = [p2.origin[0] + GATE_BANNER_M + 5, p2.origin[1], p2.origin[2]];
  w2.pool.frame(0.016);
  assert.equal(w2.banners.at(-1), null, 'and not from afar');
});

test('WB2 the race: the gate\'s fire takes a press it is nearest for, heads the tie order, and the plaque names what the press opens', () => {
  const p = (key, distance) => ({ key, distance, reach: 4 });
  assert.equal(raceActivation({ gate: p('gate:1', 3) }).gateWins, true);
  assert.equal(raceActivation({ gate: p('gate:1', 3), doorDistance: 2 }).gateWins, false, 'a nearer door takes it');
  assert.equal(raceActivation({ gate: p('gate:1', 2), camp: p('camp:1', 2) }).gateWins, true, 'at a tie the gate');
  assert.equal(raceWinner({ gate: p('gate:1', 2), camp: p('camp:1', 2), corpse: p('body', 2) }).key, 'gate:1');
  assert.equal(raceActivation({}).gateWins, false);
});

test('WB2 the banner: a readout that is written only when its words change and hides rather than leaves', () => {
  destroyGateBanner();
  const made = [];
  const doc = { createElement: () => { const n = { style: {}, remove() {}, set textContent(v) { this._t = v; made.push(v); }, get textContent() { return this._t; } }; return n; }, body: { append() {} } };
  drawGateBanner(null, { doc });
  assert.equal(made.length, 0, 'nothing to say, nothing made');
  drawGateBanner('Oblivion Gate - opens in 1:00', { doc });
  drawGateBanner('Oblivion Gate - opens in 1:00', { doc });
  assert.deepEqual(made, ['Oblivion Gate - opens in 1:00'], 'the same words, not written again');
  drawGateBanner('Oblivion Gate - opens in 0:59', { doc, hidden: true });
  assert.deepEqual(made, ['Oblivion Gate - opens in 1:00', ''], 'the HUD hidden takes it with it');
  destroyGateBanner();
});

test('WB2 the seams: online alone, stood before the lights, the stone in the world pass, the fire after the duel wall, the press and the plaque', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /const gatePool = gateOmen \? createGatePool\(\{/, 'the omen\'s own gate - online alone');
  assert.match(w, /ready: \(\) => !!online\?\.gateOk,   \/\/ WB3b/, 'the door opens at a relay that runs a gate\'s boss room (WB3b; it said "not yet" to every relay until then)');
  const frameAt = w.indexOf('try { if (gatePool?.frame(dt)) warmGateVeil(); }'), lightsAt = w.indexOf('const wodLit = wod ? _wodLitCount() : 0;');   // AUDIT WB D5: and the step's veil warmed when a gate stands
  assert.ok(frameAt > 0 && frameAt < lightsAt, 'stood before the lights read it');
  assert.equal((w.match(/\.\.\.\(gatePool\?\.lights\(\) \?\? \[\]\), \.\.\.camps\.lights\(\), \.\.\.droppedTorches\.lights\(\)\);/g) ?? []).length, 2, 'its fire lights the ground by night and by day - after the hand lights, before the camps and the dropped torches the renderer\'s cap cuts first');
  assert.match(w, /gatePool\?\.draw\(renderer\);[^\n]*\n\s*camps\.draw\(renderer\);/, 'the stone in the world pass beside the tents (before them: the tents and the wagon keep their HCC pair)');
  const duel = w.indexOf('duelWall.draw(rings'), pass = w.indexOf('gatePool.drawPass(proj, view');
  assert.ok(duel > 0 && pass > duel, 'the fire after the duel wall');
  assert.match(w, /if \(_race\.gateWins\) \{ if \(_gatePick\.distance > _gatePick\.reach\) setMidScreenText\(TOO_FAR_AWAY_TEXT\); else gatePool\.activate\(_gatePick\.key\); \}/, 'the press\'s arm, refusing out loud past its reach');
  assert.match(w, /gate: _gatePick,   \/\/ WB2/);
  assert.match(w, /gate: gatePool \? pickActivatableHit\(cam\.pos, _hd, gatePool\.targets\(\), collider\) : null,/, 'the plaque races it too');
  assert.match(w, /\(key\) => gatePool\?\.hoverName\(key\) \?\? null,/);
  assert.match(w, /if \(gatePool && \(modes\?\.mode \?\? 'exterior'\) !== 'exterior'\) drawGateBanner\(null\);/, 'the countdown leaves with the street');
  assert.match(read('src/player/activationRace.js'), /firmFirst\(\[gate, camp, water,/, 'the gate heads the tie order');
  assert.ok(PORTAL_CENTRE_Y > ARCH_Y0 && PORTAL_CENTRE_Y < ARCH_Y1);
});
