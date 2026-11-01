// @ts-check
// A LEGACY TOWN AS A PLAN. Every building of an RMB
// layout keeps the key BuildingDirectory.MakeBuildingKey gave it (buildingSummaries' own - never minted again here), stands
// where RMBLayout.GetBuildingData puts it, and points at its record for its walls, doors and rooms. The ground is the one
// flat pad today's towns stand on (blendLocationTerrain, TS2's outline). The directory is the plan read back the way the
// game's building lists read: a minted key's row carries no block cell, so nothing can decode one.
import { RMB_SIDE } from '../locationLayout.js';
import { isResidence } from '../buildingNames.js';
import { SETTLEMENT_CONTRACT_VERSION, rmbPartsOfKey, floorOf } from './settlementContract.js';

/**
 * @typedef {import('./settlementContract.js').SettlementPlan} SettlementPlan
 * @typedef {import('./settlementContract.js').Building} Building
 * @typedef {import('./settlementContract.js').Origin} Origin
 * @typedef {{ buildingKey: number, recordIndex: number, blockX: number, blockY: number, position: number[], rotationY: number,
 *   buildingType: number, factionId: number, quality: number, nameSeed: number, hasInterior: boolean }} Summary
 */

/** The pad every legacy town stands on: its whole grid, at the datum. */
export const LEGACY_PAD = 'ground';

/**
 * A legacy town's plan from its layout and its building summaries (world/buildingSummaries.js).
 * @param {{ place: number, origin: Origin, layout: { width: number, height: number, blocks: Array<{ x: number, y: number, blockName: string }> },
 *   summaries: readonly Summary[] }} o
 * @returns {SettlementPlan}
 */
export function legacySettlementOf({ place, origin, layout, summaries }) {
  const w = layout.width * RMB_SIDE, h = layout.height * RMB_SIDE;
  /** @type {Array<readonly [number, number]>} */ const ring = [[0, 0], [w, 0], [w, h], [0, h]];
  const blockAt = new Map(layout.blocks.map((b) => [`${b.x},${b.y}`, b.blockName]));
  const buildings = summaries.map((s) => {
    const rmb = { kind: 'rmb', block: blockAt.get(`${s.blockX},${s.blockY}`) ?? '', record: s.recordIndex };
    return /** @type {Building} */ ({
      key: s.buildingKey, source: 'legacy', anchor: `rmb:${s.blockX},${s.blockY}.${s.recordIndex}`, pad: LEGACY_PAD,
      at: [s.blockX * RMB_SIDE + s.position[0], s.blockY * RMB_SIDE + s.position[2]], yaw: s.rotationY, lift: 0,
      footprint: null, storeys: null, exterior: rmb, interior: s.hasInterior ? rmb : null, entrances: [],
      type: s.buildingType, factionId: s.factionId, quality: s.quality, nameSeed: s.nameSeed,
      access: isResidence(s.buildingType) ? 'private' : 'public',
    });
  });
  return {
    contract: SETTLEMENT_CONTRACT_VERSION, place, source: 'legacy', generator: null, revision: 0, origin,
    footprint: ring, pads: [{ id: LEGACY_PAD, poly: ring, y: 0, rim: 'grade' }], links: [], gates: [], streets: [], districts: [],
    buildings,
  };
}

/**
 * The plan as the game's building lists read it: one row a building, in the plan's frame (y its floor). `rmb` is the
 * block cell and record of an RMB key, null for a minted one.
 * @param {SettlementPlan} plan
 */
export function directoryOf(plan) {
  return plan.buildings.map((b) => {
    const parts = rmbPartsOfKey(b.key);
    return Object.freeze({
      buildingKey: b.key, buildingType: b.type, factionId: b.factionId, quality: b.quality, nameSeed: b.nameSeed,
      position: Object.freeze([b.at[0], floorOf(plan, b), b.at[1]]), rotationY: b.yaw, hasInterior: !!b.interior,
      rmb: parts ? Object.freeze({ blockX: parts.x, blockY: parts.y, recordIndex: parts.record }) : null,
    });
  });
}
