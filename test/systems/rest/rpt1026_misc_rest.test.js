// RPT1026-MISC BED-PRESS-INDOOR (a private report: a rest in a Fighters Guild hall woke to the rough night's line though the
// hall has beds, a bed clicked or not). SURV4 prices a rest by where it lies - a bed, a camp, the rough floor - and a bed's click (CSA-J's
// `_restFromBed`, Roleplay Realism's BedActivation) is a bed's rest in the street's host and the dungeon's, never in a
// building's: the interior host asked the place alone (a rented room, the player's house, a ship), so a member resting in
// a guild hall slept its boards rough whatever they pressed. The law now lives in one
// place (systems/rest/restSession.js interiorRestSpot), over the real bag the host builds (interiorRestPlace).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { interiorRestPlace, interiorRestSpot } from '../../../src/systems/rest/restSession.js';
import { BUILDING_TYPES } from '../../../src/world/buildingNames.js';

const rd = (p) => readFileSync(new URL('../../../' + p, import.meta.url), 'utf8');
/** The bag the interior host hands CanRest in a guild hall the member may rest in: no room rented, no house, no ship. */
const hall = () => interiorRestPlace({ inTownLocation: true, building: { buildingType: BUILDING_TYPES.GuildHall, factionId: 41 }, restMarkers: 4, guildCanRest: true });

test('RPT1026-MISC BED-PRESS-INDOOR: a bed pressed in a guild hall is a bed\'s rest; the Rest key on its floor stays rough (SURV4), its hearth a camp\'s; a rented room, a house and a ship are beds as they were (mutant: rpt1026-misc-bed-press-ignored)', () => {
  const p = hall();
  assert.equal(p.guildCanRest, true, 'the member may rest here (CanRest)');
  assert.deepEqual(interiorRestSpot(p, { pressedBed: true }), { kind: 'bed', where: null }, 'the bed clicked');
  assert.deepEqual(interiorRestSpot(p, { pressedBed: true, fireNear: true }), { kind: 'bed', where: null }, 'a bed before a hearth');
  assert.deepEqual(interiorRestSpot(p), { kind: 'rough', where: null }, 'the hall\'s boards, by the Rest key');
  assert.deepEqual(interiorRestSpot(p, { fireNear: true }), { kind: 'camp', where: 'fire' }, 'its hearth');
  const room = interiorRestPlace({ building: { buildingType: BUILDING_TYPES.Tavern }, room: { mapId: 1, buildingKey: 2 } });
  assert.equal(interiorRestSpot(room).kind, 'bed', 'a rented room');
  assert.equal(interiorRestSpot(interiorRestPlace({ building: { buildingType: BUILDING_TYPES.House2 }, houseOwned: true })).kind, 'bed', 'the house');
  assert.equal(interiorRestSpot(interiorRestPlace({ building: { buildingType: BUILDING_TYPES.House2 }, homeBed: true })).kind, 'bed', 'an online home\'s bed (RENT-REST)');
  assert.equal(interiorRestSpot(interiorRestPlace({ building: { buildingType: BUILDING_TYPES.Ship } })).kind, 'bed', 'a ship');
  assert.equal(interiorRestSpot(null, { pressedBed: true }).kind, 'bed', 'no bag at all: the press still names the bed');
  assert.equal(interiorRestSpot(null).kind, 'rough');
});

test('RPT1026-MISC BED-PRESS-INDOOR by source: the interior host names its rest by that one law and hands it the bed\'s press - its kind and its point alike (mutant: rpt1026-misc-bed-press-unwired)', () => {
  const wm = rd('src/scenes/worldModes.js');
  assert.match(wm, /restKind: \(\) => interiorRestSpot\(interiorRestPlaceHere\(\), \{ pressedBed: _restFromBed, fireNear: interiorCamps\.fireNear\(player\.pos\) \}\)\.kind,/);
  assert.match(wm, /restPoint: \(\) => interiorRestSpot\(interiorRestPlaceHere\(\), \{ pressedBed: _restFromBed, fireNear: interiorCamps\.fireNear\(player\.pos\) \}\),/);
  // the press's flag is raised around the very toggle that opens the window, and the window reads the kind on OPEN
  assert.match(wm, /const restFromInteriorBed = \(\) => \{ _restFromBed = true; try \{ interiorKeyCtx\.toggleRest\(\{ ignoreAllocatedBed: true \}\); \} finally \{ _restFromBed = false; \} \};/);
  assert.match(rd('src/ui/restWindow.js'), /on OPEN, not on the first rested hour[\s\S]{0,200}?this\.deps\.setResting\?\.\(true\);/);
});
