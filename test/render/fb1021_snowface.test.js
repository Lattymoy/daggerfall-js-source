// FIELD BUGS 2026-10-21 (bible/01-Overview/bugs/Field-Bugs-2026-10-21.md): the owner's screenshot - a snowy range under
// its woods, and up its side a straight band of green ground with no snow and no tree on it.
//   SNOW-FACE: on the snow lane a steep face shed its snow (SNOW_GROUND.slope, the normal's y 0.62 to 0.8), and what lay
//   under it was the summer set's grass - Daggerfall's tiles have no rock face - while DFU's own TerrainNature refuses a
//   tree past 50 degrees. The landforms stand such faces hundreds of metres wide on a range's flank. The face keeps the
//   snow its height lays now, as DFU's winter set dresses every tile.
//   LANE-TURN: a pixel built under the other lane was sent to the snow's re-skin, which refuses it (no `_skin` off the
//   lane, no snow `on` off it) - so every pixel standing at a turn of the lane wore the other lane's ground, a summer
//   square in a winter turned off the lane. It is rebuilt now.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { glslFunctions } from '../glsl.mjs';
import { snowCoverGlsl, snowCoreGlsl, snowCoverAt, TWIN_LAYERS } from '../../src/render/snowCoverGlsl.js';
import { ecotoneGlsl } from '../../src/render/ecotoneGlsl.js';
import { createSnowCoverHost } from '../../src/scenes/snowCoverHost.js';
import { createSeasonReskin } from '../../src/world/seasonReskin.js';
import { ecoOrigin } from '../../src/world/ecotone.js';
import { setAirGround } from '../../src/systems/weather/airTemperature.js';
import { CLIMATES } from '../../src/formats/mapsFile.js';

const read = (p) => readFileSync(p, 'utf8');
const none = [0, 0];
const WHITE = [1, 1, 1], GREEN = [0.2, 0.4, 0.1];
/** The cover's chunk with the lines all far below (a whole cover at any height), its winter half white, its summer green. */
const chunk = (origin = [0, 0, 0]) => glslFunctions('uniform highp sampler2DArray uTileArr;\n' + ecotoneGlsl('') + snowCoverGlsl(''), {
  uEcoSide: [0, 0, 0, 0], uEcoCorner: [0, 0, 0, 0], uEcoOrigin: origin, uSnowWin: [origin[0], origin[1] + 128, 11], uSnowSet: [0, 1, 2 * 128, 0], uSnowArr: [TWIN_LAYERS, 0, 0, 0],
  texelFetch: () => [-900, -800, -700, 0],
  textureGrad: (smp, tl) => (tl[2] >= TWIN_LAYERS ? [...WHITE, 1] : [...GREEN, 1]),
});

const A = process.env.ARENA2_PATH;
const HAVE = !!A && existsSync(join(A, 'WOODS.WLD'));

test('SNOW-FACE THE CHUNK READS NO SLOPE: the ground\'s cover is its height\'s and its patches\' - no normal is asked of it in either terrain program, the water\'s bed or the Snowfall mod\'s surface - and under a whole cover a tile\'s texel is its winter record\'s, never the summer grass (mutants: the shed back in the chunk; a cover held under whole)', () => {
  const core = snowCoreGlsl();
  assert.match(core, /float snowCover\(vec2 local, float y, vec2 gx, vec2 gy\) \{/);
  assert.match(core, /float snowLaid\(vec2 local, float y, vec2 gx, vec2 gy\) \{/);
  assert.doesNotMatch(core, /smoothstep\(0\.62|n\.y|vNormal|aNormal/, 'no face sheds it');
  assert.match(read('src/render/waterSurface.js'), /float pc = snowCover\(vLocalXZ, vWorldPos\.y, wgx, wgy\);/, 'the water\'s bed');
  for (const p of ['src/render/renderer.js', 'src/render/enhancedLighting.js']) assert.match(read(p), /float snowC = snowCover\(vLocalXZ, vWorldPos\.y, gx, gy\);/, p);
  const [ox, oz] = ecoOrigin(917, 472), f = chunk([ox, oz, 0]);
  // AUDIT FB1021 L1-5: every second world tile of the pixel, not four places - the patches round a cover a shade under
  // whole back to 1 at most of them (a cover held to 0.98 left 289 of these 4,096 under it, and none of the four)
  for (let lx = 0; lx < 819; lx += 12.8) for (let lz = 0; lz < 819; lz += 12.8) assert.equal(f.snowCover([lx, lz], 1500, none, none), 1, `whole at ${lx},${lz}`);
  for (const [lx, lz] of [[3, 5], [400, 400], [811, 17], [100, 700]]) {
    const c = f.snowCover([lx, lz], 1500, none, none);
    assert.deepEqual([...f.snowGround(GREEN, [1, 0, 0, 0], c, [0.5, 0.5, 2], none, none)], WHITE, 'the grass tile\'s winter record');
  }
});

test('SNOW-FACE ON THE FREEWARE\'S MAP: the landforms stand a range\'s flank past 52 degrees over a third of a high Mountain pixel - the faces the old law shed to their summer grass - DFU\'s nature stands no tree on them (TerrainNature\'s 50 degrees: their bareness is DFU\'s), and a whole cover lies whole on every one (mutants: the CPU\'s shed back)', { skip: HAVE ? false : 'no ARENA2 (sh tools/fetch-data.sh)' }, async () => {
  const { MapsFile } = await import('../../src/formats/mapsFile.js');
  const { WoodsFile } = await import('../../src/formats/woodsFile.js');
  const { generateSamples, HEIGHTMAP_DIMENSION: H, MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE, TERRAIN_SIZE } = await import('../../src/world/terrain/terrainSampler.js');
  const { createLandforms, landformClimates } = await import('../../src/world/landforms.js');
  const { natureStandsAt } = await import('../../src/world/terrain/terrainNature.js');
  const { CLIMATES } = await import('../../src/formats/mapsTables.js');
  const rd = (f) => new Uint8Array(readFileSync(join(A, f)));
  const maps = new MapsFile(); maps.load(rd('MAPS.BSA'), rd('CLIMATE.PAK'), rd('POLITIC.PAK'));
  const woods = new WoodsFile(); woods.load(rd('WOODS.WLD'));
  const PX = 917, PY = 472;
  assert.equal(maps.getClimateIndex(PX, PY), CLIMATES.Mountain);
  const s = generateSamples(woods, PX, PY, H, createLandforms({ woods, climates: landformClimates((x, y) => maps.getClimateIndex(x, y)) }));
  const M = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE, cell = TERRAIN_SIZE / (H - 1);
  const grass = new Uint8Array(128 * 128).fill(2);   // every tile one nature grows on: the slope alone decides
  const [ox, oz] = ecoOrigin(PX, PY);
  let faces = 0, n = 0;
  for (let x = 1; x < 127; x++) {
    for (let y = 1; y < 127; y++) {
      const hx = (s[(x + 1) * H + y] - s[(x - 1) * H + y]) * M / (2 * cell), hy = (s[x * H + y + 1] - s[x * H + y - 1]) * M / (2 * cell);
      n++;
      if (1 / Math.hypot(hx, hy, 1) >= 0.62) continue;   // the old law's whole shed: steeper than 51.7 degrees
      faces++;
      assert.equal(natureStandsAt(s, grass, null, x, y), null, `no tree on the face at ${x},${y}`);
      assert.equal(snowCoverAt(1, x * cell, y * cell, ox, oz), 1, `the face white at ${x},${y}`);
    }
  }
  assert.ok(faces / n > 0.3, `the faces: ${faces} of ${n}`);
});

test('LANE-TURN: a pixel built under the other lane goes to the REBUILD the season driver takes (world/seasonReskin.js take), never to the snow\'s re-skin, which refuses it - both turns, once each; a turn onto the lane once the window stands (AUDIT FB1021 L1-1: the grid torn down while a rebuild integrated a cold window in frame slices); the world wires the host\'s rebuild to the driver\'s mark (mutants: sent to the skin; the world\'s rebuild a skin; a turn on before the window)', async (t) => {
  setAirGround({ climateAt: () => CLIMATES.Woodlands, groundAt: () => 0, topAt: () => 900 });
  t.after(() => setAirGround(null));
  const reskin = createSeasonReskin(), skinned = [];
  const lane = { on: true };
  const built = new Map([['200,100', { px: 200, py: 100, _snow: { px: 200, py: 100, pixel: null, flats: new Float32Array(0) } }], ['201,100', { px: 201, py: 100, _snow: null }]]);
  const state = { compensation: [0, 0, 0], mapOrigin: { x: 200, y: 100 }, current: { x: 200, y: 100 }, pixelTranslation: (px, py, out = [0, 0, 0]) => out };
  let ms = 0;
  const host = createSnowCoverHost({ renderer: { tileArrays: new Map() }, climateAt: () => CLIMATES.Woodlands, mapHeight: 500, stateOf: () => state, builtOf: () => built, owns: () => lane.on,
    markReskin: (k) => { skinned.push(k); reskin.skin(k); }, markRebuild: (k) => reskin.mark(k), now: () => (406 * 360 + 215) * 1440, place: () => ({ px: 200, py: 100 }), clock: () => (ms += 0.25) });
  host.tick({ px: 200, py: 100 });
  assert.equal(host.ready, false, 'a year of snow to integrate: not in a frame');
  assert.equal(reskin.pending, false, 'built off the lane: not torn down before the window stands');
  await host.settle({ left: () => Infinity, breathe: async () => {} });
  host.tick({ px: 200, py: 100 });
  assert.deepEqual(reskin.take(built), ['201,100'], 'the window standing: rebuilt on the lane');
  host.tick({ px: 200, py: 100 });
  assert.equal(reskin.pending, false, 'once');
  lane.on = false;
  host.tick({ px: 200, py: 100 });
  assert.deepEqual(reskin.take(built), ['200,100'], 'built on the lane, the lane turned off: rebuilt off it, at once');
  assert.deepEqual(skinned, [], 'never sent to the skin');
  // why a skin cannot serve: the build's own re-skin refuses a pixel with no `_skin` (off the lane) and any off the lane
  assert.match(read('src/scenes/pixelBuild.js'), /const p = built\.get\(key\), sk = p\?\._skin;\n {4}if \(!sk \|\| !snowCover\?\.on\) return false;/);
  assert.match(read('src/scenes/world.js'), /markReskin: \(key\) => _reskin\.skin\(key\), markRebuild: \(key\) => _reskin\.mark\(key\),/);
});
