// @ts-check
// AUDIT DELVE C8 (bible/01-Overview/Audit-Delve.md): THE EIGHT WAYS IN THE SCENE'S FRAME, ONE HOME. The angler's word
// for a school (scenes/fishHost.js bearingWord) and the dungeon's echo (systems/dungeonEcho.js) were one law written
// twice - the same words, the same +x-east +z-north frame, the same rounding. The bounty board's map pixels (y south)
// and the fleet's terrain cells keep their own frames (systems/bountyBoard.js compassWord, scenes/fleetHost.js).
//
// Not a DFU member. Pure.

/** The eight ways, clockwise from north. */
export const COMPASS_WORDS = Object.freeze(['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west']);

/** The compass way across the level from one place to another, in scene XZ (+x east, +z north - ui/hud.js
 *  compassMarkerLerp's frame). Pure. */
export const sceneCompassWord = (dx, dz) => COMPASS_WORDS[((Math.round(Math.atan2(dx, dz) * 180 / Math.PI / 45) % 8) + 8) % 8];
