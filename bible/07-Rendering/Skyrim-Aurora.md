# Skyrim's aurora (SKYRIM-AURORA, 2026-10-29)

The owner, 2026-10-29: "let's develop an aurora for the skyrim sky then. This is the reference". The reference is a
painted night over a snowy, wooded hill: green curtains with teal hems and bright cores, a blue glow about them, a navy
sky with stars. It is the owner's picture and is not in the tree.

DFU's sky has no aurora, so this is the port's own (Port-Ledger A, SKYRIM-AURORA). TES V's Skyrim shows one on clear
nights, and that is the lore it follows.

## What it is

- **The law** (`world/tamriel/skyrimAurora.js`). Pure. `auroraTarget` answers a weight 0..1 and `hang`, how far north of
  the eye the arcs stand. The weight is the latitude's strength, times the dark, times the clear sky, times the night's
  own strength.
- **The pass** (`render/auroraPass.js`). One triangle at the far plane. Its light is added to the sky (one, one), so the
  stars and the moons show through it, and the buffer's alpha is untouched.
- **The door** (`scenes/auroraHost.js`). Built by the sky controller (`scenes/shared.js` createSkyController) on the
  enhanced lane. It reads the player's pixel, eases the weight over real seconds and draws the pass.

## Where: Skyrim alone (the Tamriel-wide record)

The weight is 0 unless `theatreAt` says the player's pixel is Skyrim's theatre. In Skyrim it is 0.6 of its strength at
the south edge (picture row 78) and all of it on the north coast (row 22), from `bayToPicture`. The arcs hang 3.2 hem
heights north of the eye in the south, so they stand low over the north horizon, and 0.4 on the coast, nearly overhead.

The rest of Tamriel has none, the Bay included. The owner asked for Skyrim's sky, and Skyrim is the province the lore
gives an aurora. A province that wants one later reads the same law with its own row bounds. The pins hold Skyrim's
north coast and pinewoods beside Daggerfall, Morrowind, High Rock and Cyrodiil.

## When

- **The dark.** By the sun's elevation on worldClock's arc, continued under the horizon: none above -6 degrees, whole
  below -16. That is 18:24 to 19:04 in the evening and 04:56 to 05:36 in the morning.
- **The sky.** The sky controller's eased cloud cover (`enhancedSky.js` WEATHER_SKY). A cloudy night (0.55) keeps it
  whole, and the volumetric clouds draw over it where they are. It fades from 0.6 and is gone at 0.9, so an overcast
  night hides it. A weather that puts the night sky out (DaggerfallSky.cs:363-367's WeatherStyle) puts it out.
- **The night.** An evening and the morning after are one night (`auroraNight` changes at noon). Each night rolls a
  tier: quiet (a fifth of the nights, 0.3 to 0.5), common (0.55, 0.6 to 0.85) or strong (a quarter, 0.9 to 1). A slow
  swell moves it by up to a fifth over 150 game minutes. The rolls read the sky's own clock, so a room online sees one
  sky.

The door eases the weight with a 6-second time constant, so a border, a deck of cloud or a fast travel fades it. Its
first frame takes the law's weight whole.

## How it looks

Three arcs run east-west, 1.3 hem heights apart, each waved by three sines. Each ray from the eye is marched 12 steps up
through them, from a hem that rises and falls to 1.5 hem heights above it. A curtain overhead then fans to the zenith,
and a far one stands low in the north. Each arc is a thin sheet cut by moving rays, with a wide blue glow about it. The
hem is green (0.25, 1, 0.55) and the crown teal-blue (0.1, 0.6, 0.9).

The light rolls off softly toward 0.95, so a corona overhead never clips flat. The step offset is jittered per pixel,
and a 1/255 dither keeps the dark sky free of bands. A ray that passes every arc's reach skips the march. The program is
started at the boot's idle (`render/playPrograms.js`), so the first night in Skyrim waits on no compile.

## The four hosts (Home.md)

`scenes/world.js` WIRED, through the sky controller alone: the place is the world host's own door
(`characters/provinceFolk.js` setFolkPlace, read by `pixelHere`), so bootWorld grows by nothing. `scenes/exterior.js`
builds the same controller, but the fixed-city bench sets no place door and stands the Bay's towns, so it draws none.
`scenes/worldModes.js` and `scenes/dungeonContext.js` draw no sky. A made level that draws the street's sky (the
Sky-Ketch's decks, the Arena's floor) takes the aurora of the place the player stands.

The classic lane keeps Daggerfall's painted sky, untouched: the controller builds no aurora there.

## Doors and gates

- `?aurora=off` builds nothing. `?aurora=on` or a number 0..1 stands it at that weight anywhere, at any hour.
- The sky lab: `sky.html?hour=23&aurora=1&hang=1.5` draws it over either sky (`&sky=dynamic`), under the clouds.
- `tools/auroraProbe.mjs` boots the game in the Bay at night, then jumps to Solitude. It holds Skyrim's north sky
  greener than the Bay's.
- `test/world/skyrimaurora.test.js` pins the law, the pass, the door and the wiring. `tools/mutants/skyrimaurora.json`
  holds 23 mutants, all dead.

## Not carried

The water does not mirror it, and it does not light the ground. Its cost has no quality knob of its own: `?aurora=off`
is the way out.
