# AUDIT 37 - THE PLAY-NOTES LANE (2026-08-31)

Mac's call: a comprehensive audit, immediately after PX26 and PX27
answered three and a half of his four play notes. Method: the two
slices read for what they BROKE as well as what they fixed, the
sprint traced against the fetched reference line by line, and the
notes still open stated rather than implied.

## Finding

**F1 - PX27 FIXED THE FAR PLANE AND MOVED THE NEAR ONE WITH IT
(mine, one hour old).** The first-person camera's two planes both
hang off a single number: `near = reach/200`, `far = reach*4`. PX27
grew `reach` deliberately - sweeping every clip so a swing could not
be cut short - and the same growth pushed the NEAR plane out by the
same factor. On a rig whose widest pose is four times its idle, the
near plane moves from ~0.15 to ~0.7 rig units, and a knuckle a
quarter-unit from the camera disappears: the fix for the elbow would
have started clipping the hand. Fixed by measuring TWO reaches, which
is what the two planes were always asking for - the far plane takes
PX27's sweep, the near plane keeps the IDLE reach, the pose it was
tuned against and the one the arm holds closest to the eye. Pinned on
both the draw and the build, with the idle reach asserted to be
measured separately rather than aliased. 2 mutants dead.

## The sprint (note 2), traced against the reference

Read line by line against character.cpp as fetched today:

- **The rate**: `speed / mMovementAnimSpeed`, capped at 10
  (:2400-2405). The port: same division, same cap, and the metres of
  the port's own motor crossed into MW units through the one bridge
  because the clip velocity is in MW units. Matches.
- **The clip velocity**: `getVelocity(mCurrentMovement)`, and when it
  is <= 1 the three fallback constants keyed on sneaking / running
  (:743-752). The port: `sourcesVelocity` over the composed group,
  same `> 1` test, same three constants. Matches.
- **The turn branch**: `min(1.5, |rot.z|/duration/PI)` (:2394-2397).
  The port's `turnAnimSpeed` is that expression. Matches.
- **The run -> walk swap** when the composed name has no animation
  (:697-699), and the fallback constant still reading `isRunning()`
  so a swapped WALK clip plays at the RUN divisor. The port does the
  same, which is why a sprint on data without `runforward` looks like
  a fast walk - in the reference too.

Two DECLARED divergences recorded, neither reachable as a defect
here: `mAdjustMovementAnimSpeed` is only ever false on the creature
branch, which this player-only lane has none of; and
`mMovementAnimationHasMovement` feeds `isMovementAnimationControlled`,
which scales ACTUAL movement from the animation - a thing this port
does not do at all, because the player motor owns movement.

No finding. If the sprint still reads wrong to Mac's eye on his data,
the next step is not more source reading: it is the card's own
`movementRate` and `movementAnimSpeed` readout while sprinting, which
`status()` already carries.

## Still open, said plainly

Note 2 (the sprint) stands unresolved with parity verified above.
Notes 1, 3 and 4 are answered by PX26 and PX27 and await Mac's eye on
real data.
