// @ts-check
// NAV-A (2026-09-28) - THE SHOT IN FLIGHT, AND WHAT FLOATS: every ball fired, every fire barrel rolled off a stern,
// every cask a sinking hull gives up. The port's own; pure - the host hands the sea's height, the ships as boxes
// and (optionally) the ground, and reads back what happened as events.
//
// A BALL flies its closed form (navalBallistics.js: p0 + v0 t + g t^2 / 2) from the moment its gun fires - a
// volley's balls each wait their ripple (`delay`) and then appear at the muzzle, which is the 'muzzle' event the
// host smokes and flashes. Each step the ball is swept from where it stood to where the form puts it now, and meets,
// nearest first: a SHIP's hull box (grown by the ball's radius; never its own ship's, which it leaves through its own
// planking) - a 'hit', classified by the height it struck at (navalDamage.js hitZone); the GROUND - 'land'; the SEA -
// 'splash'. On the way it may pass through a ship's RIG (navalShips.js HULL_BUILDS `rig`) - a 'hit' in zone 'rig',
// once a ship, and the ball flies on through the canvas. A ball past BALL_LIFE seconds is 'gone'. The targets are read
// ONCE a step (AUDIT NAV1: every ball and every barrel asked the host to rebuild every hull box).
//
// WHO RESOLVES A HIT. A volley fired `resolve: true` is this client's to judge: its hits are 'hit' events the host
// turns into damage (or, online, into a word to whoever stands the ship - NAV-G). A volley `resolve: false` is
// another client's, drawn here only: its balls splash and strike the same (the same launches, the same seed - the
// same flight), and the 'hit' it raises carries `resolve: false`, so the host shows the splinters and never counts
// the damage twice.
//
// A FIRE BARREL floats where it was dropped, bobbing, for BARREL.life seconds; it is armed after BARREL_ARM seconds
// (its own stern has sailed clear), and the first ship's box within BARREL.fuse of it sets it off - a 'blast'.
// FLOTSAM - the casks a sunk ship leaves (NAV-D) - floats FLOTSAM_LIFE seconds, and the first collector (the
// player's boat) within FLOTSAM_REACH picks it up - a 'pickup'. Whatever floats DRIFTS: FLOAT_DRIFT of the wind's
// vector a second, downwind, as a cask does.
// SHOT-KINDS (bible/03-World/Naval-Refit.md): a ball keeps the load it left with (`shot`, navalGunnery.js volleyLaunches;
// null its bore's own) - its sweep the loaded gun's (shotKinds.js shotGun: a bag of grape and a tumbling chain sweep wider
// than a ball), and every event it raises says it, a hit with its flight `t` (grapeshot's men fall off with it -
// shotKinds.js shotReach).
// NEAR-MISS (COMBAT-FEEL, bible/03-World/Naval-Refit.md): a ball that goes by a ship that HEARS it (a target marked
// `ear` - the player's own boats) within NEAR_MISS_M without striking her in that piece of its flight is a 'pass' - once
// a ball a ship, told at its nearest (`point`, `gap`): the host's whistle and the near splash's drench read it. A ball
// that comes on to strike her a piece later is heard coming, then strikes.

import { shotPosition, shotVelocity, segmentBoxEntry, segmentCrossesDown, toBoxLocal } from './navalBallistics.js';
import { hitZone } from './navalDamage.js';
import { GUNS, BARREL, SHIP_TOUGHNESS } from './navalShips.js';
import { shotGun } from './shotKinds.js';

/** NEAR-MISS: how near a ball passes a ship that hears it to be heard going by (m, from her hull's box). */
export const NEAR_MISS_M = 8;
/** A ball's longest flight (s). */
export const BALL_LIFE = 9;
/** AUDIT NAV1 (online #15): the longest piece of a ball's flight tested at once (s) - a flight the step came late to (a
 *  peer's volley fired `since` before it was heard, a hitched frame) is walked along its arc, never across the chord. */
export const BALL_STEP_S = 0.1;
/** What floats drifts this share of the wind's vector a second (m/s per unit of the wind). */
export const FLOAT_DRIFT = 0.1;
/** A fire barrel is harmless this long after it is dropped (s). */
export const BARREL_ARM = 1.6;
/** Flotsam: how long it floats (s), and how near a collector's box must come (m). TOUGHER-SHIPS: 150 s before, as much
 *  longer as a fight now lasts - a two-ship fight's first cask still afloat when the second strikes. */
export const FLOTSAM_LIFE = Math.round(150 * SHIP_TOUGHNESS);
export const FLOTSAM_REACH = 3;
/** How far a swept ball is tested for the ground, at most - a flight over open sea never asks. */
const GROUND_STEP = 4;

/**
 * @typedef {{ id: string, box: { c: number[], ax: number[], ay: number[], az: number[], h: number[] }, rig?: any[], alive?: boolean,
 *   hitBy?: (shooter: any) => boolean, ear?: boolean }} ShotTarget
 *   a ship as the shots see it: its hull box this frame (navalBallistics.js orientedBox) and its rig's boxes; `alive`
 *   false for a ship that no longer takes hits (sunk); `hitBy` false for a shooter whose balls and barrels never meet
 *   her (AUDIT NAV1, online: another player's boat, met by a ship's shot alone); `ear` (NEAR-MISS) a ship whose
 *   near misses are told ('pass')
 */

/**
 * @param {{ seaY: () => number, targets: () => ShotTarget[], ground?: ((p: number[]) => boolean) | null,
 *           collectors?: () => { id: string, box: any }[], onEvent?: (e: any) => void, random?: () => number,
 *           wind?: () => number[] }} deps
 */
export function createShotField(deps) {
  /** @type {any[]} */ let balls = [];
  /** @type {any[]} */ let floaters = [];
  let clock = 0;
  const emit = (e) => deps.onEvent?.(e);
  const random = deps.random ?? Math.random;

  /**
   * A volley's balls. `launches` from navalGunnery.js volleyLaunches; `shooter` the ship's id (never struck by its
   * own balls); `resolve` whether this client judges the hits; `since` (AUDIT NAV1, online #15) how long ago it was
   * fired (s) - a peer's volley heard a word late flies from where its balls are now, in step with its shooter's.
   */
  function fireVolley({ id, shooter, launches, resolve = true, side = null, owner = null, since = 0 }) {
    const back = Math.max(0, since);
    for (const l of launches) {
      balls.push({
        volley: id, shooter, owner, resolve, side, gun: l.gun, shot: l.shot ?? null, weight: l.weight ?? 1, index: l.index, count: launches.length,   // GALLEON-WEIGHT: to its hit; SHOT-KINDS: its load
        p0: [...l.p0], v0: [...l.v0], born: clock - back + Math.max(0, l.delay ?? 0), t: 0, shown: false, prev: [...l.p0], pos: [...l.p0], spin: random() * Math.PI * 2,
      });
    }
  }

  /** A fire barrel dropped at `pos` (on the sea) by `shooter`. */
  function dropBarrel({ id, shooter, pos, resolve = true, owner = null }) {
    floaters.push({ kind: 'barrel', id, shooter, owner, resolve, pos: [...pos], born: clock, life: BARREL.life, phase: random() * Math.PI * 2 });
  }
  /** A cask of a sunk ship's cargo, worth `lot` (NAV-D's); `owner` (AUDIT NAV1, online #15) the player whose sea it
   *  floats in, when another's - hauled in here, it is only claimed of them. CAPT-WATERS: `deep` a ship of the deep
   *  waters' - her casks rolled richer (navalHost.js pickFlotsam). CAPT-BOARD: a contract's wreck's cask a string lot
   *  of its own (navalHost.js SITE_LOT) and its own `life`.
   *  @param {{ id: string, pos: number[], lot?: number|string, from?: string|null, owner?: string|null, deep?: boolean, life?: number }} f */
  function dropFlotsam({ id, pos, lot = 0, from = null, owner = null, deep = false, life = FLOTSAM_LIFE }) {
    floaters.push({ kind: 'flotsam', id, from, lot, owner, deep: !!deep, pos: [...pos], born: clock, life, phase: random() * Math.PI * 2 });   // CAPT-BOARD: a wreck's casks their own `life`
  }

  const nearestHit = (targets, a, b, radius, shooter) => {
    let best = null;
    for (const t of targets) {
      if (t.alive === false || t.id === shooter || t.hitBy?.(shooter) === false) continue;
      const e = segmentBoxEntry(a, b, t.box, radius);
      if (e && (!best || e.t < best.e.t)) best = { t, e };
    }
    return best;
  };
  /** The rigs a segment passes through before `before` (its fraction), nearest first - each ship's once a ball. */
  const rigsCrossed = (targets, a, b, radius, ball, before) => {
    const out = [];
    for (const t of targets) {
      if (t.alive === false || t.id === ball.shooter || t.hitBy?.(ball.shooter) === false || !t.rig?.length || ball.rigged?.has(t.id)) continue;
      let best = null;
      for (const box of t.rig) { const e = segmentBoxEntry(a, b, box, radius); if (e && e.t <= before && (!best || e.t < best.t)) best = e; }
      if (best) out.push({ t, e: best });
    }
    return out.sort((x, y) => x.e.t - y.e.t);
  };

  /** The ground along a segment, walked GROUND_STEP at a time: the fraction it is first under, or null. */
  function groundAlong(a, b) {
    if (!deps.ground) return null;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const n = Math.max(1, Math.ceil(len / GROUND_STEP));
    for (let i = 1; i <= n; i++) {
      const k = i / n;
      if (deps.ground([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k])) return k;
    }
    return null;
  }

  /** AUDIT 2: a ball's nearest pass by ship `id`, kept while its gap fell, told now - once a ball and a ship. */
  function passTold(b, id) {
    const n = b.near?.get(id);
    if (!n) return;
    b.near.delete(id);
    (b.passed ??= new Set()).add(id);
    emit({ type: 'pass', volley: b.volley, shooter: b.shooter, owner: b.owner, target: id, gun: b.gun, shot: b.shot, point: n.point, gap: n.gap, dir: n.dir });
  }
  /**
   * One piece of a ball's flight, `a` to `next` (its flight's `t1` there): the canvas it tears on the way, then whatever
   * stops it - a hull, the land or the sea. True when the ball is done.
   */
  function flyPiece(b, a, next, targets, seaY, t1 = b.t) {
    const radius = (b.radius ??= shotGun(b.gun, GUNS[b.gun], b.shot)?.radius ?? 0.1);   // AUDIT 2: read once a ball (shotGun makes its row)
    const flight = (k) => b.t + (t1 - b.t) * k;   // SHOT-KINDS: its time aloft where it meets her
    const ship = nearestHit(targets, a, next, radius, b.shooter);
    const sea = segmentCrossesDown(a, next, seaY);
    const land = groundAlong(a, next);
    const firstT = Math.min(ship ? ship.e.t : Infinity, sea ?? Infinity, land ?? Infinity);
    const dir = [next[0] - a[0], next[1] - a[1], next[2] - a[2]];
    // the canvas it tears on the way - before whatever stops it
    for (const r of rigsCrossed(targets, a, next, radius, b, firstT)) {
      (b.rigged ??= new Set()).add(r.t.id);
      emit({ type: 'hit', volley: b.volley, shooter: b.shooter, owner: b.owner, target: r.t.id, gun: b.gun, shot: b.shot, t: flight(r.e.t), weight: b.weight, point: r.e.point, zone: 'rig', dir, resolve: b.resolve });
    }
    // NEAR-MISS: the ships that hear it, passed close (to where it stops) and not struck in this piece. AUDIT 2: TOLD WHERE
    // IT PASSED NEAREST - a piece is a frame's flight (a metre or so), and the first piece within NEAR_MISS_M told it 7 m off
    // whatever it truly passed at (the whistle as loud for half a metre as for four, and astern of her): the nearest is kept
    // on the ball (`near`) while the gap still falls, and told in the piece it turns (its nearest inside the piece), or
    // where the ball stops; a ball that strikes her is no pass
    for (const t of targets) {
      if (!t.ear || t.id === b.shooter || b.passed?.has(t.id)) continue;
      if (ship && ship.t.id === t.id && ship.e.t === firstT) { b.near?.delete(t.id); continue; }
      const upTo = firstT === Infinity ? 1 : firstT;
      if (segmentPointGap(a, next, t.box.c, upTo) > Math.hypot(t.box.h[0], t.box.h[1], t.box.h[2]) + NEAR_MISS_M) continue;   // AUDIT 2026-10-17: past her bounding sphere - no search (none kept: a piece that begins within NEAR_MISS_M of her begins inside it)
      const near = segmentNearBox(a, next, t.box, upTo), was = b.near?.get(t.id);
      if (near.gap <= NEAR_MISS_M && (!was || near.gap < was.gap)) (b.near ??= new Map()).set(t.id, { point: near.point, gap: near.gap, dir });
      if (near.u < upTo - 1e-3 || firstT !== Infinity) passTold(b, t.id);
    }
    if (firstT === Infinity) return false;
    const at = (k) => [a[0] + (next[0] - a[0]) * k, a[1] + (next[1] - a[1]) * k, a[2] + (next[2] - a[2]) * k];
    if (ship && ship.e.t === firstT) {
      emit({
        type: 'hit', volley: b.volley, shooter: b.shooter, owner: b.owner, target: ship.t.id, gun: b.gun, shot: b.shot, t: flight(ship.e.t), weight: b.weight, point: ship.e.point,
        zone: hitZone(ship.e.point[1] - seaY), dir, resolve: b.resolve,
      });
    } else if (land != null && land === firstT) emit({ type: 'land', volley: b.volley, shooter: b.shooter, gun: b.gun, shot: b.shot, point: at(land) });
    else emit({ type: 'splash', volley: b.volley, shooter: b.shooter, gun: b.gun, shot: b.shot, point: [at(sea ?? 0)[0], seaY, at(sea ?? 0)[2]] });
    return true;
  }

  /** One step of every ball and floater. */
  function step(dt) {
    clock += Math.max(0, dt);
    const seaY = deps.seaY();
    const targets = balls.length || floaters.length ? deps.targets() : [];
    const keep = [];
    for (const b of balls) {
      if (clock < b.born) { keep.push(b); continue; }
      const age = clock - b.born;
      if (!b.shown) {
        b.shown = true;
        emit({ type: 'muzzle', volley: b.volley, shooter: b.shooter, owner: b.owner, side: b.side, gun: b.gun, shot: b.shot, index: b.index, count: b.count, pos: [...b.p0], dir: [...b.v0], resolve: b.resolve });
      }
      if (age > BALL_LIFE) { for (const id of [...(b.near?.keys() ?? [])]) passTold(b, id); emit({ type: 'gone', volley: b.volley, shooter: b.shooter, gun: b.gun }); continue; }   // AUDIT 2: a pass still kept, told as it goes
      // its flight since the last step, BALL_STEP_S at a time - one piece in an ordinary frame
      let ended = false;
      while (!ended && b.t < age) {
        const t1 = Math.min(age, b.t + BALL_STEP_S);
        const a = b.pos, next = shotPosition(b.p0, b.v0, t1, undefined, [0, 0, 0]);
        ended = flyPiece(b, a, next, targets, seaY, t1);
        if (!ended) { b.prev = a; b.pos = next; b.t = t1; }
      }
      if (!ended) keep.push(b);
    }
    balls = keep;
    const floatKeep = [];
    const w = floaters.length ? (deps.wind?.() ?? null) : null;
    const span = Math.max(0, dt);
    for (const f of floaters) {
      const age = clock - f.born;
      if (age > f.life) { emit({ type: 'sink', kind: f.kind, id: f.id, point: [...f.pos] }); continue; }
      if (w) { f.pos[0] += (w[0] ?? 0) * FLOAT_DRIFT * span; f.pos[2] += (w[2] ?? 0) * FLOAT_DRIFT * span; }
      f.pos[1] = seaY + 0.15 * Math.sin(clock * 1.7 + f.phase);
      if (f.kind === 'barrel' && age >= BARREL_ARM) {
        const t = targets.find((s) => s.alive !== false && s.id !== f.shooter && s.hitBy?.(f.shooter) !== false && insideGrown(s.box, f.pos, BARREL.fuse));
        if (t) { emit({ type: 'blast', id: f.id, shooter: f.shooter, owner: f.owner, target: t.id, point: [...f.pos], resolve: f.resolve }); continue; }
      }
      if (f.kind === 'flotsam') {
        const c = (deps.collectors?.() ?? []).find((k) => insideGrown(k.box, f.pos, FLOTSAM_REACH));
        if (c) { emit({ type: 'pickup', id: f.id, lot: f.lot, from: f.from, owner: f.owner, deep: !!f.deep, collector: c.id, point: [...f.pos] }); continue; }
      }
      floatKeep.push(f);
    }
    floaters = floatKeep;
  }

  /** The floating origin moved: every ball's launch and every floater with it. */
  function offsetAll(o) {
    for (const b of balls) for (const k of ['p0', 'prev', 'pos']) { b[k][0] += o[0]; b[k][1] += o[1]; b[k][2] += o[2]; }
    for (const f of floaters) { f.pos[0] += o[0]; f.pos[1] += o[1]; f.pos[2] += o[2]; }
  }

  return {
    fireVolley, dropBarrel, dropFlotsam, step, offsetAll,
    /** The balls in the air, for the draw: `{ pos, gun, shot, spin, age, vel }` - SHOT-KINDS: its load, its time aloft (a
     *  bag of grape opens) and its way (a heated ball trails along it). */
    balls: () => balls.filter((b) => b.shown).map((b) => ({ pos: b.pos, gun: b.gun, shot: b.shot, spin: b.spin + (clock - b.born) * 12, age: clock - b.born, vel: shotVelocity(b.v0, b.t) })),
    /** What floats, for the draw: `{ kind, pos, phase }`. */
    floaters: () => floaters.map((f) => ({ kind: f.kind, pos: f.pos, id: f.id, phase: f.phase, lot: f.lot, from: f.from, owner: f.owner ?? null, deep: !!f.deep })),   // CAPT-WATERS: a deep ship's cask
    /** AUDIT NAV1 (online #15): one floater itself, by id (its place and owner the host's to set), or null. */
    floater: (id) => floaters.find((f) => f.id === id) ?? null,
    /** AUDIT NAV1 (online #15): a floater gone without a word - hauled in by another, sunk in another's sea. */
    removeFloater(id) { const i = floaters.findIndex((f) => f.id === id); if (i >= 0) floaters.splice(i, 1); return i >= 0; },
    /** Everything gone (a transition, a load). */
    clear() { balls = []; floaters = []; },
    get clock() { return clock; },
    get inFlight() { return balls.length; },
  };
}

/** NEAR-MISS: how far a point is from a box (0 inside it). */
export function boxGap(box, p) {
  const l = toBoxLocal(box, p);
  return Math.hypot(Math.max(0, Math.abs(l[0]) - box.h[0]), Math.max(0, Math.abs(l[1]) - box.h[1]), Math.max(0, Math.abs(l[2]) - box.h[2]));
}
/** NEAR-MISS: how near a segment's first `upTo` share comes to a point (m) - the cheap test before the search below. */
const segmentPointGap = (a, b, p, upTo = 1) => {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const dd = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
  const u = dd > 0 ? Math.max(0, Math.min(Math.max(0, Math.min(1, upTo)), (w[0] * d[0] + w[1] * d[1] + w[2] * d[2]) / dd)) : 0;
  return Math.hypot(w[0] - d[0] * u, w[1] - d[1] * u, w[2] - d[2] * u);
};
/** NEAR-MISS: a segment's nearest to a box over its first `upTo` share - `{ u, gap, point }`. The gap is convex along a
 *  line (a box is convex), so its least is found by thirds. */
export function segmentNearBox(a, b, box, upTo = 1) {
  const at = (u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
  let lo = 0, hi = Math.max(0, Math.min(1, upTo));
  for (let i = 0; i < 40; i++) {
    const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
    if (boxGap(box, at(m1)) <= boxGap(box, at(m2))) hi = m2; else lo = m1;
  }
  const u = (lo + hi) / 2, point = at(u);
  return { u, gap: boxGap(box, point), point };
}
/** Whether a point lies inside a box grown by `r` on every axis. */
export function insideGrown(box, p, r) {
  const l = toBoxLocal(box, p);
  return Math.abs(l[0]) <= box.h[0] + r && Math.abs(l[1]) <= box.h[1] + r && Math.abs(l[2]) <= box.h[2] + r;
}
