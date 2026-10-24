// @ts-check
// ═══════════════════════════════════════════════════════════════════
// POI-6 (2026-10-14) - WHAT A SUBMISSION CHANGES: A REVISION AGAINST THE ONE LIVE IN THE WORLD.
//
// Mac: "I need to be able to approve changes" (bible/06-Systems/POI-Editor-Arc.md POI-6). The approver reads, before
// looking, what a submission would change - the place moved, turned or resized, a part added, taken away or changed (and
// how), the lights, the mark, the words - each a CODE with the numbers it turns on (`{ code, ...args }`), said in the
// approver's language by poi/poiText.js diffText. A POI never approved is `new`; a retirement is `retire`. Parts are
// matched by their keys (the editor keeps a part's key for its life), so a renamed part is a change, not a swap.
//
// Pure. Not a DFU member. Ledger A (POI).
// ═══════════════════════════════════════════════════════════════════

import { POI_PIXEL_M } from './poiLaw.js';
import { quatMultiply } from '../world/quat.js';

/** A spot's distance under which it has not moved, in metres; a turn's, in degrees; a size's ratio. */
const MOVE_EPS = 0.005, TURN_EPS = 0.05, SIZE_EPS = 1e-4;

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
/**
 * The angle between two turns, in degrees: the turn that takes one to the other (a * b⁻¹), its half-angle read as
 * atan2(|its axis part|, |its w|).
 * AUDIT POI P1: the cosine of the dot product read every quaternion as a UNIT one, and none is quite - the editor tidies
 * each to a millionth (poiEdit.js tidyQuat) and the law takes a length within a thousandth (poiLaw.js unitQuat) - so a
 * turn read against ITSELF came out as 0.1 to 0.2 degrees (729 of 1,716 the editor writes; 5.1 at a length of 0.9995)
 * and an untouched POI said "Turned 0.2°". The product's two parts are scaled alike by both lengths, so their ratio is
 * the turn alone; its w's sign is the quaternion's other sign (the same turn), read as none.
 */
export function quatAngleDeg(a, b) {
  const [x, y, z, w] = quatMultiply(a, [-b[0], -b[1], -b[2], b[3]]);
  return (2 * Math.atan2(Math.hypot(x, y, z), Math.abs(w)) * 180) / Math.PI;
}
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** A place's spot in map metres (x east, z north from the map's south-west), its height beside. */
const mapSpot = (p) => [p.px * POI_PIXEL_M + p.x, p.y, -p.py * POI_PIXEL_M + p.z];

/**
 * How `after` differs from `before` (the live document; null for a POI never approved), as codes in reading order.
 * @param {any} before @param {any} after (null: a retirement) @returns {{ code: string, [arg: string]: any }[]}
 */
export function poiDiff(before, after) {
  if (!after) return [{ code: 'retire' }];
  if (!before) return [{ code: 'new', parts: after.parts?.length ?? 0, lights: after.lights?.length ?? 0 }];
  const out = [];
  if (before.name !== after.name) out.push({ code: 'name', from: before.name, to: after.name });
  if ((before.about ?? '') !== (after.about ?? '')) out.push({ code: 'about' });
  // the tags themselves (AUDIT POI U13, the lead's join): the reader's language lists them (poiText.js diffText), never an
  // English ', '
  if (!same(before.tags ?? [], after.tags ?? [])) out.push({ code: 'tags', tags: [...(after.tags ?? [])] });
  const p0 = before.place, p1 = after.place;
  const moved = dist3(mapSpot(p0), mapSpot(p1));
  if (moved > MOVE_EPS) out.push({ code: 'moved', m: Math.round(moved * 100) / 100 });
  if (p0.ground !== p1.ground) out.push({ code: 'ground', to: p1.ground });
  const turned = quatAngleDeg(p0.r, p1.r);
  if (turned > TURN_EPS) out.push({ code: 'turned', deg: Math.round(turned * 10) / 10 });
  if (Math.abs(p1.s / p0.s - 1) > SIZE_EPS) out.push({ code: 'sized', from: p0.s, to: p1.s });
  // parts by key
  const was = new Map((before.parts ?? []).map((q) => [q.key, q]));
  const now = new Map((after.parts ?? []).map((q) => [q.key, q]));
  for (const [key, q] of now) {
    const old = was.get(key);
    const name = q.name || key;
    if (!old) { out.push({ code: 'part-added', name }); continue; }
    const what = [];
    if (old.mesh !== q.mesh) what.push('model');
    // AUDIT POI P12: a part's offset is in its POI's frame, under the POI's size - measured in the world, where the
    // approver sees it (at size 100 a 0.4 m move is an offset of 4 mm, under the bound read in metres of the frame)
    if (dist3(old.t, q.t) * p1.s > MOVE_EPS) what.push('moved');
    if (quatAngleDeg(old.r, q.r) > TURN_EPS) what.push('turned');
    if (old.s.some((c, i) => Math.abs(q.s[i] / c - 1) > SIZE_EPS)) what.push('sized');
    if (!same(old.materials, q.materials)) what.push('materials');
    if (old.collide !== q.collide || old.shadow !== q.shadow) what.push('solidity');
    if ((old.name ?? '') !== (q.name ?? '')) what.push('name');
    if (what.length) out.push({ code: 'part-changed', name, what });
  }
  for (const [key, q] of was) if (!now.has(key)) out.push({ code: 'part-removed', name: q.name || key });
  if (!same(before.lights ?? [], after.lights ?? [])) out.push({ code: 'lights', from: before.lights?.length ?? 0, to: after.lights?.length ?? 0 });
  if (!same(before.marker ?? { show: false }, after.marker ?? { show: false })) out.push({ code: 'marker', show: !!after.marker?.show, label: after.marker?.label ?? '' });
  return out;
}
