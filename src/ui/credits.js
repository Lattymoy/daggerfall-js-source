// ═══════════════════════════════════════════════════════════════════
// CREDITS - who made what the port carries (CR1, Mac's call 2026-08-30:
// "as we integrate these I really want to give credit to the mod
// developer who created it").
//
// ONE TABLE, ON THE SCREEN. Every third-party work in the tree has a
// row here, and the About pane renders the rows; a README in vendor/
// credits the author to whoever reads the repo, and this credits them
// to whoever plays the game, which is the audience that matters to a
// modder. test/credits.test.js sweeps vendor/ against this list both
// ways, so a work cannot be vendored without a row and a row cannot
// name a folder that is gone.
//
// Two kinds of row, kept apart on the screen because they are owed
// differently:
//   - BUILT ON: the game itself and the source the port is a 1:1 of.
//   - MODS: a modder's own work, carried with the author's permission
//     (never without - the roads were removed whole for exactly that).
//     `vendor` names the folder whose README records the permission.
//
// No URLs are invented: a contact is what the author's own manifest
// says it is.
// ═══════════════════════════════════════════════════════════════════

export const CREDITS = Object.freeze({
  builtOn: Object.freeze([
    Object.freeze({
      title: 'The Elder Scrolls II: Daggerfall',
      author: 'Bethesda Softworks',
      what: 'The game. Every byte of art, sound, text and world data comes from the ARENA2 folder the player supplies; none ships with the port.',
    }),
    Object.freeze({
      title: 'Daggerfall Unity',
      author: 'Gavin Clayton (Interkarma) and contributors',
      what: 'The source this port is a 1:1 translation of. Its quest scripts, book index and settings tables are vendored verbatim (MIT License).',
      vendor: Object.freeze(['dfu-quests', 'dfu-books', 'dfu-settings']),
      link: 'https://github.com/Interkarma/daggerfall-unity',
    }),
    Object.freeze({
      title: 'Silkscreen',
      version: '1.001',
      author: 'The Silkscreen Project Authors',
      what: 'One glyph: the digit five of the enhanced skin\'s numbers. Pixelify Sans draws its 5 with a cut corner that reads as an 8, so the five is Silkscreen\'s, subset to that code point and carried inline (FIX-D).',
      terms: 'SIL Open Font License 1.1 (the OFL travels with the glyph in vendor/silkscreen-five/).',
      vendor: Object.freeze(['silkscreen-five']),
      link: 'https://github.com/googlefonts/silkscreen',
    }),
    Object.freeze({
      title: 'Project Raum',
      author: 'Mac (Lattymoy)',
      what: 'The book a Daggerfall book is read in under the enhanced skin (EB1): project-raum\'s physical journal - the leather cover that flips open, the two-page spreads, the leaves that turn as a cloth fold about the spine, the fore-edge stack and the slide up from below the screen - and its torn, stained paper. The words on its pages are Daggerfall\'s, in Daggerfall\'s own faces.',
      terms: 'The author\'s own work, vendored from his repository (2026-09-12); see vendor/raum-book/README.md.',
      vendor: Object.freeze(['raum-book']),
      link: 'https://github.com/Lattymoy/project-raum',
    }),
  ]),
  mods: Object.freeze([
    Object.freeze({
      title: 'Meaner Monsters',
      version: '1.5.2',
      author: 'Ralzar',
      what: 'Twenty monsters made meaner: their damage, health, level and armour rewritten (rats, bats and zombies gentler), werewolves and wereboars drawn a fifth larger, the dragonling two and a half times its size with a corpse to match. Ported 1:1 from the shipped 1.5.2 (characters/meanerMonsters.js); both lanes, under its own switch on the Features page. With the combat overhaul on, Kirk.O\u2019s edit of these numbers takes over, as in Daggerfall Unity.',
      terms: 'Carried under its MIT License - the permission the source header grants (Copyright (C) 2020 Ralzar; Author: Hazelnut & Ralzar); see vendor/meanerMonsters/README.md.',
      contact: 'forums.dfworkshop.com (the manifest\u2019s ContactInfo)',
      vendor: Object.freeze(['meanerMonsters']),
      link: 'https://github.com/Ralzar81/Meaner-Monsters',
    }),
    Object.freeze({
      title: 'Unleveled Loot',
      version: '1.1.2',
      author: 'Ralzar',
      what: 'Loot and shop stock that do not scale to your level: weapon and armour materials roll by your luck, the shop\u2019s quality and the dungeon\u2019s kind; a corpse\u2019s gold is divided by your level and multiplied by your luck; Daedra and Orcs may drop their own metal; any material can stand in for another. Ported 1:1 from the shipped 1.1.2 (systems/unleveledLoot.js); both lanes, under its own tile on the Features page.',
      terms: 'Carried under its MIT License - the permission the source header grants (Copyright (C) 2020 Ralzar); see vendor/unleveledLoot/README.md.',
      contact: 'Ralzar, through the Nexus page the manifest names as its ContactInfo (daggerfallunity mod 135)',
      vendor: Object.freeze(['unleveledLoot']),
      link: 'https://github.com/Ralzar81/Unleveled-Loot',
    }),
    Object.freeze({
      title: 'Physical Combat And Armor Overhaul',
      version: '1.44',
      author: 'Kirk.O',
      what: 'The combat overhaul: armour reduces the damage you take instead of your chance to be hit, skills and stats decide the hit, weapons and armour wear by their kind and material (his Believable Equipment Characteristics And Durability, built in), shields block by their material and your stats, critical strikes multiply damage, monsters have their own hides, and his edit of Ralzar\u2019s Meaner Monsters and Roleplay Realism\u2019s archery follow those mods\u2019 own switches. Ported 1:1 from the shipped 1.44 (combat/pcaao.js); both lanes, under its own tile on the Features page.',
      terms: 'Ported from the shipped .dfmod and the public source (github.com/magicono43/DFU-Mod_Physical-Combat-And-Armor-Overhaul, no licence stated); see vendor/pcaao/README.md for the permission.',
      contact: 'kirkoliveri@gmail.com (the manifest\u2019s ContactInfo)',
      vendor: Object.freeze(['pcaao']),
      link: 'https://github.com/magicono43/DFU-Mod_Physical-Combat-And-Armor-Overhaul',
    }),
    Object.freeze({
      title: 'Weapon Widget',
      version: '1.6',
      author: 'RedRoryOTheGlen',
      what: 'The first-person weapon sprite handled anew (WW1): swings that wind up from the idle pose and recover, the sprite in the hand you swing with, a sheathe that slides it off the screen, a walking bob, look inertia, stepped movement, double-size idle textures off the mod\u2019s own bundle, and a recoil on a hit, a parry or a miss - the same channels moving the Morrowind arms.',
      terms: 'Ported 1:1 from the shipped bundle, read off its compiled script method by method; see vendor/weapon-widget/README.md for the permission record.',
      contact: 'RedRoryOTheGlen, through the Nexus page (daggerfallunity mod 860)',
      vendor: Object.freeze(['weapon-widget']),
      link: 'https://www.nexusmods.com/daggerfallunity/mods/860',
    }),
    Object.freeze({
      title: 'Weapon Sheathing',
      version: '1.6',
      author: 'Greatness7',
      what: 'A sheathed Morrowind weapon stays on the body, on the hip or the back, in its own scabbard, with a quiver for a bow (WS1): the seventy-one scabbard meshes and three skeleton addons vendored, the OpenMW mechanism ported for the port\u2019s third-person body. The scabbards are by akortunov, Greatness7, Heinrich, London Rook, Lord Berandas, Melchior Dahrk, MementoMoritius, Petethegoat, PikachunoTM and Remiros, as the shipped readme credits them.',
      terms: 'The mod\u2019s own permission: free to use with credit and no fee; see vendor/weapon-sheathing/README.md and WeaponSheathing.txt.',
      contact: 'Greatness7, through the Nexus page (morrowind mod 46069)',
      vendor: Object.freeze(['weapon-sheathing']),
      link: 'https://www.nexusmods.com/morrowind/mods/46069',
    }),
    Object.freeze({
      title: 'Handheld Torches',
      version: '1.4.1',
      author: 'RedRoryOTheGlen',
      what: 'A lit light needs a free hand (HT1): drawing a weapon that takes both stows or drops the torch, and a hand freed lights it again; keys to ignite or douse, to drop, and to throw a torch that can set a foe alight; a first-person hand holding the light with the widget\u2019s bob, inertia and steps; dropped torches burn on the ground, light the room and can be picked up - and survive a save.',
      terms: 'Ported 1:1 from the shipped bundle, read off its compiled script method by method; the mod\u2019s own textures vendored - see vendor/handheld-torches/README.md for the permission record.',
      contact: 'RedRoryOTheGlen, through the Nexus page (daggerfallunity mod 780)',
      vendor: Object.freeze(['handheld-torches']),
      link: 'https://www.nexusmods.com/daggerfallunity/mods/780',
    }),
    Object.freeze({
      title: 'Windmills of Daggerfall',
      version: '2.0',
      author: 'Kamer',
      what: 'The windmill: the tower and its sails, the machinery inside with its turning gear and roller, the seventeen climate and season skins, and the seven farms he chose to stand them on. Enhanced skin only; the classic lane sees Daggerfall\'s own farms.',
      terms: 'Vendored with the author\'s permission (2026-08-29).',
      contact: 'DFU Discord',
      vendor: Object.freeze(['windmills-kamer']),
    }),
    Object.freeze({
      title: 'Basic Roads',
      version: '1.3.1',
      author: 'Hazelnut',
      what: 'The roads and tracks of the Iliac Bay: the hand-drawn network of which pixels carry a road or a track and which way each leaves, and the painter that lays them into the terrain. Both skins; the map draws them too.',
      terms: 'Vendored with the author\'s permission (2026-09-02). The painter is MIT (Copyright (C) 2020 Hazelnut).',
      contact: 'DFU forums',
      vendor: Object.freeze(['roads-hazelnut']),
      link: 'https://github.com/ajrb/dfunity-mods',
    }),
    Object.freeze({
      title: 'Dynamic Skies',
      version: '2.3.4',
      author: 'BadLuckBurt and carademono',
      what: 'The sky under the enhanced environments: a procedural skybox (built on Feral Pug\'s extension of Unity\'s procedural sky) with its sun and atmosphere, two textured cloud layers per weather, twinkling stars, Masser and Secunda on their orbits and DFU\'s phases, its own fog colours and distances, a longer sunrise and sunset, a lightning flash under thunder, and pixel snow. Carried 1:1 - the shader, the presets and the textures are the mod\'s own. The classic lane keeps Daggerfall\'s painted sky.',
      terms: 'Vendored with the authors\' permission (2026-09-04); see vendor/dynamic-skies/README.md.',
      contact: "Lysandus' Tomb Discord server",
      vendor: Object.freeze(['dynamic-skies']),
      link: 'https://github.com/drcarademono/dynamic-skies',
    }),
    Object.freeze({
      title: 'Seasons of the Iliac Bay',
      version: '1.1',
      author: 'RosyTheRascal',
      what: 'The turning of the year on the woodland, hills, haunted and mountain flats: autumn, spring and winter repaints of the trees, rocks and plants, drawn at the mod\'s own size. The mod\'s script (its seasons, archives and checks) is ported; its textures are read from your own copy of the mod at play time and are not in this repository.',
      terms: 'Ported with the author\'s permission (2026-09-05); see vendor/seasons-iliac-bay/README.md.',
      contact: "Lysandus' Tomb Discord server",
      vendor: Object.freeze(['seasons-iliac-bay']),
    }),
    Object.freeze({
      title: 'Ambient Text',
      version: '1.8',
      author: 'Regnier',
      what: 'An unobtrusive line about where you are, now and then (AT1): 918 of the author\u2019s own, keyed to the kind of place you stand in, the kind of dungeon you are under, the hour and the weather. It reads the location rect, the climate and the sky, says nothing indoors, and goes quiet for longer after it has spoken.',
      terms: 'Ported 1:1 from the shipped bundle, read off its compiled script method by method; the mod\u2019s own text table vendored - see vendor/ambient-text/README.md for the permission record.',
      contact: 'forums.dfworkshop.net',
      vendor: Object.freeze(['ambient-text']),
    }),
    Object.freeze({
      title: 'Eye Of The Beholder',
      version: '2.1',
      author: 'RedRoryOTheGlen',
      what: 'Third person for a player with no Morrowind data (EOTB): the camera swings out behind your shoulder on the wheel, clears walls on its own, and you are drawn as the mod\u2019s own sprite - eight ways round, with its idle, walk, attack and spell states on foot and in the saddle.',
      terms: 'The camera and the player sprite ported from the shipped bundle, read off its compiled script method by method - its attack and death animations, footsteps and cart are NOT ported; the mod\u2019s own 3035 sprites vendored, re-encoded as indexed PNG and lossless for every drawn pixel - see vendor/eye-of-the-beholder/README.md for the permission record and the measurement.',
      contact: 'rmufrancisco@gmail.com',
      vendor: Object.freeze(['eye-of-the-beholder']),
    }),
    Object.freeze({
      title: 'Immersive Footsteps',
      version: '1.01',
      author: 'Kirk.O',
      what: 'Footsteps that sound like the ground (IF1): grass, gravel, sand, mud and snow by climate and tile outdoors, path stone and shallow or deep water, a building\u2019s tile, stone or wood floor read off its own textures, a dungeon\u2019s water, and boots of leather, chain or plate on stone; armour that sways as you walk, by what you wear; and the mod\u2019s own landing and splash sounds. Two clip qualities.',
      terms: 'Ported 1:1 from the author\u2019s own MIT sources (the two C# scripts the shipped bundle was built from, vendored); the mod\u2019s 210 sound clips vendored as the author ships them - see vendor/immersive-footsteps/README.md for the permission record.',
      contact: 'forums.dfworkshop.net',
      vendor: Object.freeze(['immersive-footsteps']),
    }),
    Object.freeze({
      title: 'Better Ambience',
      version: '0.1.4',
      author: 'Joshua Steinhauer',
      what: 'The camera shakes when you are hurt, by how much of you the blow took (BA1); a dungeon gets its own fog colour and its own light, rolled from its name, and a stone reverb over every sound; rain is heard indoors, muffled, and at a dungeon\u2019s door; and its own footsteps with an armour clank, kept off beside Immersive Footsteps as that mod\u2019s author asks.',
      terms: 'Ported 1:1 from the sixteen sources the shipped bundle carries, under the author\u2019s MIT licence; the 29 clips the mod asks for vendored from the author\u2019s repository - see vendor/better-ambience/README.md for the permission record. The rain and snow particle tweaks have no twin: the port\u2019s precipitation is its own.',
      contact: 'forums.dfworkshop.net',
      vendor: Object.freeze(['better-ambience']),
    }),
    Object.freeze({
      title: 'Oblivion Remaster Like Leveling',
      version: '0.5.3',
      // THE ONE ROW ON THIS SCREEN WHOSE AUTHOR IS NOT KNOWN. Nothing
      // in the shipped archive names them - no licence file, no script
      // header, an empty author field in the `.omwaddon` - so the
      // screen says so and names the page the mod comes from, rather
      // than crediting a guess. The record is open in
      // vendor/oblivion-remaster-leveling/README.md and in the
      // registry row, and it is filled in the moment Mac has the name.
      author: 'Unnamed (Nexus Morrowind 56569)',
      what: 'An alternative way to level, offered when you make a character (ORL1): every skill you raise fills a hundred-point bar instead of Daggerfall\u2019s skill sum - your primaries and majors fastest, your minors next, everything else slowest - with whatever spills over carried into the next level; and levelling up hands you a purse of virtues to spend across a few of your attributes, with Luck priced higher — how many, across how many, and what Luck costs are all yours to set on the mod’s own tile. The first MORROWIND mod in the port: it is an OpenMW Lua mod, ported 1:1 from the author\u2019s own source (systems/oblivionLeveling.js), in both lanes.',
      terms: 'Carried by the author\u2019s permission, on Mac\u2019s word - the archive states no licence and names no author. Ported 1:1 from the shipped Lua, which is vendored whole; see vendor/oblivion-remaster-leveling/README.md for the open permission record.',
      vendor: Object.freeze(['oblivion-remaster-leveling']),
    }),
  ]),
});
