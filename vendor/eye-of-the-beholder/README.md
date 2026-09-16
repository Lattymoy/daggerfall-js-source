# Eye Of The Beholder 2.1 - RedRoryOTheGlen (camera + sprite ported, its sprites vendored)

**Eye Of The Beholder 2.1** for Daggerfall Unity 1.1.1, by
**RedRoryOTheGlen** (GUID `2942ea8c-dbd4-42af-bdf9-8199d2f4a0aa`;
the manifest's ContactInfo is `rmufrancisco@gmail.com`). The mod's own
description: "Playable third-person perspective for Daggerfall!
Configurable to taste!"

It is two MonoBehaviours - `EyeOfTheBeholder` (the camera: the frontal
plane offset, the longitudinal distance, an obstacle raycast per axis,
the shoulder mirror and its auto-switch, the weapon/mount/boat
overrides, the auto-toggle table) and `PlayerBillboard` (the player
you see: eight orientations, a state table over idle/move/death across
melee, ranged, spell, horse and lycan, and its own footsteps) - plus
3035 sprites, which are most of what the mod weighs.

Mac (Lattymoy) handed the shipped archive
(`Eye_of_the_Beholder-762-2-1-1775438888.zip`) over on 2026-09-15:
"Alright next mod I want to add 1:1."

**Permission: [Mac: record the author's permission, or the link to it,
here - the earlier mod records carry theirs in this line.]**

## How much of it is ported

Not all of it, and the arc said otherwise for a day. The assembly
carries **62 authored methods**; the port implements **twenty-nine** -
thirteen read off the IL (the camera's offsets, bounds and smoothing,
and the sprite's SELECTION) and, since AUDIT-EOTB2 (2026-09-16),
sixteen read off the SETTINGS' own names and option labels (the attack
and death one-shots, the footstep sync, the auto-toggle table, the two
hides, the two transition rows), because the assembly itself is NOT in
this tree - only the manifest, the settings, the presets and the art
are, and the bundle is behind a Nexus login. The cart, the boat
override, the per-sprite offsets and the one-shots' own tick time wait
on it. `test/eotb_scope.test.js` holds all 62 rows with a verdict
each, and `bible/06-Systems/Eye-Of-The-Beholder.md` explains which
gaps have no twin here, which need the assembly, and which were read
from the settings rather than the IL.

## Why this mod is in a port that already has third person

Mac's ruling, the same day: *"This is moreso for those who opt out of
using morrowind."*

The port's third person (MW-D24/MW-D25) draws a **Morrowind** body and
needs Morrowind data to exist. `player/mwView.js` says so in its own
head: a player with none "has no third person at all, and the wheel
then does nothing rather than pulling the eye out of an invisible
head." Eye Of The Beholder is exactly that missing body, so the wheel
answers for everyone: the Morrowind rig if the player has it, this
mod's sprite if they do not.

## What is here

- `eyeofthebeholder.dfmod.json` - the shipped bundle's manifest,
  VERBATIM, all 4075 `Files` entries included. It is 386 KB of build
  paths and it earns its place: it is the authority on which files the
  mod shipped, and the doctrine gate resolves every vendored sprite
  against it rather than against a list somebody typed.
- `modsettings.json` and `modpresets.json` - verbatim, the nine
  sections the bundle ships (Camera, the three CameraOverride*,
  CameraScrolling, AutoTogglePerspective, Graphics, Animation,
  Compatibility, Debug). `src/systems/modSettings.js` restates every
  key under the vendor key `eye-of-the-beholder`, with the port's own
  `Enabled` in front - DFU enables a mod by listing it and the port has
  no mod list, so the switch lives there, as it does for every other
  vendored pack.
- `spriteInfo.json` - the mod's per-sprite offsets. The bundle ships
  these as **1035 separate `.xml` TextAssets** of three values each
  (`scale`, `X`, `Y`); 288 carry anything but the default, and those
  288 hold just SIX distinct triples. A thousand files that say one
  small table's worth are carried as that table, with the default
  stated once and only the departures listed.
- `Textures/<archive>/<archive>_<record>-<frame>.png` - the 3035
  sprites, in 23 archives: 16 on-foot sets (112364-112379, 155 sprites
  each), two of 65 and five of 85 for the mounts (112380-112386).

## The sprites are RE-ENCODED, and here is exactly how

The bundle's textures are palettised artwork stored as truecolor RGBA.
Measured over all 3035, not sampled:

- every pixel's alpha is **0 or 255** - the classic 1-bit cutout, which
  is the port's own law (`if (t.a < 0.5) discard`);
- no sprite holds more than **166** distinct colours once the
  transparent pixels are counted as one.

So each sprite is written as an indexed PNG with an exact palette and a
single transparent index: **19.72 MB becomes 8.39 MB**, and the
conversion was verified per sprite, all 3035 of them - every DRAWN
pixel identical, every hidden pixel still hidden.

This is lossless for everything that reaches a screen, and it is not
byte-lossless, which is a real distinction and the reason it is written
out here. The source RGBA carried up to 59 different colours *under*
transparent pixels - ghost colour left by the author's export that no
renderer has ever shown. Those collapse to one index. Nothing visible
changes; the bytes under the cutout do.

## The one departure: the wheel, not the numpad

The mod binds `KeypadEnter` to TogglePerspective and `Tab` to
SwitchShoulder, and ships its own `CameraScrolling` section
(`ScrollableZOffset`, off by default; `ScrollIncrement` 0.2; the axis
`Mouse ScrollWheel`) with a `scrollableOffsetTogglePOV` arm in the DLL.

Mac, 2026-09-15: *"instead of numpad being used to change views, I want
it scrollable like how we handle morrowind."* So the port takes the
mod's own scrollable arm as the ONLY way in and out of third person,
and its ladder is Morrowind's (`player/mwView.js`, MW-D25/MW-D30) -
one wheel, whichever body answers. Recorded in `bible/01-Overview/
Port-Ledger.md` and on the mod's bible page.
