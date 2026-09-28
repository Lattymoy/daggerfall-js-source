// SHARE-COPY (2026-09-26, Mac: "Shared Quest did not match copy bug - affect player quality of life"): EVERY quest
// share was refused with "received a quest that did not match your own copy". AUDIT DROPS A1 holds an incoming
// envelope against the receiver's own parse of the quest by name, task symbol by task symbol - and two kinds of task
// take their symbol from the UID counter at parse (task.js, DFU's own NextUID): the headless startup task EVERY quest
// has, and each `until _x_ performed:` block. No two parses agree on those numbers, so no envelope ever matched; the
// A1 fixture had neither kind of task. Behind it stood a second refusal: the receiver's parse ran over the receiver's
// OWN world, so a `local` Place threw for a receiver in the wilderness ("do not know this quest"). The shape parse is
// headless now, a minted task is matched by its type and order (and a persist-until by what it watches), and the
// homes a Person mints over the sender's world are allowed - one per declared Person, a Place.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { loadQuestTables } from '../src/systems/quest/tables.js';
import { TaskType } from '../src/systems/quest/task.js';
import { receiveSharedQuest, prepareQuestShare, shapeMismatch } from '../src/systems/questShare.js';
import { mapPixelToWorldCoord } from '../src/formats/mapsFile.js';

const VENDOR = join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'dfu-quests');
const read = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');
{
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = read(join(VENDOR, 'Tables', f));
  loadQuestTables(sources);
}
const CORPUS = {};
for (const f of readdirSync(join(VENDOR, 'Quests'))) CORPUS[f.replace(/\.txt$/i, '')] = read(join(VENDOR, 'Quests', f)).split(/\r?\n/);

// The questpersons fixture, trimmed: one town with a tavern, a general store and a house, markers inside, and the
// faction store its people resolve through.
const flat = (record) => ({ textureArchive: 199, textureRecord: record, xPos: 40, yPos: 8, zPos: 60 });
const building = (buildingType) => ({ buildingType, factionId: 0, nameSeed: 777, locationId: 0, sector: 0, quality: 9 });
const FACTIONS = new Map([
  [510, { id: 510, type: 2, name: 'The Merchants', race: -1 }],
  [201, { id: 201, type: 15, name: 'People of Testshire', race: -1 }],
  [867, { id: 867, type: 14, name: 'Court of Testshire', race: -1 }],
]);
function makeWorld({ wilderness = false } = {}) {
  const buildings = [building(15), building(17), building(9)];
  const block = {
    position: 5000,
    rmbBlock: {
      fldHeader: { buildingDataList: buildings, otherNames: null },
      subRecords: buildings.map(() => ({ interior: { blockFlatObjectRecords: [flat(11), flat(18)] } })),
    },
  };
  const world0 = mapPixelToWorldCoord(100, 100);
  const town = {
    loaded: true, regionIndex: 0, regionName: 'Testshire', name: 'Bigtown', locationIndex: 0,
    hasDungeon: false, mapTableData: { mapId: 111, locationType: 0, dungeonType: -1 },
    exterior: {
      buildings,
      recordElement: { header: { x: world0.x, y: world0.y } },
      exteriorData: { locationId: 0x400, width: 1, height: 1, blockNames: ['TESTAA00.RMB'] },
    },
    dungeon: null,
  };
  const region = { name: 'Testshire', locationCount: 1, mapTable: [{ mapId: 111, locationType: 0, dungeonType: -1 }] };
  const world = {
    maps: {
      regionCount: 1, getRegion: () => region, getLocation: () => town, getLocationByName: () => town,
      getRmbBlockName: () => 'TESTAA00.RMB', readLocationIdFast: () => 0x400, getClimateIndex: () => 231,
    },
    getBlock: () => block,
    currentLocation: () => (wilderness ? { ...town, loaded: false } : town),
    currentRegionIndex: () => 0, currentLocationIndex: () => 0,
    isPlayerInLocationRect: () => !wilderness,
    playerInside: () => null, isHouseOwned: () => false,
    playerPixel: () => ({ x: 100, y: 100 }), buildingNameOpts: () => ({}),
    getFactionData: (id) => FACTIONS.get(id) ?? null,
    findFactionsOfType: (t) => [...FACTIONS.values()].filter((f) => f.type === t),
    currentRegionPeople: () => 201, currentRegionCourt: () => 867, currentRegionFaction: () => 201,
    currentRegionVampireClan: () => 0, playerVampireClan: () => 0, currentRegionRace: () => 3,
  };
  return world;
}

// A side quest with every piece the bug and its guards turn on: the headless startup task (its first block), a
// questor and a shopkeeper whose set-up mints a HOME over the sender's world, a `local` Place, a reward Item, a
// standard task and an `until ... performed:` block.
const SRC = {
  __SC: [
    'Quest: __SC', 'QRC:', 'Message:  1011', ' a reward', '', 'QBN:',
    'Item _reward_ gold', '',
    'Person _qgiver_ group Questor', '',
    'Person _shop_ group Shopkeeper', '',
    'Place _inn_ local tavern', '',
    ' say 1011', '',
    '_t_ task:', ' give pc _reward_', '',
    'until _t_ performed:', ' say 1011', '',
    'variable _pad_',
  ],
};
const machineOver = (world) => {
  const m = new QuestMachine({
    nowSeconds: () => 0, showPopup() {}, world,
    lastNPCClicked: () => m.clicked ?? null,
    getQuestSourceLines: (name) => SRC[name] ?? CORPUS[name] ?? null,
  });
  return m;
};
const lists = { findQuestMeta: () => null, hasAcceptedOneTime: () => false, markOneTimeAccepted() {} };
const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };

/** A sender who took __SC from a questor in town - the real producer: parsed over their world, started, shared. */
const sender = () => quiet(() => {
  const m = machineOver(makeWorld());
  m.clicked = { factionID: 510, nameSeed: 4242, gender: 0 };
  const q = m.scheduleQuest(SRC.__SC, 0, { rolls: () => 0.4 });
  m.tick();
  const p = prepareQuestShare(m, q.uid);
  assert.ok(p.ok, 'the sender can share it');
  return { m, q, data: p.data };
});
const taskOfType = (data, type) => data.tasks.find((t) => t.type === type);

test('SHARE-COPY: every quest in the corpus is received - an envelope from one parse matches another machine\'s shape parse of the same quest', () => {
  const refused = [];
  quiet(() => {
    for (const name of Object.keys(CORPUS)) {
      const a = machineOver(null).parseQuestShape(name);
      const b = machineOver(null).parseQuestShape(name);
      assert.ok(a && b, `${name} parses`);
      const why = shapeMismatch(b, a.getSaveData());
      if (why) refused.push(`${name}:${why}`);
    }
  });
  assert.ok(Object.keys(CORPUS).length >= 265, 'the whole vendored corpus');
  assert.deepEqual(refused, [], 'the minted symbols (the startup task, every until-performed block) never decide a match');
});

test('SHARE-COPY: a quest taken in town is received by a party member standing in the WILDERNESS - the shape is the script\'s, the sites and homes the sender\'s', () => {
  const { data } = sender();
  assert.ok(taskOfType(data, TaskType.Headless), 'the envelope carries the startup task');
  assert.ok(taskOfType(data, TaskType.PersistUntil), 'and the until-performed block');
  const homes = data.resources.filter((r) => /_home_$/.test(r.symbol.original)).map((r) => r.symbol.original).sort();
  assert.deepEqual(homes, ['_qgiver_home_', '_shop_home_'], 'the homes the sender\'s world minted ride the envelope');
  const r = machineOver(makeWorld({ wilderness: true }));
  const got = quiet(() => receiveSharedQuest(r, lists, '__SC', data));
  assert.equal(got.reason, undefined, `received, not refused (${got.reason})`);
  assert.ok(got.ok && got.quest, 'a live quest');
  const inn = got.quest.resources.get('inn');
  assert.equal(inn.siteDetails.locationName, 'Bigtown', 'the local Place is the SENDER\'s site, restored');
  assert.ok(got.quest.resources.get('qgiver_home'), 'the questor\'s home, restored');
  const again = quiet(() => receiveSharedQuest(r, lists, '__SC', data));
  assert.ok(again.ok && again.resync, 'and the next sync of it updates in place');
});

test('SHARE-COPY: the shape parse never reads the receiver\'s world', () => {
  const trap = new Proxy({}, { get(_, key) { throw new Error(`the shape parse read world.${String(key)}`); } });
  const m = machineOver(trap);
  const local = quiet(() => m.parseQuestShape('__SC'));
  assert.ok(local, 'parsed with the world untouched');
  assert.equal(local.resources.get('inn').sitePending, true, 'the Place set-up skipped (the headless charter)');
  assert.equal(local.resources.get('shop').npcPending, true, 'and the Person set-up');
});

test('SHARE-COPY: A1\'s guard still holds over the minted tasks and the homes - a forged envelope is refused', () => {
  const { data } = sender();
  const local = quiet(() => machineOver(null).parseQuestShape('__SC'));
  assert.equal(shapeMismatch(local, data), null, 'the honest envelope');
  const clone = () => structuredClone(data);
  const at = (d, type) => d.tasks.findIndex((t) => t.type === type);

  let d = clone(); d.tasks[at(d, TaskType.Headless)].symbol.original = '_t_x_';
  assert.equal(shapeMismatch(local, d), 'task', 'a minted symbol that is not a number');
  d = clone(); d.tasks[at(d, TaskType.PersistUntil)].symbol.original = d.tasks[at(d, TaskType.Headless)].symbol.original;
  assert.equal(shapeMismatch(local, d), 'task', 'two tasks under one name - the restore would drop one');
  d = clone(); d.tasks[at(d, TaskType.PersistUntil)].targetSymbol = { original: '_pad_' };
  assert.equal(shapeMismatch(local, d), 'task', 'an until-performed block watching another symbol');
  d = clone(); d.tasks[at(d, TaskType.Headless)].type = TaskType.Standard;
  assert.equal(shapeMismatch(local, d), 'task', 'the startup task retyped - it would never run');
  d = clone(); d.resources.push({ ...d.resources.find((r) => r.symbol.original === '_inn_'), symbol: { original: '_reward_home_' } });
  assert.equal(shapeMismatch(local, d), 'resource', 'a home for a symbol that is no Person');
  d = clone(); d.resources.find((r) => r.symbol.original === '_shop_home_').type = 'Item';
  assert.equal(shapeMismatch(local, d), 'resource', 'a home that is not a Place');
  d = clone(); d.resources.push(structuredClone(d.resources.find((r) => r.symbol.original === '_inn_')));
  assert.equal(shapeMismatch(local, d), 'resource', 'one symbol twice');
  d = clone(); d.resources = d.resources.filter((r) => r.symbol.original !== '_reward_');
  assert.equal(shapeMismatch(local, d), 'resources', 'a resource the script declares, missing');
  d = clone(); d.resources.push({ ...d.resources.find((r) => r.symbol.original === '_inn_'), symbol: { original: '_elsewhere_' } });
  assert.equal(shapeMismatch(local, d), 'resource', 'a Place the script never declares');
});
