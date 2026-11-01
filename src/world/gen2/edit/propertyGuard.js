// @ts-check
// WG2 PROTECTED PROPERTY ("Protected property"): before an edit is published, every
// record a player holds against the world - a home and its decor, rooms, containers and yard, a rental, a recall anchor,
// a quest's destination - is checked against it. A brush or a road over one's ground, a building it names moved or
// removed, a district made again that retires it: each is a conflict, and publication is refused until a designer
// resolves it (an explicit move with its own mapping and rollback). Nothing is ever deleted silently.
import { opRect, OP_STAGE } from './editLayers.js';
import { legacyBuildingId } from '../settle/buildingRecord.js';

export const PROTECTED_KINDS = Object.freeze(['home', 'decor', 'room', 'container', 'yard', 'rental', 'recall', 'quest']);
/** How far round a protected point a ground edit reaches it, world pixels (a home's yard and its approach). */
export const GUARD_PX = 0.15;

/** @typedef {{ kind: string, owner: string, at?: { x: number, y: number }, building?: string, mapId?: number, key?: number, layout?: string }} Protected */

/** The building id a protected record names: its own, or its legacy town, key and layout's. @param {Protected} p */
export const protectedBuilding = (p) => p.building ?? (p.mapId !== undefined && p.key !== undefined ? legacyBuildingId(p.mapId, p.key, p.layout ?? 'classic') : null);

/**
 * The conflicts between a document's changes and the protected records. `retired`: building ids the change retires (a
 * district made again, mintIds' book). Answers `{ record, op?, why }` for each.
 * @param {import('./editLayers.js').EditDoc} doc @param {Protected[]} records @param {{ retired?: string[] }} [o]
 */
export function propertyConflicts(doc, records, o = {}) {
  const out = [], retired = new Set(o.retired ?? []);
  for (const rec of records) {
    if (!PROTECTED_KINDS.includes(rec.kind)) { out.push({ record: rec, why: `unknown record kind ${rec.kind}` }); continue; }
    const id = protectedBuilding(rec);
    if (id && retired.has(id)) out.push({ record: rec, why: `${rec.kind} of ${rec.owner} is in ${id}, which the change retires` });
    for (const L of doc.layers) {
      if (!L.visible) continue;
      for (const op of L.ops) {
        if (op.kind === 'building' && id && op.id === id) { out.push({ record: rec, op, why: `${rec.kind} of ${rec.owner}: ${id} is ${op.remove ? 'removed' : 'moved'}` }); continue; }
        if (!rec.at || !['erosion', 'settlements'].includes(OP_STAGE[op.kind]) || op.kind === 'building') continue;
        const r = opRect(op);
        if (rec.at.x >= r.x - GUARD_PX && rec.at.x <= r.x + r.w + GUARD_PX && rec.at.y >= r.y - GUARD_PX && rec.at.y <= r.y + r.h + GUARD_PX && reaches(op, rec.at)) {
          out.push({ record: rec, op, why: `${rec.kind} of ${rec.owner} stands under a ${op.kind}` });
        }
      }
    }
  }
  return out;
}
/** Does an operation's own shape reach a point (a brush's circle, a road's line, a settlement's ground)? */
function reaches(op, at) {
  if (op.x !== undefined && op.r !== undefined) return Math.sqrt((at.x - op.x) * (at.x - op.x) + (at.y - op.y) * (at.y - op.y)) * 819.2 <= op.r + GUARD_PX * 819.2;
  return true;
}
