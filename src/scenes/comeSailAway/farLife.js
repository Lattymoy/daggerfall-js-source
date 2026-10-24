// @ts-check
// BOAT-FAR (2026-10-21; bible/07-Rendering/Performance-Priority.md BOAT-FAR) - A SHIP'S LIFE BY HER RANGE, ONE LAW.
//
// AUDIT NAV1 (the presentation, #17) gave the sea's ships this law in scenes/naval/navalHost.js poseShip: past
// NEAR_LIFE_M of the eye her rigging steps every FAR_LIFE_EVERY frames with the time it missed. A player's profile
// (2026-10-21) found every boat the Come Sail Away pool draws - mine, the peers' and the sea's - walked, baked and lit
// every frame wherever she was, and every peer's boat's Animators stepped every frame at any range
// (scenes/comeSailAway/comeSailAwayPool.js frame, scenes/comeSailAway/comeSailAwayPeers.js pose). The three read the
// law here, so it is one: the constants (navalHost re-exports them, where they were born) and the step. The EYE is each
// reader's own (its audit): poseShip's the frame's view (navalHost's `deps.look().origin`, the camera over the
// shoulder too, or the feet with no look), the pool's the playerPosition its frame is handed (scenes/world.js:
// `player.pos`), the peers' the pool's last - so where the camera stands apart from the player, a sea ship and a boat
// at one range are judged from eyes as far apart. One eye for all three is the host's to hand the pool.
//
// BOAT-OWN (2026-10-21, the record's Left: "my own boats' Animators ... still stepped every frame"): my own boats'
// Animators and particle systems, which the Come Sail Away runtime stepped every frame at any range
// (systems/comeSailAway/comeSailAway.js animate, simulateParticles), live by it too, through createBoatLives below - the
// runtime wires it and grows nothing. And A SHIP'S TREE (farTreeStep): one reshaped or switched since she last lived
// lives this frame, whatever her range - the pool's held walk (its audit) and the Animators of hers and the peers' read
// it alike.
import { prefabShapeStamp, prefabSwitchStamp } from '../../world/prefabNode.js';
import { boatAnimators, boatParticleSystems } from '../../systems/comeSailAway/comeSailAwayBoat.js';

/** AUDIT NAV1 (the presentation, #17): HER RIGGING'S LIFE BY HER RANGE - past NEAR_LIFE_M of the eye a ship's animators
 *  and particle systems step every FAR_LIFE_EVERY frames with the time they missed: her sails' billow and her flag's
 *  wisps are too small to see there, and the traffic sits 650-1900 m out (five far war galleys cost 5.7 ms a frame on
 *  the CPU, their rigging stepped as a near one's). BOAT-FAR: and the pool's walk, bakes and lanterns of every boat it
 *  draws, and the peers' boats' Animators, by the same law. */
export const NEAR_LIFE_M = 600;
export const FAR_LIFE_EVERY = 4;

/** A ship's place in the law: `lifeN` her frame of the stride (`n`'s, so ships built one after another step on
 *  frames of their own), `lifeDt` the time she has missed. A sea entry of navalHost's carries the two itself.
 *  BOAT-OWN: `shape` and `on` her tree's stamps when she last lived (farTreeStep's - none yet). */
export const farLife = (n) => ({ lifeN: n % FAR_LIFE_EVERY, lifeDt: 0, shape: -1, on: -1 });

/**
 * One frame of the law for one ship: within NEAR_LIFE_M of the eye on the ground plane (or no eye, or nowhere to stand
 * her - `pos` null) she lives this frame; past it, one frame in FAR_LIFE_EVERY, on her own frame of the stride.
 * @param {{ lifeN: number, lifeDt: number }} life - her record (farLife), written
 * @param {number} dt - this frame's time
 * @param {ArrayLike<number> | null} pos - where she stands
 * @param {ArrayLike<number> | null} eye - the eye her range is read from
 * @returns {number | null} the time to step her by - this frame's and every one she missed since she last lived - or
 *   null: she is held this frame
 */
export function farLifeStep(life, dt, pos, eye) {
  life.lifeDt += dt;
  if (eye && pos && Math.hypot(pos[0] - eye[0], pos[2] - eye[2]) > NEAR_LIFE_M && (life.lifeN = (life.lifeN + 1) % FAR_LIFE_EVERY) !== 0) return null;
  const lived = life.lifeDt;
  life.lifeDt = 0;
  return lived;
}

/**
 * BOAT-OWN: one frame of the law for a ship's TREE. What her life steps - her walk's nodes (the pool's), which of her
 * Animators run (one switched off does nothing; switched on it starts over from its default state, world/unityAnimator.js)
 * and which of her particle systems - stands while her tree's shape and its switches do (world/prefabNode.js
 * prefabShapeStamp, prefabSwitchStamp). One reshaped or switched since she last lived lives this frame, whatever her
 * range - so a far ship switched on or off (UpdateBoatVisibility: a peer's look 'hidden', my boats as I go in and out),
 * her helm taken, a sea ship's sails set, is never held up to three frames in what she was. Else farLifeStep.
 * @param {{ lifeN: number, lifeDt: number, shape: number, on: number }} life - her record (farLife), written
 * @param {number} dt - this frame's time
 * @param {any} root - her top node (her GameObject)
 * @param {ArrayLike<number> | null} pos - where she stands (null: nowhere to judge her - she lives)
 * @param {ArrayLike<number> | null} eye - the eye her range is read from
 * @returns {number | null} farLifeStep's
 */
export function farTreeStep(life, dt, root, pos, eye) {
  const shape = prefabShapeStamp(root), on = prefabSwitchStamp(root);
  const lived = farLifeStep(life, dt, life.shape === shape && life.on === on ? pos : null, eye);
  life.shape = shape; life.on = on;   // held, she stood at both already: only a ship whose stamps read as kept is judged by range
  return lived;
}

/**
 * BOAT-OWN: MY OWN BOATS' LIVES - the Come Sail Away runtime's Animators and particle systems (its LateUpdate's animate
 * and simulateParticles), by the far law: a boat past NEAR_LIFE_M of the eye steps them one frame in FAR_LIFE_EVERY on
 * the time she missed, each boat on her own frame of the stride; one reshaped or switched since she last lived, or with
 * no eye to judge her by, lives every frame. `eye()` the pool's last frame's (comeSailAwayPool.js lifeEye - the peers'
 * boats read the same). A boat standing nowhere is still asked when she lives (SEA-TOWN AWAY: an Animator asked while
 * its object is inactive notes it, so it starts over when she stands again - her switch lives her that frame).
 * @param {{ eye?: () => ArrayLike<number> | null }} [deps]
 */
export function createBoatLives({ eye = () => null } = {}) {
  /** boat -> her place in the law, and the time she lived by this frame (null: held) */
  const lives = new WeakMap();
  let seq = 0;
  return {
    /** The Animators, one frame (after every Update, before every LateUpdate, as Unity steps them): each boat's life
     *  this frame decided, and those that live stepped on the time they lived by. */
    animate(boats, dt) {
      const at = eye();
      for (const boat of boats) {
        let life = lives.get(boat);
        if (!life) { life = { ...farLife(seq++), lived: null }; lives.set(boat, life); }
        const root = boat.GameObject;   // SpawnBoat's 'Boat', hung under nothing: her local place is where she stands
        life.lived = farTreeStep(life, dt, root, root.localPosition, at);
        if (life.lived !== null) for (const a of boatAnimators(boat)) a.update(life.lived);
      }
    },
    /** Then the particle systems (PreLateUpdate's ParticleSystemBeginUpdateAll), on the time each boat lived by this
     *  frame's `animate` - none for a boat it held. */
    particles(boats) {
      for (const boat of boats) {
        const lived = lives.get(boat)?.lived ?? null;
        if (lived !== null) for (const system of (boat.particleSystems ??= boatParticleSystems(boat))) system.step(lived);
      }
    },
  };
}
