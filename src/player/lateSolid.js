// @ts-check
// ═══════════════════════════════════════════════════════════════════
// DECOR-CLEAR (FIELD BUGS 2026-10-19f) — A LATE SOLID NEVER CLOSES ON A BODY.
//
// Two players' private reports: walking into an online home, its furniture
// moved and boxed them in; inside one, talking to its hired trader, a table
// stood round them and held them. Daggerfall Unity lays an interior out
// before the body stands in it - PlayerEnterExit.TransitionInterior runs
// interior.DoLayout ("This needs to be done first", PlayerEnterExit.cs:721)
// and only then sets the player to the landing and SetStanding
// (PlayerEnterExit.cs:794-795) -
// so no solid ever arrives where a body already is. The port's online home
// does not (DECOR1c, our own departure): the room stands as Daggerfall
// furnished it, its owner's pieces are asked of the account service after
// the entry and each is solid only once its model loads, and a piece of the
// room's own put back (BASE-HIDE) is solid again at once - wherever the
// player stands. The collider holds both faces of every triangle
// (player/collider.js), so a body a solid lands round is held by its inner
// walls, and a body under a low one is thrown onto its top.
//
// A LATE SOLID - triangles asked into a collider while a body walks in it -
// goes through this gate. Where it would close on the body
// (lateSolidCloses) it is WITHHELD: its owner still draws it, the collider
// does not hold it, and the body walks out of it as out of air; a settle
// that finds the body clear stands it, solid behind them. Anywhere else it
// stands at once, as it always did. ONE GATE A COLLIDER (lateSolidsOf):
// every late solid of one collider is held and let go by the same gate,
// whichever pool asked, and settled by the per-frame call that holds the
// body (the room's decor draw, scenes/decor/decorRoom.js) - which is how the
// gate knows the body it guards, so the room's own furniture put back
// (scenes/decor/decorBase.js) and any later solid need no body of their own.
//
// The body is the local player's, the one body this client's collider
// moves. Another player in the home walks on their own client, where their
// own gate holds the same piece back from them.
//
// ROCK-CLEAR (FIELD BUGS 2026-10-19f; the owner, 2026-10-19: "Apply to rocks
// too"): and the open world's. A pixel's statics - World of Daggerfall's
// rocks, mountains scaled by hundreds that reach past their own pixel, the
// town's models, its mills, the Hold's camp - go into ONE bucket a pixel,
// part by part as its build runs, each riding the floating origin (a
// translation provider, pixel-local triangles). A neighbour's mountain built
// round a body already standing is the same hole: so `add` takes the
// provider, a key holds as many parts as its bucket does (a withheld part
// is one of them, the rest stand), a bucket removed anywhere forgets its
// withheld parts with it (the collider's own removeBucket asks `forget`),
// and the guard may be a getter - read the moment a part is asked, so a
// jump whose landing is still building names no body and its pixel stands
// whole for the landing's own law (enterExit.js heldInSolid, openGroundNear).
// ═══════════════════════════════════════════════════════════════════

import { Collider, SKIN } from './collider.js';
import { CAPSULE_HEIGHT, CAPSULE_RADIUS } from './motor.js';
import { heldInSolid } from './enterExit.js';
import { localAabb, transformedAabb } from '../render/frustum.js';

/** The probe's one bucket - the late solid's own triangles, alone. */
const PROBE = 'late';
/** capsuleContact's answer, unread (a contact or none is all the law asks). */
const HIT = [0, 0, 0];

/** Whether a box [minX, minY, minZ, maxX, maxY, maxZ] meets the box about a body's capsule (`height` tall from `feet`). */
function boxMeetsBody(b, feet, height) {
  return b[0] <= feet[0] + CAPSULE_RADIUS && b[3] >= feet[0] - CAPSULE_RADIUS && b[1] <= feet[1] + height && b[4] >= feet[1]
    && b[2] <= feet[2] + CAPSULE_RADIUS && b[5] >= feet[2] - CAPSULE_RADIUS;
}

/**
 * DECOR-CLEAR: WHETHER A SOLID WOULD CLOSE ON A BODY - `probe` a Collider holding that solid's triangles alone, `body`
 * `{ pos, height }` (the motor's own: its feet and its capsule's height; CAPSULE_HEIGHT where it names none). Never one
 * whose box misses the capsule's (a piece hung wholly over the head, open beneath, holds nothing - though a line up
 * from the feet crosses its skin once). Else it does when one of its faces stands deeper in the capsule than the
 * resolve's skin (collider.js SKIN: a face the body rests on or leans against stands at the capsule's radius and holds
 * nothing, so a piece stood again under the feet still stands), or when the body's feet or head is inside one of its
 * closed parts (enterExit.js heldInSolid, the collider's parity law - deep in a big piece no face is near). Pure over
 * the probe's queries.
 * @param {Collider} probe @param {{ pos: number[], height?: number }} body
 */
export function lateSolidCloses(probe, body) {
  const height = body.height ?? CAPSULE_HEIGHT;
  const b = probe.bounds();
  if (!b || !boxMeetsBody([...b.min, ...b.max], body.pos, height)) return false;
  return probe.capsuleContact(body.pos, height, -SKIN, null, HIT) !== null || heldInSolid(probe, body.pos, height);
}


/** @typedef {{ pos: number[], height?: number }} LateBodyShape */
/** @typedef {LateBodyShape | (() => LateBodyShape | null | undefined) | null | undefined} LateBody a body, or a getter of one */

/** The body a guard names now - a getter read, a body as it is; none for none. @param {LateBody} b */
const bodyNow = (b) => {
  const now = typeof b === 'function' ? b() : b;
  return now?.pos ? now : null;
};

/** Each collider's gate, by the collider. @type {WeakMap<object, ReturnType<typeof makeGate>>} */
const GATES = new WeakMap();
/** ROCK-CLEAR: a model's own box, by its positions (one array a model, shared by every part that stands it). */
const LOCAL_BOX = new WeakMap();
const localBoxOf = (positions) => {
  let b = LOCAL_BOX.get(positions);
  if (!b) { b = localAabb(positions); LOCAL_BOX.set(positions, b); }
  return b;
};

/**
 * DECOR-CLEAR: THE ONE GATE a collider's late solids go through - made on the collider's first asking, gone with it
 * (null for no collider). THE BODY IT GUARDS is the one its settle was last handed - the caller that holds the body
 * settles it every frame - so a late solid of any owner needs no body of its own to be held back from it. ROCK-CLEAR:
 * a getter may stand for the body, read whenever the gate asks it (the world's: none while a jump is under way).
 *   add(key, positions, indices, matrix, { body, translation, sight }) - stand the triangles (meshReader buffers;
 *       `matrix` into the bucket's frame, `translation` the bucket's provider, `sight` its marks - addMesh's own
 *       arguments; FIELD BUGS 2026-10-25i SIGN-PASS: a shop's hung board, a ray's and no body's) as a PART of `key`'s
 *       bucket, beside any it holds: at once where the body is clear of them, else WITHHELD (answers false) - the
 *       key's other parts stand as they stood. `body` left out is the body the gate guards; `null`, or a gate that
 *       guards none (a bench, a test, a collider no body has walked, a jump's landing), stands it at once, as every
 *       solid always stood.
 *   replace(key, positions, indices, matrix, translation) - a key of one solid stood again where it stands now (a
 *       recentre): its bucket taken down, and the triangles stood at once - or, withheld, held still in its place, asked
 *       again at the next settle with the body where the recentre put it.
 *   remove(key) - the key's bucket taken down, and its withheld parts forgotten; forget(key) - the parts alone (the
 *       collider's own removeBucket asks it, so a bucket dropped anywhere - a pixel streamed out - takes them along).
 *   settle(body) - the body guarded from now; every withheld part it is clear of stands now. Answers how many. A settle
 *       handed no body asks the one it guards; none guarded, or a getter answering none, stands none (a body unknown is
 *       not a body clear).
 *   withheld(key), size() - whether `key` has parts held back; how many parts are.
 * @param {any} collider the collider (addMesh / removeBucket)
 */
export function lateSolidsOf(collider) {
  if (!collider || typeof collider !== 'object') return null;
  let gate = GATES.get(collider);
  if (!gate) {
    gate = makeGate(collider);
    GATES.set(collider, gate);
    if (collider instanceof Collider) collider.late = gate;   // ROCK-CLEAR: its removeBucket forgets a withheld part
  }
  return gate;
}

/** @param {any} collider */
function makeGate(collider) {
  /** @typedef {{ positions: ArrayLike<number>, indices: ArrayLike<number>, matrix: ArrayLike<number>, translation: any, sight: ArrayLike<number> | null, probe: Collider | null, box: number[] | null }} Part */
  /** @type {Map<string, Part[]>} */
  const held = new Map();
  /** @type {LateBody} the body the gate guards - its last settle's */
  let guarded = null;
  const partOf = (positions, indices, matrix, translation, sight = null) => ({ positions, indices, matrix, translation: translation ?? null, sight, probe: null, box: null });   // FIELD BUGS 2026-10-25i SIGN-PASS: `sight`, addMesh's - a ray's triangles, no body's
  /** The withheld part's own collider - made once, asked every settle until it stands; riding the bucket's own provider. */
  const probeOf = (h) => {
    if (!h.probe) { h.probe = new Collider(); h.probe.addMesh(PROBE, h.positions, h.indices, h.matrix, h.translation, null, false, h.sight); }   // SIGN-PASS: a hung board closes on no body
    return h.probe;
  };
  // the law, its box first: a town's yards stand two thousand pieces and a pixel a thousand parts, and one whose box (its
  // triangles' own, turned into its bucket's frame and moved by the bucket's translation - never smaller than theirs)
  // misses the body's needs no probe built to say so
  const BOX = [0, 0, 0, 0, 0, 0];
  const closes = (h, body) => {
    const b = h.box ??= transformedAabb(localBoxOf(h.positions), h.matrix);
    const t = h.translation ? h.translation() : null;
    for (let i = 0; i < 6; i++) BOX[i] = b[i] + (t ? t[i % 3] : 0);
    return boxMeetsBody(BOX, body.pos, body.height ?? CAPSULE_HEIGHT) && lateSolidCloses(probeOf(h), body);
  };
  const stand = (key, h) => collider.addMesh?.(key, h.positions, h.indices, h.matrix, h.translation, null, false, h.sight);
  return {
    /** @param {string} key @param {ArrayLike<number>} positions @param {ArrayLike<number>} indices @param {ArrayLike<number>} matrix @param {{ body?: LateBody, translation?: any, sight?: ArrayLike<number> | null }} [o] */
    add(key, positions, indices, matrix, { body = guarded, translation = null, sight = null } = {}) {
      const h = partOf(positions, indices, matrix, translation, sight);
      const now = bodyNow(body);
      if (!(now && closes(h, now))) { stand(key, h); return true; }
      const parts = held.get(key);
      if (parts) parts.push(h); else held.set(key, [h]);
      return false;
    },
    /** @param {string} key @param {ArrayLike<number>} positions @param {ArrayLike<number>} indices @param {ArrayLike<number>} matrix @param {any} [translation] */
    replace(key, positions, indices, matrix, translation = null) {
      const h = partOf(positions, indices, matrix, translation);
      const was = held.has(key);
      collider.removeBucket?.(key);
      if (was) held.set(key, [h]); else stand(key, h);
    },
    /** @param {string} key */
    remove(key) {
      held.delete(key);
      collider.removeBucket?.(key);
    },
    /** @param {string} key */
    forget(key) { held.delete(key); },
    /** @param {LateBody} body */
    settle(body) {
      if (typeof body === 'function' || body?.pos) guarded = body;
      const now = bodyNow(guarded);
      if (!held.size || !now) return 0;
      let n = 0;
      for (const [key, parts] of [...held]) {
        const left = parts.filter((h) => closes(h, now));
        for (const h of parts) if (!left.includes(h)) { stand(key, h); n++; }
        if (left.length) held.set(key, left); else held.delete(key);
      }
      return n;
    },
    /** @param {string} key */
    withheld: (key) => held.has(key),
    size: () => { let n = 0; for (const parts of held.values()) n += parts.length; return n; },
  };
}
