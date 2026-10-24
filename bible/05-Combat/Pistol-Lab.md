# The pistol lab - a dwarven flintlock pistol, one in either hand, prototyped before it exists

`pistol-proto.html` + `src/tools/pistolLab.js` + `tools/pistolProtoProbe.mjs` + `vite.config.pistol.js`
(PISTOL-LAB, 2026-10-21)

The owner, handing over six frames: *"So this spritesheet is to be for our new weapon type, which can also be duel
wielded. Its a dwarven flintlock style pistol. We need to use the same prototype testing we did for the thunderlock to
ensure we get this right"*.

The Thunderlock's prototype testing is `Gun-Lab.md`: a page of its own where a new weapon type is judged on the classic
surface, at a real window size, with a real cadence, with a Chromium probe that pins what the page claims, before a line
of the game changes. This is that method for the second gun. DFU has no gun and no dual wielding (`Two-Hands.md`, "What
DFU does"), so all of this is our own (SCOPE1); it reads DFU's placement law first and names each departure below.

## What it is, and what it is not

**Nothing here touches the game.** No module the game runs imports `src/tools/pistolLab.js`, and
`test/combat/weapon/pistolLab.test.js` fails if `weaponRig.js`, `fpsWeapon.js`, the Weapon Widget, the gun's viewmodel, the
Two-Hands law or `thunderlock.js` ever does. The arrow runs the other way: since PISTOL-PORT the page's machine, pair
and frame ARE the game's (`combat/gun/gunMachine.js`, `pistolPair.js`, `pistolViewmodel.js`), and the page imports them
back. There is no item, no template, no skill and no damage. The lab answers the
question a source sweep cannot: what does a pair of these FEEL like?

## What it runs rather than restates

The gun lab's hardest lesson (FIELD-GUN12, `Gun-Lab.md` "It graduated"): two copies of a frame do not converge by being
corrected. So the pistol lab writes no placement, motion or feel of its own. It imports them, and the pins hold that by
identity, not by value:

- **The game's gun frame**, `combat/gun/gunViewmodel.js` `gunFrameRect`: FPSWeapon's 320x200 rect (FPSWeapon.cs:378-388)
  over the anchor box, Weapon Widget's Offset, Bob and Inertia over that, the kick after the mod's floor, and the union
  expansion. The page never calls `placeSprite`, `widgetTransformRect` or `unionDrawRect` itself (AUDIT 68 S08's law,
  pinned for this page too).
- **The gun's feel**, `combat/gun/gunFeel.js`: the recoil spring, the trauma screenshake (which moves the camera and not the
  weapons), and the muzzle light's curve.
- **The gun lab's machine** (`combat/gun/gunMachine.js` since PISTOL-PORT; `src/tools/gunLab.js` re-exports it) **and
  sound player** (`gunLab.js`): Idle, then six frames, then the reload, then Idle; a hit frame; a one-shot that cannot be
  interrupted. The same CC0 clips, baked to DAGGER.SND's 11025 Hz 8-bit mono.
- **The Two-Hands law** for the pair (`combat/twoHands/handsLaw.js`): which hand fires (`strikeHandOf`, the flurry the
  dual wielder's swords obey), the resting hand's guard (`guardStep`, `guardOffset`), and the mirror (a left hand is a
  right hand in the glass).

## The art: a strip, not a sheet

`public/art/pistol-frames.png` is the owner's six 88x113 frames laid side by side in the order they were given, with their
pixels unchanged (528x113). Unlike the Thunderlock's art, which was a contact sheet on a white page, these frames arrive
on transparent canvases that **register them to each other**: the forearm leaves every frame through the same
bottom-right corner, and the pistol moves inside the canvas because the art moves it. So the strip is cut at a fixed
stride. There is no background key, no badge gutter and no flood fill.

| Frame | What it is |
|---|---|
| 1 | rest - the anchor (82x101 at 6,12 after the cut) |
| 2 | the shot: the flash, the pistol kicked back |
| 3 | settling |
| 4, 5 | muzzle up - one picture twice, a hold |
| 6 | settling (the same picture as 3) |

The union of the six (88x104 at 0,9) and the anchor share the arm's corner. The flash overflows up and to the left, and
the cut stays on the view's edge. The probe measures the drawn rect on every frame of a slowed live shot and fails on
any drift. It measured 0px.

**The 1-bit cut** (`hardenAlpha`). The frames carry soft alpha: an antialiased fringe and the flash's glow, 870 to 1,200
texels a frame. The port's screen quad discards texels under 0.5 (`drawScreenQuad`), so the lab cuts at 128 by default
and keeps the threshold as a live slider. At 0.5 the flash's core survives and its halo does not, which is what the game
would draw. The slider exists so that cost can be judged rather than assumed. The file keeps the art's own alpha; the
cut is made on load.

**Native size.** The Thunderlock's art was a 1790px painting and took its size from a slider (`widthPct`, the gun lab's
one declared departure from the CIF law). These frames are drawn at Daggerfall's own scale, a WEAPON*.CIF record's size.
So the classic law applies whole: at `size x native` 1, one art pixel is one pixel of the 320-wide design surface
(`nativeWidthPct`). The slider remains, as a multiple of native.

**No ARENA2 pixel in it.** The arm is a brown glove and a grey sleeve, and classic WEAPON10.CIF paints arms too
(`Two-Hands.md`, "The painted arm"), so before the doctrine row was written the art was checked against Daggerfall's own
weapon sprites (the freeware data, `tools/fetch-data.sh`). Every 6x6 fully opaque patch of frame 1 (45 patches) was
searched as exact RGB through ART_PAL.COL against every frame of WEAPON00-11.CIF (348 frames), both as drawn and mirrored.
There were no matches. Frame 1 also holds 1,180 distinct colours, which a 256-colour indexed record cannot. The row in
`test/tooling/doctrine.test.js` says it is ours.

## The pair

The page opens on two pistols. The left pistol is drawn through the same `gunFrameRect` with `flip`, which is
FPSWeapon's own AlignRight-to-AlignLeft swap (FPSWeapon.cs:459-464). It lands as the right pistol's exact mirror: the
right pistol's cut is on the view's bottom-right corner and the left pistol's on the bottom-left. At native size on a
16:10 window the two stand 576px apart, with no overlap.

**One rig per hand, on one clock.** The left rig runs flipped. That gives Two-Hands' two sway rules without any code of
the lab's own. Bob goes **outward**: the mod's flipped sprite takes it mirrored, and the probe measured the left pistol's
walking sway as the right pistol's mirror to 0.00px. Inertia **keeps the screen's direction**, because `inertiaStep`
pre-signs it for a flip.

**The trigger** - four ways, a select on the panel and keys 1-4:

| Trigger | A pull fires |
|---|---|
| alternate (opens on it) | the game's flurry, `strikeHandOf`: the lead opens; a pull while the last shot is in flight, or within `FLURRY_WINDOW` (0.75 s) of its end, is the other hand's |
| volley | both, on one pull |
| per hand | the left mouse button fires the right pistol; the right button fires the left |
| single | one pistol, DFU's one used hand (the gun lab's own case; a left lead is the handedness mirror) |

**Alternate's one departure, which belongs to the gun.** A sword can always swing; a pistol mid-reload cannot fire. When
the hand the law names is reloading and the other hand is loaded, the pull falls to the loaded pistol, so the trigger
never clicks on an empty pistol while a loaded one is in hand. This is pinned (`pistolLab.test.js`, "alternate's one
departure"), so it is a decision and not an accident. A held trigger pulls whenever no shot is in flight, so a pair on
auto takes turns a shot's frames apart.

**The guard** (`GUARD.LOWER`): while one pistol fires and the other does not, the resting pistol lowers 0.12 of its own
drawn height, straight down so its cut stays on the view's edge, and eases back. This is Two-Hands' rule for a resting
weapon. It never applies in a volley, where both hands are the striking hand. The first cut lowered both pistols in a
volley, each because the other was firing; the probe's shake check found it (both weapons moved 48px with the kick off),
and it has its own check now. The hand that fired last is drawn over the other.

**One camera.** Every shot punches the shake's trauma, so a volley is two punches. Trauma is capped at 1 and squared,
which is why the opening shake is two thirds of the Thunderlock's.

**Each hand reloads on its own.** The reload lowers that hand on the Offset module's easing, with its own two sound ends.
Carrying a pair is a way of covering one pistol's reload with the other.

## The owner's numbers (PISTOL-LAB 2)

The owner tuned the published lab and sent the panel back in two screenshots: *"Must be these values/sounds exactly"*.
They are `PISTOL_OPENING`, one frozen row that the page, the probe and the pins all read (GUN_FEEL's rule: a number in two
places disagrees with itself). `pistolLab.test.js` pins the row with `deepEqual`, so a change to it is a deliberate
change to that test. The page sets every control from the row before binding it, so a slider's `value=` in the markup
cannot open the panel on a different weapon.

| | Value | Moved from the first pass |
|---|---|---|
| size, raise, offset | 1.05x native, -1, 0 | size 1, raise 0 - the cut now sits one design unit below the view's bottom edge |
| fire fps, hit frame, reload | 12, frame 2 (the flash), 1400 ms | kept |
| recoil | kick 3, back 0, stiffness 400, damping 36 | kept |
| shake | 20, roll 2.5, rattle 60, decay 5 | kept |
| sound | fire `fire-shotgun`, reload open `open-shell`, reload close `close-ready`; volume 1, pitch vary 0.19 | all three picks (the first pass was `fire-musket`, `open-gunrack`, `close-shell`) |
| reload lower | drop 0.7, Offset.Speed 1, Offset on | kept |
| Weapon Widget Bob | Length 146, SizeX 1, SizeY 0.7, SpeedMove 1, SpeedState 1, shape U, BobWhileIdle on | Length 100, SizeY 1 - a longer, flatter Bob |
| Weapon Widget Inertia | on, Scale 2, Speed 2, ForwardDepth 0, ForwardSpeed 1 | Scale 1, Speed 1, ForwardDepth 1 |
| art and room | alpha cut 128, muzzle light 0.6, room 0.62 | kept |

"Walking" was ticked in the screenshot. It is a movement toggle (W), not a setting, so the lab still opens standing.

## The page is the game's player (AUDIT PISTOL-PORT, 2026-10-22)

The page could not make three things a player does, so the owner's tuning had never seen them (`Audit-Pistol-Port.md`
B1 B2 B6):
- **It strafes and jumps.** A and D strafe (press again to stop; S stops everything), J jumps - on `gunMotion`, the labs'
  stand-in motor, which now moves as the game's motor does: a crouch at the motor's crouch speed, a strafe on its own at
  the walk's, a step and a strafe each at the diagonal .7071, a jump at the motor's JUMP_SPEED and GRAVITY
  (`pistolJumpClimb`), and the speed ratio PlayerMotor.Speed's over the walk, standing or not.
- **It turns as the game does.** The mouse turns the page's stand-in camera at the game's own MouseLookSensitivity
  (`ui/lookSettings.js lookScale`, 2.0 out of the box) - it turned at 1.0, so a flick swayed the game's pistols twice as
  far - and the page draws in CSS pixels, as the game's canvas does (Bob and Inertia move in pixels; a high-DPI screen
  showed half the sway).
- **What the panel feeds the frame is a module** (`src/tools/pistolLab.js` `pistolPageState`, `pistolPageStep`,
  `pistolPageRect`): the page calls them, and the port's pins run them on the page's own opening state. Its keys, its
  mouse and its canvas size are the page's alone, and `tools/pistolPortProbe.mjs` drives them in Chromium.

## Running it, and its own deploy

    npx vite                # then open /pistol-proto.html
    npm run pistolproto     # the probe: boots vite, drives Chromium, writes the six
                            # frames, the pair at rest, the guard, the volley, the reload
                            # and the walk to scratch/pistol-proto/

`vite.config.pistol.js` builds the lab and nothing else into `dist-pistol/`, with a relative base. `deploy.yml` mounts it
at **`/preview/pistol-lab/`**, beside the gun lab, built from the production checkout (AUDIT-THUNDERLOCK F6: never from a
feature branch by name). The house build registers the page too (`vite.config.js` `pistolProto`; AUDIT 68 X2 fails a
root page that is not an input).

**The probe, 23 checks, all passing**: the strip cuts to six frames and to 1 bit; the flash
has room and shares the arm's corner; the pair is drawn; native size; the cut is on the corner; the left is the mirror and
does not overlap; six frames with zero drift; single is one pistol; the flurry; the guard lowers and returns; the volley
fires both and guards neither; per hand; the reload lowers and returns; Bob goes outward; the shake moves the room and
neither weapon; no page errors.

**Read a frame after the click.** The page writes `__pistolLab` once per frame, so a probe read in the same instant as a
click sees the frame before the shot. The first cut of the flurry check did that and answered "R then R" in one run of
three, which looked like a misfire and was not. Every read after a click now waits for a drawn frame (`nextFrame`, two
rAFs; Home.md's process rule: frame-sync, never sleep), and the flurry check counts each hand's shots per click. It passed
in four runs of four.

## Graduation

**GRADUATED (PISTOLET, 2026-10-21)** as the Dwarven Pistolet - `Dwarven-Pistolet.md` is its record. **PORTED
(PISTOL-PORT, 2026-10-22)**, as the gun lab was by FIELD-GUN12: the page's pair (`createPair`, `PAIR_TRIGGER`) and its
frame - each hand's spring, guard, picture, rig, rect, order and two clacks - moved into the game
(`combat/gun/pistolPair.js`, `combat/gun/pistolViewmodel.js`), and the Pistolet fires and draws on them, one or a pair. The
page composes nothing of its own now; `test/combat/gun/pistolport.test.js` holds the identity, and the real rig drawing
every hand at the page's rect, picture and order on one clock (`Dwarven-Pistolet.md` "PISTOL-PORT"). It answered what this
section listed: the pair's `DUAL_GUN_TYPES` row and its balance (measured there), the Pellet spent through the one
machine (the out-of-Pellets guard asks whether the weapon is a gun, which serves a pair), the doll and the icons, the
four hosts through the rig, and the Port-Ledger's A entry. The lab now READS the game's row (`combat/gun/gunFeel.js`
PISTOLET_FEEL) and strip (`combat/gun/pistolStrip.js`), FIELD-GUN6's arrow. (The answered items were deleted here by
AUDIT PISTOLET B8 - Home.md's RETIRING A FLAG DELETES THE SENTENCE.) Two are still open:

- **A pistol's own sounds.** The lab offers the Thunderlock's clips. A flintlock's pan flash, and a ramrod for its reload,
  are a search the lab has not yet run (`tools/freesoundPick.mjs`).
- **The flash may be clipped at the canvas edge.** On frame 2 the flame reaches column 0 of its 88px canvas. If it was
  painted longer than that, the art needs a wider canvas. The lab draws what the file holds.
