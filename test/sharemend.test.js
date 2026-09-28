// SHARE-MEND (2026-09-27, Discord - Tabitha: "Fix sharing Guild & Temple quests - It says the quests don't match up,
// can't share, etc.").
//
// THREE FAULTS BEHIND ONE SENTENCE. A guild's or a temple's quest sends the party to a dungeon, and a dungeon Place
// carries every quest marker in it - three hundred markers were over the share's byte cap on their own, and the Share
// button said "This quest is too complex to share." Behind the "don't match up": a restore that choked was reported as
// a forged envelope ("did not match your own copy"), a build skew (every share before SHARE-COPY was refused that way,
// and an old page keeps its build) was never named, and a quest kept in step with the party re-sent its refusal on
// every change. Now the markers travel slim and come back whole (questShare.js slimShareMarkers/fullShareMarkers), the
// envelope names its build, a restore's failure is its own reason, every refusal reads in the second person, and a
// sync's refusal is said once. Driven here over the SHARE-COPY fixture (a sender in town, a receiver in the wilds).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { loadQuestTables } from '../src/systems/quest/tables.js';
import {
  receiveSharedQuest, prepareQuestShare, slimShareMarkers, fullShareMarkers, shareRefusalText, shareSkewText,
  sayShareRefusal, RECEIVER_REFUSAL_TEXT, SHARE_REFUSAL_TEXT, QUEST_SHARE_MAX_BYTES,
} from '../src/systems/questShare.js';
import { mapPixelToWorldCoord } from '../src/formats/mapsFile.js';
import { BUILD_TAG } from '../src/buildTag.js';

const VENDOR = join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'dfu-quests');
const read = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');
{
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = read(join(VENDOR, 'Tables', f));
  loadQuestTables(sources);
}
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

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

// A quest taken in town whose `local` tavern is a Building site WITH markers (the fixture's interior carries a spawn
// and an item marker), and a questor whose home the sender's world mints.
const SRC = {
  __SM: [
    'Quest: __SM', 'QRC:', 'Message:  1011', ' a reward', '', 'QBN:',
    'Item _reward_ gold', '',
    'Person _qgiver_ group Questor', '',
    'Place _inn_ local tavern', '',
    ' say 1011', '',
    '_t_ task:', ' give pc _reward_', '',
  ],
};
const machineOver = (world) => {
  const m = new QuestMachine({ nowSeconds: () => 0, showPopup() {}, world, lastNPCClicked: () => m.clicked ?? null, getQuestSourceLines: (name) => SRC[name] ?? null });
  return m;
};
const lists = { findQuestMeta: () => null, hasAcceptedOneTime: () => false, markOneTimeAccepted() {} };
const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };
const sender = () => quiet(() => {
  const m = machineOver(makeWorld());
  m.clicked = { factionID: 510, nameSeed: 4242, gender: 0 };
  const q = m.scheduleQuest(SRC.__SM, 0, { rolls: () => 0.4 });
  m.tick();
  return { m, q };
});

// A dungeon site the size a guild's "clear the dungeon" sends a party to: three hundred markers, some carrying targets.
const marker = (i, over = {}) => ({
  questUID: 41, placeSymbol: { original: '_mondung_', name: 'mondung' }, targetResources: i % 50 === 0 ? [{ original: '_foe_', name: 'foe' }] : null,
  markerType: i % 3 ? 0 : 1, flatPosition: { x: (i * 37 % 500) * 0.025, y: -(i * 13 % 90) * 0.025, z: (i * 91 % 500) * 0.025 },
  dungeonX: i % 7, dungeonZ: -(i % 5), buildingKey: 0, markerID: 5000 + i * 3, ...over,
});
const dungeonEnvelope = () => ({
  questName: 'M0B11Y18', displayName: 'A guild quest', uid: 41, factionId: 40, tasks: [],
  resources: [
    { type: 'Item', symbol: { original: '_reward_' }, resourceSpecific: {} },
    { type: 'Place', symbol: { original: '_mondung_' }, resourceSpecific: { scope: 1, name: 'mondung', p1: 1, p2: 3, p3: 0,
      siteDetails: { questUID: 41, siteType: 1, mapId: 9, locationName: 'Deep Hole',
        questSpawnMarkers: Array.from({ length: 200 }, (_, i) => marker(i)),
        questItemMarkers: [...Array.from({ length: 99 }, (_, i) => marker(i + 200, { markerType: 1 })),
          marker(999, { questUID: 7, placeSymbol: { original: '_other_', name: 'other' }, buildingKey: 12 })],   // one that says more than its site: kept whole
        selectedMarker: { targetResources: null } } } },
  ],
});

test('SHARE-MEND the markers: a dungeon\'s three hundred travel slim - the four fields its site already says left off - and come back whole, and the slim envelope fits the cap the whole one broke (mutants: a field left on; a field not put back; a marker dropped)', () => {
  const whole = dungeonEnvelope();
  assert.ok(JSON.stringify(whole).length > QUEST_SHARE_MAX_BYTES, 'the whole site is over the cap - "too complex to share"');
  const slim = slimShareMarkers(whole);
  assert.ok(JSON.stringify(slim).length < QUEST_SHARE_MAX_BYTES, 'and slim it fits');
  const sd = slim.resources[1].resourceSpecific.siteDetails;
  assert.equal(sd.questSpawnMarkers.length, 200, 'every marker stays - its place in the list is its identity');
  assert.deepEqual(Object.keys(sd.questSpawnMarkers[1]), ['markerType', 'flatPosition', 'dungeonX', 'dungeonZ', 'markerID'], 'what the scene mount reads, and only that');
  assert.deepEqual(sd.questSpawnMarkers[0].targetResources, [{ original: '_foe_', name: 'foe' }], 'a target is carried');
  const odd = sd.questItemMarkers.at(-1);
  assert.deepEqual([odd.questUID, odd.placeSymbol, odd.buildingKey], [7, { original: '_other_', name: 'other' }, 12], 'a marker that says more than its site keeps it');
  assert.deepEqual(fullShareMarkers(slim), whole, 'whole again, exactly');
  assert.deepEqual(dungeonEnvelope(), whole, 'the envelope handed in is not touched');
  assert.equal(slimShareMarkers(null), null);
  assert.deepEqual(fullShareMarkers({ questName: 'x', resources: [{ type: 'Place', resourceSpecific: { siteDetails: null } }] }).resources[0].resourceSpecific.siteDetails, null);
});

test('SHARE-MEND the sender: the share is prepared slim and names its build; the big dungeon quest is shared where it was refused (mutants: the build unstamped; the size read before the slimming)', () => {
  const machine = { getShareableQuestData: () => dungeonEnvelope() };
  const p = prepareQuestShare(machine, 41);
  assert.equal(p.ok, true, `shared, not refused (${p.reason})`);
  assert.equal(p.data.build, BUILD_TAG);
  assert.equal('questUID' in p.data.resources[1].resourceSpecific.siteDetails.questSpawnMarkers[1], false, 'slim on the wire');
  assert.equal(SHARE_REFUSAL_TEXT.tooLarge, 'This quest is too complex to share.', 'the refusal stands for a quest that is too big even slim');
});

test('SHARE-MEND end to end: a quest taken in town reaches a party member in the wilds with its sites whole - the markers as the sender\'s world made them - and a restore that chokes is its own reason, never "did not match" (mutants: the receiver reads slim markers; the restore reported as a mismatch)', () => {
  const { m, q } = sender();
  const p = prepareQuestShare(m, q.uid);
  assert.ok(p.ok);
  const mine = q.resources.get('inn').siteDetails;
  assert.ok(mine.questSpawnMarkers?.length && mine.questItemMarkers?.length, 'the tavern carries its markers');
  const r = machineOver(makeWorld({ wilderness: true }));
  const got = quiet(() => receiveSharedQuest(r, lists, '__SM', p.data));
  assert.equal(got.reason, undefined, `received (${got.reason})`);
  assert.deepEqual(got.quest.resources.get('inn').siteDetails.questSpawnMarkers, structuredClone(mine.questSpawnMarkers), 'the spawn markers, whole (as a save carries them - the symbols plain)');
  assert.deepEqual(got.quest.resources.get('inn').siteDetails.questItemMarkers, structuredClone(mine.questItemMarkers), 'and the item markers');
  const r2 = machineOver(makeWorld({ wilderness: true }));
  r2.receiveSharedQuest = () => null;   // the restore chokes (machine.js refuses half a quest)
  assert.equal(quiet(() => receiveSharedQuest(r2, lists, '__SM', p.data)).reason, 'restore');
});

test('SHARE-MEND the words: every refusal reads after "... but you" in the second person; one that says the copies disagree names a build skew - none when the builds agree; the guild\'s refusal is DISC25-D\'s (mutants: the sender\'s sentence after "but you"; the skew named when the builds agree)', () => {
  for (const reason of ['gone', 'tooLarge', 'mainQuest', 'restore', 'active', 'done', 'mismatch', 'unknown', 'guild']) {
    const t = shareRefusalText({ reason });
    assert.match(t, /^[a-z]/, `${reason}: "${t}" continues "but you"`);
  }
  assert.equal(shareRefusalText({ reason: 'gone' }), RECEIVER_REFUSAL_TEXT.gone);
  assert.notEqual(RECEIVER_REFUSAL_TEXT.gone, SHARE_REFUSAL_TEXT.gone, 'not "... but you That quest is no longer active."');
  assert.equal(shareRefusalText({ reason: 'mismatch' }, BUILD_TAG), SHARE_REFUSAL_TEXT.mismatch, 'the same build: a real mismatch, said plainly');
  assert.match(shareRefusalText({ reason: 'mismatch' }, 'abc123def456'), /different versions of the game/);
  assert.match(shareRefusalText({ reason: 'restore' }, null), /out of date/, 'no build at all: a sender from before this one');
  assert.equal(shareRefusalText({ reason: 'active' }, 'abc123def456'), SHARE_REFUSAL_TEXT.active, 'a refusal that is no disagreement names no skew');
  assert.equal(shareSkewText(BUILD_TAG), '');
  assert.equal(shareRefusalText({ reason: 'guild', guild: 'MagesGuild' }), 'are not a member of the Mages Guild, which this quest requires.');
});

test('SHARE-MEND once: a deliberate share is always answered; a sync\'s refusal is said once per sharer, quest and reason (mutants: a sync said every time; a deliberate share swallowed)', () => {
  const said = new Set();
  const g = { reason: 'guild', guild: 'MagesGuild' };
  assert.equal(sayShareRefusal(said, 'a-bran', 'M0B00Y00', g, false), true);
  assert.equal(sayShareRefusal(said, 'a-bran', 'M0B00Y00', g, false), true, 'deliberate, again: answered again');
  assert.equal(sayShareRefusal(said, 'a-bran', 'M0B00Y00', g, true), false, 'AUDIT D5: the sync after it - the deliberate one was said');
  assert.equal(sayShareRefusal(said, 'a-bran', 'M0B00Y00', g, true, 'c1|b2'), true, 'the first sync of a copy');
  assert.equal(sayShareRefusal(said, 'a-bran', 'M0B00Y00', g, true, 'c1|b2'), false, 'and not the next');
  assert.equal(sayShareRefusal(said, 'a-bran', 'M0B00Y00', { reason: 'active' }, true), true, 'a new reason is said');
  assert.equal(sayShareRefusal(said, 'a-cass', 'M0B00Y00', g, true), true, 'another sharer is said');
});

test('SHARE-MEND the host: a sync goes out marked, and the receiver says a refusal through the once-law with the sender\'s build (mutants: the sync unmarked; the refusal said every time)', () => {
  const W = src('src/scenes/world.js');
  assert.match(W, /socialLink\(\)\?\.shareQuest\(\{ questName: prepared\.questName, displayName: prepared\.displayName, data: \{ \.\.\.prepared\.data, sync: 1 \} \}\)/);
  assert.match(W, /if \(!sayShareRefusal\(_questRefusalSaid, acct, quest\.questName, result, quest\.data\?\.sync === 1, `\$\{quest\.data\?\.shareId \?\? ''\}\|\$\{quest\.data\?\.build \?\? ''\}`\)\) return;\n\s*const why = shareRefusalText\(result, quest\.data\?\.build \?\? null\);/);
  assert.match(W, /const _questRefusalSaid = new Set\(\);/);
});

// ─── AUDIT (the batch's audit, agent D) ────────────────────────────────────────────────────────────────────────────

test('AUDIT SHARE-MEND D3: the markers are made whole AFTER the shape check - a Place whose symbol is no string is refused in words ("did not match"), where the mend threw out of the receipt and the frame was dropped unsaid (mutants: the mend first)', () => {
  const machine = {
    hasFinishedSharedCopy: () => false, hasFinishedSharedQuestNamed: () => false, hasActiveQuestNamed: () => false, hasSharedQuestNamed: () => false,
    parseQuestShape: () => ({ getSaveData: () => ({ tasks: [], resources: [] }), resources: new Map() }),
    receiveSharedQuest: () => ({ uid: 1 }),
  };
  for (const original of [5, true, { x: 1 }]) {
    const env = { questName: 'Q', tasks: [], resources: [{ type: 'Place', symbol: { original }, resourceSpecific: { siteDetails: { questUID: 1, questSpawnMarkers: [{ markerType: 0 }] } } }] };
    assert.deepEqual(receiveSharedQuest(machine, lists, 'Q', env), { ok: false, reason: 'mismatch' }, `symbol ${JSON.stringify(original)}`);
  }
});

test('AUDIT SHARE-MEND D4: a RESYNC the restore chokes on - most often another build - is the restore\'s own reason with its hint, never "you no longer have a copy" while the copy stands; a copy gone is still gone (mutants: every failed update read as gone)', () => {
  const { m, q } = sender();
  const p = prepareQuestShare(m, q.uid);
  const r = machineOver(makeWorld({ wilderness: true }));
  assert.equal(quiet(() => receiveSharedQuest(r, lists, '__SM', p.data)).ok, true, 'held');
  const bad = { ...structuredClone(p.data), activeLogMessages: 5 };   // the shape passes; the restore throws
  const res = quiet(() => receiveSharedQuest(r, lists, '__SM', bad));
  assert.equal(res.reason, 'restore');
  assert.ok(r.sharedCandidateNamed('__SM'), 'and the copy stands');
  assert.match(shareRefusalText(res, 'another-build'), /could not rebuild it in your world\. You are on different versions of the game/);
  r.updateSharedQuest = () => { r.sharedCandidateNamed = () => null; return null; };   // the copy ended as the update was asked
  assert.equal(quiet(() => receiveSharedQuest(r, lists, '__SM', structuredClone(p.data))).reason, 'gone', 'a copy gone is gone');
});
