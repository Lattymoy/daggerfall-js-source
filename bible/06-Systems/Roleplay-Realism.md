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
| shipPorts: `IsShipAvailiable` (:610-631) | `TransportManager.ShipAvailiable`, the delegate | `ship.setShipAvailable`; `mountRig` asks with `shipLocation()` = `{ loaded, portTown, onShip }` from the host |
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
`RRMSTARM0-2`, Northrock Fort, the three factions, the custom armor
service (RR3).

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

## Record

`vendor/roleplay-realism/`. Suites `test/rr1_realism.test.js` (11),
`test/rr2_realism.test.js` (12). Campaigns `tools/mutants/rr1.json`
(19: 18 dead, 1 equivalent), `tools/mutants/rr2.json` (28 dead).
