// UnityEngine.Mathf's own arithmetic, where the port needs it to be
// Unity's rather than JavaScript's.
//
// ONE HOME (EOTB3, 2026-09-15). `roundToInt` was ported once for DFU's
// horizontal slider and was about to be ported a second time for Eye
// Of The Beholder's orientation snap - caught by audit24's
// duplicate-declaration ratchet, which is exactly the "ONE DFU MEMBER,
// ONE EXPORT" rule doing its job. Two copies of a rounding rule is two
// chances to get the tie wrong, and the second caller lives in
// `player/`, which has no business importing a UI slider to round a
// number.

/**
 * `Mathf.RoundToInt`: BANKER'S ROUNDING on the .5 tie - a half goes to
 * the nearest EVEN integer - which is NOT `Math.round`, and the
 * difference is only ever visible exactly on a tie.
 *
 * Where it bites, in the two callers that have it:
 *   - `ui/horizontalSlider.js` - SetIndicator runs three values through
 *     it (:207-211) and SetValue one more (:246-250).
 *   - `player/eotbBillboard.js` - the 8-orientation snap divides the
 *     angle by 45, so a player standing exactly side-on to the camera
 *     lands on a tie, and JS's round-toward-+infinity would flip the
 *     sprite one orientation early on one side and not the other.
 */
export function roundToInt(v) {
  const f = Math.floor(v);
  const d = v - f;
  if (d !== 0.5) return Math.round(v);
  return f % 2 === 0 ? f : f + 1;
}

/** GLSL's `smoothstep`, on the CPU: the Hermite step, clamped - 0 at or
 *  below `a`, 1 at or above `b`.
 *
 *  ONE HOME (GRASS2, 2026-09-18), and the ratchet caught it exactly as
 *  it caught `roundToInt` above. GRASS2 needed this because the grass
 *  field's HOST now has to predict what its own vertex shader will keep:
 *  the blade budget is a bound on the shader's fade, so the two must be
 *  the SAME curve - a host curve that fell faster than the shader's
 *  would cut blades the shader wanted, which is a visible thinning
 *  rather than a saving. A second copy of a curve that has to agree
 *  with a third party (GLSL) is two chances to disagree with it.
 *
 *  It was written a second time in `render/labGrass.js` and a first time
 *  in `systems/weatherFront.js`; both now import it from here. */
export function smoothstep(a, b, x) {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
}
