# Better Ambience - the mod, 1:1, and its peace with Immersive Footsteps (BA1, 2026-09-16)

Mac: "Next mod to integrate 1:1 ensuring compatibility" - handing over
`BetterAmbience-139-0-1-5-1666071806.zip` (labelled 0.1.5; the manifest
inside says 0.1.4).

**Better Ambience 0.1.4** for Daggerfall Unity 0.13, by **Joshua
Steinhauer** (joshcamas, Nexus mod 139). "Adds camera shaking, better
footsteps, and dungeon fog + reverb." Six modules, sixteen sources - all
of them INSIDE the shipped bundle as TextAssets, so this port reads
source, as IF1 did, and vendors it beside the manifest
(`vendor/better-ambience/`: the manifest, the shipped modsettings, the
sixteen `.cs`, the author's MIT LICENSE, the 29 WAV clips the mod asks
for from the author's repository, and a README with the provenance and
the permission line). Credited on the About screen; a Mod Authored row
on the Features home; its twenty keys under its card on the Mods page;
ported as `src/systems/betterAmbience.js` (one component, every host)
with `src/systems/reverbPresets.js` (Unity's three AudioReverbPresets
and the impulse built from each) and three engine seams: the audio bus
takes a reverb zone and its loops a low-pass, the renderer's mesh
program takes a trilight ambient, and the damage flash's RemoveHealth
edge carries its amount. On by default (MO1), with ONE departure
below. Pins: 14 in `test/ba1_betterambience.test.js`; campaign
`tools/mutants/ba1.json`, 42 mutants, 41 killed, 1 equivalent as
recorded (the classic gate's Immersive Footsteps arm, which no
node-run singleton can turn on). FOUR SURVIVORS ON THE FIRST RUN, each
made to bite: the view fold was pinned as "not the same matrix" and
now as the inverse (local x shaken = view); the four-frame wait was
counted with its own constant, IF1's lesson again; thunder was pinned
as "no restart" and a stop is not a restart; the reverb tail's decay
was one sample against one sample of noise, a coin toss, and is a
windowed mean now.

## The compatibility brief, and the two departures

Immersive Footsteps (IF1) and this mod both take the player's stride:
each nulls PlayerFootsteps' clips and plays its own. Immersive
Footsteps' author wrote the ruling into his mod
(`ImmersiveFootstepsMain.cs:216-236, :400-449`): ModCompatibilityChecking
finds Better Ambience by GUID and reads its "Better Footsteps" switch,
and while both are on it logs four lines and posts a message box at
every game start and load - "Disable the 'Better Footsteps' setting for
the Better Ambience mod. Otherwise footstep sounds will be constantly
overlapping each other." So:

- `Better Footsteps.enable` SHIPS OFF here. The mod ships it on; this
  port ships the pair the way the author of the other mod says a player
  should run them (modSettings.js records the departure, the pin holds
  every other key to the shipped value).
- The warning is PORTED (`immersiveFootsteps.js`:
  `modCompatibilityChecking`, `reportModCompatibilityIssues`), the arm
  IF1 had recorded as "no twin": a player who turns both strides on is
  told what a DFU player is told, at OnStartGame (world.js's
  `questInitAtGameStart`) and OnLoad (the quick load's success), through
  the host's ChoiceWindow, unless AllowModCompatWarnings is off.
- The classic stride has ONE gate, `classicFootstepAllowed(clip)`: off
  entirely while Immersive Footsteps owns it; while Better Ambience
  owns it, only the two clips its DisableBuiltInFootsteps forgot (below).
  Both on is both playing, as in DFU.
- BA2 (2026-09-17, Mac: "before any lighting work/the ambient mod that
  was introduced I really liked how the dungeons were properly dark
  ... is there any way to reintroduce that properly?"):
  `Dungeon Lighting.enableFogAmbientEffect` SHIPS OFF. On, the module
  replaces DFU's flat 0.12 dungeon ambient with its Trilight (~0.40 at
  the equator, tinted toward the fog colour) - three times the classic
  dark, and past the Dungeon Brightness setting, which scales the flat
  ambient alone (in DFU too: the mod disables PlayerAmbientLight). Off,
  the dungeon keeps the classic 0.12 (and EL4's dark under the lane);
  the fog and the reverb ship on as before; a player who set the toggle
  keeps it. The pin holds the mod's own behaviour with the key on and
  the port's default with it off.

## The laws, and where they live

- **Better Footsteps (BetterFootstepsMod.cs, BetterFootstepsComponent.cs,
  ComponentPlayer.cs, SoundList.cs).** The player's stride is
  PlayerFootsteps' own shape with SoundLists in the clips' place: a
  list per ground (wood 4, stone 4, crunchy-grass 4, water 5 of the 6
  asked for, the classic SplashSmall and the classic snow pair), each
  rolling a clip and a pitch (0.8-1.2; the armour 1.0-1.2) and playing
  at its own volume (armour 0.4, stone 0.3, wood 0.4, water 0.4, grass
  0.15, splash and snow 1) times the switch's multiplier times
  FootstepVolumeScale 0.7 (half at half speed). The ladder: the season,
  climate, inside, exterior-water, path and static-geometry gate; snow
  in winter unless the climate is snow-free; a building is wood; a
  path tile is the DUNGEON list; dungeon water at `(y - 0.55) <
  waterY` is shallow (NOT PlayerFootsteps' 0.57), left at 0.95; the
  on-foot gate `IsLevitating || !IsOnFoot && OnExteriorWater == None`
  with C#'s precedence; the lost-grounding landing swallowed once.
  The ARMOUR CLANK rides every non-submerged step when the chest or the
  legs are worn and not leather (HasArmor reads NativeMaterialValue !=
  Leather, so chain and every plate clank alike). The NPC and Enemy
  components exist and nothing adds them (Start's hooks are commented
  out) - dead in 0.1.4, not ported. Verbatim and kept:
  **DisableBuiltInFootsteps nulls Dungeon1 twice and Outside1 twice**
  (a copy-paste slip), so PlayerFootsteps keeps Stone2 and Outside2 and
  a DFU player hears the classic second step under the mod's on stone
  and outdoors - the port's gate keeps exactly those two. GetRandomClip
  indexes the mod clips by the unshifted roll past the classic entries
  (`audioClips[rand]`) - it cannot bite, the mod mixes no list.
- **Camera Shake (CameraShaker.cs, CameraShakeInstance.cs,
  DamageShaker.cs - EZ Camera Shake).** DamageShaker.RemoveHealth is a
  second receiver of the `SendMessage("RemoveHealth", amount)` the
  flash rides (ui/damageFlash.js), so the flash edge carries the amount
  now and every sender hands it (the eleven sites). The shake is
  `clamp(add + multiplier x amount / MaxHealth, 0, maxShake)` at the
  roughness and fades. The instance: Perlin noise on a clock that
  starts at an integer, fades in over fadeInTime, drops sustain at 1,
  fades out over fadeOutTime with the clock scaled by the fade. The
  shaker calls UpdateShake TWICE an instance a frame - once for the
  position term, once for the rotation - so the fade and the clock
  advance twice; EZ Camera Shake's own, kept. The shaker sits between
  the follower and the camera as its parent; the port folds the same
  local offset (0.15 per axis) and euler (1 per axis) into the frame's
  VIEW matrix as a rigid inverse in camera space, at each host's
  `lookAt` - roll included. PERLIN: the port's `world/perlin.js` (Ken
  Perlin's improved noise, the recorded stand-in for Mathf.PerlinNoise)
  is exactly 0.5 on the lattice, and the clock starts ON the lattice,
  so the first frame of a shake is still here where Unity's noise
  would not be; from the second frame it is noise of the same character.
- **Dungeon Fog and Lighting (FoggyDungeonsMod.cs).** On OnStartGame,
  OnLoad, and the dungeon's two transitions: four frames' wait (the
  coroutine's four yields, paid by the frame), then the settings re-read
  and, in a dungeon that is not a castle, `new System.Random(dungeon
  .name.GetHashCode())` rolls the fog colour (three doubles), and with
  enableFog the start and the end; the colour times dungeonDarkness is
  a LINEAR fog; with enableFogAmbientEffect the ambient goes Trilight,
  the three greys (0.433 / 0.396 / 0.254) lerped toward the colour by
  fogAmbientEffect and scaled by the darkness, PlayerAmbientLight
  disabled. `System.Random` is the .NET reference (Knuth's subtractive
  generator - seed 42 opens 0.6681064659115423, pinned); the seed is
  Mono's `string.GetHashCode` (h = (h << 5) - h + c) of the dungeon's
  GameObject name `DaggerfallDungeon [Region=R, Name=N]`. Unity's
  runtime hash cannot be checked from here: the colours are
  deterministic per dungeon here as there, and MAY DIFFER from a DFU
  player's for the same dungeon - said in the record, not hidden. The
  hosts hand the fog as the BASE the underwater murk overrides and the
  trilight to `setLighting` (which clears it for every flat caller);
  the renderer's mesh program lights by `n.y` between sky, equator and
  ground, and a billboard takes the equator. A castle, or leaving the
  dungeon, is DisableDungeonFog: the port's own ambient again.
- **Dungeon Reverb (ReverbMod.cs).** An AudioReverbZone on the player,
  min and max distance 1000, on inside a dungeon, its preset by level
  (Low Cave, Medium Stoneroom, High Quarry). The port's bus is one
  master gain, so the zone is a convolver hung off it (dry beside wet)
  whose impulse is BUILT from the preset's I3DL2 numbers
  (`reverbPresets.js`: room and roomHF, decayTime and decayHFRatio,
  reflections and reverb with their delays, HFReference) - the shape
  is the preset's, the exact tail is not FMOD's. Every sound goes
  through it, as every source in Unity does at reverbZoneMix 1.
- **Better Rain (BetterRainMod.cs, InteriorAmbientSoundSource.cs).**
  The particle tweaks (rotation, speed, size, colour, shape, force,
  sub-emitters, the render sizes, the texture and material) retune a
  Unity ParticleSystem the port has not got - NO TWIN, the two
  switches declared and inert. The INDOOR RAIN is ported: after the
  four-frame wait a source is placed - 2D in a building, 3D at
  "DungeonExit" (the port's enter marker) in a dungeon, none outdoors
  - with an AudioLowPassFilter at 4236 Hz; its Update follows the
  weather word and plays `AmbientRaining` looping in rain and thunder,
  stops otherwise. The audio engine's loops take a `lowpass` for it.
- **DungeonSoundsMod.cs** is an empty Start and Update.

## What has no twin

The rain and snow particle retune (above); the NPC and enemy footstep
components (dead in the mod itself); Travel Options' accelerated-travel
check (not vendored); Unity's exact Perlin table and its string hash
(both recorded stand-ins); FMOD's reverb algorithm (the preset numbers
stand, the tail is synthesised).

NOT HEARD OR SEEN ON A GPU: the suite runs under node with recording
audio and a null renderer; the convolver, the low-pass, the trilight
shader path and the view fold are pinned as arithmetic and wiring.

## AUDIT-BA (2026-09-16, Mac: "Audit now before merging")

Read again from the outside - the bus, the wall program, the hosts'
frame order, the boot order, the pause - rather than through the pins
that had passed. Four findings, fixed and pinned; three more mutants
on the campaign (42, 41 killed, 1 equivalent as recorded).

- **F1 - THE REVERB WOULD HAVE BLASTED.** The impulse's noise tail was
  written at the level gain PER SAMPLE, and a noise tail of amplitude a
  over N samples convolves to a wet signal of RMS gain a x sqrt(N): the
  Cave came out 11.6 times the dry (energy 134), the Stoneroom 16 times
  - every sound in a dungeon a clipping roar, and "not heard on a GPU"
  is exactly why. A reverb level in millibels is the level of the
  reverberation as a whole against the direct sound, so the tail is
  normalised to unit energy before the gain scales it; the whole
  impulse now carries the tail's gain squared plus the five taps',
  under the dry (Cave 0.10, Stoneroom 0.16, Quarry 0.32), and the pin
  computes that sum and holds it.
- **F2 - THE REPOSITION.** The mod answers `StreamingWorld
  .IsRepositioningPlayer` with `ignoreLostGrounding = true` (:66-70),
  and the port's floating-origin shift IS that reposition; the first
  draft's `rebase()` only dropped the anchor, so a landing right after a
  map-pixel crossing played where DFU swallows it. And world.js handed
  `loadInProgress: _seasonHeld` - a debug hold key is not a load; it is
  false now, the reposition riding rebase().
- **F3 - THE SHAKE UNDER A PAUSE.** `Time.deltaTime` is 0 under
  IsGamePaused, so a shake freezes under a window; the hosts hand the
  frame's dt whether or not they hold the world, and the shaker ran on
  under the pause menu. The hosts hand `paused` (the same held flag
  Immersive Footsteps takes) and the shaker's clock takes 0 for it.
- **F4 - THE MUSIC WAS DRY.** Unity's zone takes every AudioSource the
  listener stands near at its reverbZoneMix, 1 by default, the music's
  included; the port's two song players (the MIDI synth and the
  streamed one) run their own masters on the same context and bypassed
  the convolver. The zone is a SEND now: a node the sound master and
  both music masters feed, the convolver hung off it.

**Checked and standing.** The dungeon's walls and floors draw through
the one mesh program the trilight lives on (no separate static-batch
program). The four hosts run `frame()` before they build the view the
fold is applied to. The talk layer that shows the compatibility box
exists before any OnStartGame site can call it. `setLighting` clears
the trilight for every flat caller, so it cannot outlive a dungeon.
The rain loop's `loop()` signature change is additive and every other
caller passes two arguments.

**Not audited.** The convolver, the low-pass, the trilight shader path
and the view fold's handedness remain unheard and unseen on a GPU; the
fold's rotation sign against Unity's left-handed euler is noise either
way, and is said so.
