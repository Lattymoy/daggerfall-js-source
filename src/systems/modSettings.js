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
import { onlineForcedModSetting, onlineWholeModKey } from './onlineLane.js';   // MODS-ONLINE-2: online, the room's ground is forced and every other switch is the player's; REALM P0.2: and the balance mods whole
import { FOOT_SKIN_COUNT, CLASS_SKINS, classSkinLabel } from '../player/classSkins.js';   // SKIN2: the class skins past the mod's sixteen

const STORE_KEY = 'dfjs-mod-settings';

/** Every vendored mod that has switches, by vendor key. Names, defaults
 *  and descriptions are the mod's own (Basic Roads 1.3.1 modsettings).
 *  `author` is the manifest's ModAuthor (Basic Roads: its README's),
 *  and the Mods pane puts it IN THE TITLE (Mac, 2026-09-08: "place each
 *  creator's name in the mod title"). */
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
      Enabled: Object.freeze({ default: true, description: 'Dynamic Skies\u2019 procedural skybox in place of the port\u2019s own dome, under the enhanced environments: its sun and scattering, textured cloud layers per weather, twinkling stars, both moons on their orbits, its fog colours and distances, its longer sunrise and sunset, and a lightning flash under thunder. Off returns the port\u2019s own procedural sky.' }),
      densitySetting: Object.freeze({ default: 1, min: 1, max: 10, description: 'Makes fog thicker' }),
      ActivatePixelSnow: Object.freeze({ default: false, description: 'Turn the pixel snow replacement on or off' }),
      MinParticleSize: Object.freeze({ default: 100, min: 100, max: 800, description: 'Minimum snow particle size' }),
      MaxParticleSize: Object.freeze({ default: 300, min: 100, max: 800, description: 'Maximum snow particle size' }),
      // AUDIT 61: the description is the mod's, verbatim - the pane shows it as the author wrote it. (The value is read and logged by the mod and never applied; carried as it ships.)
      MaxParticles: Object.freeze({ default: 20, min: 15, max: 20, description: 'Maximum number of snow flake particles (multiplied by 1000)' }),
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
        description: 'A name under the crosshair for what you’re looking at: a person, a shop and its opening hours, a '
          + 'door and its lock, where an exit leads, a lever, a wheel, a ladder, a bookshelf, a Daedra waiting to '
          + 'be summoned. With it off, you still see what a chest or body holds.',
      }),
      HideDefaultInteractTooltip: Object.freeze({
        default: false,
        description: 'Enable to not give a default indication on interactable objects that may have been intended to be secret, particularly regarding puzzles in the main quest.',
      }),
    }),
  }),
  'seasons-iliac-bay': Object.freeze({
    title: 'Seasons of the Iliac Bay',
    author: 'RosyTheRascal',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        description: 'Seasonal looks for the trees, rocks and plants: autumn, spring and winter. The textures come from '
          + 'your own copy of the mod, added through Your own textures; without it the classic sprites are used.',
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
        description: 'The wilderness’s trees, bushes and stumps in 3D, made from Daggerfall’s own tree pictures, '
          + 'out to the whole view distance. They change with Seasons of the Iliac Bay and with winter.',
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
        description: 'Hazelnut’s roads, tracks, rivers and streams across the whole Iliac Bay, painted onto the land. Off '
          + 'uses the port’s own roads, built from the towns on your map, so there are roads either way.',
      }),
      SmoothRoads: Object.freeze({ default: true, description: 'Enables light smoothing of road surfaces, disable for minor extra performance.' }),
      RiversAndStreams: Object.freeze({ default: false, description: 'Enables rendering of rivers and streams on terrain' }),
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
        description: 'More to find in the wilderness: bandit camps and forts, ruins, shrines, mountains and rock fields '
          + 'across the Iliac Bay, with bandits, bears and treasure, and a camp outside Privateer’s Hold.',
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
        description: 'Seaweed, coral and shells placed in three flooded dungeon blocks. Daggerfall ships these sprites but '
          + 'never uses them; they come from your own game files.',
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
        description: 'Your ship, rebuilt inside and out. Outside: rigging, crates and barrels, a small boat, a rudder and '
          + 'railings. Below deck: quarters for you and the crew, a kitchen, a cargo hold, an armory, a shrine to '
          + 'Kynareth, and sailors to talk to.',
      }),
    }),
  }),
  // WD3 (2026-10-01): BEAUTIFUL VILLAGES OF DAGGERFALL 1.4.2 and BEAUTIFUL
  // CITIES OF DAGGERFALL 0.5.0 (carademono). No modsettings of their own -
  // 7,317 and 410 places laid out again, their blocks with them - so one
  // switch each: the port's Enabled, read once when the game loads
  // (scenes/modWorldData.js latches it - a town never moves under the
  // player), online the room's (systems/onlineLane.js).
  'beautiful-villages': Object.freeze({
    title: 'Beautiful Villages of Daggerfall',
    author: 'carademono',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        description: 'Villages, hamlets, farms, manors and temples laid out again, and roadside taverns rebuilt. A '
          + 'house, room or quest building you hold keeps its town as you found it.',
      }),
    }),
  }),
  'beautiful-cities': Object.freeze({
    title: 'Beautiful Cities of Daggerfall',
    author: 'carademono',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        description: 'The cities laid out again - districts, walls, gates, markets and docks. A house, room or quest '
          + 'building you hold keeps its city as you found it.',
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
        description: 'Sailing somewhere by ship, one trip in four is attacked by pirates. You fight on your own deck with '
          + 'your crew (a ship is lent to you if you don’t own one), and once the boarders are beaten you land '
          + 'where you were going.',
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
        description: 'Knights, bandits or orcs raid towns across the Bay for two hours at a time. Be there and they come '
          + 'for you, with the town guard fighting beside you. Beat 15 to 25 of them to free the town and raise '
          + 'your standing in the region. Made for this port. Online, everyone in the town fights the same raid.',
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
        description: 'Gather in the wilderness: chop wood with a Wood-Axe, mine gems and metals with a Pick-Axe, cut '
          + 'plants with a Sickle, rob graves with a Spade, fish with a Fishing-Net and forage for food with a '
          + 'Basket. Only by day, away from towns and enemies, and your attributes, the climate and the season '
          + 'decide what you find.',
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
        description: 'A real sea under the water: the seafloor drops away from every coast, up to 250 metres deep, with '
          + 'swimming in open water, a breath meter, fish, weed and coral, shipwrecks and sunken loot, and '
          + 'whatever lives in the deep.',
      }),
      'General.WaterDepth': Object.freeze({ default: 250.0, min: 5.0, max: 250.0, float: true, step: 1, description: 'Maximum water depth' }),
      'General.SpawnWaterSurfaces': Object.freeze({ default: true, description: 'Render visible water surfaces' }),
      'General.SpawnUnderwaterEnemies': Object.freeze({ default: true, description: 'Spawn underwate enemies' }),
      'General.EnemyFrequency': Object.freeze({ default: 0.3, min: 0.0, max: 1.0, float: true, step: 0.05, description: 'Enemy frequency rate' }),
      // SEA-CAP (2026-09-26, SquidKamer: "puddle no more is too aggressive ... it summoned an army of everything"; Mac:
      // "Yes, cap at 32"): THE PORT'S DEFAULT IS 32, not the 128 the mod ships (vendor modsettings.json). The pulse
      // fills every sea pixel within 200 m of an outdoor player from nothing to the cap in about two seconds, each foe
      // hostile and told where the player is, and in a browser a hundred and twenty-eight of them is a crowd the AI
      // cannot carry. The range is the mod's own - a player offline may still raise it to 256. Ledger A.
      'General.MaxLiveEnemies': Object.freeze({ default: 32, min: 0, max: 256, description: 'Maximum live underwater enemies' }),
      'General.PassiveFishFrequency': Object.freeze({ default: 0.8, min: 0.0, max: 1.0, float: true, step: 0.05, description: 'Fish frequency rate' }),
      'General.MaxLiveFish': Object.freeze({ default: 720, min: 0, max: 1080, description: 'Maximum live passive fish' }),
      'General.SpawnUnderwaterDecorations': Object.freeze({ default: true, description: 'Decorate the seafloor' }),
      'General.DecorationPopulateRadius': Object.freeze({ default: 2, min: 1, max: 3, description: 'Decoration spawning radius in map pixels (3 = full loaded ring, no pop-in)' }),
      'General.DecorationFrequency': Object.freeze({ default: 0.3, min: 0.0, max: 1.0, float: true, step: 0.05, description: 'Decoration rate' }),
      'General.MaxDecorationsPerTile': Object.freeze({ default: 1080, min: 64, max: 2160, description: 'Max decorations per map pixel (lower = better performance)' }),
      'General.SeafloorLootRate': Object.freeze({ default: 0.5, min: 0.0, max: 1.0, float: true, step: 0.05, description: 'Random loot rate' }),
      'General.MaxLiveLootObjects': Object.freeze({ default: 192, min: 0, max: 256, description: 'Maximum isolated loot objects' }),
      'General.TreasureClusterRate': Object.freeze({ default: 0.3, min: 0.0, max: 1.0, float: true, step: 0.05, description: 'Wreckage treasure rate' }),
      'General.MaxLiveTreasureClusters': Object.freeze({ default: 12, min: 0, max: 32, description: 'Maximum wrecks' }),
      'General.TreasureCove': Object.freeze({ default: false, description: 'Increased loot multipliers + loot quality' }),
      'General.WaterSurfaceTopTransparency': Object.freeze({ default: 0.7, min: 0.0, max: 1.0, float: true, step: 0.05, description: 'Water surface transparency from above' }),
      'General.WaterSurfaceBottomTransparency': Object.freeze({ default: 0.2, min: 0.0, max: 1.0, float: true, step: 0.05, description: 'Water surface transparency from below' }),
      'General.DarkerSurfaceWater': Object.freeze({ default: 0.0, min: 0.0, max: 1.0, float: true, step: 0.05, description: 'Darker surface water tint' }),
      'General.UnderwaterFogStrength': Object.freeze({ default: 0.5, min: 0.0, max: 1.0, float: true, step: 0.05, description: 'Underwater fog strength' }),
      'General.UnderwaterFogDistance': Object.freeze({ default: 0.3, min: 0.0, max: 1.0, float: true, step: 0.05, description: 'Underwater fog view distance' }),
      'General.SwimSpeedMultiplier': Object.freeze({ default: 1.0, min: 0.25, max: 30.0, float: true, step: 0.25, description: 'Multiplier for outdoor swimming movement speed' }),
      'General.EnableSwimStroke': Object.freeze({ default: true, description: 'Press Run while swimming for a burst of speed' }),
      'General.ArgonianInfiniteBreath': Object.freeze({ default: true, description: 'Argonians never drown' }),
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
        description: 'Blue holes in the deep sea lead down to flooded dungeons with better loot. About one open-sea square '
          + 'in forty-eight has one: a black hole in the seafloor under a cloud of dark mist. Needs Iliac Puddle '
          + 'No More.',
      }),
      'General.PitSpawnRate': Object.freeze({ default: 0.5, min: 0.0, max: 1.0, float: true, step: 0.05, description: 'Pit spawn rate (off at 0, one in 48 at middle, one in 24 at maximum)' }),
      'General.SurfaceHoleSize': Object.freeze({ default: 0.5, min: 0.0, max: 1.0, float: true, step: 0.05, description: 'Surface hole size' }),
      'General.SeafloorHoleSize': Object.freeze({ default: 0.5, min: 0.0, max: 1.0, float: true, step: 0.05, description: 'Sea floor hole size' }),
      'General.MiasmaParticleCount': Object.freeze({ default: 0.5, min: 0.0, max: 1.0, float: true, step: 0.05, description: 'Miasma particle amount' }),
      'General.MiasmaHeight': Object.freeze({ default: 0.5, min: 0.0, max: 1.0, float: true, step: 0.05, description: 'Miasma plume height' }),
      'General.DungeonVisualIntensity': Object.freeze({ default: 0.5, min: 0.0, max: 1.0, float: true, step: 0.05, description: 'Underwater dungeon fog intensity' }),
      'General.DungeonVisualDarkness': Object.freeze({ default: 0.5, min: 0.0, max: 1.0, float: true, step: 0.05, description: 'Underwater dungeon fog and ambient darkness' }),
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
        description: 'Own and sail your own boat. Buy it as parts or as a deed, put it in the water (the deed near a port) '
          + 'and take the helm: row with the oars or raise the sails and trim them to the wind, then pack it up '
          + 'to take with you. It carries what you and your cart carry, and it shows on the travel map.',
      }),
      'Controls.Disembark': Object.freeze({ default: 'C', text: true, description: 'Leave the helm (the Transport key does too).' }),   // CSA-D / KB1: not read by the mod any more - the key is the registry's action (inputActions.js MOD_ACTIONS); a player's saved value is carried there once (migrateKeyBinds)
      'Controls.ToggleSail': Object.freeze({ default: 'Space', text: true, description: 'Raise or stow the sails at the helm.' }),   // CSA-E / KB1: not read by the mod any more - the key is the registry's action (inputActions.js MOD_ACTIONS); a player's saved value is carried there once (migrateKeyBinds)
      'Controls.ToggleLight': Object.freeze({ default: 'Period', text: true, description: 'Light or douse the boat’s lanterns at the helm.' }),   // CSA-D / KB1: not read by the mod any more - the key is the registry's action (inputActions.js MOD_ACTIONS); a player's saved value is carried there once (migrateKeyBinds)
      'Controls.IncreaseTimeScale': Object.freeze({ default: 'KeypadPlus', text: true, description: 'Speed time up at the helm.' }),
      'Controls.DecreaseTimeScale': Object.freeze({ default: 'KeypadMinus', text: true, description: 'Slow time back down at the helm.' }),
      'Controls.ResetTimeScale': Object.freeze({ default: 'KeypadEnter', text: true, description: 'Return time to its own speed at the helm.' }),
      'Controls.TrimRight': Object.freeze({ default: 'RightBracket', text: true, description: 'Hold to trim the sails to the right (with Sailing Assist’s auto trimming off).' }),   // CSA-E / KB1: not read by the mod any more - the key is the registry's action (inputActions.js MOD_ACTIONS); a player's saved value is carried there once (migrateKeyBinds)
      'Controls.TrimLeft': Object.freeze({ default: 'LeftBracket', text: true, description: 'Hold to trim the sails to the left (with Sailing Assist’s auto trimming off).' }),   // CSA-E / KB1: not read by the mod any more - the key is the registry's action (inputActions.js MOD_ACTIONS); a player's saved value is carried there once (migrateKeyBinds)
      'Controls.TrimModifier': Object.freeze({ default: 'Backslash', text: true, description: 'Hold with a trim key to trim the square sails instead; hold with Toggle Sail to raise or stow the square sails alone.' }),   // CSA-E / KB1: not read by the mod any more - the key is the registry's action (inputActions.js MOD_ACTIONS); a player's saved value is carried there once (migrateKeyBinds)
      'Controls.PortLocationSearchRange': Object.freeze({ default: 3, min: 1, max: 10, description: 'How far from the player\'s current location a port can be detected' }),
      'WindDirectionWidget.Enable': Object.freeze({ default: true, description: 'Show the wind’s direction on screen at the helm.' }),
      'WindDirectionWidget.Position': Object.freeze({ default: Object.freeze([0.5, 0.5]), tuple: 'float', description: 'Where the widget sits on the screen, across and down.' }),
      'WindDirectionWidget.Scale': Object.freeze({ default: 1, min: 0, max: 2, float: true, description: 'The widget’s size.' }),
      'WindDirectionWidget.ScalingMode': Object.freeze({ default: 0, options: Object.freeze(['DoNotScale', 'ScreenHeight', 'ScreenDimensions']), description: 'Whether the widget grows with the screen.' }),
      'WindDirectionWidget.Color': Object.freeze({ default: '#ffffffff', color: true, description: 'The widget’s colour.' }),
      'Waves.Enable': Object.freeze({ default: true, description: 'Draw the waves breaking along the coasts around you, and let the sea carry a boat on its current.' }),
      'Waves.Distance': Object.freeze({ default: 2, min: 1, max: 4, description: 'How many map pixels round yours the waves are laid in, each way.' }),
      'Waves.Length': Object.freeze({ default: 1.5, min: 0, max: 2, float: true, description: 'How far out the waves reach before they end.' }),
      'Waves.Fade': Object.freeze({ default: 0.8, min: 0, max: 1, float: true, description: 'Where along their reach the waves start to fade.' }),
      'Waves.Speed': Object.freeze({ default: 100, min: 0, max: 200, description: 'How fast the waves animate - read in whole hundreds, as the mod reads it (an integer division): under 100 at half speed, 100 to 199 at its own, 200 a new frame every frame.' }),
      'Cargo.CargoThreshold': Object.freeze({ default: 500, min: 0, max: 2000, description: 'The weight a boat carries before it slows.' }),
      'Cargo.PlayerCarriedWeight': Object.freeze({ default: true, description: 'Count what you carry as cargo.' }),
      'Cargo.CartCarriedWeight': Object.freeze({ default: true, description: 'Count what your cart carries as cargo.' }),
      'Cargo.PlayerWeight': Object.freeze({ default: true, description: 'Count your own weight as cargo.' }),
      'Cargo.CartItem': Object.freeze({ default: false, description: 'Count the cart itself as cargo.' }),
      'Cargo.HorseItem': Object.freeze({ default: false, description: 'Count the horse itself as cargo.' }),
      'Audio.SoundVolume': Object.freeze({ default: 0.5, min: 0, max: 1, float: true, description: 'The boat’s sounds: the hull, the oars, the sea.' }),
      'Handling.OarMoveSpeed': Object.freeze({ default: 1, min: 0, max: 10, float: true, description: 'Top speed under oars.' }),
      'Handling.OarMoveAcceleration': Object.freeze({ default: 1, min: 0, max: 10, float: true, description: 'How quickly the oars reach it.' }),
      'Handling.OarTurnSpeed': Object.freeze({ default: 1, min: 0, max: 10, float: true, description: 'Top turning speed under oars.' }),
      'Handling.OarTurnAcceleration': Object.freeze({ default: 1, min: 0, max: 10, float: true, description: 'How quickly the oars turn the boat.' }),
      'Handling.SailMoveSpeed': Object.freeze({ default: 1, min: 0, max: 10, float: true, description: 'Top speed under sail.' }),
      'Handling.SailMoveAcceleration': Object.freeze({ default: 1, min: 0, max: 10, float: true, description: 'How quickly the sails reach it.' }),
      'Handling.SailTurnSpeed': Object.freeze({ default: 1, min: 0, max: 10, float: true, description: 'Top turning speed under sail.' }),
      'Handling.SailTurnAcceleration': Object.freeze({ default: 1, min: 0, max: 10, float: true, description: 'How quickly the sails turn the boat.' }),
      'Handling.BadTack': Object.freeze({ default: false, description: 'Shipped with the mod; its assembly never reads it.' }),
      'Handling.BadTackMultiplier': Object.freeze({ default: 0.8, min: 0, max: 1, float: true, description: 'Shipped with the mod; its assembly never reads it.' }),
      'SailingAssist.AutoTrimming': Object.freeze({ default: true, description: 'Trim the sails to the wind for you.' }),
      'SailingAssist.AutoStowSquareSails': Object.freeze({ default: true, description: 'Stow the square sails for you when you head into the wind.' }),
      'SailingAssist.AutoStowGaffSails': Object.freeze({ default: true, description: 'Shipped with the mod; its assembly never reads it.' }),
      'Compatibility.AnimatedWaterVertexWaves': Object.freeze({ default: false, description: 'With Animated Water loaded, ride its vertex waves instead of drawing the mod’s own waves. INERT here: Animated Water is not in the port, so the mod’s own waves always draw (CSA-J).' }),
      // KEEP-BOATS (2026-09-30, Mac: ship ownership "less punishing" - "Keep boats & cargo"): A DEPARTURE FROM THE
      // MOD'S SHIPPED DEFAULT. The mod ships it off, and off a boat placed in a dungeon was destroyed once the player
      // was back outside - a packable one and its hold for good, a crewed one's hold with it (UpdateBoatVisibility).
      // The port ships it ON; the switch stays the player's. Pinned: test/csa_registration.test.js DEPARTED.
      'Compatibility.PersistentDungeonBoats': Object.freeze({ default: true, description: 'Keep a boat placed indoors or underground when you leave it (off, it is gone once you are back outside).' }),
      'Map.RestrictPositionReadingTime': Object.freeze({ default: true, description: 'Position can only be viewed around midday and midnight' }),
      'Map.RestrictPositionReadingWeather': Object.freeze({ default: true, description: 'Position can only be viewed in Sunny or Cloudy weather' }),
      'Map.ClickRangeThreshold': Object.freeze({ default: 5, min: 1, max: 10, description: 'How near the pointer must come to a marker on the position reading, in map pixels, to name it or pick it.' }),
      'Map.PositionLineThickness': Object.freeze({ default: 2, min: 0, max: 5, description: 'Additional pixels on each side of the position line' }),
      'Map.MarkerThickness': Object.freeze({ default: 2, min: 1, max: 5, description: 'Additional pixels around the map marker' }),
      'Map.MarkerOutlineThickness': Object.freeze({ default: 2, min: 0, max: 5, description: 'Thickness of the marker outline in pixels' }),
      'Map.BackdropOpacity': Object.freeze({ default: 50, min: 0, max: 100, description: 'How dark the screen behind the position reading is, in percent.' }),
      'Debug.ShowValues': Object.freeze({ default: false, description: 'Show the boat’s speed, the speed it is making for and the wind’s strength on screen.' }),
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
        description: 'Many monsters hit harder and take more to kill; rats, bats and zombies are weaker. Twenty monsters '
          + 'are changed, and werebeasts and the dragonling are bigger. With Physical Combat And Armor Overhaul '
          + 'also on, that mod’s version of these changes is used.',
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
        description: 'Armour reduces the damage you take instead of your chance to be hit, your skills decide whether you '
          + 'hit, shields block according to their material, and critical hits multiply '
          + 'damage. Off uses Daggerfall Unity’s combat.',
      }),
      // WEAR-VANILLA (2026-10-01, the repair triage: "Disable the modded feature that increases durability loss.
      // Vanilla values work fine"): the mod ships its two wear modules ON, the port ships them OFF - a blow wears gear
      // at Daggerfall Unity's own rate (combat/formulas.js damageEquipment) and a broken enchanted piece stays,
      // repairable. Online the room reads these defaults (onlineLane.js ONLINE_WHOLE_MODS); offline they stay the
      // player's. A value saved under the old default is let go once (SWITCH_RESETS). Port-Ledger, WEAR-VANILLA.
      equipmentDamageEnhanced: Object.freeze({ default: false, description: 'Equipment condition damage is increased significantly, the amount of wear your equipment takes is based on many different factors; Material, Damage Source, Etc' }),
      fadingEnchantedItems: Object.freeze({ default: false, description: 'Enchanted Weapons and Armor will be destroyed upon breaking from physical combat. !!!! This Module Is Dependent On Equipment Damage Enhanced' }),
      fixedStrengthDamageModifier: Object.freeze({ default: true, description: 'Fixes a bug in DFU 0.10.21, the strength modifier for damage is double what classic had. This module fixes that, so 10 points = +1, instead of 10 points = +2' }),
      armorHitFormulaRedone: Object.freeze({ default: true, description: 'Armor no longer increases your chance to avoid damage, but instead reduces the damage that you do take in physical combat. The readme and mod-page provided goes into great detail if desired' }),
      criticalStrikesIncreaseDamage: Object.freeze({ default: true, description: 'Critical Strikes Increase Damage, not just hit-chance. !!!! This Module Is Dependent On Armor Hit Formula Redone' }),
      conditionBasedEffectiveness: Object.freeze({ default: true, description: 'Weapons and Armor Effectiveness is influenced by current Condition Value. !!!! This Module Is Dependent On Armor Hit Formula Redone' }),
      softMaterialRequirements: Object.freeze({ default: true, description: 'Weapon Material Requirements are relaxed, large damage penalty for being below required material. !!!! This Module Is Dependent On Armor Hit Formula Redone' }),
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
        description: 'Loot and shop stock no longer scale with your level. What materials drop depends on your luck, the '
          + 'shop’s quality and the type of dungeon, and the gold you find follows your luck. Off uses Daggerfall '
          + 'Unity’s rolls.',
      }),
      ...Object.fromEntries(['Iron', 'Steel', 'Silver', 'Elven', 'Dwarven', 'Mithril', 'Adamantium', 'Ebony', 'Orcish', 'Daedric'].map((name, i) => [name, Object.freeze({
        default: i,
        options: Object.freeze(['Iron', 'Steel', 'Silver', 'Elven', 'Dwarven', 'Mithril', 'Adamantium', 'Ebony', 'Orcish', 'Daedric']),
        description: 'Whenever this material would drop, change it to the selected material.',
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
        description: 'A different first-person look for every weapon in every metal, plain and enchanted, instead of one '
          + 'per weapon type. A longsword no longer looks like a broadsword. Comes with the port; a newer version '
          + 'added through Your own textures replaces it.',
      }),
      WeaponWidgetPreset: Object.freeze({
        default: false,   // DISC16-B (2026-09-24, Mac: "I just want it how it was before diverse weapons"): OFF, as at DW1 - the mod's sprites move with Weapon Widget's own defaults, as every weapon did before the mod; the preset (its step, inertia, true size and 142 bob) is the player's to choose. DW-CLIP ("mod should be defaulted on") had it on, DISC14-B off with two departures of its own
        description: 'Use the mod\u2019s own Weapon Widget preset while this is on - double-scale idles, true texture size, inertia, '
          + 'recoil and its bob - the settings its readme asks Weapon Widget users to select. Your own Weapon Widget '
          + 'settings are kept underneath and come back when this is off.',
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
        description: 'Two new weapons, a light and a medium armour set in every metal, and changes to what items weigh and '
          + 'cost. Its options below are the mod’s own.',
      }),
      lootRebalance: Object.freeze({ default: true, description: 'Rebalances loot on mobs and in piles' }),
      bandaging: Object.freeze({ default: true, description: 'Allows bandages to stack, and to be used for healing based on medical skill' }),
      conditionBasedPrices: Object.freeze({ default: true, description: 'Item prices are based on condition and loot you find can be quite worn out' }),
      storeQualityItemCondition: Object.freeze({ default: true, description: 'Items in shops can be in a used condition dependent on the quality of the store' }),
      realisticEnemyEquipment: Object.freeze({ default: true, description: 'Enemy equipment is realistic for their class and can be variable condition' }),
      skillBasedStartingEquipment: Object.freeze({ default: true, description: 'Player starting equipment is based on skills' }),
      skillBasedStartingSpells: Object.freeze({ default: true, description: 'Player starting spells are based on skills' }),
      weaponBalance: Object.freeze({ default: true, description: 'Balances weapon attack speed and damage ranges against weight to give more valid choices' }),
      newWeapons: Object.freeze({ default: true, description: 'Adds two new weapons to the game, Archers Axe and Light Flail' }),
      newArmor: Object.freeze({ default: true, description: 'Adds new chest, arm, leg and foot armor pieces to the game' }),
      alchemistPotions: Object.freeze({ default: true, description: 'Adds random potions for sale at alchemist stores, for a premium price' }),
    }),
  }),
  'roleplay-realism': Object.freeze({
    title: 'Roleplay & Realism',
    author: 'Hazelnut',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        description: 'Realism changes: bows by draw weight, no climbing with a weapon out, fairer swing speed and hit '
          + 'chance, bank loans by level, ships only from ports, a heavy-load '
          + 'penalty, lights out when you leave a dungeon, purification that cures poison, reworked class '
          + 'enemies, harsher guild expulsions, and beds you can click to sleep in. Its options below are the '
          + 'mod’s own.',
      }),
      // the mod's own descriptions (modsettings.json, Modules)
      bedSleeping: Object.freeze({ default: true, description: 'Allows sleep to be initiated by clicking on a bed.' }),
      advancedArchery: Object.freeze({ default: true, description: 'Alters to-hit and damage done by arrows depending on the length of draw.' }),
      encumbranceEffects: Object.freeze({ default: true, description: 'Provides speed and fatigue penalties when carrying too much weight.' }),
      bandaging: Object.freeze({ default: true, description: 'Allows bandages to be used for healing based on medical skill.' }),
      shipPorts: Object.freeze({ default: false, description: 'Player can only board their ship when in a port town.' }),   // SHIP-PORTS (2026-09-23, Sir McMobdon on Discord: "cant access my boat anymore"): the mod ships this ON, the port ships it OFF - a restriction nobody chose took the boat away from every owner the day the mod landed, and the switch was nowhere a player could reach; recorded on the RR page
      underworldExpulsion: Object.freeze({ default: true, description: 'Enables underworld guilds to expel members for poor performance.. with prejudice.' }),
      climbingRestriction: Object.freeze({ default: true, description: 'Prevents climbing with a weapon drawn.' }),
      weaponSpeed: Object.freeze({ default: true, description: 'Moderates DPS of weapons for characters with high speed attributes.' }),
      weaponMaterials: Object.freeze({ default: true, description: 'Moderates the to-hit bonuses of weapon materials so skill remains key factor' }),
      equipDamage: Object.freeze({ default: false, description: 'Increases equipment damage proportional to max condition.' }),   // WEAR-VANILLA (2026-10-01): the mod ships it ON (armour x5), the port OFF - see the overhaul's wear modules above; the room's too (onlineLane.js)
      enemyAppearance: Object.freeze({ default: true, description: 'Remixes human enemy appearance based on class' }),
      purificationPotion: Object.freeze({ default: true, description: 'Changes purification potion to cure poison rather than grant invisibility' }),
      autoExtinguishLight: Object.freeze({ default: true, description: 'Automatically extinguish any light sources when you exit a dungeon' }),
      classicStrengthDamageBonus: Object.freeze({ default: false, description: 'Display the strength damage bonus like classic Daggerfall (half) rather than the value used internally that DFU displays' }),
      variantNpcs: Object.freeze({ default: true, description: 'Enable variant NPC sprites in shops & taverns' }),
      variantResidents: Object.freeze({ default: true, description: 'This populates 80% of houses with the townsfolk you see walking around insteam of random adventurer flats' }),
      // fightersTeachHandToHand RETIRED (FGH2H-R, 2026-09-24, Mac: "retire it") - see RETIRED_KEYS below
      loanAmountPerLevel: Object.freeze({ default: 4, options: Object.freeze(['2000', '4000', '6000', '8000', '10000', '20000', '30000', '40000', '50000']), description: 'Sets the maximum amount per level that can be borrowed from banks' }),
      // EnhancedRiding (RR2)
      'EnhancedRiding.enhancedRiding': Object.freeze({ default: true, description: 'Enable enhanced horse riding module, improving presentation and allowing galloping.' }),
      'EnhancedRiding.RealisticMovement': Object.freeze({ default: true, description: 'Makes the horse and cart movement backwards and sideways more realistic and limited.' }),
      'EnhancedRiding.followTerrainEnabled': Object.freeze({ default: true, description: 'Enables terrain following when riding.' }),
      'EnhancedRiding.followTerrainSoftenFactor': Object.freeze({ default: 8, min: 0, max: 32, description: 'Scale factor to soften terrain gradient following. (0=none, 32=max soften)' }),
      'EnhancedRiding.GallopingInTowns': Object.freeze({ default: false, description: 'Enables galloping (sprinting) while riding horses in towns.' }),
      'EnhancedRiding.TrampleCivilians': Object.freeze({ default: true, description: 'Enables the crime of trampling innocent townsfolk when galloping in a town. Be careful!' }),
      // RefinedTraining (RR2)
      'RefinedTraining.refinedTraining': Object.freeze({ default: true, description: 'Enable refined skill training service.' }),
      'RefinedTraining.variableTrainingPrice': Object.freeze({ default: true, description: 'Makes price of training based on skill level as well as player level.' }),
      'RefinedTraining.intensiveTraining': Object.freeze({ default: false, description: 'Enables intensive training option for a session per day for five days, for extra cost.' }),
    }),
  }),
  'shield-widget': Object.freeze({
    title: 'Shield Widget',
    author: 'RedRoryOTheGlen',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        description: 'See your shield in first person, which classic Daggerfall never shows. It is drawn in its own metal, '
          + 'gets battered as it wears, and moves out of the way when you sheathe, swing or cast.',
      }),
      'Shield.Scale': Object.freeze({ default: 1.0, min: 0.8, max: 1.2, float: true, step: 0.1, description: 'Size of the sprite' }),
      'Shield.OffsetHorizontal': Object.freeze({ default: 0.5, min: -1.0, max: 1.0, float: true, step: 0.1, description: 'Offsets the sprite relative to the left edge of the screen' }),
      'Shield.OffsetVertical': Object.freeze({ default: 0.5, min: -1.0, max: 1.0, float: true, step: 0.1, description: 'Offsets the sprite relative to the bottom edge of the screen' }),
      'Shield.Speed': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'Speed of stance transition when attacking' }),
      'Shield.WhenSheathed': Object.freeze({ default: 1, options: Object.freeze(['Hide', 'Off-screen', 'Corner', 'Ready']), description: 'The shield\'s behavior when sheathing your weapon' }),
      'Shield.WhenAttacking': Object.freeze({ default: 1, options: Object.freeze(['Hide', 'Off-screen', 'Corner', 'Ready']), description: 'The shield\'s behavior when attacking with a weapon' }),
      'Shield.WhenCasting': Object.freeze({ default: 1, options: Object.freeze(['Hide', 'Off-screen', 'Corner', 'Ready']), description: 'The shield\'s behavior when readying or while casting a spell' }),
      'Shield.LockAspectRatio': Object.freeze({ default: true, description: 'Enable to prevent the sprite from stretching or squishing depending on the screen\'s aspect rato' }),
      'Shield.ConditionThresholdUpper': Object.freeze({ default: 75, min: 55, max: 95, description: 'The first condition threshold for the changing of the sprite.' }),
      'Shield.ConditionThresholdLower': Object.freeze({ default: 25, min: 5, max: 45, description: 'The second condition threshold for the changing of the sprite' }),
      'Modules.Bob': Object.freeze({ default: true, description: 'Bob: the shield sways as you walk.' }),
      'Modules.Inertia': Object.freeze({ default: false, description: 'Inertia: the shield lags the look and your movement.' }),
      'Modules.Animation': Object.freeze({ default: false, description: 'Animation: the shield is raised and lowered frame by frame instead of sliding (art by WilhelmBlack).' }),
      'Modules.Step': Object.freeze({ default: false, description: 'Step: the shield\u2019s position is rounded so it moves in steps.' }),
      'Modules.Recoil': Object.freeze({ default: false, description: 'Recoil: a blow that lands on the shield rocks it and rings it. Needs Physical Combat and Armor Overhaul, which is what raises the event.' }),
      'Bob.Length': Object.freeze({ default: 100, min: 0, max: 200, description: 'Amount of bobs in a single stride' }),
      'Bob.Offset': Object.freeze({ default: 0.0, min: 0.0, max: 3.0, float: true, step: 0.1, description: 'Advances the bob timing. For use with weapon bob.' }),
      'Bob.SizeX': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'Extent of horizontal movement when bobbing' }),
      'Bob.SizeY': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'Extent of vertical movement when bobbing' }),
      'Bob.SpeedMove': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'Speed of transition between stationary and moving' }),
      'Bob.SpeedState': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'Speed of transition between movement states' }),
      'Bob.Shape': Object.freeze({ default: 0, options: Object.freeze(['U', 'Sideways 8', 'Inverted U']), description: 'Shape of bob' }),
      'Bob.BobWhileIdle': Object.freeze({ default: true, description: 'Whether the shield will slightly bob while stationary' }),
      'Inertia.Scale': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'The maximum distance that the sprite will be offset' }),
      'Inertia.Speed': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'The speed that the sprite will move at towards the target offset' }),
      'Inertia.ForwardDepth': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'Multiplier for the change in scale when moving forward or backward' }),
      'Inertia.ForwardSpeed': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'The speed that the sprite will scale towards the target depth' }),
      'Animation.Speed': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'Determines how fast the animation plays' }),
      'Animation.Direction': Object.freeze({ default: 0, options: Object.freeze(['Both', 'Forward Only', 'Reverse Only']), description: 'Set which animations will play during actions' }),
      'Step.Length': Object.freeze({ default: 1, min: 1, max: 10, description: 'The number (x8) whose multiples will be used for snapping' }),
      'Step.Condition': Object.freeze({ default: 0, options: Object.freeze(['Sheathe/Attack Only', 'All Transforms']), description: 'Whether the snapping only affects Sheathing or also other options like Bob, Inertia and Recoil' }),
      'Recoil.Scale': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'The amount the shield will recoil' }),
      'Recoil.Offset': Object.freeze({ default: false, description: 'Whether the shield should be moved to the center when recoiling' }),
      'Recoil.Speed': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'The speed that the shield recovers from recoil' }),
      'Recoil.Condition': Object.freeze({ default: 2, options: Object.freeze(['Hit On Shield', 'Miss On Shield', 'Attack On Shield', 'Any Hit', 'Any Miss', 'Any Attack']), description: 'Event required for the shield to recoil' }),
      'Compatibility.TextureScaleFactor': Object.freeze({ default: 1, min: 0, max: 8, description: 'Divides the sprite\u2019s pixel size. Raise it if a replacement texture pack draws the shield too large.' }),
    }),
  }),
  'weapon-widget': Object.freeze({
    title: 'Weapon Widget',
    author: 'RedRoryOTheGlen',
    keys: Object.freeze({
      Enabled: Object.freeze({
        default: true,
        description: 'Livelier first-person weapons: swings that wind up and recover, the weapon in the hand you swing '
          + 'with, a sheathe animation, a bob as you walk, sway as you look and a kick when you hit or parry. The '
          + 'Morrowind arms move the same way.',
      }),
      'Modules.Swings': Object.freeze({ default: true, description: 'Swings: the strike winds up from the idle pose, plays at its own speed, and recovers - in reverse after a hit.' }),
      'Modules.Ambidexterity': Object.freeze({ default: true, description: 'Ambidexterity: the sprite is drawn in the hand you are swinging with (H), mirrored for the left.' }),
      'Modules.Offset': Object.freeze({ default: true, description: 'Offset: sheathing slides the sprite off the screen and drawing slides it back; a swing returns from below.' }),
      'Modules.Bob': Object.freeze({ default: true, description: 'Bob: the sprite sways as you walk.' }),
      'Modules.Inertia': Object.freeze({ default: false, description: 'Inertia: the sprite lags the look and your movement. Requires double-scaled weapon textures.' }),
      'Modules.Step': Object.freeze({ default: false, description: 'Step: the sprite\u2019s position is rounded so it moves in steps.' }),
      'Modules.DoubleScaleTextures': Object.freeze({ default: false, description: 'DoubleScaleTextures: the idle pose is drawn at double size from the mod\u2019s own textures (attach the mod\u2019s .dfmod through the textures pick).' }),   // DISC16-B: the mod's own again (DISC14-B had it on)
      'Modules.TrueTextureSize': Object.freeze({ default: false, description: 'TrueTextureSize: a custom texture is drawn at its own pixel size, divided by the scale factor below.' }),
      'Modules.Recoil': Object.freeze({ default: false, description: 'Recoil: the swing recoils on a hit, a parry or a miss, by the condition below.' }),
      'Swings.Speed': Object.freeze({ default: 1.0, min: 0.0, max: 5.0, float: true, step: 0.25, description: 'Speed of the swing\u2019s frames.' }),
      'Swings.Windup': Object.freeze({ default: 1, options: Object.freeze(['Hide', 'Idle', 'First Frame']), description: 'What shows while the swing winds up.' }),
      'Swings.Recovery': Object.freeze({ default: 0, options: Object.freeze(['Hide', 'Last Frame']), description: 'What shows while the swing recovers.' }),
      'Swings.VanillaAlignmentOverride': Object.freeze({ default: true, description: 'Centres the down and up strikes of the vanilla weapons at the screen\u2019s middle edge.' }),
      'Swings.VanillaRecoveryOverride': Object.freeze({ default: true, description: 'Plays the StrikeUp animation in reverse during recovery for some vanilla weapons' }),
      'Swings.NoDaggerMirroredStrikes': Object.freeze({ default: true, description: 'Prevents Daggers from using the opposite hand animations' }),
      'Offset.Speed': Object.freeze({ default: 1.0, min: 0.0, max: 5.0, float: true, step: 0.25, description: 'Speed of the slide on and off the screen.' }),
      'Bob.Length': Object.freeze({ default: 100, min: 0, max: 200, description: 'Amount of bobs in a single stride' }),
      'Bob.Offset': Object.freeze({ default: 0.0, min: 0.0, max: 1.0, float: true, step: 0.1, description: 'Advances the bob timing. For use with weapon bob.' }),
      'Bob.SizeX': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'Extent of horizontal movement when bobbing' }),
      'Bob.SizeY': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'Extent of vertical movement when bobbing' }),
      'Bob.SpeedMove': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'Speed of transition between stationary and moving' }),
      'Bob.SpeedState': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'Speed of transition between movement states' }),
      'Bob.Shape': Object.freeze({ default: 0, options: Object.freeze(['U', 'Sideways 8', 'Inverted U']), description: 'Shape of bob' }),
      'Bob.BobWhileIdle': Object.freeze({ default: true, description: 'Whether the shield will slightly bob while stationary' }),
      'Step.Length': Object.freeze({ default: 1, min: 1, max: 10, description: 'The number (x8) whose multiples will be used for snapping' }),
      'Step.Condition': Object.freeze({ default: 0, options: Object.freeze(['Sheathe/Attack Only', 'All Transforms']), description: 'Whether the snapping only affects Sheathing or also other options like Bob, Inertia and Recoil' }),
      'Inertia.Scale': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'The maximum distance that the sprite will be offset' }),   // DISC16-B: the mod's own again (DISC14-B had it at 0)
      'Inertia.Speed': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'The speed that the sprite will move at towards the target offset' }),
      'Inertia.ForwardDepth': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'Multiplier for the change in scale when moving forward or backward' }),
      'Inertia.ForwardSpeed': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'The speed that the sprite will scale towards the target depth' }),
      'TrueTextureSize.TextureScaleFactor': Object.freeze({ default: 1, min: 1, max: 8, description: 'A custom texture\u2019s pixels per screen pixel of the 320x200 surface.' }),
      'Recoil.Condition': Object.freeze({ default: 0, options: Object.freeze(['Hits Only', 'Hits and Parries', 'Parries Only', 'Parries and Misses', 'Misses Only', 'All Attacks']), description: 'When the swing recoils.' }),
      'Recoil.Chance': Object.freeze({ default: 100, min: 0, max: 100, description: '% chance of recoil happening when condition is met' }),
      'Recoil.PlayEntityMissEffects': Object.freeze({ default: true, description: 'A clang or a thud at a foe that parried or was missed.' }),
      'Recoil.DetectEnvironment': Object.freeze({ default: true, description: 'A swing into a wall or a door within reach recoils too.' }),
      'Recoil.PlayEnvironmentMissEffects': Object.freeze({ default: true, description: 'A thud where the swing met the wall.' }),
      'Recoil.MissEffectPlacement': Object.freeze({ default: 0, options: Object.freeze(['Target', 'Crosshair']), description: 'Where the clang or thud is drawn.' }),
      'Miscellaneous.MirrorBows': Object.freeze({ default: false, description: 'Draws the bow mirrored.' }),
      'Miscellaneous.MirrorTwoHandedSwords': Object.freeze({ default: false, description: 'Draws a two-handed sword mirrored in the right hand.' }),
      'Miscellaneous.MirrorTwoHandedAxes': Object.freeze({ default: false, description: 'Draws a two-handed axe mirrored in the right hand.' }),
      'Miscellaneous.MirrorTwoHandedBlunts': Object.freeze({ default: false, description: 'Draws a two-handed staff, hammer or flail mirrored in the right hand.' }),
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
        description: 'A lit torch, candle or lantern needs a free hand. You get keys to light, drop or throw one (a thrown '
          + 'torch can set an enemy on fire). You see the light in your hand in first person, and a dropped torch '
          + 'keeps burning, lights the room and can be picked up again.',
      }),
      // SOC5 (2026-09-16, Mac: "Players should be able to interact with others
      // in the world upon encountering them by pressing F on their body"): THE
      // SECOND DEPARTURE FROM THE MOD'S SHIPPED KEYS, and the same shape as
      // HT4's below. Handheld Torches ships F, and in Daggerfall Unity that is
      // free. It is not free here any more: SOC5 spends F on the port's own
      // SocialInteract action (systems/inputActions.js DEFAULT_BINDINGS), the
      // key Mac named, and online forces every vendored mod ON
      // (systems/onlineLane.js) - so one press would both open the F-menu on a
      // player and light a torch, for every player online, by default. O is
      // unbound in DFU's own defaults and unused by this mod's other two keys
      // and by every other vendored mod, and it says what it does: on and off.
      // The player may still bind it wherever they like; this is about what
      // SHIPS. test/ht1_handheldtorches.test.js HT4 is the gate that caught it.
      'Handling.ToggleLightInput': Object.freeze({ default: "O", text: true, description: 'Button used to quickly ignite or douse your light source' }),   // KB1: not read by the mod any more - the key is the registry's action (inputActions.js MOD_ACTIONS); a player's saved value is carried there once (migrateKeyBinds)
      'Handling.RememberLastLightSource': Object.freeze({ default: true, description: 'Igniting with the key re-lights the light you last doused, if you still carry one.' }),
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
      'Handling.ManualDropInput': Object.freeze({ default: "G", text: true, description: 'Button used to manually drop a light source' }),   // KB1: not read by the mod any more - the key is the registry's action (inputActions.js MOD_ACTIONS); a player's saved value is carried there once (migrateKeyBinds)
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
      'Handling.OnStow': Object.freeze({ default: 0, options: Object.freeze(["Unequip", "Drop"]), description: 'Behavior when forced to stow a light source' }),
      'Handling.OnPick': Object.freeze({ default: 1, options: Object.freeze(["Store", "Equip", "Force Equip"]), description: 'Behavior when picking up a light source' }),
      'Handling.StowWhenSpellcasting': Object.freeze({ default: true, description: 'Casting, or holding a readied spell, stows the light: no free hand.' }),
      'Handling.StowWhenClimbing': Object.freeze({ default: true, description: 'Climbing stows the light: no free hand.' }),
      'Handling.StowWhenSwimming': Object.freeze({ default: true, description: 'Swimming stows the light: no free hand.' }),
      'Handling.RelaxedTwoHandedWeapons': Object.freeze({ default: false, description: 'Two-handed weapons will only occupy your off-hand when attacking' }),   // 3ARMS: the mod ships true; the port ships false - see the departure in Handheld-Torches.md
      'Handling.RelaxedLanterns': Object.freeze({ default: false, description: 'If enabled, will not stow lanterns when both hands are occupied' }),
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
      // pin names this key as the port's (test/ht1_handheldtorches.test.js).
      'Handling.LanternsAtWaist': Object.freeze({ default: true, description: 'If enabled, lanterns hang at your waist instead of being held: they never need a free hand, are never stowed, and light you from the hip. Torches and candles are still held. (This port’s own switch - the mod has none.)' }),
      'Throwing.ThrowTorchInput': Object.freeze({ default: "X", text: true, description: 'Hold to wind up a throw, release to throw a torch.' }),   // KB1: not read by the mod any more - the key is the registry's action (inputActions.js MOD_ACTIONS); a player's saved value is carried there once (migrateKeyBinds)
      'Throwing.ThrowStrength': Object.freeze({ default: 1.0, min: 0.0, max: 10.0, float: true, step: 0.25, description: 'Multiplier on the throw\u2019s speed (25 at full Strength).' }),
      'Throwing.GravityStrength': Object.freeze({ default: 1.0, min: 0.0, max: 10.0, float: true, step: 0.25, description: 'Multiplier on the thrown torch\u2019s fall.' }),
      'Throwing.ThrowAngleOffset': Object.freeze({ default: 15.0, min: 0.0, max: 45.0, float: true, step: 0.25, description: 'Degrees above the look the torch leaves at.' }),
      'Throwing.ThrowDispersion': Object.freeze({ default: 1.0, min: 0.0, max: 3.0, float: true, step: 0.1, description: 'Degrees of random spread on the throw.' }),
      'Throwing.ThrowScaleSpeed': Object.freeze({ default: 1.0, min: 0.0, max: 10.0, float: true, step: 0.25, description: 'How fast the wind-up charges while the key is held.' }),
      'Throwing.ShowTrajectory': Object.freeze({ default: true, description: 'Draws the throw\u2019s arc while the key is held (DFU only; the port has no world-space line to draw it with \u2014 AUDIT 66 F9).' }),
      'Throwing.Bounciness': Object.freeze({ default: 0.5, min: 0.0, max: 1.0, float: true, step: 0.05, description: 'How much speed a thrown torch keeps when it bounces.' }),
      'Throwing.Combustion': Object.freeze({ default: true, description: 'A thrown torch that strikes a foe can set it alight.' }),
      'Throwing.Accuracy': Object.freeze({ default: 50, min: 0, max: 100, description: 'The to-hit modifier of the thrown torch.' }),
      'Throwing.Duration': Object.freeze({ default: 3, min: 0, max: 60, description: 'Rounds the fire burns on a struck foe.' }),
      'Throwing.Chance': Object.freeze({ default: 50, min: 0, max: 100, description: '% chance the fire takes on a struck foe.' }),
      'Throwing.Magnitude': Object.freeze({ default: Object.freeze([1, 2]), tuple: 'int', description: 'Fire damage a round, least and most.' }),
      'Throwing.Emission': Object.freeze({ default: true, description: 'A burning foe carries a light.' }),
      'Throwing.EmissionShadows': Object.freeze({ default: false, description: 'A burning foe\u2019s light casts shadows (DFU only; no twin here).' }),
      // MODS-ON (2026-09-14, Mac: "all mods should be on by default"): the
      // shipped modsettings.json carries `Sprite = False`, so the mod itself
      // ships its first-person hand switched off - and the hand is the mod's
      // whole subject. The HT2 audit measured what that costs: everything
      // works (all eight sprites decode and upload, the hand is free, the
      // torch is lit) and `draw()` still answers false, so a player lights a
      // torch and sees nothing. This ONE default departs; Ledger A row MODS-ON.
      'Modules.Sprite': Object.freeze({ default: true, description: 'Sprite: a first-person hand holding the lit torch or lantern.' }),
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
      'Modules.Bob': Object.freeze({ default: true, description: 'Bob: the sprite sways as you walk, in step with Weapon Widget\u2019s bob.' }),
      'Modules.Inertia': Object.freeze({ default: false, description: 'Inertia: the sprite lags the look and your movement.' }),
      'Modules.Step': Object.freeze({ default: false, description: 'Step: the sprite\u2019s position is rounded so it moves in steps.' }),
      'Presentation.Tint': Object.freeze({ default: true, description: 'Matches the weapon sprite\'s tint when using First-Person-Lighting.' }),
      'Presentation.Ambidexterity': Object.freeze({ default: false, description: 'Mirror the first-person graphic depending on the free hand. Recommended when using Shield Widget.' }),
      'Presentation.Scale': Object.freeze({ default: 0.8, min: 0.8, max: 1.2, float: true, step: 0.05, description: 'Size of the first-person sprite.' }),
      'Presentation.Offset': Object.freeze({ default: Object.freeze([0.5, 0.5]), tuple: 'float', description: 'Where the sprite rests: in from the side (of half the screen) and up from the bottom (of a quarter).' }),
      'Presentation.Speed': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'How fast the sprite slides on and off the screen.' }),
      'Presentation.LockAspectRatio': Object.freeze({ default: true, description: 'The sprite scales by the screen\u2019s width alone, keeping its proportions.' }),
      'Presentation.PlayerTorchAudio': Object.freeze({ default: true, description: 'Plays a looping burning SFX when you have a torch equipped' }),
      'Presentation.AudioVolume': Object.freeze({ default: 0.5, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'Volume of the burning loop and the torch sounds.' }),
      'Bob.Length': Object.freeze({ default: 100, min: 0, max: 200, description: 'Amount of bobs in a single stride' }),
      'Bob.Offset': Object.freeze({ default: 0.0, min: 0.0, max: 1.0, float: true, step: 0.05, description: 'Advances the bob timing. For use with weapon bob.' }),
      'Bob.SizeX': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'Extent of horizontal movement when bobbing' }),
      'Bob.SizeY': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'Extent of vertical movement when bobbing' }),
      'Bob.SpeedMove': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'Speed of transition between stationary and moving' }),
      'Bob.SpeedState': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'Speed of transition between movement states' }),
      'Bob.Shape': Object.freeze({ default: 0, options: Object.freeze(["U", "Sideways 8", "Inverted U"]), description: 'Shape of bob' }),
      'Bob.BobWhileIdle': Object.freeze({ default: true, description: 'Whether the shield will slightly bob while stationary' }),
      'Inertia.Scale': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'The maximum distance that the sprite will be offset' }),
      'Inertia.Speed': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'The speed that the sprite will move at towards the target offset' }),
      'Inertia.ForwardDepth': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'Multiplier for the change in scale when moving forward or backward' }),
      'Inertia.ForwardSpeed': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'The speed that the sprite will scale towards the target depth' }),
      'Step.Length': Object.freeze({ default: 1, min: 1, max: 10, description: 'The number (x8) whose multiples will be used for snapping' }),
      'Step.Condition': Object.freeze({ default: 0, options: Object.freeze(["Sheathe/Attack Only", "All Transforms"]), description: 'Whether the snapping only affects Sheathing or also other options like Bob, Inertia and Recoil' }),
      'Compatibility.TextureScaleFactor': Object.freeze({ default: 1, min: 0, max: 8, description: 'A custom texture\u2019s pixels per screen pixel of the 320x200 surface.' }),
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
        description: 'Now and then, a short line in the corner about where you are: what a crypt smells like, what a '
          + 'village sounds like at night, how the desert light looks. It depends on the place, the time and the '
          + 'weather, and stays quiet indoors.',
      }),
      textChance: Object.freeze({ default: 33, min: 0, max: 100, description: 'Chance % of selecting any ambient text each interval' }),
      interval: Object.freeze({ default: 200, min: 60, max: 600, description: 'Interval length between checking ambient text in real time seconds' }),
      postTextInterval: Object.freeze({ default: 500, min: 60, max: 600, description: 'Interval length after displaying a message in real time seconds' }),
      textDisplayTime: Object.freeze({ default: 3, min: 1, max: 10, description: 'Length of time text messages are displayed in seconds' }),
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
        description: 'Third person without Morrowind data. Scroll out and the camera moves behind your shoulder and keeps '
          + 'clear of walls. You are drawn as the mod’s character sprite, from all sides, standing, walking, '
          + 'attacking and casting, on foot and on horseback. Its attack and death animations aren’t included. '
          + 'Off keeps you in first person unless you use the Morrowind body.',
      }),
      'Camera.StartInThirdPerson': Object.freeze({ default: false, description: 'Determines the POV when starting or loading a game' }),
      'Camera.FrontalPlaneOffset': Object.freeze({ default: Object.freeze([0.0, 0.5]), tuple: 'float', description: 'Moves the camera position on the X and Y axes' }),
      'Camera.LongitudinalDistance': Object.freeze({ default: 2.0, min: 1, max: 10, float: true, description: 'Moves the camera position nearer or further to the player' }),
      'Camera.MinimumDistance': Object.freeze({ default: 0.8, min: 0, max: 1, float: true, description: 'Prevents the camera from moving too close to the player. Value is a fraction of the Z offset.' }),
      'Camera.RidingOffset': Object.freeze({ default: 1.0, min: 0, max: 2, float: true, description: 'Additional scaling offset to Y and Z axes when riding.' }),
      'Camera.Speed': Object.freeze({ default: 10.0, min: 1, max: 20, float: true, description: 'How fast the camera catches up to where it should be.' }),
      'Camera.Dampen': Object.freeze({ default: 1.0, min: 0, max: 5, float: true, description: 'How much the camera lags behind a sudden move.' }),
      'Camera.Auto-Switch': Object.freeze({ default: true, description: 'X offset will be automatically mirrored if there is not enough space for the camera' }),
      'Camera.SwitchResetTime': Object.freeze({ default: 3.0, min: 0, max: 6, float: true, description: 'Time before the auto-switch is reverted. Set to 0 to disable' }),
      // EOTB4 (2026-09-15, Mac: "instead of numpad being used to change
      // views, I want it scrollable like how we handle morrowind").
      // THE MOD'S OWN KEY, KEPT AND SUPERSEDED. The wheel is the only
      // way in and out now, so this binding does nothing - listed all
      // the same, because the pane is a record of what the mod ships
      // and a key quietly deleted is a key nobody can ask about (the
      // shape HT's `Throwing.ShowTrajectory` is kept in).
      'Camera.TogglePerspective': Object.freeze({ default: 'KeypadEnter', text: true, description: 'The mod\u2019s own view key. The port takes the WHEEL instead \u2014 scroll out of first person and on out, as the Morrowind camera already does \u2014 so this binding is inert here.' }),
      // HT4's finding again, same author, same key: the mod ships Tab,
      // which is free in Daggerfall Unity and SPENT here - PX15 gave it
      // to the port's own pixel dial (ui/input.js). B is unbound in
      // DFU's defaults and unused by the port and by this mod's other
      // keys, and it stays the player's to rebind.
      'Camera.SwitchShoulder': Object.freeze({ default: 'B', text: true, description: 'Mirrors the camera\u2019s X offset if it is non-zero (the mod ships Tab; the port had already spent it on the pixel dial).' }),   // KB1: not read by the mod any more - the key is the registry's action (inputActions.js MOD_ACTIONS); a player's saved value is carried there once (migrateKeyBinds)
      'CameraOverrideWeapon.Enable': Object.freeze({ default: false, description: 'Use this section\u2019s offsets while a weapon or spell is readied.' }),
      'CameraOverrideWeapon.FrontalPlaneOffset': Object.freeze({ default: Object.freeze([0.0, 0.5]), tuple: 'float', description: 'Moves the camera position on the X and Y axes' }),
      'CameraOverrideWeapon.LongitudinalDistance': Object.freeze({ default: 2.0, min: 1, max: 10, float: true, description: 'Moves the camera position nearer or further to the player' }),
      'CameraOverrideMount.Enable': Object.freeze({ default: false, description: 'Use this section\u2019s offsets while riding.' }),
      'CameraOverrideMount.FrontalPlaneOffset': Object.freeze({ default: Object.freeze([0.0, 0.5]), tuple: 'float', description: 'Moves the camera position on the X and Y axes' }),
      'CameraOverrideMount.LongitudinalDistance': Object.freeze({ default: 2.0, min: 1, max: 10, float: true, description: 'Moves the camera position nearer or further to the player' }),
      'CameraOverrideBoat.Enable': Object.freeze({ default: false, description: 'Use this section\u2019s offsets while sailing.' }),
      'CameraOverrideBoat.FrontalPlaneOffset': Object.freeze({ default: Object.freeze([0.0, 0.0]), tuple: 'float', description: 'Moves the camera position on the X and Y axes' }),
      'CameraOverrideBoat.LongitudinalDistance': Object.freeze({ default: 2.0, min: 0, max: 10, float: true, description: 'Moves the camera position nearer or further to the player' }),
      'CameraOverrideBoat.Target': Object.freeze({ default: 1, options: Object.freeze(['Hull', 'Masthead']), description: 'What the camera looks at while sailing.' }),
      // MODS-ON, and Mac's own ask. The mod ships this OFF, and it is
      // the arm the port's whole view seam is built on - with it off
      // there is no way into third person at all, because the key
      // above is inert here. Ledger A row MODS-ON, as HT's
      // `Modules.Sprite` is.
      'CameraScrolling.ScrollableZOffset': Object.freeze({ default: true, description: 'Move the camera closer to or further from the player with an axis' }),
      'CameraScrolling.ScrollIncrement': Object.freeze({ default: 0.2, min: 0.1, max: 1, float: true, description: 'Amount of distance travelled with every scroll' }),
      // `axis`, not `text`: this names a Unity input AXIS, not a
      // KeyCode, and the two are different kinds wearing the same
      // JSON type (TextKey). Declaring it as a key told HT4's
      // spent-key gate to resolve "Mouse ScrollWheel" as a binding,
      // which it is not and never could be. The port's wheel is the
      // DOM's, so this is informational here.
      'CameraScrolling.ScrollableZOffsetAxis': Object.freeze({ default: 'Mouse ScrollWheel', text: true, axis: true, description: 'The axis the mod reads to move the camera offset. The port takes the browser\u2019s own wheel, so this names the input rather than choosing it.' }),
      'AutoTogglePerspective.ToggleInput': Object.freeze({ default: 'KeypadPlus', text: true, description: 'Button that arms or disarms the automatic view changes below.' }),   // KB1: not read by the mod any more - the key is the registry's action (inputActions.js MOD_ACTIONS); a player's saved value is carried there once (migrateKeyBinds)
      'AutoTogglePerspective.OnFoot': Object.freeze({ default: 0, options: Object.freeze(['Don\'tChange', 'FirstPerson', 'ThirdPerson']), description: 'Which view to take on foot, with nothing readied.' }),
      'AutoTogglePerspective.OnFootMelee': Object.freeze({ default: 0, options: Object.freeze(['Don\'tChange', 'FirstPerson', 'ThirdPerson']), description: 'Which view to take on foot with a weapon readied.' }),
      'AutoTogglePerspective.OnFootRanged': Object.freeze({ default: 0, options: Object.freeze(['Don\'tChange', 'FirstPerson', 'ThirdPerson']), description: 'Which view to take on foot with a bow readied.' }),
      'AutoTogglePerspective.OnFootSpell': Object.freeze({ default: 0, options: Object.freeze(['Don\'tChange', 'FirstPerson', 'ThirdPerson']), description: 'Which view to take on foot with a spell readied.' }),
      'AutoTogglePerspective.OnHorse': Object.freeze({ default: 0, options: Object.freeze(['Don\'tChange', 'FirstPerson', 'ThirdPerson']), description: 'Which view to take in the saddle.' }),
      'AutoTogglePerspective.OnHorseReady': Object.freeze({ default: 0, options: Object.freeze(['Don\'tChange', 'FirstPerson', 'ThirdPerson']), description: 'Which view to take in the saddle with something readied.' }),
      'AutoTogglePerspective.OnLycan': Object.freeze({ default: 0, options: Object.freeze(['Don\'tChange', 'FirstPerson', 'ThirdPerson']), description: 'Which view to take transformed.' }),
      'AutoTogglePerspective.OnTransitionInterior': Object.freeze({ default: 0, options: Object.freeze(['Don\'tChange', 'FirstPerson', 'ThirdPerson']), description: 'Which view to take on stepping indoors.' }),
      'AutoTogglePerspective.OnTransitionExterior': Object.freeze({ default: 0, options: Object.freeze(['Don\'tChange', 'FirstPerson', 'ThirdPerson']), description: 'Which view to take on stepping back outside.' }),
      'Graphics.Enable': Object.freeze({ default: true, description: 'Toggle the player graphic' }),
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
      'Graphics.OnFoot': Object.freeze({ default: 0, min: 0, max: FOOT_SKIN_COUNT - 1, description: 'Sprite when on foot',
        labels: Object.freeze(['Light Fighter (female)', 'Light Fighter (male)', 'Medium Fighter (female)', 'Medium Fighter (male)',
          'Heavy Fighter (female)', 'Heavy Fighter (male)', 'Mage (female)', 'Mage (male)',
          'Thief Mage (female)', 'Thief Mage (male)', 'Fighter Mage (female)', 'Fighter Mage (male)',
          'Thief (female)', 'Thief (male)', 'Fighter Thief (female)', 'Fighter Thief (male)',
          ...CLASS_SKINS.map(classSkinLabel)]) }),
      'Graphics.OnHorse': Object.freeze({ default: 0, min: 0, max: 4, description: 'Sprite when riding a horse',
        labels: Object.freeze(['Light Fighter (female)', 'Medium Fighter (male)', 'Medium Fighter (female)', 'Heavy Fighter (male)', 'Heavy Fighter (female)']) }),
      'Graphics.ReadyStance': Object.freeze({ default: 2, options: Object.freeze(['Never', 'When Idle', 'When Idle or Moving']), description: 'Whether the sprite will change states when readying a weapon or spell' }),
      'Graphics.TurnToView': Object.freeze({ default: 2, options: Object.freeze(['Never', 'Only When Animating', 'When Weapon Readied', 'Always']), description: 'Configure when the sprite turns to face the view' }),
      'Graphics.AttackStrings': Object.freeze({ default: 3, options: Object.freeze(['None', 'Mirror', 'PingPong', 'Mixed']), description: 'Optional attack animations' }),
      'Graphics.MirrorTime': Object.freeze({ default: 3.0, min: 1, max: 5, float: true, description: 'Time before reverting the mirrored state. Set to 0 to disable.' }),
      'Graphics.PingPongOffset': Object.freeze({ default: 1, min: -3, max: 3, description: 'Adjusts the point in the animation where it starts playing backwards' }),
      'Graphics.FirstPersonBillboard': Object.freeze({ default: 1, options: Object.freeze(['None', 'Shadows Only', 'Visible']), description: 'Visibility of the player billboard in first-person' }),
      'Graphics.ShowCart': Object.freeze({ default: true, description: 'A 3D cart will follow your billboard when using the Cart Transport Mode' }),
      'Graphics.TorchOffset': Object.freeze({ default: 1, options: Object.freeze(['Vanilla', 'Billboard', 'Selfie']), description: 'Whether the torch follows the orientation of the sprite' }),
      'Animation.WalkCycleSpeed': Object.freeze({ default: 1.0, min: 0.5, max: 1.5, float: true, description: 'Multiplier on how fast the walk cycle plays.' }),
      'Animation.SyncFootsteps': Object.freeze({ default: true, description: 'Footstep sounds fire on the sprite\u2019s own footfalls.' }),
      'Animation.BillboardScale': Object.freeze({ default: 1.0, min: 0, max: 10, float: true, description: 'Size of the player sprite.' }),
      'Animation.FineBillboardScale': Object.freeze({ default: 0.0, min: 0, max: 1, float: true, description: 'Added to BillboardScale, for a finer adjustment.' }),
      'Animation.GlobalOffsetScale': Object.freeze({ default: 1.0, min: 0, max: 10, float: true, description: 'Multiplier on every sprite offset. INERT in the mod itself: its assembly reads the dial into a field nothing consumes (get_scaleOffset has no caller), and the port keeps that.' }),
      'Animation.FineGlobalOffsetScale': Object.freeze({ default: 0.0, min: 0, max: 1, float: true, description: 'Added to GlobalOffsetScale, for a finer adjustment - inert, as that is.' }),
      'Compatibility.Don\'tHideWeapon': Object.freeze({ default: false, description: 'Stops the FPV Weapon graphic from being hidden or shown' }),
      'Compatibility.Don\'tHideHorse': Object.freeze({ default: false, description: 'Stops the FPV Horse graphic from being hidden or shown' }),
      'Compatibility.Don\'tOffsetAttacks': Object.freeze({ default: false, description: 'Stops the attack-from-body code from running for melee and ranged' }),
      'Debug.ShowMessages': Object.freeze({ default: true, description: 'Print the mod\u2019s own status lines when the view or the shoulder changes.' }),
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
        description: 'Footsteps that match the ground you walk on, and armour that rattles as you move.',
      }),
      'AudioQualitySettings.SoundClipQuality': Object.freeze({ default: 0, options: Object.freeze(['Low-Quality (Retro)', 'High-Quality']), description: 'What Quality Sound-Clips Get Used' }),
      'FootstepSettings.AllowFootstepSounds': Object.freeze({ default: true, description: 'If Player Footsteps Should Make A Sound || Default = True' }),
      'FootstepSettings.FootstepVolumeMulti': Object.freeze({ default: 1.0, min: 0.0, max: 10.0, float: true, step: 0.1, description: 'The Volume Level Multiplier For Footstep Sounds' }),
      'FootstepSettings.FootstepFrequency': Object.freeze({ default: 0.6, min: 0.3, max: 3.0, float: true, step: 0.1, description: 'How Frequent Footstep Sounds Should Be, Lower = More Often, Higher = Less Often' }),
      'ArmorSwaySettings.AllowArmorSwaySounds': Object.freeze({ default: true, description: 'If Armor Specific Sounds Play When The Player Moves About || Default = True' }),
      'ArmorSwaySettings.ArmorSwayVolumeMulti': Object.freeze({ default: 1.0, min: 0.0, max: 10.0, float: true, step: 0.1, description: 'The Volume Level Multiplier For Armor Sway Sounds' }),
      'ArmorSwaySettings.ArmorSwayFrequency': Object.freeze({ default: 0.6, min: 0.3, max: 3.0, float: true, step: 0.1, description: 'How Frequent Armor Sway Sounds Should Be, Lower = More Often, Higher = Less Often' }),
      'ErrorLoggingAndCompatibilitySettings.AllowModCompatWarnings': Object.freeze({ default: true, description: 'If Mod Should Give Warning Messages About Detected Incompatibility Issues || Default = True' }),
      'ErrorLoggingAndCompatibilitySettings.AllowVerboseErrorLogging': Object.freeze({ default: false, description: 'If Mod Should Print Full & Verbose Error Logs For Debugging || Default = False' }),
      'ErrorLoggingAndCompatibilitySettings.DoNotSpamExceptionsLogs': Object.freeze({ default: true, description: 'Only Log Mod Exceptions Once Per Session, To Not Fill Log File || Default = True' }),
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
        description: 'The camera shakes when you’re hurt, each dungeon gets its own fog, light and echo, and you can hear '
          + 'rain indoors.',
      }),
      'Better Footsteps.enable': Object.freeze({ default: false, description: 'Enables better footsteps module' }),
      'Better Footsteps.armorVolume': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'Volume for armor clanking' }),
      'Better Footsteps.footstepVolume': Object.freeze({ default: 1.0, min: 0.0, max: 2.0, float: true, step: 0.1, description: 'Volume for footsteps' }),
      'Dungeon Reverb.level': Object.freeze({ default: 1, options: Object.freeze(['Low', 'Medium', 'High']), description: 'How much a dungeon echoes: Low is a cave, Medium a stone room, High a quarry.' }),
      'Camera Shake.shakeAmountAdd': Object.freeze({ default: 0.0, min: 0.0, max: 20.0, float: true, step: 0.5, description: 'Shake added to every hit, before the hit\u2019s own share.' }),
      'Camera Shake.shakeAmountMultiplier': Object.freeze({ default: 10.0, min: 0.0, max: 20.0, float: true, step: 0.5, description: 'Shake per hit, scaled by the damage as a share of your full health.' }),
      'Camera Shake.maxShake': Object.freeze({ default: 10.0, min: 0.1, max: 30.0, float: true, step: 0.5, description: 'The most one hit can shake the camera.' }),
      'Camera Shake.roughness': Object.freeze({ default: 10.0, min: 0.1, max: 30.0, float: true, step: 0.5, description: 'How jarring the shake is: lower is smoother.' }),
      'Camera Shake.fadeInTime': Object.freeze({ default: 0.3, min: 0.05, max: 3.0, float: true, step: 0.05, description: 'Seconds the shake takes to build.' }),
      'Camera Shake.fadeOutTime': Object.freeze({ default: 0.5, min: 0.05, max: 3.0, float: true, step: 0.05, description: 'Seconds the shake takes to settle.' }),
      'Dungeon Fog.enableFog': Object.freeze({ default: true, description: 'Enables random dungeon Fog Effect' }),
      'Dungeon Fog.maxFogDistance': Object.freeze({ default: 100.0, min: 20.0, max: 200.0, float: true, step: 1, description: 'Max fog distance from fog start' }),
      'Dungeon Fog.minFogDistance': Object.freeze({ default: 80.0, min: 20.0, max: 200.0, float: true, step: 1, description: 'Min fog distance from fog start' }),
      'Dungeon Fog.maxFogStart': Object.freeze({ default: 10.0, min: 0.0, max: 100.0, float: true, step: 1, description: 'Max fog start from camera' }),
      'Dungeon Fog.minFogStart': Object.freeze({ default: 0.0, min: 0.0, max: 100.0, float: true, step: 1, description: 'Min fog start from camera' }),
      'Dungeon Lighting.enableFogAmbientEffect': Object.freeze({ default: false, description: 'Enables custom dungeon ambient lighting' }),   // BA2: ships off (see above)
      'Dungeon Lighting.dungeonDarkness': Object.freeze({ default: 1.0, min: 0.0, max: 3.0, float: true, step: 0.1, description: 'The darkness of dungeons' }),
      'Dungeon Lighting.fogAmbientEffect': Object.freeze({ default: 0.2, min: 0.0, max: 1.0, float: true, step: 0.05, description: 'How much the random dungeon color affects dungeon lighting' }),
      'Better Rain.enableBetterRain': Object.freeze({ default: true, description: 'Makes rain particles look a bit better' }),
      'Better Rain.enableBetterSnow': Object.freeze({ default: true, description: 'Makes snow particles look a bit better' }),
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
        description: 'Level up like Oblivion Remastered: every skill you raise fills a 100-point bar, and each level gives '
          + 'you virtues to spend on the attributes you choose. New characters are asked which system they want.',
      }),
      attributePoints: Object.freeze({ default: 12, min: 0, max: 60, description: 'Amount of points for increasing attributes' }),
      maxUpdatableAttribute: Object.freeze({ default: 3, min: 2, max: 8, description: 'The number of attributes to be increased in one level up' }),
      allowLuckIncrease: Object.freeze({ default: true, description: 'Allow Luck to be increased by more than one point' }),
      luckIncreaseCost: Object.freeze({ default: 4, min: 1, max: 20, description: 'Cost to upgrade Luck by one point' }),
      // The port's own, for Daggerfall's third tier of chosen skills.
      primarySkillsImpact: Object.freeze({ default: 8, min: 0, max: 100, description: 'Points given by a Primary Skill level up (100 points required to level up). Daggerfall has a tier of skills Morrowind does not, so this knob is the port’s own; it ships equal to the major skills’, which is where the mod’s own top tier sits.' }),
      majorSkillsImpact: Object.freeze({ default: 8, min: 0, max: 100, description: 'Points given by a Major Skill level up (100 points required to level up)' }),
      minorSkillsImpact: Object.freeze({ default: 6, min: 0, max: 100, description: 'Points given by a Minor Skill level up (100 points required to level up)' }),
      miscSkillsImpact: Object.freeze({ default: 2, min: 0, max: 100, description: 'Points given by a Misc Skill level up (100 points required to level up)' }),
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
        description: 'Choose between Daggerfall’s fast travel and a journey you actually travel, sped up to sixty times, '
          + 'with a panel to steer it. Encounters and places along the way stop you, and you can follow the '
          + 'roads. Off brings back the classic travel map and fast travel only.',
      }),
      'CautiousTravel.PlayerControlledCautiousTravel': Object.freeze({ default: true, description: "Enables the travel option \"Cautiously\" to initiate time accelerated travel, instead of vanilla fast travel" }),
      'CautiousTravel.SpeedPenalty': Object.freeze({ default: 20, min: 5, max: 40, description: "Speed penalty for travelling cautiously, as a percentage" }),
      'CautiousTravel.MaxChanceToAvoidEncounter': Object.freeze({ default: 95, min: 60, max: 100, description: "Maximum chance to avoid an encounter when travelling cautiously, as a percentage" }),
      'CautiousTravel.HealthMinimumPercentage': Object.freeze({ default: 5, min: 0, max: 25, description: "Level of health that will automatically pause the journey when travelling cautiously, as a percentage" }),
      'CautiousTravel.FatigueMinimumValue': Object.freeze({ default: 5, min: 0, max: 50, description: "Level of fatigue that will automatically pause the journey when travelling cautiously, absolute value" }),
      // TO-FIELD2 (Mac, 2026-09-18): "travel options instantly transports
      // you to a destination and theres no travel". DEPARTURE FROM THE
      // MOD'S SHIPPED DEFAULT, on Mac's word, and it is the whole of that
      // report. IsPlayerControlledTravel is an AND over three toggles
      // (travelPopUp.js:192): `(cautiousTravel || !speedCautious) &&
      // (stopAtInnsTravel || !sleepModeInn) && !travelShip`. The popup
      // opens with `sleepModeInn = true` - classic Daggerfall's own
      // default, stopping at inns - so with this key false the second
      // clause is false and EVERY default trip fell to DFU's fast
      // travel. A player had to find the Camp Out toggle before the mod
      // they turned on ever ran. Hazelnut ships it false because his
      // mod is opt-in over vanilla; here the walked journey IS the
      // feature, so it is on. The key is still a key: turning it off in
      // the Mods pane restores the mod's own default exactly.
      'StopAtInnsTravel.PlayerControlledInnsTravel': Object.freeze({ default: true, description: "Enables the stop for night travel option \"Inns\" to initiate time accelerated travel, instead of fast travel" }),
      'ShipTravel.OnlyFromPorts': Object.freeze({ default: true, description: "Restricts ship travel to be possible only from places with ports" }),
      'ShipTravel.OnlyToPorts': Object.freeze({ default: false, description: "Restricts ship travel to be possible only if destination has a port, if from ports setting is enabled" }),
      'GeneralOptions.AllowTargetingMapCoordinates': Object.freeze({ default: true, description: "Allows travel map to target any coordinates using time accelerated travel" }),
      'GeneralOptions.LocationPause': Object.freeze({ default: 0, options: Object.freeze(["off", "nearby", "entered"]), description: "Auto pause when encountering a game location during real time accelerated travel" }),
      'GeneralOptions.AllowWeather': Object.freeze({ default: false, description: "Allows weather effects during time accelerated travel" }),
      'GeneralOptions.AllowAnnoyingSounds': Object.freeze({ default: false, description: "Allows footstep and hoof sounds during time accelerated travel" }),
      'GeneralOptions.AllowRealGrass': Object.freeze({ default: false, description: "Allows the Real Grass mod to run during time accelerated travel" }),
      // TRAVEL-NAV1 (2026-09-25, Mac: "Improving travel options navigation
      // to properly route around objects and stopping before running into
      // buildings"): THE PORT'S OWN KEY on the mod's pane, as HT-WAIST's is
      // on Handheld Torches' - the vendored modsettings.json does not carry
      // it and its words say so. ON: a journey steers round buildings,
      // walls and rocks and pauses short of what it cannot pass
      // (systems/travelSteer.js). OFF: the mod's own beeline, exactly.
      'GeneralOptions.AvoidObstacles': Object.freeze({ default: true, description: 'Steers time accelerated travel around buildings, walls and rocks, and pauses the journey before walking into one it cannot get round. (This port’s own switch - the mod has none.)' }),
      // OW-TOGGLE (2026-09-28, Mac: "bring back the original travel option as a toggle. Off by default." - "The normal
      // first person travel accelerated was removed in favor of the overworld travel"): THE PORT'S OWN KEY on the mod's
      // pane, as AvoidObstacles is. ON: a journey is the mod's own, walked in first person as before OW-ONLY - a map
      // pick begins it on the ground, the view does not rise with it and coming down does not stop it
      // (scenes/world.js tvOwnsJourneys, which reads it live - AUDIT OW5 T1). OFF, the default: OW-ONLY.
      'GeneralOptions.FirstPersonTravel': Object.freeze({ default: false, description: 'Walks time accelerated journeys in first person, as before the Overworld: a journey picked on the travel map runs on the ground, and the Overworld view neither rises with it nor stops it when brought down. Off, a journey on the enhanced interface is taken in the Overworld. Takes effect at once. (This port’s own switch - the mod has none.)' }),
      // TO-ROADS (FIELD BUGS 2026-09-29d, SylviaBun on the Discord: "Travel Options First Person doesn't follow roads like
      // Overworld Travel Options does" - "A way to toggle this behavior to match or not would be nice"): THE PORT'S OWN
      // KEY beside First-Person Travel, the same shape - not in the vendored modsettings.json, on the tile, read live. ON,
      // with First-Person Travel on: a journey picked on the travel map is the Overworld's route - its planner, its legs,
      // its refusals (scenes/world.js tvRoutesJourneys) - walked in first person, the view not raised. OFF, the default:
      // First-Person Travel is the mod's own straight journey, the original travel option Mac asked back.
      'GeneralOptions.FirstPersonTravelFollowsRoads': Object.freeze({ default: false, description: 'With First Person Travel on, a journey picked on the travel map follows the roads and tracks as the Overworld’s journeys do - planned round the mountains, and refused where no way by land reaches - and is walked in first person, the Overworld view not raised. Off, it walks straight to its destination, as Travel Options does. Takes effect at once. (This port’s own switch - the mod has none.)' }),
      // RATE-LAW (2026-10-04, Mac: "Remove travel options dials" / "Roads now travel at x100 and non roads at x60"): the
      // mod's TimeAcceleration section (DefaultStartingAcceleration, AlwaysUseStartingAcceleration, AccelerationLimit)
      // is not declared - the spinner it started and bounded is gone, and a journey runs at its ground's rate
      // (systems/timeScale.js travelRateOf). The vendored modsettings.json keeps the three; test/to1_travelOptions.test.js
      // names them as the one section the port leaves out.
      'Teleportation.EnablePaidTeleportation': Object.freeze({ default: false, description: "Enable paid Mages teleportation service for all guild members, before rank 8" }),
      // the shipped file's spacer section "__" carries no keys
      'RoadsIntegration.Enable': Object.freeze({ default: true, description: "Enhances the travel map with larger location dots for cities & towns, and shows roads & tracks with toggle buttons" }),
      'RoadsIntegration.VariableSizeDots': Object.freeze({ default: true, description: "All locations, except for cities & towns, are rendered as smaller dots" }),
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
      'RoadsIntegration.FollowPathsKey': Object.freeze({ default: 3, keyChoice: true, options: Object.freeze(["None", "F", "G", "K", "O", "X", "Custom Key Bind"]), description: "Sets the key to initiate time accelerated travelling following paths if roads integration enabled" }),   // KB1: not read by the mod any more - the key is the registry's action (inputActions.js MOD_ACTIONS); a player's saved value is carried there once (migrateKeyBinds)
      'RoadsIntegration.FollowPathsCustomKeyBind': Object.freeze({ default: "", text: true, description: "Custom key bind for following paths used if CustomBind set above" }),   // KB1: not read by the mod any more - the key is the registry's action (inputActions.js MOD_ACTIONS); a player's saved value is carried there once (migrateKeyBinds)
      'RoadsIntegration.EnableWaterways': Object.freeze({ default: false, description: "Enhances the travel map with rivers and streams with a toggle button" }),
      'RoadsIntegration.EnableStreamsToggle': Object.freeze({ default: false, description: "Adds a streams toggle button separate from rivers button" }),
      'RoadsIntegration.MarkLocationColor': Object.freeze({ default: '#ffeb05ff', color: true, description: "The colour used to highlight locations using middle mouse button on travel map" }),
      // the shipped file's spacer section "-" carries no keys
      'FastTravelCostScaling.FastTravelCostScaleFactor': Object.freeze({ default: 1, min: 1, max: 10, description: "Scales the cost of inns when using standard fast travel, suggest x4-x6 for Climate & Calories." }),
      'FastTravelCostScaling.ShipTravelCostScaleFactor': Object.freeze({ default: 1, min: 1, max: 10, description: "Scales the cost of ships when using standard fast travel, suggest x2-x3 for Climate & Calories." }),
      // the shipped file's spacer section "_" carries no keys
      'RoadsJunctionMap.Enable': Object.freeze({ default: true, description: "Enables the junction mini-map" }),
      'RoadsJunctionMap.PersistentMap': Object.freeze({ default: false, description: "Set this to have the junction mini-map always displayed when following paths" }),
      'RoadsJunctionMap.ToggleMapOffPaths': Object.freeze({ default: true, description: "Set this to have the junction mini-map toggled when follow key pressed and not on a path" }),
      'RoadsJunctionMap.ScreenSize': Object.freeze({ default: 75, min: 40, max: 200, description: "The width and height the mini-map is rendered on the screen" }),
      'RoadsJunctionMap.ScreenPositionX': Object.freeze({ default: 235, min: 0, max: 280, description: "The X coordinate the mini-map is rendered on the screen" }),
      'RoadsJunctionMap.ScreenPositionY': Object.freeze({ default: 10, min: 0, max: 160, description: "The Y coordinate the mini-map is rendered on the screen" }),
      'RoadsJunctionMap.FilterMode': Object.freeze({ default: 0, options: Object.freeze(["Point", "Bilinear", "Trilinear"]), description: "Pixel filtering to use when rendering the mini-map" }),
      'RoadsJunctionMap.Circular': Object.freeze({ default: true, description: "Draw the mini-map in a circle around the player" }),
      'RoadsJunctionMap.PlayerColor': Object.freeze({ default: '#ff0000ff', color: true, description: "The colour of the player position and direction indicator" }),
      'RoadsJunctionMap.Opaque': Object.freeze({ default: false, description: "Render the mini-map with an opaque background color" }),
      'RoadsJunctionMap.BackgroundColor': Object.freeze({ default: '#327f19ff', color: true, description: "The opaque background color to use for the mini-map" }),
      // the shipped file's spacer section "--" carries no keys
      // the shipped file's spacer section "." carries no keys
      'LocationColours.DungeonLabyrinth': Object.freeze({ default: '#d77727ff', color: true, description: "The colour shown on the travel map" }),
      'LocationColours.DungeonKeep': Object.freeze({ default: '#bf571bff', color: true, description: "The colour shown on the travel map" }),
      'LocationColours.DungeonRuin': Object.freeze({ default: '#ab330fff', color: true, description: "The colour shown on the travel map" }),
      'LocationColours.Graveyard': Object.freeze({ default: '#930f07ff', color: true, description: "The colour shown on the travel map" }),
      'LocationColours.Coven': Object.freeze({ default: '#0f0f0fff', color: true, description: "The colour shown on the travel map" }),
      'LocationColours.Farm': Object.freeze({ default: '#9b696aff', color: true, description: "The colour shown on the travel map" }),
      'LocationColours.WealthyHome': Object.freeze({ default: '#bc8a8aff', color: true, description: "The colour shown on the travel map" }),
      'LocationColours.PoorHome': Object.freeze({ default: '#7e5159ff', color: true, description: "The colour shown on the travel map" }),
      'LocationColours.Temple': Object.freeze({ default: '#b0cdffff', color: true, description: "The colour shown on the travel map" }),
      'LocationColours.Cult': Object.freeze({ default: '#447cc0ff', color: true, description: "The colour shown on the travel map" }),
      'LocationColours.Tavern': Object.freeze({ default: '#8c5637ff', color: true, description: "The colour shown on the travel map" }),
      'LocationColours.City': Object.freeze({ default: '#e3b490ff', color: true, description: "The colour shown on the travel map" }),
      'LocationColours.Hamlet': Object.freeze({ default: '#c18564ff', color: true, description: "The colour shown on the travel map" }),
      'LocationColours.Village': Object.freeze({ default: '#a56446ff', color: true, description: "The colour shown on the travel map" }),
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
      // holds it off (systems/onlineLane.js). The key is still a key: turning it on restores the mod's own default.
      'General.DisableNormalTravel': Object.freeze({ default: false, description: 'If this option is eabled, you will no longer be able to travel from the map and you will have to use ONLY carriages and ships.' }),
      'General.DailyCarriageFee': Object.freeze({ default: 1, min: 0, max: 99, description: 'The fee you must pay to travel with a carriage for every day of travel' }),
      'General.ClearerMapDots': Object.freeze({ default: true, description: 'Draws larger dots depending on town size in the travel map.' }),
      'General.DrawRoads': Object.freeze({ default: true, description: 'Draw roads on the map (if the BasicRoads mod is installed and enabled).' }),
      'General.DrawTracks': Object.freeze({ default: true, description: 'Draw dirt tracks on the map (if the BasicRoads mod is installed and enabled).' }),
      'General.RegionLockedCarriages': Object.freeze({ default: false, description: 'Prevent carriages from travelling to a different region. You must travel from the capital city to leave the region.' }),
      'ShipTravel.DisableShipTravelOutsideDocks': Object.freeze({ default: true, description: 'Prevents you from choosing ship transport mode during land travel' }),
      'ShipTravel.DailyShipCost': Object.freeze({ default: 15, min: 0, max: 99, description: 'Daily cost of renting a ship. Only applies if the player doesn\'t own their own ship' }),
      'ShipTravel.DailyCaptainFee': Object.freeze({ default: 10, min: 0, max: 99, description: 'Daily cost of hiring a ship captain and his crew to man a ship. You will have to pay a captain even if you own the ship.' }),
      'ShipTravel.LimitedRangeInSmallDocks': Object.freeze({ default: true, description: 'Ships in smaller locations will only take you to ports in the same region. To travel to a different region you\'ll need to sail from a city' }),
      'ShipTravel.ShowLargerDocks': Object.freeze({ default: true, description: 'Uses larger dots on the map for loactions with a dock' }),
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
        description: 'Your horse and cart stay in the world: they wait where you get off, follow you or stay on command, '
          + 'and you hitch or mount them by walking up to them. Online, other players see them where you left '
          + 'them.',
      }),
      'Persistence.PhysicalPersistence': Object.freeze({ default: true, description: 'Physical Horse & Wagon Persistence. On: horse and wagon positions persist when left behind. Off: remote positions are forgotten and owned transport is recalled for vanilla-style transport and wagon access; the moving trailing wagon remains. Re-enabling starts fresh with owned transport at the player.' }),
      'Presentation.ShowTrailingWagon': Object.freeze({ default: true, description: 'Trailing Wagon While Riding. When disabled, hides only the wagon that trails behind you in Cart mode. Deployed and following wagons, cargo storage, physical persistence, and wagon gameplay remain enabled.' }),
      'Following.HorseFollowDistance': Object.freeze({ default: 3, min: 2, max: 8, description: 'Horse Follow Distance. Sets how closely a following horse stays behind you. This also applies to the horse leading a following wagon.' }),
      'Following.AvoidCombat': Object.freeze({ default: true, description: 'Following Horse Avoids Combat. When enabled, a following horse or horse-and-wagon team will try to keep away from hostile enemies during combat.' }),
      'Following.FollowFastTravel': Object.freeze({ default: true, description: 'Following Transport Fast Travels With You. When disabled, transport currently commanded to Follow waits where it was when fast travel begins.' }),
      'WagonAccess.InteriorAccessDistance': Object.freeze({ default: 50, min: 10, max: 100, description: 'Interior Wagon Access Distance. Sets how close your wagon must be parked to a building or dungeon entrance to access it from inside.' }),
      'Hotkeys.QuickMountDismount': Object.freeze({ default: 'Alpha5', text: true, description: 'Quick Mount / Dismount. Mounts your last-used horse or wagon using the same range and ownership rules as the Transport menu. Pressing it while riding dismounts immediately. Click it and press a key to rebind; \u2715 clears it (None).' }),   // KB1: not read by the mod any more - the key is the registry's action (inputActions.js MOD_ACTIONS); a player's saved value is carried there once (migrateKeyBinds)
      'Hotkeys.SummonTransport': Object.freeze({ default: 'Alpha6', text: true, description: 'Summon Horse & Wagon. Teleports owned transport to a nearby layout while outdoors. Click it and press a key to rebind; \u2715 clears it (None).' }),   // KB1: not read by the mod any more - the key is the registry's action (inputActions.js MOD_ACTIONS); a player's saved value is carried there once (migrateKeyBinds)
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
