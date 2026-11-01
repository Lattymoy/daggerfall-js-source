# Better Ambience

A 1:1 port of Joshua Steinhauer's (joshcamas) Better Ambience 0.1.4 for Daggerfall Unity (MIT): better footsteps, camera
shake on damage, dungeon fog and lighting, dungeon reverb, rain heard indoors, and a better fall of rain and snow. The
player meets it as footsteps by ground and armour, the screen shaking when hit, coloured fog and an echo in dungeons,
and muffled rain inside. It is on by default; its twenty keys are under its card on the Mods page. Our code restates the
mod's sixteen C# sources; every clip is our own (`src/audio/synth/`), and the release's record is in
`01-Overview/Own-Work.md`.

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
- **The clips** are made by our synth at runtime (`src/audio/synth/`), at the mod's names, lengths and rates: the
  boards, the dungeon's flags, the light armour's clank, the dry grass, the wade, and the indoor rain - a hiss, a
  roof's low body, single drops and an eave's drip, mono at 22.05 kHz, looping without a seam. Each is set by its
  loudness (`src/audio/synth/dsp.js` `loudnessOf`), so its list plays it at -33 (the boards, the flags, the grass), -30
  (the water) and -38 (the clank, under its step), within 1.5 dB from its seed. The boards and the flags carry a knock
  over their thud, as Daggerfall's own do. The rain's eave drips loop on their own 41 s beside the bed's 29.5
  (`src/audio/synth/rain.js` `RAIN_EAVES`, `src/audio/layeredLoop.js`), so the two come round together only after
  2,473 hours.
- **Better Rain.** The mod's two keys pick our own fall on the enhanced lane, under the mod's own switch
  (`src/render/precipitation.js` `BETTER_FALL`). A drop falls faster as it is bigger, and its streak is a frame and a
  half of its travel along its own velocity, so the wind slants and lengthens it. A storm's drops fall 15% faster, and
  the storm draws 26,000 to the rain's 20,800. A flake falls at 0.55 to 0.85 of the lab's pace, is carried by the
  wind, flutters on two beats of its own, and is a soft disc, most small and a few clumps. Off, the lab's program draws
  as before.

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
`InteriorAmbientSoundSource`) are restated in `betterAmbience.js`. The rain and snow retune is our own fall, since the
game has no Unity particle system; no splash rings are drawn, as the fall's volume does not know where the ground is. No
twin: the NPC and enemy footstep components (dead in the mod), and Travel Options' accelerated-travel check. Recorded
stand-ins: the port's Perlin noise for `Mathf.PerlinNoise`, the synthesised reverb tail for FMOD's.

## Code and tests

- `src/systems/betterAmbience.js` - the component
- `src/systems/reverbPresets.js` - reverb presets and impulses
- `src/audio/synth/` - our clips; `src/render/precipitation.js` - our fall
- `test/systems/ba1_betterambience.test.js` - footsteps, shake, fog, reverb, rain, the two shipped-off keys, the shipped
  settings as literals
- `test/audio/synth/ownsounds.test.js` - the clips; `test/systems/rainleak.test.js` - the fall

## Open

- Not heard or seen on a GPU: the reverb, low-pass, trilight and view fold are pinned as arithmetic and wiring.
