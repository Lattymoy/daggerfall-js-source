// @ts-check
// WG2 (bible/03-World/World-2-Canon.md, "The stages"): THE STAGES AND WHAT EACH READS. World 2.0 is made in this order,
// each stage reading only the stages named in its `reads`. A change to one stage's output marks the stages downstream
// of it stale over the change's rectangle grown by each stage's reach - never the whole world. Hydrology's reach is the
// changed water's own basin, found by the caller (`basinOf`), since a river carries a change to its mouth.

/** Each stage: what it reads, its law's version (raised when its output changes for the same inputs), and how far past
 *  a changed input its own output can move, in world pixels. */
export const STAGES = Object.freeze({
  canon: { reads: [], version: 1, reach: 0 },
  geology: { reads: ['canon'], version: 1, reach: 2 },
  climate: { reads: ['canon', 'geology'], version: 1, reach: 24 },
  erosion: { reads: ['geology', 'climate'], version: 1, reach: 4 },
  hydrology: { reads: ['erosion', 'climate'], version: 1, reach: -1 },
  soil: { reads: ['geology', 'erosion', 'hydrology', 'climate'], version: 1, reach: 1 },
  biome: { reads: ['climate', 'soil', 'hydrology', 'erosion'], version: 1, reach: 1 },
  vegetation: { reads: ['biome', 'soil', 'climate', 'hydrology', 'erosion'], version: 1, reach: 1 },
  resources: { reads: ['geology', 'vegetation', 'hydrology', 'soil'], version: 1, reach: 2 },
  suitability: { reads: ['resources', 'soil', 'hydrology', 'climate', 'erosion', 'biome'], version: 1, reach: 4 },
  settlements: { reads: ['suitability'], version: 1, reach: 0 },
});
/** @type {readonly StageId[]} the order the stages run in - every stage after all it reads */
export const STAGE_ORDER = Object.freeze(/** @type {StageId[]} */ (Object.keys(STAGES)));
/** @typedef {'canon'|'geology'|'climate'|'erosion'|'hydrology'|'soil'|'biome'|'vegetation'|'resources'|'suitability'|'settlements'} StageId */
/** @typedef {{ x: number, y: number, w: number, h: number }} Rect world pixels, x and y the north-west corner */

/** @param {Rect} r @param {number} m */
export const grow = (r, m) => ({ x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m });
/** The smallest rectangle holding both. @param {Rect} a @param {Rect} b */
export const union = (a, b) => {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};
/** The overlap, or null. @param {Rect} a @param {Rect} b */
export const intersect = (a, b) => {
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y), x1 = Math.min(a.x + a.w, b.x + b.w), y1 = Math.min(a.y + a.h, b.y + b.h);
  return x1 > x && y1 > y ? { x, y, w: x1 - x, h: y1 - y } : null;
};

/**
 * What a change makes stale: each stage downstream of `stage` (and `stage` itself when `self`) with the rectangle it
 * must be made again over, clipped to `bounds`. `basinOf(rect)` answers the rectangle of the drainage a change in
 * `rect` reaches (its basin and the river to its mouth); without it, hydrology goes stale over all of `bounds`.
 * @param {StageId} stage @param {Rect} rect @param {Rect} bounds
 * @param {{ self?: boolean, basinOf?: (r: Rect) => Rect }} [o]
 * @returns {Map<StageId, Rect>}
 */
export function staleAfter(stage, rect, bounds, o = {}) {
  /** @type {Map<StageId, Rect>} */
  const out = new Map();
  if (o.self) out.set(stage, rect);
  const changed = new Map([[stage, rect]]);
  for (const s of STAGE_ORDER) {
    if (s === stage) continue;
    let r = null;
    for (const input of STAGES[s].reads) {
      const c = changed.get(/** @type {StageId} */ (input));
      if (c) r = r ? union(r, c) : c;
    }
    if (!r) continue;
    const reach = STAGES[s].reach;
    const grown = reach < 0 ? (o.basinOf ? union(r, o.basinOf(r)) : bounds) : grow(r, reach);
    const clipped = intersect(grown, bounds);
    if (!clipped) continue;
    changed.set(s, clipped);
    out.set(s, clipped);
  }
  return out;
}

/** A stage's key for one tile of a region: its law's version, the manifest's versions it reads, and the prints of its
 *  inputs - the same key, the same bytes. @param {StageId} stage @param {string} inputsPrint @param {{ generatorVersion: string, worldSeed: number }} m */
export const stageKey = (stage, inputsPrint, m) => `${stage}.${STAGES[stage].version}:${m.generatorVersion}:${m.worldSeed}:${inputsPrint}`;
