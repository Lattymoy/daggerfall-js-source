# AUDIT PRECIP (2026-10-19) - Biome Precipitation and SKY-ARC, read cold

The owner, of PRECIP1-4 (`07-Rendering/Biome-Precipitation.md`) and SKY-ARC (`07-Rendering/Volumetric-Clouds-Arc.md`):
**"Audit this and ensure perfection. No band aids"**. This page is the audit: the air, what falls, the snow the ground
keeps, the hosts that read it, the ground that draws it, the sky, the record, the pins and the mutants. Each finding has
its verdict here. What it changed is written into the pages it touched, marked `AUDIT PRECIP` with the finding's id, and
in the code beside the fix.

## How it was run

Six lanes, each a cold adversarial reader of a FROZEN head (8959cafe2, a detached worktree - Home.md's DO NOT FIX WHILE
THE VERIFIER IS READING), told to reproduce a finding before reporting it and to end on what it checked and found sound.
ARENA2 was fetched (`tools/fetch-data.sh`) and every lane read the freeware's map.

| Lane | Over | How |
|---|---|---|
| AIR | the air's law, its map, its blend, the latitude, the sea, the jungle's lean, the calibration | 15 findings; the law over every pixel of the map, probes at the Eltheric, the coasts and the borders |
| FALL | the phase law, the word, the front, the mixed fall, the ear and the soak, the sky's cells | 11 findings; the front and the sim driven over the snow line, frame by frame |
| PACK | the snowpack: its levels, rates, melt, year, lattice, skip and costs | 10 findings; a year of the map integrated at the drawn ground, the costs cold and warm |
| HOST | the snow host, its clock, its window, its sweep, the builds' seasons, the hosts' wiring | 11 findings and five nits; Recall, a load, a fast travel and a week's jump driven through the host |
| GROUND | the ground's shader, its twin, the water, the grass, the feet, the Snowfall mod | 9 findings; every terrain and water program compiled and linked in a real WebGL2, the shader run against its CPU twin |
| SKY | SKY-ARC's fix, its two open items, the curtains, the cells, the record | 5 findings, 7 surviving probe mutants (T-1) and the record's DOC-1..7 |

Every finding was verified against the code before anything was fixed.

## What it found, and what was done

### AIR

| Id | Finding | Verdict |
|---|---|---|
| AIR-1 BLOCKER | The air was clamped to the Bay's 1000 x 500 and extrapolated its latitude without bound: the Eltheric Ocean was arctic all year, and the continent past the Bay read the Bay's edge pixel | FIXED: the law's own map (`systems/weather/airGround.js`) - CLIMATE.PAK as the file holds it (`undilated`), the continent and the Eltheric's own composition; the latitude held to the Bay's rows, none in the Eltheric |
| AIR-2 MAJOR | The law's lane was not the map's: with "Weather as places" off the law ran over WEATHER2a's calendar word | FIXED: `precipLawOn` asks `weatherMapOn()` - the map's history is what the snow lies from |
| AIR-3 MAJOR | The air read the kernel's base term alone, 110-900 m under the ground the player stands on - the calibration was not what the player got | FIXED: the air reads the DRAWN ground (`meanGroundField`, `groundTopOf` - the landforms' relief and hills), the means re-fitted at it (AIR-7) |
| AIR-4 MAJOR | The curtain over the player was the share 30-60 km away at the macro ground: one wet hour in ten, rain drawn over falling snow | FIXED with FALL-5/9: each wet cell's share where its fall is nearest the player, at its band's own intensity; the player's own cell the player's share |
| AIR-5 MAJOR | What is heard, what soaks and how hard it falls followed the ROUNDED word; what is drawn followed the share | FIXED with FALL-4: the front's two looks' levels (`rain`, `flakes`) - the ear by the drops, the skin by the whole fall in its shares, the water's rings by the drops |
| AIR-6 MINOR | The player's word carried the client's history (`phaseRound`'s hysteresis) | FIXED: the word rounds the share at its half, pure; every continuous reader reads the share |
| AIR-7 MINOR | `CLIMATE_AIR.row` said "measured median row"; nine of ten were not | FIXED: the rows are CLIMATE.PAK's medians, pinned against the file (ARENA2) |
| AIR-8 MINOR | The air at a place depended on WHICH system was read there, and the map's priority ranked rain over snow | FIXED: one air a place - every band falling there wears the air of the place's whole fall (`wornAmong`'s `air`, the fall's summary) |
| AIR-9 MINOR | The day's swing was damped only while something fell: a 2.7 C step at a rain core's edge | FIXED: damped by the deck's cover, continuous |
| AIR-10 MINOR | Over the open sea the air stepped at the coastal dilation's edge - a snow line drawn 2-3 pixels out, parallel to the coast | FIXED: the undilated climates, and the sea's hand by distance to the coast |
| AIR-11 MINOR | Readers still keyed on the calendar or the word where the place now decides | FIXED: the indoor Snowfall frame reads the snow about the player as the outdoor one does (GROUND-9), the feet the snow under them (HOST-N5). The discrete flags (the songs, Ambient Text, the stir) read the word - pure now (AIR-6) - as DFU's own flags. KEPT: `weatherSunlightScale`'s winter dimming is DFU's calendar law, not precipitation |
| AIR-12 MINOR | The jungle's lean was a 19 C wall 1.5 km wide - its "band of sleet" ~75 m | FIXED: the jungle's air leans over a band of its own, in kilometres (`jungleRegion.js` `jungleAirShare`) |
| AIR-13 NIT | `resetWeatherSim` forgot the law's state | FIXED |
| AIR-14 NIT | A non-finite air fell as snow | FIXED: no air, no snow |
| AIR-15 NIT | The macro height was unbounded above the kernel's ceiling | FIXED with AIR-3: the drawn ground is clamped as the kernel clamps it |

### FALL

| Id | Finding | Verdict |
|---|---|---|
| FALL-1 MAJOR | A snowfall's end relabelled its last flakes as drops | FIXED: the outgoing fall drains at the share it fell at; a dry word leaves the share where the last fall left it |
| FALL-2 MAJOR | Every phase flip of the rounded word was a weather change - a wind front, an episode re-roll, a preset cut | FIXED: the front keys on the SYSTEM (`systemWordOf`, the raw word); a phase alone is no crossing (`weatherPhaseFlip`) |
| FALL-3 MAJOR | A blizzard was drawn four times lighter than its storm | FIXED: the episode's mode from the raw word; the deck's light and the fall's fog at the share |
| FALL-4 MAJOR | The ear and the soak followed the rounded word | = AIR-5 |
| FALL-5 MINOR | A sky cell's cloud swapped whole where its share crossed a half | FIXED (SKY-POP): the cell walks from its warm side to the snow's by its share |
| FALL-6 MAJOR | Every flake jumped where the share crossed one | FIXED: the flakes always aside (`MIX_SHIFT` at every share) |
| FALL-7 MINOR | `drawFall`'s wind origin zeroed a temporary; an array a frame | FIXED: a scratch, the origin on the real one |
| FALL-8 NIT | `?rain=<n>` capped each look, so a mixed fall drew 2n | FIXED: the cap split between the looks |
| FALL-9 MINOR | A sky cell's share was read at a fixed intensity, not its own fall | FIXED with AIR-4 |
| FALL-10 MINOR | Indoors the air was read at the pixel centre's macro ground, and the step out of a door was a live crossing | FIXED: a phase change is no crossing (FALL-2), and the indoor air is read at the place's own ground - a town's planed ground (its buildings' and its dungeon's doors), else the pixel's middle |
| FALL-11 NIT | `?front=off` drew the word's mode with the front's share, which was forced to nought while nothing showed | FIXED: the front's share is the air's (or the outgoing fall's) whether or not it shows; null off the law |

### PACK

| Id | Finding | Verdict |
|---|---|---|
| PACK-1 BLOCKER | Every fragment over a lattice point's `ceil` was white all year: with the landforms the ground stood 1,350 m over the byte-and-600 m guess | FIXED: `ceil` the true bound of the drawn ground (`groundTopOf`) over the pixels a point's cells cover; the levels to 3,800 m (23) |
| PACK-2 MAJOR | The fall was 2.5-4x any climatology | FIXED: rates 1.3 / 3.3 / 0.8 mm an hour, measured against the map's own wet hours - a year's fall 850-1,210 mm on the temperate map, 150-290 mm in the desert (ARENA2-pinned) |
| PACK-3 MAJOR | "No snow in the Iliac Bay outlives midsummer" was false on the enhanced ground | FIXED: a cap (2,000 mm), and a point whose air can keep snow through the summer begins its year from the year before's survival (`meltsOut`, its `spin`) |
| PACK-4 MAJOR | `packNow` showed snow the history never held, then took it back at the step | FIXED: the pack now is the blend of the two step packs about it |
| PACK-5 MAJOR | A region come back to built in the snow of the day the player left it | FIXED with HOST-1, and the window's lines kept for its own points alone (HOST-N3) |
| PACK-6 MINOR | The frame's budget was not a bound (a cold day's discovery in one piece); the costs were warm-memo numbers | FIXED: discovery a walk that pauses a node at a time; the costs re-measured cold and warm (DOC-7) |
| PACK-7 MINOR | The skip held levels no line reads | FIXED: a point steps and holds only its levels up to the one over its `ceil` |
| PACK-8 MINOR | Online, a step sampled four fixed sky hours | FIXED: the day's degree-hours in closed form over the step's own sky interval (`positiveCosIntegral`) |
| PACK-9 MINOR | A clock set back under a step threw away a point and showed the future | FIXED: the step before kept; the year's origin never after the minute |
| PACK-10 NIT | The fall was the worn word's, not the heaviest band's | FIXED |

### HOST

| Id | Finding | Verdict |
|---|---|---|
| HOST-1 MAJOR | `settle` trusted a window read at another minute: a Recall after an evening indoors, or a load, built the player's pixel in the snow of the minute they left | FIXED: one `at(t)` for the frames, a build's wait and the feet; the wait answers only when read at its minute |
| HOST-2 MAJOR | A fast travel built the arrival in the DEPARTURE minute's snow, and the sweep tore the player's pixel down 30 s after landing | FIXED: one clock (`now`) - a trip's arrival minute until its own time has run |
| HOST-3 MAJOR | The sweep was paced in game minutes with a cap: after a jump the world disagreed with its ground for 10-16 real minutes | FIXED: every due pixel at each step, nearest first - a pump's turn each (HOST-7) |
| HOST-4 MAJOR | The Snowfall mod's `winter` was a per-foot 50 % test with no band: every crossing reset the mod's depths | FIXED with GROUND-9 (`winterNear`) |
| HOST-5 MAJOR | The trees, grass, feet and buildings read another snowline than their ground: up to 272 m apart | FIXED: the lattice on pixel corners, the CPU's line the shader's (`lineAt`), its cover the shader's (`snowCoverAt`) |
| HOST-6 MAJOR | The sweep's signature was not what the build wore | FIXED: every decision a build takes kept as it takes it (`recorder`, the entry's `_snow`); a flat the verge refused is never asked (it turned no pixel) |
| HOST-7 MAJOR | On the lane a season's turn was a WHOLE-PIXEL teardown - the terrain, the collider, the doors, the street's people, the grass - and the motor held on the player's own pixel through the build | FIXED: `scenes/pixelBuild.js` `reskinPixelNow` - DFU's `ApplyClimateSettings`, what stands re-skinned in place. Below |
| HOST-8 MINOR | The band's memory (`pixelSeason`) was the client's history | FIXED: no memory - builds read the snow at the last step of the grid (the `build` lines), the same on every client |
| HOST-9 MINOR | `buries` doubled the grass placer's cost | FIXED: asked at the blade's own height, the placer's |
| HOST-10 MINOR | The integration parked 30-184 MB in the sim's births memo | FIXED: the lattice's own memo, let go after a long catch-up |
| HOST-11 MINOR | Every climate's ground was resident four sets over | = GROUND-2 |
| HOST-N1 NIT | A pixel in flight across a lane turn kept the other lane's skin | FIXED: sent once at publish |
| HOST-N2 NIT | The settle's fixed 8 ms slices exceeded the breather's own | FIXED: the breather's own slice (`left()`) |
| HOST-N3 NIT | The lines were never pruned, the ease walked every one ever read | = PACK-5 |
| HOST-N4 NIT | The centre check made points and a clock correction replaced the window's history | FIXED: compared by index, no point made to ask; the clock monotone below a step (HOST-1) |
| HOST-N5 NIT | The feet stepped before the frame's tick | FIXED: `winterAt` reads at the clock's minute itself (HOST-1) |

**HOST-7, the re-skin.** A pixel the snow turns is marked a SKIN (`world/seasonReskin.js`), never a rebuild, and the
nearest one standing is re-skinned a pump's turn at a time (`runSkin`, under the build flag). The build logs what a
re-skin reads (`_skin`, on the lane alone): its flats in the order they stood (each with its own centre, by which a
felled tree is known), its blocks' flat lists, the merge's models, its middle's ground. The re-skin takes the snow's
seasons as a build does (its recorder) and makes again only what wears them: the climate table (`world/texRemap.js`
`reskinRemap` - every mesh the table was asked under a turning law, asked again; a yard's or a farm's, asked meanwhile,
brought in before the trade), the merge through it, the homes' looks, the mills' bodies, and the flats' groups through
the build's own function (`standFlatGroups`) with their forest, cover (traded whole - `ai/cover.js` `staged`/`place`),
far pictures (the new held before the old let go) and animation. A felled tree lies felled in its new picture. All of
it is made aside and traded in one step; a pixel torn down meanwhile lets it all go. A yard stands its pieces again in
the new season (`_skinGen`); the gathering host stands its nodes again (a stump in its season). The pixel's hold keeps
the pictures of both seasons once it has worn both - two, freed with the pixel. The sea's floor wears the lane's ground
(its summer set; the snow is the ground's by its cover), never the pixel's season. The classic lane's calendar flip
keeps the teardown: its ground set and tiles turn with it, twice a game year (R0's motor hold, as before). The Seasons
mod's install refresh and a painted home leaving the merge keep the rebuild: they change what a build lays, not what it
wears.

### GROUND

| Id | Finding | Verdict |
|---|---|---|
| GROUND-1 MAJOR | A twin the PLACE-LRU had let go was still claimed by the draw: the winter texel read from layer 55 of the summer set | FIXED: the winter offsets from the arrays the renderer bound (`_arrLayers`) |
| GROUND-2 MAJOR | The twin was ADDED to the two sets it was made from: the ground's GPU memory tripled per climate | FIXED: on the lane the twin IS the set - one 112-layer upload |
| GROUND-3 MAJOR | The ground's snow field existed only in GLSL | FIXED: `snowCoverAt`, its CPU twin (slope and patches), read by the grass and the feet |
| GROUND-4 MINOR | The ground's snowline and the host's were different functions inside a pixel | FIXED with HOST-5 |
| GROUND-5 MAJOR | Under the snow the water drew the SUMMER puddles over the winter art | FIXED: the bed's and the sheet's masks mixed by the cover |
| GROUND-6 MINOR | A border fragment computed ECOTONE1's weights twice | FIXED: once, handed to both |
| GROUND-7 MINOR | Six uniform uploads per terrain draw, unshadowed | FIXED: the frame's lines one small texture (`setSnowFrame`), shadowed per program |
| GROUND-8 MAJOR | The patch mask was not band-limited: the far snowline boiled | FIXED: each octave fades with the fragment's footprint |
| GROUND-9 BLOCKER | The Snowfall mod's snow overdrew the snowline wherever the player stood in snow | FIXED: its surfaces laid by the ground's own cover where they lie (`snowLaid`: depth and coverage), its `winter` whether snow lies on any ground the window holds (`winterNear`) |
| OPEN | The far ring carries no season (DFU's winter left it green too); a pack's snowless winter set (SNOWLESS1) | OPEN, named in the record |

### SKY

| Id | Finding | Verdict |
|---|---|---|
| SKY-BAND MAJOR | SKY-ARC's (a): the far slab the walk never reached was left bare to the dome - a stair-stepped band at the horizon | FIXED: the walk's rest laid in the horizon's colour by its own length (`farA`); the early-out the same law |
| SKY-HZN MAJOR | The clouds faded into the clear base's horizon, not the sky's | FIXED: under Dynamic Skies the mod's fog greyed by the player's eased row (`skyRow`); the port's dome its own horizon |
| SKY-CAP MAJOR | SKY-ARC's (b): a sun-coloured cap in the far haze - the shadow map's square clamped in metres, a crossing's strips left all light | FIXED: the edge read in its own UV (`cloudShadowNearest`); the strips marched in the same update |
| SKY-2 MAJOR | The curtains still faded by where a piece began: two hard lines | FIXED: every veil sample in its own aerial perspective (`veilPiece` answers depth and its faded share); front and back pre-faded |
| SKY-3 MAJOR | The lane's curtains lost their envelope | FIXED: the fall set before the growth |
| SKY-POP MAJOR | A wet system's whole cloud switched profile at the share's half | = FALL-5 |
| T-1 | Seven probe mutants survived: the back veils' fade, a snow front's warm side, the envelope either way, the day's damping step, a cell's share at full chill, the haze's far edge | FIXED: each held by the new law's own test and record - the back by SKY-2d, the envelope by SKY-3 both ways, the damping by AIR-9, the share by FALL-9, the far edge by SKY-CAP in fp32, a snow front's warm side by SKY-POP's own |

### DOC

| Id | Finding | Verdict |
|---|---|---|
| DOC-1 MAJOR | SKY-ARC's record said the horizon band was the mod's ungreyed fog; it is the dome through transparent rows | FIXED: the record and Active-Arcs say what it was (SKY-BAND) and what greying fixes (SKY-HZN) |
| DOC-2 MINOR | "Its colour was the horizon's: warm at dusk" - the warm side is the side faded less | FIXED |
| DOC-3 NIT | "4 Morning Star" for minute 525200 - the 5th | FIXED |
| DOC-4 MINOR | The haze's strip fix described as extending the old map's edge | FIXED: marched in the same update |
| DOC-5 MINOR | "No merge or split of spans can draw a line again" - false while SKY-2 and SKY-BAND stood | FIXED in the record |
| DOC-6 MINOR | Biome-Precipitation's sky paragraph | FIXED: each wet cell's share where its fall is nearest the player; its cloud and its curtain walk by it |
| DOC-7 MINOR | The cost table: warm numbers only, the cold boot unstated, Wayrest outside the ranges | FIXED: measured again cold and warm at four places (the record's table). The audit's own laws cost what they cost - PACK-1's true `ceil` holds levels on the landforms' hills where the old guess let whole steps skip, PACK-3's summer before integrates a second year where it cannot be ruled out, PACK-8's day is integrated over its sky hours: Daggerfall's window 566 ms cold on the frozen head, 1,205 now. Two exact savings (`systemsSpanWalk`: one walk of the weather map a day of steps, its fronts' cells drawn the first time they come near; `drawCells` thinning a candidate by its season's ceiling before its place is read), and a build's wait taking the arrival's budget while the world stands up (`SNOW_COVER.arriveMs`, as the frame's own tick): by the slices' arithmetic at sixty frames a second the boot's wait for the snow is Daggerfall's 1.7 s as it was, Wayrest's 2.3 s now 3.0 |
| nits | "random minutes of eight years" (ten); "the Alik'r never sees a flake" (the Alik'r region's mountain fringe does, 0.2 % of its winter wet hours) | FIXED |

### The author's

| Id | Finding | Verdict |
|---|---|---|
| A-1 | The full suite on the branch: the pins quoting the code HOST-7 and GROUND-2 moved (the groups' loop, the merge's adds, the layers' home, the census's clock rows, a wet-fall cite) | FIXED: each moved, `PIN MOVED` beside it. The full suite after the push found two more: the build's new helpers (`groupFlats`, `placeTrees`) stood above its constructor, and BOOT-TDZ2 (`test/scenes/bootorder.test.js`) reads a moved module's first exported function as its constructor - they stand after it now; PERF7's pin read the host's first breath as the model loop's, and the flat groups' shared loop breathes above it - the pin reads the first after the loop |
| A-2 | Three ARENA2 data pins fail with the fetched ARENA2 (`it1_worlddata`, `wd1_worlddata` - a gate patch's sha256; `fb1004d_cratefree` - the real markers) - and at the audit's frozen head too | NOT THIS SLICE'S: the fetched files are not the ones those pins were written against |
| A-3 | A mutant written for HOST-7 (the catch-up never asked) looped for ever | FIXED: rewritten so the loop ends; its verdict a test's, never a timeout's |
| A-4 | Writing the record: `snowlineOf` clamped every crossing to a metre over the point's ground top (`LINE_CLEAR`) - a stand-in from before PACK-7, when levels over the top were held but not skipped exactly. Wherever the line's next crossing stood over the ground, its slope was drawn up to the ground's top: on the freeware's map a hill's top in the snowline's band read up to 0.36 more cover than the line its levels give (Wayrest, Daggerfall and the Wrothgarian in winter) | FIXED: the held levels' crossings as all the levels read them - the levels to the one over the first at or above the top hold every crossing under it and the next over it within a level - and one they never reach a level over the highest held. Measured at Daggerfall, Wayrest and the Wrothgarian on four days against the pack's own cover at every height of their ground: the clamped line missed it by up to 0.38; the held levels' line misses it as the line of all 23 levels does in eleven cases of twelve, and by 0.125 against 0.080 in the twelfth (the three-crossing line's own approximation, up to 0.32, is PRECIP3's representation and stays) |

## After

Tests: `precip1_air` 18, `precip3_snowpack` 12, `precip4_snowground` 18, `audit_precip_sky` 8, `audit_precip_host7` 8
(Suite 30,531 across 3,531 files).
Mutants: `tools/mutants/audit_precip.json` (the audit's own), `precip1.json` (one recorded equivalent), and the records
of 32 other lists re-aimed by content - all dead. Code: the air's map (`airGround.js` new), the air, the front, the sim,
the map, the snowpack, the snow host, the ground's and the water's shaders, the renderer's snow frame, the Snowfall mod's
surfaces, the sky's march and its bridge, `pixelBuild.js` (the re-skin), `texRemap.js` (the recipe), `ai/cover.js` (a set
built aside), `seasonReskin.js` (the skin), `world.js` with `bootWorld` under its ceiling. Not checked here: the frame
time on a GPU.
