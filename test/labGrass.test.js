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

test('GR2: darker green and a billboard about Y in the lab and the game alike; one wind mapping; a time-sliced walk', async () => {
  const { placeLabGrass, placeLabGrassSteps, labWindSlider, LAB_GRASS_FS, LAB_GRASS_VS } = await import('../src/render/labGrass.js');
  // 1. darker green, in the lab's own text (the byte-exact pin above holds it in the game)
    // GR4: the ROOT is the ground's own colour now (see the GR4 pin); the
  // mid and tip keep GR2's darker green.
  assert.match(LAB_GRASS_FS, /vec3 root = vGround \* 0\.62;\s*\n\s*vec3 mid {2}= vec3\(0\.13,0\.20,0\.07\);\s*\n\s*vec3 tip {2}= vec3\(0\.24,0\.32,0\.12\);/,
    'GR2\u2019s darker mid and tip, on GR4\u2019s ground root');
  // 4. a blade's width runs ACROSS the line to the eye, not along world X
  assert.match(LAB_GRASS_VS, /vec2 toEye = uEye\.xz - root;\s*\n\s*vec2 side = length\(toEye\) > 1e-4 \? normalize\(vec2\(-toEye\.y, toEye\.x\)\) : vec2\(1\.0, 0\.0\);\s*\n\s*p\.xz \+= side \* \(aCorner\.x-0\.5\) \* aInst2\.w \* \(1\.0 - vT\*0\.75\);/);
  assert.ok(!/p\.xz \+= vec2\(aCorner\.x-0\.5\) \* aInst2\.w/.test(LAB_GRASS_VS), 'the flat-from-the-side form is gone');
  // 2. the sky's row on the lab's slider: sunny is the lab's default, storms reach the top
  assert.equal(Math.round(labWindSlider([0.010, 0.004])), 70, 'a sunny day is the lab\u2019s 70');
  assert.equal(labWindSlider([0.045, 0.016]), 200, 'a thunderstorm is the slider\u2019s top');
  assert.equal(labWindSlider([0, 0]), 0);
  const w = readFileSync('src/scenes/world.js', 'utf8');
  assert.equal((w.match(/labWindSlider\(w\)/g) || []).length, 2, 'the grass and the rain share the one mapping');
  assert.ok(!/mag \* 260/.test(w), 'the guessed scale is gone');
  assert.match(readFileSync('src/scenes/exterior.js', 'utf8'), /labWindSlider\(w\)/, 'the exterior host too');
  // 3. the walk is a generator that yields, and lands where the one-shot lands
  const keep = (x) => (x > 0 ? 0 : null);
  const whole = placeLabGrass({ centre: [3, 4], keep });
  const it = placeLabGrassSteps({ centre: [3, 4], keep, step: 100000 }); let yields = 0; let r = it.next();
  while (!r.done) { yields++; r = it.next(); }
  assert.equal(yields, 12, 'twelve yields for 1.2M at 100k a step');
  assert.equal(r.value.count, whole.count, 'the same blades');
  for (let k = 0; k < 40; k++) assert.equal(r.value.inst[k], whole.inst[k], 'in the same order');
  assert.match(w, /do \{ r = labGrassWalk\.next\(\); \} while \(!r\.done && performance\.now\(\) - t0 < 4\);/, 'four milliseconds a frame');
  assert.match(w, /if \(r\.done\) \{ labGrass\.set\(r\.value\); labGrassWalk = null; labGrassCentre = labGrassWalkCentre; \}/, 'swapped in whole when done');
  assert.match(w, /labGrassCentre = null; labGrassWalk = null;   \/\/ AUDIT 49 F2/, 'an origin shift abandons a walk in flight');
});

// ── GR4: THE ROOT IS THE GROUND ───────────────────────────────────
// RedRoryOTheGlen, via Mac: "the base of the grass blending into the
// ground and all you can make out are the tips through a gradient -
// reminds me of how the older Novalogic games handled grass."
test('GR4: the root takes the colour of the tile it stands on, and the base fades in', async () => {
  const { LAB_GRASS_VS, LAB_GRASS_FS, placeLabGrassSteps } = await import('../src/render/labGrass.js');
  // THE SHADER, still the lab's byte for byte (the GR1 pin above holds):
  // a fourth instance attribute carries the ground's colour, the root
  // is that colour darkened as a sward's shade would, and the alpha
  // fades in from the base so the planted line is gone.
  assert.match(LAB_GRASS_VS, /layout\(location=4\) in vec3 aGround;/);
  assert.match(LAB_GRASS_VS, /vGround = aGround;/);
  assert.match(LAB_GRASS_FS, /in vec3 vGround;/);
  assert.match(LAB_GRASS_FS, /vec3 root = vGround \* 0\.62;/, 'the root IS the ground, darkened');
  assert.doesNotMatch(LAB_GRASS_FS, /vec3 root = vec3\(0\.06,0\.09,0\.04\);/, 'the fixed olive root is gone');
  assert.match(LAB_GRASS_FS, /o = vec4\(c, vFade \* smoothstep\(0\.0, 0\.30, vT\)\);/, 'the base fades in');
  // THE PLACER bakes it from the host's ground(x, z), and without one
  // hands back the olive the root used to be - so a host with no
  // ground colour draws GR2's grass unchanged rather than black.
  const gen = placeLabGrassSteps({ centre: [1000, 1000], keep: () => 0, ground: (x, z) => [x > 1000 ? 0.5 : 0.1, 0.2, 0.3], density: 4000 });
  let r; do { r = gen.next(); } while (!r.done);
  const { inst, ground, count } = r.value;
  assert.equal(ground.length, count * 3, 'three floats a blade');
  const near = (a, b) => Math.abs(a - b) < 1e-6;   // Float32Array stores 0.1 as 0.10000000149
  for (let i = 0; i < 50; i++) {
    const east = inst[i * 4] > 1000;
    assert.ok(near(ground[i * 3], east ? 0.5 : 0.1), 'each blade carries the colour of ITS ground');
    assert.ok(near(ground[i * 3 + 1], 0.2));
  }
  const bare = placeLabGrassSteps({ centre: [0, 0], keep: () => 0, density: 100 });
  let b; do { b = bare.next(); } while (!b.done);
  assert.ok([0.10, 0.145, 0.065].every((v, k) => near(b.value.ground[k], v)), 'no ground callback: the old olive');
  // THE RENDERER takes the fourth buffer as a vec3 with the instance divisor.
  const src = readFileSync(new URL('../src/render/labGrass.js', import.meta.url), 'utf8');
  assert.match(src, /this\.bufs = \[1, 2, 3, 4\]\.map/);
  assert.match(src, /loc === 3 \? 1 : loc === 4 \? 3 : 4/);
  assert.match(src, /\[3, placed\.ground\]/);
});

test('GR4: the game feeds each tile\'s MEAN colour, averaged once where the texels already are', () => {
  const world = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  // Averaged where the layers are decoded for the tile array - the
  // texels are on the CPU there already, once per archive - rather
  // than sampled per blade.
  assert.match(world, /groundMeanColour\.set\(groundArchive, layers\.map\(\(rgba\) => \{/);
  assert.match(world, /return n \? \[r \/ n \/ 255, g \/ n \/ 255, b \/ n \/ 255\] : \[0\.10, 0\.145, 0\.065\];/);
  // ground(x, z) is keep's OWN lookup - same pieces, same tile maths -
  // answering with the colour instead of the height, so the root under
  // a blade takes the colour of the very tile keep let it stand on.
  const g = world.slice(world.indexOf('const ground = (x, z) => {'), world.indexOf('labGrassWalk = placeLabGrassSteps('));
  assert.match(g, /const tx = Math\.floor\(lx \/ 6\.4\); const tz = Math\.floor\(lz \/ 6\.4\);/);
  assert.match(g, /const rec = p\.tilemapBytes\[tz \* TERRAIN_TILE_DIM \+ tx\] >> 2;/);
  assert.match(g, /return groundMeanColour\.get\(p\.groundArchive\)\?\.\[rec\] \?\? null;/);
  assert.match(world, /placeLabGrassSteps\(\{ centre: \[ex, ez\], keep, ground \}\)/, 'and the placer is handed it');
});
