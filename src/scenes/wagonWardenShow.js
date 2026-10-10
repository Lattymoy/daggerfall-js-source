// @ts-check
// WARDEN1 (systems/wagonWarden.js - the law; net/wire.js - the cell's clock): THE TOWN WATCH'S THROW, PLAYED. A guard of
// the town's watch (the city guards' own picture, GUARD_TEXTURE) jogs up to a parked team along the town's streets, lifts
// the wagon - its horses with it - over its head, turns to the town's edge and throws it out along a high arc, tumbling,
// to where it lands; then it walks back the way it came and is gone. The team the pool would draw is held
// (scenes/horseCartPool.js holdTeam) from the show's start to the landing and drawn here; at the landing it is the pool's
// again, standing where the throw put it (the owner's save moved - systems/horseCart.js adoptYeet; a reader's record
// moved - wagonWarden.js thrownRecord).
//
// ONE FRAME A SHOW: its points are metres off where the wagon stood when it began (`origin`, the wire frame - turned to
// the scene through the host's `toScene` every frame, so a recentre or a re-anchor carries it), the guard's way the
// host's (`approach` - the town's walk grid), the landing the cell's (`landing`, natives). The clock is the host's
// (`now`, seconds), started once the guard's picture is in (or SHOW_ART_WAIT has passed - a picture that never comes plays
// the throw with no guard).
//
// Not a DFU member. Ledger A (WARDEN1).
import { GUARD_TEXTURE, PERSON_GUARD_IDLE_RECORD, MOVE_RECORDS, MOVE_FLIPS } from '../characters/mobilePerson.js';
import { mobileOrientation } from '../characters/mobileUnit.js';
import { mobileBillboardSize } from '../world/rmbFlats.js';
import { quatAngleAxis, quatMultiply, quatRotate } from '../world/quat.js';
import { calculateHorseOrientation, horseViewFor } from '../systems/horseCartLaw.js';
import { HORSE_ARCHIVE, horseStillRecord, HORSE_BILLBOARD_WIDTH, HORSE_BILLBOARD_HEIGHT } from './horseCartPool.js';
import { pointOnLine } from '../systems/livingWorld/townPaths.js';

/** The guard's jog, metres a second, and its stride's frames a second. */
export const WARDEN_GUARD_SPEED = 3.2;
export const WARDEN_GUARD_FPS = 8;
/** The longest the guard jogs to the team, seconds (a longer way starts nearer along it). */
export const WARDEN_APPROACH_MAX = 7;
/** The lift, the wind-up to throw, and the stand after the throw, seconds; and the shortest walk away (the guard walks
 *  back the way it came, as long as it took to come, and is gone). */
export const WARDEN_LIFT_S = 1.4;
export const WARDEN_TURN_S = 0.7;
export const WARDEN_PAUSE_S = 0.8;
export const WARDEN_LEAVE_MIN = 2;
/** Where the wagon's floor rests over the guard's feet, metres (a keeper's height - merchantYardsHost KEEPER_HEIGHT). */
export const WARDEN_HEAD = 1.85;
/** How far beside the wagon's box the guard stands to lift it, metres. */
export const WARDEN_SIDE_GAP = 0.6;
/** Turns a second the thrown wagon tumbles (whole turns in all, so it lands upright). */
export const WARDEN_TUMBLE = 1.25;
/** The guard's picture waited for before the clock starts, seconds. */
export const SHOW_ART_WAIT = 1.5;

/** How long a throw of `dist` metres flies, seconds. Pure. */
export const flightSeconds = (/** @type {number} */ dist) => Math.min(4.5, Math.max(1.8, dist / 55));
/** How high over the line a throw of `dist` metres rises at its middle, metres. Pure. */
export const arcPeak = (/** @type {number} */ dist) => Math.min(90, Math.max(15, dist * 0.35));
const ease = (/** @type {number} */ k) => { const t = Math.min(1, Math.max(0, k)); return t * t * (3 - 2 * t); };
const wrapPi = (/** @type {number} */ a) => { let x = a % (2 * Math.PI); if (x > Math.PI) x -= 2 * Math.PI; if (x < -Math.PI) x += 2 * Math.PI; return x; };

/** A way's points [[x, z] ...] as a walked line (livingWorld/townPaths.js pathLine's shape - its pointOnLine walks it):
 *  its length and each point's distance along it. Pure. */
export function lineOf(/** @type {number[][]} */ pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.sqrt((pts[i][0] - pts[i - 1][0]) ** 2 + (pts[i][1] - pts[i - 1][1]) ** 2));
  return { pts, len: cum[cum.length - 1] ?? 0, cum };
}
/**
 * A show's clock: the guard jogs the last WARDEN_APPROACH_MAX seconds of its way (`walkFrom` metres along it), lifts,
 * winds up, throws (`land` the landing), stands, walks back as long as it came (WARDEN_LEAVE_MIN at least) and is `gone`. `pathLen` its way's length, `flyDist` the throw's
 * horizontal reach, both metres. Pure.
 */
export function showTimes(/** @type {number} */ pathLen, /** @type {number} */ flyDist) {
  const len = Math.max(0, pathLen), walk = Math.min(len, WARDEN_APPROACH_MAX * WARDEN_GUARD_SPEED);
  const approach = walk / WARDEN_GUARD_SPEED, lift = approach + WARDEN_LIFT_S, turn = lift + WARDEN_TURN_S;
  const fly = flightSeconds(flyDist), land = turn + fly;
  const leave = land + WARDEN_PAUSE_S;
  return { walkFrom: len - walk, approach, lift, turn, fly, land, leave, gone: leave + Math.max(WARDEN_LEAVE_MIN, approach) };
}
/** A throw's point at `k` (0..1) from `from` to `to` ([x, y, z]), `peak` metres over the line at its middle. Pure. */
export function arcPoint(/** @type {number[]} */ from, /** @type {number[]} */ to, /** @type {number} */ k, /** @type {number} */ peak, out = [0, 0, 0]) {
  const t = Math.min(1, Math.max(0, k)), u = 1 - t;
  out[0] = from[0] * u + to[0] * t;
  out[1] = from[1] * u + to[1] * t + Math.sin(Math.PI * t) * peak;
  out[2] = from[2] * u + to[2] * t;
  return out;
}
/** The whole turns a throw of `fly` seconds tumbles - one at least. Pure. */
export const tumbleTurns = (/** @type {number} */ fly) => Math.max(1, Math.round(fly * WARDEN_TUMBLE));

const vsub = (/** @type {number[]} */ a, /** @type {number[]} */ b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vadd = (/** @type {number[]} */ a, /** @type {number[]} */ b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const qInv = (/** @type {number[]} */ q) => [-q[0], -q[1], -q[2], q[3]];

/**
 * @param {{
 *   renderer?: any, getTexture?: ((archive: number) => Promise<any>)|null,
 *   uploadRecordFrame?: ((archive: number, record: number, frame: number) => void)|null,
 *   toScene: (wire: number[]) => number[], groundAt: (x: number, z: number) => number,
 *   showWagon?: ((r: any, texRemap: any, position: number[], rotation: number[], kind: string, look?: any) => boolean)|null,
 *   wagonBox?: ((kind: string) => (number[]|null))|null, horseArt?: (() => boolean)|null,
 *   hold?: (owner: string, on: boolean) => void, sound?: (what: 'heave'|'throw'|'land', at: number[]) => void,
 *   now?: () => number,
 * }} deps  `toScene` the wire frame's point in this scene; `groundAt` the drawn ground (NaN: none built); `showWagon`/
 *   `wagonBox` the HCC pool's wagon of a kind, drawn, and its box in its own frame; `hold` the pool's holdTeam; `now`
 *   seconds
 */
export function createWardenShows({
  renderer = null, getTexture = null, uploadRecordFrame = null, toScene, groundAt, showWagon = null, wagonBox = null,
  horseArt = null, hold = () => {}, sound = () => {}, now = () => performance.now() / 1000,
}) {
  /** @type {Map<string, any>} */
  const shows = new Map();
  /** @type {any} */
  let guardTex = null;   // null: not asked; a promise: loading; { tex } or { failed }
  const _batches = [];

  function guardArt() {
    if (guardTex && !(guardTex instanceof Promise)) return guardTex.failed ? false : guardTex.tex;
    if (!guardTex && getTexture) {
      guardTex = Promise.resolve().then(() => getTexture(GUARD_TEXTURE)).then(
        (tex) => { guardTex = tex ? { tex } : { failed: true }; },
        (e) => { guardTex = { failed: true }; console.warn('[warden] the guard\'s picture', e?.message ?? e); });
    }
    if (!getTexture) return false;
    return null;
  }

  function end(s) {
    if (s.guardBatch) renderer?.destroyBillboardBatch?.(s.guardBatch);
    for (const h of s.horses) if (h.batch) renderer?.destroyBillboardBatch?.(h.batch);
    if (s.held) { for (const o of s.owners) hold(o, false); s.held = false; }
    shows.delete(s.key);
  }
  function releaseTeam(s) {
    if (s.held) { for (const o of s.owners) hold(o, false); s.held = false; }
    for (const h of s.horses) if (h.batch) { renderer?.destroyBillboardBatch?.(h.batch); h.batch = null; }
  }

  /** The guard's feet, the scene's, off a local point (its ground read when it moves). */
  function guardFeet(O, x, z) {
    const g = groundAt(O[0] + x, O[2] + z);
    return [O[0] + x, Number.isFinite(g) ? g : O[1], O[2] + z];
  }

  /** The guard's billboard posed: its record, its frame, its flip, at `feet`. */
  function poseGuard(s, feet, yaw, walking, t, cam) {
    const tex = guardArt();
    if (!tex || !renderer?.createBillboardBatch) return;
    let record, frame, flip = false;
    if (walking) {
      const o = cam ? mobileOrientation(yaw, feet, cam) : 0;
      record = MOVE_RECORDS[o]; flip = MOVE_FLIPS[o];
      const n = Math.max(1, tex.getFrameCount?.(record) ?? 1);
      frame = Math.floor(t * WARDEN_GUARD_FPS) % n;
    } else {
      record = PERSON_GUARD_IDLE_RECORD;
      frame = 0;
    }
    const rkey = `${record}#${frame}`;
    if (!renderer.textures?.has?.(`${GUARD_TEXTURE}_${rkey}`)) uploadRecordFrame?.(GUARD_TEXTURE, record, frame);
    const sz = mobileBillboardSize(tex, record);
    if (!s.guardBatch) { s.guardBatch = renderer.createBillboardBatch(GUARD_TEXTURE, rkey, { w: sz.w, h: sz.h }, [[0, 0, 0]]); s.guardBatch.origin = [0, 0, 0]; }
    const b = s.guardBatch;
    b.record = rkey; b.size = { w: flip ? -sz.w : sz.w, h: sz.h };
    b.origin[0] = feet[0]; b.origin[1] = feet[1]; b.origin[2] = feet[2];
  }

  /** The carried team this frame: the wagon's point and turn (`w`, local to the show's origin `O`), its horses' pictures
   *  each at its place on it, turned with it. */
  function poseTeam(s, O, w, cam) {
    s.drawn = { at: vadd(O, w.at), rot: w.rot };
    if (!renderer?.createBillboardBatch || !horseArt?.()) return;
    for (const h of s.horses) {
      const pos = vadd(s.drawn.at, quatRotate(w.rot, h.off)), fwd = quatRotate(w.rot, h.fwd);
      const view = horseViewFor(calculateHorseOrientation(cam ?? pos, pos, fwd));
      if (!h.batch) { h.batch = renderer.createBillboardBatch(HORSE_ARCHIVE, horseStillRecord(0), { w: HORSE_BILLBOARD_WIDTH, h: HORSE_BILLBOARD_HEIGHT }, [[0, 0, 0]]); h.batch.origin = [0, 0, 0]; }
      if (view) { h.batch.record = horseStillRecord(view.view); h.batch.size = { w: view.flip ? -HORSE_BILLBOARD_WIDTH : HORSE_BILLBOARD_WIDTH, h: HORSE_BILLBOARD_HEIGHT }; }
      h.batch.origin[0] = pos[0]; h.batch.origin[1] = pos[1]; h.batch.origin[2] = pos[2];
    }
  }
  /** Where the wagon's origin stands when its floor rests on the guard's head (`G` the guard's feet, `rot` its turn) -
   *  the lift's end, the wind-up and the throw's start alike. */
  const overHead = (s, G, rot) => vsub([G[0], G[1] + WARDEN_HEAD, G[2]], quatRotate(rot, s.floor));
  /** The wagon's pose this frame, local to the show's origin: its point and its turn - or null once it has landed. */
  function wagonPose(s, t, G) {
    const T = s.times;
    if (t < T.approach) return { at: [0, 0, 0], rot: s.rot0 };
    const carried = (/** @type {number[]} */ rot) => overHead(s, G, rot);
    if (t < T.lift) {
      const k = ease((t - T.approach) / WARDEN_LIFT_S), c = carried(s.rot0);
      const heave = Math.sin(k * Math.PI * 3) * 0.15 * (1 - k);   // the heave: up in three jerks
      return { at: [c[0] * k, c[1] * k + heave, c[2] * k], rot: s.rot0 };
    }
    if (t < T.turn) {
      const k = ease((t - T.lift) / WARDEN_TURN_S);
      const rot = quatMultiply(quatAngleAxis((s.dyaw * k * 180) / Math.PI, [0, 1, 0]), s.rot0);
      const c = carried(rot);
      return { at: [c[0], c[1] - Math.sin(k * Math.PI) * 0.35, c[2]], rot };   // a dip to throw from
    }
    if (t < T.land) {
      const k = (t - T.turn) / T.fly;
      const spin = quatAngleAxis(360 * s.turns * k, s.side);
      const rot = quatMultiply(spin, s.rotT);
      const centre = arcPoint(s.from, s.to, k, s.peak);
      return { at: vsub(centre, quatRotate(rot, s.mid)), rot };
    }
    return null;
  }

  return {
    /**
     * A throw begins: `key` the show's own (one a team), `owners` the pool's keys the team may be drawn under (holdTeam -
     * a peer's live word and the cell's kept one), `snap` the team as drawn
     * (horseCartPool teamSnapshot - read before anything moved it), `origin` where it stood in the wire frame, `landing`
     * where it lands ([x, z] natives), `approach(lift, away)` the guard's way to the scene's `lift` point from the town's
     * inside (`away` the throw's way, [x, z]) - scene [x, z] points ending at `lift`, or null (a straight jog). Answers
     * whether it began (one show a key at a time; no wagon, no show).
     * @param {{ key: string, owners: string[], snap: any, origin: number[], landing: number[],
     *   approach?: ((lift: number[], away: number[]) => (number[][]|null))|null }} o
     */
    start({ key, owners, snap, origin, landing, approach = null }) {
      if (!key || shows.has(key) || !snap?.kind || !Array.isArray(owners) || !Array.isArray(origin) || !Array.isArray(landing)) return false;
      const box = wagonBox?.(snap.kind) ?? [-1, 0, -2, 1, 2, 2];
      const O = toScene(origin);
      const rot0 = snap.rotation;
      const floor = [(box[0] + box[3]) / 2, box[1], (box[2] + box[5]) / 2];
      const mid = [(box[0] + box[3]) / 2, (box[1] + box[4]) / 2, (box[2] + box[5]) / 2];
      // the landing, local (its ground read once the throw is let go - a pixel built meanwhile is stood on)
      const L = toScene([landing[0], origin[1], landing[1]]);
      const land2 = [L[0] - O[0], L[2] - O[2]];
      const away = [land2[0], land2[1]];
      const al = Math.sqrt(away[0] * away[0] + away[1] * away[1]) || 1;
      away[0] /= al; away[1] /= al;
      // the guard lifts from the wagon's town side, a step clear of its box
      const reach = Math.sqrt(((box[3] - box[0]) / 2) ** 2 + ((box[5] - box[2]) / 2) ** 2) + WARDEN_SIDE_GAP;
      const cw = quatRotate(rot0, mid);
      const lift = [cw[0] - away[0] * reach, cw[2] - away[1] * reach];
      let pts = null;
      try { pts = approach?.([O[0] + lift[0], O[2] + lift[1]], away) ?? null; } catch (e) { console.warn('[warden] the way', /** @type {any} */ (e)?.message ?? e); }
      const local = Array.isArray(pts) && pts.length >= 2 ? pts.map((p) => [p[0] - O[0], p[1] - O[2]]) : null;
      const line = lineOf(local ?? [[lift[0] - away[0] * 16, lift[1] - away[1] * 16], lift]);
      const yaw0 = Math.atan2(cw[0] - lift[0], cw[2] - lift[1]), yaw1 = Math.atan2(away[0], away[1]);
      const dyaw = wrapPi(yaw1 - yaw0);
      const rotT = quatMultiply(quatAngleAxis((dyaw * 180) / Math.PI, [0, 1, 0]), rot0);
      const horses = (snap.horses ?? []).map((/** @type {any} */ h) => ({
        off: quatRotate(qInv(rot0), vsub(h.at, snap.at)), fwd: quatRotate(qInv(rot0), h.forward), batch: null,
      }));
      const s = {
        key, owners: [...owners], kind: snap.kind, look: snap.look ?? null, origin: [origin[0], origin[1], origin[2]], landing: [landing[0], landing[1]],
        rot0, rotT, floor, mid, line, lift, yaw0, yaw1, dyaw, horses, land2,
        side: [away[1], 0, -away[0]], times: null, turns: 1, peak: 0, from: null, to: null,
        t0: null, asked: now(), held: true, said: new Set(), guardBatch: null,
        drawn: null,   // this frame's wagon: { at (scene), rot }
      };
      for (const o of s.owners) hold(o, true);
      shows.set(key, s);
      guardArt();
      return true;
    },
    /** One frame: every show stepped on its clock, the guard and the team posed, the landed and the gone ended. */
    frame(/** @type {number[]|null} */ cam = null) {
      const tn = now();
      for (const s of [...shows.values()]) {
        const O = toScene(s.origin);
        if (s.t0 === null) {
          if (guardArt() === null && tn - s.asked < SHOW_ART_WAIT) { poseTeam(s, O, { at: [0, 0, 0], rot: s.rot0 }, cam); continue; }   // the team stands as it stood while the guard's picture comes
          s.t0 = tn;
        }
        const t = tn - s.t0;
        // the throw's line, once the guard stands to lift (its feet's ground is the lift's)
        const liftFeet = guardFeet(O, s.lift[0], s.lift[1]);
        const G = [liftFeet[0] - O[0], liftFeet[1] - O[1], liftFeet[2] - O[2]];
        if (!s.times) {
          const dist = Math.sqrt((s.land2[0] - G[0]) ** 2 + (s.land2[1] - G[2]) ** 2);
          s.times = showTimes(s.line.len, dist);
          s.turns = tumbleTurns(s.times.fly);
          s.peak = arcPeak(dist);
        }
        const T = s.times;
        if (t >= T.turn && !s.from) {
          s.from = vadd(overHead(s, G, s.rotT), quatRotate(s.rotT, s.mid));
          const Lg = groundAt(O[0] + s.land2[0], O[2] + s.land2[1]);
          const ly = Number.isFinite(Lg) ? Lg - O[1] : G[1] - 2;
          const landOrigin = vsub([s.land2[0], ly, s.land2[1]], [0, quatRotate(s.rotT, s.floor)[1], 0]);
          s.to = vadd(landOrigin, quatRotate(s.rotT, s.mid));
        }
        // the guard
        let feet, yaw, walking;
        if (t < T.approach) { const p = pointOnLine(s.line, T.walkFrom + t * WARDEN_GUARD_SPEED); feet = guardFeet(O, p.x, p.z); yaw = p.yaw; walking = true; }
        else if (t < T.turn) { feet = liftFeet; yaw = t < T.lift ? s.yaw0 : s.yaw0 + s.dyaw * ease((t - T.lift) / WARDEN_TURN_S); walking = false; }
        else if (t < T.leave) { feet = liftFeet; yaw = s.yaw1; walking = false; }
        else if (t < T.gone) { const p = pointOnLine(s.line, s.line.len - (t - T.leave) * WARDEN_GUARD_SPEED); feet = guardFeet(O, p.x, p.z); yaw = p.yaw + Math.PI; walking = true; }
        else { end(s); continue; }
        poseGuard(s, feet, yaw, walking, t, cam);
        if (t >= T.approach && !s.said.has('heave')) { s.said.add('heave'); sound('heave', feet); }
        if (t >= T.turn && !s.said.has('throw')) { s.said.add('throw'); sound('throw', feet); }
        // the team
        const w = s.held ? wagonPose(s, t, G) : null;
        if (!w) {
          if (s.held) { releaseTeam(s); sound('land', vadd(O, s.to ?? [0, 0, 0])); }   // landed: the pool's again, where the throw put it
          s.drawn = null;
          continue;
        }
        poseTeam(s, O, w, cam);
      }
      return shows.size;
    },
    /** The wagons in flight (and on the guard's shoulders), in the host's world pass. Answers how many it drew. */
    draw(r = renderer) {
      let n = 0;
      if (!showWagon) return n;
      for (const s of shows.values()) if (s.drawn && s.held && showWagon(r, null, s.drawn.at, s.drawn.rot, s.kind, s.look)) n++;
      return n;
    },
    /** The guards and the carried horses, for the host's flats. */
    batches() {
      _batches.length = 0;
      for (const s of shows.values()) {
        if (s.guardBatch) _batches.push(s.guardBatch);
        for (const h of s.horses) if (h.batch) _batches.push(h.batch);
      }
      return _batches;
    },
    /** Whether a show of `key` is playing. */
    playing: (/** @type {string} */ key) => shows.has(key),
    /** For the tests and the probes. */
    state: () => [...shows.values()].map((s) => ({ key: s.key, owners: s.owners, held: s.held, t: s.t0 === null ? null : now() - s.t0, times: s.times, guard: !!s.guardBatch, horses: s.horses.filter((h) => h.batch).length, at: s.drawn?.at ?? null })),
    /** A transition, a load: every show ends - its team set down where the throw put it, its guard gone. */
    destroyAll() { for (const s of [...shows.values()]) end(s); },
    /** The scene ends (EVERY ALLOCATION HAS AN OWNER). */
    dispose() { for (const s of [...shows.values()]) end(s); guardTex = null; },
  };
}
