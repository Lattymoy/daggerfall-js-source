# The gun lab — a new weapon type, prototyped before it exists

`gun-proto.html` + `src/tools/gunLab.js` + `tools/gunProtoProbe.mjs`
(Mac, 2026-09-19)

## What it is, and what it is not

A lab. Mac has art for a weapon Daggerfall does not have — a gun, one
idle pose and a six-frame fire sheet — and the question a lab answers
is the one no source sweep can: what does it FEEL like on the classic
surface, at a real window size, with a real cadence.

**Nothing here touches the game.** `combat/fpsWeapon.js`,
`combat/weaponRig.js` and `characters/weapons.js` are untouched; no
module the game runs imports `src/tools/gunLab.js`, and
`test/gunLab.test.js` fails if one ever does. This port is a 1:1 DFU
translation — a gun is a DEPARTURE, and a departure gets prototyped
and judged before it is built, which is the same door
`grass-proto.html` and `water.html` came through.

## What it borrows, on purpose

The placement law, so the numbers tuned here transfer if the type is
ever built for real:

- **The 320x200 design surface.** `placeSprite` is FPSWeapon's OnGUI
  rect (FPSWeapon.cs:378-388, ported at `drawFpsWeapon`):
  bottom-anchored, stretched to the window, aligned
  Left/Center/Right with a fractional offset, with the large-HUD
  offset lifting it. `test/gunLab.test.js` compares it against the
  port's own `ALIGN` rather than restating it.
- **The handedness mirror** (:459-464): AlignRight becomes AlignLeft
  under the flip, AlignLeft is left alone.
- **The 1-bit cutout.** `drawScreenQuad` discards texels under 0.5
  alpha, so the background key here is hard-edged. A soft mask would
  look right in the lab and wrong in the game.

ONE declared departure: the sprite's width is a fraction of the
screen, not a CIF record's native size — these frames are PNG/WebP,
not `WEAPON*.CIF` records sized in native pixels.

## What the lab has that the classic machine does not

A gun is not a sword. WeaponManager's six directional strikes and the
drag-to-swing gesture have nothing to say about one, so
`createGunMachine` is the smallest machine that can be judged —
`Idle -> Firing (6 frames) -> Cooling (the pump) -> Idle` — keeping
the two things the classic machine has that DO matter: a hit frame the
damage would land on (FPSWeapon.GetHitFrame) and a one-shot that
cannot be interrupted (FPSWeapon.OnAttackDirection).

## The art, and why it is sliced in the browser

`public/art/gun-idle.png` and `public/art/gun-fire-sheet.webp` are
OURS — on `test/doctrine.test.js`'s allow-list with that reason, no
ARENA2 pixel in them. The sheet is cut at runtime rather than
pre-exported as six PNGs, because that makes the background key a LIVE
CONTROL, and the key is the whole problem:

- The page white must die and the MUZZLE FLASH must live. A threshold
  sweep punches a hole through the flash core, so `keyBackground` is a
  flood fill from the border with a neutrality guard — background is
  reachable from the edge AND grey; the warm flash core is art even
  where it touches the edge.
- **The gun must not move.** Trim each frame to its own content and
  bottom-anchor it and the weapon slides a dozen pixels a frame,
  because the flash and smoke grow up and to the left across the
  cycle. So: ONE union box for all six frames (they are registered to
  each other in the sheet by construction), with the layout computed
  from the ANCHOR box — frame 1, the gun with no flash on it — so
  Center centres the WEAPON and the flash overflows around it.
  `tools/gunProtoProbe.mjs` measures the drawn rect on every frame of
  a live shot and fails on any drift.

## Running it

    npx vite            # then open /gun-proto.html
    npm run gunproto    # the probe: boots vite, drives Chromium, writes
                        # idle + the six frames to scratch/gun-proto/

Click or Space fires (hold for auto), W/S toggles the walk bob, arrows
scrub frames while idle, G draws the slice boxes, Tab hides the panels.

## If it graduates

What the lab does NOT answer, and what building the type for real
would have to: an `itemTemplates.json` entry and a template index, the
damage/skill table rows, ammunition, the hitscan or projectile the
shot becomes, loot and shop reachability, and the sound. None of that
is prototyped here, and none of it should be written until the pose
and the cadence are settled.
