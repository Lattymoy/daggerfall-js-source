// EOTB2: THE EYE OF THE BEHOLDER CAMERA, 1:1.
//
// RedRoryOTheGlen's `EyeOfTheBeholder` MonoBehaviour, read out of the
// shipped assembly's IL (`Eye Of The Beholder.dll`, 2.1) - method by
// method, with the branch targets normalised, because a misread branch
// is how a "1:1" port quietly stops being one. `monodis` segfaults on
// this assembly; it was read with dncil/dnfile.
//
// WHY THE PORT CARRIES A SECOND THIRD-PERSON CAMERA. Mac, 2026-09-15:
// "This is moreso for those who opt out of using morrowind." The
// port's own third person (MW-D24/MW-D25) draws a MORROWIND body and
// cannot exist without Morrowind data - `player/mwView.js` says so in
// its own head. This one draws the mod's sprite and needs nothing.
//
// THE UNITS CARRY OVER UNCONVERTED, and that is worth stating because
// its sibling's do not: mwCamera works in MW units and divides by
// MW_UNITS_PER_METER at the seam, while this mod's numbers are Unity
// metres and the port's world is metres, so LongitudinalDistance 2 is
// two metres here exactly as it is there. Nothing to scale, and a
// scale factor quietly introduced later would be a bug rather than a
// refinement.
//
// THE FRAMES. Unity gives the mod two transforms; the port has none,
// so they are spelled out:
//   BODY - the player, upright, yaw only. `bodyVector` is its
//          TransformVector.
//   EYE  - the camera, yaw AND pitch. `eyeVector` is its
//          TransformVector, and it is what the offset rides, which is
//          why looking up walks the camera along the view rather than
//          along the ground.

import { MOD_SETTINGS } from '../systems/modSettings.js';

/** `eyeRadius` is a field initialiser in the mod's own .ctor, not a
 *  setting - the clearance the camera keeps off a wall. */
export const EYE_RADIUS = 0.25;

/** Update's far clamp: the Z offset never passes -10 however long the
 *  wheel is turned (`if (z < -10) offsetScroll = 10 + (posOffset.z +
 *  offsetScroll)`, which solves to exactly z = -10). */
export const MAX_Z = -10;

/** The three `CameraOverride*` sections, in the order `posOffset`
 *  tests them - boat, then mount, then weapon, then the base. The
 *  ORDER is load-bearing: a mounted player with a weapon readied takes
 *  the MOUNT offsets, because the mount arm returns first. */
export const OVERRIDE_ORDER = Object.freeze(['Boat', 'Mount', 'Weapon']);

const setting = (name) => MOD_SETTINGS['eye-of-the-beholder'].keys[name];

/**
 * Read the mod's settings the way `LoadSettings` reads them, including
 * its one sign flip: `offsetZ = LongitudinalDistance * -1`, so a
 * POSITIVE setting means that many metres BEHIND. The three override
 * sections flip the same way.
 *
 * `get` is the port's settings reader (vendor, key) -> value; it is a
 * parameter rather than an import so the pins can drive the camera on
 * a fixture instead of the shelf.
 */
export function readCameraSettings(get) {
  const g = (key) => {
    const v = get?.('eye-of-the-beholder', key);
    return v === undefined || v === null ? setting(key)?.default : v;
  };
  const frontal = (section) => {
    const t = g(`${section}.FrontalPlaneOffset`) ?? [0, 0];
    return [t[0] ?? 0, t[1] ?? 0];
  };
  const override = (section) => {
    const [x, y] = frontal(section);
    return {
      enabled: !!g(`${section}.Enable`),
      x, y,
      z: -(g(`${section}.LongitudinalDistance`) ?? 0),   // LoadSettings' `* -1`
    };
  };
  const [x, y] = frontal('Camera');
  return {
    startInThird: !!g('Camera.StartInThirdPerson'),
    x,
    y,
    z: -(g('Camera.LongitudinalDistance') ?? 0),          // LoadSettings' `* -1`
    minZ: g('Camera.MinimumDistance') ?? 0,               // a FRACTION of z, not a distance
    riding: g('Camera.RidingOffset') ?? 0,
    speed: g('Camera.Speed') ?? 0,
    dampen: g('Camera.Dampen') ?? 0,
    mirrorAuto: !!g('Camera.Auto-Switch'),
    mirrorTime: g('Camera.SwitchResetTime') ?? 0,
    scrollable: !!g('CameraScrolling.ScrollableZOffset'),
    increment: g('CameraScrolling.ScrollIncrement') ?? 0,
    boatTarget: g('CameraOverrideBoat.Target') ?? 0,
    overrides: Object.freeze({
      Boat: override('CameraOverrideBoat'),
      Mount: override('CameraOverrideMount'),
      Weapon: override('CameraOverrideWeapon'),
    }),
  };
}

const rotY = (v, yaw) => {
  const s = Math.sin(yaw), c = Math.cos(yaw);
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
};

/** BODY's TransformVector: yaw alone, the player standing upright. */
export const bodyVector = (v, yaw) => rotY(v, yaw);

/** EYE's TransformVector: the camera's own basis, yaw AND pitch. Built
 *  from the same y-up forward every scene's lookAt uses, so `right`,
 *  `up` and `forward` here are the frame's own. */
export function eyeBasis(yaw, pitch) {
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const forward = [Math.sin(yaw) * cp, sp, Math.cos(yaw) * cp];
  const right = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const up = [
    right[1] * forward[2] - right[2] * forward[1],
    right[2] * forward[0] - right[0] * forward[2],
    right[0] * forward[1] - right[1] * forward[0],
  ];
  return { right, up, forward };
}
export function eyeVector(v, yaw, pitch) {
  const { right, up, forward } = eyeBasis(yaw, pitch);
  return [
    right[0] * v[0] + up[0] * v[1] + forward[0] * v[2],
    right[1] * v[0] + up[1] * v[1] + forward[1] * v[2],
    right[2] * v[0] + up[2] * v[1] + forward[2] * v[2],
  ];
}

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** Unity's Vector3.MoveTowards: step toward the target, never past it. */
function moveTowards(from, to, step) {
  const d = dist(from, to);
  if (d <= step || d === 0) return [...to];
  const k = step / d;
  return [from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k, from[2] + (to[2] - from[2]) * k];
}

export function createEotbCamera() {
  // `offset` is the mod's own name for "in third person". Kept, so the
  // IL and this file read as the same program.
  let offset = false;
  let offsetScroll = 0;
  let mirror = false;
  let mirrorOriginal = false;
  let mirrorTimer = 0;
  let posCurrent = [0, 0, 0];
  let posTarget = [0, 0, 0];
  let boundsX = 0, boundsY = 0, boundsZ = 0;
  let cfg = readCameraSettings(null);
  // MW-D30's lesson, which applies to this mod's wheel for the same
  // reason: the mod reads `Input.GetAxis` ONCE per Update and acts on
  // the sign, so a burst of DOM wheel events inside one frame must
  // arrive as one reading, not N.
  let pending = 0;
  // the eye's last first-person position: ToggleOffset starts the
  // smoothing from wherever the eye actually was, which is what makes
  // the camera SWING out instead of cutting to the target
  let lastEye = [0, 0, 0];
  let lastDt = 0;

  /**
   * `posOffset`, the mod's own property. Four arms in the order the IL
   * tests them, each mirrored on X when `mirror` is set, each with the
   * scroll subtracted from Z. Only the BASE arm scales by the riding
   * offset - the override arms do not, which is the mod's own
   * asymmetry and not a slip in the reading.
   */
  function posOffset(state) {
    const m = mirror ? -1 : 1;
    const o = cfg.overrides;
    if (o.Boat.enabled && state.sailing) return [m * o.Boat.x, o.Boat.y, o.Boat.z - offsetScroll];
    if (o.Mount.enabled && state.riding) return [m * o.Mount.x, o.Mount.y, o.Mount.z - offsetScroll];
    if (o.Weapon.enabled && state.weaponReady) return [m * o.Weapon.x, o.Weapon.y, o.Weapon.z - offsetScroll];
    const r = state.riding ? cfg.riding : 0;      // get_offsetRidingMod
    return [m * cfg.x, cfg.y + cfg.y * r, cfg.z + cfg.z * r - offsetScroll];
  }

  /**
   * `CheckBounds`. One raycast per axis, from the body's head along
   * that axis of the EYE's basis, and the axis is skipped entirely
   * when its offset is zero - so a camera straight behind the player
   * casts once, not three times.
   *
   * The cast's length is `|offset * 2| + eyeRadius` and a hit records
   * `hit.distance - eyeRadius * 2`, which is the mod's own clearance
   * arithmetic. A miss records the full length.
   */
  function checkBounds(origin, state, yaw, pitch, raycast) {
    const off = posOffset(state);
    const { right, up, forward } = eyeBasis(yaw, pitch);
    const axis = (i, base) => {
      if (off[i] === 0) return null;
      const dir = off[i] < 0 ? [-base[0], -base[1], -base[2]] : base;
      const len = Math.abs(off[i] * 2) + EYE_RADIUS;
      const hit = raycast ? raycast(origin, dir, len) : null;
      return hit != null && hit < len ? hit - EYE_RADIUS * 2 : len;
    };
    const bx = axis(0, right);
    if (bx !== null) boundsX = bx;
    // THE AUTO-SWITCH rides inside CheckBounds, between the X cast and
    // the Y cast, and it flips `mirror` in place - so the Y and Z
    // casts below already see the mirrored offset. Reordering these is
    // a behaviour change, not a tidy-up.
    if (bx !== null && cfg.mirrorAuto
        && Math.abs(boundsX) < Math.abs(off[0]) / 2 + EYE_RADIUS) {
      mirror = !mirror;
      if (cfg.mirrorTime > 0) mirrorTimer = 0;
    }
    const by = axis(1, up);
    if (by !== null) boundsY = by;
    const bz = axis(2, forward);
    if (bz !== null) boundsZ = bz;
  }

  /** `SetVectorBounds`: clamp each axis to its measured bound, on the
   *  side the offset points. An axis with no offset is left alone. */
  function setVectorBounds(v, state) {
    const off = posOffset(state);
    const out = [...v];
    const clamp = (i, bound) => {
      if (off[i] === 0) return;
      if (off[i] < 0) { if (out[i] < -bound) out[i] = -bound; } else if (out[i] > bound) out[i] = bound;
    };
    clamp(0, boundsX); clamp(1, boundsY); clamp(2, boundsZ);
    return out;
  }

  /**
   * `ToggleOffset`. Entering third person zeroes the scroll and starts
   * the smoothing FROM THE EYE'S CURRENT POSITION, which is what makes
   * the camera swing out rather than cut.
   */
  function toggleOffset(on) {
    if (on) {
      offsetScroll = 0;
      posCurrent = [...lastEye];
    }
    offset = !!on;
    return offset;
  }

  /**
   * The auto-switch's revert, Update's own block. Once the timer is up
   * it re-probes the side the camera would go BACK to, from a point
   * centred on the body rather than from the camera - so it asks "is
   * the original shoulder clear now", not "is the camera clear now".
   */
  function revertMirror(origin, state, yaw, raycast) {
    if (mirror === mirrorOriginal || cfg.mirrorTime <= 0) return;
    if (mirrorTimer <= cfg.mirrorTime) { mirrorTimer += lastDt; return; }
    const off = posOffset(state);
    const right = [Math.cos(yaw), 0, -Math.sin(yaw)];
    const dir = off[0] < 0 ? right : [-right[0], -right[1], -right[2]];
    const len = Math.abs(off[0] * 2) + EYE_RADIUS;
    const hit = raycast ? raycast(origin, dir, len) : null;
    if (hit != null && hit < len) {
      if (hit < Math.abs(off[0]) / 2 + EYE_RADIUS) mirrorTimer = 0;   // still blocked
      else mirror = mirrorOriginal;
    } else mirror = mirrorOriginal;
  }

  return {
    /** mwCamera's own vocabulary, so `mwView` can route to whichever
     *  body answers without learning a second language (EOTB4). */
    mode: () => (offset ? 'third' : 'first'),
    thirdPerson: () => offset,
    scroll: () => offsetScroll,
    mirrored: () => mirror,
    bounds: () => [boundsX, boundsY, boundsZ],
    settings: () => cfg,
    pendingClicks: () => pending,

    loadSettings(get) { cfg = readCameraSettings(get); return cfg; },

    /** `StartInThirdPerson` - the POV a new or loaded game takes. */
    start() {
      mirror = false; mirrorOriginal = mirror; mirrorTimer = 0; offsetScroll = 0;
      offset = false;
      if (cfg.startInThird) toggleOffset(true);
      return offset;
    },

    toggleOffset,

    /** `SwitchShoulder`: mirrors X, and re-bases what the auto-switch
     *  reverts TO - the mod's own `mirrorOriginal` follows a manual
     *  switch, so an automatic flip still returns to the side the
     *  player last chose. */
    switchShoulder() {
      if (cfg.x === 0) return mirror;   // "if it is non-zero", the setting's own words
      mirror = !mirror;
      mirrorOriginal = mirror;
      mirrorTimer = 0;
      return mirror;
    },

    /**
     * The wheel, queued. One notch is one click; positive is TOWARD the
     * player (scroll up), matching both the mod's `GetAxis > 0` arm and
     * mwCamera's `delta > 0`.
     */
    wheel(clicks) {
      if (!clicks) return false;
      pending += clicks;
      return true;
    },

    /**
     * Update's ladder, flushed once a frame. This is the whole of Mac's
     * ask, and it is the MOD'S OWN arm rather than an invention: the
     * bundle ships `CameraScrolling` with `scrollableOffsetTogglePOV`
     * in the assembly, and its shape is Morrowind's shape -
     *
     *   FIRST person + scroll out       -> third, at the base distance
     *   THIRD person + scroll           -> nearer / further by the increment
     *   THIRD person + past the near end-> first
     *   THIRD person + past MAX_Z       -> pinned, the wheel does nothing
     *
     * which is why the two cameras can share one ladder honestly.
     */
    tick(state = {}) {
      const clicks = pending;
      pending = 0;
      if (!cfg.scrollable) return offset;
      const z = posOffset(state)[2];
      const nearEnd = -cfg.minZ;                 // Update's `stloc.1`: NEGATED
      if (!offset) {
        if (clicks < 0) { toggleOffset(true); offsetScroll = 0; }
        return offset;
      }
      // ONE increment a frame, SIGN ONLY. The mod reads `GetAxis` once
      // per Update and branches `> 0` / `< 0`; it never scales by the
      // reading's magnitude, so three notches inside one frame move the
      // camera exactly as far as one does. Keeping that is what makes
      // the wheel feel like the mod's rather than like the browser's.
      if (clicks > 0) offsetScroll -= cfg.increment;
      else if (clicks < 0) offsetScroll += cfg.increment;
      const z2 = posOffset(state)[2];
      if (z2 < MAX_Z) offsetScroll = -MAX_Z + (z2 + offsetScroll);
      else if (z2 > nearEnd) toggleOffset(false);
      return offset;
    },

    /**
     * The frame's eye. `Update`'s target-and-smooth, then `LateUpdate`'s
     * write:
     *
     *   posTarget  = body.position + body.TransformVector(headLocal)
     *              + eye.TransformVector(SetVectorBounds(posOffset))
     *   s          = dampen ? speed * |posCurrent - posTarget| / dampen : speed
     *   posCurrent = MoveTowards(posCurrent, posTarget, dt * s)
     *   then the MinimumDistance floor, in the BODY's frame.
     */
    eye({ fpEye, feet, yaw, pitch, dt = 0, raycast = null, ...state }) {
      lastEye = fpEye;
      lastDt = dt;
      if (!offset) return { eye: fpEye, thirdPerson: false, distance: 0, focal: null };
      const headLocal = [0, fpEye[1] - feet[1], 0];
      const origin = add(feet, bodyVector(headLocal, yaw));

      // the shoulder's own revert probe runs BEFORE CheckBounds, as in
      // Update - it may hand CheckBounds a different `mirror`
      revertMirror(origin, state, yaw, raycast);
      checkBounds(origin, state, yaw, pitch, raycast);

      posTarget = add(origin, eyeVector(setVectorBounds(posOffset(state), state), yaw, pitch));
      let s = cfg.speed;
      if (cfg.dampen !== 0) s = cfg.speed * dist(posCurrent, posTarget) / cfg.dampen;
      posCurrent = moveTowards(posCurrent, posTarget, dt * s);

      // THE MINIMUM DISTANCE, which is a FRACTION of the live Z offset
      // and not a distance of its own - and it only applies while the
      // measured wall is FARTHER than the floor, so a camera already
      // pinned against a wall is left where the wall put it.
      const minZ = posOffset(state)[2] * cfg.minZ;
      if (cfg.minZ !== 0 && boundsZ > Math.abs(minZ)) {
        const local = bodyVector([posCurrent[0] - feet[0], posCurrent[1] - feet[1], posCurrent[2] - feet[2]], -yaw);
        if (local[2] > minZ) local[2] = minZ;
        posCurrent = add(feet, bodyVector(local, yaw));
      }
      return {
        eye: [...posCurrent],
        thirdPerson: true,
        distance: dist(posCurrent, origin),
        focal: origin,
      };
    },
  };

}
/** One player, one camera - the module-level instance fpArm and
 *  mwCamera both keep. */
export const eotbCamera = createEotbCamera();
