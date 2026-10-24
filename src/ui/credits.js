// ═══════════════════════════════════════════════════════════════════
// CREDITS - who made what the port carries (CR1, Mac's call 2026-08-30:
// "as we integrate these I really want to give credit to the mod
// developer who created it").
//
// ONE TABLE, ON THE SCREEN. Every third-party work in the tree has a
// row here, and the About pane renders the rows; a README in vendor/
// credits the author to whoever reads the repo, and this credits them
// to whoever plays the game, which is the audience that matters to a
// modder. test/systems/credits.test.js sweeps vendor/ against this list both
// ways, so a work cannot be vendored without a row and a row cannot
// name a folder that is gone.
//
// Two kinds of row, kept apart on the screen because they are owed
// differently:
//   - BUILT ON: the game itself and the source the game began as a 1:1 port of (SCOPE1: now its reference).
//   - MODS: a modder's own work, carried with the author's permission
//     (never without - the roads were removed whole for exactly that).
//     `vendor` names the folder whose README records the permission.
//
// No URLs are invented: a contact is what the author's own manifest
// says it is.
//
// L10N4: the sentences are the player's language - what a work is, the
// terms it is carried under, and the words around a name ("and
// contributors", "through the Nexus page") - each a getter over t(), so
// the About pane reads them as it draws, never English frozen at load.
// The names stay as they are: a work's title, its author, its version,
// its link, its folder.
//
// L10N6: the translations are credited as the works are, one row a
// language (translationCredits, below the table).
// ═══════════════════════════════════════════════════════════════════

import { t, availableLocales, intlLocale, BASE_LOCALE, PSEUDO_LOCALE } from '../systems/textManager.js';

export const CREDITS = Object.freeze({
  builtOn: Object.freeze([
    Object.freeze({
      title: 'The Elder Scrolls II: Daggerfall',
      author: 'Bethesda Softworks',
      get what() { return t('credits.daggerfall.what', 'The original game. All of its art, sound, text and world data are read from your own copy\u2019s ARENA2 folder. None of it is included here.'); },
    }),
    Object.freeze({
      title: 'Daggerfall Unity',
      get author() { return t('credits.author.andContributors', '{name} and contributors', { name: 'Gavin Clayton (Interkarma)' }); },
      get what() { return t('credits.dfu.what', 'This game began as a rewrite of Daggerfall Unity and still uses it as its reference. Its quest scripts, book index, settings tables, game text table, interaction-mode icons and mouse cursor are included unchanged (MIT License).'); },
      vendor: Object.freeze(['dfu-quests', 'dfu-books', 'dfu-settings', 'dfu-text', 'dfu-icons', 'dfu-cursor']),
      link: 'https://github.com/Interkarma/daggerfall-unity',
    }),
    Object.freeze({
      title: 'Silkscreen',
      version: '1.001',
      get author() { return t('credits.author.projectAuthors', 'The {project} Project Authors', { project: 'Silkscreen' }); },
      get what() { return t('credits.silkscreen.what', 'The digit 5 in the Enhanced skin\u2019s numbers. Pixelify Sans\u2019s 5 looks like an 8, so this one digit comes from Silkscreen.'); },
      get terms() { return t('credits.silkscreen.terms', 'SIL Open Font License 1.1. The license is included with the glyph.'); },
      vendor: Object.freeze(['silkscreen-five']),
      link: 'https://github.com/googlefonts/silkscreen',
    }),
    Object.freeze({
      get title() { return t('credits.pixelifyGlyphs.title', 'The 2 and the Z'); },
      author: 'DFO',
      get what() { return t('credits.pixelifyGlyphs.what', 'Two glyphs drawn for the enhanced skin on Pixelify Sans\'s own grid: a 2 and a Z that can no longer be taken for each other.'); },
      get terms() { return t('credits.pixelifyGlyphs.terms', 'The game\'s own work (vendor/pixelify-glyphs/, built by tools/pixelifyGlyphs.py).'); },
      vendor: Object.freeze(['pixelify-glyphs']),
    }),
    Object.freeze({
      get title() { return t('credits.layeredArmor.title', 'Layered Gearing'); },
      author: 'DFO',
      get what() { return t('credits.layeredArmor.what', 'The art of the Layered Gearing look: every helmet, chest and leg armor in leather, chain and plate of seven metals, and the cloaks and hoods, for both bodies, made for the game from Daggerfall\'s own class and enemy sprites.'); },
      get terms() { return t('credits.layeredArmor.terms', 'Made for DFO and carried under the owner\'s exception for art drawn from Daggerfall\'s own (vendor/layered-armor/README.md).'); },
      vendor: Object.freeze(['layered-armor']),
    }),
    Object.freeze({
      title: 'Project Raum',
      author: 'Mac (Lattymoy)',
      get what() { return t('credits.raum.what', 'The book you read Daggerfall\u2019s books in on the Enhanced skin: project-raum\u2019s leather journal, with a cover that opens, two-page spreads, pages that turn, and torn, stained paper. The text is Daggerfall\u2019s own, in its own fonts.'); },
      get terms() { return t('credits.raum.terms', 'The author\u2019s own work, from his repository.'); },
      vendor: Object.freeze(['raum-book']),
      link: 'https://github.com/Lattymoy/project-raum',
    }),
    Object.freeze({
      get title() { return t('credits.vorbis.title', 'Vorbis setup headers for FSB5'); },
      // CSA-A: two codebook headers FMOD strips from a Unity audio clip, needed to turn Come Sail Away's sounds back into Ogg files
      get author() { return t('credits.vorbis.author', 'The {project} authors, and the {foundation} ({library})', { project: 'vgmstream', foundation: 'Xiph.org Foundation', library: 'libvorbis' }); },
      get what() { return t('credits.vorbis.what', 'Two Vorbis setup headers that Unity audio clips leave out. With them, Come Sail Away\u2019s 5 sounds play exactly as the author made them.'); },
      get terms() { return t('credits.vorbis.terms', 'From vgmstream\u2019s table (ISC-style license) and libvorbis\u2019s encoder output (BSD-3-Clause, Xiph.org). Both licenses are included with the files.'); },
      vendor: Object.freeze(['vorbis-fsb-setups']),
      link: 'https://github.com/vgmstream/vgmstream',
    }),
    Object.freeze({
      get title() { return t('credits.classSkins.title', 'Daggerfall class skins'); },
      // SKIN2: an art pack, not a mod (no switch, so no Features row) - Mac's ExistingClasses archive. It names no author for the pack (one folder
      // names Kamer, for the bounty hunter), so the screen says so rather than crediting a guess; the record is open in
      // vendor/class-skins/README.md and the registry row.
      get author() { return t('credits.author.unnamed', 'Unnamed ({source})', { source: 'ExistingClasses' }); },
      get what() { return t('credits.classSkins.what', 'Daggerfall\u2019s classes as looks for your character in third person: acrobat, assassin, burglar, bounty hunter, dark acolyte, Dark Brotherhood, healer, monk, nightblade, pirate and sorcerer, most in both sexes, plus the original adventurer, in 20 redrawn sprite sheets. Pick one on your profile\u2019s Skin card.'); },
      get terms() { return t('credits.classSkins.terms', 'Used with the artists\u2019 permission, on Mac\u2019s word. The archive states no license. Its 1,683 pictures are included unchanged.'); },
      vendor: Object.freeze(['class-skins']),
    }),
  ]),
  mods: Object.freeze([
    Object.freeze({
      title: 'Meaner Monsters',
      version: '1.5.2',
      author: 'Ralzar',
      get what() { return t('credits.meanerMonsters.what', 'Twenty monsters made tougher, with new damage, health, level and armor. Rats, bats and zombies are gentler. Werewolves and wereboars are a fifth larger, and the dragonling is two and a half times its size. Based on version 1.5.2. With the combat overhaul on, Kirk.O\u2019s version of these numbers is used instead.'); },
      get terms() { return t('credits.meanerMonsters.terms', 'Used with permission under its MIT License (Copyright (C) 2020 Ralzar; Author: Hazelnut & Ralzar).'); },
      get contact() { return t('credits.contact.manifest', '{contact}', { contact: 'forums.dfworkshop.com' }); },
      vendor: Object.freeze(['meanerMonsters']),
      link: 'https://github.com/Ralzar81/Meaner-Monsters',
    }),
    Object.freeze({
      title: 'Unleveled Loot',
      version: '1.1.2',
      author: 'Ralzar',
      get what() { return t('credits.unleveledLoot.what', 'Loot and shop stock no longer scale with your level. Weapon and armor materials depend on your luck, the shop\u2019s quality and the kind of dungeon. Gold on bodies is divided by your level and multiplied by your luck. Daedra and Orcs can drop their own metals, and any material can stand in for another.'); },
      get terms() { return t('credits.unleveledLoot.terms', 'Used with permission under its MIT License (Copyright (C) 2020 Ralzar).'); },
      get contact() { return t('credits.unleveledLoot.contact', '{author}, through the Nexus page ({page})', { author: 'Ralzar', page: 'daggerfallunity mod 135' }); },
      vendor: Object.freeze(['unleveledLoot']),
      link: 'https://github.com/Ralzar81/Unleveled-Loot',
    }),
    Object.freeze({
      title: 'Physical Combat And Armor Overhaul',
      version: '1.44',
      author: 'Kirk.O',
      get what() { return t('credits.pcaao.what', 'The combat overhaul. Armor reduces the damage you take instead of your chance to be hit, and your skills and stats decide whether you hit. Weapons and armor wear by their kind and material, using his Believable Equipment Characteristics And Durability. Shields block by their material and your stats, critical hits multiply damage, and monsters have their own hides. His versions of Ralzar\u2019s Meaner Monsters and of Roleplay & Realism\u2019s archery apply when those mods are on.'); },
      get terms() { return t('credits.pcaao.terms', 'Used with the author\u2019s permission. Based on the released mod and its public source, which states no license.'); },
      get contact() { return t('credits.contact.manifest', '{contact}', { contact: 'kirkoliveri@gmail.com' }); },
      vendor: Object.freeze(['pcaao']),
      link: 'https://github.com/magicono43/DFU-Mod_Physical-Combat-And-Armor-Overhaul',
    }),
    Object.freeze({
      title: 'Weapon Widget',
      version: '1.6',
      author: 'RedRoryOTheGlen',
      get what() { return t('credits.weaponWidget.what', 'Reworks the first-person weapon. Swings wind up from the idle pose and recover, the weapon shows in the hand you swing with, and sheathing slides it off the screen. Adds a walking bob, look inertia, stepped movement, double-size idle sprites from the mod, and recoil when you hit, parry or miss. The Morrowind arms move the same way.'); },
      get terms() { return t('credits.weaponWidget.terms', 'Used with the author\u2019s permission.'); },
      get contact() { return t('credits.contact.nexus', '{author}, through the Nexus page ({page})', { author: 'RedRoryOTheGlen', page: 'daggerfallunity mod 860' }); },
      vendor: Object.freeze(['weapon-widget']),
      link: 'https://www.nexusmods.com/daggerfallunity/mods/860',
    }),
    Object.freeze({
      title: 'Diverse Weapons',
      version: '1.7.3',
      author: 'RealAKP',
      get what() { return t('credits.diverseWeapons.what', 'First-person sprites for 18 weapons in every metal, plain and enchanted, where the original game has one sprite per weapon class. Includes double-size idle sprites for Weapon Widget and matching inventory icons.'); },
      get terms() { return t('credits.diverseWeapons.terms', 'Used with the author\u2019s permission. The script is under the MIT License, and the sprites are the author\u2019s own paintings.'); },
      get contact() { return t('credits.contact.nexus', '{author}, through the Nexus page ({page})', { author: 'RealAKP', page: 'daggerfallunity mod 242' }); },
      vendor: Object.freeze(['diverse-weapons']),
      link: 'https://www.nexusmods.com/daggerfallunity/mods/242',
    }),
    Object.freeze({
      title: 'GrimoireUI',
      version: '1.2',
      author: 'LordSquacquerone',
      get what() { return t('credits.grimoireUi.what', 'Daggerfall\u2019s screens redrawn at three times the detail, with parchment and wood instead of stone, a spellbook that looks like a book, and new lettering in two fonts. Choose it under Overhauls, on the UI Overhaul card.'); },
      get terms() { return t('credits.grimoireUi.terms', 'Used with the author\u2019s permission. The pictures and fonts are the author\u2019s own art, included unchanged.'); },
      get contact() { return t('credits.contact.nexus', '{author}, through the Nexus page ({page})', { author: 'LordSquacquerone', page: 'daggerfallunity mod 1222' }); },
      vendor: Object.freeze(['grimoire-ui']),
      link: 'https://www.nexusmods.com/daggerfallunity/mods/1222',
    }),
    Object.freeze({
      title: 'Roleplay & Realism: Items',
      version: '1.3',
      author: 'Hazelnut & Ralzar',
      get what() { return t('credits.rrItems.what', 'Two new weapons, the Archer\u2019s Axe and the Light Flail, and a light and a medium armor set in every metal, with their own inventory and paper-doll art. Also changes what items weigh and cost, and adds its loot tables, enemy gear, starting kits and shop stock.'); },
      get terms() { return t('credits.rrItems.terms', 'Used with the authors\u2019 permission under the MIT License. The 280 sprites are the authors\u2019 own art.'); },
      get contact() { return t('credits.contact.forumsOrNexus', '{author}, through the DFU forums ({forums}) or the Nexus page ({page})', { author: 'Hazelnut', forums: 'forums.dfworkshop.net', page: 'daggerfallunity mod 61' }); },
      vendor: Object.freeze(['roleplay-realism-items']),
      link: 'https://www.nexusmods.com/daggerfallunity/mods/61',
    }),
    Object.freeze({
      title: 'Roleplay & Realism',
      version: '1.8',
      author: 'Hazelnut',
      get what() { return t('credits.rr.what', 'The mod\u2019s rule changes: bows hit harder the longer you draw them, no climbing with a weapon out, swing speed from both speed and strength, smaller to-hit bonuses from materials, armor that wears from blows, the classic strength bonus, bank loans by level, ships boarded only from port towns, an encumbrance penalty, lights put out when you leave a dungeon by day, a purification potion that cures poison, varied looks for human enemies by class, expulsion from the Thieves Guild and Dark Brotherhood for poor work, hand-to-hand training at the Fighters Guild, and beds you can click to sleep in. Also its NPC variants, enhanced riding, refined training and the Master Armorer quests.'); },
      get terms() { return t('credits.rr.terms', 'Used with the author\u2019s permission under the MIT License.'); },
      get contact() { return t('credits.contact.forumsOrNexus', '{author}, through the DFU forums ({forums}) or the Nexus page ({page})', { author: 'Hazelnut', forums: 'forums.dfworkshop.net', page: 'daggerfallunity mod 16' }); },
      vendor: Object.freeze(['roleplay-realism']),
      link: 'https://www.nexusmods.com/daggerfallunity/mods/16',
    }),
    Object.freeze({
      title: 'Shield Widget',
      version: '1.6',
      author: 'RedRoryOTheGlen',
      get what() { return t('credits.shieldWidget.what', 'Shows your shield in first person, which the original game never did. It is drawn in its own metal and looks more battered as its condition drops. It slides away when you sheathe, swing or cast, bobs as you walk, raises and lowers, and rocks when a blow lands on it.'); },
      get terms() { return t('credits.shieldWidget.terms', 'Used with the author\u2019s permission, with the mod\u2019s own 600 sprites.'); },
      get contact() { return t('credits.contact.nexus', '{author}, through the Nexus page ({page})', { author: 'RedRoryOTheGlen', page: 'daggerfallunity mod 733' }); },
      vendor: Object.freeze(['shield-widget']),
      link: 'https://www.nexusmods.com/daggerfallunity/mods/733',
    }),
    Object.freeze({
      title: 'Weapon Sheathing',
      version: '1.6',
      author: 'Greatness7',
      get what() { return t('credits.weaponSheathing.what', 'Sheathed Morrowind weapons stay on your body, at the hip or on the back in their own scabbards, with a quiver for a bow. Its 71 scabbard models and 3 skeleton add-ons are included and work as they do in OpenMW. The scabbards are by akortunov, Greatness7, Heinrich, London Rook, Lord Berandas, Melchior Dahrk, MementoMoritius, Petethegoat, PikachunoTM and Remiros, as the mod\u2019s readme credits them.'); },
      get terms() { return t('credits.weaponSheathing.terms', 'The mod\u2019s own permission: free to use with credit and no fee.'); },
      get contact() { return t('credits.contact.nexus', '{author}, through the Nexus page ({page})', { author: 'Greatness7', page: 'morrowind mod 46069' }); },
      vendor: Object.freeze(['weapon-sheathing']),
      link: 'https://www.nexusmods.com/morrowind/mods/46069',
    }),
    Object.freeze({
      title: 'Handheld Torches',
      version: '1.4.1',
      author: 'RedRoryOTheGlen',
      get what() { return t('credits.handheldTorches.what', 'Carrying a light takes a free hand. Drawing a two-handed weapon stows or drops your torch, and it lights again when your hand is free. Keys light, put out, drop and throw a torch, and a thrown torch can set an enemy alight. In first person you see your hand holding the light. Dropped torches keep burning, light the room, can be picked up and stay after a save.'); },
      get terms() { return t('credits.handheldTorches.terms', 'Used with the author\u2019s permission, with the mod\u2019s own textures.'); },
      get contact() { return t('credits.contact.nexus', '{author}, through the Nexus page ({page})', { author: 'RedRoryOTheGlen', page: 'daggerfallunity mod 780' }); },
      vendor: Object.freeze(['handheld-torches']),
      link: 'https://www.nexusmods.com/daggerfallunity/mods/780',
    }),
    Object.freeze({
      title: 'Climates & Calories',
      version: '1.7.1',
      author: 'Ralzar',
      get what() { return t('credits.climatesCalories.what', 'Survival. You feel the temperature from the climate, season, hour, weather, clothes and armor. Hunger, thirst, sleep and wetness are needs, food spoils, you can make camp and light campfires, and where you sleep matters. There are four tiers in Settings: Off, Boons (the default: neglect costs nothing, and staying fed, watered and rested gives bonuses), Casual (neglect only borrows stamina, which comes back once the need is met) and Hard (needs can hurt your attributes and health and make you sick).'); },
      get terms() { return t('credits.climatesCalories.terms', 'Reworked from the mod\u2019s rules with the author\u2019s permission, passed on by Mac. Its numbers were the starting point, and its own art is used for spoiled food, raw meat and the waterskin.'); },
      get contact() { return t('credits.contact.forumsManifest', '{author}, on the DFU forums', { author: 'Ralzar' }); },
      vendor: Object.freeze(['climates-calories']),
      link: 'https://www.nexusmods.com/daggerfallunity/mods/49',
    }),
    Object.freeze({
      title: 'World Tooltips',
      version: '1.1',
      author: 'jefetienne',
      get what() { return t('credits.worldTooltips.what', 'Shows a name under the crosshair for what you are looking at: a person, a shop sign and its opening hours, a door and its lock level, a dungeon entrance, a lever, a wheel, a ladder, a bookshelf, a summoned Daedra, and what a chest or a body holds. On the Enhanced skin it appears at the crosshair instead of in the mod\u2019s tooltip panel.'); },
      get terms() { return t('credits.worldTooltips.terms', 'Used with permission under its MIT License (Copyright (c) 2009-2018 jefetienne), with a second MIT notice for Daggerfall Workshop.'); },
      get contact() { return t('credits.contact.forumsManifest', '{author}, on the DFU forums', { author: 'jefetienne' }); },
      vendor: Object.freeze(['world-tooltips']),
      link: 'https://www.nexusmods.com/daggerfallunity/mods/158',
    }),
    Object.freeze({
      title: 'Readied Spellcasting Hands',
      version: '1.3',
      author: 'jefetienne',
      what: 'Your hands stay raised while a spell is readied, in the spell\u2019s element, instead of an empty screen. The cast plays on from them when you click. Works with the classic first-person hands.',
      terms: 'Used with permission under its MIT License (Copyright (c) 2009-2018 jefetienne), with a second MIT notice for Daggerfall Workshop.',
      contact: 'jefetienne, on the DFU forums',
      vendor: Object.freeze(['readied-spellcasting-hands']),
      link: 'https://www.nexusmods.com/daggerfallunity/mods/91',
    }),
    Object.freeze({
      title: 'Windmills of Daggerfall',
      version: '2.0',
      author: 'Kamer',
      get what() { return t('credits.windmills.what', 'Windmills: the tower and its sails, the machinery inside with its turning gear and roller, 17 climate and season looks, and the 7 farms he chose for them. Enhanced skin only. The Classic skin shows Daggerfall\u2019s own farms.'); },
      get terms() { return t('credits.windmills.terms', 'Used with the author\u2019s permission.'); },
      contact: 'DFU Discord',
      vendor: Object.freeze(['windmills-kamer']),
    }),
    // WOD1: Kamer's second - AFTER the mill, which the CR1 gate finds
    // first by his name.
    Object.freeze({
      title: 'World of Daggerfall',
      version: '2.0',
      author: 'Kamer',
      get what() { return t('credits.worldOfDaggerfall.what', 'The wilderness: his 65 layouts of bandit camps and forts, ruins, shrines, mountains and rock fields, listed at 227,938 places across the Iliac Bay, one to a map square, with the bandits, bears, warriors and treasure they hold. Also his camp outside Privateer’s Hold.'); },
      get terms() { return t('credits.worldOfDaggerfall.terms', 'Used with the author’s permission, confirmed by Mac.'); },
      get contact() { return t('credits.contact.dfuForums', 'DFU forums'); },
      vendor: Object.freeze(['world-of-daggerfall']),
      link: 'https://www.nexusmods.com/daggerfallunity/mods/181',
    }),
    // LPT1: Kamer's sixth (beside his wilderness), under the handle his manifest signs it with
    Object.freeze({
      title: 'Low Poly Trees',
      version: '5',
      author: 'SquidKamer',
      what: '3D trees, bushes and stumps in the wilderness: his 253 low-poly models replace Daggerfall\u2019s flat sprites, each tree with its own size and angle. Far away they are drawn as pictures, so you can still see to the horizon. Their leaves and bark are painted from your own Daggerfall art and from Seasons of the Iliac Bay\u2019s, so they change with the seasons.',
      terms: 'Included on Mac\u2019s word. SquidKamer\u2019s permission is still to be recorded.',
      contact: 'DFU Discord',
      vendor: Object.freeze(['low-poly-trees']),
    }),
    Object.freeze({
      title: 'Basic Roads',
      version: '1.3.1',
      author: 'Hazelnut',
      get what() { return t('credits.basicRoads.what', 'Roads and tracks across the Iliac Bay, from the author\u2019s hand-drawn network, painted into the ground. Shown in both skins and on the map.'); },
      get terms() { return t('credits.basicRoads.terms', 'Used with the author\u2019s permission. The road painter is under the MIT License (Copyright (C) 2020 Hazelnut).'); },
      get contact() { return t('credits.contact.dfuForums', 'DFU forums'); },
      vendor: Object.freeze(['roads-hazelnut']),
      link: 'https://github.com/ajrb/dfunity-mods',
    }),
    Object.freeze({
      title: 'Travel Options',
      version: '1.11',
      author: 'Hazelnut',
      get what() { return t('credits.travelOptions.what', 'Travel across the land instead of arriving at once. The travel map lets you choose Daggerfall\u2019s fast travel or a sped-up journey, with a panel to steer it, stops for encounters and places, and a key to follow Basic Roads\u2019 roads and tracks. The travel map also gets a ports filter, a page with the road network drawn on it, a location info key and location markers. The autopilot is Jedidia\u2019s, from Tedious Travel.'); },
      get terms() { return t('credits.travelOptions.terms', 'Code under the MIT License (Copyright (C) 2020 Hazelnut; PlayerAutoPilot Copyright (C) 2019 Jedidia). The 3 interface textures are the mod\u2019s own art, used with the author\u2019s permission.'); },
      contact: 'forums.dfworkshop.net',
      vendor: Object.freeze(['travel-options']),
      link: 'https://github.com/ajrb/dfunity-mods',
    }),
    Object.freeze({
      title: 'Dynamic Skies',
      version: '2.3.4',
      get author() { return t('credits.author.pair', '{first} and {second}', { first: 'BadLuckBurt', second: 'carademono' }); },
      get what() { return t('credits.dynamicSkies.what', 'The sky with Enhanced environments on: a sun and atmosphere (built on Feral Pug\u2019s extension of Unity\u2019s procedural sky), 2 cloud layers for each weather, twinkling stars, Masser and Secunda moving through their phases, its own fog colors and distances, longer sunrises and sunsets, lightning flashes in storms, and pixel snow. The shader, presets and textures are the mod\u2019s own. The Classic skin keeps Daggerfall\u2019s painted sky.'); },
      get terms() { return t('credits.dynamicSkies.terms', 'Used with the authors\u2019 permission.'); },
      get contact() { return t('credits.contact.discordServer', '{server} Discord server', { server: 'Lysandus\' Tomb' }); },
      vendor: Object.freeze(['dynamic-skies']),
      link: 'https://github.com/drcarademono/dynamic-skies',
    }),
    Object.freeze({
      title: 'Seasons of the Iliac Bay',
      version: '1.1',
      author: 'RosyTheRascal',
      get what() { return t('credits.seasons.what', 'Autumn, spring and winter repaints of the trees, rocks and plants in woodland, hill, haunted and mountain areas. The textures are not included: they are read from your own copy of the mod.'); },
      get terms() { return t('credits.seasons.terms', 'Used with the author\u2019s permission.'); },
      get contact() { return t('credits.contact.discordServer', '{server} Discord server', { server: 'Lysandus\' Tomb' }); },
      vendor: Object.freeze(['seasons-iliac-bay']),
    }),
    Object.freeze({
      title: 'Ambient Text',
      version: '1.8',
      author: 'Regnier',
      get what() { return t('credits.ambientText.what', 'Now and then, a short line about your surroundings: 918 written by the author, chosen by the kind of place or dungeon you are in, the hour and the weather. It stays quiet indoors and waits longer after each line.'); },
      get terms() { return t('credits.ambientText.terms', 'Used with the author\u2019s permission, with the author\u2019s own lines.'); },
      contact: 'forums.dfworkshop.net',
      vendor: Object.freeze(['ambient-text']),
    }),
    Object.freeze({
      title: 'Eye Of The Beholder',
      version: '2.1',
      author: 'RedRoryOTheGlen',
      get what() { return t('credits.eyeOfTheBeholder.what', 'Third person without Morrowind data. Scroll the mouse wheel to swing the camera out behind your shoulder. It moves clear of walls, and you are drawn as the mod\u2019s own sprite from 8 directions, standing, walking, attacking and casting, on foot or riding.'); },
      get terms() { return t('credits.eyeOfTheBeholder.terms', 'Used with the author\u2019s permission, with the mod\u2019s own 3,035 sprites.'); },
      contact: 'rmufrancisco@gmail.com',
      vendor: Object.freeze(['eye-of-the-beholder']),
    }),
    Object.freeze({
      title: 'Immersive Footsteps',
      version: '1.01',
      author: 'Kirk.O',
      get what() { return t('credits.immersiveFootsteps.what', 'Footsteps that match the ground: grass, gravel, sand, mud, snow, stone paths and shallow or deep water outdoors, tile, stone or wood floors indoors, dungeon water, and leather, chain or plate boots on stone. Your armor rattles as you walk, and the mod adds its own landing and splash sounds. Comes in 2 sound qualities.'); },
      get terms() { return t('credits.immersiveFootsteps.terms', 'Used with the author\u2019s permission, from the author\u2019s MIT-licensed source, with the mod\u2019s 210 sound clips.'); },
      contact: 'forums.dfworkshop.net',
      vendor: Object.freeze(['immersive-footsteps']),
    }),
    Object.freeze({
      title: 'Better Ambience',
      version: '0.1.4',
      author: 'Joshua Steinhauer',
      get what() { return t('credits.betterAmbience.what', 'The camera shakes when you are hurt, more for bigger hits. Each dungeon gets its own fog color and light, and an echo on every sound. Rain can be heard, muffled, indoors and at dungeon entrances. Its own footsteps with an armor clank stay off while Immersive Footsteps is on, as that mod\u2019s author asks.'); },
      get terms() { return t('credits.betterAmbience.terms', 'Used with the author\u2019s permission under the MIT License, with the 29 sound clips the mod uses, from the author\u2019s repository. Its rain and snow particle changes are not included.'); },
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
      get author() { return t('credits.author.unnamed', 'Unnamed ({source})', { source: 'Nexus Morrowind 56569' }); },
      get what() { return t('credits.oblivionLeveling.what', 'Another way to level, offered when you create a character. Raising skills fills a 100-point bar instead of Daggerfall’s skill total: primary and major skills fill it fastest, minor skills next and the rest slowest, and any overflow carries into the next level. Each level up gives you points to spend on a few attributes, with Luck costing more. You can set the points, how many attributes, and Luck’s cost on the mod’s tile. Originally an OpenMW Lua mod for Morrowind.'); },
      get terms() { return t('credits.oblivionLeveling.terms', 'Used with the author\u2019s permission, on Mac\u2019s word. The archive states no license and names no author.'); },
      vendor: Object.freeze(['oblivion-remaster-leveling']),
    }),
    Object.freeze({
      title: 'Horse Cart and Cargo',
      version: '1.0.0-rc12',
      author: 'demifiend000',
      get what() { return t('credits.horseCart.what', 'Your horse and wagon stay in the world. They wait where you dismount, or follow you or stay on command. Hitch the horse to the wagon, mount by walking up to them, and call them to you outdoors. Reach the wagon from an entrance it is parked near. Its load shows by weight and its wheels turn. Online, other players see them where you left them.'); },
      get terms() { return t('credits.horseCart.terms', 'Used with the author\u2019s permission, with the mod\u2019s own horse art.'); },
      get contact() { return t('credits.contact.nexus', '{author}, through the Nexus page ({page})', { author: 'demifiend000', page: 'daggerfallunity mod 1374' }); },
      vendor: Object.freeze(['horse-cart-and-cargo']),
      link: 'https://www.nexusmods.com/daggerfallunity/mods/1374',
    }),
    Object.freeze({
      title: 'Project Legacy',
      version: '0.4.1',
      author: 'Lattymoy, Gh\u00f0\u00a7\u2020 and Positronico',
      what: 'Your family and its tree. When you fall, an heir carries on your line: a sibling, a child or a newborn, with traits from their blood and upbringing. Switch between siblings, in a Bloodline house where death is final or an Enduring house where it costs years. Recover the remains and heirloom of the fallen and lay them to rest. Family members you are not playing live at the family home, where you can meet them and play them. Find it on the pause menu\u2019s Family tab.',
      terms: 'Used with permission: Mac is Lattymoy, the mod\u2019s first-named author. Rebuilt from the released mod with its bugs fixed.',
      vendor: Object.freeze(['project-legacy']),
    }),
    Object.freeze({
      title: 'Aquatic Sprites',
      version: '1.0',
      author: 'Cliffworms',
      get what() { return t('credits.aquaticSprites.what', 'Weed, coral and shells: underwater sprites that come with Daggerfall but were never used. 119 of them are placed in 3 flooded dungeon areas, exactly where the author put them.'); },
      get terms() { return t('credits.aquaticSprites.terms', 'Used with the author’s permission, under terms that ask only for credit: “The mod may be distributed/translated without my authorization as long as I am credited as the author.” The dungeon areas are rebuilt from your own game files.'); },
      get contact() { return t('credits.contact.nexus', '{author}, through the Nexus page ({page})', { author: 'Cliffworms', page: 'daggerfallunity mod 276' }); },
      vendor: Object.freeze(['aquatic-sprites']),
      link: 'https://www.nexusmods.com/daggerfallunity/mods/276',
    }),
    Object.freeze({
      title: 'Detailed Ships',
      version: '1.0.0',
      author: 'Cliffworms',
      get what() { return t('credits.detailedShips.what', 'The 2 ships you can own, rebuilt inside and out. On deck: rigging, crates and barrels, tenders, rudders and railings. Below: your quarters, the crew’s, a kitchen, a cargo hold, an armory and a shrine to Kynareth, with sailors to talk to. The Kynareth statue is by King of Worms and Zoran, as the author’s readme credits it. Pieces the mod borrows from Ninelan’s Daggerfall Expanded Textures are replaced with stand-ins made for this game.'); },
      get terms() { return t('credits.detailedShips.terms', 'Used with the author’s permission, under terms that ask only for credit: “The mod may be distributed/translated without my authorization as long as I am credited as the author.” The ships and the original pictures are rebuilt from your own game files.'); },
      get contact() { return t('credits.contact.nexus', '{author}, through the Nexus page ({page})', { author: 'Cliffworms', page: 'daggerfallunity mod 1080' }); },
      vendor: Object.freeze(['detailed-ships']),
      link: 'https://www.nexusmods.com/daggerfallunity/mods/1080',
    }),
    // WD3: carademono's two town mods, one entry each (two vendors, two pages).
    Object.freeze({
      title: 'Beautiful Villages of Daggerfall',
      version: '1.4.2',
      author: 'carademono',
      what: 'The Iliac Bay\u2019s villages, hamlets, farms, manors and temples laid out again, and its roadside taverns rebuilt: 7,317 places, exactly as the author arranged them. Most pieces it borrows from other mods (Daggerfall Expanded Textures, the RMB Resource Pack and others) are replaced with stand-ins made for this game.',
      terms: 'Used with the author\u2019s permission. Every town is the author\u2019s edit applied to your own game files.',
      contact: 'carademono, through the Lysandus\u2019 Tomb Discord server',
      vendor: Object.freeze(['beautiful-villages']),
      link: 'https://www.nexusmods.com/daggerfallunity/mods/566',
    }),
    Object.freeze({
      title: 'Beautiful Cities of Daggerfall',
      version: '0.5.0',
      author: 'carademono',
      what: 'The Iliac Bay\u2019s cities laid out again, with districts, walls, gates, markets and docks: 410 cities, exactly as the author arranged them. Most pieces it borrows from other mods are replaced with stand-ins made for this game.',
      terms: 'Used with the author\u2019s permission. Every city is the author\u2019s edit applied to your own game files.',
      contact: 'carademono, through the Lysandus\u2019 Tomb Discord server',
      vendor: Object.freeze(['beautiful-cities']),
      link: 'https://www.nexusmods.com/daggerfallunity/mods/720',
    }),
    // VE4: carademono's third - the Texture Overhaul's first pack, worn from the Overhauls screen.
    Object.freeze({
      title: 'Vanilla Enhanced',
      version: '3.4.7',
      author: 'carademono',
      what: 'Daggerfall’s textures remastered: the ground, trees, rocks and plants, city walls and dungeons. Turn it on from the Texture Overhaul card, where its add-ons Masked Roads (with Kokey) and Snowless Swamps and Jungles have their own switches.',
      terms: 'Used with the author’s permission. The author’s repaints are included unchanged from the mod’s public repository.',
      contact: 'carademono, through the Lysandus’ Tomb Discord server',
      vendor: Object.freeze(['vanilla-enhanced']),
      link: 'https://www.nexusmods.com/daggerfallunity/mods/273',
    }),
    // WA1: Kamer's third - after the mill and the wilderness, which the CR1
    // gate finds first by his name.
    Object.freeze({
      title: 'Warm Ashes - Ships',
      version: '1.1',
      author: 'Kamer',
      get what() { return t('credits.warmAshes.what', 'Pirate ambushes at sea. Fast travel by ship can be attacked by pirates: you fight on your ship\u2019s deck with your crew (on a borrowed ship if you own none), with the raiders\u2019 ships nearby. Beat them and you land where you were headed. Includes his 4 quests and 6 ship layouts.'); },
      get terms() { return t('credits.warmAshes.terms', 'Used with the author\u2019s permission. The quests are his own, unchanged, and the ships are his edits applied to your own game files.'); },
      contact: 'DFU Discord',
      vendor: Object.freeze(['warm-ashes-ships']),
      link: 'https://www.nexusmods.com/daggerfallunity/mods/985',
    }),
    // RAID1: Kamer's fourth, and the first he made for this port - no public
    // page to link.
    Object.freeze({
      title: 'World Events - Raiding Parties',
      version: '1.1',
      author: 'Kamer',
      get what() { return t('credits.raidingParties.what', 'Raids on towns. Each day knights, bandits or orcs attack towns across the Iliac Bay for 2 hours (10 real minutes online). Be in a raided town and the raiders come, with the town watch at your side. Drive off 15 to 25 of them to free the town and raise your standing with the region, its people, a knightly order and the Fighters Guild.'); },
      get terms() { return t('credits.raidingParties.terms', 'Made by Kamer for this game, used with his permission, with some bugs fixed.'); },
      contact: 'DFU Discord',
      vendor: Object.freeze(['world-events-raiding-parties']),
    }),
    // ARENA1: Kamer's fifth - after his raiding parties.
    Object.freeze({
      title: 'Daggerfall Arena',
      version: '1.0',
      author: 'Kamer',
      what: 'The Arena of Daggerfall, a colosseum in the middle of Daggerfall city: his arena with its tiers, torches and braziers, and a 32-block undercroft beneath it. It is drawn with your own Daggerfall art.',
      terms: 'Used with the author\u2019s permission, passed on by Mac.',
      contact: 'DFU Discord',
      vendor: Object.freeze(['daggerfall-arena']),
    }),
    Object.freeze({
      title: 'Iliac Puddle No More',
      version: '1.2.2',
      author: 'jet082',
      get what() { return t('credits.iliacPuddle.what', 'Makes the Iliac Bay a real sea. The seafloor falls away from every coast to as deep as 250 meters, and you can see the surface from above and below. Swim in open water: dive, surface, put on a burst of speed, climb out onto the shore and watch your breath. The deep has its own fog and light, weed, coral and schools of fish, its own creatures, and wrecks and sunken treasure under their guard.'); },
      get terms() { return t('credits.iliacPuddle.terms', 'Used with the author\u2019s permission. The coastline is rebuilt from your own Daggerfall files.'); },
      get contact() { return t('credits.contact.nexus', '{author}, through the Nexus page ({page})', { author: 'jet082', page: 'daggerfallunity mod 1304' }); },
      vendor: Object.freeze(['iliac-puddle-no-more']),
      link: 'https://www.nexusmods.com/daggerfallunity/mods/1304',
    }),
    Object.freeze({
      title: 'There’s a Hole in the Bottom of the Ocean',
      version: '1.1.0',
      author: 'jet082',
      get what() { return t('credits.oceanHoles.what', 'Blue holes in the deep. Far out in Iliac Puddle No More’s sea, the seafloor drops into a black pit under a plume of miasma. Swim down to reach a drowned, lightless dungeon where creatures of the deep replace the fire creatures, and loot is one material better.'); },
      get terms() { return t('credits.oceanHoles.terms', 'Used with the author\u2019s permission.'); },
      get contact() { return t('credits.contact.nexus', '{author}, through the Nexus page ({page})', { author: 'jet082', page: 'daggerfallunity mod 1313' }); },
      vendor: Object.freeze(['ocean-holes']),
      link: 'https://www.nexusmods.com/daggerfallunity/mods/1313',
    }),
    Object.freeze({
      title: 'Come Sail Away',
      version: '2.1',
      author: 'RedRoryOTheGlen',
      get what() { return t('credits.comeSailAway.what', 'A boat of your own to sail. Buy one as parts or as a deed, put it in the water (near a port for a deed) and take the helm. Row with the oars, or raise the sails, trim them to the wind and let it carry you. Pack the boat up to carry it with you. Includes his boats, sails, oars, wind gauge, waves and sounds.'); },
      get terms() { return t('credits.comeSailAway.terms', 'Used with the author\u2019s permission, with his own pictures and sounds. Some wave textures are rebuilt from your own Daggerfall files.'); },
      get contact() { return t('credits.contact.nexus', '{author}, through the Nexus page ({page})', { author: 'RedRoryOTheGlen', page: 'daggerfallunity mod 1131' }); },
      vendor: Object.freeze(['come-sail-away']),
      link: 'https://www.nexusmods.com/daggerfallunity/mods/1131',
    }),
    // FORAGE1: Harbinger451's, with the four quest actions it needs restated
    // from Jagget's Quest Actions Extension (nothing of that mod carried).
    Object.freeze({
      title: 'Foraging',
      version: '1.7',
      author: 'Harbinger451',
      get what() { return t('credits.foraging.what', 'Make a living in the wilderness. Use a Wood-Axe to chop wood, a Pick-Axe to mine gems and metals, a Sickle to cut plants, a Spade to rob graves, a Fishing-Net to fish and a Basket to forage for food. It works by daylight, away from towns and enemies, depending on your attributes, the climate and the season. You can also fetch firewood for commoners and nobles. Its quests use 4 actions from Jagget\u2019s Quest Actions Extension, rewritten here with thanks.'); },
      get terms() { return t('credits.foraging.terms', 'Used with the author\u2019s permission, with his own quests and textures, and 6 bugs fixed.'); },
      vendor: Object.freeze(['foraging']),
    }),
    // IT1: kkgobkk's carriages at the gates.
    Object.freeze({
      title: 'Immersive Travel',
      version: '1.5',
      author: 'kkgobkk',
      what: 'Carriages at the city gates. A carriage and driver wait outside walled cities and take you to a town or village for a fare: a daily fee plus any nights at an inn. Online, the carriage is how you fast travel over land.',
      terms: 'Used with the author\u2019s permission. The 4 city gates are the author\u2019s edits applied to your own game files.',
      contact: 'kkgobkk, through the Nexus page (daggerfallunity mod 986)',
      vendor: Object.freeze(['immersive-travel']),
      link: 'https://www.nexusmods.com/daggerfallunity/mods/986',
    }),
    // PI1: demifiend000's items in the world as themselves.
    Object.freeze({
      title: 'Physical Items',
      version: '0.1.29',
      author: 'demifiend000',
      what: 'Items lie in the world as themselves. A fallen enemy\u2019s gear scatters around the body to be picked up piece by piece, and Shift-clicking an item in your pack drops it in front of you. Each shows its own picture (its Morrowind one when Morrowind data is attached) and a rarity glow.',
      terms: 'Used with the author’s permission. It includes no art.',
      contact: 'demifiend000, through the Nexus page (daggerfallunity mod 1411)',
      vendor: Object.freeze(['physical-items']),
      link: 'https://www.nexusmods.com/daggerfallunity/mods/1411',
    }),
    // HAZE1 / WINDFALL1 / SNOWFALL1 / ALIKR1 (2026-10-08, Mac: "We have permission to use and
    // implement everything into the codebase"): the four environment mods, handed over together.
    Object.freeze({
      title: 'Heat Haze',
      version: '1.0.1',
      author: 'demifiend000',
      what: 'Heat shimmer in the desert. On sunny and cloudy days the distant land and sky waver in the heat, fading in after sunrise and out before sunset. Part of the enhanced outdoors.',
      terms: 'Used with the author\u2019s permission, on Mac\u2019s word.',
      contact: 'demifiend000, through the Nexus page (daggerfallunity mod 1397)',
      vendor: Object.freeze(['heat-haze']),
      link: 'https://www.nexusmods.com/daggerfallunity/mods/1397',
    }),
    Object.freeze({
      title: 'Windfall',
      version: '1.0.0',
      author: 'demifiend000',
      what: 'Wind that changes from day to day. Trees and plants sway each in their own way, some days are windy or stormy, gusts come and go with their own sounds, and leaves and snow blow off the branches. Part of the enhanced outdoors.',
      terms: 'Used with the author\u2019s permission, on Mac\u2019s word, with the mod\u2019s own pictures and sounds.',
      contact: 'demifiend000, through the Nexus page (daggerfallunity mod 1396)',
      vendor: Object.freeze(['windfall']),
      link: 'https://www.nexusmods.com/daggerfallunity/mods/1396',
    }),
    Object.freeze({
      title: 'Snowfall',
      version: '1.0.5',
      author: 'demifiend000',
      what: 'Daggerfall\u2019s winter ground repainted with the author\u2019s snow. Part of the enhanced outdoors.',
      terms: 'Used with the author\u2019s permission, on Mac\u2019s word.',
      contact: 'demifiend000, through the Nexus page (daggerfallunity mod 1401)',
      vendor: Object.freeze(['snowfall']),
      link: 'https://www.nexusmods.com/daggerfallunity/mods/1401',
    }),
    Object.freeze({
      title: 'Sands of the Alik\u2019r',
      version: '2',
      author: 'Unnamed (Nexus mod 1390)',
      what: 'The desert ground repainted as pale, rippled dune sand. Part of the enhanced outdoors.',
      terms: 'Used with the author\u2019s permission, on Mac\u2019s word. The archive names no author.',
      vendor: Object.freeze(['sands-of-the-alikr']),
      link: 'https://www.nexusmods.com/daggerfallunity/mods/1390',
    }),
    // KG3 (bible/11-Multiplayer/Kings-Gambit.md section 10.7): the bundle names no author - the credits' own unnamed form
    // until the owner names them (CR1 asks every row for an author; AUDIT KG C17)
    Object.freeze({
      get title() { return t('credits.kingsGambit.title', 'The King\u2019s Gambit'); },   // the game's name as its table says it (L10N4)
      version: '1',
      get author() { return t('credits.author.unnamed', 'Unnamed ({source})', { source: 'thekingsgambit.dfmod' }); },
      get what() { return t('credits.kingsGambit.what', 'A battle of armies and kings, played at a tavern\u2019s card table against the regulars, or online against another player. Its units use the Iliac Hand cards\u2019 pictures, and its kings the Bay deck\u2019s.'); },
      get terms() { return t('credits.kingsGambit.terms', 'Used with permission, on Mac\u2019s word. The bundle names no author.'); },
      vendor: Object.freeze(['kings-gambit']),
    }),
    // DEX0 (bible/04-Characters/Enemy-Expansion.md): Kamer & Kab's fifty enemies and their encounter tables.
    Object.freeze({
      get title() { return t('credits.dex.title', 'Daggerfall Enemy Expansion'); },   // the mod's name as its manifest says it (L10N4)
      version: '1.3.4',
      author: 'Kamer & Kab',
      get what() { return t('credits.dex.what', 'Fifty new enemies and the encounter tables they come from (DEX): goblins, trolls that get back up, minotaurs, golems, Dwarven centurions, mounted knights, necromancers, witches, the Vengeful King Lysandus and more, ported from the authors’ own source, in Kamer’s and Kab’s art - Daggerfall’s own sprites among it, some under their paint - and in Morrowind’s bodies where Morrowind has the creature.'); },
      get terms() { return t('credits.dex.terms', 'Ported from the shipped bundle and the authors’ own source; their art carried byte for byte (Daggerfall’s own sprites among it rebuilt from your files) - see vendor/daggerfall-enemy-expansion/README.md for the permission record.'); },
      get contact() { return t('credits.contact.nexus', '{author}, through the Nexus page ({page})', { author: 'Kamer & Kab', page: 'daggerfallunity mod 372' }); },
      vendor: Object.freeze(['daggerfall-enemy-expansion']),
      link: 'https://www.nexusmods.com/daggerfallunity/mods/372',
    }),
    // MUDEX1 (bible/04-Characters/Enemy-Expansion.md, MUDEX): Meaner Monsters' own form beside DEX, by its author.
    Object.freeze({
      title: 'MUDEX',
      version: '1.0.1',
      author: 'Ralzar',
      get what() { return t('credits.mudex.what', 'Meaner Unleveled Daggerfall Enemy Expansion: Meaner Monsters as its author made it for Daggerfall Enemy Expansion. With both on, it sets the stats of 35 monsters, old and new, and gives every kind of dungeon its own themed, unleveled encounter tables.'); },
      get terms() { return t('credits.mudex.terms', 'Used with permission, on Mac\u2019s word; its two tables carried byte for byte. The repository states no license.'); },
      vendor: Object.freeze(['mudex']),
      link: 'https://github.com/Ralzar81/MUDEX',
    }),
  ]),
});

/** Names as the player's language lists them ("A, B and C"). */
const listOf = (names) => {
  try { return new Intl.ListFormat(intlLocale(), { type: 'conjunction' }).format(names); } catch { return names.join(', '); }
};

/** L10N6: THE TRANSLATIONS, credited as the works are - one row a language the game holds text for, English and the
 *  pseudo-locale aside (textManager availableLocales, as scenes/localeData.js registers them): its name in itself,
 *  whose words they are, and a bundled pack's terms and source. Mac's decisions (Localization-Arc.md): a machine draft
 *  says it is one; the people who translate or check a language are credited by name (`locales/<tag>/translators.json`);
 *  a pack is bundled only on its authors' terms, and those travel with it. A pack the player installed is their own -
 *  the Language row says so, the credits do not. Read as the About pane draws it, so every sentence is the player's
 *  language's. */
export function translationCredits(infos = availableLocales()) {
  return infos.filter((i) => i.code !== BASE_LOCALE && i.code !== PSEUDO_LOCALE && !i.hidden).map((i) => {
    const people = i.translators ?? [];
    const pack = i.bundled ?? null;
    const lines = [];
    if (i.source === 'machine') {
      lines.push(people.length
        ? t('credits.l10n.checked', 'Machine translation by Claude, checked and corrected by {names}.', { names: listOf(people) })
        : t('credits.l10n.machine', 'Machine translation by Claude, still being checked. Corrections from native speakers are welcome.'));
    } else {
      lines.push(people.length
        ? t('credits.l10n.people', 'Translated by {names}.', { names: listOf(people) })
        : t('credits.l10n.community', 'Translated by the community.'));
    }
    if (pack) lines.push(t('credits.l10n.bundled', 'Daggerfall\u2019s original text is {pack}, used with its authors\u2019 permission.', { pack: pack.name }));
    const authors = [...(pack?.authors ?? []), ...people];
    return Object.freeze({
      code: i.code,
      title: i.name,
      author: authors.length ? listOf(authors) : 'Claude (Anthropic)',
      what: lines.join(' '),
      ...(pack ? { terms: t('credits.l10n.terms', '{license}: {terms}', { license: pack.license, terms: pack.terms }) } : {}),
      ...(pack && /^https?:\/\//.test(pack.source) ? { link: pack.source } : {}),
    });
  });
}
