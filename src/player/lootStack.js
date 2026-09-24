// @ts-check
// LOOT-STACK (2026-09-23, the community arc - Janome on Discord: "a toggle key to switch between the inventories of
// enemies stacked on top of each other"): THE PILE OF BODIES, AND ONE LOOT WINDOW OVER ALL OF IT.
//
// Three foes cut down in one doorway leave three bodies in one place, and DFU's one ray (PlayerActivate.cs:314) has
// one hit: the NEAREST body. The two behind it could be reached only by emptying the one in front - and a body left
// holding what the player does not want (a rusty dagger, a ruined cuirass) hid the others for good. Daggerfall Unity
// has no answer to this and no vendored mod carries one, so this is the port's own (Port-Ledger A, LOOT-STACK).
//
// THE LAW:
//   - THE STACK is the bodies the one ray passes through that the player can open from where they stand: the
//     nearest body (the pick's own winner) and, behind it on the same ray, each body inside its OWN reach - the
//     corpse's CorpseActivationDistance, the handler's gate (:936-941). A body beyond reach is no member: a tab onto it
//     would only earn "You are too far away". The nearest body out of reach is a stack of one, as it always was.
//   - THE PICK IS THE NEAREST, always. The ray answers the front body exactly as DFU's does, and everything that
//     races the pile - the player's own drops, a torch, a door, a person, a foe (player/activationRace.js) - races it
//     as it always did. The pick only NOTES the stack it stood, for the window to read.
//   - THE WINDOW HOLDS THE PILE (Mac, 2026-09-23: "that solution is better than a keybind"). A press on the front
//     body opens its loot window with a TAB for each body in the stack that still holds something, and a tab opens
//     that body's window in its place, through the host's own corpse door - so each body keeps everything its own
//     open and close carry (the empty body's refusal, the room's claim and word, the emptied flat). The first slice
//     turned the pile with a key (`]`) before the press; that key is gone, because a tab says what is there and a
//     key had to be learned.
//
// WHERE IT LIVES: player/activate.js pickActivatableHit notes the stack, so every reader of the ray - the four hosts'
// presses, the plaque that counts the pile - reads the one stack the one pick stood. The hosts name nothing: a target
// is a BODY because its producer says so (`body: true` - scenes/corpseMarker.js corpseLootTargets
// for the two surface pools, the dungeon context's own mint), so a list with no body in it is untouched.
//
// The tabs are drawn by the windows (ui/enhancedInventory.js remoteCol, ui/nativeInventory.js's target icon), so a
// phone, which never had a key to turn with, has the pile as well.

/** @typedef {{ key: string, distance: number, reach: number }} RayPick */
/** @typedef {{ key: string, body?: boolean }} StackTarget */

let _seen = /** @type {string[]|null} */ (null);   // the last stack a pick stood, nearest first

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
 * THE PICK NOTES ITS PILE: the ray's nearest hit is answered unchanged, and the stack it stands at the front of is
 * kept for the window and the plaque. A list with no body in it is not a question about bodies and leaves the note
 * alone (the hosts cast several picks a frame, over several lists); a list WITH bodies whose winner is none of them -
 * or a lone body - clears it.
 * @param {RayPick|null} first
 * @param {StackTarget[]} targets
 * @param {(targets: StackTarget[]) => RayPick|null} nearest
 * @returns {RayPick|null}
 */
export function noteBodyStack(first, targets, nearest) {
  if (!Array.isArray(targets) || !targets.some(isBody)) return first;
  const front = first && targets.some((t) => isBody(t) && t.key === first.key) ? first : null;
  const stack = front ? bodyStack(front, targets, nearest) : [];
  _seen = stack.length < 2 ? null : stack.map((h) => h.key);
  return first;
}

/** The pile `key` stands at the FRONT of, nearest first - `[key]` for a body alone. Read by the host's corpse door
 *  at the press, which is where the pick that noted it was cast. */
export function bodyPile(key) {
  return _seen && _seen[0] === key ? [..._seen] : [key];
}

/**
 * THE PILE, AS THE LOOT WINDOW'S TABS - or null for a body alone.
 *
 * `keys` is the pile the first window was opened over, carried from tab to tab so the tabs do not move under the
 * player's hand; `describe(key)` is the pool's word on a body - `{ name, count }` for one this client can open (its
 * own, enabled, holding something), null for any other - and the body the window is open on always stands, whatever
 * it holds now. `open(key, keys)` is the host's corpse door, handed the pile again. A tab onto the body already open
 * does nothing.
 * @param {string} key
 * @param {{ keys?: string[]|null, describe: (key: string) => ({ name: string, count: number }|null), open: (key: string, keys: string[]) => void }} o
 * @returns {{ bodies: { key: string, name: string, count: number }[], current: string, open: (key: string) => void }|null}
 */
export function lootPile(key, { keys = null, describe, open }) {
  const all = keys ?? bodyPile(key);
  const bodies = [];
  for (const k of all) {
    const d = describe(k);
    if (d || k === key) bodies.push({ key: k, name: d?.name ?? '', count: d?.count ?? 0 });
  }
  if (bodies.length < 2) return null;
  return { bodies, current: key, open: (k) => { if (k !== key && bodies.some((b) => b.key === k)) open(k, all); } };
}

/** How many bodies the pile under `key` holds, for the plaque's mark - null for a body alone or no body. */
export function bodyStackMark(key) {
  return _seen && _seen.includes(key) ? { count: _seen.length } : null;
}

/** Freed with the host that raised it (ui/worldPlaque.js destroyWorldPlaque, beside quick loot's): the note is ABOUT
 *  bodies in a world a teardown is unmaking. */
export function resetBodyStack() { _seen = null; }

/** For tests: the state, read. */
export const _bodyStackStateForTests = () => ({ seen: _seen ? [..._seen] : null });
