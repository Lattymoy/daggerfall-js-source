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
  restOpenGate, REST_TEXT, RestSession, EXPIRED_RENTED_ROOM, interiorRestPlace,
  cannotLoiterLines, loiterLimitHours,
  CANNOT_REST_MORE_THAN_99_HOURS_ID, PROMPT_MAX_CHARS, PROMPT_INITIAL,
} from '../src/systems/restSession.js';
import { RestWindow } from '../src/ui/restWindow.js';
import { restVitals, restFullyHealed, createRestDeps } from '../src/scenes/shared.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { isTownLocationType, TOWN_LOCATION_TYPES, LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { interiorSceneName } from '../src/systems/sceneCache.js';
import { setValue, _resetForTests } from '../src/systems/settings.js';
import { maxFatigue } from '../src/systems/statMods.js';
import { RAPID_HEALING, healthRecoveryRate, fatigueRecoveryRate } from '../src/systems/rest.js';
import { REST_WAIT_PER_HOUR, LOITER_WAIT_PER_HOUR } from '../src/systems/restSession.js';
import { SKILLS } from '../src/systems/skills.js';
import { startRestGroundedCheck, CAPSULE_HEIGHT } from '../src/player/motor.js';
import { areEnemiesNearby } from '../src/systems/encounters.js';
import { createPlayerTicker } from '../src/scenes/shared.js';
import { setWorldMinutes } from '../src/systems/worldTick.js';

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
  // The old anti-regression guard was CASE-MISMATCHED and could never
  // fire: the identifier in both hosts is `_musicLocationType()`, with
  // a capital L, so /locationType\(\)/ matched nothing mutated or not.
  // Pin the strict predicate's three clauses instead, in both hosts -
  // it is the input the whole camping-crime arm keys on.
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(src(f),
      /_isPlayerInTownStrict = \(\) => _musicInLocationRect\(\)\n\s+&& isTownLocationType\(_musicLocationType\(\)\)\n\s+&& \(modes\?\.mode \?\? 'exterior'\) === 'exterior';/, f);
    assert.doesNotMatch(src(f), /_musicLocationType\(\)\s*<=\s*2/, f);
  }
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
  // OVER the cap first: loiterLimitHours ships 3, and the old fixture
  // typed 2 - under the boundary, so the refusal branch was inert and
  // a mutant raising the cap to 999 passed the whole suite.
  assert.equal(w.value, PROMPT_INITIAL, 'the field is PREFILLED with "0" (:700)');
  w.input('backspace'); w.input('char:9'); w.input('confirm');
  assert.equal(w.state, 'hours', 'a 9-hour loiter is refused, not started');
  assert.deepEqual(w.notice, cannotLoiterLines());
  assert.equal(w.value, PROMPT_INITIAL, 'and the field resets to "0" for another try');
  w.input('backspace'); w.input('char:2'); w.input('confirm');
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
  // Fatigue tied to the FORMULA, not just asserted positive: the old
  // `> 0` let the rate be any constant, and a mutant restoring 1 point
  // an hour instead of maxFatigue/8 passed the whole suite.
  assert.equal(e.fatigue, fatigueRecoveryRate(maxFatigue(e)));
  assert.ok(e.fatigue > 100, 'and that is real stored units, not 1');
  assert.equal(healed, false);
  assert.equal(restFullyHealed(e), false);

  // THE THREE CLAMPS. DaggerfallEntity's Current* setters clamp to
  // their maxima, so `CurrentHealth += rate` cannot overshoot. Every
  // fixture in this file rested far below max, so deleting all three
  // Math.min wrappers passed the suite - and the consequence is not
  // cosmetic: restFullyHealed uses `===` (matching C#'s `==`), so one
  // point of overshoot means the equality is never reachable again and
  // a Rest-Until-Healed NEVER TERMINATES.
  const brim = {
    isPlayer: true, level: 5, maxHealth: 50, maxMagicka: 40,
    health: 49, magicka: 39,
    stats: { strength: 50, endurance: 50, willpower: 50 }, skills: 30, career: {},
    skillUses: { [SKILLS.Medical]: 0 },
  };
  brim.fatigue = maxFatigue(brim) - 1;
  const full = restVitals(brim, { day: false, inside: true });
  assert.equal(brim.health, brim.maxHealth, 'health clamps at max, never past it');
  assert.equal(brim.magicka, brim.maxMagicka, 'magicka clamps');
  assert.equal(brim.fatigue, maxFatigue(brim), 'fatigue clamps');
  assert.equal(full, true, 'and the clamp is what lets the === completion fire');
  assert.equal(restFullyHealed(brim), true);
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
  // The bag is a LAW now, so this RUNS it. It used to be pinned by
  // regexes over its own source inside the host closure, and a review
  // round proved that hollow: flipping `insideBuilding` to false there
  // bypassed the entire lodging economy - every interior rests free,
  // no room, no bed, no rent countdown - with the whole suite green.
  const bag = interiorRestPlace({
    inTown: true,
    building: { buildingType: BUILDING_TYPES.Tavern, buildingKey: 77 },
    mapId: 5, nowMinutes: 600, restMarkers: ['a', 'b'],
  });
  assert.equal(bag.insideBuilding, true, 'CanRest arm 2 needs BOTH halves of its &&');
  assert.equal(bag.inTownStrict, false, 'inside, mustBeOutside cannot pass');
  assert.equal(bag.inTown, true);
  assert.equal(bag.buildingType, BUILDING_TYPES.Tavern);
  assert.equal(bag.buildingKey, 77);
  assert.equal(bag.mapId, 5);
  assert.equal(bag.nowMinutes, 600);
  assert.deepEqual(bag.restMarkers, ['a', 'b']);
  assert.equal(bag.isHouseOwned(), false, 'the bank ledger is unported; DFU default');
  // A bag with no building at all still answers, and answers None -
  // the host can be asked before a door is walked through.
  const empty = interiorRestPlace();
  assert.equal(empty.buildingType, BUILDING_TYPES.None);
  assert.equal(empty.buildingKey, 0);
  assert.equal(empty.insideBuilding, true);
  // ...and the whole bag drives canRest to the lodging arms.
  assert.equal(canRest({ ...bag, isPermanentScene: () => false }).text, HAVE_NOT_RENTED_ROOM);

  // The host reads the law rather than rebuilding its shape.
  assert.match(wm, /return interiorRestPlace\(\{/);
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
  // A foe with NO distance yet: the fallback is Infinity ("skip an
  // unaware foe of unknown range"), not 0 ("count it"). Real foes are
  // safe - EnemyMotor mints _dist Infinity - but the direction is the
  // load-bearing half and no fixture had ever taken it.
  assert.equal(areEnemiesNearby([foe({ _dist: undefined, wouldBeSpawned: true })], { resting: true }), false);
  assert.equal(areEnemiesNearby([foe({ _dist: undefined, detected: true, inSight: true })], { resting: true }), true);
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
  // exterior.js's POOL, not just its call: `[^)]*` happily matches an
  // empty array, and in that host the city watch is the ONLY pool - so
  // an empty one means you sleep through a watch that is beating you.
  assert.match(src('src/scenes/exterior.js'), /areEnemiesNearby\(cityGuards\.guards, \{ resting: true \}\)/);
  assert.match(src('src/scenes/dungeonContext.js'), /areEnemiesNearby\(foes, \{ resting: true \}\)/);
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


test('S40 IsResting: raised on OPEN, cleared on EVERY exit, and the enchant rate reads it', () => {
  // OnPush (:266-268) with DFU's own comment: "Raise player resting
  // flag when UI opens. This is used for random enemy spawning and
  // influences CastWhenHeld durability loss." The port HAS that
  // consumer - enchantments.js picks HELD_DEGRADE_RATE_RESTING (60)
  // over HELD_DEGRADE_RATE (4), a 15x difference - and nothing fed it,
  // because rest lived in the one host whose enchant ctx is unmounted.
  const e = { isPlayer: true, level: 1, health: 5, maxHealth: 10, magicka: 0,
    maxMagicka: 8, fatigue: 0, stats: { strength: 50, endurance: 50, willpower: 50 },
    skills: 20, career: {}, skillUses: { [SKILLS.Medical]: 0 } };
  const mk = () => new RestWindow(createRestDeps(e, {
    advanceMinutes() {}, endLines: (id) => [`RSC${id}`],
  }));

  // OPEN raises it - before any hour is rested, before a mode is even
  // picked. Standing in the window already costs a held enchantment.
  const w = mk();
  assert.equal(e.isResting, true);

  // ...and EVERY exit clears it. Five doors reach `done`, and a flag
  // cleared on four of them would leave the player permanently
  // resting and burn held enchantments 15x for the session.
  w.input('back');                       // the selection page's Esc
  assert.equal(w.done, true);
  assert.equal(e.isResting, false);

  const w2 = mk();                       // the finished-popup close
  w2.input('char:1'); w2.input('char:1'); w2.input('confirm');
  for (let i = 0; i < 5000 && w2.state === 'resting'; i++) w2.tick(REST_WAIT_PER_HOUR / 10 + 1e-9);
  assert.equal(e.isResting, true, 'still resting while the end page is up');
  w2.input('confirm');
  assert.equal(e.isResting, false);

  const w3 = mk();                       // dispose(), the host's door
  assert.equal(e.isResting, true);
  w3.dispose();
  assert.equal(e.isResting, false);
  assert.equal(w3.done, true);

  const w4 = mk();                       // a refusal
  Object.assign(w4.deps, { restPlace: () => ({ inTownStrict: true }) });
  _resetForTests();
  setValue('GUI', 'IllegalRestWarning', 'False');
  w4.input('char:1');
  assert.equal(w4.state, 'refused');
  w4.input('confirm');
  assert.equal(e.isResting, false);

  // The loiter prompt raises IsLoitering (:789); OnPop clears it
  // (:285). DFU has no consumer for it either - it is carried so a
  // later reader finds it right, not because anything reads it here.
  const w5 = mk();
  w5.input('char:3'); w5.input('char:1'); w5.input('confirm');
  assert.equal(e.isLoitering, true);
  w5.dispose();
  assert.equal(e.isLoitering, false);
  // ...and a plain rest does NOT set it.
  const w6 = mk();
  w6.input('char:1'); w6.input('char:1'); w6.input('confirm');
  assert.equal(e.isLoitering, false);

  // The consumer is wired: world.js' enchant ctx (which the INTERIOR
  // mode shares) reads the flag, and the false comment that said it
  // "stays absent above ground" is gone.
  const wj = src('src/scenes/world.js');
  assert.match(wj, /isResting: \(\) => !!playerEntity\.isResting,/);
  assert.doesNotMatch(wj, /isResting stays absent/);
  // ...and the flags are written by the ONE composition, not by four
  // hosts that each have to remember.
  assert.match(src('src/scenes/shared.js'), /setResting: \(b\) => \{ entity\.isResting = !!b; \},/);
  assert.match(src('src/scenes/shared.js'), /setLoitering: \(b\) => \{ entity\.isLoitering = !!b; \},/);
  // The window has exactly ONE door that sets `done`.
  assert.equal((src('src/ui/restWindow.js').match(/this\.done = true/g) ?? []).length, 1);
});


test('S40 ShowStatus: FullRest counts hours PAST, timed and loiter count DOWN', () => {
  // ShowStatus (:317-346) picks a different NUMBER and a different
  // background per mode: hoursPastTexture + totalHours for FullRest,
  // hoursRemainingTexture + hoursRemaining for TimedRest and Loiter.
  // The port showed hours-past for all three, so a timed rest counted
  // UP where classic counts DOWN. The backgrounds are still FLAGGED
  // pending art; the number is not a presentation choice.
  const page = (mode, hours) => {
    const w = new RestWindow(winDeps());
    w.input(mode === 'loiter' ? 'char:3' : mode === 'full' ? 'char:2' : 'char:1');
    if (mode !== 'full') { w.input(`char:${hours}`); w.input('confirm'); }
    // Rest one hour so the two numbers actually differ. LOITER runs on
    // its OWN cadence (LOITER_WAIT_PER_HOUR, 1.25s an hour against
    // rest's 0.75), and a helper that used the rest rate for all three
    // advanced a loiter only 36 minutes - which is the fixture-at-a-
    // boundary trap this file has already been caught by twice.
    const per = (mode === 'loiter' ? LOITER_WAIT_PER_HOUR : REST_WAIT_PER_HOUR) / 10;
    for (let i = 0; i < 6; i++) w.tick(per + 1e-9);
    return w;
  };
  const t = page('timed', 5);
  assert.equal(t.session.totalHours, 1);
  assert.equal(t.session.hoursRemaining, 4, 'one of five hours is gone');
  const l = page('loiter', 3);
  assert.equal(l.session.hoursRemaining, 2);
  const f = page('full');
  assert.equal(f.session.totalHours, 1);

  // The draw branch reads the right one per mode.
  const w = src('src/ui/restWindow.js');
  assert.match(w, /this\.mode === 'full'\n\s+\? `Hours passed: \$\{this\.session\.totalHours\}`\n\s+: `Hours remaining: \$\{this\.session\.hoursRemaining\}`/);
});

test('S40: an encounter raised BEFORE a mode is picked still breaks the rest', () => {
  // GameManager_OnEncounter is subscribed in OnPush (:264) and sets
  // the latch on the WINDOW; DFU never resets it, so a CreateFoe wave
  // that lands while the player is still on the selection page fires
  // on the first TickRest after a mode IS picked (:351-354). The port
  // held the latch on the session, which does not exist yet then - so
  // the wave was simply lost.
  const w = new RestWindow(winDeps());
  assert.equal(w.session, null, 'no session on the selection page');
  w.abortForEnemySpawn();
  w.input('char:1'); w.input('char:9'); w.input('confirm');
  const r = w.session.tick(0);
  assert.equal(r.enemyBroke, true);
  assert.equal(r.textId, REST_TEXT.enemiesNearby);

  // ...and mid-rest it still latches straight through.
  const w2 = new RestWindow(winDeps());
  w2.input('char:1'); w2.input('char:9'); w2.input('confirm');
  w2.abortForEnemySpawn();
  assert.equal(w2.session.tick(0).enemyBroke, true);

  // All four hosts route to the WINDOW, not to its session.
  for (const f of ['src/scenes/dungeonContext.js', 'src/scenes/worldModes.js',
    'src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(src(f), /\.abortForEnemySpawn\?\.\(\)/, f);
    assert.doesNotMatch(src(f), /session\?\.abortForEnemySpawn/, `${f}: the session is not the latch's home`);
  }
});

test('S40 endEarly: stopping a COMPLETED FullRest still says healed', () => {
  // EndRest's FullRest arm (:493-499) picks the message at the moment
  // it runs - `IsPlayerFullyHealed() ? healed : wakeUp` - not at the
  // moment the hours ran out.
  const healed = new RestWindow(winDeps({ fullyHealed: () => true }));
  healed.input('char:2');
  assert.equal(healed.session.endEarly().textId, REST_TEXT.healed);
  const hurt = new RestWindow(winDeps({ fullyHealed: () => false }));
  hurt.input('char:2');
  assert.equal(hurt.session.endEarly().textId, REST_TEXT.wakeUp);
  // A timed rest stopped early always wakes; a loiter always loiters.
  const t = new RestWindow(winDeps({ fullyHealed: () => true }));
  t.input('char:1'); t.input('char:5'); t.input('confirm');
  assert.equal(t.session.endEarly().textId, REST_TEXT.wakeUp);
  const l = new RestWindow(winDeps({ fullyHealed: () => true }));
  l.input('char:3'); l.input('char:2'); l.input('confirm');
  assert.equal(l.session.endEarly().textId, REST_TEXT.loiterDone);
});


test('S40: PopToHUD runs BEFORE RaiseSkills, so a rest-end level-up is not swallowed', () => {
  // RestFinishedPopup_OnClose is `PopToHUD(); RaiseSkills();`
  // (:728-732), in that order. Every host guards its onLevelUp with
  // "only if the overlay slot is free" - and the slot still held THIS
  // window at that moment, so the guard was false and the level-up
  // screen never appeared. advancement.js then took its headless arm
  // and dumped every point into the LOWEST stats, which is the exact
  // defect AUDIT 21 hosts F3 fixed once already for the ticker path.
  const order = [];
  const w = new RestWindow(winDeps({
    onClose: () => order.push('popToHUD'),
    onRestFinished: () => order.push('raiseSkills'),
  }));
  w.input('char:1'); w.input('char:1'); w.input('confirm');
  for (let i = 0; i < 5000 && w.state === 'resting'; i++) w.tick(REST_WAIT_PER_HOUR / 10 + 1e-9);
  assert.equal(w.state, 'ended');
  assert.deepEqual(order, []);
  w.input('confirm');
  assert.deepEqual(order, ['popToHUD', 'raiseSkills'], 'the slot is vacated FIRST');

  // Every exit vacates - a window that leaves itself in the slot is a
  // window the host paints forever.
  for (const exit of [(x) => x.input('back'), (x) => x.dispose()]) {
    const seen = [];
    const v = new RestWindow(winDeps({ onClose: () => seen.push(1) }));
    exit(v);
    assert.deepEqual(seen, [1]);
  }

  // The three hosts that mount it supply the door, identity-guarded.
  assert.match(src('src/scenes/worldModes.js'),
    /onClose: \(\) => \{ if \(interiorOverlay\?\.isRestWindow\) interiorOverlay = null; \},/);
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(src(f), /onClose: \(\) => \{ if \(townTalk\.overlay\?\.isRestWindow\) townTalk\.closeOverlay\?\.\(\); \},/, f);
  }
  // ...and townTalk grew that door, with the caller's identity guard.
  assert.match(src('src/scenes/townTalk.js'), /closeOverlay\(win = null\) \{\n\s+if \(!overlay \|\| \(win && overlay !== win\)\) return false;/);
});

test('S40: the window owns the POINTER, so no host grabs look under it', () => {
  // townTalk.pointerdown bails on any overlay with no `click` (:595),
  // after which world.js/exterior.js fall through to requestLook and
  // grab pointer lock UNDER the open window - the camera then spins
  // behind the rest panel. The two modal hosts refuse exactly that,
  // and the seam they refuse through is the presence of this method.
  const w = new RestWindow(winDeps());
  assert.equal(typeof w.click, 'function');
  assert.equal(w.click(), true, 'the window owns the click either way');

  // A click on the running page STOPS the rest (StopButton_OnMouseClick
  // :708-712), and on the end page closes it.
  const r = new RestWindow(winDeps());
  r.input('char:1'); r.input('char:2'); r.input('confirm');
  assert.equal(r.state, 'resting');
  r.click();
  assert.equal(r.state, 'ended');
  r.click();
  assert.equal(r.done, true);

  // ...and a refusal closes on a click too.
  _resetForTests();
  setValue('GUI', 'IllegalRestWarning', 'False');
  const f = new RestWindow(winDeps({ restPlace: () => ({ inTownStrict: true }) }));
  f.input('char:1');
  assert.equal(f.state, 'refused');
  f.click();
  assert.equal(f.done, true);

  // The header no longer claims a key re-route no host performs.
  const w2 = src('src/ui/restWindow.js');
  assert.doesNotMatch(w2, /the rest key\n\/\/ re-routed as 'back'/);
  assert.doesNotMatch(src('src/scenes/dungeonContext.js'), /A second press\n\s+\/\/ routes through the overlay as 'back'/);
});

test('S40: the interior overlay seam DRAINS done, like the other three', () => {
  // RestWindow sets `done` from inside tick() on two paths (the death
  // exit and a missing endLines), and worldModes' seam ticked without
  // draining - so such a window stayed painted over the world. The
  // other three seams all drain and two call it not optional.
  assert.match(src('src/scenes/worldModes.js'),
    /if \(interiorOverlay\?\.done\) \{ interiorOverlay\.dispose\?\.\(\); interiorOverlay = null; \}/);
  // The death path is the one that reaches it: _end() closes without
  // ever entering the 'ended' state.
  const w = new RestWindow(winDeps({ dead: () => true }));
  w.input('char:1'); w.input('char:1'); w.input('confirm');
  w.tick(0);
  assert.equal(w.done, true, 'death ends the window from inside tick');
  assert.equal(w.state, 'resting', 'and never through the ended page');
});


test('S40 IsResting: the THIRD consumer - no per-minute fatigue drain while resting', () => {
  // PlayerEntity.cs:417-418 verbatim: `if (!isResting)
  // DecreaseFatigue(amount);`, inside the per-minute block. The port
  // charged it through every rested minute - 66 an hour, measured -
  // and a LOITER, which by DFU's own law calls no tickVitals, has
  // nothing restoring it, so a long enough loiter drained the player
  // toward exhaustion while they stood about.
  //
  // The comment that let this through said the flag's "one consumer
  // is CastWhenHeld's degrade rate". There are THREE, and DFU's own
  // comment at :266-267 already names two of them.
  const mk = () => ({
    isPlayer: true, level: 5, health: 50, maxHealth: 50, magicka: 0, maxMagicka: 40,
    fatigue: 6400, stats: { strength: 50, endurance: 50, willpower: 50 },
    skills: 30, career: {}, skillUses: {},
  });
  const hour = (resting) => {
    const e = mk(); e.isResting = resting;
    setWorldMinutes(1000);
    const t = createPlayerTicker(e, {});
    for (let i = 0; i < 6; i++) t.advance(10);
    return 6400 - e.fatigue;
  };
  assert.ok(hour(false) > 0, 'awake, the per-minute drain bills');
  assert.equal(hour(true), 0, 'resting, it does not');

  // The gate is on THIS drain only. The JUMPING one is C#:427, outside
  // the per-minute block and ungated - a mutant that guarded both, or
  // that guarded the wrong one, has to fail.
  const jumped = (resting) => {
    const e = mk(); e.isResting = resting;
    setWorldMinutes(1000);
    const t = createPlayerTicker(e, {});
    t.tick(1 / 60, { running: false, swimming: false, jumped: true });
    return 6400 - e.fatigue;
  };
  assert.ok(jumped(true) > 0, 'a jump still costs fatigue while the window is up');

  // ...and the Swimming tally at C#:414 runs BEFORE the gate.
  const sw = mk(); sw.isResting = true; sw.raceId = 99; sw.skillUses = { };
  setWorldMinutes(1000);
  createPlayerTicker(sw, {}).tick(60 / 12, { running: false, swimming: true });
  assert.match(src('src/systems/worldTick.js'),
    /tallySkill\(entity, SKILLS\.Swimming\);[\s\S]{0,900}?if \(!entity\.isResting\) sinks\.drainFatigue/);

  // The window is what raises the flag, so the gate is live end to end.
  const e = mk();
  const w = new RestWindow(createRestDeps(e, { advanceMinutes() {}, endLines: (id) => [`t${id}`] }));
  assert.equal(e.isResting, true);
  w.dispose();
  assert.equal(e.isResting, false);
});


test('S40 RestWindow: the hours page - PREFILLED with 0, and the 99-hour arm is DFU\'s', () => {
  // Two laws that had no test in the repo, and both were WRONG once
  // the C# was read properly. DFU sets `mb.TextBox.Text = "0"` (:619,
  // :700) with `MaxCharacters = 8` (:621, :702) - so Enter on an
  // untouched prompt parses "0" and starts a 0-hour rest, and the
  // unparseable no-op is reachable only after the field is EMPTIED.
  // The port started the field empty with a 2-digit cap and called
  // that "the 99-hour cap by construction", which made DFU's actual
  // 99-hour arm (TEXT.RSC 26, :753-757) unreachable.
  _resetForTests();
  let minutes = 0;
  const w = new RestWindow(winDeps({ advanceMinutes: (n) => { minutes += n; } }));
  w.input('char:1');
  assert.equal(w.value, PROMPT_INITIAL, 'the field is prefilled with "0"');

  // Enter on the untouched prompt: a 0-hour rest that passes no time.
  w.input('confirm');
  assert.equal(w.state, 'resting');
  assert.equal(w.session.hoursRemaining, 0);
  assert.equal(w.session.tick(1).textId, REST_TEXT.wakeUp);
  assert.equal(minutes, 0, 'no world time at all');

  // Emptied and confirmed: THAT is the unparseable no-op.
  const e = new RestWindow(winDeps());
  e.input('char:1'); e.input('backspace');
  assert.equal(e.value, '');
  e.input('confirm');
  assert.equal(e.state, 'hours', 'an emptied field does nothing');
  assert.equal(e.session, null);

  // The field takes EIGHT characters, not two...
  const wide = new RestWindow(winDeps());
  wide.input('char:1'); wide.input('backspace');
  for (let i = 0; i < 12; i++) wide.input('char:7');
  assert.equal(wide.value, '77777777');
  assert.equal(wide.value.length, PROMPT_MAX_CHARS);

  // ...and the 99-hour refusal is what stops a longer rest, with the
  // prompt STAYING UP and the field reset, exactly as :753-757.
  wide.input('confirm');
  assert.equal(wide.state, 'hours', 'refused, not started');
  assert.deepEqual(wide.notice, [`text:${CANNOT_REST_MORE_THAN_99_HOURS_ID}`]);
  assert.equal(wide.value, PROMPT_INITIAL);
  assert.equal(wide.session, null);
  // 99 exactly is allowed - the arm is `time > 99`.
  wide.input('backspace'); wide.input('char:9'); wide.input('char:9');
  wide.input('confirm');
  assert.equal(wide.state, 'resting');
  assert.equal(wide.session.hoursRemaining, 99);
});

test('S40: a refused OPEN GATE actually shows its record, in every host', () => {
  // The gate's textId was pinned on the way OUT of restOpenGate and
  // never on the way INTO a host: deleting the two lines that look the
  // record up and mount it left `return;` alone, and the player got
  // SILENCE instead of TEXT.RSC 355 while swimming or 354 with foes.
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    const h = src(f);
    const arm = h.slice(h.indexOf('const gate = restOpenGate({'), h.indexOf('const gate = restOpenGate({') + 1400);
    assert.match(arm, /const lines = townTalk\.lines\(gate\.textId\);/, f);
    assert.match(arm, /if \(lines\) townTalk\.showOverlay\(new ActionTextBox\(lines\)\);/, f);
  }
  const wm = src('src/scenes/worldModes.js');
  const iarm = wm.slice(wm.indexOf('const gate = restOpenGate({'), wm.indexOf('const gate = restOpenGate({') + 1400);
  assert.match(iarm, /const lines = townTalk\?\.lines\?\.\(gate\.textId\);/);
  assert.match(iarm, /if \(lines\) mountInterior\(new ActionTextBox\(lines\)\);/);
  const dc = src('src/scenes/dungeonContext.js');
  const darm = dc.slice(dc.indexOf('const gate = restOpenGate({'), dc.indexOf('const gate = restOpenGate({') + 1400);
  assert.match(darm, /const lines = rscLines\(gate\.textId\);/);
  assert.match(darm, /if \(lines\) activeOverlay = new ActionTextBox\(lines\);/);
  // ...and the two records the gate can name are the right two.
  assert.equal(restOpenGate({ enemiesNearby: true }).textId, 354);
  assert.equal(restOpenGate({ swimming: true }).textId, 355);
});


test('S40: EVERY EndRest arm raises skills - the death exit included', () => {
  // All four EndRest arms attach OnClose (:461-462, :468-469, :482-483,
  // :489-490, :496-497), the DEATH arm among them: DFU sets
  // `youNeverAwaken` and calls EndRest, whose box closes into
  // PopToHUD + RaiseSkills. The port dropped the raise on death and on
  // a missing endLines, losing a whole night's advancement to a poison
  // that killed the sleeper. The ONE EndRest-adjacent path with no
  // OnClose is CanRest's refusal (:594-596), and that one must stay
  // silent - which is the pair this pin holds apart.
  let raised = 0;
  const mk = (over) => new RestWindow(winDeps({ onRestFinished: () => { raised++; }, ...over }));

  const dead = mk({ dead: () => true });
  dead.input('char:1'); dead.input('char:1'); dead.input('confirm');
  dead.tick(0);
  assert.equal(dead.done, true);
  assert.equal(raised, 1, 'the death exit raises');

  raised = 0;
  const mute = mk({ endLines: () => null });
  mute.input('char:1'); mute.input('char:1'); mute.input('confirm');
  for (let i = 0; i < 5000 && !mute.done; i++) mute.tick(REST_WAIT_PER_HOUR / 10 + 1e-9);
  assert.equal(raised, 1, 'and so does a host whose TEXT.RSC came back empty');

  // ...but a REFUSAL does not. CanRest's is the one arm DFU leaves
  // without an OnClose, and closing it must raise nothing.
  raised = 0;
  _resetForTests();
  setValue('GUI', 'IllegalRestWarning', 'False');
  const no = mk({ restPlace: () => ({ inTownStrict: true }) });
  no.input('char:1');
  assert.equal(no.state, 'refused');
  no.input('confirm');
  assert.equal(no.done, true);
  assert.equal(raised, 0, 'a refusal raises nothing');

  // All FOUR hosts supply the PopToHUD door, not three.
  assert.match(src('src/scenes/dungeonContext.js'),
    /onClose: \(\) => \{ if \(activeOverlay\?\.isRestWindow\) activeOverlay = null; \},/);
  assert.match(src('src/scenes/worldModes.js'),
    /onClose: \(\) => \{ if \(interiorOverlay\?\.isRestWindow\) interiorOverlay = null; \},/);
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(src(f), /onClose: \(\) => \{ if \(townTalk\.overlay\?\.isRestWindow\) townTalk\.closeOverlay\?\.\(\); \},/, f);
  }
  // The identity guard is what stops the death screen being nulled by
  // a rest window closing underneath it.
  assert.match(src('src/ui/restWindow.js'), /this\.deps\.onClose\?\.\(\);/);
});


test('S40: the quest machine ticks THROUGH a rest, which is what the sub-tick is FOR', () => {
  // TickRest :376-379 is two calls in one sub-tick: `RaiseTime
  // (minutesPerTick * 60)` then `QuestMachine.Instance.Tick()`. DFU's
  // own comment two lines above says why the ten-minute granularity
  // exists at all: "This allows quest machine to have more time
  // resolution while still counting off rest in hourly increments."
  //
  // The port ported the clock half and not the quest half - and every
  // host gates its ordinary questBridge.tick on "no overlay up", so a
  // rested night ran ZERO quest ticks. Exactly the shape AUDIT 24
  // wave 30 found for the magic-round half and fixed only there.
  const beats = [];
  const s2 = new RestSession('timed', 2, {
    advanceMinutes: (n) => beats.push(['clock', n]),
    tickQuests: () => beats.push(['quest']),
    tickVitals: () => false, fullyHealed: () => false,
    enemiesNearby: () => false, dead: () => false,
  });
  for (let i = 0; i < 6; i++) s2.tick(REST_WAIT_PER_HOUR / 10 + 1e-9);
  // One hour = six sub-ticks, each a clock beat THEN a quest beat.
  assert.equal(beats.filter((b) => b[0] === 'quest').length, 6);
  assert.deepEqual(beats.slice(0, 4), [['clock', 10], ['quest'], ['clock', 10], ['quest']],
    'RaiseTime first, then the machine - DFU\'s order');

  // It is UNPACED: DFU calls the machine directly, bypassing
  // QuestMachine.Update's ticksPerSecond timer, so the hosts must
  // reach `machine.tick` and not questBridge.tick.
  for (const f of ['src/scenes/world.js', 'src/scenes/worldModes.js']) {
    assert.match(src(f), /tickQuests: \(\) => questBridge\?\.machine\?\.tick\?\.\(\),/, f);
  }
  assert.match(src('src/scenes/dungeonContext.js'),
    /tickQuests: \(\) => opts\.questBridge\?\.machine\?\.tick\?\.\(\),/);
  // exterior.js mounts no bridge at all, and says so rather than
  // omitting the key - the construction sweep should see a decision.
  assert.match(src('src/scenes/exterior.js'), /tickQuests: null,/);
  // ...and the ordinary tick really is gated on the overlay, which is
  // what made this reachable.
  assert.match(src('src/scenes/world.js'), /if \(!townTalk\.overlayActive && !_loading\) questBridge\.tick\(dt\);/);
  assert.match(src('src/scenes/worldModes.js'), /if \(!overlayHeld\) questBridge\?\.tick\(dt\);/);
});
