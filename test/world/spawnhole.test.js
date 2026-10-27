// SPAWN-HOLE (AUDIT LEFT IN THE BAY A1, bible/06-Systems/Systems-Arc.md SPAWN-HOLE): online with the land past the Bay, the
// pixel build asks the ground's place of every pixel (scenes/pixelBuild.js spawnGroundPlace.groundLocationAt), and where
// the spawn roll stood a dungeon on dry, empty land the host cloned it - and the clone's id (world/spawnedDungeons.js
// spawnedMapId) threw for a pixel past the Bay. The build failed, BUILD-RETRY asked again, and the pixel never stood: no
// ground and no collider. The party walk's far spawn (scenes/world.js tvLocationAt, through spawnAt) threw the same way.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { CLIMATES } from '../../src/formats/mapsTables.js';
import { createSpawnGroundPlace } from '../../src/world/spawnGroundPlace.js';
import { spawnsDungeon, spawnedMapId, synthesizeDungeonLocation, isEliteSpawn, pickTemplate, WORLD_SALT } from '../../src/world/spawnedDungeons.js';
import { worldLaneMapId, SPAWN_WORLD_LANE } from '../../src/world/worldWide/worldLanes.js';

/** A one-block dungeon, the shape spawnTemplates admits (a real one's rows, trimmed to what the clone reads). */
const TEMPLATE = Object.freeze({
  name: 'Old Crypt', regionIndex: 17, regionName: 'Daggerfall', hasDungeon: true,
  mapTableData: { mapId: 0x00123456, locationType: 10 },
  exterior: { exteriorData: { width: 1, height: 1, locationId: 0x123456 } },
  dungeon: { blocks: [{ blockName: 'B0000001.RDB' }], recordElement: { header: { locationId: 0x123456 } } },
});

/** The law as the world host makes it, its clone the host's own (scenes/world.js _spawnCloneAt: the template the hash
 *  picks, dressed as where it stands - the real producer, synthesizeDungeonLocation, never a hand-made row). */
function hostLaw({ regionAt = () => 17 } = {}) {
  let threw = 0;
  const cloneAt = (px, py) => {
    const template = pickTemplate([TEMPLATE], WORLD_SALT, px, py);
    try {
      return synthesizeDungeonLocation(template, { salt: WORLD_SALT, px, py, where: { regionIndex: regionAt(px, py) }, elite: isEliteSpawn(WORLD_SALT, px, py) });
    } catch (e) { threw += 1; throw e; }
  };
  const law = createSpawnGroundPlace({
    maps: { getClimateIndex: () => CLIMATES.Woodlands }, online: true, etherSea: false, plateauDry: () => true,
    terrainGen: { roads: () => null }, cloneAt, spawnGone: () => false, zoneMask: () => null,
  });
  return { law, threw: () => threw };
}

/** Every pixel of a box the roll stands a spawn on. */
function rolled(x0, y0, w, h) {
  const out = [];
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (spawnsDungeon(WORLD_SALT, x, y)) out.push([x, y]);
  return out;
}

// PIN MOVED (SPAWN-WORLD, the fix's next commit): the guard SPAWN-HOLE stood was the stop-gap - past the Bay the spawn now
// stands under its own id, the world's spawn lane (world/worldWide/worldLanes.js), so the pin is that the build's ask
// answers, and answers the spawn
test('SPAWN-HOLE: past the Bay the ground\'s place never throws - a pixel the roll stands a spawn on builds, its ground the spawn\'s, under its world id - and the Bay\'s spawns stand as they did (mutants: the world lane gone from spawnedMapId)', () => {
  const { law, threw } = hostLaw();
  const past = rolled(2200, -380, 40, 20);   // Skyrim, about Windhelm's row
  assert.ok(past.length > 100, `the roll stands spawns past the Bay (${past.length})`);
  const asked = past.map(([x, y]) => { try { return law.groundLocationAt(x, y, null)?.mapTableData?.mapId; } catch (e) { return `threw: ${e.message}`; } });
  assert.deepEqual(asked, past.map(([x, y]) => worldLaneMapId(SPAWN_WORLD_LANE, x, y)), 'every pixel past the Bay answers - none throws, so none is a hole - and its ground is its spawn\'s');
  assert.equal(threw(), 0, 'the clone never throws past the Bay');
  assert.deepEqual(past.map(([x, y]) => law.spawnAt(x, y)?.mapTableData?.mapId), asked, 'nor by the Overworld\'s far walk (tvLocationAt, tvSpawnAt)');

  const bay = rolled(600, 130, 40, 20);
  const stood = bay.map(([x, y]) => law.groundLocationAt(x, y, null)?.mapTableData?.mapId);
  assert.deepEqual(stood, bay.map(([x, y]) => spawnedMapId(WORLD_SALT, x, y)), 'on the Bay each rolled pixel\'s ground is its spawn, under its own id, as before');
});

const ARENA2 = process.env.ARENA2_PATH;
const HAVE = !!ARENA2 && ['MAPS.BSA', 'CLIMATE.PAK', 'POLITIC.PAK', 'WOODS.WLD', 'TMAP00I0.IMG', 'ART_PAL.COL'].every((f) => existsSync(join(ARENA2, f)));
test('SPAWN-HOLE with ARENA2: the audit\'s box of Skyrim over the player\'s own maps, trace and woods - 800 pixels asked, 39 threw; now none, and those 39 stand their spawns (SPAWN-WORLD) - and the Bay\'s box the same answers', { skip: HAVE ? false : 'ARENA2_PATH not set' }, async () => {
  const bytes = (n) => new Uint8Array(readFileSync(join(ARENA2, n)));
  const { DFPalette } = await import('../../src/formats/dfPalette.js');
  const { preloadTamrielTrace } = await import('../../src/ui/tamrielTrace.js');
  const { setTamrielTrace } = await import('../../src/world/tamriel/tamrielLand.js');
  const { setTamrielFit } = await import('../../src/world/tamriel/tamrielFrame.js');
  const { MapsFile } = await import('../../src/formats/mapsFile.js');
  const { WoodsFile } = await import('../../src/formats/woodsFile.js');
  const { groundMaps, groundWoods } = await import('../../src/world/tamriel/tamrielGround.js');
  const { createSpawnGround, spawnTemplates } = await import('../../src/world/spawnedDungeons.js');
  const { REGION_NAMES } = await import('../../src/formats/mapsTables.js');
  const pal = new DFPalette(); pal.load(bytes('ART_PAL.COL'), 'ART_PAL.COL');
  setTamrielTrace(await preloadTamrielTrace({ fetchBytes: async (n) => bytes(n), palette: pal, indexedDBRef: null }));
  setTamrielFit({ ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 });
  try {
    const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK'));
    groundMaps(maps);
    const raw = new WoodsFile(); raw.load(bytes('WOODS.WLD'));
    const woods = groundWoods(raw);
    const rows = [];
    for (let r = 0; r < maps.regionCount; r++) { if (!maps.getRegion(r)) continue; for (let l = 0; l < maps.baseLocationCount(r); l++) { const loc = maps.getLocation(r, l); if (loc) rows.push(loc); } }
    const templates = spawnTemplates(rows);
    const cloneAt = (px, py) => {
      const regionIndex = maps.getRegionIndexAt(px, py);
      return synthesizeDungeonLocation(pickTemplate(templates, WORLD_SALT, px, py), { salt: WORLD_SALT, px, py, where: { regionIndex, regionName: REGION_NAMES[regionIndex], politic: maps.getPoliticIndex(px, py), climate: {} }, elite: isEliteSpawn(WORLD_SALT, px, py) });
    };
    const law = createSpawnGroundPlace({ maps, online: true, etherSea: false, plateauDry: createSpawnGround(woods), terrainGen: { roads: () => null }, cloneAt, spawnGone: () => false, zoneMask: () => null });
    const ask = (x0, y0) => {
      let threw = 0, stood = 0;
      for (let y = y0; y < y0 + 20; y++) for (let x = x0; x < x0 + 40; x++) { try { if (law.groundLocationAt(x, y, null)) stood += 1; } catch { threw += 1; } }
      return { threw, stood };
    };
    assert.deepEqual(ask(2200, -380), { threw: 0, stood: 39 }, 'Skyrim: no pixel throws, so every one builds - and the 39 the audit counted shape their spawns\' ground (PIN MOVED, SPAWN-WORLD: none stood under SPAWN-HOLE\'s guard)');
    const bay = ask(600, 130);
    assert.equal(bay.threw, 0, 'the Bay: none throws');
    assert.equal(bay.stood, 14, 'and its box stands the 14 spawns the audit counted');
  } finally { setTamrielTrace(null); setTamrielFit(null); }
});
