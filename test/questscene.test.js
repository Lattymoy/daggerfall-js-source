// Q4-iii - THE SCENE MOUNT: QuestResourceBehaviour.cs whole (the
// per-instance click/injury/death/queue law), GameObjectHelper's
// AddQuestResourceObjects walk with the flat-pick and marker-position
// laws, the machine's individual-NPC trio, the CreateFoe wave
// invalidations, PlaceFoeFreely's raycast ring headless, and the
// Place hot-place/hot-remove tail. Every pin asserts DFU literals
// over stub hosts - the geometry is the host bridge's (Q4-v).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadQuestTables } from '../src/systems/quest/tables.js';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { QuestResourceBehaviour } from '../src/systems/quest/resourceBehaviour.js';
import {
  addQuestResourceObjects, isAlreadyInjected, questNpcFlatData, getFlatData,
  markerScenePosition, placeFoeFreely, PLACE_FOE_DEFAULTS,
} from '../src/systems/quest/sceneMount.js';
import { SITE_TYPES, Place } from '../src/systems/quest/place.js';
import { QuestResource } from '../src/systems/quest/questResource.js';
import { RDB_SIDE } from '../src/world/rdbLayout.js';
import { GENDERS } from '../src/characters/nameHelper.js';
import { FACTION_TYPES } from '../src/formats/factionFile.js';

const VENDOR = join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'dfu-quests');
const read = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');
function loadTables() {
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) {
    if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = read(join(VENDOR, 'Tables', f));
  }
  loadQuestTables(sources);
}
loadTables();

const BARE_SRC = ['Quest: __SCN', 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'variable _done_'];

function makeQuest(m) {
  const quest = m.parseQuestForLists(BARE_SRC, 0, { rolls: () => 0 });
  m.startQuestImmediate(quest);
  return quest;
}

/** A capturing per-instance host handle. */
function makeHost(over = {}) {
  const calls = [];
  const host = {
    calls,
    setActive: (v) => calls.push(['setActive', v]),
    destroy: () => calls.push(['destroy']),
    staticNpcFactionId: null,
    of: (name) => calls.filter((c) => c[0] === name),
    ...over,
  };
  return host;
}

/** The enemy-entity surface stub (DaggerfallEntityBehaviour). */
function makeEnemy(over = {}) {
  const calls = [];
  const enemy = {
    calls,
    currentHealth: 10, maxHealth: 10,
    setCurrentHealth: (n) => { calls.push(['setCurrentHealth', n]); enemy.currentHealth = n; },
    setNonHostile: () => calls.push(['setNonHostile']),
    hasEffectManager: () => enemy._effects,
    assignSpellBundle: (s) => calls.push(['assignSpellBundle', s]),
    hasCorpseLootContainer: () => enemy._corpse,
    addItemsToCorpse: (items) => calls.push(['addItemsToCorpse', items]),
    addItemsToEntity: (items) => calls.push(['addItemsToEntity', items]),
    _effects: true, _corpse: false,
    of: (name) => calls.filter((c) => c[0] === name),
    ...over,
  };
  return enemy;
}

function makeFoeStub(over = {}) {
  return {
    isFoe: true,
    symbol: { name: 'foe', original: '_foe_' },
    isHidden: false, isRestrained: false,
    injuredTrigger: false, deathTrigger: false,
    killCount: 0, spawnCount: 1,
    spellQueue: null, itemQueue: null,
    get itemQueueCount() { return this.itemQueue?.length ?? 0; },
    getClonedItemQueue() { return (this.itemQueue ?? []).map((i) => ({ clonedFrom: i })); },
    setInjured() { this.injuredTrigger = true; },
    rearmInjured() { this.injuredTrigger = false; },
    incrementKills() { this.killCount += 1; },
    gender: GENDERS.Male,
    _questResourceBehaviour: null,
    get questResourceBehaviour() { return this._questResourceBehaviour; },
    set questResourceBehaviour(v) { this._questResourceBehaviour = v; v.onDestroy(() => { this._questResourceBehaviour = null; }); },
    setPlayerClicked() { this.hasPlayerClicked = true; },
    ...over,
  };
}

function bindFoe(m, quest, foeOver = {}, enemyOver = {}) {
  const foe = makeFoeStub(foeOver);
  foe.parentQuest = quest;
  quest.resources.set(foe.symbol.name, foe);
  const enemy = makeEnemy(enemyOver);
  const host = makeHost({ enemy });
  const b = new QuestResourceBehaviour(m, host);
  b.assignResource(foe);
  b.start();
  return { foe, enemy, host, b };
}

// ---------------------------------------------------------------
// QuestResourceBehaviour - the foe update law
// ---------------------------------------------------------------

test('the injured check fires BEFORE death and RETURNS for the tick - death lands one update later', () => {
  const m = new QuestMachine();
  const q = makeQuest(m);
  const { foe, enemy, b } = bindFoe(m, q);
  enemy.currentHealth = 0;   // one-shot to zero while never injured
  b.update();
  assert.equal(foe.injuredTrigger, true, 'the injury latch set first');
  assert.equal(foe.killCount, 0, 'the same tick never processes death (the return)');
  assert.equal(b.isFoeDead, false);
  b.update();
  assert.equal(foe.killCount, 1, 'the NEXT update counts the kill');
  assert.equal(b.isFoeDead, true);
  b.update();
  assert.equal(foe.killCount, 1, 'isFoeDead latches - one kill per instance');
});

test('DeathTrigger zeroes the entity health, once, and the kill follows', () => {
  const m = new QuestMachine();
  const q = makeQuest(m);
  const { foe, enemy, b } = bindFoe(m, q);
  foe.injuredTrigger = true;   // pre-armed: the injured arm stands aside
  foe.deathTrigger = true;
  b.update();
  assert.deepEqual(enemy.of('setCurrentHealth'), [['setCurrentHealth', 0]]);
  assert.equal(foe.killCount, 1);
  b.update();
  assert.equal(enemy.of('setCurrentHealth').length, 1, 'isFoeDead gates the re-zeroing');
});

test('a hidden foe destroys its instance and the destroy event uncouples the resource', () => {
  const m = new QuestMachine();
  const q = makeQuest(m);
  const { foe, host, b } = bindFoe(m, q);
  foe.questResourceBehaviour = b;
  foe.isHidden = true;
  b.update();
  assert.deepEqual(host.of('destroy'), [['destroy']]);
  assert.equal(foe.questResourceBehaviour, null, 'OnGameObjectDestroy cleared the scene link');
});

test('restrain applies setNonHostile ONCE and latches even with no motor seam', () => {
  const m = new QuestMachine();
  const q = makeQuest(m);
  const { foe, enemy, b } = bindFoe(m, q);
  foe.isRestrained = true;
  b.update(); b.update();
  assert.equal(enemy.of('setNonHostile').length, 1, 'restraintApplied latches');

  const { foe: foe2, b: b2 } = bindFoe(m, q, { symbol: { name: 'foe2', original: '_foe2_' } }, { setNonHostile: undefined });
  foe2.isRestrained = true;
  b2.update();
  assert.equal(b2.restraintApplied, true, 'the latch rises outside the motor check, C#');
});

test('castSpellQueue: parks without a manager, parks on EXACT zero health (negative still casts), drains to the END', () => {
  const m = new QuestMachine();
  const q = makeQuest(m);
  const { foe, enemy, b } = bindFoe(m, q);
  foe.spellQueue = [{ classicID: 1 }, { classicID: 2 }];
  enemy._effects = false;
  b.castSpellQueue(foe, enemy);
  assert.equal(b.foeSpellQueuePosition, 0, 'no EntityEffectManager - the queue WAITS');
  enemy._effects = true;
  enemy.currentHealth = 0;
  b.castSpellQueue(foe, enemy);
  assert.equal(b.foeSpellQueuePosition, 0, 'a dead target parks the queue');
  enemy.currentHealth = -5;
  b.castSpellQueue(foe, enemy);
  assert.equal(b.foeSpellQueuePosition, 2, 'the gate is EXACT zero - negative health casts, C#');
  assert.deepEqual(enemy.of('assignSpellBundle').map((c) => c[1].classicID), [1, 2]);
  foe.spellQueue.push({ classicID: 3 });
  b.castSpellQueue(foe, enemy);
  assert.deepEqual(enemy.of('assignSpellBundle').map((c) => c[1].classicID), [1, 2, 3], 'only from the position');
});

test('addItemQueue: the corpse loot container wins over the live entity; the clones land, the position jumps', () => {
  const m = new QuestMachine();
  const q = makeQuest(m);
  const { foe, enemy, b } = bindFoe(m, q);
  foe.itemQueue = ['sword'];
  b.addItemQueue(foe, enemy);
  assert.deepEqual(enemy.of('addItemsToEntity'), [['addItemsToEntity', [{ clonedFrom: 'sword' }]]]);
  assert.equal(b.foeItemQueuePosition, 1);
  foe.itemQueue.push('ring');
  enemy._corpse = true;
  b.addItemQueue(foe, enemy);
  assert.deepEqual(enemy.of('addItemsToCorpse').length, 1, 'already dead - the corpse container takes the drop');
  assert.equal(b.foeItemQueuePosition, 2);
  b.addItemQueue(foe, enemy);
  assert.equal(enemy.of('addItemsToCorpse').length + enemy.of('addItemsToEntity').length, 2, 'drained queues idle');
});

// ---------------------------------------------------------------
// DoClick + the person half
// ---------------------------------------------------------------

test('doClick clicks the resource; an item also transfers to the player and hides', () => {
  const gives = [];
  const m = new QuestMachine({ giveItemToPlayer: (dfItem) => gives.push(dfItem) });
  const q = makeQuest(m);
  const item = {
    isItem: true, symbol: { name: 'it', original: '_it_' },
    daggerfallUnityItem: { template: 'letter' }, isHidden: false,
    hasPlayerClicked: false, setPlayerClicked() { this.hasPlayerClicked = true; },
  };
  item.parentQuest = q;
  q.resources.set('it', item);
  const b = new QuestResourceBehaviour(m, makeHost());
  b.assignResource(item);
  b.start();
  assert.equal(b.doClick(), true);
  assert.equal(item.hasPlayerClicked, true);
  assert.deepEqual(gives, [{ template: 'letter' }]);
  assert.equal(item.isHidden, true, 'the world copy never re-picks up');
});

test("the individual broadcast ASSIGNS its result - an individual with no quest match overwrites the direct click's true", () => {
  const m = new QuestMachine({ world: { getFactionData: (id) => (id === 305 ? { id: 305, type: FACTION_TYPES.Individual } : null) } });
  const q = makeQuest(m);
  const person = {
    isPerson: true, symbol: { name: 'pp', original: '_pp_' },
    isIndividualNPC: false, factionData: { id: 999 },
    hasPlayerClicked: false, setPlayerClicked() { this.hasPlayerClicked = true; },
  };
  person.parentQuest = q;
  q.resources.set('pp', person);
  const b = new QuestResourceBehaviour(m, makeHost({ staticNpcFactionId: 305 }));
  b.assignResource(person);
  b.start();
  assert.equal(b.doClick(), false, 'IsIndividualNPC(305) true but NO individual person matches - false OVERWRITES');
  assert.equal(person.hasPlayerClicked, true, 'the direct click still landed');

  // Two quests carrying the individual, and a third that is DONE.
  //
  // AUDIT 24 (the seven-slice sweep): this block used to end
  // `q3.questComplete = true;   // even a completed quest's individual
  // clicks, C#` and assert exactly that. It is not C#.
  // ClickAllIndividualNPCs opens with
  // QuestMachine.Instance.GetAllActiveQuests() (:431), which is
  // precisely the quests that are neither Complete nor Tombstoned
  // (:849-859) - so a finished quest's King stops answering clicks. The
  // port walked every quest in the machine and the comment above the
  // loop asserted the no-complete-skip as if it were the source.
  const q2 = makeQuest(m);
  const q3 = makeQuest(m);
  const q4 = makeQuest(m);
  for (const qq of [q2, q3, q4]) {
    qq.resources.set('ind', {
      isPerson: true, symbol: { name: 'ind', original: '_ind_' },
      isIndividualNPC: true, factionData: { id: 305 },
      hasPlayerClicked: false, setPlayerClicked() { this.hasPlayerClicked = true; },
    });
  }
  q3.questComplete = true;
  q4.questTombstoned = true;
  assert.equal(b.doClick(), true);
  assert.equal(q2.resources.get('ind').hasPlayerClicked, true, 'the ACTIVE quest clicks');
  assert.equal(q3.resources.get('ind').hasPlayerClicked, false, 'a COMPLETED quest is out of the sweep');
  assert.equal(q4.resources.get('ind').hasPlayerClicked, false, 'and so is a tombstoned one');
});

test('a hidden or destroyed person deactivates through the RESOURCE side even off-tick; the recouple heals a lost link', () => {
  const m = new QuestMachine();
  const q = makeQuest(m);
  const person = makeFoeStub({ isFoe: false, isPerson: true, symbol: { name: 'pp', original: '_pp_' }, isDestroyed: false });
  person.parentQuest = q;
  q.resources.set('pp', person);
  const host = makeHost();
  const b = new QuestResourceBehaviour(m, host);
  b.assignResource(person);
  b.start();
  b.update();
  assert.equal(person.questResourceBehaviour, b, 'the update recoupled the lost link (the reload law)');
  assert.equal(host.of('setActive').length, 0, 'a visible person stays untouched');
  person.isHidden = true;
  b.update();
  assert.deepEqual(host.of('setActive'), [['setActive', false]]);
});

test('the base Tick drives SetActive(!IsHidden) every tick once a behaviour stands - and stays inert without one', () => {
  const m = new QuestMachine();
  const q = makeQuest(m);
  const r = new QuestResource(q);
  r.symbol = { name: 'rr', original: '_rr_' };
  const host = makeHost();
  const b = new QuestResourceBehaviour(m, host);
  r.questResourceBehaviour = b;
  r.tick(q);
  assert.deepEqual(host.of('setActive'), [['setActive', true]], 'visible -> SetActive(true), every tick');
  r.isHidden = true;
  r.tick(q);
  assert.deepEqual(host.of('setActive'), [['setActive', true], ['setActive', false]]);
  b.notifyDestroyed();
  assert.equal(r.questResourceBehaviour, null, 'the destroy handler uncoupled AND unsubscribed');
  r.tick(q);
  assert.equal(host.of('setActive').length, 2, 'no scene link, the whole body is inert again');
});

test('cacheTarget: identity first, then the machine walk; save data round-trips the six and re-caches', () => {
  const m = new QuestMachine();
  const q = makeQuest(m);
  const { foe, b } = bindFoe(m, q);
  assert.equal(b.cacheTarget(), true, 'already cached answers true');
  const fresh = new QuestResourceBehaviour(m);
  assert.equal(fresh.cacheTarget(), false, 'no identity, no cache');
  fresh.restoreSaveData({ ...b.getSaveData(), isFoeDead: true, foeSpellQueuePosition: 2, foeItemQueuePosition: 1, isAttackableByAI: true });
  assert.equal(fresh.targetResource, foe, 'RestoreSaveData re-caches through the machine');
  assert.equal(fresh.isFoeDead, true);
  assert.equal(fresh.foeSpellQueuePosition, 2);
  assert.equal(fresh.foeItemQueuePosition, 1);
  assert.equal(fresh.isAttackableByAI, true);
  assert.equal('restraintApplied' in b.getSaveData(), false, 'restraint is NOT save state - it re-applies after load, C#');
});

// ---------------------------------------------------------------
// The mount walk (AddQuestResourceObjects)
// ---------------------------------------------------------------

function makeMountRig({ links = 1 } = {}) {
  const m = new QuestMachine();
  const quest = makeQuest(m);
  const person = {
    isPerson: true, symbol: { name: 'npc', original: '_npc_' },
    isIndividualNPC: false, isQuestor: false, gender: GENDERS.Male,
    factionData: { id: 20, flat1: (182 << 7) | 20, flat2: (184 << 7) | 33 },
    _b: null,
    get questResourceBehaviour() { return this._b; },
    set questResourceBehaviour(v) { this._b = v; v.onDestroy(() => { this._b = null; }); },
  };
  const foe = makeFoeStub();
  foe.injuredTrigger = true;   // placement must REARM it
  const item = {
    isItem: true, symbol: { name: 'it', original: '_it_' },
    daggerfallUnityItem: { worldTextureArchive: 209, worldTextureRecord: 4 },
    _b: null,
    get questResourceBehaviour() { return this._b; },
    set questResourceBehaviour(v) { this._b = v; v.onDestroy(() => { this._b = null; }); },
  };
  person.parentQuest = quest; foe.parentQuest = quest; item.parentQuest = quest;
  quest.resources.set('npc', person);
  quest.resources.set('foe', foe);
  quest.resources.set('it', item);
  const marker = {
    dungeonX: 2, dungeonZ: 3, flatPosition: { x: 1.5, y: -0.25, z: 4 }, markerID: 77,
    targetResources: [{ name: 'npc' }, { name: 'foe' }, { name: 'it' }, { name: 'ghost' }],
  };
  const place = {
    isPlace: true,
    siteDetails: { selectedMarker: marker, questSpawnMarkers: null },
  };
  quest.resources.set('lair', place);
  for (let i = 0; i < links; i++) {
    m.siteLinks.push({ questUID: quest.uid, placeSymbol: { name: 'lair' }, siteType: SITE_TYPES.Dungeon, mapId: 999, buildingKey: 0, magicNumberIndex: 0 });
  }
  const stands = [];
  const adapter = {
    currentMapId: () => 999,
    findBehaviours: () => stands.map((s) => s.behaviour),
    loadInProgress: () => false,
    standNPC: (args) => { stands.push(args); return makeHost(); },
    standFoe: (args) => { stands.push(args); return makeHost({ enemy: makeEnemy() }); },
    standItem: (args) => { stands.push(args); return makeHost(); },
    stands,
  };
  return { m, quest, person, foe, item, place, marker, adapter };
}

test('the mount walk stands person/foe/item off the marker targets, couples both ways, and rearms the foe injury', () => {
  const { m, person, foe, item, marker, adapter } = makeMountRig();
  addQuestResourceObjects(m, adapter, SITE_TYPES.Dungeon, 0);
  assert.deepEqual(adapter.stands.map((s) => s.person?.symbol.name ?? s.foe?.symbol.name ?? s.item?.symbol.name),
    ['npc', 'foe', 'it'], 'the dangling ghost symbol skips silently');
  const npcStand = adapter.stands[0];
  assert.deepEqual(npcStand.flatData, { archive: 182, record: 20 }, 'male -> flat1, split archive<<7|record');
  assert.deepEqual(npcStand.position, {
    x: 2 * RDB_SIDE + 1.5, y: -0.25, z: 3 * RDB_SIDE + 4,
  }, 'block origin + flat position');
  assert.equal(person.questResourceBehaviour.targetResource, person, 'coupled and cached');
  assert.equal(adapter.stands[1].gender, 'male');
  assert.equal(foe.injuredTrigger, false, 'AddQuestFoe rearms the injured trigger at placement');
  assert.equal(item.questResourceBehaviour.targetResource, item);
  assert.equal(marker.targetResources.length, 4, 'the walk never mutates the marker');

  // a second mount is a no-op: the behaviours snapshot guards
  addQuestResourceObjects(m, adapter, SITE_TYPES.Dungeon, 0);
  assert.equal(adapter.stands.length, 3, 'IsAlreadyInjected skipped everything');
});

test('the mount gates: enableNPCs/enableFoes filter, enableItems is DEAD, spent foes and loads park foes only', () => {
  const rig1 = makeMountRig();
  addQuestResourceObjects(rig1.m, rig1.adapter, SITE_TYPES.Dungeon, 0, { enableNPCs: false, enableFoes: false, enableItems: false });
  assert.deepEqual(rig1.adapter.stands.map((s) => s.item?.symbol.name), ['it'],
    "items stand even with enableItems false - C#'s dead parameter");

  const rig2 = makeMountRig();
  rig2.foe.killCount = 1;   // spawnCount 1 - the wave is spent
  addQuestResourceObjects(rig2.m, rig2.adapter, SITE_TYPES.Dungeon, 0);
  assert.equal(rig2.adapter.stands.some((s) => s.foe), false, 'killCount < spawnCount gates the stand');

  const rig3 = makeMountRig();
  rig3.adapter.loadInProgress = () => true;
  addQuestResourceObjects(rig3.m, rig3.adapter, SITE_TYPES.Dungeon, 0);
  assert.equal(rig3.adapter.stands.some((s) => s.foe), false, 'foes never stand during a load');
  assert.equal(rig3.adapter.stands.some((s) => s.person), true, 'people still do');
});

test('the walk throws on a dangling quest or Place, verbatim', () => {
  const { m, adapter } = makeMountRig();
  m.siteLinks[0].questUID = 424242;
  assert.throws(() => addQuestResourceObjects(m, adapter, SITE_TYPES.Dungeon, 0),
    /Could not find active quest for UID 424242/);
  const rig2 = makeMountRig();
  rig2.m.siteLinks[0].placeSymbol = { name: 'nowhere' };
  assert.throws(() => addQuestResourceObjects(rig2.m, rig2.adapter, SITE_TYPES.Dungeon, 0),
    /Could not find Place symbol nowhere in quest UID/);
});

test('questNpcFlatData: individuals ALWAYS flat1, questors wear the clicked billboard, else the gender split', () => {
  const fd = { flat1: (180 << 7) | 3, flat2: (181 << 7) | 9 };
  assert.deepEqual(questNpcFlatData({ isIndividualNPC: true, gender: GENDERS.Female, factionData: fd }),
    { archive: 180, record: 3 }, 'a female individual still wears flat1');
  assert.deepEqual(questNpcFlatData({ isIndividualNPC: false, isQuestor: true, questorData: { billboardArchiveIndex: 197, billboardRecordIndex: 11 } }),
    { archive: 197, record: 11 });
  assert.deepEqual(questNpcFlatData({ isIndividualNPC: false, isQuestor: false, gender: GENDERS.Male, factionData: fd }),
    { archive: 180, record: 3 });
  assert.deepEqual(questNpcFlatData({ isIndividualNPC: false, isQuestor: false, gender: GENDERS.Female, factionData: fd }),
    { archive: 181, record: 9 });
  assert.deepEqual(getFlatData(0), { archive: 0, record: 0 });
});

test('isAlreadyInjected matches the SYMBOL OBJECT, not its name', () => {
  // AUDIT 24 (the seven-slice sweep): `behaviour.TargetSymbol ==
  // resource.Symbol` is a REFERENCE compare - Symbol overrides Equals
  // and GetHashCode and does NOT overload operator==, so `==` on it is
  // object identity, and CacheTarget assigns the resource's OWN Symbol
  // instance. This pin used to assert the name compare, and the port
  // matched the pin.
  const sym = { name: 'npc' };
  const b = { targetSymbol: sym };
  assert.equal(isAlreadyInjected([b], { symbol: sym }), true, 'the same resource');
  // the one that mattered: the snapshot is SCENE-WIDE, every quest at
  // once, and the corpus reuses symbol names relentlessly. A second
  // quest's _npc_ is a different Symbol object and must still be stood.
  assert.equal(isAlreadyInjected([b], { symbol: { name: 'npc' } }), false,
    "another quest's same-named resource is NOT already injected");
  assert.equal(isAlreadyInjected([b], { symbol: { name: 'other' } }), false);
  assert.equal(isAlreadyInjected([], { symbol: sym }), false);
  assert.equal(isAlreadyInjected(null, { symbol: sym }), false);
});

test('markerScenePosition: dungeon block origin at RDB_SIDE strides; interiors (0,0) pass the flat through', () => {
  assert.deepEqual(markerScenePosition({ dungeonX: 0, dungeonZ: 0, flatPosition: { x: 7, y: 2, z: -3 } }),
    { x: 7, y: 2, z: -3 });
  const p = markerScenePosition({ dungeonX: -1, dungeonZ: 2, flatPosition: { x: 0.5, y: 0, z: 0.25 } });
  assert.equal(p.x, -RDB_SIDE + 0.5);
  assert.equal(p.z, 2 * RDB_SIDE + 0.25);
});

// ---------------------------------------------------------------
// The individual-NPC trio (QuestMachine.cs:1310-1421)
// ---------------------------------------------------------------

function makeIndividualRig({ atHome = false } = {}) {
  const m = new QuestMachine({ world: { getFactionData: (id) => (id === 305 ? { id: 305, type: FACTION_TYPES.Individual } : (id === 510 ? { id: 510, type: FACTION_TYPES.Group } : null)) } });
  const quest = makeQuest(m);
  const person = {
    isPerson: true, symbol: { name: 'ind', original: '_ind_' },
    isIndividualNPC: true, isIndividualAtHome: atHome, factionId: 305, factionData: { id: 305 },
    _b: null,
    get questResourceBehaviour() { return this._b; },
    set questResourceBehaviour(v) { this._b = v; v.onDestroy(() => { this._b = null; }); },
    setPlayerClicked() { this.hasPlayerClicked = true; },
  };
  person.parentQuest = quest;
  quest.resources.set('ind', person);
  const place = { isPlace: true, siteDetails: { selectedMarker: { targetResources: [{ name: 'ind' }] }, questSpawnMarkers: null } };
  quest.resources.set('lair', place);
  m.siteLinks.push({ questUID: quest.uid, placeSymbol: { name: 'lair' }, siteType: SITE_TYPES.Dungeon, mapId: 999, buildingKey: 0, magicNumberIndex: 0 });
  return { m, quest, person };
}

test('isIndividualNPC: the faction type decides; no world seam answers false', () => {
  const { m } = makeIndividualRig();
  assert.equal(m.isIndividualNPC(305), true);
  assert.equal(m.isIndividualNPC(510), false, 'a Group faction is not an individual');
  assert.equal(m.isIndividualNPC(9999), false);
  assert.equal(new QuestMachine().isIndividualNPC(305), false, "no world ≙ C#'s null PlayerEntity");
});

test('isIndividualQuestNPCAtSiteLink: true only for an individual placed AWAY from home', () => {
  const away = makeIndividualRig({ atHome: false });
  assert.equal(away.m.isIndividualQuestNPCAtSiteLink(305), true);
  const home = makeIndividualRig({ atHome: true });
  assert.equal(home.m.isIndividualQuestNPCAtSiteLink(305), false, 'IsIndividualAtHome exempts the link');
  assert.equal(away.m.isIndividualQuestNPCAtSiteLink(510), false, 'non-individuals answer false before any walk');
  // a link whose marker carries no targets logs and walks on
  away.m.siteLinks.unshift({ questUID: away.quest.uid, placeSymbol: { name: 'lair2' }, siteType: SITE_TYPES.Dungeon, mapId: 1, buildingKey: 0, magicNumberIndex: 0 });
  away.quest.resources.set('lair2', { isPlace: true, siteDetails: { selectedMarker: { targetResources: null } } });
  assert.equal(away.m.isIndividualQuestNPCAtSiteLink(305), true, 'the empty link is skipped, not fatal');
});

test('setupIndividualStaticNPC: away disables the home copy; at home a behaviour ALWAYS attaches (the bootstrap click)', () => {
  const away = makeIndividualRig({ atHome: false });
  const host1 = makeHost();
  assert.equal(away.m.setupIndividualStaticNPC(host1, 305), false);
  assert.deepEqual(host1.of('setActive'), [['setActive', false]]);

  const home = makeIndividualRig({ atHome: true });
  const host2 = makeHost();
  const behaviour = home.m.setupIndividualStaticNPC(host2, 305);
  assert.ok(behaviour instanceof QuestResourceBehaviour);
  assert.equal(behaviour.targetSymbol?.name, 'ind', 'assigned to the first active faction Person');
  assert.equal(home.person.questResourceBehaviour, behaviour, 'coupled back');
  // AUDIT 24 (the seven-slice sweep): and CACHED. C# gets Start() for
  // free - AddComponent schedules it and Unity runs it on the next
  // frame, after the AssignResource - which is why
  // QuestResourceBehaviour.Start warns "This will fail if targetQuest
  // and targetSymbol are not set before Start()". The port's stand-in
  // is an explicit start(), which sceneMount calls at all three of its
  // mints and this one did not, so the bootstrap behaviour came back
  // permanently uncoupled with targetResource null - and it exists
  // precisely to carry the follow-up-quest bootstrap CLICK.
  assert.equal(behaviour.targetResource, home.person, 'CacheTarget ran - the link is live');

  // no active persons: the bare bootstrap behaviour still attaches
  const m2 = new QuestMachine({ world: { getFactionData: () => ({ id: 305, type: FACTION_TYPES.Individual }) } });
  const bare = m2.setupIndividualStaticNPC(makeHost(), 305);
  assert.ok(bare instanceof QuestResourceBehaviour);
  assert.equal(bare.questUID, 0, 'unassigned until a quest uses the NPC');
  assert.equal(bare.targetResource, null, 'and start() on an unassigned one is its own no-op, as C#\'s deferred Start is');

  assert.equal(away.m.setupIndividualStaticNPC(makeHost(), 510), true, 'a non-individual answers plain true');
});

// ---------------------------------------------------------------
// The CreateFoe wave invalidations
// ---------------------------------------------------------------

test('notifyExteriorTransition and notifyInitWorld drop every pending wave - scheduled quests included', () => {
  const m = new QuestMachine();
  const SRC = ['Quest: __WAVE', 'QRC:', 'Message:  1011', ' x', '', 'QBN:',
    'Foe _f_ is Giant_rat', '',
    '_go_ task:', ' create foe _f_ every 1 minutes 2 times with 100% success', '',
    'variable _pad_'];
  const live = m.scheduleQuest(SRC, 0, { rolls: () => 0 });
  m.tick();   // starts the live quest
  const scheduled = m.scheduleQuest(SRC, 0, { rolls: () => 0 });   // stays in questsToInvoke
  const actionOf = (quest) => [...quest.tasks.values()].flatMap((t) => t.actions).find((a) => a.pendingFoes !== undefined);
  for (const a of [actionOf(live), actionOf(scheduled)]) {
    a.pendingFoes = [{}]; a.spawnInProgress = true;
  }
  m.notifyExteriorTransition();
  for (const a of [actionOf(live), actionOf(scheduled)]) {
    assert.equal(a.pendingFoes, null);
    assert.equal(a.spawnInProgress, false);
  }
  actionOf(live).pendingFoes = [{}]; actionOf(live).spawnInProgress = true;
  m.notifyInitWorld();
  assert.equal(actionOf(live).pendingFoes, null, 'the init-world door drops waves the same way');
  assert.equal(actionOf(live).spawnInProgress, false);
});

// ---------------------------------------------------------------
// The hot-place / hot-remove tail (Place.AssignQuestResource)
// ---------------------------------------------------------------

test('hot-place mounts when the player is HERE; a stood behaviour hot-removes when they are NOT; the missing seam skips both', () => {
  // exercised through a real parsed quest's Place assign - reuse the
  // questplaces-style path lightly: stub the place instance directly
  const m = new QuestMachine();
  const quest = makeQuest(m);
  const calls = [];
  quest.hooks = { world: { mountCurrentSiteQuestResources: () => calls.push('mount') }, cullResourceTarget: () => {} };
  const place = new Place(quest);
  place.symbol = { name: 'pub' };
  place.siteDetails = {
    selectedMarker: { targetResources: null },
    questSpawnMarkers: [{ dungeonX: 0, dungeonZ: 0, flatPosition: { x: 0, y: 0, z: 0 }, markerID: 1, targetResources: null }],
    questItemMarkers: null,
  };
  const host = makeHost();
  const resource = makeFoeStub({ isFoe: false, isPerson: true, symbol: { name: 'pp', original: '_pp_' } });
  resource.parentQuest = quest;
  quest.resources.set('pp', resource);
  const b = new QuestResourceBehaviour(m, host);
  b.assignResource(resource);
  resource.questResourceBehaviour = b;

  place.isPlayerHere = () => true;
  place.assignQuestResource({ name: 'pp', clone() { return { name: 'pp' }; } });
  assert.deepEqual(calls, ['mount'], 'player here - the layout mounts NOW');
  assert.equal(host.of('destroy').length, 0);

  place.isPlayerHere = () => false;
  place.assignQuestResource({ name: 'pp', clone() { return { name: 'pp' }; } });
  assert.deepEqual(host.of('destroy'), [['destroy']], 'moved somewhere the player is not - the stood copy dies');
  assert.equal(resource.questResourceBehaviour, null, 'and uncoupled');

  // C#'s missing PlayerEnterExit RETURNS - the hot-remove is skipped too
  const b2 = new QuestResourceBehaviour(m, host);
  b2.assignResource(resource);
  resource.questResourceBehaviour = b2;
  quest.hooks = { world: {}, cullResourceTarget: () => {} };
  place.isPlayerHere = () => true;
  place.assignQuestResource({ name: 'pp', clone() { return { name: 'pp' }; } });
  assert.equal(host.of('destroy').length, 1, 'no seam, no hot-remove either (the return)');
});

// ---------------------------------------------------------------
// PlaceFoeFreely - the raycast ring
// ---------------------------------------------------------------

function ringEnv(over = {}) {
  return {
    playerPosition: { x: 0, y: 0, z: 0 },
    playerYawRadians: 0,
    fovDegrees: 60,
    rolls: () => 0,
    raycast: () => null,
    overlapSphere: () => false,
    ...over,
  };
}

test('the open-area arm: distance rides the third roll, direction the FOV + jitter with the side coin', () => {
  const rolls = [0.5, 0.6, 0.5];   // jitter 2°, coin 0.6 > 0.5 -> LEFT (negative), distance mid
  let i = 0;
  const rays = [];
  const env = ringEnv({
    rolls: () => rolls[i++],
    raycast: (origin, dir, max) => {
      rays.push({ origin, dir, max });
      if (dir.y === -1) return { point: { x: origin.x, y: origin.y - 1, z: origin.z }, normal: { x: 0, y: 1, z: 0 }, distance: 1 };
      return null;   // the spawn ray misses - open area
    },
  });
  const pos = placeFoeFreely(env);
  // yaw = -(60 + 2)° ; distance = 5 + 0.5 * (20 - 5) = 12.5
  const yaw = -(62) * Math.PI / 180;
  assert.ok(Math.abs(pos.x - Math.sin(yaw) * 12.5) < 1e-9, 'left of the FOV cone');
  assert.ok(Math.abs(pos.z - Math.cos(yaw) * 12.5) < 1e-9);
  assert.equal(pos.y, -1 + PLACE_FOE_DEFAULTS.separationDistance, 'the floor point + the separation rise');
  assert.equal(rays[0].max, 20, 'the spawn probe rides maxDistance');
  assert.equal(rays[1].max, 4, 'the floor probe rides maxFloorDistance');
});

test('the wall-hit arm: separation leans on cos_normal, the slack gates, the point backs off the hit', () => {
  const rolls = [0, 0, 0.5];   // no jitter, coin 0 -> RIGHT (+60°), extra = half the slack cap
  let i = 0;
  const env = ringEnv({
    rolls: () => rolls[i++],
    raycast: (origin, dir, max) => {
      if (dir.y === -1) return { point: { x: origin.x, y: -2, z: origin.z }, normal: { x: 0, y: 1, z: 0 }, distance: 2 };
      // a wall square to the ray, 10 units out
      return { point: { x: dir.x * 10, y: 0, z: dir.z * 10 }, normal: { x: -dir.x, y: 0, z: -dir.z }, distance: 10 };
    },
  });
  const pos = placeFoeFreely(env);
  // cos_normal = 1 -> separationForward = 1.25; slack = 10 - 1.25 - 5 = 3.75
  // extra = 0.5 * min(2, 3.75) = 1 -> the point is 10 - 2.25 along the ray
  const yaw = 60 * Math.PI / 180;
  const along = 10 - 2.25;
  assert.ok(Math.abs(pos.x - Math.sin(yaw) * along) < 1e-9);
  assert.ok(Math.abs(pos.z - Math.cos(yaw) * along) < 1e-9);
  assert.equal(pos.y, -2 + 1.25);
});

test('the ring refusals: grazing normals, short slack, no floor, occupied space', () => {
  // grazing: the wall normal perpendicular to the ray -> cos < 1e-6
  const grazing = ringEnv({
    raycast: (o, dir) => (dir.y === -1 ? null : { point: { x: 0, y: 0, z: 5 }, normal: { x: 1, y: 0, z: 0 }, distance: 5 }),
  });
  // make the normal EXACTLY perpendicular to the spawn direction
  grazing.playerYawRadians = -grazing.fovDegrees * Math.PI / 180;   // spawn dir = +z
  assert.equal(placeFoeFreely(grazing), null);

  const tooClose = ringEnv({
    raycast: (o, dir) => (dir.y === -1 ? null : { point: {}, normal: { x: -dir.x, y: 0, z: -dir.z }, distance: 6 }),
  });
  // slack = 6 - 1.25 - 5 < 0
  assert.equal(placeFoeFreely(tooClose), null);

  // spawn ray misses (open arm) and the floor ray ALSO misses
  assert.equal(placeFoeFreely(ringEnv()), null);

  const occupied = ringEnv({
    raycast: (o, dir) => (dir.y === -1 ? { point: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 1, z: 0 }, distance: 1 } : null),
    overlapSphere: () => true,
  });
  assert.equal(placeFoeFreely(occupied), null, 'the 0.65 overlap sphere vetoes');

  // the wilderness widening is the published constant pair
  assert.equal(PLACE_FOE_DEFAULTS.wildernessMinDistance, 8);
  assert.equal(PLACE_FOE_DEFAULTS.wildernessMaxDistance, 25);
});

// ---------------------------------------------------------------
// AUDIT XI boundary pins (the campaign's survivors)
// ---------------------------------------------------------------

test('behaviour defaults and cacheTarget faces: the save shape starts clean, every miss answers false, success answers true', () => {
  const m = new QuestMachine();
  const q = makeQuest(m);
  assert.equal(new QuestResourceBehaviour(m).getSaveData().isAttackableByAI, false, 'the ctor default - ChangeFoeInfighting (MT-iii) is what writes it');

  const unknownQuest = new QuestResourceBehaviour(m);
  unknownQuest.questUID = 424242;
  unknownQuest.targetSymbol = { name: 'x' };
  assert.equal(unknownQuest.cacheTarget(), false, 'a dangling quest UID resolves nothing');
  assert.equal(unknownQuest.targetQuest, null);

  const nullSymbol = new QuestResourceBehaviour(m);
  nullSymbol.questUID = q.uid;
  assert.equal(nullSymbol.cacheTarget(), false);
  assert.equal(nullSymbol.targetQuest, null, 'the identity gate returns BEFORE touching the quest');

  const missingResource = new QuestResourceBehaviour(m);
  missingResource.questUID = q.uid;
  missingResource.targetSymbol = { name: 'nothing' };
  assert.equal(missingResource.cacheTarget(), false);
  assert.equal(missingResource.cacheTarget(), false, 'a half-cached quest never fakes a hit on the second call');

  const { b } = bindFoe(m, q);
  const fresh = new QuestResourceBehaviour(m, b.host);
  fresh.questUID = b.questUID;
  fresh.targetSymbol = b.targetSymbol;
  assert.equal(fresh.cacheTarget(), true, 'the resolve face answers true, not just the cached face');
});

test('an unbound behaviour is inert: update() never throws, doClick() answers false', () => {
  const m = new QuestMachine();
  const bare = new QuestResourceBehaviour(m);
  bare.update();
  assert.equal(bare.doClick(), false, 'nothing found in any active quest');
});

test('a full-health foe never trips the injured latch; health EXACTLY 1 is not a death', () => {
  const m = new QuestMachine();
  const q = makeQuest(m);
  const { foe, enemy, b } = bindFoe(m, q);
  b.update();
  assert.equal(foe.injuredTrigger, false, 'the injury gate is strictly BELOW max');
  enemy.currentHealth = 1;
  b.update();          // injures and returns
  b.update();          // the death tick
  assert.equal(foe.killCount, 0, 'the death gate is <= 0, not <= 1');
  assert.equal(b.isFoeDead, false);
});

test('a hidden foe destroys WITHOUT a person-arm deactivation first', () => {
  const m = new QuestMachine();
  const q = makeQuest(m);
  const { foe, host, b } = bindFoe(m, q);
  foe.questResourceBehaviour = b;
  foe.isHidden = true;
  b.update();
  assert.equal(host.of('setActive').length, 0, 'the person arm is && - a foe never takes SetActive here');
  assert.deepEqual(host.of('destroy'), [['destroy']]);
});

test('the queue drains guard EVERY validate arm - a null enemy or foe is a plain park, never a throw', () => {
  const m = new QuestMachine();
  const q = makeQuest(m);
  const { foe, enemy, b } = bindFoe(m, q);
  foe.spellQueue = [{ classicID: 1 }];
  b.castSpellQueue(foe, null);
  assert.equal(b.foeSpellQueuePosition, 0, 'no enemy surface, no advance');
  b.castSpellQueue(null, enemy);
  assert.equal(b.foeSpellQueuePosition, 0);
  foe.itemQueue = ['sword'];
  b.addItemQueue(foe, null);
  assert.equal(b.foeItemQueuePosition, 0);
  b.addItemQueue(null, enemy);
  assert.equal(b.foeItemQueuePosition, 0);
  assert.equal(enemy.of('addItemsToEntity').length + enemy.of('addItemsToCorpse').length, 0);
});

test('the destroy handlers: a fired handler unsubscribes (index 0 included) and never strands a RECOUPLED resource', () => {
  const m = new QuestMachine();
  const q = makeQuest(m);
  const r = new QuestResource(q);
  r.symbol = { name: 'rr', original: '_rr_' };
  const a = new QuestResourceBehaviour(m);
  r.questResourceBehaviour = a;
  a.notifyDestroyed();
  assert.equal(r.questResourceBehaviour, null);
  const b = new QuestResourceBehaviour(m);
  r.questResourceBehaviour = b;
  a.notifyDestroyed();   // the OLD behaviour fires again
  assert.equal(r.questResourceBehaviour, b, "a stale handler must not null the NEW coupling - it unsubscribed");

  // offDestroy removes exactly ONE handler
  const c = new QuestResourceBehaviour(m);
  const hits = [];
  const h1 = () => hits.push(1);
  const h2 = () => hits.push(2);
  c.onDestroy(h1); c.onDestroy(h2);
  c.offDestroy(h1);
  c.notifyDestroyed();
  assert.deepEqual(hits, [2], 'splice(i, 1) - the neighbour survives');
});

test('the individual broadcast clicks ONLY individuals - a same-faction plain person never rides it', () => {
  const m = new QuestMachine({ world: { getFactionData: () => ({ id: 305, type: FACTION_TYPES.Individual }) } });
  const q = makeQuest(m);
  q.resources.set('plain', {
    isPerson: true, symbol: { name: 'plain', original: '_plain_' }, parentQuest: q,
    isIndividualNPC: false, factionData: { id: 305 },
    hasPlayerClicked: false, setPlayerClicked() { this.hasPlayerClicked = true; },
  });
  q.resources.set('ind', {
    isPerson: true, symbol: { name: 'ind', original: '_ind_' }, parentQuest: q,
    isIndividualNPC: true, factionData: { id: 305 },
    hasPlayerClicked: false, setPlayerClicked() { this.hasPlayerClicked = true; },
  });
  const b = new QuestResourceBehaviour(m, makeHost({ staticNpcFactionId: 305 }));
  assert.equal(b.doClick(), true);
  assert.equal(q.resources.get('ind').hasPlayerClicked, true);
  assert.equal(q.resources.get('plain').hasPlayerClicked, false, 'the && gate needs BOTH individual and faction match');
});

test('the mount defaults: no buildingKey queries the wildcard, and the option defaults stand everything', () => {
  const { m, person, foe, item, adapter } = makeMountRig();
  m.siteLinks[0].buildingKey = 5;   // a keyed link still matches the wildcard query
  addQuestResourceObjects(m, adapter, SITE_TYPES.Dungeon);
  assert.equal(adapter.stands.length, 3, 'the omitted buildingKey defaults to the 0 wildcard');
  assert.ok(person.questResourceBehaviour && foe.questResourceBehaviour && item.questResourceBehaviour);
});

test('the ring constants are the C# literals and the probes ride them', () => {
  assert.equal(PLACE_FOE_DEFAULTS.minDistance, 5);
  assert.equal(PLACE_FOE_DEFAULTS.maxDistance, 20);
  assert.equal(PLACE_FOE_DEFAULTS.separationDistance, 1.25);
  assert.equal(PLACE_FOE_DEFAULTS.maxFloorDistance, 4);
  let radius = null;
  const env = ringEnv({
    raycast: (o, dir) => (dir.y === -1 ? { point: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 1, z: 0 }, distance: 1 } : null),
    overlapSphere: (p, r) => { radius = r; return false; },
  });
  placeFoeFreely(env);
  assert.equal(radius, 0.65, 'the overlap veto probes at the C# radius');
});

test('the side coin at EXACTLY 0.5 swings RIGHT (positive angle), the C# strict >', () => {
  const rolls = [0, 0.5, 0];   // no jitter, the boundary coin, distance roll
  let i = 0;
  let spawnDir = null;
  const env = ringEnv({
    rolls: () => rolls[i++],
    raycast: (o, dir, max) => {
      if (dir.y === -1) return { point: { x: o.x, y: -1, z: o.z }, normal: { x: 0, y: 1, z: 0 }, distance: 1 };
      spawnDir = dir; return null;
    },
  });
  placeFoeFreely(env);
  assert.ok(spawnDir.x > 0, '0.5 > 0.5 is false - the positive (right) arm');
});

test('a wall at EXACTLY separation + minDistance still places (slack zero passes the strict < 0 gate)', () => {
  const rolls = [0, 0, 0.99];   // extra = 0.99 * min(2, 0) = 0
  let i = 0;
  const env = ringEnv({
    rolls: () => rolls[i++],
    raycast: (o, dir) => {
      if (dir.y === -1) return { point: { x: o.x, y: -1, z: o.z }, normal: { x: 0, y: 1, z: 0 }, distance: 1 };
      return { point: { x: dir.x * 6.25, y: 0, z: dir.z * 6.25 }, normal: { x: -dir.x, y: 0, z: -dir.z }, distance: 6.25 };
    },
  });
  const pos = placeFoeFreely(env);
  assert.ok(pos, 'distance 6.25 = 1.25 + 5: slack is exactly zero and zero is NOT < 0');
  const yaw = 60 * Math.PI / 180;
  assert.ok(Math.abs(pos.x - Math.sin(yaw) * 5) < 1e-9, 'backed off to exactly minDistance');
});

test('the floor probe drops STRAIGHT down and the wall normal normalizes before the cosine', () => {
  const rolls = [0, 0, 0];
  let i = 0;
  let floorDir = null;
  const env = ringEnv({
    rolls: () => rolls[i++],
    raycast: (o, dir) => {
      if (dir.y < 0) { floorDir = dir; return { point: { x: o.x, y: -1, z: o.z }, normal: { x: 0, y: 1, z: 0 }, distance: 1 }; }
      // an UNNORMALIZED wall normal, length 2 - the math must not tilt
      return { point: { x: dir.x * 10, y: 0, z: dir.z * 10 }, normal: { x: -dir.x * 2, y: 0, z: -dir.z * 2 }, distance: 10 };
    },
  });
  const pos = placeFoeFreely(env);
  assert.deepEqual(floorDir, { x: 0, y: -1, z: 0 });
  const yaw = 60 * Math.PI / 180;
  const along = 10 - 1.25;   // cos_normal 1 off the NORMALIZED normal, extra 0
  assert.ok(Math.abs(pos.x - Math.sin(yaw) * along) < 1e-9, 'a length-2 normal still yields cos 1');
});

test('assignQuestResource defaults: the omitted marker index draws a REAL marker; a markerless site still throws', () => {
  const m = new QuestMachine();
  const quest = makeQuest(m);
  quest.hooks = { world: {}, cullResourceTarget: () => {} };
  const place = new Place(quest);
  place.symbol = { name: 'pub' };
  place.isPlayerHere = () => false;
  place.siteDetails = {
    selectedMarker: { targetResources: null },
    questSpawnMarkers: [{ dungeonX: 1, dungeonZ: 1, flatPosition: { x: 9, y: 0, z: 9 }, markerID: 5, targetResources: null }],
    questItemMarkers: null,
  };
  const resource = makeFoeStub({ isFoe: false, isPerson: true, symbol: { name: 'pp', original: '_pp_' } });
  resource.parentQuest = quest;
  quest.resources.set('pp', resource);
  place.assignQuestResource({ name: 'pp', clone() { return { name: 'pp' }; } });
  assert.equal(place.siteDetails.selectedMarker.flatPosition.x, 9, 'the default -1 index drew the real marker, not [-2]');

  const bare = new Place(quest);
  bare.symbol = { name: 'void' };
  bare.siteDetails = { selectedMarker: { targetResources: null }, questSpawnMarkers: null, questItemMarkers: null };
  assert.throws(() => bare.assignQuestResource({ name: 'pp', clone() { return { name: 'pp' }; } }),
    /Tried to assign resource pp to Place without at least a spawn or item marker/);
});

test('configureFromPlayerLocation answers FALSE when no location is loaded', () => {
  const m = new QuestMachine();
  const quest = makeQuest(m);
  const place = new Place(quest);
  assert.equal(place.configureFromPlayerLocation({ currentLocation: () => null }, 'home'), false);
  assert.equal(place.configureFromPlayerLocation({ currentLocation: () => ({ loaded: false }) }, 'home'), false);
});
