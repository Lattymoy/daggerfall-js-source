// DUEL1 (2026-09-24, Mac: "...traps both players in a surrounding transparent holographic wall that keeps them from
// going outside of the duel space"): THE RING, HELD AND DRAWN. The motor's clamp (player/motor.js _keepInArena - the
// body kept inside after every step, the outward half of a jump taken away, the ring shifted with the world and dropped
// on any placement); the wall (render/duelWall.js - the cylinder placed by its uniforms, see-through by construction,
// every rate whole cycles over its clock, fogged, its GL state restored); and the world host by source (the ring set on
// the motor every frame from the world frame, the wall drawn after the grass from the view's own eye, the onlookers'
// rings off the foes frame, each duel once).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { PlayerMotor, FIXED_DT, CAPSULE_RADIUS } from '../src/player/motor.js';
import { Collider } from '../src/player/collider.js';
import {
  DuelWallRenderer, ringVertices, duelClock, DUEL_WALL_VS, DUEL_WALL_FS, DUEL_WALL_SEGMENTS, DUEL_WALL_BELOW_M, DUEL_WALL_HEIGHT_M,
  DUEL_WALL_RINGS_MAX, DUEL_CLOCK_PERIOD, DUEL_WALL_LINES, DUEL_WALL_CLIMB_HZ, DUEL_WALL_SWEEP_HZ, DUEL_WALL_SHIMMER_HZ, DUEL_WALL_COLOR,
} from '../src/render/duelWall.js';
import { DUEL_RADIUS_M } from '../src/net/duelSession.js';
import { glslFunctions } from './glsl.mjs';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const IDLE = { forward: 0, strafe: 0, run: false, jump: false, up: false, down: false };
const RUN = { ...IDLE, forward: 1, run: true };

function walker(y = 1) {
  const col = new Collider(() => 0);
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  col.addMesh('floor', [-200, 0, -200, 200, 0, -200, 200, 0, 200, -200, 0, 200], [0, 1, 2, 0, 2, 3], I);
  const m = new PlayerMotor(col);
  m.spawn(0, y, 0);
  for (let i = 0; i < 30; i++) m.update(FIXED_DT, IDLE, 0);
  return m;
}
const ground = (m, c) => Math.hypot(m.pos[0] - c[0], m.pos[2] - c[2]);

test('DUEL1 the ring holds the body: running at the wall for seconds never carries the feet past the radius less the capsule, on either end of the interpolation span; along it the body still moves; the height is never touched (mutants: the clamp before the step; the capsule not taken off; the height clamped)', () => {
  const m = walker();
  const c = [3, 0, -2];
  m.arena = { centre: c, radius: DUEL_RADIUS_M };
  const lim = DUEL_RADIUS_M - CAPSULE_RADIUS;
  // yaw 0 runs along +z
  for (let i = 0; i < 400; i++) {
    m.update(FIXED_DT, RUN, 0);
    assert.ok(ground(m, c) <= lim + 1e-6, `step ${i}: ${ground(m, c).toFixed(4)} m from the centre`);
    assert.ok(Math.hypot(m._prevPos[0] - c[0], m._prevPos[2] - c[2]) <= lim + 1e-6, 'the span\'s start too');
  }
  assert.ok(Math.abs(ground(m, c) - lim) < 1e-3, 'it reached the wall and stopped there');
  const at = [m.pos[0], m.pos[2]];
  for (let i = 0; i < 60; i++) m.update(FIXED_DT, RUN, Math.PI / 2);   // along the wall
  assert.ok(Math.hypot(m.pos[0] - at[0], m.pos[2] - at[1]) > 1, 'along the wall it still goes');
  assert.ok(ground(m, c) <= lim + 1e-6);
  assert.ok(Math.abs(m.pos[1]) < 0.5, 'on the ground, height untouched by the ring');
  // no ring, no hold
  m.arena = null;
  for (let i = 0; i < 400; i++) m.update(FIXED_DT, RUN, Math.atan2(m.pos[0] - c[0], m.pos[2] - c[2]));
  assert.ok(ground(m, c) > lim + 5, 'without a ring the body walks out');
});

test('DUEL1 a jump at the wall stops at it and a jump along it carries on - the outward half of the airborne momentum is taken away; the ring moves with a floating-origin shift; any placement drops it (mutants: the momentum kept, the body pinned to the wall for the jump; the ring left behind by a recenter; a teleport yanked back)', () => {
  const m = walker();
  const c = [0, 0, 0];
  m.arena = { centre: c, radius: DUEL_RADIUS_M };
  m.pos[0] = DUEL_RADIUS_M - CAPSULE_RADIUS - 0.01; m.pos[2] = 0;
  m._airVelX = 5; m._airVelZ = 3;   // leaving the ground outward and along
  m._keepInArena();
  m.pos[0] += 0.5;
  m._keepInArena();
  assert.ok(ground(m, c) <= DUEL_RADIUS_M - CAPSULE_RADIUS + 1e-9);
  assert.equal(m._airVelX, 0, 'the outward half gone');
  assert.equal(m._airVelZ, 3, 'the half along the wall kept');
  m._airVelX = -2;
  m._keepInArena();
  assert.equal(m._airVelX, -2, 'inward momentum is never touched');
  // the origin shift moves the ring with the world
  m.offsetOrigin([-819.2, 0, 409.6]);
  assert.deepEqual(m.arena.centre, [-819.2, 0, 409.6]);
  assert.equal(m.arena.radius, DUEL_RADIUS_M);
  // a placement drops it
  m.spawn(500, 1, 500);
  assert.equal(m.arena, null, 'a teleport is not a walk out - the duel\'s own law decides what it meant');
});

test('DUEL1 the wall\'s geometry: one ring of quads in (around, up), the cylinder placed by its uniforms - the vertex shader puts (around, up) at centre + radius on the ground and from its foot below the centre to its top above (mutants: a seam at 0/1; the foot above the centre; the radius a diameter)', () => {
  const v = ringVertices();
  assert.equal(v.length, DUEL_WALL_SEGMENTS * 6 * 2);
  let minU = 1, maxU = 0;
  for (let i = 0; i < v.length; i += 2) { minU = Math.min(minU, v[i]); maxU = Math.max(maxU, v[i]); assert.ok(v[i + 1] === 0 || v[i + 1] === 1); }
  assert.deepEqual([minU, maxU], [0, 1], 'all the way round, closed');
  const at = (u, h, centre = [10, 2, 30], radius = 12) => {
    const f = glslFunctions(DUEL_WALL_VS, { aUV: [u, h], uVP: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], uCentre: centre, uRadius: radius, uBase: -DUEL_WALL_BELOW_M, uHeight: DUEL_WALL_HEIGHT_M });
    f.main();
    return f.globals.vWorld;
  };
  const p0 = at(0, 0), p1 = at(0.25, 1);
  assert.ok(Math.abs(p0[0] - 22) < 1e-9 && Math.abs(p0[2] - 30) < 1e-9 && Math.abs(p0[1] - (2 - DUEL_WALL_BELOW_M)) < 1e-9, 'the foot below the centre, the radius out');
  assert.ok(Math.abs(p1[0] - 10) < 1e-9 && Math.abs(p1[2] - 42) < 1e-9 && Math.abs(p1[1] - (2 - DUEL_WALL_BELOW_M + DUEL_WALL_HEIGHT_M)) < 1e-9, 'a quarter round, at the top');
  const q = at(1, 0);
  assert.ok(Math.abs(q[0] - p0[0]) < 1e-9 && Math.abs(q[2] - p0[2]) < 1e-9, 'no seam: round is round');
  assert.ok(DUEL_WALL_BELOW_M > 2 && DUEL_WALL_HEIGHT_M - DUEL_WALL_BELOW_M > 4, 'it meets sloping ground and stands over a head');
});

test('DUEL1 the wall\'s light: added onto the frame (it only brightens - see-through), brightest on its lines and where it meets the ground, gone toward its top, thinned by the fog; every rate a whole number of cycles over the clock it is handed wrapped to (mutants: an opaque wall; the top as bright as the foot; the fog ignored; a rate that stutters at the wrap)', () => {
  const fs = (u, h, t = 7, fog = null) => {
    const f = glslFunctions(DUEL_WALL_FS, {
      vUV: [u, h], vWorld: [0, 0, fog?.d ?? 0], uTime: t, uColor: [1, 1, 1], uAlpha: 1, uBelow: DUEL_WALL_BELOW_M / DUEL_WALL_HEIGHT_M,
      uFogMode: fog ? 2 : 0, uFogDensity: fog?.density ?? 0, uFogRange: [0, 1], uCamPos: [0, 0, 0],
    });
    f.main();
    return f.globals.o;
  };
  const onLine = fs(0.5 / DUEL_WALL_LINES * 2, 0.45), between = fs(0.5 / DUEL_WALL_LINES, 0.45);
  assert.equal(onLine[3], 1, 'alpha 1 under ONE, ONE blending: the colour is ADDED');
  assert.ok(onLine[0] > between[0], 'the grid lines are brighter than between them');
  assert.ok(fs(0.2, 0.99)[0] < fs(0.2, DUEL_WALL_BELOW_M / DUEL_WALL_HEIGHT_M)[0] * 0.2, 'gone toward the top, brightest at the foot');
  assert.ok(fs(0.2, 0.45, 7, { d: 300, density: 0.01 })[0] < fs(0.2, 0.45, 7)[0] * 0.1, 'the fog thins it');
  for (const hz of [DUEL_WALL_CLIMB_HZ, DUEL_WALL_SWEEP_HZ, DUEL_WALL_SHIMMER_HZ]) assert.ok(Number.isInteger(Math.round(hz * DUEL_CLOCK_PERIOD * 1e9) / 1e9), `${hz} cycles a second over ${DUEL_CLOCK_PERIOD} s is whole`);
  assert.ok(Math.abs(fs(0.3, 0.4, 0)[0] - fs(0.3, 0.4, DUEL_CLOCK_PERIOD)[0]) < 1e-9, 'the pattern at the wrap is the pattern at zero');
  assert.equal(duelClock(DUEL_CLOCK_PERIOD * 1000 + 5.5), 5.5);
  assert.equal(duelClock(-1), DUEL_CLOCK_PERIOD - 1);
  assert.ok(DUEL_WALL_COLOR.every((v) => v >= 0 && v <= 1), 'a display colour');
});

test('DUEL1 the draw: one call a ring, the faded skipped, at most DUEL_WALL_RINGS_MAX; ONE, ONE blending, no depth written, both faces - and the renderer\'s state put back (mutants: depth written, the wall occluding the fight; culling left off for the world after it; a faded ring drawn)', () => {
  const calls = [];
  const gl = new Proxy({ VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TRIANGLES: 8, BLEND: 9, ONE: 10, CULL_FACE: 11 }, {
    get(t, k) {
      if (k in t) return t[k];
      return (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; };
    },
  });
  const w = new DuelWallRenderer(gl);
  calls.length = 0;
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  w.draw([], I, I, [0, 0, 0], 1);
  assert.equal(calls.length, 0, 'nothing to draw, nothing touched');
  const ring = (alpha, x = 0) => ({ centre: [x, 0, 0], radius: DUEL_RADIUS_M, alpha });
  w.draw([ring(1), ring(0), ring(0.5, 30), ring(1, 60), ring(1, 90), ring(1, 120), ring(1, 150)], I, I, [0, 0, 0], 12.5);
  const draws = calls.filter((c) => c[0] === 'drawArrays');
  assert.equal(draws.length, DUEL_WALL_RINGS_MAX, 'the faded skipped, the rest capped');
  assert.equal(w.drawn, DUEL_WALL_RINGS_MAX);
  const names = calls.map((c) => c[0]);
  assert.deepEqual(calls.find((c) => c[0] === 'blendFunc').slice(1), [gl.ONE, gl.ONE]);
  assert.deepEqual(calls.filter((c) => c[0] === 'depthMask').map((c) => c[1]), [false, true], 'no depth written, and the mask put back');
  assert.ok(names.lastIndexOf('enable') > names.lastIndexOf('drawArrays') && calls.filter((c) => c[0] === 'enable').some((c) => c[1] === gl.CULL_FACE), 'culling back on after');
  assert.ok(calls.some((c) => c[0] === 'disable' && c[1] === gl.BLEND) && names.lastIndexOf('disable') > names.lastIndexOf('drawArrays'), 'blending off after');
  assert.equal(calls.filter((c) => c[0] === 'uniform3f' && c[1] === 'uCentre').length, DUEL_WALL_RINGS_MAX, 'each ring placed by its uniform - the buffer never changes');
  calls.length = 0;
  w.draw([ring(0), ring(0.0005, 30), ring(1, 60)], I, I, [0, 0, 0], 1);
  assert.equal(calls.filter((c) => c[0] === 'drawArrays').length, 1, 'a ring faded out is not drawn at all');
});

test('DUEL1 the world host by source: the wall built in every skin (a shader that will not build costs the wall, never the game); drawn after the grass from the view\'s own eye, fogged, a foreign pass; the ring set on the motor every frame from the WORLD frame (a recenter moves the scene, not the ring) and only outdoors; my ring said on the foes frame for the onlookers, theirs read back through the ring law, each duel drawn once (mutants: the wall on the enhanced lane alone; drawn from cam.pos; the ring cached in the scene frame; an onlooker\'s ring drawn twice)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const duelWall = \(\(\) => \{ try \{ return new DuelWallRenderer\(renderer\.gl\); \} catch \(e\) \{ console\.warn\('\[duel\] the ring wall could not be built', e\); return null; \} \}\)\(\);/);
  const grass = w.indexOf("renderer.markForeignPass();   // EV6: the grass changed programs behind the shadows' back");
  const wall = w.indexOf('duelWall.draw(rings, proj, view, new Float32Array(mwv.eye), now / 1000,');
  const arrows = w.indexOf('arrows.update(dt, {');
  assert.ok(grass > 0 && wall > grass && arrows > wall, 'after the grass, before the arrows and the weapon');
  assert.match(w, /duelWall\.draw\(rings, proj, view, new Float32Array\(mwv\.eye\), now \/ 1000,\s*\n\s*\{ mode: renderer\._fogMode, density: renderer\._fogDensity, range: renderer\._fogRange, color: renderer\._fogColor, camPos: renderer\._camPos, dw: renderer\._dwFog \}\);[^\n]*\n\s*renderer\.markForeignPass\(\);/);   // DW-C: the carved sea's fog rides with the frame's
  assert.match(w, /player\.arena = live && \(modes\?\.mode \?\? 'exterior'\) === 'exterior' \? \{ centre: campToScene\(live\.c\), radius: DUEL_RADIUS_M \} : null;/, 'every frame, off the world frame');
  assert.match(w, /else \{ out\.push\(\{ centre: campToScene\(w\.c\), radius: DUEL_RADIUS_M, alpha: w\.alpha \}\); seen\.add\(w\.s\); \}/);
  assert.match(w, /if \(seen\.has\(e\.rec\.s\)\) continue;\s*\n\s*seen\.add\(e\.rec\.s\);\s*\n\s*out\.push\(\{ centre: campToScene\(e\.rec\.c\), radius: DUEL_RADIUS_M, alpha: 0\.85 \}\);/, 'each duel once');
  assert.match(w, /exteriorFoes\.setOnDuel\(\(from, r, at\) => \{ const rec = r === null \? null : validRingRecord\(r\); if \(rec\) _duelRings\.set\(from, \{ rec, at \}\); else _duelRings\.delete\(from\); \}, \(\) => _duelRings\.clear\(\)\);/);
  assert.match(w, /_hccDirty = false; \} if \(cell\) duelRingWord\(frame, full\);/, 'my ring rides my own foes frame');
  assert.match(w, /if \(online && isCellRoom\(online\.room\) && \(duelMgr\.live\?\.s \?\? null\) !== _duelRingSaid\) _foesFullAt = -Infinity;/, 'a change goes out at once - in a cell room, the only one whose frame carries it (AUDIT DUEL1 C1)');
  const x = rd('src/scenes/exteriorFoes.js');
  assert.match(x, /if \(data\.du !== undefined\) _onDuel\?\.\(from, data\.du, _now\(\)\);/, 'past the owner\'s room test');
  assert.match(x, /_onHccClear\?\.\(\);[^\n]*\n\s*_onDuelClear\?\.\(\);/, 'and cleared with the puppets');
  assert.match(rd('src/player/motor.js'), /this\._step\(step, input, yaw, pitch\);\s*\n\s*if \(this\.arena\) this\._keepInArena\(\);/, 'the clamp after the collider\'s move, every step');
});
