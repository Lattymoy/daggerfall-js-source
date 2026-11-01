# Immersive Footsteps

Kirk.O's Immersive Footsteps 1.01 for Daggerfall Unity (Nexus mod 706, MIT), ported: footstep sounds that change with
the ground underfoot, and armour sway sounds by what the player wears. The player hears it on every step; it is a Mod
Authored row on the Features home, on by default, with its ten keys on the Mods page. Its data (manifest, settings, the
two C# sources and 210 clips) is vendored under `vendor/immersive-footsteps/`.

## How it works

**The source.** The mod's sources are published, so the port reads the C#, not the IL, and every function in
`src/systems/immersiveFootsteps.js` names the method and lines it restates. The clips are the repository's MP3s,
checked name for name against the manifest. The tile and archive tables are parsed out of the vendored `.cs` by the
pins rather than retyped.

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
`PlayerFootsteps`, `PlayerEnterExit` transitions and `UIManager.OnWindowChange`. Not ported: the Tempered Interiors
warning and the once-a-session exception log.

## Code and tests

- `src/systems/immersiveFootsteps.js` - the whole mod, driven by the four stride hosts
- `test/systems/if1_immersivefootsteps.test.js` - the laws against the vendored C#
- `test/systems/deckfield.test.js` - decks and bridges

## Open

- The mod's Travel Options accelerated-travel check answers false; Travel Options is in the game, but the check is not
  wired to it.
- Not heard in a browser: the suite runs under Node with a recording audio engine.
