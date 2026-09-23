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

`test/weather2a_snowground.test.js`.

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
reached under a sunny zone's lower lid. A cell's `dark` and `grey`
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

`test/weather2c_cloudcells.test.js`.

## B - THE WEATHER FIELD (WEATHER2b, 2026-09-14)

Mac: "a dynamic world space event system where weather can be traveled
out of and into instead of just starting and stopping in your
location."

**What stood.** DFU's weather is a state of the player's climate ZONE:
six words a day, the player's zone's word applied, the sky that word
to the horizon. A rain day rains everywhere in the Woodlands at once;
a storm has no edge. The classic lane keeps that, 1:1.

**The field** (`systems/weatherField.js`, pure). The ENHANCED lane
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

`test/weather2b_weatherfield.test.js`.

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

`test/weather2d_sandstorm.test.js`.

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

- **A - The map law** (`systems/weatherMap.js`, pure): the lattice,
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

`systems/weatherMap.js`, pure, and `systems/weatherTable.js` (DFU's
table, dispatch and roll moved whole out of `weatherSim.js`, which
re-exports every name, so the map and the sim read one table without an
import cycle). Pinned by `test/weather3a_weathermap.test.js`, with
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
`test/weather3b_simseam.test.js` (`tools/mutants/weather3b.json` 17/17
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

The clouds read the map whole. `test/weather3c_sky.test.js` pins it
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
`test/weather3d_distantstorms.test.js` (`tools/mutants/weather3d.json`
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
  storm, so it comes from its side.
- **Whose storm**: under a thunderstorm's heart, DFU's LightningPlayer
  and the ambience own the lightning and thunder, as before. Only the
  others strike here. A jump (a load, a landing) plays no backlog and
  forgets the thunder still on its way (as shipped, only when the word
  changed; slice F made every landing count). Enhanced only, never under a
  `?weather` pin, and nothing off the map's lane.

### Slice E shipped - the weather on the map (2026-09-22)

The enhanced travel map shows the picture Mac drew: sunny here, cloud
there, a rainstorm over the hills. The law is `ui/weatherLayer.js`, and
it is drawn on `ui/heldMap.js`'s world sheet. Pinned by
`test/weather3e_maplayer.test.js` (`tools/mutants/weather3e.json` 15/15
dead).

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
things. Pinned by `test/weather3f_audit.test.js`
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

Pinned by `test/weather3g_fronts.test.js` (`tools/mutants/weather3g.json`
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
