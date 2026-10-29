// FB1029 BRIDGE-ENDS (bible/01-Overview/bugs/Field-Bugs-2026-10-29.md; "Alinor bridge bug - missing part of the bridge on
// both sides"): RUMARE-WATER lets a shore capital's water vertices down a metre (world/terrain/capitalSea.js), so the
// river's bank tile slopes from the street to the waterline under each end of Alinor's bridges. Each end stands on an
// abutment over that tile, at the deck's own height, a step from the street.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ALINOR } from '../../src/world/capitalPlans.js';
import { buildAlinorBridges } from '../../src/world/capitalAlinor.js';
import { BLOCK_M } from '../../src/world/blockHash.js';
import { STEP_OFFSET } from '../../src/player/motor.js';
import { CAPITAL_LAND, CAPITAL_SEA } from '../../src/world/terrain/capitalSea.js';
import { MAX_TERRAIN_HEIGHT, STREAMING_TERRAIN_SCALE, HEIGHTMAP_DIMENSION } from '../../src/world/terrain/terrainSampler.js';

const TILE = BLOCK_M / 16, R = ALINOR.river, M = MAX_TERRAIN_HEIGHT * STREAMING_TERRAIN_SCALE;
/** Every height at which the vertical line through (x, z) meets the model's faces. */
function heightsAt(m, x, z) {
  const p = m.positions, ix = m.indices, out = [];
  for (let t = 0; t < ix.length; t += 3) {
    const [a, b, c] = [ix[t] * 3, ix[t + 1] * 3, ix[t + 2] * 3];
    const d = (p[b] - p[a]) * (p[c + 2] - p[a + 2]) - (p[c] - p[a]) * (p[b + 2] - p[a + 2]);
    if (Math.abs(d) < 1e-9) continue;   // a wall: no top
    const u = ((x - p[a]) * (p[c + 2] - p[a + 2]) - (p[c] - p[a]) * (z - p[a + 2])) / d;
    const v = ((p[b] - p[a]) * (z - p[a + 2]) - (x - p[a]) * (p[b + 2] - p[a + 2])) / d;
    if (u < -1e-9 || v < -1e-9 || u + v > 1 + 1e-9) continue;
    out.push(p[a + 1] + u * (p[b + 1] - p[a + 1]) + v * (p[c + 1] - p[a + 1]));
  }
  return out;
}
/** The highest face under `y` at (x, z), or -Infinity. */
const topUnder = (m, x, z, y) => Math.max(-Infinity, ...heightsAt(m, x, z).filter((h) => h <= y + 1e-6));
/** The walk over a bank's last tile and on to the deck, both ends: [z, how far in from the bank's edge]. */
const bankWalk = () => [0.2, 1.6, 3.2, 4.8, 6.2].flatMap((d) => [[R.z0 - TILE + d, d], [R.z1 + TILE - d, d]]);

test('FB1029 BRIDGE-ENDS Alinor\'s bridges: each end an abutment over the bank\'s last tile - its top a step over the street and level with the deck\'s end, across the deck\'s width, its parapets on (mutants: no abutment; one end alone; the abutment a tile short; no parapet on it)', () => {
  const br = buildAlinorBridges(), hw = ALINOR.bridgeW / 2;
  for (const x of ALINOR.bridges) {
    for (const xi of [x - hw + 1, x, x + hw - 1]) {
      for (const [z] of bankWalk()) {
        const top = topUnder(br, xi, z, 2);
        assert.ok(top > 0 && top <= STEP_OFFSET, `a step over the street at x ${xi.toFixed(1)}, z ${z.toFixed(1)}: ${top}`);
      }
      for (const z of [R.z0, R.z1]) assert.ok(Math.abs(topUnder(br, xi, z - 0.05, 2) - topUnder(br, xi, z + 0.05, 2)) < 0.05, `the deck meets its abutment at z ${z}`);
    }
    for (const s of [1, -1]) for (const [z] of bankWalk()) assert.ok(topUnder(br, x + s * (hw - 0.3), z, 3) > 1, `a parapet on the abutment at z ${z.toFixed(1)}`);
  }
});

const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['TMAP00I0.IMG', 'TAMRIEL2.IMG', 'ART_PAL.COL', 'WOODS.WLD', 'MAPS.BSA', 'BLOCKS.BSA', 'CLIMATE.PAK', 'POLITIC.PAK'].every((f) => existsSync(join(ARENA2, f)));

test('FB1029 BRIDGE-ENDS (ARENA2): on the player\'s own files Alinor\'s bank tile slopes to the river\'s waterline under each bridge end, and the abutment covers it - never more than a step from the street, never under the ground, on cells its bank blocks\' automaps hold nothing on', { skip: HAVE ? false : 'ARENA2_PATH not set (sh tools/fetch-data.sh)' }, async () => {
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  globalThis.atob ??= (s) => Buffer.from(s, 'base64').toString('binary');
  const { DFPalette } = await import('../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../src/ui/tamrielTrace.js');
  const { MapsFile } = await import('../../src/formats/mapsFile.js');
  const { BlocksFile } = await import('../../src/formats/blocksFile.js');
  const { WoodsFile } = await import('../../src/formats/woodsFile.js');
  const { groundMaps, groundWoods } = await import('../../src/world/tamriel/tamrielGround.js');
  const { setTamrielTrace } = await import('../../src/world/tamriel/tamrielLand.js');
  const { setTamrielFit } = await import('../../src/world/tamriel/tamrielFrame.js');
  const wd = await import('../../src/formats/worldData/worldDataReplacement.js');
  const tc = await import('../../src/world/tamrielCapitals.js');
  const { installCapitals } = await import('../../src/world/capitalModels.js');
  const { isMainStoryDungeon } = await import('../../src/world/dungeon/dungeonTextures.js');
  const { setLocationTiles } = await import('../../src/world/terrain/terrainTiles.js');
  const { generatePixelTerrain } = await import('../../src/world/terrain/terrainGen.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal, indexedDBRef: null }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
  const rows = [];
  for (let r = 0; r < maps.regionCount; r++) { if (!maps.getRegion(r)) continue; for (let l = 0; l < maps.baseLocationCount(r); l++) { const loc = maps.getLocation(r, l); if (loc) rows.push(loc); } }
  const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
  const woods = new WoodsFile(); woods.load(bytes('WOODS.WLD'));
  groundMaps(maps);
  wd.installWorldDataReplacement(); wd.bindWorldDataBlocks(blocks);
  installCapitals({ addTextures: () => 0 });
  const k = tc.CAPITALS.findIndex((c) => c.key === 'alinor'), cap = tc.CAPITALS[k], { px, py } = tc.capitalCentrePixel(k);
  const tm = new Uint8Array(16384), loc = tc.synthesizeCapitalLocation(tc.capitalOnPixel(px, py), { base: tc.capitalBase(rows, isMainStoryDungeon), names: tc.cityBlockNames(rows), blockOf: (nm) => blocks.getBlockByName(nm), px, py });
  const rect = setLocationTiles(loc, maps, blocks, tm);
  const g = generatePixelTerrain({ woods: groundWoods(woods), px, py, tilemap: tm, locationRect: rect, hasLocation: true, climateType: 0, flattenAt: loc.capital.flattenAt, bed: true });
  const H = HEIGHTMAP_DIMENSION, street = CAPITAL_LAND * M, origin = street + 0.05;   // the models stand on the flatten, 5 cm up (pixelBuild.js)
  /** The ground at the anchor's metres (x east, z south), metres over the street. */
  const groundAt = (x, z) => {
    const vx = cap.anchor[0] * 16 + x / TILE, vz = cap.anchor[1] * 16 + z / TILE, x0 = Math.floor(vx), z0 = Math.floor(vz), fx = vx - x0, fz = vz - z0;
    const h = (i, j) => g.samples[i * H + (H - 1 - j)] * M;
    return (h(x0, z0) * (1 - fx) * (1 - fz) + h(x0 + 1, z0) * fx * (1 - fz) + h(x0, z0 + 1) * (1 - fx) * fz + h(x0 + 1, z0 + 1) * fx * fz) - street;
  };
  const br = buildAlinorBridges(), drop = (CAPITAL_LAND - CAPITAL_SEA) * M;
  for (const x of ALINOR.bridges) {
    for (const z of [R.z0, R.z1]) assert.ok(Math.abs(groundAt(x, z) + drop) < 0.01, `the bank's edge at the waterline, x ${x} z ${z}: ${groundAt(x, z).toFixed(2)}`);
    for (const [z, d] of bankWalk()) {
      const ground = groundAt(x, z), top = origin - street + topUnder(br, x, z, 2);
      assert.ok(ground < -0.01 * d, `the bank tile slopes to the water at z ${z.toFixed(1)}: ${ground.toFixed(2)}`);
      assert.ok(top >= ground && top <= STEP_OFFSET, `the abutment a step over the street and over the ground at x ${x}, z ${z.toFixed(1)}: ${top.toFixed(2)} over ${ground.toFixed(2)}`);
    }
  }
  // the north abutments stand in Daggerfall's bank blocks' edge strip (AUDIT-TESA A6-3's PIN MOVED): on cells those blocks'
  // automaps hold nothing on - no house under them
  const names = loc.exterior.exteriorData.blockNames, [AX, AR] = cap.anchor, hw = ALINOR.bridgeW / 2;
  let read = 0;
  for (const x of ALINOR.bridges) {
    for (let ax = x - hw + 0.2; ax <= x + hw - 0.2; ax += 0.4) {
      for (let az = R.z0 - TILE + 0.05; az < R.z0; az += 0.4) {
        const cx = Math.floor(ax / BLOCK_M + AX), r = Math.floor(az / BLOCK_M + AR), name = names[(7 - r) * 8 + cx];
        if (!name || name.startsWith('CUST')) continue;
        const A = blocks.getBlockByName(name).rmbBlock.fldHeader.autoMapData, lx = ax - (cx - AX) * BLOCK_M, lz = az - (r - AR) * BLOCK_M;
        read++;
        assert.equal(A[Math.floor(lz / 1.6) * 64 + Math.floor(lx / 1.6)], 0, `${name}'s automap clear under the abutment at ${ax.toFixed(1)},${az.toFixed(1)}`);
      }
    }
  }
  assert.ok(read > 0, 'a Daggerfall block read under the north abutments');
});
