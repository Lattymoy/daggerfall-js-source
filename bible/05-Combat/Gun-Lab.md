# The gun lab — a new weapon type, prototyped before it exists

`gun-proto.html` + `src/tools/gunLab.js` + `tools/gunProtoProbe.mjs`
+ `vite.config.gun.js` (Mac, 2026-09-19)

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
  offset lifting it. The alignment enum is the port's OWN — asserted
  identical, not equal — and it moved to a leaf
  (`src/combat/weaponAlign.js`, which `fpsWeapon.js` re-exports, so
  its surface is unchanged) because three integers living in a module
  that reaches the CIF reader, the inventory and the Morrowind arms
  cost the lab's standalone build four megabytes of `.nif` it never
  loads. 656KB now, one chunk.
- **The handedness mirror** (:459-464): AlignRight becomes AlignLeft
  under the flip, AlignLeft is left alone.
- **The 1-bit cutout.** `drawScreenQuad` discards texels under 0.5
  alpha, so the background key here is hard-edged. A soft mask would
  look right in the lab and wrong in the game.

ONE declared departure: the sprite's width is a fraction of the
screen, not a CIF record's native size — these frames are PNG/WebP,
not `WEAPON*.CIF` records sized in native pixels.

The weapon sits on the **right** (`AlignRight`, offset 0), which is
where the classic weapons sit and where Mac asked for it. The page's
opening numbers are HIS, off the panel (2026-09-19): size 54, raise
-8, fire 14fps, reload 700ms, hit frame 1.

## Weapon Widget's own movement, on the gun

Mac: *"all the idle, bob enhancements from our in-game weapon mods
need to be applied"*. They are — by **running** them. `Offset`, `Bob`
and `Inertia`, and `GetWeaponRect`'s transform, are imported from
`src/combat/weaponWidgetMotion.js`, which is WW1's 1:1 port of
FPSWeaponClone's own modules; the settings come from the mod's
declared defaults through `readWidgetSettings`, so every multiplier
LoadSettings applies (Offset.Speed ×10, Bob.Length ÷100, SizeX/Y ×2,
SpeedMove ×4, SpeedState ×500, Inertia.Scale/Speed ×500, Forward
×0.2) is applied here too. The sliders in the lab's panel ARE the
mod's switches.

**The split.** Those four functions were inline in
`combat/weaponWidget.js`; the arithmetic is untouched, the component
imports them back and calls them where it used to do the work itself,
and `test/ww1_weaponwidget.test.js` passes unchanged. They are their
own file for two reasons: a second copy of a bob pinned to an IL
offset would be a second copy to drift, and the component reaches the
inventory, the equip tables and a vendored mod's mesh folder — four
megabytes of `.nif` the lab has no use for. `offsetStep` gained one
parameter, `hiddenTarget`, defaulted to the mod's own `[2, 2]`.

Three departures, all of them the gun's:

- **Inertia is ON.** The mod ships it off ("requires double-scaled
  weapon textures"); this art *is* high resolution, so the lab is the
  case that warning is about.
- **The reload lower** rides the Offset module's easing to a target of
  the lab's own — straight down, not the mod's diagonal sheathe.
- **The recoil** is not a channel at all (below).

## The recoil, the reload, and the shake

None of the three is something a mod could lend.

The mod's `Recoil` module recoils a **swing** — it replays the strike
animation in reverse when the blow lands — and a gun has no swing to
replay. So `createRecoil` is the lab's own, and it is a **spring**
rather than a curve keyed to the frame: the shot is a DISPLACEMENT
(the barrel is already up on the frame the trigger breaks; an impulse
puts the peak two frames late and a third of the size, which is the
first thing the probe caught), and the spring's job is the ride down.
A second shot fired into the recovery stacks on what is left, which a
per-frame curve cannot do. It is applied AFTER `widgetTransformRect`,
because the mod's transform ends in a floor — the rect may never rise
above its resting place — and a kick rises. Sub-stepped at 4ms so a
slow frame does not blow the spring up.

There is no reload animation, so the reload is the **Offset module**
with `shown` false: the weapon drops out of frame on the mod's own
easing and comes back up when it is ready. `Reload ms` is the
machine's cooling phase; `drop` is the target in units of the sprite's
own height.

**The screenshake is the CAMERA, not the weapon** (Mac, 2026-09-19).
The obvious build is wrong: a shake that moves the sprite is the
recoil again, louder. A gun going off kicks the *head* — so the room
and the target are drawn through the offset and the weapon, carried by
that head, does not move on screen at all. The crosshair is
screen-space and stays put. The probe pins exactly that pair: with the
kick, the bob, the inertia and the lower all off, the camera moves and
the weapon's rect moves 0.00px.

It is **trauma**, not a timer (Eiserloh, *Juicing Your Cameras With
Math*): a shot adds trauma capped at 1, trauma decays linearly, and
the shake is trauma **squared** — so two shots close together are much
more than twice one shot, and the tail falls away instead of stopping
dead. The displacement is three sines per axis rather than a fresh
random per frame, because per-frame randomness reads as static at
60fps and shakes twice as hard on a machine drawing twice the frames;
the pins hold both (a quarter of the shake at half the trauma, and
identical trauma after a second at 30fps and at 60fps), and that it
returns to *exactly* zero — the room is drawn through this every
frame, and a jitter with no shot behind it is an hour of chasing.

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
