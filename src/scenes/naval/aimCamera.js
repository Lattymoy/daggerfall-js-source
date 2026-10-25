// @ts-check
// THE AIM CAMERA (AUDIT NAV1's broadside camera; AIM-ENDS, 2026-10-24, Discord - "Aiming front ship cannons impossible":
// "The camera moves to the side of the ship when you're aiming the side cannons, so likewise the camera should move to
// the front/back accordingly when aiming"; bible/03-World/Naval-Combat.md AIM-ENDS) - where the helm's eye stands while
// a battery is laid. The port's own: Daggerfall has no sea. Wired by the naval host (navalHost.js createNavalHost
// `aimCam`, its `aimEye` the frame's: scenes/world.js reads it as before).
//
//   A BROADSIDE  the eye eases (over AIM_CAM_TAU s, smoothstepped) to AIM_CAM_OUT past the battery's ports, AIM_CAM_UP
//                over them and AIM_CAM_AFT toward her stern - her guns, the zone and the enemy on one screen - and
//                AIM_CAM_CLEAR short of a ship alongside on its way out.
//   THE BOW      the bow chasers: AIM_CAM_UP over them and ahead along her keel - AIM_CAM_AHEAD past them, and
//                AIM_CAM_CLEAR past the furthest reach of her hull and of every sail she has set (`endEye`) - so
//                nothing of her stands between the eye and the arcs. AUDIT NAV1 kept the eye home for the chasers, and
//                from the helm's eye behind her rig the jib hid every arc the chasers drew. AUDIT AIM-ENDS A2/A4: the
//                first cut stood AIM_CAM_AHEAD past the guns alone - inside the Large Galley's prow, which reaches 6 m
//                past her guns, and behind the galleon's set jib.
//   THE STERN    the stern's barrels: straight over the rail they roll from, AIM_CAM_UP over it and clear over her
//                hull and canvas there - the barrel's fall and its mark lie under the eye, a look down over the
//                stern. AUDIT AIM-ENDS A1: the first cut stood AIM_CAM_AHEAD astern of the rail, past the barrel's
//                mark 1.5 m out, and looking astern no part of the fall it drew was ever on the screen.
//   ONE SIDE TO THE NEXT  the eye's place is eased in her own frame (AIM_CAM_TAU a step), so a look swung from a
//                broadside past the bow's arc carries the eye round to the bow, as it carried it out from the helm -
//                AUDIT AIM-ENDS A3: it jumped 29-56 m in a frame. Her own frame, so a ship under way never drags it.
//   NEVER        with the Broadside camera off (`naval-aim-camera`), for a crippled ship (her guns are silent), or
//                with nothing laid - and home again on the release, the eye its own once there.
import { segmentBoxEntry, toBoxLocal, flatUnit } from '../../systems/naval/navalBallistics.js';
import { batteryOf, SIDE_DIR } from '../../systems/naval/navalShips.js';
import { toWorld } from '../../systems/naval/navalGunnery.js';
import { quatRotate } from '../../world/quat.js';

/** THE BROADSIDE CAMERA: while a broadside is laid, the eye eases (over AIM_CAM_TAU s) to AIM_CAM_OUT past the battery's
 *  ports, AIM_CAM_UP over them and AIM_CAM_AFT toward the stern (m) - her guns, the zone and the enemy on one screen. */
export const AIM_CAM_OUT = 4;
export const AIM_CAM_UP = 5.5;
export const AIM_CAM_AFT = 3;
export const AIM_CAM_TAU = 0.22;
/** ...and stops this far (m) short of another ship's side on its way out from the ports. AIM-ENDS: and stands this far
 *  clear of her own canvas over the bow or the stern. */
export const AIM_CAM_CLEAR = 1.2;
/** AIM-ENDS: over the bow chasers the eye stands at least this far (m) past them along her keel. */
export const AIM_CAM_AHEAD = 4;

const isEnd = (side) => side === 'bow' || side === 'stern';
const inside = (box, p, pad) => { const l = toBoxLocal(box, p); return Math.abs(l[0]) <= box.h[0] + pad && Math.abs(l[1]) <= box.h[1] + pad && Math.abs(l[2]) <= box.h[2] + pad; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** How far along the unit direction `d` an oriented box reaches (its middle's, and each half size along it). */
export const reachAlong = (box, d) => dot(box.c, d) + Math.abs(dot(box.ax, d)) * box.h[0] + Math.abs(dot(box.ay, d)) * box.h[1] + Math.abs(dot(box.az, d)) * box.h[2];
const UP = Object.freeze([0, 1, 0]);

/**
 * AUDIT AIM-ENDS: THE EYE OVER AN END, before a ship alongside is asked - `c` the battery's middle, `fwd` her keel's way
 * (flat, unit), `own` her hull's box and her set canvas's. The bow: AIM_CAM_UP over the chasers, AIM_CAM_AHEAD past them
 * or AIM_CAM_CLEAR past the furthest any of `own` reaches, whichever is further. The stern: AIM_CAM_UP straight over the
 * barrels' rail, lifted AIM_CAM_CLEAR over any of `own` it would stand in.
 */
export function endEye(side, c, fwd, own) {
  if (side === 'bow') {
    const along = Math.max(dot(c, fwd) + AIM_CAM_AHEAD, ...own.filter(Boolean).map((b) => reachAlong(b, fwd) + AIM_CAM_CLEAR));
    const k = along - dot(c, fwd);
    return [c[0] + fwd[0] * k, c[1] + AIM_CAM_UP, c[2] + fwd[2] * k];
  }
  const p = [c[0], c[1] + AIM_CAM_UP, c[2]];
  for (let pass = 0; pass <= own.length; pass++) {
    const over = own.filter((b) => b && inside(b, p, AIM_CAM_CLEAR));
    if (!over.length) break;
    p[1] = Math.max(...over.map((b) => reachAlong(b, UP) + AIM_CAM_CLEAR));
  }
  return p;
}
/** A world point in her own frame (toWorld's inverse). */
const toLocal = (pose, p) => {
  const q = pose.rotation;
  return quatRotate([-q[0], -q[1], -q[2], q[3]], [p[0] - pose.position[0], p[1] - pose.position[1], p[2] - pose.position[2]]);
};

/**
 * The aim camera: `eye(ownEye, dt)` is the frame's eye - `ownEye` eased toward the laid battery's own while one is
 * laid, and home.
 * @param {object} deps
 * @param {(key: string, dflt: any) => any} deps.setting   the player's own parts (AimCamera)
 * @param {() => boolean} deps.aiming   the attack held at an armed helm
 * @param {() => ({ side: string } | null)} deps.aim   the solution laid this frame
 * @param {() => any} deps.boat   my boat at the helm, or null
 * @param {(boat: any) => boolean} deps.wrecked   crippled: her guns silent
 * @param {(boat: any) => { position: number[], rotation: number[] }} deps.pose
 * @param {() => Iterable<any>} deps.alongside   the hull boxes of the ships about her (seaClearance.js createSeaHulls)
 * @param {(boat: any) => any} deps.hull   her own hull's box (navalHost.js hullBoxOf)
 * @param {(boat: any) => any[]} deps.rig   her own canvas as boxes (navalHost.js rigBoxesOf)
 */
export function createAimCamera(deps) {
  let camK = 0, camSide = null, camLocal = /** @type {number[] | null} */ (null);   // AUDIT AIM-ENDS A3: the eye's place, eased in her frame
  function eye(ownEye, dt) {
    const boat = deps.boat();
    const aim = deps.aim();
    const want = deps.setting('AimCamera', true) !== false && deps.aiming() && boat && aim && aim.side
      && !deps.wrecked(boat) ? aim.side : null;
    if (want) camSide = want;
    camK += ((want ? 1 : 0) - camK) * (1 - Math.exp(-Math.max(0, dt) / AIM_CAM_TAU));
    if (!want && camK < 1e-3) { camK = 0; camSide = null; camLocal = null; }
    if (!boat || !camSide || camK <= 0) return ownEye;
    const pose = deps.pose(boat);
    const bat = batteryOf(boat.hull, camSide);
    if (!bat) return ownEye;
    const ports = bat.muzzles.map((m) => toWorld(pose, m));
    const c = ports.reduce((acc, m) => [acc[0] + m[0] / ports.length, acc[1] + m[1] / ports.length, acc[2] + m[2] / ports.length], [0, 0, 0]);
    const fire = flatUnit(quatRotate(pose.rotation, SIDE_DIR[camSide])) ?? [1, 0, 0];
    const fwd = flatUnit(quatRotate(pose.rotation, [0, 0, 1])) ?? [0, 0, 1];
    let at = isEnd(camSide)
      ? endEye(camSide, c, fwd, [deps.hull(boat), ...deps.rig(boat)])   // AIM-ENDS: clear of all of her there
      : [c[0] + fire[0] * AIM_CAM_OUT - fwd[0] * AIM_CAM_AFT, c[1] + AIM_CAM_UP, c[2] + fire[2] * AIM_CAM_OUT - fwd[2] * AIM_CAM_AFT];
    // never inside a ship alongside - a broadside at her rail's width is the one Black Flag remembers
    let clear = 1;
    for (const box of deps.alongside()) {
      const hit = box ? segmentBoxEntry(c, at, box, AIM_CAM_CLEAR) : null;
      if (hit && hit.t < clear) clear = hit.t;
    }
    if (clear < 1) at = [c[0] + (at[0] - c[0]) * clear, c[1] + (at[1] - c[1]) * clear, c[2] + (at[2] - c[2]) * clear];
    // AUDIT AIM-ENDS A3: from one battery's place to the next eased, in her own frame
    const local = toLocal(pose, at);
    const step = 1 - Math.exp(-Math.max(0, dt) / AIM_CAM_TAU);
    camLocal = camLocal ? camLocal.map((v, i) => v + (local[i] - v) * step) : local;
    at = toWorld(pose, camLocal);
    const k = camK * camK * (3 - 2 * camK);   // eased in and out
    return [ownEye[0] + (at[0] - ownEye[0]) * k, ownEye[1] + (at[1] - ownEye[1]) * k, ownEye[2] + (at[2] - ownEye[2]) * k];
  }
  return { eye };
}
