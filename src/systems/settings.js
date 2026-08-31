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
import { appStorage } from './appStorage.js';   // DA1: the storage seam

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
  // MT-i: EnemyInfighting. OFF sends GetTargets down its else-arm
  // (:801-803), where a non-PlayerAlly foe skips every enemy
  // candidate and the whole scene is player-only again - which is
  // exactly what the launcher's own blurb promises.
  'Enhancements/EnemyInfighting': 'src/characters/enemyTargets.js',
  'Enhancements/PlayerTorchFromItems': 'src/systems/playerTorch.js',   // T1: it gates the torch itself now, not just the starting gear
  'Enhancements/LoiterLimitInHours': 'src/systems/restSession.js',
  // S40: the illegal-rest confirm. OFF makes camping in a town simply
  // impossible (CanRest refuses and no time passes); ON turns it into
  // a Yes/No box. Either way the Vagrancy crime lands. The reader is
  // restSession's `illegalRestWarning()`; DaggerfallRestWindow's own
  // two-step (:641-692) is the ONE branch on it, in ui/restWindow.js -
  // no host reads this key.
  'GUI/IllegalRestWarning': 'src/systems/restSession.js',
  // BG1: ShopQualityPresentation. 0 shows the classic popup and DEFERS
  // the door behind it, 1 puts the record's lines on the HUD and does
  // not defer, 2 says nothing - the branch is
  // buildingGreeting.shopQualityPresentation and the reader is the
  // exterior door arm in worldModes. The HOUSE greeting is not behind
  // it, which is DFU's own split.
  'GUI/ShopQualityPresentation': 'src/systems/buildingGreeting.js',
  // AUDIT 28 W1: four keys whose DFU consumer the port had ported
  // WITH THE SETTING NAMED IN ITS OWN COMMENT and the read left out -
  // each answered the default and the slider did nothing. The read
  // lives where DFU's does: TalkManager.WeightedRandomRumor :1452,
  // EnemyDeath :82, PlayerAmbientLight :89 (plain-dungeon arm only)
  // and :123 (CalcDaytimeAmbientLight's night colour).
  'GUI/QuestRumorWeight': 'src/systems/rumorMill.js',
  'GUI/DisableEnemyDeathAlert': 'src/scenes/corpseMarker.js',
  'Enhancements/DungeonAmbientLightScale': 'src/world/dungeonLights.js',
  'Enhancements/NightAmbientLightScale': 'src/scenes/world.js',
  // AUDIT 28 W2a: the arrow counter (DaggerfallHUD :270-292) - a
  // default-ON feature the port never drew. The setting is the FIRST
  // of its three gates; BowLeftHandWithSwitching picks the hand the
  // bow is looked for in (:275). Both read in hud.arrowCountLabel.
  'GUI/EnableArrowCounter': 'src/ui/hud.js',
  'Enhancements/BowLeftHandWithSwitching': 'src/ui/hud.js',
  // AUDIT 28 W2b: MeleeDamage's friendly protection (WeaponManager
  // :930-944): the box pass skips allies and the pacified; the vanilla
  // arm strikes one only when it is alone. Read in friendlyProtected.
  'MeleeAttacks/MeleeAttackFriendlyProtection': 'src/combat/playerWeapon.js',
  // AUDIT 28 W2c: the exit-door wagon prompt (PlayerActivate :649-664):
  // a dungeon exit with a cart in the pack asks TEXT.RSC 38 first.
  'GUI/DungeonExitWagonPrompt': 'src/scenes/worldModes.js',
  // AUDIT 28 W2d: HUDFlickerController.NextCycle's first gate (:45) -
  // the fast flicker under 40% health, the slow throb under 20%.
  'Enhancements/NearDeathWarning': 'src/ui/hud.js',
  // AUDIT 28 W3: ArmorShouldShowMaterial (ItemHelper :822-848) - the
  // four-way helm/shield material display, read at the point of use.
  'GUI/HelmAndShieldMaterialDisplay': 'src/systems/itemInfo.js',
  // AUDIT 28 W3: AddRandomEnemies' fork (RDBLayout :512) - the classic
  // 256-entry lists, or AddRandomRDBEnemy's per-flat pick by power.
  'Enhancements/AlternateRandomEnemySelection': 'src/characters/dungeonEnemies.js',
  // AUDIT 28 W3c: UseLocationDungeonTextureTable's fork (DaggerfallDungeon
  // :174-196): classic / by-climate / randomized, with the main-story gate.
  'Video/RandomDungeonTextures': 'src/world/dungeonTextures.js',
  // AUDIT 28 W4: MapsFile.UseSmallerDungeon (:776-797) + Quest.Start's
  // frozen stamp (Quest.cs:284) - the five-block plus for big dungeons.
  'Experimental/SmallerDungeons': 'src/world/smallerDungeons.js',
  // AUDIT 28 W5: PlayerSpeedChanger.CaptureInputSpeedAdjustment
  // (:75-78) - a press FLIPS the sneak mode instead of holding it.
  'Controls/ToggleSneak': 'src/player/motor.js',
  // AUDIT 28 W6: AddHUDText's duration for the shop-quality lines
  // (PlayerActivate :1382), GetInt 1..10.
  'GUI/ShopQualityHUDDelay': 'src/scenes/worldModes.js',
  // AUDIT 28 W7: PlayerMouseLook.ApplySmoothing (:154-166) - the look
  // filter every host drives; GetFloat 0..0.9 (SettingsManager :523).
  'Controls/MouseLookSmoothingFactor': 'src/player/lookFilter.js',
  // AUDIT 28 W8: InputManager's ApplyHorizontalForce/ApplyVerticalForce/
  // ApplyFriction (:1445-1497) - the axes climb and decay at 9.8/s.
  'Controls/MovementAcceleration': 'src/player/moveAxes.js',
  // AUDIT 28 W9: CameraRecoiler (whole) - the reel on a hit; GetInt 0..4.
  'Controls/CameraRecoilStrength': 'src/player/cameraRecoiler.js',
  // AUDIT 28 W10: HeadBobber (whole) - the walk bob, the nod, the landing dip.
  'Controls/HeadBobbing': 'src/player/headBobber.js',
  // AUDIT 28 W11: WeaponManager.TrackMouseAttack's gate (:808) is the
  // SETTING (StartGameBehaviour :263), GetFloat 0.001..1 - shipped 0.005;
  // WeaponSwingMode (:306-350): 0 gesture, 1 click, 2 click or hold.
  'Controls/WeaponAttackThreshold': 'src/combat/playerWeapon.js',
  'Controls/WeaponSwingMode': 'src/combat/playerWeapon.js',
  // AUDIT 28 W12: the bow's draw-and-hold (WeaponManager :341, :353-360)
  // - press draws, release looses, activate un-draws, 10 s times out.
  'Controls/BowDrawback': 'src/combat/playerWeapon.js',
  // AUDIT 28 W13: FPSWeapon.FlipHorizontal (StartGameBehaviour :269) -
  // left-hand rendering; GetInt 0..3, only 1 does anything in DFU.
  'Controls/Handedness': 'src/combat/fpsWeapon.js',
  // UI3: PaperDoll.GetPaperDollBackground (:207-230) - the region's own
  // backdrop instead of the race's. Ships False, and the port had been
  // behaving as if it were True.
  'GUI/EnableGeographicBackgrounds': 'src/ui/paperDoll.js',
  // UI4: the item info panel is only ADDED when this is on
  // (DaggerfallInventoryWindow :303-307).
  'GUI/EnableInventoryInfoPanel': 'src/ui/nativeInventory.js',
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
  'Enhancements/AssetInjection': 'src/systems/musicReplacement.js',   // M-EXT: DFU's own gate on SoundReplacement, now real for MUSIC
  'Audio/AlternateMusic': 'src/scenes/shared.js',   // M-FM: read once in createMusicDirector, for all three hosts
  'GUI/InteractionModeIcon': 'src/ui/hudCrosshair.js',
  // VB1: the vitals indicators (F148) and the health/fatigue swap
  // (F149). Both were surfaced on the settings screen and read by
  // nothing - DFU ships EnableVitalsIndicators TRUE, so the port's
  // three plain bars had been the setting-FALSE path all along.
  'GUI/EnableVitalsIndicators': 'src/ui/hudVitals.js',
  'GUI/SwapHealthAndFatigueColors': 'src/ui/hudVitals.js',
  // U41: the classic travel map. Stored-tier since the settings
  // screen shipped - the outline it offers is drawn by a window the
  // port did not have until the region pages landed.
  'GUI/TravelMapLocationsOutline': 'src/ui/travelMapWindow.js',
  // TransferItem's quest arm (DaggerfallInventoryWindow.cs:1487) - the
  // gate on moving a quest item out of the pack, read by the one law
  // both the inventory window and the shop's Sell staging call.
  'GUI/CanDropQuestItems': 'src/systems/itemTransfer.js',   // U56: TransferItem's quest arm moved with the ladder
});
/** unavailable: meaningless in a browser, or the port implements only
 *  ONE side of the branch. The launcher shows these disabled WITH the
 *  reason rather than hiding them - a hidden setting is a setting the
 *  player cannot find out about. */
export const UNAVAILABLE = Object.freeze({
  'Enhancements/EnhancedCombatAI': 'the port implements the CLASSIC enemy AI only (Ledger A)',
  'Enhancements/AdvancedClimbing': 'the port implements the CLASSIC climbing path only (Ledger A)',
  'Enhancements/LypyL_ModSystem': 'no mod system (Ledger C, Not planned)',
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

// DA1: the storage seam - localStorage in a browser, the desktop
// shell's file store (a real settings file under Prefs/) in the app.
const storage = () => appStorage();

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
    _publish(section, key, str);
    return;
  }
  _values[section] ??= {};
  _values[section][key] = str;
  _publish(section, key, str);
}

// ---- THE CHANGE, PUBLISHED (2026-08-27) ----
// LIVE was a tier the registry could name but a consumer could only
// honour by re-reading on its next natural occasion - the next song, the
// next boot. Mac, from play: the music slider must work while music is
// playing, and a song that loops has no next occasion. So a write is
// PUBLISHED, once, to whoever asked: the music service re-levels its
// players, and any other LIVE consumer can take the same door instead of
// polling. The callback gets the section, the key, and the string as
// stored (the default's string when the override was dropped). A
// listener that throws is warned and skipped: a bad listener must not
// make a settings write fail.
const _listeners = new Set();
export function onSettingChange(fn) { _listeners.add(fn); return () => _listeners.delete(fn); }
function _publish(section, key, str) {
  for (const fn of _listeners) {
    try { fn(section, key, str); } catch (e) { console.warn('[settings] listener failed:', e?.message ?? e); }
  }
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
