# FIELD BUGS 2026-10-28 - "chopping trees and general interaction outside the bay can lock up your character"

The owner passed on a player report, with no error text or place. Read on main's `a779c9c29` with the freeware's data
(`tools/fetch-data.sh`). The pins are in `fb1028_loopalive.test.js` and the mutants in `tools/mutants/fb1028_loopalive.json` (8, all
dead).

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "chopping trees and general interaction outside the bay can lock up your character" | Not reproduced. Two ways one throw locked a character for the rest of the session were found and closed | LOOP-ALIVE |

## What was ruled out

The gathering host was driven in-process at a wooded pixel past the Bay (1395, 1442): the real tree kind, profession
book and HUD, and every province region (62 to 70) on every climate, unconfirmed and confirmed ground. Every chop ran
to its end and the next press started an act. The account service answered the same harvest. The throw that the
report met is not known. LOOP-ALIVE makes sure that such a throw can no longer lock the player.

## LOOP-ALIVE: a throw never ends the frame loop (1)

`src/scenes/frameLoop.js`, imported by `world.js`, `exterior.js` and `dungeon.js` as their `requestAnimationFrame`.

A host's frame re-arms at its foot. A throw anywhere in it - the activation ladder, a press, a profession's start -
ended the loop: the game stood still under the CRASH report. Now a loop that throws before its foot is armed again,
and its fault goes to the same report once a message (`reportError`), which can be dismissed. A callback that never
armed itself, or a loop's first frame, throws as before.

## LOOP-ALIVE: an act whose frame throws ends (1)

`src/scenes/gatherHost.js` (`gatherHost.js:"if (act && act === faulted) dropFaulted();"`).

The hosts call the gathering tick inside a catch. An act whose frame threw stayed in the slot: never stepped, never
ended by a walk away. Every press, click and swing stayed the act's - the character locked up. Now the next tick ends
it, emptied first, with "The gathering stopped early." Each kind's frame is caught by itself, so one kind's fault never
stops the act's frame.
