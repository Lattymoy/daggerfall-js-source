// NPC2: ONE SHARED BODY, MANY ACTORS - the per-actor half of the
// Morrowind NPC lane.
//
// NPC1 made the expensive half shared: one built body per outfit. This
// is the cheap half, and the split is the reference's own - OpenMW
// keeps shared resources against per-actor animation state, and a
// creature or an NPC there is a scene node over a shared mesh, not a
// private copy of it.
//
// WHAT AN ACTOR OWNS: its playhead. Which group is running and how far
// through it - a few numbers. Two guards in one uniform walking out of
// step differ by exactly this and nothing else.
//
// WHAT THE BODY OWNS (shared): the assembly, the animation sources,
// the textures, the packed buffer and the GPU mesh.
//
// WHY THAT IS SAFE. poseAssembly writes into the assembly's own
// position buffers, so the body is a SCRATCH surface reused within a
// frame: pose actor A, upload, draw; pose actor B, upload, draw. The
// pose only has to survive until its own draw, which is the very next
// statement. What it must never do is pose every actor first and draw
// afterwards - then every actor wears the last one's pose. That is
// this module's one real hazard and its pin says so.
import {
  poseAssembly, pickAnimSource, composeStanceGroup, composeMovementGroup,
  movementAnimState,
} from '../formats/mwFirstPerson.js';
import { advanceClip, resetClip, sampleTrack } from '../formats/mwAnim.js';
import { uploadMwBodyMesh, drawMwBodyAt, FP_IDLE_BASE } from '../combat/fpArm.js';

/** Everything one actor keeps between frames. Deliberately tiny. */
export function mwActorState() {
  return { group: null, clip: null, source: null };
}

/**
 * The group this actor should be playing, through the SAME ladders the
 * player's machine rides (MW-D26): the movement state decides the
 * base, the weapon's short suffix composes onto it, and a group the
 * data does not carry falls back rather than substituting a wrong
 * clip. Answers null when nothing resolves - the caller then keeps its
 * classic sprite instead of drawing a bind pose.
 */
export function actorGroupFor(body, { moving = false, running = false }) {
  const has = (n) => body.groupSet.has(n);
  const stance = body.mwType ?? 0;
  if (!moving) return composeStanceGroup(FP_IDLE_BASE, stance, has).group;
  // No `|| 'walkforward'` fallback: with forward = 1 the movestate
  // ladder always answers (walkforward, or runforward when running),
  // so a fallback here would be dead code - MEASURED, and a mutation
  // round found it by surviving. The ladder's own run->walk swap
  // (composeMovementGroup) is what covers data with no run clip.
  const base = movementAnimState({
    forward: 1, strafe: 0, running, sneaking: false, turning: 0, thirdPerson: true,
  });
  return composeMovementGroup(base, stance, has).group;
}

/**
 * Advance this actor's playhead and DRAW it, in that order and in one
 * call - see the scratch-surface note in the header. Answers false
 * when there is nothing to draw, and the caller falls back to the
 * classic sprite exactly as it does today.
 */
export function drawMwActor(renderer, canvas, body, state, {
  dt = 0, moving = false, running = false, feet, yaw = 0, proj, view, eye,
} = {}) {
  if (!renderer || !canvas || !body || !body.ok || !state || !feet) return false;

  // The group can change under the actor mid-stride (it stops, it
  // draws a weapon); a same-group refresh keeps the playhead where it
  // is, exactly as the player's own refresh does (character.cpp
  // :822-825).
  const want = actorGroupFor(body, { moving, running });
  // PROVED-EQUIVALENT GUARD, recorded rather than left as a hole: with
  // `want` null the pick below answers null too and this function
  // returns false by that path instead. The line stays because it says
  // the refusal at the point it is decided - a reader should not have
  // to know pickAnimSource's null behaviour to see that a body whose
  // data names no group draws NOTHING (MWFIX2's forbidden outcome).
  if (!want) return false;
  if (state.group !== want || !state.clip || !state.source) {
    const pick = pickAnimSource(body.sources, want, resetClip, { loopFallback: true, loopCount: Infinity });
    if (!pick) return false;
    state.group = want; state.clip = pick.state; state.source = pick.source;
  }
  advanceClip(state.clip, state.source.keys, dt, null);

  // POSE, UPLOAD, DRAW - adjacent on purpose.
  poseAssembly(body.arm, {
    tracks: state.source.trackMap,
    sampleTrack,
    time: state.clip.time,
    accumRoot: body.accumRoot,
  });
  const mesh = uploadMwBodyMesh(renderer, body, body.arm, body.textures);
  return drawMwBodyAt(renderer, canvas, mesh, body.arm, body.raceScale, { feet, yaw, proj, view, eye });
}
