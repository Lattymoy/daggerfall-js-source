# FIELD BUGS 2026-10-27 - a freeze of 10-15 seconds shortly after login, on the desktop app

One thread from the Discord's #general, handed over as two phone screenshots. Artkin, with a screenshot of the game:
"top right 13000ms of freeze happens whenever I start the game recently ... "hitch 13000ms"". Asked "Desktop client?":
"yep". Then "our game freeze for 30s at a time". AustinHale: "I get similar ... A good 10-15 sec lockup shortly after
first login". Read on main's `66d40e084`, with the freeware's data (`tools/fetch-data.sh`). The pins are
`test/render/compilequeue.test.js`, the mutants `tools/mutants/compilequeue.json` (11, all dead).

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "13000ms of freeze happens whenever I start the game recently"; "A good 10-15 sec lockup shortly after first login" | The renderer's idle warm started all 26 programs play meets at once, 1.7 MB of their 1.8 MB of GLSL the auras' fifteen looks. The warm's next step, a build that reads its link, waited until the driver's few compile threads had done them all. It ran in an idle callback, outside every frame | COMPILE-QUEUE |

## COMPILE-QUEUE (1) - `07-Rendering/Performance-Priority.md` COMPILE-QUEUE

WHAT THE COUNTER SAYS. The screenshot's FPS counter (FB1018D HITCH-KEEP) reads "hitch 13064 ms 4 s ago 4 a minute",
and under it "script 8 frame 6 before 2 stream 0": the frame before the gap was an ordinary 8 ms one. So the 13 seconds
were spent between two frames, in work no host stamps: a timer, an idle callback, a promise's continuation, or the GPU
process. Its GPU line names a GeForce RTX 3060 Ti under ANGLE's Direct3D 11, whose compiler took seconds over single
passes before (SHADER-STALL, AURA-STALL). "Shortly after first login" is when the renderer's idle warm runs, and
"recently" fits the warm's queue: the auras' look programs joined it on 2026-10-22 (AURA-SPLIT) and the fifteenth, the
Sage's Smoke, on 2026-10-26 (NIRNROOT-SAGE).

WHAT WAS DONE. The passes play meets are started one at a time, the next once the driver says the last is done. A build
that reads its link now waits behind one of them at most. Measured on ANGLE here: the warm's next build took 342-734 ms
behind the old start and 9-17 ms behind the new one, against 6-7 ms alone. The section in
`07-Rendering/Performance-Priority.md` has the mechanism and the measurements.

NOT MEASURED. A player's Windows machine, before or after. Whether the freeze comes back at every launch because
Chromium's program cache misses (each update that touches an aura look changes all fifteen of its programs) is not known
here.

THE FOUR HOSTS: none is wired. `scenes/world.js` and `scenes/exterior.js` start the queue through the renderer's idle
warm (`render/renderer.js` lazyWarmSteps), unchanged. `scenes/worldModes.js` and `scenes/dungeonContext.js` start none
of these programs.
