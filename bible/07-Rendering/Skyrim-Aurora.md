# Skyrim's aurora (SKYRIM-AURORA, 2026-10-29)

The owner, 2026-10-29: "let's develop an aurora for the skyrim sky then. This is the reference". The reference is a
painted night over a snowy, wooded hill: green and teal curtains with bright cores, a blue glow about them, a navy sky
with stars. It is the owner's picture and is not in the tree. The port's hem is green and its crown teal-blue, with a
blue glow: chosen to read as the picture does.

DFU's sky has no aurora, so this is the port's own (Port-Ledger A, SKYRIM-AURORA). TES V's Skyrim shows one on clear
nights, and that is the lore it follows.

## What it is

- **The law** (`world/tamriel/skyrimAurora.js`). `auroraSky` answers the sky's own aurora at a place: a weight 0..1
  (the latitude's strength, times the clear sky, times the night's strength) and `hang`, how far north of the eye the
  arcs stand. `auroraTarget` is that times the dark.
- **The pass** (`render/auroraPass.js`). The march draws into a map at the quality tier's share of the world image, and
  one triangle at the far plane adds the map to the sky (one, one). The stars and the moons show through it.
- **The door** (`scenes/auroraHost.js`). Built by the sky controller (`scenes/shared.js` createSkyController) on the
  enhanced lane. It reads the player's pixel, eases the sky's own aurora over real seconds, and multiplies by the dark
  at the frame's own game minute.

## Where: Skyrim alone (the Tamriel-wide record)

The weight is 0 unless the player's pixel stands under Skyrim's sky: `theatreAt` says Skyrim, or, at sea past the Bay,
the nearest land within ten picture units is Skyrim's (`skyTheatreAt`). So the Sea of Ghosts wears it, the far ocean
does not.

Its latitude is read on the land in use: Skyrim's first and last picture rows, found once a land version
(`skyrimRows`). On the authored shape they are 18.25 and 77.75; on the traced map the game runs, 29.25 and 80.75, and
Solitude stands at 0.999. The scan costs about 15 ms once a land version, and only in Skyrim.

The strength is 0.6 at the south edge and all of it on the north coast and the sea past it. The arcs hang 3.2 hem
heights north of the eye in the south, low over the north horizon, and 0.4 on the coast, nearly overhead.

The rest of Tamriel has none, the Bay included. The owner asked for Skyrim's sky, and Skyrim is the province the lore
gives an aurora. The pins hold Skyrim's coast, pinewoods and sea beside Daggerfall, Morrowind, High Rock, Cyrodiil, High
Rock's north sea and the far ocean.

## When

- **The dark.** By the sun's elevation on worldClock's arc, continued under the horizon: none above -6 degrees, whole
  below -16 - 18:24 to 19:04 in the evening and 04:56 to 05:36 in the morning. It is the frame's own minute, never
  eased, so a rest or a jump into the day takes the aurora at once.
- **The sky.** The sky controller's eased cloud cover (`enhancedSky.js` WEATHER_SKY). A cloudy night (0.55) keeps it
  whole, the volumetric clouds drawn over it. It fades from 0.6 and is gone at 0.9. While the sky draws its own cloud
  decks (no volumetric clouds yet, `?clouds=off`), the aurora is drawn over them, so it fades from 0.35 and is gone at
  0.55. Under Dynamic Skies a weather that puts the night sky out (DaggerfallSky.cs:363-367's WeatherStyle) puts it out
  too, as the mod's presets switch on it. The port's dome reads no WeatherStyle, and its cover walks on the front. The
  sun baby's flower sky (SUNBABY1) puts it out while it stands, as its water's sky is the flower's.
- **The night.** An evening and the morning after are one night (`auroraNight` changes at noon). Each night rolls a
  tier on the sky's clock: quiet (a fifth of the nights, 0.3 to 0.5), common (0.55, 0.6 to 0.85) or strong (a quarter,
  0.9 to 1). A swell moves it by up to a fifth over 150 game minutes.

The door eases the sky's own aurora with a 6-second time constant, so a border or a deck of cloud fades it. Its first
frame, and the first after a weather jump (a load, a landing, a respawn), takes it whole. A bad frame never latches it.

## How it looks

Three arcs run east-west, 1.3 hem heights apart, each waved by three sines. Each ray is marched up through them from a
hem that rises and falls to 1.5 hem heights above it, so a curtain overhead fans to the zenith and a far one stands low
in the north. Each arc is a thin sheet cut by moving rays, with a wide glow about it.

Each sample is widened by its own step (its variance plus the step squared over 12, its light kept), so the march does
not stipple. Detail fades where a texel spans it, at the edge-on east and west. The horizon's longer path lifts it by
1.5 at most, and it fades into the haze over the last seven degrees. The light rolls off toward 0.95, so a corona
overhead never clips flat, and a 1/255 dither keeps the dark sky free of bands. A ray that passes every arc's reach
skips the march. A Hollow's brass air dims it.

## Its light on the land

The owner, the same day: "It should reflect and light the ground". The aurora's light rides the sky's moonlight term
(`scenes/auroraHost.js` withAuroraLight): `AURORA_LIGHT` (0.012, 0.06, 0.042) by the weight the last draw showed is
added to its ambient lift. So the brass air's veil dims it with the curtains, and a pass not built yet lights nothing. A
moonless night under an aurora gets a term with no key. Every reader of the world's moonlight takes it, with no host
line: the land's and the flats' ambient, the water's body and the night air (NIGHT-FOG). At full strength its green is a
quarter of the night's own 0.25 (at NightAmbientLightScale 1). It is ambient alone: the aurora lights from a whole
quarter of the sky, so it casts no key.

The view out of a building (RW1) asks the light at its clock minute (`moonlight(clockMinute)`), so a rest into the day
takes it from the street behind the glass.

## In the water

Every third frame the pass marches a small dome map by direction (`AURORA_DOME`: 256 x 64, azimuth across, height up,
six steps). The sky controller hands it with the water's sky (`waterSky`'s `aurora`), and `waterUniforms` forwards it.
The water reads it along its reflected ray (`render/waterSurface.js` auroraDomeUv) and adds it as the glints are added,
at its Fresnel or `AURORA_MIRROR` (0.3), whichever is more. Calm water at night shows the curtains as it shows a lamp;
the bare Fresnel, a few hundredths looking down, hid them.

The map is by direction, so a reflection a frame or two old still lines up. It is handed only on a frame the aurora
drew, and marched afresh after a frame it did not or a gap of half a real second (`AURORA_DOME_GAP_S`: an interior, a
hitch), so the water never shows old curtains. The renderer binds it on unit 24, no other fixed unit's, and holds the
black texel there while there is none.

Found on the way: the water's snow-lines sampler got its unit only on a frame with the ground's snow. A frame without it
left the sampler on unit 0 beside the tile array, and the water was refused. So the water never drew with Enhanced
Environments off (or `?snowground=off`, `?wxmap=off`, `?biomeprecip=off` offline), on a boot before the snow was read,
on the fixed-city bench or in the water lab. Both water programs now send their fixed samplers when they are built, and
both units hold the black texel from the start (`renderer.js` `_waterSamplerUnits`).

## Its clock

The curtains walk on the sky's walk clock (`classicMinutes`, the event clock online), a game minute five of its
seconds. So a room online sees the same curtains and the same night. A pause stops them and a rest speeds them, as it
speeds the clouds. The phases are wrapped in double precision on the CPU, and the rays' noise rows repeat every 256, so
the curtains never jump. The first version ran on each machine's own clock and jumped every real hour.

## Its cost

The quality tier is the clouds' (`render/volumetricClouds.js` QUALITY): `lo` 6 steps into a half-size map, `default`
10 into a half-size map, `hi` 12 into a three-quarter map. Measured on SwiftShader at 400 x 240, a whole-sky view north,
the median of seven means of three frames, the dome map included: the sky's dome 10.9 ms; `lo` 4.7 (6.3 on a frame the
dome map is marched), `default` 6.3 (7.5), `hi` 16 (18.2). The first version's full-size march was 2.3 times the sky's
dome. `?aurora=off` is the way out.

The dome map is a fixed 16,384 texels at six steps, about 1.8 ms there. It does not grow with the screen: at 1080p, by
sample steps, it is about 2% of the `default` march on its frame and under 1% over three frames.

## The four hosts (Home.md)

`scenes/world.js` WIRED, through the sky controller alone: the place is the world host's own door
(`characters/provinceFolk.js` setFolkPlace, read by `pixelHere`), so bootWorld grows by nothing. `scenes/exterior.js`
builds the same controller but sets no place door, so it draws none (the door aside). `scenes/worldModes.js` draws the
street's sky only on a made level (the Arena's floor, the Sky-Ketch's decks, through `host.drawSky`): the controller's
`retime` runs the aurora at `playerTravelPixel`'s dungeon pixel. `scenes/dungeonContext.js` draws no sky.

The classic lane keeps Daggerfall's painted sky, untouched: the controller builds no aurora there.

## Its compile

Where the driver compiles beside the frames (KHR_parallel_shader_compile), its three programs are started at the boot's
idle (`render/playPrograms.js`), last in the queue: they are met only under Skyrim's night sky, and the door never
waits, so a late one fades in. Elsewhere the first frame that wants it builds it, as every pass's does.

## Doors and gates

- `?aurora=off` builds nothing. `?aurora=on` or a number 0..1 stands it at that weight anywhere, at any hour.
- The sky lab: `sky.html?hour=23&aurora=1&hang=1.5` draws it over either sky (`&sky=dynamic`), under the clouds, on the
  `?clouds=` tier's march; `?still` holds its curtains.
- The water lab: `water.html?hour=23&aurora=1&hang=-3&yaw=180&pitch=-5&height=6` - the aurora over the sky, in the water
  and in the land's light.
- `tools/auroraProbe.mjs` boots the game in the Bay at night with the clock held, then jumps to Solitude. Run at
  9b9a2c5df1 on the freeware, headless on SwiftShader (a boot of 52 minutes, the jump 24 more): the Bay's north sky's
  mean green 6.43, Solitude's 32.94 north, 74.43 overhead and 23.43 south; no page error. It passes at 3 over the Bay.
  It reads the sky alone, and that run came before the light and the water; the water lab shows those.
- `test/world/skyrimaurora.test.js` pins the law, the place on the traced map (with ARENA2), the sea, the clock, the
  pass, the dome map, the land's light, the water's mirror, the unit, the door and the wiring.
  `tools/mutants/skyrimaurora.json` holds 103 mutants, all dead.

## AUDIT SKYRIM-AURORA (2026-10-29)

The owner: "Audit this and ensure its perfect". Three cold lanes read the frozen 5d47bf2e7a: the law and its door, the
pass, and the records and rules. Fixed: the latitude read on the authored shape, not the traced map; no aurora at sea;
the aurora left in daylight after a rest; the WeatherStyle cutting it before the cloud came; its drawing over the sky's
own decks; a NaN that latched it off; the march's grain; an hourly jump; the east and west aliasing; its cost (a
quarter of it); the horizon's lift; the brass air; its queue place; and the records' wrong claims. Pinned by literal
dials, the traced map, the producer's own door and the mutants.

## AUDIT SKYRIM-AURORA 2: the water and the light (2026-10-29)

The owner: "Audit this". Three cold lanes read the frozen 69915ffbdd. Fixed: the dome map's unit 19 was the snow's far
map's, so where the Snowfall surface drew, the water mirrored the snow's white; the water kept old curtains after a gap and under the
brass air; the light ignored the veil and shone with no pass; the view out took the night's light into the day; the sun
baby's water mirrored the curtains; the zenith's atan(0, 0); a pass pin that no longer held the march's restore; and the
records' cost, bug and haze claims. Pinned by the renderer on a recording GL, the host's frames and the mutants.

## Not carried

- The far ring's sea mirrors no aurora: its own water program reads no dome map. It is seen at a few degrees, where the
  curtains are faint (a third at 3 degrees) but, low in the south, not gone.
- The Sky-Ketch's deck lights by its own moon term (`scenes/ketch/ketchDeckHost.js` ketchMoonNow), its key alone, so the
  aurora over a made level does not light the deck.
- The land reads the light a frame behind the sky, as it reads the moon (world.js reads the moonlight before the sky's
  `use`).
- The view out of a building keeps the street's water as the last frame left it, its mirror with it.
- The aurora casts no key light. The pass's `dispose` is for an owner that tears it down; the sky controller holds it
  for the page's life, as it holds the sky's other passes.
