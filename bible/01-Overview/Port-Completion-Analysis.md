# Port Completion Analysis - what a full 1:1 port of DFU still needs

Snapshot taken 2026-08-22 against Daggerfall Unity `81e89e90` (master,
2026-06-30), by cross-referencing the whole DFU C# tree against `src/`.

**RE-VERIFIED 2026-08-27** - a mechanical pass over every claim below
against that day's tree (suite 3761/0, src 127,925 loc / 404 files,
tests 94,415 loc / 387 files). The five days between the snapshot and
the re-verification closed MOST of this page: every row struck below
names the slice that shipped it, and the three verified counts are
re-run (quest actions 78 of 82 with 4 pended since MT-iii; macros 93 of 216
present, 123 missing; effect classes EFFECTIVELY COMPLETE - the 33
.cs files unnamed in src are the per-attribute
Drain/Fortify/Heal/Transfer family this page already records as
generically covered, their three base classes, and two cosmetic
filename misses for classes that shipped - RingOfNamiraEffect is V3's
Namira reflection, VampiricFortifyEffect rides the vampirism round).
The HONEST still-open list as of the re-verification:

1. **Classic-save import** (SaveTree/SaveVars/SaveGames/
   CharacterRecord, ~3,200 C# loc) - absent, unchanged.
2. **Multi-slot save/load windows** - the pause menu rides the
   quicksave; DFU's slot UI has no counterpart.
3. ~~The 123 missing macros~~ **THE TABLE IS COMPLETE (M-X
   2026-08-27)**: every MacroHelper.cs row is now handled in
   questMacros.js, null-handled where C# is null, or RECORDED at the
   per-window expander that owns it (37 tokens, each verified in its
   named home) - and `test/macrocoverage.test.js` is the coverage
   GATE this page asked for, diffing the C# table mechanically. What
   remains is per-MCP SOURCES: the biography MCP (the %q block's
   answers), the spell-info MCP (%1am..%clm/%mpw), the bank MCP
   (%ml/%r1-5) - each its arc's, reached through the error ladder
   until then.
4. ~~The 20 pended quest actions~~ ~~SIX~~ **FOUR pended quest
   actions (Q5 + MT-iii, 2026-08-27)**: fourteen guards retired in one slice (the skill/
   attribute/season/weather/climate conditions, SetPlayerCrime,
   PayMoney, JournalNote, TrainPc, KillFoe, UnrestrainFoe, RunQuest,
   SpawnCityGuards, Enemies - pinned in test/questactions5.test.js,
   including DFU's own RestrainFoe-shadows-UnrestrainFoe parse
   quirk). The four left each name their blocker in GUARD_PATTERNS:
   CastEffectDo (effect-template registry lookup by key), WorldUpdate
   (world-variant system), ClickedFoe (no foe-click door),
   PromptMulti (multi-button prompt window). ~~ChangeFoeInfighting +
   ChangeFoeTeam~~ SHIPPED with MT-iii the same day, so the guard
   list is FOUR.
5. ~~Enemy infighting / MobileTeams combat / PlayerAlly~~ **SHIPPED
   ABOVE GROUND (MT 2026-08-27); the DUNGEON host is the remainder.**
   `characters/enemyTargets.js` is EnemySenses' selection half whole
   (MOBILE_TEAMS, GetTargets, the classic target machine) and
   `hostCombat.applyDamageToNonPlayer` is EnemyAttack.cs:303-392,
   which had no port because until this slice no foe could hold a foe
   as its target. Both exterior pools are armed off ONE shared
   candidate list, so a spawned monster and a city watchman fight each
   other. The V3 allied-summon door this row named is MOUNTED, and
   both summons gained the `Team != PlayerAlly` scan filter they were
   missing. ~~WHAT REMAINS is MT-iv~~ **MT-iv SHIPPED the same day**:
   the dungeon host is armed too (its target machine rides the LAZY
   foe-subsystem import, so a foe-less dungeon still pays nothing),
   with MeleeDamage's and BowDamage's two-arm splits, the enemy
   missile locking its victim at fire time, a stale-candidate sweep
   for DESTROYED foes whose health never reaches zero, and
   ChangeFoeTeam's reach underground through
   `worldModes.liveQuestFoes()`. This row is CLOSED.
6. ~~The interior foe pool~~ **SHIPPED (IF 2026-08-27).** The deciding
   fact came first: a building interior carries NO STATIC ENEMIES in
   DFU (DaggerfallInterior's whole marker vocabulary is Rest/Enter/
   Treasure/LadderBottom/LadderTop), so the pool is not a spawner but
   a HOME - which is what made it small. The interior host mounts the
   SAME pool factory the exterior does, with its own collider, and
   that factory grew the teardown a per-building lifetime needs.
   FIVE flag sentences retired: CreateFoe's interior arm (which is
   PlaceFoeFreely, by DFU's own choice over spawn points), the Q4-v
   adapter's `standFoe` (DFU's OTHER quest-foe path - marker
   placement at interior layout time), `enemiesNearby` at three
   consumers, and BOTH daedric punishments - the summoning refusal's
   and the coven failure's, which are one CreateFoeSpawner call with
   different numbers. (The count read FOUR for one commit: a scout
   sweep landing after it found the fifth, whose wording had survived
   the grep. Corrected rather than left standing.) This row is
   CLOSED.
7. **CfaFile** (horse/cart FP sprites), **HeadBobber** (a settings
   toggle exists, no bobber), **DilateCoastalClimate**, city gates
   closing at night, HUDActiveSpells + escorting faces, the
   transformed move-sound loop - the small-residue tail.

Everything else this page lists as missing was verified SHIPPED and
is struck in place below.

**READ THIS FIRST - THE STATUS OF THIS PAGE.** Five of sixteen planned
subsystem sweeps completed before the run was stopped, and NONE of the
findings on this page went through the two-refuter discipline AUDIT 24
used. Under the Ledger's own rule - a stale "not yet ported" row is worse
than a missing one - every row below is a CLAIM, not a verdict. The
mechanical measurements in "The numbers" are reproducible and safe; the
subsystem gap lists are analyst output at one lens and want refuting
before any slice is opened on them. The eleven subsystems marked NOT YET
SWEPT are sized from source LOC only.

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

**Quest actions: ~~61~~ ~~62~~ ~~76~~ 78 of 82 implemented.** The
other ~~21~~ ~~20~~ ~~6~~ FOUR are `PendingTrigger` guards
(`systems/quest/actions.js`) - the line matches its verbatim pattern
and PENDS, exactly as DFU sends an unregistered line, and nothing
runs: `CastEffectDo`, `ClickedFoe`, `PromptMulti`, `WorldUpdate` -
each guard now carries its blocker in a comment. **PlaySong SHIPPED 2026-08-25** - a real
template over `systems/songFiles.js` (SongFiles.cs + EnumToFilename
in the archive's spelling); its Ledger row is struck. **FOURTEEN MORE
SHIPPED 2026-08-27 (Q5)**: ~~`Climate`~~, ~~`Enemies`~~,
~~`JournalNote`~~, ~~`KillFoe`~~, ~~`PayMoney`~~, ~~`RunQuest`~~,
~~`Season`~~, ~~`SetPlayerCrime`~~, ~~`SpawnCityGuards`~~,
~~`TrainPc`~~, ~~`UnrestrainFoe`~~, ~~`Weather`~~,
~~`WhenAttributeLevel`~~, ~~`WhenSkillLevel`~~ - real templates with
host doors through world.js (Quest-Arc's Q5 record;
test/questactions5.test.js). **TWO MORE SHIPPED 2026-08-27 (MT-iii)**:
~~`ChangeFoeInfighting`~~ and ~~`ChangeFoeTeam`~~, which item 5's
MobileTeams slice unblocked the same day - both writing every live
instance of a foe symbol through the new `questFoeInstances` door
(Characters-Arc's MT record; test/enemyinfighting.test.js).

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

## Never touched at all - sized from the C#

| Subsystem | DFU loc | Notes |
|---|---|---|
| ~~Interior automap~~ SHIPPED (A-slices: systems/automap.js + ui/automapWindow.js) | 5,091 | struck 2026-08-27 |
| ~~Controls / keybinding + InputManager~~ SHIPPED (SETT: ui/input.js + ui/controlsWindow.js + systems/settings.js; gamepad still absent) | 4,110 | struck 2026-08-27 |
| ~~Exterior automap~~ SHIPPED (ui/exteriorAutomapWindow.js) | 3,582 | struck 2026-08-27 |
| ~~Enchanting effect tree~~ SHIPPED (E1/E2 2026-08-23 + V3's nine artifacts 2026-08-27) | 3,498 | struck 2026-08-27 |
| ~~HUD component set~~ MOSTLY SHIPPED (ui/hudLarge.js with compass/vitals/head incl. V5's curse heads; HUDActiveSpells, place marker, escorting faces still absent) | 3,272 | narrowed 2026-08-27 |
| Classic-save import (`API/Save/*`) | 3,200 | SaveTree, SaveVars, SaveGames, CharacterRecord + 7 typed records |
| ~~Lycanthropy / vampirism / artifact effects~~ SHIPPED WHOLE (V1-V5 + V3, 2026-08-24..27) | 2,527 | struck 2026-08-27 |
| ~~Spell maker~~ SHIPPED (systems/spellMaker.js + ui/spellMakerWindow.js) | 2,390 | struck 2026-08-27 |
| ~~Banking~~ SHIPPED (systems/banking.js + the H-slices through H4's 3D preview) | 1,707 | struck 2026-08-27 |
| ~~Item maker / enchanting UI~~ SHIPPED (ui/itemMakerWindow.js) | 1,320 | struck 2026-08-27 |
| Save/load game windows | 937 | STILL OPEN (re-verified 2026-08-27) - the pause menu rides the quicksave; no slot UI |
| ~~Rappel / hanging~~ SHIPPED (player/climbing.js + motor.js); HeadBobber still absent (a settings toggle only) | 857 | narrowed 2026-08-27 |
| ~~Potion maker~~ SHIPPED (ui/potionMakerWindow.js) | 408 | struck 2026-08-27 |

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
- Three readers missing: `PaintFile` (PAINT.DAT, ~90 - paintings currently
  print raw `%sub`/`%adj` macros on screen), `CfaFile` (~70 - horse/cart FP
  sprites), `BssFile` (~50 - large-HUD compass strips). All three also need
  an ingest-diet arm in `scenes/dataSource.js:74-80`.
- Five SHIPPED readers sit outside the differential parity harness
  (FlatsFile, BookFile, VidFile, FlcFile, RumorFile), and
  `tools/parity/README.md` still describes them as having no port
  counterpart. FLATS.CFG is the sharp case - it is on the production path
  for every NPC caption and portrait.
- `DFValidator` has no counterpart, so an incomplete ARENA2 pick fails
  later with an opaque fetch error and no route back to the picker.

### World / terrain / location - ~4,905 loc
Static assembly is finished and verbatim. The gaps are dynamic:
- ~~No dynamic weather at all~~ SHIPPED (S41: systems/weatherSim.js -
  the climate arrays, the day roll, the save).
- ~~The season never advances~~ SHIPPED (S41's day block advances it;
  the sky and the enchant ctx read it live).
- ~~No `PlayerTileMapIndex`~~ SHIPPED (world.js/dungeonContext read
  it; exterior swimming and the water arms ride it).
- ~~No `PositionPlayerTo*`~~ SHIPPED (worldModes'
  dungeonEntranceLanding is PositionPlayerToDungeonExit verbatim; the
  travel/cemetery arrivals are the location half).
- `DilateCoastalClimate` never runs - every ocean-adjacent pixel keeps
  climate 223 (~60).
- ~~Neither automap~~ SHIPPED (both - see the struck table rows).
- Long tail: editor markers (archive 199) unidentified and wrongly
  rendered, city gates never close at night, smaller-dungeon generation,
  `AddSpawnPoints`, per-record interior light intensity/colour,
  `NewLocationAlert`, bulletin boards, `SmoothLocationNeighbourhood`.

### Player motors / input - ~3,472 loc
Motor core is close to 1:1. Everything around it is thin:
- ~~No input layer~~ SHIPPED (SETT: ui/input.js's registry +
  controlsWindow's rebinding); gamepad still absent.
- ~~Exterior buildings are never locked~~ SHIPPED
  (systems/buildingLocks.js: open hours, BuildingIsUnlocked, the lock
  value, R1's lockpicking and the bash).
- The four interaction modes reach only mobile townsfolk in the exterior
  hosts; entering a building never discovers it; Info mode on a building
  has no port (~330).
- `HeadBobber` absent (~170). Levitation inert above ground. Paralysis
  does not stop the player outside the dungeon host.
- ~~`IsPlayerInSunlight` / `InDarkness` / `InHolyPlace` never computed~~
  SHIPPED (V2c: the passiveSpecials host seam, registered by worldModes
  and dungeonContext). `InsideOpenShop` / `Tavern` / `Residence` still
  uncomputed (~40).
- Arrival and greeting text: "You are entering %s", dungeon flavour,
  rented-room reminders, shop-quality greetings (~220).

### Entities / FormulaHelper / combat - ~1,262 loc
The most complete subsystem measured. Residue only, but some of it bites:
- ~~`CalculateProficiencyModifiers` is never applied~~ SHIPPED
  (combat/formulas.js carries it).
- ~~Item repair is entirely absent~~ SHIPPED
  (systems/repairService.js).
- ~~No lockpick ATTEMPT path~~ SHIPPED (R1: AttemptLockpicking in
  the action system, the skill advances).
- ~~`PassiveSpecialsEffect` unported~~ SHIPPED (V2c:
  systems/passiveSpecials.js - regen, sun/holy damage, both mageries).
- Enemy infighting damage (`ApplyDamageToNonPlayer`) unported (~200).
- The enchantment modifier channels (`ChanceToHitModifier`,
  armour-value modifiers, `MaxHealthLimiter`...) are the already-flagged
  zero-until-enchantments sites (~70).
- Shield-spell mitigation has no hook in the damage door (~30).

### Enemy AI / spawning / population - ~1,245 loc
Also close to 1:1 on the classic path. Gaps:
- Every enemy uses one fixed 1.8m capsule; DFU sizes each foe's controller
  from its sprite (~60).
- No multi-target AI: `GetTargets`, `MobileTeams`, infighting, PlayerAlly
  and quest-foe targeting are all absent (~350).
- ~~Daedra Seducer transformation unported~~ SHIPPED
  (characters/enemyAttack.js + enemyBasics carry it).
- `HeightAdjust` unported - tall enemies cannot follow through doorways
  (~35).
- ~~Interior people are always visible~~ SHIPPED
  (characters/interiorPeople.js gates on hours/ownership).
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

**(RE-VERIFIED 2026-08-27: items 1, 2, 3, 4 and 5 have ALL since
shipped - the input layer at SETT, enchanting at E1/E2/V3, weather at
S41, repair + lockpicking at their own slices, both automaps at the
A-slices; item 6's maker windows all exist; item 7's banking and the
curses shipped whole, leaving classic-save import the one survivor.
The list below is kept as the record of what the snapshot saw.)**

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
