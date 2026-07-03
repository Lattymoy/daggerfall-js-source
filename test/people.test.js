import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { collectInteriorPeople } from '../src/characters/interiorPeople.js';
import { GLOBAL_SCALE } from '../src/world/meshReader.js';
import { BlocksFile } from '../src/formats/blocksFile.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

test('interior people: verbatim AddPeople position + data passthrough', () => {
  const recordData = {
    interior: {
      blockPeopleRecords: [
        { xPos: 100, yPos: 50, zPos: -200, textureArchive: 182, textureRecord: 3, factionID: 510, flags: 1 },
      ],
    },
  };
  const people = collectInteriorPeople(recordData);
  assert.equal(people.length, 1);
  const p = people[0];
  // (XPos, -YPos, ZPos) * GlobalScale - the raw position is the BASE.
  assert.equal(p.x, 100 * GLOBAL_SCALE);
  assert.equal(p.y, -50 * GLOBAL_SCALE);
  assert.equal(p.z, -200 * GLOBAL_SCALE);
  assert.equal(p.textureArchive, 182);
  assert.equal(p.textureRecord, 3);
  assert.equal(p.factionID, 510);
  assert.equal(p.flags, 1);
  assert.deepEqual([p.rawX, p.rawY, p.rawZ], [100, 50, -200]);
});

test('interior people: full corpus sweep', { skip: skipReal }, () => {
  const blocks = new BlocksFile();
  blocks.load(readFileSync(join(ARENA2, 'BLOCKS.BSA')));
  let interiors = 0;
  let totalPeople = 0;
  let withPeople = 0;
  const archives = new Set();
  let peopleInEmpty = 0;
  for (let b = 0; b < blocks.count; b++) {
    if (blocks.getBlockName(b).indexOf('.RMB') === -1) continue;
    const dfBlock = blocks.getBlock(b);
    for (const sub of dfBlock.rmbBlock.subRecords) {
      // Mirror the interior corpus condition: empty interiors (no 3d
      // records) never lay out; people there could never be reached.
      if (sub.interior.header.num3dObjectRecords === 0) {
        peopleInEmpty += collectInteriorPeople(sub).length;
        continue;
      }
      interiors++;
      const people = collectInteriorPeople(sub);
      totalPeople += people.length;
      if (people.length) withPeople++;
      for (const p of people) {
        archives.add(p.textureArchive);
        // Every person mirrors its raw record exactly.
        assert.equal(p.x, p.rawX * GLOBAL_SCALE);
        assert.equal(p.y, -p.rawY * GLOBAL_SCALE);
        assert.equal(p.z, p.rawZ * GLOBAL_SCALE);
        assert.ok(Number.isInteger(p.factionID));
        assert.ok(p.textureRecord >= 0 && p.textureRecord < 128);
      }
    }
  }
  // Corpus invariants (pinned from a full ARENA2 sweep at C1):
  // 6832 interiors, people in a large fraction of them, classic
  // townsfolk archives only (175-184 range + guild/temple sets).
  assert.equal(interiors, 6832);
  // Pinned from the full ARENA2 sweep at C1.
  assert.equal(totalPeople, 14174);
  assert.equal(withPeople, 6724);
  assert.equal(peopleInEmpty, 0);
  assert.deepEqual([...archives].sort((a, b) => a - b), [176, 177, 181, 182, 183, 184]);
  console.log(`people corpus: ${totalPeople} people across ${withPeople}/${interiors} interiors, ${peopleInEmpty} in empty records, archives [${[...archives].sort((a, b) => a - b)}]`);
});
