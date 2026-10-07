# FORAGING - Harbinger451's mod, 1:1, and the professions' tools (FORAGE0, the design record)

**Status: FORAGE1-FORAGE4 SHIPPED on the branch (2026-09-28) - Foraging whole, both lanes: the tools, the foods, the quests, the shelves; audited the same day, which found a sixth mend (Q13) and nine smaller faults, all fixed; FORAGE3's three loot hooks, on DFU's two loot events made one home each; and FORAGE4's online wait (see the records at the end).** What is left is the professions' (section 14, PROF0). Opened 2026-09-28
beside the professions (`06-Systems/Professions-Arc.md`, PROF0) and the seats (`11-Multiplayer/Seats-Arc.md`,
SEAT0), whose marks it uses: **DECIDED (Mac)**, **DECIDED** (the record's, at Mac's instruction), **FACT** (read in
this tree, the mod's IL or DFU's source), **MEASURED**.

## Mac's words

- Handing over `Foraging_1260_1.7` (the shipped zip): **"Heres this for life skills"**
- Asked whether the port has Harbinger451's permission: **"Yes, permission"**
- The brief the mod answers (PROF0): "Life skills will utilize things like tree chopping, picking up ingredients,
  fishing, etc. Active player involvement and actual UI integration for life skills."
- "I want you to make the decisions with the intent as being as detailed as possible." / "This is your baby, I want
  you to go in depth, be as detailed and possible and make this yours. Absolute perfection."
- Asked whether to fix the five bugs a player would call broken (12), and whether QAE's four actions need Jagget's
  word: **"Your lead"** (2026-09-28).

What the record takes from them, DECIDED (Mac): Foraging is ported **1:1, as its own mod**, and **its tools become the
professions' tools**. Everything else below is the record's decision at Mac's instruction, or a FACT.

## 1. The mod

**Foraging 1.7** for Daggerfall Unity 1.1.1, by **Harbinger451** (Nexus 1260 by the archive's name; GUID
`603e3883-dbdc-4a5f-8683-6c57e14a331b`). "In the Wilderness "use" a Wood-Axe to chop Wood, a Pick-Axe to mine Gems
or Metals, a Sickle to cut Plants, a Spade to Rob Graves, a Fishing-Net to Fish, and a Basket to Forage for Food."

It is one compiled script (`ForagingMain.cs`, shipped as `Foraging.dll`, 38,912 bytes, no source), twelve item
templates (1600-1611), a quest pack of 22 quests and a quest list, and seven textures of the author's own. It needs
**Quest Actions Extension** (Jagget, 2.0.0, `github.com/Jagget/QuestActionsExtension` at `56a407e`) for four quest
actions (9.2). **The port's law is the IL** (dumped with `tools/ilDump.py`, 6,551 lines): every rule below names the
offset it was read at, `IL_xxxx` in hex. Engine semantics were checked against DFU's own source and QAE's, not memory.

### 1.1 The source, and when it is carried

The shipped zip (Mac, 2026-09-28) holds `Mods/foraging.dfmod` (a Unity AssetBundle) and `Docs/ForagingReadme.txt`.
Its fingerprints, so a copy handed over again can be checked against the one this record was read from:

| File | sha256 |
|---|---|
| the zip, `Foraging_1260_1.7` | `bee577545f5325f25b98ab44d6784e853f0d7f76deba6c6b37188c7ed921f6bd` |
| `Mods/foraging.dfmod` | `29394c1887d0e0986cd22adc24c0af46069696a69b709415caac8dacc91e8563` |
| `Foraging.dll`, out of the bundle | `3834aa3a313f545c45de6008cafdb05f0497743e5ff573c7c0af4d29762016a7` |

**Nothing is vendored at FORAGE0**, DECIDED: in this tree a vendored folder is a shipped mod - the About screen must
credit it (CR1, `test/credits.test.js`) and a credited mod must have a working row on the Features home (WM3), which a
mod with nothing built cannot honestly have. So FORAGE1 carries the files, the README, the registry row, the credit
and the Features row together, as `vendor/foraging/`:

- `foraging.dfmod.json` - the manifest verbatim (title, version 1.7, author, DFUnity 1.1.1, the GUID, and the 33 files
  it was built from: `ForagingMain.cs`, the item templates, 23 quest-pack files, seven textures, itself);
- `ItemTemplates.json` - the twelve templates, verbatim;
- `Foraging.dll` byte for byte, and `il/Foraging.il.txt`, its IL (Warm Ashes - Ships' precedent: the bundle carries
  no C# source);
- `Quests/` - `QuestList-ForagingQuests.txt` and the 22 quests, verbatim, named as the manifest names them;
- `Textures/` - the author's seven, `11600_0-0.png` to `11606_0-0.png` (the net 128 x 128, the others 64 x 64), taken
  out of the bundle with UnityPy;
- `ForagingReadme.txt` verbatim, and a `README.md` with the provenance and the permission line - Mac's "Yes,
  permission" recorded, the author's own words still to paste (the registry's RECORD OPEN).

## 2. The laws this port keeps

1. **1:1, IN BOTH LANES** - DECIDED (Mac). What a tool does from the inventory, what the quests do, what the loot and
   shop hooks add, and every message, are the mod's, offline and online. Every quirk the build carries is kept and
   recorded (section 12) - a Ledger B row, "verbatim quirks preserved" - but the six a player would call broken,
   which FORAGE-FIX mends (Mac: "Your lead"). **SUPERSEDED ONLINE for the five profession tools** (FIELD BUGS
   2026-09-30b TOOL-USE - Mac: "I dont care about DFU. We're our own thing now"): with the professions the account's,
   their Use is the professions' (law 4, below). Offline, and a guest's lane, stay 1:1.
2. **THE BUILD, NOT THE README** - FACT: the readme and the build disagree in places (the Pick-Axe reads Agility, not
   Endurance; the readme names four foods the build has no template for). The port follows the build, as DFU would
   run it.
3. **ONLINE CHANGES ONE THING: THE CLOCK.** The shared clock is nobody's to move (WORLD5: `sharedClassicMinutes`,
   `src/net/wire.js`), so QAE's `raise time by` cannot run online. It becomes a wait the player sits through (13.1) -
   the rule Climates & Calories' hunt followed (SURV6's `HUNT_WAIT_PER_HOUR`; the hunt RETIRED by HUNT-OUT,
   2026-10-04, the rate lives on as `WAIT_PER_HOUR` in `src/scenes/foragingWait.js`). MERGE 2 (2026-09-29, main's LIVED1 - "your own time"): and, after
   the wait page, the quest's time passes on the character's OWN clock online - the host's raiseTime is
   the character's time in both lanes, the shared clock still nobody's. Two small things change with it, both for the professions: the console
   command refuses (8), and - BUILT with the professions (PROF1, 2026-09-28) - the six tools shelve whatever the switch
   says (law 6). Nothing else about Foraging changes online. (AUDIT 28 found this read as built before it was; PROF1
   built it: `systems/foragingInstall.js` foragingCustomItemsForGroup.)
4. **ONE ITEM, TWO GESTURES** - DECIDED. A Foraging tool **used from the inventory** is Foraging, both lanes. The same
   tool, **carried to a node** online, is the profession's tool: Interact at the node plays the profession's act
   (section 14). Neither gesture changes the other. **SUPERSEDED ONLINE** (FIELD BUGS 2026-09-30b TOOL-USE): with the
   professions the account's, the Wood-Axe, the Pick-Axe, the Sickle, the Basket and the Fishing-Net have one gesture -
   their Use from the hotbar or a quick slot at a node of their own kind is Interact there, and anywhere else (or from
   the open pack) it gives none of Foraging's yields, quests or wear and says where the profession is done
   (`systems/foragingInstall.js` useForagingTool, `scenes/gatherHost.js` useTool). The Spade stays Foraging's.
5. **THE AUTHOR'S ART IS VENDORED WORK, NOT NEW ART.** The seven textures are Harbinger451's, to be carried with
   Mac's word of permission, as Handheld Torches' 39 are RedRoryOTheGlen's. PROF0's law 6 ("no new committed art") is about art
   the port would make; it is not broken by a vendored mod's own.
6. **A MOD, SWITCHED** - DECIDED: a Mod Authored row on the Features home (FT9's shape) and a credit on the About
   screen (`src/ui/credits.js`); on by default (MO1). The switch governs Foraging's uses, its quests, its loot and
   shop hooks. The templates are registered whatever the switch says, so a saved tool never vanishes (a tool with the
   switch off is an inert item, as an unloaded mod's would be). **The shelves' registry answers Foraging's items only
   while its switch is on** (RRI's answers nothing while off), with one exception DECIDED for PROF1 and BUILT there
   (2026-09-28, `systems/foragingInstall.js` foragingCustomItemsForGroup): **online, the six tools shelve whatever the
   switch says** - the foods and the Wood Bundle stay the switch's - because the professions' acts need them and the
   professions are the server's, not a player's preference; the acts never ask Foraging's switch
   (`foragingActRefusal`, `foragingToolIn`, `wearForagingTool`). A switched-off
   Foraging has no console command either - no HELP line, "Command FORAGING_TOOLS not found." (AUDIT 28 F7,
   `systems/consoleCommands.js` gateConsoleCommand).

## 3. What already stands (FACT)

| DFU / mod member Foraging calls | The port's home |
|---|---|
| `ItemHelper.RegisterCustomItem` | `registerCustomTemplates` (`src/systems/itemTemplates.js`) - C&C's 530-541 and RRI's 513-526 already register there |
| `DaggerfallUnityItem.UseItem` (a class override, asked first by `DaggerfallInventoryWindow.UseItem`) | `registerItemUseHandler` / `itemUseHandler` (`src/systems/itemTemplates.js`), asked by `src/systems/useItem.js` ahead of the ladder; `usable` answers the card's Use |
| `QuestListsManager.RegisterQuestList` | `registerQuestList(name, isOn)` (`src/systems/quest/questLists.js`) |
| `EnemyDeath.OnEnemyDeath` | `registerEnemyDeathHandler` (`src/scenes/corpseMarker.js`, UL1) |
| `ConsoleCommandsDatabase.RegisterCommand` | `registerCommand` (`src/systems/consoleCommands.js`) |
| `PlayerGPS.IsPlayerInTown(true, true)` | `isPlayerInTown` (`src/systems/nearbyObjects.js`) |
| `GameManager.AreEnemiesNearby(true, false)` | `areEnemiesNearby(foes, { resting: true, includingPacified: false })` (`src/systems/encounters.js`) |
| `DaggerfallUnityItem.LowerCondition` | `lowerCondition` (`src/systems/equip.js`), DFU's "itemHasBroken" popup with it |
| `DaggerfallUI.AddHUDText` | `hudText` (`src/systems/notify.js`) |
| `DaggerfallMessageBox` | `src/ui/messageBox.js` |
| `PlayerMotor.OnExteriorWater` (None / Swimming / WaterWalking) | `ON_EXTERIOR_WATER` (`src/player/exteriorSurface.js`); the streaming host classifies all three, and since FORAGE2 both exterior hosts keep them as `player.onExteriorWaterMethod` beside the Swimming boolean |
| `WhenAttributeLevel`, `Climate`, `pc at any`, `pick one of`, `create foe`, `give pc`, `start timer`, `log`, `make permanent`, every Quests-Items class Foraging names | `src/systems/quest/actions.js`, `src/systems/quest/place.js` (`isPlayerAtDungeonType`) |
| DFU's parser dropping a line no action matches ("Action not found. Ignoring") | `src/systems/quest/task.js` keeps such a line in `pendingActionLines`, which runs nothing |
| Region 31, the sea's politic region | `src/formats/mapsFile.js` |
| Climates & Calories' Apple 532, Orange 533, Raw Fish 535, and whether it is on | `TEMPLATE` (`src/systems/survival/food.js`); `survivalOn()` (`src/systems/survival/switch.js`) |
| `DaggerfallLoot.StockShopShelf`'s custom-item loop | `src/systems/shopStock.js`, asking `customItemsForGroup` |
| The save | items are snapshotted whole (`src/systems/save.js`), so a tool's condition rides |

**Three gaps**, each closed by a FORAGE slice (section 17):

- ~~**The shelf's custom items are RRI's alone.**~~ **CLOSED by FORAGE1** (brought forward from FORAGE3, because a
  tool no shop sells is a mod nobody can play): `customItemsForGroup` lives in `src/systems/itemTemplates.js` now,
  DFU's GetCustomItemsForGroup with one provider per mod - RRI's (`rriCustomItemsForGroup`, the first) and
  Foraging's - and the shelf, the random weapon and armour rolls and the RRI quest line all read it there.
- ~~**`PlayerActivate.OnLootSpawned` is a direct call.**~~ **CLOSED by FORAGE3** (`src/systems/containerLoot.js`, one
  home, RRI's subscriber seeded first; raised at both shelf doors and at a house container). As it stood: the hosts
  call RRI's `onShopShelfStocked`
  (`src/systems/rriKits.js`) by name after a shelf stocks, and nothing after a house container stocks. DFU raises the
  event for both. FORAGE3 makes it a handler registry in UL1's shape, RRI's subscriber the first.
- ~~**`LootTables.OnLootSpawned` is raised only for RRI, and not whole.**~~ **CLOSED by FORAGE3** (`src/systems/loot.js`
  `raiseTabledLootSpawned`, raised for every key GenerateLoot finds, at the three pile sites with each one's index). As
  it stood: `addPileLootExtras`
  (`src/systems/loot.js`) calls RRI's subscriber by name at its end - after an early return for loot keys outside
  J-O, where DFU raises the event for every key (LootTables.cs:163) - and passes no location index, while Foraging
  switches on the index (IL_0873), not the key (key N alone covers six dungeon types at four different rates, and the
  Coven's Q never reaches the tail). FORAGE3 raises it for every key, with `{ locationIndex, key, items }`, as a
  registry in UL1's shape, at each place a pile is rolled: the dungeon piles (`scenes/dungeonContext.js`, WORLD8's
  hourly re-roll included - it is a new GenerateLoot), the building-interior piles (`scenes/interiorContext.js`) and
  the World of Daggerfall camps (`scenes/world.js`).

## 4. The items

`ItemTemplates.json`, verbatim (FACT). Every one is registered in **group 9, UselessItems2**, by its class's
constructor `base(ItemGroups.UselessItems2, idx)` (e.g. IL_0dda-IL_0de7). Every other field is 0 or false: no
variants, no ingredient, no stacking - **none of them stack** (no class overrides `IsStackable`), so every fish and
apple is its own row.

| Id | Name | Weight | HP | Price | Rarity | Picture | Use |
|---|---|---|---|---|---|---|---|
| 1600 | Wood-Axe | 3.5 | 50 | 175 | 10 | 11600/0 (the author's) | 6.1 |
| 1601 | Pick-Axe | 4.0 | 50 | 225 | 10 | 11601/0 (the author's) | 6.2 |
| 1602 | Sickle | 2.0 | 50 | 150 | 10 | 11602/0 (the author's) | 6.3 |
| 1603 | Fishing-Net | 2.5 | 50 | 150 | 10 | 11603/0 (the author's, 128 x 128) | 6.4 |
| 1604 | Wood Bundle | 2.5 | 50 | 75 | 10 | 11604/0 (the author's) | none: a trade good and the fetch quests' item |
| 1605 | Fish | 1 | 50 | 30 | 100 | Daggerfall's 211/9 | eat, 7 |
| 1606 | Spade | 3.5 | 50 | 200 | 10 | 11606/0 (the author's) | 6.5 |
| 1607 | Basket | 1.0 | 50 | 100 | 10 | Daggerfall's 205/9 | 6.6 |
| 1608 | Apple | 0.2 | 1 | 10 | 100 | Daggerfall's 213/1 | eat, 7 |
| 1609 | Orange | 0.2 | 1 | 10 | 100 | Daggerfall's 213/0 | eat, 7 |
| 1610 | Mushroom | 0.2 | 1 | 20 | 5 | Daggerfall's 504/23 | eat, 7 |
| 1611 | Egg | 0.2 | 1 | 20 | 5 | 11605/0 (the author's) | eat, 7 |

- **The ids are free** (FACT): the port's customs are RRI 513-526, C&C 530-541, the Thunderlock 560-561, the Sigil
  Stone 570, PROF0's reserved 600-699 and Deep Waters' 9001-9007.
- **The pictures**: the author's seven through the texture-replacement door (`addVendorTextures`,
  `src/systems/textureReplacement.js`), from `vendor/foraging/Textures/` (1.1), as Handheld Torches' are; the other five
  are Daggerfall's own records out of the player's files.
- **A tool lasts 50 uses**: 50 HP, and each use is `LowerCondition(1)`.
- **Save**: DFU restores a mod item's class by `ItemData_v1.className` (each class's `GetSaveData`). The port knows an
  item by its template, so the class name is not needed; the item's condition rides the save as any item's does.

## 5. Using a tool - the common contract

FACT (section 5 of the IL read). Each of the six tools overrides `bool UseItem(ItemCollection collection)`; DFU's
inventory asks it first. **Returning false falls through** to DFU's own ladder, which does nothing visible for a
variant-less group-9 item. The inventory then refreshes.

**The six checks, in this order.** Each failure is a HUD line (`AddHUDText`, the scrolling text, not a box) and
`return false`:

1. **Not inside** - `IsPlayerInside || IsPlayerInsideDungeon || IsPlayerInsideDungeonCastle`. DFU sets
   `IsPlayerInside` in dungeons too, so the first term already covers them.
2. **Not in a settlement** - `PlayerGPS.IsPlayerInTown(mustBeInLocationRect: true, mustBeOutside: true)`: true only
   inside the rect of a TownCity, TownHamlet, TownVillage, HomeFarms, HomeWealthy, Tavern or ReligionTemple. A
   dungeon's exterior, HomePoor, ReligionCult, Coven and Graveyard all **pass**.
3. **Daylight** (not the Spade) - refused when `Hour <= 6 || Hour >= 18`: allowed **07:00:00 to 17:59:59**.
4. **Not at sea** (Wood-Axe, Pick-Axe, Sickle, Basket) - refused when the climate is **223, Ocean**.
5. **No enemies near** - `AreEnemiesNearby(resting: true, includingPacified: false)`, DFU's rest test: a hostile
   foe, not the player's ally, that can see the player, or is within **12** units and would have been spawned in
   classic; or an active foe spawner within 1024 x GlobalScale.
6. **Not fully encumbered** - refused when `(float)CarriedWeight >= MaxEncumbrance` (the pack and the gold; not the
   wagon).

**After the checks**: the yield (if the code gives one), the **result box** (where the tool shows one), the quest,
then the **wear**:

- `LowerCondition(1)`; if condition is still above 0, `return true`.
- Otherwise the HUD line "Your <Tool> broke.", `RemoveItem`, `return false`. DFU's own LowerCondition has already
  shown its "itemHasBroken" popup (and removed the item unless AllowMagicRepairs), so **a break shows two notices**,
  and the use it broke on still counted - its yield given, its quest started.

**The result box**: `new DaggerfallMessageBox(uiManager, TopWindow, wrapText: false, posY: -1)`, the text,
`ClickAnywhereToClose`, the parent panel's background **clear**, shown over the still-open inventory. It is DFU's
own window, so the port draws it native (THE NATIVE-WINDOW RULE).

**The quest**: `QuestMachine.StartQuest(QuestListsManager.GetQuest(name, factionId: 0))`. Every item the code makes
goes to the player's pack (`Player.Items`), not to the collection it was used from.

**Attributes** are the live stats; an average is `(A + B) / 2` in integer division. **The bands**, used everywhere:
**<=39 / 40-59 / 60-79 / >=80**.

## 6. Tool by tool

### 6.1 Wood-Axe (1600) - `WoodAxeItem.UseItem`, IL_0df4-IL_12ef

| Check | IL | Refusal |
|---|---|---|
| inside | IL_0df4 | "You cannot find wood to chop in here!" |
| settlement | IL_0e3d | "You cannot chop wood in a settlement!" |
| daylight | IL_0e66 | "You need daylight to chop wood effectively!" |
| sea | IL_0eab | "You cannot find wood to chop out here!" |
| enemies | IL_0ed7 | "You cannot chop wood with enemies nearby!" |
| encumbered | IL_0efb | "You cannot chop wood when fully encumbered!" |

The roll (IL_0f28-IL_110c): `avg = (Intelligence + Strength) / 2`; "desert" is climate 224 or 225. The draw is
uniform over the row's list, and is the number of **Wood Bundles** (1604):

| avg | Desert (224, 225) | Everywhere else |
|---|---|---|
| <=39 | {0,0,0,0,1} | {0,0,0,1,2} |
| 40-59 | {0,0,0,1,1} | {0,0,1,2,3} |
| 60-79 | {0,0,1,1,1} | {0,1,2,3,4} |
| >=80 | {0,1,1,1,2} | {1,2,3,4,4} |

"You were able to chop and gather one Wood Bundle!" (two, three, four: "... two Wood Bundles!"); 0: "You were unable
to chop and gather any usable wood!". The result box, then **ChopWoodQuest**, then the wear ("Your Wood-Axe broke.").
The code passes no time and takes no fatigue; the quest does.

### 6.2 Pick-Axe (1601) - `PickAxeItem.UseItem`, IL_1328-IL_1622

Refusals: "You cannot mine in here!", "... in a settlement!", "You need daylight to mine effectively!", "You cannot
mine out here!", "... with enemies nearby!", "... when fully encumbered!".

`avg = (Intelligence + Agility) / 2` - **the IL reads `LiveAgility`** into the field the author named `IEndurance`
(IL_147a); the readme says Endurance. The band picks the quest, and the code shows no box and gives no yield:

| avg | <=39 | 40-59 | 60-79 | >=80 |
|---|---|---|---|---|
| Quest | MiningQuestWeakest (IL_149f) | MiningQuestWeaker (IL_150b) | MiningQuestWeak (IL_1577) | MiningQuest (IL_15d2) |

### 6.3 Sickle (1602) - `SickleItem.UseItem`, IL_165c-IL_1a68

Refusals: "You cannot forage for plants in here!", "... in a settlement!", "You need daylight to forage for plants
effectively!", "You cannot forage for plants out here!", "... with enemies nearby!", "... when fully encumbered!".

No attribute is read here; the quest reads Intelligence. The quest by climate, first match:

| Climate | Quest |
|---|---|
| 224 Desert, 225 Desert2 | ForageAridPlantsQuest (IL_1790) |
| 229 Subtropical, 226 Mountain | ForageWinterPlantsQuest (IL_1817) |
| 228 Swamp, 227 Rainforest | ForageSummerPlantsQuest (IL_189e) |
| any other (230 MountainWoods, 231 Woodlands, 232 HauntedWoodlands) | by the month (0-based): 8-11, 0, 1 (Hearthfire to Sun's Dawn) Winter (IL_1925); 2-7 (First Seed to Last Seed) Summer (IL_1a0c) |

No box.

### 6.4 Fishing-Net (1603) - `FishingNetItem.UseItem`, IL_1aa4-IL_207e

| Check | IL | Refusal |
|---|---|---|
| `IsPlayerInside \|\| IsPlayerInsideDungeonCastle` | IL_1aa4 | "You cannot fish in here!" |
| in a dungeon: allowed only swimming in an Ocean pixel | IL_1adc | "You cannot fish in here!" - **dead code**, check 1 has already refused |
| settlement | IL_1b2a | "You cannot fish in a settlement!" |
| daylight | IL_1b53 | "You need daylight to fish effectively!" |
| enemies | IL_1b98 | "You cannot fish with enemies nearby!" |
| encumbered | IL_1bbc | "You cannot fish when fully encumbered!" |
| water | IL_1be9-IL_1c45 | "You need to be in water or on the ocean to fish!" |

There is **no sea refusal**: the sea is water. **The water test** passes on any of: `PlayerMotor.IsSwimming`;
`OnExteriorWater == Swimming` (a deep tile, grounded); `OnExteriorWater == WaterWalking` - water-walking **or standing
on a shallow shore tile** (tilemap 5, 6, 8, 20, 21, 23, 30, 31, 33-36, 49); climate 223 (a boat or a pier at sea);
region **31** (the sea's politic region - Iliac Puddle No More's case, 11).

`avg = (Intelligence + Agility) / 2`; the draw is the number of fish:

| avg | <=39 | 40-59 | 60-79 | >=80 |
|---|---|---|---|---|
| Fish | {0,0,0,1,1,2} | {0,0,1,1,2,2} | {0,1,2,2,3,3} | {1,2,2,3,3,4} |

Each fish is C&C's **Raw Fish (535)** when C&C is on (IL_1d1c-IL_1d44), otherwise Foraging's **Fish (1605)**. "You
cast your Fishing Net and catch one Fish!" (two, three, four: "... catch two Fish!"); 0: "You cast your Fishing Net,
but don't catch any Fish!". The box, **FishingQuest**, the wear. **No time passes** here or in the quest - the readme:
C&C's cold makes time in the water dangerous.

### 6.5 Spade (1606) - `SpadeItem.UseItem`, IL_20b8-IL_2619

No daylight check and no climate check. Refusals: "You cannot dig up a grave here!", "... in a settlement!", **"You
can only dig up a grave in a cemetery!"** (IL_212a: `IsPlayerInLocationRect && CurrentLocationType == 12`,
Graveyard), "... with enemies nearby!", "... when fully encumbered!".

`avg = (Intelligence + Endurance) / 2` picks the quest by band - `GraveRobbingQuestWeakest` / `Weaker` / `Weak` /
`GraveRobbingQuest` - with no box. With **Cheb's Necromancy** on (IL_21b5), first a 1-in-4 draw ({0,0,0,1}) for a
corpse (its template 6666, group 1) and a box ("Among the grave goods is a fresh corpse ideal for Necromancy!" or
"The corpse within the grave you're robbing has degraded to dust!"), and the `GraveRobbingCNQuest` family instead.

### 6.6 Basket (1607) - `BasketItem.UseItem`, IL_2654-IL_4a09

Refusals: "You cannot forage for food here!", "... in a settlement!", "You need daylight to forage for food
effectively!", "You cannot forage for food out here!", "... with enemies nearby!", "... when fully encumbered!".

**Intelligence alone**, read before the checks (harmless). Two draws: the count from the INT band's list, then the
food from the block's type list (**2** fruit, **3** Mushroom 1610, **4** Egg 1611). The fruit is **Orange** in blocks
A-C and **Apple** in D-E: C&C's 533 / 532 when it is on, else Foraging's 1609 / 1608.

| Block | When | Count, INT <=39 / 40-59 / 60-79 / 80+ | Food |
|---|---|---|---|
| A | 224, 225 (deserts) | {0,0,0,0,0,1} / {0,0,0,0,1,1} / {0,0,0,1,1,1} / {0,0,1,1,1,1} | {2,3,4} |
| B | 229 Subtropical | {0,0,0,1,1,2} / {0,0,1,1,2,2} / {0,1,1,2,2,3} / {1,1,2,2,3,3} | {2,2,3,4} |
| C | 228 Swamp, 227 Rainforest | {0,0,1,2,2,3} / {0,1,2,2,3,3} / {1,2,2,3,3,4} / {2,2,3,3,4,4} | {2,2,3,4} |
| D | 226 Mountain, or month 8-11, 0, 1 | as B | {2,3,3,4,4} |
| E | everything else (months 2-7 in 230, 231, 232) | as C | {2,3,4} |

"You manage to pick one Orange!" (two to four: "... two Oranges!"), the same for Apple and Mushroom, "You manage to
find one Egg!" (... "four Eggs!"); a count of 0, or a pair no case matches: "You could not find any food to forage!".
The box, **ForageFoodQuest**, the wear.

## 7. Food, and the Wood Bundle

Every food's `UseItem` (FACT): a HUD line, `IncreaseFatigue(n, assignMultiplier: true)` (n points), health or
magicka, `RemoveItem` (one - they do not stack), `return true`. No checks, no hunger: C&C's own 532, 533 and 535 are
C&C's and eaten by C&C.

| Food | IL | Line | Fatigue | Health | Magicka |
|---|---|---|---|---|---|
| Fish 1605 | IL_4a63 | "You eat a fish and feel better for it!" | +15 | +5 | - |
| Apple 1608 | IL_4ac7 | "You eat an Apple and feel better for it!" | +10 | +5 | - |
| Orange 1609 | IL_4b2b | "You eat an Orange and feel better for it!" | +10 | +5 | - |
| Mushroom 1610 | IL_4b8f | "You eat a Mushroom and feel better for it!" | +5 | - | +10 |
| Egg 1611 | IL_4bf3 | "You eat an Egg and feel better for it!" | +15 | +10 | - |

The amounts are fixed (the readme says "variable"). The Wood Bundle has no `UseItem`: using it does nothing.

## 8. The console command

`Foraging_Tools` (IL_4c54-IL_4cd6): "Adds one of each Foraging Tool to player's inventory.", usage "Foraging_Tools 0/1
n" - the arguments are ignored. It adds the six tools (1600, 1601, 1602, 1603, 1606, 1607; no bundle, no food) and
answers "Foraging Tools added". Registered in `Start`, inside a try; a failure logs `Error : Could not register command:
RegisterForagingCommands: "{0}"` (IL_02b1). Through `registerCommand`, whole - **offline**. DECIDED: **online it
refuses** ("Foraging Tools are not given online."): the console door is gated only by a setting the player holds
(`src/systems/consoleCommands.js`), and free tools would skip the shelves and the crafts the professions keep busy. The
service never sees the pack, so this is a courtesy to honest players, not a defence (PROF0 5.1).

## 9. The quests

`QuestList-ForagingQuests`: the 18 activity quests are group `None` (started only by the tools); the four fetch
quests are meant for the social pools (9.8) - and as built are filed in none (Q13). Registered by `Awake` (IL_02e5) with `RegisterQuestList("ForagingQuests")`.

### 9.1 What the scripts rely on (FACT)

- **`when attribute X is at least N`** is DFU's WhenAttributeLevel, on the live stat.
- **`climate desert2` binds Desert (224)** and **`climate mountainwoods` binds Mountain (226)**: DFU's Climate pattern
  is an unanchored alternation whose leftmost alternative wins, and the port reproduces it (`actions.js`).
- **`when A and B or C ...` is read left to right**, no precedence: `((A && B) || C) || ...` (WhenTask).
- **`pc at any dungeon5`** needs `IsPlayerInsideDungeon` (`Place.IsPlayerAtDungeonType`).
- **`end quest`** starts a two-tick grace before the quest ends.
- **A quest item not made permanent** is removed as an orphan once its quest is gone; so every reward line is paired
  with `make _x_ permanent`.
- **The item classes** (Quests-Items): small_plant 15, large_plant 16, organs 17, skin 18, mythic 19, misc 20,
  element 21, mineral 22, gem 14, flamable 9 (the classic list only - never a mod's item), trinket 25, religious 10;
  random_map 27/8, pearl 22/1, root_tendrils 16/4, mark 25/4, cloth_amulet 25/6, dead_body 26/5; `gold range 1 to 8`;
  and DFU's generators weapon, armor, magic_item, book, potion, mens_clothing, womens_clothing.

### 9.2 The four actions to add, and the one to ignore

From Quest Actions Extension (`Actions/*.cs` at `56a407e`), restated in `src/systems/quest/questActionsExtension.js`,
FORAGE1:

| Action | What it does |
|---|---|
| `raise time by H:MM` (RaiseTime) | `WorldTime.Now.RaiseTime(H * 3600 + MM * 60)`: a bare clock advance, no rest simulated. (QAE's pattern lacks a `|` between its second and third alternatives, so it has three, not four: `raise time to H:MM saying N`, the glued `raise time to H:MMraise time by H:MM saying N`, and the bare `raise time by H:MM` - which is what `raise time by H:MM saying N` matches, its saying unread. CreateNew refuses a line whose four numbers are all 0.) Online: 13.1 |
| `reduce player fatigue by N` (ReducePlayerFatigue) | **N is a percent of the maximum**: `CurrentFatigue = max(1, (int)(CurrentFatigue - MaxFatigue * N / 100f))`, on the raw (x64) values, and the setter then clamps it to the maximum |
| `player possesses N items class C subclass S` (PlayerPossesses) | a trigger, true while `Items.Contains((ItemGroups)C, S)` and `SearchItems` count at least N, **quest items excluded, the wagon counted**; a match needs `item.ItemGroup == C` |
| `player handsover N items class C subclass S` (PlayerHandsover) | removes N such items - **with QAE's own bug**: its wagon arm assigns `WagonItems = player.Items.SearchItems(...)`, so pack items are counted twice and the wagon's are never removed (Q11) |

`update-quest-item _x_ Leveled` matches **no** QAE pattern in any version (QAE's is `... set-material <material>`),
so DFU drops it and it does nothing. The port's parser already keeps an unmatched line inert (3); a pin says so.

### 9.3 The found-item bonus (Chop, Fishing, Food, Plants, Mining)

Luck tasks `_weakluc_` >=0, `_evenluc_` >=40, `_strongluc_` >=60, `_verystrongluc_` >=80 - four exclusive bands. A
10-entry pick holds 1, 2, 3 or 4 `_1bonus_`: **10% / 20% / 30% / 40%**. `_0bonus_` ends the quest.

- Chop, Food, Plants, Mining: `_1bonus_` picks from {ingredient x4, random item x1}. `_randomitem_`, 1/7 each:
  weapon, armor, magic, book, potion, map, misc (the weapon and armour carry the inert `update-quest-item`).
  `_randomingredient_`, 1/8 each: gold 1-8, flamable **x2**, organ, skin, mythic, trinket, mineral.
- Fishing: `_1bonus_` picks 1 of 9: pearl x2, root_tendrils x2, random_map, skin x2, mark, cloth_amulet.
- Each bonus says its line, gives the item, makes it permanent and ends the quest. Chop, Fishing and Food roll it at
  start; Plants after `_plantchopped_`; Mining after `_mined_`.

### 9.4 Chop, Fishing, Food

| Quest | At start | Bonus |
|---|---|---|
| ChopWoodQuest | fatigue **20%**, time **1:30** | 9.3 |
| ForageFoodQuest | fatigue **10%**, time **1:00** | 9.3 |
| FishingQuest | fatigue **10%**, **no time** | Fishing's pool |

The code has already given the bundles, fish and food; these quests are the cost and the bonus.

### 9.5 Plants (Arid, Winter, Summer)

The one Intelligence band that fires takes fatigue **15%** and time **1:30**, then draws the number of plants
uniformly from six:

| Quest | INT 0-39 | 40-59 | 60-79 | 80+ |
|---|---|---|---|---|
| Arid | {0,0,0,0,0,1} | {0,0,0,0,1,1} | {0,0,0,1,1,2} | {0,0,1,1,2,2} |
| Winter | {0,0,0,1,1,2} | {0,0,1,1,2,2} | {0,1,1,2,2,3} | {1,1,2,2,3,3} |
| Summer | {0,1,1,2,2,3} | {1,1,2,2,3,3} | {1,2,3,3,4,5} | {2,3,3,4,5,6} |

The plant slots alternate small_plant and large_plant (1 small, 2 large, 3 small ...). None: "You could not find any
suitable Plants to forage!". Then the bonus.

### 9.6 Mining (MiningQuest, Weak, Weaker, Weakest)

At start: `pc at any dungeon5 set _atmine_` - **never true**, since the Pick-Axe refuses in a dungeon, so the readme's
"outside at a mine location" bonus is dead - and a 50/50 pick of gems or elements. Four tasks, each of which, when it
fires, takes fatigue **25%** and time **2:00** and draws a count:

| Task | When |
|---|---|
| `_elementsbounty_` / `_gemsbounty_` | `_elements_` (or `_gems_`) `and _desert_ or _desert2_ or _mountain_ or _mountainwoods_ or _atmine_` |
| `_elementsscare_` / `_gemsscare_` | the same with `and not _desert_` |

Read left to right, with `desert2` bound to 224 and `mountainwoods` to 226 (9.1): **in Desert (224) or Mountain (226)
all four tasks fire** - 4 x 25% fatigue (to the floor of 1), **8 hours**, gems and elements from both tables; **in
every other climate**, Desert2 (225) and MountainWoods (230) among them, only the chosen kind's scarce task.

| Variant | Bounty | Scarce |
|---|---|---|
| MiningQuest | {1,2,3,4,4} | {0,1,2,2,3} |
| Weak | {0,1,2,3,3} | {0,0,1,2,2} |
| Weaker | {0,1,2,2,3} | {0,0,1,1,2} |
| Weakest | {0,0,1,1,2} | {0,0,0,1,1} |

Items are `element` or `gem`; none: "unable to successfully mine anything of worth". Then the bonus.

### 9.7 Grave robbing (eight variants)

At start: fatigue **30%**, time **2:00**, a uniform draw of the loot count:

| Variant | Draw | Slots |
|---|---|---|
| Quest | {0,1,2,3,4,5} | skin, religious, organs, trinket, trinket |
| Weak | {0,1,1,2,3,4} | skin, religious, organs, trinket |
| Weaker | {0,1,1,2,2,3} | trinket, religious, organs |
| Weakest | {0,1,2} | trinket, religious |

Then **1 in 5 disturbs the dead** (`{_disturb_, _notdisturb_ x4}`), and a disturbance is a **Ghost 3 times in 4, a
Wraith once** - 15% and 5% of all digs - "Your Grave Robbing has disturbed the dead!", `create foe ... every 0 minutes 1
times with 100% success`; the foe outlives the quest. The Luck bonus uses **8-entry** lists: **12.5 / 25 / 37.5 /
50%**, picking 1 of 8: weapon, armor, magic, potion, book, **dead_body** (the Penwick Papers' corpse), mens_clothing,
womens_clothing. The CN variants drop dead_body (7 left) - their only difference, the code giving Cheb's corpse
instead. "Found nothing" fires on the tick after `end quest`, inside the grace.

### 9.8 The fetch quests

| Quest | Pool (the list's word) | Min rep | Bundles | Time | Gold |
|---|---|---|---|---|---|
| FetchWood01 "Collect some Firewood" | Commoners (`Commoner`) | 0 | 2 | 2 days | 200-300 |
| FetchWood02 "Source a Supply of Firewood" | Commoners (`Commoner`) | 10 | 4 | 3 days | 400-600 |
| FetchWood03 "Collect Firewood for a Witch Burning" | Nobility (`Noble`) | 0 | 6 | 3 days | 600-800 |
| FetchWood04 "Collect Wood for an Execution Scaffold" | Nobility (`Noble`) | 10 | 8 | 4 days | 800-1000 |

(03 and 04's own headers say Commoner; the list's Noble governs.) As built, **they are never offered**: `Commoner`
and `Noble` name no social group - DFU's are `Commoners` and `Nobility` - and `QuestListsManager.ParseQuestList`
files a row only under a defined group name (QuestListsManager.cs:223-251), so the four rows are dropped (Q13). And
were one offered, the turn-in asks `player possesses N items class 20 subclass 1604`, which **can never be true** (Q8).
FORAGE-FIX mends both, and QAE's handsover with them (Q11).

## 10. Loot and shops

Each hook's one procedure (FACT): draw an id from its table, then `RollForagingItemUsed({1..7}, luck, quality)` -
whose seven rarities are all 10, so every weight is equal - and `DetermineForagingItem`: **a uniform one in seven of
Wood-Axe, Pick-Axe, Sickle, Fishing-Net, Wood Bundle, Spade, Basket**, whatever the table (its duplicates and gaps
decide nothing). `AddItem(item, Back)`.

**`PlayerActivate.OnLootSpawned`** (IL_0520-IL_083c), after a shelf or house container stocks:

| Where | Roll | Count |
|---|---|---|
| a shop shelf in a **Pawn Shop** | none | `Range(0, 1)`: **always 0** |
| a shop shelf in a **General Store** | none | `Range(0, 2)`: 0 or 1 |
| a house container in a **Palace** | 30% | `Range(0, 1)`: **always 0** |
| a house container anywhere else | 15% | 0 or 1 |

**`LootTables.OnLootSpawned`** (IL_084c-IL_09fb), a loot pile, by the index its `GenerateLoot` was given; a failed roll
leaves the count 0:

| Dungeon types | Roll | Count |
|---|---|---|
| Prison, Mine | 25% | 0-4 |
| Orc, Human, Barbarian Stronghold | 20% | 0-3 |
| Crypt, Ruined Castle, Cemetery | 15% | 0-2 |
| Desecrated Temple, Coven | 10% | 0-1 |
| Vampire Haunt, Laboratory | 5% | `Range(0, 1)`: **always 0** |
| every other | - | 0 |

**Which piles, and at which index** (FACT, DFU's own reuse, which the port keeps bug-for-bug): a dungeon pile passes
its dungeon type; **a building-interior pile passes the location's type** (`GenerateLoot(loot,
(int)CurrentLocationType)`, `scenes/interiorContext.js`), which Foraging reads as the dungeon type of the same number -
so a TownCity building's pile - interiors hold treasure piles only in a tavern or a Thieves Guild or Dark Brotherhood
house (`seedInteriorTreasure`) - rolls as a Crypt (15%, 0-2), a TownHamlet's as an Orc Stronghold (20%, 0-3), a
TownVillage's as a Human Stronghold (20%, 0-3), a HomeFarms' as a Prison (25%, 0-4), a DungeonLabyrinth's as a
Desecrated Temple (10%, 0-1), a ReligionTemple's as a Mine (25%, 0-4), a DungeonKeep's as a Coven (10%, 0-1), a
HomePoor's as a Ruined Castle (15%, 0-2), and a Tavern's, HomeWealthy's, ReligionCult's, DungeonRuin's, Graveyard's or
Coven's never; a World of Daggerfall camp's pile passes 3 (`WOD_LOOT_LOCATION_INDEX`), a Prison (25%, 0-4). Recorded
as Q12.

**`EnemyDeath.OnEnemyDeath`** (IL_0a08-IL_0b8f): a class foe that is a Spellsword, Rogue, Archer, Ranger, Barbarian or
Warrior draws a count from {1,1,1,1,2} and rolls **5%**; a monster that is an Orc, Orc Sergeant or Giant draws from
{1,1,1,2} and rolls **2%**; anyone else nothing. The count is drawn before the roll. The items go into the corpse.

**Where the tools are really sold** is not the hook: DFU's `StockShopShelf` stocks every registered custom item of a
shelf's groups with `rarity <= quality` and a roll of `chanceMod x 5 x (21 - rarity) / 100`. UselessItems2's
chanceMod is 50 in a General Store and 20 in a Pawn Shop:

| Shop | Tools and Wood Bundle (rarity 10, quality >= 10) | Mushroom, Egg (rarity 5, quality >= 5) |
|---|---|---|
| General Store | **27%** each | **40%** each |
| Pawn Shop | **11%** each | **16%** each |

Fish, Apple and Orange (rarity 100) are never stocked. This was FORAGE3's first gap (3), closed early by FORAGE1.

## 11. Other mods

| Mod | How Foraging asks | Effect | In the port |
|---|---|---|---|
| Climates & Calories | `GetMod("Climates & Calories")?.Enabled`, at the moment of use | fish are 535; the Basket's fruit 533 / 532 | C&C is the port's overhaul (`vendor/climates-calories/`); "enabled" is `survivalOn()` - any tier but Off |
| Cheb's Necromancy | `GetMod("Cheb's Necromancy")?.Enabled` | the corpse and the CN quests | not in the port: the question answers no, and the CN branch never runs; its four quest files stay registered, as they are in the list |
| Iliac Puddle No More | not asked; region 31 counts as water | the net works in the bay the mod carves into land-climate pixels | vendored (`vendor/iliac-puddle-no-more/`); region 31 is the politic sea, `mapsFile.js` |
| The Penwick Papers | not asked | the grave's `dead_body` is its corpse | not in the port: a dead_body is DFU's own quest item |

## 12. The quirks - kept, and six mended

DECIDED (Mac: 1:1): every quirk below is ported as the build has it, and each gets a **Ledger B** row ("verbatim
quirks preserved", `01-Overview/Port-Ledger.md`) at the slice that ports it.

| # | Quirk | What a player sees |
|---|---|---|
| Q1 | The seven tools and bundles drop uniformly, the loot tables deciding nothing | a Wood Bundle from a Coven's or Desecrated Temple's table, which lists none |
| Q2 | `Range(0, 1)` is always 0, at three call sites covering four places (IL_058d, IL_06fb, IL_096c) | nothing from the hook in Pawn Shops, palaces, Vampire Haunts, Laboratories |
| Q3 | The Pick-Axe reads Agility | the readme says Endurance |
| Q4 | The net's dungeon arm is dead | no fishing in a flooded dungeon |
| Q5 | `_atmine_` can never be true | no mine bonus |
| Q6 | `update-quest-item _x_ Leveled` is inert | found weapons and armour at the default material |
| **Q7** | **Mining in Desert (224) or Mountain (226) fires all four tasks** | 100% fatigue gone to 1 and **8 hours** for one swing; both kinds of haul |
| **Q8** | **The fetch quests ask for class 20; bundles are group 9** | FetchWood01-04 **can never be turned in**; they time out |
| **Q9** | **Summer plants 5 and 6 make `_plant4_` permanent** three times | a fifth and sixth plant vanish when the quest ends |
| **Q10** | **The Basket under C&C: block C has no (2, Egg) case; block E's (4, Egg) is unreachable** | "You could not find any food to forage!" for a find the table drew |
| Q11 | QAE's `player handsover` counts pack items twice and never takes the wagon's (9.2) | unreachable while Q8 stands; live the moment Q8 is fixed - 1 bundle in the pack and 1 in the wagon would complete FetchWood01 and keep the wagon's |
| Q12 | A building-interior pile passes its location's type as Foraging's dungeon index (10) | a city tavern's treasure pile rolls tools at a Crypt's rate, a farm's tavern at a Prison's; a Tavern-type location's never |
| **Q13** | **The list files the fetch quests under `Commoner` and `Noble`**, which name no social group (9.8) - found by the FORAGE1 audit, 2026-09-28 | FetchWood01-04 **are never offered**, by anyone |

**Q7-Q11 and Q13 are bugs a player would call broken.** DECIDED (Mac: "Your lead"): they are fixed, as **one Ledger A
departure, FORAGE-FIX**, and everything else stays 1:1. **The vendored files stay verbatim**: the four fixes to the
quest text (Q7, Q8, Q9, Q13) are a patch table in the port's Foraging module (`FORAGE_FIX_PATCHES`), each patch naming
its file, the exact old line and the new, applied when the quest pack loads and pinned, so the author's text is always
in the tree as he shipped it; Q10 is fixed in the port's Basket (`basketFind`) and Q11 in Quest Actions Extension's
port (`questActionsExtension.js`), which were never the author's files. (AUDIT 28: this said all six were the table.)

| Quirk | The fix |
|---|---|
| Q7 | The four Mining quests gain a task `_rich_ task: when _desert_ or _desert2_ or _mountain_ or _mountainwoods_ or _atmine_`, and the four yield tasks read `when _elements_ and _rich_` / `_gems_ and _rich_` (bounty) and `when _elements_ and not _rich_` / `_gems_ and not _rich_` (scarce) - one task fires, as the author meant. The keywords' binding (`desert2` to 224, `mountainwoods` to 226, 9.1) is DFU's own and is kept: Desert2 and MountainWoods stay scarce ground |
| Q8 | The four fetch quests' `class 20 subclass 1604` read `class 9 subclass 1604`, in `possesses` and in `handsover` |
| Q9 | ForageSummerPlantsQuest's `_5plant_` and `_6plant_` make `_plant5_` and `_plant6_` permanent |
| Q10 | The Basket's C&C branch uses the non-C&C branch's cases, its fruit templates still C&C's |
| Q11 | The port's `player handsover` searches the wagon for the wagon's share and removes from it |
| Q13 | The list's `, Commoner, ` and `, Noble, ` read `, Commoners, ` and `, Nobility, ` (two rows each) - the list patched as it is read, as the quests are |

A patch that no longer finds its line (a changed file) throws; the loader warns and loads the author's text as
shipped, so one mod's patch never takes the quest pack down. Q1-Q6 and Q12 stay: they are harmless or DFU's own (Q12), and the doctrine keeps what it can.

## 13. Online - the second lane

### 13.1 The clock (the main change)

DECIDED (law 3): online, **`raise time by H:MM` is a wait**. The quest's other actions run as they would offline; the
player sits on the busy page C&C's hunt had (`ui/huntWindow.js`, its Busy phase - THE ONE CONSTRUCTION SEAM: the same
constructor; HUNT-OUT, 2026-10-04: the hunt RETIRED and the file DELETED, its busy page kept alone as
`src/ui/waitWindow.js`, no options left to give), at **8 real seconds a game hour** (`HUNT_WAIT_PER_HOUR` then,
`WAIT_PER_HOUR` in `src/scenes/foragingWait.js` now). The page takes no key and no click, ends at the wait's end or
early when its `interruptWhen` (a foe near) answers, and joins a second wait (`extend`):

| Quest | Game time | The wait online |
|---|---|---|
| ForageFoodQuest | 1:00 | 8 s |
| ChopWoodQuest, Plants | 1:30 | 12 s |
| Mining (one task - FORAGE-FIX Q7; as built, four in Desert or Mountain, 8:00), Grave robbing | 2:00 | 16 s |
| FishingQuest | none | none |

- Waits queue: four `raise time by` lines make one wait of their SUM - never cut (AUDIT 28 F1: the cap meant for a
  save edited to a day of waiting cut every live join too, so twenty tool uses behind one page cost sixty-four seconds;
  only a restored record is cut now).
- **The order**: the tool's result box closes first; then the wait takes the overlay slot (THE SLOT IS EMPTIED
  BEFORE THE OCCUPANT IS TOLD); the quest's popups (a bonus's line) queue behind it and show once it has ended AND
  left the slot (AUDIT 28 H6: released inside the page's own last tick, a box went under the finished page, which came
  back over it). A slot takeover that disposes the page ends it as a foe would.
- The quest machine PAUSES while the page holds the slot - the host's frame ticks it only with the slot free, under
  every window alike (AUDIT 28 F3: this said it did not pause).
- **It survives a reload**: the seconds left ride the save (a field of the player's own, like any quest state), and
  loading reopens the page with them - so a relog does not skip it. So do the boxes held behind it: a box of words and
  a quest reward's item ride the record too (`held`), and a reload shows them after the page (AUDIT 28 F6: they were
  held in memory alone, and a relog lost a bonus's line - or a reward - for good). A prompt's answer is a closure and
  stays this page's.
- **A foe near ends the wait** (the rest test, 5) with what is left of it forgiven - the wait is a cost, and a foe is
  a larger one. Esc does not end it: offline the hours are gone at once.
- Fatigue is taken as offline (`reduce player fatigue by` is the player's own).
- The shared clock's hour answers the daylight check (WORLD5), so every player online forages by the same sun.
- **Built by FORAGE4** (2026-09-28), with what the build settled: the page's line is the quest's own DisplayName
  ("Chop and Gather Wood..."), the author's words; the quest's boxes are held while the wait is PENDING too - behind
  the pack, before the page has opened - so a bonus's line always follows the work, and a quest reward's pile waits
  behind its box; the busy page's caption says nothing when Escape does nothing; a SAVED wait is cut to eight game
  hours' worth (64 s) and a malformed one dropped, so a save edited to a day of waiting is never obeyed (a wait built in
  play is its sum - AUDIT 28 F1); offline, a wait saved online is forgiven (the offline lane has none).

### 13.2 Everything else, unchanged

A grave's Ghost or Wraith is the player's quest foe on the player's client, as any quest foe online. The fetch
quests are offered from the social pools as offline (Q13's mend with them). The loot, shop and corpse hooks run where DFU's events do. Foraging's items
are pack items - save items - and **never enter the Stores** (PROF0 law 3): a Wood Bundle, a fish or an apple got
this way is the player's, not the server's.

## 14. The professions' tools

DECIDED (Mac: "its tools become the professions' tools").

### 14.1 One item, two gestures

- **Use** from the inventory: Foraging, 1:1 (sections 5-9), in both lanes.
- **Interact (E) at a node**, online, with the tool in the pack: the profession's act (PROF0 5.2). The act does not
  equip anything - Foraging's tools are group-9 items, and DFU cannot wield one. The act **draws the tool in the hand
  for its length** and puts back what the hand held; Esc before the act's end costs nothing.
- **Which tool**: the first of its kind in the pack's order (as `ItemCollection` finds it).
- **Wear**: a completed act lowers the tool's condition by **1**, as a Foraging use does, and a break is Foraging's two
  notices ("Your Pick-Axe broke." after DFU's popup). A tool lasts 50 harvests, whichever gesture wore it.
- **No tool**: the node's prompt says what it needs - "[E] Chop Oak - needs a Wood-Axe" - and E says it too when
  nothing else under the ray takes the press (VEIN-NEED, `01-Overview/Field-Bugs-2026-09-29h.md`). Hunting excepted
  (AUDIT 32 R10): a body is a node only while the pack holds a Skinning Knife - with none it is DFU's corpse alone, and
  no prompt stands in the way of its loot (PROF0 29).

### 14.2 The tools and their professions

| Tool | Profession | The act (PROF0 5.2) | In the hand |
|---|---|---|---|
| Wood-Axe 1600 | Logging | the ring | Daggerfall's War Axe sprite, Weapon Widget's swing |
| Pick-Axe 1601 | Mining, Quarrying | the glint | Daggerfall's Warhammer sprite |
| Sickle 1602 | Herbalism (uncommon and rare herbs; a common herb comes up by hand) | the steady hand | Daggerfall's Tanto sprite |
| Fishing-Net 1603 | Fishing | the throw and the haul (14.5) | classic lane: the item's own picture (the author's net), bottom-anchored where the held map's sprite stands, the weapon hidden by the held map's place in the draw ladder (MAP-WEAPON, `10-UI/Held-Map-Arc.md`); Morrowind lane: the held-sheet pose (`src/combat/heldPose.js`) |
| Basket 1607 | Herbalism's second harvest of a patch: the Basket's food (14.6) | the search | as the net, with Daggerfall's basket picture (205/9) |
| Skinning Knife 603 (the port's own, not Foraging's) | Hunting | the trace | Daggerfall's Dagger sprite |
| Spade 1606 | **none** - grave robbing stays Foraging's alone, both lanes | - | - |

The Morrowind arms take the same place on that lane, as PROF0 5.1 says. **The Skinning Knife** (603): 0.5 kg, 50 HP,
100 gold, rarity 10, group 9; it stocks as Foraging's tools do, **online only**, since nothing offline uses it.
PROF7 (2026-09-30, `06-Systems/Professions-Arc.md` 29) BUILT it so: registered with the professions' rows
(`systems/profTemplates.js`), shelved by DFU's own custom-item loop at General Stores and Pawn Shops online alone,
made at the anvil, worn one an act as Foraging's six, broken by its own name ("Your Skinning Knife broke." - Foraging's
line had named only its own twelve), DFU's Dagger (113) in the hand; the trace drawn with E held (PROF0 29: attack
held would be the weapon's, whose swing modes hold the look still).

### 14.3 The checks the act borrows

Every act runs Foraging's checks first, **with Foraging's own refusal for that tool**, except where the node answers
the check itself. The Skinning Knife, not Foraging's, gets lines in Foraging's voice: "You cannot skin in a
settlement!", "You cannot skin out here!", "You cannot skin with enemies nearby!", "You cannot skin when fully
encumbered!". PROF7 BUILT them in that order - settlement, sea, enemies, load - through Foraging's one check law
(`foragingLaw.js` checksRefusal, the knife's order and lines `professionLaw.js` KNIFE_CHECKS and KNIFE_REFUSALS).

| Check | Applies to |
|---|---|
| Not inside | every act **except a dungeon vein** - the Pick-Axe's one place indoors (PROF0 6) - **and Hunting**, whose body lies where it fell (PROF0 17.1); the inventory's "You cannot mine in here!" is unchanged (FIELD BUGS 2026-09-29h: a player read it beside a dungeon vein as the vein's refusal - the Pick-Axe used at a node is its For Mac 1) |
| Not in a settlement | every act (no node stands in a rect, PROF0 6) |
| ~~**Daylight, 07:00-17:59**~~ | RETIRED (ANY-HOUR, 2026-10-01, Mac: *"Remove the time limit for professions. Should be available at any time"*): no profession's act asks it, and the service refuses no hour (`systems/foragingInstall.js` foragingActRefusal; `01-Overview/Field-Bugs-2026-10-01.md` part four). It stood for Logging, Herbalism, the Basket, surface Mining and Quarrying and Fishing, the service checking it from the act's end. Foraging's own Use (offline, a guest's lane) keeps it, the mod's 1:1 |
| Not at sea | every act but Fishing |
| No enemies near | every act |
| Not fully encumbered | every act |

~~**What the daylight rule makes of a day**: a game day is 2 real hours online, so the wilderness gives about **55 real
minutes** of daylight gathering in every 2 hours. Night is for the dungeon veins, Hunting and the stations - a
rhythm the record wants: gather by day, delve and craft by night.~~ RETIRED with the rule (ANY-HOUR): the wilderness
gathers round the clock.

PROF0's "fish bite at dawn and dusk" becomes Foraging's day: **the first and last daylight hours (07:00-07:59,
17:00-17:59) halve the wait**.

### 14.4 The attribute bands

Foraging's attribute pair for each tool sets how wide the act's skill moment is. Attributes are the save's, so a
band **only moves a window** (narrower below 40, wider above 59); the honest bound (PROF0 5.1: one quality step, +50% yield, never past rank) is
untouched, and the service never reads an attribute.

| Band | <=39 | 40-59 | 60-79 | >=80 |
|---|---|---|---|---|
| Window x | 0.85 | 1.00 | 1.15 | 1.30 |

| Tool | Pair (Foraging's) | The window it scales |
|---|---|---|
| Wood-Axe | (INT + STR) / 2 | the ring's band |
| Pick-Axe | (INT + AGI) / 2 (the IL's Agility, Q3) | the glint's time |
| Sickle | INT | the steady hand's 3 degrees |
| Fishing-Net | (INT + AGI) / 2 | the tug's 600 ms and the haul's tension band |
| Basket | INT | the search's glint time |
| Skinning Knife | (INT + AGI) / 2 | the trace's tolerance |

**Fractions.** A clean act's +50% on a small yield leaves a fraction; a fraction of a unit is that chance of one
more, on the service's dice (1 x 1.5 = 1, and a 50% chance of a second). The same rule holds for every act in PROF0.

### 14.5 Fishing with the net - the throw and the haul

Replaces PROF0's rod (the cast, the bite, the reel), DECIDED:

- **Where**: where the net works (6.4) - standing in water, swimming, or at sea on a boat or pier (climate 223 or
  region 31). "You need to be in water or on the ocean to fish!" otherwise.
- **The throw**: hold attack to wind (**0.3-1.5 s**), release; the net flies **3-12 m** and spreads on the water, a
  ring of floats.
- **The wait**: **5-30 s** (the first and last daylight hours halve it, a storm doubles it).
- **The tug**: the floats dip, a splash, the pad and phone buzz (TI2's haptics); haul (attack) within **600 ms** x the
  band (Angler +40%). A missed tug brings the net in with the plain haul.
- **The haul**: the reel bar, renamed - hold to raise the tension band (**20%** of the bar at Novice, **30%** at
  Master, x the band), keep the net's weight inside it to fill the haul meter within **20 s**; **2 s** outside, counted
  in total, and the net comes in with the plain haul.
- **The yield**: **1-2 fish** of Deep Waters' species for the water (PROF0 5.2's "what bites"), +50% on a clean haul;
  a Pearl 1 haul in 50 at sea (Pearl Diver x3), a Slaughterfish 1 in 100 (the heaviest haul), a trophy 1 in 200.
- **The cap**: ~~**40 hauls a day an account**~~ - a haul names no node, so Fishing is bounded, not witnessed (PROF0 6) -
  RETIRED (CAP-OFF, 2026-10-07, Mac: *"Remove the cap on life skills"*): no day's hauls; the hour's writes bound it
  (`06-Systems/Professions-Arc.md` section 40).
- **Into the Stores** as **Raw Fish**, the species named in the toast (PROF0 5.2).
- Specialisation names follow: **Angler** - the tug window +40%.

### 14.6 The Basket - the search

New, DECIDED (Mac: "picking up ingredients"):

- **Where**: an herb patch (PROF0 6). A patch gives its herbs to the hand or the Sickle **and** its food to the
  Basket, each **once a day** a character: two harvests of one patch, both counted in Herbalism's cap of 60.
- **What**: Foraging's blocks and food lists (the counts are the record's), the service's roll - the harvest keyed
  `(node, food)` beside the herbs' `(node, herbs)` (PROF0 6): the block (6.6) from the pixel's witnessed climate and DFU's
  month by the shared clock; the food from the block's list (Orange in A-C, Apple in D-E, Mushroom, Egg); **1 find**
  in a desert (A), **1-2** in B and D, **1-3** in C and E.
- **The act**: kneel (E); the patch's leaves fill the act's panel and **three finds glint one after another**, each
  for **1.0 s** (1.4 s at Master) x the band; tap (attack) each while it glints. All three: **clean**, +50% (and +50%
  XP); two: +25%; fewer: the plain roll.
- **XP and value**: Herbalism, tier 1 (15 XP); **1 Mark** a food (PROF0 4.8's tier-1 value).
- **Into the Stores**, for Cooking (PROF0 9.3's dishes name them). **Withdrawn to the pack**, a food becomes the
  template Foraging's own code would make at that moment: Apple 532 / Orange 533 while C&C is on, else 1608 / 1609;
  Mushroom 1610; Egg 1611.

### 14.7 The tools, crafted

Tools break every 50 harvests, so the crafts keep them coming - a steady use for tier-1 materials. DECIDED:

| Tool | Craft | Inputs | Rank |
|---|---|---|---|
| Wood-Axe 1600 | Smithing | 2 Iron Ingot, 1 Pine Plank | 0 |
| Pick-Axe 1601 | Smithing | 2 Iron Ingot, 1 Pine Plank | 0 |
| Sickle 1602 | Smithing | 1 Iron Ingot, 1 Pine Plank | 0 |
| Spade 1606 | Smithing | 2 Iron Ingot, 1 Oak Plank | 10 |
| Skinning Knife 603 | Smithing | 1 Iron Ingot, 1 Pine Plank | 0 |
| Fishing-Net 1603 | Outfitting | 2 Linen Bolt | 0 |
| Basket 1607 | Carpentry | 2 Pine Plank | 0 |

- A crafted tool is **its own template** - Foraging's (1600-1607), or the Skinning Knife's (603, the port's own row;
  AUDIT 32 R10: this said Foraging's alone) - with PROF0 9.2's quality on its condition: **Crude 37 uses, Standard
  50, Fine 57, Superior 65, Masterwork 65** and the maker's mark ("Silverthorn's Pick-Axe"). No Loot Rarity roll - a
  tool is not a weapon.
- Offline a crafted tool is simply the tool; its condition rides the save. Foraging's code reads only
  `currentCondition > 0`, so a longer life changes nothing else.
- The shops still sell Foraging's Standard tools (10), so no one needs a crafter to start.

### 14.8 What stays Foraging's alone

The Spade and grave robbing (a Spade *made* at a forge is Smithing's, as any product is - 14.7); the Wood Bundle and
the fetch quests; Foraging's foods eaten from the pack; the found-item
bonus; the loot and shop hooks. None of them touch the Stores, the Marks or profession XP.

### 14.9 The two lanes side by side

| | Offline | Online, from the inventory | Online, at a node |
|---|---|---|---|
| What runs | Foraging | Foraging | the profession's act |
| Checks | Foraging's six, and the Spade's cemetery and the net's water | Foraging's six, and the Spade's cemetery and the net's water | Foraging's, as 14.3, and the net's water |
| Yield | Foraging's, into the pack | Foraging's, into the pack | the service's roll, into the Stores |
| Time | the clock jumps (`raise time by`) | the wait (13.1) | the act's own length |
| Fatigue | the quest's | the quest's | none |
| Wear | 1 | 1 | 1 |
| XP | none | none | the profession's |

## 15. The four hosts

Every FORAGE slice's record names all four (Home.md, THE FOUR HOSTS RULE), each wired or FLAGGED:

| Host | Foraging there |
|---|---|
| `scenes/world.js` - the streaming world | Every tool works: the checks read the pixel's climate and region, the location's rect and type, the hour, the foes (a duel's foe among them, as the rest test counts it), and the water state - the three-valued `ON_EXTERIOR_WATER`, handed to the net since FORAGE2. The corpse hook where the world's pools raise a death (`exteriorFoes`, `cityGuards`); the World of Daggerfall camps' piles at index 3 (FORAGE3, wired). Online, the wait (13.1) on townTalk's slot (FORAGE4, wired). The nodes and acts (PROF) |
| `scenes/exterior.js` - the fixed city | The settlement check answers from the loaded location: its rect is the whole host (`_musicInLocationRect` is always true), so every tool refuses with its settlement line wherever the loaded location is a town type, and works at any other (a graveyard, a dungeon's exterior) - read at FORAGE2. The three-valued water state as in the streaming host (FORAGE2). Its foes' corpses, shelves, containers and interior piles are the shared pools' and `worldModes`' (FORAGE3, wired). **FLAGGED**: no shared clock, so no wait - its RaiseTime is the offline advance (FORAGE4); no nodes (PROF0 17.1) |
| `scenes/worldModes.js` - building interiors | Every tool refuses with its "inside" line. The shelf and house-container hooks - `PlayerActivate.OnLootSpawned` raised at both shelf doors and at a stranger's container, before "If no contents" - and the building-interior piles' `LootTables.OnLootSpawned` at the location type's index (Q12), raised where `scenes/interiorContext.js` rolls them (FORAGE3, wired) |
| `scenes/dungeonContext.js` - dungeons | Every tool refuses ("inside"; the net's dungeon arm dead, Q4). The dungeon-pile hook at the dungeon type's index, WORLD8's hourly re-roll included (one home, `rollPileItems`), and the corpse hook (FORAGE3, wired). **FLAGGED by name**: online, a joiner's copy of a body the host killed rolls its own C&C food (CORPSE-FOOD) but no Foraging tool - a death is raised where it happens - so a room whose first opener was a joiner keeps a list without the host's roll. The Pick-Axe's dungeon veins (PROF2) |

The inventory's Use is host-agnostic (`src/systems/useItem.js`); the host answers the questions the checks ask.

## 16. The process laws, applied

| Law | What it means here |
|---|---|
| **ONE DFU MEMBER, ONE EXPORT** | `GetCustomItemsForGroup` moved to `itemTemplates.js` (FORAGE1); the three `OnLootSpawned`/`OnEnemyDeath` events are one registry each (`containerLoot.js`, `loot.js`, `corpseMarker.js`; FORAGE3); C&C's `TEMPLATE`, `survivalOn`, `ON_EXTERIOR_WATER`, `isPlayerInTown`, `areEnemiesNearby` and `lowerCondition` are imported, never re-typed (the wait's rate, C&C's `HUNT_WAIT_PER_HOUR` until HUNT-OUT, is `WAIT_PER_HOUR` in `foragingWait.js`, its one reader, since the hunt was removed). The IL's arrays live once, in the Foraging law module (`src/systems/foragingLaw.js`) |
| **A PIN MUST FAIL** | Each table is pinned `deepEqual` against values read off the IL and typed into the test (the IL's arrays are `stelem` runs, not text a test can parse), and every line the law speaks is checked against the IL's own string literals (`ldstr`, `vendor/foraging/il/`); each slice's mutants (`tools/mutants/forage*.json`) flip a band edge, a check's order and a message |
| **TEST THE SHAPE THE PRODUCER MINTS** | A tool in a test is minted by the shelf, the loot hook or the console command, never an item literal |
| **THE MODAL CONTRACT** | The result box returns the same type from every exit (click anywhere is its only one) |
| **THE SLOT IS EMPTIED BEFORE THE OCCUPANT IS TOLD** | The result box sits over the inventory in the overlay stack; the busy wait takes the host's overlay slot, nulled before it is disposed |
| **ASYNC NEVER DROPS** | Offline nothing is async. Online the act's harvest is PROF0's request with its id |
| **EVERY ALLOCATION HAS AN OWNER** | The seven textures are the texture door's, loaded lazily - and registered whatever the switch says, so an inert saved tool still draws (AUDIT 28 F5: this said "gated on the switch"); the tool in the hand is the weapon rig's for the act's length |
| **THE ONE CONSTRUCTION SEAM** | The busy wait was huntWindow's constructor, not a second one; since HUNT-OUT (the hunt removed) it is the one page left, `waitWindow.js` |
| **THE NATIVE-WINDOW RULE** | The result box is DFU's `DaggerfallMessageBox`, drawn native (`src/ui/messageBox.js`) |
| **A SLICE CLOSES ITS LEDGER ROW** | FORAGE1-2 added section A's FORAGING row (FORAGE-FIX and the other departures) and section B's FORAGING'S QUIRKS row (12); FORAGE3 ported the hooks' quirks that row already recorded (Q1, Q2, Q12) and marked them so; FORAGE4 writes its wait into the A row's departure (5) (13.1) |
| **THE RELAY VERSION** | Foraging needs none. The act's pose field is PROF's (PROF0 5.1) |

## 17. The slices, in order

DECIDED: **FORAGE1 and FORAGE2 ship as one change**, so the Features row a vendored folder demands (1.1) switches a
mod a player can actually use - tools that chop, quests that pay - never a switch with half a mod behind it.

| Slice | What | Done when |
|---|---|---|
| **FORAGE0** | This record | - |
| **FORAGE1** - SHIPPED 2026-09-28 | The files vendored (1.1) with the README, the registry row, the credit and the Features row; QAE's four actions (9.2) and the inert `update-quest-item`; the quest list and its 22 quests, gated on the switch | A fetch quest is offered by a commoner; a script's `raise time by 1:30` moves the clock 90 minutes |
| **FORAGE2** - SHIPPED 2026-09-28 | The twelve templates; the seven textures; the six tools' uses (5, 6), the result box, the wear; the foods (7); the console command (8); the three-valued water state in the streaming host | Each tool, used in each host, gives the mod's line, yield and quest |
| **FORAGE3** - SHIPPED 2026-09-28 | ~~`GetCustomItemsForGroup` as a registry~~ (shipped early, with FORAGE1); `PlayerActivate.OnLootSpawned` and `LootTables.OnLootSpawned` as registries (RRI's subscriber first); Foraging's three hooks | A Prison's pile holds a Spade; a General Store's hook adds 0-1 |
| **FORAGE4** - SHIPPED 2026-09-28 | Online: the wait (13.1) | Online, the Wood-Axe gives its bundles, a 12-second wait and 20% fatigue; the shared clock does not move |
| **FORAGE-FIX** - SHIPPED 2026-09-28 | Q7-Q11 and Q13 (12), carried by the slice that ports each - the quest and list patches and Q11 in FORAGE1, Q10 in FORAGE2 - in section A's FORAGING row | Each patch pinned against the verbatim line it replaces, and each patched quest and the list run on the port's machine (`test/foragefix.test.js`) |

The professions take the tools in their own slices: **PROF1** (Herbalism: the Sickle's steady hand, the Basket's
search) **needs FORAGE1-2 (shipped)** - Foraging's templates, checks and lines, and the tools on the shelves - and
builds law 6's online exception (the six tools shelve online whatever the switch says); FORAGE3's loot hooks
(shipped) added a source, not a dependency. So do PROF2 (the Pick-Axe), PROF4 (the Wood-Axe), PROF7 (the Skinning Knife: its template
603, its online shelves - the same exception, PROF7's for 603 - and its act) and PROF8 (the net), which also needs
FORAGE2's three-valued water state (shipped).

## 18. The pins

They stand in `test/forage1_law.test.js`, `test/forage2_tools.test.js`, `test/foragefix.test.js`,
`test/forage3_loot.test.js` (the hooks, Q1, Q2 and Q12) and `test/forage4_wait.test.js` (the wait).

- The templates: the twelve rows `deepEqual` the vendored `ItemTemplates.json`; group 9; none stackable.
- The checks: for each tool, a fixture failing each check alone gives that check's exact line, and a fixture failing
  two gives the earlier one (the order).
- The daylight edge: 06:59 refused, 07:00 allowed, 17:59 allowed, 18:00 refused; the Spade at 03:00 allowed.
- The settlement check: HomePoor, Graveyard and a dungeon's exterior pass; a TownCity's rect refuses.
- Every yield list, `deepEqual` against the IL's decoded arrays; the Wood-Axe's desert at 224 and 225 only.
- The Sickle's month split (7 Summer, 8 Winter) and the climate order (Mountain before Swamp).
- The net's water: a shore tile (tilemap 5) passes, dry ground with no drawn water refuses, region 31 passes on a
  land-climate pixel. FACT: the port's own drawn sea (MAC2, a Ledger A departure) answers Swimming wherever the drawn
  surface covers half a tile (`src/player/exteriorSurface.js`), so the net also works on water DFU's tile records call
  dry; the pin takes that as the port's water, not a quirk of Foraging's.
- The Basket's blocks and both C&C holes (Q10) as the build has them; the fruit template under C&C on and off.
- The foods' four numbers each.
- The break: a tool at condition 1 gives its yield, its quest, DFU's popup, "Your <Tool> broke.", and is gone.
- The hooks: `Range(0, 1)`'s three call sites (four places) add nothing over 10,000 draws; the uniform one-in-seven;
  an interior pile at each location type's index (Q12).
- The quests, as built and patched: the mining climate cases (as built 224 and 226 fire four tasks, patched one;
  225 and 230 one either way); `desert2` binds 224; the fetch turn-in never fires as built (Q8) and does patched, from
  the pack and the wagon (Q11); the list files the fetch quests only patched (Q13); Summer plants 5 and 6 orphaned as
  built, kept patched (Q9); a CRLF checkout patches as LF.
- QAE: fatigue's percent, its floor of 1 and the maximum's clamp; `raise time by 1:30` is 5,400 s; `raise time by 2:00
  saying N` is the bare advance; `raise time by 0:00` is no action; `possesses` excludes quest items and counts the
  wagon.
- Online: the wait's seconds (8, 12, 16), and the shared clock unmoved; the page after the pack, the boxes behind it,
  a foe's end, the reload, the cap.

## 19. What remains to read or measure

- **QAE's licence** - DECIDED (Mac: "Your lead"): its repository carries no licence file and its manifest none, and
  the port copies none of its code: it restates four actions' behaviour (a line of arithmetic each), each cited to
  `Jagget/QuestActionsExtension` at `56a407e`, and Jagget is credited beside Harbinger451 on the About screen.
- **The author's words.** FORAGE1's README carries Mac's word; its permission line stays open until Mac pastes
  Harbinger451's grant or a link (the registry's RECORD OPEN).
- ~~**The fixed city's edge** (15).~~ Read at FORAGE2: the loaded location's type decides, its rect the whole host.
- **The act numbers** (14.3-14.6) are the record's first values; PROF1's play test measures them.
- **Mod init timing**: the IL does not show `Init`'s `[Invoke]` attribute; DFU's mods init at Start, and the port
  registers at boot, which is earlier and harmless.

## Appendix A - an afternoon, both ways

**Offline.** Brannoc, INT 62 and STR 55 (average 58: the 40-59 band), stands in the Woodlands east of Daggerfall at
14:00 in Frostfall, no foe near. He uses the Wood-Axe: the draw from {0,0,1,2,3} is 2 - "You were able to chop and
gather two Wood Bundles!" - and ChopWoodQuest takes 20% of his fatigue and moves the clock to 15:30. His Luck of 45 is
the 40-59 band: a 20% bonus, and it lands - the ingredient list's gold, 6 pieces (`gold range 1 to 8`). He uses the Basket: Frostfall is month 9,
block D; INT 62 draws from {0,1,1,2,2,3} a 2 and the food list {2,3,3,4,4} a Mushroom - "You manage to pick two
Mushrooms!" - and ForageFoodQuest moves the clock to 16:30. At 18:00 the Sickle refuses: "You need daylight to forage
for plants effectively!".

**Online.** The same afternoon on the server. The Wood-Axe from the inventory gives the same bundles, and a
12-second wait instead of the clock's jump. Then he walks to an Oak - "[E] Chop Oak - Logging 12" - and plays the ring
with the Wood-Axe drawn; his band (58) leaves the ring's window at x1.0; three swings - two Clean Cuts and a plain chop - fell
it, 3 Oak Logs to his Stores and 45 XP; the Wood-Axe drops to 48 of 50. At the herb patch beside it he picks Clover by hand, then kneels
with the Basket: two of three glints caught, 2 Apples +25% (a 50% chance of a third: no) - 2 Apples to his Stores for
tomorrow's Orchard Tart. At 17:00 the net's wait halves at the river's edge. At 18:00 the wilderness closes, and he
takes the road to the Prison two pixels north: its dungeon veins do not care about the sun.

## Appendix B - every number

| Name | Value |
|---|---|
| Templates | 1600-1611, group 9, none stack |
| Tool life | 50 uses (HP 50, 1 a use) |
| Checks | inside; settlement (IsPlayerInTown true, true); daylight 07:00-17:59 (not the Spade); sea 223 (Axe, Pick, Sickle, Basket); enemies (the rest test, 12 units); encumbered; and two of a tool's own: the Spade's cemetery (Graveyard, type 12), the net's water (swimming, shore, 223 or region 31) |
| Bands | <=39, 40-59, 60-79, >=80 |
| Wood-Axe | (INT + STR) / 2; bundles 0-4 (6.1) |
| Pick-Axe | (INT + AGI) / 2; the quest by band |
| Sickle | the quest by climate, then month |
| Fishing-Net | (INT + AGI) / 2; fish 0-4; water by swim, shore, 223 or region 31 |
| Spade | (INT + END) / 2; Graveyard (12) only |
| Basket | INT; five blocks (6.6) |
| Foods | Fish 15/5/-, Apple 10/5/-, Orange 10/5/-, Mushroom 5/-/10, Egg 15/10/- (fatigue / health / magicka) |
| Quest costs | Chop 20% 1:30; Food 10% 1:00; Fishing 10%; Plants 15% 1:30; Mining 25% 2:00 a task; Graves 30% 2:00 |
| Bonus | 10 / 20 / 30 / 40% by Luck; graves 12.5 / 25 / 37.5 / 50% |
| Graves | disturb 20%: Ghost 15%, Wraith 5% |
| Fetch | 2 / 4 / 6 / 8 bundles; 200-300 / 400-600 / 600-800 / 800-1000 gold; 2 / 3 / 3 / 4 days |
| Loot hooks | general store shelf 0-1; house 15%, 0-1; dungeon 25 / 20 / 15 / 10 / 5%; corpse 5% (class), 2% (Orc, Giant) |
| Shelves | tools 27% General Store, 11% Pawn Shop; Mushroom, Egg 40% / 16% |
| Online wait | 8 s a game hour (`WAIT_PER_HOUR`) |
| Act bands | x0.85 / 1.00 / 1.15 / 1.30 |
| Net | throw 0.3-1.5 s, 3-12 m; wait 5-30 s (first and last daylight hour x0.5, storm x2); tug 600 ms; band 20-30%; 20 s; slip 2 s; 1-2 fish as Raw Fish; ~~40 hauls a day an account~~ (CAP-OFF, 2026-10-07: none) |
| Basket (online) | 1 / 1-2 / 1-3 finds; three glints of 1.0-1.4 s; clean +50%, two +25% |
| Crafted tools | Crude 37, Standard 50, Fine 57, Superior 65, Masterwork 65 uses |
| Skinning Knife | 603: 0.5 kg, 50 HP, 100 gold, rarity 10, online shelves only |

## FORAGE1-FORAGE2 - WHAT SHIPPED (2026-09-28, Mac: "Your lead")

Offline Foraging, whole, in one change - so the Features row switches a mod a player can use:

- **The files**, `vendor/foraging/` (1.1), with its README (the permission line RECORD OPEN), its Mod-Registry row,
  its credit (Harbinger451, with thanks to Jagget), its Features row (on, MO1), its online lane (the player's own)
  and the doctrine's bundle-art row for the seven pictures (membership from the manifest's own Files).
- **The law**, `src/systems/foragingLaw.js`: sections 4-9 and FORAGE-FIX's quest patches, pure.
- **The install**, `src/systems/foragingInstall.js`: the templates at import whatever the switch says; the quest list
  on the switch; the six tools' and five foods' UseItem (`useForagingTool`, `eatForagingFood`); `Foraging_Tools`,
  refused online; the pictures on the texture door; `setForagingHost`, what the checks ask the world; and Foraging's
  share of GetCustomItemsForGroup - which moved to `src/systems/itemTemplates.js` (gap 1, closed), so a General Store
  and a Pawn Shop shelve the tools.
- **Quest Actions Extension's four**, `src/systems/quest/questActionsExtension.js` (Q11 mended there).
- **The quest pack**, `scenes/questData.js`: the list and the 22 quests, FORAGE-FIX applied as each is read - the
  list's Q13 with them; a patch that fails warns and loads the author's text.
- **The four hosts**: `scenes/world.js` registers the four actions on its machine and answers the checks in every mode
  it runs - the streaming world by its pixel, its location's rect and type, its hour, its foes, its load and its
  water; an interior (`scenes/worldModes.js`, which now writes the water's three-valued twin as None) and a dungeon
  (`scenes/dungeonContext.js` under it) as `inside`, which every tool refuses first. `scenes/exterior.js` does the same
  for the fixed city, where every tool refuses with its settlement line wherever the loaded location is a town type
(its rect is the whole host). **FLAGGED
  by name**: `scenes/dungeonContext.js` standing alone (`?dungeon`) sets no host, and a use there answers the no-host
  default, `inside` - the right refusal, reached by default rather than by a host's answer.
- **The water**: both exterior hosts keep `player.onExteriorWaterMethod`, all three of PlayerMotor's values, beside the
  Swimming boolean they kept before; the net reads WaterWalking (a shallow shore tile) too.
- **The ledger**: section A's FORAGING row (FORAGE-FIX's six, the templates whatever the switch, QAE restated, the
  console refused online, the online clock) and section B's FORAGING'S QUIRKS row (Q3-Q6 ported, Q1, Q2 and Q12
  recorded ahead of FORAGE3); the ENGINE-PRNG roster names `foragingInstall.js`.
- **The audit** (2026-09-28, four passes: the law against an IL interpreter over 60,000 cases, the quests run on the
  machine, every cite, every use path) found Q13 and nine smaller faults, all mended here: a CRLF checkout threw at
  the patch; QAE's RaiseTime carried a fourth alternative the file does not have; the encumbrance test refused on an
  unordered compare DFU passes; the console command answered with the switch off; fatigue could rise past the
  maximum; a food ate one off a stack (DFU removes the item); a tool wore when its quest was not found; a refused use
  from the hotbar flashed as used; a duel's foe was not an enemy near.
- **Pins**: `test/forage1_law.test.js` (15), `test/forage2_tools.test.js` (15) and `test/foragefix.test.js` (5);
  `tools/mutants/forage1.json`, 32 mutations, 32 dead.

**Not yet** (at FORAGE2): FORAGE3's hooks - since shipped, below - and FORAGE4's online wait: online, `raise time by`
leaves the shared clock where it is and waits for nothing, until FORAGE4 builds the busy page (13.1).

## FORAGE3 - WHAT SHIPPED (2026-09-28, Mac: "Let's do it")

The three loot hooks, 1:1 off IL_0520-IL_0b8f, and the two DFU events they hang on, each made one home:

- **`PlayerActivate.OnLootSpawned`**, `src/systems/containerLoot.js` (`registerContainerLootHandler`,
  `raiseContainerLootSpawned`): UL1's shape, by name in load order, RRI2's three shelf subscribers seeded first. Raised by
  `scenes/worldModes.js` - both exterior hosts' interiors - at both shelf doors (the shelf, and the merchant's Sell
  screen that stocks the same shelf) and, as DFU raises it (:914), at a stranger's house container, before "If no
  contents" (:916), so a tool can fill a cupboard that stocked empty. The args are DFU's two (`containerType`, `items`)
  and what DFU's subscribers read off the interior and the player (`buildingType`, `quality`, `luck`).
- **`LootTables.OnLootSpawned`**, `src/systems/loot.js` (`registerTabledLootHandler`, `raiseTabledLootSpawned`): raised
  inside `addPileLootExtras` after the J-O tail **for every key GenerateLoot finds** (the '-' past the table raises
  nothing, as GenerateLoot returns false), with `{ locationIndex, key, items }` - RRI2's RandomConditionLootItems the
  first subscriber, and so now wearing a Coven's, a Laboratory's and every other key's pile as DFU does, which it had
  not. The three pile sites hand their index: a dungeon's type (`scenes/dungeonContext.js rollPileItems`, WORLD8's
  re-roll with it), a building interior's location type (`scenes/interiorContext.js seedInteriorTreasure`, Q12), and a
  World of Daggerfall camp's 3 (`scenes/world.js`).
- **The law**, `src/systems/foragingLaw.js`: the five tables (`FORAGING_LOOT_TABLES`; the Vampire Haunt's is the console
  command's own array), RollForagingItemUsed's weights by band (`foragingItemCount`) and draw
  (`rollForagingItemUsed`), DetermineForagingItem, one item's gate and roll (`foragingLootItem`), and each hook's count
  (`containerLootDraw`, `dungeonLootDraw` over `DUNGEON_LOOT_ARMS`, `corpseLootDraw`) - the count before the roll at
  the corpse, the roll before the count at a pile, as the IL has them.
- **The subscribers**, `src/systems/foragingInstall.js` (`onForagingContainerLoot`, `onForagingPileLoot`,
  `onForagingEnemyDeath`), subscribed by `installForaging` in Init's order (IL_049a-IL_04f5); each mints with
  `createForagingItem` and adds at the back, and each is silent with the switch off.
- **The quirks**: Q1 (a uniform one in seven whatever the table) and Q2 (`Range(0, 1)`: the Pawn Shop, the palace, the
  Vampire Haunt and the Laboratory add nothing) ported; Q12 (an interior pile at its location type's index) ported,
  its "what a player sees" corrected - interiors hold piles only in a tavern or a Thieves Guild or Dark Brotherhood
  house.
- **FLAGGED by name**: a joiner's copy of a body the host killed online (15).
- **Pins**: `test/forage3_loot.test.js` (12), the loot sites' older pins re-aimed at the one homes
  (`rri2_realism`, `roada2_itemseconomy`, `lr1_lootrarity`, `wod3_spawner`, `world8`); `tools/mutants/forage3.json`,
  22 mutations, 22 dead.
- **The test reset's leak** (found 2026-09-28 by the whole suite on the bounty boards' integration, AUDIT BOUNTY1):
  `_resetForagingInstall` cleared the install's latch and left its three subscribers registered, so the OnLootSpawned
  pin heard Foraging's pile hook roll on Math.random ahead of its own spy - it failed 4 runs in 12. The reset takes the
  subscribers out with it now: 0 in 12.

## FORAGE4 - WHAT SHIPPED (2026-09-28, Mac: "Continue! Remember, this is your baby")

Online Foraging - the wait (13.1), and with it Foraging whole in both lanes:

- **The page**, `ui/huntWindow.js` (DELETED by HUNT-OUT, 2026-10-04 - the busy page alone is `src/ui/waitWindow.js` now, no Escape and no options): C&C's hunt page, THE ONE CONSTRUCTION SEAM - four constructor options (`ask`,
  `escape`, `interruptWhen`, `result`; the hunt leaves three at their defaults and, since HUNT-FOES, FIELD BUGS
  2026-10-02, gives `interruptWhen` a foe near, asked on its ask page too), and `remaining` / `extend(seconds)` for the
  wait's queue. The busy page's caption says "Escape to walk away" only where Escape does.
- **The wait**, `src/scenes/foragingWait.js` (`createForagingWait`): a quest's game seconds become real ones at
  `huntRealSeconds` (8 s a game hour, imported; since HUNT-OUT its own `waitRealSeconds`); the record `{ seconds, label, held }` lives on the player
  (`playerEntity.foragingWait`, one of `systems/save.js`'s ENTITY_FIELDS), so its seconds left and the boxes held
  behind it ride the save and a reload reopens the page; the page opens only when the slot is free; a second wait joins
  the first, their sum; the quest's boxes are held (`holds` / `hold`) while the wait is pending or open and shown in
  order once the page has left the slot; a foe near or a window taking the slot ends it with the rest forgiven; offline
  a saved wait is forgiven; a RESTORED record is cut to 64 s, once.
- **The door**, Quest Actions Extension's RaiseTime (`src/systems/quest/questActionsExtension.js`): under the shared
  clock its seconds go to the host's `waitOnline`, never to `raiseTime` - the quest machine's hook, the bridge's
  contract member (`scenes/questBridge.js`), and the streaming host's wiring.
- **The four hosts**: `scenes/world.js` - the one host that runs the shared clock - builds the wait on townTalk's slot
  (the mode machine's held overlay counting as a full slot), its rest test with a duel's foe in it, ticks it every
  frame in every mode (the street's frame and the modal frame both - AUDIT 28 F2: the modal frame returned before the
  street's tick, so a wait left pending indoors held every quest's boxes until the street), holds its quest boxes and a reward's pile behind it, and answers `waitOnline`; its interiors and
  dungeons (`scenes/worldModes.js`) are the same host's slot. **FLAGGED by name**: `scenes/exterior.js` (the fixed
  city) and `scenes/dungeonContext.js` standing alone never run the shared clock, so their RaiseTime is the offline
  advance and they wire no `waitOnline` (the fixed city's bridge reports it absent, with its other unwired seams).
- **The ledger**: section A's FORAGING row, departure (5), says the wait as built.
- **Pins**: `test/forage4_wait.test.js` (10) - the hunt's defaults kept, the four options, the seconds, the slot, a
  foe, the held boxes, the reload and the cap, the door both ways, the done-when on the machine (ChopWoodQuest online:
  a 12-second wait, 20% fatigue, the clock never asked), the wiring; `tools/mutants/forage4.json`, 18 mutations, 18 dead.
  (HUNT-OUT, 2026-10-04: the hunt's defaults and the four options went with the hunt; the file holds 14 tests - the
  wait page's own pins and its ENH-NOTICE3 panel among them - and `forage4.json` 17 records, with nine more in
  `tools/mutants/huntout.json`.)

## AUDIT 28 (2026-09-28, Mac: "let's audit everything we have so far before we continue")

Foraging's lens of the branch's audit (`06-Systems/Online-Arc.md` AUDIT 28), seven findings, each fixed where it was
wrong and recorded above where it was said: **F1** joined waits are their sum (only a restored record is cut); **F2**
the wait ticks in the modal frame too; **F3** the quest machine pauses under the page (said, not changed - it pauses
under every window); **F4** the Features row says the quest pack takes effect on the next load (`questLists.js` reads it
once); **F5** the textures are registered whatever the switch says (said); **F6** the boxes held behind the wait ride the
save; **F7** a switched-off Foraging has no console command. With the hosts' lens: the held boxes wait until the
finished page has left the slot (H6), and the hunt page hears Escape as townTalk hands it, `back` (H7) - C&C's own
search's Escape was never heard either. The patch table's count corrected (Q10 and Q11 are the port's own code).
`test/audit28_forage.test.js` (10); `tools/mutants/audit28.json` F1-F7, H6, H7, H11, H12; `forage4.json` and
`auditsurv.json` re-aimed, every one dead. (HUNT-OUT, 2026-10-04: H7's test and record retired with the hunt page -
the wait page takes no key; `audit28_forage.test.js` holds 9.)
