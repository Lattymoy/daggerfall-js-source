// FIELD BUGS 2026-09-29 (the sea) #4 - "Water flickers from a distance" (the Discord, through Mac). Reproduced on a real
// GL pipeline first (tools/fbseaWaterProbe.mjs, SwiftShader, a 24-bit depth buffer): a synthetic coast drawn by the
// port's own passes, the camera bobbed by centimetres as a deck bobs it. Two causes, both the port's:
//   - Come Sail Away's breakers boiled: the mod's frames are one level each (point-filtered, m_MipCount 1), tiled ten
//     times over strips hundreds of metres long, so from a few hundred metres a pixel picked one texel of dozens - a
//     different one each bob. 72-99% of a strip's pixels changed from bob to bob at 150 m and more from the eye, at
//     every height the camera stands at; with the chains the frames now carry, 1-8% (the level's own texel edges).
//   - The sea's sheets, a few centimetres apart, fought in a buffer that parts them at no more than a few hundred
//     metres from a raised eye: the beach under Iliac Puddle No More's top and the breakers over it flickered from
//     the sea zoom's 66-140 m (23-97% of the beach's pixels); in window depth - each sheet's place in the stack - none.
// These tests pin the laws the probe measured: the stack, each pass in its place in it, and the frames' chains and the
// shader that reads them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WATER_LAYER_UNITS } from '../src/render/waterSurface.js';
import { SNOW_LAYER } from '../src/render/snowfallGlsl.js';
import { DeepWatersRenderer } from '../src/render/deepWatersRender.js';
import { ComeSailAwayRenderer, WAVE_FS } from '../src/render/comeSailAwayRender.js';
import { boxLevels, wavePaintLevels, wavePictureMean } from '../src/systems/comeSailAwayWaves.js';
import { composeTiledPicture } from '../src/formats/derivedTexture.js';
import { readPng } from '../tools/pngIO.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const WORLD = read('src/scenes/world.js');
const RENDERER = read('src/render/renderer.js');

/** A GL that records what a pass asks of it: the capability switched, the offset set, the program used, the draws. */
function recordingGl() {
  let ids = 0;
  const log = [];
  const consts = { POLYGON_OFFSET_FILL: 32823, TEXTURE0: 33984, TEXTURE1: 33985, TEXTURE2: 33986 };
  const programs = new Map();
  let shaderSrc = null;
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in consts) return consts[k];
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'shaderSource') return (_s, src) => { if (/gl_FragColor|outColor/.test(src)) shaderSrc = src; };
      if (k === 'createProgram') return () => { const p = { id: ++ids }; programs.set(p, null); return p; };
      if (k === 'linkProgram') return (p) => { programs.set(p, shaderSrc); };
      if (k === 'useProgram') return (p) => log.push(['use', programs.get(p)?.includes('gl_FragDepth = 0.99999') ? 'top far' : programs.get(p)?.includes('TransparentWaterSurfaceUnderside') ? 'under' : programs.get(p)?.includes('uUnderwater > 0.5') ? 'top' : 'program']);
      if (k === 'enable' || k === 'disable') return (cap) => { if (cap === consts.POLYGON_OFFSET_FILL) log.push([k, 'offset']); };
      if (k === 'polygonOffset') return (factor, units) => log.push(['polygonOffset', factor, units]);
      if (k === 'drawElements') return () => log.push(['draw']);
      if (typeof k === 'string' && k.startsWith('create')) return () => ({ id: ++ids });
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return () => {};
    },
  });
  const renderer = { gl, _proj: new Float32Array(16), _view: new Float32Array(16), _camPos: [0, 40, 0], _dwFog: new Float32Array(20), _focus: new Float32Array(4), _fogColor: [0.5, 0.6, 0.7], _fogMode: 0, _fogDensity: 0, _fogRange: [0, 1], _ambient: [0.5, 0.5, 0.5], _sunColor: [1, 1, 1], _sunScale: 1, _lightDir: [0, 1, 0], markForeignPass() {} };
  return { gl, renderer, log };
}
/** The draws between the offset switched on (at `units`) and off, and every draw outside it. */
function layered(log) {
  const inside = [], outside = [];
  let units = null;
  for (const e of log) {
    if (e[0] === 'enable' && e[1] === 'offset') units = 'on';
    else if (e[0] === 'polygonOffset' && units === 'on') units = e[2];
    else if (e[0] === 'disable' && e[1] === 'offset') units = null;
    else if (e[0] === 'draw') (units === null ? outside : inside).push(units);
  }
  return { inside, outside };
}

test('FIELD BUGS 2026-09-29 (the sea) #4: THE SEA\'S STACK IN WINDOW DEPTH - the surface film two resolvable steps over the ground under it, the breakers four over the film; the constant term alone (WATER-AUDIT M3\'s: no slope factor to pull the sea in front of a hull) (mutants: a sheet at the ground\'s nought, the breakers under the film)', () => {
  assert.deepEqual({ ...WATER_LAYER_UNITS }, { surface: -2, breakers: -6 });
  assert.ok(Object.isFrozen(WATER_LAYER_UNITS));
  assert.ok(WATER_LAYER_UNITS.surface < 0, 'the film over the ground');
  assert.ok(WATER_LAYER_UNITS.breakers <= WATER_LAYER_UNITS.surface - 2, 'the breakers over the film, by more than the film is over the ground');
  // WATER1 wears the film's place (it met the law first - WATER-AUDIT M3's offset, now the table's)
  const water1 = RENDERER.slice(RENDERER.indexOf('  drawWaterSurfaces(rows, n, tileSize, u, tileDim = 128) {'));
  assert.match(water1, /gl\.enable\(gl\.POLYGON_OFFSET_FILL\);\n\s+gl\.polygonOffset\(0, WATER_LAYER_UNITS\.surface\);/);
  // AUDIT ENVIRONS (the snow's pass, its own `Offset -0.25, -0.25`): the world renderer's one other offset is the snow's
  // layer of this stack - a quarter step over the ground it lies on, under the film (the constant terms' order)
  const offsets = RENDERER.match(/gl\.polygonOffset\([^)]*\)/g) ?? [];
  assert.deepEqual(offsets.sort(), ['gl.polygonOffset(0, WATER_LAYER_UNITS.surface)', 'gl.polygonOffset(SNOW_LAYER.factor, SNOW_LAYER.units)'], 'no other offset in the world renderer to agree with it');
  assert.deepEqual({ ...SNOW_LAYER }, { factor: -0.25, units: -0.25 });
  assert.ok(Object.isFrozen(SNOW_LAYER));
  assert.ok(WATER_LAYER_UNITS.surface < SNOW_LAYER.units && SNOW_LAYER.units < 0, 'the snow over the ground and under the film');
});

test('FIELD BUGS 2026-09-29 (the sea) #4: ILIAC PUDDLE NO MORE\'S TOP IS THE FILM - its every draw inside the film\'s layer, the far arm (its own depth written) and the underside outside it; Come Sail Away\'s breakers inside theirs; each switched off after (mutants: the top unlayered, the far arm layered, the breakers unlayered, a layer left on)', () => {
  const { renderer, log } = recordingGl();
  const dw = new DeepWatersRenderer(renderer);
  const part = { vao: {}, count: 6 };
  const list = [{ h: { surface: part }, model: new Float32Array(16) }, { h: { surface: part }, model: new Float32Array(16) }];
  const frame = { surfaceTexture: {}, underwater: false, liftY: 34.03, surfaceScroll: [0, 0], topColor: [0.1, 0.3, 0.5, 0.51], topDepthWrite: false };
  dw.drawSurfaces(list, frame);
  const top = layered(log);
  assert.deepEqual(top.inside, [-2, -2], 'the top, both pixels, in the film\'s place');
  assert.equal(top.outside.length, 2, 'the far arm outside it (gl_FragDepth is its own)');
  const topAt = log.findIndex((e) => e[0] === 'use' && e[1] === 'top'), farAt = log.findIndex((e) => e[0] === 'use' && e[1] === 'top far');
  const offAt = log.findIndex((e) => e[0] === 'disable' && e[1] === 'offset');
  assert.ok(topAt >= 0 && farAt > offAt && offAt > topAt, 'on for the top, off before the far arm');
  log.length = 0;
  dw.drawSurfaces(list, { ...frame, underwater: true, undersideColor: [0, 0, 0, 1], fogColor: [0, 0, 0, 1], undersideAlpha: 1, horizonColor: [0, 0, 0, 1], undersideFadeStart: 1, undersideFadeEnd: 2, columnFogStrength: 0 });
  assert.deepEqual(layered(log), { inside: [], outside: [null, null] }, 'the underside, from below: no film over anything');
  // the breakers
  log.length = 0;
  const csa = new ComeSailAwayRenderer(renderer);
  const px = (w, h, rgba) => ({ width: w, height: h, data: new Uint8Array(w * h * 4).map((_, i) => rgba[i % 4]) });
  csa.setWaveFrames({ paints: [px(4, 4, [255, 0, 255, 255])], snow: px(2, 2, [240, 240, 250, 255]), specs: [{ paint: 0, scroll: 0, tile: [0, 0], size: [4, 4] }] });
  const mesh = { vertices: new Float32Array(9), normals: new Float32Array(9), uvs: new Float32Array(6), indices: new Uint32Array([0, 1, 2]) };
  log.length = 0;
  csa.drawWaves({ position: [409.6, 34.1, 409.6], scale: 819.2, mesh, frame: 0 }, { start: 0.6, end: 0.75 });
  assert.deepEqual(layered(log), { inside: [-6], outside: [] }, 'the breakers in theirs');
  assert.deepEqual(log.at(-1), ['disable', 'offset'], 'and off after');
});

test('FIELD BUGS 2026-09-29 (the sea) #4: the breakers are drawn BEFORE the film - with the ground, written - so the film tests against their depth, lifted in the stack; the world keeps that order (mutants: the waves after the film)', () => {
  const waves = WORLD.indexOf('    if (!tvf) csaDrawWaves();');   // FIELD BUGS 2026-09-30b TV-SURF: gated on the travel view (PIN MOVED)
  const water1 = WORLD.indexOf('      renderer.drawWaterSurfaces(_waterRows, n, 6.4, wu);');
  const top = WORLD.indexOf('    if (deepWaters) drawDeepWatersSurfaces(now);');
  assert.ok(waves > 0 && water1 > waves && top > waves, 'the breakers before WATER1 and before the top');
});

test('FIELD BUGS 2026-09-29 (the sea) #4: A PICTURE\'S CHAIN - level 0 to 1 x 1 (GL\'s sizes, halved and floored), each level\'s texel the mean of the level-0 texels whose centres fall in it (floor((c + 0.5) x size_L / size_0)): an exact halving the mean of its four children, 640\'s odd tail (5 to 2 to 1) summed from the deepest level aligned with it - checked against the direct mean at every level of even, odd and mixed sizes (mutants: a child dropped, the tail\'s alignment, the rounding)', () => {
  const direct = (w0, h0, ch, d, w, h) => {
    const sum = new Float64Array(w * h * ch), n = new Uint32Array(w * h);
    for (let y = 0; y < h0; y++) for (let x = 0; x < w0; x++) {
      const t = Math.floor(((y + 0.5) * h) / h0) * w + Math.floor(((x + 0.5) * w) / w0);
      n[t]++;
      for (let c = 0; c < ch; c++) sum[t * ch + c] += d[(y * w0 + x) * ch + c];
    }
    return [...sum].map((v, i) => v / n[Math.floor(i / ch)]);
  };
  for (const [w0, h0, ch] of [[640, 640, 1], [96, 40, 2], [5, 3, 4], [7, 1, 1], [64, 64, 4], [1, 1, 1]]) {
    const d = new Uint8Array(w0 * h0 * ch).map((_, i) => (i * 37 + (i >> 5) * 11) % 256);
    const levels = boxLevels(w0, h0, ch, d);
    const sizes = [];
    for (let w = w0, h = h0, L = 0; ; L++) { sizes.push(`${Math.max(1, w0 >> L)}x${Math.max(1, h0 >> L)}`); if ((w0 >> L) <= 1 && (h0 >> L) <= 1) break; }
    assert.deepEqual(levels.map((l) => `${l.width}x${l.height}`), sizes, `${w0}x${h0}: GL's own sizes`);
    assert.deepEqual([...levels[0].data], [...d], 'level 0 the picture');
    assert.notEqual(levels[0].data, d, '...a copy of it');
    for (let L = 1; L < levels.length; L++) {
      const want = direct(w0, h0, ch, d, levels[L].width, levels[L].height);
      want.forEach((v, i) => assert.equal(levels[L].data[i], Math.floor(v + 0.5), `${w0}x${h0} level ${L} texel ${i}: the mean ${v}`));
    }
  }
});

test('FIELD BUGS 2026-09-29 (the sea) #4: A PAINT\'S CHAIN - level 0 the paint itself (its key kept: the mod\'s own read there), past it the mean of the frame it composes, premultiplied, the key standing for the snow record at its mean; the author\'s paints are 0 or 255 in alpha; the whole chain\'s last texel is the frame\'s coverage and colour as its texels count them (mutants: straight alpha, the key left as magenta, level 0 composed, the snow\'s mean)', () => {
  const tiny = wavePaintLevels({ width: 2, height: 1, data: new Uint8Array([200, 100, 50, 128, 255, 0, 255, 255]) }, [240, 244, 250]);
  assert.deepEqual([...tiny[0].data], [200, 100, 50, 128, 255, 0, 255, 255], 'level 0 the paint itself');
  assert.deepEqual([...tiny[1].data], [(100 + 240) / 2, (50 + 244) / 2, Math.floor((25 + 250) / 2 + 0.5), Math.floor((128 + 255) / 2 + 0.5)], 'past it the frame\'s mean, premultiplied, the key the snow\'s mean');
  assert.deepEqual(wavePictureMean({ width: 2, height: 1, data: new Uint8Array([200, 100, 0, 255, 100, 51, 10, 0]) }), [150, 76, 5], 'a picture\'s mean colour');
  for (const name of ['112395_2-base0.paint.png', '112395_2-base1.paint.png']) {
    const pic = readPng(readFileSync(new URL(`../vendor/come-sail-away/Textures/${name}`, import.meta.url)));
    const snow = [236, 238, 245];
    const levels = wavePaintLevels(pic, snow);
    assert.equal(levels.length, 10, '640 to 1');
    assert.equal(levels[0].data, pic.data, 'level 0 the decoded paint, uploaded as it is');
    let bad = 0;
    const sum = [0, 0, 0, 0], n = pic.width * pic.height;
    for (let i = 0; i < n; i++) {
      const o = i * 4, a = pic.data[o + 3];
      if (a !== 0 && a !== 255) bad++;
      const key = pic.data[o] === 255 && pic.data[o + 1] === 0 && pic.data[o + 2] === 255 && a === 255;
      const texel = key ? [...snow, 255] : [0, 1, 2].map((c) => Math.round((pic.data[o + c] * a) / 255)).concat(a);
      texel.forEach((v, c) => { sum[c] += v; });
    }
    assert.equal(bad, 0, `${name}: alpha 0 or 255 alone`);
    assert.deepEqual([...levels[9].data], sum.map((v) => Math.floor(v / n + 0.5)), `${name}: the last level the frame's mean`);
  }
});

test('FIELD BUGS 2026-09-29 (the sea) #4: THE SHADER READS THE CHAIN AT THE LEVEL NEAREST_MIPMAP_NEAREST WOULD - lambda from the texel footprint along the unwrapped uv (taken before any discard), level 0 to half a level past magnification, ceil(lambda + 1/2) - 1 past it, bounded by the chain; a level-0 texel\'s texel at L by the chain\'s own map; the snow at its own level; level 0 cut at half as the material cuts, a minified texel\'s coverage dithered by the material\'s Bayer table; the colour unpremultiplied (mutants: the half, the ceil, the level unbounded, the map\'s half texel, the cut at a level\'s mean)', () => {
  assert.match(WAVE_FS, /int waveLevel\(vec2 uv\) \{\n\s+vec2 t = uv \* vec2\(uFrameSize\);\n\s+vec2 dx = dFdx\(t\), dy = dFdy\(t\);\n\s+float lambda = min\(0\.5 \* log2\(max\(dot\(dx, dx\), dot\(dy, dy\)\)\), 32\.0\);[^\n]*\n\s+return lambda > 0\.5 \? min\(int\(ceil\(lambda \+ 0\.5\)\) - 1, uLastLevel\) : 0;/);
  assert.match(WAVE_FS, /ivec2 atLevel\(ivec2 c, ivec2 size0, ivec2 sizeL\) \{ return min\(ivec2\(\(vec2\(c\) \+ 0\.5\) \* vec2\(sizeL\) \/ vec2\(size0\)\), sizeL - 1\); \}/);
  assert.match(WAVE_FS, /if \(L > 0\) return texelFetch\(uPaint, atLevel\(at, uFrameSize, textureSize\(uPaint, L\)\), L\);\n\s+vec4 p = texelFetch\(uPaint, at, 0\);\n\s+if \(p == vec4\(1\.0, 0\.0, 1\.0, 1\.0\)\) \{/, 'past level 0 one fetch of the chain; at 0 the mod\'s own read');
  assert.match(WAVE_FS, /return vec4\(p\.rgb \* p\.a, p\.a\);/, 'level 0 premultiplied as the chain is (its alpha 0 or 1: the texel itself)');
  const main = WAVE_FS.slice(WAVE_FS.indexOf('void main() {'));
  assert.ok(main.indexOf('int L = waveLevel(vUv);') < main.indexOf('discard'), 'the level before any discard (the derivatives are the quad\'s)');
  assert.match(main, /if \(L == 0\) \{\n\s+if \(tex\.a \* uColor\.a - uCutoff < 0\.0\) discard;\n\s+\} else if \(tex\.a \* uColor\.a - BAYER\[\(\(px\.y \+ 4\) & 7\) \* 8 \+ \(\(px\.x \+ 4\) & 7\)\] \/ 255\.0 < 0\.0\) discard;/);
  assert.match(main, /vec4 c = vec4\(tex\.rgb \/ tex\.a, tex\.a\) \* uColor;/);
  // the level, restated: GL ES 3.0 3.8.10's NEAREST_MIPMAP_NEAREST with a NEAREST magnification filter
  const level = (texelsPerPixel, last = 9) => { const lambda = Math.min(Math.log2(texelsPerPixel), 32); return lambda > 0.5 ? Math.min(Math.ceil(lambda + 0.5) - 1, last) : 0; };
  assert.deepEqual([0.5, 1, 1.41, 1.42, 2.8, 2.9, 1e6, 0].map((r) => level(r)), [0, 0, 0, 1, 1, 2, 9, 0]);
});

test('FIELD BUGS 2026-09-29 (the sea) #4: A MINIFIED FRAME IS WHAT IT AVERAGES TO - the shader\'s texel at level L, restated over the chains, is the mean of the frame composeTiledPicture draws over that level\'s texel, coverage and premultiplied colour (the snow a uniform record, so the key\'s share times it is exact); at level 0 the frame\'s own texel (mutants: the key\'s share unweighted, the scroll at a level, the paint and the key at different texels)', () => {
  const W = 32, H = 32;
  const paint = { width: W, height: H, data: new Uint8Array(W * H * 4) };
  for (let i = 0; i < W * H; i++) {
    const r = (i * 2654435761) >>> 0;
    paint.data.set(r % 3 === 0 ? [255, 0, 255, 255] : [r & 255, (r >> 8) & 255, (r >> 16) & 255, r % 5 === 0 ? 0 : 255], i * 4);
  }
  const snow = { width: 4, height: 2, data: new Uint8Array(4 * 2 * 4).map((_, i) => (i % 4 === 3 ? 255 : [210, 220, 235][i % 4])) };
  const spec = { size: [W, H], scroll: 8, tile: [1, 1], key: 'ff00ffff' };
  const frame = composeTiledPicture(spec, snow, paint);
  const snowMean = wavePictureMean(snow);
  const chain = wavePaintLevels(paint, snowMean);
  const wrap = (a, n) => ((a % n) + n) % n;
  const at = (c, s0, sL) => Math.min(Math.floor(((c + 0.5) * sL) / s0), sL - 1);
  /** waveTexel(uv, L) for the frame's level-0 texel (x, y), in JS: premultiplied, over [0, 1]. */
  const texel = (x, y, L) => {
    const row = wrap(y + spec.scroll, H);
    if (L > 0) { const lv = chain[L], i = at(row, H, lv.height) * lv.width + at(x, W, lv.width); return [...lv.data.subarray(i * 4, i * 4 + 4)].map((v) => v / 255); }
    const i = (row * W + x) * 4, p = [...chain[0].data.subarray(i, i + 4)];
    if (p[0] === 255 && p[1] === 0 && p[2] === 255 && p[3] === 255) { const si = (wrap(y + spec.tile[1], snow.height) * snow.width + wrap(x + spec.tile[0], snow.width)) * 4; return [snow.data[si] / 255, snow.data[si + 1] / 255, snow.data[si + 2] / 255, 1]; }
    const a = p[3] / 255;
    return [(p[0] / 255) * a, (p[1] / 255) * a, (p[2] / 255) * a, a];   // vec4(p.rgb * p.a, p.a)
  };
  const own = chain;
  for (let L = 0; L < own.length; L++) {
    const lw = own[L].width, lh = own[L].height;
    for (let ty = 0; ty < lh; ty++) for (let tx = 0; tx < lw; tx++) {
      // the frame's texels this level's texel covers, as the chain maps them (the scroll is the paint's rows)
      const sum = [0, 0, 0, 0];
      let n = 0, rep = null;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (at(x, W, lw) !== tx || at(wrap(y + spec.scroll, H), H, lh) !== ty) continue;
        rep ??= [x, y];
        const o = (y * W + x) * 4, a = frame.data[o + 3] / 255;
        for (let c = 0; c < 3; c++) sum[c] += (frame.data[o + c] / 255) * a;
        sum[3] += a; n++;
      }
      const got = texel(rep[0], rep[1], L), want = sum.map((v) => v / n);
      got.forEach((v, c) => assert.ok(Math.abs(v - want[c]) <= 1.5 / 255, `level ${L} texel ${tx},${ty} channel ${c}: ${v} vs the frame's mean ${want[c]}`));
    }
  }
});

test('FIELD BUGS 2026-09-29 (the sea) #4: the waves\' pictures go up as chains - each paint\'s, level 0 to 1 x 1 - and the draw names the chain\'s last level; the snow stays the record\'s one level (mutants: the last level unnamed)', () => {
  const { renderer } = recordingGl();
  const csa = new ComeSailAwayRenderer(renderer);
  const px = (w, h) => ({ width: w, height: h, data: new Uint8Array(w * h * 4).fill(255) });
  csa.setWaveFrames({ paints: [px(640, 640), px(640, 640)], snow: px(64, 64), specs: [{ paint: 1, scroll: 0, tile: [0, 0], size: [640, 640] }] });
  assert.equal(csa._frames.paints.length, 2);
  assert.equal(csa._frames.lastLevel, 9, '640 to 1 in nine halvings');
  const src = read('src/render/comeSailAwayRender.js');
  assert.match(src, /gl\.uniform1i\(u\.uLastLevel, this\._frames\.lastLevel\);/);
  assert.match(src, /const chains = frames\.paints\.map\(\(p\) => wavePaintLevels\(p, snowMean\)\);/);
});
