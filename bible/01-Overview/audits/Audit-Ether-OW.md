# AUDIT ETHER-OW (2026-10-13) - the Eltheric Ocean's last four slices, audited

The owner, of everything since AUDIT ETHER-CHART2 on PR #847 (`03-World/Eltheric-Ocean.md`: ELTHERIC - the sea's name;
ETHER-DEEP - its seabed by its own Deep Waters bake; ETHER-NODES - the professions' nodes on its isles; ETHER-OW - the
Overworld past the Veil): **"Lets audit everything and ensure perfection"**. This page is the findings, each with its
verdict. What the audit changed is written into each slice's section as it now stands, each change marked with its
finding's id.

## How it was run

Four cold lanes, each on a FROZEN snapshot (git worktrees at 6743a54ea, per Home.md's DO NOT FIX WHILE THE VERIFIER IS
READING), each told to verify a finding before reporting it:

| Lane | Over | How |
|---|---|---|
| C1 - the code: ETHER-DEEP | `world/deepWater/deepWatersBake.js`, `world/etherWatersBake.js`, `world/deepWater/deepWaterTileData.js`, the client, the worker, the host | the Bay's outputs before and after compared (16,900, the raw and the composed reader); the ring claim over all 146,714 isles; a cell's flood against its 3 x 3's over 20,000 pixels; the box's edges; a 400-cell crossing's eviction; a 900-pixel Bay voyage on the main thread; the door's and the flood's cost timed |
| C2 - the code: ELTHERIC, ETHER-NODES, ETHER-OW | `net/nodeLaw.js` and the service, the Overworld's lists, bands, raiders and word, the chart's door | `pixelOk` against the old law over 154,825 cells; the ids' edges; the Motherlodes' pick over 100 days; the raiders' path from contact to a board; the bands made for the isles' nine climates; the lists' keys against a chart |
| T - the pins | every test and mutant record the four slices added or moved | the 78 committed records run; 94 scratch mutants of the slices' source, the survivors re-run against the moved pins' suites; the full suite on the snapshot |
| D - the record | the bible's lines, the modules' comments, the commits and PR #847 | every number and name checked against the code and the tests; the doc gates run |

No lane found a crash or a save at risk. The Bay is byte-identical under ETHER-DEEP (C1), and the node law's answers are
the old law's exactly (C2). The findings are a Motherlode a player could never strike, an isle charted with no plate
until the captain moved, a teleport over the Veil the sea fight's switch left open, the main thread's planes and floods
unbounded or doubled, pins that could not fail, and a record that overclaimed.

## Findings

| # | Sev | Finding | Verdict |
|---|---|---|---|
| C2-1 | MAJOR | ETHER-NODES let an isle's pixels be witnessed and confirmed, so they became Motherlode candidates (`motherlodeSites` had no ground bound) - but the relay mints a Watch receipt on the Bay's map alone, and a strike asks one of the site's pixel: a Motherlode past the Veil could never be struck, and was announced "in Betony". Given ten isle candidates, 53 of 100 days sited one there | FIXED at the root: THE WATCH'S GROUND, one home (`net/watchReceipt.js` `watchPixelOk` - the relay's mint, the service's receipt and the Motherlodes' site read it); a site is a pixel a receipt can name. `ACCOUNT_VERSION` acct125 (the law moved; no migration - the isles' witnesses ship with it, so no kept day holds one). The relay's answers are as they were, its bundle not: `RELAY_VERSION` world199 (SLAM8 - any byte of the relay's law is a version) |
| C2-2 | MINOR | The Overworld's lists (`tvPlates`, `tvFar`, `tvDng`, `tvFind`, `tvDngModels`) were keyed on the pixel and DFU's finds; a chart by sight, a harbourmaster's chart or a corsair's papers moved neither - an isle charted on the pixel the captain stood on had no plate until they moved, and the find could name a ruin already charted | FIXED: the keys are `tvKnownGen` - the finds and the captain's charts (`captainLedger.chartedCount`, the list only grows; a load replaces the finds and moves their generation too) |
| C2-3 | MINOR | With Warm Ashes on and the sea fight off, ETHER-OW's raiders past the Veil came alongside and the mod's raid boarded "Your Ship" - a teleport to the Bay's ship pixels, and home again by Leave Ship, without the crossing (the transport menu's Ship row did the same, before the slice) | FIXED at both ends: past the Veil a raider is born only where the sea fight stands her as a ship (`tvRaidOpen`); and "Your Ship" is boarded from the Bay alone (`boardOrDisembark` asks `veilRefused`, the crossing's word said - AUDIT CAPTAIN'S SEA P6's law), leaving it always going back where it was boarded |
| C2-4 | NIT | Betony's Court writs (`regionWritTable`) read every witnessed pixel of region 19 - the isles' ores join them | DECIDED, recorded (ETHER-NODES): the isles' region is Betony's for every system that asks one ("Recorded departures") |
| C1-1 | MINOR | `readLargeWindow` sent the main thread's composed reader (always the sea's over the raw file) down the sea's allocating door for the Bay's pixels too: a pixel's class 1.71 to 5.85 us, its candidates 206 to 320 us (the no-worker fallback, the places' rects at mount, the main thread's fine masks). The output was identical | FIXED: the raw bytes where the reader owns them or the pixel is on the Bay's map - 0 differences over 81 edge and 50 Eltheric pixels, 13.01 to 1.36 us |
| C1-2 | MINOR | Older than the slices: the main thread's Bay bake only ever added the worker's planes (`adoptPlanes`); a 900-pixel voyage left 6,314 entries, growing with the distance sailed | FIXED at the root: the keep is the base bake's law (`PLANE_KEEP_MAX`, `PLANE_KEEP_RADIUS` - one home, the worker's eviction reads it) and every adopt keeps it; ETHER-DEEP's own `ETHER_KEEP_*` gave way to it |
| C1-3 | NIT | The host's dry check flooded a fresh Eltheric cell on the main thread (1.3-7.8 ms at a landfall) before the worker's trip flooded it again | FIXED: the check reads only the sea bits this thread holds (`holdsSea` - the Bay's always; the Eltheric's those flooded or sent, the pixel's and its cardinal neighbours'); a fresh cell is the trip's |
| C1-4 | NIT | The places' rects at mount allocated a 16 KB tilemap per template | FIXED: one scratch tilemap, cleared per template (`deepWatersLocationRects`' own way) |
| C1-5 | NIT | ONE HOME: the bakes' pair routed by its own frame test beside `waterFrameOf` and `inEther` | FIXED: `DeepWatersBakes.of` and `frameOf` read `waterFrameOf` |
| C1-6 | NIT | `DeepWatersBakes.answers` had no caller but a test | FIXED: removed |
| T-1 | MAJOR | ETHER-OW broke `test/world/owdungeons.test.js` (its host list lifted alone, `tvDungeonRowsAt` undefined) - the branch red, and 50 OW-DUNGEONS and TV-PERF records without a verdict | FIXED in feabe8089 (found by the author's own changed-tests run at the same time): the lists' rows lifted beside it |
| T-2 | MAJOR | The find list and the model list past the Veil were unpinned (and an isle's row's region) | PINNED: lifted and run over an uncharted ruin within a kilometre (`test/systems/travel/ether_ow.test.js`) |
| T-3 | MAJOR | The chase word's place was unpinned on its row and on the column's floor; the moved pins refused only values where floor and truncation agree | PINNED: both axes, the floor, a whole native unit, the world's last pixel |
| T-4 | MAJOR | The bakes' pair: 5 of its 13 delegates routed in a test, the Bay's rows into the Eltheric's bake and an eviction's halves unpinned | PINNED: every delegate on both sides and off the map, prepare and evict, the Bay's rows never adopted past the Veil |
| T-5 | MAJOR | "The near kept" could not fail (a prepare rebuilds what eviction drops), and the main thread's bound was unpinned | PINNED: a marked plane kept as the same bytes, the bound exact, an adopt bounded, the classes let go |
| T-6 | MINOR | A tile's neighbour climates by an isle unpinned | PINNED: an ocean pixel by Veilhaven wears the isle's, asked nowhere but the box |
| T-7 | MINOR | A frame's south edge unpinned | PINNED: closed on every side, the box's and the Bay's |
| T-8 | MINOR | `etherPlaceIsle`'s row unpinned | PINNED |
| T-9 | MINOR | A raider's levels and the band's tier drew the same pool at the test's level 5 | PINNED: a captain of level 1, a seed the levels and the tier draw apart |
| T-10 | MINOR | The places' rects pinned for the haven alone | PINNED: a ruin's and a port's, each its own list's |
| T-11 | MINOR | "Past the box: no ground" was refused by the water law, not the ground | PINNED: over the continent's land, west of the box and off the map |
| T-12 | NIT | `etherPlaceRows`' closed circle unpinned | PINNED |
| T-13 | NIT | The S5 lines in `test/systems/travel/ether_ow.test.js` could not fail (the fixture's Bay all land) | PINNED: over a world all water |
| T-14 | NIT | The pits' hold pinned for the box alone | PINNED: a pixel of the continent west of the Bay |
| T-15 | NIT | The chart's dialog's name unpinned | PINNED: the mounted window's |
| T-16 | NIT | A tile's east-edge clamp unpinned | PINNED |
| D-1 | MAJOR | The patch note said a raider past the Veil was "as tough as the waters she sails" - her class only widens the pool by the classes' first levels (a captain of 7 and more draws the same three); her hold is what the band scales | FIXED in the PR's patch notes |
| D-2 | MINOR | "An island worth its best once three players have walked it" - per pixel, as each is harvested, by accounts a week old | FIXED in the PR |
| D-3 | MINOR | The PR said "see the merge note below" - there was none | FIXED: the merge note written |
| D-4 | MINOR | The planner's widest box "under twice the Bay's whole map" - 1,001 by 1,012 pixels, 2.03 times | FIXED: "about twice", the box's size given |
| D-5 | MINOR | `ui/etherChartWindow.js`'s header said nothing on the chart is pressed - its Overworld door is | FIXED (RETIRING A FLAG DELETES THE SENTENCE) |
| D-6 | MINOR | The Page-Index's line for the sea named neither ETHER-CHART2 nor ETHER-OW | FIXED |
| D-7 | MINOR | The rename rewrote a player's own words in a quoted report | FIXED: the report's spelling restored (Field-Bugs-2026-10-12d, `test/systems/comeSailAway/fb1012d_etherstrand.test.js`); the ELTHERIC section says quoted words keep theirs |
| D-8 | MINOR | Travel-View's AUDIT OW5b S5 "the raiders' sea is on the map" - or the box now | FIXED, said in place |
| D-9 | MINOR | The chart's patch note: the ship's label can stand over a name (it takes the clearest spot) | FIXED in the PR |
| D-10 | NIT | "S5's floored pixel kept" - the floor is ETHER-OW's; S5's edges are what was kept | FIXED in both pages |
| D-11 | NIT | `tvRaidOpen`'s comment said "on the map" and a second block beside it said otherwise | FIXED: one comment (C2-3's) |
| D-12 | NIT | Naval-Combat's NAV-R said a raider's class is the player's level's and her names her seed's - not past the Veil; ETHER-OW's bullet was added below instead of amending it | FIXED in place |
| D-13 - D-16 | NIT | Four test titles and comments said what was not so (a cell's "three cells", a host "carves the Bay alone", bands "born" on the land past the Bay, the governor's line read backwards) | FIXED |
| D-17 | NIT | The re-aim lists left out captlog's CL-ether-crowned | FIXED in the bible and the PR |
| D-18, D-19 | NIT | The PR's ruler and far-ports words overclaimed | FIXED in the PR |
| D-20, D-21 | NIT | Punctuation that joined two records into one | FIXED |

## Read and kept

The Bay byte-identical under ETHER-DEEP; every cell's ring open sea over all 146,714 isles; a cell's flood its 3 x 3's
(20,000 pixels, no difference); the box's edges; the eviction bounded on a 400-cell crossing; the host's gating and
`?ether=off`; Ocean Holes' ids; the floor systems' coordinates. The node law's answers identical over 154,825 cells;
the ids' edges; the server's paths and the deploy's filter; the chart's door the held map's; the boot's TDZ; `bandOk`
and the raiders' sea keeping the Bay's answers; the bands made for the isles' nine climates; online ids and cells
signed. "132 of 1,499 places' pixels hold water" re-measured (205 ports, 1 wet; 1,294 ruins, 131 wet); the open
ocean's depth at the default Water Depth a median of 207 m. Fourteen of the scratch survivors were judged equivalent,
each with its reason (lane T's report: a switch no box pixel is asked under, a binding assigned at boot, the browser's
own `[hidden]` rule, the cut cells' open sea).

**Not verified here:** the places' rects' mount cost against the player's own MAPS.BSA and BLOCKS.BSA (no archive in
the audit), and the Overworld risen past the Veil in a running world (the host's own code was run over the sea's real
ground; the view, its painter and its journeys are the Bay's, unchanged).

## The merge with main's localization arc

Main took the localization arc (#865) while the audit stood, and its ratchet (`test/systems/l10n4_hardcoded.test.js` - no file
holds more hard-coded English than it did) found the chart: ETHER-CHART2 rewrote `ui/etherChartWindow.js` with 22
literals of prose where main's old chart had 6. FIXED at the root, by the arc's own brief (`tools/l10n/ROUTE-BRIEF.md`):
every word the chart's own code writes - its title and line, the ruler's Veil and edge, the key, a way, an isle's line
and card, the scale, the haunts, the ship's pointer, the hint, the buttons and the screen reader's names - goes through
the text core (`t('sea.chart.*', English, args)`), read when it is drawn (the key's rows and the ruler's words are
getters, never read at load), one pattern with its arguments (a plural for every count). English is byte for byte what
it was. The English catalog took the 33 keys (`node tools/l10nExtract.mjs`, 2,470), and they were drafted in-session
into the thirteen whole languages (`tools/l10nInSession.mjs`, TRANSLATE-BRIEF; each its own word for the Overworld,
its Close and its spacing); the twelve still drafting owe them with the rest of their rows, unoffered as L10N6 left
them. The chart's count is 0 now, and the counts ELTHERIC had already lowered were written down (`captainLedger.js`
18 to 15, `ethericSea.js` 9 to 8, `etherPlaces.js` 1 to 0).
LEFT, and why: the sea's own vocabulary - its name, its bands', its isles' kinds and the compass points - is
`world/ethericSea.js`'s, and the chart passes it as arguments in English. That module serves the account Worker too
(ETHER-NODES), so its words are routed with it, not from the chart; the patterns are ready for them (`{sea}`, `{kind}`,
`{point}`).

## The pins

`test/systems/audit_etherow.test.js` (5) - C2-1's law and the service end to end over the real database, C2-2's plates lifted
and run, C2-3's board lifted and run, and the chart in French and in English (the merge's routing). The rest stand in the slices' own files: `test/world/deepWater/ether_deep.test.js` (C1, T-4 - T-7,
T-10, T-16), `test/systems/travel/ether_ow.test.js` (T-2, T-3, T-8, T-11 - T-13, T-15, C2-3's raiders), `test/systems/naval/nav_r_raiders.test.js`
(T-9), `test/scenes/oh_host.test.js` (T-14). `tools/mutants/audit_etherow.json` (50 records) - every fix and every pin the audit
added, and the routing's - all die; the 115 records aimed at the chart across seven lists all die after it. PIN MOVED: the chart's routed lines in `test/ui/etherchart2.test.js`, `test/ui/audit_etherchart2.test.js` and
`test/systems/naval/auditcaptsea.test.js` (their English assertions as they were); the account version in nineteen suites (acct125) and the relay's in its own (world199);
`test/net/seat1b_client.test.js` (the relay's mint reads the one home); `test/world/audit68_worldjs.test.js` (the board's decision
asks the Veil); `test/systems/ows3_raiders.test.js` (the raiders' host reads the sea fight past the Veil);
`test/systems/travel/tv6_dungeons.test.js`, `test/player/eyeOfTheBeholder/ow5_audit.test.js` and `test/world/owdungeons.test.js` (the lists' key). Re-aimed by
content: four of `tools/mutants/ether_deep.json` (the raw reader, the keep, the route, the rects' scratch),
`seat1b.json`'s relay record, `soc1.json`'s relay version, the account-version records, and seven records the
routing moved (audit_etherchart2, audit_etherow, auditcaptsea two, eltheric, ethercross two).
