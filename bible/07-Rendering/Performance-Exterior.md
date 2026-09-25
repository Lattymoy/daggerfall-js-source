# PERF-EXT — the exterior's frame, made fast in code

*2026-09-25. Two players, relayed by Mac: "fps issues in the exterior but
fine in the interior" (an RTX 4060 Ti), and "me too my friend.. don't know
why. I got a RX6600". PERF-SCALE (`01-Overview/Field-Bugs-2026-09-25.md`)
gave them a render scale and a counter that names the GPU; Mac then:
"Why are you so avoidant when it comes to addressing performance issues? I
am not getting another player to do the work that youre suppose to do".*

This pass was found and proven before it was written: each change below
was measured on the real modules by one lane and re-measured against it by
another, and each landed only with the same harness re-run on the change.
The harnesses are node scripts over the real modules on a recording fake
GL (and, where the question is about the browser's frame, headless
Chromium); there is no game data in the container, so where a size depends
on ARCH3D it is a synthetic one and the ms scale with the real count. All
timings are one 4-core 2.1 GHz Xeon; a gamer's desktop is 1.5-2x faster,
and the RATIOS are the claim.

## Cluster C — the streaming hitches

The frames that freeze when you cross into a new map pixel or ride into a
town. Nothing in `?perf=cpu` showed them: the steady frame is what it
measures, and these are the frames around a crossing - every ~3 minutes
on foot, oftener riding - which is exactly the "fine indoors" the players
describe (an interior streams nothing).

### PERF-EXT-C1 — the grass field's slot count is swept once

`discSlotCount` (render/labGrass.js, PERF10) answers how many 30 m cells
the grass's disc can hold - 394 for the shipped span, a pure function of
(radius, cell, steps) - by a 240-step sweep that takes 11-33 ms. Every
`createGrassField` paid it: the boot, every teleport and quickload, and
every pixel crossing, on the crossing frame itself (`crossingFrame.mjs`:
createGrassField 7.6-11.0 ms of that frame, almost all of it the sweep).

The sweep runs once per question now and a module memo answers the rest;
the world warms it at mount (`if (labGrass) discSlotCount(LAB_GRASS.span)`,
beside the renderer), so no gameplay frame pays even the first. The memo
is labGrass.js's, one entry per distinct (radius, cell, steps) - the game
asks one. Same answer: grasspath.test.js still holds it against the brute
force.

| harness | before | after |
|---|---|---|
| `discSlot.mjs` - discSlotCount(315), three calls | 22.2 / 12.3 / 11.5 ms | 28.1 (the one sweep - the world pays it at mount) / 0.01 / 0.00 ms |
| `crossingFrame.mjs` - createGrassField on the crossing frame, six crossings | 10.6 / 11.0 / 8.2 / 7.8 / 7.6 / 7.7 ms | 0.1 ms each |

Pins: `test/grassshift.test.js` C1 (the sweep counter: two fields, at most
one sweep; four distinct questions, four sweeps; the world's warm).
Mutants: `tools/mutants/perfextc.json` C1 x4, all dead.
