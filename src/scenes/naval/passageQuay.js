// @ts-check
// PASSAGE-QUAY (2026-10-27; bible/03-World/Passage.md PASSAGE-QUAY) - A BOOKED SHIP COMES IN TO HER PORT'S QUAY. Within
// BRING_IN_M of her port's harbour, a berth free, her master ends the journey and her crew warp her along the water's
// way to the berth, where QUAYS' docking makes her fast. Come Sail Away's `warp` seam lays her place, as QUAYS' does. A
// hull across her way holds her, as does a step that would lay her over land; held TOW_FOUL_S by a still one (or land),
// or TOW_WAIT_S in all, the quay is given up and the landfall stands. Ledger A (PASSAGE).
//   host = { harbours, isWater(x, z, hull), dockFree(key, i, boat), putOff(key, i), boatPose(boat),
//            ahead(p, dx, dz, far) -> { d, way }, enabled(), yawOf(rotation), now() }
import { dockFor, madeFast, warpStep } from '../../systems/naval/quays.js';
import { alongside, createWaterGrid, footprintClear } from '../../systems/naval/shipLife.js';
import { charterRecord } from '../../systems/naval/passage.js';
import { wrapAngle } from '../../world/mat4.js';
import { hullBuild } from '../../systems/naval/navalShips.js'; // her stem, where the look for a hull foul of her way begins
import { HULL_LEAD_MIN_MPS } from '../../systems/naval/seaClearance.js';

/** Within this of her port's harbour mouth (m), a free berth known there: her master brings her in. */
export const BRING_IN_M = 700;
/** Her way coming in (m/s), down to TOW_SLOW within TOW_EASE_M of her berth; her head comes round at TOW_TURN (rad/s). */
export const TOW_WAY = 4;
export const TOW_SLOW = 1.5;
export const TOW_EASE_M = 60;
export const TOW_TURN = 14 * (Math.PI / 180);
/** A point of her way reached within this (m). */
export const TOW_REACH_M = 10;
/** Her way's last point: this far out from her place alongside (m), inside QUAYS' DOCK_REACH_M, so the slant in from the
 *  berth's approach meets it within DOCK_ANGLE of the berth's line and the dock's warp lays her alongside from there. */
export const TOW_LEAD_M = 20;
/** A hull this near ahead (m) holds her; held this long (s) by one lying still, the quay is given up for her passage. */
export const TOW_FOUL_M = 25;
export const TOW_FOUL_S = 40;
/** AUDIT HORIZONTAL C10: a hull under way ahead (HULL_LEAD_MIN_MPS or more) is clearing her way - she waits on it, the
 *  wait bounded at TOW_WAIT_S in all: a ship leaving her berth at the slowest way that counts clears a Carrack's length
 *  and the hand's clearance (some 60 m) in two minutes. */
export const TOW_WAIT_S = 120;
/** A harbour whose berth the water gives her no way to is asked again only after this (s) - a way is a bounded search. */
export const TOW_RETRY_S = 10;
/** AUDIT HORIZONTAL C3: her way is planned this far clear of land past her beam (m), and she makes way only with her
 *  head within TOW_SWING of it - further off, she is warped round where she lies, so her hull keeps to the way. */
export const TOW_CLEAR_M = 3;
export const TOW_SWING = 10 * (Math.PI / 180);
const RING = Array.from({ length: 8 }, (_, k) => [Math.sin((k / 8) * 2 * Math.PI), Math.cos((k / 8) * 2 * Math.PI)]);

/** AUDIT HORIZONTAL C3: the water a way for `hull` is planned over - a point with water all round it out to her beam and
 *  TOW_CLEAR_M, so a way's leg and corners keep her sides off the land. */
export function beamWater(isWater, hull) {
  const r = hullBuild(hull).halfWidth + TOW_CLEAR_M;
  const beam = (/** @type {number} */ x, /** @type {number} */ z, /** @type {number} */ h) =>
    !!isWater(x, z, h) && RING.every(([sx, sz]) => isWater(x + sx * r, z + sz * r, h));
  return Object.assign(beam, { tile: isWater.tile }); // AUDIT SEA PATHS O3: the host's tiles, the grid's lines asked of each
}

/** @param {any} host */
export function createPassageQuay(host) {
  /** @type {{ boat: any, key: string, i: number, path: number[][], idx: number, foul: number, held: number, fast: boolean, gaveUp?: boolean } | null} */
  let tow = null;
  /** Her passage's quays given up (a way foul past TOW_FOUL_S) - never asked again for her; and the harbours with no way
   *  to a berth found, by when they were asked. */
  const refused = new Set(),
    noWay = new Map();

  /** Her port's harbour near her: the book's by her record's port name, its mouth within BRING_IN_M, and the first of
   *  its berths (the town's nearest first) free for her - `{ h, i }` or null. */
  function berthFor(boat, rec, at) {
    for (const h of host.harbours.values()) {
      const hb = h.harbour;
      if (!hb?.berths?.length || h.name !== rec.to.name || refused.has(h.key)) continue;
      if (host.now() - (noWay.get(h.key) ?? -Infinity) < TOW_RETRY_S) continue;
      if (Math.hypot(hb.mouth[0] - at[0], hb.mouth[1] - at[2]) > BRING_IN_M) continue;
      const i = hb.berths.findIndex((_, k) => host.dockFree(h.key, k, boat));
      if (i >= 0) return { h, i };
    }
    return null;
  }

  /** A voyage under way within reach of her port's harbour: her way in planned - the water's to the berth's approach,
   *  then in to TOW_LEAD_M off her place alongside it - the berth taken for her, and the tow begun. True when it began. */
  function begin(boat) {
    const rec = charterRecord(boat?.charter);
    if (!host.enabled() || !rec || !boat?.GameObject || tow?.boat === boat) return false;
    const at = boat.GameObject.position;
    const found = berthFor(boat, rec, at);
    if (!found) return false;
    const { h, i } = found,
      b = h.harbour.berths[i],
      grid = createWaterGrid({ isWater: beamWater(host.isWater, boat.hull), hull: boat.hull });
    const side = alongside(b, boat.hull, h.harbour.hull),
      end = [side[0] + b.normal[0] * TOW_LEAD_M, side[1] + b.normal[1] * TOW_LEAD_M];
    const a = grid.path([at[0], at[2]], b.approach),
      c = a ? grid.path(b.approach, end) : null;
    if (!a || !c) {
      noWay.set(h.key, host.now());
      return false;
    }
    tow = {
      boat,
      key: h.key,
      i,
      path: [...a, ...c.slice(1)].map((q) => [q[0], q[1]]),
      idx: 0,
      foul: 0,
      held: 0,
      fast: false,
    };
    host.putOff(h.key, i); // a ship coming in to it goes to another berth (QUAYS' own)
    return true;
  }

  /** THE TOW, one step of Come Sail Away's warp seam: her place and head `{ pos: [x, z], yaw }` - eased onto her berth by
   *  QUAYS' warp once it is in reach, else along her way in - or null where she is not the boat I bring in (the seam's
   *  own law then). A hull foul of her way holds her where she lies. */
  function step(boat, dt) {
    if (!tow || tow.boat !== boat || !host.enabled()) return null;
    const pose = host.boatPose(boat),
      p = pose.position,
      yaw = host.yawOf(pose.rotation);
    const h = host.harbours.get(tow.key),
      b = h?.harbour?.berths?.[tow.i];
    if (!b) {
      tow = null;
      return null;
    }
    const dock = dockFor({ pos: p, yaw, hull: boat.hull }, [
      { key: tow.key, index: tow.i, berth: b, hull: h.harbour.hull, name: h.name ?? null, free: true },
    ]);
    if (dock && (tow.fast || tow.idx >= tow.path.length - 1)) {
      if (madeFast({ pos: p, yaw }, dock)) tow.fast = true;
      const st = warpStep([p[0], p[2]], yaw, dock, dt);
      return { pos: st.pos, yaw: st.yaw };
    }
    if (tow.fast) {
      tow = null;
      return null;
    } // moved off her berth: the quay's work is done
    while (
      tow.idx < tow.path.length - 1 &&
      Math.hypot(tow.path[tow.idx][0] - p[0], tow.path[tow.idx][1] - p[2]) <= TOW_REACH_M
    )
      tow.idx++;
    const q = tow.path[tow.idx],
      dx = q[0] - p[0],
      dz = q[1] - p[2],
      d = Math.hypot(dx, dz);
    // her way's end reached and the dock not yet in reach of her head: she is warped round onto the berth's line where she lies
    const there = tow.idx >= tow.path.length - 1 && d <= TOW_REACH_M;
    const line = Math.abs(wrapAngle(b.yaw - yaw)) <= Math.PI / 2 ? b.yaw : wrapAngle(b.yaw + Math.PI);
    const want = there ? line : d > 1e-6 ? Math.atan2(dx, dz) : yaw;
    const turn = Math.max(-TOW_TURN * dt, Math.min(TOW_TURN * dt, wrapAngle(want - yaw)));
    const head = wrapAngle(yaw + turn),
      fx = Math.sin(head),
      fz = Math.cos(head);
    const bow = hullBuild(boat.hull).bowZ;
    /** Held where she lies, her head `y`: a hull foul of her way (she comes round still), or land under the step -
     *  AUDIT HORIZONTAL C10: a hull under way (`clearing`) runs the wait's clock alone, never the foul's. */
    const held = (y, clearing = false) => {
      if (!clearing) tow.foul += dt;
      tow.held += dt;
      if (tow.foul >= TOW_FOUL_S || tow.held >= TOW_WAIT_S) {
        refused.add(tow.key);
        tow = { ...tow, gaveUp: true };
        return null;
      }
      return { pos: [p[0], p[2]], yaw: y };
    };
    const hull = host.ahead([p[0] + fx * bow, p[1], p[2] + fz * bow], fx, fz, TOW_FOUL_M);
    if (hull.d < TOW_FOUL_M) return held(head, hull.way >= HULL_LEAD_MIN_MPS);
    const left = Math.hypot(b.pos[0] - p[0], b.pos[1] - p[2]);
    const way = left > TOW_EASE_M ? TOW_WAY : TOW_SLOW + (TOW_WAY - TOW_SLOW) * (left / TOW_EASE_M);
    // AUDIT HORIZONTAL C3: she is warped ALONG her way, never along her head, and only once her head lies near it
    const s = there
      ? Math.min(d, TOW_SLOW * dt)
      : Math.abs(wrapAngle(want - head)) <= TOW_SWING
        ? Math.min(d, way * dt)
        : 0;
    const k = d > 1e-6 ? s / d : 0;
    const next = { pos: [p[0] + dx * k, p[2] + dz * k], yaw: head };
    // and never laid over land: a step that would be is held, as for a hull (her turn alone where it fits) - unless she
    // lies over land already, when she is warped on as her way goes
    const fits = (q, y) => footprintClear(q, y, boat.hull, host.isWater);
    if (!fits(next.pos, head) && fits([p[0], p[2]], yaw)) return held(fits([p[0], p[2]], head) ? head : yaw);
    tow.foul = 0;
    tow.held = 0;
    return next;
  }

  /** Where my passage's boat stands with her quay: 'in' while she is brought in, 'fast' made fast at it, 'foul' her way
   *  in given up (said once, then null: the landfall's), else null. */
  function state(boat) {
    if (!tow || tow.boat !== boat) return null;
    if (tow.gaveUp) {
      tow = null;
      return 'foul';
    }
    return tow.fast ? 'fast' : 'in';
  }
  /** The world moved (the floating origin): her way with it. */
  function offset(o) {
    for (const q of tow?.path ?? []) {
      q[0] += o[0];
      q[1] += o[2];
    }
  }
  /** Her passage over (her boat, or its uid), or the sea cleared (nothing named): no tow. */
  function forget(boat = null) {
    if (boat != null && tow?.boat !== boat && !(tow?.boat?.uid != null && tow.boat.uid === boat)) return;
    tow = null;
    refused.clear();
    noWay.clear();
  }
  return { begin, step, state, offset, forget };
}
