# Roads Arc

The road system's own page. It did not have one until 2026-08-29, and
that is the first thing worth recording: R1-R7, a twelve-slice fix run,
a whole-arc revert and an audit all landed with their record spread
across ONE Port-Ledger row, two Testing.md rows and the module headers.
Everything of this size in the port has an arc page; this one was
reachable only by knowing which modules to open - the same defect AUDIT
27 filed as F303 against two arcs the bible's index never named.

**A NOTE ON WHERE THE HISTORY IS.** This repository's commit history
begins 2026-08-28 15:19, and R1 through R7 landed before it - the road
modules arrive already built in the first commit that touches them. So
the slice records below are reconstructed from the modules' own headers,
Testing.md's rows and the Ledger, which is where this arc has always
kept its reasoning, and NOT from commits that are not here. Where a date
is given it is a commit in this repository.

## What roads are, and the one rule that governs them

**Classic Daggerfall has no roads at all** - not in MAPS.BSA, not in the
terrain, not on the travel map. So this is a departure with no DFU
original to be faithful to, and the doctrine's answer is Ledger section
A: approved, enhanced-skin only, and GENERATED rather than authored.

The 1:1 lane never sees a road. With the feature off, every byte of the
travel law is the verbatim port. Nothing is vendored and no asset ships:
the network is a least-cost routing over the SAME `WOODS.WLD` heights
the streamed terrain samples and the SAME `CLIMATE.PAK` bytes the travel
calculator charges, between the real `MAPS.BSA` locations, baked on the
player's own machine from the player's own ARENA2 and cached there. A
road bends around a mountain because the mountain is in the data.

The law/skin split is stated in `systems/roads.js`'s header and is the
thing to preserve when editing any of this:

- **LAW** - the per-pixel terrain term IS `TravelTimeCalculator`'s own
  cost numerator, imported and never restated, so a road prefers exactly
  the ground the game already calls fast. `roadTravel.js` searches on
  `travelPixelMinutes`, the same function `calculateTravelTime` bills
  with, so THE DRAWN ROUTE AND THE CHARGED TIME ARE ONE ARITHMETIC
  rather than two estimates that happen to agree.
- **LAW** - whether a pixel is water is `ui/overworldModel`'s two-sided
  test, and `systems/` may not import `ui/`, so it is a REQUIRED
  injected predicate. The pin drives it with a deliberately different
  predicate to prove nothing is hardcoded.
- **SKIN** - `GRADIENT_WEIGHT`, `ROAD_REUSE_COST`, `LOOP_FACTOR`,
  `HUB_NEIGHBOURS`, `WANDER`, the road speeds, the reveal radius, the
  LOD distance. No source law exists for these. The pins assert
  STRUCTURE (the gentle detour wins; a second route merges onto the
  first; exits are symmetric), never the numbers back at themselves.
  **They are tuned against synthetic terrain and still await real WOODS
  relief.**

And the guarantee that makes the whole thing safe to ship: classic's own
walk is a legal 8-connected path, so it is a MEMBER of the graph the
router searches, and a least-cost answer cannot lose to it. Travelling
by road is never slower than travelling without one.

## The slices

| # | What it is | Where it lives |
|---|---|---|
| R1 | The network, generated from the terrain. Trunk routing between hubs (city/hamlet), spurs from everything else, laid as a least-cost search over the cost field | `src/systems/roads.js` |
| R2 | The bake, and what survives a reload. ONLY the two exit planes are cached - the builder's segment list costs more than the network it describes and lies about it, so `tracePolylines` rebuilds the drawing's chains from the exits instead. Versioned + checksummed envelope: a torn write is REFUSED, not believed | `src/systems/roadBake.js` |
| R3 | The road layer on the travel map | `src/ui/overworldModel.js` (`── R3: THE ROAD LAYER ──`) |
| R4 | Travelling by road - route, price and flight path as one path | `src/systems/roadTravel.js` |
| R5 | The road on the ground: painted into each streamed pixel's 128x128 terrain tilemap, through `assignTiles`' existing "skip anything already stamped" seam, using records 46/47/55 which are ALREADY road in Daggerfall's ground set. No new art | `src/world/roadTiles.js` |
| R6 | The switch and the cache - the slice that makes R1-R5 reachable. Every dependency injected, so the cache law is pinned rather than hoped for behind an IndexedDB call | `src/systems/roadsBoot.js` |
| R7 | Roads ON by default (Mac's reversal) | `src/systems/uiPrefs.js` |
| R3W/RW1/RC1, R4W | The system wired into the hosts, narrowed, joined to the towns; travel wired | 2026-08-28 |
| RR1/RP1/RB1, FS1/RC2, RC3, RH1, RZ1-RZ6, RG1 | The fix run - rounding, the bake's silent stretch, the empty cache, the tile under the player, the trunk forest joined into ONE network, height restored, six zig-zag fixes, and roads meeting a town's own street rather than its pixel centre | 2026-08-28/29 |
| (revert) | The road GEOMETRY reverted to R5 whole, 2026-08-29 - the ground drawing is as it was | |
| RA1 | The road audit: the bake off the main thread, the router's scratch, the sky's switch | `src/systems/roadBakeClient.js`, `roadBakeWorker.js` |
| RF1 | The re-audit, 2026-08-29 - this page, and two stale claims | below |

## RA1 - the audit that took the bake off the main thread

Mac's call was "it gets stuck on baking roads when starting a game", and
the root cause was never one bug: R6 ran `bakeRoads` SYNCHRONOUSLY in
the world host's boot, R7 then turned roads on by default, and the only
progress surface is `document.title` - which a thread that never yields
never paints. Every first boot froze for the whole grind, and a healthy
bake was indistinguishable from a hang.

The fix is a SEAM, not a rewrite: `roadsForWorld` takes an injected
`bake(inputs, onProgress)`; the world host hands
`roadBakeClient.bakeRoadsOffThread`. Because functions cannot cross
`postMessage`, the ONE pass that consumes them (`buildCostField`, a
single 500,000-pixel sweep) runs main-thread over the real injected laws
and only plain data crosses - and the heights cross as a COPY, because
transferring the reader's plane would detach the buffer the streamed
terrain samples for the rest of the session.

RA1 also took `routeRoad`'s ~6.5MB of per-call allocation (~110GB of
churn across a bake's ~17,000 calls) down to generation-stamped module
scratch: 17.2s -> 2.3s at its fixture's scale, byte-identical stats.

## RF1 - the re-audit (2026-08-29)

Two findings, both the AUDIT 17m shape: a comment that answers a
question WRONGLY, which is worse than no comment because it stops the
reader looking.

**RF1-a: the switch module's header described the opposite of the
shipping default.** `roadsBoot.js` is the one file a reader opens to
learn what the roads default IS, and its header carried a section headed
*WHY IT IS OFF BY DEFAULT* explaining that "the preference defaults
false". R7 had flipped `PREF_DEFAULTS.roads` to `true` and flipped the
pin with it, and left the prose. **FIXED**, and the fix is not a
deletion: the header now states the shipping default, names R7 as the
slice that reversed R6, and says what the reversal owes the player. The
pin (`roadsboot.test.js`) holds the header against `PREF_DEFAULTS`
itself, BOTH WAYS and self-retiring - flip the preference back and it
demands the opposite prose, and deleting the false sentence without
stating the true one fails it too. It reuses IN1's `blankQuoted` rather
than growing a second copy of "is this a quotation?", so the correction
is free to quote what it retired.

**RF1-b: six sites still argued from a bake time RA1 had deleted.**
`roadBake.js`, `roadsBoot.js` (twice), `roads.js`, `uiPrefs.js` and
`scenes/dataSource.js` all described the whole-map bake as "about
twenty-six seconds" - and two of them built a DESIGN ARGUMENT on it
(R6's reason for shipping roads off; R7's account of what its reversal
owes the player). RA1 had measured the same scale at 2.3s.

Re-measured for this audit rather than inferred, on the reference
fixture's own shape (1000x500, 15,251 locations, **512 hubs** against
its 502): **3.24 seconds**. A first run at 3,833 hubs - 7.6x the trunk
work - took 9.0s, which is the useful bound: even a far harder bake than
Daggerfall's own proportions produce is nowhere near half a minute.

**FIXED** at all six, and the history kept rather than erased: each site
now names the twenty-six seconds as the number of its day and the
measurement that replaced it. The second pin forbids the PRESENT-TENSE
spellings across all of `src/`, so the phrase may still appear as
history and cannot return as a claim. Campaign: 6 mutants, 6 killed.

Note what this does NOT change: R7's reversal stands on the skin
("a player arriving at the ENHANCED skin has asked"), not on the clock,
so the argument survives its number being wrong. And the case for
CACHING is weakened, not ended - seconds rather than half a minute, but
shipping the artifact would still cost every user a megabyte and raise
the question of whether a table derived from WOODS heights is game data.

## What is still open

- **The skin constants await real WOODS relief.** Every one of them is
  tuned against synthetic terrain. This container has no ARENA2, so no
  slice yet has seen the network the real heightmap produces.
- **The Ledger's own words:** "Also on the enhanced travel map. We need
  to integrate this into enhanced" (Mac).
- The measurements above are synthetic-fixture measurements on one
  container. They bound the bake; they do not describe a player's
  machine on real data.
