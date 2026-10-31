// @ts-check
// PVP-CONE (the owner, 2026-10-29: "Was thinking we needed to make them not visible less u look within a angle"; then
// "Yes" to everywhere): another player's name tag - its skull and bars with it - shows only near the crosshair, and
// fades in and out. My party and my foe of the last minute always show. The law is here; net/remotePlayers.js namePoints
// hands each point its angle (`off`), scenes/pvpFlagHost.js its `near`, and ui/nameLayer.js wears the answer.

/** The cone: full inside `deg - band / 2`, none past `deg + band / 2`, eased over `fadeMs` when the target moves. */
export const NAME_CONE = Object.freeze({ deg: 20, band: 6, fadeMs: 250 });

/** Degrees between the camera's forward and a world point, read off the view matrix (column-major, the eye down -z). */
export function nameOffDeg(view, p) {
  if (!view || !p) return 0;
  const x = view[0] * p[0] + view[4] * p[1] + view[8] * p[2] + view[12];
  const y = view[1] * p[0] + view[5] * p[1] + view[9] * p[2] + view[13];
  const z = view[2] * p[0] + view[6] * p[1] + view[10] * p[2] + view[14];
  return (Math.atan2(Math.hypot(x, y), -z) * 180) / Math.PI;
}

/** A tag's wanted opacity: 1 for a point with no angle, my party or my foe; else the cone's band. (AUDIT FB1029g R4: a
 *  board's count was the one other point the names' pass took, and it went with the boards.) */
export function nameConeTarget(p) {
  if (!p || p.near || !Number.isFinite(p.off)) return 1;
  const lo = NAME_CONE.deg - NAME_CONE.band / 2;
  return Math.max(0, Math.min(1, 1 - (p.off - lo) / NAME_CONE.band));
}

/** One frame's step from `was` toward `want`, at most `dt / fadeMs` of the way, so a tag never pops. */
export function nameConeStep(was, want, dt) {
  if (!Number.isFinite(was)) return want;
  const most = Math.max(0, dt) / NAME_CONE.fadeMs;
  return was + Math.max(-most, Math.min(most, want - was));
}
