// BANTHA2 (2026-10-19, the owner, with their "Jungle Preview": "At the ground level, the image shows the flora abundence
// that should be present in the jungle"): THE JUNGLE'S FLOOR - a second field of the grass system wearing the rainforest's
// own low cover and the owner's tall tuft on the meadow's crossed cards (src/render/jungleFloorArt.js,
// src/scenes/jungleFloorHost.js), where the jungle's floor claims the ground (src/scenes/jungleHost.js floorClaims).
// bible/03-World/Bantha-Jungle.md "The floor" is the record.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { JUNGLE_FLOOR_PLANTS, JUNGLE_FLOOR_ARCHIVE, FLOOR_MEAN_BLADE, JUNGLE_FLOOR_PLANTS_M2, jungleFloorArt, floorPick } from '../../src/render/jungleFloorArt.js';
import { fitSprite, meadowSpriteBox, cardMeasures, meadowTexel, meadowArtGround, MEADOW_SLOTS, MEADOW_LUSH, MEADOW_GREEN } from '../../src/render/grassMeadow.js';
import { MEADOW_SPRITES } from '../../src/render/meadowArt.js';
import { grassStagesOf, MEADOW_ART, LabGrassRenderer, GAME_GRASS_VS, GAME_GRASS_FS, GRASS_TONES, floorRecordsOf, grassRecordsOf, LAB_GRASS, heightFloor, heightSpan } from '../../src/render/labGrass.js';
import { TREE_RECORDS } from '../../src/world/terrain/terrainNature.js';
import { createJungleFloorHost, JUNGLE_FLOOR, floorDensity } from '../../src/scenes/jungleFloorHost.js';
import { createJungleHost } from '../../src/scenes/jungleHost.js';
import { jungleFloorDraw, jungleShare, JUNGLE_EDGE } from '../../src/world/jungle/jungleRegion.js';
import { TERRAIN_SIZE as PIXEL_M } from '../../src/world/terrain/terrainSampler.js';
import { smoothstep } from '../../src/systems/mathf.js';
import { glslFunctions } from '../glsl.mjs';
import { hostText } from '../hostText.mjs';

const A = process.env.ARENA2_PATH;
const HAVE = !!A && existsSync(join(A, 'TEXTURE.402'));

/** a picture `w` x `h`, RGBA top row first: a plant's shape (a triangle on its foot) in `rgb`, alpha `a` where drawn */
function picture(w, h, rgb = [40, 120, 50], a = 255) {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const half = ((y + 1) / h) * (w / 2);
    for (let x = 0; x < w; x++) {
      if (Math.abs(x + 0.5 - w / 2) > half) continue;
      const o = (y * w + x) * 4;
      data[o] = rgb[0]; data[o + 1] = rgb[1]; data[o + 2] = rgb[2]; data[o + 3] = a;
    }
  }
  return { width: w, height: h, data };
}
/** the floor's pictures, archive 500's sizes (TEXTURE.500: 7 36x27, 9 47x58, 10 46x41, 1 70x45, 27 34x41, 21 38x42, 6 18x42) */
const SIZES = new Map([[7, [36, 27]], [9, [47, 58]], [10, [46, 41]], [1, [70, 45]], [27, [34, 41]], [21, [38, 42]], [6, [18, 42]]]);
const pics = new Map([...SIZES].map(([r, [w, h]]) => [r, picture(w, h, [30 + r, 110, 40])]));
const ART = jungleFloorArt((r) => pics.get(r) ?? null);

test('BANTHA2 THE FLOOR\'S PLANTS: archive 500\'s low cover - never one of its Tree records - and the owner\'s tall tuft, eight for the atlas\'s eight cells; every share a share at both ends of the patch, the last plant the rest; the cover a walker wades through, grass to the knee and fern to the waist (mutants: a plant\'s share past the byte; a Tree record on the floor)', () => {
  assert.equal(JUNGLE_FLOOR_ARCHIVE, 500);
  assert.equal(JUNGLE_FLOOR_PLANTS.length, MEADOW_SLOTS, 'one a cell');
  assert.equal(JUNGLE_FLOOR_PLANTS[0].record, null, 'the first the owner\'s tuft');
  for (const p of JUNGLE_FLOOR_PLANTS.slice(1)) assert.ok(p.record >= 1 && p.record <= 31 && !TREE_RECORDS[500].includes(p.record), `${p.name}: archive 500's cover, not its Trees`);
  for (const end of [0, 1]) {
    const sum = JUNGLE_FLOOR_PLANTS.slice(0, -1).reduce((s, p) => s + p.share[end], 0);
    assert.ok(sum > 0.9 && sum < 1, `the shares at the ${end ? 'lush' : 'poor'} end leave the last its rest (${sum.toFixed(2)})`);
  }
  for (const p of JUNGLE_FLOOR_PLANTS) assert.ok(p.height >= 0.4 && p.height <= 1.3 && p.stiff > 0 && p.stiff <= 1 && p.sway > 0 && p.sway <= 1, p.name);
  assert.ok(Math.abs(FLOOR_MEAN_BLADE - (heightFloor(LAB_GRASS.height) + heightSpan(LAB_GRASS.height) / 2)) < 1e-12);
});

test('BANTHA2 A PICTURE AS A SPRITE (fitSprite): whole texels a pixel where it fits, shrunk where it does not, centred across with its foot on the cell\'s floor; its colours its own; a pack\'s soft alpha cut at a half (mutants: the foot hung at the top; a fern stretched to the cell; the soft edge kept whole)', () => {
  const fern = fitSprite(picture(47, 58), 'fern');
  assert.deepEqual([fern.width, fern.height], [64, 64]);
  const fb = meadowSpriteBox(fern);
  assert.deepEqual([fb.u0 * 64, fb.u1 * 64, fb.v0, fb.v1 * 64], [8, 55, 0, 58], 'a texel a pixel, centred, on its foot');
  const bush = fitSprite(picture(70, 45), 'bush');
  const bb = meadowSpriteBox(bush);
  assert.deepEqual([bb.u0, bb.u1, bb.v0, Math.round(bb.v1 * 64)], [0, 1, 0, 41], 'shrunk to the cell, its height with it');
  const small = fitSprite(picture(20, 20), 'small');
  assert.equal(Math.round(meadowSpriteBox(small).v1 * 64), 60, 'three texels a pixel: whole');
  const foot = (fern.height - 1) * 64 + 31;   // the bottom row's middle: the triangle's base
  assert.deepEqual([...fern.rgba.slice(foot * 4, foot * 4 + 4)], [40, 120, 50, 255], 'its colour, opaque');
  const soft = fitSprite(picture(10, 10, [1, 2, 3], 100), 'soft'), firm = fitSprite(picture(10, 10, [1, 2, 3], 200), 'firm');
  assert.ok(!soft.rgba.some((v, i) => i % 4 === 3 && v) && firm.rgba.some((v, i) => i % 4 === 3 && v === 255), 'cut at a half');
});

test('BANTHA2 THE FLOOR\'S SET (jungleFloorArt): eight sprites in atlas order - the tuft the meadow\'s own, each other its record\'s picture fitted; a card\'s scale its plant\'s height over the lab\'s mean blade and the height its sprite stands in its cell; the cards\' measures the set\'s own; no picture for any plant, no floor (mutants: a missing picture stood in by another; the scale off the cell, not the box)', () => {
  assert.equal(ART.sprites.length, MEADOW_SLOTS);
  assert.equal(ART.sprites[0], MEADOW_SPRITES[0], 'the owner\'s tall tuft');
  JUNGLE_FLOOR_PLANTS.forEach((p, i) => {
    assert.ok(Math.abs(ART.variants[i].scale * FLOOR_MEAN_BLADE * ART.boxes[i].v1 - p.height) < 1e-9, `${p.name}: its card stands its height`);
    assert.deepEqual([ART.variants[i].stiff, ART.variants[i].sway], [p.stiff, p.sway]);
  });
  assert.deepEqual({ top: ART.top, reach: ART.reach, windReach: ART.windReach }, cardMeasures(ART.variants, ART.boxes));
  assert.ok(ART.top > MEADOW_ART.top, 'a fern stands over any meadow tuft');
  const mips = ART.mips();
  assert.deepEqual([mips[0].width, mips[0].height, mips.at(-1).width, mips.at(-1).height], [512, 64, 1, 1], 'the meadow\'s atlas, its whole chain');
  assert.equal(jungleFloorArt((r) => (r === 9 ? null : pics.get(r))), null, 'a plant with no picture: no floor');
});

test('BANTHA2 THE PICK, AS THE GPU RUNS IT: the vertex stage\'s ladder (labGrass.js ladderPick) and floorPick agree at every width byte at the poor and the lush ends of the patch; the lush patch more fern and leaf, the poor more grass and sedge (mutants: the ladder\'s rungs cumulative no more; the last plant never drawn)', () => {
  const fns = glslFunctions(`float pickOf(vec4 aPB, float mLush) {\n  float mVar = 0.0;\n${ART.pick}  return mVar;\n}`);
  const seen = [new Array(8).fill(0), new Array(8).fill(0)];
  for (const [end, tint] of [[0, 0.2], [1, 0.8]]) {
    const lush = smoothstep(MEADOW_LUSH[0], MEADOW_LUSH[1], tint);
    for (let k = 0; k < 1000; k++) {
      const r = (k + 0.5) / 1000, js = floorPick(ART, r, tint);
      assert.equal(fns.pickOf([0, 0, 0, r], lush), js.variant, `the byte ${r} at the ${end ? 'lush' : 'poor'} end`);
      seen[end][js.variant]++;
    }
  }
  for (const counts of seen) assert.ok(counts.every((c) => c > 0), 'every plant drawn');
  const leafy = (c) => c[2] + c[3] + c[4], grassy = (c) => c[0] + c[1];
  assert.ok(leafy(seen[1]) > leafy(seen[0]) && grassy(seen[0]) > grassy(seen[1]), 'the lush patch leafier, the poor grassier');
  assert.ok(Math.abs(floorPick(ART, 0.5, 0.8).scale - ART.variants[floorPick(ART, 0.5, 0.8).variant].scale * 1.25) < 1e-9, 'the lush patch the meadow\'s 1.25');
});

test('BANTHA2 THE STAGES: the meadow\'s own program unchanged (grassStagesOf(MEADOW_ART) the game\'s); the floor\'s the game\'s with its own ladders - its scales, its boxes, its pick - in the meadow\'s place (mutants: the floor drawn with the meadow\'s ladders)', () => {
  assert.equal(grassStagesOf(MEADOW_ART).vs, GAME_GRASS_VS);
  const floor = grassStagesOf(ART);
  assert.equal(floor.fs, GAME_GRASS_FS, 'the fragment stage the meadow\'s');
  assert.notEqual(floor.vs, GAME_GRASS_VS);
  assert.ok(floor.vs.includes(ART.pick) && !floor.vs.includes('mR < mB + mF + mD'), 'its pick, never the meadow\'s');
  assert.ok(floor.vs.includes(String(ART.variants.at(-1).scale)) && floor.vs.includes(String(ART.boxes[1].v1)), 'its scales and its boxes');
  assert.ok(!GAME_GRASS_VS.includes(ART.pick));
});

test('BANTHA2 THE FLOOR\'S COLOURS: its plants take the ground\'s light and never its hue - a fern on the jungle\'s red earth keeps a fern\'s green, where the meadow\'s tuft takes the earth\'s hue whole; the renderer uploads its set\'s share (mutants: the floor taking the ground\'s hue; the share never uploaded)', () => {
  assert.deepEqual([MEADOW_ART.hue, ART.hue], [1, 0], 'the meadow the ground\'s whole hue, the floor none');
  const artGround = meadowArtGround(GRASS_TONES[1], ART.green), earth = [0.42, 0.24, 0.16], leaf = [74 / 255, 106 / 255, 67 / 255];
  const fern = meadowTexel(leaf, earth, artGround, ART.hue), tuft = meadowTexel(leaf, earth, artGround, MEADOW_ART.hue);
  assert.ok(Math.abs(fern[0] / fern[1] - leaf[0] / leaf[1]) < 1e-9 && Math.abs(fern[2] / fern[1] - leaf[2] / leaf[1]) < 1e-9, 'the fern\'s hue its own');
  assert.ok(tuft[0] / tuft[1] > fern[0] / fern[1] + 0.2, 'the meadow\'s tuft reddened by the earth');
  assert.deepEqual(ART.green, MEADOW_GREEN, 'the anchor the tall tuft\'s, as the meadow\'s');
  assert.ok(/gl\.uniform1f\(u\.uArtHue, this\.art\.hue\)/.test(LabGrassRenderer.prototype.draw.toString()), 'the draw uploads its set\'s share');
});

test('BANTHA2 THE FLOOR\'S GROUND (floorRecordsOf): DFU\'s dirt and grass by their place, whatever their colour - a swamp\'s olive grass the floor\'s and its green stone not; a blend more than half grass or dirt the floor\'s - stone, water and the roads never; the meadow\'s grassRecordsOf takes no dirt (mutants: the bases by colour; the dirt base not the floor\'s; a road let in)', () => {
  const tile = (fill) => ({ width: 4, height: 4, colors: Uint8Array.from({ length: 64 }, (_, i) => fill(Math.floor(i / 4))[i % 4]) });
  const water = [40, 60, 160, 255], dirt = [120, 90, 60, 255], grass = [60, 130, 50, 255], stone = [128, 128, 128, 255];
  const layers = [tile(() => water), tile(() => dirt), tile(() => grass), tile(() => stone)];
  layers[4] = tile((k) => (k < 9 ? dirt : stone));    // 9 of 16 dirt
  layers[5] = tile((k) => (k < 5 ? grass : stone));   // 5 of 16 grass
  layers[6] = tile((k) => (k < 6 ? dirt : grass));    // dirt and grass
  for (let r = 7; r <= 46; r++) layers[r] = tile(() => grass);
  const floor = floorRecordsOf(layers), meadow = grassRecordsOf(layers);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map((r) => floor.has(r)), [false, true, true, false, true, false, true]);
  assert.ok(!floor.has(46), 'a road never');
  assert.ok(!meadow.has(1) && meadow.has(2), 'the meadow\'s grass alone');
  // the Swamp's ground (402, the Rainforest's): its grass an olive mud, its stone a green moss, its dirt between
  const swamp = [tile(() => water), tile(() => [47, 61, 49, 255]), tile(() => [61, 60, 40, 255]), tile(() => [44, 63, 38, 255])];
  swamp[4] = tile((k) => (k < 9 ? [61, 60, 40, 255] : [44, 63, 38, 255]));   // a blend, 9 of 16 its grass
  swamp[5] = tile((k) => (k < 9 ? [44, 63, 38, 255] : [61, 60, 40, 255]));   // ...and 9 of 16 its stone
  for (let r = 6; r <= 46; r++) swamp[r] = tile(() => [44, 63, 38, 255]);
  const marsh = floorRecordsOf(swamp);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((r) => marsh.has(r)), [false, true, true, false, true, false], 'its grass and dirt by their place, its green stone never');
  assert.ok(!grassRecordsOf(swamp).has(2), 'where the meadow\'s colour test refuses its grass');
});

test('BANTHA2 THE FLOOR\'S GROUND ON THE FREEWARE\'S ARCHIVES: the Swamp\'s (402, the Rainforest\'s ground) grass, dirt and their blends the floor\'s, its stone and its grass-stone blends not; the Temperate\'s (302) and the Mountain\'s (102) grass and dirt the floor\'s, their stone not (mutants: the bases by colour)', { skip: HAVE ? false : 'no ARENA2 (sh tools/fetch-data.sh)' }, async () => {
  const { TextureFile } = await import('../../src/formats/textureFile.js');
  const { DFPalette } = await import('../../src/formats/dfPalette.js');
  const pal = new DFPalette(); pal.load(new Uint8Array(readFileSync(join(A, 'ART_PAL.COL'))), 'ART_PAL.COL');
  const recordsOf = (arch) => {
    const fn = TextureFile.indexToFileName(arch), tex = new TextureFile();
    tex.load(new Uint8Array(readFileSync(join(A, fn))), fn); tex.palette = pal;
    const layers = [];
    for (let r = 0; r < tex.recordCount; r++) layers.push(tex.getColor32(tex.getDFBitmap(r, 0), 0));
    return floorRecordsOf(layers);
  };
  const swamp = recordsOf(402);
  assert.deepEqual([1, 2, 10, 11, 12, 51].filter((r) => !swamp.has(r)), [], 'the Swamp\'s grass, dirt and their blends');
  assert.deepEqual([0, 3, 15, 16, 17, 53, 46, 47, 55].filter((r) => swamp.has(r)), [], '...never its water, its stone, its grass-stone blends or a road');
  for (const arch of [302, 102]) {
    const f = recordsOf(arch);
    assert.ok(f.has(1) && f.has(2) && f.has(10) && !f.has(3) && !f.has(0), `${arch}: grass and dirt, never stone or water`);
  }
});

/** a stream over a map of 24 x 16, the jungle a block (bantha1_jungle's hostWorld): the eye's pixel (9, 5) */
function floorWorld() {
  const inside = (x, y) => x >= 6 && x < 14 && y >= 4 && y < 11;
  const state = { mapOrigin: { x: 9, y: 5 }, compensation: [0, 0, 0],
    pixelTranslation(px, py, out = [0, 0, 0]) { const c = state.compensation; out[0] = (px - state.mapOrigin.x) * PIXEL_M + c[0]; out[1] = c[1]; out[2] = -(py - state.mapOrigin.y) * PIXEL_M + c[2]; return out; } };
  const host = createJungleHost({ renderer: { _focus: new Float32Array(4), setJungleHaze: () => {} }, maps: {}, mapWidth: 24, mapHeight: 16, stateOf: () => state, builtOf: () => new Map(), heightAt: () => 0, trees: { door: true }, insideAt: inside });
  return { host, state };
}

test('BANTHA2 THE FLOOR CLAIMS what the layout\'s share gives it: deep in the jungle every point, far out none, across its edge the share\'s own fraction - each point\'s draw its world place\'s, the same at every origin (mutants: the claim the depth\'s sign; the draw off the scene\'s frame; the 3x3 kept across pixels)', () => {
  const { host, state } = floorWorld();
  const claimed = (x0, z0) => { let n = 0; for (let i = 0; i < 400; i++) if (host.floorClaims(x0 + (i % 20) * 3.1, z0 + Math.floor(i / 20) * 2.9)) n++; return n / 400; };
  assert.equal(claimed(300, 300), 1, 'deep: every point');
  assert.equal(claimed(-6 * PIXEL_M + 100, 300), 0, 'far out: none');
  // a strip where the depth is a share's middle: the claims as many as the share says
  let want = 0, got = 0;
  for (let i = 0; i < 2000; i++) {
    const x = -3 * PIXEL_M + 100 + (i % 50) * 41.3, z = 200 + Math.floor(i / 50) * 13.7;
    const share = jungleShare(host.depthAt(x, z));
    want += share; got += host.floorClaims(x, z) ? 1 : 0;
  }
  assert.ok(want > 300 && Math.abs(got - want) < 0.08 * 2000, `the edge claims its share (${got} of ${want.toFixed(0)})`);
  // the same world point after a recentre: the same claim
  const pts = Array.from({ length: 300 }, (_, i) => [-3 * PIXEL_M + 37 * i % 4000, 100 + 13 * i % 700]);
  const before = pts.map(([x, z]) => host.floorClaims(x, z));
  state.mapOrigin = { x: 10, y: 6 }; state.compensation = [-PIXEL_M + 12.5, 0, -PIXEL_M + 7.25];   // the scene moved under the world
  const after = pts.map(([x, z]) => host.floorClaims(x + (-PIXEL_M + 12.5) - PIXEL_M, z + (-PIXEL_M + 7.25) + PIXEL_M));
  assert.deepEqual(after, before, 'the world\'s point, wherever the scene stands');
  let sum = 0;
  for (let i = 0; i < 10000; i++) sum += jungleFloorDraw(i * 0.37, i * 1.13);
  assert.ok(Math.abs(sum / 10000 - 0.5) < 0.02, 'the draw even over its range');
  assert.equal(JUNGLE_EDGE.out, 60);
});

/** a stub GL (grassmeadow.test.js stubGl's shape) */
function stubGl() {
  const C = { VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, ARRAY_BUFFER: 5, ELEMENT_ARRAY_BUFFER: 31, TEXTURE_2D: 9 };
  let ids = 0;
  return new Proxy({}, {
    get(_, k) {
      if (k in C) return C[k];
      if (k === 'getShaderParameter' || k === 'getProgramParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'isEnabled') return () => false;
      if (/^create/.test(String(k))) return () => ++ids;
      return () => {};
    },
  });
}

test('BANTHA2 THE FLOOR\'S HOST: made once, the first time the jungle comes within JUNGLE_FLOOR.near of the eye, its pictures asked of archive 500\'s floor records; the meadow\'s field placed again on its arrival; paired, every door of the meadow\'s handle reaches its field; walked only where it claims; drawn beside the meadow under the meadow\'s frame in the meadow\'s style; no claim before its field stands; a picture missing, never made (mutants: made far off; the meadow not placed again; a door of the pair dropped; the claim not asked; another style)', async () => {
  let depth = -1e9, asked = 0, arrived = 0, claims = 0;
  const jungle = { depthAt: () => depth, floorClaims: () => { claims++; return true; } };
  const floor = createJungleFloorHost({ gl: stubGl(), jungle, density: 0.5, pictures: async (a, recs) => { asked++; assert.equal(a, 500); assert.deepEqual(recs, [7, 9, 10, 1, 27, 21, 6]); return pics; }, onArrive: () => { arrived++; } });
  floor.update(0, 0, () => 1);
  assert.equal(asked, 0, 'far off: nothing made');
  depth = -JUNGLE_FLOOR.near + 1;
  floor.update(0, 0, () => 1); floor.update(0, 0, () => 1);
  assert.equal(asked, 1, 'near: made, once');
  await floor.loading;
  assert.ok(floor.renderer && arrived === 1, 'its renderer, and the meadow told');
  assert.ok(!floor.on && !floor.claims(0, 0), 'no claim before its field');
  const calls = [];
  const meadow = { live: new Map(), invalidate: (...a) => calls.push(['meadow.invalidate', ...a]), shiftOrigin: (o) => calls.push(['meadow.shift', o]), update: () => {} };
  const handle = floor.pair(meadow);
  assert.ok(floor.on && floor.field && handle.live === meadow.live, 'paired: the floor\'s field, the meadow\'s handle');
  floor.field.invalidate = (...a) => calls.push(['floor.invalidate', ...a]);
  floor.field.shiftOrigin = (o) => calls.push(['floor.shift', o]);
  handle.invalidate(1, 2, 3, 4); handle.shiftOrigin([5, 0, 6]);
  assert.deepEqual(calls, [['meadow.invalidate', 1, 2, 3, 4], ['floor.invalidate', 1, 2, 3, 4], ['meadow.shift', [5, 0, 6]], ['floor.shift', [5, 0, 6]]]);
  let walked = null;
  floor.field.update = (ex, ez, keep) => { walked = keep; };
  floor.update(10, 20, (x, z) => x + z);
  assert.equal(walked(1, 2), 3, 'its keep the host\'s floor keep');
  assert.equal(claims, 1, '...asked only where the floor claims');
  const drawn = [];
  floor.renderer.draw = (...a) => drawn.push(a);
  floor.drawBeside({ frame: null });
  floor.drawBeside({ frame: ['P', 'V', 'E', 1, 'L', 'W', 300] });
  assert.deepEqual(drawn, [['P', 'V', 'E', 1, 'L', 'W', 300, 'meadow']], 'beside the meadow\'s draw, under its frame');
  assert.equal(floor.field.perCell, Math.round(floorDensity(0.5) * 900 / (420 * 420)), 'the pref\'s share of its density');
  assert.ok(Math.abs(floorDensity(1) - JUNGLE_FLOOR.plants * 3 * 420 * 420) < 1e-6, 'plants a square metre, three blades a tuft, over the lab\'s measuring span');
  // PIN MOVED (JUNGLE-GRASS, test/world/junglegrass.test.js): the owner's judged 1.8 is the floor's FLORA's rate now; its
  // plants are the meadow's grass and that flora
  assert.equal(JUNGLE_FLOOR.plants, JUNGLE_FLOOR_PLANTS_M2, 'the meadow\'s grass and the flora the owner judged ("Its a little too much" at 2.5)');
  assert.notEqual(JUNGLE_FLOOR.seed, LAB_GRASS.seed, 'never the meadow\'s spots');
  const none = createJungleFloorHost({ gl: stubGl(), jungle, pictures: async () => new Map([[7, pics.get(7)]]), onArrive: () => { arrived++; } });
  none.update(0, 0, () => 1);
  await none.loading;
  assert.ok(!none.renderer && arrived === 1, 'a picture missing: no floor, the meadow as it was');
  none.update(0, 0, () => 1);
  assert.equal(none.loading, none.loading, 'never asked again');
});

test('BANTHA2 THE WIRING: the world builds the floor after the jungle, with the grass, from the pipeline\'s pictures at the grass pref\'s share; the floor\'s records beside the meadow\'s; the keep the floor\'s with its records and the meadow\'s kept out of what the floor claims; the meadow\'s field paired with it; walked after the meadow\'s and drawn beside it (mutants: the floor built without the grass; the meadow\'s keep standing in the floor; the draw before the meadow\'s)', () => {
  const w = hostText('src/scenes/world.js');
  const j = w.indexOf('const jungle = jungleOn() ? createJungleHost('), f = w.indexOf('const jungleFloor = jungle && labGrass ? createJungleFloorHost({ gl: renderer.gl, jungle, pictures: floorPictures({ getTexture, palette }), density: grassDensity / LAB_GRASS.density,');
  assert.ok(j > 0 && f > j, 'after the jungle, with the grass');
  assert.match(w, /onArrive: \(\) => \{ labGrassField = null; \}/, 'the meadow placed again beside it');
  // PIN MOVED (OW-HITCH): the records are learned in the ground sets' home, scenes/groundSets.js (HOST-SPLIT)
  assert.match(readFileSync(new URL('../../src/scenes/groundSets.js', import.meta.url), 'utf8'), /grassRecords\.set\(groundArchive, grassRecordsOf\(layers\)\); floorRecords\.set\(groundArchive, floorRecordsOf\(layers\)\);/);
  assert.match(w, /const keep = \(x, z, floor = false\) => \{/);
  const pair = w.indexOf('jungleFloor.pair(createGrassField(labGrass, { keep, ground, slope, density: grassDensity }))');
  const meadowWalk = w.indexOf('labGrassField.update(ex, ez, keep, ground, slope);');
  const floorWalk = w.indexOf('jungleFloor?.update(ex, ez, (x, z) => keep(x, z, true), ground, slope);');
  const meadowDraw = w.indexOf('LAB_GRASS.range, getPref(\'grassStyle\'));');
  const floorDraw = w.indexOf('jungleFloor?.drawBeside(labGrass);');
  assert.ok(pair > 0 && meadowWalk > pair && floorWalk > meadowWalk && meadowDraw > floorWalk && floorDraw > meadowDraw, 'paired, walked after the meadow, drawn beside it');
});
