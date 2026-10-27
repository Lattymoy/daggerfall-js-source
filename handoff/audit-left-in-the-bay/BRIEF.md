# AUDIT: NO SYSTEM LEFT BEHIND IN THE BAY - shared brief (every lane reads this)

The owner of DFO Online (a Daggerfall-derived JS game, repo /home/user/daggerfall-js-source) asked for "one last deep
comprehensive audit on everything and ensure no system is left behind in the bay. Take your time and be thorough and
detailed."

THE BAY vs PAST THE BAY. Daggerfall's own map is the Iliac Bay: Bay pixels x 0..999, y 0..499 (y south), MAPS.BSA's 62
regions, WOODS.WLD's heights, CLIMATE.PAK/POLITIC.PAK. The game now streams the whole continent of Tamriel round it
("TESA", "the land past the Bay"): pixels in the SAME Bay coordinates but outside 0..999 x 0..499 (negative or past the
edges), the nine provinces as regions 62..70 (formats/mapsTables.js BAY_REGION_COUNT 62, PROVINCE_REGION_NAMES,
regionOfTheatre, CYRODIIL_REGION), theatres 1..9 (world/worldWide/worldGrid.js theatreAt; 0 is the Bay), areas (a
province's 96-pixel DISTRICT; the Bay's areas are its 62 regions), TESA's places (capitals, Arena cities, towns,
dungeons) registered in the world's places registry (world/worldWide/worldPlaces.js; world/pastBayRows.js
pastBayPlaceRows; WW7-1). "Left behind in the Bay" = a system that works on the Bay but on the land past it fails,
silently does nothing, gives a wrong answer, or is missing.

READ FIRST: CLAUDE.md; bible/Home.md (Process rules); bible/01-Overview/Port-Doctrine.md (Scope);
bible/03-World/World-Wide.md WHOLE - its decisions, every slice's "What stays the Bay's (recorded)" list (DELIBERATE,
RECORDED exclusions - not findings unless their stated reason no longer holds), its status table (WW4 serpent IN PART,
WW5 Hollows/Starfall per theatre PLANNED, WW6 raids past the Bay PLANNED) and WW7; skim bible/03-World/Tamriel.md's
headings for the land past the Bay.

WORLD-AWARE BUILDING BLOCKS (what "right" looks like): worldGrid.js (inWorldGrid, worldPixelKey, theatreAt, areaAt,
areaName, BAY_THEATRE, THEATRE_COUNT); worldPlaces.js (the registry: placesAt, register/registerPixels, the Bay's
provider and TESA's); world/tamriel/tamrielFrame.js inBay; world/tamriel/tamrielGround.js (groundWoods/groundMaps - the
COMPOSED readers that answer past the Bay; woods.isTamrielGround; tamrielClimateAt; groundPoliticIndex);
world/tamriel/tamrielLand.js (provinceKeyBeyondBay, provinceKeyAt); net/wire.js (WORLD_PIXEL_BOUND, worldPixelOk,
mapPixelOfWire); world/arenaPlaces.js; world/tamrielCapitals.js.

BAY-BOUND CODE SHAPES TO HUNT (in your lane's modules): `y * 1000 + x` / MapsFile pixel ids used as a system's key;
MAP_WIDTH/MAP_HEIGHT or literal 1000/500 bounds and `x < 0 || x >= 1000` style clamps; the RAW Bay readers
(maps.getClimateIndex, maps.getPoliticIndex, woods.getHeightMapValue on a reader that is not the composed one);
mapDict / maps.getLocation / MAPS.BSA-only place lookups where the registry should be read; arrays sized 62 or
`r < 62` / `regionIndex < BAY_REGION_COUNT` checks; `inBay(...)` gates; getPixelFromPixelID; PORT_LOCATION_IDS; region
name tables; a feature whose site scan walks only the Bay's places.

METHOD: map every system in your lane (list its modules), trace how it reads places, pixels, regions, climate and
height FROM A REAL CALLER (scenes/world.js and the host modules it wires; HOST-SPLIT moved many blocks into
scenes/*Host.js). Classify each: (a) world-correct; (b) recorded exclusion - cite the doc line and say whether its
reason still holds today (an exclusion justified by "no places past the Bay yet" is stale now that WW7-1 registered
TESA's places); (c) FINDING - works on the Bay, broken/absent/degraded past it, unrecorded. Verify each finding with a
realistic path from a real caller, and where you can, a PROBE: a node script in your own scratch dir
(/tmp/claude-0/-home-user-daggerfall-js-source/dae0405a-f226-582d-9131-f2490d1f38e5/scratchpad/audit/<LANE>/) that runs the real
code. The freeware data is at /home/claude/dfdata/arena2 (ARENA2_PATH). test/world/rumarewater.test.js's ARENA2 test
shows loading the trace, the fit, MAPS.BSA, WOODS and the composed ground; test/world/audittesa2p_world.test.js shows
registering TESA's places (pastBayPlaceRows). The streamed world itself cannot run headless past the Bay (a known
crash, #1184's J6), so probe the modules directly.

HARD RULES: READ-ONLY on the repository - never edit, create or delete anything under /home/user/daggerfall-js-source.
Never run a git command that changes state (no checkout, stash, reset, commit, merge, add, restore, clean): the working
tree holds a STAGED MERGE IN PROGRESS that must not be disturbed. `git grep`, `git log`, `git show`, `git diff` are fine.
Don't run the whole test suite; single test files are fine. Don't push, comment on GitHub or contact anything external.

REPORT (your final message - the only thing the lead sees):
1. FINDINGS, ranked by player impact. For each: ID (your lane letter + number, e.g. A3); the system; what a player sees
   past the Bay vs on the Bay; the code (repo-relative file and the quoted line, plus line number); the path from the
   real caller; the evidence, marked CONFIRMED-BY-PROBE (paste the key output and the probe's path), CONFIRMED-BY-READING,
   or SUSPECTED; recorded or not; the fix's shape and rough size (one line / a module / a relay+account change with a
   version bump) and its risk.
2. RECORDED EXCLUSIONS in your lane: each with its doc cite and "reason still holds: yes / no / partly" and why.
3. COVERAGE: every system you checked and found world-correct, one line each, so it is visible what was looked at.
Be concrete and exact. No generic advice. Do not pad: a short true report beats a long speculative one.
