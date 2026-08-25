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
} from '../src/systems/restSession.js';
import { RestWindow } from '../src/ui/restWindow.js';
import { restVitals, restFullyHealed } from '../src/scenes/shared.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { isTownLocationType, TOWN_LOCATION_TYPES, LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { interiorSceneName } from '../src/systems/sceneCache.js';
import { setValue, _resetForTests } from '../src/systems/settings.js';
import { maxFatigue } from '../src/systems/statMods.js';
import { SKILLS } from '../src/systems/skills.js';

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

  // The dungeon host stopped hand-rolling this composition.
  const dc = src('src/scenes/dungeonContext.js');
  assert.match(dc, /restVitals\(playerEntity, \{ day: false, inside: true \}\)/);
  assert.doesNotMatch(dc, /fatigueRecoveryRate\(maxFatigue/);
});

// ---- the WIRING ------------------------------------------------------

test('S40 hosts: all four can now rest, and each supplies its own place', () => {
  // The interior host: the key arm, the place bag, and the deps.
  const wm = src('src/scenes/worldModes.js');
  assert.match(wm, /toggleRest\(\) \{ mountInterior\(new RestWindow\(interiorRestDeps\)\); \}/);
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
    // with, not after it.
    const ladder = s.slice(s.indexOf("if (!townTalk.overlayActive && (modes?.mode ?? 'exterior') === 'exterior') {"));
    assert.ok(ladder.indexOf("hudCtx.toggleRest()") < ladder.indexOf('\n    }'), `${f}: the Rest arm escaped the guard`);
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
