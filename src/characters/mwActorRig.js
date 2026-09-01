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
  movementAnimState, MW_WEAPON_TYPE,
} from '../formats/mwFirstPerson.js';
import { advanceClip, resetClip, sampleTrack } from '../formats/mwAnim.js';
import { uploadMwBodyMesh, drawMwBodyAt, FP_IDLE_BASE } from '../combat/fpArm.js';
import { mwActorBody, mwCreatureBody, mwBodyGeneration } from './mwActorBody.js';

/**
 * NPC3a: ASK FOR AN ACTOR'S BODY, ONCE, WITHOUT EVER BLOCKING.
 *
 * Every host that draws actors needs the same three-state dance - not
 * asked, in flight, settled - and two copies of it is how the dungeon
 * and the street would drift. The actor object carries the state
 * (`_mwBody`, `_mwPending`, `_mwState`) because the actor is what the
 * host already keeps per frame.
 *
 * A settled NULL is remembered: an actor the data cannot dress must
 * not re-ask on every frame for the rest of its life. A build in
 * flight answers null too, so this frame draws the classic sprite and
 * the next one may not - which is the whole fallback story.
 *
 * @param actor      the host's own per-actor object (mutated)
 * @param opts       humanoid body opts, or null for a creature
 * @param mobileType used when `opts` is null
 */
export function requestMwBody(actor, opts, mobileType) {
  // AUDIT A5: a settled answer is only settled for the DATA it was
  // built from. The service drops its cache on a re-attach, but an
  // actor holds its own reference and would have kept drawing a body
  // made of archives the player has replaced - forever, because it
  // never asks twice. The stamp is what lets it notice.
  if (actor._mwBody !== undefined && actor._mwGen === mwBodyGeneration()) return actor._mwBody;
  if (actor._mwPending) return null;
  actor._mwPending = true;
  // A humanoid wears a dressed body; a beast IS a model. One door,
  // two builders - a rat is not a skeleton in clothes.
  (opts ? mwActorBody(opts) : mwCreatureBody(mobileType))
    .then((body) => { actor._mwBody = body; actor._mwState = mwActorState(); actor._mwGen = mwBodyGeneration(); })
    .catch(() => { actor._mwBody = null; actor._mwGen = mwBodyGeneration(); })
    .finally(() => { actor._mwPending = false; });
  return null;
}

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
  // AUDIT A1: "no weapon" is MW_WEAPON_TYPE.None, which is -1. ZERO is
  // ShortBladeOneHand - a real weapon - so `?? 0` asked every unarmed
  // body for a one-handed stance. The ladder's bare-group fallback was
  // masking it, and would have STOPPED masking it the moment a rig
  // carried an idle1h its actor had no business standing in.
  const stance = body.mwType ?? MW_WEAPON_TYPE.None;
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
