# Bringing a Daggerfall Unity character over (DFUSAVE)

**Mac (2026-09-20): "Can players easily bring their DFU characters
over?"** They could not. The port reads a CLASSIC save (SAVE0-SAVE5,
the SAV1-SAV3 slices) and its own envelope, and a Daggerfall Unity
`SaveData.txt` was refused on the version check. Then: **"Begin."**

This page is the arc's record: what a DFU save is, member by member
what the port does with each, and what it does not do yet and why.

## What a DFU save is

`SaveLoadManager.cs` writes a save as a FOLDER, `Saves/SAVE<n>/`, real
only WITH its `SaveInfo.txt` (EnumerateSaveFolders :751), holding a SET
of JSON files: `SaveData.txt` (SaveData_v1, SerializableGameObject.cs
:82-98), `FactionData.txt`, `QuestData.txt`, `DiscoveryData.txt`,
`ConversationData.txt`, `NotebookData.txt`, `WorldVariationData.txt`,
`AutomapData.txt`, `ContainerData.txt`, the optional
`QuestExceptions.txt`, one `mod_<file>.txt` per mod that saved state
(GetModDataFilename :1573-1577), the plain-text `bio.txt` (one
back-story line a row) and `Screenshot.jpg` (:45-57).

The JSON is Full Serializer's, not plain. `[fsObject("v1")]` marks 143
types in the tree and each prints as `{ "$version": "v1", "$content":
{...} }`; a polymorphic field carries `$type`; a class-typed object may
carry `$id` and a repeat is `{ "$ref" }`; a Dictionary with a string
key is an object and any other key is an array of `Key`/`Value` pairs;
an enum is its NAME; a 64-bit integer is a bare number. The reader
(`formats/dfuSave.js`, DFUSAVE1) strips all of it once at the door and
quotes any integer of 16+ digits before the parse, so a `realTime` of
DateTime ticks or a LoadID cast from a negative instance id survives
where JSON.parse would round it. Everything after the door reads C#'s
own field names.

## The mapping, member by member

The port's envelope is what `systems/save.js`'s `snapshotPlayer`
mints and `restorePlayer` consumes (the classic converter
`systems/classicSave.js` is the pattern: ONE pure producer, the
existing restore seam the only consumer). Verdicts: **direct** (the
same field, at most renamed), **converted** (a real transformation,
named), **partial** (some of it), **not yet** (dropped, with the
reason and what it costs the player).

### SaveData_v1

| DFU member | Port field | Verdict | How |
|---|---|---|---|
| `header.description` | - | gate | must exist; the reader's SaveData_v1 check |
| `currentUID` | - | consumed | the port's quest restore raises its own allocator past every restored quest uid (`quest/quest.js:510`), and the port's items carry no uid at all (Ledger A), so DFU's global counter has nothing to seed. AUDIT-DFUSAVE C15: the first draft of this row promised an `ensureUidAtLeast` that was never wired |
| `dateAndTime.gameTime` (DaggerfallDateTime seconds) | `classicMinutes` | converted | `(gameTime - classicEpochInSeconds) / 60`, DaggerfallDateTime.ToClassicDaggerfallTime (:475-478); `systems/gameDate.js` already holds the epoch |
| `dateAndTime.realTime` (DateTime ticks) | slot card `realTime` | converted | .NET ticks (100ns since 0001-01-01) to Unix milliseconds in the door (`ticksToUnixMs`), so the Load window orders and dates the imported slot as DFU did; arrives as a decimal string past 2^53 and is converted from the string. AUDIT-DFUSAVE R4: the first draft stamped the IMPORT's clock on every card |
| `playerData` | (below) | | |
| `dungeonData` (action doors, action objects by loadID) | - | not yet | the port keys a dungeon's action state by its own object key, DFU by a LoadID hashed from the object's position; a save made inside a dungeon re-enters it fresh (doors relocked, objects at rest) - see the position row |
| `enemyData` | `world.foes` / dungeon foes | not yet | the same LoadID gap, plus the port's foe record is its own; every foe respawns as on a first visit |
| `lootContainers` | `world.piles` / scene loot | not yet | the same gap; a dropped pile or an opened container is forgotten. The player's OWN items are all in `playerEntity.items` and travel whole |
| `bankAccounts[]` `{accountGold, loanTotal, loanDueDate, regionIndex, hasDefaulted}` | `bankAccounts[62]` | direct | the same five names, placed by `regionIndex` |
| `bankDeeds.shipType` | `ownedShip` | direct | `ShipType` None -1 / Small 0 / Large 1 both sides |
| `bankDeeds.houses[]` `{location, mapID, buildingKey, regionIndex}` | `houses[62]` | direct | `mapID` -> `mapId`, placed by `regionIndex` |
| `escortingFaces[]` | `escortingFaces[]` | converted | `targetPerson`/`targetFoe` are Symbols in DFU and the symbol's `original` string in the port; `targetRace` and `gender` by their enum tables |
| `sceneCache.permanentScenes` | `sceneCache.permanentScenes` | direct | the same scene-name strings (`DaggerfallInterior [MapID=..., BuildingKey=...]`, `DaggerfallWorld [mapX=..., mapY=...]`) |
| `sceneCache.sceneCache[]` (per-scene loot containers and action doors) | `sceneCache.scenes[]` | not yet | keyed by LoadID in DFU, by `shelf:<i>`/`container:<i>` and the action key in the port; an interior the player had opened restocks as unvisited |
| `travelMapData` (7 flags) | `travelMap` (11 flags) | direct | the seven by name; the port's four road-layer filters take their defaults |
| `advancedClimbingState` | - | not yet | the port's AdvancedClimbing is scaffolding (Ledger A) |
| `modInfoData[]` | import warnings | converted | each mod named in the import's report, because its state (`mod_*.txt`) does not come over |

### PlayerData_v1

| DFU member | Port field | Verdict | How |
|---|---|---|---|
| `playerPosition` | (below) | | |
| `playerEntity` | (below) | | |
| `weaponDrawn` | `pose.weaponDrawn` | direct | |
| `usingLeftHand` | `pose.usingRightHand` | converted | negated (SerializablePlayer.cs:176, the port stores the positive sense) |
| `transportMode` | `pose.transport` | converted | enum name -> the port's `TRANSPORT_MODES` string |
| `boardShipPosition` | `boardShipPosition` | converted | the map pixel, yaw and the WORLD units (`nativeX`/`nativeZ`, the compensation-free `y`) come over with `pos: null`; the Unity-local `pos` under DFU's floating origin cannot be re-expressed here, so the ship arrival in `scenes/world.js` converts the world units under the port's origin once the pixel is built (`localFromWorld`). AUDIT-DFUSAVE C6: the first draft's `pos: null` alone landed the disembarking player at the pixel's centre |
| `guildMemberships` / `vampireMemberships` (Dictionary<int guild group, GuildMembership_v1>) | `guildMemberships.{mortal,vampire}` | converted | key = guild group both sides; `{rank, lastRankChange, flags}` direct; `guild` (the port keeps the guild's NAME beside the rank because one HolyOrder/KnightlyOrder slot must remember WHICH temple or order) is resolved from DFU's `variant` (the temple's or order's faction id) through `guildVariants.js` |
| `oneTimeQuestsAccepted` | `quest.oneTimeQuestsAccepted` | direct | |

### PlayerPositionData_v1 - where the player stands

DFU stores the Unity position under its floating origin PLUS the
world-unit coordinate (`worldPosX`/`worldPosZ` = PlayerGPS.WorldX/
WorldZ, "in Daggerfall world units"), and on load `RestorePositionHelper`
respawns from the WORLD units (PlayerEnterExit.cs:623-650) before it
re-applies the local offset. The port's load path takes the same
world units (`world.nativeX/nativeZ`, then `_teleportToPixel` and
`localFromWorld`), so the exterior arm is exact.

| DFU member | Port field | Verdict | How |
|---|---|---|---|
| `worldPosX`, `worldPosZ` | `world.nativeX`, `world.nativeZ`, `world.pixel` | direct | pixel = `worldCoordToMapPixel` |
| `position.y - worldCompensation.y` | `world.y` | direct | both are the compensation-free height in scene units (SceneMapRatio is the same 1/GlobalScale) |
| `yaw`, `pitch`, `isCrouching` | `pose.yaw/pitch/crouching` | direct | |
| `worldContext`, `insideDungeon`, `insideBuilding`, `exteriorDoors`, `buildingDiscoveryData`, `insideOpenShop/Tavern/Residence`, `playerTeleportedIntoDungeon` | `interior`, `dungeon` | not yet | a save made INSIDE lands at the location's exterior pixel with a HUD line saying so; the building door and dungeon records are DFU's `StaticDoor` and the port's `door: {blockIndex, recordIndex, doorIndex, buildingKey}` - mappable, and the next slice |
| `smallerDungeonsState` | `smallerDungeonsState` | direct | NotSet 0 / Disabled 1 / Enabled 2, both sides (the first draft of this row had the last two swapped; the regeneration pin caught it) |
| `weather` | `weather` | converted | enum name -> the port's lower-case `WEATHER_TYPES` string |
| `terrainSamplerName/Version`, `floatingOriginVersion`, `worldCompensation` | - | consumed | only in the height above |

### PlayerEntityData_v1 - the character

| DFU member | Port field | Verdict | How |
|---|---|---|---|
| `name`, `level`, `faceIndex` | same | direct | `name` trimmed, as SerializablePlayer.cs:371 does |
| `gender` (Genders) | `gender` | converted | `'male'`/`'female'` |
| `raceTemplate` (the whole RaceTemplate) | `raceId`, `race` | converted | `raceTemplate.ID` is the port's 1-based `RACES` id; `race` is `raceById(id).key` |
| `careerTemplate` (DFCareer, DECODED - tolerances, proficiencies, flags as enums) | `career` (the RAW CLASS*.CFG record `formats/classFile.js` reads), `careerIndex` | converted | DFCareer.cs:557-631 is the decode; the import is its exact inverse, re-packing the tolerance bytes, the ability/spell-point bitfield, the attack-modifier byte and the weapon/armor/shield bitfield. `careerIndex` is the stock row whose name matches, else -1 as the classic import does |
| `reflexes` (PlayerReflexes) | `reflexes` | converted | enum -> 0..4 |
| `stats` (DaggerfallStats: Strength..Luck) | `stats` | direct | the permanent values, lower-cased keys; `mods`/`maxMods` are not serialised by DFU either |
| `skills` (DaggerfallSkills: Medical..CriticalStrike) | `skills[35]` | direct | by `DFCareer.Skills` order, which is the port's `SKILLS` order |
| `resistances` | - | not yet | the port has no resistance store; DFU's is recomputed from race and career at load in any case (PlayerEntity.AssignCareer) |
| `maxHealth`, `currentHealth`, `currentFatigue`, `currentMagicka`, `currentBreath` | `maxHealth`, `health`, `fatigue`, `magicka`, `currentBreath` | direct | `maxMagicka` is never serialised by DFU (a live property); the port's stored ceiling is DERIVED as the classic import derives it - `spellPoints(intelligence, spellPointMultiplier(career bitfield))` (`chargen.js`, the one home). AUDIT-DFUSAVE C11: the first draft minted 0 |
| `skillUses[35]`, `timeOfLastSkillIncreaseCheck`, `skillsRecentlyRaised[2]`, `timeOfLastSkillTraining`, `startingLevelUpSkillSum`, `currentLevelUpSkillSum` | `skillUses`, `lastSkillCheckTime`, `skillsRecentlyRaised`, `timeOfLastSkillTraining`, same, same | direct | with SerializablePlayer.RestorePlayerData's two guards (:295-296, :350-351): a zero `currentLevelUpSkillSum` is recomputed from the career's skills (`advancement.js levelUpSkillSum`), a non-positive `startingLevelUpSkillSum` estimated from the level (PlayerEntity.cs:1480-1489). AUDIT-DFUSAVE C9 |
| `equipTable[27]` (item UIDs by EquipSlots) | `items[i].equipSlot` | converted | the port's items carry no UID (Ledger A) - the slot is written ON the item whose `uid` the table names, and `rebuildEquipState` derives the table |
| `items[]`, `wagonItems[]`, `otherItems[]` (ItemData_v1) | same | converted | see the item row below |
| `goldPieces` | `goldPieces` | direct | |
| `globalVars[]` | `quest.machine.globalVars` | direct | index/value pairs |
| `minMetalToHit`, six `biography*Mod`, `timeForThievesGuildLetter`, `timeForDarkBrotherhoodLetter`, `thievesGuildRequirementTally`, `darkBrotherhoodRequirementTally`, `timeToBecomeVampireOrWerebeast`, `lastTimePlayerAteOrDrankAtTavern`, `daedraSummonDay`, `daedraSummonIndex` | same names | direct | |
| `regionData[]` (RegionDataRecord) | `regionConditions[62]`, `legalRep`, `regionPrices` | converted | `Values/Flags/Flags2/PrecipitationOverride/SeverePunishmentFlags/IDOfPersecutedTemple` into the port's compact rows; `LegalRep` into the region-keyed `legalRep`; `PriceAdjustment` into `regionPrices` |
| `rentedRooms[]` `{name, mapID, buildingKey, allocatedBedIndex, expiryTime}` | `rentedRooms[]` | converted | `expiryTime` is DaggerfallDateTime seconds; the port keeps `expiryMinutes` in classic minutes |
| `spellbook[]` (EffectBundleSettings) | `spells[]` | converted | `StandardSpellIndex` set and no `Tag` -> the SPELLS.STD index; a TAGGED bundle (`vampire`/`lycanthrope`, PlayerEntity.cs:1139/:1164 - a curse's granted spell) -> the port's tagged custom record with `minimumCastingCost`, the marks `vampirism.js`/`lycanthropy.js` mint and the cast-cost floor, the cure and the spellbook's no-delete note key on (AUDIT-DFUSAVE C5); else a made spell: each `Effects[i].Key` ("Damage-Health") back to the classic `(type, subType)` through the effects' own `ClassicKey` table, the first THREE (a fourth is dropped with a line - the classic record has three slots), `EffectSettings` renamed field by field, `ElementType`/`TargetType` by enum, `Name`, `MinimumCastingCost`, the icon index wrapped at the classic 55 (an icon PACK is named as not carried); a negative custom index minted |
| `instancedEffectBundles[]` | `activeEffects[]` | partial | the entries that OUTLIVE a load and change who the character is: diseases, the vampirism and lycanthropy infections and the deployed curse (the racial override), permanent drains under both keys (`Drain-*` and `Transfer-*`, TransferEffect being a DrainEffect - AUDIT-DFUSAVE C4), poisons. Skipped without a line: an effect whose `effectEnded` is set (EntityEffect.cs:550, C10) and a `HeldMagicItem` bundle, which the port's held-item runtime rebuilds from the worn item as DFU does (EntityEffectManager.cs:2311-2313, C13). A timed spell in flight (a Shield with rounds left, a Fortify) is not carried - the port's entry shapes are per-effect and DFU's per-bundle, and a spell that ends in minutes is not worth a second effect runtime |
| `crimeCommitted` (Crimes) | `crimeCommitted` | converted | enum -> the port's `CRIMES` number |
| `haveShownSurrenderToGuardsDialogue` | `haveShownSurrenderDialogue` | direct | |
| `lightSourceUID` | `lightSourceIndex` | converted | the index of the item with that uid, -1 for none (the same Ledger A departure) |
| eleven `reputation*` shorts | `sGroupReputations[11]` | direct | by `FactionFile.SocialGroups` index |
| `previousVampireClan` | `previousVampireClan` | converted | enum -> number |
| `anchorPosition` | `anchorPosition` | partial | the same PlayerPositionData_v1 shape as the player's, into `makeAnchor`'s record - when its `worldContext` is Exterior. An anchor set INSIDE a building or dungeon is null with a line (the port's interior anchor needs the building key and the interior record the position half does not carry yet). AUDIT-DFUSAVE C2 |

### ItemData_v1 -> a port item

DFU's ItemData_v1 IS the classic item record with the fields renamed
(DaggerfallUnityItem.FromItemData :1622-1688), so the port's classic
importer `classicItemFromRecord` is the pattern and the map is:
`shortName` -> `name`; `nativeMaterialValue` -> `material`; `value1` ->
`value`; `value2 >> 16` -> `flags` (the low sixteen are DFU's own
`unknown`); `hits1`/`hits2` -> `currentCondition`/`maxCondition`;
`hits3 >> 8` -> `typeDependentData`; `dyeColor` -> `dye`;
`currentVariant` -> `variant`; `itemGroup` (the enum's NAME is the
port's group string) + `groupIndex` -> `templateIndex` through
`GROUP_TEMPLATE_INDICES`; `legacyMagic` (flat type/param pairs) ->
`enchantments`; `isQuestItem`/`questUID`/`questItemSymbol` ->
`questItem`/`questUID`/`questSymbol`; `trappedSoulType` (a MobileTypes
enum, so its NAME - "Daedroth" - read through the port's own
`MOBILE_TYPES`; `None` is no soul), `poisonType` (a Poisons name; `None`
is none), `potionRecipe` -> `potionRecipeKey`, `timeForItemToDisappear`,
`timeHealthLeechLastUsed`, `artifactIndexBitfield`, `stackCount`
(verbatim, as FromItemData copies it), `enchantmentPoints`, `message`,
`weightInKg`, the four texture fields: direct. `repairData` is
converted: the shop's `buildingKey` out of DFU's interior scene name,
`timeStarted` to classic minutes, and `repairTime` from DFU's SECONDS
(FormulaHelper.cs:1931-1932) to the port's classic MINUTES, rounded and
never below one. FromItemData's three back-fills run on every item as
DFU's do (:1673-1687): a potion's classic recipe key from
`typeDependentData` when `potionRecipe` is the pre-key zero, the
artifact bitfield an older save lacks (`loot.js`'s own check), and the
Ark'ay book id 10000 -> 5. `artifact` and `isIdentified` are the flag
bits (0x20, 0x800) as the classic importer reads them; `magic` is
"carries an enchantment". `customMagic` (a custom enchantment) has no
port shape and is dropped with a line; `className` and `drawOrder`
have no port field and are dropped silently. `uid` is consumed by the
equip table and the light source and does not ride the item.

### The other files

| File | Port field | Verdict | How |
|---|---|---|---|
| `QuestData.txt` (QuestMachineData_v1: siteLinks, quests) | `quest.machine` | converted | the port's quest machine SERIALISES IN DFU'S OWN SHAPE (QuestSaveData_v1 field for field, `test/quest*` pins), so a quest comes over whole; the three differences are mechanical - a `Type` is its class name, a Symbol is `{original}`, the questors Dictionary is an array - and a quest the port cannot RESTORE is dropped under the per-quest catch DFU itself runs (QuestMachine.cs:1918-1944) - the port's `restoreSaveData` has the same catch; the CONVERSION has none, so a QuestData.txt the converter cannot read takes that one slot down as unreadable, reported by the door (AUDIT-DFUSAVE C16 corrected this row's claim) |
| `ConversationData.txt` (SaveDataConversation) | `talk` | converted | the same five members; the Dictionaries become the port's arrays |
| `DiscoveryData.txt` (Dictionary<int, DiscoveredLocation>) | `discovery` | converted | `locations` by `mapID & 0xfffff`; `buildings` by the port's location id `${regionINDEX}:${locationName}` (`world.js discoveryLocationId`) - DFU carries the region NAME, mapped through `REGION_NAMES`; a name not among the 62 is dropped with a line. AUDIT-DFUSAVE C2: the first draft keyed by the name and no imported building was ever found |
| `NotebookData.txt` (NotebookData_v1) | `quest.notebook` | direct | the same two line-list arrays |
| `FactionData.txt` (FactionData_v2.factionDict) | `factionRep` | converted | the columnar snapshot (ids, rep, flags, power, the nine relation columns) off the dictionary |
| `bio.txt` | `backStory` | direct | |
| `Screenshot.jpg` | the slot's picture | converted | in a browser, re-encoded to the slot store's 320x200 JPEG (DFU's is the full window); elsewhere the bytes as a data URL. A picture the storage refuses (a quota hit) costs the picture, not the save - AUDIT-DFUSAVE R1 moved the screenshot write out of the save's own try in `saveSlots.js`, where a refused picture had swept the data |
| `AutomapData.txt`, `WorldVariationData.txt`, `ContainerData.txt`, `QuestExceptions.txt`, `mod_*.txt` | - | not yet | the automap's discovery record is a later slice; the rest have no port counterpart |

## What a player gets, in one paragraph

Their character - name, race, class, level, every stat and skill and
use count, health/fatigue/magicka, gold, the whole inventory with what
was worn still worn, the wagon, items left for repair, every spell they
know or made, their diseases and their curse if they carry one, their
legal standing and reputations in every region and with every faction,
guild ranks, bank accounts and loans, houses and ship, rented rooms,
the travel map's filters, their escort portraits, their journal, every
quest in flight, every rumor and NPC conversation state, every location
and building they had found, and the clock - standing at the exterior
spot they saved at, facing the way they faced. What they do not get:
the interior or dungeon they were standing in (they start outside it),
the state of that one scene's doors, enemies and loot, timed spells
still running, a Recall anchor set indoors, a custom enchantment, and
any mod's own saved state.

## The slices

- **DFUSAVE1** - the reader, `formats/dfuSave.js`, shipped 2026-09-20.
- **DFUSAVE2** - the import core, `systems/dfuSaveImport.js` with the
  DFU enum and effect-key tables in `formats/dfuEnums.js`, shipped
  2026-09-20.
- **DFUSAVE3** - the door, `systems/dfuSaveDoor.js` + `scenes/menu.js`,
  shipped 2026-09-20: the start menu's classic-save picker is ONE door
  for both formats. A DFU `Saves` folder (or zip, or a drop) imports
  every SAVE<n> into a port slot - the character's name, the save's
  name, the clock and DFU's own screenshot on the card - and the slot
  window opens over them; from then on they are port saves, loaded by
  the ordinary Load window on either skin. The picker says what came
  over and what did not, in the converter's words.

## Three things the round trips taught

The quest half is pinned by a ROUND TRIP: a real quest (B0B40Y09 - a
Person, a Place, an Item, a Foe and a Clock) parsed by the port,
saved, shaped the way Full Serializer prints (the test-side shaper is
the C# field list written a second time, independently of the
converter), imported, and compared to what the port saved; then
restored on a fresh machine that must save it identically. That
found:

- **a Symbol rides two ways**, because the port writes it two ways: a
  resource's, a task's or a questor's symbol is `symbolToSaveData`'s
  `{ original }`, and a site link's, a marker's or an ITEM's is a live
  Symbol cloned whole, whose `.name` `world.js` and the machine's
  site-link walk read. The first draft wrote `{ original }`
  everywhere and the round trip refused it;
- **an unplaced Person's `nameBank` is null in the port and cannot be
  in C#** (a struct field prints its zero, `Breton`), and a Foe's
  queues are null in the port and empty lists in DFU. The first pin
  normalised both away; AUDIT-DFUSAVE P1 SEEDS them instead (every
  Person's `nameBank`, every Foe's spell and item queue), so the trip
  proves the columns and not a normalisation;
- **an ItemData_v1 carries every field**, so an item that came through
  one carries the zeros a port mint leaves out - the same item to the
  restore, with more columns written down.

The rumor mill's round trip is byte-equal, and so are the talk tree's
(restored against a live quest, whose resource the relink must find by
symbol name) and the NPC session's - AUDIT-DFUSAVE P3.

## The pins

`test/dfusave.test.js` (9), `test/dfusave_import.test.js` (18),
`test/dfusave_door.test.js` (4), `test/dfusave_audit.test.js` (16) -
47 pins. The mutation record, honestly: the reader's 13 and the
converter's 18 mutants were killed at the arc (two survived the first
pins - the sword sat first in the pack, so a slot written on `items[0]`
was invisible, and the temple was Akatosh, the first divine - and were
re-aimed); the door's four were NOT mutation-checked; and the audit's
sweep found eleven survivors the arc's pins let through (below), each
now pinned by name. Every enum table (46, after the audit struck the
five nothing read) and the effect-key table are regenerated from the
reference clone under PY1's `DFU_PATH` convention; the C# save
structs' field lists are regenerated too, and hold the fixture to
printing every field and the converter to reading none the C# does
not declare; the file roster, the version, the mod-file name and the
career inverse's bit positions are read off the C#.

## AUDIT-DFUSAVE (2026-09-21)

Mac: "Lets do an audit of this so far." Three read-only lanes, each
over the arc against its source: the converter against the DFU C#
(SerializablePlayer, DaggerfallUnityItem, EntityEffectManager,
PlayerEntity), the reader against Full Serializer's format and the
door against the slot store, and the arc's pins and records against
the code. Findings, and what became of each:

**The converter (C1-C16).** C1 `repairTime` copied verbatim - DFU's
SECONDS as the port's MINUTES, sixty times too long. C2 discovery keyed
by region NAME where the port keys by INDEX, so no imported building
was ever found; and a Recall anchor set indoors built an exterior
anchor at the interior's coordinates. C3 `trappedSoulType` read as a
number where DFU prints the MobileTypes NAME - every filled soul gem
came over empty. C4 a `Transfer-*` drain (TransferEffect is a
DrainEffect) was dropped as "timed". C5 a vampire's or werebeast's
granted spell (a tagged stock bundle) came back as the bare index -
untagged, at full cost, deletable, and re-granted beside itself. C6 a
save made at sea disembarked at the pixel's centre. C7 the artifact
and identified bits were read from one mask. C8 FromItemData's three
back-fills (the classic recipe key, the artifact bitfield, the Ark'ay
book) did not run. C9 RestorePlayerData's two level-sum guards were
missing, so a character with a zero `currentLevelUpSkillSum` read as
many levels overdue. C10 an effect with `effectEnded` set was carried
live. C11 `maxMagicka` minted as 0 where DFU derives it. C12 a spell
with four effects kept the wrong three and said nothing. C13
`stackCount` was floored at one and a `HeldMagicItem` bundle's effects
were carried as if cast. C14 an icon index past 54 was not wrapped. C15
the `currentUID` row promised a wiring that did not exist. C16 the
per-quest catch claim was the restore's, not the conversion's. All
sixteen fixed in `systems/dfuSaveImport.js` (C6 also in
`scenes/world.js`'s ship arrival), each pinned in
`test/dfusave_audit.test.js` under its number.

**The reader and the door (R1-R11).** R1 the screenshot was written
INSIDE the save's try between the data and the card, so a quota hit
on the picture (a DFU import's full-window JPEG is the first thing
that ever hit one) took the whole save down - `saveSlots.js` now
writes the picture after, on its own, and a refused picture is a
missing picture; the door re-encodes to 320x200 in a browser. R2 a
`$ref` before its `$id` (dictionaries reorder) - the two-pass unwrap
was right and is now pinned. R3 the version-check message named the
wrong file. R4 the slot card carried the IMPORT's clock, not the
save's DateTime ticks. R5 two `SAVE0` folders under different parents
collapsed into one; the collector now groups by folder. R6 a ZERO
[Flags] value prints as `""` and threw as an unknown name. R7 an enum
value without a name prints as `null` and threw in NPCData. R8 the
classic collector had the same folder collapse (first folder wins,
the rest recorded). R9 a drop whose `dataTransfer` was read after an
await lost its entries. R10 the picker's `finish` could run twice. R11
a folder holding BOTH formats imported the DFU saves and lost the
classic list. All fixed; R2, R6, R7 and R1 pinned in the audit file,
the rest in the arc's own files.

**The pins and the records (P1-P5, D1-D4).** P1 the quest round trip
normalised away the very columns (`nameBank`, the Foe queues) it
claimed to prove - now seeded. P2 an item's fixture trip did not check
the print's own column values - now does. P3 the talk tree and session
were "pinned by shape" - now round-tripped through their restores. P4
five enum tables were exported and read by nothing (the one-home gate's
duplicate ratchet made the point) - struck; every remaining table must
have a reader. P5 the door's four pins were counted as mutation-killed
- the record now says they were not. D1 `dfuDateToSeconds` was a
second calendar - now `gameDate.js`'s own. D2 the career inverse wrote
the flag bits by hand a second time - now the regenerated tables. D3
the FromItemData cite was :640-700 (the classic-record reader), the map
is :1622-1688. D4 the item paragraph promised `customEnchantments` and
the record wrote `customMagic` off as carried.

**Survivors the sweep found**, each now a pin: the artifact/identified
split; `stackCount` verbatim; the 55 icon wrap; the four-effect
warning; the tagged spell; the `Transfer-*` drain; the `effectEnded`
and `HeldMagicItem` skips; the indoor anchor; the level-sum guards;
`maxMagicka`'s value.

**Honest residue.** `$type` over an ARRAY element is dropped (only an
object keeps its `$type`; nothing the converter reads is a typed
array). The classic collector's first-folder-wins is a policy, not a
merge. `className` and `drawOrder` have no port field. `itemFields.js`
validates `repairData.buildingKey` as a string where every producer
writes a number - pre-existing, not this arc's. The interior and
dungeon halves of the position, the scene cache, timed spells, the
automap, world variants, mod state, custom enchantments and an indoor
Recall anchor remain the next slice's, named in the import's report.

**NOT SEEN AGAINST A REAL SAVE.** No DFU save is in the tree. The
envelope rules are Full Serializer's documented format and the field
names are read off the C#; the corpus gate (`DFU_SAVES_PATH`) is armed
for the first real one, and where a real file disagrees, the pin that
reads it is the thing to correct.
