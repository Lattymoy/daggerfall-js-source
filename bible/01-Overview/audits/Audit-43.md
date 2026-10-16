# AUDIT 43 - THE LAB AFTER PROTO-14 (2026-08-31)

Mac: a comprehensive audit. Method as Audit 42 - measure the running
page, argue only about what comes back.

## Measured

**Every active uniform of every program at four states** - rest,
rain, night, snow: no non-finite values anywhere. The shared guards
introduced in Audit 42 hold across the seven new terms PROTO-14
added, which is the case they were put there for.

**GL state at frame end**, same four states: blend off, depth test
on, depth mask on, polygon offset off, glError 0. Nothing leaks -
which now matters more, because the frame disables the depth test for
the sky, enables a polygon offset for the near patch, and binds four
texture units.

**Texture units**: all four bound and none contested. The surface
field is unit 3 for both the ground and the grass, and both rebind it
themselves before use rather than trusting the other pass.

**The surface field's own texture**, read back through a framebuffer
during snowfall: maxSnow = 0 at 4s and at 12s. See F1 - the number is
correct and the system is not the fault.

## Finding

**F1 - THE LAB COULD NOT BE OBSERVED.** A front took 26 seconds and
the particles only begin at 45% of it, so nothing falls for the first
twelve seconds after choosing a weather and the ground takes twenty
more to whiten. That is honest weather and terrible tooling: three
times now I have failed to confirm accumulation in a harness run and
reported it unverified, and each time the cause was the clock, not
the code. A lab that cannot be watched inside one run cannot be
tuned. The front's pace is a SLIDER now and starts at nine seconds;
the game's own front is minutes, and the slider is what maps between
the two.

## Not covered, said plainly

The accumulation itself is STILL not confirmed by me - the third
read never landed before the harness gave out. What changed is that
it is now observable in seconds, so the next attempt, mine or Mac's,
will settle it either way instead of timing out again.
