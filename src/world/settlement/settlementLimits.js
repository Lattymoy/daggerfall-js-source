// @ts-check
// HOW STEEP A WAY BETWEEN PADS MAY BE AND HOW MUCH ROOM A FEATURE TAKES, a leaf the contract (settlementContract.js
// re-exports its steps), the worker-safe layout and the features' models read. Our own numbers: DFU's towns are flat.

/** Most a grade link may rise, metres: a step a walker takes without stairs. */
export const STEP_MAX = 0.4;
/** Most rise per metre of run, by link kind. */
export const PITCH_MAX = Object.freeze({ grade: Infinity, stairs: 0.75, ramp: 0.25, bridge: 0.25 });

/** How far past a canal's far edge a flight's foot lands, metres. */
export const FLIGHT_LAND = 0.3;
/** How far back from its higher pad's rim a link's flight reaches: its rise at its kind's pitch (a grade's a ramp's),
 *  and past a canal of `enter` metres onto the lower pad. @param {string} kind @param {number} rise @param {number} enter */
export const flightRun = (kind, rise, enter) => Math.max(Math.abs(rise) / (kind === 'grade' ? PITCH_MAX.ramp : PITCH_MAX[kind]), enter > 0.05 ? enter + FLIGHT_LAND : 0, 0.5);

/** A fort's wall: how high over its ground, how thick, how far its foot is sunk. */
export const FORT_WALL = Object.freeze({ h: 6, thick: 2, sink: 3 });
/** A fort's tower: its radius, how high it stands over the walls, how far its roof's eave reaches past its wall. */
export const FORT_TOWER = Object.freeze({ r: 3, over: 3, eave: 0.6 });
/** How far a feature's body reaches round its point, metres: a well's roof, a fountain's basin, a statue's plinth, a
 *  tower, a market's stall (past its ring, the feature's `size`). */
export const FEATURE_REACH = Object.freeze({ well: 1.8, fountain: 2.4, statue: 2.1, tower: FORT_TOWER.r + FORT_TOWER.eave, market: 2.1 });
/** A market's ring of stalls by default, metres from its point. */
export const MARKET_RING = 5;
/** The least room between a feature's body and a building, a link or a pad's rim; and between a tree's trunk and a link. */
export const FEATURE_CLEAR = 0.25;
export const TREE_CLEAR = 1;
/** Half a dock's deck across, metres. */
export const DOCK_HALF = 1.5;

/** How far a feature's body reaches round its point; 0 for one with no body there. @param {{ kind: string, size?: number }} feature */
export const featureReach = (feature) => (feature.kind === 'market' ? (feature.size ?? MARKET_RING) : 0) + (FEATURE_REACH[feature.kind] ?? 0);
