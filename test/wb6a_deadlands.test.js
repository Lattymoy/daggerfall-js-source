// WB6a (2026-09-25, Mac, having walked the Burning Court: "the transition and the arena needs to be an oblivion
// masterpiece ... the outside bounds arent a perfect square, maybe somehow introduce distant skybox design or some
// other ambient detail. Whole thing needs to feel alive"): THE DEADLANDS' SKY AND SEA, DRIVEN. The clock and every
// rate whole over it; the lightning; the sea's disc (up-facing, inside the far plane from anywhere on the court, its rim
// the sky's own horizon); the sky's rays; the court's own light; the pass over a fake GL (the sea solid, the sky at the
// far plane, the renderer's compare back); and the seams by source. tools/deadlandsProbe.mjs draws it in a real WebGL2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  deadClock, deadAzimuth, deadlandsFlash, seaVertices, skyBasis, skyGain, courtLighting, DeadlandsRenderer,
  DEAD_CLOCK_PERIOD, DEAD_SKY_VS, DEAD_SKY_FS, DEAD_SEA_FS, HORIZON_GLSL, SEA_R, SEA_FADE, SEA_RINGS, SEA_SPOKES,
  SIGIL_TOWER, LESSER_TOWERS, VORTEX_ELEV, VORTEX_TURNS, VORTEX_INFLOW_TURNS, CLOUD_LOOP_TURNS, SEA_LOOP_TURNS,
  BEAM_CLIMB_TURNS, SPINE_TURNS, SEA_PULSE_TURNS, FALL_TURNS, FLASH_SLOT_S, FLASH_S, COURT_TRILIGHT, COURT_KEY_LIGHT, RIDGES,
} from '../src/render/deadlands.js';
import { LAVA_Y, COURT_FOG } from '../src/world/gateArena.js';
import { COURT_R } from '../src/net/gateBrain.js';
import { perspective, lookAt } from '../src/world/mat4.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('WB6a the clock: wrapped to its period, and every rate the shaders run a whole number of cycles over it - the sky never jumps when the clock wraps (mutants: a rate off the whole; the clock unwrapped)', () => {
  assert.equal(deadClock(0), 0);
  assert.equal(deadClock(DEAD_CLOCK_PERIOD + 12.5), 12.5);
  assert.equal(deadClock(-1), DEAD_CLOCK_PERIOD - 1);
  for (const [k, v] of Object.entries({ VORTEX_TURNS, VORTEX_INFLOW_TURNS, CLOUD_LOOP_TURNS, SEA_LOOP_TURNS, BEAM_CLIMB_TURNS, SPINE_TURNS, SEA_PULSE_TURNS, FALL_TURNS })) {
    assert.ok(Number.isInteger(v) && v > 0, `${k} is whole: ${v}`);
  }
  // every product with the clock in the shaders is one of them: radians a second (2 pi turns over the period) or, for
  // the endless zoom's phase, turns a second
  let seen = 0;
  for (const s of [DEAD_SKY_FS, DEAD_SEA_FS]) {
    for (const m of s.matchAll(/(?:\bt|uTime) \* ([0-9.]+)/g)) {
      const v = Number(m[1]);
      const asRad = (v * DEAD_CLOCK_PERIOD) / (2 * Math.PI), asTurns = v * DEAD_CLOCK_PERIOD;
      assert.ok(Math.abs(asRad - Math.round(asRad)) < 1e-3 || Math.abs(asTurns - Math.round(asTurns)) < 1e-3, `the rate ${v} is whole over the period`);
      seen++;
    }
  }
  assert.ok(seen >= 8, `the walk found the shaders' rates: ${seen}`);
  assert.equal(deadAzimuth(0, -1), 0, 'azimuth 0 is toward the boss from the arrival (-z)');
  assert.ok(Math.abs(deadAzimuth(1, 0) - Math.PI / 2) < 1e-12, 'and turns toward +x');
});

test('WB6a lightning: pure of everything but the clock - the same at a moment and a period later; a slot strikes about half the time, once, for FLASH_S, flickering, somewhere on the sky above the horizon (mutants: every slot striking; a strike that never ends)', () => {
  let strikes = 0, lit = 0;
  const slots = DEAD_CLOCK_PERIOD / FLASH_SLOT_S;
  const seenSlots = new Set();
  for (let t = 0; t < DEAD_CLOCK_PERIOD; t += 0.05) {
    const f = deadlandsFlash(t);
    assert.deepEqual(deadlandsFlash(t + DEAD_CLOCK_PERIOD), f, 'a period later, the same');
    if (!f) continue;
    lit++;
    assert.ok(f.strength >= 0 && f.strength <= 1);
    assert.ok(f.az >= -Math.PI && f.az <= Math.PI && f.elev >= 0.25 && f.elev <= 0.75, 'on the sky, above the horizon');
    if (!seenSlots.has(f.slot)) { seenSlots.add(f.slot); strikes++; }
  }
  assert.ok(strikes > slots * 0.3 && strikes < slots * 0.8, `about half the slots strike: ${strikes} of ${slots | 0}`);
  const litS = lit * 0.05;
  assert.ok(Math.abs(litS - strikes * FLASH_S) < strikes * 0.1 + 0.2, `each for FLASH_S: ${litS.toFixed(2)} s over ${strikes}`);
  // the flicker: bright, a dip, bright again, then dying
  const any = [...seenSlots][0];
  let start = null;
  for (let t = any * FLASH_SLOT_S; t < (any + 1) * FLASH_SLOT_S; t += 0.01) if (deadlandsFlash(t)) { start = t; break; }
  const at = (u) => deadlandsFlash(start + 0.001 + u * FLASH_S)?.strength ?? 0;
  assert.ok(at(0.05) > at(0.24) && at(0.35) > at(0.24) && at(0.9) < at(0.35), 'it flickers as it dies');
  assert.equal(deadlandsFlash(start + FLASH_S + 0.01), null, 'and ends');
});

test('WB6a the sea: a disc facing up, no hole under the court, its rim inside the host\'s 500 m far plane from anywhere on the court and its fade done before it; the rim becomes the sky\'s own horizon - one function both passes read - so no edge shows, not a square and not a circle (mutants: a triangle wound down; the rim\'s fade dropped; the horizon not the sky\'s)', () => {
  const v = seaVertices();
  assert.equal(v.length / 6, SEA_RINGS * SEA_SPOKES * 2 - SEA_SPOKES, 'a fan at the middle, quads outward');
  let rMax = 0, rMin = Infinity;
  for (let i = 0; i < v.length; i += 6) {
    const a = [v[i], v[i + 1]], b = [v[i + 2], v[i + 3]], c = [v[i + 4], v[i + 5]];
    const e1 = [b[0] - a[0], b[1] - a[1]], e2 = [c[0] - a[0], c[1] - a[1]];
    assert.ok(e1[1] * e2[0] - e1[0] * e2[1] > 0, 'wound to face up (+y)');
    for (const p of [a, b, c]) { const r = Math.hypot(p[0], p[1]); rMax = Math.max(rMax, r); rMin = Math.min(rMin, r); }
  }
  assert.ok(Math.abs(rMax - SEA_R) < 1e-3 && rMin === 0, 'out to SEA_R, from its very middle');
  const eyeOver = Math.abs(LAVA_Y) + 3;
  assert.ok(Math.hypot(SEA_R + COURT_R, eyeOver) < 500, 'its farthest edge inside the far plane from anywhere on the court');
  assert.ok(SEA_FADE[0] < SEA_FADE[1] && SEA_FADE[1] <= SEA_R, 'the rim has become the horizon before the disc ends');
  for (const s of [DEAD_SKY_FS, DEAD_SEA_FS]) assert.ok(s.includes(HORIZON_GLSL), 'the one horizon, in both');
  assert.match(DEAD_SEA_FS, /col = mix\(col, deadHorizon\(normalize\(vWorld - uCamPos\)\), rimT\);/, 'the rim becomes it');
  assert.match(DEAD_SKY_FS, /col = mix\(col, deadHorizon\(d\), smoothstep\(0\.22, 0\.0, e\)\);/, 'and the sky\'s horizon is it');
  assert.match(DEAD_SEA_FS, /col = mix\(uHaze, col, fogFactorAt\(vWorld\)\);/, 'fogged by the frame\'s own fog');
});

test('WB6a the sky\'s rays: the camera\'s basis off the view and the lens off the projection - the screen\'s middle looks where the camera does, its edge half the field of view aside; the triangle stands at the far plane (mutants: the lens inverted; the ray off the view)', () => {
  const eye = [3, 2, 9], at = [3, 2, 0];
  const view = lookAt(eye, at, [0, 1, 0]);
  const proj = perspective(1.1, 16 / 9, 0.1, 500);
  const b = skyBasis(view, proj);
  const ray = (x, y) => b.right.map((r, i) => r * ((x + b.lens[2]) / b.lens[0]) + b.up[i] * ((y + b.lens[3]) / b.lens[1]) + b.fwd[i]);
  const n = (v) => { const l = Math.hypot(...v); return v.map((c) => c / l); };
  assert.deepEqual(n(ray(0, 0)).map((c) => Math.round(c * 1e6) / 1e6), [0, 0, -1], 'the middle looks down -z, where the camera does');
  const edge = n(ray(0, 1));
  assert.ok(Math.abs(Math.asin(edge[1]) - 0.55) < 1e-6, `the top edge half the vertical field above: ${Math.asin(edge[1])}`);
  assert.match(DEAD_SKY_VS, /gl_Position = vec4\(aPos, 1\.0, 1\.0\); \}$/, 'at the far plane');
  // the gain follows the lane's fog
  assert.equal(skyGain(COURT_FOG.color, COURT_FOG.color), 1);
  assert.ok(Math.abs(skyGain([0.112, 0.0175, 0.007], COURT_FOG.color) - 0.35) < 1e-9, 'the lane\'s dark');
  assert.equal(skyGain([9, 0, 0], COURT_FOG.color), 1.5, 'never past half again');
  assert.equal(skyGain(null, COURT_FOG.color), 1);
});

test('WB6a the towers and the ranges: the great tower behind the boss as the players arrive, over the horizon, its vortex high over it; the lesser round the horizon, lower; the ranges far to near, hazier the further (mutants: the tower behind the arrival; the ranges\' haze inverted)', () => {
  assert.ok(Math.abs(SIGIL_TOWER.az) < 0.5, 'behind the boss');
  assert.ok(SIGIL_TOWER.top > 0.25 && VORTEX_ELEV > SIGIL_TOWER.top + 0.3, 'tall, the vortex well over it');
  for (const t of LESSER_TOWERS) { assert.ok(t.top < SIGIL_TOWER.top && t.w < SIGIL_TOWER.w); assert.ok(Math.abs(t.az) > 1, 'round the horizon, off the great one'); }
  for (let i = 1; i < RIDGES.length; i++) assert.ok(RIDGES[i].haze < RIDGES[i - 1].haze && RIDGES[i].rise > RIDGES[i - 1].rise, 'nearer: clearer and taller');
  assert.match(DEAD_SKY_FS, /m = max\(m, sigil\(az, e\)\);/, 'the great tower stands in the near range');
});

test('WB6a the court\'s light: red from the sky, fire-orange from under, the vortex\'s key from behind the boss, high - fresh copies each time (mutants: the key from the arrival\'s side; the fire\'s light from above)', () => {
  const a = courtLighting(), b = courtLighting();
  assert.notEqual(a.tri.sky, b.tri.sky, 'fresh copies');
  assert.deepEqual(a.tri, { sky: [...COURT_TRILIGHT.sky], equator: [...COURT_TRILIGHT.equator], ground: [...COURT_TRILIGHT.ground] });
  const sum = (c) => c[0] + c[1] + c[2];
  assert.ok(sum(a.tri.ground) > sum(a.tri.sky), 'lit from below, by the fire');
  for (const c of [a.tri.sky, a.tri.equator, a.tri.ground, a.key.color]) assert.ok(c[0] > c[1] && c[1] > c[2], 'the Deadlands\' own reds');
  assert.ok(Math.abs(Math.hypot(...a.key.dir) - 1) < 1e-9, 'a unit vector');
  assert.ok(a.key.dir[1] > 0.3 && a.key.dir[2] < -0.5, 'toward the vortex: up, and beyond the boss');
  assert.ok(a.key.scale > 0 && a.key.scale === COURT_KEY_LIGHT.scale);
});

/** A GL that records every call. */
function fakeGl() {
  const calls = [];
  const gl = new Proxy({ ARRAY_BUFFER: 1, STATIC_DRAW: 2, FLOAT: 3, TRIANGLES: 4, BLEND: 5, DEPTH_TEST: 6, CULL_FACE: 7, LEQUAL: 8, LESS: 9 }, {
    get(t, k) {
      if (k in t) return t[k];
      return (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; };
    },
  });
  return { gl, calls };
}

test('WB6a the pass: the sea solid (tested and written) and then the sky at the far plane (tested LEQUAL, never written), the renderer\'s own compare and mask back after, culling back on, nothing blended; no centre, no sea; a strike due lights the deck (mutants: the sky written; the compare left LEQUAL; the sky drawn first)', () => {
  const { gl, calls } = fakeGl();
  const p = new DeadlandsRenderer(gl);
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  calls.length = 0;
  let strikeAt = 0;
  while (!deadlandsFlash(strikeAt)) strikeAt += 0.05;
  assert.equal(p.draw(I, I, [0, LAVA_Y, 0], strikeAt, { mode: 2, density: 0.009, range: [0, 1], color: [0.32, 0.05, 0.02], camPos: [0, 2, 0] }, 1), true);
  assert.deepEqual(p.drawn, ['sea', 'sky']);
  const draws = calls.filter((c) => c[0] === 'drawArrays');
  assert.equal(draws.length, 2);
  assert.equal(draws[0][3], p.seaCount, 'the sea\'s disc first');
  assert.equal(draws[1][3], 3, 'then the sky\'s one triangle');
  const iSea = calls.indexOf(draws[0]), iSky = calls.indexOf(draws[1]);
  const lastBefore = (i, name) => { for (let k = i; k >= 0; k--) if (calls[k][0] === name) return calls[k]; return null; };
  assert.deepEqual(lastBefore(iSea, 'depthMask'), ['depthMask', true], 'the sea written');
  assert.deepEqual(lastBefore(iSky, 'depthMask'), ['depthMask', false], 'the sky never written');
  assert.deepEqual(lastBefore(iSky, 'depthFunc'), ['depthFunc', gl.LEQUAL], 'the sky only where nothing nearer has drawn');
  assert.ok(!calls.some((c) => c[0] === 'disable' && c[1] === gl.DEPTH_TEST), 'no depth-blind draw');
  const after = calls.slice(iSky);
  assert.deepEqual(after.filter((c) => c[0] === 'depthFunc').map((c) => c[1]), [gl.LESS], 'the renderer\'s compare back');
  assert.deepEqual(after.filter((c) => c[0] === 'depthMask').map((c) => c[1]), [true], 'and its mask');
  assert.ok(after.some((c) => c[0] === 'enable' && c[1] === gl.CULL_FACE), 'culling back on');
  assert.ok(!calls.some((c) => c[0] === 'enable' && c[1] === gl.BLEND), 'nothing blended');
  const flash = calls.find((c) => c[0] === 'uniform4f' && c[1] === 'uFlash');
  assert.ok(flash[3 + 0] > 0 || flash[4] > 0, 'the strike lights the deck');
  calls.length = 0;
  p.draw(I, I, null, 1, null, 1);
  assert.deepEqual(p.drawn, ['sky'], 'no centre, no sea - and still a sky');
});

test('WB6a the seams, by source: the court is lit as itself before the frame begins (the lane\'s dark on its trilight, as on its fog); the sea and sky drawn after the court\'s solid geometry and before its flats; the world host builds the pass once, lazily, a failure costing the sky and never the game, and marks the seam (mutants: each seam removed)', () => {
  const wm = src('src/scenes/worldModes.js');
  const light = wm.indexOf('\n      if (isGateArena(dungeonLoc)) { const _cl = courtLighting(deadlandsFlash(_deadS)); const _ct = dungeonTrilight(!!renderer.lightingLane, _cl.tri); renderer.setLighting(courtEquatorOf(_ct), 0, undefined, _ct); renderer.setMoonlight(_cl.key); }');   // WB6b: with the strike lit now; AUDIT WB D10: its equator one array
  const dark = wm.indexOf('renderer.setMoonlight(null);');
  const begin = wm.indexOf('renderer.beginFrame(proj, view, INTERIOR_LIGHT_DIR, WORLD_FRAME);');
  assert.ok(dark > 0 && dark < light && light < begin, 'after the dungeon\'s dark, before the frame reads it');
  const dyn = wm.indexOf('for (const d of dungeonCtx.dynamicDraws) renderer.drawMesh(d.gpu, d.object.matrix, dungeonCtx.texRemap);');
  const back = wm.indexOf('\n      if (isGateArena(dungeonLoc)) host.drawGateBackdrop?.({ proj, view, eye: mwv.eye });');
  const flats = wm.indexOf('renderer.drawBillboards([...dungeonCtx.billboardBatches');
  const statics = wm.indexOf('if (dungeonCtx.staticBatch) renderer.drawMesh(dungeonCtx.staticBatch, BATCH_IDENTITY, null);');
  assert.ok(begin < statics && statics < dyn && dyn < back && back < flats, `after the solid geometry, before the flats: ${[begin, statics, dyn, back, flats]}`);
  const w = src('src/scenes/world.js');
  assert.match(w, /drawGateBackdrop: \(\{ proj, view \}\) => \{\n\s+const d = deadlandsPass\(\);\n\s+if \(d\?\.draw\(proj, view, _courtSea, deadlandsSeconds\(\), courtFogNow\(\), skyGain\(renderer\._fogColor, COURT_FOG\.color\)\)\) renderer\.markForeignPass\(\);/);   // AUDIT WB D10: the sea's place made once, the fog one object filled from the renderer's
  assert.match(w, /const _courtSea = courtToDungeon\(0, LAVA_Y, 0\), _courtCentre = courtToDungeon\(0, 0, 0\);/);
  assert.match(w, /const courtFogNow = \(\) => \{ _courtFog\.mode = renderer\._fogMode; _courtFog\.density = renderer\._fogDensity; _courtFog\.range = renderer\._fogRange; _courtFog\.color = renderer\._fogColor; _courtFog\.camPos = renderer\._camPos; return _courtFog; \};/);
  assert.match(w, /if \(_deadlands !== undefined\) return _deadlands;\n\s+try \{ _deadlands = new DeadlandsRenderer\(renderer\.gl\); \} catch \(e\) \{ console\.warn\('\[gate\] the Deadlands would not build', e\?\.message \?\? e\); _deadlands = null; \}/);
});
