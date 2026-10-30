# Foundation - the proposal "A Foundation for Scale", taken on (FOUNDATION)

Opened 2026-10-30. DnfJeff's proposal "A Foundation for Scale: Proposal for DFO's Next Phase" (29 October 2026) argues
that the world's data should be entity-major - a place one bundle, the blocks a shared vocabulary checked when packed -
and that regional rules should run on a residency clock. Its practical path has four steps: a joint measurement pass, a
pilot region on the new data model, a narrow versioned surface the client adopts piece by piece, and decision records.
The owner, handing it over: *"Please take this on and only return when this is finished in full."*

This page is that work. F0 re-took every number the proposal states. F1 built the atlas and wired it into the streaming
world. F2 weighed the residency clock against what the tree already does and did not build it; the reasons are below.

## The decisions, taken 2026-10-30

- **Measure first, by a written method.** `tools/foundationMeasure.mjs` re-takes the structural figures and
  `tools/atlasMeasure.mjs` the world's. Each counter is pinned on a fixture tree, so a method that drifts fails.
- **The atlas is built on what stands.** It reads places through the registry (`world/worldWide/worldPlaces.js`, WW1)
  and layouts through the readers and the world-data door, so it answers for every province and sees every edit the
  game serves. It is an index, not a second copy of the data: ARENA2 is not redistributable (Port-Doctrine), so the
  player's own files stay the archive and the world-data packs stay the layers.
- **The client stays.** The proposal plans a Godot client. The renderer is hand-rolled WebGL2 (Port-Doctrine, Rebuilt on
  our stack 1); the atlas is a JS module the existing client reads.
- **No second clock and no second prosperity.** ONE DFU MEMBER, ONE EXPORT: the deterministic restoring-force economy the
  proposal describes is ECON1, live since 2026-09-17, and a town's prosperity is TOWN-ECON's. F2 says why no clock was added.
- **The hosts do not grow.** `bootWorld` stands at its ceiling (35,150 logical lines). The atlas is made in
  `scenes/tamrielPlacesHost.js`, which already holds the registry, the blocks and the place index.

## F0 - the measurement pass (MEASURED, 2026-10-30, at b793e26e1)

`node tools/foundationMeasure.mjs`. A host is measured as the ceiling measures it (`tools/hostScope.mjs`). An assertion
is a call site in the text, not a run's count. A text pin is `assert.match`, `assert.doesNotMatch`, or an
`assert`/`assert.ok` of `.includes`, `.test` or `.indexOf`. A test "reads our source" when it reads a path under `src/`,
`server/src/` or `server-account/src/`. A file "reaches presentation" when it imports from `render/`, `ui/` or
`scenes/`, or touches `document`, `window` or WebGL.

| The proposal says (V439, 2026-10-26) | Measured here | Verdict |
|---|---|---|
| `bootWorld` is 34,301 lines | 32,965 source lines; 35,150 logical | Holds, a little smaller |
| The four hosts hold 64,635 lines | 63,241 (13,738 + 10,446 + 6,092 with `bootWorld`'s) | Holds |
| 282,382 assertions | 309,802 call sites in 4,597 test files | Holds in scale |
| About one in ten is a match against another source file | 16,955 text pins in files that read our source: 5.5% of all call sites. Text pins anywhere: 36,820 (11.9%) | Half of what it says, if "against source" is meant |
| A third of test files open source as text | 1,486 of 4,597 (32%) | Holds |
| Four text surfaces; two of four hosts wire the toasts into the ring | Two PopupText rings (`scenes/townTalk.js`'s, which all four hosts import, and `scenes/dungeonContext.js`'s own) and the notice panel. The four were not all found | Not verified |
| 33,000+ loose PNGs, no atlasing | 33,677 (20,474 under `public/`, 13,134 under `vendor/`, 69 under `src/`), 212.6 MB | Holds |
| The build fails half the time on Windows with EMFILE | Not measurable in this Linux container | Recorded, not tested |
| 27 of 827 systems files touch presentation | 44 of 899 | Holds in kind |
| 1 of 86 format files does | 1 of 87 | Holds |
| A 609-file bible, 650k lines of English | 680 pages, 358,000 lines, 6.48 million words | Pages hold; lines are fewer |

The world's figures, on the freeware ARENA2 (`ARENA2_PATH=... node tools/atlasMeasure.mjs`):

| The proposal says | Measured here | Verdict |
|---|---|---|
| 15,251 locations | 15,251 | Exact |
| 328,499 buildings | 328,499 | Exact |
| 548,618 doors | 548,618 (MAPS.BSA's location door records) | Exact |
| 4,232 locations with dungeons | 4,232 | Exact |
| 45,427 exterior slots over 657 blocks, mean reuse 69 | 45,427 over 658, mean reuse 69.0 | One block more; not traced |
| About 28% of shipped content unreachable, by three mechanisms | 262 of BLOCKS.BSA's 920 RMB (28.5%) are named by no place; all 187 RDB are named | The one mechanism measured matches. The proposal does not name the other two |
| One base archive of 48 MB | Not built: no archive of the player's data is made | Out of scope by Port-Doctrine |

Three claims the tree contradicts:

- **"The data model has no stable notion of place."** WW1's registry files every place by `worldPixelKey` and its map
  id, with its region, area and theatre explicit, past the Bay as on it (`03-World/World-Wide.md`).
- **"No step-invariant rules."** ECON1's world price walk is a pure function of the world's day: catching up equals
  having stayed, each step is integer arithmetic, and a rebuild walks at most 512 days (`systems/worldTick.js`
  `worldRegionPricesOn`, pinned by `econ1_world_prices.test.js`).
- **The restoring-force economy "most people assumed did not exist".** It is DFU's `FormulaHelper.UpdateRegionalPrices`,
  ported in S41 (`systems/shopStock.js` `priceWalkStep`) and the world's own since ECON1.

## F1 - the atlas (BUILT, 2026-10-30)

`src/world/atlas/atlas.js` holds the world's places entity-major. A bundle is one place whole: the registry's record
(identity, region, area, theatre), its exterior grid, its dungeon plan with its starting block, its buildings' types,
factions and qualities, and its door records. Blocks are a vocabulary: each name is interned once and a bundle holds
its ids, so a block used by 410 cities is one word used 1,433 times. The part kinds are a closed set of eight:
`place`, `exterior`, `dungeon`, `building`, `door`, `rmb`, `rdb` and `region`. Each is one query (`parts(kind)`), as
are a place (`place(mapId)`), a region (`inRegion(r)`) and a block's users (`usersOf(name)`). `ATLAS_VERSION` is 1,
raised when a part's shape changes.

Every name is resolved when a place goes in, as the layout would read it (`world/atlas/atlasServed.js`): BLOCKS.BSA's
alternate match, then a record of BLOCKS.BSA, and past it only a block the world-data door serves. The last clause is
new: the door gives an index to any block a location names (`assignBlockIndices`), so a name could pass `checkName`
with nothing behind it and fail only when its town was laid out. `worldDataServesBlock` in
`formats/worldData/worldDataReplacement.js` answers that without building anything. A name that resolves to nothing is
a problem; a name that resolves under another name is recorded as aliased.

### In the streaming world (`scenes/atlasHost.js`)

`createTamrielPlaces` makes the atlas host and returns it as `worldAtlas`. A bundle is made when first asked, from the
location the host already holds (the index for the Bay, the build's own stand past it). The places near a pixel are the
registry's `near`, asked each time: residency is derived, never stored. A provider that registers starts a new atlas,
so no bundle outlives the registry it came from. When the world-data door serves edits, every listed place is checked
once at idle, 500 places a slice, on an atlas of its own. A block a place names that nothing serves is told to the
console once, with the count and the first eight. Nothing in the game reads bundles yet; consumers adopt the surface
one at a time.

### The pilot: a place is data

The proposal's pilot asks for proof that an edit to a place is an ordinary data change. Roleplay Realism already makes
one: two DFU world-data files add Northrock Fort to the Wrothgarian Mountains (`vendor/roleplay-realism/WorldData/`).
With both files served, the fort is a bundle in region 16 like any of MAPS.BSA's. With its location served and its
block not, the fill finds `RRFORT01.RMB` unresolved before any player walks to it (`f1_atlas_layer.test.js`).

### What it measured

| World | Places | Exterior slots over blocks | Unresolved |
|---|---|---|---|
| Classic (the files as shipped) | 15,251 | 45,427 over 658 | 0 |
| Served (the door, the port's edits, the 283 places past the Bay) | 15,534 | 49,338 over 1,124 | 0 |
| Served with Beautiful Villages and Beautiful Cities | 15,534 | 59,845 over 1,133 | 0 |

Past the Bay each province's region holds its own places: 62 High Rock 29, 63 Hammerfell 31, 64 Skyrim 33, 65
Morrowind 31, 66 Sumurset Isle 32, 67 Valenwood 31, 68 Elsweyr 31, 69 Black Marsh 32, 70 Cyrodiil 33. The first served
run reported 67 unresolved wall blocks; the tool had skipped `standTownWall`, which the host calls. The check found the
tool's own gap.

A town a pack replaces carries no location door records: `locationFromJson` writes none, so the door count falls from
588,713 to 43,054 with the packs on. Nothing in the port reads those records - a door is its block's - so no player
sees it. The atlas's door part is MAPS.BSA's records, as the proposal counted them.

## F2 - the residency clock (DECIDED 2026-10-30: not built)

The proposal's clock exists to keep stateful regional rules cheap and in step: residency by radius, a bounded rotation
so no region falls more than 45 ticks behind, integer rules with bit-shift half-lives. Each property is already true of
the regional state this tree keeps, by another route:

- **In step.** The world's regional state is a pure function of the world's clock and static data - ECON1's prices,
  WORLD6b's day rolls, the living world's people, TOWN-ECON's cycle - or a book the account service keeps and every
  client reads alike (TOWN-ECON's players' share). Every client has the same answer for a day, and nothing walks while
  unseen, so there is no catch-up to bound.
- **Bounded.** ECON1's one replay is bounded at 512 days by its checkpoints (AUDIT ALL E4).
- **Residency.** The registry's `near` is a radius derived each time it is asked; the atlas host reads through it.
- **The player's own walks.** Faction power and the region conditions are each player's (quests move them). Offline they
  are walked minute by minute as DFU walks them; online they do not walk an absence, by design (`alignEntityClocks`).

A clock with no rule to run is code nothing calls; re-hosting ECON1 on one would change no number and add a second home
for a working rule. The clock is the right shape for the first rule whose state cannot be derived from the day - a
book the service keeps that must decay, say. That rule's slice builds it, on this page's record.

## What stays open (recorded)

- **The land.** The coast is derived: WOODS.WLD heights and CLIMATE.PAK on the Bay, the player's traced picture past
  it (`world/tamriel/tamrielLand.js` `landLaw`). No data seam edits it, so a shoreline is still tuned in code. A land
  layer keyed by `worldPixelKey` would need every reader of the land (terrain, waters, places, ports, roads) to agree.
  It is its own slice and the owner's call.
- **Places not on a list.** The countryside and the lairs past the Bay are pixel providers, and the capitals stand on
  their own plans. The game's atlas bundles them when asked; the measurement's list holds the Bay and TESA's 283.
- **A mod's own additions.** The registry holds the game's base rows alone (HUB1), so the in-game check reads the
  places every client shares. The tool and `f1_atlas_layer.test.js` check additions.
- **Measured, not addressed.** The text surfaces, the two skins, the PNG count and the Windows build are outside the
  proposal's practical path and outside this arc.

## THE FOUR HOSTS (Home.md)

- `scenes/world.js` - wired, through `scenes/tamrielPlacesHost.js` (`worldAtlas`); `bootWorld` gains no line.
- `scenes/exterior.js` - not wired: the fixed-city bench stands one town and keeps no registry.
- `scenes/worldModes.js` - not wired: an interior is a building of a place the streaming world already holds.
- `scenes/dungeonContext.js` - not wired: the standalone dungeon has no registry; in the streaming world its place is
  the world host's.

## Pins and mutants

- `test/world/atlas/f1_atlas.test.js` - the surface, the bundles, the vocabulary, the parts, the counts and the served
  resolve, synthetic, with a Skyrim place beside the Bay's.
- `test/world/atlas/f1_atlas_corpus.test.js`, `f1_atlas_served.test.js`, `f1_atlas_packs.test.js`,
  `f1_atlas_layer.test.js` - the same laws on the player's own files (skipped without `ARENA2_PATH`).
- `test/scenes/atlashost.test.js` - the host: made when asked, residency asked each time, a moved registry, the check.
- `test/tooling/foundationmeasure.test.js` - the measurement's method on a fixture tree.
- `tools/mutants/foundation.json` - 28 mutants, 28 dead.

## Port-Ledger

Section A, FOUNDATION: the atlas, its served resolve and the door's `worldDataServesBlock` are ours. DFU has
MapsFile and BlocksFile and joins them by position at layout.
