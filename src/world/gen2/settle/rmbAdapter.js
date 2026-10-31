// @ts-check
// WG2 SETTLEMENT 2.0 (bible/03-World/World-2-Canon.md, "Legacy buildings"): THE RMB ADAPTER - a Daggerfall town's
// buildings read as building records, their keys kept. A town's buildings come from its blocks' records
// (world/buildingSummaries.js); each becomes a record whose id is its map id, its key and its layout's stamp
// (systems/layoutPins.js - a pack's layout gives a key to another building, so the stamp is part of the name). Nothing is
// moved, renamed or re-keyed: the record points back at the block and the record it stands for, and the game's doors,
// interiors, homes and quests keep reading the block as they always have.
import { legacyBuildingId, roleOfType, ROLES } from './buildingRecord.js';

/**
 * A town's buildings as records. `summaries` are buildingSummaries' rows for the town (its layout as served).
 * @param {{ mapId: number, layout?: string }} town @param {ReturnType<typeof import('../../buildingSummaries.js').buildingSummaries>} summaries
 * @returns {import('./buildingRecord.js').Building[]}
 */
export function legacyBuildings(town, summaries) {
  const layout = town.layout || 'classic', settlement = `rmb-${town.mapId >>> 0}`;
  return summaries.map((s) => {
    const role = roleOfType(s.buildingType);
    return /** @type {any} */ ({
      id: legacyBuildingId(town.mapId, s.buildingKey, layout), settlement, role, type: s.buildingType, prefab: 'rmb',
      legacy: { mapId: town.mapId >>> 0, key: s.buildingKey, layout },
      local: { blockX: s.blockX, blockY: s.blockY, recordIndex: s.recordIndex, position: s.position, rotationY: s.rotationY },
      doors: [], services: ROLES[role].services, access: s.isResidence ? 'private' : ROLES[role].access,
      interior: s.hasInterior ? { kind: 'rmb', ref: { blockX: s.blockX, blockY: s.blockY, recordIndex: s.recordIndex } } : { kind: 'none' },
      name: s.name, factionId: s.factionId, quality: s.quality,
    });
  });
}
