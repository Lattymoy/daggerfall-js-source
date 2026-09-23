# Handheld Torches - the mod, 1:1 (HT1, 2026-09-14)

Mac: "Next mod to integrate 1:1 is this" - handing over
`Handheld_Torches-780-1-4-1-1761044143.zip` - and, with it, "Im
wondering if morrowind has its own torch model" (answered at the end).

**Handheld Torches 1.4.1** for Daggerfall Unity 1.1.1, by
**RedRoryOTheGlen** (Nexus mod 780). "Auto-extinguishes torches and
candles when drawing weapons with no free hand." Four MonoBehaviours:
`HandheldTorches` (the hand law over `PlayerEntity.LightSource`, three
keys, a first-person sprite of the hand holding the lit torch or
lantern, a burning loop), `HandheldTorchesProjectile` (a thrown torch),
`HandheldTorchesEnemyLight` and `HandheldTorchesEnemyParticleEmitter`
(a foe set alight). Its data is vendored under `vendor/handheld-torches/`
(the manifest, the shipped modsettings, the mod's 39 textures - the
author's own pixel art, see "The textures, and the doctrine" - and a
README with the provenance and the permission line), it is credited on
the About screen, it has a Mod Authored row on the Features home (FT9's
shape) and its 52 keys under its card on the Mods page, and it is
ported as `src/systems/handheldTorches.js` (the component) and
`src/scenes/droppedTorches.js` (the pool: dropped and thrown lights,
burning foes), with `src/systems/keyCodes.js` for its key names. On by
default (MO1); the four presentation modules (Sprite, Bob, Inertia,
Step) ship OFF as the mod ships them. Pins: 19 in
`test/ht1_handheldtorches.test.js`.

## The source the port reads

The bundle carries `Handheld Torches.dll` (43,520 bytes) and no source;
the four `.cs` files its manifest names are not in it. The port's law
is the IL, read method by method with the members resolved (the road
Seasons of the Iliac Bay and Weapon Widget took). Neither the DLL nor
the IL listing is carried; every function in the two modules names the
method it restates and the IL offset it was read at. The DFU-side
members the mod calls - `PlayerEntity.LightSource`,
`WeaponManager.Sheathed / UsingRightHand`, `ItemCollection.Contains /
GetItem / RemoveItem / AddItem`, `DaggerfallUnityItem.GetItemHands`,
`EntityEffectManager.IsTransformedLycanthrope`,
`PlayerActivate.RegisterCustomActivation`, `FormulaHelper.
CalculateSuccessfulHit`, `EntityEffectBroker.CreateSpellBundle` with
`ContinuousDamageHealth`, `DaggerfallDateTime` through the rest window,
`PlayerTorch`'s transform - are the port's own homes for them.

## The shape here

`createHandheldTorches()` is the component; the weapon rig
(`combat/weaponRig.js`) owns one per host beside the Weapon Widget
clone and feeds it the frame: `update()` is `Update`, `lateUpdate()` is
`LateUpdate` (the mod runs both; the rig calls them in that order, after
the machine's own step), `draw()` is `OnGUI`'s repaint, called in the
rig's draw seam after the Morrowind arms and before the widget's sprite
and the classic weapon. The keys are the mod's own three KeyCode names
(`Handling.ToggleLightInput` F, `Handling.ManualDropInput` Tab,
`Throwing.ThrowTorchInput` X), parsed as `Enum.TryParse<KeyCode>` parses
them (`keyCodes.js` - a name Unity has no member for is
`KeyCode.None`, the mod's "Detected an invalid key code", and the key
never fires) and polled off each host's raw key set through the rig's
`keyDown`.

`createDroppedTorches()` is the pool one host owns, as
`scenes/droppedLoot.js` is the ground pile's: the five hosts (the world
host and the exterior host outdoors, the interior mode, the dungeon
context under the world host, the standalone dungeon) each create one,
compose its `lights()` into their point-light channel beside the player
torch, draw its `batches()` on their billboard pass, `tick()` it for the
burn and the flight, put its `targets()` on the one activation ray
(`pickActivatableHit` at the mod's 3.2), `destroyAll()` on every
transition (`DestroyLightSources_OnTransition*`), and carry its
`snapshot()` in the save (`HandheldTorchesSaveData`: position, time,
template - restored by spawning each). The streaming world host stamps
each outdoor light with its map pixel and sweeps it with the pixel
(`TrackLooseObject`'s parent), and its floating-origin recenter moves
the pool (`offsetAll`, THE FOUR HOSTS RULE).

## The hand law (UpdateFreeHand, IL 0x2c44)

Every Update: both hands free; the LEFT slot (21) taken by anything in
it, a shield (LeftOnly) only while the right hand is in use, a bow
taking the right hand too; the RIGHT slot (19) taken by anything in it,
a bare right hand taken while `UsingRightHand`; sheathed, only a bow in
the left slot still takes the left; then Stow When Spellcasting /
Climbing / Swimming and a transformed lycanthrope take both. The mod's
`GetFreeHand` names the left first. `WeaponManager.Sheathed` and
`UsingRightHand` are read LIVE (ldfld 0x2c8a, callvirt 0x2cfc); the
cast, the climb and the swim are the mod's own fields latched in
`LateUpdate` (0x1eea-0x1f25) after Update read them - a frame of lag
the mod has, kept.

With no free hand, a lit torch or candle is stowed - `OnStow` Unequip
remembers it as `lastLightSource`, Drop drops it (`DropLightSource`) -
and a lit lantern is stowed with "You can't hold a light source right
now" unless `RelaxedLanterns`; a sheathed player is not told. A hand
freed lights the remembered light again.

**~~The `== LeftOnly` quirk~~ - A MISREAD, CLOSED BY 3ARMS (2026-09-22).** IL 0x2d1a compares the right slot's `GetItemHands()` to 2, and this record read 2 through the PORT's own `ITEM_HANDS` table (None 0, RightOnly 1, LeftOnly 2, Either 3, Both 4) because the DFU declaration could not be fetched that session. It has been now: `DaggerfallUnityEnums.cs:526-533` declares `None, Either, Both, LeftOnly, RightOnly`, so 2 is BOTH, and the mod's own source says it in words - `GetItemHands(itemRightHand) == ItemHands.Both //if right hand item is two-handed, occupy the other hand even if free` (HandheldTorches.cs:1323; the left slot's arm at :1311 is the same compare beside the bow). The arm fired on nothing for as long as the port had it: a lit torch stood beside every staff, claymore and warhammer, never stowed for a swing, and the relaxed switch changed nothing. See 3ARMS below for what changed; Weapon Widget's mirror overrides carried the same misread (WW1 records it, and 3ARMS closed it there too).

## The keys and the actions

- **Ignite / douse** (`ToggleLightSourceAction`, 0x33b8): a lit light is
  doused ("You douse the <condition> <name>", clip 381, its kind
  remembered); else the stowed light comes back; else with
  `RememberLastLightSource` the remembered kind from the pack; else the
  ladder lantern, torch, candle, holy candle ("You ignite the ...", clip
  16 at HALF volume - `PlayOneShot(16, 0, 0.5)`), or "You don't have a
  light source". No free hand refuses with the message - a relaxed
  lantern in the pack excepted.
- **Drop** (`DropLightSourceAction`, 0x32b8): the lit light unless a
  lantern, else a torch, a candle, a holy candle from the pack; lanterns
  are never dropped; "You don't have a light source to drop".
  `DropLightSource` (0x2fa8) casts 1.45 forward from the body's centre
  (the player OBJECT's forward - yaw alone), then 145 down from there,
  spawns the light with `currentCondition x 20` seconds, removes it
  from the pack, "You drop the ...", clip 380 at the spot.
- **Throw** (0x17e1-0x19f4): the press with a torch in the pack DOUSES
  the lit light (0x18f9; a relaxed lantern excepted); the hold winds up
  `throwTimer += dt x ThrowScaleSpeed` and draws the arc
  (`DrawTrajectory`, 300 fixed steps of the same flight law, stopping at
  the first wall); the release throws at
  `clamp(throwTimer / 1, 0.25, 2)` - `ThrowLightSourceAction` (0x3238):
  the lit torch, else the first torch in the pack; since the press
  doused it, the lit arm is reached from the key by nothing and the
  first torch in the pack goes (the lit one only when it is first).
  Kept. "You throw the ...", clip 106; no torch: "You don't have a torch
  to throw".
- Every message spells its item `Condition().ToLower() + " " +
  LongName.ToLower()` (`torchItemWords`: "new torch", "battered
  lantern").

## The sprite

`InitializeTextures` (0x1034): TEXTURE.112359 record 0 (the torch hand,
90x205, four frames) and record 1 (the lantern, 110x138, four), frames
until one is missing; the lantern's frames sit at index 4. The three
placements over the screen rect scaled by `width / 320` (the aspect
locked, or `height / 200`): `SetGuard` (0x2794) in from the side by
`width x 0.5 x Offset.x` and up from the bottom by `height x 0.25 x
Offset.y`; `SetAttack` (0x2950) the bottom corner, the sprite's centre on
it so half shows; `SetSheathe` (0x2aa8) a full height below the corner.
`positionCurrent` moves toward the placement at `dt x Speed x 2000 x
SPD / 100` (`offsetSpeedLive`), thrice that with no sprite to show, and
jumps after a drop or a throw. `GetSpriteRect` (0x11e4): the centre
moved by Position, the size grown by Scale, the Offset in the rect's own
size, the top never below the screen's bottom nor the bottom above the
large HUD's floor, the Step snap on the screen's 64ths. A frame every
0.0625 s; a candle has no sprite (the sheathe placement). Ambidexterity
puts the sprite in the free hand (flipped for the right, both busy
keeping the last, the module off following Handedness) and on a flip
writes `PlayerTorch`'s local position - the torch's light to that hand
at (0.34, 0.9, 0.25), a lantern's low at (0.26, 0, 0.25) - which the
port carries as `playerTorch.setPlayerTorchOffsetOverride` (the
transform keeps what was last written; `dispose` clears it). Bob,
Inertia and Step are Weapon Widget's laws restated where the IL
restates them, over the same modsettings tables (`BOB_SHAPE`,
`STEP_CONDITION` - one home, `combat/weaponWidget.js`); the bob's
sideways term is signed by the hand. Drawn white: `FPSWeapon.Tint` is
First-Person Lighting's channel and the port has no such mod.

## The dropped lights, the thrown torch, the burning foe (droppedTorches.js)

A dropped light is a billboard of TEXTURE.112358 (record 0 a torch,
four frames with `_Emission` twins; 1 a candle, five; 2 a holy candle,
five; +10 doused, one frame, no emission), mirrored on a coin, a point
light for the lit ones (`1 + the item's range x (time left / the item's
full burn)`, hung over the billboard's HEAD - half the texture's own
height, then half a unit; AUDIT 66 F1, F10), a 3D burning loop
for a torch (clip 420, linear to 5), a TIME in seconds (`condition x
20`) dead at 0. Under a dungeon's water (`its top 1.25 above the point
below the block's water plane`) it lands doused. Activation: Grab or
Steal picks it up - the item minted with `ceil(time / 20)` condition
(`PickupLightSource`, 0x3d18), the component deciding the hand by
`OnPick` (Store stows with clip 417; Equip lights it in a free hand or
stows it as the light to take up; Force Equip sheathes the weapons to
light it) - Info or Talk names it ("You see a torch").

**The burn clock, one law where the mod has two.** The mod subtracts
`TimeScale / 12 x deltaTime` every frame (0x19f4-0x1bdc) and, after a
rest window, `world seconds elapsed / 12` in one go
(`OnRestWindowClose`, 0x388). Both are the world clock's seconds over
twelve (DFU's TimeScale is 12 world seconds a real second), so the port
burns every dropped light by the world-minute delta each tick (`x 60 /
12`) - which ages them through a rest, a loiter or a wait exactly as the
rest hook does, and through nothing the mod does not (a fast travel is
a transition, and the pool is destroyed on it). **AUDIT 66 F2:** and
through no JUMP either - `Time.deltaTime` is not inflated by a load but
a world clock is, so the pool re-latches its clock wherever time can
pass without the player living through it (a `restore`, a `destroyAll`,
and the first light into an empty pool). Before that, an in-session load
of a save three days ahead destroyed every torch it had just restored.

The projectile (`Initialize` 0x4688, `FixedUpdate` 0x47a4): from the
free hand's side (0.35 off the camera's right, signed by the hand), the
look tilted up by `ThrowAngleOffset` about the right and scattered by
`Random.Range(-1, 1) x ThrowDispersion` about the right and the up,
speed `25 x STR / 100 x ThrowStrength x wind-up`; its quad CENTRED on
the flight point where the dropped light's is raised (the mod gives this
one no half-height raise, 0x3a9b - AUDIT 66 F3); Unity's 0.02 s step
(accumulated), the gravity vector growing by `9.81 x 0.05 x
GravityStrength` a step, the sprite's width swung by `sin(20t)` (the
spin), a cast along the step: a foe first (see below), a wall at under a
fifth of the start speed lands it as a dropped light with the drop clip,
faster bounces - the flight's x/z with the gravity's y reflected over
the normal, the speed by `Bounciness`, the gravity dropped, the point
raised by the texture's height x 0.016 along the normal, the clip no
oftener than every 0.2 s.

A foe struck (0x4886-0x4a4a): made hostile; with `Combustion`, DFU's
`CalculateSuccessfulHit` with `Accuracy` as the modifier, and on a hit
DFU's own Continuous Damage-Health (one effect, `Duration` rounds + 1 x
level, `Magnitude` a round) on the foe's own manager (CasterOnly - the
foe its own caster, no saving throw) through the port's `applySpell`,
beside the mod's light effect: an active entry of `Duration` rounds
(`AddState` stacks a re-hit's rounds) carrying a point light at the
player torch's range and a looping flame billboard (TEXTURE.375 record
0, the fire missile's flight loop, at 15 fps, its height NEGATED - drawn
upside down as the mod scales it) behind and above the foe's feet (0.4
back, 0.6 up) while the entry lives; clip 16 at the point; the torch is
spent either way. `ContinuousDamageHealth` declares no `SupportChance`,
so the mod's `Throwing.Chance` reaches an effect that never rolls it:
the fire takes on every hit that lands. Kept.

## Method by method

| IL | method | home |
|---|---|---|
| 0x411c / 0x41c3-0x4236 / 0x423c | `.ctor`, the messages, the frame clock | `handheldTorches.js` `MESSAGES`, `ANIMATION_TIME`, `createHandheldTorches` `w` |
| 0x608 / 0x7d1-0x895 | `Awake`: the clips, `RegisterCustomActivation` x6 at 3.2 | `CLIPS`; `droppedTorches.js` `targets()` / `activate()` |
| 0xa44-0x1024 / 0x40d0 | `LoadSettings`, `SetKeyFromText` | `readTorchSettings`, `keyCodes.js` |
| 0x1034 | `InitializeTextures` | `loadTextures` |
| 0x114c / 0x11e4 | `OnGUI`, `GetSpriteRect` | `draw`, `getSpriteRect` |
| 0x13b0 | `Update` (the loop, the edges, the hand law, the frames, the keys) | `update` |
| 0x1bec | `DrawTrajectory` | `drawTrajectory` |
| 0x1e74 | `LateUpdate` (the flags, the placements, Bob, Inertia) | `lateUpdate` |
| 0x251 / 0x266 / 0x27d | `HasFreeHand`, `GetFreeHand`, `offsetSpeedLive` | the three closures |
| 0x26b8 / 0x2794 / 0x2950 / 0x2aa8 | `RefreshSprite`, `SetGuard`, `SetAttack`, `SetSheathe` | the four functions |
| 0x2c44 | `UpdateFreeHand` | `updateFreeHand` |
| 0x2fa8 / 0x3150 / 0x3238 / 0x32b8 / 0x33b8 | `DropLightSource`, `ThrowLightSource`, `ThrowLightSourceAction`, `DropLightSourceAction`, `ToggleLightSourceAction` | the five functions |
| 0x3724 / 0x39dc | `SpawnLightSource`, `SpawnLightSourceProjectile` | `droppedTorches.js` `spawnLightSource`, `spawnLightSourceProjectile` |
| 0x3be4 / 0x3d18 | `PickUpLightSource`, `PickupLightSource` | `activate`, `pickupLightSource`; the pack half `receivePickedUp` |
| 0x3fac / 0x403c | `CleanUpLightSources`, `DestroyLightSources` and the transition hooks | `tick`'s death sweep, `destroyAll` |
| 0x19f4-0x1bdc / 0x318 / 0x388 | the burn, `OnRestWindowOpen / Close` | `tick` (the world-minute law) |
| 0x4c16-0x4d18 | `HandheldTorchesSaveData`, `GetSaveData / RestoreSaveData` | `snapshot`, `restore` |
| 0x4688 / 0x47a4 | `Projectile.Initialize`, `FixedUpdate` | `spawnLightSourceProjectile`, `stepProjectile` |
| 0x4370-0x4555 | `EnemyLight` (the effect, `AddState`, the light) | `igniteFoe`, `foeBurning`, `lights()` |
| 0x4588-0x4667 | `EnemyParticleEmitter` (`DoPuff`) | `tickFlames` |

## What is deliberately not carried

- **The cross-mod seams.** Vanilla Combat Event Handler's
  `onToggleOffset` (isInThirdPerson stays the rig's word); Bloodfall's
  GUID gating the foe light; Custom Tooltips' `RegisterCustomTooltip`
  naming the dropped torches (the port's own plaque names them);
  First-Person Lighting's `FPSWeapon.Tint` (drawn white).
- **The mod's `hasFreeHand` / `getFreeHand` MessageReceiver** - no mod
  asks.
- **`Light.intensity`'s flicker** on a dropped torch (`1.25 + sin(2t) x
  0.1`): the port's point lights have range, no intensity
  (`playerTorch.js` records the same for the player torch); the range
  law by the time left IS kept.
- **`EmissionShadows`**: the renderer's point lights cast none; the key
  is on the pane and inert, its description says so.
- **The `Throwing.Chance` roll**: not the port's omission - DFU's
  effect declares no chance (above).
- **The `ThrowLightSourceAction` lit arm** is unreachable from the key
  (above) - kept as the mod has it, not "fixed".
- **The throw's ARC** (`DrawTrajectory`, 0x1bec). The mod feeds its 300
  integration steps to a `LineRenderer`; this renderer has no
  world-space line - `drawMeshWire` wants a mesh's own edge buffer, and
  the only other `gl.LINES` is the 2D world map's - so there is nothing
  to draw it with. The law is kept whole and pinned as the exported
  `throwArcPoints` (the arc must match the flight the pool integrates),
  it is NOT run per frame, and `Throwing.ShowTrajectory` says on the
  pane that it is DFU-only (AUDIT 66 F9).
- **`PlayerTorchLightScale` on a dropped light's range** (0x1bb3): this
  port holds that setting inert for a radius by its own decision
  (`playerTorch.js` - "mapping a brightness slider onto a radius would
  be a worse lie"), and the dropped lights follow the same law. One
  decision, one place (AUDIT 66 F10).

## The textures, and the doctrine

The port's doctrine (`01-Overview/Port-Doctrine.md`) keeps ARENA2 and
every render of it out of the repository - Seasons' and Weapon Widget's
repaints are re-shaded classic sprites and stay with the player's copy
of those mods. Handheld Torches' 39 images are not that: no ARENA2 file
shows a hand holding a torch or a torch lying on a floor; they are the
author's own pixel art in Daggerfall's idiom - the mod's data the way
Dynamic Skies' textures and Windmills of Daggerfall's models are those
authors', vendored with the author's permission (the README's line),
credited on the About screen, decoded from the `.dfmod` AssetBundle
(Unity's import of each file, what the player sees). The sprite and the
dropped lights load them by URL and decode them in the browser into the
port's color32 order.

## The settings

The eight sections as shipped, every key under the vendor key
`handheld-torches`, section and name joined with a dot, the port's
`Enabled` in front. Three kinds were new to the Mods pane for it:
**TextKey** (a Unity KeyCode name - the pane's button captures the next
key and stores its name as `keyCodeForDomCode` spells it, refusing a key
Unity has no member for, Escape cancelling) and the two **Tuple** kinds
(`Throwing.Magnitude` an int pair, `Presentation.Offset` a float pair -
two steppers, coerced as a pair: ints truncated, floats to a thousandth,
anything else the default). `LoadSettings`' multipliers are the mod's
(Presentation.Speed x2000, Bob.Length /100, SizeX/Y x2, SpeedMove x4,
SpeedState x500, Shape x0.5, Inertia.Scale/Speed x500,
ForwardDepth/ForwardSpeed x0.2); a zero `TextureScaleFactor` is floored
at 1 (it would divide the sprite by nothing). Every switch is read every
frame - "Takes effect at once."

## Hosts and seams

- `combat/weaponRig.js`: `createHandheldTorches({ audio, say,
  torches })` beside the widget; `handheldOn()`; the pool bound to the
  component once (`setOnPickedUp`); the frame `tctx` (the machine, the
  sheathe, the hand, the cast, the third person, the climb, the swim,
  the lycanthrope, the motion, the look, the camera thunk with forward /
  right / up, the collider, the raw keys, the sheathe door); the draw
  seam - the Morrowind arms return first, the torch hand under the
  weapon, the widget's clone, the classic sprite.
- `scenes/world.js`, `scenes/exterior.js`: the pool after the hit
  effects; the rig's `keyDown` and `torches`; the camera thunk with
  `feet` and `climbing`; the lights spread into `withPlayerLights` on
  both branches; the activation ray's torch arm (nearest wins against
  the loot pile and the drop, the 3.2 reach, the interaction mode)
  wrapping the original ladder; `destroyAll` on a mode change; the
  world host's pixel sweep, recenter, save envelope and F9 envelope in
  world coordinates.
- `scenes/worldModes.js`: `interiorTorches` for the interior mode
  (lights, batches, targets, the `droppedTorch:` arm, `destroyAll`
  after `host.unlockOn?.()` on the way in and again on the way out, the
  scene cache), and the dungeon arm's `torchLights()` / `torchBatches()`
  / `takeLoot(key, getInteractionMode())`.
- `scenes/dungeonContext.js`: the pool with the block's water plane
  under the player's feet, the HUD text channel, `takeLoot`'s
  `droppedTorch` arm, `collectWorld` / `applyWorld` with the save data
  and `sharedWorld` dropping it (nothing of the player's own), exported
  for `scenes/dungeon.js`'s lights, draw pass and loot ladder.
- **Lifetimes (AUDIT 66 F4-F8, F11, F12).** The component is the rig's
  and ends with it: `weaponRig.dispose()` frees the burning loop and
  hands PlayerTorch its offset back, and the switch falling to off is a
  teardown too (update runs only while it is on). Each pool ends with
  its host - the interior's on the transition ABOVE its own scene
  restore, on the way out, and on the quest-teleport / load exit; the
  dungeon's in `dungeonContext.destroy()` beside the foes' batches and
  the wall torches' loops; the exteriors' at the mode branch above the
  modal return, because a transition is an event, not a chore at the
  foot of a frame the indoor modes never reach.
- `systems/playerTorch.js`: `setPlayerTorchOffsetOverride`;
  `systems/lycanthropy.js`: `isTransformedLycanthrope`;
  `systems/features.js`: the Mod Authored row; `ui/credits.js`: the
  credit; `ui/enhancedMenu.js`: the key capture and the pair steppers.

## Does Morrowind have its own torch model?

Yes. Morrowind's carriable lights are LIGH records with a mesh -
`Light_Torch_01`, the candles and the lanterns under `meshes\l\` - held
in the left hand by the `torch` animation group in `base_anim.nif`
(the group the port's `formats/mwAnim.js` lists). The port's Morrowind
arms lane (`formats/mwFirstPerson.js`) answers None for a torch today:
it draws no held light, and this port draws no classic hand under the
modelled arms either (the rig's draw seam returns at the arms - a
pixel hand beside a modelled arm is neither the mod nor the lane). So
under the Morrowind first-person view the mod's hand law, keys, dropped
torches, throws and foe fire all run and the player torch's light moves
with the flip; the visible held torch is the classic lane's. A held
Morrowind light mesh in the arms' left hand - the LIGH model on the
`torch` group - is the lane's own design work, not the mod's, and pends
Mac's word.

**MW-D51 (2026-09-16) - Mac's word came: "Morrowind model needs a torch
to hold when a torch is equipped."** The lane now holds it: the LIGH
record's mesh at the Shield Bone of both rigs, the `torch` group on
the left arm's blend mask, off the same `PlayerEntity.LightSource` read
this mod's hand law writes (weaponRig hands it to the arm per frame
beside the weapon). The record is in Morrowind-Rules.md's MW-D51. This
mod's own art stays the classic lane's; under the Morrowind view the
mod's hand law, keys, drops and throws run unchanged and the modelled
torch is what they light and stow.

## HT5 - THE TORCH HAND STOOD STILL BESIDE A SWAYING WEAPON (2026-09-16)

Mac: "the torch when being held isn't affected by the weapon bob like
everything else."

The mod's three motion modules - Bob, Inertia, Step - restate Weapon
Widget's laws so the torch hand can move WITH the weapon, and the mod
ships all three OFF: it leaves matching them to whatever the widget
has on to the player (its Bob.Offset says so: "For use with weapon
bob"). This port ships Weapon Widget with Bob ON - the widget's own
shipped default - so the two mods disagreed about one walk: the
weapon swayed, the hand holding the torch did not. The classic weapon
and the torch hand are two OnGUIs with two positions (the rig draws
the hand first, then the weapon over it), so the widget's bob never
reached the hand by any other road.

`Modules.Bob` ships ON for this mod now - the THIRD departure from
its shipped keys, after HT4's Tab and SOC5's F, stated in the port's
table beside the other two. Inertia and Step stay off, as the widget
ships them; the player may still turn any of the three either way.
The mod's own file is untouched.

Pin: `test/ht1_handheldtorches.test.js` HT5 - every motion module
the two mods share ships with the SAME default, Bob's is on, the mod's
file still says off, and the bench walks with Bob on and the hand
moves off its rest; the three HT1 pins that encoded "the other three
ship off" re-pinned.

## TEX1 - THE SPRITE DOOR'S SHAPE, AND MAC'S CRASH (2026-09-14)

Mac's page died on daggerfalljs.dev the day HT1 shipped:

```
CRASH / unhandled rejection
TypeError: can't access property "buffer", l is undefined
  k@renderer.js (asBytes) <- uploadTexture <- .../weaponRig-*.js
```

**It was this mod.** The third frame reads `Ii/ue/e.texturesLoading`, a
name no source file in the tree carries - it is in the SHIPPED bundle,
because minification keeps property names: `w.texturesLoading` here, with
the `ht:` upload key beside it in the same minified function. (Both mods
ride the weaponRig chunk, which is why the file name pointed at the
widget.)

**The fault.** `defaultLoadSprite` converted with `toColor32Order`, which
answers the port's bottom-up ORDER in a decoded PNG's `{ width, height,
data }`, and `InitializeTextures` handed that straight to
`renderer.uploadTexture`, which reads `color32.colors`. Undefined, so
`asBytes` died on `.buffer`. The door takes `toColor32` now - the same
conversion in the shape the upload path reads - and the documented
contract on `loadSprite` says `colors`, which is what it always meant.

**Why it killed the page rather than the sprite.** Nothing awaits
`w.texturesLoading`: the load is fired and left, so the throw inside it
became an UNHANDLED REJECTION, which `main.js` turns into the crash
overlay. It carries its own `catch` now and fails to a console line; the
mod then runs without its sprite, exactly as it does when the files are
missing. `scenes/droppedTorches.js` had the same two faults - the same
door shape, and a load promise only `.then`ed by a mount that may never
come - and now guards its upload loop, recording an empty record that
`build` already no-ops on.

**The class, closed.** Four doors had walked into the same trap (see the
Ledger's TEX1 row). Every texture door in the tree converts with
`toColor32` at the door now, no module under `src/` imports
`toColor32Order` at all, and `test/tex1_texturedoors.test.js` pins that -
so a fifth door cannot be written wrong. The pin also EXECUTES this
crash: the real component, the real `Renderer.uploadTexture` on a gl
stub, the old shape proved unable to reject.

**Why HT1's own pins missed it.** They drive the component through a
fake renderer whose `uploadTexture` accepts anything, and a fake
`loadSprite` that answered `{ width, height, data: null }` - the wrong
shape, taught by the rig. The fake now answers `colors`, and TEX1's pin
runs the real renderer.

## HT2 - LIGHTING ONE FROM THE PACK (2026-09-14)

Mac, the same evening the sprite door was fixed: *"So you cant equip
the torch in your offhand, you can only drop it on the ground"*.

**Not the mod.** The mod puts a lit light in a free hand; it never gets
one to put there unless something sets `entity.lightSource`. The three
ways into that slot are the toggle key (`Handling.ToggleLightInput`,
`F` by default), a pickup under OnPick, and the INVENTORY - and the
inventory is the one Mac had. The enhanced pack, which is the default
skin and the only one online, had no act that lights a light source:
its primary button was `Wear`, and no light source has an equip slot,
so it answered "cannot be worn." - and the only act beside it that
named the torch honestly was Drop. (The generic `Use` button did light
it; nothing on the card said that, and a player told a torch cannot be
worn has been told there is no place for it.) The mod's own drop key
answers the same way, which is why the report reads as one behaviour.

**The cure** is the pack's, not this mod's, and is written up in
`bible/10-UI/UI-Arc.md`'s HT2 section: the card's primary act on a
light source is `Light` (or `Douse` for the one already lit), and it
performs DFU's own equip-click arm - `UseItem(item)` with no
collection. With the light lit, this mod does what it always did: the
hand law takes it, the sprite draws, `PlayerTorch` follows the hand.

**Worth keeping in mind for the next report of this shape:** with
`Handling.OnStow` at its default (Drop), a lit light whose hands both
fill IS dropped on the ground - a shield in the left and a weapon in
the right leaves no free hand, and the mod drops rather than stows.
That is the mod's law, 1:1, not a bug.

## HT2-AUDIT - A LIT TORCH IS INVISIBLE BY DEFAULT, AND BOTH DEFAULTS ARE FAITHFUL (2026-09-14)

Mac, after HT2 shipped: *"Audit this to ensure youre not just guessing
and this actually works"*. The pack's act was proved in a browser
(`tools/ht2TorchProbe.mjs`); this is the OTHER half of the same
question, and it found something the pack fix does not answer.

`tools/ht1HandProbe.mjs` lights a torch through the pack's card and
then mounts this component on a REAL `Renderer` over a real WebGL2
context, letting it fetch and decode its own vendored PNGs. What it
measures, settled:

- all EIGHT sprites load, decode and upload - four torch frames and
  four lantern frames, a 90x205 GL texture, and NOT ONE console line
  (so TEX1's door holds against the real files, not a stub);
- `hasFreeHand` is true with empty hands, the lit torch is the
  entity's `lightSource`;
- `draw()` returns **false**, and the torch is nowhere on screen.

**Why.** `Modules.Sprite` is `false`. That is not a port slip - the
shipped `modsettings.json` carries `Sprite = False`, so the mod itself
ships its first-person hand switched off, and the port is 1:1. With
the module on, the same probe draws: `draw()` true, the rect settling
at x 88, y 186, 144x328 on a 640x400 canvas - bottom left, on screen,
where SetGuard puts it. (A rect read before the rest smoothing settles
is part off-screen, which is `moveTowards` mid-flight and not a
layout fault; the probe runs 240 frames for that reason.)

**And the light is a second switch.** `tickPlayerTorch` is gated on
`Enhancements/PlayerTorchFromItems`, which DFU's own `defaults.ini`
ships `False` - so a stock player who lights a torch gets no hand AND
no light. Nothing is broken; two faithful defaults simply add up to an
invisible act.

Both are reachable in the port: `Modules.Sprite` on the Mods pane
under Handheld Torches, `PlayerTorchFromItems` in Settings as "Torches
Light Your Way". Whether the port should DEPART from either default -
this mod's whole point is a torch you can see in your hand - is a
decision for Mac and a Ledger A row if taken, not something an audit
takes on its own.

## MODS-ON - THE HAND AND THE LIGHT ARE ON NOW (2026-09-14)

Mac, on the audit above: *"Yes all mods should be on by default"*.

Both switches the audit named are the port's own default now, and only
those two: `Modules.Sprite` true on the Mods pane, and
`Enhancements/PlayerTorchFromItems` 'True' through
`settings.js`'s `PORT_DEFAULTS` - a layer laid OVER the generated
defaults table, never edited into it, because that table is generated
from DFU's shipped ini and pinned against it. A player's own override
still wins over both, and setting a value back to the port's default
drops the override exactly as before.

`Bob`, `Inertia` and `Step` stay off as the bundle ships them: they are
presentation, and the sprite is the subject. Ledger row MODS-ON.

## HT3 - THE SPRITE WAS UPSIDE DOWN (2026-09-15)

Mac: *"The player held torch mod shows the sprite upside down when
held"*. It was: the flame under the hand.

**The port has TWO right answers and the door took the wrong one.**
`toColor32` is a FLIP. It is right for a Unity texture, because Unity
stores its rows bottom-up - flipped, row 0 becomes the picture's top.
It is wrong for a decoded PNG, whose row 0 already IS the top.

Which one a sprite wants depends on WHERE IT IS DRAWN. A world
billboard samples v with 0 at the bottom, so it wants the port's
bottom-up color32 order. A SCREEN QUAD does not: `drawScreenQuad`
places its rect in top-left pixels and gives p.y = 0 - the rect's top -
the source rect's `v0`, and `UNPACK_FLIP_Y_WEBGL` is false at every
upload, so row 0 of `colors` lands at the TOP of the sprite.

The held torch is a screen quad fed from a vendored PNG, so the flip
turned it over. `toScreenOrder` is the same shape without the flip, and
the torch takes it.

**The weapon widget's loose-PNG arm had the identical fault** and had
never been seen, because in play the widget takes its BUNDLE arm - a
Unity texture, where the flip is right. Both screen doors take
`toScreenOrder` now; the world doors (dropped torches, seasons, M-TEX)
are untouched and still flip.

Why TEX1 did not catch it: TEX1 was about the SHAPE - that a door hands
back `colors` and not a decoded PNG's `data` - and it closed that
class properly. Which way up the rows go is a different question, and
the only door where it was visible had never drawn a frame, because
`Modules.Sprite` shipped off until MODS-ON turned it on.

Pinned: `test/ht3_sprite_upright.test.js` (3) - the two orders executed
against a five-row raster, which door takes which, and the screen-quad
convention read at its own source.

## HT4 - TAB BELONGED TO THE PORT ALREADY (2026-09-15)

Mac: *"Pressing tab drops torches, tab is reserved for the menu"*.

Handheld Torches ships `Handling.ManualDropInput = "Tab"`, and in
Daggerfall Unity that is a free key, so the mod was right. It is not
free here. PX15 gave Tab to the port's own **pixel dial** - the radial
menu, which DFU has not got and which the mod therefore could not have
known about - so the mod's shipped default landed on a key this port had
already spent, and one press both opened the dial and dropped the light.

The default is **G** now: unbound in DFU's own `DEFAULT_BINDINGS`, and
not one of the mod's other two keys (F to ignite, X to throw). It stays
the player's to rebind, and the departure is declared in
`test/ht1_handheldtorches.test.js`'s own `PORT_DEFAULT` table beside
MODS-ON's, so every other key of the bundle is still held to the shipped
value and a third departure that arrives without a decision behind it
fails right there.

**The pin is the class, not the key.** It walks every `TextKey` default
of every vendored mod against DFU's bindings AND the keys the port
spends on top of them, and it reads the dial's arm out of `ui/input.js`
rather than restating it, so renaming that arm fails here instead of
drifting. The next mod folded in cannot repeat this quietly - which
matters, because the collision was invisible from either side alone: the
mod's default is correct against DFU, and the port's dial is correct
against the mod.

## HT5 + INV1 - THE LIGHT IS ON THE BODY, AND THE PACK DRAGS (2026-09-15)

Mac: *"Morrowind model doesnt hold a torch and the torch doesnt appear
slotted in inventory. Additionally. Add the ability to click and drag
items to equip or reorganize in inventory"*.

### The held light is a row

A light source has **no equip slot**. `getEquipSlot` answers None for
all four (they are UselessItems2 and ReligiousItems, not Weapons or
Armor), which is why HT2 had to make the act a USE rather than a wear.
So the lit torch lived only in `entity.lightSource`, and the worn side
of the pack had nothing to show: the list painted it gold and that was
all, so a player holding a torch saw an empty pair of hands.

It is a row on the body now, under the off hand and listed first there,
because Handheld Torches' own fiction is that a light **occupies a
hand** - with no free hand the mod stows the LIGHT (`updateFreeHand` reports the hands; the hand law unequips or drops the torch).

It carries a **sentinel slot** (`LIGHT_SLOT`) rather than an invented
`EQUIP_SLOTS` member. It is `-1`, which is *exactly* `EQUIP_SLOTS.None` -
so "negative, therefore safe" was wrong, and the safety comes from
nothing here indexing the equip table with it, not from the number, and `filled`/`total` still walk the real
equip table. DFU's twenty-seven stay twenty-seven; nothing that counts
slots learns about this one. The act is unchanged - picking the row
offers Douse, because `localPrimaryAct` already answers that and
`takeOff` is gated on a kind a light source never returns.

### The drag performs the act the card already offers

`dropOnBody` reads `localPrimaryAct` - the same function the act button
reads - so a dragged torch **lights** and a dragged cuirass is **worn**,
and a refusal (broken, class-forbidden) says the same sentence either
way. A second rule for what a drop means is how two paths drift apart.

**A loot row does not drag.** Taking from a pile is a click (IG7), and a
drag that could also transfer would turn a slip into a theft. Only the
local side is a source.

Reordering moves the item inside `entity.items`, which is what every
page filter reads - so the order a player arranges is the order every
tab shows and the save carries.

Three affordances, because a drag with no feedback is a guess: the
carried row goes quiet, the row it would land before takes a line above
it, and the body outlines its whole frame - the map is one target, not
twelve.

### Still open: the Morrowind arms

The modelled arms do **not** hold the torch, and that is unchanged here.
`weaponRig.js` draws the arms and returns before the torch hand on
purpose - "a classic hand beside a modelled arm is neither mod nor
lane". Giving them a real one means attaching a torch mesh to a hand
bone, and the port reads WEAP, ARMO and CLOT records but not **LIGH**:
lights are a record kind it has never needed. That is a slice of its
own, the size of the original weapon work, and it is not started.

## 3ARMS + TORCH-BIND - THREE ARMS ON SCREEN, AND THE KEYS NOBODY COULD REBIND (2026-09-22, Discord bug-reports through Mac)

Ignatious: "Torch and a Two-Handed weapon simultaneously" - a lit torch in the left hand beside a two-armed
two-hander sprite. teuton: "No option to rebind Handheld Torches actions".

**3ARMS.** The IL's `GetItemHands() == 2` is `ItemHands.Both` in DFU's own enum (the quirk paragraph above, struck).
`updateFreeHand` reads the mod's law now, from its published source (HandheldTorches.cs:1296-1340): a Both-handed
item or a bow in the LEFT slot takes the right hand; an empty left hand you are punching with (`!UsingRightHand`,
:1315) is in use, the arm the port had missed beside the bare right's (0x2d53); a two-hander in the RIGHT slot takes
the off hand - always under strict, and for a bow or while a swing is in flight under `RelaxedTwoHandedWeapons`
(:1325-1332; `attacking` is the machine off Idle, as the port already read it). HT7's departure stands: what is
worn takes a hand sheathed or drawn, so "both hands free" is the sheathed stance with nothing worn. Weapon Widget's
`mirrorOverride` (FPSWeaponClone.cs:2378, the same `== ItemHands.Both`) compares to Both too, so the three
`Miscellaneous.MirrorTwoHanded*` switches do what they say.

**The FOURTH departure from the mod's shipped keys:** `Handling.RelaxedTwoHandedWeapons` ships OFF (the mod: on).
Relaxed, the mod shows the torch hand beside a RESTING two-hander - three arms with the classic sprites, in DFU too -
and stows it only for the swing; HT7 already decided that a held weapon is held, so a held two-hander takes both
hands and the light stows (remembered, re-lit when the weapon comes off) until the player flips the switch, which
the tile drawer offers now. Existing players get the new default: the mod store persists only what a player set.

**TORCH-BIND.** The three TextKeys (`Handling.ToggleLightInput`, `Handling.ManualDropInput`,
`Throwing.ThrowTorchInput`) are the mod's own key store, read raw by the hosts (`keyDown`), never registry actions
(QS4's reasoning stands: `QuickOffHand` is the registry's door to the toggle). The Mods pane that captured them went
with FT14, and its replacement - the tile drawer - draws only `MOD_CURATED`, which named none of them: the capture
row existed, the persistence existed, nothing drew it. Curated now, with the relaxed switch; and the same class
closed for Eye Of The Beholder's `Camera.SwitchShoulder` / `AutoTogglePerspective.ToggleInput` and Travel Options'
`RoadsIntegration.FollowPathsCustomKeyBind`, the other TextKeys a module reads. The Controls page's Continue - the
half of the report that was not a bug, "if you scroll up after rebinding, there should be a Continue" - is in
UI-Arc.md's DISCORD5 record.

Pins: `test/ht1_handheldtorches.test.js` (the hand table under the mod's law - strict, relaxed at rest, relaxed in a
swing, the punching left hand, both-free-only-sheathed; the fourth departure in the defaults table),
`test/audit66_handheldtorches.test.js` (the punching hand), `test/ww1_weaponwidget.test.js` (a claymore mirrors
under its switch), `test/discord5.test.js` (both compares by source, the relaxed default, every read TextKey in its
tile). `tools/mutants/discord5.json`: 20 records, 20 dead. Not verified in a browser.

## DISC7 - THE LOOP FOLLOWS THE LIGHT (2026-09-23, Mac: "fix the known gaps")

A torch stowed from inside an open inventory kept crackling until the window closed: the component starts and stops
its loop in its update, and a host holds the rig's frame under a window. The light in hand has one door now
(`systems/lightSource.js setLightSource`, every writer through it) and the component listens: a light that stops being
a torch stops the loop on the change. Record: `01-Overview/Field-Bugs-2026-09-23.md` (DISC7).
