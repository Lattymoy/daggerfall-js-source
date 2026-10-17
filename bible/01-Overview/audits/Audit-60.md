# AUDIT 60 - PH1, THE PEGAS HORSE, BEFORE IT MERGES (2026-09-04)

REMOVED 2026-09-04, later the same day - Mac: "completely remove the
morrowind 3d horse implementation". The feature this audit cleared was
cut whole; this page stands as history.

Mac: "let's go ahead and do a comprehensive audit on it before we
continue." PH1 was written on another account and pushed to a branch;
this audit ran on that branch merged with today's main.

## What was checked, and how it came out

| # | Sweep | Result |
|---|---|---|
| 1 | Every script cite in pegasRide.js is a line inside the 951-line script | 78 cites, none outside 1..951 |
| 2 | The wiring, rung by rung: world -> createPegasRider -> mount / dismount / tick / tryActivate / drawRidden; the rider -> horseRecord, createPegasRide, the gates, the saddle; the motor's `this.pegas` | **every rung present** - not an unhung door |
| 3 | Save and load are symmetric: horses written to the save and to the travel carry are restored from both | `restoreWorld` on both paths |
| 4 | The classic skin is untouched | the activation arm is behind `isEnhanced()`; the tick and the motor override only exist after a mount |
| 5 | The pins bite on the script's numbers | trot 10, the mount lift, the clock constant, the drain's sign - all caught |
| 6 | The pins bite on the CLOCK'S USE | **F3** |
| 7 | Every transcribed constant is applied by the machine | **F2**, and two notes |
| 8 | The source the port claims 1:1 against is in the tree | **F1** |

## The findings

**F1 - the script is not in the tree.** Every "verbatim" claim cites
`hr_horse_script` by line - 78 times - and the script's text is nowhere
in the repository: not vendored, not extracted, not in the bible. The
author read it from Morrowind data attached to their session. So the
1:1 claim is the author's word: this audit could check that the cites
are plausible line numbers, and nothing more. Until the 951 lines are
vendored beside the meshes (the same consent question as MW-D50), no
audit can verify a single constant, and PH2-PH5's cites will be the
same. **Mac's call**, since it is a vendoring decision.

**F2 - a script law transcribed and never applied.** `LOAD_FIX_DISTANCE
= 500` (`:203`): "a horse over 500 units off its recorded spot is put
back" on load. The constant is declared with its cite and read by
nothing - not the machine, not `restoreWorld`, not a test. A number
the arc presents as law that the port does not enforce.

**F3 - the clock's use is unpinned.** Decision 5 of the arc is that the
script's per-frame numbers are scaled to real time at 30 Hz, because
at 60 "the gallop reads as a car". The scaling is one line - `frames =
dt * PEGAS_SCRIPT_HZ` - and replacing it with `frames = 1` (per render
frame, the mod's own frame-rate dependence) fails **no pin**. The
constant is pinned; its application is not.

**Two notes, not faults.** `SLOW_FALL_RIDING` and `FORWARD_STEP_DEG` are
transcribed and unread, but their laws ARE applied another way - the
motor's `fallDamage === false` flag, and real trig in place of the
script's 138-line one-degree table. They should say so beside the
constant, or a later reader will report them as F2.

## Merge state

Merges with main on doc conflicts only. On the merged tree every
source test passes; six line-cite pins fail (the Ledger, Port-Status
and world.js lines moved on both sides), plus a module count and the
build stamp - the same bookkeeping every merge this week has needed.

## What this audit could not do

**See the horse.** No Morrowind data and no ARENA2 here: the mesh
through the character pass, the seat, the ride's feel, the sounds, the
height menu - all never rendered, all Mac's by the Incident's law.
