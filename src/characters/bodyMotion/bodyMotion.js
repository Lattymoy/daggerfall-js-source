// @ts-check
// BODY-MOTION (2026-10-18, Mac: "I want to build improved animations for the morrowind rig (3rd person)" - "Improved
// running/walking for all races", "Weapon specific walking/running animations", "Improved melee 3rd person attack
// animations", "I want to be as detailed as possible. No band aids"; bible/04-Characters/Body-Motion.md) - THE BODY'S
// MOTION, ONE PER RIG. The Morrowind body in third person walks, runs, creeps, stands, carries what is in its hands and
// strikes with its whole body - the gait (gait.js), the carry (carry.js) and the blows (melee.js) joined into one request
// and solved on the skeleton over the clip's pose (bodySolve.js), through poseAssembly's `motion` slot
// (formats/morrowind/mwFirstPerson.js) - under the climb, the seat and the long gun's hold, which still win the bones
// they ask for.
//
// THE CLIP IS NOT THROWN AWAY. The clip machine (combat/fpArm.js) still runs every group and still decides everything a
// group decides - the draw and the sheathe, a cast, a bow's draw and loose, the hit recoil, the death, the jump, the
// swim - and the body's motion steps aside for each (the arms for the first four, the whole body for the rest), easing
// out and back in. What it takes over is what the clips did worst in third person: the legs (a walk played at twice its
// cadence slid every foot), the trunk, the arms' carry, and a blow's body (the attack clip took every bone, so the legs
// froze mid-stride - the recorded gap of Morrowind-Rules.md's rule 26, closed here: the legs keep the gait under a blow).
//
// A rig's motion is its own instance (the player's, each peer's, each person's - net/peer/peerBodies.js builds their
// rigs through the same createFpArm), stepped by the rig's own update every frame (`step`, its clocks - a frame that does
// not pose still walks) and laid on the pose on the frames that pose (`apply`). The switch is the viewer's (`on`):
// systems/features.js 'mw-body-motion' - off, the body moves as Morrowind's clips move it.

import { MW_WEAPON_TYPE, MW_UNITS_PER_METER } from '../../formats/morrowind/mwFirstPerson.js';
import { getPref } from '../../systems/uiPrefs.js';
import { algebra, ease, clamp01, RAD, bodyOf, bodyKindOf, reflect, bodyTurn, mul, transpose } from './bodyKit.js';
import { rotAxisAngle, rotFraction } from '../../combat/climbRig.js';
import { createGaitState, stepGait, gaitPose, TURN } from './gait.js';
import { carryClassOf, carryHands, CARRY, TWO_HAND_GRIP, TWO_HAND_HAFT, armByAngles, mirrorRequest, hafHand, blendHand, gaitShares, turnAbout, strideRide } from './carry.js';
import { meleeFamilyOf, blowName, blowU, blowPose, windFor } from './melee.js';
import { solveBody, gripRequest } from './bodySolve.js';

const { add, scale, sub, cross, norm, len, lerp } = algebra;

/** THE EASES (seconds): the layer on and off (off quicker - a recoil or a death takes the body at once), the arms on and
 *  off (a draw, a cast, a torch lit), and a change of carry class (a weapon drawn, a pair raised); `carry` (radians a
 *  second) the critically damped spring the carry's gait shares follow the gait's on (AUDIT BODY-MOTION CARRY-6). */
export const MOTION_EASE = Object.freeze({ in: 0.14, out: 0.1, outFast: 0.05, armIn: 0.12, armOut: 0.07, cls: 0.14, carry: 14 });

/** A BLOW'S TRUNK: the share of the gait's steer (its hips turned toward a strafe's travel) a blow takes back toward the
 *  facing at its full weight, and the most the chest turns off the hips (degrees) - AUDIT BODY-MOTION MELEE-8: a blow
 *  swung while strafing laid its own wind on the steer, and twisted the trunk 80 to 92 degrees off the hips. */
export const BLOW_TRUNK = Object.freeze({ steer: 0.6, twist: 50 });

/** The blade's length (MW units) each class draws on the contact sheets - the sheet's alone; the rig draws the mesh. */
const SHEET_BLADE = Object.freeze({ one: 58, two: 88, wide: 112, spear: 120, dual: 54 });

/**
 * The frame's word, in full (the rig builds it - combat/fpArm.js - and the contact sheets and pins through
 * `sceneInput`):
 *   on (the switch, third person, a biped the layer knows), kind (bodyKit.js bodyKindOf), busy (a reason the whole
 *   body is the clip's: 'climb', 'seat', 'dead', 'hit', or null);
 *   speed (m/s), forward, strafe, running, sneaking, grounded, swimming, levitating, yaw (radians, the body's heading as
 *   drawn), travel (the body's own ground, world metres, cumulative - player/motor.js travelAt, a peer's drawn feet's;
 *   null where none: the pace along the keys stands in), carriedYaw (the turns a deck gave it, cumulative);
 *   height, weight (the race's scale);
 *   mwType, shown (the weapon in the hand), hands ('single' | 'dual' | 'fists'), torch (the left hand's light), shield
 *   (a shield on the left arm), spell (a readied spell or a cast), equip (a draw or a sheathe in the hands), rifle (the
 *   long gun's hold has the hands);
 *   blow - { type, reversed, hand, section, progress, strength } while a melee blow is in the machine, else null;
 *   guard - { L, R } (radians) the pair's guard: how far each arm is lowered while the other strikes, or null.
 */
export function sceneInput({
  forward = 0, strafe = 0, speed = 0, running = false, sneaking = false, yaw = 0, grounded = true, travel = null, carriedYaw = 0,
  weapon = MW_WEAPON_TYPE.None, hands = 'single', shown = undefined, blow = null, kind = 'male',
  height = 1, weight = 1, torch = false, shield = false, spell = false, equip = false, rifle = false, on = true, busy = null, guard = null,
} = {}) {
  return {
    on, kind, busy, speed, forward, strafe, running, sneaking, grounded, swimming: false, levitating: false, yaw, travel, carriedYaw,
    height, weight, mwType: weapon, shown: shown ?? weapon !== MW_WEAPON_TYPE.None, hands, torch, shield, spell, equip, rifle, blow, guard,
  };
}

/** The machine's upper-body state (combat/fpArm.js UPPER_BODY_NAME) as the blow's section. */
const SECTION_OF = Object.freeze({ AttackWindUp: 'windup', AttackRelease: 'release', AttackEnd: 'follow' });

/**
 * THE RIG'S WORD, made from its own state each frame (combat/fpArm.js update - the one place it is read, so a peer's
 * body and a person's take it exactly as the player's): `cam` the frame's camera bag (its `move`, `yaw`, `sneaking`,
 * `climb`, `seat`, `saddle`), `third` the body drawn in third person, `rig` the third-person build (its skeleton's
 * path, its weapon type, the pieces it wears - a shield among them), `built` the rig's (its race's scale, a werewolf's or a creature's body), `dead`, `hit` (a
 * recoil in the clip), `climb` the climb's weight, `upper` the upper body's state by name, the blow's `attackType`,
 * `reversed` and `hand` and its section's `progress` and `strength`, `shown` the weapon in the hand, `hands` how the
 * hands are held (TWO-HANDS), `torch` the left hand's light, `spell` a spell readied or cast, `rifle` the long gun's
 * hold weight. The switch is systems/features.js 'mw-body-motion' (the viewer's - how this machine draws a body).
 */
export function motionWord({
  cam = null, third = false, rig = null, built = null, dead = false, hit = false, climb = 0, upper = 'None',
  attackType = null, reversed = false, hand = null, progress = 0, strength = 1, shown = false, hands = 'single',
  torch = false, spell = false, rifle = 0, guard = null,
} = {}) {
  const mv = (cam && cam.move) || {};
  const kind = bodyKindOf(rig?.settingsSkeleton);
  const on = !!third && !!kind && !!rig?.ok && !built?.creature && !built?.werewolf && getPref('mwBodyMotion') !== false;
  const busy = dead ? 'dead' : hit ? 'hit' : climb > 0.02 || cam?.climb ? 'climb' : cam?.seat || cam?.saddle ? 'seat' : null;
  const section = SECTION_OF[upper] ?? null;
  return {
    on, kind, busy,
    speed: Number(mv.speed) || 0, forward: Number(mv.forward) || 0, strafe: Number(mv.strafe) || 0, running: !!mv.running,
    sneaking: !!cam?.sneaking, grounded: mv.grounded !== false, swimming: !!mv.swimming, levitating: !!mv.levitating,
    // AUDIT BODY-MOTION GAIT-9 / GAIT-17 / RIG-3 / RIG-6: the ground the body's own steps crossed, the yaw it is DRAWN at
    // (player/motor.js bodyYawFor's - the view's, a climb's easing offset on it), and a deck's turns
    travel: Array.isArray(mv.travel) ? mv.travel : null, carriedYaw: Number(mv.carriedYaw) || 0,
    yaw: Number.isFinite(mv.bodyYaw) ? mv.bodyYaw : (Number(cam?.yaw) || 0) + (Number(mv.bodyYawOff) || 0),
    height: built?.raceScale?.height ?? 1, weight: built?.raceScale?.weight ?? 1,
    mwType: rig?.mwType ?? MW_WEAPON_TYPE.None, shown: !!shown, hands, torch: !!torch, spell: !!spell,
    // SHIELD-RUN: a shield is a piece the body wears on its left arm, at the Shield Bone - the composer names its slot
    // `shield (<record>)` (formats/morrowind/mwItemMap.js composeWornArmor; fitThirdPersonCloak reads it so too)
    shield: !!rig?.arm?.pieces?.some((p) => /^shield\b/.test(p.slot ?? '')),
    equip: upper === 'Equipping' || upper === 'Unequipping', rifle: rifle > 0.01,
    blow: section && attackType ? { type: attackType, reversed: !!reversed, hand, section, progress, strength } : null,
    // AUDIT BODY-MOTION MELEE-11: the pair's guard - each arm's dip while the other strikes (fpArm.js pairDip, radians)
    guard: guard && (guard.L > 0 || guard.R > 0) ? { L: Number(guard.L) || 0, R: Number(guard.R) || 0 } : null,
  };
}


export function createBodyMotion() {
  const gait = createGaitState();
  let input = sceneInput({ on: false });
  let w = 0;
  const armW = { L: 0, R: 0 };
  let cls = 'free', clsFrom = null, clsMix = 1;
  // THE CARRY'S OWN GAIT SHARES: the gait's (idle, walk, run, sneak) followed by a critically damped spring - the gait's
  // first-order eases start a change at full speed, and the arms with them (AUDIT BODY-MOTION CARRY-6: a run's carry
  // came on 20 to 41 degrees in a frame)
  const shares = { x: null, v: { idle: 0, walk: 0, run: 0, sneak: 0 } };
  let body = null;
  let last = null;
  let wasOn = false;
  let stance = null, stepTime = null, bpNow = null;
  let lastBlow = null;   // the blow last seen - let go of by its weight when the machine drops it part-way (MELEE-6)
  let cut = null;        // where a blow that cut the last one begins: that one's hand and trunk as they stood (MELEE-6)
  let drawn = null;      // the striking hand as last drawn, as a blow's keys read it
  const gaitInput = () => ({
    speed: input.speed, forward: input.forward, strafe: input.strafe, running: input.running, sneaking: input.sneaking,
    yaw: input.yaw, grounded: input.grounded, kind: input.kind, travel: input.travel, carriedYaw: input.carriedYaw,
    legM: body ? (body.leg * (input.height || 1)) / MW_UNITS_PER_METER : 1,
    unitsPerM: MW_UNITS_PER_METER / (input.weight || 1), unitsPerMz: MW_UNITS_PER_METER / (input.height || 1),
    stance, stepTime,
  });
  /** THE STANCE the feet stand in: the carry's (CARRY[cls].stand), eased from the class it leaves (AUDIT BODY-MOTION
   *  CARRY-5: switched on the frame, a drawn two-hander threw the feet 11 units and the hips 16 degrees) - the feet step
   *  into it (gait.js) - and a blow's lunge laid on the lead foot, stepped quickly: the left for a right-hand blow, a
   *  guard's own lead (the left) for the fists. */
  function stanceNow(bp) {
    const a = CARRY[clsFrom]?.stand ?? null, b = CARRY[cls]?.stand ?? null, t = clsFrom ? clsMix : 1;
    const mixV = (p, q) => [lerp(p?.[0] ?? 0, q?.[0] ?? 0, t), lerp(p?.[1] ?? 0, q?.[1] ?? 0, t)];
    const st = {
      feet: { L: mixV(a?.feet?.L, b?.feet?.L), R: mixV(a?.feet?.R, b?.feet?.R) },
      toe: { L: lerp(a?.toe?.L ?? 0, b?.toe?.L ?? 0, t), R: lerp(a?.toe?.R ?? 0, b?.toe?.R ?? 0, t) },
      hipYaw: lerp(a?.hipYaw ?? 0, b?.hipYaw ?? 0, t), lean: lerp(a?.lean ?? 0, b?.lean ?? 0, t),
      hipShift: a?.hipShift || b?.hipShift ? mixV(a?.hipShift, b?.hipShift) : null,
    };
    if (bp && bp.step > 0) {
      const lead = bp.family === 'fists' ? 'L' : bp.side === 'L' ? 'R' : 'L';
      st.feet[lead] = [st.feet[lead][0], st.feet[lead][1] + bp.step * bp.wind * bp.w];
    }
    return st;
  }
  /** The blow the machine is in, as the choreography reads it - or null. */
  const blowNow = (from = null) => {
    const b = input.blow;
    if (!b || !b.section) return null;
    const family = meleeFamilyOf(cls);
    if (!family || (b.type !== 'chop' && b.type !== 'slash' && b.type !== 'thrust')) return null;
    // a weapon held alone rides the right Weapon Bone (the mirror composes only a pair's or the fists' left): it strikes
    // with the right whichever hand the machine leads with (AUDIT BODY-MOTION MELEE-7: a left lead swung the empty hand
    // and flung the sword arm back as its counterweight)
    const side = family !== 'fists' && input.hands !== 'dual' ? 'R' : b.hand === 'L' ? 'L' : 'R';
    const name = blowName(b.type, b.reversed);
    const bp = blowPose(family, name, blowU(b.section, b.progress), side, from);
    if (!bp) return null;
    return { ...bp, family, name, wind: windFor(b.strength) };
  };

  /** THE HANDS on the trunk that now stands: the carry's (the class it is changing to eased over the one it leaves),
   *  a blow's over them; `steady` the turn that takes the stride's wave off the trunk (HELD-STEADY - carry.js
   *  carryHands). Exposed for the pins. */
  function handsFor(ctx, gp, bp, steady = null) {
    let hands = carryHands(cls, gp, ctx, { armW, shares: shares.x, steady });
    if (clsFrom && clsMix < 1) {
      const from = carryHands(clsFrom, gp, ctx, { armW, shares: shares.x, steady });
      hands = { L: blendHand(from.L, hands.L, clsMix), R: blendHand(from.R, hands.R, clsMix) };
    }
    // the pair's guard: the arm whose fellow strikes lowered at its shoulder, as the mirror lowers the clip's (TWO-HANDS
    // AUDIT - AUDIT BODY-MOTION MELEE-11: laid before the layer, the carry's own arm put it back up)
    if (input.guard && (cls === 'dual' || cls === 'fists')) {
      for (const side of ['L', 'R']) if (input.guard[side] > 0 && hands[side]) hands[side] = lowered(hands[side], ctx.frames.shoulder[side], ctx.frames.up, input.guard[side]);
    }
    if (!bp || !(bp.w > 0)) return hands;
    // the blow begun and ended on the striking hand's carry as it stands now (melee.js blowPose's `from` - MELEE-1); one
    // that cut another begun where that one stood (MELEE-6)
    const from = carryFrom(hands[bp.side], bp.side, ctx, bp.family === 'fists');
    const keyed = from || cut ? blowPose(bp.family, bp.name, bp.u, bp.side, { start: cut ?? from, end: from }) : null;
    const strike = blowHands(keyed ? { ...bp, ...keyed } : bp, cls, ctx, armW);
    const out = { L: blendHand(hands.L, strike.L, bp.w * (strike.L ? 1 : 0)), R: blendHand(hands.R, strike.R, bp.w * (strike.R ? 1 : 0)) };
    drawn = carryFrom(out[bp.side], bp.side, ctx, bp.family === 'fists');
    return out;
  }

  const motion = {
    /** THE CLOCKS, every frame (posed or not): the gait, the layer's weight, the arms', the carry class. */
    step(dt, frame) {
      input = frame ?? sceneInput({ on: false });
      // switched on (third person again, the switch thrown, a body handed on): the gait begun afresh - the last frame it
      // saw may be a minute old (AUDIT BODY-MOTION RIG-5: the heading alone was re-anchored, and a body came back in the
      // walk, the bank and the feet it had left)
      if (input.on && !wasOn) Object.assign(gait, createGaitState());
      wasOn = !!input.on;
      const free = !!input.on && !input.busy && input.grounded !== false && !input.swimming && !input.levitating;
      w = ease(w, free ? 1 : 0, free ? MOTION_EASE.in : (input.busy === 'dead' || input.busy === 'hit' ? MOTION_EASE.outFast : MOTION_EASE.out), dt);
      if (!free && w < 1e-3) { w = 0; last = null; }   // AUDIT BODY-MOTION RIG-9: the card says off once the body is the clip's
      const next = carryClassOf(input);
      // a class changed back while its blend still ran turns the blend about where it stands (AUDIT BODY-MOTION
      // CARRY-13: begun afresh from the class it was leaving, the hands leapt 3.9 units)
      if (next !== cls) {
        if (clsFrom && next === clsFrom) { clsFrom = cls; cls = next; clsMix = 1 - clsMix; } else { clsFrom = cls; cls = next; clsMix = 0; }
      }
      clsMix = ease(clsMix, 1, MOTION_EASE.cls, dt);
      if (clsMix > 0.999) { clsMix = 1; clsFrom = null; }
      const hands = !input.equip && !input.rifle && cls !== 'clip';
      // SHIELD-RUN (the Discord's "sprinting with my mace and shield out just makes me look incredibly stupid"): a shield
      // on the arm leaves the left arm to the clip, as a torch does - Morrowind's own groups carry a shield; the free
      // run's pump swung it up behind the head. Only where the reference shows it: drawn fists and a two-hander hide it.
      const shieldArm = !!input.shield && (cls === 'one' || cls === 'free');
      for (const side of ['L', 'R']) {
        const want = hands && !(side === 'L' && (input.torch || shieldArm)) ? 1 : 0;
        armW[side] = ease(armW[side], want, want ? MOTION_EASE.armIn : MOTION_EASE.armOut, dt);
        if (!want && armW[side] < 1e-3) armW[side] = 0;
      }
      {
        const sn = clamp01(gait.sneak), target = gaitShares({ move: gait.move, run: clamp01(gait.run) * (1 - sn), sneak: sn });
        if (!shares.x || !(dt > 0)) shares.x = { ...target };
        else {
          let sum = 0;
          for (const g of ['idle', 'walk', 'run', 'sneak']) {
            // the spring's exact step - stable at any frame time
            const d0 = shares.x[g] - target[g], v0 = shares.v[g], e = Math.exp(-MOTION_EASE.carry * dt), j = v0 + MOTION_EASE.carry * d0;
            shares.x[g] = Math.max(0, target[g] + (d0 + j * dt) * e);
            shares.v[g] = (v0 - MOTION_EASE.carry * j * dt) * e;
            sum += shares.x[g];
          }
          if (sum > 0) for (const g of ['idle', 'walk', 'run', 'sneak']) shares.x[g] /= sum;
        }
      }
      // a blow the machine drops part-way (an interrupt, a stagger, a sheathe) is let go of over the layer's own ease out,
      // held where it stood (AUDIT BODY-MOTION MELEE-6: dropped at once, the hand leapt 0.9 to 1.3 arm lengths and the
      // chest 20 to 36 degrees in a frame)
      let seen = blowNow(cut ? { start: cut } : null);
      // cut by the next blow (the machine's sections begun afresh, or another blow): it begins where this one stands
      if (seen && lastBlow && lastBlow.w > 0.05 && (seen.name !== lastBlow.name || seen.u + 0.05 < lastBlow.u)) {
        const m = lastBlow.side === 'L' ? -1 : 1;
        cut = {
          ...(drawn ?? {}), w: lastBlow.w,
          chest: [lastBlow.chest[0] * m, lastBlow.chest[1] * m, lastBlow.chest[2]], hip: lastBlow.hip * m,
          shift: lastBlow.shift, drop: lastBlow.drop, step: lastBlow.step, off: lastBlow.off,
        };
        seen = blowNow({ start: cut });
      }
      if (!seen) cut = null;
      // the strength's wind followed, never stepped to: it is 1 through the machine's wind-up and set only as the release
      // begins (combat/fpArm.js windUpStrength - a group with no min attack draws it at random), so read at once it
      // turned the chest 9.5 to 14 degrees in the release's first frame (AUDIT BODY-MOTION MELEE-12)
      if (seen) seen.wind = lastBlow && !cut ? ease(lastBlow.wind, seen.wind, MOTION_EASE.cls, dt) : seen.wind;
      if (seen) lastBlow = seen;
      else if (lastBlow && lastBlow.w > 1e-3) lastBlow = { ...lastBlow, w: ease(lastBlow.w, 0, MOTION_EASE.out, dt) };
      else lastBlow = null;
      bpNow = seen ?? lastBlow;
      stance = stanceNow(bpNow);
      stepTime = bpNow && bpNow.step > 0 && bpNow.w > 0.05 ? TURN.quick : null;
      if (input.on && body) stepGait(gait, gaitInput(), body, dt);
      return w;
    },
    /** THE POSE: the request solved on the skeleton over the clip's (poseAssembly's `motion` slot). */
    apply(skeleton, pose, rootRef, skelMats) {
      if (!(w > 1e-3)) { last = null; return null; }
      const measured = bodyOf(skeleton, rootRef, skelMats);
      if (!measured) { last = null; return null; }
      if (body !== measured) { body = measured; Object.assign(gait, createGaitState()); stepGait(gait, gaitInput(), body, 0); }
      const gi = gaitInput();
      const bp = bpNow;
      const k = bp ? bp.w : 0;
      const wind = bp ? bp.wind * k : 0;
      const gp = gaitPose(gait, gi, body);
      const L = body.leg;
      const runLean = lerp(CARRY[clsFrom]?.runLean ?? 0, CARRY[cls]?.runLean ?? 0, clsFrom ? clsMix : 1) * gp.run * gp.move * RAD;
      // TWO-RUN: a class's chest turned toward its weapon at a run (CARRY's `runTurn`), as the lean, by the run's share
      const runTurn = lerp(CARRY[clsFrom]?.runTurn ?? 0, CARRY[cls]?.runTurn ?? 0, clsFrom ? clsMix : 1) * gp.run * gp.move * RAD;
      const hipYaw = gp.hip.yaw - gait.psi * gp.move * BLOW_TRUNK.steer * k + (bp ? bp.hip * RAD * wind : 0);
      /** The chest's turn with `wave` of the stride's own counter-turn and counter-drop on it. */
      const chestAt = (wave) => ({
        yaw: Math.max(hipYaw - BLOW_TRUNK.twist * RAD, Math.min(hipYaw + BLOW_TRUNK.twist * RAD, (gp.chest.yaw - gp.chest.wave.yaw * (1 - wave) + runTurn) * (1 - k) + (bp ? bp.chest[0] * RAD * wind : 0))),
        roll: gp.chest.roll - gp.chest.wave.roll * (1 - wave) + (bp ? bp.chest[1] * RAD * wind : 0),
        pitch: gp.chest.pitch + runLean + (bp ? bp.chest[2] * RAD * wind : 0),
      });
      // HELD-STEADY (carry.js strideRide, carryHands): the chest takes the stride's wave as far as its arms are free to ride
      // it (a weapon in both hands binds the shoulders), each arm as far as its row swings - turned back from the chest as
      // laid to the chest without the wave, as far as the solve lays the chest (the layer's weight, the arms it has)
      const sh = shares.x ?? gaitShares(gp);
      const ride = lerp(clsFrom ? strideRide(clsFrom, sh, armW.L) : 1, strideRide(cls, sh, armW.L), clsFrom ? clsMix : 1);
      const chest = chestAt(ride), calm = chestAt(0);
      const steady = { ride, turn: rotFraction(mul(bodyTurn(calm.yaw, calm.roll, calm.pitch), transpose(bodyTurn(chest.yaw, chest.roll, chest.pitch))), w * Math.max(armW.L, armW.R)) };
      const plan = {
        w,
        hip: {
          at: add(gp.hip.at, [0, bp ? bp.shift * L * wind : 0, bp ? -bp.drop * L * wind : 0]),
          yaw: hipYaw, roll: gp.hip.roll, pitch: gp.hip.pitch,
        },
        chest,
        head: { yaw: 0, roll: 0, pitch: 0 },
        feet: gp.feet,
        armW: { L: armW.L, R: armW.R },
        arms: (ctx) => handsFor(ctx, gp, bp, steady),
      };
      const report = solveBody(skeleton, pose, rootRef, skelMats, plan);
      last = { gp, bp, report };
      return report;
    },
    hands: handsFor,
    /** poseAssembly's `motion` slot (formats/morrowind/mwFirstPerson.js): the request laid on this frame's skeleton. */
    slot: (skeleton, pose, rootRef, skelMats) => motion.apply(skeleton, pose, rootRef, skelMats),
    /** The layer's weight now (0 the clip's body, 1 the motion's). */
    weight: () => w,
    /** The gait's stride phase (0..1), its weight and the hips' turn off the facing (radians, as last posed, by the
     *  layer's weight) - what a swinging hip lantern follows. */
    stride: () => ({ phase: gait.shown, move: gait.move * w, hipYaw: last?.gp ? last.gp.hip.yaw * w : 0 }),
    /** The debug card's line and the sheets' blades. */
    status() {
      const gp = last?.gp;
      const mode = !gp ? 'off' : gp.sneak > 0.5 ? 'sneak' : gp.move < 0.5 ? 'stand' : gp.run > 0.5 ? 'run' : 'walk';
      return {
        w, cls, mode, phase: gait.phase, speed: gait.speed, psi: gait.psi, back: gait.back, bank: gait.bank, stepping: gait.feet.L?.swing?.kind === 'step' ? 'L' : gait.feet.R?.swing?.kind === 'step' ? 'R' : null,
        blow: last?.bp ? `${last.bp.family} u=${last.bp.u.toFixed(2)}` : null,
        label: `${cls} ${mode}${last?.bp ? ` u${last.bp.u.toFixed(2)}` : ` psi${(gait.psi / RAD).toFixed(0)}`}`,
        blade: SHEET_BLADE[cls] ? { R: SHEET_BLADE[cls], L: cls === 'dual' ? SHEET_BLADE[cls] : null } : {},
      };
    },
    reset() { Object.assign(gait, createGaitState()); w = 0; armW.L = 0; armW.R = 0; cls = 'free'; clsFrom = null; clsMix = 1; last = null; shares.x = null; lastBlow = null; cut = null; drawn = null; },
  };
  return motion;
}

/**
 * A BLOW'S HANDS: the striking hand where the choreography puts its grip (or its fist), the weapon turned so its blade
 * and edge stand as the key says; a two-hander's left closing on the haft; a one-hander's free arm thrown back as the
 * counterweight; a pair's other blade and a guard's other fist kept where the carry holds them (null - the carry's).
 * A left-hand blow is solved as the right hand's mirror and reflected across the body's middle (the left hand and its
 * Weapon Bone Left are the right's mirror - combat/twoHands/mirrorRig.js).
 */
/** A hand request turned `angle` radians DOWN about its shoulder `S` (the wrist, every way and the grip with it). */
function lowered(h, S, up, angle) {
  const v = sub(h.at, S), ax = cross(v, up), l = len(ax);
  if (!(l > 1e-6)) return h;
  return turnAbout(h, S, rotAxisAngle(scale(ax, 1 / l), -angle));
}

/** A carry's striking hand as a blow's keys read it (melee.js): the RIGHT hand's, in the body frame - its grip in arm
 *  lengths off the shoulders' middle, its blade and edge (a fist's wrist, fingers and palm); a left hand's mirrored to the
 *  right across the body's middle (a pair's left is its right's request across the chest's - carry.js). Null where the
 *  hand holds nothing the keys know. */
function carryFrom(h, side, ctx, fists) {
  if (!h) return null;
  const { body, frames } = ctx;
  const C = scale(add(frames.shoulder.L, frames.shoulder.R), 0.5), A = body.arm;
  const mx = (v) => (side === 'L' ? [-v[0], v[1], v[2]] : v);
  if (fists) return h.at && h.fingers && h.palm ? { grip: mx(scale(sub(h.at, C), 1 / A)), fingers: mx(h.fingers), palm: mx(h.palm) } : null;
  if (!h.grip || !h.frame) return null;
  let grip = h.grip, blade = h.frame.blade, edge = h.frame.edge;
  if (side === 'L') { grip = add(C, reflect(sub(grip, C), frames.right)); blade = reflect(blade, frames.right); edge = reflect(edge, frames.right); }
  return { grip: mx(scale(sub(grip, C), 1 / A)), blade: mx(blade), edge: mx(edge) };
}

function blowHands(bp, cls, ctx, armW) {
  const { body, mats, frames } = ctx;
  const C = scale(add(frames.shoulder.L, frames.shoulder.R), 0.5);
  const A = body.arm;
  const X = [1, 0, 0];
  const right = (v) => (v ? [v[0] * (bp.side === 'L' ? -1 : 1), v[1], v[2]] : null);   // the key back on the right hand
  const gripR = add(C, scale(right(bp.grip), A));
  const out = { L: null, R: null };
  const poleR = norm([0.55, -0.25, -0.65]);
  let req = null;
  if (bp.family === 'fists') {
    req = { at: gripR, fingers: right(bp.fingers), palm: right(bp.palm), pole: poleR, w: 1 };
  } else {
    req = gripRequest(mats, body, 'R', body.wb, { grip: gripR, blade: right(bp.blade), edge: right(bp.edge), pole: poleR, w: 1 });
  }
  if (!req) return out;
  const strike = bp.side === 'L' ? mirrorRequest(req, C, X) : req;
  out[bp.side] = { ...strike, w: armW[bp.side] };
  const other = bp.side === 'L' ? 'R' : 'L';
  if (bp.family === 'two' && TWO_HAND_GRIP[cls] != null && req.frame) {
    const haf = hafHand(req, req.grip, req.frame, TWO_HAND_GRIP[cls], A, { shoulder: frames.shoulder.L, reach: body.arms.L, range: TWO_HAND_HAFT[cls] });
    if (haf) out.L = { ...haf, w: armW.L, pole: norm([-0.55, -0.2, -0.75]) };
  } else if (bp.family === 'one' && cls === 'one' && bp.off) {
    const F = { right: frames.right, fwd: frames.fwd, up: frames.up };
    const limb = body.bones[other];
    const a = len(sub(mats.get(limb.fore).t, mats.get(limb.upper).t)), b = len(sub(mats.get(limb.hand).t, mats.get(limb.fore).t));
    const arm = armByAngles(other, frames.shoulder[other], F, a, b, { flex: bp.off[0], abduct: bp.off[1], elbow: bp.off[2], twist: 6 });
    const inward = scale(F.right, other === 'R' ? -1 : 1);
    out[other] = { at: arm.wrist, fingers: norm(arm.fore), palm: norm(inward), pole: arm.pole, w: armW[other] };
  }
  return out;
}
