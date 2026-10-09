// @ts-check
// CLIMB5 - THE CLIMB, SEEN AND HEARD BY THE OTHERS (the Enhanced Climbing arc - bible/03-World/Parkour-Arc.md; Mac: "I
// really want you to go all in on this").
//
// Before it a peer on a wall was a body standing in the air: facing wherever their camera looked (over the shoulder,
// down the street), posed on the ground, walking in place along a lip as they shimmied, and silent. The pose carries
// the climb now (net/wire.js validPose: `cl` 1 hanging, 2 on a face, 3 a move in flight; `cw` the way the body faces
// on it - player/motor.js climbPoseOf), and every way the others draw a peer reads it here:
//   - FACING: the body and the sprite turn to the wall (peerBodyYaw) - the Morrowind body eases to it as it eases to
//     any yaw, the billboards and the riders' sprites take it as their facing;
//   - THE POSE: off the ground (the Morrowind body's own in-air pose, the one the local third person takes on the wall),
//     and no walk on the wall (peerMoving) - a shimmy is hands, not strides;
//   - THE SOUNDS: the climb's own clips (player/climbSounds.js), played AT the peer as their steps are
//     (remotePlayers.js PEER_SOUND_PROFILE) - the catch, the hands onto a face, the haul over a lip, a hand at every
//     reach up the wall and every span along a lip, the hands letting go - off the changes of their climb, since the
//     wire carries the state and not the frame's events. The port's own sounds' switch (ES1) over them, as over the
//     local climb's.

import { CLIMB_SOUND, climbClip, installClimbSounds } from '../player/climbSounds.js';
import { POSE, peerLipY, floorGapAt } from '../player/climbPose.js';   // CLIMB6: a peer's limbs on the climb, the own body's law
import { CLIMB_MOVE_KINDS } from './wire.js';
import { PARKOUR_UP_GAP } from '../player/parkour.js';
import { FEEL } from '../player/climbFeel.js';
import { enhancedSoundsOn } from '../systems/enhancedSounds.js';

/** The wire's climb states (`cl`). */
export const PEER_CLIMB = Object.freeze({ HANG: 1, FACE: 2, MOVE: 3 });

/** Is this drawn pose on the climb. */
export const peerClimbing = (shown) => (shown?.cl | 0) > 0;
/** The yaw a peer's body faces - the climb's (`cw`) on it, the pose's own otherwise. */
export function peerBodyYaw(shown) {
  return peerClimbing(shown) && Number.isFinite(shown.cw) ? shown.cw : shown?.yaw;
}
/** Is the peer walking - the move bit, never on the wall (a shimmy moves the feet along the lip, and is no stride). */
export const peerMoving = (shown) => !!shown?.mv && !peerClimbing(shown) && !shown?.st;   // CARDS2b (AUDIT CARDS C5): nor is a sitter - one law for every body, sound and sprite stride

/**
 * What a change of a peer's climb sounds - `[sound, volume]` pairs, from the state they were in to the one they are in
 * now (0 off the wall). The local climb's volumes (CLIMB_SOUND), the moves' own sounds read off their ends: onto a
 * lip from the air is a catch, onto a face a hand, a move begun from a hang the haul over the lip, a move ending in a
 * hold the hands taking it, a hold let go the hands leaving the stone. Off a move onto the ground is the stride's.
 * @param {number} was @param {number} now
 * @returns {Array<[string, number]>}
 */
export function peerClimbCues(was, now) {
  const C = CLIMB_SOUND, { HANG, FACE, MOVE } = PEER_CLIMB;
  if (was === now) return [];
  if (!was) return now === HANG ? [['catch', C.CATCH_BASE + 0.1]] : [['grab', C.GRAB * (now === FACE ? 0.75 : 0.7)]];
  if (!now) return was === MOVE ? [] : [['step', C.LET_GO]];
  if (now === MOVE) return [['pull', C.PULL * (was === HANG ? 1 : 0.7)]];
  if (was === MOVE) return [['grab', C.GRAB * (now === HANG ? 1 : 0.8)]];
  return [['grab', C.GRAB * 0.75]];   // a hang to a face, or back
}

/** AUDIT CLIMB-ARC N6: the least time (ms) between one peer's climb cues, and between its hands' and boots' sounds. */
export const PEER_CUE_MS = 150;
export const PEER_RHYTHM_MS = 100;

export class PeerClimbSounds {
  /**
   * @param {{ audio?: any, profile?: any, on?: () => boolean, rand?: () => number, install?: boolean, now?: () => number }} [opts]
   *   `audio` the bus (play3d); `profile` the peers' falloff (remotePlayers.js PEER_SOUND_PROFILE); `on` the port's own
   *   sounds' switch; `rand` the variety's dice (the pins' seam); `install` false keeps the clips unloaded; `now` the
   *   clock (ms) the sound floors read (AUDIT CLIMB-ARC N6 - the pins' seam).
   */
  constructor({ audio = null, profile = null, on = enhancedSoundsOn, rand = Math.random, install = true, now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) } = {}) {
    this.audio = audio;
    this.now = now;   // AUDIT CLIMB-ARC N6: the floors' clock (ms)
    this.profile = profile;
    this.on = on;
    this.rand = rand;
    this.install = install;
    this.peers = new Map();   // id -> { cl, at, climb, shimmy }
    this.last = new Map();    // sound -> the key last played
  }

  /** One drawn frame of a peer: `shown` their pose, `at` their feet in the scene, `heard` whether they are in earshot
   *  (a peer out of it changes state silently, and the rhythm's travel is not saved up for later). */
  update(id, shown, at, heard = true) {
    const cl = shown?.cl | 0;
    const s = this.peers.get(id);
    if (!s) { this.peers.set(id, { cl, at: at ? [at[0], at[1], at[2]] : null, climb: 0, shimmy: 0 }); return; }   // first seen: an old climb is not replayed
    const on = this.on() && !!this.audio?.play3d;
    if (on && this.install) installClimbSounds(this.audio);
    // AUDIT CLIMB-ARC N6: A FLOOR UNDER EVERY PEER'S SOUNDS. The wire carries the climb's state, and a pose stream that
    // flips it every pose (or swings a metre along a lip each one) asked a one-shot of every drawn frame - 120 a second
    // from one hostile peer, each a source, a gain and a panner. A cue waits PEER_CUE_MS after the last, a hand or a boot
    // PEER_RHYTHM_MS: an honest climber's is far slower (a reach every 0.45 m, a cue a move)
    const t = this.now();
    const cueOk = t - (s.cueAt ?? -Infinity) >= PEER_CUE_MS;
    if (on && heard && at && cueOk) {
      const cues = peerClimbCues(s.cl, cl);
      for (const [sound, vol] of cues) this._play(sound, vol, 1, at);
      if (cues.length) s.cueAt = t;
    }
    const rhythmOk = () => { if (t - (s.rhythmAt ?? -Infinity) < PEER_RHYTHM_MS) return false; s.rhythmAt = t; return true; };
    // the rhythm: a hand at every reach up a face (a boot half a reach on), a hand every span along a lip
    if (cl !== s.cl) { s.climb = 0; s.shimmy = 0; }
    if (at && s.at && cl === s.cl && (cl === PEER_CLIMB.FACE || cl === PEER_CLIMB.HANG)) {
      const dx = at[0] - s.at[0], dy = at[1] - s.at[1], dz = at[2] - s.at[2];
      const d = cl === PEER_CLIMB.FACE ? Math.hypot(dx, dy, dz) : Math.hypot(dx, dz);
      if (d > 1e-5 && d < 1) {   // past a metre a frame is a snap (a recentre, a placement), never a climb
        if (cl === PEER_CLIMB.FACE) {
          const was = s.climb;
          s.climb += d / FEEL.REACH;
          if (on && heard && Math.floor(s.climb) > Math.floor(was) && rhythmOk()) this._play('step', CLIMB_SOUND.STEP, 1, at);
          if (on && heard && Math.floor(s.climb - 0.5) > Math.floor(was - 0.5) && rhythmOk()) this._play('step', CLIMB_SOUND.FOOT, CLIMB_SOUND.FOOT_PITCH, at);
        } else {
          const was = s.shimmy;
          s.shimmy += d / FEEL.SHIMMY_SPAN;
          if (on && heard && Math.floor(s.shimmy) > Math.floor(was) && rhythmOk()) this._play('step', CLIMB_SOUND.SHIMMY, CLIMB_SOUND.SHIMMY_PITCH, at);
        }
      }
    }
    s.cl = cl;
    s.at = at ? [at[0], at[1], at[2]] : null;
  }

  /** A peer gone (left the room, out of the drawn set): the next sight of them is a first. */
  forget(id) { this.peers.delete(id); }
  /** The floating origin moved: every peer's last place is in the old frame - the next frame's travel is no climb. */
  rebase() { for (const s of this.peers.values()) s.at = null; }

  _play(sound, vol, pitch, at) {
    const c = climbClip(sound, this.last.get(sound), this.rand, pitch);
    if (!c) return;
    this.last.set(sound, c.key);
    this.audio.play3d(c.key, at, Math.min(1, vol), { ...(this.profile ?? {}), pitch: c.pitch });
  }
}

// ---- CLIMB6: A PEER'S BODY ON THE WALL ---------------------------------------------------------------------------------

/** CLIMB6: the time a move without its `cd` is taken to last (s) - a mantle's at middling skill. */
export const PEER_MOVE_DUR = 0.9;
/** CLIMB6: a mantle's rise, a vault's, as a share of its time - the planners' own (parkour.js planMantle's split grows
 *  with the rise; a vault's is planVault's 0.4). */
const PEER_SPLIT = Object.freeze({ mantle: 0.6, vault: 0.4 });

/**
 * CLIMB6: A PEER'S CLIMB, AS THE BODY'S LAW READS IT (player/climbPose.js ClimbPose - the own body's law, the same
 * limbs on the same kind of stone). The wire carries the climb's state, the way the body faces and, a move in flight,
 * its kind, its lip and its time (wire.js climbOf) - not the frame's geometry - and every hold the motor takes stands
 * the body the same way to its stone (parkour.js senseGrip: the face POSE.FACE_BACK ahead of the feet, a hang's lip
 * PARKOUR_HANG_DROP over them), so the hold is rebuilt exactly from the pose; a move is rebuilt once, as it begins - its
 * start the feet then, its lip `cy` over them, its clock the local one from then over its `cd`. One per body.
 */
export class PeerClimbTrack {
  constructor() { this.move = null; this.moveKey = null; this.moveStart = 0; }

  /** The snapshot for this frame (null off the wall): `shown` the drawn pose, `feet` and `yaw` where the body is drawn
   *  (PeerBodies' b.feet, b.yaw), `now` ms, `collider` the host's (the floor under a hang's feet) or null. */
  input(shown, feet, yaw, now, collider = null) {
    const cl = (shown?.cl | 0);
    if (!cl || !feet) { this.move = null; this.moveKey = null; return null; }
    const cw = Number.isFinite(shown.cw) ? shown.cw : yaw;
    const fwd = [Math.sin(cw), 0, Math.cos(cw)], normal = [-fwd[0], 0, -fwd[2]];
    const base = { feet: [feet[0], feet[1], feet[2]], yaw, grip: 1, floorGap: floorGapAt(collider, feet), flight: null };
    if (cl !== 3) {
      this.move = null; this.moveKey = null;
      return cl === 1 ? { ...base, mode: 'hang', normal, lipY: peerLipY(feet[1]), move: null } : { ...base, mode: 'climb', normal, lipY: null, move: null };
    }
    const kind = CLIMB_MOVE_KINDS[(shown.ck | 0) - 1] ?? null;
    if (!kind) return { ...base, mode: null, normal: null, lipY: null, move: null };   // a move the pose does not name: the in-air pose
    const key = `${kind}:${shown.cy ?? ''}:${shown.cd ?? ''}`;
    if (key !== this.moveKey || !this.move) {
      this.moveKey = key;
      this.moveStart = now;
      this.move = peerMove(kind, base.feet, fwd, Number.isFinite(shown.cy) ? shown.cy / 100 : null, shown.cd ? shown.cd / 100 : PEER_MOVE_DUR);
    }
    this.move.t = Math.min(1, Math.max(0, (now - this.moveStart) / 1000 / this.move.dur));
    return { ...base, mode: null, normal: null, lipY: null, move: this.move };
  }
}

/** CLIMB6: a move rebuilt from its start (`from`, facing `fwd`), its lip `rise` metres over it (a hang's when unknown)
 *  and its time - the planners' shape (parkour.js plan*): a mantle's or a vault's edge POSE.FACE_BACK ahead with the rise
 *  keeping the gap over it, the move's hang on that lip facing the way the body does. The end is left to the body's
 *  own place as the poses carry it (the law reads the feet where `to` is unknown). */
export function peerMove(kind, from, fwd, rise, dur) {
  const lip = from[1] + (Number.isFinite(rise) ? rise : 1.8);
  const back = POSE.FACE_BACK;
  const m = { kind, from: [...from], up: null, to: null, split: 1, arc: 0, dur: Math.max(0.05, dur), exit: null, t: 0, hang: null, wall: null };
  if (kind === 'mantle' || kind === 'vault') {
    m.up = [from[0], lip + PARKOUR_UP_GAP, from[2]];
    m.to = [from[0] + fwd[0] * (back + 0.4), lip, from[2] + fwd[2] * (back + 0.4)];
    m.split = PEER_SPLIT[kind];
  } else if (kind === 'wallrun' && !Number.isFinite(rise)) {
    m.wall = { normal: [-fwd[0], 0, -fwd[2]] };
  } else {
    m.hang = { normal: [-fwd[0], 0, -fwd[2]], lipY: lip };
    if (kind === 'lower') m.to = [from[0], lip - 1.8, from[2]];
  }
  return m;
}
