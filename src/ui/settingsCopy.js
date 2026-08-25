// MENU: the WORDS on the settings screen.
//
// Two sources, in order:
//   1. LABELS below - a short Title Case name for every one of the
//      171 keys, so a raw ini identifier can never reach the screen.
//      "LypyL_GameConsole" reads as "Developer Console".
//   2. DFU's OWN tooltip for the explanation (systemsText's
//      SETTINGS_INFO, vendored from GameSettings.txt). Where DFU wrote
//      a sentence we use DFU's sentence - porting the words is porting
//      a law, and it is the reason this screen explains 78 settings
//      without anyone here inventing an explanation.
//
// DFU keys its text table by the name of the UI CONTROL, not by the
// ini key, so DFU_TEXT_KEY bridges the two. Most bridge by lowering
// the first letter (SoundVolume -> soundVolume); the ones that do not
// are listed explicitly.
import { SETTINGS_INFO } from '../systems/settingsText.js';

export const LABELS = Object.freeze({
  "Audio/AlternateMusic": "Alternate Music",
  "Audio/SoundFont": "Music Instrument Set",
  "ChildGuard/PlayerNudity": "Show Nudity",
  "Controls/AllowMagicRepairs": "Repair Magic Items",
  "Controls/BowDrawback": "Draw And Release Bows",
  "Controls/CameraRecoilStrength": "Screen Shake On Damage",
  "Controls/EnableController": "Game Controller",
  "Controls/Handedness": "Weapon Hand",
  "Controls/HeadBobbing": "Head Bobbing",
  "Controls/InstantRepairs": "Instant Repairs",
  "Controls/InvertMouseVertical": "Invert Look Up/Down",
  "Controls/JoystickCursorSensitivity": "Gamepad Cursor Speed",
  "Controls/JoystickDeadzone": "Gamepad Stick Deadzone",
  "Controls/JoystickLookSensitivity": "Gamepad Look Speed",
  "Controls/JoystickMovementThreshold": "Gamepad Movement Deadzone",
  "Controls/MouseLookSensitivity": "Mouse Sensitivity",
  "Controls/MouseLookSmoothingFactor": "Look Smoothing",
  "Controls/MovementAcceleration": "Gradual Start And Stop",
  "Controls/MusicVolume": "Music Volume",
  "Controls/SoundVolume": "Sound Volume",
  "Controls/ToggleSneak": "Sneak Stays On",
  "Controls/WeaponAttackThreshold": "Swing Travel Needed",
  "Controls/WeaponSensitivity": "Swing Sensitivity",
  "Controls/WeaponSwingMode": "Weapon Swing Style",
  "Daggerfall/MyDaggerfallPath": "Daggerfall Folder",
  "Daggerfall/MyDaggerfallUnitySavePath": "Save Folder",
  "Daggerfall/MyDaggerfallUnityScreenshotsPath": "Screenshot Folder",
  "Effects/AmbientOcclusionEnable": "Corner Shading",
  "Effects/AmbientOcclusionIntensity": "Corner Shading Strength",
  "Effects/AmbientOcclusionMethod": "Corner Shading Method",
  "Effects/AmbientOcclusionQuality": "Corner Shading Quality",
  "Effects/AmbientOcclusionRadius": "Corner Shading Radius",
  "Effects/AmbientOcclusionThickness": "Corner Shading Thickness",
  "Effects/AntialiasingFXAAFastMode": "Edge Smoothing Fast Mode",
  "Effects/AntialiasingMethod": "Edge Smoothing",
  "Effects/AntialiasingSMAAQuality": "Edge Smoothing Quality",
  "Effects/AntialiasingTAASharpness": "Edge Smoothing Sharpness",
  "Effects/BloomDiffusion": "Glow Spread",
  "Effects/BloomEnable": "Glow",
  "Effects/BloomFastMode": "Glow Fast Mode",
  "Effects/BloomIntensity": "Glow Strength",
  "Effects/BloomThreshold": "Glow Threshold",
  "Effects/ColorBoostDungeonFalloff": "Colour Boost Falloff",
  "Effects/ColorBoostDungeonScale": "Colour Boost Dungeons",
  "Effects/ColorBoostEnable": "Colour Boost",
  "Effects/ColorBoostExteriorScale": "Colour Boost Outdoors",
  "Effects/ColorBoostIntensity": "Colour Boost Strength",
  "Effects/ColorBoostInteriorScale": "Colour Boost Indoors",
  "Effects/ColorBoostRadius": "Colour Boost Radius",
  "Effects/DepthOfFieldAperture": "Aperture",
  "Effects/DepthOfFieldEnable": "Depth Of Field",
  "Effects/DepthOfFieldFocalLength": "Focal Length",
  "Effects/DepthOfFieldFocusDistance": "Focus Distance",
  "Effects/DepthOfFieldMaxBlurSize": "Maximum Blur",
  "Effects/DitherEnable": "Dithering",
  "Effects/MotionBlurEnable": "Motion Blur",
  "Effects/MotionBlurSampleCount": "Motion Blur Samples",
  "Effects/MotionBlurShutterAngle": "Motion Blur Amount",
  "Effects/VignetteEnable": "Darkened Edges",
  "Effects/VignetteIntensity": "Darkened Edge Strength",
  "Effects/VignetteRounded": "Round Darkened Edges",
  "Effects/VignetteRoundness": "Darkened Edge Shape",
  "Effects/VignetteSmoothness": "Darkened Edge Softness",
  "Enhancements/AdvancedClimbing": "Advanced Climbing",
  "Enhancements/AlternateRandomEnemySelection": "Varied Dungeon Monsters",
  "Enhancements/AssetInjection": "Replace Game Artwork",
  "Enhancements/BowLeftHandWithSwitching": "Bows In Left Hand",
  "Enhancements/CombatVoices": "Combat Voices",
  "Enhancements/CompressModdedTextures": "Compress Mod Textures",
  "Enhancements/DungeonAmbientLightScale": "Dungeon Brightness",
  "Enhancements/EnemyInfighting": "Enemies Fight Each Other",
  "Enhancements/EnhancedCombatAI": "Smarter Enemies",
  "Enhancements/GuildQuestListBox": "Choose Guild Jobs",
  "Enhancements/LoiterLimitInHours": "Maximum Wait Time",
  "Enhancements/LypyL_GameConsole": "Developer Console",
  "Enhancements/LypyL_ModSystem": "Mod Support",
  "Enhancements/NearDeathWarning": "Near Death Warning",
  "Enhancements/NightAmbientLightScale": "Night Brightness",
  "Enhancements/PlayerTorchFromItems": "Torches Light Your Way",
  "Enhancements/PlayerTorchLightScale": "Torch Brightness",
  "Experimental/AssetCacheThreshold": "Asset Cache Size",
  "Experimental/CustomBooksImport": "Add Your Own Books",
  "Experimental/SmallerDungeons": "Smaller Dungeons",
  "Experimental/TerrainDistance": "Land View Distance",
  "Experimental/TerrainHeightmapPixelError": "Land Detail Error",
  "GUI/AccelerateUICopyTexture": "Faster Menu Textures",
  "GUI/CanDropQuestItems": "Drop Quest Items",
  "GUI/Crosshair": "Crosshair",
  "GUI/DimAlphaStrength": "Dimming Strength",
  "GUI/DisableEnemyDeathAlert": "Silence Death Alerts",
  "GUI/DungeonExitWagonPrompt": "Wagon Prompt At Exits",
  "GUI/EnableArrowCounter": "Arrow Counter",
  "GUI/EnableEnhancedItemLists": "Enhanced Item Lists",
  "GUI/EnableGeographicBackgrounds": "Map Backgrounds",
  "GUI/EnableInventoryInfoPanel": "Inventory Info Panel",
  "GUI/EnableModernConversationStyleInTalkWindow": "Modern Talk Layout",
  "GUI/EnableQuestDebugger": "Quest Debugger",
  "GUI/EnableToolTips": "Tooltips",
  "GUI/EnableVitalsIndicators": "Health And Fatigue Bars",
  "GUI/GUIFilterMode": "Menu Texture Filter",
  "GUI/HelmAndShieldMaterialDisplay": "Helm And Shield Metal",
  "GUI/HideLoginName": "Hide Login Name",
  "GUI/IconsPositioningScheme": "Spell Icon Layout",
  "GUI/IllegalRestWarning": "Illegal Rest Warning",
  "GUI/InteractionModeIcon": "Interaction Icon",
  "GUI/LargeHUD": "Large Status Bar",
  "GUI/LargeHUDDocked": "Dock Large Status Bar",
  "GUI/LargeHUDOffsetHorse": "Keep Bar Clear Of Horse",
  "GUI/LargeHUDUndockedAlignment": "Large Status Bar Side",
  "GUI/LargeHUDUndockedOffsetWeapon": "Keep Bar Clear Of Weapon",
  "GUI/LargeHUDUndockedScale": "Large Status Bar Size",
  "GUI/QuestRumorWeight": "Quest Rumour Weight",
  "GUI/SDFFontRendering": "Smooth Fonts",
  "GUI/ShopQualityHUDDelay": "Shop Quality Delay",
  "GUI/ShopQualityPresentation": "Shop Quality Text",
  "GUI/ShowOptionsAtStart": "Show Settings At Startup",
  "GUI/ShowQuestJournalClocksAsCountdown": "Journal Countdowns",
  "GUI/SwapHealthAndFatigueColors": "Swap Bar Colours",
  "GUI/ToolTipBackgroundColor": "Tooltip Background",
  "GUI/ToolTipDelayInSeconds": "Tooltip Delay",
  "GUI/ToolTipTextColor": "Tooltip Text Colour",
  "GUI/TravelMapLocationsOutline": "Outline Map Locations",
  "GUI/VideoFilterMode": "Video Texture Filter",
  "Map/AutomapAlwaysMaxOutSliceLevel": "Always Full Map Slice",
  "Map/AutomapDisableMicroMap": "Hide Dungeon Micro-Map",
  "Map/AutomapHouseColor": "House Colour",
  "Map/AutomapNumberOfDungeons": "Dungeon Maps Remembered",
  "Map/AutomapRememberSliceLevel": "Remember Map Slice",
  "Map/AutomapShopColor": "Shop Colour",
  "Map/AutomapTavernColor": "Tavern Colour",
  "Map/AutomapTempleColor": "Temple Colour",
  "Map/DunMicMapBorderColor": "Micro-Map Edge Colour",
  "Map/DunMicMapInnerColor": "Micro-Map Fill Colour",
  "Map/DungeonMicMapQoL": "Improved Micro-Map",
  "Map/ExteriorMapDefaultZoomLevel": "Town Map Zoom",
  "Map/ExteriorMapResetZoomLevelOnNewLocation": "Reset Town Map Zoom",
  "MeleeAttacks/MeleeAttackDetection": "Hit Detection",
  "MeleeAttacks/MeleeAttackFriendlyProtection": "Protect Bystanders",
  "Spells/EnableSpellLighting": "Spell Lighting",
  "Spells/EnableSpellShadows": "Spell Shadows",
  "Startup/StartCellX": "Start Map Square X",
  "Startup/StartCellY": "Start Map Square Y",
  "Startup/StartInDungeon": "Start In The Dungeon",
  "Video/AmbientLitInteriors": "Lit Interiors",
  "Video/DungeonLightShadows": "Dungeon Light Shadows",
  "Video/DungeonShadowDistance": "Dungeon Shadow Range",
  "Video/EnableTextureArrays": "Texture Arrays",
  "Video/ExclusiveFullscreen": "Exclusive Fullscreen",
  "Video/ExteriorLightShadows": "Outdoor Light Shadows",
  "Video/ExteriorShadowDistance": "Outdoor Shadow Range",
  "Video/FieldOfView": "Field Of View",
  "Video/Fullscreen": "Fullscreen",
  "Video/GeneralBillboardShadows": "Object Shadows",
  "Video/InteriorLightShadows": "Indoor Light Shadows",
  "Video/InteriorShadowDistance": "Indoor Shadow Range",
  "Video/MainFilterMode": "World Texture Filter",
  "Video/MobileNPCShadows": "Townsfolk Shadows",
  "Video/NatureBillboardShadows": "Tree And Plant Shadows",
  "Video/PalettizationLUTShift": "Retro Palette Shift",
  "Video/PostProcessingInRetroMode": "Retro Picture Effects",
  "Video/QualityLevel": "Detail Level",
  "Video/RandomDungeonTextures": "Dungeon Wall Style",
  "Video/ResolutionHeight": "Screen Height",
  "Video/ResolutionWidth": "Screen Width",
  "Video/RetroModeAspectCorrection": "Retro Aspect",
  "Video/RetroRenderingMode": "Retro Picture Mode",
  "Video/RunInBackground": "Keep Running In Background",
  "Video/ShadowResolutionMode": "Shadow Sharpness",
  "Video/TargetFrameRate": "Frame Rate Cap",
  "Video/UseMipMapsInRetroMode": "Retro Mip Maps",
  "Video/VSync": "Wait For Screen Refresh",
});

/** ini key -> DFU text-table key, where the lowered-first-letter rule
 *  does not hold. Each is DFU's own control name for that setting. */
export const DFU_TEXT_KEY = Object.freeze({
  'Video/FieldOfView': 'fovSlider',
  'Controls/MouseLookSensitivity': 'mouseSensitivity',
  'Controls/MouseLookSmoothingFactor': 'mouseSmoothing',
  'Enhancements/LypyL_ModSystem': 'modSystem',
  'Enhancements/LypyL_GameConsole': 'gameConsole',
  'Spells/EnableSpellLighting': 'spellLighting',
  'Spells/EnableSpellShadows': 'spellShadows',
  'GUI/EnableToolTips': 'toolTips',
  'GUI/EnableVitalsIndicators': 'vitalsIndicators',
  'GUI/EnableArrowCounter': 'arrowCounter',
  'GUI/EnableInventoryInfoPanel': 'inventoryInfoPanel',
  'GUI/EnableEnhancedItemLists': 'enhancedItemLists',
  'GUI/EnableGeographicBackgrounds': 'geographicBackgrounds',
  'GUI/Crosshair': 'crosshair',
  'Video/ResolutionWidth': 'resolution',
  'Video/ResolutionHeight': 'resolution',
  'Video/RandomDungeonTextures': 'randomDungeonTextures',
  'Controls/WeaponAttackThreshold': 'weaponAttackThreshold',
  'Controls/CameraRecoilStrength': 'cameraRecoilStrength',
  'Audio/SoundFont': 'soundFont',
  'Audio/AlternateMusic': 'alternateMusic',
  'Controls/SoundVolume': 'soundVolume',
  'Controls/MusicVolume': 'musicVolume',
});

const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);

/** DFU's text-table key for a store key, if there is one. */
export function dfuTextKey(key) {
  if (DFU_TEXT_KEY[key]) return DFU_TEXT_KEY[key];
  const bare = key.slice(key.indexOf('/') + 1);
  return lowerFirst(bare);
}

/** The short name a player reads. Never an ini identifier: the LABELS
 *  table is total over the store, and the de-camel fallback exists
 *  only so a key added by a future DFU re-bake still reads as words
 *  rather than as code. */
export function labelOf(key) {
  if (LABELS[key]) return LABELS[key];
  const bare = key.slice(key.indexOf('/') + 1).replace(/^LypyL_/, '').replace(/^Enable/, '');
  return bare.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ').trim();
}

/** The explanation, in DFU's own words where DFU wrote one. Empty
 *  string when it did not - the screen then shows the status line
 *  alone rather than inventing a sentence. */
export function helpOf(key) {
  return SETTINGS_INFO[dfuTextKey(key)] ?? '';
}

/** MENU: what a NOT-AVAILABLE row prints where its control would be.
 *  "n/a" tells a player they were denied something; "classic" tells
 *  them what they are actually playing. Nothing on this screen says
 *  unsupported, broken, missing or not implemented - pinned. */
export const READOUT = Object.freeze({
  'Enhancements/EnhancedCombatAI': 'classic',
  'Enhancements/AdvancedClimbing': 'classic',
  'Enhancements/LypyL_ModSystem': 'none',
  'Enhancements/CompressModdedTextures': 'none',
  'Experimental/CustomBooksImport': 'none',
  'Daggerfall/MyDaggerfallPath': 'your files',
  'Daggerfall/MyDaggerfallUnitySavePath': 'this browser',
  'Daggerfall/MyDaggerfallUnityScreenshotsPath': 'downloads',
  'Video/ResolutionWidth': 'your window',
  'Video/ResolutionHeight': 'your window',
  'Video/ExclusiveFullscreen': 'browser',
  'Video/Fullscreen': 'browser',
  'Controls/EnableController': 'no gamepad',
  'Controls/JoystickLookSensitivity': 'no gamepad',
  'Controls/JoystickCursorSensitivity': 'no gamepad',
  'Controls/JoystickMovementThreshold': 'no gamepad',
  'Controls/JoystickDeadzone': 'no gamepad',
});

/** The sentence that says what you get INSTEAD - shown in the detail
 *  dialog. Every unavailable key has one. */
export const INSTEAD = Object.freeze({
  'Enhancements/EnhancedCombatAI': "You get Daggerfall's own enemy behaviour, exactly as it shipped.",
  'Enhancements/AdvancedClimbing': "You get Daggerfall's own climbing, exactly as it shipped.",
  'Enhancements/LypyL_ModSystem': 'Nothing to add yet - when add-ons arrive they will be listed on this page.',
  'Enhancements/CompressModdedTextures': 'Nothing to add yet - when add-ons arrive they will be listed on this page.',
  'Experimental/CustomBooksImport': 'Nothing to add yet - when add-ons arrive they will be listed on this page.',
  'Daggerfall/MyDaggerfallPath': 'The game reads the files you chose, straight from this browser.',
  'Daggerfall/MyDaggerfallUnitySavePath': 'Saves live in this browser and survive a reload.',
  'Daggerfall/MyDaggerfallUnityScreenshotsPath': 'Pictures go wherever your browser puts downloads.',
  'Video/ResolutionWidth': 'The picture already fills the window you give it.',
  'Video/ResolutionHeight': 'The picture already fills the window you give it.',
  'Video/ExclusiveFullscreen': "Use your browser's own fullscreen - F11 on a desktop.",
  'Video/Fullscreen': "Use your browser's own fullscreen - F11 on a desktop.",
  'Controls/EnableController': 'Keyboard, mouse and touch all work today.',
  'Controls/JoystickLookSensitivity': 'Keyboard, mouse and touch all work today.',
  'Controls/JoystickCursorSensitivity': 'Keyboard, mouse and touch all work today.',
  'Controls/JoystickMovementThreshold': 'Keyboard, mouse and touch all work today.',
  'Controls/JoystickDeadzone': 'Keyboard, mouse and touch all work today.',
});

/** The one-line status a row's tier earns, shown in the help panel. */
export const TIER_TEXT = Object.freeze({
  live: 'This works now.',
  stored: 'Your choice is saved, but nothing reads it yet.',
  unavailable: 'Fixed here - it cannot be changed in this port.',
});
