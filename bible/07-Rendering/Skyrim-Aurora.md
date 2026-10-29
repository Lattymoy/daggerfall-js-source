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
  too, as the mod's presets switch on it. The port's dome reads no WeatherStyle, and its cover walks on the front.
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
1.5 at most. The light rolls off toward 0.95, so a corona overhead never clips flat, and a 1/255 dither keeps the dark
sky free of bands. A ray that passes every arc's reach skips the march. A Hollow's brass air dims it.

## Its clock

The curtains walk on the sky's walk clock (`classicMinutes`, the event clock online), a game minute five of its
seconds. So a room online sees the same curtains and the same night. A pause stops them and a rest speeds them, as it
speeds the clouds. The phases are wrapped in double precision on the CPU, and the rays' noise rows repeat every 256, so
the curtains never jump. The first version ran on each machine's own clock and jumped every real hour.

## Its cost

The quality tier is the clouds' (`render/volumetricClouds.js` QUALITY): `lo` 6 steps into a half-size map, `default`
10 into a half-size map, `hi` 12 into a three-quarter map. Measured on SwiftShader at 400 x 240, a whole-sky view north,
the median of seven: the dome 21.1 ms, the first version's full-size march 48.1, `lo` 9.7, `default` 11.5. `hi` measured
about 2.1 times the dome in a run beside other work. `?aurora=off` is the way out.

## The four hosts (Home.md)

`scenes/world.js` WIRED, through the sky controller alone: the place is the world host's own door
(`characters/provinceFolk.js` setFolkPlace, read by `pixelHere`), so bootWorld grows by nothing. `scenes/exterior.js`
builds the same controller but sets no place door, so it draws none (the door aside). `scenes/worldModes.js` draws the
street's sky only on a made level (the Arena's floor, the Sky-Ketch's decks, through `host.drawSky`): the controller's
`retime` runs the aurora at `playerTravelPixel`'s dungeon pixel. `scenes/dungeonContext.js` draws no sky.

The classic lane keeps Daggerfall's painted sky, untouched: the controller builds no aurora there.

## Its compile

Where the driver compiles beside the frames (KHR_parallel_shader_compile), its two programs are started at the boot's
idle (`render/playPrograms.js`), last in the queue: they are met only under Skyrim's night sky, and the door never
waits, so a late one fades in. Elsewhere the first frame that wants it builds it, as every pass's does.

## Doors and gates

- `?aurora=off` builds nothing. `?aurora=on` or a number 0..1 stands it at that weight anywhere, at any hour.
- The sky lab: `sky.html?hour=23&aurora=1&hang=1.5` draws it over either sky (`&sky=dynamic`), under the clouds, on the
  `?clouds=` tier's march; `?still` holds its curtains.
- `tools/auroraProbe.mjs` boots the game in the Bay at night with the clock held, then jumps to Solitude. Not yet run to
  completion.
- `test/world/skyrimaurora.test.js` pins the law, the place on the traced map (with ARENA2), the sea, the clock, the
  pass, the door and the wiring. `tools/mutants/skyrimaurora.json` holds 65 mutants, all dead.

## AUDIT SKYRIM-AURORA (2026-10-29)

The owner: "Audit this and ensure its perfect". Three cold lanes read the frozen 5d47bf2e7a: the law and its door, the
pass, and the records and rules. Fixed: the latitude read on the authored shape, not the traced map; no aurora at sea;
the aurora left in daylight after a rest; the WeatherStyle cutting it before the cloud came; its drawing over the sky's
own decks; a NaN that latched it off; the march's grain; an hourly jump; the east and west aliasing; its cost (a
quarter of it); the horizon's lift; the brass air; its queue place; and the records' wrong claims. Pinned by literal
dials, the traced map, the producer's own door and the mutants.

## Not carried

The water does not mirror it, and it does not light the ground. The pass's `dispose` is for an owner that tears it
down; the sky controller holds it for the page's life, as it holds the sky's other passes.
