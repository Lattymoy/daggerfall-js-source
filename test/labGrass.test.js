// GR1: the lab's grass, byte for byte, standing only where it may.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LAB_GRASS_HEAD, LAB_GRASS_VS, LAB_GRASS_FS, LAB_GRASS, LAB_DIM, placeLabGrass, grassRecordsOf, labBladeCorners } from '../src/render/labGrass.js';

const lab = () => readFileSync('grass-proto.html', 'utf8');

test('GR1: the shaders are the lab\u2019s own, verbatim, and the lab\u2019s height is 54', () => {
  const src = lab();
  const vsStart = src.indexOf('layout(location=0) in vec2 aCorner;      // one blade quad, 0..1\nlayout(location=1) in vec4 aInst;        // xz, height, phase');
  const vsEnd = src.indexOf('}`, HEAD + `', vsStart) + 1;
  const fsStart = src.indexOf('in float vT; in float vTint; in float vFade; in float vLam; in float vSnow; in float vWet;', vsEnd);
  const fsEnd = src.indexOf('}`);', fsStart) + 1;
  assert.ok(vsStart > 0 && fsStart > 0);
  assert.equal(LAB_GRASS_VS, src.slice(vsStart, vsEnd), 'the vertex stage is the lab\u2019s text, byte for byte');
  assert.equal(LAB_GRASS_FS, src.slice(fsStart, fsEnd), 'the fragment stage is the lab\u2019s text, byte for byte');
  const headStart = src.indexOf('const HEAD = `');
  assert.equal(LAB_GRASS_HEAD, src.slice(headStart + 'const HEAD = `'.length, src.indexOf('`;', headStart)));
  // the lab itself: height 54, and the maxima the game uses
  assert.match(src, /const state = \{ density: 1200000, height: 54,/, 'the lab\u2019s default height is 54');
  assert.match(src, /id="height" type="range" min="10" max="120" step="1" value="54"/);
  assert.match(src, /id="density" type="range" min="20000" max="1200000"/);
  assert.match(src, /id="range" type="range" min="10" max="200"/);
  assert.deepEqual({ ...LAB_GRASS }, { density: 1200000, height: 54, range: 200, span: 210, seed: 0x2f6e2b1 }, 'max blades, max range, no exceptions');
  assert.equal(labBladeCorners().length / 2, 30, 'five stacked quads, the lab\u2019s blade');
  assert.deepEqual({ ...LAB_DIM }, { sunny: 1.00, cloudy: 0.90, overcast: 0.72, fog: 0.66, rain: 0.60, thunder: 0.46, snow: 0.80 });
});

test('GR1: the placer is the lab\u2019s law - same seed, span, clustering, height, lean, tint, width', () => {
  const src = lab();
  const b = src.slice(src.indexOf('function build() {'), src.indexOf('const vao = gl.createVertexArray();', src.indexOf('function build() {')));
  for (const law of ['let s = 0x2f6e2b1;', 'const SPAN = 210;', 'rr = rnd() * rnd() * 0.55', '(0.22 + rnd() * 0.42) * (state.height / 34)', '0.052 + rnd() * 0.055']) {
    assert.ok(b.includes(law), `the lab's build carries: ${law}`);
  }
  // the game's placer, run with everything kept, reproduces the lab's first blade exactly
  const g = placeLabGrass({ centre: [0, 0], keep: () => 0 });
  let s = 0x2f6e2b1;
  const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const cx = (rnd() - 0.5) * 420, cz = (rnd() - 0.5) * 420; const a = rnd() * 6.283, rr = rnd() * rnd() * 0.55;
  assert.ok(Math.abs(g.inst[0] - (cx + Math.cos(a) * rr)) < 1e-3 && Math.abs(g.inst[1] - (cz + Math.sin(a) * rr)) < 1e-3   /* Float32 storage */, 'the first blade is where the lab puts it');
  assert.ok(Math.abs(g.inst[2] - (0.22 + rnd() * 0.42) * (54 / 34)) < 1e-4, 'at the lab\u2019s height');
  assert.equal(g.count, 1200000, 'all 1,200,000 candidates when every one may stand');
  // and a candidate that may not stand is dropped without disturbing the sequence
  const h = placeLabGrass({ centre: [0, 0], keep: (x, z) => (x > 0 ? 0 : null) });
  assert.ok(h.count > 500000 && h.count < 700000, 'about half stand on the east side');
  for (let i = 0; i < h.count; i++) assert.ok(h.inst[i * 4] > 0, 'no blade stands where it may not');
});

test('GR1: grass records come from the archive\u2019s own texels - none for roads, water, or a winter archive', () => {
  const flat = (r, g, b) => { const c = new Uint8ClampedArray(64 * 64 * 4); for (let k = 0; k < 64 * 64; k++) { c[k * 4] = r; c[k * 4 + 1] = g; c[k * 4 + 2] = b; c[k * 4 + 3] = 255; } return { width: 64, height: 64, colors: c }; };
  const temperate = [flat(53, 94, 143), flat(134, 100, 65), flat(52, 76, 42), flat(80, 79, 81)];
  for (let r = 4; r < 56; r++) temperate.push(flat(52, 76, 42));   // every blend a lawn, for the test
  const g = grassRecordsOf(temperate);
  assert.ok(g.has(2) && g.has(10), 'the grass base and a grass blend are grass');
  assert.ok(!g.has(0), 'water is not');
  assert.ok(!g.has(46) && !g.has(47) && !g.has(55), 'a road record never is, whatever its texels');
  const winter = [flat(53, 94, 143), flat(209, 210, 216), flat(208, 209, 216), flat(207, 208, 215)];
  for (let r = 4; r < 56; r++) winter.push(flat(208, 209, 216));
  assert.equal(grassRecordsOf(winter).size, 0, 'a winter archive has no green base, so nothing is grass');
  // the host: the near ring, the season, the sea plane, the record
  const w = readFileSync('src/scenes/world.js', 'utf8');
  assert.match(w, /p\._stride === 1 && p\.tilemapBytes && p\.season !== SEASON\.Winter/, 'near ring only, never in winter');
  assert.match(w, /if \(rec === 0 \|\| !grass \|\| !grass\.has\(rec\)\) return null;/, 'a water record or a non-grass record: no blade');
  assert.match(w, /if \(h <= sea\) return null;/, 'under the sea plane: no blade');
  assert.match(w, /Math\.hypot\(ex - labGrassCentre\[0\], ez - labGrassCentre\[1\]\) > 60/, 'the scatter follows the eye');
  assert.match(w, /labGrass\.draw\(proj, view, new Float32Array\(cam\.pos\), now \/ 1000,/);
  assert.match(w, /renderer\.markForeignPass\(\);   \/\/ EV6: the grass changed programs/);
});

test('AUDIT 49: the grass is double-sided, follows the origin, learns its records whenever missing, and carries the gust', () => {
  const g = readFileSync('src/render/labGrass.js', 'utf8');
  const w = readFileSync('src/scenes/world.js', 'utf8');
  // F1: the lab never enables CULL_FACE; the world renderer does at every
  // frame; drawn culled, every blade whose winding faced away vanished
  assert.match(g, /const culled = gl\.isEnabled\(gl\.CULL_FACE\);\s*\n\s*if \(culled\) gl\.disable\(gl\.CULL_FACE\);/);
  assert.match(g, /gl\.disable\(gl\.BLEND\);\s*\n\s*if \(culled\) gl\.enable\(gl\.CULL_FACE\);/, 'and put back as it was found');
  assert.ok(!/CULL_FACE/.test(readFileSync('grass-proto.html', 'utf8')), 'the lab itself never culls');
  // F2: the scatter is baked in world coordinates; an origin shift re-places it
  assert.match(w, /exteriorFoes\.offsetAll\(r\.offset\);[^\n]*\n\s*labGrassCentre = null;/, 'the origin shift forces a re-place');
  // F3: the records are learned whenever missing, not only on a tile-cache miss
  assert.match(w, /if \(!grassRecords\.has\(groundArchive\)\) \{\s*\n\s*const layers = \[\];/);
  assert.ok(!/renderer\.uploadTileArray\(groundArchive, layers\);\s*\n[^}]*grassRecords\.set/.test(w), 'not inside the cache-miss block');
  // F4: uWind carries the gust, as the lab's WIND.speed does; uWindV does not
  assert.match(w, /speed: slider \* gustG, windV: \[dir\[0\] \* slider \* 0\.16, dir\[1\] \* slider \* 0\.16\]/);
});
