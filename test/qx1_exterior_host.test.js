// QX1 / TP2 - THE FIXED-CITY HOST TAKES THE TWO LAWS IT WAS MISSING.
//
// `?exterior` is the port's own dev route: one location, laid out
// whole, with the same mode machine, the same windows and the same
// motor as the streaming host. Two laws lived in every OTHER host that
// has the surface and not in this one, each with a flag saying so:
//
//   PX3  - "this test host mounts no quest bridge, so the pause
//          window's Quests tab says so". One missing construction, and
//          EIGHT surfaces in that file had each separately recorded
//          the absence as a decision.
//   TP2  - "Recall pends here - the anchor machinery lives in the
//          streaming ?world host". True of ONE arm of Teleport.cs and
//          false as a refusal of the whole spell, which is exactly the
//          shape A10 found and fixed in the dungeon context.
//
// Both are paid here, and NOTHING IS RETYPED: every expression this
// file runs is lifted out of `src/scenes/exterior.js` and mounted on
// stubs, so a revert runs in these assertions rather than beside them.
//
// THE REVIEW PASS WIDENED THE LIFT. The first cut sliced only the
// `questWorld` literal, so `_questStore` had to be stubbed away and
// the one assertion over `getFactionData` could not tell the raw
// FACTION.TXT dictionary from the player's persistent CLONE of it -
// which is exactly the defect it was standing over. The slice now
// starts at `_questStore` itself and runs the REAL factionRep chain,
// so a read that comes off the file instead of the store is red here.
// The read stubs carry their arguments for the same reason: a seam
// replaced by a constant, or asked with the wrong region, must fail.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { WORLD_CONTEXT, makeAnchor, teleportPlan, ANCHOR_MUST_BE_SET } from '../src/systems/teleportAnchor.js';
import { locationWorldRect } from '../src/world/streamingWorld.js';
import { GLOBAL_SCALE } from '../src/world/meshReader.js';
import { GROUND_OFFSET } from '../src/world/rmbLayout.js';
import { ActionTextBox } from '../src/ui/actionText.js';
import { plainLines } from '../src/scenes/shared.js';
import { ensureFactionRep, changeReputation } from '../src/systems/factionRep.js';
import { findFactions, findFactionByTypeAndRegion, getPeopleOfCurrentRegion, getCourtOfCurrentRegion } from '../src/systems/talk.js';
import { FACTION_TYPES, SOCIAL_GROUPS, GUILD_GROUPS } from '../src/formats/factionFile.js';
import { liveVampirism } from '../src/systems/racialLive.js';
import { mintQuestFoeWave, placeFoeEnv, entityOccupancy, questFoeGender } from '../src/scenes/questFoeHost.js';
import { placeFoeFreely } from '../src/systems/quest/sceneMount.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { QuestJournalWindow, JOURNAL_RECTS } from '../src/ui/questJournal.js';
import { isPlayerInTown } from '../src/systems/nearbyObjects.js';

const SRC = readFileSync(new URL('../src/scenes/exterior.js', import.meta.url), 'utf8');

/** Lift the source between two markers, both of which must be unique. */
function slice(from, to) {
  const a = SRC.indexOf(from);
  const b = SRC.indexOf(to);
  assert.ok(a >= 0, `exterior.js no longer contains: ${from}`);
  assert.ok(b > a, `exterior.js no longer contains: ${to}`);
  return SRC.slice(a, b);
}

// ───────────────────────── QX1: the quest bridge ─────────────────────────

/** RegionRaces[17] + 1 === 3, the one race this route can be asked. */
const REGION_RACES_STUB = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2];

const dfLocationStub = () => ({
  name: 'Daggerfall', regionIndex: 17, locationIndex: 4,
  mapTableData: { mapId: 1050578, locationType: 8 },
  exterior: { exteriorData: { width: 8, height: 8, blockNames: ['MAGEAA00.RMB'] } },
});

/** The RAW FACTION.TXT reader dictionary - what `townTalk.factionDict`
 *  answers. `_questStore()` clones it (factionRep.createFactionRep),
 *  and the whole point of the getFactionData pin below is that the
 *  quest layer must read the CLONE. */
const factionFileDict = () => new Map([
  [42, { id: 42, name: 'A Person', type: FACTION_TYPES.Individual, rep: 0, region: -1, sgroup: -1, ggroup: -1, flags: 0, vam: 0, power: 10 }],
  [201, { id: 201, name: 'The Daggerfall Temple', type: FACTION_TYPES.Temple, rep: 5, region: -1, sgroup: 2, ggroup: GUILD_GROUPS.HolyOrder, flags: 0, vam: 0, power: 10 }],
  [17, { id: 17, name: 'Daggerfall Province', type: FACTION_TYPES.Province, rep: 3, region: 17, sgroup: 3, ggroup: GUILD_GROUPS.Region, flags: 0, vam: 913, power: 10 }],
  [90, { id: 90, name: 'Daggerfall Commoners', type: FACTION_TYPES.People, rep: 1, region: 17, sgroup: SOCIAL_GROUPS.Commoners, ggroup: GUILD_GROUPS.GeneralPopulace, flags: 0, vam: 0, power: 10 }],
  [91, { id: 91, name: 'Daggerfall Court', type: FACTION_TYPES.Courts, rep: 2, region: 17, sgroup: 3, ggroup: GUILD_GROUPS.Region, flags: 0, vam: 0, power: 10 }],
  [913, { id: 913, name: 'The Vraseth', type: FACTION_TYPES.VampireClan, rep: 0, region: -1, sgroup: 6, ggroup: GUILD_GROUPS.Vampires, flags: 0, vam: 0, power: 10 }],
]);

/** ROAD-G G2: open ground at y = 0 with nothing standing on it - the
 *  exterior collider's ANALYTIC floor (`heightAt`), which is the surface
 *  placeFoeEnv's straight-down probe is written for. */
const OPEN_GROUND = {
  raycastHit: () => ({ dist: Infinity, normal: null }),
  heightAt: () => 0,
  sphereOverlaps: () => false,
};

const QW_PARAMS = [
  // the module bindings the lifted block closes over
  'ensureFactionRep', 'findFactions', 'FACTION_TYPES', 'findFactionByTypeAndRegion',
  'getPeopleOfCurrentRegion', 'getCourtOfCurrentRegion', 'liveVampirism', 'mintQuestFoeWave',
  'ServiceFlowWindow',
  // ...and the host's own
  'maps', 'blocks', 'pipeline', 'townTalk', 'dfLocation', 'locationName', 'locClimateIndex',
  'currentWeather', '_musicInLocationRect', '_locPixel', 'legalRepOf', 'changeLegalRep',
  'isHouseOwned', 'playerEntity', 'generateBuildingName', 'modes', 'discoverLocation',
  'REGION_RACES', 'dungeonLocationFor', 'questBridge',
  // ROAD-G G2: CreateFoe's OUTDOOR placement arm - the law modules the
  // lifted block calls, and the host state it places around. APPENDED,
  // because these names must line up with the argument list below.
  'placeFoeEnv', 'placeFoeFreely', 'entityOccupancy', 'questFoeGender', 'ENEMY_BASICS',
  'fieldOfView', 'walkMode', 'player', 'cam', 'collider', 'exteriorFoes', 'exteriorFoePool',
  // ...and the G4 spell registry CastSpellDo reads through this host's
  // own `getClassicSpellEffects` (world.js:4908's seam).
  'spellRecordOfIndex',
];

/**
 * Mount the host's SHIPPED quest-world block - `_questStore`,
 * `_regionFaction`, the quest-box slot and the `questWorld` literal -
 * on stubs. The faction chain is the REAL one (ensureFactionRep over a
 * real reader dictionary), so store-vs-file is observable.
 */
function mountQuestWorld(opts = {}) {
  const asked = [];
  const dfLocation = opts.dfLocation ?? dfLocationStub();
  const factionDict = 'factionDict' in opts ? opts.factionDict : factionFileDict();
  const playerEntity = opts.playerEntity ?? { houses: [] };
  const questBridge = opts.questBridge ?? null;
  const townTalk = { factionDict, nameOpts: () => ({ seed: 1 }), pushOverlay: () => {} };
  const body = slice('  const _questStore = (', '  questBridge = createQuestBridge({');
  const world = new Function(...QW_PARAMS, `${body} return questWorld;`)(
    ensureFactionRep, findFactions, FACTION_TYPES, findFactionByTypeAndRegion,
    getPeopleOfCurrentRegion, getCourtOfCurrentRegion, liveVampirism, mintQuestFoeWave,
    function ServiceFlowWindow(o) { Object.assign(this, o); },
    opts.maps ?? {
      getRegion: (i) => ({ name: `region-${i}` }),
      getLocation: (r, l) => ({ raw: [r, l] }),
      getLocationByName: (rn, ln) => ({ raw: [rn, ln] }),
    },
    { getBlockByName: (n) => ({ n }) },
    { flatCaption: (archive, record) => `caption-${archive}-${record}` },
    townTalk, dfLocation, 'Daggerfall', 231,
    opts.currentWeather ?? (() => 'Rain'),
    opts.inLocationRect ?? (() => true),
    { x: 207, y: 213 },
    // ARG-CARRYING stubs: 100 + region, so `legalRepOf(playerEntity, 0)`
    // - the wrong region - cannot pass, and no returned value is a
    // literal the source could hard-code instead of delegating.
    (e, r) => { asked.push(['legalRead', e, r]); return 100 + r; },
    (...a) => asked.push(['legal', ...a]),
    (houses, r, key) => { asked.push(['house', houses, r, key]); return r === 17 && key === 9; },
    playerEntity, () => 'The Odd Blades', opts.modes ?? null,
    () => asked.push(['discover']), REGION_RACES_STUB,
    opts.dungeonLocationFor ?? ((loc, deps) => ({ sized: loc, machine: deps?.questMachine ?? null })),
    questBridge,
    // ROAD-G G2: the placement law is the REAL one - only the world it
    // rays through is a stub, so a host that mis-orders the ring, the
    // FOV or the lift is red here rather than beside here.
    placeFoeEnv, placeFoeFreely, entityOccupancy, questFoeGender, ENEMY_BASICS,
    opts.fieldOfView ?? (() => 75 * Math.PI / 180),   // fieldOfView() answers RADIANS
    opts.walkMode ?? true,
    opts.player ?? { pos: [100, 0, 100] },
    opts.cam ?? { yaw: 0, pos: [100, 0.9, 100] },
    opts.collider ?? OPEN_GROUND,
    opts.exteriorFoes ?? { foes: [], spawnFoe: () => Promise.resolve(null) },
    opts.exteriorFoePool ?? (() => []),
    // ARG-CARRYING again: the record is BUILT from the id it was asked
    // for, so a seam that hard-codes a spell cannot pass.
    opts.spellRecordOfIndex ?? ((id) => (id === 0 ? null : { effects: [{ type: id & 0xff, subType: (id >> 8) & 0xff }] })),
  );
  return { world, asked, playerEntity, factionDict, dfLocation, townTalk };
}

test('QX1: the fixed-city host mounts a quest bridge, and its world reads answer the ONE loaded city', () => {
  // The construction itself. `data` is the vendored pack and `world`
  // is the adapter below - the two seams createQuestBridge requires.
  assert.match(SRC, /questBridge = createQuestBridge\(\{\n {4}data: questPack,\n {4}world: questWorld,/);
  assert.match(SRC, /const \{ loadQuestPack \} = await import\('\.\/questData\.js'\);/,
    'a DYNAMIC import - a static one drags this host out of moduleload_smoke');

  // ...and the adapter, RUN. This is what "the machine mounts over
  // that city" means: where the streaming host asks its pixel for the
  // current location on every read, this one answers `dfLocation`
  // outright, because it has exactly one for its whole life.
  let wx = 'Rain';
  const M = { tick: () => {} };
  const { world, asked, playerEntity, dfLocation } = mountQuestWorld({
    currentWeather: () => wx,
    questBridge: { machine: M },
  });

  assert.equal(world.currentLocation(), dfLocation, 'PlayerGPS.CurrentLocation IS the loaded city');
  assert.equal(world.currentRegionIndex(), 17);
  assert.equal(world.currentLocationIndex(), 4);
  assert.equal(world.currentLocationType(), 8);
  assert.equal(world.currentRegionName(), 'region-17');
  assert.equal(world.currentRegionRace(), 3, 'GetRaceOfCurrentRegion is RegionRaces[i] + 1');
  assert.deepEqual(world.playerPixel(), { x: 207, y: 213 }, 'the quest clock travels from the city\'s own pixel');
  assert.equal(world.currentClimateIndex(), 231);
  assert.equal(world.getBlock('MAGEAA00.RMB').n, 'MAGEAA00.RMB');
  assert.equal(world.flatCaption(182, 3), 'caption-182-3', '=symbol_ passes BOTH halves of the flat id');
  assert.equal(world.isPlayerInLocationRect(), true);

  // THE WEATHER READ IS A READ, not a frozen literal: the same seam
  // answers whatever the live producer answers, and its `?? null` arm
  // is C#'s "no weather" rather than undefined.
  assert.equal(world.currentWeatherKey(), 'Rain', 'the Weather trigger reads the live weather');
  wx = 'Snow';
  assert.equal(world.currentWeatherKey(), 'Snow', '...every time it is asked');
  wx = undefined;
  assert.equal(world.currentWeatherKey(), null, 'and an unset weather is null, not undefined');

  // THE LEGAL PAIR, both halves, both carrying their region. AUDIT 39
  // (#25)'s law: the read and the write must agree on WHICH region,
  // and here that is the loaded city's - 100 + 17.
  assert.equal(world.legalRepNow(), 117, 'legalRepOf is asked for the LOADED city\'s region');
  world.changeLegalRep(5);
  assert.deepEqual(asked, [['legalRead', playerEntity, 17], ['legal', playerEntity, 17, 5]],
    'the write files against the same region the read asked for');
  assert.equal(world.isHouseOwned(9), true, 'Place.SetupSites\' residence filter gets the region and the key');
  assert.equal(world.isHouseOwned(8), false);

  // ...and the three delegations whose producers are genuinely
  // constant in this host, held as source the way world.js's twin is
  // (audit39_worldlegaltalk's shape).
  assert.match(SRC, /isPlayerInLocationRect: \(\) => _musicInLocationRect\(\),/);
  assert.match(SRC, /legalRepNow: \(\) => legalRepOf\(playerEntity, dfLocation\.regionIndex\),/);
  assert.match(SRC, /changeLegalRep: \(amount\) => changeLegalRep\(playerEntity, dfLocation\.regionIndex, amount\),/);

  // AUDIT 28 W4/F-B2, THE LANE'S FOURTH COPY OF THE LAW: the smaller-
  // dungeon wrap lives INSIDE MapsFile.GetLocation, so quest marker
  // enumeration walks the FIVE-BLOCK dungeon when the law says so -
  // and the machine is LATE-BOUND, exactly as DFU consults its
  // singleton. Both getters go through the wrap; getRegion does not,
  // and reaches the prototype.
  assert.deepEqual(world.maps.getLocation(17, 4), { sized: { raw: [17, 4] }, machine: M },
    'GetLocation goes through dungeonLocationFor, with the machine');
  assert.deepEqual(world.maps.getLocationByName('Daggerfall', 'Privateer\'s Hold'),
    { sized: { raw: ['Daggerfall', 'Privateer\'s Hold'] }, machine: M },
    'and so does the by-name overload');
  assert.equal(world.maps.getRegion(17).name, 'region-17', 'everything else delegates to the real MapsFile');

  // playerInside is the MOUNTED MODE's answer, exactly as in the
  // streaming host - outside one there is nothing to be inside of.
  assert.equal(world.playerInside(), null, 'no mode mounted, so the player is outside');
  assert.equal(world.currentBuildingName(), null, '%cbd outside a building is C#\'s "[invalid]" arm');
});

test('QX1 review: B2\'s PcAt answers the mode that is mounted - both mounted arms, not just the null one', () => {
  const inDungeon = mountQuestWorld({ modes: { mode: 'dungeon', dungeonLocation: { name: 'Privateer\'s Hold' } } });
  assert.deepEqual(inDungeon.world.playerInside(), { dungeon: { name: 'Privateer\'s Hold' } },
    'dungeon mode answers PcAt\'s DUNGEON shape, never a building');
  assert.equal(mountQuestWorld({ modes: { mode: 'dungeon' } }).world.playerInside().dungeon.name, '',
    'a nameless dungeon is C#\'s empty name, not a throw');

  const building = { buildingKey: 8421, buildingType: 12, factionId: 42, name: 'The Odd Blades', nameSeed: 5 };
  const inside = mountQuestWorld({ modes: { mode: 'interior', interiorBuilding: building } });
  assert.deepEqual(inside.world.playerInside(),
    { building: { buildingKey: 8421, buildingType: 12, factionId: 42, name: 'The Odd Blades' } },
    'interior mode answers PcAt\'s BUILDING shape - the mode test is === \'dungeon\', not any other mode');
  assert.equal(inside.world.playerInside().dungeon, undefined, 'an interior is never a dungeon to PcAt');
  // ...and %cbd's MOUNTED arm beside it: inside a building the name is
  // REGENERATED from the building's own seed (MacroHelper :849-867).
  assert.equal(inside.world.currentBuildingName(), 'The Odd Blades');
});

test('QX1 review: every faction read is the PERSISTENT store, and the Person chain\'s faction-type family is mounted', () => {
  const playerEntity = { houses: [] };
  const { world, factionDict } = mountQuestWorld({ playerEntity });

  // (1) getFactionData reads the CLONE, not the reader's dictionary.
  // The write path (changeReputation below) has always been the clone;
  // a read off the file made `change repute with _npc_ by 30` and
  // `when repute with _npc_ is at least N` two different Maps.
  const store = ensureFactionRep(playerEntity, factionDict);
  assert.notEqual(world.getFactionData(42), factionDict.get(42),
    'the file record and the store record are different objects');
  assert.equal(world.getFactionData(42), store.dict.get(42), 'and the quest layer reads the STORE one');
  changeReputation(store, 42, 30);
  assert.equal(world.getFactionData(42).rep, 30, 'a rep WRITE is visible to the quest layer\'s rep READ');
  assert.equal(factionDict.get(42).rep, 0, '...and the shared reader dictionary is untouched');
  assert.equal(world.getFactionData(99999), null, 'an unknown faction is null, never a throw');

  // (2) Person.cs's GetFactionTypeFactionID reads (:967-1018). Each was
  // absent, so `factiontype Temple` threw in _getRandomFactionOfType
  // and every `group Resident1-4` default fell to the ZERO faction.
  assert.deepEqual(world.findFactionsOfType(FACTION_TYPES.Temple).map((f) => f.id), [201]);
  assert.deepEqual(world.findFactionsOfType(FACTION_TYPES.WitchesCoven), [],
    'a type with no rows is the empty list, not a throw');
  assert.equal(world.findFactionsOfType(FACTION_TYPES.Temple)[0], store.dict.get(201),
    'and the rows handed out are the STORE\'s, so a flag set on one is seen by the next read');
  assert.equal(world.findFactionByTypeAndRegion(FACTION_TYPES.Courts, 17).id, 91);
  assert.equal(world.currentRegionPeople(), 90, 'GetPeopleOfCurrentRegion over the LOADED city\'s region');
  assert.equal(world.currentRegionCourt(), 91, 'GetCourtOfCurrentRegion, same region');
  assert.equal(world.currentRegionFaction(), 17, 'GetRegionFaction is FindFactions(Province, region), first row');
  assert.equal(world.currentRegionVampireClan(), 913, '...and the SAME Province record\'s `vam` column');

  // (3) the %vam pair. NULL - never '' - is what makes the macro print
  // C#'s own "PC not a vampire" literal.
  assert.equal(world.playerVampireClan(), -1);
  assert.equal(world.playerVampireClanName(), null);
  playerEntity.activeEffects = [{ kind: 'racialOverride', racial: 'vampirism', clan: 913 }];
  assert.equal(world.playerVampireClan(), 913);
  assert.equal(world.playerVampireClanName(), 'The Vraseth', 'the clan NAME comes off the store too');

  // (4) ...and the family degrades to the charter's refusal when
  // FACTION.TXT has not loaded - never a throw on `store.dict`. The
  // People/Courts pair is left out of this arm deliberately: their
  // expressions are world.js:4827/4827's verbatim, and talk.js's
  // findFactions dereferences the dictionary it is handed, so the two
  // hosts share one shape there and neither invents a private guard.
  const cold = mountQuestWorld({ factionDict: null });
  assert.equal(cold.world.getFactionData(42), null);
  assert.deepEqual(cold.world.findFactionsOfType(FACTION_TYPES.Temple), []);
  assert.equal(cold.world.findFactionByTypeAndRegion(FACTION_TYPES.Courts, 17), null);
  assert.equal(cold.world.currentRegionFaction(), -1);
  assert.equal(cold.world.currentRegionVampireClan(), -1);
});

test('QX1 review: the CreateFoe spawn seams and the site mount are wired to this host\'s mode machine', () => {
  const foe = { symbol: { name: '_foe_' }, parentQuest: { uid: 42 }, foeType: 7, gender: 0, spawnCount: 3 };
  const placed = [];
  const modes = {
    mode: 'dungeon',
    tryPlaceQuestFoe: (h) => { placed.push(h); return true; },
    mountQuestResources: () => { placed.push('mount'); return 'mounted'; },
    raiseOnEncounterEvent: () => { placed.push('encounter'); return 'raised'; },
  };
  const { world } = mountQuestWorld({ modes, questBridge: { machine: { getQuest: () => null } } });

  // GameObjectHelper.CreateFoeGameObjects (:1243-1305): actions.js
  // takes an early return when this seam is absent, so `create foe`
  // minted nothing in this host at all.
  const wave = world.createFoeGameObjects(foe, 3);
  assert.equal(wave.length, 3, 'one handle per instance');
  assert.equal(wave[0].foe, foe);
  assert.equal(wave[0].behaviour.questUID, 42, 'AssignResource stamps the identity at mint');

  // CreateFoe.TryPlacement (:183-211): the INSIDE arms are the mode
  // machine's and are live here...
  assert.equal(world.tryPlaceFoe(wave[0]), true);
  assert.deepEqual(placed, [wave[0]]);
  // ...and the OUTDOOR arm STANDS A FOE now (ROAD-G G2). It used to
  // answer false without even reaching the mode machine, because this
  // host mounted no exterior foe pool: an `create foe` wave aimed at
  // the street pended for ever. It must still not reach the mode
  // machine - the mode machine has no exterior arm - and it must
  // reach THIS host's own pool.
  const stood = [];
  const outside = mountQuestWorld({
    modes: { ...modes, mode: 'exterior', tryPlaceQuestFoe: () => { throw new Error('the exterior arm must not reach the mode machine'); } },
    exteriorFoes: { foes: [], spawnFoe: (...a) => { stood.push(a); return Promise.resolve(null); } },
  });
  assert.equal(outside.world.tryPlaceFoe(wave[0]), true);
  assert.equal(stood.length, 1, 'the foe is stood in this host\'s own pool');
  assert.equal(mountQuestWorld({ modes: null }).world.tryPlaceFoe(wave[0]), true,
    'and with no mode machine at all the default is still the exterior arm');

  // GameManager.RaiseOnEncounterEvent - AbortRestForEnemySpawn's door,
  // which worldModes routes back to THIS host's own rest overlay.
  world.raiseOnEncounterEvent();
  // Place.AssignQuestResource's hot-place tail (Place.cs:508-527).
  assert.equal(world.mountCurrentSiteQuestResources(), 'mounted');
  assert.deepEqual(placed, [wave[0], 'encounter', 'mount']);
  assert.equal(mountQuestWorld({ modes: null }).world.mountCurrentSiteQuestResources(), undefined,
    'no mode machine, no site to mount - the optional call, not a throw');
});

// ───────── ROAD-G G2 (b): CreateFoe's OUTDOOR placement arm ─────────

test('ROAD-G G2: the outdoor arm is PlaceFoeExteriorLocation - the 5/20 ring, the FOV cone, LookAt, the Flying lift', () => {
  const foe = { symbol: { name: '_foe_' }, parentQuest: { uid: 7 }, foeType: 10, gender: 1, spawnCount: 1 };
  const behaviour = { questUID: 7 };
  const handle = { foe, behaviour };
  const player = { pos: [100, 0, 100] };
  const cam = { yaw: 0 };
  const stood = [];
  const mk = (over = {}) => mountQuestWorld({
    modes: null, player, cam,
    exteriorFoes: { foes: [], spawnFoe: (...a) => { stood.push(a); return Promise.resolve(null); } },
    ...over,
  }).world;

  // TryPlacement (:203-206) picks PlaceFoeExteriorLocation when
  // IsPlayerInLocationRect, and this route stands in its ONE city's
  // rect for its whole life - so the ring is PlaceFoeFreely's DEFAULT
  // 5/20 (:245-248 passes no band) and the wilderness 8/25 arm
  // (:252-257) has no reachable branch on this host at all.
  const world = mk();
  for (let i = 0; i < 200; i++) assert.equal(world.tryPlaceFoe(handle), true);
  assert.equal(stood.length, 200);
  for (const [type, pos, opts] of stood) {
    assert.equal(type, 10, 'the foe resource\'s own mobile type');
    const d = Math.hypot(pos[0] - 100, pos[2] - 100);
    assert.ok(d >= 5 - 1e-9 && d <= 20 + 1e-9, `the 5/20 ring, got ${d}`);
    // MUTANT: hand placeFoeFreely `{ minDistance: 8, maxDistance: 25 }`
    // - the wilderness band - and this bound is red.
    assert.ok(d <= 20, 'never the wilderness 8/25 band');
    // The bearing is outside the camera FOV, both sides (:274-281):
    // the cone is fovDegrees + Range(0,4), so nothing lands ahead.
    const bearing = Math.abs(Math.atan2(pos[0] - 100, pos[2] - 100) * 180 / Math.PI);
    assert.ok(bearing >= 75, `outside the 75 degree cone, got ${bearing}`);
    // MUTANT: pass fieldOfView() unconverted (radians into a degrees
    // slot) and every foe lands dead ahead - this bound is red.
    // ...and the cone's FAR side, which is what makes it a cone
    // ANCHORED ON THE PLAYER rather than a bearing that is merely not
    // ahead: sceneMount.js:233-235 draws `fovDegrees + Range(0,4)`, so
    // the closed band is [75, 79). REVIEW: `bearing >= 75` alone was
    // one-sided, and `playerYawRad: cam.yaw + Math.PI` - a cone
    // anchored behind the player, foes at 103 degrees - passed it.
    assert.ok(bearing <= 79, `inside the cone + the Range(0,4) skirt, got ${bearing}`);
    assert.equal(pos[1], 1.25, 'a WALKER keeps the probed floor + the separation the law stands it at');
    // LookAt player (:328), and the Foe resource\'s own gender wins
    // over the pool\'s coin (questFoeGender).
    const want = Math.atan2(100 - pos[0], 100 - pos[2]);
    assert.ok(Math.abs(opts.yaw - want) < 1e-9, 'the foe faces the player');
    assert.equal(opts.gender, 'female', 'the Foe resource\'s gender, not the pool\'s roll');
    assert.equal(opts.questBehaviour, behaviour, 'and the QuestResourceBehaviour binds at the stand');
  }

  // FinalizeFoe (:341-359): a FLYING foe is lifted 1.5 off the test
  // point; a walker is not. Mobile 1 is Flying in ENEMY_BASICS.
  assert.equal(ENEMY_BASICS[1].behaviour, 'Flying', 'the fixture is a flier');
  stood.length = 0;
  assert.equal(mk().tryPlaceFoe({ foe: { ...foe, foeType: 1 }, behaviour }), true);
  assert.equal(stood[0][1][1], 1.25 + 1.5, 'the flier lifts 1.5');

  // TryPlacement returns FALSE when there is no open spot - the wave
  // stays pending and re-attempts on the next machine tick, which is
  // C#\'s own failed-placement shape and now a real refusal rather
  // than a host with nowhere to put a foe.
  stood.length = 0;
  const walled = mk({ collider: { raycastHit: () => ({ dist: Infinity, normal: null }), heightAt: () => -100, sphereOverlaps: () => false } });
  assert.equal(walled.tryPlaceFoe(handle), false, 'no floor within maxFloorDistance, no placement');
  assert.equal(stood.length, 0);

  // ...and the floor probe measures from the CONTROLLER CENTRE, not
  // from the feet - DFU rays from `PlayerObject.transform.position`
  // (CreateFoe.cs:282-283), which the host ships as `feet[1] + 0.9`.
  // A floor 3.5 below the feet is 4.4 below the centre, past
  // PLACE_FOE_DEFAULTS.maxFloorDistance = 4 (sceneMount.js:203), so the
  // shipped origin refuses where a feet origin would place. REVIEW: the
  // header claimed this term and the stub's flat plane could not see
  // it - `playerFeet: [feet[0], feet[1], feet[2]]` passed the pin.
  const ledge = mk({ collider: { raycastHit: () => ({ dist: Infinity, normal: null }), heightAt: () => -3.5, sphereOverlaps: () => false } });
  assert.equal(ledge.tryPlaceFoe(handle), false,
    'the 4m floor probe measures from the controller CENTRE, not the feet (CreateFoe.cs:283)');
  assert.equal(stood.length, 0);

  // ...and the OCCUPANCY test is DFU\'s `Physics.OverlapSphere(
  // testPoint, 0.65f)` (:317-321), ANY collider - so this host\'s
  // WHOLE street database is in it, the watch included, not the
  // encounter pool alone.
  assert.match(SRC, /isOccupied: entityOccupancy\(\(f\) => f\.ai\?\.feet, exteriorFoePool, feet\),/);
  const occupied = mk({ exteriorFoePool: () => [{ ai: { feet: [100, 0, 100] } }, { ai: { feet: [0, 0, 0] } }] });
  let refusals = 0;
  for (let i = 0; i < 60; i++) if (!occupied.tryPlaceFoe(handle)) refusals++;
  assert.equal(refusals, 0, 'a foe standing at the player\'s own feet does not block the whole ring');
  // THE REAL BITE, and it has to be a refusal: bodies on EVERY spot in
  // the ring, and the arm answers false without standing anything.
  // REVIEW: this assertion used to be `typeof ... === 'boolean'` under
  // this same comment - tryPlaceFoe returns a boolean on every path, so
  // it could not fail for any mutant, and deleting the occupancy term
  // from questFoeHost.js:141 outright left this file green. An
  // unfalsifiable term is not caution; it is a second law no test is
  // holding. entityOccupancy (questFoeHost.js:149-161) hits when the
  // centre distance is under r + 0.45 with r = 0.65, and it compares
  // `feet[1] + 0.9` against the test point's y (floor + the 1.25
  // separation), so bodies at feet y 0.35 sit exactly on the probe
  // plane and a 1.4 grid (worst case 0.99 to the nearest node) covers
  // every candidate the 5/20 ring can draw.
  const bodies = [];
  for (let x = 78; x <= 122; x += 1.4) for (let z = 78; z <= 122; z += 1.4) bodies.push({ ai: { feet: [x, 0.35, z] } });
  const dense = mk({ exteriorFoePool: () => bodies });
  stood.length = 0;
  for (let i = 0; i < 60; i++) assert.equal(dense.tryPlaceFoe(handle), false, 'a body on the chosen spot refuses it');
  assert.equal(stood.length, 0);

  // The fly camera has no controller capsule to place around, so the
  // arm refuses rather than raying from a camera the player is not in.
  assert.equal(mk({ walkMode: false }).tryPlaceFoe(handle), false);
});

// ─── ROAD-G G2 review: the seams the lane shipped and nothing held ───

test('ROAD-G G2 review: the cast engine raises the two ready-spell doors into THIS host\'s machine', () => {
  // hostMagic.js:73-74 declares `onNewReadySpell` / `onCastReadySpell`
  // and is the ONLY raiser in the tree (SetReadySpell raises NEW right
  // after `readiedSpell = sp`; `done()` raises CAST on every release
  // path, before the ready clears). machine.js:776/:782 fan them out,
  // and CastSpellDo / CastEffectDo latch on nothing else
  // (actions.js:2688 - C# subscribes them in its constructor). This
  // host owns its own cast engine, and worldModes takes THIS instance
  // for the interior mode, so while the mount passed neither key every
  // `cast X spell do` / `cast X effect do` on this route - and in every
  // shop entered from it - was permanently deaf. world.js:2177-2178 and
  // dungeonContext.js:1789-1790 wire the identical pair.
  const doorSrc = slice('    onNewReadySpell: (sp) => questBridge',
    '    // ROAD-G G2 (a): THE THREE-ARM SHAPE');
  // ...and they are keys of the ENGINE MOUNT, not of some other bag:
  // a pair moved out of `createPlayerMagic` raises nothing.
  const mountAt = SRC.indexOf('  const magic = createPlayerMagic({');
  assert.ok(mountAt > 0 && SRC.indexOf(doorSrc) > mountAt
    && SRC.indexOf(doorSrc) < SRC.indexOf('\n  });', mountAt),
  'the two doors sit inside the createPlayerMagic literal');

  const mk = (bridge) => new Function('questBridge', `return { ${doorSrc} };`)(bridge);
  const seen = [];
  const bundle = { effects: [{ type: 5, subType: 1 }] };
  const doors = mk({
    machine: {
      notifyNewReadySpell: (sp) => seen.push(['new', sp]),
      notifyCastReadySpell: (sp) => seen.push(['cast', sp]),
    },
  });
  doors.onNewReadySpell(bundle);
  doors.onCastReadySpell(bundle);
  assert.deepEqual(seen, [['new', bundle], ['cast', bundle]],
    'both doors reach the machine, carrying the readied bundle');
  // The bridge is a `var` assigned BELOW this mount, so the chain has
  // to be optional both ways - a raise before the bridge exists (and
  // one on a machine with no such door) is a no-op, never a throw.
  mk(null).onNewReadySpell(bundle);
  mk({ machine: {} }).onCastReadySpell(bundle);
  assert.equal(seen.length, 2);
});

test('ROAD-G G2 review: questWorld answers CastSpellDo\'s two classic-spell reads', () => {
  // Without these the action self-completes at PARSE
  // (actions.js:2742/:2749 - no effects, so C#'s template completes and
  // the task can never fire), which would have left `cast X spell do`
  // dead on this route even with the doors above wired. world.js:4908's
  // pair, byte-folded on both sides exactly as MakeClassicKey folds.
  const { world } = mountQuestWorld();
  assert.deepEqual(world.getClassicSpellEffects(0x105), [{ type: 5, subType: 1 }],
    'the G4 registry answers the record for the id it was ASKED for');
  assert.equal(world.getClassicSpellEffects(0), null, 'and no record is null, not a throw');
  assert.equal(world.spellHasMatchForClassicEffect(
    { effects: [{ type: 0x205, subType: 0x301 }] }, { type: 5, subType: 1 }), true,
  'HasMatchForClassicEffect folds through the byte cast, both sides');
  assert.equal(world.spellHasMatchForClassicEffect(
    { effects: [{ type: 5, subType: 2 }] }, { type: 5, subType: 1 }), false);
  assert.equal(world.spellHasMatchForClassicEffect(null, { type: 5, subType: 1 }), false,
    'no readied bundle is no match');
});

test('ROAD-G G2 review: the encounter pool\'s frame seams - the tick, the draw, the one senses context, the enemy-arrow target', () => {
  // THE SEAMS THE LANE SHIPPED AND NOTHING HELD. Each of these four
  // lines could be deleted or narrowed with the whole suite still
  // green: the pool never ticking, never drawing, its foes seeing only
  // the player, and every enemy shaft passing through him.
  const frame = slice('      const _senses = _foeSenses();',
    '      droppedLoot.tickFlats(dt);');
  assert.ok(frame.includes('exteriorFoes.update(townTalk.overlayActive ? 0 : dt,'),
    'the mounted pool DRIVES on the frame, and freezes under the talk overlay');
  assert.ok(frame.includes('personBatches.push(...exteriorFoes.batches());'),
    '...and DRAWS on the same flats\' axis the watch does');
  assert.ok(frame.indexOf('cityGuards.update(') < frame.indexOf('exteriorFoes.update('),
    'the watch drives first - world.js\'s order');
  assert.equal((frame.match(/, eye, _senses\);/g) ?? []).length, 2,
    'ONE senses context per frame, shared by BOTH pools');

  // EnemySenses.cs:741-749 reads ONE active-enemy database, so the
  // watch and a CreateFoe-stood quest foe can see each other; narrowed
  // to `exteriorFoes.foes` (or dropped) every foe on this route takes
  // the player-only path again.
  const senses = slice('  const _foeSenses = () => sensesContext(', '  // U32: ONE construction');
  assert.match(senses, /candidates: \(\) => exteriorFoePool\(\)\.filter\(\(f\) => !f\.dead\),/,
    'the senses walk the UNNARROWED street database, live records only');

  // world.js:7144-7195's arrow shape: an enemy shaft hunts a WALKING
  // player (the fly camera has no capsule), and both live pools are
  // impact candidates. `playerFeet: null` is every enemy arrow passing
  // through the player - the whole enemy arm the lane shipped.
  const shafts = slice('    arrows.update(dt, {', '    arrows.draw(renderer, texRemap);');
  assert.match(shafts, /playerFeet: walkMode \? player\.pos : null,/,
    'the enemy shaft hunts the walking player');
  assert.match(shafts, /foeTargets: exteriorFoePool\(\)\.filter\(\(t\) => !t\.dead && t\.ai\)/,
    'and the impact learns the live street pool');
});

// ───────── ROAD-G G2 (c): HandleQuestClicks\' find-place seam ─────────

test('ROAD-G G2: the journal knows which city it is standing in, and the map half is the one recorded absence', () => {
  // HandleQuestClicks (:448-450) asks THREE questions before the
  // dialog and the third is
  // `place.SiteDetails.locationName != PlayerGPS.CurrentLocation.Name`.
  // What DFU does when the place IS the current location is NOTHING -
  // CanFindPlace is not even reached. This host had never answered the
  // question, so the gate compared against `''` and could never match;
  // it stands in ONE city for its whole life and can answer it outright.
  const body = slice('  const questJournalHooks = () => (questBridge ? {',
    "  if (!playerEntity.chargenDone && params.has('class')) {");
  const hooks = (bridge, dfLocation) => new Function('questBridge', 'dfLocation', 'locationName',
    `${body} return questJournalHooks;`)(bridge, dfLocation, 'the ?loc fallback')();
  const bridge = { machine: { getAllQuestLogMessages: () => [] }, notebook: null };

  assert.equal(hooks(bridge, dfLocationStub()).currentLocationName(), 'Daggerfall',
    'PlayerGPS.CurrentLocation.Name IS the loaded city');
  assert.equal(hooks(bridge, {}).currentLocationName(), 'the ?loc fallback',
    'and a location with no name of its own falls back to the one the route was asked for');

  // THE ARM, RUN, through the real window: with the host's answer the
  // city the player is standing in is NOT offered, and a different one
  // still is. MUTANT: drop `currentLocationName` from the hooks and the
  // first of these two offers a find dialog for the city under foot.
  const FONT = { fnt: { fixedWidth: 6, fixedHeight: 7, glyphWidth: () => 5 } };
  const openOn = (locationName) => {
    const place = { isPlace: true, siteDetails: { locationName, regionName: 'Daggerfall', regionIndex: 17, mapId: 1 } };
    const win = new QuestJournalWindow({
      // the host's OWN hooks first, then the one entry under test -
      // this bridge's log walk is empty by construction
      ...hooks(bridge, dfLocationStub()),
      questMessages: () => [{
        getTextTokens: () => [{ text: 'Meet me at _place_ tonight.', formatting: 'text' }],
        parentQuest: { getResource: ({ name }) => (name === 'place' ? place : null) },
      }],
      canFindPlace: () => true,
      gotoPlace: () => {},   // the map this route does NOT have, supplied here so the gate under test is the only one that can refuse
    });
    win._font = FONT;
    win.click(JOURNAL_RECTS.log[0] + 4, JOURNAL_RECTS.log[1] + 1);
    return win.findBox;
  };
  assert.equal(openOn('Daggerfall'), null, ':450 - the place the player is already standing in is not offered');
  assert.ok(openOn('Wayrest'), '...and a place elsewhere still is');

  // THE ONE RECORDED ABSENCE, narrowed to the map: DfTravelMapWindow is
  // world.js's window, so `gotoPlace` (:214-217) and its `canFindPlace`
  // (:1134-1146) - both members of THAT window - are the only halves
  // this route leaves unset, which is the same nothing a CanFindPlace
  // miss produces in C#.
  assert.doesNotMatch(SRC, /gotoPlace:/, 'this route hangs no travel map on the journal');
  assert.doesNotMatch(SRC, /canFindPlace:/);
  assert.match(SRC, /this route mounts no travel map \(DfTravelMapWindow\n\s*\*\s*is world\.js's\)/,
    'and the absence is recorded in one sentence naming the map, at the seam');
});

test('QX1 review: the bridge asks IsPlayerInTown(true, true), and the hostility walk is the UNNARROWED database', () => {
  // GivePc.cs:84 and its siblings pass BOTH optional flags, so a quest
  // item handed over inside a shop pends instead of landing in the
  // pack. The seam is the closure S40 gave this host, not the bare
  // location-type test - which has its own, different caller below.
  // ROAD-G G2: the hostility door is `_makeEnemiesHostile` now, the
  // host's ONE named walk over its whole live database - this pin held
  // an inline spread that named the watch alone above ground, which
  // stopped being the whole database when the encounter pool landed.
  // roadb_hostility.test.js holds the join itself; here it is the
  // door, and the narrow walk beside it that must NOT follow.
  assert.match(SRC, /\n {4}makeEnemiesHostile: _makeEnemiesHostile,\n/);
  assert.match(SRC, /\n {4}isPlayerInTown: \(\) => _isPlayerInTownStrict\(\),\n/,
    'the bridge ctx takes the STRICT closure');
  assert.match(SRC, /\n {4}inTownLocation: \(\) => isPlayerInTown\(_musicLocationType\(\)\),\n/,
    'and CanRest\'s second arm keeps the flagless form - two questions, two seams');

  // ...and that closure, RUN, over the real PlayerGPS.IsPlayerInTown.
  const strict = new Function('_musicInLocationRect', 'isPlayerInTown', '_musicLocationType', 'modes',
    `${slice('  const _isPlayerInTownStrict = () =>', '  const outdoorRestDeps = createRestDeps(')} return _isPlayerInTownStrict;`);
  const mk = (mode, inRect = true, locType = 8) => strict(() => inRect, isPlayerInTown, () => locType, { mode })();
  assert.equal(mk('exterior'), true, 'in a town, outdoors');
  assert.equal(mk('interior'), false, 'mustBeOutside: standing in a shop is NOT "in town" to GivePc');
  assert.equal(mk('dungeon'), false);
  assert.equal(mk('exterior', false), false, 'mustBeInLocationRect: outside the rect is outside the town');

  // ROAD-B / GameManager.MakeEnemiesHostile (:790-806) walks the WHOLE
  // active enemy database; only questFoeInstances asks the narrowed
  // question. Wired to `liveQuestFoes`, `enemies makehostile` flipped
  // nothing but quest-spawned foes in a mounted mode.
  assert.match(SRC, /const _liveEnemyDatabase = \(\) => \[\n\s*\.\.\.exteriorFoes\.foes, \.\.\.cityGuards\.guards, \.\.\.\(modes\?\.insideFoes\?\.\(\) \?\? \[\]\),\n\s*\];/);
  assert.match(SRC, /return \[\.\.\.exteriorFoes\.foes, \.\.\.cityGuards\.guards, \.\.\.\(modes\?\.liveQuestFoes\?\.\(\) \?\? \[\]\)\]\.filter\(/,
    'and the NARROWED walk keeps its own caller - both street pools, but only the behaviour carriers');
});

test('QX1: the pause window\'s Quests tab reads the machine, and BOTH pauses read the same walk', () => {
  // The PX3 site itself: the flag's refusal is gone and the two walks
  // are handed over by name.
  assert.equal(/PX3 FLAGGED/.test(SRC), false, 'the PX3 flag is retired, not merely edited');
  assert.match(SRC, /PX3 SHIPPED \(QX1\)/, 'and its site records what shipped, quoting what it retired');
  assert.match(SRC, /questMessages: pauseQuestMessages,\n\s*questLog: pauseQuestLog,/,
    'the host\'s own pause hands both walks over');
  // ...and the mode machine's INTERIOR pause reads the SAME two, so a
  // pause in a tavern is not a different journal (worldModes reads
  // host.pauseQuestMessages / host.pauseQuestLog).
  assert.match(SRC, /\n {4}pauseQuestMessages, pauseQuestLog,\n/,
    'the interior pause takes the same two expressions');
  // ...and the character sheet's LOGBOOK button, which charSheetHooks
  // withholds unless both hooks were handed over.
  assert.match(SRC, /\n {4}\.\.\.questJournalHooks\(\),\n/);

  // THE WALK, RUN. Nothing here is retyped: this is the shipped
  // expression, driven against a machine.
  const body = slice('  const questJournalHooks = () => (questBridge ? {',
    "  if (!playerEntity.chargenDone && params.has('class')) {");
  const mount = (bridge) => new Function('questBridge', 'dfLocation', 'locationName',
    `${body} return { questJournalHooks, pauseQuestLog, pauseQuestMessages };`)(bridge, dfLocationStub(), 'Daggerfall');

  // No bridge yet (a sheet opened during chargen): the hooks are the
  // EMPTY object, so the LOGBOOK button is withheld rather than opened
  // onto a log nothing can fill, and the rail is empty.
  const cold = mount(null);
  assert.deepEqual(cold.questJournalHooks(), {});
  assert.deepEqual(cold.pauseQuestMessages(), []);
  assert.deepEqual(cold.pauseQuestLog(), { active: [], finished: [] });

  const withLog = {
    uid: 5, displayName: 'A Small Debt', questName: '_BRISIEN',
    getLogMessages: () => [{ messageID: 1010 }, { messageID: 1020 }],
    getMessage: (id) => ({ id }),
    resources: new Map([
      ['clock_a', { clockEnabled: true, clockFinished: false, remainingTimeInSeconds: 600 }],
      ['clock_b', { clockEnabled: true, clockFinished: false, remainingTimeInSeconds: 120 }],
      ['clock_c', { clockEnabled: true, clockFinished: true, remainingTimeInSeconds: 1 }],
      ['not_a_clock', { clockEnabled: false, remainingTimeInSeconds: 2 }],
    ]),
  };
  const silent = { uid: 6, questName: '_TUTOR__', getLogMessages: () => [], resources: new Map() };
  const bridge = {
    machine: {
      quests: new Map([[5, withLog], [6, silent]]),
      getAllQuestLogMessages: () => ['entry-a', 'entry-b'],
    },
    notebook: { getFinishedQuests: () => ['a finished one'] },
  };
  const live = mount(bridge);

  assert.deepEqual(live.pauseQuestMessages(), ['entry-a', 'entry-b'],
    'the flat F5 seam is GetAllQuestLogMessages, not a refusal');
  // ROAD-G G2 added the third: HandleQuestClicks' current-location
  // question, which this route answers outright.
  assert.deepEqual(Object.keys(live.questJournalHooks()).sort(),
    ['currentLocationName', 'notebook', 'questMessages']);
  assert.deepEqual(live.questJournalHooks().questMessages(), ['entry-a', 'entry-b']);

  const log = live.pauseQuestLog();
  assert.equal(log.active.length, 1, 'a quest that has written no log entry has no rail row');
  assert.deepEqual(log.active[0].messages, [{ id: 1010 }, { id: 1020 }]);
  assert.equal(log.active[0].id, '5');
  assert.equal(log.active[0].name, 'A Small Debt');
  assert.equal(log.active[0].questName, '_BRISIEN');
  assert.equal(log.active[0].clockSeconds, 120,
    'the SHORTEST live clock - a finished or disabled one is not a timer');
  assert.deepEqual(log.finished, ['a finished one']);
});

test('QX1: every surface that recorded "no quest bridge" reads the machine now', () => {
  // Each of these was its own sentence in exterior.js saying the host
  // had no machine to ask. One construction under all of them - and
  // this is the pin that stops any being reverted alone.
  assert.match(SRC, /tickQuests: \(\) => questBridge\?\.machine\?\.tick\?\.\(\),/, 'TickRest :379');
  assert.match(SRC, /getQuest: \(uid\) => questBridge\?\.machine\?\.getQuest\?\.\(uid\) \?\? null,/, 'the quest letter\'s name');
  assert.match(SRC, /statusInfoRows\(rows, questBridge\?\.machine\?\.macroContext\?\.\(\) \?\? null\)/, 'record 22\'s macros');
  assert.match(SRC, /stampResidenceQuestNames\(summaries, discoveredBuildings\(locId\), \{/, 'the residence plates');
  assert.match(SRC, /\n {4}questBridge,\n/, 'the bridge rides into the mode machine - mountScene over this city');
  assert.match(SRC, /if \(!_overlayHeld\) questBridge\?\.tick\(dt\);/, 'QuestMachine.Update, behind the pause gate');
  assert.match(SRC, /questBridge\.onInitWorld\(\);/, 'OnInitWorld - this route\'s one city IS its world');
  assert.match(SRC, /questInitAtGameStart\(\);   \/\/ QX1: OnStartGame for the new character/, 'StartGameBehaviour :445-447');

  // ...AND THE TWO IN-TREE SENTENCES THAT STILL SAID OTHERWISE. Both
  // sit in files this host reads from, and both were the same claim -
  // "`?exterior` has no quest machine" - which QX1 made false. A reader
  // trusting either would have re-derived the wrong reason for a real
  // remainder (the static-NPC pass) or for an empty plate.
  const wm = readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8');
  assert.equal(/`scenes\/exterior\.js` mounts no quest bridge/.test(wm), false,
    'worldModes\' static-NPC note no longer says the fixed-city host has no bridge');
  assert.match(wm, /`scenes\/exterior\.js` mounts a quest bridge now\n\s*\/\/ \(QX1\) but not at LAYOUT/,
    '...it names the real reason: a bridge, but not one that exists at layout');
  const eaw = readFileSync(new URL('../src/ui/exteriorAutomapWindow.js', import.meta.url), 'utf8');
  assert.equal(/a host with no quest machine at all/.test(eaw), false,
    'the automap window no longer describes this host as machine-less');
  assert.match(eaw, /BOTH\n\s+\*    exterior hosts stamp/,
    '...both exterior hosts stamp, and the plate arm says which of the three source arms `?exterior` is missing');
});

test('QX1: the journal doors U43 left hanging finally have something to open', () => {
  // `preloadQuestJournalArt` has been imported by this file since U43
  // with NO CALLER, because the host had no machine to fill a journal
  // from. One builder, four doors: L, N, the sheet's LOGBOOK button and
  // the pause window's Chronicle - plus the interior arm, which reads
  // `host.makeJournal` and nothing else.
  //
  // AND THE ORDER IS THE LAW. The classic arm of the chronicle door IS
  // the art gate (chronicleDoor.js `if (!questJournalArtLoaded())
  // return null`), so a `chronicleDoorReady()` test placed AHEAD of the
  // preload that satisfies it can never pass on the classic skin: the
  // warm behind the gate never runs. Warm first, then let the door
  // refuse - dungeonContext.js's shape.
  assert.match(SRC, /const makeJournalWindow = \(mode\) => \{\n\s*if \(!questBridge\) return null;\n(?:\s*\/\/[^\n]*\n)*\s*preloadQuestJournalArt\(\{ renderer, fetchBytes, palette \}\);/,
    'no bridge answers null; the ART is warmed before anything asks whether it is warm');
  assert.equal(/chronicleDoorReady/.test(SRC), false,
    'the gate is the door\'s own - this host neither imports nor asks it');
  // ...and the boot warm, so the FIRST L / N / Chronicle press opens a
  // book rather than losing the race with a fire-and-forget preload.
  assert.match(SRC, /preloadQuestJournalArt\(\{ renderer, fetchBytes, palette \}\);   \/\/ U43: LGBK00I0 warms at boot/);
  assert.match(SRC, /toggleLogbook: \(\) => \{ const w = makeJournalWindow\('activeQuests'\);/);
  assert.match(SRC, /toggleNotebook: \(\) => \{ const w = makeJournalWindow\('notebook'\);/);
  assert.match(SRC, /if \(act === 'LogBook'\) \{ e\.preventDefault\(\); hudCtx\.toggleLogbook\(\); return; \}/);
  assert.match(SRC, /if \(act === 'NoteBook'\) \{ e\.preventDefault\(\); hudCtx\.toggleNotebook\(\); return; \}/);
  assert.match(SRC, /openChronicle: \(\) => \{ const w = makeJournalWindow\('notebook'\); if \(w\) townTalk\.showOverlay\(w\); \},/);
  assert.match(SRC, /makeJournal: \(mode\) => makeJournalWindow\(mode\),/, 'and the interior arm\'s own door');
  // ONE window, through the chronicle DOOR - never a second
  // construction of the classic journal beside it.
  assert.equal(/new QuestJournalWindow\(/.test(SRC), false, 'the door picks the skin, the host does not');
});

// ───────────────────────── TP2: the Recall anchor ─────────────────────────

/** TEXT.RSC record 4001 as the reader answers it: ROWS, not strings. */
const RSC = new Map([[ANCHOR_MUST_BE_SET, [{ text: 'An Anchor must be set before you can Teleport.', center: true }]]]);

/** Mount the host's SHIPPED Recall block on stubs. */
function mountRecall({ anchorContext, insideContext, mode = 'exterior', startInDungeon = null, restoreInterior = null } = {}) {
  const body = slice('  const _anchorRect = locationWorldRect(', '  const magic = createPlayerMagic({');
  const dfLocation = {
    name: 'Daggerfall',
    exterior: { exteriorData: { width: 8, height: 8, blockNames: ['MAGEAA00.RMB'] } },
  };
  const calls = [];
  const player = { pos: [100, 5, 200], spawn: (...a) => { calls.push(['spawn', ...a]); player.pos = [...a]; }, eyeAt: () => [1, 2, 3] };
  const cam = { pos: [0, 0, 0], yaw: 1.25, pitch: -0.5 };
  const playerEntity = { anchorPosition: null };
  const modes = {
    get mode() { return mode; },
    anchorContext: anchorContext ?? (() => ({ worldContext: WORLD_CONTEXT.Exterior, local: null, buildingKey: 0, interior: null })),
    insideContext: insideContext ?? (() => ({ insideBuilding: false, insideDungeon: false, buildingKey: 0 })),
    setPlayerLocalPosition: (p) => calls.push(['setPlayerLocalPosition', p]),
    forceExitToExterior: (o) => calls.push(['forceExitToExterior', o]),
    startInDungeon: startInDungeon ?? (async () => { calls.push(['startInDungeon']); return false; }),
    restoreInterior: restoreInterior ?? (async (...a) => { calls.push(['restoreInterior', ...a]); return false; }),
  };
  const said = [];
  const townTalk = {
    say: (l) => said.push(l),
    showOverlay: (w) => calls.push(['overlay', w]),
    lines: (id) => RSC.get(id) ?? null,   // the same TEXT.RSC door every other box in this host reads
  };
  const api = new Function(
    'locationWorldRect', 'GLOBAL_SCALE', 'GROUND_OFFSET', 'WORLD_CONTEXT', 'makeAnchor', 'teleportPlan',
    'ANCHOR_MUST_BE_SET', 'ActionTextBox', 'plainLines',
    'dfLocation', 'locationName', '_locPixel', 'walkMode', 'player', 'cam', 'playerEntity',
    'townTalk', 'surfacePlayer', 'ChoiceWindow', 'modes',
    `${body} return { setRecallAnchor, recallToAnchor, teleportPrompt, anchorLanding };`,
  )(locationWorldRect, GLOBAL_SCALE, GROUND_OFFSET, WORLD_CONTEXT, makeAnchor, teleportPlan,
    ANCHOR_MUST_BE_SET, ActionTextBox, plainLines,
    dfLocation, 'Daggerfall', { x: 207, y: 213 }, true, player, cam, playerEntity,
    townTalk, () => calls.push(['surfacePlayer']), function ChoiceWindow(o) { Object.assign(this, o); }, modes);
  return { ...api, calls, said, player, cam, playerEntity, modes };
}

/** The one box this host raised, if it raised one. */
const lastBox = (h) => h.calls.filter((c) => c[0] === 'overlay').at(-1)?.[1] ?? null;

test('TP2: SET ANCHOR works in this host, and the landing is the anchor\'s own native frame', () => {
  const h = mountRecall();
  h.setRecallAnchor();
  const a = h.playerEntity.anchorPosition;
  assert.ok(a, 'SetAnchor (Teleport.cs:100-117) needs a position and a context, both of which this host has');
  assert.equal(a.worldContext, WORLD_CONTEXT.Exterior);
  assert.deepEqual(a.pixel, { x: 207, y: 213 }, 'the location\'s own map pixel');
  assert.equal(a.yaw, 1.25);
  assert.equal(a.pitch, -0.5);
  // The natives are stated in the STREAMING host's frame - the
  // location's world rect - not a private one, and the landing is the
  // exact inverse, so a recall lands where the anchor was set.
  const rect = locationWorldRect({ exterior: { exteriorData: { width: 8, height: 8, blockNames: ['MAGEAA00.RMB'] } } }, 207, 213);
  assert.equal(a.nativeX, rect.minX + 100 / GLOBAL_SCALE);
  assert.equal(a.nativeZ, rect.minZ + 200 / GLOBAL_SCALE);
  assert.deepEqual(h.anchorLanding(a), [100, 5, 200], 'native -> scene is the inverse of scene -> native');
});

test('TP2: the 4001 refusal, and the 4000 box\'s two arms', () => {
  const h = mountRecall();
  h.recallToAnchor();
  // TEXT.RSC record 4001, verbatim, in DFU's ClickAnywhereToClose box
  // (:268-275) - not a HUD line and not a paraphrase of the record.
  const refusal = lastBox(h);
  assert.ok(refusal instanceof ActionTextBox, 'the 4001 box is a BOX, the same shape record 4000 raises');
  assert.deepEqual(refusal.lines, ['An Anchor must be set before you can Teleport.'],
    'TEXT.RSC record 4001, verbatim (Internal_RSC.csv:4821)');
  assert.deepEqual(h.said, [], 'and nothing is muttered at the HUD beside it');
  assert.equal(h.calls.filter((c) => c[0] !== 'overlay').length, 0,
    'nothing is torn down for an anchor that does not exist');

  h.teleportPrompt();
  const box = lastBox(h);
  assert.ok(box, 'PromptPlayer (:81-98) raises a window in THIS host\'s slot');
  assert.deepEqual(box.lines, ['Do you want to Teleport or Set an Anchor?'], 'TEXT.RSC record 4000, verbatim');
  assert.deepEqual(box.options.map((o) => o.code), ['KeyA', 'KeyT', 'Escape']);

  // ...and WHICH ARM each key runs, BY RUNNING IT. The codes alone are
  // satisfied by a box whose two closures are swapped.
  box.options[0].action();
  assert.ok(h.playerEntity.anchorPosition, 'A is SetAnchor (:100-117)');
  assert.equal(lastBox(h), box, '...and raises no box of its own');

  h.playerEntity.anchorPosition = null;
  box.options[1].action();
  assert.deepEqual(lastBox(h).lines, ['An Anchor must be set before you can Teleport.'],
    'T is the recall - here with no anchor, so the 4001 box');
  assert.equal(h.playerEntity.anchorPosition, null, '...and T sets none');

  const before = h.calls.length;
  box.options[2].action();
  assert.equal(h.calls.length, before, 'Esc is AllowCancel - it runs neither arm');
  assert.equal(h.playerEntity.anchorPosition, null);
});

test('TP2: the SAME-INTERIOR arm just moves the player (:129-134) - nothing is torn down', async () => {
  const inside = { worldContext: WORLD_CONTEXT.Interior, local: null, buildingKey: 9, interior: { door: { blockIndex: 1 } } };
  const h = mountRecall({
    mode: 'interior',
    anchorContext: () => inside,
    insideContext: () => ({ insideBuilding: true, insideDungeon: false, buildingKey: 9 }),
  });
  h.setRecallAnchor();
  h.player.pos = [400, 5, 400];
  await h.recallToAnchor();
  assert.deepEqual(h.calls.filter((c) => c[0] === 'setPlayerLocalPosition')[0][1], [100, 5, 200]);
  assert.equal(h.calls.some((c) => c[0] === 'forceExitToExterior'), false,
    '"Just need to move player" - the room you stand in IS the anchor\'s room');
  assert.equal(h.playerEntity.anchorPosition, null, 'consumed on arrival (:133)');
});

test('TP2: the CROSS-CONTEXT arm inside the loaded pixel really runs - the exit, then the landing', async () => {
  // Anchor set in the street, cast from inside a shop: DFU caches the
  // interior it is leaving (:145-151) and lands at the anchor.
  let mode = 'exterior';
  const h = mountRecall({
    get mode() { return mode; },
    insideContext: () => ({ insideBuilding: mode === 'interior', insideDungeon: false, buildingKey: 9 }),
  });
  h.setRecallAnchor();
  mode = 'interior';
  Object.defineProperty(h.modes, 'mode', { get: () => mode, configurable: true });
  h.player.pos = [0, 0, 0];
  await h.recallToAnchor();
  const exit = h.calls.find((c) => c[0] === 'forceExitToExterior');
  assert.ok(exit, 'a cast inside a mode leaves it first (:151)');
  assert.deepEqual(exit[1], { cacheScene: true }, 'CacheScene(Interior.name) - the same write the real door makes');
  assert.deepEqual(h.calls.find((c) => c[0] === 'spawn').slice(1), [100, 5, 200], 'the exterior landing');
  assert.equal(h.cam.yaw, 1.25, 'the pose rides the transform (:242)');
  assert.equal(h.playerEntity.anchorPosition, null);
});

test('TP2 review: the cacheScene three-way, the mode gate and the re-entrancy guard', async () => {
  // (1) INSIDE A DUNGEON, DFU caches NOTHING and takes
  // TransitionDungeonExteriorImmediate (:151), so the flag is false -
  // a constant `true` here would cache a scene that does not exist.
  let mode = 'exterior';
  let inDungeon = false;
  const h = mountRecall({
    insideContext: () => ({ insideBuilding: false, insideDungeon: inDungeon, buildingKey: 0 }),
  });
  h.setRecallAnchor();
  mode = 'dungeon';
  inDungeon = true;
  Object.defineProperty(h.modes, 'mode', { get: () => mode, configurable: true });
  await h.recallToAnchor();
  assert.deepEqual(h.calls.find((c) => c[0] === 'forceExitToExterior')[1], { cacheScene: false });

  // (2) THE MODE GATE. A cast taken OUTSIDE has no mode to leave.
  const out = mountRecall({
    anchorContext: () => ({ worldContext: WORLD_CONTEXT.Interior, local: null, buildingKey: 9, interior: { door: { blockIndex: 1 } } }),
    insideContext: () => ({ insideBuilding: false, insideDungeon: false, buildingKey: 0 }),
  });
  out.setRecallAnchor();
  await out.recallToAnchor();
  assert.equal(out.calls.some((c) => c[0] === 'forceExitToExterior'), false,
    'the exterior arm of the gate - nothing is exited when nothing is mounted');

  // (3) THE RE-ENTRANCY GUARD. A second cast while the first is parked
  // on the dungeon mount must not run the exit and the landing twice.
  let m2 = 'exterior';
  const re = mountRecall({
    anchorContext: () => ({ worldContext: WORLD_CONTEXT.Dungeon, local: [11, 22, 33], buildingKey: 0, interior: null }),
    insideContext: () => ({ insideBuilding: m2 === 'interior', insideDungeon: false, buildingKey: 9 }),
    startInDungeon: async () => true,
  });
  re.setRecallAnchor();
  m2 = 'interior';
  Object.defineProperty(re.modes, 'mode', { get: () => m2, configurable: true });
  await Promise.all([re.recallToAnchor(), re.recallToAnchor()]);
  assert.equal(re.calls.filter((c) => c[0] === 'forceExitToExterior').length, 1,
    'the guard (exterior.js\'s `if (_recalling) return`) - one cast, one teardown');
  assert.equal(re.calls.filter((c) => c[0] === 'setPlayerLocalPosition').length, 1, '...and one landing');
});

test('TP2: a BUILDING anchor takes restoreInterior, and a missing door is DFU\'s reposition arm', async () => {
  const seen = [];
  const h = mountRecall({
    anchorContext: () => ({ worldContext: WORLD_CONTEXT.Interior, local: null, buildingKey: 9, interior: { door: { blockIndex: 1 } } }),
    insideContext: () => ({ insideBuilding: false, insideDungeon: false, buildingKey: 0 }),
    restoreInterior: async (saved, pos) => { seen.push([saved, pos]); return false; },
  });
  h.setRecallAnchor();
  await h.recallToAnchor();
  assert.equal(seen.length, 1, ':632-643 - "Start in building", off the anchor\'s own exteriorDoors');
  assert.deepEqual(seen[0][0], { door: { blockIndex: 1 } });
  assert.deepEqual(seen[0][1], [100, 5, 200]);
  assert.deepEqual(h.said, ['Building has no exterior doors. Repositioning player.'],
    'RestorePositionHelper\'s reposition arm (:615-620) says so');
  assert.deepEqual(h.calls.find((c) => c[0] === 'spawn').slice(1), [100, 5, 200],
    '...and it really repositions - the arm is a landing, not just a line of text');
});

test('TP2: a DUNGEON anchor takes the mount, and its `local` IS the landing', async () => {
  const h = mountRecall({
    anchorContext: () => ({ worldContext: WORLD_CONTEXT.Dungeon, local: [11, 22, 33], buildingKey: 0, interior: null }),
    insideContext: () => ({ insideBuilding: false, insideDungeon: false, buildingKey: 0 }),
    startInDungeon: async () => true,
  });
  h.setRecallAnchor();
  await h.recallToAnchor();
  assert.deepEqual(h.calls.find((c) => c[0] === 'setPlayerLocalPosition')[1], [11, 22, 33],
    'a dungeon\'s frame is its own, rebuilt at the same origin every mount');
  assert.equal(h.playerEntity.playerTeleportedIntoDungeon, true, ':246');
});

test('TP2 review: a FAILED dungeon mount still repositions - the cast may have torn down the room it was made in', async () => {
  // Cast from inside a shop at a dungeon anchor this location has no
  // entrance for: the interior is already exited by the time the mount
  // refuses, so leaving the player where they stood leaves them inside
  // a building shell. DFU's "all else fails" arm (RespawnPlayer
  // :548-553) teleports to the map pixel's own origin.
  let mode = 'exterior';
  const h = mountRecall({
    anchorContext: () => ({ worldContext: WORLD_CONTEXT.Dungeon, local: [11, 22, 33], buildingKey: 0, interior: null }),
    insideContext: () => ({ insideBuilding: mode === 'interior', insideDungeon: false, buildingKey: 9 }),
    startInDungeon: async () => false,
  });
  h.setRecallAnchor();
  mode = 'interior';
  Object.defineProperty(h.modes, 'mode', { get: () => mode, configurable: true });
  h.player.pos = [400, 5, 400];
  await h.recallToAnchor();
  assert.ok(h.calls.some((c) => c[0] === 'forceExitToExterior'), 'the room was left');
  assert.deepEqual(h.said, ['The way underground is closed. Repositioning player.']);
  const spawn = h.calls.find((c) => c[0] === 'spawn');
  assert.ok(spawn, 'the unlanded dungeon arm repositions like every other unlanded arm');
  assert.deepEqual(spawn.slice(1), [0, GROUND_OFFSET * 0.025 + 2, 0],
    'the LOCATION rect\'s origin at this host\'s ground height - never the anchor\'s dungeon-frame `local`');
  assert.equal(h.playerEntity.anchorPosition, null, 'the cast is spent either way');
});

test('TP2 INTERIM: the ONE arm this host cannot take refuses BY NAME, and keeps the anchor', async () => {
  // Each half of the pixel test decides ON ITS OWN: an anchor sharing
  // this city's x but not its y is still another map pixel, and an
  // anchor differing in both is satisfied by either half alone.
  for (const pixel of [{ x: 207, y: 100 }, { x: 100, y: 213 }]) {
    const h = mountRecall();
    // An anchor set in another city - the only thing `?exterior` cannot
    // arrive at, because arriving is StreamingWorld's job.
    h.playerEntity.anchorPosition = makeAnchor({
      worldContext: WORLD_CONTEXT.Exterior, pixel,
      nativeX: 0, nativeZ: 0, y: 3, yaw: 0, pitch: 0,
    });
    await h.recallToAnchor();
    assert.equal(h.said.length, 1, `pixel ${pixel.x},${pixel.y}`);
    assert.match(h.said[0], /Recall cannot leave Daggerfall here/, 'the refusal names the city it cannot leave');
    assert.match(h.said[0], /another location/, '...and the reason');
    assert.match(h.said[0], /streaming \?world host/, '...and where the arm does live');
    assert.equal(h.calls.length, 0, 'nothing is torn down for a jump that cannot be made');
    assert.ok(h.playerEntity.anchorPosition, 'the anchor SURVIVES - the world host can still use it');
  }

  // ...and the flag is narrowed to exactly that sentence, at its own
  // line, so tools/regenOpenFlags.mjs lists the arm and not the spell.
  const flag = SRC.split('\n').find((l) => l.includes('TP2 INTERIM'));
  assert.ok(flag, 'the narrowed flag has its own line for the harvest');
  assert.match(flag, /a jump to an anchor on ANOTHER map pixel/);
  assert.match(flag, /`\?exterior` loads ONE fixed city and runs no streamer/);
  assert.equal(/Recall pends here/.test(SRC), false, 'the whole-spell refusal is gone');
});
