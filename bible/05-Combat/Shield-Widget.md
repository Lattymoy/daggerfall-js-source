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
| `PlayImpactSound` (0x00) | `playImpactSound` | `SoundClips.Parry1 + Random.Range(0, 9)` - 428..436 - through `DaggerfallAudioSource.PlayOneShot(sound, spatialBlend, volumeScale)`: the IL's `(clip, 0, 1.1f)` is 2D at volume 1.1, the shape of `FPSWeapon.PlaySwingSound`. The port's `playOneShot` is `(clip, volume, pitch)` and non-positional, so it plays at volume 1.1, pitch 1 (AUDIT 68 S09-shield-impact-silent: the first cut read the 0 as the volume and rang in silence). |
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

## Departures

- **The template key is the PAIR, not the SUM.** `LateUpdate` (0x1a0)
  keys the sheet-reload on `TemplateIndex + NativeMaterialValue` added
  together, and the sum collides: templates 109-112 plus plate
  materials 512-521 share eleven sums (624 is Buckler/Elven, Round/Silver,
  Kite/Steel and Tower/Iron), so a shield equipped straight over one of
  the same sum kept the old art. The port keys on
  `templateIndex * 1024 + nativeMaterialValue` (AUDIT 68
  S09-shield-template-key-collision).

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
they feed the sprite draw alone. Under the Morrowind arms the shield
sprite does not draw (the rig's arm branch returns first), and the arms'
composite takes the WEAPON widget's transform. The shield's own
`armsTransform` had no caller and was removed (AUDIT 68
S09-shield-dead-exports).

## The sprites, and the doctrine - the first cut got this WRONG

The first cut of this port kept the 600 out of the repository and read
them from the player's own copy of the mod, citing
`vendor/weapon-widget/README.md`. Mac: *"huh? .dfmod? This needs to be
integrated directly"* - and he was right.

The doctrine (`bible/01-Overview/Port-Doctrine.md`) is that **A RENDER
OF GAME DATA IS GAME DATA**. Weapon Widget's 173 textures are repaints
of the classic `WEAPON*.CIF` frames; Seasons of the Iliac Bay's are
repaints of classic flats. Both answer yes to "did these pixels come
from ARENA2?", and that is why both are read from the player's own
bundle.

**These are not repaints of anything.** Classic Daggerfall draws no
first-person shield at all - there is no original here to render. They
are the modder's own art (the frame-by-frame animation courtesy of
WilhelmBlack, whom the mod's own settings pane credits). The port
carries them, as it carries Eye of the Beholder's 3035 sprites,
Handheld Torches' hands, Weapon Sheathing's NIFs and Immersive
Footsteps' audio. The mistake was copying the sibling's ruling without
checking whether the sibling's REASON applied.

Vendored under `vendor/shield-widget/Textures/`, re-encoded the way
`vendor/eye-of-the-beholder/README.md` records for its own set and
measured over all 600 rather than sampled: every pixel's alpha is 0 or
255 (the port's own 1-bit cutout law), and no sprite holds more than 84
distinct colours once the transparent pixels count as one. Each is an
indexed PNG with an exact palette and a single transparent index -
**49.51 MB of RGBA becomes 2.02 MB on disk**, verified per sprite, every
drawn pixel identical and every hidden pixel still hidden. Lossless for
everything that reaches a screen; not byte-lossless, because the ghost
colour under the transparent pixels collapses to one index.

The widget measures from a four-row table (one size per archive) rather
than from a loaded texture, because the rect maths measures a sprite
before any texture is uploaded and a shield with no measured size draws
nothing.

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

## SW1b - THE DEEP AUDIT (three shipping bugs, all past a green gate)

`npm run check` was green on the wiring commit and the mod was, in three
separate ways, dead or wrong on a real profile. Each is recorded here
with the pin that now holds it and the mutation that proves the pin.

**1. THE FRAME NEVER ARRIVED.** `weaponRig`'s per-frame block -
the one that assembles the camera, the motor's local velocity and the
look delta, shared by all three first-person mods - opened on
`if (widgetOn() || _torchesOn)`. The Shield Widget was a third consumer
inside a gate written for the other two, so a player who enabled only
Shield Widget never got a single `shield.lateUpdate`: `ctx` stayed null,
`drawRect()` answered null, and nothing ever appeared. The gate now
reads `if (widgetOn() || _torchesOn || shieldOn())`; every consumer
inside was already on its own switch, so this costs the assembly and
nothing else. Pin: *SW1-FEED*, with both siblings switched OFF.

**2. THE DRAW SEAM RETURNED FIRST.** `shown()` is the WEAPON's
predicate - false for a readied spell, a cast animation, an equip
countdown and the sheathe - and the early return that reads it sat ABOVE
the shield's draw step. But `Shield.WhenSheathed` (Off-screen by
default; Corner and Ready are what people pick) and `Shield.WhenCasting`
describe precisely the frames in which `shown()` is false. So the two
headline settings in the mod were dead and `WhenAttacking` was the only
one that did anything, because `shown()` is true mid-swing.

TORCH-VIS said this for the light and MAP-FIELD said it for the map, and
the shield is the third to ask the same question. Fixed the same way:
the shield's own verdict, `drawRect()` - the DLL's gate ladder itself,
which already answers null for the countdown, the climb, the pause, the
load, third person and every Hide/Off-screen pose - is computed before
the gate and relaxes it. AUDIT-FIELD F1's warning applies: the verdict
carries the draw step's own two conditions (`!eotbHidesWeapon()`,
`!fpArm.active()`), or a sheathed frame that used to draw nothing would
have started drawing the Morrowind arm. And `if (!shown()) return;`
below the torch's own return stops the shield-only frame before the
weapon's clone and sprite - a no-op for every path that predates it.
Pins: *SW1-GATE* x4 (Ready draws sheathed, Hide still hides, the switch
off is still off, the seam still stops).

**3. THE WHOLE GEOMETRY RAN ON 320x200.** The rig fed
`screenRect: { width: c?.canvas?.width ?? 320, ... }`. `c` IS the canvas
element - `drawFpsWeapon` two lines away reads `canvas.width` off the
same object - so `c.canvas` was undefined and the fallback won every
frame in every host. `weaponScaleX` came out 1, so the sprite drew at
its native ~134px whatever the window was, and `GetShieldRect`'s clamp
(`y` at most `sr.height`) pinned it around y=200 - up near the top-left
corner of an 800-tall canvas instead of down in the hand. DFU reads
`DaggerfallUI.CustomScreenRect ?? new Rect(0, 0, Screen.width,
Screen.height)`; the drawing buffer is this port's Screen, so it is
`c?.width`. Pin: *SW1-RECT*, which asserts the rect hangs in the lower
half and scales with the window.

**4. THE LOOK NEVER ARRIVED.** `takeFrameLook()` answers an ARRAY,
`[yaw, pitch]` - the weapon's clone one block below reads `look[0]` and
`look[1]` off the very same value. The shield's feed asked it for `.x`
and `.y`, which on an array is `undefined`, so the Inertia module's lean
carried the movement term and a constant zero for the look. It is a
quieter bug than the other three only because `Modules.Inertia` is off by
default; with it on the shield leaned when you walked and never when you
turned, which is half the module. Pin: *SW1-LOOK*, which also reads the
clone's positional access so it cannot pass on a name nobody uses.

**What the audit CLEARED.** `uploadTexture('img', 'sw:<index>', img)`
matches its three first-person peers exactly, mips and all.
`curAnimRect` is already in the renderer's `{u0,v0,u1,v1}` shape and the
left-handed mirror is the u0/u1 swap, which is how `drawFpsWeapon` flips
too. The sprites go through `toScreenOrder` and not `toColor32`, which
is HT3's law for anything drawn on a screen quad. `w.s = settings()`
per frame is the cadence `weaponWidget` already runs at. `attacking` is
fed from `playerWeapon.machine.state !== 'Idle'`, the same answer the
clone takes for `IsAttacking()`. `handedness()` reads the real
`Controls/Handedness == 1`, unoverridden by the rig. SetAttack's pose
ladder, GetShieldRect's clamps, the inertia/recoil ordering and the
recoil block's early `return` (IL_08b1's own `ret`) were re-read against
the disassembly opcode by opcode and match.

**One approximation, named.** `equipCountdownLeftHand` is fed from
`entity.equipCountdown`. DFU keeps a countdown per hand; this port keeps
one clock that sums them (`systems/equip.js` says so, and says why).
The shield inherits that approximation rather than inventing a second
clock: it hides for a moment longer than DFU would when the RIGHT hand
is what is being equipped, and never for less.

**The `_shieldTex` cache** is bounded at the 600 vendored sprites and
keyed by index, the same shape the clone's own cache has. A save that
has worn all four shield types in every material with the Animation
module on would hold all 600 (~42 MB); a normal one holds three.

## SW4 - UPSIDE DOWN (2026-09-19)

Mac: *"the new shield mod we integrated shows the shields upside down"*.

**The code was right and the art was wrong.** SW1b's audit cleared the
draw path in as many words - "the sprites go through `toScreenOrder` and
not `toColor32`, which is HT3's law for anything drawn on a screen quad"
- and that reading still holds: `drawScreenQuad` hands the rect's TOP
the pair `v0`, `uploadTexture` runs with `UNPACK_FLIP_Y_WEBGL` off, so
row 0 of a decoded PNG lands at the top of the sprite, and the shield's
door does the same thing the held torch and the weapon widget's loose
arm do. The audit checked the door. It never looked at the picture
coming through it.

**What was wrong.** All 600 vendored PNGs were written out of the mod's
Unity texture buffer without the flip a PNG's top-down rows need. Unity
stores a `Texture2D` bottom-up (`src/formats/color32Order.js` says so at
the top, and it is why `toColor32` exists at all); a PNG scanline 0 is
the picture's top. Dumping one into the other with no conversion
mirrors every sprite vertically. On screen that put the shield's rim
along the bottom of the frame and ran the gauntleted forearm DOWN into
it out of the sky.

This is the same gap AUDIT 62 F26 and ROAD-H H4 found at two other
PNG-shaped doors, except one step further back: here the conversion was
missed at EXTRACTION, before the file ever reached the repository, so
nothing the port does at load could have put it right. Fixing it in
code would have meant a second, opposite flip on this one door while its
two screen-sprite neighbours kept the shared law - the door lying about
which way up its files are, forever.

**The fix.** All 600 files rewritten with their rows reversed, in place.
They stay indexed PNGs: `IHDR`, `PLTE` and `tRNS` are carried over byte
for byte and only the pixel rows move, so the palette, the transparent
index and every drawn colour are untouched. Each file was checked before
it was written by flipping the output back and comparing it to the
input, all 600, exact. The set got slightly smaller (2,121,591 ->
2,103,899 bytes) purely because the filter bytes re-choose against
different neighbouring rows.

**How a re-extraction gets caught.** The picture says which way up it
is, and says it the same way in all 600: a first-person shield is HELD,
so the arm runs off the BOTTOM edge of the sprite and the top edge -
open air above the rim - is empty. Measured over the whole set, right
way up: the top row is fully transparent in all 600, and the bottom row
carries at least 69 opaque pixels, which is 44% of the narrowest
sprite's width. Mirrored, that reads exactly backwards - 600 touching
the top, none touching the bottom. Pin: *SW4: all 600 sprites are the
right way up*, which reads every file (a small indexed-PNG reader lives
in the test, because `decodePng` is a browser door), and which was run
against the old art to watch it fail. Its neighbour *SW4: the shield
door keeps the PNG's rows* holds the code half - the door's membership
of HT3's list, which nothing had pinned before. Mutant:
*SW4-1-the-shield-door-flips-the-png* (tools/mutants/sw1.json, 9 total).
