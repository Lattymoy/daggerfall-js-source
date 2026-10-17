# AUDIT 48 - DEEP DEFORMATION, AND THE GATE THAT WAS TESTING THE WRONG SKIN (2026-09-02)

Mac: deep, persistent deformation for the player, NPCs and enemies;
and a comprehensive audit.

## The slice (EE12)

A foot now drives most of the way to the ground: the tread is
flat-bottomed (the whole foot compresses fully, only the edge tapers),
the cell is packed in one step, what is taken is thrown to the rim so
a trail has WALLS, and the calendar's base cannot refill a packed
cell - a steep gate, because a linear one left a 0.7-packed print
taking 30% of the gap every tick and at the world clock's 60x that
filled a footprint inside a second. Only NEW SNOW covers a trail, and
the pack heals under the fall. One stride rule for every walker: the
town's people, the city's guards, the exterior foes. Two mutants dead
(the calendar refilling the print; a shallow print).

## Findings

**F1 - THE GATE'S CLASSIC MODE NEVER RAN THE CLASSIC SKIN.** The skin's
URL door is `?skin=classic`. The gate appended a bare `?classic`, which
is the classic START-LOCATION door in world.js - so every "classic"
run since EE0 rendered the ENHANCED skin, and the numbers that looked
like classic-vs-enhanced (79 vs 97, 90 vs 104) were weather. Fixed,
and the classic skin is now PROVEN empty of the arc by the census
through the real door: no pixel carries a field, no pixel carries
grass, with grass left ON in the URL so its absence is the skin's
doing. The real classic terrain band is 121.7 against 74.0 enhanced -
genuinely different now.

**F2 - THE CENSUS MEASURED THE WRONG THING, AND I BELIEVED IT.** The
walker stamps the cell it boots on, so the census's "before" was an
already-stamped cell, and comparing it with the next stamped cell read
"no print" on a field full of them. An hour of theory went into the
field before a 5x5 grid of the cells around the feet showed trenches
at a fifth of the surrounding depth, packed to 0.99, persisting. The
census now compares the cell under the feet against an UNTOUCHED cell
four metres to the side (0.07 against 0.45), walks by the world's own
door instead of a keypress the page may not hear, and reports the
stamp count and the last stamp so the next reader sees what landed.
The lesson, again: the number is only as good as what it measures,
and the grid should have been the first thing looked at, not the
last.

**F3 - THE KEYPRESS WALK WAS SILENT.** A `w` into a headless page moved
nothing - the feet read identical before and after - which the first
census masked by comparing two stamped cells anyway. `__warpTo` moves
the walker deterministically and the stride rule sees the step.

## Sweeps, clean

Every shader declares what it uses (12 templates); no cache reader
outside the renderer; the upload law on five paths; every draw
reports; every kill switch present; the debug door reads and never
writes.

## Gates

bootProbe BOOT OK; check green; worldRenderGate enhanced 74.0, ground
classic 103.0, skin classic 121.7; fieldCensusProbe ON (deep print,
twice), OFF (no field), classic skin (no field, no grass).
