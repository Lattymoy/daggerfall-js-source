// ROAD-C c2/S1: THE AUTOMAP MODEL - the reveal index promoted to DFU's
// own four-level identity, plus the point query that the reveal law
// and (later) the picker both walk.
//
// WHY THIS MODULE EXISTS AT ALL - A LIVE FIELD BUG. A1 shipped the
// reveal index as a bare filter over rows the dungeon host pushed, and
// the two halves disagreed about the SHAPE of an AABB:
// `dungeonContext` pushes `worldAabb()`'s object form
// (`{min:[x,y,z], max:[x,y,z]}` - player/activate.js), while
// `automap.js`'s `pointInAabb` read a FLAT six-array `a[0]..a[5]`.
// `undefined` compares false against every number, so EVERY dungeon
// reveal comparison in the real game answered "outside" and the
// dungeon map revealed NOTHING. `test/automap.test.js` never saw it
// because its fixtures were hand-built in the flat form the model
// layer wanted. The cure is structural, not a patch: ONE shape lives
// past this boundary. `normalizeAabb` accepts either form at the
// door - so a caller in the old dialect still lands - and every row
// past it is `{min,max}` and nothing else. The pins assert that the
// two input dialects build byte-identical rows and reveal
// identically, which is what "both forms out of existence" means.
//
// THE IDENTITY. DFU's discovery record is POSITIONAL, three levels
// deep under the location: block -> blockElement -> model
// (Automap.cs:66-79 AutomapGeometryBlockState/...BlockElementState/
// ...ModelState), where the two block elements are the "Models" and
// "Action Models" nodes RDBLayout creates in that order
// (RDBLayout.cs:165-168) and a model lands in one or the other by
// `Transform parent = (hasAction) ? actionModelsParent : modelsParent`
// (:644). Option_CombineRDB is off on the automap run, so every model
// is its own child. The port does NOT make that positional address
// the persisted key - a save keyed by walk position breaks the moment
// a layout re-orders, and the port already owns a stable identity in
// the action system's `${blockIndex}:${blockLocalPosition}`. So the
// four-level address rides as METADATA beside the stable key: it
// gives the DFU-ordered walk (for the restore guard and for anything
// that must reproduce DFU's order), and the key stays the save's.
//
// ACTION DOORS ARE NOT IN THE MODEL. DFU's automap copy has none:
// AddModels skips them outright (RDBLayout.cs:625-627, "Filter action
// door models / These must be added by AddActionDoors()") and
// AddActionDoors is never called on the automap run. That absence is
// load-bearing for the reveal law - see automap.js's three-ray scan.

import { GLOBAL_SCALE } from '../world/meshReader.js';

/** The skin on a point-in-AABB test: the probe's hit point sits ON a
 *  surface, so an exact test is a coin flip against float error. */
export const AABB_TOLERANCE = 0.05;

/** Hash-grid cell, world units. Dungeon models are small; the grid is
 *  3D because multi-level dungeons stack heavily in XZ. */
const GRID_CELL = 4;

/** A row whose grown AABB spans more cells than this is not indexed -
 *  it joins the always-scanned list instead (a handful of huge floor
 *  slabs must not each cost thousands of grid inserts). */
const MAX_CELLS_PER_ROW = 512;

/** DFU's two block elements, in RDBLayout's creation order
 *  (:165-168) - which IS the child order the restore walk reads. */
export const ELEMENT_MODELS = 'Models';
export const ELEMENT_ACTION_MODELS = 'Action Models';
export const ELEMENT_NAMES = [ELEMENT_MODELS, ELEMENT_ACTION_MODELS];

/** ROAD-C c2/S9: THE INTERIOR'S OWN TWO ELEMENTS. A BUILDING's automap
 *  copy is laid out by DaggerfallInterior.DoLayoutAutomap (:170-188),
 *  which calls AddModels and nothing else - no AddActionDoors, no
 *  AddFlats, no AddPeople - and AddModels creates exactly two child
 *  nodes, in this order: "Models" and "Doors" (:398-401). Only the
 *  first ever receives a child; "Doors" stays EMPTY, because the
 *  static doors it was named for go into a DaggerfallStaticDoors
 *  COMPONENT (:521-522) rather than under the node. So every interior
 *  model addresses as element 0, and element 1 exists to be walked
 *  past - which is exactly what SaveStateAutomapDungeon's blockElement
 *  loop does when it runs over an interior. */
export const ELEMENT_DOORS = 'Doors';
export const INTERIOR_ELEMENT_NAMES = [ELEMENT_MODELS, ELEMENT_DOORS];

/**
 * AddWater (Automap.cs:1982-2001): the block's native water level
 * becomes the shader's `_WaterLevel`, and 10000 means NO WATER - the
 * function returns before touching a single renderer.
 * @returns {number|null} world-space water Y, or null for a dry block
 */
export function automapWaterLevel(nativeBlockWaterLevel) {
  if (nativeBlockWaterLevel == null || nativeBlockWaterLevel === 10000) return null;
  return nativeBlockWaterLevel * -1 * GLOBAL_SCALE;
}

/** The one shape gate. Accepts worldAabb()'s `{min,max}` and the flat
 *  six-array the A1 index spoke; answers `{min,max}` or null. */
export function normalizeAabb(a) {
  if (!a) return null;
  if (Array.isArray(a)) {
    if (a.length !== 6) return null;
    for (const v of a) if (!Number.isFinite(v)) return null;
    return { min: [a[0], a[1], a[2]], max: [a[3], a[4], a[5]] };
  }
  const { min, max } = a;
  if (!Array.isArray(min) || !Array.isArray(max) || min.length !== 3 || max.length !== 3) return null;
  for (let i = 0; i < 3; i++) if (!Number.isFinite(min[i]) || !Number.isFinite(max[i])) return null;
  return { min: [min[0], min[1], min[2]], max: [max[0], max[1], max[2]] };
}

/** Point inside an `{min,max}` AABB grown by tol - the ONLY reader of
 *  an automap AABB anywhere in the port. */
export function aabbContains(aabb, p, tol = 0) {
  const { min, max } = aabb;
  return p[0] >= min[0] - tol && p[0] <= max[0] + tol
    && p[1] >= min[1] - tol && p[1] <= max[1] + tol
    && p[2] >= min[2] - tol && p[2] <= max[2] + tol;
}

const aabbVolume = ({ min, max }) => (max[0] - min[0]) * (max[1] - min[1]) * (max[2] - min[2]);

const cellKey = (x, y, z) => `${Math.floor(x / GRID_CELL)},${Math.floor(y / GRID_CELL)},${Math.floor(z / GRID_CELL)}`;

/**
 * Promote the host's draw-entry rows into the automap model.
 *
 * Input rows: `{ key, aabb, blockIndex, blockName, elementIndex,
 * elementName, modelIndex, waterLevel }`. Only `key` and a
 * normalizable `aabb` are required; the identity metadata defaults to
 * -1/'' so a hand-built fixture stays cheap.
 *
 * Rows come out sorted into DFU's own walk order (block, then element,
 * then model - RestoreStateAutomapDungeon's three nested loops,
 * Automap.cs:2381-2400), with insertion order breaking every tie, so
 * the ordering is total and stable.
 */
export function buildAutomapModel(entries) {
  const rows = [];
  let seq = 0;
  for (const e of entries ?? []) {
    if (e == null || e.key == null) continue;
    const aabb = normalizeAabb(e.aabb);
    if (!aabb) continue;
    rows.push({
      key: e.key,
      aabb,
      blockIndex: e.blockIndex ?? -1,
      blockName: e.blockName ?? '',
      elementIndex: e.elementIndex ?? -1,
      elementName: e.elementName ?? '',
      modelIndex: e.modelIndex ?? -1,
      waterLevel: e.waterLevel ?? null,
      // ROAD-C c2/S7: the picker's narrowphase. REFERENCES to the CPU
      // model's own arrays and to the placement matrix the draw list
      // already holds - never copies, so an entry costs two pointers
      // and a row built without them still answers its AABB.
      positions: e.positions ?? null,
      indices: e.indices ?? null,
      matrix: e.matrix ?? null,
      _seq: seq++,
    });
  }
  rows.sort((a, b) => (a.blockIndex - b.blockIndex)
    || (a.elementIndex - b.elementIndex)
    || (a.modelIndex - b.modelIndex)
    || (a._seq - b._seq));

  // --- the point-query hash grid -------------------------------------
  const grid = new Map();
  const oversize = [];
  for (const row of rows) {
    const { min, max } = row.aabb;
    const x0 = Math.floor((min[0] - AABB_TOLERANCE) / GRID_CELL);
    const x1 = Math.floor((max[0] + AABB_TOLERANCE) / GRID_CELL);
    const y0 = Math.floor((min[1] - AABB_TOLERANCE) / GRID_CELL);
    const y1 = Math.floor((max[1] + AABB_TOLERANCE) / GRID_CELL);
    const z0 = Math.floor((min[2] - AABB_TOLERANCE) / GRID_CELL);
    const z1 = Math.floor((max[2] + AABB_TOLERANCE) / GRID_CELL);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1) > MAX_CELLS_PER_ROW) { oversize.push(row); continue; }
    for (let gx = x0; gx <= x1; gx++) {
      for (let gy = y0; gy <= y1; gy++) {
        for (let gz = z0; gz <= z1; gz++) {
          const k = `${gx},${gy},${gz}`;
          let cell = grid.get(k);
          if (!cell) { cell = []; grid.set(k, cell); }
          cell.push(row);
        }
      }
    }
  }

  const byKey = new Map();
  for (const row of rows) if (!byKey.has(row.key)) byKey.set(row.key, row);

  const blockNames = [];
  for (const row of rows) {
    if (row.blockIndex >= 0 && blockNames[row.blockIndex] === undefined) blockNames[row.blockIndex] = row.blockName;
  }

  /** Every row whose AABB (grown by tol) holds the point. */
  function queryPoint(p, tol = AABB_TOLERANCE) {
    const out = [];
    const cell = grid.get(cellKey(p[0], p[1], p[2]));
    if (cell) for (const row of cell) if (aabbContains(row.aabb, p, tol)) out.push(row);
    for (const row of oversize) if (aabbContains(row.aabb, p, tol)) out.push(row);
    return out;
  }

  /**
   * ONE row for a point - the port's stand-in for DFU's
   * `hit.collider`, which names exactly one MeshCollider. Adjacent
   * models share a wall junction, so the answer must be a FUNCTION of
   * the point, not "whichever came first": the TIGHTEST enclosing box
   * wins (the smaller model is the one whose surface the probe is
   * actually standing on), and the DFU walk order breaks every tie.
   * SUBSTITUTION, recorded: DFU resolves by which collider the ray
   * struck; the port resolves by the hit point's tightest owner.
   */
  function resolveAt(p, tol = AABB_TOLERANCE) {
    let best = null;
    let bestVol = Infinity;
    for (const row of queryPoint(p, tol)) {
      const v = aabbVolume(row.aabb);
      if (v < bestVol) { best = row; bestVol = v; }
    }
    return best;
  }

  /**
   * The three draw groups the map pass needs, as a TOTAL and DISJOINT
   * cover of the model (Automap.cs:60-79: renderer enabled = ever
   * discovered; RENDER_IN_GRAYSCALE = not visited in THIS run).
   */
  function partition(rec) {
    const visited = [];
    const revealed = [];
    const undiscovered = [];
    for (const row of rows) {
      if (rec?.visitedThisRun?.has(row.key)) visited.push(row);
      else if (rec?.revealed?.has(row.key)) revealed.push(row);
      else undiscovered.push(row);
    }
    return { visited, revealed, undiscovered };
  }

  /** ExploredPercentage (:2467-2478): enabled renderers over all of
   *  them, cast to int. Keys the record holds that this model does
   *  not have (a stale save) cannot inflate it. */
  function exploredPercentage(rec) {
    if (rows.length === 0) return 0;
    let explored = 0;
    for (const row of rows) if (rec?.revealed?.has(row.key)) explored++;
    return Math.floor((explored / rows.length) * 100);
  }

  return {
    rows,
    byKey,
    blockNames,
    get length() { return rows.length; },
    queryPoint,
    resolveAt,
    partition,
    exploredPercentage,
  };
}

/**
 * RestoreStateAutomapDungeon's layout guard (Automap.cs:2378-2386).
 * DFU bails out of the restore walk the moment a block name disagrees
 * with the saved one - `return`, mid-walk, after `HideAll()`.
 *
 * DEPARTURE, deliberate and recorded: DFU's mid-walk `return` leaves
 * every block BEFORE the mismatch restored, so a re-ordered layout
 * restores a prefix of the wrong models. The port answers the question
 * BEFORE applying anything, so a mismatch restores NOTHING. The port's
 * keys are positional-independent, which makes a partial restore
 * strictly worse than none: it would mark models revealed that the
 * player never saw and leave no way to tell. Same intent (a re-ordered
 * layout must not restore wrong discovery), stricter answer.
 */
export function restoreMatchesLayout(model, savedBlockNames) {
  if (!Array.isArray(savedBlockNames)) return true;   // no record of names (pre-C2 envelope) - nothing to disagree with
  const have = model?.blockNames ?? [];
  if (have.length !== savedBlockNames.length) return false;
  for (let i = 0; i < have.length; i++) if (have[i] !== savedBlockNames[i]) return false;
  return true;
}
