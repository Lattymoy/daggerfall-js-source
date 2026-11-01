# Better Ambience

A 1:1 port of Joshua Steinhauer's (joshcamas) Better Ambience 0.1.4 for Daggerfall Unity (Nexus 139, MIT): better
footsteps, camera shake on damage, dungeon fog and lighting, dungeon reverb, and rain heard indoors. The player meets it
as footsteps by ground and armour, the screen shaking when hit, coloured fog and an echo in dungeons, and muffled rain
inside. It is on by default; its twenty keys are under its card on the Mods page. Its sixteen C# sources ship inside the
bundle and are vendored in `vendor/better-ambience/` with the manifest, settings, licence and the 29 WAV clips.

## How it works

`src/systems/betterAmbience.js` is one component for every host. `src/systems/reverbPresets.js` holds Unity's three
reverb presets and builds an impulse from each. The engine takes three seams for it: the audio bus takes a reverb zone
and its loops a low-pass, the mesh program takes a trilight ambient, and the damage flash's edge carries its amount.

- **Better Footsteps.** The player's stride plays a sound list per ground (wood, stone, grass, water, splash, snow),
  each rolling a clip and a pitch, chosen by season, climate, inside or out, water, path and geometry. An armour clank
  plays when the chest or legs are worn and not leather. Kept verbatim: the mod's `DisableBuiltInFootsteps` nulls two
  clips twice, so the classic second step still plays on stone and outdoors.
- **Camera Shake** (EZ Camera Shake). The damage edge shakes the view by the amount over max health, within the
  settings' bounds, on Perlin noise with fade-in and fade-out. The shake is folded into the view matrix at each host.
- **Dungeon Fog and Lighting.** Four frames after a start, a load or a dungeon transition, a dungeon that is not a castle
  rolls its fog colour from its name (`System.Random` over Mono's string hash), with linear fog. With the fog ambient
  effect on, the dungeon's flat ambient becomes a trilight tinted toward the fog.
- **Reverb.** A dungeon's reverb zone is a convolver off the master gain, with the impulse built from the preset's
  numbers.
- **Indoor rain.** In a building (2D) or at a dungeon's entrance (3D), a low-passed rain loop plays while it rains or
  storms outside.

## Rules

- Ported 1:1 (Mac), compatible with Immersive Footsteps (Mac).
- `Better Footsteps.enable` ships off: Immersive Footsteps' author says a player should not run both strides. If a
  player turns both on, they get Immersive Footsteps' own warning (`modCompatibilityChecking` in
  `src/systems/immersiveFootsteps.js`). The classic stride has one gate, `classicFootstepAllowed`.
- `Dungeon Lighting.enableFogAmbientEffect` ships off, so dungeons keep their classic dark (Mac). Fog and reverb ship
  on.
- Every other key ships at the mod's value.

## Daggerfall Unity

The mod's modules (`BetterFootstepsMod`, `CameraShaker`, `DamageShaker`, `FoggyDungeonsMod`, `BetterRainMod`,
`InteriorAmbientSoundSource`) are restated in `betterAmbience.js`. No twin: the rain and snow particle retune (the port
has no Unity particle system; its two switches are inert), the NPC and enemy footstep components (dead in the mod), and
Travel Options' accelerated-travel check. Recorded stand-ins: the port's Perlin noise for `Mathf.PerlinNoise`, the
synthesised reverb tail for FMOD's.

## Code and tests

- `src/systems/betterAmbience.js` - the component
- `src/systems/reverbPresets.js` - reverb presets and impulses
- `vendor/better-ambience/` - the mod's sources, settings and clips
- `test/systems/ba1_betterambience.test.js` - footsteps, shake, fog, reverb, rain, the two shipped-off keys

## Open

- Not heard or seen on a GPU: the reverb, low-pass, trilight and view fold are pinned as arithmetic and wiring.
