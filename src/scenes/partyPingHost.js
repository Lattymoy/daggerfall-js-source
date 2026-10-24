// @ts-check
// PARTY-PING: the look's point for the party, and the floor route to it.
// The world host wires this (scenes/world.js) and does not grow a second
// copy into the dungeon or the interior. Not a DFU member.
import { findPath } from '../ai/nav/navmesh.js';
import { NavClient } from '../ai/nav/navClient.js';
import { isActionDoorObject } from '../world/actionSystem.js';
import { PartyPingDraw } from '../render/partyPingDraw.js';
import { createPingLabels, pingDistanceText } from '../render/partyPingLabels.js';
import {
  PING_MARK_MS, PING_PATH_MS, PING_OUT_MS, PING_REACH_M, PING_GROUND_M, PING_COOLDOWN_MS, PING_ARRIVE_M,
  PING_WALL_NY, PING_WALL_BACK, PING_COLOR_MINE, PING_COLOR_MATE,
  aimPoint, placeOk, pingPlace, fadeAlpha, settleAim, pingGround, groundRoute, markUnderLook, buildingStop,
} from '../systems/party/partyPing.js';

/** Unlocked action doors, left out of the soup the way the dungeon's bake leaves them
 *  (dungeonContext.js's own exclude: a door a walker opens is not a wall). */
function openDoors(actions) {
  const out = new Set();
  const objs = actions?.objects;
  if (!objs || typeof objs.values !== 'function') return out;
  for (const o of objs.values()) if (isActionDoorObject(o) && !(o.currentLockValue > 0)) out.add(o.key);
  return out;
}

const dist2 = (a, b) => {
  const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
  return dx * dx + dy * dy + dz * dz;
};

/** A knee-height step hits a mesh before it arrives: a building, a rock, a wall. The ground is not a mesh. */
function kneeClear(col, a, b) {
  if (!col?.raycastHit) return true;
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  if (!(len > 0.05)) return true;
  const hit = col.raycastHit([a[0], a[1] + 0.85, a[2]], [dx / len, dy / len, dz / len], len);
  return !(hit && Number.isFinite(hit.dist) && hit.dist < len - 0.25);
}

/**
 * @param {{
 *   now: () => number,
 *   pressed: () => boolean,
 *   blocked: () => boolean,
 *   mode: () => string,
 *   place: () => { k: string, space: string }|null,
 *   collider: () => { raycastHit?: (o: ArrayLike<number>, d: ArrayLike<number>, m: number) => { dist: number, key?: string|null, normal?: number[] }, surfaceHit?: (o: ArrayLike<number>, d: ArrayLike<number>, m: number) => { dist: number, key?: string|null, normal?: number[] }, raycast?: (o: ArrayLike<number>, d: ArrayLike<number>, m: number) => number }|null,
 *   feet: () => ArrayLike<number>|null,
 *   toWire: (p: number[], space: string) => { x: number, y: number, z: number },
 *   fromWire: (pg: { x: number, y: number, z: number }, space: string) => number[],
 *   sound: () => void,
 *   navMesh?: () => object|null,
 *   actions?: () => object|null,
 *   ground?: (x: number, z: number) => number,
 *   clear?: (a: number[], b: number[]) => boolean,
 *   route?: (chf: object, from: ArrayLike<number>, to: number[]) => number[][]|null,
 *   subject?: (eye: ArrayLike<number>, dir: ArrayLike<number>, reach: number) => { name?: string, elite?: boolean, dist: number }|null,
 *   buildings?: () => ReadonlyArray<{ aabb: { min: number[], max: number[] } }>|null,
 *   project?: (p: number[]) => { x: number, y: number, front: boolean }|null,
 *   travel?: () => boolean,
 *   author?: () => string,
 *   mateName?: (acct: string) => string,
 * }} deps
 */
export function createPartyPingHost(deps) {
  /**
   * @typedef {{ id: string, at: number[], wire?: { x: number, y: number, z: number }, born: number, lifeUntil: number, markUntil: number, pathUntil: number, color: readonly number[], k: string, space: string, hold: boolean, mine: boolean, acct: string|null, name: string, elite: boolean }} PingMark
   */
  /** @type {PingMark[]} */
  const marks = [];
  /** @type {Map<string, number>} */
  const heard = new Map();
  let lastCast = -1e9;
  /** @type {{ k: string, x: number, y: number, z: number, at: number, n?: string, e?: number }|null} */
  let pg = null;
  let pgUntil = 0;
  let unsent = false;
  /** @type {number[][]|null} */
  let path = null;
  /** @type {readonly number[]} */
  let pathColor = PING_COLOR_MINE;
  let pathAt = -1e9;
  /** @type {number[]|null} */
  let pathFrom = null;
  /** @type {object|null} */
  let pathGoal = null;
  /** @type {PingMark|null} */
  let follow = null;
  /** @type {ArrayLike<number>|null} */
  let lookEye = null;
  /** @type {ReturnType<typeof createPingLabels>|null} */
  let labels = null;
  let lid = 1;
  /** @type {{ pts: number[][], color: readonly number[], born: number, until: number, goalId: object }|null} */
  let ribbon = null;
  /** @type {{ pts: number[][], color: readonly number[], born: number, until: number }|null} */
  let ribbonOut = null;
  let placeKey = '';
  /** @type {object|null} */
  let chf = null;
  let baking = false;
  /** @type {string|null} */
  let bakeFailed = null;
  /** @type {NavClient|null} */
  let nav = null;
  /** @type {PartyPingDraw|null} */
  let drawPass = null;
  const route = deps.route ?? ((mesh, from, to) => findPath(mesh, from, to));

  const expire = (now) => {
    for (let i = marks.length - 1; i >= 0; i--) {
      const m = marks[i];
      if (m === follow) continue;
      if (now >= m.markUntil && now >= m.pathUntil) marks.splice(i, 1);
    }
    if (ribbonOut && now >= ribbonOut.until) ribbonOut = null;
    if (pg && now > pgUntil) { pg = null; unsent = false; }
  };

  /** A mark fades out. The one being followed is let go with it. */
  const fadeMark = (m, now) => {
    const dead = now + PING_OUT_MS;
    m.hold = false;
    if (m.markUntil > dead) m.markUntil = dead;
    if (m.pathUntil > dead) m.pathUntil = dead;
    if (follow === m) { follow = null; if (ribbon) present(null, pathColor, now, now, null); }
  };

  /** My own showing ping gives way. A mate's mark, and the one I follow, stay. */
  const retireMine = (now) => {
    for (const m of marks) if (m.mine && m.hold) fadeMark(m, now);
  };

  const shown = (m, place) => !!place && !!m && (m.k === place.k || (place.space === 'world' && m.space === 'world'));

  /** An outdoor point is kept in world metres, so a shift of the scene origin leaves it where it was named. */
  const placeAt = (m) => {
    if (m.space !== 'world' || !m.wire) return;
    const at = deps.fromWire(m.wire, 'world');
    if (at && at.every(Number.isFinite)) m.at = at;
  };

  const alphaOf = (m, now) => {
    const until = m === follow ? Math.max(m.markUntil, now + PING_OUT_MS + 50) : m.markUntil;
    if (now >= until || now < m.born) return 0;
    return fadeAlpha(now, m.born, until);
  };

  const present = (pts, color, now, until, goalId) => {
    if (pts && ribbon && ribbon.goalId === goalId) {
      ribbon.pts = pts; ribbon.color = color; ribbon.until = until;
      return;
    }
    if (ribbon?.pts) ribbonOut = { pts: ribbon.pts, color: ribbon.color, born: now - PING_OUT_MS, until: Math.min(ribbon.until, now + PING_OUT_MS) };
    ribbon = pts && pts.length > 1 ? { pts, color, born: now, until, goalId } : null;
  };

  const forgetMesh = () => {
    chf = null;
    baking = false;
    bakeFailed = null;
    path = null;
    ribbon = null;
    ribbonOut = null;
    if (nav) { nav.dispose(); nav = null; }
  };

  const askBake = (feet, key) => {
    if (deps.navMesh?.() || baking || chf || bakeFailed === key) return;
    const col = deps.collider();
    if (!col) return;
    baking = true;
    nav = nav ?? new NavClient();
    const anchor = [feet[0], feet[1], feet[2]];
    nav.bake({ collider: col, anchor, exclude: openDoors(deps.actions?.() ?? null), key: `ping:${key}` })
      .then((b) => { if (placeKey === key) chf = b?.chf ?? null; })
      .catch(() => { if (placeKey === key) chf = null; })
      .finally(() => { baking = false; if (placeKey === key && !chf) bakeFailed = key; });
  };

  const retarget = (now, feet, place) => {
    const goal = follow;
    if (!feet || !goal || !shown(goal, place) || place.space === 'interior') {
      path = null; pathGoal = null;
      if (ribbon) present(null, pathColor, now, now, null);
      return;
    }
    if (dist2(feet, goal.at) <= PING_ARRIVE_M * PING_ARRIVE_M) {
      path = null; pathGoal = null;
      if (ribbon) present(null, pathColor, now, now, null);
      return;
    }
    const moved = !pathFrom || dist2(feet, pathFrom) > 1.5 * 1.5;
    if (path && pathGoal === goal && !moved && now - pathAt < 400) return;
    pathAt = now;
    pathFrom = [feet[0], feet[1], feet[2]];
    pathGoal = goal;
    pathColor = goal.color;
    if (place.space === 'world') {
      path = null;
      if (!deps.ground) { present(null, pathColor, now, now, goal); return; }
      let pts = null;
      try { pts = groundRoute(feet, goal.at, deps.ground, deps.clear ?? ((a, b) => kneeClear(deps.collider(), a, b))); } catch { pts = null; }
      path = pts && pts.length > 1 ? pts : null;
      present(path, pathColor, now, goal.pathUntil, goal);
      return;
    }
    const mesh = deps.navMesh?.() ?? chf;
    if (!mesh) { path = null; present(null, pathColor, now, now, goal); askBake(feet, place.k); return; }
    let pts = null;
    try { pts = route(mesh, feet, goal.at); } catch { pts = null; }
    path = pts && pts.length > 1 ? pts : null;
    present(path, pathColor, now, goal.pathUntil, goal);
  };

  /** A look: follow a mate's mark under it, or name a point of my own. */
  const cast = ({ eye, dir, reach = undefined }) => {
    const now = deps.now();
    const place = deps.place();
    if (deps.blocked() || !place || !eye || !dir || now - lastCast < PING_COOLDOWN_MS) return false;
    const cap = reach ?? (place.space === 'world' ? PING_GROUND_M : PING_REACH_M);
    const under = markUnderLook(eye, dir, marks.filter((m) => shown(m, place) && (m === follow || (m.hold && now < m.markUntil))));
    if (under) {
      lastCast = now;
      if (follow === under) {
        follow = null;
        if (ribbon) present(null, pathColor, now, now, null);
        if (now >= under.lifeUntil) fadeMark(under, now);
      } else follow = under;
      return true;
    }
    let sub = null;
    try { sub = deps.subject?.(eye, dir, cap) ?? null; } catch { sub = null; }
    let at = null, name = '', elite = false;
    if (place.space === 'world' && typeof deps.ground === 'function') {
      const g = pingGround(eye, dir, deps.ground, cap);
      const gDist = g ? Math.hypot(g[0] - eye[0], g[1] - eye[1], g[2] - eye[2]) : Infinity;
      const shell = buildingStop(eye, dir, deps.collider(), deps.buildings?.() ?? null, cap);
      const limit = Math.min(gDist, shell?.dist ?? Infinity);
      if (sub && Number.isFinite(sub.dist) && sub.dist <= limit + 0.75) {
        at = aimPoint(eye, dir, sub.dist, cap); name = sub.name || ''; elite = !!sub.elite;
      } else if (shell && shell.dist < gDist) {
        at = aimPoint(eye, dir, Math.max(0.2, shell.dist - 0.35), cap);
      } else at = g;
    } else {
      const col = deps.collider();
      const look = (o, d, m) => (col?.surfaceHit ? col.surfaceHit(o, d, m) : col?.raycastHit?.(o, d, m)) ?? null;
      const hit = look(eye, dir, cap);
      let down = null;
      if (hit?.normal && hit.normal[1] < PING_WALL_NY && Number.isFinite(hit.dist)) {
        const pulled = aimPoint(eye, dir, Math.max(0.2, hit.dist - PING_WALL_BACK), cap);
        if (pulled) down = look(pulled, [0, -1, 0], 8);
      }
      const floor = settleAim(eye, dir, hit, down);
      const hitDist = Number.isFinite(hit?.dist) ? hit.dist : Infinity;
      if (sub && Number.isFinite(sub.dist) && sub.dist <= hitDist + 0.75) {
        at = aimPoint(eye, dir, sub.dist, cap); name = sub.name || ''; elite = !!sub.elite;
      } else at = floor;
    }
    if (!at || !placeOk(place.k)) return false;
    lastCast = now;
    retireMine(now);
    const wire = deps.toWire(at, place.space);
    pg = { k: place.k, x: wire.x, y: wire.y, z: wire.z, at: Math.round(now) };
    if (name) pg.n = name;
    if (elite) pg.e = 1;
    pgUntil = now + PING_PATH_MS;
    unsent = true;
    marks.push({
      id: `p${lid++}`, at, wire, born: now, lifeUntil: now + PING_MARK_MS, markUntil: now + PING_MARK_MS, pathUntil: pgUntil,
      color: PING_COLOR_MINE, k: place.k, space: place.space, hold: true, mine: true, acct: null, name, elite,
    });
    deps.sound();
    return true;
  };

  return {
    /** One frame. `eye` and `dir` are the look the picture is drawn along. */
    frame({ eye, dir }) {
      const now = deps.now();
      const place = deps.place();
      const key = place?.k ?? '';
      if (key !== placeKey) { placeKey = key; forgetMesh(); }
      for (const m of marks) placeAt(m);
      if (follow && place && !shown(follow, place)) follow = null;
      lookEye = eye ?? lookEye;
      expire(now);
      if (deps.pressed()) cast({ eye, dir });
      if (place) retarget(now, deps.feet(), place);
    },
    /** A look from a view that already swallowed the button (the travel map). */
    cast,
    /** A party mate's pose. The same stamp twice is one ping. */
    hear(acct, p) {
      const g = p?.pg;
      if (!g || !placeOk(g.k) || !Number.isFinite(g.at)) return;
      const place = deps.place();
      if (!place || place.k !== g.k) return;
      const id = String(acct);
      if (heard.get(id) === g.at) return;
      const now = deps.now();
      if (now - g.at > PING_PATH_MS || now - g.at < -2000) return;
      heard.set(id, g.at);
      const at = deps.fromWire(g, place.space);
      if (!at || !at.every(Number.isFinite)) return;
      for (const m of marks) if (m.acct === id && m.hold) fadeMark(m, now);
      const left = g.at + PING_MARK_MS - now;
      const name = typeof g.n === 'string' ? g.n : '';
      marks.push({
        id: `p${lid++}`, at, wire: { x: g.x, y: g.y, z: g.z }, born: now, lifeUntil: g.at + PING_MARK_MS,
        markUntil: now + Math.max(0, Math.min(PING_MARK_MS, left)), pathUntil: g.at + PING_PATH_MS,
        color: PING_COLOR_MATE, k: g.k, space: place.space, hold: true, mine: false, acct: id, name, elite: g.e === 1,
      });
      deps.sound();
    },
    /** The pose's `pg`, while the route is still worth saying. */
    poseField() {
      expire(deps.now());
      return pg ? { pg } : {};
    },
    unsent() { return unsent && !!pg; },
    sent() { unsent = false; },
    /** The marks still on screen, for the test. */
    points() {
      const now = deps.now();
      const out = [];
      for (const m of marks) {
        const alpha = alphaOf(m, now);
        if (alpha <= 0.004) continue;
        out.push({ at: m.at, alpha, hold: m.hold });
      }
      return out;
    },
    /** Whether a route is showing, before its fade-out. */
    line() { return !!(ribbon && ribbon.pts && ribbon.pts.length > 1); },
    /** After the opaque world, in the veiled-bodies' slot. */
    draw(renderer) {
      const now = deps.now();
      const place = deps.place();
      for (const m of marks) placeAt(m);
      const live = [];
      const rows = [];
      const eye = lookEye;
      for (const m of marks) {
        if (!shown(m, place)) continue;
        const alpha = alphaOf(m, now);
        if (alpha <= 0.004) continue;
        live.push({ at: m.at, color: m.color, alpha });
        if (eye && deps.project) {
          const at = deps.project(m.at);
          if (at?.front) {
            const c = m.color;
            rows.push({
              id: m.id, x: at.x, y: at.y, name: m.name, elite: m.elite, alpha,
              author: m.mine ? (deps.author?.() || '') : (deps.mateName?.(m.acct) || ''),
              color: `rgb(${(c[0] * 255) | 0},${(c[1] * 255) | 0},${(c[2] * 255) | 0})`,
              dist: pingDistanceText(Math.hypot(eye[0] - m.at[0], eye[1] - m.at[1], eye[2] - m.at[2])),
            });
          }
        }
      }
      if (deps.project) { labels = labels ?? createPingLabels(); labels.sync(rows, now); }
      const ribbons = [];
      const pushR = (r) => {
        if (!r?.pts || r.pts.length < 2 || now >= r.until || now < r.born) return;
        const alpha = fadeAlpha(now, r.born, r.until);
        if (alpha <= 0.004) return;
        ribbons.push({ pts: r.pts, color: r.color, alpha });
      };
      pushR(ribbonOut);
      pushR(ribbon);
      if (!live.length && !ribbons.length) return;
      try {
        drawPass = drawPass ?? new PartyPingDraw(renderer.gl);
        drawPass.draw(renderer, live, ribbons);
      } catch (e) { console.warn('[party-ping] draw', e?.message ?? e); }
    },
    dispose() {
      forgetMesh();
      try { labels?.dispose(); } catch { /* the page is already gone */ }
      labels = null;
      try { drawPass?.dispose(); } catch { /* the context is already gone */ }
      drawPass = null;
    },
  };
}

/**
 * The world host's door (scenes/world.js). The place, and the world's
 * floating origin, are asked here so that host stays a wire.
 * @param {{
 *   now: () => number, pressed: () => boolean, blocked: () => boolean, mode: () => string,
 *   identity: () => object|null, pixel: () => { x: number, y: number }|null,
 *   collider: () => object|null, feet: () => ArrayLike<number>|null,
 *   worldOf: (p: number[]) => { x: number, y: number, z: number },
 *   sceneOf: (pg: { x: number, y: number, z: number }) => number[],
 *   sound: () => void, navMesh?: () => object|null, actions?: () => object|null,
 *   ground?: (x: number, z: number) => number,
 *   route?: (chf: object, from: ArrayLike<number>, to: number[]) => number[][]|null,
 *   subject?: (eye: ArrayLike<number>, dir: ArrayLike<number>, reach: number) => { name?: string, elite?: boolean, dist: number }|null,
 *   buildings?: () => ReadonlyArray<{ aabb: { min: number[], max: number[] } }>|null,
 *   project?: (p: number[]) => { x: number, y: number, front: boolean }|null,
 *   travel?: () => boolean,
 *   author?: () => string,
 *   mateName?: (acct: string) => string,
 * }} deps
 */
export function createWorldPartyPing(deps) {
  return createPartyPingHost({
    now: deps.now,
    pressed: deps.pressed,
    blocked: deps.blocked,
    mode: deps.mode,
    place: () => pingPlace(deps.mode(), deps.identity(), deps.pixel()),
    collider: deps.collider,
    feet: deps.feet,
    toWire: (p, space) => (space === 'world' ? deps.worldOf(p) : { x: p[0], y: p[1], z: p[2] }),
    fromWire: (pg, space) => (space === 'world' ? deps.sceneOf(pg) : [pg.x, pg.y, pg.z]),
    sound: deps.sound,
    navMesh: deps.navMesh,
    actions: deps.actions,
    ground: deps.ground,
    route: deps.route,
    subject: deps.subject,
    buildings: deps.buildings,
    project: deps.project,
    travel: deps.travel,
    author: deps.author,
    mateName: deps.mateName,
  });
}
