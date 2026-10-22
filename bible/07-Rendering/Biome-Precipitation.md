# Biome Precipitation (PRECIP1-4, 2026-10-19; AUDIT PRECIP the same day)

**The owner's call (2026-10-19): "I also want to begin giving each biome their own precipitation. It shouldnt snow
everywhere or rain everywhere when the season is winter, etc. It should truly be dynamic just like how we have a dynamic
cloud and weather system. If its snowing in one area and raining in the next, the transition should be seamless both in
ground texture and everything else. This needs to be accurate and as detailed as possible."** Then, of what was built:
**"Audit this and ensure perfection. No band aids"** - `01-Overview/audits/Audit-Precip.md` is the audit, and this
page says what stands after it (each change marked `AUDIT PRECIP` with its finding's id).

On the enhanced lane what falls and what lies are read off one physical quantity, the AIR's temperature at a place, a
height and a minute. Every system on the weather map (`Weather-Arc.md` WEATHER3) falls at a SNOW SHARE: all snow at
0 C and under, all rain at 2.5 C and over, sleet between. The ground keeps what fell and has not melted, at every height:
its SNOWPACK. Each fragment of terrain wears its own climate's winter tile in the share of the snow at its own height
(SNOW-FACE, below: a steep face's too). A white peak stands over a green valley in a thaw, a cold front brings the snow down to the sea, the jungle's rain
stops at its edge in a band of sleet, and the Alik'r's sands never see a flake (its mountain fringe does, 0.2 % of its
winter's wet hours). Pure in place and minute: every client sees the same snow, offline and online.

DFU has no temperature. Its weather table rolls Snow for a climate in Winter and never otherwise, and its ground wears the
winter archive for the whole of Winter on the calendar (`TerrainMaterialProvider.GetClimateInfo`'s +1;
`world/climateSwaps.js` `getTerrainGroundArchive`). The port's WEATHER2a then turned rain over that ground into snow. So
a winter rain in the Rainforest fell as snow, a summer storm on a 1,900 m peak fell as rain, and the line between the two
was a map pixel's straight edge. The classic lane is DFU's, 1:1, and untouched.

## PRECIP1 - the air (`src/systems/weather/airTemperature.js`)

`airTemperature(x, z, altitude, t, skyMinutes, fall)` is the sum of five terms:

- **the climate's season** (`seasonAir`): its mean less its seasonal half-range on a cosine through the 360-day year,
  coldest on `COLDEST_DAY` (the 21st of Morning Star).
- **its day** (`dayAir`): warmest at `WARMEST_HOUR` (15:00), coldest twelve hours round, damped toward
  `FALL.dayUnderCloud` by the cloud COVER overhead (the deck's, continuous - AIR-9: it was any fall at all, a 2.7 C step
  at a rain core's edge).
- **the synoptic spell** (`spellAt`): two octaves of value noise over space and time (240 km by four days, and 60 km by
  one), drifting east-north-east with the Bay's air (`SPELL.drift`), widened to [-1, 1] and multiplied by the climate's
  own swing. These are the cold snaps and thaws, never rolled.
- **the lapse**: `LAPSE_C_PER_M` (6.5 C a kilometre) times the height above the sea (`SEA_LEVEL_M`, the kernel's ocean
  elevation at the streamed scale). With no height given, the DRAWN ground's mean there is used (AIR-3:
  `world/landforms.js` `meanGroundField`, the landforms' relief and hills with the kernel's terms - the byte alone read
  110 to 900 m under the ground the player stood on, so the calibration was not what the player got).
- **the fall's chill** (`airFall`): the place's fall cools the air by `FALL.chill` at full intensity, and its snow
  systems bring `FALL.snowCold` more. One air a place (AIR-8): every band falling there wears the air of the place's
  whole fall (`weatherMap.js` `wornAmong`'s `air`).

**The law's map** (`systems/weather/airGround.js` `lawAirGround`, handed by the host with `setAirGround`; AIR-1): CLIMATE.PAK
as the file holds it (`undilated` - the coastal dilation is a texture repair, and its edge drew a snow line in the sea),
the continent past the Bay and the Eltheric Ocean's own composition, whatever the client's own rows - online every client
reads one air. It answers the drawn ground's mean (`groundAt`) and its top (`topAt`, the snowpack's ceiling).

**The blend.** Each pixel's air (`pixelAir`) is its climate's row - a sea pixel's the nearest land's within
`MARITIME.reach` - blended toward the Ocean's by its MARITIME SHARE: a half at the shoreline, none 12 pixels inland, all
12 pixels out (AIR-10; a two-pass distance transform a 32-pixel tile, kept). The pixels' airs stand at their CENTRES and
are read bilinearly between the four about a point (`airParamsAt`), so the air warms across a Mountain-to-Desert border
over the pixel either side of it, never at the edge. A climate's numbers are its own at its median row (`row`,
CLIMATE.PAK's medians, pinned against the file - AIR-7); the latitude (`LATITUDE_C_PER_ROW`, 0.008 C a row south) moves
its far ends, the point's row held to the Bay's and none in the Eltheric's box (`latitudeShare`, eased across its margin).

**A BIOME OVERLAY** leans the air toward its own numbers by its share (`setAirBiome`). The jungle registers the
Rainforest's air over a band of its own, kilometres wide (`world/jungle/jungleRegion.js` `jungleAirShare`,
`scenes/jungleHost.js` - AIR-12: it leaned by its haze's few hundred metres, a 19 C wall with a band of sleet ~75 m
wide), so the jungle rains where the land's own winter would snow - in the Dragontail foothills its western edge stands
on (the Mountain's climate; BANTHA2 - at BANTHA1 it stood on Glenpoint's Mountain Woods) - and its edge is a walk through sleet.

| Climate | mean | season half-range | day half-range | spell | median row |
|---|---|---|---|---|---|
| Ocean | 11 | 6 | 2 | 3.5 | 263 |
| Desert | 22 | 9 | 8 | 3.5 | 443 |
| Desert2 | 21 | 10 | 9 | 3.5 | 476 |
| Mountain | 13.8 | 11 | 5 | 5 | 194 |
| Rainforest | 26 | 2 | 4 | 1.5 | 328 |
| Swamp | 16 | 7 | 3 | 3 | 325 |
| Subtropical | 20 | 6 | 5 | 2.5 | 387 |
| MountainWoods | 11.2 | 11 | 5 | 5 | 134 |
| Woodlands | 11.4 | 11 | 4.5 | 5 | 111 |
| HauntedWoodlands | 10.4 | 11 | 4.5 | 5 | 18 |

The means are the air reduced to the sea, re-fitted at the drawn ground on the measured rows with the sea's hand in
(AIR-3/7): a range that stands high reads warm here and cold where it stands. HauntedWoodlands, too small a climate to
fit, keeps its degree under the woodlands.

**Calibrated on the freeware's map** (`sh tools/fetch-data.sh`; every land pixel of each region at its own drawn ground,
random minutes of ten years, a fall of 0.7). Each cell is the share of wet hours that fall as snow / sleet / rain:

| Region | winter | spring | autumn |
|---|---|---|---|
| Northmoor | 64 / 25 / 11 | 11 / 12 / 77 | 4 / 8 / 88 |
| Daggerfall | 66 / 22 / 12 | 10 / 11 / 79 | 5 / 8 / 87 |
| Wayrest | 67 / 20 / 13 | 12 / 12 / 77 | 5 / 9 / 86 |
| Glenpoint | 83 / 14 / 3 | 18 / 13 / 69 | 10 / 11 / 79 |
| Wrothgarian Mountains | 92 / 6 / 2 | 30 / 13 / 57 | 20 / 12 / 67 |
| Dragontail Mountains | 74 / 15 / 10 | 17 / 12 / 71 | 9 / 10 / 81 |
| Ilessan Hills | 78 / 17 / 5 | 15 / 12 / 73 | 8 / 10 / 82 |
| Dwynnen | 71 / 20 / 9 | 11 / 13 / 76 | 6 / 8 / 86 |
| Alik'r Desert | 0 / 0 / 99 | 0 / 0 / 100 | 0 / 0 / 100 |
| Sentinel | 0 / 0 / 100 | 0 / 0 / 100 | 0 / 0 / 100 |

Summer is all rain everywhere, and so are the Rainforest, the Swamp and the Subtropical climate. The suite holds the
shape and the rows: `precip1_air.test.js` THE CALIBRATION and the medians (ARENA2-gated).

## PRECIP1/2 - what falls (`weatherSim.js`, `weatherFront.js`, `render/precipitation.js`, the sky)

- **The law's lane** (`precipLawOn`): the enhanced lane's ground law (`snowGroundLawOn`), the weather map (`weatherMapOn`
  - AIR-2: the map's history is what the snow lies from, and with "Weather as places" off the law ran over WEATHER2a's
  calendar word), a host that handed the air its map (the streaming world does; the fixed city of `?exterior` hands it
  none, and its ground wears DFU's season), and no `?biomeprecip=off` (refused online - AIR-13).
- **A place's share** (`snowShareAt`) is `snowShareOf` of the air there under the place's fall. Through `mapGround` a wet
  word falls as `phaseWord`: snow from a half's share up, else its own word, and a snow front in warm air falls as rain.
  The word is pure in the share (`phaseRound` - AIR-6: it carried the client's history, so two clients at one place
  could wear two words); everything continuous reads the share. A system's own word keeps its violence (`raw`): a storm
  in freezing air is a blizzard, its lightning, wind, episode and deck the storm's (FALL-3).
- **A phase is no crossing** (FALL-2): the front keys on the SYSTEM (`systemWordOf`, the raw word), and a phase alone
  changes nothing the weather's own changes drive (`weatherPhaseFlip`) - no wind front, no episode re-roll, no preset cut.
- **The front** (`weatherFront.js`) carries the share (`snow`) and the two looks' levels (`rain`, `flakes`). Rain, a storm
  and snow are one fall under the law (`fallOf`). The outgoing fall drains at the share it fell at, and a dry word leaves
  the share where the last fall left it (FALL-1: a snowfall's end relabelled its last flakes as drops). The ear follows
  the drops, the skin the whole fall in its shares, the water's rings the drops (AIR-5).
- **The drops and the flakes** (`PrecipitationRenderer.drawFall`, both hosts): a wet mode at a share draws the rain's
  look (a storm's, under a storm) at the drops' level and the lab's flakes at the flakes'. The flakes' volume is carried
  aside on the wind's own offset (`MIX_SHIFT`) at every share (FALL-6: they jumped where the share crossed one), so a
  flake never falls in a drop's column. `?rain=<n>` caps the two looks together. The lab's shaders and `draw` are
  untouched (WX1).
- **The sky**: each wet map cell takes the share where its fall is nearest the player, at its own band's intensity, and
  the player's own cell the player's share (AIR-4/FALL-9: it was read 30-60 km away at a fixed intensity - rain drawn
  over falling snow one wet hour in ten). Its cloud walks from its system's warm side to the snow's by its share
  (`volumetricClouds.js` `cellOfField` - FALL-5/SKY-POP: it switched profile whole at the half), and so do its curtain's
  weight and tint (`rainCurtains.js` `mixColor`), so a front over the snow line greys into white across it.

## PRECIP3 - the snow the ground keeps (`src/systems/weather/snowpack.js`)

Every `SNOWPACK.stepMinutes` (three hours) of the event clock, at each of 23 altitude levels (-600 to 3,800 m: over the
landforms' tallest ground - PACK-1; those below the sea are read on down the lapse, so a pack white to the shore still
has a snowline to blend across), a place's SWE (millimetres of water) moves on (`stepPack`):

- **the fall**: the heaviest wet band's rate there (`fallRateOf` - PACK-10), at most `rate.rain` 1.3, `rate.thunder` 3.3,
  `rate.snow` 0.8 mm an hour (PACK-2: measured against the map's own wet hours - a year's fall 850 to 1,210 mm on the
  temperate map, 150 to 290 mm in the desert, ARENA2-pinned; the guessed 4 / 10 / 2.5 fell three times a temperate
  climatology). Its SNOW share lies.
- **the melt**: 4 mm a degree-day over freezing (`melt`, the textbook's open ground) and the rain's own heat through it
  (`rainMelt`, 4.19 / 334 per mm per degree). The day's degree-hours are the cosine's own over the step's SKY interval, in
  closed form (`positiveCosIntegral`), the snow and the rain's heat its means at four Gauss points a quarter-day (PACK-8:
  online the sky runs twice the event clock, and a step read at its instant sampled four fixed sky hours).
- **the cap**: no pack holds more than `capMm`, two metres of water (PACK-3).

The air for a step is `airTemperature`'s own terms at the sea (`stepAir`). The year begins at MIDSUMMER (`yearOriginOf`:
the last grid minute at or before the sky's last midsummer, `MIDSUMMER_MINUTE` - never after the minute, PACK-9). A point
whose air can keep snow through the summer begins its year from the year before's survival (`meltsOut`, its `spin`:
the year before integrated from nothing, on the same grid - PACK-3: "no snow in the Iliac Bay outlives midsummer" was
false on the landforms' ranges); elsewhere every pack begins at nought.

**Monotone in height.** At one place and minute the air only cools with height and the fall is the same, so a step keeps
SWE non-decreasing up the levels (`precip3_snowpack.test.js` THE STEP holds it over 2,000 random steps). A place's whole
pack is therefore its SNOWLINE (`snowlineOf`): the heights its cover (`coverOf`: whole at `fullMm`, 10 mm of water,
about ten centimetres of new snow) crosses 10, 50 and 90 %, off the levels a point holds - to the one over the first at
or above its ground's top, so every crossing its ground wears and the next over it read as all the levels would read
them, and one the held levels never reach stands a level over the highest held (A-4: each crossing was clamped to a
metre over the ground's top, and a hill's top in the snowline's band read up to a third more cover than its pack).
`coverAtHeight` reads it back, and the shader reads it term for term.

**The lattice** (`SnowpackLattice`): map pixel CORNERS every second pixel (`cornerField` - HOST-5: every pixel lies in
one cell, so the bilinear of its corners' lines, the shader's, is every CPU reader's), each point integrated from its
year's origin on the step grid. A point is kept by its index, so it is never integrated twice however the window about
the player moves. A day of steps' wet systems are found in ONE walk of the weather map (`weatherMap.js`
`systemsSpanWalk`, each step's own answered by `systemsAmong`, exactly the systems a walk of that step finds - DOC-7),
the walk taken a lattice node at a time within the frame's budget (PACK-6), and kept for the points after
(`_systems`). Its births are drawn into the lattice's own memo, let go after a long catch-up (HOST-10: 30-184 MB parked
in the sim's).

- **Skipped steps.** A step that cannot lay snow on any due point is skipped: every point empty, and its air colder
  nowhere than `RAIN_ALL_C` (`stepAirFloor`: the season, the spell, every fall's chill, the step's coldest hour, at the
  highest level held). A point holds only its levels up to the one over its `ceil` (PACK-7), the true bound of the drawn
  ground over the pixels its cells cover (`topOf`, the air's map's `topAt` - PACK-1: the byte and a 600 m guess stood
  1,350 m under the landforms' ranges, and every fragment over it was white all year). The skip is exact: a skipped step
  changes nothing at any held level, and the test runs the same window with no skip and finds the same lines.
- **The pack now** (`packNow`): the blend of the point's two step packs about the minute (PACK-4: the last step's pack
  carried on under the air now showed snow its history never held, then took it back at the step). Continuous in time,
  inside its own history, pure in the minute. A clock set back inside them is answered as it stands; behind them the
  point begins again (PACK-9).

**Cost, measured on the freeware's map** (a 4-core container, Node; the 16th of Morning Star 406, noon; a window's whole history from its year's origin, the summer before included; cold = the weather map's memo
empty, warm = a second lattice over it):

| Window | steps (skipped) | 121 points cold | 121 points warm | 441 points warm | a new edge (11 points) |
|---|---|---|---|---|---|
| Daggerfall | 2,818 (72 %) | 1,205 ms | 1,008-1,104 ms | 2,140 ms | 43-58 ms |
| Wayrest | 1,404 (0 %) | 2,134 ms | 1,714-2,112 ms | 2,796 ms | 49-69 ms |
| Sentinel | 1,404 (68 %) | 416 ms | 245-333 ms | 665 ms | 12-21 ms |
| Wrothgarian Mountains | 2,537 (67 %) | 1,521 ms | 1,170-1,240 ms | 2,656 ms | 42-81 ms |

None of it is a hitch: a frame integrates within `SNOW_COVER.budgetMs` (3 ms), a frame while the world stands up and a
build's wait within `arriveMs` (40 ms) or the breather's own slice, and a window's new edge stands two lattice cells
(3.2 km) past the land the player sees, so it is integrated long before it is drawn. 101 of Daggerfall's 121 points and
51 of Wayrest's integrate the summer before (`meltsOut` is a bound: it spins every point whose air cannot be shown to
melt a whole cap before midsummer).

On the audit's frozen head Daggerfall's window took 566 ms cold and 249-276 warm, Wayrest's 772 and 321-401. The
audit's own laws cost the difference: PACK-1's true `ceil` holds levels on the landforms' hills where the old guess let
whole steps skip, PACK-3's summer before integrates a second year wherever it cannot be ruled out, and PACK-8's day is
integrated over its sky hours. `systemsSpanWalk`'s one walk a day of steps, its fronts' cells drawn the first time they
come near, and `drawCells` thinning a candidate by its season's ceiling (`seasonCeilings`) before its place is read
take back what is exact to take (DOC-7); a build's wait takes the arrival's budget while the world stands up (below).

## PRECIP4 - the ground (`render/snowCoverGlsl.js`, `scenes/snowCoverHost.js`, `scenes/pixelBuild.js`)

**The host** (`createSnowCoverHost`, wired by the world host; HOST-SPLIT) keeps an 11 x 11 lattice window about the
player. ONE CLOCK (`now` - HOST-2: a fast travel's arrival minute until the trip's own time has run, so the arrival is
built in its own snow and the sweep never tears the player's pixel down after landing) and ONE READ (`at(t)` - HOST-1:
the frames, a build's wait and the feet all read the window at one minute). A pixel's build waits for it (`settle`): the
window about the player is integrated in the breather's own slices (`left()` - HOST-N2) and read at the minute - every
time it is asked at another (HOST-1: a Recall after an evening indoors, or a load, built the player's pixel in the snow
of the minute they left). While the world stands up (`arriving` - no ground under the player) the wait and the frame
take `SNOW_COVER.arriveMs`. Each frame then integrates the window within `budgetMs`, reads the pack now every five game
minutes and eases each point's shown line toward it (`ease`), so the snowline walks with the weather and never jumps.
The window's lines are kept for its own points alone (PACK-5: a region come back to was built in the snow of the day
the player left it). The lane is asked of the law itself until the first frame reads it; a pixel built under the other
lane is built again once (HOST-N1; LANE-TURN, below: it was sent to the re-skin, which refused it). A clock run backwards starts the packs again from their origin.

SNOW-BUDGET (2026-10-20, `07-Rendering/Performance-Priority.md` SNOW-BUDGET) made `budgetMs` a budget kept. `advance` read
its deadline only between whole steps of the window, ~10 ms each, so a frame's 3 ms ran a step at the least. Each of a
frame's readers (the tick, the feet's `winterAt`, the mod's `winterNear`) also ran its own. Now a step's points stop at
the deadline, and the asks within `frameMs` share one budget. The packs are unchanged. The drawn cover read the slope
only where the snowline lays snow (since SNOW-FACE it reads none, and the host asks the stream no heights).

**The terrain.** The frame's lines are ONE small texture every terrain fragment reads at its own place
(`renderer.js` `setSnowFrame`, shadowed per program - GROUND-7: it was six uniforms a draw); a draw hands only its first
world tile (`drawOf`). Each climate's ground binds its TWIN (`arrayOf`; `twinLayers`, `twinKey`): one 112-layer array,
the summer set's 56 records then the winter set's, the smaller scaled up where a pack dresses one larger. On the lane
the twin IS the set (GROUND-2: it was added to the two sets it was made from, the ground's GPU memory three times
over), uploaded once, mipmapped, cached under `twin:<archive>` in the PLACE-LRU; the winter offsets come from the arrays
the renderer bound (`_arrLayers` - GROUND-1: a twin the LRU had let go read its winter from layer 55 of the summer set).
No new texture unit. Each fragment then:

1. reads the line between its cell's corners and its cover off its own height (`snowLine`, `snowAtHeight`:
   `coverAtHeight` term for term);
2. breaks a thin cover into patches on the world tile's own lattice (three octaves of 1, 4 and 16 tiles), continuous
   across pixel edges, each octave fading as the fragment's footprint passes half its cell (GROUND-8: the far snowline
   boiled); a bare cover stays bare and a whole one whole;
3. wears its OWN climate's winter record of the same tile in that share (every ground set is the same 56 records, R9).
   Across a climate border each neighbour's winter comes from its own twin by ECOTONE1's own weights (`ecoWeights`,
   computed once and handed to both - GROUND-6), so the snow crosses the border as the ground does.

The same cover on the CPU is `snowCoverAt` (GROUND-3: the patches lived only in GLSL), read by the grass and the feet.
Under the snow the water's bed and sheet mix their summer and winter masks by the cover (GROUND-5: the summer puddles were
drawn over the winter art). A desert's ground has no winter set (`TerrainMaterialProvider`'s guard), so its twin offset
is nought and the cover leaves it as it is; next to a snowy neighbour, the neighbour's winter still blends in across the
band. The sea's floor wears the lane's ground (its summer set; the snow is the ground's by its cover), never the pixel's
season (AUDIT FB1021 L4-9: these stood inside LANE-TURN's paragraph).

SNOW-FACE (FIELD BUGS 2026-10-21, `01-Overview/bugs/Field-Bugs-2026-10-21.md`, the owner's screenshot of a straight green
band up a white range's side, bare of snow and of trees): the fragment shed its snow on a steep face (`SNOW_GROUND.slope`,
the normal's y from 0.8 to 0.62 - 37 to 52 degrees), and what lay under it was its summer set's own tile, Daggerfall's
grass, its dirt and its stone: the sets have no rock face to shed to. The landforms stand a range's flank past 52 degrees
hundreds of metres wide (on the freeware's map 44% of the Dragontail pixel beside The Bat and Cat Pub, 924,473, and 40%
of 917,472 - AUDIT FB1021 L1-3, L4-5), and DFU's TerrainNature stands no tree past 50 degrees, so the face drew as a green wall up a white mountain. There is no slope in
the law now: a face keeps the snow its height lays, as DFU's winter set dresses every tile, steep or not; its trees are
DFU's still (none past 50 degrees), and in snow it reads as a snowfield. A steep face's green summer patches between 37
and 52 degrees went with it.

LANE-TURN (the same record): a pixel standing when the lane turns (the "Weather as places" or "Enhanced environments"
preference turned in play - `precipLawOn` reads them every call; AUDIT FB1021 L1-1) was sent to the snow's re-skin, and
`reskinPixelNow` refuses both turns - one built off the lane keeps no `_skin`, and off the lane the snow is not `on` - so
it wore the other lane's ground until it streamed out: in a winter turned off the lane, a ground array that was never
loaded (the lane loads the twin alone, so most likely black - AUDIT FB1021 L1-7), or its summer set if that was cached. A
lane's ground is its own archive (`groundArchive`: the summer set on the lane, DFU's season off it), which no re-skin
touches, so the host marks such a pixel for a rebuild (`markRebuild`, world.js `_reskin.mark`), as the classic flip
rebuilds its pixels - a turn onto the lane once the snow's window stands, so the torn-down grid's first rebuild never
waits on a cold year's integration in frame slices (AUDIT FB1021 L1-1).

**The builds.** A pixel's buildings, its town's climate swaps, its windmills and its homes wear Winter where the snow at
its middle's ground (a town's planed height, else the ground's middle) covers a half (`SNOW_COVER.winter`). Each tree,
plant and rock flat wears the season of the snow at its own foot against a draw of its own (`flatDraw` - a hash of its
place, 0.15 to 0.85), so the woods across a snowline whiten tree by tree, the same on every client. Both read the snow
at the last step of the pack's grid (the `build` lines - HOST-8: the band's memory was the client's history), so every
client builds one world. Every decision is kept as the build takes it (`recorder`, the pixel's `_snow` - HOST-6: the
sweep's signature was not what the build wore; a flat the verge refused is never asked). The ground's archive is the
summer one (the twin dresses its winter).

**The sweep and the re-skin** (HOST-3/7). At every new step of the grid THE SWEEP marks every standing pixel any one of
whose decisions the snow now takes otherwise, nearest first, a SKIN (`world/seasonReskin.js` `skin`), never a rebuild.
The nearest one standing is re-skinned a pump's turn at a time (`runSkin`, under the build flag, from `world.js`
`tickSeason`): `scenes/pixelBuild.js` `reskinPixelNow` - DFU's `ApplyClimateSettings`, what stands re-skinned in place.
The build logs what a re-skin reads (`_skin`, on the lane alone): its flats in the order they stood (each with its own
centre, by which a felled tree is known), its blocks' flat lists, the merge's models, its middle's ground. The re-skin
takes the snow's seasons as a build does and makes again only what wears them: the climate table (`world/texRemap.js`
`reskinRemap` - every mesh asked under a turning law asked again; a yard's or a farm's asked meanwhile brought in before
the trade), the merge through it, the homes' looks, the mills' bodies, and the flats' groups through the build's own
function (`standFlatGroups`) with their forest, cover (traded whole - `ai/cover.js` `staged`/`place`), far pictures (the
new held before the old let go) and animation. A felled tree lies felled in its new picture. All of it is made aside and
traded in one step; a pixel torn down meanwhile lets it all go. A yard stands its pieces again in the new season
(`_skinGen`); the gathering host stands its nodes again. The terrain, the collider, the doors, the street's people and
the grass are never touched (HOST-7: the teardown rebuilt them all, and the motor held on the player's own pixel through
the build). The classic lane's calendar flip keeps the teardown: its ground set and tiles turn with it, twice a game
year. The Seasons mod's install refresh and a painted home leaving the merge keep the rebuild: they change what a build
lays, not what it wears.

**Everything else at the player's feet.** The grass grows on every pixel on the lane, and a blade whose root the ground's
drawn cover reaches past the blade's own draw is not placed (`buries`, asked at the blade's own height - HOST-9). The
footsteps (all three) ask whether snow lies under the player as the ground draws it (`winterAt`: the cover past a half,
read at the clock's minute - HOST-N5). The Snowfall mod's `winter` is whether snow lies on any ground the window holds
(`winterNear` - GROUND-9/HOST-4: it was the player's own spot, a reset of its depths at every step across the line, and
its snow overdrew the snowline wherever the player stood in snow), and its surfaces are laid by the ground's own cover
where they lie (`snowLaid`: depth and coverage). Indoors the air is read at the place's own ground - a town's planed
ground, else the pixel's middle (FALL-10) - and the indoor Snowfall frame reads the snow about the player as the outdoor
one does (AIR-11).

## The hosts, online, the doors

- `scenes/world.js` wires the air's map, the snow host, both ground draws, the border's twins, the re-skin, the grass,
  the feet and the Snowfall mod. `scenes/exterior.js` (the `?exterior` city) hands the air no map, so its fall and ground
  are DFU's season (WEATHER2a). The interiors and the dungeons draw no terrain and have no weather.
- **Online**: the air (on the law's own map, whatever a client's rows), the weather map and the pack are pure in the
  place and the event minute, with the sky's season and hour where the shared clock installs a sky (TIME1). The step
  grid and the year's origin are the event clock's, the builds read the grid's last step, so every client stands in the
  same snow. Nothing is sent.
- **Doors**: `?biomeprecip=off` turns the law off offline (WEATHER2a's word and DFU's season on the ground).
  `?snowground=off` turns off the ground law the lane needs. The classic lane is DFU's, 1:1.

## Departures from DFU (Port-Ledger A, BIOME PRECIPITATION)

DFU rolls Snow by its climate table in Winter and dresses the whole world's ground, nature and buildings in its winter
archives on the calendar. On the enhanced lane we read the phase of what falls off a modelled air temperature at the
place and height, keep a snowpack from the weather map's own history, and dress each fragment, tree and building by the
snow there - re-skinned in place as DFU's `ApplyClimateSettings` re-skins, at the snow's turn, never the calendar's.
Named here and in the Ledger row.

## Open

- **The far ring** (`render/farRing.js`, EV8) beyond the streamed grid wears its overworld tint, as it did under DFU's
  season. It has no snow.
- **The Snowfall mod's own depth** stays its SnowpackState's (settlement and wilderness depths stepped while it snows).
  The lane hands it whether snow lies about the player and lays its surfaces by the ground's cover. Driving its depth
  from the pack is the next step.
- **A town's buildings** turn together, by the snow at the town's middle. Its ground and its trees do not.
- **The snowline is three crossings.** A fragment's cover is the line through its 10, 50 and 90 % heights, exact at
  them. Where a pack's own profile flattens between two crossings (an old layer under a new fall) the line reads up to
  0.32 off the pack's cover between them (measured, AUDIT PRECIP A-4). Finer would be the held levels themselves in the
  frame's texture, two fetches a corner.
- A texture pack's snowless winter set (SNOWLESS1) is drawn as the pack dresses it under any cover.
- **The frame on a GPU**: every program compiles and links in a real WebGL2 (the audit's GROUND lane); its time on a
  player's GPU is not measured here.

## Verification

- `test/systems/weather/precip1_air.test.js` (18): the air, its map, its blend, the sea's hand, the latitude, the phase
  law, the front, the mixed fall, the curtains, the hosts, and the ARENA2 calibration and medians.
- `test/systems/weather/precip3_snowpack.test.js` (12): the step, the melt in closed form, the cover and snowline, the
  year and its spin, the lattice (shared points, slices, exact skips, the pack now, a span of steps, online's origin).
- `test/render/precip4_snowground.test.js` (18): the chunk run through `test/glsl.mjs` against the law; the draw, the
  twin and the frame's texture on a recording GL; the host's clock, lines, draws, seasons, settle, sweep and feet; the
  wiring.
- `test/render/fb1021_snowface.test.js` (3): SNOW-FACE and LANE-TURN - no slope in either terrain program, the water's bed
  or the Snowfall mod's surface, a whole cover whole across a pixel; the Dragontail's faces on the freeware's map; a
  lane's turn rebuilt, never re-skinned, onto the lane once the window stands.
- `test/render/audit_precip_sky.test.js` (8) and `test/scenes/audit_precip_host7.test.js` (8): the sky's fixes and the
  in-place re-skin.
- `tools/mutants/precip1.json` (one recorded equivalent) and `tools/mutants/audit_precip.json` - all dead.
