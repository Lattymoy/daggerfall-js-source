// MENU: the PLAYER-FACING taxonomy over the settings store.
//
// The store's 13 ini sections are STORAGE categories - where DFU
// writes a value, not how a person looks for it. Two of the three
// settings a casual player most wants (Sound Volume, Music Volume)
// live in the ini's [Controls] section; Field Of View lives in
// [Video] beside twenty-four keys about shadow map resolution. So the
// screen needs its own taxonomy, and this file is it.
//
// It is close to DFU's own UI grouping (DaggerfallAdvancedSettingsWindow
// .cs:234-238 pages gamePlay/interface/enhancements/video/accessibility)
// with two deliberate departures:
//   - AUDIO IS ITS OWN CATEGORY. DFU buries it as a section on the
//     gamePlay page (:264). Volume is the single most-reached-for
//     setting in any game; it gets a door of its own.
//   - MODS IS ITS OWN CATEGORY rather than a section under
//     enhancements (:327), so the mod manager has a home to grow into
//     instead of a corner to be added to later.
//
// THE MAP IS TOTAL AND DISJOINT: every one of the 171 keys appears in
// exactly one category, and test/settingsUI.test.js pins that both
// ways. A DFU re-bake that adds or renames a key fails the build
// rather than quietly dropping a row off the screen.

export const CATEGORIES = Object.freeze([
  // SO1 (2026-09-11) put THE PORT'S OWN switches here as an Enhanced
  // category; FT2-FT8 moved every one of them to the FEATURES home
  // (systems/features.js) and FT12 (Mac, 2026-09-14) took the emptied
  // category off the rail. The map below is total over DFU's 171 keys
  // and nothing else; the port's own rows are the home's.
  { id: "game", title: "Game", blurb: "How the world plays: fighting, dungeons, repairs and the rules you start out with." },
  { id: "controls", title: "Controls", blurb: "Looking, moving and swinging, whether you play with a mouse, a keyboard or a touchscreen." },
  { id: "audio", title: "Audio", blurb: "Music, sound effects and the noises people make in a fight." },
  { id: "video", title: "Video", blurb: "How the game looks, how bright it is, and how hard your machine has to work." },
  { id: "interface", title: "Interface", blurb: "Everything drawn on top of the world: bars, icons, tooltips, prompts and maps." },
  { id: "accessibility", title: "Accessibility", blurb: "Comfort and readability, for anyone bothered by motion, flashing or small text." },
  { id: "mods", title: "Data & Mods", blurb: "Where the game's files live and DFU's mod switches. The packs you can attach are on the Features page." },
]);

export const CATEGORY_IDS = Object.freeze(CATEGORIES.map((c) => c.id));

/** category id -> the store keys under it, IN SCREEN ORDER. */
export const CATEGORY_KEYS = Object.freeze({
  "game": [
    "Enhancements/LoiterLimitInHours",
    "Enhancements/PlayerTorchFromItems",
    "Startup/StartInDungeon",
    "Experimental/SmallerDungeons",
    "Video/RandomDungeonTextures",
    "MeleeAttacks/MeleeAttackDetection",
    "MeleeAttacks/MeleeAttackFriendlyProtection",
    "Enhancements/EnemyInfighting",
    "Enhancements/AlternateRandomEnemySelection",
    "Controls/InstantRepairs",
    "Controls/AllowMagicRepairs",
    "Enhancements/GuildQuestListBox",
    "ChildGuard/PlayerNudity",
    "Enhancements/LypyL_GameConsole",
    "GUI/CanDropQuestItems",
    "GUI/EnableQuestDebugger",
    "GUI/QuestRumorWeight",
    "Startup/StartCellX",
    "Startup/StartCellY",
    "Enhancements/EnhancedCombatAI",
    "Enhancements/AdvancedClimbing",
  ],
  "controls": [
    "Controls/MouseLookSensitivity",
    "Controls/InvertMouseVertical",
    "Controls/MouseLookSmoothingFactor",
    "Controls/WeaponSwingMode",
    "Controls/WeaponSensitivity",
    "Controls/WeaponAttackThreshold",
    "Controls/BowDrawback",
    "Controls/ToggleSneak",
    "Controls/MovementAcceleration",
    "Controls/Handedness",
    "Enhancements/BowLeftHandWithSwitching",
    "Controls/EnableController",
    "Controls/JoystickLookSensitivity",
    "Controls/JoystickCursorSensitivity",
    "Controls/JoystickMovementThreshold",
    "Controls/JoystickDeadzone",
  ],
  "audio": [
    "Controls/SoundVolume",
    "Controls/MusicVolume",
    "Enhancements/CombatVoices",
    "Audio/AlternateMusic",
    "Audio/SoundFont",
  ],
  "video": [
    "Video/Fullscreen",
    "Video/FieldOfView",
    "Video/QualityLevel",
    "Video/MainFilterMode",
    "GUI/GUIFilterMode",
    "GUI/VideoFilterMode",
    "Video/VSync",
    "Video/TargetFrameRate",
    "Video/RunInBackground",
    "Enhancements/DungeonAmbientLightScale",
    "Enhancements/NightAmbientLightScale",
    "Enhancements/PlayerTorchLightScale",
    "Spells/EnableSpellLighting",
    "Spells/EnableSpellShadows",
    "Video/DungeonLightShadows",
    "Video/InteriorLightShadows",
    "Video/ExteriorLightShadows",
    "Video/AmbientLitInteriors",
    "Video/MobileNPCShadows",
    "Video/GeneralBillboardShadows",
    "Video/NatureBillboardShadows",
    "Video/DungeonShadowDistance",
    "Video/InteriorShadowDistance",
    "Video/ExteriorShadowDistance",
    "Video/ShadowResolutionMode",
    "Video/RetroRenderingMode",
    "Video/PostProcessingInRetroMode",
    "Video/UseMipMapsInRetroMode",
    "Video/RetroModeAspectCorrection",
    "Video/PalettizationLUTShift",
    "Video/EnableTextureArrays",
    "Video/ResolutionWidth",
    "Video/ResolutionHeight",
    "Video/ExclusiveFullscreen",
    "GUI/AccelerateUICopyTexture",
    "Experimental/TerrainDistance",
    "Experimental/TerrainHeightmapPixelError",
    "Experimental/AssetCacheThreshold",
    "Effects/AntialiasingMethod",
    "Effects/AntialiasingFXAAFastMode",
    "Effects/AntialiasingSMAAQuality",
    "Effects/AntialiasingTAASharpness",
    "Effects/AmbientOcclusionEnable",
    "Effects/AmbientOcclusionMethod",
    "Effects/AmbientOcclusionIntensity",
    "Effects/AmbientOcclusionThickness",
    "Effects/AmbientOcclusionRadius",
    "Effects/AmbientOcclusionQuality",
    "Effects/BloomEnable",
    "Effects/BloomIntensity",
    "Effects/BloomThreshold",
    "Effects/BloomDiffusion",
    "Effects/BloomFastMode",
    "Effects/DepthOfFieldEnable",
    "Effects/DepthOfFieldFocusDistance",
    "Effects/DepthOfFieldAperture",
    "Effects/DepthOfFieldFocalLength",
    "Effects/DepthOfFieldMaxBlurSize",
    "Effects/DitherEnable",
    "Effects/ColorBoostEnable",
    "Effects/ColorBoostRadius",
    "Effects/ColorBoostIntensity",
    "Effects/ColorBoostDungeonScale",
    "Effects/ColorBoostExteriorScale",
    "Effects/ColorBoostInteriorScale",
    "Effects/ColorBoostDungeonFalloff",
  ],
  "interface": [
    "GUI/ShowOptionsAtStart",
    "GUI/Crosshair",
    "GUI/EnableToolTips",
    "GUI/ToolTipDelayInSeconds",
    "GUI/ToolTipTextColor",
    "GUI/ToolTipBackgroundColor",
    "GUI/EnableVitalsIndicators",
    "GUI/InteractionModeIcon",
    "GUI/EnableArrowCounter",
    "GUI/IconsPositioningScheme",
    "GUI/HelmAndShieldMaterialDisplay",
    "GUI/EnableInventoryInfoPanel",
    "GUI/EnableEnhancedItemLists",
    "GUI/EnableModernConversationStyleInTalkWindow",
    "GUI/ShowQuestJournalClocksAsCountdown",
    "GUI/DungeonExitWagonPrompt",
    "GUI/TravelMapLocationsOutline",
    "GUI/EnableGeographicBackgrounds",
    "GUI/ShopQualityPresentation",
    "GUI/ShopQualityHUDDelay",
    "GUI/IllegalRestWarning",
    "GUI/DisableEnemyDeathAlert",
    "GUI/HideLoginName",
    "Enhancements/NearDeathWarning",
    "Map/AutomapNumberOfDungeons",
    "Map/AutomapDisableMicroMap",
    "Map/AutomapRememberSliceLevel",
    "Map/AutomapAlwaysMaxOutSliceLevel",
    "Map/ExteriorMapDefaultZoomLevel",
    "Map/ExteriorMapResetZoomLevelOnNewLocation",
    "Map/AutomapTempleColor",
    "Map/AutomapShopColor",
    "Map/AutomapTavernColor",
    "Map/AutomapHouseColor",
    "Map/DungeonMicMapQoL",
    "Map/DunMicMapInnerColor",
    "Map/DunMicMapBorderColor",
  ],
  "accessibility": [
    "Controls/HeadBobbing",
    "Controls/CameraRecoilStrength",
    "Effects/MotionBlurEnable",
    "Effects/MotionBlurShutterAngle",
    "Effects/MotionBlurSampleCount",
    "Effects/VignetteEnable",
    "Effects/VignetteIntensity",
    "Effects/VignetteSmoothness",
    "Effects/VignetteRoundness",
    "Effects/VignetteRounded",
    "GUI/SwapHealthAndFatigueColors",
    "GUI/DimAlphaStrength",
    "GUI/SDFFontRendering",
    "GUI/LargeHUD",
    "GUI/LargeHUDDocked",
    "GUI/LargeHUDUndockedScale",
    "GUI/LargeHUDUndockedAlignment",
    "GUI/LargeHUDUndockedOffsetWeapon",
    "GUI/LargeHUDOffsetHorse",
  ],
  "mods": [
    "Enhancements/LypyL_ModSystem",
    "Enhancements/AssetInjection",
    "Enhancements/CompressModdedTextures",
    "Experimental/CustomBooksImport",
    "Daggerfall/MyDaggerfallPath",
    "Daggerfall/MyDaggerfallUnitySavePath",
    "Daggerfall/MyDaggerfallUnityScreenshotsPath",
  ],
});

const _of = new Map();
for (const [cat, ks] of Object.entries(CATEGORY_KEYS)) ks.forEach((k, i) => _of.set(k, { cat, order: i }));

/** The category a key belongs to, or null if the map has a hole
 *  (which the pin makes impossible). */
export const categoryOf = (key) => _of.get(key)?.cat ?? null;
/** A key's position within its category, for stable ordering. */
export const orderOf = (key) => _of.get(key)?.order ?? -1;
/** The keys of one category, in screen order. */
export const keysOf = (catId) => CATEGORY_KEYS[catId] ?? [];

/** ORG1 (2026-10-09, Mac: "reorganize settings and features to not be horrible to scroll through. Proper organization
 *  and detail"): EACH CATEGORY'S SECTIONS, in screen order - a title, a line saying what it holds, and its keys in the
 *  order they draw. Interface was forty rows in one run - a tooltip's colour between the crosshair and a shop's sign -
 *  and Video's live rows sat among fifty-one it folds away. The categories are the rail; the sections are what a
 *  category's page is cut into, each under its own head, with a strip at the top to jump between them.
 *
 *  TOTAL AND DISJOINT, like the map above: every key of a category stands in exactly one of its sections (a key the
 *  page does not draw flat - saved for later, not available, moved to Features - keeps its place for the day it does),
 *  and test/org1_sections.test.js pins both ways. The port's own rows (ui/enhancedMenu.js portRows) name their
 *  section by `port` id. */
export const CATEGORY_SECTIONS = Object.freeze({
  game: Object.freeze([
    Object.freeze({ id: 'quests', title: 'Quests', blurb: 'Fixing a stuck quest, quest items, and how often people talk about your quests.',
      keys: Object.freeze(['GUI/CanDropQuestItems', 'GUI/QuestRumorWeight', 'GUI/EnableQuestDebugger']) }),
    Object.freeze({ id: 'play', title: 'Play', blurb: 'Waiting, fighting beside townsfolk, repairs and what people wear.',
      keys: Object.freeze(['Enhancements/LoiterLimitInHours', 'MeleeAttacks/MeleeAttackDetection', 'MeleeAttacks/MeleeAttackFriendlyProtection',
        'Controls/InstantRepairs', 'Controls/AllowMagicRepairs', 'ChildGuard/PlayerNudity', 'Enhancements/PlayerTorchFromItems',
        'Experimental/SmallerDungeons', 'Video/RandomDungeonTextures', 'Enhancements/EnemyInfighting', 'Enhancements/AlternateRandomEnemySelection',
        'Enhancements/GuildQuestListBox', 'Enhancements/EnhancedCombatAI', 'Enhancements/AdvancedClimbing']) }),
    Object.freeze({ id: 'start', title: 'Starting a new game', blurb: 'Where a new character wakes up.',
      keys: Object.freeze(['Startup/StartInDungeon', 'Startup/StartCellX', 'Startup/StartCellY']) }),
    Object.freeze({ id: 'advanced', title: 'Advanced', blurb: 'For testing and tinkering.',
      keys: Object.freeze(['Enhancements/LypyL_GameConsole']) }),
  ]),
  controls: Object.freeze([
    Object.freeze({ id: 'look', title: 'Mouse & looking', blurb: 'How the camera follows the mouse.',
      keys: Object.freeze(['Controls/MouseLookSensitivity', 'Controls/InvertMouseVertical', 'Controls/MouseLookSmoothingFactor']) }),
    Object.freeze({ id: 'attack', title: 'Attacking', blurb: 'How a swing or a bow shot is made, and which hand holds what.',
      keys: Object.freeze(['Controls/WeaponSwingMode', 'Controls/WeaponSensitivity', 'Controls/WeaponAttackThreshold', 'Controls/BowDrawback',
        'Controls/Handedness', 'Enhancements/BowLeftHandWithSwitching']) }),
    Object.freeze({ id: 'move', title: 'Moving', blurb: 'Sneaking and how you start and stop.',
      keys: Object.freeze(['Controls/ToggleSneak', 'Controls/MovementAcceleration']) }),
    Object.freeze({ id: 'controller', title: 'Game controller', blurb: 'A gamepad’s sticks and its menu cursor.',
      keys: Object.freeze(['Controls/EnableController', 'Controls/JoystickLookSensitivity', 'Controls/JoystickCursorSensitivity',
        'Controls/JoystickMovementThreshold', 'Controls/JoystickDeadzone']) }),
    Object.freeze({ id: 'touch', title: 'Touchscreen', blurb: 'The stick, the buttons and aiming on a phone or tablet.', keys: Object.freeze([]) }),
  ]),
  audio: Object.freeze([
    Object.freeze({ id: 'audio', title: 'Audio', blurb: 'Volume and music.',
      keys: Object.freeze(['Controls/SoundVolume', 'Controls/MusicVolume', 'Enhancements/CombatVoices', 'Audio/AlternateMusic', 'Audio/SoundFont']) }),
  ]),
  video: Object.freeze([
    Object.freeze({ id: 'display', title: 'Display', blurb: 'Your view and how many frames you draw.',
      keys: Object.freeze(['Video/Fullscreen', 'Video/FieldOfView', 'Video/QualityLevel', 'Video/VSync', 'Video/TargetFrameRate', 'Video/RunInBackground',
        'Video/ResolutionWidth', 'Video/ResolutionHeight', 'Video/ExclusiveFullscreen']) }),
    Object.freeze({ id: 'brightness', title: 'Brightness & light', blurb: 'How dark dungeons and nights are, and the light you and your spells give off.',
      keys: Object.freeze(['Enhancements/DungeonAmbientLightScale', 'Enhancements/NightAmbientLightScale', 'Enhancements/PlayerTorchLightScale',
        'Spells/EnableSpellLighting', 'Spells/EnableSpellShadows', 'Video/AmbientLitInteriors']) }),
    Object.freeze({ id: 'retro', title: 'Retro look', blurb: 'A low-resolution, palette-true picture, like the 1996 game.',
      keys: Object.freeze(['Video/RetroRenderingMode', 'Video/PostProcessingInRetroMode', 'Video/UseMipMapsInRetroMode', 'Video/RetroModeAspectCorrection',
        'Video/PalettizationLUTShift']) }),
    Object.freeze({ id: 'shadows', title: 'Shadows', blurb: 'Daggerfall Unity’s shadow options.',
      keys: Object.freeze(['Video/DungeonLightShadows', 'Video/InteriorLightShadows', 'Video/ExteriorLightShadows', 'Video/MobileNPCShadows',
        'Video/GeneralBillboardShadows', 'Video/NatureBillboardShadows', 'Video/DungeonShadowDistance', 'Video/InteriorShadowDistance',
        'Video/ExteriorShadowDistance', 'Video/ShadowResolutionMode']) }),
    Object.freeze({ id: 'textures', title: 'Textures & detail', blurb: 'Texture filtering, terrain detail and caching.',
      keys: Object.freeze(['Video/MainFilterMode', 'GUI/GUIFilterMode', 'GUI/VideoFilterMode', 'Video/EnableTextureArrays', 'GUI/AccelerateUICopyTexture',
        'Experimental/TerrainDistance', 'Experimental/TerrainHeightmapPixelError', 'Experimental/AssetCacheThreshold']) }),
    Object.freeze({ id: 'effects', title: 'Post effects', blurb: 'Daggerfall Unity’s antialiasing, ambient occlusion, bloom, depth of field and colour boost.',
      keys: Object.freeze(['Effects/AntialiasingMethod', 'Effects/AntialiasingFXAAFastMode', 'Effects/AntialiasingSMAAQuality', 'Effects/AntialiasingTAASharpness',
        'Effects/AmbientOcclusionEnable', 'Effects/AmbientOcclusionMethod', 'Effects/AmbientOcclusionIntensity', 'Effects/AmbientOcclusionThickness',
        'Effects/AmbientOcclusionRadius', 'Effects/AmbientOcclusionQuality', 'Effects/BloomEnable', 'Effects/BloomIntensity', 'Effects/BloomThreshold',
        'Effects/BloomDiffusion', 'Effects/BloomFastMode', 'Effects/DepthOfFieldEnable', 'Effects/DepthOfFieldFocusDistance', 'Effects/DepthOfFieldAperture',
        'Effects/DepthOfFieldFocalLength', 'Effects/DepthOfFieldMaxBlurSize', 'Effects/DitherEnable', 'Effects/ColorBoostEnable', 'Effects/ColorBoostRadius',
        'Effects/ColorBoostIntensity', 'Effects/ColorBoostDungeonScale', 'Effects/ColorBoostExteriorScale', 'Effects/ColorBoostInteriorScale',
        'Effects/ColorBoostDungeonFalloff']) }),
  ]),
  interface: Object.freeze([
    Object.freeze({ id: 'hud', title: 'HUD', blurb: 'The bars, icons and crosshair over the world, their size and where they sit.',
      keys: Object.freeze(['GUI/Crosshair', 'GUI/EnableVitalsIndicators', 'GUI/InteractionModeIcon', 'GUI/EnableArrowCounter', 'GUI/IconsPositioningScheme',
        'Enhancements/NearDeathWarning']) }),
    Object.freeze({ id: 'tooltips', title: 'Tooltips', blurb: 'The names that appear when you point at something in a window.',
      keys: Object.freeze(['GUI/EnableToolTips', 'GUI/ToolTipDelayInSeconds', 'GUI/ToolTipTextColor', 'GUI/ToolTipBackgroundColor']) }),
    Object.freeze({ id: 'windows', title: 'Inventory, talk & shops', blurb: 'What the inventory, conversation and shop windows show you.',
      keys: Object.freeze(['GUI/HelmAndShieldMaterialDisplay', 'GUI/EnableInventoryInfoPanel', 'GUI/EnableEnhancedItemLists',
        'GUI/EnableModernConversationStyleInTalkWindow', 'GUI/ShopQualityPresentation', 'GUI/ShopQualityHUDDelay']) }),
    Object.freeze({ id: 'prompts', title: 'Messages & prompts', blurb: 'The questions and notices the game puts to you, and how it starts.',
      keys: Object.freeze(['GUI/ShowQuestJournalClocksAsCountdown', 'GUI/DungeonExitWagonPrompt', 'GUI/IllegalRestWarning', 'GUI/DisableEnemyDeathAlert',
        'GUI/HideLoginName', 'GUI/ShowOptionsAtStart']) }),
    Object.freeze({ id: 'travelmap', title: 'Travel map', blurb: 'The map of the Iliac Bay you travel from.',
      keys: Object.freeze(['GUI/TravelMapLocationsOutline', 'GUI/EnableGeographicBackgrounds']) }),
    Object.freeze({ id: 'townmap', title: 'Town map', blurb: 'The map of the town you stand in: its zoom and the colours of its buildings.',
      keys: Object.freeze(['Map/ExteriorMapDefaultZoomLevel', 'Map/ExteriorMapResetZoomLevelOnNewLocation', 'Map/AutomapTempleColor', 'Map/AutomapShopColor',
        'Map/AutomapTavernColor', 'Map/AutomapHouseColor']) }),
    Object.freeze({ id: 'dungeonmap', title: 'Dungeon map', blurb: 'The dungeon map and the small map in the corner.',
      keys: Object.freeze(['Map/AutomapNumberOfDungeons', 'Map/AutomapDisableMicroMap', 'Map/AutomapRememberSliceLevel', 'Map/AutomapAlwaysMaxOutSliceLevel',
        'Map/DungeonMicMapQoL', 'Map/DunMicMapInnerColor', 'Map/DunMicMapBorderColor']) }),
  ]),
  accessibility: Object.freeze([
    Object.freeze({ id: 'motion', title: 'Motion', blurb: 'Camera movement that can make some people queasy.',
      keys: Object.freeze(['Controls/HeadBobbing', 'Controls/CameraRecoilStrength', 'Effects/MotionBlurEnable', 'Effects/MotionBlurShutterAngle',
        'Effects/MotionBlurSampleCount', 'Effects/VignetteEnable', 'Effects/VignetteIntensity', 'Effects/VignetteSmoothness', 'Effects/VignetteRoundness',
        'Effects/VignetteRounded']) }),
    Object.freeze({ id: 'reading', title: 'Readability', blurb: 'Colours and text that are easier to read.',
      keys: Object.freeze(['GUI/SwapHealthAndFatigueColors', 'GUI/DimAlphaStrength', 'GUI/SDFFontRendering']) }),
    Object.freeze({ id: 'largehud', title: 'Large status bar', blurb: 'Daggerfall’s big status bar along the bottom of the screen, and where it sits.',
      keys: Object.freeze(['GUI/LargeHUD', 'GUI/LargeHUDDocked', 'GUI/LargeHUDUndockedScale', 'GUI/LargeHUDUndockedAlignment',
        'GUI/LargeHUDUndockedOffsetWeapon', 'GUI/LargeHUDOffsetHorse']) }),
  ]),
  mods: Object.freeze([
    Object.freeze({ id: 'mods', title: 'Data & Mods', blurb: 'Where the game’s files live and DFU’s mod switches.',
      keys: Object.freeze(['Enhancements/LypyL_ModSystem', 'Enhancements/AssetInjection', 'Enhancements/CompressModdedTextures',
        'Experimental/CustomBooksImport', 'Daggerfall/MyDaggerfallPath', 'Daggerfall/MyDaggerfallUnitySavePath',
        'Daggerfall/MyDaggerfallUnityScreenshotsPath']) }),
  ]),
});
/** ORG1: the section a category's key stands in, or null. */
export const sectionOfKey = (catId, key) => (CATEGORY_SECTIONS[catId] ?? []).find((s) => s.keys.includes(key)) ?? null;
