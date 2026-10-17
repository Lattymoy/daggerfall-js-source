// UNDER-LOOK and UNDER-RAYS (FIELD BUGS 2026-10-01 #4 "Underwater should have a water look to it, not as clear", #5
// "Underwater should have sun rays that dynamically show through the water"). Under Iliac Puddle No More's sea the
// mod's distance fog left a pixel at the eye untouched and took ~2% of its red a metre, over a 66.5 m vision; nothing
// tinted the water body and nothing lit it. The port's look over it: the fog's vision times UNDERWATER_MURK, the
// water body over every pixel (red taken first, less kept and less added deeper and by night), and the sun's shafts
// - refracted at the surface, lit through a drifting pattern of the surface's focus. world/underwater/underwaterLook.js's laws,
// the pass's own fragment program run in JS (test/glsl.mjs), and the world host's wiring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  underwaterLookUniforms, refractedSun, UNDERWATER_MURK, WATER_REFRACTION, BODY_KEEP, BODY_KEEP_DEEP, SHAFT_FADE_M, SHAFT_REACH_M,
} from '../../src/world/underwater/underwaterLook.js';
import { distanceFogUniforms, lookSettings, underwaterVisionDistance } from '../../src/world/deepWater/deepWaterLook.js';
import { UNDER_LOOK_FS, SKY_FOG_VS } from '../../src/render/deepWatersRender.js';
import { glslFunctions } from '../glsl.mjs';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const unit = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
const NOON = unit([0.3, 1, 0.2]), MORNING = unit([0.9, 0.35, 0.1]), NIGHT = unit([0.5, -0.4, 0]);
const SUN = [1, 0.95, 0.85];
const look = (o) => underwaterLookUniforms({ depth: 3, daylight: 1, toSun: NOON, sunColor: SUN, sunScale: 1, ...o });

test('UNDER-LOOK: the water body takes red first, keeps less and adds less the deeper the eye and the darker the day (mutants: the keep\'s depth term; the night share)', () => {
  const at = look({ depth: 0 });
  assert.ok(at.keep[0] < at.keep[1] && at.keep[0] < at.keep[2], `red goes first (${at.keep})`);
  assert.ok(at.keep.every((k) => k < 0.95), 'every channel is the water\'s, at the surface too');
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(at.keep[i] - BODY_KEEP[i]) < 1e-12, 'the surface keeps BODY_KEEP by day');
  const deep = look({ depth: 40 });
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(deep.keep[i] - BODY_KEEP_DEEP[i]) < 1e-12, 'and BODY_KEEP_DEEP at its depth');
  let last = look({ depth: 0 });
  for (const depth of [5, 10, 20, 30]) {
    const u = look({ depth });
    assert.ok(u.keep.every((k, i) => k < last.keep[i]) && u.body.every((b, i) => b < last.body[i]), `${depth} m: darker than above`);
    last = u;
  }
  const night = look({ daylight: 0 });
  assert.ok(night.keep.every((k, i) => k < at.keep[i] + 1e-12) && night.body.every((b, i) => b < look({ depth: 3 }).body[i]), 'and by night');
  assert.ok(night.body.every((b) => b > 0), 'never black: the moon\'s water still has a colour');
});

test('UNDER-RAYS: the sun bent at the surface (Snell), no shaft by night, and fainter with depth and with a cloud over the sun (mutants: the index; the night gate; the depth fade)', () => {
  for (const s of [NOON, MORNING]) {
    const w = refractedSun(s);
    assert.ok(Math.abs(Math.hypot(...w) - 1) < 1e-12, 'a unit direction');
    const sinA = Math.hypot(s[0], s[2]), sinW = Math.hypot(w[0], w[2]);
    assert.ok(Math.abs(sinW - sinA / WATER_REFRACTION) < 1e-12, 'sin under = sin over / n');
    assert.ok(w[1] > s[1], 'steeper under the water than over it');
    assert.ok(Math.abs(Math.atan2(w[2], w[0]) - Math.atan2(s[2], s[0])) < 1e-12, 'in the sun\'s own bearing');
  }
  assert.equal(WATER_REFRACTION, 1.333);
  assert.equal(refractedSun(NIGHT), null, 'the sun under the horizon lights no shaft');
  assert.deepEqual(look({ toSun: NIGHT }).shaft, [0, 0, 0]);
  assert.deepEqual(look({ toSun: NIGHT }).sunW, [0, 1, 0], 'the direction is still a direction');
  const s0 = look({ depth: 0 }).shaft[1], s28 = look({ depth: SHAFT_FADE_M }).shaft[1];
  assert.ok(s0 > 0 && Math.abs(s28 / s0 - Math.exp(-1)) < 1e-12, 'by e over SHAFT_FADE_M');
  assert.ok(Math.abs(look({ sunScale: 0.25 }).shaft[1] / look({}).shaft[1] - 0.25) < 1e-12, 'by the frame\'s sun scale');
  assert.ok(look({}).shaft[1] > look({}).shaft[0], 'the water\'s colour on the light');
  const out = { keep: [0, 0, 0], body: [0, 0, 0], sunW: [0, 0, 0], shaft: [0, 0, 0] };
  assert.equal(underwaterLookUniforms({ depth: 2, daylight: 1, toSun: NOON, sunColor: SUN, sunScale: 1 }, out), out, 'the host\'s own object, written in place');
});

test('UNDER-LOOK: the murk scales the mod\'s vision distance and everything the fog derives from it; 1 is the mod\'s own fog (mutant: the murk dropped)', () => {
  const s = lookSettings((k) => ({ 'General.WaterDepth': 250, 'General.UnderwaterFogStrength': 0.5, 'General.UnderwaterFogDistance': 0.3 })[k]);
  const f = { daylight: 1, cameraY: 30, oceanY: 34 };
  const mod = distanceFogUniforms(s, f), same = distanceFogUniforms(s, { ...f, murk: 1 }), port = distanceFogUniforms(s, { ...f, murk: UNDERWATER_MURK });
  assert.deepEqual(Array.from(same), Array.from(mod), 'murk 1 is the mod, number for number');
  assert.ok(UNDERWATER_MURK > 0.3 && UNDERWATER_MURK < 0.8);
  assert.ok(Math.abs(port[2] - mod[2] * UNDERWATER_MURK) < 1e-4, `vision ${port[2]} = ${mod[2]} x ${UNDERWATER_MURK}`);
  assert.ok(Math.abs(mod[2] - underwaterVisionDistance(0.3)) < 1e-4, 'above six metres the mod\'s vision is the slider\'s');
  for (let i = 4; i < 8; i++) assert.ok(Math.abs(port[i] * UNDERWATER_MURK - mod[i]) < 1e-6, `extinction ${i}: per metre, by 1 / murk`);
  assert.ok(port[16] < mod[16] && port[17] < mod[17], 'the band closes nearer');
  assert.match(rd('src/scenes/world.js'), /distanceFogUniforms\(f\.s, \{ daylight: f\.daylight, cameraY: f\.camY, oceanY: _dwFogP\.oceanY, murk: UNDERWATER_MURK \}, _dwFogU\)/, 'the host hands the port\'s murk');
});

/** The pass's fragment program over one pixel: the rays as drawSkyFog builds them, the frame's uniforms. */
function shade({ ray, pass, cam = [0, 31, 0], seaY = 34, t = 0, frag = [100, 100], u = look({ depth: 3 }) }) {
  const f = glslFunctions(UNDER_LOOK_FS, {
    vRay: ray, uCamPos: cam, uSeaY: seaY, uKeep: u.keep, uBody: u.body, uSunW: u.sunW, uShaft: u.shaft,
    uReach: SHAFT_REACH_M, uTime: t, uPass: pass, gl_FragCoord: [frag[0] + 0.5, frag[1] + 0.5, 0, 1],
  });
  f.main();
  return f.globals.outColor;
}

test('UNDER-RAYS: the pass multiplies by the body\'s keep and then adds its light and the shafts - which vary across the view and move with the surface (mutants: the shafts\' march; the clock; the multiply pass)', () => {
  const u = look({ depth: 3, toSun: MORNING });
  assert.deepEqual(shade({ ray: [1, 0, 0], pass: 0, u }), [...u.keep, 1], 'the first draw: the keep, alpha untouched (ZERO, SRC_COLOR)');
  const dark = look({ depth: 3, toSun: NIGHT });
  assert.deepEqual(shade({ ray: [1, 0.1, 0], pass: 1, u: dark }), [...dark.body, 0], 'no sun: the body alone');
  // across the view, horizontally out through the water: the shafts are columns of light, so some rays meet more than others
  const across = [];
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    across.push(shade({ ray: [Math.cos(a), 0.15, Math.sin(a)], pass: 1, u, frag: [7, 11] })[1] - u.body[1]);
  }
  assert.ok(across.every((v) => v >= 0), 'light is only ever added');
  assert.ok(Math.max(...across) > 2 * Math.min(...across) + 0.01, `the shafts are uneven across the view (${Math.min(...across).toFixed(3)}..${Math.max(...across).toFixed(3)})`);
  // the same pixel a few seconds on: the surface has moved, so have the shafts
  let moved = 0;
  for (let k = 0; k < 8; k++) {
    const ray = [Math.cos(k), 0.2, Math.sin(k)];
    moved = Math.max(moved, Math.abs(shade({ ray, pass: 1, u, t: 0, frag: [3, 5] })[1] - shade({ ray, pass: 1, u, t: 6, frag: [3, 5] })[1]));
  }
  assert.ok(moved > 0.01, `dynamic: they move with the surface (${moved.toFixed(3)})`);
  // the rays as the sky fog builds them: the same vertex program
  assert.ok(SKY_FOG_VS.includes('vRay = uRayC + p.x * uRayX + p.y * uRayY;'));
});

test('UNDER-LOOK: the world host draws it while the eye is under the sea, after the last world pass and before the weapon and the HUD; the pass owns its state (mutants: the gate; the place)', () => {
  const w = rd('src/scenes/world.js');
  const at = w.indexOf('dwRender.drawUnderwaterLook(');
  assert.ok(at > 0);
  const gate = w.lastIndexOf('\n', at);
  assert.match(w.slice(w.lastIndexOf('\n', gate - 1), gate), /if \(deepWaters && dwRender && _dwFogP\?\.under && _dwFrame\) \{/, 'only under the sea');
  assert.ok(at > w.indexOf('    arrows.draw(renderer);'), 'after the arrows - the last world pass');
  assert.ok(at < w.indexOf("    meterFor(renderer.gl)?.markCpu('rig');"), 'before the weapon rig and the HUD');
  assert.match(w.slice(at, at + 400), /underwaterLookUniforms\(\{ depth: _dwFogP\.oceanY - cam\.pos\[1\], daylight: _dwFrame\.daylight, toSun: sunDirection\(minute\), sunColor: renderer\._sunColor, sunScale: renderer\._sunScale \}, _underLook\), _dwFogP\.oceanY, SHAFT_REACH_M, now \/ 1000\);\s*\n\s*renderer\.markForeignPass\(\);/);
  const dw = rd('src/render/deepWatersRender.js');
  const body = dw.slice(dw.indexOf('  drawUnderwaterLook(u, seaY, reach, timeSeconds) {'), dw.indexOf('  dispose() {'));
  for (const restore of ['gl.disable(gl.BLEND);', 'gl.depthMask(true);', 'gl.enable(gl.CULL_FACE);', 'gl.enable(gl.DEPTH_TEST);', 'gl.bindVertexArray(null);']) {
    assert.ok(body.includes(restore), `it leaves ${restore}`);
  }
  assert.match(body, /gl\.blendFuncSeparate\(gl\.ZERO, gl\.SRC_COLOR, gl\.ZERO, gl\.ONE\);[\s\S]*gl\.blendFuncSeparate\(gl\.ONE, gl\.ONE, gl\.ZERO, gl\.ONE\);/, 'multiply, then add - alpha kept');
});
