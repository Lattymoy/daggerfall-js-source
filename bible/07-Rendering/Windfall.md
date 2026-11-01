# Windfall

Windfall (demifiend000, version 1.0.0, Nexus 1396) is a Daggerfall Unity mod we port and ship on by default. It makes
the wind change by the day: most days are calm with occasional gusts, some are windy, and a few bring a windstorm.
Trees and plants sway and shiver with it, leaves blow past in a gust, snow falls off winter boughs, and wind sounds rise
and fall. The player meets it outdoors on the enhanced lane.

## How it works

### The model (`src/systems/windfall.js`)

Every frame, outdoors and in, as `WindMod.Update` runs wherever the player is:

- **The day's context** is a stable hash of the date, the map pixel / 8 and the climate (FNV-1a with a 13-bit
  xorshift). A new key rebuilds the day: its gusts (`System.Random(key & 0x7FFFFFFF)`, our `NetRandom`), the natural
  plan and the heading.
- **The natural event** rolls once a day: a windy period (3 to 6 h) or, one day in 12.5, a windstorm (1 to 3 h). The
  chance is the season's (Fall 0.16, Spring 0.11, Summer 0.07, Winter 0.18) times the geography's, capped at 0.35, times
  the frequency settings and a cooldown after an event (`effectiveChance`, `cooldownMultiplier`).
- **The presentation state** is storm under Thunder or a windstorm, windy under a windy period, else normal.
- **Gusts** are scheduled by the state: each is a smoothstep rise, a hold and a fall, with length, peak and heading
  swing set by the state. A windy or stormy gust sometimes pairs with another. Indoors the gust eases out.
- **The profile** (strength, sway and shiver) is Normal's, Windy Day's or Storm's, lerped toward Gust's by the gust.

### The presentation (`src/systems/windfallEffects.js`, `src/render/windfallParticles.js`)

- **Sound:** a windy or stormy day plays intermittent wind passages; a gust plays a gust clip; the canopy ruffles where
  there are leaves (not in snow or under a winter set). A clip is never the one before it. Indoors every source fades
  and stops. The clips are the bundle's FSB5 Vorbis, remuxed losslessly to Ogg by `tools/environmentModsExtract.mjs`,
  fetched when the sound is first wanted.
- **Particles:** gust leaves blow from upwind, ambient leaves drift down, and in winter under a winter set snow comes
  off the boughs. Each is the mod's emitter, drawn on the CPU as one instanced cutout draw (at most 800, 300 and 1800).

### The vertex wind (`src/render/windfallSway.js`)

The billboard vertex shader adds one offset to a quad's two top corners, mostly across the view, scaled by the
profile's strength and the record's wind mask. The mask is the record's response, none, low (89), medium (166) or full
(255) (`windfallResponse`), for the twelve stock nature archives (500 to 511) and Seasons of the Iliac Bay's seasonal
atlases. A batch is one record, so its mask is one number.

## Rules

- On by default and part of the enhanced environments, shipped on Mac's word of permission (Mac).
- Enhanced sky only: the hosts build it under `sky.enhanced`. Under Daggerfall's painted sky the flora stand still.
  The mod's `Enabled` setting and `?windfall=off` (`windfallOn`) stand beside it.
- One law, never two: while Windfall is on, its offset is the flora's sway; otherwise the outdoors' own lean stands
  (`src/render/renderer.js` `windfallLaw`). The Wind row's Sway part still switches all sway off. The shadow and air
  passes replay a record by the law it was drawn with.
- One wind, one way: the heading is the outdoors' own wind (`src/systems/wind/windDrive.js`), with Windfall's wander
  and gust swing about it. The mod's daily heading applies only where no wind is handed.
- The steady wind bed (Enhanced sounds) and the mod's intermittent clips are two layers; the mod's sound has its own
  switches.
- The sandstorm is a storm here, as Thunder is.
- The day is the sky's (`skyMinutes()`); the frame runs on game seconds, held by a pause and scaled with world time.
- Online it is the player's own (`src/systems/online/onlineLane.js` `ONLINE_PLAYERS_OWN_MODS`).

## Daggerfall Unity

Windfall is one `.dfmod`: `Windfall.dll` (`WindMod`, `WindNaturalPlanner`, `WindRecordWeights`,
`WindEnvironmentEffects` and bookkeeping types), the shaders `Windfall/BillboardBatch` and `Windfall/Particles`, three
textures and 27 clips. The planner, the weight tables and the state machine are ported whole in single precision.
Departures:

- **Heading:** the outdoors' wind, so trees, leaves, wisps and rain agree.
- **Per-flat hashes:** the mod hashes world position with `fract(sin(...))`, which jumps at DFU's recentre. Ours are
  sums of sines of the flat's place on the land, whole turns over the anchor's 49,152 m wrap
  (`WINDFALL_ANCHOR_PERIOD`), so a flat sways the same across a floating-origin move. The 12 m cell hash is the mod's.
- **Noise module:** Unity's particle noise is replaced by three smooth sine channels at the module's frequency.
- **Particle light:** the flats' light at the player. The mod's pass takes the sun's directional light alone, so its
  leaves go black looking toward the sun and at night.
- **Snow picture:** the mod's own flake; DFU's particle prefab is not ported.
- **Random:** `UnityEngine.Random` (clips, pitches, particles) is `Math.random`; `System.Random` (gusts) is exact.
- **3D trees:** a Low Poly Trees mesh leans by the mod's law up its height, to match its far picture. In DFU the mod
  patches billboard batches only.

## Code and tests

- `src/systems/windfall.js` - planner, weights, state machine (`createWindfall`, `windfallSettings`, `windfallOn`)
- `src/systems/windfallEffects.js` - sound scheduling, particle flows, the clips' load
- `src/render/windfallSway.js` - the vertex wind chunk, a batch's share, the anchor
- `src/render/windfallParticles.js` - the three particle systems
- `src/scenes/windfallHost.js` - `createWindfallHost`, built by `src/scenes/world.js` and `src/scenes/exterior.js`; ticked
  outdoors and on the indoor branch, its law handed to `renderer.setFlatWind`, carried across the floating origin
- `test/systems/windfall1_model.test.js` - a 30,000-frame scenario whose float trace hashes to the mod's own C#
  compiled under .NET 8
- `test/systems/windfall1_presentation.test.js` - sound, particles, the vertex wind and the hosts' wiring

## Open

- `vendor/windfall/` waits for the author's own permission line beside Mac's word.
- `src/scenes/worldModes.js` and `src/scenes/dungeonContext.js` do not wire it: their frames run inside the exterior
  hosts' indoor branch, and no flora stands there.
