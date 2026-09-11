// WATER1 (2026-09-08, Mac: "develop proper water shader for the
// oceans/rivers/ponds of daggerfall"): THE WATER SURFACE. The pins hold
// the water-corner table to the marching squares it inverts, the pass to
// its draw state, both exterior hosts to the one slot and the one gate,
// and the record to its two pages.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  tilemapRectHasWater, buildWaterIndices, windStrength01, waterUniforms, WATER_SURFACE_VS, waterSurfaceFs, WATER_LIFT, WATER_OPACITY, WATER_TINT, WATER_F0, SHORE_SOFTNESS, WATER_SCROLL_TILES_PER_SEC, DEFAULT_SKY_ZENITH, DEFAULT_SKY_HORIZON,
} from '../src/render/waterSurface.js';
import { WATER_MASK_TABLE, buildWaterMaskTable, packWaterMask, waterCorners, waterCoverage, SHALLOW_WHOLE, SHORE_FAMILIES } from '../src/world/waterCorners.js';
import { onShallowWaterTile } from '../src/player/exteriorSurface.js';
import { createLookupTable, assignTiles } from '../src/world/terrainTiles.js';
import { convertTilemap, buildTerrainGrid, buildTerrainIndices } from '../src/world/terrainSurface.js';
import { STREAM_TILES, RIVER_TILES } from '../src/world/roadPainter.js';
import { HEIGHTMAP_DIMENSION } from '../src/world/terrainSampler.js';
import { convertTile, WATER_TILE_INDEX } from '../src/world/terrainSurface.js';
import { WIND_ROW_CALM, WIND_ROW_SPAN } from '../src/systems/wind.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');

test('WATER1: the water-corner table inverts the marching squares - a shape\'s water corners come back from the byte it wrote', () => {
  const lookup = createLookupTable();
  for (let shape = 0; shape < 16; shape++) {
    const raw = lookup[shape];                 // ring 0: water below, dirt above
    const byte = convertTile(raw);
    const want = (~shape) & 0xF;               // the shape's bits are the DIRT corners
    if (shape === 15) { assert.equal(waterCorners(byte), 0, 'bare dirt has no water'); continue; }
    assert.equal(waterCorners(byte), want, `shape ${shape} (record ${raw & 63}, t ${byte & 3})`);
  }
  // record 0 is whole water under every transform (the painter writes rotated water: 64/128/192)
  for (let t = 0; t < 4; t++) assert.equal(waterCorners((WATER_TILE_INDEX << 2) | t), 0xF);
  // the water-grass and water-stone twins take their dirt column's corners
  for (const [k, dirtRecord] of SHORE_FAMILIES[0].entries()) {
    for (let t = 0; t < 4; t++) {
      const m = waterCorners((dirtRecord << 2) | t);
      assert.equal(waterCorners((SHORE_FAMILIES[1][k] << 2) | t), m, `record ${SHORE_FAMILIES[1][k]} t${t}`);
      assert.equal(waterCorners((SHORE_FAMILIES[2][k] << 2) | t), m, `record ${SHORE_FAMILIES[2][k]} t${t}`);
    }
  }
  // the shapes, by count of water corners: a corner record has three, an edge two, a three-corner one, a saddle two
  const bits = (m) => [1, 2, 4, 8].filter((b) => m & b).length;
  for (let t = 0; t < 4; t++) {
    assert.equal(bits(waterCorners((5 << 2) | t)), 3, 'record 5: one dirt corner');
    assert.equal(bits(waterCorners((6 << 2) | t)), 2, 'record 6: an edge');
    assert.equal(bits(waterCorners((7 << 2) | t)), 1, 'record 7: one water corner');
  }
  assert.equal(waterCorners(48 << 2), 0b1001, 'the saddle, unrotated: (0,0) and (1,1)');
  assert.equal(waterCorners((48 << 2) | 1), 0b0110, 'and rotated: the other diagonal');
  // MAC2: DFU's shallow-water records the painters never write as a shape -
  // the town docks, moats and puddles - take the surface WHOLE, under every
  // transform; they are exactly PlayerMotor.OnShallowWaterTile's list
  // (:551-563) minus the shore families whose corners the table knows.
  // MUTANT: drop any record from SHALLOW_WHOLE, or give it a partial mask.
  assert.deepEqual([...SHALLOW_WHOLE], [8, 23, 33, 34, 35, 36]);
  for (const r of SHALLOW_WHOLE) {
    assert.ok(onShallowWaterTile(r), `record ${r} is one of DFU's shallow-water tiles`);
    for (let t = 0; t < 4; t++) assert.equal(waterCorners((r << 2) | t), 0xF, `record ${r} t${t}: whole`);
  }
  assert.ok(!onShallowWaterTile(9), 'record 9 is not in DFU\'s list...');
  // every other record carries no water here: the ring-1 and ring-2 transitions, the bases, and record 9
  for (const r of [1, 2, 3, 9, 10, 11, 12, 15, 16, 17, 46, 51, 53]) {
    for (let t = 0; t < 4; t++) assert.equal(waterCorners((r << 2) | t), 0, `record ${r} t${t}`);
  }
  assert.deepEqual([...buildWaterMaskTable()], [...WATER_MASK_TABLE], 'built once, deterministic');
});

test('WATER1: the pack, and the coverage - the JS twin held against the shader\'s own coverage()', () => {
  const words = packWaterMask();
  assert.equal(words.length, 32, 'eight uvec4s');
  for (let i = 0; i < 256; i++) {
    assert.equal((words[i >> 3] >>> ((i & 7) * 4)) & 0xF, WATER_MASK_TABLE[i], `entry ${i} round-trips`);
  }
  assert.equal(waterCoverage(0xF, 0.3, 0.9), 1);
  assert.equal(waterCoverage(0, 0.3, 0.9), 0);
  assert.equal(waterCoverage(0b0011, 0.5, 0.25), 0.75, 'an edge: water along y = 0, fading up');
  assert.equal(waterCoverage(0b0110, 0.5, 0.5), 0.5, 'a saddle is half at the centre');
  assert.equal(waterCoverage(0b0001, 0, 0), 1);
  assert.equal(waterCoverage(0b0001, 1, 1), 0);
  // AUDIT 65 MC-6: THE ORACLE. waterCoverage has no production caller - it
  // is the JS twin of this module's own GLSL coverage(), so the six values
  // above certify nothing unless the two bodies are held against each
  // other. A swapped corner bit or a swapped f.x/f.y in EITHER half reddens
  // this block - the shader's through the two regexes, the JS twin's through
  // the six values above.
  const cfs = waterSurfaceFs('');
  assert.match(cfs, /float coverage\(uint m, vec2 f\) \{[\s\S]*?return mix\(mix\(c00, c10, f\.x\), mix\(c01, c11, f\.x\), f\.y\);/, 'the shader blends the corners in the same order the JS twin does');
  assert.match(cfs, /float c00 = float\(m & 1u\), c10 = float\(\(m >> 1u\) & 1u\);\s*\n\s*float c01 = float\(\(m >> 2u\) & 1u\), c11 = float\(\(m >> 3u\) & 1u\);/, 'the corner-bit order: bit0 (0,0), bit1 (1,0), bit2 (0,1), bit3 (1,1)');
});

test('WATER1: the uniforms - the eased wind on the row\'s scale, null as calm, the sky\'s two colours, the classic scroll', () => {
  assert.equal(windStrength01(null), 0, 'no wind is known = calm');
  assert.equal(windStrength01([0, 0]), 0);
  assert.equal(windStrength01([WIND_ROW_CALM, 0]), 0, 'the calm floor');
  assert.ok(Math.abs(windStrength01([0, WIND_ROW_CALM + WIND_ROW_SPAN]) - 1) < 1e-9, 'the row\'s top');
  assert.equal(windStrength01([9, 9]), 1, 'clamped');
  const u = waterUniforms({ seconds: 7, wind: [0.02, 0.0], rain: 0.5, sky: { zenith: [0.1, 0.2, 0.3], horizon: [0.4, 0.5, 0.6] } });
  assert.equal(u.time, 7);
  assert.deepEqual(u.windDir, [1, 0]);
  assert.ok(u.windStrength > 0 && u.windStrength < 1);
  assert.equal(u.rain, 0.5);
  assert.deepEqual(u.zenith, [0.1, 0.2, 0.3]);
  assert.deepEqual(u.horizon, [0.4, 0.5, 0.6]);
  assert.ok(Math.abs(u.scroll - (7 * WATER_SCROLL_TILES_PER_SEC) % 1) < 1e-12, 'the dungeon water\'s rate');
  assert.equal(u.lift, WATER_LIFT); assert.equal(u.opacity, WATER_OPACITY); assert.equal(u.f0, WATER_F0); assert.equal(u.shoreSoft, SHORE_SOFTNESS);
  assert.deepEqual(u.tint, WATER_TINT, 'forwarded too - the only uniform nothing asked about');
  // AUDIT 65 PN-1: the lines above are WIRING pins (lift: WATER_LIFT -> lift: 0 reddens them); these hold the NUMBERS, which nothing in the tree held.
  assert.equal(WATER_LIFT, 0.08, 'the z-fight lift above the ground the water is built from');
  assert.ok(WATER_LIFT > 0 && WATER_LIFT < 0.2, 'above the ground but below a step');
  assert.equal(WATER_OPACITY, 0.94, 'the surface\'s base opacity, before Fresnel raises it toward grazing (MAC2: darker, less see-through)');
  assert.equal(WATER_F0, 0.02, 'Schlick\'s F0 for water (n = 1.33)');
  assert.equal(SHORE_SOFTNESS, 0.16, 'half-width of the shore feather, in coverage');
  const calm = waterUniforms({ seconds: 3, still: true });
  assert.equal(calm.time, 0, 'still stops the clock');
  assert.equal(calm.windStrength, 0);
  assert.ok(Math.abs(Math.hypot(calm.windDir[0], calm.windDir[1]) - 1) < 1e-6, 'a unit direction even with no wind');
  assert.equal(calm.zenith, DEFAULT_SKY_ZENITH); assert.equal(calm.horizon, DEFAULT_SKY_HORIZON);
  assert.deepEqual([...DEFAULT_SKY_ZENITH], [0.17, 0.35, 0.72], 'the plain day the surface reflects when no sky says otherwise');
  assert.deepEqual([...DEFAULT_SKY_HORIZON], [0.66, 0.78, 0.92]);
  assert.deepEqual([...WATER_TINT], [0.36, 0.50, 0.60], 'MAC2: the body is the water\'s depth, not its floor');
  assert.equal(waterUniforms({ rain: 4 }).rain, 1, 'rain clamps');
  assert.equal(waterUniforms({ rain: -1 }).rain, 0);
  assert.equal(WATER_SCROLL_TILES_PER_SEC, 0.05, 'render/waterSurface.js is the one home for the classic texel\'s flow');
  // AUDIT 65 CV-3: the rate was spelled three times - here, scenes/dungeon.js
  // and scenes/worldModes.js (as DUNGEON_WATER_SCROLL) - and this line's own
  // message named scenes/dungeon.js while reading only this module, so retuning
  // either host could never redden it. Both hosts import the name now, and no
  // scene may declare a second one.
  for (const h of ['src/scenes/dungeon.js', 'src/scenes/worldModes.js']) {
    assert.match(rd(h), /^import \{ WATER_SCROLL_TILES_PER_SEC \} from '\.\.\/render\/waterSurface\.js';/m, `${h} imports the rate`);
  }
  const jsUnder = (dir) => readdirSync(join(ROOT, dir), { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? jsUnder(`${dir}/${e.name}`) : (e.name.endsWith('.js') ? [`${dir}/${e.name}`] : [])));
  const RATE_DECL = /^\s*(?:export\s+)?(?:const|let|var)\s+(\w*(?:water\w*scroll|scroll\w*tiles_per_sec)\w*)\s*=/im;
  const homes = jsUnder('src').filter((f) => RATE_DECL.test(rd(f)));
  assert.deepEqual(homes, ['src/render/waterSurface.js'], 'exactly one module in src/ declares the water scroll rate');
});

test('WATER1: the shader - the terrain\'s own grid lifted, the corner lookup by compare, the discards, one light law with the ground', () => {
  assert.match(WATER_SURFACE_VS, /layout\(location=0\) in vec3 aPos;\s*\n\s*layout\(location=1\) in float aDepth;/, 'the position and, WATER2, the bed\'s depth');
  assert.match(WATER_SURFACE_VS, /vec4 world = uModel \* vec4\(aPos\.x, aPos\.y \+ uLift, aPos\.z, 1\.0\);/, 'lifted in the model\'s frame');
  const fs = waterSurfaceFs('/*CS*/ float cloudShadowAt(vec3 wp) { return 1.0; }');
  assert.match(fs, /\/\*CS\*\//, 'the renderer\'s cloud-shadow block is interpolated');
  assert.match(fs, /uniform uvec4 uWaterMask\[8\];/);
  assert.match(fs, /uint word = j == 0u \? v\.x : \(j == 1u \? v\.y : \(j == 2u \? v\.z : v\.w\)\);/, 'the component by compare, never a dynamic index');
  assert.match(fs, /if \(corners == 0u\) discard;/, 'no water, no blend');
  assert.match(fs, /float edge = smoothstep\(0\.5 - uShoreSoft, 0\.5 \+ uShoreSoft, coverage\(corners, f\)\);\s*\n(\s*\/\/[^\n]*\n)*\s*edge \*= smoothstep\(0\.0, uShoreDepth, vDepth\);\s*\n\s*if \(edge <= 0\.002\) discard;/, 'the feather, the bed\'s rise (WATER2), then nothing past it');
  assert.match(fs, /float diff = max\(dot\(n, uLightDir\), 0\.0\) \* shadow;/, 'the ground\'s sun term, shadowed by the deck');
  assert.match(fs, /vec3 lit = tex \* \(uAmbient \+ uSunColor \* \(uSunScale \* diff\) \+ uMoonColor \* \(uMoonScale \* mdiff\)\);/, 'TERRAIN_FS\'s light law');
  assert.match(fs, /float F = uF0 \+ \(0\.72 - uF0\) \* pow\(1\.0 - NdV, 5\.0\);/, 'Schlick, capped');
  assert.match(fs, /float body = mix\(uShallowOpacity, uOpacity, deep\);\s*\n\s*float alpha = \(max\(body, foam\) \+ \(1\.0 - max\(body, foam\)\) \* F\) \* edge;/, 'WATER2: the body\'s opacity by depth, Fresnel over it; WATER3: foam is not glass');
  assert.match(fs, /outColor = vec4\(mix\(uFogColor, col, fogFactorAt\(vWorldPos\)\), alpha\);/, 'the fog every world pass takes');
  assert.match(fs, /vec2 uv = fract\(f \+ vec2\(uScroll\)\);\s*\n\s*vec3 tex = texture\(uTileArr, vec3\(uv, 0\.0\)\)\.rgb \* uTint;/, 'the classic water texel, layer 0, scrolled');
  // the trains fade with distance on their own scale - the far sea keeps the swell
  assert.match(fs, /exp\(-dist \* 0\.0015\)\) \* cos\(dot\(p, d0\)/);
  assert.match(fs, /exp\(-dist \* 0\.006\)\) \* cos\(dot\(p, d1\)/);
  assert.match(fs, /exp\(-dist \* 0\.015\)\) \* cos\(dot\(p, d2\)/);
  assert.match(fs, /if \(uRain > 0\.0\) \{\s*\n\s*float near = exp\(-dist \* 0\.012\);/);
  // WATER-AUDIT (H3): the crossing trains are ROTATIONS of the wind - a fixed vector added to a unit wind was collinear at one heading and zero (NaN) at its opposite
  assert.match(fs, /vec2 d1 = vec2\(0\.809 \* d0\.x - 0\.588 \* d0\.y, 0\.588 \* d0\.x \+ 0\.809 \* d0\.y\);/);
  assert.match(fs, /vec2 d2 = vec2\(0\.766 \* d0\.x \+ 0\.643 \* d0\.y, -0\.643 \* d0\.x \+ 0\.766 \* d0\.y\);/);
  assert.doesNotMatch(fs, /normalize\(d0 \+ vec2/, 'the degenerate form is gone');
  // WATER-AUDIT (M1): the dot of two near-unit vectors is clamped before pow
  assert.match(fs, /float NdV = clamp\(dot\(n, V\), 0\.0, 1\.0\);/);
  // WATER-AUDIT (M2): the ground's other two terms, TERRAIN_FS's own loop
  assert.match(fs, /for \(int i = 0; i < 16; i\+\+\) \{\s*\n\s*if \(i >= uPointCount\) break;/);
  assert.match(fs, /lit \+= tex \* \(iAtt \* iAtt \* max\(dot\(n, iL \/ max\(iD, 1e-4\)\), 0\.0\)\) \* uIndirectColor;/);
  assert.match(fs, /ivec2\(uTileDim - 1\)/);
});

test('WATER1: the renderer - one program, the deck\'s shadow key, and a draw state that blends over the ground it is lifted from', () => {
  const r = rd('src/render/renderer.js');
  assert.match(r, /import \{ WATER_SURFACE_VS, waterSurfaceFs \} from '\.\/waterSurface\.js';/);
  assert.match(r, /import \{ packWaterMask \} from '\.\.\/world\/waterCorners\.js';/, 'MAC2: the corner table\'s one home is the world leaf the player\'s feet share');
  assert.match(r, /this\.waterSurfaceProgram = this\._buildProgram\(WATER_SURFACE_VS, waterSurfaceFs\(CLOUD_SHADOW_GLSL\)\);/, 'the same block the terrain interpolates');
  assert.match(r, /this\._csLoc\.water = \[u\('uCloudShadowMap'\), u\('uCloudShadowRect'\)\];/, 'VC4\'s recorded gap, closed');
  const draw = r.slice(r.indexOf('  drawWaterSurface(surface, modelMatrix, arrayTex, tilemapTex, tileSize, u, tileDim = 128) {'));
  const body = draw.slice(0, draw.indexOf('\n  }\n'));
  assert.match(body, /if \(!this\._waterMaskUploaded\) \{ gl\.uniform4uiv\(L\.mask, packWaterMask\(\)\); this\._waterMaskUploaded = true; \}/, 'the table once');
  assert.match(body, /this\._uploadCloudShadow\('water'\);/);
  assert.match(body, /this\._uploadFog\(this\._waterSurfaceFog\);/);
  for (const k of ['_lightDir', '_ambient', '_sunScale', '_sunColor', '_moonDir', '_moonScale', '_moonColor']) {
    assert.ok(body.includes(`this.${k}`), `the ground's ${k}`);
  }
  assert.match(body, /gl\.enable\(gl\.BLEND\);\s*\n\s*gl\.blendFunc\(gl\.SRC_ALPHA, gl\.ONE_MINUS_SRC_ALPHA\);\s*\n\s*gl\.depthMask\(false\);\s*\n\s*gl\.disable\(gl\.CULL_FACE\);/, 'drawWater\'s state');
  assert.match(body, /gl\.enable\(gl\.POLYGON_OFFSET_FILL\);\s*\n\s*gl\.polygonOffset\(0, -2\);\s*\n\s*gl\.depthFunc\(gl\.LEQUAL\);/, 'nudged toward the eye in window depth by the constant term only (WATER-AUDIT M3: a slope factor pulled the water over a far shore), and equal is the surface');
  // WATER-AUDIT (M2): the ground's point lights and indirect light reach the water
  assert.match(body, /gl\.uniform1i\(L\.pointCount, count\);[\s\S]*?gl\.uniform4fv\(L\.indirect, this\._indirect\);\s*\n\s*gl\.uniform3fv\(L\.indirectColor, this\._indirectColor\);/);
  assert.match(body, /gl\.uniform1i\(L\.tileDim, tileDim\);/, 'WATER-AUDIT (L2): the tilemap\'s own side, not a hardcoded 127');
  // WATER-AUDIT (M4): the water's own surface; WATER2: on its own buffers
  assert.match(r, /createWaterSurface\(positions, depths, indices\) \{[\s\S]*?return \{ vao, ebo, buffers: \[pos, dep\], indexCount: indices\.length \};/);
  assert.match(r, /destroyWaterSurface\(water\) \{\s*\n\s*const gl = this\.gl;\s*\n\s*for \(const b of water\.buffers\) gl\.deleteBuffer\(b\);\s*\n\s*gl\.deleteBuffer\(water\.ebo\);\s*\n\s*gl\.deleteVertexArray\(water\.vao\);/);
  assert.match(body, /gl\.depthFunc\(gl\.LESS\);\s*\n\s*gl\.disable\(gl\.POLYGON_OFFSET_FILL\);\s*\n\s*gl\.depthMask\(true\);\s*\n\s*gl\.disable\(gl\.BLEND\);\s*\n\s*gl\.enable\(gl\.CULL_FACE\);/, 'and every bit of it put back');
  assert.match(body, /gl\.bindTexture\(gl\.TEXTURE_2D_ARRAY, arrayTex\);[\s\S]*?gl\.activeTexture\(gl\.TEXTURE2\);\s*\n\s*gl\.bindTexture\(gl\.TEXTURE_2D, tilemapTex\);/, 'the terrain\'s two textures on the terrain\'s two units');
});

test('WATER1: both exterior hosts - the gate, the has-water skip, and the slot after the opaque passes and before the first flat', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const waterOn = isEnhanced\(\) && getPref\('enhancedWater'\) && new URLSearchParams\(globalThis\.location\?\.search \?\? ''\)\.get\('water'\) !== 'off';/, 'world: enhanced skin, the switch, the kill door');
  // WATER-AUDIT (M4): the water's own index set, built with the pixel and rebuilt with its restride, destroyed before the buffers it rides
  assert.match(w, /const waterIndices = waterOn \? buildWaterIndices\(tilemapBytes, stride\) : null;\s*\n\s*const water = waterIndices \? buildWater\(positions, normals, tilemapBytes, stride, waterIndices\) : null;/, 'decided at the build');
  assert.match(w, /px, py, terrain, water, tilemapTex,/, 'carried on the built pixel');
  const restride = w.slice(w.indexOf('  function restrideTerrain(p, stride) {'));
  assert.match(restride.slice(0, restride.indexOf('\n  }\n')), /if \(p\.water\) \{ renderer\.destroyWaterSurface\(p\.water\); p\.water = null; \}[\s\S]*?renderer\.destroyMesh\(p\.terrain\);[\s\S]*?p\.water = waterIndices \? buildWater\(grid\.positions, grid\.normals, p\.tilemapBytes, stride, waterIndices\) : null;/);
  assert.equal((w.match(/renderer\.destroyWaterSurface\(p\.water\)/g) || []).length, 2, 'the restride and the eviction');
  assert.match(w, /p\._visible = pixelVisible;/, 'the pixel gate\'s verdict, kept for the pass');
  const slot = w.indexOf('    if (waterOn) {\n      const wu = waterUniforms(');
  assert.ok(slot > 0, 'the pass exists');
  assert.ok(slot > w.indexOf('renderer.drawTerrain(p.terrain, pixelMatrix,'), 'after the ground');
  assert.ok(slot > w.lastIndexOf('renderer.drawMesh(millParts.rotor, mountRotor(multiply(pixelMatrix, w.local)'), 'after the last opaque model of the pixel loop');
  assert.ok(slot < w.indexOf('renderer.drawBillboards(allBatches, camRight, UP_Y);'), 'before the first flat');
  assert.match(w, /const wu = waterUniforms\(\{ seconds: now \/ 1000, wind: windNow, rain: precipMode === 'rain' \|\| precipMode === 'storm' \? fx\.intensity : 0, sky: sky\.waterSky\(\) \}\);/,
    'the clock, the eased wind the mills take, the front\'s rain, the dome\'s colours');
  assert.match(w, /if \(!p\._visible \|\| !p\.water\) continue;\s*\n\s*renderer\.drawWaterSurface\(p\.water, p\._pixelMatrix, renderer\.tileArrays\.get\(p\.groundArchive\), p\.tilemapTex, 6\.4, wu\);/);
  const e = rd('src/scenes/exterior.js');
  assert.match(e, /const waterOn = isEnhanced\(\) && getPref\('enhancedWater'\) && new URLSearchParams\(globalThis\.location\?\.search \?\? ''\)\.get\('water'\) !== 'off'\s*\n\s*&& tilemapRectHasWater\(tilemapBytes, tilemapDim, loc\.width \* GROUND_TILE_DIM, loc\.height \* GROUND_TILE_DIM\);/, 'exterior: the same gate, and a town without water never enters - asked over the town\'s real extent (WATER-AUDIT L1: the padding is zero, and zero is water)');
  const eslot = e.indexOf('    if (waterOn) {\n      renderer.drawWaterSurface(townWater, identityMatrix,');
  assert.ok(eslot > 0);
  assert.ok(eslot > e.indexOf('renderer.drawTerrain(groundSurface, identityMatrix,'), 'after the ground');
  assert.ok(eslot > e.indexOf('arrows.draw(renderer, texRemap);'), 'after the arrows');
  assert.ok(eslot < e.indexOf('renderer.drawBillboards(_visBatches, camRight, UP_Y);'), 'before the first flat');
  assert.match(e, /waterUniforms\(\{ seconds: now \/ 1000, wind: sky\.wind\(\), rain: precipMode === 'rain' \|\| precipMode === 'storm' \? fx\.intensity : 0, sky: sky\.waterSky\(\) \}\)/);
  assert.match(e, /sky: sky\.waterSky\(\) \}\),\s*\n\s*tilemapDim\);/, 'WATER-AUDIT (L2): the town\'s tilemap side reaches the shader');
  // the dungeon's own water pass is untouched
  assert.match(rd('src/scenes/dungeon.js'), /renderer\.drawWater\(/);
});

test('WATER1: the switch, the row, the sky\'s colours, the lab, the probe and the record', () => {
  assert.match(rd('src/systems/uiPrefs.js'), /enhancedWater: true,/, 'on by default like the other enhanced visuals');
  assert.match(rd('src/ui/enhancedMenu.js'), /prefRow\('enhancedWater', 'Enhanced water',/);
  const shared = rd('src/scenes/shared.js');
  assert.match(shared, /waterSky\(\) \{\s*\n\s*if \(enhancedSky\?\.state\) return \{ zenith: enhancedSky\.state\.zenith, horizon: enhancedSky\.state\.horizon \};/, 'the dome\'s own state');
  assert.match(shared, /const h = dynamic\?\.fogColor \?\? dynamicSky\.clearColor;\s*\n\s*return \{ zenith: \[h\[0\] \* 0\.55, h\[1\] \* 0\.65, h\[2\] \* 0\.85\], horizon: h \};/, 'the mod\'s one colour, with a zenith derived from it (WATER-AUDIT L3: the mod\'s fill IS its clear IS its fog - a copy made the reflection flat)');
  assert.match(shared, /return null;\s*\n\s*\},\s*\n/, 'null under the classic sky');
  const lab = rd('src/tools/waterLab.js');
  assert.match(lab, /mirrorProjectionX\(perspective\(/, 'HANDEDNESS: the lab draws under the hosts\' mirrored projection (unmirrored, every ground face is culled - the lab\'s first day)');
  assert.match(lab, /assignTiles\(tileData, tilemap, true\);/, 'the shore is marched, not painted');
  assert.match(lab, /renderer\.drawWaterSurface\(water, m, renderer\.tileArrays\.get\(ARCHIVE\), tilemapTex, 6\.4, wu\)/, 'the lab draws the water\'s own index set, as the hosts do');
  assert.match(rd('water.html'), /src="\/src\/tools\/waterLab\.js"/);
  const probe = rd('tools/waterProbe.mjs');
  for (const name of ['on and off differ over the sea', 'leaves the sky alone', 'five seconds later', 'a gale varies more than a calm', 'rainy sea', 'glints toward the sun', 'midnight', 'overcast sea']) {
    assert.ok(probe.includes(name), `the probe checks: ${name}`);
  }
  const ledger = rd('bible/01-Overview/Port-Ledger.md');
  assert.match(ledger, /\*\*ENHANCED WATER \(WATER1, 2026-09-08\)\*\*/, 'section A carries the departure');
  assert.match(ledger, /switch `enhancedWater` \(on by default, `\?water=off` the kill switch\)/);
  const arc = rd('bible/07-Rendering/Water-Arc.md');
  assert.match(arc, /# Enhanced water \(WATER1, 2026-09-08\)/);
  assert.match(arc, /fround\(27\.2 \/ 1539\) \* 1539/, 'the ocean-band defect is on the page');
  assert.match(rd('bible/Home.md'), /07-Rendering\/Water-Arc\.md/);
  assert.match(rd('bible/07-Rendering/Rendering.md'), /`waterSurface\.js`/);
});

// ── WATER-AUDIT: the table pinned THROUGH the producer, not against itself ──
test('WATER-AUDIT (H1/H2): every shore tile the marching squares write gives back the corners that were water, in the tilemap\'s own frame', () => {
  // The first pin re-read what buildWaterMaskTable had just written from the
  // same lookup. This one starts from a CORNER GRID, runs the producer
  // (assignTiles, convertTilemap) and asks the table for every cell: bit 1
  // must be the corner at (x + 1, y), bit 2 the corner at (x, y + 1) - the
  // frame the shader's bilinear samples in (cell = (localX, localZ) / 6.4).
  const td = HEIGHTMAP_DIMENSION, dim = 128;
  const tileData = new Uint8Array(td * td);
  // a pseudo-random water/dirt corner field (only records 0 and 1: ring 0)
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < tileData.length; i++) tileData[i] = rnd() < 0.5 ? 0 : 1;
  const tilemap = new Uint8Array(dim * dim);
  assignTiles(tileData, tilemap, true);
  const bytes = convertTilemap(tilemap);
  let shore = 0, whole = 0, dry = 0;
  for (let y = 0; y < dim; y++) {
    for (let x = 0; x < dim; x++) {
      const c00 = tileData[x + y * td] === 0, c10 = tileData[(x + 1) + y * td] === 0;
      const c01 = tileData[x + (y + 1) * td] === 0, c11 = tileData[(x + 1) + (y + 1) * td] === 0;
      const want = (c00 ? 1 : 0) | (c10 ? 2 : 0) | (c01 ? 4 : 0) | (c11 ? 8 : 0);
      const got = waterCorners(bytes[x + y * dim]);
      assert.equal(got, want, `cell (${x},${y}) record ${bytes[x + y * dim] >> 2} t${bytes[x + y * dim] & 3}`);
      if (want === 15) whole++; else if (want === 0) dry++; else shore++;
    }
  }
  assert.ok(shore > 3000 && whole > 300 && dry > 300, `the field exercised every shape: ${shore} shore, ${whole} water, ${dry} dry`);
  // the grid's frame: sample (x, z) sits at local (x * cell, ., z * cell), and
  // the tilemap texel (x, y) is bytes[x + y * dim] - so tilemap y IS local z
  const h = new Float32Array(td * td);
  const grid = buildTerrainGrid(h, 1);
  const at = (x, z) => grid.positions.subarray((z * td + x) * 3, (z * td + x) * 3 + 3);
  const near = (a, b) => Math.abs(a - b) < 1e-3;
  assert.ok(near(at(3, 7)[0], 3 * 6.4) && near(at(3, 7)[2], 7 * 6.4), 'x along X, the row index along Z');
  const r = rd('src/render/renderer.js');
  assert.match(r, /gl\.texImage2D\(gl\.TEXTURE_2D, 0, gl\.R8UI, dim, dim, 0, gl\.RED_INTEGER, gl\.UNSIGNED_BYTE, bytes\);/, 'row-major, dim wide: texel (x, y) = bytes[x + y * dim]');
  // and the mutation the tautology let through: an inverted table fails here
  const inverted = new Uint8Array(256);
  for (let i = 0; i < 256; i++) inverted[i] = WATER_MASK_TABLE[i] ? (~WATER_MASK_TABLE[i]) & 15 : 0;
  let wrong = 0;
  for (let i = 0; i < bytes.length; i++) if (waterCorners(bytes[i], inverted) !== waterCorners(bytes[i])) wrong++;
  assert.ok(wrong > 3000, 'an inverted sense is caught by the field');
});

test('WATER-AUDIT (L4): every record the river painter can write for a water path is in the table\'s families', () => {
  const written = new Set();
  for (const rows of [STREAM_TILES, RIVER_TILES]) for (const row of rows) if (row) for (const rec of row) written.add(rec);
  const covered = new Set([0, ...SHORE_FAMILIES.flat()]);
  for (const rec of written) assert.ok(covered.has(rec), `record ${rec} is painted as a water path and the table does not know it`);
  // the families' columns ARE the painter's: column k of each family is the same shape
  for (const fam of SHORE_FAMILIES) assert.equal(fam.length, 4, 'corner, edge, three-corner, saddle');
});

test('WATER-AUDIT (M4/L5): the water\'s own index set - the wet quads of the terrain layout, no skirt, null when dry', () => {
  const dim = 128;
  const bytes = new Uint8Array(dim * dim).fill(4);   // dirt everywhere
  assert.equal(buildWaterIndices(bytes, 1), null, 'no water, no surface');
  bytes[5 + 7 * dim] = 0;                              // one water tile
  bytes[9 + 7 * dim] = (6 << 2) | 1;                   // one shore tile
  const one = buildWaterIndices(bytes, 1);
  assert.equal(one.length, 12, 'two quads');
  const g = 129;
  assert.deepEqual([...one.slice(0, 6)], [7 * g + 5, 7 * g + 5 + g, 7 * g + 5 + g + 1, 7 * g + 5, 7 * g + 5 + g + 1, 7 * g + 6], 'buildTerrainIndices\' own six, for the tile\'s quad');
  // the same six the full grid carries for that quad
  const full = buildTerrainIndices(1);
  const q = 7 * 128 + 5;
  assert.deepEqual([...one.slice(0, 6)], [...full.slice(q * 6, q * 6 + 6)]);
  // the far ring: a stride-4 quad covers 4x4 tiles and is kept when any is wet; no skirt indices ever
  const lod = buildWaterIndices(bytes, 4);
  assert.equal(lod.length, 12, 'tile x 5 is coarse quad 1, tile x 9 coarse quad 2');
  assert.ok(Math.max(...lod) < 33 * 33, 'no skirt vertex (the skirt sits past g*g)');
  // a whole sea keeps every quad and nothing more
  const sea = buildWaterIndices(new Uint8Array(dim * dim), 1);
  assert.equal(sea.length, 128 * 128 * 6);
  assert.equal(buildWaterIndices(new Uint8Array(dim * dim), 4).length, 32 * 32 * 6);
  // the fixed city's gate, over the real extent only
  const town = new Uint8Array(32 * 32);   // padded square, zero = water
  town.fill(4, 0, 32 * 32);
  assert.equal(tilemapRectHasWater(town, 32, 16, 16), false);
  town[3 + 2 * 32] = 0;
  assert.equal(tilemapRectHasWater(town, 32, 16, 16), true);
  const padded = new Uint8Array(32 * 32);   // all zero: the padding past a 16x16 town is water, the town is not
  padded.fill(4, 0, 16); for (let y = 0; y < 16; y++) padded.fill(4, y * 32, y * 32 + 16);
  assert.equal(tilemapRectHasWater(padded, 32, 32, 32), true, 'the whole map says yes (the padding)');
  assert.equal(tilemapRectHasWater(padded, 32, 16, 16), false, 'the town says no');
  // AUDIT 65 MC-6 fixup: the TABLE laws the retired whole-map twin used to
  // carry (its :73-76). Without them the gate can stop reading the table and
  // answer "zero is water" instead, and every shore tile stops counting.
  assert.equal(tilemapRectHasWater(new Uint8Array([4, (6 << 2) | 3]), 2, 2, 1), true, 'one shore tile');
  assert.equal(tilemapRectHasWater(new Uint8Array([4, 8, 12, 40]), 4, 4, 1), false, 'dirt, grass, stone, a dirt-grass edge');
});
