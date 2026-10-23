# AUDIT DEX (2026-10-20) - Daggerfall Enemy Expansion, read cold

The owner, of the DEX arc (`04-Characters/Enemy-Expansion.md`, DEX0-DEX7, PR #1067): **"Lets audit everything"**. This
page is the audit: the record and the registry, the sprites and the bodies, the encounter tables, the spells and the
combat hooks, the Troll's corpse, the equipment, the pins, the mutants and the pull request's own words. Each finding has
its verdict here. What it changed is written into the pages it touched, marked `AUDIT DEX` with the finding's id, and
in the code beside the fix.

## How it was run

Five lanes, each a cold adversarial reader of a FROZEN head (`d8db6d444`, a detached worktree per lane - Home.md's DO
NOT FIX WHILE THE VERIFIER IS READING), told to reproduce a finding before reporting it - a repro, a mutant that
survives, or the C# beside the port's line - and to end on what it checked and found sound. ARENA2 was fetched
(`tools/fetch-data.sh`) and every lane could read the freeware's files; the authors' repository was cloned to read the
C# at `c187c97` and after it.

| Lane | Over | How |
|---|---|---|
| A | DEX0 the record, DEX1 the registry | 11 findings; the extractor's check mode over the bundle, the scripts against the authors' tree, the reading's mutants, the hosts' arms |
| B | DEX2 the sprites, DEX7 the bodies | 10 findings; every shipped picture's outline against every TEXTURE frame, the billboard pass driven, the decoded bytes measured |
| C | DEX3 the encounter tables, DEX4 the spells and combat hooks | 9 findings; a fast travel between climates driven through PlayerGPS, every group reader, the C#'s handlers line by line |
| D | DEX5 the Troll's corpse, online and off | 14 findings; quickloads, the room's memory, a seat's load and a late joiner driven through the dungeon's own chain |
| E | DEX6 the equipment, the pull request | 12 findings; 20,000 foes kitted under each arm, DEX_RRICompat line by line against RRI's |

Every finding was verified against the code before anything was fixed. Fixes were made in the main tree (lanes A, C, D
and the record) and in two worktrees of their own (the equipment, the art), each reviewed before it was taken.

## What it found, and what was done

### A - the record and the registry

| Id | Finding | Verdict |
|---|---|---|
| A1 HIGH | The rows' FemaleCorpseTexture was read and never drawn: the female riders, every Thief Rider and the female Dark Slayers died as the male corpse (EnemyDeath.cs:86-93) | FIXED: `corpseMarker.js` corpseTextureOf at every corpse mint (the dungeon's two, the street's) |
| A2 MED | A class test the DEX1 sweep missed: `revenantFeud.js` adaptBlowClass read `>= 128`, so a mod's monster's bare blow was a person's hands to a revenant | FIXED: the class bit; the record's "every site" narrowed to every site a mod's id reaches (three it cannot are named) |
| A3 MED | Meaner Monsters' own source warns that it is incompatible with DEX (two boxes, MeanerMonsters.cs:24, :94, :159-164); the port composes both, on by default and forced online, and named no departure | NAMED: a departure in section 5 and Ledger A; Meaner Monsters' record updated. Then FIXED (MUDEX1, the owner: "We need to make everything compatible", "Approve MUDEX"): beside DEX, Meaner Monsters is MUDEX - its author's form of it for DEX, vendored, its tables read after DEX's own - and its rows, xml and PCAAO's edit stand aside; eleven mutants |
| A4 MED | "The C# is what the DLL was built from" was held by substring: a constant, a `continue` or a literal cut short in the carried C# passed | FIXED: each script's git blob id against the authors' tree at c187c97; every literal held exactly; the DLL's IL dumped (`vendor/.../il/`) and every integer a method names found in its IL. Four survivors recorded (`dex0.json`) |
| A5 MED | DEX1's reachable arms were unpinned: the Necromancer Assassin's second ranged attack, the Monk's ranged attack, the hosts' four monster-or-class arms | FIXED: pinned (`dex1_registry.test.js`); six mutants in a new `dex1.json` |
| A6 MED | The fifty names are English in every language, and the L10N4 ratchet's comment said they were never shown | FIXED (the comment); then FIXED (the gap - the owner, 2026-10-20: "We need to make everything compatible. No if ands or vutts"): `enemyExpansion/dexNames.js` names the fifty through `t()` and the text manager's door for a mod's names reads them, a draft in every language; a departure from DFU's English, in Ledger A; four mutants, the L10N3e record re-aimed |
| A7 LOW | The credit said the mod was "ported 1:1 ... each in Kamer's and Kab's own art" | FIXED with B8/E12: reworded in English and the thirteen drafted languages |
| A8 LOW | The record said relay world229 | FIXED with E6: world234 (renumbered at the merges, E7) |
| A9 LOW | The class test cited as `EnemyBasics.IsClassEnemyId` - no such member | FIXED: `DaggerfallEntity.IsClassEnemyId` (DaggerfallEntity.cs:974-977), in the record and every comment |
| A10 LOW | readCareerTable held a replacement career's edits to the line's end and read a missing cell as empty; the C# writes in place and throws | FIXED: in place, and a cell past a short line throws; two mutants |
| A11 LOW | "five hooks" (about nine), "five tables" (six), the mod's method named as DFU's delegate | FIXED with E9 |

### B - the sprites and the bodies

| Id | Finding | Verdict |
|---|---|---|
| B1 HIGH | The Royal Knight (1505) is TEXTURE.482's Barbarian under the authors' paint, shipped as their own art, outside the fourth exception | FIXED: 1505 under the exception (774 repaints); the extractor measures every picture's outline against every TEXTURE frame and refuses an archive that follows Daggerfall's outlines unless listed or allowed (the demo's Bat, 1603, on "Mod art, ship it") |
| B2 HIGH | The patch note said the vampires, the daedra and the fire atronach cast no shadow; with Morrowind's data their bodies did | FIXED: a NoShadow row's body casts none (`foeFx` carries the flat's `noShadow`, `peerBodies.js` cast reads it); the note now true |
| B3 MED | A corpse of more than one frame (the Hell Hound's) never animated outside a dungeon | FIXED: the street's and the interiors' marker carries its clock (`tickCorpseMarkers`) |
| B4 MED | Only the ghost-shader predicate was pinned; reverting either draw-loop site passed | FIXED: the billboard pass driven over the batches `setupFoeLook` makes |
| B5 MED | Every DEX picture an archive decoded stayed on the CPU for the session (~350 MB at full; the Barbarian's two archives 86 MB) | FIXED: the pictures register `readOnly`, DFU's own import flag (TextureReplacement.cs:574, :609) - let go once uploaded, measured to none |
| B6 LOW | The Overworld's bands were built without `setupFoeLook`: a spectral band opaque, a NoShadow band casting | FIXED |
| B7 LOW | `mobileBillboardSize` minted two objects per foe per frame for an xml-scaled stand-in | FIXED: the xml-applied size cached per texture and record, by the live entry and the registrations |
| B8 LOW | The credit's art claim | FIXED with A7 |
| B9 LOW | The emission rule cited to the mobile's material; "the Fire Daemon" for the Hell Hound; a test's `wisp` holding the hound; Ledger C's glow row without the Frost Daedra | FIXED: the static material's `emission ?? albedo` cited (the corpse is a flat), the names, the variable, the row |
| B10 LOW | The frame-count cache's staleness claim unpinned | FIXED: pinned |

### C - the encounter tables, the spells and the combat hooks

| Id | Finding | Verdict |
|---|---|---|
| C1 HIGH | PlayerGPS's ResetState was not carried: after a fast travel or a load from one town into another climate's, no entry was raised and the mod's city night for that climate never drawn; the record named it a harmless departure | FIXED: `playerGps.js` resetPlayerGpsState, played by the jump core on a load and a fast travel (the two that raise it in DFU - which two is the module's, `RESET_ON`, since DEX's merge: `Host-Split.md`); the false departure struck; five mutants |
| C2 MED | The mod's skeletal test only widened DFU's: under the mod a Barbarian (143, career 15) kept the Skeletal Warrior's rule, where the override asks the ID | FIXED: a door's answer stands alone; the mod's is its whole test |
| C3 HIGH | Detect, Dispel and Pacify read a copy of DFU's group switch (`nearbyObjects.js`), never the mod's door: the 35 grouped monsters of the mod were None to them | FIXED: the switch and its door one leaf (`combat/enemyGroups.js`), every reader through it |
| C4 MED | DEX1 widened Ocean Holes' own class range (EnemyClass and 128-146, its IL) to DFU's bit: the abyss took every one of the mod's classes, always | FIXED: the mod's range restored; Ocean-Holes.md says so |
| C5 MED | The camps' GPS pin and its mutant read `rollCampEncounterOnChunkLoad`, which no host calls | FIXED: the two called rolls pinned, the record re-aimed |
| C6 MED | The dungeon's population place (`dungeonPlace`) and its rider-spell read were unpinned | FIXED: source pins for both hosts, three mutants |
| C7 LOW | The chunk-load camps fed PlayerGPS their any-town ring, the minute's roll PlayerGPS's own rect - one tracker, two readings | FIXED: the chunk hands its climate alone |
| C8 LOW | Encounter-table names case-sensitive, where the C#'s dictionary is OrdinalIgnoreCase | FIXED, and the header's check pinned |
| C9 LOW | The handler cites six lines off | FIXED |

### D - the Troll's corpse

| Id | Finding | Verdict |
|---|---|---|
| D1 HIGH | A same-dungeon quickload after the body rose or burnt brought no body back, and the ash stood on | FIXED: the load lays the save's body again; the rebuild takes every ash flat |
| D2 HIGH | Nothing cleared `corpseDestroyed`: a troll un-killed and killed again lay invisible and rose anyway | FIXED: un-death forgets the fate |
| D3 HIGH | The room's memory dropped the body's fate: a burnt troll stood again for an arrival | FIXED: the save writes `bg`, validSharedFoe keeps it on a dead record (world234 grown in place, undeployed) |
| D4 MED | The seat loading a save of a gone body put a ghost body on every copy | FIXED: the load settles it |
| D5 MED | The dungeon's half was held only by single-line regexes | FIXED: `dex5_audit.test.js` over the dungeon's real corpse chain |
| D6 LOW | A street copy with no prefab kept the body told burnt | FIXED: it drops its marker |
| D7 LOW | The own lane's `cs` arm came before its gates | FIXED: a living blow's gate |
| D8 LOW | The rise took the body before the stand was certain, and the HUD said so either way | FIXED: the stand first; a refused one leaves the body to try again |
| D9 LOW | Two online behaviours unnamed: the HUD lines are the runner's alone; a seat's hand-over loses a lasting effect on the body | NAMED in section 11 and Ledger A |
| D10 LOW | The port corrects the mod's restored body (DFU's has no career and burns to 0/0) without naming it | NAMED |
| D11 LOW | DEX5 put feature code inside two held hosts | FIXED: `scenes/corpsePrefabHost.js`, which the hosts wire |
| D12 LOW | `_down` kept a destroyed host's prefabs until the next save | FIXED: destroy releases them |
| D13 LOW | The record said a late joiner stands every lane's ash | FIXED: a layout foe's alone |
| D14 LOW | Two comment errors | FIXED |

### E - the equipment and the pull request

| Id | Finding | Verdict |
|---|---|---|
| E1 HIGH | DEX_RRICompat puts the second weapon on (:333, :385); the port's arm carried it only | FIXED: the arm's read `equipsSecondary` |
| E2 MED | A shield after a two-hander left the weapon in hand (RRI2's own, inherited) | FIXED: every piece laid through EquipItem's rules on a stand-in table; the answer is the table |
| E3 MED | A monster's ConvertOrcish roll drawn before its poison (RRI2's own, inherited) | FIXED: the poison first, `poisonRolled` answered |
| E4 MED | Three of the arm's claims unpinned (the id's tests, variant 1, the poison's fallback) | FIXED: pinned |
| E5 MED | The patch note limited the copy to the new classes; it re-kits every class, and the Monk wears about half its armour | FIXED: the record's section 12 and the patch notes say so |
| E6 MED | relay world229 in the record and Active-Arcs | FIXED |
| E7 MED | The pull request no longer merged; main had taken world230 | FIXED: main merged, DEX renumbered to world231, relayversion's duplicate world230 key found and parted - and at the push's merge, past NAME-WORDS' world231 to world232, and at the next, past GAUNTLET-PLATES' world232 to world233, and past SD-SEA's world233 to world234 at the one after |
| E8 MED | Ledger C's glow row left out the Frost Daedra | FIXED with B9 |
| E9 LOW | Section 1's delegate and hook count | FIXED with A11 |
| E10 LOW | Cites into the vendored RRI C# off (pre-dating the arc) | FIXED |
| E11 LOW | "32 records over the shared arm" - 4 of the 32 are | FIXED in the pull request |
| E12 LOW | The credit line | FIXED with A7 |

### The author's

| Id | Finding | Verdict |
|---|---|---|
| AU-1 | A1's helper was missing from one test that mounts the dungeon's code by eval (`revenant_body_loot`) - found by running all 285 such tests, not only the changed modules' | FIXED: handed in, as to the others |
| AU-2 | C1's one statement in the jump core moved two fixed-length source windows (`travelmap` U41, `audit26_dungeonfoes` F212) | FIXED: `PIN MOVED` beside each |
| AU-3 | Four older mutant records the fixes moved (`DEX3-the-reading-indoors`, `DEX4b-the-group-door-unasked`, `DEX4b-the-skeletal-door-shut`, `RVN2-claws-are-fists`) | FIXED: re-aimed by content, all dead |
| AU-4 | `fb1016b_rezbloodline` failed once under six-way concurrency and passes alone; nothing it reads moved | NOT THIS AUDIT'S (a load-timing test) |

## After

The record (`04-Characters/Enemy-Expansion.md` sections 1-3, 5-7, 9-12), Ledger A's DEX row and Ledger C's glow row,
Meaner Monsters', Ocean Holes' and Roleplay & Realism: Items' pages, the Mod Registry's row and the vendor README carry
each correction, marked AUDIT DEX. Code: `world/playerGps.js`, `combat/enemyGroups.js` (new), `scenes/corpsePrefabHost.js`
(new), the encounter and camp rolls, the group, skeletal and career readers, the abyss, the corpse mint and its marker,
the texture door, the bodies, the bands, the extractor, the equipment arm - `bootWorld`, `buildDungeonContext` and
`createExteriorFoes` under their ceilings. Tests: `dex5_audit` 8 new; dex0 to dex7 grown; mutants `dex0.json` and
`dex1.json` new, `dex2`-`dex7`, `rri2.json` grown - every list the audit touched run whole, all dead.

Owed to the owner: A3 (warn of Meaner Monsters beside DEX, or default it off) and A6 (a translatable table of a mod's
names). Answered 2026-10-20 ("We need to make everything compatible. No if ands or vutts"): A6 shipped (the names
translatable), A3 as MUDEX1 (`04-Characters/Enemy-Expansion.md` section 13).
