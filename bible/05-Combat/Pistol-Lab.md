# The Pistol Lab

A standalone page for the Dwarven Pistolet, one in either hand, on the classic first-person surface: the gun lab's
method (`Gun-Lab.md`) for the second gun. The owner tuned the pistol's placement, cadence, recoil, shake, sounds and
Weapon Widget motion here. Developers and the owner use it; players never see it.

## How it works

- **The page** is `pistol-proto.html` with `src/tools/pistolLab.js`. It writes no placement, motion or feel of its
  own: it imports the game's gun frame (`gunFrameRect`, `src/combat/gun/gunViewmodel.js`), feel
  (`src/combat/gun/gunFeel.js`), machine (`src/combat/gun/gunMachine.js`), pair (`src/combat/gun/pistolPair.js`),
  viewmodel (`src/combat/gun/pistolViewmodel.js`), frame set (`pistolFrameSet`, `src/combat/gun/pistolStrip.js`) and
  the Two-Hands law.
- **The opening row** (`PISTOL_OPENING`) reads every number from `PISTOLET_FEEL`: size 1.05 times native, raise -60,
  12 frames a second, a 1.4 s reload, kick 3, the shake, the three sound picks and the Weapon Widget's Bob and
  Inertia. The page sets every control from the row before binding it.
- **The art** is `public/art/pistol-frames.png`: the owner's six frames, registered to each other on transparent
  canvases, cut at a fixed stride, drawn at Daggerfall's native weapon scale with a 1-bit alpha cut (a live slider).
- **The pair.** The left pistol is the right's exact mirror (FPSWeapon's AlignRight-to-AlignLeft swap), one rig a hand
  on one clock: Bob goes outward, Inertia keeps the screen's direction. The trigger has four modes: alternate (the
  game's flurry, `strikeHandOf`), volley, per hand, single. The resting pistol lowers while the other fires (the guard);
  each hand reloads on its own.
- **A player's movement.** A and D strafe, J jumps, the mouse turns at the game's look sensitivity, on the labs'
  stand-in motor. `pistolPageState`, `pistolPageStep` and `pistolPageRect` are the page's state as a module, which the
  pins run.
- **The probe** (`tools/pistolProtoProbe.mjs`, `npm run pistolproto`; and `tools/pistolPortProbe.mjs`) drives Chromium
  through the page. A read after a click waits for a drawn frame.
- **Its own deploy.** `vite.config.pistol.js` builds the lab alone into `dist-pistol/`; `.github/workflows/deploy.yml`
  mounts it at `/preview/pistol-lab/`, built from the production checkout.

## Rules

- Nothing here touches the game: no game module imports `src/tools/pistolLab.js`
  (`test/combat/weapon/pistolLab.test.js`). The page imports the game's code, and the pins hold that by identity.
- The owner's values and sounds exactly: one frozen row, pinned with `deepEqual`.
- Alternate's one departure belongs to the gun: a pull the law gives a reloading hand falls to the loaded pistol.
- The art holds no ARENA2 pixel; its doctrine row says it is ours (`test/tooling/doctrine.test.js`).

## Code and tests

- `pistol-proto.html`, `src/tools/pistolLab.js`, `vite.config.pistol.js` - the page and its build
- `tools/pistolProtoProbe.mjs`, `tools/pistolPortProbe.mjs` - the browser probes
- `test/combat/weapon/pistolLab.test.js` - the lab never reaches into the game, the opening row, the departure
- `test/combat/gun/pistolport.test.js` - the game draws every hand at the page's rect, picture and order

## Open

- A flintlock's own sounds (pan flash, ramrod) were never searched for; the lab offers the Thunderlock's clips.
- The flash on the shot frame reaches the canvas edge; if it was painted longer, the art needs a wider canvas.
