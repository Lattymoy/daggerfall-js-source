// EOTB2: THE EYE OF THE BEHOLDER CAMERA.
//
// RedRoryOTheGlen's `EyeOfTheBeholder` MonoBehaviour, read out of the
// shipped assembly's IL (`Eye Of The Beholder.dll`, 2.1) - method by
// method, with the branch targets normalised, because a misread branch
// is how a "1:1" port quietly stops being one. `monodis` segfaults on
// this assembly; it was read with dncil/dnfile.
//
// EOTB-IL (2026-09-17): READ AGAIN, AGAINST THE VENDORED DUMP, and
// fourteen readings corrected - each cites its offset where it lands.
// The ones a player meets: the auto-toggle table was DISARMED by the
// mod's own LoadSettings whenever every row is Don'tChange (the sum of
// the nine rows, IL_10e1-IL_112d) and the port had it armed; the
// scroll ladder tested the offset captured BEFORE the notch
// (IL_1253-IL_1319), so the port left third person one notch early;
// the bounds initialise to 2 m (IL_29c6-IL_29e1), not 0, which is what
// lets the minimum-distance floor bite on an axis no cast has measured;
// the mirrored offset arm carries NO riding term on Y (IL_032f-IL_035b);
// the shoulder block is skipped whole while the X offset is zero
// (IL_148f); a manual switch resets no clock (IL_14ac-IL_14c2); the
// revert probe starts at the camera TARGET's height and depth
// (IL_14f9-IL_152b); LateUpdate's table is three independent blocks
// and a fan-out, not one situation (`autoToggleRows`); OnNewGame and
// OnLoad apply a TRANSITION row when the table is armed and only
// otherwise take StartInThirdPerson (IL_0930-IL_0ad0); the dungeon's
// doors fire the transition rows too (IL_06bf, IL_06e1); a floating
// origin shift re-seeds the smoothing (IL_1cb7); and ToggleOffset
// drives the billboard, the torch, the spell hands and the horse
// (IL_22b4-IL_239f), which the port's toggle had left to edge detection.
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
//
// THREE DEPARTURES STAND, each Mac's or recorded in the Ledger: the
// wheel is the only way in and out (`Camera.TogglePerspective`'s key,
// IL_1230-IL_124d, is inert); `CameraScrolling.ScrollableZOffset` ships
// off and the port ships it on; `SwitchShoulder` is B, not Tab. And
// two things the port cannot hold: the attack-from-body ray
// (`MeleeDamage`, IL_2844) and the missile re-home (IL_137f-IL_1477) -
// the port's swing and its missiles already start at the player's
// head, which this camera never moves, so there is nothing to
// re-origin and `Don'tOffsetAttacks` has nothing to stop.

import { MOD_SETTINGS, modSettingsGeneration } from '../systems/modSettings.js';
import { AUTO_TOGGLE_ROWS, AUTO_TOGGLE, autoToggleRows } from './eotbBillboard.js';   // [IL] LateUpdate's table

/** `eyeRadius` is a field initialiser in the mod's own .ctor, not a
 *  setting - the clearance the camera keeps off a wall. */
export const EYE_RADIUS = 0.25;
/** [IL] `boundsX`, `boundsY`, `boundsZ` initialise to 2.0 (IL_29c6-IL_29e1).
 *  An axis whose offset is zero is never cast (CheckBounds skips it),
 *  so its bound stays at this - which is what lets the minimum
 *  distance floor bite with no wall measured. The port had 0. */
export const BOUNDS_INITIAL = 2.0;

/** Update's far clamp: the Z offset never passes -10 however long the
 *  wheel is turned (`if (z < -10) offsetScroll = 10 + (posOffset.z +
 *  offsetScroll)`, which solves to exactly z = -10). */
export const MAX_Z = -10;

/** The three `CameraOverride*` sections, in the order `posOffset`
 *  tests them - boat, then mount, then weapon, then the base. The
 *  ORDER is load-bearing: a mounted player with a weapon readied takes
 *  the MOUNT offsets, because the mount arm returns first. */
export const OVERRIDE_ORDER = Object.freeze(['Boat', 'Mount', 'Weapon']);

/** [IL] The two lines `LateUpdate` pops when ToggleInput arms or
 *  disarms the table (IL_1823, IL_183c), behind `Debug.ShowMessages`. */
export const AUTO_TOGGLE_MESSAGES = Object.freeze({ armed: 'Auto-toggle POV enabled!', disarmed: 'Auto-toggle POV disabled!' });

const setting = (name) => MOD_SETTINGS['eye-of-the-beholder'].keys[name];

/** [IL] LoadSettings' tail (IL_1156-IL_1195): ToggleOffset(offset) re-runs
 *  only when one of these four sections `HasChanged`. */
const TOGGLE_SECTIONS = Object.freeze(['Camera', 'Graphics', 'Animation', 'Compatibility']);
/** AUDIT 68 S15-eotb-settings-snapshot: the mod's values, section by
 *  section, so a load can answer `ModSettingsChange.HasChanged` - a new
 *  rig re-reading the same store is not a change, a pane edit is. */
function sectionValues(get) {
  const out = {};
  for (const key of Object.keys(MOD_SETTINGS['eye-of-the-beholder'].keys)) {
    (out[key.split('.')[0]] ??= []).push(get?.('eye-of-the-beholder', key) ?? null);
  }
  for (const section of Object.keys(out)) out[section] = JSON.stringify(out[section]);
  return out;
}

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
  const auto = Object.freeze(Object.fromEntries([...AUTO_TOGGLE_ROWS, 'OnTransitionInterior', 'OnTransitionExterior']
    .map((row) => [row, g(`AutoTogglePerspective.${row}`) ?? AUTO_TOGGLE.DontChange])));
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
    // KB1: the two keys the mod binds beside the wheel are the registry's ShoulderSwitch and AutoPerspective
    // actions (systems/inputActions.js MOD_ACTIONS), read by the rig - not settings of the camera's
    auto,
    /** [IL] `autoPOVSwitch` is DERIVED (IL_10e1-IL_112d): the nine rows
     *  summed, armed when any is not Don'tChange. The bundle ships every
     *  row at 0, so the table ships DISARMED - the port had armed it. */
    autoPOVSwitch: Object.values(auto).reduce((a, b) => a + (b | 0), 0) > 0,
    // [IL] the Graphics and Compatibility fields the camera itself holds
    billboard: g('Graphics.Enable') !== false,              // ToggleBillboard's argument
    firstPersonBillboard: g('Graphics.FirstPersonBillboard') ?? 0,
    hideWeapon: g('Compatibility.Don\'tHideWeapon') === true,
    hideHorse: g('Compatibility.Don\'tHideHorse') === true,
    offsetAttacks: g('Compatibility.Don\'tOffsetAttacks') === true,
    debugMessages: g('Debug.ShowMessages') !== false,
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
  // AUDIT-EOTB F5: `forward x right`, NOT `right x forward`. The other
  // way round gives up = [0,-1,0] at rest, so FrontalPlaneOffset's Y -
  // shipped at 0.5, described by the mod as "Moves the camera position
  // on the X and Y axes" - pushed the camera DOWN instead of up.
  const up = [
    forward[1] * right[2] - forward[2] * right[1],
    forward[2] * right[0] - forward[0] * right[2],
    forward[0] * right[1] - forward[1] * right[0],
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
  let boundsX = BOUNDS_INITIAL, boundsY = BOUNDS_INITIAL, boundsZ = BOUNDS_INITIAL;
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
  let lastState = {};
  /** [IL] LateUpdate's `loc0`: an arming forces the fan-out this frame (IL_1814) */
  let forcedApply = false;
  // [IL] the five `is*Previous` fields LateUpdate keeps (IL_1c4f-IL_1c6e)
  let prev = null;
  let autoPOVSwitch = cfg.autoPOVSwitch;
  /** [IL] `Start` has run: the mod's component lives on the player
   *  object across every door DFU opens, so Unity runs it ONCE per boot
   *  and OnNewGame / OnLoad / the transitions take every later door.
   *  The port builds a weapon rig per host, and each build asked for
   *  Start again - so entering a building or a dungeon re-forced
   *  `StartInThirdPerson` over whatever the player had scrolled to. */
  let started = false;
  /** the `PlayerBillboard` this camera drives through ToggleOffset -
   *  `{ toggle(active, fp), torchDefault() }` */
  let billboard = null;
  /** DaggerfallUI.PopupMessage, as the rig hands it in */
  let popup = null;
  /** `spellCasting.enabled`, the FPS spell hands - false in third person */
  let spellHandsEnabled = true;
  /** AUDIT 68 S15-eotb-settings-snapshot: the last LoadSettings - its
   *  reader, the store's generation then, and what each section read. */
  let loaded = null;

  /**
   * `posOffset`, the mod's own property. Four arms in the order the IL
   * tests them, each mirrored on X when `mirror` is set, each with the
   * scroll subtracted from Z. Only the BASE arm scales by the riding
   * offset - the override arms do not - and the MIRRORED base arm
   * scales Z alone (IL_032f-IL_035b): the Y riding term is the
   * unmirrored arm's only (IL_040d-IL_0446). The mod's own asymmetry,
   * kept.
   */
  function posOffset(state) {
    const m = mirror ? -1 : 1;
    const o = cfg.overrides;
    if (o.Boat.enabled && state.sailing) return [m * o.Boat.x, o.Boat.y, o.Boat.z - offsetScroll];
    if (o.Mount.enabled && state.riding) return [m * o.Mount.x, o.Mount.y, o.Mount.z - offsetScroll];
    if (o.Weapon.enabled && state.weaponReady) return [m * o.Weapon.x, o.Weapon.y, o.Weapon.z - offsetScroll];
    const r = state.riding ? cfg.riding : 0;      // get_offsetRidingMod
    if (mirror) return [-cfg.x, cfg.y, cfg.z + cfg.z * r - offsetScroll];
    return [cfg.x, cfg.y + cfg.y * r, cfg.z + cfg.z * r - offsetScroll];
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
    const { right, up, forward } = eyeBasis(yaw, pitch);
    const axis = (i, base) => {
      const off = posOffset(state);   // re-read per axis, as the IL does - the auto-switch below may have flipped X
      if (off[i] === 0) return null;
      const dir = off[i] < 0 ? [-base[0], -base[1], -base[2]] : base;
      const len = Math.abs(off[i] * 2) + EYE_RADIUS;
      const hit = raycast ? raycast(origin, dir, len) : null;
      return hit != null && hit < len ? hit - EYE_RADIUS * 2 : len;
    };
    const bx = axis(0, right);
    if (bx !== null) boundsX = bx;
    // THE AUTO-SWITCH rides inside CheckBounds, between the X cast and
    // the Y cast, and it flips `mirror` in place. Reordering these is
    // a behaviour change, not a tidy-up.
    if (bx !== null && cfg.mirrorAuto
        && Math.abs(boundsX) < Math.abs(posOffset(state)[0]) / 2 + EYE_RADIUS) {
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
   * [IL] `ToggleOffset(bool)` (IL_22b4-IL_239f), whole. Entering third
   * person zeroes the scroll, starts the smoothing FROM THE EYE'S
   * CURRENT POSITION (the swing, not a cut), shows the billboard and
   * hides the spell hands. Leaving it puts the torch and the eye back,
   * makes the billboard the first-person one when
   * `FirstPersonBillboard` is on and hides it otherwise, and shows the
   * hands. Both ways the horse follows unless Don'tHideHorse (read by
   * the body's `hides`), `offset` is written LAST, and the
   * OnToggleOffset event fires.
   */
  const listeners = new Set();
  function toggleOffset(on) {
    on = !!on;
    if (on) {
      offsetScroll = 0;
      posCurrent = [...lastEye];
      billboard?.toggle(cfg.billboard, false);
      spellHandsEnabled = false;
    } else {
      billboard?.torchDefault?.();
      if (cfg.firstPersonBillboard > 0) billboard?.toggle(cfg.billboard, true);
      else billboard?.toggle(false, false);
      spellHandsEnabled = true;
    }
    offset = on;
    for (const fn of listeners) fn(offset);
    return offset;
  }

  /**
   * [IL] Update's shoulder block (IL_1484-IL_160c), skipped WHOLE while
   * the X offset is zero: the auto-switch's revert re-probes the side
   * the camera would go BACK to from the camera TARGET's height and
   * depth with the lateral component re-centred on the body
   * (IL_14f9-IL_152b) - "is the original shoulder clear now", asked at
   * the camera's own level.
   */
  function revertMirror(headLocal, feet, state, yaw, raycast) {
    if (posOffset(state)[0] === 0) return;
    if (mirror === mirrorOriginal || cfg.mirrorTime <= 0) return;
    if (mirrorTimer <= cfg.mirrorTime) { mirrorTimer += lastDt; return; }
    const local = bodyVector([posTarget[0] - feet[0], posTarget[1] - feet[1], posTarget[2] - feet[2]], -yaw);
    local[0] = headLocal[0];
    const origin = add(feet, bodyVector(local, yaw));
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

  /** [IL] `LoadSettings` (IL_0ae2-IL_119a): the fields, `autoPOVSwitch`
   *  derived when its section changed (IL_10e1-IL_112d), and - when the
   *  Camera, Graphics, Animation or Compatibility section changed - the
   *  billboard re-read and `ToggleOffset(offset)` re-run so it, the torch
   *  and the hands take the new values. AUDIT 68
   *  S15-eotb-settings-snapshot: DFU hands it what changed; the port
   *  compares sections, so a new rig re-reading the same store neither
   *  resets the zoom nor re-arms the table, and `tick` re-runs it when
   *  the store moves, so a pane edit is live. */
  function loadSettings(get) {
    const was = loaded?.sections;
    const sections = sectionValues(get);
    const changed = (section) => !was || was[section] !== sections[section];
    loaded = { get, generation: modSettingsGeneration(), sections };
    cfg = readCameraSettings(get);
    if (changed('AutoTogglePerspective')) autoPOVSwitch = cfg.autoPOVSwitch;
    if (TOGGLE_SECTIONS.some(changed)) {
      billboard?.reload?.();
      toggleOffset(offset);
    }
    return cfg;
  }

  /** One row of the table, applied: 1 takes first person, 2 third, 0
   *  leaves the view where it is. */
  function applyRow(row) {
    if (row === AUTO_TOGGLE.FirstPerson && offset) toggleOffset(false);
    else if (row === AUTO_TOGGLE.ThirdPerson && !offset) toggleOffset(true);
    return offset;
  }

  /** [IL] OnNewGame / OnLoad (IL_0930-IL_09f8, IL_0a08-IL_0ad0): with the
   *  table armed, the transition row for where the player stands -
   *  and NOTHING else, even when the row is Don'tChange; disarmed,
   *  StartInThirdPerson through ToggleOffset. */
  function onGameStart(inside) {
    if (autoPOVSwitch) {
      applyRow(cfg.auto[inside ? 'OnTransitionInterior' : 'OnTransitionExterior']);
      return offset;
    }
    return toggleOffset(cfg.startInThird);
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
    spellHandsEnabled: () => spellHandsEnabled,

    /** The billboard this camera drives (eotbBody registers at attach). */
    setBillboard(b) { billboard = b ?? null; },
    /** DaggerfallUI.PopupMessage's seam. */
    setPopup(fn) { popup = typeof fn === 'function' ? fn : null; },
    /** The mod's OnToggleOffset event - MessageReceiver's subscribers. */
    onToggleOffset(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    loadSettings,

    /** [IL] `Start` (IL_0668-IL_067b): `offset = offsetDefault;
     *  ToggleOffset(offset)`. The port's camera is one instance across
     *  host boots where the mod's is a fresh component, so the fields
     *  the .ctor would initialise are put back here too. */
    start() {
      if (started) return offset;   // Unity's Start runs once; a second rig is not a second boot
      started = true;
      mirror = false; mirrorOriginal = mirror; mirrorTimer = 0; offsetScroll = 0;
      boundsX = BOUNDS_INITIAL; boundsY = BOUNDS_INITIAL; boundsZ = BOUNDS_INITIAL;
      prev = null;
      return toggleOffset(cfg.startInThird);
    },
    /** [IL] `OnNewGame` - `inside` is PlayerEnterExit.IsPlayerInside. */
    onNewGame(inside = false) { return onGameStart(inside); },
    /** [IL] `OnLoad`. */
    onLoad(inside = false) { return onGameStart(inside); },
    /** [IL] `OnPositionUpdate` (IL_1cb7-IL_1ccd): the floating origin
     *  moved the eye; the smoothing re-seeds from where it is now. */
    onPositionUpdate(delta) {
      posCurrent = [posCurrent[0] + delta[0], posCurrent[1] + delta[1], posCurrent[2] + delta[2]];
      posTarget = [posTarget[0] + delta[0], posTarget[1] + delta[1], posTarget[2] + delta[2]];
      lastEye = [lastEye[0] + delta[0], lastEye[1] + delta[1], lastEye[2] + delta[2]];
    },

    /** [IL] The two transition rows (IL_1cdc-IL_1d95), registered on the
     *  building's doors AND the dungeon's (IL_06a2-IL_06e1): `kind` is
     *  'Interior' or 'Exterior'. Nothing moves while the table is
     *  disarmed. */
    transition(kind) {
      const row = cfg.auto[`OnTransition${kind}`];
      if (row === undefined || !autoPOVSwitch) return offset;
      return applyRow(row);
    },
    /** [IL] ToggleInput (IL_17ea-IL_1841): arm or disarm the table, say
     *  so, and an arming forces the fan-out this frame. */
    toggleAuto() {
      autoPOVSwitch = !autoPOVSwitch;
      if (autoPOVSwitch) forcedApply = true;
      if (cfg.debugMessages) popup?.(autoPOVSwitch ? AUTO_TOGGLE_MESSAGES.armed : AUTO_TOGGLE_MESSAGES.disarmed);
      return autoPOVSwitch;
    },
    autoArmed: () => autoPOVSwitch,
    started: () => started,
    previous: () => (prev ? { ...prev } : null),

    toggleOffset,

    /** [IL] `SwitchShoulder` (IL_14ac-IL_14c2): mirrors X and re-bases
     *  what the auto-switch reverts TO, and nothing else - no clock is
     *  touched. Inside the block the X offset gates (IL_148f). */
    switchShoulder() {
      if (posOffset(lastState)[0] === 0) return mirror;
      mirror = !mirror;
      mirrorOriginal = mirror;
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
     * Update's ladder (IL_1252-IL_1322), flushed once a frame. This is
     * the whole of Mac's ask, and it is the MOD'S OWN arm rather than
     * an invention: the bundle ships `CameraScrolling` with
     * `scrollableOffsetTogglePOV` in the assembly, and its shape is
     * Morrowind's shape -
     *
     *   FIRST person + scroll out       -> third, at the base distance
     *   THIRD person + scroll           -> nearer / further by the increment
     *   THIRD person + past the near end-> first
     *   THIRD person + past MAX_Z       -> pinned, the wheel does nothing
     *
     * THE TWO END TESTS READ THE OFFSET CAPTURED BEFORE THE NOTCH
     * (`loc0`, IL_1253-IL_125d; tested at IL_12ef and IL_1317) - only
     * the clamp's correction re-reads it (IL_12fe). So the camera
     * leaves third person the notch AFTER it crosses the near end, and
     * pins the notch after it crosses -10. The port had tested the
     * fresh value and moved a notch early.
     *
     * LateUpdate's auto-toggle (IL_1847-IL_1c6e) rides the same frame.
     */
    tick(state = {}) {
      if (loaded && loaded.generation !== modSettingsGeneration()) loadSettings(loaded.get);   // AUDIT 68 S15-eotb-settings-snapshot: a pane edit, live
      lastState = state;
      const clicks = pending;
      pending = 0;
      // [IL] LateUpdate's table: three "just changed" blocks and one
      // fan-out, each row through ToggleOffset's pair; the five
      // previous flags stored after, armed or not
      const now = {
        transformed: !!state.transformed, riding: !!state.riding, spellcasting: !!state.spellcasting,
        sheathed: state.sheathed ?? !state.weaponReady, ranged: !!state.usingBow,
      };
      if (autoPOVSwitch) {
        for (const row of autoToggleRows(now, prev, { forced: forcedApply })) applyRow(cfg.auto[row]);
      }
      forcedApply = false;
      prev = now;
      if (!cfg.scrollable) return offset;
      const z = posOffset(state)[2];              // Update's `loc0`
      const nearEnd = -cfg.minZ;                 // Update's `loc1`: NEGATED
      if (!offset) {
        if (clicks < 0) { toggleOffset(true); offsetScroll = 0; }
        return offset;
      }
      // ONE increment a frame, SIGN ONLY. The mod reads `GetAxis` once
      // per Update and branches `> 0` / `< 0`; it never scales by the
      // reading's magnitude, so three notches inside one frame move the
      // camera exactly as far as one does.
      if (clicks > 0) offsetScroll -= cfg.increment;
      else if (clicks < 0) offsetScroll += cfg.increment;
      if (z < MAX_Z) offsetScroll = -MAX_Z + (posOffset(state)[2] + offsetScroll);
      else if (z > nearEnd) toggleOffset(false);
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
      revertMirror(headLocal, feet, state, yaw, raycast);
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
      // EOTB-WALL (2026-09-17, Mac: "3rd person clips through walls and ceilings allowing you to see outside wall
      // bounds. Morrowind 3rd person doesnt have this issue"): THE PORT'S OWN LINE-OF-SIGHT CAST, after the mod's.
      // CheckBounds stands as the IL has it - one cast per AXIS of the eye's basis, from the head - and that is
      // exactly how the eye ends up inside a wall: the three axis casts never measure the DIAGONAL the camera
      // actually stands on (a wall at the back-right corner is missed by the "right" cast and by the "back" cast
      // alike, a ceiling at the back-up diagonal by the "up" and the "back"), and posCurrent LAGS the pulled-in
      // target by MoveTowards, so a turn against a wall leaves the eye in the wall for as many frames as the
      // smoothing takes. The Morrowind camera (mwCamera.js, camera.cpp:200-206) casts ONE ray from the focal along
      // the eye's own direction and pulls in, which is why it never clips. That cast is added here, on the SMOOTHED
      // position, with the mod's own clearance (2 * eyeRadius, what CheckBounds keeps off an axis hit) so a wall
      // straight behind answers exactly as the mod's own cast does; the target is untouched, so the smoothing
      // walks the camera back out when the wall is gone. A departure from the assembly, recorded in the Ledger.
      if (raycast) {
        const d = [posCurrent[0] - origin[0], posCurrent[1] - origin[1], posCurrent[2] - origin[2]];
        const len = Math.hypot(d[0], d[1], d[2]);
        if (len > 1e-6) {
          const dir = [d[0] / len, d[1] / len, d[2] / len];
          const hit = raycast(origin, dir, len + EYE_RADIUS * 2);
          if (hit != null && hit < len + EYE_RADIUS * 2) {
            const keep = Math.max(0, hit - EYE_RADIUS * 2);
            posCurrent = [origin[0] + dir[0] * keep, origin[1] + dir[1] * keep, origin[2] + dir[2] * keep];
          }
        }
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
