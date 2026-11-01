# The Gun Lab

A standalone page for prototyping a weapon type Daggerfall does not have, on the classic first-person surface, at a
real window size and cadence, before or beside the game's code. It is where the Dwarven Thunderlock's pose, cadence,
recoil, screen shake and sounds were settled, and it is still the fastest way to change them. Developers and the owner
use it; players never see it.

## How it works

- **The page** is `gun-proto.html` with `src/tools/gunLab.js`. It draws the owner's seven-frame Thunderlock strip, cut
  by the game's own `thunderlockFrames` and `THUNDERLOCK_STRIP`, and opens on the game's placement
  (`THUNDERLOCK_ART`). The room is lit on the Thunderlock's muzzle curve.
- **What it borrows**: FPSWeapon's 320x200 design surface (bottom-anchored, aligned with a fractional offset, the
  large-HUD lift), the handedness mirror and the 1-bit cutout, through `src/combat/weapon/weaponAlign.js`, so numbers
  tuned here transfer to the game.
- **The feel** is one home, `GUN_FEEL` (`src/combat/gun/gunFeel.js`), read by the lab and the game alike: fire at 14
  frames a second, a 1.7 s reload, the hit on frame 1; a small fast recoil spring (kick 5, back 0, stiffness 400,
  damping 36); the screen shake at its maximum with a fast decay. Weapon Widget's own movement runs on the gun.
- **Controls**: click or Space fires (hold for auto), W walks, Shift runs, C crouches; arrows scrub frames; G draws the
  slice boxes; Tab hides the panels.
- **The probe** (`tools/gunProtoProbe.mjs`, `npm run gunproto`) drives Chromium through the page and checks the strip's
  frames.
- **Its own deploy.** `vite.config.gun.js` builds the lab alone into `dist-gun/` with a relative base;
  `.github/workflows/deploy.yml` mounts it at `/preview/gun-lab/`.

## Rules

- Nothing here touches the game: no game module imports `src/tools/gunLab.js` (`test/combat/weapon/gunLab.test.js`).
  The arrow runs the other way: the lab imports the game's art, feel and machine.
- The lab's numbers are a person's, moved on a slider until the gun felt right (Mac's panel); they live once, in
  `GUN_FEEL`, so the lab and the game cannot drift.
- A departure is prototyped and judged before it is built.

## Code and tests

- `gun-proto.html`, `src/tools/gunLab.js`, `vite.config.gun.js` - the page and its build
- `src/combat/gun/gunFeel.js`, `src/combat/gun/gunSheet.js` - the feel and the slicing, the game's home
- `tools/gunProtoProbe.mjs` - the browser probe
- `test/combat/weapon/gunLab.test.js` - the lab never reaches into the game

The second lab, for the Pistolet, is `Pistol-Lab.md`.
