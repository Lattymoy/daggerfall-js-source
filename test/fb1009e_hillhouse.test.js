// FIELD BUGS 2026-10-09e - HILL-HOUSE, the Discord's "Missing quest location house - An Item On Loan": "The residence
// I'm supposed to go to is either missing or under a hill." - "deliver the Emerald to a third party in Gentle Redeemer of
// Akatosh, Guyunyyra Greenham of The Masterhouse Residence".
//
// The Gentle Redeemer of Akatosh (Wayrest, location 578) is a temple Beautiful Villages lays as its TEMPASD1, which
// stands its House2 #6 (model 159) inside two of the author's hills - the one walled door of both packs (AUDIT FB1005
// T3), carried as the pack's own until a quest seated its person there. The house is stood on the block's nearest clear
// ground at the author's facing, its record kept (src/world/curatedPlacements.js; measured by
// tools/curatedPlacements.mjs). `01-Overview/Field-Bugs-2026-10-09e.md`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { CURATED_PLACEMENTS, HILL_HOUSE_VENDOR, curateBlockPlacements, curatedPlacementsOf } from '../src/world/curatedPlacements.js';
import { blockFromJson } from '../src/formats/worldDataReplacement.js';

const ARENA2 = process.env.ARENA2_PATH;
const HAVE_ARENA2 = !!ARENA2 && ['BLOCKS.BSA', 'MAPS.BSA', 'ARCH3D.BSA'].every((f) => existsSync(join(ARENA2, f)));

/** A TEMPASD1 as the pack's JSON spells it, its eleven houses and its temple - the door's own converter makes the block. */
function packJson({ house6 = { XPos: 2816, ZPos: 2176, YRotation: 0 }, model = 159 } = {}) {
  const sub = (x, z, rot, id) => ({ XPos: x, ZPos: z, YRotation: rot, Exterior: { Block3dObjectRecords: [{ ModelIdNum: id, ModelId: String(id), XPos: 0, YPos: 1, ZPos: 0 }] }, Interior: {} });
  const subs = [
    sub(384, 512, 0, 154), sub(896, 256, -512, 159), sub(740, 3682, -767, 201), sub(3448, 322, -512, 202), sub(2527, 382, -1536, 201),
    sub(1508, 560, -1024, 200), sub(house6.XPos, house6.ZPos, house6.YRotation, model), sub(3008, 3762, -341, 201), sub(408, 1008, -1024, 156),
    sub(3699, 3318, -1023, 202), sub(232, 2920, 0, 136), sub(1858, 2302, 0, 362),
  ];
  const map = new Array(64 * 64).fill(0);
  for (let y = 30; y < 50; y++) for (let x = 20; x < 50; x++) map[y * 64 + x] = 0xfa;   // the hill's bytes, the author's
  return {
    Name: 'TEMPASD1.RMB', Type: 'Rmb',
    RmbBlock: {
      FldHeader: { BuildingDataList: subs.map((_, i) => ({ BuildingType: i === 11 ? 14 : 18, FactionId: i === 11 ? 26 : 0, Sector: i, NameSeed: 100 + i, Quality: 5 })), AutoMapData: map },
      SubRecords: subs, Misc3dObjectRecords: [], MiscFlatObjectRecords: [],
    },
  };
}

test('HILL-HOUSE: the one row - TEMPASD1\'s House2 #6, model 159, from the author\'s (2816, 2176) at its own facing to the block\'s nearest clear ground, 24.8 m east (3808, 2176); its automap cells; Beautiful Villages\' alone', () => {
  assert.equal(HILL_HOUSE_VENDOR, 'beautiful-villages');
  assert.deepEqual(CURATED_PLACEMENTS.map((r) => [r.vendor, r.block, r.record, r.model, { ...r.from }, { ...r.to }, [...r.automap]]), [
    ['beautiful-villages', 'TEMPASD1.RMB', 6, 159, { xPos: 2816, zPos: 2176, yRotation: 0 }, { xPos: 3808, zPos: 2176, yRotation: 0 }, [57, 29, 61, 38]],
  ]);
  assert.equal(curatedPlacementsOf('TEMPASD1.RMB', 'beautiful-villages').length, 1);
  assert.equal(curatedPlacementsOf('TEMPASD1.RMB', 'beautiful-cities').length, 0, 'another pack\'s block of the name keeps its own');
  assert.equal(curatedPlacementsOf('TEMPASD0.RMB', 'beautiful-villages').length, 0);
});

test('HILL-HOUSE: the block the door mints stands the house at its row - the subrecord and the FLD header moved, the record (so the building key) kept, the automap stamped with the house\'s type at its new footprint and the hill\'s bytes left; nothing else of the block moves', () => {
  const b = blockFromJson(packJson(), 3077, 'TEMPASD1.RMB');
  const before = JSON.parse(JSON.stringify(b.rmbBlock.subRecords));
  const mapBefore = Uint8Array.from(b.rmbBlock.fldHeader.autoMapData);
  assert.equal(curateBlockPlacements(b, 'beautiful-villages'), 1);
  const s = b.rmbBlock.subRecords[6];
  assert.deepEqual([s.xPos, s.zPos, s.yRotation], [3808, 2176, 0]);
  assert.deepEqual(b.rmbBlock.fldHeader.blockPositions[6], { unknown1: 0, unknown2: 0, xPos: 3808, zPos: 2176, yRotation: 0 });
  assert.equal(b.rmbBlock.subRecords.length, 12, 'the record keeps its index: (block x << 16) + (block y << 8) + 6 is the same house');
  assert.equal(b.rmbBlock.fldHeader.buildingDataList[6].buildingType, 18, 'a House2 still');
  for (let i = 0; i < 12; i++) if (i !== 6) assert.deepEqual(b.rmbBlock.subRecords[i], before[i], `record ${i} untouched`);
  assert.deepEqual(s.exterior, before[6].exterior, 'its models as the author laid them, round its own origin');
  const map = b.rmbBlock.fldHeader.autoMapData;
  let changed = 0;
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const i = y * 64 + x, inside = x >= 57 && x <= 61 && y >= 29 && y <= 38;
    if (inside) assert.equal(map[i], 19, `House2 + 1 at ${x},${y}`);
    else assert.equal(map[i], mapBefore[i], `${x},${y} as the author wrote it`);
    if (map[i] !== mapBefore[i]) changed++;
  }
  assert.equal(changed, 50, 'the footprint\'s five by ten cells');
  assert.equal(curateBlockPlacements(b, 'beautiful-villages'), 0, 'once: the moved record no longer stands where the row found it');
});

test('HILL-HOUSE: a row applies only to its pack\'s block with the record where the row found it - another pack, another block, a later pack that moved the house, a record of another model, Daggerfall\'s own block', () => {
  assert.equal(curateBlockPlacements(blockFromJson(packJson(), 1, 'TEMPASD1.RMB'), 'beautiful-cities'), 0);
  assert.equal(curateBlockPlacements(blockFromJson(packJson(), 1, 'TEMPASD0.RMB'), 'beautiful-villages'), 0);
  const moved = blockFromJson(packJson({ house6: { XPos: 3000, ZPos: 2176, YRotation: 0 } }), 1, 'TEMPASD1.RMB');
  assert.equal(curateBlockPlacements(moved, 'beautiful-villages'), 0);
  assert.equal(moved.rmbBlock.subRecords[6].xPos, 3000, 'the pack\'s own placement kept');
  assert.equal(curateBlockPlacements(blockFromJson(packJson({ model: 201 }), 1, 'TEMPASD1.RMB'), 'beautiful-villages'), 0);
  assert.equal(curateBlockPlacements(blockFromJson(packJson(), 1, 'TEMPASD1.RMB'), undefined), 0, 'a block BLOCKS.BSA serves names no pack');
  assert.equal(curateBlockPlacements(null, 'beautiful-villages'), 0);
});

test('HILL-HOUSE by source: the door applies it beside the temple summoners on both of its paths - a pinned town\'s block and the cached one - under the vendor that served the block', () => {
  const src = readFileSync(new URL('../src/formats/worldDataReplacement.js', import.meta.url), 'utf8');
  const both = src.match(/curateBlockPeople\(dfBlock, liveAsset\(blockReplacementFilename\(blockName, variant\)\)\?\.vendor\);[^\n]*\n(\s*\/\/[^\n]*\n)?\s*curateBlockPlacements\(dfBlock, liveAsset\(blockReplacementFilename\(blockName, variant\)\)\?\.vendor\);/g);
  assert.equal(both?.length, 2);
});

test('HILL-HOUSE with ARENA2: the committed row is the measurement on the player\'s data - the author\'s spot walled by the hills, the row\'s the nearest clear ground at the author\'s facing, its automap cells the footprint\'s - and the block the door mints stands the house there', { skip: HAVE_ARENA2 ? false : 'ARENA2_PATH not set' }, async () => {
  const { openTownData } = await import('../tools/townQuestMarkers.mjs');
  const { measurePlacements, placementContext, placementIssues } = await import('../tools/curatedPlacements.mjs');
  const data = await openTownData(ARENA2);
  const [m] = await measurePlacements(data, CURATED_PLACEMENTS);
  const r = CURATED_PLACEMENTS[0];
  assert.ok(m.authored.includes('a hill at the door') && m.authored.includes('a hill'), `the author's spot: ${m.authored}`);
  assert.deepEqual([m.block, m.record, m.model, m.from, m.to, m.automap], [r.block, r.record, r.model, { ...r.from }, { ...r.to }, [...r.automap]]);
  assert.equal(m.metres, 24.8);
  const ctx = placementContext(data, r.vendor, r.block, r.record);
  assert.deepEqual(placementIssues(ctx, r.to.xPos, r.to.zPos, r.to.yRotation), [], 'clear ground, a clear door');
  const { dfBlock } = data.packBlock(r.vendor, r.block);
  assert.equal(curateBlockPlacements(dfBlock, r.vendor), 1);
  assert.deepEqual([dfBlock.rmbBlock.subRecords[6].xPos, dfBlock.rmbBlock.subRecords[6].zPos], [3808, 2176]);
  assert.equal(dfBlock.rmbBlock.fldHeader.buildingDataList[6].buildingType, 18, 'the pack\'s House2 - the house a quest seats its person in');
});
