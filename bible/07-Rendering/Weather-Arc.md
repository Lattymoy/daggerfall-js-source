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

### The fog's colour (`src/scenes/shared.js` `outdoorFogColor`)

DFU's law (`DaggerfallSky.SetSkyFogColor`): an exp fog past the rain's density (`RAINY_FOG_DENSITY`, 0.003) is grey, a
thinner one the sky's colour. A thinned snow or ash passes between DFU's rows, so between the rain's density and the
snow's (`GRAY_FOG_FULL_DENSITY`, 0.005) the colour eases from the sky's to the grey on a smoothstep. Each of DFU's rows
keeps DFU's colour. The rain is the sky's, and the snow, the heavy fog, the ash and the sandstorm are grey. Both lanes
take it. Every far view stands in this colour (`03-World/Red-Mountain.md`), so it never flips in a frame. Under Dynamic
Skies the fog is the mod's own colour.

### Night fog (`src/systems/weather/nightFog.js`)

On the enhanced lane a fog is never darker than the open air's light: half of the exterior ambient plus the moons,
leaned cool (`NIGHT_AIR`), applied on luminance so a fog keeps its hue. The sky controller hands this colour to every
host (`src/scenes/shared.js` `fogColorFor`), so land, far ring, water, sky haze and jungle haze close into one lit air.
By day nothing changes. Under a closed canopy the canopy's own dimming still applies. `?nightfog=off` turns it off.
DFU's grey stands at night, being brighter than the night's air. A darker snow or ash at night would change the whole
frame's fog: open, the owner's call.


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
date the ground lay under snow, and the wet stayed under it. No probe stood past the Bay. Settings: Features / Graphics row
`wet-world` (Off / Wet / Full). High and Ultra ship Full (puddle building colour). `?wet=off` still kills it.

**WET1b (2026-10-31).** A puddle, a road and soil shared one highlight: the stone lobe (`elSpecK`, left at 1 off the
rain) plus one sheen. In rain, soil stays nearly matte (WET_SHEEN_SOIL), a path tile (46, 47, 55) takes a dull sheen,
and a puddle drops that lobe and keeps a tight lamp glint. The puddle edge is PUDDLE_EDGE wide, not a line. Lab rain
streaks fade to 0.22 alpha. The sky mix takes ambient with fog, so a night puddle is not black.

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
span taps along the reflection ray of THIS frame (AIM0..AIM1 m above the puddle), best soft world-space confidence +
blur. A single fixed aim height only showed a horizontal strip of the facade; dual bands tore stripes. Search length
grows with puddle distance. Gated by `wet-world` Full, wetGround-matched `pudNoise` and WET_PROXY_FAR_M. Puddle
`winGlint` / lamp `wetGlint` yield via `uWetProxy` while Full runs. Ripple drops vary size/width/amp per tick. Terrain
still does sky.

**WET1f.** Ground mirrors only in paving/street puddles: `wetGround(..., road)` stands no soil puddle,
`wetGlossGround` is `w.y * road`, colour proxy `roadGate` on the eye chunk's tilemap. Soil stays wet-dark only.
Blend must sample the puddle on texture unit 0 after the tilemap bind.

**Not yet.** True SSR / Hi-Z. A porch's floor still wets as the street does. Meshes take no puddles. No eave drips.

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
colour or Dynamic Skies' black (DFU's grey heavy fog stands, being brighter); interiors keep DFU's black `SetFog`. On
both lanes, DFU's grey eases in between the rain's density and the snow's, where DFU has no row.

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
- `test/render/fb1031_light.test.js` - the grey eased in
