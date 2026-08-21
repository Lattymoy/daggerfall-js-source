// ATTACKS FOR BODIES WITH NO ARMS.
//
// enemyAttack.js is a verbatim port of DFU's timing — the melee timer,
// the reversed speed comparison, the 22.5 degree yaw gate, the 2.25
// reach — and it drives the shared weaponStates machine, so a bear and a
// knight attack on exactly the same clock. That part is done.
//
// WHAT IT PLAYS IS THE PROBLEM. Its own comment says "our rigs play the
// authored 1H strike clips", which are ARM animations. Fifty-two enemies
// have arms to swing. Nine do not: the rat, the bear, the tiger, the
// spider, the scorpion, the bat, the slaughterfish and both dragonlings
// collapse their arm groups to a POINT, so a strike clip animates a
// point. The timer fires, the hit lands, the damage applies, and nothing
// visibly happens — a bear that mauls you without moving.
//
// SO THE MOTION BELONGS TO THE BODY PLAN, and for these nine the body IS
// a piece. There are no joints to turn: the whole animal moves, which is
// what an animal without shoulders actually does.
//
// THE TIMING IS NOT INVENTED. Every enemy carries
// `primaryAttackAnimFrames` in ENEMY_BASICS — 29 distinct patterns
// across the roster, with -1 marking the frame the hit lands on. So a
// clip here is a curve over that frame list, peaking where the game
// already says the blow connects, and a slaughterfish that carries TWO
// -1 frames bites twice because the data says it does.

/** How an armless thing reaches you. */
export const BEAST_ATTACKS = Object.freeze({
  // Whole body forward and down, head leading, weight over the front
  // legs. A cat and a rat do the same thing at different speeds.
  LUNGE: 'lunge',
  // Shorter and steeper: the body barely travels, the head drops. A
  // bear does not lunge, it stands and swats downward.
  MAUL: 'maul',
  // Forward and level, no drop — a fish has nowhere to drop to.
  BITE: 'bite',
  // The body rears back so the tail can come over the top.
  STING: 'sting',
  // Down and forward at once, then away: a flyer does not stop to hit
  // you, and one that hovers to bite reads as a wasp on a string.
  SWOOP: 'swoop',
});

/**
 * The curve for one attack kind at a point in the clip.
 *
 * @param {string} kind one of BEAST_ATTACKS
 * @param {number} t 0..1 across the whole clip
 * @param {number} hit 0..1, where in the clip the blow lands
 * @returns {{z:number, y:number, pitch:number, roll:number}}
 *   z     forward travel, in body units
 *   y     rise or drop
 *   pitch nose down is positive
 *   roll  a lean, for the ones that turn into it
 */
export function beastAttackPose(kind, t, hit = 0.45) {
  // WIND UP, STRIKE, RECOVER — and the strike lands ON the hit frame
  // rather than somewhere near it. Before the hit the motion is a
  // gathering: slow, and back rather than forward. After it, a recovery
  // that takes longer than the strike did, because everything that
  // lunges has to get its weight back.
  const wind = hit <= 0 ? 0 : Math.min(1, Math.max(0, t / hit));
  const past = t <= hit ? 0 : Math.min(1, (t - hit) / Math.max(0.05, 1 - hit));
  // Gather: eases back and out. Strike: snaps to full at the hit.
  const gather0 = Math.sin(wind * Math.PI * 0.5) ** 2;
  const strike = t <= hit ? gather0 : 1 - Math.sin(past * Math.PI * 0.5) ** 1.4;
  // THE GATHER HAS TO UNWIND TOO. It held at full through the recovery,
  // so every clip ended a little behind where it started — a lunge left
  // the animal 0.08 back, and after three attacks it is standing
  // somewhere else. It fades out with the strike.
  const gather = t <= hit ? gather0 : gather0 * (1 - past);

  switch (kind) {
    case BEAST_ATTACKS.MAUL:
      return { z: strike * 0.1 - gather * 0.04, y: -strike * 0.05 + gather * 0.06, pitch: strike * 0.5 - gather * 0.18, roll: 0 };
    case BEAST_ATTACKS.BITE:
      return { z: strike * 0.22 - gather * 0.06, y: 0, pitch: strike * 0.16, roll: strike * 0.1 };
    case BEAST_ATTACKS.STING:
      // Rears BACK as it strikes: the tail does the reaching, so the
      // body's job is to get out of its way.
      return { z: -strike * 0.1, y: strike * 0.07, pitch: -strike * 0.42 + gather * 0.05, roll: 0 };
    case BEAST_ATTACKS.SWOOP:
      return { z: strike * 0.34 - gather * 0.1, y: -strike * 0.2 + gather * 0.12, pitch: strike * 0.3, roll: strike * 0.22 };
    case BEAST_ATTACKS.LUNGE:
    default:
      return { z: strike * 0.28 - gather * 0.08, y: -strike * 0.07 + gather * 0.03, pitch: strike * 0.34 - gather * 0.1, roll: 0 };
  }
}

/**
 * Where the hit lands in a clip, from the game's own frame list.
 *
 * `primaryAttackAnimFrames` marks the connecting frame with -1. A
 * slaughterfish carries TWO of them and bites twice; taking the first is
 * correct for the pose peak, and the second is the game's business.
 */
export function hitPointOf(frames) {
  if (!Array.isArray(frames) || !frames.length) return 0.45;
  const i = frames.indexOf(-1);
  if (i < 0) return 0.45;
  return i / (frames.length - 1);
}

/** How many times a clip connects: a slaughterfish bites twice. */
export function hitCountOf(frames) {
  if (!Array.isArray(frames)) return 1;
  const n = frames.filter((f) => f === -1).length;
  return Math.max(1, n);
}
