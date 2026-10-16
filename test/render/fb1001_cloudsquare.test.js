// CLOUD-SQUARE (FIELD BUGS 2026-10-01 #3 - "Clouds in the distance sometimes look square"). The volumetric clouds are
// marched into a sky map a third of a degree a texel (two thirds on the low tier: 6 to 23 screen pixels), and the
// composite read it with ONE bilinear tap - so a far cloud a few texels across came out as soft squares and diamonds,
// the texel grid's creases. The composite reads it through a cubic B-spline now (four bilinear taps). The composite's
// own function, run in JS (test/glsl.mjs) over a hardware-bilinear stand-in: it keeps a flat map flat, puts no crease
// at a texel's centre where the one tap did, wraps round in azimuth as the map does, and is what the composite reads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMPOSITE_FS } from '../../src/render/volumetricClouds.js';
import { glslFunctions } from '../glsl.mjs';

const W = 16, H = 8;
/** GL_LINEAR over a W x H map: S repeats (the map's azimuth), T clamps (its rows) - the map's own sampler. */
function bilinear(map) {
  const at = (x, y) => map[Math.min(H - 1, Math.max(0, y)) * W + (((x % W) + W) % W)];
  return (_s, uv) => {
    const x = uv[0] * W - 0.5, y = uv[1] * H - 0.5;
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const v = (1 - fy) * ((1 - fx) * at(x0, y0) + fx * at(x0 + 1, y0)) + fy * ((1 - fx) * at(x0, y0 + 1) + fx * at(x0 + 1, y0 + 1));
    return [v, v, v, v];
  };
}
const fns = (map) => glslFunctions(COMPOSITE_FS, { texture: bilinear(map), textureSize: () => [W, H] });

test('CLOUD-SQUARE: the composite\'s B-spline keeps a flat map flat and wraps round in azimuth (mutants: a weight, a tap\'s offset)', () => {
  const flat = fns(new Array(W * H).fill(0.37));
  for (const uv of [[0.03, 0.5], [0.5, 0.21], [0.97, 0.9], [0.31, 0.02]]) {
    assert.ok(Math.abs(flat.mapBicubic(uv)[0] - 0.37) < 1e-9, `${uv}: a flat sky is the same sky`);
  }
  // a texel's worth of cloud at the map's seam: the azimuth wraps, so either side of it is one sky
  const map = new Array(W * H).fill(0); map[4 * W] = 1;
  const f = fns(map);
  for (const v of [0.4, 0.55, 0.6]) {
    const a = f.mapBicubic([-0.5 / W, v / 1])[0], b = f.mapBicubic([1 - 0.5 / W, v / 1])[0];
    assert.ok(Math.abs(a - b) < 1e-9, `the seam at row ${v}: ${a} and ${b}`);
  }
  // the response to one bright texel peaks at that texel and falls off on every side
  const c = f.mapBicubic([0.5 / W, 4.5 / H])[0];
  for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) assert.ok(f.mapBicubic([(0.5 + d[0]) / W, (4.5 + d[1]) / H])[0] < c, `falls toward ${d}`);
});

test('CLOUD-SQUARE: no crease at a texel\'s centre - the one bilinear tap made one, which is the square\'s edge (mutant: the composite reads the one tap)', () => {
  // one bright texel in a dark map: walk across its centre along the row
  const map = new Array(W * H).fill(0); map[4 * W + 8] = 1;
  const f = fns(map), one = bilinear(map);
  const y = 4.5 / H, cx = 8.5 / W, e = 1e-4 / W;
  const crease = (sample) => {
    const left = (sample(cx) - sample(cx - e)) / e, right = (sample(cx + e) - sample(cx)) / e;
    return Math.abs(left - right);
  };
  const tap = crease((x) => one('uMap', [x, y])[0]);
  const spline = crease((x) => f.mapBicubic([x, y])[0]);
  assert.ok(tap > 10, `the one tap turns sharply at the texel's centre (${tap.toFixed(2)})`);
  assert.ok(spline < tap * 0.01, `the B-spline does not (${spline.toFixed(4)} against ${tap.toFixed(2)})`);
  // ...and nowhere between: across a whole texel its slope changes smoothly, never in a step
  let worst = 0;
  for (let x = 7; x <= 10; x += 0.125) {
    const u = (x + 0.5) / W;
    const l = (f.mapBicubic([u, y])[0] - f.mapBicubic([u - e, y])[0]) / e, r = (f.mapBicubic([u + e, y])[0] - f.mapBicubic([u, y])[0]) / e;
    worst = Math.max(worst, Math.abs(l - r));
  }
  assert.ok(worst < tap * 0.01, `no step in the slope anywhere across the cloud (${worst.toFixed(4)})`);
  // the composite reads the map through it, and no longer through the one tap
  const main = COMPOSITE_FS.slice(COMPOSITE_FS.indexOf('void main()'));
  assert.match(main, /vec4 c = mapBicubic\(uv\);/);
  assert.doesNotMatch(main, /texture\(uMap, uv\)/);
});
