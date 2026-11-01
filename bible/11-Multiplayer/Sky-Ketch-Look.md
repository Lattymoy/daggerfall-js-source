# The Sky-Ketch's Look

How the Sky-Ketch looks, sounds and reads: the visual and sound spec for the airship raid (`Sky-Ketch.md`). The
Mzunthar is a brass whale asleep in Daggerfall's sky, and the raid wakes it. Part of the spec is built - the flash law,
the light by the hour, the metal in Daggerfall's palette and the one state law - and the rest is a planned build order.
Nothing here moves a number the relay judges, a collider or a blow's timing.

## How it works

**The flash law.** Nothing aboard blinks faster than `TELEGRAPH_THROB_MAX_HZ` (`src/render/gate/gateTelegraph.js`). The
hold's arc-coils hold one bolt through each strike and change it between strikes (`src/world/ketch/ketchPose.js`
`hazardStrike`, `hazardPhase`). A warned bridge section lurches at `KT_SECTION_LURCH_HZ`. Nothing that moves casts a
shadow: the mast-lift's cage never does, and a ring section casts only whole and still.

**The light by the hour and the zone** (`src/world/ketch/ketchAtmos.js` `KT_HOURS`, `ketchHourLight`). A row an hour for
the open decks (dawn, day, dusk, night) and one a room below decks and in the cabin, walked by the world's daylight. The
ship's night is never darker than the world's outside it. The lamps are a mesh of their own that casts nothing, so each
lamp lights its deck (`src/world/ketch/ketchModel.js` `buildKetchShip`). `KT_LADDER` (`src/world/ketch/ketchLook.js`)
holds the display luma of each value rung.

**The metal** (`KT_PAL`). Every texel of every record is a step of the ship's ramps - Dwarven brass, rubbed, glint,
burnished, rust, copper, verdigris, Dwemer steel and stone, aether, ember, lamp, gilt, cloud, the land - and carries an
index beside its colour (`src/world/superDungeon/sdPixelKit.js` `quantizeIndexed`). At upload the art resolves through the
player's own palette (`src/world/ketch/ketchArt.js` `resolveKetchArt`), so the ship is Daggerfall's index space; without
the player's data it draws in the port's fallback colours.

**One state law** (`src/world/ketch/ketchStates.js` `ketchStatesOf`). One kept record a frame of everything the eye, the
ear and the HUD read: the ship's three states, the cradles and sockets, each loose cell's time left, the engine's
appetite and waking, the lift, every hazard's wind-up, the spiders' next pour, the Watch's wave, the ring's sections,
the resonators, the Discord and the song. `KT_PVS` culls each deck zone to its view's groups. The gauges are one pass
(`src/render/ketch/ktGaugePass.js`).

**The three states.**

| State | When | The ship shows |
|---|---|---|
| Asleep | on a crew's ship until the engine is fed; in the world while it keeps station | dark brass, vanes feathered, slow breaths of steam, the hold's lamps low |
| Awake | from the engine's waking until the Warden wakes, and after its fall; in the world as it weighs anchor | vanes biting, shutters open, every lamp full |
| Singing | while the Tonal Warden's fight lives | the bridge's pipe-forks and the Warden's crown in their state |

## Rules

- A polish to surpass the Abyss Dungeon's (the owner).
- The laws of the Hour's and the Spire's looks hold: structure does not glow, light appears only where it means
  something, every surface reads as Daggerfall pixel art, and the telegraphs keep their pinned shapes, colours and grains.
- The ride up takes about 3 s, the cloud inside the step's veil; no 12 s ride through the world (the owner).
- The ship's music plays outdoors only near its lift while it keeps station and as it leaves; elsewhere the region's
  music (the owner).
- Its shadow falls softly over Daggerfall's east quarter by the world's own cloud-shadow law (the owner).
- The Warden's sprite sheets are baked by a deterministic tool and committed, gated byte for byte; nothing is baked on a
  player's machine (the owner).
- No relay version moves for the look: the relay's bundled Ketch files do not change.
- The herald's portrait or fall card, and a read of the way out over the Gallery's hazards, are off unless the owner
  turns them on.

## Daggerfall Unity

DFU has no airship. The palette law is Daggerfall's own: the art resolves through the player's ART_PAL.

## Code and tests

- `src/world/ketch/ketchPose.js` - strikes and lurches under the flash law
- `src/world/ketch/ketchAtmos.js`, `src/world/ketch/ketchLook.js` - light, ladder, palette
- `src/world/ketch/ketchArt.js` - the art resolved through the player's palette
- `src/world/ketch/ketchStates.js` - the state law and the deck zones' culling
- `src/render/ketch/ktGaugePass.js` - the gauges
- `test/world/ketch/ketch_atmos.test.js`, `test/world/ketch/kt_look_palette.test.js`, `test/world/ketch/ketch_states.test.js`,
  `test/render/ketch/kt_gauge_pass.test.js`, `test/scenes/ketch_deck_host.test.js`, `test/world/ketch/ketch_lab.test.js`
- `ketch.html` - the lab: every view at any hour

## Open

Planned and not built, in build order:

- the score (the keel's chord, clock-locked songs);
- the lifting-body hull, ornament and moving vanes;
- the open decks' furniture and boards;
- below decks: merged hammers, shaft, steam and arc passes;
- the cells' chargers and the engine waking;
- the ship's sounds and reverb;
- the mast-lift, the bridge's glow and resonators, the Sailwalk's dress;
- the land below, clouds, motes and weather;
- the Warden's baked sheets (it draws with interim darks until then), its state, the constructs' looks;
- the voices and blows seen, the HUD as an instrument panel;
- its presence in the world, the 3 s ride up and arrival, the cabin and the reward.
