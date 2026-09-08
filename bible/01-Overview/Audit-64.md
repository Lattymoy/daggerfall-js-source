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

(filled at integration from the nine lanes' returns)

## Integration

(filled at integration)

## What was left, and by whose decision

(filled at integration)

## The cost

(filled at integration)
