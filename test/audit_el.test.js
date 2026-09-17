// AUDIT-EL (2026-09-17, Mac: "Audit") - THE ENHANCED LIGHTING ARC'S FINDINGS,
// EACH PINNED. Two unanchored reviewer reads (the GL and shader lane; the host
// wiring and light data flow) and two of my own (the frame lifecycle under
// real WebGL semantics; the classic lane's byte-identity). Twenty findings,
// every one fixed; the ones the older pins already hold are named here and
// pinned once more where a second edge exists.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Renderer, WORLD_FRAME } from '../src/render/renderer.js';
import { EL_LANE, EL_BB_FS, EL_MESH_FS, EL_TERRAIN_FS, dungeonFog, EL_DUNGEON_AMBIENT_SCALE } from '../src/render/enhancedLighting.js';
import { SHADOW_GLSL, SHADOW_SUN_BIAS, SHADOW_POINT_BIAS, SHADOW_CASTER_MAX_RANGE, pickShadowCaster, cubeDepthOfM, cubeDepthRef, SHADOW_POINT_NEAR } from '../src/render/shadowPass.js';
import { AIR_GLARE_MAX_RANGE, AIR_ADAPT_UNIT, EMIT_MESH_FS, EMIT_BB_FS } from '../src/render/airPass.js';
import { SHADE_DARK } from '../src/systems/concealDraw.js';
import { frameTarget, setFrameTarget } from '../src/render/renderTarget.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

function recordingGl() {
  const calls = [];
  let ids = 0;
  const consts = { TEXTURE0: 1000, DEPTH_BUFFER_BIT: 256, COLOR_BUFFER_BIT: 16384, FRAMEBUFFER: 7, TRIANGLE_STRIP: 5, drawingBufferWidth: 320, drawingBufferHeight: 200, ONE: 1 };
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in consts) return consts[k];
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'getAttribLocation') return () => 0;
      if (k === 'createShader' || k === 'createProgram' || k === 'createBuffer' || k === 'createVertexArray'
        || k === 'createTexture' || k === 'createFramebuffer' || k === 'createRenderbuffer') return () => ({ id: ++ids });
      if (k === 'getParameter') return () => new Float32Array(4);
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return (...args) => { calls.push([k, ...args.map((a) => (ArrayBuffer.isView(a) ? Float32Array.from(a) : a))]); };
    },
  });
  const canvas = { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 };
  return { gl, calls, canvas };
}
const mesh = () => ({ vao: { id: 'vao-m' }, buffers: [], subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 1 }] });

test('AUDIT-EL F1/F12: the eye\'s image is ALWAYS on its unit - with the air off, in the studio bake; the terrain\'s unit 0 is a sampler2DArray (EL6: no AO sampler in a world shader any more)', () => {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE);   // the lane, no air: `?air=off`
  calls.length = 0;
  r.beginFrame(I, I, new Float32Array([0, 1, 0]), WORLD_FRAME);
  assert.ok(calls.some((c) => c[0] === 'uniform1i' && c[1] === 'uAdapt' && c[2] === AIR_ADAPT_UNIT), 'F1: uAdapt on unit 11');
  assert.ok(!calls.some((c) => c[1] === 'uAO' || c[1] === 'uAOInfo'), 'EL6: F12 cannot recur - no AO uniform exists in the world pass');
  const bare = calls.filter((c) => c[0] === 'texImage2D' && c[3] === 1 && c[4] === 1 && c[9]?.[0] === 128);
  assert.equal(bare.length, 1, 'one bare 1x1 image (the multiplier 1), minted once');
  // the terrain program too
  calls.length = 0;
  r.drawTerrain({ vao: {}, indexCount: 6 }, I, {}, {}, 6.4);
  assert.ok(calls.some((c) => c[0] === 'uniform1i' && c[1] === 'uAdapt' && c[2] === AIR_ADAPT_UNIT));
  assert.match(EL_TERRAIN_FS, /uniform sampler2DArray uTileArr;/, 'a different sampler type on unit 0: two types on one unit is INVALID_OPERATION at draw');
  // the studio bake takes the bare image even with the air on
  r.setAir(true);
  r.textures.set('1_1', {});
  r.beginFrame(I, I, new Float32Array([0, 1, 0]), WORLD_FRAME);
  const eye = r.air.adaptTexture;
  calls.length = 0;
  r.renderCharacterSpriteImage({ vao: {}, count: 3 }, I, I, I, 8, 8);
  const binds = calls.filter((c) => c[0] === 'bindTexture' && c[2] && c[2] !== eye);
  assert.ok(calls.some((c) => c[0] === 'activeTexture' && c[1] === 1000 + AIR_ADAPT_UNIT), 'the eye\'s unit is bound in the bake');
  assert.ok(!calls.some((c) => c[0] === 'bindTexture' && c[2] === eye), 'F1: never the world\'s eye - an icon baked in a dark dungeon would be a brighter icon');
  assert.ok(binds.length > 0);
  assert.equal(r._studioDepth, 0, 'the studio depth returns');
});

test('AUDIT-EL F2 (EL6): a foreign rect takes no AO because no world shader takes any - the AO is the resolve\'s alone, over the world rect, and 0 with no frame prepared', () => {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE); r.setAir(true);
  r.textures.set('1_1', {});
  r.beginFrame(I, I, new Float32Array([0, 1, 0]), WORLD_FRAME);
  r.drawMesh(mesh(), I, null);
  calls.length = 0;
  r.renderCharacterSprite({ vao: {}, count: 3 }, I, I, I, 8, 8);
  assert.ok(!calls.some((c) => c[1] === 'uAOInfo' || c[1] === 'uAO'), 'the sprite pass: no AO uniform at all');
  assert.equal(r._spriteDepth, 0);
  calls.length = 0;
  r.drawScreenQuad({ id: 'hud' }, { x: 0, y: 0, w: 10, h: 10 });
  const mix = calls.find((c) => c[0] === 'uniform1f' && c[1] === 'uAOMix');
  assert.ok(mix && mix[2] > 0, 'the resolve applies the AO over the world rect');
  const ao = read('src/render/airPass.js');
  assert.match(ao, /if \(wuv\.x >= 0\.0 && wuv\.x <= 1\.0 && wuv\.y >= 0\.0 && wuv\.y <= 1\.0\) \{\n    c \*= mix\(1\.0, texture\(uAO, wuv\)\.r, uAOMix\);/, 'inside the world rect alone');
});

test('AUDIT-EL F3: the water surface takes sixteen of the lane\'s forty-eight, raw', () => {
  const r = read('src/render/renderer.js');
  assert.match(r, /const count = Math\.min\(this\._pointLights\.length \/ 4, CLASSIC_MAX_LIGHTS\);\n\s+gl\.uniform1i\(L\.pointCount, count\);/);
  assert.match(r, /gl\.uniform3fv\(L\.pointColors, this\._pointColorData\(count, true\)\);/, 'raw colours for a classic-space program');
  assert.match(read('src/render/waterSurface.js'), /uniform vec4 uPointLights\[16\];/);
});

test('AUDIT-EL F4: the player-light composer keeps every light; the cap is the installed set\'s', () => {
  assert.ok(!/16 - live\.length/.test(read('src/scenes/magicCandle.js')), 'no sixteen in the composer');
  assert.match(read('src/scenes/magicCandle.js'), /const keep = \(base\.length \/ 4\) \* 4;/);
});

test('AUDIT-EL F5/F8: a WORLD frame spends the records; a second beginFrame (the travel map) resolves the frame owed and keeps them; the six host sites say so; the map resolves its own', () => {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE); r.setAir(true);
  r.textures.set('1_1', {});
  r.beginFrame(I, I, new Float32Array([0, 1, 0]), WORLD_FRAME);
  r.drawMesh(mesh(), I, null);
  assert.equal(r.shadows.count, 1);
  r.drawScreenQuad({ id: 'hud' }, { x: 0, y: 0, w: 10, h: 10 });   // the HUD resolves the world's frame
  // the travel map opens its own frame after the HUD: no passes, the records kept, a frame bound
  calls.length = 0;
  r.beginFrame(I, I, new Float32Array([0, 1, 0]));
  assert.equal(r.shadows.count, 1, 'the world\'s casters survive the map\'s frame');
  assert.equal(calls.filter((c) => c[0] === 'clear' && c[1] === 256).length, 0, 'no depth pass ran for the map');
  assert.equal(frameTarget(), r.air.frame.fbo, 'the map draws into a frame');
  assert.equal(r.air.pending, true);
  // the map draws no screen quad in its 'map' phase: it resolves itself
  calls.length = 0;
  r.resolveFrame();
  assert.ok(calls.some((c) => c[0] === 'uniform4fv' && c[1] === 'uGrade'), 'resolved');
  assert.equal(frameTarget(), null); assert.equal(r.air.pending, false);
  // a frame still owed at the next beginFrame (a map that forgot) is resolved there, before anything else
  r.beginFrame(I, I, new Float32Array([0, 1, 0]));
  calls.length = 0;
  r.beginFrame(I, I, new Float32Array([0, 1, 0]), WORLD_FRAME);
  const resolve = calls.findIndex((c) => c[0] === 'uniform4fv' && c[1] === 'uGrade');
  const clear = calls.findIndex((c) => c[0] === 'clear' && c[1] === 16384 + 256);
  assert.ok(resolve >= 0 && resolve < clear, 'the owed frame reaches the canvas before this one clears');
  assert.equal(r.shadows.count, 0, 'and the world frame spent the records');
  // a panel frame keeps them too (F8)
  r.drawMesh(mesh(), I, null);
  r.drawScreenQuad({ id: 'hud' }, { x: 0, y: 0, w: 10, h: 10 });
  r.panelFrame({ proj: I, view: I, lightDir: new Float32Array([0, 1, 0]), rect: { x: 0, y: 0, w: 100, h: 100 } }, () => {
    assert.equal(r.shadows.count, 1, 'F8: the world\'s casters survive a panel frame');
  });
  // the hosts
  for (const [f, n] of [['src/scenes/world.js', 1], ['src/scenes/exterior.js', 1], ['src/scenes/dungeon.js', 1], ['src/scenes/interior.js', 1], ['src/scenes/worldModes.js', 2]]) {
    assert.equal((read(f).match(/renderer\.beginFrame\([^;]*, WORLD_FRAME\);/g) || []).length, n, `${f}: ${n} world frame(s)`);
    assert.equal((read(f).match(/renderer\.beginFrame\(/g) || []).length, n, `${f}: no unmarked beginFrame`);
  }
  for (const f of ['src/ui/overworldMap.js', 'src/ui/videoPlayer.js', 'src/scenes/menu.js']) assert.ok(!/WORLD_FRAME/.test(read(f)), `${f}: not a world frame`);
  assert.match(read('src/ui/overworldMap.js'), /renderer\.markForeignPass\(\);\n\s+renderer\.resolveFrame\?\.\(\);/, 'the map resolves after its relief');
});

test('AUDIT-EL F6: the dungeon\'s fog colour goes down with its ambient; the two hosts hand it through', () => {
  const fog = { mode: 'linear', density: 0, start: 0, end: 40, color: [0.5, 0.4, 0.3] };
  assert.equal(dungeonFog(false, fog), fog);
  const d = dungeonFog(true, fog);
  assert.ok(near(d.color[0], 0.5 * EL_DUNGEON_AMBIENT_SCALE) && near(d.color[2], 0.3 * EL_DUNGEON_AMBIENT_SCALE) && d.end === 40 && d.mode === 'linear');
  assert.equal(dungeonFog(true, null), null);
  assert.match(read('src/scenes/dungeon.js'), /const _fog = dungeonFog\(lightingOn, betterAmbience\.dungeonFog\(\) \?\? DUNGEON_FOG\); applyFog\(renderer, ctx\.underwaterFogSettings\?\.\(cam\.pos\[1\], player\.pos, _fog\) \?\? _fog\);/);
  assert.match(read('src/scenes/worldModes.js'), /const _fog = dungeonFog\(!!renderer\.lightingLane, betterAmbience\.dungeonFog\(\) \?\? DUNGEON_FOG\); applyFog\(renderer, dungeonCtx\.underwaterFogSettings\?\.\(cam\.pos\[1\], player\.pos, _fog\) \?\? _fog\);/);
});

test('AUDIT-EL F7: a panel frame draws on the classic set, and the lane comes back after it', () => {
  const { canvas } = recordingGl();
  const r = new Renderer(canvas);
  const classicMesh = r.program;
  r.setLightingLane(EL_LANE);
  const laneMesh = r.program;
  assert.notEqual(laneMesh, classicMesh);
  r.panelFrame({ proj: I, view: I, lightDir: new Float32Array([0, 1, 0]), rect: { x: 0, y: 0, w: 100, h: 100 } }, () => {
    assert.equal(r.program, classicMesh, 'the classic mesh program inside the bracket');
    assert.equal(r.lightingLane, null, 'no lane: no decode, no tonemap, no eye');
  });
  assert.equal(r.program, laneMesh, 'the lane\'s programs back');
  assert.equal(r.lightingLane, EL_LANE);
  assert.equal(r._panelLane, null);
});

test('AUDIT-EL F10/F11: no measure off an empty frame; the storm\'s flash is neither the caster nor a glare', () => {
  assert.equal(SHADOW_CASTER_MAX_RANGE, 120); assert.equal(AIR_GLARE_MAX_RANGE, 120);
  const eye = [0, 1.5, 0];
  const lights = new Float32Array([0, 30, 0, 800, 8, 2, 0, 12]);
  assert.equal(pickShadowCaster(lights, eye), 1, 'the flash (range 800 over the player) is passed over for the torch');
  assert.equal(pickShadowCaster(new Float32Array([0, 30, 0, 800]), eye), -1, 'the flash alone is none');
  assert.match(read('src/render/airPass.js'), /if \(!\(range > 0\) \|\| range > AIR_GLARE_MAX_RANGE\) continue;/);
  assert.match(read('src/render/airPass.js'), /this\.measured = !!\(sp && sp\.count > 0\);/);
  assert.match(read('src/render/airPass.js'), /if \(this\.measured\) \{\n\s+quad\(P\.lum, this\.lum\);/, 'the luminance and the step ride the measure');
});

test('AUDIT-EL F13 (EL6): the emission replay faces each flat as its record was drawn; the sun map faces the sun', () => {
  const { calls, canvas } = recordingGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE); r.setAir(true);
  r.textures.set('210_1', {}); r.emissionTextures.set('210_1', { id: 'emis' });
  r.beginFrame(I, I, new Float32Array([0.3, 0.8, -0.2]), WORLD_FRAME);
  const right = new Float32Array([0.6, 0, 0.8]), up = new Float32Array([0, 1, 0]);
  r.drawBillboards([{ archive: 210, record: 1, vao: {}, indexCount: 6, size: { w: 1, h: 2 }, origin: [1, 0, 1] }], right, up);
  calls.length = 0;
  r.drawScreenQuad({ id: 'hud' }, { x: 0, y: 0, w: 10, h: 10 });   // EL6: the resolve replays THIS frame's emitters, off their records
  let rights = calls.filter((c) => c[0] === 'uniform3fv' && c[1] === 'uRight').map((c) => [...c[2]].map((v) => +v.toFixed(3)));
  assert.ok(rights.some((v) => v[0] === 0.6 && v[2] === 0.8), 'the emitter drew with the camera\'s right');
  assert.equal(r.air.stats.emitDraws, 1);
  calls.length = 0;
  r.beginFrame(I, I, new Float32Array([0.3, 0.8, -0.2]), WORLD_FRAME);
  rights = calls.filter((c) => c[0] === 'uniform3fv' && c[1] === 'uRight').map((c) => [...c[2]].map((v) => +v.toFixed(3)));
  assert.ok(rights.length > 0 && rights.every((v) => !(v[0] === 0.6 && v[2] === 0.8)), 'the sun map drew it facing the sun');
  assert.match(read('src/render/airPass.js'), /gl\.uniform3fv\(P\.emitBb\.uRight, r\.right\); gl\.uniform3fv\(P\.emitBb\.uUp, r\.up\);/);
  assert.ok(!/sp\.replay\(/.test(read('src/render/airPass.js')), 'EL6: no depth replay - the frame\'s own depth');
});

test('AUDIT-EL F14/F15/F17/F20: the shade\'s pull is the constant; the biases are in the spaces they mean; no variable hides a built-in; the emitters bloom in linear', () => {
  assert.match(EL_BB_FS, new RegExp(`if \\(uConceal\\.x == 2\\.0\\) lit \\*= ${String(SHADE_DARK).replace('.', '\\.')};`), 'F14: SHADE_DARK interpolated');
  assert.ok(!/uShadeDark/.test(EL_BB_FS));
  assert.equal(SHADOW_SUN_BIAS, 0.00005); assert.equal(SHADOW_POINT_BIAS, 0.04);
  assert.match(SHADOW_GLSL, /float ref = p\.z - 0\.00005;/, 'F15: the sun\'s bias, 0.06 units of the 1200-unit box');
  assert.match(SHADOW_GLSL, /float ref = cubeDepthOfM\(m - 0\.04, far\);/, 'F15: the lantern\'s bias in world units off the major axis');
  assert.ok(near(cubeDepthOfM(5, 20), cubeDepthRef(5, 0, 0, 20)), 'the M form is the reference');
  assert.ok(cubeDepthOfM(0.01, 20) === cubeDepthOfM(SHADOW_POINT_NEAR, 20), 'inside the near plane clamps');
  for (const f of ['src/render/shadowPass.js', 'src/render/airPass.js', 'src/render/enhancedLighting.js']) {
    assert.ok(!/\b(float|vec2|vec3|vec4|int)\s+step\b/.test(read(f)), `${f}: F17 - no variable named step`);
  }
  assert.match(EMIT_MESH_FS, /airDecode\(texture\(uEmissionTex, vUV\)\.rgb \* uEmissionColor\)/, 'F20');
  assert.match(EMIT_BB_FS, /airDecode\(texture\(uEmissionTex, vUV\)\.rgb\)/, 'F20');
  assert.match(EL_MESH_FS, /float spec = pow/, 'the glint survived the audit');
});

test('AUDIT-EL F16/F18/F19: the eye measures the scene with itself divided out over sixteen taps; a hidden canvas draws no images; the passes end with a real unbind', () => {
  const a = read('src/render/airPass.js');
  assert.match(a, /acc \+= log2\(max\(dot\(c, vec3\(0\.2126, 0\.7152, 0\.0722\)\) \/ prev, 1e-9\)\);/, 'F16: divided by the eye');
  assert.match(a, /for \(int y = 0; y < 4; y\+\+\) \{\n\s+for \(int x = 0; x < 4; x\+\+\) \{/, 'F16: sixteen taps per texel');
  assert.match(a, /if \(!\(w > 0 && h > 0\)\) \{ this\.f = null; return; \}   \/\/ AUDIT-EL F18/);
  assert.match(a, /if \(!\(W > 0 && H > 0\)\) return null;   \/\/ AUDIT-EL F18/);
  assert.match(read('src/render/renderer.js'), /this\._restoreWorldViewport\(\);\n\s+this\.markForeignPass\(\);   \/\/ AUDIT-EL F19/);
  // a zero-size world viewport at beginFrame draws nothing and binds no frame
  setFrameTarget(null);   // the module-wide target another test's unresolved frame left
  const { canvas } = recordingGl();
  canvas.clientWidth = 0; canvas.clientHeight = 0;
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE); r.setAir(true);
  r.beginFrame(I, I, new Float32Array([0, 1, 0]), WORLD_FRAME);
  assert.equal(r._frameFbo, null); assert.equal(frameTarget(), null); assert.equal(r.air.targets, null);
});
