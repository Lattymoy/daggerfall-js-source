# Immersive Footsteps

Kirk.O's Immersive Footsteps 1.01 for Daggerfall Unity (MIT), ported: footstep sounds that change with the ground
underfoot, and armour sway sounds by what the player wears. The player hears it on every step; it is a Mod Authored
row on the Features home, on by default, with its ten keys on the Mods page. Every clip is our own; the release's
record is in `01-Overview/Own-Work.md`.

## How it works

**The source.** The mod's sources are published, so the port reads the C#, not the IL, and every function in
`src/systems/immersiveFootsteps.js` names the method and lines it restates. The tile and archive tables are held by
the pins as literals.

**Our clips** (`src/audio/synth/steps.js`). Each of the 105 names the mod's LoadAudio asks for, in each quality, is a
clip our synth makes at runtime at its clip's length: High at 44.1 kHz, Low (Retro) at 22.05 kHz and 8 bits. Each set
is a family of its own - a struck body for path, tile and wood, a crowd of grains for grass, gravel, sand and snow, a
slap and bubbles for mud and water, rings and a plate's modes for armour - drawn from the name's seed, so six steps
are six.

Each clip is set by its loudness (`src/audio/synth/dsp.js` `loudnessOf`, K-weighted over its loudest 100
ms), not its peak: a step at -32, the top of Daggerfall's own stride heard at 0.7; a sway at -38; a landing at -33 and
a hurt one at -28 before the mod's 4. A hard floor's heel knock stands over its thud, as Daggerfall's own steps do.

**Taking over the stride.** The mod mutes DFU's own footsteps. The hosts keep the classic `FootstepMachine` running
for its water latch and landing state, and ask `ownsStride()` before playing what it returns. The mod owns nothing
until its clips are decoded; a missing clip leaves the classic stride playing, as DFU does when the mod's audio fails
to load.

**The clocks.** The mod's fixed step runs at 0.02 s under an accumulator in whole ticks. Walking adds to every clock;
running speeds the step 1.5 times and the sways 1.8 times, louder; under half speed slower and quieter. Horse and cart
zero the step clock. Standing still or airborne holds the clocks.

**What the ground sounds like.**
- **Outdoors**: by tile, climate and season, re-read only when one changes. Deep water, shallow water, paths (by armour),
  snow in winter on snowy climates, and four climate ladders: grassy, rocky, sandy and swampy.
- **On a deck or a bridge**: the floor under the feet decides before the tile. A boat's or ship's hull is a wooden deck
  (by boots: plate, chain, else boards); any other model over water is walked on by armour.
- **Indoors**: the building's first floor texture in the wood, stone or tile tables decides, then the boots.
- **In a dungeon with water**: swimming is deep water, shallow below a measured height, else by armour.
- **Swimming** plays a splash every 1.75 units moved.
- **Armour**: iron and up is plate, chain is chain, else leather; no boots is unarmoured.

**Armour sway.** Head 2, arms 1 each, chest 3, gloves 1, legs 4, summed per material family; each family's clock plays
one of its four clips when it runs out. The worn slots are re-read every five seconds and when the inventory closes;
the first five seconds of a game are unarmoured, as in DFU.

**Landings.** A hard fall plays its family's hard landing; a large splash its water landing.

**Better Ambience.** When Better Ambience is on, the mod's compatibility warning posts at game start and load, gated by
its own setting (`06-Systems/Better-Ambience.md`).

## Rules

- **Ported 1:1** (Mac).
- **Decks sound like decks** (Mac): a departure from the mod, which keeps a known bug where a ship's deck over the sea
  plays deep water.
- **Kept as written**, each pinned: the leather re-roll that writes all three sway intervals into the leather clock;
  the alternate step tables that are never used; the swim splash not gated by the footstep switch.
- The master sound bus already applies the sound volume, so the mod's own multiply is not repeated.
- The Come Sail Away helm's footsteps-off silences the mod's stride too.

## Daggerfall Unity

The mod's two MonoBehaviours are `ImmersiveFootstepsMain` and `ImmersiveFootstepsObject`, over DFU's
`PlayerFootsteps`, `PlayerEnterExit` transitions and `UIManager.OnWindowChange`. The two logging keys log a caught
error to the console, as the mod's `LogModException` does. Not ported: the Tempered Interiors warning. Departure: the
clips are ours.

## Code and tests

- `src/systems/immersiveFootsteps.js` - the whole mod, driven by the four stride hosts
- `src/audio/synth/steps.js` - our clips
- `test/systems/if1_immersivefootsteps.test.js` - the laws, the settings and the tables as literals
- `test/audio/synth/ownsounds.test.js` - the clips
- `test/systems/deckfield.test.js` - decks and bridges

## Open

- The mod's Travel Options accelerated-travel check answers false; Travel Options is in the game, but the check is not
  wired to it.
- Not heard in a browser: the suite runs under Node with a recording audio engine.
