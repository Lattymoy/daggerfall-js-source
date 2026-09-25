// GR1: the lab's grass, byte for byte, standing only where it may.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LAB_GRASS_HEAD, LAB_GRASS_VS, LAB_GRASS_FS, LAB_GRASS, LAB_DIM, placeLabGrass, grassRecordsOf, labBladeCorners, GRASS2_VS_EDITS, GAME_GRASS_VS, GAME_GRASS_FIELD, placeLabGrassCell, grassCellSeed, grassHash, grassVnoise, grassClump, bakedTint, LabGrassRenderer, GRASS_FAR_SEGMENTS, GRASS_PACK_BYTES, GRASS_CELL, grassPerCell, heightFloor, heightSpan, WIDTH_SPAN, LEAN_SPAN } from '../src/render/labGrass.js';

const lab = () => readFileSync('grass-proto.html', 'utf8');

test('GR1/GRASS2/GRASS5/GRASS6: the shaders are the lab\u2019s own but for four DECLARED edits, and the port\u2019s height, range and byte layout are its own', () => {
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
  assert.equal(GRASS2_VS_EDITS.length, 4, 'four departures, no more - a fifth is a decision, not a detail (GRASS6 took the tint edit back to the placer, so the lab\u2019s own vTint line compiles again)');
  for (const e of GRASS2_VS_EDITS) {
    assert.ok(want.includes(e.from), `the lab still carries the line this edit replaces: ${e.why}`);
    assert.ok(e.why && e.why.length > 20, 'every departure says why, on the departure itself');
    want = want.replace(e.from, e.to);
  }
  assert.equal(noComments(LAB_GRASS_VS), noComments(want), 'the vertex stage is the lab\u2019s text with the four declared edits, and nothing else');
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
  // F2: the scatter is baked in world coordinates, so an origin shift must
  // reach it. It re-placed the whole field until PERF-EXT-C2; the field
  // follows the origin in place now (test/grassshift.test.js holds how).
  assert.match(w, /exteriorFoes\.offsetAll\(r\.offset\);[^\n]*\n\s*labGrassField\?\.shiftOrigin\(r\.offset\);/, 'the origin shift reaches the field');
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
  // PERF-EXT-C2: an origin shift no longer abandons the field - it moves it
  // (test/grassshift.test.js); a new world (a teleport, a load) still starts one empty
  assert.match(w, /labGrassField\?\.shiftOrigin\(r\.offset\);   \/\/ PERF-EXT-C2/, 'an origin shift carries the field');
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
  // AUDIT 68 S16-grass-point-alloc: one lane table, built once in the constructor, read by the VAOs, writeSlot and _point
  assert.match(src, /Object\.freeze\(\{ loc: 1, type: gl\.UNSIGNED_SHORT, bytes: 8 \}\),\n\s*Object\.freeze\(\{ loc: 2, type: gl\.UNSIGNED_BYTE, bytes: 4 \}\),\n\s*Object\.freeze\(\{ loc: 4, type: gl\.UNSIGNED_BYTE, bytes: 4 \}\),/, 'u16 then two u8');
  assert.match(src, /gl\.vertexAttribPointer\(L\.loc, 4, L\.type, true, 0, 0\);/, 'NORMALIZED, so the GPU does the unpack');
  assert.match(src, /C\[i \* 4\] = u8\(placed\.ground\[i \* 3\]\);/, 'and the ground colour is packed from the placer\'s own floats');
});

test('GR4: the game feeds each tile\'s MEAN colour, averaged once where the texels already are', () => {
  const world = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  // Averaged where the layers are decoded - the texels are on the CPU
  // there already, once per archive - rather than sampled per blade.
  // AUDIT 68 S17: through the one law (tileMeanColour, pinned on a real
  // color32 in audit68_worldjs), learned beside grassRecords whenever the
  // SCENE's map lacks the archive, not on the renderer's cache miss.
  const learn = world.slice(world.indexOf('if (!grassRecords.has(groundArchive)) {'), world.indexOf('const terrain = renderer.createTerrainSurface('));
  assert.match(learn, /groundMeanColour\.set\(groundArchive, layers\.map\(tileMeanColour\)\);/);
  // ground(x, z) is keep's OWN lookup - same pieces, same tile maths -
  // answering with the colour instead of the height, so the root under
  // a blade takes the colour of the very tile keep let it stand on.
  const g = world.slice(world.indexOf('const ground = (x, z) => {'), world.indexOf('if (!labGrassField) labGrassField = createGrassField('));   // AUDIT 68: `createGrassFields(` was never there - the slice ran to -1
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
  // number, so the fixture states a law rather than relying on the
  // arithmetic of whatever span is in force.
  const start = LAB_GRASS.span + GRASS_CELL * 22;
  assert.equal((start - LAB_GRASS.span) % GRASS_CELL, 0, 'the walk starts on a cell boundary');
  f.update(start, start); const live = w.filter((x) => x[0] === 'w').length; w.length = 0;
  // PERF10: STANDING STILL COSTS NOTHING. The window is a disc now, so
  // its rim is not snapped to the cell grid the way the square's floored
  // bounds were and a step of any size can bring a cell in. What must
  // still hold - and is the law the square's version was reaching for -
  // is that a frame which does not move the eye does not move a blade.
  f.update(start, start);
  assert.equal(w.length, 0, 'the eye did not move: nothing moves');
  // ...and a five-metre step reaches only the leading rim, and frees
  // nothing at all: the fill radius is the draw's range and cells are
  // held out to `span`, so nothing churns at the trailing edge.
  // (PERF-EXT-C3: a walk's few rim cells arrive a slice a frame, so the
  // step is given the frames its rim takes to land - the eye stays put.)
  for (let i = 0; i < 40; i++) f.update(start + 5, start);
  const near = w.filter((x) => x[0] === 'w').length;
  assert.ok(near > 0 && near < live / 20, `five metres: the leading rim only (${near} of ${live})`);
  assert.equal(w.filter((x) => x[0] === 'c').length, 0, 'five metres frees nothing - the hysteresis holds the trailing rim');
  w.length = 0;
  f.update(start + 40, start);
  const writes = w.filter((x) => x[0] === 'w').length, clears = w.filter((x) => x[0] === 'c').length;
  assert.ok(writes > 0 && writes < live / 4 && clears > 0 && clears < live / 4, `forty metres: one edge in, one out (${writes}/${clears} of ${live})`);
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
  assert.match(world, /    arrows\.arrows\.length = 0;[^\n]*\n(    \/\/[^\n]*\n)+    labGrassField = null;\n/, 'a new world starts empty (PERF-EXT-C2: the teleport says so; the crossing keeps its field)');
  const src = readFileSync(new URL('../src/render/labGrass.js', import.meta.url), 'utf8');
  // GRASS5: the stride is in BYTES now, because a blade is no longer a
  // whole number of floats - eight bytes of u16 and two lots of four u8.
  assert.match(src, /gl\.bufferSubData\(gl\.ARRAY_BUFFER, slot \* p \* this\._lanes\[k\]\.bytes, this\._packs\[k\]\);/, 'a cell arrives by bufferSubData into its slot');
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
  assert.match(pt, /gl\.vertexAttribPointer\(L\.loc, 4, L\.type, true, 0, slot \* p \* L\.bytes\);/, 'the type travels with the offset');
  assert.match(pt, /const L = this\._lanes\[k\];/, 'AUDIT 68 S16-grass-point-alloc: off the constructor\'s one table');
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

test('GRASS6: the patch is BAKED - the clump noise is the placer\u2019s, once a blade, and the vertex stage compiles the lab\u2019s own tint line', () => {
  // the shader no longer evaluates the noise: the lab's line is back and nothing in the body calls vnoise
  assert.ok(GAME_GRASS_VS.includes('  vTint = aInst2.z;'), 'the lab\u2019s own tint line');
  assert.ok(!/vnoise\(/.test(GAME_GRASS_VS) && !/clump/.test(GAME_GRASS_VS), 'no noise in the vertex stage - it was thirty evaluations a blade a frame for a constant');
  // the JS noise is the prelude's, term for term: the same three constants, the same fade, the same bilinear
  for (const term of ['123.34', '456.21', '45.32', '3.0-2.0*f']) assert.ok(GAME_GRASS_FIELD.includes(term), `the prelude's ${term}`);
  const src = readFileSync('src/render/labGrass.js', 'utf8');
  const js = src.slice(src.indexOf('export function grassHash'), src.indexOf('export const bakedTint'));
  for (const term of ['123.34', '456.21', '45.32', '(3 - 2 * fx)', '(3 - 2 * fz)']) assert.ok(js.includes(term), `the twin's ${term}`);
  // the noise behaves as a value noise: in range, continuous, and a patch rather than a constant
  let lo = 1, hi = 0;
  for (let i = 0; i < 4000; i++) {
    const x = (i * 7919) % 601 - 300, z = (i * 104729) % 601 - 300;
    const v = grassClump(x, z); lo = Math.min(lo, v); hi = Math.max(hi, v);
    assert.ok(v >= 0 && v <= 1);
    assert.ok(Math.abs(grassClump(x + 0.05, z) - v) < 0.02, 'five centimetres apart is the same patch');
  }
  assert.ok(lo < 0.2 && hi > 0.8, `a full range of patches (${lo.toFixed(2)}..${hi.toFixed(2)})`);
  // the hash is the prelude's with GLSL's fract (x - floor(x)), which folds a negative UP - half the world is west or north of the origin
  const glslHash = (x, z) => { const fr = (v) => v - Math.floor(v); let px = fr(x * 123.34), pz = fr(z * 456.21); const d = px * (px + 45.32) + pz * (pz + 45.32); return fr((px + d) * (pz + d)); };
  for (const [x, z] of [[3, 4], [-3, -4], [-0.37, 2.9], [-251.25, -17.5], [0.5, -0.5]]) {
    assert.ok(grassHash(x, z) >= 0 && grassHash(x, z) < 1, 'in [0,1) either side of zero');
    assert.ok(Math.abs(grassHash(x, z) - glslHash(x, z)) < 1e-9, `the prelude's own value at (${x}, ${z})`);
  }
  assert.equal(grassVnoise(2, 5), grassHash(2, 5), 'on a lattice point the noise is the hash');
  // GRASS AUDIT 1: the bilinear, off the lattice, against the four corners in the open (a swapped corner or a wrong axis passed every check above)
  {
    const fx = 0.25, fz = 0.75, sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
    const a = grassHash(2, 5), b = grassHash(3, 5), c = grassHash(2, 6), d = grassHash(3, 6);
    const want = (a + (b - a) * sx) * (1 - sz) + (c + (d - c) * sx) * sz;
    assert.ok(Math.abs(grassVnoise(2.25, 5.75) - want) < 1e-12, 'x runs along the first corner pair, z picks the pair, and both fades are smoothstepped');
    // the smoothstep: the slope collapses at the lattice line, where a linear blend would crease
    const s0 = Math.abs(grassVnoise(3.001, 5.3) - grassVnoise(2.999, 5.3)) / 0.002, s1 = Math.abs(grassVnoise(2.501, 5.3) - grassVnoise(2.499, 5.3)) / 0.002;
    assert.ok(s0 < s1 * 0.05, `a value noise is flat across its lattice lines (${s0.toFixed(4)} against ${s1.toFixed(4)} mid-cell)`);
    // the coarse octave moves the value: one octave alone is not the clump
    let moved = 0; for (let i = 0; i < 200; i++) { const x = i * 3.7 - 300, z = i * 5.1 - 300; if (Math.abs(grassClump(x, z) - grassVnoise(x * 0.055 + 0.317, z * 0.055 + 0.713)) > 0.05) moved++; }
    assert.ok(moved > 100, `the 59 m octave shows in ${moved} of 200 samples`);
    // the sample is OFF the lattice corner at the origin: hash(0,0) is 0 and the scene origin is a corner of the player's map pixel
    assert.ok(grassClump(0, 0) > 0.15 && grassClump(0, 0) < 0.85, `no dead patch at the origin (${grassClump(0, 0).toFixed(3)})`);
    assert.match(src, /grassVnoise\(x \* 0\.055 \+ 0\.317, z \* 0\.055 \+ 0\.713\) \* 0\.66 \+ grassVnoise\(x \* 0\.017 \+ 0\.531, z \* 0\.017 \+ 0\.279\) \* 0\.34/);
  }
  // the lane's tint: the lab's random pulled 0.55 of the way to the patch, clamped
  assert.equal(bakedTint(0.2, 10, 10), 0.2 + (grassClump(10, 10) - 0.2) * 0.55);
  assert.ok(Math.abs(bakedTint(0, 0, 0) - grassClump(0, 0) * 0.55) < 1e-12 && bakedTint(0, 0, 0) > 0.05, 'a random of 0 is pulled up to 0.55 of its patch (GRASS AUDIT 1: the origin is no longer a dead patch)');
  assert.ok(Math.abs(bakedTint(1, 0, 0) - (1 - (1 - grassClump(0, 0)) * 0.55)) < 1e-12, 'a random of 1 is pulled down the same way');
  assert.equal(bakedTint(0.3, 0, 0) <= 1 && bakedTint(0.3, 0, 0) >= 0, true);
  // and the placer writes exactly that for its first blade, with the random stream undisturbed
  const cell = placeLabGrassCell(2, -3, { keep: () => 0, perCell: 8 });
  let s = grassCellSeed(2, -3);
  const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const px = rnd() * 30, pz = rnd() * 30, a = rnd() * 6.283, rr = rnd() * rnd() * 0.55;
  const x = 60 + px + Math.cos(a) * rr, z = -90 + pz + Math.sin(a) * rr;
  rnd(); rnd(); rnd(); rnd();   // height, phase, lean x, lean z
  const t = rnd();
  const w = 0.052 + rnd() * 0.055;
  assert.ok(Math.abs(cell.inst2[2] - bakedTint(t, x, z)) < 1e-6, 'the first blade\u2019s tint is its random pulled to its patch');
  assert.ok(Math.abs(cell.inst2[3] - w) < 1e-6, '...and the width after it is the lab\u2019s, so the stream did not move');
  assert.ok(Math.abs(cell.inst2[2] - t) > 1e-3 || Math.abs(grassClump(x, z) - t) < 1e-3, 'and it is not the bare random');
  // and the whole-field placer (placeLabGrassSteps, the lab's own walk) bakes the same law on ITS first blade
  const g = placeLabGrass({ centre: [0, 0], keep: () => 0 });
  let ls = 0x2f6e2b1;
  const lrnd = () => { ls ^= ls << 13; ls ^= ls >>> 17; ls ^= ls << 5; ls >>>= 0; return ls / 4294967296; };
  const gcx = (lrnd() - 0.5) * LAB_GRASS.span * 2, gcz = (lrnd() - 0.5) * LAB_GRASS.span * 2, ga = lrnd() * 6.283, grr = lrnd() * lrnd() * 0.55;
  const gx = gcx + Math.cos(ga) * grr, gz = gcz + Math.sin(ga) * grr;
  lrnd(); lrnd(); lrnd(); lrnd();
  const gt = lrnd();
  assert.ok(Math.abs(g.inst2[2] - bakedTint(gt, gx, gz)) < 1e-6, 'the field placer\u2019s first blade is pulled to its patch too');
  // GRASS AUDIT 1: the noise is paid AFTER keep() - a road cell refuses most of its candidates, and 0.43 ms a cell was going on blades that never stood
  // (PERF-EXT-C2: the cell placer bakes at the FIELD's coordinates, fx/fz - the scene's x/z less the field's origin;
  // PERF-EXT-C3: its loop is stepGrassCell's, which placeLabGrassCell runs end to end)
  for (const [fn, bake] of [['export function stepGrassCell', 'bakedTint(tRnd, fx, fz)'], ['export function* placeLabGrassSteps', 'bakedTint(tRnd, x, z)']]) {
    const body = src.slice(src.indexOf(fn), src.indexOf('\n}\n', src.indexOf(fn)));
    assert.ok(body.indexOf('const tRnd = rnd();') > 0 && body.indexOf('const tRnd = rnd();') < body.indexOf('keep(x, z)') && body.indexOf('keep(x, z)') < body.indexOf(bake), `${fn}: the random is drawn in the lab's order, keep() decides, THEN the patch is looked up`);
  }
  // GRASS AUDIT 1: the u8 tint lane, PACKED and read back - GRASS6 made the lane the tint's only carrier and nothing had ever read a packed byte
  const calls = []; let ids = 0;
  const gl = new Proxy({}, { get(_, k) {
    if (k === 'getShaderParameter' || k === 'getProgramParameter') return () => true;
    if (k === 'getUniformLocation') return (_p, n) => n;
    if (k === 'isEnabled') return () => false;
    if (k === 'createShader' || k === 'createProgram' || k === 'createBuffer' || k === 'createVertexArray' || k === 'createTexture') return () => ++ids;
    if (typeof k === 'string' && /^[A-Z_0-9]+$/.test(k)) return k;
    return (...args) => { calls.push([k, ...args]); };
  } });
  const r = new LabGrassRenderer(gl);
  r.allocSlots(8, 1);
  r.writeSlot(0, cell);
  const packB = r._packB;
  assert.equal(packB[2], Math.round(cell.inst2[2] * 255), 'the first blade\u2019s tint byte is its baked tint, rounded');
  assert.equal(packB[2], Math.round(bakedTint(t, x, z) * 255));
  const edge = { ...cell, inst2: Float32Array.from(cell.inst2) };
  edge.inst2[2] = 1.2; edge.inst2[6] = -0.3;
  r.writeSlot(0, edge);
  assert.deepEqual([r._packB[2], r._packB[6]], [255, 0], 'and the lane clamps at both ends');
});
