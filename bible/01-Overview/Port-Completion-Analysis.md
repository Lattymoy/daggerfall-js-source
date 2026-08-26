# Port Completion Analysis - what a full 1:1 port of DFU still needs

Snapshot taken 2026-08-22 against Daggerfall Unity `81e89e90` (master,
2026-06-30), by cross-referencing the whole DFU C# tree against `src/`.

**READ THIS FIRST - THE STATUS OF THIS PAGE.** Five of sixteen planned
subsystem sweeps completed before the run was stopped, and NONE of the
findings on this page went through the two-refuter discipline AUDIT 24
used. Under the Ledger's own rule - a stale "not yet ported" row is worse
than a missing one - every row below is a CLAIM, not a verdict. The
mechanical measurements in "The numbers" are reproducible and safe; the
subsystem gap lists are analyst output at one lens and want refuting
before any slice is opened on them. The eleven subsystems marked NOT YET
SWEPT are sized from source LOC only.

**RE-CHECKED 2026-08-26 (the AUDIT 26 narrowing pass).** This page is a
SNAPSHOT and stays one: the measurements under "The numbers" are of the
2026-08-22 tree and are NOT re-run here. What changed is the gap lists.
The 2026-08-23..25 sprint closed most of what they name - six of the
thirteen never-touched rows are struck outright below, four more are
narrowed to what is genuinely left, and the swept bullets a slice has
since overtaken are struck the same way. Every strike names the code that
closed it, and the slice where the record carries one; an unstruck row was
re-read against `src/` on 2026-08-26 and stands. The page's own rule applies to its own rows: a stale "not
yet ported" claim is worse than a missing one.

## The numbers

Measured, not estimated. In-scope DFU C# excludes `Assets/Scripts/Editor`,
`Assets/Game/Addons/*` (mod system, RmbBlockEditor, WorldDataEditor,
UnityConsole, CSharpCompiler), `AudioSynthesis`, `External/iTween` and
`Utility/AssetInjection` - all four already Doctrine or Ledger-C
exclusions.

| | |
|---|---|
| DFU C#, in scope | 234,241 loc / 704 files |
| ...cited by a port module (a `src/*.js` names the `.cs`) | 150,161 loc / 298 files (64%) |
| ...named only in `bible/` (routed, or context) | 38,812 loc / 172 files |
| ...never named anywhere in the repo | 45,268 loc / 234 files |
| Port | 88,640 loc JS / 315 files |
| Tests | 61,898 loc / 276 files; 2,492 tests, 0 fail, 180 skipped (ARENA2 gates) |

Citation is a WEAK signal - it proves a module claimed the source, not
that it ported it. The three verified counts below are the strong ones.

**Quest actions: ~~61~~ 62 of 82 implemented.** The other ~~21~~ 20 are
`PendingTrigger` guards (`systems/quest/actions.js`) - the line matches its
verbatim pattern and PENDS, exactly as DFU sends an unregistered line, and
nothing runs: `CastEffectDo`, `ChangeFoeInfighting`, `ChangeFoeTeam`,
`ClickedFoe`, `Climate`, `Enemies`, `JournalNote`, `KillFoe`, `PayMoney`,
~~`PlaySong`,~~ `PromptMulti`, `RunQuest`, `Season`, `SetPlayerCrime`,
`SpawnCityGuards`, `TrainPc`, `UnrestrainFoe`, `Weather`,
`WhenAttributeLevel`, `WhenSkillLevel`, `WorldUpdate`. **PlaySong SHIPPED
2026-08-25** - a real template over `systems/songFiles.js` (SongFiles.cs +
EnumToFilename in the archive's spelling); its Ledger row is struck.

**Macros: 83 of MacroHelper's 217 appear anywhere in `src/`; 134 do not.**
The missing set is dominated by the biography/class-question block
(`%q2`..`%q11` and their `a`/`b` arms), every attribute macro (`%str`
`%int` `%wil` `%agi` `%end` `%per` `%spd` `%luc`), the clock/date block
(`%hour` `%min` `%day` `%mon` `%year` `%sea` `%hol`), the weapon/armour
info block, and the painting macros (`%sub` `%adj` `%pp1` `%pp2`).

**Effects: 34 of 85 effect classes absent from `src/`.** They cluster
almost perfectly: the whole `Effects/Enchanting` tree (23 files, 3,498 loc
- `CastWhenHeld/Used/Strikes`, `SoulBound`, `StrengthensArmor`, `PotentVs`,
`RegensHealth`, `ItemDeteriorates`...) and `Effects/Special` (11 files,
2,527 loc - Lycanthropy, Vampirism and the eight Daedric artifact
effects). Per-attribute `Drain*`/`Transfer*`/`Heal*`/`Fortify*` classes
are named nowhere but ARE covered - the port keys them generically, and
AUDIT 24's regeneration gate rebuilds that set from the source tree.
**The larger of the two clusters has since closed**: the `Effects/Enchanting`
tree shipped at E1/E2 (2026-08-23) and `Effects/Special`'s two infections at
V1 (2026-08-24). The count is the 08-22 measurement and is not re-run here.

## Never touched at all - sized from the C# (as of 2026-08-22)

| Subsystem | DFU loc | Notes |
|---|---|---|
| ~~Interior automap (`Automap.cs` + window)~~ | 5,091 | ~~pure new build; needs a dungeon-geometry discovery model~~ SHIPPED A1 2026-08-23: `systems/automap.js` (the probe set + the two-tier discovery record) + `ui/automapWindow.js` |
| Controls / keybinding / joystick + `InputManager` | 4,110 | ~~the port has no keybinding registry at all (Ledger A already records the main-menu hotkey gap as a consequence)~~ NARROWED - the registry, the host reads and the rebinding grid all shipped 2026-08-23 (I1/I2/I4: `systems/inputActions.js`, `systems/controlsConfig.js`, `ui/controlsWindow.js`), and the main-menu hotkey row landed on them. STILL OUT: joystick/gamepad entirely, the mouse and advanced sub-windows (both answer with a note), and key COMBOS |
| ~~Exterior automap~~ | 3,582 | SHIPPED A2 2026-08-24: `ui/exteriorAutomapWindow.js` + `ui/nameplateLayout.js` |
| ~~Enchanting effect tree~~ | 3,498 | ~~gates every enchanted item, artifact and the item maker~~ SHIPPED E1+E2 2026-08-23: `systems/enchantments.js`, and the item maker it gated followed at M4 |
| HUD component set | 3,272 | ~~`HUDLarge`, `HUDActiveSpells`, `HUDPlaceMarker`, escorting-NPC faces, quest debugger~~ NARROWED - `ui/hudLarge.js` (U45) and `ui/hudActiveSpells.js` (U46) ship. STILL OUT: `HUDPlaceMarker`, the escorting-NPC faces and the quest debugger |
| Classic-save import (`API/Save/*`) | 3,200 | SaveTree, SaveVars, SaveGames, CharacterRecord + 7 typed records - STANDS, nothing in `src/formats/` reads either file |
| Lycanthropy / vampirism / artifact effects | 2,527 | ~~the temple cure-disease count already owes this number~~ NARROWED - V1 2026-08-24 shipped the INFECTION half whole (`systems/infection.js`: both infections, the producer and the tick). STILL OUT: the curse itself, the racial override spine, and the Daedric artifact payloads (which ride the enchantment runtime) |
| Spell maker (+ effect settings editor, icon picker) | 2,390 | NARROWED - the spell maker shipped at S1 over the effect template registry (`systems/spellEffects.js` + `ui/spellMakerWindow.js`). STILL OUT: the effect settings editor's remaining panels, the spell ICON picker (`spellbookWindow.js:89` flags it) and the colour picker |
| ~~Banking (loans, deposits, houses, ships)~~ | 1,707 | SHIPPED B1/B2 2026-08-24 + H1-H3/S41 2026-08-25: `systems/banking.js`, `ui/bankWindow.js`, `ui/bankPurchaseWindow.js` - all four of loans, deposits, houses and ships |
| ~~Item maker / enchanting UI~~ | 1,320 | SHIPPED M4 2026-08-24: `ui/itemMakerWindow.js` + `systems/enchantmentCatalogue.js` |
| Save/load game windows | 937 | STANDS - one quicksave key, no indexed slots, and the pause window's Save/Load open onto it |
| Rappel / hanging / head-bob motors | 857 | STANDS - the rappel/hanging handoffs are RESIDUE behind the AdvancedClimbing gate (`player/climbing.js:4`), and `HeadBobber` exists in `src/` only as the pause window's stored setting |
| ~~Potion maker~~ | 408 | SHIPPED M2 2026-08-24: `ui/potionMakerWindow.js` over the twenty recipes |

One architectural note that changes the arithmetic: DFU carries a
16,404-loc retained widget toolkit (`Game/UserInterface`) under 37,693 loc
of windows. The port draws immediate-mode onto a virtual 320x200 surface
(`ui/nativePanel.js`), so each remaining window is far cheaper than its C#
line count - but there is no `ListBox`, `HorizontalSlider`, `MultiTextBox`
or `Paginator` to reuse either, which is why every window has cost a whole
slice. Whether to build a small widget layer before the remaining ~20
windows is the single highest-leverage decision left in the UI arc.

## Subsystem findings (SWEPT, UNREFUTED - claims, not verdicts)

118 gaps across five subsystems, ~13,700 JS loc estimated.

### Formats / readers - ~2,835 loc
The most finished layer in the port. No structural decode gap in any
reader that touches a shipping ARENA2 file. What remains:
- The entire classic-save reading stack is absent (SaveTree ~900, SaveVars
  ~300, SaveGames ~280). Read-only - the port has its own save format -
  but it is the foundation of "Load Classic Save".
- ~~Three readers missing: `PaintFile` (PAINT.DAT, ~90 - paintings currently
  print raw `%sub`/`%adj` macros on screen), `CfaFile` (~70 - horse/cart FP
  sprites), `BssFile` (~50 - large-HUD compass strips).~~ ONE LEFT: `CfaFile`.
  `formats/paintFile.js` ships (AUDIT 26 F208) and `systems/itemInfo.js:352-353`
  fills the `%sub`/`%adj` tokens from it; `formats/bssFile.js` ships and
  `ui/hudLarge.js` reads the compass strips (U45). Whatever `CfaFile` adds to
  the fetch list lands under the ingest-diet rule in `scenes/dataSource.js`,
  which AUDIT 18 F2's pin re-derives from the source on every run.
- Five SHIPPED readers sit outside the differential parity harness
  (FlatsFile, BookFile, VidFile, FlcFile, RumorFile), and
  `tools/parity/README.md` still describes them as having no port
  counterpart. FLATS.CFG is the sharp case - it is on the production path
  for every NPC caption and portrait.
- `DFValidator` has no counterpart, so an incomplete ARENA2 pick fails
  later with an opaque fetch error and no route back to the picker.

### World / terrain / location - ~4,905 loc
Static assembly is finished and verbatim. The gaps are dynamic:
- ~~No dynamic weather at all: no `WeatherTable`, no poll loop, no
  per-climate array, no save (~350).~~ SHIPPED W1: `systems/weatherSim.js`
  is the per-climate per-season roll, the six-zone array re-rolled on every
  game-date change, the respawn re-roll and the one persisted value; S41
  gave the day change the home that drives it.
- The season never advances from the calendar - climate and nature swaps
  are frozen at a URL parameter (~150).
- No `PlayerTileMapIndex`, so exterior swimming, water-walking, path
  footsteps and the water fall-damage exemption do not exist (~120).
- NARROWED: the respawn primitive shipped at B3 - `respawnPlayerAtSite`
  (`scenes/world.js:2397`), consumed by the quest machine's TeleportPc arm,
  with the Building site arm still FLAGGED there.
  `PositionPlayerToLocation` / `PositionPlayerToDungeonExit` /
  `RepositionPlayer` still have no counterpart by name.
- `DilateCoastalClimate` never runs - every ocean-adjacent pixel keeps
  climate 223 (~60).
- ~~Neither automap (~3,200 of the total above).~~ Both shipped, A1/A2.
- Long tail: editor markers (archive 199) unidentified and wrongly
  rendered, city gates never close at night, smaller-dungeon generation,
  `AddSpawnPoints`, per-record interior light intensity/colour,
  `NewLocationAlert`, bulletin boards, `SmoothLocationNeighbourhood`.

### Player motors / input - ~3,472 loc
Motor core is close to 1:1. Everything around it is thin:
- ~~**No input layer**: no keybinding registry, no Actions model, no
  rebinding, no gamepad (~700 + ~200). This blocks the settings screen's
  controls section and the main-menu hotkeys already on the Ledger.~~
  NARROWED: I1/I2/I4 shipped the registry, the Actions model and the
  rebinding grid, and both blocked rows landed on them. No gamepad layer,
  and no key combos.
- ~~Exterior buildings are never locked - no open hours, no
  `BuildingIsUnlocked`, no lock value, no steal-mode lockpicking,~~ no
  bashing (~300). NARROWED: R1 shipped `systems/buildingLocks.js` -
  `OPEN_HOURS`/`CLOSE_HOURS` per building type, `buildingIsUnlocked`,
  `buildingLockValue` off quality - with the exterior lockpick attempt and
  its anti-grind record beside it. The BASH arms on an exterior door are
  still FLAGGED (`worldModes.js:2229`).
- The four interaction modes reach only mobile townsfolk in the exterior
  hosts; entering a building never discovers it; Info mode on a building
  has no port (~330).
- `HeadBobber` absent (~170). Levitation inert above ground. Paralysis
  does not stop the player outside the dungeon host.
- `IsPlayerInSunlight` / `InDarkness` / `InHolyPlace` / `InsideOpenShop` /
  `Tavern` / `Residence` are never computed (~100) - several unported
  effects depend on these.
- Arrival and greeting text: "You are entering %s", dungeon flavour,
  rented-room reminders, shop-quality greetings (~220).

### Entities / FormulaHelper / combat - ~1,262 loc
The most complete subsystem measured. Residue only, but some of it bites:
- `CalculateProficiencyModifiers` is never applied - expert weapon
  proficiency gives no to-hit or damage (~25).
- ~~Item repair is entirely absent (cost, time, the flow) - degraded
  equipment can never be fixed (~240).~~ SHIPPED: `systems/repairService.js`
  is CalculateItemRepairCost and CalculateItemRepairTime with the shop
  flow, reached through the trade window's Repair mode (U40).
- ~~No lockpick ATTEMPT path, so the Lockpicking skill has no consumer and
  can never advance (~110).~~ SHIPPED R1: `world/actionSystem.js`'s
  `attemptLockpicking` is DaggerfallActionDoor.AttemptLockpicking verbatim,
  including the tally BEFORE the roll and the same-skill retry gate, and
  both chance formulas sit with it.
- `PassiveSpecialsEffect` unported: career Regeneration, Sun Damage, Holy
  Damage and Light/Darkness-Powered Magery are all inert (~150).
- Enemy infighting damage (`ApplyDamageToNonPlayer`) unported (~200).
- NARROWED: the enchantment modifier channels are live - E1 folds
  `chanceToHitMod` and `enchantArmorMod` into the to-hit ladder
  (`combat/formulas.js`). `MaxHealthLimiter` still has no port.
- ~~Shield-spell mitigation has no hook in the damage door (~30).~~
  SHIPPED X1: the shield pool absorbs first at
  `characters/playerEntity.js:82-86`, overflow passing through.

### Enemy AI / spawning / population - ~1,245 loc
Also close to 1:1 on the classic path. Gaps:
- Every enemy uses one fixed 1.8m capsule; DFU sizes each foe's controller
  from its sprite (~60).
- No multi-target AI: `GetTargets`, `MobileTeams`, infighting, PlayerAlly
  and quest-foe targeting are all absent (~350).
- Daedra Seducer transformation entirely unported (~140).
- `HeightAdjust` unported - tall enemies cannot follow through doorways
  (~35).
- ~~Interior people are always visible (the AddPeople ownership / shop-hours
  / guild-access gates - already a Ledger C row) (~55).~~ SHIPPED P1
  2026-08-25: `characters/interiorPeople.js`'s `peopleAreVisible` is
  AddPeople's tail whole, and the Ledger row is struck.
- Mobile townspeople get no face record, so every talk portrait falls back
  to record 0 (~35).
- Dungeon static NPC flats get no StaticNPC identity - no talk target, no
  individual-questor hook (~40).

## NOT YET SWEPT (sized from source LOC only)

Magic and effects; quest machine action-by-action; talk manager and the
macro table; items/inventory/loot/shops/banking; guilds, crime and
factions; UI windows and HUD; save/serialization; audio and video;
rendering data/decision logic; chargen and progression; calendar, travel,
rest and world simulation. The three verified counts at the top of this
page (21 pended quest actions, 134 missing macros, 34 missing effect
classes) come from that unswept half and are the best evidence available
for it.

## Rough shape of the remaining work

Extrapolating the five swept subsystems' ~0.06 JS-loc-per-in-scope-C#-loc
residue rate over the cited half, and adding the never-touched table at
its own measured sizes:

- Residue across already-ported subsystems: **~25,000-30,000 JS loc**
- New subsystems never started: **~18,000-22,000 JS loc**
- **Total order of magnitude: 45,000-55,000 JS loc**, against 88,640 today.

That reads as roughly two thirds through by volume - but volume is the
wrong axis for the last third. The residue is spread over hundreds of
sites that each need the same read-the-C#-and-refute discipline the audits
use, and the audits' own record is that a slice's verify pass reliably
finds more than the slice did.

## Sequencing, if it were mine to order

**RE-CHECKED 2026-08-26: six of the seven have since been taken, and in
close to this order.** 1 shipped at I1/I2/I4, 2 at E1/E2 (+ M4 for the item
maker it gated), 3 at W1/S41 apart from the season clock, 4 at R1 and the
repair service, 5 at A1/A2, 6 at S1/M2/M4/U42 - and the widget-layer
decision was never taken: each window was built on the immediate-mode
idiom directly. Of 7, banking shipped at B1-H3 and the infection half of
vampirism/lycanthropy at V1; the classic-save import is untouched. The
order is left standing as written because the reasoning, not the queue, is
what this section is for.

1. **The input layer** - a keybinding registry unblocks the settings
   controls section, the main-menu hotkeys, and every "DFU binds this to a
   rebindable action" row already on the Ledger. Nothing else depends on
   as many downstream rows for as little code.
2. **Enchanting effects + the enchantment modifier channels** - these
   close the zero-until-enchantments sites already flagged in
   `formulas.js`, and they gate the item maker, artifacts, soul bound and
   a chunk of the item-info macros. The single largest unblocking move.
3. **Dynamic weather + the season clock** - small, self-contained, and it
   makes the climate/nature swap machinery that already ships actually
   live.
4. **Item repair + the lockpick attempt** - two skills currently cannot
   advance at all.
5. **The automaps** - large, self-contained, no dependencies, and the
   most-missed player-facing feature left.
6. **The maker windows** (spell/item/potion) - after 2, and after the
   widget-layer decision.
7. **Banking, vampirism/lycanthropy, classic-save import** - three
   independent new subsystems, orderable by taste.

## What 1:1 cannot be claimed without

The verification story is strong where it exists and has holes worth
naming:

- Five shipped readers are outside the differential parity harness, and
  its README misdescribes them as unported.
- There is no macro coverage gate. A table-from-source gate in the shape
  of AUDIT 24's regeneration gate would name all 134 missing macros
  mechanically instead of by sweep.
- There is no quest-action coverage gate. The 21 pended actions are
  discoverable only by reading `defaultActionTemplates()`.
- The 180 ARENA2-gated skips mean the corpus half of the suite does not
  run in CI at all; `deploy.yml` gates on `npm run check` with no game
  data present.
- AUDIT 24's two standing lessons - "a pin that restates the port instead
  of the source is not a pin", and "a ported function with no caller is a
  comment" - both argue for a seam gate that runs against the SOURCE tree,
  not against the port's own exports.

## Reproducing this

The DFU tree was a sparse clone of `Assets/Scripts` + `Assets/Game` at
`81e89e90`. The coverage classification is one pass over every in-scope
`.cs`: SRC_CITED if a `src/*.js` names the file, DOC_ONLY if only `bible/`
or `tools/` names the class, NONE otherwise. Quest-action, macro and
effect counts are set differences against the source tree, and are the
three numbers on this page worth re-running as gates.
