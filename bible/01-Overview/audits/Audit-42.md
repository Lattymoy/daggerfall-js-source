# AUDIT 42 - THE LAB, MEASURED (2026-08-31)

Mac: a deep comprehensive audit on everything. Method, deliberately:
NOT another read of the code. The black sky cost an hour of reasoning
and was named in one probe that read the uniforms off the live
program, so this audit measures the running page and argues only
about what comes back.

## What was measured

**Every active uniform of every program, at four states** - at rest,
mid-front, with the sun below the horizon, and mid snow-front. The
sweep reads each value back with getUniform and reports any that is
not finite.

  RESULT: none, at any state. The NaN class that blackened the sky is
  closed, and the guard holds through a transition, which is where
  the bruise arithmetic that caused it actually runs.

**GL state at frame end**, the same four states: blend off, depth
test on, depth mask on, polygon offset off, glError 0 throughout. No
pass leaks state into the next frame - which matters because the sky
now disables the depth test and the near patch enables a polygon
offset, and either left on would be a silent, moving fault.

**The sky's own pixels**, read from the frame buffer:

  sunny noon  zenith 122,162,222   upper 157,191,236
  sunset      zenith 141,136,158   upper 226,187,175

  The dome is blue at noon and VIOLET at the zenith with an EMBER
  upper band at sunset - which is the fine sunset ramp reaching the
  screen, measured rather than admired. The sky is drawing.

## Finding

**F1 - THE GUARD COVERED ONE SETTER ON ONE PROGRAM.** After the NaN
was found, the non-finite check went on the sky's vec3 setter and
nowhere else. The same value in the ground's ambient, the blades' sun
colour or the rain's wind vector would blacken those passes just as
silently. safe1/safe3/safeN are shared now and every uniform this
page sets goes through them. A guard is only worth something where
the NEXT one will land.

## Not covered, said plainly

- The night and thunder pixel reads timed out in the harness before
  they ran; the two that completed are the two reported.
- Snow accumulation and the walked trail are still unverified here -
  they need real seconds and a real GPU, so their first honest
  reading remains Mac's.
- Everything in this file is a LAB. None of it is in the game, and
  the port is four separate seams (terrain chunker, texture array,
  instanced draw, weather state), each of which is where a divergence
  like this audit's would be introduced.
