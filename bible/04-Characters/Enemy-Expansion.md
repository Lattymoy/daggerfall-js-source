# Daggerfall Enemy Expansion (DEX)

Kamer & Kab's mod Daggerfall Enemy Expansion 1.3.4, ported from its own source: fifty new enemies (goblins, trolls,
minotaurs, golems, mounted knights, necromancers, witches and more), sixteen classic ones restatted, new encounter
tables for every dungeon type and climate, four spells, the mod's on-hit effects, and a Troll that gets back up. The
player meets it as new foes everywhere. It is on by default and listed in Settings with the other mods. The vendored
record (provenance, files, art) is `vendor/daggerfall-enemy-expansion/README.md`.

## How it works

- **Install.** `installEnemyExpansion` (`src/systems/enemyExpansion/dexInstall.js`) does what the mod's
  `BestiaryMod.Start` does, once at game load: it reads the mod's tables (`src/systems/enemyExpansion/dexTables.js`,
  through the mod's own CSV helpers in `dexCsv.js`) and registers careers, enemy rows, names and quest foes. The tables
  are the bundle's files verbatim (`dexTableText.js`).
- **Enemy doors.** The port's enemy code has DFU's mod doors: `src/characters/enemy/customEnemies.js` (custom careers
  and names), `registerEnemyRows` in `src/characters/enemy/enemyBasics.js` (new rows and edits of classic rows) and
  `loadEnemyCareer` in `src/characters/enemy/enemyEntity.js`. New monsters are ids 256-290; new classes 384-398.
- **Sprites.** A mod archive draws from the texture door as DFU imports it (`src/systems/enemyExpansion/dexSprites.js`,
  `dexArt.js`): real frame counts, the xml scales, emission maps, NoShadow and the ghost shader.
- **Encounters.** `src/systems/enemyExpansion/dexEncounters.js` picks a dungeon's table on entry, seeded so every visit
  and every machine gets the same pick, and the climate's day, night and city-night tables on DFU's PlayerGPS events
  (`src/world/playerGps.js`).
- **Combat.** `src/systems/enemyExpansion/dexCombat.js`: DFU's on-hit arms plus the mod's four (Blood Leech, Silence,
  Daemon Touch, Wrack), the skeletal rule, groups and languages, and forced gender. Spells and spellbooks are
  `dexSpells.js`.
- **Equipment.** `src/systems/enemyExpansion/dexEquipment.js` kits the new classes by their tables while Roleplay &
  Realism: Items' realistic enemy equipment is on.
- **The Troll.** `src/systems/enemyExpansion/dexTroll.js`: a dead troll's body has no loot and rises as a new troll
  after 10 seconds of game time. Only a spell's missile can burn it to ash for good. Bodies still down are saved
  with the game. The mod's `Cheat.DisableTrollRespawn` setting stops the rise.
- **Hides.** Hunting skins the mod's animals for their family's hide (`src/net/professionLaw.js`).
- **Morrowind bodies.** `src/systems/enemyExpansion/dexBodies.js` matches each new monster to the Morrowind creature
  that is it and moves as it does, or declares a miss and keeps the sprite. Lizard men are people (Argonians). Classes
  are people, except riders, which keep their sprite.
- **MUDEX.** With DEX loaded and Meaner Monsters on, the port loads MUDEX (Ralzar's form of Meaner Monsters for DEX)
  instead: its two tables read after DEX's, and Meaner Monsters' own rows and scales stand aside
  (`src/systems/enemyExpansion/dexSwitches.js` `mudexLoaded`, `meanerMonstersAlone`).

## Rules

- The mod is ported 1:1 from its own source, and its new enemies get Morrowind bodies where Morrowind has the
  creature (Mac).
- Permission recorded (Mac). The art follows Port-Doctrine: pictures that are Daggerfall's own records are rebuilt
  from the player's ARENA2, never carried; the authors' repaints of Daggerfall sprites ship under Port-Doctrine's
  fourth exception (Mac).
- Every mod is made compatible: Meaner Monsters beside DEX is MUDEX, with no switch of its own (the owner).
- The mod's switch is `Enabled` (on), read once at load; a change waits for the next load.
- Online, the room takes the mod whole. A troll's body belongs to its foe's runner: only the runner counts, rises and
  burns it. A copy's missile is sent to the runner.
- New enemies show their names in the player's language (`src/systems/enemyExpansion/dexNames.js`); the mod shows its
  English names in every language.

## Daggerfall Unity

The mod is a DFU mod (`BestiaryMod.cs`, `DEX_RRICompat.cs`, the troll corpse scripts). Departures: localized names;
Morrowind bodies (DFU draws only sprites); online play; MUDEX is loaded for the player where Meaner Monsters only asks
the player to switch.

## Code and tests

- `src/systems/enemyExpansion/` - the port: install, tables, encounters, combat, spells, equipment, troll, bodies,
  switches
- `src/characters/enemy/customEnemies.js`, `enemyBasics.js`, `enemyEntity.js` - DFU's enemy doors
- `src/scenes/corpsePrefabHost.js` - the hosts' door for the troll's corpse prefab
- `tools/dexExtract.mjs` - splits the bundle's art and measures it against every TEXTURE record
- `test/systems/enemyExpansion/` - the port, the record against the DLL (`dex0_record.test.js`), sprites
- `test/net/world2.test.js`, `test/net/bodyloot_protocol.test.js` - the troll online
