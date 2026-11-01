// @ts-check
// THE SETTLEMENTS, WHERE THEY STAND - the streaming
// world's pool on the yards' shape (merchantYardsHost.js). Each built pixel whose worker laid out a settlement
// (`p.settlement`, settlement/settlementStand.js) is dressed here from its row and that layout, its ground and buildings
// made models (settlement/settlementModels.js, a model family the pipeline uploads), drawn at the pixel's translation,
// filed with the collider, and its doors handed to the modes with each building's record and its generated rooms.
// THE FOUR HOSTS: scenes/world.js WIRED; scenes/worldModes.js WIRED through world.js's doorTargets and
// buildingDataForDoor (no line of its own); scenes/exterior.js and scenes/dungeonContext.js FLAGGED: they stream no pixel.
import { registerCustomModelFamily, forgetFamilyModel } from '../world/customModels.js';
import { installFabricDoors } from '../world/imperialFabricBuildings.js';   // the doors' models: the Imperial City installs them only when it builds
import { SETTLEMENT_ROWS, settlementInput } from '../world/settlement/settlementPlaces.js';
import { dressSettlement } from '../world/settlement/settlementGen.js';
import { groundModel, buildingPiece, buildingInterior, buildingRecord, groundModelId, buildingModelId, featuresModelId, isSettlementModelId, SETTLEMENT_MODEL_RUN } from '../world/settlement/settlementModels.js';
import { featuresModel, featureSolids } from '../world/settlement/settlementFeatures.js';
import { onFloatingFrame, floatingFrameOf } from '../player/collider.js';
import { localAabb, transformedAabb } from '../render/frustum.js';
import { DECOR_DRAW, DECOR_SHADOW, DECOR_SKIP, castOnly } from './decor/decorRoom.js';
import { regionOfTheatre } from '../formats/mapsTables.js';
import { theatreAt } from '../world/worldWide/worldGrid.js';
import { townLookBase } from '../world/urban/townLook.js';
import { INTERIOR_SEASON } from '../world/climateSwaps.js';
import { trs } from '../world/mat4.js';
import { pageHas } from '../systems/pageQuery.js';
import { isResidence } from '../world/buildingNames.js';

/** The models the family answers, by id: made when a settlement is stood, dropped when it goes. */
const _models = new Map();
let _family = false;
/** The family, once a page (world/customModels.js): solid, its pictures the capitals' own (climate-free); and the fabric's doors. */
export function installSettlementModels() {
  if (_family) return;
  _family = true;
  installFabricDoors();
  registerCustomModelFamily({ owns: isSettlementModelId, build: (id) => _models.get(id) ?? null, keep: 4096, climateFree: true });
}

/** Each house's yard frame (scenes/pixelBuild.js homeFrames' shape: its place, its box and its footprint's rect,
 *  pixel-local), filed on its pixel's own map so the yards stand round it. @param {any} town @param {any} frames */
export function fileHomeFrames(town, frames) {
  if (!(frames instanceof Map)) return;
  town.homeFrames = frames;
  for (const [i, x] of town.pieces.entries()) {
    const b = town.plan.buildings[i], record = x.record;
    if (!isResidence(record.buildingType) || frames.has(record.buildingKey)) continue;
    const easts = b.footprint.map((point) => point[0]), norths = b.footprint.map((point) => point[1]), floor = x.piece.frame[13];
    const rect = [Math.min(...easts), Math.min(...norths), Math.max(...easts), Math.max(...norths)];
    frames.set(record.buildingKey, { at: [b.at[0], floor, b.at[1]], box: [rect[0], floor, rect[1], rect[2], floor + HOUSE_HEIGHT, rect[3]], rects: [rect], grounds: [], type: record.buildingType, faction: record.factionId ?? 0, parts: [], terraced: false });
    town.homeKeys.push(record.buildingKey);
  }
}
/** How high a house's yard box reaches over its floor, metres - two storeys and a roof. */
export const HOUSE_HEIGHT = 9;

/** The model runs a settlement takes, published or grown, from a free list oldest-let-go first: a run comes round again
 *  only after every other was let go, its meshes long settled, and never while a settlement stands on it. */
export const SETTLEMENT_SLOTS = 512;
const _free = Array.from({ length: SETTLEMENT_SLOTS }, (_, i) => i);
/** A free run, or -1 when every run stands. */
export const takeSlot = () => _free.shift() ?? -1;
/** How many runs are free. */
export const slotsFree = () => _free.length;
/** A run let go, to come round last. @param {number} slot */
export const releaseSlot = (slot) => {
  if (slot >= 0 && slot < SETTLEMENT_SLOTS && !_free.includes(slot)) _free.push(slot);
};
/** Settlements stood in one frame at most: a stand is tens of milliseconds of dressing and meshing. */
export const STANDS_PER_FRAME = 1;
const IDENTITY = trs(0, 0, 0, 0, 0, 0);

/**
 * A settlement on its built pixel, dressed: its plan, its pieces and its doors, pixel-local. Pure but for the model map.
 * a grown town's outskirts carry their own input and job (world/settlement/townGrowth.js); every settlement takes `slot`'s run.
 * @param {{ px: number, py: number, settlement: { ordinal: number, layout: any, growth?: boolean, input?: any, job?: any } }} p
 * @param {any} blocksFile @param {number} [slot]
 */
export function standSettlement(p, blocksFile, slot = -1) {
  const held = p.settlement, row = held.growth ? null : SETTLEMENT_ROWS[held.ordinal];
  if (!(slot >= 0 && slot < SETTLEMENT_SLOTS) || (held.growth ? !(held.input && held.job) : !row)) return null;
  const input = held.growth ? held.input : settlementInput(row, p.px, p.py), L = held.layout;
  const name = held.growth ? held.job.name : row.name, style = held.growth ? held.job.style : row.style, run = slot;
  const { plan } = dressSettlement(input, L, { check: false });   // its plan held to the contract where it is made and published
  const town = { place: input.place, name, regionIndex: held.growth ? held.job.regionIndex : regionOfTheatre(theatreAt(p.px, p.py)), blocks: held.growth ? held.job.blocks ?? 1 : 1 };
  const floorOf = new Map(plan.pads.map((d) => [d.id, L.datum + d.y]));
  const pieces = plan.buildings.map((b, i) => {
    const piece = buildingPiece(plan, b, /** @type {number} */ (floorOf.get(b.pad)) + (b.lift ?? 0), style);
    const record = buildingRecord(town, b, piece.area);
    let interior = null;
    const dfBlock = { name: `SETTLE${input.place}.${b.key}`, index: -1, rmbBlock: { subRecords: [{ get interior() { return (interior ??= buildingInterior(input.place, b, piece, blocksFile)); } }] } };
    return { id: buildingModelId(run, i), piece, record, dfBlock };
  });
  if (pieces.length >= SETTLEMENT_MODEL_RUN - 1) return null;   // its features keep the run's last id
  return {
    row, name, plan, town, datum: L.datum, groundId: groundModelId(run), ground: groundModel(plan, L.datum, new Map(L.cells.map((c) => [c.id, c])), style),
    featuresId: featuresModelId(run), features: featuresModel(plan, L.datum, style), solids: featureSolids(plan), pieces, climateBase: townLookBase(style) ?? 300,
  };
}

/**
 * @param {{ renderer?: any, pipeline?: any, collider?: () => any, built: () => Iterable<any>, translation: (px: number, py: number, out?: number[]) => number[],
 *   blocksFile?: () => any, feet?: () => (number[]|null), exterior?: () => boolean }} deps
 */
export function createSettlementHost({ renderer = null, pipeline = null, collider = () => null, built, translation, blocksFile = () => null, feet = () => null, exterior = () => true }) {
  installSettlementModels();
  /** @type {Map<string, any>} */ const stood = new Map();
  const broken = new WeakSet();   // a plan whose stand threw: tried once, its run given back
  let doorsGen = 0;   // moved as a settlement stands or goes: the modes' door picks are cached by it
  const t = [0, 0, 0];
  const mesh = (s, id) => {
    const src = s.hold ?? pipeline;
    if (s.meshes.has(id) || !src?.getGpuMesh) return;
    s.meshes.set(id, null);
    Promise.resolve(src.getGpuMesh(id)).then((g) => s.meshes.set(id, g ?? null), () => {});   // one taken down meanwhile is no one's
  };
  function stand(p, key) {
    const slot = takeSlot();
    let made = null;
    try { made = standSettlement(p, blocksFile(), slot); } catch (e) { broken.add(p.settlement); console.warn('[settlements]', e?.message ?? e); }
    if (!made) { releaseSlot(slot); return; }
    _models.set(made.groundId, made.ground);
    _models.set(made.featuresId, made.features);
    for (const x of made.pieces) _models.set(x.id, x.piece.model);
    // Its meshes held through its own hold, let go as it goes (scenes/dataPipeline.js holdPlace)
    const hold = pipeline?.holdPlace?.('settlement', key) ?? null;
    const s = { key, px: p.px, py: p.py, slot, src: p.settlement, ...made, hold, meshes: new Map(), colAt: false, scene: null, homeFrames: null, homeKeys: [], at: [0, 0, 0], ride: null,
      boxes: { ground: localAabb(made.ground.positions), features: made.features.indices.length ? localAabb(made.features.positions) : null, pieces: made.pieces.map((x) => localAabb(x.piece.model.positions)) } };
    // its collider rides the floating frame as a pixel's own buckets do: filed once, never again as the origin moves
    s.ride = onFloatingFrame(floatingFrameOf(translation), () => translation(s.px, s.py, s.at));
    fileHomeFrames(s, p.homeFrames);   // Its houses' yards (scenes/homeYards.js reads a built pixel's homeFrames)
    stood.set(key, s);
    doorsGen++;
    mesh(s, s.groundId);
    mesh(s, s.featuresId);
    for (const x of s.pieces) { mesh(s, x.id); mesh(s, x.piece.doorId); }
  }
  /** A pixel built again in place swaps its entry with no frame between: the same plan files its yards on the new entry,
   *  another (roads landed under a grown town) is taken down and stood again - when this frame may stand one (answers so). */
  function restand(town, entry, mayStand) {
    const same = (a, b) => JSON.stringify(a.layout) === JSON.stringify(b.layout) && JSON.stringify(a.input ?? null) === JSON.stringify(b.input ?? null);
    if (town.src !== entry.settlement && town.alikeOf !== entry.settlement) [town.alikeOf, town.alike] = [entry.settlement, same(town.src, entry.settlement)];   // asked once an entry, not each frame it waits
    if (town.src !== entry.settlement && !town.alike) {
      if (!mayStand) return false;   // the old plan stands a frame longer
      takeDown(town);
      stand(entry, town.key);
      return true;
    }
    town.src = entry.settlement;
    if (town.homeFrames === (entry.homeFrames ?? null)) return false;
    for (const k of town.homeKeys) town.homeFrames?.delete(k);
    town.homeKeys = [];
    fileHomeFrames(town, entry.homeFrames);
    return false;
  }
  function takeDown(s) {
    stood.delete(s.key);
    doorsGen++;
    releaseSlot(s.slot);
    s.hold?.release?.();
    for (const k of s.homeKeys) s.homeFrames?.delete(k);
    collider()?.removeBucket?.(`settlement:${s.key}`);
    // its ids come again (a row's run, a slot round again): their kept models go with it
    for (const id of [s.groundId, s.featuresId, ...s.pieces.map((x) => x.id)]) { _models.delete(id); forgetFamilyModel(id); }
  }
  /** Its scene matrices and doors, made again when the floating origin moves. */
  function scene(s) {
    translation(s.px, s.py, t);
    if (s.scene && s.scene.t[0] === t[0] && s.scene.t[1] === t[1] && s.scene.t[2] === t[2]) return s.scene;
    const at = (m) => { const o = Float32Array.from(m); o[12] += t[0]; o[13] += t[1]; o[14] += t[2]; return o; };
    const ground = trs(t[0], t[1], t[2], 0, 0, 0);
    const pieces = s.pieces.map((x, i) => { const frame = at(x.piece.frame); return { id: x.id, frame, doorId: x.piece.doorId, doorFrame: at(x.piece.doorFrame), box: transformedAabb(s.boxes.pieces[i], frame) }; });
    const doors = s.pieces.map((x, i) => x.piece.doors?.[0] && ({
      door: { ...x.piece.doors[0], matrix: pieces[i].doorFrame }, localDoor: x.piece.doors[0], dfBlock: x.dfBlock, recordIndex: 0,
      climateBase: s.climateBase, season: INTERIOR_SEASON, settlement: x.record,
    })).filter(Boolean);
    const groundBox = transformedAabb(s.boxes.ground, ground), featuresBox = s.boxes.features && transformedAabb(s.boxes.features, ground);
    return (s.scene = { t: [t[0], t[1], t[2]], ground, groundBox, featuresBox, pieces, doors });
  }
  /** Its collider: the ground, its features and every building, filed once in the pixel's frame; held back while feet stand
   *  inside a wall, a building's or a feature's (a fort's wall, a tower, a well). */
  function standCollider(s) {
    const col = collider();
    if (!col?.addMesh || s.colAt) return;
    const feetNow = feet(), t = translation(s.px, s.py, s.at);
    if (feetNow && [...s.plan.buildings.map((b) => b.footprint), ...s.solids].some((ring) => inside(ring, feetNow[0] - t[0], feetNow[2] - t[2]))) return;
    const bucket = `settlement:${s.key}`;
    col.removeBucket?.(bucket);
    col.addMesh(bucket, s.ground.positions, s.ground.indices, IDENTITY, s.ride);
    if (s.features.indices.length) col.addMesh(bucket, s.features.positions, s.features.indices, IDENTITY, s.ride);
    for (const x of s.pieces) col.addMesh(bucket, x.piece.model.positions, x.piece.model.indices, x.piece.frame, s.ride);
    s.colAt = true;
  }
  // a shot-mode probe's view (tools/settlementWorldProbe.mjs): each stood settlement, its middle in the scene, its doors
  if (typeof window !== 'undefined' && pageHas('shot')) {
    /** @type {any} */ (window).__settlementView = () => [...stood.values()].map((s) => {
      const sc = scene(s), c = s.plan.pads.find((p) => p.id === 'plaza') ?? s.plan.pads[0];
      const mid = c.poly.reduce((a, p) => [a[0] + p[0] / c.poly.length, a[1] + p[1] / c.poly.length], [0, 0]);
      return { key: s.key, name: s.name, buildings: s.plan.buildings.length, ready: [...s.meshes.values()].filter(Boolean).length, meshes: s.meshes.size,
        mid: [sc.t[0] + mid[0], sc.t[1] + s.datum + c.y, sc.t[2] + mid[1]],
        doors: sc.doors.slice(0, 3).map((d) => ({ at: [d.door.matrix[12], d.door.matrix[13], d.door.matrix[14]], facing: s.plan.buildings.find((b) => b.key === d.settlement.buildingKey)?.entrances[0].facing, type: d.settlement.buildingType })) };
    });
  }
  return {
    /** Stand what the built pixels hold, take down what left. A throw is warned here, so the world's frame calls it bare. */
    frame() {
      try {
        const live = new Set();
        let stands = STANDS_PER_FRAME;
        for (const p of built()) {
          if (!p?.settlement) continue;
          const key = `${p.px},${p.py}`;
          live.add(key);
          const town = stood.get(key);
          if (!town) { if (stands > 0 && !broken.has(p.settlement)) { stands--; stand(p, key); } }
          else if ((town.src !== p.settlement || town.homeFrames !== (p.homeFrames ?? null)) && restand(town, p, stands > 0)) stands--;
        }
        for (const s of [...stood.values()]) if (!live.has(s.key)) takeDown(s);
        for (const s of stood.values()) standCollider(s);
      } catch (e) { console.warn('[settlements]', e?.message ?? e); }
    },
    /** Each settlement's ground, features and buildings; `cull` the street's view test (world.js yardCull), asked of each
     *  piece's box: in view drawn, off screen in a shadow's reach cast alone, else neither. Answers how many it drew. */
    draw(r = renderer, cull = null) {
      if (!r?.drawMesh || !exterior()) return 0;
      let n = 0;
      const one = (mesh, matrix, box) => {
        const verdict = cull && box ? cull(box) : DECOR_DRAW;
        if (!mesh || verdict === DECOR_SKIP) return 0;
        (verdict === DECOR_SHADOW ? castOnly(r) : r).drawMesh(mesh, matrix, null);
        return verdict === DECOR_DRAW ? 1 : 0;
      };
      for (const s of stood.values()) {
        const sc = scene(s);
        n += one(s.meshes.get(s.groundId), sc.ground, sc.groundBox) + one(s.meshes.get(s.featuresId), sc.ground, sc.featuresBox);
        for (const x of sc.pieces) n += one(s.meshes.get(x.id), x.frame, x.box) + one(s.meshes.get(x.doorId), x.doorFrame, x.box);
      }
      return n;
    },
    /** The modes' doors: each building's, in the scene, its record (`settlement`) and its rooms (`dfBlock`) riding along. */
    doorTargets() {
      const out = [];
      if (exterior()) for (const s of stood.values()) out.push(...scene(s).doors);
      return out;
    },
    /** The plan stood on a pixel, or null (a probe's, a test's). */
    planAt: (px, py) => stood.get(`${px},${py}`)?.plan ?? null,
    /** The run and model ids a pixel's settlement stands on, or null (a probe's, a test's). */
    doorsGen: () => doorsGen,
    idsAt: (px, py) => { const s = stood.get(`${px},${py}`); return s ? { slot: s.slot, ground: s.groundId, features: s.featuresId } : null; },
    count: () => stood.size,
    destroyAll() { for (const s of [...stood.values()]) takeDown(s); },
  };
}

/** Is a pixel-local point (x east, z north) inside a footprint? @param {any} fp @param {number} x @param {number} z */
function inside(fp, x, z) {
  let c = false;
  for (let i = 0, j = fp.length - 1; i < fp.length; j = i++) {
    const a = fp[i], b = fp[j];
    if ((a[1] > z) !== (b[1] > z) && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
