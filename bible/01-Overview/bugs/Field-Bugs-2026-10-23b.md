# FIELD BUGS 2026-10-23b - the desktop app's first-use freezes, every launch

One thread from the Discord's #tech-support, handed over as two phone screenshots. SeQueL: "Seems like the freezing /
loading is getting worse every day ... It happens the 1st time I do anything - open my inventory, map, etc. Then once
it freezes and does its thing and comes back it doesnt do it for that action again until I close the game and
restart. The load/freezing can last 3-10 seconds ... Teleporting to a Dagon Breach is the worse, entering the breach.
Entering dungeons, or a city ... I am running a texture pack and using the client. Both of my friends are experiencing
the freeze to different degrees. All with higher end computers. Could be a caching problem." Beneath it, Leonardo Vita:
"i literaly now tested in browser and there has no problem. tried clean all files and re install and not work"; and
Palmin: "Vendor tab also lagging. And worldmap. Also when you completing work in Notice Board it takes around 5
seconds". Read on main's `2cde8b02f`, with the freeware's data (`tools/fetch-data.sh`) and the desktop shell itself
(Electron 42.11.8 over the built `dist/`, under xvfb). Named 23b: main's `Field-Bugs-2026-10-23.md` took 23. The pins
are `test/tooling/fb1023b_gpucache.test.js`, the mutants `tools/mutants/fb1023b_gpucache.json` (5, all dead).

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "the 1st time I do anything ... until I close the game and restart"; "in browser ... no problem"; "re install and not work" | Chromium keeps every WebGL program it links, in memory and in `<userData>/GPUCache`, both capped at 6 MiB. On Windows a kept program is ANGLE's D3D11 binary, several times its GLSL, and one town's boot links 111 programs from 2.4 MB of GLSL: the cap is passed in the first town, the rest are evicted, and every launch compiles them again | GPU-CACHE |
| 2 | "Vendor tab also lagging. And worldmap"; "completing work in Notice Board it takes around 5 seconds" | Not reproduced: the windows' first opens were not driven in the shell here (below, Not measured) | asked of the player |

## GPU-CACHE (1) - `01-Overview/Desktop-App.md`, The GPU's kept programs

WHAT THE REPORT SAYS. Three things narrow it before any code is read. A freeze once an action and then never again
is a cost paid once a session; one paid again after a restart is a cost nothing keeps between launches; one the
browser does not pay is the app's own. A reinstall keeps `<userData>` (it is the player's saves), so it changes
nothing either way. And "seconds" on "higher end computers" is a compile: the gate's fire took 11.43 s on a player's
D3D11 driver before SHADER-STALL (`07-Rendering/Performance-Priority.md`), where SwiftShader takes milliseconds.

WHAT THE APP DOES NOT KEEP. A WebGL program is compiled by the GPU process. Chromium keeps the linked binary (the
passthrough decoder's `PassthroughProgramCache`, through ANGLE's blob cache) and writes it to `<userData>/GPUCache`,
so the next launch links from it instead of compiling. Both stores are sized by `GetDefaultGpuDiskCacheSize`
(`gpu/config/gpu_preferences.cc`): `kDefaultMaxProgramCacheMemoryBytes`, 6 MiB, unless the `gpu-disk-cache-size-kb`
switch says otherwise. On Windows the binary is ANGLE's D3D11 one, and `ProgramExecutableD3D::save` writes each
stage's translated HLSL and the bytecode of every vertex and pixel variant compiled so far: several times the GLSL
it was made from. Measured in the shell over the freeware data (Knightstale, the probe's `knight` scene): the boot
links 111 distinct programs from 2,459 KB of GLSL. So a Windows player passes the cap before leaving the first town;
every program met after it (a dungeon's, a breach's, a window's) is kept by evicting an older one, and the next
launch compiles what was evicted. "Worse every day": the game adds passes every day. Chrome does not show it: on
Windows it runs a newer cache by field trial (`GpuPersistentCache` in Chromium's `fieldtrial_testing_config.json`),
which a Chromium embedded without Google's field trials, Electron's, never gets.

FIXED: the shell sizes both stores to 128 MiB (`app/main.cjs` GPU_CACHE_KB, the `gpu-disk-cache-size-kb` switch),
before the app is ready, as every switch. The memory holds what was kept, not the cap; under memory pressure the
program cache trims itself as before. The browser build is untouched.

MEASURED, in the shell (Electron 42.11.8, SwiftShader under xvfb, ANGLE's parallel compile on): two launches over one
`<userData>`, every program link the page waited on summed (`tools/compileStallProbe.mjs`'s GL_WAITS):

| The cap | First launch | Second launch |
|---|---|---|
| Chromium's 6 MiB | 2,636 ms | 1,495 ms |
| 1 KB, on the command line | 2,614 ms | 2,581 ms |
| 1 KB, through `app/main.cjs`'s switch | 2,010 ms | 2,592 ms |
| 128 MiB, through `app/main.cjs`'s switch (as shipped) | 2,613 ms | 1,411 ms |

So the app's Chromium does keep programs between launches, the switch decides how many, and the shell's own
`appendSwitch` reaches it. SwiftShader's binaries for the town fit 6 MiB (the second launch gains as much at 6 MiB as
at 128), which is why the table shows the law and not the player's freeze: D3D11's binaries are the ones that pass it,
and D3D11's compiler is the one that takes seconds.

NOT MEASURED. A player's Windows machine: the size of the game's D3D11 binaries, and the freezes after the fix. Until
the release reaches them, a player can try it on the app they have: Chromium reads its switches from the command line
too, so `--gpu-disk-cache-size-kb=131072` added to the shortcut's target does the same thing. The first launch after
it compiles once more; the launches after it should not freeze on what an earlier session already did.

WHAT IT DOES NOT TAKE. The first-ever compile of each program, on the first launch after the fix and after a driver
update (ANGLE refuses a binary made by another adapter or driver). A pass built in play where the driver cannot say
when its compile is done still holds that first frame; SHADER-STALL, AURA-STALL and FIRST-USE moved the passes play
meets behind the door that does not wait, and the rest are named there.

## The windows (2)

Not reproduced. The probe's in-world key presses did not open the windows (the overlay seam the probes read is the
classic dungeon's alone), and SwiftShader's compiler cannot show D3D11's costs. If the Vendors tab, the travel map
and a Notice Board work's completion still hold their first open after GPU-CACHE reaches the players, the next step is a
CPU profile of the player's own client through the shell's `--remote-debugging-port` (STORE-CACHE's recipe,
`07-Rendering/Performance-Priority.md`).

THE FOUR HOSTS: none is wired here. The change is the desktop shell's, before any page loads; `scenes/exterior.js`,
`scenes/world.js`, `scenes/worldModes.js` and `scenes/dungeonContext.js` are untouched.
