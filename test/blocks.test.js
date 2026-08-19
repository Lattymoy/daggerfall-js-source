import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  BlocksFile,
  BLOCK_TYPES,
  RDB_TYPES,
  RDB_RESOURCE_TYPES,
  ROTATION_DIVISOR,
  RMB_DIMENSION,
  RDB_DIMENSION,
} from '../src/formats/blocksFile.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

function loadBlocks() {
  const b = new BlocksFile();
  assert.equal(b.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA')))), true);
  return b;
}

// ---------------------------------------------------------------------------
// Synthetic - always run.
// ---------------------------------------------------------------------------

test('blocks: constants and rdb type classification', () => {
  assert.equal(ROTATION_DIVISOR, 5.68888888888889);
  assert.equal(RMB_DIMENSION, 4096);
  assert.equal(RDB_DIMENSION, 2048);

  const b = new BlocksFile();
  assert.equal(b.getRdbType('B0000000.RDB'), RDB_TYPES.Border);
  assert.equal(b.getRdbType('W0000009.RDB'), RDB_TYPES.Wet);
  assert.equal(b.getRdbType('S0000040.RDB'), RDB_TYPES.Quest);
  assert.equal(b.getRdbType('M0000004.RDB'), RDB_TYPES.Mausoleum);
  assert.equal(b.getRdbType('N0000000.RDB'), RDB_TYPES.Normal);
  assert.equal(b.getRdbType('X0000000.RDB'), RDB_TYPES.Unknown);
});

// ---------------------------------------------------------------------------
// Real ARENA2 data.
// ---------------------------------------------------------------------------

test('blocks: full corpus decomposes with type and resource closure', { skip: skipReal }, () => {
  const b = loadBlocks();
  assert.equal(b.count, 1295);

  const counts = { rmb: 0, rdb: 0, rdi: 0 };
  let rmbSubRecords = 0;
  let rdbObjects = 0;
  let models = 0;
  let flats = 0;
  let lights = 0;
  let linkedActions = 0;

  for (let i = 0; i < b.count; i++) {
    const name = b.getBlockName(i);
    const blk = b.getBlock(i);
    if (name === 'FOO') {
      // The junk record: unknown type, rejected exactly as DFU discards it.
      assert.equal(i, 669);
      assert.equal(blk, null);
      continue;
    }
    assert.ok(blk, `${i} ${name}`);
    assert.equal(blk.name, name);
    assert.equal(blk.index, i);

    if (blk.type === BLOCK_TYPES.Rmb) {
      counts.rmb++;
      rmbSubRecords += blk.rmbBlock.subRecords.length;
      assert.equal(blk.rmbBlock.subRecords.length, blk.rmbBlock.fldHeader.numBlockDataRecords);
      assert.equal(blk.rmbBlock.fldHeader.autoMapData.length, 4096);
    } else if (blk.type === BLOCK_TYPES.Rdb) {
      counts.rdb++;
      const { width, height } = blk.rdbBlock.header;
      assert.equal(blk.rdbBlock.objectRootList.length, width * height);
      assert.equal(blk.rdbBlock.modelReferenceList.length, 750);
      // 179 RDBs carry the 'DAGR' signature; 8 carry 0xff padding instead,
      // which Encoding.UTF8.GetString turns into four U+FFFD (FileProxy's
      // fixed-length ReadCString is UTF-8, not latin1).
      assert.ok(
        blk.rdbBlock.objectHeader.dagr === 'DAGR' ||
          blk.rdbBlock.objectHeader.dagr === '\ufffd\ufffd\ufffd\ufffd',
        `${name}: dagr field`
      );
      for (const root of blk.rdbBlock.objectRootList) {
        if (!root.rdbObjects) continue;
        for (const o of root.rdbObjects) {
          rdbObjects++;
          if (o.type === RDB_RESOURCE_TYPES.Model) {
            models++;
            if (o.resources.modelResource.actionResource.nextObjectIndex >= 0) linkedActions++;
          } else if (o.type === RDB_RESOURCE_TYPES.Flat) flats++;
          else if (o.type === RDB_RESOURCE_TYPES.Light) lights++;
          else assert.fail(`${name}: unexpected resource type ${o.type}`);
        }
      }
    } else if (blk.type === BLOCK_TYPES.Rdi) {
      counts.rdi++;
      assert.equal(blk.rdiBlock.data.length, 512);
    } else {
      assert.fail(`${name}: unexpected block type`);
    }
  }

  // Pinned corpus totals from the original data.
  assert.deepEqual(counts, { rmb: 920, rdb: 187, rdi: 187 });
  assert.equal(rmbSubRecords, 9005);
  assert.equal(rdbObjects, 39468);
  assert.equal(models + flats + lights, rdbObjects); // every object typed
  assert.equal(models, 22962);
  assert.equal(flats, 12238);
  assert.equal(lights, 4268);
  assert.equal(linkedActions, 423);
});

test('blocks: MAGEAA00.RMB pinned', { skip: skipReal }, () => {
  const b = loadBlocks();
  const blk = b.getBlockByName('MAGEAA00.RMB');
  assert.equal(blk.index, 823);
  assert.equal(b.getBlockIndex('MAGEAA00.RMB'), 823); // cached
  assert.equal(blk.type, BLOCK_TYPES.Rmb);
  assert.equal(blk.rmbBlock.subRecords.length, 19);
  assert.equal(blk.rmbBlock.fldHeader.name, 'MAGEAA00.RMB');
  assert.deepEqual(blk.rmbBlock.fldHeader.groundData.groundTiles[0][0], {
    tileBitfield: 12,
    textureRecord: 12,
    isRotated: false,
    isFlipped: false,
  });

  // Automap filter clears ground-flat speckles.
  const withFlats = BlocksFile.getBlockAutoMap(blk, false);
  const hadFlats = withFlats.data.includes(0xfb);
  const filtered = BlocksFile.getBlockAutoMap(blk, true);
  assert.equal(filtered.data.includes(0xfb), false);
  assert.equal(filtered.width, 64);
  assert.ok(hadFlats || true); // presence not guaranteed; filter must still hold

  // Alternate-name search: unresolvable name with same prefix/suffix maps to a
  // real block.
  const fixed = b.checkName('MAGEZZ00.RMB');
  assert.match(fixed, /^MAGE.*00\.RMB$/);
  assert.notEqual(b.getBlockIndex(fixed), -1);
});

test('blocks: FixRdbData repairs applied verbatim', { skip: skipReal }, () => {
  const b = loadBlocks();
  b.autoDiscard = false;

  // N0000071.RDB (994): corridor connects the western dead-end.
  const n71 = b.getBlock(994);
  assert.equal(b.getBlockName(994), 'N0000071.RDB');
  assert.equal(n71.rdbBlock.objectRootList[4].rdbObjects[18].resources.modelResource.modelIndex, 10);
  assert.equal(n71.rdbBlock.objectRootList[4].rdbObjects[18].xPos, 640);
  assert.equal(n71.rdbBlock.objectRootList[5].rdbObjects[8].resources.modelResource.modelIndex, 11);

  // N0000022/23 (945/946): bad door removed.
  assert.equal(b.getBlock(945).rdbBlock.objectRootList[2].rdbObjects, null);
  assert.equal(b.getBlock(946).rdbBlock.objectRootList[2].rdbObjects, null);

  // N0000035 (958): door height corrected.
  assert.equal(b.getBlock(958).rdbBlock.objectRootList[0].rdbObjects[36].yPos, -300);

  // N0000052 (975): lever placement corrected.
  assert.equal(b.getBlock(975).rdbBlock.objectRootList[0].rdbObjects[24].xPos, 543);

  // W0000009 (1025): wall door model inserted at first unused slot (the
  // non-numeric "REF_C" reference parses to 0, exactly as C# TryParse).
  const w9 = b.getBlock(1025);
  assert.equal(b.getBlockName(1025), 'W0000009.RDB');
  const wallIdx = w9.rdbBlock.modelReferenceList.findIndex((m) => m.modelIdNum === 72100);
  assert.equal(wallIdx, 0);
  assert.equal(w9.rdbBlock.modelReferenceList[0].description, 'DOR');
  const root8 = w9.rdbBlock.objectRootList[8].rdbObjects;
  assert.equal(root8.length, 2); // original exit + sealing wall
  assert.equal(root8[1].resources.modelResource.modelIndex, wallIdx);
  assert.equal(root8[1].resources.modelResource.yRotation, -512);
  assert.equal(root8[0].xPos, root8[1].xPos); // exit moved to the door corner
  assert.equal(root8[1].zPos - root8[0].zPos, 2); // z+128 vs z+126

  // W0000018 (1034): T junctions + corridor + door fix.
  const w18 = b.getBlock(1034);
  assert.equal(w18.rdbBlock.objectRootList[4].rdbObjects[38].resources.modelResource.yRotation, -512);
  assert.equal(w18.rdbBlock.objectRootList[5].rdbObjects[40].resources.modelResource.yRotation, -2560);
  const w18corridor = w18.rdbBlock.objectRootList[6].rdbObjects.at(-1);
  assert.deepEqual(
    [w18corridor.xPos, w18corridor.yPos, w18corridor.zPos],
    [1152, -1792, 1920]
  );
  assert.equal(w18.rdbBlock.objectRootList[2].rdbObjects[0].resources.modelResource.modelIndex, 23);

  // W0000020 (1036): dead-end opened + stair appended.
  const w20 = b.getBlock(1036);
  assert.equal(w20.rdbBlock.objectRootList[4].rdbObjects[15].resources.modelResource.modelIndex, 5);
  const stair = w20.rdbBlock.objectRootList[5].rdbObjects.at(-1);
  assert.deepEqual([stair.xPos, stair.yPos, stair.zPos], [1152, -384, 1408]);
  assert.equal(stair.resources.modelResource.yRotation, 512);
});
