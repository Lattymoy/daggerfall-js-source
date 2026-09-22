# Weapon Widget - the mod, 1:1, and the Morrowind arms (WW1, 2026-09-14)

Mac: "This is our next mod I want to add 1:1 while also having it work
with morrowind's first person view" - handing over
`Weapon_Widget-860-1-6-1766811008.zip`.

**Weapon Widget 1.6** for Daggerfall Unity 1.1.1, by
**RedRoryOTheGlen** (Nexus mod 860). "Custom first-person weapon sprite
handler for new features." One MonoBehaviour, `FPSWeaponClone`, that
runs BESIDE DFU's `FPSWeapon`: it hides the original every frame and
draws the classic weapon sprite itself, with nine modules - Swings,
Ambidexterity, Offset, Bob, Inertia, Step, DoubleScaleTextures,
TrueTextureSize, Recoil - each a switch in its modsettings. Its data is
vendored under `vendor/weapon-widget/` (the manifest, the shipped
modsettings, a README with the provenance and the permission line), it
is credited on the About screen, it has a Mod Authored row on the
Features home (FT9's shape) and its 41 keys under its card on the Mods
page, and it is ported as `src/combat/weaponWidget.js` (the component),
`src/combat/weaponWidgetMotion.js` (the parts that are arithmetic
rather than component - LoadSettings, the Offset/Bob/Inertia modules
and GetWeaponRect's transform, split out 2026-09-19 so the gun lab can
RUN them rather than copy them; the component imports them back and
the arithmetic is untouched) and `src/combat/weaponWidgetAssets.js`
(the door for its textures). On
by default (MO1). Pins: 14 in `test/ww1_weaponwidget.test.js`.

## The source the port reads

The bundle carries `Weapon Widget.dll` (42,496 bytes) and no source;
the `FPSWeaponClone.cs` its manifest names is not in it. The port's law
is the IL, read method by method with the members resolved (the same
road Seasons of the Iliac Bay's SeasonHelper took, SIB1). Neither the
DLL nor the IL listing is carried in the repository; every function in
`weaponWidget.js` names the method it restates and the IL offset it was
read at. The DFU-side members the clone calls -
`FPSWeapon.GetCurrentFrame / GetHitFrame / IsAttacking / WeaponState`,
`FormulaHelper.GetMeleeWeaponAnimTime`, `GetBowCooldownTime`,
`WeaponBasics.GetWeaponFilename`, `TextureReplacement.TryImportCifRci` -
are the port's own homes for them.

## The shape here

The clone is a component the weapon rig (`combat/weaponRig.js`) owns,
one per host, fed what Unity handed it:

- **`lateUpdate(dt, ctx)`** is `LateUpdate`, called after
  `playerWeapon.update(dt)` steps the machine (as the clone's LateUpdate
  follows FPSWeapon's Update). `ctx` carries the frame: the art, the
  weapon in hand, its type and metal, the machine, the sheathe and hand
  flags, the equip countdown, the rig's show clock, the motor's words
  (grounded, crouching, riding, standing, the speed ratio, the local
  velocity), the frame's look (`lookFilter.takeFrameLook()`, latched
  where the look is applied), the swing gesture, the cursor, the camera.
- **`draw(renderer, canvas)`** is OnGUI's repaint: one screen quad of the
  current frame over `GetWeaponRect()`, drawn in the rig's draw seam
  AFTER the Morrowind arms and BEFORE the classic sprite - so with the
  mod on the classic sprite is the clone's, and with the arms on the
  arms take the clone's channels instead (below).
- **The three coroutines are generators** driven by Unity's own clock:
  `yield seconds` is `WaitForSeconds` (resumed ahead of the frame's
  LateUpdate once the wait has run out, the remainder not carried, as
  Unity's is not), `yield FRAME` is `WaitForEndOfFrame` (resumed by
  `endOfFrame()`, which the rig calls after its draw). `StartCoroutine`
  runs a body to its first yield at once; so does `playAttackAnimation`.
- **`onAttackDamageCalculated({ damage, parrySounds, pos, isEnemy })`**
  is the mod's `FormulaHelper.OnAttackDamageCalculated` subscriber, fed
  from `playerWeapon.resolveHit` through `onAttackResult` - the one
  consumer of that seam, the player's own blows only.
- **The channels** the mod publishes - Position, Scale, Offset - are
  read by the sprite's draw and by the Morrowind arms (next section).

## The Morrowind first-person view

The arms (`combat/fpArm.js`) composite their frame into a render target
and blit it as a screen overlay. WW1 gives that blit a transform seam:
`fpArm.setScreenTransform(fn)`; when set, the composite is drawn as a
screen quad over `fn({ x: 0, y: 0, w: W, h: H })`. The rig sets it to
`widget.armsTransform` while the mod is on, which is `GetWeaponRect`
over the arms' whole rect with **Position and Scale only** - the Bob,
the Inertia (its lag and its forward depth), the Step snap, the floor.
The **Offset module is deliberately not applied to the arms**: its slide
is the sprite's sheathe, and the arms sheathe with their own clips
(MW-D19). The same numbers move the arms' composite the way they move
the sprite, which is what Mac asked for. The arms' own frame, stance,
mirror and clip laws are untouched.

## Method by method

| FPSWeaponClone (IL) | Home in `weaponWidget.js` | Notes |
|---|---|---|
| `.ctor` (0x361c) | `createWeaponWidget` - the `w` fields | The resting values. |
| `LoadSettings` (0x724-0xb7f) | `readWidgetSettings` | The multipliers kept: Offset.Speed x10, Bob.Length /100, SizeX/Y x2, SpeedMove x4, SpeedState x500, Shape x0.5, Inertia.Scale/Speed x500, ForwardDepth/ForwardSpeed x0.2, Chance /100; TextureScaleFactor floored at 1. Re-read every frame (the port's settings are live). |
| `get_offsetSpeedLive` (0x284) | `offsetSpeedLive` | LiveSpeed / 100 * offsetSpeed. |
| `GetAnimTickTime` (0x2a90) | `widgetAnimTickTime` | A bow's 0.0625, FormulaHelper's melee tick; with Swings on the remap `Lerp(0.045918, 0.352041, InverseLerp(0, 2, t / 0.198979))` - the bow's branch lands on the swing test too. |
| `OverrideAlignment` (0x3440) | `overrideAlignment` | StrikeDown / StrikeUp of anything but bow, bare hands, dagger, warhammer: drawn centred, the inner edge on the middle. The werecreature is NOT exempt. |
| `CheckForMirrorOverride` (0x34c0) | `mirrorOverride` | `GetItemHands() == 2` - and 2 is `ItemHands.Both` in DFU's enum (FPSWeaponClone.cs:2378 says it in words); the port had read it as its own LeftOnly and the three Miscellaneous mirrors fired on nothing until 3ARMS (2026-09-22, Handheld-Torches.md) - a claymore mirrors under its switch now, pinned. |
| `CheckForOffsetOverride` (0x35a4) | `offsetOverride` | Everything but bare hands and the werecreature leans. |
| `CheckForRecoveryOverride` (0x35d8) | `recoveryOverride` | A StrikeUp of anything but a dagger recovers in reverse. |
| `PlaySheatheSound` (0x31b0) | `playSheatheSound` | SoundClips 417 at the sheathe edge. |
| `PlaySwingSound` (0x3144) | `playSwingSound` | The weapon's swing clip at volume 1.1, at the release. |
| `ChangeWeaponState` (0x107c) | `changeWeaponState` | A bow's Idle resets the frame; any strike zeroes the offsets; then UpdateWeapon. |
| `LoadWeaponAtlas` (0x29a8) | `loadWeaponAtlas` | The art is the rig's (one CIF load, the metal dye applied there); the clone's own type / metal / template / tick and a fresh custom-texture cache. Reloaded on a type, metal, template, enchantment or DoubleScale change (OnGUI 0x113b). |
| `GetWeaponTextureAtlas` (0x2d72) | `customTexture` | The player's own texture by TryImportCifRci's spelling, `w_` for the double-scale set; asked once per name, the classic frame until it lands. |
| `UpdateWeapon` (0x2328) | `updateWeapon` | The mirror over the three states, the override's Center, TrueTextureSize's division, DoubleScale's x2 on the idle (a bow's frame 0), the 320x200 scale, the three alignments. MainFilterMode's 1.01 fudge (0x2633) correctly absent - the port's image textures bind NEAREST. |
| `AlignLeft / AlignCenter / AlignRight` (0x270c / 0x278c / 0x28f4) | `alignLeft / alignCenter / alignRight` | Center under the override: the flipped sprite ends at the middle, the unflipped starts there. Right, flipped, takes Left for the mirror states. |
| `GetWeaponRect` (0x1590) | `transformRect` / `getWeaponRect` | Position (mirrored when flipped), Scale (never the werecreature's), Offset in the rect's own size, the Step snap on `stepLength * screenH / 64` with Mathf.Round's half-to-even, and the floor: never above the resting y. |
| `OnAttackDamageCalculated` (0xc5c) | `onAttackDamageCalculated` | The six conditions over hit / parry (`MobileEnemy.ParrySounds`) / miss, `Random.value < chance`, the clang or the thud. |
| `DoClang / DoThud` (0xe0c / 0xf58) | `doClang / doThud / vfxAt` | TEXTURE.380 record 2 at 20 fps, twice its size, 0.75 back toward the camera - or 0.75 of the distance along the look with MissEffectPlacement = Crosshair. The billboard is the host's hit-effects pool (`hitEffects.showMissEffect`); the CLANG's emissive material is not carried (the port's billboards have no material to make glow). |
| `CheckForEnvDamage` (0x1730) | `checkForEnvDamage` | A cast along the look within the weapon's reach (x1.25 for a StrikeUp); a wall within it is a hit with a thud. The mod's SphereCast from the player's centre is the rig's `envCast`: the host collider's ray from the eye (the port has no sphere cast; the same wall answers). |
| `<PlayWeaponAnimation>d__135` | `playWeaponAnimation` | Swings on: the wind-up pose by the setting (Hide / Idle with the lean / First Frame) until the ORIGINAL reaches its hit frame; the release, the swing sound, the environment check; a hit forward to the hit frame, held three ticks; a miss played through; the recovery while the original attacks (in reverse on a hit or the override, else Hide / Last Frame); the exit's re-entry from below. The tick is `GetAnimTickTime / 5 / Swings.Speed`, halved under the recovery override. |
| the lean table (0x3a68-0x3bac) | `leanFor` | By strike and by hand. |
| the exit (0x3fcb, 0x4354) | `finishSwing` | Idle; `offsetCurrent = [x, 1]`, x by the strike's side. |
| `<PlayVanillaWeaponAnimation>d__136` | `playVanillaWeaponAnimation` | Swings off: the strike from its start on the machine's tick (the IL increments before its first yield, so frame 1 shows at once), the swing sound at the hit frame, a hit played back to 0 with the cancel point at the hit frame. |
| `<PlayBowAnimation>d__137` | `playBowAnimation` | BowDrawback on: the draw frames 0..3 on the classic tick while the original draws, held; the release to the last frame while the original looses (the original leads by a frame; it ends the strike); a draw let go played back; the dip until the cooldown. Off: the instant shot from frame 3. |
| `PlayAttackAnimation` (0xfc0) | `playAttackAnimation` | A running swing yields only past its cancel point; the bow's, the swing's or the vanilla coroutine by the switch. |
| `LateUpdate` (0x189c) | `lateUpdate` | In the IL's order: the weapon change (a bow without drawback lands on frame 3, StrikeDown), the atlas, the sheathe edge, Ambidexterity's flip law, the attack the original started that the clone is not playing (with NoDaggerMirroredStrikes' swap), the Offset module (2,2 while hidden or equipping, eased by the live speed), the Bob (the rate `baseSpeed * 1.25 * s * bobLength`, the size 1% of the screen * s * the size mods, crouching and riding halving s, standing 0.1 or 0, airborne easing to nothing, the U / Sideways 8 / Inverted U by the shape's phase), the Inertia (look and local velocity, the sign by hand, x3 speed while a target stands, the forward depth over the scale pulling a quarter screen back), DoubleScale's half-size shift on the idle, then UpdateWeapon. |
| `OnGUI` (0x10c8) | `draw` | With the Offset module the sprite draws whatever the show clocks say (the slide takes it off screen); without it, only while the rig would show it. Frame -1 draws nothing; third person draws nothing. |
| `showWeapon / hideWeapon` messages | `setShowWeapon` | The mod's cross-mod messages, kept as a setter. |

## What is deliberately not carried

- **Cross-mod seams.** Tome of Battle's reach and swing key, FPS
  Models' animator, the `registerCustomWeapon` message, Vanilla Combat
  Event Handler's `onToggleOffset`: the port has none of those mods.
- **Five duplicates** of laws the port runs once, which the clone runs
  beside the original: the bow's out-of-arrows sheathe, the unsheathe
  sound, the vanilla weapon's own hide (`ScreenWeapon.ShowWeapon =
  false` - the draw seam's order is that hide), the combat-voice roll at
  the release (the rig's `playerAttackGrunt` is FPSWeapon's own, on the
  machine's hit), and the transformed lycanthrope's move-sound clock
  (LycanthropyEffect's, LM1). The clone's swing sound at its release IS
  carried: it is the mod's moment, and the hosts' whiff on a miss is
  DFU's other one, as in DFU with the mod.
- **The CLANG's emissive material** (above).
- **The `lastSheathed` boot artefact.** The mod's field starts false, so
  DFU hears clip 417 once at every load of a sheathed save; the port
  initialises the edge on its first frame.
- **MainFilterMode's 1.01 fudge** (above).

## The textures, and the doctrine

The bundle carries 173 PNGs: `WEAPON00.CIF` to `WEAPON11.CIF` and the
enchanted `WEAPO101-108.CIF` set, record 0 frame 0 (the idle pose), one
per metal, repainted at double size for the DoubleScaleTextures and
Inertia modules. They are renders of ARENA2 art - a re-shaded, re-scaled
sprite that keeps the original silhouette - and by the doctrine
(`01-Overview/Port-Doctrine.md`: A RENDER OF GAME DATA IS GAME DATA) they
are not in the repository, the ruling SIB1 recorded for Seasons of the
Iliac Bay's flats. They reach the game FROM THE PLAYER'S OWN COPY OF THE
MOD: attach the `.dfmod` through the textures pick (the Mods page), and
`weaponWidgetAssets.js` finds the bundle by its manifest's GUID (then
its title, a later ModVersion warned), opens it once through the SIB1
UnityFS reader, and answers a texture by TryImportCifRci's spelling -
`w_<FILE>_<record>-<frame>[_<Metal>]`. A loose PNG of that name in the
texture folder answers too. Without either, the modules that need them
run as the mod runs without them: the classic frame at double size.
The `dfmod/` stored-name prefix has one home (`seasonsIliacBayAssets.js`,
audit24's ratchet); this door imports it.

## The settings

`src/systems/modSettings.js` restates the shipped `modsettings.json`
under the vendor key `weapon-widget`: section and name joined with a
dot, every kind kept - ToggleKey a boolean, SliderIntKey an int in its
range, MultipleChoiceKey an index over the shipped Options, and
**SliderFloatKey**, new here (`float: true`, min / max, a `step` for the
pane's stepper; coerced to its range, rounded to a thousandth). Where
the mod wrote a Description it is the pane's; where it wrote none the
port did. The Features home's row (`mod-weapon-widget`) is the mod's own
Enabled switch; "takes effect at once", the widget reads its switches
every frame.

## Hosts

All four rigs (the streaming world, the exterior location, the interior
modes, the dungeon) feed the clone through the one rig; the miss
billboard rides each host's hit-effects pool (the interior modes' own
`interiorHitEffects`), the environment cast each host's collider. The
hosts' move thunks carry the motor's crouching / riding / standing /
speed for the bob, through the one motion bag (`motionBagOf`, WW2).

## WW2 - the bob played while idle (2026-09-14)

**Mac: "The newly integrated weapon widget mod had an issue where the
bob movement plays even when idle."** The Bob keys its idle on
`standing` (FPSWeaponClone's IsStandingStill), because DFU's
PlayerMotor.Speed is the SETTING and never zero. The hosts wrote the
rig's motion bag out longhand at five sites, and the world-hosted
dungeon lane's copy (worldModes' `drawFoes` call) stopped four fields
short: no `standing`, no `speedField`, no `crouching`, no `riding`. The
idle gate never fired, the speed ratio fell back to 1, and the
WALKING stride played at rest - ten times the idle's size and speed
(measured through the real component: 25.6 px against the idle's
2.56); a crouched or mounted walk lost its halving and a run its
ratio the same way. Note the same class of miss one round earlier at
that very line (PX26 F4: the jump-state inputs the interior lane never
sent).

The root cause is the copying, not the copy: the bag is ONE HOME now,
`motionBagOf(player)` in `player/motor.js`, and every host site reads
it - a sixth host cannot ship a partial one. The mod's own gate
(`weaponWidget.js`: `if (m.standing) s = bobWhileIdle ? 0.1 : 0`)
stands unchanged.

Pinned in `test/ww2_idlebob.test.js` (2): the bag executed from a
player at rest, one walking and a bare one, and from the real motor;
by source the five sites and the record. `test/ww1_weaponwidget.test.js`
restamped: the per-file grep that let a second, partial site pass is a
per-site count now, and the Bob channel pin gained its idle half - the
slight stride inside the 0.1 bound, and none at all with BobWhileIdle
off.

## WW3 - THE TEXTURE DOOR'S SHAPE (2026-09-14)

**CORRECTED THE SAME DAY (TEX1):** this section first claimed the crash
below as the widget's. It was not: the crash itself was HANDHELD TORCHES'
(`06-Systems/Handheld-Torches.md` TEX1) - the stack's third frame,
`e.texturesLoading`, is that mod's, and both ride the weaponRig chunk, so
the file name pointed here. What is true of the widget is that its door
carried the SAME fault, found by tracing Mac's stack, latent only because
its `catch (() => {})` would have eaten the throw. The trace that opened
it is kept below because the fault it names is real and was fixed here
first.

Mac's page died on daggerfalljs.dev with:

```
CRASH / unhandled rejection
TypeError: can't access property "buffer", l is undefined
  k@renderer.js              <- asBytes
  uploadTexture@renderer.js
  ...@weaponRig-*.js         <- the widget's texture load
```

**The same root cause, a SHAPE one word wide** (the widget's copy of it).
`weaponWidgetImage`
converted with `toColor32Order`, which answers the port's bottom-up
texel ORDER in a decoded PNG's `{ width, height, data }`, and
`weaponWidget.js` handed that straight to `renderer.uploadTexture`,
which reads `color32.colors`. Undefined; `asBytes` died on `.buffer`
three frames down, naming neither the texture nor the cure. The order
was right the whole time and the shape never was.

`formats/color32Order.js` had written this exact trap down before it
happened: `toColor32` is the same conversion "handed back in the shape
the upload path reads", and its doc says a decoded PNG's `{ data }` "is
NOT that shape - `color32.colors` would be `undefined` and `asBytes`
would throw on the first swapped record". The door takes `toColor32`
now, in both its arms (the bundle's texture and the loose PNG).

**Why no pin caught it.** WW1 shipped the door and pinned the MISS -
`weaponWidgetImage(...)` answering null with nothing attached - and
never once landed an image, so the door's answer never reached an
upload in a test. The art is ARENA2-derived and not in the repository,
which is what made the miss the easy thing to pin. `test/ww3_widget
texture.test.js` closes it by EXECUTION: a loose PNG registered through
the real door, decoded through the real `decodePng` (its two browser
globals stubbed), converted by the real door and handed to the real
`Renderer.uploadTexture` on the audit39 gl stub - the whole path the
crash took - asserting the bytes that reach `texImage2D` are the
picture bottom-up. The old shape through the same call is pinned to
throw, so the regression cannot return quietly.

**Two things beside the fix, both about why it reached a player.**
The load's `catch (() => {})` swallowed everything - a silent door is
how a shape fault ships - and now warns by name, as the rig's own art
and spell loads next door already did. And the upload path names the
fault: `color32Bytes` throws with the key, what it got and the cure in
the sentence, where a `TypeError` inside a helper said nothing. The
behaviour is unchanged (it threw before, it throws now); only the
console is.

**The divergence that made this easy to get wrong** - the seasons door
converting with `toColor32Order` and re-wrapping at its two upload sites,
against M-TEX converting at the door (the H4 law) - was recorded here as
"a slice of its own", and TEX1 took it that same day, along with the two
torch doors and the crash itself. Every door converts at the door now and
nothing under `src/` imports `toColor32Order`:
`06-Systems/Handheld-Torches.md` TEX1.

## WW4 - the clone owns the seam, and the idle comes back (2026-09-16)

Mac handed over a curated `weaponWidget.js` with two hunks and a
report of the vanilla weapon flashing back mid-swing. Both are in.

**WW4, the draw seam.** `draw()` answered `false` for frame -1, for a
`hideWeapon` message and for third person - and `false` reads to the
rig (`if (widgetOn() && c && widget.draw(renderer, c)) return;`) as
"not mine", so the classic sprite fell in behind every Hide wind-up and
recovery, both of which are the defaults. In DFU the mod hides the
original outright (`ScreenWeapon.ShowWeapon = false`, the page's own
"deliberately not carried" row says the draw seam's order IS that
hide); the port's order was only that hide while the clone drew
something. An applicable clone that chooses silence answers `true` now
and draws nothing; only genuine not-applicable (no ctx or art, no
anim, record or texture data) falls through.

**WW4b, the idle's re-entry - THE PORT'S OWN.** The IL's
`ChangeWeaponState` resets only a bow's Idle to frame 0. With Recovery
= Hide the Swings coroutine leaves a melee frame at -1, and
`finishSwing`'s slide-in from below needs a drawable frame; the mod's
clone recovers it from the original it shadows, the port's shadows a
machine that publishes no frame for Idle. So the melee idle stayed at
-1 - invisible once WW4 stopped the classic sprite standing in for it,
which is why WW4 alone would have emptied the screen after the first
swing. An Idle arriving at -1 takes frame 0; an Idle already holding a
real frame (Recovery = Last Frame, the other callers) is untouched.

Pins in `test/ww1_weaponwidget.test.js` (two): the three silent
answers own the seam and draw nothing while no-weapon still falls
through, and the rig's line reads it so; a full swing under the default
recovery lands on frame 0 and draws the idle, while Last Frame is left
as it was.

Beside it, unrelated to the widget but shipped in the same commit:
**MAC-C1**, the live crash `r.text.split is not a function` at
`showStatus` - the status box wrapped `townTalk.lines`' formatted rows
(`{ text, center }`) whole as a token's text; `statusInfoRows` takes
both row shapes now (`systems/healthStatus.js`, pinned in
`test/statusinfo.test.js`).

## F1 - THE THRUST (2026-09-17, Mac: "when thrusting with a weapon, it can be glitchy")

Two things a thrust does that the other strikes do not, one of them the
mod's own. The mod's: `CheckForRecoveryOverride` - a StrikeUp of anything
but a dagger recovers IN REVERSE, at half the tick (`recoveryOverride`,
under the shipped `VanillaRecoveryOverride`, on by default). A thrust
therefore plays forward to its hit and then runs backward through its
frames at double speed, which is the mod's designed look and reads as a
stutter beside the other strikes' clean Hide/Idle recovery. That is
reportable as the mod's behaviour, not a bug; the setting turns it off.

The bug: the reverse ran inside the "while the original is still
attacking" loop UNLATCHED. With Recovery = Last Frame the loop, having
reversed to frame 0, set the frame back to the LAST frame on its next lap
and reversed again - every lap until the original's swing ended, a thrust
flickering backwards over and over. Under Hide (the default) the frame
went to -1 and the reverse's guard (`currentFrame > 0`) held, so the
default player saw the double-speed reverse alone. `playWeaponAnimation`
latches the reverse (`reversed`) and runs it once; the reverse itself is
the mod's, to frame 0. Pinned in `test/ww1_weaponwidget.test.js`
(a StrikeUp under Last Frame descends its frames exactly once; under Hide
as before). Mutants in `tools/mutants/bugs5.json`.
