// @ts-check
// INDOOR-FLOOR (FIELD BUGS 2026-10-30b, peers "falling through floor" indoors; the owner: "Room-relative height"): A POSE
// INDOORS CARRIES ITS ROOM'S FLOOR. Rooms stand at each client's own town ground, so two copies whose ground differs
// drew each other sunk or floating. `fy` is the sender's room origin in the wire's frame (net/wire.js validPose); a
// reader indoors draws the peer as high over its own room. Without it, the wire's height as before. Not a DFU member.
// bible/01-Overview/bugs/Field-Bugs-2026-10-30b.md section 5.

/** The room's origin height in the wire's frame - the interior's parent origin less the floating origin `comp` - or
 *  null with no room (`ctx` falsy: outdoors). @param {any} ctx @param {number} comp */
export function indoorFloorOf(ctx, comp) {
  const o = ctx ? ctx.parentPt?.(0, 0, 0) : null;
  return o && Number.isFinite(o[1]) ? o[1] - comp : null;
}
/** The pose with its room's floor, `fy` - the pose as it is outdoors. @param {any} pose @param {any} ctx @param {number} comp */
export function withIndoorFloor(pose, ctx, comp) {
  const f = indoorFloorOf(ctx, comp);
  if (f != null) pose.fy = Math.round(f * 100) / 100;
  return pose;
}
/** AUDIT FB1030 N1: `o` (a mark of where a body lies) with the room's floor `pose` said, if it said one. */
export const keepIndoorFloor = (o, pose) => (Number.isFinite(pose?.fy) ? { ...o, fy: pose.fy } : o);
/** A peer pose's height in this scene: over this room's floor as far as over the sender's, where both say one; else
 *  the wire's height shed of the floating origin, as before. @param {any} p @param {any} ctx @param {number} comp */
export function indoorSceneY(p, ctx, comp) {
  const f = Number.isFinite(p?.fy) ? indoorFloorOf(ctx, comp) : null;
  return f != null ? p.y - p.fy + f + comp : p.y + comp;
}
