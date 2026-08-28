// LT1 - the per-light colour channel. AddLight's second switch
// (DaggerfallInterior.cs:1034-1151) had all three columns transcribed
// and only RANGE reached the GPU; the vec3 channel closes the gap:
// nearestLights' colorOf arm rides the ONE distance sort, setPointLights
// carries the parallel colour array, the four fragment shaders
// accumulate a vec3 weighted by uPointColors[i], and a host that passes
// no colours gets the shared colour splatted - the exterior lantern
// path, bit-identical to the old scalar channel.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { nearestLights } from '../src/world/cityLights.js';
import { withPlayerLights } from '../src/scenes/magicCandle.js';
import { Renderer } from '../src/render/renderer.js';
import { interiorLightProperties } from '../src/world/interiorLights.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(ROOT, 'src', p), 'utf8');

const LIGHTS = [
  { x: 10, y: 0, z: 0, range: 5, color: [1, 0, 0] },   // far
  { x: 1, y: 0, z: 0, range: 7, color: [0, 1, 0] },    // nearest
  { x: 4, y: 0, z: 0, range: 9, color: [0, 0, 1] },    // middle
];

// ---------------------------------------------------------------
// 1. nearestLights' colorOf arm - one sort, two parallel arrays
// ---------------------------------------------------------------

test('LT1: colorOf pairs colours with the SAME pick order as the vec4 data', () => {
  const ranges = LIGHTS.map((l) => l.range);
  const { data, colors } = nearestLights(LIGHTS, [0, 0, 0], 2, ranges, (l) => l.color);
  assert.equal(data.length, 2 * 4);
  assert.equal(colors.length, 2 * 3);
  // nearest-first: the green light at x=1, then the blue at x=4
  assert.deepEqual([data[0], data[3]], [1, 7], 'nearest light first, with ITS range');
  assert.deepEqual([...colors.slice(0, 3)], [0, 1, 0]);
  assert.deepEqual([data[4], data[7]], [4, 9]);
  assert.deepEqual([...colors.slice(3, 6)], [0, 0, 1], 'the middle light keeps its own colour beside its own vec4');
});

test('LT1: without colorOf the return is the bare vec4 array - the lantern callers unchanged', () => {
  const out = nearestLights(LIGHTS, [0, 0, 0], 2, 18);
  assert.ok(out instanceof Float32Array, 'no wrapper object appears');
  assert.equal(out.length, 8);
});

// ---------------------------------------------------------------
// 2. withPlayerLights' paired shape - one cap, both arrays
// ---------------------------------------------------------------

test('LT1: the paired shape prepends player lights to BOTH arrays under the one cap', () => {
  const base = nearestLights(LIGHTS, [0, 0, 0], 3, LIGHTS.map((l) => l.range), (l) => l.color);
  const torch = { x: 0, y: 1, z: 0, range: 6 };
  const candle = { x: 0, y: 2, z: 0, range: 4, color: [0.5, 0.5, 0.25] };
  const out = withPlayerLights(base, candle, torch);
  assert.equal(out.data.length / 4, 5);
  assert.equal(out.colors.length / 3, 5, 'the arrays stay in lockstep');
  // the candle's own colour leads; the colourless torch wears white -
  // the look the shared channel always gave it
  assert.deepEqual([...out.colors.slice(0, 3)], [0.5, 0.5, 0.25]);
  assert.deepEqual([...out.colors.slice(3, 6)], [1, 1, 1]);
  // the base lights follow, colours still beside their own vec4s
  assert.equal(out.data[2 * 4], 1, 'nearest base light after the player lights');
  assert.deepEqual([...out.colors.slice(6, 9)], [0, 1, 0]);
});

test('LT1: the paired cap drops FAR lights, never the player\'s own', () => {
  const many = Array.from({ length: 16 }, (_, i) => ({ x: i + 1, y: 0, z: 0, range: 5, color: [i / 16, 0, 0] }));
  const base = nearestLights(many, [0, 0, 0], 16, many.map((l) => l.range), (l) => l.color);
  const out = withPlayerLights(base, { x: 0, y: 0, z: 0, range: 3 });
  assert.equal(out.data.length / 4, 16, 'capped at the renderer\'s 16');
  assert.equal(out.colors.length / 3, 16);
  assert.equal(out.data[0], 0, 'the player light leads');
  assert.equal(out.data[15 * 4], 15, 'the 16th slot is the 15th base light - the farthest dropped');
  assert.ok(Math.abs(out.colors[15 * 3] - 14 / 16) < 1e-6, 'its colour dropped WITH it');
});

test('LT1: a paired base with no live player lights comes back untouched', () => {
  const base = nearestLights(LIGHTS, [0, 0, 0], 3, LIGHTS.map((l) => l.range), (l) => l.color);
  assert.equal(withPlayerLights(base, null, null), base);
});

// ---------------------------------------------------------------
// 3. the renderer's channel - store, splat, upload data
// ---------------------------------------------------------------

const rendererState = () => ({
  _pointLights: new Float32Array(0),
  _pointColor: new Float32Array([1, 1, 1]),
  _pointColors: null,
  _pointColorScratch: new Float32Array(16 * 3),
});

test('LT1: setPointLights stores the per-light colours and CLEARS them when a host passes none', () => {
  const r = rendererState();
  const colors = new Float32Array([1, 0.5, 0.25]);
  Renderer.prototype.setPointLights.call(r, new Float32Array(4), null, colors);
  assert.deepEqual([...r._pointColors], [...colors], 'stored (as a 16-light-capped view)');
  // the next scene sets lights without colours - the interior's array
  // must not leak into the dungeon frame that follows it
  Renderer.prototype.setPointLights.call(r, new Float32Array(4), new Float32Array([1, 1, 1]));
  assert.equal(r._pointColors, null);
});

test('LT1: _pointColorData answers the host array as-is, or the shared colour splatted across the count', () => {
  const r = rendererState();
  r._pointColor = new Float32Array([0.9, 0.8, 0.7]);
  const splat = Renderer.prototype._pointColorData.call(r, 3);
  assert.equal(splat.length, 9);
  assert.deepEqual([...splat.slice(3, 6)], [...r._pointColor], 'every slot wears the shared colour - the old scalar channel exactly');
  const own = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
  r._pointColors = own;
  assert.equal(Renderer.prototype._pointColorData.call(r, 2), own, 'a host array is uploaded verbatim');
});

// ---------------------------------------------------------------
// 4. the four shaders + the two hosts (source pins)
// ---------------------------------------------------------------

test('LT1: all four fragment shaders accumulate vec3 pointAcc off uPointColors[i]; the scalar channel is GONE', () => {
  const r = src('render/renderer.js');
  assert.equal((r.match(/uniform vec3 uPointColors\[16\]/g) ?? []).length, 4, 'the vec3 array in all four programs');
  assert.equal((r.match(/vec3 pointAcc = vec3\(0\.0\);/g) ?? []).length, 4);
  assert.equal((r.match(/\* uPointColors\[i\];/g) ?? []).length, 4, 'every accumulation weighted per light');
  assert.equal(/uniform vec3 uPointColor;/.test(r), false, 'the shared uniform left the shaders');
  assert.equal(/pointDiff/.test(r), false, 'no scalar accumulator survives');
});

test('LT1: both interior hosts feed colour x intensity from AddLight\'s own switch', () => {
  for (const host of ['scenes/worldModes.js', 'scenes/interior.js']) {
    assert.match(src(host), /\(l\) => \[l\.color\[0\] \* l\.intensity, l\.color\[1\] \* l\.intensity, l\.color\[2\] \* l\.intensity\]/,
      `${host} premultiplies intensity into the uploaded colour, the Unity light product`);
    assert.match(src(host), /setPointLights\(\w+\.data, null, \w+\.colors\)/,
      `${host} rides the paired channel`);
  }
  // and the values it feeds are the transcribed switch's: the Turkis
  // lamp's teal at full prefab intensity
  assert.deepEqual([...interiorLightProperties(8).color], [0.68, 1.0, 0.94]);
  assert.equal(interiorLightProperties(8).intensity, 1);
});
