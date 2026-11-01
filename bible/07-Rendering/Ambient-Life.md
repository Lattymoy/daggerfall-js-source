# Ambient Life

Ambient life is the open world's small creatures: lone birds, flocks that form and wheel, birds perched on roofs that
fly off as the player comes near, soaring hawks and gulls, bats at dusk, rats, lizards, squirrels and crabs that dart
away, and butterflies by day and fireflies at night. DFU draws no wild birds or small animals, so this is our own
system. The player meets it outdoors on the enhanced lane, in every province.

## How it works

- **Lone birds** cross 8 to 28 m up (higher in a town). Small birds bound, big ones flap and glide; they climb over
  rising ground and turn back from a cliff too steep to clear, and now and then land on a roof.
- **Roof birds** sit on ridges and peaks. A bird flushes when the player comes within its kind's distance (a pigeon
  8 m, a crow 14 m), and its neighbours within 6 m follow. A bird whose perch has gone (a ship sailed) flies.
- **Flocks** gather from scattered birds, wheel round a wandering anchor, may land to feed on open dry ground, and burst
  up when the player comes within 16 m. A flock holds 26 birds at most.
- **Soarers** circle high (hawks and vultures 45 to 95 m up, gulls lower) and follow the player; **bats** hunt from the
  hour before dusk.
- **Runners** sit, dart and bolt. None stands on water, under a roof or on a steep slope.
- A flushed bird flies on to 85 m (`AL_REACH`); every creature fades over the last 15 m (`AL_EDGE`).
- Perches are found by looking: a ray down onto a building's box or the ground nearby, walked up to the ridge. Any
  town, ruin or wall anywhere has perches; there is no list of the Bay's buildings.

### Who, where and when

`src/systems/ambientLife/ambientCast.js` `ambientCast` picks the cast from climate, weather, hour, season, town and
coast. Each of the ten climates has a palette: woods have starlings, sparrows, pigeons, hawks and squirrels; deserts
vultures and lizards and no flock; mountains crows and hawks; rainforest parrots; swamps crows, rats and the most
fireflies; haunted woods crows, rats and more bats; the sea gulls and crabs. A town (three tall building boxes within
85 m) adds roof birds and rats at night. Rain, storm, sandstorm and ashfall ground the fliers and runners; snow thins
the birds and stops bats, runners and butterflies; winter takes the insects; at night roof birds roost and let the
player come closer.

Every province reads its own climate through the same palettes (`src/world/tamriel/tamrielBiomes.js` `BIOMES` zones), so
Skyrim's mountains have crows and hawks and Black Marsh its swamp.

### The hosts and the draw

`src/scenes/ambientLifeHost.js` `createAmbientLifeHost` is built by `src/scenes/world.js` and `src/scenes/exterior.js` on
the enhanced lane. The host lends the world through `AmbientWorld` (ground, water, roof rays, building boxes), steps it
on game seconds each outdoor frame, and moves it with the floating origin. A move of more than 150 m between outdoor
frames (`AL_JUMP_M`) starts it afresh. Interiors, made levels and dungeons build none.

`src/render/ambientLifePass.js` draws each creature as 13 triangles built in the vertex stage from its kind's measures
(`AL_KINDS`): beating wings that fold and glide, legs that step in diagonal pairs. No picture and no ARENA2 art is
loaded. Fireflies are a second, additive draw of glowing points. The bodies are lit and fogged as the flats are.

## Rules

- When the birds fly follows DFU's ear: the host hands the cast the word DFU's ambience preset reads. Departure: a
  sandstorm or ashfall sounds like a cloudy day but grounds the creatures (`wildlifeWord`).
- Cost: two instanced draws, at most 320 instances (`AL_MAX_INSTANCES`). Perch finding costs at most 29 rays a frame
  and slows to twice a second once nearby roofs stop yielding perches. The program compiles through `compiledPass` at
  the first frame with a creature to draw.
- The switch is the **Wildlife** row (Settings, Graphics, Plants, wind & wildlife), pref `ambientLife`, on by default
  and each player's own online. `?wildlife=off` is the kill door; `?wildlife=0.5` (0 to 2) sets the density.

## Daggerfall Unity

DFU's `AmbientEffectsPlayer` plays bird calls under the SunnyDay preset and crickets under ClearNight
(`WeatherManager.SetAmbientEffects`, ported as `src/systems/ambientEffects.js` `presetForExterior`). DFU has no visible
wildlife; the creatures are our addition, timed to its ear. SunnyDay still plays bird calls in snow and fog, where
fewer birds fly.

## Code and tests

- `src/systems/ambientLife/ambientLife.js` - the sim (`AL_JUMP_M`, `AL_FAST`, `scare`)
- `src/systems/ambientLife/ambientFlight.js`, `ambientGround.js`, `ambientBody.js` - fliers, runners and insects, the
  instance writer
- `src/systems/ambientLife/ambientCast.js` - kinds, palettes, flock sizes
- `src/scenes/ambientLifeHost.js` - the host half, `wildlifeDensity`, `wildlifeWord`
- `src/render/ambientLifePass.js` - the draw
- `test/systems/ambientLife/ambientcast.test.js` - the cast in each weather, DFU's presets, every province's zones
- `test/systems/ambientLife/ambientlife_sim.test.js` - perches, flushes, runners, flocks, the floating origin, rays a frame
- `test/systems/ambientLife/ambientlife_audit.test.js` - the audit's findings
- `test/render/ambientlifepass.test.js` - the vertex stage in JS and the draws
- `test/scenes/ambientlifehost.test.js` - the switch, the lane and the hosts' wiring
- `tools/wildlifeProbe.mjs` - boots in Daggerfall and jumps to Solitude, or benches the fixed city

## Open

- Blows and spells do not startle the creatures: `scare(at, radius)` exists but no host calls it. Until it does,
  running (6.6 m/s and up, `AL_FAST`) widens every flush distance by 1.6.
- Trees stand no collider, so no bird perches in one.
