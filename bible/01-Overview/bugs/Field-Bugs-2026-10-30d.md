# FIELD BUGS 2026-10-30d - a tack that ran off the screen in the Eltheric Ocean (BEAT-LANE)

A player's report, handed over in a session: sailing in the Eltheric Ocean will "try to have my ship steer 40 million
miles off screen to move an inch forward". Read on main's `fc8754593` with the freeware's data. The pins are
`test/systems/travel/fb1030d_beatlane.test.js`, the mutants `tools/mutants/fb1030d_beatlane.json` (5, all dead). Written as
page (c); main's DECK-ROAD took it first.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | The ship steers far off the screen to make a little way | Under the Classic helm a journey's tack lane was an angle, and SEA-TAUT made the marks 29 to 43 km away | BEAT-LANE |

## The tack's lane (BEAT-LANE)

FOUND. "Try to have my ship steer" is the journey's hand on the helm (`systems/seaHelm.js`, OWS2 in
`06-Systems/Travel-View.md`). Under sail it steers for the leg's mark. Under the Classic helm a mark in the wind's eye is
beaten up to: a tack is held until the mark's bearing swings 20 degrees past the eye. That lane is an angle, so its
width grows with the mark's distance.

SEA-TAUT (`Field-Bugs-2026-10-29g.md`) pulled a voyage past the Bay taut, so a sea leg is no longer one pixel. Planned
from off Veilhaven to the ports and ruins near it, a voyage's longest sea leg was 29 to 43 km. Sailed by the real Come
Sail Away runtime, the Large Boat beating to a mark 40 km dead to windward stood 9,438 m off the line before it went
about. A pixel's leg of 800 m ran 197 m off it.

FIXED. A tack also goes about once she stands `SEA_HELM.laneM` (400 m) past the wind's line through the mark. The host
tells the helm the metres to its mark (`scenes/world.js` tvSeaSail, `dist`). To the 40 km mark the Large Boat now
stands at most 410 m off the line, and arrives in 9,296 s against 9,248 s before. On a leg under 1.2 km the angle goes
about first, so the Bay's short legs sail as they did.

NOT CHANGED. The Responsive helm, the default, sails straight up to windward (SAIL-FREE) and makes no tack: measured, 0 m
off the line in every wind. The report names no helm, so it was the Classic helm's, or it is still open.

EVERY PROVINCE. The helm reads no map: a leg's mark and the wind. The pins sail a real Eltheric voyage's leg beside a
Bay pixel's. THE FOUR HOSTS: `world.js` wired; `exterior.js`, `worldModes.js` and `dungeonContext.js` raise no journey
at sea, as the Overworld's record says.
