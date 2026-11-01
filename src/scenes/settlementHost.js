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
import { groundModel, buildingPiece, buildingInterior, buildingRecord, groundModelId, buildingModelId, isSettlementModelId } from '../world/settlement/settlementModels.js';
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

/** The model runs a grown town takes, in turn - the published rows keep their ordinals' runs below the first. */
export const GROWTH_SLOT_FIRST = 16;
export const GROWTH_SLOTS = 512 - GROWTH_SLOT_FIRST;
let _nextSlot = 0;
/** The next run a grown town takes; a run comes round again only after GROWTH_SLOTS others, long after its meshes went. */
export const nextGrowthSlot = () => GROWTH_SLOT_FIRST + (_nextSlot++ % GROWTH_SLOTS);

/**
 * A settlement on its built pixel, dressed: its plan, its pieces and its doors, pixel-local. Pure but for the model map.
 * a grown town's outskirts carry their own input and job (world/settlement/townGrowth.js), and take `slot`'s run.
 * @param {{ px: number, py: number, settlement: { ordinal: number, layout: any, growth?: boolean, input?: any, job?: any } }} p
 * @param {any} blocksFile @param {number} [slot]
 */
export function standSettlement(p, blocksFile, slot = -1) {
  const held = p.settlement, row = held.growth ? null : SETTLEMENT_ROWS[held.ordinal];
  if (held.growth ? !(held.input && held.job && slot >= GROWTH_SLOT_FIRST) : !row) return null;
  const input = held.growth ? held.input : settlementInput(row, p.px, p.py), L = held.layout;
  const name = held.growth ? held.job.name : row.name, style = held.growth ? held.job.style : row.style, run = held.growth ? slot : row.ordinal;
  const { plan } = dressSettlement(input, L);
  const town = { place: input.place, name, regionIndex: held.growth ? held.job.regionIndex : regionOfTheatre(theatreAt(p.px, p.py)), blocks: held.growth ? held.job.blocks ?? 1 : 1 };
  const floorOf = new Map(plan.pads.map((d) => [d.id, L.datum + d.y]));
  const pieces = plan.buildings.map((b, i) => {
    const piece = buildingPiece(plan, b, /** @type {number} */ (floorOf.get(b.pad)) + (b.lift ?? 0), style);
    const record = buildingRecord(town, b, piece.area);
    let interior = null;
    const dfBlock = { name: `SETTLE${input.place}.${b.key}`, index: -1, rmbBlock: { subRecords: [{ get interior() { return (interior ??= buildingInterior(input.place, b, piece, blocksFile)); } }] } };
    return { id: buildingModelId(run, i), piece, record, dfBlock };
  });
  return { row, name, plan, town, datum: L.datum, groundId: groundModelId(run), ground: groundModel(plan, L.datum, new Map(L.cells.map((c) => [c.id, c])), style), pieces, climateBase: townLookBase(style) ?? 300 };
}

/**
 * @param {{ renderer?: any, pipeline?: any, collider?: () => any, built: () => Iterable<any>, translation: (px: number, py: number, out?: number[]) => number[],
 *   blocksFile?: () => any, feet?: () => (number[]|null), exterior?: () => boolean }} deps
 */
export function createSettlementHost({ renderer = null, pipeline = null, collider = () => null, built, translation, blocksFile = () => null, feet = () => null, exterior = () => true }) {
  installSettlementModels();
  /** @type {Map<string, any>} */ const stood = new Map();
  const t = [0, 0, 0];
  const mesh = (s, id) => {
    const src = s.hold ?? pipeline;
    if (s.meshes.has(id) || !src?.getGpuMesh) return;
    s.meshes.set(id, null);
    Promise.resolve(src.getGpuMesh(id)).then((g) => s.meshes.set(id, g ?? null), () => {});   // one taken down meanwhile is no one's
  };
  function stand(p, key) {
    const made = standSettlement(p, blocksFile(), p.settlement.growth ? nextGrowthSlot() : -1);
    if (!made) return;
    _models.set(made.groundId, made.ground);
    for (const x of made.pieces) _models.set(x.id, x.piece.model);
    // Its meshes held through its own hold, let go as it goes (scenes/dataPipeline.js holdPlace)
    const hold = pipeline?.holdPlace?.('settlement', key) ?? null;
    const s = { key, px: p.px, py: p.py, src: p.settlement, ...made, hold, meshes: new Map(), colAt: null, scene: null, homeFrames: null, homeKeys: [] };
    fileHomeFrames(s, p.homeFrames);   // Its houses' yards (scenes/homeYards.js reads a built pixel's homeFrames)
    stood.set(key, s);
    mesh(s, s.groundId);
    for (const x of s.pieces) { mesh(s, x.id); mesh(s, x.piece.doorId); }
  }
  /** A pixel built again in place swaps its entry with no frame between: the same plan files its yards on the new entry,
   *  another (roads landed under a grown town) is taken down and stood again. */
  function restand(s, p) {
    const same = (a, b) => JSON.stringify(a.layout) === JSON.stringify(b.layout) && JSON.stringify(a.input ?? null) === JSON.stringify(b.input ?? null);
    if (s.src !== p.settlement && !same(s.src, p.settlement)) { takeDown(s); stand(p, s.key); return; }
    s.src = p.settlement;
    if (s.homeFrames === (p.homeFrames ?? null)) return;
    for (const k of s.homeKeys) s.homeFrames?.delete(k);
    s.homeKeys = [];
    fileHomeFrames(s, p.homeFrames);
  }
  function takeDown(s) {
    stood.delete(s.key);
    s.hold?.release?.();
    for (const k of s.homeKeys) s.homeFrames?.delete(k);
    collider()?.removeBucket?.(`settlement:${s.key}`);
    // its ids come again (a row's run, a slot round again): their kept models go with it
    for (const id of [s.groundId, ...s.pieces.map((x) => x.id)]) { _models.delete(id); forgetFamilyModel(id); }
  }
  /** Its scene matrices and doors, made again when the floating origin moves. */
  function scene(s) {
    translation(s.px, s.py, t);
    if (s.scene && s.scene.t[0] === t[0] && s.scene.t[1] === t[1] && s.scene.t[2] === t[2]) return s.scene;
    const at = (m) => { const o = Float32Array.from(m); o[12] += t[0]; o[13] += t[1]; o[14] += t[2]; return o; };
    const ground = trs(t[0], t[1], t[2], 0, 0, 0);
    const pieces = s.pieces.map((x) => ({ id: x.id, frame: at(x.piece.frame), doorId: x.piece.doorId, doorFrame: at(x.piece.doorFrame) }));
    const doors = s.pieces.map((x, i) => x.piece.doors?.[0] && ({
      door: { ...x.piece.doors[0], matrix: pieces[i].doorFrame }, localDoor: x.piece.doors[0], dfBlock: x.dfBlock, recordIndex: 0,
      climateBase: s.climateBase, season: INTERIOR_SEASON, settlement: x.record,
    })).filter(Boolean);
    return (s.scene = { t: [t[0], t[1], t[2]], ground, pieces, doors });
  }
  /** Its collider: the ground and every building, filed again when the origin moves; held back while feet stand inside a wall. */
  function standCollider(s) {
    const col = collider(), sc = scene(s);
    if (!col?.addMesh || s.colAt === sc) return;
    const f = feet();
    if (f && !s.colAt && s.plan.buildings.some((b) => inside(b.footprint, f[0] - sc.t[0], f[2] - sc.t[2]))) return;
    col.removeBucket?.(`settlement:${s.key}`);
    col.addMesh(`settlement:${s.key}`, s.ground.positions, s.ground.indices, sc.ground);
    for (const [i, x] of s.pieces.entries()) col.addMesh(`settlement:${s.key}`, x.piece.model.positions, x.piece.model.indices, sc.pieces[i].frame);
    s.colAt = sc;
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
        for (const p of built()) {
          if (!p?.settlement) continue;
          const key = `${p.px},${p.py}`;
          live.add(key);
          const s = stood.get(key);
          if (!s) stand(p, key);
          else if (s.src !== p.settlement || s.homeFrames !== (p.homeFrames ?? null)) restand(s, p);
        }
        for (const s of [...stood.values()]) if (!live.has(s.key)) takeDown(s);
        for (const s of stood.values()) standCollider(s);
      } catch (e) { console.warn('[settlements]', e?.message ?? e); }
    },
    draw(r = renderer) {
      if (!r?.drawMesh || !exterior()) return 0;
      let n = 0;
      for (const s of stood.values()) {
        const sc = scene(s), g = s.meshes.get(s.groundId);
        if (g) { r.drawMesh(g, sc.ground, null); n++; }
        for (const x of sc.pieces) {
          const m = s.meshes.get(x.id), d = s.meshes.get(x.doorId);
          if (m) { r.drawMesh(m, x.frame, null); n++; }
          if (d) { r.drawMesh(d, x.doorFrame, null); n++; }
        }
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
