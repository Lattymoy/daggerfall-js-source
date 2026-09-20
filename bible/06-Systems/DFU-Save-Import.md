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
| `currentUID` | quest uid allocator | direct | `ensureUidAtLeast`, so nothing minted after the import collides with a restored uid |
| `dateAndTime.gameTime` (DaggerfallDateTime seconds) | `classicMinutes` | converted | `(gameTime - classicEpochInSeconds) / 60`, DaggerfallDateTime.ToClassicDaggerfallTime (:475-478); `systems/gameDate.js` already holds the epoch |
| `dateAndTime.realTime` | slot card `realTime` | direct | display only; arrives as a decimal string past 2^53 and is kept as one |
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
| `boardShipPosition` | `boardShipPosition` | partial | the map pixel and yaw come over; the Unity-local `pos` under DFU's floating origin cannot be re-expressed under the port's, so a save taken AT SEA disembarks at the ship's pixel rather than at the exact deck spot |
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
| `name`, `level`, `faceIndex` | same | direct | |
| `gender` (Genders) | `gender` | converted | `'male'`/`'female'` |
| `raceTemplate` (the whole RaceTemplate) | `raceId`, `race` | converted | `raceTemplate.ID` is the port's 1-based `RACES` id; `race` is `raceById(id).key` |
| `careerTemplate` (DFCareer, DECODED - tolerances, proficiencies, flags as enums) | `career` (the RAW CLASS*.CFG record `formats/classFile.js` reads), `careerIndex` | converted | DFCareer.cs:557-631 is the decode; the import is its exact inverse, re-packing the tolerance bytes, the ability/spell-point bitfield, the attack-modifier byte and the weapon/armor/shield bitfield. `careerIndex` is the stock row whose name matches, else -1 as the classic import does |
| `reflexes` (PlayerReflexes) | `reflexes` | converted | enum -> 0..4 |
| `stats` (DaggerfallStats: Strength..Luck) | `stats` | direct | the permanent values, lower-cased keys; `mods`/`maxMods` are not serialised by DFU either |
| `skills` (DaggerfallSkills: Medical..CriticalStrike) | `skills[35]` | direct | by `DFCareer.Skills` order, which is the port's `SKILLS` order |
| `resistances` | - | not yet | the port has no resistance store; DFU's is recomputed from race and career at load in any case (PlayerEntity.AssignCareer) |
| `maxHealth`, `currentHealth`, `currentFatigue`, `currentMagicka`, `currentBreath` | `maxHealth`, `health`, `fatigue`, `magicka`, `currentBreath` | direct | `maxMagicka` is a live getter in the port and is not minted |
| `skillUses[35]`, `timeOfLastSkillIncreaseCheck`, `skillsRecentlyRaised[2]`, `timeOfLastSkillTraining`, `startingLevelUpSkillSum`, `currentLevelUpSkillSum` | `skillUses`, `lastSkillCheckTime`, `skillsRecentlyRaised`, `timeOfLastSkillTraining`, same, same | direct | |
| `equipTable[27]` (item UIDs by EquipSlots) | `items[i].equipSlot` | converted | the port's items carry no UID (Ledger A) - the slot is written ON the item whose `uid` the table names, and `rebuildEquipState` derives the table |
| `items[]`, `wagonItems[]`, `otherItems[]` (ItemData_v1) | same | converted | see the item row below |
| `goldPieces` | `goldPieces` | direct | |
| `globalVars[]` | `quest.machine.globalVars` | direct | index/value pairs |
| `minMetalToHit`, six `biography*Mod`, `timeForThievesGuildLetter`, `timeForDarkBrotherhoodLetter`, `thievesGuildRequirementTally`, `darkBrotherhoodRequirementTally`, `timeToBecomeVampireOrWerebeast`, `lastTimePlayerAteOrDrankAtTavern`, `daedraSummonDay`, `daedraSummonIndex` | same names | direct | |
| `regionData[]` (RegionDataRecord) | `regionConditions[62]`, `legalRep`, `regionPrices` | converted | `Values/Flags/Flags2/PrecipitationOverride/SeverePunishmentFlags/IDOfPersecutedTemple` into the port's compact rows; `LegalRep` into the region-keyed `legalRep`; `PriceAdjustment` into `regionPrices` |
| `rentedRooms[]` `{name, mapID, buildingKey, allocatedBedIndex, expiryTime}` | `rentedRooms[]` | converted | `expiryTime` is DaggerfallDateTime seconds; the port keeps `expiryMinutes` in classic minutes |
| `spellbook[]` (EffectBundleSettings) | `spells[]` | converted | `StandardSpellIndex` set -> the SPELLS.STD index; else a made spell: each `Effects[i].Key` ("Damage-Health") back to the classic `(type, subType)` through the effects' own `ClassicKey` table, `EffectSettings` renamed field by field, `ElementType`/`TargetType` by enum, `Name`, `IconIndex`; a negative custom index minted |
| `instancedEffectBundles[]` | `activeEffects[]` | partial | the entries that OUTLIVE a load and change who the character is: diseases, the vampirism and lycanthropy infections and the deployed curse (the racial override), permanent drains. A timed spell in flight (a Shield with rounds left, a Fortify) is not carried - the port's entry shapes are per-effect and DFU's per-bundle, and a spell that ends in minutes is not worth a second effect runtime |
| `crimeCommitted` (Crimes) | `crimeCommitted` | converted | enum -> the port's `CRIMES` number |
| `haveShownSurrenderToGuardsDialogue` | `haveShownSurrenderDialogue` | direct | |
| `lightSourceUID` | `lightSourceIndex` | converted | the index of the item with that uid, -1 for none (the same Ledger A departure) |
| eleven `reputation*` shorts | `sGroupReputations[11]` | direct | by `FactionFile.SocialGroups` index |
| `previousVampireClan` | `previousVampireClan` | converted | enum -> number |
| `anchorPosition` | `anchorPosition` | converted | the same PlayerPositionData_v1 shape as the player's, into `makeAnchor`'s record |

### ItemData_v1 -> a port item

DFU's ItemData_v1 IS the classic item record with the fields renamed
(DaggerfallUnityItem.FromItemData :640-700), so the port's classic
importer `classicItemFromRecord` is the pattern and the map is:
`shortName` -> `name`; `nativeMaterialValue` -> `material`; `value1` ->
`value`; `value2 >> 16` -> `flags` (the low sixteen are DFU's own
`unknown`); `hits1`/`hits2` -> `currentCondition`/`maxCondition`;
`hits3 >> 8` -> `typeDependentData`; `dyeColor` -> `dye`;
`currentVariant` -> `variant`; `itemGroup` (the enum's NAME is the
port's group string) + `groupIndex` -> `templateIndex` through
`GROUP_TEMPLATE_INDICES`; `legacyMagic` (flat type/param pairs) ->
`enchantments`; `customMagic` -> `customEnchantments`; `isQuestItem`/
`questUID`/`questItemSymbol` -> `questItem`/`questUID`/`questSymbol`;
`trappedSoulType`, `poisonType`, `potionRecipe` -> `potionRecipeKey`,
`repairData`, `timeForItemToDisappear`, `timeHealthLeechLastUsed`,
`artifactIndexBitfield`, `stackCount`, `enchantmentPoints`, `message`,
`weightInKg`, the four texture fields: direct. `artifact` and
`isIdentified` are the flag bits (0x800, 0x20) as the classic importer
reads them; `magic` is "carries an enchantment". `uid` is consumed by
the equip table and the light source and does not ride the item.

### The other files

| File | Port field | Verdict | How |
|---|---|---|---|
| `QuestData.txt` (QuestMachineData_v1: siteLinks, quests) | `quest.machine` | converted | the port's quest machine SERIALISES IN DFU'S OWN SHAPE (QuestSaveData_v1 field for field, `test/quest*` pins), so a quest comes over whole; the three differences are mechanical - a `Type` is its class name, a Symbol is `{original}`, the questors Dictionary is an array - and a quest the port cannot reconstruct is dropped under the per-quest catch DFU itself runs (QuestMachine.cs:1918-1944) |
| `ConversationData.txt` (SaveDataConversation) | `talk` | converted | the same five members; the Dictionaries become the port's arrays |
| `DiscoveryData.txt` (Dictionary<int, DiscoveredLocation>) | `discovery` | converted | `locations` by `mapID & 0xfffff`; `buildings` by the port's location id string |
| `NotebookData.txt` (NotebookData_v1) | `quest.notebook` | direct | the same two line-list arrays |
| `FactionData.txt` (FactionData_v2.factionDict) | `factionRep` | converted | the columnar snapshot (ids, rep, flags, power, the nine relation columns) off the dictionary |
| `bio.txt` | `backStory` | direct | |
| `Screenshot.jpg` | the slot's picture | direct | the JPEG bytes as the slot store's data URL |
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
still running, and any mod's own saved state.

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
  queues are null in the port and empty lists in DFU - the converter
  writes what the restore reads, and the pin compares
  restore-equivalents rather than bytes;
- **an ItemData_v1 carries every field**, so an item that came through
  one carries the zeros a port mint leaves out - the same item to the
  restore, with more columns written down.

The rumor mill's round trip is byte-equal. The talk tree's and the NPC
session's halves are pinned by shape (their restores relink against a
live machine).

## The pins

`test/dfusave.test.js` (9), `test/dfusave_import.test.js` (18),
`test/dfusave_door.test.js` (4) - 31 pins; 31 mutants, 31 killed (the
reader's 13, the converter's 18, of which two survived the first pins
- the sword sat first in the pack, so a slot written on `items[0]` was
invisible, and the temple was Akatosh, the first divine - and were
re-aimed). Every enum table (51) and the effect-key table are
regenerated from the reference clone under PY1's `DFU_PATH`
convention, and the file roster, the version, the mod-file name and
the career inverse's bit positions are read off the C#.

**NOT SEEN AGAINST A REAL SAVE.** No DFU save is in the tree. The
envelope rules are Full Serializer's documented format and the field
names are read off the C#; the corpus gate (`DFU_SAVES_PATH`) is armed
for the first real one, and where a real file disagrees, the pin that
reads it is the thing to correct.
