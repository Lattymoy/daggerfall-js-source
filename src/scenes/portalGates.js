// @ts-check
// PORTAL1 - THE PORTALS A HOST STANDS. The law is systems/portalStone.js; this is the ground, the vortex and the step.
//
//  - THE FRAME: every portal is kept in the WORLD frame (`native` - the wire's and the camps' [x, y, z]) and put into
//    the scene's each frame (`toScene`), so the floating origin's recenter moves nothing here and a portal far behind
//    a teleport is still where it was. Every distance here is measured in the SCENE's metres.
//  - THE LOOK: COMPANION-PORTAL's vortex (scenes/portalFx.js), this pool's own set, FIXED where it opened and HELD for
//    the portal's time (`holdMs`), so it tears open, stands, and seals as its time runs out.
//  - THE STEP: `tick(feet)` asks every portal whether the feet stepped in this frame (portalStepIn: outside, then
//    inside) and hands the first to `onEnter` - the host's arrival - unless the host's `hold()` keeps it shut (said
//    through `onRefused`, save a busy host's own frames). THE STEP IS FORGOTTEN across a gap - frames not ticked (a
//    building, a dungeon: AUDIT PORTAL1 U1 found the host's frame returning before the portals indoors, so a portal
//    outside a shop's door took whoever came out of it) or feet that jumped (a door, a teleport, a respawn) - and the
//    host forgets it at every change of place besides (`forgetSteps`).
//  - ONLINE: `wireRecord` is my own portal while I stand near it; `applyOwner` lands a peer's - believed only near the
//    opener's own feet, one an opener (another id while the first stands is refused), kept to the time first said and
//    never longer (AUDIT PORTAL1 O2: a word said again had pushed the time on, past the vortex's own life - a portal kept
//    open for ever, unseen), and stood on this player's own ground when it is found near the opener's height.

import { createPortalSet, PORTAL_MS } from './portalFx.js';
import {
  PORTAL_OPEN_MS, PORTAL_SAY_REACH, PORTAL_PEER_REACH, PORTAL_REGROUND, PORTAL_STEP_GAP_MS, PORTAL_STEP_JUMP,
  portalWire, validPortalRecord, portalStepIn,
} from '../systems/portalStone.js';

const across = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

/**
 * deps = { renderer, audio, now() ms, toScene(native) -> scene [x, y, z], toWire(scene) -> native [x, y, z],
 *          destOf(x, y) -> { pixel: { x, y }, name } for a map pixel with a location (null: none - the record refused),
 *          groundAt(scene) -> the ground's height under a scene point, or null (not streamed yet),
 *          onEnter(gate) - the host's arrival, onRefused(hold, gate) - a step in a hold kept shut }
 * @param {{ renderer?: any, audio?: any, now?: () => number, toScene?: (p: number[]) => number[], toWire?: (p: number[]) => number[],
 *           destOf?: (x: number, y: number) => ({ pixel: { x: number, y: number }, name: string } | null),
 *           groundAt?: ((p: number[]) => number | null) | null,
 *           onEnter?: (gate: any) => void, onRefused?: (hold: string, gate: any) => void }} [deps]
 */
export function createPortalGates({
  renderer = null, audio = null, now = () => performance.now(),
  toScene = (p) => p, toWire = (p) => p, destOf = () => null, groundAt = null, onEnter = () => {}, onRefused = () => {},
} = {}) {
  const fx = createPortalSet({ renderer, audio, now });
  /** @type {{ id: string, owner: string | null, native: number[], dest: { pixel: { x: number, y: number }, name: string }, until: number, fx: any, was: boolean | null, grounded: boolean }[]} */
  const gates = [];
  let _seq = 0;
  let _lastTick = null, _lastFeet = null;
  let _also = null;   // EG-F: another pool's portals, drawn with these (drawAlso)
  const holdFor = (ms) => Math.max(0, ms - PORTAL_MS.open - PORTAL_MS.close);

  function stand(g) { g.fx = fx.open(toScene(g.native), { holdMs: holdFor(g.until - now()), fixed: true }); }
  function drop(g) {
    if (g.fx) fx.remove(g.fx);
    g.fx = null;
    const i = gates.indexOf(g);
    if (i >= 0) gates.splice(i, 1);
  }

  /** MINE: a portal opened at `pos` (the scene's, on the ground portalPlace found) to `dest` - one of mine at a time. */
  function open(pos, dest) {
    for (const g of gates.filter((x) => x.owner === null)) drop(g);
    const g = { id: `${Math.floor(now()).toString(36)}${(_seq++).toString(36)}`, owner: null, native: toWire(pos), dest, until: now() + PORTAL_OPEN_MS, fx: null, was: null, grounded: true };
    gates.push(g);
    stand(g);
    return g;
  }
  /** My portal still standing, or null. */
  const mine = () => gates.find((g) => g.owner === null && now() < g.until) ?? null;

  /** A peer's word: its portal, refused whole by validPortalRecord, a destination with no place, or a portal standing
   *  further than PORTAL_PEER_REACH from `from` - the opener's own feet in this scene (no feet, no portal). Answers
   *  whether it stands. */
  function applyOwner(owner, raw, from = null) {
    if (owner == null || !from) return false;
    const r = validPortalRecord(raw);
    const dest = r ? destOf(r.d[0], r.d[1]) : null;
    if (!r || !dest) return false;
    if (across(toScene(r.p), from) > PORTAL_PEER_REACH) return false;
    const old = gates.find((g) => g.owner === owner);
    if (old && now() < old.until) {
      if (old.id !== r.i) return false;   // one an opener: the first stands its time
      old.until = Math.min(old.until, now() + r.r);   // said again: never longer than first said
      return true;
    }
    if (old) drop(old);
    const g = { id: r.i, owner, native: [...r.p], dest, until: now() + r.r, fx: null, was: null, grounded: false };
    gates.push(g);
    stand(g);
    return true;
  }

  /** The step forgotten - the host's change of place (a door, a mode, a load). */
  function forgetSteps() { for (const g of gates) g.was = null; _lastFeet = null; }

  /** One frame: the portals run out, a peer's finds this player's ground, the vortex stands in this frame, and the feet
   *  (the scene's, or null - not walking the open world) step in. `hold()` the host's word on a step (portalHold's).
   *  Answers the portal entered, or null. */
  function tick(feet, { hold = () => null } = {}) {
    const t = now();
    const gap = _lastTick == null || t - _lastTick > PORTAL_STEP_GAP_MS || !feet || !_lastFeet || across(feet, _lastFeet) > PORTAL_STEP_JUMP
      || Math.abs(feet[1] - _lastFeet[1]) > PORTAL_STEP_JUMP;
    _lastTick = t;
    _lastFeet = feet ? [feet[0], feet[1], feet[2]] : null;
    if (gap) for (const g of gates) g.was = null;
    for (let i = gates.length - 1; i >= 0; i--) {
      const g = gates[i];
      if (t >= g.until) { drop(g); continue; }
      let at = toScene(g.native);
      if (!g.grounded && groundAt) {
        const y = groundAt(at);
        if (Number.isFinite(y)) {
          if (Math.abs(/** @type {number} */ (y) - at[1]) <= PORTAL_REGROUND) { at = [at[0], /** @type {number} */ (y), at[2]]; g.native = toWire(at); }
          g.grounded = true;
        }
      }
      if (g.fx) { g.fx.feet[0] = at[0]; g.fx.feet[1] = at[1] - 0.05; g.fx.feet[2] = at[2]; }
    }
    fx.tick(null);
    if (!feet) return null;
    let entered = null;
    for (const g of gates) {
      const step = portalStepIn(g.was, feet, toScene(g.native));
      g.was = step.inside;
      if (!entered && step.entered && t < g.until - PORTAL_MS.close) entered = g;   // a sealing portal takes nobody
    }
    if (!entered) return null;
    const why = hold();
    if (why) { if (why !== 'busy') onRefused(why, entered); return null; }
    onEnter(entered);
    return entered;
  }

  /** My portal for my foes frame, while I stand within PORTAL_SAY_REACH of it (`near` my feet, the scene's), or null. */
  function wireRecord(near) {
    const g = mine();
    if (!g || !near || across(toScene(g.native), near) > PORTAL_SAY_REACH) return null;
    return portalWire(g, now());
  }

  return {
    open, mine, applyOwner, tick, wireRecord, forgetSteps,
    /** The vortexes, drawn with the street's flats. */
    batches: () => { const more = _also?.(); return more?.length ? [...fx.batches(), ...more] : fx.batches(); },
    /** EG-F: another pool's portals drawn with these, on the same axis - the Elite call's (scenes/eliteGates/egCall.js). */
    drawAlso(batchesOf) { _also = batchesOf; },
    /** Every portal, for the tests. */
    get gates() { return gates; },
    /** A teardown: every portal and its batch gone. */
    clear() { fx.clear(); for (const g of gates) g.fx = null; gates.length = 0; _lastFeet = null; },
  };
}
