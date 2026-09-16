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

import { mwCamera } from './mwCamera.js';
import { fpArm } from '../combat/fpArm.js';
import { eotbCamera } from './eotbCamera.js';
import { eotbBody } from './eotbBody.js';
import { eotbWagon } from './eotbWagon.js';
import { modSetting } from '../systems/modSettings.js';

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
 * machine); `sailing` is Come Sail Away's, which the port has not got.
 * Registered once by `combat/weaponRig.js`, so no host re-derives it -
 * MW-D25's law, the reason this seam exists at all.
 */
let eotbPlayerState = () => ({});
export function setEotbPlayerState(fn) { eotbPlayerState = typeof fn === 'function' ? fn : () => ({}); }
/** EOTB5's door: the host tells the seam its body can draw. */
export function setEotbBodyReady(fn) { eotbBodyReady = typeof fn === 'function' ? fn : () => false; }
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
 * @returns {{eye:number[], thirdPerson:boolean, distance:number}}
 */
export function mwViewFrame({ fpEye, feet, yaw, pitch, heightScale = null, raycast = null, ...state }) {
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
    const out = eotbCamera.eye({ fpEye, feet, yaw, pitch, raycast, ...frame });
    // EOTB-IL: the billboard's three Unity phases, handed the frame's
    // camera - `PlayerBillboard` reads mainCamera's position and forward
    // in LateUpdate (IL_3d86-IL_3dbf, IL_455d), and its FEET are the
    // parent's origin. It ticks in first person too: the first-person
    // billboard (`Graphics.FirstPersonBillboard`) is the same object.
    eotbBody.tick(frame.dt ?? 0, { ...frame, feet, yaw, cameraPos: out.eye });
    // EOTB-IL: the cart. `EyeOfTheBeholder.LateUpdate` runs UpdateWagon
    // every frame before its own `offset` gate (IL_1c74-IL_1c7f), so
    // it follows in first person too. `cart` and `onExteriorPath` are
    // the host's (TransportMode == Cart, PlayerMotor.OnExteriorPath).
    eotbWagon.tick(frame.dt ?? 0, { feet, yaw, height: frame.motion?.height, cart: !!frame.cart, onExteriorPath: !!frame.onExteriorPath, raycast });
    return out;
  }
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
  return mwCamera.eye({ fpEye, feet, yaw, pitch, heightScale, raycast });
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
  if (mwCamera.mode() === 'first' && clicks < 0 && !fpArm.canThirdPerson()) return false;
  pendingClicks += clicks;   // flushed once per frame (actionbindings.lua:113-114)
  return true;
}

/** The frame's pending, exposed for the pins - a probe with its own
 *  counter measures the copy. */
export function mwViewPendingClicks() { return pendingClicks; }

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
  eotbCamera.transition(kind);
  return true;
}

/** The saved camera on a LOAD, both lanes: MW-D30's forced restore of
 *  the Morrowind camera, and the mod's own OnLoad - `StartInThirdPerson`
 *  decides the POV a loaded game takes (its description's own words:
 *  "Determines the POV when starting or loading a game"), so the sprite
 *  camera is re-seeded from the setting, not from the save. */
export function mwViewLoadPose(pose, inside = false) {
  if (pose) mwCamera.restore(pose);
  eotbCamera.onLoad(inside);   // EOTB-IL: the mod's OnLoad (IL_0a08) - a transition row when the table is armed, StartInThirdPerson otherwise
}

/** [IL] StartGameBehaviour.OnNewGame (IL_0930), the new game's own
 *  door - the same shape as the load's. `inside` is
 *  PlayerEnterExit.IsPlayerInside. */
export function mwViewNewGame(inside = false) {
  eotbCamera.onNewGame(inside);
}

/** [IL] FloatingOrigin.OnPositionUpdate (IL_1cb7): the world moved under
 *  the camera; the sprite camera's smoothing re-seeds. The Morrowind
 *  camera works in the eye's own frame and needs nothing. */
export function mwViewRebase(delta) {
  eotbCamera.onPositionUpdate(delta);
  eotbWagon.rebase(delta);
}

// ═══ EOTB-IL: THE CART's three doors ═════════════════════════════════
//
// SpawnWagon / UpdateWagon / CheckWagon (player/eotbWagon.js). The two
// EXTERIOR hosts carry all three - DFU's TransportManager puts the
// player on foot at every interior and dungeon door, so the cart
// (TransportMode == Cart, IL_1f58) never exists inside.

/** The host's mesh pipeline, for CreateDaggerfallMeshGameObject's model 41239. */
export function mwViewAttachWagon(pipeline) { eotbWagon.attach(pipeline); }

/** The cart in the host's world pass, after its models. Off the lane there is no cart. */
export function mwViewDrawWagon(renderer, texRemap = null) {
  if (!eotbLane()) return false;
  return eotbWagon.draw(renderer, texRemap);
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
  if (!eotbLane()) return { weapon: false, horse: false, spellHands: false };
  return eotbBody.hides();
}

/** The third-person body composite, after the host's world draw. A
 *  no-op in first person or when the body cannot draw. */
export function mwViewDrawBody(canvas, { proj, view, eye, feet, yaw }) {
  // EOTB4: the sprite lane draws its own body. `eotbLane()` already
  // requires `eotbBodyReady()`, so this arm cannot be reached with
  // nothing to draw - the gate and the draw are the same question
  // asked once.
  // EOTB-IL: the BODY decides - it is active in third person, and in
  // first person while `Graphics.FirstPersonBillboard` is not None
  // (ToggleOffset, IL_2307-IL_2353), where it draws behind the eye
  if (eotbLane()) return drawEotbBody(canvas, { proj, view, eye, feet, yaw });
  if (!mwCamera.thirdPerson()) return false;
  return fpArm.drawThird(canvas, { proj, view, eye, feet, yaw });
}

/** EOTB5's door, matching `setEotbBodyReady`: the host hands the seam
 *  the one call that paints the mod's sprite. Null until then, which
 *  is why `eotbBodyReady` answers false. */
let drawEotbBody = () => false;
export function setEotbDrawBody(fn) { drawEotbBody = typeof fn === 'function' ? fn : () => false; }
