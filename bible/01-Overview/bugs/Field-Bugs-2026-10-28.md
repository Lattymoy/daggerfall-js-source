# FIELD BUGS 2026-10-28 - "chopping trees and general interaction outside the bay can lock up your character"

The owner passed on a player report, with no error text or place. Read on main's `a779c9c29` with the freeware's data
(`tools/fetch-data.sh`). The pins are in `fb1028_loopalive.test.js` and the mutants in `tools/mutants/fb1028_loopalive.json` (all
dead). AUDIT LOOP-ALIVE read it cold (`../audits/Audit-Loop-Alive.md`); its corrections are made below.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "chopping trees and general interaction outside the bay can lock up your character" | Not reproduced. Two ways one throw locked a character for the rest of the session were found and closed | LOOP-ALIVE |

## What was ruled out, and what was not

The gathering host was driven in-process past the Bay with the real tree kind and profession book. The pins hold it:
every province region (62 to 70) on each of the seven climates that stand trees (226 to 232), on unconfirmed and
confirmed ground, at Logging 100. Every chop ran to its end and the next press was the world's. The account service
answered the same harvest. The audit drove the tree kind's real renderer, forest groups and jungle trees as well.

Not checked: the running game (no browser was run), the rest of "general interaction" past the Bay (doors, talk,
loot), the other gathering kinds, and acts indoors or underground. The throw that the report met is not known.

## LOOP-ALIVE: a throw no longer ends the frame loop (1)

`src/scenes/frameLoop.js`, imported by `world.js`, `exterior.js`, `dungeon.js` and `interior.js` as their
`requestAnimationFrame`.

A host's frame re-arms at its foot. A throw anywhere in it - the activation ladder, a press, a profession's start -
ended the loop: the game stood still under the CRASH report. Now a loop that has armed itself once and then throws is
armed again. Its fault goes to the same report, which can be dismissed, once a loop for each message and line that
threw. A loop's first frame, or a callback that never armed itself, throws as before. `Renderer.beginFrame` sets the
draw-state baseline before its clear, so a pass that threw mid-draw leaves nothing for the next frame.

## LOOP-ALIVE: an act whose frame throws tick after tick ends (1)

`src/scenes/gatherHost.js` (`gatherHost.js:"if (act && act === faulted) { if (++faults >= ACT_FAULTS_MAX) dropFaulted(); } else faults = 0;"`).

The hosts call the gathering tick inside a catch. An act whose frame threw every tick stayed in the slot: never
stepped, never ended by a walk away. Every press, click and swing stayed the act's - the character locked up. Now an
act whose frame throws two ticks in a row ends, emptied first, with "The gathering stopped early." One throw that
passes is stepped over, as before. Each kind's frame, and a finished act's last swing, is caught by itself.
