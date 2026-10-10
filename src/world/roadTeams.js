// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LW10 (2026-10-09, bible/06-Systems/Living-World-II.md "LW10"): THE ROAD'S TEAMS, SEEN - the horses and the wagons of
// the living world's parties (systems/livingWorld/wagons.js: where each stands), drawn with Horse Cart and Cargo's own
// pieces (Living World II decision 4): the wagon classic model 41214 in its five parts with its cargo by tier (the pool's
// `presentation.drawWagon` - ONE MEMBER, ONE EXPORT), the horse the mod's eight-way billboard off its own art (the pool's
// `presentation.poseHorse`, its frames stepped by horseCartLaw.js stepHorseWalk at the team's pace). Neither needs the
// mod switched on: the pool's pieces are built whatever its switch says.
//
// A STANDING wagon (camped, halted) stands its box on the host's collider (the parked team's law: usableBounds of the
// model's bounds, horseCartPool.js boxTriangles), each in a bucket of its own, taken down when it moves or leaves the
// list; a moving one claims nothing, as a walker claims no tile.
//
// EVERY ALLOCATION HAS AN OWNER: each horse's billboard batch is made with it and destroyed as it leaves the list, and
// `clear()` destroys every one and takes down every box (the roads' own clear: indoors, a mode's change, the teardown).
// The meshes are the pool's, held for the session (the pool's own law).
import { mat4FromQuatPos, quatLookRotation } from './quat.js';
import { usableBounds } from '../systems/wagon41214.js';
import { boxTriangles, HORSE_ARCHIVE, horseStillRecord, HORSE_BILLBOARD_WIDTH, HORSE_BILLBOARD_HEIGHT } from '../scenes/horseCartPool.js';
import { stepHorseWalk, freshHorseWalk, NORMAL_GROUND_OFFSET } from '../systems/horseCartLaw.js';
import { wheelAngleAt, HITCH_N } from '../systems/livingWorld/wagons.js';
import { NATIVE_PER_M } from '../systems/travelDungeons.js';

/** WAGONS1 x LW10: THE LIVING WORLD'S WAGON is the Small Cart - the classic transport's kind (Mac's wagon of it where
 *  his are drawn, Daggerfall's 41214 where they are not), whatever the player drives: the pool's draw and parts default
 *  to the player's own kind, and a merchant's caravan wore the player's caravan, its wheels still (the draw's `turn` an
 *  object now). */
export const ROAD_WAGON_KIND = 'cart';
/** The most wagons drawn at once (the nearest) - each is five meshes and up to twelve cargo pieces. */
export const WAGONS_DRAWN = 6;
/** The collider's bucket for a standing wagon. @param {string} key */
export const wagonBucket = (key) => `lwWagon:${key}`;

/**
 * @typedef {{ key: string, feet: number[], yaw: number, moving: boolean, speed: number, distM: number }} HorseShown - scene
 * @typedef {{ key: string, feet: number[], front: number[], yaw: number, moving: boolean, tier: number, s: number, distM: number, hitched?: boolean }} WagonShown -
 *   `feet` the axle's ground (scene), `front` the ground a wagon's length before it (the tilt's), `s` the distance walked
 *   (native), `hitched` its horse in its shafts (wagons.js)
 */

/**
 * @param {{ renderer: any, presentation: () => any, collider?: () => any }} deps - `presentation()` the HCC pool's (null
 *   while there is none)
 */
export function createRoadTeams({ renderer, presentation, collider = () => null }) {
  /** @type {Map<string, { batch: any, walk: any }>} */
  const horses = new Map();
  /** @type {Map<string, Float64Array>} the boxes standing, by wagon key */
  const boxes = new Map();
  /** @type {any[]} */
  const drawn = [];
  /** @type {{ position: number[], rotation: number[], tier: number, angle: number, grow: number, hitched: boolean }[]} */
  let wagons = [];

  function dropHorse(key) {
    const h = horses.get(key);
    if (h?.batch) renderer?.destroyBillboardBatch?.(h.batch);
    horses.delete(key);
  }
  function takeDown(key) {
    collider()?.removeBucket?.(wagonBucket(key));
    boxes.delete(key);
  }

  /**
   * One frame: the horses posed (each its own batch), the wagons to draw (the nearest WAGONS_DRAWN), the standing ones'
   * boxes stood. `eye` the frame's eye; `grow` the Overworld's (1 on the ground: under it, nothing stands).
   * @param {HorseShown[]} horseList @param {WagonShown[]} wagonList
   * @param {{ dt?: number, eye?: number[], grow?: number, ground?: boolean }} [o]
   */
  function sync(horseList, wagonList, { dt = 0, eye = [0, 0, 0], grow = 1, ground = true } = {}) {
    drawn.length = 0;
    const pres = presentation();
    const art = pres?.horseArt;
    if (art) { art.ensureStationary?.(); art.ensureWalk?.(); }
    // the wagons drawn: the nearest WAGONS_DRAWN (their poses below, after the horses)
    const near = [...wagonList].sort((a, b) => a.distM - b.distM).slice(0, WAGONS_DRAWN);
    // AUDIT LW-II-2 R11: THE CAP TAKES A TEAM WHOLE - a wagon's horse (`<trip>:h<i>`, its wagon `<trip>:w<i>`, wagons.js)
    // is posed only where its wagon is drawn; a pack horse, no wagon of its own, as ever. Before, past the cap the wagon
    // was dropped and its horse walked the road drawing nothing
    const drawnW = new Set(near.map((w) => w.key)), listed = new Set(wagonList.map((w) => w.key));
    const capped = (/** @type {string} */ key) => { const w = key.replace(/:h(\d+)$/, ':w$1'); return w !== key && listed.has(w) && !drawnW.has(w); };
    const seen = new Set();
    for (const h of horseList) {
      if (capped(h.key)) continue;
      seen.add(h.key);
      let s = horses.get(h.key);
      if (!s) {
        const batch = renderer?.createBillboardBatch?.(HORSE_ARCHIVE, horseStillRecord(0), { w: HORSE_BILLBOARD_WIDTH, h: HORSE_BILLBOARD_HEIGHT }, [[0, 0, 0]]) ?? null;
        if (batch) batch.origin = [0, 0, 0];
        s = { batch, walk: freshHorseWalk() };
        horses.set(h.key, s);
      }
      s.walk = stepHorseWalk(s.walk, h.moving ? h.speed : 0, dt, !!art?.hasWalk?.());
      if (!s.batch || !pres?.poseHorse) continue;
      pres.poseHorse(s.batch, eye, { position: h.feet, forward: [Math.sin(h.yaw), 0, Math.cos(h.yaw)], frame: s.walk.animationFrame ?? 0 });
      if (grow > 1 && s.batch.size) s.batch.size = { w: s.batch.size.w * grow, h: s.batch.size.h * grow };
      drawn.push(s.batch);
    }
    for (const key of [...horses.keys()]) if (!seen.has(key)) dropHorse(key);
    // the wagons: the nearest, each its pose; a standing one's box on the collider
    const parts = (pres?.partsOf ? pres.partsOf(ROAD_WAGON_KIND) : pres?.wagonParts?.()) ?? null;   // the road's kind's, never the driven
    wagons = [];
    const stand = new Set();
    for (const w of near) {
      const up = [w.front[0] - w.feet[0], w.front[1] - w.feet[1], w.front[2] - w.feet[2]];
      const len = Math.hypot(up[0], up[1], up[2]);
      const forward = len > 1e-6 ? [up[0] / len, up[1] / len, up[2] / len] : [Math.sin(w.yaw), 0, Math.cos(w.yaw)];
      const rotation = quatLookRotation(forward, [0, 1, 0]);
      const position = [w.feet[0], w.feet[1] + NORMAL_GROUND_OFFSET, w.feet[2]];
      wagons.push({ position, rotation, tier: w.tier, angle: parts ? wheelAngleAt(w.s, parts.wheelRadius) : 0, grow, hitched: w.hitched !== false });
      if (!w.moving && ground && grow <= 1 && parts) {
        stand.add(w.key);
        const m = mat4FromQuatPos(rotation, position);
        const was = boxes.get(w.key);
        if (!was || was.some((v, i) => Math.abs(v - m[i]) >= 5e-4)) {
          const col = collider();
          if (col?.addMesh) {
            col.removeBucket?.(wagonBucket(w.key));
            const b = usableBounds(parts.bounds);
            const tri = boxTriangles(b.min, b.max);
            col.addMesh(wagonBucket(w.key), tri.positions, tri.indices, m);
            boxes.set(w.key, Float64Array.from(m));
          }
        }
      }
    }
    for (const key of [...boxes.keys()]) if (!stand.has(key)) takeDown(key);
  }

  return {
    sync,
    /** The axle's way back from its horse for the road's wagon (native): the pool's own for its kind (WAGONS1 - Mac's
     *  Small Cart stands 3.8 m behind its horse, the classic 3.1), the mod's HITCH_N while there is no pool. */
    hitchN() {
      const m = presentation()?.hitchOfKind?.(ROAD_WAGON_KIND);
      return Number.isFinite(m) && m > 0 ? m * NATIVE_PER_M : HITCH_N;
    },
    /** This frame's horse billboards (the exterior's billboard pass). */
    batches: () => drawn,
    /** The wagons, in the host's world mesh pass. @param {any} r @param {any} [texRemap] */
    draw(r, texRemap = null) {
      const pres = presentation();
      if (!pres?.drawWagon) return 0;
      let n = 0;
      // WAGONS2's draw: its wheels' `turn` an object, the kind the road's, hitched as it stands (unhitched at camp)
      for (const w of wagons) if (pres.drawWagon(r, texRemap, w.position, w.rotation, w.tier, { angle: w.angle }, w.grow, ROAD_WAGON_KIND, w.hitched)) n++;
      return n;
    },
    /** What stands this frame (the probes; the pins). */
    shown: () => ({ horses: horses.size, wagons: wagons.length, boxes: [...boxes.keys()] }),
    /** Every batch destroyed and every box taken down. */
    clear() {
      for (const key of [...horses.keys()]) dropHorse(key);
      for (const key of [...boxes.keys()]) takeDown(key);
      wagons = [];
      drawn.length = 0;
    },
  };
}
