// BOLT (2026-09-24, Mac: "Can we do detailed cloud and cloud to ground lighting? Not just when in storms but also
// being able to be seen far away?"): THE LIGHTNING ITSELF - systems/lightning.js (the strike, its strokes, its
// channel, the hosts' store) and render/lightningBolts.js (the channel drawn, never thinner than a line far away).
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  strikeOf, flickerAt, boltPath, createBoltField, createStormLights, strikeColumn, localStrike,
  CG_SHARE, BOLT_LIFE_S, STROKE_DECAY_S, GLOW_DECAY_S, GLOW_SHARE, EARTH_R, FLASH_REACH_M, FLASH_TOWARD_M, FLASH_UP_M, FLASH_RANGE_M, STORM_BASE_M, LOCAL_CG_SHARE,
} from '../src/systems/lightning.js';
import { boltVertices, farOf, BOLT_VS, BOLT_FS, BOLT_STRIDE, BOLT_MAX_SEGS, BOLT_MIN_PX, BOLT_CORE_M, BOLT_HALO } from '../src/render/lightningBolts.js';
import { createDistantStorms } from '../src/systems/distantStorms.js';
import { LightningPlayer } from '../src/world/weather.js';
import { glslFunctions } from './glsl.mjs';
import { perspective } from '../src/world/mat4.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('BOLT the strike: its kind and strokes are its seed\'s - a ground strike two to four strokes, the first the brightest; a flash in the cloud two to five softer pulses; about CG_SHARE of them reach the ground', () => {
  assert.deepEqual(strikeOf(12345), strikeOf(12345), 'the same seed, the same strike - for everyone who sees it');
  let cg = 0;
  const N = 4000;
  for (let s = 1; s <= N; s++) {
    const k = strikeOf(s * 7919);
    const ts = k.strokes.map((x) => x.t);
    assert.deepEqual(ts, [...ts].sort((a, b) => a - b), 'strokes in order');
    assert.equal(ts[0], 0, 'the first stroke is the strike');
    if (k.kind === 'cg') {
      cg++;
      assert.ok(k.strokes.length >= 2 && k.strokes.length <= 4);
      assert.equal(k.strokes[0].peak, 1);
      for (const x of k.strokes.slice(1)) assert.ok(x.peak < 1 && x.peak >= 0.45, 'each re-stroke dimmer than the first');
      assert.ok(ts.at(-1) <= 3 * 0.11 + 1e-9, 'tens of milliseconds apart');
    } else {
      assert.ok(k.strokes.length >= 2 && k.strokes.length <= 5);
      for (const x of k.strokes) assert.ok(x.peak < 0.8, 'softer than a ground stroke');
      assert.ok(ts.at(-1) < BOLT_LIFE_S, 'all within the strike\'s life');
    }
  }
  assert.ok(Math.abs(cg / N - CG_SHARE) < 0.03, `${cg / N} of strikes reach the ground`);
  assert.equal(strikeOf(9, 'cg').kind, 'cg'); assert.equal(strikeOf(9, 'ic').kind, 'ic');
});

test('BOLT the flicker: dark before the strike and past its life, each stroke a peak that falls over STROKE_DECAY_S with a glow over GLOW_DECAY_S, never over 1', () => {
  const k = strikeOf(4242, 'cg');
  assert.equal(flickerAt(k, -0.01), 0); assert.equal(flickerAt(k, BOLT_LIFE_S), 0); assert.equal(flickerAt(k, NaN), 0);
  for (let a = 0; a < BOLT_LIFE_S; a += 0.0037) {
    let want = 0;
    for (const s of k.strokes) if (a >= s.t) want += s.peak * (Math.exp(-(a - s.t) / STROKE_DECAY_S) + GLOW_SHARE * Math.exp(-(a - s.t) / GLOW_DECAY_S));
    assert.ok(Math.abs(flickerAt(k, a) - Math.min(1, want)) < 1e-12);
  }
  for (const s of k.strokes.slice(1)) assert.ok(flickerAt(k, s.t) > flickerAt(k, s.t - 0.001), 'each stroke flashes up again');
  assert.equal(flickerAt(k, 0), 1, 'the first stroke at full');
});

test('BOLT the channel: the main channel runs unbroken from the cloud\'s base to the ground and ends on it exactly; branches split off it, stay between the two and never reach the ground; the same seed, the same channel', () => {
  for (const seed of [1, 77, 4096, 123456789]) {
    const top = [100, 1500, -300], g = 20;
    const p = boltPath(seed, top, g);
    assert.deepEqual(p, boltPath(seed, top, g));
    const main = [], branches = [];
    for (let i = 0; i < p.length; i += 7) (p[i + 6] === 1 ? main : branches).push(Array.from(p.subarray(i, i + 7)));
    assert.deepEqual(main[0].slice(0, 3), top.map((v) => Math.fround(v)), 'from the base');
    for (let i = 1; i < main.length; i++) assert.deepEqual(main[i].slice(0, 3), main[i - 1].slice(3, 6), 'unbroken');
    assert.equal(main.at(-1)[4], g, 'on the ground');
    for (const s of main) { assert.ok(s[4] <= s[1], 'always down'); assert.ok(s[4] >= g); }
    assert.ok(main.length >= 15, `${main.length} steps down 1480 m`);
    assert.ok(branches.length > 0 || seed === 1, 'branches');
    for (const b of branches) {
      assert.ok(b[6] > 0 && b[6] < 1, 'a branch is fainter than the channel');
      assert.ok(b[4] > g && b[1] <= top[1], 'between the base and the ground, never on it');
    }
    // it wanders: the foot is off the base's plumb line, but not by more than the height
    const foot = main.at(-1);
    const off = Math.hypot(foot[3] - top[0], foot[5] - top[2]);
    assert.ok(off > 1 && off < 1480, `the foot ${off.toFixed(0)} m off the plumb`);
  }
});

test('BOLT where a strike stands: the base above the eye and the ground below it, both dropped by the Earth\'s curve at its distance; the storm overhead\'s strikes land near for a crack and far for a roll', () => {
  const c = strikeColumn([0, 50, 0], 30000, 40000, 500, 1.7);
  const drop = (50000 * 50000) / (2 * EARTH_R);
  assert.ok(Math.abs(c.baseY - (50 + 500 - drop)) < 1e-9 && Math.abs(c.groundY - (50 - 1.7 - drop)) < 1e-9);
  assert.ok(drop > 190 && drop < 200, 'two hundred metres down at fifty kilometres');
  let cgNear = 0, cgFar = 0;
  for (let s = 0; s < 3000; s++) {
    const near = localStrike(s, 'thunder'), far = localStrike(s, 'roll');
    assert.ok(near.distance >= 600 && near.distance <= 4000 && far.distance >= 2500 && far.distance <= 8000);
    assert.ok(Math.abs(Math.hypot(near.dx, near.dz) - near.distance) < 1e-6);
    if (near.kind === 'cg') cgNear++; if (far.kind === 'cg') cgFar++;
  }
  assert.ok(Math.abs(cgNear / 3000 - LOCAL_CG_SHARE) < 0.04 && Math.abs(cgFar / 3000 - CG_SHARE / 2) < 0.04, 'a crack mostly to the ground, a roll mostly in the cloud');
  assert.deepEqual(localStrike(5, 'short'), localStrike(5, 'short'));
});

test('BOLT the hosts\' store: a ground strike has a channel and a flash in the cloud has none; a near ground strike lights the land round the eye from its side, less the further off and none past FLASH_REACH_M; each burns its life and goes', () => {
  const f = createBoltField();
  const eye = [0, 0, 0];
  f.add({ x: 1000, z: 0, groundY: 0, baseY: 500, seed: 3, kind: 'cg', strength: 1, at: 10 });
  f.add({ x: 2000, z: 0, groundY: 0, baseY: 500, seed: 4, kind: 'ic', strength: 1, at: 10 });
  let r = f.tick(10, eye);
  assert.equal(r.bolts.length, 1, 'the ground strike\'s channel only');
  assert.ok(r.flash && Math.abs(r.flash.x - FLASH_TOWARD_M) < 1e-9 && r.flash.z === 0 && r.flash.y === FLASH_UP_M && r.flash.range === FLASH_RANGE_M, 'the land round the eye lit from the strike\'s side');
  assert.ok(Math.hypot(r.flash.x, r.flash.y - FLASH_UP_M, r.flash.z) < r.flash.range, 'the eye inside its reach');
  const near = r.flash.color[0];
  const g = createBoltField();
  g.add({ x: 3000, z: 0, groundY: 0, baseY: 500, seed: 3, kind: 'cg', strength: 1, at: 10 });
  assert.ok(g.tick(10, eye).flash.color[0] < near, 'fainter further off');
  const h = createBoltField();
  h.add({ x: FLASH_REACH_M + 10, z: 0, groundY: 0, baseY: 500, seed: 3, kind: 'cg', strength: 1, at: 10 });
  assert.equal(h.tick(10, eye).flash, null, 'past its reach the land is not lit');
  assert.equal(h.tick(10, eye).bolts.length, 1, 'but the channel is seen');
  r = f.tick(10 + BOLT_LIFE_S, eye);
  assert.equal(r.bolts.length, 0); assert.equal(r.flash, null); assert.equal(f.count(), 0, 'gone');
  // a tagged strike replaces its own, so a held test strike is drawn once
  const t = createBoltField();
  for (let i = 0; i < 5; i++) t.add({ x: 1000, z: 0, groundY: 0, baseY: 500, seed: 1, kind: 'cg', at: i, tag: 'test' });
  assert.equal(t.count(), 1);
});

test('BOLT the storm overhead: a strike DFU\'s LightningPlayer throws while its storm is shown lands somewhere; one thrown while it is not is never drawn, and no backlog fires when it is shown again', () => {
  const lp = new LightningPlayer(7);
  const s = createStormLights();
  const eye = [0, 20, 0];
  let seconds = 0, drawnWhileShown = 0, strikesShown = 0;
  for (let f = 0; f < 60 * 120; f++) {
    seconds += 1 / 60;
    const before = lp.strikes;
    lp.tick(1 / 60);
    const shown = seconds < 60;
    const r = s.frame({ seconds, eye, player: lp, shown });
    if (lp.strikes !== before && shown) strikesShown++;
    if (!shown && seconds > 61) assert.equal(r.bolts.length + (r.flash ? 1 : 0), 0, 'not shown, not drawn');
    if (shown) drawnWhileShown += r.bolts.length > 0 || r.flash ? 1 : 0;
  }
  assert.ok(lp.strikes > 4, `${lp.strikes} strikes in two minutes`);
  assert.ok(strikesShown > 0 && drawnWhileShown > 0, 'the storm shown: its strikes land');
  // DFU's schedule itself is untouched: the count rides beside it
  const a = new LightningPlayer(3), b = new LightningPlayer(3);
  for (let f = 0; f < 3000; f++) { a.tick(1 / 60); const on = b.tick(1 / 60); assert.equal(a._on, on === 2); }
});

test('BOLT the distant storms\' strikes: each fired strike lands inside its storm\'s core with its own seed and kind, the same for two schedulers', () => {
  const storm = { type: 'thunder', id: 'thunder:1:2:3:0', x: 20000, z: 0, bornAt: 0, life: 400, env: 1, bands: [[5000, 'thunder'], [8000, 'rain']] };
  const run = () => {
    const ds = createDistantStorms(), out = [];
    for (let f = 0; f < 60 * 400; f++) { const s = f / 60; out.push(...ds.tick({ systems: [storm], at: [0, 0], minutes: 200 + s / 5, seconds: s }).strikes); }
    return out;
  };
  const a = run(), b = run();
  assert.ok(a.length >= 3, `${a.length} strikes`);
  assert.deepEqual(a, b, 'every client the same strikes');
  for (const s of a) {
    assert.ok(Math.hypot(s.x - 20000, s.z) <= 5000 * 0.7 + 1e-6, 'inside the core');
    assert.equal(s.kind, strikeOf(s.seed).kind);
  }
});

test('BOLT drawn: six vertices a segment with the strike\'s brightness times the segment\'s weight, capped; the ribbon never narrower than BOLT_MIN_PX on screen, so a strike thirty kilometres off is still a line; the air thins it by its distance', () => {
  const segs = new Float32Array([0, 100, 0, 0, 0, 0, 1, 0, 100, 0, 10, 50, 0, 0.5]);
  const out = new Float32Array(BOLT_MAX_SEGS * 6 * BOLT_STRIDE);
  assert.equal(boltVertices([{ segs, bright: 0.8 }], out), 12);
  assert.ok(Math.abs(out[8] - 0.8) < 1e-6 && Math.abs(out[6 * BOLT_STRIDE + 8] - 0.4) < 1e-6, 'glow = brightness x weight');
  const many = new Float32Array(7 * (BOLT_MAX_SEGS + 10)).fill(1);
  assert.equal(boltVertices([{ segs: many, bright: 1 }], out), BOLT_MAX_SEGS * 6, 'capped');
  // the vertex shader, run: a vertical channel 30 km off, seen from the origin with a pixel of 1/1000 radian, the far
  // plane 6 km (the world's) - past it the channel is drawn along its sight lines just inside, as wide on the screen
  const uPx = 0.001, FAR = 6000;
  const across = (dist, glow) => {
    const pos = [];
    for (const side of [-1, 1]) {
      const f = glslFunctions(BOLT_VS, { aA: [dist, 0, 0], aB: [dist, 100, 0], aCorner: [0.5, side], aGlow: glow, uVP: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], uEye: [0, 50, 0], uPx, uCore: BOLT_CORE_M, uHalo: BOLT_HALO, uMinPx: BOLT_MIN_PX, uFar: FAR });
      f.main(); pos.push(f.globals.gl_Position);
    }
    const mid = pos[0].map((v, i) => (v + pos[1][i]) / 2), d = Math.hypot(mid[0], mid[1] - 50, mid[2]);
    return { half: Math.hypot(pos[1][0] - pos[0][0], pos[1][1] - pos[0][1], pos[1][2] - pos[0][2]) / BOLT_HALO / 2, d, mid };   // the core's half-width, where it is drawn
  };
  const far = across(30000, 1);
  assert.ok(far.d <= FAR * 0.97 + 1e-6, `drawn inside the far plane (${far.d.toFixed(0)} m)`);
  assert.ok(Math.abs(Math.atan2(far.mid[1] - 50, far.mid[0]) - Math.atan2(0, 30000)) < 1e-9, 'on its own sight line');
  assert.ok(far.half / (far.d * uPx) >= BOLT_MIN_PX - 1e-6, `the core ${(far.half / (far.d * uPx)).toFixed(2)} px at thirty kilometres`);
  const near = across(200, 1);
  assert.ok(Math.abs(near.half - BOLT_CORE_M) < 1e-6 && Math.abs(near.d - 200) < 1e-6, 'near, its true width where it is');
  assert.ok(Math.abs(farOf(perspective(1, 1, 0.2, 6000)) / 6000 - 1) < 1e-3, 'the far plane read off the matrix (a Float32 matrix: to 0.1%; the shader keeps 3% inside it)');
  // the fragment shader: the core's light at the centre, less off it, and the air's toll with distance
  const fs = (across, dist) => { const f = glslFunctions(BOLT_FS, { vAcross: across, vGlow: 1, vDist: dist, vThin: 1, uColor: [1, 1, 1], uSeen: 45000 }); f.main(); return f.globals.o[0]; };
  assert.ok(Math.abs(fs(0, 0) - 1.25) < 1e-9);
  assert.ok(fs(1, 0) < fs(0, 0) && fs(3, 0) < fs(1, 0));
  assert.ok(Math.abs(fs(0, 45000) / fs(0, 0) - Math.exp(-1)) < 1e-9, 'e-fold over BOLT_SEEN_M');
});

test('BOLT wired: both exterior hosts feed their distant strikes and the storm overhead into one store, draw its channels after the world, light the land from a near strike when the mod has no flash of its own (under the mod too - it draws no channel), and forget them on a jump', () => {
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = rd(host);
    assert.match(s, /const stormLights = createStormLights\(\);/);
    assert.match(s, /const boltsGl = sky\.enhanced \? new LightningBoltsRenderer\(renderer\.gl\) : null;/);
    assert.match(s, /for \(const s of ds\.strikes\) \{ const h = [^;]+; struckFar\.push\(\{ x: h\[0\], z: h\[1\], seed: s\.seed, kind: s\.kind, strength: s\.strength \}\); \}/);
    assert.match(s, /boltFrame = isEnhanced\(\)[^\n]*\n\s*\? stormLights\.frame\(\{ seconds: now \/ 1000, eye[^,]*, distant: struckFar, player: lightning, shown: !!lightningShown, test: Number\(params\.get\('bolttest'\)\) \|\| 0 \}\)/);
    assert.match(s, /renderer\.setFlashLight\(sky\.lightningLight\(\) \?\? boltFrame\.flash\);/);
    assert.match(s, /\{ distantStorms\.reset\(\); stormLights\.reset\(\); \}/);
    // RETRO1: with the world image's height, so a retro frame's minimum width is its own pixels
    assert.match(s, /if \(boltsGl && boltFrame\.bolts\.length(?: && !_dwAirOff)?\) \{[^\n]*\n\s*boltsGl\.draw\(boltFrame\.bolts, proj, view, new Float32Array\([^)]+\), undefined, renderer\.worldViewportPx\?\.\[3\]\);[^\n]*\n\s*renderer\.markForeignPass\(\);/);
    // the strikes stand round, and the ribbons face, THE EYE THE VIEW IS BUILT FROM - world.js's third-person camera
    // stands metres off the head (cam.pos), and a probe's unspawned body put it a kilometre off
    const viewEye = s.match(/const view = betterAmbience\.view\(lookAt\(([\w.]+),/)[1];
    const esc = viewEye.replace(/\./g, '\\.');
    assert.match(s, new RegExp(`stormLights\\.frame\\(\\{ seconds: now / 1000, eye${viewEye === 'eye' ? '' : `: ${esc}`}, distant`), host);
    assert.match(s, new RegExp(`boltsGl\\.draw\\(boltFrame\\.bolts, proj, view, new Float32Array\\(${esc}\\)[,)]`), host);
  }
  assert.equal(STORM_BASE_M, 500, 'the thunder profile\'s base');
  assert.match(rd('src/render/volumetricClouds.js'), /thunder: {2}Object\.freeze\(\{ base: 500,/);
});
