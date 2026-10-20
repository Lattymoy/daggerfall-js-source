// ROADS 24: A VENDORED MOD'S OWN SWITCHES. DFU's settings model is its
// 171 keys and nothing else (settings.test.js pins the count), and a
// mod's switches are not DFU's - in DFU they live in the mod's own
// modsettings, under the Mods menu. So they live here: one small store,
// keyed by the vendor folder, with the mod's own names, defaults and
// descriptions exactly as its modsettings ships them. localStorage-
// backed through the port's ONE storage seam where there is storage,
// in-memory where there is not, so the worker and node both read
// defaults without a DOM.

import { appStorage } from './appStorage.js';   // the one storage seam - localStorage lives there alone
import { onlineForcedModSetting, onlineWholeModKey } from './online/onlineLane.js';   // MODS-ONLINE-2: online, the room's ground is forced and every other switch is the player's; REALM P0.2: and the balance mods whole
import { FOOT_SKIN_COUNT, CLASS_SKINS, classSkinLabel } from '../player/classSkins.js';   // SKIN2: the class skins past the mod's sixteen
import { t, localizedText } from './textManager.js';   // L10N4: every setting's description and option names in the player's language, read when they are read; DFU's own key where it has the same word

const STORE_KEY = 'dfjs-mod-settings';

/** L10N4: A LIST OF WORDS, READ IN THE PLAYER'S LANGUAGE. A MultipleChoiceKey's option names (and a slider's labels)
 *  are indexed by the value a setting stores, so the list stays one frozen array whose length and order are the
 *  mod's; each entry is a getter over its own text-core call - read when the pane reads it, never at module load - and
 *  a plain string (a key's own name) stands as it is. */
const lazyWords = (...words) => Object.freeze(Object.defineProperties([], Object.fromEntries(
  words.map((w, i) => [i, typeof w === 'function' ? { get: w, enumerable: true } : { value: w, enumerable: true }]))));
/** The two lists several keys share: Shield Widget's three stances, Eye Of The Beholder's nine automatic views. */
const SHIELD_STANCES = lazyWords(() => t('mods.shieldWidget.option.hide', 'Hide'), () => t('mods.shieldWidget.option.offScreen', 'Off-screen'), () => t('mods.shieldWidget.option.corner', 'Corner'), () => t('mods.shieldWidget.option.ready', 'Ready'));
const EOTB_VIEWS = lazyWords(() => t('mods.eyeOfTheBeholder.option.dontChange', 'Don\'tChange'), () => t('mods.eyeOfTheBeholder.option.firstPerson', 'FirstPerson'), () => t('mods.eyeOfTheBeholder.option.thirdPerson', 'ThirdPerson'));

/** Every vendored mod that has switches, by vendor key. Names, defaults
 *  and descriptions are the mod's own (Basic Roads 1.3.1 modsettings).
 *  `author` is the manifest's ModAuthor (Basic Roads: its README's),
 *  and the Mods pane puts it IN THE TITLE (Mac, 2026-09-08: "place each
 *  creator's name in the mod title").
 *  L10N4: every key's `description` is a getter over `t('mods.<vendor>.<Key>.description', ...)` and every list of
 *  option names (or labels) a `lazyWords`, so each reads in the player's language at the moment it is read - the
 *  English is the mod's own, byte for byte. Titles and authors are names, and stay as they are.
 *  PLAIN-TEXT (2026-10-19, the owner: "Remove overexplaining text and replace it with proper palatable descriptions"):
 *  a description that read as a note to a developer (the port's codes, "INERT", engine terms, a typo, "|| Default =
 *  True") is reworded for a player - an inert key says "Has no effect" and why. A description that already read plainly
 *  is still the mod's own; the tests pin each reworded one by its words. */
export const MOD_SETTINGS = Object.freeze({
  // DS1: DYNAMIC SKIES 2.3.4 (BadLuckBurt and carademono). Its own two
  // sections, names and descriptions as modsettings.json ships them
  // (FogDensity/densitySetting; SnowSizeAndNumberOfParticles/*), plus
  // `Enabled`, which is the port's: DFU enables a mod by listing it, and
  // the port has no mod list, so the whole sky is one switch here. A
  // key with `min`/`max` is a SliderIntKey and reads as an integer.
  // VC1 (2026-09-07, Mac: "remove the pixelated sky look"): OFF by
  // default. The mod's look - 512-pixel cloud sheets drawn nearest and
  // its own colour posterise - is the pixelation Mac named, and it is
  // the mod's to keep; the port's own dome is the enhanced lane's sky
  // and the mod is a choice in the Mods pane (Ledger row DS1).
  // MO1 (2026-09-12, Mac: "All mods should be enabled by default"):
  // every mod's `Enabled` defaults TRUE - this one, Meaner Monsters,
  // the Physical Combat And Armor Overhaul and Unleveled Loot alike -
  // and the Mods pane is where a player turns one off. While this one
  // is on the mod's skybox is the enhanced lane's sky, as DS1 shipped
  // it - with the volumetric clouds over it (DS2) and the Pixelated sky
  // switch on it (PS2); the port's own dome draws while it is off.
  'dynamic-skies': Object.freeze({
    title: 'Dynamic Skies',
    author: 'BadLuckBurt and carademono',
    keys: Object.freeze({
      Enabled: Object.freeze({ default: true, get description() { return t('mods.dynamicSkies.Enabled.description', 'A new sky for the enhanced outdoors, with cloud layers for each weather, twinkling stars, both moons, fog colors, longer sunrises and sunsets, and lightning in storms. Off uses the game’s own sky.'); } }),
      densitySetting: Object.freeze({ default: 1, min: 1, max: 10, get description() { return t('mods.dynamicSkies.densitySetting.description', 'Makes fog thicker'); } }),
      ActivatePixelSnow: Object.freeze({ default: false, get description() { return t('mods.dynamicSkies.ActivatePixelSnow.description', 'Turn the pixel snow replacement on or off'); } }),
      MinParticleSize: Object.freeze({ default: 100, min: 100, max: 800, get description() { return t('mods.dynamicSkies.MinParticleSize.description', 'Minimum snow particle size'); } }),
      MaxParticleSize: Object.freeze({ default: 300, min: 100, max: 800, get description() { return t('mods.dynamicSkies.MaxParticleSize.description', 'Maximum snow particle size'); } }),
      // AUDIT 61: the value is read and logged by the mod and never applied; carried as it ships. PLAIN-TEXT (2026-10-19): the pane says so - it read as the author wrote it, a slider that did nothing.
      MaxParticles: Object.freeze({ default: 20, min: 15, max: 20, get description() { return t('mods.dynamicSkies.MaxParticles.description', 'Has no effect: the mod never uses this setting.'); } }),
    }),
  }),
  // WORLD-HOVER: WORLD TOOLTIPS 1.1 (jefetienne). The mod ships exactly
  // ONE key, and its description is the author's own word for word -
  // it exists so the main quest's puzzles are not given away by a
  // label on the thing you are meant to find for yourself.
  // `Enabled` is the port's, as it is for every vendored mod (MO1).
  'world-tooltips': Object.freeze({
    title: 'World Tooltips',
    author: 'jefetienne',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        get description() {
          return t('mods.worldTooltips.Enabled.description', 'Shows the name of what you’re looking at under the crosshair: people, shops and their opening hours, doors '
            + 'and their locks, where an exit leads, levers, ladders, bookshelves and Daedra waiting to be summoned. Off, '
            + 'you still see what a chest or body holds.');
        },
      }),
      HideDefaultInteractTooltip: Object.freeze({
        default: false,
        get description() { return t('mods.worldTooltips.HideDefaultInteractTooltip.description', 'Hides the label on things that may be meant to stay secret, such as the puzzles of the main quest.'); },
      }),
    }),
  }),
  // RSH1: READIED SPELLCASTING HANDS 1.3 (jefetienne, the World Tooltips author). The mod ships no modsettings - it is
  // on when it is listed - so `Enabled` is the port's alone (MO1: on by default), and its description is written here.
  'readied-spellcasting-hands': Object.freeze({
    title: 'Readied Spellcasting Hands',
    author: 'jefetienne',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        description: 'Your casting hands come up and stay raised while a readied spell waits for your click. '
          + 'Spells you cast on yourself go off at once.',
      }),
    }),
  }),
  'seasons-iliac-bay': Object.freeze({
    title: 'Seasons of the Iliac Bay',
    author: 'RosyTheRascal',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        get description() {
          return t('mods.seasonsIliacBay.Enabled.description', 'Trees, rocks and plants change with autumn, spring and winter. Add your own copy of the mod under '
            + 'Your own textures, or the classic look is used.');
        },
      }),
    }),
  }),
  // LPT1 (2026-10-05): LOW POLY TREES 5 (SquidKamer). No modsettings of its own - 253 prefabs - so one switch: the
  // port's Enabled, read once when the world loads (a flip reaches it as it next loads). The player's own online: it
  // changes how the trees are drawn, never where they stand (bible/07-Rendering/Low-Poly-Trees.md).
  'low-poly-trees': Object.freeze({
    title: 'Low Poly Trees',
    author: 'SquidKamer',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        description: 'The wilderness trees, bushes and stumps in 3D, made from the original game’s tree pictures, '
          + 'out to your full view distance. They change with Seasons of the Iliac Bay and in winter.',
      }),
    }),
  }),
  // AUDIT BASIC ROADS (BR3, 2026-09-13, Mac: "can you do an audit on
  // basic roads, I dont think its working"). THIS MOD HAD NO `Enabled`
  // AND NO GATE - the only one of the six. MO1 gave every mod the
  // switch and defaulted it TRUE; this one was missed, so Basic Roads
  // was not enabled-by-default, it was UNCONDITIONAL: world.js called
  // loadModRoads() with nothing to ask, and a player could neither see
  // that it was on nor turn it off. OFF does not mean a roadless map -
  // the port has had its OWN network since ROADS 3 and it is the
  // fallback for a map his arrays cannot load. So the switch reads the
  // way Dynamic Skies' does: on, the mod's network 1:1; off, the
  // port's own, generated from the player's map.
  'roads-hazelnut': Object.freeze({
    title: 'Basic Roads',
    author: 'Hazelnut',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        get description() {
          return t('mods.roadsHazelnut.Enabled.description', 'Hazelnut’s roads, tracks, rivers and streams across the whole Iliac Bay, painted onto the land. Off, '
            + 'the game builds its own roads between the towns on your map.');
        },
      }),
      SmoothRoads: Object.freeze({ default: true, get description() { return t('mods.roadsHazelnut.SmoothRoads.description', 'Lightly smooths road surfaces. Turn it off for slightly better performance.'); } }),
      RiversAndStreams: Object.freeze({ default: false, get description() { return t('mods.roadsHazelnut.RiversAndStreams.description', 'Draws rivers and streams on the land.'); } }),
    }),
  }),
  // WOD1: WORLD OF DAGGERFALL 2.0 (Kamer). No modsettings of its own -
  // `Enabled` alone (DFU enables a mod by listing it), the Meaner
  // Monsters precedent. Read once, at the world's mount: the loader's
  // instance list is built for the life of the world (LocationLoader.cs
  // hangs it off the Start state), so a flip reaches the next world.
  'world-of-daggerfall': Object.freeze({
    title: 'World of Daggerfall',
    author: 'Kamer',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        get description() {
          return t('mods.worldOfDaggerfall.Enabled.description', 'More to find in the wilderness: bandit camps and forts, ruins, shrines, mountains and rock fields '
            + 'across the Iliac Bay, with bandits, bears and treasure, and a camp outside Privateer’s Hold.');
        },
      }),
      // WOD-PEAKS (2026-10-09, the owner of the pyramid massifs in the Wrothgarian Mountains: "i actually would prefer
      // [them removed everywhere] BUT can you place more rounded not SUPER HUGE mountains?"): the port's own switch, off -
      // the mod's Mountains layouts are ARCH3D pebbles stretched by hundreds and thousands into faceted spires up to 1.4 km
      // tall (world/worldOfDaggerfall/wodRockUv.js). The rounded mountains the land stands instead are the landforms' (world/landforms.js
      // LANDFORM8). Online the room's (onlineLane.js): the layouts level the ground and stand collidable rock.
      Mountains: Object.freeze({
        default: false,
        description: 'Adds the mod’s mountains: giant, sharp rock spires. Off, the land has rounded mountains instead.',
      }),
    }),
  }),
  // AS1 (2026-09-25): AQUATIC SPRITES 1.0 (Cliffworms). No modsettings of
  // its own - three world-data blocks, so one switch: the port's Enabled,
  // the gate DFU's mod list is (a mod that is off is a mod DFU never
  // loaded; scenes/modWorldData.js reads it at the door).
  'aquatic-sprites': Object.freeze({
    title: 'Aquatic Sprites',
    author: 'Cliffworms',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        get description() {
          return t('mods.aquaticSprites.Enabled.description', 'Seaweed, coral and shells in 3 flooded dungeon areas. The original game has these sprites but '
            + 'never uses them.');
        },
      }),
    }),
  }),
  // DS1 (2026-09-25): DETAILED SHIPS 1.0.0 (Cliffworms). No modsettings of
  // its own - two building records and thirteen pictures - so one switch.
  'detailed-ships': Object.freeze({
    title: 'Detailed Ships',
    author: 'Cliffworms',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        get description() {
          return t('mods.detailedShips.Enabled.description', 'Your ship, rebuilt inside and out. Outside: rigging, crates and barrels, a small boat, a rudder and '
            + 'railings. Below deck: quarters for you and the crew, a kitchen, a cargo hold, an armory, a shrine to '
            + 'Kynareth, and sailors to talk to.');
        },
      }),
    }),
  }),
  // WD3 (2026-10-01): BEAUTIFUL VILLAGES OF DAGGERFALL 1.4.2 and BEAUTIFUL
  // CITIES OF DAGGERFALL 0.5.0 (carademono). No modsettings of their own -
  // 7,317 and 410 places laid out again, their blocks with them - so one
  // switch each: the port's Enabled, read once when the game loads
  // (scenes/modWorldData.js latches it - a town never moves under the
  // player), online the room's (systems/online/onlineLane.js).
  'beautiful-villages': Object.freeze({
    title: 'Beautiful Villages of Daggerfall',
    author: 'carademono',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        description: 'Villages, hamlets, farms, manors and temples get new layouts, and roadside taverns are rebuilt. '
          + 'A town where you own a house, rent a room or have a quest building stays as you found it.',
      }),
    }),
  }),
  'beautiful-cities': Object.freeze({
    title: 'Beautiful Cities of Daggerfall',
    author: 'carademono',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        description: 'Cities get new layouts, with new districts, walls, gates, markets and docks. A city where you '
          + 'own a house, rent a room or have a quest building stays as you found it.',
      }),
    }),
  }),
  // WA1 (2026-09-25): WARM ASHES - SHIPS 1.1 (Kamer). No modsettings of its
  // own - a travel hook, a quest action and six world-data variants - so
  // one switch.
  'warm-ashes-ships': Object.freeze({
    title: 'Warm Ashes - Ships',
    author: 'Kamer',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        get description() {
          return t('mods.warmAshesShips.Enabled.description', 'When you travel by ship, 1 trip in 4 is attacked by pirates. You fight them on deck beside your crew, '
            + 'on a borrowed ship if you don’t own one, then land where you were going.');
        },
      }),
    }),
  }),
  // RAID1 (2026-09-27): WORLD EVENTS - RAIDING PARTIES 1.1 (Kamer, made for
  // this port). No modsettings of its own - one script - so one switch.
  'world-events-raiding-parties': Object.freeze({
    title: 'World Events - Raiding Parties',
    author: 'Kamer',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        get description() {
          return t('mods.worldEventsRaidingParties.Enabled.description', 'Knights, bandits or orcs raid towns across the Bay for 2 hours at a time, and the town guard fights '
            + 'beside you. Beat 15 to 25 raiders to free the town and raise your standing in the region. Online, '
            + 'everyone in town fights the same raid.');
        },
      }),
    }),
  }),
  // FORAGE1 (2026-09-28): FORAGING 1.7 (Harbinger451). No modsettings of
  // its own - six tools, five foods, a quest pack - so one switch.
  'foraging': Object.freeze({
    title: 'Foraging',
    author: 'Harbinger451',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        get description() {
          return t('mods.foraging.Enabled.description', 'Gather in the wilderness: chop wood with a Wood-Axe, mine gems and metals with a Pick-Axe, cut '
            + 'plants with a Sickle, rob graves with a Spade, fish with a Fishing-Net and forage for food with a '
            + 'Basket. You gather by day, away from towns and enemies, and your attributes, the climate and the '
            + 'season decide what you find.');
        },
      }),
    }),
  }),
  // DW-A (2026-09-25): ILIAC PUDDLE NO MORE 1.2.2 (jet082). Its one section,
  // General, restated flat with the section in front of each name (the
  // Immersive Footsteps convention), in the shipped order with the shipped
  // defaults, ranges and descriptions - the typo in "Spawn underwate
  // enemies" is the mod's own. Plus the port's `Enabled` (MO1: on). The
  // steppers are the Mods pane's: a metre for the depth, a twentieth on
  // the 0..1 sliders, a quarter on the swim multiplier (its floor).
  'iliac-puddle-no-more': Object.freeze({
    title: 'Iliac Puddle No More',
    author: 'jet082',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        get description() {
          return t('mods.iliacPuddleNoMore.Enabled.description', 'A real sea: the seafloor drops away from every coast to as deep as 250 meters. Swim in open water '
            + 'with a breath meter among fish, weed, coral, shipwrecks, sunken loot and whatever lives in the deep.');
        },
      }),
      'General.WaterDepth': Object.freeze({ default: 250.0, min: 5.0, max: 250.0, float: true, step: 1, get description() { return t('mods.iliacPuddleNoMore.General.WaterDepth.description', 'Maximum water depth'); } }),
      'General.SpawnWaterSurfaces': Object.freeze({ default: true, get description() { return t('mods.iliacPuddleNoMore.General.SpawnWaterSurfaces.description', 'Show the water surface'); } }),
      'General.SpawnUnderwaterEnemies': Object.freeze({ default: true, get description() { return t('mods.iliacPuddleNoMore.General.SpawnUnderwaterEnemies.description', 'Spawn underwater enemies'); } }),
      'General.EnemyFrequency': Object.freeze({ default: 0.3, min: 0.0, max: 1.0, float: true, step: 0.05, get description() { return t('mods.iliacPuddleNoMore.General.EnemyFrequency.description', 'Enemy frequency rate'); } }),
      // SEA-CAP (2026-09-26, SquidKamer: "puddle no more is too aggressive ... it summoned an army of everything"; Mac:
      // "Yes, cap at 32"): THE PORT'S DEFAULT IS 32, not the 128 the mod ships (vendor modsettings.json). The pulse
      // fills every sea pixel within 200 m of an outdoor player from nothing to the cap in about two seconds, each foe
      // hostile and told where the player is, and in a browser a hundred and twenty-eight of them is a crowd the AI
      // cannot carry. The range is the mod's own - a player offline may still raise it to 256. Ledger A.
      'General.MaxLiveEnemies': Object.freeze({ default: 32, min: 0, max: 256, get description() { return t('mods.iliacPuddleNoMore.General.MaxLiveEnemies.description', 'Maximum underwater enemies at once'); } }),
      'General.PassiveFishFrequency': Object.freeze({ default: 0.8, min: 0.0, max: 1.0, float: true, step: 0.05, get description() { return t('mods.iliacPuddleNoMore.General.PassiveFishFrequency.description', 'Fish frequency rate'); } }),
      'General.MaxLiveFish': Object.freeze({ default: 720, min: 0, max: 1080, get description() { return t('mods.iliacPuddleNoMore.General.MaxLiveFish.description', 'Maximum fish at once'); } }),
      'General.SpawnUnderwaterDecorations': Object.freeze({ default: true, get description() { return t('mods.iliacPuddleNoMore.General.SpawnUnderwaterDecorations.description', 'Decorate the seafloor'); } }),
      'General.DecorationPopulateRadius': Object.freeze({ default: 2, min: 1, max: 3, get description() { return t('mods.iliacPuddleNoMore.General.DecorationPopulateRadius.description', 'How far from you the seafloor is decorated, in map squares. At 3 nothing pops in'); } }),
      'General.DecorationFrequency': Object.freeze({ default: 0.3, min: 0.0, max: 1.0, float: true, step: 0.05, get description() { return t('mods.iliacPuddleNoMore.General.DecorationFrequency.description', 'Decoration rate'); } }),
      'General.MaxDecorationsPerTile': Object.freeze({ default: 1080, min: 64, max: 2160, get description() { return t('mods.iliacPuddleNoMore.General.MaxDecorationsPerTile.description', 'Maximum decorations per map square. Lower runs faster'); } }),
      'General.SeafloorLootRate': Object.freeze({ default: 0.5, min: 0.0, max: 1.0, float: true, step: 0.05, get description() { return t('mods.iliacPuddleNoMore.General.SeafloorLootRate.description', 'Random loot rate'); } }),
      'General.MaxLiveLootObjects': Object.freeze({ default: 192, min: 0, max: 256, get description() { return t('mods.iliacPuddleNoMore.General.MaxLiveLootObjects.description', 'Maximum loose loot at once'); } }),
      'General.TreasureClusterRate': Object.freeze({ default: 0.3, min: 0.0, max: 1.0, float: true, step: 0.05, get description() { return t('mods.iliacPuddleNoMore.General.TreasureClusterRate.description', 'Wreckage treasure rate'); } }),
      'General.MaxLiveTreasureClusters': Object.freeze({ default: 12, min: 0, max: 32, get description() { return t('mods.iliacPuddleNoMore.General.MaxLiveTreasureClusters.description', 'Maximum wrecks'); } }),
      'General.TreasureCove': Object.freeze({ default: false, get description() { return t('mods.iliacPuddleNoMore.General.TreasureCove.description', 'More and better loot'); } }),
      'General.WaterSurfaceTopTransparency': Object.freeze({ default: 0.7, min: 0.0, max: 1.0, float: true, step: 0.05, get description() { return t('mods.iliacPuddleNoMore.General.WaterSurfaceTopTransparency.description', 'Water surface transparency from above'); } }),
      'General.WaterSurfaceBottomTransparency': Object.freeze({ default: 0.2, min: 0.0, max: 1.0, float: true, step: 0.05, get description() { return t('mods.iliacPuddleNoMore.General.WaterSurfaceBottomTransparency.description', 'Water surface transparency from below'); } }),
      'General.DarkerSurfaceWater': Object.freeze({ default: 0.0, min: 0.0, max: 1.0, float: true, step: 0.05, get description() { return t('mods.iliacPuddleNoMore.General.DarkerSurfaceWater.description', 'Darker surface water tint'); } }),
      'General.UnderwaterFogStrength': Object.freeze({ default: 0.5, min: 0.0, max: 1.0, float: true, step: 0.05, get description() { return t('mods.iliacPuddleNoMore.General.UnderwaterFogStrength.description', 'Underwater fog strength'); } }),
      'General.UnderwaterFogDistance': Object.freeze({ default: 0.3, min: 0.0, max: 1.0, float: true, step: 0.05, get description() { return t('mods.iliacPuddleNoMore.General.UnderwaterFogDistance.description', 'Underwater fog view distance'); } }),
      'General.SwimSpeedMultiplier': Object.freeze({ default: 1.0, min: 0.25, max: 30.0, float: true, step: 0.25, get description() { return t('mods.iliacPuddleNoMore.General.SwimSpeedMultiplier.description', 'Multiplies your swimming speed outdoors'); } }),
      'General.EnableSwimStroke': Object.freeze({ default: true, get description() { return t('mods.iliacPuddleNoMore.General.EnableSwimStroke.description', 'Press Run while swimming for a burst of speed'); } }),
      'General.ArgonianInfiniteBreath': Object.freeze({ default: true, get description() { return t('mods.iliacPuddleNoMore.General.ArgonianInfiniteBreath.description', 'Argonians never drown'); } }),
    }),
  }),
  // OH-A (2026-09-26): THERE'S A HOLE IN THE BOTTOM OF THE OCEAN 1.1.0
  // (jet082). Listed AFTER Iliac Puddle No More, its one non-optional
  // dependency (DFU Awakes a dependency first). Its one section, General,
  // restated flat in the shipped order with the shipped defaults, ranges
  // and descriptions - seven 0..1 sliders, a twentieth a step - plus the
  // port's `Enabled` (MO1: on). With the sea's own switch off it has no
  // sea to open (oceanHoles.js reads that switch, as DFU asks ModManager).
  'ocean-holes': Object.freeze({
    title: 'There’s a Hole in the Bottom of the Ocean',
    author: 'jet082',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        get description() {
          return t('mods.oceanHoles.Enabled.description', 'Blue holes in the deep sea lead down to flooded dungeons with better loot. About 1 open-sea square '
            + 'in 48 has one: a black hole in the seafloor under a cloud of dark mist. Needs Iliac Puddle '
            + 'No More.');
        },
      }),
      'General.PitSpawnRate': Object.freeze({ default: 0.5, min: 0.0, max: 1.0, float: true, step: 0.05, get description() { return t('mods.oceanHoles.General.PitSpawnRate.description', 'How many blue holes there are: none at 0, 1 square in 48 at the middle, 1 in 24 at most'); } }),
      'General.SurfaceHoleSize': Object.freeze({ default: 0.5, min: 0.0, max: 1.0, float: true, step: 0.05, get description() { return t('mods.oceanHoles.General.SurfaceHoleSize.description', 'Surface hole size'); } }),
      'General.SeafloorHoleSize': Object.freeze({ default: 0.5, min: 0.0, max: 1.0, float: true, step: 0.05, get description() { return t('mods.oceanHoles.General.SeafloorHoleSize.description', 'Sea floor hole size'); } }),
      'General.MiasmaParticleCount': Object.freeze({ default: 0.5, min: 0.0, max: 1.0, float: true, step: 0.05, get description() { return t('mods.oceanHoles.General.MiasmaParticleCount.description', 'Amount of mist over a hole'); } }),
      'General.MiasmaHeight': Object.freeze({ default: 0.5, min: 0.0, max: 1.0, float: true, step: 0.05, get description() { return t('mods.oceanHoles.General.MiasmaHeight.description', 'Height of the mist over a hole'); } }),
      'General.DungeonVisualIntensity': Object.freeze({ default: 0.5, min: 0.0, max: 1.0, float: true, step: 0.05, get description() { return t('mods.oceanHoles.General.DungeonVisualIntensity.description', 'Underwater dungeon fog intensity'); } }),
      'General.DungeonVisualDarkness': Object.freeze({ default: 0.5, min: 0.0, max: 1.0, float: true, step: 0.05, get description() { return t('mods.oceanHoles.General.DungeonVisualDarkness.description', 'How dark the fog and light are in flooded dungeons'); } }),
    }),
  }),
  // CSA-A (2026-09-27): COME SAIL AWAY 2.1 (RedRoryOTheGlen). Its ten
  // sections as the shipped modsettings.json carries them, section and
  // name joined with a dot, the shipped defaults and ranges; the four
  // unnamed spacer sections ("---", "----", "-", "--") carry no keys and
  // fall between Controls and WindDirectionWidget, Waves and Cargo, Cargo
  // and Audio, Audio and Handling. The mod wrote six descriptions
  // (PortLocationSearchRange and five of Map's) and they are the pane's;
  // the rest are the port's, each saying what ComeSailAway.LoadSettings
  // does with the key. THREE KEYS THE ASSEMBLY NEVER READS - LoadSettings
  // takes no Handling.BadTack, no Handling.BadTackMultiplier and no
  // SailingAssist.AutoStowGaffSails, and nothing else in it does - are
  // declared as shipped, so a player's file keeps them, and do nothing,
  // as in DFU. The nine Controls keys are Unity KeyCode names (`text`);
  // each becomes a registry action (systems/inputActions.js MOD_ACTIONS)
  // with the slice that reads it. Plus the port's `Enabled` (MO1: on).
  'come-sail-away': Object.freeze({
    title: 'Come Sail Away',
    author: 'RedRoryOTheGlen',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        get description() {
          return t('mods.comeSailAway.Enabled.description', 'Own and sail a boat. Buy parts or a deed at a shipyard, put it in the water (a deed works only near a port) '
            + 'and take the helm to row, or raise the sails and trim them to the wind. Pack it up to take with you. '
            + 'It holds what you and your cart carry and shows on the travel map.');
        },
      }),
      'Controls.Disembark': Object.freeze({ default: 'C', text: true, get description() { return t('mods.comeSailAway.Controls.Disembark.description', 'Leave the helm (the Transport key does too).'); } }),   // CSA-D / KB1: not read by the mod any more - the key is the registry's action (inputActions.js MOD_ACTIONS); a player's saved value is carried there once (migrateKeyBinds)
      'Controls.ToggleSail': Object.freeze({ default: 'Space', text: true, get description() { return t('mods.comeSailAway.Controls.ToggleSail.description', 'Raise or stow the sails at the helm.'); } }),   // CSA-E / KB1: not read by the mod any more - the key is the registry's action (inputActions.js MOD_ACTIONS); a player's saved value is carried there once (migrateKeyBinds)
      'Controls.ToggleLight': Object.freeze({ default: 'Period', text: true, get description() { return t('mods.comeSailAway.Controls.ToggleLight.description', 'Light or douse the boat’s lanterns at the helm.'); } }),   // CSA-D / KB1: not read by the mod any more - the key is the registry's action (inputActions.js MOD_ACTIONS); a player's saved value is carried there once (migrateKeyBinds)
      'Controls.IncreaseTimeScale': Object.freeze({ default: 'KeypadPlus', text: true, get description() { return t('mods.comeSailAway.Controls.IncreaseTimeScale.description', 'Speed time up at the helm.'); } }),
      'Controls.DecreaseTimeScale': Object.freeze({ default: 'KeypadMinus', text: true, get description() { return t('mods.comeSailAway.Controls.DecreaseTimeScale.description', 'Slow time back down at the helm.'); } }),
      'Controls.ResetTimeScale': Object.freeze({ default: 'KeypadEnter', text: true, get description() { return t('mods.comeSailAway.Controls.ResetTimeScale.description', 'Return time to normal speed at the helm.'); } }),
      'Controls.TrimRight': Object.freeze({ default: 'RightBracket', text: true, get description() { return t('mods.comeSailAway.Controls.TrimRight.description', 'Hold to trim the sails to the right (with Sailing Assist’s auto trimming off).'); } }),   // CSA-E / KB1: not read by the mod any more - the key is the registry's action (inputActions.js MOD_ACTIONS); a player's saved value is carried there once (migrateKeyBinds)
      'Controls.TrimLeft': Object.freeze({ default: 'LeftBracket', text: true, get description() { return t('mods.comeSailAway.Controls.TrimLeft.description', 'Hold to trim the sails to the left (with Sailing Assist’s auto trimming off).'); } }),   // CSA-E / KB1: not read by the mod any more - the key is the registry's action (inputActions.js MOD_ACTIONS); a player's saved value is carried there once (migrateKeyBinds)
      'Controls.TrimModifier': Object.freeze({ default: 'Backslash', text: true, get description() { return t('mods.comeSailAway.Controls.TrimModifier.description', 'Hold with a trim key to trim the square sails instead; hold with Toggle Sail to raise or stow the square sails alone.'); } }),   // CSA-E / KB1: not read by the mod any more - the key is the registry's action (inputActions.js MOD_ACTIONS); a player's saved value is carried there once (migrateKeyBinds)
      'Controls.PortLocationSearchRange': Object.freeze({ default: 3, min: 1, max: 10, get description() { return t('mods.comeSailAway.Controls.PortLocationSearchRange.description', 'How far from you a port can be found'); } }),
      'WindDirectionWidget.Enable': Object.freeze({ default: true, get description() { return t('mods.comeSailAway.WindDirectionWidget.Enable.description', 'Show the wind’s direction on screen at the helm.'); } }),
      'WindDirectionWidget.Position': Object.freeze({ default: Object.freeze([0.5, 0.5]), tuple: 'float', get description() { return t('mods.comeSailAway.WindDirectionWidget.Position.description', 'Where the widget sits on the screen, across and down.'); } }),
      'WindDirectionWidget.Scale': Object.freeze({ default: 1, min: 0, max: 2, float: true, get description() { return t('mods.comeSailAway.WindDirectionWidget.Scale.description', 'The widget’s size.'); } }),
      'WindDirectionWidget.ScalingMode': Object.freeze({ default: 0, options: lazyWords(() => t('mods.comeSailAway.option.doNotScale', 'DoNotScale'), () => t('mods.comeSailAway.option.screenHeight', 'ScreenHeight'), () => t('mods.comeSailAway.option.screenDimensions', 'ScreenDimensions')), get description() { return t('mods.comeSailAway.WindDirectionWidget.ScalingMode.description', 'Whether the widget grows with the screen.'); } }),
      'WindDirectionWidget.Color': Object.freeze({ default: '#ffffffff', color: true, get description() { return t('mods.comeSailAway.WindDirectionWidget.Color.description', 'The widget’s colour.'); } }),
      'Waves.Enable': Object.freeze({ default: true, get description() { return t('mods.comeSailAway.Waves.Enable.description', 'Draw the waves breaking along the coasts around you, and let the sea carry a boat on its current.'); } }),
      'Waves.Distance': Object.freeze({ default: 2, min: 1, max: 4, get description() { return t('mods.comeSailAway.Waves.Distance.description', 'How many map squares around you have waves, in each direction.'); } }),
      'Waves.Length': Object.freeze({ default: 1.5, min: 0, max: 2, float: true, get description() { return t('mods.comeSailAway.Waves.Length.description', 'How far out the waves reach before they end.'); } }),
      'Waves.Fade': Object.freeze({ default: 0.8, min: 0, max: 1, float: true, get description() { return t('mods.comeSailAway.Waves.Fade.description', 'Where along their reach the waves start to fade.'); } }),
      'Waves.Speed': Object.freeze({ default: 100, min: 0, max: 200, get description() { return t('mods.comeSailAway.Waves.Speed.description', 'How fast the waves move: under 100 is half speed, 100 to 199 is normal, and 200 is fastest.'); } }),
      'Cargo.CargoThreshold': Object.freeze({ default: 500, min: 0, max: 2000, get description() { return t('mods.comeSailAway.Cargo.CargoThreshold.description', 'The weight a boat carries before it slows.'); } }),
      'Cargo.PlayerCarriedWeight': Object.freeze({ default: true, get description() { return t('mods.comeSailAway.Cargo.PlayerCarriedWeight.description', 'Count what you carry as cargo.'); } }),
      'Cargo.CartCarriedWeight': Object.freeze({ default: true, get description() { return t('mods.comeSailAway.Cargo.CartCarriedWeight.description', 'Count what your cart carries as cargo.'); } }),
      'Cargo.PlayerWeight': Object.freeze({ default: true, get description() { return t('mods.comeSailAway.Cargo.PlayerWeight.description', 'Count your own weight as cargo.'); } }),
      'Cargo.CartItem': Object.freeze({ default: false, get description() { return t('mods.comeSailAway.Cargo.CartItem.description', 'Count the cart itself as cargo.'); } }),
      'Cargo.HorseItem': Object.freeze({ default: false, get description() { return t('mods.comeSailAway.Cargo.HorseItem.description', 'Count the horse itself as cargo.'); } }),
      'Audio.SoundVolume': Object.freeze({ default: 0.5, min: 0, max: 1, float: true, get description() { return t('mods.comeSailAway.Audio.SoundVolume.description', 'Volume of the boat’s sounds: the hull, the oars and the sea.'); } }),
      'Handling.OarMoveSpeed': Object.freeze({ default: 1, min: 0, max: 10, float: true, get description() { return t('mods.comeSailAway.Handling.OarMoveSpeed.description', 'Top speed under oars.'); } }),
      'Handling.OarMoveAcceleration': Object.freeze({ default: 1, min: 0, max: 10, float: true, get description() { return t('mods.comeSailAway.Handling.OarMoveAcceleration.description', 'How quickly you reach top speed under oars.'); } }),
      'Handling.OarTurnSpeed': Object.freeze({ default: 1, min: 0, max: 10, float: true, get description() { return t('mods.comeSailAway.Handling.OarTurnSpeed.description', 'Top turning speed under oars.'); } }),
      'Handling.OarTurnAcceleration': Object.freeze({ default: 1, min: 0, max: 10, float: true, get description() { return t('mods.comeSailAway.Handling.OarTurnAcceleration.description', 'How quickly the oars turn the boat.'); } }),
      'Handling.SailMoveSpeed': Object.freeze({ default: 1, min: 0, max: 10, float: true, get description() { return t('mods.comeSailAway.Handling.SailMoveSpeed.description', 'Top speed under sail.'); } }),
      'Handling.SailMoveAcceleration': Object.freeze({ default: 1, min: 0, max: 10, float: true, get description() { return t('mods.comeSailAway.Handling.SailMoveAcceleration.description', 'How quickly you reach top speed under sail.'); } }),
      'Handling.SailTurnSpeed': Object.freeze({ default: 1, min: 0, max: 10, float: true, get description() { return t('mods.comeSailAway.Handling.SailTurnSpeed.description', 'Top turning speed under sail.'); } }),
      'Handling.SailTurnAcceleration': Object.freeze({ default: 1, min: 0, max: 10, float: true, get description() { return t('mods.comeSailAway.Handling.SailTurnAcceleration.description', 'How quickly the sails turn the boat.'); } }),
      'Handling.BadTack': Object.freeze({ default: false, get description() { return t('mods.comeSailAway.unread.description', 'Has no effect: the mod never uses this setting.'); } }),
      'Handling.BadTackMultiplier': Object.freeze({ default: 0.8, min: 0, max: 1, float: true, get description() { return t('mods.comeSailAway.unread.description', 'Has no effect: the mod never uses this setting.'); } }),
      'SailingAssist.AutoTrimming': Object.freeze({ default: true, get description() { return t('mods.comeSailAway.SailingAssist.AutoTrimming.description', 'Trim the sails to the wind for you.'); } }),
      'SailingAssist.AutoStowSquareSails': Object.freeze({ default: true, get description() { return t('mods.comeSailAway.SailingAssist.AutoStowSquareSails.description', 'Stow the square sails for you when you head into the wind.'); } }),
      'SailingAssist.AutoStowGaffSails': Object.freeze({ default: true, get description() { return t('mods.comeSailAway.unread.description', 'Has no effect: the mod never uses this setting.'); } }),
      'Compatibility.AnimatedWaterVertexWaves': Object.freeze({ default: false, get description() { return t('mods.comeSailAway.Compatibility.AnimatedWaterVertexWaves.description', 'Has no effect here: Animated Water isn’t included, so the mod’s own waves are always drawn.'); } }),
      // KEEP-BOATS (2026-09-30, Mac: ship ownership "less punishing" - "Keep boats & cargo"): A DEPARTURE FROM THE
      // MOD'S SHIPPED DEFAULT. The mod ships it off, and off a boat placed in a dungeon was destroyed once the player
      // was back outside - a packable one and its hold for good, a crewed one's hold with it (UpdateBoatVisibility).
      // The port ships it ON; the switch stays the player's. Pinned: test/systems/csa_registration.test.js DEPARTED.
      'Compatibility.PersistentDungeonBoats': Object.freeze({ default: true, get description() { return t('mods.comeSailAway.Compatibility.PersistentDungeonBoats.description', 'Keeps a boat you placed indoors or underground when you leave it. Off, the boat is gone once you’re back outside.'); } }),
      'Map.RestrictPositionReadingTime': Object.freeze({ default: true, get description() { return t('mods.comeSailAway.Map.RestrictPositionReadingTime.description', 'Position can only be viewed around midday and midnight'); } }),
      'Map.RestrictPositionReadingWeather': Object.freeze({ default: true, get description() { return t('mods.comeSailAway.Map.RestrictPositionReadingWeather.description', 'Position can only be viewed in Sunny or Cloudy weather'); } }),
      'Map.ClickRangeThreshold': Object.freeze({ default: 5, min: 1, max: 10, get description() { return t('mods.comeSailAway.Map.ClickRangeThreshold.description', 'How near the pointer must come to a marker on the position reading, in map pixels, to name it or pick it.'); } }),
      'Map.PositionLineThickness': Object.freeze({ default: 2, min: 0, max: 5, get description() { return t('mods.comeSailAway.Map.PositionLineThickness.description', 'Additional pixels on each side of the position line'); } }),
      'Map.MarkerThickness': Object.freeze({ default: 2, min: 1, max: 5, get description() { return t('mods.comeSailAway.Map.MarkerThickness.description', 'Additional pixels around the map marker'); } }),
      'Map.MarkerOutlineThickness': Object.freeze({ default: 2, min: 0, max: 5, get description() { return t('mods.comeSailAway.Map.MarkerOutlineThickness.description', 'Thickness of the marker outline in pixels'); } }),
      'Map.BackdropOpacity': Object.freeze({ default: 50, min: 0, max: 100, get description() { return t('mods.comeSailAway.Map.BackdropOpacity.description', 'How dark the screen behind the position reading is, in percent.'); } }),
      'Debug.ShowValues': Object.freeze({ default: false, get description() { return t('mods.comeSailAway.Debug.ShowValues.description', 'Shows the boat’s speed, the speed it’s heading for and the wind’s strength on screen.'); } }),
    }),
  }),
  // MM1: MEANER MONSTERS 1.5.2 (Ralzar). No modsettings of its own -
  // `Enabled` alone (DFU enables a mod by listing it). Listed BEFORE
  // the overhaul because the overhaul names it as a dependency and so
  // Awakes after it in DFU.
  'meanerMonsters': Object.freeze({
    title: 'Meaner Monsters',
    author: 'Ralzar',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        get description() {
          return t('mods.meanerMonsters.Enabled.description', 'Many monsters hit harder and take more to kill, while rats, bats and zombies are weaker. 20 monsters '
            + 'are changed, and werebeasts and the dragonling are bigger. With Physical Combat And Armor Overhaul '
            + 'also on, that mod’s version of these changes is used. With Daggerfall Enemy Expansion on, MUDEX, the '
            + 'author’s version made for it, is used instead.');
        },
      }),
    }),
  }),
  // PCO1: PHYSICAL COMBAT AND ARMOR OVERHAUL 1.44 (Kirk.O). Its seven
  // Modules keys, names and descriptions as modsettings.json ships them
  // (all seven on, as shipped), plus the port's `Enabled` (DFU enables
  // a mod by listing it). MM1 (Mac: "there shouldn't be compatibility
  // switches between mods"): the two arms DFU derives from OTHER mods
  // being loaded - Roleplay Realism's advancedArchery and the presence
  // of Meaner Monsters - are no longer switches here; combat/pcaao.js
  // reads the other mod's own switch, as DFU asks ModManager.
  'pcaao': Object.freeze({
    title: 'Physical Combat And Armor Overhaul',
    author: 'Kirk.O',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        get description() {
          return t('mods.pcaao.Enabled.description', 'Armour reduces the damage you take instead of your chance to be hit, your skills decide whether you '
            + 'hit, shields block according to their material, and critical hits multiply '
            + 'damage. Off uses Daggerfall Unity’s combat.');
        },
      }),
      // WEAR-VANILLA (2026-10-01, the repair triage: "Disable the modded feature that increases durability loss.
      // Vanilla values work fine"): the mod ships its two wear modules ON, the port ships them OFF - a blow wears gear
      // at Daggerfall Unity's own rate (combat/formulas.js damageEquipment) and a broken enchanted piece stays,
      // repairable. Online the room reads these defaults (onlineLane.js ONLINE_WHOLE_MODS); offline they stay the
      // player's. A value saved under the old default is let go once (SWITCH_RESETS). Port-Ledger, WEAR-VANILLA.
      equipmentDamageEnhanced: Object.freeze({ default: false, get description() { return t('mods.pcaao.equipmentDamageEnhanced.description', 'Your equipment wears out much faster, depending on its material, what hit it and more.'); } }),
      fadingEnchantedItems: Object.freeze({ default: false, get description() { return t('mods.pcaao.fadingEnchantedItems.description', 'Enchanted weapons and armor are destroyed when they break in combat. Needs Equipment Damage Enhanced.'); } }),
      fixedStrengthDamageModifier: Object.freeze({ default: true, get description() { return t('mods.pcaao.fixedStrengthDamageModifier.description', 'Strength adds 1 damage per 10 points, as in the classic game, instead of 2.'); } }),
      armorHitFormulaRedone: Object.freeze({ default: true, get description() { return t('mods.pcaao.armorHitFormulaRedone.description', 'Armor reduces the damage you take instead of making you harder to hit.'); } }),
      criticalStrikesIncreaseDamage: Object.freeze({ default: true, get description() { return t('mods.pcaao.criticalStrikesIncreaseDamage.description', 'Critical strikes raise your damage as well as your chance to hit. Needs Armor Hit Formula Redone.'); } }),
      conditionBasedEffectiveness: Object.freeze({ default: true, get description() { return t('mods.pcaao.conditionBasedEffectiveness.description', 'Worn weapons and armor work less well. Needs Armor Hit Formula Redone.'); } }),
      softMaterialRequirements: Object.freeze({ default: true, get description() { return t('mods.pcaao.softMaterialRequirements.description', 'Weapons below the material an enemy needs can still hurt it, at a large damage penalty. Needs Armor Hit Formula Redone.'); } }),
    }),
  }),
  // UL1: UNLEVELED LOOT 1.1.2 (Ralzar). Its one section, MaterialSwitching,
  // ten MultipleChoiceKeys named for the ten materials, each defaulting
  // to itself, as modsettings.json ships them, plus the port's `Enabled`.
  // Listed AFTER the overhaul: its manifest orders it after Roleplay
  // Realism, and its two overrides register last.
  'unleveledLoot': Object.freeze({
    title: 'Unleveled Loot',
    author: 'Ralzar',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        get description() {
          return t('mods.unleveledLoot.Enabled.description', 'Loot and shop stock no longer scale with your level. What materials drop depends on your luck, the '
            + 'shop’s quality and the type of dungeon, and the gold you find follows your luck. Off uses Daggerfall '
            + 'Unity’s rolls.');
        },
      }),
      ...Object.fromEntries(['Iron', 'Steel', 'Silver', 'Elven', 'Dwarven', 'Mithril', 'Adamantium', 'Ebony', 'Orcish', 'Daedric'].map((name, i) => [name, Object.freeze({
        default: i,
        // L10N4: the names are Daggerfall's own materials, DFU's keys; the key names in front stay the mod's
        options: lazyWords(() => localizedText('iron', 'Iron'), () => localizedText('steel', 'Steel'), () => localizedText('silver', 'Silver'),
          () => localizedText('elven', 'Elven'), () => localizedText('dwarven', 'Dwarven'), () => localizedText('mithril', 'Mithril'),
          () => localizedText('adamantium', 'Adamantium'), () => localizedText('ebony', 'Ebony'), () => localizedText('orcish', 'Orcish'),
          () => localizedText('daedric', 'Daedric')),
        get description() { return t('mods.unleveledLoot.MaterialSwitching.description', 'Whenever this material would drop, change it to the selected material.'); },
      })])),
    }),
  }),
  // WW1 (2026-09-14, Mac: "This is our next mod I want to add 1:1 while
  // also having it work with morrowind's first person view"): WEAPON
  // WIDGET 1.6 (RedRoryOTheGlen). Its nine sections as modsettings.json
  // ships them - Modules' nine toggles, then each module's own knobs -
  // the key named section-dot-name because four names repeat across
  // sections (Speed, Length, Offset, Condition). A key with `float`
  // is a SliderFloatKey and reads as a number on its range; `step` is
  // the Mods pane's stepper for it. Descriptions are the mod's own where
  // it wrote one. Plus the port's `Enabled` (MO1: on).
  // SW1 (2026-09-19) - SHIELD WIDGET 1.6, RedRoryOTheGlen. The mod's own
  // eight sections restated flat, section and name joined with a dot, in
  // the bundle's own order with the bundle's own defaults, ranges and
  // descriptions. The six keys the mod ships with no description carry
  // the port's words instead. Plus the port's `Enabled` (MO1: on).
  // DW1: Diverse Weapons 1.7.3 (RealAKP) ships no settings of its own -
  // its one script sets FPSWeapon.moddedWeaponHUDAnimsEnabled and stops
  // (vendor/diverse-weapons/DiverseWeaponsMain.cs:37). `Enabled` IS that
  // flag. The second key is the port's rendering of the mod's readme -
  // "For Weapon Widget users, select Diverse Weapons settings preset in
  // Weapon Widget mod options": the preset the bundle carries
  // (vendor/diverse-weapons/weapon-widget-preset.json) is laid over the
  // player's Weapon Widget settings while this is on, and their own
  // values are untouched underneath, where DFU's preset picker would
  // have overwritten them. Off by default, as a preset nobody has
  // selected is; the readme says select it, so the switch says so too.
  'diverse-weapons': Object.freeze({
    title: 'Diverse Weapons',
    author: 'RealAKP',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        get description() {
          return t('mods.diverseWeapons.Enabled.description', 'A different first-person look for every weapon in every metal, plain and enchanted, instead of one '
            + 'per weapon type. A longsword no longer looks like a broadsword. A newer version added under Your own '
            + 'textures replaces the built-in one.');
        },
      }),
      WeaponWidgetPreset: Object.freeze({
        default: false,   // DISC16-B (2026-09-24, Mac: "I just want it how it was before diverse weapons"): OFF, as at DW1 - the mod's sprites move with Weapon Widget's own defaults, as every weapon did before the mod; the preset (its step, inertia, true size and 142 bob) is the player's to choose. DW-CLIP ("mod should be defaulted on") had it on, DISC14-B off with two departures of its own
        get description() {
          return t('mods.diverseWeapons.WeaponWidgetPreset.description', 'Uses Diverse Weapons’ own Weapon Widget settings while on: larger idle poses, inertia, recoil and '
            + 'its own bob. Your Weapon Widget settings come back when you turn this off.');
        },
      }),
    }),
  }),
  // RRI1: Roleplay & Realism: Items 1.3 (Hazelnut & Ralzar) - eleven
  // modules, each a bool in the mod's [Modules] section, the mod's own
  // words. `Enabled` is the mod being loaded at all: the fourteen custom
  // items and the twenty template patches ride it.
  'roleplay-realism-items': Object.freeze({
    title: 'Roleplay & Realism: Items',
    author: 'Hazelnut & Ralzar',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        get description() {
          return t('mods.roleplayRealismItems.Enabled.description', 'Adds 2 new weapons and light and medium armor sets in every metal, and changes what items weigh and '
            + 'cost.');
        },
      }),
      lootRebalance: Object.freeze({ default: true, get description() { return t('mods.roleplayRealismItems.lootRebalance.description', 'Rebalances loot on mobs and in piles'); } }),
      bandaging: Object.freeze({ default: true, get description() { return t('mods.roleplayRealismItems.bandaging.description', 'Allows bandages to stack, and to be used for healing based on medical skill'); } }),
      conditionBasedPrices: Object.freeze({ default: true, get description() { return t('mods.roleplayRealismItems.conditionBasedPrices.description', 'Item prices are based on condition and loot you find can be quite worn out'); } }),
      storeQualityItemCondition: Object.freeze({ default: true, get description() { return t('mods.roleplayRealismItems.storeQualityItemCondition.description', 'Items in shops can be in a used condition dependent on the quality of the store'); } }),
      realisticEnemyEquipment: Object.freeze({ default: true, get description() { return t('mods.roleplayRealismItems.realisticEnemyEquipment.description', 'Enemy equipment is realistic for their class and can be variable condition'); } }),
      skillBasedStartingEquipment: Object.freeze({ default: true, get description() { return t('mods.roleplayRealismItems.skillBasedStartingEquipment.description', 'Player starting equipment is based on skills'); } }),
      skillBasedStartingSpells: Object.freeze({ default: true, get description() { return t('mods.roleplayRealismItems.skillBasedStartingSpells.description', 'Player starting spells are based on skills'); } }),
      weaponBalance: Object.freeze({ default: true, get description() { return t('mods.roleplayRealismItems.weaponBalance.description', 'Balances weapon attack speed and damage ranges against weight to give more valid choices'); } }),
      newWeapons: Object.freeze({ default: true, get description() { return t('mods.roleplayRealismItems.newWeapons.description', 'Adds two new weapons to the game, Archers Axe and Light Flail'); } }),
      newArmor: Object.freeze({ default: true, get description() { return t('mods.roleplayRealismItems.newArmor.description', 'Adds new chest, arm, leg and foot armor pieces to the game'); } }),
      alchemistPotions: Object.freeze({ default: true, get description() { return t('mods.roleplayRealismItems.alchemistPotions.description', 'Adds random potions for sale at alchemist stores, for a premium price'); } }),
    }),
  }),
  'roleplay-realism': Object.freeze({
    title: 'Roleplay & Realism',
    author: 'Hazelnut',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        get description() {
          return t('mods.roleplayRealism.Enabled.description', 'Realism changes: bows by draw weight, no climbing with a weapon out, fairer swing speed and hit '
            + 'chance, bank loans by level, ships only from ports, a heavy-load '
            + 'penalty, lights out when you leave a dungeon, purification that cures poison, reworked class '
            + 'enemies, harsher guild expulsions, and beds you can click to sleep in.');
        },
      }),
      // the mod's own descriptions (modsettings.json, Modules)
      bedSleeping: Object.freeze({ default: true, get description() { return t('mods.roleplayRealism.bedSleeping.description', 'Allows sleep to be initiated by clicking on a bed.'); } }),
      advancedArchery: Object.freeze({ default: true, get description() { return t('mods.roleplayRealism.advancedArchery.description', 'Alters to-hit and damage done by arrows depending on the length of draw.'); } }),
      encumbranceEffects: Object.freeze({ default: true, get description() { return t('mods.roleplayRealism.encumbranceEffects.description', 'Provides speed and fatigue penalties when carrying too much weight.'); } }),
      bandaging: Object.freeze({ default: true, get description() { return t('mods.roleplayRealism.bandaging.description', 'Allows bandages to be used for healing based on medical skill.'); } }),
      shipPorts: Object.freeze({ default: false, get description() { return t('mods.roleplayRealism.shipPorts.description', 'Player can only board their ship when in a port town.'); } }),   // SHIP-PORTS (2026-09-23, Sir McMobdon on Discord: "cant access my boat anymore"): the mod ships this ON, the port ships it OFF - a restriction nobody chose took the boat away from every owner the day the mod landed, and the switch was nowhere a player could reach; recorded on the RR page
      underworldExpulsion: Object.freeze({ default: true, get description() { return t('mods.roleplayRealism.underworldExpulsion.description', 'Enables underworld guilds to expel members for poor performance... with prejudice.'); } }),
      climbingRestriction: Object.freeze({ default: true, get description() { return t('mods.roleplayRealism.climbingRestriction.description', 'Prevents climbing with a weapon drawn.'); } }),
      weaponSpeed: Object.freeze({ default: true, get description() { return t('mods.roleplayRealism.weaponSpeed.description', 'Lowers weapon damage per second for characters with high Speed.'); } }),
      weaponMaterials: Object.freeze({ default: true, get description() { return t('mods.roleplayRealism.weaponMaterials.description', 'Moderates the to-hit bonuses of weapon materials so skill remains key factor'); } }),
      equipDamage: Object.freeze({ default: false, get description() { return t('mods.roleplayRealism.equipDamage.description', 'Increases equipment damage proportional to max condition.'); } }),   // WEAR-VANILLA (2026-10-01): the mod ships it ON (armour x5), the port OFF - see the overhaul's wear modules above; the room's too (onlineLane.js)
      enemyAppearance: Object.freeze({ default: true, get description() { return t('mods.roleplayRealism.enemyAppearance.description', 'Remixes human enemy appearance based on class'); } }),
      purificationPotion: Object.freeze({ default: true, get description() { return t('mods.roleplayRealism.purificationPotion.description', 'Changes purification potion to cure poison rather than grant invisibility'); } }),
      autoExtinguishLight: Object.freeze({ default: true, get description() { return t('mods.roleplayRealism.autoExtinguishLight.description', 'Automatically extinguish any light sources when you exit a dungeon'); } }),
      classicStrengthDamageBonus: Object.freeze({ default: false, get description() { return t('mods.roleplayRealism.classicStrengthDamageBonus.description', 'Shows the strength damage bonus at half, as the classic game did.'); } }),
      variantNpcs: Object.freeze({ default: true, get description() { return t('mods.roleplayRealism.variantNpcs.description', 'Enable variant NPC sprites in shops & taverns'); } }),
      variantResidents: Object.freeze({ default: true, get description() { return t('mods.roleplayRealism.variantResidents.description', 'Fills 80% of houses with the townsfolk you see walking around, instead of random adventurers'); } }),
      // fightersTeachHandToHand RETIRED (FGH2H-R, 2026-09-24, Mac: "retire it") - see RETIRED_KEYS below
      loanAmountPerLevel: Object.freeze({ default: 4, options: Object.freeze(['2000', '4000', '6000', '8000', '10000', '20000', '30000', '40000', '50000']), get description() { return t('mods.roleplayRealism.loanAmountPerLevel.description', 'Sets the maximum amount per level that can be borrowed from banks'); } }),
      // EnhancedRiding (RR2)
      'EnhancedRiding.enhancedRiding': Object.freeze({ default: true, get description() { return t('mods.roleplayRealism.EnhancedRiding.enhancedRiding.description', 'Enable enhanced horse riding module, improving presentation and allowing galloping.'); } }),
      'EnhancedRiding.RealisticMovement': Object.freeze({ default: true, get description() { return t('mods.roleplayRealism.EnhancedRiding.RealisticMovement.description', 'Makes the horse and cart movement backwards and sideways more realistic and limited.'); } }),
      'EnhancedRiding.followTerrainEnabled': Object.freeze({ default: true, get description() { return t('mods.roleplayRealism.EnhancedRiding.followTerrainEnabled.description', 'Enables terrain following when riding.'); } }),
      'EnhancedRiding.followTerrainSoftenFactor': Object.freeze({ default: 8, min: 0, max: 32, get description() { return t('mods.roleplayRealism.EnhancedRiding.followTerrainSoftenFactor.description', 'How much the ride smooths out slopes, from 0 (none) to 32 (most).'); } }),
      'EnhancedRiding.GallopingInTowns': Object.freeze({ default: true, get description() { return t('mods.roleplayRealism.EnhancedRiding.GallopingInTowns.description', 'Enables galloping (sprinting) while riding horses in towns.'); } }),   // TOWN-GALLOP (2026-10-13, Mac: "Remove forced horse walking in towns"): the mod ships this OFF, the port ships it ON - off, the mod's CanRun refused the run in every town, and horse care's horse walked there with Run held (HORSE-WALK); the room's too (onlineLane.js ONLINE_WHOLE_MODS reads this default); no tile ever reached the switch (FT14), so no saved off stands to reset; TrampleCivilians, the mod's own, rides with it; recorded on the RR page
      'EnhancedRiding.TrampleCivilians': Object.freeze({ default: true, get description() { return t('mods.roleplayRealism.EnhancedRiding.TrampleCivilians.description', 'Enables the crime of trampling innocent townsfolk when galloping in a town. Be careful!'); } }),
      // RefinedTraining (RR2)
      'RefinedTraining.refinedTraining': Object.freeze({ default: true, get description() { return t('mods.roleplayRealism.RefinedTraining.refinedTraining.description', 'Enable refined skill training service.'); } }),
      'RefinedTraining.variableTrainingPrice': Object.freeze({ default: true, get description() { return t('mods.roleplayRealism.RefinedTraining.variableTrainingPrice.description', 'Makes price of training based on skill level as well as player level.'); } }),
      'RefinedTraining.intensiveTraining': Object.freeze({ default: false, get description() { return t('mods.roleplayRealism.RefinedTraining.intensiveTraining.description', 'Enables intensive training option for a session per day for five days, for extra cost.'); } }),
    }),
  }),
  'shield-widget': Object.freeze({
    title: 'Shield Widget',
    author: 'RedRoryOTheGlen',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        get description() {
          return t('mods.shieldWidget.Enabled.description', 'See your shield in first person, which the original game never shows. It is drawn in its own metal, '
            + 'gets battered as it wears, and moves out of the way when you sheathe, swing or cast.');
        },
      }),
      'Shield.Scale': Object.freeze({ default: 1.0, min: 0.8, max: 1.2, float: true, step: 0.1, get description() { return t('mods.shieldWidget.Shield.Scale.description', 'Size of the sprite'); } }),
      'Shield.OffsetHorizontal': Object.freeze({ default: 0.5, min: -1.0, max: 1.0, float: true, step: 0.1, get description() { return t('mods.shieldWidget.Shield.OffsetHorizontal.description', 'Offsets the sprite relative to the left edge of the screen'); } }),
      'Shield.OffsetVertical': Object.freeze({ default: 0.5, min: -1.0, max: 1.0, float: true, step: 0.1, get description() { return t('mods.shieldWidget.Shield.OffsetVertical.description', 'Offsets the sprite relative to the bottom edge of the screen'); } }),
      'Shield.Speed': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, get description() { return t('mods.shieldWidget.Shield.Speed.description', 'Speed of stance transition when attacking'); } }),
      'Shield.WhenSheathed': Object.freeze({ default: 1, options: SHIELD_STANCES, get description() { return t('mods.shieldWidget.Shield.WhenSheathed.description', 'The shield\'s behavior when sheathing your weapon'); } }),
      'Shield.WhenAttacking': Object.freeze({ default: 1, options: SHIELD_STANCES, get description() { return t('mods.shieldWidget.Shield.WhenAttacking.description', 'The shield\'s behavior when attacking with a weapon'); } }),
      'Shield.WhenCasting': Object.freeze({ default: 1, options: SHIELD_STANCES, get description() { return t('mods.shieldWidget.Shield.WhenCasting.description', 'The shield\'s behavior when readying or while casting a spell'); } }),
      'Shield.LockAspectRatio': Object.freeze({ default: true, get description() { return t('mods.shieldWidget.Shield.LockAspectRatio.description', 'Enable to prevent the sprite from stretching or squishing depending on the screen\'s aspect ratio'); } }),
      'Shield.ConditionThresholdUpper': Object.freeze({ default: 75, min: 55, max: 95, get description() { return t('mods.shieldWidget.Shield.ConditionThresholdUpper.description', 'Condition, in percent, below which the shield first looks damaged.'); } }),
      'Shield.ConditionThresholdLower': Object.freeze({ default: 25, min: 5, max: 45, get description() { return t('mods.shieldWidget.Shield.ConditionThresholdLower.description', 'Condition, in percent, below which the shield looks badly damaged.'); } }),
      'Modules.Bob': Object.freeze({ default: true, get description() { return t('mods.shieldWidget.Modules.Bob.description', 'Bob: the shield sways as you walk.'); } }),
      'Modules.Inertia': Object.freeze({ default: false, get description() { return t('mods.shieldWidget.Modules.Inertia.description', 'Inertia: the shield trails behind as you look around and move.'); } }),
      'Modules.Animation': Object.freeze({ default: false, get description() { return t('mods.shieldWidget.Modules.Animation.description', 'Animation: the shield is raised and lowered frame by frame instead of sliding (art by WilhelmBlack).'); } }),
      'Modules.Step': Object.freeze({ default: false, get description() { return t('mods.shieldWidget.Modules.Step.description', 'Step: the shield\u2019s position is rounded so it moves in steps.'); } }),
      'Modules.Recoil': Object.freeze({ default: false, get description() { return t('mods.shieldWidget.Modules.Recoil.description', 'Recoil: a blow that lands on the shield rocks it and makes it ring. Needs Physical Combat and Armor Overhaul.'); } }),
      'Bob.Length': Object.freeze({ default: 100, min: 0, max: 200, get description() { return t('mods.shieldWidget.Bob.Length.description', 'Amount of bobs in a single stride'); } }),
      'Bob.Offset': Object.freeze({ default: 0.0, min: 0.0, max: 3.0, float: true, step: 0.1, get description() { return t('mods.shieldWidget.Bob.Offset.description', 'Advances the bob timing. For use with weapon bob.'); } }),
      'Bob.SizeX': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, get description() { return t('mods.shieldWidget.Bob.SizeX.description', 'Extent of horizontal movement when bobbing'); } }),
      'Bob.SizeY': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, get description() { return t('mods.shieldWidget.Bob.SizeY.description', 'Extent of vertical movement when bobbing'); } }),
      'Bob.SpeedMove': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, get description() { return t('mods.shieldWidget.Bob.SpeedMove.description', 'Speed of transition between stationary and moving'); } }),
      'Bob.SpeedState': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, get description() { return t('mods.shieldWidget.Bob.SpeedState.description', 'Speed of transition between movement states'); } }),
      'Bob.Shape': Object.freeze({ default: 0, options: lazyWords(() => t('mods.shieldWidget.option.u', 'U'), () => t('mods.shieldWidget.option.sideways8', 'Sideways 8'), () => t('mods.shieldWidget.option.invertedU', 'Inverted U')), get description() { return t('mods.shieldWidget.Bob.Shape.description', 'Shape of bob'); } }),
      'Bob.BobWhileIdle': Object.freeze({ default: true, get description() { return t('mods.shieldWidget.Bob.BobWhileIdle.description', 'Whether the shield will slightly bob while stationary'); } }),
      'Inertia.Scale': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, get description() { return t('mods.shieldWidget.Inertia.Scale.description', 'The maximum distance that the sprite will be offset'); } }),
      'Inertia.Speed': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, get description() { return t('mods.shieldWidget.Inertia.Speed.description', 'The speed that the sprite will move at towards the target offset'); } }),
      'Inertia.ForwardDepth': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, get description() { return t('mods.shieldWidget.Inertia.ForwardDepth.description', 'Multiplier for the change in scale when moving forward or backward'); } }),
      'Inertia.ForwardSpeed': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, get description() { return t('mods.shieldWidget.Inertia.ForwardSpeed.description', 'The speed that the sprite will scale towards the target depth'); } }),
      'Animation.Speed': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, get description() { return t('mods.shieldWidget.Animation.Speed.description', 'Determines how fast the animation plays'); } }),
      'Animation.Direction': Object.freeze({ default: 0, options: lazyWords(() => t('mods.shieldWidget.option.both', 'Both'), () => t('mods.shieldWidget.option.forwardOnly', 'Forward Only'), () => t('mods.shieldWidget.option.reverseOnly', 'Reverse Only')), get description() { return t('mods.shieldWidget.Animation.Direction.description', 'Set which animations will play during actions'); } }),
      'Step.Length': Object.freeze({ default: 1, min: 1, max: 10, get description() { return t('mods.shieldWidget.Step.Length.description', 'Size of each step. Higher moves in bigger jumps.'); } }),
      'Step.Condition': Object.freeze({ default: 0, options: lazyWords(() => t('mods.shieldWidget.option.sheatheAttackOnly', 'Sheathe/Attack Only'), () => t('mods.shieldWidget.option.allTransforms', 'All Transforms')), get description() { return t('mods.shieldWidget.Step.Condition.description', 'Whether the snapping only affects Sheathing or also other options like Bob, Inertia and Recoil'); } }),
      'Recoil.Scale': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, get description() { return t('mods.shieldWidget.Recoil.Scale.description', 'The amount the shield will recoil'); } }),
      'Recoil.Offset': Object.freeze({ default: false, get description() { return t('mods.shieldWidget.Recoil.Offset.description', 'Whether the shield should be moved to the center when recoiling'); } }),
      'Recoil.Speed': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, get description() { return t('mods.shieldWidget.Recoil.Speed.description', 'The speed that the shield recovers from recoil'); } }),
      'Recoil.Condition': Object.freeze({ default: 2, options: lazyWords(() => t('mods.shieldWidget.option.hitOnShield', 'Hit On Shield'), () => t('mods.shieldWidget.option.missOnShield', 'Miss On Shield'), () => t('mods.shieldWidget.option.attackOnShield', 'Attack On Shield'), () => t('mods.shieldWidget.option.anyHit', 'Any Hit'), () => t('mods.shieldWidget.option.anyMiss', 'Any Miss'), () => t('mods.shieldWidget.option.anyAttack', 'Any Attack')), get description() { return t('mods.shieldWidget.Recoil.Condition.description', 'Event required for the shield to recoil'); } }),
      'Compatibility.TextureScaleFactor': Object.freeze({ default: 1, min: 0, max: 8, get description() { return t('mods.shieldWidget.Compatibility.TextureScaleFactor.description', 'Divides the sprite\u2019s pixel size. Raise it if a replacement texture pack draws the shield too large.'); } }),
    }),
  }),
  'weapon-widget': Object.freeze({
    title: 'Weapon Widget',
    author: 'RedRoryOTheGlen',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        get description() {
          return t('mods.weaponWidget.Enabled.description', 'Livelier first-person weapons: swings that wind up and recover, the weapon in the hand you swing '
            + 'with, a sheathe animation, a bob as you walk, sway as you look and a kick when you hit or parry. The '
            + 'Morrowind arms move the same way.');
        },
      }),
      'Modules.Swings': Object.freeze({ default: true, get description() { return t('mods.weaponWidget.Modules.Swings.description', 'Swings: each strike winds up from the idle pose, plays at its own speed and recovers, in reverse after a hit.'); } }),
      'Modules.Ambidexterity': Object.freeze({ default: true, get description() { return t('mods.weaponWidget.Modules.Ambidexterity.description', 'Ambidexterity: the weapon shows in the hand you swing with (Switch Hand, H), mirrored for the left.'); } }),
      'Modules.Offset': Object.freeze({ default: true, get description() { return t('mods.weaponWidget.Modules.Offset.description', 'Offset: sheathing slides the sprite off the screen and drawing slides it back; a swing returns from below.'); } }),
      'Modules.Bob': Object.freeze({ default: true, get description() { return t('mods.weaponWidget.Modules.Bob.description', 'Bob: the sprite sways as you walk.'); } }),
      'Modules.Inertia': Object.freeze({ default: false, get description() { return t('mods.weaponWidget.Modules.Inertia.description', 'Inertia: the weapon trails behind as you look around and move. Needs double-scaled weapon textures.'); } }),
      'Modules.Step': Object.freeze({ default: false, get description() { return t('mods.weaponWidget.Modules.Step.description', 'Step: the sprite\u2019s position is rounded so it moves in steps.'); } }),
      'Modules.DoubleScaleTextures': Object.freeze({ default: false, get description() { return t('mods.weaponWidget.Modules.DoubleScaleTextures.description', 'DoubleScaleTextures: draws the idle pose at double size from the mod’s own textures. Add the mod’s .dfmod under Your own textures.'); } }),   // DISC16-B: the mod's own again (DISC14-B had it on)
      'Modules.TrueTextureSize': Object.freeze({ default: false, get description() { return t('mods.weaponWidget.Modules.TrueTextureSize.description', 'TrueTextureSize: a custom texture is drawn at its own pixel size, divided by the scale factor below.'); } }),
      'Modules.Recoil': Object.freeze({ default: false, get description() { return t('mods.weaponWidget.Modules.Recoil.description', 'Recoil: the swing bounces back on a hit, parry or miss, as set below.'); } }),
      'Swings.Speed': Object.freeze({ default: 1.0, min: 0.0, max: 5.0, float: true, step: 0.25, get description() { return t('mods.weaponWidget.Swings.Speed.description', 'Speed of the swing animation.'); } }),
      'Swings.Windup': Object.freeze({ default: 1, options: lazyWords(() => t('mods.weaponWidget.option.hide', 'Hide'), () => t('mods.weaponWidget.option.idle', 'Idle'), () => t('mods.weaponWidget.option.firstFrame', 'First Frame')), get description() { return t('mods.weaponWidget.Swings.Windup.description', 'What shows while the swing winds up.'); } }),
      'Swings.Recovery': Object.freeze({ default: 0, options: lazyWords(() => t('mods.weaponWidget.option.hide', 'Hide'), () => t('mods.weaponWidget.option.lastFrame', 'Last Frame')), get description() { return t('mods.weaponWidget.Swings.Recovery.description', 'What shows while the swing recovers.'); } }),
      'Swings.VanillaAlignmentOverride': Object.freeze({ default: true, get description() { return t('mods.weaponWidget.Swings.VanillaAlignmentOverride.description', 'Centres the down and up strikes of the vanilla weapons at the screen\u2019s middle edge.'); } }),
      'Swings.VanillaRecoveryOverride': Object.freeze({ default: true, get description() { return t('mods.weaponWidget.Swings.VanillaRecoveryOverride.description', 'Plays the StrikeUp animation in reverse during recovery for some vanilla weapons'); } }),
      'Swings.NoDaggerMirroredStrikes': Object.freeze({ default: true, get description() { return t('mods.weaponWidget.Swings.NoDaggerMirroredStrikes.description', 'Prevents Daggers from using the opposite hand animations'); } }),
      'Offset.Speed': Object.freeze({ default: 1.0, min: 0.0, max: 5.0, float: true, step: 0.25, get description() { return t('mods.weaponWidget.Offset.Speed.description', 'Speed of the slide on and off the screen.'); } }),
      'Bob.Length': Object.freeze({ default: 100, min: 0, max: 200, get description() { return t('mods.weaponWidget.Bob.Length.description', 'Amount of bobs in a single stride'); } }),
      'Bob.Offset': Object.freeze({ default: 0.0, min: 0.0, max: 1.0, float: true, step: 0.1, get description() { return t('mods.weaponWidget.Bob.Offset.description', 'Advances the bob timing. For use with weapon bob.'); } }),
      'Bob.SizeX': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, get description() { return t('mods.weaponWidget.Bob.SizeX.description', 'Extent of horizontal movement when bobbing'); } }),
      'Bob.SizeY': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, get description() { return t('mods.weaponWidget.Bob.SizeY.description', 'Extent of vertical movement when bobbing'); } }),
      'Bob.SpeedMove': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, get description() { return t('mods.weaponWidget.Bob.SpeedMove.description', 'Speed of transition between stationary and moving'); } }),
      'Bob.SpeedState': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, get description() { return t('mods.weaponWidget.Bob.SpeedState.description', 'Speed of transition between movement states'); } }),
      'Bob.Shape': Object.freeze({ default: 0, options: lazyWords(() => t('mods.weaponWidget.option.u', 'U'), () => t('mods.weaponWidget.option.sideways8', 'Sideways 8'), () => t('mods.weaponWidget.option.invertedU', 'Inverted U')), get description() { return t('mods.weaponWidget.Bob.Shape.description', 'Shape of bob'); } }),
      'Bob.BobWhileIdle': Object.freeze({ default: true, get description() { return t('mods.weaponWidget.Bob.BobWhileIdle.description', 'Whether the weapon will slightly bob while stationary'); } }),
      'Step.Length': Object.freeze({ default: 1, min: 1, max: 10, get description() { return t('mods.weaponWidget.Step.Length.description', 'Size of each step. Higher moves in bigger jumps.'); } }),
      'Step.Condition': Object.freeze({ default: 0, options: lazyWords(() => t('mods.weaponWidget.option.sheatheAttackOnly', 'Sheathe/Attack Only'), () => t('mods.weaponWidget.option.allTransforms', 'All Transforms')), get description() { return t('mods.weaponWidget.Step.Condition.description', 'Whether the snapping only affects Sheathing or also other options like Bob, Inertia and Recoil'); } }),
      'Inertia.Scale': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, get description() { return t('mods.weaponWidget.Inertia.Scale.description', 'The maximum distance that the sprite will be offset'); } }),   // DISC16-B: the mod's own again (DISC14-B had it at 0)
      'Inertia.Speed': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, get description() { return t('mods.weaponWidget.Inertia.Speed.description', 'The speed that the sprite will move at towards the target offset'); } }),
      'Inertia.ForwardDepth': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, get description() { return t('mods.weaponWidget.Inertia.ForwardDepth.description', 'Multiplier for the change in scale when moving forward or backward'); } }),
      'Inertia.ForwardSpeed': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, get description() { return t('mods.weaponWidget.Inertia.ForwardSpeed.description', 'The speed that the sprite will scale towards the target depth'); } }),
      'TrueTextureSize.TextureScaleFactor': Object.freeze({ default: 1, min: 1, max: 8, get description() { return t('mods.weaponWidget.TrueTextureSize.TextureScaleFactor.description', 'With True Texture Size on, divides a custom texture’s size. Raise it if the weapon draws too large.'); } }),
      'Recoil.Condition': Object.freeze({ default: 0, options: lazyWords(() => t('mods.weaponWidget.option.hitsOnly', 'Hits Only'), () => t('mods.weaponWidget.option.hitsAndParries', 'Hits and Parries'), () => t('mods.weaponWidget.option.parriesOnly', 'Parries Only'), () => t('mods.weaponWidget.option.parriesAndMisses', 'Parries and Misses'), () => t('mods.weaponWidget.option.missesOnly', 'Misses Only'), () => t('mods.weaponWidget.option.allAttacks', 'All Attacks')), get description() { return t('mods.weaponWidget.Recoil.Condition.description', 'When the swing recoils.'); } }),
      'Recoil.Chance': Object.freeze({ default: 100, min: 0, max: 100, get description() { return t('mods.weaponWidget.Recoil.Chance.description', 'Chance, in percent, of a recoil when the condition is met'); } }),
      'Recoil.PlayEntityMissEffects': Object.freeze({ default: true, get description() { return t('mods.weaponWidget.Recoil.PlayEntityMissEffects.description', 'A clang or a thud at a foe that parried or was missed.'); } }),
      'Recoil.DetectEnvironment': Object.freeze({ default: true, get description() { return t('mods.weaponWidget.Recoil.DetectEnvironment.description', 'A swing into a wall or a door within reach recoils too.'); } }),
      'Recoil.PlayEnvironmentMissEffects': Object.freeze({ default: true, get description() { return t('mods.weaponWidget.Recoil.PlayEnvironmentMissEffects.description', 'A thud where the swing met the wall.'); } }),
      'Recoil.MissEffectPlacement': Object.freeze({ default: 0, options: lazyWords(() => t('mods.weaponWidget.option.target', 'Target'), () => t('mods.weaponWidget.option.crosshair', 'Crosshair')), get description() { return t('mods.weaponWidget.Recoil.MissEffectPlacement.description', 'Where the clang or thud is drawn.'); } }),
      'Miscellaneous.MirrorBows': Object.freeze({ default: false, get description() { return t('mods.weaponWidget.Miscellaneous.MirrorBows.description', 'Draws the bow mirrored.'); } }),
      'Miscellaneous.MirrorTwoHandedSwords': Object.freeze({ default: false, get description() { return t('mods.weaponWidget.Miscellaneous.MirrorTwoHandedSwords.description', 'Draws a two-handed sword mirrored in the right hand.'); } }),
      'Miscellaneous.MirrorTwoHandedAxes': Object.freeze({ default: false, get description() { return t('mods.weaponWidget.Miscellaneous.MirrorTwoHandedAxes.description', 'Draws a two-handed axe mirrored in the right hand.'); } }),
      'Miscellaneous.MirrorTwoHandedBlunts': Object.freeze({ default: false, get description() { return t('mods.weaponWidget.Miscellaneous.MirrorTwoHandedBlunts.description', 'Draws a two-handed staff, hammer or flail mirrored in the right hand.'); } }),
    }),
  }),
  // HT1 (2026-09-14): HANDHELD TORCHES 1.4.1 (RedRoryOTheGlen), ported
  // 1:1 - the shipped modsettings.json (vendor/handheld-torches/) key
  // for key, section and name joined with a dot. Two kinds are new
  // here: a TextKey (a Unity KeyCode name - `text`), and the two Tuple
  // keys (`tuple: 'int' | 'float'`, the value a pair). Where the mod
  // wrote a description it is the pane's; where it wrote none the port
  // did.
  'handheld-torches': Object.freeze({
    title: 'Handheld Torches',
    author: 'RedRoryOTheGlen',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        get description() {
          return t('mods.handheldTorches.Enabled.description', 'A lit torch, candle or lantern needs a free hand. You get keys to light, drop or throw one (a thrown '
            + 'torch can set an enemy on fire). You see the light in your hand in first person, and a dropped torch '
            + 'keeps burning, lights the room and can be picked up again.');
        },
      }),
      // SOC5 (2026-09-16, Mac: "Players should be able to interact with others
      // in the world upon encountering them by pressing F on their body"): THE
      // SECOND DEPARTURE FROM THE MOD'S SHIPPED KEYS, and the same shape as
      // HT4's below. Handheld Torches ships F, and in Daggerfall Unity that is
      // free. It is not free here any more: SOC5 spends F on the port's own
      // SocialInteract action (systems/inputActions.js DEFAULT_BINDINGS), the
      // key Mac named, and online forces every vendored mod ON
      // (systems/online/onlineLane.js) - so one press would both open the F-menu on a
      // player and light a torch, for every player online, by default. O is
      // unbound in DFU's own defaults and unused by this mod's other two keys
      // and by every other vendored mod, and it says what it does: on and off.
      // The player may still bind it wherever they like; this is about what
      // SHIPS. test/systems/ht1_handheldtorches.test.js HT4 is the gate that caught it.
      'Handling.ToggleLightInput': Object.freeze({ default: "O", text: true, get description() { return t('mods.handheldTorches.Handling.ToggleLightInput.description', 'Button used to quickly ignite or douse your light source'); } }),   // KB1: not read by the mod any more - the key is the registry's action (inputActions.js MOD_ACTIONS); a player's saved value is carried there once (migrateKeyBinds)
      'Handling.RememberLastLightSource': Object.freeze({ default: true, get description() { return t('mods.handheldTorches.Handling.RememberLastLightSource.description', 'Igniting with the key re-lights the light you last doused, if you still carry one.'); } }),
      // HT4 (2026-09-15, Mac: "Pressing tab drops torches, tab is reserved
      // for the menu"): THE ONE DEPARTURE FROM THE MOD'S SHIPPED KEYS.
      // Handheld Torches ships Tab, and in Daggerfall Unity that is free.
      // It is not free here: PX15 gave Tab to the port's own pixel dial
      // (ui/input.js, the radial menu DFU has not got), so the mod's
      // default landed on a key the port had already spent and one press
      // both opened the dial and dropped the light. The mod could not
      // have known; the port has to answer for it. G is unbound in DFU's
      // own defaults (inputActions.js DEFAULT_BINDINGS) and unused by the
      // mod's other two keys, and it stays the player's to rebind.
      'Handling.ManualDropInput': Object.freeze({ default: "G", text: true, get description() { return t('mods.handheldTorches.Handling.ManualDropInput.description', 'Button used to manually drop a light source'); } }),   // KB1: not read by the mod any more - the key is the registry's action (inputActions.js MOD_ACTIONS); a player's saved value is carried there once (migrateKeyBinds)
      // HT7 (2026-09-17, Mac: "Take care of both") - THE ONE DEFAULT THIS
      // PORT MOVES, and it is an owner decision rather than a misread.
      //
      // Handheld Torches ships `OnStow = Drop` (1), and the port kept it
      // with every other shipped default. HT6 recorded the consequence:
      // with the weapon DRAWN, equipping a shield puts your lit torch on
      // the floor - and since HT6 made the law run at the equip moment,
      // it happens while the inventory is still open, in front of you.
      // A player who equips a shield mid-fight has not asked to drop
      // anything, and a torch on a dungeon floor is an item lost to
      // whoever does not think to look down.
      //
      // So the port DEFAULTS to Unequip (0) - the light goes back to the
      // pack and `RememberLastLightSource` lights it again when a hand
      // comes free, which is the behaviour the rest of this mod is built
      // around. The mod's own default is ONE CLICK away on the Mods
      // pane's dial; nothing about the Drop path is removed, and the
      // throw (Throwing.ThrowTorchInput) is still how you put a torch on
      // the floor on purpose.
      'Handling.OnStow': Object.freeze({ default: 0, options: lazyWords(() => t('mods.handheldTorches.option.unequip', 'Unequip'), () => t('mods.handheldTorches.option.drop', 'Drop')), get description() { return t('mods.handheldTorches.Handling.OnStow.description', 'Behavior when forced to stow a light source'); } }),
      'Handling.OnPick': Object.freeze({ default: 1, options: lazyWords(() => t('mods.handheldTorches.option.store', 'Store'), () => t('mods.handheldTorches.option.equip', 'Equip'), () => t('mods.handheldTorches.option.forceEquip', 'Force Equip')), get description() { return t('mods.handheldTorches.Handling.OnPick.description', 'Behavior when picking up a light source'); } }),
      'Handling.StowWhenSpellcasting': Object.freeze({ default: true, get description() { return t('mods.handheldTorches.Handling.StowWhenSpellcasting.description', 'Casting or readying a spell puts the light away to free your hand.'); } }),
      'Handling.StowWhenClimbing': Object.freeze({ default: true, get description() { return t('mods.handheldTorches.Handling.StowWhenClimbing.description', 'Climbing puts the light away to free your hand.'); } }),
      'Handling.StowWhenSwimming': Object.freeze({ default: true, get description() { return t('mods.handheldTorches.Handling.StowWhenSwimming.description', 'Swimming puts the light away to free your hand.'); } }),
      'Handling.RelaxedTwoHandedWeapons': Object.freeze({ default: false, get description() { return t('mods.handheldTorches.Handling.RelaxedTwoHandedWeapons.description', 'Two-handed weapons will only occupy your off-hand when attacking'); } }),   // 3ARMS: the mod ships true; the port ships false - see the departure in Handheld-Torches.md
      'Handling.RelaxedLanterns': Object.freeze({ default: false, get description() { return t('mods.handheldTorches.Handling.RelaxedLanterns.description', 'If enabled, will not stow lanterns when both hands are occupied'); } }),
      // HT-WAIST (2026-09-24, Mac: "Let the lantern item be able to be hung
      // at the waist instead of having to be held" - and, asked how, a
      // switch on THIS pane, off by default; HT-WAIST-ON, the same day: "Have
      // the lantern change on by default" - it ships ON): A DEPARTURE ON THIS PANE, AND
      // THE FIRST KEY THE MOD DOES NOT SHIP AT ALL. Every earlier one
      // (MODS-ON Sprite, HT4 Tab, SOC5 F, HT5 Bob, HT7 OnStow, 3ARMS) moves
      // a shipped default; this one is the port's own switch, sitting beside the
      // mod's RelaxedLanterns because it is that switch taken the rest of
      // the way. Relaxed keeps a lantern lit when both hands are busy; ON,
      // this hangs it at the waist - it never needs a free hand, is never
      // stowed for a two-hander, a bow, a spell, a climb or a swim, the
      // first-person hand never holds it, and the light shines from the hip
      // (systems/playerTorch.js lanternAtWaist). Torches and candles are
      // still held. The vendored modsettings.json is untouched; the pane's
      // pin names this key as the port's (test/systems/ht1_handheldtorches.test.js).
      'Handling.LanternsAtWaist': Object.freeze({ default: true, get description() { return t('mods.handheldTorches.Handling.LanternsAtWaist.description', 'If enabled, lanterns hang at your waist instead of being held, so they never need a free hand and are never put away. Torches and candles are still held.'); } }),
      'Throwing.ThrowTorchInput': Object.freeze({ default: "X", text: true, get description() { return t('mods.handheldTorches.Throwing.ThrowTorchInput.description', 'Hold to wind up a throw, release to throw a torch.'); } }),   // KB1: not read by the mod any more - the key is the registry's action (inputActions.js MOD_ACTIONS); a player's saved value is carried there once (migrateKeyBinds)
      'Throwing.ThrowStrength': Object.freeze({ default: 1.0, min: 0.0, max: 10.0, float: true, step: 0.25, get description() { return t('mods.handheldTorches.Throwing.ThrowStrength.description', 'Multiplies how hard you throw.'); } }),
      'Throwing.GravityStrength': Object.freeze({ default: 1.0, min: 0.0, max: 10.0, float: true, step: 0.25, get description() { return t('mods.handheldTorches.Throwing.GravityStrength.description', 'Multiplies how fast a thrown torch falls.'); } }),
      'Throwing.ThrowAngleOffset': Object.freeze({ default: 15.0, min: 0.0, max: 45.0, float: true, step: 0.25, get description() { return t('mods.handheldTorches.Throwing.ThrowAngleOffset.description', 'How many degrees above your aim the torch is thrown.'); } }),
      'Throwing.ThrowDispersion': Object.freeze({ default: 1.0, min: 0.0, max: 3.0, float: true, step: 0.1, get description() { return t('mods.handheldTorches.Throwing.ThrowDispersion.description', 'Degrees of random spread on the throw.'); } }),
      'Throwing.ThrowScaleSpeed': Object.freeze({ default: 1.0, min: 0.0, max: 10.0, float: true, step: 0.25, get description() { return t('mods.handheldTorches.Throwing.ThrowScaleSpeed.description', 'How fast the wind-up charges while the key is held.'); } }),
      'Throwing.ShowTrajectory': Object.freeze({ default: true, get description() { return t('mods.handheldTorches.Throwing.ShowTrajectory.description', 'Has no effect here: the throw’s arc isn’t drawn in this game.'); } }),
      'Throwing.Bounciness': Object.freeze({ default: 0.5, min: 0.0, max: 1.0, float: true, step: 0.05, get description() { return t('mods.handheldTorches.Throwing.Bounciness.description', 'How much speed a thrown torch keeps when it bounces.'); } }),
      'Throwing.Combustion': Object.freeze({ default: true, get description() { return t('mods.handheldTorches.Throwing.Combustion.description', 'A thrown torch that strikes a foe can set it alight.'); } }),
      'Throwing.Accuracy': Object.freeze({ default: 50, min: 0, max: 100, get description() { return t('mods.handheldTorches.Throwing.Accuracy.description', 'The to-hit modifier of the thrown torch.'); } }),
      'Throwing.Duration': Object.freeze({ default: 3, min: 0, max: 60, get description() { return t('mods.handheldTorches.Throwing.Duration.description', 'Rounds the fire burns on a struck foe.'); } }),
      'Throwing.Chance': Object.freeze({ default: 50, min: 0, max: 100, get description() { return t('mods.handheldTorches.Throwing.Chance.description', '% chance the fire takes on a struck foe.'); } }),
      'Throwing.Magnitude': Object.freeze({ default: Object.freeze([1, 2]), tuple: 'int', get description() { return t('mods.handheldTorches.Throwing.Magnitude.description', 'Fire damage per round, lowest and highest.'); } }),
      'Throwing.Emission': Object.freeze({ default: true, get description() { return t('mods.handheldTorches.Throwing.Emission.description', 'A burning foe gives off light.'); } }),
      'Throwing.EmissionShadows': Object.freeze({ default: false, get description() { return t('mods.handheldTorches.Throwing.EmissionShadows.description', 'Has no effect here: a burning foe’s light casts no shadows in this game.'); } }),
      // MODS-ON (2026-09-14, Mac: "all mods should be on by default"): the
      // shipped modsettings.json carries `Sprite = False`, so the mod itself
      // ships its first-person hand switched off - and the hand is the mod's
      // whole subject. The HT2 audit measured what that costs: everything
      // works (all eight sprites decode and upload, the hand is free, the
      // torch is lit) and `draw()` still answers false, so a player lights a
      // torch and sees nothing. This ONE default departs; Ledger A row MODS-ON.
      'Modules.Sprite': Object.freeze({ default: true, get description() { return t('mods.handheldTorches.Modules.Sprite.description', 'Sprite: a first-person hand holding the lit torch or lantern.'); } }),
      // HT5 (2026-09-16, Mac: "the torch when being held isn't affected by
      // the weapon bob like everything else"): THE THIRD DEPARTURE FROM THE
      // MOD'S SHIPPED KEYS. The mod ships its three motion modules OFF -
      // they restate Weapon Widget's Bob, Inertia and Step laws so the hand
      // can move WITH the weapon, and the mod leaves it to the player to
      // switch on whichever the widget has on (its Bob.Offset says so: "For
      // use with weapon bob"). This port ships Weapon Widget with Bob ON
      // (its own shipped default), so a torch hand that shipped still beside
      // a weapon that sways is the two mods disagreeing about one walk. Bob
      // follows the widget's shipped default; Inertia and Step stay off, as
      // the widget ships them. The player may still turn any of the three
      // either way; this is about what SHIPS.
      'Modules.Bob': Object.freeze({ default: true, get description() { return t('mods.handheldTorches.Modules.Bob.description', 'Bob: the sprite sways as you walk, in step with Weapon Widget\u2019s bob.'); } }),
      'Modules.Inertia': Object.freeze({ default: false, get description() { return t('mods.handheldTorches.Modules.Inertia.description', 'Inertia: the light trails behind as you look around and move.'); } }),
      'Modules.Step': Object.freeze({ default: false, get description() { return t('mods.handheldTorches.Modules.Step.description', 'Step: the sprite\u2019s position is rounded so it moves in steps.'); } }),
      'Presentation.Tint': Object.freeze({ default: true, get description() { return t('mods.handheldTorches.Presentation.Tint.description', 'Matches the weapon sprite\'s tint when using First-Person-Lighting.'); } }),
      'Presentation.Ambidexterity': Object.freeze({ default: false, get description() { return t('mods.handheldTorches.Presentation.Ambidexterity.description', 'Mirror the first-person graphic depending on the free hand. Recommended when using Shield Widget.'); } }),
      'Presentation.Scale': Object.freeze({ default: 0.8, min: 0.8, max: 1.2, float: true, step: 0.05, get description() { return t('mods.handheldTorches.Presentation.Scale.description', 'Size of the first-person sprite.'); } }),
      'Presentation.Offset': Object.freeze({ default: Object.freeze([0.5, 0.5]), tuple: 'float', get description() { return t('mods.handheldTorches.Presentation.Offset.description', 'Where your hand rests on screen, across and up.'); } }),
      'Presentation.Speed': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, get description() { return t('mods.handheldTorches.Presentation.Speed.description', 'How fast the sprite slides on and off the screen.'); } }),
      'Presentation.LockAspectRatio': Object.freeze({ default: true, get description() { return t('mods.handheldTorches.Presentation.LockAspectRatio.description', 'The sprite scales by the screen\u2019s width alone, keeping its proportions.'); } }),
      'Presentation.PlayerTorchAudio': Object.freeze({ default: true, get description() { return t('mods.handheldTorches.Presentation.PlayerTorchAudio.description', 'Plays a burning sound while you hold a torch'); } }),
      'Presentation.AudioVolume': Object.freeze({ default: 0.5, min: 0.0, max: 2.0, float: true, step: 0.1, get description() { return t('mods.handheldTorches.Presentation.AudioVolume.description', 'Volume of the burning loop and the torch sounds.'); } }),
      'Bob.Length': Object.freeze({ default: 100, min: 0, max: 200, get description() { return t('mods.handheldTorches.Bob.Length.description', 'Amount of bobs in a single stride'); } }),
      'Bob.Offset': Object.freeze({ default: 0.0, min: 0.0, max: 1.0, float: true, step: 0.05, get description() { return t('mods.handheldTorches.Bob.Offset.description', 'Advances the bob timing. For use with weapon bob.'); } }),
      'Bob.SizeX': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, get description() { return t('mods.handheldTorches.Bob.SizeX.description', 'Extent of horizontal movement when bobbing'); } }),
      'Bob.SizeY': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, get description() { return t('mods.handheldTorches.Bob.SizeY.description', 'Extent of vertical movement when bobbing'); } }),
      'Bob.SpeedMove': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, get description() { return t('mods.handheldTorches.Bob.SpeedMove.description', 'Speed of transition between stationary and moving'); } }),
      'Bob.SpeedState': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, get description() { return t('mods.handheldTorches.Bob.SpeedState.description', 'Speed of transition between movement states'); } }),
      'Bob.Shape': Object.freeze({ default: 0, options: lazyWords(() => t('mods.handheldTorches.option.u', 'U'), () => t('mods.handheldTorches.option.sideways8', 'Sideways 8'), () => t('mods.handheldTorches.option.invertedU', 'Inverted U')), get description() { return t('mods.handheldTorches.Bob.Shape.description', 'Shape of bob'); } }),
      'Bob.BobWhileIdle': Object.freeze({ default: true, get description() { return t('mods.handheldTorches.Bob.BobWhileIdle.description', 'Whether the light will slightly bob while stationary'); } }),
      'Inertia.Scale': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, get description() { return t('mods.handheldTorches.Inertia.Scale.description', 'The maximum distance that the sprite will be offset'); } }),
      'Inertia.Speed': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, get description() { return t('mods.handheldTorches.Inertia.Speed.description', 'The speed that the sprite will move at towards the target offset'); } }),
      'Inertia.ForwardDepth': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, get description() { return t('mods.handheldTorches.Inertia.ForwardDepth.description', 'Multiplier for the change in scale when moving forward or backward'); } }),
      'Inertia.ForwardSpeed': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, get description() { return t('mods.handheldTorches.Inertia.ForwardSpeed.description', 'The speed that the sprite will scale towards the target depth'); } }),
      'Step.Length': Object.freeze({ default: 1, min: 1, max: 10, get description() { return t('mods.handheldTorches.Step.Length.description', 'Size of each step. Higher moves in bigger jumps.'); } }),
      'Step.Condition': Object.freeze({ default: 0, options: lazyWords(() => t('mods.handheldTorches.option.sheatheAttackOnly', 'Sheathe/Attack Only'), () => t('mods.handheldTorches.option.allTransforms', 'All Transforms')), get description() { return t('mods.handheldTorches.Step.Condition.description', 'Whether the snapping only affects Sheathing or also other options like Bob, Inertia and Recoil'); } }),
      'Compatibility.TextureScaleFactor': Object.freeze({ default: 1, min: 0, max: 8, get description() { return t('mods.handheldTorches.Compatibility.TextureScaleFactor.description', 'Divides a custom texture’s size. Raise it if a texture pack draws the hand too large.'); } }),
    }),
  }),
  // AT0: AMBIENT TEXT 1.8 (Regnier). Its one section, `AmbientText`,
  // and its four SliderIntKeys, names, bounds and defaults exactly as
  // modsettings.json ships them, plus the port's own `Enabled`.
  // `interval` keeps the mod's own name and not the field's
  // (`stdInterval`) - the pane shows the player what the author called
  // it. All four are REAL-TIME SECONDS, not game time: the mod ticks on
  // Unity's `Time.unscaledTime`, so its pace is the same whether you
  // are standing still or riding a horse at 14x.
  'ambient-text': Object.freeze({
    title: 'Ambient Text',
    author: 'Regnier',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        get description() {
          return t('mods.ambientText.Enabled.description', 'Now and then, a short line in the corner about where you are: what a crypt smells like, what a '
            + 'village sounds like at night, how the desert light looks. It depends on the place, the time and the '
            + 'weather, and stays quiet indoors.');
        },
      }),
      textChance: Object.freeze({ default: 33, min: 0, max: 100, get description() { return t('mods.ambientText.textChance.description', 'Chance, in percent, of a line at each check'); } }),
      interval: Object.freeze({ default: 200, min: 60, max: 600, get description() { return t('mods.ambientText.interval.description', 'Real-time seconds between checks for a line'); } }),
      postTextInterval: Object.freeze({ default: 500, min: 60, max: 600, get description() { return t('mods.ambientText.postTextInterval.description', 'Real-time seconds to wait after a line is shown'); } }),
      textDisplayTime: Object.freeze({ default: 3, min: 1, max: 10, get description() { return t('mods.ambientText.textDisplayTime.description', 'Seconds a line stays on screen'); } }),
    }),
  }),
  // ── EYE OF THE BEHOLDER 2.1 (EOTB) ──────────────────────────────
  // RedRoryOTheGlen's third-person camera and player sprite, every key
  // the bundle's modsettings.json ships, under its own section name, as
  // it ships them - plus the port's own `Enabled`. Mac's ruling on why
  // a port that already has third person carries a second one
  // (2026-09-15): "This is moreso for those who opt out of using
  // morrowind." The Morrowind body needs Morrowind data; this one does
  // not, and `player/mwView.js` says in its own head that a player
  // without it "has no third person at all". Three defaults depart from
  // the bundle, each marked at its key.
  'eye-of-the-beholder': Object.freeze({
    title: 'Eye Of The Beholder',
    author: 'RedRoryOTheGlen',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        get description() {
          return t('mods.eyeOfTheBeholder.Enabled.description', 'Third person without Morrowind data. Scroll out and the camera moves behind your shoulder, and you see '
            + 'yourself as the mod’s character sprite, on foot and on horseback. Off keeps you in first person unless '
            + 'you use the Morrowind body.');
        },
      }),
      'Camera.StartInThirdPerson': Object.freeze({ default: false, get description() { return t('mods.eyeOfTheBeholder.Camera.StartInThirdPerson.description', 'Start in third person when you start or load a game'); } }),
      'Camera.FrontalPlaneOffset': Object.freeze({ default: Object.freeze([0.0, 0.5]), tuple: 'float', get description() { return t('mods.eyeOfTheBeholder.FrontalPlaneOffset.description', 'Moves the camera sideways and up or down'); } }),
      'Camera.LongitudinalDistance': Object.freeze({ default: 2.0, min: 1, max: 10, float: true, get description() { return t('mods.eyeOfTheBeholder.LongitudinalDistance.description', 'How far behind you the camera sits'); } }),
      'Camera.MinimumDistance': Object.freeze({ default: 0.8, min: 0, max: 1, float: true, get description() { return t('mods.eyeOfTheBeholder.Camera.MinimumDistance.description', 'How close the camera may come to you, as a share of its distance.'); } }),
      'Camera.RidingOffset': Object.freeze({ default: 1.0, min: 0, max: 2, float: true, get description() { return t('mods.eyeOfTheBeholder.Camera.RidingOffset.description', 'Raises and pulls back the camera while you ride.'); } }),
      'Camera.Speed': Object.freeze({ default: 10.0, min: 1, max: 20, float: true, get description() { return t('mods.eyeOfTheBeholder.Camera.Speed.description', 'How fast the camera catches up to where it should be.'); } }),
      'Camera.Dampen': Object.freeze({ default: 1.0, min: 0, max: 5, float: true, get description() { return t('mods.eyeOfTheBeholder.Camera.Dampen.description', 'How much the camera lags behind a sudden move.'); } }),
      'Camera.Auto-Switch': Object.freeze({ default: true, get description() { return t('mods.eyeOfTheBeholder.Camera.AutoSwitch.description', 'Moves the camera to your other shoulder when there isn’t room'); } }),
      'Camera.SwitchResetTime': Object.freeze({ default: 3.0, min: 0, max: 6, float: true, get description() { return t('mods.eyeOfTheBeholder.Camera.SwitchResetTime.description', 'Seconds before the camera switches back. 0 keeps it switched'); } }),
      // EOTB4 (2026-09-15, Mac: "instead of numpad being used to change
      // views, I want it scrollable like how we handle morrowind").
      // THE MOD'S OWN KEY, KEPT AND SUPERSEDED. The wheel is the only
      // way in and out now, so this binding does nothing - listed all
      // the same, because the pane is a record of what the mod ships
      // and a key quietly deleted is a key nobody can ask about (the
      // shape HT's `Throwing.ShowTrajectory` is kept in).
      'Camera.TogglePerspective': Object.freeze({ default: 'KeypadEnter', text: true, get description() { return t('mods.eyeOfTheBeholder.Camera.TogglePerspective.description', 'Has no effect here: scroll the mouse wheel to change view.'); } }),
      // HT4's finding again, same author, same key: the mod ships Tab,
      // which is free in Daggerfall Unity and SPENT here - PX15 gave it
      // to the port's own pixel dial (ui/input.js). B is unbound in
      // DFU's defaults and unused by the port and by this mod's other
      // keys, and it stays the player's to rebind.
      'Camera.SwitchShoulder': Object.freeze({ default: 'B', text: true, get description() { return t('mods.eyeOfTheBeholder.Camera.SwitchShoulder.description', 'Moves the camera to your other shoulder.'); } }),   // KB1: not read by the mod any more - the key is the registry's action (inputActions.js MOD_ACTIONS); a player's saved value is carried there once (migrateKeyBinds)
      'CameraOverrideWeapon.Enable': Object.freeze({ default: false, get description() { return t('mods.eyeOfTheBeholder.CameraOverrideWeapon.Enable.description', 'Use the camera position below while a weapon or spell is readied.'); } }),
      'CameraOverrideWeapon.FrontalPlaneOffset': Object.freeze({ default: Object.freeze([0.0, 0.5]), tuple: 'float', get description() { return t('mods.eyeOfTheBeholder.FrontalPlaneOffset.description', 'Moves the camera sideways and up or down'); } }),
      'CameraOverrideWeapon.LongitudinalDistance': Object.freeze({ default: 2.0, min: 1, max: 10, float: true, get description() { return t('mods.eyeOfTheBeholder.LongitudinalDistance.description', 'How far behind you the camera sits'); } }),
      'CameraOverrideMount.Enable': Object.freeze({ default: false, get description() { return t('mods.eyeOfTheBeholder.CameraOverrideMount.Enable.description', 'Use the camera position below while riding.'); } }),
      'CameraOverrideMount.FrontalPlaneOffset': Object.freeze({ default: Object.freeze([0.0, 0.5]), tuple: 'float', get description() { return t('mods.eyeOfTheBeholder.FrontalPlaneOffset.description', 'Moves the camera sideways and up or down'); } }),
      'CameraOverrideMount.LongitudinalDistance': Object.freeze({ default: 2.0, min: 1, max: 10, float: true, get description() { return t('mods.eyeOfTheBeholder.LongitudinalDistance.description', 'How far behind you the camera sits'); } }),
      'CameraOverrideBoat.Enable': Object.freeze({ default: false, get description() { return t('mods.eyeOfTheBeholder.CameraOverrideBoat.Enable.description', 'Use the camera position below while sailing.'); } }),
      'CameraOverrideBoat.FrontalPlaneOffset': Object.freeze({ default: Object.freeze([0.0, 0.0]), tuple: 'float', get description() { return t('mods.eyeOfTheBeholder.FrontalPlaneOffset.description', 'Moves the camera sideways and up or down'); } }),
      'CameraOverrideBoat.LongitudinalDistance': Object.freeze({ default: 2.0, min: 0, max: 10, float: true, get description() { return t('mods.eyeOfTheBeholder.LongitudinalDistance.description', 'How far behind you the camera sits'); } }),
      'CameraOverrideBoat.Target': Object.freeze({ default: 1, options: lazyWords(() => t('mods.eyeOfTheBeholder.option.hull', 'Hull'), () => t('mods.eyeOfTheBeholder.option.masthead', 'Masthead')), get description() { return t('mods.eyeOfTheBeholder.CameraOverrideBoat.Target.description', 'What the camera looks at while sailing.'); } }),
      // MODS-ON, and Mac's own ask. The mod ships this OFF, and it is
      // the arm the port's whole view seam is built on - with it off
      // there is no way into third person at all, because the key
      // above is inert here. Ledger A row MODS-ON, as HT's
      // `Modules.Sprite` is.
      'CameraScrolling.ScrollableZOffset': Object.freeze({ default: true, get description() { return t('mods.eyeOfTheBeholder.CameraScrolling.ScrollableZOffset.description', 'Scroll to move the camera closer or further away'); } }),
      'CameraScrolling.ScrollIncrement': Object.freeze({ default: 0.2, min: 0.1, max: 1, float: true, get description() { return t('mods.eyeOfTheBeholder.CameraScrolling.ScrollIncrement.description', 'How far the camera moves with each scroll'); } }),
      // `axis`, not `text`: this names a Unity input AXIS, not a
      // KeyCode, and the two are different kinds wearing the same
      // JSON type (TextKey). Declaring it as a key told HT4's
      // spent-key gate to resolve "Mouse ScrollWheel" as a binding,
      // which it is not and never could be. The port's wheel is the
      // DOM's, so this is informational here.
      'CameraScrolling.ScrollableZOffsetAxis': Object.freeze({ default: 'Mouse ScrollWheel', text: true, axis: true, get description() { return t('mods.eyeOfTheBeholder.CameraScrolling.ScrollableZOffsetAxis.description', 'Has no effect here: the mouse wheel always moves the camera.'); } }),
      'AutoTogglePerspective.ToggleInput': Object.freeze({ default: 'KeypadPlus', text: true, get description() { return t('mods.eyeOfTheBeholder.AutoTogglePerspective.ToggleInput.description', 'Key that turns the automatic view changes below on or off.'); } }),   // KB1: not read by the mod any more - the key is the registry's action (inputActions.js MOD_ACTIONS); a player's saved value is carried there once (migrateKeyBinds)
      'AutoTogglePerspective.OnFoot': Object.freeze({ default: 0, options: EOTB_VIEWS, get description() { return t('mods.eyeOfTheBeholder.AutoTogglePerspective.OnFoot.description', 'Which view to take on foot, with nothing readied.'); } }),
      'AutoTogglePerspective.OnFootMelee': Object.freeze({ default: 0, options: EOTB_VIEWS, get description() { return t('mods.eyeOfTheBeholder.AutoTogglePerspective.OnFootMelee.description', 'Which view to take on foot with a weapon readied.'); } }),
      'AutoTogglePerspective.OnFootRanged': Object.freeze({ default: 0, options: EOTB_VIEWS, get description() { return t('mods.eyeOfTheBeholder.AutoTogglePerspective.OnFootRanged.description', 'Which view to take on foot with a bow readied.'); } }),
      'AutoTogglePerspective.OnFootSpell': Object.freeze({ default: 0, options: EOTB_VIEWS, get description() { return t('mods.eyeOfTheBeholder.AutoTogglePerspective.OnFootSpell.description', 'Which view to take on foot with a spell readied.'); } }),
      'AutoTogglePerspective.OnHorse': Object.freeze({ default: 0, options: EOTB_VIEWS, get description() { return t('mods.eyeOfTheBeholder.AutoTogglePerspective.OnHorse.description', 'Which view to take in the saddle.'); } }),
      'AutoTogglePerspective.OnHorseReady': Object.freeze({ default: 0, options: EOTB_VIEWS, get description() { return t('mods.eyeOfTheBeholder.AutoTogglePerspective.OnHorseReady.description', 'Which view to take in the saddle with something readied.'); } }),
      'AutoTogglePerspective.OnLycan': Object.freeze({ default: 0, options: EOTB_VIEWS, get description() { return t('mods.eyeOfTheBeholder.AutoTogglePerspective.OnLycan.description', 'Which view to take transformed.'); } }),
      'AutoTogglePerspective.OnTransitionInterior': Object.freeze({ default: 0, options: EOTB_VIEWS, get description() { return t('mods.eyeOfTheBeholder.AutoTogglePerspective.OnTransitionInterior.description', 'Which view to take on stepping indoors.'); } }),
      'AutoTogglePerspective.OnTransitionExterior': Object.freeze({ default: 0, options: EOTB_VIEWS, get description() { return t('mods.eyeOfTheBeholder.AutoTogglePerspective.OnTransitionExterior.description', 'Which view to take on stepping back outside.'); } }),
      'Graphics.Enable': Object.freeze({ default: true, get description() { return t('mods.eyeOfTheBeholder.Graphics.Enable.description', 'Show your character sprite'); } }),
      // DISC23-B (2026-09-24, Gryphoth and Scratchie on Discord: "EOTB comes with 16 ground models and different
      // mounted models, it would be nice to be able to change our models like in the original mod" / "the game is not
      // allowing us to choose between the different index slots"): the mod's two SLIDERS, kept sliders (0-15, 0-4, as
      // modsettings.json declares them), each index NAMED - the pane drew a bare number, and "7" is not a sprite anyone
      // can choose by. The names are the mod's own preset titles (modpresets.json: Light Fighters 0, Medium Fighters 2,
      // Heavy Fighter F 4 and M 5, Mage F 6 and M 7, Thief Mage 8/9, Fighter Mage 10/11, Thief 12/13, Fighter Thief
      // 14/15), and the art says the rest: every even set is a woman and every odd set a man, and the five riders are
      // the fighters by their helms and boots (green-booted women, cyan-booted men - the on-foot sets' own colours).
      // SKIN2 (2026-09-25, Mac: "Implement these as new skin options"): Daggerfall's own classes follow the mod's
      // sixteen as 16 onwards (player/classSkins.js) - the mod's range kept as its own, the port's past it.
      'Graphics.OnFoot': Object.freeze({ default: 0, min: 0, max: FOOT_SKIN_COUNT - 1, get description() { return t('mods.eyeOfTheBeholder.Graphics.OnFoot.description', 'Sprite when on foot'); },
        labels: lazyWords(() => t('mods.eyeOfTheBeholder.skin.lightFighterFemale', 'Light Fighter (female)'), () => t('mods.eyeOfTheBeholder.skin.lightFighterMale', 'Light Fighter (male)'),
          () => t('mods.eyeOfTheBeholder.skin.mediumFighterFemale', 'Medium Fighter (female)'), () => t('mods.eyeOfTheBeholder.skin.mediumFighterMale', 'Medium Fighter (male)'),
          () => t('mods.eyeOfTheBeholder.skin.heavyFighterFemale', 'Heavy Fighter (female)'), () => t('mods.eyeOfTheBeholder.skin.heavyFighterMale', 'Heavy Fighter (male)'),
          () => t('mods.eyeOfTheBeholder.skin.mageFemale', 'Mage (female)'), () => t('mods.eyeOfTheBeholder.skin.mageMale', 'Mage (male)'),
          () => t('mods.eyeOfTheBeholder.skin.thiefMageFemale', 'Thief Mage (female)'), () => t('mods.eyeOfTheBeholder.skin.thiefMageMale', 'Thief Mage (male)'),
          () => t('mods.eyeOfTheBeholder.skin.fighterMageFemale', 'Fighter Mage (female)'), () => t('mods.eyeOfTheBeholder.skin.fighterMageMale', 'Fighter Mage (male)'),
          () => t('mods.eyeOfTheBeholder.skin.thiefFemale', 'Thief (female)'), () => t('mods.eyeOfTheBeholder.skin.thiefMale', 'Thief (male)'),
          () => t('mods.eyeOfTheBeholder.skin.fighterThiefFemale', 'Fighter Thief (female)'), () => t('mods.eyeOfTheBeholder.skin.fighterThiefMale', 'Fighter Thief (male)'),
          ...CLASS_SKINS.map((skin) => () => classSkinLabel(skin))) }),   // L10N4: the class skins' names read when they are read, as the mod's are
      'Graphics.OnHorse': Object.freeze({ default: 0, min: 0, max: 4, get description() { return t('mods.eyeOfTheBeholder.Graphics.OnHorse.description', 'Sprite when riding a horse'); },
        labels: lazyWords(() => t('mods.eyeOfTheBeholder.skin.lightFighterFemale', 'Light Fighter (female)'), () => t('mods.eyeOfTheBeholder.skin.mediumFighterMale', 'Medium Fighter (male)'),
          () => t('mods.eyeOfTheBeholder.skin.mediumFighterFemale', 'Medium Fighter (female)'), () => t('mods.eyeOfTheBeholder.skin.heavyFighterMale', 'Heavy Fighter (male)'),
          () => t('mods.eyeOfTheBeholder.skin.heavyFighterFemale', 'Heavy Fighter (female)')) }),
      // LAYERED-GEAR (2026-10-18, the owner: "add a option between those two thats also called On foot Layered Gearing
      // Skin (WIP) Female and Male"): the on-foot body drawn in the helmet, chest and legs armor it wears
      // (player/eyeOfTheBeholder/layeredArmor.js), as a woman or a man - a skin the player chooses on the profile
      // (ui/skinCard.js, its Look toggle), not a feature's dial. 0 off (Skins), 1 female, 2 male, 3 the character's own
      // body - the default (LAYERED-GEAR-ON, 2026-10-19, the owner: "Make sure this is on by default"; layeredArmor.js
      // LAYERED_OWN). The look carries the body as `lg` (net/remotePlayers.js composeLook, wire.js validLook), so other
      // players see it too.
      'Graphics.LayeredGear': Object.freeze({ default: 3, min: 0, max: 3, get description() { return t('mods.eyeOfTheBeholder.Graphics.LayeredGear.description', 'On foot Layered Gearing Skin (WIP): drawn on foot in the helmet, chest and leg armor you wear'); },
        labels: lazyWords(() => t('mods.eyeOfTheBeholder.skin.layeredOff', 'Off'), () => t('mods.eyeOfTheBeholder.skin.layeredFemale', 'Female'),
          () => t('mods.eyeOfTheBeholder.skin.layeredMale', 'Male'), () => t('mods.eyeOfTheBeholder.skin.layeredOwn', 'Your own body')) }),
      'Graphics.ReadyStance': Object.freeze({ default: 2, options: lazyWords(() => t('mods.eyeOfTheBeholder.option.never', 'Never'), () => t('mods.eyeOfTheBeholder.option.whenIdle', 'When Idle'), () => t('mods.eyeOfTheBeholder.option.whenIdleOrMoving', 'When Idle or Moving')), get description() { return t('mods.eyeOfTheBeholder.Graphics.ReadyStance.description', 'Whether the sprite will change states when readying a weapon or spell'); } }),
      'Graphics.TurnToView': Object.freeze({ default: 2, options: lazyWords(() => t('mods.eyeOfTheBeholder.option.never', 'Never'), () => t('mods.eyeOfTheBeholder.option.onlyWhenAnimating', 'Only When Animating'), () => t('mods.eyeOfTheBeholder.option.whenWeaponReadied', 'When Weapon Readied'), () => t('mods.eyeOfTheBeholder.option.always', 'Always')), get description() { return t('mods.eyeOfTheBeholder.Graphics.TurnToView.description', 'When the sprite turns to face where you look'); } }),
      'Graphics.AttackStrings': Object.freeze({ default: 3, options: lazyWords(() => localizedText('none', 'None'), () => t('mods.eyeOfTheBeholder.option.mirror', 'Mirror'), () => t('mods.eyeOfTheBeholder.option.pingPong', 'PingPong'), () => t('mods.eyeOfTheBeholder.option.mixed', 'Mixed')), get description() { return t('mods.eyeOfTheBeholder.Graphics.AttackStrings.description', 'Extra attack animations. Here PingPong looks the same as None, and Mixed the same as Mirror.'); } }),
      'Graphics.MirrorTime': Object.freeze({ default: 3.0, min: 1, max: 5, float: true, get description() { return t('mods.eyeOfTheBeholder.Graphics.MirrorTime.description', 'Seconds before a mirrored sprite turns back. 0 turns this off.'); } }),
      'Graphics.PingPongOffset': Object.freeze({ default: 1, min: -3, max: 3, get description() { return t('mods.eyeOfTheBeholder.Graphics.PingPongOffset.description', 'Has no effect here: attacks never play backwards in this game.'); } }),
      'Graphics.FirstPersonBillboard': Object.freeze({ default: 1, options: lazyWords(() => localizedText('none', 'None'), () => t('mods.eyeOfTheBeholder.option.shadowsOnly', 'Shadows Only'), () => t('mods.eyeOfTheBeholder.option.visible', 'Visible')), get description() { return t('mods.eyeOfTheBeholder.Graphics.FirstPersonBillboard.description', 'Whether your character sprite shows in first person'); } }),
      'Graphics.ShowCart': Object.freeze({ default: true, get description() { return t('mods.eyeOfTheBeholder.Graphics.ShowCart.description', 'A 3D cart follows you when you travel with your cart'); } }),
      'Graphics.TorchOffset': Object.freeze({ default: 1, options: lazyWords(() => t('mods.eyeOfTheBeholder.option.vanilla', 'Vanilla'), () => t('mods.eyeOfTheBeholder.option.billboard', 'Billboard'), () => t('mods.eyeOfTheBeholder.option.selfie', 'Selfie')), get description() { return t('mods.eyeOfTheBeholder.Graphics.TorchOffset.description', 'Whether the torch follows the orientation of the sprite'); } }),
      'Animation.WalkCycleSpeed': Object.freeze({ default: 1.0, min: 0.5, max: 1.5, float: true, get description() { return t('mods.eyeOfTheBeholder.Animation.WalkCycleSpeed.description', 'Multiplier on how fast the walk cycle plays.'); } }),
      'Animation.SyncFootsteps': Object.freeze({ default: true, get description() { return t('mods.eyeOfTheBeholder.Animation.SyncFootsteps.description', 'Footstep sounds match the sprite’s steps.'); } }),
      'Animation.BillboardScale': Object.freeze({ default: 1.0, min: 0, max: 10, float: true, get description() { return t('mods.eyeOfTheBeholder.Animation.BillboardScale.description', 'Size of the player sprite.'); } }),
      'Animation.FineBillboardScale': Object.freeze({ default: 0.0, min: 0, max: 1, float: true, get description() { return t('mods.eyeOfTheBeholder.Animation.FineBillboardScale.description', 'Added to BillboardScale, for a finer adjustment.'); } }),
      'Animation.GlobalOffsetScale': Object.freeze({ default: 1.0, min: 0, max: 10, float: true, get description() { return t('mods.eyeOfTheBeholder.Animation.GlobalOffsetScale.description', 'Has no effect: the mod never uses this setting.'); } }),
      'Animation.FineGlobalOffsetScale': Object.freeze({ default: 0.0, min: 0, max: 1, float: true, get description() { return t('mods.eyeOfTheBeholder.Animation.FineGlobalOffsetScale.description', 'Has no effect: the mod never uses this setting.'); } }),
      'Compatibility.Don\'tHideWeapon': Object.freeze({ default: false, get description() { return t('mods.eyeOfTheBeholder.Compatibility.DontHideWeapon.description', 'Keeps the first-person weapon on screen in third person'); } }),
      'Compatibility.Don\'tHideHorse': Object.freeze({ default: false, get description() { return t('mods.eyeOfTheBeholder.Compatibility.DontHideHorse.description', 'Keeps the first-person horse on screen in third person'); } }),
      'Compatibility.Don\'tOffsetAttacks': Object.freeze({ default: false, get description() { return t('mods.eyeOfTheBeholder.Compatibility.DontOffsetAttacks.description', 'Attacks start from the camera instead of your character’s body'); } }),
      'Debug.ShowMessages': Object.freeze({ default: true, get description() { return t('mods.eyeOfTheBeholder.Debug.ShowMessages.description', 'Shows a message when the view or shoulder changes.'); } }),
    }),
  }),
  // IF1 (2026-09-16, Mac: "Next mod we will be adding 1:1"): IMMERSIVE
  // FOOTSTEPS 1.01 (Kirk.O). The shipped modsettings.json's four sections
  // and ten keys, section and name joined with a dot, the port's own
  // `Enabled` in front (MO1: on by default). The mod ships its clips in
  // two qualities and LoadAudio picks by SoundClipQuality; the two
  // ErrorLogging keys and the compat-warning key are declared so the pane
  // matches the mod's, though the port has no log file to spam and no
  // Better Ambience / Tempered Interiors / Travel Options to warn about.
  'immersive-footsteps': Object.freeze({
    title: 'Immersive Footsteps',
    author: 'Kirk.O',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        get description() { return t('mods.immersiveFootsteps.Enabled.description', 'Footsteps that match the ground you walk on, and armour that rattles as you move.'); },
      }),
      'AudioQualitySettings.SoundClipQuality': Object.freeze({ default: 0, options: lazyWords(() => t('mods.immersiveFootsteps.option.lowQualityRetro', 'Low-Quality (Retro)'), () => t('mods.immersiveFootsteps.option.highQuality', 'High-Quality')), get description() { return t('mods.immersiveFootsteps.AudioQualitySettings.SoundClipQuality.description', 'Quality of the footstep sounds'); } }),
      'FootstepSettings.AllowFootstepSounds': Object.freeze({ default: true, get description() { return t('mods.immersiveFootsteps.FootstepSettings.AllowFootstepSounds.description', 'Your footsteps make a sound'); } }),
      'FootstepSettings.FootstepVolumeMulti': Object.freeze({ default: 1.0, min: 0.0, max: 10.0, float: true, step: 0.1, get description() { return t('mods.immersiveFootsteps.FootstepSettings.FootstepVolumeMulti.description', 'Volume of footstep sounds'); } }),
      'FootstepSettings.FootstepFrequency': Object.freeze({ default: 0.6, min: 0.3, max: 3.0, float: true, step: 0.1, get description() { return t('mods.immersiveFootsteps.FootstepSettings.FootstepFrequency.description', 'How often footsteps sound. Lower is more often'); } }),
      'ArmorSwaySettings.AllowArmorSwaySounds': Object.freeze({ default: true, get description() { return t('mods.immersiveFootsteps.ArmorSwaySettings.AllowArmorSwaySounds.description', 'Your armor makes a sound as you move'); } }),
      'ArmorSwaySettings.ArmorSwayVolumeMulti': Object.freeze({ default: 1.0, min: 0.0, max: 10.0, float: true, step: 0.1, get description() { return t('mods.immersiveFootsteps.ArmorSwaySettings.ArmorSwayVolumeMulti.description', 'Volume of armor sounds'); } }),
      'ArmorSwaySettings.ArmorSwayFrequency': Object.freeze({ default: 0.6, min: 0.3, max: 3.0, float: true, step: 0.1, get description() { return t('mods.immersiveFootsteps.ArmorSwaySettings.ArmorSwayFrequency.description', 'How often armor sounds play. Lower is more often'); } }),
      'ErrorLoggingAndCompatibilitySettings.AllowModCompatWarnings': Object.freeze({ default: true, get description() { return t('mods.immersiveFootsteps.ErrorLoggingAndCompatibilitySettings.AllowModCompatWarnings.description', 'Warns you when another mod clashes with this one'); } }),
      'ErrorLoggingAndCompatibilitySettings.AllowVerboseErrorLogging': Object.freeze({ default: false, get description() { return t('mods.immersiveFootsteps.ErrorLoggingAndCompatibilitySettings.AllowVerboseErrorLogging.description', 'Has no effect here: this game keeps no error log.'); } }),
      'ErrorLoggingAndCompatibilitySettings.DoNotSpamExceptionsLogs': Object.freeze({ default: true, get description() { return t('mods.immersiveFootsteps.ErrorLoggingAndCompatibilitySettings.DoNotSpamExceptionsLogs.description', 'Has no effect here: this game keeps no error log.'); } }),
    }),
  }),
  // BA1 (2026-09-16, Mac: "Next mod to integrate 1:1 ensuring compatibility"):
  // BETTER AMBIENCE 0.1.4 (Joshua Steinhauer). The shipped modsettings.json's
  // six sections and twenty keys, section and name joined with a dot (the
  // section names carry spaces, as the mod wrote them: 'Better Footsteps.enable'),
  // the port's own `Enabled` in front (MO1). ONE DEPARTURE FROM THE SHIPPED
  // KEYS: `Better Footsteps.enable` ships OFF. The mod ships it on, and so
  // does Immersive Footsteps ship its own stride on - and Immersive Footsteps'
  // author wrote the ruling (ImmersiveFootstepsMain.cs:424-449): with both
  // on "you will be constantly hearing overlapping footstep sounds", so
  // "you should always have Better Ambience's 'Better Footsteps' setting
  // disabled", and it posts a warning box at every game start until you do.
  // This port ships the pair the way that author says a player should run
  // them, and ports his warning for the player who turns both on anyway.
  // BA2 (2026-09-17, Mac: "before any lighting work/the ambient mod that was
  // introduced I really liked how the dungeons were properly dark ... is
  // there any way to reintroduce that properly?"): THE SECOND DEPARTURE.
  // `Dungeon Lighting.enableFogAmbientEffect` ships OFF. The mod ships it
  // on, and on it replaces DFU's flat 0.12 dungeon ambient with a Trilight
  // grey of ~0.40 tinted toward the dungeon's fog colour - three times the
  // classic dark, and past the Dungeon Brightness setting, which only
  // scales the flat ambient. Off, a dungeon is as dark as DFU's (and, under
  // the enhanced lane, EL4's dark on top); the fog and the reverb stay as
  // shipped, and a player who sets the toggle keeps it. The other departure
  // is the footsteps' above.
  // Every other module ships as the mod ships it. The keys the mod wrote no
  // description for carry the port's words (the pin requires one).
  'better-ambience': Object.freeze({
    title: 'Better Ambience',
    author: 'Joshua Steinhauer',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        get description() {
          return t('mods.betterAmbience.Enabled.description', 'The camera shakes when you’re hurt, each dungeon gets its own fog, light and echo, and you can hear '
            + 'rain indoors.');
        },
      }),
      'Better Footsteps.enable': Object.freeze({ default: false, get description() { return t('mods.betterAmbience.BetterFootsteps.enable.description', 'Plays Better Ambience’s own footstep sounds'); } }),
      'Better Footsteps.armorVolume': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, get description() { return t('mods.betterAmbience.BetterFootsteps.armorVolume.description', 'Volume for armor clanking'); } }),
      'Better Footsteps.footstepVolume': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, get description() { return t('mods.betterAmbience.BetterFootsteps.footstepVolume.description', 'Volume for footsteps'); } }),
      'Dungeon Reverb.level': Object.freeze({ default: 1, options: lazyWords(() => localizedText('low', 'Low'), () => localizedText('medium', 'Medium'), () => localizedText('high', 'High')), get description() { return t('mods.betterAmbience.DungeonReverb.level.description', 'How much a dungeon echoes: Low is a cave, Medium a stone room, High a quarry.'); } }),
      'Camera Shake.shakeAmountAdd': Object.freeze({ default: 0.0, min: 0.0, max: 20.0, float: true, step: 0.5, get description() { return t('mods.betterAmbience.CameraShake.shakeAmountAdd.description', 'Shake added to every hit, before the hit\u2019s own share.'); } }),
      'Camera Shake.shakeAmountMultiplier': Object.freeze({ default: 10.0, min: 0.0, max: 20.0, float: true, step: 0.5, get description() { return t('mods.betterAmbience.CameraShake.shakeAmountMultiplier.description', 'Shake per hit, scaled by the damage as a share of your full health.'); } }),
      'Camera Shake.maxShake': Object.freeze({ default: 10.0, min: 0.1, max: 30.0, float: true, step: 0.5, get description() { return t('mods.betterAmbience.CameraShake.maxShake.description', 'The most one hit can shake the camera.'); } }),
      'Camera Shake.roughness': Object.freeze({ default: 10.0, min: 0.1, max: 30.0, float: true, step: 0.5, get description() { return t('mods.betterAmbience.CameraShake.roughness.description', 'How jarring the shake is: lower is smoother.'); } }),
      'Camera Shake.fadeInTime': Object.freeze({ default: 0.3, min: 0.05, max: 3.0, float: true, step: 0.05, get description() { return t('mods.betterAmbience.CameraShake.fadeInTime.description', 'Seconds the shake takes to build.'); } }),
      'Camera Shake.fadeOutTime': Object.freeze({ default: 0.5, min: 0.05, max: 3.0, float: true, step: 0.05, get description() { return t('mods.betterAmbience.CameraShake.fadeOutTime.description', 'Seconds the shake takes to settle.'); } }),
      'Dungeon Fog.enableFog': Object.freeze({ default: true, get description() { return t('mods.betterAmbience.DungeonFog.enableFog.description', 'Gives each dungeon its own random fog'); } }),
      'Dungeon Fog.maxFogDistance': Object.freeze({ default: 100.0, min: 20.0, max: 200.0, float: true, step: 1, get description() { return t('mods.betterAmbience.DungeonFog.maxFogDistance.description', 'How far past its start the fog can reach, at most'); } }),
      'Dungeon Fog.minFogDistance': Object.freeze({ default: 80.0, min: 20.0, max: 200.0, float: true, step: 1, get description() { return t('mods.betterAmbience.DungeonFog.minFogDistance.description', 'How far past its start the fog reaches, at least'); } }),
      'Dungeon Fog.maxFogStart': Object.freeze({ default: 10.0, min: 0.0, max: 100.0, float: true, step: 1, get description() { return t('mods.betterAmbience.DungeonFog.maxFogStart.description', 'Furthest from you the fog can start'); } }),
      'Dungeon Fog.minFogStart': Object.freeze({ default: 0.0, min: 0.0, max: 100.0, float: true, step: 1, get description() { return t('mods.betterAmbience.DungeonFog.minFogStart.description', 'Nearest to you the fog can start'); } }),
      'Dungeon Lighting.enableFogAmbientEffect': Object.freeze({ default: false, get description() { return t('mods.betterAmbience.DungeonLighting.enableFogAmbientEffect.description', 'Lights each dungeon in the color of its fog'); } }),   // BA2: ships off (see above)
      'Dungeon Lighting.dungeonDarkness': Object.freeze({ default: 1.0, min: 0.0, max: 3.0, float: true, step: 0.1, get description() { return t('mods.betterAmbience.DungeonLighting.dungeonDarkness.description', 'The darkness of dungeons'); } }),
      'Dungeon Lighting.fogAmbientEffect': Object.freeze({ default: 0.2, min: 0.0, max: 1.0, float: true, step: 0.05, get description() { return t('mods.betterAmbience.DungeonLighting.fogAmbientEffect.description', 'How much the random dungeon color affects dungeon lighting'); } }),
      'Better Rain.enableBetterRain': Object.freeze({ default: true, get description() { return t('mods.betterAmbience.BetterRain.enableBetterRain.description', 'Makes rain particles look a bit better'); } }),
      'Better Rain.enableBetterSnow': Object.freeze({ default: true, get description() { return t('mods.betterAmbience.BetterRain.enableBetterSnow.description', 'Makes snow particles look a bit better'); } }),
    }),
  }),
  // ORL1 (2026-09-17): OBLIVION-REMASTER-LIKE LEVELING 0.5.3 - the
  // first MORROWIND mod in this store, and the only one whose switches
  // come out of OpenMW `I.Settings.registerGroup` calls rather than a
  // `modsettings.json`. The mod's own two groups are `levelUpSettings`
  // (settings.lua:10-64) and `skillSettings` (:66-108); their names,
  // minimums and defaults are the mod's, and the DESCRIPTIONS are the
  // author's own English strings out of `l10n/en.yaml` - the pane shows
  // them as they were written, the same law the other mods' rows follow.
  //
  // `Enabled` is the port's, as every vendored mod carries one, and
  // here it decides ONE thing: whether a new character is ever ASKED
  // the question. Off, and chargen never shows the prompt and every
  // character levels the Daggerfall way. It does not change a
  // character who has already answered - `entity.levelingSystem` is on
  // the save and the save is the law (systems/oblivionLeveling.js).
  //
  // `primarySkillsImpact` IS THE PORT'S OWN and has no key in the mod,
  // because Morrowind has no primary skills. Its description says so,
  // so the pane never presents it as the author's work.
  'oblivion-remaster-leveling': Object.freeze({
    title: 'Oblivion Remaster Like Leveling',
    // The archive names no author (no LICENCE, no script header, an
    // empty `.omwaddon` author field). The registry row and the vendor
    // README both carry the same open record; until Mac fills it in,
    // the pane says what is true rather than inventing a name.
    author: 'Nexus Morrowind 56569',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        get description() {
          return t('mods.oblivionRemasterLeveling.Enabled.description', 'Level up like Oblivion Remastered: every skill you raise fills a 100-point bar, and each level gives '
            + 'you virtues to spend on the attributes you choose. New characters are asked which system they want.');
        },
      }),
      attributePoints: Object.freeze({ default: 12, min: 0, max: 60, get description() { return t('mods.oblivionRemasterLeveling.attributePoints.description', 'Amount of points for increasing attributes'); } }),
      maxUpdatableAttribute: Object.freeze({ default: 3, min: 2, max: 8, get description() { return t('mods.oblivionRemasterLeveling.maxUpdatableAttribute.description', 'The number of attributes to be increased in one level up'); } }),
      allowLuckIncrease: Object.freeze({ default: true, get description() { return t('mods.oblivionRemasterLeveling.allowLuckIncrease.description', 'Allow Luck to be increased by more than one point'); } }),
      luckIncreaseCost: Object.freeze({ default: 4, min: 1, max: 20, get description() { return t('mods.oblivionRemasterLeveling.luckIncreaseCost.description', 'Cost to upgrade Luck by one point'); } }),
      // The port's own, for Daggerfall's third tier of chosen skills.
      primarySkillsImpact: Object.freeze({ default: 8, min: 0, max: 100, get description() { return t('mods.oblivionRemasterLeveling.primarySkillsImpact.description', 'Points given by a Primary Skill level up (100 points required to level up). Morrowind has no Primary skills, so this starts equal to Major skills.'); } }),
      majorSkillsImpact: Object.freeze({ default: 8, min: 0, max: 100, get description() { return t('mods.oblivionRemasterLeveling.majorSkillsImpact.description', 'Points given by a Major Skill level up (100 points required to level up)'); } }),
      minorSkillsImpact: Object.freeze({ default: 6, min: 0, max: 100, get description() { return t('mods.oblivionRemasterLeveling.minorSkillsImpact.description', 'Points given by a Minor Skill level up (100 points required to level up)'); } }),
      miscSkillsImpact: Object.freeze({ default: 2, min: 0, max: 100, get description() { return t('mods.oblivionRemasterLeveling.miscSkillsImpact.description', 'Points given by a Misc Skill level up (100 points required to level up)'); } }),
    }),
  }),
  // TO1 (2026-09-17, Mac: "This is the next daggerfall mod we are to
  // implement 1:1"): TRAVEL OPTIONS 1.11 (Hazelnut). Its twelve sections
  // as modsettings.json ships them, the key named section-dot-name;
  // descriptions are the mod's own, verbatim. The shipped file's five
  // unnamed spacer sections ("__", "-", "_", "--", ".") carry no keys
  // and are noted where they fall. Plus the port's `Enabled` (MO1: on).
  //
  // A key with `color` is a ColorKey - DFU has the kind natively
  // (ModSettings.ColorKey) and the port did not until this mod, which
  // has seventeen of them: the fourteen travel-map location colours,
  // the middle-click mark, and the junction map's player and background.
  // The value is an `#rrggbbaa` string; the mod's own presets write the
  // same eight hex digits without the hash ("D77727FF"), and
  // `colorKeyRgba` below reads either.
  'travel-options': Object.freeze({
    title: 'Travel Options',
    author: 'Hazelnut',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        get description() {
          return t('mods.travelOptions.Enabled.description', 'Choose between the original game’s fast travel and a journey you make yourself, sped up to 60 times, '
            + 'with a panel to steer it. Encounters and places along the way stop you, and you can follow the '
            + 'roads. Off brings back the classic travel map with fast travel only.');
        },
      }),
      'CautiousTravel.PlayerControlledCautiousTravel': Object.freeze({ default: true, get description() { return t('mods.travelOptions.CautiousTravel.PlayerControlledCautiousTravel.description', "Enables the travel option \"Cautiously\" to initiate time accelerated travel, instead of vanilla fast travel"); } }),
      'CautiousTravel.SpeedPenalty': Object.freeze({ default: 20, min: 5, max: 40, get description() { return t('mods.travelOptions.CautiousTravel.SpeedPenalty.description', "Speed penalty for travelling cautiously, as a percentage"); } }),
      'CautiousTravel.MaxChanceToAvoidEncounter': Object.freeze({ default: 95, min: 60, max: 100, get description() { return t('mods.travelOptions.CautiousTravel.MaxChanceToAvoidEncounter.description', "Maximum chance to avoid an encounter when travelling cautiously, as a percentage"); } }),
      'CautiousTravel.HealthMinimumPercentage': Object.freeze({ default: 5, min: 0, max: 25, get description() { return t('mods.travelOptions.CautiousTravel.HealthMinimumPercentage.description', "Level of health that will automatically pause the journey when travelling cautiously, as a percentage"); } }),
      'CautiousTravel.FatigueMinimumValue': Object.freeze({ default: 5, min: 0, max: 50, get description() { return t('mods.travelOptions.CautiousTravel.FatigueMinimumValue.description', "Level of fatigue that will automatically pause the journey when travelling cautiously, absolute value"); } }),
      // TO-FIELD2 (Mac, 2026-09-18): "travel options instantly transports
      // you to a destination and theres no travel". DEPARTURE FROM THE
      // MOD'S SHIPPED DEFAULT, on Mac's word, and it is the whole of that
      // report. IsPlayerControlledTravel is an AND over three toggles
      // (travelPopUp.js:"export function isPlayerControlledTravel"): `(cautiousTravel || !speedCautious) &&
      // (stopAtInnsTravel || !sleepModeInn) && !travelShip`. The popup
      // opens with `sleepModeInn = true` - classic Daggerfall's own
      // default, stopping at inns - so with this key false the second
      // clause is false and EVERY default trip fell to DFU's fast
      // travel. A player had to find the Camp Out toggle before the mod
      // they turned on ever ran. Hazelnut ships it false because his
      // mod is opt-in over vanilla; here the walked journey IS the
      // feature, so it is on. The key is still a key: turning it off in
      // the Mods pane restores the mod's own default exactly.
      'StopAtInnsTravel.PlayerControlledInnsTravel': Object.freeze({ default: true, get description() { return t('mods.travelOptions.StopAtInnsTravel.PlayerControlledInnsTravel.description', "Enables the stop for night travel option \"Inns\" to initiate time accelerated travel, instead of fast travel"); } }),
      'ShipTravel.OnlyFromPorts': Object.freeze({ default: true, get description() { return t('mods.travelOptions.ShipTravel.OnlyFromPorts.description', "Restricts ship travel to be possible only from places with ports"); } }),
      'ShipTravel.OnlyToPorts': Object.freeze({ default: false, get description() { return t('mods.travelOptions.ShipTravel.OnlyToPorts.description', "Restricts ship travel to be possible only if destination has a port, if from ports setting is enabled"); } }),
      'GeneralOptions.AllowTargetingMapCoordinates': Object.freeze({ default: true, get description() { return t('mods.travelOptions.GeneralOptions.AllowTargetingMapCoordinates.description', "Allows travel map to target any coordinates using time accelerated travel"); } }),
      'GeneralOptions.LocationPause': Object.freeze({ default: 0, options: lazyWords(() => t('mods.travelOptions.option.off', 'off'), () => t('mods.travelOptions.option.nearby', 'nearby'), () => t('mods.travelOptions.option.entered', 'entered')), get description() { return t('mods.travelOptions.GeneralOptions.LocationPause.description', "Auto pause when encountering a game location during real time accelerated travel"); } }),
      'GeneralOptions.AllowWeather': Object.freeze({ default: false, get description() { return t('mods.travelOptions.GeneralOptions.AllowWeather.description', "Allows weather effects during time accelerated travel"); } }),
      'GeneralOptions.AllowAnnoyingSounds': Object.freeze({ default: false, get description() { return t('mods.travelOptions.GeneralOptions.AllowAnnoyingSounds.description', "Allows footstep and hoof sounds during time accelerated travel"); } }),
      'GeneralOptions.AllowRealGrass': Object.freeze({ default: false, get description() { return t('mods.travelOptions.GeneralOptions.AllowRealGrass.description', 'Has no effect here: Real Grass isn’t included.'); } }),
      // TRAVEL-NAV1 (2026-09-25, Mac: "Improving travel options navigation
      // to properly route around objects and stopping before running into
      // buildings"): THE PORT'S OWN KEY on the mod's pane, as HT-WAIST's is
      // on Handheld Torches' - the vendored modsettings.json does not carry
      // it and its words say so. ON: a journey steers round buildings,
      // walls and rocks and pauses short of what it cannot pass
      // (systems/travel/travelSteer.js). OFF: the mod's own beeline, exactly.
      'GeneralOptions.AvoidObstacles': Object.freeze({ default: true, get description() { return t('mods.travelOptions.GeneralOptions.AvoidObstacles.description', 'Steers time accelerated travel around buildings, walls and rocks, and pauses the journey before walking into something it can’t get round.'); } }),
      // OW-TOGGLE (2026-09-28, Mac: "bring back the original travel option as a toggle. Off by default." - "The normal
      // first person travel accelerated was removed in favor of the overworld travel"): THE PORT'S OWN KEY on the mod's
      // pane, as AvoidObstacles is. ON: a journey is the mod's own, walked in first person as before OW-ONLY - a map
      // pick begins it on the ground, the view does not rise with it and coming down does not stop it
      // (scenes/world.js tvOwnsJourneys, which reads it live - AUDIT OW5 T1). OFF, the default: OW-ONLY.
      'GeneralOptions.FirstPersonTravel': Object.freeze({ default: false, get description() { return t('mods.travelOptions.GeneralOptions.FirstPersonTravel.description', 'Makes time accelerated journeys in first person, on the ground. Off, the enhanced interface makes them in the Overworld view. Takes effect at once.'); } }),
      // TO-ROADS (FIELD BUGS 2026-09-29d, SylviaBun on the Discord: "Travel Options First Person doesn't follow roads like
      // Overworld Travel Options does" - "A way to toggle this behavior to match or not would be nice"): THE PORT'S OWN
      // KEY beside First-Person Travel, the same shape - not in the vendored modsettings.json, on the tile, read live. ON,
      // with First-Person Travel on: a journey picked on the travel map is the Overworld's route - its planner, its legs,
      // its refusals (scenes/world.js tvRoutesJourneys) - walked in first person, the view not raised. OFF, the default:
      // First-Person Travel is the mod's own straight journey, the original travel option Mac asked back.
      'GeneralOptions.FirstPersonTravelFollowsRoads': Object.freeze({ default: false, get description() { return t('mods.travelOptions.GeneralOptions.FirstPersonTravelFollowsRoads.description', 'With First Person Travel on, journeys follow the roads and tracks as Overworld journeys do, and a place with no way there by land can’t be picked. Off, you head straight for your destination. Takes effect at once.'); } }),
      // RATE-LAW (2026-10-04, Mac: "Remove travel options dials" / "Roads now travel at x100 and non roads at x60"): the
      // mod's TimeAcceleration section (DefaultStartingAcceleration, AlwaysUseStartingAcceleration, AccelerationLimit)
      // is not declared - the spinner it started and bounded is gone, and a journey runs at its ground's rate
      // (systems/timeScale.js travelRateOf). The vendored modsettings.json keeps the three; test/systems/travel/to1_travelOptions.test.js
      // names them as the one section the port leaves out.
      'Teleportation.EnablePaidTeleportation': Object.freeze({ default: false, get description() { return t('mods.travelOptions.Teleportation.EnablePaidTeleportation.description', "Enable paid Mages teleportation service for all guild members, before rank 8"); } }),
      // the shipped file's spacer section "__" carries no keys
      'RoadsIntegration.Enable': Object.freeze({ default: true, get description() { return t('mods.travelOptions.RoadsIntegration.Enable.description', "Enhances the travel map with larger location dots for cities & towns, and shows roads & tracks with toggle buttons"); } }),
      'RoadsIntegration.VariableSizeDots': Object.freeze({ default: true, get description() { return t('mods.travelOptions.RoadsIntegration.VariableSizeDots.description', "All locations, except for cities & towns, are rendered as smaller dots"); } }),
      // AUDIT-TO1 I1: the mod ships index 1, "F" - and F is the key SOC5
      // spent on SocialInteract (inputActions.js DEFAULT_BINDINGS), the
      // same collision HT4 moved Handheld Torches' light toggle off.
      // One press did both: the friends card opened AND a road leg
      // began. Of the mod's own six: F is SOC5's, G is Handheld
      // Torches' light toggle (HT4), O its ignite and X its throw
      // (Throwing.ThrowTorchInput above) - so K, index 3, is the one
      // letter nothing in the port or a vendored mod answers. The
      // player may still pick F from the list; this is about what
      // SHIPS. `keyChoice` DECLARES the kind, the way `axis` does, so
      // the HT4 pin walks this choice list as it walks a TextKey and
      // never has to guess whether "U" is a key or a bob shape.
      'RoadsIntegration.FollowPathsKey': Object.freeze({ default: 3, keyChoice: true, options: lazyWords(() => localizedText('none', 'None'), 'F', 'G', 'K', 'O', 'X', () => t('mods.travelOptions.option.customKeyBind', 'Custom Key Bind')), get description() { return t('mods.travelOptions.RoadsIntegration.FollowPathsKey.description', "Sets the key to initiate time accelerated travelling following paths if roads integration enabled"); } }),   // KB1: not read by the mod any more - the key is the registry's action (inputActions.js MOD_ACTIONS); a player's saved value is carried there once (migrateKeyBinds)
      'RoadsIntegration.FollowPathsCustomKeyBind': Object.freeze({ default: "", text: true, get description() { return t('mods.travelOptions.RoadsIntegration.FollowPathsCustomKeyBind.description', "Custom key bind for following paths used if CustomBind set above"); } }),   // KB1: not read by the mod any more - the key is the registry's action (inputActions.js MOD_ACTIONS); a player's saved value is carried there once (migrateKeyBinds)
      'RoadsIntegration.EnableWaterways': Object.freeze({ default: false, get description() { return t('mods.travelOptions.RoadsIntegration.EnableWaterways.description', "Enhances the travel map with rivers and streams with a toggle button"); } }),
      'RoadsIntegration.EnableStreamsToggle': Object.freeze({ default: false, get description() { return t('mods.travelOptions.RoadsIntegration.EnableStreamsToggle.description', "Adds a streams toggle button separate from rivers button"); } }),
      'RoadsIntegration.MarkLocationColor': Object.freeze({ default: '#ffeb05ff', color: true, get description() { return t('mods.travelOptions.RoadsIntegration.MarkLocationColor.description', "The colour used to highlight locations using middle mouse button on travel map"); } }),
      // the shipped file's spacer section "-" carries no keys
      'FastTravelCostScaling.FastTravelCostScaleFactor': Object.freeze({ default: 1, min: 1, max: 10, get description() { return t('mods.travelOptions.FastTravelCostScaling.FastTravelCostScaleFactor.description', "Scales the cost of inns when using standard fast travel, suggest x4-x6 for Climate & Calories."); } }),
      'FastTravelCostScaling.ShipTravelCostScaleFactor': Object.freeze({ default: 1, min: 1, max: 10, get description() { return t('mods.travelOptions.FastTravelCostScaling.ShipTravelCostScaleFactor.description', "Scales the cost of ships when using standard fast travel, suggest x2-x3 for Climate & Calories."); } }),
      // the shipped file's spacer section "_" carries no keys
      'RoadsJunctionMap.Enable': Object.freeze({ default: true, get description() { return t('mods.travelOptions.RoadsJunctionMap.Enable.description', "Enables the junction mini-map"); } }),
      'RoadsJunctionMap.PersistentMap': Object.freeze({ default: false, get description() { return t('mods.travelOptions.RoadsJunctionMap.PersistentMap.description', "Set this to have the junction mini-map always displayed when following paths"); } }),
      'RoadsJunctionMap.ToggleMapOffPaths': Object.freeze({ default: true, get description() { return t('mods.travelOptions.RoadsJunctionMap.ToggleMapOffPaths.description', "Set this to have the junction mini-map toggled when follow key pressed and not on a path"); } }),
      'RoadsJunctionMap.ScreenSize': Object.freeze({ default: 75, min: 40, max: 200, get description() { return t('mods.travelOptions.RoadsJunctionMap.ScreenSize.description', "The width and height the mini-map is rendered on the screen"); } }),
      'RoadsJunctionMap.ScreenPositionX': Object.freeze({ default: 235, min: 0, max: 280, get description() { return t('mods.travelOptions.RoadsJunctionMap.ScreenPositionX.description', "The X coordinate the mini-map is rendered on the screen"); } }),
      'RoadsJunctionMap.ScreenPositionY': Object.freeze({ default: 10, min: 0, max: 160, get description() { return t('mods.travelOptions.RoadsJunctionMap.ScreenPositionY.description', "The Y coordinate the mini-map is rendered on the screen"); } }),
      'RoadsJunctionMap.FilterMode': Object.freeze({ default: 0, options: lazyWords(() => t('mods.travelOptions.option.point', 'Point'), () => t('mods.travelOptions.option.bilinear', 'Bilinear'), () => t('mods.travelOptions.option.trilinear', 'Trilinear')), get description() { return t('mods.travelOptions.RoadsJunctionMap.FilterMode.description', "Pixel filtering to use when rendering the mini-map"); } }),
      'RoadsJunctionMap.Circular': Object.freeze({ default: true, get description() { return t('mods.travelOptions.RoadsJunctionMap.Circular.description', "Draw the mini-map in a circle around the player"); } }),
      'RoadsJunctionMap.PlayerColor': Object.freeze({ default: '#ff0000ff', color: true, get description() { return t('mods.travelOptions.RoadsJunctionMap.PlayerColor.description', "The colour of the player position and direction indicator"); } }),
      'RoadsJunctionMap.Opaque': Object.freeze({ default: false, get description() { return t('mods.travelOptions.RoadsJunctionMap.Opaque.description', "Render the mini-map with an opaque background color"); } }),
      'RoadsJunctionMap.BackgroundColor': Object.freeze({ default: '#327f19ff', color: true, get description() { return t('mods.travelOptions.RoadsJunctionMap.BackgroundColor.description', "The opaque background color to use for the mini-map"); } }),
      // the shipped file's spacer section "--" carries no keys
      // the shipped file's spacer section "." carries no keys
      'LocationColours.DungeonLabyrinth': Object.freeze({ default: '#d77727ff', color: true, get description() { return t('mods.travelOptions.LocationColours.description', "The colour shown on the travel map"); } }),
      'LocationColours.DungeonKeep': Object.freeze({ default: '#bf571bff', color: true, get description() { return t('mods.travelOptions.LocationColours.description', "The colour shown on the travel map"); } }),
      'LocationColours.DungeonRuin': Object.freeze({ default: '#ab330fff', color: true, get description() { return t('mods.travelOptions.LocationColours.description', "The colour shown on the travel map"); } }),
      'LocationColours.Graveyard': Object.freeze({ default: '#930f07ff', color: true, get description() { return t('mods.travelOptions.LocationColours.description', "The colour shown on the travel map"); } }),
      'LocationColours.Coven': Object.freeze({ default: '#0f0f0fff', color: true, get description() { return t('mods.travelOptions.LocationColours.description', "The colour shown on the travel map"); } }),
      'LocationColours.Farm': Object.freeze({ default: '#9b696aff', color: true, get description() { return t('mods.travelOptions.LocationColours.description', "The colour shown on the travel map"); } }),
      'LocationColours.WealthyHome': Object.freeze({ default: '#bc8a8aff', color: true, get description() { return t('mods.travelOptions.LocationColours.description', "The colour shown on the travel map"); } }),
      'LocationColours.PoorHome': Object.freeze({ default: '#7e5159ff', color: true, get description() { return t('mods.travelOptions.LocationColours.description', "The colour shown on the travel map"); } }),
      'LocationColours.Temple': Object.freeze({ default: '#b0cdffff', color: true, get description() { return t('mods.travelOptions.LocationColours.description', "The colour shown on the travel map"); } }),
      'LocationColours.Cult': Object.freeze({ default: '#447cc0ff', color: true, get description() { return t('mods.travelOptions.LocationColours.description', "The colour shown on the travel map"); } }),
      'LocationColours.Tavern': Object.freeze({ default: '#8c5637ff', color: true, get description() { return t('mods.travelOptions.LocationColours.description', "The colour shown on the travel map"); } }),
      'LocationColours.City': Object.freeze({ default: '#e3b490ff', color: true, get description() { return t('mods.travelOptions.LocationColours.description', "The colour shown on the travel map"); } }),
      'LocationColours.Hamlet': Object.freeze({ default: '#c18564ff', color: true, get description() { return t('mods.travelOptions.LocationColours.description', "The colour shown on the travel map"); } }),
      'LocationColours.Village': Object.freeze({ default: '#a56446ff', color: true, get description() { return t('mods.travelOptions.LocationColours.description', "The colour shown on the travel map"); } }),
    }),
  }),
  // IT1 (2026-10-04, the owner: "Actually lets let this be the next mod we integrate 1:1"): IMMERSIVE TRAVEL - kkgobkk's
  // carriages outside the city gates, 1.5, its three sections restated verbatim (vendor/immersive-travel/modsettings.json),
  // the author's own words and spellings, a null or empty description carried as empty. Read live: the map reads them
  // as it opens (systems/immersiveTravel.js readImmersiveTravelSettings), the calculator as it bills - where the mod's
  // static constructors read four of them once a session (the bible's page records it).
  'immersive-travel': Object.freeze({
    title: 'Immersive Travel',
    author: 'kkgobkk',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        description: 'Carriage drivers wait outside the gates of the walled cities. Talk to one and pay the fare to fast '
          + 'travel to a town or village; with Disable Normal Travel on, a carriage is the only fast travel there is.',
      }),
      // IT1: DEPARTURE FROM THE MOD'S SHIPPED DEFAULT (it ships true), on the owner's word that the carriage is instant
      // travel "as an option" - TO-FIELD2's shape. On, the travel map refuses every trip to a place (the mod's
      // ImmersiveTravelPopUp in DFU's) and Travel Options' walked journeys from the map go with it; online the room
      // holds it off (systems/online/onlineLane.js). The key is still a key: turning it on restores the mod's own default.
      'General.DisableNormalTravel': Object.freeze({ default: false, description: 'You can no longer travel from the map, and must use carriages and ships.' }),
      'General.DailyCarriageFee': Object.freeze({ default: 1, min: 0, max: 99, description: 'The fee you must pay to travel with a carriage for every day of travel' }),
      'General.ClearerMapDots': Object.freeze({ default: true, description: 'Draws larger dots depending on town size in the travel map.' }),
      'General.DrawRoads': Object.freeze({ default: true, description: 'Draws roads on the map when Basic Roads is on.' }),
      'General.DrawTracks': Object.freeze({ default: true, description: 'Draws dirt tracks on the map when Basic Roads is on.' }),
      'General.RegionLockedCarriages': Object.freeze({ default: false, description: 'Prevent carriages from travelling to a different region. You must travel from the capital city to leave the region.' }),
      'ShipTravel.DisableShipTravelOutsideDocks': Object.freeze({ default: true, description: 'Prevents you from choosing ship transport mode during land travel' }),
      'ShipTravel.DailyShipCost': Object.freeze({ default: 15, min: 0, max: 99, description: 'Daily cost of renting a ship, if you don’t own one.' }),
      'ShipTravel.DailyCaptainFee': Object.freeze({ default: 10, min: 0, max: 99, description: 'Daily cost of hiring a captain and crew. You pay a captain even if you own the ship.' }),
      'ShipTravel.LimitedRangeInSmallDocks': Object.freeze({ default: true, description: 'Ships in smaller locations will only take you to ports in the same region. To travel to a different region you\'ll need to sail from a city' }),
      'ShipTravel.ShowLargerDocks': Object.freeze({ default: true, description: 'Uses larger dots on the map for locations with a dock.' }),
      'ShipTravel.ShowOnlyDocks': Object.freeze({ default: false, description: 'Hides every location on the map except those that have a dock' }),
      'AllowedDestinations.Cities': Object.freeze({ default: true, description: '' }),
      'AllowedDestinations.Covens': Object.freeze({ default: false, description: '' }),
      'AllowedDestinations.Dungeons': Object.freeze({ default: false, description: '' }),
      'AllowedDestinations.Graveyards': Object.freeze({ default: false, description: '' }),
      'AllowedDestinations.Farms': Object.freeze({ default: false, description: '' }),
      'AllowedDestinations.Hamlets': Object.freeze({ default: true, description: '' }),
      'AllowedDestinations.Homes': Object.freeze({ default: false, description: '' }),
      'AllowedDestinations.Temples': Object.freeze({ default: false, description: '' }),
      'AllowedDestinations.Taverns': Object.freeze({ default: false, description: '' }),
      'AllowedDestinations.Villages': Object.freeze({ default: true, description: '' }),
    }),
  }),
  // PI1 (2026-10-07, Mac: "This is the next mod I would like to integrate (permission has been granted)"): PHYSICAL ITEMS
  // - demifiend000's items in the world as themselves, 0.1.29, its five sections the port reads restated verbatim
  // (vendor/physical-items/modsettings.json), the author's own words. Read live by the layer (systems/physicalItems.js
  // readPhysicalItemsSettings, again whenever this store changes) - the mod reads them at its load and on a settings
  // change (ApplySettings). NOT DECLARED: the Interaction section's four keys (the placement keys P, O and LeftControl,
  // and Character Item Collision) - their placement is not ported (bible/06-Systems/Physical-Items.md), and a key the
  // port never reads is a switch that does nothing.
  'physical-items': Object.freeze({
    title: 'Physical Items',
    author: 'demifiend000',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        description: 'A fallen foe’s gear lands around its body and you pick it up piece by piece. Shift-click an item in your pack, '
          + 'with no wagon or chest open, to drop it in front of you. Magic items and better are outlined.',
      }),
      'Enemy Loot.Physical Enemy Drops': Object.freeze({ default: true, description: 'Shows a fallen enemy’s loot on the ground around it, for the kinds of item turned on below. What the body holds stays the same.' }),
      'Enemy Loot.Impulse Strength': Object.freeze({ default: 200, min: 0, max: 400, description: 'How hard a fallen enemy’s loot is thrown out, in percent. 400 is twice the default, and at 0 the items just fall. Your own throws are not affected.' }),
      'Enemy Categories.Weapons': Object.freeze({ default: true, description: 'Show weapons on the ground when an enemy falls.' }),
      'Enemy Categories.Arrows': Object.freeze({ default: true, description: 'Show arrows on the ground when an enemy falls.' }),
      'Enemy Categories.Armor': Object.freeze({ default: true, description: 'Show armor on the ground when an enemy falls.' }),
      'Enemy Categories.Clothing': Object.freeze({ default: true, description: 'Show clothing on the ground when an enemy falls.' }),
      'Enemy Categories.Ingredients': Object.freeze({ default: true, description: 'Show ingredients on the ground when an enemy falls.' }),
      'Enemy Categories.Gold': Object.freeze({ default: true, description: 'Show gold on the ground when an enemy falls.' }),
      'Enemy Categories.Potions': Object.freeze({ default: true, description: 'Show potions on the ground when an enemy falls.' }),
      'Enemy Categories.Books': Object.freeze({ default: true, description: 'Show books on the ground when an enemy falls.' }),
      'Enemy Categories.Gems': Object.freeze({ default: true, description: 'Show gems on the ground when an enemy falls.' }),
      'Enemy Categories.Jewellery': Object.freeze({ default: true, description: 'Show jewelry on the ground when an enemy falls.' }),
      'Enemy Categories.Maps': Object.freeze({ default: true, description: 'Show maps on the ground when an enemy falls.' }),
      'Enemy Categories.Magic Items': Object.freeze({ default: true, description: 'Show magic items on the ground when an enemy falls.' }),
      'Enemy Categories.Religious Items': Object.freeze({ default: true, description: 'Show religious items on the ground when an enemy falls.' }),
      'Enemy Categories.Quest Items': Object.freeze({ default: true, description: 'Show quest items on the ground when an enemy falls.' }),
      'Enemy Categories.Transportation': Object.freeze({ default: true, description: 'Show transportation on the ground when an enemy falls.' }),
      'Enemy Categories.Other Items': Object.freeze({ default: true, description: 'Show everything not listed above on the ground when an enemy falls.' }),
      'Item Sizes.Weapons': Object.freeze({ default: 0.8, min: 0.1, max: 1.5, float: true, step: 0.01, description: 'Size of weapons on the ground.' }),
      'Item Sizes.Arrows': Object.freeze({ default: 0.32, min: 0.1, max: 1.5, float: true, step: 0.01, description: 'Size of arrows on the ground.' }),
      'Item Sizes.Armor': Object.freeze({ default: 0.65, min: 0.1, max: 1.5, float: true, step: 0.01, description: 'Size of armor on the ground.' }),
      'Item Sizes.Clothing': Object.freeze({ default: 0.52, min: 0.1, max: 1.5, float: true, step: 0.01, description: 'Size of clothing on the ground.' }),
      'Item Sizes.Ingredients': Object.freeze({ default: 0.4, min: 0.1, max: 1.5, float: true, step: 0.01, description: 'Size of ingredients on the ground.' }),
      'Item Sizes.Gold': Object.freeze({ default: 0.4, min: 0.1, max: 1.5, float: true, step: 0.01, description: 'Size of gold on the ground.' }),
      'Item Sizes.Potions': Object.freeze({ default: 0.4, min: 0.1, max: 1.5, float: true, step: 0.01, description: 'Size of potions on the ground.' }),
      'Item Sizes.Books': Object.freeze({ default: 0.4, min: 0.1, max: 1.5, float: true, step: 0.01, description: 'Size of books on the ground.' }),
      'Item Sizes.Gems': Object.freeze({ default: 0.4, min: 0.1, max: 1.5, float: true, step: 0.01, description: 'Size of gems on the ground.' }),
      'Item Sizes.Jewellery': Object.freeze({ default: 0.4, min: 0.1, max: 1.5, float: true, step: 0.01, description: 'Size of jewelry on the ground.' }),
      'Item Sizes.Maps': Object.freeze({ default: 0.4, min: 0.1, max: 1.5, float: true, step: 0.01, description: 'Size of maps on the ground.' }),
      'Item Sizes.Magic Items': Object.freeze({ default: 0.4, min: 0.1, max: 1.5, float: true, step: 0.01, description: 'Size of magic items on the ground.' }),
      'Item Sizes.Religious Items': Object.freeze({ default: 0.4, min: 0.1, max: 1.5, float: true, step: 0.01, description: 'Size of religious items on the ground.' }),
      'Item Sizes.Quest Items': Object.freeze({ default: 0.4, min: 0.1, max: 1.5, float: true, step: 0.01, description: 'Size of quest items on the ground.' }),
      'Item Sizes.Transportation': Object.freeze({ default: 0.4, min: 0.1, max: 1.5, float: true, step: 0.01, description: 'Size of transportation on the ground.' }),
      'Item Sizes.Other Items': Object.freeze({ default: 0.4, min: 0.1, max: 1.5, float: true, step: 0.01, description: 'Size of other items on the ground.' }),
      'Weapon Sizes.Dagger': Object.freeze({ default: 0.0, min: 0.0, max: 1.5, float: true, step: 0.01, description: 'Size of a dagger on the ground. 0 uses the Weapons size.' }),
      'Weapon Sizes.Tanto': Object.freeze({ default: 0.0, min: 0.0, max: 1.5, float: true, step: 0.01, description: 'Size of a tanto on the ground. 0 uses the Weapons size.' }),
      'Weapon Sizes.Staff': Object.freeze({ default: 0.0, min: 0.0, max: 1.5, float: true, step: 0.01, description: 'Size of a staff on the ground. 0 uses the Weapons size.' }),
      'Weapon Sizes.Shortsword': Object.freeze({ default: 0.0, min: 0.0, max: 1.5, float: true, step: 0.01, description: 'Size of a shortsword on the ground. 0 uses the Weapons size.' }),
      'Weapon Sizes.Wakazashi': Object.freeze({ default: 0.0, min: 0.0, max: 1.5, float: true, step: 0.01, description: 'Size of a wakazashi on the ground. 0 uses the Weapons size.' }),
      'Weapon Sizes.Broadsword': Object.freeze({ default: 0.0, min: 0.0, max: 1.5, float: true, step: 0.01, description: 'Size of a broadsword on the ground. 0 uses the Weapons size.' }),
      'Weapon Sizes.Saber': Object.freeze({ default: 0.0, min: 0.0, max: 1.5, float: true, step: 0.01, description: 'Size of a saber on the ground. 0 uses the Weapons size.' }),
      'Weapon Sizes.Longsword': Object.freeze({ default: 0.0, min: 0.0, max: 1.5, float: true, step: 0.01, description: 'Size of a longsword on the ground. 0 uses the Weapons size.' }),
      'Weapon Sizes.Katana': Object.freeze({ default: 0.0, min: 0.0, max: 1.5, float: true, step: 0.01, description: 'Size of a katana on the ground. 0 uses the Weapons size.' }),
      'Weapon Sizes.Claymore': Object.freeze({ default: 0.0, min: 0.0, max: 1.5, float: true, step: 0.01, description: 'Size of a claymore on the ground. 0 uses the Weapons size.' }),
      'Weapon Sizes.Dai Katana': Object.freeze({ default: 0.0, min: 0.0, max: 1.5, float: true, step: 0.01, description: 'Size of a dai katana on the ground. 0 uses the Weapons size.' }),
      'Weapon Sizes.Mace': Object.freeze({ default: 0.0, min: 0.0, max: 1.5, float: true, step: 0.01, description: 'Size of a mace on the ground. 0 uses the Weapons size.' }),
      'Weapon Sizes.Flail': Object.freeze({ default: 0.0, min: 0.0, max: 1.5, float: true, step: 0.01, description: 'Size of a flail on the ground. 0 uses the Weapons size.' }),
      'Weapon Sizes.Warhammer': Object.freeze({ default: 0.0, min: 0.0, max: 1.5, float: true, step: 0.01, description: 'Size of a warhammer on the ground. 0 uses the Weapons size.' }),
      'Weapon Sizes.Battle Axe': Object.freeze({ default: 0.0, min: 0.0, max: 1.5, float: true, step: 0.01, description: 'Size of a battle axe on the ground. 0 uses the Weapons size.' }),
      'Weapon Sizes.War Axe': Object.freeze({ default: 0.0, min: 0.0, max: 1.5, float: true, step: 0.01, description: 'Size of a war axe on the ground. 0 uses the Weapons size.' }),
      'Weapon Sizes.Short Bow': Object.freeze({ default: 0.0, min: 0.0, max: 1.5, float: true, step: 0.01, description: 'Size of a short bow on the ground. 0 uses the Weapons size.' }),
      'Weapon Sizes.Long Bow': Object.freeze({ default: 0.0, min: 0.0, max: 1.5, float: true, step: 0.01, description: 'Size of a long bow on the ground. 0 uses the Weapons size.' }),
      'Weapon Sizes.Arrow': Object.freeze({ default: 0.0, min: 0.0, max: 1.5, float: true, step: 0.01, description: 'Size of an arrow on the ground. 0 uses the Weapons size.' }),
      'Armor Sizes.Cuirass': Object.freeze({ default: 0.0, min: 0.0, max: 1.5, float: true, step: 0.01, description: 'Size of a cuirass on the ground. 0 uses the Armor size.' }),
      'Armor Sizes.Gauntlets': Object.freeze({ default: 0.0, min: 0.0, max: 1.5, float: true, step: 0.01, description: 'Size of gauntlets on the ground. 0 uses the Armor size.' }),
      'Armor Sizes.Greaves': Object.freeze({ default: 0.0, min: 0.0, max: 1.5, float: true, step: 0.01, description: 'Size of greaves on the ground. 0 uses the Armor size.' }),
      'Armor Sizes.Pauldrons': Object.freeze({ default: 0.0, min: 0.0, max: 1.5, float: true, step: 0.01, description: 'Size of pauldrons, left and right, on the ground. 0 uses the Armor size.' }),
      'Armor Sizes.Helm': Object.freeze({ default: 0.0, min: 0.0, max: 1.5, float: true, step: 0.01, description: 'Size of a helm on the ground. 0 uses the Armor size.' }),
      'Armor Sizes.Boots': Object.freeze({ default: 0.0, min: 0.0, max: 1.5, float: true, step: 0.01, description: 'Size of boots on the ground. 0 uses the Armor size.' }),
      'Armor Sizes.Buckler': Object.freeze({ default: 0.0, min: 0.0, max: 1.5, float: true, step: 0.01, description: 'Size of a buckler on the ground. 0 uses the Armor size.' }),
      'Armor Sizes.Round Shield': Object.freeze({ default: 0.0, min: 0.0, max: 1.5, float: true, step: 0.01, description: 'Size of a round shield on the ground. 0 uses the Armor size.' }),
      'Armor Sizes.Kite Shield': Object.freeze({ default: 0.0, min: 0.0, max: 1.5, float: true, step: 0.01, description: 'Size of a kite shield on the ground. 0 uses the Armor size.' }),
      'Armor Sizes.Tower Shield': Object.freeze({ default: 0.0, min: 0.0, max: 1.5, float: true, step: 0.01, description: 'Size of a tower shield on the ground. 0 uses the Armor size.' }),
    }),
  }),
  // HAZE1 / WINDFALL1 / SNOWFALL1 (2026-10-08, Mac: "We have permission to use and implement everything into the
  // codebase. These should be on by default and integrate into our enhanced environments seamlessly"): demifiend000's
  // three environment mods, their modsettings restated verbatim (vendor/heat-haze/, vendor/windfall/ and
  // vendor/snowfall/ modsettings.json) - every name, default, range and description the mod's, section and name joined
  // with a dot. Each mod's own Enabled (Heat Haze's in its one section, Windfall's and Snowfall's in General) IS the
  // port's `Enabled`, the mod's switch, on by default (MO1), with the port's words for the Features row; a slider's
  // `step` is the port's (the pane's grain), chosen so the mod's default sits on it. The three ride the enhanced
  // outdoors (systems/heatHaze.js, systems/windfall.js, systems/snowfall.js say how).
  'heat-haze': Object.freeze({
    title: 'Heat Haze',
    author: 'demifiend000',
    keys: Object.freeze({
      Enabled: Object.freeze({ default: true, description: 'Heat shimmer over the distant desert by day in the enhanced outdoors, strongest under a clear sky, fading in after sunrise and out before sunset.' }),
      'Heat Haze.AllowSubtropical': Object.freeze({ default: false, description: 'Also allow heat haze in subtropical climates during sunny or cloudy daytime weather.' }),
      'Heat Haze.Intensity': Object.freeze({ default: 1.5, min: 0.0, max: 3.0, float: true, step: 0.05, description: 'How strongly the haze bends the view, in pixels.' }),
      'Heat Haze.FullStrengthDistance': Object.freeze({ default: 400.4, min: 50.0, max: 3000.0, float: true, step: 0.1, description: 'Distance from you, in meters, of the ring of haze.' }),
      'Heat Haze.RingHeight': Object.freeze({ default: 1006.0, min: 50.0, max: 1500.0, float: true, step: 2, description: 'Height of the haze, in meters.' }),
      'Heat Haze.NoiseScale': Object.freeze({ default: 4.5, min: 0.25, max: 6.0, float: true, step: 0.05, description: 'How fine the shimmer’s ripples are.' }),
      'Heat Haze.AnimationSpeed': Object.freeze({ default: 4.0, min: 0.0, max: 4.0, float: true, step: 0.1, description: 'Speed of the rising-air motion.' }),
    }),
  }),
  'windfall': Object.freeze({
    title: 'Windfall',
    author: 'demifiend000',
    keys: Object.freeze({
      Enabled: Object.freeze({ default: true, description: 'Wind in the enhanced outdoors that changes by the day. Trees and plants sway, some days turn windy or stormy, gusts come with their own sound, and leaves and snow blow off the trees.' }),
      'General.WindDirectionDegrees': Object.freeze({ default: 35.0, min: 0.0, max: 360.0, float: true, step: 5, description: 'Has no effect here. The enhanced outdoors set the wind’s direction.' }),
      'General.OverallWindyPeriodFrequency': Object.freeze({ default: 100.0, min: 0.0, max: 200.0, float: true, step: 5, description: 'How often windy spells come overall. 100% is the mod’s normal rate.' }),
      'General.NaturalWindstormFrequency': Object.freeze({ default: 100.0, min: 0.0, max: 200.0, float: true, step: 5, description: 'How often a windy spell turns into a windstorm of 1 to 3 hours. At 100%, 8% of them do.' }),
      'General.GustFrequency': Object.freeze({ default: 100.0, min: 0.0, max: 200.0, float: true, step: 5, description: 'How often breezes and gusts come. 0% turns them off, and 200% makes them twice as often.' }),
      'General.GustStrength': Object.freeze({ default: 100.0, min: 0.0, max: 200.0, float: true, step: 5, description: 'How strong gusts are, in motion, leaves and sound. At 0% the steady wind still blows.' }),
      'Normal.Strength': Object.freeze({ default: 0.2, min: 0.0, max: 1.5, float: true, step: 0.01, description: 'How much plants move on a normal day.' }),
      'Normal.SwayAmountPercent': Object.freeze({ default: 1.4, min: 0.0, max: 8.0, float: true, step: 0.1, description: 'How far treetops sway, as a percentage of the tree’s height.' }),
      'Normal.SwaySpeed': Object.freeze({ default: 0.2, min: 0.05, max: 1.5, float: true, step: 0.01, description: 'How fast trees sway, in sways per second.' }),
      'Normal.ShiverAmountPercent': Object.freeze({ default: 0.6, min: 0.0, max: 3.0, float: true, step: 0.05, description: 'How much treetops shiver, as a percentage of the tree’s height.' }),
      'Normal.ShiverSpeed': Object.freeze({ default: 0.6, min: 0.5, max: 8.0, float: true, step: 0.1, description: 'How fast treetops shiver, in shivers per second.' }),
      'Season Frequency.SpringFrequency': Object.freeze({ default: 100.0, min: 0.0, max: 200.0, float: true, step: 5, description: 'How often windy spells come in spring.' }),
      'Season Frequency.SummerFrequency': Object.freeze({ default: 100.0, min: 0.0, max: 200.0, float: true, step: 5, description: 'How often windy spells come in summer.' }),
      'Season Frequency.FallFrequency': Object.freeze({ default: 100.0, min: 0.0, max: 200.0, float: true, step: 5, description: 'How often windy spells come in autumn.' }),
      'Season Frequency.WinterFrequency': Object.freeze({ default: 100.0, min: 0.0, max: 200.0, float: true, step: 5, description: 'How often windy spells come in winter.' }),
      'Regional Frequency.OceanFrequency': Object.freeze({ default: 100.0, min: 0.0, max: 200.0, float: true, step: 5, description: 'How often windy spells come by the sea.' }),
      'Regional Frequency.DesertFrequency': Object.freeze({ default: 100.0, min: 0.0, max: 200.0, float: true, step: 5, description: 'How often windy spells come in the deserts.' }),
      'Regional Frequency.MountainFrequency': Object.freeze({ default: 100.0, min: 0.0, max: 200.0, float: true, step: 5, description: 'How often windy spells come in the mountains.' }),
      'Regional Frequency.RainforestFrequency': Object.freeze({ default: 100.0, min: 0.0, max: 200.0, float: true, step: 5, description: 'How often windy spells come in rainforests.' }),
      'Regional Frequency.SwampFrequency': Object.freeze({ default: 100.0, min: 0.0, max: 200.0, float: true, step: 5, description: 'How often windy spells come in swamps.' }),
      'Regional Frequency.SubtropicalFrequency': Object.freeze({ default: 100.0, min: 0.0, max: 200.0, float: true, step: 5, description: 'How often windy spells come in subtropical lands.' }),
      'Regional Frequency.MountainWoodsFrequency': Object.freeze({ default: 100.0, min: 0.0, max: 200.0, float: true, step: 5, description: 'How often windy spells come in mountain woods.' }),
      'Regional Frequency.WoodlandsFrequency': Object.freeze({ default: 100.0, min: 0.0, max: 200.0, float: true, step: 5, description: 'How often windy spells come in woodlands.' }),
      'Regional Frequency.HauntedWoodlandsFrequency': Object.freeze({ default: 100.0, min: 0.0, max: 200.0, float: true, step: 5, description: 'How often windy spells come in haunted woodlands.' }),
      'Regional Frequency.UnknownFrequency': Object.freeze({ default: 100.0, min: 0.0, max: 200.0, float: true, step: 5, description: 'How often windy spells come in any other climate.' }),
      'Weather Frequency.SunnyFrequency': Object.freeze({ default: 100.0, min: 0.0, max: 200.0, float: true, step: 5, description: 'How often windy spells come in sunny weather.' }),
      'Weather Frequency.CloudyFrequency': Object.freeze({ default: 100.0, min: 0.0, max: 200.0, float: true, step: 5, description: 'How often windy spells come in cloudy weather.' }),
      'Weather Frequency.OvercastFrequency': Object.freeze({ default: 100.0, min: 0.0, max: 200.0, float: true, step: 5, description: 'How often windy spells come in overcast weather.' }),
      'Weather Frequency.FogFrequency': Object.freeze({ default: 100.0, min: 0.0, max: 200.0, float: true, step: 5, description: 'How often windy spells come in fog.' }),
      'Weather Frequency.RainFrequency': Object.freeze({ default: 100.0, min: 0.0, max: 200.0, float: true, step: 5, description: 'How often windy spells come in rain. Wind in rain is also 15% stronger.' }),
      'Weather Frequency.SnowFrequency': Object.freeze({ default: 100.0, min: 0.0, max: 200.0, float: true, step: 5, description: 'How often windy spells come in snow. Wind in snow is also 10% stronger.' }),
      'Windy Day.Strength': Object.freeze({ default: 0.2, min: 0.0, max: 1.5, float: true, step: 0.01, description: 'How much plants move on a windy day.' }),
      'Windy Day.SwayAmountPercent': Object.freeze({ default: 2.6, min: 0.0, max: 8.0, float: true, step: 0.1, description: 'How far treetops sway, as a percentage of the tree’s height.' }),
      'Windy Day.SwaySpeed': Object.freeze({ default: 0.6, min: 0.05, max: 1.5, float: true, step: 0.01, description: 'How fast trees sway, in sways per second.' }),
      'Windy Day.ShiverAmountPercent': Object.freeze({ default: 1.2, min: 0.0, max: 3.0, float: true, step: 0.05, description: 'How much treetops shiver, as a percentage of the tree’s height.' }),
      'Windy Day.ShiverSpeed': Object.freeze({ default: 1.1, min: 0.5, max: 8.0, float: true, step: 0.1, description: 'How fast treetops shiver, in shivers per second.' }),
      'Gust.Strength': Object.freeze({ default: 0.6, min: 0.0, max: 1.5, float: true, step: 0.01, description: 'How much plants move at the height of a gust.' }),
      'Gust.SwayAmountPercent': Object.freeze({ default: 2.6, min: 0.0, max: 8.0, float: true, step: 0.1, description: 'How far treetops sway, as a percentage of the tree’s height.' }),
      'Gust.SwaySpeed': Object.freeze({ default: 0.8, min: 0.05, max: 1.5, float: true, step: 0.01, description: 'How fast trees sway, in sways per second.' }),
      'Gust.ShiverAmountPercent': Object.freeze({ default: 1.2, min: 0.0, max: 3.0, float: true, step: 0.05, description: 'How much treetops shiver, as a percentage of the tree’s height.' }),
      'Gust.ShiverSpeed': Object.freeze({ default: 1.7, min: 0.5, max: 8.0, float: true, step: 0.1, description: 'How fast treetops shiver, in shivers per second.' }),
      'Storm.Strength': Object.freeze({ default: 0.6, min: 0.0, max: 1.5, float: true, step: 0.01, description: 'How much plants move in a storm.' }),
      'Storm.SwayAmountPercent': Object.freeze({ default: 2.6, min: 0.0, max: 8.0, float: true, step: 0.1, description: 'How far treetops sway, as a percentage of the tree’s height.' }),
      'Storm.SwaySpeed': Object.freeze({ default: 0.8, min: 0.05, max: 1.5, float: true, step: 0.01, description: 'How fast trees sway, in sways per second.' }),
      'Storm.ShiverAmountPercent': Object.freeze({ default: 1.2, min: 0.0, max: 3.0, float: true, step: 0.05, description: 'How much treetops shiver, as a percentage of the tree’s height.' }),
      'Storm.ShiverSpeed': Object.freeze({ default: 1.7, min: 0.5, max: 8.0, float: true, step: 0.1, description: 'How fast treetops shiver, in shivers per second.' }),
      'Presentation.AudioEnabled': Object.freeze({ default: true, description: 'Plays the sounds of passing wind, gusts and rustling trees.' }),
      'Presentation.AudioVolume': Object.freeze({ default: 0.5, min: 0.0, max: 1.0, float: true, step: 0.01, description: 'Overall volume of the wind and rustling leaves.' }),
      'Presentation.RegularWindVolume': Object.freeze({ default: 100.0, min: 0.0, max: 200.0, float: true, step: 5, description: 'Volume of the steady breeze and of windy and stormy weather.' }),
      'Presentation.GustVolume': Object.freeze({ default: 100.0, min: 0.0, max: 200.0, float: true, step: 5, description: 'Volume of short gusts.' }),
      'Presentation.FoliageRuffleVolume': Object.freeze({ default: 100.0, min: 0.0, max: 200.0, float: true, step: 5, description: 'Volume of rustling leaves.' }),
      'Presentation.LeavesEnabled': Object.freeze({ default: true, description: 'Leaves blow about where the climate and season have them.' }),
      'Presentation.LeafAmount': Object.freeze({ default: 2.4, min: 0.0, max: 3.0, float: true, step: 0.05, description: 'How many leaves a gust blows off.' }),
      'Presentation.AmbientLeafAmount': Object.freeze({ default: 1.0, min: 0.0, max: 3.0, float: true, step: 0.05, description: 'How many leaves fall near trees. More fall on windy days and in storms.' }),
      'Presentation.SnowFlurriesEnabled': Object.freeze({ default: true, description: 'Snow drifts and blows off snow-covered trees in winter.' }),
      'Presentation.SnowFlurryAmount': Object.freeze({ default: 1.0, min: 0.0, max: 3.0, float: true, step: 0.05, description: 'How much snow blows off the trees.' }),
    }),
  }),
  'snowfall': Object.freeze({
    title: 'Snowfall',
    author: 'demifiend000',
    keys: Object.freeze({
      Enabled: Object.freeze({ default: true, description: 'Deep snow on the ground in winter in the enhanced outdoors, thicker in the wild than in towns. It builds while snow falls, melts in clear weather and shows the tracks of everyone who walks through it.' }),
      'General.ActivationOverride': Object.freeze({ default: 0, options: Object.freeze(['Auto', 'Force On', 'Force Off']), description: 'When the deep snow appears: Auto in winter outside the deserts, Force On always, Force Off never.' }),
      'Surface.SnowRadius': Object.freeze({ default: 32.0, min: 16.0, max: 64.0, float: true, step: 1, description: 'How far around you, in meters, the detailed snow reaches. Larger is less detailed.' }),
      'Surface.MeshResolution': Object.freeze({ default: 2, options: Object.freeze(['97', '129', '161']), description: 'Detail of the snow around you. Higher looks smoother and costs more.' }),
      'Surface.MaskResolution': Object.freeze({ default: 1, options: Object.freeze(['128', '256', '512']), description: 'Detail of the tracks in the snow. Changing it keeps the tracks already made.' }),
      'Surface.RecenterDistance': Object.freeze({ default: 6.0, min: 2.0, max: 12.0, float: true, step: 0.25, description: 'How far you move, in meters, before the detailed snow recenters on you.' }),
      'Surface.MaxSnowSlope': Object.freeze({ default: 55.0, min: 30.0, max: 75.0, float: true, step: 1, description: 'Slopes this steep, in degrees, get only a thin coat of snow.' }),
      'Snowpack.SettlementMinimumDepth': Object.freeze({ default: 0.2, min: 0.1, max: 1.0, float: true, step: 0.01, description: 'Starting and least snow depth, in meters, in towns and at farms, homes, dungeons, temples, taverns and graveyards.' }),
      'Snowpack.SettlementMaximumDepth': Object.freeze({ default: 0.4, min: 0.1, max: 1.0, float: true, step: 0.01, description: 'Most snow depth, in meters, in towns and other places on the map.' }),
      'Snowpack.WildernessMinimumDepth': Object.freeze({ default: 0.4, min: 0.1, max: 1.0, float: true, step: 0.01, description: 'Starting and least snow depth in the wilderness, in meters.' }),
      'Snowpack.WildernessMaximumDepth': Object.freeze({ default: 0.8, min: 0.1, max: 1.0, float: true, step: 0.01, description: 'Most snow depth in the wilderness, in meters.' }),
      'Snowpack.SnowfallDepthStep': Object.freeze({ default: 0.1, min: 0.01, max: 0.2, float: true, step: 0.001, description: 'Meters of snow added after each spell of steady snowfall.' }),
      'Snowpack.SnowfallDepthHours': Object.freeze({ default: 3.0, min: 0.25, max: 24.0, float: true, step: 0.25, description: 'Hours of steady snowfall before the snow gets deeper.' }),
      'Snowpack.MeltDepthStep': Object.freeze({ default: 0.1, min: 0.01, max: 0.2, float: true, step: 0.001, description: 'Meters of snow that melt after each spell of clear weather.' }),
      'Snowpack.MeltDepthHours': Object.freeze({ default: 72.0, min: 1.0, max: 240.0, float: true, step: 1, description: 'Hours without snow before some of it melts.' }),
      'Snowpack.DebugSnowDepthOverride': Object.freeze({ default: 0.0, min: 0.0, max: 0.8, float: true, step: 0.01, description: 'For testing: above 0, sets one snow depth everywhere. Leave it at 0.' }),
      'Context.SettlementBoundaryFeather': Object.freeze({ default: 8.0, min: 0.0, max: 32.0, float: true, step: 0.5, description: 'How many meters the snow takes to deepen past the edge of a town.' }),
      'Context.LocationLoaderIntegration': Object.freeze({ default: true, description: 'Has no effect here: this game doesn’t use Location Loader.' }),
      'Context.LocationLoaderMaximumDepth': Object.freeze({ default: 0.1, min: 0.1, max: 1.0, float: true, step: 0.01, description: 'Has no effect here: this game doesn’t use Location Loader.' }),
      'Context.LocationLoaderBoundaryFeather': Object.freeze({ default: 4.0, min: 0.0, max: 32.0, float: true, step: 0.5, description: 'Has no effect here: this game doesn’t use Location Loader.' }),
      'Basic Roads.Enabled': Object.freeze({ default: true, description: 'Keeps snow shallow on roads and tracks, with snow banks beside them.' }),
      'Basic Roads.PathMaximumDepth': Object.freeze({ default: 0.1, min: 0.1, max: 1.0, float: true, step: 0.01, description: 'Most snow depth on roads and tracks, in meters.' }),
      'Basic Roads.PathFeather': Object.freeze({ default: 1.0, min: 0.0, max: 4.0, float: true, step: 0.1, description: 'How many meters the snow takes to deepen beside a road.' }),
      'Basic Roads.BermsEnabled': Object.freeze({ default: true, description: 'Banks of snow along the main roads.' }),
      'Basic Roads.BermRise': Object.freeze({ default: 0.05, min: 0.0, max: 0.1, float: true, step: 0.001, description: 'Height of the snow banks, in meters.' }),
      'Basic Roads.BermWidth': Object.freeze({ default: 2.0, min: 0.0, max: 4.0, float: true, step: 0.1, description: 'Width of the snow banks, in meters.' }),
      'Visual.TextureWorldSize': Object.freeze({ default: 4.0, min: 1.0, max: 12.0, float: true, step: 0.25, description: 'Size of the snow pattern, in meters.' }),
      'Visual.CompressionDarkening': Object.freeze({ default: 0.18, min: 0.0, max: 0.5, float: true, step: 0.01, description: 'How much darker packed snow looks.' }),
      'Visual.ImpressionStrength': Object.freeze({ default: 1.0, min: 0.0, max: 1.0, float: true, step: 0.01, description: 'How deep and narrow the middle of a track is.' }),
      'Visual.ImpressionShoulderWidth': Object.freeze({ default: 0.5, min: 0.0, max: 1.0, float: true, step: 0.01, description: 'Width, in meters, of the sloped edge on each side of a track.' }),
      'Distance Prototype.Enabled': Object.freeze({ default: true, description: 'Covers the land beyond your surroundings in snow too. Off, the deep snow is only near you.' }),
      'Distance Prototype.DistantTracks': Object.freeze({ default: true, description: 'Shows tracks as dark marks in the distant snow, out to 320 meters.' }),
      'Player.TrackWidth': Object.freeze({ default: 0.7, min: 0.3, max: 1.4, float: true, step: 0.01, description: 'Width of your tracks, in meters.' }),
      'Player.RemainingSnow': Object.freeze({ default: 0.18, min: 0.05, max: 0.8, float: true, step: 0.01, description: 'How much snow is left in the middle of your tracks, as a fraction.' }),
      'Player.StampSpacing': Object.freeze({ default: 0.25, min: 0.1, max: 0.8, float: true, step: 0.01, description: 'How far you move, in meters, between footprints.' }),
      'NPC Tracks.Enabled': Object.freeze({ default: true, description: 'Enemies and townsfolk leave tracks too. Off keeps the tracks already made.' }),
      'NPC Tracks.TrackWidth': Object.freeze({ default: 0.55, min: 0.3, max: 1.4, float: true, step: 0.01, description: 'Least width of their tracks, in meters.' }),
      'NPC Tracks.RemainingSnow': Object.freeze({ default: 0.28, min: 0.05, max: 0.8, float: true, step: 0.01, description: 'How much snow is left in the middle of their tracks, as a fraction.' }),
      'NPC Tracks.StampSpacing': Object.freeze({ default: 0.5, min: 0.2, max: 1.5, float: true, step: 0.01, description: 'How far they move, in meters, between footprints.' }),
      'Refill.PassiveRefillHours': Object.freeze({ default: 12.0, min: 0.0, max: 48.0, float: true, step: 1, description: 'About how many hours tracks take to fill in. 0 fills them at once.' }),
      'Refill.SnowfallRefillHours': Object.freeze({ default: 1.5, min: 0.1, max: 12.0, float: true, step: 0.1, description: 'About how many hours tracks take to fill in while snow falls.' }),
    }),
  }),
  // HCC (2026-09-23, Mac: "Next mod I want to implement 1 to 1 and also
  // enhance its online integration functionality"): HORSE CART AND CARGO -
  // demifiend000's persistent horse and wagon, 1.0.0-rc12, its five
  // sections restated verbatim (vendor/horse-cart-and-cargo/modsettings.json).
  // The two TextKeys are Unity KeyCode names. THE PORT SHIPS THEM ON 5 AND 6
  // (Alpha5 / Alpha6), NOT THE MOD'S K AND G (HCC-KEYS, a recorded departure
  // on HT4's own law): K is Travel Options' FollowPathsKey and G is Handheld
  // Torches' ManualDropInput here, both vendored before this mod, and every
  // letter is spent - DFU's bindings, the port's own, the other mods'.
  // AUDIT HCC K1: the first departure shipped F7 and F10 and neither was
  // free. F10 is DFU's own LargeHUDToggle and Shift-F10 its HUDToggle
  // (DialogShortcuts.txt, systems/dialogShortcuts.js) - the HUD shortcuts
  // are world keys, not a window's, so one press flipped the HUD AND
  // summoned the team - and F7 is the browser's caret-browsing prompt.
  // The digits past the four quick slots are free on every count: DFU's
  // bindings, its world shortcuts, every vendored mod, and the browser.
  // The notes say the port's control, not the mod's text box: the Mods
  // pane captures a key, and its clear writes `None`, which disables one.
  'horse-cart-and-cargo': Object.freeze({
    title: 'Horse Cart and Cargo',
    author: 'demifiend000',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        get description() {
          return t('mods.horseCartAndCargo.Enabled.description', 'Your horse and cart stay in the world: they wait where you get off, follow you or stay on command, '
            + 'and you hitch or mount them by walking up to them. Online, other players see them where you left '
            + 'them.');
        },
      }),
      'Persistence.PhysicalPersistence': Object.freeze({ default: true, get description() { return t('mods.horseCartAndCargo.Persistence.PhysicalPersistence.description', 'Your horse and wagon stay where you leave them. Off, they are always with you, as in the classic game.'); } }),
      'Presentation.ShowTrailingWagon': Object.freeze({ default: true, get description() { return t('mods.horseCartAndCargo.Presentation.ShowTrailingWagon.description', 'Shows the wagon trailing behind you when you ride with your cart. Off hides only that wagon.'); } }),
      'Following.HorseFollowDistance': Object.freeze({ default: 3, min: 2, max: 8, get description() { return t('mods.horseCartAndCargo.Following.HorseFollowDistance.description', 'How closely a following horse, or horse and wagon, stays behind you.'); } }),
      'Following.AvoidCombat': Object.freeze({ default: true, get description() { return t('mods.horseCartAndCargo.Following.AvoidCombat.description', 'A following horse, or horse and wagon, keeps away from enemies in a fight.'); } }),
      'Following.FollowFastTravel': Object.freeze({ default: true, get description() { return t('mods.horseCartAndCargo.Following.FollowFastTravel.description', 'A following horse or wagon comes with you when you fast travel. Off, it waits where it was.'); } }),
      'WagonAccess.InteriorAccessDistance': Object.freeze({ default: 50, min: 10, max: 100, get description() { return t('mods.horseCartAndCargo.WagonAccess.InteriorAccessDistance.description', 'How close to a building or dungeon entrance your wagon must be for you to use it from inside.'); } }),
      'Hotkeys.QuickMountDismount': Object.freeze({ default: 'Alpha5', text: true, get description() { return t('mods.horseCartAndCargo.Hotkeys.QuickMountDismount.description', 'Mounts your last-used horse or wagon if it’s in reach, or dismounts if you’re riding. Click it and press a key to change it; \u2715 clears it.'); } }),   // KB1: not read by the mod any more - the key is the registry's action (inputActions.js MOD_ACTIONS); a player's saved value is carried there once (migrateKeyBinds)
      'Hotkeys.SummonTransport': Object.freeze({ default: 'Alpha6', text: true, get description() { return t('mods.horseCartAndCargo.Hotkeys.SummonTransport.description', 'Brings your horse and wagon to you when you’re outdoors. Click it and press a key to change it; \u2715 clears it.'); } }),   // KB1: not read by the mod any more - the key is the registry's action (inputActions.js MOD_ACTIONS); a player's saved value is carried there once (migrateKeyBinds)
    }),
  }),
  // LEGACY1 (2026-10-05, bible/06-Systems/Legacy-Arc.md, Mac: "this is actually my DFU mod that I want to integrate"):
  // PROJECT LEGACY 0.4.1 (Lattymoy, Ghð§† and Positronico). The mod's own "Family" section, its names and descriptions
  // as modsettings.json ships them (vendor/project-legacy/modsettings.json) - but B14: the mod shipped Max Siblings 0
  // and Siblings Probability 0, so a fresh install never rolled a sibling; the port ships 2 and 50. Its "Input" section
  // (the G key and the second key) is the keybinding registry's (KB1, inputActions.js MOD_ACTIONS: LegacyFamily). The
  // "Legacy" section is the port's own: the model a family founded without the chargen's answer takes, Arkay's toll in
  // an Enduring family, the heirloom's chance at a Bloodline death, and whether the family stands in the world
  // (LEGACY-HOME). `Enabled` is the port's (MO1: on).
  'project-legacy': Object.freeze({
    title: 'Project Legacy',
    author: 'Lattymoy, Gh\u00f0\u00a7\u2020 and Positronico',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        description: 'A family, a family tree and an heir to carry on your line. In a Bloodline house each death is final; '
          + 'in an Enduring one it costs years.',
      }),
      'Family.Descendants': Object.freeze({ default: 0, options: Object.freeze(['Random Descendants', 'Always have descendants']), description: 'Whether you always have descendants, or only sometimes.' }),
      'Family.Max Siblings': Object.freeze({ default: 2, min: 0, max: 10, description: 'Most siblings you can have.' }),
      'Family.Siblings Probability': Object.freeze({ default: 50, min: 0, max: 100, description: 'Chance, in percent, that you have siblings.' }),
      'Legacy.Model': Object.freeze({ default: 0, options: Object.freeze(['Enduring', 'Bloodline']), description: 'The kind of family a character made before this mod gets. Enduring: a death costs years. Bloodline: a death is final.' }),
      'Legacy.Toll': Object.freeze({ default: 1, options: Object.freeze(['Light', 'Standard', 'Heavy']), description: 'How many years a death takes in an Enduring family (Arkay\u2019s toll): 4%, 6% or 10% of a lifespan.' }),
      'Legacy.Heirloom Chance': Object.freeze({ default: 50, min: 0, max: 100, description: 'The chance a Bloodline death leaves an heirloom for the heir to recover.' }),
      // LEGACY-HOME (Legacy-Arc section 10b; Mac: "itll be default on but can be toggled off").
      'Legacy.Family In World': Object.freeze({ default: true, description: 'Family members you aren’t playing go about their day at the family home, or in your town if the family has no house. Talk to one to play as them.' }),
    }),
  }),
  // DEX0: DAGGERFALL ENEMY EXPANSION 1.3.4 (Kamer & Kab). Its one section and key as modsettings.json ships them
  // (vendor/daggerfall-enemy-expansion/modsettings.json: Cheat.DisableTrollRespawn, a ToggleKey, off), read by the
  // troll's corpse each frame it counts down (BestiaryMod.LoadSettings, :136-139 - the mod reads it at load and on a
  // settings change). `Enabled` is the port's (MO1: on) - the whole mod: its enemies, its tables, its art.
  'daggerfall-enemy-expansion': Object.freeze({
    get title() { return t('mods.daggerfallEnemyExpansion.title', 'Daggerfall Enemy Expansion'); },   // the manifest's ModTitle (L10N4)
    author: 'Kamer & Kab',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        get description() {
          return t('mods.daggerfallEnemyExpansion.Enabled.description', 'Fifty new enemies - goblins, trolls, minotaurs, golems, '
            + 'mounted knights, necromancers, witches and more - in new encounter tables for every dungeon and climate.');
        },
      }),
      'Cheat.DisableTrollRespawn': Object.freeze({
        default: false,
        get description() { return t('mods.daggerfallEnemyExpansion.DisableTrollRespawn.description', 'Prevent trolls from respawning after death (use for No Magic runs)'); },
      }),
    }),
  }),
});

let memory = null;

/** AUDIT SOC D4 - THE ONE MIGRATION THIS STORE HAS.
 *
 *  Handheld Torches shipped its light toggle on "F" and the port carried that verbatim until SOC5 spent F on the
 *  port's own SocialInteract action; HT4's gate forbids a vendored mod SHIPPING a key the port has already spent,
 *  so the declared default moved to "O" (see the key's own comment above). A default only answers for a player who
 *  never touched the dial - and every player who opened the Mods pane before this slice has a SAVED "F" in this
 *  file, written by the pane from the old default, which would light a torch on every press of the social key.
 *
 *  So a stored value that is EXACTLY "F" is deleted on load, once, and the file written back without it: the
 *  shipped "O" then applies, like it does for everyone else. A player who deliberately chose some other key keeps
 *  it, and a player who deliberately chose F... also loses it, which is the trade - there is nothing in the file
 *  that tells the two apart, and a torch on the social key is the worse of the two wrongs. */
const HT_LIGHT_KEY = Object.freeze({ vendor: 'handheld-torches', key: 'Handling.ToggleLightInput', was: 'F' });
/** AUDIT HCC K1: the same law, twice more - Horse Cart and Cargo shipped its keys on F7 and F10 (HUD shortcuts and
 *  the browser's), and a player who opened the Mods pane holds them SAVED. Exactly those values go, once. */
export const KEY_MIGRATIONS = Object.freeze([
  HT_LIGHT_KEY,
  Object.freeze({ vendor: 'horse-cart-and-cargo', key: 'Hotkeys.QuickMountDismount', was: 'F7' }),
  Object.freeze({ vendor: 'horse-cart-and-cargo', key: 'Hotkeys.SummonTransport', was: 'F10' }),
]);
/** DISC20-E (2026-09-24, Mac: "The weapon widget default toggle under diverse weapons should be set to off by
 *  default"): A SWITCH WHOSE DEFAULT MOVED, RESET ONCE. Diverse Weapons' Weapon Widget Preset has shipped off since
 *  DISC16-B, but a default only answers for a player who never touched the switch, and every player who turned it on
 *  while DW-CLIP shipped it on (or tried it) holds a SAVED value and still sees it on. So a stored value WITHOUT this
 *  entry's stamp is let go on load and the file written back, and the shipped off applies. setModSetting stamps the
 *  key when a player sets it from now on, so a choice made after the reset is kept across reloads - unlike
 *  KEY_MIGRATIONS, which can only match a value. A file that never mentioned the mod is not grown one. */
export const SWITCH_RESETS = Object.freeze([
  Object.freeze({ vendor: 'diverse-weapons', key: 'WeaponWidgetPreset', stamp: 'WeaponWidgetPreset@DISC20' }),
  // WEAR-VANILLA (2026-10-01): the three wear switches that moved to off
  Object.freeze({ vendor: 'pcaao', key: 'equipmentDamageEnhanced', stamp: 'equipmentDamageEnhanced@WEAR-VANILLA' }),
  Object.freeze({ vendor: 'pcaao', key: 'fadingEnchantedItems', stamp: 'fadingEnchantedItems@WEAR-VANILLA' }),
  Object.freeze({ vendor: 'roleplay-realism', key: 'equipDamage', stamp: 'equipDamage@WEAR-VANILLA' }),
]);
/** FGH2H-R (2026-09-24, Mac: "retire it"): A SWITCH TAKEN OFF THE PANE. Roleplay & Realism's
 *  fightersTeachHandToHand swapped Giantish for HandToHand in the Fighters Guild's lists; FGH2H put HandToHand in the
 *  base lists beside Giantish, which left the switch one effect - taking Giantish away - so it is retired whole (the
 *  Port-Ledger's FGH2H row). A player who turned it on holds a SAVED true for a key nothing declares, so the stored
 *  value is let go on load, once, and the file written back; a file that never mentioned the key is not touched. */
export const RETIRED_KEYS = Object.freeze([
  Object.freeze({ vendor: 'roleplay-realism', key: 'fightersTeachHandToHand' }),
]);
function migrate(m) {
  let changed = false;
  for (const { vendor, key } of RETIRED_KEYS) {
    const held = m?.[vendor];
    if (!held || !Object.hasOwn(held, key)) continue;
    delete held[key];
    changed = true;
  }
  for (const { vendor, key, was } of KEY_MIGRATIONS) {
    const held = m?.[vendor];
    if (!held || held[key] !== was) continue;
    delete held[key];
    changed = true;
  }
  for (const { vendor, key, stamp } of SWITCH_RESETS) {
    const held = m?.[vendor];
    if (!held || !Object.hasOwn(held, key) || held[stamp] === true) continue;
    delete held[key];
    changed = true;
  }
  return changed;
}

function load() {
  if (memory) return memory;
  memory = {};
  try {
    const raw = appStorage()?.getItem(STORE_KEY);
    if (raw) memory = JSON.parse(raw) ?? {};
  } catch { memory = {}; }
  if (migrate(memory)) save();   // AUDIT SOC D4: once, on the load that found it
  return memory;
}
function save() {
  try { appStorage()?.setItem(STORE_KEY, JSON.stringify(memory ?? {})); } catch { /* no storage */ }
}

/** DS1: a SliderIntKey (declared with min/max) reads as an integer
 *  clamped to its range; every other key is a ToggleKey and reads as a
 *  boolean, exactly as before. */
export function isIntKey(def) { return def && typeof def.min === 'number' && typeof def.max === 'number' && !def.float; }
/** WW1: a SliderFloatKey (Weapon Widget's speeds and sizes) - `float`
 *  declared, min/max its range, `step` the pane's stepper. */
export function isFloatKey(def) { return def && def.float === true && typeof def.min === 'number' && typeof def.max === 'number'; }
/** UL1: a MultipleChoiceKey - `options` is the list, the value its index. */
export function isChoiceKey(def) { return def && Array.isArray(def.options); }
/** HT1: a TextKey (Handheld Torches' three key bindings) - a Unity
 *  KeyCode name, `text` declared; the pane captures a key for it. */
export function isTextKey(def) { return def && def.text === true; }
/** HT1: a TupleIntKey / TupleFloatKey - `tuple` names the pair's kind,
 *  the value `[first, second]`. */
export function isTupleKey(def) { return def && (def.tuple === 'int' || def.tuple === 'float'); }
/** TO1: a ColorKey (DFU's ModSettings.ColorKey - Travel Options has
 *  seventeen) - `color` declared, the value an `#rrggbbaa` string. */
export function isColorKey(def) { return def && def.color === true; }

/** TO1: the eight hex digits of a ColorKey, in either of the two
 *  spellings the mod itself uses - `#rrggbbaa` as this store writes it
 *  and `RRGGBBAA` as its own presets write it (modpresets.json:
 *  "D77727FF") - as `[r, g, b, a]` 0..255. Three or six digits are
 *  accepted too and take a full alpha, because a player typing a
 *  colour into the pane types "#c08a3e". Anything unreadable answers
 *  null, and the caller falls back to the declared default. */
export function colorKeyRgba(value) {
  if (Array.isArray(value) && value.length === 4 && value.every((n) => Number.isFinite(n))) {
    return value.map((n) => Math.max(0, Math.min(255, Math.trunc(n))));
  }
  if (typeof value !== 'string') return null;
  let s = value.trim();
  if (s.startsWith('#')) s = s.slice(1);
  if (!/^[0-9a-fA-F]+$/.test(s)) return null;
  if (s.length === 3) s = s.split('').map((c) => c + c).join('') + 'ff';
  else if (s.length === 4) s = s.split('').map((c) => c + c).join('');
  else if (s.length === 6) s += 'ff';
  else if (s.length !== 8) return null;
  return [0, 2, 4, 6].map((i) => parseInt(s.slice(i, i + 2), 16));
}

/** The canonical spelling this store keeps: `#rrggbbaa`, lower case. */
export function colorKeyHex(rgba) {
  const c = colorKeyRgba(rgba);
  if (!c) return null;
  return '#' + c.map((n) => n.toString(16).padStart(2, '0')).join('');
}

function coerce(def, v) {
  if (isColorKey(def)) {
    const hex = colorKeyHex(v);
    return hex ?? def.default;
  }
  if (isTextKey(def)) {
    const t = typeof v === 'string' ? v.trim() : '';
    return t.length ? t : def.default;
  }
  if (isTupleKey(def)) {
    if (!Array.isArray(v) || v.length !== 2) return def.default;
    const pair = v.map((x) => (def.tuple === 'int' ? Math.trunc(Number(x)) : Math.round(Number(x) * 1000) / 1000));
    return pair.every(Number.isFinite) ? Object.freeze(pair) : def.default;
  }
  if (isChoiceKey(def)) {
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) ? Math.max(0, Math.min(def.options.length - 1, n)) : def.default;
  }
  if (isFloatKey(def)) {
    const f = Number(v);
    return Number.isFinite(f) ? Math.max(def.min, Math.min(def.max, Math.round(f * 1000) / 1000)) : def.default;   // WW1: on its range, to a thousandth
  }
  if (!isIntKey(def)) return !!v;
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? Math.max(def.min, Math.min(def.max, n)) : def.default;
}

/** MM1: a read across mods - `ModManager.GetMod(...)` / another mod's
 *  ModSettings - that answers undefined for a mod the port has not
 *  vendored (DFU: the mod is not loaded) instead of throwing. */
export function modSettingIfDeclared(vendor, key) {
  return declaredKey(vendor, key) ? modSetting(vendor, key) : undefined;
}

/**
 * MODS-ONLINE-2: A DECLARED KEY IS AN OWN KEY. The three doors below
 * read `MOD_SETTINGS[vendor].keys[key]` and treated anything truthy as
 * a declaration - so every name on Object.prototype was one. A read of
 * `toString`, `constructor` or `valueOf` sailed past "is not a declared
 * switch" and answered `undefined` (its `def.default` does not exist)
 * instead of throwing, and a WRITE of one coerced against a function
 * and stored it under the vendor. Nothing in the port asks for those
 * names, which is why it was never seen; a mod id or key that ever
 * comes from data would have found it.
 *
 * The same mistake, made in the lane, is what caught this: the survivor
 * of tools/mutants/modsonline1.json dropped `Object.hasOwn` from
 * onlineForcedModSetting, where `room['toString']` is a FUNCTION and
 * would have been handed back as a forced setting value.
 */
const declaredKey = (vendor, key) =>
  (Object.hasOwn(MOD_SETTINGS, vendor) && Object.hasOwn(MOD_SETTINGS[vendor].keys, key) ? MOD_SETTINGS[vendor].keys[key] : undefined);

/** REALM P0.2: THE VALUE A KEY READS ONLINE WHEN THE ROOM OWNS IT - its room value (onlineLane.js
 *  ONLINE_ROOM_MOD_KEYS), or for a balance mod the room owns whole (ONLINE_WHOLE_MODS) its shipped default - else
 *  undefined. One home for the three readers: modSetting below, the Mods pane's lock and the offline sync's copy. */
export function onlineModSetting(vendor, key, search) {
  const room = onlineForcedModSetting(vendor, key, search);
  if (room !== undefined) return room;
  const def = declaredKey(vendor, key);
  return def && onlineWholeModKey(vendor, key, search) ? def.default : undefined;
}

export function modSetting(vendor, key) {
  const def = declaredKey(vendor, key);
  if (!def) throw new Error(`modSetting: ${vendor}/${key} is not a declared switch`);
  const forced = onlineModSetting(vendor, key);   // MODS-ONLINE-2: online, a key the room's ground depends on reads the room's value and the store is not written; REALM P0.2: and a balance mod's every key its shipped default
  if (forced !== undefined) return forced;
  const v = load()[vendor]?.[key];
  return v === undefined ? def.default : coerce(def, v);
}

/**
 * AUDIT PRE-MERGE 0928 S4: A MOD LOADED FOR THE GAME. A mod whose tile says it takes effect when the game (or the world)
 * next loads is loaded or not for the game, as DFU's mods are: the host that builds it reads its switch once, at its
 * mount, and latches the answer here. The mod's other doors - a shelf's row, its keys, an effect's restore - ask the
 * latch, so a switch flipped mid-game reaches none of them before the next load. A vendor no host latched answers
 * undefined, and its door reads the switch as it stands.
 */
const _loadedForGame = new Map();
export function latchModLoaded(vendor, on) { _loadedForGame.set(vendor, !!on); return !!on; }
export const modLatchedOn = (vendor) => _loadedForGame.get(vendor);

/** DS1: every key of one vendored mod, resolved - what a mod reads its
 *  ModSettings as, in one object. */
/** KB1: the value a player SAVED for a key, raw, or undefined when they never touched it - the keybinding registry's
 *  one-time carry of the mods' old TextKeys (systems/inputActions.js migrateKeyBinds) needs "chose" from "shipped". */
export function storedModSetting(vendor, key) {
  if (!declaredKey(vendor, key)) return undefined;
  return load()[vendor]?.[key];
}

export function modSettingsOf(vendor) {
  const keys = MOD_SETTINGS[vendor]?.keys;
  if (!keys) throw new Error(`modSettingsOf: ${vendor} is not a vendored mod with switches`);
  const out = {};
  for (const k of Object.keys(keys)) out[k] = modSetting(vendor, k);
  return out;
}

/** AUDIT 68 S15-eotb-settings-snapshot: DFU's ModSettingsChange, as a
 *  number. Every write moves it, so a reader that holds a resolved copy
 *  (the EOTB camera and body) re-reads when there is something new
 *  rather than never - the same idiom as `morrowindDataGeneration`. */
let _generation = 0;
export const modSettingsGeneration = () => _generation;

export function setModSetting(vendor, key, value) {
  const def = declaredKey(vendor, key);
  if (!def) throw new Error(`setModSetting: ${vendor}/${key} is not a declared switch`);
  const m = load();
  const v = coerce(def, value);
  (m[vendor] ??= {})[key] = v;
  for (const r of SWITCH_RESETS) if (r.vendor === vendor && r.key === key) m[vendor][r.stamp] = true;   // DISC20-E: chosen after the reset - kept
  save();
  _generation++;
  return v;
}

/**
 * DW1: A DFU ModSettings PRESET, flattened to this store's keys.
 *
 * A mod's presets ship as `{ Values: { Section: { Key: "string" } } }`
 * (ModSettingsData.cs's Preset, every value a string - "True", "142",
 * "1"), and a preset one mod ships FOR ANOTHER mod's settings is the
 * same shape under the other mod's sections. This turns one into the
 * `Section.Key` map this store speaks, each value coerced by the
 * DECLARED key's kind, and drops any key the vendor does not declare
 * rather than inventing a switch. `presetKeys` the other way round, for
 * a caller that wants to know what a preset would touch.
 */
export function flattenModPreset(vendor, values) {
  const keys = MOD_SETTINGS[vendor]?.keys;
  if (!keys || !values || typeof values !== 'object') return Object.freeze({});
  const out = {};
  for (const [section, entries] of Object.entries(values)) {
    if (!entries || typeof entries !== 'object') continue;
    for (const [key, raw] of Object.entries(entries)) {
      const name = `${section}.${key}`;
      const def = keys[name];
      if (!def) continue;
      // DFU writes booleans as "True"/"False"; `coerce`'s boolean arm is
      // `!!v`, which would read the string "False" as on.
      const v = (typeof raw === 'string' && /^(true|false)$/i.test(raw.trim())) ? /^true$/i.test(raw.trim()) : raw;
      out[name] = coerce(def, v);
    }
  }
  return Object.freeze(out);
}

/** For tests: forget everything. */
export function _resetModSettings() { memory = null; _generation++; _loadedForGame.clear(); try { appStorage()?.removeItem(STORE_KEY); } catch { /* none */ } }
