// TO1: TRAVEL OPTIONS' WORDS, BY THE KEY `TravelOptionsMod.Localize` reads (:1322-1341). OWN-WORK3 (2026-10-31): our
// own words for every key the game shows; the mod's string table (TravelOptionsModData.csv) left the tree, and so did
// its four keys nothing read (MsgFollow, MsgTimeFormatNoSDF, MsgNotVisited, HelpInfo). The `{0}` placeholders are C#
// composite formatting, filled by `format` below. The compass letters and the three dungeon kinds are the classic
// game's own words. HelpInfoSDF is the help the H key shows: its three keys are the bindings (travelOptions.js helpText).
import { t } from '../textManager.js';   // L10N4: the port's own words below (TRAVEL_NAV_TEXT)

export const TRAVEL_OPTIONS_TEXT = Object.freeze({
  MsgArrived: 'You reach your destination.',
  MsgArrivedJunc: 'The way divides here.',
  MsgEnemies: 'Enemies block your way!',
  MsgAvoidFail: 'You were seen before you could slip away!',
  MsgAvoidSuccess: 'You slip past the danger unseen.',
  MsgLowHealth: 'You are badly hurt. Your journey stops.',
  MsgLowFatigue: 'You are too tired to go on. Rest first.',
  MsgOcean: 'You are at sea. Only a ship can take you on from here.',
  MsgNearLocation: 'Your journey stops near {1}, a {0}.',
  MsgEnterLocation: 'Your journey stops in {1}, a {0}.',
  MsgCircumnavigate: 'Going around {0}.',
  MsgNoPath: 'No road or track leads that way from here.',
  MsgFollowRoad: 'Along a road',
  MsgFollowTrack: 'Along a dirt track',
  MsgTargetCoords: 'Map spot {0}, {1}',
  MsgNewRegion: 'You cross into {0}.',
  DirectionN: 'N',
  DirectionNE: 'NE',
  DirectionE: 'E',
  DirectionSE: 'SE',
  DirectionS: 'S',
  DirectionSW: 'SW',
  DirectionW: 'W',
  DirectionNW: 'NW',
  DirectionNone: 'none',
  TipMap: 'Open the map',
  TipCamp: 'Make camp',
  MsgResume: 'Go on to {0}?',
  MsgTeleportCost: 'The guild charges {0} gold to send you there. Pay it?',
  MsgPlayerControlled: 'You travel it yourself',
  MsgTimeFormat: ' about {0} hr {1} min',
  MsgNoPort: 'There is no port here to sail from.',
  MsgNoDestPort: 'There is no port there to sail to.',
  MsgNoSailing: 'No sea lies on this route. You do not need a ship.',
  MsgGuildHalls: 'Guilds here: ',
  MsgNoKnowledge: 'You know nothing about {0}.',
  LocationTypeDungeonKeep: 'Keep',
  LocationTypeDungeonLabyrinth: 'Labyrinth',
  LocationTypeDungeonRuin: 'Ruin',
  HelpInfoSDF: `Travel help

The travel map

Left click - choose where to go: a region, a place or a spot
Right click - zoom in or out
Middle click - mark a place, such as the end of a road you mean to follow
I - what you know of a place (point at it, or choose it first)

On the journey

{0} - follow a road or track
M - look at the travel map (or press the map button)
C - stop and make camp (or press the camp button)
{1} - end the journey (or press the exit button)
{2} - when stopped, open the travel map to go on or to pick a new place`,
});

/** TRAVEL-NAV1: THE PORT'S OWN WORDS for the steering's stops (systems/travel/travelSteer.js), kept beside the
 *  table above: a stopped journey is resumed from the map exactly as the table's own stops are. */
export const TRAVEL_NAV_TEXT = Object.freeze({
  MsgBlocked: 'Your journey stops. The way ahead is blocked.',
  MsgStuck: 'Your journey stops. You are making no headway.',
  // OW-TOWN-WALK: a walled city's way out behind its gates (DaggerfallCityGate's night, offline) - the port's newest words, read
  // in the player's language (L10N4)
  get MsgGatesShut() { return t('travel.nav.gatesShut', 'Your journey stops. The city gates are shut for the night.'); },
});

/** C#'s `string.Format` for the placeholders these strings use: `{0}`,
 *  `{1}`, `{2}` filled positionally. An index with no argument is left
 *  as it stands rather than printed as "undefined". */
export function format(template, ...args) {
  return String(template).replace(/\{(\d+)\}/g, (whole, i) => {
    const v = args[Number(i)];
    return v === undefined ? whole : String(v);
  });
}

/** :1336-1341, Localize - a key the table does not carry answers the
 *  empty string, exactly as the mod's does. */
export function localize(key) {
  return Object.prototype.hasOwnProperty.call(TRAVEL_OPTIONS_TEXT, key) ? TRAVEL_OPTIONS_TEXT[key] : '';
}

/** TravelOptionsMod.cs:886-909, GetDirectionStr - the compass bit's
 *  own word, `DirectionNone` for anything that is not one of the
 *  eight. */
export function directionText(direction) {
  switch (direction) {
    case 128: return TRAVEL_OPTIONS_TEXT.DirectionN;
    case 64: return TRAVEL_OPTIONS_TEXT.DirectionNE;
    case 32: return TRAVEL_OPTIONS_TEXT.DirectionE;
    case 16: return TRAVEL_OPTIONS_TEXT.DirectionSE;
    case 8: return TRAVEL_OPTIONS_TEXT.DirectionS;
    case 4: return TRAVEL_OPTIONS_TEXT.DirectionSW;
    case 2: return TRAVEL_OPTIONS_TEXT.DirectionW;
    case 1: return TRAVEL_OPTIONS_TEXT.DirectionNW;
    default: return TRAVEL_OPTIONS_TEXT.DirectionNone;
  }
}
