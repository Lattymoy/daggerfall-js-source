# AUDIT 45 - ENHANCED ENVIRONMENTS: THE PARITY LEDGER (2026-09-01)

Mac: a detailed, deep audit on everything so far, ensuring 1:1 parity.

The honest answer to "is it 1:1" is NO, and the useful answer is a
LEDGER: exactly what of the prototype is in the game, what is not,
and why. Anything less is a claim rather than an audit.

## IN THE GAME, and matching the lab

| lab | game | slice |
| --- | --- | --- |
| the sky's fragment shader | the same file the lab lifted it FROM | - |
| the horizon projection cap | ported | EE2 |
| the star cell/offset fix | ported | EE2 |
| mipmaps + anisotropy on the ground | ported, enhanced only | EE3 |
| cloud shadows from the deck's own field | ported, one field | EE4 |
| the fine sunrise/sunset ramp | ported this audit | EE6 |
| cover means cover to the horizon | ported this audit | EE6 |

## NOT IN THE GAME, and named

- **The drawn ground surfaces.** Built (EE5) and deliberately unwired:
  they carry a seam, because the noise wraps on its integer lattice
  and every surface scales its frequency by a fraction. The fix is
  frequencies as whole cycles per tile, one central change.
- **The ground's normal map and detail tiling.** The terrain shader
  still has one per-vertex normal and one texture read; the lab's
  ground is lit by a Sobel normal off the surface's own height and
  modulated by a second low-frequency sheet.
- **The 3D grass.** The renderer still has no instanced draw at all.
- **The weather particles.** The game has no volume of drops or flakes
  around the camera.
- **The surface state field** - puddles, snow depth, deformation,
  melt. This is the largest gap and the one that must feed the terrain
  CHUNKER's own vertices rather than the lab's second plane.
- **The lab's front.** Deliberately NOT ported: the game has its own
  eased weather (ES1c easeWeather), and two easings would fight.

## Findings, this audit

**F1 - THE SUNSET BAND WAS THREE RUNGS WIDE.** The ramp stepped
-4 -> 0 -> 4, and the whole of a sunrise or sunset happens inside
those eight degrees - so the most-looked-at sky in the game was
interpolated in one straight line between three keys. Four keys where
there were two, taken from the lab: the horizon goes ember then
peach, the zenith takes the violet that exists for a few minutes
either side of the horizon, and the glow swings warm and then cools
as the sun clears the haze. The interpolation is untouched; only the
rungs it walks are closer together where the eye is looking.

**F2 - THE DECK WAS THINNED TO A QUARTER AT THE HORIZON.** cover
multiplied BY cover near the horizon, so at half cover an overcast day
kept a clear rim all the way round - and the horizon is the largest
part of the sky. The haze stays, since a deck does go pale with
distance; the thinning goes.

Two mutants dead. One existing pin re-taught: it sampled elevation 2
as "halfway between 0 and 4", and EE6 put a real key there, so the
interpolation law is now checked on a gap that still has no key in it.

## Said plainly

Five of the prototype's seven systems are still lab-only. The two that
crossed - the sky and the ground's sampling - are the two that needed
no new engine. Everything left needs one: an instanced draw, a normal
texture path, or the chunker feeding a state field. Nothing in this
ledger is a surprise; it is the plan from EE1's research, and it is
where it said it would be.
