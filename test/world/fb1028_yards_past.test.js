// FB1028 YARDS Y2 (the owner: every yard where #1184 stood it; bible/03-World/Town-Shapes.md FB1028): past the Bay the
// yards read the town ground and the ring as #1184 drew them. Its own file: the sweep installs its own data (no colosseum
// stood), as 2036a509e's cells were measured, and test/world/fb1028_walls.test.js installs the game's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { townWalkShut, setTownWallPaths } from '../../src/world/townWalls.js';
import * as walls from '../../src/world/townWalls.js';
import * as ys from '../../src/world/merchantYards/merchantYardSites.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !['BLOCKS.BSA', 'MAPS.BSA', 'ARCH3D.BSA', 'WOODS.WLD'].every((f) => existsSync(join(ARENA2 ?? '', f))) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;
const D = 128;
const siteStr = (q) => `${q.kind} ${q.gx} ${q.gy} ${q.turn}`;

test('FB1028 YARDS Y2 with ARENA2: past the Bay the yards on the ground and ring as #1184 drew them - nine walled templates whose yards the new mask and ring moved stand on 2036a509e\'s cells (mutants: the yards on today\'s mask; today\'s ring on their ground)', { skip: skipReal, timeout: 1_800_000 }, async () => {
  const S = await import('../../tools/townBoardsSweep.mjs');
  const { setLocationTiles } = await import('../../src/world/terrain/terrainTiles.js');
  const { generatePixelTerrain } = await import('../../src/world/terrain/terrainGen.js');
  const { layoutLocation } = await import('../../src/world/locationLayout.js');
  const { longitudeLatitudeToMapPixel } = await import('../../src/formats/mapsFile.js');
  const { shapeBefore } = await import('../../src/world/terrain/townBlendBefore.js');
  const base = {
    32: 'stable 152 120 0', 49: 'stable 186 180 0|transport 216 180 0', 81: 'stable 220 56 0', 160: 'transport 128 180 1', 200: 'stable 176 120 0',
    248: 'stable 123 84 0', 280: 'transport 54 135 1', 304: 'stable 314 84 0', 337: 'stable 184 37 1',
  };
  const sw = await S.openSweep(ARENA2);
  try {
    setTownWallPaths(() => ({ roads: S.ROADS_EVERY_WAY, tracks: 0, curved: true }));
    for (const [j, want] of Object.entries(base)) {
      const loc = S.sweepClone(sw, 'city-state', +j);
      assert.ok(walls.townWallOf(loc), `city-state #${j}: walled`);   // its wall made first, as the game reads it
      const p = longitudeLatitudeToMapPixel(loc.mapTableData.longitude, loc.mapTableData.latitude), tm = new Uint8Array(D * D), rect = setLocationTiles(loc, sw.maps, sw.blocks, tm);
      rect.shapeWas = shapeBefore(rect.shape, loc.mapTableData.mapId >>> 0);
      const roads = new Uint8Array(1000 * 500);
      if (p.x >= 0 && p.x < 1000 && p.y >= 0 && p.y < 500) roads[p.y * 1000 + p.x] = S.ROADS_EVERY_WAY;
      const t = generatePixelTerrain({ woods: sw.woodsOf(), px: p.x, py: p.y, tilemap: tm, locationRect: rect, hasLocation: true, climateType: 0, roads: { roads, tracks: new Uint8Array(1000 * 500), smooth: true } });
      const plan = (await S.sweepPlan(sw, loc, t.townGround, t.paths))?.plan ?? null;
      const g = ys.townGroundOf(layoutLocation(loc, sw.maps, sw.blocks, { enhanced: true, windmills: true }), {}, townWalkShut(loc, t.yardGround, t.yardPaths, true), { plan, fixed: null });
      const yards = [...ys.yardSitesOn(g), ...ys.craftYardSitesOn(g)].map(siteStr);
      for (const y of want.split('|')) assert.ok(yards.includes(y), `city-state #${j}: ${y} (${yards.join(', ')})`);
    }
  } finally { setTownWallPaths(null); }
});
