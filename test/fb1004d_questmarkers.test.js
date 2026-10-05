// QUEST-MARKERS (FIELD BUGS 2026-10-04d, the town-mods audit: "unreachable quest markers"). The audit measured every
// quest marker (editor flats 199.11, a person or foe, and 199.18, an item) of every building interior the two vendored
// town packs lay out against the interior the port builds, and six of the packs' interior designs - the door serves
// them in 1,105 buildings of 665 towns - hold one no player can reach: a House4 item marker inside the stairs (two designs), a House2 person marker
// 3.75 m under the floor, another in the attic of the exterior model its author placed inside the house, and Beautiful
// Cities' library (DALIBRBL01/03 - the author's own interior over LIBRAL01/03) with a person marker four metres outside
// its east wall and another inside a solid. DFU stands the quest's people and things there all the same (Place.cs
// AssignQuestResource; AlignBillboardToGround finds no floor and leaves the billboard where it is), and the quest
// cannot be done.
//  - THE CURATION (systems/quest/markerCuration.js): each such marker, keyed by the pack, the block, the building's
//    record, its kind and its very position, is enumerated at its measured floor spot - a MOVE, never a drop, so every
//    marker DFU's quest law counts and indexes is still there. A site enumerated before the curation (a save's) is
//    mended by the load's pass, what each moved marker holds moved with it.
//  - THE BACKSTOP (scenes/worldModes.js's building stands, sceneMount.js standSpot): a building's quest marker with no
//    floor within reach under it - one the curation does not list - stands its person, foe or item at the site's
//    nearest marker with a floor, else at the room's nearest enter marker. A marker with a floor stands as DFU stands it.
// The list is tools/townQuestMarkers.mjs's measure of the player's own data; the gated test below measures it again.
// The packs are read here as the door reads them, with no game data (the pack-only pins), the site is the quest
// machine's own over synthetic blocks (test/fb1004dTowns.mjs), and the stands are worldModes.js's own source run over
// a real Collider floor.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { QuestMachine } from '../src/systems/quest/machine.js';
import { SITE_TYPES, MARKER_TYPES } from '../src/systems/quest/place.js';
import { CURATED_QUEST_MARKERS, curatedMarkerSpot } from '../src/systems/quest/markerCuration.js';
import { addQuestResourceObjects, markerScenePosition, siteMarkerSpots, standSpot, MARKER_FLOOR_REACH } from '../src/systems/quest/sceneMount.js';
import { registerWorldDataAsset, _resetWorldDataReplacement, installWorldDataReplacement, buildingDataFromJson } from '../src/formats/worldDataReplacement.js';
import { ROW_CODECS } from '../src/formats/worldDataPack.js';
import { patchJson } from '../src/formats/worldDataJson.js';
import { _resetLayoutPins } from '../src/systems/layoutPins.js';
import { Collider } from '../src/player/collider.js';
import { templateByIndex } from '../src/systems/itemTemplates.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { loadTables, rmbBlock, town, worldOf, mark, SPAWN, ITEM, ENTER } from './fb1004dTowns.mjs';
import { ARENA2, HAVE_ARENA2, SKIP, BV, BC, packJson, openTowns, everyLocation } from './fb1004dArena.mjs';

loadTables();
const { House1, House2, House4 } = BUILDING_TYPES;
const UNIT = 0.025;   // MeshReader.GlobalScale
/** A marker's flatPosition as EnumerateBuildingQuestMarkers writes it (x, -y, z) * GlobalScale, from block units. */
const flat = ([x, y, z]) => ({ x: x * UNIT, y: -y * UNIT, z: z * UNIT });

// ---- the vendored packs, read as the door reads them ----

const PACKS = { [BV]: packJson(BV), [BC]: packJson(BC) };
const CLASSIC = Symbol('a piece of the player\'s BLOCKS.BSA');
/** A pack value with its nodes, rows and runs expanded as the door's reader expands them (formats/worldDataPack.js
 *  openWorldDataPack: the pack's own ROW_CODECS, WD1's patchJson for a node's `$o`) - a `$c`, a piece of the player's own
 *  BLOCKS.BSA, is CLASSIC: no game data is here. */
function packValue(P, v) {
  if (Array.isArray(v)) return v.map((x) => (x !== null && typeof x === 'object' ? packValue(P, x) : x));
  if (v === null || typeof v !== 'object') return v;
  const k = Object.keys(v).find((key) => key.startsWith('$') && key !== '$o');
  if (!k) return Object.fromEntries(Object.entries(v).map(([key, x]) => [key, x !== null && typeof x === 'object' ? packValue(P, x) : x]));
  if (k === '$c') return CLASSIC;
  let node;
  if (k === '$n') { const n = P.nodes[v.$n]; node = packValue(P, typeof n === 'string' ? JSON.parse(n) : n); }
  else if (k === '$r') { node = []; for (let i = 0; i < v.$r.length; i += 2) for (let n = 0; n < v.$r[i + 1]; n++) node.push(v.$r[i]); }
  else node = v[k].map((row) => (Array.isArray(row) || typeof row === 'number' ? ROW_CODECS[k](row) : packValue(P, row)));
  return v.$o ? patchJson(node, v.$o.map((op) => (op[0] === 's' || op[0] === 'i' ? [op[0], op[1], packValue(P, op[2])] : op))) : node;
}
/** FIELD BUGS 2026-10-05 SEALED-CELLAR: a file's building record - its whole list's, or, where the file edits the
 *  classic list entry by entry (Beautiful Cities' KSCAAL01: sets, an insert and a removal), the entry its own ops leave
 *  at `record` over a list of the classic's places (null: the classic's, unedited). */
function buildingAt(P, file, record) {
  const whole = setAt(P, file, 'RmbBlock.FldHeader.BuildingDataList');
  if (whole) return whole[record];
  const PATH = ['RmbBlock', 'FldHeader', 'BuildingDataList'];
  const ops = entryOf(P, file)[2].filter((o) => o[1].length === 4 && o[1].slice(0, 3).join() === PATH.join())
    .map((o) => (o[0] === 's' || o[0] === 'i' ? [o[0], o[1], packValue(P, o[2])] : o));
  return patchJson({ RmbBlock: { FldHeader: { BuildingDataList: new Array(64).fill(null) } } }, ops).RmbBlock.FldHeader.BuildingDataList[record];
}
const entryOf = (P, name) => { const e = P.files[name]; return typeof e === 'string' ? JSON.parse(e) : e; };
/** The value a file's own op sets whole at `path` - or, for a file based on another of the pack, that file's. */
function setAt(P, name, path) {
  for (let file = name; file;) {
    const [, base, ops] = entryOf(P, file);
    const op = ops.find((o) => o[0] === 's' && o[1].join('.') === path);
    if (op) return packValue(P, op[2]);
    file = base[0] === 'f' ? base[1] : null;
  }
  return undefined;
}
const isMarker = (f, record, [x, y, z]) => f.TextureArchive === 199 && f.TextureRecord === record && f.XPos === x && f.YPos === y && f.ZPos === z;

test('QUEST-MARKERS, the list against the vendored packs (no game data): every building it names is its pack\'s own block - that pack\'s alone, so the key names one block - of the design\'s building type, the author\'s own interior, holding each listed marker exactly where the list says', () => {
  let places = 0, markers = 0;
  for (const d of CURATED_QUEST_MARKERS) {
    assert.equal(d.design, `${d.where[0][1]}#${d.where[0][2]}`, 'a design is named for its first building');
    markers += d.markers.length;
    for (const m of d.markers) {
      assert.ok(m.record === SPAWN || m.record === ITEM, 'a quest marker: 199.11 or 199.18');
      assert.notDeepEqual(m.to, m.at, 'moved');
    }
    for (const [vendor, block, record] of d.where) {
      places++;
      const file = `${block}.json`, P = PACKS[vendor];
      assert.ok(P.files[file] !== undefined, `${vendor} carries ${file}`);
      for (const other of Object.keys(PACKS)) if (other !== vendor) assert.equal(PACKS[other].files[file], undefined, `${file} is ${vendor}'s alone`);
      assert.equal(buildingDataFromJson(buildingAt(P, file, record)).buildingType, d.buildingType, `${block} #${record}: the design's building type`);
      const sub = setAt(P, file, 'RmbBlock.SubRecords')?.[record];
      assert.ok(sub && sub !== CLASSIC && sub.Interior && sub.Interior !== CLASSIC, `${block} #${record}: the author's own interior, carried in the pack`);
      for (const m of d.markers) {
        assert.equal(sub.Interior.BlockFlatObjectRecords.filter((f) => isMarker(f, m.record, m.at)).length, 1, `${vendor} ${block} #${record}: 199.${m.record} at ${m.at}`);
      }
    }
  }
  // FIELD BUGS 2026-10-05 SEALED-CELLAR: and fourteen designs past a shut hatch, 128 interiors, fourteen markers
  assert.deepEqual([CURATED_QUEST_MARKERS.length, places, markers], [20, 179, 22], 'twenty designs in 179 of the packs\' building interiors, 22 markers');
});

test('QUEST-MARKERS: Beautiful Cities\' library is the author\'s own design - DALIBRBL01 #14 and DALIBRBL03 #3 carry their interiors in the pack, made over LIBRAL01 and LIBRAL03, while the pack\'s own LIBRAL01 #14 and LIBRAL03 #3 are Daggerfall\'s (a reference into the player\'s BLOCKS.BSA)', () => {
  const P = PACKS[BC];
  assert.deepEqual(entryOf(P, 'DALIBRBL01.RMB.json')[1].slice(0, 2), ['b', 'LIBRAL01.RMB'], 'made over Daggerfall\'s LIBRAL01');
  assert.deepEqual(entryOf(P, 'DALIBRBL03.RMB.json')[1], ['f', 'LIBRAL03.RMB.json'], 'made over the pack\'s LIBRAL03');
  for (const [block, record] of [['DALIBRBL01.RMB', 14], ['DALIBRBL03.RMB', 3]]) {
    const sub = setAt(P, `${block}.json`, 'RmbBlock.SubRecords')[record];
    assert.notEqual(sub.Interior, CLASSIC, `${block} #${record}: the author's interior`);
    assert.equal(buildingDataFromJson(setAt(P, `${block}.json`, 'RmbBlock.FldHeader.BuildingDataList')[record]).buildingType, BUILDING_TYPES.Library);
  }
  for (const [block, record] of [['LIBRAL01.RMB', 14], ['LIBRAL03.RMB', 3]]) {
    assert.equal(setAt(P, `${block}.json`, 'RmbBlock.SubRecords')[record].Interior, CLASSIC, `${block} #${record}: Daggerfall's own library`);
  }
});

// ---- the key ----

test('QUEST-MARKERS, the key: a marker moves only in a block a town pack serves (fromWorldData), under a name the listed pack carries on the door, in the listed record, of the listed kind, at its very position - Daggerfall\'s own block of the name, another pack\'s, another record, another kind or a unit off stand as they are (mutants: the four guards)', () => {
  _resetWorldDataReplacement(); installWorldDataReplacement();
  const AT = [-354, 0, -100];
  const served = rmbBlock('PAWNGM00.RMB', [{ type: House4 }], { fromWorldData: true });
  assert.equal(curatedMarkerSpot(served, 0, ITEM, ...AT), null, 'no pack on the door carries PAWNGM00');
  registerWorldDataAsset('PAWNGM00.RMB.json', {}, null, { vendor: BC });
  assert.equal(curatedMarkerSpot(served, 0, ITEM, ...AT), null, 'another pack\'s PAWNGM00');
  registerWorldDataAsset('PAWNGM00.RMB.json', {}, null, { vendor: BV });
  assert.deepEqual(curatedMarkerSpot(served, 0, ITEM, ...AT), [-300, 0, -43], 'Beautiful Villages\' PAWNGM00, its House4 #0: the stairs\' item marker on the floor');
  assert.equal(curatedMarkerSpot(rmbBlock('PAWNGM00.RMB', [{ type: House4 }]), 0, ITEM, ...AT), null, 'Daggerfall\'s own PAWNGM00 (BLOCKS.BSA)');
  assert.equal(curatedMarkerSpot(served, 1, ITEM, ...AT), null, 'another building of the block');
  assert.equal(curatedMarkerSpot(served, 0, SPAWN, ...AT), null, 'a person\'s marker there');
  for (const axis of [0, 1, 2]) {
    const off = [...AT]; off[axis] += 1;
    assert.equal(curatedMarkerSpot(served, 0, ITEM, ...off), null, `a unit off on axis ${axis}`);
  }
  // every listed marker, keyed as listed
  for (const d of CURATED_QUEST_MARKERS) {
    for (const [vendor, block, record] of d.where) {
      registerWorldDataAsset(`${block}.json`, {}, null, { vendor });
      for (const m of d.markers) assert.deepEqual(curatedMarkerSpot(rmbBlock(block, [], { fromWorldData: true }), record, m.record, ...m.at), m.to, `${vendor} ${block} #${record}`);
    }
  }
  _resetWorldDataReplacement();
});

// ---- the quest's site, as the machine enumerates and mends it ----

const MAP_ID = 4242;
const AT = [-354, 0, -100], TO = [-300, 0, -43];   // the design's item marker, and its floor spot
/** A village of one block, RESIGM02 - Beautiful Villages' as the door serves it (fromWorldData, the pack's file on the
 *  door unless `carried` is false) or Daggerfall's own - whose House4, record 3, is the design RESIGM02 #3: its item
 *  marker in the stairs and a person's on the floor. The quest `qbn` is started there; a farm of the region is where a
 *  quest's person has its home. */
function village({ qbn, fromWorldData = true, carried = true, markers = [mark(ITEM, ...AT), mark(SPAWN, 40, 0, 40)], type = House4, rolls = () => 0 }) {
  _resetLayoutPins(); _resetWorldDataReplacement(); installWorldDataReplacement();
  if (carried) registerWorldDataAsset('RESIGM02.RMB.json', {}, null, { vendor: BV });
  const blocks = new Map([
    ['RESIGM02.RMB', rmbBlock('RESIGM02.RMB', [{ type: House1 }, { type: House1 }, { type: House1 }, { type, markers }], { fromWorldData })],
    ['FARM.RMB', rmbBlock('FARM.RMB', [{ type: House1 }])],
  ]);
  const farm = town({ name: 'Ashford', locationIndex: 0, mapId: MAP_ID + 1, grid: ['FARM.RMB'] });
  const hamlet = town({ name: 'Aldleigh', locationIndex: 1, mapId: MAP_ID, grid: ['RESIGM02.RMB'] });
  const world = worldOf({ locations: [farm, hamlet], blocks, current: hamlet });
  const machine = new QuestMachine({ nowSeconds: () => 0, world, getReputation: () => 0, changeReputation: () => {} });
  const quest = machine.parseQuestForLists(['Quest: __MARKERS', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', ...qbn, 'variable _done_'], 0, { rolls });
  machine.startQuestImmediate(quest);
  machine.tick();   // the start-up task's placements
  return { machine, quest, world, place: (name) => quest.getPlace({ name }) };
}
const GEM = ['Item _gem_ sapphire', 'Place _house_ local house4', '', '\tplace item _gem_ at _house_', ''];

test('QUEST-MARKERS, at quest start: the House4 of Beautiful Villages\' RESIGM02 enumerates its stairs\' item marker at the measured floor spot, and the gem is placed there - its person\'s marker as it was; in Daggerfall\'s own RESIGM02, or with no pack on the door to serve it, the marker is the block\'s (mutant: the enumeration not curated)', () => {
  const sd = village({ qbn: GEM }).place('house').siteDetails;
  assert.equal(sd.buildingKey & 0xff, 3, 'the House4, record 3');
  assert.deepEqual(sd.questItemMarkers.map((m) => m.flatPosition), [flat(TO)], 'the item marker on the floor');
  assert.deepEqual(sd.questSpawnMarkers.map((m) => m.flatPosition), [flat([40, 0, 40])], 'the person\'s marker, sound, untouched');
  assert.equal(sd.selectedMarker.markerType, MARKER_TYPES.QuestItem, 'an item takes an item marker first');
  assert.deepEqual(sd.selectedMarker.flatPosition, flat(TO), 'the gem stands on the floor');
  assert.deepEqual(sd.selectedMarker.targetResources.map((s) => s.name), ['gem']);
  for (const [why, opts] of [['Daggerfall\'s own block', { fromWorldData: false }], ['no pack on the door serves it', { carried: false }]]) {
    const c = village({ qbn: GEM, ...opts }).place('house').siteDetails;
    assert.deepEqual(c.questItemMarkers.map((m) => m.flatPosition), [flat(AT)], why);
    assert.deepEqual(c.selectedMarker.flatPosition, flat(AT), why);
  }
});

test('QUEST-MARKERS, at load: a site enumerated before the curation (a save\'s) has its marker moved by the load\'s pass - in its list and as the selected marker, the gem it holds with it - no site counted as moved, its building and its link kept, and a second pass moves nothing (mutants: no mend; the list, the selected marker, the record)', () => {
  const v = village({ qbn: GEM, carried: false });   // the curation cannot see the block: the site keeps the author's marker, as a save from before it does
  const place = v.place('house');
  const key = place.siteDetails.buildingKey;
  assert.deepEqual(place.siteDetails.selectedMarker.flatPosition, flat(AT), 'the save\'s marker, in the stairs');
  registerWorldDataAsset('RESIGM02.RMB.json', {}, null, { vendor: BV });   // the game as it is: the pack's block on the door
  assert.equal(v.machine.reseatMovedSites(v.world), 0, 'no site moved');
  const sd = place.siteDetails;
  assert.equal(sd.buildingKey, key, 'the same building');
  assert.deepEqual(sd.questItemMarkers.map((m) => m.flatPosition), [flat(TO)], 'the list\'s marker on the floor');
  assert.deepEqual(sd.selectedMarker.flatPosition, flat(TO), 'and the selected marker');
  assert.deepEqual(sd.selectedMarker.targetResources.map((s) => s.name), ['gem'], 'the gem with it');
  assert.deepEqual(sd.questSpawnMarkers.map((m) => m.flatPosition), [flat([40, 0, 40])], 'a sound marker untouched');
  assert.equal(v.machine.getSiteLinks(SITE_TYPES.Building, MAP_ID, key).length, 1, 'its link stands');
  assert.equal(place.mendCuratedMarkers(v.world), 0, 'nothing left to move');
});

// ---- the backstop: worldModes.js's building stands over a real floor ----

const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
/** A room: its floor 18 m by 12 m at y 0 in the parent frame (x 92..110, z 44..56), the building's frame 100 m east and
 *  50 m north of it (interiorContext.js's parentPt), and `enter` its enter markers in the parent frame. */
function room(enter = [[93, 0, 50]]) {
  const collider = new Collider(() => -Infinity);
  collider.addMesh('room', new Float32Array([92, 0, 44, 110, 0, 44, 110, 0, 56, 92, 0, 56]), new Uint32Array([0, 1, 2, 0, 2, 3]), IDENTITY);
  return { collider, parentPt: (x, y, z) => [x + 100, y, z + 50], enterMarkers: enter, billboardBatches: [] };
}
/** worldModes.js's building quest stands, lifted out and run over `ctx` (AUDIT MERGE-PLUS A1's lift, as
 *  test/audit1003_wd.test.js lifts buyHallAt): the stand law (standQuestFlatIn), the interior host's wrapper, the
 *  backstop's spots (interiorStandSpots) and the interior adapter (standNPC, standItem, standFoe) - the host's own
 *  source; a billboard 1 m by 2 m. */
function liftInteriorStands(ctx) {
  const WM = readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8');
  const cut = (start, end) => {
    const a = WM.indexOf(start);
    assert.ok(a >= 0, `worldModes.js: ${start.trim()}`);
    return WM.slice(a, WM.indexOf(end, a) + end.length);
  };
  const source = [
    cut('export const INTERIOR_MARKER_FEET_LIFT = ', ';\n').replace(/^export /, ''),
    cut('  const QUEST_ITEM_MARKER_SHIFT = ', ';\n'),
    cut('  function standQuestFlatIn(', '\n  }\n'),
    cut('  const standQuestFlat = ', ';\n'),
    cut('  const interiorStandSpots = ', '\n  };\n'),
    cut('  const questAdapter = {', '\n  };\n'),
    'return questAdapter;',
  ].join('\n');
  const questFlats = [], foes = [];
  const deps = {
    questFlats, interiorCtx: ctx, interiorFoeStands: [], _enemyRestoreInProgress: false,
    interiorFoes: { spawnFoe: (foeType, feet) => { foes.push({ foeType, feet }); return Promise.resolve(); } },
    questSceneCtx: () => ({ mapId: MAP_ID }), sceneBehaviours: () => questFlats.map((s) => s.behaviour),
    getTexture: async () => ({ recordCount: 1000 }), uploadRecord: () => {}, billboardSize: () => ({ w: 1, h: 2 }), drawnFlat: (a, r) => [a, r],
    renderer: { createBillboardBatch: (_a, _r, _size, at) => ({ at: at[0] }) }, rideSceneMarker: () => {},
    templateByIndex, markerScenePosition, siteMarkerSpots, standSpot, MARKER_FLOOR_REACH,
  };
  return { adapter: new Function(...Object.keys(deps), source)(...Object.values(deps)), questFlats, foes };
}
const PARTY = ['Person _pp_ group Questor', 'Item _l_ letter', 'Foe _crook_ is Thief', 'Place _house_ local house2', '',
  '\tplace npc _pp_ at _house_', '\tplace item _l_ at _house_', '\tplace foe _crook_ at _house_', ''];
/** The quest's person, letter and foe stood in the House2 of Daggerfall's own RESIGM02 (no curation) holding `markers`,
 *  every one at the selected marker (GetSiteMarker's reuse law): { npc, item, foe } - the stands' points in the parent
 *  frame, the foe's feet. */
async function standParty(markers, ctx = room()) {
  const v = village({ qbn: PARTY, fromWorldData: false, markers, type: House2 });
  const sd = v.place('house').siteDetails;
  assert.deepEqual(sd.selectedMarker.targetResources.map((s) => s.name), ['pp', 'l', 'crook'], 'all three at the selected marker');
  const { adapter, questFlats, foes } = liftInteriorStands(ctx);
  addQuestResourceObjects(v.machine, adapter, SITE_TYPES.Building, sd.buildingKey);
  await new Promise((resolve) => setImmediate(resolve));   // the billboards' async fill
  assert.equal(questFlats.length, 2, 'the person and the letter stand');
  assert.equal(foes.length, 1, 'and the foe');
  const [npc, item] = questFlats;
  for (const s of questFlats) assert.deepEqual([s.x, s.z], [s.batch.at[0], s.batch.at[2]], 'the stand\'s own point is the one drawn - the click box\'s');
  return { npc: npc.batch.at, item: item.batch.at, foe: foes[0].feet };
}
const near = (got, want, why) => assert.ok(got.length === want.length && got.every((g, i) => Math.abs(g - want[i]) < 1e-9), `${why}: ${got} vs ${want}`);
// the building's markers (block units) and where they stand in the parent frame
const OUTSIDE = mark(SPAWN, 540, 0, -100);   // (113.5, 0, 47.5): four metres past the east wall, as the library's
const ON_FLOOR = mark(SPAWN, 40, 0, 40);     // (101, 0, 51)
const NEAR_ITEM = mark(ITEM, 320, 0, -80);   // (108, 0, 48): the nearest marker to OUTSIDE with a floor
const ABOVE = mark(SPAWN, 360, -240, 40);    // (109, 6, 51): six metres over the floor, past AlignBillboardToGround's 4 m
const OFF_ITEM = mark(ITEM, 600, 0, 200);    // (115, 0, 55): past the walls

test('QUEST-MARKERS, the backstop: a person, a letter and a foe whose building marker has no floor under it stand at the site\'s NEAREST marker with one - the person snapped to it, the letter on it, the foe\'s feet a hair over it (mutants: no fallback for each; the spots unsorted)', async () => {
  const { npc, item, foe } = await standParty([OUTSIDE, ON_FLOOR, NEAR_ITEM]);
  near(npc, [108, 2 * 0.02, 48], 'the person at the item marker 5.5 m off, AlignBillboardToGround\'s 2% over the floor');
  near(item, [108, 0, 48], 'the letter on it');
  near(foe, [108, 0.1, 48], 'the foe\'s feet, INTERIOR_MARKER_FEET_LIFT over it');
});

test('QUEST-MARKERS, the backstop: a site none of whose markers has a floor within reach under it (one six metres over the floor, past the 4 m the align reaches) stands them at the room\'s NEAREST enter marker (mutants: the reach; the enter markers unsorted)', async () => {
  const { npc, item, foe } = await standParty([ABOVE, OFF_ITEM], room([[93, 0, 50], [109, 0, 55]]));
  near(npc, [109, 2 * 0.02, 55], 'the person at the enter marker by the east wall');
  near(item, [109, 0, 55], 'the letter');
  near(foe, [109, 0.1, 55], 'the foe');
});

test('QUEST-MARKERS, the backstop: a marker with a floor under it stands exactly as DFU stands it - the backstop moves nothing it does not have to (mutant: always moved)', async () => {
  const { npc, item, foe } = await standParty([ON_FLOOR, OUTSIDE, NEAR_ITEM]);
  near(npc, [101, 2 * 0.02, 51], 'the person on its own marker');
  near(item, [101, 0, 51], 'the letter');
  near(foe, [101, 0.1, 51], 'the foe');
});

test('QUEST-MARKERS, the four hosts by source: the building stands (worldModes.js\'s interior adapter, which world.js and exterior.js both build) hand the backstop their spots; the dungeon\'s stands are DFU\'s, with no backstop (an RDB marker is the dungeon\'s own, and the curation is the town packs\')', () => {
  const WM = readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8');
  const interior = WM.slice(WM.indexOf('  const questAdapter = {'), WM.indexOf('\n  };\n', WM.indexOf('  const questAdapter = {')));
  assert.equal((interior.match(/interiorStandSpots\(quest, marker\)/g) ?? []).length, 3, 'standNPC, standItem and standFoe');
  const dungeon = WM.slice(WM.indexOf('  const dungeonQuestAdapter = {'), WM.indexOf('\n  };\n', WM.indexOf('  const dungeonQuestAdapter = {')));
  assert.ok(dungeon.length > 0);
  assert.doesNotMatch(dungeon, /interiorStandSpots|standSpot\(/, 'no backstop under the dungeon\'s stands');
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(readFileSync(new URL(`../${host}`, import.meta.url), 'utf8'), /createWorldModes\(/, `${host} builds its buildings through worldModes.js`);
  }
});

// ---- the player's own towns ----

test('QUEST-MARKERS, gated on ARENA2_PATH: every building of the world\'s towns the door serves in a listed design - 13,084 of them, in 4,073 towns, with both packs on (1,105 in 665 before SEALED-CELLAR) - has each of the design\'s markers curated where it stands', { skip: SKIP }, async () => {
  const say = console.log; console.log = () => {};
  let t;
  try { t = await openTowns({ mods: true }); } finally { console.log = say; }
  const listed = new Map();   // block -> [[record, design]]
  for (const d of CURATED_QUEST_MARKERS) for (const [, block, record] of d.where) (listed.get(block) ?? listed.set(block, []).get(block)).push([record, d]);
  let buildings = 0;
  const towns = new Set(), missed = [];
  for (const { loc } of everyLocation(t.maps)) {
    const ext = loc?.exterior?.exteriorData;
    for (let i = 0; i < (ext?.blockNames.length ?? 0); i++) {
      const name = ext.blockNames[i];
      if (!listed.has(name)) continue;
      t.maps.getRmbBlockName(loc, i % ext.width, Math.floor(i / ext.width));   // the town's own read: its blocks come next
      const dfBlock = t.blocks.getBlockByName(name);
      if (!dfBlock?.fromWorldData) continue;
      for (const [record, d] of listed.get(name)) {
        if (dfBlock.rmbBlock.fldHeader.buildingDataList[record]?.buildingType !== d.buildingType) continue;
        buildings++; towns.add(`${loc.regionIndex}:${loc.locationIndex}`);
        const flats = dfBlock.rmbBlock.subRecords[record].interior.blockFlatObjectRecords;
        for (const m of d.markers) {
          const f = flats.find((x) => x.textureArchive === 199 && x.textureRecord === m.record && [x.xPos, x.yPos, x.zPos].join() === m.at.join());
          if (!f || JSON.stringify(curatedMarkerSpot(dfBlock, record, f.textureRecord, f.xPos, f.yPos, f.zPos)) !== JSON.stringify(m.to)) missed.push(`${loc.name} ${name} #${record}`);
        }
      }
    }
  }
  assert.deepEqual(missed, [], 'every listed marker, curated in every town that stands it');
  // FIELD BUGS 2026-10-05 SEALED-CELLAR: 1,105 in 665 towns before the hatches' fourteen designs
  assert.deepEqual([buildings, towns.size], [13084, 4073]);
});

// ---- the measure, again, on the player's own data ----

const GEOMETRY = HAVE_ARENA2 && existsSync(join(ARENA2, 'ARCH3D.BSA'));
test('QUEST-MARKERS, gated on ARENA2_PATH: tools/townQuestMarkers.mjs measures the listed buildings again off the player\'s ARCH3D and BLOCKS.BSA and finds the list, marker for marker - each floor spot a floor the walk from the door reaches and sees - and Daggerfall\'s own LIBRAL01 #14 and LIBRAL03 #3 hold no marker where the author\'s library does', { skip: GEOMETRY ? false : 'ARENA2_PATH not set (or no ARCH3D.BSA)' }, async () => {
  const T = await import('../tools/townQuestMarkers.mjs');
  const say = console.log; console.log = () => {};
  let data, list;
  try {
    data = await T.openTownData(ARENA2);
    list = await T.measureTownPacks(data, { only: CURATED_QUEST_MARKERS.flatMap((d) => d.where) });
  } finally { console.log = say; }
  assert.deepEqual(JSON.parse(JSON.stringify(list)), JSON.parse(JSON.stringify(CURATED_QUEST_MARKERS)), 'the committed list is the measure');
  for (const d of CURATED_QUEST_MARKERS) {
    const [vendor, block, record] = d.where[0];
    const { dfBlock, index } = data.packBlock(vendor, block);
    const { tris, layout } = await T.interiorTriangles(data.getModel, dfBlock, index >= 0 ? index : 99999, record);
    const walk = T.walkFloor(tris, layout.markers.filter((m) => m.type === ENTER || m.type === 4));
    for (const m of d.markers) {
      const at = { x: m.at[0] * UNIT, y: -m.at[1] * UNIT, z: m.at[2] * UNIT }, to = { x: m.to[0] * UNIT, y: -m.to[1] * UNIT, z: m.to[2] * UNIT };
      assert.ok(!walk.sees(at), `${d.design}: 199.${m.record} at ${m.at} - no player reaches it`);
      // ...void or inside a solid, or (FIELD BUGS 2026-10-05 SEALED-CELLAR) on a floor past a shut hatch, whose far side reaches it
      const hatch = T.hatchesOf(layout.markers, walk).find((h) => T.walkFloor(tris, [h.far]).sees(at));
      assert.ok(['void', 'insideSolid'].includes(T.rayVerdict(tris, at)) || hatch, `${d.design}: 199.${m.record} at ${m.at} - lost in geometry, or sealed`);
      if (hatch) assert.ok(Math.hypot(to.x - hatch.near.x, to.z - hatch.near.z) < 8, `${d.design}: its spot by the hatch`);
      assert.equal(T.rayVerdict(tris, to), 'ok', `${d.design}: its spot ${m.to} is a floor`);
      assert.ok(walk.sees(to), `${d.design}: the walk from the door reaches it`);
    }
  }
  for (const [name, record] of [['LIBRAL01.RMB', 14], ['LIBRAL03.RMB', 3]]) {
    const own = data.blocks.readClassicBlock(data.blocks.getBlockIndex(name)).rmbBlock.subRecords[record].interior.blockFlatObjectRecords;
    const library = CURATED_QUEST_MARKERS.find((d) => d.design.startsWith('DALIBRBL')).markers;
    for (const m of library) assert.ok(!own.some((f) => f.textureArchive === 199 && f.xPos === m.at[0] && f.yPos === m.at[1] && f.zPos === m.at[2]), `${name} #${record}: no marker at ${m.at}`);
  }
});
