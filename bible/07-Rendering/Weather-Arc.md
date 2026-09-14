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
