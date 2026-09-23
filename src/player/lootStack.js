// @ts-check
// LOOT-STACK (2026-09-23, the community arc - Janome on Discord: "a toggle key to switch between the inventories of
// enemies stacked on top of each other"): THE PILE OF BODIES, AND WHICH ONE THE RETICLE MEANS.
//
// Three foes cut down in one doorway leave three bodies in one place, and DFU's one ray (PlayerActivate.cs:314) has
// one hit: the NEAREST body. The two behind it could be reached only by emptying the one in front - and a body left
// holding what the player does not want (a rusty dagger, a ruined cuirass) hid the others for good. Daggerfall Unity
// has no answer to this and no vendored mod carries one, so this is the port's own (Port-Ledger A, LOOT-STACK).
//
// THE LAW:
//   - THE STACK is the bodies the one ray passes through that the player can open from where they stand: the
//     nearest body (the pick's own winner) and, behind it on the same ray, each body inside its OWN reach - the
//     corpse's CorpseActivationDistance, the handler's gate (:936-941). A body beyond reach is no member: a turn to it
//     would only earn "You are too far away". The nearest body out of reach is a stack of one, as it always was.
//   - THE CHOICE is a body's KEY, not a position: two bodies at one distance trade places from frame to frame as the
//     player sways, and "the second one" would flicker between them. A choice the stack no longer holds (the player
//     looked away, the body was emptied and disabled) is forgotten, and the nearest answers again.
//   - THE CHOSEN BODY STANDS WHERE THE NEAREST STOOD. It is handed on at the nearest body's distance, because the
//     pile is ONE thing under the ray: everything that races it - the pile of the player's own drops, a torch, a door,
//     a person, a foe (player/activationRace.js; the merged lists' enemy arm) - races the pile as it always did, and
//     only WHICH body answers is the player's. A dropped sword lying between two stacked bodies cannot steal the
//     click the player turned to the second one for.
//   - A TURN is armed by its key (`NextBody`) and spent by the frame, where the ray is (the keydown has the key and
//     nothing else - systems/quickLoot.js's reason for arming rather than acting). It turns the stack the reticle's
//     WINNER stands in, so a turn with a door in front of the pile turns nothing: the press would open the door.
//
// WHERE IT LIVES: player/activate.js pickActivatableHit, so EVERY reader of the ray - the four hosts' presses, the
// plaque that names what a press would open, quick loot's take, the probes - answers with the chosen body at once,
// and none of them can disagree about which body the reticle means. The pick marks nothing and the hosts name
// nothing: a target is a BODY because its producer says so (`body: true` - scenes/corpseMarker.js corpseLootTargets
// for the two surface pools, the dungeon context's own mint), so a list with no body in it is untouched.
//
// NOT HERE: the touch skin. A tap's ray is the finger's (ui/worldPlaque.js worldPlaqueOn's note) and a phone has no
// key to turn with; the answer there is a turn inside the loot window, which is a later slice's.

/** @typedef {{ key: string, distance: number, reach: number }} RayPick */
/** @typedef {{ key: string, body?: boolean }} StackTarget */

let _chosen = /** @type {string|null} */ (null);   // the body the player turned to, by key
let _seen = /** @type {string[]|null} */ (null);   // the last stack a pick stood, nearest first - the turn's and the mark's
let _turns = 0;                                    // turns armed by the key and not yet spent by a frame

/** Is this target a body? Its producer's word, and nothing else. */
const isBody = (t) => !!t && t.body === true;

/**
 * THE STACK the nearest body stands at the front of: it, then every body behind it on the same ray that is inside
 * its own reach, nearest first. `nearest(targets)` is the ray's own nearest-hit pick over a narrowed list (the one
 * law activate.js holds - containment, the tie, occlusion by the world), so the members behind are found exactly as
 * the front one was.
 * @param {RayPick|null} first
 * @param {StackTarget[]} targets
 * @param {(targets: StackTarget[]) => RayPick|null} nearest
 * @returns {RayPick[]}
 */
export function bodyStack(first, targets, nearest) {
  if (!first) return [];
  // A front body out of reach needs no gate of its own: every body carries the one CorpseActivationDistance and the
  // front is the NEAREST, so the walk's first step is further still and stops there - a stack of one, which its
  // handler refuses ("You are too far away") as it always did.
  const out = [first];
  let rest = targets.filter((t) => isBody(t) && t.key !== first.key);
  while (rest.length) {
    const hit = nearest(rest);
    if (!hit || !(hit.distance <= hit.reach)) break;   // the next is beyond reach, and so is everything behind it
    out.push(hit);
    rest = rest.filter((t) => t.key !== hit.key);
  }
  return out;
}

/**
 * THE PICK'S LAST WORD: the ray's nearest hit, unless it is a body in a stack the player has turned - then the body
 * they turned to, standing at the nearest's distance. A list with no body in it is not a question about bodies and
 * leaves the choice alone (the hosts cast several picks a frame, over several lists); a list WITH bodies whose winner
 * is none of them - or a lone body - forgets it.
 * @param {RayPick|null} first
 * @param {StackTarget[]} targets
 * @param {(targets: StackTarget[]) => RayPick|null} nearest
 * @returns {RayPick|null}
 */
export function chooseBody(first, targets, nearest) {
  if (!Array.isArray(targets) || !targets.some(isBody)) return first;
  const front = first && targets.some((t) => isBody(t) && t.key === first.key) ? first : null;
  const stack = front ? bodyStack(front, targets, nearest) : [];
  if (stack.length < 2) { _chosen = null; _seen = null; return first; }
  _seen = stack.map((h) => h.key);
  const at = _chosen === null ? -1 : _seen.indexOf(_chosen);
  if (at < 0) _chosen = null;
  if (at <= 0) return first;
  return { key: stack[at].key, distance: first.distance, reach: stack[at].reach };
}

/** The key's half: a turn armed, for the next frame to spend. Always taken - a turn with no pile under the reticle
 *  is spent on nothing and says nothing. */
export function armBodyTurn() { _turns += 1; return true; }
/** Is a turn waiting for a frame? */
export const bodyTurnArmed = () => _turns > 0;
/** A window came up over the world: a turn armed before it must not land after it. */
export function dropBodyTurns() { _turns = 0; }

/**
 * THE FRAME'S HALF: spend the armed turns on the stack the reticle's winner stands in. `winner` is what this frame's
 * reticle pick answered - the chosen body when the pile won the race, anything else when it did not - and the stack
 * is the one that same pick stood. Answers `{ index, count }` for the body now chosen, or null when nothing turned.
 * @param {RayPick|null} winner
 * @returns {{ index: number, count: number }|null}
 */
export function turnBodyStack(winner) {
  const n = _turns;
  _turns = 0;
  if (!n || !winner || !_seen || _seen.length < 2) return null;
  const at = _seen.indexOf(winner.key);
  if (at < 0) return null;   // the pile did not win: a door, a person or a foe stands in front of it
  const next = (at + n) % _seen.length;
  _chosen = _seen[next];
  return { index: next, count: _seen.length };
}

/** What a turn says, in DFU's own mid-screen voice - the line a mode change speaks (PlayerActivate.cs:1424). */
export const bodyTurnText = ({ index, count }) => `Body ${index + 1} of ${count}.`;

/** Where `key` stands in the last stack a pick stood, for the plaque's mark - null for a body alone or no body. */
export function bodyStackMark(key) {
  if (!_seen || _seen.length < 2) return null;
  const index = _seen.indexOf(key);
  return index < 0 ? null : { index, count: _seen.length };
}

/** Freed with the host that raised it (ui/worldPlaque.js destroyWorldPlaque, beside quick loot's): a choice is ABOUT
 *  a body in a world a teardown is unmaking. */
export function resetBodyStack() { _chosen = null; _seen = null; _turns = 0; }

/** For tests: the state, read. */
export const _bodyStackStateForTests = () => ({ chosen: _chosen, seen: _seen ? [..._seen] : null, turns: _turns });
