# AUDIT 47 - ENHANCED ENVIRONMENTS, THE WHOLE ARC (2026-09-02)

Mac: a comprehensive audit across everything, before the polish.

Method, as the arc's own law: measure and sweep, argue only about
what comes back. Every gate the plan names was run on the finished
tree; three static sweeps were added for the fault classes that bit
the first attempt.

## The sweeps

**Every shader declares what it uses.** A reader walks every
`#version 300 es` template in the three shader files, expands the
shared cloud block the way the template does, and lists every `u*`
token used against every `uniform` declared. All twelve templates
clean. This is the fault class that black-screened the first
attempt, and it is a pin now (glstate.test.js), with a mutant.

**One door to every cache.** No file outside the renderer touches
`tileArrays`, `tileNormals` or `tileGrass` directly: 0 hits. This is
the fault class that BLACKED the first attempt's ground - a cache key
changed in one file and its readers in two others never looked for.

**The upload law.** uploadTileArray, uploadTilemapTexture,
createGrass and updateFieldRows: none draws, binds a framebuffer,
clears, sets a viewport or changes the pipeline. This is the fault
class that broke every texture in the game the first time.

**Every enhanced term hangs off the one switch.** The ground mode,
the grass, the field, the precipitation profile and the cloud shadows
each read `isEnhanced() && getPref('enhancedEnvironments')` or the
sky object that only exists under it; the classic skin's frame is
lit at a terrain median of 90.7 and carries none of them.

**Every kill switch is present**: ?ground=classic|tiles|drawn,
?grass=off|<n>, ?field=off, ?rain=<n>, ?weather=<type>,
?season=<name>, ?sky=classic. Every arc hunk in a shared file is
marked EE<n>: 27 in world.js, 9 in exterior.js, 2 in shared.js, 1
in the menu.

## Findings

**F1 - A UNIFORM WAS INJECTED BY A STRING REPLACE.** The grass vertex
shader's `uLightDirW` was added by `.replace('uniform vec3 uCamPos;',
...)` AFTER the template, so no reader of the template - mine
included, on its first pass - could see it declared. It worked, and
it was exactly the kind of thing that stops working when someone
edits the line it keys on. Declared in the template now; the pin
forbids the pattern.

No other finding. Two earlier faults in this arc were found and fixed
by the gates inside their own slices (EE8's precision mismatch, EE9's
crash and empty record), which is the gates doing what they were
built for.

## The parity ledger, closed out

| lab system | in the game | slice |
| --- | --- | --- |
| the sky's shader, four fixes, sunset band | yes | EE2 |
| ground sampling: sized, mips, anisotropy | yes | EE3 |
| drawn surfaces, colour-matched, residuals, roads | yes | EE4 + ROADS |
| cloud shadows from the sky's own deck | yes | EE5 |
| normal map from the surfaces' height, detail read | yes | EE6 |
| instanced grass, lit, fogged, thinning with range | yes | EE7 |
| weather volume, integrated wind, streak, head | yes | EE8 |
| surface field: base + storm + melt + prints | yes | EE9 |
| winter ground = summer materials under the field | yes | EE9 |
| rain ripples on standing water | NO | polish |
| puddle Fresnel reflection | NO | polish |
| one wind shared by grass, rain and deck | PARTLY - rain and deck share the sky's wind; the grass sways on the deck's direction but its own gust | polish |
| the lab's front (eased weather) | not ported, by design - the game has its own | - |
| the lab's ray convention fix | not ported, by design - it was a lab bug | - |

## Costs, stated

The drawn tiles build on the main thread at world entry: ~0.7s for a
temperate climate, ~1.3s for a winter one with its residuals. A worker
would hide it; it is not hidden today. The field is ~7MB a near-ring
pixel and ticks one pixel a slot. The grass is ~270k blades across the
near ring in a temperate summer.

## Gates, this audit

bootProbe BOOT OK; check green; worldRenderGate enhanced (terrain
104.7) and classic (90.7); the grass census and the field census
passed inside their slices and nothing they cover has changed since.
