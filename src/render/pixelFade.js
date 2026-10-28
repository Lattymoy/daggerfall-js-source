// @ts-check
// ═══════════════════════════════════════════════════════════════════
// MID-RING (2026-10-26, the owner: "Currently tiles visibly load in with distance"; bible/06-Systems/Travel-View.md
// MID-RING): A PIXEL THE STREAM HAS JUST BUILT EASES OUT OF THE MIDDLE RING'S TINT.
//
// The pixel's ground stood as the middle ring a frame before - the kernel's own shape in the far ring's tint
// (render/midRing.js) - and the stream's build laid the ground's own tiles over it at once: the shape held, the colour
// popped. A pixel published PIXEL_FADE_RING pixels or more from the traveller carries its arrival and its centre's tint on
// its terrain surface (`_fadeFrom`, `_fadeTint` - scenes/pixelBuild.js), and both lanes' ground programs mix the tint over
// its tiles by the share left (render/renderer.js drawTerrain, `uFadeTint`): a colour, never a discard, so the ground
// keeps its early depth test (GROUND-LAST). The near rings - the boot's own pixel, a teleport's - stand at once.
// A leaf of no imports: the renderer reads it on the boot's path (test/render/boot2.test.js).
// ═══════════════════════════════════════════════════════════════════

export const PIXEL_FADE_MS = 1200;
export const PIXEL_FADE_RING = 2;

/** The tint's share left of a pixel that arrived at `from` (performance.now), at `now`: 1 at its arrival, eased to 0 over
 *  PIXEL_FADE_MS (a smoothstep: no step where it starts or ends). */
export function pixelFadeShare(from, now) {
  const t = Math.min(1, Math.max(0, (now - from) / PIXEL_FADE_MS));
  return 1 - t * t * (3 - 2 * t);
}

/** Stamp a just-built pixel's terrain surface with its arrival and its tint (0-255), where it stands PIXEL_FADE_RING or
 *  more from the traveller's pixel (`cur`); answers whether it did. */
export function stampPixelFade(surface, px, py, cur, tint, now) {
  if (!surface || !cur || Math.max(Math.abs(px - cur.x), Math.abs(py - cur.y)) < PIXEL_FADE_RING) return false;
  surface._fadeFrom = now;
  surface._fadeTint = [tint[0] / 255, tint[1] / 255, tint[2] / 255];
  return true;
}
