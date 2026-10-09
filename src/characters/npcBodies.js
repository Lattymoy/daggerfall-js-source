// @ts-check
// MWNPC4 (2026-10-09, the MW-NPC arc's fourth slice - bible/04-Characters/Morrowind-NPCs.md section 9): THE NPC LANE.
//
// Every living actor the arc stands in a Morrowind body - a foe, the watch, a townsperson, a person in a building - is
// drawn the way an online peer already is (net/peerBodies.js): a `createFpArm()` rig built from a LOOK, posed off a
// POSE, budgeted by the laws PEER-CADENCE, WB9h and MW-CROWD proved on a crowd of players (the view cull and its turn
// lead, the skin budget, the distance cadence, the swap dwell, the spares, the linger, the range), skinned on the GPU
// (MWNPC1) and drawn in the body pass's one bind (MWNPC2). The family and the card table's regulars already ride that
// lane as synthetic peers (world/familyBodies.js); this is the same door for the NPCs, with three differences:
//
//   - THE NPCs' OWN CAPS. One PeerBodies of their own, under the tier the player chose on the Features page
//     (`mwNpcBodies`: Off, Near, All - NPC_BODY_TIERS), so a crowd of townsfolk never takes a body from a player and the
//     peers' eight stand as they stood. A tier change stands a new lane down and up.
//   - THE FALLBACK IS THE ACTOR'S OWN PICTURE. A peer without a body is drawn as a paperdoll or a class sprite; an NPC
//     without one is the classic billboard its host always drew. So the lane draws no doll: a host asks `has(lane, id)`
//     and draws its own billboard for every actor that answers false - an actor out of the cap, past the range, still
//     building, or refused.
//   - THE POSE IS THE ACTOR'S STATE, not a wire. `npcShown` maps what a host knows of an actor - its feet, its facing,
//     walking or running, its weapon drawn, its swings, its casts - onto the pose fields PeerBodies' `_arm` already
//     plays, and the two the wire never sends: `ht`, a hit count (the recoil, character.cpp refreshHitRecoilAnims) and
//     `dd`, the death (playRandomDeath) - see combat/fpArm.js `hurt`/`die`.
//
// The populations' adapters (which actor wears what - MWNPC5 onward) fill the actor; this module never reads a host.
import { PeerBodies, BODY_BUILD_GATE } from '../net/peerBodies.js';
import { getPref } from '../systems/uiPrefs.js';
import { isEnhanced } from '../systems/uiSkin.js';
import { morrowindDataCount, morrowindDataGeneration } from '../scenes/dataSource.js';

/** The lane's caps by the player's tier: the most bodies, the range they stand to (scene metres), the skins a frame,
 *  the spares kept. Off is no lane at all. Near stands the dozen nearest within a street's width; All two dozen across
 *  a square - each a rig at the PEER-CADENCE costs, GPU-skinned, in the one bind. */
export const NPC_BODY_TIERS = Object.freeze({
  off: null,
  near: Object.freeze({ max: 12, range: 30, skinBudget: 4, spareMax: 4 }),
  all: Object.freeze({ max: 24, range: 60, skinBudget: 8, spareMax: 8 }),
});
/** The tier a player who never chose stands under. */
export const NPC_BODIES_DEFAULT = 'near';

/** An actor's id among the body layers': its lane and its own id - never a relay id (the wire's ID_RE has no colon)
 *  nor a family member's (`fam:`). */
export const npcPeerId = (lane, id) => `npc:${lane}:${id}`;

const finite = (v) => (Number.isFinite(v) ? v : 0);
const count = (v) => (Number.isFinite(v) ? v | 0 : 0);

/**
 * The pose PeerBodies reads, off an actor's own state:
 *   feet [x,y,z], yaw (radians), moving, running, drawn (weapon out), swings (a count: each new one a blow), strike (the
 *   blow's POSE_STRIKES index), casts (a count: each new one a cast), castRange (the cast's range type - the rig's
 *   castSpell takes it as the wire's `cr`), hits (a count: each new one a recoil),
 *   dead (0 standing, else the death's roll + 1).
 * @param {any} a
 */
export function npcShown(a) {
  return {
    x: finite(a.feet[0]), y: finite(a.feet[1]), z: finite(a.feet[2]),
    yaw: finite(a.yaw), pitch: 0,
    mv: a.moving ? (a.running ? 2 : 1) : 0,
    wd: a.drawn ? 1 : 0,
    an: count(a.swings), as: count(a.strike),
    cn: count(a.casts), cr: count(a.castRange),
    ht: count(a.hits),
    dd: count(a.dead),
  };
}

const sceneOf = (/** @type {any} */ s) => [s.x, s.y, s.z];

/**
 * The lane, stood each frame between `begin` and `end` - `stand` every actor a population offers, `end` syncs the
 * bodies, the body pass `draw`s them, and the host asks `has` before it draws its own billboard.
 * @param {{ renderer: any, enabled?: () => boolean, generation?: () => number, tier?: () => string, createRig?: Function,
 *   now?: () => number, warn?: (m: string) => void, collider?: () => any, tiers?: Record<string, any> }} p
 */
export function createNpcBodies({ renderer, enabled = () => true, generation = () => 0, tier = () => NPC_BODIES_DEFAULT, createRig, now, warn, collider, tiers = NPC_BODY_TIERS }) {   // MWNPC5b: `tiers` a table of the caller's (a test's)
  /** @type {PeerBodies|null} */
  let bodies = null;
  let standing = null;   // the tier the lane stands under
  /** @type {any[]} */
  const peers = [];
  // MWNPC5b: what a host knows of an actor beyond its pose, by its lane id - the concealment its billboard would have
  // drawn (ECV1), its hit flash, its tells (characters/foeBodies.js foeFx) and whether it is dead (the living stand
  // first: PeerBodies' priority) - one record an actor, rewritten each frame
  /** @type {Map<string, { conceal: any, flash: number, fx: any, dead: boolean, frame: number }>} */
  const info = new Map();
  let frame = 0;
  const seen = (id) => info.get(id);   // read for the actors offered this frame (the sync's) and the bodies standing (the draw's) - a lingering body is not drawn
  const syncOpts = { priority: (id) => !seen(id)?.dead, conceal: (id) => seen(id)?.conceal ?? null };
  const flashOf = (id) => seen(id)?.flash ?? 0;
  const fxOf = (id) => seen(id)?.fx ?? null;
  const drawOpts = { proj: null, view: null, eye: null, flashOf, fxOf };
  const lane = () => {
    const t = tier();
    const want = Object.prototype.hasOwnProperty.call(tiers, t) ? t : NPC_BODIES_DEFAULT;   // an unknown tier stands under the default
    if (want !== standing) {
      bodies?.destroy();
      const limits = tiers[want] ?? null;
      bodies = limits ? new PeerBodies({ renderer, enabled, generation, limits, gate: BODY_BUILD_GATE, ...(createRig ? { createRig } : {}), ...(now ? { now } : {}), ...(warn ? { warn } : {}), ...(collider ? { collider } : {}) }) : null;
      standing = want;
    }
    return bodies;
  };
  return {
    /** A frame begins: nobody stands yet. */
    begin() {
      peers.length = 0;
      frame++;
      if (info.size > 256) for (const [id, r] of info) if (r.frame < frame - 1) info.delete(id);   // the long gone let go (a record an actor offered lately)
    },
    /**
     * One actor offered: `lane` its population ('foe', 'watch', 'folk', ...), `actor` { id, look, feet, yaw, moving,
     * running, drawn, swings, strike, casts, castRange, hits, dead }. An actor with no look or no feet is not offered.
     * MWNPC5b: `conceal` the ECV1 visual its billboard would draw concealed (null: plain), `flash` its hit flash, `fx`
     * its tells (the quad's).
     * @param {string} laneName @param {any} actor @param {any} [conceal] @param {number} [flash] @param {any} [fx]
     */
    stand(laneName, actor, conceal = null, flash = 0, fx = null) {
      if (!actor?.look || !actor.feet) return;
      const id = npcPeerId(laneName, actor.id);
      peers.push({ id, name: '', told: true, look: actor.look, shown: npcShown(actor) });
      let r = info.get(id);
      if (!r) info.set(id, (r = { conceal: null, flash: 0, fx: null, dead: false, frame: 0 }));
      r.conceal = conceal; r.flash = flash > 0 ? flash : 0; r.fx = fx; r.dead = !!actor.dead; r.frame = frame;
    },
    /** The frame's actors to their bodies. @param {number} dt @param {number[]|null} eye */
    end(dt, eye) { lane()?.sync(peers, sceneOf, dt, eye, syncOpts); },
    /** Does this actor stand in a body - so its host draws no billboard for it? @param {string} laneName @param {any} id */
    has(laneName, id) { return !!bodies?.has(npcPeerId(laneName, id)); },
    /** The bodies, in the body pass (inside its batch - renderer.js beginCharacterSpriteBatch). @param {any} canvas @param {any} o */
    draw(canvas, o) {
      if (!bodies) return;
      drawOpts.proj = o.proj; drawOpts.view = o.view; drawOpts.eye = o.eye;
      bodies.draw(canvas, drawOpts);
    },
    /** MWNPC5b: the concealed ones, translucent - after the host's opaque world (PeerBodies drawVeiled). */
    drawVeiled() { bodies?.drawVeiled(); },
    /** The floating origin moved (the peer layers' law, AUDIT ONLINE D5). @param {number[]} o */
    offsetAll(o) { bodies?.offsetAll(o); },
    /** Everything let go (the place left, the lane switched off). */
    destroy() { peers.length = 0; info.clear(); bodies?.destroy(); bodies = null; standing = null; },
    /** How many actors were offered this frame. */
    get offered() { return peers.length; },
    /** The tier the lane stands under (after the last `end`). */
    get tier() { return standing; },
  };
}

/** MWNPC5b: is the lane wanted - the enhanced skin, Morrowind data attached, and the player's tier not Off (the
 *  Features row, `mwNpcBodies`)? A host asks each frame; false, it stands no lane and lets go of the one it had. */
export function npcBodiesOn() {
  return isEnhanced() && morrowindDataCount() > 0 && getPref('mwNpcBodies') !== 'off';
}

/** MWNPC5b: a host's lane - the gate, the data generation and the tier read as every host reads them. */
export function createHostNpcBodies({ renderer, collider = () => null }) {
  return createNpcBodies({ renderer, enabled: npcBodiesOn, generation: morrowindDataGeneration, tier: () => getPref('mwNpcBodies') ?? NPC_BODIES_DEFAULT, collider });
}
