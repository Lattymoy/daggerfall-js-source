// @ts-check
// COME SAIL AWAY - ANOTHER PLAYER'S BOAT, BOARDED (CSA-K, SAIL-TOGETHER, 2026-09-28; the player's ask: "I want people
// to be able to sail together, to walk on board as it moves"). The mod is single-player: its boats carry their own
// player at the helm and nobody else, and online another player's boat was a thing to see (CSA-J) - no deck to stand
// on. Here it is one to stand on, and to be carried by while its owner sails:
//
// - ABOARD. A player comes aboard another's boat by its own ladder - BoardBoat (112401) answers on it as on one's own:
//   stood at the board position, facing its forward, set on its deck (systems/comeSailAway/comeSailAway.js boardPlaceOf) - or by
//   landing on its deck from above (off a pier, a jump, a fall): the ray down from the body's centre - the riders' own
//   ray (FixedUpdate casts each rider's height down from its centre), CSA_ABOARD_BELOW longer so a fall is met before
//   it lands - meeting the boat's colliders no higher than a step over the feet. A swimmer is never taken aboard by the
//   ray (inside a hull the ray meets its floor from within): the ladder is the way up out of the water, as in the mod.
// - HER DECK STANDS FOR EVERYONE (FIELD BUGS 2026-10-01b, Mac: "Players aren't colliding with other players' boats and
//   can't stand on board" - PR-WAGON1's "Others' wagons don't block" set aside for boats): its colliders stand in every
//   player's collider as their own boats' do, aboard it or not (the host's csaSyncColliders); standing on it is aboard.
// - CARRIED. Each frame, once the peers' boats are posed, the one aboard is carried by their boat's move - its root's
//   pose before the frame and after (scenes/comeSailAway/comeSailAwayPeers.js moveOf): the feet kept at their place on the deck and
//   the facing turned with the boat about up (carriedPoint and yawDelta, the helm's own law for its child), in the air
//   over the deck too (a jump on a moving deck comes down where it left it) - and never across a jump of the boat's (a
//   snap, a boat rebuilt), which puts them off.
//   Aboard is the motor standing on the boat, or in the air over its deck: a body standing on anything else (a pier
//   over a moored boat, the shore under its bow) is not aboard, and is never dragged away by the boat's going.
// - OFF. Walking or jumping off its side (the ray meets nothing of it and the motor stands on nothing of it), standing
//   on something else, swimming, the boat gone (packed, its owner gone from the room, a clear) or the host's own
//   leaving (a transition, a fast travel, a death, the mod off) puts them off at once, its colliders standing on; the motor
//   falls or swims as ever. The ladder's first frames are its own (CSA_ABOARD_GRACE): the body stands on the deck only
//   once the motor has stepped there.
// - SEEN ON THE DECK. My place aboard - whose boat, which of theirs, and my feet in its own frame - rides my foes frame
//   as `ab`, a word only when it changes (standing still on a moving deck says nothing). Every reader stands me on their
//   own copy of that boat at that place (`glue`): its owner on the boat they sail, the others on the one they lead - so
//   the deck I walk is the deck they see me on, never a stride behind it. The owner law is the boats' own: a word
//   replaces the sender's alone, a sender gone or quiet past the stale time takes theirs, a clear takes everyone's.
import { raycastColliders, invertAffine } from '../../world/prefabColliders.js';
import { carriedPoint, yawDelta, activationModelOf, boardPlaceOf } from '../../systems/comeSailAway/comeSailAway.js';
import { mat4FromQuatPosScale, quatMultiply, quatRotate } from '../../world/quat.js';
import { CSA_WIRE_BOATS_MAX } from '../../systems/comeSailAway/comeSailAwayWire.js';

/** How far under the feet a deck is met (the ray runs from the centre, half a height more). */
export const CSA_ABOARD_BELOW = 3;
/** A deck no higher than this over the feet is under them - a step's rise (the controller's stepOffset, 0.3 in DFU's
 *  PlayerMotor's prefab); anything higher stands in the body, not under it. */
export const CSA_ABOARD_STEP = 0.3;
/** A boat whose root stands farther than this on the ground plane is not asked (the Large Galley's reach, and some). */
export const CSA_ABOARD_NEAR = 60;
/** The frames the ladder's placing is trusted before the motor has stood on the deck (the swim's flag and the ground
 *  are the step before it). */
export const CSA_ABOARD_GRACE = 2;
/** How fast a reader's place for a passenger follows their word, per second (the team's ease). */
export const CSA_ABOARD_EASE = 12;
/** The biggest a place on a deck can be from its boat's root, each way (the door's bound). */
export const CSA_ABOARD_LOCAL_MAX = 100;
/** The words' change key and precision: centimetres. */
const r2 = (v) => { const x = Math.round(v * 100) / 100; return x === 0 ? 0 : x; };
const DOWN = [0, -1, 0];

/** A root's pose as its matrix (its position and rotation; a boat's root has no scale). */
export const poseMatrix = (pose) => mat4FromQuatPosScale(pose.rotation, pose.position, [1, 1, 1]);
/** A point in a root's own frame. */
export function localOf(pose, p) {
  const inv = invertAffine(poseMatrix(pose));
  if (!inv) return null;
  return [inv[0] * p[0] + inv[4] * p[1] + inv[8] * p[2] + inv[12], inv[1] * p[0] + inv[5] * p[1] + inv[9] * p[2] + inv[13], inv[2] * p[0] + inv[6] * p[1] + inv[10] * p[2] + inv[14]];
}
/** A point of a root's own frame in the world. */
export function worldOf(pose, l) {
  const m = poseMatrix(pose);
  return [m[0] * l[0] + m[4] * l[1] + m[8] * l[2] + m[12], m[1] * l[0] + m[5] * l[1] + m[9] * l[2] + m[13], m[2] * l[0] + m[6] * l[1] + m[10] * l[2] + m[14]];
}
const rootPose = (boat) => ({ position: boat.GameObject.position, rotation: boat.GameObject.rotation });
/**
 * FIELD BUGS 2026-09-29 (the sea) #1 ("The player sprite doesnt seem mounted to the deck when the ship moves around"):
 * THE FRAME A PLACE ABOARD IS STOOD IN - her root's, carried by her deck's bob. Come Sail Away rocks a boat by her
 * MeshObject's localRotation (LateUpdate's bob, from rest at her MeshObject's own place), never her root's: the hull, its
 * colliders, the helm and every deck hang under it. A place is said in the root's frame at rest (the words' law, kept)
 * and stood where the deck's bob carries it now - her MeshObject's place, plus the bob turning the rest of the way - so a
 * passenger rides the deck that rolls and pitches under them on its owner's screen, where they had kept their place
 * while it moved tens of centimetres at a big hull's ends. A copy that never rocks (a peer's boat: its root alone is
 * posed) answers her root's own pose: nothing changes there. `root` the root's pose to carry (one ahead of hers), else
 * hers. worldOf(deckPose(boat), l) = root x (m + Q (l - m)): m her MeshObject's place in her root (under the mod's
 * replacement node between them), Q her bob as the root's frame turns it.
 * @returns {{ position: number[], rotation: number[] }}
 */
export function deckPose(boat, root = rootPose(boat)) {
  const mo = boat?.MeshObject;
  if (!mo || mo === boat.GameObject) return root;
  const bob = mo.localRotation;
  if (bob[0] === 0 && bob[1] === 0 && bob[2] === 0) return root;   // at rest (a copy): the root's frame itself
  // the links between her root and her MeshObject (the mod's replacement node), composed down from the root
  const links = [];
  let n = mo.parent;
  for (; n && n !== boat.GameObject; n = n.parent) links.push(n);
  if (!n) return root;   // not hung under her root: nothing of hers to carry
  let t = [0, 0, 0], q = [0, 0, 0, 1];
  for (let k = links.length - 1; k >= 0; k--) {
    const o = quatRotate(q, links[k].localPosition);
    t = [t[0] + o[0], t[1] + o[1], t[2] + o[2]];
    q = quatMultiply(q, links[k].localRotation);
  }
  // her MeshObject's place in the root (m) and her bob as the root's frame turns it (Q): l -> m + Q (l - m)
  const lm = quatRotate(q, mo.localPosition), m = [t[0] + lm[0], t[1] + lm[1], t[2] + lm[2]];
  const Q = quatMultiply(quatMultiply(q, bob), [-q[0], -q[1], -q[2], q[3]]);
  const qm = quatRotate(Q, m), o = quatRotate(root.rotation, [m[0] - qm[0], m[1] - qm[1], m[2] - qm[2]]);
  return { position: [root.position[0] + o[0], root.position[1] + o[1], root.position[2] + o[2]], rotation: quatMultiply(root.rotation, Q) };
}
/** A node's place in its boat's root frame AT REST - the chain from her root down to it composed in doubles, each link's
 *  position, rotation and scale, her MeshObject's rotation (the bob) left out - or null when it hangs under no root of
 *  hers. Exact whatever her pose and bob: no world matrix (a float's) is asked. */
function restPlace(boat, node) {
  const chain = [];
  let n = node;
  for (; n && n !== boat.GameObject; n = n.parent) chain.push(n);
  if (!n) return null;
  let t = [0, 0, 0], q = [0, 0, 0, 1], sc = [1, 1, 1];
  for (let k = chain.length - 1; k >= 0; k--) {
    const c = chain[k], p = c.localPosition;
    const o = quatRotate(q, [p[0] * sc[0], p[1] * sc[1], p[2] * sc[2]]);
    t = [t[0] + o[0], t[1] + o[1], t[2] + o[2]];
    if (c !== boat.MeshObject) q = quatMultiply(q, c.localRotation);
    sc = [sc[0] * c.localScale[0], sc[1] * c.localScale[1], sc[2] * c.localScale[2]];
  }
  return t;
}
/**
 * #1: THE HELMSMAN'S PLACE, said as a passenger's is. Only the others aboard said where they stood, so everyone else
 * drew a player at their own helm from their world pose - shown a send behind (net/online.js's lag) while their boat
 * is led AHEAD by its way (scenes/comeSailAway/comeSailAwayPeers.js): the helmsman trailed the wheel by their speed times a tenth to
 * a quarter second, metres at the helm's time scales. Their place is the helm's own - Come Sail Away pins the player's
 * transform to DrivePosition (the feet half a height under it) - at rest in her root's frame, where it never moves: one
 * word while they sail, none after, and every reader stands them at the wheel of the boat they draw.
 * @returns {[string, number, number, number, number] | null}
 */
export function helmWord(owner, slot, boat, height) {
  const drive = boat?.DrivePosition;
  if (typeof owner !== 'string' || !owner || !drive || !Number.isInteger(slot) || slot < 0 || slot >= CSA_WIRE_BOATS_MAX) return null;
  const l = restPlace(boat, drive);   // the helm at rest in her root's frame: her own chain, her bob left out
  if (!l) return null;
  l[1] -= (Number.isFinite(height) && height > 0 ? height : 1.8) / 2;   // the feet, half a height under the pinned transform
  if (!l.every((v) => Math.abs(v) <= CSA_ABOARD_LOCAL_MAX)) return null;
  return [owner, slot, r2(l[0]), r2(l[1]), r2(l[2])];
}

/**
 * A passenger's word through the door: `[owner, slot, x, y, z]` - a peer's id, one of their word's places, and the
 * feet in that boat's own frame within the bound. Anything else is null.
 * @returns {{ owner: string, slot: number, local: number[] } | null}
 */
export function validAboardWord(raw) {
  if (!Array.isArray(raw) || raw.length !== 5) return null;
  const [owner, slot, x, y, z] = raw;
  if (typeof owner !== 'string' || !owner || owner.length > 64) return null;
  if (!Number.isInteger(slot) || slot < 0 || slot >= CSA_WIRE_BOATS_MAX) return null;
  const local = [x, y, z];
  if (!local.every((v) => Number.isFinite(v) && Math.abs(v) <= CSA_ABOARD_LOCAL_MAX)) return null;
  return { owner, slot, local };
}

/**
 * @param {{ peers: any, geometry: (collider: any, node: any) => any, selfId?: () => (string | null) }} opts
 *   peers: scenes/comeSailAway/comeSailAwayPeers.js; geometry: the host's MeshCollider mesh reader (world.js csaColliderMesh)
 */
export function createComeSailAwayAboard({ peers, geometry, selfId = () => null }) {
  /** Where I stand aboard: the boat, its owner's place for it as last read, and the ladder's grace left. */
  /** @type {{ boat: any, owner: string, slot: number, grace: number } | null} */
  let aboard = null;
  /** The others aboard, by their id: { owner, slot, local (the word), shown (eased), at } */
  const riders = new Map();

  /** The deck under a body: the ray down from its centre meets the boat's own colliders (no trigger) no higher than a
   *  step over its feet. */
  function deckUnder(boat, feet, height) {
    const h = Number.isFinite(height) && height > 0 ? height : 1.8;
    const centre = [feet[0], feet[1] + h / 2, feet[2]];
    const hit = raycastColliders(boat.GameObject, centre, DOWN, h / 2 + CSA_ABOARD_BELOW, { triggers: false, geometry });
    return !!hit && hit.point[1] <= feet[1] + CSA_ABOARD_STEP;
  }
  const near = (boat, feet) => { const p = boat.GameObject.position; return Math.hypot(p[0] - feet[0], p[2] - feet[2]) <= CSA_ABOARD_NEAR; };

  function leave() { aboard = null; }
  /** Aboard `boat` - its ladder pressed (`grace` frames trusted before the motor stands there), or its deck landed on.
   *  False when it is no peer's boat that stands. */
  function board(boat, grace = 0) {
    const where = boat ? peers.placeOf(boat) : null;
    if (!where) return false;
    aboard = { boat, owner: where.owner, slot: where.slot, grace: Math.max(0, grace | 0) };
    return true;
  }

  /** On `boat` this frame: the motor stands on it, or stands on nothing and its deck is under the body. */
  const on = (boat, me) => { const g = me.ground(boat); return g === 'boat' || (g == null && deckUnder(boat, me.feet(), me.height)); };

  /**
   * One frame, after the peers' boats were posed: a carry for the one aboard, then whether they are still aboard -
   * or, not aboard, whether a deck is under them now.
   * @param {{ allowed: boolean, feet: () => number[], height: number, swimming: boolean,
   *           ground: (boat: any) => ('boat' | 'other' | null), carry: (delta: number[], yawDeg: number) => void }} me
   *   ground: what the motor stands on - that boat's colliders, anything else, or nothing (in the air, afloat)
   * @returns {any} the boat I stand aboard, or null
   */
  function frame(me) {
    if (!me.allowed) { leave(); return null; }
    if (aboard) {
      const where = peers.placeOf(aboard.boat);
      const move = where ? peers.moveOf(aboard.boat) : null;
      if (!where || !move) leave();   // the boat gone, rebuilt or jumped: nobody is carried across a teleport
      else {
        aboard.owner = where.owner; aboard.slot = where.slot;
        const before = poseMatrix(move.before), after = poseMatrix(move.after);
        const feet = me.feet();
        const to = carriedPoint(before, after, feet);
        const yaw = yawDelta(before, after);
        const delta = [to[0] - feet[0], to[1] - feet[1], to[2] - feet[2]];
        if (delta[0] || delta[1] || delta[2] || yaw) me.carry(delta, yaw);
        if (aboard.grace > 0) aboard.grace--;
        else if (me.swimming || !on(aboard.boat, me)) leave();
      }
    }
    if (!aboard && !me.swimming) {
      const feet = me.feet();
      for (const o of peers.shown()) {
        for (const s of o.boats) {
          if (!s?.boat?.GameObject?.activeSelf || !near(s.boat, feet)) continue;
          if (on(s.boat, me)) { board(s.boat); break; }   // FIELD BUGS 2026-10-01b: stood on - her colliders stand for everyone, as one's own boat's do, so a deck stepped, climbed or come up onto is aboard her - or landed on from above; never taken off anything else the body stands on
        }
        if (aboard) break;
      }
    }
    return aboard?.boat ?? null;
  }

  /** My word: `[owner, slot, x, y, z]` - my feet in the boat's own frame, at rest (#1: deckPose - a copy is) - or null. */
  function word(feet) {
    if (!aboard) return null;
    const l = localOf(deckPose(aboard.boat), feet);
    return l ? [aboard.owner, aboard.slot, r2(l[0]), r2(l[1]), r2(l[2])] : null;
  }

  // ── the others aboard ──
  /** A sender's word (null: aboard nothing) - kept against the sender, never my own. */
  function applyRider(from, raw, nowMs = 0) {
    if (typeof from !== 'string' || !from || from === (selfId?.() ?? null)) return false;
    if (raw == null) { riders.delete(from); return true; }
    const w = validAboardWord(raw);
    if (!w) { riders.delete(from); return false; }
    const had = riders.get(from);
    const same = had && had.owner === w.owner && had.slot === w.slot;
    riders.set(from, { owner: w.owner, slot: w.slot, local: w.local, shown: same ? had.shown : [...w.local], at: nowMs });
    return true;
  }
  /** A sender gone from the room, or quiet past staleMs, takes their place aboard with them. */
  function sweepRiders(alive, nowMs, staleMs = 0) {
    for (const [id, r] of [...riders]) if (!alive?.has?.(id) || (staleMs > 0 && nowMs - r.at > staleMs)) riders.delete(id);
  }
  function clearRiders() { riders.clear(); }
  /** How many of the others stand aboard an owner's place (the owner's pack refuses while any do). */
  const passengersOn = (owner, slot) => { let n = 0; for (const r of riders.values()) if (r.owner === owner && r.slot === slot) n++; return n; };

  /**
   * The others as drawn: each whose word stands them aboard a boat that stands here, on that boat at their eased place
   * - a copy of their drawn entry with the pose's feet replaced (converted to the pose's frame by `toWire`), and their
   * place on that deck beside it (`deck`, `deckKey`: #1's pace). The rest pass as they came. `poseOf` answers the
   * frame the words are stood in: the root's, carried by the deck's bob (deckPose).
   * @param {any[]} drawable - online.drawable()'s entries ({ id, shown })
   * @param {{ poseOf: (owner: string, slot: number) => ({ position: number[], rotation: number[] } | null),
   *           toWire: (p: number[]) => number[], dt: number }} host
   */
  function glue(drawable, { poseOf, toWire, dt }) {
    if (!riders.size) return drawable;
    const t = 1 - Math.exp(-CSA_ABOARD_EASE * Math.max(0, dt));
    return drawable.map((d) => {
      const r = d?.shown ? riders.get(d.id) : null;
      if (!r) return d;
      for (let k = 0; k < 3; k++) r.shown[k] += (r.local[k] - r.shown[k]) * t;
      const pose = poseOf(r.owner, r.slot);
      if (!pose) return d;
      const w = toWire(worldOf(pose, r.shown));
      // #1: and where on that deck - its frame's own place and whose deck - so a pace is read off the stride on the
      // deck (net/peer/peerPace.js), never off the deck's own way: a body standing on a moving deck stands
      return { ...d, shown: { ...d.shown, x: w[0], y: w[1], z: w[2], deck: [r.shown[0], r.shown[1], r.shown[2]], deckKey: `${r.owner}:${r.slot}` } };
    });
  }

  // ── the ray on another's boat ──
  /**
   * PlayerActivate's one ray on the peers' boats (their boxes are the mod's own, triggers taken): the nearest hit, its
   * box's registration (a box cut after its first ']'), or null. The static world nearer takes it (the host asks).
   * @returns {{ boat: any, owner: string, slot: number, hit: any, modelId: number | null, distance: number } | null}
   */
  function pick(eye, dir, reach) {
    let best = null;
    for (const o of peers.shown()) {
      for (const s of o.boats) {
        if (!s?.boat?.GameObject?.activeSelf) continue;
        const hit = raycastColliders(s.boat.GameObject, eye, dir, reach, { triggers: true, geometry });
        if (hit && (!best || hit.distance < best.distance)) best = { boat: s.boat, hit, distance: hit.distance };
      }
    }
    if (!best) return null;
    const where = peers.placeOf(best.boat);
    if (!where) return null;
    return { ...best, owner: where.owner, slot: where.slot, modelId: activationModelOf(best.hit.node?.name) };
  }

  return {
    frame, board, leave, word, pick,
    /** CSA-K: BoardBoat's place on a peer's boat - the node the ladder's trigger hangs beside. */
    boardPlace: (hit) => boardPlaceOf(hit.node),
    applyRider, sweepRiders, clearRiders, passengersOn, glue,
    get aboard() { return aboard ? { ...aboard } : null; },
    /** A probe's and the tests' reading: the others aboard, by id. */
    riders: () => [...riders].map(([id, r]) => ({ id, owner: r.owner, slot: r.slot, local: [...r.local], shown: [...r.shown] })),
  };
}
