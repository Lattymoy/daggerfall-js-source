# The spear lab - a left sweep, a right sweep and a thrust, before the spear exists

`spear-proto.html` + `src/tools/spearLab.js` + `src/combat/spearStrip.js` + `src/combat/spearStrikes.js` +
`src/formats/rotSprite.js` + `tools/spearProtoProbe.mjs` + `vite.config.spear.js` (SPEAR-LAB, 2026-10-27)

The owner, handing over five frames: *"We're making our next weapo, the spear. This needs to have left, right and thrust
attacks. This needs to be as detailed as possible."* Asked, the owner chose:
- **Lab page first**, as the guns had (`Gun-Lab.md`, `Pistol-Lab.md`). Nothing in the game changes.
- The item, for later: **2-15 damage, 4 kg, 60 gold**, the **Axe** skill, two hands on the haft.

DFU has no spear. The sprite placement, the strike machine, the swing clock and the drag's direction are DFU's (SCOPE1:
read first, named where we leave them).

## What it is, and what it is not

**Nothing here touches the game.** No module the game runs imports `src/tools/spearLab.js`;
`spearLab.test.js` walks `src/` and fails if one does. There is no item, template or weapon type yet. The page runs the
game's own laws, never a copy:
- the melee machine, `characters/weaponStates.js` `createWeaponMachine` / `machineAttack` / `machineStep`;
- the swing law (SWING-LAW: Speed, the heft by Strength, the handling), `swingFrameSeconds`;
- the drag's direction, `gestureDirection` and `characters/anims.js` `DIRECTION_TO_STRIKE`, and the click roll
  (`CLICK_ATTACK_DIRECTIONS`, `WeaponManager.cs:343`);
- the weapon frame and Weapon Widget's Bob and Inertia, `combat/gun/gunViewmodel.js` (the guns' own frame:
  FPSWeapon's rect over the rest frame's box at native size, the mod's channels over it).

## The art

`public/art/spear/spear-frames.png` is the owner's five 187x189 canvases side by side, pixels unchanged (935x189).
They arrive registered: the arms leave every frame through the same edges. The 1-bit cut (drawScreenQuad's 0.5) clears
78 soft texels.

**Checked against ARENA2 before it shipped.** Every 5x5 patch of four or more colours was matched against every
`WEAPON*.CIF` and `WEAPO1*.CIF` frame, as drawn and mirrored. Nine patches matched, all in frames 1-3, all one
`WEAPON10.CIF` frame (the bare hand, record 2 frame 1). Aligned there, the mirrored sprite shares 472 to 486 texels with
each of the three: the grey sleeve is Daggerfall's, the glove follows its drawing, repainted. Frames 4 and 5 match
nothing exactly. Asked, the owner approved carrying the frames: they are Port-Doctrine's FIFTH EXCEPTION, the
directory listed with its sha256 in `public/art/spear/spear.files.json`.

They are one thrust, in the order given (`SPEAR_POSE`):

| Pose | What it is | Point (canvas) |
|---|---|---|
| rest | at rest - the anchor, its box 149x152 at 38,37 | 38,37 |
| chamber | drawn back to the body: larger, the point at the canvas's corner | 0,0 |
| drive | driven forward | 11,30 |
| extend | reaching: the shaft slides through the front hand | 29,45 |
| full | fully out, the rear hand off the corner | 53,50 |

At native size the rest frame takes 149 of the 320 surface, about a classic battleaxe's idle (`WEAPON08.CIF` record 0,
70x150).

## The arms go on past the cut

PISTOL-EDGE's law (`Dwarven-Pistolet.md`), for two arms: a sweep turns the whole picture, which would lift a cut edge
into the screen. `bleedArms` carries each arm past every cut edge, 96 texels (`SPEAR_BLEED`), every new texel a copy
of an edge texel:
- **the rear arm** (the right edge, and a bottom run ending within `REAR_REACH` 40 of it) takes PISTOL-EDGE's own
  walk-back (`pistolStrip.js` `bleedArm`) along the cuff's lean, never steeper than `REAR_LEAN` (0.6, 0.8) - the
  elbow is off the corner. The first cut extruded the fist sideways into a slab;
- **the front arm** (every other bottom run: the sleeve, or the front cuff when the spear is out) goes straight down
  its own lean (`runLean`), and the chamber's sleeve, cut by the left edge too, goes on to the left as one band.

Measured on every strike frame: 80 texels already keep every arm's end 24 texels off the screen; 64 by 48 does not.

## The strikes

Every strike frame is one of the five poses, turned, scaled and moved on the 320x200 surface (`SPEAR_STRIKES`), drawn
by RotSprite: Scale2x three times, the turn sampled at 8x (`formats/rotSprite.js` `drawTurned`). No frame holds a
colour the owner's strip does not. All frames share one stage, the surface with room round it (`SPEAR_STAGE`), so the
draw seats it once.

| Strike | Plays for | Frames | Hit | Shape |
|---|---|---|---|---|
| left | StrikeLeft, StrikeDownLeft | 12 | 5 | drawn back and up to the right, swept across the aim, carried low to the left, home |
| right | StrikeRight, StrikeDownRight | 12 | 5 | gathered low on the left, swept up and across to the right, home |
| thrust | StrikeUp, StrikeDown | 11 | 5 | the owner's thrust as drawn, turned onto the crosshair, a beat held at full reach, home |

The sweeps turn about a point between the hands (265,150); the thrust about one below the screen (300,260). At the
hit, the thrust's point is on the crosshair (4 texels off) and a sweep's crosses the aim. The way home goes out through
the reaching poses, never back through the drawn-in drive, so the point does not zig-zag. The last frame stands within
9 texels of rest.

**The smear.** On the two or three fastest frames the spearhead is drawn twice more on the way from the frame before,
every other texel (one bit of alpha has no half), behind the frame. It is made of the owner's own pixels, so these are
a sprite's speed lines with no new colour. The panel turns it off.

## Its time

The spear swings on the game's machine and the game's clock. The swing law answers one classic frame for 4 kg in two
hands (the Staff's handling, `SPEAR_HANDLING_OF` 2, until it has a type of its own), and DFU's strike is five of those
(`WeaponBasics`). The spear's strike takes exactly that long, cut finer (`spearFrameSeconds`): at Speed 50 and Strength
50 it is 1.09 s, 91 ms a frame. Its hit lands at the classic share of the blow (the fifth tick of twelve, the second of
five). The machine's own `frames`, `tick` and `hitFrame` fields carry it, so no line of the machine changed.

The swing's voice is the gather lab's synthesised tool swing (`gather-swing-1`, `-2`, ours), at each blow's first
smeared frame.

## Driving it

Drag with a button held, as the game reads a drag (`spearGestureStep`: PlayerWeapon's trail over the last second
against the 0.005 threshold; the pin drives both with the same drags, bent trails included). Keys 1, 2, 3 play the
three strikes, Space a click attack, the arrows scrub a strike's frames while idle. The panel has a loop, slow motion,
the point's path, Speed and Strength, size and raise, Bob and Inertia, and walking.

## RotSprite has one home

`scale2x` and `rotSprite` moved from `tools/pistoletArt.mjs` to `src/formats/rotSprite.js`, unchanged, beside the
general `drawTurned`. The doll tool re-exports them, and `pistolet.test.js` re-runs the Pistolet's doll layers against
the shipped files, byte for byte.

## SPEAR-LAB 2 (2026-10-28): the owner's numbers

The owner, over a screenshot of the panel on a phone: *"Heres the new values with smear off"*. The lab opens on them
(`SPEAR_OPENING`): size 0.95, raise -12, Speed 52, Strength 100, the smear off. The game will take its row from here,
as the Pistolet took its feel from its lab. At this size and raise the thrust's point lands about 12 texels right of
the crosshair and 15 below it; the strikes are aimed at the native placement.

The same screenshot showed two faults of the page's, both fixed:
- **The sound opened off**, at volume 0.5. The page sets every control from the opening state, and the state had no
  sound values, so the box read as unticked and the slider sat at its middle. The state names them now (on, 0.7), and a
  pin holds every control on the page to a value in it.
- **The readout covered the thrust button** at a phone's width. It now wraps in the room the panel leaves.

## Departures (Port-Ledger section A, SPEAR-LAB)

- **A strike of 11 or 12 frames in the time of five** (`WeaponBasics` five-frame strikes, `FPSWeapon.AnimateWeapon`).
- **Three blows for six strike states** (`SPEAR_STRIKE_OF`): a spear sweeps or thrusts.
- **Weapon Widget's Swings module is not run.** Its wind-up and recovery would replay a strike that already has its own.
  Graduation decides whether the spear is exempt from it.

## Pins

`test/combat/weapon/spearLab.test.js` (20): the lab is a lab; what it borrows by identity; RotSprite's one home; the
exception's listing; the strip; the arms past the cut, and THE CUT NEVER SHOWS on any strike frame; the idle is the rest frame texel for texel;
no new colour; the strikes' shapes; the smear; three blows for six; the law's time; the machine plays each strike; the
drag agrees with PlayerWeapon's; placement; the picture and its point agree. `tools/mutants/spearlab.json`: 29 dead.
`tools/spearProtoProbe.mjs` (`npm run spearproto`, 24 checks) drives the page in Chromium. Deployed at
`/preview/spear-lab/`.

## What graduation owes

The item (a template past 562, the owner's numbers above, the Axe skill), a weapon type and its art loader, the
Swings question above, a `SWING_HANDLING` row, the shop and loot rows, the icon and the doll, and the Morrowind arm
(the third-person body already carries a spear: `characters/bodyMotion/carry.js`).
