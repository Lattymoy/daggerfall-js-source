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
// SECTION with a line of what it holds, then the items in the order they draw. An item is
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
  tab("graphics", "Graphics", "How the game looks and how hard your machine works: a preset for the settings that cost the most, then everything else that draws.", [
    sec("quality", "Quality", "One choice for the settings that cost the most - view distance, grass, clouds, ground sharpness and water. High is how the game ships; still slow, lower the Render scale under Display.", [
      "preset:graphics"]),
    sec("display", "Display", "Your view, the picture's resolution and how many frames you draw.", [
      "Video/FieldOfView", "feat:render-scale", "Video/TargetFrameRate", "Video/VSync", "port:showFps", "Video/Fullscreen",
      "Video/ExclusiveFullscreen", "Video/ResolutionWidth", "Video/ResolutionHeight", "Video/QualityLevel", "Video/RunInBackground"]),
    sec("distance", "View distance & detail", "How far the land is drawn and how sharp it stays into the distance.", [
      "feat:land-view-distance", "Experimental/TerrainDistance", "feat:ground-sharpness", "feat:cloud-quality",
      "Experimental/TerrainHeightmapPixelError", "Experimental/AssetCacheThreshold"]),
    sec("light", "Lighting & brightness", "Lamps, torches, the sun and the shadows they cast, and how dark dungeons and nights are.", [
      "feat:enhanced-lighting", "feat:modded-lighting", "feat:first-person-lighting", "Enhancements/DungeonAmbientLightScale",
      "Enhancements/NightAmbientLightScale", "Enhancements/PlayerTorchLightScale", "Spells/EnableSpellLighting", "Spells/EnableSpellShadows",
      "Video/AmbientLitInteriors"]),
    sec("sky", "Sky, water & weather", "The sky over you, the water around you and the weather between them.", [
      "feat:enhanced-environments", "feat:enhanced-water", "feat:water-quality", "feat:mod-heat-haze", "feat:mod-snowfall"]),
    sec("plants", "Plants, trees & wind", "What grows outdoors, how it changes with the seasons, and how the wind moves it.", [
      "feat:grass", "feat:wind", "feat:mod-windfall", "feat:mod-low-poly-trees", "feat:mod-seasons-iliac-bay"]),
    sec("looks", "Textures & looks", "Dungeon walls and how textures are filtered - and the whole looks, on the Overhauls page.", [
      "link:overhauls", "feat:dungeon-wall-style", "Video/RandomDungeonTextures", "Video/MainFilterMode", "GUI/GUIFilterMode", "GUI/VideoFilterMode",
      "Video/EnableTextureArrays", "GUI/AccelerateUICopyTexture"]),
    sec("retro", "Retro look", "A low-resolution, palette-true picture, like the 1996 game.", [
      "Video/RetroRenderingMode", "Video/PostProcessingInRetroMode", "Video/UseMipMapsInRetroMode", "Video/RetroModeAspectCorrection",
      "Video/PalettizationLUTShift"]),
    sec("shadows", "Daggerfall Unity's shadows", "Daggerfall Unity's own shadow options. The port's shadows are under Lighting.", [
      "Video/DungeonLightShadows", "Video/InteriorLightShadows", "Video/ExteriorLightShadows", "Video/MobileNPCShadows",
      "Video/GeneralBillboardShadows", "Video/NatureBillboardShadows", "Video/DungeonShadowDistance", "Video/InteriorShadowDistance",
      "Video/ExteriorShadowDistance", "Video/ShadowResolutionMode"]),
    sec("effects", "Post effects", "Daggerfall Unity's antialiasing, ambient occlusion, bloom, depth of field and colour boost.", [
      "Effects/AntialiasingMethod", "Effects/AntialiasingFXAAFastMode", "Effects/AntialiasingSMAAQuality", "Effects/AntialiasingTAASharpness",
      "Effects/AmbientOcclusionEnable", "Effects/AmbientOcclusionMethod", "Effects/AmbientOcclusionIntensity", "Effects/AmbientOcclusionThickness",
      "Effects/AmbientOcclusionRadius", "Effects/AmbientOcclusionQuality", "Effects/BloomEnable", "Effects/BloomIntensity", "Effects/BloomThreshold",
      "Effects/BloomDiffusion", "Effects/BloomFastMode", "Effects/DepthOfFieldEnable", "Effects/DepthOfFieldFocusDistance", "Effects/DepthOfFieldAperture",
      "Effects/DepthOfFieldFocalLength", "Effects/DepthOfFieldMaxBlurSize", "Effects/DitherEnable", "Effects/ColorBoostEnable", "Effects/ColorBoostRadius",
      "Effects/ColorBoostIntensity", "Effects/ColorBoostDungeonScale", "Effects/ColorBoostExteriorScale", "Effects/ColorBoostInteriorScale",
      "Effects/ColorBoostDungeonFalloff"]),
  ]),
  tab("gameplay", "Gameplay", "The rules of play: quests, dungeons, loot and items, and who your character becomes.", [
    sec("general", "General", "Waiting, repairs and what people wear.", [
      "Enhancements/LoiterLimitInHours", "Controls/InstantRepairs", "Controls/AllowMagicRepairs", "ChildGuard/PlayerNudity"]),
    sec("quests", "Quests", "Fixing a stuck quest, where quests send you, and how guilds hand out work.", [
      "port:questRepair", "feat:nearby-quests", "feat:choose-guild-jobs", "Enhancements/GuildQuestListBox", "GUI/CanDropQuestItems",
      "GUI/QuestRumorWeight", "GUI/EnableQuestDebugger"]),
    sec("dungeons", "Dungeons", "How big dungeons are and what lives in them.", [
      "feat:smaller-dungeons", "Experimental/SmallerDungeons", "feat:medium-dungeons", "feat:world-dungeon-sizes", "feat:varied-dungeon-monsters",
      "Enhancements/AlternateRandomEnemySelection", "feat:mod-aquatic-sprites"]),
    sec("loot", "Loot & items", "What you find, what it is worth and weighs, and how you take it.", [
      "feat:quick-loot", "feat:loot-rarity", "feat:mod-unleveledloot", "feat:mod-roleplay-realism-items", "feat:mod-physical-items"]),
    sec("light", "Your light", "The torch, lantern or candle you carry.", [
      "feat:torches-from-items", "Enhancements/PlayerTorchFromItems", "feat:mod-handheld-torches"]),
    sec("character", "Character & survival", "How you level, your family line, your needs and the rules of realism.", [
      "feat:mod-oblivion-remaster-leveling", "feat:mod-project-legacy", "feat:mod-climates-calories", "feat:mod-roleplay-realism"]),
    sec("moving", "Climbing & gathering", "Climbing ledges, and gathering in the wild.", [
      "feat:enhanced-climbing", "Enhancements/AdvancedClimbing", "feat:mod-foraging"]),
    sec("start", "Starting a new game", "Where a new character wakes up.", [
      "Startup/StartInDungeon", "Startup/StartCellX", "Startup/StartCellY"]),
    sec("camera", "Camera", "Third person, behind your shoulder.", [
      "feat:mod-eye-of-the-beholder"]),
    sec("others", "Other players", "Playing beside others online: how they look and sound to you, resting and spells with them, and who sees you on the map.", [
      "card:peerSprites"]),
    sec("advanced", "Advanced", "For testing and tinkering.", [
      "Enhancements/LypyL_GameConsole"]),
  ]),
  tab("combat", "Combat", "How a fight goes: your enemies, the rules of a blow, what you hold, and what a fight leaves behind.", [
    sec("enemies", "Enemies", "How enemies fight, how hard they hit, and who they fight.", [
      "feat:enhanced-ai", "Enhancements/EnhancedCombatAI", "feat:mod-meanermonsters", "feat:enemy-infighting", "Enhancements/EnemyInfighting"]),
    sec("rules", "Rules & armour", "How armour, skill and luck decide a blow, and who it can land on.", [
      "feat:mod-pcaao", "MeleeAttacks/MeleeAttackFriendlyProtection", "MeleeAttacks/MeleeAttackDetection"]),
    sec("weapons", "Weapons in hand", "What you hold in first person, how it moves, and which hand holds what.", [
      "feat:mod-weapon-widget", "feat:mod-shield-widget", "feat:mod-diverse-weapons", "feat:bows-left-hand", "Enhancements/BowLeftHandWithSwitching"]),
    sec("morrowind", "With Morrowind data", "Needs your own Morrowind files, attached under Mods & files.", [
      "feat:mod-weapon-sheathing", "feat:steel-helm", "feat:mw-spell-effects"]),
    sec("aftermath", "Seeing & bleeding", "Enemies you could not see before, and the blood a fight leaves.", [
      "feat:enhanced-combat-visuals", "feat:blood"]),
    sec("sea", "At sea", "Fighting from your own ship.", [
      "feat:naval-combat"]),
  ]),
  tab("world", "World", "What the world holds and how you get around it: the land, its towns and wilds, the roads and the sea.", [
    sec("land", "Land", "The shape of the land, its forests and its roads.", [
      "feat:tamriel-land", "feat:landforms", "feat:real-forests", "feat:climate-blend", "feat:road-verges", "feat:mod-roads-hazelnut"]),
    sec("weather", "Weather & ambience", "Weather that moves across the land, and how each place feels.", [
      "feat:weather-events", "feat:mod-better-ambience"]),
    sec("towns", "Towns & people", "How towns are laid out and the people who live in them.", [
      "feat:living-world", "feat:mod-beautiful-villages", "feat:mod-beautiful-cities", "feat:mod-windmills-kamer", "feat:town-watch"]),
    sec("encounters", "Wilderness & encounters", "What you meet out in the wilds and on the road.", [
      "feat:mod-world-of-daggerfall", "feat:wilderness-camps", "feat:road-encounters", "feat:mod-world-events-raiding-parties"]),
    sec("travel", "Travel", "Getting from place to place: journeys, carriages, and your horse and cart.", [
      "feat:mod-travel-options", "feat:mod-immersive-travel", "feat:mod-horse-cart-and-cargo"]),
    sec("sea", "The sea & ships", "Your own boat, the ships at sea and what lies under the water.", [
      "feat:mod-come-sail-away", "feat:mod-detailed-ships", "feat:mod-warm-ashes-ships", "feat:mod-iliac-puddle-no-more", "feat:mod-ocean-holes"]),
  ]),
  tab("interface", "Interface", "Everything drawn on top of the world: the HUD, messages, maps, quest and dungeon help, and the windows.", [
    sec("hud", "HUD", "The bars, icons and crosshair over the world, their size and where they sit.", [
      "port:hudScale", "port:hudLock", "port:hudBars", "port:hudReset", "port:foeBarStyle", "feat:quick-slots", "GUI/Crosshair",
      "GUI/EnableVitalsIndicators", "GUI/InteractionModeIcon", "GUI/EnableArrowCounter", "GUI/IconsPositioningScheme", "feat:near-death-warning",
      "Enhancements/NearDeathWarning"]),
    sec("messages", "Messages & prompts", "The lines, names and questions the game puts on the screen.", [
      "feat:mod-world-tooltips", "feat:mod-ambient-text", "GUI/ShowQuestJournalClocksAsCountdown", "GUI/DungeonExitWagonPrompt",
      "GUI/IllegalRestWarning", "GUI/DisableEnemyDeathAlert"]),
    sec("quests", "Quest help", "How your quests tell you what changed and where to go next.", [
      "feat:quest-herald", "feat:quest-tracker", "feat:quest-marks", "feat:quest-guidance"]),
    sec("dungeons", "Dungeon help", "Finding your way around a dungeon, and back out of it.", [
      "feat:dungeon-sense", "feat:dungeon-echoes", "feat:dungeon-way-out"]),
    sec("maps", "Maps", "The map you hold - towns, dungeons in 3D, the land past the Bay - and the travel map.", [
      "feat:enhanced-map", "feat:dungeon-map-3d", "feat:tamriel-map", "GUI/TravelMapLocationsOutline", "GUI/EnableGeographicBackgrounds"]),
    sec("townmap", "Town map", "The map of the town you stand in: its zoom and the colours of its buildings.", [
      "Map/ExteriorMapDefaultZoomLevel", "Map/ExteriorMapResetZoomLevelOnNewLocation", "Map/AutomapTempleColor", "Map/AutomapShopColor",
      "Map/AutomapTavernColor", "Map/AutomapHouseColor"]),
    sec("dungeonmap", "Dungeon map", "Daggerfall's dungeon map and the small map in the corner.", [
      "Map/AutomapNumberOfDungeons", "Map/AutomapDisableMicroMap", "Map/AutomapRememberSliceLevel", "Map/AutomapAlwaysMaxOutSliceLevel",
      "Map/DungeonMicMapQoL", "Map/DunMicMapInnerColor", "Map/DunMicMapBorderColor"]),
    sec("windows", "Inventory, talk & shops", "What the inventory, conversation and shop windows show you.", [
      "GUI/HelmAndShieldMaterialDisplay", "GUI/EnableInventoryInfoPanel", "GUI/EnableEnhancedItemLists",
      "GUI/EnableModernConversationStyleInTalkWindow", "GUI/ShopQualityPresentation", "GUI/ShopQualityHUDDelay"]),
    sec("tooltips", "Tooltips", "The names that appear when you point at something in a window.", [
      "GUI/EnableToolTips", "GUI/ToolTipDelayInSeconds", "GUI/ToolTipTextColor", "GUI/ToolTipBackgroundColor"]),
    sec("start", "Starting up & loading", "What you see when the game starts, and while the world loads.", [
      "port:skipStartVideo", "feat:loading-screen", "GUI/ShowOptionsAtStart", "GUI/HideLoginName"]),
  ]),
  tab("audio", "Audio", "Volume, music, and the sounds of the world and a fight.", [
    sec("volume", "Volume", "How loud the sounds and the music are.", [
      "Controls/SoundVolume", "Controls/MusicVolume"]),
    sec("music", "Music", "Which music plays.", [
      "Audio/AlternateMusic", "Audio/SoundFont"]),
    sec("sounds", "Sounds", "The wind, your footsteps, the night and the noise of a fight.", [
      "feat:enhanced-sounds", "feat:mod-immersive-footsteps", "feat:combat-voices", "Enhancements/CombatVoices", "card:nightSounds"]),
  ]),
  tab("controls", "Controls", "Looking, moving and swinging - with a mouse, a controller or a touchscreen - and every key.", [
    sec("look", "Mouse & looking", "How the camera follows the mouse.", [
      "Controls/MouseLookSensitivity", "Controls/InvertMouseVertical", "Controls/MouseLookSmoothingFactor"]),
    sec("attack", "Attacking", "How a swing or a bow shot is made, and which hand holds the weapon.", [
      "Controls/WeaponSwingMode", "Controls/WeaponSensitivity", "Controls/WeaponAttackThreshold", "Controls/BowDrawback", "Controls/Handedness"]),
    sec("move", "Moving", "Sneaking, and how you start and stop.", [
      "Controls/ToggleSneak", "Controls/MovementAcceleration"]),
    sec("controller", "Game controller", "A gamepad's sticks and its menu cursor.", [
      "port:padCursorAssist", "Controls/EnableController", "Controls/JoystickLookSensitivity", "Controls/JoystickCursorSensitivity",
      "Controls/JoystickMovementThreshold", "Controls/JoystickDeadzone"]),
    sec("touch", "Touchscreen", "The stick, the buttons and aiming on a phone or tablet.", [
      "port:touchLookSensitivity", "port:touchAnalogStick", "port:touchStickAnchor", "port:touchGyroLook", "port:touchGyroSensitivity",
      "port:touchHaptics", "port:touchButton1", "port:touchButton2", "port:touchButton3", "port:touchFullscreen"]),
    sec("bindings", "Key bindings", "Every key the game answers, and the ones you can change.", [
      "bindings"]),
  ]),
  tab("accessibility", "Accessibility", "Comfort and readability, for anyone bothered by motion, flashing or small text.", [
    sec("motion", "Motion", "Camera movement that can make some people queasy.", [
      "Controls/HeadBobbing", "Controls/CameraRecoilStrength", "Effects/MotionBlurEnable", "Effects/MotionBlurShutterAngle",
      "Effects/MotionBlurSampleCount", "Effects/VignetteEnable", "Effects/VignetteIntensity", "Effects/VignetteSmoothness", "Effects/VignetteRoundness",
      "Effects/VignetteRounded"]),
    sec("reading", "Readability", "Colours and text that are easier to read.", [
      "GUI/SwapHealthAndFatigueColors", "GUI/DimAlphaStrength", "GUI/SDFFontRendering"]),
    sec("largehud", "Large status bar", "Daggerfall's big status bar along the bottom of the screen, and where it sits.", [
      "GUI/LargeHUD", "GUI/LargeHUDDocked", "GUI/LargeHUDUndockedScale", "GUI/LargeHUDUndockedAlignment", "GUI/LargeHUDUndockedOffsetWeapon",
      "GUI/LargeHUDOffsetHorse"]),
  ]),
  tab("mods", "Mods & files", "What you bring to the game - your own Morrowind files and packs - Daggerfall Unity's mod system, and every mod in the game in one list.", [
    sec("files", "Your files", "Your own Morrowind files for a body in 3D, and texture and music packs.", [
      "card:morrowind", "card:packs"]),
    sec("dfu", "Daggerfall Unity's mod system", "Daggerfall Unity's own switches for mods and where its files live.", [
      "Enhancements/LypyL_ModSystem", "Enhancements/AssetInjection", "Enhancements/CompressModdedTextures", "Experimental/CustomBooksImport",
      "Daggerfall/MyDaggerfallPath", "Daggerfall/MyDaggerfallUnitySavePath", "Daggerfall/MyDaggerfallUnityScreenshotsPath"]),
    sec("index", "Every mod", "Each mod in the game, where its options live, and its switch.", [
      "mods-index"]),
  ]),
]);

function tab(id, title, blurb, sections) { return Object.freeze({ id, title, blurb, sections: Object.freeze(sections) }); }
function sec(id, title, blurb, items) { return Object.freeze({ id, title, blurb, items: Object.freeze(items) }); }

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
