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

**The `== LeftOnly` quirk.** IL 0x2d1a compares the right slot's
`GetItemHands()` to 2 (LeftOnly). A two-hander answers Both (4), so the
`RelaxedTwoHandedWeapons` arm - the off-hand taken only while attacking
- fires on nothing a right hand holds: a claymore in the right leaves
the left free, relaxed or not, and the relaxed switch changes nothing.
Weapon Widget's mirror overrides have the same compare (WW1 records
it). Kept exactly; the port's `ITEM_HANDS` table (None 0, RightOnly 1,
LeftOnly 2, Either 3, Both 4) is the word - the DFU enum's declaration
could not be fetched this session, and `GetItemHands` answers Both for
the two-handers and LeftOnly for shields as the port's `equip.js` has
it.

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
full burn) x PlayerTorchLightScale`, half a unit up), a 3D burning loop
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
a transition, and the pool is destroyed on it).

The projectile (`Initialize` 0x4688, `FixedUpdate` 0x47a4): from the
free hand's side (0.35 off the camera's right, signed by the hand), the
look tilted up by `ThrowAngleOffset` about the right and scattered by
`Random.Range(-1, 1) x ThrowDispersion` about the right and the up,
speed `25 x STR / 100 x ThrowStrength x wind-up`; Unity's 0.02 s step
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
