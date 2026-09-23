# Horse Cart and Cargo - the mod, 1:1 off the IL, and its online half (HCC, 2026-09-23)

Mac: "Next mod I want to implement 1 to 1 and also enhance its online
integration functionality" - handing over
`Horse_Cart_And_Cargo_1374_1.2.4_2026-09-16T01-22Z.zip`, which carries the
one shipped file `horse cart and cargo.dfmod`.

**Horse Cart and Cargo 1.0.0-rc12** for Daggerfall Unity 1.1.1, by
**demifiend000** (Nexus mod 1374). "A persistent animated horse and cargo
cart with physical hitching and mounting, Follow/Wait commands, local
storage access, animated wheels, and weight-based cargo fullness." Its
data is vendored under `vendor/horse-cart-and-cargo/` (the manifest, the
shipped modsettings, the text table, the two assemblies with their IL
dumps, and the 45 horse PNGs the assembly embeds - see the README there
for the provenance and the permission line).

The port is read off `TrailingWagon.dll`'s IL and nothing else: no
source ships with the mod. The scope of that reading is a table, not a
sentence - `test/hcc_scope.test.js` holds every authored method of the
assembly against the module that carries it, and the numbers below are
its numbers.

## What the mod is

One MonoBehaviour, `TrailingWagonRuntime`, over five modes of the wagon
(`WagonLocationMode`: None, WithPlayer, Deployed, FollowingPlayer) and
five of the horse (`HorseMode`: HitchedToWagon, LooseStationary,
WithPlayer, None, FollowingPlayer):

- **Riding the cart** shows the classic wagon model 41214 TRAILING 2.5 m
  behind the player on a breadcrumb trail (0.08 m samples, 7 m kept),
  settled a metre over the ground along its normal and smoothed (12 / 10
  per second), its wheels turning by the longitudinal travel over their
  radius, its cargo pieces (twelve classic models) showing by the wagon's
  fullness (25 / 50 / 75 / 90 % of the 750 kg).
- **Dismounting** parks the wagon where it trailed (the mode set by the
  transport window, the quick-mount key or a script is OBSERVED, not
  intercepted) with the horse hitched 3.1 m ahead of it; riding the horse
  off leaves the wagon parked; dismounting the horse leaves it standing a
  metre behind the player. A parked wagon is a physical thing: a
  non-trigger box collider over the model's bounds, grounded by a
  two-wheel solve over two 1000-up / 3000-down probes, retried every
  second until it lands.
- **The horse** is an eight-orientation billboard off the mod's own five
  drawn views (three mirrored), 121 x 94 pixels at 0.025 - and a
  forty-frame walk (five views by eight) at 4..9 frames a second by its
  speed, idling on frames 5 and 6 at 2 Hz. Talk mode on it commands: a
  waiting horse FOLLOWS (a path 45 m long, 3 m behind by the setting,
  catching up from 6 m and hard from 12 m, seven detour angles by sphere
  cast, a stuck recovery after 4.5 s, and - with the setting on -
  COMBAT EVASION onto rings of grounded candidates away from every
  hostile foe that has the player as its target), a following one WAITS,
  a hitched team on a parked wagon follows as a team. Info mode NAMES it
  (31 characters), and the name is the plaque's word for it. Grab or
  Steal rides it, or mounts the team.
- **The team** (the cart with the horse hitched) is mounted by walking up
  to it - the player within 5 m of the wagon, 3.5 m of the horse, the
  horse within 3.5 m of the wagon - through the transport window's cart
  row (dark until the team is together), the parked wagon's activation,
  or the quick-mount key, which rides the LAST mount. A summon key brings
  the horse and wagon to the player's heels, outdoors.
- **Doors** park the team: the pre-transition captures the wagon's pose
  and the door's distance, the successful entry commits it with the
  building (or dungeon) as the wagon's INTERIOR ACCESS when it stands
  within the access distance (50 m by the setting) of the door, and the
  inventory's wagon button inside asks the runtime rather than DFU - at a
  dungeon exit through the exit prompt's Yes, elsewhere by the access
  id (a building's must also be on the same map pixel). A failed entry
  undoes the parking; stepping out closes the access.
- **Fast travel** takes a following horse along (re-stood behind the
  player once the world is up at the arrival, the team's wagon 2.5 m
  behind it), or leaves it waiting at the departure with the setting off;
  a Travel Options accelerated journey ending re-stands it the same way.
- **Physical persistence** off recalls everything to the player and lets
  every window answer as DFU's would; on again with no horse says so and
  puts the player on foot.
- **The save** is `WagonSaveData` (fifteen fields, version 7), riding the
  save envelope as `horseCart`; a load normalises it (unknown enums to
  None, unit headings, the older versions' horse modes).

## The port's shape

- `src/systems/horseCartLaw.js` - THE LAW: the enums, every constant off
  the metadata Constant table, the save record and its normalisation, the
  name laws, the persistence resolutions, every predicate the runtime
  branches on, the text table, the ground pick, the billboard's
  orientation / view / walk clock, the wheel and cargo arithmetic, the
  scene <-> world conversions over `StreamingWorld.SceneMapRatio` (40).
- `src/systems/horseFollow.js` - THE FOLLOWING: `HorseFollowPath`,
  `HorseFollowController` (the speeds, the step, the evasion, the stuck
  recovery), `WagonTrail`, `groundedPoseStep`, over a physics seam
  `{ now, raycastAll, sphereCastClear, threats }`.
- `src/systems/wagon41214.js` - `Wagon41214VisualBuilder`: the classic
  wagon welded into its five pieces (102 vertices, 48 triangles, four
  sub-meshes; a body of 14, two wheels of 10 planar in X, two shafts of
  7), the pivots and the radius, and `WagonCargoVisual`'s twelve pieces.
- `src/systems/horseCart.js` - THE RUNTIME: `TrailingWagonRuntime`'s
  state and order of operations, `DeployedWagonVisual` and
  `StationaryHorseVisual` as pure state, over a `deps` bag the hosts fill
  (its header lists every seam).
- `src/systems/horseCartWire.js` - HCC-ONLINE's record (below).
- `src/scenes/horseCartPool.js` - THE PRESENTATION: the part meshes and
  the cargo meshes through the host's pipeline, the horse batches off the
  vendored PNGs (`renderer.uploadTexture('hcc', 'h<view>' | 'w<view>#<frame>')`,
  the mirror by a negative width as the foes' sprites do), the activation
  targets (`hccWagon`, `hccFollowingWagon`, `hccHorse`, and a peer's
  `hccPeer:<id>:w|h`), the hover names, the parked wagon's collider
  bucket `hccWagon` (skipped by the runtime's own probes),
  `Physics.RaycastAll` as repeated `surfaceHit`s, the peers' teams.
- `src/world/quat.js` - the quaternion as Unity spells it: `LookRotation`,
  `AngleAxis`, `Slerp`, the basis ladder `CreateRotationFromBasis` is.
- The hosts: `world.js` and `exterior.js` build the pool and the runtime,
  tick the runtime ONCE a frame in every mode (`hccTick` - the modal branch
  indoors, and the exterior frame after the motor and the recentre, before
  the world pass draws the wagon; the hotkeys read the frame's edge ring
  behind `HandleConfiguredHotkeys`' own gate), draw after the camps, shift on the floating origin, race the
  targets with the other custom activations (after Eye Of The Beholder's
  cart, before the torch - `player/activationRace.js`), name through the
  plaque's ladder and, where the plaque is not up, the mod's own HUD label
  (`ui/horseNameTooltip.js`, native y 112, both skins), save the record in
  DFU's per-mod slot on every save (`modData`, world and dungeon alike) and
  reset it at the head of every load, hand the runtime to the modes machine
  (`worldModes.js` fires `handlePreTransition` before the dismount,
  `handleSuccessfulInteriorTransition` after the mode change,
  `handleFailedTransition` in the finally, `handleExteriorTransition` on
  every way back), to the transport window (`player/mountRig.js`: the rows
  are `CanMountHorseFromTransportWindow` / `CanUseCartFromTransportWindow`,
  a click is `TryUseTransport`) and to the inventory
  (`systems/inventorySession.js openState` / `planWagonToggle`: DFU's
  own dungeon-wagon arm closes, the runtime's `CanAccessWagonStorage`
  decides, a refusal is a message box over the window).
- `src/systems/modSettings.js` `horse-cart-and-cargo` - the eight keys
  plus `Enabled`; a disabled mod is one DFU never loaded (nothing stands,
  nothing rides the wire, the windows fall back, and the machine drops
  what it was observing - `suspend`). ONE DEPARTURE, recorded (HCC-KEYS):
  the hotkeys ship on `5` / `6` (`Alpha5` / `Alpha6`), because the mod's
  `K` and `G` are Travel Options' follow key and Handheld Torches' drop
  key in this tree and no letter is free; the mod's own fallbacks for an
  unparseable entry stay `K` / `G`, as its IL has them. The first cut
  shipped `F7` / `F10` and neither was free (AUDIT HCC K1, below); a file
  that saved them loses exactly those, once.

## HCC-ONLINE - the enhancement

The mod is single-player. Online, a player's parked wagon, waiting horse,
following horse and trailing team stand in a shared cell, so:

- **Everyone near sees them.** The pool's `wireRecord` says what the
  runtime SHOWS (the wagon's kind, base, rotation, cargo tier and wheel
  angle; the horse's base, forward and whether it walks) in the wire
  frame, as `hv` on the cell's foes frame beside the camps' `c` - on every
  full frame, and between them whenever the word moved (the foe pool's
  `foesFrame(full, force)` sends a frame with no foe in it for the
  rider). A reader lands it through `validHccRecord` (shape, bounds, a
  unit quaternion, a known kind and tier, the walking bit, the name
  through the wire's label door at the mod's 31) under the camps' owner law: an owner's word
  replaces that owner's alone, `null` says none stand, an owner gone from
  the room or quiet past `FOES_STALE_MS` is swept, a room change clears.
  The reader keeps the word in the WIRE frame and converts it every frame,
  EASES a peer's team between words (12 per second, a step past 20 m
  snaps) and draws it with the same pieces, cargo and billboard - the
  horse's orientation and its stride are the reader's own, as a sprite's
  must be. A peer's PARKED wagon stands a collider of its own.
- **The plaque names whose.** A peer's horse reads "<Name> (<Peer>'s
  horse)" or "<Peer>'s horse", their wagon "<Peer>'s wagon"; the press on
  one says so and opens nothing.
- **Nothing of the storage rides.** A player's items are their own
  client's; a peer's wagon is a thing to see and walk around.
- **No relay change.** The relay reads nothing inside a foes frame, so
  `hv` needs no version; the pose already carries the transport mode.
- **An owner's word needs its owner.** A team stands for the others while
  its owner is in the cell room to say it; indoors (every door is a room of
  its own), away, dead or gone, it goes with them, as their camps and foes
  do. A parked wagon that outlives its owner's presence would be a cell's
  own memory on the relay, which cell rooms do not keep - recorded as the
  open question below, and the Enabled note says what this law shows.

## AUDIT HCC (2026-09-23)

Mac: "Let's do an audit on this, ensure online is handled properly and any
new notifications or UI elements are enhancified." Three lenses - the
online lane, the notifications and UI, the hosts' lifecycle - read the
port whole; every finding is paid below, pinned by execution
(`test/audit_hcc.test.js`, the O-rows in `test/hcc_pool.test.js`) and
killed by a mutant in `tools/mutants/hcc.json`.

**Online.**
- O1: a peer's team kept its targets in the scene frame of the moment it
  landed, so every recentre of mine snapped it 819 m away until its next
  word. The pool keeps the WIRE record and converts it every frame.
- O2: a fast travel's teardown (`clearLive`, which re-anchors the origin
  with no offset) kept the peers' teams; it clears them as `clearPuppets`
  does.
- O3: a peer's parked wagon had no collider. It stands `hccWagon:<owner>`,
  gone with the owner, the sweep or a change of kind, and the ray gives it
  the surface pardon.
- O4: a peer's horse name passed control characters, bidi overrides and
  names the filter refuses. It rides the wire's label door
  (`sanitizeLabel`: printable ASCII, the name filter).
- O5: the walk frame rode the word, so a STANDING horse's idle flicker
  (frames 5 and 6 at 2 fps) was a new word twice a second, forever, to the
  whole cell. The walking bit rides; the reader strides its own
  `HorseWalkAnimationState`. The change key is taken in the wire frame, so
  my own rebase is not a word.
- O6: a press on a peer's team answered from any distance. Past the mod's
  3.2 it says DFU's "too far", as the dropped torch's arm does.
- O7: my switch turned off reached the peers only at my next full frame; it
  is a word now. O8: a viewer with the mod off still fetched and built a
  peer's art; it lands nothing. O9: a peer's horse was named and pressed
  while its art was not drawn; it is not.
- O10, recorded not changed: the owner's-presence law above.

**Notifications and UI.**
- K1: `F10` is DFU's LargeHUDToggle and `Shift-F10` its HUDToggle (world
  shortcuts, answered with the key already in the ring), and `F7` is the
  browser's caret browsing. The keys moved to `5` / `6`; the gate now walks
  every vendored mod's shipped keys against DFU's bindings, its world
  shortcuts, the browser's keys and each other.
- K2 / K3: the hotkeys were a derivation over the held-key set (a tap
  shorter than a frame lost; no gate under a DOM surface). They read the
  frame's edge ring behind the IL's own `IsPlayingGame` / `LoadInProgress`
  gate.
- K4: a captured key could never be cleared to `None`; the capture has the
  controls pane's clear, and the notes say the port's control.
- U4 / H1: the runtime was ticked only outdoors and after the draw - the
  mod's "only outdoors" lines were dead indoors and the wagon lagged its
  horse by a frame. `hccTick` runs once a frame in every mode, before the
  world pass.
- U5: the naming prompt (and every DaggerfallInputMessageBox) drew DFU's
  parchment in the bitmap font under the enhanced skin. Under the enhanced
  skin it is its own window in the skin's face (`ui/enhancedInputBox.js`):
  centred, the notice's panel and rule, the label and the live entry with a
  caret, and a caption that says Enter accepts and Escape cancels -
  ENH-NOTICE1's law kept, a field is a decision and never a notice.
- U6: the horse's name tooltip existed only as the enhanced desktop plaque.
  `HorseNameTooltipController`'s label is ported (`ui/horseNameTooltip.js`):
  DFU's line at native y 112 on the classic skin, the mid-screen label's DOM
  face on the enhanced one, where the plaque is not up.
- I1 / I2: the inventory read Eye Of The Beholder's outdoor cart as a
  dungeon-exit request ("Your wagon is too far from the entrance." on open
  ground); the exit request is `IsPlayerInsideDungeon && the flag`
  [IL_abb8]. The enhanced pack now shows the opening refusal as its notice
  and carries the granted flag to its wagon button.

**Lifecycle.**
- H2: the travel map's journey never called `OnPreFastTravel` /
  `OnPostFastTravel` (they sat on the online respawn alone), so a following
  team was left on the old pixel's coordinates, standing nowhere. The pair
  wraps `fastTravelTo`; the online respawn keeps it as the journey it most
  resembles.
- H3: a dungeon save carried no record (the online close-the-tab save
  included) and a dungeon or "elsewhere" load neither reset nor restored
  the runtime - one character's horse and wagon rode into the next. The
  record is DFU's per-mod save data (`modData`, every save), `OnStartLoad`
  runs at the head of every load and `RestoreSaveData` once the place
  stands; the same-dungeon load does both.
- H4: the live switch off left the machine observing; it suspends
  (`clearAllTransientState`), and a save taken with the mod off keeps the
  record.
- Checked and not changed: the pre-transition call before the `try` - its
  two neighbours are a region read and a mode set, and cannot throw.

## What is and is not ported

The assembly's dump carries 444 method bodies; 46 are compiler-generated
and struck (constructors, the `<Start>d__161` coroutine's five, the
`<>c` lambda bodies, the event accessors). That leaves
**398 authored methods**, each a row of `test/hcc_scope.test.js` with the
symbol and module that carries it or a sentence saying why the port has
no twin. **341 are ported**; **57 have no twin**, in these families and
no other:

- `DeployedWagonFollowerCollisionFilter` (11): `Physics.IgnoreCollision`
  between the parked wagon's box and allied CharacterControllers - the
  port's collider holds no bodies; the horse's own probes skip the
  wagon's bucket instead.
- `HorseCartUiCompatibilityCoordinator` (11) and the mod-message half of
  `HorseCartCompatibilityApi` (5): Harmony over UncannyUI / Dragon Rider /
  Expanded Inventory and DFU's ModManager message bus - none of those mods
  is here, and a port module that needs the runtime's word imports it.
- `TrailingWagonTradeWindow` (4): the port's trade window has no wagon
  toggle of its own yet (its action panel's wagon button is a consumed
  no-op awaiting its slice); when it lands it gates through
  `canAccessWagonStorage(Trade)` as the inventory's does.
- Unity transform / hierarchy / lifetime plumbing (`OwnsTransform`,
  `get_Parent`, `ResetVisualLocalTransform`, the cargo tier roots, the
  mesh destroys, `OnDestroy`), DFU's event bus and `UIWindowFactory`
  registration, the HUD `TextLabel`'s removal from a replaced HUD (the
  label itself is ported - AUDIT HCC U6), the
  session-long texture release, the legacy save-file migration, the
  `SaveDataInterface` type token, DFU's `Button` unbinding.

## Verification

- `test/hcc_law.test.js` (13), `test/hcc_follow.test.js` (7),
  `test/hcc_wagon41214.test.js` (8, over `test/hccModel.mjs`'s synthetic
  twin of the verified topology), `test/hcc_runtime.test.js` (15, the
  runtime driven over a fake flat world: mount, trail, park, activate,
  follow, wait, name, the windows' questions, the doors, the save, fast
  travel, Travel Options, the persistence setting, the origin),
  `test/hcc_pool.test.js` (13, the presentation, the wire and the audit's
  online rows), `test/audit_hcc.test.js` (9, AUDIT HCC),
  `test/hcc_hosts.test.js` (10, the hosts' seams by execution and by
  source), `test/hcc_scope.test.js` (4, the table), `test/hcc_assets.test.js`
  (3, the vendored files are the assembly's).
- `tools/mutants/hcc.json`: the mutation list, every one dead.
- Not verified in a browser: no session exists in this container. The
  first thing to look at in one is the trailing wagon behind the cart and
  the horse standing where you dismounted.
