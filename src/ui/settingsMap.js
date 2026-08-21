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
  { id: "game", title: "Game", blurb: "How the world plays: fighting, dungeons, repairs and the rules you start out with." },
  { id: "controls", title: "Controls", blurb: "Looking, moving and swinging, whether you play with a mouse, a keyboard or a touchscreen." },
  { id: "audio", title: "Audio", blurb: "Music, sound effects and the noises people make in a fight." },
  { id: "video", title: "Video", blurb: "How the game looks, how bright it is, and how hard your machine has to work." },
  { id: "interface", title: "Interface", blurb: "Everything drawn on top of the world: bars, icons, tooltips, prompts and maps." },
  { id: "accessibility", title: "Accessibility", blurb: "Comfort and readability, for anyone bothered by motion, flashing or small text." },
  { id: "mods", title: "Mods", blurb: "Community-made add-ons. Nothing here does anything yet, and each switch says why." },
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
