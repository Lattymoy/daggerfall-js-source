// @ts-check
// SENSE1 (the delve arc, 2026-10-05 - the player, on the dungeon blocks: "a way to detect interactables"): THE PULSE.
//
// Info mode is Daggerfall's examining stance, so ASKING for it underground (its key, the HUD's cycle, the pad's) is a
// look round: everything within SENSE_M of the eye, in plain sight, that the hover plaque would name if it were aimed
// at - a lever, a wheel, a door, a chest, a shelf, a body with something on it - is lit softly for SENSE_HOLD_S, in its
// kind's colour, by the professions' own glow (render/nodeGlow.js). The ask is counted where the press is read
// (player/interactionMode.js askInteractionMode), because ChangeInteractionMode is a no-op on the mode you are in and
// a second look round is still a look round.
//
// IT SHOWS NOTHING THE PLAQUE WOULD NOT SAY. The finds are the press's own list (the context's
// dungeonActivationTargets - the race the button runs) named by the plaque's own ladder (the context's namer, the
// World Tooltips arm asked as though the mod were on), so a pressure plate the mod silences (THE MULTITRIGGER RULE) and
// a main-quest puzzle its author hid (HideDefaultInteractTooltip) stay dark, and what lights is what a press would
// reach. The SECRETS tier adds the one thing no plaque names - a wall or a door that only a chain moves (a mover no
// trigger of its own reaches, at rest where it started) - in its own colour, opt-in, because that is new knowledge.
//
// AUDIT DELVE (bible/01-Overview/Audit-Delve.md): the round is one pure law (senseRound - the press's finds and the
// secrets merged, nearest first, one card a thing, the echo's found marks before them all); a secret is read off the
// action system's own TRIGGER_GATE; the four kinds differ in FORM as well as colour (SENSE_FORM - a protan or deutan eye
// could not tell a lever's glow from a chest's); and the budget and the pardon are the glow's and the pick's own.
//
// Not a DFU member. Pure but for the pulse's own state.

import { TRIGGER_FLAGS } from '../world/rdbLayout.js';   // DFBlock.RdbTriggerFlags has ONE home
import { TRIGGER_GATE, isActionDoorObject } from '../world/actionSystem.js';   // AUDIT DELVE A5: who a trigger admits, read where it is written
import { NODE_GLOW_MAX } from '../render/nodeGlow.js';   // AUDIT DELVE A4: the glow's own budget
import { PICK_PARDON_M } from '../player/activate.js';   // AUDIT DELVE C8: the pick's own pardon

/** How far a pulse reaches from the eye, to the nearest point of a thing's box (m). Two and a half door reaches. */
export const SENSE_M = 8;
/** How long what a pulse found stays lit (s), and the fade at the end of it. */
export const SENSE_HOLD_S = 6;
export const SENSE_FADE_S = 1.5;
/** The most things one pulse lights - the glow pass's own budget (render/nodeGlow.js NODE_GLOW_MAX), nearest first. */
export const SENSE_MAX = NODE_GLOW_MAX;
/** The prefs key (the `dungeon-sense` Features row, which holds its tiers: off / on / secrets). */
export const SENSE_PREF = 'dungeonSense';
/** The kinds and their colours (CSS hex - the glow's floats are derived): a thing to work, a way through, a find, a
 *  secret. AUDIT DELVE D6: colour alone did not tell them apart - under protan and deutan vision `use` and `find` are
 *  one pale yellow, and `door` and `secret` sit by fishing's blue and herbalism's violet (ui/nodeMarks.js) - so each
 *  kind has its own FORM too (SENSE_FORM). */
export const SENSE_CSS = Object.freeze({ use: '#ffe9a8', door: '#9cc8ff', find: '#7dff9a', secret: '#c48cff' });
/** AUDIT DELVE D6: each kind's form - the glow's three parts (render/nodeGlow.js: the halo, the shimmer climbing it,
 *  the motes rising out of it), each 0..1: a thing to work, the halo and its shimmer; a way through, a steady halo
 *  alone; a find, the motes - a treasure's glints - over a faint halo; a secret, the shimmer and a few faint motes, no
 *  body of light (a wall that is not quite a wall). A profession's node is all three, whole. */
export const SENSE_FORM = Object.freeze({
  use: Object.freeze([1, 1, 0]), door: Object.freeze([1.2, 0, 0]), find: Object.freeze([0.4, 0, 1]), secret: Object.freeze([0.25, 1.6, 0.35]),
});
const hexRgb = (hex) => { const n = parseInt(hex.slice(1), 16); return Object.freeze([((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]); };
export const SENSE_RGB = Object.freeze(Object.fromEntries(Object.entries(SENSE_CSS).map(([k, hex]) => [k, hexRgb(hex)])));
/** A card's least and most size (m): a lever is never a speck, a corridor piece never a wall of light. */
export const SENSE_CARD_MIN = 0.5;
export const SENSE_CARD_W_MAX = 2.4;
export const SENSE_CARD_H_MAX = 2.8;

/** The tier a stored value names; anything else is On (the row's initial). Pure. */
export const senseTier = (v) => (v === 'off' || v === 'secrets' ? v : 'on');

const FIND_PREFIXES = Object.freeze(['loot:', 'corpse:', 'search:', 'droppedLoot:', 'srch:']);
/**
 * A target's kind, by its key - the activation ladder's own vocabulary - and the plaque's word for it: an action
 * object the plaque calls a door (an action door's band) is a way through, as an exit is; the containers and the
 * bodies are finds; everything else that answers is a thing to work. Pure.
 * @param {string} key @param {string|null|undefined} title
 */
export function senseKind(key, title) {
  if (FIND_PREFIXES.some((p) => key.startsWith(p))) return 'find';
  if (key.startsWith('exit:')) return 'door';
  if ((key.startsWith('act:') || key.startsWith('door:')) && title === 'Door') return 'door';
  return 'use';
}

/** The distance from `p` to the nearest point of `box` (0 inside it). Pure. */
export function boxDistance(box, p) {
  let s = 0;
  for (let i = 0; i < 3; i++) {
    const v = p[i] < box.min[i] ? box.min[i] - p[i] : p[i] > box.max[i] ? p[i] - box.max[i] : 0;
    s += v * v;
  }
  return Math.sqrt(s);
}

/** A box's glow card: its foot's middle, its width (the wider of its two level sides) and its height, each held to
 *  the card's bounds. Pure. */
export function senseCard(box) {
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  return {
    at: [(box.min[0] + box.max[0]) / 2, box.min[1], (box.min[2] + box.max[2]) / 2],
    w: clamp(Math.max(box.max[0] - box.min[0], box.max[2] - box.min[2]), SENSE_CARD_MIN, SENSE_CARD_W_MAX),
    h: clamp(box.max[1] - box.min[1], SENSE_CARD_MIN, SENSE_CARD_H_MAX),
  };
}

/** AUDIT DELVE B8/C3: a target with no surface of its own (FIX-D's flat): one its producer says has none, an action
 *  object that is a flat (an acting flat - no collider: `isFlat`), or one of the context's own flats by its key (a loot
 *  pile, a body, a dropped pile - billboards all). A hit inside such a box is the wall it stands against. Pure.
 *  @param {any} target @param {any} [object] */
export function senseFlat(target, object = null) {
  if (target?.noSurface === true || object?.isFlat === true || object?.kind === 'moveFlat') return true;
  const key = target?.key;
  return typeof key === 'string' && FLAT_PREFIXES.some((p) => key.startsWith(p));
}
const FLAT_PREFIXES = Object.freeze(['loot:', 'corpse:', 'droppedLoot:']);

const isVec3 = (v) => v != null && typeof v === 'object' && v.length >= 3 && Number.isFinite(v[0]) && Number.isFinite(v[1]) && Number.isFinite(v[2]);

/**
 * IN PLAIN SIGHT: a clear line from `eye` to the middle of `box` - or to its top's middle, whichever is clear - through
 * the collider, past the thing's own bucket (`skip`, an action object's own key). A surface met INSIDE the box is the
 * thing's own face (a searchable's mesh sits in the shared bucket, as the pick's pardon reads it - activate.js) unless
 * the thing has no surface (a flat: `noSurface`, FIX-D's law - then it is the wall its box stands against). Pure.
 * @param {{ raycastHit: Function }} collider @param {number[]} eye
 * @param {{ min: number[], max: number[] }} box @param {{ skip?: string|null, noSurface?: boolean }} [o]
 */
export function inPlainSight(collider, eye, box, { skip = null, noSurface = false } = {}) {
  const cx = (box.min[0] + box.max[0]) / 2, cz = (box.min[2] + box.max[2]) / 2;
  for (const y of [(box.min[1] + box.max[1]) / 2, box.max[1] - 0.05]) {
    const dx = cx - eye[0], dy = y - eye[1], dz = cz - eye[2], len = Math.hypot(dx, dy, dz);
    if (!(len > 1e-3)) return true;
    const dir = [dx / len, dy / len, dz / len];
    const hit = collider.raycastHit(eye, dir, len, skip ? { skip: [skip] } : null);
    if (!Number.isFinite(hit?.dist)) return true;
    if (noSurface) continue;
    const at = [eye[0] + dir[0] * hit.dist, eye[1] + dir[1] * hit.dist, eye[2] + dir[2] * hit.dist];
    if (at.every((v, i) => v >= box.min[i] - PICK_PARDON_M && v <= box.max[i] + PICK_PARDON_M)) return true;
  }
  return false;
}

/**
 * @typedef {{ key: string, kind: 'use'|'door'|'find'|'secret', d: number, at: number[], w: number, h: number }} SenseFind
 */
/**
 * WHAT ONE PULSE FINDS among the activation `targets` (`{ key, aabb, noSurface? }` - the press's list): each within
 * `reach` of `eye`, named by `nameOf(key)` (the plaque's ladder: a title, or nothing), and seen (`sees(target)`), as a
 * card in its kind, nearest first, at most `max`. Pure but for what `nameOf` and `sees` read.
 * @param {ReadonlyArray<any>|null|undefined} targets @param {number[]|null|undefined} eye
 * @param {{ nameOf: (key: string) => string|null|undefined, sees?: (t: any) => boolean, reach?: number, max?: number }} o
 * @returns {SenseFind[]}
 */
export function senseFinds(targets, eye, { nameOf, sees = () => true, reach = SENSE_M, max = SENSE_MAX }) {
  /** @type {SenseFind[]} */
  const out = [];
  if (!Array.isArray(targets) || !isVec3(eye) || typeof nameOf !== 'function') return out;
  const seen = new Set();
  for (const t of targets) {
    const box = t?.aabb;
    if (!box || typeof t.key !== 'string' || seen.has(t.key) || !isVec3(box.min) || !isVec3(box.max)) continue;
    const d = boxDistance(box, eye);
    if (!(d <= reach)) continue;
    const title = nameOf(t.key);
    if (!title) continue;
    if (!sees(t)) continue;
    seen.add(t.key);
    out.push({ key: t.key, kind: /** @type {SenseFind['kind']} */ (senseKind(t.key, title)), d, ...senseCard(box) });
  }
  out.sort((a, b) => a.d - b.d);
  if (out.length > max) out.length = max;
  return out;
}

/** Does any trigger of the player's reach this object, by TRIGGER_GATE (actionSystem.js Receive's own gate)? The
 *  player presses (Direct), strikes (Attack), walks into (WalkInto) and stands on (WalkOn); `Door` is what an ACTION
 *  door sends itself when pressed (DaggerfallActionDoor), so it is the player's only on one. Pure. @param {any} o */
export function playerTriggers(o) {
  const gate = TRIGGER_GATE[o?.triggerFlag ?? TRIGGER_FLAGS.None] ?? [];
  return gate.some((t) => t !== 'Door' || isActionDoorObject(o));
}

/**
 * A SECRET: an action object only a chain moves - a mover (a placed model's tween, an acting flat) or a special door
 * (DaggerfallActionDoorSpecial, the wall that swings) that no trigger of the player's reaches (playerTriggers: the
 * gate's ActionObject-only row, and AUDIT DELVE A5 a `Door` flag on anything but an action door) and which some other
 * object's chain reaches (`chainTargets`, the action system's own graph) - still at rest where it started (a wall
 * already slid open is no longer a secret). Pure.
 * @param {any} o @param {Set<string>} chainTargets
 */
export function isSecretMover(o, chainTargets) {
  if (!o || !chainTargets?.has(o.key)) return false;
  const mover = o.kind === 'action' || o.kind === 'moveFlat' || (o.kind === 'door' && o.special === true);
  return mover && !playerTriggers(o) && o.state === 'start';
}

/**
 * The SECRETS tier's finds: each secret among the action system's `objects` within `reach` of `eye` and seen, its box
 * from `boxOf(o)` (activate.js objectAabb - the box the press races). Nearest first, at most `max`. Pure but for what
 * the readers read.
 * @param {Iterable<any>} objects @param {Set<string>} chainTargets @param {number[]|null|undefined} eye
 * @param {{ boxOf: (o: any) => any, sees?: (o: any, box: any) => boolean, reach?: number, max?: number }} o
 * @returns {SenseFind[]}
 */
export function senseSecrets(objects, chainTargets, eye, { boxOf, sees = () => true, reach = SENSE_M, max = SENSE_MAX }) {
  /** @type {SenseFind[]} */
  const out = [];
  if (!objects || !isVec3(eye) || typeof boxOf !== 'function') return out;
  for (const o of objects) {
    if (!isSecretMover(o, chainTargets)) continue;
    const box = boxOf(o);
    if (!box || !isVec3(box.min) || !isVec3(box.max)) continue;
    const d = boxDistance(box, eye);
    if (!(d <= reach) || !sees(o, box)) continue;
    out.push({ key: o.key, kind: 'secret', d, ...senseCard(box) });
  }
  out.sort((a, b) => a.d - b.d);
  if (out.length > max) out.length = max;
  return out;
}

/**
 * AUDIT DELVE C5/B9/D5: ONE ROUND, MERGED. The press's finds and (the secrets tier) the secrets, as one list: one card a
 * thing (a key once - its first, the nearest), nearest first, at most `max`. Pure.
 * @param {SenseFind[]} finds @param {SenseFind[]} [secrets] @returns {SenseFind[]}
 */
export function senseRound(finds, secrets = [], max = SENSE_MAX) {
  const all = [...(finds ?? []), ...(secrets ?? [])].sort((a, b) => a.d - b.d);
  const seen = new Set(), out = [];
  for (const f of all) {
    if (seen.has(f.key)) continue;
    seen.add(f.key);
    out.push(f);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * AUDIT DELVE B9/C10/D5: THE FRAME'S MARKS - the echo's found glow FIRST (what a lever moved, found: the rarer word),
 * then the look round's, a key once (the echo's mark of a secret the look round also lit is the one drawn: two cards
 * of one key kindled twice a frame at double light), into `out`, at most `max` (the glow's budget). Pure but for `out`.
 * @param {ReadonlyArray<{ key: string }>} echo @param {ReadonlyArray<{ key: string }>} sense @param {any[]} out
 */
export function senseMarks(echo, sense, out, max = SENSE_MAX) {
  out.length = 0;
  const seen = new Set();
  for (const list of [echo, sense]) {
    for (const m of list ?? []) {
      if (out.length >= max) return out;
      if (seen.has(m.key)) continue;
      seen.add(m.key);
      out.push(m);
    }
  }
  return out;
}

/**
 * THE PULSE'S STATE: `pulse(nowS, finds)` lights `finds` from `nowS`; `marks(nowS)` answers the glow pass's marks
 * (`{ key, at, w, h, rgb, gain, form }` - render/nodeGlow.js nodeGlows reads `rgb`, `gain` and `form` where a node has none) for
 * as long as the hold lasts, fading over its last SENSE_FADE_S, and none after; `clear()` puts it out. The marks are
 * pooled: none is made a frame. A find's key is minted `sense:` so it can never share the glow's kindling with a node.
 */
export function createSensePulse({ hold = SENSE_HOLD_S, fade = SENSE_FADE_S } = {}) {
  let at = -Infinity;
  /** @type {SenseFind[]} */
  let finds = [];
  /** @type {Array<{ key: string, at: number[], w: number, h: number, rgb: readonly number[], gain: number, form: readonly number[] }>} */
  const pool = [], out = [];
  return {
    /** @param {number} nowS @param {SenseFind[]} list */
    pulse(nowS, list) { at = nowS; finds = Array.isArray(list) ? list.slice() : []; return finds.length; },
    /** @param {number} nowS */
    lit(nowS) { const age = nowS - at; return age >= 0 && age < hold && finds.length > 0; },
    /** @param {number} nowS */
    marks(nowS) {
      out.length = 0;
      const age = nowS - at;
      if (!(age >= 0 && age < hold)) { finds = []; return out; }
      const gain = age > hold - fade ? Math.max(0, (hold - age) / fade) : 1;
      for (const f of finds) {
        const m = pool[out.length] ??= { key: '', at: f.at, w: 0, h: 0, rgb: SENSE_RGB.use, gain: 0, form: SENSE_FORM.use };
        m.key = `sense:${f.key}`; m.at = f.at; m.w = f.w; m.h = f.h; m.rgb = SENSE_RGB[f.kind] ?? SENSE_RGB.use; m.gain = gain;
        m.form = SENSE_FORM[f.kind] ?? SENSE_FORM.use;   // AUDIT DELVE D6
        out.push(m);
      }
      return out;
    },
    clear() { at = -Infinity; finds = []; },
  };
}
