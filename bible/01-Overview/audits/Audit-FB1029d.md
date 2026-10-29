# AUDIT FB1029d - FIELD BUGS 2026-10-29d read cold, 2026-10-29

The owner: *"Audit this"*, of PR #1428 at `600348498e` - FIELD BUGS 2026-10-29d (`../bugs/Field-Bugs-2026-10-29d.md`):
WIND-FIRST, NO-PIXEL, CARGO-ASHORE and HEAVY-HINT, the two laws that stopped every ship one player took. Three cold
lanes read the change against its base `61cd23027a`, each in its own worktree, each given the files and one brief, never
a conclusion. Each finding was proven on the real runtimes - `test/csaScene.mjs`, `test/hccWorld.mjs`, the helm panel
over `test/hudPage.mjs` - and proven again here before it was fixed.

| Lane | Read | Found |
|---|---|---|
| A | the runtime law: every door, load and recentre that reaches the wind or a boat's pixel, and every reader of `MapPixel` | 4 |
| B | the cargo, the wagon and the helm's words: every wagon state against every hull, the helm's line, the translations | 9 |
| C | the pins, the mutants, the drive and the record: what each assertion holds, survivors, every number re-measured | 8 |

Twenty-one found, three of them twice (A2 is C1, B8 is C3's and C4's pins, B9's half is C3's record). Two more came
from proving them (A5, WIND-HELD). Every defect is fixed or its record corrected. Each fix in code carries an
`AUDIT FB1029d <id>` comment and is pinned by a test that fails on the code as it stood
(`test/systems/comeSailAway/audit_fb1029d.test.js`, 11), with mutants the pins kill in `tools/mutants/audit_fb1029d.json`
(34, all dead).

## Lane A - the runtime law

**A1 (should-fix; a regression). NO-PIXEL kept a guess.** `pixelOf` saved the player's pixel on a boat with none
whenever the player was indoors, and every restore reads it at once. A record loaded in an inn stamped her with the
inn's pixel: out of the door at her own pixel she stayed hidden for good, her save carried the guess, and her compass
mark stood at the inn. Now only the reading off the player's terrain is kept. Indoors, or with no terrain, the player's
pixel answers that one read and is never saved (`csaPixel.js` boatPixel).

**A2 (minor - C1). No pin held NO-PIXEL's indoor arm or its fallback.** Each lost boat in the record's pins stood in
the player's own pixel, so the terrain's reading and the player's agreed. Pinned: an inn's load keeps none, the first
outdoor read stamps (14, 20) and she is shown; a dungeon's boat is shown by the player's pixel and keeps none; another
dungeon's boat keeps her own.

**A3 (record-only reach; at the base too). One read still threw.** UpdateBoatVisibilityOf's node read took
`boat.MapPixel` bare, so a dungeon's boat with none threw there outdoors and the boats after her kept the old frame.
No record reaches it today. Every read of a boat's pixel goes through `pixelOf` now, the dungeon arms' too.

**A4 (minor; HOST-SPLIT). The pixel law grew the runtime's own scope.** `pixelUnderOn` and `pixelOf` were added inside
`createComeSailAwayRuntime`, under its ceiling, so no gate caught it. They live in `src/systems/comeSailAway/csaPixel.js`
now; the runtime's `pixelOf` is one line over `boatPixel`. The terrain's side is an argument, which keeps the leaf free
of an import cycle.

**A5 (found proving A3; at the base too). The console's boat list threw at a boat with none.** `printboats` read
`MapPixel.X`, as the C#'s PrintBoats does. It reads `pixelOf` now.

**WIND-HELD (lane A's first not-proven, made robust).** WIND-FIRST covers a throw inside OnTransition. The host's chain
runs code before it - `exitInteriorNow` six statements after the mode change, `exitDungeonNow` about twelve, the hooks'
`navalStow` - and a throw there, or a restore that throws before OnLoad, still left the indoors' none outdoors. Lane A
could not make any of them throw. Outdoors UpdateWind never lays a wind of nought, so the runtime's frame now lays the
door's wind when it finds one, and logs it.

## Lane B - the cargo, the wagon and the helm's words

**B1 (should-fix; a regression). The cargo law could be dodged at sea.** Horse Cart and Cargo refused its summon, Send
away and the mount key only on Daggerfall's own ship. At a Come Sail Away helm, held dead by 1,500 kg, a summon set the
wagon down in the sea and the next magic round freed her (0.00 to 3.24 m/s). The mount key parked it under the player.
Now no pair is mounted, summoned or sent away on a Come Sail Away deck: the host's `onDeck` names my helm's boat,
another's deck I stand on, or one under my feet. DECLARED: a wagon parked at one port and summoned at the next comes,
since the mod's summon reads no distance. It sailed weighing nothing.

**B2 (minor). A cart rider who took the helm was weighed with the wagon.** StartSailing sets the player on foot and
weighs her cargo in the same call; Horse Cart and Cargo parks the wagon only on its next frame. She lay dead until the
next magic round. `wagonWithPlayer` reads the park the next frame makes (`parkDue`).

**B3 (minor; new wrong words). The Classic helm's Carrack was always "too heavy".** Her hold is the mod's 0, so she is
dead at any load and no lightening helps. The line says a load only where the hull has a hold.

**B4 (minor). In irons gave the wrong advice under a dead load.** Striking sail and rowing turned her 0 degrees in 10 s:
the load holds her oars and rudder too. A hull her load holds dead is never in irons; the line says the load.

**B5 (minor). A passenger never saw the line.** The booked passage's card carried no load. It carries `heavy` now, and
its line says it.

**B6 (minor; at the base too). The opt-in horse and cart items weighed by ownership.** With Cargo.CartItem a parked
wagon still left the Rowboat dead. Come Sail Away's `hasHorse` and `hasCart` read the pair's keeping now
(`horseWithPlayer`, `wagonWithPlayer`).

**B7 (minor; the translations).** `helm.heavy` broke its file's words in four languages: el's informal singular in a
formal file, ko's 마차 and 선창 for the file's 수레 and 화물칸, fi's vaunuja for vankkurit, uk's візок for віз. Each
row is re-drafted in its file's words, hu's hold as raktér.

**B8 (minor - C3, C4). The half-way mark and the following team had no pin.** Pinned at shares of 1.6, 1.5, 1.45 and
1.4 of her slowing load, and a team following on foot.

**B9 (record-only).** The code is strictly under half; at exactly half the mod's word is "draws a little lower". Every
page says "under half her way" now. Also recorded, not changed: a save with no Horse Cart and Cargo record, loaded at
the helm, weighs the wagon at nought for one magic round, until the mod's first ready frame.

## Lane C - the pins, the mutants, the drive and the record

**C1 (should-fix - A2).** Five of NO-PIXEL's arms survived their mutants: both guards, the fallback, both dungeon arms
and the placing's read. All are pinned (A2, A3 above).

**C2 (should-fix). "The pixel she stands on" held for the wrong reason.** Each lost boat stood in the player's pixel, the
Imperial City's too, so the player's-pixel mutant lived. Each stands two pixels east now and must read her own, and the
report's door holds her out of sight.

**C3 (should-fix - B8). The threshold and the HUD's preview had no pin.** `< 0.6`, `<= 0.5`, `< 1` and the preview set
heavy all lived. Each dies now.

**C4 (should-fix - B8). "Following on foot stays ashore" had no pin.** Pinned.

**C5 (should-fix; the tool). `tools/sailDrive.mjs` hid its throws.** A throw went only into the stopped run's list, and
one catch around a whole step skipped the rest of it - a restore's throw skipped OnLoad. Each runtime call is caught
on its own now, printed and counted, and any throw exits 1. Over main's runtime `--lost` fails it (below).

**C6 (record-only; caused by the change).** The drive's new step changed every seed's sequence: AUDIT HELM-SIGHT's
Classic count read 6, not 11. The step is behind `--lost` now and the counts replay (below). Audit-Helm-Sight's "a
wind" is corrected.

**C7 (record-only).** The Rowboat has no sail: she lay dead at her oars. The table is the Responsive helm's. Seed 7's
stop on main was the new drive over main's runtime. Each is corrected.

**C8 (record-only).** Controls.md and Come-Sail-Away.md describe the helm's line as the keys alone. Both say the load
now.

## Not proven, and recorded

- Lane A: a load that lands somewhere else (a dungeon's save woken at a temple) reads a boat's place in the save's
  frame. Her stamp matches her equally wrong drawn place: the base's known frame, not this change's.
- Lane B: a following team has no water test (`horseFollow.js`), so it may trail a ship along the sea floor. Not probed
  on the real collider.
- Lane C: UpdateWind flips the wind's side south of map row 250, the mod's reading of the Bay, and every province's row
  meets it - the Imperial City's 881 always takes the flipped side. That is the direction alone, at the base, and not
  changed here.

## The drive

`tools/sailDrive.mjs` on this head: the Responsive helm, seeds 1, 2 and 3 at 400 runs, no stop and no throw; the
Classic helm, seed 1 at 300 runs, 11 stops, AUDIT HELM-SIGHT's count; `--lost`, seed 1 at 300 runs and seed 7 at 80,
no stop and no throw. The new drive over main's runtime, `--lost`, seed 7 at 80 runs: 1 stop and 141 calls thrown.

## Pins and mutants

`audit_fb1029d.test.js` (11) beside the record's `fb1029d_sailing.test.js` (7). `tools/mutants/audit_fb1029d.json`
34 of 34 dead. The record's list and the re-aimed ones (`fb1029d_sailing`, `csa_placing`, `fb0929h_lostboat`): 79
dead, 1 equivalent as recorded. Two records first survived the fold: the guard on her own pixel, and the door's sight
of a boat with none once its node read stopped throwing. Each is pinned now.

THE FOUR HOSTS. `scenes/world.js` wired (the deck's seam, the opt-in items' keeping); `scenes/exterior.js` FLAGGED (it
stands no Come Sail Away runtime); `scenes/worldModes.js` and `scenes/dungeonContext.js` unchanged - WIND-HELD is the
runtime's own frame.
