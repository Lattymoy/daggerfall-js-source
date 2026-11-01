# Windfall

Windfall (demifiend000, version 1.0.0) is a Daggerfall Unity mod we port and ship on by default. It makes the wind
change by the day: most days are calm with occasional gusts, some are windy, and a few bring a windstorm. Trees and
plants sway and shiver with it, leaves blow past in a gust, snow falls off winter boughs, and wind sounds rise and
fall. The law is ported from the assembly; the sounds, pictures and vertex wind are our own, under the mod's names,
rates, frame counts and sizes (the release's record is in `01-Overview/Own-Work.md`). The player meets it outdoors on
the enhanced lane.

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
  and stops. The 27 clips are synthesized from seeded noise (`src/systems/windfall/windfallSynth.js`). None clips and
  none clicks at its ends; a 40 Hz high-pass takes out the gust's DC offset. At the mod's volumes they sit by
  Daggerfall's own wind: a full gust at 0.44 of the 0.5 default reads -23 on `src/audio/synth/dsp.js` `loudnessOf`,
  DAGGER.SND's wind -24 to -29.
- **Pictures:** the leaf sheets and the snow's flake are painted (`src/systems/windfall/windfallPictures.js`).
- **Particles:** gust leaves blow from upwind, ambient leaves drift down, and in winter under a winter set snow comes
  off the boughs. Each is the mod's emitter, drawn on the CPU as one instanced cutout draw (at most 800, 300 and 1800).

### The vertex wind (`src/render/windfallSway.js`)

Our own law, written from the effect's description. The billboard vertex shader leans a quad's two top corners in the
card's own plane, linear in the strength: a wind along the view sways no card, one across it sways one fully, and the
shiver shows either way. The sway's phase rolls over a wood in patches some 80 m long (`WINDFALL_TURNS`), and each
flat's own reach is 0.7 to 1.3 of the lean. It is scaled by the record's wind mask. The mask is the record's response,
none, low (89), medium (166) or full (255) (`windfallResponse`), for the twelve stock nature archives (500 to 511) and
Seasons of the Iliac Bay's seasonal atlases. A batch is one record, so its mask is one number.

## Rules

- On by default and part of the enhanced environments (Mac); the sounds, pictures and vertex wind our own (OWN-WORK,
  the owner).
- Enhanced sky only: the hosts build it under `sky.enhanced`. Under Daggerfall's painted sky the flora stand still.
  The mod's `Enabled` setting and `?windfall=off` (`windfallOn`) stand beside it.
- One law, never two: while Windfall is on, its offset is the flora's sway; otherwise the outdoors' own lean stands
  (`src/render/renderer.js` `windfallLaw`). The Wind row's Sway part still switches all sway off. The shadow and air
  passes replay a record by the law it was drawn with.
- One wind, one way: the heading is the outdoors' own wind (`src/systems/wind/windDrive.js`), with Windfall's wander
  and gust swing about it. The mod's daily heading (a daily roll plus its shipped 35 degrees,
  `WINDFALL_HEADING_OFFSET`) applies only where no wind is handed. `General.WindDirectionDegrees` is retired, since a
  second heading for the trees alone would split them from the rain and the clouds; a saved value is let go on load
  (`src/systems/modSettings.js` `RETIRED_KEYS`).
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
- **Sounds, pictures and the vertex wind:** ours. DFU's particle prefab is not ported.
- **Random:** `UnityEngine.Random` (clips, pitches, particles) is `Math.random`; `System.Random` (gusts) is exact.
- **3D trees:** a Low Poly Trees mesh leans by the mod's law up its height, to match its far picture. In DFU the mod
  patches billboard batches only.

## Code and tests

- `src/systems/windfall.js` - planner, weights, state machine (`createWindfall`, `windfallSettings`, `windfallOn`)
- `src/systems/windfallEffects.js` - sound scheduling, particle flows, the clips' load
- `src/systems/windfall/` - our clips and pictures
- `src/render/windfallSway.js` - the vertex wind chunk, a batch's share, the anchor
- `src/render/windfallParticles.js` - the three particle systems
- `src/scenes/windfallHost.js` - `createWindfallHost`, built by `src/scenes/world.js` and `src/scenes/exterior.js`; ticked
  outdoors and on the indoor branch, its law handed to `renderer.setFlatWind`, carried across the floating origin
- `test/systems/windfall1_model.test.js` - a 30,000-frame scenario whose float trace hashes to the mod's own C#
  compiled under .NET 8
- `test/systems/windfall1_presentation.test.js` - sound, particles, the vertex wind and the hosts' wiring
- `test/systems/ownwork4_windfall.test.js` - our clips, pictures and vertex wind

## Open

- The permission record for the ported law is open (`01-Overview/Own-Work.md`), beside Mac's word.
- `src/scenes/worldModes.js` and `src/scenes/dungeonContext.js` do not wire it: their frames run inside the exterior
  hosts' indoor branch, and no flora stands there.
