// MENU: the PLAYER-FACING taxonomy over every option the game has.
//
// The store's 13 ini sections are STORAGE categories - where DFU
// writes a value, not how a person looks for it. Two of the three
// settings a casual player most wants (Sound Volume, Music Volume)
// live in the ini's [Controls] section; Field Of View lives in
// [Video] beside twenty-four keys about shadow map resolution. So the
// screen needs its own taxonomy, and this file is it.
//
// ORG2 (2026-10-09, Mac: "Graphic settings needs its own tab, etc. I really need you to go all in"): ONE SCREEN, ONE
// MAP. Settings (DFU's 171 keys in seven categories) and the Features home (the port's own rows and the mods, 96 tiles
// in seven groups of their own) were two doors over one subject - the grass was under Features > Sight while the field
// of view was under Settings > Video, and a player wanting "the graphics" opened both. Now one map places EVERYTHING:
// a TAB (the rail: Graphics, Gameplay, Combat, World, Interface, Audio, Controls, Accessibility, Mods & files), then a
// SECTION, then the items in the order they draw - titles only: a row says what it is, the help pane the rest.
// An item is
//   "Section/Key"   one of DFU's settings (a key a Features row owns stands beside that row and draws nothing - FT13)
//   "feat:<id>"     a row of the Features registry (systems/features.js)
//   "port:<id>"     one of the port's own rows (ui/enhancedMenu.js: the HUD's, the touch knobs, the quest repair...)
//   "card:<id>"     a card (the Morrowind files, the packs, other players, the night's sounds)
//   "preset:graphics", "bindings", "link:overhauls", "mods-index" - the screen's own pieces
//
// THE MAP IS TOTAL AND DISJOINT: every one of DFU's keys, every Features row and every port row stands in exactly one
// section, and test/org2_options.test.js pins all three both ways. A DFU re-bake that adds a key, a registry row added
// without a place, fails the build rather than quietly dropping a row off the screen.
//
// It is still close to DFU's own pages (DaggerfallAdvancedSettingsWindow.cs:234-238 gamePlay/interface/enhancements/
// video/accessibility), with AUDIO and MODS doors of their own as before, and three new ones the port's rows earned:
// COMBAT and WORLD (most of what the mods change), and GRAPHICS, which is DFU's Video page and every row that draws.

export const CATEGORIES = Object.freeze([
  tab("graphics", "Graphics", [
    sec("quality", "Quality", [
      "preset:graphics"]),
    sec("display", "Display", [
      "Video/FieldOfView", "feat:render-scale", "Video/TargetFrameRate", "Video/VSync", "port:showFps", "Video/Fullscreen",
      "Video/ExclusiveFullscreen", "Video/ResolutionWidth", "Video/ResolutionHeight", "Video/QualityLevel", "Video/RunInBackground"]),
    sec("distance", "View distance & detail", [
      "feat:land-view-distance", "Experimental/TerrainDistance", "feat:ground-sharpness", "feat:cloud-quality",
      "Experimental/TerrainHeightmapPixelError", "Experimental/AssetCacheThreshold"]),
    sec("light", "Lighting & brightness", [
      "feat:enhanced-lighting", "feat:modded-lighting", "feat:first-person-lighting", "Enhancements/DungeonAmbientLightScale",
      "Enhancements/NightAmbientLightScale", "Enhancements/PlayerTorchLightScale", "Spells/EnableSpellLighting", "Spells/EnableSpellShadows",
      "Video/AmbientLitInteriors"]),
    sec("sky", "Sky, water & weather", [
      "feat:enhanced-environments", "feat:enhanced-water", "feat:water-quality", "feat:mod-heat-haze", "feat:mod-snowfall"]),
    sec("plants", "Plants, trees & wind", [
      "feat:grass", "feat:wind", "feat:mod-windfall", "feat:mod-low-poly-trees", "feat:mod-seasons-iliac-bay"]),
    sec("looks", "Textures & looks", [
      "link:overhauls", "feat:dungeon-wall-style", "Video/RandomDungeonTextures", "Video/MainFilterMode", "GUI/GUIFilterMode", "GUI/VideoFilterMode",
      "Video/EnableTextureArrays", "GUI/AccelerateUICopyTexture"]),
    sec("retro", "Retro look", [
      "Video/RetroRenderingMode", "Video/PostProcessingInRetroMode", "Video/UseMipMapsInRetroMode", "Video/RetroModeAspectCorrection",
      "Video/PalettizationLUTShift"]),
    sec("shadows", "Daggerfall Unity's shadows", [
      "Video/DungeonLightShadows", "Video/InteriorLightShadows", "Video/ExteriorLightShadows", "Video/MobileNPCShadows",
      "Video/GeneralBillboardShadows", "Video/NatureBillboardShadows", "Video/DungeonShadowDistance", "Video/InteriorShadowDistance",
      "Video/ExteriorShadowDistance", "Video/ShadowResolutionMode"]),
    sec("effects", "Post effects", [
      "Effects/AntialiasingMethod", "Effects/AntialiasingFXAAFastMode", "Effects/AntialiasingSMAAQuality", "Effects/AntialiasingTAASharpness",
      "Effects/AmbientOcclusionEnable", "Effects/AmbientOcclusionMethod", "Effects/AmbientOcclusionIntensity", "Effects/AmbientOcclusionThickness",
      "Effects/AmbientOcclusionRadius", "Effects/AmbientOcclusionQuality", "Effects/BloomEnable", "Effects/BloomIntensity", "Effects/BloomThreshold",
      "Effects/BloomDiffusion", "Effects/BloomFastMode", "Effects/DepthOfFieldEnable", "Effects/DepthOfFieldFocusDistance", "Effects/DepthOfFieldAperture",
      "Effects/DepthOfFieldFocalLength", "Effects/DepthOfFieldMaxBlurSize", "Effects/DitherEnable", "Effects/ColorBoostEnable", "Effects/ColorBoostRadius",
      "Effects/ColorBoostIntensity", "Effects/ColorBoostDungeonScale", "Effects/ColorBoostExteriorScale", "Effects/ColorBoostInteriorScale",
      "Effects/ColorBoostDungeonFalloff"]),
  ]),
  tab("gameplay", "Gameplay", [
    sec("general", "General", [
      "Enhancements/LoiterLimitInHours", "Controls/InstantRepairs", "Controls/AllowMagicRepairs", "ChildGuard/PlayerNudity"]),
    sec("quests", "Quests", [
      "port:questRepair", "feat:nearby-quests", "feat:choose-guild-jobs", "Enhancements/GuildQuestListBox", "GUI/CanDropQuestItems",
      "GUI/QuestRumorWeight", "GUI/EnableQuestDebugger"]),
    sec("dungeons", "Dungeons", [
      "feat:smaller-dungeons", "Experimental/SmallerDungeons", "feat:medium-dungeons", "feat:world-dungeon-sizes", "feat:varied-dungeon-monsters",
      "Enhancements/AlternateRandomEnemySelection", "feat:mod-aquatic-sprites"]),
    sec("loot", "Loot & items", [
      "feat:quick-loot", "feat:loot-rarity", "feat:mod-unleveledloot", "feat:mod-roleplay-realism-items", "feat:mod-physical-items"]),
    sec("light", "Your light", [
      "feat:torches-from-items", "Enhancements/PlayerTorchFromItems", "feat:mod-handheld-torches"]),
    sec("character", "Character & survival", [
      "feat:mod-oblivion-remaster-leveling", "feat:mod-project-legacy", "feat:mod-climates-calories", "feat:mod-roleplay-realism"]),
    sec("moving", "Climbing & gathering", [
      "feat:enhanced-climbing", "Enhancements/AdvancedClimbing", "feat:mod-foraging"]),
    sec("start", "Starting a new game", [
      "Startup/StartInDungeon", "Startup/StartCellX", "Startup/StartCellY"]),
    sec("camera", "Camera", [
      "feat:mod-eye-of-the-beholder"]),
    sec("others", "Other players", [
      "card:peerSprites"]),
    sec("advanced", "Advanced", [
      "Enhancements/LypyL_GameConsole"]),
  ]),
  tab("combat", "Combat", [
    sec("enemies", "Enemies", [
      "feat:enhanced-ai", "Enhancements/EnhancedCombatAI", "feat:mod-meanermonsters", "feat:enemy-infighting", "Enhancements/EnemyInfighting"]),
    sec("rules", "Rules & armour", [
      "feat:mod-pcaao", "MeleeAttacks/MeleeAttackFriendlyProtection", "MeleeAttacks/MeleeAttackDetection"]),
    sec("weapons", "Weapons in hand", [
      "feat:mod-weapon-widget", "feat:mod-shield-widget", "feat:mod-diverse-weapons", "feat:bows-left-hand", "Enhancements/BowLeftHandWithSwitching"]),
    sec("morrowind", "With Morrowind data", [
      "feat:mod-weapon-sheathing", "feat:steel-helm", "feat:mw-spell-effects"]),
    sec("aftermath", "Seeing & bleeding", [
      "feat:enhanced-combat-visuals", "feat:blood"]),
    sec("sea", "At sea", [
      "feat:naval-combat"]),
  ]),
  tab("world", "World", [
    sec("land", "Land", [
      "feat:tamriel-land", "feat:landforms", "feat:real-forests", "feat:climate-blend", "feat:road-verges", "feat:mod-roads-hazelnut"]),
    sec("weather", "Weather & ambience", [
      "feat:weather-events", "feat:mod-better-ambience"]),
    sec("towns", "Towns & people", [
      "feat:living-world", "feat:mod-beautiful-villages", "feat:mod-beautiful-cities", "feat:mod-windmills-kamer", "feat:town-watch"]),
    sec("encounters", "Wilderness & encounters", [
      "feat:mod-world-of-daggerfall", "feat:wilderness-camps", "feat:road-encounters", "feat:mod-world-events-raiding-parties"]),
    sec("travel", "Travel", [
      "feat:mod-travel-options", "feat:mod-immersive-travel", "feat:mod-horse-cart-and-cargo"]),
    sec("sea", "The sea & ships", [
      "feat:mod-come-sail-away", "feat:mod-detailed-ships", "feat:mod-warm-ashes-ships", "feat:mod-iliac-puddle-no-more", "feat:mod-ocean-holes"]),
  ]),
  tab("interface", "Interface", [
    sec("hud", "HUD", [
      "port:hudScale", "port:hudLock", "port:hudBars", "port:hudReset", "port:foeBarStyle", "feat:quick-slots", "GUI/Crosshair",
      "GUI/EnableVitalsIndicators", "GUI/InteractionModeIcon", "GUI/EnableArrowCounter", "GUI/IconsPositioningScheme", "feat:near-death-warning",
      "Enhancements/NearDeathWarning"]),
    sec("messages", "Messages & prompts", [
      "feat:mod-world-tooltips", "feat:mod-ambient-text", "GUI/ShowQuestJournalClocksAsCountdown", "GUI/DungeonExitWagonPrompt",
      "GUI/IllegalRestWarning", "GUI/DisableEnemyDeathAlert"]),
    sec("quests", "Quest help", [
      "feat:quest-herald", "feat:quest-tracker", "feat:quest-marks", "feat:quest-guidance"]),
    sec("dungeons", "Dungeon help", [
      "feat:dungeon-sense", "feat:dungeon-echoes", "feat:dungeon-way-out"]),
    sec("maps", "Maps", [
      "port:mapScale", "feat:enhanced-map", "feat:dungeon-map-3d", "feat:tamriel-map", "GUI/TravelMapLocationsOutline", "GUI/EnableGeographicBackgrounds"]),
    sec("townmap", "Town map", [
      "Map/ExteriorMapDefaultZoomLevel", "Map/ExteriorMapResetZoomLevelOnNewLocation", "Map/AutomapTempleColor", "Map/AutomapShopColor",
      "Map/AutomapTavernColor", "Map/AutomapHouseColor"]),
    sec("dungeonmap", "Dungeon map", [
      "Map/AutomapNumberOfDungeons", "Map/AutomapDisableMicroMap", "Map/AutomapRememberSliceLevel", "Map/AutomapAlwaysMaxOutSliceLevel",
      "Map/DungeonMicMapQoL", "Map/DunMicMapInnerColor", "Map/DunMicMapBorderColor"]),
    sec("windows", "Inventory, talk & shops", [
      "GUI/HelmAndShieldMaterialDisplay", "GUI/EnableInventoryInfoPanel", "GUI/EnableEnhancedItemLists",
      "GUI/EnableModernConversationStyleInTalkWindow", "GUI/ShopQualityPresentation", "GUI/ShopQualityHUDDelay"]),
    sec("sheet", "Character sheet", [
      "port:standingAll"]),
    sec("tooltips", "Tooltips", [
      "GUI/EnableToolTips", "GUI/ToolTipDelayInSeconds", "GUI/ToolTipTextColor", "GUI/ToolTipBackgroundColor"]),
    sec("start", "Starting up & loading", [
      "port:skipStartVideo", "feat:loading-screen", "GUI/ShowOptionsAtStart", "GUI/HideLoginName"]),
  ]),
  tab("audio", "Audio", [
    sec("volume", "Volume", [
      "Controls/SoundVolume", "Controls/MusicVolume"]),
    sec("music", "Music", [
      "Audio/AlternateMusic", "Audio/SoundFont"]),
    sec("sounds", "Sounds", [
      "feat:enhanced-sounds", "feat:mod-immersive-footsteps", "feat:combat-voices", "Enhancements/CombatVoices", "card:nightSounds"]),
  ]),
  tab("controls", "Controls", [
    sec("look", "Mouse & looking", [
      "Controls/MouseLookSensitivity", "Controls/InvertMouseVertical", "Controls/MouseLookSmoothingFactor"]),
    sec("attack", "Attacking", [
      "Controls/WeaponSwingMode", "Controls/WeaponSensitivity", "Controls/WeaponAttackThreshold", "Controls/BowDrawback", "Controls/Handedness"]),
    sec("move", "Moving", [
      "Controls/ToggleSneak", "Controls/MovementAcceleration"]),
    sec("controller", "Game controller", [
      "port:padCursorAssist", "Controls/EnableController", "Controls/JoystickLookSensitivity", "Controls/JoystickCursorSensitivity",
      "Controls/JoystickMovementThreshold", "Controls/JoystickDeadzone"]),
    sec("touch", "Touchscreen", [
      "port:touchLookSensitivity", "port:touchAnalogStick", "port:touchStickAnchor", "port:touchGyroLook", "port:touchGyroSensitivity",
      "port:touchHaptics", "port:touchButton1", "port:touchButton2", "port:touchButton3", "port:touchFullscreen"]),
    sec("bindings", "Key bindings", [
      "bindings"]),
  ]),
  tab("accessibility", "Accessibility", [
    sec("motion", "Motion", [
      "Controls/HeadBobbing", "Controls/CameraRecoilStrength", "Effects/MotionBlurEnable", "Effects/MotionBlurShutterAngle",
      "Effects/MotionBlurSampleCount", "Effects/VignetteEnable", "Effects/VignetteIntensity", "Effects/VignetteSmoothness", "Effects/VignetteRoundness",
      "Effects/VignetteRounded"]),
    sec("reading", "Readability", [
      "GUI/SwapHealthAndFatigueColors", "GUI/DimAlphaStrength", "GUI/SDFFontRendering"]),
    sec("largehud", "Large status bar", [
      "GUI/LargeHUD", "GUI/LargeHUDDocked", "GUI/LargeHUDUndockedScale", "GUI/LargeHUDUndockedAlignment", "GUI/LargeHUDUndockedOffsetWeapon",
      "GUI/LargeHUDOffsetHorse"]),
  ]),
  tab("mods", "Mods & files", [
    sec("files", "Your files", [
      "card:morrowind", "card:packs"]),
    sec("dfu", "Daggerfall Unity's mod system", [
      "Enhancements/LypyL_ModSystem", "Enhancements/AssetInjection", "Enhancements/CompressModdedTextures", "Experimental/CustomBooksImport",
      "Daggerfall/MyDaggerfallPath", "Daggerfall/MyDaggerfallUnitySavePath", "Daggerfall/MyDaggerfallUnityScreenshotsPath"]),
    sec("index", "Every mod", [
      "mods-index"]),
  ]),
]);

function tab(id, title, sections) { return Object.freeze({ id, title, sections: Object.freeze(sections) }); }
function sec(id, title, items) { return Object.freeze({ id, title, items: Object.freeze(items) }); }

export const CATEGORY_IDS = Object.freeze(CATEGORIES.map((c) => c.id));

/** An item that is one of DFU's settings (a "Section/Key") rather than one of the screen's own pieces. */
export const isSettingItem = (item) => !/^[a-z-]+:/.test(item) && item.includes('/') || false;

const _of = new Map();      // DFU key -> { cat, order }
const _where = new Map();   // item -> { tab, section }
for (const t of CATEGORIES) {
  let n = 0;
  for (const s of t.sections) {
    for (const item of s.items) {
      _where.set(item, { tab: t, section: s });
      if (isSettingItem(item)) _of.set(item, { cat: t.id, order: n++ });
    }
  }
}

/** The tab a DFU key belongs to, or null if the map has a hole
 *  (which the pin makes impossible). */
export const categoryOf = (key) => _of.get(key)?.cat ?? null;
/** A key's position within its tab, for stable ordering. */
export const orderOf = (key) => _of.get(key)?.order ?? -1;
/** The DFU keys of one tab, in screen order. */
export const keysOf = (catId) => (CATEGORIES.find((c) => c.id === catId)?.sections ?? []).flatMap((s) => s.items.filter(isSettingItem));
/** Where an item stands - `{ tab, section }` - or null. */
export const whereIs = (item) => _where.get(item) ?? null;
/** ORG2: the words for where an item lives - "Settings › World › Travel" - for every message that sends a player to
 *  one (a switch named in a window, a tile's own line). Derived, so a move here moves every message with it. */
export function optionPath(item, { section = true } = {}) {
  const w = whereIs(item);
  if (!w) return 'Settings';
  return ['Settings', w.tab.title, ...(section && w.tab.sections.length > 1 ? [w.section.title] : [])].join(' \u203a ');
}
