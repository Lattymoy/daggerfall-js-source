# AUDIT BANTHA1 (2026-10-18) - the Jungle of Bantha, read cold

The owner, of BANTHA1 (`03-World/Bantha-Jungle.md`, at 7e5e73b58): **"These textures are ours"** and **"Also do a
comprehensive audit on this"**. This page is the audit: the slice's trees, layout, field, haze, hosts, cost, record,
pins and mutants. Each finding has its verdict here. What it changed is written into the pages it touched, marked
`AUDIT BANTHA1` with the finding's id, and in the code beside the fix. The first sentence is recorded where the slice
left it open: the five pictures are the owner's own, no ARENA2 pixel in them (7c0ce43d0 - the doctrine's SUPPLIED rows
and the record).

## How it was run

Six lanes, each a cold adversarial reader of a FROZEN head (7e5e73b58, a detached worktree - Home.md's DO NOT FIX WHILE
THE VERIFIER IS READING), told to reproduce a finding before reporting it and to end on what it checked and found sound:

| Lane | Over | How |
|---|---|---|
| LAY | the field, the four storeys, the border, the species, the glades, what the jungle never stands on, the cost line | 12 findings and a risk; probes over synthetic pixels and the field against a brute-force search (0 mismatches over 2,400 pixels) |
| TREE | the owner's files to the screen: the reader, the measures, the far picture, the door, the two slots, cover, Logging's nodes, the season | 9 findings; the files re-read and re-measured, the door over the real files, the cover index weighed |
| HAZE | the haze's law and its shader twin, every program that takes the fog block, the sky, the ring, the cull's bound | 12 findings; 117 programs compiled and linked in a real WebGL2 (headless Chromium), the law against a fine sum |
| HOST | the jungle's and the trees' hosts, the floating origin, a teleport, the switch, Logging online, the locales | 9 findings; the hosts driven over the stream's own translation law |
| PERF | what it costs: the worker, the main thread, the heap, the GPU's draws, outside Bantha and in | 11 findings; measured, never estimated (SwiftShader for the GPU's share, said so) |
| DOC | the record's every claim, the tests and the mutants | 21 findings; the 42 records and the 24 re-aimed ones run, 36 probe mutants of its own, 258 test files around the change |

Every finding was verified against the code before anything was fixed. The DOC lane said, unasked, that it broke the
hands-off rule for about ten minutes: a mutation run judged ten mutants IN PLACE in the snapshot (three of its tests
need the repository's git, which a mutation workspace has not), so a lane running tests on `jungleNature.js`,
`jungleHaze.js`, `jungleHost.js` or `hazeGlsl.js` in that window could have read a mutant. The snapshot was restored
whole (`git status` clean, no backup left), and no finding below rests on that window alone - each was reproduced
again on the branch before its fix.

## What it found, and what was done

### HAZE

| Id | Finding | Verdict |
|---|---|---|
| HAZE-1 HIGH | The Burning Court's Deadlands no longer built: the fog block now carried `uniform vec4 uHaze[2]` and the Deadlands' sea declared its own `uniform vec3 uHaze` under it - a redefinition (`new DeadlandsRenderer` threw). The repo's GLSL reader took the duplicate | FIXED: the jungle's uniform is `uJungleHaze` everywhere; every program a module under `src/render` exports is compiled whole in the reader, a redeclared uniform a type error there |
| HAZE-2 HIGH | Programs kept the jungle's haze after it went off: what had been sent was kept on the LOCATION TABLE, and `_installWorldSet` makes every table anew (FAR-CLIP1's variant, a panel, RW1's view out) - the off never reached a program that held it on | FIXED: kept by the GL program (`_hazeOn`, a WeakMap) |
| HAZE-3 MED | 22 passes compiled the haze in their fog block and never uploaded it - a node's glow, an aura ring, the spoils, the gate, the rite's smoke, the Abyss's omen and a foe's telegraph glowed through the haze; the spell sparks' caller handed no haze | FIXED: the seven exterior passes take it, every fog a host hands a pass carries it; the sixteen drawn only in a mode's frame (the Court, the Abyss's realm, the Breach's halls) named in the test, which fails a new fogged pass that does neither |
| HAZE-4 MED | The cull took the weather's fog with the haze, and the weather's linear fog ends at 2.4 km - it removed sea the water still drew | FIXED with HOST-4 |
| HAZE-5 MED | A vertical recentre of the floating origin (the eye 500 m up) thickened the haze for seconds | FIXED with HOST-2 |
| HAZE-6 LOW | A window's view out (RW1) kept the street's fog but not its haze | FIXED: kept with the fog, armed for the view's frame |
| HAZE-7 LOW | Underwater, the air's haze stacked on Deep Waters' own fog | FIXED: `jungle.under(sky)` - off with the air's |
| HAZE-8 LOW | The domes graded the haze twice under the live event's dread or the Hollow's brass: its colour is the frame's fog colour, graded already | FIXED: each dome mixes it after its grades |
| HAZE-9 NIT | "Off the jungle no frame pays a uniform call" - the ring, the sky and the passes send theirs with each draw | FIXED in the record: the renderer's own programs pay none; the rest a call a pass. The commit message stands as history |
| HAZE-10 NIT | `jungleHost.js` said `hides` served the far ring too | FIXED: the pixel gate is its one caller |
| HAZE-11 NIT | Every jungle frame allocated | FIXED with HOST-8 |
| HAZE-12 NIT | The host measured from the head, the fog from the rendered camera | FIXED with HOST-7 |

### HOST

| Id | Finding | Verdict |
|---|---|---|
| HOST-1 HIGH | Walked out of Bantha (never a jump), the host told the renderer none but kept its own uniforms - and `hides` reads them: the haze's cull stood on over the whole map for the rest of the session | FIXED: off zeroes them; a walk out pinned, nothing hidden anywhere |
| HOST-2 MED | The haze's state lived in the scene's frame and the host is no floating-origin holder | FIXED: the state in the WORLD's frame (pixel and metres, the origin's height taken off); the floor goes back into the scene's as it is sent |
| HOST-3 MED | A teleport, fast travel, Recall, load or respawn did not snap: the stream re-bases the scene, and the eye moved less than the jump law's 250 m in it | FIXED by HOST-2: the jump is measured in the world |
| HOST-4 MED | At the haze's fringe the cull hid land by the weather's fog and the sky showed in its place (the weather's fog never fogs the sky) | FIXED: the haze ALONE - what a hidden box leaves is the sky, whose haze along that ray is at least the box's own |
| HOST-5 MED | Nine exterior passes unhazed | = HAZE-3 |
| HOST-6 LOW | Where the owner's files failed to load, the verge cleared a road by the Tree record's reach and not the tree's foot - a client's Logging trees stood elsewhere than its room's; and the failure was the session's | FIXED: the foot whether or not the files loaded (LAY-5), the door asked again on BUILD-RETRY's backoff (TREE-6) |
| HOST-7 LOW | The haze and its cull measured from the head; the fog from the frame's eye | FIXED: `mwv.eye` |
| HOST-8 NIT | `haze()` allocated every frame, even far from Bantha | FIXED: scratch objects throughout |
| HOST-9 NIT | The row's "takes effect when the world next loads" shows in English in tr, uk, vi, zh-Hans and zh-Hant | RECORDED: before the slice - sixteen rows read the key, and those five machine languages each still owe thousands of rows, which fall back to English the same way; the next drafting run takes it |

### TREE

| Id | Finding | Verdict |
|---|---|---|
| TREE-1 HIGH | The jungle broke the cover index's cost: a crown 7-15 m across was filed in every 4 m cell it touched - 134,000 entries, 10 MB and 40-80 ms a pixel, in one synchronous call per build; 1.4 GB for a 121-pixel Bantha view | FIXED: a proxy wider than a cell is filed once, in a 32 m grid of its own (`COVER_WIDE`), and `hit` walks both - the same answer on every ray; the add sliced through the build's breather (`COVER_SLICE`). Measured: the add 37 -> 8.7 ms a pixel (median) |
| TREE-2 MED | A whole 22 m tree took its sun from one shadow tap at its root | FIXED: a jungle tree reads it at its crown (`uSunLift`, `JUNGLE_SUN_LIFT` 0.6 of its height), its far picture and its 3D tree alike; Low Poly Trees' and every flat's unchanged |
| TREE-3 MED | Logging's node glow stood 0.6 m out of the root - inside a banyan's trunk or its curtains | FIXED: a jungle tree's mark stands out of its trunk, or where its crown hangs to the ground its foot, at its scale (`jungleTreeMark`); the glow takes a mark's own pull |
| TREE-4 MED | In winter the jungle stands on snow (the Rainforest climate is Swamp-based - its ground 403) and the record did not say so | NAMED: a departure in the record and the Ledger - DFU's rainforest does the same with its palms; SNOWLESS1's Snowless Swamps and Jungles is the door that takes the snow off; a winter of the jungle's own is the owner's call |
| TREE-5 LOW | The banyan's and the flame tree's trunk was a default 0.5 m: their crown begins at the foot's top, so the trunk's window was empty | FIXED: a band of 3 m above the foot (`TRUNK_BAND`); the table re-measured (banyan 1.44, flame 0.43) |
| TREE-6 LOW | One failed fetch left the session on Tree records | FIXED: BUILD-RETRY's backoff |
| TREE-7 NIT | Reader edges no file of the owner's reaches: a second material, a comment after a face, a map's options | FIXED: a tree is one material (a second throws), comments and options read past |
| TREE-8 NIT | "One tree stood 34 m off the origin" (they stood 7 to 53 m off); "its light and its faces agree again" (nothing drawn reads the winding) | FIXED in the record |
| TREE-9 NIT | The jungle's door made two buffer calls a frame for the rest of the session with no tree near | FIXED: none to show, none shown - no upload |

### LAY

| Id | Finding | Verdict |
|---|---|---|
| LAY-1 MED | The species' groves broke at every pixel edge: a grove cell of 24 tiles is off the world's lattice (`ecoNoise` assumes a cell dividing 128) | FIXED: 32; the groves and the stands read across every edge in the test |
| LAY-2 MED | A hillside between 34 and 50 degrees was bare: the trees' 34 dropped the pixel's own flats AND every storey | FIXED: the trees alone at 34; the palms and the floor to DFU's 50 |
| LAY-3 MED | A town's clearing grew the jungle's thickest saplings: the places' pull read as LIGHT, and light is a gap's | FIXED: a place's fields are open ground - no canopy, young tree or palm; the floor by the glade's light alone |
| LAY-4 MED | With Real forests off, jungle trees stood in World of Daggerfall's rock pieces and round a site's camp objects | FIXED: the site's footprint and the rocks for the jungle too |
| LAY-5 MED | = HOST-6 | FIXED there |
| LAY-6 MED | The crown's cover took its whole reach; TACT1's rule is 0.7 of it | FIXED (`JUNGLE_CROWN_COVER`) |
| LAY-7 LOW | A young tree or a palm at a pixel's edge crowded a neighbour pixel's trunk | FIXED: a neighbour's trunk read off its own pure tile hashes |
| LAY-8 LOW | The field answered float64 on a pixel's first read and float32 after - a build's result hung on build order | FIXED: the stored float32 every time |
| LAY-9 LOW | The border was each tile's white noise, not the stands the record said | FIXED: ECOTONE1's patch law (`jungleStandNoise`) |
| LAY-10 NIT | The Cost line was the test's synthetic ground, not "a pixel wholly jungle" | FIXED: re-measured on whole grass - about 13,700 flats, ~11 ms on the worker (Real forests' mean 6,200, DFU's scatter 9,200) |
| LAY-11 NIT | "68% in a glade" (a glade is a gap: about 60%), "never within 2.2 m" (at the trunk's scale), "the canopy may close over [a road]" (the crowns lean 0.4-3.1 m over its sides) | FIXED in the record |
| LAY-12 NIT | A canopy tree the main thread drops later (a road's clearance, the gate's) still shapes the young trees about it | ACCEPTED: a few young trees fewer beside a road, under a crown that is gone; the worker cannot know the main thread's clearances without moving them onto it |
| RISK | Nothing in the tree shows a pixel of region 10: DFU's travel map gives Bantha no page (`10-UI/UI-Arc.md`, with the wildernesses and the coast strips), its race is the Redguards', and the jungle lays the rainforest's law over whatever climate it finds | CONFIRMED (2026-10-18, the freeware's own data - `tools/fetch-data.sh`, then `tools/jungleExtent.mjs`): **region 10 holds no pixel of POLITIC.PAK and no place in MAPS.BSA** - a name in Daggerfall's region list the map never paints. The jungle as built stands NOWHERE. Due north of Daggerfall city (207, 213) the land is Daggerfall's own to y 150, then Glenpoint (region 18: 6,759 pixels, 445 places, Mountain Woods); **FIXED, the owner's call (2026-10-18): Glenpoint** - `JUNGLE_REGIONS` is region 18; the player's row and its 25 languages name it |

### PERF

| Id | Finding | Verdict |
|---|---|---|
| PERF-1 HIGH | = TREE-1 | FIXED there |
| PERF-2 MED | The nature list crossed from the worker as 12,600 plain objects: a 10 ms structured clone on the main thread, out of every breather's reach | FIXED: by column (`world/terrain/natureWire.js`), the buffers transferred - 9-11 ms -> 1.9 ms |
| PERF-3 MED | The haze culls DRAWING, not building: at noon 100 of 121 pixels hidden, each still streamed, laid and held | DECIDE - the owner's: build a hidden pixel's ground and stand its nature the first frame it shows, and the dawn's thinning stands trees late |
| PERF-4 MED | Every world shader now runs the haze; on SwiftShader the branch is flattened (+29-74% a fogged shader, on or off) | OPEN: a uniform branch on a real GPU; measured on the owner's (`HEADED=1 SCENES=jungle npm run perf`, against `JUNGLE=off`) |
| PERF-5 MED | From outside Bantha looking in: 170,000 billboards against the rainforest's 103,000 - the young trees, 41% of them, stood the far rings | FIXED: the young their own groups (`J<species>y`), no far ring |
| PERF-6 MED | The jungle doubled the worker's time a pixel: `Math.hypot` in the clearance, and a whole-jungle pixel laid its ordinary layout only to drop it | FIXED: squared distances; `jungleWhole` lays none - 16.1 -> 10.6 ms |
| PERF-7 LOW | The record's cost claims | FIXED with LAY-10 and HAZE-9 |
| PERF-8 LOW | A pixel's 3D tree set allocated an array a tree inside the frame | FIXED: written in place |
| PERF-9 NIT | = HOST-8 | FIXED there |
| PERF-10 NIT | = TREE-9 | FIXED there |
| PERF-11 NIT | The field allocates for the whole map (2.5 MB) | LEFT: once a session; a map keyed by pixel costs more a read |

### DOC

| Id | Finding | Verdict |
|---|---|---|
| DOC-1 HIGH | The suite was red at the slice's head: FAR-SEA1's audit test sliced the ring's shader without the ring's new haze block | FIXED (f84e59d9b) - the author's A-1 |
| DOC-2 HIGH | = HAZE-1 | FIXED there |
| DOC-3 HIGH | "Every world program" took the haze - several drew unhazed | = HAZE-3 |
| DOC-4 HIGH | Nothing held the jungle's near trees or the release of its handles (four probe mutants alive) | FIXED: the trees' host driven over a fake door - gathered, framed on its own slot, a gone pixel's and a failed build's handles given back |
| DOC-5 HIGH | The storeys' and the border's laws unpinned: no mid storey, the glades off, the gap law swapped, the border's reach and whole pixel without the wander, the glade field's rows mirrored, the own flats' tile read x for z - all alive | FIXED: a pixel WITH glades (403, 91 - a fifth in full light), every canopy tree's species recomputed, the border tile by tile at three depths, the glade field against the forests' own at its lattice and across every edge |
| DOC-6 HIGH | The ring's haze, the grass's and the sky's hand-on had no behavioural pin | FIXED: the ring's `ringHaze` run in the GLSL reader against the CPU twin; every upload of the haze in `src` sends the frame's; the sky's controller over a stub GL |
| DOC-7 MED | The record still said the pictures' provenance was open | FIXED (7c0ce43d0) |
| DOC-8 MED | The owner's pronouns guessed | FIXED (7c0ce43d0) - none stated, none written |
| DOC-9 MED | = HOST-1 | FIXED there |
| DOC-10 MED | The record's GPU check could not reach Bantha: the perf probe had no Bantha scene and no jungle switch | FIXED: `SCENES=jungle` (the city of Glenpoint; `LOC=` another) and `JUNGLE=off` |
| DOC-11 LOW | Port-Status's "sixteen" of the flags added since - seventeen | FIXED |
| DOC-12 LOW | Active-Arcs' test and mutant counts | FIXED |
| DOC-13 LOW | "and ten more" re-aimed lists - eleven | FIXED |
| DOC-14 LOW | `BANTHA1-the-reach-test-off` answered a copy - it never turned the test off; the test deleted lives | FIXED: renamed; the deletion recorded EQUIVALENT (a shortcut alone - past the reach no tile is the jungle's and the loop answers the same list) |
| DOC-15 LOW | = HAZE-9 | FIXED there |
| DOC-16 LOW | = LAY-10 | FIXED there |
| DOC-17 LOW | `hides` and the far ring; `hazeTransmittance` said read by the cull | FIXED: both headers |
| DOC-18 NIT | "~1.4 km at noon": 1.3 km at noon, 1.4 at one | FIXED |
| DOC-19 NIT | = TREE-8 | FIXED there |
| DOC-20 NIT | Stale names: `HAZE_EDGE`, "not 20,480" (16,384), "4096 tiles away" (~4,600), `underClear`'s cell, Rendering.md's "three dome passes", "thickest in the rain" | FIXED; the player's note keeps "at dawn and in the rain" (DECIDED: rain is the weather the player meets; the record says rain, fog and storms) |
| DOC-21 LOW | Seven locales' rows: nb's gender, ko's and ja's register, ko's "반사" (it reads "reflection"), pl's and uk's "primeval", zh's "thin mist", tr's "orman" | FIXED in-session (`tools/l10nInSession.mjs`); tr KEPT - "orman" is how Turkish names a jungle (*Orman Kitabı*) |

### The author's

| Id | Finding | Verdict |
|---|---|---|
| A-1 | = DOC-1, found by the full suite before the lanes reported | FIXED |
| A-2 | RESCUE-SAVE's A1 failed once under the full suite's load and passed alone twice; no server file is the slice's | NOT THIS SLICE'S |

## After

Tests: `bantha1_jungle` 33 (18 before). Mutants: `tools/mutants/bantha1.json` 104 records (42 before), all dead but
the one recorded equivalent; the records of eight other lists re-aimed by content (`auditlandforms`, `forest1`,
`la_cost`, `nav_b`, `nodemarks`, `perfsun`, `tact1`, and `sd20c` put back as it was with the domes' pins). Code: the
haze's uniform renamed through 20 render modules; `renderer.js` (the program's own sent state, the view out's haze);
seven glow passes; `ai/cover.js` (the wide grid); `jungleHost.js` (the world's frame, off, under, scratch);
`jungleNature.js` (the stands, the slopes, the fields, neighbour trunks, the groves); `natureWire.js` new;
`pixelBuild.js` (the sliced cover, the young's groups, the sun's lift); `world.js` with no line added (`bootWorld` at
its ceiling); `tools/perfProbe.mjs` and `tools/jungleExtent.mjs` for the owner. The lanes ran without ARENA2 - the
freeware fetch (`tools/fetch-data.sh`) was not run until the owner asked (2026-10-18: "Why not install the freeware. Im
tired of having to ask you to do this"); run then, it confirmed the RISK above. Not checked here: the frame time on a GPU.
