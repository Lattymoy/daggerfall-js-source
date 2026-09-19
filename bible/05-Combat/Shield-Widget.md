# Shield Widget - the mod, 1:1 (SW1, 2026-09-19)

Mac: *"This is the next mod I want to integrate 1:1"* - handing over
`Shield_Widget-733-1-6-17668108721.zip`.

**Shield Widget 1.6** for Daggerfall Unity 1.1.1, by
**RedRoryOTheGlen** (Nexus mod 733). Its own description: "Adds a
configurable shield sprite to first-person camera when your character
has one equipped."

It is the sibling of **WW1** (`Weapon-Widget.md`) - the same author, the
same DFU, the same module names and very nearly the same arithmetic. One
thing separates them, and it decides everything else in this page:

> The weapon mod CLONED something DFU already draws and hid the
> original. **This one draws something the game has never had.** Classic
> Daggerfall renders no shield in the first-person view at all. So there
> is nothing to replace, nothing to hide, and - when the mod's own
> sprites are absent - nothing to fall back to.

Its data is vendored under `vendor/shield-widget/` (the manifest, the
settings, the presets, a README with the provenance), it is credited on
the About screen, and it is ported as `src/combat/shieldWidget.js` (the
component) and `src/combat/shieldWidgetAssets.js` (the sprite door).

## The source the port reads

The shipped `shield widget.dfmod` is a UnityFS bundle (Unity
2019.4.41f2): a compiled `Shield Widget.dll` (24,574 bytes), 600
textures, the settings, the presets and the manifest. The
`ShieldWidget.cs` the manifest names is **not** in the bundle.

So the DLL was read as the sibling's was - method by method off the IL,
with a disassembler written against `dnfile` for the purpose. 46 methods
across the one `ShieldWidget : MonoBehaviour` and its two coroutine
state machines. IL offsets in `shieldWidget.js` and in the table below
cite that reading.

## The sprites, and what a record means

600 PNGs, and their shape is the mod's cleverest part:

| | |
| --- | --- |
| **archive** | 112360 Buckler, 112361 Round, 112362 Kite, 112363 Tower |
| **record** | a MATERIAL GROUP (0..9) plus a CONDITION TIER (+0, +10, +20) |
| **frame** | 0..4 - the raise and lower, for the Animation module |

`index = (archive - 112360) * 150 + record * 5 + frame`, which is the
flat walk `InitializeShieldTextures` builds (IL 0x10-0x70).

The ten material groups are Leather/Chain, Iron, Steel, Elven, Dwarven,
Mithril, Adamantium, Ebony, Orcish, Daedric - **and Silver, which the
author's own `switch` sends to group 0 with leather and chain** (IL
0x5c, case 514). A silver shield really does draw the leather art in
this mod; it is kept.

The three condition tiers are what make the shield visibly batter as it
wears: at or below `ConditionThresholdLower` the battered art, at or
below `ConditionThresholdUpper` the worn art, else the pristine. The
crossing is watched live by `HitShield`, so a shield degrades *in the
fight*, not only when it is re-equipped.

## Method by method

| ShieldWidget (IL) | Home in `shieldWidget.js` | Notes |
| --- | --- | --- |
| `.ctor` (0x00) | `createShieldWidget` - the `w` fields | The resting values. `conditionThresholdUpper/Lower` open at 60/30 here and the settings overwrite them with 75/25 on the first load. |
| `Init` (0x00) | - | Unity plumbing: the mod object, and a `GameObject` carrying the component. Nothing to carry. |
| `Awake` (0x00-0x141) | the `started` / `awoke` latches in `lateUpdate` | The settings callback, the singleton, the audio source, the screen rect, `InitializeShieldTextures`, `RefreshShield`, `shieldPositionCurrent = shieldPositionTarget`, the handedness flip and its mirrored `curAnimRect`, `IsReady`. The port has no Awake, so the two parts that matter - the opening stance and the flip - land on the first frame that knows both a screen rect and a shield. |
| `Start` / `ModCompatibilityChecking` (0x00-0xae) | `setThirdPerson`, `onAttackDamageCalculated` | Three GUIDs. Two are in the port and are carried; the third is not - see below. |
| `LoadSettings` (0x00-0x409) | `readShieldWidgetSettings` | The multipliers kept: Shield.Speed x5000, Bob.Length /100, SizeX/Y x2, SpeedMove x4, SpeedState x500, Shape x0.5, Inertia.Scale/Speed x500, ForwardDepth/ForwardSpeed x0.2, Recoil.Scale x2, Recoil.Speed x0.5, TextureScaleFactor floored at 1. **Animation.Speed is INVERTED**: `animationTime = 1 - v * 0.5`, so a bigger number is a shorter animation. Re-read every frame (the port's settings are live). |
| `get_offsetSpeedLive` (0x00) | `offsetSpeedLive` | `LiveSpeed / 100 * offsetSpeed`. |
| `get_animationTimeLive` (0x00) | `animationTimeLive` | `animationTime / (LiveSpeed / 50)` - a faster character raises the shield faster. |
| `InitializeShieldTextures` (0x00-0x80) | `shieldTextureName`, the assets door | The 600-slot walk. In the port the sheet is not loaded up front: the door answers by index, and `primeShieldWidgetSizes` reads every size out of the open bundle in one pass so the rect maths can measure before a pixel is uploaded. |
| `UpdateShieldTextures` (0x00-0x117) | `updateShieldTextures`, `shieldTextureIndex` | The template base, the material group, the condition tier. Its `Debug.Log("Updating shield textures")` is not carried. |
| `GetShieldRect` (0x00-0x239) | `getShieldRect` | Position, then Scale grown from the rect's own size, then centred, then Offset in the rect's size; the y clamped into the band above the large HUD; with Animation on, the x clamped to the screen edge it slides from; then the Step snap on `stepLength * screenH / 64` with Mathf.Round's half-to-even. |
| `RefreshShield` (0x00) | `refreshShield` | Sheathed or mid-swing is the away pose, anything else the guard. |
| `SetGuard` (0x00-0x3b4) | `setGuard` | The resting pose at the player's own offsets. **The DLL writes the rect four times** (animated/not x flipped/not) and all four expressions are identical; only the frame reset and the x term differ, so the port writes it once. |
| `SetAttack` (0x00-0x560) | `setAttack` | Where the shield goes when it is out of the way. With Animation on it plays out to frame 4 and holds the READY rect (the same one `SetGuard` builds); without it, the Corner or Off-screen rect for whichever reason is active, in the DLL's own order - sheathed, then casting, then attacking. Mode 0 (Hide) sets no rect at all; `OnGUI`'s gate is what hides it. |
| `SetBlock` (0x00-0x3ac) | `setBlock` | The guard rect with `offsetX` forced to 1 and `offsetY` to 0.8 - the shield comes up in front of the eyes whatever the player set. **Kept bug for bug: see below.** |
| `<BlockCoroutine>d__110` | `blockCoroutine` | Raise into the block, wait for the ease to arrive, take the kick and ring, hold half a second, fall back to the frame's stance. |
| `<AnimateShield>d__111` | `animateShield` | Step `frameCurrent` from start to end a fifth of `animationTimeLive` at a time, repointing the sprite each step. The DLL reads `Time.unscaledTime` here and **discards it** - a leftover with no effect, not carried. |
| `HitShield` (0x00-0x293) | `hitShield` | The kick (by the six conditions: a hit needs `damage > 0`, a miss `damage < 1`, an attack neither), through `BlockCoroutine` when Recoil.Offset is on and the player is not mid-swing, else straight onto `recoilCurrent` with the parry ring. Then the condition watch: a DOWNWARD crossing of either threshold repoints the sheet. |
| `PlayImpactSound` (0x00) | `playImpactSound` | `SoundClips.Parry1 + Random.Range(0, 9)` - 428..436 - at volume 0, pitch 1.1. The volume really is 0 in the IL. |
| `IsPartShielded` (0x00) | `isPartShielded` | The mod's loop over `GetShieldProtectedBodyParts`, which is already the port's (`combat/enemyEquipment.js`). |
| `GetShieldAnimationGroup` (0x00) | `shieldAnimationGroup` | `ShieldHand_` for the Buckler, `ShieldArm_` for the other three, `Unarmed_` for nothing. Only the FPS-models seam calls it, so nothing calls it here - kept because the day that mod lands, this is the row it needs. |
| `OnAttackDamageCalculated` (0x00-0x68) | `onAttackDamageCalculated` | PCAAO's message. The player's left-hand item must be a shield; conditions 0-2 additionally ask whether the shield covers the part that was struck, 3-5 do not. |
| `LateUpdate` (0x00-0x95d) | `lateUpdate` | In the IL's order: the three channels zeroed, the gates, the screen rect and the large HUD's height (a change in either refreshes), the template key, the attack / casting / sheathed states each with their own pose and the tenth-of-a-second tail on the attack, the ease at the live offset speed, then Bob, Inertia and Recoil. |
| `OnGUI` (0x00-0x1c2) | `drawRect` / `draw` | The gate ladder, then `DrawTextureWithTexCoords` at the weapon's own tint. |

## Kept bug for bug

- **`SetBlock`'s left-handed slip.** The animated + flipped branch writes
  `shieldPositionCurrent`; the other three write `shieldPositionTarget`
  (IL 0x172 against 0x219, 0x300, 0x3a7). A left-handed player with the
  Animation module on gets a block that SNAPS instead of easing - and
  `BlockCoroutine`, which waits for current to reach target, therefore
  falls straight through its wait. That is the mod's behaviour.
- **Silver draws leather.** `NativeMaterialValue` 514 lands on group 0
  with Leather and Chain (IL 0x5c).
- **The template key is a SUM.** `LateUpdate` (0x1a0) keys the
  sheet-reload on `TemplateIndex + NativeMaterialValue` added together.
  Nothing in four templates and twelve materials collides, so it is
  correct in practice; it is kept as written.
- **`PlayImpactSound` at volume 0.** The IL passes 0 for volume and 1.1
  for pitch. Carried as written.

## What is not carried, and why

**The FPS-models seam.** GUID `41284af0-81c7-4630-bbc5-a976efa162a0`,
the `getAnimator` message, and the arm that plays a `ShieldHand_` /
`ShieldArm_` / `Unarmed_` + `"Recoil"` animator state on a hit and
suppresses the sprite draw entirely (`OnGUI` 0x17b). The port has no
such mod. The arm's condition becomes its own switch the day one is
integrated, as Meaner Monsters' unleveled-mobs arm does.

**Unity's own plumbing.** `Init`'s GameObject, the singleton, `IsReady`,
`Debug.Log` on the texture update and the threshold crossing.

## What IS carried that the sibling could not be

Two cross-mod seams, because the port has both mods:

- **Eye of the Beholder** (`2942ea8c-...`) - `onToggleOffset` sets
  `isInThirdPerson`, and the sprite does not draw in third person.
- **PCAAO** (`fb086c76-...`) - `onAttackDamageCalculated` is the Recoil
  module's whole trigger. The settings pane calls it "Vanilla Combat
  Event Handler"; that is the message's own mod.

## The gate ladder

`OnGUI` refuses to draw for eleven reasons, and the last six are worth
stating because they are not obvious. Each of the three states -
sheathed, attacking, casting - hides the sprite two different ways:

- **without** the Animation module, when that state's pose is `Hide`;
- **with** it, when the pose is `Hide` *or* `Off-screen` AND the slide
  has already finished - `animating` is what keeps the sprite on screen
  while it is leaving.

The sheathed rung additionally yields to the other two, because a
sheathed player who is casting is casting.

## The Morrowind first-person view

The mod publishes three channels - `Position`, `Offset`, `Scale` - and
`armsTransform` hands the first and third to the arms' composite, as
WW1's does. The shield bobs, leans and recoils WITH that view rather
than against it.

## The textures, and the doctrine

600 renders of ARENA2 art. `bible/01-Overview/Port-Doctrine.md`: A
RENDER OF GAME DATA IS GAME DATA. So they are not in this repository;
they reach the game from the player's own copy of the mod, through the
textures pick, read by `combat/shieldWidgetAssets.js` by the names the
mod asks for (`<archive>_<record>-<frame>`). A loose PNG of the same
name answers too, which is what `TryImportTexture` reads in DFU.

**Without the bundle the widget draws nothing**, and that is not a
fallback choice - there is no classic shield art to fall back to. The
sibling can draw the vanilla weapon frame when its repaints are missing;
this one cannot, and does not pretend to.

## The settings

The mod's eight sections (36 keys) are restated flat in
`systems/modSettings.js` under `shield-widget`, section and name joined
with a dot, with the bundle's own defaults, ranges and descriptions. Six
keys ship with no description of their own and carry the port's words
instead. Plus the port's `Enabled` (MO1: on).

## Hosts

`combat/weaponRig.js` owns one, beside the weapon's clone, and drives it
on the same frame from the same assembled answers - Unity handed the
MonoBehaviour the motor, the look and the weapon manager, and so does
the rig.

**The draw seam.** The arms branch returns first (under the Morrowind
arms no classic sprite is drawn, for the reason the torch hand is not);
then the SHIELD, because it is the OFF hand and sits behind both; then
the torch hand; then the weapon. Two OnGUIs with no order between them
in DFU, and this is the order that keeps all three whole.

**The Recoil trigger.** PCAAO's `onAttackDamageCalculated` reaches the
port as a new registration seam in `combat/formulas.js`,
`setAttackOnPlayerHook`, fired at the tail of `calculateAttackDamage`
beside V3's Ring-of-Namira hook. It is deliberately NOT gated on damage
the way V3's is - three of the six Recoil conditions are MISS
conditions - and it carries the struck body part, because three of the
six ask whether the shield covers it.

**The sprites** register at the same two doors Weapon Widget's do
(`scenes/dataSource.js`'s texture pick and `scenes/shared.js`'s boot),
and their sizes are primed in one pass at registration: the widget's
rect maths measures the sprite BEFORE any texture is uploaded, so a
shield with no measured size draws nothing.

## SW1a - THE READ THAT WROTE (found while wiring)

`shieldItem()` first asked the equip table through `equipTableOf`, which
is `entity.equip ??= createEquipTable()` - a materialising read. Asking
it every frame GREW an empty equip table on an entity that had none, and
`syncWorn` two functions up then read that empty table and nulled the
player's weapon. The symptom was the unsheathe going silent:
`PlayerWeapon.toggleSheath` returns "play the draw clip" only for a real
weapon, and by then there was none.

It is read with an optional chain now - the same shape `syncWorn` itself
uses for the right hand - which asks without writing, and a pin holds
both halves.
