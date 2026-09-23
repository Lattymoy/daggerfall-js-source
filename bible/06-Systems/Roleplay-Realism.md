# Roleplay & Realism - the mod, 1:1, in slices (RR1, 2026-09-23)

Mac: *"Since you mentioned role-play and realism, lets also get this
integrated alongside this"* - handing over
`RoleplayRealism-1.8-16-1-8-1721491697.zip` beside Roleplay & Realism:
Items (its own page, `Roleplay-Realism-Items.md`).

**Roleplay & Realism 1.8** for Daggerfall Unity, by **Hazelnut** (Nexus
mod 16; MIT by every script's header). "Modular roleplay and realism:
gameplay modifications." Eighteen modules, an enhanced-riding component
with five settings, a refined training window with two, a quest line
with its own fort and three factions. Its record is `vendor/roleplay-
realism/` (the manifest, settings, presets, string table and the seven
scripts verbatim from the author's repository), it is credited on the
About screen, on the Mods pane and the Features home, and it is ported
in slices - this page grows with them.

## The source the port reads

The shipped bundle carries a compiled DLL and no source. The author's
repository (`ajrb/dfunity-mods`, `RoleplayRealism/`, @ `0af2ec9`,
2024-07-21 - the day after the Nexus 1.8 upload) carries the source and
the same manifest, settings and string table, so the repository at that
commit is taken as the shipped 1.8. The zip itself was not on disk in
the session that vendored this, so the bundle-against-repository diff
Items' record carries is **RECORD OPEN** here. Every function in
`rrRealism.js` names the C# member it restates.

## RR1 - the formula overrides and the rule modules

`RoleplayRealism.cs` InitMod (:108-258) under each switch, at the
port's own site for the C# member, the switch read at the call (a pane
toggle takes effect at the next roll) - except the class enemies'
appearance, which DFU writes into `EnemyBasics.Enemies` at Awake and
the port writes at install (the Features row says *when the game next
loads*). Three modules: `systems/rrRealism.js` (the laws, a leaf),
`systems/rrInstall.js` (InitMod's registrations, run by the scene boot
after Items'), and the seams they hang on.

| module / mod law | DFU seam | the port's site |
|---|---|---|
| advancedArchery: `AdjustWeaponHitChanceMod` / `AdjustWeaponAttackDamage` (:530-578) | FormulaHelper's two mod hooks, by name | `formulas.js` `_overrides` - registered over what stood there (PCAAO's), which answers again when the switch is off |
| climbingRestriction: `CalculateClimbingChance` (:320-348) | FormulaHelper.cs:295-297 | `climbing.js registerClimbingChanceOverride`; the drawn weapon read through `playerWeapon.currentWeaponPose` (the rig registers the probe) |
| weaponSpeed: `GetMeleeWeaponAnimTime` (:350-387), registered only when Items' weaponBalance is off (:171) | FormulaHelper.cs:830 | `weaponStates.registerMeleeWeaponAnimTime` - one adapter, Items' arm first, this one behind it |
| weaponMaterials: `CalculateWeaponToHit` (:389-392) | FormulaHelper.cs:1140-1146 | `formulas.js calculateAttackDamage`, the to-hit line |
| equipDamage: `ApplyConditionDamageThroughPhysicalHit` (:394-407) | FormulaHelper.cs:1123-1128, "Only return if override returns true" | `formulas.js damageEquipment`'s `hit` |
| classicStrengthDamageBonus: `DamageModifier_classicDisplay` (:314-317) | FormulaHelper.DamageModifier | `formulas.js damageModifier` (PCO1's slot, chained) |
| loanAmountPerLevel: `CalculateMaxBankLoan` (:98, :309-312) | FormulaHelper.cs:2008-2010 | `banking.registerMaxBankLoan` |
| shipPorts: `IsShipAvailiable` (:610-631) | `TransportManager.ShipAvailiable`, the delegate | `ship.setShipAvailable`; `mountRig` asks with `shipLocation()` = `{ locationLoaded, portTown, onShip }` from the host (DISC13-D: it said `loaded`, which the delegate never read) |
| encumbranceEffects: `EncumbranceEffects_OnNewMagicRound` (:580-598) | EntityEffectBroker.OnNewMagicRound | `worldTick.registerMagicRoundHook` (the fatigue) + `entityMods.registerEntityFold` (MergeDirectStatMods' channel - the speed) |
| bandaging: `UseBandage` (:600-608), `if (rrItemsMod == null && bandaging)` | ItemHelper.RegisterItemUseHandler | never registered - the port carries Items always; `rrBandageHeal` ported for the record |
| autoExtinguishLight (:633-640) | PlayerEnterExit.OnPreTransition ToDungeonExterior | `worldModes` at the dungeon exit, the light's own "You douse the %it." box |
| purificationPotion: `CureDiseasePotionRR` | `RegisterEffectTemplate(..., true)` - the recipes replaced | `potions.overridePotionRecipes` |
| enemyAppearance: `UpdateEnemyClassAppearances` (:697-773) | `EnemyBasics.Enemies[...]` written at Awake | `applyEnemyAppearance(ENEMY_BASICS)` at install (`revertEnemyAppearance` for the test and the next load) |
| underworldExpulsion: `ThievesGuildRR` / `DarkBrotherhoodRR` | `GuildManager.RegisterCustomGuild` - AllowGuildExpulsion, Join, Leave, TokensExpulsion | `guilds.setUnderworldRule` (the clamp bypassed, the join floor), `setGuildExpelledHook` (the squad through the host's foe spawner), `updateRank`'s `lines` (the box's rows, `%pcn` expanded) |
| fightersTeachHandToHand: `FightersGuildRR` | GuildSkills / TrainingSkills, the virtuals | `guilds.setGuildSkillsOverride`, `guildServices.setTrainingSkillsOverride` |
| bedSleeping: `RegisterCustomActivation(41000..41002, BedActivation)` (:126-128, :464-506) | PlayerActivate's custom activations | `interiorContext` lists the beds; `worldModes` targets them while the switch is on and runs `toggleRest` - which IS DaggerfallUI's rest gate (:651-687) BedActivation restates |

Read against the C#:

- **The archery ladders** are ported as written, the `> 5000` arm
  shadowing the `> 8000` one (an `else if` chain: nothing ever reaches
  -20). The damage is the C# int cast.
- **FormulaHelper.RegisterOverride** keys by name and the last mod to
  register owns the member. PCAAO registers the same two archery hooks
  and DamageModifier; this mod registers after it (InitMod order: Items,
  then this), so with advancedArchery on this mod's arm answers, and
  with it off the arm that stood before answers again - the port
  chains where DFU would simply have lost the earlier one. The
  weapon-speed arm is the one InitMod gates on Items' weaponBalance
  (:171); the port's one adapter asks Items first.
- **The climbing gate** reads `WeaponManager.Sheathed` and
  `ScreenWeapon.WeaponType != Melee`; the rig registers
  `setWeaponPoseProbe` when it stands, a host with no rig answers null
  and nothing is drawn.
- **Equipment damage.** PCAAO's DamageEquipment replaces FormulaHelper's
  whole member while its equipmentDamageEnhanced is on - in DFU too -
  so this mod's armor arm runs only when that member is DFU's own.
- **The encumbrance penalty** reads CarriedWeight / MaxEncumbrance
  (live strength x1.5), LiveSpeed (which already carries the previous
  round's penalty - DFU's own self-reference, kept), PermanentSpeed and
  CurrentFatigue in raw units; `Min(CurrentFatigue - 100, over * 100)`
  goes negative under 100 fatigue and DecreaseFatigue then adds - the
  C#'s own arithmetic, kept. Guards the port can answer: not resting,
  alive; a paused game or a fade runs no round here (recorded).
- **The ship gate** in the wilderness is `location.Loaded == false ->
  false`; a host that cannot say where it stands (`portTown` null)
  hands the question back to DFU's HasShip rather than refusing.
  **SHIP-PORTS (2026-09-23): `shipPorts` ships OFF here, ON in the
  mod** - the one departure from the mod's defaults. The day the merge
  landed, Sir McMobdon on Discord: "cant access my boat anymore"; the
  module restricts the Ship row to a port town (Hazelnut's list with
  Travel Options on), every boat owner lost the classic
  board-from-anywhere without choosing to, and the switch was not on
  the Features home, so the only way back was the whole mod off. It is
  curated on the home now (`MOD_CURATED`) and off until a player asks
  for the port rule.
  **DISC13-D (the same day, the same report), the other half.** With
  the rule on, no port answered either. `world.js`'s `shipLocation`
  said `{ loaded, ... }`, and the delegate reads `locationLoaded`
  (`isShipAvailable`), so every port town read as the wilderness. The
  Ship row stayed dark everywhere except aboard, which is why turning
  Travel Options' port rule off changed nothing. The host answers
  `locationLoaded` now, so a player who switches the rule on gets the
  mod's port rule and not a ban (`test/disc13.test.js`).
- **Purification** keeps its eight ingredients (the same recipe key)
  with HealHealth and CurePoison `(3,1)` where DFU's carries HealHealth
  and Invisibility `(13,0)`.
- **The class enemies' appearance** writes the eight rows' textures,
  frames and, for the Sorcerer, `castsMagic` / `hasSpellAnimation`;
  475-488 are classic TEXTURE archives already in ARENA2.
- **The underworld guilds.** `AllowGuildExpulsion` answers the rank as
  it comes where DFU's two classes clamp a negative to 0; `Join`
  floors the reputation at 2; `Leave` (which `RemoveMembership` calls
  on expulsion) sends `4 + level / 1.5` rogues and as many thieves
  (`4 + level / 2` assassins and nightblades) through
  `CreateFoeSpawner`'s ring - the host's `standInteriorLooseFoe`,
  set on `rrInstall.setRrHostSeams` at mount; `TokensExpulsion` is the
  mod's own lines from the csv, centred, `%pcn` the player's name.
- **The bed** is BedActivation's own gate: enemies nearby, swimming or
  not grounded, the prevented-rest message, the racial override - the
  port's `toggleRest` runs the same `restDecision`. A bed is a target
  only while the switch is on; off, the click falls through as it does
  for any furniture.
- **bandaging** cannot register: `rrItemsMod == null` is never true in
  the port. Recorded, the law ported.

Not in this slice: variantNpcs / variantResidents, EnhancedRiding,
RefinedTraining (all RR2, below), the Master Armorer quest line -
`RRMSTARM0-2`, the three factions, the custom armor service (RR3a,
below), Northrock Fort and the armorer's shop variant (RR3b).

## RR2 - the NPC sprite variants, EnhancedRiding, RefinedTraining

Three components that are not formula overrides: two interior
transition subscribers that re-materialise billboards, a MonoBehaviour
on the player that draws the mount and reads the ground, and a custom
UI window registered over the guild's training service. Laws in
`rrRealism.js` (riding, training) and `rrVariants.js` (the sprites -
it reads the walker tables the leaf must not import); the install adds
its arms to `rrInstall.js`.

- **variantNpcs / variantResidents** (RoleplayRealism.cs:775-1077).
  DFU walks the interior's Billboards after `OnTransitionInterior` and
  swaps materials; the port stands its people once, so the interior
  context asks the host's `opts.variantPerson(pn)` as each person is
  listed and draws the answer (`drawArchive`/`drawRecord` beside the
  born `textureArchive`/`textureRecord`, which StaticNPC's identity -
  the name seed, the FLATS.CFG face - keeps). The keeper (:790-849): a
  shop's or tavern's `182_0` to `197_{0..3}` by quality (6-9, 10-13,
  14-17, 18-20), `182_1` to 4 under 12 and 5 past 14, `182_2` to 6
  past 12. The resident (:862-932): a faction-0 person of a known
  gender (GetGender182/184's tables verbatim), `faceVariant = nameSeed
  % 29` under 24 (four in five), `outfitVariant = nameSeed % 4`, the
  climate race's walker archive (Redguard, Nord, else Breton - GetClimateRace)
  at the idle record, and `flatsDict[bornFlat] = { faceIndex }` - the
  port's `setFlatFaceOverride`, which `dataPipeline.flatFaceIndex`
  reads before FLATS.CFG. The Villager Variety arm (:948-978) has no
  counterpart; `materialSet` is false and the walker's archive is
  taken, the C#'s else. The seven `197_N-0` sprites ship under
  `public/art/roleplay-realism/` on the replacement door (lazy, gated
  on variantNpcs; a classic archive, so ordinary entries), the mod's
  XML scale beside them through `registerBillboardXml`.
- **EnhancedRiding** (EnhancedRiding.cs). `CanRunUnlessRidingCart`
  (:95-99) on `transport.setCanRunOverride`: no gallop with the cart
  nor in a town unless GallopingInTowns (the host's `inTown`, `riding`,
  `transportMode` reads on `setRrHostSeams`). RealisticMovement
  (:128-136) on `moveAxes.setAxisLimitsProvider`: back 0.5 / sideways
  0.4 riding (a cart 0.2 / 0.1), 1 on foot. The terrain sample
  (:139-146) - `Atan2(here - ahead, 1) * 100` into a ring of 16 - lives
  in the mount rig with the host's `groundHeightAt`; OnGUI (:265-322)
  averages it over `16 + softenFollow` (0 unless followTerrainEnabled),
  lifts the sprite by `yAdj = (Pitch - terrainAngle - 10) * 2.6` (the
  port's up-positive radians turned into DFU's down-positive degrees)
  and fills the gap under it with a band of the same texture (`width -
  14` wide, `0.2 - yAdj / 100 .. 0.2` down, `0.06 .. 0.84` across); no
  neck CFA is imported, so the band is the texture's own, the C#'s
  fallback. `PitchMaxLimit = terrainAngle + 18` (:288) is
  `lookFilter.setPitchFloorProvider`, clamped at DFU's 75. The trample
  (:135-163) and the charge (:189-215) are the world host's
  `rrRidingContacts`, run after the rig's frame while riding and
  running: a walker within 0.9 (Unity's two 0.45 cylinders) bleeds at
  `BloodPos` (2 ahead, 1 up; the civilian's own rung), cries the Breton
  pain clip of their gender at RidingVolumeScale, `SpawnCityGuards
  (true)`, Assault, and is retired from the pool (`TownPopulation.
  retire`, the C#'s `SetActive(false)`); a guard walker is replaced by
  `cityGuards.spawnCityGuard` where they stood and charged. A foe at
  the mount's touch is charged once (`_rrCharged`, the C#'s
  PickpocketByPlayerAttempted latch): its combat voice, knockback 100
  the way the rider faces, the rider spends 15 x DefaultFatigueLoss,
  and takes hand-to-hand's span + Agility / 10 + Willpower / 10.
- **RefinedTraining** (GuildServiceTrainingRR.cs) -
  `buildRefinedTrainingFlow`, chosen over DFU's training flow at
  worldModes' service arm while the switch is on
  (RegisterCustomUIWindow). The picker opens first (:39-41); the
  chosen skill's price is `cost -= (int)(cost * (1 - skill / 50) / 2)`
  under variableTrainingPrice; under intensiveTraining and `skill < 46`
  the mod's own four lines offer a session or five days at
  `(cost + Level * 8 + 72) * 5` with a Yes / "5 Days" (BUTTONS.RCI
  record 21, the mod's own PNG on `messageBox.registerButtonArt`) / No
  box; the week is four days off the clock and +4 permanent (the
  host's `applyIntensive`), then the fifth session through DFU's own
  TrainSkill and the three "intensively training" lines. Otherwise the
  record's offer with the skill's name spliced after its first word
  (:68-70). The gold gate is DFU's NOT_ENOUGH_GOLD on either price.

## RR3a - the Master Armorer quest line: the registrations

RoleplayRealism.cs:241-256 registers what the line needs and DFU's
mod hooks provide; the port had none of the four hooks, so this slice
is as much DFU as mod. Laws in `systems/rrQuestLine.js`; the install
adds InitMod's four calls to `rrInstall.js`.

- **The quest list** - `QuestListsManager.RegisterQuestList(
  "RoleplayRealism")` (:241) is `quest/questLists.registerQuestList`
  (QuestListsManager.cs:138-147); `LoadQuestLists` reads the registered
  lists after Classic and DFU (:160-161). The list and its three quests
  (`RRMSTARM0` Mountain Rumors - Fighters rank 9, one-time; `RRMSTARM1`
  The Master Armorer and `RRMSTARM2` A Careless Price, chained from it)
  are vendored verbatim under `vendor/roleplay-realism/Quests/` and ride
  the pack loader's globs (`scenes/questData.js`), the list into the
  tables map and the sources into the pack's. All three parse under the
  port's parser with no line pended.
- **The two tables** - `PlacesTable.AddIntoTable` / `FactionsTable.
  AddIntoTable` (:250-251) is `quest/tables.addIntoQuestTables`: the
  rows are kept and applied to a loaded table at once and to a later
  load as it lands (the install runs before the pack). Aldleigh and the
  two fort sites, the three named individuals.
- **The three factions** - `FactionFile.RegisterCustomFaction` (:659-706)
  is `formats/factionFile.registerCustomFaction` (FactionFile.cs:702-719),
  read by `factionRep.addCustomFactions` (PersistentFactionData.cs:139-155)
  on every fresh player dictionary (Reset, :331) and by the talk host's
  own reader. DFU's RelinkChildren adds without clearing, so after a
  parented custom faction lands every parent lists its children twice -
  kept, pinned.
- **The custom armor service** - `Services.RegisterMerchantService(1022,
  CustomArmorService, "Custom Armor")` (:254) is `guildServices.
  registerMerchantService` (Services.cs:146-175); the static-NPC route
  reads `HasCustomMerchantService` before the shop test (PlayerActivate.
  cs:1574), the merchant popup shows the service's own label and runs
  it from the service button (DaggerfallMerchantServicePopupWindow.cs
  :112-115, :149-151). The service (:419-484): under level 9 the apology
  box; else a Buy trade window over a shelf of every plate piece in
  every material the level allows (Mithril at 9, Adamantium and Ebony at
  12, Orcish at 15, Daedric at 18 - the foreach breaks) in its variant
  span (cuirass and pauldrons 1-3, greaves 2-5, gauntlets 1, boots and
  helm 1..variants-1, no shields), plus every registered custom armor
  class at each material.
- **The two PlayerGPS subscribers** - OnMapPixelChanged (:270-297): at
  938,51 the two "very near" lines, on the eight neighbours "near" with
  the fort's direction, AddHUDText for 5 seconds; OnEnterLocationRect
  (:259-267): a location whose `ARMRAM03.RMB` building 14 carries a
  variant discovers the shop under "Dharjen Custom Armor" at the
  region's key (Pjiga 131342, Penmore 197134, Paponirea 131598).
- **WorldDataVariants + WorldUpdate** - the quest's three `worldupdate
  building ... variant master` lines were the one action the port
  guarded (QG1's last PendingTrigger). `systems/worldDataVariants.js`
  is WorldDataVariants.cs whole (the four setters with the C#'s own
  return values, the here/any getters, `MakeLocationKey`, save and
  restore); `quest/actions.WorldUpdate` is WorldUpdate.cs (six forms,
  `-` is NoVariant). The registry's READER - WorldDataReplacement's
  block and building JSON, the new location - is RR3b.
- The list, the factions and the service ride the mod's Enabled: DFU
  has no switch for them (a loaded mod registers), so the port's
  Enabled stands in - the list and the service read it at the load and
  the click, the factions are registered while it is on at boot.

## RR3b - the Master Armorer quest line: the world data

The three files under `vendor/roleplay-realism/WorldData/` (verbatim):
`locationnew-RRfort01-16.json` - Northrock Fort, a new ReligionCult
location in the Wrothgarian Mountains at map pixel 938,51 (the tracks'
centre), one block, one House6 building (0x73A1, the quest's
`Northrock_Fort`; the exterior 0x73A0 is `Northrock_Fort_Ext`);
`RRFORT01.RMB.json` - that block (18 exterior models, an interior of 73
models, 40 flats, 2 people, 6 doors, 4 misc flats, its ground and
automap); `ARMRAM03.RMB-765-building14_master.json` - the armorer's
shop in block ARMRAM03 (BSA index 765), record 14, as `worldupdate
building ... variant _master` rebuilds it (faction 1022, an Armorer of
quality 20, seed 632, a 33-model interior).

They come through **WorldDataReplacement.cs, ported whole** as
`formats/worldDataReplacement.js`:

- **The door.** `formats/worldDataDoor.js` is a leaf both readers
  import; the replacement module installs itself there (a cycle would
  otherwise run readers -> door -> readers' enums). MapsFile asks it at
  LoadRegion's tail (:984, the region's additional locations), at
  ReadLocation's head (:998-1000, a replaced or new location) and in
  ReadLocationIdFast (:1027-1028, the map table's own id); BlocksFile
  at GetBlockName (:214, a new block's name past the BSA's count),
  GetBlockIndex (:273, its assigned index), GetBlock (:383-390, the
  JSON block, cached into a BSA-range slot) and ReadRmbBlockData
  (:848-861, a building record replaced in a classic block, the list
  entry and the automap updated). The hosts bind their BlocksFile
  (`bindWorldDataBlocks` - ContentReader.BlockFileReader, where
  AssignBlockIndices reads BsaFile.Count) and await the mod assets
  (`scenes/modWorldData.js`, a glob over `vendor/*/WorldData/*.json`,
  gated on that mod's Enabled - the ModManager arm; the loose-file
  arm has no StreamingAssets folder to read) before the first region
  loads. `Settings.AssetInjection` gates every ask.
- **The laws.** GetDFRegionAdditionalLocationData (:127-203) with
  AddLocationToRegion (:510-530: the id copied onto the map table for
  ReadLocationIdFast, the next index, Unknown2 = index, the lookups)
  and AssignBlockIndices (:531-573: a block name the BSA lacks gets
  `Count, Count+1, ...`); GetDFLocationReplacementData (:204-262) with
  LoadNewDFLocationVariant (:263-310); GetDFBlockReplacementData
  (:342-398) with ReplaceRmbBlockBuildingData (:400-433, exterior and
  interior halves only); GetBuildingReplacementData (:435-482, asked
  with NoVariant and answered by the last location's variant, else
  any's); ApplyBuildingReplacementAutoMapData (:494-508, 30 means
  leave it); MakeLocationKey. Every `#if !UNITY_EDITOR` cache is taken
  (a region, location, block or building with no file is remembered
  as none - non-variant only, as the C#).
- **The converters.** DFU deserialises straight into its structs; the
  port's readers spell the same structs in camelCase, so the JSON is
  converted field for field: the enums spelled ("ReligionCult",
  "NoDungeon", "House6") to the port's numbers, the climate by the
  JSON's WorldClimate through the port's own table (the seven inline
  fields agree), the FLD header's positions and counts from the
  subrecords and arrays (the JSON carries them there), the 32-slot
  building list padded, the ground tiles un-flattened y-outer x-inner
  (DFBlock.RmbGroundDataConverter, DFBlock.cs:1124-1185), the flat
  records' bitfield rebuilt, the automap as bytes, the fields the JSON
  does not carry zeroed. A subrecord header keeps the count the JSON
  wrote (the fort's exterior says 1 over 18 records); DFU walks the
  arrays and gates the interior on the header's zero, and so does the
  port.
- **RMBLayout's arm** (:662-672) in `talkTopics.mergeNamedBuildings`:
  a replaced building takes the replacement's faction, quality and
  `NameSeed + LocationIndex` and hands its pool draw back when the
  replacement names a faction; the type is always the replacement's.
  The merge takes `{ locationIndex }` now, and every host site passes
  the location's.
- **The save** carries WorldDataVariants' data (SaveLoadManager.cs
  :1125, :1465-1466); a save from before RR3b restores nothing.

With RR3b, `RRMSTARM1`'s `Northrock_Fort_Ext` / `Northrock_Fort` places
resolve (ReadLocationIdFast finds 0x73A0 on the added map-table row;
the interior is 0x73A0's building), the fort stands at 938,51 through
the ordinary location index, and the three `worldupdate building` lines
put Dharjen's rebuilt shop in Pjiga, Penmore or Paponirea - which is
what the discovery on the location rect (RR3a) then names.

## AUDIT-RR (2026-09-23) - the audit of RRI1, RRI2, RR1, RR2, RR3a and RR3b

Mac: *"Lets do one more audit."* Four reviewers over the six slices, each
with the author's C# open beside the port (RoleplayRealism.cs,
EnhancedRiding.cs, GuildServiceTrainingRR.cs, ThievesGuildRR.cs,
RoleplayRealismItemsMod.cs and the fourteen item classes, plus the DFU
files they hook: FormulaHelper, GuildManager, GameObjectHelper,
DaggerfallLoot, ItemBuilder, WorldDataReplacement, WorldDataVariants,
PlayerGPS, PlayerEntity), then every finding re-read against the source
before it was paid. Checked and standing: the eighteen switches and
their defaults, the archery and bandage arithmetic, the loan and ship
laws, the enemy appearance table, the sprite-variant ladders, the pitch
floor and axis limits, the training price and the intensive day count,
the quest tables and their macros, the fort's proximity, the world-data
JSON readers (regenerated against the C# with `DFU_PATH`). Thirty-nine
findings were raised across the six slices; those paid on this page's
slices (RR1-RR3b) are below, numbered as the code comments carry them
(`AUDIT-RR Fn`); the Items page carries its own.

**RR1 (d02eb562):**

- **F1 - the anim-time override was inert on the swing that lands.**
  `FormulaHelper.GetMeleeWeaponAnimTime` takes `(player, weaponType,
  weaponHands)` and RR's weaponSpeed arm (and RRI's weaponBalance arm)
  read the held weapon through them; the port's `machineStep` asked the
  override with the live speed alone, so both arms fell to the classic
  clock on the live rig and only the widget clone timed the mod's way.
  `machineStep(m, dt, liveSpeed, animCtx)` hands the rig's `{ entity,
  weaponType, usingRightHand }` through; `weaponRig` sets the thunk.
- **F2 - the underworld join floor missed the quest-end path.**
  `GuildManager.AddMembership` runs the class's `Join()` (:122-126), and
  ThievesGuildRR's Join floors the reputation at 2 (:91-99), but
  `guildInitiationQuestEnded` called `joinGuild` without the store. It
  takes one; world.js hands the quest store.
- **F4 - the death squad placed like a conjured foe.** The mod's
  `CreateFoeSpawner(false, type, n, min, max)` places with NO line-of-
  sight check, its own distances (1..8, 1..5) and FoeSpawner retries
  every frame until every foe stands (FoeSpawner.cs:53-80); the port's
  `standLooseFoe` used 4..20, a line-of-sight check and 12 attempts,
  so a squad in a corridor was half a squad. `standLooseFoe` takes
  `{ minDistance, maxDistance, lineOfSightCheck, attempts }`; the squad
  gets 600 attempts (`RR_SQUAD_PLACE_ATTEMPTS`).
- **F5 - encumbrance effects ran on every entity.** The C# reads
  `GameManager.Instance.PlayerEntity` alone (:582); the port's magic-round
  hook took the entity it was handed, so a laden foe was slowed and
  drained. Gated on `entity.isPlayer`.
- **F7 - float32.** `EncumbranceEffects_OnNewMagicRound` is float
  arithmetic (:590-595); double arithmetic put 38/50 one band edge off
  (speed 1, fatigue 2 where the C# takes 0 and 1). `Math.fround` at
  every step; pinned on both sides of the edge.
- **F8 - SetFatigue's upper clamp.** The fallback arm clamped at 0 only;
  a negative fatigue effect (under 100 fatigue, the C#'s own arithmetic)
  added past MaxFatigue. Clamped both ways (DaggerfallEntity.cs:350-360).
- **F6 - the bed rested in the room's allocated bed.** BedActivation
  opens `new DaggerfallRestWindow(uiManager, true)` (:524) -
  `ignoreAllocatedBed` - so you rest in the bed you clicked; the port
  opened the ordinary window. `toggleRest({ ignoreAllocatedBed })`.
- **F10 - a frozen ENEMY_BASICS row was skipped in silence.** The
  enemyAppearance writer now says which row it could not write.
- **F9 (named)** - the purification potion's switch is read at install,
  a departure from the port's live reads, recorded at the site.
  Duplicate imports in rrInstall.js merged.

**RR2 (06bdf5d6):**

- **F13 - the sprite-variant race was Breton everywhere.** The port
  handed `climate` (the settings object) where the C# takes
  `climate.WorldClimate` (223-232) into `GetWorldClimateSettings`; the
  climate type 0-3 matched nothing and fell to the Breton arm. Fixed at
  the one site.
- **F14 - the neck band drew the wrong rows.** `Rect(extX, 0.2 -
  yAdjNeck, extW, yAdjNeck)` is in Unity texcoords (v = 0 the bottom
  row); the port's screen quad samples v = 0 at the top, so the band
  drew the top of the sprite. `rrRidingNeckBand` answers 0.8 .. 0.8 +
  yAdjNeck (the bottom fifth: the neck and chest), the width trim 14.
- **F25 - the docked large HUD.** EnhancedRiding's own arm asks
  `LargeHUDDocked` (:256-257) and lifts the mount by the HUD's height;
  the port lifted by the classic arm's horse offset. `liftForLook` asks
  `dockedLargeHudHeight()` and the band draw takes the same offset.
- **F15 - the trample's blood was a scratch.** `DamageHealthFromSource`'s
  civilian dies in one contact; both hosts hand `LETHAL_HIT` to the
  splash.
- **F16 - the trample's cry played at 0.6 x 0.6.** `RidingVolumeScale x
  SoundVolume` (:151): the master bus carries SoundVolume already, so
  the clip plays at `ridingVolumeScale()` alone (0 on a journey).
- **F17 - the charge ran through the weapon path's knockback.** The
  component writes its own `KnockbackSpeed = 100` (:199-200) and
  `DamageHealthFromSource` (:212) is the blow alone; the port handed a
  knock direction down the weapon path, which overwrote the component's.
  `chargeFoe` hands no direction; the standalone exterior host, which
  had no riding component at all, stands one (`rrRidingHost.js`, the
  contacts shared by both hosts).
- **F18 - the charge voice was the 40% gated pain voice.**
  `PlayCombatVoice(gender, false, true)` (:195) is called directly - no
  CombatVoices gate, no dice, monsters too. `enemyHeavyPainVoice`.
- **F23 - the intensive result dropped DFU's own box.** `TrainSkill`
  pushes `MessageBox(TrainSkillId)` (DaggerfallGuildServiceTraining.cs
  :119-128) and the intense box is pushed OVER it (:174-191): the player
  reads the mod's three lines, then the record. Two boxes.
- **F24 - the gold gate ignored letters of credit.** `GetGoldAmount`
  (PlayerEntity.cs:1313-1316) counts them; `totalGoldAmount`.
- **F26 - float32 again.** `(float)skillValue / trainingMax`: 3 gold
  at 20/60 is 3, not 2.
- **F30 - the order.** `RaiseTime(SecondsPerDay * 4)` (:171) then
  `SetPermanentSkillValue` (:172); the port wrote the skill first. The
  ticker advances, then the +4.
- Cite drift in EnhancedRiding's references corrected (:57-61,
  :105-131, :241-249, :252, :266-278).

**RR3a (1ff1c28f) and RR3b (c7caa8e6):**

- **F32 - the last location key was stale at layout.** DFU sets
  WorldDataVariants' last key when the DFLocation is read, right before
  RMBLayout (MapsFile.cs:999); the port's boot index read every location
  and left the key on the LAST, so the shop variant the quest set was
  asked against the wrong location. `setLastLocationKeyTo` before
  `layoutLocation`, in both hosts.
- **F33 - the locationnew resolver was never wired.** RR3a's
  `setNewLocationIndexResolver` seam stood empty; `SetNewLocationVariant`
  asks `GetNewDFLocationIndex` (WorldDataVariants.cs:101).
  `installWorldDataReplacement` wires it.
- **F34 - place.js merged without the location index.** The quest
  place's building merge seeded no `locationIndex`, so a replacement
  building's key resolved against location 0. Passes the location's.
- **F35 - a negative key asked AnyLocationKey.** `if (lastLocationKey >=
  0)` (:192): a negative key asks nothing. Guarded.
- **F36 - a phantom discovery record.** `DiscoverBuilding` returns when
  `GetBaseBuildingDiscoveryData` fails (PlayerGPS.cs:932-933); the port
  discovered the armorer with no directory record. Only with one.
- **F37 - a duplicate location remapped the vanilla one.**
  `Dictionary.Add` (:521-522) throws on a mapId or name a vanilla
  location already has; the port's silent remap was its own invention.
  Throws.
- **F38 - a stored replacement block was never read.** `LoadBlock`
  answers true for a slot the replacement filled (no MemoryFile), so
  the record was never decoded (BlocksFile.cs:303). Re-reads when the
  slot's bytes are null.
- **F39 - a new game kept the variants.** `PlayerEntity.Reset` (:818)
  clears them; both new-game paths do.

**Named, not changed:** the shipLocation departure at d02eb562 (fixed
by RR2); RRI-present-but-disabled semantics (a class registered under a
switch that is off answers null, as an unregistered class does); the
standalone dungeon host has no HUD say; beds only in buildings; the C#
gender-carry quirk in the sprite variants (the port normalises it); the
contact geometry (a trigger sphere against the port's 0.9 reach); the
PitchMaxLimit snap and the 75-degree floor; the walker at 1 FPS against
the mod's 5; a negative nameSeed; two deliberate C# slip fixes in RR3a;
the title reload after a world-data install.

Suite `test/auditrr.test.js` (15). The float32 edges, the neck band,
the riding contacts, the negative key, the class virtuals and the
override context are pinned by execution; the hosts' wiring by source.

## AUDIT-RR2 (2026-09-23) - the second pass, and the audit of AUDIT-RR

Mac: *"One more audit."* Four reviewers again, the C# beside the port,
one of them over AUDIT-RR's own payments (0de4bd6f): every changed
signature's callers, every cited line re-read, the item weight's new
read followed to every writer. Checked and standing this time: the
eighteen switches, the archery and bandage arithmetic, the loan law,
the enemy appearance rows and their readers, the variant tables entry
by entry, the axis limits, the terrain sample, the neck band's numbers,
the training flow's texts and order, the quests byte for byte, every
quest action keyword, the world-data readers field by field, the block
index assignment, the factions, the merchant service's routing, the
discovery keys, the loader at every host, both test files' numbers.
Twenty-seven findings, twenty-five paid, two named; the ones on this
page's slices below, numbered as the code comments carry them
(`AUDIT-RR2 Gn`); the Items page carries its own.

**The audit of AUDIT-RR:**

- **G1 - Extra Weight made an item weightless (a regression of F5).**
  `ExtraWeight.cs:61` is `weightInKg *= 4` over the weight ItemBuilder
  always stores; the port's payload multiplied an unset field and wrote
  0, which nothing read until F5 made `unitWeightInKg` honour a stored
  weight. The base is the derived read now; Feather Weight's 0.25 stands.
- **G2 - the charge cry's gender.** The component's own pick
  (EnhancedRiding.cs:190-194): Male for a rolled male or the city watch,
  FEMALE for everything else - a monster is `MobileGender.Unspecified`
  and cries in the female clip. F18 had borrowed WeaponManager's
  male-default pick. `enemyHeavyPainVoice` picks its own.
- **G3 - F37's throw fired after the region was written.** The checks
  came after `locationCount++` and the two pushes, so a duplicate left
  the region one row past its lookups; the C# pushes to LOCAL lists.
  The checks stand first. And because the port's boot index reads every
  region where DFU reads one at a time, one bad mod file is said
  (`console.error`) and its location skipped rather than the world host
  dying at boot - a departure, recorded at the loop.
- **G4 - `(int)LargeHUD.ScreenHeight`** (:257): the docked offset is
  truncated, as the classic arm's is.
- **G5 - the charge cry lost its pitch lift.** EnemySounds plays the
  clip on the enemy's source at `pitch + Range(0, 0.3)` (:172-175); the
  shared home played a flat one-shot. `playVoice(f, v)` goes through the
  host's spatial door with `1 + v.pitchLift`, at the foe.
- **G6 - the wire.** A stored weight is honoured now, so a peer's
  negative one is refused (`num({ min: 0 })`).
- **G13 - a building entry did not set the last location key.**
  `PlayerEnterExit.cs:695-696` "Ensure building variant checks use this
  location" on EVERY transition; F32 set it at layout, and a streamed
  neighbour laid out after the town left the key on itself, so the
  armorer's door merged the pool's identity. Set at the door, both hosts.

**RR2 (06bdf5d6):**

- **G20 - the encumbrance round ran through synthetic time.** The C#
  returns under `EntityEffectBroker.SyntheticTimeIncrease` (:587); the
  port's hook drained every catch-up round of a fast travel, so an
  over-encumbered traveller arrived at 100 fatigue. Gated.
- **G21 - the five-day box took no keys.** QG1's PromptMulti rule
  (click-only) was applied to every multi-button box, but
  DaggerfallMessageBox binds a shortcut for every ENUM button (:377):
  Yes and No answer Y and N in DFU, the out-of-enum 21 takes none,
  AllowCancel false keeps Escape dead. The flow answers the two keys
  when the list holds them.
- **G22 - the ship gate asked the flag with Travel Options on.**
  `travelOptionsEnabled` sends TO "hasPort" (:635-644) - Hazelnut's
  hand-written port list (`travelPorts.js`) - and asks
  `PortTownAndUnknown` only without it. The gate asks the list when the
  vendored mod is on.
- **G23 - PitchMaxLimit's lower clamp.** The setter is `Clamp(value,
  PitchMin, PitchMax)` (PlayerMouseLook.cs:87-90) with PitchMin -90; a
  steep bank's `terrainAngle + 18` fell past vertical in the port and
  flipped the camera. Clamped at -90.
- **G24 - the charge latch IS the pickpocket latch.**
  `PickpocketByPlayerAttempted` (:185, :204): a foe already tried cannot
  be charged and a charged one refuses the hand. The private flag is
  gone; `entity.pickpocketAttempted` is the one field.
- **G25 - the foe arm's knockback direction.** OnControllerColliderHit
  hands `other.moveDirection` (:173) - the controller's motion, not the
  look; the guard arm keeps `transform.forward` (:158). The shared home
  takes the frame's displacement of the feet, normalised, and the look
  while standing.
- **G26 - the floor while paused.** The else arm (`IsGamePaused ||
  !IsRiding`, :122-131) resets PitchMaxLimit every frame; the provider
  answers null while paused.

**RR3a (1ff1c28f) and RR3b (c7caa8e6):**

- **G14 - an RDB JSON served a null body.** The C# deserialises a whole
  DFBlock, RdbBlock included (:363-369); the port converts the RMB half
  only and served an `.RDB.json` typed Rdb with `rdbBlock: null`, which
  the dungeon layout would fall through. Said and not served (RR ships
  none; the converter is future work).
- **G15 - `newLocation` only inside the TryGetValue arm** (:176-182).
- **G16 - the variant arm's prefix.** The mod arm (:284-292) takes every
  asset the suffix finds; only the loose-file arm names `locationnew-*`.
  The port's filter is gone.
- **G17 - the label's "?"** (Services.cs:173-179), and the pin that
  asserted `''` re-aimed.
- **G19 - the padded building rows.** DFU's list is the JSON's length;
  the port pads to its 32-slot shape and padded with Alchemist (0). It
  pads with `BuildingTypes.None` (-1), and the pin that asserted 0 is
  re-aimed.

**Named, not changed:** `cachedColliderHitObject` (EnhancedRiding.cs
:167-177) - a foe first touched while not galloping is cached, and a
later gallop into the same foe does nothing until another object is
touched; the port charges it. A C# quirk, recorded. The `locationnew`
arm of WorldUpdate reads the captured name where DFU passes null and
throws (WorldUpdate.cs:70-72) - the port's fix of DFU's slip stands.
The squad's 600 placements run in one frame where FoeSpawner spreads
them over frames - a stall at most, not a difference in what stands.
`modelFromJson` drops XScale/YScale/ZScale (RMBLayout.cs:76) - a
general port gap, no RR file carries them.

Suite `test/auditrr2.test.js` (17). Extra Weight, the cry's gender, the
riding contacts' latch and direction, the wire clamp, the stored fur
weight, the equip delay, the merged table, the shelf's stack, the
synthetic gate, the pitch clamp and the variant flag by execution; the
hosts' wiring by source. Four mutant records re-aimed by content; all
six campaigns re-run (rr1 18 dead + 1 equivalent, rr2 28, rr3 31 + 2,
rr3b 24, rri1 11, rri2 18).

## Record

`vendor/roleplay-realism/`. Suites `test/rr1_realism.test.js` (11),
`test/rr2_realism.test.js` (12), `test/rr3_questline.test.js` (11),
`test/rr3b_worlddata.test.js` (9), `test/auditrr.test.js` (15), `test/auditrr2.test.js` (17). Campaigns `tools/mutants/rr1.json`
(19: 18 dead, 1 equivalent), `tools/mutants/rr2.json` (28 dead),
`tools/mutants/rr3.json` (33: 31 dead, 2 equivalent),
`tools/mutants/rr3b.json` (24 dead).
