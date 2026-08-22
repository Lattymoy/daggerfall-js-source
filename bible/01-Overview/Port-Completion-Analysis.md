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

**Quest actions: 61 of 82 implemented.** The other 21 are `PendingTrigger`
guards (`systems/quest/actions.js:2604+`) - the line matches its verbatim
pattern and PENDS, exactly as DFU sends an unregistered line, and nothing
runs: `CastEffectDo`, `ChangeFoeInfighting`, `ChangeFoeTeam`, `ClickedFoe`,
`Climate`, `Enemies`, `JournalNote`, `KillFoe`, `PayMoney`, `PlaySong`,
`PromptMulti`, `RunQuest`, `Season`, `SetPlayerCrime`, `SpawnCityGuards`,
`TrainPc`, `UnrestrainFoe`, `Weather`, `WhenAttributeLevel`,
`WhenSkillLevel`, `WorldUpdate`.

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
| Interior automap (`Automap.cs` + window) | 5,091 | pure new build; needs a dungeon-geometry discovery model |
| Controls / keybinding / joystick + `InputManager` | 4,110 | the port has no keybinding registry at all (Ledger A already records the main-menu hotkey gap as a consequence) |
| Exterior automap | 3,582 | |
| Enchanting effect tree | 3,498 | gates every enchanted item, artifact and the item maker |
| HUD component set | 3,272 | `HUDLarge`, `HUDActiveSpells`, `HUDPlaceMarker`, escorting-NPC faces, quest debugger |
| Classic-save import (`API/Save/*`) | 3,200 | SaveTree, SaveVars, SaveGames, CharacterRecord + 7 typed records |
| Lycanthropy / vampirism / artifact effects | 2,527 | the temple cure-disease count already owes this number |
| Spell maker (+ effect settings editor, icon picker) | 2,390 | |
| Banking (loans, deposits, houses, ships) | 1,707 | |
| Item maker / enchanting UI | 1,320 | |
| Save/load game windows | 937 | |
| Rappel / hanging / head-bob motors | 857 | |
| Potion maker | 408 | |

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
- No dynamic weather at all: no `WeatherTable`, no poll loop, no
  per-climate array, no save (~350).
- The season never advances from the calendar - climate and nature swaps
  are frozen at a URL parameter (~150).
- No `PlayerTileMapIndex`, so exterior swimming, water-walking, path
  footsteps and the water fall-damage exemption do not exist (~120).
- No `PositionPlayerToLocation` / `PositionPlayerToDungeonExit` /
  `RepositionPlayer` (~200).
- `DilateCoastalClimate` never runs - every ocean-adjacent pixel keeps
  climate 223 (~60).
- Neither automap (~3,200 of the total above).
- Long tail: editor markers (archive 199) unidentified and wrongly
  rendered, city gates never close at night, smaller-dungeon generation,
  `AddSpawnPoints`, per-record interior light intensity/colour,
  `NewLocationAlert`, bulletin boards, `SmoothLocationNeighbourhood`.

### Player motors / input - ~3,472 loc
Motor core is close to 1:1. Everything around it is thin:
- **No input layer**: no keybinding registry, no Actions model, no
  rebinding, no gamepad (~700 + ~200). This blocks the settings screen's
  controls section and the main-menu hotkeys already on the Ledger.
- Exterior buildings are never locked - no open hours, no
  `BuildingIsUnlocked`, no lock value, no steal-mode lockpicking, no
  bashing (~300).
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
- Item repair is entirely absent (cost, time, the flow) - degraded
  equipment can never be fixed (~240).
- No lockpick ATTEMPT path, so the Lockpicking skill has no consumer and
  can never advance (~110).
- `PassiveSpecialsEffect` unported: career Regeneration, Sun Damage, Holy
  Damage and Light/Darkness-Powered Magery are all inert (~150).
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
- Daedra Seducer transformation entirely unported (~140).
- `HeightAdjust` unported - tall enemies cannot follow through doorways
  (~35).
- Interior people are always visible (the AddPeople ownership / shop-hours
  / guild-access gates - already a Ledger C row) (~55).
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
