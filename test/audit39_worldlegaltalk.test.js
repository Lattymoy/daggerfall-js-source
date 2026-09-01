// AUDIT 39, the world-legal-talk group: the crime/court region, the
// theft watch, and the seven talk/quest seams world.js declared and
// never answered.
//
// The through-line is one shape: a law ported correctly, mounted onto
// a host key that nothing supplies (or supplies with the wrong
// spelling), so the optional read evaporates and the arm behind it is
// dead in play. Every fix here is host wiring plus, where the module
// itself carried the gate, the gate.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createArrestFlow } from '../src/scenes/arrestFlow.js';
import { CRIMES, REPUTATION_LOSS_PER_CRIME } from '../src/systems/court.js';
import { buildBuildingDirectory } from '../src/systems/talkTopics.js';
import { BUILDING_TYPES, isNamedBuildingType } from '../src/world/buildingNames.js';
import { WEATHER_TYPES } from '../src/world/weather.js';
import { currentWeather, setWeather } from '../src/systems/weatherSim.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(HERE, '..', rel), 'utf8');

/** The brace-matched body of an object literal opened by `head`. */
function literalBody(src, head) {
  const i = src.indexOf(head);
  assert.ok(i > 0, `expected to find ${head}`);
  let depth = 0;
  let j = src.indexOf('{', i);
  const start = j;
  for (; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}' && --depth === 0) break;
  }
  return src.slice(start, j + 1);
}

// ---------------------------------------------------------------
// #21 - the arrest/court chain reads the region AT THE MOMENT OF THE
// CRIME. LowerRepForCrime (PlayerEntity.cs:2286-2299),
// SurrenderToCityGuards (:2313) and RaiseReputationForDoingSentence
// (:2301-2303) all open on PlayerGPS.CurrentRegionIndex; the world
// host handed the flow `startLoc.regionIndex`, a number read once at
// boot, and that host is the one that fast-travels.
// ---------------------------------------------------------------

test('AUDIT 39 (#21): the arrest flow reads its region live when the host hands a getter', () => {
  const player = {
    name: 'Mack', health: 30, crimeCommitted: CRIMES.Murder,
    haveShownSurrenderDialogue: false, legalRep: {},
  };
  let region = 3;
  const flow = createArrestFlow({
    townTalk: { texts: () => null, showOverlay: () => {} },
    playerEntity: player,
    regionIndex: () => region,
  });
  const loss = REPUTATION_LOSS_PER_CRIME[CRIMES.Murder];
  flow.onGuardHit(1, () => {});
  assert.equal(player.legalRep[3], -loss, 'the crime is filed where it happened');
  // fast travel, then commit the same crime again
  region = 9;
  player.haveShownSurrenderDialogue = false;
  flow.onGuardHit(1, () => {});
  assert.equal(player.legalRep[9], -loss, 'the second province takes the second crime');
  assert.equal(player.legalRep[3], -loss, 'and the first is not charged twice');
});

test('AUDIT 39 (#21): a plain NUMBER still works - the probe host builds one location', () => {
  const player = { health: 30, crimeCommitted: CRIMES.Murder, haveShownSurrenderDialogue: false, legalRep: {} };
  const flow = createArrestFlow({
    townTalk: { texts: () => null, showOverlay: () => {} },
    playerEntity: player, regionIndex: 17,
  });
  flow.onGuardHit(1, () => {});
  assert.equal(player.legalRep[17], -REPUTATION_LOSS_PER_CRIME[CRIMES.Murder]);
});

test('AUDIT 39 (#21): the streaming host hands the getter, not startLoc', () => {
  const w = read('src/scenes/world.js');
  assert.match(w, /createArrestFlow\(\{ townTalk, playerEntity, regionIndex: \(\) => _questRegionIndex\(\) \}\)/);
  assert.doesNotMatch(w, /regionIndex: startLoc\.regionIndex/,
    'the boot number filed every later crime under the province the session started in');
});

// ---------------------------------------------------------------
// #22 - AttemptPrivatePropertyTheft (DaggerfallInventoryWindow.cs
// :1848-1859) raises the crime AND calls SpawnCityGuards(true).
// worldModes has read `host.spawnCityGuards` since the theft landed;
// neither host supplied the key, so the optional call no-opped.
// ---------------------------------------------------------------

test('AUDIT 39 (#22): EVERY host that builds the mode machine answers spawnCityGuards', () => {
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const bag = literalBody(read(host), 'createWorldModes({');
    assert.match(bag, /spawnCityGuards: \(immediate\) => \(immediate \? _crimeResponse\(\) : _witnessResponse\(\)\)/,
      `${host}: the bool picks the arm, as SpawnCityGuards(bool) does`);
  }
  // the witness arm has to EXIST in both hosts for that to be true
  assert.match(read('src/scenes/exterior.js'),
    /cityGuards\.spawnCityGuards\(false, \{ playerFeet: \[\.\.\.feet\], playerFwd: fwd, pool: _guardPool\(\) \}\)/,
    'exterior.js grew the witness half it had never needed');
});

// ---------------------------------------------------------------
// #23 - Person.GetFactionTypeFactionID's five faction-type reads
// (Person.cs:967-1018) plus %vam's clan name. Each was `?? -1` into
// _setupFactionTypeNPC's ZERO_FACTION arm.
// ---------------------------------------------------------------

test('AUDIT 39 (#23): the five region/vampire reads and %vam stand on questWorld', () => {
  const body = literalBody(read('src/scenes/world.js'), 'const questWorld = {');
  for (const seam of ['currentRegionPeople', 'currentRegionCourt', 'currentRegionFaction',
    'currentRegionVampireClan', 'playerVampireClan', 'playerVampireClanName']) {
    assert.match(body, new RegExp(`^ {4}${seam}:`, 'm'), `${seam} is mounted`);
  }
  // every one of them keys on CurrentRegionIndex, never the location's
  assert.match(body, /currentRegionPeople: \(\) => getPeopleOfCurrentRegion\([^\n]*_questRegionIndex\(\)\)/);
  assert.match(body, /currentRegionCourt: \(\) => getCourtOfCurrentRegion\([^\n]*_questRegionIndex\(\)\)/);
  // GetRegionFaction is FindFactions(Province, -1, -1, region), and the
  // clan is that same record's `vam` column
  assert.match(read('src/scenes/world.js'),
    /const _regionFaction = \(\) => \{[^]*?findFactions\(dict, \{ type: FACTION_TYPES\.Province, region: _questRegionIndex\(\) \}\)\[0\]/);
  assert.match(body, /currentRegionVampireClan: \(\) => _regionFaction\(\)\?\.vam \?\? -1/);
  // %vam's null is load-bearing: it is what prints C#'s own error literal
  assert.match(body, /playerVampireClanName: \(\) => \{[^]*?if \(!clan\) return null;/);
});

// ---------------------------------------------------------------
// #25 - LegalRepute.cs:48-52 writes PlayerGPS.CurrentRegionIndex. The
// port's write keyed on the LOCATION's region with a `?? 0` fallback,
// which is the common case: no map pixel in the wilderness carries a
// location, so quests filed their legal-repute changes in Alik'r.
// ---------------------------------------------------------------

test('AUDIT 39 (#25): the legal-repute WRITE reads the same region as the read', () => {
  const body = literalBody(read('src/scenes/world.js'), 'const questWorld = {');
  assert.match(body, /changeLegalRep: \(amount\) => changeLegalRep\(playerEntity, _questRegionIndex\(\), amount\)/);
  assert.match(body, /legalRepNow: \(\) => legalRepOf\(playerEntity, _questRegionIndex\(\)\)/,
    'the read never moved - the write is what disagreed with it');
});

// ---------------------------------------------------------------
// #27 - the seven-name fold is the IDENTITY. WEATHER_TYPES is the name
// array and currentWeather() already answers out of it, so indexing it
// with a name answered undefined -> null on every call and the
// always-on `weather` trigger could never match.
// ---------------------------------------------------------------

test('AUDIT 39 (#27): indexing the name array with a name is undefined - the fold is the identity', () => {
  setWeather('rain');
  assert.equal(currentWeather(), 'rain');
  assert.equal(WEATHER_TYPES[currentWeather()], undefined, 'the old spelling, executed');
  assert.ok(WEATHER_TYPES.includes(currentWeather()), 'the value the trigger compares against IS the name');
  setWeather('sunny');
  assert.equal(WEATHER_TYPES[currentWeather()], undefined);
});

// ---------------------------------------------------------------
// #107 - the one macro context every ExpandRandomTextRecord call runs
// through. talkMacros.js reads five members it was never given, so
// %pcf/%pcn/%cn/%ra were DELETED from every record, %hnr always
// answered "Ma'am" (getHonoric's `gender === 'male'` fork) and %1com
// always drew the tone-1 opening.
// ---------------------------------------------------------------

test('AUDIT 39 (#107): talkMcp carries the five host reads its handlers make', () => {
  const mcp = literalBody(read('src/scenes/world.js'), 'const talkMcp = () => (');
  for (const [seam, wiring] of [
    ['playerName', /playerName: \(\) => playerEntity\.name \?\? ''/],
    ['playerGender', /playerGender: \(\) => playerEntity\.gender/],
    ['playerRace', /playerRace: \(\) => playerEntity\.race/],
    ['cityName', /cityName: \(\) => townTalk\.cityName\(\)/],
    ['toneIndex', /toneIndex: \(\) => townTalk\.toneIndex\(\)/],
  ]) {
    assert.match(mcp, wiring, `talkMcp supplies ${seam}`);
  }
});

// ---------------------------------------------------------------
// #109 - GetNewsOrRumors (:1405-1422) brackets the CommonRumor macro
// pass with SetFactionIdsAndRegionID and resets it after. The mill's
// seam existed; no host wired it, so every regional-conditions rumor
// reached the player with %fx1/%fl1/%ol1/%reg raw.
// ---------------------------------------------------------------

test('AUDIT 39 (#109): the rumor mill gets its macro pass, bracketed and reset', () => {
  const deps = literalBody(read('src/scenes/world.js'), 'new RumorMill({');
  assert.match(deps, /expandCommonTokens: \(tokens, ctx\) => \{/, 'the seam is mounted at last');
  assert.match(deps, /setIdFactions\(ctx\?\.faction1 \?\? -1, ctx\?\.faction2 \?\? -1\);\s*\n\s*setIdRegion\(ctx\?\.regionID \?\? -1\);/,
    'SetFactionIdsAndRegionID before the walk');
  assert.match(deps, /finally \{\s*\n\s*setIdFactions\(-1, -1\);\s*\n\s*setIdRegion\(-1\);/,
    'and the (-1, -1, -1) reset after it, as C# does');
  assert.match(deps, /expandQuestMessage\(questBridge\?\.machine\.macroContext\(\) \?\? null, tokens\)/,
    'the walk is the machine\'s quest-SHAPED context - the getters those symbols read are questWorld\'s');
});

// ---------------------------------------------------------------
// #110 - GetBuildingList (TalkManager.cs:2752-2797) calls GetName for
// EVERY building and adds it on `buildingKey != 0` alone; houses come
// back with the empty string and are kept. The port dropped anything
// that was not a NAMED type, which made the Where-is "General"
// section unreachable by construction - its own next gate is
// isResidence(), and residences were exactly what the walk removed.
// ---------------------------------------------------------------

/** One synthetic RMB block: a buildingDataList of the given types,
 *  one subrecord each, no pool to merge (the raw types stand). */
const fakeBlock = (types) => ({
  x: 2, y: 1, originX: 0, originZ: 0,
  dfBlock: {
    rmbBlock: {
      fldHeader: {
        otherNames: null,
        buildingDataList: types.map((buildingType, i) => ({
          buildingType, nameSeed: 1000 + i, factionId: 0, quality: 10, sector: 0, locationId: 0,
        })),
      },
      subRecords: types.map(() => ({})),
    },
  },
});

test('AUDIT 39 (#110): the building list holds residences, named or not', () => {
  const types = [BUILDING_TYPES.Tavern, BUILDING_TYPES.House2, BUILDING_TYPES.GeneralStore];
  const blk = fakeBlock(types);
  const doors = types.map((_, i) => ({ dfBlock: blk.dfBlock, recordIndex: i, position: [1, 0, 1] }));
  const dir = buildBuildingDirectory([], [blk], doors, { locationName: 'Tulune', regionName: 'Tigonus' });
  assert.equal(dir.length, 3, 'every building with a key is a row - C#\'s only gate');
  const house = dir.find((d) => d.buildingType === BUILDING_TYPES.House2);
  assert.ok(house, 'the residence a quest site would name is resolvable by key now');
  assert.equal(house.name, '', 'BuildingNames.GetName answers the empty string for a house, and DFU adds it anyway');
  assert.ok(!isNamedBuildingType(house.buildingType), 'and it is genuinely not a named type');
  assert.ok(house.buildingKey > 0);
  // the named rows are untouched: same key, still named
  assert.match(dir.find((d) => d.buildingType === BUILDING_TYPES.Tavern).name, /\S/);
  // one row per building even when several doors reach it
  const twice = buildBuildingDirectory([], [blk],
    [...doors, { dfBlock: blk.dfBlock, recordIndex: 1, position: [2, 0, 2] }], {});
  assert.equal(twice.length, 3, 'the multi-door dedupe still holds');
});

// ---------------------------------------------------------------
// #111 - GetLocationWithRegionalBuilding (:1891-1918) counts the
// region's map-table keys and walks again to the pick. `currentRegion`
// was hardcoded null and `getLocation` was absent, so the count loop
// never ran and every Regional row answered record 11, the not-found
// line. The walk itself is pinned in test/answerpipeline.test.js.
// ---------------------------------------------------------------

test('AUDIT 39 (#111): the answer pipeline gets the region and the location reader', () => {
  const deps = literalBody(read('src/scenes/world.js'), 'new AnswerPipeline({');
  assert.match(deps, /currentRegion: \(\) => maps\.getRegion\(_questRegionIndex\(\)\) \?\? null/);
  assert.match(deps, /getLocation: \(r, i\) => maps\.getLocation\(r, i\)/,
    'TalkManager reads MapFileReader directly - not the quest layer\'s dungeon-sized adapter');
  assert.doesNotMatch(deps, /currentRegion: \(\) => null/);
});

// ---------------------------------------------------------------
// #112 - GetQuestorName (:2586-2590) is srand(nameSeed) then
// NameHelper.FullName over the ENTRY's own nameBank. Unmounted, the
// seeded roll was still spent and %pqn named nobody.
// ---------------------------------------------------------------

test('AUDIT 39 (#112): the NPC session gets fullName - the TWO-argument form', () => {
  const deps = literalBody(read('src/scenes/world.js'), 'const npcSession = new NPCSession({');
  assert.match(deps, /fullName: \(nameBank, gender\) => nameHelperFullName\(nameBank, gender\)/,
    'the entry\'s own bank, not the region\'s - talkMcp\'s one-argument form is a different object');
});
