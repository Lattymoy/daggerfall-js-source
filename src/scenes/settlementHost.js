// @ts-check
// RMB-CONTRACTS RMBC4 (2026-10-31, bible/03-World/RMB-Contracts.md RD-17): THE SETTLEMENTS, WHERE THEY STAND - the streaming
// world's pool on the yards' shape (merchantYardsHost.js). Each built pixel whose worker laid out a settlement
// (`p.settlement`, settlement/settlementStand.js) is dressed here from its row and that layout, its ground and buildings
// made models (settlement/settlementModels.js, a model family the pipeline uploads), drawn at the pixel's translation,
// filed with the collider, and its doors handed to the modes with each building's record and its generated rooms.
// THE FOUR HOSTS (bible/Home.md): scenes/world.js WIRED; scenes/worldModes.js WIRED through world.js's doorTargets and
// buildingDataForDoor (no line of its own); scenes/exterior.js and scenes/dungeonContext.js FLAGGED: they stream no pixel.
import { registerCustomModelFamily } from '../world/customModels.js';
import { installFabricDoors } from '../world/imperialFabricBuildings.js';   // the doors' models: the Imperial City installs them only when it builds
import { SETTLEMENT_ROWS, settlementInput } from '../world/settlement/settlementPlaces.js';
import { dressSettlement } from '../world/settlement/settlementGen.js';
import { groundModel, buildingPiece, buildingInterior, buildingRecord, groundModelId, buildingModelId, isSettlementModelId } from '../world/settlement/settlementModels.js';
import { regionOfTheatre } from '../formats/mapsTables.js';
import { theatreAt } from '../world/worldWide/worldGrid.js';
import { townLookBase } from '../world/urban/townLook.js';
import { INTERIOR_SEASON } from '../world/climateSwaps.js';
import { trs } from '../world/mat4.js';

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

/**
 * A settlement on its built pixel, dressed: its plan, its pieces and its doors, pixel-local. Pure but for the model map.
 * @param {{ px: number, py: number, settlement: { ordinal: number, layout: any } }} p @param {any} blocksFile
 */
export function standSettlement(p, blocksFile) {
  const row = SETTLEMENT_ROWS[p.settlement.ordinal];
  if (!row) return null;
  const input = settlementInput(row, p.px, p.py), L = p.settlement.layout;
  const { plan } = dressSettlement(input, L);
  const town = { place: input.place, name: row.name, regionIndex: regionOfTheatre(theatreAt(p.px, p.py)) };
  const floorOf = new Map(plan.pads.map((d) => [d.id, L.datum + d.y]));
  const pieces = plan.buildings.map((b, i) => {
    const piece = buildingPiece(plan, b, /** @type {number} */ (floorOf.get(b.pad)) + (b.lift ?? 0), row.style);
    const record = buildingRecord(town, b, piece.area);
    let interior = null;
    const dfBlock = { name: `SETTLE${input.place}.${b.key}`, index: -1, rmbBlock: { subRecords: [{ get interior() { return (interior ??= buildingInterior(input.place, b, piece, blocksFile)); } }] } };
    return { id: buildingModelId(row.ordinal, i), piece, record, dfBlock };
  });
  return { row, plan, town, datum: L.datum, groundId: groundModelId(row.ordinal), ground: groundModel(plan, L.datum, new Map(L.cells.map((c) => [c.id, c]))), pieces, climateBase: townLookBase(row.style) ?? 300 };
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
    if (s.meshes.has(id) || !pipeline?.getGpuMesh) return;
    s.meshes.set(id, null);
    Promise.resolve(pipeline.getGpuMesh(id)).then((g) => { if (stood.get(s.key) === s) s.meshes.set(id, g ?? null); }, () => {});
  };
  function stand(p, key) {
    const made = standSettlement(p, blocksFile());
    if (!made) return;
    _models.set(made.groundId, made.ground);
    for (const x of made.pieces) _models.set(x.id, x.piece.model);
    const s = { key, px: p.px, py: p.py, ...made, meshes: new Map(), colAt: null, scene: null };
    stood.set(key, s);
    mesh(s, s.groundId);
    for (const x of s.pieces) { mesh(s, x.id); mesh(s, x.piece.doorId); }
  }
  function takeDown(s) {
    stood.delete(s.key);
    collider()?.removeBucket?.(`settlement:${s.key}`);
    _models.delete(s.groundId);
    for (const x of s.pieces) _models.delete(x.id);
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
  if (typeof window !== 'undefined' && /[?&]shot\b/.test(window.location?.search ?? '')) {
    /** @type {any} */ (window).__settlementView = () => [...stood.values()].map((s) => {
      const sc = scene(s), c = s.plan.pads.find((p) => p.id === 'plaza') ?? s.plan.pads[0];
      const mid = c.poly.reduce((a, p) => [a[0] + p[0] / c.poly.length, a[1] + p[1] / c.poly.length], [0, 0]);
      return { key: s.key, name: s.row.name, buildings: s.plan.buildings.length, ready: [...s.meshes.values()].filter(Boolean).length, meshes: s.meshes.size,
        mid: [sc.t[0] + mid[0], sc.t[1] + s.datum + c.y, sc.t[2] + mid[1]],
        doors: sc.doors.slice(0, 3).map((d) => ({ at: [d.door.matrix[12], d.door.matrix[13], d.door.matrix[14]], facing: s.plan.buildings.find((b) => b.key === d.settlement.buildingKey)?.entrances[0].facing, type: d.settlement.buildingType })) };
    });
  }
  return {
    /** Stand what the built pixels hold, take down what left. */
    frame() {
      const live = new Set();
      for (const p of built()) {
        if (!p?.settlement) continue;
        const key = `${p.px},${p.py}`;
        live.add(key);
        if (!stood.has(key)) stand(p, key);
      }
      for (const s of [...stood.values()]) if (!live.has(s.key)) takeDown(s);
      for (const s of stood.values()) standCollider(s);
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
