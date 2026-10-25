// @ts-check
// FERRY-CLEAR (2026-10-24, Discord - "Ferrys still unstable": "Had several issues with the ferry ramming a neighbour
// ship till it broke, or running ashore"; bible/03-World/Passage.md FERRY-CLEAR) - THE SHIPS A JOURNEY'S HAND STEERS
// ROUND. The hand on a crossing's helm (OWS2, scenes/world.js tvSeaSail and systems/seaHelm.js) - a booked ship's master
// on a passage, the traveller's own on a crossing - looked at the water alone: a ship moored at the next berth along
// the quay she left from stood dead ahead of her, and the hand drove her into it. A ship's hull is as land to it now:
// how far along each of its looks the first hull stands, HULL_CLEAR_M off her side, is the lesser of that and the land
// (the naval host's `hullAlong` over the sea's ships afloat - navalHost.js). The port's own: Daggerfall has no sea.
import { segmentBoxEntry } from './navalBallistics.js';
import { SHIP_STATES } from './navalDamage.js';

/** The water the hand keeps between her and another ship's side (m): a hull grown by this is where its looks stop. */
export const HULL_CLEAR_M = 6;
/** AUDIT FERRY-CLEAR F4: how far ahead in time (s) a ship under way is looked for along her way - where she stands now
 *  and at each HULL_LEAD_STEP_S out to this: a look read the ships where they stood, and a ship crossing her course met
 *  her hull where the hand had seen water. */
export const HULL_LEAD_S = 8;
export const HULL_LEAD_STEP_S = 2;
/** A way slower than this (m/s) is a ship lying still - looked for where she lies. */
export const HULL_LEAD_MIN_MPS = 0.5;

/** AUDIT FERRY-CLEAR F4: a hull and where its way carries it - the box as it stands, and its copies HULL_LEAD_STEP_S
 *  apart out to HULL_LEAD_S along its way `v` (flat, m/s) while it makes HULL_LEAD_MIN_MPS or more. */
export function ledHulls(box, v) {
  if (!box) return [];
  const sp = Math.hypot(v?.[0] ?? 0, v?.[2] ?? 0);
  if (!(sp >= HULL_LEAD_MIN_MPS)) return [box];
  const out = [box];
  for (let t = HULL_LEAD_STEP_S; t <= HULL_LEAD_S + 1e-9; t += HULL_LEAD_STEP_S) out.push({ ...box, c: [box.c[0] + v[0] * t, box.c[1], box.c[2] + v[2] * t] });
  return out;
}

/**
 * Metres along a flat look from `p` (`dx`, `dz` a unit direction) to the first of `boxes` (the ships' hulls - oriented
 * boxes, navalBallistics.js orientedBox) grown by `clear`, within `far`; Infinity where none stands. Each box is met at
 * its own middle height, so the look is the hull's plan, whatever the sea's height under her. A look that starts
 * within a hull's clearance already (alongside her) stops at her side itself, and one leading away from her side does
 * not stop for her at all - the hand turns off a ship it lies beside, never toward it.
 * @param {number[]} p @param {number} dx @param {number} dz @param {number} far
 * @param {Iterable<{ c: number[], ax: number[], ay: number[], az: number[], h: number[] } | null>} boxes
 */
export function hullAlong(p, dx, dz, far, boxes, clear = HULL_CLEAR_M) {
  let best = Infinity;
  for (const box of boxes) {
    if (!box) continue;
    const r = Math.hypot(box.h[0], box.h[1], box.h[2]) + clear;
    const ox = box.c[0] - p[0], oz = box.c[2] - p[2];
    const along = Math.max(0, Math.min(far, ox * dx + oz * dz));
    if (Math.hypot(ox - dx * along, oz - dz * along) > r) continue;   // nowhere near the look
    const a = [p[0], box.c[1], p[2]], b = [p[0] + dx * far, box.c[1], p[2] + dz * far];
    let hit = segmentBoxEntry(a, b, box, clear);
    if (hit && hit.t === 0) hit = segmentBoxEntry(a, b, box, 0);   // within her clearance already: her side itself
    if (!hit || hit.t === 0) continue;
    best = Math.min(best, hit.t * far);
  }
  return best;
}

/**
 * AUDIT FERRY-CLEAR F3: THE HULLS ABOUT HER - every hull a look can meet: the sea's ships afloat (a sunk one's none),
 * other players' boats at their helms, and my own other boats (one docked at the next berth among them - the harbour roll
 * keeps the sea's ships off a berth a boat of mine holds) - never the boat at my helm, the one doing the looking. The
 * naval host builds one over its state (`sea`, `hullBox`, `peerBoats`, `myBoats`, `myBoat`, `enabled`): the crossing's
 * hand's `along` (world.js tvSeaSail) and the aim camera's ships alongside (scenes/naval/aimCamera.js) read it. The hand
 * read the sea's ships alone, and a boat of mine or a peer's at the next berth was water to it.
 * AUDIT FERRY-CLEAR F4: the hand's `along` looks for a ship under way, and a peer's boat, where her way carries her too
 * (ledHulls, `velocity` her way); `boxes` - the aim camera's ships alongside - are the hulls as they stand.
 * @param {{ sea: Map<any, any>, hullBox: (boat: any) => any, velocity: (ship: any) => number[], peerBoats: () => any[], myBoats: () => any[], myBoat: () => any, enabled: () => boolean }} host
 */
export function createSeaHulls(host) {
  function boxes(lead = false) {
    if (!host.enabled()) return [];
    const out = [];
    const at = (box, v) => (lead ? ledHulls(box, v) : box ? [box] : []);   // F4: the hand's, where her way carries her too
    for (const e of host.sea.values()) if (e.boat && e.ship.damage.state !== SHIP_STATES.sunk) out.push(...at(host.hullBox(e.boat), host.velocity(e.ship)));
    for (const p of host.peerBoats()) if (p?.boat) out.push(...at(host.hullBox(p.boat), p.vel));
    const mine = host.myBoat();
    for (const b of host.myBoats()) if (b !== mine) out.push(host.hullBox(b));
    return out.filter(Boolean);
  }
  return { boxes: () => boxes(false), along: (p, dx, dz, far) => hullAlong(p, dx, dz, far, boxes(true)) };
}

