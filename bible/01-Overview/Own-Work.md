# Own Work

DFO Online's features are its own work (OWN-WORK, the owner: "Our goal is no latching onto other mod authors or
needing permissions"; `Port-Doctrine.md`). A feature that came from an outside mod keeps its switch, settings and
behaviour. Its pictures, sounds, models, data and words are made by our code, or by our rules over the player's own
ARENA2. No Bethesda data ships in the tree either (NO-BETHESDA, below). This page lists the outside work the tree
still carries and why, the record of every folder that left, and the questions only the owner can settle.

## What the tree carries, and why

- **Kamer's and Kamer & Kab's work** (the owner: "Counts as ours - keep"): `world-of-daggerfall`, `windmills-kamer`,
  `daggerfall-arena`, `world-events-raiding-parties`, `warm-ashes-ships`, `low-poly-trees` and
  `daggerfall-enemy-expansion`. They made it for this game.
- **GrimoireUI** (the owner: "Grimoire ui can stay"): `grimoire-ui`, its 93 screens, 38 buttons and 2 fonts under
  `public/art/grimoire-ui/`, as the pack ships them, on its author's permission.
- **DFO's and Mac's own work**: `project-legacy`, `raum-book`, `pixelify-glyphs` and `layered-armor` (the owner:
  "Layered Gear is ours", its cloak layer included).
- **Daggerfall Unity's MIT data**: `dfu-books`, `dfu-icons`, `dfu-cursor`, `dfu-quests`, `dfu-settings` and
  `dfu-text`. DFU is the reference (Port-Doctrine's Scope).
- **A licensed piece**: `silkscreen-five`, one glyph under the SIL OFL 1.1, whose licence travels with it.

`Mod-Registry.md` has a row for each folder. `test/systems/credits.test.js` holds every folder to a README of its
source and terms, and every key retired below to no folder.

## How our work is made

- **Pictures** are recipes for our painter (`src/art/ownPainter.js`): shapes, dithered light and a dark rim, each
  recipe beside its feature. Or they are our rule over the player's classic record: a reshaped weapon frame, a dyed
  class sprite, a horse with its rider taken off, a texture pack's upscale.
- **A classic picture** the game shows unchanged is built from a spec: the record, its palette and its offset, never a
  pixel and never an edit (`tools/classicDerive.mjs` writes them, `src/formats/classicPictures.js` builds them through
  `src/systems/classicArt.js`). A player without ARENA2 stored sees one as a failed load. Each folder holds a picture as
  a file or a spec, never both (`test/tooling/doctrine.test.js`).
- **Sounds** are made by our synth at runtime (`src/audio/synth/`), seeded, at each clip's name, length and rate.
  Each is set by its loudness (`src/audio/synth/dsp.js` `loudnessOf`) against Daggerfall's own sounds. A long bed is
  layered loops of different lengths (`src/audio/layeredLoop.js`), so it comes round only after hours.
- **Models** are built by our mesh builders: Come Sail Away's boats (`src/world/ships/ownBoats/`), Weapon Sheathing's
  scabbards (`src/systems/ownSheathing.js`).
- **Data and words** are our own tables and text, under the keys a save or a setting names.

## NO-BETHESDA: no Bethesda data in the tree

`tools/bethesdaScan.mjs` reads every tracked file against the freeware ARENA2 (`sh tools/fetch-data.sh`). It checks
each file's sha256 against every ARENA2 file and BSA record, and looks for any run of 64 bytes or more of ARENA2
inside a file. It sets every PNG against every TEXTURE, IMG and CIF/RCI frame in ART_PAL and PAL.PAL: an exact copy at
1x to 4x, mirrored or not, or a near one whose light follows the record's. A picture whose drawn pixels are 60% or more
a classic record's is not carried. `test/tooling/nobethesda.test.js` pins each measure on made-up data and scans the
tree when `ARENA2_PATH` is set.

What it finds: no ARENA2 file and no BSA record. The site and the desktop app read the player's own ARENA2
(`src/scenes/dataSource.js`, `app/lib/arena2Detect.cjs`), and `vite.config.js` serves `/arena2` to the dev server
alone. The two exceptions' folders are Daggerfall's art repainted, as Port-Doctrine says. Daggerfall Unity's quest
scripts and its TEXT.RSC table carry Bethesda's words: the game speaks our own quest words (`06-Systems/Own-Words.md`),
and `tools/bethesdaWordsBaseline.json` counts the 1,448 rows of `Internal_RSC.csv` left, a count that only goes down.

The scan cannot see audio beyond raw 8-bit runs (DAGGER.SND, MIDI.BSA), nor Morrowind's data, which is not freeware
and not here. It cannot decode two greyscale skin maps of ours (`public/skin/`).

## Open: the owner's call

- **Homes made in the town packs' layouts.** A house, room, quest site or anchor a save stamped with Beautiful
  Villages' or Beautiful Cities' layout sleeps (`src/systems/layoutPins.js`). Online, `homes.layout` still names the
  packs: those homes sleep, and their towns refuse new claims until each is moved to a classic house of the same
  town. This must be settled before the work reaches players.
- **The packs' code.** The art, models and sound are ours. The behaviour of every row below whose code is not MIT is
  still a port of the author's, on Mac's word of permission: Snowfall's (`src/systems/snowfall.js`,
  `src/systems/snowfallRuntime.js`, pinned to the author's C# by nine hash traces), Windfall's, Horse Cart and
  Cargo's, Come Sail Away's, Eye of the Beholder's and Handheld Torches' among them. Rewriting each in our own design
  is work of its own.
- **Past the Bay, 20 of 1,221 yards** stand off their cells, on Daggerfall's own blocks (`03-World/Town-Shapes.md`).
- **Words still the authors'.** About 100 dish and drink names in `src/systems/survival/tavernMenu.js` and the meal
  and camp lines (`SURVIVAL_USE_TEXT`, `CAMP_TEXT`) are Climates & Calories'; several look like another game's recipe
  names. Foraging's and Roleplay & Realism's quests keep the authors' QBN logic byte for byte, as DFU's quests keep
  DFU's.
- **TEXT.RSC's rows** in `vendor/dfu-text/Internal_RSC.csv`, and DFU's tables of Bethesda's names
  (`06-Systems/Own-Words.md`).

## Retired from vendor/

Each row is the record a retired folder's README and registry row held: the release, its author, its licence or
permission, what the tree carried, our code that is now the record, and the commit whose tree still holds the files.
An open record stays open here.

| vendor | mod | author | licence or permission | what the tree carried | our code, now the record | files last in |
|---|---|---|---|---|---|---|
| `pcaao` | Physical Combat And Armor Overhaul 1.44 | Kirk.O | repository states none; granted (Mac handed the bundle over 2026-09-12) - **RECORD OPEN** | manifest, settings (7 module switches) | `combat/pcaao.js`, `combat/pcaaoMeanerMonsters.js`, `systems/modSettings.js` | `1b97b3a8f` |
| `unleveledLoot` | Unleveled Loot 1.1.2 | Ralzar | MIT ("Copyright (C) 2020 Ralzar"; "License: MIT License (http://www.opensource.org/licenses/mit-license.php)") | manifest, settings (10 material switches) | `systems/unleveledLoot.js`, `systems/modSettings.js` | `1b97b3a8f` |
| `meanerMonsters` | Meaner Monsters 1.5.2 | Ralzar ("Author: Hazelnut & Ralzar") | MIT ("Copyright (C) 2020 Ralzar"; "License: MIT License (http://www.opensource.org/licenses/mit-license.php)") | manifest, 46 sprite-scale XML files | `characters/meanerMonsters.js`, `world/billboardXml.js`, `systems/modSettings.js` | `1b97b3a8f` |
| `seasons-iliac-bay` | Seasons of the Iliac Bay 1.1 | RosyTheRascal | granted to Mac 2026-09-05 - **RECORD OPEN** | the manifest alone (the player's own `.dfmod` is read at runtime, and still is) | `systems/seasonsIliacBay.js`, `systems/seasonsIliacBayAssets.js`, `systems/modSettings.js` | `1b97b3a8f` |
| `world-tooltips` | World Tooltips 1.1 | jefetienne | MIT ("Copyright (c) 2009-2018 jefetienne"; the full notice is in `LICENSE`) | manifest, settings, the mod's C# source, its LICENSE | `systems/worldTooltips.js`, `systems/worldHover.js`, `systems/modSettings.js` | `1b97b3a8f` |
| `readied-spellcasting-hands` | Readied Spellcasting Hands 1.3 | jefetienne | MIT ("Copyright (c) 2009-2018 jefetienne"; the full notice is in `LICENSE`) | manifest, the mod's two C# files, its LICENSE | `combat/fpsSpellCasting.js` (`readiedHandsFrame`), `combat/weapon/weaponRig.js`, `systems/modSettings.js` | `1b97b3a8f` |
| `weapon-widget` | Weapon Widget 1.6 | RedRoryOTheGlen | granted (Mac handed the zip over 2026-09-14) - **RECORD OPEN** | manifest, settings (41 keys) | `combat/weapon/weaponWidget.js`, `combat/weapon/weaponWidgetMotion.js`, `combat/weapon/weaponWidgetAssets.js`, `combat/weapon/weaponRig.js`, `systems/modSettings.js` | `1b97b3a8f` |
| `oblivion-remaster-leveling` | OblivionRemasterLikeLeveling 0.5.3 (OpenMW Lua, Nexus Morrowind 56569) | not named in any shipped file | the archive states no licence; granted (Mac handed the archive over 2026-09-17) - **RECORD OPEN** | the ten shipped files: five Lua scripts (1,314 lines), the `.omwaddon` (one GMST), the manifest, two l10n files, the author's README | `systems/oblivionLeveling.js`, `systems/modSettings.js` | `1b97b3a8f` |
| `physical-items` | Physical Items 0.1.29 | demifiend000 | granted (Mac handed the zip over 2026-10-07: "permission has been granted") - **RECORD OPEN** | manifest, settings (63 keys), the assembly and its IL dump | `systems/physicalItems.js`, `scenes/physicalItemsLayer.js`, `systems/modSettings.js` | `1b97b3a8f` |
| `kings-gambit` | The King's Gambit 1 | the bundle names no author | granted (the owner, 2026-10-13: "We also have permission") - **RECORD OPEN** | manifest, the assembly and its IL dump | `net/kingsGambit.js`, `systems/gambit/gambitPatrons.js` | `1b97b3a8f` |
| `heat-haze` | Heat Haze 1.0.1 | demifiend000 | granted (Mac handed the four archives over 2026-10-08: "We have permission to use and implement everything into the codebase") - **RECORD OPEN** | manifest, settings, the assembly, its IL dump, its shader read back as GLSL | `systems/heatHaze.js`, `render/heatHaze.js`, `systems/modSettings.js` | `1b97b3a8f` |
| `ocean-holes` | There's a Hole in the Bottom of the Ocean 1.1.0 | jet082 | granted (Mac handed the archive over 2026-09-25) - **RECORD OPEN** | manifest, settings (7 sliders), the assembly | `world/oceanHoles.js`, `scenes/oceanHolesHost.js`, `scenes/oceanHolesAbyss.js`, `systems/modSettings.js` | `1b97b3a8f` |
| `ambient-text` | Ambient Text 1.8 | Regnier | the bundle states no licence; granted (Mac handed the archive over 2026-09-15: "I now want to implement this as our next mod. 1:1.") - **RECORD OPEN** | manifest, settings (4 sliders), the author's 918-line text table | `systems/ambientText.js`, `systems/ambientTextLines.json` (DFO's own 918 lines), `systems/modSettings.js` | `c2fbbbbfa` |
| `mudex` | MUDEX 1.0.1 (`Ralzar81/MUDEX` @ `6b66655`) | Ralzar | approved (Mac, 2026-10-20: "Approve MUDEX"; the repository states no licence) - **RECORD OPEN** | manifest, two tables (35 monster lines, 89 encounter tables) | `systems/enemyExpansion/dexMeaner.js` (our own rules and courts), `systems/enemyExpansion/dexSwitches.js`, `net/foeBounds.js` | `c2fbbbbfa` |
| `immersive-travel` | Immersive Travel 1.5 | kkgobkk | granted (the owner handed the zip over 2026-10-04: "let this be the next mod we integrate 1:1") - **RECORD OPEN** | manifest, settings (22 keys), the assembly and its IL dump, the author's edit of the four city-gate blocks | `systems/immersiveTravel.js`, `systems/immersiveTravelTables.js`, `world/immersiveTravelGates.js` (our own carriage stand; no gate block is edited), `systems/modSettings.js` | `c2fbbbbfa` |
| `roads-hazelnut` | Basic Roads 1.3.1 (`ajrb/dfunity-mods`, `BasicRoads/`) | Hazelnut | code MIT ("Copyright (C) 2020 Hazelnut", in `LICENSE`); the data no licence text, granted to Mac 2026-09-02 - **RECORD OPEN** | four 500,000-byte path masks (roads, tracks, rivers, streams) | `world/roadsProducer.js`, `world/road/riverNetwork.js`, `world/road/roadNetwork.js` (our own Bay network, the provinces' rule), `world/road/roadPainter.js` (his MIT painter, ported) | `c2fbbbbfa` |
| `beautiful-villages` | Beautiful Villages of Daggerfall 1.4.2 | carademono | granted (Mac handed the archive over 2026-10-01: "We have permission") - **RECORD OPEN** | manifest, one world-data pack (7,317 locations, 209 blocks: the author's edit of MAPS.BSA and BLOCKS.BSA) | `world/townDress.js`, `scenes/townDressHost.js` (every town dressed by our own rules; no town laid out again), `world/townStandIns.js`, `systems/layoutPins.js` | `8d110d8f7` |
| `beautiful-cities` | Beautiful Cities of Daggerfall 0.5.0 | carademono | granted (Mac handed the archive over 2026-10-01: "We have permission") - **RECORD OPEN** | manifest, one world-data pack (410 cities, 611 blocks: the author's edit of MAPS.BSA and BLOCKS.BSA) | `world/townDress.js`, `scenes/townDressHost.js`, `world/townStandIns.js`, `systems/layoutPins.js` | `8d110d8f7` |
| `climates-calories` | Climates & Calories 1.7.1 | Ralzar | "**Permission: the author's, relayed by Mac (2026-09-17) - an overhaul, not a 1:1 port, with the mod's own item art carried.**" | 13 item icons, `derived.json` (4 specs), README | `systems/survival/itemIcons.js`, `systems/survival/survivalArt.js`, `systems/survival/rotPicture.js`, `systems/survival/derivedIcons.json`, `art/ownPainter.js` | `cc44705af` |
| `foraging` | Foraging 1.7 | Harbinger451 | granted (Mac, 2026-09-28: "Yes, permission") - **RECORD OPEN** | 7 textures (11600-11606), the listing, README | `systems/foraging/foragingArt.js`, `systems/foraging/foragingInstall.js` | `cc44705af` |
| `travel-options` | Travel Options 1.11 | Hazelnut | code MIT ("Copyright (C) 2020 Hazelnut"; `PlayerAutoPilot.cs` "Copyright (C) 2019 Jedidia"); the textures carried no licence text - **RECORD OPEN** | 3 interface textures, the listing, README | `ui/travel/travelArt.js`, `ui/travel/travelControlUI.js`, `ui/travel/travelMapWindow.js` | `cc44705af` |
| `roleplay-realism` | Roleplay & Realism 1.8 | Hazelnut | scripts MIT ("Copyright (C) 2020 Hazelnut", "Copyright (C) 2021 Hazelnut"); the pictures carried no licence line - **RECORD OPEN** | 5 keeper sprites, `derived-art.json` (19 specs), the listing, README | `systems/roleplayRealism/rrKeepers.js` (each keeper composed from the player's own townspeople), `systems/roleplayRealism/rrKeeperArt.js`, `systems/roleplayRealism/rrVariants.js`, `systems/roleplayRealism/rrDerivedArt.json` | `cc44705af` |
| `roleplay-realism-items` | Roleplay & Realism: Items 1.3 | Hazelnut and Ralzar | code MIT (every script's header); the sprites carried no licence text - granted (Mac handed the zip over 2026-09-23) - **RECORD OPEN** | 230 sprites, `derived-art.json` (50 specs), the listing of 280 names, README, its tool rriExtract.mjs | `systems/roleplayRealismItems/rriArt.js`, `systems/roleplayRealismItems/rriInstall.js`, `systems/roleplayRealismItems/rriIndex.js` | `cc44705af` |
| `iliac-puddle-no-more` | Iliac Puddle No More 1.2.2 | jet082 | "**Permission: granted (Mac handed the archive over 2026-09-25) - the archive carries no licence text and no readme.**" - **RECORD OPEN** | 7 fish pictures, the listing, README | `systems/deepWater/fishArt.js`, `systems/deepWater/deepWatersFishItems.js`, `scenes/deepWater/deepWatersFish.js` | `cc44705af` |
| `handheld-torches` | Handheld Torches 1.4.1 | RedRoryOTheGlen | granted (Mac: "Next mod to integrate 1:1 is this.") - **RECORD OPEN** | manifest, settings (52 keys), 17 textures, `derived.json` (22 specs), README | `systems/handheldTorchesArt.js`, `systems/handheldTorches.js`, `scenes/droppedTorches.js`, `systems/handheldTorchesDerived.json` | `cc44705af` |
| `windfall` | Windfall 1.0.0 | demifiend000 | granted (Mac, 2026-10-08: "We have permission to use and implement everything into the codebase") - **RECORD OPEN**; the bundle states no licence | manifest, settings (56 keys), `Windfall.dll` and its IL, 2 shaders, 3 pictures, 27 clips, README | `systems/windfall/windfallSynth.js`, `systems/windfall/windfallPictures.js`, `render/windfallSway.js`, `systems/windfallEffects.js`, `scenes/windfallHost.js` | `cc44705af` |
| `better-ambience` | Better Ambience 0.1.4 | Joshua Steinhauer (joshcamas) | MIT ("Copyright (c) 2020 Josh Steinhauer"; the full notice is in `LICENSE`) | manifest, settings (20 keys), 16 C# sources, the LICENSE, 29 WAV clips, README | `systems/betterAmbience.js`, `systems/reverbPresets.js`, `audio/synth/` | `cc44705af` |
| `immersive-footsteps` | Immersive Footsteps 1.01 | Kirk.O | MIT ("Copyright (C) 2024 Kirk.O"; the full notice is in `LICENSE`) - **RECORD OPEN** | manifest, settings (10 keys), 2 C# sources, 210 MP3 clips, README | `systems/immersiveFootsteps.js`, `audio/synth/` | `cc44705af` |
| `dynamic-skies` | Dynamic Skies 2.3.4 | BadLuckBurt and carademono | "**Permission: granted by the authors to Mac (Lattymoy), 2026-09-04.**" - **RECORD OPEN** | manifest, settings (5 keys), 7 sky and 5 fog presets, the light curve, 19 textures, the shader and two include files, README | `systems/dynamicSkies/dynamicSkies.js`, `systems/dynamicSkies/dynamicSkiesRuntime.js`, `systems/dynamicSkies/dynamicSkiesAssets.js`, `render/dynamicSkiesRenderer.js`, `render/dynamicSkiesBridge.js` | `cc44705af` |
| `diverse-weapons` | Diverse Weapons 1.7.3 | RealAKP (the script: "Author: RealAKP & Kirk.O") | the script MIT ("Copyright (C) 2022 Kirk.O"); the sprites carried no licence line - granted (Mac handed the zip over 2026-09-23) - **RECORD OPEN** | the script, manifest, the widget preset, readmes, `derived-art.json` (12 specs), 12,612 sprites under public/art/diverse-weapons/, two tools | `combat/diverseWeapons/diverseWeaponsArt.js`, `combat/diverseWeapons/diverseWeaponsIndex.js`, `combat/diverseWeapons/diverseWeaponsAssets.js`, `combat/diverseWeapons/diverseWeaponsIcons.js` | `cc44705af` |
| `weapon-sheathing` | Weapon Sheathing 1.6 (OpenMW, Nexus Morrowind 46069) | Greatness7; art by akortunov, Greatness7, Heinrich, London Rook, Lord Berandas, Melchior Dahrk, MementoMoritius, Petethegoat, PikachunoTM, Remiros | "Everything included in this mod is free to use for your own Morrowind projects, so long as you give credit to the original authors and do not charge a monetary fee." | 71 scabbard NIFs, 3 skeleton add-ons (one a copy of retail Morrowind's skeleton), the mod's readme, README | `systems/ownSheathing.js`, `systems/weaponSheathing.js`, `systems/weaponSheathingAssets.js`, `formats/morrowind/mwNifWrite.js`, `tools/ownBiped.mjs` | `cc44705af` |
| `shield-widget` | Shield Widget 1.6 (Nexus 733) | RedRoryOTheGlen; frame animation by WilhelmBlack | granted (Mac handed the zip over 2026-09-19) - **RECORD OPEN** | manifest, settings, presets, 600 shield sprites, README | `combat/shieldFaces.js`, `combat/shieldWidgetAssets.js`, `combat/shieldWidget.js` | `cc44705af` |
| `vanilla-enhanced` | Vanilla Enhanced 3.4.7 (Base, Masked Roads, Snowless Swamps and Jungles) | carademono (Masked Roads: carademono and Kokey) | granted (Mac, 2026-10-05: "Approved and yes"); the repository states no licence - **RECORD OPEN** | 3 manifests, 3 listings, the door index, README; 1,436 repainted textures under public/art/vanilla-enhanced/; its vendoring tool | `systems/ownTextures/ownTextureRules.js` (1,238 of the Base's 1,246 names; the 8 left are rock textures for meshes the port never draws), `systems/ownTextures/ownTexturePacks.js`, `systems/vanillaEnhanced/vanillaEnhancedPack.js`, `systems/vanillaEnhanced/vanillaEnhancedDecodeWorker.js` | `cc44705af` |
| `sands-of-the-alikr` | Sands of the Alik'r 2 (Nexus 1390) | unknown (the archive names none) | granted (Mac, 2026-10-08: "We have permission to use and implement everything into the codebase") - **RECORD OPEN** | the listing, the index, README; 47 repainted TEXTURE.002 records under public/art/sands-of-the-alikr/ | `systems/ownTextures/ownTextureRules.js` (`desert`), `systems/vanillaEnhanced/vanillaEnhancedPack.js` | `cc44705af` |
| `snowfall` | Snowfall 1.0.5 (Nexus 1401) | demifiend000 | granted (Mac, 2026-10-08, as above) - **RECORD OPEN** | manifest, settings, `DynamicSnow.dll` and its IL, the shader, Basic Roads' MIT notice, the listing, the index; 168 repainted winter records, the snow albedo and 3 masks under public/art/snowfall/ | `systems/snowfall.js`, `systems/snowfallRuntime.js`, `render/snowfallGlsl.js`, `render/snowfallSurface.js`, `scenes/snowfallHost.js`, `systems/ownTextures/ownTextureRules.js` (`snow`) | `cc44705af` |
| `class-skins` | Daggerfall class skins (Mac's `ExistingClasses.rar`, no version) | not named for the pack (one folder: "KAMER - Bounty Hunter") | granted (Mac handed the archive over 2026-09-25) - **RECORD OPEN**; carried under Port-Doctrine's fourth exception | 1,683 repainted class sprites in 20 sheets, `skins.json`, the listing, README, its tool classSkinsListing.mjs | `player/classSkins.js`, `player/classSkinArt.js`, `player/eyeOfTheBeholder/eotbSprite.js` | `cc44705af` |
| `eye-of-the-beholder` | Eye Of The Beholder 2.1 | RedRoryOTheGlen | granted (Mac handed the archive over 2026-09-15) - **RECORD OPEN** | manifest, settings, presets, states, `spriteInfo.json`, `derived.json` (2,869 specs), 166 death sprites, the DLL and its IL, README, its tool eotbIl.mjs | `player/eyeOfTheBeholder/eotbSprite.js`, `player/eyeOfTheBeholder/eotbDeath.js`, `player/eyeOfTheBeholder/eotbDerived.json`, `player/eyeOfTheBeholder/eotbAnchor.js` and `eotbAnchors.json` (our measured offsets), `player/eyeOfTheBeholder/eotbBillboard.js` | `cc44705af` |
| `horse-cart-and-cargo` | Horse Cart and Cargo 1.0.0-rc12 (Nexus 1374) | demifiend000 | granted (Mac handed the bundle over 2026-09-23) - **RECORD OPEN** | manifest, settings, the text table, two DLLs and their IL, 45 horse pictures, README, its tool hccAssets.mjs | `systems/horse/horseArt.js`, `systems/horse/horseCart.js`, `systems/horse/horseCartLaw.js`, `scenes/horseCartPool.js` | `cc44705af` |
| `come-sail-away` | Come Sail Away 2.1 (Nexus 1131) | RedRoryOTheGlen | "**Permission: granted (Mac handed the archive over 2026-09-26) - the archive carries no licence text and no readme.**" - **RECORD OPEN** | manifest, settings, item templates, the DLL, 12 boats as prefabs and meshes, 27 pictures, `derived.json` (32 specs), 5 clips, README, the extractor and three of its libraries | `world/ships/ownBoats/`, `systems/comeSailAway/csaPictures.js`, `systems/comeSailAway/csaSynth/`, `systems/comeSailAway/comeSailAwayModels.js`, `systems/comeSailAway/comeSailAwayItems.js` | `cc44705af` |
| `vorbis-fsb-setups` | two Vorbis setup headers for FSB5 (vgmstream's table, ISC-style; libvorbis's encoder output, BSD-3-Clause) | vgmstream and Xiph.org | the two licences, carried with the files | the two headers and their licences | none: only Come Sail Away's clips needed them, and they are ours now | `cc44705af` |

The MIT rows keep their notice because our code restates theirs closely: `unleveledLoot.js` method by method,
`meanerMonsters.js` the mod's 24-row table value for value, `worldTooltips.js` the mod's tables word for word,
`immersiveFootsteps.js` and `betterAmbience.js` their scripts' laws. `LICENSE` carries each notice in full.

## How a folder is retired

1. Write its facts into the table above: the release, its author, its licence or permission, what the tree carried,
   our code that is now the record, and the commit whose tree still holds the files.
2. `git rm` the folder and its registry row (`Mod-Registry.md`).
3. A test that compared our values with a vendored file keeps its pin as a literal table, so a changed default still
   fails it. An assertion about the vendored file's own text goes.
4. A comment that cited a path in the folder cites the upstream release by name, with no tree path.
5. The feature's page says how it works now, with our code as the record.
6. No credit is written (Port-Doctrine, CREDITS-OUT). An MIT notice our code still owes stays in `LICENSE`.

`test/systems/hard4_registry.test.js` lets a player's switch name a retired key, and `test/systems/credits.test.js`
holds every retired key to no folder.
