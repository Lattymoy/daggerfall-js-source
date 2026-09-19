// GR1: the lab's grass, byte for byte, standing only where it may.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LAB_GRASS_HEAD, LAB_GRASS_VS, LAB_GRASS_FS, LAB_GRASS, LAB_DIM, placeLabGrass, grassRecordsOf, labBladeCorners, GRASS2_VS_EDITS, GRASS_FAR_SEGMENTS, GRASS_PACK_BYTES, GRASS_CELL, grassPerCell, heightFloor, heightSpan, WIDTH_SPAN, LEAN_SPAN } from '../src/render/labGrass.js';

const lab = () => readFileSync('grass-proto.html', 'utf8');

test('GR1/GRASS2/GRASS5: the shaders are the lab\u2019s own but for five DECLARED edits, and the port\u2019s height, range and byte layout are its own', () => {
  const src = lab();
  const vsStart = src.indexOf('layout(location=0) in vec2 aCorner;      // one blade quad, 0..1\nlayout(location=1) in vec4 aInst;        // xz, height, phase');
  const vsEnd = src.indexOf('}`, HEAD + `', vsStart) + 1;
  const fsStart = src.indexOf('in float vT; in float vTint; in float vFade; in float vLam; in float vSnow; in float vWet;', vsEnd);
  const fsEnd = src.indexOf('}`);', fsStart) + 1;
  assert.ok(vsStart > 0 && fsStart > 0);
  // GRASS2: the vertex stage is the lab's text plus THREE DECLARED
  // EDITS, and the pin is still byte-exact - it applies the edits to the
  // lab's own slice and compares the result. A fourth change, or a
  // fourth edit nobody declared, still fails here, which is the whole
  // value of GR1's law: it is departed from on the record, never
  // loosened. The comments around each edit are the port's own and are
  // not compared; the CODE is.
  const noComments = (t) => t.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  let want = src.slice(vsStart, vsEnd);
  assert.equal(GRASS2_VS_EDITS.length, 5, 'five departures, no more - a sixth is a decision, not a detail');
  for (const e of GRASS2_VS_EDITS) {
    assert.ok(want.includes(e.from), `the lab still carries the line this edit replaces: ${e.why}`);
    assert.ok(e.why && e.why.length > 20, 'every departure says why, on the departure itself');
    want = want.replace(e.from, e.to);
  }
  assert.equal(noComments(LAB_GRASS_VS), noComments(want), 'the vertex stage is the lab\u2019s text with the three declared edits, and nothing else');
  assert.equal(LAB_GRASS_FS, src.slice(fsStart, fsEnd), 'the fragment stage is the lab\u2019s text, byte for byte - GRASS2 changed no fragment law');
  const headStart = src.indexOf('const HEAD = `');
  assert.equal(LAB_GRASS_HEAD, src.slice(headStart + 'const HEAD = `'.length, src.indexOf('`;', headStart)));
  // the lab itself: height 54, and the maxima the game uses
  assert.match(src, /const state = \{ density: 1200000, height: 54,/, 'the lab\u2019s default height is 54');
  assert.match(src, /id="height" type="range" min="10" max="120" step="1" value="54"/);
  assert.match(src, /id="density" type="range" min="20000" max="1200000"/);
  assert.match(src, /id="range" type="range" min="10" max="200"/);
  // GRASS2: the lab's DENSITY is kept and its height and range are not.
  // `densitySpan` is the lab's own span, kept as the rate the field is
  // dense by, so pushing the range out never thins the grass.
  assert.deepEqual({ ...LAB_GRASS }, { density: 1200000, height: 38, range: 300, span: 315, densitySpan: 210, seed: 0x2f6e2b1 },
    'the lab\u2019s blade count, at Mac\u2019s height and a longer range');
  assert.equal((LAB_GRASS.span * 2) % 30, 0, 'the window is a whole number of cells, so its two edges move in step');
  assert.equal(LAB_GRASS.densitySpan, 210, 'the rate is measured over the lab\u2019s own window, never the window in force');
  assert.ok(LAB_GRASS.span > LAB_GRASS.range, 'the window holds the range - a window shorter than the range has a wall at its edge');
  assert.equal(labBladeCorners().length / 2, 30, 'five stacked quads, the lab\u2019s blade');
  assert.equal(labBladeCorners(GRASS_FAR_SEGMENTS).length / 2, 6, 'and one quad for the far blade, a fifth of the vertices');
  assert.deepEqual({ ...LAB_DIM }, { sunny: 1.00, cloudy: 0.90, overcast: 0.72, fog: 0.66, rain: 0.60, thunder: 0.46, snow: 0.80, sandstorm: 0.55 });   // WEATHER2d: the port's own row appended; the lab's seven verbatim
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
  const cx = (rnd() - 0.5) * LAB_GRASS.span * 2, cz = (rnd() - 0.5) * LAB_GRASS.span * 2; const a = rnd() * 6.283, rr = rnd() * rnd() * 0.55;
  assert.ok(Math.abs(g.inst[0] - (cx + Math.cos(a) * rr)) < 1e-3 && Math.abs(g.inst[1] - (cz + Math.sin(a) * rr)) < 1e-3   /* Float32 storage */, 'the first blade is where the lab puts it');
  assert.ok(Math.abs(g.inst[2] - (0.22 + rnd() * 0.42) * (LAB_GRASS.height / 34)) < 1e-4, 'at the port\u2019s height, on the lab\u2019s law');
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
  // GR5: the field follows the eye by CELLS now - filled at the leading
  // edge, freed at the trailing one - rather than re-scattering whole
  // when the eye moved 60m.
  assert.match(w, /labGrassField\.update\(ex, ez, keep, ground\);/, 'the field follows the eye');
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
  assert.match(w, /exteriorFoes\.offsetAll\(r\.offset\);[^\n]*\n\s*labGrassField = null;/, 'the origin shift forces a re-place');
  // F3: the records are learned whenever missing, not only on a tile-cache miss
  assert.match(w, /if \(!grassRecords\.has\(groundArchive\)\) \{\s*\n\s*const layers = \[\];/);
  assert.ok(!/renderer\.uploadTileArray\(groundArchive, layers\);\s*\n[^}]*grassRecords\.set/.test(w), 'not inside the cache-miss block');
  // F4: uWind carries the gust, as the lab's WIND.speed does; uWindV does not
  // (WIND3: the pair comes from the one mapping, systems/windDrive.js - the
  // rate without the gust is windV, the speed with it is slider * gust)
  assert.match(w, /speed: wd\.slider \* wd\.gust, windV: wd\.windV/);
  const d = readFileSync('src/systems/windDrive.js', 'utf8');
  assert.match(d, /const rate = slider \* LAB_WIND_RATE;\s*\n\s*const windV = \[dir\[0\] \* rate, dir\[1\] \* rate\];/);
  assert.match(d, /step: \[windV\[0\] \* gust \* ds, windV\[1\] \* gust \* ds\]/, 'the travel carries the gust, the rate does not');
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
  // WIND3: the one mapping moved INTO systems/windDrive.js, and the
  // hosts read its answer (`wd`) for the grass and the rain alike - no
  // host calls the slider itself any more
  const w = readFileSync('src/scenes/world.js', 'utf8');
  assert.equal((readFileSync('src/systems/windDrive.js', 'utf8').match(/const slider = labWindSlider\(w\);/g) || []).length, 1, 'the grass and the rain share the one mapping, in its one home');
  assert.ok(!/labWindSlider/.test(w) && !/mag \* 260/.test(w), 'the guessed scale is gone, and the host holds no copy of the mapping');
  assert.ok(!/labWindSlider/.test(readFileSync('src/scenes/exterior.js', 'utf8')), 'the exterior host too');
  assert.match(w, /\{ dir: wd\.dir, speed: wd\.slider \* wd\.gust, windV: wd\.windV \}/, 'the grass takes the one answer');
  // 3. the walk is a generator that yields, and lands where the one-shot lands
  const keep = (x) => (x > 0 ? 0 : null);
  const whole = placeLabGrass({ centre: [3, 4], keep });
  const it = placeLabGrassSteps({ centre: [3, 4], keep, step: 100000 }); let yields = 0; let r = it.next();
  while (!r.done) { yields++; r = it.next(); }
  assert.equal(yields, 12, 'twelve yields for 1.2M at 100k a step');
  assert.equal(r.value.count, whole.count, 'the same blades');
  for (let k = 0; k < 40; k++) assert.equal(r.value.inst[k], whole.inst[k], 'in the same order');
  // GR5 replaced the time-sliced walk with a world-anchored field filled
  // a cell or two a frame - the same promise (no stall) kept a
  // different way, pinned in the GR5 tests below.
  assert.match(w, /labGrassField\.update\(ex, ez, keep, ground\);/, 'four milliseconds a frame');
  // GR5: nothing is swapped in whole any more - a cell arrives by one
  // bufferSubData into its own slot. The whole-field swap WAS the hitch.
  assert.doesNotMatch(w, /labGrass\.set\(/, 'no whole-field swap');
  assert.match(w, /labGrassField = null;   \/\/ AUDIT 49 F2 \/ GR5/, 'an origin shift abandons a walk in flight');
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
  assert.match(LAB_GRASS_VS, /layout\(location=4\) in vec4 aPC;/);   // GRASS5: three bytes of ground and one of phase
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
  // GRASS5: THE RENDERER takes three PACKED streams with the instance
  // divisor - the ground colour is three bytes of the last one, and the
  // root height lost its own attribute to a lane of the first.
  const src = readFileSync(new URL('../src/render/labGrass.js', import.meta.url), 'utf8');
  assert.match(src, /this\.bufs = \[1, 2, 4\]\.map/, 'three streams');
  assert.match(src, /\[\[0, 1, gl\.UNSIGNED_SHORT\], \[1, 2, gl\.UNSIGNED_BYTE\], \[2, 4, gl\.UNSIGNED_BYTE\]\]/, 'u16 then two u8');
  assert.match(src, /gl\.vertexAttribPointer\(loc, 4, type, true, 0, 0\);/, 'NORMALIZED, so the GPU does the unpack');
  assert.match(src, /C\[i \* 4\] = u8\(placed\.ground\[i \* 3\]\);/, 'and the ground colour is packed from the placer\'s own floats');
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
  const g = world.slice(world.indexOf('const ground = (x, z) => {'), world.indexOf('if (!labGrassField) labGrassField = createGrassFields('));
  assert.match(g, /const tx = Math\.floor\(lx \/ 6\.4\); const tz = Math\.floor\(lz \/ 6\.4\);/);
  assert.match(g, /const rec = p\.tilemapBytes\[tz \* TERRAIN_TILE_DIM \+ tx\] >> 2;/);
  assert.match(g, /return groundMeanColour\.get\(p\.groundArchive\)\?\.\[rec\] \?\? null;/);
  assert.match(world, /labGrassField\.update\(ex, ez, keep, ground\);/, 'and the field is handed it');
});

// ── GR5: THE FIELD IS ANCHORED TO THE WORLD ───────────────────────
// Mac: "it sometimes hitches and switches while walking. There's also a
// slight pop in/pop out issue."
test('GR5: a cell grows the same blades whoever is looking, and walking touches only the edges', async () => {
  const { placeLabGrassCell, grassPerCell, createGrassField, GRASS_CELL } = await import('../src/render/labGrass.js');
  const perCell = grassPerCell();
  // ANCHORED: the same cell, byte for byte, from its own coordinates -
  // GR2 placed every blade relative to the EYE from one seed, so a
  // rebuild moved the whole field.
  const a = placeLabGrassCell(33, -12, { keep: () => 0, perCell });
  const b = placeLabGrassCell(33, -12, { keep: () => 0, perCell });
  assert.ok(a.inst.every((v, i) => v === b.inst[i]) && a.inst2.every((v, i) => v === b.inst2[i]));
  assert.notEqual(a.inst[0], placeLabGrassCell(34, -12, { keep: () => 0, perCell }).inst[0], 'a neighbour is its own');
  for (let i = 0; i < a.count; i++) {
    assert.ok(a.inst[i * 4] >= 33 * GRASS_CELL - 1 && a.inst[i * 4] < 34 * GRASS_CELL + 1, 'a blade stands in its cell');
  }
  // PADDED: a refused blade leaves a zero-height slot, which draws nothing.
  const half = placeLabGrassCell(0, 0, { keep: (x, z) => (x < 15 ? 0 : null), perCell });
  assert.ok(half.count < perCell && half.count > 0);
  assert.equal(half.inst[(perCell - 1) * 4 + 2], 0, 'the pad has no height');
  // INCREMENTAL: the field frees and fills EDGES only, a few a frame -
  // never a whole-field upload.
  const w = []; const r = { allocSlots(p, s) { w.push(['a', p, s]); }, writeSlot(s, p) { w.push(['w', s, p.count]); }, clearSlot(s) { w.push(['c', s]); } };
  // GRASS5: the budget has to exceed the WINDOW, which grew with the
  // range - at 400 the first update left 84 cells unfilled and the next
  // one finished them, which reads exactly like a step that moved cells.
  const f = createGrassField(r, { keep: () => 0, perFrame: 1e9 });
  assert.equal(w[0][0], 'a', 'the buffers are sized once, up front');
  // GRASS5: the start is SNAPPED to the cell grid rather than a round
  // number. The window's edges are floored, so whether a five-metre step
  // crosses a boundary depends on where in a cell it begins - and the
  // old fixture's 1,000 only held still because the span happened to
  // land it mid-cell. Snapping states the law being tested (a step
  // INSIDE a cell touches nothing) instead of relying on the arithmetic
  // of whatever span is in force.
  const start = LAB_GRASS.span + GRASS_CELL * 22;
  assert.equal((start - LAB_GRASS.span) % GRASS_CELL, 0, 'the walk starts on a cell boundary');
  f.update(start, start); const live = w.filter((x) => x[0] === 'w').length; w.length = 0;
  f.update(start + 5, start);
  assert.equal(w.length, 0, 'five metres inside a cell: nothing moves');
  f.update(start + 40, start);
  const writes = w.filter((x) => x[0] === 'w').length, clears = w.filter((x) => x[0] === 'c').length;
  assert.ok(writes > 0 && writes < live / 4 && clears === writes, `forty metres: one edge in, one out (${writes}/${clears} of ${live})`);
  // ...and a frame fills at most perFrame, so the walk cannot hitch.
  const g = createGrassField(r, { keep: () => 0, perFrame: 2 }); w.length = 0;
  const pending = g.update(0, 0);
  assert.equal(w.filter((x) => x[0] === 'w').length, 2, 'two cells a frame');
  assert.ok(pending > 0, 'the rest wait their turn');
});

test('GR5: the host runs the field, not the walk', () => {
  const world = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(world, /labGrassField = createGrassField\(labGrass, \{ keep, ground, density: grassDensity \}\);/);   // PERF1: at the pane's fraction of the lab's field
  assert.match(world, /labGrassField\.update\(ex, ez, keep, ground\);/, 'this frame\'s keep/ground, since the near pieces move with the eye');
  assert.doesNotMatch(world, /placeLabGrassSteps|labGrassWalk\b|labGrass\.set\(/, 'the whole-field walk and its 60MB swap are gone');
  assert.match(world, /labGrassField = null;   \/\/ AUDIT 49 F2 \/ GR5/, 'a new world starts empty');
  const src = readFileSync(new URL('../src/render/labGrass.js', import.meta.url), 'utf8');
  // GRASS5: the stride is in BYTES now, because a blade is no longer a
  // whole number of floats - eight bytes of u16 and two lots of four u8.
  assert.match(src, /gl\.bufferSubData\(gl\.ARRAY_BUFFER, slot \* p \* w\.bytes, w\.data\);/, 'a cell arrives by bufferSubData into its slot');
  assert.match(src, /clearSlot\(slot\) \{[\s\S]{0,700}bufferSubData\(gl\.ARRAY_BUFFER, slot \* p \* 8, this\._zeros\)/, 'and leaves by zeros');
});

// ═══ GRASS5 (2026-09-19): THE BLADE, PACKED ═════════════════════════
// Twelve floats a blade was 48 bytes on the GPU, and the STORAGE - not
// the frame - was what capped the range: 106 MB at 250 m, 169 at 320.
// Sixteen bytes is three times the field for the same memory.
test('GRASS5: a blade is sixteen bytes, and every lane is finer than the float it replaced', () => {
  const src = readFileSync(new URL('../src/render/labGrass.js', import.meta.url), 'utf8');
  assert.equal(GRASS_PACK_BYTES, 16);
  // THE LANES, and the precision each one actually has. These are the
  // numbers the pack rests on; if a lane shrinks, one of them fails.
  const cell = GRASS_CELL;
  assert.ok(cell / 65535 < 0.001, `x and z are cell-local u16: ${(cell / 65535 * 1000).toFixed(2)} mm`);
  const hSpan = heightSpan();
  assert.ok(hSpan / 255 < 0.003, `height is u8 over its own span: ${(hSpan / 255 * 1000).toFixed(2)} mm`);
  assert.ok(WIDTH_SPAN / 255 < 0.001, `width is u8 over ${WIDTH_SPAN}`);
  assert.ok((2 * Math.PI) / 255 < 0.03, 'phase is u8 over a turn');
  assert.ok(LEAN_SPAN / 255 < 0.003, 'lean is u8 over its own span');
  // the height law's floor and span ARE the placer's own arithmetic
  assert.ok(Math.abs(heightFloor(54) - 0.22 * (54 / 34)) < 1e-12);
  assert.ok(Math.abs(heightSpan(54) - 0.42 * (54 / 34)) < 1e-12);
  assert.ok(Math.abs(heightFloor() - 0.22 * (LAB_GRASS.height / 34)) < 1e-12, 'and default to the port’s height');

  // THE BUFFERS ARE SIZED IN BYTES, and the three of them add to sixteen
  assert.match(src, /const sizes = \[slots \* perCell \* 8, slots \* perCell \* 4, slots \* perCell \* 4\];/);
  // THE FRAME IS THE DATA'S BOUNDS, not the cell's coordinates - a blade
  // clusters up to 0.55 outside its own cell, so a floor() of the lowest
  // blade names the cell next door and throws the slot 30 m out.
  assert.match(src, /const xSpan = n > 0 \? Math\.max\(1e-3, Math\.max\(x1 - x0, z1 - z0\)\) : 1;/);
  assert.match(src, /const ox = n > 0 \? x0 : 0;/, 'the origin is the lowest blade, not a floor of it');
  assert.ok(!/Math\.floor\(x0 \/ cell\) \* cell/.test(src), 'and the floor that broke it is gone');
  // AND THE POINTER RE-STATES THE TYPE. vertexAttribPointer sets the
  // FORMAT as well as the offset, so moving to a slot with the old float
  // shape un-packs every attribute and the draw dies.
  const pt = src.slice(src.indexOf('  _point(slot) {'), src.indexOf('  _drawVisibleSlots(vp'));
  assert.match(pt, /gl\.vertexAttribPointer\(loc, 4, type, true, 0, slot \* p \* bytes\);/, 'the type travels with the offset');
  assert.match(pt, /gl\.UNSIGNED_SHORT, 8\], \[1, 2, gl\.UNSIGNED_BYTE, 4\], \[2, 4, gl\.UNSIGNED_BYTE, 4\]/);
});

test('GRASS5: the range is no longer a memory question - and the window at 300 m holds less than the lab’s own 200 m did', () => {
  const per = grassPerCell();
  const bytesAt = (span, wide) => {
    const side = Math.ceil((span * 2) / GRASS_CELL) + 1;
    return side * side * per * wide;
  };
  const now = bytesAt(LAB_GRASS.span, GRASS_PACK_BYTES);
  const labOld = bytesAt(210, 48);   // the lab's own 200 m window, unpacked
  assert.ok(now < labOld, `300 m packed is ${(now / 1e6).toFixed(0)} MB against the lab's 200 m at ${(labOld / 1e6).toFixed(0)} MB`);
  assert.equal(bytesAt(LAB_GRASS.span, 48), 3 * now, 'and the same window unpacked would be exactly three times it');
  // THE RANGE IS SET BY THE TRADE, not the memory: the probe's own curve
  // says each extra 50 m costs about a million vertices and buys a tenth
  // of a per cent of grass, because the density does not fall with
  // distance. The pin holds the REASON in the source so the next reader
  // does not push the number and wonder why nothing got better.
  const src = readFileSync(new URL('../src/render/labGrass.js', import.meta.url), 'utf8');
  assert.match(src, /MEMORY IS NOT THE CAP ANY MORE/);
  assert.match(src, /THE NEXT STEP IS NOT MORE RANGE, IT IS LESS DENSITY AT RANGE/);
});
