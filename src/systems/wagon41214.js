// @ts-check
// HORSE CART AND CARGO - MODEL 41214, SPLIT (HCC, 2026-09-23): `Wagon41214VisualBuilder` and `WagonCargoVisual`'s
// table, read off TrailingWagon.dll's IL (vendor/horse-cart-and-cargo/il/). Daggerfall's wagon is ONE mesh; the
// mod takes it apart so the wheels can turn: every triangle is joined to every other that shares a welded vertex
// (positions within 1e-4), which yields exactly five connected components - the body (14 triangles), two wheels
// (10 each, flat discs whose X extent is nil), two shafts (7 each) - verified against that topology and refused
// otherwise, so a replacement model can never be mistaken for the classic one. Each wheel becomes its own mesh
// re-based on a pivot at its bounds' centre; the radius is the average of the wheels' (Y + Z extents) / 4.
//
// The port's model record is `scenes/dataPipeline.js`'s cpu copy - `{ positions, normals, uvs, indices,
// subMeshes: [{ textureArchive, textureRecord, startIndex, primitiveCount }] }`, one vertex per plane point as
// DFU's MeshReader lays them, so the counts the mod verifies (102 vertices, 4 sub-meshes, 48 triangles) are the
// same counts here. The pieces come out as model records the renderer's createMesh takes; a sub-mesh a piece has
// no triangles in is left out of that piece (the mod keeps it as an empty sub-mesh with the same material, which
// draws nothing - the same picture).

export const EXPECTED_VERTEX_COUNT = 102, EXPECTED_TRIANGLE_COUNT = 48, EXPECTED_SUBMESH_COUNT = 4, EXPECTED_COMPONENT_COUNT = 5;
export const BODY_TRIANGLES = 14, WHEEL_TRIANGLES = 10, SHAFT_TRIANGLES = 7;
export const POSITION_WELD_TOLERANCE = 1e-4;
export const POSITION_WELD_TOLERANCE_SQUARED = 1e-8;
export const WHEEL_PLANARITY_TOLERANCE = 0.001;

/** DisjointSet [IL_c844-IL_c934]: union by rank, full path compression. */
class DisjointSet {
  constructor(n) { this.parent = new Int32Array(n); this.rank = new Uint8Array(n); for (let i = 0; i < n; i++) this.parent[i] = i; }
  find(x) {
    let root = x;
    while (this.parent[root] !== root) root = this.parent[root];
    while (this.parent[x] !== x) { const next = this.parent[x]; this.parent[x] = root; x = next; }
    return root;
  }
  union(a, b) {
    const ra = this.find(a), rb = this.find(b);
    if (ra === rb) return;
    if (this.rank[ra] < this.rank[rb]) this.parent[ra] = rb;
    else if (this.rank[ra] > this.rank[rb]) this.parent[rb] = ra;
    else { this.parent[rb] = ra; this.rank[ra]++; }
  }
}

const isFinite3 = (p, i) => Number.isFinite(p[i * 3]) && Number.isFinite(p[i * 3 + 1]) && Number.isFinite(p[i * 3 + 2]);
const boundsOfComponent = (positions, verts) => {
  let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const v of verts) for (let k = 0; k < 3; k++) { const x = positions[v * 3 + k]; if (x < min[k]) min[k] = x; if (x > max[k]) max[k] = x; }
  return { min, max, center: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2], size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] };
};

/** ReadTriangles [IL_b58c]: every sub-mesh's triangles as { subMesh, a, b, c }, each index checked. */
export function readTriangles(model) {
  const vertexCount = model.positions.length / 3;
  const list = [];
  model.subMeshes.forEach((sm, sub) => {
    const n = sm.primitiveCount * 3;
    if (n % 3 !== 0) throw new Error(`Submesh ${sub} has invalid triangle indices.`);
    for (let i = 0; i < n; i += 3) {
      const tri = [model.indices[sm.startIndex + i], model.indices[sm.startIndex + i + 1], model.indices[sm.startIndex + i + 2]];
      for (const v of tri) if (!(v >= 0 && v < vertexCount)) throw new Error(`Submesh ${sub} references invalid vertex ${v}.`);
      list.push({ subMesh: sub, a: tri[0], b: tri[1], c: tri[2] });
    }
  });
  return list;
}

/** BuildComponents [IL_b66c]: weld the used vertices by position, join triangles through shared welded vertices,
 *  gather each set's triangles and bounds, sort by CompareComponents (more triangles first, then larger volume,
 *  then the smaller centre x). */
export function buildComponents(model, triangles) {
  const positions = model.positions;
  const vertexCount = positions.length / 3;
  const used = new Uint8Array(vertexCount);
  for (const t of triangles) { used[t.a] = 1; used[t.b] = 1; used[t.c] = 1; }
  const vertexSets = new DisjointSet(vertexCount);
  for (let i = 0; i < vertexCount; i++) {
    if (!used[i]) continue;
    if (!isFinite3(positions, i)) throw new Error(`Vertex ${i} is not finite.`);
    for (let j = i + 1; j < vertexCount; j++) {
      if (!used[j]) continue;
      const dx = positions[i * 3] - positions[j * 3], dy = positions[i * 3 + 1] - positions[j * 3 + 1], dz = positions[i * 3 + 2] - positions[j * 3 + 2];
      if (dx * dx + dy * dy + dz * dz > POSITION_WELD_TOLERANCE_SQUARED) continue;
      vertexSets.union(i, j);
    }
  }
  const triangleSets = new DisjointSet(triangles.length);
  const vertexOwner = new Map();
  const connect = (t, root) => { if (vertexOwner.has(root)) triangleSets.union(t, vertexOwner.get(root)); else vertexOwner.set(root, t); };
  triangles.forEach((tri, t) => { connect(t, vertexSets.find(tri.a)); connect(t, vertexSets.find(tri.b)); connect(t, vertexSets.find(tri.c)); });
  const byRoot = new Map();
  triangles.forEach((tri, t) => {
    const root = triangleSets.find(t);
    let comp = byRoot.get(root);
    if (!comp) { comp = { triangleIndices: [], verts: new Set() }; byRoot.set(root, comp); }
    comp.triangleIndices.push(t);
    comp.verts.add(tri.a); comp.verts.add(tri.b); comp.verts.add(tri.c);
  });
  const result = [...byRoot.values()].map((c) => ({ triangleIndices: c.triangleIndices, bounds: boundsOfComponent(positions, c.verts) }));
  const volume = (c) => c.bounds.size[0] * c.bounds.size[1] * c.bounds.size[2];
  result.sort((a, b) => (b.triangleIndices.length - a.triangleIndices.length) || (volume(b) - volume(a)) || (a.bounds.center[0] - b.bounds.center[0]));
  return result;
}

/** IdentifyVerifiedParts [IL_b92c]: five components - one body of 14, two wheels of 10 planar in X, two shafts of 7;
 *  left is the smaller centre x. */
export function identifyVerifiedParts(components) {
  if (components.length !== EXPECTED_COMPONENT_COUNT) throw new Error(`Model 41214 produced ${components.length} components instead of ${EXPECTED_COMPONENT_COUNT}.`);
  const bodies = components.filter((c) => c.triangleIndices.length === BODY_TRIANGLES);
  const wheels = components.filter((c) => c.triangleIndices.length === WHEEL_TRIANGLES);
  const shafts = components.filter((c) => c.triangleIndices.length === SHAFT_TRIANGLES);
  if (bodies.length !== 1 || wheels.length !== 2 || shafts.length !== 2) throw new Error('Model 41214 component triangle counts no longer match the verified topology.');
  wheels.sort((a, b) => a.bounds.center[0] - b.bounds.center[0]);
  shafts.sort((a, b) => a.bounds.center[0] - b.bounds.center[0]);
  if (wheels[0].bounds.size[0] > WHEEL_PLANARITY_TOLERANCE || wheels[1].bounds.size[0] > WHEEL_PLANARITY_TOLERANCE) throw new Error('Model 41214 wheel components are no longer planar on local X.');
  return { body: bodies[0], wheelLeft: wheels[0], wheelRight: wheels[1], shaftLeft: shafts[0], shaftRight: shafts[1] };
}

/** BuildComponentMesh [IL_bbb4]: the component's triangles, its vertices renumbered in first-use order and
 *  re-based on `pivot`, one sub-mesh per source sub-mesh it has triangles in (the same textures). */
export function buildComponentModel(model, triangles, component, pivot, name) {
  const remap = new Map(), order = [];
  const remapVertex = (s) => { if (remap.has(s)) return remap.get(s); const i = order.length; remap.set(s, i); order.push(s); return i; };
  const perSub = model.subMeshes.map(() => []);
  for (const t of component.triangleIndices) {
    const tri = triangles[t];
    const l = perSub[tri.subMesh];
    l.push(remapVertex(tri.a), remapVertex(tri.b), remapVertex(tri.c));
  }
  const n = order.length;
  const positions = new Float32Array(n * 3), normals = new Float32Array(n * 3), uvs = new Float32Array(n * 2);
  order.forEach((s, i) => {
    positions[i * 3] = model.positions[s * 3] - pivot[0]; positions[i * 3 + 1] = model.positions[s * 3 + 1] - pivot[1]; positions[i * 3 + 2] = model.positions[s * 3 + 2] - pivot[2];
    normals[i * 3] = model.normals?.[s * 3] ?? 0; normals[i * 3 + 1] = model.normals?.[s * 3 + 1] ?? 1; normals[i * 3 + 2] = model.normals?.[s * 3 + 2] ?? 0;
    uvs[i * 2] = model.uvs?.[s * 2] ?? 0; uvs[i * 2 + 1] = model.uvs?.[s * 2 + 1] ?? 0;
  });
  const subMeshes = [];
  const indexList = [];
  perSub.forEach((l, sub) => {
    if (!l.length) return;
    const src = model.subMeshes[sub];
    subMeshes.push({ textureArchive: src.textureArchive, textureRecord: src.textureRecord, startIndex: indexList.length, primitiveCount: l.length / 3 });
    indexList.push(...l);
  });
  return { name: `TrailingWagon41214_${name}`, positions, normals, uvs, indices: new Uint32Array(indexList), subMeshes, doors: [] };
}

/**
 * TryBuild [IL_b21c]: the five pieces of the classic wagon, or a thrown Error naming what the model failed.
 * @returns {{ body:object, shaftLeft:object, shaftRight:object, wheelLeft:object, wheelRight:object,
 *            wheelLeftPivot:number[], wheelRightPivot:number[], wheelRadius:number, bounds:{min:number[],max:number[],center:number[],size:number[]} }}
 */
export function buildWagonParts(model) {
  if (!model || !model.positions || !model.indices || !Array.isArray(model.subMeshes)) throw new Error('Model 41214 did not provide its source mesh.');
  const vertexCount = model.positions.length / 3;
  if (vertexCount !== EXPECTED_VERTEX_COUNT || model.subMeshes.length !== EXPECTED_SUBMESH_COUNT) throw new Error(`Model 41214 topology changed (vertices=${vertexCount}, submeshes=${model.subMeshes.length}).`);
  if ((model.normals?.length ?? 0) !== vertexCount * 3 || (model.uvs?.length ?? 0) !== vertexCount * 2) throw new Error('Model 41214 did not provide complete normals and UVs.');
  const triangles = readTriangles(model);
  if (triangles.length !== EXPECTED_TRIANGLE_COUNT) throw new Error(`Model 41214 topology changed (triangles=${triangles.length}).`);
  const components = buildComponents(model, triangles);
  const p = identifyVerifiedParts(components);
  const zero = [0, 0, 0];
  const wheelLeftPivot = [...p.wheelLeft.bounds.center], wheelRightPivot = [...p.wheelRight.bounds.center];
  const wheelRadius = (((p.wheelLeft.bounds.size[1] + p.wheelLeft.bounds.size[2]) * 0.25) + ((p.wheelRight.bounds.size[1] + p.wheelRight.bounds.size[2]) * 0.25)) * 0.5;
  if (!(wheelRadius > 0)) throw new Error('Model 41214 produced an invalid wheel radius.');
  const all = new Set();
  for (let i = 0; i < vertexCount; i++) all.add(i);
  return {
    body: buildComponentModel(model, triangles, p.body, zero, 'Body'),
    shaftLeft: buildComponentModel(model, triangles, p.shaftLeft, zero, 'ShaftLeft'),
    shaftRight: buildComponentModel(model, triangles, p.shaftRight, zero, 'ShaftRight'),
    wheelLeft: buildComponentModel(model, triangles, p.wheelLeft, wheelLeftPivot, 'WheelLeft'),
    wheelRight: buildComponentModel(model, triangles, p.wheelRight, wheelRightPivot, 'WheelRight'),
    wheelLeftPivot, wheelRightPivot, wheelRadius,
    bounds: boundsOfComponent(model.positions, all),
  };
}

/** DeployedWagonVisual.EnsureUsableBoundsSize [IL_10f1]: a collider box no thinner than 0.1 on any axis - the bounds
 *  widened about their centre where the model is flat. */
export function usableBounds(bounds) {
  const min = [...bounds.min], max = [...bounds.max];
  for (let a = 0; a < 3; a++) {
    const size = max[a] - min[a];
    if (size >= 0.1) continue;
    const c = (min[a] + max[a]) / 2;
    min[a] = c - 0.05; max[a] = c + 0.05;
  }
  return { min, max };
}

/** WagonCargoVisual's twelve pieces (.cctor [IL_c30c-IL_c5f8]): the fullness threshold, the classic model, and
 *  its local position, rotation (x, y, z, w) and scale in the wagon's frame. Tiers are cumulative. */
/** @type {ReadonlyArray<{threshold:number, modelId:number, position:number[], rotation:number[], scale:number[]}>} */
export const CARGO_DEFINITIONS = Object.freeze([
  { threshold: 25, modelId: 41815, position: [-0.4324226379394531, -0.017484188079833984, -1.0604987144470215], rotation: [-0.050840601325035095, -0.5570908188819885, 0.02464766800403595, 0.8285273313522339], scale: [1.4088822603225708, 1.4088822603225708, 1.4088823795318604] },
  { threshold: 25, modelId: 41815, position: [0.45854616165161133, -0.014197111129760742, -0.1106463074684143], rotation: [-0.05616017431020737, -0.24730263650417328, 0.006189450621604919, 0.9672896265983582], scale: [1.4088822603225708, 1.4088822603225708, 1.4088823795318604] },
  { threshold: 50, modelId: 41817, position: [-0.5439999103546143, 0.03000009059906006, -0.10999998450279236], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
  { threshold: 50, modelId: 41821, position: [-0.4440000057220459, 0.3089999556541443, -1.1030000448226929], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
  { threshold: 50, modelId: 41822, position: [0.5290000438690186, 0.20299994945526123, -1.3799999952316284], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
  { threshold: 75, modelId: 41824, position: [-0.7549999952316284, 0.40599995851516724, -0.3100000023841858], rotation: [0, 0.7444443106651306, 0, 0.6676845550537109], scale: [1, 1, 1] },
  { threshold: 75, modelId: 41825, position: [0.6460000276565552, 0.3539999723434448, -0.3149999976158142], rotation: [0, 0.11213237792253494, 0, 0.9936932921409607], scale: [1, 1, 1] },
  { threshold: 75, modelId: 41826, position: [-0.14399999380111694, 0.4589999318122864, -0.2720000147819519], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
  { threshold: 90, modelId: 41827, position: [-0.43400001525878906, 0.5889999270439148, -1.2999999523162842], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
  { threshold: 90, modelId: 41828, position: [0.5529999732971191, 0.8370000720024109, -1.4609999656677246], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
  { threshold: 90, modelId: 41829, position: [0.5299999713897705, 0.6119999289512634, -0.33399999141693115], rotation: [0, 0, 0, 1], scale: [0.5192000269889832, 0.5192000269889832, 0.5192000269889832] },
  { threshold: 90, modelId: 41830, position: [0.550000011920929, 0.8439999222755432, -0.7860000133514404], rotation: [-0.0019527215044945478, -0.011217683553695679, 0.0041197012178599834, 0.9999266862869263], scale: [1, 1, 1] },
].map((d) => Object.freeze(d)));
/** The object name the mod gives a piece: Cargo_{threshold}_{ordinal:00}_Model_{id}. */
export const cargoPieceName = (def, ordinal) => `Cargo_${def.threshold}_${String(ordinal).padStart(2, '0')}_Model_${def.modelId}`;
/** ApplyTier [IL_c1d4]: which pieces show at a tier - every piece whose threshold the tier reaches. */
export const cargoPiecesShown = (tier) => CARGO_DEFINITIONS.filter((d) => tier >= d.threshold);
