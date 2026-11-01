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
//  - zoomOutWhenMoveCoef / head bobbing / previewIfStandStill /
//    slowViewChange: all DEFAULT OFF in the reference (settings.lua:43-55,
//    67), and vanilla Morrowind has none of them - the third-person camera
//    sits centered behind the actor. With those defaults,
//    third_person.lua:135-137 collapses the preferred distance to the base
//    distance flat, which is what this module implements.
//  - viewOverShoulder (settings.lua:44, off) IS here since MW-SHOULDER, as
//    the player's option and off by default (the shoulder's law, below).
//    Its two DISTANCE terms are not: with it on, the reference pulls the
//    camera out as the look rises and as the actor speeds up
//    (third_person.lua:80-84, :152-161, zoomOutWhenMoveCoef 20). The option
//    moves the focal point; the distance stays the wheel's. Nor is
//    autoSwitchShoulder (settings.lua:47, off: the shoulder is the one the
//    player chose).
//  - castSphere (camera.cpp:186/201): the port's colliders cast RAYS.
//    The reference backs the hit off by the sphere radius along the hit
//    NORMAL; for a head-on surface that equals backing off along the
//    ray, which is what the port does. The divergence is a grazing hit,
//    where the reference keeps slightly more clearance.

/** components/misc/constants.hpp:10 - the reference's own unit bridge.
 *  ONE HOME: minted in the format layer (mwFirstPerson.js), re-exported
 *  here because it is part of this module's contract too. */
import { MW_UNITS_PER_METER } from '../formats/morrowind/mwFirstPerson.js';
import { seaZoomStep, SEA_ZOOM_RATIO } from './seaZoom.js'; // FIELD BUGS 2026-09-29 (the sea) #3: the zoom at a helm
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

/**
 * MW-SHOULDER (FIELD BUGS 2026-10-26c; feature-feedback via Mac: "add an option to move camera a bit to the side ... for
 * morrowind 3rd person models ... because crosshair is located on top of character's head and it is inconvenient to
 * target something with ranged attacks"): THE REFERENCE'S VIEW OVER THE SHOULDER, the player's option
 * (systems/features.js 'mw-shoulder-camera'). The focal point - the head the camera turns about - stands off the
 * actor's line: settings.lua:45-46's [x, y] behind the chosen shoulder (third_person.lua:39-40 - the left the right's
 * mirror), and while a weapon or a spell is out, or the actor swims, centred and raised (third_person.lua:27, :89-92).
 * Raised, the crosshair stands over the head, not on it; and a shot - which leaves the head along the look in every
 * host, as the reference's projectile leaves the actor (weaponanimation.cpp:111-114) - still lands where the crosshair
 * says, 15 units under it. Behind a shoulder its line would pass 30 units to the side of the crosshair's.
 * [x, y] are MW units: x to the actor's right (camera.cpp:101-107 getFocalPointOffset), y up.
 */
export const SHOULDER_OFFSET = Object.freeze([30, -10]);
/** third_person.lua:27 - combatOffset, the focal point while a weapon or a spell is out (and while swimming). */
export const COMBAT_OFFSET = Object.freeze([0, 15]);
/** third_person.lua:110-116 - the focal transition's speed: into or out of combat, and every other change. */
export const FOCAL_TRANSITION_SPEED = Object.freeze({ combat: 5.0, normal: 1.0 });
/** The player's three choices (the feature's tiers): no offset (vanilla's centred camera), and the two shoulders. */
export const SHOULDER_SIDES = Object.freeze(['off', 'right', 'left']);

/**
 * camera.cpp:247-294 - THE FOCAL POINT'S TRANSITION, verbatim: setFocalPointTargetOffset carries the speed the offset
 * was moving at into the new transition (its influence fading at the transition's speed), and each frame the offset
 * closes on its target by `dt * (1 + 5 / |delta|) * speed`, at most all of it; instantTransition skips to the target
 * on the next step. Pure state; [x, y] in MW units.
 */
export function createFocalOffset() {
  let current = [0, 0],
    target = [0, 0],
    coef = 1;
  let speed = [0, 0],
    prevSpeed = [0, 0],
    prevExtra = [0, 0],
    prevInfluence = 0,
    skip = true;
  return {
    current: () => current,
    target: () => target,
    /** setFocalTransitionSpeed (third_person.lua:110-116). */
    setSpeed(v) {
      coef = v;
    },
    /** camera.cpp:247-252 setFocalPointTargetOffset. */
    setTarget(v) {
      target = [v[0], v[1]];
      prevSpeed = [speed[0], speed[1]];
      prevInfluence = 1;
    },
    /** camera.cpp:423-426 instantTransition's focal half. */
    instant() {
      skip = true;
    },
    /** camera.cpp:254-294 updateFocalPointOffset. */
    step(dt) {
      if (!(dt > 0)) return current;
      if (skip) {
        skip = false;
        prevExtra = [0, 0];
        prevInfluence = 0;
        current = [target[0], target[1]];
      }
      const old = [current[0], current[1]];
      if (prevInfluence > 0) {
        current = [current[0] - prevExtra[0], current[1] - prevExtra[1]];
        prevExtra = [
          prevExtra[0] / prevInfluence + prevSpeed[0] * dt,
          prevExtra[1] / prevInfluence + prevSpeed[1] * dt,
        ];
        prevInfluence = Math.max(0, prevInfluence - dt * coef);
        prevExtra = [prevExtra[0] * prevInfluence, prevExtra[1] * prevInfluence];
        current = [current[0] + prevExtra[0], current[1] + prevExtra[1]];
      }
      const delta = [target[0] - current[0], target[1] - current[1]],
        dl = Math.hypot(delta[0], delta[1]);
      if (dl > 0) {
        const k = Math.min(1, dt * (1 + 5 / dl) * coef * (1 - prevInfluence));
        current = [current[0] + delta[0] * k, current[1] + delta[1] * k];
      } else {
        prevExtra = [0, 0];
        prevInfluence = 0;
      }
      speed = [(current[0] - old[0]) / dt, (current[1] - old[1]) / dt];
      return current;
    },
  };
}

/** MW-D30 / camera.cpp:323-331 - setPitch clamps to +/-(PI/2 - epsilon)
 *  with epsilon 0.000001f. The hosts had a hand-rolled +/-1.5, which
 *  stops the look ~4 degrees short of straight up and down. */
export const PITCH_LIMIT = Math.PI / 2 - 0.000001;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * One per game, like the arm - there is one player. The machine holds
 * MODE and BASE DISTANCE - the two things the reference persists,
 * each in its own home: the distance through the camera script's
 * onSave (camera.lua:350-352, `distance = third_person.baseDistance`
 * and nothing else), the mode through the save's own REC_CAM_ record
 * (worldimp.cpp:425-427 writes FIRS; statemanagerimp.cpp:617-618
 * force-applies it on load). Everything else is recomputed per
 * frame.
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
  // FIELD BUGS 2026-09-29 (the sea) #3: at a helm the far end is the hull's reach (MW units; 0 on foot) - the host says
  // it each frame (setSeaReach), and a distance past the reference's own maxDistance is the helm's alone
  let seaFar = 0;
  // The ACTUAL distance after obstacle pull-in, in MW units - the zoom
  // law reads it back (camera.lua:146 getThirdPersonDistance).
  let cameraDistance = 0;
  // camera.cpp:225-232 - a view change that arrives while the upper
  // body is busy (attack, equip) is QUEUED, not dropped: "Changing the
  // view will stop all playing animations, so if we are playing
  // anything important, queue the view change for later."
  let queuedFirstPerson = null;
  // MW-SHOULDER: the player's side ('off' | 'right' | 'left'), third_person.lua's `state` and noThirdPersonLastFrame,
  // and camera.cpp's focal offset
  let shoulder = 'off',
    shoulderState = null,
    noThirdLast = true;
  const focalShift = createFocalOffset();

  function setFirstPerson(next, ready) {
    if (next === firstPerson) {
      queuedFirstPerson = null;
      return;
    }
    if (!ready) {
      queuedFirstPerson = next;
      return;
    }
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
      // #3: past the reference's far end, at a helm, a notch is a ratio - out from the far end, or in down to it (and
      // the reference's own ladder below it); out while pinned by more than one such notch is its no-op (camera.lua:153)
      // HELM-ZOOM (Mac: "increase the sensitivity ... when on the wheel"): at a helm the WHOLE range is by the ratio, the
      // reference's nearest ring to the hull's reach - its ten-unit ladder took sixty notches from its base to its far end
      if (seaFar > MAX_DISTANCE && !(delta > 0 && baseDistance === MIN_DISTANCE)) {
        // AUDIT HELM-ZOOM E1: in from where the camera STANDS when pinned (the reference's own debt, camera.lua:151) - in
        // from the distance it wants spent notches unseen; E2: one notch a frame whatever the wheel sent (a trackpad's
        // swipe sends a burst of them, and a ratio each crossed the whole range in one gesture)
        const notch = Math.max(-1, Math.min(1, delta / WHEEL_STEP));
        const from = delta > 0 ? Math.max(MIN_DISTANCE, baseDistance - Math.max(0, obstacleDelta)) : baseDistance;
        if (delta > 0 || obstacleDelta < baseDistance * (SEA_ZOOM_RATIO - 1))
          baseDistance = seaZoomStep(from, notch, MIN_DISTANCE, seaFar);
        return;
      }
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
    mode() {
      return firstPerson ? 'first' : 'third';
    },
    thirdPerson() {
      return !firstPerson;
    },
    queued() {
      return queuedFirstPerson;
    },
    baseDistance() {
      return baseDistance;
    },
    cameraDistance() {
      return cameraDistance;
    },

    /** Wheel notches: +1 per click zooming in (ZoomIn = wheel up,
     *  bindingsmanager.cpp:300-301), -1 zooming out. One click is
     *  WHEEL_STEP units (actionbindings.lua:106). `ready` gates the
     *  FP boundary crossing (camera.cpp:225-232); zoom distance inside
     *  third person never needs it. */
    wheel(clicks, { ready = true } = {}) {
      if (!clicks) return;
      zoom(clicks * WHEEL_STEP, ready);
    },

    /** MW-SHOULDER: the player's side ('off', 'right', 'left'; anything else is off). A change is updateSettings'
     *  (third_person.lua:31-44): the next step takes the new offset at once. */
    setShoulder(side) {
      const next = SHOULDER_SIDES.includes(side) ? side : 'off';
      if (next !== shoulder) {
        shoulder = next;
        noThirdLast = true;
      }
    },
    shoulder: () => shoulder,
    shoulderState: () => shoulderState,
    focalOffset: () => focalShift.current(),

    /**
     * MW-SHOULDER: THE FRAME'S SHOULDER - third_person.lua M.update (:129-162) without its distance terms (the module
     * head), then camera.cpp's focal transition (:145, updateFocalPointOffset). `stance` is the actor's: 'combat' (a
     * weapon or a spell out - Actor.getStance, :89), 'swimming' (Actor.isSwimming, :91), or nothing. In first person
     * the next third-person frame starts afresh (:131-133); with the option off the offset is none, at once (:135-143);
     * on, updateState (:86-127, autoSwitchShoulder off): the chosen shoulder, or the combat offset, eased at the
     * transition's speed - fast into and out of combat - and at once on the frame the view or the option changed.
     */
    stepShoulder(dt, stance = null) {
      if (firstPerson) {
        noThirdLast = true;
        focalShift.step(dt);
        return;
      }
      if (shoulder === 'off') {
        if (noThirdLast) {
          focalShift.setTarget([0, 0]);
          focalShift.instant();
          noThirdLast = false;
        }
        shoulderState = null;
        focalShift.step(dt);
        return;
      }
      const own = shoulder === 'left' ? 'left' : 'right';
      const old = shoulderState;
      if (stance === 'combat') shoulderState = 'combat';
      else if (stance === 'swimming') shoulderState = 'swimming';
      else shoulderState = own; // :93-104 - out of combat or the water, or none yet: the default shoulder (no auto switch)
      if (old !== shoulderState || noThirdLast) {
        focalShift.setSpeed(
          old === 'combat' || shoulderState === 'combat'
            ? FOCAL_TRANSITION_SPEED.combat
            : FOCAL_TRANSITION_SPEED.normal,
        );
        focalShift.setTarget(
          shoulderState === 'right'
            ? SHOULDER_OFFSET
            : shoulderState === 'left'
              ? [-SHOULDER_OFFSET[0], SHOULDER_OFFSET[1]]
              : COMBAT_OFFSET,
        );
      }
      if (noThirdLast) {
        focalShift.instant();
        noThirdLast = false;
      } // :153-156 - just into third person: no transition
      focalShift.step(dt);
    },

    /** camera.cpp:135 - a queued view change lands as soon as the upper
     *  body is ready. */
    update({ ready = true } = {}) {
      if (queuedFirstPerson !== null && ready) setFirstPerson(queuedFirstPerson, true);
    },

    /** #3: the helm's reach (m; 0 or less on foot, none): the far end the wheel zooms to while sailing. Off the helm a
     *  distance past the reference's far end comes back to it. */
    setSeaReach(metres) {
      seaFar = Number.isFinite(metres) && metres * MW_UNITS_PER_METER > MAX_DISTANCE ? metres * MW_UNITS_PER_METER : 0;
      if (baseDistance > Math.max(MAX_DISTANCE, seaFar)) baseDistance = Math.max(MAX_DISTANCE, seaFar);
    },
    seaFar() {
      return seaFar;
    },

    /** Restore/persist seam (camera.lua:350-352 saves the distance). The helm's zoom is its own: a distance past the
     *  reference's far end is saved as that far end. */
    state() {
      return { firstPerson, baseDistance: Math.min(baseDistance, MAX_DISTANCE) };
    },
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
     *
     * MAC-A (2026-09-17, Mac: "Going in some interiors with roof
     * pillars interacts negatively with the 3rd person camera").
     *
     * BOTH GUARDS ARE SPHERE CASTS, because both of the reference's
     * are: `rayCasting->castSphere(...)` at camera.cpp:186 and :200,
     * with the limit as the SPHERE'S RADIUS - not a ray with the limit
     * subtracted off the end, which is what this port had.
     *
     * A ray and a five-unit sphere disagree in exactly the place Mac
     * found. A pillar is thin, and a single ray from the head to the
     * camera threads PAST one that a sphere of radius 5 hits square:
     * the camera slides through the pillar, the pillar fills the frame
     * for a frame or two, and it pops out the far side. When the ray
     * does catch an EDGE, `hit - limit` is a different number from one
     * frame to the next by the whole width of the pillar, so the
     * camera snaps in and out as you walk past it. Both are the same
     * mistake: a line where the reference has a volume.
     *
     * The distance is the SWEPT SPHERE'S OWN, with nothing taken off
     * it. `castSphere` answers a hit POINT and the reference then
     * re-derives the sphere's centre at contact
     * (`hitPos + hitNormal * limit`) before measuring back to the
     * focal - and that centre is precisely what a swept-sphere cast
     * reports as the distance travelled, which is what
     * `collider.sphereCast` returns (player/collider.js: "how far the
     * sphere's CENTRE travels before the leading cap touches"). So the
     * clearance is kept by the radius rather than by a subtraction,
     * and the old `- CAMERA_OBSTACLE_LIMIT` would now take it twice.
     *
     * `spherecast(origin, radius, dir, maxDist) -> dist|null` is the
     * new seam; a host that hands only `raycast` keeps the old line
     * (the headless pins, and any caller written before this).
     */
    eye({ fpEye, feet, yaw, pitch, heightScale = 1, raycast = null, spherecast = null, pivotFloor = null }) {
      if (firstPerson) {
        cameraDistance = 0; // camera.cpp:165-169
        return { eye: fpEye, thirdPerson: false, distance: 0, focal: null };
      }
      const u = 1 / MW_UNITS_PER_METER;
      // BENCH-CAM (2026-10-10): on a wagon's bench the focal stands at least at the host's `pivotFloor` (over the wagon's
      // roof) - over the caravan's room by 12 cm it stood, and any look up cast the camera into it and back to the
      // focal; under the open wagon's tilt it stood inside the canvas. A departure from camera.cpp, Ledger A.
      const focal = [feet[0], Math.max(feet[1] + FOCAL_HEIGHT * heightScale * u, pivotFloor ?? -Infinity), feet[2]];
      // MAC-A: the cast is a SPHERE where the host has one
      // (castSphere, camera.cpp:186); the ray is the fallback for a
      // host that hands no sphere seam.
      const cast = spherecast ? (o, d, m, r) => spherecast(o, r, d, m) : raycast ? (o, d, m) => raycast(o, d, m) : null;
      // MW-SHOULDER: the focal point's offset (camera.cpp:101-107 - x along the actor's right, y up; this port's right
      // is (cos yaw, 0, -sin yaw), the strafe's, world/mat4.js's handedness law), and camera.cpp:177-193's guard in
      // full: a sphere swept from the actor's line to the offset focal point (the +10 ceiling term added to its run,
      // camera.cpp:180), the focal point left where it touches. With no offset - the option off, the vanilla camera -
      // the clause is the one below, as it always was.
      const fo = focalShift.current();
      const shoulderOn = cast && (fo[0] !== 0 || fo[1] !== 0);
      if (fo[0] !== 0 || fo[1] !== 0) {
        focal[0] += Math.cos(yaw) * fo[0] * u;
        focal[1] += fo[1] * u;
        focal[2] -= Math.sin(yaw) * fo[0] * u;
        if (pivotFloor != null) focal[1] = Math.max(focal[1], pivotFloor);
      }
      if (shoulderOn) {
        const run = [Math.cos(yaw) * fo[0] * u, (fo[1] + FOCAL_OBSTACLE_LIMIT) * u, -Math.sin(yaw) * fo[0] * u];
        const len = Math.hypot(run[0], run[1], run[2]);
        const dir = [run[0] / len, run[1] / len, run[2] / len];
        const from = [focal[0] - run[0], focal[1] - run[1], focal[2] - run[2]];
        const hit = cast(from, dir, len, FOCAL_OBSTACLE_LIMIT * u);
        const k = hit != null && hit < len ? Math.max(0, spherecast ? hit : hit - FOCAL_OBSTACLE_LIMIT * u) : null;
        if (k != null) for (let i = 0; i < 3; i++) focal[i] = from[i] + dir[i] * k;
      } else if (cast) {
        // camera.cpp:177-193 with the default zero focal offset: the
        // offset the cast walks is the +10 ceiling term alone
        // (camera.cpp:180), so the whole clause reduces to "keep the
        // focal FOCAL_OBSTACLE_LIMIT under the ceiling, dropping it at
        // most the offset's own length".
        const guard = FOCAL_OBSTACLE_LIMIT * u;
        const up = cast([focal[0], focal[1] - guard, focal[2]], [0, 1, 0], guard * 2, guard);
        if (up != null && up < guard * 2) {
          const ceilingY = focal[1] - guard + up;
          focal[1] = Math.max(focal[1] - guard, Math.min(focal[1], ceilingY - guard));
        }
      }
      const cp = Math.cos(pitch);
      const fwd = [Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp];
      let dist = preferredDistance() * u;
      if (cast) {
        // camera.cpp:200-206 - pull in to the obstacle, keeping
        // CAMERA_OBSTACLE_LIMIT of clearance. MAC-A: the clearance is
        // the swept sphere's RADIUS now, so the distance is the cast's
        // own and nothing is subtracted from it.
        const limit = CAMERA_OBSTACLE_LIMIT * u;
        const hit = cast(focal, [-fwd[0], -fwd[1], -fwd[2]], dist, limit);
        if (hit != null && hit < dist) dist = Math.max(0, spherecast ? hit : hit - limit);
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
