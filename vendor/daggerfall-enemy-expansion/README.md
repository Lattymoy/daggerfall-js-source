# Daggerfall Enemy Expansion 1.3.4 - Kamer & Kab (ported 1:1, in slices)

**Daggerfall Enemy Expansion 1.3.4** for Daggerfall Unity, by **Kamer & Kab**
(Nexus mod 372; GUID `76557441-7025-402e-a145-e3e1a28a093d`; built as the
Unity project `DaggerfallBestiaryProject`, so its scripts' namespace and its
log tag `[DEX]` say that). The mod's own description: "Adds a great variety
of new enemies to Daggerfall". Its Nexus page - as a web search quotes it; the
page itself refuses this container - credits Kab (Kevin Boissonneault) with
the scripting, stats, encounter tables and sound, and Kamer with the models,
the monsters' design and their animation. Kamer's Windmills, Daggerfall Arena and World Events:
Raiding Parties are `vendor/windmills-kamer/`, `vendor/daggerfall-arena/` and
`vendor/world-events-raiding-parties/`, and his Low Poly Trees (as SquidKamer)
`vendor/low-poly-trees/`. Its one dependency, optional, is
`roleplayrealism-items` (`vendor/roleplay-realism-items/`).

Mac (Lattymoy) handed the shipped archive over on 2026-10-19
(`Daggerfall Enemy Expansion-372-1-3-4-1708711071 (1).7z`, 40,903,152 bytes,
sha256 `1f2cefa0e6bfbb55549a19a55dcb0c700d370c6bc76be0d19493b9b1ab989334`;
one file, `Mods/daggerfall enemy expansion.dfmod`, sha256
`6824c32daca8e9c5e9702b49b261aeaee01f7d66569ec7a86559ca4afe443959`): "I want
to implement this as our next mod 1:1. We also need to ensure these get
proper morrowind model replacements if applicable".

**Permission: [Mac: record the authors' permission, or the link to it, here -
Mac gave his word on 2026-10-19 that it was given ("Yes, record my word");
the earlier mod records carry the authors' own words or a link in this
line.]**

## What the mod is

Fifty new enemies and a new law for where enemies come from:

- **Thirty-five monsters** (mobile IDs 256-290: Goblin, Homunculus, Lizard Man
  and Lizard Warrior, Bat, Medusa, Wolf, Snow Wolf, Hell Hound, Grotesque,
  Skeletal Soldier, Dog, Nymph, Minotaur, Iron Golem, Blood Spider, Troll,
  Gloom Wraith, Faded Ghost, Vengeful King Lysandus, Fire Daemon, Ghoul, Boar,
  Land Dreugh, Mountain Lion, Mudcrab, Ogre, Will-o'-wisp, Ice Golem, Dremora
  Churl, Stone Golem, Dire Ghoul, Scamp, Centurion Sphere, Steam Centurion) -
  `MonsterBase.mdb.csv`;
- **fifteen classes** (384-398: Druid, Guard, the Knight, Rogue, Thief,
  Spellsword and Archer Riders, Necromancer Acolyte, Glaivier and Assassin,
  Rogue Druid, Bounty Hunter, Royal Knight, Dark Slayer, Witch Defender) -
  `ClassBase.mdb.csv`;
- forty-three careers they are built from (`CareerBase.cdb.csv`), sixteen
  classic monsters restatted (`ClassicMonsterReplacement.mdb.csv`), the
  classic Barbarian and Monk redrawn (`ClassicClassBase.mdb.csv`), and
  pictures for the city guard's spell records that DFU never draws (below);
- **thirty-nine encounter tables** (`DefaultTableReplacement.tdb.csv`) for the
  nineteen dungeon types, the water, and each climate's day, night and city
  night - a dungeon's table chosen by the dungeon itself (the same table every
  time it is entered), a climate's when the climate changes;
- four spells of its own (`SpellRecords.json`, 500-503) and on-hit effects
  (`OnHit`, 1-13: diseases, paralysis, the Blood Spider's leech, the Gloom
  Wraith's silence, the Fire Daemon's touch, the Will-o'-wisp's drain), the
  skeletal rule on the new skeletons, the new enemies' groups and languages;
- **the Troll gets back up**: ten seconds after it falls it stands again,
  unless a spell's missile strikes its body in the meantime and burns it to
  ash - a blade or an arrow does nothing to it (the corpse prefab `1618_20`,
  saved with the game; the one setting, `Cheat.DisableTrollRespawn`, stops
  it);
- with Roleplay & Realism: Items' realistic enemy equipment on, the new
  classes are equipped by the class each one names (`EquipmentTable`).

## What is here

- `daggerfall-enemy-expansion.dfmod.json` - the bundle's manifest, verbatim
  (the 8,067 files it was built from).
- `modsettings.json` - the shipped settings: one section, one key.
- `MonsterBase.mdb.csv`, `ClassBase.mdb.csv`, `CareerBase.cdb.csv`,
  `ClassicMonsterReplacement.mdb.csv`, `ClassicClassBase.mdb.csv`,
  `DefaultTableReplacement.tdb.csv`, `SpellRecords.json` - the bundle's
  tables, verbatim (CRLF as shipped).
- `Prefabs/1618_20.imported.json` - the troll corpse prefab's components as the
  bundle serializes them (DFU's ImportedComponent): the billboard's archive
  and record, its ash's, and its 10-second respawn.
- `Prefabs/1618_20.components.json` - the same prefab's OWN GameObject, which
  the imported json does not carry: DFU's components on it, read out of the
  bundle by `tools/dexExtract.mjs` - a DaggerfallEntityBehaviour of type None,
  an EntityEffectManager and a trigger sphere of radius 1. What reaches the
  body is read off these (a spell's missile, never a blade).
- `Textures/xml.json` - the bundle's 1,130 xml files, name -> text, verbatim:
  each record's `<scaleX>`/`<scaleY>` and the two archives' `<emission>`.
- `Daggerfall Enemy Expansion.dll` - the compiled assembly, byte for byte
  (sha256 `666ae571d62164abcc0b3d0ba3669ff46e88addf6a6bd23b01f3d2e48366da80`).
- `Scripts/` - the eight scripts the manifest names, verbatim from the authors'
  repository (`github.com/SquidKamer/DaggerfallBestiaryProject` @
  `c187c972787d8ca3f5b77aa127694e72f4eb2705`, "Updated to 1.3.4", 2024-02-23;
  no script has changed since). The bundle carries the DLL and no source:
  every string literal of the scripts is in the DLL's user-string heap and
  every member they declare is in its metadata, and every integer a method
  names is one its IL loads (`test/systems/enemyExpansion/dex0_record.test.js`
  proves all three against the DLL and the dump below, and each script's git
  blob id against the commit's tree), so the repository's source at that
  commit is taken as the shipped 1.3.4. **The
  bundle's tables are not the repository's at any commit**: its
  `DefaultTableReplacement.tdb.csv` is `d28793f`'s with two lines changed
  (the Rainforest's and the Haunted Woodlands' day tables trade the Archer and
  Spellsword Riders for classic classes) and seven lines from `c187c97`'s -
  the build was made from a working copy. What shipped is what is carried.
- `il/Daggerfall_Enemy_Expansion.il.txt` - the DLL's every method body as CIL,
  written by `python3 tools/ilDump.py "vendor/daggerfall-enemy-expansion/Daggerfall Enemy Expansion.dll"`
  (AUDIT DEX A4): what the record's constants are held to.
- `derived.json`, `daggerfall-enemy-expansion.files.json`,
  `repainted.files.json` - written by `tools/dexExtract.mjs` (below).

## Where the art is

`tools/dexExtract.mjs` measures every picture of every archive the mod's
tables draw (6,358 of them, in 58 archives) against every record of every
TEXTURE file of the player's own ARENA2, and sends each to one of three
places:

- **858 are Daggerfall's own records, exactly**, and are not carried: the five
  horse-rider sets (1500-1503 and 1506 are Daggerfall's unused riders,
  TEXTURE.491-495, record for record) and the Will-o'-wisp (1610's albedo and
  its emission map are TEXTURE.379's record 0, frame for frame, in each of its
  twenty records). `derived.json` names each one's record, and the port
  rebuilds it from the player's own file when the archive loads
  (`formats/derivedTexture.js`) - a render of game data is game data
  (`bible/01-Overview/Port-Doctrine.md`).
- **774 are Daggerfall's sprites under the authors' paint** - the Bounty
  Hunter (1504, TEXTURE.482), the Royal Knight (1505, from 482), the Druid and
  the Necromancer Acolyte (1509, 1511, from 486), the Rogue Druid (1512, from
  490), the Knight, Spellsword and Archer Riders' new sets (1530-1533, from 491
  and 495) and King Lysandus (1609, from 473) - carried byte for byte under
  `public/art/daggerfall-enemy-expansion-repainted/` on **Port-Doctrine's fourth
  exception** (Mac, 2026-10-19: "Approve 3rd exception", then "Yes, cover all
  of them"). A picture there that IS a record, exactly, is rebuilt instead.
  The Royal Knight's sixty shipped as the authors' own until AUDIT DEX B1
  measured their outlines (TEXTURE.482's Barbarian, 0.63-0.89 of the union on
  every one); the tool now measures every picture's outline against every
  TEXTURE frame's and refuses an archive that follows Daggerfall's outlines
  unless the exception carries it or the owner has allowed it (the demo's Bat,
  1603, below) - and a listed archive the measure does not find.
- **4,726 are the authors' own** - Kamer's renders (out of Arena's, Oblivion's,
  Morrowind's and Battlespire's monsters, and his own), Kab's classes, and the
  1995 demo's Bat, Gargoyle, Nymph and Skeleton (Mac, 2026-10-19: the demo's
  art is the mod's, not the retail ARENA2 the doctrine names) - under
  `public/art/daggerfall-enemy-expansion/`, as indexed PNG where the picture
  fits one (5,262 of the 5,500 shipped) and RGBA where not, each read back and
  compared to its texel before the next is written.

Each directory answers to its listing (`*.files.json`: every name and its
sha256 - what `test/tooling/doctrine.test.js` reads for what may stand there),
and `src/systems/enemyExpansion/dexArt.js` is generated beside them. Re-run
`node tools/dexExtract.mjs <arena2> "<the .dfmod>"` to check the tree against
the bundle (it fails on any difference), `--write` to write it.

**Not carried**: archives 1633 (Gryphon), 1641 (Frost Giant), 1642-1644 (the
Centaurs - Daggerfall's centaur, TEXTURE.263, repainted), 1645 (Shark) and
1706 (Clannfear). The bundle carries their pictures and no table of 1.3.4
names them - they are an add-on's to draw. Nor the twenty pictures of the city
guard's archive, 399 (Daggerfall's guard repainted, at records 20-24): DFU
dresses a mobile in a mod's pictures only when its archive's record 0, frame 0
has one (`TextureReplacement.GetMobileBillboardMaterial`), and then only the
records the archive's own TEXTURE file has - TEXTURE.399 has twenty, 0-19, and
the bundle no `399_0-0`. In DFU they are never drawn, so they are not carried
(`tools/dexExtract.mjs` drawnClassic).

**One number, two pictures**: `vendor/class-skins/` (the player's on-foot skins)
uses archives 1513, 1514, 1519, 1520 and 1530 for other sheets than these, and
its 1504 is this Bounty Hunter, pixel for pixel. The skins are read by the
player body's own sprite index (`player/eyeOfTheBeholder/eotbSprite.js`), never
through the texture door these register on, so neither draws the other's.

## What is ported, and where

- **DEX0** (2026-10-19): this record - the vendored files, the art and its
  three places, the registry row, the credit, the mod's switch.
- **DEX1** (2026-10-19): the enemy registry - the tables read as
  `BestiaryMod.Start` reads them (`src/systems/enemyExpansion/dexTables.js`),
  the fifty enemies in the table with their careers and names, the classic
  edits and the quest foes while the mod is loaded
  (`src/systems/enemyExpansion/dexInstall.js`), on DFU's custom-enemy doors
  (`src/characters/enemy/customEnemies.js`, `enemyBasics.js`,
  `enemyEntity.js` loadEnemyCareer). `bible/04-Characters/Enemy-Expansion.md`
  section 5.
- **DEX2** (2026-10-20): the pictures on the texture door as DFU
  imports them (`src/systems/enemyExpansion/dexSprites.js`) - each record's
  frames to the first missing (a picture past a gap ships and is never drawn),
  the xml's scales, the emission maps - and SetupDemoEnemy's renderer: the
  ghost shader by a Spectral row, NoShadow (`src/characters/enemy/foeLook.js`);
  the glow's light routed. Section 6.
- **DEX3** (2026-10-20): the encounter tables - the table database read as
  `ParseEncounterTables` reads it, a dungeon's tables picked by its seed and
  the climates' on PlayerGPS's events
  (`src/systems/enemyExpansion/dexEncounters.js`, `src/world/playerGps.js`),
  on a door every reader asks (`src/characters/encounterTableDoor.js`).
  Section 7.
- **DEX4a** (2026-10-20): the spells - `SpellRecords.json` merged into the
  standard list as DFU's RebuildClassicSpellsDict merges it
  (`src/systems/spell/standardSpells.js`), the spellbook tables cast at a
  foe's spawn (`src/systems/enemyExpansion/dexSpells.js`, through
  `src/systems/enemySpells.js`), a cast's spell index a u16 on the wire.
  Section 8.
- **DEX4b** (2026-10-20): the combat hooks - OnMonsterHit's chain and the
  four arms that ready the mod's spells, the Skeletal Warrior's rule for the
  Skeletal Soldier, its fifty's groups and languages, the forced gender
  (`src/systems/enemyExpansion/dexCombat.js`). Section 9.
- **DEX7** (2026-10-20): the Morrowind bodies, the port's own - each monster
  in the Morrowind creature that is it and moves as it does, or a declared
  miss; the lizard men Argonians; the riders their sprites
  (`src/systems/enemyExpansion/dexBodies.js`). Section 10.
- **DEX5a** (2026-10-20): the troll that gets back up - its corpse prefab on
  a door of the port's (`src/scenes/corpseMarker.js` registerCorpsePrefab),
  no loot, the rise after ten seconds, the cheat, a spell's missile burning it
  to ash, the save keeping its time (`src/systems/enemyExpansion/dexTroll.js`).
  Section 11.
- **DEX5b** (2026-10-20): the troll's body online - the foe's runner counts,
  rises and burns; a copy's missile goes to it, and its record says a body
  gone to every copy. Section 11.
- **DEX6** (2026-10-20): the equipment - while Roleplay & Realism: Items'
  realisticEnemyEquipment is on, the mod's copy of RRI's class arm
  (`Scripts/Compatibility/DEX_RRICompat.cs`): the class by its
  EquipmentTable, the armor by the career, the unknown's longblade, the
  Assassin's poison by the table (`src/systems/enemyExpansion/dexEquipment.js`
  over `src/combat/rriEnemyEquipment.js`). Section 12.
