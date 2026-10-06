// MEADOW1 (2026-10-06, Mac: "These are 4 textures I want to blend into our grass system, all with varying sizes so its
// not monotonous everywhere"; then a bush, "of different sizes", and "instead of billboarding, these should have a sort
// of low poly look to them, like the trees"): THE OWNER'S SPRITES ON CROSSED CARDS. The sprites are his PNGs texel for
// texel; the atlas and its chain keep each one's coverage; the vertex stage's own text picks a sprite and sizes its
// card exactly as the JS law does, stands its cards fixed in the world at the tuft's yaw, turns and mirrors them by what
// the corner carries, and shades each by the low-poly trees' face law; the fragment stage moves the owner's colours by
// the ground exactly as meadowTexel does; the renderer uploads, binds, counts and frees what the style needs; and the
// row ships it as the default.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bakeMeadow, spriteOf, SOURCES, OUT, MEADOW_ALPHABET as BAKE_ALPHABET } from '../tools/bakeMeadow.mjs';
import { readPng } from '../tools/pngIO.mjs';
import { MEADOW_SPRITES, MEADOW_ALPHABET } from '../src/render/meadowArt.js';
import { buildMeadowAtlas, buildMeadowMips, downsampleMeadow, slotCoverage, meadowPick, meadowCardCorners, meadowGrass, meadowTexel, meadowArtGround, meadowSpriteMean,
  MEADOW_SLOTS, MEADOW_CELL, MEADOW_CARDS, MEADOW_CARDS_FAR, MEADOW_NEAR_AT, MEADOW_BLADES_PER_TUFT, MEADOW_VARIANTS, MEADOW_SHARES, MEADOW_LUSH, MEADOW_PATCH_SCALE,
  MEADOW_FACE, MEADOW_GREEN, MEADOW_SHIFT, MEADOW_RAMP_STEPS, MEADOW_MAX_SCALE, MEADOW_REACH, MEADOW_BUSH, MEADOW_FLOWERS, MEADOW_DRY, MEADOW_SHORT, MEADOW_TALL } from '../src/render/grassMeadow.js';
import { LAB_GRASS_HEAD, GAME_GRASS_FIELD, LAB_GRASS_VS, LAB_GRASS_FS, GAME_GRASS_VS, GAME_GRASS_FS, GRASSPX_VS_EDITS, GRASSPX_FS_EDITS, GRASSFOG_VS_EDITS, GRASSFOG_FS_EDITS,
  GRASSLIT_VS_EDITS, GRASSLIT_FS_EDITS, GRASSMEADOW_VS_EDITS, GRASSMEADOW_FS_EDITS, applyGrassEdits, LabGrassRenderer, GRASS_CELL, GRASS_TONES, GRASS_TONES_CLASSIC,
  GRASS_MAX_LIGHTS, heightFloor, heightSpan, packHeightSlope } from '../src/render/labGrass.js';
import { SHADOW_POINT_CASTERS } from '../src/render/shadowPass.js';
import { EL_MAX_LIGHTS, elDecode3, elDecodeN } from '../src/render/enhancedLighting.js';
import { pixelGrass, PX_VARIANTS, PX_RAMP_STEPS } from '../src/render/grassPixelArt.js';
import { perspective, mirrorProjectionX, lookAt } from '../src/world/mat4.js';
import { glslFunctions } from './glsl.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const raw = (p) => readFileSync(new URL(`../${p}`, import.meta.url));
const zeros = (n, k) => Array.from({ length: n }, () => Array(k).fill(0));

/** The compiled vertex stage, compiled ONCE, for one blade at its cell's middle (15, rootY 0, 15): `set(globals)` and
 *  run - the stage's outputs come back. No wind, no lights; the switch on. */
function vertexStage() {
  const f = glslFunctions(LAB_GRASS_HEAD + GAME_GRASS_FIELD + GAME_GRASS_VS, {
    aCorner: [0.5, 1], aCard: 0, aPA: [0.5, 0.5, 0, packHeightSlope(1, 0, 0, 0) / 65535], aPB: [0.5, 0.5, 0.5, 0.5], aPC: [0.2, 0.3, 0.1, 0],
    uVP: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], uTime: 0, uWind: 0, uRange: 300, uEye: [0, 1, 0], uSunDir: [0, 1, 0], uMoonDir: [0, 1, 0], uWindDir: [1, 0],
    uSnowFull: 1.1, uSlotN: 0, uCellFrame: [0, 0, 0, 1], uBladeScale: [heightFloor(), heightSpan(), 0.05, 0.05], uCellSize: 30, uPixel: 1, uPxVariants: MEADOW_SLOTS, uArt: 1,
    uGFieldOrigin: [0, 0], uGFieldM: 1, uSnowGlobal: 0, uWindV: [0, 0], uSunScale: 0.6, uCamPos: [0, 0, 0], uIndirect: [0, 0, 0, 0], uIndirectColor: [0, 0, 0],
    uCloudShadowRect: [0, 0, 0, 0], uSunVP: [Array(16).fill(0), Array(16).fill(0), Array(16).fill(0)], uSunOrigin: [0, 0, 0, 0], uSunShadowParams: [0, 0, 0, 0], uSunTexel: [0, 0, 0, 0],
    uPointShadowParams: zeros(SHADOW_POINT_CASTERS, 4), uShadowIndex: Array(SHADOW_POINT_CASTERS).fill(-1), uCasterOf: Array(EL_MAX_LIGHTS).fill(-1),
    uLane: 0, uPointCount: 0, uPointIdx: Array(8).fill(0), uPointLights: zeros(GRASS_MAX_LIGHTS, 4), uPointColors: zeros(GRASS_MAX_LIGHTS, 3),
    gl_VertexID: 2, gl_InstanceID: 0, texture: () => [0, 0, 0, 0],
  });
  return { f, run(set) { Object.assign(f.globals, set); f.main(); return f.globals; } };
}

test('MEADOW1: the five sprites are the owner\'s PNGs texel for texel, hard-edged, and the module is the bake\'s byte for byte (mutant: a soft edge let through)', () => {
  assert.equal(bakeMeadow(SOURCES.map((s) => raw(s.png))), read(OUT), `${OUT} is not what tools/bakeMeadow.mjs makes - re-run it`);
  assert.equal(MEADOW_ALPHABET, BAKE_ALPHABET);
  assert.deepEqual(MEADOW_SPRITES.map((s) => [s.name, s.source, s.width, s.height]), [
    ['tall', 'src/assets/grass/source/tuft-tall.png', 32, 32], ['short', 'src/assets/grass/source/tuft-short.png', 32, 32],
    ['flowers', 'src/assets/grass/source/flowers.png', 32, 32], ['dry', 'src/assets/grass/source/tuft-dry.png', 32, 32],
    ['bush', 'src/assets/grass/source/bush.png', 64, 64]], 'the order is the atlas\'s, and so the variant index the shader picks');
  assert.deepEqual(MEADOW_VARIANTS.map((v) => v.name), MEADOW_SPRITES.map((s) => s.name));
  assert.deepEqual([MEADOW_TALL, MEADOW_SHORT, MEADOW_FLOWERS, MEADOW_DRY, MEADOW_BUSH], [0, 1, 2, 3, 4]);
  for (const s of MEADOW_SPRITES) {
    const png = readPng(raw(s.source));
    assert.equal(png.width, s.width); assert.equal(png.height, s.height);
    assert.equal(new Set(s.palette).size, s.palette.length, `${s.name}: one letter a colour`);
    let drawn = 0;
    for (let y = 0; y < s.height; y++) {
      for (let x = 0; x < s.width; x++) {
        const i = (y * s.width + x) * 4, ch = s.rows[y][x];
        assert.ok(png.data[i + 3] === 0 || png.data[i + 3] === 255, `${s.name} ${x},${y}: the owner's art is hard-edged`);
        assert.equal(ch === '.', png.data[i + 3] === 0, `${s.name} ${x},${y}: air exactly where the PNG is clear`);
        if (ch === '.') continue;
        drawn++;
        const hex = s.palette[MEADOW_ALPHABET.indexOf(ch)];
        assert.equal(hex, [0, 1, 2].map((c) => png.data[i + c].toString(16).padStart(2, '0')).join(''), `${s.name} ${x},${y}: the PNG's colour`);
      }
    }
    assert.ok(drawn > s.width * s.height * 0.1, `${s.name} draws something (${drawn})`);
  }
  // the bake refuses a soft edge rather than rounding it
  const soft = { width: 2, height: 1, data: new Uint8ClampedArray([10, 20, 30, 255, 10, 20, 30, 128]) };
  assert.throws(() => spriteOf(soft, 'soft'), /hard-edged/);
  assert.deepEqual(spriteOf({ width: 2, height: 1, data: new Uint8ClampedArray([10, 20, 30, 255, 0, 0, 0, 0]) }), { name: 'sprite', width: 2, height: 1, palette: ['0a141e'], rows: ['A.'] });
});

test('MEADOW1: the atlas - eight 64-texel cells, the sprite\'s foot on row 0, a 32-pixel sprite at two texels a pixel, a hard alpha, and three cells of air (mutant: the sprite upside down)', () => {
  const a = buildMeadowAtlas();
  assert.deepEqual([a.width, a.height, a.slots, a.variants, a.cell], [MEADOW_SLOTS * MEADOW_CELL, MEADOW_CELL, 8, 5, 64]);
  for (let v = 0; v < MEADOW_SLOTS; v++) {
    const s = MEADOW_SPRITES[v];
    for (let y = 0; y < a.height; y++) {
      for (let x = 0; x < MEADOW_CELL; x++) {
        const o = (y * a.width + v * MEADOW_CELL + x) * 4;
        assert.ok(a.data[o + 3] === 0 || a.data[o + 3] === 255, 'never a soft alpha');
        if (!s) { assert.equal(a.data[o + 3], 0, `cell ${v} is air`); continue; }
        const k = MEADOW_CELL / s.width;
        const ch = s.rows[s.height - 1 - Math.floor(y / k)][Math.floor(x / k)];   // row 0 of the cell is the sprite's bottom row
        assert.equal(a.data[o + 3] === 255, ch !== '.', `${s.name} ${x},${y}`);
        if (ch !== '.') assert.deepEqual([...a.data.subarray(o, o + 3)], [0, 2, 4].map((i) => parseInt(s.palette[MEADOW_ALPHABET.indexOf(ch)].slice(i, i + 2), 16)));
      }
    }
  }
  // the foot: every sprite stands on its cell's bottom row (the PNG's last), which a card's foot (vUV.y = 0) reads
  for (let v = 0; v < 5; v++) {
    let foot = 0;
    for (let x = 0; x < MEADOW_CELL; x++) if (a.data[(v * MEADOW_CELL + x) * 4 + 3]) foot++;
    assert.ok(foot > 8, `${MEADOW_SPRITES[v].name} stands on row 0 (${foot} texels)`);
  }
  assert.throws(() => buildMeadowAtlas({ sprites: [{ name: 'odd', width: 24, height: 24, palette: [], rows: [] }] }), /does not tile/);
});

test('MEADOW1: the chain keeps EACH sprite\'s coverage, takes a block\'s colour as its covered texels\' mean, reaches 1x1, and a tuft\'s first level is the owner\'s own 32x32 (mutants: the floor gone, the mean over air)', () => {
  const atlas = buildMeadowAtlas();
  const chain = buildMeadowMips(atlas);
  assert.deepEqual(chain.map((l) => `${l.width}x${l.height}`), ['512x64', '256x32', '128x16', '64x8', '32x4', '16x2', '8x1', '4x1', '2x1', '1x1'], 'a chain that stops short is an incomplete texture, which samples black');
  const base = slotCoverage(atlas);
  assert.deepEqual(base.slice(5), [0, 0, 0]);
  for (let v = 0; v < 5; v++) assert.ok(base[v] > 0.1 && base[v] < 0.6, `${MEADOW_SPRITES[v].name} is mostly air or leaf, never a block (${base[v]})`);
  // level 1 of a 32-pixel sprite is the sprite itself, texel for texel
  const l1 = chain[1];
  for (let v = 0; v < 4; v++) {
    const s = MEADOW_SPRITES[v];
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const o = (y * l1.width + v * 32 + x) * 4, ch = s.rows[31 - y][x];
        assert.equal(l1.data[o + 3] === 255, ch !== '.', `${s.name} level 1 ${x},${y}`);
        if (ch !== '.') assert.deepEqual([...l1.data.subarray(o, o + 3)], [0, 2, 4].map((i) => parseInt(s.palette[MEADOW_ALPHABET.indexOf(ch)].slice(i, i + 2), 16)));
      }
    }
  }
  for (const [k, l] of chain.entries()) {
    for (let i = 3; i < l.data.length; i += 4) assert.ok(l.data[i] === 0 || l.data[i] === 255, `level ${k}: hard alpha`);
    const cw = l.width / MEADOW_SLOTS;
    if (k === 0 || cw < 1) continue;
    const cov = slotCoverage(l);
    for (let v = 0; v < 5; v++) {
      const n = cw * l.height;
      assert.equal(cov[v], Math.max(1, Math.round(base[v] * n)) / n, `level ${k}: ${MEADOW_SPRITES[v].name} keeps its own share, and at least a texel while it is a texel wide`);
    }
    assert.deepEqual(cov.slice(5), [0, 0, 0], `level ${k}: the air cells stay air`);
  }
  assert.equal(chain.at(-1).data[3], 255, 'the last pixel is covered');
  // a kept block's colour is its covered texels' mean: a 2x2 with three texels, one of air
  const one = downsampleMeadow({ width: 2, height: 2, data: new Uint8Array([90, 113, 82, 255, 0, 0, 0, 0, 30, 60, 90, 255, 61, 91, 51, 255]) }, { targets: [0.75], slots: 1 });
  assert.deepEqual([...one.data], [Math.round(181 / 3), Math.round(264 / 3), Math.round(223 / 3), 255], 'air never darkens a leaf\'s edge');
  // and a block of the bush at level 1, read from level 0 by hand
  const bushAt = (l, x, y) => (y * l.width + 4 * (l.width / MEADOW_SLOTS) + x) * 4;
  let found = 0;
  for (let y = 0; y < 32 && found < 20; y++) {
    for (let x = 0; x < 32 && found < 20; x++) {
      const o = bushAt(chain[1], x, y);
      if (!chain[1].data[o + 3]) continue;
      const sum = [0, 0, 0]; let n = 0;
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const s = bushAt(atlas, 2 * x + dx, 2 * y + dy); if (atlas.data[s + 3]) { n++; for (let c = 0; c < 3; c++) sum[c] += atlas.data[s + c]; } }
      assert.deepEqual([...chain[1].data.subarray(o, o + 3)], sum.map((v) => Math.round(v / n)), `the bush's block ${x},${y}`);
      found++;
    }
  }
  assert.equal(found, 20);
});

test('MEADOW1: which sprite a blade wears and how big its card stands - the vertex stage\'s own text, run, is meadowPick at every width byte and patch; flowers gather where the patch is lush, dry tufts where it is poor, a bush in both; and a bush sways a third as far (mutants: the patch\'s scale dropped, the bush as stiff as grass, the shares swapped)', () => {
  const vs = vertexStage();
  const h = heightFloor() + heightSpan();   // the lane's top word: the law's tallest blade
  const counts = { poor: [0, 0, 0, 0, 0], lush: [0, 0, 0, 0, 0] };
  for (const tint of [0, 0.2, 0.35, 0.5, 0.55, 0.65, 0.8, 1]) {
    for (let b = 0; b < 256; b++) {
      const r = b / 255;
      const g = vs.run({ aPB: [0.5, 0.5, tint, r], aCorner: [0.5, 1], aCard: 0 });
      const want = meadowPick(r, tint);
      assert.equal(g.vVar, want.variant, `tint ${tint} byte ${b}: the stage's sprite is the law's`);
      assert.ok(Math.abs(g.gl_Position[1] - h * want.scale) < 1e-9, `tint ${tint} byte ${b}: the card stands ${h * want.scale} (${g.gl_Position[1]})`);
      if (tint === 0) counts.poor[want.variant]++;
      if (tint === 1) counts.lush[want.variant]++;
    }
  }
  // the shares, by the byte grid
  assert.ok(counts.lush[MEADOW_FLOWERS] >= 5 * counts.poor[MEADOW_FLOWERS] && counts.lush[MEADOW_FLOWERS] > 25, `flowers gather in a lush patch: ${counts.lush[MEADOW_FLOWERS]} against ${counts.poor[MEADOW_FLOWERS]} of 256`);
  assert.ok(counts.poor[MEADOW_DRY] >= 5 * counts.lush[MEADOW_DRY] && counts.poor[MEADOW_DRY] > 40, `dry tufts in a poor one: ${counts.poor[MEADOW_DRY]} against ${counts.lush[MEADOW_DRY]}`);
  assert.ok(counts.poor[MEADOW_BUSH] >= 2 && counts.lush[MEADOW_BUSH] > counts.poor[MEADOW_BUSH], `a bush in both, more in the lush (${counts.poor[MEADOW_BUSH]}, ${counts.lush[MEADOW_BUSH]})`);
  assert.ok(counts.poor[MEADOW_SHORT] > counts.poor[MEADOW_TALL] && counts.lush[MEADOW_TALL] > counts.lush[MEADOW_SHORT], 'short grass on the poor ground, tall on the lush');
  // every size varies: the lab's height law alone is 2.9 to 1, the patch's own 0.8..1.25 over it, the bush its own scale
  assert.deepEqual([...MEADOW_PATCH_SCALE], [0.8, 1.25]);
  assert.ok(meadowPick(0.99, 1).scale / meadowPick(0.99, 0).scale > 1.5, 'a lush patch stands half again taller');
  assert.ok(MEADOW_VARIANTS[MEADOW_BUSH].scale > 1.6 * MEADOW_VARIANTS[MEADOW_TALL].scale, 'a bush is a bush');
  assert.equal(MEADOW_MAX_SCALE, Math.max(...MEADOW_VARIANTS.map((v) => v.scale)) * MEADOW_PATCH_SCALE[1]);
  // the sway: a card's top is carried by the lab's lean times its height, a bush's a third as far
  const lean = (r) => { const g = vs.run({ aPB: [1, 0.5, 0, r], aCorner: [0.5, 1], aCard: 0 }); return { x: g.gl_Position[0] - 15, h: g.gl_Position[1], v: g.vVar }; };
  const grass = lean(0.99), bush = lean(0);
  assert.equal(grass.v, MEADOW_TALL); assert.equal(bush.v, MEADOW_BUSH);
  assert.ok(Math.abs(grass.x - 0.25 * grass.h) < 1e-9, `grass leans its whole lean (${grass.x} of ${grass.h})`);
  assert.ok(Math.abs(bush.x - 0.25 * bush.h * MEADOW_VARIANTS[MEADOW_BUSH].stiff) < 1e-9, `a bush a third of it (${bush.x} of ${bush.h})`);
  assert.equal(MEADOW_VARIANTS[MEADOW_BUSH].stiff, 0.3);
  // the switch off is the pixel style's blade: no card, no pick
  const off = vs.run({ uArt: 0, aPB: [0.5, 0.5, 0.5, 0], aCorner: [0.5, 1] });
  assert.ok(Math.abs(off.gl_Position[1] - h) < 1e-9, 'the pixel style stands the blade its own height');
  vs.run({ uArt: 1 });
});

test('MEADOW1: the cards - square, fixed in the world at the tuft\'s own yaw (no billboard: the eye walking round a tuft does not turn it), three near and two far spread evenly across a half-turn, every other one mirrored (mutants: the quad turned to the eye, the mirror flag lost, two cards near)', () => {
  assert.equal(MEADOW_CARDS, 3); assert.equal(MEADOW_CARDS_FAR, 2); assert.equal(MEADOW_NEAR_AT, 0.25);
  const corners = (cards) => { const c = meadowCardCorners(cards); return Array.from({ length: c.length / 3 }, (_, i) => [c[i * 3], c[i * 3 + 1], c[i * 3 + 2]]); };
  for (const cards of [3, 2]) {
    const c = corners(cards);
    assert.equal(c.length, cards * 6, 'two triangles a card');
    for (let k = 0; k < cards; k++) {
      assert.deepEqual(c.slice(k * 6, k * 6 + 6).map(([x, y]) => [x, y]), [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]], 'a whole quad, the blade\'s own winding');
      for (const [, , t] of c.slice(k * 6, k * 6 + 6)) assert.ok(Math.abs(t - (k / cards + (k % 2))) < 1e-6, `card ${k} of ${cards}: its turn, and the mirror flag on every other`);
    }
  }
  const vs = vertexStage();
  const yaw = vs.f.hash([15 * 0.37, 15 * 0.37]);
  const card = (t, eye = [0, 1, 0]) => {
    const at = (x) => vs.run({ aPB: [0.5, 0.5, 0.5, 0.99], aCorner: [x, 0], aCard: t, uEye: eye });
    const p0 = [...at(0).gl_Position], g = at(1), p1 = [...g.gl_Position];
    return { d: [p1[0] - p0[0], p1[2] - p0[2]], u1: g.vUV[0] };
  };
  const h = (heightFloor() + heightSpan()) * meadowPick(0.99, 0.5).scale;
  for (const cards of [3, 2]) {
    const turns = [...new Set(corners(cards).map(([, , t]) => t))];
    const dirs = turns.map((t) => card(t));
    dirs.forEach(({ d }, k) => {
      assert.ok(Math.abs(Math.hypot(d[0], d[1]) - h) < 1e-9, 'a card is as wide as it is tall - a square, so its texels are');
      const want = (yaw + (k / cards)) * Math.PI;   // the corner carries its turn as a float32, so to a few parts in ten million
      assert.ok(Math.abs(d[0] - Math.cos(want) * h) < 1e-6 && Math.abs(d[1] - Math.sin(want) * h) < 1e-6, `card ${k} of ${cards} turned ${k}/${cards} of a half-turn off the tuft's yaw`);
    });
    const mirrored = (yaw * 8) % 1 >= 0.5;
    dirs.forEach(({ u1 }, k) => assert.equal(u1, (mirrored !== (k % 2 === 1)) ? 0 : 1, `card ${k}: mirrored by the tuft and by every other card`));
  }
  // walking round the tuft turns nothing - the pixel style's quad, which faces the eye, turns
  for (const eye of [[40, 1, 0], [0, 1, 40], [-20, 1, -20]]) {
    const a = card(0, [0, 1, 0]).d, b = card(0, eye).d;
    assert.ok(Math.abs(a[0] - b[0]) < 1e-12 && Math.abs(a[1] - b[1]) < 1e-12, `the card stands where it stood with the eye at ${eye}`);
  }
  const quad = (eye) => { const p0 = [...vs.run({ uArt: 0, aPB: [0.5, 0.5, 0.5, 0.99], aCorner: [0, 0], uEye: eye }).gl_Position]; const p1 = vs.run({ aCorner: [1, 0] }).gl_Position; return [p1[0] - p0[0], p1[2] - p0[2]]; };
  const q1 = quad([0, 1, 0]), q2 = quad([40, 1, 0]);
  assert.ok(Math.abs(q1[0] * q2[1] - q1[1] * q2[0]) > 1e-3, 'the pixel style\'s billboard does turn - the contrast the meadow is not');
  vs.run({ uArt: 1, uEye: [0, 1, 0] });
});

test('MEADOW1: a card is shaded by the low-poly trees\' own face law - the face the eye sees against the light, never under half - on the blade\'s lambert about the ground (mutants: the face law dropped, the face not turned to the eye)', () => {
  const bb = read('src/render/renderer.js');
  assert.ok(bb.includes(`float faceSun = clamp(${MEADOW_FACE.base} + ${MEADOW_FACE.span} * dot(wn, uLptSun.xyz), ${MEADOW_FACE.floor}, 1.0);`), 'the trees\' own numbers (BB_VS) - the meadow\'s are theirs');
  const vs = vertexStage();
  const sun = [0.9, 0.3, 0.2], sl = Math.hypot(...sun), sunN = sun.map((v) => v / sl);
  const yaw = vs.f.hash([15 * 0.37, 15 * 0.37]);
  const dir = [Math.cos(yaw * Math.PI), Math.sin(yaw * Math.PI)];
  const face = [-dir[1], dir[0]];   // card 0's normal in xz
  for (const side of [1, -1]) {
    const eye = [15 + face[0] * 20 * side, 1, 15 + face[1] * 20 * side];   // the eye on one side of card 0 and then the other
    const blade = vs.run({ uArt: 0, aPB: [0.5, 0.5, 0.5, 0.99], aCorner: [0.5, 0.5], aCard: 0, uEye: eye, uSunDir: sun, uMoonDir: sun }).vLam;
    const g = vs.run({ uArt: 1 });
    const seen = [face[0] * side, face[1] * side];   // the face turned to the eye
    const shade = Math.min(1, Math.max(MEADOW_FACE.floor, MEADOW_FACE.base + MEADOW_FACE.span * (seen[0] * sunN[0] + seen[1] * sunN[2])));
    assert.ok(blade > 0.2, 'the blade\'s own lambert is lit');
    assert.ok(Math.abs(g.vLam - blade * shade) < 1e-9, `side ${side}: the sun's lambert times the face's shade (${g.vLam} against ${blade} x ${shade})`);
    assert.ok(Math.abs(g.vMoonLam - blade * shade) < 1e-9, '...and the moon\'s the same way');
  }
  const lit = vs.run({ uEye: [15 + face[0] * 20, 1, 15 + face[1] * 20] }).vLam, dark = vs.run({ uEye: [15 - face[0] * 20, 1, 15 - face[1] * 20] }).vLam;
  assert.notEqual(lit, dark, 'a low sun picks the two faces apart - the facet');
  assert.ok(Math.min(lit, dark) >= 0.5 * Math.max(lit, dark) - 1e-12, '...and the darker keeps at least half, as a tree\'s does');
});

test('MEADOW1: the owner\'s colours on any ground - the fragment stage\'s own text is meadowTexel: his green at the lane\'s middle tone over the tile, a petal keeping its hue, the ratio held to its span (mutants: the art unmoved, every texel the green\'s hue)', () => {
  const fs = (art, ground, artGround) => {
    const f = glslFunctions(LAB_GRASS_HEAD + GAME_GRASS_FS, {
      vT: 1, vTint: 0.5, vFade: 1, vLam: 0, vSnow: 0, vWet: 0, vGround: [...ground], vMoonLam: 0,
      vUV: [0.5, 1], vVar: 0, vWorld: [0, 0, 10], vSun: 1, vFar: 0, vNear: [0, 0, 0], vPoint: [0, 0, 0],
      uAmb: [1, 1, 1], uSunCol: [1, 1, 1], uMoonCol: [0, 0, 0], uDim: 1, uSunScale: 0, uMoonScale: 0,
      uPixel: 1, uArt: 1, uArtGround: [...artGround], uPxSteps: 1e7, uPxVariants: MEADOW_SLOTS, uPxTintBands: 3, uLane: 0, uELExposure: 1,
      uGrassTone: GRASS_TONES_CLASSIC.map((k) => [...k]),
      uFogColor: [0, 0, 0], uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uCamPos: [0, 0, 0], uFocus: [0, 0, 0, 0], uDwFog: zeros(5, 4),
      gl_FragCoord: [3, 5, 0.5, 1], o: [0, 0, 0, 0],
      texture: (name) => (name === 'uPxSheet' ? [...art, 1] : [0.5, 0.5, 0, 1]),
    });
    f.main();
    return f.globals.o.slice(0, 3);
  };
  const VE = [49.3 / 255, 72.8 / 255, 39.1 / 255], SWAMP = [44 / 255, 63 / 255, 38 / 255], MOUNTAIN = [59 / 255, 67 / 255, 46 / 255];
  const petal = [153 / 255, 56 / 255, 113 / 255], leaf = [74 / 255, 106 / 255, 67 / 255], dry = [78 / 255, 79 / 255, 55 / 255];
  for (const lane of [GRASS_TONES[1], GRASS_TONES_CLASSIC[1]]) {
    const artGround = meadowArtGround(lane);
    for (const ground of [VE, SWAMP, MOUNTAIN, [0.9, 0.05, 0.9]]) {
      for (const art of [petal, leaf, dry, MEADOW_GREEN]) {
        const got = fs(art, ground, artGround), want = meadowTexel(art, ground, artGround);
        assert.ok(got.every((v, i) => Math.abs(v - want[i]) < 1e-5), `the stage's colour is the twin's: ${got} against ${want}`);
      }
    }
    // the anchor: the owner's green, on any grass tile, is the tile at the lane's middle tone
    for (const ground of [VE, SWAMP, MOUNTAIN]) {
      const c = meadowTexel(MEADOW_GREEN, ground, artGround);
      c.forEach((v, i) => assert.ok(Math.abs(v - ground[i] * lane[i]) < 1e-12, `his green over ${ground}: the tile's own, at the tone ${lane}`));
    }
  }
  // a petal keeps its hue - its channels' ratios - and takes the ground's brightness alone
  const artGround = meadowArtGround(GRASS_TONES[1]);
  const p = meadowTexel(petal, SWAMP, artGround);
  assert.ok(Math.abs(p[0] / p[1] - petal[0] / petal[1]) < 1e-9 && Math.abs(p[2] / p[1] - petal[2] / petal[1]) < 1e-9, 'the petal\'s hue is the owner\'s');
  assert.ok(p[0] < petal[0], '...and the swamp\'s darker light reaches it');
  // a green texel takes the hue whole: each channel moves by the ground's own ratio on it
  for (const ground of [MOUNTAIN, SWAMP]) {
    const l = meadowTexel(leaf, ground, artGround);
    l.forEach((v, i) => assert.ok(Math.abs(v - leaf[i] * ground[i] / artGround[i]) < 1e-12, `a leaf takes ${ground}'s hue, channel ${i}`));
  }
  // the span: a tile far off grass tints the art and never repaints it
  const odd = meadowTexel(leaf, [0.9, 0.05, 0.9], artGround);
  odd.forEach((v, i) => assert.ok(v <= leaf[i] * MEADOW_SHIFT[1] + 1e-12 && v >= leaf[i] * MEADOW_SHIFT[0] - 1e-12, 'held to the span'));
  assert.deepEqual(MEADOW_GREEN.map((v) => Math.round(v * 255)), [75, 106, 69], 'the tall tuft\'s own mean');
  assert.deepEqual(meadowSpriteMean(MEADOW_SPRITES[0]), [...MEADOW_GREEN]);
});

/** a WebGL2 deep enough for the constructor and the draws, with the calls kept (grasspx.test.js's) */
function stubGl() {
  const calls = [];
  const C = { VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, DYNAMIC_DRAW: 7, FLOAT: 8, TEXTURE_2D: 9, RGBA: 10, UNSIGNED_BYTE: 11, TEXTURE_MIN_FILTER: 12, TEXTURE_MAG_FILTER: 13, NEAREST: 14, TEXTURE0: 100, TEXTURE3: 103, TEXTURE4: 104, BLEND: 20, SRC_ALPHA: 21, ONE_MINUS_SRC_ALPHA: 22, TRIANGLES: 23, CULL_FACE: 24, UNSIGNED_SHORT: 25, NEAREST_MIPMAP_NEAREST: 26, LINEAR: 27, CLAMP_TO_EDGE: 28, TEXTURE_WRAP_S: 29, TEXTURE_WRAP_T: 30 };
  let ids = 0;
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in C) return C[k];
      if (k === 'getShaderParameter' || k === 'getProgramParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'isEnabled') return () => false;
      if (k === 'createShader' || k === 'createProgram' || k === 'createBuffer' || k === 'createVertexArray' || k === 'createTexture') return () => ++ids;
      return (...args) => { calls.push([k, ...args]); };
    },
  });
  return { gl, calls, C };
}
const LIGHT = { sunDir: [0, 1, 0], amb: [0.5, 0.5, 0.5], sunCol: [1, 1, 1], dim: 1 };
const WIND = { dir: [1, 0], speed: 0, windV: [0, 0] };

test('MEADOW1: the renderer - the owner\'s atlas on its own texture, every level, NEAREST and clamped; two card arrays carrying the card on attribute 3; the meadow binds its atlas on unit 4 with its own counts and each lane its art\'s ground; and all of it goes with the renderer (mutants: the switch never on, one ground for both lanes, the pixel ramp, the atlas leaked)', () => {
  const { gl, calls, C } = stubGl();
  const r = new LabGrassRenderer(gl);
  let bound = null; const ups = [];
  for (const c of calls) { if (c[0] === 'bindTexture') bound = c[2]; else if (c[0] === 'texImage2D' && bound === r.meadowSheet) ups.push([c[2], c[4], c[5]]); }
  assert.deepEqual(ups, buildMeadowMips().map((l, i) => [i, l.width, l.height]), 'every level, by hand');
  const at = calls.findIndex((c) => c[0] === 'bindTexture' && c[2] === r.meadowSheet);
  assert.deepEqual(calls.slice(at).filter((c) => c[0] === 'texParameteri').slice(0, 4).map((c) => [c[2], c[3]]),
    [[C.TEXTURE_MIN_FILTER, C.NEAREST_MIPMAP_NEAREST], [C.TEXTURE_MAG_FILTER, C.NEAREST], [C.TEXTURE_WRAP_S, C.CLAMP_TO_EDGE], [C.TEXTURE_WRAP_T, C.CLAMP_TO_EDGE]], 'a pixel sprite is never filtered');
  assert.notEqual(r.meadowSheet, r.pxSheet);
  assert.deepEqual(calls.filter((c) => c[0] === 'vertexAttribPointer' && c[1] === 3).map((c) => c.slice(1)), [[3, 1, C.FLOAT, false, 12, 8], [3, 1, C.FLOAT, false, 12, 8]], 'the card\'s turn rides attribute 3, on the two card arrays alone');
  assert.deepEqual([r.vertsCards, r.vertsCardsFar, r.vertsFar, r.verts], [MEADOW_CARDS * 6, MEADOW_CARDS_FAR * 6, 6, 30]);
  r.allocSlots(49, 4);
  const draw = (style, light = LIGHT) => {
    calls.length = 0;
    r.draw(new Float32Array(16), new Float32Array(16), new Float32Array(3), 0, light, WIND, 300, style);
    const u = {}; for (const c of calls) if (c[0] === 'uniform1f' || c[0] === 'uniform1i' || c[0] === 'uniform3fv') u[c[1]] = c[2];
    const a4 = calls.findIndex((c) => c[0] === 'activeTexture' && c[1] === C.TEXTURE4);
    return { u, sheet: a4 >= 0 ? calls[a4 + 1][2] : null };
  };
  const m = draw('meadow');
  assert.deepEqual([m.u.uPixel, m.u.uArt, m.u.uPxVariants, m.u.uPxSteps, m.u.uPxSheet], [1, 1, MEADOW_SLOTS, MEADOW_RAMP_STEPS, 4]);
  assert.equal(m.sheet, r.meadowSheet, 'the meadow wears the owner\'s atlas on the sheet\'s unit');
  assert.deepEqual([...m.u.uArtGround], [...new Float32Array(meadowArtGround(GRASS_TONES_CLASSIC[1]))], 'the classic lane: the art\'s ground at the classic middle tone');
  const lane = draw('meadow', { ...LIGHT, lane: { decode3: elDecode3, decodeN: elDecodeN } });
  assert.deepEqual([...lane.u.uArtGround], [...new Float32Array(meadowArtGround(GRASS_TONES[1]))], '...and under the lane, the lane\'s');
  assert.equal(draw('junk').u.uArt, 1, 'a word that is no tier is the row\'s default, the meadow');
  const px = draw('pixel');
  assert.deepEqual([px.u.uPixel, px.u.uArt, px.u.uPxVariants, px.u.uPxSteps], [1, 0, PX_VARIANTS, PX_RAMP_STEPS]);
  assert.equal(px.sheet, r.pxSheet, 'the pixel style keeps its own sheet');
  const sm = draw('smooth');
  assert.deepEqual([sm.u.uPixel, sm.u.uArt, sm.sheet], [0, 0, null], 'the lab\'s blade: no art, and unit 4 untouched');
  calls.length = 0; r.destroy();
  for (const t of [r.meadowSheet, r.pxSheet]) assert.ok(calls.some((c) => c[0] === 'deleteTexture' && c[1] === t), 'both sheets go with the renderer');
  for (const v of [r.vaoCards, r.vaoCardsFar]) assert.ok(calls.some((c) => c[0] === 'deleteVertexArray' && c[1] === v), 'and both card arrays');
  assert.equal(r._cornerBufs.length, 4);
  for (const b of r._cornerBufs) assert.ok(calls.some((c) => c[0] === 'deleteBuffer' && c[1] === b), 'and every corner buffer');
});

/** a cell's blades as the placer shapes them (perf2's rig): perCell roots over the cell, height h, root y */
function cellPlaced(cx, cz, perCell, { h = 0.7, y = 10, cell = GRASS_CELL } = {}) {
  const inst = new Float32Array(perCell * 4), inst2 = new Float32Array(perCell * 4), rootY = new Float32Array(perCell), ground = new Float32Array(perCell * 3);
  for (let i = 0; i < perCell; i++) {
    inst[i * 4] = cx * cell + (i % 7) / 7 * cell; inst[i * 4 + 1] = cz * cell + Math.floor(i / 7) % 7 / 7 * cell; inst[i * 4 + 2] = h; inst[i * 4 + 3] = i / perCell;
    rootY[i] = y;
  }
  return { inst, inst2, rootY, ground, count: perCell, perCell };
}

test('MEADOW1: a cell in the meadow is one draw of a third of its blades on the cards - three near, two past a quarter of the range - and its box holds the tallest card while the decode frame stays the blades\' own (mutants: no far cards, the box a blade\'s, every blade a tuft)', () => {
  const { gl, calls } = stubGl();
  const r = new LabGrassRenderer(gl);
  const perCell = 49;
  r.allocSlots(perCell, 4);
  r.writeSlot(0, cellPlaced(0, 1, perCell));   // 30..60 m ahead: inside a quarter of 300
  r.writeSlot(1, cellPlaced(0, 3, perCell));   // 90..120 m ahead: past it
  const eye = [0, 12, 0];
  const proj = mirrorProjectionX(perspective(Math.PI / 3, 16 / 9, 0.2, 6000));
  const view = lookAt(eye, [0, 12, 1], [0, 1, 0]);
  calls.length = 0;
  r.draw(proj, view, new Float32Array(eye), 0, LIGHT, WIND, 300, 'meadow');
  const m = Math.ceil(perCell / MEADOW_BLADES_PER_TUFT);
  assert.equal(MEADOW_BLADES_PER_TUFT, 3);
  assert.deepEqual([r.drawn.slots, r.drawn.cardSlots, r.drawn.cardsFarSlots, r.drawn.farSlots], [2, 2, 1, 0], 'two cells on the cards, the far one on two');
  assert.equal(r.drawn.blades, 2 * m, 'a sprite for every three of the lab\'s blades');
  assert.equal(r.drawn.kept, 2 * perCell, 'the cells still hold every blade');
  assert.equal(r.drawn.verts, m * r.vertsCards + m * r.vertsCardsFar, 'three cards near, two far');
  const draws = calls.filter((c) => c[0] === 'drawArraysInstanced').map((c) => [c[3], c[4]]);
  assert.deepEqual(draws, [[r.vertsCards, m], [r.vertsCardsFar, m]]);
  assert.deepEqual(calls.filter((c) => c[0] === 'uniform1f' && c[1] === 'uSlotN').map((c) => c[2]), [m, m], 'the fade\'s fraction is over the cell\'s sprites');
  const binds = calls.filter((c) => c[0] === 'bindVertexArray').map((c) => c[1]).filter((v) => v !== null && v !== r.vao);   // the draw and the loop both start on the near blade's (GRASS2)
  assert.deepEqual(binds, [r.vaoCards, r.vaoCardsFar], 'each card array bound once, in turn');
  // the pixel style draws the same cells one quad a tuft, as it did
  r.draw(proj, view, new Float32Array(eye), 0, LIGHT, WIND, 300, 'pixel');
  assert.deepEqual([r.drawn.cardSlots, r.drawn.farSlots, r.drawn.blades], [0, 2, 2 * Math.ceil(perCell / 2)]);
  // THE BOX: a bush's card stands MEADOW_MAX_SCALE of its blade up and reaches MEADOW_REACH of it out; the decode frame is the roots'
  const hLaw = heightFloor() + heightSpan();
  for (const h of [0.5, 50]) {   // 50: a blade the height lane cannot hold - the GPU decodes the law's tallest
    r.writeSlot(2, cellPlaced(2, 2, perCell, { h, y: 10 }));
    const box = r.slotBox[2], hd = Math.min(h, hLaw);
    const x0 = 60, x1 = Math.fround(60 + 6 / 7 * 30);   // the rig's roots are float32, as the placer's are
    assert.ok(Math.abs(box[0] - (x0 - hd * MEADOW_REACH)) < 1e-9 && Math.abs(box[3] - (x1 + hd * MEADOW_REACH)) < 1e-9, `h ${h}: the box reaches the widest card`);
    assert.ok(Math.abs(box[4] - Math.max(10 + h, 10 + hd * MEADOW_MAX_SCALE)) < 1e-9, `h ${h}: and stands to the tallest`);
    assert.deepEqual([...r.slotFrame.subarray(8, 12)], [x0, 60, 10, h], `h ${h}: the decode frame is still the blades' own bounds`);
  }
  assert.ok(MEADOW_REACH > 1.2 && MEADOW_REACH < 2, `the reach over a blade's height (${MEADOW_REACH})`);
});

test('MEADOW1: the meadow\'s edits land once each over the four lists before them, every one says why, its words are the game\'s alone, and the row ships it as the default with Pixel and Smooth a choice away', () => {
  let text = applyGrassEdits(applyGrassEdits(applyGrassEdits(LAB_GRASS_VS, GRASSPX_VS_EDITS), GRASSFOG_VS_EDITS), GRASSLIT_VS_EDITS);
  for (const e of GRASSMEADOW_VS_EDITS) { assert.equal(text.split(e.from).length - 1, 1, `VS: ${e.why}`); assert.ok(e.why.length > 20); text = applyGrassEdits(text, [e]); }
  assert.equal(text, GAME_GRASS_VS);
  text = applyGrassEdits(applyGrassEdits(applyGrassEdits(LAB_GRASS_FS, GRASSPX_FS_EDITS), GRASSFOG_FS_EDITS), GRASSLIT_FS_EDITS);
  for (const e of GRASSMEADOW_FS_EDITS) { assert.equal(text.split(e.from).length - 1, 1, `FS: ${e.why}`); assert.ok(e.why.length > 20); text = applyGrassEdits(text, [e]); }
  assert.equal(text, GAME_GRASS_FS);
  for (const word of ['uArt', 'aCard', 'mDir', 'uArtGround']) {
    assert.ok(!LAB_GRASS_VS.includes(word) && !LAB_GRASS_FS.includes(word), `the lab's text does not know ${word}`);
    assert.ok(GAME_GRASS_VS.includes(word) || GAME_GRASS_FS.includes(word), `the game's does: ${word}`);
  }
  // the law's numbers are written into the stage from their one home
  assert.ok(GAME_GRASS_VS.includes(`smoothstep(${MEADOW_LUSH[0]}, ${MEADOW_LUSH[1]}, aInst2.z)`) && GAME_GRASS_VS.includes(`mix(${MEADOW_SHARES.bush[0]}, ${MEADOW_SHARES.bush[1]}, mLush)`));
  // the style's word: anything but the two older words is the meadow, and the meadow is a pixel style
  assert.deepEqual(['meadow', 'pixel', 'smooth', undefined, 'junk'].map(meadowGrass), [true, false, false, true, true]);
  assert.deepEqual(['meadow', 'pixel', 'smooth'].map(pixelGrass), [true, true, false]);
  // the probe photographs it, on both lanes, beside the pixel style
  const probe = read('tools/meadowProbe.mjs');
  for (const s of ["shot('eye', ", "shot('eye-pixel', ", "shot('close', ", "shot('high', ", "shot('dusk', ", "shot('lane', "]) assert.ok(probe.includes(s), `the probe's ${s}`);
});
