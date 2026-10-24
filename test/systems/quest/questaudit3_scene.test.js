// QUEST-AUDIT III (2026-10-23, the owner: "Can you do a detailed quest audit, fix any and all outstanding issues. Do not
// worry about DFU parity."; bible/01-Overview/audits/Quest-Audit-III.md). The audit's fixes to the scene, the sites and
// the journal windows, each pinned here (questaudit3.test.js holds the story's and the stands'). No game data: every
// town, dungeon and quest is built here.
//
// - RELOAD-TWINS: a quickload inside the same dungeon mounted over the stands the scene still held, and by their old
//   symbols none read "already here" - every quest person, item and live foe stood twice. The mount relinks each standing
//   behaviour first (sceneMount.js addQuestResourceObjects), and a relink takes the live resource's own symbol
//   (resourceBehaviour.js relinkToLiveQuest).
// - ENDED-STANDS: a quest that ended while its things stood no longer ticks, so nothing put them away - its item could be
//   taken again and its person took every click. Its non-foe stands are put away (its questor and a named NPC's home copy
//   left), and a click is no quest's (resourceBehaviour.js update, doClick).
// - HOUSE-HOUSE: `remote houseN` tries its own kind at both of the Nearby reaches before any house, and the house fallback
//   asks for any HOUSE - (p2 -1, p3 0) read as `random` took a tavern or a shop (place.js _selectRemoteTownSite,
//   _tryTownLocation).
// - RESEAT-TYPED: the load's re-seat seats every quest's sites of a kind before the wildcards (machine.js
//   reseatMovedSites), and a site takes the building of its own name where the town as it stands has one (place.js
//   _reseatMovedSite).
// - MARKERLESS-DRAW: a remote dungeon drawn with no quest marker is set aside and another of the pool drawn, a few times
//   at most (place.js _remoteDungeonSite, REMOTE_DUNGEON_DRAWS).
// - LINK-OWN: hasSiteLink asks for THIS quest's link for THIS Place - a second Place of one quest at one building gets a
//   link of its own, and the mount stands what was put there (machine.js hasSiteLink).
// - QLBD02's two mages: `Foe _faithful_ is 2 Mage` stood one mage (a marker stands one foe); two Foes stand two.
// - OFFER-STALE: a pending hand-over whose GivePc already gave, or whose quest ended or was set aside, is let go and the
//   press is the player's; a load lets the last game's go (ui/pendingOffer.js giveOffer, questBridge.js restore).
// - NO-WORK: Choose Guild Jobs with no work, or only rows that fail their parse, says the classic "no work" line, never
//   a picker of nothing (offerFlow.js offerGuildQuest, _gettingQuestsBoxClose).
// - NAMED-TIMER: the journal windows' "Time remains" is the tightest of the deadlines the entries name (questBridge.js
//   questLog) - audit_guide.test.js pins one named clock, questbridge.test.js MAC-K2 none.
// - The exterior's quest world reads %oth and %jok's TEXT.RSC pool as world.js's does (exterior.js getRandomText).
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { QuestMachine } from '../../../src/systems/quest/machine.js';
import { QuestResourceBehaviour } from '../../../src/systems/quest/resourceBehaviour.js';
import { addQuestResourceObjects } from '../../../src/systems/quest/sceneMount.js';
import { SITE_TYPES } from '../../../src/systems/quest/place.js';
import { QUEST_REACH_TUNING } from '../../../src/systems/quest/questReach.js';
import { QuestListsManager } from '../../../src/systems/quest/questLists.js';
import { QuestOfferFlow } from '../../../src/systems/quest/offerFlow.js';
import { createQuestBridge } from '../../../src/scenes/quest/questBridge.js';
import { noteOfferPending, giveOffer, pendingOfferSender, clearPendingOffer } from '../../../src/ui/pendingOffer.js';
import { configureLayoutPins, _resetLayoutPins } from '../../../src/systems/layoutPins.js';
import { BUILDING_TYPES } from '../../../src/world/buildingNames.js';
import { GUILD_GROUPS } from '../../../src/formats/factionFile.js';
import { mapPixelToLongitudeLatitude } from '../../../src/formats/mapsFile.js';
import { loadTables, rmbBlock, town, dungeon, rdbBlock, worldOf, typeAtKey } from '../../fb1004dTowns.mjs';
import { BV } from '../../fb1004dArena.mjs';
import { packMachine, questSource } from '../../qlSources.mjs';

loadTables();
const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const quiet = (fn) => { const w = console.warn, l = console.log, i = console.info; console.warn = () => {}; console.log = () => {}; console.info = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; console.info = i; } };
const { Tavern, GeneralStore, GuildHall, House2, House4 } = BUILDING_TYPES;
/** The Nearby reach forced on or off for one call, put back after. */
const withReach = (on, fn) => { const was = QUEST_REACH_TUNING.override; QUEST_REACH_TUNING.override = on; try { return fn(); } finally { QUEST_REACH_TUNING.override = was; } };
const seeded = (seed) => { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; };
const quest = (name, qbn, extra = []) => [`Quest: ${name}`, 'QRC:', 'Message:  1011', ' x', '', 'QBN:', ...qbn, ...extra];

// ---- a town and a dungeon of one block, its spawn and item markers (the mount's walk) ----

const LAIR = { position: 9000, rdbBlock: { objectRootList: [{ rdbObjects: [11, 18].map((record, i) => ({ type: 3, position: 100 + i * 8, xPos: 10, yPos: 4, zPos: 20, resources: { flatResource: { textureArchive: 199, textureRecord: record } } })) }] } };
function lairWorld() {
  const home = town({ name: 'Home', locationIndex: 0, mapId: 100, grid: ['HOME.RMB'] });
  const lair = dungeon({ name: 'The Lair', locationIndex: 1, mapId: 300, dungeonType: 2, block: 'LAIR.RDB' });
  return worldOf({ locations: [home, lair], blocks: new Map([['HOME.RMB', rmbBlock('HOME.RMB', [{ type: Tavern }])], ['LAIR.RDB', LAIR]]), current: home });
}
const LAIR_QUEST = quest('__STANDS', ['Item _it_ letter', 'Place _lair_ remote dungeon', 'Clock _t_ 00:10 0', '', 'Foe _f_ is Giant_rat', '',
  '\tplace foe _f_ at _lair_', '\tplace item _it_ at _lair_', '\tstart timer _t_', '\tlog 1011 step 0', '', '_t_ task:', '\tend quest']);
function lairRig() {
  let now = 0;
  const given = [];
  const m = new QuestMachine({ nowSeconds: () => now, world: lairWorld(), playerLevel: () => 1, giveItemToPlayer: (it) => given.push(it) });
  const q = quiet(() => m.scheduleQuest(LAIR_QUEST, 0, { rolls: () => 0.5 }));
  m.tick(); m.tick();
  return { m, q, given, lair: q.getPlace({ name: 'lair' }), pass: (s) => { now += s; m.tick(); } };
}
/** The dungeon host's stands (worldModes.js dungeonQuestAdapter's shape): each a host whose shows are recorded. */
function sceneOf(r, extra = []) {
  const stands = [];
  const stand = (kind, name, behaviour, enemy = null) => { const s = { kind, name, behaviour, shown: [], enemy, setActive(a) { this.shown.push(!!a); } }; stands.push(s); return s; };
  const adapter = {
    currentMapId: () => r.lair.siteDetails.mapId,
    findBehaviours: () => [...extra, ...stands.map((s) => s.behaviour)],
    loadInProgress: () => false,
    standNPC: ({ person, behaviour }) => stand('person', person.symbol.name, behaviour),
    standItem: ({ item, behaviour }) => stand('item', item.symbol.name, behaviour),
    standFoe: ({ foe, behaviour }) => stand('foe', foe.symbol.name, behaviour, { currentHealth: 10, maxHealth: 10 }),
  };
  return { stands, adapter, mount: () => addQuestResourceObjects(r.m, adapter, SITE_TYPES.Dungeon, 0), said: () => stands.map((s) => `${s.kind}:${s.name}`) };
}

test('RELOAD-TWINS: a quickload inside the dungeon mounts over the stands the scene still holds - each standing behaviour takes the loaded quest\'s resource and symbol first, and nothing stands twice (mutants: the mount\'s relink)', () => {
  const r = lairRig();
  const scene = sceneOf(r);
  scene.mount();
  assert.deepEqual(scene.said(), ['foe:f', 'item:it'], 'entered: its foe and its item stand');
  scene.mount();
  assert.equal(scene.stands.length, 2, 'a second mount before any load: the guard holds');
  // F9 here, F12 here: the bridge's restore (clearState, restoreSaveData), the scene kept, and the mount at once
  const env = JSON.parse(JSON.stringify(r.m.getSaveData()));
  r.m.clearState(); r.m.restoreSaveData(env);
  const live = r.m.getQuest(r.q.uid);
  assert.ok(live && live !== r.q, 'the load restored a NEW quest under the same uid');
  scene.mount();
  assert.deepEqual(scene.said(), ['foe:f', 'item:it'], 'the load\'s mount stood nothing twice');
  for (const s of scene.stands) {
    assert.equal(s.behaviour.targetQuest, live, `${s.name}: bound to the loaded quest`);
    assert.equal(s.behaviour.targetSymbol, live.getResource({ name: s.name }).symbol, `${s.name}: by the live resource's own symbol`);
  }
});

test('RELOAD-TWINS: a behaviour restored from a save holds the save\'s copy of its symbol - a relink adopts the live resource\'s own, once, and the mount stands nothing beside it (mutants: the adopt)', () => {
  const r = lairRig();
  const first = sceneOf(r);
  first.mount();
  const item = r.q.getResource({ name: 'it' });
  const restored = new QuestResourceBehaviour(r.m, { setActive() {} });
  restored.restoreSaveData(JSON.parse(JSON.stringify(first.stands.find((s) => s.kind === 'item').behaviour.getSaveData())));
  assert.equal(restored.targetResource, item, 'the restore cached the live item');
  assert.notEqual(restored.targetSymbol, item.symbol, 'the fixture: its symbol is the save\'s copy (RestoreSaveData :285)');
  // a scene of the restored stand alone: the mount relinks it, and the item is "already here"
  const scene = sceneOf(r, [restored]);
  scene.mount();
  assert.deepEqual(scene.said(), ['foe:f'], 'the foe stands; the item does not stand a twin beside the restored one');
  assert.equal(restored.targetSymbol, item.symbol, 'it holds the live resource\'s own symbol now');
  assert.equal(restored.relinkToLiveQuest(), false, 'and a relink after that has nothing to do');
  const again = new QuestResourceBehaviour(r.m, { setActive() {} });
  again.restoreSaveData(JSON.parse(JSON.stringify(restored.getSaveData())));
  assert.equal(again.relinkToLiveQuest(), true, 'a relink answers that it took the symbol');
  assert.equal(again.targetSymbol, item.symbol);
});

test('ENDED-STANDS: a quest that ended while its things stood puts its item and its people away - its questor and a named NPC\'s home copy left standing, its foes left to their own law - and none of its stands takes a click or hands its item over (mutants: the put-away, the questor, the home copy, the foe, the click)', () => {
  const r = lairRig();
  const scene = sceneOf(r);
  scene.mount();
  for (const s of scene.stands) s.behaviour.update();
  assert.ok(scene.stands.every((s) => !s.shown.includes(false)), 'running: everything stands');
  for (let i = 0; i < 6 && !r.q.questComplete; i++) r.pass(5 * 60);
  assert.equal(r.q.questComplete, true, 'the timer ran out: `end quest`');
  for (const s of scene.stands) s.shown.length = 0;   // what its ticks showed while it ran
  // its questor, and a named NPC the block bound to its Person (machine.setupIndividualStaticNPC)
  const person = (name, o = {}) => ({ isPerson: true, symbol: { name }, parentQuest: r.q, clicked: 0, setPlayerClicked() { this.clicked++; }, ...o });
  const qg = person('qg', { isQuestor: true }), kv = person('kv');
  r.q.resources.set('qg', qg); r.q.resources.set('kv', kv);
  const shown = { qg: [], kv: [] };
  const qgb = new QuestResourceBehaviour(r.m, { setActive: (a) => shown.qg.push(!!a) });
  qgb.assignResource(qg); qgb.start();
  const kvb = new QuestResourceBehaviour(r.m, { setActive: (a) => shown.kv.push(!!a) });
  kvb.individualHome = true; kvb.assignResource(kv); kvb.start();
  for (const s of scene.stands) s.behaviour.update();
  qgb.update(); kvb.update();
  const itemStand = scene.stands.find((s) => s.kind === 'item'), foeStand = scene.stands.find((s) => s.kind === 'foe');
  assert.deepEqual(itemStand.shown, [false], 'its item put away');
  assert.deepEqual(shown.qg, [], 'its questor stands');
  assert.deepEqual(shown.kv, [], 'a named NPC\'s home copy stands');
  assert.deepEqual(foeStand.shown, [], 'its foe is not put away by the end - it falls as a foe falls');
  // a click on a stand still drawn (the frame before the put-away): no quest's
  assert.equal(itemStand.behaviour.doClick(), false, 'the item\'s click falls through');
  assert.equal(r.given.length, 0, 'nothing handed over');
  assert.equal(r.q.getResource({ name: 'it' }).hasPlayerClicked, false);
  assert.equal(qgb.doClick(), false, 'the questor\'s click falls through to talk and the guild');
  assert.equal(qg.clicked, 0);
});

// ---- the region of a few towns, at pixel distances from the player's ----

const at = (loc, dx) => { const ll = mapPixelToLongitudeLatitude(100 + dx, 100); Object.assign(loc.mapTableData, { longitude: ll.x, latitude: ll.y }); return loc; };
/** The player's town and two more, Near (5 pixels off) and Far (15): within a level-1 reach and within twice it. Each
 *  town's MAPS directory lists the kinds it lays (the dart's pre-check). */
function threeTowns({ near, far }) {
  const blocks = new Map([['HOME.RMB', rmbBlock('HOME.RMB', [{ type: GeneralStore }])], ['NEAR.RMB', rmbBlock('NEAR.RMB', near.map((type) => ({ type })))], ['FAR.RMB', rmbBlock('FAR.RMB', far.map((type) => ({ type })))]]);
  const home = at(town({ name: 'Home', locationIndex: 0, mapId: 100, grid: ['HOME.RMB'] }), 0);
  const n = at(town({ name: 'Near', locationIndex: 1, mapId: 101, grid: ['NEAR.RMB'] }), 5);
  const f = at(town({ name: 'Far', locationIndex: 2, mapId: 102, grid: ['FAR.RMB'] }), 15);
  n.exterior.buildings = near.map((buildingType) => ({ buildingType }));
  f.exterior.buildings = far.map((buildingType) => ({ buildingType }));
  const world = worldOf({ locations: [home, n, f], blocks, current: home });
  world.playerPixel = () => ({ x: 100, y: 100 });
  return world;
}
/** `Place _home_ remote <kind>` drawn in `world`: [town, building type] of its site. */
function drawn(world, kind, rolls) {
  const m = new QuestMachine({ nowSeconds: () => 0, world, playerLevel: () => 1 });
  const q = quiet(() => m.parseQuestForLists(quest('__HOUSE', [`Place _home_ remote ${kind}`, 'variable _done_']), 0, { rolls }));
  const sd = q.getPlace({ name: 'home' }).siteDetails;
  return [sd.locationName, typeAtKey(world, world.maps.getLocationByName(17, sd.locationName), sd.buildingKey)];
}

test('HOUSE-HOUSE: `remote house4` with Nearby on takes a House4 of a town within twice the reach before any house of a town within the reach - the house fallback is the last ask, not each reach\'s (mutants: the reaches\' order)', () => {
  withReach(true, () => {
    for (let i = 0; i < 8; i++) {
      assert.deepEqual(drawn(threeTowns({ near: [House2], far: [House4] }), 'house4', () => (i + 0.5) / 8), ['Far', House4], `roll ${i}: its own kind, farther off`);
    }
    assert.deepEqual(drawn(threeTowns({ near: [House2], far: [Tavern] }), 'house4', () => 0.5), ['Near', House2], 'no House4 within either reach: any house');
  });
});

test('HOUSE-HOUSE: the house fallback asks for any HOUSE - never a tavern or a shop, which (p2 -1, p3 0) read as `random` offered - at the Nearby reaches and in DFU\'s darts alike (mutants: the any-house arm)', () => {
  const rows = { near: [Tavern, House2, GeneralStore], far: [Tavern] };
  withReach(true, () => {
    for (let i = 0; i < 8; i++) assert.deepEqual(drawn(threeTowns(rows), 'house4', () => (i + 0.5) / 8), ['Near', House2], `Nearby, roll ${i}`);
  });
  withReach(false, () => {
    for (let i = 1; i <= 8; i++) assert.deepEqual(drawn(threeTowns(rows), 'house4', seeded(i)), ['Near', House2], `the darts, seed ${i}`);
  });
});

// ---- a village laid out again (a town pack switched on or off): the load's re-seat ----

const MAP_ID = 4242, KEY = 17 + 100 * 958;
function village(buildings) {
  _resetLayoutPins();
  configureLayoutPins({ vendorOn: () => false, locationKeyOfMapId: (id) => (id === MAP_ID ? KEY : null) });
  const blocks = new Map([['VILLAGE.RMB', rmbBlock('VILLAGE.RMB', buildings)]]);
  const loc = town({ name: 'Aldleigh', locationIndex: 0, mapId: MAP_ID, grid: ['VILLAGE.RMB'] });
  const world = worldOf({ locations: [loc], blocks, current: loc });
  const m = new QuestMachine({ nowSeconds: () => 0, world, getReputation: () => 0, changeReputation: () => {} });
  const take = (name, kind, roll) => {
    const q = quiet(() => m.parseQuestForLists(quest(name, [`Place _site_ local ${kind}`, 'variable _done_']), 0, { rolls: () => roll }));
    m.startQuestImmediate(q);
    return q.getPlace({ name: 'site' });
  };
  /** The village as it stands now: `now` its buildings, every site chosen in another layout (Beautiful Villages'). */
  const relaid = (now) => {
    blocks.set('VILLAGE.RMB', rmbBlock('VILLAGE.RMB', now));
    for (const q of m.quests.values()) for (const r of q.resources.values()) if (r.isPlace && r.siteDetails) r.siteDetails.layout = `${BV}@1.4.2`;
  };
  return { m, world, loc, take, relaid, typeOf: (p) => typeAtKey(world, loc, p.siteDetails.buildingKey) };
}

test('RESEAT-TYPED: the load\'s re-seat seats every quest\'s sites of a kind before any wildcard - a `local random` taken first no longer takes the one tavern a later `local tavern` needs and leaves it unseated (mutants: one pass in quest order)', () => {
  const v = village([{ type: Tavern, seed: 1 }, { type: Tavern, seed: 2 }, { type: GeneralStore, seed: 3 }]);
  const any = v.take('__ANY', 'random', 0);
  const inn = v.take('__INN', 'tavern', 0);
  assert.deepEqual([v.typeOf(any), v.typeOf(inn)], [Tavern, Tavern], 'the fixture: the wildcard took one tavern, the duel the other');
  // laid out again: one tavern and one shop (three houses with no marker before them, a quest's site in none)
  v.relaid([{ type: House2, seed: 4, markers: [] }, { type: House2, seed: 5, markers: [] }, { type: House2, seed: 6, markers: [] }, { type: Tavern, seed: 7 }, { type: GeneralStore, seed: 8 }]);
  assert.equal(v.m.reseatMovedSites(v.world), 2, 'both chosen again');
  assert.ok(!inn.siteDetails.unseated, 'the tavern\'s site is seated');
  assert.equal(v.typeOf(inn), Tavern, 'in the one tavern');
  assert.equal(v.typeOf(any), GeneralStore, 'the wildcard takes what is left');
});

test('RESEAT-TYPED: a moved site takes the building of its own name where the town as it stands has one - the journal names it - whatever the draw (mutants: the name first)', () => {
  for (let i = 0; i < 6; i++) {
    const v = village([{ type: Tavern, seed: 1 }, { type: Tavern, seed: 2 }]);
    const inn = v.take('__INN', 'tavern', 0.99);
    const named = inn.siteDetails.buildingName;
    assert.ok(named, 'the fixture: the site has its name');
    v.relaid([{ type: GeneralStore, seed: 3 }, { type: GeneralStore, seed: 4 }, { type: Tavern, seed: 2 }, { type: Tavern, seed: 1 }]);
    inn.parentQuest.rolls = () => (i + 0.5) / 6;
    assert.equal(v.m.reseatMovedSites(v.world), 1);
    assert.equal(inn.siteDetails.buildingName, named, `roll ${i}: the tavern of its own name`);
    assert.equal(inn.siteDetails.buildingKey & 0xff, 2, `roll ${i}: where that tavern stands now`);
  }
});

// ---- a region of dungeons, some with no quest marker ----

/** The player's town, `bare` dungeons whose block holds no quest marker, then one whose block does; the dungeon blocks
 *  the draw walks, in order. */
function dungeons(bare) {
  const home = town({ name: 'Home', locationIndex: 0, mapId: 100, grid: ['HOME.RMB'] });
  const blocks = new Map([['HOME.RMB', rmbBlock('HOME.RMB', [{ type: Tavern }])], ['BARE.RDB', { position: 50, rdbBlock: { objectRootList: [{ rdbObjects: [] }] } }], ['LAIR.RDB', rdbBlock(100)]]);
  const locations = [home];
  for (let i = 0; i < bare; i++) locations.push(dungeon({ name: `Bare ${i}`, locationIndex: locations.length, mapId: 200 + i, dungeonType: 2, block: 'BARE.RDB' }));
  locations.push(dungeon({ name: 'The Lair', locationIndex: locations.length, mapId: 300, dungeonType: 2, block: 'LAIR.RDB' }));
  const world = worldOf({ locations, blocks, current: home });
  const walked = [];
  const getBlock = world.getBlock;
  world.getBlock = (name) => { if (name.endsWith('.RDB')) walked.push(name); return getBlock(name); };
  return { world, walked };
}
const lairOf = (world) => {
  const m = new QuestMachine({ nowSeconds: () => 0, world, playerLevel: () => 1 });
  const q = quiet(() => m.parseQuestForLists(quest('__DRAW', ['Place _lair_ remote dungeon', 'variable _done_']), 0, { rolls: () => 0 }));
  return q?.getPlace({ name: 'lair' })?.siteDetails ?? null;
};

test('MARKERLESS-DRAW: a remote dungeon drawn with no quest marker is set aside and another of the pool drawn - the quest starts in the dungeon that has one; a few draws at most, each a dungeon\'s walk (mutants: one draw; the bound)', () => {
  withReach(false, () => {
    const one = dungeons(1);
    const sd = lairOf(one.world);
    assert.equal(sd?.locationName, 'The Lair', 'the bare dungeon drawn first, set aside');
    assert.ok(sd.questSpawnMarkers?.length, 'its markers enumerated');
    assert.deepEqual(one.walked, ['BARE.RDB', 'LAIR.RDB']);
    const five = dungeons(5);
    assert.equal(lairOf(five.world)?.locationName, 'The Lair', 'the sixth draw');
    assert.equal(five.walked.length, 6);
    const six = dungeons(6);
    assert.equal(lairOf(six.world), null, 'six bare dungeons ahead of it: the draw gives up (and `any dungeon` again)');
    assert.deepEqual(six.walked, Array(12).fill('BARE.RDB'), 'six walks a draw, twice');
  });
});

// ---- a quest's own link for each of its Places ----

test('LINK-OWN: a second Place of one quest at the building a first holds a link for gets a link of its own - hasSiteLink asks for this quest\'s link for this Place - and the mount stands what the quest put there (mutants: the Place\'s name)', () => {
  const blocks = new Map([['TOWN.RMB', rmbBlock('TOWN.RMB', [{ type: Tavern, seed: 1 }, { type: Tavern, seed: 2 }])]]);
  const loc = town({ name: 'Aldleigh', locationIndex: 0, mapId: MAP_ID, grid: ['TOWN.RMB'] });
  let now = 0;
  const m = new QuestMachine({ nowSeconds: () => now, world: worldOf({ locations: [loc], blocks, current: loc }), playerLevel: () => 1 });
  const q = quiet(() => m.scheduleQuest(quest('__OWN', ['Item _one_ letter', 'Item _two_ letter', 'Place _a_ local tavern', 'Place _b_ local tavern', 'Clock _go_ 00:01 0', '',
    '\tstart timer _go_', '', '_go_ task:', '\tplace item _one_ at _a_', '\tplace item _two_ at _b_']), 0, { rolls: () => 0 }));
  m.tick();
  const a = q.getPlace({ name: 'a' }), b = q.getPlace({ name: 'b' });
  b.siteDetails = structuredClone(a.siteDetails);   // S0000503's _dummy_'s home and _magesguild_: one hall
  m.addSiteLink({ questUID: q.uid + 1000, placeSymbol: { name: 'b', clone() { return this; } }, siteType: SITE_TYPES.Building, mapId: a.siteDetails.mapId, buildingKey: a.siteDetails.buildingKey, magicNumberIndex: 0 });
  assert.equal(m.hasSiteLink(q, b.symbol), false, 'another quest\'s link at the site, of a Place of the same name, is not this one\'s');
  m.siteLinks = m.siteLinks.filter((l) => l.questUID === q.uid);   // that quest gone again: the mount walks this one's alone
  for (let i = 0; i < 4; i++) { now += 60; m.tick(); }
  assert.deepEqual(m.siteLinks.filter((l) => l.questUID === q.uid).map((l) => l.placeSymbol.name), ['a', 'b'], 'each Place its own link');
  assert.equal(m.hasSiteLink(q, a.symbol), true);
  assert.equal(m.hasSiteLink(q, b.symbol), true);
  const stood = [];
  addQuestResourceObjects(m, { currentMapId: () => a.siteDetails.mapId, findBehaviours: () => [], standItem: ({ item }) => { stood.push(item.symbol.name); return null; } }, SITE_TYPES.Building, a.siteDetails.buildingKey);
  assert.deepEqual(stood.sort(), ['one', 'two'], 'the building\'s mount stands both');
});

// ---- QLBD02, the Faithful ----

test('QLBD02\'s two mages: the script parses, and the courier\'s hour places the Summoner and two Mages at _coven_ - one Foe each, so the dungeon\'s mount stands both (a marker stands one foe of a `2 Mage`) and a mage killed stays dead (mutants: the `2 Mage` back; the second placing dropped)', () => {
  withReach(false, () => {
    const home = town({ name: 'Home', locationIndex: 0, mapId: 100, grid: ['HOME.RMB'] });
    const hall = town({ name: 'Hallton', locationIndex: 1, mapId: 101, grid: ['HALL.RMB'] });
    hall.exterior.buildings = [{ buildingType: GuildHall, factionId: 40 }];
    const coven = dungeon({ name: 'Coven Deep', locationIndex: 2, mapId: 300, dungeonType: 2, block: 'LAIR.RDB' });
    const blocks = new Map([['HOME.RMB', rmbBlock('HOME.RMB', [{ type: Tavern }])], ['HALL.RMB', rmbBlock('HALL.RMB', [{ type: GuildHall, faction: 40 }, { type: House2 }])], ['LAIR.RDB', LAIR]]);
    let now = 1000;
    const m = packMachine({ nowSeconds: () => now, world: worldOf({ locations: [home, hall, coven], blocks, current: home }), playerLevel: () => 10, giveItemToPlayer: () => {}, isPlayerInTown: () => true });
    const q = quiet(() => m.scheduleQuest(questSource('QLBD02'), 0, { rolls: () => 0.5 }));
    assert.ok(q, 'QLBD02 parses');
    for (let i = 0; i < 12; i++) { now += 1200; quiet(() => m.tick()); }
    const sd = q.getPlace({ name: 'coven' }).siteDetails;
    const placed = [sd.selectedMarker, ...(sd.questSpawnMarkers ?? [])].flatMap((mk) => (mk?.targetResources ?? []).map((s) => s.name));
    assert.deepEqual([...new Set(placed)].sort(), ['faithful', 'faithful2', 'summoner'], 'all three at the coven');
    for (const name of ['faithful', 'faithful2']) {
      const f = q.getResource({ name });
      assert.deepEqual([f.isFoe, f.spawnCount], [true, 1], `_${name}_: one foe`);
    }
    assert.equal(q.getResource({ name: 'faithful' }).foeType, q.getResource({ name: 'faithful2' }).foeType, 'both Mages');
    const stood = [];
    addQuestResourceObjects(m, { currentMapId: () => 300, findBehaviours: () => [], loadInProgress: () => false, standFoe: ({ foe }) => { stood.push(foe.symbol.name); return null; } }, SITE_TYPES.Dungeon, 0);
    assert.deepEqual(stood.sort(), ['faithful', 'faithful2', 'summoner'], 'the mount stands the Summoner and both mages');
  });
});

// ---- the pending hand-over ----

test('OFFER-STALE: a pending hand-over whose GivePc already gave, or whose quest ended, lies a week in its tombstone or was set aside, is let go - the Rest or Travel press is the player\'s; a live one is handed over, once (mutants: each)', () => {
  const sender = (o = {}, q = {}) => ({ isComplete: false, offered: 0, offerImmediatelyNow() { this.offered++; }, parentQuest: { questComplete: false, questTombstoned: false, shelvedAt: null, ...q }, ...o });
  try {
    for (const [why, s] of [['given', sender({ isComplete: true })], ['ended', sender({}, { questComplete: true })], ['tombstoned', sender({}, { questTombstoned: true })], ['set aside', sender({}, { shelvedAt: 0 })]]) {
      noteOfferPending(s);
      assert.equal(giveOffer(), false, `${why}: the press is not spent`);
      assert.equal(s.offered, 0, `${why}: nothing handed over`);
      assert.equal(pendingOfferSender(), null, `${why}: let go`);
    }
    const live = sender();
    noteOfferPending(live);
    assert.equal(giveOffer(), true, 'a live offer spends the press');
    assert.equal(live.offered, 1);
    assert.equal(giveOffer(), false, 'once');
  } finally { clearPendingOffer(); }
});

test('OFFER-STALE: a load lets the replaced game\'s pending hand-over go (mutants: the restore\'s clear)', () => {
  const b = quiet(() => createQuestBridge({ data: { readListTable: () => null, getQuestSourceLines: () => null } }));
  const snap = JSON.parse(JSON.stringify(b.snapshot()));
  const live = { isComplete: false, offerImmediatelyNow() {}, parentQuest: { questComplete: false } };
  try {
    noteOfferPending(live);
    quiet(() => b.restore(snap));
    assert.equal(pendingOfferSender(), null, 'the loaded game has no hand-over pending');
  } finally { clearPendingOffer(); }
});

// ---- the guild's jobs ----

const OFFER_SRC = ['Quest: __WORK', 'DisplayName: The Work', 'QRC:', 'QuestorOffer:  [1000]', '<ce> Will you?', '', 'RefuseQuest:  [1001]', '<ce> No.', '', 'AcceptQuest:  [1002]', '<ce> Yes.', '', 'Message:  1011', ' x', '', 'QBN:', 'variable _done_'];
function guildDoor(rows) {
  const m = new QuestMachine({ nowSeconds: () => 0, playerLevel: () => 1 });
  const lists = new QuestListsManager({
    readListTable: (name) => (name === 'Classic' ? ['schema: *name, group, membership, minReq, flag, notes', ...rows].join('\n') : null),
    getQuestSourceLines: (name) => (name === '__WORK' ? OFFER_SRC : null),
    parseQuest: (l, f, p) => m.parseQuestForLists(l, f, { rolls: () => 0, partialParse: p }),
    rolls: () => 0,
  });
  const flow = new QuestOfferFlow(m, lists, { isPlayerInsideCastle: () => false, getGuildFactionId: () => 777, guildQuestListBox: true });
  const guild = { isMember: () => true, rank: 0, deity: 'Arkay', getReputation: () => 0, isSatisfyQuestReqByLevel: () => false };
  return () => quiet(() => flow.offerGuildQuest({ guildGroup: GUILD_GROUPS.FightersGuild, guild }));
}

test('NO-WORK: with Choose Guild Jobs on, a guild with no work for the player says the classic "no work" line at once, and a list whose every row fails its parse says it at the wait box\'s close - never a picker of nothing (mutants: the empty pool; the empty list)', () => {
  const none = guildDoor(['__WORK, FightersGuild, M, 5, 0, x'])();   // rank 0 misses the gate: no work
  assert.equal(none.kind, 'fail', 'no wait box over an empty pool');
  const broken = guildDoor(['__GONE, FightersGuild, M, 0, 0, x'])();   // no source: fails even the header parse
  assert.equal(broken.kind, 'gettingQuests', 'the wait box, over a pool of one');
  assert.equal(quiet(() => broken.onClose()).kind, 'fail', 'nothing labels: the "no work" line, not an empty picker');
  const work = guildDoor(['__WORK, FightersGuild, M, 0, 0, x'])();
  assert.deepEqual(quiet(() => work.onClose()).entries, ['The Work'], 'a job to pick is still picked');
});

// ---- the journal windows' "Time remains" ----

test('NAMED-TIMER: the pause tab\'s and the chronicle\'s "Time remains" is the tightest of the deadlines the entries name - never a closing hour the journal does not name, nor the farther of two it does (mutants: the named filter, the minimum)', () => {
  const lines = ['Quest: __TWODAYS', 'DisplayName: Two Deadlines', 'QRC:', 'Message:  1010', ' I have =far_ days to find the ring, and =near_ days to warn the king.', '',
    'QBN:', 'Clock _far_ 5.00:00', 'Clock _near_ 3.00:00', 'Clock _closing_ 01:00', '', '_far_ task:', ' end quest', '', '_near_ task:', ' end quest', '', '_closing_ task:', ' end quest', '',
    'log 1010 step 0', 'start timer _far_', 'start timer _near_', 'start timer _closing_'];
  const clock = { now: 50000 };
  const b = quiet(() => createQuestBridge({ data: { readListTable: () => null, getQuestSourceLines: (n) => (n === '__TWODAYS' ? lines : null) }, classicSeconds: () => clock.now }));
  quiet(() => b.machine.startQuestByName('__TWODAYS', 0, { rolls: () => 0 }));
  for (let i = 0; i < 3; i++) { clock.now += 1; quiet(() => b.machine.tick()); }
  const row = b.questLog().active.find((r) => r.questName === '__TWODAYS');
  const by = Object.fromEntries(row.clocks.map((c) => [c.name, c.seconds]));
  assert.ok(by.closing <= 3600 && by.near > 2.9 * 86400 && by.far > 4.9 * 86400, `the fixture: three clocks count - ${JSON.stringify(by)}`);
  assert.equal(row.clockSeconds, by.near, 'the nearer of the two deadlines the entry names');
});

test('The exterior\'s quest world hands %oth and %jok their TEXT.RSC pool, as world.js\'s does (source pin; mutants: the line)', () => {
  assert.match(src('src/scenes/exterior.js'), /flatCaption: \(archive, record\) => pipeline\.flatCaption\(archive, record\),[^\n]*\n\s*getRandomText: \(id\) => townTalk\.randomText\?\.\(id\) \?\? null,/);
  assert.match(src('src/scenes/world.js'), /getRandomText: \(id\) => townTalk\.randomText\(id\),/);
});
