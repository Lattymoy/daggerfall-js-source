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
