// IMMERSIVE FOOTSTEPS 1.01 (Kirk.O), THE MOD, 1:1 (IF1, 2026-09-16,
// Mac: "Next mod we will be adding 1:1").
//
// "Adds New Footsteps Sounds That Change Based On What Terrain Is
// Being Walked On, Also Armor Sway Sounds Based On What Type Of Armor
// You Have Equipped." Two MonoBehaviours, ported from the author's
// own MIT sources (vendor/immersive-footsteps/Scripts/, the .cs the
// shipped bundle's manifest names - the DLL in the bundle is their
// build): `ImmersiveFootstepsMain` (the statics: the settings, the
// clip tables, the worn-armor slots and their sway weights, the
// transition and window handlers, the interior floor law) and
// `ImmersiveFootstepsObject` (FixedUpdate at 0.02 s: the step and
// sway timers, the swim distance, the exterior climate/tile law, the
// dungeon water law, the fall-landing arms, the two no-repeat rolls).
// Every function below names the method it restates; the mod's own
// quirks are KEPT and marked `[verbatim]`.
//
// THE COMPONENT OWNS THE STRIDE. DisableVanillaFootsteps (Main :891-
// 906) sets every PlayerFootsteps clip to None and disables the
// component - the stride, the two fall sounds and the large splash.
// The hosts keep running the classic FootstepMachine (its water latch
// and landing shape are state other readers want) and ask
// `ownsStride()` before playing what it returns; the three landing
// sounds go through `fallSoundSink` / `playLargeSplash`. While the
// audio is still loading (a fetch + decode here, where DFU's
// LoadAudio is synchronous) the mod owns nothing and the classic
// stride plays - which is DFU's own shape for a LoadAudio that throws:
// Start aborts before DisableVanillaFootsteps and AddComponent.
//
// FIXED STEP. FixedUpdate runs at Time.fixedDeltaTime = 0.02 and the
// refresh counter counts TICKS (250 = 5 s, whatever the mod's comment
// says about 50); the hosts hand a frame dt and this module runs the
// fixed step under an accumulator, so the timers and the tick count
// mean what they mean in Unity.
//
// SoundVolume: the mod multiplies `DaggerfallUnity.Settings.SoundVolume`
// into every PlayOneShot; the port's master bus already applies it
// (systems/audio.js), so it is NOT multiplied again here.

import { CLIMATES } from '../formats/mapsFile.js';
import { SEASON } from '../world/climateSwaps.js';
import { EQUIP_SLOTS } from '../characters/paperdoll.js';
import { equipTableOf } from './equip.js';
import { ARMOR_MATERIAL } from './armorMaterials.js';
import { TRANSPORT_MODES } from './transport.js';
import { modSettingsOf } from './modSettings.js';
import { audio as defaultAudio } from './audio.js';
import { SOUND } from './soundClips.js';

export const IMMERSIVE_FOOTSTEPS_VENDOR = 'immersive-footsteps';
export const IMMERSIVE_FOOTSTEPS_MOD = Object.freeze({
  title: 'ImmersiveFootsteps', version: '1.01', author: 'Kirk.O',
  guid: '8c75cd21-ca71-4841-b637-7728433c99f1', dfunity: '1.0.0',
});

export const FIXED_DELTA_TIME = 0.02;                 // Time.fixedDeltaTime
export const SWIM_INTERVAL = 1.75;            // Object.cs:20 swimInterval
export const REFRESH_SLOTS_TICKS = 250;       // Object.cs:71
export const MAX_TICKS_PER_FRAME = 5;         // the hosts' 0.1 s dt cap, in ticks
export const SOUND_CLIP_QUALITY = Object.freeze({ Low: 0, High: 1 });   // SoundClipQuality: 0 'Low-Quality (Retro)', 1 'High-Quality'
export const FLOOR_TYPE = Object.freeze({ Tile: 0, Stone: 1, Wood: 2 });   // Main.CurrInteriorFloorType
export const LANDING_VOLUME_SCALE = 4;        // Object.cs:504/512/519 - 4f * FootstepVolumeMulti
/** UpdateSwayMaterialWeights (Main.cs:571-603): "0 = Head, 1 = Right-Arm,
 *  2 = Left-Arm, 3 = Chest, 4 = Gloves, 5 = Legs" - Feet is READ (WornBoots)
 *  but carries no sway weight. */
export const SWAY_WEIGHTS = Object.freeze([2, 1, 1, 3, 1, 4]);
export const SWAY_SLOTS = Object.freeze([EQUIP_SLOTS.Head, EQUIP_SLOTS.RightArm, EQUIP_SLOTS.LeftArm, EQUIP_SLOTS.ChestArmor, EQUIP_SLOTS.Gloves, EQUIP_SLOTS.LegsArmor]);

// --- The clip tables (Main.cs:62-117; LoadAudio :620-889) ----------------

export const FOOTSTEP_SETS = Object.freeze(['Chainmail', 'Leather', 'Plate', 'Unarmored', 'DeepWater', 'Grass', 'Gravel', 'Mud', 'Path', 'Sand', 'ShallowWater', 'Snow', 'Tile', 'Wood']);
export const SWAY_SETS = Object.freeze(['Chainmail', 'Leather', 'Plate']);
export const LANDING_SETS = Object.freeze(['Chainmail', 'Leather', 'Plate', 'Unarmored']);
export const ARMOR_SETS = Object.freeze(['Chainmail', 'Leather', 'Plate', 'Unarmored']);   // the Armor_Footsteps folder
const FILE_WORD = Object.freeze({ DeepWater: 'Deep_Water', ShallowWater: 'Shallow_Water' });
const QUALITY_PREFIX = (q) => (q === SOUND_CLIP_QUALITY.High ? 'HQ' : 'LQ');

/** LoadAudio's asset names for one quality, table by table: `Main` is
 *  clips 1-3 and `Alt` 4-6 of each footstep set, `Swaying` 1-4,
 *  `HardLanding` 1-2, `WaterLandingSound` the one clip. 105 names. */
export function clipTable(quality) {
  const P = QUALITY_PREFIX(quality);
  const t = {};
  for (const s of FOOTSTEP_SETS) {
    const w = FILE_WORD[s] ?? s;
    t[`${s}FootstepsMain`] = Object.freeze([1, 2, 3].map((n) => `${P}_${w}_Footstep_${n}`));
    t[`${s}FootstepsAlt`] = Object.freeze([4, 5, 6].map((n) => `${P}_${w}_Footstep_${n}`));
  }
  for (const s of SWAY_SETS) t[`${s}Swaying`] = Object.freeze([1, 2, 3, 4].map((n) => `${P}_${s}_Swaying_${n}`));
  for (const s of LANDING_SETS) t[`${s}HardLanding`] = Object.freeze([1, 2].map((n) => `${P}_${s}_Hard_Landing_${n}`));
  t.WaterLandingSound = Object.freeze([`${P}_Water_Landing_1`]);
  return Object.freeze(t);
}

/** Every name LoadAudio asks for at one quality (the `success &=` chain). */
export const clipNames = (quality) => Object.values(clipTable(quality)).flat();

/** Where the bundle keeps each clip, under vendor/immersive-footsteps/Audio/
 *  (the folders are the author's; the names are what LoadAudio asks for). */
export function clipFolder(name) {
  const hq = name.startsWith('HQ_');
  const set = name.slice(3).split('_')[0];
  if (/_Swaying_\d$/.test(name)) return hq ? 'High_Quality/Armor_Swaying' : 'Low_Quality/Armor_Swaying';
  if (/_Landing_\d$/.test(name)) return hq ? 'High_Quality/Fall_Landing' : 'Low_Quality/Fall_Landing';
  if (ARMOR_SETS.includes(set)) return hq ? 'High_Quality/Armor_Footsteps' : 'Low_Quality/Armor';
  return hq ? 'High_Quality/Climate_Footsteps' : 'Low_Quality/Climate';
}
export const clipPath = (name) => `vendor/immersive-footsteps/Audio/${clipFolder(name)}/${name}.mp3`;

// BROWSER-ONLY: import.meta.glob is a Vite compile-time macro (the road
// eotbSprite.js and dynamicSkiesAssets.js take) - node has no
// transform for it, and the pins read the files by path instead.
const IN_BROWSER = typeof window !== 'undefined';
const URLS = IN_BROWSER
  ? import.meta.glob('../../vendor/immersive-footsteps/Audio/*/*/*.mp3', { eager: true, query: '?url', import: 'default' })
  : {};
export const clipUrl = (name) => URLS[`../../${clipPath(name)}`] ?? null;
export const soundKey = (name) => `if:${name}`;   // the audio engine's registered-buffer key (MW-D40)

// --- The tile and archive tables (Object.cs:365-467) ---------------------

export const SHALLOW_WATER_TILES = Object.freeze(new Set([5, 6, 8, 20, 21, 23, 30, 31, 33, 34, 35, 36, 49]));
export const PATH_TILES = Object.freeze(new Set([46, 47, 55]));
export const TEMPERATE_DIRT_TILES = Object.freeze(new Set([1, 4, 7, 10, 13, 25, 26, 28, 37, 38, 39, 51, 52, 54]));
export const TEMPERATE_STONE_TILES = Object.freeze(new Set([3, 14, 16, 17, 24, 27, 29, 32, 43, 44, 45, 50]));
export const MOUNTAIN_DIRT_TILES = TEMPERATE_DIRT_TILES;      // the two tables are equal, entry for entry
export const MOUNTAIN_STONE_TILES = TEMPERATE_STONE_TILES;
export const DESERT_GRAVEL_TILES = Object.freeze(new Set([2, 9, 11, 12, 15, 18, 19, 22, 39, 40, 41, 42, 45, 53]));
export const DESERT_STONE_TILES = Object.freeze(new Set([3, 14, 16, 17, 24, 26, 27, 29, 32, 38, 43, 44]));
export const SWAMP_BOG_TILES = Object.freeze(new Set([1, 4, 7, 10, 13, 25, 26, 28, 37, 38, 39, 50, 51, 52, 54]));
export const SWAMP_GRASS_TILES = Object.freeze(new Set([3, 14, 16, 17, 24, 27, 29, 32, 43, 44, 45]));
export const SWAMP_SNOW_ALT_TILES = Object.freeze(new Set([1, 7, 10, 11, 13, 25, 26, 28, 37, 38, 39, 43, 48, 50, 52]));
export const CLIMATE_TILE_TABLES = Object.freeze({
  Shallow_Water: SHALLOW_WATER_TILES, Path: PATH_TILES,
  Temperate_Dirt: TEMPERATE_DIRT_TILES, Temperate_Stone: TEMPERATE_STONE_TILES,
  Mountain_Dirt: MOUNTAIN_DIRT_TILES, Mountain_Stone: MOUNTAIN_STONE_TILES,
  Desert_Gravel: DESERT_GRAVEL_TILES, Desert_Stone: DESERT_STONE_TILES,
  Swamp_Bog: SWAMP_BOG_TILES, Swamp_Grass: SWAMP_GRASS_TILES, Swamp_Snow_Alt: SWAMP_SNOW_ALT_TILES,
});
/** CheckClimateTileTables (Object.cs:421-434). */
export const checkClimateTileTables = (climateKey, tileKey) => CLIMATE_TILE_TABLES[climateKey]?.has(tileKey) ?? false;

export const TILE_FLOOR_ARCHIVES = Object.freeze(new Set(['16_3', '37_3', '40_3', '41_0', '41_1', '41_2', '41_3', '44_3', '63_3', '111_2', '111_3', '137_3', '141_0', '141_1', '141_2', '141_3', '144_3', '311_3', '337_3', '341_0', '341_1', '341_2', '341_3', '363_3', '411_3', '437_3', '440_3', '444_3', '463_3']));
export const STONE_FLOOR_ARCHIVES = Object.freeze(new Set(['60_3', '140_3', '160_3', '163_3', '340_3', '360_3', '366_3', '416_3', '460_3', '466_3']));
export const WOOD_FLOOR_ARCHIVES = Object.freeze(new Set(['28_3', '66_3', '116_3', '128_3', '166_3', '171_3', '316_3', '328_3', '344_3', '428_3']));
export const BUILDING_FLOOR_TABLES = Object.freeze({ Tile_Floor: TILE_FLOOR_ARCHIVES, Stone_Floor: STONE_FLOOR_ARCHIVES, Wood_Floor: WOOD_FLOOR_ARCHIVES });
/** CheckBuildingClimateFloorTypeTables (Object.cs:454-467). */
export const checkBuildingClimateFloorTypeTables = (floorTypeKey, archiveKey) => BUILDING_FLOOR_TABLES[floorTypeKey]?.has(archiveKey) ?? false;

// --- Climate type checks (Object.cs:302-362) ------------------------------

export const isSnowyClimate = (c) => !(c === CLIMATES.Desert || c === CLIMATES.Desert2 || c === CLIMATES.Rainforest || c === CLIMATES.Subtropical);
export const isGrassyClimate = (c) => c === CLIMATES.Woodlands || c === CLIMATES.HauntedWoodlands;
export const isRockyClimate = (c) => c === CLIMATES.Mountain || c === CLIMATES.MountainWoods;
export const isSandyClimate = (c) => c === CLIMATES.Desert || c === CLIMATES.Desert2 || c === CLIMATES.Subtropical;
export const isSwampyClimate = (c) => c === CLIMATES.Swamp || c === CLIMATES.Rainforest;

// --- Materials (Main.cs:310-333) -----------------------------------------

/** MaterialReader.FormatName (MaterialReader.cs) - "TEXTURE.067 [Index=14]",
 *  which Unity's renderer.materials hands back with " (Instance)". The
 *  interior host builds the combined mesh's material names with this, in
 *  first-appearance order over the submeshes, so the mod's parser below
 *  reads exactly what it reads in DFU. */
export const unityMaterialName = (archive, record) => `TEXTURE.${String(archive).padStart(3, '0')} [Index=${record}] (Instance)`;

/** GetFormattedTextureArchiveFromMaterialName (Main.cs:310-333):
 *  "TEXTURE.067 [Index=14] (Instance)" -> "67_14"; '' on no match. */
export function getFormattedTextureArchiveFromMaterialName(input) {
  const m = /TEXTURE\.(\d+) \[Index=(\d+)\] \(Instance\)/.exec(String(input ?? ''));
  if (!m) return '';
  return `${m[1].replace(/^0+/, '')}_${m[2]}`;
}

/** The floor walk of UpdateFootsteps_OnTransitionInterior (Main.cs:237-
 *  308): the FIRST material that sits in any floor table decides, Wood
 *  before Stone before Tile at each material; none -> Tile (0), "just
 *  default the footstep sound to the 'Tile' one". */
export function interiorFloorType(materialNames) {
  for (const name of materialNames ?? []) {
    const key = getFormattedTextureArchiveFromMaterialName(name);
    if (key === '') continue;
    if (checkBuildingClimateFloorTypeTables('Wood_Floor', key)) return FLOOR_TYPE.Wood;
    if (checkBuildingClimateFloorTypeTables('Stone_Floor', key)) return FLOOR_TYPE.Stone;
    if (checkBuildingClimateFloorTypeTables('Tile_Floor', key)) return FLOOR_TYPE.Tile;
  }
  return FLOOR_TYPE.Tile;
}

// --- Settings (Main.cs:183-214) --------------------------------------------

export const SETTING_KEYS = Object.freeze([
  'Enabled',
  'AudioQualitySettings.SoundClipQuality',
  'FootstepSettings.AllowFootstepSounds', 'FootstepSettings.FootstepVolumeMulti', 'FootstepSettings.FootstepFrequency',
  'ArmorSwaySettings.AllowArmorSwaySounds', 'ArmorSwaySettings.ArmorSwayVolumeMulti', 'ArmorSwaySettings.ArmorSwayFrequency',
  'ErrorLoggingAndCompatibilitySettings.AllowModCompatWarnings', 'ErrorLoggingAndCompatibilitySettings.AllowVerboseErrorLogging', 'ErrorLoggingAndCompatibilitySettings.DoNotSpamExceptionsLogs',
]);

/** LoadSettings' reads, as the Mods pane resolves them. */
export function readFootstepSettings(read = () => modSettingsOf(IMMERSIVE_FOOTSTEPS_VENDOR)) {
  let s;
  try { s = read() ?? {}; } catch { s = {}; }
  return {
    Enabled: s.Enabled !== false,
    SoundClipQuality: s['AudioQualitySettings.SoundClipQuality'] ?? SOUND_CLIP_QUALITY.Low,
    AllowFootstepSounds: s['FootstepSettings.AllowFootstepSounds'] ?? true,
    FootstepVolumeMulti: s['FootstepSettings.FootstepVolumeMulti'] ?? 1.0,
    FootstepFrequency: s['FootstepSettings.FootstepFrequency'] ?? 0.6,
    AllowArmorSwaySounds: s['ArmorSwaySettings.AllowArmorSwaySounds'] ?? true,
    ArmorSwayVolumeMulti: s['ArmorSwaySettings.ArmorSwayVolumeMulti'] ?? 1.0,
    ArmorSwayFrequency: s['ArmorSwaySettings.ArmorSwayFrequency'] ?? 0.6,
    AllowCompatibilityWarnings: s['ErrorLoggingAndCompatibilitySettings.AllowModCompatWarnings'] ?? true,
    AllowVerboseErrorLogging: s['ErrorLoggingAndCompatibilitySettings.AllowVerboseErrorLogging'] ?? false,
    DoNotSpamExceptionsLogs: s['ErrorLoggingAndCompatibilitySettings.DoNotSpamExceptionsLogs'] ?? true,
  };
}
const sameSettings = (a, b) => a && b && Object.keys(a).every((k) => a[k] === b[k]);

// --- Random (Object.cs:531-586) --------------------------------------------

/** UnityEngine.Random.Range(int min, int max): max EXCLUSIVE. */
const rangeInt = (random, min, max) => min + Math.floor(random() * (max - min));
/** UnityEngine.Random.Range(float, float): inclusive both ends. */
const rangeFloat = (random, min, max) => min + random() * (max - min);
/** CoinFlip (Object.cs:531-537): Range(0, 2) == 0 -> false. */
export const coinFlip = (random) => rangeInt(random, 0, 1 + 1) !== 0;

/** RollRandomFootstepAudioClip / RollRandomArmorSwayAudioClip (Object.cs
 *  :541-585): a roll, and a repeat of the last clip steps one index over
 *  - up from the first, down from the last, a coin flip between. Returns
 *  the clip; the caller records it as `last`. */
export function rollRandomAudioClip(clips, last, random) {
  let randChoice = rangeInt(random, 0, clips.length);
  let clip = clips[randChoice];
  if (clip === last) {
    if (randChoice === 0) randChoice++;
    else if (randChoice === clips.length - 1) randChoice--;
    else randChoice = coinFlip(random) ? randChoice + 1 : randChoice - 1;
    clip = clips[randChoice];
  }
  return clip;
}

// --- Fetching the clips ---------------------------------------------------

/** The browser road: the Vite-served URL, fetched to bytes. Tests hand
 *  their own. */
async function defaultFetchClip(name) {
  const url = clipUrl(name);
  if (!url) return null;
  const res = await fetch(url);
  if (!res.ok) return null;
  return new Uint8Array(await res.arrayBuffer());
}

/** The material value ladder the mod reads at four sites (CheckToUse
 *  ArmorFootsteps, CheckToUseHardFallSounds, UpdateInteriorArmorFootstep
 *  Sounds, UpdateSwayMaterialWeights): NativeMaterialValue >= Iron is
 *  plate, >= Chain is chain, else leather. `item.material` IS DFU's
 *  nativeMaterialValue (armorMaterials.js). */
const nativeMaterialValue = (item) => (item ? (item.material ?? ARMOR_MATERIAL.Leather) : -1);   // GetMaterialValueOrDefault (Main.cs:605-608)

/**
 * The two MonoBehaviours as one component.
 *
 *   update(dt, m) - the host's frame; m is the motor and the place:
 *     { paused, grounded, standingStill, isRunning, movingLessThanHalfSpeed,
 *       transportMode, swimming (PlayerEnterExit.IsPlayerSwimming), pos [x,y,z],
 *       inside, inDungeon, centreY, waterSurfaceY (null = blockWaterLevel 10000),
 *       season, climateIndex, tileMapIndex, waterWalking, entity }
 *   onTransitionInterior({ buildingType, materials }) - PlayerEnterExit.OnTransitionInterior
 *   onTransitionExterior() - OnTransitionExterior AND OnTransitionDungeonExterior
 *   onTransitionDungeonInterior() - OnTransitionDungeonInterior
 *   onInventoryClose(entity) - UIManager.OnWindowChange's inventory arm
 *   applyPlayerFallDamage() / hardFallAlert() / playLargeSplash() - the three
 *     PlayerFootsteps sounds the mod takes over; each answers whether it played
 *   fallSoundSink(fallback) - applyFallLanding's `sound` callback, routed
 *   ownsStride() - DisableVanillaFootsteps has run (enabled and the audio loaded)
 */
export function createImmersiveFootsteps({ audio = defaultAudio, settings = readFootstepSettings, random = Math.random, fetchClip = defaultFetchClip } = {}) {
  // --- ImmersiveFootstepsMain statics ---
  let s = null;                       // the settings snapshot LoadSettings last applied
  let stepInterval = 0.6;             // Main.cs:56-59
  let plateSwayInterval = 0.6, chainSwayInterval = 0.6, leatherSwayInterval = 0.6;
  let plateWornSwayWeight = 0, chainWornSwayWeight = 0, leatherWornSwayWeight = 0;
  let lastFootstepPlayed = null, lastSwaySoundPlayed = null;
  let currInteriorFloorType = FLOOR_TYPE.Tile;
  const worn = { helmet: null, rightArm: null, leftArm: null, chestArmor: null, gloves: null, legArmor: null, boots: null };
  let clips = null;                   // the loaded quality's clipTable
  let loadedQuality = -1, loadingQuality = -1, loading = null, loadGen = 0;
  const registered = new Set();
  // --- ImmersiveFootstepsObject fields ---
  let lastPosition = null;            // Start seeds it from the player (Object.cs:60)
  let distance = 0;
  let footstepTimer = 0, plateSwayTimer = 0, chainSwayTimer = 0, leatherSwayTimer = 0;
  let refreshSlotsTimer = 0;
  const altStep = false;              // [verbatim] declared, never set true - every Alt table is dead (Object.cs:26)
  let volumeScale = 1;
  let currentClimateFootsteps = null; // = PathFootstepsMain once the clips are in (Object.cs:35)
  let lastSeason = SEASON.Summer, lastClimateIndex = CLIMATES.Ocean, lastTileMapIndex = 0;
  let isInside = false;
  // --- the port's own ---
  let acc = 0;                        // the fixed-step accumulator
  let lastM = null;                   // the last frame's place, for the out-of-band handlers
  let pendingExterior = false;        // an exterior determine owed before the next frame's step
  const played = [];                  // the last few plays, for the status line and the pins

  const table = (name) => (clips ? clips[name] : null);
  const cur = (main) => (altStep ? table(`${main}Alt`) : table(`${main}Main`));
  const play = (clip, volume) => {
    if (!clip) return false;
    played.push({ clip, volume });
    if (played.length > 8) played.shift();
    audio.playOneShot(soundKey(clip), volume);
    return true;
  };

  /** LoadAudio (Main.cs:620-889): every clip of the chosen quality, and a
   *  miss throws "Missing sound asset" - here a rejected load leaves the
   *  previous table in place (or none, so the classic stride keeps
   *  playing). Registers by name, once per key. */
  async function loadAudio(quality) {
    const gen = ++loadGen;
    const names = clipNames(quality);
    // AUDIT-IF F3: every clip in flight at once (the first draft awaited them one by one - 105 round trips
    // in series before the mod owned the stride); each failure is its own, the AND across them is LoadAudio's
    const results = await Promise.all(names.map(async (name) => {
      if (registered.has(name)) return true;
      let ok = false;
      try {
        const bytes = await fetchClip(name);
        ok = !!bytes && await audio.registerSound(soundKey(name), bytes);
      } catch { ok = false; }
      if (ok) registered.add(name);
      return ok;
    }));
    const success = results.every(Boolean);
    if (gen !== loadGen) return false;   // a later load superseded this one
    if (!success) {
      console.warn('[Warning] ImmersiveFootsteps: Missing sound asset');
      return false;
    }
    const wasSet = currentClimateFootsteps ? Object.entries(clips).find(([, v]) => v === currentClimateFootsteps)?.[0] : null;
    clips = clipTable(quality);
    loadedQuality = quality;
    currentClimateFootsteps = (wasSet && clips[wasSet]) || clips.PathFootstepsMain;
    return true;
  }

  /** LoadSettings (Main.cs:183-214), run when the snapshot changes - the
   *  mod's ModSettingsChange. The intervals are overwritten HERE, which is
   *  why it must not run every frame: the leather interval's random re-roll
   *  after each sway would never survive a frame. */
  function loadSettings(next) {
    s = next;
    stepInterval = s.FootstepFrequency;
    plateSwayInterval = s.ArmorSwayFrequency;
    chainSwayInterval = s.ArmorSwayFrequency;
    leatherSwayInterval = s.ArmorSwayFrequency;
    // Start's LoadAudio, and change.HasChanged("AudioQualitySettings", "SoundClipQuality")'s reload
    if (s.Enabled && loadedQuality !== s.SoundClipQuality && !(loading && loadingQuality === s.SoundClipQuality)) {
      loadingQuality = s.SoundClipQuality;
      loading = loadAudio(s.SoundClipQuality).finally(() => { loading = null; loadingQuality = -1; });
    }
  }
  const settle = () => { const p = loading; return p ? p.then(() => undefined) : Promise.resolve(); };
  /** The Mods pane is the mod's settings window: a change lands at once (ModSettingsChange), whichever entry point reads next. */
  const syncSettings = () => { const next = settings(); if (!sameSettings(s, next)) loadSettings(next); };

  /** UpdateInteriorArmorFootstepSounds (Main.cs:494-540). */
  function updateInteriorArmorFootstepSounds() {
    if (!clips) return;
    const boots = worn.boots;
    const mat = nativeMaterialValue(boots);
    if (currInteriorFloorType === FLOOR_TYPE.Wood) {
      if (boots) {
        if (mat >= ARMOR_MATERIAL.Iron) currentClimateFootsteps = cur('PlateFootsteps');
        else if (mat >= ARMOR_MATERIAL.Chain) currentClimateFootsteps = cur('ChainmailFootsteps');
        else currentClimateFootsteps = cur('WoodFootsteps');
      } else currentClimateFootsteps = cur('WoodFootsteps');
    } else if (currInteriorFloorType === FLOOR_TYPE.Stone) {
      if (boots) {
        if (mat >= ARMOR_MATERIAL.Iron) currentClimateFootsteps = cur('PlateFootsteps');
        else if (mat >= ARMOR_MATERIAL.Chain) currentClimateFootsteps = cur('ChainmailFootsteps');
        else currentClimateFootsteps = cur('PathFootsteps');
      } else currentClimateFootsteps = cur('UnarmoredFootsteps');
    } else {
      if (boots) {
        if (mat >= ARMOR_MATERIAL.Iron) currentClimateFootsteps = cur('PlateFootsteps');
        else if (mat >= ARMOR_MATERIAL.Chain) currentClimateFootsteps = cur('ChainmailFootsteps');
        else currentClimateFootsteps = cur('TileFootsteps');
      } else currentClimateFootsteps = cur('UnarmoredFootsteps');
    }
  }

  /** UpdateSwayMaterialWeights (Main.cs:571-603). */
  function updateSwayMaterialWeights() {
    plateWornSwayWeight = 0; chainWornSwayWeight = 0; leatherWornSwayWeight = 0;
    const materialValues = [worn.helmet, worn.rightArm, worn.leftArm, worn.chestArmor, worn.gloves, worn.legArmor].map(nativeMaterialValue);
    for (let i = 0; i < materialValues.length; i++) {
      if (materialValues[i] <= -1) continue;
      const weight = SWAY_WEIGHTS[i];
      if (materialValues[i] >= ARMOR_MATERIAL.Iron) plateWornSwayWeight += weight;
      else if (materialValues[i] >= ARMOR_MATERIAL.Chain) chainWornSwayWeight += weight;
      else leatherWornSwayWeight += weight;
    }
  }

  /** The exterior determine the out-of-band handlers owe: DFU reads
   *  PlayerGPS / StreamingWorld live inside the handler; the port's live
   *  place is the last frame's m when that frame was outdoors, else the
   *  next outdoor frame's. */
  function determineExteriorNow() {
    if (lastM && !lastM.inside) determineExteriorClimateFootstep(lastM);
    else pendingExterior = true;
  }

  /** RefreshEquipmentSlotReferences (Main.cs:542-569). */
  function refreshEquipmentSlotReferences(entity) {
    if (!entity) return;
    let slots;
    try { slots = equipTableOf(entity); } catch { return; }
    if (!slots) return;
    worn.helmet = slots[EQUIP_SLOTS.Head] ?? null;
    worn.rightArm = slots[EQUIP_SLOTS.RightArm] ?? null;
    worn.leftArm = slots[EQUIP_SLOTS.LeftArm] ?? null;
    worn.chestArmor = slots[EQUIP_SLOTS.ChestArmor] ?? null;
    worn.gloves = slots[EQUIP_SLOTS.Gloves] ?? null;
    worn.legArmor = slots[EQUIP_SLOTS.LegsArmor] ?? null;
    worn.boots = slots[EQUIP_SLOTS.Feet] ?? null;
    updateSwayMaterialWeights();
    if (lastM?.inside) updateInteriorArmorFootstepSounds();
    else {
      currInteriorFloorType = FLOOR_TYPE.Tile;
      lastTileMapIndex = 0;
      determineExteriorNow();
    }
  }

  /** CheckToUseArmorFootsteps (Object.cs:522-545). */
  function checkToUseArmorFootsteps() {
    const boots = worn.boots;
    if (boots) {
      const mat = nativeMaterialValue(boots);
      if (mat >= ARMOR_MATERIAL.Iron) currentClimateFootsteps = cur('PlateFootsteps');
      else if (mat >= ARMOR_MATERIAL.Chain) currentClimateFootsteps = cur('ChainmailFootsteps');
      else currentClimateFootsteps = cur('LeatherFootsteps');
    } else currentClimateFootsteps = cur('UnarmoredFootsteps');
  }

  /** CheckToUseHardFallSounds (Object.cs:547-569): [1] for damage, [0] for the alert. */
  function checkToUseHardFallSounds(fallDamage) {
    const boots = worn.boots;
    const i = fallDamage ? 1 : 0;
    if (boots) {
      const mat = nativeMaterialValue(boots);
      if (mat >= ARMOR_MATERIAL.Iron) return table('PlateHardLanding')?.[i];
      if (mat >= ARMOR_MATERIAL.Chain) return table('ChainmailHardLanding')?.[i];
      return table('LeatherHardLanding')?.[i];
    }
    return table('UnarmoredHardLanding')?.[i];
  }

  /** DetermineInteriorClimateFootstep (Object.cs:196-218): only a dungeon
   *  with a water level speaks; a building keeps what the transition and
   *  the equipment refresh chose. */
  function determineInteriorClimateFootstep(m) {
    if (m.inDungeon && m.waterSurfaceY != null) {
      if (m.swimming) currentClimateFootsteps = cur('DeepWaterFootsteps');
      else if (!m.swimming && (m.centreY - 0.57) < m.waterSurfaceY) currentClimateFootsteps = cur('ShallowWaterFootsteps');
      else checkToUseArmorFootsteps();
    }
  }

  /** DetermineExteriorClimateFootstep (Object.cs:220-299). */
  function determineExteriorClimateFootstep(m) {
    const currentSeason = m.season ?? SEASON.Summer;
    const currentClimateIndex = m.climateIndex ?? CLIMATES.Ocean;
    const currentTileMapIndex = m.tileMapIndex ?? 0;
    if (lastTileMapIndex !== currentTileMapIndex || lastClimateIndex !== currentClimateIndex || lastSeason !== currentSeason) {
      lastSeason = currentSeason;
      lastClimateIndex = currentClimateIndex;
      lastTileMapIndex = currentTileMapIndex;
      if (currentTileMapIndex === 0) {
        // [verbatim] "Minor bug here, if you are water-walking over water tiles ... but water walking wears off, the 'shallow water' sound will still play"
        if (m.waterWalking) currentClimateFootsteps = cur('ShallowWaterFootsteps');
        else currentClimateFootsteps = cur('DeepWaterFootsteps');
      } else if (checkClimateTileTables('Shallow_Water', currentTileMapIndex)) currentClimateFootsteps = cur('ShallowWaterFootsteps');
      else if (checkClimateTileTables('Path', currentTileMapIndex)) checkToUseArmorFootsteps();
      else if (currentSeason === SEASON.Winter && isSnowyClimate(currentClimateIndex)) {
        if (currentClimateIndex === CLIMATES.Swamp && checkClimateTileTables('Swamp_Snow_Alt', currentTileMapIndex)) currentClimateFootsteps = cur('MudFootsteps');
        else currentClimateFootsteps = cur('SnowFootsteps');
      } else if (isGrassyClimate(currentClimateIndex)) {
        if (checkClimateTileTables('Temperate_Dirt', currentTileMapIndex)) currentClimateFootsteps = cur('GravelFootsteps');
        else if (checkClimateTileTables('Temperate_Stone', currentTileMapIndex)) checkToUseArmorFootsteps();
        else currentClimateFootsteps = cur('GrassFootsteps');
      } else if (isRockyClimate(currentClimateIndex)) {
        if (checkClimateTileTables('Mountain_Dirt', currentTileMapIndex)) currentClimateFootsteps = cur('GravelFootsteps');
        else if (checkClimateTileTables('Mountain_Stone', currentTileMapIndex)) checkToUseArmorFootsteps();
        else currentClimateFootsteps = cur('GrassFootsteps');
      } else if (isSandyClimate(currentClimateIndex)) {
        if (checkClimateTileTables('Desert_Gravel', currentTileMapIndex)) currentClimateFootsteps = cur('GravelFootsteps');
        else if (checkClimateTileTables('Desert_Stone', currentTileMapIndex)) checkToUseArmorFootsteps();
        else currentClimateFootsteps = cur('SandFootsteps');
      } else if (isSwampyClimate(currentClimateIndex)) {
        if (checkClimateTileTables('Swamp_Bog', currentTileMapIndex)) currentClimateFootsteps = cur('MudFootsteps');
        else if (checkClimateTileTables('Swamp_Grass', currentTileMapIndex)) currentClimateFootsteps = cur('GrassFootsteps');
        else currentClimateFootsteps = cur('MudFootsteps');
      }
      // an Ocean-class climate off every ladder leaves the set as it was
    }
    if (!currentClimateFootsteps || currentClimateFootsteps.length <= 0) currentClimateFootsteps = cur('PathFootsteps');
  }

  const rollFootstep = (set) => { const c = rollRandomAudioClip(set, lastFootstepPlayed, random); lastFootstepPlayed = c; return c; };
  const rollSway = (set) => { const c = rollRandomAudioClip(set, lastSwaySoundPlayed, random); lastSwaySoundPlayed = c; return c; };
  const swayReroll = () => rangeFloat(random, s.ArmorSwayFrequency + 0.1, s.ArmorSwayFrequency + 0.4) - (leatherWornSwayWeight * 0.02);

  /** FixedUpdate (Object.cs:63-194), one 0.02 s tick. */
  function fixedUpdate(m) {
    if (m.paused) return;   // GameManager.IsGamePaused || LoadInProgress
    // TravelOptionsCheck: Travel Options is not a vendored mod here, so the SendModMessage arm is the "not installed" arm (false)
    let playerSwimming = false;
    refreshSlotsTimer++;
    if (refreshSlotsTimer >= REFRESH_SLOTS_TICKS) {
      refreshSlotsTimer = 0;
      if (s.AllowFootstepSounds || s.AllowArmorSwaySounds) refreshEquipmentSlotReferences(m.entity);
    }
    playerSwimming = !!m.swimming;
    if (!m.grounded && !playerSwimming) return;
    if (m.standingStill) return;
    if (m.isRunning) {
      footstepTimer += 1.5 * FIXED_DELTA_TIME;
      plateSwayTimer += 1.8 * FIXED_DELTA_TIME; chainSwayTimer += 1.8 * FIXED_DELTA_TIME; leatherSwayTimer += 1.8 * FIXED_DELTA_TIME;
      volumeScale = 1.25;
    } else if (m.movingLessThanHalfSpeed) {
      footstepTimer += 0.7 * FIXED_DELTA_TIME;
      plateSwayTimer += 0.5 * FIXED_DELTA_TIME; chainSwayTimer += 0.5 * FIXED_DELTA_TIME; leatherSwayTimer += 0.5 * FIXED_DELTA_TIME;
      volumeScale = 0.6;
    } else {
      footstepTimer += FIXED_DELTA_TIME;
      plateSwayTimer += FIXED_DELTA_TIME; chainSwayTimer += FIXED_DELTA_TIME; leatherSwayTimer += FIXED_DELTA_TIME;
      volumeScale = 1;
    }
    if (m.transportMode === TRANSPORT_MODES.Horse || m.transportMode === TRANSPORT_MODES.Cart) footstepTimer = 0;
    if (!s.AllowFootstepSounds) footstepTimer = 0;
    if (!s.AllowArmorSwaySounds) { plateSwayTimer = 0; chainSwayTimer = 0; leatherSwayTimer = 0; }
    // [verbatim] the ship's deck keeps the mod's own noted bug: no IsOnShip read
    if (playerSwimming) {
      // GetHorizontalPosition (Object.cs:526-529) - despite the name, all three axes
      const position = [m.pos[0], m.pos[1], m.pos[2]];
      distance += Math.hypot(position[0] - lastPosition[0], position[1] - lastPosition[1], position[2] - lastPosition[2]);
      lastPosition = position;
      if (distance > SWIM_INTERVAL) {
        isInside = !!m.inside;
        if (isInside) determineInteriorClimateFootstep(m); else determineExteriorClimateFootstep(m);
        play(rollFootstep(currentClimateFootsteps), volumeScale * s.FootstepVolumeMulti);   // NOT gated on AllowFootstepSounds [verbatim]
        distance = 0;
      }
      footstepTimer = 0; plateSwayTimer = 0; chainSwayTimer = 0; leatherSwayTimer = 0;
    }
    if (footstepTimer >= stepInterval) {
      isInside = !!m.inside;
      if (isInside) determineInteriorClimateFootstep(m); else determineExteriorClimateFootstep(m);
      if (s.AllowFootstepSounds) play(rollFootstep(currentClimateFootsteps), volumeScale * s.FootstepVolumeMulti);
      footstepTimer = 0;
    }
    if (leatherWornSwayWeight <= 0) leatherSwayTimer = 0;
    if (chainWornSwayWeight <= 0) chainSwayTimer = 0;
    if (plateWornSwayWeight <= 0) plateSwayTimer = 0;
    if (leatherSwayTimer >= leatherSwayInterval) {
      if (s.AllowArmorSwaySounds) play(rollSway(table('LeatherSwaying')), volumeScale * s.ArmorSwayVolumeMulti);
      leatherSwayTimer = 0;
      leatherSwayInterval = swayReroll();
    }
    if (chainSwayTimer >= chainSwayInterval) {
      if (s.AllowArmorSwaySounds) play(rollSway(table('ChainmailSwaying')), volumeScale * s.ArmorSwayVolumeMulti);
      chainSwayTimer = 0;
      leatherSwayInterval = swayReroll();   // [verbatim] Object.cs:184 re-rolls the LEATHER interval, not the chain one
    }
    if (plateSwayTimer >= plateSwayInterval) {
      if (s.AllowArmorSwaySounds) play(rollSway(table('PlateSwaying')), volumeScale * s.ArmorSwayVolumeMulti);
      plateSwayTimer = 0;
      leatherSwayInterval = swayReroll();   // [verbatim] Object.cs:191 - the same slip
    }
  }

  const active = () => !!(s?.Enabled && clips);

  const api = {
    /** The host's frame. Reads the switches, runs the fixed step. */
    update(dt, m) {
      syncSettings();
      if (!s.Enabled) { acc = 0; return; }
      lastM = m;
      if (!clips) return;              // LoadAudio has not finished: the classic stride is still playing
      if (lastPosition === null) lastPosition = [m.pos[0], m.pos[1], m.pos[2]];   // Start's seed
      if (pendingExterior && !m.inside) { pendingExterior = false; determineExteriorClimateFootstep(m); }
      acc += Math.max(0, Number(dt) || 0);
      // the ticks due, counted in integers (0.1 / 0.02 is 4.999... in floats); the hosts cap dt at 0.1 = 5 ticks,
      // and a longer stall is bounded the way Unity's maximumDeltaTime bounds a catch-up: the residue is dropped
      let ticks = Math.floor(acc / FIXED_DELTA_TIME + 1e-9);
      if (ticks > MAX_TICKS_PER_FRAME) { ticks = MAX_TICKS_PER_FRAME; acc = 0; } else acc -= ticks * FIXED_DELTA_TIME;
      if (acc < 1e-9) acc = 0;
      for (let i = 0; i < ticks; i++) fixedUpdate(m);
    },
    /** UpdateFootsteps_OnTransitionInterior (Main.cs:237-308). `materials`
     *  are the combined mesh's material names in order (unityMaterialName). */
    onTransitionInterior({ buildingType = null, materials = [] } = {}) {
      lastM = lastM ? { ...lastM, inside: true, inDungeon: false } : { inside: true, inDungeon: false };
      // AUDIT-IF F4: only BuildingTypes.None (-1) skips the walk. A building with no discovery record hands DFU
      // default(DiscoveredBuilding), whose buildingType is 0 - the walk runs; the first draft skipped it on null.
      currInteriorFloorType = buildingType === -1 ? FLOOR_TYPE.Tile : interiorFloorType(materials);
      updateInteriorArmorFootstepSounds();
    },
    /** UpdateFootsteps_OnTransitionExterior (Main.cs:339-354), for the building and the dungeon exit alike. */
    onTransitionExterior() {
      lastM = lastM ? { ...lastM, inside: false, inDungeon: false } : null;
      currInteriorFloorType = FLOOR_TYPE.Tile;
      lastTileMapIndex = 0;
      pendingExterior = true;   // DetermineExteriorClimateFootstep, on the first outdoor frame
    },
    /** UpdateFootsteps_OnTransitionDungeonInterior (Main.cs:356-370). */
    onTransitionDungeonInterior() {
      lastM = lastM ? { ...lastM, inside: true, inDungeon: true } : { inside: true, inDungeon: true };
      currInteriorFloorType = FLOOR_TYPE.Tile;
      updateInteriorArmorFootstepSounds();
    },
    /** UIManager_RefreshEquipSlotReferencesOnInventoryClose (Main.cs:372-398):
     *  the inventory window popped to no window. */
    onInventoryClose(entity) {
      syncSettings();
      if (!active()) return;
      if (s.AllowFootstepSounds || s.AllowArmorSwaySounds) refreshEquipmentSlotReferences(entity);
    },
    refreshEquipmentSlotReferences(entity) { syncSettings(); if (active()) refreshEquipmentSlotReferences(entity); },
    /** The three PlayerFootsteps messages the mod captures (Object.cs:498-520). Each answers whether it played. */
    applyPlayerFallDamage() { syncSettings(); return active() && play(checkToUseHardFallSounds(true), LANDING_VOLUME_SCALE * s.FootstepVolumeMulti); },
    hardFallAlert() { syncSettings(); return active() && play(checkToUseHardFallSounds(false), LANDING_VOLUME_SCALE * s.FootstepVolumeMulti); },
    playLargeSplash() { syncSettings(); return active() && play(table('WaterLandingSound')?.[0], LANDING_VOLUME_SCALE * s.FootstepVolumeMulti); },
    /** applyFallLanding's `sound` callback: the mod's landing when it owns
     *  the stride, the host's classic play otherwise. */
    fallSoundSink(fallback) {
      return (id, vol) => {
        if (id === SOUND.FallDamage && api.applyPlayerFallDamage()) return;
        if (id === SOUND.FallHard && api.hardFallAlert()) return;
        fallback?.(id, vol);
      };
    },
    /** DisableVanillaFootsteps has run: the mod is on and its clips are in. */
    ownsStride: active,
    settle,
    /** For the pins and the status line. */
    status() {
      return {
        enabled: !!s?.Enabled, loaded: !!clips, quality: loadedQuality,
        currentSet: currentClimateFootsteps ? Object.entries(clips ?? {}).find(([, v]) => v === currentClimateFootsteps)?.[0] ?? null : null,
        floorType: currInteriorFloorType,
        weights: { plate: plateWornSwayWeight, chain: chainWornSwayWeight, leather: leatherWornSwayWeight },
        intervals: { step: stepInterval, plate: plateSwayInterval, chain: chainSwayInterval, leather: leatherSwayInterval },
        timers: { footstep: footstepTimer, plate: plateSwayTimer, chain: chainSwayTimer, leather: leatherSwayTimer, refresh: refreshSlotsTimer },
        distance, lastTileMapIndex, lastClimateIndex, lastSeason, volumeScale,
        worn: { ...worn },
        lastFootstepPlayed, lastSwaySoundPlayed,
        played: played.slice(),
      };
    },
  };
  return api;
}

/** The one component - the mod adds ONE ImmersiveFootstepsObject to the
 *  player, and every host drives the same instance (HT1's shape). */
export const immersiveFootsteps = createImmersiveFootsteps();
