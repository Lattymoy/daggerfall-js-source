// TOTEM-CAGE (FIELD BUGS 2026-10-03b, Shortstori on Discord: "Im about to end my mainquest but the Totem of Tiber Septim
// isnt here. And I think daggerfall Castle will Never reset with 300+ people around the clock"; the screenshot an empty
// pedestal, the tracker on "Who Gets the Totem"; `bible/01-Overview/bugs/Field-Bugs-2026-10-03b.md`).
//
// DFU stands a quest item at its marker's layout point and PARENTS it to the marker's scene object
// (GameObjectHelper.cs AddQuestItem :1144-1148), found by GetDaggerfallMarker's unique-or-null law (:1165-1186), whose
// own note names this very case: "raising treasure room cage for totem in Daggerfall castle". An RDB marker can carry an
// action (RDBLayout.cs:403-406), so the Totem rides its cage. The port stood the item and never moved it; online the
// cage's pose is the castle room's memory, which never resets. Every fixture from its producer: S0000008's own script
// lines through the real Place, Item and PlaceItem; the dungeon through the real layoutDungeon/layoutRdbBlock; the
// motion through the real ActionSystem; the room's word through the memory's own projection (sharedRecord on the way
// out, validActionRecord on the way in). The block BYTES are a fixture - no ARENA2 here - shaped as the reader mints
// them; which RDB object of the castle is the Totem's marker, and its action, need the data (the record says so).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadQuestTables } from '../../../src/systems/quest/tables.js';
import { Place, SITE_TYPES } from '../../../src/systems/quest/place.js';
import { Item } from '../../../src/systems/quest/item.js';
import { PlaceItem } from '../../../src/systems/quest/actions.js';
import { addQuestResourceObjects, markerScenePosition, sceneMarkerOf, sceneMarkerMover, rideSceneMarker, questStandBox } from '../../../src/systems/quest/sceneMount.js';
import { layoutDungeon } from '../../../src/world/dungeon/dungeonLayout.js';
import { ACTION_FLAGS, TRIGGER_FLAGS, MOVE_ACTION_FLAGS } from '../../../src/world/rdbLayout.js';
import { RDB_RESOURCE_TYPES } from '../../../src/formats/blocksFile.js';
import { ActionSystem, sharedRecord, validActionRecord } from '../../../src/world/actionSystem.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8').replace(/^﻿/, '');
{
  const sources = {};
  for (const f of readdirSync(join(ROOT, 'vendor/dfu-quests/Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = rd(join('vendor/dfu-quests/Tables', f));
  loadQuestTables(sources);
}
/** S0000008's own line beginning `head` (the script, not a paraphrase of it). */
const SCRIPT = rd('vendor/dfu-quests/Quests/S0000008.txt').split(/\r?\n/).map((l) => l.trim());
const line = (head) => {
  const found = SCRIPT.filter((l) => l.startsWith(head));
  assert.equal(found.length, 1, `one line of S0000008 begins "${head}"`);
  return found[0];
};

// ── the castle, as BlocksFile mints its blocks (a fixture: no ARENA2) ──────────────────────────────────────────────
const flat = (position, record, { x = 0, y = 0, z = 0, action = 0, magnitude = 0, flags = 0, archive = 199 } = {}) => ({
  position, xPos: x, yPos: y, zPos: z, type: RDB_RESOURCE_TYPES.Flat,
  resources: { flatResource: { textureArchive: archive, textureRecord: record, flags, magnitude, soundIndex: 0, factionOrMobileId: 0, nextObjectOffset: -1, action } },
});
const rdb = (position, objects) => ({ position, rdbBlock: { modelReferenceList: [], objectRootList: [{ rdbObjects: objects }, { rdbObjects: null }] } });
const ENTRY = 'S0000040.RDB', TREASURY = 'S0000161.RDB';
const TREASURY_POSITION = 5000, TOTEM_OBJECT = 300;
const TOTEM_ID = TREASURY_POSITION + TOTEM_OBJECT;
const BLOCKS = {
  // the way in: a start marker, a spawn marker, two item markers - and a start marker whose ID is the Totem's
  // marker's by coincidence (1000 + 4300 = 5000 + 300): it carries no DaggerfallMarker in DFU, so it never answers
  [ENTRY]: rdb(1000, [
    flat(100, 18, { x: 100, z: 100 }), flat(200, 18, { x: 300, z: 100 }),
    flat(300, 11, { x: 200, z: 300 }), flat(4300, 10, { x: 50, z: 50 }),
  ]),
  // the treasury: three still item markers (one only relays a chain), a fixed treasure, and the Totem's - item marker 5
  // of the place, moving up (PositiveY, magnitude 8: 64 units, 1.6 scene units) when its chain fires
  [TREASURY]: rdb(TREASURY_POSITION, [
    flat(100, 18, { x: 100, z: 900 }), flat(200, 18, { x: 900, z: 900, action: ACTION_FLAGS.Activate, flags: TRIGGER_FLAGS.Direct }),
    flat(250, 18, { x: 500, z: 100 }), flat(310, 2, { x: 650, z: 400, archive: 216 }),
    flat(TOTEM_OBJECT, 18, { x: 600, y: 120, z: 400, action: ACTION_FLAGS.PositiveY, magnitude: 8, flags: TRIGGER_FLAGS.Direct }),
  ]),
};
const RISE = 8 * 8 * 0.025;   // AddAction's PositiveY: magnitude = axisRaw * 8 (a flat's axis IS its magnitude), * GlobalScale
const daggerfall = (blocks = [[ENTRY, 0, true], [TREASURY, 1, false]]) => ({
  loaded: true, name: 'Daggerfall', regionName: 'Daggerfall', regionIndex: 17, locationIndex: 1231, hasDungeon: true,
  climate: { worldClimate: 231 },
  mapTableData: { mapId: 1291010263 },
  exterior: { exteriorData: { locationId: 50026 } },
  dungeon: { recordElement: { header: { locationId: 50027 } }, blocks: blocks.map(([blockName, x, isStartingBlock]) => ({ blockName, x, z: 0, isStartingBlock })) },
});
const DAGGERFALL = daggerfall();
const NAMES = [ENTRY, TREASURY];
const blocksFile = { getBlockIndex: (n) => NAMES.indexOf(n), getBlock: (i) => BLOCKS[NAMES[i]] };
const laidOut = (loc = DAGGERFALL) => layoutDungeon(loc, blocksFile, () => ({ positions: new Float32Array(0), doors: [] })).blocks;
/** Place's world seam: DaggerfallCastle2's p1 0xc36b is LocationId 50027, the city's 50026 + 1 (Place.cs's p1 - 1). */
const WORLD = {
  maps: { regionCount: 1, getRegion: () => ({ locationCount: 1 }), readLocationIdFast: () => 50026, getLocation: () => DAGGERFALL },
  getBlock: (name) => BLOCKS[name],
};

/** S0000008 as far as `_brisyes_`'s first line: the castle, the Totem, and the placement - the real resources and action. */
function acceptTotem() {
  const quest = {
    uid: 8, rolls: () => 0, resources: new Map(), hooks: { world: WORLD, hasSiteLink: () => true },
    getResource(s) { return this.resources.get(s?.name) ?? null; },
    getPlace(s) { const r = this.getResource(s); return r?.isPlace ? r : null; },
    getItem(s) { const r = this.getResource(s); return r?.isItem ? r : null; },
  };
  const declare = (Ctor, src) => { const r = new Ctor(quest, src); quest.resources.set(r.symbol.name, r); return r; };
  const place = declare(Place, line('Place _daggerfall_ '));
  const item = declare(Item, line('Item _totem_ '));
  new PlaceItem(null).createNew(line('place item _totem_ '), quest).update();
  return { quest, place, item };
}

/** The dungeon host's acting markers, registered as dungeonContext.js registers them (registerFlatAction: a move flag
 *  to addMoveFlat, the rest to the relay) under the block INSTANCE and the object position. */
function sceneActions(blocks) {
  const a = new ActionSystem({ addMesh() {}, removeBucket() {}, raycast: () => Infinity });
  for (const [bi, b] of blocks.entries()) {
    for (const m of b.layout.markers) {
      if (!m.action || m.record === 15 || m.record === 16) continue;
      const at = [m.x + b.originX, m.y, m.z + b.originZ];
      if (MOVE_ACTION_FLAGS.has(m.action.actionFlag)) a.addMoveFlat(bi, m.position, m.action, at, null);
      else a.addRelay(bi, m.position, m.action, null, at);
    }
  }
  return a;
}

/** The walk (AddQuestResourceObjects) over the dungeon adapter's item arm: the stand worldModes.js standQuestFlatIn
 *  mints (its base, its footprint, no batch until the texture lands), riding the mover the context names. */
function mount({ quest, place }, blocks, actions) {
  const stands = [];
  const machine = {
    getSiteLinks: (siteType, mapId, buildingKey) => (siteType === SITE_TYPES.Dungeon && mapId === place.siteDetails.mapId && buildingKey === 0
      ? [{ questUID: quest.uid, placeSymbol: place.symbol }] : []),
    getQuest: (uid) => (uid === quest.uid ? quest : null),
  };
  addQuestResourceObjects(machine, {
    currentMapId: () => DAGGERFALL.mapTableData.mapId,
    findBehaviours: () => stands.map((s) => s.behaviour),
    standItem: ({ marker, position, behaviour }) => {
      const stand = { x: position.x, y: position.y - 0.5, z: position.z, width: 0.6, height: 0.8, batch: null, active: true, dead: false, behaviour, off: null, marker };
      stands.push(stand);
      rideSceneMarker(stand, sceneMarkerMover(blocks, actions, marker.markerID)?.offset);
      return { setActive() {}, destroy() {} };
    },
  }, SITE_TYPES.Dungeon, 0);
  return stands;
}
const near = (a, b, what) => assert.ok(Math.abs(a - b) < 1e-9, `${what}: ${a} !~ ${b}`);

test('TOTEM-CAGE: S0000008\'s own `place item _totem_ at _daggerfall_ marker 5` lands on the treasury\'s acting marker, and GetDaggerfallMarker finds that marker by the ID both producers mint - unique or null (mutants: the duplicate arm; the record filter; the ID compare)', () => {
  const { place, item } = acceptTotem();
  const sel = place.siteDetails.selectedMarker;
  assert.equal(place.siteDetails.siteType, SITE_TYPES.Dungeon, 'DaggerfallCastle2 is the city\'s dungeon');
  assert.deepEqual(sel.targetResources.map((s) => s.name), [item.symbol.name], 'the Totem on the selected marker');
  assert.equal(sel.markerID, TOTEM_ID, 'item marker 5: the treasury\'s fourth after the way in\'s two - block position + object position');
  const blocks = laidOut();
  const at = sceneMarkerOf(blocks, sel.markerID);
  assert.equal(at?.index, 1, 'the treasury, the second block laid');
  assert.deepEqual([at.marker.record, at.marker.position, at.marker.action?.actionFlag], [18, TOTEM_OBJECT, ACTION_FLAGS.PositiveY]);
  // the coincidence: the way in's start marker mints the same ID and is no DaggerfallMarker
  assert.equal(blocks[0].layout.markers.find((m) => m.record === 10).loadID, TOTEM_ID, 'the fixture\'s coincidence holds');
  // a fixed treasure carries no ID at all; an ID nothing carries is nobody's
  assert.equal(blocks[1].layout.markers.find((m) => m.archive === 216).loadID, undefined);
  assert.equal(sceneMarkerOf(blocks, 424242), null);
  // the same block laid twice mints its IDs twice: unique or null, "to prevent bad parenting behaviour"
  const twice = laidOut(daggerfall([[ENTRY, 0, true], [TREASURY, 1, false], [TREASURY, 2, false]]));
  assert.equal(sceneMarkerOf(twice, TOTEM_ID), null, 'two treasuries: no parent');
  assert.equal(sceneMarkerMover(twice, sceneActions(twice), TOTEM_ID), null, 'and nothing to ride');
});

test('TOTEM-CAGE: the cage raised by its own trigger carries the Totem - the stand and its activation box ride the marker, and a batch minted after the follow draws through the same travel (mutants: no ride; the box reads the placed point; the fill draws from the start; the kind check; objectAt)', () => {
  const totem = acceptTotem();
  const blocks = laidOut();
  const actions = sceneActions(blocks);
  const [stand, ...rest] = mount(totem, blocks, actions);
  assert.equal(rest.length, 0, 'one stand: the Totem');
  const mover = sceneMarkerMover(blocks, actions, stand.marker.markerID);
  assert.equal(mover?.kind, 'moveFlat', 'the acting marker is a mover');
  assert.equal(stand.off, mover.offset, 'the stand holds the mover\'s own travel array, live');
  // the two frames agree: the walk's marker point is the mover's placed origin
  const p = markerScenePosition(stand.marker);
  assert.deepEqual([p.x, p.y, p.z], mover.origin, 'dungeonX * RDBSide + flat position = the layout\'s origin + the flat');
  const base = stand.y;
  near(questStandBox(stand).min[1], base, 'before the trigger, at the marker');
  // the chain fires (a lever, a step): 50 / 20 = 2.5 s up
  actions.activate(mover.key);
  actions.update(1.25);
  near(questStandBox(stand).min[1], base + RISE / 2, 'half way, with the cage');
  actions.update(1.25);
  assert.equal(mover.state, 'end');
  const box = questStandBox(stand);
  near(box.min[1], base + RISE, 'at the top: the box is where the Totem rode to');
  near(box.max[1] - box.min[1], stand.height, 'the footprint unchanged');
  near(box.min[0], stand.x - stand.width / 2, 'straight up');
  // the texture lands after the follow (standQuestFlatIn's fill): the batch draws through the travel from its first frame
  stand.batch = {};
  rideSceneMarker(stand, stand.off);
  assert.equal(stand.batch.origin, mover.offset, 'the batch origin IS the travel');
  // a marker that only relays a chain, and a still one, carry nothing
  const relay = blocks[1].layout.markers.find((m) => m.position === 200);
  assert.equal(actions.objectAt(1, relay.position)?.kind, 'relay', 'registered, as a relay');
  assert.equal(sceneMarkerMover(blocks, actions, relay.loadID), null, 'a relay is no ride');
  assert.equal(sceneMarkerMover(blocks, actions, blocks[1].layout.markers.find((m) => m.position === 250).loadID), null, 'a still marker is no ride');
  // a dead stand rides nothing
  const dead = { dead: true, off: null, batch: null };
  rideSceneMarker(dead, mover.offset);
  assert.equal(dead.off, null);
});

test('TOTEM-CAGE: online the castle remembers the raised cage - a joiner\'s Totem rides the room memory\'s word whether it lands before the stand or after, and a peer\'s raise heard live (mutants: no ride; the box reads the placed point)', () => {
  const blocks = laidOut();
  // the host raised it long ago: the memory's action records, as sharedWorld writes them
  const hostActions = sceneActions(blocks);
  const hostMover = sceneMarkerMover(blocks, hostActions, TOTEM_ID);
  hostActions.activate(hostMover.key);
  hostActions.update(5);
  const memory = hostActions.collectSaveData().map(sharedRecord);
  assert.deepEqual(memory.find((r) => r.key === hostMover.key), { key: hostMover.key, state: 'end', t: 1 }, 'the room keeps the cage up');
  const landed = memory.map(validActionRecord).filter(Boolean);   // restoreSharedWorld's projection
  const raised = (stand, what) => near(questStandBox(stand).min[1], stand.y + RISE, what);
  // the stand first, the welcome after (the usual order: the transition mounts, the relay answers)
  {
    const actions = sceneActions(blocks);
    const [stand] = mount(acceptTotem(), blocks, actions);
    near(questStandBox(stand).min[1], stand.y, 'a fresh scene, the cage down');
    actions.restoreSaveData(landed);
    raised(stand, 'the memory lands: the Totem is up with the cage');
  }
  // the welcome first, the stand after (a re-mount: a load, a hot-place, the repair)
  {
    const actions = sceneActions(blocks);
    actions.restoreSaveData(landed);
    const [stand] = mount(acceptTotem(), blocks, actions);
    raised(stand, 'stood after the memory: on the raised marker, never at its start');
  }
  // a peer raising it while this player stands there
  {
    const actions = sceneActions(blocks);
    const [stand] = mount(acceptTotem(), blocks, actions);
    assert.equal(actions.applyRemote(memory), memory.length);
    raised(stand, 'a peer\'s act carries it too');
  }
});

test('TOTEM-CAGE: the hosts wire it - the dungeon adapter hands its item stand the mover by marker ID, the stand rides through one law now and at its fill, the ray reads where it is, the context names the mover by the key it registered; a building\'s item stands still (mutants: the follow, the fill, the box, the context\'s mover)', () => {
  const wm = rd('src/scenes/worldModes.js');
  const dc = rd('src/scenes/dungeonContext.js');
  // THE FOUR HOSTS: worldModes.js (both adapters) and dungeonContext.js (the mover) are wired; world.js and exterior.js
  // stand no dungeon quest item of their own (their mount routes here); the standalone ?dungeon host stands no quest
  const dungeonAdapter = wm.slice(wm.indexOf('const dungeonQuestAdapter = {'), wm.indexOf('standFoe:', wm.indexOf('const dungeonQuestAdapter = {')));
  assert.match(dungeonAdapter, /standItem: \(\{ item, marker, position, behaviour \}\) => \{/, 'the item arm takes the marker');
  assert.match(dungeonAdapter, /host\?\.follow\(dungeonCtx\?\.questMarkerMover\?\.\(marker\?\.markerID\)\?\.offset\);/, 'and hands the stand the marker\'s travel');
  const interiorAdapter = wm.slice(wm.indexOf('const questAdapter = {'), wm.indexOf('standFoe:', wm.indexOf('const questAdapter = {')));
  assert.match(interiorAdapter, /standItem: \(\{ quest, item, marker, position, behaviour \}\) => \{/);   // QUEST-MARKERS: the marker for the backstop's spots, never a follow
  assert.doesNotMatch(interiorAdapter, /follow\(/, 'a building has no DaggerfallMarker: its quest item never rides');
  const standIn = wm.slice(wm.indexOf('function standQuestFlatIn('), wm.indexOf('const standQuestFlat = '));
  assert.match(standIn, /width: 0, height: 0, batch: null, active: true, dead: false, behaviour, off: null \};/, 'the stand the law reads');
  assert.match(standIn, /stand\.batch = renderer\.createBillboardBatch\(drawArchive, drawRecord, size, \[\[x, by, z\]\]\);\n\s*rideSceneMarker\(stand, stand\.off\);/, 'the fill draws through the travel');
  assert.match(standIn, /follow: \(offset\) => rideSceneMarker\(stand, offset\),/, 'the host\'s door is the one law');
  const targets = wm.slice(wm.indexOf('const questFlatTargets = (list) => {'), wm.indexOf('const clickQuestFlat ='));
  assert.match(targets, /aabb: questStandBox\(s\),/, 'the ray meets the stand where it is');
  assert.doesNotMatch(targets, /s\.x - s\.width \/ 2/, 'and never at its placed point');
  assert.match(dc, /questMarkerMover: \(markerID\) => sceneMarkerMover\(dungeon\.blocks, actions, markerID\),/, 'the context names the mover');
  // the key the mover reads is the key the acting marker was registered under: block instance, object position
  assert.match(dc, /await registerFlatAction\(bi, m\.position, m\.action, m\.x \+ b\.originX, m\.y, m\.z \+ b\.originZ, m\.archive \?\? 199, m\.record, false\);/);
  assert.match(dc, /const o = actions\.addMoveFlat\(ns, position, action, \[x, y, z\], aabb\);/);
});
