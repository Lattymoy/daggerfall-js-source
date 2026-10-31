# Weather Arc - the sky as a place, not a state

Mac, 2026-09-14: "With weather, it can rain when theres snow on the
ground. In addition to this bug I want to go all out and enhance our
volumetric clouds by developing different generative cloud types, like
being able to see a thunderhead in the distance with the weather
happening elsewhere. I really want to go all out on detail making this
truly a dynamic world space event system where weather can be traveled
out of and into instead of just starting and stopping in your location.
In addition, using our volumetric cloud system and fog, I want to add a
new sand storm weather event for desert regions... being able to see a
large wall of sandstorm cloud in the distance."

What stands under it: the weather SIM is DFU's (W1: the Chronicles'
table, the six-zone daily roll, the respawn roll, the one persisted
word); the enhanced lane evolves it hourly (CLK2), eases the sky toward
it (ES1c), leads it with the wind (WIND1) and crosses the ground on the
front (WX2); the clouds are one volumetric field over the eye (the
Volumetric Clouds arc). Every one of those answers ONE word for the
whole sky: the weather is a state of the player's climate zone, not a
thing in the world with an edge. This arc makes it a place. ENHANCED
ONLY throughout - the classic lane keeps DFU's word, 1:1.

## The slices, in order

- **A - No rain over snow (WEATHER2a).** The bug first, at its root:
  the sim's word funnelled through the ground it falls on. Below.
- **C - Cloud types by place.** The one cloud field takes a set of
  CELLS - a world position, a radius, a profile (the thunderhead, the
  rain deck, the overcast slab) and a tint - resolved once per fragment
  at the ray's midpoint, so a thunderhead stands over the hills while
  the sky overhead is the zone's own. Ships first with a static test
  cell, then takes B's cells.
- **B - The weather field.** The day's word per zone becomes cells in
  the world, seeded by the day and the zone and drifting on the day's
  wind: a thunder word is one to three thunderheads a few km across, a
  rain word one or two broad decks, overcast and fog a zone-wide slab,
  sunny and cloudy none. The player's weather is what the field says
  at the player - travelled into and out of, the crossing a front, the
  edge in view before the rain. Travel and respawn sample the
  destination.
- **D - The sandstorm.** A weather word of its own for the desert
  tables (append-only: DFU's seven keep their enum), a fog row, a sun
  scale, a sand precipitation profile, a ground-hugging cloud profile
  and a tint - so the wall stands on the horizon in the field, the fog
  thickens as it is entered, and the wind blows sand.
- **E - The ashfall (ASHFALL1, 2026-10-27, later).** The ninth word, the
  volcano's: born over Red Mountain, the Ashlands and Stonefalls, a
  brown-grey pall with its veil, grey ash falling and tiny embers
  glowing among it. Below, at the page's end.

## A - NO RAIN OVER SNOW (WEATHER2a, 2026-09-14)

Mac: "it can rain when theres snow on the ground."

**The root.** Two laws that never met. The TERRAIN wears its snow
archive for the whole of Winter in every climate but a Desert base
(`climateSwaps.js getTerrainGroundArchive`, the 2026-09-01 incident's
law - TerrainMaterialProvider.GetClimateInfo). The WEATHER TABLE
(WeatherTable.json, the Chronicles pg. 47, digit for digit) rolls rain
and thunder in its Winter rows for every climate but the mountains -
woodlands 10% rain, the jungle 25% rain and 12% thunder (the
subtropics roll rain too, but MapsFile makes them a Desert base whose
ground never wears snow, so nothing to keep apart there). DFU draws exactly what that
produces: rain streaks over a white field, a storm over snow. The sim's
word was written in three places (the day's drain, the travel arrival,
the respawn roll) and none asked the ground.

**The fix.** The ground's snow is ONE named law now - `groundIsSnowy
(climateSettings, season)` beside getTerrainGroundArchive, which keys
its +1 on it - and the sim's three writers go through ONE `_set` that
asks it: on the enhanced lane, rain or thunder over a ground that wears
snow falls as SNOW (`overGround`). The table's own word is kept beside
the worn one (`currentWeatherRaw`), and the sky's wind model takes it
as its VIOLENCE word (`windModel.tick(minutes, worn, violence)`, the
hosts handing `violence` in the sky's bag), so a thunder word on a
winter ground is a blizzard - snow with a storm's wind - and not a
flurry. A change of the raw word under one worn word (rain to thunder,
both snow) is no change: no front, no jump. A word taken whole - the
save's restore, the `?weather` pin - is its own violence. The travel
arrival hands the sim the arrival's minute, so the destination's ground
is asked at the season it is in.

**Lane and door.** Behind the enhanced skin and Enhanced Environments
like the evolution (CLK2); `?snowground=off` the kill door;
`setSnowGroundLaw` the test seam. The classic lane wears DFU's word,
1:1, and the tests that pin the import and the drain say so by name.

**Not DFU, and why.** DFU's WeatherManager has no such arm - its
IsSnowFreeClimate serves the footsteps and the table never rolls snow
for a snow-free zone, so nothing in DFU keeps rain off snow. This is a
departure, recorded on the Ledger, and it is the enhanced lane's.

**SNOWLESS1 (FIELD BUGS 2026-10-09 #1, `01-Overview/bugs/Field-Bugs-2026-10-09.md`).** The law asked the archive law alone
(`groundIsSnowy`: climate type and season), so with Snowless Swamps and Jungles worn every winter rain and storm in an
Ocean, Rainforest or Swamp climate fell as snow on its green ground (about 37% of a jungle's winter days), and snow
systems the weather map drifts out of a snowy climate went on snowing over the desert, where nothing turned them back.
It asks the ground as drawn now (`world/climateSwaps.js` groundWearsSnow: the add-on's winter set wears none), and runs
both ways: snow over a ground that wears none falls as rain (`overGround`, `mapGround`). The table's own swamp-winter
snow rains under the add-on too - the same enhanced-lane departure, recorded on the Ledger's row; the classic lane keeps
every word.

`test/systems/weather/weather2a_snowground.test.js`, `test/systems/fb1009_snowless.test.js`.

## C - CLOUD TYPES BY PLACE (WEATHER2c, 2026-09-14)

Mac: "different generative cloud types, like being able to see a
thunderhead in the distance with the weather happening elsewhere."

**What stood.** The volumetric field (the Volumetric Clouds arc) is
one density function over the eye, shaped by ONE profile - the zone's
weather word, eased - and the eased row's cover: the whole hemisphere
is one kind of sky. A thunderhead on the horizon under a sunny zone
had no way to exist.

**The cells.** The field takes CELLS: a world position, a radius and a
soft rim, and a profile of its own (`cellOf(weather, x, z, r)` - the
weather's VC_PROFILE with its row's cover and grey). `resolveAt(xz)`
in the shared field block resolves the terms at a place - the zone's
first, then every cell whose rim reaches the point blended over them by
its weight - and `density()` reads the RESOLVED terms (fBase, fTop,
fDensity, fFlat, fShear, fCover) instead of the zone's uniforms. Both
marches resolve once before they walk and again at EVERY step while
cells stand (a grazing sky ray crosses 24 km; a cell 6 km out with a
3 km radius is missed by any single resolution), and the light march
reads what its step resolved. The slab both marches walk is the UNION
of the zone's and the cells' (`slabOf`), so a thunderhead's tops are
reached under a sunny zone's lower lid. (SLAB-SPAN, 2026-09-23: the
union was every ray's, so one low cell anywhere started every ray under
the zone's deck and left bare dome round the horizon; each ray now walks
its own spans - `raySpans`, the Volumetric Clouds arc.) A cell's `dark` and `grey`
reach the lighting: the dark moved into the field block (a cell has
its own), and the grey pulls the lit colour toward the shade's, so a
storm under a sunny zone is a storm's colour and not a bright cumulus
the size of one. The shadow is the cell's where it stands - the ground
map marches the same field.

**Where the cells live.** In the HOST's world metres, the space the
camera's `pos` is in: the controller hands fresh cells every frame
(`extra.cells`, both the dome path and the mod path), the floating
origin moves the host and the cells with it, and the noise still
samples at the absolute, wrapped position. Capped at the tier's count
(`QUALITY.*.cells`: 3 on Low, 8 otherwise; the shader's arrays hold 8)
and packed into three vec4 arrays (`packCells`).

**The door.** `?cloudcell=<weather>[,<metres east>[,<radius>]]` stands
one static cell of that weather east of the boot position (6 km and 3
km across by default), resolved against the first camera position the
controller hands and shifted with every recenter - for the eye and the
probe, and the seam slice B fills with the field's cells.

`test/render/weather2c_cloudcells.test.js`.

## B - THE WEATHER FIELD (WEATHER2b, 2026-09-14)

Mac: "a dynamic world space event system where weather can be traveled
out of and into instead of just starting and stopping in your
location."

**What stood.** DFU's weather is a state of the player's climate ZONE:
six words a day, the player's zone's word applied, the sky that word
to the horizon. A rain day rains everywhere in the Woodlands at once;
a storm has no edge. The classic lane keeps that, 1:1.

**The field** (`systems/weather/weatherField.js`, pure). The ENHANCED lane
reads the same six words - the sim's array, the shared day's roll
online - as a field over the map. A precipitating word (rain, thunder,
snow) becomes CELLS scattered over the zone's land: a jittered lattice
at the word's spacing (22-26 km), each candidate present by a seeded
coin (`CELL_WORDS.*.p`), each with its own radius from the word's
range (thunderheads 3.5-7.5 km, rain and snow decks 9-18 km), its word
the day's word for the CLIMATE under its seat - so a thunder day over
the mountains scatters thunderheads on mountain pixels, and a woodland
traveller sees them from the plain. Between the cells the zone's BASE
sky stands: overcast on a rain or snow day, cloudy between the storms
of a thunder day, so the storms are seen coming. A whole-sky word
(sunny, cloudy, overcast, fog) stays the zone's, as DFU has it. The
cells DRIFT on the day's own wind (a heading seeded by the day, 15 m a
game minute, ~22 km a day), so a storm rolls over a standing player as
well as being walked into. Seeded by the day, the lattice index and
the word: the same field for every player, replayable, nothing to
carry. Positions are FIELD METRES - the map's natives at the streaming
world's 819.2 m pixel; the hosts convert (`fieldFromNative`, the
fixed location's `fieldOfPixelLocal`).

**The seam** (`weatherSim.js` sampleWeatherField). The player's word
is what the field says AT THE PLAYER, sampled every exterior frame
after the drain and through the same `_set` (the ground law of A
included). A change on a LIVE frame is a CROSSING - the player walked
into the cell or it drifted over them - stamped apart from the jumps
(`weatherCrossingStamp`); the hosts read it beside the jump stamp and
tell the sky (`weatherArrive`), and the wind builds its front on the
SHORT lead (`CROSS_LEAD_MIN`, six game minutes) with the sky's ease
stretched to the same (`leadMinutes`) rather than the day roll's three
hours - the storm was already in view. A change the drain made (the
day's words turned) keeps the day roll's front; an arrival's (travel,
respawn) is a jump, whole: `applyClimateWeather` samples the
destination after the array's slot, and `weatherRespawn` samples
instead of rolling - DFU's fresh roll for the climate stands down on
the lane, since a roll beside the field would be a second sky. The
nearby cells are kept (`currentFieldCells`) and both hosts hand them
to the clouds as C's cells (`cellOf` in the host's space), so the
storm on the horizon is the storm walked into, and its shadow is
where it stands.

**Lane and door.** The enhanced skin, Enhanced Environments and the
`weather-events` row (`weatherEvents`, on by default, FORCED ON
ONLINE - one field for every player); `?wxfield=off` the door;
`setWeatherFieldLaw` the seam.

**Not DFU, and why.** WeatherManager has no field, no edge, no drift;
the port's departure, recorded on the Ledger. Residual: the wind does
not yet rise with a storm's APPROACH before the crossing (the field
knows the distance to the nearest rim; a later slice can hand it to
the wind as a lead of its own).

`test/systems/weather/weather2b_weatherfield.test.js`.

## D - THE SANDSTORM (WEATHER2d, 2026-09-14)

Mac: "using our volumetric cloud system and fog, I want to add a new
sand storm weather event for desert regions... being able to see a
large wall of sandstorm cloud in the distance."

**The word.** The port's own EIGHTH weather word, `sandstorm`,
APPENDED to WEATHER_TYPES so DFU's seven keep their enum values (a
save's byte, the classic array's 0x7f mask and 5<->6 swap, the
Chronicles' seven columns - none touched). It is never rolled: the
FIELD stands it (`CELL_WORDS.sandstorm`, walls 8-14 km across on a 30
km lattice) over the DESERT TABLES' land - Desert and Desert2, the
climates weatherTableFor sends to the desert table; the subtropics
have their own - on a day whose word there is cloudy or thunder
(`SAND_FROM`, `cellSeats`), the zone's own sky between them. So a
desert traveller sees the wall on the horizon under a cloudy sky,
walks into it, and out.

**Every seam a word reaches.** The fog row (`FOG_SETTINGS.sandstorm`,
exp 0.09 with the sky in it - denser than the heavy fog; a mod's five
settings have none, so the heavy fog stands in under Dynamic Skies);
the sun scale (0.35, between a rain and a storm); the sky row
(WEATHER_SKY: a tan lid, cover 0.9, under a gale); the cloud profile
(VC_PROFILE: base 0, top 900 - a wall on the ground, a lid 900 m up)
and the cell's TINT (`CELL_TINT`, a fourth cell array in the field
block, `fTint` on the lit and ambient colours - so the wall is tan and
not the zone's grey); the wind's violence (0.95); the grass's dim
(0.55); the front's kind (`sand`, a heavy peak 0.5-1.0, its own look
so a change of kind tapers); the ear (DFU's ambience has no sand - a
cloudy day, and the wind loop of WIND3 at a gale is the storm's
voice). The music takes DFU's default arm (sunny), as any word DFU
never knew would.

**The sand.** Not the rain program (the lab's shaders, pinned byte for
byte): the wisps' program (WIND3) in a LOOK - `SAND_LOOK`: tan, dense
(7,000 instances), short streaks in a lower box, no floor - drawn by
both hosts on the front's intensity as its strength, on the one wind's
rate and travel, before the rain's branch and as a foreign pass; the
rain renderer is never built for it. The look is a uniform set
(colour, alpha, streak length, box, count), the wisps' own unchanged.

**Not seen.** No ARENA2 here: the wall's tint and density, the sand's
alpha and the fog's thickness go to Mac's eyes. `?cloudcell=sandstorm`
stands one wall east of the boot position for a look.

**The arc's close.** A (no rain over snow), C (cells), B (the field),
D (the sandstorm) shipped 2026-09-14. Residuals: the wind rising with
a storm's approach before the crossing (B); a spatial fog channel (the
wall as thickening haze on the ground before its cloud is entered) -
the front's fog crossing carries the immersion today; the ambience's
birds in a sandstorm (DFU's player, kept 1:1).

`test/systems/weather/weather2d_sandstorm.test.js`.

## WEATHER3 - THE WORLD WEATHER MAP (the design, before the code, 2026-09-22)

Mac, 2026-09-22: "I recieved a report that weather never changes on
online mode. The idea is that weather is persistant in the world both
offline/online, and that a location could have a rainstorm while another
experiences sunshine... imagine a map, one location its sunny, one is
cloudy, one has a rainstorm, etc." Then: "I want this to be as detailed
as possible. A true overhaul within enhanced enviroments."

### What stands, measured

The report did not reproduce: three real hours replayed online through
the real ticker (`createPlayerTicker` under `setSharedClock`) turn one
woodland spot's sky six times. But the model under it is not the map Mac
describes, and reading `weatherField.js` whole says why:

- The unit of weather is still the CLIMATE ZONE's word - six words a
  day (`rollClimateWeathersForDay`), re-rolled hourly by CLK2's
  evolution. Only rain, thunder, snow and the sandstorm become cells
  (WEATHER2b); sunny, cloudy, overcast and fog are the whole zone's.
  Two woodland towns can never be sunny and cloudy at once, and between
  a rain day's cells the sky is overcast - never sun.
- The day is the seed (`seededRng(day...)`, `driftOfDay`): at midnight
  every cell of the world is thrown away and a new set stands. Weather
  does not persist across a day; it is re-dealt.
- Offline rolls from `Math.random` (DFU's law), online from the day's
  seed: the same place at the same minute is a different sky in the
  two, and a save carries a word the world does not.
- Everything under the sky - the drops, the fog row, the sun, the
  ear, the wind - reads ONE word at the player; the sky's zone row is
  that word to the horizon, with at most 8 cells (3 on Low) blended on
  top, last-over-first.
- Indoors nothing samples: the day and hour rolls land on the first
  frame back outside, so the rain heard through a door is the word the
  player carried in.

### The model: WEATHER SYSTEMS on the land, a function of place and time

The enhanced lane's weather becomes a set of **systems** - a cloud
field, an overcast deck, a fog bank, a rain band, a thunderstorm, a
snow squall, a sandstorm - each BORN somewhere, MOVING, GROWING,
MATURING and DYING. The weather at a place is the system over it, or
clear air where none is. Nothing is rolled per day or per zone.

**Birth - a space-time lattice.** The land is cut into NODES on a
lattice in field metres and game time (the pitch is the law's constant,
~40 km and ~8 game hours to start; calibrated in slice A). Each node
seeds one candidate from a generator keyed on (gx, gz, gt) and a world
constant - never the day, so a system born at 23:00 is still raining at
02:00. The candidate's TYPE is DFU's own table (the Chronicles' odds,
`WEATHER_TABLE`) for the CLIMATE under its birthplace and the SEASON at
its birth - a 'sunny' draw is no system (clear air). So the table stays
the law of how much of each weather a climate gets; the map decides
WHERE and WHEN.

**Life.** Each type has a lifetime range (a thunderstorm hours, a rain
band most of a day, a fog bank a night), an envelope (grows, holds,
decays) that scales its radius and its intensity, and a structure:

| type | core | ring | skirt |
|---|---|---|---|
| thunder | thunder | rain | cloudy |
| rain | rain | overcast | cloudy |
| snow | snow | overcast | - |
| overcast | overcast | cloudy | - |
| fog | fog | - | - |
| cloudy | cloudy | - | - |
| sandstorm | sandstorm | cloudy | - |

so a storm is SEEN coming - cloud first, then the deck, then the rain,
the thunder at its heart - and the intensity falls from the core out
(a drizzle at the edge, the downpour inside).

**Motion.** A prevailing wind that is itself a slow field over the map
and the days (as built: a westerly bent by large-scale noise over the
land, plus two terms that turn at fixed rates - a backing one round
every five days, a veering one every 2.3 - not one heading for the
world): systems ride it, storms faster than decks, fog barely. A
system's position is its birthplace plus the wind's path since birth -
closed form, no state.

**The land and the clock.**
- Diurnal: fog is born in the small hours, stands thickest after dawn
  and thins through the afternoon (as built: born around 04:00, a bank
  living four to ten hours);
  summer thunder is born in the afternoon; clear nights stay clear
  more often than days.
- The ground: a cell's word goes through WEATHER2a's law at ITS OWN
  climate and season (`overGround`), so a winter storm is snow in the
  cloud as well as at the player.
- Sand stands only on the desert tables' land (WEATHER2d's rule, now a
  birth rule).
- Priority where systems overlap: thunder > rain > snow > sandstorm >
  fog > overcast > cloudy > clear. The worn word is the highest
  present; the others still show in the sky.

**One function, every client, both modes.** `weatherAt(x, z, minutes)`
is PURE: the same place at the same minute is the same weather offline
and online, for every player, replayable, with nothing to carry and
nothing for the relay to know. Offline runs it on the save's clock,
online on the shared clock - the SAME map, read at each clock's now. A
save no longer needs its sky: a load reads the map (a jump); the word
is still written for the classic lane. Rest, fast travel and a
sentence move the clock and the map is simply read at the new minute.

**Calibration is a gate.** Sampled over thousands of places and
minutes per climate and season, the share of each word must match the
Chronicles table within a tolerance - pinned, so a tuning of radii or
lifetimes that drifts the climate's weather fails the build.

### What each consumer gets

- **The player's word and intensity** (weatherSim): on the lane the
  word is the map at the player, every exterior frame; the INTENSITY
  (envelope x core falloff) feeds WX2's front as the peak instead of
  the per-cut seeded episode. A change on a live frame is a crossing
  (the short lead); an arrival, a load, a respawn or a clock jump is a
  jump. The day roll, CLK2's evolution and the WEATHER2b field stand
  down on the lane (the classic lane keeps DFU's day roll, 1:1).
- **Indoors**: the map is read at the door's position on the indoor
  tick, so the rain through the door starts and stops while you are
  inside (betterAmbience's loop reads it).
- **The clouds**: every system near enough is a cell - all types, not
  only the wet ones - so a sunny valley shows the storm on the ridge
  and a player under the deck sees the blue beyond its edge. The base
  row the cells sit on is clear air; the player's own system is a cell
  like any other. The 8 slots (3 on Low) go to the systems that matter
  most to the eye (size over distance, weighted by type), drawn in
  priority order so the overlap blend agrees with the word.
- **The wind**: rises with a storm's APPROACH (WEATHER2b's residual) -
  the violence is the worn word's or the nearest storm's scaled by its
  distance, whichever is greater.
- **Distant storms**: a thunderstorm on the horizon flashes its own
  cloud and its thunder arrives late and quiet - the delay is its
  distance over the speed of sound, the volume falls with it.
- **The travel map** (the enhanced held map, the world sheet): a
  WEATHER LAYER - each system as a soft wash in its type's ink with a
  glyph, drifting as the clock runs - and the hover over a place says
  its weather now and its FORECAST, read off the same pure function a
  few hours ahead ("Rain, heavy - clearing in about 3 hours"). The
  classic travel map is DFU's and draws none.

### The slices

- **A - The map law** (`systems/weather/weatherMap.js`, pure): the lattice,
  types, lifecycles, structure, the wind field, `weatherAt`, `systemsNear`,
  `forecastAt`; the calibration gate.
- **B - The sim seam**: the lane's word, intensity, crossings and jumps
  off the map; indoor sampling; the day roll, evolution and field stood
  down on the lane; saves and online need nothing new.
- **C - The sky**: all-type cells, the importance ranking and priority
  order, the clear base row, snow cells through the ground law, the
  wind's approach.
- **D - Storms at a distance**: the distant flash and the late thunder.
- **E - The weather layer on the map**, and the forecast in the hover.
  REMOVED by DISC17-C (2026-09-24), below.
- **F - The records, the audit.**

**Lane and doors.** The enhanced skin, Enhanced Environments and the
`weather-events` row (forced on online, as it is); `?wxmap=off` falls
back to WEATHER2b's field. As built, that is the ONE door: the slices
share the lane, and no slice has a switch of its own. The classic
lane is DFU's, 1:1, throughout.

**Not DFU, and why.** DFU's weather is a zone's word rolled once a day;
this is a world with weather in it. The port's departure, a Ledger A row
superseding CLK2's evolution and WEATHER2b's field on the lane.

### Slice A shipped - the map law (2026-09-22)

`systems/weather/weatherMap.js`, pure, and `systems/weather/weatherTable.js` (DFU's
table, dispatch and roll moved whole out of `weatherSim.js`, which
re-exports every name, so the map and the sim read one table without an
import cycle). Pinned by `test/systems/weather/weather3a_weathermap.test.js`, with
`tools/mutants/weather3a.json` at 14/14 dead. Three things the build
taught, each a change from the design above:

- **Births are one Poisson process PER TYPE, not one typed draw per
  node.** Each node draws a Poisson count of candidates per type, places
  each uniformly in its cell and its eight hours, and keeps it with
  probability (the type's weight for the climate under it and the season
  at its birth, times the hour's factor) over the type's ceiling. That is
  exactly a thinned homogeneous Poisson process. By Campbell's theorem
  and the colouring theorem, the counts of each band covering a point are
  then independent Poissons. So the worn word's share is closed form, and
  the table can be solved BACKWARDS into birth weights (`birthLaw`)
  instead of tuned toward. The wind is read at each system's birthplace:
  it turns over ~240 km and a system rides at most tens, so the process
  stays homogeneous to the eye and to the gate.
- **A ring is an AREA in core areas, and a tight row THINS it.** The
  first build had fixed ring radii, and no fixed shape reaches all 24
  rows. The swamp's spring is a quarter rain and 15% thunder but only
  a tenth cloudy, so every storm's cloud skirt alone painted more cloud
  than the table allows. The rings painting a word are now thinned
  together to exactly its share where they would overshoot. A storm born
  in the swamp spring has a thinner skirt than one born over the summer
  woodlands, and every row is reachable by construction.
- **The day re-aims the solve.** A type born more at some hours (fog in
  the small hours, summer thunder in the afternoon, cloud by day) covers
  unevenly, and a share is not linear in its covering mean. The flat
  solve therefore fell two points short on subtropical summer. The solve
  now iterates against the day-averaged shares (48 half-hour bins, each
  type's exposure being its birth cosine smeared over the ages its
  systems live to) until they ARE the table's.

The sandstorm is a quarter of the desert table's cloudy
(`SAND_SHARE_OF_CLOUDY`); the Chronicles have no sandstorm column, and
the calibration counts one as the cloudy it came from. Measured: every
row's analytic day shares match the table within 1e-4. Sampled, all 24
rows land within ±1.7 points at 6,000 samples a row. The gate holds six
rows to 2.6 points each and to a 0.8 mean. A player's query costs about
0.1 ms, and every system within 40 km of the player (the sky's reach)
about 0.3 ms.

### Slice B shipped - the sim seam (2026-09-22)

The map is the sky on its lane: `weatherSim.js` WEATHER3b, pinned by
`test/systems/weather/weather3b_simseam.test.js` (`tools/mutants/weather3b.json` 17/17
dead), and approved by THE WORLD WEATHER MAP row in Ledger A.

- **The lane** is the field's own (the enhanced skin, Enhanced
  Environments, the weather-events row, forced on online). `?wxmap=off`
  hands it back to WEATHER2b's field. `sampleWeatherField` routes to
  the map there, so the hosts' sampling calls are unchanged (their frame
  gained the front's `peak`, below, and slice F the indoor place).
- **The word** is `wornAmong` over the systems within the sky's reach.
  They are found once per game minute, or whenever the player has moved
  250 m, and resolved every frame. It goes through the same `_set`, so
  WEATHER2a's ground law holds and the raw word is kept for the wind.
- **Crossing or jump is the sim's call, not the host's.** A change is a
  crossing only when it follows the last sample within
  STALE_DRAIN_MINUTES and MAP_JUMP_M (2 km). A rest, a load, a sentence,
  an online join or a teleport is a jump even when a host calls its
  frame live. Travel and respawn (same climate base included, where DFU
  rolls nothing) sample the destination as one jump, and never pass
  through the zone's word.
- **The day roll stands down.** It still rolls (the classic lane and
  the save read the array), but the drain applies nothing and CLK2's
  evolution rests.
- **Indoors**, the indoor frame (`worldModes.js`, before Better
  Ambience's rain source reads the word) re-reads the map over the
  place the player is in (as shipped, the last outdoor sample's place;
  slice F made the host name it). Each change is a jump, so the sky outside is
  simply there on the way out.
- **The front's peak is the place's.** `currentWeatherIntensity()`
  (the system's envelope, falling from its heart out) is placed in the
  mode's range every frame, so walking in from a storm's edge thickens
  the drizzle into the downpour. Lanes with no map keep WX2's seeded
  episode.
- **The clouds** still get the precipitating systems' cores in
  WEATHER2b's cell shape. Slice C gives the sky the whole structure.

The day-roll machine's own pins (W1, S41, CLK2/CLK4, WORLD5 C4/C5,
SAV3, WEATHER2a/b/d, AUDIT 57 F3) were written for the one lane that
existed. Each now declares the non-map lane it tests, beside its reset.

### Slice C shipped - the sky (2026-09-22)

The clouds read the map whole. `test/systems/weather/weather3c_sky.test.js` pins it
(`tools/mutants/weather3c.json` 15/15 dead), and THE WORLD WEATHER MAP
row now names it.

- **Every system near is a cloud, as nested discs** (`skyCells`): the
  skirt's disc, the ring's inside it, the core's inside that. Each word
  goes through WEATHER2a's ground law at the cell's own place, so a
  winter storm is a snow cloud where it stands. A fair-weather field, a
  deck, a fog bank on the low ground, a storm on the ridge: all stand in
  the sky, not only the wet ones.
- **The slots** (`pickCells`, in the renderer): the tier's 8 (3 on Low)
  go to the cells that fill the most sky from here. Importance is the
  word's weight times the angle the disc fills, and a disc overhead
  counts double, so the sky above is never the one dropped. They are
  drawn lowest priority first, so the storm's heart is blended last
  over its own skirt. The test runs the shader's resolve in JS over
  hundreds of places: the cloud fully overhead is always the worn word.
- **Clear air under it all** (`cloudBaseOf`). On the map's lane the
  clouds stand on clear air's row and state (cover, softness, colours),
  and the player's own system is a cell like any other. The blue shows
  past a deck's edge, a far cumulus is lit white, and the storm overhead
  is dark by its own grey. That is WEATHER2c's thunderhead-over-a-sunny-
  zone case, now the whole sky's. The dome, the fog and the sun keep the
  worn word, eased on the WX2 front.
- **The wind of what is coming** (`approachAt`, `wind.js` tick's
  `approach`): the strongest storm near brings its VIOLENCE at its
  envelope, falling from its disc's edge to nothing 15 km beyond. It is
  a floor under the fronts, never summed with one, so the wind gets up
  before the first drop and dies as the storm passes.

Measured: the whole sample - the word, the sky's cells and the wind -
costs about 0.02 ms a frame. Off the lane, nothing changes: WEATHER2b's
cells are cut in their own order on the worn word's row, as before.

### Slice D shipped - storms at a distance (2026-09-22)

`systems/distantStorms.js` holds the law, pinned by
`test/systems/weather3d_distantstorms.test.js` (`tools/mutants/weather3d.json`
15/15 dead).

- **The strikes** are the storm's and the minute's. Each game minute
  draws a Poisson count at STRIKES_PER_MINUTE (0.15, about twice a real
  minute at the default TimeScale) times the storm's envelope, seeded
  by its lattice id. Every client under the shared clock sees the same
  strikes, and frame-by-frame is the same as all at once. The first
  build struck at 0.8 a game minute, and an afternoon of swamp storms
  strobed; measured and brought down.
- **The light**: the march writes one stripe a frame, so a per-cloud
  flash cannot ride it, which is why the overhead strobe is already
  whole-sky at the composite. A distant strike is a bolt in the
  composite instead (`boltOf`): the direction to the thunderhead's
  middle (BOLT_HEIGHT), a cone as wide as its cloud, on the cloud's own
  radiance only, so clear sky that way stays dark. It falls away over
  BOLT_SECONDS.
- **The thunder** (`thunderOf`) comes its distance over 343 m/s late,
  half a minute for a storm 10 km off. Its volume falls with distance
  (and with the storm's strength): a crack inside 4 km, the roll beyond,
  nothing past 25 km. It is played THUNDER_SOURCE_M out toward the
  storm, so it comes from its side. DISC17-B (2026-09-24): it is held
  there from the ear until its clip ends (`play3d`'s `far`), so a walk
  or a recentre under a rolling clip no longer cuts it off.
- **Whose storm**: under a thunderstorm's heart, DFU's LightningPlayer
  and the ambience own the lightning and thunder, as before. Only the
  others strike here. A jump (a load, a landing) plays no backlog and
  forgets the thunder still on its way (as shipped, only when the word
  changed; slice F made every landing count). Enhanced only, never under a
  `?weather` pin, and nothing off the map's lane.

### Slice E shipped - the weather on the map (2026-09-22) - REMOVED by DISC17-C

**Removed 2026-09-24** (Mac: "Remove the enhanced map weather
enhancements entirely"): `ui/weatherLayer.js`, its tests and its mutants
are gone, and the travel map is the bay alone again. What follows is the
record of what shipped. See DISC17 at the end of this document.

The enhanced travel map shows the picture Mac drew: sunny here, cloud
there, a rainstorm over the hills. The law is `ui/weatherLayer.js`, and
it is drawn on `ui/heldMap.js`'s world sheet. Pinned by
`test/weather3e_maplayer.test.js` (`tools/mutants/weather3e.json` 15/15 dead; both DELETED
by DISC17-C).

- **The wash**: every system over the bay is a soft-rimmed radial wash
  per band, laid lowest priority first so a storm's heart is inked last.
  Its pigment is mixed a third of the way to the pen's brown, so it sits
  in the sheet's one hand, and it is heavier with the storm's strength.
  A grown storm with room on the paper is signed with a pen glyph: slant
  strokes for rain, a bolt, a star for snow, level lines for fog, a
  drift for sand. The first render drew hard discs, which read as polka
  dots; seen in Chromium and softened. The far view carried a page of
  glyphs; they now wait for GLYPH_MIN_ENV and GLYPH_MIN_PX.
- **Cost**: the whole bay is about 2,700 systems, read once every
  WEATHER_LAYER_REFRESH_MINUTES (10 game minutes, about a quarter of a
  pixel of drift). The "37 ms after" first recorded here was never
  measured. Slice F measured it over a patchwork of every climate:
  about 2,500 systems, 130 ms for the first read (60 ms once the code
  is warm), then 12-27 ms a refresh. The wash lives on the sheet's KEPT
  static layer, keyed on that refresh, so a frame that only breathes
  costs nothing. A pan or a zoom redrew it, until slice F.
- **The hover** carries the weather at the pixel and its forecast off
  the same law, 12 hours ahead: "Daggerfall : Daggerfall · Rain, heavy
  - clearing in about 3 hours". It is read once per pixel per refresh.
- **A bug the tests caught**: the layer centred its read on the sheet's
  height in field metres. The field's y runs up from the real bay's
  south edge, so any sheet not 500 rows tall read the wrong stretch of
  land. It was right on the real map only by coincidence. The centre now
  goes through the field law (`fieldOfMapPixel`).
- `world.js` hands the map `weather: { on, minutes }`: on the map's lane
  and never under a pin, at the host's own clock. The classic travel map
  is DFU's and draws none.

### Slice F shipped - the audit (2026-09-23)

Two independent reads of slices A-E. One read the runtime: does it run,
and what did it break. The other read the records: do they say true
things. Pinned by `test/systems/weather/weather3f_audit.test.js`
(`tools/mutants/weather3f.json` 15/15 dead). The slices' own mutant
records were re-aimed wherever F moved their source, and all six files
are 0 survived, 0 stale.

The runtime read:

- **R1 - one ground law for every reader.** The sky's cells went through
  WEATHER2a's ground law, but the travel map's washes, its hover
  forecast and the distant storms did not. They said "Rain" and struck
  lightning where the player standing there got snow. `mapGround`
  (weatherSim) is now the one law, `(word, x, z, minutes)` at the
  place's own climate. The sky, the map's marks, the forecast and the
  storms' strikes all read it, and a thunderstorm over snow ground is a
  squall that strikes nothing.
- **R2 - the map's cost.** The travel map made a lookup per window, and
  the births cache is per lookup, so every open read the whole bay cold.
  It now reads with the host's own lookup, which is the sim's and warm.
  A full births cache (BIRTHS_MEMO, 40,000 nodes) sheds its OLDEST
  quarter, not the whole. **R2a:** a pan or a zoom inked every wash's
  gradient again, a few thousand a frame. The washes are now inked once
  a refresh onto their own map-sized layer (WASH_LAYER_SCALE, 2 layer
  pixels a map pixel), and the view draws it as one image. The glyphs,
  a handful, are still inked at the paper's resolution.
- **R3 - indoors reads the place the host names.** The indoor sample
  read the last OUTDOOR sample's place. An arrival straight indoors (a
  load into a dungeon, a recall) read the old place's sky, or none.
  Each host now names the place every indoor frame (`weatherIndoors`:
  the building's or dungeon's own pixel), and a load clears the last
  place, so its first word is a jump wherever it landed. The
  `_mapFresh` flag this replaced was redundant with that.
- **R4 - a lane switched off mid-session.** The drain spent the day's
  pending apply on the map's lane, so switching the skin or Enhanced
  Environments off wore the map's last word until the next day. The map
  check now comes before the flag is spent, so the next frame off the
  lane wears the zone's slot.
- **R5 - every landing is an arrival.** The distant storms reset on the
  jump stamp, which moves only when the word changes. A landing under
  the same sky kept the old place's thunder on its way. The sim now
  counts arrivals (`weatherArrivalStamp`), word or no word, and the
  hosts reset on it. Thunder that fell due while the frames stopped (a
  building, a window, a pause) is dropped once it is more than
  THUNDER_LATE_SECONDS (1 s) late, not played in one burst.
- **R6 - left as built.** The sky's state is computed twice on a frame
  where the clouds' base row differs from the dome's (the map's lane
  under weather). That is one extra `skyState` call, the cost of the
  clouds standing on clear air. It was not measured, and is left as
  built.

The records read: this arc said slice B's mutants were 16/16 (they were
17/17); that the hosts' frame did not change (it gained the front's
peak); that the swamp spring is "a sixth" thunder (15%); that the table
moved out so the sim and the map would not import each other (they
must not form a cycle - the sim does import the map); that fog burns
off by late morning (it peaks after dawn and thins through the
afternoon); that every slice has its own kill door (`?wxmap=off` is the
only one); that the wind is noise in space and time (it is noise over
the land plus two fixed turns); and a "37 ms" refresh nobody measured.
Each is corrected where it stood, with the build's own numbers.

### Slice G - clarity: fronts, not a rash (the design, 2026-09-23)

Mac, on the first real render of the travel map: "this needs more
clarity". The render (a high-summer afternoon over a stand-in bay, no
ARENA2 here) showed about 1,930 systems, 1,270 of them thunderstorms
4-7 km across. Each is a few map pixels, so the bay read as a speckle of
grey dots, not "sunny here, a rainstorm over there". The pigments, mixed
a third of the way to the pen's brown, came out as one grey-blue.

The shares were right; the SCALE was wrong. Every type was born as an
independent Poisson process, so a climate's 15% of thunder came as
thousands of small independent cells.

**The model (G1).**
- **Rain is a FRONT.** A rain system is regional: a core tens of
  kilometres in radius (built at 25-50 km; shipped at 40-75 km after the
  second render still read as circles), with overcast and cloud rings
  around it, living half a day to a day and a half.
- **Thunderstorms are born INSIDE rain fronts.** A thunder cell is a
  child of a front. It is born at a place inside the front's core and
  rides with it rigidly, so a storm is a rain front mottled with its
  cells, not a cell on its own. The cells are thinned by the land and the
  season where each is born, so a front drifting over a desert grows no
  storms there.
- **The other types are larger too.** Overcast decks and cloud fields
  are regional, fog banks and sandstorms are tens of kilometres, and each
  type is born on its own lattice, sized to it.
- **The calibration stays exact.** Thunder is now a Cox process: cells
  are Poisson inside the fronts' cores, and the fronts are Poisson. With
  K fronts over a point and c the cells' covering mean per front, the
  chance of no thunder is E[e^-(1-e^-c)K], which is exp(-nu(1-e^-c)).
  The effective covering means are nu(1-e^-c) for thunder and nu e^-c for
  rain, so the solve and the day's re-aim run as before. What the
  closed form does not see - a cell poking past its front's rim, a front
  growing past cells born when it was smaller - is measured by the
  sampled calibration gate.
- **Known cost:** a front that drifts from one climate into another
  carries its rain with it. The table holds per climate on average over
  its land, not at its borders.

**The map (G2).** Distinct pigments (rain blue, storm violet, snow white,
overcast slate, cloud pale grey, fog cream, sand ochre), mixed only
lightly toward the pen. A legend on the sheet.

### Slice G shipped - clarity (2026-09-23)

(The map's part of this slice - the glyphs, the legend, the sheet - was
removed by DISC17-C, 2026-09-24. The fronts, the cells and the sky's clip
stand.)

Pinned by `test/systems/weather/weather3g_fronts.test.js` (`tools/mutants/weather3g.json`
22/22 dead). The pins slices A-F held on the old shapes were re-aimed at
the new law, and their mutant records moved with it: 3a 14/14, 3b 17/17,
3c 15/15, 3d 15/15, 3e 15/15, 3f 15/15. The build taught four things the
design above did not have:

- **A cell paints only inside its front's core as it is now (`clip`).**
  A cell near the rim poked past the front, so thunder fell where the
  Cox law has no front, and the sampled rain and thunder drifted a point
  or two off the table. The clip travels everywhere the word does: the
  worn word (`insideClip`), the sky (`uCellK`, a clip disc per cloud cell
  in the shader, fading at the front's rim with the cell's own rim), the
  travel map (`ctx.clip`), and the hosts' one conversion (`cellOfField`
  in `render/volumetricClouds.js`, which both exterior hosts now call).
- **Cells are drawn over the front's grown core widened by a cell, and
  from a cell's life BEFORE the front's birth.** Drawn only inside the
  core, a grown front's rim is short of storms (31.9% of it under a cell
  where the law says 38.9%, the pin's own measure). Begun only at the
  front's birth, a young front is. With both, every point of a live core
  has cells at the one steady rate, so the Cox law is exact: the analytic
  day shares match every row within 1e-6.
- **Drift is capped at tens of kilometres.** At 120 metres a game minute
  a front rode up to 216 km over its life, and one climate's weather
  reached deep into the next. Every type now drifts at most 60 km in its
  longest life (pinned). A front still visibly moves over hours.
- **Off the map is the climate at its nearest edge, not the sea.** Found
  by the desert showing overcast its table has none of: fronts born past
  the map's edge were read as ocean, and their weather rode 140 km onto
  the land. The Iliac Bay map's north and east edges are land.

Measured, over a patchwork of every climate and at the gate:
- **Calibration.** All 24 rows sampled over the whole map, edges
  included, across 20 years of each season: a mean miss of 0.33 points
  and a worst of 1.7. The gate now samples the same way. One season
  alone sees only a few hundred independent fronts, and its noise
  reached 3.4 points.
- **Regional.** Two places 10 km apart share their weather 72-79% of
  the time, 44-55% at 30 km, and 24-32% at 100 km.
- **Cost.** The bay holds 400-700 systems, not 1,900. A whole-bay read
  is 55-115 ms cold and 3-8 ms a refresh. A player's query is 0.12 ms,
  the sky's 40 km read 0.2 ms, and a 12-hour hover forecast about 3 ms.

**The map (G2).** Every weather has its own pigment, leaning 12% toward
the pen, not a third. The pin holds every pair of pigments a visible
distance apart, and caught fog and snow as one white, so snow is now an
icy blue. The washes are laid UNDER the ink already on the sheet
(destination-over), so the coast and the borders stay the pen's. A
cell's wash thins across most of its disc, so a front's cells run into
one dark heart. Fog is signed only on a wide bank. No glyph is drawn on
the margin past the map's edge. A legend in the sheet's top-right corner
(the hands hold its lower edge) names every weather, with the pen's sign
on the four that would otherwise read as the same pale.

### Slice H shipped - shapes, and the map drawn, not blotted (2026-09-23)

(The map's part of this slice - the field, the regions, the hand - was
removed by DISC17-C, 2026-09-24. The shapes and every reader of them in
the world stand.)

Mac, on slice G's render: "I just feel like they look too much like blobs
and blots". Then, choosing the direction: "make them irregular", and on
the drawn prototype: "I like it, but the goal is not being overbearing on
the map. It needs to be more subtle". Pinned by
`test/systems/weather/weather3h_shapes.test.js` (`tools/mutants/weather3h.json` 20/20
dead). The pins of slices A-G that read a system as a disc, or the map
as washes, were re-aimed at the shapes and the regions.

**Verification.** All of slices A-G's mutants were re-run against the
shaped law. None survived, but 22 records named source the slice had
rewritten. Each was re-aimed at the same behaviour in the new code, and
8 of those then survived the pins. 2 were already caught by pins in
another file, and each record now names that file. The other 6 were
real gaps, each now pinned:
- The fog-under-a-deck case (3b) had stopped biting. Its search measured
  the deck as a disc, so the spot it found lay under the deck's outer
  ring, where the fog ranks first anyway. It now uses the law's shaped
  measure, and asserts that the deck is the weightier cloud overhead.
- The map (3e): each word is filled with its own hatch, the weaker
  first, and nothing is traced of a region a pan puts off the paper on
  any side.
- The sheet (3f): the glyphs and the legend are drawn over the pen.
- The law (3g): cells are born past the stretched core by up to a
  cell's own reach, never further.

One source fix came with it: `hatchPattern` kept a null when there was
no canvas yet, which would have pinned the bare tint for good. It now
keeps only a pattern it made.

**The shapes (the law).**
- A system's outline at bearing theta is its radius times m(theta) =
  n (1 + sum a_k cos k(theta - phi_k)), for k = 2 (the stretch that makes
  a front a band), 3 and 4 (its lobes). The amplitudes are drawn per
  system up to its type's `SHAPE_AMPS`, and n makes the mean of m^2 round
  the bearing exactly 1. So the outline encloses exactly the disc's area,
  and every band is the same shape scaled.
- The calibration is Campbell's theorem over AREAS, so it holds unchanged:
  over all 24 rows and the whole map across 20 years, a mean miss of 0.36
  points.
- The multiple-angle identities give cos and sin of k theta from the unit
  direction, so `shapeFactor` needs no trigonometry. The cloud shader runs
  the identical polynomial (`shapeF`, with `uCellS/U` for the cell and
  `uCellKS/KU` for its front's clip). A circle's shape reduces to
  `length()` exactly.
- Every reader of a system's size reads the shape: the worn word
  (`radialOf`), a storm cell's clip, the search (`reach`, and the
  exported `searchReach` bound), the wind of an approaching storm (the gap
  to the outline that way), the distant storms' "under its heart", and
  the map's glyphs. Cells are drawn over the front's STRETCHED core.
- About a third of systems or more are visibly irregular: their outline
  more than 1.4x further one way than another.
- The search bound now carries the shape's stretch. Over ~2,000 real
  systems no outline rode past that bound on its drift alone, so the ride
  term is pinned by the formula, not by a probe.

**The map (drawn in regions).**
- The travel map no longer lays a soft radial wash per system. That was
  an ink blot, whatever its colour.
- It reads the worn word off the law at every 1.6 km cell of the bay,
  once a refresh (`weatherField`). Each word's cells are traced into
  closed loops (`traceLoops`, a directed boundary walk, so holes wind the
  other way and a nonzero fill is the region). The staircase is rounded
  three times in the coast's own hand (inkMap `roundCorners`) and thinned
  to one point per third of a cell.
- The regions are drawn under the pen: a faint tint (at most 0.3), a
  sparse hatch only where something falls or lies (rain's single diagonal,
  a storm's cross-hatch, snow's and sand's dots, fog's dashes), and a thin
  outline (0.9 px) only where it helps. Cloud and the overcast deck are a
  tint and nothing more, and cloud is never outlined.
- The legend's swatches are the same hatch. The glyphs sign a front, not
  every cell: a storm cell's needs a 24 px heart.
- The map is the law: every cell's word is `weatherAt` at its centre.
- Cost: 30-70 ms for the field and 20-50 ms for the regions, once per
  refresh (10 game minutes). A pan redraws the kept loops (25-50k
  points) and never reads the weather again. On the law's side: a
  player's query 0.4 ms, the sky's read 0.6 ms, a hover's 12-hour
  forecast 8-10 ms (once per pixel per refresh), and a warm whole-bay read
  9-30 ms.

### Slice I shipped - the strength of what falls, and a lighter hand (2026-09-23)

(The map's part of this slice - the steps' hatch, the painter, the
hover, the key - was removed by DISC17-C, 2026-09-24. The law - the
intensity tapering across the core, and the player wearing what falls
after the ground law - stands, and `test/systems/weather/weather3i_strength.test.js`
keeps its two tests.)

Mac, on slice H's render: "Let's make this more subtle and push the
detail further". The detail chosen: strength inside a region, so light
and heavy rain read differently. Pinned by
`test/systems/weather/weather3i_strength.test.js` (`tools/mutants/weather3i.json`).

**The root cause was in the law, not the map.**
- `weatherFront.js` already said what intensity should do: "walking in
  from the edge thickens a drizzle into the downpour". The law did not
  do it.
- `bandAt` let the intensity fall across the system's whole outline,
  rings included. The rain core only reaches a little over half way out,
  so inside it the intensity fell from 1 to just 0.73 of the envelope.
  A grown front was heavy to its very edge: over the bay, 77% of the
  ground under rain and 64% under snow read "heavy" (at least 0.7), and
  the step from the overcast ring into the rain was a step into a
  downpour.
- The intensity now falls across the CORE, the band where the system's
  word falls: the whole envelope at the heart, a fifth of it
  (`EDGE_INTENSITY`) at the core's edge. The rings beyond hold the
  edge's fifth. A storm cell has no rings, so it is unchanged.
- Over the core's area the intensity is uniform on [0.2, 1] times the
  envelope. With the hover's own steps, a grown core is about 19%
  light, 44% moderate and 37% heavy. Measured over the bay, rain and snow
  now spread as evenly as the storm cells always did.
- In the game this is felt, not only seen: walking into a front, the
  rain starts light and builds to its heart. The word frequencies (the
  calibration) are untouched, since only the intensity changed.

**The map.**
- One strength law: `STRENGTH_STEPS` (0.35, 0.7) is what the hover
  calls light and heavy, and what the map draws (`strengthOf`). Only
  what falls has a strength.
- The field keeps each cell's step next to its word. `fieldStrength`
  traces, for every word that falls, the loops of its cells that are at
  least moderate and at least heavy. The CELLS nest: every heavy cell is
  a moderate one of the same word. The rounded loops need not: rounding
  cuts a corner by its leg's length, so an inner loop with shorter legs
  can stand up to a map pixel past its outer one. The painter therefore
  CLIPS each step to its word's region and to the steps below it, so what
  is drawn nests whatever the rounding does. Cost: 12-39 ms more, once
  per refresh.
- A step's pattern is the word's own marks again, set BETWEEN the marks
  already there, with no tint of its own. Each step doubles the marks:
  - a line family moves across its own direction, half a tile and then
    the quarters, so rain's and the storm's lines stand evenly spaced,
    11.3, 5.7 and 2.8 px apart;
  - dots move where they leave the most room: snow's stagger fills to an
    even square lattice and then to the stagger half its size (8, then
    5.66 px), the most even any arrangement of that many dots can be.
    The sandstorm's scatter spreads as widely as its three dots allow
    (5.0, then 3.6 px). The test proves both by trying every shift.
  - Every mark is drawn in its tile and the eight around it, so the
    repeat is seamless at the sides and the corners.
- The sheet lays the weather UNDER the pen already on it, where every
  stroke goes beneath the last. The painter makes its strokes in reverse
  order there, so the picture is exactly the one drawn over.
- The legend's falling words show a moderate fall, the commonest step
  over a front (42-45% of falling cells over the bay, a plurality). A
  last row shows the rain's hatch light, moderate and heavy side by
  side: "Light to heavy". With no canvas for the patterns, each step is
  a half tint more, as on the map.

**One strength for the player, the map and the hover.**
- The sim now resolves the player's word through the same ground law as
  the map and the hover: rain over snow ground is snow before the
  strongest is chosen. `wornAmong` also answers `raw`, the painting
  system's own word, which the sky's violence keeps (a winter storm
  still looks a storm while it snows).
- The hover reads the refresh's minute, the one the hatch under it was
  read at.

**A lighter hand.** Every tint, hatch and outline is about two thirds of
slice H's. The light hatch is sparser (a 16 px tile, not 12), and the
outline is a 0.7 px hairline.

**AUDIT-3i (before it shipped; Mac: "Definitely want to do one more
comprehensive audit before we push this").** Three lenses, each proving
its findings by running code; every finding was reproduced before it was
paid.
- Does it reach a player: yes. Walking into a grown front the rain now
  builds 0.50 -> 0.68 -> 0.82 -> 1.0 of its peak, where it was 0.79 at
  the edge before. Over the bay the mean rain peak fell from 0.82 to
  0.65, close to the lane without a map (0.63); thunder is unchanged
  (0.82), and online and offline read the same intensity at every place
  and minute. Paid: on winter ground the sim resolved the word BEFORE
  the ground law, so where a rain front lay under a snow front it wore
  the rain front's strength while the map drew the snow front's (2.5% of
  falling ground; the same fault left the cloud overhead unmatched in
  winter). And the hover read the live minute, not the hatch's.
- What it broke: nothing a player reads; 704 related tests, lint and
  types clean. Paid: the strength loops stood past their regions (up to
  1.1 map px); `strengthOf` made an array for every cell of every
  refresh; a core of no size gave NaN (unreachable, now all edge). Noted:
  between two overlapping rings of the same word `wornAmong` now keeps
  the stronger system rather than the nearer (rings hold the edge's
  value); nothing reads that system today.
- Do the pins derive: they did not. 16 of 18 wrong implementations
  passed every test, among them a host that never handed the strength to
  the painter, a painter that filled every step with its whole region,
  hatch marks drawn at the wrong place, and dots set in rows. The tests
  were rewritten to check the drawn geometry end to end, the paths and
  clips of every stroke, the host's hand-off, the winter ground, and the
  legend's fit; each wrong implementation is now a mutant, and all of
  them die.
- Noted, not changed: the map's "light" is a grown front's edge, 40-51%
  of the rain profile in game; the thin end of the profile is a young or
  dying front's. A hover's pixel and its 2-pixel field cell can differ in
  step at a region's edge.


### BOLT - the lightning itself (2026-09-24)

Mac: "Can we do detailed cloud and cloud to ground lighting? Not just when in storms but also being able to be
seen far away?" A storm's lightning had only ever been light: the storm overhead strobed the sun (DFU's
LightningPlayer) and a distant storm lit its own cloud (slice D). No channel was ever drawn.
- **The strike** (`systems/lightning.js`, pure): from its seed, cloud-to-ground (CG_SHARE, three in ten, as in a
  real storm) or in the cloud. A ground strike fires two to four return strokes down one channel tens of
  milliseconds apart, the first the brightest; a flash in the cloud two to five softer pulses over most of a second.
  `flickerAt` is that brightness, and the channel, the cloud's glow and the land's light all read it.
- **The channel**: a stepped leader from the cloud's base to the ground - 30 m steps, each kinked sideways with a
  little of the last one's heading, branches that fork, thin and die before the ground, the main channel alone
  reaching it. Every strike's channel is its seed's, so a distant storm's strike (seeded by the storm and the minute,
  slice D) is the same channel for every client.
- **Where**: a distant storm's strikes land inside its core (`strikePlace`) and are heard from there; the storm
  overhead's land where DFU's schedule throws them (`localStrike`: a crack 600 m to 4 km off and mostly to the ground,
  a roll 2.5 to 8 km and mostly in the cloud). The cloud's base is the sky's own thunder base above the eye, and
  both ends drop by the Earth's curve at the strike's distance.
- **Drawn** (`render/lightningBolts.js`): ribbons turned to the eye, a hot core and a soft halo, added onto the
  frame and tested against the world's depth. **Far away**: never thinner than BOLT_MIN_PX (1.4 px) on the
  screen, the air thinning its light over BOLT_SEEN_M (45 km); past the camera's six-kilometre far plane each vertex
  is drawn along its own sight line just inside it, where it lands on the screen and how wide it is unchanged.
  The strikes stand round, and the ribbons face, the eye the view is built from - world.js's is the camera
  machine's (`mwv.eye`), which in third person stands metres off the head (`cam.pos`); the first shots, taken
  with no body spawned, drew every strike 22° off its cloud until the host handed that eye.
- **The land's light**: a ground strike within FLASH_REACH_M (3.5 km) lights the land round the player from its
  side - the renderer's flash light, 300 m toward the strike and 250 m up, as Dynamic Skies' own flash stands over
  the player (the lane's lights are clustered and fall off over their range; a light at a foot kilometres off lit
  nothing). Under the mod its own flash keeps the light; the channels are drawn under it too (it draws none).
- `?bolttest=<metres>` holds one ground strike that far east of the eye at its first stroke's peak, for shots.
- Pinned by `test/systems/bolt_lightning.test.js` (9 tests: the laws on the strike, the flicker, the channel, the column,
  the store, the storm overhead, the distant strikes, and both shaders run in JS).

## MAP-LAG - the map's weather, kept (2026-09-23) - REMOVED by DISC17-C

(Removed 2026-09-24 with the weather it kept: the raster, the job, the
resting forecast and the sheet contract's `paintUnder` are gone.)

Mac: "the enhanced map now is very laggy after we introduced the weather
changes". The travel map's regions were inked on every pan and zoom
frame, its hover read a forecast on every move, and every open read the
bay again. The regions are now a kept raster under the ink, inked as a
job a slice a frame and again only when the view comes to rest. The
hover reads the forecast only when the pointer rests. The last refresh's
read is kept for the next open. AUDIT WEATHER3 R2a's law stands (a pan
reads no weather), and a pan now draws none either. Measures and pins:
`01-Overview/bugs/Field-Bugs-2026-09-23.md`, MAP-LAG.

## DISC17 - the map's weather removed, the far thunder held (2026-09-24)

Mac, in one message: "Remove the enhanced map weather enhancements
entirely" and "Sometimes thunder ends abruptly".

- **DISC17-C - the travel map is the bay again.** `ui/weatherLayer.js` is
  deleted, and `ui/heldMap.js` is its pre-WEATHER3e self plus the
  unrelated MAP-FIELD8 and MAP-FIT1 changes: no regions, glyphs, legend,
  hover weather or forecast, and none of MAP-LAG's machinery. `world.js`
  hands the map no `weather`, and its climate lookup is the plain
  `maps.getClimateIndex` again. The sheet contract loses `paintUnder`.
  The sim keeps every law the map read (`forecastAt`, `mapGround`,
  `wornAmong`); only the map stopped reading them. Retired: the
  `weather3e` and `maplag` test files and mutant lists, and the map's
  tests and records in 3f, 3g, 3h and 3i.
- **DISC17-B - the distant thunder rides with the ear.** Slice D plays a
  storm's thunder from a stand-in 13 m from the ear at a 13 m reference
  distance. A panner stays where it was put, and the ear did not. Every
  metre walked under a rolling clip was a metre off that reference, and
  at every map pixel crossed the floating origin's 819.2 m recentre moved
  the ear over 800 m from the stand-in in one frame. The clip fell 35 dB
  mid-roll. `play3d(..., { far: true })` keeps the shot's offset from the
  listener (`setListener` moves it) until its clip has run out. The storm
  overhead is DFU's ambience at a 3000 m reference, and neither a walk
  nor a recentre changes its level, so it is left as DFU has it.
- Pinned by `test/ui/disc17.test.js`; mutants `tools/mutants/disc17.json`.
  `01-Overview/bugs/Field-Bugs-2026-09-23.md`, DISC17.

## DISC20-D - a storm strikes only where it is drawn (2026-09-24)

Mac: *"Lightning can be seen even when its not storming."*

- **The cause.** Since slice G a thunderstorm is a cell of a rain front,
  and it paints (its word, its cloud) only inside its front's core as the
  core is now (`clip`). Cells are born out in the front's full-grown size,
  and many lie wholly or partly outside it. Slice D's strikes read the
  clip only for the "under its heart" skip, so four cells in ten that
  paint nothing went on striking, and 61% of strikes landed where no
  storm stands. Since BOLT each drew a bolt, lit the land and thundered.
  On the report's kind of afternoon (a swamp, the player's word sunny,
  18 clipped cells in range) that was 248 strikes and 43 thunderclaps in
  twenty real minutes.
- **The fix.** `distantStorms.js`: a strike lands only inside its cell's
  clip, and not on ground that turns it to snow where it lands. The
  centre's test stays: it is the cloud's, since a cell centred over snow
  is drawn a snow squall, whole (R1). A storm with no clip strikes as
  before, every client still sees the same strikes, and a far storm's
  lightning is still seen from afar.
- Pinned by `test/systems/disc20.test.js` (D); mutants `tools/mutants/disc20.json`.
  `01-Overview/bugs/Field-Bugs-2026-09-23.md`, DISC20-D.

## FLOW2 - the map's own work, cut to what it answers (2026-09-26)

Mac: *"is there a way to really ensure we have a faster workflow with the same standards?"* - WEATHER3a's calibration
gate (18,000 samples over the whole map and twenty years) was ~104 s, a quarter of it the collector. The map now reads
a born system's headings once for the system (`hostHeadings`: a system is one frozen object for as long as the births
cache holds it, and its birthplace never moves - every placing of it read the same twelve noise corners again), a
front's once for all of its cells, makes a shape only for a candidate that is kept - from the very six draws it always
took, in the order it always took them, so no candidate moves another's - and draws a noise corner without making a
generator for one number (`wind.js seededFirst`, `seededRng`'s own first draw: one `mulberryDraw` for both). THE SAME
BITS: a snapshot of 840 skies, 400 winds and paths, the systems near 84 places and 21 forecasts compared byte for byte
before and after, and goldens taken under the code before it pinned in test/systems/flow2_fast_tests.test.js (the wind and its
path, the sky with its system's place and shape, a front's cells and where they were born). The gate runs in ~58 s.

## RAIN-LEAK - the fall's own clock, and what a shower lets go of (2026-10-11)

Asked *"Does rain have a memory leak"* - no: `PrecipitationRenderer` and `RainCurtainsRenderer` are built once a page
(`bootWorld` and `bootExterior` run once, and every scene change is a reload), a weather change reuses the one
renderer, and the curtains' memo clears at 256. Then *"Take care of all 3"* - the three things the read found that
were not a leak but read like one:

- **RAIN-CLOCK.** Every precipitation program moves its drops by `uTime` x a per-drop rate and by the host's
  integrated wind travel (`windOff`), float32 on the GPU, and both were handed over unbounded: `uTime` the page's
  uptime, `windOff` every metre the wind had blown since boot. A day in, `uTime` x fall is ~2.5e6 m, where a
  float32's step is a quarter metre against ~0.4 m a frame of travel - the rain moves in jumps. The wisps wrap theirs
  on commensurate periods (AUDIT 68 S17-wisp-wrap-gust), but the lab's stage is pinned byte for byte to
  grass-proto.html and its fall and gust are continuous per drop, so no wrap of either is unseen. The renderer's
  `clock` re-origins instead (`uTime` from 0, `windOff` zeroed) on the first draw after the fall has been off the
  screen `PRECIP_REST_S` (10 s - a clear sky, an interior, the eye under water: how a spell of weather begins), on a
  host clock run backwards, and at `PRECIP_CLOCK_MAX_S` (an hour) of unbroken fall - one frame's reshuffle of a
  statistically identical field, where a float32's step is under a centimetre. All three programs read it (classic,
  the lab's, DS1's pixel snow), and only a draw that reaches the GPU moves it: a front at no intensity is no frame of
  the fall. The rest is 10 s and not one frame because the software GPU renders the streaming scene at seconds a
  frame.
- **The loops let go of every node.** `AudioEngine.loop` and `loop3d` (the street's rain, Better Ambience's rain
  through the walls and at a dungeon's exit) disconnected the source alone on `stop` and at a fade's end; the gain,
  the panner and the low-pass stayed wired into the bus. `releaseNodes` lets go of all of them, as the beds and the
  retrigger loops already did.
- **One eye array a frame.** The falling weather's draws (the sand, the rain and snow, the wisps) each minted
  `new Float32Array(eye)` every frame; each host now fills one (`wxEye32`, `eye32`) made at boot - world.js inside
  `drawFalling`, not in the frame, whose bytecode PERF-V8 holds under three quarters of V8's ceiling.

Pinned in test/systems/rainleak.test.js on a recording GL and a recording audio context; `tools/mutants/rainleak.json`, 16, 16
dead. What still mints an eye a frame - the bolts (test/systems/bolt_lightning.test.js pins their eye as the view's own), and in
world.js the banners, the duel wall, the gate's pool and smoke, the omen and the loot lines - is outside the falling
weather and was left as it stands.

## RAIN-HOURS and RAIN-HEART - a wet day rains for half of it, and a front can sprinkle (2026-10-13)

Mac: *"I feel like it rains too much, also sometimes instead of downpours it should just sprinkle"* - the sprinkle for
the second time (RAIN-SPRINKLE, `01-Overview/bugs/Field-Bugs-2026-10-01.md`, was the first).

**Measured first.** The map's own `weatherAt`, 3,000 places a row over the whole map and twenty years of each season,
and what falls drawn as the front draws it (`rollPeak` of the place's intensity, at the wander's mean). A woodland
spring stood under falling rain or a storm 36% of every hour, a swamp's 41%, a jungle's 54%, a summer woodland's 15%.
Of that wet time 44-56% was drawn at half the rain's profile or more (13,000 drops and up), and 17-22% under 0.15, a
sprinkle. Two causes, both in the map's law:

- **RAIN-HOURS - a day's odds worn as hours.** The Chronicles' table (`systems/weather/weatherTable.js`, DFU's digit for
  digit) is the odds of a DAY's weather, and DFU wears the day's word for all of it: a rain day rains twenty-four
  hours. Slice A solved the map's births to those odds as the share of TIME each word is worn, so the enhanced lane
  rained as long as DFU's whole rain days. A wet day is a day it rains, not a day of rain.
- **RAIN-HEART - every front poured at its heart.** WX2 rolled a strength for each shower. On the map's lane slice B
  put the place's intensity in the roll's place: the system's envelope, falling from its heart out (slice I), placed
  in the rain's range by RAIN-SPRINKLE's `rollPeak`. The envelope is 1 at every grown system's heart, so every rain
  front poured there (0.8 of the profile at the wander's mean). A sprinkle was only ever a front's edge, never a rain
  of its own. And a third or more of the wet time was a thunderstorm, which never sprinkles (WX2's `PRECIP_PEAK.storm`,
  kept).

**The fix** (`systems/weather/weatherMap.js`):
- **`WET_HOURS`** (rain 0.5, thunder 0.5), in `targetShares` - the one place the table becomes the map's amounts. The
  map wears rain and thunder for half their odds. The hours they give up go to the dry words - clear air, cloud, the
  deck, fog, the desert's sand - each lifted by the one factor, so a climate keeps its character and only rains less.
  The woodlands' spring: rain 25% -> 12.5%, storms 10% -> 5%, clear air 35% -> 44.4%, cloud 15% -> 19.0%, the deck 10%
  -> 12.7%, fog 5% -> 6.3%. Snow keeps its odds (the ask was the rain). The classic lane's table and roll are DFU's,
  untouched.
- **`STRENGTH`** (rain: [EDGE_INTENSITY, 1]) **and `systemStrength`**. Each rain front is born with its own strength - how
  hard it falls at its heart - drawn evenly from the heaviest front's edge (0.2: the weakest is a drizzle from heart to
  edge) to the downpour, and `bandAt` scales the place's intensity by it. It is the front's own draw, from its id
  (`idHash`, the FNV hash `drawCells` already seeded a front's cells from, now one function for both), never from its
  node's generator, so no other draw moves. Taken alone, before the calibration moved, it left every system, place,
  shape and cell of FLOW2's goldens the same bits and scaled each rain intensity by exactly its front's strength. A
  type with no range falls whole: snow, the sandstorm ("never thin", WEATHER2d), and the storm cell - a cell is born in
  its front, not on the lattice where a strength is drawn, and the module refuses a strength for one at load.

**Measured after** (the same samples):
- Wet time halved: the woodlands' spring 36% -> 17%, the swamp's 41% -> 19%, the jungle's 54% -> 26%, a summer
  woodland's 15% -> 7%.
- Rain (not the storms): under 0.15 of the profile 27-33% -> 63-71% of it; half the profile or more 21-24% -> 2-3%.
- All the wet time: a sprinkle 17-22% -> 36-49%; half the profile or more 44-56% -> 29-47%. What stays heavy is the
  storms, a third to nearly half of the wet time, as before.
- Heavy hours: a woodland spring's 16% of all hours -> 5%, a jungle spring's 25% -> 8%.
- A spring's 1,379 fronts over the woodlands: 30.9% with a drizzle's heart (under 0.2), 42.3% a shower's, 26.8% a
  downpour's (half the profile or more) - where every one poured.

**Pins moved, each by content.**
- `test/systems/weather/weather3a_weathermap.test.js`, THE CALIBRATION GATE: holds the sampled map to the row as the map wears it
  (`targetShares`), and `test/systems/weather/rainhours.test.js` holds that law to the Chronicles' digits.
- The same file, the thinning pin: it named the swamp's spring, which had thinned nothing since slice G - its rain
  front's cloud skirt read 0.9999999999999993 of its share, a rounding residue the pin passed on. It now names the
  woodlands' summer deck (0.78 of its share) and the desert's (none), and the swamp's spring is the row that keeps the
  whole shape.
- The same file, PRIORITY: its oracle read each system at its centre's distance, a disc, where the law reads the
  system's own measure (`radialOf`, slice H). On the moved map five of its thirty probes fell where a shape turns a
  band, and in every one the shaped read agreed with the worn word. Its ground-law half probed one line at one minute,
  which the moved map no longer rains on, and `WEATHER3a-ground-after-priority` survived it: each probe is now a place
  the bare map rains on (twenty at least).
- `test/systems/disc20.test.js`, DISC20-D: the report's afternoon grew a real storm in its four game hours (218 strikes, every
  one where the map paints thunder). The same minute about 600 km east is the report's condition on the map as it
  stands: sunny, 11 clipped cells in range, no strike - and 208 strikes and 6 claps with the clip gate dropped.
- `test/systems/flow2_fast_tests.test.js`: the sky's and the cells' goldens taken again under the new law.
- `test/systems/weather/weather3a_weathermap.test.js`, THE LAW SOLVES THE TABLE: the day's shares are now taken by the Cox law written
  out in the test as well as by the module's own. With the storms halved, the gate's 2.6 points no longer told a linear
  cell law from the true one (the solve then 1.5 points off), and `WEATHER3g-cells-linear` survived until this check.

**The sweep.** Every mutant record judged by a test that reads the weather law was run against the merged head: 700,
from 44 lists. 698 died. The two that lived were both WEATHER3g's, both judged by weather3a's file. One was
`WEATHER3g-cells-linear`, which the check above now kills. The other, `WEATHER3g-front-covers-only-rain`, is recorded
equivalent, measured: the day's re-aim absorbs a flat solve that leaves the cells out of the fronts' mean (every row's
weights within 1e-4 of themselves, every share of the day within 1e-6 by the Cox law written out). Its one kill before
was the thinning pin's rounding residue.

**Scope.** The enhanced lane's world weather map only - on by default, and always online. The classic lane is DFU's,
1:1. Off the map's lane (the `weather-events` row off - "Off uses the classic weather, the same everywhere in the
region" - or `?wxmap=off`) the zones' words keep DFU's odds, and WX2's per-shower roll already varies their strength.
The rain a winter table rolls is halved with the rest wherever it falls, as snow too on a ground that wears it
(WEATHER2a): a woodland winter snows 30% of its hours where it snowed 35%; a mountain winter's 35% and a swamp
winter's 15% stand.
A thunderstorm is still a storm, half as often and never a sprinkle: `WET_HOURS.thunder` is the knob if storms should
be rarer than rain.

Pinned by `test/systems/weather/rainhours.test.js` (4); `tools/mutants/rainhours.json`, 9, all dead; `weather3a.json` 14/14;
`weather3g.json` 15 dead and 1 equivalent as recorded.

WET-FALL (2026-10-15, a Discord report: "Player is getting wet despite it not raining. Possibly an oversight in reducing
the rain?"): RAIN-HEART's level reached the drops, the look and the ear, and not the skin - the survival soak read the
sim's word at the downpour's rate. It reads what falls now (`weatherSim.js` fallingWeather, the street's word and level
as the ear's), `01-Overview/bugs/Field-Bugs-2026-10-15f.md`; `06-Systems/Climates-Calories.md` WET-FALL.

## NIGHT-FOG - the fog is lit by the light the land is lit by (2026-10-26)

The owner, 2026-10-25: "In foggy biomes, when its dark, you can barely see anything."

**What it was.** A fog's colour is the light its droplets send to the eye, which is the light that reaches them: the
light the land stands in. The port took it from the sky. Under Dynamic Skies (`07-Rendering/Dynamic-Skies.md`, the
enhanced lane's sky by default since MO1) it is the mod's own RenderSettings.fogColor - its preset's FogDayColor walked to
black on the sun's height (`systems/dynamicSkies/dynamicSkies.js` fogColorNow; the mod ignores its own FogNightColor,
carried verbatim). Measured off the vendored presets, every weather's fog was exactly black from 18:00 to 06:00, 0.04
at 06:30 and 17:30, and a third of its day colour at 07:00 and 17:00. Meanwhile the mod's own light curve lit the land at
four fifths of noon from 06:36 to 17:24 (still three quarters at 17:30). Everything that takes the fog's colour took it
with it: the jungle's haze (`world/jungle/jungleHaze.js` hazeColorOf leans the weather's
colour, so its haze was black too, at 0.007 a metre by night), the closed canopy's dimming of it, the far ring, the
water and the sky's haze. The mod's own rows at its default density (`fogSettingsFromPresets`, each preset over ten) are
the heavy fog's exp 0.005, so a thing 200 m off sends 37% of its light, and the rain's, overcast's and snow's exp2
0.00075, which close past a kilometre. So from dusk to dawn the heavy fog closed into black across the first few hundred
metres, and the jungle's haze closed into black by 100 m (half a thing's light is gone there). That is darkness drawn
as fog, round land that the night's ambient and the moons still lit. On the dome, DFU's own rows stand (heavy exp 0.05
in DFU's grey, rain exp 0.003); its clear nights fogged to the night sky's horizon (0.04 to 0.09), and the jungle's haze
leaned off that.

**DFU, the reference.** DaggerfallSky.SetSkyFogColor (DaggerfallSky.cs:310-330) fogs to Color.gray for anything denser
than the rain at every hour, so DFU's heavy fog and snow glow a 50% grey at midnight. For the rest it fogs to the
camera's clear colour, the sky's horizon, which at night is the night sky's. WeatherManager.SetFog's interior and
dungeon branch (WeatherManager.cs:185) sets black.

**The law** (`systems/weather/nightFog.js`, through the sky's controller, `scenes/shared.js` fogColorFor). On the
enhanced lane a fog is never darker than AIR: NIGHT_AIR.albedo (0.5) of the open air's light, leaned cool
(NIGHT_AIR.tint, its luminance kept). The open air's light (`airLight`) is the exterior ambient
(`world/worldClock.js` exteriorAmbient: PlayerAmbientLight's ExteriorNightAmbientLight 0.25 at night, times the player's
Night Brightness, rising to its noon over the daylight curve and the weather's sunlight scale) plus the moons
(`render/enhancedSky.js` moonlightTerm: Secunda's lift, and half of Masser's key, because a droplet is lit from every
side and a face from one). The rule is on luminance (`litFog`): what a fog lacks of the air's is made up in the air's own
colour, so a fog keeps its hue where it has one (the dome's night blue, a dusk's) and a black fog becomes the air. A
fog already as bright comes back as itself, the same array, so a day's fog reaches the renderer exactly as before. The
controller reads the hour and the sun scale its use() was handed, and Night Brightness off the settings. The colour
it answers is the one every host hands the renderer, the jungle's haze, the canopy, the far ring, the water and the
sky's haze, so they all close into the same lit air. Moonless, the night air is (0.11, 0.13, 0.15); under a full Masser
it is up to about (0.17, 0.18, 0.21).

**DEPARTURE** (Port-Ledger A, NIGHT-FOG). The port departs from SetSkyFogColor's sky colour at night, and from
Dynamic Skies' setFogColor black, on the enhanced lane alone. DFU's Color.gray stands: it is brighter than the night
air, so the rule leaves it. The day stands: from 10:00 to 14:00 every weather on both skies and both light curves,
winter or not, comes back as itself. The nearest case is the mod's thunder at noon, 0.149 over air of 0.145, so an
albedo past 0.51 would start lifting storms by day. What moves is the night, the dusk and dawn the mod darkened ahead of
its own light, and a thunderstorm's shoulders, the mod's 0.149 walked darker on the sun's height before 10:00 and after
14:00. Those become their air, a storm no darker than the light it stands in. The classic panorama keeps
SetSkyFogColor verbatim: the 1:1 lane keeps DFU's night, as it keeps its hard-off moonlight (EV5). Indoors nothing
changes, because interiors and dungeons set DFU's own black SetFog (`scenes/worldModes.js`, `scenes/interior.js`,
`scenes/dungeon.js`) and never ask the sky's colour. A player who sets Night Brightness to none keeps a black night: the
air has no light to scatter but the moons'. Dynamic Skies' skybox keeps its own colours; it takes no host fog (MODS
AUDIT). `?nightfog=off` is the door back, read at every ask off the page's query (`systems/pageQuery.js`), so a probe
photographs one frame both ways.

**The cases.**
- *Weather fog in the Bay, and its swamps (Tigonus).* The Bay's swamp climate has no haze of its own, so its fog is the
  weather's. Each fog keeps its density, so it closes the view where it does by day. What changed is that it closes
  into lit grey-blue air and not into black.
- *Black Marsh.* The Hist swamps and the Shadowfen are Swamp, so their fog is the weather's, as above. Murkmire and
  Blackwood stand the jungle and its haze.
- *The jungle* (Bantha's, Cyrodiil's ring, Blackwood). The haze's colour leans the weather's, so at night it is the lit
  air leaned humid (`03-World/Bantha-Jungle.md`, Its colour).
- *Valenwood.* Under the closed canopy the fog's colour is dimmed 35% (`world/jungle/jungleCanopy.js` canopyFog) after
  this law, so the air under the leaves stays darker than the open air's (about 0.08). That is the canopy's own law
  (`03-World/Tamriel-Biomes.md`), left as it stands.
- *Rain at night.* On the mod's sky it was black. On the dome it was already lit grey, about 0.2, which is brighter than
  the air, so the rule leaves it.

**Pins.** `test/systems/weather/nightfog.test.js` (8): the air's numbers and its light, its colour, the lift and the
identity it keeps; the day left alone in every weather on both skies and both curves; the night lit in every weather,
the moons, the dome's blue kept, its rain and DFU's grey left, and Night Brightness at none; dusk and dawn minute by
minute (never darker than the air, and the air adding less than 0.02 a minute to the sky's own step); and the
controller (the lane, the door read at every ask, the hour, the sun, the moon and the Night Brightness it reads, the
classic panorama verbatim, indoors untouched). PIN MOVED (NIGHT-FOG): `test/scenes/audit18_hosts_outer.test.js`'s
controller pin (the sky's colour through the lit air first), `test/render/moonlight.test.js`'s seam (the term's body
is the controller's `moonNow`, which the lit fog asks too). `tools/mutants/nightfog.json`: 30, all dead.

**Seen in the running game** (2026-10-26, the freeware's data, headless Chromium on SwiftShader, 640 x 400, the land view
at 1, Dynamic Skies as it ships, a scratch probe that flips `?nightfog=off` with replaceState between two frames of one
boot, frame-synced on `__frame`; the pictures are game data and stay outside the tree). *Satakalaam's jungle* (Bantha,
`?world`, clear, 23:00, the haze at 0.0065 a metre): before, the frame was black but for a few stars and the nearest
crowns' edges (mean 0.5 of 255; the top two thirds 0.1 to 0.2); after, the canopy stands as crowns layered into grey-green
air, the far ones fading into the haze, with stars above the haze's band (mean 15.8; the top two thirds 23 and 19). *Gyselah, a
Tigonus swamp village* (`?exterior`, the mod's heavy fog at exp 0.005, 23:00): the fog's colour went from black to
(0.114, 0.126, 0.151), and the street's far houses lifted from 30 to 34 of 255. At a village's distances the mod's heavy fog
is thin, so the change there is the far air's, not the street's. *The same village in the rain at 23:00* (the mod's exp2
0.00075): the street, its lit windows and the houses 60 m off were readable before and are the same after (a frame's mean
22.5 to 23.6); the rain's fog only reaches the far land. *The same village at 17:45 in heavy fog*: the mod's fog colour was
0.003 under a land ambient of 0.333, the dusk the mod darkens ahead of its own light; the law answers that hour's air,
(0.15, 0.17, 0.20). The page died to the shared memory cgroup before the second frame, so this pair is measured on the
law, not photographed. *The same village at noon in heavy fog* (480 x 300): the renderer's fog was (0.502, 0.502, 0.502),
exp 0.005, in both frames. The two
pictures differ by 2.5 of 255 on the mean, the same lift in every band with the HUD unmoved: that is the lighting lane's
eye adaptation still easing between two frames taken seconds apart, not the fog.

**Not photographed.** Valenwood and Black Marsh stand past the Bay (`?tamrielland` on). That boot and the jungle's dusk
were killed by the container's shared memory cgroup on every attempt this session (five other streams' probes ran
beside it), so they are measured on the law alone. They run the same seam. Black Marsh's Hist swamps and
Shadowfen fog with the weather (the village's case above). Murkmire and Blackwood stand the jungle's haze (Satakalaam's
case). Valenwood stands the haze under the canopy's 35% dimming.

**Left as it was.** The lanterns' glow in the air (the lighting lane's in-scatter, `render/renderer.js` `_scatterGain`, and
the air pass's march) integrates the weather's fog alone, not the jungle's haze. On a clear jungle night a lantern lights
its haze no more than it lights open air. That would be a slice of its own, in the renderer, if the owner wants it.

## BAY-LEFT-SEA - weather born at sea past the Bay is the sea's (2026-10-27)

**What stood.** A weather system is born where the field puts it, and its climate is the map's there
(`systems/weather/weatherMap.js` climateOfField). Past the map's edge it read the climate the host's composed map answers
(AUDIT TESA-BIOME Z8: the continent's zones past the Bay), but never the Ocean: an Ocean answer fell back to the nearest
pixel of the Bay's edge (WEATHER3g's rule, from when everything past the edge read as sea and carried the sea's weather
onto the mountains). So a storm born over the Sea of Ghosts, the Topal Bay or the Padomaic took the nearest Bay edge's
climate - Mountain, along the north - and a winter's births at sea snowed a third of the time (AUDIT BAY-LEFT item 22,
D4). The player's own roll was right: it reads the pixel's climate itself.

**Now.** Past the edge the composed map's own climate is taken, the Ocean too. A map with nothing past the Bay (the land
row off, `?tamrielland=off`: MapsFile answers -1 off its PAKs) reads the edge, as ever. With the land row on the composed
map always has a continent past the edge - the trace's, or the authored rings' before it lands - so the land north and
east of the edge reads land, and WEATHER3g's case does not come back. Nothing changes on the Bay.

**On the freeware** (the composed maps; a winter's 400 words at each sea pixel, the old law beside the new):

| Sea | snow | fog | sunny | cloudy | overcast |
|---|---|---|---|---|---|
| Sea of Ghosts (1900, -620) | 142 -> 62 | 6 -> 93 | 86 -> 54 | 57 -> 78 | 109 -> 113 |
| Topal Bay (2100, 1900) | 110 -> 46 | 10 -> 83 | 79 -> 108 | 77 -> 67 | 124 -> 96 |
| Padomaic (3600, 1600) | 189 -> 64 | 10 -> 64 | 40 -> 39 | 79 -> 122 | 82 -> 111 |

**Not DFU**: DFU's weather is the region's climate roll alone; the systems on a field are the port's (WEATHER3, Port-Ledger
section A).

**The four hosts.** `scenes/world.js` reads the weather map as before - no wiring changed; `scenes/worldModes.js`,
`scenes/dungeonContext.js` and `scenes/exterior.js` FLAGGED, unchanged: indoors and in the fixed city the weather is the
same map's.

**Pins.** `test/systems/weather/bayleftsea_seaweather.test.js` (the freeware's three seas, before and after). PIN MOVED:
`test/systems/weather/weather3a_weathermap.test.js` (the sea off the map its own - 9 of 200 summer births rain at sea
where the desert edge's never do; a map with -1 off it reads the edge). Mutants: `tools/mutants/bayleftsea.json`
BLS-weather-land-off-read; `tools/mutants/tesabiome.json` TESA-BIOME-28-weather-clamped re-aimed by content and
TESA-BIOME-29-weather-sea turned with the law (the mutant now the old law) - all dead.

## E - THE ASHFALL (ASHFALL1, 2026-10-27)

The owner: "I think with the volcanic isles we could do an ashfall sort of weather with tiny lava flakes. If that makes
sense" - "I also definitely want to develop the new weather I mentioned".

**The lore.** TES III's Vvardenfell has its own weather beside DFU's seven: the ash storm. Its Ashlands region rolls Ash
30% of its weather (at each change: Clear 10, Cloudy 25, Foggy 10, Overcast 25 - UESP, Morrowind:Ashlands), and Molag
Amur rolls it too (20%, Morrowind:Molag_Amur). Red Mountain stands a Blight storm every hour of the main quest; the port's 3E 405 is before the Blight's
worst, so its volcano gets the ash, at the most. ESO's Stonefalls loading screen: "the ashfall from the
volcanoes of the Velothi Mountains and from great Ash Mountain itself is Stonefalls' bane and benefit, fertilizing the
soil" - it names the ashfall and gives no share, so Stonefalls' 15% is the port's, the least of the three. The owner's
flakes are the embers such a fall carries.

**The word.** The port's own NINTH word, `ashfall`, APPENDED after the sandstorm (enum 8: DFU's seven and the sandstorm
keep theirs - a save's byte, the classic array's mask, the Chronicles' columns, none touched). It is never rolled: on the
enhanced lane the world weather map births it. Off the map's lane (`?wxmap=off`) WEATHER2b's field stands it.

**Where - the volcano's country.** A zone past the Bay names its `ash` (`world/tamriel/tamrielBiomes.js`): the share of
its sky's HOURS under the ash - Red Mountain 0.5, the Ashlands 0.3 (TES III's own), Stonefalls 0.15. No other zone names
any. The map's law (`systems/weather/weatherMap.js` targetShares) takes that share out of the clear air and the dry
words (cloud, the deck, fog, the desert's sand) in proportion, never out of what falls: the climate table's rain, storms
and snow keep their hours, and the ash is the lore's share, all the dry sky at most. Each [climate, ash] the zones name
is its own birth law (birthLaw's `ash`, `ASH_COUNTRY`), solved once, its ceilings among the map's.

**Its birthplace.** A birthplace reads its ash through `systems/weather/weatherField.js` ashAtPixel - the zone's `ash` where the host's map wears that zone there
(its climate the zone's ground's). So the Bay, the sea and a map with nothing past the Bay read none, and the field and
the map read the volcano one way. The second audit: a birthplace asks the zones only where its climate can carry ash
(`ASH_CLIMATES`, the climates ASH_COUNTRY is laid on - `lawAt`) and never on the Bay (ashAtPixel answers none there
before it asks): every candidate of every type had asked them, filling their cache tenfold.

**The ceilings.** Every candidate of a type is drawn at its ceiling - the most any law asks of it - and thinned to the
law at its birthplace, so moving a ceiling by a bit redraws every birth of the type the world over. The ash takes the dry
words' share of the free air, and the winter mountains' cloud asks the same weight with ash as without, to the last
bits of a double (3.972145394231093 against ...087): the ash's laws had raised the cloud's ceiling by that noise and
redrawn the whole world's cloud. An ash law now raises a ceiling only where it asks more than the climates' laws past
`ASH_CEILING_SLACK` (a billionth - `typeCeilings`, `seasonCeilings`): every type but the ash is drawn at the climates'
ceiling to the bit, and the ash's own at the volcano's most.

**The system.** A plume's pall - a core 15 to 28 km in radius, 30 to 56 across (WEATHER3g's law: every system born on the land is
regional), the overcast its skirt (0.8 of a core's area, thinned to fit where the table leaves less), living six to
sixteen hours, riding the wind at 20 m a game minute (a fall of ash drifts downwind of its mountain onto the
neighbouring land), born at every hour (the volcano keeps none), from a dusting at its heart to the heavy fall
(`STRENGTH` 0.35 to 1). Priority between the sandstorm and fog: rain, a storm and snow are worn over it.

**Measured** (the map with the continent round the Bay, at each zone's middle pixel, 4,000 minutes 1,051 apart - eight
years): Red Mountain 0.50 of the hours under ash (its law 0.5), the Ashlands 0.31 (0.3), Stonefalls 0.15 (0.15); the
Grazelands, the Velothi wall, Deshaan and the Bay none. The test's own window (`ashfall1.test.js`, 300 of those minutes,
219 days) reads 0.47, 0.24 and 0.18 - a season's sample of an eight-year mean; the record had first given 0.49, 0.26
and 0.14, which no run of either window reads (the second audit, lane E). Off the volcano's
country the map is the map it was, birth for birth (2,827 births over 720 nodes of every type compared against the
code before the slice, none differing), and a warm query costs within a tenth of what it did.

**THE BIRTHS FOLLOW THE LAND.** A node's births were memoised per climate lookup alone. Past the Bay the climates (and
now the ash) are the zones', and the zones move once the trace lands after the boot or a fit is installed
(`tamrielBiomes.js` biomeStamp). A node drawn over the authored rings kept their zones' weather after the provinces had
moved. The memo is dropped when the stamp moves, as the air's tiles are (AUDIT TESA-BIOME Z5) - and the sim's systems
found about the eye are found again with it (`weatherSim.js` `_mapNearStamp`, the second audit: a minute's systems had
been kept over a moved land until the minute or the place moved).

**Every seam a word reaches.**
- The fog row: `FOG_SETTINGS.ashfall`, exp 0.006, about half a kilometre to the fog's colour, the sky not in it (the
  pall is seen); a mod's five settings have none, so the snow's stands in.
- The sun at 0.4, a shade under a rain's deck.
- An OVERCAST to every flag's reader (`weatherFlags` - Ambient Text hears "Cloudy", as for the sandstorm,
  `06-Systems/Ambient-Text.md`), neither rain nor snow - and to the music (`songManager.js` outdoorPlaylist: the
  overcast's songs) and Dynamic Skies' presets (the overcast's sky; the fog the snow's, as `fogForWeather` stands it -
  the sandstorm the fog's sky and the heavy fog's), the second audit's: DFU's arm for a word it never knew is the sunny
  day's, and a sunny tune had played under the pall.
- The sky row: a brown-grey lid, cover 0.96, a breeze a shade under an overcast's ([0.012, 0.004] to its [0.014, 0.004]).
- The cloud profile (`VC_PROFILE`): base 450 m, top 3,400, dark 0.6 - low, deep and dark.
- The cell's tint (`CELL_TINT`, a brown-grey).
- A VEIL under the pall (`CURTAIN_FALL` 0.9, the rain's kind) in its cell's tint: a tinted cell's veil is its own grey
  times the tint (the sky's curtain shader; the travel view's `render/rainCurtains.js` curtainsOf's `tint`, mixColor),
  white for every other word, none changed (`weather2d_sandstorm` holds CELL_TINT to the two). The second audit: the
  rain veil's own dark grey times a brown-grey had stood near black. The ash's column is seen falling from three
  leagues off.
- Off the map's lane (WEATHER2b's field), where cells overlap the cell worn is the strongest word's, the nearest of it
  (`wornCellOf`: thunder, rain, snow, the sandstorm, the ash) - the nearest of any had worn an ash cell's dusting over
  the rain cell it lay in.
- Cirrus 0.15.
- The wind's violence 0.3 (the ash drifts, it is not driven); Windfall reads it as an Overcast.
- The grass dim 0.58; the jungle haze's factor an overcast's.
- The body's air -5 (`WEATHER_TEMP`: dry, its pall shading the sun as a fog's does - nothing wet in it to chill a body),
  named "Ashfall".
- The front's own kind `ash`: peak 0.1 to 1, skew 1.3, never the wet fall the rain and the snow share. Its edge's haze is
  thinned and its sun lifted as a sprinkle's are (`fallTerms`).
- The ear hears a cloudy day: DFU's ambience has no ash, and it falls without a sound.
- The forecast says it ("Ashfall", "ashfall"; every language drafted).

**The fall** (`render/dryFall.js`). The dry falls - the sand and the ash - are one renderer the hosts hold
(`DryFallRenderer`): the sand's wisps built at boot as they were, and the ash's program started beside them and built
the first time the ash falls (SHADER-STALL's `compiledPass`: its compile runs while the world loads; a fault in it is
the ash's alone, warned and never drawn). Two instance sets on one program, in a 40 m box that follows the eye and
wraps by the lab's law:
- THE ASH. 12,000 grey flakes (1.8 to 4.8 cm) at a full fall, falling 0.6 to 1.3 m/s - slower than the lab's snow and as
  light, the one wind's travel carrying them - and tumbling as they go, wider in a stronger wind. Alpha-blended, dull
  and unlit, as the lab's snow is.
- THE EMBERS. 320 tiny flakes (0.8 to 2 cm) still glowing from the vents, falling 0.3 to 0.7 m/s. Each is kindled,
  white-hot for a breath, then reddens and goes out over a four- to ten-second life, flickering 4.25 to 6.5 times a
  second as it cools. They are ADDED to the frame (blend one, one), so they glow against the pall and in the night.
- Both are faced to the screen and held at 1.5 of the world image's pixels at least (`renderer.worldViewportPx` - the
  second audit: the canvas's had been read, and at a render scale under one a far flake stood under a pixel of the image
  it is drawn in), their light thinned by what the hold added, so a far flake never vanishes between pixels. A flake
  fades out in the last 0.3 to 1 m before the eye (the second audit: one at the eye had filled the screen). Both take
  the front's intensity as the share of their counts.
- THE CLOCK is the wisps' law: every rate is a whole number of cycles over 400 s and every flake's fall a whole number of
  boxes, so the wrapped clock moves no flake; the travel wraps at the box times the gust's denominator.
The hosts' one branch draws every dry fall, handing it its kind (`isDryFall`, `world/weather.js`); the rain program is
never built for the ash, at boot or after (the second audit: a world booted under a dry fall had built it). Travel
Options' weather off stands the dry falls down on a journey as it does the rain (the second audit: the ash and the sand
had fallen through it).

**The four hosts.** `scenes/world.js` WIRED and `scenes/exterior.js` WIRED - the same lines, respelled: the renderer
built at boot, the rain program's gate, the branch, the kind handed. No host function grew a logical line (HOST-SPLIT's ceiling
counts statements and entries: the one renderer stands where the sand's stood, and its import sits on the wind wisps'
line). The two
indoor hosts, `scenes/worldModes.js` and `scenes/dungeonContext.js`, are FLAGGED and unchanged: nothing falls indoors,
and the ear hears the map's word there as a cloudy day.

**Not seen.** The look - the pall's colour, the flakes' grey and count, the embers' glow - goes to the owner's eyes. The
owner had asked for no more probes, so none was run. `?weather=ashfall` stands it anywhere for a look, and the volcano's
country has it a third of the time and more.

**Not DFU**: DFU has seven weathers and no ash; the word, its law and its fall are the port's (Port-Ledger section A,
THE ASHFALL).

**Pins.** `test/systems/weather/ashfall1.test.js`. PIN MOVED: weather2d_sandstorm (the ninth word after it, the tint
table, the hosts' renderer and branch), weather.test.js and weather2b_weatherfield (the word lists), labGrass, tv1 and
tv4 (the dim, the camera's floor under the pall, the veil), fb1001_rainsprinkle, rainhours, vc7c_curtains, precip1_air,
ow_forecast (the front's skew, the strength, the curtain, the fall's spelling and the tinted veil, the forecast), the
hosts' spelling in weatherfront, weathersim, fb1001_overworld, fb1001_puddlerain (the travel gate) and rainleak (the
dry falls' one renderer), and relayversion (the relay's graph re-hashed for the ninth word). `l10n4_hardcoded`: the
ash's shader. Mutants: `tools/mutants/ashfall1.json` (55, all dead); records re-aimed by content where the slice and its
audit moved their text (fb1001_puddlerain, fb1001_rainsprinkle, ow_forecast, precip1, rainhours x2, time1, weather3a,
windfall1; audit_precip x2 and perfextc for the ceilings and the breather).

**The second audit (2026-10-27, five lanes).** Fixed and pinned: the zones asked only where the climate carries ash and
never on the Bay; the ceilings to the bit off the volcano; the sim's systems found again over a moved land; the ash an
overcast to the music and to Dynamic Skies; the field's strongest cell worn; the least size the world image's pixel; the
dry falls under Travel Options' weather off; the veil its grey times its tint; no rain program at boot for a dry fall; a
flake gone before it fills the screen; the front's wet fall never the ash's on the air's law (`ashfall1`'s "the front and
the ear" reads `rain` and `flakes` with the law on - off it they are null, and the test had read nothing); the shares
measured again (above).


## WET1 - the wet world (2026-10-30)

The request, 2026-10-30: "Мы не собираемся отказываться от ретро-вида, но хотим добавить реалистичные эффекты погоды" - keep
the retro look, add realistic weather, as Minecraft's shaders light a world of blocks and sprites. The first slice is the
wet ground: the rain now leaves a mark on what it falls on.

**The law** (`systems/weather/wetness.js`). The ground about the player soaks while rain falls and dries after, on the
game's minutes: a full rain soaks it in WET_SOAK_MIN (10) and fills the puddles in PUDDLE_FILL_MIN (45); a dry spell
undoes them over WET_DRY_MIN (120) and PUDDLE_DRY_MIN (240). The rain is the front's shown fall (WX2) at its
intensity, less its snow share; sand and ash wet nothing. A fall at WET_FULL_RAIN (a quarter of its profile) soaks the
ground whole, so a sprinkle darkens it a little; puddles stand only past PUDDLE_RAIN[0] (0.3). A first tick or a clock
run back lands on the weather whole; a rest has run its course by the same steps.

**The draw** (`render/wetGlsl.js`, in the lane's EL_TERRAIN_FS and EL_MESH_FS). One uniform, uWet: the wetness, the
puddles' fill, a clock and the rain now. A soaked surface's albedo darkens (WET_DARK, walls WET_WALL_DARK), puddles
stand on the flat ground in the snow's own noise lattice (snowNoise, so they hold still across pixels) and fade with
the footprint, and drops ring them near the eye while it rains. Every lamp glints in the wet through the lantern loop
BLOOD3 built for blood (`elPointLitWet`, `wetFresnel`), the sun through a lobe that tightens from a sheen to a puddle's
point, and the sky shows by Fresnel: the fog's colour mixed over the finished display colour, as a mirror shows it.

**Where.** `renderer.js` setWet takes the frame's uniform after beginFrame, which dries it, as the cloud deck is a
frame's (VC4). The two street hosts wire it: `scenes/world.js` and `scenes/exterior.js` tick it beside setCloudShadow.
`scenes/worldModes.js` (interiors) and `scenes/dungeonContext.js` never set it, so they draw dry; a sprite pass, a bake
or a panel uploads it dry too. The Snowfall mod's variant (`snowfallGlsl.js` snowTerrainFs) cuts the ground's decode,
and its own text says its snow is never wet. The classic lane has no uWet: DFU's look is untouched. `?wet=off` is the
door. The law reads the front at the player and nothing of the place, so it holds in every province as it does in the
Bay.

**Pinned and seen.** `test/systems/weather/wet1_wetness.test.js`: the law's rates, a sprinkle, a shower, a load, the
door, the uniform, both lane programs and the Snowfall variant's one `wetAt`, and the renderer's stamp and beginFrame's
dry. The three programs were compiled in WebGL2 (Edge), and a misspelt call was refused. `tools/wetProbe.mjs` shoots a
street wet and with `?wet=off`: Sentinel at noon in rain differed by 7.66 a channel on the mean, at 21:30 in a storm
by 6.86, and a night's sprinkle (rain 0.04) by 0.86, as its law says. In Daggerfall and Wayrest on the boot's late-autumn
date the ground lay under snow, and the wet stayed under it. No probe stood past the Bay.

**WET1b (2026-10-31).** A puddle, a road and soil were one highlight: the stone's lobe (`elSpecK`, left at 1 off the
rain) plus one sheen. In the rain soil stays nearly matte (WET_SHEEN_SOIL), a path tile (46, 47, 55) takes a dull
sheen, and a puddle drops that lobe and keeps a tight lamp glint. The puddle's edge is PUDDLE_EDGE wide, not a line.
The lab's rain streaks fade to 0.22 alpha. The sky mix takes the ambient with the fog, so a night puddle is not black.
**WET1c.** Lab rain enables DEPTH_TEST and culls drops inside nearby building AABBs (`setShelters`), floor to roof
(`uShelterY` min/max), so a porch and a room stay dry and open air under a tall box still rains. Puddle rings use a
finer cell and a higher rate. Eave drips were tried and pulled: the AABB eave was the ridge, and the model-edge pass
still drew nothing the eye could trust.

**WET1d.** A puddle read as matte stone: the lamp's diffuse pool lay on it, and the night mirror was the full ambient.
Now the puddle takes little diffuse (PUDDLE_DARK), the wet lobe tightens to PUDDLE_GLOSS with PUDDLE_STRETCH (a lamp is
a point, not a column), the mirror shows WET_SKY_AMBIENT of the ambient, and a lamp-lit pane glints in it (`winGlint`)
only where there is puddle. Soil stays matte: WET_SHEEN_SOIL and soil glints are a tenth of a road's, and a soil puddle
takes PUDDLE_SHEEN_SOIL, not glass. `roadAmt` smears soil↔stones at the paving's edge. `winGlint` mirrors the glass
mask and marches previous depth so a bush hides the pane. Soil scatters more than stone. Distance softens from
WIN_GLINT_NEAR_M to WIN_GLINT_FAR_M. Stone panes take +25% soft. Mesh compiles no `winGlint`.

**WET1e.** Building/tree colour in puddles is a separate full-res pass at the air resolve (not terrain FS - that TDRd):
one continuous aim-height sample along the reflection ray of THIS frame (leans up with R.y), soft world-space
confidence + blur. Dual bands and ray-march picked different UVs per pixel → horizontal stripe tears. Search length
grows with puddle distance. Gated by wetGround-matched `pudNoise` and WET_PROXY_FAR_M. Puddle `winGlint` / lamp
`wetGlint` boosts are off once fill passes WET_PROXY_GATE. Ripple drops vary size/width/amp per tick. Terrain still does sky.

**Not yet.** True SSR / Hi-Z. A porch's floor still wets as the street does. Meshes take no puddles. No eave drips.
