// WATER1 (2026-09-08, Mac: "develop proper water shader for the
// oceans/rivers/ponds of daggerfall"): THE WATER SURFACE. The pins hold
// the water-corner table to the marching squares it inverts, the pass to
// its draw state, both exterior hosts to the one slot and the one gate,
// and the record to its two pages.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  WATER_MASK_TABLE, buildWaterMaskTable, packWaterMask, tilemapHasWater, waterCorners, waterCoverage,
  windStrength01, waterUniforms, SHORE_FAMILIES, WATER_SURFACE_VS, waterSurfaceFs,
  WATER_LIFT, WATER_OPACITY, WATER_F0, SHORE_SOFTNESS, WATER_SCROLL_TILES_PER_SEC, DEFAULT_SKY_ZENITH, DEFAULT_SKY_HORIZON,
} from '../src/render/waterSurface.js';
import { createLookupTable } from '../src/world/terrainTiles.js';
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
  // every other record carries no water here: the ring-1 and ring-2 transitions, the bases, the docks and moats
  for (const r of [1, 2, 3, 8, 9, 10, 11, 12, 15, 16, 17, 23, 33, 34, 35, 36, 46, 51, 53]) {
    for (let t = 0; t < 4; t++) assert.equal(waterCorners((r << 2) | t), 0, `record ${r} t${t}`);
  }
  assert.deepEqual([...buildWaterMaskTable()], [...WATER_MASK_TABLE], 'built once, deterministic');
});

test('WATER1: the pack, the coverage and the has-water gate', () => {
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
  assert.equal(tilemapHasWater(new Uint8Array([4, 8, 12, 40])), false, 'dirt, grass, stone, a dirt-grass edge');
  assert.equal(tilemapHasWater(new Uint8Array([4, 8, 0])), true, 'one water tile');
  assert.equal(tilemapHasWater(new Uint8Array([4, (6 << 2) | 3])), true, 'one shore tile');
  assert.equal(tilemapHasWater(new Uint8Array(0)), false);
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
  const calm = waterUniforms({ seconds: 3, still: true });
  assert.equal(calm.time, 0, 'still stops the clock');
  assert.equal(calm.windStrength, 0);
  assert.ok(Math.abs(Math.hypot(calm.windDir[0], calm.windDir[1]) - 1) < 1e-6, 'a unit direction even with no wind');
  assert.equal(calm.zenith, DEFAULT_SKY_ZENITH); assert.equal(calm.horizon, DEFAULT_SKY_HORIZON);
  assert.equal(waterUniforms({ rain: 4 }).rain, 1, 'rain clamps');
  assert.equal(waterUniforms({ rain: -1 }).rain, 0);
  assert.equal(WATER_SCROLL_TILES_PER_SEC, 0.05, 'scenes/dungeon.js WATER_SCROLL_TILES_PER_SEC');
});

test('WATER1: the shader - the terrain\'s own grid lifted, the corner lookup by compare, the discards, one light law with the ground', () => {
  assert.match(WATER_SURFACE_VS, /layout\(location=0\) in vec3 aPos;\s*\n\s*layout\(location=1\) in vec3 aNormal;/, 'TERRAIN_VS\'s attributes');
  assert.match(WATER_SURFACE_VS, /vec4 world = uModel \* vec4\(aPos\.x, aPos\.y \+ uLift, aPos\.z, 1\.0\);/, 'lifted in the model\'s frame');
  const fs = waterSurfaceFs('/*CS*/ float cloudShadowAt(vec3 wp) { return 1.0; }');
  assert.match(fs, /\/\*CS\*\//, 'the renderer\'s cloud-shadow block is interpolated');
  assert.match(fs, /uniform uvec4 uWaterMask\[8\];/);
  assert.match(fs, /uint word = j == 0u \? v\.x : \(j == 1u \? v\.y : \(j == 2u \? v\.z : v\.w\)\);/, 'the component by compare, never a dynamic index');
  assert.match(fs, /if \(corners == 0u\) discard;/, 'no water, no blend');
  assert.match(fs, /float edge = smoothstep\(0\.5 - uShoreSoft, 0\.5 \+ uShoreSoft, coverage\(corners, f\)\);\s*\n\s*if \(edge <= 0\.002\) discard;/, 'the feather, then nothing past it');
  assert.match(fs, /float diff = max\(dot\(n, uLightDir\), 0\.0\) \* shadow;/, 'the ground\'s sun term, shadowed by the deck');
  assert.match(fs, /vec3 lit = tex \* \(uAmbient \+ uSunColor \* \(uSunScale \* diff\) \+ uMoonColor \* \(uMoonScale \* mdiff\)\);/, 'TERRAIN_FS\'s light law');
  assert.match(fs, /float F = uF0 \+ \(0\.72 - uF0\) \* pow\(1\.0 - NdV, 5\.0\);/, 'Schlick, capped');
  assert.match(fs, /float alpha = \(uOpacity \+ \(1\.0 - uOpacity\) \* F\) \* edge;/);
  assert.match(fs, /outColor = vec4\(mix\(uFogColor, col, fogFactorAt\(vWorldPos\)\), alpha\);/, 'the fog every world pass takes');
  assert.match(fs, /vec2 uv = fract\(f \+ vec2\(uScroll\)\);\s*\n\s*vec3 tex = texture\(uTileArr, vec3\(uv, 0\.0\)\)\.rgb \* uTint;/, 'the classic water texel, layer 0, scrolled');
  // the trains fade with distance on their own scale - the far sea keeps the swell
  assert.match(fs, /exp\(-dist \* 0\.0015\)\) \* cos\(dot\(p, d0\)/);
  assert.match(fs, /exp\(-dist \* 0\.006\)\) \* cos\(dot\(p, d1\)/);
  assert.match(fs, /exp\(-dist \* 0\.015\)\) \* cos\(dot\(p, d2\)/);
  assert.match(fs, /if \(uRain > 0\.0\) \{\s*\n\s*float near = exp\(-dist \* 0\.012\);/);
});

test('WATER1: the renderer - one program, the deck\'s shadow key, and a draw state that blends over the ground it is lifted from', () => {
  const r = rd('src/render/renderer.js');
  assert.match(r, /import \{ WATER_SURFACE_VS, waterSurfaceFs, packWaterMask \} from '\.\/waterSurface\.js';/);
  assert.match(r, /this\.waterSurfaceProgram = this\._buildProgram\(WATER_SURFACE_VS, waterSurfaceFs\(CLOUD_SHADOW_GLSL\)\);/, 'the same block the terrain interpolates');
  assert.match(r, /this\._csLoc\.water = \[u\('uCloudShadowMap'\), u\('uCloudShadowRect'\)\];/, 'VC4\'s recorded gap, closed');
  const draw = r.slice(r.indexOf('  drawWaterSurface(surface, modelMatrix, arrayTex, tilemapTex, tileSize, u) {'));
  const body = draw.slice(0, draw.indexOf('\n  }\n'));
  assert.match(body, /if \(!this\._waterMaskUploaded\) \{ gl\.uniform4uiv\(L\.mask, packWaterMask\(\)\); this\._waterMaskUploaded = true; \}/, 'the table once');
  assert.match(body, /this\._uploadCloudShadow\('water'\);/);
  assert.match(body, /this\._uploadFog\(this\._waterSurfaceFog\);/);
  for (const k of ['_lightDir', '_ambient', '_sunScale', '_sunColor', '_moonDir', '_moonScale', '_moonColor']) {
    assert.ok(body.includes(`this.${k}`), `the ground's ${k}`);
  }
  assert.match(body, /gl\.enable\(gl\.BLEND\);\s*\n\s*gl\.blendFunc\(gl\.SRC_ALPHA, gl\.ONE_MINUS_SRC_ALPHA\);\s*\n\s*gl\.depthMask\(false\);\s*\n\s*gl\.disable\(gl\.CULL_FACE\);/, 'drawWater\'s state');
  assert.match(body, /gl\.enable\(gl\.POLYGON_OFFSET_FILL\);\s*\n\s*gl\.polygonOffset\(-1, -2\);\s*\n\s*gl\.depthFunc\(gl\.LEQUAL\);/, 'nudged toward the eye in window depth, and equal is the surface');
  assert.match(body, /gl\.depthFunc\(gl\.LESS\);\s*\n\s*gl\.disable\(gl\.POLYGON_OFFSET_FILL\);\s*\n\s*gl\.depthMask\(true\);\s*\n\s*gl\.disable\(gl\.BLEND\);\s*\n\s*gl\.enable\(gl\.CULL_FACE\);/, 'and every bit of it put back');
  assert.match(body, /gl\.bindTexture\(gl\.TEXTURE_2D_ARRAY, arrayTex\);[\s\S]*?gl\.activeTexture\(gl\.TEXTURE2\);\s*\n\s*gl\.bindTexture\(gl\.TEXTURE_2D, tilemapTex\);/, 'the terrain\'s two textures on the terrain\'s two units');
});

test('WATER1: both exterior hosts - the gate, the has-water skip, and the slot after the opaque passes and before the first flat', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const waterOn = isEnhanced\(\) && getPref\('enhancedWater'\) && new URLSearchParams\(globalThis\.location\?\.search \?\? ''\)\.get\('water'\) !== 'off';/, 'world: enhanced skin, the switch, the kill door');
  assert.match(w, /const hasWater = tilemapHasWater\(tilemapBytes\);/, 'decided at the build');
  assert.match(w, /tilemapTex, tilemap, hasWater,/, 'carried on the built pixel');
  assert.match(w, /p\._visible = pixelVisible;/, 'the pixel gate\'s verdict, kept for the pass');
  const slot = w.indexOf('    if (waterOn) {\n      const wu = waterUniforms(');
  assert.ok(slot > 0, 'the pass exists');
  assert.ok(slot > w.indexOf('renderer.drawTerrain(p.terrain, pixelMatrix,'), 'after the ground');
  assert.ok(slot > w.lastIndexOf('renderer.drawMesh(millParts.rotor, mountRotor(multiply(pixelMatrix, w.local)'), 'after the last opaque model of the pixel loop');
  assert.ok(slot < w.indexOf('renderer.drawBillboards(allBatches, camRight, UP_Y);'), 'before the first flat');
  assert.match(w, /const wu = waterUniforms\(\{ seconds: now \/ 1000, wind: windNow, rain: precipMode === 'rain' \|\| precipMode === 'storm' \? fx\.intensity : 0, sky: sky\.waterSky\(\) \}\);/,
    'the clock, the eased wind the mills take, the front\'s rain, the dome\'s colours');
  assert.match(w, /if \(!p\._visible \|\| !p\.hasWater\) continue;\s*\n\s*renderer\.drawWaterSurface\(p\.terrain, p\._pixelMatrix, renderer\.tileArrays\.get\(p\.groundArchive\), p\.tilemapTex, 6\.4, wu\);/);
  const e = rd('src/scenes/exterior.js');
  assert.match(e, /const waterOn = isEnhanced\(\) && getPref\('enhancedWater'\) && new URLSearchParams\(globalThis\.location\?\.search \?\? ''\)\.get\('water'\) !== 'off' && tilemapHasWater\(tilemapBytes\);/, 'exterior: the same gate, and a town without water never enters');
  const eslot = e.indexOf('    if (waterOn) {\n      renderer.drawWaterSurface(groundSurface, identityMatrix,');
  assert.ok(eslot > 0);
  assert.ok(eslot > e.indexOf('renderer.drawTerrain(groundSurface, identityMatrix,'), 'after the ground');
  assert.ok(eslot > e.indexOf('arrows.draw(renderer, texRemap);'), 'after the arrows');
  assert.ok(eslot < e.indexOf('renderer.drawBillboards(_visBatches, camRight, UP_Y);'), 'before the first flat');
  assert.match(e, /waterUniforms\(\{ seconds: now \/ 1000, wind: sky\.wind\(\), rain: precipMode === 'rain' \|\| precipMode === 'storm' \? fx\.intensity : 0, sky: sky\.waterSky\(\) \}\)/);
  // the dungeon's own water pass is untouched
  assert.match(rd('src/scenes/dungeon.js'), /renderer\.drawWater\(/);
});

test('WATER1: the switch, the row, the sky\'s colours, the lab, the probe and the record', () => {
  assert.match(rd('src/systems/uiPrefs.js'), /enhancedWater: true,/, 'on by default like the other enhanced visuals');
  assert.match(rd('src/ui/enhancedMenu.js'), /prefRow\('enhancedWater', 'Enhanced water',/);
  const shared = rd('src/scenes/shared.js');
  assert.match(shared, /waterSky\(\) \{\s*\n\s*if \(enhancedSky\?\.state\) return \{ zenith: enhancedSky\.state\.zenith, horizon: enhancedSky\.state\.horizon \};/, 'the dome\'s own state');
  assert.match(shared, /if \(dynamicSky\) return \{ zenith: dynamicSky\.fillColor \?\? dynamicSky\.clearColor, horizon: dynamic\?\.fogColor \?\? dynamicSky\.clearColor \};/, 'the mod\'s');
  assert.match(shared, /return null;\s*\n\s*\},\s*\n/, 'null under the classic sky');
  const lab = rd('src/tools/waterLab.js');
  assert.match(lab, /mirrorProjectionX\(perspective\(/, 'HANDEDNESS: the lab draws under the hosts\' mirrored projection (unmirrored, every ground face is culled - the lab\'s first day)');
  assert.match(lab, /assignTiles\(tileData, tilemap, true\);/, 'the shore is marched, not painted');
  assert.match(lab, /renderer\.drawWaterSurface\(terrain, m, renderer\.tileArrays\.get\(ARCHIVE\), tilemapTex, 6\.4, wu\)/);
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
