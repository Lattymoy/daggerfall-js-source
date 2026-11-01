// FB1028 YARDS Y2 (the owner: every yard where #1184 stood it; FB1028): past the Bay the
// yards read the town ground and the ring as #1184 drew them. Its own file: the sweep installs its own data (no colosseum
// stood), as 2036a509e's cells were measured, and test/world/fb1028_walls.test.js installs the game's. OWN-WORK3: on
// Daggerfall's own blocks the two move no yard past the Bay, so the ring is read off the yards' paths themselves.
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

test('FB1028 YARDS Y2 with ARENA2: past the Bay the yards on the ground and ring as #1184 drew them - nine walled templates\' every yard on the cells 2036a509e stands them on Daggerfall\'s own blocks, today\'s ring off their paths (mutant: today\'s ring on their ground)', { skip: skipReal, timeout: 1_800_000 }, async () => {
  const S = await import('../../tools/townBoardsSweep.mjs');
  const { setLocationTiles, townRoadRing } = await import('../../src/world/terrain/terrainTiles.js');
  const { generatePixelTerrain } = await import('../../src/world/terrain/terrainGen.js');
  const { layoutLocation } = await import('../../src/world/locationLayout.js');
  const { longitudeLatitudeToMapPixel } = await import('../../src/formats/mapsFile.js');
  const { shapeBefore } = await import('../../src/world/terrain/townBlendBefore.js');
  const base = {
    32: 'stable 312 186 1|transport 255 165 2|carpenter 254 129 2', 49: 'stable 88 120 0|transport 113 321 1|carpenter 94 300 2',
    81: 'stable 152 56 0|transport 273 256 2|carpenter 248 228 2', 160: 'stable 159 120 0|transport 169 264 1|carpenter 137 270 3',
    200: 'stable 152 56 0|transport 169 205 1|carpenter 176 234 1', 248: 'stable 94 184 0|transport 179 228 2|carpenter 188 275 0',
    280: 'stable 103 120 0|transport 192 86 3|carpenter 175 180 2', 304: 'stable 152 56 0|transport 119 163 1|carpenter 101 186 3',
    337: 'stable 280 184 0|transport 271 290 1|carpenter 264 270 3',
  };
  const sw = await S.openSweep(ARENA2);
  /** A template cloned and laid on its pixel, a road every way, as the game lays it - its wall made first. */
  const laid = (j) => {
    const loc = S.sweepClone(sw, 'city-state', j);
    assert.ok(walls.townWallOf(loc), `city-state #${j}: walled`);   // its wall made first, as the game reads it
    const p = longitudeLatitudeToMapPixel(loc.mapTableData.longitude, loc.mapTableData.latitude), tm = new Uint8Array(D * D), rect = setLocationTiles(loc, sw.maps, sw.blocks, tm);
    rect.shapeWas = shapeBefore(rect.shape, loc.mapTableData.mapId >>> 0);
    const roads = new Uint8Array(1000 * 500);
    if (p.x >= 0 && p.x < 1000 && p.y >= 0 && p.y < 500) roads[p.y * 1000 + p.x] = S.ROADS_EVERY_WAY;
    return { loc, t: generatePixelTerrain({ woods: sw.woodsOf(), px: p.x, py: p.y, tilemap: tm, locationRect: rect, hasLocation: true, climateType: 0, roads: { roads, tracks: new Uint8Array(1000 * 500), smooth: true } }) };
  };
  try {
    setTownWallPaths(() => ({ roads: S.ROADS_EVERY_WAY, tracks: 0, curved: true }));
    for (const [j, want] of Object.entries(base)) {
      const { loc, t } = laid(+j);
      const plan = (await S.sweepPlan(sw, loc, t.townGround, t.paths))?.plan ?? null;
      const g = ys.townGroundOf(layoutLocation(loc, sw.maps, sw.blocks, { enhanced: true, windmills: true }), {}, townWalkShut(loc, t.yardGround, t.yardPaths, true), { plan, fixed: null });
      const yards = [...ys.yardSitesOn(g), ...ys.craftYardSitesOn(g)].map(siteStr);
      for (const y of want.split('|')) assert.ok(yards.includes(y), `city-state #${j}: ${y} (${yards.join(', ')})`);
    }
    // today's ring off the yards' paths, as the host reads them, where it crosses their ground: 16 of the 407 templates,
    // the four it crosses most (44 to 77 tiles); every one of those tiles in today's paths
    for (const j of [5, 22, 350, 373]) {
      const { t } = laid(j), ring = townRoadRing(t.townGround), paths = t.yardPaths ?? t.paths;
      let on = 0, now = 0, kept = 0;
      for (let i = 0; i < ring.length; i++) if (ring[i] && t.yardGround[i]) { on++; if (t.paths[i]) now++; if (paths[i]) kept++; }
      assert.ok(on > 40 && now === on && kept === 0, `city-state #${j}: ${kept} of the ring's ${on} tiles on the yards' ground in their paths (${now} in today's)`);
    }
  } finally { setTownWallPaths(null); }
});
