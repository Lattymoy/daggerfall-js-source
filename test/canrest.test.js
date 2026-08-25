// V5 - CanRest, and the four hosts that could not sleep.
//
// The first-hour playthrough probe made this concrete rather than
// theoretical: a character walked out of Privateer's Hold at 6/31
// health, travelled to Burgley, found an innkeeper, rented a room for
// five gold - the gold left the purse, the rental record landed - and
// then pressing Rest in that room opened nothing at all.
//
// Two things were missing and only one of them was obvious.
//
// The obvious one: `ctx.toggleRest` (ui/input.js:106, the ONLY
// consumer of the Rest binding) had exactly one implementation in the
// whole tree, dungeonContext's, so KeyR was dead in three of the four
// hosts. RestWindow and RestSession have been finished since U7; they
// simply had nobody to open them.
//
// The one underneath: DaggerfallRestWindow.CanRest (:542-600) was
// unported ENTIRELY. systems/restSession.js' own header had said so
// since U7 - "Building trespass/rent rules pend towns" - which is
// four audits of a line that reads like a footnote and is actually
// the whole town half of resting: the camping refusal, the Vagrancy
// charge and the watch, the rented-room / owned-house / ship / guild
// -hall ladder, the "You have not rented a room here." line, and the
// allocated-bed teleport.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canRest, remainingHoursRented, REST_TEXT, HAVE_NOT_RENTED_ROOM, BUILDING_TAVERN,
} from '../src/systems/restSession.js';
import { isPlayerInTown, TOWN_LOCATION_TYPES } from '../src/systems/nearbyObjects.js';
import { plainLines } from '../src/scenes/shared.js';
import { LOCATION_TYPES } from '../src/formats/mapsFile.js';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const code = (p) => readFileSync(join(SRC, p), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split('\n').map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');

const HOUR = 60;
const inn = (over) => ({ inTownLocation: true, insideBuilding: true, ...over });

test('V5: IsPlayerInTown - the seven town types, and mustBeOutside read the right way round', () => {
  // PlayerGPS.cs:504-527. Getting mustBeOutside backwards inverts the
  // whole rest law: every inn in Tamriel would refuse a bed and charge
  // vagrancy for asking.
  assert.deepEqual([...TOWN_LOCATION_TYPES].sort((a, b) => a - b), [0, 1, 2, 3, 5, 6, 8],
    'TownCity/Hamlet/Village, HomeFarms, ReligionTemple, Tavern, HomeWealthy');
  // NOT towns: the four dungeon types, ReligionCult, HomePoor, Graveyard, Coven, ships
  for (const t of ['DungeonLabyrinth', 'DungeonKeep', 'DungeonRuin', 'ReligionCult', 'HomePoor', 'Graveyard', 'Coven', 'HomeYourShips']) {
    assert.equal(isPlayerInTown(LOCATION_TYPES[t]), false, `${t} is not a town`);
  }
  const city = LOCATION_TYPES.TownCity;
  const args = { mustBeInLocationRect: true, mustBeOutside: true };
  assert.equal(isPlayerInTown(city, { ...args, inLocationRect: true, inside: false }), true, 'in the open, in the rect');
  assert.equal(isPlayerInTown(city, { ...args, inLocationRect: true, inside: true }), false, 'INSIDE a building is not "outside"');
  assert.equal(isPlayerInTown(city, { ...args, inLocationRect: false, inside: false }), false, 'outside the rect');
  // ...and with neither gate asked for, the type alone answers
  assert.equal(isPlayerInTown(city), true);
  assert.equal(isPlayerInTown(city, { inside: true }), true, 'mustBeOutside not asked = inside is irrelevant');
});

test('V5: the wilderness is free, which is the arm the dungeon always took', () => {
  const v = canRest({});
  assert.equal(v.allowed, true);
  assert.equal(v.crime, undefined, 'no crime out in the wild');
  assert.equal(v.bedIndex, -1, 'and no bed to be moved to');
});

test('V5: camping in a town - refused first, ALLOWED when confirmed, charged either way', () => {
  // :549-561. The return IS `alreadyWarned`, which reads like a bug
  // and is the two-step: the buttons ask "It is illegal to camp in or
  // near a city. Continue?" and call back with true.
  const first = canRest({ inTownOutside: true });
  assert.equal(first.allowed, false, 'the first press refuses');
  assert.equal(first.textId, REST_TEXT.cityCampingIllegal, 'and speaks TEXT.RSC 17');

  const confirmed = canRest({ inTownOutside: true, alreadyWarned: true });
  assert.equal(confirmed.allowed, true, 'a confirmed camp is allowed');
  assert.equal(confirmed.textId, null, 'and does not re-speak the refusal');

  // THE HALF THAT IS EASY TO DROP: the crime and the watch are
  // registered on BOTH paths. A player who backs out has still
  // committed vagrancy; with the warning setting off they commit it on
  // every press and can never actually camp.
  for (const v of [first, confirmed]) {
    assert.equal(v.crime, 'Vagrancy');
    assert.equal(v.spawnGuards, true);
  }
});

test('V5: inside a town building with no claim on it - the refusal line', () => {
  const v = canRest(inn({}));
  assert.equal(v.allowed, false);
  assert.equal(v.line, HAVE_NOT_RENTED_ROOM);
  assert.equal(v.crime, undefined, 'asking for a bed you have not paid for is not a crime');
});

test('V5: a rented room - allowed, and it names the bed the rental picked', () => {
  const room = { expiryMinutes: 3 * 24 * HOUR, allocatedBedIndex: 2 };
  const v = canRest(inn({ permanentScene: true, room, nowMinutes: 0, restMarkers: 4 }));
  assert.equal(v.allowed, true);
  assert.equal(v.hoursRented, 72);
  assert.equal(v.bedIndex, 2, 'the stored index, because building positions are not stable');

  // out of range falls to 0 (:582), it does not throw or refuse
  const wide = { expiryMinutes: 3 * 24 * HOUR, allocatedBedIndex: 9 };
  assert.equal(canRest(inn({ permanentScene: true, room: wide, nowMinutes: 0, restMarkers: 4 })).bedIndex, 0);
  // and with no markers at all there is simply nowhere to be moved to
  assert.equal(canRest(inn({ permanentScene: true, room, nowMinutes: 0, restMarkers: 0 })).bedIndex, -1);
});

test('V5: an EXPIRED room is not a room', () => {
  const room = { expiryMinutes: 0, allocatedBedIndex: 1 };
  const v = canRest(inn({ permanentScene: true, room, nowMinutes: 24 * HOUR, restMarkers: 4 }));
  assert.equal(v.allowed, false);
  assert.equal(v.line, HAVE_NOT_RENTED_ROOM);
});

test('V5: the DFU defect this shape avoids - a permanent scene with no rental record', () => {
  // :577-583 calls GetRemainingHours(room), which explicitly handles a
  // null room, and then reads `room.allocatedBedIndex` with no null
  // check at all. An expired rental the sweep has not yet collected is
  // a NullReferenceException there. Here it simply fails the gate.
  const v = canRest(inn({ permanentScene: true, room: null, restMarkers: 4 }));
  assert.equal(v.allowed, false);
  assert.equal(v.line, HAVE_NOT_RENTED_ROOM);
});

test('V5: a ship or a house you own needs no rental and no bed', () => {
  assert.equal(canRest(inn({ permanentScene: true, isShip: true })).allowed, true);
  assert.equal(canRest(inn({ permanentScene: true, houseOwned: true })).allowed, true);
  // ...and the permanent-scene gate is load-bearing: an ordinary shop
  // that happens to be a Ship type is not somewhere you can sleep
  assert.equal(canRest(inn({ isShip: true })).allowed, false);
});

test('V5: the guild-hall privilege, and the TAVERN exclusion that has to come with it', () => {
  assert.equal(canRest(inn({ buildingType: 19, guildCanRest: true, restMarkers: 2 })).allowed, true,
    'a Fighters Guild member sleeps in the hall');
  assert.equal(canRest(inn({ buildingType: 19, guildCanRest: true, restMarkers: 2 })).bedIndex, 0,
    'FindMarker, singular - the first rest marker');
  // DFU's own reason (:587): the data marks EVERY tavern a Fighters
  // Guild, so without this exclusion every innkeeper's common room
  // would be a free bed and nobody would ever rent one.
  assert.equal(canRest(inn({ buildingType: BUILDING_TAVERN, guildCanRest: true, restMarkers: 2 })).allowed, false);
  assert.equal(BUILDING_TAVERN, 15, 'DFLocation.BuildingTypes.Tavern');
});

test('V5: remainingHoursRented truncates toward zero, and answers -1 for no room', () => {
  assert.equal(remainingHoursRented(null, 0), -1);
  assert.equal(remainingHoursRented({ expiryMinutes: 90 }, 0), 1, 'an hour and a half is one hour');
  assert.equal(remainingHoursRented({ expiryMinutes: 0 }, 90), -1,
    'expired truncates toward zero, so it is NEGATIVE rather than 0 - and CanRest tests > 0');
});

test('V5: every host that can hold a player now has a rest arm', () => {
  // THE HOST RULE, which is the whole reason this lane existed. A law
  // with one caller is a law three quarters of the game cannot reach.
  const dungeon = code('scenes/dungeonContext.js');
  assert.match(dungeon, /toggleRest\(\)/, 'the dungeon has always had one');
  assert.match(code('scenes/worldModes.js'), /toggleRest\(\) \{ toggleInteriorRest\(\); \}/,
    'the interior arm, on the ctx U43 routes keys through');
  assert.match(code('scenes/world.js'), /toggleRest: \(\) => toggleExteriorRest\(\)/,
    'the exterior arm, on hudCtx');
  assert.match(code('scenes/world.js'), /act === 'Rest'/,
    'and the exterior key ladder actually routes the action');

  // The two new arms must both go through the LAW, not re-decide it.
  for (const h of ['scenes/world.js', 'scenes/worldModes.js']) {
    assert.match(code(h), /canRest\(\{/, `${h} calls CanRest rather than inventing a gate`);
  }
  // ...and the interior one must MOVE THE PLAYER TO THE BED (:601-609)
  assert.match(code('scenes/worldModes.js'), /verdict\.bedIndex >= 0 \? restMarkers\[verdict\.bedIndex\] : null/);
});

test('V5: ONE generic tick drives the rest window, so no host can forget it', () => {
  // RestWindow.tickRest was driven by an explicit `if (isRestWindow)`
  // branch that existed in the dungeon and nowhere else - the same
  // per-host-branch shape that made resting dungeon-only to begin
  // with. RestWindow.tick now forwards, every host already calls
  // `overlay.tick?.(dt)`, and the dungeon's explicit line had to GO or
  // it would rest at double speed.
  assert.match(code('ui/restWindow.js'), /tick\(dt\) \{ this\.tickRest\(dt\); \}/);
  assert.equal(/isRestWindow\) activeOverlay\.tickRest\(dt\)/.test(code('scenes/dungeonContext.js')), false,
    'the dungeon must NOT also tick it explicitly - that is a double tick');
  assert.match(code('scenes/dungeonContext.js'), /activeOverlay\.tick\?\.\(dt\)/, 'the generic call stays');
  assert.match(code('scenes/worldModes.js'), /interiorOverlay\.tick\?\.\(dt\)/);
  assert.match(code('scenes/townTalk.js'), /overlay\?\.tick\?\.\(dt\)/);
});

test('V5: TEXT.RSC rows are not strings, and the windows that draw them iterate strings', () => {
  // THE PAGE ERROR V5's FIRST CUT SHIPPED. textRsc.linesById (:216-247)
  // answers { text, center } records - the record's own bytes carry
  // justification - while RestWindow, ActionTextBox and ChoiceWindow
  // all `for (const l of lines) drawText(..., l)`, and drawText
  // iterates the string. Handing townTalk.lines(id) straight to a
  // RestWindow ended the rested night in
  //     TypeError: text is not iterable
  // from a draw path no unit test walks. The first-hour probe's own
  // zero-page-errors gate is what caught it, at the very last stage.
  assert.deepEqual(plainLines([{ text: 'You wake up.', center: false }]), ['You wake up.']);
  assert.deepEqual(plainLines(['already a string']), ['already a string'], 'idempotent');
  assert.deepEqual(plainLines([{ text: 'a' }, 'b', { text: '' }]), ['a', 'b', '']);
  assert.equal(plainLines([]), null, 'nothing to say is null, which is what _end tests');
  assert.equal(plainLines(null), null);
  assert.equal(plainLines(undefined), null);

  // Every site that hands rows to one of those windows must flatten.
  // A source rule, because the failure is a DRAW and the suite draws
  // nothing.
  // TWO DRAFTS OF THIS RULE WERE WRONG, in opposite directions, and
  // the red-proof caught both. The first spelled `townTalk?.lines?.(`
  // with optional dots, consumed the separator before `.lines`,
  // matched nothing and passed on the very build it was written to
  // reject. The second flagged by PROXIMITY - any TEXT.RSC read within
  // two lines of a window name - and then flagged the infection seam's
  // `textAt:` provider, which is safe precisely because the flatten
  // moved to its one consumer.
  //
  // So: the sites that BUILD the line list. `const lines = ...lines(...)`
  // is the shape both new rest arms use and the shape that broke.
  for (const h of ['scenes/world.js', 'scenes/worldModes.js']) {
    const offenders = code(h).split('\n')
      .map((l, i) => [l, i])
      .filter(([l]) => /^\s*const lines = .*\.lines\??\.?\(/.test(l) && !/plainLines/.test(l))
      .map(([l, i]) => `${h}:${i + 1}  ${l.trim()}`);
    assert.deepEqual(offenders, [],
      'a line list is built from TEXT.RSC ROWS and handed to a window that iterates STRINGS:\n'
      + offenders.join('\n'));
  }

  // THIS RULE CAUGHT A BUG THAT WAS NOT V5's, which is the best thing
  // that can happen to a rule written for one's own mistake. The
  // vampire message box - "Death is not eternal", TEXT.RSC 401 - takes
  // whatever `textAt` answers and hands it to a ChoiceWindow. Three of
  // the four hosts provide `townTalk.lines(id)`, which answers ROWS;
  // only dungeonContext provides `textRsc.plainText(id)`, which
  // answers strings. So that popup threw on draw everywhere above
  // ground and worked in a dungeon. Flattened at the ONE consumer, so
  // no provider has to be right.
  assert.match(code('scenes/shared.js'), /const lines = plainLines\(textAt\?\.\(id\)\);/,
    'wireInfectionVideos must flatten - three of its four providers answer TEXT.RSC rows');
  const providers = ['scenes/world.js', 'scenes/exterior.js', 'scenes/worldModes.js']
    .filter((h) => /textAt: \(id\) => townTalk\??\.?\??\.?lines/.test(code(h)));
  assert.equal(providers.length, 3,
    'the three town hosts still hand back ROWS - if that changes, the flatten above is why it is safe either way');
  // ...and the shared factory flattens for every host at once, so a
  // new host cannot get this wrong by omission.
  assert.match(code('scenes/shared.js'), /endLines: \(id\) => plainLines\(textLines\(id\)\)/);
});
