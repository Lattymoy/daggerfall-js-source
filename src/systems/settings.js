// THE SETTINGS STORE - DaggerfallUnity's SettingsManager (MIT,
// Daggerfall Workshop), 1:1 on the parts that have a law.
//
// DFU keeps 165 settings in an ini read from Assets/Resources/
// defaults.ini.txt, exposed through the setup wizard's Options panel
// and DaggerfallAdvancedSettingsWindow. Until now this port had NO
// store: every setting it branched on was a constant, and the Ledger
// row that recorded them (section A) said so. This module is that row
// becoming real.
//
// WHAT IS VERBATIM
//   - the sections, keys and DEFAULT VALUES: parsed from the VENDORED
//     defaults.ini.txt (vendor/dfu-settings), not hand-transcribed -
//     171 defaults across 13 sections is exactly the lossy-copy shape
//     AUDIT 17e F9 caught in the item templates.
//   - the TYPED GETTERS, including their failure modes, which are
//     quirks and not accidents (SettingsManager.cs:911-1000):
//       GetBool   bool.Parse; a value that will not parse reads FALSE,
//                 not the default (:921-936)
//       GetInt    int.Parse then Mathf.Clamp(value, min, max); a value
//                 that will not parse reads MIN, not the default
//                 (:952-964)
//       GetFloat  same shape as GetInt (:984-996)
//       GetString raw, no parse and no fallback (:911-914)
//
// WHAT IS OURS (Ledger A, the presentation split this port always
// makes): WHERE the values live. DFU writes an ini beside the
// executable; a browser has no such place, so the store persists to
// localStorage under one key and falls back to the parsed defaults
// when storage is empty, unavailable or corrupt. Same values, same
// names, same semantics - a different shelf.
//
// THE TIERS. DFU can honour every setting it ships because DFU
// implements both sides of each one. This port does not, and a
// settings screen that offers a toggle which changes nothing is a
// lie. So every key carries a tier and the launcher reads it:
//   live         a consumer exists; flipping it changes play
//   stored       round-trips faithfully, no consumer yet (the port's
//                INTERIM doctrine - named, not silently ignored)
//   unavailable  meaningless here (resolution, controllers, mod
//                paths) or the port implements ONE side of the branch
//                (EnhancedCombatAI, AdvancedClimbing - see the Ledger)
// A tier is a CLAIM about this port, so settings.test.js re-derives
// the live set from the code and fails if a tier lies.

import { SETTINGS_DEFAULTS } from './settingsDefaults.js';

const STORAGE_KEY = 'dagger.settings.v1';

/** The vendored defaults, baked by scripts/bakeSettings.mjs. Section
 *  -> key -> RAW STRING, exactly as DFU's ini carries them (every
 *  value is a string until a typed getter reads it - the same as
 *  SettingsManager's GetData). The bake is pinned against the
 *  vendored bytes in settings.test.js, so a stale bake fails. */
export const DEFAULTS = SETTINGS_DEFAULTS;

/** Every key as "Section/Key", for sweeps and the launcher. */
export const ALL_KEYS = Object.freeze(
  Object.entries(DEFAULTS).flatMap(([s, keys]) => Object.keys(keys).map((k) => `${s}/${k}`)));

// ---- the tiers (see the header) ----
/** live: a consumer exists and flipping the value changes play. Each
 *  entry names the consumer so settings.test.js can check it. */
export const LIVE = Object.freeze({
  'Enhancements/CombatVoices': 'src/combat/combatVoices.js',
  'Enhancements/PlayerTorchFromItems': 'src/systems/startingGear.js',
  'Enhancements/LoiterLimitInHours': 'src/systems/restSession.js',
  'Controls/SoundVolume': 'src/systems/audio.js',
  'Controls/InstantRepairs': 'src/scenes/worldModes.js',      // R1: the repair flow's instant branch
  'Controls/AllowMagicRepairs': 'src/scenes/worldModes.js',   // R1: the repair entry gate + world.js's enchantCtx seam
  'Controls/MusicVolume': 'src/systems/songPlayer.js',
  'Controls/MouseLookSensitivity': 'src/ui/lookSettings.js',
  'Controls/InvertMouseVertical': 'src/ui/lookSettings.js',
  // AUDIT: this one was tiered `stored` while main.js read it as
  // the launcher gate - the launcher misreported the single
  // setting that controls the launcher. The reverse-direction
  // pin below now makes that shape a test failure.
  'GUI/ShowOptionsAtStart': 'src/main.js',
  // U31: THE START CELL. These three were `stored` while the classic
  // start ignored them entirely and booted a fixed dev scene, which is
  // why Privateer's Hold had no way out. The world host now reads all
  // three exactly as StartGameBehaviour does (:371-401): the cell says
  // WHERE the game begins, StartInDungeon says whether it begins
  // inside. Changing StartCellX/Y in the settings screen really does
  // start a new character somewhere else.
  'Startup/StartCellX': 'src/scenes/world.js',
  'Startup/StartCellY': 'src/scenes/world.js',
  'Startup/StartInDungeon': 'src/scenes/world.js',
  // MENU: the first VIDEO setting to become real - five hosts drew
  // their projection at a hardcoded Math.PI/3, which is DFU's
  // MINIMUM (60) rather than its default (65).
  'Video/FieldOfView': 'src/ui/viewSettings.js',
  // AUDIT 24 (the seven-slice sweep): three the quest arc had been
  // reading as HARDCODED falses. Every one has a live consumer and a
  // launcher toggle, so the player could flip a switch that reached
  // nothing: adult quests were filtered out whatever ChildGuard said,
  // the guild list-box arm was unreachable, and the journal's clocks
  // never counted down.
  'ChildGuard/PlayerNudity': 'src/scenes/questBridge.js',
  'Enhancements/GuildQuestListBox': 'src/scenes/questBridge.js',
  'GUI/ShowQuestJournalClocksAsCountdown': 'src/scenes/world.js',
  // A1: the dungeon automap - the LRU prune reads the remembered-
  // dungeon count; the window reads the slice, micro-map and colour
  // rows. (The four Automap*Color keys stay stored - they colour the
  // EXTERIOR automap, which pends A2.)
  'Map/AutomapNumberOfDungeons': 'src/systems/automap.js',
  'Map/AutomapAlwaysMaxOutSliceLevel': 'src/ui/automapWindow.js',
  'Map/AutomapRememberSliceLevel': 'src/ui/automapWindow.js',
  'Map/AutomapDisableMicroMap': 'src/ui/automapWindow.js',
  'Map/DungeonMicMapQoL': 'src/ui/automapWindow.js',
  'Map/DunMicMapInnerColor': 'src/ui/automapWindow.js',
  'Map/DunMicMapBorderColor': 'src/ui/automapWindow.js',
  // D1: the streamed-grid radius (StreamingWorld.TerrainDistance,
  // 1..4). The launcher row said "saved, but nothing reads it" while
  // the world host ran the hardcoded default - the exact live-tier
  // gap GUI/ShowOptionsAtStart taught this file to test for.
  'Experimental/TerrainDistance': 'src/scenes/world.js',
  // A2: the exterior automap - the four building-group colours
  // (ExteriorAutomap.cs:1482-1541) and the zoom memory pair
  // (window :460-461, :513-533).
  'Map/AutomapTempleColor': 'src/ui/exteriorAutomapWindow.js',
  'Map/AutomapShopColor': 'src/ui/exteriorAutomapWindow.js',
  'Map/AutomapTavernColor': 'src/ui/exteriorAutomapWindow.js',
  'Map/AutomapHouseColor': 'src/ui/exteriorAutomapWindow.js',
  'Map/ExteriorMapDefaultZoomLevel': 'src/ui/exteriorAutomapWindow.js',
  'Map/ExteriorMapResetZoomLevelOnNewLocation': 'src/ui/exteriorAutomapWindow.js',
  // U37: the tooltip. All four shipped stored-tier with no consumer -
  // the component that reads them did not exist until the controls
  // grid needed to show the full text behind an elongated key label.
  'GUI/EnableToolTips': 'src/ui/toolTip.js',
  'GUI/ToolTipDelayInSeconds': 'src/ui/toolTip.js',
  'GUI/ToolTipTextColor': 'src/ui/toolTip.js',
  'GUI/ToolTipBackgroundColor': 'src/ui/toolTip.js',
  // U38: the crosshair and the interaction-mode indicator. Both were
  // stored-tier - the launcher offered a Crosshair toggle and an icon
  // STYLE for components that did not exist.
  // U45: the large HUD. `LargeHUD` itself had been WRITTEN by the pause
  // window since I3 and read by nothing at all, which the settings
  // screen was quietly reporting as a working toggle.
  'GUI/LargeHUD': 'src/ui/hudLarge.js',
  'GUI/LargeHUDDocked': 'src/ui/hudLarge.js',
  'GUI/LargeHUDUndockedScale': 'src/ui/hudLarge.js',
  'GUI/LargeHUDUndockedAlignment': 'src/ui/hudLarge.js',
  // U46: the eight buff/debuff icon layouts. Another key the settings
  // screen offered with nothing on the other end.
  'GUI/IconsPositioningScheme': 'src/ui/hudActiveSpells.js',
  'GUI/Crosshair': 'src/ui/hudCrosshair.js',
  'GUI/InteractionModeIcon': 'src/ui/hudCrosshair.js',
  // U41: the classic travel map. Stored-tier since the settings
  // screen shipped - the outline it offers is drawn by a window the
  // port did not have until the region pages landed.
  'GUI/TravelMapLocationsOutline': 'src/ui/travelMapWindow.js',
});
/** unavailable: meaningless in a browser, or the port implements only
 *  ONE side of the branch. The launcher shows these disabled WITH the
 *  reason rather than hiding them - a hidden setting is a setting the
 *  player cannot find out about. */
export const UNAVAILABLE = Object.freeze({
  'Enhancements/EnhancedCombatAI': 'the port implements the CLASSIC enemy AI only (Ledger A)',
  'Enhancements/AdvancedClimbing': 'the port implements the CLASSIC climbing path only (Ledger A)',
  'Enhancements/LypyL_ModSystem': 'no mod system (Ledger C, Not planned)',
  'Enhancements/AssetInjection': 'no mod system (Ledger C, Not planned)',
  'Enhancements/CompressModdedTextures': 'no mod system (Ledger C, Not planned)',
  'Experimental/CustomBooksImport': 'no mod system (Ledger C, Not planned)',
  'Daggerfall/MyDaggerfallPath': 'the browser picks a folder or zip; there is no path (dataSource.js)',
  'Daggerfall/MyDaggerfallUnitySavePath': 'saves live in browser storage',
  'Daggerfall/MyDaggerfallUnityScreenshotsPath': 'the browser owns downloads',
  'Video/ResolutionWidth': 'the browser sizes its own canvas',
  'Video/ResolutionHeight': 'the browser sizes its own canvas',
  'Video/Fullscreen': 'the browser owns fullscreen',
  'Video/ExclusiveFullscreen': 'the browser owns fullscreen',
  'Controls/EnableController': 'no gamepad support yet',
  'Controls/JoystickLookSensitivity': 'no gamepad support yet',
  'Controls/JoystickCursorSensitivity': 'no gamepad support yet',
  'Controls/JoystickMovementThreshold': 'no gamepad support yet',
  'Controls/JoystickDeadzone': 'no gamepad support yet',
});
/** The tier of one "Section/Key". Everything not named above is
 *  STORED - it round-trips but nothing reads it yet. */
export function tierOf(key) {
  if (key in LIVE) return 'live';
  if (key in UNAVAILABLE) return 'unavailable';
  return 'stored';
}

// ---- the store ----
let _values = null;   // Section -> key -> raw string (overrides only)

const storage = () => {
  try { return globalThis.localStorage ?? null; } catch { return null; }
};

/** Load overrides from storage. A missing, unreadable or corrupt blob
 *  is NOT an error - it means "defaults", which is exactly what DFU
 *  does with a missing ini. */
export function loadSettings() {
  _values = {};
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') _values = parsed;
    }
  } catch (e) {
    console.warn('[settings] stored settings unreadable; falling back to defaults', e);
    _values = {};
  }
  return _values;
}

/** SettingsManager.SaveSettings (:1000+) - write the overrides back.
 *  Only values that DIFFER from the default are stored, so a later
 *  change to DFU's defaults reaches players who never touched that
 *  setting (DFU's ini stores everything; ours is a delta, which is a
 *  storage-shape choice, not a semantic one). */
export function saveSettings() {
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(_values ?? {}));
    return true;
  } catch (e) {
    console.warn('[settings] settings could not be saved (storage full or disabled)', e);
    return false;
  }
}

/** GetData: the override if one exists, else the vendored default,
 *  else undefined (an unknown key - DFU throws; we return undefined
 *  and let the typed getter's own fallback speak). */
function getData(section, key) {
  if (_values === null) loadSettings();
  return _values?.[section]?.[key] ?? DEFAULTS[section]?.[key];
}

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/** GetBool (:921-936): bool.Parse, and a value that will not parse
 *  reads FALSE - not the default. C# bool.Parse accepts "True"/"true"
 *  with surrounding whitespace and nothing else. */
export function getBool(section, key) {
  const raw = getData(section, key);
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'true') return true;
  if (s === 'false') return false;
  console.warn(`[settings] GetBool() could not read value [${section}]${key}. Returning False.`);
  return false;
}

/** GetInt (:939-964). Without a range: int.Parse, 0 on failure. With
 *  one: parse then Mathf.Clamp, and MIN on failure. */
export function getInt(section, key, min = null, max = null) {
  const raw = getData(section, key);
  const n = /^[+-]?\d+$/.test(String(raw ?? '').trim()) ? parseInt(raw, 10) : NaN;
  if (Number.isNaN(n)) {
    const fallback = min === null ? 0 : min;
    console.warn(`[settings] GetInt() could not read value [${section}]${key}. Returning ${fallback}.`);
    return fallback;
  }
  return min === null ? n : clamp(n, min, max);
}

/** GetFloat (:971-996), the same shape as GetInt. */
export function getFloat(section, key, min = null, max = null) {
  const raw = getData(section, key);
  const n = Number(String(raw ?? '').trim());
  if (!Number.isFinite(n) || String(raw ?? '').trim() === '') {
    const fallback = min === null ? 0 : min;
    console.warn(`[settings] GetFloat() could not read value [${section}]${key}. Returning ${fallback}.`);
    return fallback;
  }
  return min === null ? n : clamp(n, min, max);
}

/** GetString (:911-914): raw, no parse, no fallback. */
export function getString(section, key) {
  return String(getData(section, key) ?? '');
}

/** SetBool/SetInt/SetFloat/SetString (:916-919 etc) all funnel to
 *  SetData over a STRING - C#'s value.ToString(). Booleans stringify
 *  capitalised ("True"), which is what bool.Parse round-trips and what
 *  the ini carries. */
export function setValue(section, key, value) {
  if (_values === null) loadSettings();
  const str = typeof value === 'boolean' ? (value ? 'True' : 'False') : String(value);
  const def = DEFAULTS[section]?.[key];
  if (def !== undefined && str === String(def)) {
    // back to the default: drop the override rather than pinning today's value
    if (_values[section]) { delete _values[section][key]; if (!Object.keys(_values[section]).length) delete _values[section]; }
    return;
  }
  _values[section] ??= {};
  _values[section][key] = str;
}

/** Every value the store would report, defaults merged with overrides
 *  - the shape the launcher renders and a save/export would write. */
export function effectiveSettings() {
  if (_values === null) loadSettings();
  const out = {};
  for (const [s, keys] of Object.entries(DEFAULTS)) {
    out[s] = { ...keys, ...(_values[s] ?? {}) };
  }
  return out;
}

/** Drop every override. DFU's wizard has no reset button; ours does,
 *  because a browser player cannot delete an ini by hand. */
export function resetToDefaults() {
  _values = {};
  saveSettings();
}

/** Test seam: forget the loaded state so the next read re-loads. */
export function _resetForTests() { _values = null; }
