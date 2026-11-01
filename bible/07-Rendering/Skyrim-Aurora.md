# Skyrim Aurora

On clear nights in Skyrim, green and teal curtains of light hang over the north sky, stars and moons showing through
them. The aurora also lights the land faintly and shows in calm water. DFU's sky has no aurora, so this is our own,
following the lore of TES V's Skyrim. It draws on the enhanced lane only; the classic lane keeps Daggerfall's painted sky.

## How it works

- **Where.** Skyrim alone. The weight is 0 unless the player's pixel is in Skyrim's theatre, or, at sea past the Bay,
  the nearest land within ten picture units is Skyrim's (`skyTheatreAt`). So the Sea of Ghosts wears it and the far
  ocean does not. The rest of Tamriel, the Bay included, has none.
- **Latitude.** Read on the land in use: Skyrim's first and last picture rows, found once a land version
  (`skyrimRows`). Strength runs from 0.6 at the south edge to full on the north coast; the arcs hang low over the north
  horizon in the south and nearly overhead on the coast.
- **When.** By the sun's elevation below the horizon: none above -6 degrees, full below -16. This reads the frame's own
  game minute and is never eased, so a rest into the day removes it at once.
- **Sky.** By the sky controller's eased cloud cover. Under volumetric clouds it fades from 0.6 and is gone at 0.9;
  over the sky's own decks (no volumetric clouds) it fades from 0.35 and is gone at 0.55. Under Dynamic Skies a weather
  whose style puts out the night sky puts it out too.
- **Night.** An evening and the following morning are one night (`auroraNight` turns at noon). Each night rolls quiet,
  common or strong, and a swell moves it by up to a fifth over 150 game minutes.
- The host eases the sky's aurora with a 6 s time constant (`AURORA_EASE_S`), so a border or cloud fades it. Its first
  frame, and the first after a weather jump, takes it whole.

### The look

Three east-west arcs, 1.3 hem heights apart, each waved by three sines, are ray-marched from a rising and falling hem.
Each arc is a thin sheet cut by moving rays with a wide glow. Samples are widened by their own step so the march does
not stipple; the light rolls off toward 0.95 and a 1/255 dither stops banding. The march draws into a reduced map, and
one triangle at the far plane adds it to the sky.

### Light and water

- **Land.** `src/scenes/auroraHost.js` `withAuroraLight` adds `AURORA_LIGHT` times the drawn weight to the moonlight's
  ambient term, so every reader of the world's moonlight takes it: land, flats, the water's body, the night air. It is
  ambient only and casts no key.
- **Water.** Every third frame the pass marches a 256 x 64 dome map by direction (`AURORA_DOME`). The water reads it
  along its reflected ray (`src/render/waterSurface.js` `auroraDomeUv`) at its Fresnel or `AURORA_MIRROR`, whichever
  is more. After a gap of half a real second (`AURORA_DOME_GAP_S`) it is marched afresh. It is bound on unit 25
  (`AURORA_SKY_UNIT`), with a black texel while there is none.

### Clock

The curtains move on the sky's walk clock (the event clock online), so a room sees the same curtains. A pause stops
them and a rest speeds them. Phases are wrapped in double precision on the CPU so the curtains never jump.

## Rules

- Skyrim's sky alone (the owner): the owner asked for Skyrim's sky, and Skyrim is the province the lore gives an aurora.
  Other provinces answer with no aurora on purpose.
- The aurora lights the ground (the owner), as ambient only.
- Cost follows the clouds' quality tier: `lo` 6 steps into a half-size map, `default` 10 into a half-size map, `hi` 12
  into a three-quarter map (`src/render/auroraPass.js` `AURORA_QUALITY`). The dome map is a fixed 16,384 texels.
- Its three programs start at boot idle, last in the queue (`src/render/playPrograms.js`); the host never waits for them.
- Doors: `?aurora=off` builds nothing; `?aurora=on` or a number 0..1 stands it at that weight anywhere, at any hour.

## Code and tests

- `src/world/tamriel/skyrimAurora.js` - the law: `auroraSky`, `auroraTarget`, `skyTheatreAt`, `skyrimRows`,
  `auroraNight`, `auroraDark`, `auroraClear`
- `src/render/auroraPass.js` - `AuroraPass`, the march, the dome map, the add
- `src/scenes/auroraHost.js` - `createAuroraHost`, built by the sky controller (`src/scenes/shared.js`); `auroraDoor`,
  `withAuroraLight`
- Hosts: `src/scenes/world.js` through the sky controller and its place door; `src/scenes/exterior.js` sets no place
  door, so draws none; `src/scenes/worldModes.js` runs it on a made level's street sky; `src/scenes/dungeonContext.js`
  draws no sky
- `test/world/skyrimaurora.test.js` - the law, the place on the traced map, the sea, the clock, the pass, the dome map,
  the light, the water, the unit, the door and the wiring
- `tools/auroraProbe.mjs` - boots in the Bay at night, then jumps to Solitude and reads the north sky

## Open

- The far ring's sea mirrors no aurora: its water program reads no dome map.
- The Sky-Ketch's deck lights by its own moon term, so the aurora over a made level does not light the deck.
- The land reads the aurora's light a frame behind the sky, as it reads the moon.
