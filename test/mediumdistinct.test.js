// MEDIUM-DISTINCT (2026-10-08, Mac: "Medium dungeons just copy and paste 2 layouts together"; bible/03-World/Delve-Arc.md
// DSIZE1, MEDIUM-DISTINCT). The medium size drew its two interior blocks by GetRandomBlock's law, with replacement,
// from a pool of two to four - a quarter to a half of them laid one block twice, side by side: one area and its copy.
// An interior block that repeats one already laid takes the pool's next block round from it that is not laid, with no
// draw of its own (world/smallerDungeons.js distinctInterior): the border rows, and every layout whose draws never
// repeated, are what they were. A save made in the old layout of a moved dungeon stands at the start (the stamp
// MEDIUM_DISTINCT_STAMP), and a running quest at a medium size has its markers enumerated again where its dungeon's
// layout moved (quest/questRepair.js relayMovedLayouts, at every load).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import {
  SMALLER_DUNGEONS_STATE, MEDIUM_DUNGEONS_STATE, ONLINE_DUNGEONS_STATE, MEDIUM_DISTINCT_STAMP, MEDIUM_LAYOUT,
  generateMediumDungeon, generateSmallerDungeon, smallerDungeonsStamp, needsStartWarp, dungeonSizeFor,
} from '../src/world/smallerDungeons.js';
import { setSeed, randomRange } from '../src/formats/dfRandom.js';
import { isMainStoryDungeon } from '../src/world/dungeonTextures.js';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { Place, SITE_TYPES } from '../src/systems/quest/place.js';
import { loadQuestTables } from '../src/systems/quest/tables.js';
import { relayMovedLayouts } from '../src/systems/quest/questRepair.js';
import { RDB_RESOURCE_TYPES } from '../src/formats/blocksFile.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
{
  const dir = new URL('../vendor/dfu-quests/Tables/', import.meta.url);
  const sources = {};
  for (const f of readdirSync(dir)) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = readFileSync(new URL(f, dir), 'utf8').replace(/^﻿/, '');
  loadQuestTables(sources);
}

const isBorder = (name) => /^b/i.test(name);
/** A dungeon of `names` (a MAPS.BSA block list), on map id `mapId`. */
const loc = (names, mapId) => ({ name: 'T', hasDungeon: true, mapTableData: { mapId }, dungeon: { blocks: names.map((blockName) => ({ blockName, x: 9, z: 9, isStartingBlock: false })) } });
/** The old law's layout - GetRandomBlock's draws in layout order, with replacement, over the two pools. */
const oldDraws = (l) => {
  const pools = { false: l.dungeon.blocks.filter((b) => !isBorder(b.blockName)), true: l.dungeon.blocks.filter((b) => isBorder(b.blockName)) };
  setSeed(l.mapTableData.mapId);
  return MEDIUM_LAYOUT.map(([, , border]) => pools[border][randomRange(0, pools[border].length)].blockName);
};
const TEN = ['B0000001.RDB', 'N0000001.RDB', 'B0000002.RDB', 'N0000002.RDB', 'B0000003.RDB', 'B0000004.RDB', 'B0000005.RDB', 'B0000006.RDB', 'B0000007.RDB', 'B0000008.RDB'];
/** The first map id from `from` on whose old draws the two interior blocks `repeat` (or do not). */
const idWhere = (names, repeat, from = 1000) => {
  for (let id = from; id < from + 5000; id++) {
    if (isMainStoryDungeon(id)) continue;
    const d = oldDraws(loc(names, id));
    if ((d[0] === d[1]) === repeat) return id;
  }
  throw new Error('no such id');
};

test('MEDIUM-DISTINCT the two interior blocks are two: a draw that repeats the first takes the pool\'s next block round from it that is not laid, the border rows drawn as they were, the same every visit; a draw that never repeated is the layout it always was (mutants: the repeat kept, a second draw taken, the walk from the wrong place)', () => {
  const rep = loc(TEN, idWhere(TEN, true));
  const old = oldDraws(rep);
  assert.equal(old[0], old[1], 'the old law laid one block twice');
  const out = generateMediumDungeon(rep);
  const names = out.dungeon.blocks.map((b) => b.blockName);
  const other = old[0] === 'N0000001.RDB' ? 'N0000002.RDB' : 'N0000001.RDB';
  assert.deepEqual(names.slice(0, 2), [old[0], other], 'the second interior block is the pool\'s other');
  assert.deepEqual(names.slice(2), old.slice(2), 'every border row drawn as it was - no draw of its own');
  assert.deepEqual(out.dungeon.blocks.map((b) => [b.x, b.z, b.isStartingBlock]), MEDIUM_LAYOUT.map(([x, z], i) => [x, z, i === 0]), 'the block takes the repeat\'s place');
  assert.equal(out.dungeon.distinct, true);
  assert.equal(rep.dungeon.blocks.length, 10, 'the cached location never mutated');
  assert.deepEqual(generateMediumDungeon(loc(TEN, rep.mapTableData.mapId)).dungeon.blocks, out.dungeon.blocks, 'the same every visit');
  // never repeated: the old layout, draw for draw
  const kept = loc(TEN, idWhere(TEN, false));
  const k = generateMediumDungeon(kept);
  assert.deepEqual(k.dungeon.blocks.map((b) => b.blockName), oldDraws(kept));
  assert.equal(k.dungeon.distinct, undefined);
  // round from the repeated block's first place in the pool: of three, the next one along
  const three = ['B0000001.RDB', 'N0000001.RDB', 'N0000002.RDB', 'N0000003.RDB', 'B0000002.RDB', 'B0000003.RDB', 'B0000004.RDB', 'B0000005.RDB', 'B0000006.RDB', 'B0000007.RDB'];
  for (const id of [idWhere(three, true), idWhere(three, true, idWhere(three, true) + 1)]) {
    const l = loc(three, id);
    const first = oldDraws(l)[0];
    const pool = ['N0000001.RDB', 'N0000002.RDB', 'N0000003.RDB'];
    assert.equal(generateMediumDungeon(l).dungeon.blocks[1].blockName, pool[(pool.indexOf(first) + 1) % 3], `map ${id}: after ${first}`);
  }
});

test('MEDIUM-DISTINCT over a sweep of map ids and pools of two to four (names repeated in a list as MAPS.BSA repeats them): no medium build lays one interior block twice where its pool holds two, its border rows are always the old draws; a pool of one name keeps the repeat; the small plus never meets it (mutants: the border rows touched, the one-name pool emptied)', () => {
  const lists = [
    TEN,
    ['B0000001.RDB', 'N0000001.RDB', 'N0000002.RDB', 'W0000003.RDB', 'B0000002.RDB', 'B0000003.RDB', 'B0000004.RDB', 'B0000005.RDB', 'B0000006.RDB', 'B0000007.RDB', 'B0000008.RDB'],
    ['N0000001.RDB', 'N0000001.RDB', 'N0000002.RDB', 'N0000002.RDB', 'B0000001.RDB', 'B0000002.RDB', 'B0000003.RDB', 'B0000001.RDB', 'B0000002.RDB', 'B0000003.RDB', 'B0000004.RDB', 'B0000005.RDB'],
    ['N0000001.RDB', 'N0000001.RDB', 'N0000002.RDB', 'B0000001.RDB', 'B0000002.RDB', 'B0000003.RDB', 'B0000004.RDB', 'B0000005.RDB', 'B0000006.RDB', 'B0000007.RDB'],
  ];
  let moved = 0;
  for (const names of lists) {
    for (let id = 1; id <= 400; id++) {
      if (isMainStoryDungeon(id * 7919)) continue;
      const l = loc(names, id * 7919);
      const out = generateMediumDungeon(l).dungeon.blocks.map((b) => b.blockName);
      const old = oldDraws(l);
      assert.notEqual(out[0], out[1], `map ${id * 7919}: two interior blocks`);
      assert.deepEqual(out.slice(2), old.slice(2), `map ${id * 7919}: the ring as drawn`);
      if (out[1] !== old[1]) moved++;
      assert.equal(generateSmallerDungeon(l).dungeon.distinct, undefined, 'the plus lays one interior block');
    }
  }
  assert.ok(moved > 400, `a quarter to a half of them moved (${moved} of 1600)`);
  const one = ['N0000001.RDB', 'N0000001.RDB', 'B0000001.RDB', 'B0000002.RDB', 'B0000003.RDB', 'B0000004.RDB', 'B0000005.RDB', 'B0000006.RDB', 'B0000007.RDB'];
  const solo = generateMediumDungeon(loc(one, 4242));
  assert.deepEqual(solo.dungeon.blocks.slice(0, 2).map((b) => b.blockName), ['N0000001.RDB', 'N0000001.RDB'], 'one name: the repeat kept');
  assert.equal(solo.dungeon.distinct, undefined);
});

test('MEDIUM-DISTINCT the save: a build whose block was taken again stamps its own value, past the online sizes, so a save made in the layout that laid it twice stands at the start; a build that never repeated stamps the medium size as before; the stamp is no quest\'s frozen size (mutants: the stamp unsplit, the value)', () => {
  assert.equal(MEDIUM_DISTINCT_STAMP, 5);
  assert.ok(![...Object.values(SMALLER_DUNGEONS_STATE), MEDIUM_DUNGEONS_STATE, ONLINE_DUNGEONS_STATE].includes(MEDIUM_DISTINCT_STAMP));
  const moved = generateMediumDungeon(loc(TEN, idWhere(TEN, true)));
  const kept = generateMediumDungeon(loc(TEN, idWhere(TEN, false)));
  assert.equal(smallerDungeonsStamp(moved), MEDIUM_DISTINCT_STAMP);
  assert.equal(smallerDungeonsStamp(kept), MEDIUM_DUNGEONS_STATE);
  assert.equal(needsStartWarp(MEDIUM_DUNGEONS_STATE, moved), true, 'saved in the old layout: to the start');
  assert.equal(needsStartWarp(MEDIUM_DISTINCT_STAMP, moved), false, 'saved in this one: where it stood');
  assert.equal(needsStartWarp(MEDIUM_DUNGEONS_STATE, kept), false, 'a layout that never moved: where it stood');
  assert.equal(needsStartWarp(MEDIUM_DISTINCT_STAMP, kept), true);
  // a quest never freezes it: a link holding it reads as no size, the setting's
  const l = loc(TEN, 777);
  const machine = { getSiteLinks: () => [{ questUID: 1 }], getQuest: () => ({ smallerDungeonsState: MEDIUM_DISTINCT_STAMP }) };
  assert.equal(dungeonSizeFor(l, { questMachine: machine, setting: false, medium: false, world: false }), 'full');
});

const BARE_SRC = ['Quest: __MDX', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'variable _done_'];
const sym = (name) => ({ name, original: `_${name}_`, clone() { return sym(name); } });
const flat = (record, x) => ({ type: RDB_RESOURCE_TYPES.Flat, position: x, xPos: x, yPos: 0, zPos: 0, resources: { flatResource: { textureArchive: 199, textureRecord: record } } });

test('MEDIUM-DISTINCT the quests: at every load a running quest at a medium size whose markers were chosen on the layout that laid one block twice has them enumerated again on the dungeon its world builds now, its foe put back on a marker that build has, its stamp untouched; DFU\'s stamps, an unmoved layout and a finished quest left alone; wired at the bridge\'s load, online and off (mutants: the compare skipped, the stamps widened, the put-back, the wiring)', () => {
  const m = new QuestMachine();
  const q = m.parseQuestForLists(BARE_SRC, 0, { rolls: () => 0 });
  m.startQuestImmediate(q);
  const blockData = {
    'N0000001.RDB': { position: 100, rdbBlock: { objectRootList: [{ rdbObjects: [flat(11, 1), flat(18, 2)] }] } },
    'N0000002.RDB': { position: 300, rdbBlock: { objectRootList: [{ rdbObjects: [flat(11, 5)] }] } },
    'B0000001.RDB': { position: 200, rdbBlock: { objectRootList: [{ rdbObjects: [flat(11, 3)] }] } },
  };
  const built = (second) => ({ name: 'Keep', mapTableData: { mapId: 777 }, dungeon: { medium: true, blocks: [
    { blockName: 'N0000001.RDB', x: 0, z: 0 }, { blockName: second, x: 1, z: 0 }, { blockName: 'B0000001.RDB', x: 0, z: -1 }] } });
  let now = built('N0000001.RDB');   // the layout that laid one block twice
  const world = {
    maps: { getRegion: (r) => (r === 3 ? { mapNameLookup: new Map([['Keep', 5]]) } : null), getLocation: (r, l) => (r === 3 && l === 5 ? now : null) },
    getBlock: (n) => blockData[n] ?? null,
  };
  q.hooks = { ...(q.hooks ?? {}), world };
  const dun = new Place(q);
  dun.symbol = sym('dun');
  const before = dun._enumerateDungeonQuestMarkers(world, now);   // the markers the old layout minted
  assert.deepEqual(before.questSpawnMarkers.map((k) => [k.dungeonX, k.dungeonZ, k.markerID]), [[0, 0, 101], [1, 0, 101], [0, -1, 203]]);
  dun.siteDetails = { siteType: SITE_TYPES.Dungeon, mapId: 777, regionIndex: 3, locationName: 'Keep', buildingKey: 0, magicNumberIndex: 0,
    selectedMarker: { targetResources: [sym('boss')] }, ...before };
  dun._range = () => 1;
  q.resources.set('dun', dun);
  q.resources.set('boss', { symbol: sym('boss'), isFoe: true, spawnCount: 1, killCount: 0, parentQuest: q, questResourceBehaviour: null });
  q.tasks.set('_go_', { actions: [{ typeName: 'PlaceFoe', foeSymbol: sym('boss'), placeSymbol: sym('dun'), marker: -1, isComplete: true }] });
  q.smallerDungeonsState = MEDIUM_DUNGEONS_STATE;
  assert.equal(relayMovedLayouts(m), 0, 'the layout its markers know: nothing moves');
  now = built('N0000002.RDB');   // the law moved it
  // DFU's stamps name builds that never moved: left alone
  for (const s of [SMALLER_DUNGEONS_STATE.NotSet, SMALLER_DUNGEONS_STATE.Disabled, SMALLER_DUNGEONS_STATE.Enabled]) {
    q.smallerDungeonsState = s;
    assert.equal(relayMovedLayouts(m), 0, `stamp ${s}`);
    assert.equal(dun.siteDetails.questSpawnMarkers[1].markerID, 101);
  }
  q.smallerDungeonsState = MEDIUM_DUNGEONS_STATE;
  assert.equal(relayMovedLayouts(m), 1, 'one quest re-laid');
  assert.deepEqual(dun.siteDetails.questSpawnMarkers.map((k) => [k.dungeonX, k.dungeonZ, k.markerID]), [[0, 0, 101], [1, 0, 305], [0, -1, 203]], 'the build\'s markers');
  assert.deepEqual(dun.siteDetails.selectedMarker.targetResources.map((t) => t.name), ['boss'], 'the boss put back');
  assert.equal(dun.siteDetails.selectedMarker.markerID, 305, '...on a marker the build has');
  assert.equal(q.smallerDungeonsState, MEDIUM_DUNGEONS_STATE, 'the stamp untouched');
  assert.equal(relayMovedLayouts(m), 0, 'again: nothing');
  // the world's sizes (a quest started online) are a medium size too
  now = built('N0000001.RDB');
  q.smallerDungeonsState = ONLINE_DUNGEONS_STATE;
  assert.equal(relayMovedLayouts(m), 1);
  assert.equal(q.smallerDungeonsState, ONLINE_DUNGEONS_STATE);
  // a finished quest is not read
  now = built('N0000002.RDB');
  q.questComplete = true;
  assert.equal(relayMovedLayouts(m), 0);
  q.questComplete = false;
  // wired at the bridge's load, after the online re-lay, online and off
  const bridge = src('src/scenes/questBridge.js');
  const restore = bridge.slice(bridge.indexOf('restore(data) {'));
  assert.match(restore, /if \(isOnlinePage\(\)\) relayOnlineDungeons\(machine, [^\n]*\n(?:\s*\/\/[^\n]*\n)+\s*relayMovedLayouts\(machine, \{ carriesQuestItem: \(item\) => ctx\.carriesQuestItem\?\.\(item\) \?\? false \}\);\n/);
});
