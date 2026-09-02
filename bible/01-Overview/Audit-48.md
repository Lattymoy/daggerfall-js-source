# Audit 48 - everything since the morning of 2026-09-01

Mac, 2026-09-02: "Lets do a comprehensive audit on everything." Every
arc that shipped from the pack column onward, swept first and then read.

## The sweep, and what it found before anything else

Twelve mutants, one per load-bearing line, each against its own suite.
Six died. One survived (A1). **Five could not be applied, because the
lines they targeted are no longer in the tree.** That is the audit's
first and largest finding, and it is not a code defect.

## A0 - CRITICAL. A third lane reverted a day's Morrowind work, whole.

`7dcc16ba SOLID REVERT: restore the tree of edab46e (ROAD-A closed),
whole` - 2026-09-01 17:14 UTC, by a lane that calls itself "this
branch" and the author of the reverted work "the other account". Its
message: that afternoon's work "ended in partial self-reverts that left
MW/EE residue in nine src files", so it restored "the last fully-gated
tree" in one motion, and notes that "everything reverted remains
recoverable from history and may return piece by piece, proven".

The lane's gate was green when it did it. So was the gate on every one
of the commits it removed. A green count on both sides is not a tie-
breaker; the revert was a judgement that the work was residue, and for
the fixes below it was wrong, because each answers a report Mac made
and confirmed.

**Gone, and what Mac will see because of it:**

| Fix | What returns |
|---|---|
| MW-D42d, the loose sound rides the loose | the bow's string is heard before the arrow leaves - his report, verbatim |
| MW-D42c, third person holds the loose too | in third person the click fires the classic frame-5 hit - his report, verbatim |
| MW-D44, the arrow inherits the weapon's BoneOffset | the arrow displaced from the hand on a mesh with the node |
| MW-D45, the arm card names the arrow's branch | the one line that told which of two placements was in play |
| MW-D46/46b, the quiver branch needs its animation, at all four doors | the arrow on the body wherever a skeleton carries "Bip01 Arrow" |
| MW-D47, the bow mesh is asked first | the same, decided the other way round |
| MW-D48, the arithmetic pinned as NOT the fault | four dead theories un-recorded; the next hunt re-walks them |
| MW-D49, rule 58 in the name search | the search can answer with a node the reference never sees |
| the arrow pins in mwarrow.test.js (232 lines) and weaponrig.test.js (31) | the laws above, unpinned |
| Morrowind-Rules.md MW-D42..49 (179 lines) | the reasoning, gone with the code |
| tools/bootProbe.mjs, the ARENA2-free boot check | replaced by a rewrite that needs MIDI.BSA and cannot run in a build container |

**Survived:** MW-D42 itself (the hold, first person, and the nock
floor), MW-D43/43b (both pixelize dials), PX31/32/33 (the pack column,
the portrait pose, the swap notify), EE5b (the black screen), the
multiplayer design, and all of Roads 1-13. The revert's own Audit-44
record was restored by it.

**What this audit does about it: nothing unilateral.** Re-landing nine
commits over another lane's deliberate revert is how a revert war
starts, and the message says the work may return piece by piece,
proven. That is the right shape. The recommendation, in order:

1. MW-D42d and MW-D42c first - small, pinned, and each is a bug Mac
   reported and confirmed. Their absence is a regression he will hear
   and see on the next shot.
2. The arrow chain (44-49) as one piece, AFTER Mac says what the arrow
   does now - because the revert changed what he sees, and the chain's
   last commit rested on his report of the state before it.
3. bootProbe's ARENA2-free form beside the rewrite, not instead of it -
   the two check different things.

And a standing law, the fourth of its kind this session: **before a
lane reverts another lane's commit, it reads that commit's message.**
Every one of the nine names the report it answers. "Residue" is not a
finding.

## A1 - MEDIUM, FIXED. The enhanced map's chips did not gate the relief in any pin.

ROADS 12's pin held the store and the grid key; the line that reads the
flags to decide what `pathAt` draws (`showRoads = !this.filters.roads`)
survived being replaced with `true` - the chips could toggle nothing on
the relief and every pin stay green. Pinned now: with roads hidden the
relief's `pathAt` answers 0 on a road pixel and 1 on a track.

## A2 - LOW, RECORDED. EE5b has no node pin and cannot have one.

Deleting the interpolated cloud block from TERRAIN_FS is invisible to
the suite - node never compiles GLSL. The boot probe was that pin, and
see A0 for its state. Until it is back, a shader change is gated by a
browser and nothing else.

## Cleared by the sweep

R13 the classic map's region check; R5 turn cost; R6 corner cutting;
R10 the smoother's mark; R4 the road surface by record; and, re-run
after A1, R12. Six of six.

## Standing

Roads 1-13 are whole, pinned and audited (45, 46, this - 48). The Morrowind
arm is back to the state of 2026-09-01 mid-afternoon plus MW-D42, 43
and PX31-33, with two of Mac's confirmed reports open again by revert.
The decision on re-landing is Mac's and this audit's second commit
waits on it.
