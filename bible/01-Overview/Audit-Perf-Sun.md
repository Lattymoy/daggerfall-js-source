# AUDIT PERF-SUN / PERF-FOG (2026-09-19) - four findings over the fragment slice

Mac: *"Lets do an audit on everythinf"*, over the two commits sitting
above main - PERF-SUN (the far cascade's kernel, the sun-term gates, the
sway door) and PERF-FOG (the fog colour decoded once a frame instead of
once a fragment).

Four findings, all four fixed. **Two of them are about the PINS rather
than the code**, and the one that was a live bug was not in this slice
at all - it was found one method away from a pin this slice had just
written against that exact hazard.

---

## F4 (FIXED, PRE-EXISTING) - the billboard tint's moon term was reading the SUN

`_c3(src, scratch)` decodes a colour into a scratch the caller names, and
the renderer keeps two of them. The billboard-tint site wanted three:

```js
const am = this._c3(this._ambient, this._decA),
      mc = this._c3(this._moonColor, this._decB),
      sc = this._c3(this._sunColor,  this._decB);   // <- the same one
```

`mc` and `sc` were therefore **the same Float32Array**, and `sc`'s decode
overwrote `mc`'s contents before the very next statement read `mc` to
build `uBBTint`. So the tint's moon term was computed from the sun's
colour - on every flat in the world, every night.

It is the only site in the file that holds more than one decoded colour
live at once, which is exactly why it is the only one that could have
this. There are three scratches now, and the pin holds **the general
rule** as well as the site: no statement may take two decodes into one
scratch, so the next caller who needs a fourth colour fails in the suite
rather than in the field.

Two things worth saying about how it was found. It surfaced while
auditing `_fogColorLinear`, which PERF-FOG had deliberately given its
*own* triple rather than `_c3`'s shared one - the audit asked "who else
shares a scratch?" and there it was, one method away. And the bug had
been sitting **inside an EL1 mutant record**, quoted verbatim, since
that record was written: which is how a defect hides inside a law
nobody reads as a claim about correctness.

## F3 (FIXED) - the water pin proved the wrong variable

PERF-SUN2's gate forces the water's `shadow` to zero when the sun is
down. The pin proved that `diff` has exactly one consumer - and `diff`
is not the variable the gate touches. **`shadow` has two**: the diffuse
term and a sun specular.

It is still output-identical, and now for a stated reason rather than a
lucky one: *every* consumer of `shadow` carries `uSunScale` itself, so
forcing it to zero where `uSunScale` is zero cannot move a pixel. The
pin finds them all instead of assuming there is one.

It also strips **trailing** comments before counting, not just whole
comment lines: the water's own `#version` line ends in "the water
receives the lane's sun shadow", and a word-boundary search for `shadow`
counted it as a use of the variable. (GLSL has no string literals, so
cutting at `//` is safe.)

## F2 (FIXED) - the note claimed the opposite of what the code does

`SHADOW_PCF_CASCADES` is tested as `c >= SHADOW_PCF_CASCADES`, so **every
cascade from that index outward** takes the cheap tap - not just the
last. The note first written beside it said "a cascade count this does
not cover keeps the kernel, which is the safe direction if the cascades
are ever re-cut." That is false.

The code's behaviour is the right one: the cascades ascend by radius, so
a further one is always the coarser map and can only want the kernel
less - a fourth cascade should be cheap, and would be. It is the note
that was wrong, and a false claim about a safe direction is precisely
this slice's own lesson turned on itself.

## F1 (FIXED) - the sway door's state was declared below its reader

`let _swaySearch;` sat under the function that reads it. A `let` below
its reader is in the temporal dead zone until the module finishes
evaluating. Nothing calls `swayDisabled` during module init today - but
this port has already lost a boot to one end of a module cycle reaching
the other too early (the HOTFIX black screen), and the fix for that
class is to not write the shape at all.

---

## Refuted, with numbers

- **"The cascade 1/2 seam will be more visible."** The opposite. A
  hardware tap is a 2x2 and the 3x3 loop an effective 4x4, so the blur
  width is texel x kernel: cascade 1 blurs 19 cm, and cascade 2 blurred
  **94 cm** before and **47 cm** now. The far side is *sharper* than it
  was, and the step across the boundary fell from 5x to 2.5x.
- **"The classic skin pays the same sun-term waste."** It does not.
  `cloudShadowAt` early-outs on `uCloudShadowRect.w <= 0`, which is zero
  for the classic skin and every interior, and the classic shaders have
  no sun map at all.
- **"A lane program might miss the new fog uniform."** Every shader that
  calls `elFinish` is one of the four in `_laneSet`, all four take their
  fog through `_fogLocs`, and the probe LINKS all four in a real driver
  and asks for the location. The far ring pastes the same block but has
  its own finish and its own upload path; the character sprite quad and
  the water never call `elFinish` and never declare the uniform.

## Recorded, not taken

**Cascade 1 is the same case as cascade 2, arithmetically.** Its texel is
4.7 cm, which is about a pixel and a half at thirty metres - so by the
argument that made the far cascade cheap, it could take the one tap too.
It keeps the kernel because there the 3x3 is a soft EDGE, a look, and not
only antialiasing; cascade 1 is the street in front of you. Written in
numbers so the next reader re-opens it as a choice rather than
rediscovering it as an oversight.

**8 pins, 20 mutants (20 dead, 0 survived).** EL1's `renderer-bb-tint-raw`
re-aimed by content. Full check green: 9194 tests.

**The lesson: two of these four were the pins lying, not the code - one
counted its own explanation, one counted a variable the change does not
touch. A pin that passes for the wrong reason is worse than no pin,
because it is also a claim that somebody checked.**
