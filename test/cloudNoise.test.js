// VC2 - THE CLOUD NOISE AND THE RENDER TARGET (2026-09-07). The
// volumetric cloud arc's first machinery: an offscreen target helper
// that obeys the upload law, and two tiling 3D noise volumes generated
// on the GPU. Node has no GL, so the shapes are pinned here and the
// pictures in tools/cloudNoiseProbe.mjs (10 checks on SwiftShader).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHAPE_SIZE, DETAIL_SIZE, NOISE_GLSL, SHAPE_FS, DETAIL_FS, SLICE_FS, NOISE_VS } from '../src/render/cloudNoise.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');

test('VC2: the noise volumes - sizes, a shared block with no uniform, every lattice taken modulo its period', () => {
  assert.equal(SHAPE_SIZE, 128); assert.equal(DETAIL_SIZE, 32);
  assert.doesNotMatch(NOISE_GLSL, /uniform/, 'the shared block declares no uniform - the AUDIT 47 sweep reads each template alone');
  assert.match(NOISE_GLSL, /hash33\(mod\(pi \+ c, period\)\)/, 'the gradient lattice wraps at its period');
  assert.match(NOISE_GLSL, /hash33\(mod\(qi \+ o, cells\)\)/, 'the Worley cells wrap at their count');
  assert.match(SHAPE_FS, /vec3 p = vec3\(gl_FragCoord\.xy \/ uSize, uZ\);/, 'a layer samples texel centres in [0,1)^3');
  assert.match(SHAPE_FS, /outColor = vec4\(pw, worleyFbm\(p, 8\.0\), worleyFbm\(p, 16\.0\), worleyFbm\(p, 32\.0\)\);/, 'R Perlin-Worley, G/B/A Worley at 8/16/32');
  assert.match(SHAPE_FS, /remap\(perlin, 0\.0, 1\.0, w4, 1\.0\)/, 'the Perlin-Worley dilates the billows by the low-frequency cells');
  assert.match(DETAIL_FS, /outColor = vec4\(worleyFbm\(p, 4\.0\), worleyFbm\(p, 8\.0\), worleyFbm\(p, 16\.0\), 1\.0\);/, 'the detail volume: Worley at 4/8/16');
  for (const t of [SHAPE_FS, DETAIL_FS, SLICE_FS, NOISE_VS]) assert.ok(t.startsWith('#version 300 es'), 'every template is a whole compilation unit');
  assert.match(SLICE_FS, /texture\(uVolume, vec3\(vUV \* uTiles, uZ\)\)/, 'the viewer tiles the volume so a seam would show');
  const src = read('src/render/cloudNoise.js');
  assert.match(src, /for \(let z = 0; z < volume\.size; z\+\+\) \{\s*\n\s*withVolumeLayer\(gl, volume, z, \(\) => \{\s*\n\s*gl\.uniform1f\(u\.uZ, \(z \+ 0\.5\) \/ volume\.size\);/, 'one draw per layer, at the layer\'s centre');
  assert.match(src, /finishVolume\(gl, volume, viewport\);/, 'the default framebuffer, the caller\'s viewport and the mip chain after the last layer');
  assert.doesNotMatch(src, /getParameter\(/, 'EV6: GL is never asked; the caller names the viewport');
});

test('VC2: the render target obeys the upload law - creation binds no framebuffer, draws and clears live on the draw paths', () => {
  const rt = read('src/render/renderTarget.js');
  const create = rt.slice(rt.indexOf('export function createRenderTarget'), rt.indexOf('export function withTarget'));
  assert.doesNotMatch(create, /bindFramebuffer|drawArrays|drawElements|clear\(|viewport\(/, 'createRenderTarget and createVolume: size and parameterise, nothing else');
  assert.match(create, /gl\.bindTexture\(gl\.TEXTURE_2D, null\);/); assert.match(create, /gl\.bindTexture\(gl\.TEXTURE_3D, null\);/);
  assert.match(create, /gl\.texImage3D\(gl\.TEXTURE_3D, 0, gl\.RGBA8, size, size, size, 0, gl\.RGBA, gl\.UNSIGNED_BYTE, null\);/);
  assert.match(create, /TEXTURE_WRAP_R, gl\.REPEAT\)/, 'a volume tiles on every axis');
  assert.match(rt, /export function withTarget\(gl, target, restoreViewport, draw\) \{\s*\n\s*gl\.bindFramebuffer\(gl\.FRAMEBUFFER, target\.fbo\);\s*\n\s*if \(!target\.attached\)/, 'the target attaches on its first draw');
  assert.match(rt, /gl\.bindFramebuffer\(gl\.FRAMEBUFFER, null\);\s*\n\s*gl\.viewport\(restoreViewport\[0\], restoreViewport\[1\], restoreViewport\[2\], restoreViewport\[3\]\);/, 'and leaves the default framebuffer and the caller\'s viewport');
  assert.match(rt, /gl\.framebufferTextureLayer\(gl\.FRAMEBUFFER, gl\.COLOR_ATTACHMENT0, volume\.tex, 0, z\);/, 'a volume is filled a layer at a time');
  assert.match(rt, /gl\.generateMipmap\(gl\.TEXTURE_3D\);/);
  assert.doesNotMatch(rt, /getParameter\(/, 'EV6 here too');
});

test('VC2: the lab door and the probe exist, and the AUDIT 47 sweep reads the new shader file', () => {
  const lab = read('src/tools/skyLab.js');
  assert.match(lab, /const noiseView = params\.get\('noise'\);/);
  assert.match(lab, /cloudNoise \?\?= new CloudNoise\(gl, \[0, 0, w, h\]\);/, 'generated once, with the lab\'s viewport to restore');
  assert.match(lab, /cloudNoise\.drawSlice\(noiseView, Number\(params\.get\('z'\) \?\? 0\.25\), ch, Number\(params\.get\('tiles'\) \?\? 1\)\);/);
  const probe = read('tools/cloudNoiseProbe.mjs');
  for (const q of ['noise=shape&z=0.25&ch=r&tiles=2', 'noise=shape&z=0&ch=r', 'noise=shape&z=1&ch=r', 'noise=detail&z=0.25&ch=r&tiles=2']) assert.ok(probe.includes(q), `the probe shoots ${q}`);
  assert.match(read('test/glstate.test.js'), /'src\/render\/cloudNoise\.js'/, 'every uniform the generators use is declared where it is used');
});
