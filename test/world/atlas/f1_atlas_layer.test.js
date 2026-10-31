// FOUNDATION F1 (bible/03-World/Foundation-Arc.md): A PLACE IS DATA - the proposal's pilot, on a layer the game already
// carries. Roleplay & Realism's quest line adds a keep to the Wrothgarian Mountains as two DFU world-data files (a
// location and its block - OWN-WORK3: our own, systems/roleplayRealism/rrWorld.js). Through the door the keep is a bundle
// like any of MAPS.BSA's, and a layer that names a block nothing serves is found when the atlas is filled.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createAtlas } from '../../../src/world/atlas/atlas.js';
import { servedBlockOf } from '../../../src/world/atlas/atlasServed.js';
import { placeOfRow } from '../../../src/world/worldWide/worldPlaces.js';
import { bayPlaceRows } from '../../../src/world/worldWide/bayPlaces.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(join(ARENA2 ?? '', 'BLOCKS.BSA')) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;
const FORT_FILE = 'locationnew-RRfort01-16.json';
const FORT_BLOCK = 'RRFORT01.RMB';

test('F1 with ARENA2, a layer\'s place: the keep a world-data file adds is a bundle in region 16 whose block the layer serves; the same location served without its block is an unresolved reference at the fill (mutant: the resolve skipped)', { skip: skipReal }, async () => {
  const { BlocksFile } = await import('../../../src/formats/blocksFile.js');
  const { MapsFile } = await import('../../../src/formats/mapsFile.js');
  const { installWorldDataReplacement, bindWorldDataBlocks, registerWorldDataAsset } = await import('../../../src/formats/worldData/worldDataReplacement.js');
  const { setValue } = await import('../../../src/systems/settings/settings.js');
  const { rrKeepLocationJson, rrKeepBlockJson, RR_KEEP_NAME } = await import('../../../src/systems/roleplayRealism/rrWorld.js');
  const bytes = (n) => new Uint8Array(readFileSync(join(/** @type {string} */ (ARENA2), n)));
  const blocks = new BlocksFile(); blocks.load(bytes('BLOCKS.BSA'));
  installWorldDataReplacement(); bindWorldDataBlocks(blocks);
  setValue('Enhancements', 'AssetInjection', 'True');
  const fortOf = () => {
    const maps = new MapsFile(); maps.load(bytes('MAPS.BSA'), bytes('CLIMATE.PAK'), bytes('POLITIC.PAK')); maps.autoDiscard = false;
    const region = maps.getRegion(16);
    for (let l = maps.baseLocationCount(16); l < region.locationCount; l++) {
      const loc = maps.getLocation(16, l);
      if (loc?.name === RR_KEEP_NAME) return loc;
    }
    return null;
  };
  const bundleOf = (loc) => {
    const atlas = createAtlas({ resolveBlock: servedBlockOf(blocks) });
    const b = atlas.add(placeOfRow(bayPlaceRows([loc])[0], 'rr'), loc);
    return { atlas, b };
  };

  registerWorldDataAsset(FORT_FILE, rrKeepLocationJson());   // (the door keeps a region's additions once read: the layer stands before the first read)
  const broken = bundleOf(fortOf());
  assert.deepEqual(broken.atlas.problems(), [{ place: broken.b.id, part: 'exterior', name: FORT_BLOCK, why: 'unresolved' }], 'the location served, its block not: found at the fill');

  registerWorldDataAsset(`${FORT_BLOCK}.json`, rrKeepBlockJson(blocks));
  const { atlas, b } = bundleOf(fortOf());
  assert.deepEqual(atlas.problems(), []);
  assert.deepEqual([b.place.name, b.place.region, b.exterior.w, b.exterior.h], ['Grayhold', 16, 1, 1]);
  assert.deepEqual([...atlas.parts('exterior')][0].blocks, [FORT_BLOCK]);
  assert.deepEqual(atlas.usersOf(FORT_BLOCK), [b.id]);
});
