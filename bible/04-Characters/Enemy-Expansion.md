# Daggerfall Enemy Expansion (DEX)

Mac, 2026-10-19, handing over `Daggerfall Enemy Expansion-372-1-3-4-1708711071 (1).7z`: "I want to implement this as
our next mod 1:1. We also need to ensure these get proper morrowind model replacements if applicable".

Kamer & Kab's **Daggerfall Enemy Expansion 1.3.4** (Nexus mod 372; the Unity project is `DaggerfallBestiaryProject`,
its log tag `[DEX]`, which is this arc's code). Fifty new enemies, sixteen classic ones restatted, new encounter tables
for every dungeon and climate, four spells, the on-hit effects, a Troll that gets back up. The vendored record -
provenance, what each file is, where the art went and why - is `vendor/daggerfall-enemy-expansion/README.md`; this
page is the port's.

## 1. What the mod is, read off its own source

The bundle carries the compiled `Daggerfall Enemy Expansion.dll` and no C#; the authors publish their source
(`github.com/SquidKamer/DaggerfallBestiaryProject`), and the commit "Updated to 1.3.4" (`c187c97`, 2024-02-23) is the
shipped assembly - every string literal of its eight scripts is in the DLL's user-string heap, exactly, every member
they declare in its metadata, and every integer they name in the IL of the method that names it (AUDIT DEX A4: the
literals had been held by substring, and nothing read a constant or a branch). The eight carried are that commit's
blob for blob, so no line of them moved after it (`test/systems/enemyExpansion/dex0_record.test.js`, over the DLL and
its IL dump, `vendor/daggerfall-enemy-expansion/il/`). The
TABLES are another matter: the bundle's `DefaultTableReplacement.tdb.csv` is no commit's (`d28793f`'s with two rows
changed - a working copy was built), so the port reads the bundle's, verbatim.

The mod in DFU's terms (`BestiaryMod.cs`, cited below by line):

- **Start** (:172-197): a text provider for the custom names, then the six tables parsed - the careers
  (`.cdb.csv`, :326-589: a DFCareer per row, its eight stats, HP per level, six tolerances and four attack
  modifiers, a row naming a classic career replacing its fields), the enemies (`.mdb.csv`, :663-1345: a MobileEnemy
  per row appended to `EnemyBasics.Enemies`, or a classic one's fields replaced; a quest foe name for each new one),
  the encounter tables (`.tdb.csv`, :1633-1726) and the spellbook tables (:1884-1954) - and its hooks:
  `EnemyEntity.OnLootSpawned` (spells, forced gender, the ghost shader), four FormulaHelper overrides (`OnMonsterHit`,
  `CalculateWeaponAttackDamage`, `GetEnemyEntityEnemyGroup`, `GetEnemyEntityLanguageSkill`), the dungeon's
  transition and PlayerGPS's three events that pick a table, `EnemyDeath.OnEnemyDeath` (the Troll's corpse) and the
  `EnemyEntity.AssignEnemyEquipment` delegate (EnemyEntity.cs:133), which it sets to its own AssignEnemyStartingEquipment
  - DEX_RRICompat's arm or ItemHelper's (:2121-2131). (AUDIT DEX A11/E9: this said "five hooks" and named the mod's
  method as DFU's delegate.)
- **The first Update** (:210-269): a `Default<type>` table for each of the 19 dungeon types, the water (19) and the 18
  climate tables (20-37), built from DFU's own `RandomEncounters.EncounterTables` unless the mod's tables named one.
- **A dungeon's table** (:1728-1753, :1768-1782): on the transition into a dungeon, one of the tables for its type,
  chosen by `DFRandom.srand(Unknown2 ^ (region << 8))` - the same table every visit - and one of the water's.
- **A climate's** (:1784-1871): on a climate change or a location rect's exit, the climate's day and night tables; on
  entering a location rect, its city-night table - each `UnityEngine.Random.Range` over the type's tables.

## 2. The decisions (Mac, 2026-10-19)

- **Permission**: "Yes, record my word" - recorded in the README and the registry; the authors' own words are the
  open record.
- **The art** (`vendor/daggerfall-enemy-expansion/README.md`, Where the art is): every one of the 6,358 pictures the
  tables draw was measured against every TEXTURE record (`tools/dexExtract.mjs`). 858 ARE Daggerfall's records - the
  five unused rider sets, TEXTURE.491-495, and the Will-o'-wisp, TEXTURE.379 - and are rebuilt from the player's own
  files, never carried. 774 are Daggerfall's sprites under the authors' paint (AUDIT DEX B1, 2026-10-20: 714 until the
  Royal Knight's sixty, 1505 - TEXTURE.482's Barbarian in the authors' armour, IoU 0.63-0.89 on every one - moved over
  from the authors' own directory, where the colour measure and the hand list had let them pass), and Mac approved them on
  **Port-Doctrine's fourth exception** ("Approve 3rd exception" - asked as the third, numbered the fourth past LAYERED-GEAR's at the merge, then "Yes, cover all of them" once the measure found
  four more than the first count). The 1995 demo's four (Bat, Gargoyle, Nymph, Skeleton) are the mod's own art: the
  doctrine names the retail ARENA2 ("Mod art, ship it"). Since AUDIT DEX B1 the extractor measures every picture's
  outline too (the silhouette guard: its alpha mask against every TEXTURE frame's, IoU 0.6 a picture, a quarter of an
  archive) and refuses an archive that follows Daggerfall's outlines unless the exception carries it
  (`REPAINTED_ARCHIVES`) or this decision allows it (`SILHOUETTE_ALLOWED`: the demo's Bat, 1603, whose outline is the
  retail bat's, TEXTURE.289, on 24 of its 45 pictures) - and a listed archive the measure does not find.
- **The class skins** (SKIN2): the same measure, run on `vendor/class-skins/`, found most of its sheets to be
  Daggerfall's class sprites at their own size, not drawings at twice it - "Bring under 3rd exception": the
  exception names its directory too, and its doctrine row and README say what it is.
- **Morrowind**: "ensure these get proper morrowind model replacements if applicable" - section 4.

## 3. The slices

| Slice | What | State |
|---|---|---|
| DEX0 | the record: the vendored files, the art in its three places (the Royal Knight among the repaints, and the extractor's silhouette guard - AUDIT DEX B1), the C# held to the DLL blob for blob and constant for constant (AUDIT DEX A4), the doctrine's fourth exception, the registry row, the credit, the switch (on), the online decision (the room's, whole: Meaner Monsters' reading) | SHIPPED |
| DEX1 | the enemy registry: rows past the classic 0-42 and 128-146, the careers, the classic replacements, the names, the quest foes | SHIPPED (section 5) |
| DEX2 | the sprites on the texture door: a non-classic archive's real frame counts, the xml scales, the emission maps, NoShadow and the ghost shader by behaviour (DFU's own rows too); its pictures on the GPU alone once uploaded, as DFU imports them; the Overworld's bands dressed too - section 6 | SHIPPED (the glow's light routed, Ledger C) |
| DEX3 | the encounter tables in all four hosts: the dungeon's seeded choice, the water's, the climates' - on a door every reader asks, the climates' on PlayerGPS's events | SHIPPED (section 7) |
| DEX4 | combat: the on-hit effects, spells 500-503 and the spellbook tables, the skeletal rule, groups and languages, forced gender, ranged | SHIPPED - DEX4a (section 8: the spells, the spellbooks), DEX4b (section 9: the hit's effects, the skeletal rule, groups and languages, forced gender); ranged rode DEX1's rows |
| DEX5 | the Troll's corpse: up again after ten seconds unless a spell's missile burns it, saved with the game, the cheat | SHIPPED - DEX5a (section 11: the prefab door, the rise, the burn, the save, the cheat), DEX5b (section 11, Online: a body gone on the record, a copy's missile to the runner; relay world234 grown in place) |
| DEX6 | DEX_RRICompat: the new classes equipped by their tables under Roleplay & Realism: Items | SHIPPED (section 12: the class by its table, the armor by the career, the unknown's longblade, the Assassin's poison) |
| DEX7 | the Morrowind bodies (section 4); a NoShadow row's body casts none (AUDIT DEX B2) | SHIPPED (section 10) |
| AUDIT DEX | the arc's cold audit (2026-10-20): five lanes over the frozen snapshot `d8db6d444`, every finding proven, then fixed and pinned with a mutant or recorded - `bible/01-Overview/audits/Audit-DEX.md`; its corrections are marked AUDIT DEX in each section | DONE |
| MUDEX1 | Meaner Monsters beside DEX is MUDEX, its author's form of it for this mod (Ralzar, `vendor/mudex`): its two tables read after the mod's own, Meaner Monsters' rows, xml and PCAAO's edit of it standing aside (Mac, 2026-10-20: "We need to make everything compatible. No if ands or vutts", then "Approve MUDEX") | SHIPPED (section 13) |
| DEX-HIDES | The mod's nine Animal rows skinned by Hunting - its kin's hide, or Wolf Pelt, Boar Hide and Mudcrab Chitin (681-683); its Hell Hound, Daedra, not (FIELD BUGS 2026-10-20h, and the Discord's #feature-feedback in FIELD BUGS 2026-10-21: "the variant bats and wolves I encountered have had no option for skinning"; AUDIT FB1021 L4-12: this table had no row) | SHIPPED (section 14) |

## 4. Morrowind

Planned under DEX7 against the rules the port already keeps (`bible/04-Characters/Morrowind-NPCs.md` section 14b,
`src/characters/creatureBodies.js` CREATURE_MATCH): a new creature takes a Morrowind creature's body only where
Morrowind has that creature and it moves the same way (a flyer a flyer, a swimmer a swimmer), its CREA id read off
UESP, never recalled; a person-shaped class (the necromancers, the witches) is drawn as a person; and where Morrowind
has no such creature the row says so, and the mod's own sprite stands. SHIPPED as section 10, which AMENDS this plan
on the riders: the same law (it moves the same way) keeps their sprites - a rider's horse is its sprite's, and no
person's body rides.

## 5. DEX1 - the enemy registry

What DFU gives a mod to add an enemy, and what `BestiaryMod.Start` does with it, ported as two halves: the doors in the
port's enemy code that any mod could use, and the mod's reading through them.

**The doors** (DFU's, each at one home - ONE DFU MEMBER, ONE EXPORT):

- `characters/enemy/customEnemies.js` - `DaggerfallEntity.RegisterCustomCareerTemplate` / `GetCustomCareerTemplate`
  (an id's career, read lazily from the player's files when its base is Daggerfall's) and the text provider's
  `GetCustomEnemyName` chain. A leaf: the relay's bundle reads it through `enemyBasics.js`.
- `characters/enemy/enemyBasics.js` - `ENEMY_BASICS` is no longer frozen: DFU's `EnemyBasics.Enemies` is an array a
  mod replaces (`registerEnemyRows`, BestiaryMod.cs:1343), and a mod's edit of a classic row is written over the row
  every reader then sees. `isClassicEnemyId` (a MobileTypes member), `enemyEntityType` (SetupDemoEnemy's rule: 0-42
  a monster, 128-146 a class, any other id a monster or a class by the 128 bit when a career is registered for it,
  else no enemy) and `enemyCareerIndex` (SetEnemyCareer's: a custom enemy's index is its id). `enemyDisplayName` names
  a custom id as `GetLocalizedEnemyName` does (TextManager.cs:443-460): the custom name, else the career's own.
- `characters/enemy/enemyEntity.js` - `loadEnemyCareer`, SetEnemyCareer's one door (a registered custom career first,
  then MONSTER.BSA's, then CLASS??.CFG's): the dungeon's and the exterior's two arms read it, so a mod's monster and a
  mod's class are built on DFU's arms. `registerMintRowEditor`: a mod that edits classic rows at Start edits them over
  the rows Meaner Monsters and the overhaul compose at a foe's mint, since DFU runs every mod's Init (theirs) before a
  MonoBehaviour's Start (this one's) - the order the dungeon reads.
- **The class test is DFU's.** The sites across the hosts, the revenants, the elites, the wild, the loot, the quest
  foe and the effects that wrote `mobileType >= 128` (or `< 128`, or `<= 146`) for "a class". DFU's test is
  `DaggerfallEntity.IsClassEnemyId` (DaggerfallEntity.cs:974-977), the 128 bit, which is why the mod numbers its
  monsters 256-290 and its classes 384-398; read as `>= 128`, every one of its monsters would have been a person. Each
  site a mod's id reaches now asks `isClassEnemyId`, `enemyEntityType` or `enemyCareerIndex`; the two leaves that import
  nothing (`ai/blowShapes.js`, `systems/revenant/revenantPersonality.js`) write the bit and say so. AUDIT DEX: the
  revenant's blow class (`revenantFeud.js` adaptBlowClass) was a site the sweep missed - a mod's monster's bare blow read
  as a person's hands to a revenant's adaptation (A2) - and three stay as they are because no mod id reaches them
  (`arenaFighters.js`, King's Gambit's vanilla rows, `revenantGear.js`'s career index, the same for 384-398). One site
  was never DFU's test: Ocean Holes' abyss asks its OWN range, `EntityType == EnemyClass` and an ID of 128-146
  (`scenes/oceanHolesAbyss.js` processAbyssEnemy, read off its IL), and DEX1 had widened it to the bit - so the abyss
  took every one of the mod's classes, always, for an undead marked WasHumanoid; it is the mod's range again (C4), and
  the mod's classes are monsters to it.
- **The vanilla rows by name** (`enemyBasics.js` VANILLA_ENEMY_BASICS): the table as DFU ships it, copied before any
  mod writes a row and frozen. King's Gambit's roster reads it (`net/kingsGambit.js`): the port DECIDED its roster is
  the vanilla rows, one for every client and the relay (`11-Multiplayer/Kings-Gambit.md`), and the mod writes sixteen
  classic rows' levels and health into the live table - a client reading the gambit's module after the mod's Start would
  have built a roster the relay refuses.
- **The relay's bounds** (`net/foeBounds.js` FOE_BOUND_ROWS): the most health and level a classic monster's row can
  stand at, over seven profiles now - vanilla, Meaner Monsters, Meaner Monsters with the overhaul's edit, the mod's
  classic lines over each (`dexInstall.js` dexClassicRow, the test's fold), and (MUDEX1, section 13) the mod's lines
  with MUDEX's after them. Without it a room with the mod on would have
  had its Dragonling (146 health, the bound 60) and its Werewolf (level 9, the bound 8) refused as impossible. A row's
  third number is the level the progression share reads (`foeShare(basics.level)`, the table's row - vanilla or the
  mod's), so the relay reads no table at all and its bound is the same on every machine.
- **The wire** (`net/wire.js` FOE_TYPE_MAX, relay world234 - world225 on its branch, renumbered past main's world225-world233 at five merges; AUDIT DEX A8/E6: this said world229): a streamed foe's kind was bounded at 255, which refused
  every record of a mod's foe whole; it is MobileTypes' own u16. A peer has the rows whatever its switch (below).

**The reading** (`systems/enemyExpansion/dexTables.js`, line for line as the C# reads, every column, default, `continue`
and `[DEX]` message - a replacement career written in place as its line reads, so a throw keeps what it wrote, and a
cell past a short line a throw, not an empty cell: AUDIT DEX A10, where the port had held a row's edits to its end):
43 careers of the mod's own beside DFU's 62, the fifty enemies, the classic edits, the spellbook
tables kept raw for DEX4, and a quest foe name for each new enemy. `systems/enemyExpansion/dexInstall.js` is Start,
run once from `scenes/shared.js` right after Roleplay & Realism's install (its enemy appearance is an Init):

- ALWAYS, whatever the switch: the fifty rows join the table, each with its career and its name.
- WHILE LOADED (the switch latched at the game's load, `modSettings.js` latchModLoaded - DFU loads a mod with the game):
  the sixteen classic monsters' rows and two classic classes' (the Monk, 140, and the Barbarian, 143) edited, and the new names added to the Foes table
  (`QuestMachine.FoesTable.AddIntoTable`, only where the table lacks the name - the Nymph is Daggerfall's).

**Departures, named** (Port-Ledger section A, DEX1):

- *The rows are registered whatever the switch.* In DFU a disabled mod registers nothing, so a game saved with a
  Goblin in it and loaded with the mod off finds no row for it. Here the row stays and nothing of the mod's reaches it
  (no table rolls it, no quest names it, no hook runs), so the save loads and the world is DFU's. A peer in a room
  whose switch differs from its own draws the room's foes the same way.
- *Beside this mod, Meaner Monsters is MUDEX* (AUDIT DEX A3, MUDEX1 - section 13). Meaner Monsters' own Init looks for
  this mod by its GUID and, finding it, raises two boxes - "Please switch to MUDEX - Meaner Unleveled Daggerfall Enemy
  Expansion" and "Meaner Monsters and Unleveled Mobs is incompatible with DEX." (MeanerMonsters.cs:24, :94, :159-164) -
  then applies its edits all the same. The port makes the switch the boxes ask for, so no box is raised: with this mod
  loaded, Meaner Monsters' switch loads MUDEX, and its own rows, xml and PCAAO's edit of it stand aside.

**Flags for the slices after** (not departures from DFU, which has neither system):

- The relay's health bound (`net/foeBounds.js`) does not know a mod's careers, so a mod's own kind (256 and up) is
  *unverified* there, as every kind it holds no row for is; a class bound by the classic classes' hit points would be
  wrong for a mod's class with its own. (The mod edits no classic career, so the classic classes' bound stands.)
- The Enhanced AI's telegraphed blows (TACT4's families, `ai/blowShapes.js`) name no mod's kind: a mod's monster throws
  none, as an unnamed kind throws none, until a slice gives them families.
- King's Gambit's roster takes a monster below 128 or one of its ranged classes, by its own rule - with both mods
  loaded in DFU its roster has none of the mod's either.
- *The fifty names are in the player's language* (AUDIT DEX A6; Mac, 2026-10-20: "We need to make everything
  compatible. No if ands or vutts"). DFU's text provider answers a custom enemy's name with the mod's own English
  (BestiaryTextProvider.GetCustomEnemyName), and its enemyNames lists have no row past the classic ids, so a Goblin is
  "Goblin" in every language there. Here `enemyExpansion/dexNames.js` names each of the fifty through `t()`
  (`dex.enemy.*`, each English the mod's Name column - the test holds them equal) and the install hands that to the
  text manager's door for a mod's names (`textManager.js` registerCustomEnemyNameText, getLocalizedEnemyName's custom
  arm): the HUD's "You see" and death lines, a quest's foe, a soul's name and the troll's recovery line read the
  player's language. Every language carries a draft (the 25 tables, `claude-in-session`). The game's own English -
  the quest Foes table's keys, the save, `enemyDisplayName` - is the table's, unchanged. A departure: Ledger A, the
  DEX row.

Tests: `test/systems/enemyExpansion/dex1_registry.test.js` (the reading column by column, the C#'s slips kept - a new
class's attack sound written to its bark - the careers' tolerances and attack modifiers read back, Enum.Parse's rules,
the install's two halves, DFU's mod order over Meaner Monsters, both build arms, the quest foes; with ARENA2, a career
borrowed from Daggerfall's files is a copy; the vanilla rows untouched by the install; AUDIT DEX: the Necromancer
Assassin's two ranged attacks and the classic ranged classes' under the mod, the hosts' monster and class arms by
SetupDemoEnemy's type, the revenant's blow class, a replacement career's error paths), the abyss's range with the
mod's classes (`test/scenes/oh_abyss.test.js`), the bounds' six profiles (`test/net/foebounds_law.test.js` - seven since MUDEX1), the
wire's pins (`auditworld6b.test.js`, `oncrash1.test.js`), and the moved source pins and mutant records (`dex1.json`,
whose arms had none until AUDIT DEX A5).

## 6. DEX2 - the sprites on the texture door

DFU draws a custom enemy from its archive's imported textures (`TextureReplacement.GetMobileBillboardMaterial`): each
record from frame 0 to the first frame missing, a frame's `_Emission` map beside it, and the archive xml's scale on its
size. `systems/enemyExpansion/dexSprites.js` registers every picture DFU would import, from its one place - the authors'
own, the fourth exception's repaints, or rebuilt from the player's files (`derived.json`) - as the stand-in archive it is
(no TEXTURE file carries 1500-1617), whatever the switch, as the rows are.

- **The import, in the index.** `tools/dexExtract.mjs` now writes `frames` as DFU imports them: the bundle has gaps -
  1500's record 14 holds frames 0 and 7, its record 4 lacks frame 2 - and a picture past a gap ships and is never drawn,
  as in DFU. `emissive` is by frame (record -> frames): 1614's record 20 has no map for its frame 2.
- **A stand-in's frames** (`textureReplacement.js` vendorFrameCount): the stand-in answered one frame for every record,
  which no vendored art had needed until a mod's enemies walked - every mobile drawn from a stand-in stood on its first
  frame. It answers the registry's frames now, frame 0 to the first missing, cached until a registration moves the tiers
  (pinned at AUDIT DEX B10).
- **The xml's scale** (`world/rmbFlats.js` mobileBillboardSize): DFU's mobile unit lays it on every record under
  AssetInjection, and DFU draws a mod's enemy only under AssetInjection. The port's vendored art draws ungated, so a
  stand-in's xml applies whatever the switch (the riders at 1.3, the Barbarian at 0.385 x 0.365); a classic sprite's
  still waits for the switch (Meaner Monsters' werewolf). The xml-applied size is one cached object per texture and
  record (AUDIT DEX B7: two were minted per foe per frame), kept while the same live table entry answers under the same
  registrations (`world/billboardXml.js` billboardXmlScaleOf, billboardXmlGeneration); a registrant's switch is still
  read at every ask.
- **The emission** (`scenes/dataPipeline.js` uploadRecordFrame): an imported frame's `_Emission` map is uploaded under
  the frame's own key and lit white, as DFU's material is; an archive whose xml asks for emission lights a frame with no
  map of its own by its albedo (1614_20-2, the Hell Hound's corpse - a flat, so GetStaticBillboardMaterial's
  `emission ?? albedo`, TextureReplacement.cs:541; AUDIT DEX B9: this cited the mobile's material, whose fallback is the
  record's whole - frame 0's map missing, every frame its albedo, :633-640 - and no mobile record of 1.3.4 lacks a
  frame's map) - the registration hands the albedo in as the map.
- **The pictures are the GPU's once uploaded** (AUDIT DEX B5; TextureReplacement.cs:574, :609 import a mobile's pictures
  `readOnly: true`): every DEX entry registers `readOnly`. An archive is decoded whole at its first load, as DFU imports
  it, and each picture's CPU copy is let go as the upload takes it (`textureReplacement.js` decodedTexture), its size kept
  for the stand-in; the 5,500 pictures are ~350 MB of RGBA, and the Barbarian's 1507 and 1508 held 86.2 MB for the
  session - now none once drawn. A frame whose GPU copy PLACE-LRU evicted draws nothing for the moment its decode takes
  (a pending picture the renderer keeps nothing for; the decode asked only for an empty key, its emission map first, a
  failed one not again until the tiers move).
- **The corpse's picture by gender** (AUDIT DEX A1; EnemyDeath.cs:86-93): a female's corpse is the row's
  FemaleCorpseTexture where it names one - the riders' 1530, the Dark Slayer's 1514, every Thief Rider (its gender
  forced) - and its CorpseTexture otherwise (`scenes/corpseMarker.js` corpseTextureOf, at every corpse mint). The
  reading wrote the field and no mint read it: the female riders died as the male corpse.
- **A corpse of more than one frame animates out of doors** (AUDIT DEX B3): the street's and the interiors' corpse marker
  carries its clock (`corpseMarker.js` tickCorpseMarkers), as the dungeon's flats always did - the Hell Hound's
  burning corpse had stood on its first frame outside a dungeon.

**SetupDemoEnemy's renderer** (`SetupDemoEnemy.cs` :129-151), for DFU's own rows as much as the mod's - the port had
never drawn either for a classic enemy:

- **The ghost shader by behaviour** (`characters/enemy/foeLook.js` setupFoeLook, `render/renderer.js` ghostShaded): DFU
  lays it on a Spectral row's mobile (cutoff 0.1, alpha blended); the port keyed it to the classic ghosts' archives, which
  a mod's spectral enemy - the Gloom Wraith, the Faded Ghost, King Lysandus, the Will-o'-wisp, each on an archive of its
  own - never matched. The classic Ghost and Wraith are the only Spectral rows, on exactly those archives, so nothing
  classic moves. The mod's `Transparent` property lays it on a non-spectral enemy (BestiaryMod.cs:1394-1402, while the
  mod is loaded - `registerFoeGhost`); no row of 1.3.4 sets it. The shadow pass casts no ghost, as it cast no classic one.
- **NoShadow**: the mobile's batch casts none (the shadow pass's own `noShadow`), nor its Morrowind body where one
  stands (section 10, AUDIT DEX B2).
- The hosts wear both where they make the batch (`setupFoeLook(renderer.createBillboardBatch(...))`, the dungeon's two
  arms and the street's pool, and the Overworld's bands - `world/bandSprites.js`, AUDIT DEX B6: a band of the
  Will-o'-wisp, the Faded Ghost or the classic vampires stood opaque and cast) - an expression, so no host grows.
- **GlowColor's light is routed** (Port-Ledger C, AN ENEMY'S GLOW): a `LightAura` light at (0, 0.3, 0.2) in the row's
  colour, whose range and intensity are the prefab's - the editor asset, which no copy of DFU this work could reach
  carries. It is read before it is built, never guessed.

Tests: `test/systems/enemyExpansion/dex2_sprites.test.js` (every imported picture from its one place, none past a gap;
the stand-in's frames; the xml ungated on a stand-in only; the emission's two sources; the billboard pass drawing a
Spectral row's mobile as its ghost at both sites (AUDIT DEX B4); the bands' look; the cached xml size; the pictures let
go once uploaded (1507: 45,979,280 bytes to none)), `dex0_record.test.js` (the index held to DFU's import), the
corpse's picture by gender and its clock (`dex5_audit.test.js`), mutants `tools/mutants/dex2.json`, `dex0.json`.

## 7. DEX3 - the encounter tables

The mod ships one table database (`DefaultTableReplacement.tdb.csv`): a line for each of the 38 tables it has a default
for - the 19 dungeon types, the water, the six climate families' city night, day and night - with its own monsters in
them, and a second Laboratory table, `DwarvenLab`. `dexTables.js` reads it as `ParseEncounterTables` does
(BestiaryMod.cs:1633-1726, line for line: a replacement moves only to other, named indices; a new table joins its
indices before its ids parse; a short line, a short header, a new table with no indices refused; a table's name in any
case, the C#'s dictionary being OrdinalIgnoreCase (:88), while its RemoveAll stays ordinal - AUDIT DEX C8) and adds the
first Update's defaults (:210-269), DFU's own tables copied for an index the mod names no default for - none, for 1.3.4.

**The door** (`characters/encounterTableDoor.js`). DFU's tables are an array a mod writes in place (`ref
RandomEncounters.EncounterTables[index]`), and every reader rolls from what it wrote; the port's array is DFU's,
generated and untouched, and a mod registers a selector that every reader asks through `encounterTable(index, place,
rolls)`:

- **The player's own rolls** - the encounter decision, the dungeon's rest, the camps' (`systems/encounters.js`
  playerReading marks them `local`) - read the table as the mod's events wrote it, DFU's own where they wrote none.
  DFU has no other kind of roll.
- **A dungeon's population** (`characters/dungeonEnemies.js` collectDungeonEnemies, handed `dungeonPlace(dfLocation)` -
  its LocationId and its seed) reads its type's table and the water's.
- **Any other roll is one every machine must agree on** - a granted member's species (`scenes/grantHost.js`), a
  roaming band's make, a road's trouble (`systems/livingWorld/trouble.js`). A machine's events are its own (the mod
  picks a climate's table by `UnityEngine.Random` as its player walks), so such a roll reads none of them: it reads one
  of the mod's tables for the index by its own die, and spends no draw where there is one (DFU's alone, or a mod's
  single table) - the roll it always was. A reader bounding a granted species takes every table the mod may pick.
  None of these readers is DFU's, so none is a departure from it; the shipped tables give every index but the
  Laboratory's one table, so only a trouble on the road to a laboratory draws for it.

**The picks** (`systems/enemyExpansion/dexEncounters.js`):

- **A dungeon's** (SelectDungeonTable, :1728-1753): on `PlayerEnterExit.OnPreTransition` into it - a door and a load
  alike (PlayerEnterExit.cs:914, :975) - one of its type's tables and one of the water's, each by
  `DFRandom.srand((ushort)Unknown2 ^ ((byte)region << 8))` and one `rand() % count`: the same pick every visit, on every
  machine. The transition always comes before the layout, and the population reads the two tables first, so the pick
  is made at that read; the rest roll then reads what it wrote. Of MAPS.BSA's 190 laboratories, both tables are picked.
  PreTransition's `Enum.IsDefined(DungeonTypes, ...)` guard has no arm: all 4,232 dungeons have a defined type.
- **A climate's** (SelectClimateTables and the rect's handlers, :1784-1871): a climate change or leaving a location's
  rect picks the climate's day and night tables, entering one its city night, on PlayerGPS's events.

**PlayerGPS's events** (`world/playerGps.js`). DFU raises `OnClimateIndexChanged`, then `OnEnterLocationRect` or
`OnExitLocationRect`, on the edges of the player's reading each frame (PlayerGPS.cs:561-576, :669-716), its trackers
starting at climate 0 and out of a rect - so the first frame raises the climate, and its entry if the player stands in
a town; and ResetState (:398-401), raised on a new game, a load's start and a fast travel's end (:301-303), drops the
rect flag again, raising nothing. The port's reading of the player's place is the encounter law's own: the decision and
the camps' rolls raise the events from their place, every minute they run out of doors (the hosts already hand them the
climate and the widened rect), so no host polls a second copy - bootWorld stands at its ceiling, and nothing about
DFU's events needs a frame the rolls do not have. Two corrections at AUDIT DEX:

- **ResetState is carried** (C1, `playerGps.js` resetPlayerGpsState): the jump core hands the GPS every jump's kind
  where it drops the host's own flag (`scenes/world.js` _teleportToPixel, `modEvent`), and the module resets on the two
  that name a DFU event - a load and a fast travel (`RESET_ON`, PlayerGPS's subscriptions; the rule moved out of the
  host at DEX's merge, `01-Overview/Host-Split.md`); a Recall, a guild's teleport or a respawn names none and keeps it,
  as DFU does. A new game is the page's
  boot, where the trackers start. Without it, a fast travel from one town into another climate's raised no entry, and
  the mod's city night for that climate was never drawn - the town's night rolled DFU's table, or the one the index
  last held.
- **One reading of the rect** (C7): the chunk-load camps (`campEncounters.js` rollCampEncountersOnChunkLoad) hand
  PlayerGPS their pixel's climate and no rect. Their `inLocationRect` is the camp gate's ring of any town about the pixel
  just entered (DISC19-F), not PlayerGPS's rect of the pixel's own location, which the minute's roll reads - fed both,
  the one tracker edged between two readings: an entry, then an exit, the player never made.

Departures (Port-Ledger A, the DEX row - SCOPE1's rule, each named):

- **The generator is put back.** DFU leaves DFRandom where the dungeon's pick left it; the port's pick stands inside
  the population, ahead of the fill's own srand, so it restores the shared stream.
- **The events ride the rolls' minutes**, not every frame: events between two readings are seen as one edge - a town
  walked into and out of inside one minute raises neither, where DFU re-draws its city night and then its day and night.
  With 1.3.4's tables - one an index outside the Laboratory - every such draw writes the same table. (AUDIT DEX C1
  struck this item's second half: it said a load or a fast travel raised no second entry and that the draw was the same
  either way, which held only for the town left, never for another climate's.)
- **A table whose ids will not parse** stays in its index's list and a pick that lands on it writes nothing (the C#'s
  `Select` throws before the write). Thrown in a PlayerGPS handler, DFU's throw also ends that frame's GPS update and
  raises the event again next frame; the port does not copy that stall. No table of 1.3.4 fails to parse.
- **The defaults are added at the read**, where DFU adds them at the mod's first Update, whose order against
  PlayerGPS's first Update is Unity's. 1.3.4 names all 38, so none is added.

Tests: `test/systems/enemyExpansion/dex3_encounters.test.js` (the reading line for line, the defaults, the dungeon's pick
against the C#'s LCG and with ARENA2 over every dungeon, PlayerGPS's edges, the climates' picks, the door's two reads,
every reader through it - the decision, the rest, the camps, a group's one table, a granted species, the population -
and the install; AUDIT DEX: ResetState at the jump core and the city night it draws, the chunk's climate-only reading,
the camps' two called rolls (C5: the pin had read an export nothing calls), the dungeon's place handed to its
population, the names in any case), mutants `tools/mutants/dex3.json`.

## 8. DEX4a - the spells and the spellbooks

**The standard spells** (`systems/spell/standardSpells.js`). DFU builds them once - `EntityEffectBroker
.RebuildClassicSpellsDict` reads SPELLS.STD, merges every enabled mod's `SpellRecords.json` into the list
(`TextAssetReader.Merge`, matched by index), and folds it first-wins - and every list reads that one. The port read
SPELLS.STD and folded it in two places (the hosts' magic registries, chargen's); both build it in the one place now.
The merge, item by item in the mod's order: the first record of the item's index takes the item's fields over its
own; an index the list lacks is a new record off SpellRecordData's defaults (a name of `""`, every number -1, three
blank effects) with the item's fields on it, appended; `effects`, where named, is the item's array whole, each effect
EffectRecordData's zeros under its fields. The mod's four are new indices - 500 `!Blood Leech`, 501 `!Daemon Touch`,
502 `!Wrack`, 503 `!Bolt of Vengeance` - hidden from every shop by their `!`, as DFU hides them. Their cost is the
default -1, which nothing reads: a cast is priced off its effects (`spellcost.js` calculateCastCost), as DFU's is.

**The spellbooks** (`systems/enemyExpansion/dexSpells.js`). `ParseSpellbookTables` (BestiaryMod.cs:1884-1954) names
thirteen one-book tables - DFU's own thirteen career lists, which the C# restates - and `Class`, a ladder of seven
books by level that is DFU's `EnemyClassSpells[min(6, level / 3)]`; a row's raw `Spellbook` cell is a table named
after its id. At a foe's spawn (`SetEnemySpells`, :1404-1447, on EnemyEntity.OnLootSpawned) a row naming a table
casts the table's book for its level - the last whose `minLevel` the level reaches - in place of DFU's list; a level
no book reaches, or a table no one made, leaves DFU's. The port's door is `systems/enemySpells.js`
registerEnemySpellbook, asked first by `enemySpellIndices` - the one source every reader of what a foe casts reads:
its spawn, a peer's puppet cast resolved, a grant's copy at its owner's level. Of 1.3.4: the Homunculus, the Medusa,
the Snow Wolf, the Hell Hound, King Lysandus (503, the Bolt of Vengeance), the Dremora Churl and the Scamp cast raw
books; the Fire Daemon the FireDaedra table; the six spellcasting classes the ladder, which casts what DFU's would.

**The wire** (`net/wire.js` SPELL_INDEX_MAX): a cast's spell index rode as a u8, SPELLS.STD's; a foe casting one of
the mod's spells was refused whole. It is a u16 now - relay world234, grown in place (not yet deployed; world230 until main's OW-CHASE-RANGE took that number, world231 until NAME-WORDS did, world232 until GAUNTLET-PLATES did, world233 until SD-SEA did at the merges).

Departures (Port-Ledger A, the DEX row):

- **An unknown table is said once**, at the install, for each row naming one; the C# says it at each spawn. The door
  is asked by every reader of a foe's spells, not the spawn alone. No row of 1.3.4 names one.
- **A class that does not cast magic and names a table** would have its magicka set by the port's `setEnemySpells`
  (10 x level + 100, its magic skills at 80), where DFU leaves a class's that never went through `SetEnemySpells`. No
  row of 1.3.4 is one: every class naming a table casts magic.

Tests: `test/systems/enemyExpansion/dex4a_spells.test.js` (the merge field for field, the list with ARENA2, the tables
against the C#'s own arrays, the door, the install, the wire), mutants `tools/mutants/dex4a.json`.

## 9. DEX4b - the hit's effects, the skeletal rule, groups and languages, the forced gender

The mod's Start registers four FormulaHelper overrides (BestiaryMod.cs:183-186), and its OnLootSpawned handler forces
a row's gender. `systems/enemyExpansion/dexCombat.js` holds them; each rides a door of DFU's own shape.

- **OnMonsterHit** (`systems/diseases.js`). DFU's own asks `TryGetOverride("OnMonsterHit")` first and runs a mod's in
  its place (FormulaHelper.cs:1265-1270); the port's does now. DFU's switch is nine arms - numbered as the mod's `OnHit`
  column numbers them, the order its chain tests them in - and the mod's override is that switch become a chain
  (:1477-1561): each arm taken where the attacker is its classic monster OR its row names the arm's number, in order.
  So a classic GiantBat whose row named 1 would bite as the Rat, a Rat whose row named 3 stays the Rat. Arms 10-13 are
  the mod's own, each readying a spell on the attacker: the Blood Spider's Blood Leech (500), the Gloom Wraith's
  Silence (23), the Fire Daemon's Daemon Touch (501), the Will-o'-wisp's Wrack (502). The Lizard Man and Lizard
  Warrior take the spider's touch (3), the Bat the giant bat's disease (2), the Nymph the fatigue (5), the Ghouls the
  zombie's disease (7). The hosts' spider closure `castParalyze` is `readySpell(index)` - SetReadySpell for any
  standard spell, as DFU's is.
- **The Skeletal Warrior's rule** (`combat/formulas.js` isSkeletalTarget). The mod's CalculateWeaponAttackDamage is
  DFU's body with one test widened: a row whose Affinity reads `Skeletal` (the Skeletal Soldier) takes the Skeletal
  Warrior's blunt halving and silver doubling. The port takes the test as a door in the stock formula, so its own
  terms (a weapon's modifiers, the blow modifiers) stand under the mod. PCAAO's core - on by default - runs its own
  copy and never asks it, as DFU's PCAAO, replacing CalculateAttackDamage whole, never calls the overridden one.
  AUDIT DEX C2: the mod's test REPLACES DFU's, never widens it. Its override asks the enemy's ID (`MobileEnemy.ID ==
  SkeletalWarrior`, :1594) where DFU asks its career (`CareerIndex`, FormulaHelper.cs:740), whose class collision makes
  a Barbarian (143, career 15) a skeleton; the door answered only true, so DFU's career test stood beside it and the
  Barbarian kept the rule under the mod. A door's answer now stands alone (null leaves DFU's), and the mod's is its own
  whole test - the Skeletal Warrior by its ID, or a Skeletal row.
- **Groups and languages** (`combat/formulas.js` registerEnemyGroup, registerEnemyLanguage). The fifty's from their
  rows - None included, over DFU's Etiquette for a class - and DFU's switch, which the C# restates, for every other.
  A mod enemy's career index is its id, so the door keys on it. AUDIT DEX C3: every reader asks the one door.
  EnemyEntity.GetEnemyGroup IS this member (EnemyEntity.cs:486-489), and PlayerGPS.GetEntityFlags (:788) and
  PacifyEffect.IsGroupMatch (:132) read it - but `systems/nearbyObjects.js` held a copy of DFU's switch, so the mod's
  enemies took no group there: no Detect Undead found its Dire Ghoul, no Pacify Animal calmed its Blood Spider, no
  Dispel Daedra banished its Fire Daemon. The switch and its door are one leaf now (`combat/enemyGroups.js`;
  `formulas.js` re-exports them), and the scan's flag is read through it.
- **The forced gender** (`characters/mobile/mobileUnit.js` registerForcedGender). Over whatever the unit resolved,
  after its DFRandom roll - never instead of it, so the stream moves as it did. Of 1.3.4 ten rows force one; each
  draws one picture for both genders, so the voice is all it moves.

Departures (Port-Ledger A, the DEX row):

- **The forced gender picks the picture too.** DFU's unit chose its archive by the rolled gender before the handler
  ran (a reload takes the forced one's); the port forces it where the unit resolves it. Every forced row of 1.3.4 has
  one archive for both.

Tests: `test/systems/enemyExpansion/dex4b_combat.test.js` (every arm told apart by its transcript, DFU's switch and the
C#'s chain read off the vendored source, the mod's arms against BestiaryEnemySpells.cs, the override replacing the
whole, the skeletal rule, the groups and languages, the gender over the roll, the install; AUDIT DEX: no Barbarian a
skeleton under the mod, the mod's groups through Detect's scan and a Pacify, both hosts' rider spells read from the
merged spell list - C6), mutants `tools/mutants/dex4b.json`.

## 10. DEX7 - the Morrowind bodies

Mac, 2026-10-19: "We also need to ensure these get proper morrowind model replacements if applicable". The mod has no
Morrowind half - DFU draws its sprites - so this is the port's own, on the law the classic table keeps
(`Morrowind-NPCs.md` section 14b, AUDIT MW-NPC D4/D5): a monster takes a Morrowind creature's body where Morrowind has
that creature and it moves as it does; a person stands as a person; anything else is a declared miss, and its sprite
stands. `systems/enemyExpansion/dexBodies.js` holds the table, registered whatever the switch (the fifty's rows and
pictures are there either way, and a body is how a row is drawn).

- **The doors.** `characters/creatureBodies.js` registerCreatureMatches: a mod's rows past the classic ids, read by
  creatureLook after CREATURE_MATCH, which stays the census of DFU's own. A row is refused where the classic audits
  would refuse it - a match and a miss, ids not as the reader keeps them, a flyer without `flies`, any swimmer, a
  class's mobile, a mobile named twice. `characters/foeBodies.js` registerPersonFoes: a monster that is a person
  (`{ race }`, drawn in that race's body as an orc is in the Orc's - isPersonFoe, foeLook, rosterLook) or a class that
  keeps its sprite (`{ sprite }`).
- **Matched** (the ids read off the Elder Scrolls wiki's creature pages, 2026-10-20 - UESP refuses the container):
  Goblin (`goblin_grunt`, Tribunal's), Wolf (`bm_wolf_grey`), Snow Wolf (`bm_wolf_snow_unique`, else the grey),
  Troll (`bm_ice_troll`, the grahl - Morrowind's only troll), Boar (`bm_frost_boar`, the tusked bristleback), Mudcrab
  (`mudcrab`), Ogre (`ogrim`), Dremora Churl (`dremora`), Stone Golem (`atronach_storm`), Dire Ghoul
  (`bonewalker_greater`, else `bonewalker`), Scamp, Centurion Sphere and Steam Centurion (their own). Where a classic
  monster is the same creature the row is the classic row: the Skeletal Soldier the Skeletal Warrior's, the Iron and
  Ice Golems the Iron and Ice Atronachs', the Ghoul the zombie's bonewalker, the Gloom Wraith and the Faded Ghost the
  veiled ancestor ghost (MWNPC13 - a wraith in another archive is a named spectral and keeps it).
- **Declared misses**: the Homunculus and the Bat (flyers; no Morrowind one), the Will-o'-wisp, the Land Dreugh
  (Morrowind's swims; this one walks), King Lysandus (a named spectral, MWNPC13), and every beast Morrowind has none
  of - the Medusa, the Hell Hound, the Grotesque, the Dog, the Nymph, the Minotaur, the Blood Spider, the Fire Daemon,
  the Mountain Lion (the classic nymph's, spider's and sabretooth's misses, word for word).
- **The people.** The Lizard Man and the Lizard Warrior are Argonians - Morrowind's lizard folk are people - dressed
  from their own equip table under the Bay's clothes, as an orc is; SetEnemyCareer's table arms no monster of the
  mod's (`combat/enemyEquipment.js` equipmentVariantFor), so they stand bare-handed where the sprite shows a shield
  and blade. The fifteen classes are people by the class law; the five RIDERS (Knight, Rogue, Thief, Spellsword and
  Archer) keep their sprites.

- **A NoShadow row's body casts none** (AUDIT DEX B2; SetupDemoEnemy.cs:137-140): the flat's `noShadow` (setupFoeLook)
  rides `characters/foeBodies.js` foeFx to the body, and `net/peer/peerBodies.js` cast reads it - the classic vampires
  (28, 30), the frost and fire daedra (25, 26) and the fire atronach (35) threw their bodies' shadows while their
  billboards, cast-only, were passed over. A corpse's flat carries none of the row's: DFU's NoShadow is the mobile's
  renderer, and a corpse is another billboard.

Departures (Port-Ledger A, the DEX row):

- **The bodies are the port's.** DFU draws the mod's sprites; the port stands a Morrowind body where the rules above
  find one - the arc's own ask.
- **A lizard man stands unarmed.** Its sprite carries a shield and a blade that DFU's entity never holds; the body
  wears what the foe wears (MWNPC5b), as every person's does.

Tests: `test/systems/enemyExpansion/dex7_bodies.test.js` (the census by the mod's own names, the motion law, the people
and the riders, the looks at the door with the switch either way, the doors' refusals, once a page; a NoShadow row's
body casting none, DEX7-7), mutants `tools/mutants/dex7.json`.

## 11. DEX5 - the Troll that gets back up

The mod ships a PREFAB for the Troll's corpse picture (`1618_20`), and DFU stands it in the corpse's place
(MeshReplacement.ImportCustomFlatGameobject, through CreateLootContainer). What it is, read off the bundle and the mod's
three scripts (BestiaryTrollCorpseBillboard, BestiaryTrollCorpseEntity, BestiaryTrollCorpseSerializer, and
BestiarySaveInterface):

- **Its components.** The imported json carries the mod's two; the prefab's own GameObject carries DFU's - a
  DaggerfallEntityBehaviour of type **None**, an **EntityEffectManager** and a **trigger** sphere of radius 1
  (`vendor/daggerfall-enemy-expansion/Prefabs/1618_20.components.json`, written by `tools/dexExtract.mjs` out of the
  bundle). So a blade or an arrow does nothing to it (WeaponManager.WeaponDamage harms only an enemy-typed entity), a
  touch spell and an explosion's overlap never find it (both ignore triggers), and a spell's MISSILE that meets the
  sphere assigns its bundle to the body's entity: health 1 of 1, the troll's career, every stat 50, level 0.
- **No loot.** PostParentedSetup destroys the loot container's DaggerfallLoot: the body is never searched, and what the
  troll carried goes with it.
- **The rise.** Ten seconds (the prefab's RespawnTime) of game time, frozen while `Cheat.DisableTrollRespawn` is on; then
  a NEW troll of the dead one's kind stands where the body lay (CreateEnemy - hostile, no quest's, no save's), the body
  is destroyed and the HUD says "The Troll has recovered from its injuries."
- **The burn.** A bundle that brings the body to 0 says the death ("Troll just died.", DisableEnemyDeathAlert its gate -
  the kind's name, never a champion's: the body knows its MobileID alone), stands the ash (1618/21) by its CENTRE 0.1
  over the body's foot and destroys the body: gone for good. Fire is the troll's critical weakness (no save), magic,
  frost and shock its resistances (CareerBase).
- **The save.** Every body still down, with its time left; a load sets each again (one with none left is skipped).

The port's half:

- **The door** (`scenes/corpseMarker.js` registerCorpsePrefab, createCorpsePrefabs): a mod registers a prefab for a
  corpse's archive and record while it is loaded (AssetInjection reads a loaded mod's bundle alone); each foe host builds
  one runner over its reach (`runs`, `body`, `rise`, `vanish`, `toAsh`, `send`, `say`, `key`), mints the prefab at its corpse mint on every
  machine (a copy's body is its owner's), drives it on its foes' clock and its magic rounds (OnNewMagicRound - every
  EntityEffectManager), and drops it with itself. The player's missile meets a prefab's trigger after the living foes
  (`scenes/hostMagic.js`, `corpsePrefabStruck`); a peer's drawn missile stops where its caster's does. An executed
  revenant's body is the port's own fate and takes no prefab.
- **The troll** (`systems/enemyExpansion/dexTroll.js`): the prefab's values read off the vendored json; the body's entity
  through the port's own AssignBundle (`systems/effects.js` applySpell - its saves against the troll's career, a lasting
  effect's first round now and its later ones in the magic rounds); the record on DFU's mod save slot
  (`systems/modSaveData.js`), a time handed back for a body not stood yet kept until it is (a quickload restores the mod's
  record before the foes).
- **The dungeon** (`scenes/dungeonContext.js`): its runner the foe's (the seat, a loose foe's owner); a rise a new LOOSE
  foe (spawnLooseFoe) where the body lay, the dead one staying dead with no body (`corpseDestroyed` - its save writes no
  body, as REVENANT-FATE's); the ash a flat the level keeps; a layout body's time saved by its slot. Its loot gate
  (`lootableBody`) honours a disabled body.
- **The street, the interiors, exterior.js** (`scenes/exteriorFoes.js`): its owner counts; a rise a new foe by the
  slot-neutral replacement (`spawnFoe`, `replacing`), the body gone as removeCorpse takes one; the ash takes the body's
  place as its marker (moved with the origin and the ground, collected with its pixel; it stands no Morrowind body).
- **The hosts wire the reach** (AUDIT DEX D11, HOST-SPLIT): what a body's prefab asks of its host - stand a new foe,
  take the body away, stand the ash, send a copy's missile - is `scenes/corpsePrefabHost.js` (createDungeonCorpsePrefabs,
  createStreetCorpsePrefabs); the hosts hand it their doors and nothing more.

**What AUDIT DEX found the body owed** (`bible/01-Overview/audits/Audit-DEX.md`, lane D):

- **The rise stands first** (D8): the new troll is asked for, and only once it stands is the body taken and the HUD
  told - a stand refused (an online grant withheld, a build that failed) leaves the body lying, to try again after its
  time; no missile meets a rising body. The body had gone before the stand was certain.
- **A body's fate is saved and remembered** (D3, D4): the dungeon's save writes a destroyed body's kind (`bg`, 1 risen,
  2 burnt) and the room's memory keeps it on a dead record (`net/wire.js` validSharedFoe - world234 grown in place, not
  yet deployed), so a burnt troll no longer stood again for an arrival; the seat loading a save of a gone body settles
  every copy's (`settle`) rather than lay a ghost body on them.
- **A load lays the save's body again** (D1): a same-dungeon quickload after a rise or a burn lays the body the save
  holds, its time the save's (`forget`, then the corpse mint), and the rebuild takes every ash flat (`clearAsh`) - the
  ash is no saved object (BestiaryTrollCorpseEntity.cs:65-66); a load had laid no body at all.
- **Un-death forgets** (D2): a foe standing up again (SL2's rewind) forgets its body's fate, so its next death lays a
  body; it had lain invisible and risen anyway.
- **A street copy goes at its owner's word** (D6): a copy with no prefab of its own drops its marker when told the body
  is gone. **The own lane's `cs` takes a living blow's gate** (D7): the loose foe's owner checks a copy's missile as it
  checks a copy's blow. **A destroyed host lets its prefabs go** (D12): their foe records and the host's reach no longer
  wait in the runner until the next save.

**Online (DEX5b).** The room is the mod's whole (DEX0's decision), and the body is its foe's runner's - the seat or a
loose foe's owner underground, the foe's owner in the street:

- **The runner alone counts, rises and burns.** A copy of the body is no loot either (it is the same prefab, minted at
  every machine's corpse mint; the street's owner says no pile on it, `o` 0) and never counts.
- **A copy's missile goes to the runner** (`send`): the bundle as STRIKE-SHARED carries a spell (`sp`, `lv`), marked
  `cs`, by the lane its foe rides - the seat's number or a shared encounter's (applyHit), a loose foe's owner's
  (applyOwnHit), the street owner's (applyHit) - and the runner lands it on its body's entity.
- **The record says a body gone** (`bg` - 1 risen, 2 burnt; `net/wire.js` validFoeRecord, a dead record's alone), so
  every copy loses the body as the runner did (`told`) and a late one too. Underground a destroyed body's record rides
  on in every lane (a layout foe's always does; a shared encounter's and a loose foe's now do too), the ash a flat each
  machine stands - for a late joiner, a layout foe's alone: a shared encounter's and a loose foe's dead record is never
  stood for a machine that never saw it standing (`dungeonContext.js` - `if (r.d === 1 || ...) continue;`), so it
  stands no ash for one (AUDIT DEX D13: this said every lane's); in the street a risen body's record ends with it
  (removeCorpse - every copy pruned) and a burnt one's rides on with the ash as its body. A body told gone while its art
  warmed never lands.

Departures (Port-Ledger A, the DEX row):

- **Only my spell's missile reaches the body.** DFU's trigger stops EVERY missile and arrow that meets it - an enemy's
  spell aimed past it burns it, an arrow vanishes into it harming nothing, and DFU's bounding-box melee may spend a swing
  on its entity and land nothing. The port's enemy missiles, arrows and blows read the living alone.
- **The street saves no body** (snapshotWorld: "Dead foes stay out" - every body outdoors), so a troll down outdoors at a
  save is gone on its load, where DFU stands it again with its time.
- **A troll that rose outdoors is saved standing**, as every street foe is; DFU's (CreateEnemy, LoadID 0) is in no save.
  Underground the port matches DFU: a loose foe is no foe a boot load stands again.
- **A loose troll's body underground keeps no time in a save** (its slot is no layout's) - a load lays none for it
  anyway.
- **Online, the room's (no DFU half):** a copy's bundle lands at the runner with no caster of its own there (the striker
  is in another world), so a Transfer's heal-back and a reflection reach nobody; and when the seat changes hands, the
  new runner counts a body's ten seconds from its own start (its copy never counted) and its body's entity is fresh - a
  lasting effect on the old runner's (a Frost Rot's rounds) goes with the old seat. The HUD's two lines ("... has
  recovered from its injuries.", "Troll just died.") are the runner's alone (`host.say`): a copy whose missile burnt the
  body hears nothing, and the runner, wherever it stands, is told (AUDIT DEX D9 named these two).
- **The restored body is the troll's** (AUDIT DEX D10 named it): the mod's body after a load is built from a default
  BestiaryTrollProperties (MobileID 0, ash 0/0 - BestiaryTrollCorpseBillboard.cs:37, :284-287), so SetEntityDefaults finds
  no custom enemy 0 and its career stays a blank DFCareer, and RestoreSaveData puts back the MobileID and the heights
  alone (BestiaryTrollCorpseEntity.cs:105-111): in DFU a reloaded body has no fire weakness and no resistances, and
  burns to billboard 0/0. The port's restored body keeps the troll's career and the 1618/21 ash - the mod's slip
  corrected.

Tests: `test/systems/enemyExpansion/dex5_troll.test.js` (the prefab read off the bundle and the scripts, the body's
entity against the troll's career, the street's rise and burn through a real pool, my real missile on the trigger, the
door, the save, the hosts' wiring; DEX5b: the wire's bound, two real pools - a peer's missile burning the owner's body
and its copy turning to ash, the rise taking the copy away - and the dungeon's lanes), `dex5_audit.test.js` (AUDIT
DEX, over the dungeon's real corpse chain: the rise that asks, un-death, a load's body and its ash, the fate saved and
remembered, a street copy's marker, the corpse's picture by gender and its clock, the hosts' wiring), mutants
`tools/mutants/dex5.json`.

## 12. DEX6 - the equipment

BestiaryMod.Start takes `EnemyEntity.AssignEnemyEquipment` over (BestiaryMod.cs:194, :2121-2131): while Roleplay &
Realism: Items' `realisticEnemyEquipment` is on, the mod's own copy of RRI's class arm kits a foe
(`Scripts/Compatibility/DEX_RRICompat.cs`), and ItemHelper's arm does while it is off. RRI writes the delegate in its
Awake (inside its Init) and the mod in its Start (a frame later), so the mod's is the one that stands whichever loads
first; DFU's ModManager unloads a disabled mod at its Init, so the copy finds no RRI then (`GetModFromGUID` null).

The copy is RRI's arm with four reads of its own (AUDIT DEX E1: the fourth, the second weapon, had been missed), and the port runs RRI's arm (`combat/rriEnemyEquipment.js`
assignRriEnemyEquipment) with the mod's reads (`systems/enemyExpansion/dexEquipment.js`; RRI_READ is RRI's own):

- **The class by its table** (HasClassTable, :77-93). A row's EquipmentTable names the class whose kit it takes -
  "Guard" the City Watch's (the City Watch is asked by that name alone), any other a class's own name,
  OrdinalIgnoreCase - and a row with no table is its own id. So the fifteen classes kit as their tables say: the Druid,
  the Necromancer Acolyte as Mages; the Guard as the City Watch; the Knight Rider, the Royal Knight as Knights; the
  Rogue Rider, the Rogue Druid as Rogues; the Bounty Hunter, the Necromancer Assassin, the Dark Slayer as Assassins; the
  Thief Rider a Thief, the Necromancer Glaivier a Warrior, the Witch Defender a Healer, the Spellsword Rider a
  Spellsword, the Archer Rider an Archer. Under RRI's own switch each held no weapon (no case names 384-398).
- **The armor by the career** (GetArmorTemplateIndex, :120-163). The classic piece, unless newArmor is on, the career
  forbids plate and the coin says otherwise - then the chain set where the career allows chain, else the leather set,
  else none (`CreateArmor` mints nothing for -1, its material rolled all the same as an argument). RRI's reads the
  class's preference (prefChain, prefLeather) instead. The mod's careers write no ForbiddenArmors, so its fourteen own
  forbid nothing and wear the classic pieces; the Guard's is the City Watch's (CLASS18), and a classic class's its
  CLASS file's.
- **An arm for the unknown** (:388-393): a longblade worn, armored 50 - RRI's switch has no default, and a class it
  does not name holds nothing.
- **The second weapon put on** (AUDIT DEX E1; :333, :385): a combat class's left-hand weapon and a sneaky class's second
  are worn (AddAndEquipWornItem), where RRI's arm carries them only (:573, :626). The arm's read `equipsSecondary` -
  RRI_READ false, the mod's true.

**The hands, as EquipItem keeps them** (AUDIT DEX E2 - RRI2's own, inherited here). The arm filled the hands in order and
took nothing off, so a Barbarian, a Knight, a Monk or the City Watch with a two-hander and a shield swung both. Every
piece the arm puts on is laid on a stand-in equip table through EquipItem's rules (ItemEquipTable.cs:94-154: the slot
GetEquipSlot answers, then what `systems/equip.js` wearLeavers says that wear takes off), and the answer is that table -
the hands, the worn set in AddItem order, the armor pieces; what comes off stays in Items (the corpse's loot). A foe left
with no right-hand weapon fights bare-handed and rolls no poison, as DFU's `mainWeapon != null` does. **The monster's
poison before ConvertOrcish** (E3, inherited by the mod's monster arm): ItemHelper's arm rolls its poison inside itself
(ItemHelper.cs:1460-1474) and both mods call ConvertOrcish after it (RRI :528-529, DEX :291-292); the port had drawn
ConvertOrcish's Dice100 first. The monster branch rolls the poison on its right hand before ConvertOrcish and answers
`poisonRolled`, so the spawn does not roll it again.

**Every class, not the new ones alone** (AUDIT DEX E5). The copy kits the classic classes too, and its armor reads the
career where RRI's reads the class's preference: a Monk (CLASS12 forbids leather, chain and plate) wears its classic
plate on a coin and nothing otherwise - about half RRI's own count of pieces - and a Ranger or a Burglar, whose careers
forbid nothing, wear the classic pieces where RRI dresses half of them in chain or leather.

The id's own tests stay the id's in both (the City Watch's item level, the Ranger's longblade, the Barbarian's raised
legs and head); the Barbarian's armored 30, the fighters' and the combat weapons are the table's. The poison's
Assassin is the table's too (:432-433): the arm's answer carries the class it asks (`poisonClass`), and the spawn's one
roll (`hostCombat.equipEnemy` -> `poisons.rollEnemyWeaponPoison`) reads it - the Bounty Hunter, the Necromancer
Assassin and the Dark Slayer poison at 60%. The install takes the delegate over in the WHILE LOADED half, after DEX4b's
doors (Start's order), and the test seam puts back the one it replaced.

Departures (Port-Ledger A, the DEX row):

- **RRI's settings read at the roll.** DEX_RRICompat.OnStart reads `realisticEnemyEquipment`, `newWeapons` and
  `newArmor` once at the mod's start; the port's arm reads each at the call (`rriModule`), as RRI2's own does - a pane
  toggle takes effect at the next foe.

Tests: `test/systems/enemyExpansion/dex6_equipment.test.js` (the fifteen tables against the C#'s law, the armor by
career set by set and the coin's place, the kit through the arm - a Knight Rider armed where RRI's own switch hands it
nothing, the unknown's longblade, a Barbarian's table, a piece that is none rolling its material - the poison through
the spawn's real roll, the delegate taken and put back; AUDIT DEX: the second weapon worn, the hands by EquipItem's
rules, the poison before ConvertOrcish, and the id's own tests - the City Watch's item level, variant 1's fighter, the
Ranger's longblade, the poison's fallback - pinned, E4), `test/systems/rri2_realism.test.js` (the hands and the poison
under RRI's own arm), mutants `tools/mutants/dex6.json`, `rri2.json`.

## 13. MUDEX1 - Meaner Monsters beside DEX is MUDEX

The owner, 2026-10-20, of AUDIT DEX A3 (Meaner Monsters' boxes saying it is incompatible with this mod): "We need to make
everything compatible. No if ands or vutts", then "Approve MUDEX". Meaner Monsters' author answered the incompatibility
himself: MUDEX 1.0.1, "Meaner Unleveled Daggerfall Enemy Expansion" (Ralzar; `vendor/mudex`, from
`github.com/Ralzar81/MUDEX` @ `6b66655`), the mod Meaner Monsters' boxes tell the player to switch to. It has no code: a
manifest that requires this mod (1.3.4) and two tables in this mod's own formats, which this mod reads from every
enabled mod (BestiaryMod.GetDBAssets - the enabled mods in load order, MUDEX after the mod it depends on):

- `MUDEX_Monsters.mdb.csv` - 35 monster lines (ID, Name, Level, the first attack's damage, health, armor): 23 of
  Daggerfall's monsters and 12 of this mod's. ParseCustomEnemies reads each as the replacement of the enemy as it finds
  it, field by field, keeping every field the line has no column for - the Grizzly Bear takes MUDEX's 1-20, 50-100 and
  armor 7 over this mod's 1-12, 13-34 and 6, keeping this mod's texture and attacks; the rat, which this mod leaves,
  takes MUDEX's; the Goblin is restated (4-15 damage, 10-20 health). A classic line's Name ("Sabertooth Tiger") is the
  row's property only, never a name shown.
- `MUDEX_Tables.tdb.csv` - 89 tables: 51 themed, unleveled ones of its own beside each dungeon type's default (a crypt
  draws one of six: `DefaultCrypt`, Lich, Vampire, Mummy, Necromancer, Spooky; a laboratory one of five), and this
  mod's 38 `Default*` tables restated under their own names (ParseEncounterTables' replacement arm - the climates' day,
  night and city-night tables are MUDEX's).

THE SWITCH (`enemyExpansion/dexSwitches.js`). MUDEX has none of its own (MM1: no compatibility switches between
mods): Meaner Monsters' switch beside this mod's IS MUDEX's. This mod's install latches MUDEX for the game when it loads
this mod and Meaner Monsters is on (`installEnemyExpansion`'s `meaner`, the test seam), and reads MUDEX's two tables
after its own (`dbAssets`, one read per set of loaded mods); with this mod latched, Meaner Monsters' own rows
(`applyMeanerMonsters`), its xml (the werewolf's, the wereboar's and the dragonling's scales - MUDEX ships none) and
PCAAO's edit of it (`meanerMonstersOn` - PCAAO asks for "Meaner Monsters" by name, which a DFU game that took the advice
does not have) stand aside. Without this mod, Meaner Monsters is itself. Both mods are on by default and the room forces
both online, so this is the game's composition by default. A switch flipped mid-game waits for the next load, as this
mod's does - Meaner Monsters' Features row says so (`features.mod.meanerMonsters.effect`).

THE RELAY'S BOUNDS (`net/foeBounds.js` FOE_BOUND_ROWS): the seventh profile, this mod's lines with MUDEX's after them,
moves eight rows - the Flesh Atronach's health to 300, the Ice Atronach's level to 21, and six share levels (the Orc 6,
the Orc Sergeant 9, the Mummy 15, the Orc Shaman 15, the Orc Warlord 19, the Daedra Lord 21), MUDEX's levels being
written into the table. The relay re-hashed in place (world234).

Departures (Port-Ledger A, the DEX row): the switch the boxes ask the player to make is made for them; no box is raised.

Tests: `test/systems/enemyExpansion/mudex1.test.js` (the record byte for byte, the switch's four cases and its reset, the
monsters field by field written and minted, the tables, Meaner Monsters standing aside and itself),
`test/net/foebounds_law.test.js` (the seventh profile), `dex1_registry.test.js` (DEX alone, Meaner Monsters standing
aside); mutants `tools/mutants/mudex1.json`, eleven, all dead.

## 14. DEX-HIDES - the mod's animals skinned (FIELD BUGS 2026-10-20h and 2026-10-21)

The Discord's #feature-feedback (Shines): "the new mobs are great! But the variant bats and wolves I encountered have had
no option for skinning." Hunting skinned by DFU's MobileTypes alone (`net/professionLaw.js` `hideOfFoe`), and the mod's
monsters are numbered past them (section 5: 256-290, a spawned foe's mobileType its id), so none of its animals was ever
stamped at its kill (`scenes/huntHost.js`), listed as a body or taken by the account service. Each of the mod's nine rows
of Affinity Animal is skinned now - its kin's hide where Hunting's ten have its kin (the Bat, the Blood Spider, the
Mountain Lion, the Land Dreugh), and Wolf Pelt, Boar Hide and Mudcrab Chitin for the rest; its Hell Hound is the mod's
Daedra and stays unskinned. The hides and their reasons are `06-Systems/Professions-Arc.md` 4.4 (DEX-HIDES); the record is
`01-Overview/bugs/Field-Bugs-2026-10-20h.md`, which built it first (the same thread reached `Field-Bugs-2026-10-21.md`,
whose own build gave way to it at the merge, carrying its audit's two fixes - the Bear Hide spent last of its tier, the
Mudcrab Chitin counted as a mass). The ids are static numbers there, so the service needs no registry of the
mod's, and a mod switched off rolls none of them (section 7).
