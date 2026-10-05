// DECOR-DUNGEON (FIELD BUGS 2026-10-05b, the owner: "There seems to be a lot of missing decor items with house
// decoration"; asked which, the dungeons' furnishings among them). The catalogue read the town blocks' rooms alone, so
// nothing Daggerfall stands only in its dungeons - a throne, a cage, a coffin, a statue, chains, a brazier - could be
// set in a house. A dungeon block has no prop type, so its furnishings are told from the dungeon itself by their family
// (41000-43999, the furniture and props) and the 37 things Daggerfall's dungeons stand outside them, as measured;
// a piece that acts (a lever, a moving throne) or is a door is never one, nor an editor's marker, a flat that acts, or
// the climate's nature. Pinned through the real collector, catalogue and scan, and the hosts' one deps constructor; the
// free-standing pieces are measured again over the player's own dungeons where ARENA2 is at hand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  collectDecor, decorCatalogue, decorRoomEntries, isDungeonFurnishing, DECOR_FREE_STANDING, DECOR_FURNITURE_FIRST,
  DECOR_FURNITURE_LAST, DECOR_KINDS, DECOR_FROM,
} from '../src/systems/decorCatalogue.js';
import { createDecorScan, decorScanDeps } from '../src/systems/decorScan.js';
import { BLOCK_TYPES, RDB_RESOURCE_TYPES } from '../src/formats/blocksFile.js';
import { LADDER_MODEL_ID } from '../src/player/enterExit.js';
import { rdbObjects, rdbModelActs, isActionDoor, EXIT_DOOR_MODEL_ID } from '../src/world/rdbLayout.js';
import { rmb, fakeBlocks } from './decorFakes.mjs';
import { HAS_ARENA2, loadBlocks } from './arena1Data.mjs';

const { Model, Flat, Light } = RDB_RESOURCE_TYPES;
/** THE FREE-STANDING PIECES AS MEASURED (2026-10-05, over the 187 dungeon blocks of BLOCKS.BSA): each one's tag in
 *  Daggerfall's dungeon editor and how many times a dungeon stands it doing nothing. */
const STANDS = Object.freeze({
  60512: ['ST1', 1], 60520: ['ST9', 1], 62317: ['XA2', 3], 62318: ['BM0', 5], 62319: ['BM0', 30], 62321: ['BM1', 12],
  62323: ['ST0', 26], 62324: ['ST1', 14], 62325: ['ST2', 5], 62326: ['ST3', 3], 62327: ['ST0', 6], 62328: ['ST1', 7],
  62329: ['ST2', 8], 62330: ['ST3', 6], 74009: ['CLM', 18], 74069: ['CAS', 1], 74071: ['BCH', 2], 74072: ['BCX', 9],
  74073: ['LID', 1], 74082: ['TRP', 1], 74086: ['TSP', 1], 74091: ['HT3', 1], 74094: ['MAN', 1], 74201: ['CLM', 19],
  74221: ['BOW', 1], 74224: ['SWD', 7], 74225: ['AXE', 7], 74226: ['AMR', 10], 74227: ['SWD', 10], 74228: ['BW2', 5],
  74229: ['ARC', 15], 74237: ['PED', 1], 74800: ['LRG', 5], 74804: ['LRG', 1], 74806: ['LRG', 5], 75800: ['SRG', 2],
  99800: ['ARW', 2],
});

/** A parsed RDB block: `refs` its model reference list ([id, tag]), `objects` its objects - a model `['m', ref, acts]`,
 *  a flat `['f', archive, record, action]`, a light `['l']` - in one object group. */
function rdb(refs, objects) {
  return {
    rdbBlock: {
      modelReferenceList: refs.map(([modelIdNum, description = '']) => ({ modelIdNum, description })),
      objectRootList: [{ rdbObjects: null }, {
        rdbObjects: objects.map(([kind, a, b, c = 0]) => (kind === 'm'
          ? { type: Model, resources: { modelResource: { modelIndex: a, actionResource: { flags: b ? 4 : 0 } } } }
          : kind === 'f'
            ? { type: Flat, resources: { flatResource: { textureArchive: a, textureRecord: b, action: c } } }
            : { type: Light, resources: { lightResource: { radius: 10 } } })),
      }],
    },
  };
}
/** A dungeon block standing a little of everything: architecture, a throne (one acting, one not), a door, a statue, the
 *  ladder, the exit door, a lever's model; an editor's marker, a brazier, chains, a tree, a prisoner, a flat that acts. */
const DUNGEON = rdb(
  [[56000, 'COR'], [41123, 'THR'], [55000, 'DOR'], [62324, 'STA'], [LADDER_MODEL_ID, 'LAD'], [70300, 'EXT'], [61027, 'LEV'], [41120]],
  [['m', 0], ['m', 1, false], ['m', 1, true], ['m', 2], ['m', 3], ['m', 4], ['m', 5], ['m', 6], ['m', 7], ['l'],
    ['f', 199, 15], ['f', 210, 0], ['f', 100, 2], ['f', 100, 2], ['f', 504, 12], ['f', 182, 3], ['f', 100, 7, 2]],
);

test('DECOR-DUNGEON the law: a dungeon\'s furnishing is of the furniture families (the ladder aside) or a free-standing piece Daggerfall keeps outside them, as measured - never the dungeon itself (mutants: DECORDUNGEON-architecture-taken, DECORDUNGEON-free-standing-lost)', () => {
  assert.deepEqual([DECOR_FURNITURE_FIRST, DECOR_FURNITURE_LAST], [41000, 43999]);
  assert.deepEqual([41000, 41123, 41313, 42501, 43011, 43999].map(isDungeonFurnishing), [true, true, true, true, true, true]);
  assert.deepEqual([LADDER_MODEL_ID, 40999, 44000, 55000, 56000, 58012, 60506, 61026, 61027, 70300, 72100, 74037, 74044, 74204].map(isDungeonFurnishing), Array(14).fill(false),
    'the ladder, the architecture, a portcullis, the lever and its housing, the exit and the doors, the wheel, a cone of rock, a platform');
  assert.deepEqual([...DECOR_FREE_STANDING].sort((a, b) => a - b), Object.keys(STANDS).map(Number), 'the measured pieces, and only they');
  for (const id of DECOR_FREE_STANDING) {
    assert.equal(isDungeonFurnishing(id), true, `${id}`);
    assert.ok(id < DECOR_FURNITURE_FIRST || id > DECOR_FURNITURE_LAST, `${id} stands outside the families - the only reason it is listed`);
  }
});

test('DECOR-DUNGEON the free-standing pieces, measured (ARENA2): each stands doing nothing in Daggerfall\'s own dungeons as many times as recorded, under the tag recorded - none listed that no dungeon stands; and the 187 dungeon blocks stand 731 models still outside the families, these and the dungeon itself', { skip: !HAS_ARENA2 && 'ARENA2_PATH not set' }, () => {
  const blocks = loadBlocks();
  const still = new Map();
  let dungeons = 0;
  for (let i = 0; i < blocks.count; i++) {
    if (blocks.getBlockType(i) !== BLOCK_TYPES.Rdb) continue;
    const rdb = blocks.readClassicBlock(i)?.rdbBlock;
    if (!rdb) continue;
    dungeons++;
    for (const obj of rdbObjects(rdb)) {
      if (obj.type !== Model) continue;
      const ref = obj.resources.modelResource.modelIndex;
      const { modelIdNum: id, description: tag } = rdb.modelReferenceList[ref];
      if ((id >= DECOR_FURNITURE_FIRST && id <= DECOR_FURNITURE_LAST) || id === LADDER_MODEL_ID || id === EXIT_DOOR_MODEL_ID) continue;
      if (rdbModelActs(obj) || isActionDoor(rdb, ref)) continue;
      const s = still.get(id) ?? { tags: new Set(), n: 0 };
      s.tags.add(tag);
      s.n++;
      still.set(id, s);
    }
  }
  assert.deepEqual([dungeons, still.size], [187, 731]);
  for (const id of DECOR_FREE_STANDING) assert.deepEqual([[...(still.get(id)?.tags ?? [])], still.get(id)?.n ?? 0], [[STANDS[id][0]], STANDS[id][1]], `${id}`);
});

test('DECOR-DUNGEON the collector: a dungeon block gives its furnishings - the throne that stands still (never the one that acts), the statue, a brazier, the chains, a prisoner - and none of its architecture, doors, ladder, markers, lights, acting flats or nature; a piece found in a room is the room\'s, every placement counted (mutants: DECORDUNGEON-actions-taken, DECORDUNGEON-doors-taken, DECORDUNGEON-markers-taken, DECORDUNGEON-acting-flats-taken, DECORDUNGEON-nature-taken, DECORDUNGEON-people-unread, DECORDUNGEON-room-reading-lost)', () => {
  const c = collectDecor([DUNGEON]);
  assert.deepEqual([...c.keys()].sort(), ['f100.2', 'f182.3', 'f210.0', 'm41120', 'm41123', 'm62324']);
  assert.equal(c.get('m41123').count, 1, 'the acting throne is no piece');
  assert.equal(c.get('f100.2').count, 2);
  assert.equal(c.get('f182.3').person, true, 'a dungeon\'s person is a person');
  assert.ok([...c.values()].every((x) => x.from === 'dungeon'));
  // read with a town block: the room's reading wins whichever came first, and the counts are every placement's
  for (const order of [[DUNGEON, rmb([41120], [[100, 2]])], [rmb([41120], [[100, 2]]), DUNGEON]]) {
    const both = collectDecor(order);
    assert.deepEqual([both.get('m41120').from, both.get('m41120').count], ['room', 2]);
    assert.deepEqual([both.get('f100.2').from, both.get('f100.2').count, both.get('f100.2').person], ['room', 3, undefined]);
  }
  assert.deepEqual(DECOR_FROM, { room: 0, dungeon: 1, street: 2, nature: 3, mod: 4, modstreet: 5 }, 'the rooms first, then the dungeons (DECOR-OUTDOOR: then the street and the nature; DECOR-MODS: then the town mods\' rooms and streets)');
  assert.deepEqual([...collectDecor([{ rdbBlock: {} }, { rdbBlock: { modelReferenceList: [], objectRootList: [] } }]).keys()], [], 'an empty dungeon gives nothing');
});

test('DECOR-DUNGEON the catalogue: what stands in a dungeon and in no house is Dungeon furniture unless the game files it (a light stays a light, a prisoner a Vendor); a room\'s names never move for the dungeons read - theirs are numbered after; and every room offers them (mutants: DECORDUNGEON-kind-unset, DECORDUNGEON-numbered-mixed)', () => {
  assert.equal(DECOR_KINDS.dungeon, 'Dungeon furniture');
  const room = rmb([41120], [[210, 99], [210, 98]], [], [[182, 5]]);
  const cat = decorCatalogue(collectDecor([room, DUNGEON, rdb([[41121]], [['m', 0], ['f', 210, 50], ['f', 182, 1]])]));
  const by = Object.fromEntries(cat.map((e) => [e.key, e]));
  assert.deepEqual(['m41123', 'm62324', 'f100.2', 'm41121'].map((k) => by[k].kind), ['dungeon', 'dungeon', 'dungeon', 'dungeon']);
  assert.deepEqual(['f210.0', 'f182.3', 'm41120'].map((k) => by[k].kind), ['light', 'people', 'furniture'], 'filed as the game files it; the room\'s chair is the room\'s');
  assert.deepEqual([by['f210.0'].name, by['f210.0'].from], ['Bowl with fire', 'dungeon'], 'a light Daggerfall Unity names keeps its name');
  // the room's names, read alone and with the dungeons: the same - the dungeons' are numbered after them
  const alone = Object.fromEntries(decorCatalogue(collectDecor([room])).map((e) => [e.key, e.name]));
  for (const [k, name] of Object.entries(alone)) assert.equal(by[k].name, name, `${k} keeps "${name}"`);
  assert.deepEqual([alone['f210.98'], alone['f210.99'], by['f210.50'].name], ['Light 1', 'Light 2', 'Light 3'], 'a dungeon\'s unnamed light after the room\'s, though its record is lower');
  assert.deepEqual([alone['f182.5'], by['f182.1'].name, by['f182.3'].name], ['Vendor', 'Vendor 2', 'Vendor 3']);
  for (const r of [{ kind: 'house' }, { kind: 'ship' }, { kind: 'home', yard: true }, { kind: 'home', hall: true }]) {
    assert.ok(['m41123', 'm62324', 'f100.2'].every((k) => decorRoomEntries(cat, r, true).some((e) => e.key === k)), JSON.stringify(r));
  }
});

test('DECOR-DUNGEON the scan, through the hosts\' one constructor: a dungeon block is read for its furnishings, measured and priced as every piece; a host that says no dungeon reads none (mutant: DECORDUNGEON-scan-unread)', async () => {
  const blocks = fakeBlocks([{ type: BLOCK_TYPES.Rmb, block: rmb([41000]) }, { type: BLOCK_TYPES.Rdb, block: DUNGEON }, { type: BLOCK_TYPES.Rdi, block: DUNGEON }]);
  const arch = { getRecordIndex: (id) => id, getMesh: () => ({ radius: 40 }) };
  const getTexture = async () => ({ recordCount: 32, getSize: () => ({ width: 32, height: 64 }), getScale: () => ({ width: 0, height: 0 }) });
  const deps = decorScanDeps({ blocks, arch, getTexture });
  assert.deepEqual([deps.isTownBlock(BLOCK_TYPES.Rmb), deps.isDungeonBlock(BLOCK_TYPES.Rdb), deps.isDungeonBlock(BLOCK_TYPES.Rdi)], [true, true, false]);
  assert.equal(deps.modelRadius(41123), 1, 'a model\'s ARCH3D radius in metres (40 classic units)');
  const scan = createDecorScan(deps);
  for (let i = 0; i < 20 && scan.phase() !== 'done'; i++) { scan.step(); await new Promise((r) => setTimeout(r, 0)); }
  assert.equal(scan.phase(), 'done');
  const e = scan.entries();
  assert.ok(['m41123', 'm62324', 'f100.2', 'f182.3'].every((k) => e.some((x) => x.key === k)), 'the dungeon\'s furnishings');
  assert.ok(scan.radiusOf(e.find((x) => x.key === 'm41123')) > 0 && scan.radiusOf(e.find((x) => x.key === 'f100.2')) > 0, 'measured, so priced');
  const townOnly = createDecorScan({ ...deps, isDungeonBlock: undefined });
  while (townOnly.phase() === 'blocks') townOnly.step();
  assert.equal(townOnly.entries().some((x) => x.key === 'm41123'), false, 'no dungeon asked, none read');
});
