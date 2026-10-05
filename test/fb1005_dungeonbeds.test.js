// FIELD BUGS 2026-10-05 DUNGEON-BEDS (Discord, Izex, "Dungeon Beds (Sleeping)": "Beds in dungeons should count as beds
// so I can rest in a dungeon" - a four-poster beside them and "Find a fire or a bed to rest." [Loiter] [Cancel]).
//
// REST1 made a rest online an act at a rest point, and the dungeon host's point was a fire alone (camps.restPointAt):
// the Rest-Arc's "a bed" was written for the rooms DFU lets you rest in (a rented room, an owned house, a ship) and the
// dungeon's beds were never named - an omission, not a rule (Roleplay-Realism.md's AUDIT-RR "beds only in buildings"
// was harmless while a dungeon rest needed no point). Measured on the player's data through layoutRdbBlock: 108 of
// Roleplay Realism's three bed models stand in 42 of the 187 RDB blocks, in 2,056 of the 4,232 dungeons, none with an
// action. The dungeon host collects them and a bed in reach is the rest point; a ship's bed pressed below deck (CSA-J's
// `_restFromBed`, which restPoint never read) is one too. buildDungeonContext is pinned by source, as aiwater.test.js
// and dialload.test.js pin it; the reach law is driven.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { bedInReach, BED_STOREY_M } from '../src/systems/restAct.js';
import { BY_FIRE_REACH } from '../src/systems/survival/camp.js';
import { isBedModel } from '../src/systems/rrRealism.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const box = (x0, x1, y0, y1, z0, z1) => ({ aabb: { min: [x0, y0, z0], max: [x1, y1, z1] } });
const BED = box(0, 2, 0, 1, 0, 1);   // a four-poster's mattress, 2 m by 1 m, on the floor

test('DUNGEON-BEDS: the reach is a fire\'s, measured to the bed\'s nearest point - beside it, at its foot and at 4 m a rest point; past 4 m, on the floor below, or with no feet, none', () => {
  assert.equal(bedInReach([BED], [1, 0, -1]), true, 'beside the bed');
  assert.equal(bedInReach([BED], [2 + BY_FIRE_REACH, 0, 0.5]), true, 'at the reach, off its end');
  assert.equal(bedInReach([BED], [2 + BY_FIRE_REACH + 0.01, 0, 0.5]), false, 'a step past it');
  assert.equal(bedInReach([BED], [1, -(BY_FIRE_REACH + 0.5), 0.5]), false, 'a bed on the floor above is not this floor\'s');
  // AUDIT FB1005 B4: a dungeon's storeys stand some 3.2 m apart - in the 4 m reach, but not the bed's floor
  assert.equal(bedInReach([BED], [1, -3.2, -1]), false, 'the storey below, 3.2 m under the bed');
  assert.equal(bedInReach([BED], [1, 3.2, -1]), false, 'the storey above');
  assert.equal(bedInReach([BED], [1, BED_STOREY_M, -1]), true, 'a step or a dais on the bed\'s own floor');
  assert.equal(bedInReach([BED], [1, BED_STOREY_M + 0.01, -1]), false, 'past it');
  // the reach is a fire's sphere: a bed on a dais 1.5 m up and 3.8 m off is 4.09 m away
  assert.equal(bedInReach([BED], [2 + 3.8, -1.5, 0.5]), false, 'out of the sphere, though in reach across the floor');
  assert.equal(bedInReach([BED], [2 + 3.6, -1.5, 0.5]), true, '3.9 m: in it');
  assert.equal(bedInReach([BED], null), false, 'no feet this frame');
  assert.equal(bedInReach([], [1, 0, 0]), false, 'no beds');
  assert.equal(bedInReach([box(50, 52, 0, 1, 50, 51), BED], [1, 0, 2]), true, 'any bed of the level');
});

test('DUNGEON-BEDS by source: the dungeon host collects every bed placement and names a bed in reach (or a bed pressed) its rest point, a bed\'s rest, before a fire\'s', () => {
  const dc = rd('src/scenes/dungeonContext.js');
  assert.match(dc, /if \(!p\.action && isBedModel\(p\.modelIdNum\) && !palace\) dungeonBeds\.push\(\{ aabb \}\);/);
  // AUDIT FB1005 B3: a palace stands no bed's rest as it stands no fire (AUDIT REST II F2's own predicate); B1: a bed's
  // night spends no Bedroll or Campfire laid beside it
  assert.match(dc, /const palace = isPalaceLayout\(dungeon\.blocks\);/);
  assert.ok(dc.indexOf('const palace = isPalaceLayout(dungeon.blocks);') < dc.indexOf('for (const p of b.layout.placements) {'), 'decided before the placements are walked');
  assert.match(dc, /onNightSlept: \(\) => \(_restFromBed \|\| bedInReach\(dungeonBeds, _fpFeet\) \? false : camps\.spendNightNear\(_fpFeet\)\),/);
  assert.match(dc, /restKind: \(\) => \(_restFromBed \|\| bedInReach\(dungeonBeds, _fpFeet\) \? 'bed' : _fpFeet && camps\.fireNear\(_fpFeet\) \? 'camp' : 'rough'\),/);
  assert.match(dc, /restPoint: \(\) => \(_restFromBed \|\| bedInReach\(dungeonBeds, _fpFeet\) \? \{ kind: 'bed', where: null \} : _fpFeet \? camps\.restPointAt\(_fpFeet\) : null\),/);
  // the collect sits in the placement loop, after the AABB every arm reads, and before the action arms' `continue`s
  const loop = dc.slice(dc.indexOf('for (const p of b.layout.placements) {'), dc.indexOf('drawList.push({ mesh: gpu, matrix, key: `${bi}:${p.position}`'));
  assert.ok(loop.indexOf('const aabb = worldAabb(cpu.positions, matrix);') < loop.indexOf('dungeonBeds.push({ aabb })'));
  assert.ok(loop.indexOf('dungeonBeds.push({ aabb })') < loop.indexOf('if (p.action) {'));
});

const ARENA2 = process.env.ARENA2_PATH;
const HAVE_ARENA2 = !!ARENA2 && existsSync(join(ARENA2, 'BLOCKS.BSA'));

test('DUNGEON-BEDS with ARENA2: Daggerfall\'s RDB blocks stand 108 beds in 42 blocks through the port\'s own layout, every one a plain placement the host collects', { skip: HAVE_ARENA2 ? false : 'ARENA2_PATH not set', timeout: 120000 }, async () => {
  const { BlocksFile } = await import('../src/formats/blocksFile.js');
  const { layoutRdbBlock } = await import('../src/world/rdbLayout.js');
  const blocks = new BlocksFile(); blocks.autoDiscard = false;
  assert.ok(blocks.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA')))));
  const stub = () => ({ positions: new Float32Array(0), indices: new Uint32Array(0), subMeshes: [], doors: [] });
  let beds = 0, withAction = 0, rdb = 0;
  const bedBlocks = new Set();
  for (let i = 0; i < blocks.count; i++) {
    const name = blocks.getBlockName(i);
    if (!name?.endsWith('.RDB')) continue;
    rdb++;
    const layout = layoutRdbBlock(blocks.getBlock(i), i, true, stub);
    for (const p of layout.placements) {
      if (!isBedModel(p.modelIdNum)) continue;
      beds++; bedBlocks.add(name);
      if (p.action) withAction++;
    }
  }
  assert.equal(rdb, 187);
  assert.deepEqual({ beds, blocks: bedBlocks.size, withAction }, { beds: 108, blocks: 42, withAction: 0 });
});
