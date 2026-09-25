// TO1: THE MOD'S OWN WORDS - TravelOptionsModData.csv, the string table
// `TravelOptionsMod.Localize` reads (:1322-1341), restated here key for
// key. The CSV itself is vendored beside it
// (vendor/travel-options/TravelOptionsModData.csv) and
// test/to1_travelOptions.test.js reads that file and asserts this table
// matches it entry for entry, so the two cannot drift: the vendored
// file is the record, this is what the game reads without a fetch.
//
// The `{0}` placeholders are the mod's own (C# composite formatting);
// `format` below fills them positionally, which is all any of these
// need - none uses an alignment or a format specifier.
//
// TWO PAIRS ARE A DFU SETTING'S. `HelpInfoSDF`/`HelpInfo` and
// `MsgTimeFormat`/`MsgTimeFormatNoSDF` are picked by
// `DaggerfallUnity.Settings.SDFFontRendering` (:1256, and
// TravelOptionsPopUp.cs:126-133) - whether DFU is drawing text with
// signed-distance-field fonts or the classic bitmap one. The port's
// text is neither: ui/text.js draws the classic FONT.FNT glyphs at
// whatever scale the panel asks. It takes the SDF arm of both, which
// is the one whose layout does not assume the narrower classic
// measure, and carries the other strings so nothing is lost.

export const TRAVEL_OPTIONS_TEXT = Object.freeze({
  MsgArrived: "You have arrived at your destination.",
  MsgArrivedJunc: "You've arrived at a junction.",
  MsgEnemies: "Enemies are seeking to prevent your travel...",
  MsgAvoidFail: "You failed to avoid an encounter!",
  MsgAvoidSuccess: "You successfully avoided an encounter.",
  MsgLowHealth: "You are close to the point of death!",
  MsgLowFatigue: "You are exhausted and should rest.",
  MsgOcean: "You've found yourself in the sea, maybe you should travel on a ship.",
  MsgNearLocation: "Paused the journey since a {0} called {1} is nearby.",
  MsgEnterLocation: "Paused the journey as you've entered a {0} called {1}.",
  MsgCircumnavigate: "Circumnavigating {0}.",
  MsgNoPath: "There's no path here to follow in that direction.",
  MsgFollowRoad: "Following a road.",
  MsgFollowTrack: "Following a dirt track.",
  MsgTargetCoords: "Map coordinates: {0}, {1}.",
  MsgNewRegion: "You have entered the region of {0}.",
  DirectionN: "N",
  DirectionNE: "NE",
  DirectionE: "E",
  DirectionSE: "SE",
  DirectionS: "S",
  DirectionSW: "SW",
  DirectionW: "W",
  DirectionNW: "NW",
  DirectionNone: "none",
  TipMap: "Consult Map",
  TipCamp: "Stop to Camp",
  MsgResume: "Resume your journey to {0}?",
  MsgFollow: "Do you want to follow this road?",
  MsgTeleportCost: "Teleportation will cost you {0} gold, is that acceptable?",
  MsgPlayerControlled: "Player Controlled Journey",
  MsgTimeFormat: " {0} hours {1} mins (approx)",
  MsgTimeFormatNoSDF: "~ {0} hours {1} mins",
  MsgNoPort: "You cannot travel by ship from here, since there's no port.",
  MsgNoDestPort: "You cannot travel by ship to there, as that location has no port.",
  MsgNoSailing: "Your journey doesn't cross any ocean, so a ship is not needed.",
  MsgNotVisited: "You have not visited this location yet, so can't fast travel there.",
  MsgGuildHalls: "Guild Halls:    ",
  MsgNoKnowledge: "You have no knowledge of {0}.",
  LocationTypeDungeonKeep: "Keep",
  LocationTypeDungeonLabyrinth: "Labyrinth",
  LocationTypeDungeonRuin: "Ruin",
  HelpInfoSDF: "Travel Options Help\n\nTravel Map\n\nLeftClick - Select travel destination (region, location, map pixel)\nRightClick - Zoom in or out\nMiddleClick - Mark a location (for example as a destination for road following)\nI - Location information known to character (press while hovering or after selecting)\n\nAccelerated Travel\n\n{0} - Follow road or track\nM - Open travel map while travelling (or click map button)\nC - Pause travel for camp (or click camp button)\n{1} - Exit travel (or click exit button)\n{2} - Open travel map when stopped to resume journey, or to choose a new destination",
  HelpInfo: "Travel Options Help\n\nTravel Map\n\nLeftClick - Select travel destination (region, location, map pixel)\nRightClick - Zoom in or out\nMiddleClick - Mark a location\nI - Location information known to character\n\nAccelerated Travel\n\n{0} - Follow road or track\nM - Open travel map while travelling (or click map button)\nC - Pause travel for camp (or click camp button)\n{1} - Exit travel (or click exit button)\n{2} - Open travel map when stopped to resume journey,\n    or to choose a new destination",
});

/** TRAVEL-NAV1: THE PORT'S OWN WORDS, kept OUT of the table above - that
 *  table is the mod's CSV and its pin asserts nothing was invented in it.
 *  The steering (systems/travelSteer.js) is the port's, so its two stops
 *  speak here, in the mod's own voice: "Paused the journey since ..." is
 *  MsgNearLocation's sentence, and a stopped journey is resumed from the
 *  map exactly as the mod's own stops are. */
export const TRAVEL_NAV_TEXT = Object.freeze({
  MsgBlocked: "Paused the journey since the way ahead is blocked.",
  MsgStuck: "Paused the journey since you're making no headway.",
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
