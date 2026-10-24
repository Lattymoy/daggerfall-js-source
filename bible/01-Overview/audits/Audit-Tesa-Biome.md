# AUDIT TESA-BIOME (2026-10-24) - the biomes past the Bay, read cold

The owner, of TESA-BIOME (`03-World/Tamriel-Biomes.md`, at 34885b50c7): **"Lets do a comprehenaive audit and ensure this
is perfect"**. This page is the audit: the zones and the ground, the lore, the fauna and the encounter law, the jungle
and the running game, the pins, the mutants and the record. Each finding has its verdict here. What it changed is written
into the pages it touched and in the code beside the fix, marked `AUDIT TESA-BIOME` with the finding's id.

The owner decided two of its findings (2026-10-24): the Nibenay Valley is the Pocket Guide's grassland, ringed by the
jungle (L4) - "Grassland ringed by jungle"; Colovia stays jungle and the Gold Coast is the Pocket Guide's deciduous
forest (L5, L12) - "Colovian jungle".

## How it was run

Five lanes, each a cold adversarial reader of a FROZEN head (34885b50c7 - Home.md's DO NOT FIX WHILE THE VERIFIER IS
READING), told to reproduce a finding before reporting it and to end on what it checked and found sound:

| Lane | Over | How |
|---|---|---|
| Z | the zones and the ground: where a zone is on both lands, the peaks, the wander, the caches, the ground's, the air's and the weather's reads, the roads, the ecotone, the cost | 11 findings; probes over the authored rings and the player's own trace (ARENA2, fit (38,57) x 15.5), the cost measured |
| L | the lore: every zone's country and every roster's creatures against the Pocket Guide, the games and UESP | 29 findings; each with its sources and a confidence |
| F | the fauna and the encounter law: the table law, DFU's roll, the stand-ins, the levels, the door, the hosts, the grants | 8 findings; every table run through the real roll at every level |
| J | Cyrodiil's jungle past the Bay and the running game | the jungle's field and host; the game booted on the trace and walked (below) |
| P | the pins, the mutants, the record and the merge | 13 findings; the 37 records and 32 adversarial mutants of its own run, the merge's 571 re-aimed records judged |

Every finding was reproduced on the branch before its fix.

## What it found, and what was done

### Z - the zones and the ground

| Id | Finding | Verdict |
|---|---|---|
| Z1 HIGH | On the trace (the game's land) one zone held no land and another 1%: the seeds were the rings' points, and the trace's coasts are not the rings' | FIXED: the seeds stand on the land in use (`standSeeds`, `SEED_SNAP`); with ARENA2 every zone pinned to hold land on the trace |
| Z2 MED | On the trace four cities stood in another zone, and 44 of 102 seeds were off their province | FIXED: the seeds stood; a city's own ground (`CITY_GROUND`), a heart giving way to another zone's city; every city pinned on the trace |
| Z3 MED | The roads' region cache could not see the zones' law: a cached region kept its old countryside | FIXED: the print carries `BIOMES_VERSION` |
| Z4 MED | No ecotone at a zone border past the Bay - hard 819 m pixel edges | FIXED: the 3x3 reads a neighbour past the Bay (`climateNeighbourIn`) |
| Z5 MED | The air law kept the zones' air from before the trace landed | FIXED: the air's ground carries the zones' stamp as its `version`; the kept tiles drop when it moves |
| Z6 LOW | Peaks per province: Red Mountain was "the Velothi Mountains" - snow air and bears on Vvardenfell | FIXED with L2 |
| Z7 LOW | Cost: a cold zone read is 4 to 12 times the province read it replaced - about 1 s of worker CPU a road region, an air tile 9 ms against 1 | PART FIXED: the air reads a pixel's zone once. A zone raster is not built: the road region's cost is a worker's, once a region, and is RECORDED here |
| Z8 LOW | Two ground reads past the Bay followed the Bay's edge: the weather map's births, and the landforms' hills | The weather map FIXED (`climateOfField` reads a land climate past the Bay). The landforms' clamp predates TESA-BIOME and is OWED: moving it re-shapes every hill past the Bay, and the roads and places stood on them - its own slice. The page claims neither |
| Z9 NOTE | The page left out what the code does | FIXED: the page rewritten from the code (its tables generated) |
| Z10 NOTE | The cache key collided outside -8192 <= y < 24576 | FIXED: exact within 32768 of the Bay's corner |
| Z11 NOTE | The stamp moved on an identical re-install; the cache's size read stale | FIXED: the fit by its numbers; the size reads the stamp first |

### L - the lore

| Id | Finding | Verdict |
|---|---|---|
| L1 HIGH | The Dreugh and the Lamia are water creatures, on 14 land rosters | FIXED with F1 |
| L2 HIGH | Red Mountain fell in the Velothi zone: snow ground, bears, wolves and trolls on Vvardenfell | FIXED: peaks by range - Red Mountain its own zone, warm air, Daedra and ash |
| L3 HIGH | The Tenmar stood in the wrong place; Pellitine was savanna | FIXED: the Tenmar between Torval and Senchal, the Pellitine coast, Anequina's badlands and plains apart |
| L4 HIGH | The Imperial City's heartland was rain forest; the Pocket Guide makes it grassland | FIXED, the owner's call: the Nibenay Valley's grassland, ringed by the Nibenay's jungle |
| L5 MED | The Colovian Highlands fell in the Gold Coast | FIXED: Colovia's seeds on its uplands |
| L6 MED | Western mainland Morrowind was "the Bitter Coast" and "the Ashlands" | FIXED: Stonefalls; the Bitter Coast on Vvardenfell's south-west |
| L7 MED | Dwemer constructs roamed the open country | FIXED: the Sphere very rare where the ruins are; the Steam Centurion in no wild |
| L8 MED | The page cited Lady Cinnabar for the jungle; the lore makes Septim-era Cyrodiil temperate | FIXED: Recorded choice 1 names the jungle a departure, and why |
| L9 LOW | The Pocket Guide shipped with Redguard, not Arena, and is not the lore "closest to that day" | FIXED: the page's era section |
| L10 MED | The Land Dreugh stood in as the aquatic Dreugh | FIXED: no stand-in |
| L11 MED | The Dragonling, Daggerfall's own, was missing | FIXED: in Wrothgar and its neighbours, the dry south; Recorded choice 8 |
| L12 MED | Colovia and the Gold Coast: "deciduous forest" is DF's Woodlands | FIXED for the Gold Coast (Woodlands); Colovia jungle, the owner's call |
| L13 LOW | Golems stood as wild animals | FIXED: none in a wild |
| L14 LOW | Evermore fell in Wrothgar | FIXED: Bangkorai |
| L15 LOW | Necrom in Deshaan | FIXED: the Telvanni Peninsula |
| L16 LOW | Gideon in the Shadowfen | FIXED: Blackwood, one roster both sides of the border |
| L17 LOW | "Glenumbra" north of the Bay holds Northpoint | FIXED: the Northpoint Coast |
| L18 LOW | Silvenar in Reaper's March | FIXED: Malabal Tor |
| L19 LOW | "Cloudrest on its crown", but Cloudrest is not on Eton Nir | FIXED: Cloudrest the Vine Coast's; Eton Nir's lore string |
| L20 LOW | "The Forsworn" in 3E 405 | FIXED: the Reachmen |
| L21 LOW | Harpies across Skyrim | FIXED: the Reach's alone, for its hagravens - Recorded choice 11 |
| L22 LOW | The Giant Bat the commonest night creature of Vvardenfell | FIXED: Morrowind's nights its rats and scamps |
| L23 LOW | Stand-ins that read wrong (a wolf as a sabre cat everywhere, a troll as a giant) | FIXED: `STANDIN` only where true, a roster's own where its lore has one |
| L24 LOW | Quotes not verbatim or misattributed; the code claimed the page named each creature's source | FIXED: verbatim, attributed (UESP's summaries as UESP's); the page's Sources section |
| L25 LOW | The Grazelands drawn as ash; the Ascadian Isles as swamp | The Ascadian Isles FIXED (their own zone). The Grazelands stay in the Ashlands' zone - RECORDED: Vvardenfell is about twenty picture units across and holds four zones |
| L26 NOTE | The Mummy in Morrowind's and Black Marsh's nights | Morrowind's ancestral tombs keep it; Black Marsh's none - Recorded choice 12 |
| L27 NOTE | Summerset on DF's Subtropical | Kept for the Vine Coast; Auridon Woodlands - Recorded choice 6 |
| L28 NOTE | Haafingar is not "barren tundra" | FIXED: Solitude stands in the Pinewoods (the Karth forest) |
| L29 NOTE | Snow on Morrowind's Mountain ground in winter? | TRACED: on the enhanced lane (the default) snow lies by the air law, and Morrowind's air is warm; on the classic lane DFU's calendar dresses every non-desert ground, past the Bay as on it - the page's Snow paragraph |

### F - the fauna and the encounter law

| Id | Finding | Verdict |
|---|---|---|
| F1 HIGH | Aquatic creatures (the Dreugh, the Lamia) on land tables, where their motor never moves them | FIXED: no aquatic creature on a land table (`isAquatic`); pinned |
| F2 MED | No grant could name a pixel past the Bay, so the grants' zone law never ran | FIXED: `validGrant` takes any world pixel (`worldPixelOk`); the reader past the Bay pinned |
| F3 MED | Degenerate tables: one class filled the high slots (97% of a level-20 player's meetings) | FIXED: the window (`WINDOW_SLOTS`, `WINDOW_MAX`), the cover; every table held to DFU's band through the real roll |
| F4 LOW | A level-1 player in the High Peaks at night met only level 9-10 monsters | FIXED: the peaks' small things; the band pin's 30% |
| F5 LOW | The DEX variant read levels the install rewrites | FIXED: `faunaLevelIn`, off the frozen table and the mod's own read; a table is its roster and two switches |
| F6 LOW | The roaming band's `fauna` is unreachable - no band is born past the Bay | RECORDED: wired, latent; the page says so |
| F7 LOW | The last fallback could stand a person below `CLASS_FROM`, or a V twice | FIXED; pinned |
| F8 NOTE | The page against the code (the hosts, the interiors, the lairs, the cover, the reach, the third element) | FIXED: the page's hosts paragraph and Recorded choice 10; the per-entry stand-in built |

### P - the pins, the mutants, the record

| Id | Finding | Verdict |
|---|---|---|
| P1 MED | Red Mountain in the Velothi peaks | FIXED with L2 |
| P2 MED | Nothing pinned the grants' reader past the Bay | FIXED: `grantDiceRefusal` pinned on a grant past the Bay |
| P3 MED | The world host's three fauna reads pinned by a count | FIXED: each read pinned and mutated by its own text |
| P4 MED | WA1's fast-travel window spanned the rest of the host | FIXED: it ends at `fastTravelTo`'s close |
| P5 LOW | A home1 ordering compared positions in two files | FIXED: one file |
| P6 LOW | tamriel3's re-aimed climate pins repeated the code | FIXED: concrete zone keys |
| P7 LOW | The table law pinned in outline | FIXED: a table golden in either variant |
| P8 LOW | The classic stand-ins unpinned | FIXED |
| P9 LOW | The wander's shape and the far caches unpinned | FIXED: golden wander points; the far distances float32 along the valley's edge; a capped field's answers |
| P10 LOW | Page-Index said thirty-six zones (the code had 35) | FIXED: forty-three, after this audit |
| P11 LOW | Two comments named what was not there | FIXED |
| P12 NOTE | The page's seed column named cities the seeds did not stand on; the cover left out | FIXED: generated from the code |
| P13 LOW | `tesa7.json` TESA7-host-not-deleted survived (before the merge too); the arc said 66 | FIXED: `tesa7_country` pins a pixel that stops standing a place; 65, all dead |

### J - the jungle and the running game

| Id | Finding | Verdict |
|---|---|---|
| J1 MED | The jungle floor's kept 3x3 outlived its field: when the zones' stamp moved (the trace landing), the floor still claimed the old field's pixel - 400 of 400 claims - until the player left it | FIXED: kept per pixel and per field (`scenes/jungleHost.js` floorClaims); pinned |
| J2 NOTE | "The Bay's own field unchanged to the bit" holds for every Bay pixel's distance, not for the terrain job's 3x3 at the Bay's eastern edge: Bantha's last column (88 pixels) reads its off-map neighbours' own distances now | KEPT, the page narrowed: it is the field's own law at the edge - the plain field read the off-map pixel as far outside and faded the jungle inside its last pixel |
| J3 NOTE | The far maps at their cap hold 44.5 MB, reached after about 24,000 stream stops; a drop changes no answer | RECORDED |
| J4 LOW | The jungle's edge against another province runs straight for up to 88 km: a province border past the Bay is the trace's picture pixels (12.7 km), and no zone crosses it | OPEN while the lane's report lands |

## The mutants

`tools/mutants/tesabiome.json` rewritten against the code as it now stands, lane P's adversarial records folded in: **83,
all dead**. Five survived its first run; each was answered - `keepOthers` in the peaks law was dead code (the lift is a
max, and a named range answers first) and is gone; the hearts' rule, the far field's float32, a used V barred in the
fallback and the cover's order each have a pin that kills it. Five records elsewhere re-aimed by content and judged dead:
`grant3.json` GRANT3-species-unchecked and GRANT3-level-law-off, `grant4.json` GRANT4-watch-grant-any-species and
GRANT8-reader-unchecked (the species law moved out of the grant host, `grantDiceRefusal`), and `tesa14.json`
TESA14-the-print-blind-to-the-nodes.
