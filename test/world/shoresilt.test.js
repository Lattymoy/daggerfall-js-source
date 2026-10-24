// SHORE-SILT (2026-10-12) - A SHORE'S PAINTED WATER GOES UNDER THE SILT, PINNED. The bed's silt covered a shore tile's
// water only where the corner table's bilinear coverage lies; the art paints its water past that line, so a pond's or
// a river's bank was freckled with flat blue paint the bed and the sheet never reached. Each shore record's own water
// now rides its layer's alpha (the colours record 0 paints that no dry record paints), carried onto a mod's tile set,
// and the silt takes it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { SHORE_RECORDS, DRY_RECORDS, PUDDLE_RECORDS, shoreWaterColours, markShoreWater, markPuddleWater, carryPuddleMask, palettedSet } from '../../src/world/puddleMask.js';
import { WATER_DRAW_MASK_TABLE } from '../../src/world/water/waterCorners.js';
import { WATER_BED_GLSL, waterBedMix, WET_MUD, WET_MUD_SHARE } from '../../src/render/waterBedGlsl.js';

const ARENA2 = process.env.ARENA2_PATH;
function layer(paint) {
  const colors = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const [r, g, b] = paint(x, y), i = (y * 64 + x) * 4;
    colors[i] = r; colors[i + 1] = g; colors[i + 2] = b; colors[i + 3] = 255;
  }
  return { width: 64, height: 64, colors };
}
const alphaAt = (l, x, y) => l.colors[(y * 64 + x) * 4 + 3];
const BLUE = [40, 80, 160], SHARED = [60, 90, 150], GRASS = [30, 120, 40];

test('SHORE-SILT: the shore records are the draw\'s part-water tiles, never a puddle; the dry records have no water at any turn (mutants: the lists)', () => {
  assert.deepEqual(SHORE_RECORDS, [4, 5, 6, 7, 19, 20, 21, 22, 29, 30, 31, 32, 37, 38, 40, 41, 43, 44, 48, 49, 50]);
  for (const r of SHORE_RECORDS) assert.ok(!PUDDLE_RECORDS.includes(r) && [0, 1, 2, 3].some((t) => WATER_DRAW_MASK_TABLE[(r << 2) | t]), `${r}`);
  for (const r of DRY_RECORDS) assert.ok([0, 1, 2, 3].every((t) => !WATER_DRAW_MASK_TABLE[(r << 2) | t]), `${r}`);
  assert.ok(!DRY_RECORDS.includes(0) && DRY_RECORDS.includes(1) && DRY_RECORDS.includes(2) && DRY_RECORDS.includes(3));
});

test('SHORE-SILT: a shore\'s water is the colours the wet tiles paint and the dry ones twenty times less - a blue the ground shares is ground; specks dropped; the shore copied, the rest handed back (mutants: the rule, the ratio, the clean, the copy)', () => {
  const water = layer((x) => (x % 2 ? BLUE : SHARED));
  const dry = layer((x) => (x < 8 ? SHARED : GRASS));
  // record 21: its right half painted water, a 2 x 2 speck of it out in the grass, the shared blue on its left edge
  const shore = layer((x, y) => {
    if (x >= 10 && x < 12 && y >= 10 && y < 12) return BLUE;
    if (x < 4) return SHARED;
    return x >= 32 ? BLUE : GRASS;
  });
  const layers = []; for (let r = 0; r < 56; r++) layers.push(r === 0 ? water : r === 21 ? shore : dry);
  assert.deepEqual([...shoreWaterColours(layers)], [(BLUE[0] << 16) | (BLUE[1] << 8) | BLUE[2]]);
  const out = markShoreWater(layers);
  assert.notEqual(out[21], shore, 'the shore copied');
  assert.equal(out[1], dry, 'a dry record untouched');
  assert.equal(alphaAt(shore, 20, 5), 255, 'the original kept - its grass still opaque');
  assert.equal(alphaAt(out[21], 50, 5), 255, 'the painted water is water');
  assert.equal(alphaAt(out[21], 20, 5), 0, 'the grass is not');
  assert.equal(alphaAt(out[21], 1, 5), 0, 'a blue the dry ground paints too is ground');
  assert.equal(alphaAt(out[21], 10, 10), 0, 'a speck is the ground\'s grain');
  const up = markPuddleWater(layers)[21];
  assert.deepEqual([alphaAt(up, 50, 5), alphaAt(up, 20, 5)], [255, 0], 'the upload\'s one marking takes the shores too');
});

test('SHORE-SILT: a truecolour mod\'s tile set takes each shore\'s shape from the classic mask, as its puddles\' (mutants: the records)', () => {
  const l = (w, a) => ({ width: w, height: w, colors: new Uint8ClampedArray(w * w * 4).fill(a) });
  const classic = [], mod = [];
  for (let r = 0; r < 56; r++) { classic.push(l(2, 255)); mod.push(l(4, 255)); }
  const tc = new Uint8ClampedArray(32 * 32 * 4);   // a water tile of 1,024 colours: truecolour
  for (let i = 0; i < 1024; i++) { tc[i * 4] = i & 255; tc[i * 4 + 1] = i >> 8; tc[i * 4 + 2] = 200; tc[i * 4 + 3] = 255; }
  mod[0] = { width: 32, height: 32, colors: tc };
  const rec = SHORE_RECORDS[5], cb = classic[rec].colors;
  cb[3] = 255; cb[7] = 0; cb[11] = 0; cb[15] = 255;
  const out = carryPuddleMask(mod, classic);
  const a = (x, y) => out[rec].colors[(y * 4 + x) * 4 + 3];
  assert.deepEqual([a(0, 0), a(3, 0), a(0, 3), a(3, 3)], [255, 0, 0, 255]);
  assert.equal(out[1], mod[1], 'a dry record is left as the mod paints it');
});

test('SHORE-SILT: a paletted mod\'s set (Vanilla Enhanced) reads its shores by its own colours - its feathered blue past the classic shape is water (mutants: the switch, the limit)', () => {
  const water = layer(() => BLUE), dry = layer(() => GRASS);
  const modShore = layer((x) => (x >= 16 ? BLUE : GRASS));   // the mod paints water over three quarters
  const classicShore = layer((x) => (x >= 48 ? BLUE : GRASS));   // the classic art a quarter
  const mod = [], classic = [];
  for (let r = 0; r < 56; r++) { mod.push(r === 0 ? water : r === 21 ? modShore : dry); classic.push(r === 0 ? water : r === 21 ? classicShore : dry); }
  const out = carryPuddleMask(mod, markPuddleWater(classic));
  assert.equal(alphaAt(out[21], 20, 5), 255, 'the mod\'s own water, past the classic shape');
  assert.equal(alphaAt(out[21], 5, 5), 0, 'its grass');
  assert.ok(palettedSet(mod) && !palettedSet([]), 'a palette');
  const many = new Uint8Array(64 * 64 * 4); for (let i = 0; i < 4096; i++) { many[i * 4] = i & 255; many[i * 4 + 1] = i >> 8; many[i * 4 + 3] = 255; }
  assert.ok(!palettedSet([{ width: 64, height: 64, colors: many }]), 'past 256 colours, truecolour');
  const at256 = new Uint8Array(64 * 64 * 4); for (let i = 0; i < 4096; i++) { at256[i * 4] = i & 255; at256[i * 4 + 3] = 255; }
  assert.ok(palettedSet([{ width: 64, height: 64, colors: at256 }]), '256 colours, a palette');
});

test('SHORE-SILT: the silt takes a shore\'s painted water past the corner table\'s line - its alpha read only on a part-water tile - on both terrain programs, its fringe past the sheet wet mud (mutants: the gate, the read, the fringe)', () => {
  assert.match(WATER_BED_GLSL, /vec2 bedCover\(uint data, vec2 f, vec3 tl, vec2 gx, vec2 gy, float snowC\)/);   // AUDIT PRECIP GROUND-5 (PIN MOVED): and the ground's snow
  // AUDIT PRECIP GROUND-5 (PIN MOVED): the art's mask walked to the winter record's by the ground's cover
  assert.match(WATER_BED_GLSL, /float art = 0\.0;\n\s+if \(m != 15u && k < 1\.0\) \{\n\s+float a = textureGrad\(uTileArr, tl, gx, gy\)\.a;\n\s+if \(snowC > 0\.0\) a = mix\(a, textureGrad\(uTileArr, vec3\(tl\.xy, tl\.z \+ float\(uSnowArr\.x\)\), gx, gy\)\.a, snowC\);\n\s+art = smoothstep\(0\.3, 0\.7, a\);\n\s+\}\n\s+return vec2\(max\(k, art\), max\(art - k, 0\.0\)\);/);
  assert.ok(WATER_BED_GLSL.indexOf('if (m == 0u) return vec2(0.0);') < WATER_BED_GLSL.indexOf('textureGrad(uTileArr, tl'), 'no water corner, no read');
  assert.match(waterBedMix(), /vec2 bedK = bedCover\(data, tileUV, vec3\(tuv, float\(layer\)\), gx, gy, snowC\);/);
  assert.equal(WET_MUD, 0.62); assert.equal(WET_MUD_SHARE, 0.8);
  assert.match(waterBedMix(), /silt = mix\(silt, vec3\(dot\(silt, vec3\(0\.299, 0\.587, 0\.114\)\)\) \* 0\.62, 0\.80 \* bedK\.y\);[^\n]*\n\s+tex = mix\(tex, silt, bedK\.x\);/, 'the fringe wet mud, the silt under the water as it was');
});

test('SHORE-SILT on the player\'s art: under one percent of any ground archive\'s dry tiles reads wet, and a temperate shore\'s water is found (needs ARENA2)', { skip: !(ARENA2 && existsSync(join(ARENA2, 'TEXTURE.302'))) && 'no ARENA2' }, async () => {
  const { TextureFile } = await import('../../src/formats/textureFile.js');
  const { DFPalette } = await import('../../src/formats/dfPalette.js');
  const pal = new DFPalette(); pal.load(new Uint8Array(readFileSync(join(ARENA2, 'ART_PAL.COL'))));
  const load = (arch) => {
    const name = `TEXTURE.${String(arch).padStart(3, '0')}`;
    if (!existsSync(join(ARENA2, name))) return null;
    const t = new TextureFile(); t.load(new Uint8Array(readFileSync(join(ARENA2, name))), name, pal);
    const layers = []; for (let r = 0; r < t.recordCount; r++) layers.push(t.getColor32(t.getDFBitmap(r, 0), 0));
    return layers;
  };
  const wetShare = (l) => { let n = 0; for (let i = 3; i < l.colors.length; i += 4) n += l.colors[i] >= 128; return n / (l.width * l.height); };
  for (const arch of [2, 3, 4, 5, 102, 103, 104, 105, 302, 303, 304, 305, 402, 403, 404, 405]) {
    const layers = load(arch);
    if (!layers) continue;
    const water = shoreWaterColours(layers);
    let marked = 0, total = 0;
    for (const r of DRY_RECORDS) {
      if (!layers[r]) continue;
      const b = layers[r].colors;
      for (let i = 0; i < b.length; i += 4) { total++; marked += water.has((b[i] << 16) | (b[i + 1] << 8) | b[i + 2]); }
    }
    assert.ok(marked / total < 0.01, `${arch}: ${(marked / total * 100).toFixed(3)}% of the dry ground reads wet`);
  }
  const out = markShoreWater(load(302));
  // record 21: water down one side - about half of it; record 22: one corner - a small share; record 5: three corners
  assert.ok(wetShare(out[21]) > 0.3 && wetShare(out[21]) < 0.7, `21: ${wetShare(out[21])}`);
  assert.ok(wetShare(out[22]) > 0.05 && wetShare(out[22]) < 0.35, `22: ${wetShare(out[22])}`);
  assert.ok(wetShare(out[5]) > 0.45, `5: ${wetShare(out[5])}`);
});
