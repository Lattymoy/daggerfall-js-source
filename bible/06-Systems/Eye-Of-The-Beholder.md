# Eye Of The Beholder (EOTB) - third person without Morrowind

**Eye Of The Beholder 2.1**, RedRoryOTheGlen. The camera, the player
sprite and the cart, read off the shipped assembly's IL - **EOTB-IL
(2026-09-16)**: the assembly is in the tree now, every law in the arc
cites its IL offset, and the two things Mac saw (the frame chopping,
the sprite turning the wrong way) were both in it. See "What is and is
not ported" below for the count - forty-five of sixty-one authored
methods, sixteen with no twin here, checkable in
`test/eotb_scope.test.js` - and the EOTB-IL section at the foot for
the findings. Vendor record and the permission line:
`vendor/eye-of-the-beholder/README.md`. Registry row:
`01-Overview/Mod-Registry.md`.

## What is and is not ported

The arc called itself **1:1** in six places. AUDIT-EOTB counted the
methods and it was not; AUDIT-EOTB2 (2026-09-16) ported what the port
could reach without the assembly and marked those readings
`[SETTINGS]`; EOTB-IL (the same day) read the assembly itself, and
this section is the count as the IL has it.

**THE ASSEMBLY IS IN THE TREE.** `vendor/eye-of-the-beholder/Eye Of
The Beholder.dll` is the `.dfmod`'s own TextAsset, taken out of the
archive Mac handed over (`Eye_of_the_Beholder-762-2-1-1775438888.zip`)
by `tools/eotbIl.mjs` through the port's UnityFS reader, and
`vendor/eye-of-the-beholder/il/Eye_Of_The_Beholder.il.txt` is every
method body of it as `tools/ilDump.py` prints it (dnfile + dncil;
`monodis` segfaults on this one). The `[IL]` offsets cited beside every
law in `src/player/eotb*.js` are offsets into that dump.

The assembly carries **61 authored methods** - 28 on `EyeOfTheBeholder`
(the camera), 32 on `PlayerBillboard` (the sprite), one on
`PlayerBillboardState` - once constructors, the four compiler-built
coroutine state machines, the event accessors and the three
compiler-lifted lambdas are struck. AUDIT-EOTB, writing without the
assembly, had counted 62 and listed a `PlayerBillboard::InitializeTextures`
that does not exist; the texture walk is the state's alone. The port
implements **forty-five** of them, every one read off the IL:

| IL method | here |
|---|---|
| `get_posOffset`, `get_offsetRidingMod` | `posOffset` (eotbCamera.js) - the mirrored base arm scales Z alone |
| `CheckBounds`, `SetVectorBounds` | `checkBounds`, `setVectorBounds` - the bounds seed at 2.0 |
| `Update` | `tick` (the ladder, on the Z captured BEFORE the notch) and `eye` (the target-and-smooth, the shoulder's revert probe) |
| `LateUpdate` | `autoToggleRows` (eotbBillboard.js), applied by `tick`; `UpdateWagon` before the offset gate |
| `ToggleOffset`, `ToggleBillboard` | `toggleOffset` → `toggle` (eotbBody.js): the billboard, the FP flag, the torch, the hands |
| `LoadSettings` | `readCameraSettings` - `autoPOVSwitch` derived from the nine rows - and `loadSettings`' ToggleOffset re-run |
| `Start`, `OnNewGame`, `OnLoad` | `start`, `onNewGame`, `onLoad` |
| `OnPositionUpdate` | `onPositionUpdate` - the floating origin |
| `OnTransitionInterior`, `OnTransitionExterior` | `transition`, on the building's doors and the dungeon's |
| `SwitchShoulder` (inside `Update`) | `switchShoulder` - gated on X, no clock touched |
| `CheckWagon`, `SpawnWagon`, `UpdateWagon` | `checkWagon`, `createEotbWagon`, `updateWagon` (eotbWagon.js) - the cart |
| `InitializeStates` | `STATE_TABLES` |
| `LoopIdleBillboard` | `loopIdleBillboard` (eotbBody.js); `chooseTable` is its table arm |
| `UpdateOrientation` | `updateOrientation` (eotbBody.js); `orientationFor` is its angle - THE TURN |
| `get_frameTime`, `get_sizeMod` | `frameTime`, `sizeMod` |
| `PlayFootstep`, `EnableVanillaFootsteps`, `DisableVanillaFootsteps` | `playFootstep`, `initialize` (eotbBody.js) → `systems/footsteps.js`'s `spriteStep` arm |
| the six `Play*Animation` | `playMeleeAttack`, `playRangedAttack`, `playRangedAttackHold`, `playSpellAttack`, `playLycanAttack`, `playDeath` |
| the three coroutines | `startClip` / `holdPhase` (eotbBody.js), `pingPongFrames` (eotbBillboard.js), stepped by `advanceClip` |
| `GetMeleeAnimTickTime` | `meleeAnimTickTime` - `animTime * 5 / frames` |
| `UpdateBillboard`, `UpdateBillboardDelayed`, `UpdateBillboardDelayedCoroutine` | `updateBillboard`, `updateBillboardDelayed`, `runDelayed` - the three-frame queue |
| `UpdateMaterial` | `material` - invisible / shade / blending |
| `Initialize`, `OnLoad` (billboard) | `initialize` |
| `InitializeTextures` (state) | `preload` |
| `Update`, `LateUpdate` (billboard) | `update`, `lateUpdate` |

**Sixteen have no twin**, every one a row in `test/eotb_scope.test.js`
with its reason: the Unity lifecycle and component methods (`Awake` on
both types, `Init`, `get_pivotLocal`, `get_IsReady`, `SetKeyFromText`,
`SpawnBillboard`, the billboard's `FixedUpdate` - the TravelOptions
hook); the mesh and material handling the port's billboard batch
replaces (`AssignMeshAndMaterial`, `MakeBillboardMaterial`);
`OnUpdateSailing` and `FreeRein_GetMoveVector` (Come Sail Away and Free
Rein, neither in the port); `MeleeDamage` (the attack-from-body ray,
moot because the port's swing and activation already start at the
player's own head, which the view never moves); `MessageReceiver` and
`ModCompatibilityChecking` (DFU's mod bus); and `get_scaleOffset`,
which is **dead in the assembly** - no caller anywhere in the IL, so
`Animation.GlobalOffsetScale` is declared INERT on the pane rather than
invented a meaning.

The ledger is checked against the dump itself: every row must be an
authored method in it and no authored method may be missing, a row
claiming a port must name a symbol that exists, and a row claiming
none must not have quietly grown one. "1:1" is a sentence; the table
is the check.

### The dead exports

Four exports of the arc are called by nothing - not even their own
module - and each is listed in `test/eotb_scope.test.js` with a reason,
the set DERIVED rather than typed: `tableKeys` (what a pre-load would
fetch per table; the body walks `TABLE_FRAMES` itself), `OVERRIDE_ORDER`
(the override sections' precedence, spelled once to read `posOffset`
against), and the two label tables `TURN_TO_VIEW` and `ATTACK_STRINGS`
(the pane's words; the laws read the numbers). `scaleOffset` left the
list at EOTB-IL: deleted, because its getter has no caller in the
assembly either.

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
number it scales is a duration. Footsteps land on the EVEN frames of
the walk (`frame % 2 == 0`; every fourth on the eight-frame horse
tables) - EOTB-IL corrected the "frames 2 and 4 of the five-frame
cycle" this page first recorded: no table has five frames.

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
INLINE1 (2026-09-20) retired the by-path exclusion this paragraph describes: the rule is the CLASS now - nothing under vendor/ is inlined - because the allow-list it had become was an enumeration, and Shield Widget's 275 small sprites proved it (bible/07-Rendering/Rendering-Arc.md, INLINE1). This mod's art is excluded exactly as before; the sentence "every other vendored texture keeps the default" no longer holds.

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
the picture, on the even frames and no others (EOTB-IL). And a **mirrored sprite
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

EOTB-FLIP (2026-09-16) at the foot: Mac's eye opened, and the first
thing it saw was the body on its head. The rows, the right way up.

EOTB-IL (2026-09-16), last: the assembly read, every law re-derived
from its IL, the frame chopping and the backwards turn fixed, the cart
ported, the ledger corrected to 61 methods.

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

**EOTB-IL, the same day: read. Every item in this list is ported, at
the foot of the page.**

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

## EOTB-FLIP (2026-09-16): the body stood on its head

**Mac: "The character is upside down (classic sprite)."** It was. The
first thing Mac's eye found, on the first walk behind the shoulder
that AUDIT-EOTB2 made possible, was the whole sprite drawn feet to the
sky.

### The root cause, and the class it belongs to

`formats/color32Order.js` holds the port's texel law in one place:
every texture that reaches the GL is in getColor32 order, row 0 the
picture's BOTTOM, and the billboard batch samples the quad's top at
v=1 - the LAST row. A decoded PNG is the other way up: its row 0 is
the raster's TOP. A picture that enters through a PNG-shaped door
crosses `toColor32` once, on the way in, and nowhere else.

The body's decode was its own door. `decodeSprite` loaded an `Image`,
drew it on an `OffscreenCanvas`, and handed the upload
`getImageData`'s bytes as they came - top row first - to a WORLD
billboard that reads them bottom-up. Nothing in between flipped, so
every one of the 3035 sprites was uploaded upside down. The mirror for
a flipped state (`flipRows`) swaps pixels WITHIN a row and never
touched the row order, which is why a flipped state was on its head
exactly as an unflipped one was.

This is the class `color32Order.js` records three times over and this
arc walked into a fourth time: AUDIT 62 F26's seasonal flats drawn
vertically mirrored beside the classic ones, ROAD-H H4's texture pack
with the same gap, HT3's held torch flipped the other way for a screen
quad. Each time the lesson was the same - the door converts, ONCE,
through the tree's converter - and each time it was learned by a door
that had been written before the law was, or without reading it. The
body's decode dates from EOTB5 and named a canvas as the reason it
could not be pinned; it never named which way up the canvas answers.

### The fix

The decode is the DROPPED TORCH's door now, to the letter:
`toColor32(await decodePng(bytes))` (scenes/droppedTorches.js), where
`decodePng` is `systems/textureReplacement.js`'s decoder that the rest
of the world's PNG billboards already take. `eotbSprite.js` gains
`worldOrderColors(image)`: `toColor32` once, then the same bytes viewed
as a `Uint32Array` a pixel, which is the shape `flipRows` and the
upload path read. No `Image`, no canvas, no `getImageData` - the three
browser-only names the file used to carry are gone, and a decode that
fails answers a rejection as the Image's `onerror` did. `flipRows` is
documented as what it always was: an order-agnostic mirror.

Nothing else moved. The sprite key, the cache, the clock and the hides
are as AUDIT-EOTB2 left them; a second flip anywhere on this path is
how a picture ends up flipped twice, and the pin below is what stops
one being added.

### The pins

Two, appended to `test/eotb_audit2.test.js` (19 in the file now). A
2x3 raster with a distinct colour per pixel goes through
`worldOrderColors` and the pin asserts that pixel 0 of the answer is
the raster's BOTTOM-left, that the answer is byte-equal to
`toColor32`'s, and that `flipRows` over it swaps x and leaves the row
order alone. The second reads `decodeSprite`'s source: `decodePng`
then the converter, the converter imported from `formats/
color32Order.js`, and none of the three canvas names anywhere in the
file. **Mutant: the converter dropped from `worldOrderColors` (the
raster handed on as it came) fails the first pin and nothing else** -
which is the right shape for a law that only the picture can see.

Still NOT SEEN ON A GPU from here. Mac's eye is the gate, and it has
now caught one thing; the walk, the swing, the horse and the death
remain the order to check.

## EOTB-IL (2026-09-16): the assembly, read

**Mac: "Next up I want to tackle the Eye of the Beholder mod
integration. Theres still some issues with the mod and it needs to be
1:1 with the uploaded file. No exceptions. Notable issues include
1. Frame chopping between animations 2. Sprite turns in wrong direction
on input."** And the uploaded file: the shipped
`Eye_of_the_Beholder-762-2-1-1775438888.zip`.

### The assembly is in the tree

The `.dfmod` is a UnityFS archive and `Eye Of The Beholder.dll` rides
in it as a TextAsset. The port's own reader (`formats/unityBundle.js`)
opened it - nothing new was needed - and `tools/eotbIl.mjs` writes the
54,272-byte assembly out beside the art. `tools/ilDump.py` (dnfile +
dncil, both installed through the proxy; `monodis` segfaults on this
assembly) prints every method body, and that dump is vendored at
`vendor/eye-of-the-beholder/il/`. Two things about the dump worth
knowing before reading it: the offsets on the left are hex `IL_xxxx`
and every `[IL]` citation in the arc is one of them; the branch
targets on the right are DECIMAL and absolute, as dncil gives them,
so `brfalse.s 8471` means IL_2117.

Every `[SETTINGS]` law AUDIT-EOTB2 wrote is gone. Each is `[IL]` now
with its offset, and where a reading was wrong the offset that
corrects it is cited beside the law.

### Mac's two reports, both in the IL

**1. "Frame chopping between animations."** The port ran EVERY table on
one five-frame clock (`CLIP_FRAMES = 5`). The bundle's tables are not
five frames: `InitializeStates` builds them from records of ONE frame
(the idles), TWO (the ranged and spell moves, the deaths), FOUR (the
walk), SIX (the melee swing) and EIGHT (the horse) - `TABLE_FRAMES`,
pinned against every archive's vendored art. A four-frame walk driven
to frame 4 asked for a sprite that does not exist and drew the last
one that did; a six-frame swing was cut at five. And the one-shots do
not run on the walk clock at all: `GetMeleeAnimTickTime` is
`animTime * 5 / frames` (IL_5127-IL_5139), the bow, the spell and the
claws tick at 0.125 and the death at 0.5, and the frame write goes
through a THREE-frame delayed coroutine (`UpdateBillboardDelayed`,
IL_3f6c-IL_3fd3), which is why the mod's transitions land a beat after
the state changes and the port's landed at once.

**2. "Sprite turns in wrong direction on input."** `UpdateOrientation`
is `SignedAngle(toCamera, facing, up)` (IL_4779-IL_4786), negated and
snapped. The port had the two arguments the other way round, which
negates the angle, which runs the wheel backwards: a player turning
left was drawn from the right. `orientationFor(facing, toCamera)` is
the IL's order now, and THE TURN pin holds the camera off the left at
index 6 and off the right at 2. Worth a note for Mac's eye:
`characters/mobileUnit.js`'s `mobileOrientation` - DFU's own
`OrientEnemy` wheel for every foe - uses the OTHER sign, the one the
old port had. That is DFU's law for foes and this mod's for the
player, and both are pinned as they are; if a foe ever looks wrong
from the side, that is where to look.

### Everything else the IL said

The list is long because the arc had guessed at most of it:

- **The table chooser** (`LoopIdleBillboard`, IL_4328-IL_4499) has NO
  death arm - the death is a one-shot that freezes the loop - and the
  horse gallops on a SPEED (`MoveDirection.magnitude > 10`), not a run
  flag. A transformed player stopped is `IdleLycan` sheathed and
  `IdleMeleeLycan` drawn; moving, `MoveLycan` either way.
- **The facing** (`TurnToView`'s ladder, IL_45c7-IL_4733): floating
  overrides everything to the camera; stopped, the LAST move direction
  is the facing, so a player who stops keeps the side they walked on.
- **The speed modifier**: running halves the frame time, crouching or
  sneaking doubles it.
- **The footsteps** land on `frame % 2 == 0` on foot and `% 4` mounted,
  at `FootstepVolumeScale * SoundVolume * (FP ? 1 : 2)` - no half-speed
  halving - and the clip is `PlayerFootsteps`' own choice, copied
  (IL_55e8-IL_585b).
- **Mirror** flips only the FRONT and BACK records (orientations 0 and
  4) of twelve named tables, while the swing count is odd, and reverts
  after `MirrorTime` - 0.1 s in first person. **PingPong** runs forward
  while `i < n/2 + offset` then back down to 1; **Mixed** takes the
  ping-pong every FOURTH swing, not a roll. **The hold** draws down to
  frame 0 and freezes on the last until the string lets go.
- **The death** freezes the loop at 0.5 s a frame and `Initialize`
  clears `died` (the load door).
- **The orientation** is throttled at 0.1 s (`orientationTime`), forced
  on a state change, and `TorchOffset`'s three modes move the handheld
  torch's light with it: Vanilla leaves it, Billboard puts it on the
  sprite, Selfie mirrors it.
- **UpdateMaterial** is three modes off the concealment flags -
  invisible at alpha 0.4, shade BLACK at 0.6 (a fourth conceal mode in
  the renderer, `uConceal.x == 4`), blending at 0.8.
- **The first-person billboard** stands ON the camera point, so its
  orientation reads 0 through the zero vector, and `Visible` is drawn
  flipped so the player sees their own front.
- **The placement** has three arms: swimming on exterior water, crouched,
  standing - and the XML x-offset is NEGATED for a mirrored record.
  The 288 per-sprite offsets are APPLIED now (their sign was the one
  thing AUDIT-EOTB2 would not guess).
  **EOTB-FEET (2026-09-16, Mac: "the sprite not connected to the
  floor. Like you walk hovering").** The three arms place the quad's
  CENTRE - Unity's billboard mesh is centred on its transform - and
  `place()` handed that centre to a renderer whose billboard is
  BOTTOM-ANCHORED (`BB_VS`: "centre sits half a height above the
  placement base"; the world's flats and the peers' dolls all hand it
  the base). The body stood half its own height - a metre, for a
  2.09 m sprite - in the air on every arm alike, and the pin that
  should have caught it asserted the centre at `size/2` and called it
  "the bottom at the feet". The arms stay the mod's; the number
  handed over is now the base (the centre less `size/2`), the pin
  asserts the base AT the feet, and the two conventions are pinned
  where they meet (the shader line and the conversion).
- **The camera's auto-toggle** is three independent "just changed"
  blocks and one fan-out (IL_1847-IL_1c6e), so several rows can fire in
  one frame; `autoPOVSwitch` is DERIVED from the nine rows
  (IL_10e1-IL_112d) and the bundle ships every row at Don'tChange, so
  the table ships DISARMED - the port had armed it.
- **The bounds seed at 2.0**, not zero; **the ladder tests the Z
  captured before the notch** (so it leaves third person the notch
  AFTER crossing the near end, and hovers two notches at -10); **the
  mirrored base arm scales Z alone** by the riding offset; **the
  shoulder's revert** re-probes from the camera target's height with
  the lateral re-centred, and the whole block is skipped while X is
  zero; **SwitchShoulder** touches no clock.
- **OnNewGame / OnLoad** with the table armed apply ONLY the transition
  row for where the player stands, even when it is Don'tChange;
  disarmed, `StartInThirdPerson`. **OnPositionUpdate** carries the
  smoothing across the floating origin. **The transitions** are
  registered on the dungeon's doors as well as the building's.
- **The two keys** fire on the RELEASE edge (`GetKeyUp`).
- **`GlobalOffsetScale` is inert** in the mod itself: `get_scaleOffset`
  has no caller. The pane says so.
- **The cart** (`ShowCart`): model 41239 through the host's own mesh
  pipeline, shown ten metres behind the body on the first frame and
  settling 2.49 m off; it follows past 2.5 m, keeps its LAST offset
  past 10 (a teleport keeps the cart where it was relative to you), a
  ground probe from 0.6 m behind its own forward and 2 m up casts 10 m
  down and lifts it one metre off the hit, `LookAt` every frame, and a
  `sin(10t) * (3 + sin t)` roll while it moves (gentler on a path). It
  is registered with the one activation ray at 3.2: Info names it ("You
  see your wagon"), any other mode opens the pack with the wagon. Both
  exterior hosts carry the three doors; the interior hosts have none,
  because DFU puts the player on foot at every interior door, and the
  seam says so by name. One port-side necessity, recorded: the cart
  shifts with the floating origin, which Unity's FloatingOrigin does
  for every world object and the streaming host must do by hand.

### The ledger, corrected

AUDIT-EOTB, writing without the assembly, counted 62 authored methods
and listed a `PlayerBillboard::InitializeTextures` that does not exist
- the texture walk is `PlayerBillboardState`'s alone; the 33rd body on
the sprite is the compiler's `<FixedUpdate>b__96_0`. The count is
**61**, and `test/eotb_scope.test.js` now reads the vendored dump: a
row must be an authored method in it and none may be missing. Forty-
five ported, sixteen with no twin, and no row is NOT DONE.

### The pins

`test/eotb_billboard.test.js` (the laws: `TABLE_FRAMES` over all 23
archives' art, THE TURN, the facing, the speed modifier, the footstep
frames, the chooser, the one-shots' arithmetic, Mirror's records, the
auto-toggle blocks), `test/eotb_body.test.js` (the machine: the chop
fix, the walk clock, the footfalls and their volume, the preload, the
mirror upload, the stale batch, the placement arms, the FP billboard,
UpdateMaterial, the four hosts), `test/eotb_audit2.test.js` (the
integration, rewritten against the IL), `test/eotb_camera.test.js`
(seven EOTB-IL pins appended), `test/eotb_wagon.test.js` (14, new) and
`test/eotb_scope.test.js` (the ledger against the dump).

**Campaign: 30 mutants, 30 killed.** Hand-picked on the new laws, each
applied in place and run against the EOTB suites, the race, the rig
seam and the footstep pins: SignedAngle's arguments swapped back (THE
TURN); the walk table five frames again (the chop); the melee tick at
`* 4`; Mixed every second swing; Mirror on the even count; the gallop
on any speed; the horse footstep every second frame; running not
halving the frame; the auto-toggle fanning out whenever drawn; the
death tick 0.25; the orientation throttle gone; the delayed write
landing at once; the third-person footstep volume 1; shade drawn dark
instead of black; the XML x not negated for a mirrored record; the
bounds seed at zero; autoPOVSwitch armed at zero rows; the ladder on
the fresh z; the mirrored arm scaling Y; OnLoad ignoring the armed
table; SwitchShoulder ungated on X; the cart settling at 2.5, following
the new delta after a teleport, sitting on the hit, losing its path
wobble, remembering the offset after the move, following on foot; the
torch no longer racing the cart; the sprite footstep volume unscaled;
the mod keys on the press edge. Every one named the pin that caught it.

**NOT SEEN ON A GPU.** There is still no GL and no ARENA2 in the
container this was written in. Mac's eye is the gate; the order to
check is a walk (four frames, no repeat), a swing (six, at the swing's
own pace, a beat late), a turn to the left (drawn from the left), a
horse, a death, and the cart behind a wagon-borne player.

## EOTB-WALL (2026-09-17): the camera in the wall

Mac: "3rd person clips through walls and ceilings allowing you to see
outside wall bounds. Morrowind 3rd person doesnt have this issue."

**Why the mod's own law lets it happen.** `CheckBounds` (kept as the IL
has it) casts one ray per AXIS of the eye's basis from the head, and
`SetVectorBounds` clamps each offset component by its own axis's answer.
Three axis casts never measure the DIAGONAL the camera actually stands on:
a wall at the back-right corner is missed by the "right" cast and the
"back" cast alike, a ceiling on the back-up diagonal (looking down, the
eye sits up and behind) by the "up" and the "back". And `posCurrent` lags
the pulled-in target by `MoveTowards`, so a turn against a wall leaves the
eye inside it for as many frames as the smoothing takes. The Morrowind
camera has neither problem because it casts ONE ray from the focal along
the eye's own direction and pulls in (`mwCamera.js`, camera.cpp:200-206).

**The port's cast.** After the mod's casts and the minimum-distance floor,
`eye()` casts once from the head to the SMOOTHED eye, `|eye - head| + 2 *
eyeRadius` long, and pulls the eye in to `hit - 2 * eyeRadius` along that
line - the mod's own clearance, so a wall straight behind answers the same
number `CheckBounds` gave (the two pins that measure it are unchanged).
The target is untouched, so the smoothing walks the camera back out when
the wall is gone, and a wall that appears mid-walk pins the camera where
it IS. A DEPARTURE from the assembly, the fourth (the wheel, the scroll
default and the shoulder key are the other three), recorded in the Ledger
row. Pinned in `test/eotb_camera.test.js` (26: a diagonal wall the axis
casts miss, a ceiling on the back-up diagonal, the straight-back number
unchanged, the walk back out, the pin on the smoothed eye; the per-axis
pin tells the port's cast from the mod's by its length);
`tools/mutants/eotbwall.json` 4 - 4 dead.

## RIDE-POV - the Morrowind body has no saddle (2026-09-20)

Mac: *"When riding the horse with the morrowind model, you should be
exempt from using 3rd person"*.

The sprite body rides - EOTB has saddle states of its own, on foot and
mounted, and its lane is untouched here. The Morrowind third-person body
has no riding animation and would stand through the horse. So the view
seam (`player/mwView.js`) keeps the Morrowind lane IN THE HEAD while the
host says `riding`: a rider in third person is put there on the frame,
before any queued wheel notch can cross out, and the notch is dropped
rather than left to fire on dismount; while mounted the wheel refuses to
leave the head (`mwViewWheel` reads the saddle the last frame recorded,
because the wheel has no state of its own). The zoom distance is kept,
and the view is NOT put back on dismount - a transition, as MAP-POV's is;
the wheel is the player's again the moment they are on foot.

The door into the head is ONE function, `mwIntoHead()` - the camera's
restore door, the rig moved with it, the distance kept - shared by the
map (MAP-POV, `mwViewFirstPerson`) and the saddle. It reads the `riding`
every host already hands the seam (AUDIT-EOTB F3b derives that from the
four call sites), so no host learns the rule. `scenes/exterior.js`'s
standalone ride-view predates the machine and skips the seam while
riding (its own recorded law); there the rule is moot.

**Pins** (`test/ridepov.test.js`, 4 - with `canThirdPerson` and
`setViewMode` stubbed to serve, as `eotb_view.test.js` stubs the first,
because without a body the frame's own fallback would mask the rule): a
third-person rider lands in the head on the frame with the host's own
eye, keeps the distance, and is left there on dismount; the wheel is
refused in the saddle, a notch queued before it is dropped, and the wheel
returns on foot; the EOTB lane rides on and the map's door still moves
it; by source, the one door, the rule before the flush, the wheel's read,
and every host's `riding` (generative). **Mutants**
(`tools/mutants/ridepov.json`): 6 mutations, 6 dead - the rule gone, the
notch kept, the rule after the flush, the wheel blind to the saddle, the
saddle never cleared, the saddle emptying the EOTB lane too.


## HT-WAIST (2026-09-24): a lantern at the sprite's hip - NOT the mod's

Handheld Torches' port-own `Handling.LanternsAtWaist` (Handheld-Torches.md HT-WAIST; Ledger A) hangs a lit lantern at
the waist, and Mac asked for it on this body too: "Let it be a separate animated item on movement with eye of the
Beholder sprites also". The mod draws no light on its billboard at all - TorchOffset (IL_47df) only moves
PlayerTorch - so this is an ADDITION beside the IL's machine, never inside it: `stepLantern` runs after the three
Unity phases in `tick`, `drawLantern` after the body's own draw, and nothing of `PlayerBillboard`'s state is read
but its facing (`lastMoveDirection`), its frame clock and the placed base (`place()`).

- **The picture** is the Lantern template's own world texture (`templateByIndex(LANTERN_TEMPLATE)`: TEXTURE.200
  record 10), palette-mapped with its 0xFF mask cut out (GetInventoryImage's removeMask), loaded from the player's
  ARENA2 by `loadLanternArt` - never vendored. Handheld Torches' own lantern frames are a gloved HAND holding the
  lantern, and cutting the lantern out would be making new art from the author's.
- **The hang**: by its top from the sprite's right hip - half the quad's height above its base, 0.2 m out along the
  facing's right (both with `BillboardScale`), nudged 6 cm toward the eye so it never shares the body's depth; 0.3 m
  tall at scale 1.
- **The swing** is `systems/lanternSwing.js`, the Morrowind body's own law, fed the sprite's walk: the speed the Move
  tables step at along the facing, the facing's turn, and the stride phase off the frame clock. It is drawn as the
  quad TILTED in the view plane (the billboard shader takes its right and up per call; the base is set so the top
  stays on the hook) and SHORTENED as it swings along the line of sight.
- **It hangs** in third person, on foot, alive and in your own form - the rider's sprite sits on a horse and the
  beast's is another body - and it is **drawn from behind only** (HT-WAIST-BACK, below). It lights you from its middle
  (`setPlayerWaistLightOverride`) wherever it hangs, seen or not; the point is cleared the moment it stops hanging -
  put out, the body toggled off, the graphic off, and each frame the Morrowind lane has the view (`standDown`, called
  from mwView's Morrowind branch).
- **Owner**: its batch is created when first drawn (at its full size - the renderer's cull sphere is the batch's own -
  and minted again when `BillboardScale` moves it) and destroyed when it stops hanging - not when the sprite turns its
  front to the eye; its picture stays in the renderer's cache under `htwaist-lantern`, as the body's own sprites do.
  With no lantern at the waist nothing of it runs - no batch, no draw (`eotb_body.test.js` reads the last batch as the
  body's).

**HT-WAIST-BACK (2026-09-24, Mac, looking at screenshots of the lantern at the hip from the front, the side, walking
and behind: "Just have it show on the back of the sprite, not all angles. Make sure all the eye of the Beholder sprites
get this change"; then, of the back diagonals it first let in: "It still shows on the back side angle").**

- **The rule** (`player/eotbLantern.js isRearView`): the lantern's picture is drawn only from straight behind - the
  one view that shows the sprite's back square on, orientation 4 - and from none of 0, 1, 2, 3, 5, 6, 7: not the back
  diagonals 3 and 5, which draw the back three-quarter. It is asked of the
  orientation UpdateBillboard last PAINTED (`shown.orientation`, the delayed repaint's), not of the one just measured,
  so the lantern appears and goes with the picture under it.
- **The numbering, verified.** `orientationFor` (IL_4779-IL_47a3) makes 0 the camera in front of the facing and 4 the
  camera behind it (the EOTB-IL order: SignedAngle from the camera to the facing); the wheel draws records
  +0 +1 +2 +3 +4 +3 +2 +1 for orientations 0-7, mirrored at 1-3 (checked against the IL, 0 of 168 deviate). Which
  record is a back was read off the vendored art, upscaled side by side: archive 112364's idle (records 0-4), walk
  (5-9) and armed walk (20-24), and 112372's idle (0-4) - +0 is the face, +1 the front three-quarter, +2 the profile,
  +3 the back three-quarter (shoulder blades, the seat, the heels) and +4 the back. Every on-foot set shares the wheel,
  so the rear view is the one drawing +4: orientation 4 (`BACK_RECORD`). `mirrorFlips` (the Mirror string's flip at 0 and 4) turns
  a front or a back over, never one into the other. A body that has never moved faces nowhere (the IL's Vector3.zero,
  which SignedAngle reads as 0) and paints its front: no lantern until it has turned.
- **Unseen, it still hangs**: the swing runs on (`stepLantern` asks whether it HANGS, not whether it is drawn), the
  batch is kept, and the light stays at the hip - so turning round neither restarts the swing nor moves the light.
- **Every EOTB sprite**: other players drawn online as the on-foot set they chose (DISC23-B's walkers,
  `net/peerRiders.js`) hang it too, off their pose's `hl` (HT-WAIST-NET), by the same rule, art, hang and swing law,
  swung off their own drawn motion; their riders and beasts hang none, as yours do not. It lights nothing on their
  side (the waist light is the local player's). Handheld-Torches.md HT-WAIST has the peers' wiring.
- **One home**: `player/eotbLantern.js` holds everything the two share (the rule, `loadLanternArt` and the art store,
  the hang, the swing's drive, the batch); this body keeps whether it hangs and the light.

Pins: `test/htwaist_eotb.test.js` (its bodies stand with their backs to the camera now; its sideways walk is a back
diagonal, the side view its negative case), `test/htwaistback.test.js`. Not verified in a browser (no ARENA2 here).

## SKIN2 (2026-09-25): Daggerfall's classes as skins, and the Skin card's two panels

Mac, with an archive of redrawn Daggerfall class sprites (ExistingClasses): *"1. Implement these as new skin options
2. Reorganize the skin selector as 2 single panels for unmounted/mount that can be opened to view available skins"*.

**The art.** Twenty sheets, vendored under `vendor/class-skins/Textures/<archive>/<archive>_<record>-<frame>.png` (1,683
pictures, 8.2 MB), with `skins.json` listing each skin's archive, name, sex, whether it carries a bow, and every
record's real frame count. The pack is not uniform, so the manifest counts the files rather than assuming the layout:
the female healer casts in five frames and the bounty hunter's last ranged record has two. The vanilla adventurer's
record 3 was numbered with a gap (0, 1, 2, 4) and was renumbered in order when unpacked. `vendor/class-skins/README.md`
has the provenance and the archive numbers.

**The art's authority, and a frame the first cut lost** (found when the PNGs were first tracked and the raster
doctrine, `test/doctrine.test.js`, reddened on them: the suite had run before `git add`, the AUDIT-TO1 trap). The
pack is a loose-file archive with no manifest of its own, so its authority is a listing generated from the archive,
GrimoireUI's way: `vendor/class-skins/class-skins.files.json`, every vendored file mapped to the archive path it came
from, the archive's sha256 beside it, and `tools/classSkinsListing.mjs` proving each vendored file is that path's
bytes. The art moved under `Textures/` (the doctrine's directory rows hold art alone, as Eye of the Beholder's do),
and the row is `vendor/class-skins/Textures/`. Building the listing turned up the pirate's `1529_3-1_.png`: SKIN2's
first cut skipped it as a stray and renumbered record 3's 0, 2, 3 into three frames, and it is the walk's passing
step between the strides 3-0 and 3-2 (checked on a contact sheet against record 2's 2-0..2-3), its underscore a
typo. It is frame 3-1 now; the pirate's back three-quarter walks in four frames like every other record, and the
pack is 1,683 pictures.

**The layout is not the mod's.** EOTB draws a player from twelve on-foot tables of five records each. A class sheet is
Daggerfall's enemy-class shape: 0-4 walk (4 frames), 5-9 attack (6), 10-14 hurt (1), 15-19 idle (1), 20-24 ranged or
spell (4), and 25-29 bow (4) on the four sheets that carry one (assassin and nightblade, both sexes). The orientation
order is the same as the mod's (checked on the art: record +2 is the profile in both), so the wheel, the mirror and the
size law carry over. `player/classSkins.js` holds the mapping:

- `CLASS_TABLE_BASE`: the walks read the walk; the ready stances read the idle (a Daggerfall foe is never unarmed);
  death reads the hurt pose (a class sheet has no fall); the swing reads the attack; the cast reads the ranged-or-spell
  group; the loose reads the bow where the sheet has one (`CLASS_BOW_BASE`) and the throw where it does not.
- `classFrame`: the body's clocks keep the mod's clip lengths, and the class record's own frames are spread over them
  in order (a four-frame walk under a two-frame armed walk shows 0 and 2; a one-frame idle is held).

**One door.** A class skin is `Graphics.OnFoot` 16-35, after the mod's sixteen (`classSkinOf`). `spriteFor` asks for
it on every on-foot table and returns the class sheet's archive, record and frame with the mod's mirror; the mounted and
beast tables stay the mod's whatever is worn on foot. So the body, the preload, the peers (`createPeerWalkers`) and the
Skin card all draw a class skin through the door they already used. The setting's `max` and `labels` grow by the
classes (`classSkinLabel`: "Healer (female)", "Dark Acolyte").

**Online.** The look's `eo` bound was the mod's sixteen, so a peer in a class skin would have been clamped to the
mod's last set. The bound is now `FOOT_SKINS` (36) in `net/wire.js`. It is a literal because the relay imports that
file and not the skin table, and `test/skin2_class_skins.test.js` pins it equal to `FOOT_SKIN_COUNT`. DISC23-B's
separate `EOTB_FOOT_SETS` constant went into it. RELAY_VERSION is now world109; the relay deploy ships it on merge,
which drops connected players once.

**The card** (`ui/skinCard.js`). Adding the classes would have put 57 pictures down the profile, so the card is now
two panels, ON FOOT and MOUNTED. Each one is closed to the skin being worn, showing its picture, the panel's name and
the skin's name. Pressing a panel's head opens its grid under it (`aria-expanded`, a chevron). The on-foot grid sits
under two headings, "Eye of the Beholder" and "Daggerfall classes" (`FOOT_GROUPS`). Only one panel is open at a time.
Choosing a skin wears it and closes the panel on it. The open panel stays open across the window's repaints.

Pins: `test/skin2_class_skins.test.js` (7), `test/disc23b_eotb_sprites.test.js` (re-aimed at the panels and the wider
bound); mutants `tools/mutants/skin2.json` (26, all dead). Not verified in a browser (no probes).
