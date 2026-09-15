# Eye Of The Beholder (EOTB) - third person without Morrowind

**Eye Of The Beholder 2.1**, RedRoryOTheGlen. Ported 1:1 off the
shipped bundle; the mod's own 3035 sprites vendored. Vendor record and
the permission line: `vendor/eye-of-the-beholder/README.md`. Registry
row: `01-Overview/Mod-Registry.md`.

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

## Where the slices stand

EOTB0 (vendoring, provenance, the art payload, the doctrine gate, the
settings surface, the Features row, credits and the registry) and
EOTB1-EOTB2 (the IL read and the camera) are done. EOTB3-EOTB7 - the
billboard, the wheel seam, the four hosts and the rest of the pins -
are in flight.

**NOT SEEN ON A GPU.** There is no GL and no ARENA2 in the container
this was written in. Mac's eye is the gate.
