// MW-D25: THE VIEW SYNC - the one seam between the camera machine and
// the player's rigs, so the four hosts wire three calls instead of
// re-deriving the lockstep four times (MW-D15's lesson: the camera dep
// drifted per host until it had one home).
//
// EOTB4 (2026-09-15): THIS SEAM NOW SERVES TWO BODIES. Mac, on why the
// port carries a second third-person system: "This is moreso for those
// who opt out of using morrowind." So the wheel is ONE LADDER and the
// question it asks is "which body can answer" -
//
//     the Morrowind rig, when fpArm has built one;
//     Eye Of The Beholder's sprite, when it has not.
//
// and when neither can, the wheel does nothing, exactly as it has
// always done. There is no setting to choose between them, because
// there is nothing to choose: a player with Morrowind data has the
// Morrowind body, and a player without it never had a third person at
// all until now.
//
// THE FILE IS STILL CALLED mwView, AND THAT IS A DEBT, not an
// oversight. The name is written into four hosts and ten test files;
// renaming it buys no behaviour and risks a great deal, so it is
// recorded here and on the mod's bible page as a housekeeping item
// rather than left to be discovered as a quiet lie.
//
// The reference couples these through Camera::processViewChange
// (camera.cpp:346-369): the mode decides which rig the NpcAnimation
// wears, and a mode the rig cannot serve does not exist. Here the
// coupling runs the same direction - the camera machine is asked to
// move only where the rig can follow - plus one port-honest guard: a
// player with NO Morrowind data (or a refused body) has no third
// person at all, and the wheel then does nothing rather than pulling
// the eye out of an invisible head.

import { mwCamera, MW_UNITS_PER_METER, FOCAL_HEIGHT, PITCH_LIMIT } from './mwCamera.js';
import { fpArm } from '../combat/fpArm.js';
import { eotbCamera } from './eyeOfTheBeholder/eotbCamera.js';
import { eotbBody } from './eyeOfTheBeholder/eotbBody.js';
import { eotbWagon } from './eyeOfTheBeholder/eotbWagon.js';
import { modSetting } from '../systems/modSettings.js';
import { horseRigFor, HORSE_SEAT } from '../world/horseRig.js';   // COATS3D: the 3D horse under the Morrowind body
import { gaitShare } from '../world/horseModel.js';
import { SEAT_PELVIS_HEIGHT } from './seatPose.js';
import { RIDE_EYE_HEIGHT } from './motor.js';   // AUDIT COATS3D A8: the saddle's eye, the horse's ground under it

/**
 * EOTB4: is Eye Of The Beholder the lane this frame?
 *
 * Three things have to hold, and the THIRD is the one that matters
 * today: the mod is enabled, the Morrowind rig cannot serve, and the
 * mod's own body can actually be DRAWN. Until the drawing lands
 * (EOTB5) `eotbBodyReady` answers false, so this lane is wired, pinned
 * and inert - a player sees exactly what they see now rather than a
 * camera swinging out behind an invisible body, which is the failure
 * mwView's own head has always refused for the Morrowind rig.
 *
 * It is a predicate rather than a comment so that turning the lane on
 * is one line, and so that "the lane is off" is a thing the pins can
 * state and the next slice can flip.
 */
let eotbBodyReady = () => false;
/**
 * AUDIT-EOTB F4: the player state the CAMERA needs and the host does
 * not own. `weaponReady` is the weapon rig's to answer (it holds the
 * machine); `sailing` is the camera's own field since CSA-J, raised by
 * Come Sail Away's OnUpdateSailing (eotbCamera.setComeSailAway).
 * Registered once by `combat/weapon/weaponRig.js`, so no host re-derives it -
 * MW-D25's law, the reason this seam exists at all.
 */
let eotbPlayerState = () => ({});
export function setEotbPlayerState(fn) { eotbPlayerState = typeof fn === 'function' ? fn : () => ({}); }
/** EOTB5's door: the host tells the seam its body can draw. */
export function setEotbBodyReady(fn) { eotbBodyReady = typeof fn === 'function' ? fn : () => false; }
/**
 * DISC10 (kurkku on Discord, 2026-09-23: "two wagons appear whenever you hitch it up, visual only"). TWO MODS,
 * ONE CART. EOTB's ShowCart stands its cart (41239) for the Cart transport, and Horse Cart and Cargo trails its
 * wagon (41214) for the same transport - both ship on, neither mod's code knows the other, and a rider without the
 * Morrowind body got both: two carts behind the horse, the looser one ahead of it after a turn, its box naming
 * "Wagon" over an empty road. HCC's wagon is the one with a team, a store and a place in the world, so while its
 * trailing wagon is shown EOTB's cart gives way - the host says when (world.js, exterior.js).
 */
let eotbCartYields = () => false;
/**
 * BEAST-SELF (2026-09-26): the Morrowind arm and body STAND ASIDE while the player is a transformed lycanthrope
 * with no Morrowind beast standing (combat/fpArm.js setStandIn: a wereboar, or - SHADOW-FANG, at the merge -
 * Bloodmoon's wolf refused or still building; a standing wolf keeps this lane), so this lane's other side, Eye Of
 * The Beholder's, takes the body as it does for a player with no Morrowind data. At that edge the view carries over
 * rather than jumping: the sprite camera takes the person the Morrowind camera stood in, and pulls out from the head,
 * not from wherever it last stood (its eye had not been asked in the Morrowind stretch); and back, the Morrowind
 * camera takes the sprite camera's person - when the sprite lane was the one showing the beast (with it off, the
 * refused third person has already fallen back to the first).
 */
let _standInWas = false;
let _beastInSprite = false;
function standInEdge({ fpEye, feet, yaw, pitch }) {
  const now = !!fpArm.standingIn?.();
  if (now) _beastInSprite = _beastInSprite || eotbLane();
  if (now === _standInWas) return;
  _standInWas = now;
  if (now) {
    _beastInSprite = eotbLane();
    if (!_beastInSprite) return;
    const third = mwCamera.thirdPerson();
    eotbCamera.toggleOffset(false);
    eotbCamera.eye({ fpEye, feet, yaw, pitch });   // the head the view leaves from
    if (third) eotbCamera.toggleOffset(true);
    return;
  }
  if (_beastInSprite && !mounted) mwCamera.restore({ firstPerson: !eotbCamera.thirdPerson(), baseDistance: mwCamera.baseDistance() });
  _beastInSprite = false;
}
export function setEotbCartYields(fn) { eotbCartYields = typeof fn === 'function' ? fn : () => false; }

/**
 * EG-ZH (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 11.8, "The camera in
 * rock"): IN THE SPIRE BOTH CAMERAS PULL IN AT ONCE AGAINST A WALL AND EASE BACK OUT OVER 0.25 s, never snapping. Each
 * lane's own casts still decide how far the camera may stand (the Morrowind camera's sphere casts, camera.cpp:186/:200;
 * Eye Of The Beholder's axis casts and its line of sight) - over the fragments' collider proxy, the drawn rock's inner
 * envelope (world/eliteGates/egHall.js egCircleColliderTris), so the camera never stands inside visible rock - and the Spire only
 * keeps it from springing back out the frame a wall leaves the cast: out from the focal at most its whole free distance
 * every SPIRE_CAMERA_EASE_S, never past where the cast allows. The breach client says when (scenes/eliteGates/egClient.js -
 * `setSpireCamera`); everywhere else both lanes are their own, as they were. A departure from camera.cpp and from the
 * mod, Ledger A (ELITE-GATES).
 */
export const SPIRE_CAMERA_EASE_S = 0.25;
/** The Eye Of The Beholder camera's free distance (section 11.8: it "rides 0.5 m over the eye and 2 m behind it") - the
 *  pace its ease walks back out at. */
export const SPIRE_EOTB_FULL_M = Math.hypot(0.5, 2);
let _spireCamera = () => false;
/** The breach client's word: true while the Spire holds the camera (its halls), false everywhere else. */
export function setSpireCamera(fn) { _spireCamera = typeof fn === 'function' ? fn : () => false; }
/**
 * THE EASE (pure): the distance the camera stands at this frame - `want` the lane's own (its casts' answer, at most its free
 * distance `full`), `prev` last frame's (null: none - a cut), `dt` the frame (s). In at once; out at most `full` every
 * SPIRE_CAMERA_EASE_S, never past `want`.
 */
export function spireCameraEase(prev, want, full, dt) {
  if (!(prev != null && Number.isFinite(prev)) || !(want > prev)) return want;
  const step = (Math.max(full, want) * Math.max(0, Number(dt) || 0)) / SPIRE_CAMERA_EASE_S;
  return Math.min(want, prev + step);
}
let _spireCamDist = null;
/** The Spire's ease laid on a lane's answered eye (`out` - `{ eye, focal, distance, thirdPerson }`), `full` its free
 *  distance; a first-person eye (no focal) is a cut. In place; answers `out`. */
export function spireCameraFrame(out, full, dt) {
  let on = false;
  try { on = !!_spireCamera(); } catch { on = false; }
  if (!on || !out?.thirdPerson || !out.focal || !(out.distance > 1e-6)) { _spireCamDist = null; return out; }
  const d = spireCameraEase(_spireCamDist, out.distance, full, dt);
  _spireCamDist = d;
  if (d < out.distance) {
    const f = out.focal, k = d / out.distance;
    out.eye = [f[0] + (out.eye[0] - f[0]) * k, f[1] + (out.eye[1] - f[1]) * k, f[2] + (out.eye[2] - f[2]) * k];
    out.distance = d;
  }
  return out;
}
/**
 * EG-ZN (2026-10-12, Mac: "I said I want everything"; Elite-Gates.md section 11.8, "The camera in rock"): ON A SHAFT'S LEDGE
 * FACING A DROP, THE PITCH BIASES 20 DEGREES DOWN AND THE CAMERA RISES TO LOOK OVER THE EDGE, so the landing is seen, not
 * the back. The breach client says where my feet stand (`setSpireShaft` - scenes/eliteGates/egClient.js: the shaft's way down while I
 * stand on its rim or a flight above its Drop's landing, world/eliteGates/egHall.js egShaftLedgeAt, and whether the screen stands
 * still); this seam judges the facing on the frame's yaw, and both lanes lay the bias on their own eye: the camera's pitch
 * SPIRE_SHAFT_PITCH under the look's, its pivot SPIRE_SHAFT_RISE_M over its own (the casts start there), both eased over
 * SPIRE_SHAFT_EASE_S as the facing comes and goes - under reduced motion none (AUDIT EG III: section 11.8's camera never
 * snaps, and a still screen is never turned for the player). The look the
 * player aims with is never moved: the frame's eye answers the camera's own forward (`look`) for the host's view alone. In
 * third person only, and nowhere but the Spire. A departure from camera.cpp and from the mod, Ledger A (ELITE-GATES).
 */
export const SPIRE_SHAFT_PITCH = (20 * Math.PI) / 180;
/** How far the camera's pivot rises over its own at the whole bias (m) - the camera with it, over the ledge's edge. */
export const SPIRE_SHAFT_RISE_M = 1.0;
/** How long the bias takes to come in whole, and to go (s). */
export const SPIRE_SHAFT_EASE_S = 0.5;
/** Facing the drop: the look's bearing within 60 degrees of the way down to turn it on, past 75 to turn it off (the
 *  cosines) - a turn at the edge does not flicker it. */
export const SPIRE_SHAFT_FACE_IN = Math.cos((60 * Math.PI) / 180);
export const SPIRE_SHAFT_FACE_OUT = Math.cos((75 * Math.PI) / 180);
let _spireShaft = () => null;
/** The breach client's word: `{ way, still }` while I stand alive in the Spire (`way` the unit [x, z] a shaft's ledge I stand
 *  on faces down, or null; `still` reduced motion), null everywhere else. */
export function setSpireShaft(fn) { _spireShaft = typeof fn === 'function' ? fn : () => null; }
/** Whether a look at `yaw` faces the way `way` ([x, z], unit) - within SPIRE_SHAFT_FACE_IN, or SPIRE_SHAFT_FACE_OUT while it
 *  already did (`was`). Pure. */
export function spireShaftFacing(way, yaw, was) {
  const c = Math.sin(yaw) * way[0] + Math.cos(yaw) * way[1];
  return c >= (was ? SPIRE_SHAFT_FACE_OUT : SPIRE_SHAFT_FACE_IN);
}
/** THE EASE (pure): the bias this frame - `prev` last frame's, `want` SPIRE_SHAFT_PITCH or nought, `dt` the frame (s) - the
 *  whole bias every SPIRE_SHAFT_EASE_S, never past `want`; `still` (reduced motion) none at all (AUDIT EG III - never a snap). */
export function spireShaftEase(prev, want, dt, still) {
  if (still) return 0;
  const step = (SPIRE_SHAFT_PITCH * Math.max(0, Number(dt) || 0)) / SPIRE_SHAFT_EASE_S;
  return prev < want ? Math.min(want, prev + step) : Math.max(want, prev - step);
}
let _shaftBias = 0, _shaftFacing = false;
/** The frame's camera pitch over a shaft's ledge: the look's `pitch` less the eased bias (at most the camera's own limit),
 *  the bias stepped first. Out of the Spire, or in first person (`third` false), none at once. */
export function spireShaftPitch(pitch, yaw, dt, third) {
  let word = null;
  try { word = _spireShaft(); } catch { word = null; }
  if (!word || !third) { _shaftBias = 0; _shaftFacing = false; return pitch; }
  _shaftFacing = !!word.way && spireShaftFacing(word.way, yaw, _shaftFacing);
  _shaftBias = spireShaftEase(_shaftBias, _shaftFacing ? SPIRE_SHAFT_PITCH : 0, dt, !!word.still);
  return _shaftBias > 0 ? Math.max(-PITCH_LIMIT, pitch - _shaftBias) : pitch;
}
/** The frame's pivot floor over a shaft's ledge: the lane's own pivot (`pivotY`, a world height) risen by the bias's share
 *  of SPIRE_SHAFT_RISE_M - never under the host's own floor (`floor`). */
export function spireShaftPivot(floor, pivotY) {
  if (!(_shaftBias > 0)) return floor;
  return Math.max(floor ?? -Infinity, pivotY + (SPIRE_SHAFT_RISE_M * _shaftBias) / SPIRE_SHAFT_PITCH);
}
/** The camera's own forward on a third-person eye while the bias is laid (`out.look` - the host's view looks along it; the
 *  aim keeps the player's). In place; answers `out`. */
export function spireShaftLook(out, yaw, pitch) {
  if (_shaftBias > 0 && out?.thirdPerson && out.focal) { const cp = Math.cos(pitch); out.look = [Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp]; }
  return out;
}
/** The bias laid now (radians; tests). */
export const spireShaftBias = () => _shaftBias;
/**
 * CSA-J: TWO MODS, ONE BOAT. Eye of the Beholder's ModCompatibilityChecking looks for Come Sail Away by its GUID and
 * hands its OnUpdateSailing to the mod's receiver; the camera then targets the boat and the sprite faces its heading.
 * The world host builds the boat's runtime each boot and hands it here (null: the mod is off) with Unity's
 * Collider.bounds over the boat's nodes; EOTB's Debug.Log is heard while that mod is on.
 */
export function setEotbComeSailAway(mod) {
  eotbCamera.setComeSailAway(mod);
  eotbCamera.setLog((text) => { if (modSetting('eye-of-the-beholder', 'Enabled')) console.log(text); });
}
export function eotbLane() {
  if (fpArm.canThirdPerson()) return false;          // the Morrowind body wins where it exists
  try {
    if (!modSetting('eye-of-the-beholder', 'Enabled')) return false;
  } catch { return false; }                          // not vendored: no lane
  return !!eotbBodyReady();
}

// MW-D30: the reference accumulates the frame's zoom presses and calls
// zoom() ONCE per frame with their sum (actionbindings.lua:98-115 -
// `zoomInOut` collects every ZoomIn/ZoomOut, Zoom3rdPerson reads
// `zoomInOut * 10` once, then zeroes it). The port had applied each DOM
// wheel event separately against a stale pull-in distance, so a burst
// of N notches subtracted the obstacle debt N times. The pending count
// flushes in mwViewFrame, where the frame's camera state is fresh.
let pendingClicks = 0;

/**
 * Per-frame, before the host composes its view matrix. Resolves any
 * queued view change (camera.cpp:135), keeps the rig on the camera's
 * mode (setViewMode + force refresh, npcanimation.cpp:295-317 /
 * character.cpp:2798), and answers the frame's eye (camera.cpp:160-209).
 *
 * BENCH-CAM (2026-10-10): `pivotFloor` - a world height the third-person camera's pivot (the sprite camera's head
 * origin, the Morrowind camera's focal) stands at least at: the host's word while I drive from a wagon's bench
 * (scenes/horseCartPool.js cameraFloor - over the wagon's roof), null everywhere else. First person never reads it.
 *
 * EG-ZN: `look` - the camera's own forward, where the Spire biases its pitch over a shaft's ledge (absent everywhere else:
 * the camera looks where the player does).
 *
 * @returns {{eye:number[], thirdPerson:boolean, distance:number, look?:number[]}}
 */
export function mwViewFrame({ fpEye, feet, yaw, pitch, heightScale = null, raycast = null, spherecast = null, eyeOverride = null, seaReach = 0, pivotFloor = null, ...state }) {
  standInEdge({ fpEye, feet, yaw, pitch });   // BEAST-SELF: the view carried across the arm's stand-aside
  benchSeated = !!state.seated;   // WAGONS3: the host's word that the player drives from a wagon's bench, either lane
  // FLAGGED: Eye Of The Beholder has no sitting art - on that lane the driver's sprite stands on the bench's footboard, still (bible/06-Systems/Wagons.md WAGONS3).
  // FIELD BUGS 2026-09-29 (the sea) #3: the helm's reach (player/seaZoom.js; 0 off it) to both cameras, every frame -
  // the host's word for the hull sailed, and off the helm a distance past either's own far end comes back to it
  mwCamera.setSeaReach(seaReach);
  eotbCamera.setSeaReach(seaReach);
  // AUDIT COATS3D A2: the 3D horse rig's dye runs every frame, on foot as mounted - the pool's, the road's and the
  // peers' horses ask for their looks whether or not I ride - and A11: my own horse let go off its back, so a remount
  // never gallops in place on the gait it was left in
  horseRig?.tick();
  if (!state.riding) dropOwnHorse();
  // EOTB4: the other lane, resolved first and returned whole - its
  // camera keeps its own ladder, its own smoothing and its own
  // obstacle casts (EOTB2), and nothing of Morrowind's runs.
  if (eotbLane()) {
    // AUDIT-EOTB F1/F3/F4: the frame's REAL state. `dt` is the host's
    // own clock and nothing else has it; the rest comes from the rigs
    // through the door above. Before this, every host passed neither -
    // so `dt` defaulted to 0, MoveTowards stepped nothing, and the
    // camera parked at whatever the minimum-distance floor clamped the
    // initial zero vector to (the player's FEET). Every pin passed,
    // because every pin drove `eotbCamera.eye()` directly with a dt of
    // its own choosing.
    const frame = { ...eotbPlayerState(), ...state };
    // ...and A STRANDED NOTCH IS DROPPED rather than left to fire
    // later. A click can only be queued above while the lane is SHUT,
    // so a count surviving into this branch means the lane opened
    // underneath it - the Morrowind body finished building, or the mod
    // was switched mid-scroll. Carrying it would spend an old notch on
    // a camera the player was not looking through when they turned the
    // wheel, and leaving it uncleared means this frame never drains it
    // at all. Found by a test helper that span forever waiting for it.
    pendingClicks = 0;
    eotbCamera.tick(frame);
    pitch = spireShaftPitch(pitch, yaw, frame.dt ?? 0, eotbCamera.thirdPerson());   // EG-ZN: over a shaft's ledge facing its drop, the camera's pitch biased down...
    pivotFloor = spireShaftPivot(pivotFloor, fpEye[1]);   // ...and its pivot - the head - risen
    const out = eotbCamera.eye({ fpEye, feet, yaw, pitch, raycast, pivotFloor, ...frame });   // BENCH-CAM: the pivot over my wagon's roof
    spireCameraFrame(out, SPIRE_EOTB_FULL_M, frame.dt ?? 0);   // EG-ZH: in the Spire, eased back out
    spireShaftLook(out, yaw, pitch);   // EG-ZN: the camera's own forward, for the host's view
    // EOTB-IL: the billboard's three Unity phases, handed the frame's
    // camera - `PlayerBillboard` reads mainCamera's position and forward
    // in LateUpdate (IL_3d86-IL_3dbf, IL_455d), and its FEET are the
    // parent's origin. It ticks in first person too: the first-person
    // billboard (`Graphics.FirstPersonBillboard`) is the same object.
    // TV1: under the travel view the sprite is seen FROM the view's eye - its eight-way turn is read off the camera
    // that draws it, so the view's eye goes in (and comes back out) in place of the mod's own
    eotbBody.tick(frame.dt ?? 0, { ...frame, feet, yaw, cameraPos: eyeOverride ?? out.eye });
    // EOTB-IL: the cart. `EyeOfTheBeholder.LateUpdate` runs UpdateWagon
    // every frame before its own `offset` gate (IL_1c74-IL_1c7f), so
    // it follows in first person too. `cart` and `onExteriorPath` are
    // the host's (TransportMode == Cart, PlayerMotor.OnExteriorPath).
    eotbWagon.tick(frame.dt ?? 0, { feet, yaw, height: frame.motion?.height, cart: !!frame.cart && !eotbCartYields(), onExteriorPath: !!frame.onExteriorPath, raycast });   // DISC10: HCC's wagon, when it trails, is the one cart
    dropOwnHorse(); saddled = false;   // the sprite lane's rider is its own picture
    return eyeOverride ? { ...out, eye: eyeOverride, ownEye: out.eye } : out;   // TV1: the body's own camera kept - the view rises out of it
  }
  // HT-WAIST: the Morrowind lane has the frame, so the sprite's lantern at the waist (and the light point it drew
  // from) stands down - one line here rather than one in each of the four hosts.
  eotbBody.standDown();
  // RIDE-POV: the saddle first, before any queued notch can cross out of the head - COATS3D: unless the body sits a
  // 3D horse (the host's `horse`: the ridden horse's look, on a horse and not the cart - and HORSE-WALK's `slow`, the
  // motor's slow ride, which holds it under the gallop), which it can be seen on
  // AUDIT COATS3D A8: the horse stands under the eye, not under the capsule's feet - swimming mounted (the eye at
  // SWIM_RIDE_EYE_HEIGHT) it sinks into the water with its rider, and mounting (the eye rising to the saddle's over the
  // height action) it rises under them: never a first-person eye inside its back. SINK_SLACK keeps a step's bob out.
  ownSink = fpEye && feet ? Math.max(0, RIDE_EYE_HEIGHT - (fpEye[1] - feet[1]) - SINK_SLACK) : 0;
  saddled = !!state.riding && stepOwnHorse(state.horse, feet, yaw, state.dt ?? 0);
  mounted = !!state.riding && !saddled;
  if (mounted) { mwIntoHead(); pendingClicks = 0; }
  if (pendingClicks) {
    mwCamera.wheel(pendingClicks, { ready: fpArm.upperBodyReady() });
    pendingClicks = 0;
  }
  // MW-D34: the focal height rides the actor's race HEIGHT (adjustScale's
  // z, npc.cpp:1127/1134 - the camera tracks a node on the SCALED body).
  // Answered here, once, by the rig itself - the hosts stay out of it
  // (MW-D25's law); a caller may still hand an explicit value.
  if (heightScale == null) heightScale = fpArm.raceHeightScale();
  mwCamera.update({ ready: fpArm.upperBodyReady() });
  if (mwCamera.thirdPerson()) {
    if (!fpArm.setViewMode('third')) {
      // The body refused (or was never built): third person does not
      // exist for this player. Fall back rather than float an empty
      // camera - the card carries the body's own refusal sentence.
      mwCamera.restore({ firstPerson: true, baseDistance: mwCamera.baseDistance() });
      fpArm.setViewMode('first');
    }
  } else {
    fpArm.setViewMode('first');
  }
  pitch = spireShaftPitch(pitch, yaw, state.dt ?? 0, mwCamera.thirdPerson());   // EG-ZN: over a shaft's ledge facing its drop, the camera's pitch biased down...
  pivotFloor = spireShaftPivot(pivotFloor, feet[1] + (FOCAL_HEIGHT * heightScale) / MW_UNITS_PER_METER);   // ...and its focal risen (the standing feet's: no saddle in the Spire)
  // COATS3D: astride, the third-person camera turns about the rider's head - its feet lifted as far as the saddle lifts
  // the hips over a standing body's (player/seatPose.js SEAT_PELVIS_HEIGHT, at the race's height)
  if (saddled && ownSaddle) feet = [feet[0], feet[1] + Math.max(0, ownSaddle.seat[1] - feet[1] - SEAT_PELVIS_HEIGHT * heightScale), feet[2]];
  const eye = mwCamera.eye({ fpEye, feet, yaw, pitch, heightScale, raycast, spherecast, pivotFloor });   // MAC-A: the obstacle guards are castSphere's, where the host has one; BENCH-CAM: the pivot over my wagon's roof
  spireCameraFrame(eye, mwCamera.baseDistance() / MW_UNITS_PER_METER, state.dt ?? 0);   // EG-ZH: in the Spire, eased back out
  spireShaftLook(eye, yaw, pitch);   // EG-ZN: the camera's own forward, for the host's view
  return eyeOverride ? { ...eye, eye: eyeOverride, ownEye: eye.eye } : eye;   // TV1: the travel view's eye, the rig's frame run all the same
}

/**
 * The wheel. Browser deltaY is positive scrolling DOWN; Morrowind's
 * ZoomIn is wheel UP (bindingsmanager.cpp:300-301), so up = +1 click.
 * Leaving first person needs a body to show; leaving third person (or
 * zooming within it) needs nothing extra.
 */
export function mwViewWheel(deltaY) {
  const clicks = deltaY < 0 ? 1 : deltaY > 0 ? -1 : 0;
  if (!clicks) return false;
  // EOTB4: the SAME notch, handed to whichever body answers. Both
  // ladders read a click the same way round - negative is out of the
  // head - so nothing about the sign moves at the seam.
  if (eotbLane()) return eotbCamera.wheel(clicks);
  if (mwCamera.mode() === 'first' && clicks < 0 && (!fpArm.canThirdPerson() || mounted)) return false;   // RIDE-POV: no saddle to show
  pendingClicks += clicks;   // flushed once per frame (actionbindings.lua:113-114)
  return true;
}

/** The frame's pending, exposed for the pins - a probe with its own
 *  counter measures the copy. */
export function mwViewPendingClicks() { return pendingClicks; }

/**
 * MAP-POV (2026-09-20, Mac: "If you're in 3rd person and decide to use
 * the map, it should transition you to first person and then open the
 * map. Both for the morrowind/non morrowind"): INTO THE HEAD NOW, for
 * whichever body answers. The map is read in first person - the held
 * map's hands lane needs the first-person arm (AUDIT-MAP2: the
 * third-person body holds nothing), and from third person the window
 * fell to its painted sprite for the whole open, which is what Mac saw.
 *
 * The EOTB lane takes the mod's own ToggleOffset(false). The Morrowind
 * lane takes the camera's restore door and NOT the wheel's crossing:
 * the wheel queues the boundary behind the upper body (camera.cpp:
 * 225-232) and the map is opening THIS frame - so the rig is moved with
 * it, and the arm is first-person before the window's first tick asks.
 * The remembered zoom distance is kept, so a wheel out afterwards lands
 * where the player left the camera. Answers whether the view moved.
 */
export function mwViewFirstPerson() {
  if (heldFirst) heldFirst.changed = false;   // AUDIT CAPTAIN'S SEA S8: the head wanted for itself (MAP-POV) - the glass hands nothing back
  if (eotbLane()) {
    if (!eotbCamera.thirdPerson()) return false;
    eotbCamera.toggleOffset(false);
    return true;
  }
  return mwIntoHead();
}

/**
 * VIEW-TOGGLE (2026-09-28, Mac: "add a force first person/third person toggle"): ONE PRESS, THE OTHER VIEW - for
 * whichever body answers, beside the wheel (EOTB's own `Camera.TogglePerspective` key, IL_1230-IL_124d, which the port
 * had left inert for the wheel - Mac's call, now reversed for a key of the player's choosing). The EOTB lane takes the
 * mod's own ToggleOffset; the Morrowind lane goes out by the restore door the travel view's hold uses and in by
 * MAP-POV's `mwIntoHead`. Refused (false) while the travel view holds the body, in the saddle on the Morrowind body
 * (RIDE-POV: no saddle to show), and where no body can show at all.
 */
export function mwViewTogglePerspective() {
  if (!mwViewCanTogglePerspective()) return false;
  if (eotbLane()) { eotbCamera.toggleOffset(!eotbCamera.thirdPerson()); return true; }
  if (mwCamera.thirdPerson()) return mwIntoHead();
  mwCamera.restore({ firstPerson: false, baseDistance: mwCamera.baseDistance() });
  fpArm.setViewMode('third');
  return true;
}
/** STEED-UI: whether the toggle would turn the view now - the saddle panel's View button stands only where it does
 *  (a lane with a third person, not held, not in the head of a seat that keeps it - RIDE-POV's `mounted`). */
export function mwViewCanTogglePerspective() {
  if (heldThird || heldFirst) return false;   // SPYGLASS: nor while the glass holds the head
  if (eotbLane() || mwCamera.thirdPerson()) return true;
  return !!fpArm.canThirdPerson() && !mounted;
}

/**
 * TV1 (2026-09-27, bible/06-Systems/Travel-View.md): THE BODY OUT OF THE HEAD FOR THE TRAVEL VIEW, AND BACK. The
 * view's eye stands hundreds of metres over the traveller, and the traveller is what it looks at - so whichever body
 * can answer is held in third person for the view's length (the EOTB sprite by its own ToggleOffset, the Morrowind
 * rig by the restore door and its view mode), and handed back to whatever it was when the view lets go. A body that
 * cannot show - neither lane, or the Morrowind body in the saddle (RIDE-POV) - holds nothing, and the view's own
 * marker is the traveller. Answers whether a body is held.
 */
let heldThird = null;   // null, or { lane: 'eotb'|'mw'|null, changed: boolean }
export function mwViewHoldThird(on) {
  if (on) {
    if (heldThird) return heldThird.lane != null;
    // AUDIT CAPTAIN'S SEA S8: the glass's hold handed back first - the view reads the body the player stood in, never the
    // head the glass borrowed (its release a frame later was refused under this hold, and the view's put the head back)
    if (heldFirst) mwViewHoldFirst(false);
    if (eotbLane()) {
      const was = eotbCamera.thirdPerson();
      if (!was) eotbCamera.toggleOffset(true);
      heldThird = { lane: 'eotb', changed: !was };
      return true;
    }
    if (fpArm.canThirdPerson() && !mounted) {
      const was = mwCamera.thirdPerson();
      if (!was) { mwCamera.restore({ firstPerson: false, baseDistance: mwCamera.baseDistance() }); fpArm.setViewMode('third'); }
      heldThird = { lane: 'mw', changed: !was };
      return true;
    }
    heldThird = { lane: null, changed: false };
    return false;
  }
  if (!heldThird) return false;
  const h = heldThird;
  heldThird = null;
  if (h.changed && h.lane === 'eotb' && eotbCamera.thirdPerson()) eotbCamera.toggleOffset(false);
  else if (h.changed && h.lane === 'mw') mwIntoHead();
  return true;
}
/**
 * SPYGLASS (2026-10-11, the owner: "a spyglass option where you can aim and view to observe other ships"): THE BODY INTO
 * THE HEAD FOR THE GLASS, AND BACK. A glass is put to the eye - so while it is up whichever body answers is held in first
 * person (MAP-POV's door, mwViewFirstPerson), and handed back to the third person it stood in when it comes down. The
 * travel view's hold wins (it holds the body out of the head; the glass is never up under it). Answers whether the view
 * is held in the head.
 */
let heldFirst = null;   // null, or { changed: boolean, lane: 'eotb'|'mw' } - whether the hold took the body INTO the head, and whose
export function mwViewHoldFirst(on) {
  if (on) {
    if (heldFirst) return true;
    if (heldThird) return false;
    const lane = eotbLane() ? 'eotb' : 'mw';
    heldFirst = { changed: mwViewFirstPerson(), lane };
    return true;
  }
  if (!heldFirst) return false;
  const h = heldFirst;
  heldFirst = null;
  if (h.changed) mwViewTogglePerspective();   // back out into the third person it stood in
  return true;
}
/** SPYGLASS: is the view held in the head for the glass (the pins' read). */
export const mwViewHeldFirst = () => !!heldFirst;
/** TV1: is a body held out of the head for the travel view (the pins' read). */
export const mwViewHeldThird = () => (heldThird ? heldThird.lane : undefined);
/** AUDIT DEEP T1-10: did the hold take the body OUT of the head (it was in first person)? The view's rise and fall then
 *  blend from the head's own eye, not from the third-person camera the hold put it in. */
export const mwViewHoldChanged = () => !!heldThird?.changed;
/** AUDIT DEEP X-3: the camera a SAVE records - the player's own, never the third person the travel view borrowed for
 *  its body (a save taken under the view came back in third person). */
export function mwViewSaveCamera() {
  const s = mwCamera.state();
  if (heldFirst?.changed && heldFirst.lane === 'mw') return { ...s, firstPerson: false };   // AUDIT CAPTAIN'S SEA S9: nor the head the glass borrowed
  return heldThird?.changed && heldThird.lane === 'mw' ? { ...s, firstPerson: true } : s;
}

/** The Morrowind lane's own door into the head (MAP-POV's, and RIDE-POV's): the restore door, the rig moved with
 *  it, the zoom distance kept. Answers whether the view moved. */
function mwIntoHead() {
  if (!mwCamera.thirdPerson()) return false;
  mwCamera.restore({ firstPerson: true, baseDistance: mwCamera.baseDistance() });
  fpArm.setViewMode('first');
  return true;
}

// RIDE-POV (2026-09-20, Mac: "When riding the horse with the morrowind
// model, you should be exempt from using 3rd person"): THE MORROWIND BODY
// HAS NO SADDLE. The sprite body rides (EOTB's own saddle states); the
// Morrowind third-person body has no riding animation and would stand
// through the horse, so while the host says `riding` the Morrowind lane
// stays in the head - a rider in third person is put there, and the wheel
// cannot take one out. The frame remembers the saddle for the wheel, which
// has no state of its own. Read off the seam's own frame, so every host
// that rides the seam gets the rule and none has to know it.
// COATS3D: `mounted` is RIDE-POV's hold - in the saddle of no 3D horse (the cart's seat, or a horse the rig cannot draw
// yet); astride the 3D horse (`saddled`) the body has a saddle to show, and the head is not held.
let mounted = false;

// COATS3D (2026-10-11, the owner: "These are to be applied to horses for people using morrowind with the character
// properly rigged when riding"; asked, "Yes, unlock it" for third person in the saddle, and "The 3D horse" for first
// person): THE MORROWIND BODY HAS A SADDLE NOW. On a horse (the host's `horse` - its look; the cart is not one) the
// view keeps the player's own 3D horse (world/horseRig.js): stepped each frame at the ground the body covers, under
// the body's feet with its seat over them, and its seat handed to the body as `saddle` (the hosts' camera(), through
// mwViewSaddle) - so the body sits astride it (player/seatPose.js saddleRigInput). Third person draws the two in one
// picture (fpArm.js drawThird's `horse`), so RIDE-POV no longer holds the head: the wheel takes it out as on foot.
// First person draws the horse from the eye in place of Daggerfall's riding sprite (player/mountRig.js,
// mwViewDrawSaddle). Without the rig - not loaded yet, or failed - RIDE-POV stands as it did.
let horseRig = null;
let ownHorse = null;
let saddled = false;
let ownSaddle = null;
let lastFeet = null;
let groundSpeed = 0;
let lastCamera = null;
/** The body's ground speed is eased toward the frame's over this many seconds, so a gait does not flicker on a frame's
 *  stutter; a step past HORSE_TELEPORT m/s is a teleport, never a gallop. */
const SPEED_EASE = 0.12;
const HORSE_TELEPORT = 40;
/** AUDIT COATS3D A8: how far the eye stands under the saddle's (RIDE_EYE_HEIGHT), past SINK_SLACK - the horse's ground
 *  that much under the rider's feet. */
let ownSink = 0;
const SINK_SLACK = 0.15;

/** COATS3D: the host's renderer, once - the 3D horse rig's (world/horseRig.js horseRigFor) - and its bake asked for. */
export function mwViewAttachHorse(renderer) {
  if (!renderer || horseRig) return;
  horseRig = horseRigFor(renderer);
  horseRig.load();
}

/** COATS3D: one frame of the player's own horse - stepped, and its seat made the body's saddle. Answers whether the
 *  body is astride it this frame. */
function stepOwnHorse(horse, feet, yaw, dt) {
  if (!horse || !horseRig?.ready() || !feet || !fpArm.canThirdPerson()) { dropOwnHorse(); return false; }
  ownHorse ??= horseRig.horse(1);
  if (!ownHorse) return false;
  if (lastFeet && dt > 0) {
    const v = Math.hypot(feet[0] - lastFeet[0], feet[2] - lastFeet[2]) / dt;
    if (v < HORSE_TELEPORT) groundSpeed += (v - groundSpeed) * Math.min(1, dt / SPEED_EASE);
  }
  lastFeet = [feet[0], feet[1], feet[2]];
  horseRig.step(ownHorse, { feet: horseFeetUnder(feet, yaw), yaw, speed: groundSpeed, dt, look: horse.look | 0, gallops: !horse.slow });   // HORSE-WALK: the host's slow ride (motor.js slowRide) never gallops
  const seat = horseRig.seat(ownHorse);
  ownSaddle = seat ? { feet: lastFeet, seat, yaw, lean: gaitShare(ownHorse.gait, 'gallop') } : null;
  return !!ownSaddle;
}
/** The horse's own feet, so its seat stands over the rider's: its origin back from them by the seat's own way forward. */
const horseFeetUnder = (feet, yaw, grow = 1) => [feet[0] - Math.sin(yaw) * HORSE_SEAT[1] * grow, feet[1] - ownSink * grow, feet[2] - Math.cos(yaw) * HORSE_SEAT[1] * grow];
function dropOwnHorse() {
  if (ownHorse) horseRig?.release(ownHorse);
  ownHorse = null; ownSaddle = null; lastFeet = null; groundSpeed = 0;
}

/** COATS3D: the 3D horse rig while the world's horses are 3D - the Morrowind body is the one on screen (the player's
 *  own lane: never the sprite lane's, whose riders and horses are its own pictures) and the rig is up; else null, and
 *  every horse stands as its billboard. The pool's and the road's horses (scenes/horseCartPool.js, world/road/roadTeams.js)
 *  ask it each frame. */
export function mwViewHorseRig() {
  return horseRig?.ready() && !eotbLane() && fpArm.canThirdPerson() ? horseRig : null;
}

/** COATS3D: the saddle the body sits this frame (`{ feet, seat, yaw, lean }`) for the hosts' camera() - or null, off a
 *  3D horse. */
export const mwViewSaddle = () => (saddled ? ownSaddle : null);

/** COATS3D: the horse in first person, where Daggerfall's riding sprite is drawn (player/mountRig.js frame - after the
 *  world, under the hands): taken with the world's own camera from the eye on its back. Answers whether it drew - the
 *  riding sprite stands down when it did. */
export function mwViewDrawSaddle(canvas) {
  if (!saddled || !ownHorse || !lastCamera || mwCamera.thirdPerson() || eotbLane()) return false;
  horseRig.place(ownHorse, horseFeetUnder(lastCamera.feet, lastCamera.yaw), lastCamera.yaw);
  return horseRig.drawFirstPerson(ownHorse, canvas, lastCamera);
}

// WAGONS3 (2026-10-10, Mac: "Using a wagon doesnt allow you to zoom out into 3rd person when mounted"; "sit on the wagon
// itself, the ledge its built for"): THE DRIVER ON THE BENCH IS NOT IN THE SADDLE. A host whose player drives a wagon
// from its bench (scenes/horseCartPool.js driverSeat - the Open Wagon's and the Caravan's) hands the frame `seated` and
// `riding` false: the body sits on the bench (player/seatPose.js, the CARDS2b seat) and the team pulls in front of it,
// so RIDE-POV's rule - no saddle to show - does not hold it in the head, and the wheel takes it out as it does on foot.
// The first-person horse (player/mountRig.js, DFU's cart picture) is the saddle's view, not the bench's: it hides
// (mwViewHides). The Small Cart has no bench - its driver rides its horse, and RIDE-POV stands for it.
let benchSeated = false;

// ═══ AUDIT-EOTB2: THE FOUR DOORS THE BODY'S OTHER HALF NEEDED ════════
//
// Each is the seam's answer to a question ONE consumer asks, routed by
// the lane so a Morrowind player never hears the sprite's word.

/** [IL] SyncFootsteps: the sprite's word on the stride, for the hosts'
 *  FootstepMachine - `owns` once the mod's Initialize has silenced the
 *  vanilla stride, `fell` on the tick a foot landed, `volumeScale` the
 *  billboard's own (2 in third person, 1 in first). Off the lane it
 *  owns nothing and DFU's own stride plays. */
export function mwViewFootstep() {
  if (!eotbLane()) return { owns: false, fell: false, volumeScale: 1 };
  return eotbBody.footstep();
}

/** [IL] AutoTogglePerspective's two transition rows, on the building's
 *  door AND the dungeon's: `'Interior'` stepping in, `'Exterior'`
 *  stepping out. The mode machine calls it; a Morrowind player is
 *  untouched. */
export function mwViewTransition(kind) {
  if (!eotbLane()) return false;
  // AUDIT OW5 V3: a door taken under the travel view - a row that DECIDES the POV decides it for the view's hold too; the
  // view's release at the door came a frame later and put the head back (a player's "interior: third person" undone)
  if (heldThird?.lane === 'eotb' && eotbCamera.transitionDecides(kind)) heldThird.changed = false;
  if (heldFirst?.lane === 'eotb' && eotbCamera.transitionDecides(kind)) heldFirst.changed = false;   // AUDIT CAPTAIN'S SEA S8: the glass's hold the same
  eotbCamera.transition(kind);
  return true;
}

/** The saved camera on a LOAD, both lanes: MW-D30's forced restore of
 *  the Morrowind camera, and the mod's own OnLoad - `StartInThirdPerson`
 *  decides the POV a loaded game takes (its description's own words:
 *  "Determines the POV when starting or loading a game"), so the sprite
 *  camera is re-seeded from the setting, not from the save. */
export function mwViewLoadPose(pose, inside = false) {
  heldFirst = null;   // AUDIT CAPTAIN'S SEA S8: a load decides the view - the glass hands nothing back over it
  if (pose) mwCamera.restore(pose);
  eotbCamera.onLoad(inside);   // EOTB-IL: the mod's OnLoad (IL_0a08) - a transition row when the table is armed, StartInThirdPerson otherwise
}

/** [IL] StartGameBehaviour.OnNewGame (IL_0930), the new game's own
 *  door - the same shape as the load's. `inside` is
 *  PlayerEnterExit.IsPlayerInside. */
export function mwViewNewGame(inside = false) {
  heldFirst = null;   // AUDIT CAPTAIN'S SEA S8: a new game's view its own
  eotbCamera.onNewGame(inside);
}

/** [IL] FloatingOrigin.OnPositionUpdate (IL_1cb7): the world moved under
 *  the camera; the sprite camera's smoothing re-seeds. The Morrowind
 *  camera works in the eye's own frame and needs nothing. */
export function mwViewRebase(delta) {
  eotbCamera.onPositionUpdate(delta);
  eotbWagon.rebase(delta);
  eotbBody.rebase(delta);   // HORSE-FACE: the sprite's own feet too - an origin shift read as a placing
}

// ═══ EOTB-IL: THE CART's three doors ═════════════════════════════════
//
// SpawnWagon / UpdateWagon / CheckWagon (player/eyeOfTheBeholder/eotbWagon.js). The two
// EXTERIOR hosts carry all three - DFU's TransportManager puts the
// player on foot at every interior and dungeon door, so the cart
// (TransportMode == Cart, IL_1f58) never exists inside.

/** The host's mesh pipeline, for CreateDaggerfallMeshGameObject's model 41239. */
export function mwViewAttachWagon(pipeline) { eotbWagon.attach(pipeline); }

/** The cart in the host's world pass, after its models. Off the lane there is no cart. PERF-WAGON: `cull` the host's
 *  view test, handed on (player/eyeOfTheBeholder/eotbWagon.js draw). */
export function mwViewDrawWagon(renderer, texRemap = null, cull = null) {
  if (!eotbLane()) return false;
  return eotbWagon.draw(renderer, texRemap, cull);
}

/** RegisterCustomActivation(41239, CheckWagon, 3.2): the pick's target, for the hosts' one ray. */
export function mwViewWagonTargets(rayDistance) {
  if (!eotbLane()) return [];
  return eotbWagon.targets(rayDistance);
}

/** CheckWagon: Info names it, any other mode opens the inventory with the wagon. */
export function mwViewWagonActivate(mode, doors) {
  if (!eotbLane()) return null;
  return eotbWagon.activate(mode, doors);
}

/** [IL] The camera's hides for the surfaces that draw first-person
 *  graphics: the FPV weapon, the FPV horse and the spell hands go while
 *  the sprite body is the one on screen, the first two unless the mod's
 *  own Compatibility keys say to leave them. Off the lane: nothing hides. */
export function mwViewHides() {
  // TV1: under the travel view the camera is hundreds of metres up - no first-person hand, horse or weapon belongs on it
  if (heldThird) return { weapon: true, horse: true, spellHands: true };
  const hides = eotbLane() ? eotbBody.hides() : { weapon: false, horse: false, spellHands: false };
  // HORSE-POV (2026-10-12, the owner: "when using the morrowind models for the horse, the 2d sprite is still painted on
  // the screen, especially in third person"): the riding sprite is the view from the saddle. The Morrowind body in third
  // person is seen from behind - its horse, when it sits one, stands in the world in 3D (fpArm.js drawThird's `horse`) -
  // so no first-person horse is on the screen. mwViewDrawSaddle answers false out of first person, and the sprite read
  // that as its turn.
  if (!eotbLane() && mwCamera.thirdPerson()) return { ...hides, horse: true };
  return benchSeated ? { ...hides, horse: true } : hides;   // WAGONS3: on the bench the team is in the world, not on the screen
}

/** The third-person body composite, after the host's world draw. A
 *  no-op in first person or when the body cannot draw. */
export function mwViewDrawBody(canvas, { proj, view, eye, feet, yaw, viewYaw = yaw, face = null }) {
  // EOTB4: the sprite lane draws its own body. `eotbLane()` already
  // requires `eotbBodyReady()`, so this arm cannot be reached with
  // nothing to draw - the gate and the draw are the same question
  // asked once.
  // EOTB-IL: the BODY decides - it is active in third person, and in
  // first person while `Graphics.FirstPersonBillboard` is not None
  // (ToggleOffset, IL_2307-IL_2353), where it draws behind the eye
  // AUDIT CLIMB-ARC N1: the sprite lane's `yaw` is its QUAD's plane and its camera's (eotbBody.js) - the view's - never
  // the body's on the wall (CLIMB5 handed it the body's, and a hanging player looking along the wall saw the sprite
  // edge-on); the Morrowind body below turns to the wall (`yaw`, the body's)
  if (eotbLane()) { const drawn = drawEotbBody(canvas, { proj, view, eye, feet, yaw: viewYaw, face }); spriteFigure = drawn ? eotbFigure() : null; spriteFacing = drawn ? eotbFacing() : null; return drawn; }   // AUDIT DEEP R-2: `face` - the travel view's basis for the quad; SERAPH-WINGS: the figure it drew kept for the aura on its back
  lastCamera = { proj, view, feet, yaw };   // COATS3D: the frame's camera, for the horse in first person (mwViewDrawSaddle)
  if (!mwCamera.thirdPerson()) return false;
  // COATS3D: astride, the horse under the body - placed at the body's own feet and facing this draw, in its picture
  const grow = face?.grow > 1 ? face.grow : 1;
  const horse = saddled && ownHorse ? horseRig.picture(ownHorse, horseFeetUnder(feet, yaw, grow), yaw, grow) : null;
  // AUDIT OW3 J6: OW-BIG's grown traveller is the Morrowind body's too - `face.grow` (player/travelCamera.js tvOwnGrow)
  // reached the sprite body alone, and under the travel view the Morrowind body stood a speck at its own size.
  // AUDIT OW4 J6: and `face.up` - its quad leaned as the sprite lane's is (eotbBody.js), not upright under a pitched picture
  return fpArm.drawThird(canvas, { proj, view, eye, feet, yaw, grow: face?.grow > 1 ? face.grow : 1, up: face?.up ?? null, horse });
}

/** SHADOW-CLOAK: the third-person Morrowind body's named bones where they stand this frame, in its own frame
 *  (fpArm.thirdBones) - or null: the sprite lane's body has no bones, and first person poses no third-person body. */
export function mwViewBodyBones(names) {
  if (eotbLane() || !mwCamera.thirdPerson()) return null;
  return fpArm.thirdBones(names);
}
/** SERAPH-WINGS: the sprite lane's body as drawn this frame - { base, h } over its feet (player/eyeOfTheBeholder/eotbBody.js figure()) - or
 *  null: another lane, or no sprite drawn. */
let spriteFigure = null;
export function mwViewSpriteFigure() { return eotbLane() ? spriteFigure : null; }
/** SPRITE-FACE (2026-10-05): the sprite lane's body's facing as drawn this frame - { yaw, turn }: the way its picture
 *  faces and the way the body turns (player/eyeOfTheBeholder/eotbBody.js facing()) - or null: another lane, no sprite drawn, first person.
 *  An aura on the sprite hangs on `yaw`, never on the walk's facing the picture lags (world.js auraFrame, drawAuras). */
let spriteFacing = null;
export function mwViewSpriteFacing() { return eotbLane() ? spriteFacing : null; }

/** EOTB5's door, matching `setEotbBodyReady`: the host hands the seam
 *  the one call that paints the mod's sprite. Null until then, which
 *  is why `eotbBodyReady` answers false. */
let drawEotbBody = () => false;
let eotbFigure = () => null;   // SERAPH-WINGS: the figure the sprite drew
let eotbFacing = () => null;   // SPRITE-FACE: and the way it faced
export function setEotbDrawBody(fn, figure = null, facing = null) { drawEotbBody = typeof fn === 'function' ? fn : () => false; eotbFigure = typeof figure === 'function' ? figure : () => null; eotbFacing = typeof facing === 'function' ? facing : () => null; }
