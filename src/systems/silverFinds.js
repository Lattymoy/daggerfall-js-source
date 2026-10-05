// @ts-check
// SILVER-FINDS (2026-10-05, Mac: "Silver should be more accessible in more forms of interactions like foraging and
// different activities, also needs to be sometimes lootable"): A LOOT FIND - a foe's body, a treasure pile or a searched
// thing, opened online, holds silver now and then. Design: bible/06-Systems/Professions-Arc.md 10.5 (SILVER-FINDS).
//
// THE DEVICE ROLLS THE FIND, ONCE A CONTAINER. The service cannot see a body, so a find is bounded, not witnessed
// (net/marksLaw.js SILVER-FINDS): the device rolls each container's chance once a session (findChanceOf - a body's, a
// pile's, a searched thing's), and a find asks the account service, whose own dice say what it strikes and whose day
// holds them all (server-account/src/marks.js findMarks). A lying device can only ask every time, and the day is the
// most it is paid.
//
// EVERY HOST'S LOOT DOOR ASKS HERE (THE FOUR HOSTS): scenes/dungeonContext.js takeLoot (a body, a pile, a searched
// object's find); scenes/corpseMarker.js openCorpseLoot (a body of the street's, the watch's, the bench's and an
// interior's pools - world.js, exterior.js and worldModes.js open them through it) and scenes/exteriorFoes.js's grant
// (a body another player's foe left, its items handed over); scenes/world.js activateGrave (a headstone's find). AUDIT
// 625 S2: and a scene's own TREASURE container - an interior's (worldModes.js, a tavern's and a guild hall's
// RandomTreasure), the streaming host's (World of Daggerfall's piles, Deep Waters' chests) - at its pile door. The
// streaming host registers the finder online (scenes/world.js: the book's find, its card, its line); with none -
// offline (exterior.js, the town page, is never online), the bench - nothing is found.
//
// AUDIT 625. D6: a door rolls once it OPENED the container - a window that stood, or the quick door's take - never on an
// open the host refused (a werebeast's pack). S5: a container is named as its host names it for good - the dungeon by
// its map and the room's key for the container (a body with its death's stamp), an interior's pile by its town, its
// building and its marker - so leaving and coming back rolls nothing again; a container a host mints afresh (an unsaved
// scene container, a street's body) is its own object.
//
// Pure but for the finder and what was rolled. Not a DFU member. Ledger A (SILVER-FINDS).
import { findChanceOf, FIND_KINDS } from '../net/marksLaw.js';

/** The containers a session remembers rolling, at most - the oldest let go past it (a reopened one rolls again then,
 *  which the service's day bounds as it bounds a lie). */
export const SILVER_FINDS_KEPT = 4096;

/** @type {((kind: string) => void) | null} */
let _finder = null;
/** The host's finder - `(kind) => void`: the book's ask, its card and its line - or null (offline, the bench). */
export function setSilverFinder(fn) { _finder = typeof fn === 'function' ? fn : null; }
export const silverFinderSet = () => _finder !== null;

/** What a container is, as the roll remembers it: its own object (a body's entity, a pile's list) - weakly held, so a
 *  container gone is a memory gone - or its key's string. */
let _rolledObjects = new WeakSet();
let _rolledKeys = new Set();
const seen = (c) => (typeof c === 'string' ? _rolledKeys.has(c) : _rolledObjects.has(c));
function remember(c) {
  if (typeof c !== 'string') { _rolledObjects.add(c); return; }
  _rolledKeys.add(c);
  if (_rolledKeys.size > SILVER_FINDS_KEPT) _rolledKeys.delete(_rolledKeys.values().next().value);
}

/**
 * A CONTAINER OPENED: `kind` 'corpse' | 'pile' | 'search' (marksLaw.js FIND_KINDS), `container` its own object or its
 * stable key. Rolled ONCE a container a session, and only while a finder stands (online, signed in); a find asks the
 * finder. `roll` the device's dice. Answers whether it found.
 * @param {string} kind @param {object|string} container @param {() => number} [roll]
 */
export function silverFindAt(kind, container, roll = Math.random) {
  if (!_finder || !FIND_KINDS.includes(kind)) return false;
  if (container == null || (typeof container !== 'string' && typeof container !== 'object') || container === '') return false;
  if (seen(container)) return false;
  remember(container);
  if (!(roll() < findChanceOf(kind))) return false;
  try { _finder(kind); } catch (e) { console.warn('[silver] a find', /** @type {any} */ (e)?.message ?? e); }
  return true;
}

/** Tests only: no finder, nothing rolled. */
export function _resetSilverFindsForTests() { _finder = null; _rolledObjects = new WeakSet(); _rolledKeys = new Set(); }
