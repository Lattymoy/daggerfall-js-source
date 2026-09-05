# AUDIT ROADS - the deep audit of the road system (2026-08-29)

SUPERSEDED BEFORE IT WAS ACTIONED. This audit ran against the port's
own road generator (systems/roads.js, roadBake.js, roadTravel.js,
world/roadTiles.js). By the time it landed, main had already replaced
that system whole - ROADS 22, Hazelnut's Basic Roads vendored with
permission (vendor/roads-hazelnut/, the src/world/roadNetwork.js /
roadPainter.js / roadsProducer.js / roadsCache.js set). Every module
below marked RETIRED is gone from the tree; the findings stand as the
record of what the old generator got wrong, and the one lesson that
survives the swap is the coverage one - a seam pin that drives only the
symmetric cases is not a pin.

Mac asked for "a deep audit and ensure this is perfect" on the road
system after the R5 revert and the RG1 gate-connection landing. This page
is the record. NOTHING HERE IS FIXED YET - the session paused on usage
with the audit complete and every finding unactioned.

    8 dimensions   45 agents   0 errors   5,122,021 subagent tokens   ~3.9 h
    37 findings confirmed, 0 dropped at the verify stage
    7 breaks / 19 degrades / 11 latent

Every finding was required to be reproduced by a running script, and
each then went to an adversarial verifier that re-ran it independently.
Several verifiers REJECTED the proposed fix while confirming the defect -
those corrections are the most valuable part of the record and are kept
below.

## The one that explains what Mac saw

**A diagonal pixel seam severs the road** (`src/world/roadTiles.js:213`). (RETIRED)

At every diagonal step across a map-pixel boundary the two painted bands
**touch at a single corner point and share no edge**. The 32 m trunk
narrows to one 6.4 m tile and then to nothing. Measured on a real
`buildRoadNetwork` run, **48% of all boundary crossings are diagonal**, so
a 26-pixel trunk road comes apart into disconnected fragments.

This is the defect behind the original two complaints - the road that
"was connected to nothing" leaving a dungeon, and much of what read as
zig-zagging. It survived every iteration of the geometry work because of
the finding directly below.

**The seam pin only ever tested the two cases that cannot disagree**
(`test/roadtiles.test.js:95` and `:118`). Both build their tilemaps with (RETIRED)
`blank()`, so neither pixel carries a location and both sides necessarily
run the same branch. N-S and E-W are exactly the two orientations where
the geometry is symmetric. The diagonal case - half of all crossings -
was never driven. **This is verbatim the AUDIT 24 lesson: a pin that
restates the port is not a pin.**

Two more test-coverage breaks in the same family:

- **No pin says a pixel carrying road bits must paint road**
  (`test/roadtiles.test.js:136`). The suite has the negative pin ("a (RETIRED)
  pixel with no road is left completely alone") and never the positive
  one, so smoothing holes ship green.
- **Nothing counts how many roads a tile carries**
  (`test/roadtiles.test.js:198`). This is how the two-roads bug shipped. (RETIRED)
  NOTE the verifier's correction: do NOT add the naive band-count pin -
  it goes red on 13% of legitimate location pixels. The double must be
  caught another way.

## The other four breaks

- **`ROADS_V` was never bumped** (`src/systems/roadBake.js:49`) for two (RETIRED)
  commits that changed the network. The file states the law in its own
  words - bump it "whenever a change would make an old artifact wrong
  rather than merely stale" - and RC1 and RC3 both did exactly that. Any
  player who baked before those fixes keeps the pre-fix roads for ever.
  One-character fix; the verifier downgraded the severity but kept it.
- **RC3's forest join runs mainland x island failed searches**
  (`src/systems/roads.js:647`). `unroutable` is keyed on the HUB PAIR, so (RETIRED)
  every cross-component pair is routed once before the loop gives up -
  and a route to an unreachable goal is not cheap, it drains the start's
  entire connected component. One unreachable town turns the 26-second
  bake into minutes, with the progress bar frozen at "bridges 0/1". The
  verifier's refinement: guard the flood fill so it does not run on the
  common single-component bake.
- **The flight is planned with ALL-DEFAULT options**
  (`src/ui/overworldMap.js:703`). `_confirmDiseased` sets
  `this._panelState = null` and THEN calls `_beginFlight()`, whose
  `const st = this._panelState` is therefore always null. Every
  `st?.opts?.speedCautious` and `st?.hasHorse` evaluates to undefined, and
  `JSON.stringify` drops undefined keys - so the player's travel choices
  are silently discarded on the diseased path.

## What was checked and could NOT be faulted

Recorded so it is not re-audited:

- **The router is optimal.** An independent reference Dijkstra over 546
  start/goal pairs, on a virgin field and after a road was laid: 0
  suboptimal routes, worst overshoot 9.4e-14%. The octile/minStep
  heuristic is consistent and closed nodes are correctly never reopened.
- **The generation is water-tight and connected.** A 250-map fuzz
  (random terrain, lakes/seas, 8-32 locations): no road pixel is water,
  every exit has its mirror, none leaves the map, and every location
  sharing a landmass with >= 2 hubs is on a road and mutually reachable.
  All 250 clean - **RC3 genuinely fixes the forest.**
- **The bake is deterministic.** Same-process repeat, cross-process,
  reversed input order, and cold-vs-warm shared scratch all produce
  byte-identical exit planes. The generation-stamped scratch is safe.
- **Row 127 = north is correct, and for the right reason** - consecutive
  longitudes across the seam, and the world host's probe agrees.
- **Cardinal seams agree exactly** - 4000 fuzzed (town x exit-set) cases,
  0 holes, 0 overwrites.
- **RG1 (the gate connection) is sound.** Swept all 48x48 single-street
  positions in a 3x3-block town with a through road: worst seam
  disagreement is ONE row. RG1 moves only the inner endpoint, never the
  edge endpoint, so it cannot tear a seam. Its pins are thin - no pin
  drives a through-road, a diagonal exit, or a neighbour - but the code
  is correct.
- **The worker really does load**: its transitive import graph is 8
  modules with zero DOM references, and the bundler emits it.

## Degrades worth naming

- **`chaikin()` smooths the SIMPLIFIED chain**
  (`src/ui/overworldModel.js:398`), so its corner cut is a fraction of a
  long segment: at a bend the drawn line leaves the painted band by 192
  terrain tiles / 1,229 world units. Take the bounded-corner-cut
  alternative, not a densify pass.
- **Half of all T-junctions tear** (`src/ui/overworldModel.js:337`) - only
  chain ENDS are pinned, so a spur's drawn end stops in open country
  beside a trunk that has swung away.
- **5,658 draw calls in the map's resting view** against 6 for the rest
  of the frame (`src/render/overworldRenderer.js:393`), plus 5,653 VAOs
  and buffers allocated in one synchronous loop. The verifier validated
  the batching patch end to end: 5,658 -> 7 draw calls, picture
  byte-identical.
- **The road-discovery layer has six passing tests and no caller**
  (`src/ui/overworldModel.js:452`, `src/ui/overworldMap.js:416`). Every
  road in the Bay is drawn from the first frame, running unbroken to
  towns the same map is deliberately hiding. This is the R3W
  orphaned-layer defect again, in a new module.
- **The land-only rule tests only the CLIMATE byte**
  (`src/systems/roadTravel.js:227`), so routes cross - and prefer - (RETIRED)
  pixels the map itself paints as open sea. Three code paths in this
  project answer "is this pixel water" and one answers differently. The
  verifier: fix the COMMENT first, it is the actual defect.
- **Every option toggle re-runs a full-map A***
  (`src/systems/roadTravel.js:187`): ~200 ms of blocked main thread per (RETIRED)
  click, ~0.9 s and 33 MB per card visit.
- **Nothing is drawn for the whole 26-second bake**
  (`src/scenes/world.js:269`) - the world host has no frame loop yet and
  `status()` writes only `document.title`.
- **A landmass with fewer than two hubs gets no road at all**
  (`src/systems/roads.js:728`). Take the verifier's PRIMARY proposal; its (RETIRED)
  "cheapest version" fallback is broken two ways.
- **`layPath` collapses `field.minStep` to `ROAD_REUSE_COST`**
  (`src/systems/roads.js:474`). The code is CORRECT - the collapse is (RETIRED)
  required for admissibility, re-confirmed against the reference
  Dijkstra - but 24 against a terrain floor of 241 costs the heuristic
  90% of its strength for the rest of the bake, refuting the header's
  stated reason for deleting the search window. **Do NOT change
  `ROAD_REUSE_COST`** - it is the shape knob for stage 4, not a speed
  knob: raising it to 200 takes loops 96 -> 0 and turns the network into
  a literal tree.
- **Dead fixtures** (`test/roadwiring.test.js:346`): the revert deleted (RETIRED)
  the tests but left seven bindings, and eslint only lints `src/`.
  `stitchChain` was the ONLY multi-pixel stitching harness in the suite -
  which is precisely why the diagonal tear had nowhere to be caught.
- **Two pins are spelling greps** (`test/roadwiring.test.js:86` and (RETIRED)
  `:99`): they assert literal strings occur in order in a source file, so
  any respelling reintroduces the defect with the suite green.

## Latent

Eleven, none currently reachable: the trunk-wins-the-middle comment is
inverted by the skip-non-zero rule; the road claims cells the town
footprint deliberately left at zero; the worker drops build options its
own fallback honours (so worker and fallback can disagree); the 20-byte
envelope header sits outside the checksum; `reliefPoint` interpolates
height bytes then clamps while the drawn surface clamps then
interpolates; the travel guarantee covers minutes only, so gold can go UP
with roads on; a Worker that goes quiet hangs the boot for ever with no
timeout; the tile probe feeds the footstep path arm but not its water
arm; the road discount is pinned only by inequalities; and `roadBake`
still exports a superseded synchronous cache door that never learned
RB1's empty-cache rule.

## Where to start

The diagonal seam first - it is the live defect, it is what Mac saw, and
its fix is architecturally settled (the two flanking pixels are the only
ones that can paint that ground; the verifier confirmed a patch
byte-identical across all 2400 pixels of a generated network, with the
fast path kept). Write the diagonal seam pin BEFORE the fix, and drive it
with a location on one side - a blank-tilemap pin cannot see this bug.

Then `ROADS_V`, which is one character and silently withholds every fix
above from anyone who has already baked.
