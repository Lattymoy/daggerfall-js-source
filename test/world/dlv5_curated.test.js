// DLV5 (bible/03-World/Delve-II.md section 8): CURATED BLOCKS - the record's law (world/dungeon/curatedBlocks.js), the
// block made of its base (a drop takes only what it names, never a chained object; an add is Daggerfall's model, flat or
// marker by id, at its own position), the splice (world/dungeon/curatedSplice.js: a game-made dungeon alone, never the
// start or a border, the same on every client), the anchors standing first in the site law, the layout's one departure,
// the install on the world-data door, and every shipped record against the freeware's own blocks. Held to fail under
// tools/mutants/dlv5.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  curatedRecordError, curatedBlockOf, curatedBlockName, isCuratedName, curatedAnchors, curatedByName, CURATED_BLOCK_INDEX, CURATED_POSITION,
  CURATED_POSITION_STEP, CURATED_ADD_POSITION, CURATED_MARKERS, CURATED_BLOCKS_MAX,
} from '../../src/world/dungeon/curatedBlocks.js';
import { checkedRecords, CURATED_RECORDS } from '../../src/world/dungeon/curatedRecords.js';
import { curatedSlot, spliceCurated, gameMade, CURATED_CHANCE } from '../../src/world/dungeon/curatedSplice.js';
import { delveSitePlan, DSITE } from '../../src/world/dungeon/delveSites.js';
import { layoutDungeon } from '../../src/world/dungeon/dungeonLayout.js';
import { RDB_RESOURCE_TYPES, ROTATION_DIVISOR } from '../../src/formats/blocksFile.js';
import { GLOBAL_SCALE } from '../../src/world/meshReader.js';
import { DUNGEON_TYPES } from '../../src/formats/mapsFile.js';
import { DELVE_FAMILIES, DELVE_KINDS } from '../../src/net/delve/delveLaw.js';
import { TOWN_OUTLINE_BLOCK_INDEX } from '../../src/world/townOutline.js';
import { townWallBlockIndex } from '../../src/world/townWalls.js';
import { RANDOM_TREASURE_MARKER_RECORD } from '../../src/systems/loot/loot.js';
import { ENEMY_MARKER_RECORDS, FIRE_MARKER_RECORDS } from '../../src/world/dungeon/dungeonFires.js';

const ARENA2 = process.env.ARENA2_PATH;
const NO_ARENA2 = (!ARENA2 || !existsSync(ARENA2)) && 'ARENA2_PATH not set or missing - real-data validation skipped';
const REC = Object.freeze({ id: 'test-hall', n: 7, base: 'N0000023.RDB', types: [DUNGEON_TYPES.Crypt], drop: [], add: [], anchors: [] });
const U = (m) => Math.round(m / GLOBAL_SCALE);

test('DLV5 THE RECORD\'S LAW: an id, its number, an interior base, the types it joins; a drop names what it takes; an add is one of a model, a flat or a marker (a foe with its mobile); anchors of the law\'s kinds, a ward of 3 or 4 m, two at most, apart - each refused by name (mutants: each rule unread)', () => {
  assert.equal(curatedRecordError(REC), null);
  const bad = (o) => curatedRecordError({ ...REC, ...o });
  assert.match(bad({ id: 'Bad Id' }), /^id/);
  assert.match(bad({ n: 1000 }), /^n/);
  assert.match(bad({ base: 'B0000001.RDB' }), /^base/, 'never a border block');
  assert.match(bad({ base: 'S0000160.RDB' }), /^base/, 'nor a quest block');
  assert.match(bad({ types: [255] }), /^types/);
  assert.match(bad({ drop: [{ at: [1, 1, 1], r: 2 }] }), /^drop: what it takes/, 'a drop that names nothing');
  assert.match(bad({ drop: [{ at: [60, 1, 1], r: 2, marker: 'foe' }] }), /^drop: a point/);
  assert.match(bad({ add: [{ at: [1, 1, 1], model: 41300, marker: 'start' }] }), /^add: one of/);
  assert.match(bad({ add: [{ at: [1, 1, 1], marker: 'foe' }] }), /mobile/, 'a foe names its mobile');
  assert.equal(bad({ add: [{ at: [1, 1, 1], marker: 'foe', mobile: 2 }] }), null);
  assert.match(bad({ add: [{ at: [1, 1, 1], flat: [199, 2000] }] }), /^add: a flat/);
  const a = { kind: 'hold', at: [20, 0, 20], r: 4, vault: [16.6, 0, 20] };
  assert.equal(bad({ anchors: [a] }), null);
  assert.match(bad({ anchors: [{ ...a, kind: 'clock' }] }), /^anchors: a kind/);
  assert.match(bad({ anchors: [{ ...a, r: 5 }] }), /^anchors: r/);
  assert.match(bad({ anchors: [a, { ...a, at: [40, 0, 40] }] }), /1 at most/, 'a block is one site at most - two stood 8 m apart where the plan keeps 60');
  assert.match(bad({ drop: [{ flat: [199, 15], at: [1, 1, 1], r: 2 }] }), /by its name/, 'an editor marker by its name alone - a quest\'s or the way in\'s never by a flat');
  assert.match(bad({ drop: [{ marker: 'start', at: [1, 1, 1], r: 2 }] }), /never the way in/, 'the start marker carries the block\'s water level');
  assert.match(bad({ drop: [{ marker: 'enter', at: [1, 1, 1], r: 2 }] }), /never the way in/);
  assert.match(bad({ add: [{ at: [51.2, 1, 1], model: 41300 }] }), /^add: a point/, 'half-open: 51.2 is the next block\'s 0');
  assert.equal(bad({ add: [{ at: [51.19, 1, 51.19], model: 41300 }] }), null);
  assert.throws(() => checkedRecords([{ ...REC, n: 0 }]), /lab's draft/, 'number 0 never ships');
  assert.throws(() => checkedRecords([REC, { ...REC, n: 8 }]), /id: twice/);
  assert.throws(() => checkedRecords([REC, { ...REC, id: 'other-hall' }]), /n: twice/);
  assert.ok(CURATED_RECORDS.length >= 1 && CURATED_RECORDS.every((r) => curatedRecordError(r) === null), 'every shipped record holds');
});

/** A base: two models (one chained to a door), the editor's foes and a treasure, a light. */
function base() {
  const model = (position, idx, x, z, act = null, flatResource = null) => ({ position, index: 0, xPos: U(x), yPos: 0, zPos: U(z), type: RDB_RESOURCE_TYPES.Model, resources: { modelResource: { xRotation: 0, yRotation: 0, zRotation: 0, modelIndex: idx, actionResource: act ?? { nextObjectOffset: 0, previousObjectOffset: 0, flags: 0 } }, flatResource, lightResource: null } });
  const flat = (position, archive, record, x, z, next = 0) => ({ position, index: 0, xPos: U(x), yPos: 0, zPos: U(z), type: RDB_RESOURCE_TYPES.Flat, resources: { flatResource: { textureArchive: archive, textureRecord: record, nextObjectOffset: next }, modelResource: null, lightResource: null } });
  return {
    name: 'N0000023.RDB', index: 23, position: 4096,
    rdbBlock: {
      modelReferenceList: [{ modelId: '41300', modelIdNum: 41300, description: '' }, { modelId: '55012', modelIdNum: 55012, description: 'DOR' }],
      objectRootList: [{ rdbObjects: [
        model(100, 0, 20, 20), model(200, 1, 22, 20, { nextObjectOffset: 300, previousObjectOffset: 0, flags: 1 }), model(800, 1, 20.3, 20, null, { textureArchive: 199, textureRecord: 15 }),
        flat(300, 199, 15, 21, 20), flat(400, 199, 15, 19, 21), flat(500, 199, 15, 40, 40), flat(600, 216, 3, 20, 19), flat(700, 199, 10, 5, 5), flat(900, 199, 15, 19.5, 20.5, 500),
      ] }],
    },
  };
}

test('DLV5 THE BLOCK MADE OF ITS BASE: its own name, index and record position; a drop takes what it names within its reach and nothing an action chains; an add laid at its own position - a model by id (its reference reused or added, its rotation in the base\'s units), a marker, a foe of its mobile - in a root of its own; the base untouched (mutants: a drop of anything near; a chained foe dropped; the reference doubled; the rotation\'s sign; the base\'s position kept)', () => {
  const b = base(), before = JSON.stringify(b);
  const rec = { ...REC, drop: [{ marker: 'foe', at: [20, 0, 20], r: 3 }, { model: 41300, at: [20, 0, 20], r: 0.5 }, { model: 55012, at: [22, 0, 20], r: 0.5 }], add: [{ model: 55012, at: [10, 0.5, 10], rot: [0, 90, 0] }, { model: 41108, at: [11, 0, 11] }, { marker: 'treasure', at: [12, 0, 12] }, { marker: 'foe', mobile: 7, at: [13, 0, 13] }, { model: 41300, at: [14, 0, 14], rot: [10, 0, -20] }] };
  const c = curatedBlockOf(b, rec);
  assert.equal(JSON.stringify(b), before, 'the base untouched');
  assert.deepEqual([c.name, c.servedName, c.index, c.position], [curatedBlockName(7), curatedBlockName(7), CURATED_BLOCK_INDEX + 7, CURATED_POSITION + 7 * CURATED_POSITION_STEP]);
  assert.equal(curatedBlockName(7), 'NDLV0007.RDB');
  assert.ok(CURATED_BLOCK_INDEX > TOWN_OUTLINE_BLOCK_INDEX && CURATED_BLOCK_INDEX + CURATED_BLOCKS_MAX <= townWallBlockIndex(0), 'its run its own: past the town outline\'s, under the walled towns\' (two such meetings were found)');
  assert.deepEqual([CURATED_MARKERS.treasure, [CURATED_MARKERS.foe, CURATED_MARKERS.enemy]], [RANDOM_TREASURE_MARKER_RECORD, ENEMY_MARKER_RECORDS], 'the markers the loot and the foes read');
  assert.ok(FIRE_MARKER_RECORDS.includes(CURATED_MARKERS.start) && FIRE_MARKER_RECORDS.includes(CURATED_MARKERS.enter));
  const kept = c.rdbBlock.objectRootList[0].rdbObjects.map((o) => o.position);
  assert.deepEqual(kept, [200, 800, 300, 500, 600, 700, 900], 'the model named within its reach and the foe at 19,21 gone; the door that acts (its chain\'s head, 200), the foe it chains to (300), the foe at the head of a chain of its own (900), the far one, the treasure, the start kept - and the other model in reach, whose flat resource (a JSON block carries all three) names a foe');
  const add = c.rdbBlock.objectRootList[1].rdbObjects;
  assert.deepEqual(add.map((o) => o.position), [0, 1, 2, 3, 4].map((k) => CURATED_ADD_POSITION + k));
  assert.deepEqual(c.rdbBlock.modelReferenceList.map((m) => [m.modelIdNum, m.description]), [[41300, ''], [55012, 'DOR'], [55012, ''], [41108, '']], 'a plain reference reused, a described one never (the base\'s `DOR` makes its model an action door) - its own added');
  assert.deepEqual([add[0], add[1], add[4]].map((o) => o.resources.modelResource.modelIndex), [2, 3, 0]);
  assert.deepEqual(['xRotation', 'yRotation', 'zRotation'].map((k) => add[4].resources.modelResource[k]), [10, 0, -20].map((d) => Math.round(-d * ROTATION_DIVISOR)), 'each axis its own, in the base\'s units (-raw / divisor reads back the degrees)');
  assert.equal(add[0].resources.modelResource.yRotation, Math.round(-90 * ROTATION_DIVISOR), 'the layout reads -raw / divisor back to 90 degrees');
  assert.deepEqual([add[0].xPos, add[0].yPos, add[0].zPos], [U(10), U(-0.5), U(10)], 'y up in metres is the base\'s -y');
  assert.deepEqual([add[2].resources.flatResource.textureArchive, add[2].resources.flatResource.textureRecord], [199, CURATED_MARKERS.treasure]);
  assert.deepEqual([add[3].resources.flatResource.textureRecord, add[3].resources.flatResource.factionOrMobileId], [CURATED_MARKERS.foe, 7]);
  assert.ok(add.every((o) => o.resources.modelResource && o.resources.lightResource), 'every object its three resources, as the JSON reader makes them');
  assert.equal(curatedBlockOf(null, rec), null, 'no base, no block');
});

/** A game-made crypt: a start, interior blocks and borders, its id `mapId`. */
const spawnOf = (mapId, o = {}) => ({
  name: 'spawn', spawned: true, hasDungeon: true, climate: { worldClimate: 231 }, mapTableData: { mapId, dungeonType: DUNGEON_TYPES.Crypt },
  dungeon: { recordElement: { header: { locationId: mapId } }, blocks: [
    { x: 0, z: 0, blockName: 'N0000001.RDB', isStartingBlock: true }, { x: 1, z: 0, blockName: 'N0000002.RDB', isStartingBlock: false },
    { x: -1, z: 0, blockName: 'N0000003.RDB', isStartingBlock: false }, { x: 0, z: 1, blockName: 'B0000001.RDB', isStartingBlock: false },
  ] },
  ...o,
});

test('DLV5 THE SPLICE: a game-made dungeon alone (a spawn, a lair - never MAPS.BSA\'s), of a type its pool holds, by CURATED_CHANCE off its own id; the slot an interior block, never the start or a border; the same on every call; the list untouched when none (mutants: any dungeon spliced; the start or a border taken; the chance unread; the type unread)', () => {
  const recs = [REC];
  let inn = 0, out = 0;
  for (let id = 1; id <= 400; id++) {
    const s = curatedSlot(spawnOf(id), recs);
    if (!s) { out++; continue; }
    inn++;
    assert.ok([1, 2].includes(s.j), `id ${id}: an interior block, never the start (0) or the border (3)`);
    assert.deepEqual(curatedSlot(spawnOf(id), recs), s, 'the same draw every time');
  }
  const js = new Set([...Array(400).keys()].map((k) => curatedSlot(spawnOf(k + 1), recs)?.j).filter((j) => j !== undefined));
  assert.deepEqual([...js].sort(), [1, 2], 'the slot drawn among every interior block, not the first alone');
  assert.equal(CURATED_CHANCE, 0.5);
  assert.ok(Math.abs(inn / 400 - CURATED_CHANCE) < 0.1, `about half (${inn} of 400)`);
  assert.ok(out > 0);
  const id = [...Array(400).keys()].map((k) => k + 1).find((k) => curatedSlot(spawnOf(k), recs));
  assert.equal(curatedSlot({ ...spawnOf(id), spawned: false }, recs), null, 'a real location: never');
  assert.ok(curatedSlot({ ...spawnOf(id), spawned: false, country: { dungeon: true } }, recs), 'a lair past the Bay: yes');
  assert.equal(gameMade({ country: { dungeon: false } }), false);
  assert.equal(curatedSlot(spawnOf(id, { mapTableData: { mapId: id, dungeonType: DUNGEON_TYPES.Mine } }), recs), null, 'a mine\'s pool holds none');
  const loc = spawnOf(id), spliced = spliceCurated(loc, recs);
  assert.notEqual(spliced, loc.dungeon.blocks);
  assert.equal(spliced[curatedSlot(loc, recs).j].blockName, curatedBlockName(REC.n));
  assert.equal(loc.dungeon.blocks.filter((b) => isCuratedName(b.blockName)).length, 0, 'the location untouched');
  const none = spawnOf(id, { spawned: false });
  assert.equal(spliceCurated(none, recs), none.dungeon.blocks, 'none: the same list');
  const one = spawnOf(id, { dungeon: { recordElement: { header: { locationId: 1 } }, blocks: [{ x: 0, z: 0, blockName: 'N0000001.RDB', isStartingBlock: true }] } });
  assert.equal(curatedSlot(one, recs), null, 'a dungeon of its start alone holds no slot');
});

/** A laid block with a room: a 40 m floor, no marker but its start's, at grid x. */
const laid = (name, x, start = false) => ({ name, originX: x * 51.2, originZ: 0, isStartingBlock: start, layout: { waterLevel: 10000, markers: start ? [{ record: 10, x: x * 51.2 + 5, y: 0.5, z: 5 }] : [], startMarkers: [] } });

test('DLV5 THE ANCHORS STAND FIRST: a curated block\'s, in the dungeon\'s frame, as designed - their kind, ward and vault; the law finds the rest of the count clear of them, the other family where it can; no anchor, the plan unchanged (mutants: the block\'s origin unread; the count not shortened; a found site on an anchor)', () => {
  const rec = { ...REC, anchors: [{ kind: 'litany', at: [20, 0, 20], r: 4, vault: [20, 0, 20] }] };
  const blocks = [laid('N0000001.RDB', 0, true), laid(curatedBlockName(7), 1), laid('N0000002.RDB', 2), laid('N0000003.RDB', 3)];
  const anchors = curatedAnchors(blocks, [rec]);
  assert.deepEqual(anchors, [{ kind: 'litany', r: 4, at: [71.2, 0, 20], vault: [71.2, 0, 20], id: 'test-hall' }]);
  assert.equal(curatedByName('NDLV0099.RDB', [rec]), null);
  const probe = { floor: (p) => ({ y: 0, ny: 1 }), room: () => ({ walls: [5, 5, 5, 5, 5, 5, 5, 5] }) };
  const plan = delveSitePlan({ blocks, probe, seed: 9, anchors });
  assert.equal(plan.anchored, 1);
  assert.deepEqual(plan.sites[0], { i: 0, kind: 'litany', x: 71.2, y: 0, z: 20, r: 4, tier: 'regular', vault: [71.2, 0, 20] });
  assert.equal(plan.sites.length, 2, 'four blocks want two: the anchor and one found');
  const found = plan.sites[1];
  assert.ok(Math.hypot(found.x - 71.2, found.z - 20) >= DSITE.spacingM, 'found clear of the anchor');
  assert.ok(plan.valid < delveSitePlan({ blocks, probe, seed: 9, anchors: [] }).valid, 'the census\'s open spots: none by the anchor');
  for (let seed = 0; seed < 16; seed++) {
    for (const kind of ['litany', 'hold']) {
      const p = delveSitePlan({ blocks, probe, seed, anchors: [{ ...anchors[0], kind }] });
      assert.notEqual(DELVE_KINDS[p.sites[1].kind].family, DELVE_KINDS[kind].family, `seed ${seed}: the found site the other family of the ${kind}'s`);
      assert.ok(DELVE_FAMILIES.includes(DELVE_KINDS[p.sites[1].kind].family));
    }
  }
  const bare = [laid('N0000001.RDB', 0, true), laid('N0000004.RDB', 1), laid('N0000002.RDB', 2), laid('N0000003.RDB', 3)];
  assert.deepEqual(delveSitePlan({ blocks: bare, probe, seed: 9 }), delveSitePlan({ blocks: bare, probe, seed: 9, anchors: [] }), 'no curated block: the plan the law always made');
  assert.equal(delveSitePlan({ blocks, probe, seed: 9, anchors, none: true }).sites.length, 0, 'a dungeon that stands none stands no anchor');
  assert.equal(delveSitePlan({ blocks, probe, seed: 9, anchors, kinds: ['hold'] }).anchored, 0, 'an anchor of a kind not built stands none');
});

test('DLV5 THE LAYOUT\'S ONE DEPARTURE: a game-made dungeon built (smallerDungeons.js dungeonLocationFor) with the curated block in its slot and its number - the list the quests read and the layout lays; whole (an instance\'s, an online quest\'s) its own blocks; Daggerfall\'s own as MAPS.BSA lists it (AUDIT DLV5-6 H1 - mutants: the splice unasked; the whole spliced)', async () => {
  const { dungeonLocationFor } = await import('../../src/world/smallerDungeons.js');
  const names = new Map();
  const blocksFile = {
    getBlockIndex: (n) => { if (!names.has(n)) names.set(n, names.size + 1); return names.get(n); },
    getBlock: () => ({ position: 0, rdbBlock: { modelReferenceList: [], objectRootList: [] } }),
  };
  const id = [...Array(400).keys()].map((k) => k + 1).find((k) => curatedSlot(spawnOf(k), CURATED_RECORDS));
  const loc = spawnOf(id);
  const want = curatedSlot(loc, CURATED_RECORDS);
  const built = dungeonLocationFor(loc, { setting: false, medium: false, world: false });
  assert.equal(built.dungeon.blocks[want.j].blockName, curatedBlockName(want.rec.n), 'the spawn built with its curated block');
  assert.equal(built.curated, want.rec.n, 'and its number, the room\'s tag');
  assert.equal(loc.dungeon.blocks.filter((b) => isCuratedName(b.blockName)).length, 0, 'the cached location untouched');
  const laidOut = layoutDungeon(built, blocksFile, () => null);
  assert.equal(laidOut.blocks[want.j].name, curatedBlockName(want.rec.n), 'laid as built');
  const whole = dungeonLocationFor(loc, { setting: false, medium: false, world: false, whole: true });
  assert.deepEqual([whole.dungeon.blocks.map((b) => b.blockName), whole.curated], [loc.dungeon.blocks.map((b) => b.blockName), undefined], 'the dungeon whole: its own blocks');
  const real = layoutDungeon(dungeonLocationFor({ ...loc, spawned: false }, { setting: false, medium: false, world: false }), blocksFile, () => null);
  assert.deepEqual(real.blocks.map((b) => b.name), loc.dungeon.blocks.map((b) => b.blockName), 'a real dungeon: its own blocks');
});

test('DLV5 THE INSTALL: each record on the world-data door at its index, its block made of the player\'s own base when first read (mutants: the index; the base unread)', async () => {
  const W = await import('../../src/formats/worldData/worldDataReplacement.js');
  const { installCuratedBlocks } = await import('../../src/world/dungeon/curatedInstall.js');
  W._resetWorldDataReplacement();
  W.installWorldDataReplacement();
  const asked = [];
  W.bindWorldDataBlocks({ count: 100, getBlockIndex: (n) => (n === 'N0000023.RDB' ? 23 : -1), readClassicBlock: (k) => { asked.push(k); return k === 23 ? base() : null; }, getBlockByName: () => { throw new Error('a mod\'s block of the base\'s name is never read'); } });
  assert.equal(installCuratedBlocks([REC]), 1);
  assert.equal(W.getNewDFBlockIndex(curatedBlockName(7)), CURATED_BLOCK_INDEX + 7);
  const made = W.getDFBlockReplacementData(CURATED_BLOCK_INDEX + 7, curatedBlockName(7));
  assert.deepEqual([made?.name, asked], [curatedBlockName(7), [23]], 'made of BLOCKS.BSA\'s own base, by its index');
  W._resetWorldDataReplacement();
  assert.match(readFileSync(new URL('../../src/scenes/modWorldData.js', import.meta.url), 'utf8'), /\n {4}installShipRefit\(boundWorldDataBlocks\(\)\);[^\n]*\n {4}installCuratedBlocks\(\);[^\n]*\n {4}latchWorldDataDoor\(\);/, 'installed with the port\'s own blocks, before the door is latched and any is read');   // PIN MOVED (OWN-WORK3: the latch's answer unread, no pack to gate); PIN MOVED (the merges of URBANIZER U3 and the ships' refit: the towns' art, then the ships' files, first)
});

test('DLV5 EVERY SHIPPED RECORD ON THE FREEWARE\'S BLOCKS: its base an interior block of a dungeon of each of its types; each drop takes something; each anchor\'s heart and vault on a floor of the made block (ARENA2)', { skip: NO_ARENA2 }, async () => {
  const { BlocksFile } = await import('../../src/formats/blocksFile.js');
  const { MapsFile } = await import('../../src/formats/mapsFile.js');
  const bf = new BlocksFile();
  bf.load(new Uint8Array(readFileSync(join(/** @type {string} */ (ARENA2), 'BLOCKS.BSA'))));
  const maps = new MapsFile();
  maps.load(...['MAPS.BSA', 'CLIMATE.PAK', 'POLITIC.PAK'].map((f) => new Uint8Array(readFileSync(join(/** @type {string} */ (ARENA2), f)))));
  const usedBy = new Map();
  for (let r = 0; r < maps.regionCount; r++) {
    const reg = maps.getRegion(r);
    if (!reg) continue;
    for (let l = 0; l < Math.min(maps.baseLocationCount(r), reg.locationCount); l++) {
      const loc = maps.getLocation(r, l);
      for (const b of loc?.hasDungeon ? loc.dungeon.blocks : []) if (!b.isStartingBlock) { const t = usedBy.get(b.blockName) ?? new Set(); t.add(loc.mapTableData.dungeonType); usedBy.set(b.blockName, t); }
    }
  }
  for (const rec of CURATED_RECORDS) {
    const b = bf.getBlockByName(rec.base);
    assert.ok(b?.rdbBlock, `${rec.id}: ${rec.base} in BLOCKS.BSA`);
    for (const t of rec.types) assert.ok(usedBy.get(rec.base)?.has(t), `${rec.id}: ${rec.base} an interior block of a type ${t} dungeon`);
    const made = curatedBlockOf(b, rec), count = (x) => x.rdbBlock.objectRootList.slice(0, -1).reduce((n, g) => n + (g.rdbObjects?.length ?? 0), 0);
    for (const d of rec.drop ?? []) assert.ok(count(curatedBlockOf(b, { ...rec, drop: [d] })) < count(b), `${rec.id}: its drop at ${d.at} takes something`);
    assert.ok(made);
  }
  // each anchor where the site law would stand a site of its own (the start's rule aside: a curated block is never it)
  const { loadData } = await import('../../tools/climbDungeonProbe.mjs');
  const { hostModelReader, hostFireCollider } = await import('../../tools/dungeonFireProbe.mjs');
  const { colliderSiteProbe, landDelveSites, DSITE_SMALL } = await import('../../src/world/dungeon/delveSites.js');
  const { enemyMarks, itemMarks, fireLayoutInputs, blockWaterY } = await import('../../src/world/dungeon/dungeonFires.js');
  const W = await import('../../src/formats/worldData/worldDataReplacement.js');
  const { installCuratedBlocks } = await import('../../src/world/dungeon/curatedInstall.js');
  const data = loadData(ARENA2);
  W._resetWorldDataReplacement(); W.installWorldDataReplacement(); W.bindWorldDataBlocks(data.blocks); installCuratedBlocks();
  const getModel = hostModelReader(data.arch);
  for (const rec of CURATED_RECORDS) {
    const loc = { name: rec.id, hasDungeon: true, climate: { worldClimate: 231 }, mapTableData: { mapId: 1 }, dungeon: { recordElement: { header: { locationId: 1 } }, blocks: [{ x: 0, z: 0, blockName: curatedBlockName(rec.n), isStartingBlock: false }] } };
    const lay = layoutDungeon(loc, data.blocks, getModel);
    const probe = colliderSiteProbe(hostFireCollider(lay.blocks, getModel));
    const { doors } = fireLayoutInputs(lay.blocks, []);
    for (const a of rec.anchors) {
      const tally = {}, law = a.r === DSITE.r ? DSITE : DSITE_SMALL;
      const got = landDelveSites([{ pos: a.at, water: blockWaterY(lay.blocks[0].layout) }], { probe, doors, enemies: enemyMarks(lay.blocks), items: itemMarks(lay.blocks), fires: [], start: null, tally, law });
      assert.equal(got.length, 1, `${rec.id}: its ${a.kind} lands under the site law (refused: ${JSON.stringify(tally)})`);
      assert.ok(Math.abs(got[0].pos[1] - a.at[1]) < 0.05, `${rec.id}: its heart on the floor it names`);
    }
  }
  W._resetWorldDataReplacement();
});

test('DLV5 THE LAB\'S LAW (delve.html): a draft is number 0; a thing put at my feet to the centimetre, or refused by name; taken out by its place; the last anchor\'s vault set where I stand; the made location the draft the start, four borders of a real dungeon round it, keyed by no room and never spliced; the export the record as a shipped one is (mutants: the centimetre; the draft spliced; the export\'s number)', async () => {
  const L = await import('../../src/world/dungeon/curatedLab.js');
  const { setCuratedDraft, curatedRecordsLive } = await import('../../src/world/dungeon/curatedRecords.js');
  const d0 = L.labNew('my-hall', 'N0000023.RDB', DUNGEON_TYPES.Crypt);
  assert.equal(curatedRecordError(d0), null);
  assert.deepEqual(L.labDraftOf(CURATED_RECORDS[0]).n, 0);
  const p1 = L.labPut(d0, 'add', { model: 41300 }, [10.123, 0.004, 20.996]);
  assert.deepEqual(p1.draft.add, [{ model: 41300, at: [10.12, 0, 21] }]);
  assert.match(L.labPut(d0, 'anchors', { kind: 'clock', r: 4 }, [20, 0, 20]).why, /^anchors: a kind/);
  const p2 = L.labPut(p1.draft, 'anchors', { kind: 'hold', r: 4 }, [20, 0, 20]);
  assert.deepEqual(p2.draft.anchors, [{ kind: 'hold', r: 4, at: [20, 0, 20], vault: [20, 0, 20] }], 'its vault at its heart until set');
  assert.match(L.labVault(d0, [1, 1, 1]).why, /none yet/);
  assert.deepEqual(L.labVault(p2.draft, [16.6, 0, 20]).draft.anchors[0].vault, [16.6, 0, 20]);
  assert.deepEqual(L.labTake(p2.draft, 'add', 0).add, []);
  const tpl = { name: 'tpl', hasDungeon: true, climate: { worldClimate: 231 }, mapTableData: { mapId: 99, dungeonType: 0 }, dungeon: { recordElement: { header: { locationId: 5 } }, blocks: [{ blockName: 'N0000001.RDB' }, { blockName: 'B0000002.RDB' }, { blockName: 'B0000003.RDB' }] } };
  assert.deepEqual(L.labBorders(tpl), ['B0000002.RDB', 'B0000003.RDB', 'B0000002.RDB', 'B0000003.RDB']);
  const loc = L.labLocation(p2.draft, tpl);
  assert.deepEqual(loc.dungeon.blocks.map((b) => [b.blockName, b.x, b.z, b.isStartingBlock]), [[curatedBlockName(0), 0, 0, false], ['B0000002.RDB', 0, -1, false], ['B0000003.RDB', -1, 0, false], ['B0000002.RDB', 1, 0, false], ['B0000003.RDB', 0, 1, false]]);
  assert.deepEqual([loc.mapTableData.mapId, loc.delveLab, gameMade(loc)], [0, true, false], 'no room, never spliced');
  const ex = L.labExport(p2.draft, 3);
  assert.ok(ex.text.endsWith('}\n'));
  assert.deepEqual(JSON.parse(ex.text), { id: 'my-hall', n: 3, base: 'N0000023.RDB', types: [0], drop: [], add: [{ model: 41300, at: [10.12, 0, 21] }], anchors: p2.draft.anchors });
  assert.match(L.labExport(p2.draft, 1000).why, /^n/);
  assert.match(setCuratedDraft({ ...p2.draft, n: 4 }), /draft is number 0/);
  assert.equal(setCuratedDraft(p2.draft), null);
  assert.equal(curatedRecordsLive().at(-1).id, 'my-hall', 'the site law reads the draft beside the shipped');
  setCuratedDraft(null);
  assert.equal(curatedRecordsLive(), CURATED_RECORDS);
});

test('DLV5 THE BENCH\'S PLACES: `?spawn=px,py` the named dungeon cloned on that pixel as the world clones a spawn and built as the world builds it; `?dungeon=lab` the lab\'s draft - a shipped record\'s (its number kept), a kept one by its id, or the open one - registered as number 0 and laid, never as the start; a draft the law refuses, or a base the player\'s BLOCKS.BSA lacks, refused by name; any other ask the bench\'s own (AUDIT DLV5-6 M5, M6 - mutants: the pixel unread; the draft unregistered; the kept drafts unread by id)', async () => {
  const { benchLocation, readLabDraft } = await import('../../src/scenes/delve/delveBench.js');
  const { labKeep, labKept, LAB_DRAFTS_KEY, LAB_CURRENT_KEY } = await import('../../src/world/dungeon/curatedLab.js');
  const W = await import('../../src/formats/worldData/worldDataReplacement.js');
  const { spawnedMapId, WORLD_SALT } = await import('../../src/world/spawnedDungeons.js');
  const { setCuratedDraft } = await import('../../src/world/dungeon/curatedRecords.js');
  const tpl = { name: 'Bedard Laboratory', hasDungeon: true, climate: { worldClimate: 231 }, mapTableData: { mapId: 99, dungeonType: 0 }, exterior: { exteriorData: {} }, dungeon: { recordElement: { header: { locationId: 5 } }, blocks: [{ blockName: 'N0000001.RDB', isStartingBlock: true }, { blockName: 'B0000002.RDB' }] } };
  const maps = { regionCount: 1, getRegion: () => ({ locationCount: 1 }), baseLocationCount: () => 1, getLocation: () => tpl, getLocationByName: (r, n) => (n === tpl.name ? tpl : null) };
  const P = (q) => new URLSearchParams(q);
  const sp = benchLocation(P('dungeon=Bedard Laboratory&spawn=10,20'), maps, null);
  assert.deepEqual([sp.location.spawned, sp.location.mapTableData.mapId, sp.location.name], [true, spawnedMapId(WORLD_SALT, 10, 20), 'Bedard Laboratory (10,20)']);
  assert.equal(benchLocation(P('dungeon=Bedard Laboratory'), maps, null), null, 'the bench\'s own');
  W._resetWorldDataReplacement(); W.installWorldDataReplacement();
  const lab = benchLocation(P('dungeon=lab&lab=crypt-hall'), maps, null);
  assert.deepEqual([lab.draft.id, lab.draft.n, lab.draft.from, lab.location.dungeon.blocks[0].blockName, lab.location.dungeon.blocks[0].isStartingBlock], ['crypt-hall', 0, 1, curatedBlockName(0), false], 'its shipped number kept; never the start (no exit door of its base stands, as in the game)');
  assert.equal(W.getNewDFBlockIndex(curatedBlockName(0)), CURATED_BLOCK_INDEX, 'registered as number 0');
  assert.throws(() => benchLocation(P('dungeon=lab&lab=crypt-hall'), maps, null, { getBlockIndex: () => -1 }), /base: N0000023\.RDB is not in your BLOCKS\.BSA/);
  // the kept drafts: each by its id, the open one read when none is named; a refused one never kept
  const store = new Map(), storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => { store.set(k, v); } };
  assert.equal(labKeep(storage, { ...lab.draft, id: 'my-hall' }), null);
  assert.equal(labKeep(storage, { ...lab.draft, id: 'other-hall' }), null);
  assert.deepEqual([Object.keys(labKept(storage).drafts), store.get(LAB_CURRENT_KEY)], [['my-hall', 'other-hall'], 'other-hall']);
  assert.match(labKeep(storage, { ...lab.draft, id: 'my-hall', anchors: [{ kind: 'clock', at: [1, 0, 1], r: 4, vault: [1, 0, 1] }] }), /^anchors: a kind/);
  assert.equal(labKept(storage).drafts['my-hall'].anchors.length, 1, 'the kept one untouched by a refused keep');
  assert.match(labKeep({ getItem: () => null, setItem: () => { throw new Error('quota'); } }, lab.draft), /keeps no storage/);
  assert.deepEqual([readLabDraft(P(''), storage).id, readLabDraft(P('draft=my-hall'), storage).id, readLabDraft(P('draft=nobody'), storage)], ['other-hall', 'my-hall', null]);
  store.set(LAB_DRAFTS_KEY, JSON.stringify({ bad: { ...lab.draft, id: 'bad', anchors: [{ kind: 'clock', at: [1, 0, 1], r: 4, vault: [1, 0, 1] }] } }));
  assert.throws(() => benchLocation(P('dungeon=lab&draft=bad'), maps, storage), /the lab's draft: anchors: a kind/, 'a draft kept by an older lab still refused by name');
  assert.throws(() => benchLocation(P('dungeon=lab'), maps, { getItem: () => null }), /no draft/);
  store.set(LAB_DRAFTS_KEY, '{not json');
  assert.deepEqual(labKept(storage).drafts, {}, 'a broken store keeps none');
  setCuratedDraft(null);
  W._resetWorldDataReplacement();
});
