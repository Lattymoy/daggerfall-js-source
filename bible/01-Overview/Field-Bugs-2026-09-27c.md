# FIELD BUGS 2026-09-27c - the death screen that would not rise, and a rest that aged nothing

Mac, with two screenshots from the bug-reports channel:

1. *"You can become a god with spell effects - So, when you rest, spell effects don't wear off. I found this out while
   training my magic skills. As such, you can stack them for thousands of rounds to last for long enough that you
   don't need to recast them actively ... I've acomplished permanent true invisibility, waterbreathing, regenerate
   health, etc. Anything that can be cast on oneself and has a spell effect can be stacked forever."* - and later,
   *"might be fixed"* (Double..., the name cut off in the screenshot)
2. *"Stuck on death screen - Was fast travelling while playing online and my character just decided to climb a wall
   that was in the way and died. I clicked "rise now" but the death screen didn't go away, so I waited for the timer
   and it still didn't go away when it reached 0."* (Ninilac)

## RISE-STUCK: the death screen keeps the top; a death ends the journey (2)

The screen's reset is one-shot, and online the rise REPLACES the top window with its line. A box pushed over the
screen buried it - the veil, DOM over the canvas, hid the box - and the rise replaced the box: the screen came back
with its reset spent and nothing could take it down. The box was most likely the journey's own. Travel Options'
autopilot runs under any paused window, so it kept its x60 and its arrival test through the death, and the respawn's
teleport moves the origin a whole build before it stands the player - a respawn at the journey's destination can read
as the arrival. A box pushed over a death screen now waits beneath it (all four hosts' stacks); a death sends the mod's
`pauseTravel`; a respawn that throws still takes the screen down. `06-Systems/Online-Arc.md` RISE-STUCK,
`06-Systems/Travel-Options.md` RISE-STUCK. The arrival as the box is inferred, not seen - see below.

## REST-ROUNDS: an online rest ages the effects (1)

Stacking is DFU's: an incumbent effect cast again adds its rounds. A rest that ages nothing is not. Offline a rested
hour is sixty rounds; online the clock is the world's, and the ticker's RaiseTime ran its real seconds - RESTX2's
sub-tick minute reached the dungeon's rounds and no other host's. Outdoors, in a building and in a party's mirrored
nap, a night now ages every effect by its minutes, claimed the dungeon's way; the shared clock is not moved. Offline
nothing changes. `06-Systems/Online-Arc.md` REST-ROUNDS.

## For Mac

- **What buried the death screen** is inferred, not reproduced (no ARENA2, no online session here): the journey's
  arrival fires under a paused window - pinned - and the respawn's teleport can read as it. Whatever the box was, the
  stack's half closes it: nothing can be pushed over a death screen now.
- **Why the journey climbed the wall** was not looked into. TRAVEL-NAV's steering means to stop short of a wall; a
  death on a journey is survivable now, but the climb is its own report and a probe on real data would show it.
- **Casting to stack is still DFU's law.** Recasting an incumbent effect adds its rounds, offline and online; what is
  gone is the rest that restored the magicka without aging them.
- **A guard's blow on a dead criminal** (AUDIT RISE-REST O1, below) replaces the death screen with the surrender box
  and can carry the corpse into court at 1 health. DFU's arrest law is the question; not changed here.
- **The needs after an online night** (O2, below): a load inside the night's span starts the record fresh - the
  dungeon's arm has done so since AUDIT SURV B, and the other hosts now do too.

## AUDIT RISE-REST (2026-09-27, Mac: "Audit this")

The two fixes read back before they merge. Main merged first (#401: every conflict a line cite - main's version of
every file, this branch's edits re-applied by content, the cites re-resolved against main, the batch moved to this
page). Then a review at high effort - eight findings, each checked against the code before anything moved - and this
audit's own read, which found one more. Four fixes; four findings not taken, each with its reason; two left open.

**Fixed.**
- **F1 - the catch knew one host.** `respawnOnlinePlayer`'s catch closed townTalk's death screen alone. A death in a
  building or a dungeon stands in the mode's own slot, and a rise that threw before or inside `forceExitToExterior`
  (the court's `landBeforeGate`, the exit's own teardown) kept that screen with its reset spent - this batch's stuck
  screen, one host over. The Resurrect always knew both slots; one door now, `closeDeathScreen`, for both (the
  review's reuse finding on the same lines with it).
- **F2 - the online night paid no needs.** The minute REST-ROUNDS found dropped for the rounds was dropped for the
  needs too: the dungeon's arm pays the night asleep over the session's window (AUDIT SURV B), the ticker's paid the
  world's seconds. Ten hours owed and eight in a bed: 0 left offline, all ten online; thirst 133 against 0.3. The
  ticker's arm pays them the dungeon's way now, and the record's marker keeps the next frame from paying them again -
  SURV4's own header says "ONLINE the same". The review's reuse finding (one helper with `_restAdvance`) was not
  taken: that arm is held word for word by five suites, one of which mounts its source; the two arms are held
  together by behaviour instead, online against offline, for the rounds and for the needs.
- **F3 - a box beneath the screen was painted.** townTalk paints the covered windows under its top (ROAD close-P), so a
  box waiting under the death screen showed through the classic wash and, on the enhanced skin, floated as the
  notice stack's DOM (z-index 31) over the veil (18) - readable, and not answerable. `eachPaintedBeneath` paints
  nothing beneath a window that holds the top. The two modal hosts paint their top alone.
- **F4 (the audit's own) - the journey's stop could cost the screen.** The presenter runs inside the one damage door,
  and `pauseTravel` ran before the screen went up: a throw from InterruptTravel's tail (the junction map's draw, the
  weather and sound switches) would have left a dead player standing with no screen - AUDIT 21 F6's failure. It runs
  after the screen now, guarded.

**Not taken.**
- **The camera turning to the destination at the death.** MouseLookAtDestination is the autopilot's own latched
  bearing at pitch 0, and during a journey the frame already writes the autopilot's yaw and pitch 0 every frame; the
  online rise's teleport then sets the facing from its landing (PositionPlayerToLocation). Nothing of it survives the
  rise.
- **A buried window's onPush, and callers that push and then read the slot.** onPush lives on player-opened windows
  alone (the control settings, the automap), none of which can open under a death screen; the quest box re-checks
  that it is still on top and mints a new box when not (two queued under the screen come up newest first, DFU's
  stacking); the trade window re-checks its range every frame. The talk panel's `relock` count cannot meet a death
  screen either - talk cannot open under one.
- **Closing the screen by identity instead of a flag on the stack.** `closeOverlay(win)` refuses a covered window by
  design, and a buried screen also froze its own countdown and handed Enter to a box the veil hid; keeping the screen
  on top answers all three, in every host's stack.
- **One helper for the two rest arms** - above, under F2.

**Left open.**
- **O1 - the replace door.** Nothing can be pushed over a death screen now, but a REPLACE still disposes it. One path
  that needs no input: the watch acts under any window (WINFOE1), and `onPlayerHurt` (world.js) hands a guard's blow
  on a dead player to `arrestFlow.onGuardHit` with no alive check - with a crime standing, the surrender box goes up
  through `showOverlay` over the screen, and its `health <= dmg` arm surrenders the corpse at 1 health into court.
  Not from this batch. DFU dies in three seconds and the port's online death holds sixty; whether a blow on the
  dying may arrest is DFU's arrest law, and it is Mac's.
- **O2 - a needs record ahead of the world resets at a load.** A night online leaves the record's `awakeSince` at the
  night's simulated end, ahead of the world's clock until it catches up (forty real minutes after eight hours), and
  `alignSurvival` reads a record from further along than the world as stale and starts it fresh on a load inside
  that span. The dungeon's arm has done this since AUDIT SURV B; F2 carries it to the other hosts. The needs return
  to fresh - recorded, not changed.

Pinned: `risestuck` 8 (F1, F3 and F4 among them), `restrounds` 6 (F2's night in a bed); WORLD5's shape pin re-aimed to
the arm's longer body. Mutants: `rise_stuck` 12 and `rest_rounds` 9, all dead.

## Verification

`npm run check` green at each commit - the batch's (12872 tests), the merge's (12998) and the audit's (13000): 0
failing, the 244 that need ARENA2 skipped, lint, types and the build. New pins `risestuck` (8) and `restrounds` (6);
re-aimed by content `world5`, `restx2_online_rest`, `camp1_groups`, `exteriorfoes`, `partyrest1`, `restwhere`,
`audit62_hosts`. Mutants `rise_stuck` 12 and `rest_rounds` 9, all dead; the records the change moved (`restx2camp`,
`survtiers`, `survtiers3`) re-aimed by content and re-run with `camp1rest`, all dead. Line cites re-resolved with
tools/citeShift.mjs (196 at the batch, 196 at the merge, 138 at the audit) and, by hand, the struck rows the drift
pins read. Neither fix proven in a browser or with two players.
