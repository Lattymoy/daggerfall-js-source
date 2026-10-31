# Weather

On the enhanced lane, weather is a place rather than a state. Storms, rain bands, snow squalls, fog banks, overcast
decks, cloud fields, sandstorms and ashfalls are systems on the land, born somewhere, drifting on the wind, growing and
dying. The player sees a storm on the horizon before it arrives, walks into it and out of it, and hears distant thunder
late and quiet. The classic lane keeps DFU's weather, one word for the player's climate zone, 1:1.

## How it works

### The world weather map (`src/systems/weather/weatherMap.js`)

- `weatherAt(x, z, minutes, climateAt)` is pure: the same place and minute give the same weather on every client,
  offline (the save's clock) and online (the shared clock). Nothing is rolled per day and nothing is carried; a load,
  rest or fast travel reads the map at the new minute.
- **Births** are a Poisson process in space and time per system type: a lattice of nodes, each drawing candidates from
  a generator keyed on its cell and a world constant, thinned by the type's birth weight for the climate and season
  under it and the hour (`birthLaw`, `diurnal`). The weights are solved from DFU's own table (the Chronicles' odds,
  `src/systems/weather/weatherTable.js`), so the table still decides how much weather a climate gets; the map decides
  where and when. A calibration test holds the sampled map to the table.
- **Rain hours.** A table day of rain is worn as half its hours (`WET_HOURS` rain 0.5, thunder 0.5); the freed hours go
  to the dry words in proportion, so a climate keeps its character and rains less. Snow keeps its odds.
- **Systems** are discs cut into bands (core, ring, skirt): a thunderstorm is thunder, then rain, then cloud; a rain
  band rain, then overcast, then cloud. Intensity falls from the core out. Each rain front draws its own strength from
  a drizzle (`EDGE_INTENSITY` 0.2) to a downpour (`systemStrength`); snow, sand and storm cells fall whole.
- **Motion:** a slow prevailing wind field (`windAt`), a westerly bent by large-scale noise with backing and veering
  terms. A system's position is its birthplace plus the wind's path since birth, in closed form.
- **Priority** where systems overlap: thunder, rain, snow, sandstorm, ashfall, fog, overcast, cloudy (`PRIORITY`). The
  worn word is the highest present; the others still show in the sky.
- **Past the Bay** a birthplace reads the composed map's own climate, the Ocean included, so weather born over the Sea
  of Ghosts is the sea's. With nothing past the Bay (`?tamrielland=off`) it reads the Bay's edge. Births are dropped and
  redrawn when the zones past the Bay move (`biomeStamp`).

### What each consumer gets

- **The player's word and intensity** (`src/systems/weather/weatherSim.js`): on the lane, the map at the player every
  exterior frame. A change on a live frame is a crossing (the front's short lead); an arrival, load, respawn or clock jump
  is a jump. What falls is the air's (`mapGround`, `Biome-Precipitation.md`); the skin's soak reads what falls now
  (`fallingWeather`).
- **Indoors** the map is read at the door's position, so the rain through the door starts and stops while inside.
- **The clouds:** every system near enough is a cell of the volumetric field, so a sunny valley shows the storm on the
  ridge (`skyCells`, `Volumetric-Clouds-Arc.md`).
- **The wind** rises with a storm's approach (`approachAt`).
- **Distant storms** flash their own cloud; a ground strike's channel is drawn as ribbons of light seen far away
  (`src/render/lightningBolts.js`). Thunder arrives after its distance over the speed of sound, quieter with distance.
  A storm strikes only where it is drawn.
- **The forecast** on the overworld is `weatherAt` asked of the way ahead (`src/systems/weather/owForecast.js`).

### Words of our own

The weather list keeps DFU's seven words at their enum values and appends two (`src/world/weather.js` `WEATHER_TYPES`):

- **Sandstorm** (8): born only over the desert tables' land. A tan wall on the ground with a lid 900 m up, fog exp 0.09
  with the sky in it, sun 0.35, wind violence 0.95, sand blown as a dense look of the wind-wisp program (`SAND_LOOK`).
  Heard as a cloudy day with the gale's wind.
- **Ashfall** (9): born over Red Mountain (half its hours), the Ashlands (0.3) and Stonefalls (0.15), the zones' `ash`
  in `src/world/tamriel/tamrielBiomes.js`. The share comes out of the dry words only. A brown-grey pall (fog exp 0.006,
  sun 0.4), a veil in its cell's tint, grey ash and a few glowing embers (`src/render/dryFall.js` `DryFallRenderer`,
  compiled at boot, built at the first ashfall). Every reader of weather flags hears overcast; the music plays
  overcast's songs; it falls without a sound.

### Night fog (`src/systems/weather/nightFog.js`)

On the enhanced lane a fog is never darker than the open air's light: half of the exterior ambient plus the moons,
leaned cool (`NIGHT_AIR`), applied on luminance so a fog keeps its hue. The sky controller hands this colour to every
host (`src/scenes/shared.js` `fogColorFor`), so land, far ring, water, sky haze and jungle haze close into one lit air.
By day nothing changes. Under a closed canopy the canopy's own dimming still applies. `?nightfog=off` turns it off.

## Rules

- Weather can be travelled into and out of, seen coming, with a sandstorm wall visible in the distance (Mac).
- It should rain less, and sometimes just sprinkle (Mac); `WET_HOURS` and per-front strength are that law.
- Pure in place and minute: nothing is sent; online every client reads the same map on the shared clock.
- Appended words never move DFU's enum values (a save's byte, the classic mask, the Chronicles' columns).
- The switch is the **Weather as places** row (`weather-events`), on by default and forced on online. Off, or
  `?wxmap=off`, the enhanced lane reads the zones' day words as a field of cells instead
  (`src/systems/weather/weatherField.js`), and the front's per-shower roll varies their strength.
- Without the air's law (the fixed city, `?biomeprecip=off`), rain or thunder over a ground that wears snow falls as
  snow, with the storm's wind kept (`overGround`; `?snowground=off` turns it off).

## Daggerfall Unity

DFU's weather is a zone's word rolled once a day (`WeatherManager`, the Chronicles' table, six zones), applied to the
whole sky. We keep that on the classic lane. Departures, enhanced lane only: weather systems on a field; rain worn as
half the table's day; two appended words; night fog lit by the air instead of `DaggerfallSky.SetSkyFogColor`'s sky
colour or Dynamic Skies' black (DFU's grey heavy fog stands, being brighter); interiors keep DFU's black `SetFog`.

## Code and tests

- `src/systems/weather/weatherMap.js` - systems, births, wind, `weatherAt`, `skyCells`, `forecastAt`
- `src/systems/weather/weatherSim.js` - the player's word, the lanes, `mapGround`, `overGround`, `fallingWeather`
- `src/systems/weather/weatherField.js` - the zones' words as cells, the ash at a pixel
- `src/systems/weather/weatherFront.js` - the eased front
- `src/systems/weather/nightFog.js`, `src/render/dryFall.js`, `src/render/lightningBolts.js`
- `test/systems/weather/weather3a_weathermap.test.js` - the calibration gate, priority, the sea past the Bay
- `test/systems/weather/rainhours.test.js` - `WET_HOURS` against the Chronicles' digits
- `test/systems/weather/ashfall1.test.js`, `test/systems/weather/nightfog.test.js`,
  `test/systems/weather/bayleftsea_seaweather.test.js`, `test/systems/rainleak.test.js`
