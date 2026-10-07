// MEADOW1 (2026-10-06, Mac: "These are 4 textures I want to blend into our grass system, all with varying sizes so its
// not monotonous everywhere"; then a bush, "of different sizes", and "instead of billboarding, these should have a sort
// of low poly look to them, like the trees"): THE OWNER'S SPRITES ON CROSSED CARDS. The sprites are his PNGs texel for
// texel; the atlas and its chain keep each one's coverage; the vertex stage's own text picks a sprite and sizes its
// card exactly as the JS law does, stands its cards fixed in the world at the tuft's yaw, turns and mirrors them by what
// the corner carries, and shades each by the low-poly trees' face law; the fragment stage moves the owner's colours by
// the ground exactly as meadowTexel does; the renderer uploads, binds, counts and frees what the style needs.
// AUDIT MEADOW1 (2026-10-06, Mac: "These are my art. Please audit everything and ensure performance is perfect"; then
// "Let's have our grass tufts off by default also, and have the wind sway effect the new foilage, like it does the
// trees"): the cards cut to their sprites' drawn boxes and drawn indexed, the tuft's seed off its cell's lane (no shift
// of the floating origin re-rolls it), the level by the card's height, the cards on the ground's slope, the face law by
// the light's height, the third card handed over tuft by tuft, the box the meadow's own and the wind's, the gust wave
// carried across the floating origin, the field still under the trees' switch, and the grass Off by default.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bakeMeadow, spriteOf, SOURCES, OUT, MEADOW_ALPHABET as BAKE_ALPHABET } from '../tools/bakeMeadow.mjs';
import { readPng } from '../tools/pngIO.mjs';
import { MEADOW_SPRITES, MEADOW_ALPHABET } from '../src/render/meadowArt.js';
import { buildMeadowAtlas, buildMeadowMips, downsampleMeadow, slotCoverage, meadowPick, meadowCardCorners, meadowCardIndices, meadowGrass, meadowTexel, meadowArtGround, meadowSpriteMean,
  meadowSpriteBox, MEADOW_SLOTS, MEADOW_CELL, MEADOW_CARDS, MEADOW_CARDS_FAR, MEADOW_NEAR_AT, MEADOW_NEAR_BAND, MEADOW_BLADES_PER_TUFT, MEADOW_VARIANTS, MEADOW_SHARES, MEADOW_LUSH,
  MEADOW_PATCH_SCALE, MEADOW_FACE, MEADOW_GREEN, MEADOW_SHIFT, MEADOW_GREEN_EDGE, MEADOW_BOXES, MEADOW_SEED, MEADOW_TOP, MEADOW_REACH, MEADOW_WIND_REACH, MEADOW_CARD_SLOTS,
  MEADOW_SLOPE_FLOOR, LAB_LEAN_PER_PUSH, LAB_GUST_MAX, MEADOW_BUSH, MEADOW_FLOWERS, MEADOW_DRY, MEADOW_SHORT, MEADOW_TALL } from '../src/render/grassMeadow.js';
import { LAB_GRASS_HEAD, GAME_GRASS_FIELD, LAB_GRASS_VS, LAB_GRASS_FS, GAME_GRASS_VS, GAME_GRASS_FS, GRASSPX_VS_EDITS, GRASSPX_FS_EDITS, GRASSFOG_VS_EDITS, GRASSFOG_FS_EDITS,
  GRASSLIT_VS_EDITS, GRASSLIT_FS_EDITS, GRASSMEADOW_VS_EDITS, GRASSMEADOW_FS_EDITS, applyGrassEdits, LabGrassRenderer, GRASS_CELL, GRASS_TONES, GRASS_TONES_CLASSIC,
  GRASS_MAX_LIGHTS, heightFloor, heightSpan, packHeightSlope, unpackHeightSlope, labBladeCorners, GRASS_FAR_SEGMENTS } from '../src/render/labGrass.js';
import { SHADOW_POINT_CASTERS } from '../src/render/shadowPass.js';
import { EL_MAX_LIGHTS, elDecode3, elDecodeN } from '../src/render/enhancedLighting.js';
import { pixelGrass, PX_RAMP_STEPS } from '../src/render/grassPixelArt.js';
import { floraSwayOf, gustPhaseAfterShift, gustClock, GUST_RATE, GUST_K, LAB_WIND_RATE, WIND_SLIDER_MAX } from '../src/systems/windDrive.js';
import { FEATURES } from '../src/systems/features.js';
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

test('MEADOW1: the atlas - eight 64-texel cells, the sprite\'s foot on row 0, a 32-pixel sprite at two texels a pixel, a hard alpha, and three cells of air (mutants: the sprite upside down; AUDIT MEADOW1: a ninth sprite let in)', () => {
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
  assert.throws(() => buildMeadowAtlas({ sprites: Array(9).fill(MEADOW_SPRITES[0]) }), /9 sprites in an atlas of 8/, 'a ninth sprite has no cell of its own - refused, never laid over the next');
});

test('MEADOW1: the chain keeps EACH sprite\'s coverage, takes a block\'s colour as its covered texels\' mean, reaches 1x1, and a tuft\'s first level is the owner\'s own 32x32; AUDIT MEADOW1: and keeps the blocks the law names - the most covered, then the higher, then the leftmost (mutants: the floor gone, the mean over air, either key of the choice reversed)', () => {
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
  // which blocks: every covered block of a sprite's cell, in the law's order, is kept down to the share and dropped after
  for (let k = 0; k + 1 < chain.length; k++) {
    const lo = chain[k], up = chain[k + 1], cw = up.width / MEADOW_SLOTS;
    if (cw < 1) continue;
    for (let v = 0; v < 5; v++) {
      const blocks = [];
      for (let y = 0; y < up.height; y++) {
        for (let x = v * cw; x < (v + 1) * cw; x++) {
          let n = 0;
          for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (lo.data[((2 * y + dy) * lo.width + 2 * x + dx) * 4 + 3]) n++;
          if (n) blocks.push({ x, y, n, kept: up.data[(y * up.width + x) * 4 + 3] === 255 });
        }
      }
      blocks.sort((a, c) => c.n - a.n || c.y - a.y || a.x - c.x);
      const kept = blocks.filter((b) => b.kept).length;
      assert.deepEqual(blocks.map((b) => b.kept), blocks.map((_, i) => i < kept), `level ${k + 1}: ${MEADOW_SPRITES[v].name} keeps its ${kept} most covered blocks, the higher then the leftmost first`);
    }
  }
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

test('MEADOW1: which sprite a blade wears and how big its card stands - the vertex stage\'s own text, run, is meadowPick at every width byte and patch, its numbers exact; AUDIT MEADOW1: a card leans its own share of its standing lean and the trees\' share of the wind (mutants: any share or scale moved a step, the patch\'s scale dropped, the bush as stiff as grass, the wind\'s share the stiffness)', () => {
  const vs = vertexStage();
  const h = heightFloor() + heightSpan();   // the lane's top word: the law's tallest blade
  const counts = { poor: [0, 0, 0, 0, 0], lush: [0, 0, 0, 0, 0] };
  for (const tint of [0, 0.2, 0.35, 0.5, 0.55, 0.65, 0.8, 1]) {
    for (let b = 0; b < 256; b++) {
      const r = b / 255;
      const g = vs.run({ aPB: [0.5, 0.5, tint, r], aCorner: [0.5, 1], aCard: 0, uWindV: [0, 0] });
      const want = meadowPick(r, tint);
      assert.equal(g.vVar, want.variant, `tint ${tint} byte ${b}: the stage's sprite is the law's`);
      assert.ok(Math.abs(g.gl_Position[1] - h * want.scale * MEADOW_BOXES[want.variant].v1) < 1e-9, `tint ${tint} byte ${b}: the card's side is ${h * want.scale}, and its top the share of it its sprite stands (${g.gl_Position[1]})`);
      if (tint === 0) counts.poor[want.variant]++;
      if (tint === 1) counts.lush[want.variant]++;
    }
  }
  // the shares, by the byte grid - [tall, short, flowers, dry, bush]
  assert.deepEqual(counts.poor, [72, 118, 2, 61, 3], 'a poor patch: short and dry grass, two flowering tufts, three bushes in 256');
  assert.deepEqual(counts.lush, [147, 63, 35, 5, 6], 'a lush one: tall grass and flowers, five dry tufts, six bushes');
  assert.deepEqual(JSON.parse(JSON.stringify(MEADOW_SHARES)), { bush: [0.008, 0.02], flowers: [0.01, 0.14], dry: [0.24, 0.02], short: [0.62, 0.3] });
  assert.deepEqual([...MEADOW_LUSH], [0.3, 0.7]);
  assert.deepEqual([...MEADOW_PATCH_SCALE], [0.8, 1.25]);
  assert.deepEqual(MEADOW_VARIANTS.map((v) => ({ ...v })), [
    { name: 'tall', scale: 4 / 3, stiff: 1, sway: 1 }, { name: 'short', scale: 4 / 3, stiff: 1, sway: 1 },
    { name: 'flowers', scale: 4 / 3, stiff: 1, sway: 1 }, { name: 'dry', scale: 4 / 3, stiff: 1, sway: 1 },
    { name: 'bush', scale: 2.25, stiff: 0.3, sway: 0.6 }]);
  // the wind's shares are the trees' own (windDrive.js floraSwayOf): a tall flora record sways whole, a short one six tenths
  assert.deepEqual([floraSwayOf(7, 7, 1e9), floraSwayOf(7, 7, 0)], [MEADOW_VARIANTS[MEADOW_TALL].sway, MEADOW_VARIANTS[MEADOW_BUSH].sway]);
  // THE LEAN at a card's top: its share of the standing lean (stiff) and of the wind (sway), the lab's own law for both
  const top = (r, lx, windV, t) => { const g = vs.run({ aPB: [lx, 0.5, 0, r], aCorner: [0.5, 1], aCard: 0, uWindV: windV, uTime: t }); return [g.gl_Position[0], g.gl_Position[1], g.vVar]; };
  for (const [r, v] of [[0.99, MEADOW_TALL], [0, MEADOW_BUSH]]) {
    const [x0, y0, got] = top(r, 0.5, [0, 0], 0);   // standing straight, still air
    assert.equal(got, v);
    const k = MEADOW_BOXES[v].v1 * y0;   // the top's share of a lean (vT squared), times the card's side: v1 x (v1 x side)
    const [xs] = top(r, 1, [0, 0], 0);   // the standing lean, 0.25 along x
    assert.ok(Math.abs((xs - x0) - 0.25 * MEADOW_VARIANTS[v].stiff * k) < 1e-9, `${MEADOW_VARIANTS[v].name}: its share of its standing lean`);
    for (const t of [0, 0.7, 2.3]) {
      const gust = Math.sin(t * 1.7 - 15 * 0.35) * 0.5 + 0.5;   // the root 15 m down the wind; the phase byte 0
      const [xw] = top(r, 0.5, [6, 0], t);
      assert.ok(Math.abs((xw - x0) - 6 * (0.55 + gust * 0.75) * LAB_LEAN_PER_PUSH * MEADOW_VARIANTS[v].sway * k) < 1e-9, `${MEADOW_VARIANTS[v].name} at ${t} s: its share of the wind's lean`);
    }
  }
  assert.deepEqual([LAB_LEAN_PER_PUSH, LAB_GUST_MAX], [0.055, 1.3]);
  // ...and lit by the lean it stands at, not the blade's: a bush leaning 0.25 stands at its third of it, under a sun overhead
  const litBy = (lx) => Math.hypot(0, 1.2) / Math.hypot(lx, 1.2);   // its normal, up off level ground and back off its lean
  const bushLit = vs.run({ aPB: [1, 0.5, 0, 0], aCorner: [0.5, 1], aCard: 0, uWindV: [0, 0], uSunDir: [0, 1, 0], uMoonDir: [0, 1, 0] }).vLam;
  assert.ok(Math.abs(bushLit - litBy(0.25 * MEADOW_VARIANTS[MEADOW_BUSH].stiff)) < 1e-12, `a bush is lit by its own lean (${bushLit})`);
  const bladeLit = vs.run({ uArt: 0 }).vLam;
  assert.ok(Math.abs(bladeLit - litBy(0.25)) < 1e-12, '...the pixel style\'s blade by the whole of it');
  vs.run({ uArt: 1 });
  assert.ok(GAME_GRASS_VS.includes('float push = length(uWindV) * (0.55 + gust * 0.75);') && GAME_GRASS_VS.includes('vec2 lean = aInst2.xy + wdir * push * 0.055;'), 'the lab\'s own law, whose numbers those are');
  // the switch off is the pixel style's blade: no card, no pick
  const off = vs.run({ uArt: 0, aPB: [0.5, 0.5, 0.5, 0], aCorner: [0.5, 1], uWindV: [0, 0] });
  assert.ok(Math.abs(off.gl_Position[1] - h) < 1e-9, 'the pixel style stands the blade its own height');
  vs.run({ uArt: 1 });
});

test('AUDIT MEADOW1: the card arrays - six slots a card and four of them indexed, both triangles ending on the corner they share, so a corner is shaded once and a card reads the root\'s sun and lanterns once; the far set the near set\'s first two (mutants: a triangle not ending on the shared corner, the far cards turned their own way)', () => {
  assert.deepEqual([MEADOW_CARDS, MEADOW_CARDS_FAR, MEADOW_NEAR_AT, MEADOW_NEAR_BAND, MEADOW_CARD_SLOTS], [3, 2, 0.25, 0.05, 6]);
  const rows = (f) => Array.from({ length: f.length / 3 }, (_, i) => [f[i * 3], f[i * 3 + 1], f[i * 3 + 2]]);
  const near = rows(meadowCardCorners(MEADOW_CARDS));
  assert.equal(near.length, 18);
  for (let k = 0; k < 3; k++) {
    const t = Math.fround(k / 3 + (k % 2));
    assert.deepEqual(near.slice(k * 6, k * 6 + 6), [[0, 0, t], [1, 0, t], [1, 1, t], [0, 1, t], [0, 0, t], [0, 0, t]], `card ${k}: four corners and two slots no index names, turned k/3 of a half-turn, the mirror flag on every other`);
  }
  assert.deepEqual(rows(meadowCardCorners(MEADOW_CARDS_FAR, MEADOW_CARDS)), near.slice(0, 12), 'the far set is the near set\'s first two - nothing turns at the handover');
  for (const cards of [3, 2]) {
    const idx = [...meadowCardIndices(cards)];
    assert.deepEqual(idx, Array.from({ length: cards }, (_, k) => [0, 1, 2, 3, 0, 2].map((s) => k * 6 + s)).flat());
    for (let t = 0; t < idx.length; t += 3) {
      assert.equal(idx[t + 2] % 6, 2, 'every triangle ends on its card\'s shared corner - the provoking vertex of both (GL\'s last)');
      const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]].map((i) => near[i]);
      assert.ok((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 0, 'labBladeCorners\' winding');
    }
    for (const i of new Set(idx)) assert.equal(i % 3 === 2, i % 6 === 2, `slot ${i}: the shared corner is the one indexed slot the stage's gl_VertexID % 3 == 2 names`);
    assert.equal(new Set(idx).size, cards * 4, 'four corners shaded a card');
  }
  assert.ok(GAME_GRASS_VS.includes('vSun = (gl_VertexID % 3 == 2 && uSunScale > 0.0)') && GAME_GRASS_VS.includes('if (gl_VertexID % 3 == 2) for (int j = 0; j < 8; j++)'), 'the stage reads the root\'s sun and lanterns where the id names');
  assert.deepEqual([labBladeCorners(5).length / 2, labBladeCorners(GRASS_FAR_SEGMENTS).length / 2], [30, 6], 'the blades\' arrays are the lab\'s, drawn as they were');
});

const LEVEL = packHeightSlope(1, 0, 0, 0) / 65535;

test('MEADOW1: the cards in the stage - cut to the sprite\'s drawn box, at the tuft\'s own yaw and fixed in the world (no billboard), turned k/3 of a half-turn, mirrored by turning the card so its uv never flips; AUDIT MEADOW1: the seed is the tuft\'s place in its cell, so a shift of the floating origin turns, mirrors and re-picks nothing (mutants: the quad turned to the eye, the mirror flag lost or always set, the seed the scene\'s root again)', () => {
  assert.deepEqual(MEADOW_BOXES.map((b) => [b.u0, b.u1, b.v0, b.v1]), [[3 / 32, 29 / 32, 0, 24 / 32], [3 / 32, 29 / 32, 0, 18 / 32], [1 / 32, 31 / 32, 0, 21 / 32], [1 / 32, 31 / 32, 0, 21 / 32], [2 / 64, 63 / 64, 0, 52 / 64]], 'each sprite\'s drawn box, off its own rows');
  assert.deepEqual(meadowSpriteBox({ width: 4, height: 4, rows: ['....', '.A..', '..A.', '....'] }), { u0: 0.25, u1: 0.75, v0: 0.25, v1: 0.75 });
  assert.deepEqual(meadowSpriteBox({ width: 2, height: 2, rows: ['..', '..'] }), { u0: 0.5, u1: 0.5, v0: 0, v1: 0 }, 'air: a card of no area');
  assert.equal(MEADOW_SEED, 64);
  const vs = vertexStage();
  const seedOf = (ax, az) => vs.f.hash([ax * MEADOW_SEED, az * MEADOW_SEED]);
  const at = (x, y, t, set = {}) => vs.run({ aPA: [0.5, 0.5, 0, LEVEL], aPB: [0.5, 0.5, 0.5, 0.99], aCorner: [x, y], aCard: t, uEye: [0, 1, 0], uCellFrame: [0, 0, 0, 1], uWindV: [0, 0], ...set });
  const b = MEADOW_BOXES[MEADOW_TALL], h = (heightFloor() + heightSpan()) * meadowPick(0.99, 0.5).scale;
  const yaw = seedOf(0.5, 0.5), mirrored = (yaw * 8) % 1 >= 0.5;
  const turns = [0, Math.fround(1 / 3 + 1), Math.fround(2 / 3)];
  turns.forEach((t, k) => {
    const g0 = at(0, 0, t), p0 = [...g0.gl_Position], uv0 = [...g0.vUV];
    const g1 = at(1, 1, t), p1 = [...g1.gl_Position], uv1 = [...g1.vUV];
    assert.deepEqual([uv0, uv1], [[b.u0, b.v0], [b.u1, b.v1]], `card ${k}: its corners are the sprite's drawn box, never flipped`);
    assert.ok(Math.abs(p1[1] - p0[1] - b.v1 * h) < 1e-9, 'it stands the box\'s share of a square side');
    const flip = mirrored !== (t >= 1) ? -1 : 1, a = (yaw + (t % 1)) * Math.PI, w = (b.u1 - b.u0) * h;   // the corner carries its turn as a float32
    assert.ok(Math.abs(p1[0] - p0[0] - flip * Math.cos(a) * w) < 1e-9 && Math.abs(p1[2] - p0[2] - flip * Math.sin(a) * w) < 1e-9, `card ${k}: turned ${k}/3 of a half-turn off the tuft's yaw, mirrored by turning`);
  });
  // walking round the tuft turns nothing - the pixel style's quad, which faces the eye, turns
  const edge = (eye) => { const p0 = [...at(0, 0, 0, { uEye: eye }).gl_Position], p1 = at(1, 0, 0, { uEye: eye }).gl_Position; return [p1[0] - p0[0], p1[2] - p0[2]]; };
  for (const eye of [[40, 1, 0], [0, 1, 40], [-20, 1, -20]]) {
    const a = edge([0, 1, 0]), c = edge(eye);
    assert.ok(Math.abs(a[0] - c[0]) < 1e-12 && Math.abs(a[1] - c[1]) < 1e-12, `the card stands where it stood with the eye at ${eye}`);
  }
  const quad = (eye) => { const p0 = [...vs.run({ uArt: 0, aPB: [0.5, 0.5, 0.5, 0.99], aCorner: [0, 0], uEye: eye }).gl_Position]; const p1 = vs.run({ aCorner: [1, 0] }).gl_Position; return [p1[0] - p0[0], p1[2] - p0[2]]; };
  const q1 = quad([0, 1, 0]), q2 = quad([40, 1, 0]);
  assert.ok(Math.abs(q1[0] * q2[1] - q1[1] * q2[0]) > 1e-3, 'the pixel style\'s billboard does turn - the contrast the meadow is not');
  vs.run({ uArt: 1 });
  // mirrored by the tuft's own seed, over a field of them: about half
  let flips = 0;
  for (let i = 0; i < 20; i++) {
    for (let j = 0; j < 20; j++) {
      const ax = (i + 0.37) / 20, az = (j + 0.61) / 20, s = seedOf(ax, az);
      const p0 = [...at(0, 0, 0, { aPA: [ax, az, 0, LEVEL] }).gl_Position], p1 = at(1, 0, 0, { aPA: [ax, az, 0, LEVEL] }).gl_Position, d = [p1[0] - p0[0], p1[2] - p0[2]];
      const along = d[0] * Math.cos(s * Math.PI) + d[1] * Math.sin(s * Math.PI);
      assert.equal(along < 0, (s * 8) % 1 >= 0.5, `tuft ${i},${j}: mirrored by its own seed`);
      if (along < 0) flips++;
    }
  }
  assert.ok(flips > 160 && flips < 240, `about half of 400 tufts mirrored (${flips})`);
  // THE FLOATING ORIGIN: a crossing moves the slot's frame by the shift, and nothing a tuft wears
  const shift = [819.2, 0, -1638.4];
  for (const [ax, az] of [[0.5, 0.5], [0.13, 0.71], [0.94, 0.2]]) {
    for (const t of turns) {
      const pose = (frame) => {
        const set = { aPA: [ax, az, 0, LEVEL], uCellFrame: [frame[0], frame[2], 0, 1], uEye: [frame[0], 1, frame[2]] };
        const p0 = [...at(0, 0, t, set).gl_Position], g = at(1, 1, t, set);
        return { d: [g.gl_Position[0] - p0[0], g.gl_Position[1] - p0[1], g.gl_Position[2] - p0[2]], uv: [...g.vUV], at: [p0[0] - frame[0], p0[2] - frame[2]] };
      };
      const before = pose([0, 0, 0]), after = pose(shift);
      assert.ok(before.d.every((v, i) => Math.abs(v - after.d[i]) < 1e-6) && before.at.every((v, i) => Math.abs(v - after.at[i]) < 1e-6), `the tuft at ${ax},${az} card ${t}: the same card, the same place, across the crossing`);
      assert.deepEqual(before.uv, after.uv);
    }
    const px = (frame) => vs.run({ uArt: 0, uPxVariants: 8, aPA: [ax, az, 0, LEVEL], aCorner: [0.5, 0.5], uCellFrame: [frame[0], frame[2], 0, 1], uEye: [frame[0], 1, frame[2]] }).vVar;
    assert.equal(px(shift), px([0, 0, 0]), `the pixel style's tuft at ${ax},${az} keeps its sprite across the crossing`);
    vs.run({ uArt: 1, uCellFrame: [0, 0, 0, 1], uEye: [0, 1, 0] });
  }
  assert.ok(!GAME_GRASS_VS.includes('hash(root * 0.37)'), 'no seed reads the scene\'s root');
});

test('AUDIT MEADOW1: the third card hands over tuft by tuft across a band past a quarter of the range - each at its own distance off its seed - and a cell draws the far set only past the band (mutants: the band dropped, every tuft at one distance, the first two culled too)', () => {
  const vs = vertexStage();
  const third = Math.fround(2 / 3), range = 300;
  const T = [];
  for (let i = 0; i < 60; i++) {
    const ax = (i * 0.618034) % 1, az = (i * 0.414214 + 0.3) % 1;
    const yaw = vs.f.hash([ax * MEADOW_SEED, az * MEADOW_SEED]);
    const dT = range * (MEADOW_NEAR_AT + MEADOW_NEAR_BAND * ((yaw * 64) % 1));
    T.push(dT);
    const root = [ax * 30, az * 30];
    const run = (dist, card) => [...vs.run({ aPA: [ax, az, 0, LEVEL], aPB: [0.5, 0.5, 0.5, 0.99], aCorner: [1, 1], aCard: card, uEye: [root[0] - dist, 1, root[1]], uRange: range, uWindV: [0, 0] }).gl_Position];
    if (i < 12) {
      assert.deepEqual(run(dT + 0.01, third), [2, 2, 2, 1], `tuft ${i}: past its own ${dT.toFixed(2)} m the third card is gone`);
      assert.notDeepEqual(run(dT - 0.01, third), [2, 2, 2, 1], `tuft ${i}: short of it, it stands`);
      for (const card of [0, Math.fround(1 + 1 / 3)]) assert.notDeepEqual(run(dT + 0.01, card), [2, 2, 2, 1], 'the first two stand at every distance');
    }
  }
  assert.ok(Math.min(...T) >= range * MEADOW_NEAR_AT && Math.max(...T) < range * (MEADOW_NEAR_AT + MEADOW_NEAR_BAND), 'every tuft hands over inside the band');
  assert.ok(Math.min(...T) < range * (MEADOW_NEAR_AT + 0.01) && Math.max(...T) > range * (MEADOW_NEAR_AT + MEADOW_NEAR_BAND - 0.01), `...and across the whole of it (${Math.min(...T).toFixed(1)} to ${Math.max(...T).toFixed(1)} m)`);
});

test('AUDIT MEADOW1: a card stands on the ground\'s own slope - its foot sheared to the plane under its root, the pixel style\'s billboard as it was (mutant: the level foot back)', () => {
  const vs = vertexStage();
  const word = packHeightSlope(1, 0.4, -0.3, 0) / 65535, g = unpackHeightSlope(packHeightSlope(1, 0.4, -0.3, 0));
  const gy = Math.sqrt(Math.max(1 - g.nx * g.nx - g.nz * g.nz, 0));
  assert.ok(gy > MEADOW_SLOPE_FLOOR, 'the floor is a guard a normal the pack wrote never meets');
  let most = 0;
  for (const t of [0, Math.fround(1 + 1 / 3), Math.fround(2 / 3)]) {
    for (const [cx, cy] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
      const flat = [...vs.run({ aPA: [0.5, 0.5, 0, LEVEL], aPB: [0.5, 0.5, 0.5, 0.99], aCorner: [cx, cy], aCard: t, uWindV: [0, 0] }).gl_Position];
      const tilt = [...vs.run({ aPA: [0.5, 0.5, 0, word] }).gl_Position];
      const dx = tilt[0] - 15, dz = tilt[2] - 15, want = flat[1] - (g.nx * dx + g.nz * dz) / gy;
      assert.ok(Math.abs(tilt[0] - flat[0]) < 1e-12 && Math.abs(tilt[2] - flat[2]) < 1e-12 && Math.abs(tilt[1] - want) < 1e-9, `card ${t} corner ${cx},${cy}: on the plane through the root`);
      most = Math.max(most, Math.abs(tilt[1] - flat[1]));
    }
  }
  assert.ok(most > 0.05, `the foot moved with the ground (${most.toFixed(3)} m at the most)`);
  const pxFlat = vs.run({ uArt: 0, aPA: [0.5, 0.5, 0, LEVEL], aCorner: [1, 0] }).gl_Position[1], pxTilt = vs.run({ aPA: [0.5, 0.5, 0, word] }).gl_Position[1];
  assert.equal(pxTilt, pxFlat, 'the pixel style\'s quad faces the eye and keeps its level foot');
  vs.run({ uArt: 1 });
});

test('MEADOW1: a card is shaded by the low-poly trees\' own face law - the face the eye sees against the light, never under half - on its lambert about the ground; AUDIT MEADOW1: by the light\'s height, so a light overhead lights every card as its ground and the facets show as it sinks; the moon\'s by the moon (mutants: the face law dropped, the face not turned to the eye, the sun\'s law on the moon, the height dropped)', () => {
  const bb = read('src/render/renderer.js');
  assert.ok(bb.includes(`float faceSun = clamp(${MEADOW_FACE.base} + ${MEADOW_FACE.span} * dot(wn, uLptSun.xyz), ${MEADOW_FACE.floor}, 1.0);`), 'the trees\' own numbers (BB_VS) - the meadow\'s are theirs');
  assert.deepEqual({ ...MEADOW_FACE }, { base: 0.72, span: 0.28, floor: 0.5 });
  const vs = vertexStage();
  const sun = [0.9, 0.3, 0.2], moon = [-0.3, 0.6, 0.75];
  const unit = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
  const sunN = unit(sun), moonN = unit(moon);
  const yaw = vs.f.hash([0.5 * MEADOW_SEED, 0.5 * MEADOW_SEED]);
  const dir = [Math.cos(yaw * Math.PI), Math.sin(yaw * Math.PI)];
  const face = [-dir[1], dir[0]];   // card 0's normal in xz, whichever way it was mirrored
  const shade = (seen, L) => Math.min(1, Math.max(MEADOW_FACE.floor, MEADOW_FACE.base + MEADOW_FACE.span * (seen[0] * L[0] + seen[1] * L[2])));
  for (const side of [1, -1]) {
    const eye = [15 + face[0] * 20 * side, 1, 15 + face[1] * 20 * side];   // the eye on one side of card 0 and then the other
    const blade = vs.run({ uArt: 0, aPB: [0.5, 0.5, 0.5, 0.99], aCorner: [0.5, 0.5], aCard: 0, uEye: eye, uSunDir: sun, uMoonDir: moon, uWindV: [0, 0] });
    const [bs, bm] = [blade.vLam, blade.vMoonLam];
    const g = vs.run({ uArt: 1 });
    const seen = [face[0] * side, face[1] * side];   // the face turned to the eye
    const ks = 1 + (shade(seen, sunN) - 1) * Math.hypot(sunN[0], sunN[2]), km = 1 + (shade(seen, moonN) - 1) * Math.hypot(moonN[0], moonN[2]);
    assert.ok(bs > 0.2 && bm > 0.2, 'the blade\'s own lambert is lit by both');
    assert.ok(Math.abs(g.vLam - bs * ks) < 1e-9, `side ${side}: the sun's lambert times its face's shade by the sun's height (${g.vLam} against ${bs} x ${ks})`);
    assert.ok(Math.abs(g.vMoonLam - bm * km) < 1e-9, `side ${side}: ...and the moon's by the moon (${g.vMoonLam} against ${bm} x ${km})`);
  }
  const lit = vs.run({ uEye: [15 + face[0] * 20, 1, 15 + face[1] * 20] }).vLam, dark = vs.run({ uEye: [15 - face[0] * 20, 1, 15 - face[1] * 20] }).vLam;
  assert.notEqual(lit, dark, 'a low sun picks the two faces apart - the facet');
  assert.ok(Math.min(lit, dark) >= 0.5 * Math.max(lit, dark) - 1e-12, '...and the darker keeps at least half, as a tree\'s does');
  // a sun overhead: every card is lit as the ground under it, on both faces
  for (const side of [1, -1]) {
    const eye = [15 + face[0] * 20 * side, 1, 15 + face[1] * 20 * side];
    const blade = vs.run({ uArt: 0, uEye: eye, uSunDir: [0, 1, 0], uMoonDir: [0, 1, 0] }).vLam, g = vs.run({ uArt: 1 }).vLam;
    assert.ok(Math.abs(g - blade) < 1e-12, `noon, side ${side}: the card's light is its ground's (${g} against ${blade})`);
  }
});

test('MEADOW1: the owner\'s colours on any ground - the fragment stage\'s own text is meadowTexel: his green at the lane\'s middle tone over the tile, a petal keeping its hue, the ratio held to its span; AUDIT MEADOW1: no ramp folds his shades, and a card\'s level is its height\'s (mutants: the art unmoved, every texel the green\'s hue, the ramp back on the meadow, the level by the card\'s width)', () => {
  const fs = (art, ground, artGround, extra = {}) => {
    const f = glslFunctions(LAB_GRASS_HEAD + GAME_GRASS_FS, {
      vT: 1, vTint: 0.5, vFade: 1, vLam: 0, vSnow: 0, vWet: 0, vGround: [...ground], vMoonLam: 0,
      vUV: [0.5, 1], vVar: 0, vWorld: [0, 0, 10], vSun: 1, vFar: 0, vNear: [0, 0, 0], vPoint: [0, 0, 0],
      uAmb: [1, 1, 1], uSunCol: [1, 1, 1], uMoonCol: [0, 0, 0], uDim: 1, uSunScale: 0, uMoonScale: 0,
      uPixel: 1, uArt: 1, uArtGround: [...artGround], uPxSteps: 2, uPxVariants: MEADOW_SLOTS, uPxTintBands: 3, uLane: 0, uELExposure: 1,
      uGrassTone: GRASS_TONES_CLASSIC.map((k) => [...k]),
      uFogColor: [0, 0, 0], uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uCamPos: [0, 0, 0], uFocus: [0, 0, 0, 0], uDwFog: zeros(5, 4),
      gl_FragCoord: [3, 5, 0.5, 1], o: [0, 0, 0, 0],
      texture: (name) => (name === 'uPxSheet' ? [...art, 1] : [0.5, 0.5, 0, 1]),
      textureLod: (name) => (name === 'uPxSheet' ? [...art, 1] : [0.5, 0.5, 0, 1]),
      dFdx: () => 0.001, dFdy: () => 0.001,
      ...extra,
    });
    f.main();
    return f.globals.o.slice(0, 3);
  };
  // VE's temperate grass base, measured (public/art/vanilla-enhanced/base/302_2-0.png); a darker and a greyer green
  const VE = [49.3 / 255, 72.8 / 255, 39.1 / 255], SWAMP = [44 / 255, 63 / 255, 38 / 255], MOUNTAIN = [59 / 255, 67 / 255, 46 / 255];
  const petal = [153 / 255, 56 / 255, 113 / 255], leaf = [74 / 255, 106 / 255, 67 / 255], dry = [78 / 255, 79 / 255, 55 / 255];
  for (const lane of [GRASS_TONES[1], GRASS_TONES_CLASSIC[1]]) {
    const artGround = meadowArtGround(lane);
    for (const ground of [VE, SWAMP, MOUNTAIN, [0.9, 0.05, 0.9]]) {
      for (const art of [petal, leaf, dry, MEADOW_GREEN]) {
        const got = fs(art, ground, artGround), want = meadowTexel(art, ground, artGround);
        assert.ok(got.every((v, i) => Math.abs(v - want[i]) < 1e-5), `the stage's colour is the twin's - two ramp steps band nothing in the meadow: ${got} against ${want}`);
      }
    }
    // the anchor: the owner's green, on any grass tile, is the tile at the lane's middle tone
    for (const ground of [VE, SWAMP, MOUNTAIN]) {
      const c = meadowTexel(MEADOW_GREEN, ground, artGround);
      c.forEach((v, i) => assert.ok(Math.abs(v - ground[i] * lane[i]) < 1e-12, `his green over ${ground}: the tile's own, at the tone ${lane}`));
    }
  }
  // ...and the pixel style still bands its light
  const artGround = meadowArtGround(GRASS_TONES[1]);
  const banded = fs(leaf, VE, artGround, { uArt: 0 }), clear = fs(leaf, VE, artGround, { uArt: 0, uPxSteps: 1e7 });
  assert.ok(banded.some((v, i) => Math.abs(v - clear[i]) > 1e-3), 'the pixel style\'s ramp still runs');
  // a petal keeps its hue - its channels' ratios - and takes the ground's brightness alone
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
  assert.deepEqual([...MEADOW_SHIFT, MEADOW_GREEN_EDGE], [0.5, 1.6, 12]);
  assert.deepEqual(MEADOW_GREEN.map((v) => Math.round(v * 255)), [75, 106, 69], 'the tall tuft\'s own mean');
  assert.deepEqual(meadowSpriteMean(MEADOW_SPRITES[0]), [...MEADOW_GREEN]);
  // THE LEVEL: a card's own height down a pixel - the cell's 64 texels times the uv's steeper screen step up it
  for (const [ddx, ddy] of [[0.001, 0.001], [0.004, -0.03], [-0.2, 0.05], [0.0001, 0.0002]]) {
    let lod = null, flat = 0;
    fs(leaf, VE, artGround, { dFdx: (v) => (v === 1 ? ddx : 7), dFdy: (v) => (v === 1 ? ddy : -7), textureLod: (n, uv, l) => { lod = l; return [...leaf, 1]; }, texture: (n) => { if (n === 'uPxSheet') flat++; return [...leaf, 1]; } });   // the uv's height is 1 here and its width 0.5: a step of 7 is the width's
    assert.ok(Math.abs(lod - Math.log2(Math.max(Math.max(Math.abs(ddx), Math.abs(ddy)) * MEADOW_CELL, 1))) < 1e-12, `the step ${ddx}, ${ddy}: level ${lod}`);
    assert.equal(flat, 0, 'the meadow never samples at the GPU\'s own level');
  }
  let pxLod = null;
  fs(leaf, VE, artGround, { uArt: 0, textureLod: () => { pxLod = 'read'; return [...leaf, 1]; } });
  assert.equal(pxLod, null, 'the pixel style\'s billboard keeps the GPU\'s level - it faces the eye, and is never squeezed');
});

/** a WebGL2 deep enough for the constructor and the draws, with the calls kept (grasspx.test.js's) */
function stubGl() {
  const calls = [];
  const C = { VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, DYNAMIC_DRAW: 7, FLOAT: 8, TEXTURE_2D: 9, RGBA: 10, UNSIGNED_BYTE: 11, TEXTURE_MIN_FILTER: 12, TEXTURE_MAG_FILTER: 13, NEAREST: 14, TEXTURE0: 100, TEXTURE3: 103, TEXTURE4: 104, BLEND: 20, SRC_ALPHA: 21, ONE_MINUS_SRC_ALPHA: 22, TRIANGLES: 23, CULL_FACE: 24, UNSIGNED_SHORT: 25, NEAREST_MIPMAP_NEAREST: 26, LINEAR: 27, CLAMP_TO_EDGE: 28, TEXTURE_WRAP_S: 29, TEXTURE_WRAP_T: 30, ELEMENT_ARRAY_BUFFER: 31 };
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

/** each vertex array the constructor builds, read back from its calls: the corner data through the pointers it set,
 *  the attributes it enabled, and the indices it bound */
function vertexArrays(calls, C) {
  const out = new Map();
  let cur = null, buf = null, bound = { [C.ARRAY_BUFFER]: null, [C.ELEMENT_ARRAY_BUFFER]: null };
  const data = new Map();
  for (const c of calls) {
    if (c[0] === 'bindVertexArray') { cur = c[1] ? { enabled: new Set(), ptr: {}, corners: null, indices: null } : null; if (c[1]) out.set(c[1], cur); continue; }
    if (c[0] === 'bindBuffer') { bound[c[1]] = c[2]; continue; }
    if (c[0] === 'bufferData' && ArrayBuffer.isView(c[2])) { data.set(bound[c[1]], c[2]); if (cur && c[1] === C.ELEMENT_ARRAY_BUFFER) cur.indices = c[2]; continue; }
    if (!cur) continue;
    if (c[0] === 'enableVertexAttribArray') cur.enabled.add(c[1]);
    if (c[0] === 'vertexAttribPointer') cur.ptr[c[1]] = { size: c[2], type: c[3], stride: c[5], offset: c[6], buf: bound[C.ARRAY_BUFFER] };
  }
  for (const v of out.values()) {
    const p0 = v.ptr[0], f = data.get(p0.buf), bytes = new Float32Array(f.buffer, f.byteOffset, f.length);
    const stride = (p0.stride || p0.size * 4) / 4, n = f.length / stride;
    v.corners = Array.from({ length: n }, (_, i) => {
      const row = [bytes[i * stride + p0.offset / 4], bytes[i * stride + p0.offset / 4 + 1]];
      if (v.ptr[3] && v.enabled.has(3)) row.push(bytes[i * stride + v.ptr[3].offset / 4]);
      return row;
    });
  }
  return out;
}

test('MEADOW1: the renderer - the owner\'s atlas on its own texture, every level, NEAREST and clamped; the meadow binds it on unit 4 with its own counts and each lane its art\'s ground; AUDIT MEADOW1: the card arrays read back through their own pointers are meadowCardCorners and meadowCardIndices, the sprite styles draw unblended, the trees\' switch holds every style still, a palette moves the art\'s ground, and all of it goes with the renderer (mutants: the corners read at the blade\'s stride, the turn never enabled, the switch never on, one ground for both lanes, the pixel count on the meadow, blending back, the atlas leaked)', () => {
  const { gl, calls, C } = stubGl();
  const r = new LabGrassRenderer(gl);
  let bound = null; const ups = [];
  for (const c of calls) { if (c[0] === 'bindTexture') bound = c[2]; else if (c[0] === 'texImage2D' && bound === r.meadowSheet) ups.push([c[2], c[4], c[5]]); }
  assert.deepEqual(ups, buildMeadowMips().map((l, i) => [i, l.width, l.height]), 'every level, by hand');
  const at = calls.findIndex((c) => c[0] === 'bindTexture' && c[2] === r.meadowSheet);
  assert.deepEqual(calls.slice(at).filter((c) => c[0] === 'texParameteri').slice(0, 4).map((c) => [c[2], c[3]]),
    [[C.TEXTURE_MIN_FILTER, C.NEAREST_MIPMAP_NEAREST], [C.TEXTURE_MAG_FILTER, C.NEAREST], [C.TEXTURE_WRAP_S, C.CLAMP_TO_EDGE], [C.TEXTURE_WRAP_T, C.CLAMP_TO_EDGE]], 'a pixel sprite is never filtered');
  assert.notEqual(r.meadowSheet, r.pxSheet);
  // the arrays, as the GPU would read them
  const vaos = vertexArrays(calls, C);
  const rows = (f) => Array.from({ length: f.length / 3 }, (_, i) => [f[i * 3], f[i * 3 + 1], f[i * 3 + 2]]);
  for (const [vao, cards, of] of [[r.vaoCards, MEADOW_CARDS, MEADOW_CARDS], [r.vaoCardsFar, MEADOW_CARDS_FAR, MEADOW_CARDS]]) {
    const v = vaos.get(vao);
    assert.deepEqual(v.corners, rows(meadowCardCorners(cards, of)), `the ${cards}-card array reads its corner and turn through its pointers`);
    assert.ok(v.enabled.has(0) && v.enabled.has(3), 'the corner and the turn, both enabled');
    assert.deepEqual([...v.indices], [...meadowCardIndices(cards)], 'its indices bound in the array');
  }
  for (const [vao, segs] of [[r.vao, 5], [r.vaoFar, GRASS_FAR_SEGMENTS]]) {
    const v = vaos.get(vao);
    assert.deepEqual(v.corners.flat(), [...labBladeCorners(segs)], 'a blade array: the lab\'s corners, two floats a vertex');
    assert.ok(!v.enabled.has(3) && v.indices === null, '...no turn, no indices');
  }
  assert.deepEqual([r.vertsCards, r.countCards, r.vertsCardsFar, r.countCardsFar, r.vertsFar, r.verts], [12, 18, 8, 12, 6, 30], 'a near tuft shades twelve corners for eighteen indices, a far one eight for twelve');
  r.allocSlots(49, 4);
  r.pxVariants = 7;   // the pixel sheet's count, made unlike the atlas's so the meadow's own is seen
  const WIND2 = { dir: [0.6, 0.8], speed: 3, windV: [3, 4] };
  const draw = (style, light = LIGHT, wind = WIND2) => {
    calls.length = 0;
    r.draw(new Float32Array(16), new Float32Array(16), new Float32Array(3), 0, light, wind, 300, style);
    const u = {}; for (const c of calls) if (c[0] === 'uniform1f' || c[0] === 'uniform1i' || c[0] === 'uniform3fv') u[c[1]] = c[2];
    const wv = calls.find((c) => c[0] === 'uniform2f' && c[1] === 'uWindV');
    const a4 = calls.findIndex((c) => c[0] === 'activeTexture' && c[1] === C.TEXTURE4);
    return { u, wind: wv.slice(2), sheet: a4 >= 0 ? calls[a4 + 1][2] : null, blend: calls.some((c) => c[0] === 'enable' && c[1] === C.BLEND), func: calls.some((c) => c[0] === 'blendFunc') };
  };
  const m = draw('meadow');
  assert.deepEqual([m.u.uPixel, m.u.uArt, m.u.uPxVariants, m.u.uPxSteps, m.u.uPxSheet], [1, 1, MEADOW_SLOTS, PX_RAMP_STEPS, 4]);
  assert.equal(m.sheet, r.meadowSheet, 'the meadow wears the owner\'s atlas on the sheet\'s unit');
  assert.deepEqual([...m.u.uArtGround], [...new Float32Array(meadowArtGround(GRASS_TONES_CLASSIC[1]))], 'the classic lane: the art\'s ground at the classic middle tone');
  const lane = draw('meadow', { ...LIGHT, lane: { decode3: elDecode3, decodeN: elDecodeN } });
  assert.deepEqual([...lane.u.uArtGround], [...new Float32Array(meadowArtGround(GRASS_TONES[1]))], '...and under the lane, the lane\'s');
  assert.equal(draw('junk').u.uArt, 1, 'a word that is no tier is the row\'s default, the meadow');
  const px = draw('pixel');
  assert.deepEqual([px.u.uPixel, px.u.uArt, px.u.uPxVariants, px.u.uPxSteps], [1, 0, 7, PX_RAMP_STEPS]);
  assert.equal(px.sheet, r.pxSheet, 'the pixel style keeps its own sheet');
  const sm = draw('smooth');
  assert.deepEqual([sm.u.uPixel, sm.u.uArt, sm.sheet], [0, 0, null], 'the lab\'s blade: no art, and unit 4 untouched');
  // blending: the smooth blade's soft alpha only - a sprite style's every kept fragment is opaque
  assert.deepEqual([m.blend, px.blend, sm.blend, m.func && px.func && sm.func], [false, false, true, true]);
  // the trees' switch: the wind the frame hands, or none - in every style
  for (const style of ['meadow', 'pixel', 'smooth']) {
    assert.deepEqual(draw(style).wind, [3, 4], `${style}: a host that hands no switch sways`);
    assert.deepEqual(draw(style, LIGHT, { ...WIND2, sway: true }).wind, [3, 4]);
    assert.deepEqual(draw(style, LIGHT, { ...WIND2, sway: false }).wind, [0, 0], `${style}: held still with the trees`);
  }
  // a palette study moves the art's ground with its middle tone
  const tones = [[0.5, 0.6, 0.4], [0.9, 1.1, 0.8], [1.2, 1.3, 1], [1.4, 1.5, 1.2]];
  r.setTones(tones); r.setTones(GRASS_TONES_CLASSIC.map((t) => t.map((v) => v * 1.1)), true);
  assert.deepEqual([...r.tones], [...new Float32Array(tones.flat())]);
  assert.deepEqual([...r.artGround], [...new Float32Array(meadowArtGround(tones[1]))]);
  assert.deepEqual([...r.artGroundClassic], [...new Float32Array(meadowArtGround(GRASS_TONES_CLASSIC[1].map((v) => v * 1.1)))]);
  calls.length = 0; r.destroy();
  for (const t of [r.meadowSheet, r.pxSheet]) assert.ok(calls.some((c) => c[0] === 'deleteTexture' && c[1] === t), 'both sheets go with the renderer');
  for (const v of [r.vaoCards, r.vaoCardsFar]) assert.ok(calls.some((c) => c[0] === 'deleteVertexArray' && c[1] === v), 'and both card arrays');
  assert.equal(r._cornerBufs.length, 6);
  for (const b of r._cornerBufs) assert.ok(calls.some((c) => c[0] === 'deleteBuffer' && c[1] === b), 'and every corner and index buffer');
});

/** a cell's blades as the placer shapes them (perf2's rig): perCell roots over a 7x7 grid from (x, z), height h, root y */
function cellPlaced(cx, cz, perCell, { h = 0.7, y = 10, cell = GRASS_CELL, x = cx * cell, z = cz * cell, span = cell } = {}) {
  const inst = new Float32Array(perCell * 4), inst2 = new Float32Array(perCell * 4), rootY = new Float32Array(perCell), ground = new Float32Array(perCell * 3);
  for (let i = 0; i < perCell; i++) {
    inst[i * 4] = x + (i % 7) / 7 * span; inst[i * 4 + 1] = z + Math.floor(i / 7) % 7 / 7 * span; inst[i * 4 + 2] = h; inst[i * 4 + 3] = i / perCell;
    rootY[i] = y;
  }
  return { inst, inst2, rootY, ground, count: perCell, perCell };
}
/** the height the vertex stage decodes off a placed one (packHeightSlope's six bits) */
const decoded = (h) => heightFloor() + unpackHeightSlope(packHeightSlope((h - heightFloor()) / heightSpan(), 0, 0, 0)).hn * heightSpan();

test('MEADOW1: a cell in the meadow is one indexed draw of a third of its blades on the cards - three near, two past the handover band - each array bound once; AUDIT MEADOW1: the culling box is the blades\' own for every style, widened for the frustum alone and in the meadow alone by its cards\' reach in the frame\'s wind (mutants: no far cards, every blade a tuft, the box widened for every style, the wind left out of it, the band ignored)', () => {
  const { gl, calls } = stubGl();
  const r = new LabGrassRenderer(gl);
  const perCell = 49;
  r.allocSlots(perCell, 8);
  r.writeSlot(0, cellPlaced(0, 1, perCell));   // 30..60 m ahead: inside a quarter of 300
  r.writeSlot(1, cellPlaced(0, 0, perCell, { z: 80 }));   // 80 m: in the handover band - still the near array, its tufts handing over one by one
  r.writeSlot(2, cellPlaced(0, 4, perCell));   // 120..150 m: past the band
  const eye = [0, 12, 0];
  const proj = mirrorProjectionX(perspective(Math.PI / 3, 16 / 9, 0.2, 6000));
  const view = lookAt(eye, [0, 12, 1], [0, 1, 0]);
  calls.length = 0;
  r.draw(proj, view, new Float32Array(eye), 0, LIGHT, WIND, 300, 'meadow');
  const m = Math.ceil(perCell / MEADOW_BLADES_PER_TUFT);
  assert.equal(MEADOW_BLADES_PER_TUFT, 3);
  assert.deepEqual([r.drawn.slots, r.drawn.cardSlots, r.drawn.cardsFarSlots, r.drawn.farSlots], [3, 3, 1, 0], 'three cells on the cards, the one past the band on two');
  assert.equal(r.drawn.blades, 3 * m, 'a sprite for every three of the lab\'s blades');
  assert.equal(r.drawn.kept, 3 * perCell, 'the cells still hold every blade');
  assert.equal(r.drawn.verts, 2 * m * r.vertsCards + m * r.vertsCardsFar, 'the corners shaded: twelve a tuft near, eight far');
  assert.deepEqual(calls.filter((c) => c[0] === 'drawElementsInstanced').map((c) => c.slice(1)), [[23, 18, 25, 0, m], [23, 18, 25, 0, m], [23, 12, 25, 0, m]], 'indexed, eighteen indices a near tuft and twelve far');
  assert.equal(calls.filter((c) => c[0] === 'drawArraysInstanced').length, 0);
  assert.deepEqual(calls.filter((c) => c[0] === 'uniform1f' && c[1] === 'uSlotN').map((c) => c[2]), [m, m, m], 'the fade\'s fraction is over the cell\'s sprites');
  const binds = calls.filter((c) => c[0] === 'bindVertexArray').map((c) => c[1]).filter((v) => v !== null && v !== r.vao);   // the draw and the loop both start on the near blade's (GRASS2)
  assert.deepEqual(binds, [r.vaoCards, r.vaoCardsFar], 'near, near, far: each card array bound once');
  // the pixel style draws the same cells one quad a tuft, as it did
  r.draw(proj, view, new Float32Array(eye), 0, LIGHT, WIND, 300, 'pixel');
  assert.deepEqual([r.drawn.cardSlots, r.drawn.farSlots, r.drawn.blades], [0, 3, 3 * Math.ceil(perCell / 2)]);
  // THE BOX: the blades' own, all six; the cards' reach and top kept beside it, on the height the stage decodes
  const hLaw = heightFloor() + heightSpan();
  for (const h of [0.5, 50]) {   // 50: a blade the height lane cannot hold - the stage decodes the law's tallest
    r.writeSlot(3, cellPlaced(2, 2, perCell, { h, y: 10 }));
    const x1 = Math.fround(60 + 6 / 7 * 30);   // the rig's roots are float32, as the placer's are
    assert.deepEqual(r.slotBox[3], [60, 10, 60, x1, 10 + h, x1], `h ${h}: the box is the blades' own - roots across, lowest root to tallest tip`);
    const hd = h > hLaw ? hLaw : decoded(h);
    assert.ok(Math.abs(r.slotCardH[3] - hd) < 1e-12, `h ${h}: the tallest card stands on the decoded ${hd}`);
    assert.ok(Math.abs(r.slotCardRise[3] - Math.max(0, hd * MEADOW_TOP - h)) < 1e-12, `h ${h}: its top over the box's`);
    assert.equal(r.slotCardTilt[3], 0, 'level ground');
    assert.deepEqual([...r.slotFrame.subarray(12, 16)], [60, 60, 10, h], `h ${h}: the decode frame is the blades' own bounds`);
  }
  // a cell on a slope: its steepest decoded normal is kept, and a card sheared to it stands that much under its root or over its top
  const sloped = cellPlaced(2, 2, perCell, { h: 0.7, y: 10 });
  sloped.slope = new Float32Array(perCell * 2);
  for (let i = 0; i < perCell; i++) { sloped.slope[i * 2] = i === 5 ? 0.45 : 0.1; sloped.slope[i * 2 + 1] = i === 5 ? -0.35 : 0; }   // the steepest is a tuft's (blade 5 of the first third)
  r.writeSlot(3, sloped);
  const w5 = packHeightSlope((0.7 - heightFloor()) / heightSpan(), 0.45, -0.35, 5), g5 = unpackHeightSlope(w5);
  const tilt5 = Math.hypot(g5.nx, g5.nz) / Math.max(Math.sqrt(1 - g5.nx * g5.nx - g5.nz * g5.nz), MEADOW_SLOPE_FLOOR);
  assert.ok(Math.abs(r.slotCardTilt[3] - tilt5) < 1e-12 && tilt5 > 0.5, `the steepest tuft's slope (${r.slotCardTilt[3]})`);
  r.draw(proj, view, new Float32Array(eye), 0, LIGHT, WIND, 300, 'meadow');
  const reach3 = r.slotCardH[3] * MEADOW_REACH, box3 = r.slotBox[3];
  assert.ok(Math.abs(r._cardBox[1] - (box3[1] - reach3 * tilt5)) < 1e-9 && Math.abs(r._cardBox[4] - (box3[4] + r.slotCardRise[3] + reach3 * tilt5)) < 1e-9, 'the widened box stands the slope\'s share of the reach under and over');
  r.clearSlot(3);
  assert.ok(Math.abs(MEADOW_TOP - 2.25 * 1.25 * 52 / 64) < 1e-12 && MEADOW_TOP === Math.max(...MEADOW_VARIANTS.map((v, i) => v.scale * MEADOW_PATCH_SCALE[1] * MEADOW_BOXES[i].v1)), 'the bush\'s top, the tallest');
  // the frustum asks of the cards: a cell whose roots stand just behind the near plane is drawn in the meadow alone,
  // and one further back only while the wind leans its cards in
  const near = (z1, wind, style) => {
    r.clearSlot(0); r.clearSlot(1); r.clearSlot(2); r.clearSlot(3);
    r.writeSlot(4, cellPlaced(0, 0, perCell, { x: -1.5, z: z1 - 2, span: 2 * 7 / 6, y: 10.2 }));
    const low = [0, 10.6, 0], lv = lookAt(low, [0, 10.6, 1], [0, 1, 0]);
    r.draw(proj, lv, new Float32Array(low), 0, LIGHT, wind, 300, style);
    return r.drawn.slots;
  };
  const sunny = { dir: [0, 1], speed: 70, windV: [0, 70 * LAB_WIND_RATE] };
  assert.deepEqual([near(-0.3, WIND, 'pixel'), near(-0.3, WIND, 'meadow')], [0, 1], 'roots behind the near plane: the pixel style\'s quads are not in view, the meadow\'s cards are');
  const back = -(decoded(0.7) * MEADOW_REACH) - 0.3;   // past the reach standing still, inside it in a clear day's wind
  assert.deepEqual([near(back, WIND, 'meadow'), near(back, sunny, 'meadow'), near(back, { ...sunny, sway: false }, 'meadow')], [0, 1, 0], 'the wind\'s reach is the frame\'s - and none while the trees stand still');
  const cb = r._cardBox, box = r.slotBox[4], reach = r.slotCardH[4] * MEADOW_REACH;
  assert.deepEqual([...cb].map((v) => +v.toFixed(9)), [box[0] - reach, box[1], box[2] - reach, box[3] + reach, box[4] + r.slotCardRise[4], box[5] + reach].map((v) => +v.toFixed(9)), 'the widened box: the reach across, the tallest card\'s top over the blades\'');
  assert.ok(Math.abs(MEADOW_WIND_REACH - 2.25 * 1.25 * 0.055 * 1.3 * 0.6 * (52 / 64) ** 2) < 1e-12, 'a metre a second of wind: the bush\'s reach, the farthest');
});

test('AUDIT MEADOW1: the meadow\'s box holds every card the stage draws - every sprite, card and corner at the lush patch\'s size, the steepest standing lean, a full gust at the wind slider\'s top, and a slope - and only just (mutants: the wind\'s reach or the standing reach shrunk, the slope left out)', () => {
  const vs = vertexStage();
  const hTop = heightFloor() + heightSpan();
  const wMax = WIND_SLIDER_MAX * LAB_WIND_RATE;
  assert.equal(wMax, 32);
  const tFull = (Math.PI / 2 + 15 * 0.35) / 1.7;   // the gust at its crest for the tuft at (15, 15) under a wind along x
  const BYTES = [0, 0.03, 0.17, 0.2, 0.99];   // in a lush patch: the bush, the flowers, the dry tuft, the short and the tall
  assert.deepEqual(BYTES.map((r) => meadowPick(r, 1).variant), [MEADOW_BUSH, MEADOW_FLOWERS, MEADOW_DRY, MEADOW_SHORT, MEADOW_TALL]);
  let farthest = 0;
  for (const [nx, nz] of [[0, 0], [0.45, -0.35]]) {
    const word = packHeightSlope(1, nx, nz, 0), g = unpackHeightSlope(word);
    const tilt = Math.hypot(g.nx, g.nz) / Math.max(Math.sqrt(Math.max(1 - g.nx ** 2 - g.nz ** 2, 0)), MEADOW_SLOPE_FLOOR);
    for (const wind of [0, wMax]) {
      const reach = hTop * (MEADOW_REACH + MEADOW_WIND_REACH * wind), t = reach * tilt;
      for (const r of BYTES) {
        for (const [lx, lz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
          for (const card of [0, Math.fround(1 + 1 / 3), Math.fround(2 / 3)]) {
            for (const [cx, cy] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
              const p = vs.run({ aPA: [0.5, 0.5, 0, word / 65535], aPB: [lx, lz, 1, r], aCorner: [cx, cy], aCard: card, uWindV: [wind, 0], uTime: tFull, uEye: [0, 1, 0] }).gl_Position;
              const dx = p[0] - 15, dz = p[2] - 15;
              assert.ok(Math.abs(dx) <= reach + 1e-9 && Math.abs(dz) <= reach + 1e-9, `sprite ${r} lean ${lx},${lz} wind ${wind} card ${card} corner ${cx},${cy}: ${dx.toFixed(3)}, ${dz.toFixed(3)} inside ${reach.toFixed(3)}`);
              assert.ok(p[1] >= -t - 1e-9 && p[1] <= hTop * MEADOW_TOP + t + 1e-9, `...and ${p[1].toFixed(3)} between ${(-t).toFixed(3)} and ${(hTop * MEADOW_TOP + t).toFixed(3)}`);
              farthest = Math.max(farthest, Math.max(Math.abs(dx), Math.abs(dz)) / reach);
            }
          }
        }
      }
    }
  }
  assert.ok(farthest > 0.85, `the bound is near the cards, not a guess past them (${farthest.toFixed(3)} of it reached)`);
});

test('AUDIT MEADOW1: the gust wave stands still under a crossing of the floating origin - the world host carries the shift\'s phase into the one clock the grass and the trees are handed (mutants: the phase not carried, carried the wrong way, the trees on the frame\'s seconds)', () => {
  assert.deepEqual([GUST_RATE, GUST_K], [1.7, 0.35]);
  assert.ok(GAME_GRASS_VS.includes('float gust = sin(uTime*1.7 - along*0.35 + aInst.w*0.6) * 0.5 + 0.5;'), 'the grass\'s wave');
  const bb = read('src/render/renderer.js');
  assert.equal((bb.match(/float gust = sin\(uFlatWind\.z \* 1\.7 - along \* 0\.35 \+ ph\) \* 0\.5 \+ 0\.5;/g) || []).length, 2, 'the flats\' and the low-poly trees\': the one wave');
  assert.ok(Math.abs(gustPhaseAfterShift(0, [10, 0, 0], [3, 0]) - 3.5) < 1e-12, 'a shift down the wind moves the wave by its own length\'s share');
  assert.ok(Math.abs(gustPhaseAfterShift(0, [10, 7, 0], [0, 0]) - 3.5) < 1e-12, 'a still wind runs along x, the stages\' own rule, and a rise is no place on the wave');
  const p = gustPhaseAfterShift(1, [819.2, 0, -1638.4], [6, 8]);
  assert.ok(p >= 0 && p < 2 * Math.PI && Math.abs(Math.sin(p) - Math.sin(1 + 0.35 * (819.2 * 0.6 - 1638.4 * 0.8))) < 1e-9, 'kept in a turn, the same phase');
  assert.equal(gustClock(10, 1.7), 11);
  // the stage: a card's lean the frame before a crossing and the frame after it, the clock carried, is one pose
  const vs = vertexStage();
  const windV = [6, 8], offset = [819.2, 0, -1638.4];
  const lean = (frame, t) => { const g = vs.run({ aPA: [0.5, 0.5, 0, LEVEL], aPB: [0.5, 0.5, 0.5, 0.99], aCorner: [0.5, 1], aCard: 0, uWindV: windV, uTime: t, uCellFrame: [frame[0], frame[1], 0, 1], uEye: [frame[0], 1, frame[1]] }); return [g.gl_Position[0] - frame[0], g.gl_Position[2] - frame[1]]; };
  let jumped = 0;
  for (const t of [3, 17.25, 400.5, 1234.5]) {
    const before = lean([0, 0], gustClock(t, 0));
    const after = lean([offset[0], offset[2]], gustClock(t, gustPhaseAfterShift(0, offset, windV)));
    assert.ok(Math.abs(before[0] - after[0]) < 1e-6 && Math.abs(before[1] - after[1]) < 1e-6, `at ${t} s: one pose across the crossing`);
    const naive = lean([offset[0], offset[2]], t);
    jumped = Math.max(jumped, Math.hypot(before[0] - naive[0], before[1] - naive[1]));
  }
  assert.ok(jumped > 0.05, `the frame's own seconds would have snapped the field to another pose (${jumped.toFixed(3)} m)`);
  // the host: the crossing carries the phase, and the flats and the grass take the one clock
  const w = read('src/scenes/world.js');
  const shiftAt = w.indexOf('const r = state.update(cam.pos);'), gp = w.indexOf('gustPhase = gustPhaseAfterShift(gustPhase, r.offset, gustWind);');
  assert.ok(shiftAt > 0 && gp > shiftAt && gp < w.indexOf('const wd = windDrive(sky, now / 1000, dt);'), 'in the block that moves every scene point, before the frame\'s wind is read');
  assert.ok(w.includes('gustWind = wd.windV;') && w.includes('const windClock = gustClock(now / 1000, gustPhase);'));
  assert.ok(w.includes('[wd.windV[0], wd.windV[1], windClock, wd.gust]') && w.includes('labGrass.draw(proj, view, new Float32Array(cam.pos), windClock,'), 'the flats and the grass on the one clock');
  assert.ok(w.includes('windV: wd.windV, sway: floraSwayOn() && wd.on }'), 'and the grass held still with the trees');
});

test('MEADOW1: the meadow\'s edits land once each over the four lists before them, every one says why, and its words are the game\'s alone; AUDIT MEADOW1: the row ships the meadow as the style and the grass Off, and the wind\'s sway is the grass\'s too (mutants: the grass on by default, the style another)', () => {
  let text = applyGrassEdits(applyGrassEdits(applyGrassEdits(LAB_GRASS_VS, GRASSPX_VS_EDITS), GRASSFOG_VS_EDITS), GRASSLIT_VS_EDITS);
  for (const e of GRASSMEADOW_VS_EDITS) { assert.equal(text.split(e.from).length - 1, 1, `VS: ${e.why}`); assert.ok(e.why.length > 20); text = applyGrassEdits(text, [e]); }
  assert.equal(text, GAME_GRASS_VS);
  text = applyGrassEdits(applyGrassEdits(applyGrassEdits(LAB_GRASS_FS, GRASSPX_FS_EDITS), GRASSFOG_FS_EDITS), GRASSLIT_FS_EDITS);
  for (const e of GRASSMEADOW_FS_EDITS) { assert.equal(text.split(e.from).length - 1, 1, `FS: ${e.why}`); assert.ok(e.why.length > 20); text = applyGrassEdits(text, [e]); }
  assert.equal(text, GAME_GRASS_FS);
  for (const word of ['uArt', 'aCard', 'mDir', 'uArtGround', 'mC', 'mLean', 'mSway', 'mLod']) {
    assert.ok(!LAB_GRASS_VS.includes(word) && !LAB_GRASS_FS.includes(word), `the lab's text does not know ${word}`);
    assert.ok(GAME_GRASS_VS.includes(word) || GAME_GRASS_FS.includes(word), `the game's does: ${word}`);
  }
  // the law's numbers are written into the stage from their one home
  assert.ok(GAME_GRASS_VS.includes(`smoothstep(${MEADOW_LUSH[0]}, ${MEADOW_LUSH[1]}, aInst2.z)`) && GAME_GRASS_VS.includes(`mix(${MEADOW_SHARES.bush[0]}, ${MEADOW_SHARES.bush[1]}, mLush)`));
  assert.ok(GAME_GRASS_VS.includes('vec4(0.09375, 0.90625, 0.0, 0.75)') && GAME_GRASS_VS.includes(`hash(aPA.xy * ${MEADOW_SEED}.0)`), 'the boxes and the seed');
  // the style's word: anything but the two older words is the meadow, and the meadow is a pixel style
  assert.deepEqual(['meadow', 'pixel', 'smooth', undefined, 'junk'].map(meadowGrass), [true, false, false, true, true]);
  assert.deepEqual(['meadow', 'pixel', 'smooth'].map(pixelGrass), [true, true, false]);
  // the rows: the grass Off until asked for, the meadow its style; the wind's sway the grass's as well as the trees'
  const grass = FEATURES.find((f) => f.id === 'grass'), wind = FEATURES.find((f) => f.id === 'wind');
  assert.deepEqual([grass.control.key, grass.control.initial, grass.control.tiers.map(([v]) => v)], ['grassDensity', 1, [1, 0.5, 0.25, 0]], 'Full by default, the meadow its style (MEADOW-ON, Mac: "Meadow grass should be on by default" - AUDIT MEADOW1 had it Off)');
  assert.deepEqual({ ...grass.control.also[0] }, { store: 'prefs', key: 'grassStyle', initial: 'meadow', online: 'player' });
  assert.deepEqual(grass.control.parts[0].tiers.map(([v]) => v), ['meadow', 'pixel', 'smooth']);
  assert.deepEqual(wind.control.parts.map((p) => [p.key, p.label]), [['floraSway', 'Sway'], ['windWisps', 'Wisps']]);
  // the probe photographs it, on both lanes, beside the pixel style, in a clear day's wind and edge-on - and counts its fragments
  const probe = read('tools/meadowProbe.mjs');
  for (const s of ["shot('eye', ", "shot('eye-pixel', ", "shot('close', ", "shot('high', ", "shot('dusk', ", "shot('horizon', ", "shot('lane', ", "shot('lane-pixel', ", "shot('wind', ", "shot('grazing', "]) assert.ok(probe.includes(s), `the probe's ${s}`);
  assert.ok(probe.includes('const COUNT_FS = '), 'the fragment count');
});
