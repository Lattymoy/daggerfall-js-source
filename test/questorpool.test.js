// QP1 - THE ANY-WORK QUESTOR POOL GOES LIVE (2026-08-28). AUDIT 24
// found npcSession.buildQuestorPool DEAD: the policy shipped, pinned,
// and nothing could feed it - the host's building seam carried no
// per-building NPC records, so npcsWithWork stayed empty for ever,
// WorkAvailable answered false, and no townsperson ever had "any
// work". The feed is TalkManager.GetBuildingList's questor half
// (:2807-2874) as a pure walk: talkTopics.questorCandidateBuildings,
// over the SAME block correlation the directory rides, each person
// through the ONE SetLayoutData law - called from townTalk's
// rebuildDirectory (the port's GetBuildingList).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { questorCandidateBuildings, makeBuildingKey } from '../src/systems/talkTopics.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { NPCSession } from '../src/systems/npcSession.js';
import { GENDERS } from '../src/characters/nameHelper.js';
import { CHILDREN_FACTION_ID } from '../src/characters/staticNpc.js';

const read = (p) => readFileSync(p, 'utf8');

// texture bitfield: archive << 7 | record (blocksFile's own split);
// the people mapper re-derives archive/record from it, so the fixture
// hands the DERIVED fields exactly as blocksFile parses them
const person = (position, { flags = 0, factionID = 1, archive = 182, record = 20 } = {}) => ({
  xPos: 10, yPos: -4, zPos: 30, textureArchive: archive, textureRecord: record,
  factionID, flags, position,
});

const block = (x, y, buildings) => ({
  x, y,
  dfBlock: {
    rmbBlock: {
      fldHeader: {
        buildingDataList: buildings.map((b) => ({
          buildingType: b.type, nameSeed: b.nameSeed ?? 0, factionId: b.factionId ?? 0,
          sector: 0, locationId: 0, quality: 5,
        })),
        otherNames: null,
      },
      subRecords: buildings.map((b) => ({ interior: { blockPeopleRecords: b.people ?? [] } })),
    },
  },
});

const LOCATION_INDEX = 7;

const walk = (blocks, exteriors = []) => questorCandidateBuildings(exteriors, blocks, {
  locationIndex: LOCATION_INDEX, mapId: 99, nameOpts: {},
  getFaction: () => null, raceOfCurrentRegion: () => 1,
});

test('QP1 walk: buildings keyed by MakeBuildingKey, named-ness and the name resolved per entry', () => {
  const blocks = [
    block(0, 0, [
      { type: BUILDING_TYPES.Tavern, people: [person(1000)] },
      { type: BUILDING_TYPES.House1, people: [person(2000)] },
    ]),
    block(1, 0, [{ type: BUILDING_TYPES.Tavern, people: [] }]),
  ];
  const exteriors = [
    { buildingType: BUILDING_TYPES.Tavern, nameSeed: 5, factionId: 0, sector: 0, locationId: 0, quality: 5 },
    { buildingType: BUILDING_TYPES.Tavern, nameSeed: 9, factionId: 0, sector: 0, locationId: 0, quality: 5 },
  ];
  const out = walk(blocks, exteriors);
  assert.equal(out.length, 3);
  assert.equal(out[0].buildingKey, makeBuildingKey(0, 0, 0));
  assert.equal(out[1].buildingKey, makeBuildingKey(0, 0, 1));
  assert.equal(out[2].buildingKey, makeBuildingKey(1, 0, 0));
  assert.equal(out[0].isNamedBuilding, true, 'a tavern is a named type');
  assert.equal(typeof out[0].buildingName, 'string');
  assert.ok(out[0].buildingName.length > 0, ':2853 - BuildingNames.GetName for the entry');
  assert.equal(out[1].isNamedBuilding, false, 'a house is not - the pool drops it at :2862');
  assert.equal(out[2].npcs.length, 0, 'an empty interior is an empty candidate list');
});

test('QP1 walk: each person through the ONE SetLayoutData law', () => {
  const male = person(0x1234, { flags: 0 });
  const female = person(0x2222, { flags: 32 });
  const child = person(0x3333, { factionID: CHILDREN_FACTION_ID });
  const out = walk([block(2, 3, [{ type: BUILDING_TYPES.Tavern, people: [male, female, child] }])],
    [{ buildingType: BUILDING_TYPES.Tavern, nameSeed: 5, factionId: 0, sector: 0, locationId: 0, quality: 5 }]);
  const key = makeBuildingKey(2, 3, 0);
  const [m, f, c] = out[0].npcs;
  // nameSeed = position ^ (buildingKey + locationIndex) - the C#
  // precedence quirk staticNpcData pins, on the record's own stream
  // position (DFU's obj.Position)
  assert.equal(m.nameSeed, (0x1234 ^ (key + LOCATION_INDEX)) | 0);
  assert.equal(f.nameSeed, (0x2222 ^ (key + LOCATION_INDEX)) | 0);
  assert.equal(m.gender, GENDERS.Male);
  assert.equal(f.gender, GENDERS.Female, 'flags & 32');
  assert.equal(m.isChild, false);
  assert.equal(c.isChild, true, 'IsChildNPCData - faction 514');
  assert.equal(m.buildingKey, key, 'SetLayoutData stamps the building');
  assert.equal(m.mapID, 99);
});

test('QP1 end-to-end: the walk feeds the pool and a roll of 3 mints a questor under the walk\'s own seed', () => {
  const tavernPerson = person(0x4444, { factionID: 21 });
  const candidates = walk([block(0, 0, [{ type: BUILDING_TYPES.Tavern, people: [tavernPerson] }])],
    [{ buildingType: BUILDING_TYPES.Tavern, nameSeed: 5, factionId: 0, sector: 0, locationId: 0, quality: 5 }]);
  const s = new NPCSession({
    rolls: () => 0.9,   // Range(0,4) = 3 - the one roll that offers
    currentLocationIndex: () => LOCATION_INDEX,
    nameBankOfCurrentRegion: () => 'Breton',
    factionData: (id) => (id === 21 ? { id, sgroup: 0, parent: 0, type: 2 } : null),   // Commoners
  });
  assert.equal(s.buildQuestorPool(candidates), true);
  assert.equal(s.npcsWithWork.size, 1);
  const seed = (0x4444 ^ (makeBuildingKey(0, 0, 0) + LOCATION_INDEX)) | 0;
  assert.ok(s.npcsWithWork.has(seed), 'the pool keys on the SetLayoutData nameSeed');
  assert.equal(s.workAvailable, true, 'WorkAvailable - the Work topic\'s gate - is finally true');
  assert.equal(s.npcsWithWork.get(seed).buildingName, candidates[0].buildingName);
});

// ── the mounts, source-pinned ────────────────────────────────────

test('QP1 townTalk: rebuildDirectory feeds the pool through the host door', () => {
  const tt = read('src/scenes/townTalk.js');
  assert.match(tt, /onBuildingList\?\.\(questorCandidateBuildings\(topics\.exteriorBuildings, topics\.blocks, \{\s*\n\s*locationIndex: topics\.locationIndex \?\? 0,\s*\n\s*mapId: topics\.mapId \?\? 0,/,
    'the walk rides the SAME rebuild the directory does (GetBuildingList\'s one breath)');
  assert.match(tt, /getFaction: \(id\) => factions\?\.factionDict\?\.get\(id\) \?\? null,/,
    'the faction lookup is townTalk\'s own FACTION.TXT');
  // RP1 turned the module's boot-captured `regionIndex` into the live
  // `regionNow()`; the LAW pinned here is unchanged - the topics bag's
  // own region wins, and the answer is the +1 numeric race id.
  assert.match(tt, /raceOfCurrentRegion: \(\) => \(REGION_RACES\[topics\.regionIndex \?\? \w+\(?\)?\] \?\? 0\) \+ 1,/,
    'GetRaceOfCurrentRegion\'s numeric read, off the topics region when it has one');
});

test('QP1 world: topics carry the SetLayoutData identities, the door lands in npcSession', () => {
  const world = read('src/scenes/world.js');
  assert.match(world, /locationIndex: dfLocation\.locationIndex \?\? 0,\s*\n\s*mapId: dfLocation\.mapTableData\?\.mapId \?\? 0,/,
    'the same locationIndex npcSession\'s own guard reads');
  assert.match(world, /onBuildingList: \(buildings\) => npcSession\.buildQuestorPool\(buildings\),/,
    'the pool is the host\'s to hold');
  const session = read('src/systems/npcSession.js');
  assert.ok(!/FLAGGED: no host calls this/.test(session),
    'the dead-seam flag is GONE - retiring a flag deletes the sentence');
});
