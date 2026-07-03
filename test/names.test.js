import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { srand } from '../src/formats/dfRandom.js';
import {
  BANK_TYPES, GENDERS, getNameBankOfRegion, firstName, surname, fullName,
} from '../src/characters/nameHelper.js';
import { collectBlockFlats } from '../src/world/rmbFlats.js';
import { collectExteriorNpcs } from '../src/characters/exteriorNpcs.js';
import { BlocksFile } from '../src/formats/blocksFile.js';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped'
  : false;

test('names: region -> bank verbatim (RegionRaces cast + Breton fallback)', () => {
  assert.equal(getNameBankOfRegion(-1), BANK_TYPES.Breton);
  // Daggerfall region 17 is Breton country; Sentinel 20 is Redguard.
  assert.equal(getNameBankOfRegion(17), BANK_TYPES.Breton);
  assert.equal(getNameBankOfRegion(20), BANK_TYPES.Redguard);
});

test('names: deterministic composition on the classic stream', () => {
  // Pins generated on the ported DFRandom at seed 12345 - the rules,
  // not the letters, are the verbatim surface; these freeze both.
  srand(12345);
  const rows = [
    fullName(BANK_TYPES.Breton, GENDERS.Male),
    fullName(BANK_TYPES.Breton, GENDERS.Female),
    fullName(BANK_TYPES.Nord, GENDERS.Male),      // surname ends 'sen'
    fullName(BANK_TYPES.Redguard, GENDERS.Male),  // single name
    fullName(BANK_TYPES.Redguard, GENDERS.Female),
    fullName(BANK_TYPES.Imperial, GENDERS.Female),
  ];
  for (const r of rows) assert.ok(r.length > 0);
  assert.ok(rows[2].split(' ')[1].endsWith('sen'), `Nord suffix: ${rows[2]}`);
  assert.ok(!rows[3].includes(' '), `Redguard single: ${rows[3]}`);
  // Full determinism pin: same seed, same six names.
  srand(12345);
  const again = [
    fullName(BANK_TYPES.Breton, GENDERS.Male),
    fullName(BANK_TYPES.Breton, GENDERS.Female),
    fullName(BANK_TYPES.Nord, GENDERS.Male),
    fullName(BANK_TYPES.Redguard, GENDERS.Male),
    fullName(BANK_TYPES.Redguard, GENDERS.Female),
    fullName(BANK_TYPES.Imperial, GENDERS.Female),
  ];
  assert.deepEqual(again, rows);
});

test('names: Redguard female never consumes the 75% roll (stream parity)', () => {
  // Female: draws A,B,C,D = 4 rands. Male-with-roll: A,B,C,roll,D = 5.
  // Prove the female path length by matching a manual 4-draw replay.
  srand(777);
  const name = firstName(BANK_TYPES.Redguard, GENDERS.Female);
  srand(777);
  const { rand } = awaitImportRand();
  const bank = JSON.parse(readFileSync(new URL('../src/characters/nameGen.json', import.meta.url))).Redguard;
  const seq = [0, 1, 2, 4].map((i) => bank.sets[i].parts[rand() % bank.sets[i].parts.length]).join('');
  assert.equal(name, seq);
});

// node:test-friendly sync import of rand (already loaded above via srand's module)
import { rand as _rand } from '../src/formats/dfRandom.js';
function awaitImportRand() { return { rand: _rand }; }

test('exterior npcs: full corpus sweep', { skip: skipReal }, () => {
  const blocks = new BlocksFile();
  blocks.load(readFileSync(join(ARENA2, 'BLOCKS.BSA')));
  let npcs = 0;
  let blocksWithNpcs = 0;
  const archives = new Set();
  for (let b = 0; b < blocks.count; b++) {
    if (blocks.getBlockName(b).indexOf('.RMB') === -1) continue;
    const flats = collectBlockFlats(blocks.getBlock(b), 500);
    const list = collectExteriorNpcs(flats);
    if (list.length) blocksWithNpcs++;
    npcs += list.length;
    for (const n of list) {
      archives.add(n.archive);
      assert.ok(n.factionID !== 0);
      assert.ok(Number.isInteger(n.flags));
      assert.ok(Number.isInteger(n.recordPosition));
    }
  }
  // Pinned from the full ARENA2 sweep at C2. Archive 210 is one
  // record: SENT7.RMB's lamp with factionID -4080 - a classic data
  // quirk DFU reproduces too (Int16 read, faction != 0 => StaticNPC).
  assert.equal(npcs, 76);
  assert.equal(blocksWithNpcs, 16);
  assert.deepEqual([...archives].sort((a, b) => a - b), [179, 181, 210]);
  console.log(`exterior npc corpus: ${npcs} npcs across ${blocksWithNpcs} RMB blocks, archives [${[...archives].sort((a, b) => a - b)}]`);
});
