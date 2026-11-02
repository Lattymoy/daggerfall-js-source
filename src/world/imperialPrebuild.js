// @ts-check
// IC-GRAND's perf pass (2026-10-26, the coordinator: "A DISTRICT'S NINE NEAR SLICES NEVER FINISHED ... make arrival and
// crossing workable ... off-main-thread work"; bible/03-World/Arena-Provinces.md IC-GRAND, "Off the page's thread") - THE
// CITY'S OWN, MADE AHEAD ON A WORKER. A near slice's own blocks (their ground, their 4,096 closed cells each asked of the
// fabric, their trees) and its fabric's models are pure work of their rows and columns - the plan's, the same on every
// thread: measured in the game with its frame held, a near slice's ~60 blocks (a dozen milliseconds each) and ~60 models
// (half that) were most of its build, each a unit no breath parts, on the page's thread. So they are made on a worker of
// their own (world/imperialPrebuildWorker.js) for the slices the player is coming near, nearest first, in the order the
// pixel's build asks them, and handed to the world-data door and the models' family as they are asked
// (world/capitalModels.js): what the worker has made is taken; what it has not is made on the page's thread, as before -
// the same work, the same answer. IC-FOOTPRINT-OFF-THREAD: the landmarks' parts a slice stands are made there too, and
// the worker lays the landmarks' footprint (the cells their faces stand in - capitalModels.js imperialSliceFootprint,
// over the parts it builds on its own model door) on the blocks it makes: a taken block is the page's own to the byte.
//
// Pure but for the client's own registry (setImperialPrebuild / imperialPrebuilt) - the worker imports the work's half.
import {
  IMPERIAL_SPAN,
  IMPERIAL_ARENA_CODE,
  IMPERIAL_SLICE_PARTS,
  imperialSlicePlan,
  imperialCodeCell,
  imperialFarPartId,
} from './imperialCity.js';
import {
  imperialOwnName,
  imperialFarName,
  imperialFabricModelId,
  imperialSkylineId,
  imperialBlockJson,
  imperialModelBuild,
  isCarrier,
  imperialBlockOf,
  sliceOfCell,
  isFabricModelId,
  isSkylineId,
  IMPERIAL_FABRIC_MODEL,
  IMPERIAL_SKYLINE_MODEL,
} from './imperialBlocks.js';
import {
  CAPITALS,
  portBlockJson,
  miscModelAt,
  startMarkerAt,
  inCapitalRim,
  CAPITAL_NO_GROUND,
  BLOCK_M,
} from './tamrielCapitals.js';

const B = BLOCK_M;

/**
 * A SLICE'S WORK, in the order its pixel's build asks it (its blocks in its location's order - rows from the south - then
 * its models): near, each own cell's block and its fabric's model; far, every cell's far block but the lake's, the open
 * shore's and the arena's (world/imperialBlocks.js imperialViewName's) and, on its carrier, its skyline.
 * IC-FOOTPRINT-OFF-THREAD: either way the landmarks' parts its carrier stands, first of its models (IC-TOWER-LOD: a far
 * view's the tower's and the palace's coarse ones).
 * `{ kind: 'block', name }` or `{ kind: 'model', id }`.
 * @param {number} s @param {boolean} near
 * @returns {Array<{ kind: 'block', name: string } | { kind: 'model', id: number }>}
 */
export function sliceWork(s, near) {
  const plan = imperialSlicePlan(s),
    sx = s % IMPERIAL_SPAN,
    sy = Math.floor(s / IMPERIAL_SPAN);
  /** @type {Array<{ kind: 'block', name: string } | { kind: 'model', id: number }>} */
  const blocks = [],
    models = [];
  for (let i = 0; i < 64; i++) {
    const pr = 7 - Math.floor(i / 8),
      pc = i % 8,
      r = sy * 8 + pr,
      c = sx * 8 + pc,
      cell = plan[pr][pc];
    const own = !!imperialCodeCell(cell);
    if (near) {
      if (own) {
        blocks.push({ kind: 'block', name: imperialOwnName(r, c) });
        models.push({ kind: 'model', id: imperialFabricModelId(r, c) });
      }
    } else if (cell !== 'L' && cell !== 'O' && cell !== IMPERIAL_ARENA_CODE) {
      blocks.push({ kind: 'block', name: imperialFarName(r, c) });
      if (own && isCarrier(r, c)) models.push({ kind: 'model', id: imperialSkylineId(s) });
    }
  }
  return [
    ...blocks,
    ...IMPERIAL_SLICE_PARTS[s].map(
      (id) => /** @type {{ kind: 'model', id: number }} */ ({ kind: 'model', id: near ? id : imperialFarPartId(id) }),
    ),
    ...models,
  ]; // IC-TOWER-LOD: a far view's coarse
}

/** IC-STUTTER: each landmark part's slice (its first, where a long wall's runs stand in several), near and far ids alike. */
let _partSlices = null;
/**
 * IC-STUTTER (bible/03-World/Arena-Provinces.md IC-STUTTER): THE SLICE A PIECE IS OF, by its key ('b:<name>' a block,
 * 'm:<id>' a model) - a cell's block or fabric its cell's slice, a skyline its own, a landmark's part the first slice that
 * stands it; null for a key of none of the city's. The worker pool makes each slice's pieces on one worker
 * (world/imperialPrebuildClient.js ownerOf).
 * @param {string} key
 */
export function pieceSlice(key) {
  if (typeof key !== 'string') return null;
  if (key.startsWith('b:')) {
    const b = imperialBlockOf(key.slice(2));
    return b ? sliceOfCell(b.r, b.c) : null;
  }
  const id = key.startsWith('m:') ? Number(key.slice(2)) : NaN;
  if (!Number.isInteger(id)) return null;
  if (isFabricModelId(id)) {
    const k = id - IMPERIAL_FABRIC_MODEL;
    return sliceOfCell(Math.floor(k / (8 * IMPERIAL_SPAN)), k % (8 * IMPERIAL_SPAN));
  }
  if (isSkylineId(id)) return id - IMPERIAL_SKYLINE_MODEL;
  if (!_partSlices) {
    _partSlices = new Map();
    IMPERIAL_SLICE_PARTS.forEach((ids, s) => {
      for (const p of ids) for (const q of [p, imperialFarPartId(p)]) if (!_partSlices.has(q)) _partSlices.set(q, s);
    });
  }
  return _partSlices.get(id) ?? null;
}

/** The world-data door's writers and the city's own rim and markers - world/capitalModels.js installImperialFamilies's;
 *  the landmarks' footprint and the parts' models the caller's (the worker's: capitalModels.js imperialSliceFootprint and
 *  imperialPartModel - none by default).
 *  @param {(s: number) => any} [footprintOf] @param {((id: number) => any) | null} [partModel] */
export function prebuildDeps(footprintOf = () => null, partModel = null) {
  const IC = CAPITALS.find((c) => c.family);
  return {
    portBlockJson,
    miscModelAt,
    startMarkerAt,
    footprintOf,
    partModel,
    anchorMarkers: IC?.markers ?? [],
    noGround: CAPITAL_NO_GROUND,
    rim: (/** @type {number} */ r, /** @type {number} */ c, /** @type {number} */ x, /** @type {number} */ z) =>
      !!IC && inCapitalRim(IC, c * B + x, (r + 1) * B - z),
  };
}
/**
 * ONE PIECE OF A SLICE'S WORK, made: a block's JSON (its automap a Uint8Array, so it goes across as one buffer) or a
 * model (null where the cell has none).
 * @param {{ kind: 'block', name: string } | { kind: 'model', id: number }} w @param {ReturnType<typeof prebuildDeps>} deps
 */
export function makeWork(w, deps) {
  if (w.kind === 'model') return deps.partModel?.(w.id) ?? imperialModelBuild(w.id) ?? null;
  const json = imperialBlockJson(w.name, deps);
  if (json?.RmbBlock?.FldHeader)
    json.RmbBlock.FldHeader.AutoMapData = Uint8Array.from(json.RmbBlock.FldHeader.AutoMapData);
  return json;
}
/** A made model's buffers, to hand across without a copy. */
export const modelTransfers = (m) =>
  m ? [m.positions, m.normals, m.uvs, m.indices].filter((a) => a?.buffer).map((a) => a.buffer) : [];

/** THE PAGE'S CLIENT (world/imperialPrebuildClient.js), once one stands - the door and the family ask it. */
let _client =
  /** @type {?{ takeBlock: (name: string) => any, takeModel: (id: number) => any, made: (key: string) => void }} */ (
    null
  );
export const setImperialPrebuild = (/** @type {any} */ c) => {
  _client = c ?? null;
};
export const imperialPrebuilt = () => _client;
