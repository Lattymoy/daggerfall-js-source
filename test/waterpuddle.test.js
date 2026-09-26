// WATER-PUDDLE (2026-09-25) - THE PUDDLE IS THE ART'S, PINNED: DFU's shallow-water records (the docks,
// moats and puddles) and record 9 draw water only where their own art paints it - the colour rule against
// the water tile's colours, cleaned into shapes, carried in the layer's alpha - where the enhanced pass
// drew a whole 6.4 m square over the art; the feet keep DFU's whole tile.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { PUDDLE_RECORDS, WATER_COLOUR_TOLERANCE, MIN_PATCH_TEXELS, waterColours, markPuddleWater, cleanMask, turnFraction, puddleWetAt } from '../src/world/puddleMask.js';
import { SHALLOW_WHOLE, SHALLOW_DRAWN, WATER_MASK_TABLE, waterCorners } from '../src/world/waterCorners.js';
import { waterSurfaceFs } from '../src/render/waterSurface.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
/** A 64 x 64 color32 layer painted by `paint(x, y) -> [r, g, b]`. */
function layer(paint) {
  const colors = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const [r, g, b] = paint(x, y), i = (y * 64 + x) * 4;
    colors[i] = r; colors[i + 1] = g; colors[i + 2] = b; colors[i + 3] = 255;
  }
  return { width: 64, height: 64, colors };
}
const BLUE = [40, 80, 160], BROWN = [150, 110, 60];
const alphaAt = (l, x, y) => l.colors[(y * 64 + x) * 4 + 3];

test('WATER-PUDDLE: the records the pass drew whole - record 9 and DFU\'s shallow-water tiles - and WATER5\'s colour tolerance (mutants: the list, the tolerance)', () => {
  assert.deepEqual(PUDDLE_RECORDS, [8, 9, 23, 33, 34, 35, 36]);
  assert.deepEqual([...PUDDLE_RECORDS].sort((a, b) => a - b), [...new Set([...SHALLOW_DRAWN, ...SHALLOW_WHOLE])].sort((a, b) => a - b));
  assert.equal(WATER_COLOUR_TOLERANCE, 24);
  assert.equal(MIN_PATCH_TEXELS, 32);
});

test('WATER-PUDDLE: a puddle record\'s alpha is its art\'s water - within 24 of a water-tile colour - its specks dropped and its flecks filled; every other layer handed back as it came, the puddle\'s copied (mutants: the rule, the clean, the copy)', () => {
  const water = layer(() => BLUE);
  // record 8: a pool on the left half, a 2 x 2 blue speck out in the brown, a 3 x 3 brown fleck inside the pool,
  // and a texel 24 away from the water's blue (water) beside one 25 away (dry)
  const puddle = layer((x, y) => {
    if (x >= 40 && x < 42 && y >= 10 && y < 12) return BLUE;
    if (x >= 10 && x < 13 && y >= 30 && y < 33) return BROWN;
    return x < 32 ? BLUE : BROWN;
  });
  const grass = layer(() => [30, 120, 40]);
  const layers = [water, grass, grass, grass, grass, grass, grass, grass, puddle, grass];
  assert.deepEqual(waterColours(water), [BLUE]);
  const out = markPuddleWater(layers);
  assert.notEqual(out, layers, 'a new list');
  assert.equal(out[1], grass, 'a non-puddle record untouched');
  assert.notEqual(out[8], puddle, 'the puddle copied');
  assert.equal(alphaAt(puddle, 50, 50), 255, 'and the original kept as it was');
  assert.equal(alphaAt(out[8], 5, 5), 255, 'the pool is water');
  assert.equal(alphaAt(out[8], 50, 50), 0, 'the ground is not');
  assert.equal(alphaAt(out[8], 40, 10), 0, 'a speck under 32 texels is the ground\'s grain');
  assert.equal(alphaAt(out[8], 11, 31), 255, 'a fleck inside the pool is the pool\'s');
  assert.equal(alphaAt(out[9], 5, 5), 0, 'record 9 in grass: no water at all');
  // the tolerance, texel-exact
  const edge = layer((x) => (x < 32 ? [BLUE[0] + 24, BLUE[1], BLUE[2]] : [BLUE[0] + 25, BLUE[1], BLUE[2]]));
  const tol = markPuddleWater([water, grass, grass, grass, grass, grass, grass, grass, edge]);
  assert.equal(alphaAt(tol[8], 5, 5), 255, '24 away: water');
  assert.equal(alphaAt(tol[8], 50, 5), 0, '25 away: dry');
  assert.equal(markPuddleWater([]).length, 0, 'no archive, nothing');
});

test('WATER-PUDDLE: cleanMask - a small wet patch dries wherever it lies, a small dry hole fills, a dry patch at the tile\'s edge stays whatever its size (the neighbour\'s ground) (mutants: the area, the edge)', () => {
  const w = 8, h = 8, wet = new Uint8Array(w * h);
  wet[0] = 1;                                          // one wet texel at the corner: grain, dried
  wet[3 * w + 3] = 1;                                  // one wet texel inside: dried
  const out = cleanMask(wet, w, h, 2);
  assert.equal(out[0], 0); assert.equal(out[3 * w + 3], 0);
  const pool = new Uint8Array(w * h).fill(1);
  pool[4 * w + 4] = 0;                                 // a dry fleck inside: filled
  pool[w - 1] = 0;                                     // a dry texel at the edge: kept
  cleanMask(pool, w, h, 2);
  assert.equal(pool[4 * w + 4], 1); assert.equal(pool[w - 1], 0);
});

test('WATER-PUDDLE: the pass keeps a puddle record\'s fragment by its layer\'s alpha, read through the tile\'s turn at the record\'s own texel; the hosts write the alpha before the upload; the feet keep DFU\'s whole tile (pins)', () => {
  const fs = waterSurfaceFs('', '');
  assert.match(fs, /bool isPuddleRecord\(uint r\) \{ return r == 8u \|\| r == 9u \|\| r == 23u \|\| r == 33u \|\| r == 34u \|\| r == 35u \|\| r == 36u; \}/);
  assert.match(fs, /vec2 puv = PUDDLE_ROT\[turn\] \* f \+ PUDDLE_TRANS\[turn\];\n\s+edge \*= smoothstep\(0\.3, 0\.7, textureGrad\(uTileArr, vec3\(puv, float\(rec\)\), PUDDLE_ROT\[turn\] \* wgx, PUDDLE_ROT\[turn\] \* wgy\)\.a\);\n\s+\}\n\s+if \(edge <= 0\.002\) discard;/);
  assert.match(fs, /const mat2 PUDDLE_ROT\[4\] = mat2\[4\]\(mat2\(1\.0, 0\.0, 0\.0, 1\.0\), mat2\(0\.0, -1\.0, 1\.0, 0\.0\), mat2\(-1\.0, 0\.0, 0\.0, -1\.0\), mat2\(0\.0, 1\.0, -1\.0, 0\.0\)\);/, 'TERRAIN_FS\'s turns');
  assert.match(rd('src/render/renderer.js'), /const mat2 ROT\[4\] = mat2\[4\]\(\n\s+mat2\(1\.0, 0\.0, 0\.0, 1\.0\),\n\s+mat2\(0\.0, -1\.0, 1\.0, 0\.0\),\n\s+mat2\(-1\.0, 0\.0, 0\.0, -1\.0\),\n\s+mat2\(0\.0, 1\.0, -1\.0, 0\.0\)\);/, 'and TERRAIN_FS still turns so');
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(rd(f), /renderer\.uploadTileArray\(groundArchive, markPuddleWater\(layers\)\);/, `${f}: the alpha written before the upload`);
  }
  for (const r of SHALLOW_WHOLE) assert.equal(waterCorners(r << 2, WATER_MASK_TABLE), 15, `record ${r}: the feet still wade the whole tile`);
});

test('WATER-PUDDLE: the CPU\'s turn is the pass\'s, texel for texel, and the grass placer asks it - a blade stands on a puddle tile\'s dry ground, not in its pool (mutants: the turns, the texel, the placer)', () => {
  // the shader's own matrices, read out of the program and applied as GLSL does (column-major)
  const fs = waterSurfaceFs('', '');
  const nums = (re) => fs.match(re)[1].match(/-?\d+\.\d+/g).map(Number);
  const rot = nums(/const mat2 PUDDLE_ROT\[4\] = mat2\[4\]\((.*)\);/), trans = nums(/const vec2 PUDDLE_TRANS\[4\] = vec2\[4\]\((.*)\);/);
  for (let turn = 0; turn < 4; turn++) {
    const [a, b, c, d] = rot.slice(turn * 4, turn * 4 + 4), [tx, ty] = trans.slice(turn * 2, turn * 2 + 2);
    for (const [fx, fz] of [[0.1, 0.2], [0.7, 0.3], [0.45, 0.9]]) {
      const [u, v] = turnFraction(turn, fx, fz);
      assert.ok(Math.abs(u - (a * fx + c * fz + tx)) < 1e-9 && Math.abs(v - (b * fx + d * fz + ty)) < 1e-9, `turn ${turn} at ${fx},${fz}`);
    }
  }
  // a record whose art is water on its left half (x < 32) and in its bottom row band (y < 8): the texel under the point, turned
  const colors = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) colors[(y * 64 + x) * 4 + 3] = x < 32 || y < 8 ? 255 : 0;
  const pool = { width: 64, height: 64, colors };
  assert.equal(puddleWetAt(pool, 23 << 2, 0.1, 0.5), true, 'unturned: the left half is the pool');
  assert.equal(puddleWetAt(pool, 23 << 2, 0.9, 0.5), false, 'and the right half is ground');
  assert.equal(puddleWetAt(pool, (23 << 2) | 2, 0.9, 0.5), true, 'turned half round, the pool is on the right');
  assert.equal(puddleWetAt(pool, (23 << 2) | 1, 0.97, 0.9), true, 'a quarter turn: v = 1 - fx = 0.03, the bottom band');
  assert.equal(puddleWetAt(pool, (23 << 2) | 1, 0.5, 0.9), false, 'a quarter turn: u = fz = 0.9, v = 0.5 - ground');
  assert.equal(puddleWetAt(pool, 23 << 2, 1, 0.5), false, 'the far edge clamps onto the last texel of its own row, not the next row\'s first');
  // the placer: the corner table first (the rare water tile), then the puddle's own mask, from the layers the pass uploads
  const world = rd('src/scenes/world.js');
  assert.match(world, /groundPuddles\.set\(groundArchive, markPuddleWater\(layers\)\);/);
  assert.match(world, /if \(waterCorners\(byte, WATER_DRAW_MASK_TABLE\)\) \{\n\s+const puddle = PUDDLE_RECORDS\.includes\(rec\) \? groundPuddles\.get\(p\.groundArchive\)\?\.\[rec\] : null;\n\s+if \(!puddle \|\| puddleWetAt\(puddle, byte, lx \/ 6\.4 - tx, lz \/ 6\.4 - tz\)\) return null;\n\s+\}/);
});

const ARENA2 = process.env.ARENA2_PATH;
test('WATER-PUDDLE: on the player\'s own art - the desert\'s puddle is a pool, not the tile; the desert\'s and the woods\' record 9 is dry ground (needs ARENA2)', { skip: !ARENA2 || !existsSync(`${ARENA2}/TEXTURE.002`) }, async () => {
  const { TextureFile } = await import('../src/formats/textureFile.js');
  const { DFPalette } = await import('../src/formats/dfPalette.js');
  const pal = new DFPalette(); pal.load(new Uint8Array(readFileSync(`${ARENA2}/ART_PAL.COL`)));
  const cover = (arch, rec) => {
    const name = `TEXTURE.${String(arch).padStart(3, '0')}`;
    const t = new TextureFile(); t.load(new Uint8Array(readFileSync(`${ARENA2}/${name}`)), name, pal);
    const layers = []; for (let r = 0; r < t.recordCount; r++) layers.push(t.getColor32(t.getDFBitmap(r, 0), 0));
    const l = markPuddleWater(layers)[rec]; let n = 0;
    for (let i = 3; i < l.colors.length; i += 4) if (l.colors[i] === 255) n++;
    return n / 4096;
  };
  const d8 = cover(2, 8);
  assert.ok(d8 > 0.1 && d8 < 0.4, `the desert puddle is a pool (${d8})`);
  assert.equal(cover(2, 9), 0, 'the desert\'s record 9 is sand');
  assert.equal(cover(302, 9), 0, 'the woods\' record 9 is grass');
});
