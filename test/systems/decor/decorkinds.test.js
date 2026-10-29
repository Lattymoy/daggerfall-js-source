// FIELD BUGS 2026-10-29b DECOR-KINDS (#feature-feedback, "Housing feedback & suggestions after 20 hours of decorating",
// item 2: "a lot of plants are located in the 'outdoor' category, while some furniture are located in 'dungeons', so it
// would be nice to have more of them"). A piece is filed by what it is - its picture's archive or its model's family -
// and only where nothing says, by where Daggerfall stood it; four kinds more: statues, tools, animals, remains.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { collectDecor, decorCatalogue, decorRoomEntries, decorWhatKind, addDecorNature, DECOR_KINDS, DECOR_FURNITURE_FIRST } from '../../../src/systems/decor/decorCatalogue.js';
import { RDB_RESOURCE_TYPES } from '../../../src/formats/blocksFile.js';
import { rmb } from '../../decorFakes.mjs';
import { HAS_ARENA2, loadBlocks } from '../../arena1Data.mjs';

const { Model, Flat } = RDB_RESOURCE_TYPES;
const rdb = (refs, objects) => ({
  rdbBlock: {
    modelReferenceList: refs.map((modelIdNum) => ({ modelIdNum, description: '' })),
    objectRootList: [{ rdbObjects: objects.map(([k, a, b]) => (k === 'm'
      ? { type: Model, resources: { modelResource: { modelIndex: a, actionResource: { flags: 0 } } } }
      : { type: Flat, resources: { flatResource: { textureArchive: a, textureRecord: b, action: 0 } } })) }],
  },
});
const street = (misc, miscFlats) => {
  const b = rmb().rmbBlock;
  return { rmbBlock: { ...b, misc3dObjectRecords: misc.map((modelIdNum) => ({ modelIdNum })), miscFlatObjectRecords: miscFlats.map(([a, r]) => ({ textureArchive: a, textureRecord: r })) } };
};

test('DECOR-KINDS the law: a picture by its archive, a model by its family or its name - a classic filing first, and null where nothing says (mutants: DECORKINDS-flat-table, DECORKINDS-model-table, DECORKINDS-family-lost, DECORKINDS-exterior-lost)', () => {
  const flat = (a) => decorWhatKind({ flat: [a, 0] });
  assert.deepEqual([213, 301, 97, 98, 202, 203, 201, 96, 206, 214, 218, 200, 208, 53, 212, 100, 300].map(flat),
    ['nature', 'nature', 'statues', 'statues', 'statues', 'statues', 'animals', 'remains', 'remains', 'tools', 'tools', 'decor', 'decor', 'outdoor', 'outdoor', 'dungeon', 'dungeon']);
  assert.deepEqual([210, 205, 254].map(flat), ['light', 'boxes', null], 'the game\'s own filing first; an archive nobody looked at says nothing');
  const model = (id) => decorWhatKind({ model: id });
  assert.deepEqual([41120, 41500, 42532, 42571, 43307, 62324, 74009, 74224, 99800, 74800, 74072, 60512, 51115].map(model),
    ['furniture', 'furniture', 'furniture', 'furniture', 'outdoor', 'statues', 'statues', 'arms', 'arms', 'decor', null, null, null]);
  assert.deepEqual([41000, 41811, 9000].map(model), ['bed', 'storage', 'door']);
  assert.equal(decorWhatKind({}), null);
  for (const k of ['statues', 'tools', 'animals', 'remains']) assert.ok(DECOR_KINDS[k], k);
});

test('DECOR-KINDS the catalogue: a dungeon\'s table is furniture and its statue a statue, a street\'s sunflower a plant and its horse an animal - and the street\'s plain pieces are a room\'s to place as before, its lamps and the climate\'s trees a yard\'s alone; a mod\'s piece is its furnishing still; what nothing names keeps its place\'s kind (mutants: DECORKINDS-what-unread, DECORKINDS-mods-what, DECORKINDS-room-offer)', () => {
  const blocks = [
    rmb([41120], [[213, 4], [254, 1]]),
    rdb([42532, 62324, 74072], [['m', 0], ['m', 1], ['m', 2], ['f', 206, 9], ['f', 254, 2]]),
    street([43307, 60512], [[301, 3], [201, 0], [210, 16]]),
  ];
  const c = collectDecor(blocks);
  addDecorNature(c);
  c.set('m45120', { model: 45120, flat: null, count: 1, from: 'mod', as: 41120 });
  const cat = decorCatalogue(c);
  const by = Object.fromEntries(cat.map((e) => [e.key, e]));
  const kinds = (keys) => keys.map((k) => by[k].kind);
  assert.deepEqual(kinds(['m42532', 'm62324', 'f206.9', 'f213.4', 'f301.3', 'f201.0', 'm43307']), ['furniture', 'statues', 'remains', 'nature', 'nature', 'animals', 'outdoor']);
  assert.deepEqual(kinds(['m74072', 'f254.2', 'm60512', 'f254.1', 'm41120', 'f210.16']), ['dungeon', 'dungeon', 'outdoor', 'decor', 'furniture', 'light'], 'nothing says: its place\'s kind');
  assert.equal(by.m45120.kind, 'mods', 'a mod\'s piece is its furnishing');
  assert.equal(by['f213.4'].name, 'Plant', 'a potted plant is no tree');
  const house = decorRoomEntries(cat, { kind: 'house' }, true).map((e) => e.key);
  for (const k of ['f301.3', 'f201.0', 'm43307', 'm60512', 'm42532', 'f213.4']) assert.ok(house.includes(k), `${k}: a room's to place`);
  for (const k of ['f210.16', 'f500.1']) assert.ok(!house.includes(k), `${k}: a yard's alone`);
  const yard = decorRoomEntries(cat, { kind: 'home', yard: true, natureBase: 500 }, true).map((e) => e.key);
  assert.ok(['f210.16', 'f500.1', 'f301.3'].every((k) => yard.includes(k)));
});

test('DECOR-KINDS the decorator\'s own lists file a piece as the catalogue does - a room\'s own furniture, and a piece the catalogue has not read (mutants: DECORKINDS-base-list, DECORKINDS-unread-piece)', () => {
  const t = readFileSync(new URL('../../../src/scenes/decor/decorTool.js', import.meta.url), 'utf8');
  assert.match(t, /const kind = decorWhatKind\(p\) \?\? \(p\.model != null \? 'furniture' : 'decor'\);/);
  assert.match(t, /const kind = decorWhatKind\(piece\) \?\? \(piece\.model != null \? 'furniture' : 'decor'\);/);
});

test('DECOR-KINDS measured (ARENA2): over every block, no model of the furniture families is a dungeon\'s or a street\'s piece - the dungeons\' 48 tables and benches among the furniture - every potted plant, crop and flower is with the trees and plants, and each new kind holds pieces', { skip: !HAS_ARENA2 && 'ARENA2_PATH not set' }, () => {
  const blocks = loadBlocks();
  const into = new Map();
  for (let i = 0; i < blocks.count; i++) { const b = blocks.readClassicBlock(i); if (b) collectDecor([b], into); }
  const cat = decorCatalogue(addDecorNature(into));
  const family = (e) => e.model != null && e.model >= DECOR_FURNITURE_FIRST && e.model < 43000;
  assert.deepEqual(cat.filter((e) => family(e) && (e.kind === 'dungeon' || e.kind === 'outdoor')).map((e) => e.key), []);
  assert.equal(cat.filter((e) => e.kind === 'furniture' && e.model >= 42500 && e.model <= 42571).length, 48);
  assert.deepEqual(cat.filter((e) => e.flat && (e.flat[0] === 213 || e.flat[0] === 301) && e.kind !== 'nature').map((e) => e.key), []);
  for (const k of ['statues', 'tools', 'animals', 'remains']) assert.ok(cat.filter((e) => e.kind === k).length >= 10, k);
});
