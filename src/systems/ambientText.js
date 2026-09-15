// AMBIENT TEXT 1.8 - Regnier (AT1). The mod ported 1:1, read off its
// compiled scripts (vendor/ambient-text/README.md records how they were
// recovered); IL offsets below are into AmbientText.dll's own methods.
//
// The whole mod is: a clock that ticks in REAL time, a percentage roll,
// and a key built out of where and when you are. What makes it worth
// porting is not the arithmetic - it is the 918 lines of the author's
// own prose the key reaches, which is why they are vendored verbatim
// (vendor/ambient-text/ambientTexts.json) rather than rewritten.
//
// THE TABLE IS SPARSE AND THAT IS THE DESIGN. 233 key families x 10
// indices would be 2330 entries; there are 918. The mod builds a key
// and, when the table has no line for it, says NOTHING this tick and
// leaves `lastIndex` alone. So a family with one line speaks rarely and
// a family with ten speaks often, and the gaps ARE the author's
// frequency curve. Nothing here fills them, and nothing here picks
// "from the keys that exist" - either would be a different mod.

import AMBIENT_TEXTS from '../../vendor/ambient-text/ambientTexts.json' with { type: 'json' };
import { LOCATION_TYPES, DUNGEON_TYPES } from '../formats/mapsFile.js';   // DFRegion.LocationTypes / DungeonTypes - the names the keys are spelled with
import { dice100 } from '../combat/formulas.js';   // Dice100.SuccessRoll
import { weatherFlags } from '../world/weather.js';   // WeatherManager's four public flags

export { AMBIENT_TEXTS };

/** The mod's settings section and its four keys, as modsettings ships
 *  them. `interval` lands in the field the mod calls `stdInterval`. */
export const AMBIENT_TEXT_SECTION = 'AmbientText';

/** LoadSettings (IL 0x5a20): four GetInt calls, `interval` and
 *  `postTextInterval` converted to float on the way into their fields. */
export function readAmbientTextSettings(get) {
  return {
    textChance: get('textChance') | 0,
    stdInterval: Number(get('interval')),
    postTextInterval: Number(get('postTextInterval')),
    textDisplayTime: get('textDisplayTime') | 0,
  };
}

/** C#'s `enum.ToString()`: the NAME when the value is one the enum
 *  declares, and the NUMBER when it is not. Both branches matter - a
 *  location type outside DFRegion's sixteen spells itself as digits and
 *  the key simply misses, which is the mod's own behaviour and not a
 *  hole to plug. Derived from the table, so an enum that gains a member
 *  needs no edit here. */
const enumName = (table, value) => {
  for (const [name, v] of Object.entries(table)) if (v === value) return name;
  return String(value);
};

/** WeatherKey (IL 0x5d20). "Clear" is the resting answer and the three
 *  tests are an if/else-if ladder in this order, so a storm is "Rainy"
 *  and never "Cloudy" although it is also overcast. */
export function weatherKey(flags) {
  if (flags.raining || flags.storming) return 'Rainy';
  if (flags.snowing) return 'Snowy';
  if (flags.overcast) return 'Cloudy';
  return 'Clear';
}

/** The word the sky is in, as WeatherKey wants it. */
export const weatherKeyForWeather = (weather) => weatherKey(weatherFlags(weather));

/** ClimateKey (IL 0x5d78): a `switch` over `CurrentClimateIndex - 224`
 *  with nine arms and a default. MapsFile.Climates starts at Ocean 223,
 *  so the subtrahend is Desert (224) and Ocean falls to the DEFAULT
 *  along with every index outside 224..232. The arms verbatim, in the
 *  switch's own order. */
export const CLIMATE_KEYS = Object.freeze([
  'Desert',     // 224 Desert
  'Desert',     // 225 Desert2
  'Mountains',  // 226 Mountain
  'Swamp',      // 227 Rainforest
  'Swamp',      // 228 Swamp
  'Desert',     // 229 Subtropical
  'Woods',      // 230 MountainWoods
  'Woods',      // 231 Woodlands
  'Woods',      // 232 HauntedWoodlands
]);

export function climateKey(climateIndex) {
  return CLIMATE_KEYS[(climateIndex | 0) - 224] ?? 'Ocean';
}

/** SelectAmbientText's key half (IL 0x5bb0 through IL_013b), given the
 *  index and the tail roll. Split out so the key law can be read - and
 *  pinned - without a clock.
 *
 *  `tail` is Random.Range(0, 3): 0 the climate, 1 the time of day, 2 the
 *  time of day AND the weather. It is rolled fresh every time, so the
 *  same spot speaks in all three registers.
 *
 *  Underground the location is not consulted at all: the family is the
 *  DUNGEON's type and there is no tail. */
export function ambientTextKey({
  insideDungeon = false, dungeonType = DUNGEON_TYPES.NoDungeon,
  inLocationRect = false, locationType = LOCATION_TYPES.None,
  isDay = true, climateIndex = 223, weather = 'sunny',
  index = 0, tail = 0,
} = {}) {
  if (insideDungeon) return `${enumName(DUNGEON_TYPES, dungeonType)}${index}`;
  // IsPlayerInLocationRect decides whether the location is consulted at
  // all: outside every rect the family is `None` (0xffff) - open
  // country - whatever location the map pixel happens to carry.
  const loc = enumName(LOCATION_TYPES, inLocationRect ? locationType : LOCATION_TYPES.None);
  const time = isDay ? 'Day' : 'Night';
  if (tail === 0) return `${loc}${climateKey(climateIndex)}${index}`;
  if (tail === 1) return `${loc}${time}${index}`;
  return `${loc}${time}${weatherKeyForWeather(weather)}${index}`;
}

/** Whether a table carries a line for a key (IDictionary.Contains).
 *  Hashtable.Contains is a plain key test, so an inherited property
 *  must not answer for one the author wrote. */
export const hasAmbientText = (key, texts = AMBIENT_TEXTS) => Object.prototype.hasOwnProperty.call(texts, key);

/**
 * The component. `deps`:
 *   settings()     the four fields (readAmbientTextSettings), re-read per tick
 *   insideBuilding()  PlayerEnterExit.IsPlayerInsideBuilding, and NOTHING
 *                  else. AUDIT AT F5: this used to be a field of `where()`,
 *                  which meant every quiet frame of the shipping host built
 *                  the whole context - a location-rect test, a CLIMATE.PAK
 *                  lookup, the weather word, the hour, and six objects -
 *                  to read one boolean. DFU reads one bool field there
 *                  (Update, IL_0028) and asks PlayerGPS nothing until
 *                  SelectAmbientText. Measured: 100 quiet frames were 100
 *                  context builds. The seam is split so the frame path
 *                  costs what DFU's costs.
 *   where()        the rest of the world, as ambientTextKey's argument
 *                  object wants it minus `index`/`tail`: { insideDungeon,
 *                  dungeonType, inLocationRect, locationType, isDay,
 *                  climateIndex, weather }. Called ONLY when a key is
 *                  actually being built, which is where DFU calls it.
 *   ready()        DaggerfallUnity.Instance.IsReady && PlayerEnterExit exists
 *   paused()       GameManager.IsGamePaused
 *   say(text, s)   DaggerfallUI.AddHUDText(text, seconds)
 *   rolls          Random.Range, as a [0, 1) source
 *   enabled()      the mod's own switch (the port's - DFU enables a mod by listing it)
 *   texts          AmbientText.AmbientTexts, the static Hashtable. A seam
 *                  only because a static one cannot be reached from a
 *                  test; the game always gets the author's own table.
 */
export function createAmbientText({
  settings, where = () => ({}), insideBuilding = () => false,
  ready = () => true, paused = () => false,
  say = () => {}, rolls = Math.random, enabled = () => true, texts = AMBIENT_TEXTS,
} = {}) {
  // .ctor (IL 0x5de4): lastIndex starts at -1. It is the one field that
  // matters - Random.Range(0, 10) can never return -1, so the FIRST
  // do/while below always leaves on its first roll, and every index is
  // available until something has actually been said.
  //
  // The .ctor's other four (textChance 95, stdInterval 2,
  // postTextInterval 4, textDisplayTime 3) are the author's own bench
  // values and no player ever sees them: Awake calls LoadSettings before
  // Start runs. They are not carried.
  const w = { lastTickTime: 0, tickTimeInterval: 0, lastIndex: -1, started: false };

  /** Start (IL 0x5af1): the clock is armed at the first tick and the
   *  interval set to the standard one, so the earliest a line can
   *  appear is `interval` seconds in. */
  const start = (unscaledTime) => {
    w.lastTickTime = unscaledTime;
    w.tickTimeInterval = settings().stdInterval;
    w.started = true;
  };

  /** SelectAmbientText (IL 0x5bb0), whole.
   *
   *  The do/while is the mod's no-repeat rule and it is narrower than it
   *  looks: it refuses the index that last SPOKE, not the index last
   *  rolled, because `lastIndex` is written only on a hit (IL_0148,
   *  inside the Contains arm). A miss leaves it alone, so a run of
   *  misses does not narrow the next roll. */
  const selectAmbientText = () => {
    let index = w.lastIndex;
    do { index = Math.floor(rolls() * 10); } while (index === w.lastIndex);
    const at = where();
    // AUDIT AT F1: THE TAIL ROLL IS NOT SPENT UNDERGROUND. The dungeon
    // arm (IL_002e..IL_005d) formats its key and jumps straight to the
    // Contains test at IL_013b; `Random.Range(0, 3)` is at IL_00ad,
    // inside the ELSE branch. The port rolled it either way, which is
    // invisible under Math.random and is still a different number of
    // draws from the same stream - the thing a seeded replay counts.
    const tail = at.insideDungeon ? 0 : Math.floor(rolls() * 3);
    const key = ambientTextKey({ ...at, index, tail });
    if (!hasAmbientText(key, texts)) return null;
    w.lastIndex = index;
    return texts[key];
  };

  /** Update (IL 0x5b0c), whole. `unscaledTime` is Time.unscaledTime -
   *  REAL seconds since the game started, not game time, so the mod's
   *  pace does not change when you rest or ride. */
  const update = (unscaledTime) => {
    if (!ready() || paused()) return null;
    // AUDIT AT F6: START IS A LIFECYCLE CALL AND `enabled` MUST NOT GATE
    // IT. DFU has no such switch - a mod that is off was never loaded,
    // and `Start` runs the moment the component exists. The port's
    // analogue of "the component exists" is "a host has claimed it",
    // which is `ready`. With the switch above this line, a game booted
    // with the mod OFF armed no clock, so turning it on started one
    // from that moment and the first line came a whole interval later -
    // while a game booted with it ON and toggled off and back spoke at
    // once. Same switch, two behaviours, decided by history. The row's
    // "Takes effect at once" is true in both cases now.
    if (!w.started) { start(unscaledTime); return null; }
    if (!enabled()) return null;
    // IsPlayerInsideBuilding returns EARLY, and it returns before the
    // clock is WRITTEN (that write is below the interval gate), so the
    // interval keeps running while you are inside: step out of a shop
    // after an hour and the world greets you on the first frame. The
    // port's own switch returns the same way, for the same reason.
    if (insideBuilding()) return null;
    if (!(unscaledTime > w.lastTickTime + w.tickTimeInterval)) return null;
    const s = settings();
    w.lastTickTime = unscaledTime;
    w.tickTimeInterval = s.stdInterval;
    if (!dice100(s.textChance, rolls())) return null;
    const text = selectAmbientText();
    // string.IsNullOrWhiteSpace - a table line that is blank or spaces
    // is treated as no line, and the post-text interval is NOT armed.
    if (!text || !text.trim()) return null;
    say(text, s.textDisplayTime);
    w.tickTimeInterval = s.postTextInterval;
    return text;
  };

  return { start, update, selectAmbientText, state: w };
}

// ── THE MOD IS ONE OBJECT, AND IT OUTLIVES A DOOR ───────────────────
//
// Init (IL 0x59de) does `new GameObject(mod.Title).AddComponent<
// AmbientTextMod>()` ONCE, at load, and nothing ever destroys it: the
// same component watches you walk out of a dungeon, across a street and
// into a shop. Two of its fields depend on that - `lastIndex`, which is
// the no-repeat rule, and `lastTickTime`, which is the pace - so a port
// that built one per host would reset both at every door and speak on
// the first frame of every transition.
//
// So there is ONE here too, module-level, and a host CLAIMS it while it
// owns the motor. `ready()` is that claim, which is the port's reading
// of `DaggerfallUnity.Instance.IsReady && PlayerEnterExit` - a host that
// has not mounted cannot answer where the player is, and the mod's own
// answer to not knowing is to say nothing.
//
// THE CLOCK NEEDS NO HOST. Time.unscaledTime is a TIMESTAMP, not an
// accumulator - real seconds since the game started, unaffected by
// Time.timeScale (which is how DFU pauses). A stretch with nobody
// ticking is therefore indistinguishable from a stretch of
// IsPlayerInsideBuilding returning early: both leave lastTickTime where
// it was and the elapsed time is read back off the wall. That is what
// lets the interior host go unwired below without changing behaviour.

import { modSettingsOf } from './modSettings.js';

export const AMBIENT_TEXT_VENDOR = 'ambient-text';

let _host = null;

/** The host that owns the motor claims the mod. `null` releases it.
 *  `{ insideBuilding(), where(), say(text, seconds), paused() }`. */
export function setAmbientTextHost(host) { _host = host; }

const _mod = createAmbientText({
  settings: () => readAmbientTextSettings((k) => modSettingsOf(AMBIENT_TEXT_VENDOR)[k]),
  enabled: () => !!modSettingsOf(AMBIENT_TEXT_VENDOR).Enabled,
  ready: () => !!_host,
  paused: () => !!_host?.paused?.(),
  insideBuilding: () => _host?.insideBuilding?.() ?? true,   // no host is not a place to speak from
  where: () => _host?.where?.() ?? {},
  say: (text, seconds) => _host?.say?.(text, seconds),
});

/** Time.unscaledTime: real seconds since the page started. */
const wallSeconds = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;

/** Update, once per host frame. Returns the line said, or null. */
export const tickAmbientText = (unscaledTime = wallSeconds()) => _mod.update(unscaledTime);

/** The one component, for the suite and for a host that wants its state. */
export const ambientTextMod = () => _mod;
