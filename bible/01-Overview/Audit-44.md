# AUDIT 44 - ENHANCED ENVIRONMENTS, SLICES 1-3 (2026-09-01)

Mac: a deep comprehensive audit on everything so far. Method as the
last three: measure and sweep rather than re-read prose.

## Findings

**F1 - THE MENU PROBE STILL DROVE THE RETIRED ROW.** EE1 renamed the
switch and re-taught three unit pins, and I swept `src/` for readers
of `proceduralSky` - but not `tools/`. enhancedMenuProbe clicks the
row by its LABEL and reads the pref by its NAME, so it would have
failed on a row it could not find rather than on a fault, and the
first person to run it would have spent the time working out that the
probe was stale rather than the menu broken. Driven at the real row
and the real key now, with its own check labels renamed to match.

**F2 - THE TILE ARRAY CACHE OUTLIVED THE SWITCH.** `uploadTileArray`
returned the stored array before it ever consulted `enhancedGround`,
and the cache lives on the RENDERER, which survives a world load. So
a player who flipped Enhanced Environments and loaded a new world got
the sampler the array had been built with the first time - and the
row's promise that it "takes effect when the world next loads" was
false for the ground. Only a full page reload would have done it,
which nobody would guess. The mode is part of the cache key now: two
modes, two arrays, and a flip picks the other one. 1 mutant dead.

## Verified

- **Nothing live reads `proceduralSky`.** The only two mentions left
  are the migration that consumes it and the default it reads from,
  both in uiPrefs, and both deliberate.
- **The migration is one-way and once**: it fires only when the new
  key is absent AND the old one is present, so a player who has since
  set Enhanced Environments explicitly is never overwritten by their
  old sky answer.
- **The classic skin cannot inherit the enhanced sampler**:
  `enhancedGround` defaults false on the renderer, both hosts set it
  from `isEnhanced() && getPref(...)` immediately before the upload,
  and the NEAREST branch is asserted intact.
- **`?sky=classic` still forces the panorama**, so every probe riding
  that door keeps working.
- **The two sky fixes are the game's, not the lab's**: the ray
  convention that the lab needed was a LAB bug - the game builds its
  ray from a host that passes its own camera's yaw and pitch - and it
  was deliberately NOT ported. Only the horizon projection cap and
  the star-cell fix crossed over.

## Not covered, said plainly

Slices 4-6 - the drawn surfaces, the instanced grass and the surface
field - are not begun. The terrain shader still has one per-vertex
normal and no detail read, so EE3 has made the existing tiles stop
boiling and has not yet made them anything else.
