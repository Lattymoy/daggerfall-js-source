# AUDIT 39 - THE GROUND/SKY/WEATHER LAB (2026-08-31)

Mac's call: a deep comprehensive audit over everything in the
prototype. Method: every quantity that more than one system reads,
traced to see whether the systems agree; every value that eases,
checked for whether it eases everywhere it is read; and the whole
page walked live at a hard wind, a low sun and a building front.

## Findings

**F1 - THE GRASS IGNORED THE WIND'S DIRECTION.** The blades swayed on
a fixed axis with a fixed cross-term, so the field always leaned the
same way however the wind slider was set. The moment PROTO-9 gave the
rain a direction, the grass and the rain disagreed in plain sight -
the worst kind of wrong, because both were individually convincing.
The lean is the wind VECTOR now, and the gust travels ACROSS the field
as a wave (the phase carries a blade's position along the wind), so a
gust reads as one thing moving rather than every blade wobbling alone.

**F2 - THREE SYSTEMS, THREE WINDS.** The rain built its own vector
inside the weather block, the sky drifted its decks on the palette's
own two-component wind, and the grass had no direction at all. One
wind is computed per frame now and all three read it: the deck drifts
downwind at the front's own speed, the rain drives along it, the grass
bends with it.

**F3 - LIGHTNING STRUCK OUT OF A CLEAR SKY.** The flash keyed off the
weather you had ASKED for, not the sky that was actually there, so
choosing thunder lit the world before a single cloud had built. It
rides the front's progress now. Its shape was also a sine of the wall
clock - frame-rate dependent and metronomic; it is a seeded strike
with a real exponential decay.

**F4 - THE FALL SPEED READ THE TARGET.** A rain-to-snow change made
the last rain drops crawl at flake speed the instant the menu moved,
because the speed and the particle KIND both read the destination
while the front was still carrying the old weather. Both ease with the
front now.

**F5 - THE SURFACE PICKER COULD NOT GIVE THE GRASS BACK.** Choosing a
non-grass surface turned the blades off, and choosing grass again did
not turn them on, so a dirt detour left a bare field with no way back
but a reload.

## Verified

- The front's easing is frame-rate independent (dt-driven, clamped at
  50ms), and every world term - fog, dim, wet, sky colour - eases with
  it rather than snapping.
- The sky is the game's shader verbatim (AUDIT 38's fix stands); the
  lab adds only the ray and the uniforms.
- sunOcclusion is evaluated on the same two decks at the same scales
  the shader draws, so the disc and the ground cannot disagree.
- The blade lattice, the pebble lattice and the weather box all wrap,
  so nothing crawls or repopulates as the camera moves.
- The surface round trip repaints both sheets and their normals, and
  the blades return: verified live at 57fps.

## Not covered, said plainly

This is a prototype page, not the game. None of it is wired into the
terrain renderer, and the pins that guard the shipped code do not
guard this file - the gate only checks that it builds. Bringing any
of it into the game is its own arc, and the mipmaps, the instanced
draw and the lighting path are the three pieces the renderer lacks.
