// FB1020c CROWD-CLEAR (FIELD BUGS 2026-10-20c, the Discord: "Burning Doors quest NPC spawned too close to other NPC" -
// "This one spawned very close to another NPC, had to be precise to get to interact with her"). Daggerfall's own Mages
// Guild hall of MAGEAA11 #0 and MAGEAA12 #18 (Beautiful Cities lays it the same) holds two quest spawn markers, one of
// them 0.20 m from the guild's questor (182.15, faction 63). DFU draws a Person's marker at random (Place.cs
// GetSiteMarker) and stands the Person on it (GameObjectHelper.AddQuestNPC) whoever stands there (DaggerfallInterior
// AddPeople), so Ysolde Marnhel stood inside him in half the halls of that design, their pick boxes one. A Person whose
// spot shares a standing person's pick box now stands at the site's nearest other marker clear of everyone
// (systems/quest/sceneMount.js buildingStandSpot, crowdingPerson); none clear, DFU's own marker - never the room's door.
// The stands are worldModes.js's own source run over a real Collider floor, lifted as fb1004d_questmarkers.test.js lifts
// them; the census below runs the same law over the player's own data.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { QuestMachine } from '../../../src/systems/quest/machine.js';
import { Place, SITE_TYPES } from '../../../src/systems/quest/place.js';
import { Symbol as QuestSymbol } from '../../../src/systems/quest/symbol.js';
import { addQuestResourceObjects, markerScenePosition, siteMarkerSpots, standSpot, buildingStandSpot, crowdingPerson, MARKER_FLOOR_REACH } from '../../../src/systems/quest/sceneMount.js';
import { collectInteriorPeople } from '../../../src/characters/interiorPeople.js';
import { _resetWorldDataReplacement, installWorldDataReplacement } from '../../../src/formats/worldData/worldDataReplacement.js';
import { _resetLayoutPins } from '../../../src/systems/layoutPins.js';
import { Collider } from '../../../src/player/collider.js';
import { templateByIndex } from '../../../src/systems/item/itemTemplates.js';
import { BUILDING_TYPES } from '../../../src/world/buildingNames.js';
import { loadTables, rmbBlock, town, worldOf, mark, SPAWN, ITEM } from '../../fb1004dTowns.mjs';
import { ARENA2, HAVE_ARENA2 } from '../../fb1004dArena.mjs';

loadTables();
const MAP_ID = 4242;
const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

/** A room: its floor 18 m by 12 m at y 0 in the parent frame (x 92..110, z 44..56), the building's frame 100 m east and
 *  50 m north of it (interiorContext.js's parentPt), one enter marker by the west wall, and `people` standing in it
 *  (interiorContext.js's own shape: the parent frame, `stood`, `active`, the billboard's `width`). */
function room(people) {
  const collider = new Collider(() => -Infinity);
  collider.addMesh('room', new Float32Array([92, 0, 44, 110, 0, 44, 110, 0, 56, 92, 0, 56]), new Uint32Array([0, 1, 2, 0, 2, 3]), IDENTITY);
  return { collider, parentPt: (x, y, z) => [x + 100, y, z + 50], enterMarkers: [[93, 0, 50]], billboardBatches: [], people };
}
/** worldModes.js's building quest stands, lifted out and run over `ctx` - the stand law (standQuestFlatIn), the interior
 *  host's wrapper, the backstop's spots and the interior adapter - the host's own source; a billboard 0.95 m by 2 m. */
function liftInteriorStands(ctx) {
  const WM = readFileSync(new URL('../../../src/scenes/worldModes.js', import.meta.url), 'utf8');
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
  const questFlats = [];
  const deps = {
    questFlats, interiorCtx: ctx, interiorFoeStands: [], _enemyRestoreInProgress: false,
    interiorFoes: { spawnFoe: () => Promise.resolve() },
    questSceneCtx: () => ({ mapId: MAP_ID }), sceneBehaviours: () => questFlats.map((s) => s.behaviour),
    getTexture: async () => ({ recordCount: 1000 }), uploadRecord: () => {}, billboardSize: () => ({ w: 0.95, h: 2 }), drawnFlat: (a, r) => [a, r],
    renderer: { createBillboardBatch: (_a, _r, _size, at) => ({ at: at[0] }) }, rideSceneMarker: () => {},
    templateByIndex, markerScenePosition, siteMarkerSpots, standSpot, buildingStandSpot, MARKER_FLOOR_REACH,
  };
  return { adapter: new Function(...Object.keys(deps), source)(...Object.values(deps)), questFlats };
}
/** A quest's Person and its letter placed at a House2 holding `markers` (the first spawn marker drawn - GetSiteMarker's
 *  reuse law stands both at it), stood in a room where `people` stand: { npc, item } - the stands' drawn points - and the
 *  Person's `stand` record. */
async function standAt(markers, people) {
  _resetLayoutPins(); _resetWorldDataReplacement(); installWorldDataReplacement();
  const blocks = new Map([
    ['HALL.RMB', rmbBlock('HALL.RMB', [{ type: BUILDING_TYPES.House2, markers }])],
    ['FARM.RMB', rmbBlock('FARM.RMB', [{ type: BUILDING_TYPES.House1 }])],
  ]);
  const farm = town({ name: 'Ashford', locationIndex: 0, mapId: MAP_ID + 1, grid: ['FARM.RMB'] });
  const hall = town({ name: 'Aldleigh', locationIndex: 1, mapId: MAP_ID, grid: ['HALL.RMB'] });
  const machine = new QuestMachine({ nowSeconds: () => 0, world: worldOf({ locations: [farm, hall], blocks, current: hall }), getReputation: () => 0, changeReputation: () => {} });
  const quest = machine.parseQuestForLists(['Quest: __CROWD', 'QRC:', 'Message:  1011', ' x', '', 'QBN:',
    'Person _ysolde_ group Questor', 'Item _l_ letter', 'Place _hall_ local house2', '',
    '\tplace npc _ysolde_ at _hall_', '\tplace item _l_ at _hall_', '', 'variable _done_'], 0, { rolls: () => 0 });
  machine.startQuestImmediate(quest);
  machine.tick();
  const sd = quest.getPlace({ name: 'hall' }).siteDetails;
  assert.deepEqual(sd.selectedMarker.targetResources.map((s) => s.name), ['ysolde', 'l'], 'both at the drawn marker');
  const { adapter, questFlats } = liftInteriorStands(room(people));
  addQuestResourceObjects(machine, adapter, SITE_TYPES.Building, sd.buildingKey);
  await new Promise((resolve) => setImmediate(resolve));   // the billboards' async fill
  assert.equal(questFlats.length, 2, 'the Person and the letter stand');
  const [npc, item] = questFlats;
  return { npc: npc.batch.at, item: item.batch.at, stand: npc };
}
const near = (got, want, why) => assert.ok(Math.abs(got[0] - want[0]) < 1e-9 && Math.abs(got[2] - want[2]) < 1e-9, `${why}: ${got} vs ${want}`);
// the building's markers (block units) and where they stand in the parent frame (x / 40 + 100, z / 40 + 50)
const A = mark(SPAWN, 40, 0, 40);     // (101, 0, 51): the questor 0.20 m east of it, as in MAGEAA11's hall
const B = mark(SPAWN, 240, 0, 40);    // (106, 0, 51): clear of everyone
const C = mark(SPAWN, 80, 0, 40);     // (102, 0, 51): 0.80 m from the questor - inside his pick box too
/** The guild's questor (182.15, 0.95 m wide), 0.20 m east of A. */
const QUESTOR = (over = {}) => ({ x: 101.2, y: 0, z: 51, width: 0.95, stood: true, active: true, factionID: 63, ...over });

test('FB1020c CROWD-CLEAR: a Person whose marker shares the guild questor\'s pick box stands at the site\'s next marker clear of everyone, and keeps the marker\'s name; the letter stays on its marker - an item is no one (mutants: the law unread, items moved, the people unread, the sites uncounted, the reach)', async () => {
  const { npc, item, stand } = await standAt([A, B], [QUESTOR()]);
  near(npc, [106, 0, 51], 'the Person at the clear marker');
  near(item, [101, 0, 51], 'the letter where DFU stands it');
  assert.deepEqual(stand.marker, { x: 1, y: -0, z: 1 }, 'her layout data is still her drawn marker\'s - SetLayoutData\'s hash, her name (QUEST-NAME-ONE) and her click\'s NPC as they were');
  const p = crowdingPerson([101, 0, 51], 0.95, [QUESTOR()]);
  assert.equal(p?.factionID, 63, 'it was the questor she would have stood in');
});

test('FB1020c CROWD-CLEAR: the nearest clear spawn marker of the site, a crowded one passed over and an item\'s marker never taken; none clear - DFU\'s own marker, never the room\'s door (mutants: the reach; the item markers taken; the enter markers taken)', async () => {
  near((await standAt([A, C, B], [QUESTOR()])).npc, [106, 0, 51], 'C crowded too: B');
  near((await standAt([A, mark(ITEM, 120, 0, 40), B], [QUESTOR()])).npc, [106, 0, 51], 'an item\'s marker 2 m off and clear is no place for her: the spawn marker');
  near((await standAt([A, C], [QUESTOR()])).npc, [101, 0, 51], 'no clear marker: its own, as DFU - not the door at (93, 0, 50)');
});

test('FB1020c CROWD-CLEAR: a person the room does not stand (hidden - a shut shop, an owned house, a quest\'s away arm), one upstairs, or one clear of the box on either axis crowds nothing - the marker stands as DFU stands it (mutants: always moved; the hidden counted; the storey; an axis dropped)', async () => {
  near((await standAt([A, B], [QUESTOR({ active: false })])).npc, [101, 0, 51], 'hidden');
  near((await standAt([A, B], [QUESTOR({ stood: false })])).npc, [101, 0, 51], 'taken back out');
  near((await standAt([A, B], [QUESTOR({ y: 4 })])).npc, [101, 0, 51], 'upstairs');
  near((await standAt([A, B], [QUESTOR({ x: 103 })])).npc, [101, 0, 51], '2 m east: clear');
  near((await standAt([A, B], [QUESTOR({ x: 101, z: 53 })])).npc, [101, 0, 51], '2 m north: clear');
});

test('FB1020c CROWD-CLEAR: a clear marker with no floor under it is passed over - QUEST-MARKERS\' floor law holds for the move too (mutant: the floor unasked)', async () => {
  const A2 = mark(SPAWN, 360, 0, 40);    // (109, 0, 51): the questor 0.20 m east of it
  const OUT = mark(SPAWN, 440, 0, 40);   // (111, 0, 51): clear and nearest, past the east wall - no floor
  const B2 = mark(SPAWN, 160, 0, 40);    // (104, 0, 51): clear, on the floor
  near((await standAt([A2, OUT, B2], [QUESTOR({ x: 109.2 })])).npc, [104, 0, 51], 'the floored clear marker');
});

// ---- the player's own halls ----

const DATA = HAVE_ARENA2 && ['ARCH3D.BSA', 'FACTION.TXT', 'TEXTURE.182'].every((f) => existsSync(join(ARENA2, f)));
test('FB1020c CROWD-CLEAR, gated on ARENA2_PATH: over every building interior of BLOCKS.BSA and both town packs, the law moves a Person as wide as Ysolde (the Mages Guild\'s female flat, FACTION.TXT) off its drawn marker in exactly the hall of MAGEAA11 #0 and MAGEAA12 #18 - Daggerfall\'s own and Beautiful Cities\' - each time off the guild\'s questor, and in no other building', { skip: DATA ? false : 'ARENA2_PATH not set (or no ARCH3D.BSA, FACTION.TXT, TEXTURE.182)' }, async () => {
  const T = await import('../../../tools/townQuestMarkers.mjs');
  const { FactionFile, flatArchive, flatRecord } = await import('../../../src/formats/factionFile.js');
  const say = console.log; console.log = () => {};
  let data;
  try { data = await T.openTownData(ARENA2); } finally { console.log = say; }
  const factions = new FactionFile();
  factions.load(new Uint8Array(readFileSync(join(ARENA2, 'FACTION.TXT'))));
  const mages = factions.factionDict.get(40);
  const w = data.billboardSize(flatArchive(mages.flat2), flatRecord(mages.flat2)).w;   // AddQuestNPC: a female Person wears her faction's flat2
  assert.ok(w > 0.5 && w < 1.2, `Ysolde's billboard: ${w} m`);
  const moved = [];
  const place = new Place({ uid: 1, rolls: () => 0, resources: new Map(), hooks: {} });
  place.symbol = new QuestSymbol('_hall_');
  const sweep = (source, name, dfBlock) => {
    const rmb = dfBlock?.rmbBlock;
    for (let rec = 0; rec < (rmb?.subRecords?.length ?? 0); rec++) {
      if ((rmb.fldHeader.buildingDataList[rec]?.buildingType ?? -1) === -1 || !rmb.subRecords[rec]?.interior) continue;
      const sd = place._enumerateBuildingQuestMarkers(dfBlock, rec);   // EnumerateBuildingQuestMarkers, the curation's spots in
      const people = collectInteriorPeople(rmb.subRecords[rec]).map((pn) => ({ ...pn, stood: true, active: true, width: data.billboardSize(pn.textureArchive, pn.textureRecord).w }));
      for (const marker of sd.questSpawnMarkers ?? []) {
        const own = markerScenePosition(marker);
        const xyz = (p) => [p.x, p.y, p.z];   // the host's spots (worldModes.js interiorStandSpots), a floor under every one
        const spots = Object.assign(siteMarkerSpots(sd, marker).map(xyz), { spawns: siteMarkerSpots(sd, marker, false).map(xyz) });
        const at = buildingStandSpot([own.x, own.y, own.z], spots, { raycast: () => 0 }, 0, w, people);
        if (at[0] === own.x && at[2] === own.z) continue;
        const by = crowdingPerson([own.x, own.y, own.z], w, people);
        moved.push(`${source} ${name} #${rec} f${rmb.fldHeader.buildingDataList[rec].factionId} off ${by.textureArchive}.${by.textureRecord} f${by.factionID}`);
      }
    }
  };
  for (let b = 0; b < data.blocks.count; b++) {
    const name = data.blocks.getBlockName(b);
    if (name?.endsWith('.RMB')) sweep('classic', name, data.blocks.readClassicBlock(b));
  }
  for (const [vendor] of T.VENDORS) {
    for (const name of data.packs[vendor].names().filter((n) => n.endsWith('.RMB.json')).map((n) => n.slice(0, -5))) {
      let dfBlock = null;
      try { dfBlock = data.packBlock(vendor, name).dfBlock; } catch { continue; }   // a block the door rebuilds only within a town
      sweep(vendor, name, dfBlock);
    }
  }
  assert.deepEqual(moved.sort(), [
    'beautiful-cities MAGEAA11.RMB #0 f40 off 182.15 f63', 'beautiful-cities MAGEAA12.RMB #18 f40 off 182.15 f63',
    'classic MAGEAA11.RMB #0 f40 off 182.15 f63', 'classic MAGEAA12.RMB #18 f40 off 182.15 f63',
  ]);
});
