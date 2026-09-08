// ---------------------------------------------------------------------------
// AUDIT 64 - THE TRAVEL LANE (2026-09-08).
//
// Seven findings against the fast-travel / teleport arc, all of them
// clauses DFU spells and the port did not:
//
//   F18  performFastTravel's arrival reposition - DirectionFromStartMarker,
//        including the travelStartX/travelStartZ facing hint that is the
//        only thing separating it from RandomStartMarker.
//   F19  TeleportAway's RandomStartMarker, which the guild teleport dropped.
//   F20  the arrival clamp's SECOND arm, Career.DamageFromSunlight.
//   F21  the travel map door's career refusal, above the racial one.
//   F22  DaggerfallTravelPopUp_OnPostFastTravel's crime clear.
//   F23  the travel map's L/F keys, read from the DaggerfallShortcut table.
//   F24  the sunlightDamageFastTravelDay sentence.
//
// Every assertion below states the REFERENCE's value - the side DFU's
// table gives for a delta, the hour DFU raises a sun-averse arrival to,
// the sentence Internal_Strings.csv carries - so a revert of any one fix
// turns it red rather than merely reshaping it.
// ---------------------------------------------------------------------------
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  pickLocationSide, LOCATION_SIDES, locationArrivalLanding,
  LOCATION_TYPE_TOWN_CITY, EXTRA_DISTANCE,
} from '../src/world/locationEntrance.js';
import { REPOSITION } from '../src/systems/ship.js';
import { RMB_SIDE } from '../src/world/locationLayout.js';
import { arrivalClampMinutes } from '../src/systems/travel.js';
import { careerSunDamage } from '../src/systems/passiveSpecials.js';
import { SPECIAL_ABILITY_BITS } from '../src/systems/specialAdvantages.js';
import { SUNLIGHT_TRAVEL_TEXT, racialFastTravelBlock } from '../src/systems/vampirism.js';
import { isDayFromMinutes } from '../src/systems/gameDate.js';

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

/** MapsFile.MapPixelToWorldCoord's own unit - one map pixel of world. */
const PIXEL = 32768;

// ── F18: THE SIDE PICK (StreamingWorld.cs:1481-1521) ─────────────────

test('AUDIT 64 F18: DirectionFromStartMarker weights the side by where the journey began', () => {
  // DFU's table, read off StreamingWorld.cs:1503-1518, is stated here
  // rather than derived from the port: side 3 is WEST, 2 is EAST, 1 is
  // SOUTH, 0 is NORTH, and each side faces back INTO the location
  // (:1537-1564). A journey EASTWARD (worldDeltaX > 0, the destination
  // east of the start) therefore lands the player on the location's
  // WEST edge - the side they came from - facing east.
  assert.deepEqual(LOCATION_SIDES.map((s) => `${s.name}:${s.facing}`),
    ['north:180', 'south:0', 'east:270', 'west:90'],
    'the four sides in Random.Range(0, 4) order, with SetFacing\'s degrees');

  const purelyEW = (dx) => pickLocationSide({
    travelStart: { x: 0, z: 0 },
    worldPos: { x: dx, z: 0 },
    roll: () => 0,
  });
  assert.equal(purelyEW(3 * PIXEL), 3, ':1507 - travelled EAST, so the WEST side');
  assert.equal(purelyEW(-3 * PIXEL), 2, ':1507 - travelled WEST, so the EAST side');

  const purelyNS = (dz) => pickLocationSide({
    travelStart: { x: 0, z: 0 },
    worldPos: { x: 0, z: dz },
    roll: () => 0,
  });
  assert.equal(purelyNS(3 * PIXEL), 1, ':1515 - travelled NORTH, so the SOUTH side');
  assert.equal(purelyNS(-3 * PIXEL), 0, ':1515 - travelled SOUTH, so the NORTH side');

  // :1502-1509 - the roll decides between the two candidate sides in
  // proportion px : pz. px = 3, pz = 1, so Random.Range(0, 4) < 3 takes
  // the E-W side and 3 takes the N-S one.
  const mixed = (r) => pickLocationSide({
    travelStart: { x: 0, z: 0 },
    worldPos: { x: 3, z: 1 },
    roll: () => r,
  });
  assert.equal(mixed(0), 3, 'random 0 < px: the E-W front side, and dx > 0 is West');
  assert.equal(mixed(0.5), 3, 'random 2 < px: still the E-W side');
  assert.equal(mixed(0.99), 1, 'random 3 is not < px: the N-S side, and dz > 0 is South');

  // AUDIT 64 F18 (review): the N-S branch has two arms too, and the
  // ELSE one is :1516-1517 - `side = worldDeltaX > 0 ? 3 : 2;`, the
  // same E-W pair the if-arm at :1507 gives, reached when the roll
  // misses the front side. px = 1, pz = 3, Random.Range(0, 4) = 3,
  // which is NOT < pz, so the answer is the E-W side and dx > 0 is West.
  assert.equal(pickLocationSide({
    travelStart: { x: 0, z: 0 }, worldPos: { x: 1, z: 3 }, roll: () => 0.99,
  }), 3, ':1517 - the N-S branch\'s miss takes the WEST side for an eastward journey');
  assert.equal(pickLocationSide({
    travelStart: { x: 0, z: 0 }, worldPos: { x: -1, z: 3 }, roll: () => 0.99,
  }), 2, ':1517 - and the EAST side for a westward one');

  // :1503 - `if (px > pz)` is STRICT, so an exactly diagonal journey
  // takes the N-S branch. px = pz = 2, Random.Range(0, 4) = 3, which is
  // not < pz, so :1517 again: dx > 0 is West. (Under `px >= pz` the
  // E-W branch would answer 1, South.)
  assert.equal(pickLocationSide({
    travelStart: { x: 0, z: 0 }, worldPos: { x: 2, z: 2 }, roll: () => 0.99,
  }), 3, ':1503 - px > pz is strict; the tie is the N-S branch');

  // :1483-1487 and :1494-1495 - no hint, or a zero delta, is the plain
  // Random.Range(0, 4) every OTHER caller of the arm takes.
  for (const [i, r] of [[0, 0], [1, 0.3], [2, 0.6], [3, 0.99]]) {
    assert.equal(pickLocationSide({ roll: () => r }), i, 'no hint: Random.Range(0, 4)');
    assert.equal(pickLocationSide({
      travelStart: { x: 5, z: 5 }, worldPos: { x: 5, z: 5 }, roll: () => r,
    }), i, 'a zero delta falls back to the same roll');
  }
});

test('AUDIT 64 F18: the hint reaches the landing, and the landing is an EDGE, not a centre', () => {
  const origin = [1000, 4, 2000];
  const town = {
    name: 'Somewhere', regionIndex: 17,
    mapTableData: { mapId: 1, locationType: LOCATION_TYPE_TOWN_CITY },
    exterior: { exteriorData: { mapId: 1, width: 2, height: 2, blockNames: [] } },
  };
  // travelled EAST -> the WEST edge (:1507, :1560-1563): centre minus
  // (halfWidth + RMBSide * 0.1), facing 90.
  const at = locationArrivalLanding(town, {
    origin,
    startMarkers: [],
    travelStart: { x: 0, z: 0 },
    worldPos: { x: 8 * PIXEL, z: 0 },
    roll: () => 0,
  });
  assert.equal(at.side, 'west');
  assert.equal(at.yaw, (90 * Math.PI) / 180, 'SetFacing(90, 0) - back into the town');
  const half = 2 * 0.5 * RMB_SIDE;
  assert.deepEqual(at.pos, [origin[0] + half - (half + EXTRA_DISTANCE), origin[1], origin[2] + half],
    'a tenth of a block OUTSIDE the rectangle, not its centre');
});

// ── F18 / F19: THE HOSTS ─────────────────────────────────────────────

test('AUDIT 64 F18/F19: fast travel and the guild teleport carry DFU\'s reposition', () => {
  // StreamingWorld.RepositionMethods (StreamingWorld.cs:215-223) - the
  // port carries the three its hosts reach.
  assert.equal(REPOSITION.DirectionFromStartMarker, 'DirectionFromStartMarker');
  assert.equal(REPOSITION.RandomStartMarker, 'RandomStartMarker');

  const world = read('src/scenes/world.js');
  const slice = (head, tail) => {
    const i = world.indexOf(head);
    assert.ok(i > 0, `${head} exists`);
    const j = world.indexOf(tail, i);
    return world.slice(i, j > 0 ? j : undefined);
  };

  // DaggerfallTravelPopUp.cs:334 - DirectionFromStartMarker, and the
  // travelStartX/travelStartZ pair TeleportToMapPixel caches off the
  // DEPARTURE before the GPS moves (:1078-1083).
  const travel = slice('async function fastTravelTo(pick, opts, computed)', '\n  }');
  assert.match(travel, /reposition: REPOSITION\.DirectionFromStartMarker,/,
    'performFastTravel\'s own reposition method (DaggerfallTravelPopUp.cs:334)');
  assert.match(travel, /const travelStart = state\.worldCoords\(/,
    'and the departure world coordinates the hint is measured from');
  assert.ok(travel.indexOf('const travelStart =') < travel.indexOf('await _teleportToPixel'),
    'read BEFORE the jump, as TeleportToMapPixel reads it (:1078-1083 ahead of :1085-1086)');

  // DaggerfallTeleportPopUp.cs:143 - RandomStartMarker, explicitly,
  // against the overload's own default of Origin (StreamingWorld.cs:368).
  const teleport = slice('async function teleportTo(pick)', '\n  }');
  assert.match(teleport, /reposition: REPOSITION\.RandomStartMarker/,
    'TeleportAway names the reposition (DaggerfallTeleportPopUp.cs:143)');

  // ...and the core runs the ONE PositionPlayerToLocation for BOTH
  // methods, which is what StreamingWorld.Update's fall-through does
  // (:279-282).
  assert.match(world, /const wantsLanding = reposition === REPOSITION\.RandomStartMarker\s*\n\s*\|\| reposition === REPOSITION\.DirectionFromStartMarker;/,
    'Update\'s two cases fall through to one call (:279-282)');

  // AUDIT 64 F18 (review): ...but the hint itself is cached for ONE of
  // the two. TeleportToMapPixel guards the pair with
  // `if (autoReposition == RepositionMethods.DirectionFromStartMarker)`
  // (StreamingWorld.cs:1078-1083), so RandomStartMarker arrives with
  // travelStartX/travelStartZ still null and takes :1486's
  // Random.Range(0, 4). Pinned here because the derivation is the one
  // token that can make the whole hint inert.
  assert.match(world, /const hint = reposition === REPOSITION\.DirectionFromStartMarker \? travelStart : null;/,
    'the pair is cached only for DirectionFromStartMarker (:1078-1083)');
  // ...and the landing forwards BOTH halves the law reads - travelStart
  // and the destination-pixel world coordinates the GPS already holds
  // (:1085-1086). Either one null is :1483's fallback.
  assert.match(world, /const at = locationArrivalLanding\(dfLoc, \{\s*\n\s*origin,\s*\n\s*startMarkers,\s*\n\s*travelStart,\s*\n\s*worldPos: travelStart \? mapPixelToWorldCoords\(px, py\) : null,\s*\n\s*\}\);/,
    'both halves of DFU\'s `travelStartX == null || travelStartZ == null` test reach the law (:1483)');
});

// ── F20 / F21: Career.DamageFromSunlight, twice ──────────────────────

/** A custom class carrying the "Damage / From Sunlight" disadvantage -
 *  specialAdvantages.js:266's own write, mirroring
 *  CreateCharSpecialAdvantageWindow's pick. No racial override. */
const sunCareer = () => ({ abilityFlagsAndSpellPointsBitfield: SPECIAL_ABILITY_BITS.sunDamage });

test('AUDIT 64 F20: the arrival clamp\'s SECOND arm is the CAREER flag', () => {
  const career = sunCareer();
  assert.equal(careerSunDamage(career), true, 'bit 16 is DFCareer.DamageFromSunlight');

  // DaggerfallTravelPopUp.cs:350-357: "Vampires and characters with
  // Damage from Sunlight disadvantage never arrive between 6am and 6pm
  // regardless of travel type" - RaiseTime((DuskHour - Hour) * 3600).
  // A noon arrival is pushed to hour 18, DFU's DuskHour.
  const noon = 12 * 60;
  assert.equal(arrivalClampMinutes(noon, { sunAverse: careerSunDamage(career) }), 6 * 60,
    'noon + 6h = DuskHour (18)');
  assert.equal((noon + arrivalClampMinutes(noon, { sunAverse: careerSunDamage(career) })) / 60, 18);
  // ...and a night arrival is left alone, career flag or not.
  assert.equal(arrivalClampMinutes(2 * 60, { sunAverse: careerSunDamage(career) }), 0);
  // A career WITHOUT the bit takes no clamp at all - the arm is the
  // flag's, not every custom class's.
  assert.equal(careerSunDamage({ abilityFlagsAndSpellPointsBitfield: 0 }), false);

  // The PRODUCER, at the one caller of arrivalClampMinutes: DFU's
  // disjunction, the same one passiveSpecials.js:113 already spells.
  assert.match(read('src/scenes/world.js'),
    /sunAverse: !!playerEntity\.racialOverride\?\.sunDamage \|\| careerSunDamage\(playerEntity\.career\),/,
    'HasVampirism() || Career.DamageFromSunlight (DaggerfallTravelPopUp.cs:351)');
});

test('AUDIT 64 F21: the travel map door refuses a career sun-damaged class by day', () => {
  // DaggerfallUI.cs:614-621 is a rung of its own, and it sits ABOVE the
  // racial override's CheckFastTravel (:624-626). It reads
  // PlayerEntity.Career.DamageFromSunlight where CheckFastTravel reads
  // the RacialOverrideEffect - so the racial helper must NOT answer for
  // a career-flagged non-vampire, and the door must ask separately.
  const career = sunCareer();
  assert.equal(racialFastTravelBlock({ career }, 12 * 60), null,
    'CheckFastTravel is the RACIAL rung and never reads the career');
  assert.equal(careerSunDamage(career) && isDayFromMinutes(12 * 60), true, 'noon: refused');
  assert.equal(careerSunDamage(career) && isDayFromMinutes(2 * 60), false, 'night: admitted');

  const world = read('src/scenes/world.js');
  const i = world.indexOf('const toggleTravelMap = (gotoPlace = null) =>');
  assert.ok(i > 0);
  const door = world.slice(i, world.indexOf('/** G5: the map the guild', i));
  assert.match(door, /if \(careerSunDamage\(playerEntity\.career\) && isDayFromMinutes\(nowMin\)\) \{\s*\n\s*townTalk\.say\(SUNLIGHT_TRAVEL_TEXT\);\s*\n\s*return;\s*\n\s*\}/,
    'the career box, with the same localized key both DFU sites use');
  // ORDER, DaggerfallUI.cs's own: GiveOffer (:612), the career box
  // (:614), then CheckFastTravel (:625).
  const offer = door.indexOf('if (giveOffer()) return;');
  const careerRung = door.indexOf('careerSunDamage(playerEntity.career)');
  const racial = door.indexOf('racialFastTravelBlock(playerEntity');
  assert.ok(offer > 0 && careerRung > offer && racial > careerRung,
    'GiveOffer, then the career box, then the racial override');
});

// ── F22: the crime clear ─────────────────────────────────────────────

test('AUDIT 64 F22: fast travel clears the crime, and a teleport does not', () => {
  const world = read('src/scenes/world.js');
  const travel = world.slice(world.indexOf('async function fastTravelTo(pick, opts, computed)'));
  const body = travel.slice(0, travel.indexOf('\n  }'));
  // PlayerEntity.cs:2455-2459, subscribed at :211 - "Clear crime state
  // post fast travel", through the CrimeCommitted PROPERTY (:189,
  // :2346-2354), which is the port's setCrimeCommitted.
  assert.match(body, /setCrimeCommitted\(playerEntity, CRIMES\.None\);/,
    'DaggerfallTravelPopUp_OnPostFastTravel clears the crime');
  // Raised where DFU raises the event: DaggerfallTravelPopUp.cs:383,
  // AFTER RaiseSkills (:380) and FadeHUDFromBlack (:381).
  assert.ok(body.indexOf('raisePlayerSkills(') < body.indexOf('hudFade.fadeHUDFromBlack()'));
  assert.ok(body.indexOf('hudFade.fadeHUDFromBlack()') < body.indexOf('setCrimeCommitted(playerEntity, CRIMES.None)'),
    'the event is performFastTravel\'s LAST statement');

  // DaggerfallTeleportPopUp never runs performFastTravel, so it raises
  // no OnPostFastTravel and the crime rides a guild teleport in DFU too.
  const tele = world.slice(world.indexOf('async function teleportTo(pick)'));
  assert.equal(tele.slice(0, tele.indexOf('\n  }')).includes('setCrimeCommitted'), false,
    'a teleport keeps the crime, as it does in DFU');
});

// ── F24: the sentence ────────────────────────────────────────────────

test('AUDIT 64 F24: the sunlightDamageFastTravelDay refusal is DFU\'s own line', () => {
  // Internal_Strings.csv:657 - `sunlightDamageFastTravelDay,You cannot
  // initiate fast travel during the day.` - which is also what the
  // shipped en table carries (Internal_Strings Shared Data.asset:2007
  // binds the key to m_Id 500; Internal_Strings_en.asset:2350).
  assert.equal(SUNLIGHT_TRAVEL_TEXT, 'You cannot initiate fast travel during the day.');
  // ONE key, so BOTH refusals speak it: VampirismEffect.cs:202 and
  // DaggerfallUI.cs:619.
  assert.deepEqual(racialFastTravelBlock({ racialOverride: { sunDamage: true } }, 12 * 60),
    { text: SUNLIGHT_TRAVEL_TEXT });
  assert.match(read('src/scenes/world.js'), /townTalk\.say\(SUNLIGHT_TRAVEL_TEXT\);/,
    'and the career box shows the same constant');
});
