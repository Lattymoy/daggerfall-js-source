// @ts-check
// QUAYS (2026-10-03; systems/naval/quays.js, world/quayModel.js) - THE QUAYS THE WORLD HOST STANDS: the pool on the
// runtime pools' shape (scenes/bountyFarms.js, scenes/gate/gatePool.js) - each berth's quay a model of its own, its
// collider bucket, drawn in the host's world pass, its lanterns lit in the lanterns' hours; and the gangways run out to
// the player's ships made fast at them.
//
// NOTHING HERE IS SAVED OR SENT. A quay is a function of the harbour the naval host found off the terrain (shipLife.js
// findHarbour - every client finds the same one) and the ground behind it, so every player in a port sees the same
// quays, and nothing is left to clean up after a crash or a load.
//
// ITS LIFE: a harbour the naval host knows (`harbours()`, its berths moved with the floating origin in place) stands
// its quays while its mouth is within QUAY_STAND_M of the player - so they are there as a ship sails in, well before
// she makes her berth; past QUAY_LEAVE_M they come down, as they do with the harbour itself (a transition, a fast
// travel - the naval host forgets its harbours) and outside the street. A berth whose ground is not built yet (a far
// pixel still streaming) is laid again QUAY_RETRY_S later. Each quay's collider is a still bucket, its triangles baked
// where its berth lies on the sea's top - AUDIT HOLDINGS Q7: never a mover's (a bucket with a translation is never
// filed in the broadphase, so every ray and sweep asked each quay, and its closure built an array each time) - stood
// again where the berth lies after a recentre (`offsetAll`, after the naval host's moved the berths).
//
// Not a DFU member. Ledger A (QUAYS).
import { planQuay, lanternLights, QUAY_DECK_UP } from '../systems/naval/quays.js';
import { buildQuayModel, buildGangwayModel } from '../world/quayModel.js';
import { trs } from '../world/mat4.js';
import { portPlaceName } from '../systems/portPlaces.js';   // SHIPYARDS-FOUND: the docks' name on the Overworld

/** A harbour's quays stand while its mouth is within this of the player (m), and come down past QUAY_LEAVE_M. */
export const QUAY_STAND_M = 1600;
export const QUAY_LEAVE_M = 2000;
/** A berth whose ground was not built is laid again after this (s). */
export const QUAY_RETRY_S = 2;
/** The lanterns lit: the nearest QUAY_LIGHTS_MAX within QUAY_LIGHT_REACH of the player, each reaching this far (m). */
export const QUAY_LIGHTS_MAX = 6;
export const QUAY_LIGHT_REACH = 120;
export const QUAY_LIGHT_RANGE = 14;
/** The collider's bucket prefix - one bucket a berth. */
export const QUAY_BUCKET = 'quay:';
/** SHIPYARDS-FOUND: how far over the first laid quay's deck the docks' Overworld mark stands (m). */
export const DOCKS_MARK_LIFT = 4;

const DEG = 180 / Math.PI;

/**
 * @param {{
 *   renderer?: any,                                      // createMesh / destroyMesh / drawMesh
 *   prepare?: (model: any) => Promise<void>,             // the model's classic textures, loaded and uploaded
 *   collider: () => any,                                 // the exterior collider (addMesh / removeBucket)
 *   harbours: () => Array<{ key: string, name?: string|null, harbour: any }>,   // the naval host's known harbours
 *   seaY: () => number,                                  // the sea's top in the scene now
 *   groundAt: (x: number, z: number) => number,          // the ground (the carved sea's floor) - not finite: not built
 *   feet: () => (number[] | null),
 *   mode: () => string,                                  // 'exterior' | 'dungeon' | 'interior'
 *   gangways?: () => Array<{ foot: number[], head: number[] }>,   // the gangways run out now, scene points
 *   now?: () => number,                                  // seconds
 * }} deps
 */
export function createQuayPool(deps) {
  /** key -> { key, name, harbour, berths: [{ index, berth, plan, gpu, bucket, retryAt }] } */
  const quays = new Map();
  let gangwayGpu = null;
  const now = () => deps.now?.() ?? performance.now() / 1000;

  function takeDownBerth(b) {
    try { deps.collider()?.removeBucket?.(b.bucket); } catch { /* the collider went with the scene */ }
    if (b.gpu) { try { deps.renderer?.destroyMesh?.(b.gpu); } catch { /* the context went first */ } }
    b.gpu = null; b.dead = true;
  }
  function takeDown(q) {
    for (const b of q.berths) takeDownBerth(b);
    quays.delete(q.key);
  }
  function destroyAll() {
    for (const q of [...quays.values()]) takeDown(q);
    // AUDIT HOLDINGS Q9: the gangway's mesh freed with them, made again when one is next run out
    if (gangwayGpu && !gangwayGpu.pending) { try { deps.renderer?.destroyMesh?.(gangwayGpu); } catch { /* the context went first */ } }
    gangwayGpu = null;
  }

  /** The berth's collider: its model's triangles baked where the berth lies on the sea's top now (a still bucket). */
  function standCollider(b) {
    const col = deps.collider();
    if (!col?.addMesh || !b.model) return;
    col.removeBucket?.(b.bucket);
    const c = b.model.collider ?? b.model;   // the solid part alone (world/quayModel.js - AUDIT SHIPYARDS L5-5)
    col.addMesh(b.bucket, c.positions, c.indices, trs(b.berth.pos[0], deps.seaY(), b.berth.pos[1], 0, b.plan.frame.theta * DEG, 0));
    b.stood = true;
  }
  /** AUDIT HOLDINGS Q7: the world moved (the floating origin) - each quay's collider stood again where its berth lies now. */
  function offsetAll() { for (const q of quays.values()) for (const b of q.berths) if (b.stood && !b.dead) standCollider(b); }

  /** Lay one berth's quay: its plan off the ground, its model, its textures, its mesh and its collider. */
  async function lay(q, b) {
    // QUAY-CROSSING: planned after every earlier berth (frame's order), its jetty ending on their piers
    const others = q.berths.slice(0, b.index).map((o) => ({ plan: o.plan, origin: o.berth.pos }));
    b.plan = planQuay({ berth: b.berth, hull: q.harbour.hull, key: q.key, index: b.index, seaY: deps.seaY(), groundAt: deps.groundAt, others });
    if (!b.plan) { b.retryAt = now() + QUAY_RETRY_S; return; }   // the ground behind it is not up yet
    b.model = buildQuayModel(b.plan);
    b.laying = true;
    try { await deps.prepare?.(b.model); } catch { /* an undressed quay is still a quay */ }
    b.laying = false;
    if (b.dead || quays.get(q.key) !== q) return;   // taken down while its textures came
    b.gpu = deps.renderer?.createMesh ? deps.renderer.createMesh(b.model) : null;
    standCollider(b);
  }
  /** A berth's lay that failed (a mesh that would not build): laid again QUAY_RETRY_S later - AUDIT HOLDINGS Q9: never
   *  left with its plan and no quay for good. */
  function layFailed(b) { b.laying = false; b.plan = null; b.model = null; b.retryAt = now() + QUAY_RETRY_S; }

  /** Bring the quays in line with the harbours known and the player's place. Call each frame (cheap when settled). */
  function frame() {
    if (deps.mode() !== 'exterior') { if (quays.size) destroyAll(); return; }
    const feet = deps.feet();
    const known = new Map();
    for (const h of deps.harbours() ?? []) if (h?.harbour?.berths?.length) known.set(h.key, h);
    for (const q of [...quays.values()]) {
      const h = known.get(q.key);
      const far = !feet || Math.hypot(q.harbour.mouth[0] - feet[0], q.harbour.mouth[1] - feet[2]) > QUAY_LEAVE_M;
      if (!h || h.harbour !== q.harbour || far) takeDown(q);   // forgotten, found again (a new frame), or left behind
    }
    if (!feet) return;
    const t = now();
    for (const h of known.values()) {
      let q = quays.get(h.key);
      if (!q) {
        if (Math.hypot(h.harbour.mouth[0] - feet[0], h.harbour.mouth[1] - feet[2]) > QUAY_STAND_M) continue;
        q = { key: h.key, name: h.name ?? null, harbour: h.harbour, berths: h.harbour.berths.map((berth, index) => ({ index, berth, plan: null, model: null, gpu: null, bucket: `${QUAY_BUCKET}${h.key}:${index}`, retryAt: 0, laying: false, dead: false })) };
        quays.set(h.key, q);
      }
      // QUAY-CROSSING: in the berths' order, a berth laid only once every earlier one has its plan - its jetty meets
      // theirs, so every client plans it against the same piers
      for (const b of q.berths) {
        if (b.plan) continue;
        if (b.laying || t < b.retryAt) break;
        lay(q, b).catch(() => layFailed(b));
        if (!b.plan) break;
      }
    }
  }

  /** The quays and the gangways, in the host's world pass. */
  function draw(r = deps.renderer) {
    if (!r?.drawMesh) return 0;
    const seaY = deps.seaY();
    let n = 0;
    for (const q of quays.values()) {
      for (const b of q.berths) {
        if (!b.gpu) continue;
        r.drawMesh(b.gpu, trs(b.berth.pos[0], seaY, b.berth.pos[1], 0, b.plan.frame.theta * DEG, 0), null);
        n++;
      }
    }
    const ways = deps.gangways?.() ?? [];
    if (ways.length && !gangwayGpu && r.createMesh) {
      const model = buildGangwayModel();
      const pending = gangwayGpu = { pending: true };
      // AUDIT HOLDINGS Q9: a mesh that would not build is tried again, never left pending for good; one taken down
      // (destroyAll) while its textures came is not stood
      Promise.resolve(deps.prepare?.(model)).catch(() => {}).then(() => {
        if (gangwayGpu !== pending) return;
        try { gangwayGpu = r.createMesh(model); } catch { gangwayGpu = null; }
      });
    }
    if (gangwayGpu && !gangwayGpu.pending) for (const w of ways) { r.drawMesh(gangwayGpu, gangwayMatrix(w.foot, w.head), null); n++; }
    return n;
  }

  /** The lanterns, in the lanterns' hours: the nearest QUAY_LIGHTS_MAX within QUAY_LIGHT_REACH of the player. */
  function lights() {
    const feet = deps.feet();
    if (!feet || !quays.size) return [];
    const seaY = deps.seaY(), out = [];
    for (const q of quays.values()) for (const b of q.berths) {
      if (!b.gpu) continue;
      // the berth's lights, made once and again only as it moves (AUDIT SHIPYARDS L5-5: made every night frame, and off
      // the plan's place - where it was laid, not where a recentre moved it)
      const pos = b.berth.pos;
      if (!b.lit || b.litY !== seaY || b.litAt[0] !== pos[0] || b.litAt[1] !== pos[1]) {
        b.lit = lanternLights(b.plan, seaY, pos).map((p) => ({ x: p[0], y: p[1], z: p[2], range: QUAY_LIGHT_RANGE }));
        b.litY = seaY; b.litAt = [pos[0], pos[1]];
      }
      for (const l of b.lit) {
        const dx = l.x - feet[0], dy = l.y - feet[1], dz = l.z - feet[2], d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d <= QUAY_LIGHT_REACH) out.push({ d, l });
      }
    }
    return out.sort((a, b) => a.d - b.d).slice(0, QUAY_LIGHTS_MAX).map((o) => o.l);
  }

  /** The berths whose quays stand, for the docking - `[{ key, index, berth, hull, name, plan }]`. */
  function standing() {
    const out = [];
    for (const q of quays.values()) for (const b of q.berths) if (b.gpu || b.plan) out.push({ key: q.key, index: b.index, berth: b.berth, hull: q.harbour.hull, name: q.name, plan: b.plan });
    return out;
  }

  /** AUDIT HOLDINGS Q9: whether berth `index` of harbour `key` has its quay laid - mesh and collider - for the gangway. */
  const laid = (key, index) => !!quays.get(key)?.berths[index]?.stood;
  /** SHIPYARDS-FOUND (2026-10-11, Mac: "Everything should show on the map/overworld"): each harbour whose quays stand, as
   *  an Overworld mark over its first laid quay - "<Town> Docks" (systems/portPlaces.js portPlaceName), its kind the look's
   *  (`yard docks` - ui/travel/travelViewHud.js portGlyph: a bollard) and the Towns switch's. */
  function overworldMarks() {
    const out = [];
    if (!quays.size) return out;
    const seaY = deps.seaY();
    for (const q of quays.values()) {
      const b = q.berths.find((x) => x.gpu);
      if (!b) continue;
      out.push({ key: `docks:${q.key}`, at: [b.berth.pos[0], seaY + QUAY_DECK_UP + DOCKS_MARK_LIFT, b.berth.pos[1]], label: portPlaceName('docks', { townName: q.name }), kind: 'yard docks' });
    }
    return out;
  }
  return { frame, draw, lights, destroyAll, offsetAll, standing, laid, overworldMarks, deckUp: QUAY_DECK_UP };
}

/**
 * The gangway's matrix: its model (a metre along +z) laid from `foot` to `head` (scene points) - turned to the way
 * between them, pitched up or down it, stretched to its length. Pure.
 * @param {number[]} foot @param {number[]} head
 */
export function gangwayMatrix(foot, head) {
  const dx = head[0] - foot[0], dy = head[1] - foot[1], dz = head[2] - foot[2];
  const flat = Math.hypot(dx, dz), len = Math.hypot(flat, dy) || 1;
  const yaw = Math.atan2(dx, dz), pitch = -Math.atan2(dy, flat);
  return trs(foot[0], foot[1], foot[2], pitch * DEG, yaw * DEG, 0, 1, 1, len);
}
