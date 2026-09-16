# Immersive Footsteps - the mod, 1:1 (IF1, 2026-09-16)

Mac: "Next mod we will be adding 1:1" - handing over
`Immersive_Footsteps_v1.01_-_DFU_v1.0.0_-_Windows-706-1-01-1713032612.zip`.

**Immersive Footsteps 1.01** for Daggerfall Unity 1.0.0, by **Kirk.O**
(Nexus mod 706). "Adds New Footsteps Sounds That Change Based On What
Terrain Is Being Walked On, Also Armor Sway Sounds Based On What Type Of
Armor You Have Equipped." Two MonoBehaviours: `ImmersiveFootstepsMain`
(the statics - the settings, the 36 clip arrays, the seven worn-armour
slots and their sway weights, the four transition handlers and the
window-change handler, the building floor law) and
`ImmersiveFootstepsObject` (FixedUpdate at 0.02 s - the step and the
three sway clocks, the swim distance, the exterior climate-and-tile law,
the dungeon water law, the three landing sounds, the two no-repeat
rolls). Its data is vendored under `vendor/immersive-footsteps/` (the
manifest, the shipped modsettings, the two C# sources from the author's
MIT repository, the 210 clips, and a README with the provenance, the
licence and the permission line), it is credited on the About screen,
it has a Mod Authored row on the Features home (FT9's shape) and its
ten keys under its card on the Mods page, and it is ported as
`src/systems/immersiveFootsteps.js` - one component, driven by the four
stride hosts. On by default (MO1). Pins: 18 in
`test/if1_immersivefootsteps.test.js`; campaign `tools/mutants/if1.json`,
30 mutants, 28 killed, 2 equivalent as recorded (AUDIT-IF below).

## The source the port reads

Unlike Handheld Torches, Ambient Text and Eye Of The Beholder, this
mod's sources are PUBLISHED: the bundle carries `ImmersiveFootsteps.dll`
(the compiled two scripts) and the author's repository carries the
`.cs` the manifest names, under MIT. The port reads the SOURCE, not the
IL, and vendors it beside the manifest so the restatement is checkable
line for line; every function in the module names the method it
restates and the lines it was read at. The bundle's own clips are Unity
imports (FSB5 Vorbis inside the AssetBundle's `.resource` block - the
port's UnityFS reader finds the 210 AudioClip objects and their offsets
and can decode none of them, there being no Vorbis decoder in the
tree), so the clips are the repository's MP3s, checked name for name
against the manifest's 210 entries. The pin that holds the tile and
archive tables PARSES THEM OUT OF THE VENDORED .cs and compares, rather
than retyping fifteen lists twice.

## The laws, and where they live

- **DisableVanillaFootsteps (Main :891-906).** Every `PlayerFootsteps`
  clip to None and the component disabled: the stride, the two fall
  sounds and the large splash are the mod's. The hosts keep the classic
  `FootstepMachine` running (its water latch and landing shape are
  state other readers want) and ask `ownsStride()` before playing what
  it returns; `applyFallLanding`'s `sound` callback is wrapped in
  `fallSoundSink`, and the dungeon context's three plays are gated the
  same way. **The mod owns nothing until its clips are decoded** - a
  fetch and `decodeAudioData` here, where the mod's LoadAudio is
  synchronous - and that is DFU's own shape for a LoadAudio that
  throws ("Missing sound asset"): Start aborts before
  DisableVanillaFootsteps and AddComponent, and the classic stride
  plays on. A missing clip leaves the port's component inert the same
  way.
- **The fixed step.** FixedUpdate runs at 0.02 s and the refresh
  counter counts TICKS (250 = 5 s, whatever the mod's comment says
  about 50 = 1 s). The hosts hand a frame dt and the module runs the
  fixed step under an accumulator, in integer ticks (0.1 / 0.02 is
  4.999 in floats), so the clocks mean what they mean in Unity; the
  hosts cap dt at 0.1 = five ticks, and a longer stall drops its residue
  the way `maximumDeltaTime` bounds Unity's catch-up.
- **The clocks (Object :96-126).** Walking adds dt to every clock;
  running 1.5 x to the step and 1.8 x to the sways at volume 1.25;
  under half speed 0.7 x and 0.5 x at 0.6. Horse and Cart zero the step
  clock (the sways go on); each Allow switch off zeroes its clocks
  every tick. Standing still, and airborne while not swimming, are bare
  returns - the clocks HOLD, they are not zeroed.
- **The swim (Object :132-155).** Distance across ALL THREE axes
  (`GetHorizontalPosition` keeps y, whatever its name); past 1.75 units
  one splash from the current set at `volumeScale x FootstepVolumeMulti`
  - and NOT behind AllowFootstepSounds, verbatim; every clock zeroed.
- **The exterior law (Object :220-299).** Change-gated on the tile,
  the climate index and the season - nothing recomputes until one of
  them moves, which is why the mod's own "minor bug" note (water
  walking wearing off over tile 0 keeps the shallow sound) is true
  here too. Tile 0 is deep water, or shallow under water walking; the
  Shallow_Water tiles; the three Path tiles take the armour ladder;
  winter on a snowy climate (everything but Desert, Desert2, Rainforest,
  Subtropical) is snow, except Swamp's Swamp_Snow_Alt tiles, which are
  mud; then the four ladders - grassy (Woodlands, HauntedWoodlands):
  dirt is gravel, stone is the armour ladder, else grass; rocky
  (Mountain, MountainWoods): the same tables under other names; sandy
  (Desert, Desert2, Subtropical): gravel, stone, else sand; swampy
  (Swamp, Rainforest): bog is mud, grass is grass, else mud. Ocean sits
  in no ladder and leaves the set as it was. The eleven tables are
  pinned against the .cs.
- **The armour ladder.** `NativeMaterialValue >= Iron` (0x0200) is
  plate, `>= Chain` (0x0100) chain, else leather; no boots is unarmoured.
  `item.material` IS DFU's nativeMaterialValue (armorMaterials.js).
  Read at four sites: the path and stone tiles outdoors, the dry
  dungeon floor, the building floors, and the landings.
- **The building floor (Main :237-308, :494-540).** OnTransitionInterior
  walks `CombinedModels`' materials in order and the FIRST whose
  `TEXTURE.067 [Index=14] (Instance)` name (leading zeros trimmed:
  `67_14`) sits in any of the three archive tables decides - Wood_Floor,
  then Stone_Floor, then Tile_Floor, checked at each material; none, or
  a BuildingType of None, is Tile. `buildInteriorContext` lists the
  materials for it: one name per texture in first-appearance order
  over the placements' submeshes, THROUGH the climate remap (DFU names
  the material after the swapped archive), in MaterialReader's own
  format. The action doors are a separate list here as in DFU's
  combiner; the interactive furniture DFU keeps out of the combine
  (shelves, containers, ladders) is in this walk, which can only reorder
  a floor archive a shelf model happens to carry. Then by floor and
  boots: wood is plate / chain / WOOD (leather or none); stone is plate /
  chain / PATH with boots and UNARMORED without; tile is plate / chain /
  TILE with boots and UNARMORED without.
- **The dungeon (Object :196-218).** Only a dungeon with a water level
  (blockWaterLevel != 10000 - a null surface here) speaks: swimming is
  deep water, `(centreY - 0.57) < waterY` shallow, else the armour
  ladder. `centreY` is the LIVE capsule centre, feet + height / 2, the
  reading AUDIT 64 F4 established for the classic machine. A building
  keeps what the transition and the equipment refresh chose.
- **The sway (Main :571-603, Object :159-192).** Weights head 2, right
  and left arm 1, chest 3, gloves 1, legs 4 - the boots are read but
  carry none - summed per material family. A zero weight holds its
  clock at zero. Each family's clock past its interval plays one of its
  four clips at `volumeScale x ArmorSwayVolumeMulti`, zeroes the clock
  and re-rolls `Range(freq + 0.1, freq + 0.4) - leatherWeight x 0.02` -
  INTO `leatherSwayInterval`, all three of them (Object :184, :191): the
  chain and plate intervals stay at ArmorSwayFrequency for ever.
  Kept, marked `[verbatim]`, pinned.
- **The refresh (Main :542-569).** The seven slots are re-read on the
  250th tick when either Allow switch is on, and on the inventory
  window's pop (UIManager.OnWindowChange's inventory arm) - the port's
  seam is `nativeInventory._closeSilently`, the one close law (B-C1),
  so every host's inventory reaches it. Until the first refresh the
  mod wears nothing: the first five seconds of a game are unarmoured,
  as they are in DFU.
- **The rolls (Object :541-585).** `Range(0, n)`; a repeat of the last
  clip steps up from index 0, down from the last, and a coin flip
  (`Range(0, 2) == 0` is false) between. `altStep` is declared and NEVER
  set (Object :26): every Alt table (clips 4-6) is dead. Kept; pinned.
- **The landings (Object :498-520).** ApplyPlayerFallDamage is
  `<Family>_Hard_Landing_2`, HardFallAlert `_1`, PlayLargeSplash
  `Water_Landing_1`, all at `4 x FootstepVolumeMulti`.
- **SoundVolume.** The mod multiplies `Settings.SoundVolume` into every
  play; the port's master bus already applies it, so it is not
  multiplied again.
- **Settings.** Read every frame and applied only on a CHANGE
  (LoadSettings overwrites all four intervals, and running it per frame
  would reset the leather re-roll every tick); a quality change reloads
  the other 105 clips and the current table carries over by name.

## What has no twin

`CheckForTravelOptionsAcceleratedTravel` (Travel Options is not
vendored: the SendModMessage arm answers false), the Tempered Interiors
compatibility warning, and the once-per-session exception log. **BA1
(2026-09-16): the Better Ambience warning HAS a twin now** - Better
Ambience is vendored, `modCompatibilityChecking` reads its switch, and
`reportModCompatibilityIssues` posts the four log lines and the box at
OnStartGame and OnLoad, gated by AllowModCompatWarnings (the one key of
the three that is read). See `06-Systems/Better-Ambience.md`.

NOT HEARD ON A GPU: the suite runs under node with a recording audio
engine and clips of one byte; the browser's decode of the 210 MP3s and
the Vite glob that serves them are untested here.

## AUDIT-IF (2026-09-16, Mac: "Lets now do a comprehensive audit on this before merging")

The port was read again against the two sources, and every seam was
checked from the OUTSIDE - the build, the hosts, the inventory skins -
rather than through the pins that had passed. Five findings, all fixed
and each pinned; then a mutation campaign over the component and its
wiring.

- **F1 - THE BUILD INLINED THE CLIPS.** EOTB5's class, one vendor over:
  123 of the 210 MP3s sit under Vite's 4 KB `assetsInlineLimit`, so the
  production build wrote 250 KB of base64 audio into the main JavaScript
  chunk - parsed at boot by every player, whichever quality they chose
  and whether the mod was on. The rule in `vite.config.js` names this
  vendor beside Eye Of The Beholder's and still falls through for
  everything else; the pin drives the callback on both vendors' paths
  and a third that must keep the default, and re-measures the count of
  small clips so the rule cannot become academic quietly.
- **F2 - OFF TERRAIN WAS WATER.** `StreamingWorld.PlayerTileMapIndex`
  answers -1 with no built terrain under the player, and `(byte)-1` sits
  in no table, so DFU lands the climate's own else arm (grass, sand,
  mud, snow). The hosts handed the component `_surf.tileIndex ?? 0` -
  and 0 is the water tile, so a player over a pixel still streaming
  heard deep water. Both exterior hosts hand -1 now; pinned at the
  component (four climates, no tile) and at the hosts.
- **F3 - LOADAUDIO IN SERIES.** The first draft awaited the 105 clips
  one after another: 105 round trips before the mod owned the stride, on
  a slow line several seconds of classic footsteps after every quality
  change. Every clip is in flight at once now; each miss is its own and
  the AND across them is LoadAudio's `success`. The pin holds every
  fetch open until all 105 have been asked for, then answers one of them
  empty and checks the mod stays inert.
- **F4 - A BUILDING WITH NO DISCOVERY RECORD SKIPPED THE FLOOR WALK.**
  DFU's `BuildingDiscoveryData` is a struct; with no record it is
  `default`, whose `buildingType` is 0 (Alchemist), and the handler's
  `!= None` test is TRUE - the material walk runs. The first draft read a
  null building as None and dropped to the tile default. Only an
  explicit None (-1) skips the walk now.
- **F5 - THE DEFAULT INVENTORY SKIN NEVER REFRESHED.** The
  inventory-close refresh was hooked on `NativeInventoryWindow
  ._closeSilently`, which the enhanced pack - the DEFAULT skin - never
  passes through: it closes through `inventoryDoor.js`'s own `close`
  into `closeSession`. A player in enhanced mode changed boots and
  walked five seconds in the old pair. Both skins call the refresh now.
  It is NOT in `closeSession` itself, which would be the one home:
  `systems/inventorySession.js` is upstream of `transport.js`, which the
  component imports for its Horse and Cart gate, and that is a cycle.
  Pinned both ways - each skin's close carries the call, and
  inventorySession.js carries no reference.

**Checked and standing.** The outer world host returns before its own
stride once the modal host has taken the frame, so no frame ticks the
component twice. The master bus carries `SoundVolume`
(`systems/audio.js`), so the mod's `SoundVolume` factor is not doubled.
Every inventory window the three hosts build hands the player entity.
The building entry on a game LOAD runs the same entry as a door, so the
transition fires. The `season` the hosts hand is the calendar winter
DFU's `SeasonValue` names. The standalone `?interior` scene carries no
stride at all, the mod's or the classic one, which predates this port.

**The campaign.** `tools/mutants/if1.json`: 30 mutants over the
component's clocks, gates, ladders, tables, rolls, the two verbatim
slips, the fixed-step bound, the refresh, the load, and the three host
seams the audit touched; 28 killed, 2 equivalent as recorded (the three
floor tables are disjoint, so the order of the checks at one material
cannot be observed; the footstep play's switch guards a play the clock
zeroing already prevents - the mod's own redundancy, kept). TWO
SURVIVORS ON THE FIRST RUN, both the same lesson: the refresh pin
counted ticks with `REFRESH_SLOTS_TICKS` and the landing pin scaled
with `LANDING_VOLUME_SCALE` - a pin that measures a constant against
itself is a pin on nothing. Both are literals now and both mutants die.

**Not audited.** The browser's decode of the 210 MP3s and the Vite glob
that serves them (the suite runs under node with clips of one byte);
whether Unity clamps `PlayOneShot`'s `volumeScale` above 1 (the mod's
sliders reach 10, and the port's gain node does not clamp - a player who
sets 10 hears 10 here and whatever Unity does there).
