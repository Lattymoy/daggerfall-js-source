// @ts-check
// FIELD BUGS 2026-10-21b SAIL-WIND (bible/01-Overview/bugs/Field-Bugs-2026-10-21b.md; the Discord's #bug-reports, Dûmorîkh:
// "Sailing Vessels Sometimes Have No Propulsion" - "This is only with sails. Oars work fine.") - A LOAD THAT LANDS OUTDOORS
// NEVER KEEPS THE INDOORS' WIND.
//
// Come Sail Away lays no wind at all indoors (UpdateWind, 3860-3922: both vectors zero), its save keeps the wind as it
// stands (`windVector`), and its OnLoad (1943-1950) restores it without asking for a new one - in Daggerfall Unity a save
// made indoors loads indoors, so the next door's OnTransition lays the outdoors' wind. Here a load can land OUTDOORS from a
// save made below ground: online a dungeon save wakes at the nearest temple or town (scenes/world.js
// ONLINE-UNDERGROUND-LOAD1), and a dungeon that cannot be entered or found, or a save made elsewhere, is restored outside.
// Each laid the indoors' none on the open sea: the sails' way and their pull both read the wind (helmWay.js seaWind: none
// at a wind of nought), so a ship under sail stood still - a Small Ship's quarter second at the oars crept 0.12 knots, a
// Large Boat raised sail from rest and made nothing - while her oars, which read no wind, rowed as ever. Nothing laid a
// wind until the game's next hour, a change of weather or a door, and a restart's exit save kept the nought for the next.
//
// THE DEPARTURE, named (Port-Ledger A, COME SAIL AWAY): the runtime's OnLoad asks UpdateWind - the door's own call - when
// the player stands outdoors under a wind of nought. Outdoors UpdateWind never lays one (a fog's tenth of 1 is the least),
// so a nought there is only ever the indoors' brought out; indoors, and under any wind, the load stands as the mod's does.

/** Whether a wind a load restored is the indoors' none brought outdoors - the player outside, every axis nought. */
export const windStaleOutdoors = (/** @type {boolean} */ inside, /** @type {ReadonlyArray<number>} */ wind) => !inside && Array.isArray(wind) && wind.length === 3 && wind.every((c) => c === 0);
