// S40: CanRest - where the player is allowed to sleep, and what it
// costs when they are not. DaggerfallRestWindow.CanRest (:542-599),
// MoveToBed (:601-609), and the IllegalRestWarning confirm the WHILE
// and HEALED buttons raise ahead of both (:641-692).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  canRest, CITY_CAMPING_ILLEGAL_ID, HAVE_NOT_RENTED_ROOM,
  ILLEGAL_REST_WARNING, illegalRestWarning,
  restOpenGate, REST_TEXT, RestSession, EXPIRED_RENTED_ROOM,
} from '../src/systems/restSession.js';
import { RestWindow } from '../src/ui/restWindow.js';
import { restVitals, restFullyHealed, createRestDeps } from '../src/scenes/shared.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { isTownLocationType, TOWN_LOCATION_TYPES, LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { interiorSceneName } from '../src/systems/sceneCache.js';
import { setValue, _resetForTests } from '../src/systems/settings.js';
import { maxFatigue } from '../src/systems/statMods.js';
import { RAPID_HEALING, healthRecoveryRate } from '../src/systems/rest.js';
import { REST_WAIT_PER_HOUR } from '../src/systems/restSession.js';
import { SKILLS } from '../src/systems/skills.js';
import { startRestGroundedCheck, CAPSULE_HEIGHT } from '../src/player/motor.js';
import { areEnemiesNearby } from '../src/systems/encounters.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// ---- the LAW ---------------------------------------------------------

test('S40 canRest: in town and OUTDOORS - the crime lands either way, the refusal only unwarned', () => {
  const cold = canRest({ inTownStrict: true });
  // CloseWindow() + MessageBox(cityCampingIllegal), and NO rest.
  assert.equal(cold.ok, false);
  assert.equal(cold.textId, CITY_CAMPING_ILLEGAL_ID);
  // ...but the crime is registered anyway. This is the quirk: being
  // turned away still puts guards on the street.
  assert.equal(cold.crime, 'Vagrancy');
  assert.equal(cold.spawnGuards, true);

  // `alreadyWarned` is the CONFIRM BOX's Yes, not a second keypress.
  const warned = canRest({ inTownStrict: true, alreadyWarned: true });
  assert.equal(warned.ok, true);
  assert.equal(warned.textId, null);      // no message box on this path
  assert.equal(warned.crime, 'Vagrancy'); // still a crime
  assert.equal(warned.spawnGuards, true);

  // Neither path allocates a bed - you are sleeping in the street.
  for (const d of [cold, warned]) {
    assert.equal(d.allocatedBed, null);
    assert.equal(d.remainingHoursRented, -1);
  }
});

test('S40 canRest: the strict arm WINS over the inside arm, and outside a town rest is free', () => {
  // DFU's chain is if/else-if: inTownStrict short-circuits, so the
  // building fields are never even read.
  const d = canRest({
    inTownStrict: true, inTown: true, insideBuilding: true,
    buildingType: BUILDING_TYPES.Tavern, guildCanRest: () => true,
  });
  assert.equal(d.ok, false);
  assert.equal(d.textId, CITY_CAMPING_ILLEGAL_ID);

  // The tail: wilderness, dungeon, anywhere that is not a town.
  const wild = canRest({ inTownStrict: false, inTown: false, insideBuilding: false });
  assert.deepEqual(
    { ok: wild.ok, crime: wild.crime, spawnGuards: wild.spawnGuards, bed: wild.allocatedBed },
    { ok: true, crime: null, spawnGuards: false, bed: null });
  // In a town but INSIDE nothing (standing on a street the rect test
  // missed) is the same tail - both halves of the && are required.
  assert.equal(canRest({ inTown: true, insideBuilding: false }).ok, true);
  assert.equal(canRest({ inTown: false, insideBuilding: true }).ok, true);
});

const ROOM_PLACE = (over = {}) => ({
  inTown: true, insideBuilding: true, mapId: 17, buildingKey: 4200,
  buildingType: BUILDING_TYPES.Tavern, nowMinutes: 1000,
  isPermanentScene: (n) => n === interiorSceneName(17, 4200),
  rentedRoom: () => ({ allocatedBedIndex: 2, expiryMinutes: 1000 + 60 * 30 }),
  restMarkers: ['bed0', 'bed1', 'bed2', 'bed3'],
  ...over,
});

test('S40 canRest: a live rented room sleeps, in the bed that was SOLD', () => {
  const d = canRest(ROOM_PLACE());
  assert.equal(d.ok, true);
  assert.equal(d.crime, null);
  // GetRemainingHours: ceil((expiry - now)/60) = 30
  assert.equal(d.remainingHoursRented, 30);
  // The marker is relinked BY INDEX - allocatedBedIndex 2.
  assert.equal(d.allocatedBed, 'bed2');
});

test('S40 canRest: the bed index falls back to 0 out of range, and the hour count CEILS', () => {
  assert.equal(canRest(ROOM_PLACE({
    rentedRoom: () => ({ allocatedBedIndex: 9, expiryMinutes: 1000 + 60 }),
  })).allocatedBed, 'bed0');
  assert.equal(canRest(ROOM_PLACE({
    rentedRoom: () => ({ allocatedBedIndex: -1, expiryMinutes: 1000 + 60 }),
  })).allocatedBed, 'bed0');
  // The bound is EXCLUSIVE (`< restMarkers.Length`), so an index equal
  // to the count falls back too - `<=` would read one past the end.
  assert.equal(canRest(ROOM_PLACE({
    rentedRoom: () => ({ allocatedBedIndex: 4, expiryMinutes: 1000 + 60 }),
  })).allocatedBed, 'bed0');
  // ...and the LAST valid index is still itself.
  assert.equal(canRest(ROOM_PLACE({
    rentedRoom: () => ({ allocatedBedIndex: 3, expiryMinutes: 1000 + 60 }),
  })).allocatedBed, 'bed3');
  // One minute left still reads as ONE hour, and one hour still sleeps.
  const d = canRest(ROOM_PLACE({ rentedRoom: () => ({ allocatedBedIndex: 0, expiryMinutes: 1001 }) }));
  assert.equal(d.remainingHoursRented, 1);
  assert.equal(d.ok, true);
});

test('S40 canRest: an EXPIRED room in a held scene refuses - and says which line', () => {
  const d = canRest(ROOM_PLACE({
    rentedRoom: () => ({ allocatedBedIndex: 1, expiryMinutes: 1000 }),   // 0 hours left
  }));
  assert.equal(d.ok, false);
  assert.equal(d.text, HAVE_NOT_RENTED_ROOM);
  assert.equal(d.remainingHoursRented, 0);
  // DFU sets allocatedBed BEFORE the remaining-hours test, so the
  // refusal still carries it. Nothing reads it, and that is faithful.
  assert.equal(d.allocatedBed, 'bed1');
  // No crime indoors, ever.
  assert.equal(d.crime, null);
  assert.equal(d.spawnGuards, false);
});

test('S40 canRest: a SHIP and an owned house sleep outright, with no room and no bed', () => {
  const ship = canRest(ROOM_PLACE({
    buildingType: BUILDING_TYPES.Ship,
    rentedRoom: () => { throw new Error('the ship arm must return BEFORE the room lookup'); },
  }));
  assert.equal(ship.ok, true);
  assert.equal(ship.remainingHoursRented, -1);
  assert.equal(ship.allocatedBed, null);

  const house = canRest(ROOM_PLACE({
    buildingType: BUILDING_TYPES.House2,
    isHouseOwned: (k) => k === 4200,
    rentedRoom: () => { throw new Error('an owned house needs no rental'); },
  }));
  assert.equal(house.ok, true);
});

test('S40 canRest: a building that is NOT a held scene skips the room arm entirely', () => {
  const d = canRest(ROOM_PLACE({
    isPermanentScene: () => false,
    rentedRoom: () => { throw new Error('no held scene, no room lookup'); },
  }));
  assert.equal(d.ok, false);
  assert.equal(d.text, HAVE_NOT_RENTED_ROOM);
  assert.equal(d.remainingHoursRented, -1);
  assert.equal(d.allocatedBed, null);
});

test('S40 canRest: THE TAVERN EXCLUSION - the guild arm skips inns', () => {
  const base = {
    inTown: true, insideBuilding: true, isPermanentScene: () => false,
    guildCanRest: () => true, restMarkers: ['hallBed', 'other'],
  };
  // Every tavern in the data carries the fighters-guild faction, so
  // without this a Fighters Guild member sleeps free in every inn.
  const inn = canRest({ ...base, buildingType: BUILDING_TYPES.Tavern });
  assert.equal(inn.ok, false);
  assert.equal(inn.text, HAVE_NOT_RENTED_ROOM);

  // The hall itself: FindMarker (singular) takes the FIRST rest marker.
  const hall = canRest({ ...base, buildingType: BUILDING_TYPES.GuildHall });
  assert.equal(hall.ok, true);
  assert.equal(hall.allocatedBed, 'hallBed');
  assert.equal(hall.remainingHoursRented, -1);

  // ...and a non-member in the same hall is turned away.
  assert.equal(canRest({ ...base, buildingType: BUILDING_TYPES.GuildHall, guildCanRest: () => false }).ok, false);
});

test('S40 canRest: the guild arm OVERWRITES the room bed with the first marker', () => {
  // FindMarker (singular) writes allocatedBed unconditionally, so the
  // hall bed replaces whatever the fallen-through room arm left there.
  const d = canRest(ROOM_PLACE({
    buildingType: BUILDING_TYPES.GuildHall,
    rentedRoom: () => ({ allocatedBedIndex: 2, expiryMinutes: 1000 }),
    guildCanRest: () => true,
  }));
  assert.equal(d.allocatedBed, 'bed0');
  assert.notEqual(d.allocatedBed, 'bed2');
});

test('S40 canRest: an expired room in a guild hall still sleeps, and keeps the room\'s hour count', () => {
  // The guild arm runs AFTER the room arm falls through, so
  // remainingHoursRented survives from it - DFU never resets it.
  const d = canRest(ROOM_PLACE({
    buildingType: BUILDING_TYPES.GuildHall,
    rentedRoom: () => ({ allocatedBedIndex: 3, expiryMinutes: 1000 }),
    guildCanRest: () => true,
  }));
  assert.equal(d.ok, true);
  assert.equal(d.remainingHoursRented, 0);
  assert.equal(d.allocatedBed, 'bed0');   // FindMarker overwrites with the first
});

test('S40 canRest: no rest markers at all answers no bed rather than throwing', () => {
  // OURS, and named as a deviation: DFU indexes restMarkers[bedIndex]
  // unguarded and would throw. Unreachable in DFU's data.
  const d = canRest(ROOM_PLACE({ restMarkers: [] }));
  assert.equal(d.ok, true);
  assert.equal(d.allocatedBed, null);
  const noRoom = canRest(ROOM_PLACE({ rentedRoom: () => null }));
  assert.equal(noRoom.ok, false);
  assert.equal(noRoom.remainingHoursRented, -1);
  assert.equal(noRoom.allocatedBed, 'bed0');
});

// ---- the TOWN TYPE SET ----------------------------------------------

test('S40: PlayerGPS.IsPlayerInTown counts SEVEN location types, not three', () => {
  for (const t of ['TownCity', 'TownHamlet', 'TownVillage', 'HomeFarms',
    'HomeWealthy', 'Tavern', 'ReligionTemple']) {
    assert.equal(isTownLocationType(LOCATION_TYPES[t]), true, t);
  }
  assert.equal(TOWN_LOCATION_TYPES.length, 7);
  // The four the old `locationType <= 2` read would have caught by
  // accident are the three towns; these must NOT be towns.
  for (const t of ['DungeonLabyrinth', 'DungeonKeep', 'ReligionCult',
    'DungeonRuin', 'HomePoor', 'Graveyard', 'Coven', 'HomeYourShips', 'None']) {
    assert.equal(isTownLocationType(LOCATION_TYPES[t]), false, t);
  }
  // ...and both outdoor hosts read it through the ONE law, not a
  // literal. The interior host does NOT: it is never the one that
  // knows the location type, so it asks its outer host through the
  // `inTownLocation` seam - which is the same law, one call away.
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(src(f), /isTownLocationType/, f);
  }
  assert.match(src('src/scenes/worldModes.js'), /inTown: host\.inTownLocation\?\.\(\) \?\? false/);
  assert.doesNotMatch(src('src/scenes/world.js'), /locationType\(\)\s*<=\s*2/);
});

// ---- the WINDOW ------------------------------------------------------

const winDeps = (over = {}) => ({
  advanceMinutes() {}, tickVitals: () => false, fullyHealed: () => false,
  enemiesNearby: () => false, dead: () => false,
  endLines: (id) => [`text:${id}`],
  ...over,
});

test('S40 RestWindow: no place seam at all rests freely (the dungeon host is unchanged)', () => {
  _resetForTests();
  const w = new RestWindow(winDeps());
  w.input('char:1');
  assert.equal(w.state, 'hours');
  const h = new RestWindow(winDeps());
  h.input('char:2');
  assert.equal(h.state, 'resting');
  assert.equal(h.mode, 'full');
});

test('S40 RestWindow: with the warning ON, camping in town is a Yes/No box', () => {
  _resetForTests();
  setValue('GUI', 'IllegalRestWarning', 'True');
  assert.equal(illegalRestWarning(), true);
  const crimes = [];
  const w = new RestWindow(winDeps({
    restPlace: () => ({ inTownStrict: true }),
    commitCrime: (c, sg) => crimes.push([c, sg]),
  }));
  w.input('char:1');
  // The box comes FIRST and does not touch CanRest - no crime yet.
  assert.equal(w.state, 'confirm');
  assert.deepEqual(crimes, []);
  // No leaves the rest window standing.
  w.input('char:n');
  assert.equal(w.state, 'selection');
  assert.deepEqual(crimes, []);
  // Yes carries alreadyWarned through, so the rest proceeds - AND the
  // crime lands.
  w.input('char:1');
  w.input('char:y');
  assert.equal(w.state, 'hours');
  assert.deepEqual(crimes, [['Vagrancy', true]]);
});

test('S40 RestWindow: with the warning OFF, camping in town is IMPOSSIBLE - and still a crime', () => {
  _resetForTests();
  setValue('GUI', 'IllegalRestWarning', 'False');
  const crimes = [];
  const w = new RestWindow(winDeps({
    restPlace: () => ({ inTownStrict: true }),
    commitCrime: (c, sg) => crimes.push([c, sg]),
  }));
  w.input('char:1');
  assert.equal(w.state, 'refused');
  assert.deepEqual(w.refusalLines, [`text:${CITY_CAMPING_ILLEGAL_ID}`]);
  assert.deepEqual(crimes, [['Vagrancy', true]]);
  // The refusal is NOT the 'ended' state, so closing it raises no
  // skills (:729-732 is the advancement moment and a refusal is not it).
  let raised = 0;
  const w2 = new RestWindow(winDeps({
    restPlace: () => ({ inTownStrict: true }),
    onRestFinished: () => { raised++; },
  }));
  w2.input('char:2');
  assert.equal(w2.state, 'refused');
  w2.input('char:1');
  assert.equal(w2.done, true);
  assert.equal(raised, 0);
  // Pressing again is not a second chance - the window is gone, and a
  // fresh one refuses the same way. `alreadyWarned` is the box, not a
  // press count.
  const w3 = new RestWindow(winDeps({ restPlace: () => ({ inTownStrict: true }) }));
  w3.input('char:1');
  assert.equal(w3.state, 'refused');
});

test('S40 RestWindow: LOITER is never gated and never moves the player', () => {
  _resetForTests();
  setValue('GUI', 'IllegalRestWarning', 'True');
  const beds = [], crimes = [];
  const w = new RestWindow(winDeps({
    restPlace: () => ({ inTownStrict: true }),
    commitCrime: (c) => crimes.push(c),
    moveToBed: (m) => beds.push(m),
  }));
  w.input('char:3');
  assert.equal(w.state, 'hours');   // straight to the prompt, no confirm
  assert.equal(w.mode, 'loiter');
  w.input('char:2'); w.input('confirm');
  assert.equal(w.state, 'resting');
  assert.deepEqual(crimes, []);
  assert.deepEqual(beds, []);       // LoiterPrompt has no MoveToBed
});

test('S40 RestWindow: MoveToBed - the healed button moves at once, timed after the prompt', () => {
  _resetForTests();
  const place = () => ({
    inTown: true, insideBuilding: true, mapId: 1, buildingKey: 2,
    isPermanentScene: () => true, nowMinutes: 0,
    rentedRoom: () => ({ allocatedBedIndex: 1, expiryMinutes: 600 }),
    restMarkers: [{ x: 0, y: 0, z: 0 }, { x: 9, y: 1, z: 3 }],
  });
  const beds = [];
  const h = new RestWindow(winDeps({ restPlace: place, moveToBed: (m) => beds.push(m) }));
  h.input('char:2');
  assert.deepEqual(beds, [{ x: 9, y: 1, z: 3 }]);

  const t = new RestWindow(winDeps({ restPlace: place, moveToBed: (m) => beds.push(m) }));
  t.input('char:1');
  assert.equal(t.state, 'hours');
  assert.equal(beds.length, 1);      // not yet - the prompt is still up
  t.input('char:8'); t.input('confirm');
  assert.equal(beds.length, 2);      // TimedRestPrompt ends on MoveToBed

  // ignoreAllocatedBed suppresses the move (:115-118, :603).
  const ig = new RestWindow(winDeps({ restPlace: place, moveToBed: (m) => beds.push(m) }), true);
  ig.input('char:2');
  assert.equal(beds.length, 2);
  assert.equal(ig.state, 'resting');
});

test('S40 RestWindow: an unrented inn room refuses with the string, not a record id', () => {
  _resetForTests();
  const w = new RestWindow(winDeps({
    restPlace: () => ({
      inTown: true, insideBuilding: true, buildingType: BUILDING_TYPES.Tavern,
      isPermanentScene: () => false, guildCanRest: () => true,
    }),
  }));
  w.input('char:1');
  assert.equal(w.state, 'refused');
  assert.deepEqual(w.refusalLines, [HAVE_NOT_RENTED_ROOM]);
  assert.equal(w.done, false);
  w.input('back');
  assert.equal(w.done, true);
});

test('S40 RestWindow: the confirm page paints the verbatim warning', () => {
  _resetForTests();
  setValue('GUI', 'IllegalRestWarning', 'True');
  assert.equal(ILLEGAL_REST_WARNING, 'It is illegal to camp in or near a city. Continue?');
  const w = new RestWindow(winDeps({ restPlace: () => ({ inTownStrict: true }) }));
  w.input('char:2');
  assert.equal(w.state, 'confirm');
  assert.equal(w._pending, 'healed');   // the button waiting behind the box
  // The page's own lines, straight out of draw()'s branch - no font
  // needed to pin WHAT it says.
  assert.match(src('src/ui/restWindow.js'),
    /lines = \[ILLEGAL_REST_WARNING, '', 'Y - yes', 'N - no'\]/);
  // Confirm is a live state everywhere it must be: it does not fall
  // through to the hours-entry tail.
  const w2 = new RestWindow(winDeps({ restPlace: () => ({ inTownStrict: true }) }));
  w2.input('char:1');
  w2.input('char:5');                   // a digit is not an answer
  assert.equal(w2.state, 'confirm');
  assert.equal(w2.value, '');
});

// ---- the shared rest HOUR -------------------------------------------

test('S40 restVitals: one home for the rested hour, and the dungeon host uses it', () => {
  const e = {
    isPlayer: true, level: 5, health: 10, maxHealth: 50, magicka: 0, maxMagicka: 40,
    fatigue: 0, stats: { strength: 50, endurance: 50, willpower: 50 }, skills: 30, career: {},
    skillUses: { [SKILLS.Medical]: 0 },
  };
  const healed = restVitals(e, { day: false, inside: true });
  assert.equal(e.health, 14);        // healthRecoveryRate 4
  assert.equal(e.magicka, 5);        // floor(40/8)
  assert.ok(e.fatigue > 0);
  assert.equal(healed, false);
  assert.equal(restFullyHealed(e), false);
  // TickRest tallies MEDICAL every rested hour - the one skill rest
  // itself advances (and the reason a long convalescence trains it).
  assert.ok((e.skillUses?.[SKILLS.Medical] ?? 0) > 0, 'the rested hour tallies Medical');

  // day/inside must actually REACH CalculateHealthRecoveryRate. A
  // career with no RapidHealing makes all four combinations identical
  // - which is what the first version of this pin used, so a mutant
  // that hardcoded the flags inside restVitals, or dropped them from
  // createRestDeps' tickVitals, passed. RapidHealing InLight is the
  // ONE place they differ: +100 instead of +60, and only by daylight
  // OUTDOORS. (rest.js:44-56.)
  const lit = (over) => ({
    isPlayer: true, level: 5, health: 0, maxHealth: 50, magicka: 40, maxMagicka: 40,
    fatigue: 0, stats: { strength: 50, endurance: 50, willpower: 50 }, skills: 30,
    career: { rapidHealing: RAPID_HEALING.InLight }, skillUses: { [SKILLS.Medical]: 0 }, ...over,
  });
  const heal = (flags) => { const x = lit(); restVitals(x, flags); return x.health; };
  assert.equal(heal({ day: true, inside: false }), 6, 'InLight: outdoors by day is the fast rate');
  assert.equal(heal({ day: false, inside: false }), 4, 'not by night');
  assert.equal(heal({ day: true, inside: true }), 4, 'not indoors');
  // ...and InDarkness is its exact complement, so a swapped pair is
  // caught from both sides.
  const dark = (flags) => {
    const x = lit({ career: { rapidHealing: RAPID_HEALING.InDarkness } });
    restVitals(x, flags); return x.health;
  };
  assert.equal(dark({ day: true, inside: false }), 4);
  assert.equal(dark({ day: false, inside: false }), 6);
  assert.equal(dark({ day: true, inside: true }), 6);

  // The four hosts pass the flags their PLACE actually has: fixed for
  // the two that are always inside and never lit, LIVE for the two
  // outdoors - which is the only place InLight can ever fire.
  assert.match(src('src/scenes/dungeonContext.js'), /day: \(\) => false, inside: \(\) => true,/);
  assert.match(src('src/scenes/worldModes.js'), /day: \(\) => false, inside: \(\) => true,/);
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(src(f), /day: \(\) => !isNight\(minuteNow\(\)\), inside: \(\) => false/, f);
  }
  // ...and createRestDeps CALLS them rather than closing over a value.
  assert.match(src('src/scenes/shared.js'),
    /tickVitals: \(\) => restVitals\(entity, \{ day: day\(\), inside: inside\(\) \}\),/);

  // Each of the three must be at max INDEPENDENTLY: fill two and the
  // completion must still be false, or FullRest ends early.
  e.health = e.maxHealth; e.magicka = e.maxMagicka;
  assert.equal(restFullyHealed(e), false, 'fatigue short is not fully healed');
  e.fatigue = maxFatigue(e); e.health = e.maxHealth - 1;
  assert.equal(restFullyHealed(e), false, 'health short is not fully healed');
  e.health = e.maxHealth; e.magicka = e.maxMagicka - 1;
  assert.equal(restFullyHealed(e), false, 'magicka short is not fully healed');
  e.magicka = e.maxMagicka;
  assert.equal(restFullyHealed(e), true);
  // ...and NoRegenSpellPoints counts as full magicka.
  const nr = { ...e, magicka: 0, career: { abilityFlagsAndSpellPointsBitfield: 8 } };
  assert.equal(restFullyHealed(nr), true);

  // The dungeon host stopped hand-rolling this composition - all of
  // it, not just the rested hour. It reads createRestDeps like every
  // other host and keeps only advanceMinutes, which is a dungeon law.
  const dc = src('src/scenes/dungeonContext.js');
  assert.match(dc, /const _restDeps = createRestDeps\(playerEntity, \{/);
  assert.match(dc, /advanceMinutes: \(n\) => _restAdvance\(n\),/);
  assert.doesNotMatch(dc, /fatigueRecoveryRate\(maxFatigue/);
  for (const gone of ['fullyHealed: _restFullyHealed', 'dead: () => playerEntity.health <= 0',
    'onRestFinished: () => raiseAtRestEnd']) {
    assert.ok(!dc.includes(gone), `the dungeon still hand-rolls ${gone}`);
  }
});

// ---- the WIRING ------------------------------------------------------

test('S40 hosts: all four can now rest, and each supplies its own place', () => {
  // The interior host: the key arm, the place bag, and the deps.
  const wm = src('src/scenes/worldModes.js');
  assert.match(wm, /mountInterior\(new RestWindow\(interiorRestDeps\)\);/);
  assert.match(wm, /interiorRestPlace = \(\) => \{/);
  assert.match(wm, /inTownStrict: false/);                       // inside, by definition
  assert.match(wm, /rentedRoom: \(\) => findRentedRoom\(playerEntity\.rentedRooms/);
  assert.match(wm, /guildCanRest\(guild, membershipOf/);
  assert.match(wm, /m\.type === INTERIOR_MARKER\.REST/);
  assert.match(wm, /isPermanentScene: \(name\) => containsPermanentScene/);
  // MoveToBed is position + FixStanding, and floorLanding IS this
  // port's FixStanding - a raw spawn wedges the capsule in tight
  // geometry, which is the dungeon start-marker bug already on record.
  assert.match(wm, /const f = floorLanding\(interiorCtx\.collider, \[m\.x, m\.y \+ 1\.08, m\.z\]\);\n\s+player\.spawn\(f\[0\], f\[1\], f\[2\]\);/);
  // The interior host is the one that can actually be IN a rented room,
  // so it is the one that owes the sweep.
  assert.match(wm, /onRentExpired: \(\) => \{\n\s+playerEntity\.rentedRooms = removeExpiredRooms\(/);

  // Both outdoor hosts answer the Rest action and commit the crime.
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const s = src(f);
    // U45 turned both outdoor ladders into `hudCtx`, the ONE door the
    // large HUD's rest panel posts through too. Pin the WHOLE arm and
    // the door behind it - matching the action NAME alone survives a
    // `false &&` in front of it, which leaves the key dead.
    assert.match(s, /if \(act === 'Rest'\) \{ e\.preventDefault\(\); hudCtx\.toggleRest\(\); return; \}/, f);
    assert.match(s, /toggleRest: \(\) => toggleRest\(\),/, f);
    // ...and it sits INSIDE the overlay/mode guard the ladder opens
    // with, not after it. Both indices are asserted FOUND first: the
    // first version compared them raw, so an arm hoisted ABOVE the
    // guard gave indexOf === -1 and the `<` passed vacuously - the
    // exact escape the assertion existed to catch.
    const g = s.indexOf("if (!townTalk.overlayActive && (modes?.mode ?? 'exterior') === 'exterior') {");
    assert.ok(g > 0, `${f}: the ladder guard was not found`);
    const ladder = s.slice(g);
    const at = ladder.indexOf('hudCtx.toggleRest()');
    const close = ladder.indexOf('\n    }');
    assert.ok(at > 0, `${f}: the Rest arm is not below the guard at all`);
    assert.ok(close > 0 && at < close, `${f}: the Rest arm escaped the guard`);
    assert.match(s, /new RestWindow\(outdoorRestDeps\)/, f);
    assert.match(s, /playerEntity\.crimeCommitted = crime/, f);
    assert.match(s, /if \(spawnGuards\) _crimeResponse\(\)/, f);
    assert.match(s, /inTownStrict: _isPlayerInTownStrict\(\)/, f);
    assert.match(s, /insideBuilding: false/, f);
    // CalculateHealthRecoveryRate's flags are LIVE outdoors.
    assert.match(s, /day: \(\) => !isNight\(minuteNow\(\)\), inside: \(\) => false/, f);
  }

  // ...and the interior host gets the bare IsPlayerInTown from both.
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(src(f), /inTownLocation: \(\) => isTownLocationType/, f);
  }
});

test('S40: the rest CLOCK rides the seam all four hosts already drive', () => {
  // The window's clock was `tickRest`, and exactly ONE host knew to
  // call it. Every other host drives `tick(dt)` - townTalk.frame for
  // the two outdoor hosts, worldModes' own overlay arm for the
  // interior one - so a rest opened anywhere but a dungeon would have
  // sat on "Hours passed: 0" until Escape.
  let advanced = 0;
  const w = new RestWindow(winDeps({ advanceMinutes: (n) => { advanced += n; } }));
  w.input('char:2');                       // rest until healed
  assert.equal(w.state, 'resting');
  w.tick(1);                               // one real second
  assert.ok(advanced > 0, 'tick(dt) must drive the rest clock');
  // ...and the old name still works, for any caller that kept it.
  const before = advanced;
  w.tickRest(1);
  assert.ok(advanced > before);
  // The dungeon host must NOT call both, or the rest runs at 2x.
  const dc = src('src/scenes/dungeonContext.js');
  assert.doesNotMatch(dc, /isRestWindow\) activeOverlay\.tickRest/);
  // And the three seams that drive it all exist.
  assert.match(src('src/scenes/townTalk.js'), /overlay\?\.tick\?\.\(dt\)/);
  assert.match(src('src/scenes/worldModes.js'), /interiorOverlay\.tick\?\.\(dt\)/);
  assert.match(dc, /activeOverlay\.tick\?\.\(dt\)/);
});

test('S40: the tavern sells a bed that is now READ', () => {
  // tavern.js flagged allocatedBedIndex as "stored here and read by
  // nobody until resting in a rented room lands". It lands here.
  const t = src('src/systems/tavern.js');
  assert.doesNotMatch(t, /read by nobody/);
  // The bed the rental mints and the bed CanRest hands back are the
  // same index into the same marker list.
  assert.match(src('src/systems/restSession.js'), /room\.allocatedBedIndex/);
});


// ---- THE OPEN GATE ---------------------------------------------------

test('S40 restOpenGate: three refusals, in DFU\'s order, and the enemy alert rides the first', () => {
  // DaggerfallUI.cs:651-687. Enemies FIRST, and only that arm raises
  // the alert - which is what arms the dungeon rest-encounter roll.
  const foes = restOpenGate({ enemiesNearby: true, swimming: true, grounded: false });
  assert.deepEqual(foes, { ok: false, textId: REST_TEXT.enemiesNearby, alert: true });
  // Then swimming or not grounded, sharing one record and raising no
  // alert. StartRestGroundedCheck is the `grounded` input's law.
  assert.deepEqual(restOpenGate({ swimming: true }),
    { ok: false, textId: REST_TEXT.cannotRestNow, alert: false });
  assert.deepEqual(restOpenGate({ grounded: false }),
    { ok: false, textId: REST_TEXT.cannotRestNow, alert: false });
  // Clear on all three: the window opens.
  assert.deepEqual(restOpenGate({ enemiesNearby: false, swimming: false, grounded: true }),
    { ok: true, textId: null, alert: false });
  assert.deepEqual(restOpenGate(), { ok: true, textId: null, alert: false });
});

test('S40 restOpenGate: it is SCENE-FREE - all four hosts run it before opening', () => {
  const wm = src('src/scenes/worldModes.js');
  // The gate lived written-out in dungeonContext because rest was a
  // dungeon feature. DFU raises it from ONE message handler with no
  // scene test at all, so every host that can rest owes it.
  for (const f of ['src/scenes/dungeonContext.js', 'src/scenes/world.js',
    'src/scenes/exterior.js', 'src/scenes/worldModes.js']) {
    const h = src(f);
    assert.match(h, /const gate = restOpenGate\(\{/, f);
    assert.match(h, /if \(!gate\.ok\) \{/, f);
    // ...and the window is only built AFTER the gate passes.
    assert.ok(h.indexOf('restOpenGate({') < h.indexOf('new RestWindow('), `${f}: the gate must precede the window`);
  }
  // The dungeon stopped keeping its own copy.
  assert.doesNotMatch(src('src/scenes/dungeonContext.js'), /if \(_restDeps\.enemiesNearby\(\)\) \{/);
  // Every host that HAS motor state feeds it LIVE, not as a constant.
  // The interior one included: it mounts no foe pool and has no water,
  // so those two are honestly false there - but StartRestGroundedCheck
  // is live indoors, since a levitating player cannot lie down in a
  // shop any more than in a dungeon.
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(src(f), /swimming: !!player\.swimming,/, f);
  }
  assert.match(wm, /enemiesNearby: false,[^}]*swimming: false,/s);
  assert.match(src('src/scenes/dungeonContext.js'), /swimming: _activity\.swimming, grounded: nearFloor,/);
  // ...and EVERY host asks StartRestGroundedCheck rather than the raw
  // motor flag. The raw flag reads false for a levitating player an
  // inch off the floor, whom DFU lets sleep (PlayerMotor.cs:190-193).
  for (const f of ['src/scenes/dungeonContext.js', 'src/scenes/world.js',
    'src/scenes/exterior.js', 'src/scenes/worldModes.js']) {
    const h = src(f);
    assert.match(h, /startRestGroundedCheck\(/, f);
    // Scoped to the GATE call, because `grounded: !!player.grounded`
    // is also a legitimate debug readout elsewhere in world.js.
    const g = h.slice(h.indexOf('restOpenGate({'), h.indexOf('restOpenGate({') + 400);
    assert.doesNotMatch(g, /grounded: !!player\.grounded/, `${f}: the raw flag is not the check`);
    assert.match(g, /grounded: (startRestGroundedCheck\(|nearFloor)/, f);
  }
});

// ---- CheckRent -------------------------------------------------------

const rentDeps = (over = {}) => ({
  advanceMinutes() {}, tickVitals: () => false, fullyHealed: () => false,
  enemiesNearby: () => false, dead: () => false, ...over,
});
/** Run a session forward whole hours (6 sub-ticks of 10 minutes). */
const restHours = (sess, n) => {
  for (let i = 0; i < n * 6; i++) {
    const r = sess.tick(REST_WAIT_PER_HOUR / 10 + 1e-9);
    if (r) return r;
  }
  return null;
};

test('S40 CheckRent: the rental counts DOWN every rested hour and ends the rest at zero', () => {
  // CheckRent (:441-448) run from TickRest (:435-436). Three hours
  // left, a twelve-hour rest: the room, not the clock, wakes you.
  const s2 = new RestSession('timed', 12, rentDeps(), 3);
  const r = restHours(s2, 5);
  assert.ok(r, 'the session ended');
  assert.equal(r.rentExpired, true);
  assert.equal(r.text, EXPIRED_RENTED_ROOM);
  assert.equal(r.textId, null);        // a STRING, not a TEXT.RSC record
  assert.equal(s2.totalHours, 3);      // exactly when the counter hit 0
  assert.ok(s2.hoursRemaining > 0);    // the timed rest had hours left
});

test('S40 CheckRent: -1 never counts down, so an unrented rest is not billed', () => {
  const s2 = new RestSession('timed', 4, rentDeps(), -1);
  const r = restHours(s2, 4);
  assert.equal(r.textId, REST_TEXT.wakeUp);
  assert.equal(r.rentExpired, undefined);
  assert.equal(s2.remainingHoursRented, -1);   // untouched
  // The predicate itself: -1 returns BEFORE the decrement.
  const s3 = new RestSession('timed', 1, rentDeps(), -1);
  assert.equal(s3.checkRent(), false);
  assert.equal(s3.remainingHoursRented, -1);
  // ...and it fires exactly ONCE, on the hour it reaches zero.
  const s4 = new RestSession('timed', 9, rentDeps(), 2);
  assert.equal(s4.checkRent(), false);
  assert.equal(s4.checkRent(), true);
  assert.equal(s4.checkRent(), false);   // -1 now, and quiet
});

test('S40 CheckRent: the expired line OUTRANKS the mode\'s own', () => {
  // EndRest's first arm (:480-486) beats "You wake up." and "You are
  // healed." both - and CheckRent runs even when the mode has already
  // finished, because DFU ORs the two rather than short-circuiting.
  const timed = new RestSession('timed', 2, rentDeps(), 2);
  const t = restHours(timed, 3);
  assert.equal(t.text, EXPIRED_RENTED_ROOM);
  const full = new RestSession('full', 0, rentDeps({ tickVitals: () => true }), 1);
  const f = restHours(full, 2);
  assert.equal(f.text, EXPIRED_RENTED_ROOM);
  // Stopping early on the SAME hour reports it too (endEarly goes
  // through the same precedence).
  const early = new RestSession('timed', 9, rentDeps(), 1);
  restHours(early, 1);
  assert.equal(early.remainingHoursRented, 0);
  assert.equal(early.endEarly().text, EXPIRED_RENTED_ROOM);
});

test('S40 CheckRent: CanRest\'s hour count REACHES the session, and the sweep runs on expiry', () => {
  _resetForTests();
  const swept = [];
  const w = new RestWindow(winDeps({
    onRentExpired: () => swept.push(1),
    restPlace: () => ({
      inTown: true, insideBuilding: true, mapId: 1, buildingKey: 2,
      isPermanentScene: () => true, nowMinutes: 0,
      rentedRoom: () => ({ allocatedBedIndex: 0, expiryMinutes: 120 }),   // 2 hours
      restMarkers: [{ x: 0, y: 0, z: 0 }],
    }),
  }));
  w.input('char:1');
  w.input('char:9'); w.input('confirm');            // a 9-hour rest
  assert.equal(w.session.remainingHoursRented, 2);  // the room, carried
  const r = restHours(w.session, 3);
  assert.equal(r.text, EXPIRED_RENTED_ROOM);
  w._end(r);
  assert.deepEqual(w.endLines, [EXPIRED_RENTED_ROOM]);
  assert.deepEqual(swept, [1], 'RemoveExpiredRentedRooms runs as the line prints (:485)');
  // ...and a rest with no room seam at all carries the -1 sentinel.
  const free = new RestWindow(winDeps());
  free.input('char:1'); free.input('char:1'); free.input('confirm');
  assert.equal(free.session.remainingHoursRented, -1);
});

test('S40 RestWindow: the confirm box answers a CAPSED keyboard too', () => {
  _resetForTests();
  setValue('GUI', 'IllegalRestWarning', 'True');
  const mk = () => new RestWindow(winDeps({ restPlace: () => ({ inTownStrict: true }) }));
  const y = mk(); y.input('char:1'); y.input('char:Y');
  assert.equal(y.state, 'hours');
  const n = mk(); n.input('char:1'); n.input('char:N');
  assert.equal(n.state, 'selection');
});

test('S40 RestWindow: WhileButton plays the click TWICE on the illegal arm (verbatim)', () => {
  // :644 then :647 - HealedButton takes the same branch and plays it
  // once (:670). A quirk nobody would write on purpose, preserved.
  const w = src('src/ui/restWindow.js');
  assert.match(w, /if \(which === 'while'\) audio\.playOneShot\(SOUND\.ButtonClick, 1\);/);
  const arm = w.slice(w.indexOf('_restButton(which, alreadyWarned)'));
  assert.ok(arm.indexOf("which === 'while'") < arm.indexOf('this._pending = which;'),
    'the second shot lands before the box goes up');
});


test('S40 areEnemiesNearby: the RESTING variant, and it is the one the hosts ask', () => {
  const foe = (over) => ({ dead: false, ai: { detected: false, inSight: false, wouldBeSpawned: false, _dist: 100, ...over } });
  // Can see you -> nearby at ANY distance.
  assert.equal(areEnemiesNearby([foe({ detected: true, inSight: true, _dist: 900 })], { resting: true }), true);
  // Cannot see you and further than 12 -> SKIPPED ENTIRELY while
  // resting, even though it would have spawned in classic. That skip
  // IS the resting variant; without it any unaware foe in the whole
  // 1024-unit spawn band refuses rest.
  assert.equal(areEnemiesNearby([foe({ wouldBeSpawned: true, _dist: 13 })], { resting: true }), false);
  assert.equal(areEnemiesNearby([foe({ wouldBeSpawned: true, _dist: 13 })], { resting: false }), true);
  // Cannot see you but within 12 -> counts only if it would spawn.
  assert.equal(areEnemiesNearby([foe({ wouldBeSpawned: true, _dist: 12 })], { resting: true }), true);
  assert.equal(areEnemiesNearby([foe({ wouldBeSpawned: false, _dist: 1 })], { resting: true }), false);
  // Half-seen is not seen: DFU ANDs Target-is-player with TargetInSight.
  assert.equal(areEnemiesNearby([foe({ detected: true, _dist: 900 })], { resting: true }), false);
  // The dead and the shapeless are skipped, and an empty pool is quiet.
  assert.equal(areEnemiesNearby([{ dead: true, ai: { detected: true, inSight: true, _dist: 0 } }], { resting: true }), false);
  assert.equal(areEnemiesNearby([null, {}], { resting: true }), false);
  assert.equal(areEnemiesNearby([], { resting: true }), false);
  assert.equal(areEnemiesNearby(undefined, { resting: true }), false);

  // ALL THREE foe-bearing hosts ask through the law, and the two above
  // ground stopped asking "is any guard alive" - which for rest is a
  // different rule, not a rough one: guards persist until the crime
  // clears, so one spawned across town blocks sleep forever.
  for (const f of ['src/scenes/dungeonContext.js', 'src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(src(f), /areEnemiesNearby\([^)]*\{ resting: true \}\)/, f);
  }
  assert.match(src('src/scenes/world.js'), /\[\.\.\.cityGuards\.guards, \.\.\.exteriorFoes\.foes\], \{ resting: true \}/);
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const deps = src(f).slice(src(f).indexOf('const outdoorRestDeps'), src(f).indexOf('const toggleRest'));
    assert.doesNotMatch(deps, /activeCount\?\.\(\) \?\? 0\) > 0/, `${f}: the rest deps must not ask the coarse question`);
  }
});


test('S40 createRestDeps: a host dep the composition does not name still REACHES the window', () => {
  // The defect this pin exists for: createRestDeps destructured a
  // CLOSED option list and returned a CLOSED literal, so worldModes'
  // `onRentExpired` was handed in and dropped on the floor -
  // RemoveExpiredRentedRooms never ran from rest. The pin beside it
  // matched the SOURCE TEXT of the host and passed anyway, which is
  // the whole lesson: a wire is pinned by running current through it.
  const e = {
    isPlayer: true, level: 1, health: 5, maxHealth: 10, magicka: 0, maxMagicka: 8,
    fatigue: 0, stats: { strength: 50, endurance: 50, willpower: 50 }, skills: 20,
    career: {}, skillUses: { [SKILLS.Medical]: 0 },
  };
  const seen = [];
  const d = createRestDeps(e, {
    advanceMinutes: () => {},
    onRentExpired: () => seen.push('swept'),
    commitCrime: (c) => seen.push(c),
    moveToBed: () => seen.push('bed'),
    place: () => ({ inTownStrict: true }),
    endLines: (id) => [`t${id}`],
  });
  for (const k of ['onRentExpired', 'commitCrime', 'moveToBed', 'restPlace', 'endLines']) {
    assert.ok(k in d, `createRestDeps dropped ${k}`);
  }
  // ...and it reaches the window, not just the object: a refused
  // in-town rest must commit the crime through the host's closure.
  _resetForTests();
  setValue('GUI', 'IllegalRestWarning', 'False');
  const w = new RestWindow(d);
  w.input('char:1');
  assert.equal(w.state, 'refused');
  assert.deepEqual(seen, ['Vagrancy']);
  // The five the composition OWNS win over a same-named key, so a host
  // cannot half-override it.
  const forced = createRestDeps(e, { advanceMinutes: () => {}, dead: () => 'nope', vitals: () => 'nope' });
  assert.equal(forced.dead(), false);
  assert.equal(typeof forced.vitals(), 'object');
});

test('S40: the expired-room sweep runs THROUGH the host composition, not around it', () => {
  // worldModes hands onRentExpired to createRestDeps; the window calls
  // it on EndRest's expired arm. Both halves, end to end.
  const wm = src('src/scenes/worldModes.js');
  const deps = wm.slice(wm.indexOf('const interiorRestDeps = createRestDeps'), wm.indexOf('const interiorKeyCtx'));
  assert.match(deps, /onRentExpired: \(\) => \{/, 'the interior host supplies the sweep');
  assert.match(src('src/ui/restWindow.js'), /if \(result\.rentExpired\) this\.deps\.onRentExpired\?\.\(\);/);
  assert.match(src('src/scenes/shared.js'), /\.\.\.rest,/, 'and the composition passes it through');
});


test('S40: the OnEncounter abort reaches the rest window in EVERY slot', () => {
  // AbortRestForEnemySpawn (:301-304) is subscribed on the WINDOW
  // (OnPush :264, OnPop :275), so it follows the window wherever it is
  // mounted. The first S40 pass routed the two slots worldModes owns
  // and wrote a comment claiming it followed the window - which was
  // two thirds true, and outdoors is exactly where a quest CreateFoe
  // wave lands beside a sleeping player.
  const wm = src('src/scenes/worldModes.js');
  const arm = wm.slice(wm.indexOf('raiseOnEncounterEvent()'), wm.indexOf('raiseOnEncounterEvent()') + 900);
  assert.match(arm, /dungeonCtx\?\.abortRestForEnemySpawn\?\.\(\)/);
  assert.match(arm, /interiorOverlay\?\.isRestWindow/);
  assert.match(arm, /host\.abortRestForEnemySpawn\?\.\(\)/, 'and the OUTER host slot');
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(src(f), /abortRestForEnemySpawn: \(\) => \{\n\s+if \(townTalk\.overlay\?\.isRestWindow\)/, f);
  }
  // The latch itself: it is a LATCH, answered on the next tick.
  const s2 = new RestSession('timed', 5, {
    advanceMinutes() {}, tickVitals: () => false, fullyHealed: () => false,
    enemiesNearby: () => false, dead: () => false,
  });
  s2.abortForEnemySpawn();
  const r = s2.tick(0);
  assert.equal(r.enemyBroke, true);
  assert.equal(r.textId, REST_TEXT.enemiesNearby);
});

test('S40: worldModes only routes the large HUD in a mode it DRAWS', () => {
  // `mode` starts at 'exterior' and both outdoor hosts call
  // modes.pointerdown BEFORE their own routeLargeHudClick, so without
  // this gate every panel click above ground reached interiorKeyCtx
  // and mounted a window into `interiorOverlay` - a slot the frame
  // never draws and the keydown arm never feeds. It looked harmless
  // until S40 gave interiorKeyCtx a toggleRest for it to call.
  const wm = src('src/scenes/worldModes.js');
  assert.match(wm,
    /if \(mode === 'dungeon' \|\| mode === 'interior'\) \{\n\s+if \(routeLargeHudClick\(px, py, e\.button,/);
  // ...and the bar's REST panel is a real destination now, in the
  // hosts that own it.
  assert.match(src('src/ui/hudLarge.js'), /key: 'rest',[^}]*action: 'Rest'/);
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(src(f), /toggleRest: \(\) => toggleRest\(\),/, f);
  }
});


test('S40 startRestGroundedCheck: grounded short-circuits, else a ray of height/2 + 0.2', () => {
  // PlayerMotor.cs:184-194. The ray is DFU's own levitation fix - its
  // comment: "player is levitating but feet are 'close enough' to
  // ground to rest" - so the tolerance and the origin both matter.
  const calls = [];
  const hit = (d) => ({ raycast: (o, dir, max) => { calls.push([o.slice(), dir, max]); return d; } });
  // Grounded returns before the ray is ever cast.
  assert.equal(startRestGroundedCheck(true, [0, 0, 0], hit(Infinity)), true);
  assert.deepEqual(calls, [], 'a grounded player is never raycast');
  // Airborne with floor in reach -> true, and the ray starts at the
  // capsule CENTRE (feet + height/2) pointing down, reaching
  // height/2 + 0.2.
  const c = hit(0.5);
  assert.equal(startRestGroundedCheck(false, [3, 10, -4], c), true);
  assert.deepEqual(calls[0], [[3, 10 + CAPSULE_HEIGHT / 2, -4], [0, -1, 0], CAPSULE_HEIGHT / 2 + 0.2]);
  // Nothing within reach -> false (the raycast's own miss sentinel).
  assert.equal(startRestGroundedCheck(false, [0, 0, 0], hit(Infinity)), false);
  assert.equal(startRestGroundedCheck(false, [0, 0, 0], hit(NaN)), false);
  // No collider or no feet: the honest answer is "not grounded",
  // never a throw - the interior host can be asked before its context
  // is mounted.
  assert.equal(startRestGroundedCheck(false, [0, 0, 0], null), false);
  assert.equal(startRestGroundedCheck(false, null, hit(0.1)), false);
  assert.equal(startRestGroundedCheck(true, null, null), true);
});


// ---- END TO END ------------------------------------------------------

test('S40 END TO END: rent a room, sleep in it, and the room runs out under you', () => {
  // Every law in this slice is pinned alone above. This drives all of
  // them together through one host-shaped deps bag, from the key press
  // to the wake, because a slice whose parts each pass and whose whole
  // was never run is exactly what the live probe would have caught -
  // and there is no ARENA2 data on this machine to run one.
  _resetForTests();
  setValue('GUI', 'IllegalRestWarning', 'True');

  const NOW = { m: 8 * 60 };                     // 08:00 on day 0
  const MAP = 42, KEY = 900;
  const scene = new Set([interiorSceneName(MAP, KEY)]);
  const rooms = [{ name: 'The Ale Cellar', mapId: MAP, buildingKey: KEY,
    allocatedBedIndex: 1, expiryMinutes: 8 * 60 + 3 * 60 }];   // 3 hours left
  const markers = [{ x: 0, y: 0, z: 0 }, { x: 7, y: 2, z: 9 }];
  const player = { health: 12, maxHealth: 60, magicka: 0, maxMagicka: 40, fatigue: 0,
    isPlayer: true, level: 6, stats: { strength: 50, endurance: 50, willpower: 50 },
    skills: 30, career: {}, skillUses: { [SKILLS.Medical]: 0 } };
  const moved = [], swept = [], said = [];

  const deps = createRestDeps(player, {
    advanceMinutes: (n) => { NOW.m += n; },
    enemiesNearby: () => areEnemiesNearby([], { resting: true }),
    place: () => ({
      inTownStrict: false, inTown: true, insideBuilding: true,
      buildingType: BUILDING_TYPES.Tavern, buildingKey: KEY, mapId: MAP,
      isPermanentScene: (n) => scene.has(n),
      rentedRoom: () => rooms.find((r) => r.mapId === MAP && r.buildingKey === KEY) ?? null,
      nowMinutes: NOW.m, restMarkers: markers, guildCanRest: () => false,
    }),
    moveToBed: (m) => moved.push(m),
    onRentExpired: () => { swept.push(NOW.m); rooms.length = 0; },
    endLines: (id) => [`RSC${id}`],
    say: (t) => said.push(t),
    day: () => true, inside: () => true,        // inside a building, by day
  });

  // The open gate passes: no foes, dry, on the floor.
  const gate = restOpenGate({ enemiesNearby: deps.enemiesNearby(), swimming: false, grounded: true });
  assert.equal(gate.ok, true);

  // Rest for a while, 9 hours - longer than the room has left.
  const w = new RestWindow(deps);
  w.input('char:1');
  assert.equal(w.state, 'hours', 'the room is rented, so CanRest passes and no crime is committed');
  w.input('char:9'); w.input('confirm');
  assert.equal(w.state, 'resting');
  // MoveToBed put the sleeper in the bed the RENTAL minted, index 1.
  assert.deepEqual(moved, [{ x: 7, y: 2, z: 9 }]);
  assert.equal(w.session.remainingHoursRented, 3);

  // Now run the clock through the window's own tick - the seam every
  // host drives - until it ends.
  let ended = false;
  for (let i = 0; i < 5000 && !ended; i++) {
    w.tick(REST_WAIT_PER_HOUR / 10 + 1e-9);
    ended = w.state !== 'resting';
  }
  assert.equal(w.state, 'ended', 'the rest finished on its own');

  // THREE hours passed, not nine: the room ran out first.
  assert.equal(NOW.m - 8 * 60, 180);
  assert.equal(w.session.totalHours, 3);
  // ...and it says so, in the line that outranks "You wake up.".
  assert.deepEqual(w.endLines, [EXPIRED_RENTED_ROOM]);
  // The landlord cleared the room as the player woke.
  assert.deepEqual(swept, [8 * 60 + 180]);
  assert.equal(rooms.length, 0);

  // Three rested hours of vitals landed, and Medical tallied. The
  // rate is DERIVED from the formula, not written down: hardcoding it
  // would silently follow a mutant that changed maxHealth's role.
  const perHour = healthRecoveryRate({ ...player, health: 0 }, { day: true, inside: true });
  assert.equal(perHour, 5, 'END 50 / Medical 30 / maxHealth 60 -> floor(90*60/1000)');
  assert.equal(player.health, 12 + 3 * perHour);
  assert.equal(player.magicka, 3 * 5);
  assert.equal(player.skillUses[SKILLS.Medical], 3);

  // Closing the finished popup is the RaiseSkills moment, and only
  // there - the whole rest raised nothing until this input.
  w.input('confirm');
  assert.equal(w.done, true);

  // And now the room is gone, the same building refuses.
  const after = canRest({
    inTown: true, insideBuilding: true, buildingType: BUILDING_TYPES.Tavern,
    buildingKey: KEY, mapId: MAP, isPermanentScene: (n) => scene.has(n),
    rentedRoom: () => null, nowMinutes: NOW.m, restMarkers: markers,
  });
  assert.equal(after.ok, false);
  assert.equal(after.text, HAVE_NOT_RENTED_ROOM);
});

test('S40 END TO END: camping in a city - confirm, crime, guards, and a full night', () => {
  _resetForTests();
  setValue('GUI', 'IllegalRestWarning', 'True');
  const NOW = { m: 22 * 60 };
  const crimes = [], moved = [];
  const player = { health: 30, maxHealth: 60, magicka: 10, maxMagicka: 40, fatigue: 0,
    isPlayer: true, level: 6, stats: { strength: 50, endurance: 50, willpower: 50 },
    skills: 30, career: {}, skillUses: { [SKILLS.Medical]: 0 } };
  const deps = createRestDeps(player, {
    advanceMinutes: (n) => { NOW.m += n; },
    place: () => ({ inTownStrict: true, inTown: true, insideBuilding: false }),
    commitCrime: (c, sg) => crimes.push([c, sg]),
    moveToBed: (m) => moved.push(m),
    endLines: (id) => [`RSC${id}`],
    day: () => false, inside: () => false,      // outdoors, at night
  });

  const w = new RestWindow(deps);
  w.input('char:1');
  assert.equal(w.state, 'confirm', 'the illegal-rest box comes first');
  assert.deepEqual(crimes, [], 'and it does not touch CanRest, so no crime yet');
  w.input('char:y');
  assert.equal(w.state, 'hours');
  assert.deepEqual(crimes, [['Vagrancy', true]], 'the Yes arm commits it, guards and all');
  w.input('char:4'); w.input('confirm');
  assert.deepEqual(moved, [], 'there is no bed in a city street');

  let ended = false;
  for (let i = 0; i < 5000 && !ended; i++) {
    w.tick(REST_WAIT_PER_HOUR / 10 + 1e-9);
    ended = w.state !== 'resting';
  }
  assert.equal(NOW.m - 22 * 60, 240, 'four hours passed');
  assert.deepEqual(w.endLines, [`RSC${REST_TEXT.wakeUp}`]);
  // Outdoors AT NIGHT - and with no RapidHealing flag that is the same
  // rate as indoors, which is exactly why the day/inside pin above
  // needs a career that HAS one.
  const nightRate = healthRecoveryRate({ ...player, health: 0 }, { day: false, inside: false });
  assert.equal(player.health, 30 + 4 * nightRate);
  // The rental counter never engaged: there was no room.
  assert.equal(w.session.remainingHoursRented, -1);

  // With the warning OFF the same press is refused outright - and the
  // crime lands anyway, which is the quirk this slice exists to keep.
  _resetForTests();
  setValue('GUI', 'IllegalRestWarning', 'False');
  const crimes2 = [];
  const w2 = new RestWindow(createRestDeps(player, {
    advanceMinutes: () => {},
    place: () => ({ inTownStrict: true }),
    commitCrime: (c, sg) => crimes2.push([c, sg]),
    endLines: (id) => [`RSC${id}`],
  }));
  w2.input('char:1');
  assert.equal(w2.state, 'refused');
  assert.deepEqual(w2.refusalLines, [`RSC${CITY_CAMPING_ILLEGAL_ID}`]);
  assert.deepEqual(crimes2, [['Vagrancy', true]]);
});
