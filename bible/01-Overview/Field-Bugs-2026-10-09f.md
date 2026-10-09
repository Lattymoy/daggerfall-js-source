# FIELD BUGS 2026-10-09f - archery with the draw off, and the Morrowind bow's arrow

One Discord thread, handed over as a screenshot, and the owner's own words beside it.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Archery is weird when turning off 'draw weapon' animation and double shot bug" - "I have no idea when it's going to shoot an arrow and I've been wasting, missing or overshooting because there is no way to tell when I'm just spam clicking - there is no way to actually just 'hold attack' and continue to shoot arrows" (BigOOF, with a video under the Morrowind bow) | two clocks: Daggerfall's machine started shots the Morrowind arm was still too busy to draw | fixed (BOW-CLOCK), and the held instant shot repeats - the owner's departure, below |
| 2 | the owner: "the arrow on the morrowind weapon isnt shown be drawn and shot, or it's misalligned" | the same two clocks: the arrow left at the click of a draw, or mid-draw, not at its release | fixed (BOW-CLOCK) - the placement itself was not re-measured, below |

## BOW-CLOCK: one click, one draw, one arrow (1, 2)

"Draw weapon animation" is Controls/BowDrawback, "Draw And Release Bows" on the Controls page. Off (the default) is
DFU's instant shot: a click looses from the bow's drawn frame. Under the Morrowind arm the shot's hit is held for the
arm's "shoot release" key (MW-D42, `02-Formats/Morrowind-Rules.md`) so the arrow leaves with the animation - but the
machine's cycle and the arm's draw were never made to agree about when the NEXT shot may start. The instant shot's
cycle is four classic ticks and the Speed-driven bow cooldown, `(10 * (100 - speed) + 800) / 980`: 1.58s at Speed 50,
1.17s at Speed 90. The arm draws at the WEAP record's pace. Reproduced headless on the real rig with the arm stood in
on its own acceptance law (attack() takes only an idle or following-through arm), spam-clicking a 50 ms press every
200 ms:

- **The double shot.** A draw longer than the cycle (1.4s at Speed 90): the next click started a machine shot while
  the arm was still drawing, attack() refused it, and its hit rode the ceiling or the last draw's release - arrows at
  1.32s and 1.53s from one draw, the next draw loosing nothing of its own.
- **The arrow at the click.** A draw longer than MW-D42's 1.2s ceiling (1.4s at Speed 50): the ceiling let the arrow
  go 0.1s before the release, and the release key landed afterwards with nothing held. `takeShootRelease` is
  consuming, but nothing consumed it - so the next draw's arrow took the leftover key and left 0.3s into its draw. From
  then on every arrow flew at the start of its draw while the nocked arrow on the bow was still being drawn: the
  owner's "isnt shown be drawn and shot".
- **The press that does nothing.** A click during the cooldown is dropped (DFU's own law - WeaponManager returns before
  the attack while `Time.time < cooldownTime`), and under the arm the bow never leaves the screen, so nothing showed
  when the next click would count.

**The law now.** No ranged shot STARTS while the arm cannot draw it - `fpArm.shotBusy()`: the weapon still coming up
(Equipping), or the last shot still drawn or loosed (AttackWindUp, AttackRelease) - the drag's door and the touch
button's alike (`armCannotDraw`). Only the start waits: a drawn bow's
release (StrikeUp to StrikeDown) is never held, and the gesture is not asked while it waits, so its button latch keeps
a press made meanwhile. While the arm is still drawing, the held hit waits for its release key past the 1.2s ceiling,
to a 4s never-traps cap (`HELD_HIT_CAP_S`); a silent arm still falls through at 1.2s. A draw clears a release it has
not reached (`attack()`), so a leftover key is never the next arrow's. All in `combat/weaponRig.js` (armCannotDraw before the
gesture and in clickAttack, holdShotForArm) and `combat/fpArm.js` (shotBusy, attack). THE FOUR HOSTS: the rig is all four's - world.js,
exterior.js, worldModes.js (interiors) and dungeonContext.js each step `weaponRig.frame` and resolve its 'hit'; no host
seam. Re-run, every arrow is its own draw's and leaves at that draw's release, at Speed 50 and 90 and draws of 0.8, 1.4
and 2.2s. The classic sprite lane is untouched by the gate: it has no arm to wait on.

THE COST: when the arm's draw outlasts the machine's cycle (a high Speed, a slow bow), the rate of fire is the arm's,
not the machine's - the shots the machine would have started were the double shots and the empty draws.

## THE OWNER'S DEPARTURE: the instant shot repeats while held (1)

"There is no way to actually just 'hold attack' and continue to shoot arrows." DFU looses again only once the button
was released since the last shot (`lastAttackHand == Hand.None`, WeaponManager.cs:355-358). With BowDrawback off a
held button now looses the moment the bow is ready: the machine still decides when - its Idle and its cooldown refuse
every frame until then - so a hold fires at DFU's own rate, and a press made early is not lost for being early. On the
sprite and under the arm (each shot its own draw, above). The drawn bow keeps DFU's edge: it looses on the button's
release, so it cannot repeat on a hold. `combat/playerWeapon.js` gesture. Port-Ledger A, BOW-CLOCK. Reverting is the
`held` back to `rise` on that one line.

## NOT DONE: the arrow's placement

"Or it's misalligned" may also mean WHERE the nocked arrow sits on the bow. MW-D50 walked that chain against OpenMW's
source (getArrowBone's two branches, the ArrowBone node chain, the shoot keys) and found no divergence; this slice did
not re-measure it - there is no retail .kf or bow mesh in this tree, and the video was not seen. The projectile still
leaves from DFU's GetAimPosition (`playerArrowOrigin`), not from the nocked arrow's own node as OpenMW's releaseArrow
does. If arrows still look wrong after this, a screenshot of the bow mid-draw is the next report.

Pinned by `test/fb1009f_bowclock.test.js` (5: the spam clicks at two Speeds and three draws, the touch button's taps, the ceiling held for a
drawing arm and its cap, a silent arm's shots each with its arrow, the held instant shot on the sprite and under the
arm with the drawn bow's edge and release, and the real arm's shotBusy and leftover release on the fixtures);
`tools/mutants/fb1009f_bowclock.json` (10, all dead). PIN MOVED: `test/audit24_combat.test.js`'s bow edge onto the
drawn bow, which keeps it; `test/mwattackclip.test.js`'s MW-D12 source pin reads the gate.
