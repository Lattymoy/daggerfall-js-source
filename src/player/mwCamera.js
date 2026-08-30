// THE MORROWIND CAMERA MACHINE (MW-D25). The reference's player camera,
// ported whole from three homes that share the law between them:
//
//   apps/openmw/mwrender/camera.cpp        - the position/mode machine
//   files/data/scripts/omw/camera/camera.lua        - the zoom law
//   files/data/scripts/omw/camera/third_person.lua  - the distance law
//   files/data/scripts/omw/input/actionbindings.lua - the wheel's units
//
// Every constant below is the reference's own number in the reference's
// own units, cited at the line that mints it, so the pins can assert the
// reference values verbatim. Morrowind units convert to this port's
// meters at ONE boundary (the eye computation) through the reference's
// own bridge: components/misc/constants.hpp:10, UnitsPerMeter.
//
// WHAT IS DELIBERATELY NOT HERE, with reasons rather than silence:
//  - Preview mode (TogglePOV held past 0.25s, camera.lua:86-111): the
//    port has no TogglePOV binding; the requested switch is the wheel.
//    The tap-to-toggle half of that law IS reachable from the wheel
//    (this module's zoom), so nothing the wheel can do is lost.
//  - Vanity mode (camera.lua:113-127, idle > fVanityDelay then a 3
//    deg/s yaw orbit): needs an idle-input timer the port's hosts do
//    not yet expose, and fVanityDelay is a Morrowind GMST this port
//    does not read. Deferred, not faked.
//  - viewOverShoulder / shoulder offsets / zoomOutWhenMoveCoef / head
//    bobbing / previewIfStandStill / slowViewChange: all DEFAULT OFF in
//    the reference (settings.lua:43-55, 67), and vanilla Morrowind has
//    none of them - the third-person camera sits centered behind the
//    actor. With those defaults, third_person.lua:135-137 collapses the
//    preferred distance to the base distance flat, which is what this
//    module implements.
//  - castSphere (camera.cpp:186/201): the port's colliders cast RAYS.
//    The reference backs the hit off by the sphere radius along the hit
//    NORMAL; for a head-on surface that equals backing off along the
//    ray, which is what the port does. The divergence is a grazing hit,
//    where the reference keeps slightly more clearance.

/** components/misc/constants.hpp:10 - the reference's own unit bridge.
 *  ONE HOME: minted in the format layer (mwFirstPerson.js), re-exported
 *  here because it is part of this module's contract too. */
import { MW_UNITS_PER_METER } from '../formats/mwFirstPerson.js';
export { MW_UNITS_PER_METER };

/** camera.cpp:63 - the third-person focal point sits this far above the
 *  tracked position (the actor's base), scaled by the node's z-scale
 *  (camera.cpp:96-97). */
export const FOCAL_HEIGHT = 124;

/** third_person.lua:16 - the base third-person distance a fresh camera
 *  starts at. */
export const BASE_DISTANCE = 192;

/** camera.lua:137 - the closest the third-person camera zooms; one more
 *  zoom-in from here is the switch to first person (camera.lua:147-150). */
export const MIN_DISTANCE = 30;

/** settings.lua:43 - maxDistance default. */
export const MAX_DISTANCE = 800;

/** actionbindings.lua:106 - one wheel click is 10 units of zoom. */
export const WHEEL_STEP = 10;

/** camera.cpp:172 - the camera keeps this much clearance off obstacles
 *  behind the actor. */
export const CAMERA_OBSTACLE_LIMIT = 5;

/** camera.cpp:173/180 - the focal point keeps this much clearance off
 *  the ceiling, "because character's head can be a bit higher than the
 *  collision area". */
export const FOCAL_OBSTACLE_LIMIT = 10;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * One per game, like the arm - there is one player. The machine holds
 * MODE and BASE DISTANCE (the two things the reference persists,
 * camera.lua:347-352); everything else is recomputed per frame.
 *
 * Hosts feed it three seams:
 *   wheel(clicks)  - wheel notches, +1 per click toward the actor
 *                    (ZoomIn), -1 away (ZoomOut) - actionbindings.lua:99-104.
 *   update({ready}) - resolves a queued view change, camera.cpp:135.
 *   eye({...})     - the frame's camera position, camera.cpp:160-209.
 */
export function createMwCamera() {
  // camera.cpp:58 - the camera starts in first person.
  let firstPerson = true;
  let baseDistance = BASE_DISTANCE;
  // The ACTUAL distance after obstacle pull-in, in MW units - the zoom
  // law reads it back (camera.lua:146 getThirdPersonDistance).
  let cameraDistance = 0;
  // camera.cpp:225-232 - a view change that arrives while the upper
  // body is busy (attack, equip) is QUEUED, not dropped: "Changing the
  // view will stop all playing animations, so if we are playing
  // anything important, queue the view change for later."
  let queuedFirstPerson = null;

  function setFirstPerson(next, ready) {
    if (next === firstPerson) { queuedFirstPerson = null; return; }
    if (!ready) { queuedFirstPerson = next; return; }
    firstPerson = next;
    queuedFirstPerson = null;
  }

  /** third_person.lua:135-137 - with viewOverShoulder off (the default
   *  and the vanilla look), the preferred distance IS the base. */
  const preferredDistance = () => baseDistance;

  /**
   * camera.lua:139-160, with the reference's defaults folded in (no
   * preview, no standing preview, no noModeControl/noZoom tags). delta
   * is in MW units, +toward the actor.
   */
  function zoom(delta, ready) {
    if (!firstPerson) {
      const obstacleDelta = preferredDistance() - cameraDistance;
      if (delta > 0 && baseDistance === MIN_DISTANCE) {
        // camera.lua:147-150 - already at the closest ring: the next
        // click steps INTO the head.
        setFirstPerson(true, ready);
      } else if (delta > 0 || obstacleDelta < -delta) {
        // camera.lua:151-153 - zooming subtracts the obstacle debt too,
        // so a wall-pinned camera zooms from where it actually IS; and
        // zooming OUT while pinned is a no-op until the pin releases.
        baseDistance = clamp(baseDistance - delta - obstacleDelta, MIN_DISTANCE, MAX_DISTANCE);
      }
    } else if (delta < 0) {
      // camera.lua:155-158 - zooming out of the head lands on the
      // closest third-person ring, not the remembered distance.
      setFirstPerson(false, ready);
      baseDistance = MIN_DISTANCE;
    }
  }

  return {
    /** 'first' | 'third' - what the frame should draw. */
    mode() { return firstPerson ? 'first' : 'third'; },
    thirdPerson() { return !firstPerson; },
    queued() { return queuedFirstPerson; },
    baseDistance() { return baseDistance; },
    cameraDistance() { return cameraDistance; },

    /** Wheel notches: +1 per click zooming in (ZoomIn = wheel up,
     *  bindingsmanager.cpp:300-301), -1 zooming out. One click is
     *  WHEEL_STEP units (actionbindings.lua:106). `ready` gates the
     *  FP boundary crossing (camera.cpp:225-232); zoom distance inside
     *  third person never needs it. */
    wheel(clicks, { ready = true } = {}) {
      if (!clicks) return;
      zoom(clicks * WHEEL_STEP, ready);
    },

    /** camera.cpp:135 - a queued view change lands as soon as the upper
     *  body is ready. */
    update({ ready = true } = {}) {
      if (queuedFirstPerson !== null && ready) setFirstPerson(queuedFirstPerson, true);
    },

    /** Restore/persist seam (camera.lua:347-352 saves the distance). */
    state() { return { firstPerson, baseDistance }; },
    restore(s) {
      if (!s) return;
      if (typeof s.firstPerson === 'boolean') firstPerson = s.firstPerson;
      if (Number.isFinite(s.baseDistance)) baseDistance = clamp(s.baseDistance, MIN_DISTANCE, MAX_DISTANCE);
      queuedFirstPerson = null;
    },

    /**
     * THE FRAME'S EYE - camera.cpp:160-209 in the port's meters and
     * y-up basis. In first person the eye is the host's own (rule 54
     * already tracks the rig's Camera node through fpArm); in third
     * person:
     *
     *   focal  = feet + FOCAL_HEIGHT*scale up        camera.cpp:96-97
     *   ceiling guard: the focal keeps FOCAL_OBSTACLE_LIMIT of
     *   clearance overhead, dropping at most its own offset length
     *                                                camera.cpp:177-193
     *   eye    = focal - fwd(yaw,pitch) * distance   camera.cpp:196-208
     *   with the distance sphere-cast back from the focal and backed
     *   off CAMERA_OBSTACLE_LIMIT                    camera.cpp:200-206
     *
     * `raycast(origin, dir, maxDist) -> dist|null` is the host
     * collider's seam; null/miss means unobstructed. fwd is the port's
     * y-up forward from yaw/pitch, the same basis every scene's lookAt
     * uses, so the focal lands dead centre of the frame - which is
     * vanilla's centered-behind camera (no shoulder offset by default,
     * settings.lua:44).
     */
    eye({ fpEye, feet, yaw, pitch, heightScale = 1, raycast = null }) {
      if (firstPerson) {
        cameraDistance = 0;   // camera.cpp:165-169
        return { eye: fpEye, thirdPerson: false, distance: 0, focal: null };
      }
      const u = 1 / MW_UNITS_PER_METER;
      const focal = [feet[0], feet[1] + FOCAL_HEIGHT * heightScale * u, feet[2]];
      if (raycast) {
        // camera.cpp:177-193 with the default zero focal offset: the
        // offset the cast walks is the +10 ceiling term alone
        // (camera.cpp:180), so the whole clause reduces to "keep the
        // focal FOCAL_OBSTACLE_LIMIT under the ceiling, dropping it at
        // most the offset's own length".
        const guard = FOCAL_OBSTACLE_LIMIT * u;
        const up = raycast([focal[0], focal[1] - guard, focal[2]], [0, 1, 0], guard * 2);
        if (up != null && up < guard * 2) {
          const ceilingY = focal[1] - guard + up;
          focal[1] = Math.max(focal[1] - guard, Math.min(focal[1], ceilingY - guard));
        }
      }
      const cp = Math.cos(pitch);
      const fwd = [Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp];
      let dist = preferredDistance() * u;
      if (raycast) {
        // camera.cpp:200-206 - pull in to the obstacle, keeping
        // CAMERA_OBSTACLE_LIMIT of clearance.
        const hit = raycast(focal, [-fwd[0], -fwd[1], -fwd[2]], dist);
        if (hit != null && hit < dist) dist = Math.max(0, hit - CAMERA_OBSTACLE_LIMIT * u);
      }
      cameraDistance = dist * MW_UNITS_PER_METER;
      return {
        eye: [focal[0] - fwd[0] * dist, focal[1] - fwd[1] * dist, focal[2] - fwd[2] * dist],
        thirdPerson: true,
        distance: dist,
        focal,
      };
    },
  };
}

/** The one live instance, module-level like fpArm - one player, one
 *  camera. Scenes import this rather than each minting their own. */
export const mwCamera = createMwCamera();
