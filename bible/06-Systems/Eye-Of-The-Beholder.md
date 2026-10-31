# Eye Of The Beholder

RedRoryOTheGlen's Eye Of The Beholder 2.1, ported: a third-person camera and an eight-direction sprite body for players
without Morrowind data. The game's own third person draws a Morrowind body, which needs Morrowind data. This mod is the
body for everyone else. The player meets it by scrolling the mouse wheel out of first person.
The vendor record and permission line are `vendor/eye-of-the-beholder/README.md`.

## How it works

**One view ladder.** The mouse wheel walks one ladder from first person outward, and whichever body can answer does:
the Morrowind body where its data stands, else this sprite. The First / third person action (`TogglePerspective`,
Controls > Movement, default the mouse's forward side button) flips the view for whichever body can show
(`src/player/mwView.js` `mwViewTogglePerspective`).

**The mod's law is its IL.** The shipped assembly is vendored (`vendor/eye-of-the-beholder/`), its method bodies dumped
by `tools/ilDump.py`, and every law in `src/player/eyeOfTheBeholder/eotb*.js` cites an IL offset. The mod's authored methods are listed
in a ledger checked against the dump (`test/player/eyeOfTheBeholder/eotb_scope.test.js`): each is either ported, with
its symbol named, or has no twin, with a reason.

**The camera** (`src/player/eyeOfTheBeholder/eotbCamera.js`). A pivot on the body, an offset across, up and along the view, per-axis
obstacle casts that pull the eye in, a shoulder mirror with an automatic switch near a wall and a timer to revert it,
smoothing, three override sections (weapon readied, mounted, sailing) and a nine-row auto-toggle table. After the mod's
casts, one more cast runs from the head to the smoothed eye, so a wall on the diagonal never puts the camera inside it.

**The body** (`src/player/eyeOfTheBeholder/eotbBody.js`, `eotbBillboard.js`, `eotbSprite.js`). Eight orientations; a state table of
idle, move and death crossed with melee, ranged and spell, plus horse and werebeast sets; attack variants; its own
footsteps; and a first-person mode that keeps the sprite's shadow. Repaints wait three frames as the mod's do, and each
carries the view it is to paint, so a turn never paints the old view back. A melee blow plays one stroke: an even blow
the first half of the six-frame swing, an odd blow the second.

**The cart and the lantern.** The mod's wagon follows the player (`eotbWagon.js`). A lit lantern can hang at the
sprite's hip, from Handheld Torches' own Lanterns at Waist setting (`eotbLantern.js`).

**Skins.** Twenty redrawn Daggerfall class sheets are skins beside the mod's sixteen on-foot and seven mount sets
(`vendor/class-skins/`). The Skin card has two panels, unmounted and mounted, each opened to pick a skin.

**The back holster** (`src/player/eyeOfTheBeholder/eotbHolster.js`). While the weapon is sheathed, a long blade, axe, blunt weapon,
staff, bow or Thunderlock in the weapon hand rides on the sprite's back and turns with it in every direction, for the
player and every other walker. Short blades and the Pistolet are not drawn yet.

**Riding with the Morrowind body.** On a horse whose 3D rig stands, the Morrowind body sits astride and the view works
as on foot. In the cart's saddle, or before the rig can draw, the Morrowind body holds first person.

**The art.** 3,035 sprites in 23 archives, every pixel fully opaque or fully clear and none over 166 colours, are
written as indexed PNGs: every drawn pixel identical, hidden colour under clear pixels collapsed. The doctrine gate
carries one row on the mod's directory, and a file belongs there only if the mod's own vendored manifest names it
(`test/tooling/doctrine.test.js`).

## Rules

- **The mod, ported 1:1, for players who do not use Morrowind** (Mac). It sits beside the Morrowind camera, not in
  place of it.
- **The view scrolls like the Morrowind view** (Mac): the mod's `ScrollableZOffset` ships on here, and its
  `TogglePerspective` key (`KeypadEnter`) is inert.
- **A force first person / third person toggle** is this game's own action (Mac).
- **The shoulder switch is `B`**; the mod's `Tab` belongs to the pixel dial.
- **No third person in the Morrowind body's cart saddle** (Mac).
- **A lantern at the sprite's waist** (Mac), and **back-holstered weapons that turn with the sprite** (Mac): both this
  game's own additions.
- **A blow is one stroke, strokes alternating, no setting** (Mac).
- **Class sprites as skins in two panels** (Mac).

## Daggerfall Unity

The mod is two MonoBehaviours, `EyeOfTheBeholder` (the camera) and `PlayerBillboard` (the sprite), over DFU's own
camera and `Mathf.RoundToInt`. Departures from the assembly, each for its reason:

1. `ScrollableZOffset` on, the wheel driving one ladder for both bodies.
2. `TogglePerspective` inert; the game's own toggle action replaces it.
3. `SwitchShoulder` on `B`, because `Tab` is spent.
4. The extra cast to the smoothed eye, because the mod's three axis casts miss a diagonal wall.
5. A queued repaint carries its own view, because the mod's could paint the old view after a turn.
6. One stroke a blow; the ping-pong variant plays as None and Mixed as Mirror.

Not ported: Unity lifecycle and component plumbing, the mesh and material code the billboard batch replaces, Free
Rein's move vector (not in the game), the attack-from-body ray, DFU's mod bus, and `get_scaleOffset`, which nothing in
the assembly calls.

## Code and tests

- `src/player/eyeOfTheBeholder/eotbCamera.js` - the camera
- `src/player/eyeOfTheBeholder/eotbBody.js`, `eotbBillboard.js`, `eotbSprite.js` - the sprite body
- `src/player/eyeOfTheBeholder/eotbWagon.js`, `eotbLantern.js`, `eotbHolster.js`, `eotbQuiver.js`, `eotbGlow.js` - the cart, lantern,
  holster, quiver and glow
- `src/systems/modSettings.js` - the mod's fifty-four settings
- `tools/eotbIl.mjs`, `tools/backHolsterProbe.mjs` - the IL extraction, the holster probe
- `test/player/eyeOfTheBeholder/eotb_scope.test.js` - the method ledger against the IL
- `test/systems/eotb_camera.test.js` - the camera and the wall
- `test/player/eyeOfTheBeholder/eotb_billboard.test.js` - strokes and repaints
- `test/player/viewtoggle.test.js` - the perspective toggle
