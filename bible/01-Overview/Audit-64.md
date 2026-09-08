# AUDIT 64 - SUBSYSTEM DEPTH, ROUND TWO, 2026-09-08

The question: AUDIT 63 read ten classic systems whole against their DFU
counterparts and found fifty defects, most of them whole members nobody
had ported. Its own lesson said alternate - shape, then depth - and the
depth had covered only half the port's classic surface. This audit
opened the other ten: the player motor, world time and weather, the
block and dungeon layout, travel, the bank and its houses and ships,
character creation, the HUD, audio, the inventory window whole, and the
two automaps.

**Ten subsystem lenses, 63 findings judged by two Opus refuters each, 56
confirmed and 7 refuted. Nine fix lanes in isolated worktrees - grouped
by the FILES they touch, the AUDIT 63 lesson - each followed by its own
adversarial reviewer and a fixup round.**

## Why the audit took this shape

The same shape as AUDIT 63, over the systems it did not reach: each lens
takes ONE subsystem and its ONE C# counterpart and reads both end to
end - every public member, every arm of every switch, every table
value. The lenses were chosen to complete the map: with these ten, every
classic system the port ships has been opened whole against DFU at least
once since the campaign closed.

| # | Lens | What it read | Judged | Confirmed |
|---|---|---|---|---|
| 1 | player-motor | `player/*.js` against `PlayerMotor.cs`, `ClimbingMotor.cs`, `LevitateMotor.cs`, `PlayerHeightChanger.cs`, `PlayerSpeedChanger.cs`, `AcrobatMotor.cs`, `PlayerFootsteps.cs`, `PlayerEnterExit.cs` | 8 | 8 |
| 2 | world-time-weather | the clock, the weather and the climate reads against `WorldTime.cs`, `DaggerfallDateTime.cs`, `WeatherManager.cs`, `PlayerGPS.cs` | 4 | 3 |
| 3 | layout | the RMB/RDB/interior builders against `RMBLayout.cs`, `RDBLayout.cs`, `DaggerfallInterior.cs`, `BuildingDirectory.cs` | 10 | 7 |
| 4 | travel | the travel map and the fast-travel arrival against `DaggerfallTravelMapWindow.cs`, `TravelTimeCalculator.cs`, the arrival in `StreamingWorld`/`PlayerEnterExit` | 7 | 7 |
| 5 | bank-houses-ships | the bank window and manager against `DaggerfallBankManager.cs` and its windows | 5 | 4 |
| 6 | chargen | character creation against the twelve `CreateChar*` windows, `BiogFile.cs`, `AssignCareer` | 7 | 5 |
| 7 | hud | the HUD against `DaggerfallHUD.cs` and its elements | 6 | 6 |
| 8 | audio | the sound and song sites against `DaggerfallAudioSource.cs`, `SongManager.cs`, `AmbientEffectsPlayer.cs`, `EnemySounds.cs`, the UI clicks | 7 | 7 |
| 9 | inventory-window | `nativeInventory.js` whole against `DaggerfallInventoryWindow.cs` whole | 8 | 8 |
| 10 | automaps | the two automaps against `Automap.cs`, `ExteriorAutomap.cs` and their windows | 1 | 1 |

Every finding went to two adversarial verifiers prompted to REFUTE it
with the reference open; a finding survived only if both upheld it, and
each verifier's corrections travelled into the lane brief. 136 agents,
13 million tokens of reading, four hours wall-clock at two agents
abreast.

## What was refuted, and why

- **The vampire's cemetery transfer skips the respawner's weather laws**
  (world-time-weather) - the fortnight raise that precedes the transfer
  crosses fourteen day boundaries and drains the day-change flag, whose
  weather re-roll supersedes the respawner's on this path; the sky the
  vampire wakes to is already the cemetery's.
- **`AmbientLitInteriors` is stored and never read** (layout) - a
  recorded Ledger A row; the classic path (the setting off) is
  bit-identical to DFU.
- **Interior editor markers are stored at the billboard base** (layout)
  - the C# raises the marker by half the billboard's height and then
  assigns it to a CharacterController whose transform is its centre;
  the port's frame keeps markers at the feet and assigns them to a
  feet-based motor. The same point, in two conventions, and documented.
- **Doors on prop RMB models lose their record index** (layout) - the
  literal difference is real, but DFU's Building arm never reads the
  door's record index for the lock or the identity; the proposed fix
  would have created the divergence it claimed to close.
- **`goldPieceWeightInKg` is a restated constant** (bank) - DFU caches
  the Currency template's weight once per run and spells the same
  0.0025 as a literal beside it; unobservable.
- **The chargen confirm boxes play a click on the Yes arm DFU leaves
  silent** (chargen) - `DaggerfallMessageBox.AddButton` wires its own
  `ButtonKeyboardEvent` onto every button, which plays the click on the
  key-down edge; the port's sites are the keyboard arm.
- **The stats and skills screens bypass the flow's `bonusPointsRows`
  seam** (chargen) - the seam's only injector is the enhanced skin, and
  under it the two paths cannot differ.

## What was broken

Fifty-six findings, nine lanes. Each lane's reviewer then read the
lane's own diff adversarially, and a fixup round took what survived.

### The player motor (8 confirmed, 8 fixed)

- **Exterior swim speed** - `UpdateSpeed`'s third statement
  (`PlayerMotor.cs:383-389`, the swim-skill speed over the input-adjusted
  one) had no arm: a sunk player outdoors walked at land speed. The
  indoor half of the same law - `PlayerMotor.cs:367` recomputes the
  exterior-water method every frame and answers None inside - is now
  written by the interior and dungeon hosts.
- **Exterior-water jump cancel** - the second of `AcrobatMotor.cs:64-70`'s
  four clauses (`OnExteriorWater == Swimming`) was missing beside the
  slowfall and Cart terms.
- **Enhanced-jump air control** - `AcrobatMotor.cs:130-151`'s
  IsEnhancedJumping disjunct: the airborne velocity is recomputed from
  live input when the entity carries the enhancement; the port fell to the
  frozen-launch arm.
- **AutoRun's forward force** - `InputManager.cs:542-545` applies a
  vertical force of one under the toggle before the key scan, so the latch
  alone drives, autorun with MoveBackwards reverses, and opposing keys
  keep the force. Ported in both the acceleration and no-acceleration arms.
- **The dungeon shallow-water threshold** read a baked centre height of
  0.9; `PlayerFootsteps.cs:189/:201` read the live controller centre, which
  the crouch moves.
- **CanStand** compared a penetration depth; `PlayerHeightChanger.cs:525-531`
  sphere-casts upward from the live centre over the crouch-to-stand
  distance, and stands when nothing is hit.
- **The paralysed swimmer** moved: `LevitateMotor.cs:67-69` returns above
  the input read and the one move call.
- **The Running tally gate** (`PlayerEntity.cs:311`, `IsRunning && !IsRiding`,
  no standing test) had been fused with the fatigue band's `IsRunning &&
  !IsStandingStill`; the tally now reads its own flag at all five hosts.

### World time and weather (3 confirmed, 3 fixed)

- **Window lights** switched on `IsNight`; `DaggerfallLocation.cs:142-145`
  switches on `IsCityLightsOn` (18:00-08:00, not the 18:00-06:00 night).
- **`windowStyleForWeather`** - a fog window style keyed on the weather
  that no DFU code path takes: the MaterialReader's fog rows are
  inspector data, reachable only through `?window=fog`, and the wiring is
  gone.
- **`ShowHolidayText`** (`PlayerEnterExit.cs:567-575`, the region's
  holiday message on the first exterior frame of the day, silent in
  dungeons and graveyards) had no port.

### Travel (7 confirmed, 7 fixed)

- **The fast-travel arrival had no reposition** - `performFastTravel`
  teleports with `DirectionFromStartMarker` (`DaggerfallTravelPopUp.cs:334`)
  and the port passed none, landing at the map pixel's centre, which for
  a city is inside its block grid. Main's TL3 had fixed the same defect
  with `RandomStartMarker` while the lane ran; the integration kept the
  lane's method (the edge landing tilted to the side the journey came
  from, `StreamingWorld.cs:1078-1083`'s cached departure) and main's
  Seasons mod event.
- **The guild teleport** landed at the same centre: `TeleportAway` names
  `RandomStartMarker` explicitly (`DaggerfallTeleportPopUp.cs:143`).
- **The arrival clamp** carried one of DFU's two arms - `HasVampirism() ||
  Career.DamageFromSunlight` (`DaggerfallTravelPopUp.cs:351`); the career
  bit was missing.
- **The travel map's door** carried one of its two rungs: the career
  sun-damage refusal (`DaggerfallUI.cs:614-621`) above the racial one.
- **A crime survived the journey** - `DaggerfallTravelPopUp_OnPostFastTravel`
  (`PlayerEntity.cs:2455-2459`) clears the crime state, a second clearer
  the location-rect exit never reaches across a teleport.
- **The travel map's L and F** were literal key codes, not the
  TravelMapList / TravelMapFind bindings with their modifiers.
- **The sunlight refusal sentence** was invented; the localized key reads
  "You cannot initiate fast travel during the day."

### Layout (7 confirmed, 7 fixed)

- **The StaticBuilding array** (`RMBLayout.cs:864-882`), `HasHit` and
  `ActivateBuilding` had no port: a building's activation went by the
  door's own record, never by the model's box.
- **Editor flats** (archive 199) were batched and drawn in every town.
- **RDB NPC flats** never became static NPCs: `RDBLayout.cs:1250-1254`'s
  archives, the raw un-negated position the hash reads
  (`StaticNPC.cs:149-151`) and the flat resource's stream position now
  ride every ordinary flat.
- **City gates never closed at night** - `DaggerfallCityGate` (open born
  true, toggled when `isNight` disagrees, models 446/447).
- **Interior enter markers** accepted ENTER only; `DaggerfallInterior.cs:242-246`
  also accepts REST ("a little forgiving").
- **Fixed treasure** (archive 216) was floor-landed; `AssignFixedTreasure`
  passes `adjustPosition:false`.
- **Interior ladders and furniture actions** were not gated on the
  object type (`DaggerfallInterior.cs:491-500`).

### The bank, the houses, the ships, the town map (4 + 1 confirmed, 5 fixed; the automap lens's one finding rode this lane)

- **The banking window's popup** skipped the macro pass
  (`DaggerfallBankingWindow.cs:311`, `SetTextTokens(result, this)` against
  the BankingMacroDataSource).
- **SellHouse** credited and cleared before the building resolved;
  `DaggerfallBankManager.cs:449-464` nests it all under the directory hit.
- **LoanChecker's reminder** went to the console in two hosts and carried
  no 3-second HUD delay.
- **The character sheet's gold button** had no CreateBankingStatusBox
  (`DaggerfallBankingWindow.cs:520-551`).
- **The exterior automap's view mode and background** reset on every
  open; they are fields of the persistent component (`ExteriorAutomap.cs:101`).

### Character creation (5 confirmed, 5 fixed)

- **The biography backstory** never ran `MacroHelper.ExpandMacros` over
  its record (`BiogFileMCP.cs:87-148`, the home province, the geographical
  feature, the names).
- **The biography reputation box** (TEXT.RSC 35 with `%r1..%r5` through
  `GetChangeStr`) was restated rather than expanded.
- **The derived labels' sign** printed "+0" where C#'s `"+0;-0;0"` picture
  prints "0" (`CreateCharAddBonusStats.cs:156-162`).
- **The confirm boxes' keyboard lanes** - the class-questions box's
  default button is No (`DaggerfallMessageBox.cs:630-632`), so a bare Return
  rejects.
- **The summary's stat pool** is the summary's own StatsRollout with
  `BonusPool = 0` on every push (`CreateCharSummary.cs:125`), not the stats
  screen's remainder.

### The HUD (6 confirmed, 6 fixed)

- **The mid-screen text label** - DaggerfallHUD's second text surface
  (`DaggerfallHUD.cs:32-33`, centred at y 146, 1.5 s) had no port; the
  interaction-mode and too-far messages went to the popup queue.
- **The classic HUD was painted under an open window**; `DaggerfallUI.cs:483-491`
  repaints it there only under the large HUD.
- **LargeHUDToggle (F10)** and **HUDToggle (Shift-F10)** had no consumer
  (`DaggerfallHUD.cs:308-318`), and `renderHUD` gates the whole Draw
  (`:347-351`).
- **The escort faces** were anchored to the letterboxed native panel; DFU
  parents them to the viewport-sized HUD panel.
- **The breath bar** did not round its drawn height (`VerticalProgress.cs:68-74`).
- **The large HUD's panels** did not click (`HUDLarge.cs:399-535`, the
  ButtonClick heads all thirteen handlers).

### Audio (7 confirmed, 7 fixed)

- **Dungeon damage traps** were silent: `DaggerfallAction.cs:739/:768` send
  RemoveHealth, whose handler plays the pain voice.
- **A full-screen VID** did not mute the song or stop the ambient loops
  (`DaggerfallSongPlayer.cs:356-362`, `AmbientEffectsPlayer` on
  OnVideoStart/End).
- **The use-magic-item picker** and **the classic load window** lacked
  their ButtonClick.
- **The parry sound** played at volume 1; `EnemySounds.cs:139` plays it at
  1.1.
- **Footsteps** wrote `lastPosition` at three sites DFU does not
  (`PlayerFootsteps.cs:89/:245` and the step itself are its three).

### The inventory window (8 confirmed, 8 fixed)

- **GetActionModeRightClick** (`DaggerfallInventoryWindow.cs:1871-1882`,
  Equip and Remove swap on a right click) had no port.
- **The window's shared ToolTip** (`DaggerfallBaseWindow.cs:50-56`) over
  both scrollers, the accessory buttons and the paper doll.
- **ShowInfoPopup's potion-recipe chain** (`DaggerfallUnityItemMCP.cs:245-260`).
- **Middle-click NextVariant** on the paper doll and the scrollers.
- **UpdateItemInfoPanel's three shortenings** (kilograms, points of
  damage, armor rating - `Internal_Strings.csv:838-843`).
- **The mouse wheel** scrolls the scroller under the cursor, silently
  (`ItemListScroller.cs:606-616`).
- **ItemBackgroundColourHandler** - quest, light-source and summoned items
  tint their whole cell (`DaggerfallInventoryWindow.cs:401-411`).
- **DoTransferItem's AddPosition.Front** for quest items
  (`ItemCollection.cs:217-252`).

### The review round

Nine adversarial reviewers, one per lane, read each lane's diff with
the reference open: 32 findings (3 high, 19 medium, 10 low), every one
confirmed by the lane on its return and applied. The three highs:

- **The layout lane's headline record was a misreading.** The lane had
  overridden both verifiers to record that `DFMesh.Size * GlobalScale`
  is one 256th of a model's world extent. `Arch3dFile.cs:711-713` builds
  the size from the same divided points `WritePoint` (`:941-943`)
  writes, so the box IS the model's extent; the record is struck and the
  pin recomputes both halves of the chain from raw ARCH3D points.
- **The static-building latch was keyed on the block FILE**, so every
  repeated block in a town contributed no buildings; DFU's key is (cell
  x, cell y, subrecord) (`RMBLayout.cs:187-193`, the `firstModel` flag
  fresh per subrecord at `:832`). The world host's door-data wrapper
  resolved a repeat's matrix to the first cell holding that block name
  and now takes the hit's own pixel-local matrix.
- **The HUD's window gate blanked the HUD under a message box**, which
  DFU draws it under: `DaggerfallPopupWindow.Draw` (`:76-84`) paints
  `previousWindow` first, and every `DaggerfallUI.MessageBox` box is built
  on the top window. The window stack answers `hudCovered` by walking the
  chain; a window with no field blanks it, a box with `previousWindow`
  set paints it.

The mediums were mostly pins that held shape and not argument (the
holiday text's host wiring, the F18 facing hint, F28's on-screen half,
F41's music mute with no sounding song, the tooltip draw call), plus
four behaviour gaps: the autorun stride was silent because every host
gated footsteps on the raw move keys (`PlayerFootsteps.cs:264-265` reads
`IsStandingStill`, so `player.standing` gained its three missing
writers); the ToggleAutorun clear sat inside the levitation-skipped
speed capture where `InputManager.cs:1850-1852` has no such gate; the
summary and the bonus-stats screen shared a `statCursor` where DFU holds
two `StatsRollout` instances; the gender box accepted Return with no M/F
hotkeys (`CreateCharGenderSelect.cs:53-54`, no default button); the wheel
scrolled the list but never repointed the hover
(`ItemListScroller.cs:346-347`); a double-click on a classic load slot
sounds twice (`BaseScreenComponent.cs:681-692` raises both events). Two
of the motor lane's own deferrals were refuted by its reviewer - the
worldModes AutoRun binding IS reachable, since that host reads the
window host's `keys` set - and taken.

## Integration

Nine squash merges in lane order (motor, time-weather, travel, layout,
bank-misc, chargen, hud, audio, inventory), each lane's first commit and
review round folded into one message. Conflicts inside the fleet were
doc tails (arc pages and Testing.md rows, unioned), one import union in
`exterior.js`, the two hosts' window-emission line (time-weather's
`windowStyleForTime` read plus layout's `tickCityGates` beside it) and
`ActionTextBox`'s constructor, which two lanes each gave one option
(`highlightColor`, `previousWindow`).

Main had moved by three PRs while the lanes ran - the Clock arc
(CLK1-CLK4), TL3+CG2 and SIB2 - and TL3 fixed the SAME defect as the
travel lane's F18, the fast-travel arrival's missing reposition, with
`RandomStartMarker`. The lane's reading is kept: DFU passes
`DirectionFromStartMarker` (`DaggerfallTravelPopUp.cs:334`) and the
cached departure tilts the side pick; SIB2's `modEvent: 'travel'` rides
the same call and the teleport core's signature carries both options.
Three of main's pins moved onto the merged literals. Port-Status's
section A tally was recounted from the merged Ledger (87 rows, 7 struck,
80 standing: main's CLK2 row at 13, the chargen lane's F29 row at 87).

Cites: the provenance mapper over the eleven trees (the base, nine lane
tips, main, the pre-merge squash), then a second pass for
`Port-Ledger.md:N` targets, which the mapper never handled - the two
Ledger insertions moved every cite below row 13 by one and every cite
below row 168 by two, in a form (`:N` row identifiers, `Port-Ledger row
:N`) the first mapper does not read. Twelve cites hand-resolved by
content after both passes: the HUD row's three bare continuations, a
slash pair in the exterior-host pin, the chargen docstring's route cite,
and eight section-2 identifiers whose rows the src-cite pass had itself
rewritten.

## What was left, and by whose decision

- **F5's collider half** (motor): the CanStand query is DFU's, but the
  port's depenetrating resolver still displaces a wedged capsule
  vertically where Unity leaves it clipping. The mirror clamp the
  verifier asked for fixes the sink band and breaks the step-up ladder's
  ceiling cap (`test/motorStairs.test.js:160`); re-specifying that
  contract is engine surgery in a collider every foe shares, for a low
  finding, and is left with both measured bands recorded on the Player
  arc page.
- **F0's tile-0 latch** (motor): `PlayerEnterExit.cs:415-421` keeps
  IsPlayerSwimming for a player who surfaces onto tile 0 off-ground;
  `exteriorSwimLatch` models it and still has no production caller.
  Recorded, not invented.
- **F13's standalone dungeon host** (layout): the host gets the static
  NPC data but no `person:` target on its ray - it mounts no talk seam,
  no faction dictionary, no quest bridge, so a target would eat clicks
  and answer nothing.
- **Two F25 sub-proposals** (bank) dropped as unfaithful: no repay
  outcome renders a macro, and DepositAll/SellHouse/SellShip return NONE,
  so a Yes arm never shows a second box in DFU.
- Nothing here has been seen in a browser. The surfaces that want eyes
  first: a city gate at dusk, the holiday parchment on a festival
  morning, the mid-screen label under the large HUD, the fast-travel
  arrival's facing, the inventory's tooltips and tinted cells, and
  Shift-F10.

## The cost

The audit fleet: 136 agents, 13 million tokens, four hours. The fix
fleet: 27 agents (nine lanes, nine reviewers, nine fixups), 6.1 million
tokens, 2,958 tool calls, five hours at two lanes abreast (one
container restart in the middle; the relaunch resumed from the journal
with nothing lost). Integration was solo. Gate at the merge: see the PR.

## Lessons

- **Grouping lanes by FILE worked.** No member was ported twice inside
  the fleet; the one duplicate came from outside it (TL3 on main), and
  a duplicate from main is a merge decision like any other.
- **A lane's own departure from its verifiers needs the reviewer.** The
  layout lane overrode both verifiers with an arithmetic argument that
  was wrong, and recorded it as law; the review round caught it in the
  hour. The rule stands: a lane that disagrees with both verifiers flags
  it, and the flag is what the reviewer reads first.
- **The cite mappers need a Ledger arm.** Every audit since ROAD-E has
  hand-fixed `Port-Ledger.md:N` cites at integration; this one wrote the
  second mapper. Fold it into the first before AUDIT 65.
- **Shape pins are not pins.** Eleven of the thirty-two review findings
  were tests that asserted text fragments a mutation could not redden.
  The lanes' own mutation tallies (17/17, 14/14) were honest about the
  fixes and silent about the wiring; the reviewer's mutants aimed at
  the wiring.
