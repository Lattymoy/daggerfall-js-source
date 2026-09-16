# Eye Of The Beholder (EOTB) - third person without Morrowind

**Eye Of The Beholder 2.1**, RedRoryOTheGlen. **PARTIAL PORT** - the
camera and the sprite's SELECTION, read off the shipped bundle's IL;
the mod's own 3035 sprites vendored. See "What is and is not ported"
below: this was called 1:1 until AUDIT-EOTB counted the methods. Vendor record and
the permission line: `vendor/eye-of-the-beholder/README.md`. Registry
row: `01-Overview/Mod-Registry.md`.

## What is and is not ported

The arc called itself **1:1** in six places. AUDIT-EOTB counted the
methods and it is not; AUDIT-EOTB2 (2026-09-16) ported the half the
port could reach without the assembly, and says which half that is.

The assembly carries **62 authored methods** - 28 on
`EyeOfTheBeholder` (the camera), 33 on `PlayerBillboard` (the sprite),
one on `PlayerBillboardState` - once constructors, the four
compiler-built coroutine state machines and the event accessors are
struck. The port implements **twenty-nine** of them, in two kinds:

**Thirteen, read off the IL** (EOTB2-EOTB5):

| IL method | here |
|---|---|
| `get_posOffset`, `get_offsetRidingMod` | `posOffset` (eotbCamera.js) |
| `CheckBounds` | `checkBounds` - per-axis cast, the auto-switch |
| `SetVectorBounds` | `setVectorBounds` |
| `Update` | `tick` - the scroll ladder, the mirror revert, the smoothing, the minimum-distance floor |
| `ToggleOffset` | `toggleOffset` - the scroll reset and the smoothing seed only |
| `LoadSettings` | `readCameraSettings` - the settings-to-fields mapping |
| `InitializeStates` | `STATE_TABLES`, as a generated law |
| `LoopIdleBillboard` | `chooseTable` - which table, not the loop |
| `UpdateOrientation` | `orientationFor` - the angle and the snap only |
| `get_frameTime`, `get_sizeMod`, `get_scaleOffset` | the three constants-with-arms |

**Sixteen, read off the settings** (AUDIT-EOTB2, marked `[SETTINGS]`
where each lands - see the evidence banner in `eotbBillboard.js`):

| IL method | here | read from |
|---|---|---|
| `LateUpdate` (camera) | `applyRow` / `tick` / `transition` (eotbCamera.js) | the nine AutoTogglePerspective rows' names and option labels, applied on a situation change |
| `OnTransitionInterior`, `OnTransitionExterior` | `transition`, on the building's two doors (worldModes) | the two rows' names |
| `ToggleBillboard` | `hides` (eotbBody.js) - the FPV weapon and horse | `Compatibility.Don'tHideWeapon` / `Don'tHideHorse`, which say exactly what is hidden |
| `PlayFootstep`, `EnableVanillaFootsteps`, `DisableVanillaFootsteps` | `footstep` (eotbBody.js) → `systems/footsteps.js`'s `spriteStep` arm | `Animation.SyncFootsteps`, and the footfall frames the IL gave `FOOTSTEP_FRAMES` |
| `PlayMeleeAttackAnimation`, `PlayRangedAttackAnimation`, `PlayRangedAttackAnimationHold`, `PlayLycanAttackAnimation` | `attack` (eotbBody.js), at the rig's own strike door | the attack tables the IL gave, `Graphics.AttackStrings` and its four labels |
| `PlaySpellAttackAnimation` | `cast` (eotbBody.js), at `castSpellAnim` | the same |
| `PlayDeathAnimation` | `deathTable` + the held clip in `eotbBody.tick` | the two Death tables the IL gave |
| `PlayAnimationCoroutine`, `PlayAnimationHoldCoroutine`, `PlayAnimationPingPongCoroutine` | `clipFrames` (eotbBillboard.js), stepped by the body's clip clock | `Graphics.PingPongOffset`'s description; the hold is the drawn bow's |

A `[SETTINGS]` law is the mod's shape **as its author described it to
the player**, not its body as the compiler saw it. The day the assembly
is read, each row above either becomes `[IL]` or is corrected, and the
pins in `test/eotb_audit2.test.js` are where a wrong reading fails.

**THE ASSEMBLY IS NOT IN THE TREE.** `Eye Of The Beholder.dll` lives
inside the shipped `.dfmod`, which is not vendored (only its manifest,
settings, presets and art are), and the bundle is behind a Nexus login
the container cannot pass. AUDIT-EOTB2 could not re-read a single
method. What it needs to finish is the archive Mac already holds
(`Eye_of_the_Beholder-762-2-1-1775438888.zip`) dropped where the port
can read it - the reading recipe (`dnfile`/`dncil`; `monodis`
segfaults) is in `test/eotb_scope.test.js`'s head and both wheels
install through the proxy.

**Thirty-three not ported**, in two kinds, every one a row in
`test/eotb_scope.test.js` with its verdict:

- **needs the assembly** (NOT DONE): `GetMeleeAnimTickTime` - the one
  number the one-shots want that only the IL holds; the clips run at
  the walk clock's own step until it is read. `CheckWagon` /
  `SpawnWagon` / `UpdateWagon` (`Graphics.ShowCart`, the cart that
  follows the sprite - which model, at what offset). The scale-offset
  constant is ported but `spriteInfo.json`'s 288 per-sprite offsets are
  still NOT APPLIED: their sign convention is the assembly's, and applying
  them the wrong way round would shift the bow and spell sprites by up
  to 0.76 m - worse than centred. `Graphics.TorchOffset` (Vanilla /
  Billboard / Selfie - where the handheld torch's light sits) for the
  same reason.
- **no twin here**: the Unity lifecycle and component methods (`Awake`,
  `Start`, `Init`, `FixedUpdate`, the billboard's own per-frame Update, `OnLoad`, `OnNewGame`,
  `get_IsReady`, `get_pivotLocal`, `OnPositionUpdate`, `SetKeyFromText`,
  `SpawnBillboard`, `MessageReceiver`, `ModCompatibilityChecking`); the
  mesh and material handling the port's billboard batch replaces
  (`UpdateBillboard` and its delayed pair, `AssignMeshAndMaterial`,
  `UpdateMaterial`, `MakeBillboardMaterial`, `Initialize`, both
  `InitializeTextures`); `OnUpdateSailing` and `FreeRein_GetMoveVector`
  (Come Sail Away and Free Rein, neither in the port); `MeleeDamage` -
  the attack-from-body ray, moot because the port's swing and activation
  already start at the player's own head (`cam.pos`), which the view
  never moves; and the billboard's own late update, the first-person
  visibility mode (`Graphics.FirstPersonBillboard`: Shadows Only), which
  needs a shadow caster the port's billboards do not have.

### The dead exports

Three exports of the arc are called by nothing - not even their own
module. That is the audit's shape in miniature, so they are listed in
`test/eotb_scope.test.js` with a reason each, and the set is DERIVED
rather than typed: `scaleOffset` (`spriteInfo.json`'s per-sprite
offsets are not applied - see above), `tableKeys` (nothing pre-loads a
whole table) and `OVERRIDE_ORDER` (the three override sections'
precedence, spelled once to read `posOffset` against). `attackTable`
left the list at AUDIT-EOTB2: the attack lane calls it. Each remaining
row is a debt: wired or deleted by the slice that next touches its lane.

## Why a port that already has third person carries a second one

Mac, 2026-09-15: *"Alright next mod I want to add 1:1."* And, asked
whether this should replace the Morrowind camera or sit beside it:
*"This is moreso for those who opt out of using morrowind."*

That is the whole design. The port's third person (MW-D24/MW-D25) draws
a **Morrowind** body and cannot exist without Morrowind data.
`player/mwView.js` says so in its own head, and has since it was
written:

> a player with NO Morrowind data (or a refused body) has no third
> person at all, and the wheel then does nothing rather than pulling
> the eye out of an invisible head.

Eye Of The Beholder is that missing body. The seam is not a fork and
not a setting to choose between two cameras: it is one ladder, and
whichever body can answer, answers.

## The mod, as it actually is

Two MonoBehaviours in a 54 KB assembly, read out of the IL with
`dncil`/`dnfile` - `monodis` segfaults on this one, which is worth
recording because the next reader will try it first.

- **`EyeOfTheBeholder`** - the camera. A local pivot on the body, an
  offset in the frontal plane (X across, Y up) and along the view (Z),
  a per-axis obstacle raycast that pulls the eye in, a shoulder mirror
  with an automatic switch when the wall is too close and a timer that
  reverts it, speed/dampen smoothing, three override sections (weapon
  readied, mounted, sailing), a nine-row auto-toggle table, a wagon
  that follows, and a torch that follows.
- **`PlayerBillboard`** - what you see. Eight orientations, a state
  table over idle / move / death crossed with melee, ranged and spell,
  plus horse and lycanthrope sets, three optional attack variants
  (mirror, ping-pong with its own offset, hold), its own footsteps, and
  a first-person visibility mode so the sprite can still cast a shadow
  while you are looking out of its eyes.

Fifty-four settings across nine sections, all carried.

## The art, and exactly what was done to it

3035 sprites in 23 archives - 16 on-foot sets, seven mount sets. As the
bundle stores them they are 19.72 MB of RGBA.

Measured over **all 3035**, not sampled:

- every pixel's alpha is 0 or 255 - the classic 1-bit cutout, which is
  already the port's own law (`if (t.a < 0.5) discard`);
- no sprite holds more than 166 distinct colours once the transparent
  pixels count as one.

They are palettised artwork stored as truecolor. So each is written as
an indexed PNG with an exact palette and one transparent index:
**19.72 MB becomes 8.39 MB**, verified per sprite - every drawn pixel
identical, every hidden pixel still hidden.

**It is lossless for what reaches a screen, and it is not
byte-lossless.** The source carried up to 59 different colours *under*
transparent pixels, ghost colour from the author's export that no
renderer has ever shown, and those collapse to one index. The
distinction is written down here and in the vendor README because "we
re-encoded the art losslessly" would have been a claim slightly larger
than the truth.

The 1035 per-sprite `.xml` files (three values each: `scale`, `X`, `Y`)
fold to one table - 288 carry anything but the default and those hold
six distinct triples.

## The gate that carries 3035 pictures

The doctrine allow-list is per-file, with a human-written reason beside
each picture, and that is its value. Three thousand rows would destroy
exactly that - "a rule enforced by an enumeration is a rule enforced by
memory".

So a vendored mod's art carries **one row, on its directory**, and
membership is **derived**: a file under it is the mod's if and only if
the mod's own shipped manifest names it. That is why the 386 KB
manifest is vendored verbatim rather than trimmed - it is the authority
on what the bundle contained, and the port cannot quietly widen it.

Checked both ways, on AUDIT 27 F302's lesson: no stranger under the
directory (our own artwork dropped into the mod's folder is the shape a
bare directory row would wave through), and no picture the manifest
names that the tree failed to carry. Both arms are pinned non-vacuously
in `test/doctrine.test.js`.

## The departures

Three, each marked where it lands in `src/systems/modSettings.js`.

1. **`CameraScrolling.ScrollableZOffset` ships OFF; the port ships it
   ON.** MODS-ON, and Mac's own ask. It is the arm the whole view seam
   is built on.
2. **`Camera.TogglePerspective` = `KeypadEnter` is inert here.** Mac:
   *"instead of numpad being used to change views, I want it scrollable
   like how we handle morrowind."* The key is still listed, because the
   pane is a record of what the mod ships and a key quietly deleted is
   a key nobody can ask about.
3. **`Camera.SwitchShoulder` ships `Tab`; the port binds `B`.** HT4's
   finding again, same author, same key: Tab is free in Daggerfall
   Unity and spent here - PX15 gave it to the port's own pixel dial.

The mod also ships `CameraScrolling.ScrollableZOffsetAxis` =
`"Mouse ScrollWheel"`. That is a Unity input **axis**, not a KeyCode,
and the two are different kinds wearing the same JSON type. The port
declares the kind (`axis: true`), and HT4's spent-key gate reads the
declaration instead of guessing from the value - it had been resolving
the string as a binding, which it is not and never could be.

## The camera (EOTB2), as the IL has it

`src/player/eotbCamera.js`, and the derivation worth keeping:

    posOffset  = boat, then mount, then weapon, then base - the FIRST
                 arm that matches returns, so a mounted player with a
                 weapon readied takes the MOUNT offsets. X mirrors on
                 the shoulder flag; Z has the scroll subtracted. Only
                 the BASE arm scales by RidingOffset.
    CheckBounds= one raycast per axis along the EYE's basis, SKIPPED
                 when that axis's offset is zero, cast |offset*2| +
                 eyeRadius and recorded as hit - eyeRadius*2. The
                 auto-switch flips the shoulder BETWEEN the x cast and
                 the y cast, so the casts that follow see the mirror.
    posTarget  = head + eye.TransformVector(clamp(posOffset))
    posCurrent = MoveTowards(posCurrent, posTarget, dt * s), where
                 s = dampen ? speed * |current - target| / dampen
                            : speed
    then the floor: minZ = posOffset.z * MinimumDistance - a FRACTION
                 of the live offset - applied only while the measured
                 wall is farther than the floor.

`eyeRadius` is 0.25, a field initialiser in the mod's own constructor
rather than a setting. `LoadSettings` multiplies `LongitudinalDistance`
by -1, so a positive setting means that many metres BEHIND, and the
three override sections flip the same way while every other value
carries over unflipped.

**The units carry over unconverted**, which is worth saying because the
sibling's do not: mwCamera works in MW units and divides by
`MW_UNITS_PER_METER` at the seam, while this mod's numbers are Unity
metres and the port's world is metres. A scale factor introduced here
later would be a bug, not a refinement.

## One ladder, and it is the mod's own

The mod's `CameraScrolling` arm, driven:

| | |
|---|---|
| first person, scroll out | third person, at the BASE distance |
| third person, scroll | one increment nearer or further |
| third person, past -10 | pinned; the wheel does nothing |
| third person, past -MinimumDistance | back into the head |

That is Morrowind's ladder, arrived at from the mod's own arithmetic
rather than imposed on it - which is what lets the two cameras share
one wheel honestly instead of by assertion.

One departure inside the ladder, and it is about feel rather than
shape: the mod reads `Input.GetAxis` once per Update and branches on
its SIGN, never scaling by the reading's magnitude, so three notches
inside one frame move the camera exactly as far as one. The port
queues DOM wheel events (MW-D30's lesson, for the same reason) and
spends them the same way.

## The player sprite (EOTB3)

`src/player/eotbBillboard.js`. **The state table is one law, not 168
rows.** `InitializeStates` writes out 21 arrays of 8 - idle, move and
death across melee, ranged and spell, plus the horse and both
lycanthrope forms - and every one of the 168 follows the same wheel:

    index   0  1  2  3  4  5  6  7
    record +0 +1 +2 +3 +4 +3 +2 +1
    mirror  .  M  M  M  .  .  .  .

which is classic Daggerfall's own 8-orientation layout - five drawn
records front to back, the left half drawn flipped. The port already
speaks it: `characters/mobilePerson.js` calls it "the MoveAnims wheel
(records 0-4 mirrored - the monster layout)".

That 0 of 168 deviate was checked mechanically against the IL, and the
check is permanent rather than a sentence: the mod's whole table is
vendored to `vendor/eye-of-the-beholder/states.json` and the port's
generated table is compared against it state for state in CI. The
sprite sweep is the other half and is fully generative - every table
times every orientation resolves to a filename and the vendored art is
asked for it, 168 asks with nothing listed, which is what catches a
base record off by one the moment it is typed.

Archives: `112364 + Graphics.OnFoot` (0..15), `112382 + OnHorse`
(0..4), and `112380 + (LycanthropyType === 2)` - so the WEREBOAR takes
the second and the werewolf shares the first with "none". A `>= 1`
reading would look just as sensible and be wrong.

The frame clock is 0.25s on foot - four frames a second, classic's own
mobile rate, which is what the port already runs townspeople at - and
0.0625s mounted, each scaled by `(2 - WalkCycleSpeed)`, so a higher
setting is a shorter frame and the dial reads forwards even though the
number it scales is a duration. Footsteps land on frames 2 and 4 of
the five-frame cycle.

`ReadyStance` is worth knowing about before it is reported as a bug: at
"When Idle" a player who draws a sword and walks is drawn walking
UNARMED, which is the setting doing exactly what it says.

## Mathf.RoundToInt has ONE HOME now

The orientation snap divides the angle by 45 and rounds, so a player
standing exactly side-on to the camera lands on a tie - and Unity
rounds a half to the nearest EVEN integer while JavaScript rounds it
toward +infinity. Get it wrong and the sprite flips one orientation
early on one side and not the other, which nobody would ever find by
looking.

The port had already ported that rule once, for DFU's horizontal
slider, and this slice was about to port it a second time.
`audit24`'s duplicate-declaration ratchet caught it - the "ONE DFU
MEMBER, ONE EXPORT" rule doing its job - so it moved to
`src/systems/mathf.js` and both callers import it. Two copies of a
rounding rule is two chances to get the tie wrong, and `player/` has no
business importing a UI slider to round a number.

## The view seam (EOTB4): one wheel, one ladder

`src/player/mwView.js` was already the one seam the four hosts call for
the Morrowind camera (MW-D25). It now asks a single question - **which
body can answer** - and routes the wheel, the frame and the body draw
to it:

| | |
|---|---|
| `fpArm` has built a Morrowind rig | the Morrowind body |
| it has not, and this mod is on | Eye Of The Beholder's sprite |
| neither | the wheel does nothing, exactly as before |

There is no setting to choose between them, because there is nothing
to choose. A player with Morrowind data has the Morrowind body; a
player without it never had a third person at all until now. The order
is the law and it is driven, not assumed: the Morrowind rig wins
wherever it exists, whatever this mod's switch says.

**The lane is wired and inert today**, and that is a fact rather than a
comment - it is gated on the mod's body being drawable, which EOTB5
turns on in one line. Until then a player sees exactly what they saw
yesterday, rather than a camera swinging out behind an invisible body,
which is the failure `mwView`'s own head has always refused for the
Morrowind rig.

### Two findings from the campaign

**The mod's own switch was unpinned.** Every fixture has it enabled -
it is on by default, as every vendored mod is - so deleting the check
changed nothing and the mutant lived. A default that happens to agree
with the code is not a test of the code.

**A stranded notch.** A click queued while the lane was shut is never
drained once the lane opens, because the lane's branch returns before
Morrowind's drain. It would sit there and fire whenever the lane next
closed - spending an old notch on a camera the player was no longer
looking through. It is dropped now. It was found by a test helper that
span *forever* waiting for the queue to empty, which also earned the
helper a bound: a test helper that can hang is a test suite that can
hang. The mutation runner was hardened in the same breath - it restored
the file only after the run, so being killed mid-flight left a mutant
in the tree; it restores in a `finally` now and counts a hang as a kill.

### The naming debt, stated

The file is still called `mwView.js` while serving a body that has
nothing to do with Morrowind. The name is written into four hosts and
ten test files, so renaming buys no behaviour and risks a great deal -
but a departure nobody wrote down does not exist, so the head says it
and a pin keeps the sentence there. **A housekeeping slice should
rename it** to something that means "the player's view".

## The body on screen (EOTB5)

`eotbSprite.js` holds the art and the clock; `eotbBody.js` holds the
one instance and hands `mwView` the two doors EOTB4 left open.

**The four hosts, and why none of them is touched.** Named:
`scenes/exterior.js`, `scenes/world.js`, `scenes/worldModes.js`,
`scenes/dungeonContext.js`. None carries a call, and that *is* the
wiring - all four build a weapon rig, which is the one place
`fpArm.attach` is called, so the body attaches there beside the arm it
stands in for. Four call sites would be four chances to forget one,
which is the failure MW-D15 recorded for the camera dep before it had
one home. The pin checks it as a **population** - every host that
builds a rig gets the body, and none carries its own call - so a fifth
host is covered without an edit.

### A twelve-megabyte JavaScript chunk, and a silent build

Vite inlines any asset under `assetsInlineLimit` (4 KB) as a base64
data URI. These sprites average **2.8 KB**, so all 3035 qualified:

    dist/assets/weaponRig-CltnXuFm.js   12,112,043 bytes

Twelve megabytes of base64 JavaScript, parsed before the game starts,
for art most players never look at. The build exited 0 and warned
about nothing.

The mod's art is excluded from inlining by path now - the same chunk is
**499 KB**. The rule is narrow, and it **falls through** for everything
else: a callback returning `true` for other assets would force-inline
them all regardless of size, which is the opposite mistake and just as
quiet. That second bug was written and caught here before it shipped,
which is why the pin *drives* the callback on four paths instead of
reading it.

Worth recording alongside: an earlier measurement of the same build was
**meaningless** - the module was not yet in the graph, so "the build is
unaffected" described a build that never included the file. And 3035
sprite files hold only **1852 distinct images**, so Vite's content
hashing collapses the duplicates for free.

### What the body does

Metres per pixel from `get_sizeMod` (0.019 on foot, 0.029 riding *or*
transformed - one arm covers both). The frame clock catches up over a
stall without eating frames and without hanging. The footfall follows
the picture, on frames 2 and 4 and no others. And a **mirrored sprite
is its own texture cache key**, because the renderer's billboard batch
has no flip - a shared key would make the second upload a silent no-op
with half the wheel facing the wrong way.

Under node the glob is empty by construction, so the whole lane stays
shut in the suite. That is asserted rather than assumed, because
otherwise "the tests pass" is partly an accident of the environment.

## Where the slices stand

EOTB0 (vendoring, provenance, the art payload, the doctrine gate, the
settings surface, the Features row, credits and the registry), EOTB1-
EOTB2 (the IL read and the camera), EOTB3 (the billboard's logic) and
EOTB4 (the view seam) and EOTB5 (the body, the art and the four hosts)
are done. EOTB6-EOTB7 - the remaining settings surface, the probe on a
real GPU, and the arc's records - are in flight.

AUDIT-EOTB2 (2026-09-16) below: the integration driven and repaired,
sixteen more members ported from the settings, and the assembly named
as the one thing the next slice needs.

**NOT SEEN ON A GPU.** There is no GL and no ARENA2 in the container
this was written in. Mac's eye is the gate.

## AUDIT-EOTB2 (2026-09-16): the body was a statue

**Mac: "Do an audit on eye of the beholder. Ensure its integrated 1:1. No half assed work."** It was not 1:1 and is not yet - this section says exactly how far it is, and what the rest needs. And a player, the same day, through Mac:
*"scrolling the mouse wheel down during regular gameplay makes some
wacky stuff happen."*

The two are one report. The wheel is bound to this camera (no window
open, scroll down = out of the head), and what a player without
Morrowind data saw behind their shoulder was **a sprite that never
moved** - drawn over by their own first-person weapon.

### What the audit could and could not read

The assembly is not in the tree and is not fetchable from here (see
"What is and is not ported"). So this audit is two things, kept apart
in every record it touched:

1. the INTEGRATION of what EOTB2-EOTB5 read off the IL, driven end to
   end through the only path a player has (`mwViewFrame`) and repaired;
2. the sixteen members the arc left "NOT DONE", ported from the
   settings' own names, descriptions and option labels - marked
   `[SETTINGS]` at every site, pinned so a later reading of the IL
   corrects a test rather than a player.

### The findings, in the wiring

**F1 - the state never reached the body.** The rig registered
`{ weaponReady, sailing }` and the hosts handed the seam `riding`; the
table chooser reads `stopped`, `sheathed`, `spellcasting`, `usingBow`,
`died`, `transformed` and `galloping`, and nothing wrote any of them.
`stopped` defaulted to true, so the body stood in the Idle table for
ever - gliding, unarmed, undying, a man's size in the saddle. AUDIT-EOTB
F1 had wired the clock ("the seam ticks the body") and pinned the
tick; the tick ran on an empty record. The record has ONE HOME now:
the rig registers it whole, and the motion half is the hosts' one bag
(`motionBagOf`) that the rig already receives through its camera thunk
for the widget's sake - so no host grew a line, and the pin derives
the population of thunks rather than naming four files.

**F2 - the first-person weapon drew over the third-person view.** The
widget's and the torch hand's `thirdPerson` gate asked
`fpArm.thirdActive()` - the Morrowind arm - and nobody else, and the
classic sprite path had no gate at all. `ToggleBillboard`'s two hides
are ported behind the mod's own Compatibility keys; the draw returns
before any first-person picture while the sprite body is the one on
screen, and the FPV horse hides the same way (`mountRig`).

**F3 - `StartInThirdPerson` had no caller.** The mod ships it ON
("Determines the POV when starting or loading a game") and the arc's
`start()` was dead. It runs at the rig's attach (a new game) and at the
load door (`mwViewLoadPose`, which now restores BOTH lanes where
`world.js` restored the Morrowind camera alone). **This is the one
change a player will notice at boot**: a player without Morrowind data
now starts behind their own shoulder, as the mod's installer does. The
switch is on the Mods pane.

**F4 - the `SwitchShoulder` key was declared and never read.** The port
had re-bound it to B (departure 3) and nothing polled it. Both mod
keys - the shoulder and AutoTogglePerspective's `ToggleInput` - are
polled DOWN-edge off the hosts' raw set, the way the torch mod's are,
through the one KeyCode converter. Driven through a real rig.

**F5 - a rider was sized as a man.** `draw` passed `riding: false,
transformed: false` to `spriteSize` whatever the state; it reads the
live record now.

**F-CACHE - the sprite cache collided across archives.** The body's
texture map was keyed by record name alone, and the horse and lycan
tables reuse the on-foot numbering over their own archives - so
`IdleHorse`'s `0-0` and `Idle`'s `0-0` shared one slot, and a rider
would have been drawn with the on-foot sprite's pixels. Keyed by
archive and record now, batch and cache alike. Found by the F5 pin,
which asked for the rider's size and got the walker's texture.

### The sixteen, from the settings

The one-shots: an attack plays its stance's table once at the frame
clock and the loop resumes; the drawn bow holds its last frame until
the string lets go; the spell has its own door; a transformed player
attacks with claws. `AttackStrings` by its four labels - None,
Mirror (the whole clip flipped, alternating swing by swing, `MirrorTime`
reverting it), PingPong (turned at `n - 1 - PingPongOffset`), Mixed
(one of the two, rolled). The death table plays once and holds for as
long as the entity is dead. `TurnToView` decides whether the sprite
faces the view or the way it walks - shipped at "When Weapon Readied",
so an unarmed player backing away is drawn walking toward the camera.
`SyncFootsteps` hands the stride to the picture: a foot on frames 2 and
4 of a move table, the hosts' distance machine silenced under it and
its anchor kept so no long step fires when it takes the stride back;
the saddle keeps DFU's hoofbeats. The nine-row `AutoTogglePerspective`
table is applied when the situation changes (never every frame - a
`FirstPerson` row re-applied each frame would fight the wheel), the two
transition rows on the building's doors, `ToggleInput` arming it; the
bundle ships every row at Don'tChange, so nothing moves by itself.

One verbatim quirk kept: `Graphics.MirrorTime` says "Set to 0 to
disable" and the bundle's own slider is Min 1.0, so the disable is
unreachable from the pane in DFU as well. The port declares the
bundle's range; the revert arm still honours a 0.

### What the assembly is still needed for

`GetMeleeAnimTickTime` (the one-shots' tick), the wagon (`ShowCart`),
the per-sprite offsets (`spriteInfo.json`, 288 rows - sign unknown),
`TorchOffset`, and the exact mechanics behind the four `[SETTINGS]`
laws above. Drop the shipped `.zip` where the port can read it and
`test/eotb_scope.test.js`'s recipe reads it in an hour.

### The pins

`test/eotb_audit2.test.js`, 17 tests: the state law and the statue
walking through the seam; the rig's whole record derived from source
and every host's thunk; the one-shots, the hold, Mirror and its revert,
PingPong's order, Mixed's roll, the flip reaching the sprite KEY; the
death hold; TurnToView on all four labels; the size per state and
`Graphics.Enable`; the stride's ownership and its footfall frames, and
the stride machine yielding, alternating and halving; the two hides,
their keys, the rig's gate order and the mount's; the auto-toggle table
on a situation change, its arm, the two doors and the shipped
Don'tChange; StartInThirdPerson at both doors; the two keys driven
through a real rig; and the evidence marks themselves. The scope
ledger moved sixteen rows and gates the arithmetic (13 + 16 = 29 of
62). `ht1_handheldtorches.test.js`'s context pin widened to the
sprite's hide.

**Campaign: 20 mutants, 20 killed.** The rig's `weaponReady` no longer
reading as unsheathed; the motion bag no longer moving the sprite (the
statue itself); a one-shot never reaching the drawn table; the drawn bow
not holding; Mirror not alternating; MirrorTime never reverting; the
death clip outliving the death; the rider sized as a man again; the
cache keyed by record alone again; the saddle losing its hoofbeats;
Don'tHideWeapon ignored; PingPongOffset ignored; a swing in flight not
turning to the view; the first frame applying a row; a row re-applied
every frame; a disarmed table still taking the door; the distance
piling up under the sprite; the key firing every frame it is held;
StartInThirdPerson dead again; the load door forgetting the sprite
camera. Two of them survived the first pins and taught them where to
bite - a row re-applied every frame is invisible while the row agrees
with the view, so the pin scrolls the player back into their head
first; a first-frame apply is invisible from first person, so the pin
starts in third. NOT SEEN ON A GPU - there is still no GL and no ARENA2 in
the container. Mac's eye is the gate, and the first thing it should
check is a walk, a swing, a horse and a death, in that order.
