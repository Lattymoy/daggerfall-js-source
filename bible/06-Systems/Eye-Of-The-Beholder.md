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

## Where the slices stand

EOTB0 (vendoring, provenance, the art payload, the doctrine gate, the
settings surface, the Features row, credits and the registry) is done.
EOTB1-EOTB7 - the IL read, the camera, the billboard, the wheel seam,
the four hosts and the pins - are in flight.

**NOT SEEN ON A GPU.** There is no GL and no ARENA2 in the container
this was written in. Mac's eye is the gate.
