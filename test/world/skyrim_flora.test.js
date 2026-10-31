// @ts-check
// Skyrim's plant flats on the Lands recipes and the texture door.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SKYRIM_FLORA, SKYRIM_FLORA_ARCHIVE, SKYRIM_FLORA_PATHS, SKYRIM_FLORA_CARDS, SKYRIM_HANGING_RECORDS,
  skyrimCoverPicks, isSkyrimHangingRecord,
} from '../../src/world/tamriel/skyrimFlora.js';
import {
  registerSkyrimFloraArt, _resetSkyrimFloraArt,
} from '../../src/world/tamriel/skyrimFloraArt.js';
import { crossedPlantAt, hangingMossAt, isSkyrimMossRock } from '../../src/world/tamriel/skyrimFloraMesh.js';
import { MeshBuilder } from '../../src/world/detStandIns.js';
import { LANDS } from '../../src/world/tamriel/tamrielLands.js';
import { PSEUDO_ARCHIVES } from '../../src/world/eliteGates/pseudoArchives.js';
import { getNatureArchive, SEASON } from '../../src/world/climateSwaps.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

test('SKYRIM-FLORA catalog: 37 plants, four zones, every PNG on disk; archive registered', () => {
  assert.equal(SKYRIM_FLORA.length, 37);
  assert.equal(SKYRIM_FLORA_PATHS.length, 37);
  assert.equal(SKYRIM_FLORA_ARCHIVE, 38362);
  assert.deepEqual([...new Set(SKYRIM_FLORA.map((e) => e.zone))].sort(), ['frozenCoast', 'pinewood', 'reach', 'tundra']);
  for (const p of SKYRIM_FLORA_PATHS) assert.ok(existsSync(join(root, p)), p);
  const row = PSEUDO_ARCHIVES.find((r) => r.from === SKYRIM_FLORA_ARCHIVE);
  assert.ok(row && row.name === 'SKYRIM_FLORA_ARCHIVE');
});

test('SKYRIM-FLORA getNatureArchive keeps the stand-in (not rewrite to 504)', () => {
  assert.equal(getNatureArchive(SKYRIM_FLORA_ARCHIVE, SEASON.Summer), SKYRIM_FLORA_ARCHIVE);
  assert.equal(getNatureArchive(SKYRIM_FLORA_ARCHIVE, SEASON.Winter), SKYRIM_FLORA_ARCHIVE);
});

test('SKYRIM-FLORA HangingMoss is hang-only; cover skips it; meshes cross and drape', () => {
  assert.deepEqual([...SKYRIM_HANGING_RECORDS], [10, 11]);
  assert.ok(isSkyrimHangingRecord(10) && isSkyrimHangingRecord(11));
  assert.equal(skyrimCoverPicks('reach').some((p) => isSkyrimHangingRecord(p[1])), false);
  assert.ok(isSkyrimMossRock(510, 17) && !isSkyrimMossRock(510, 11));
  const mb = new MeshBuilder();
  crossedPlantAt(mb, [SKYRIM_FLORA_ARCHIVE, 0], 0, 0, 0, 1, 1, 0);
  hangingMossAt(mb, [SKYRIM_FLORA_ARCHIVE, 10], 0, 2, 0, 0.4, 1.2, 0);
  const mesh = mb.build();
  assert.equal(mesh.subMeshes.length, 2);
  // sheet = 12 verts a card; 3 crossed + 2 hang strips
  assert.equal(mesh.positions.length / 3, SKYRIM_FLORA_CARDS * 12 + 24);
});

test('SKYRIM-FLORA Lands cover names the pack; registration stands 37 cutout stand-ins', () => {
  const map = {
    skyrimPinewood: 'pinewood',
    skyrimReach: 'reach',
    skyrimFrozenCoast: 'frozenCoast',
    skyrimTundra: 'tundra',
  };
  for (const [key, zone] of Object.entries(map)) {
    const want = skyrimCoverPicks(zone).map((p) => p[1]);
    const got = LANDS[key].flora.cover.filter((p) => p[0] === SKYRIM_FLORA_ARCHIVE).map((p) => p[1]);
    assert.deepEqual(got.sort((a, b) => a - b), [...want].sort((a, b) => a - b), key);
    assert.equal(got.some((r) => isSkyrimHangingRecord(r)), false, key);
  }
  _resetSkyrimFloraArt();
  const records = [];
  const n = registerSkyrimFloraArt((entries) => {
    for (const e of entries) {
      assert.equal(e.archive, SKYRIM_FLORA_ARCHIVE);
      assert.equal(e.standIn, true);
      assert.equal(e.cutout, true);
      records.push(e.record);
    }
    return entries.length;
  });
  assert.equal(n, 37);
  assert.deepEqual(records, [...Array(37).keys()]);
});
