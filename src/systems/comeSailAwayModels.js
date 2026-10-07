// @ts-check
// CSA-B (2026-09-27): COME SAIL AWAY'S BOATS, READ BACK - the files
// tools/comeSailAwayExtract.mjs wrote out of the mod's bundle
// (vendor/come-sail-away/Models/) as what the port instances and draws.
//
// - `prefabs.json`: the twelve prefabs DFU's MeshReplacement hands the
//   assembly (the seven trigger boxes 112400-112406, the five hulls
//   112410-112414) as node trees, their components in a shared table;
//   world/prefabNode.js instances one.
// - `meshes.json` + `meshes.bin`: each mesh's channels at their offsets in
//   the one binary file (position f32x3, normal f32x3 or f32x4, uv0 f32x2,
//   a skinned mesh's one-bone index u16), its indices (u16 or u32), its
//   submeshes (Unity's start, count and baseVertex), its box, and a skinned
//   mesh's bind poses (Unity's Matrix4x4, e00 e01 ... e33 - row by row).
// - `materials.json`: the bundle's materials by name.
// - `animation.json`: the controllers, overrides and clips (CSA-E plays them).
//
// A mesh decodes to the port's model shape (world/meshReader.js's:
// positions, normals, uvs, 32-bit indices - the renderer draws
// UNSIGNED_INT - with each submesh's baseVertex folded in) in Unity's own
// frame, which is the port's (DFU's space, verbatim): the uv0 channel is
// used as it stands because the port's textures are uploaded bottom row
// first, Unity's Texture2D order (render/renderer.js's header), and the
// triangles keep Unity's winding, which is the winding every DFU mesh the
// port already draws has.
//
// WHICH TEXTURE A SUBMESH WEARS is the renderer's, not the mesh's, and it is
// settled the way DFU settles it:
// - a MeshRenderer with DFU's RuntimeMaterials (every textured one on the
//   boats) takes MaterialReader.GetMaterial(Archive, Record) into slot
//   `Index`, for each entry, in the component's order and then the next
//   RuntimeMaterials' (RuntimeMaterials.cs ApplyMaterials; the carrack's
//   third mast carries two, and the second's 067_8 and 000_76 are what it
//   wears). ApplyClimate and UseDungeonTextureTable are off on every one
//   (pinned), so the answer never depends on where the boat stands - which
//   is why the port may settle it at instancing where Unity settles it at
//   each renderer's Awake;
// - a SkinnedMeshRenderer - a sail - takes the Come Sail Away script
//   ApplyGameTextures, which reads its CHILDREN's names: slot i wears the
//   archive and record child i spells `AAA_RRR` (ApplyGameTextures.cs;
//   `Convert.ToInt32`, so the trailing space four of the skiff's sails
//   carry reads as nothing). GetBoatTransforms adds it (systems/comeSailAway.js);
// - any other slot keeps the bundle's material: a Standard material named
//   after a Daggerfall texture but holding none (DFU's FinaliseMaterials
//   swaps one only for a LOOSE texture file, MeshReplacement.cs:419-420,
//   which the port does not read), Unity's Default-Material, the hull's
//   WaterMask. The port draws none of those: every renderer that keeps one
//   is inactive or switched off in the prefab and stays so (the flag's
//   cube, the carrack's two dock planks, three hulls' roots' helper plane - pinned),
//   and the water masks, never drawn (CSA-F: colour alone, before any opaque
//   thing, with no depth - the sea or the hull always draws over them).
// Every Daggerfall material here is MaterialReader.GetMaterial with its
// default alphaIndex of -1 - opaque, a mesh's (the pipeline's
// `uploadRecord(..., { opaque: true })`).
//
// A renderer with fewer materials than its mesh has submeshes draws only
// the first ones (the galleon's anchor: four submeshes, two materials),
// and one with more draws its last submesh again with each extra one -
// Unity's rule.

import { galleonPrefab, GALLEON_PREFAB_ID } from '../world/galleonModel.js';   // GALLEON: Mac's ship stands in for hull 2
import { carrackPrefab, CARRACK_PREFAB_ID } from '../world/carrackModel.js';   // SHIPS-2: and his carrack for hull 4,
import { largeBoatPrefab, LARGE_BOAT_PREFAB_ID } from '../world/largeBoatModel.js';   // his Tiny Ship for hull 1

/** Where the extractor's files are served (a pin reads them off the disk). */
export const CSA_MODEL_URLS = Object.freeze({
  prefabs: new URL('../../vendor/come-sail-away/Models/prefabs.json', import.meta.url).href,
  meshes: new URL('../../vendor/come-sail-away/Models/meshes.json', import.meta.url).href,
  bin: new URL('../../vendor/come-sail-away/Models/meshes.bin', import.meta.url).href,
  materials: new URL('../../vendor/come-sail-away/Models/materials.json', import.meta.url).href,
  animation: new URL('../../vendor/come-sail-away/Models/animation.json', import.meta.url).href,
});
/** GALLEON (2026-10-01): the new galleon's model, baked from Mac's export (tools/bakeGalleon.mjs) - the port's own, not
 *  the mod's, so never among its files above: hull 2 is built on it (comeSailAwayModels' `galleon`). */
export const GALLEON_MODEL_URL = new URL('../../src/assets/galleon/galleon.json', import.meta.url).href;
/** SHIPS-2 (2026-10-07): the new carrack's model and the new large boat's, baked from Mac's Tiny_Ship.fbx
 *  (tools/bakeCarrack.mjs, tools/bakeLargeBoat.mjs) - the port's own, as the galleon's is. */
export const CARRACK_MODEL_URL = new URL('../../src/assets/ships/carrack.json', import.meta.url).href;
export const LARGE_BOAT_MODEL_URL = new URL('../../src/assets/ships/largeBoat.json', import.meta.url).href;
/**
 * SHIPS-2: THE PORT'S OWN SHIPS, each standing in for one of the mod's hulls - its key in the files (`comeSailAwayModels`'
 * `galleon`, `carrack`, `largeBoat`), the hull and the prefab it stands in for, what it is called when it will not stand,
 * the builder that makes its prefab, and the mod's prefabs that builder copies small things out of (its cache's key).
 * Each one's answer is its own: one ship's model missing or broken stands that hull as the mod's own, never another.
 */
export const PORT_SHIPS = Object.freeze([
  Object.freeze({ key: 'galleon', hull: 2, id: GALLEON_PREFAB_ID, title: 'galleon', reads: Object.freeze([GALLEON_PREFAB_ID]), build: (bake, csa) => galleonPrefab(bake, csa) }),
  Object.freeze({ key: 'carrack', hull: 4, id: CARRACK_PREFAB_ID, title: 'carrack', reads: Object.freeze([CARRACK_PREFAB_ID, GALLEON_PREFAB_ID]), build: (bake, csa, base) => carrackPrefab(bake, csa, base) }),
  Object.freeze({ key: 'largeBoat', hull: 1, id: LARGE_BOAT_PREFAB_ID, title: 'large boat', reads: Object.freeze([LARGE_BOAT_PREFAB_ID, GALLEON_PREFAB_ID]), build: (bake, csa, base) => largeBoatPrefab(bake, csa, base) }),
]);
const MOD_TITLES = Object.freeze({ galleon: 'galleon', carrack: 'carrack', largeBoat: 'large boat' });

/** CSA-E: the wind widget's pictures as Start imports them - TryImportTexture(112395, 1, i), frame i of the 24. */
export const windWidgetFrameUrl = (/** @type {number} */ i) => new URL(`../../vendor/come-sail-away/Textures/112395_1-${i}.png`, import.meta.url).href;
/** CSA-F: the waves' frames as recipes (Textures/derived.json: each frame's paint, scroll and tile over TEXTURE.303
 *  record 1) and the author's paints they name - the frames are rebuilt from the player's ARENA2, never shipped. */
export const waveDerivedUrl = new URL('../../vendor/come-sail-away/Textures/derived.json', import.meta.url).href;
export const wavePaintUrl = (/** @type {string} */ name) => new URL(`../../vendor/come-sail-away/Textures/${name}`, import.meta.url).href;
/** CSA-G: the five clips Start loads (audioClips, 1022-1029) as the tool carried them - each its Ogg of the bundle's
 *  own Vorbis packets (Sounds/sounds.json). */
export const soundUrl = (/** @type {string} */ name) => new URL(`../../vendor/come-sail-away/Sounds/${name}.ogg`, import.meta.url).href;

/**
 * The five files, fetched. NEVER TRAPS: a file that will not load is the
 * mod's boats missing, never the scene - the answer is null and it says
 * so once. GALLEON: and the new galleon's model at `galleonUrl` (null for
 * none) - missing, hull 2 is the mod's own galleon, said once. AUDIT
 * GN2-PF4: fetched beside the five (it was asked for once all five had
 * come - a whole fetch later). SHIPS-2: and the new carrack's and the new
 * large boat's at `shipUrls` (each null for none), fetched beside them too,
 * each one's answer its own - missing or broken, its hull is the mod's
 * own, said once, and every other ship stands as it would.
 * @returns {Promise<ReturnType<typeof comeSailAwayModels> | null>}
 */
export async function loadComeSailAwayModels(fetchFn = globalThis.fetch, urls = CSA_MODEL_URLS, log = console, galleonUrl = GALLEON_MODEL_URL,
  shipUrls = { carrack: CARRACK_MODEL_URL, largeBoat: LARGE_BOAT_MODEL_URL }) {
  if (!fetchFn) return null;
  try {
    const get = async (/** @type {string} */ url, /** @type {boolean} */ binary) => {
      const r = await fetchFn(url);
      if (!r || !r.ok) throw new Error(`${url}: ${r?.status ?? 'no answer'}`);
      return binary ? new Uint8Array(await r.arrayBuffer()) : r.json();
    };
    // GALLEON: her answer is her own - her model failing never fails the five, and is said only once they stand
    // (SHIPS-2: each port ship's the same)
    const own = (url) => (url ? get(url, false).then((json) => ({ ok: true, json, error: null }), (error) => ({ ok: false, json: null, error })) : null);
    const shipAt = { galleon: galleonUrl, carrack: shipUrls?.carrack ?? null, largeBoat: shipUrls?.largeBoat ?? null };
    const [prefabs, meshes, bin, materials, animation, ...answers] = await Promise.all([
      get(urls.prefabs, false), get(urls.meshes, false), get(urls.bin, true), get(urls.materials, false), get(urls.animation, false),
      ...PORT_SHIPS.map((ship) => own(shipAt[ship.key])),
    ]);
    // GALLEON: the new galleon over hull 2 - and, its model not answering, the mod's own galleon, said once (a ship
    // missing her new timbers still sails as the old one; never no ship). SHIPS-2: each port ship so, built here first
    // (once a process - its cache) so one that will not build drops alone
    const ships = {};
    let base = prefabs.components.length;
    PORT_SHIPS.forEach((ship, k) => {
      const answer = answers[k];
      if (!answer) return;
      const standsAs = `hull ${ship.hull} stands as the mod's own ${MOD_TITLES[ship.key]}`;
      if (!answer.ok) { log?.warn?.(`[come-sail-away] the new ${ship.title} did not load - ${standsAs}`, answer.error); return; }
      try { base += shipBuilt(ship, answer.json, prefabs, base).components.length; ships[ship.key] = answer.json; } catch (e) {
        log?.warn?.(`[come-sail-away] the new ${ship.title} would not build - ${standsAs}`, e);
      }
    });
    return comeSailAwayModels({ prefabs, meshes, bin, materials, animation, ...ships });
  } catch (e) {
    log?.warn?.('[come-sail-away] the boats\' models did not load - no boat can stand', e);
    return null;
  }
}

/**
 * The files as the port reads them. `geometry(key)` decodes a mesh once.
 *
 * GALLEON (2026-10-01): with `galleon` (src/assets/galleon/galleon.json) the new galleon STANDS IN FOR HULL 2 - prefab
 * 112412 is her tree (world/galleonModel.js galleonPrefab), her components join the shared table after the mod's, her
 * meshes answer `geometry` (decoded already - she is built, not extracted) and `meshes` their boxes, and her clips and
 * overrides join the mod's animation. Without it every file reads as the mod shipped it (the mod's own pins read that).
 * SHIPS-2 (2026-10-07): with `carrack` the new carrack stands in for hull 4 (prefab 112414) and with `largeBoat` the new
 * large boat for hull 1 (112411), each so - their components after the galleon's, each built on the place in the table
 * its components take (PORT_SHIPS' order), their meshes marked with the ship they are (`port`; the galleon's `galleon`
 * too, as they were).
 * @param {{ prefabs: { prefabs: Record<string, any>, components: any[] }, meshes: Record<string, any>, bin: Uint8Array, materials: Record<string, any>, animation: any, galleon?: any, carrack?: any, largeBoat?: any }} files
 */
export function comeSailAwayModels({ prefabs, meshes, bin, materials, animation, galleon = null, carrack = null, largeBoat = null }) {
  const decoded = new Map();
  let prefabTable = prefabs.prefabs, components = prefabs.components, meshTable = meshes, anim = animation;
  const bakes = { galleon, carrack, largeBoat };
  const standing = PORT_SHIPS.filter((ship) => bakes[ship.key]);
  if (standing.length) {
    prefabTable = { ...prefabs.prefabs };
    const added = [];
    meshTable = { ...meshes };
    anim = { ...animation, overrides: { ...animation.overrides }, clips: { ...animation.clips } };
    let base = prefabs.components.length;
    for (const ship of standing) {
      const g = shipBuilt(ship, bakes[ship.key], prefabs, base);
      prefabTable[String(ship.id)] = g.prefab;
      added.push(...g.components);
      base += g.components.length;
      for (const [key, geo] of Object.entries(g.meshes)) {
        meshTable[key] = ship.key === 'galleon' ? { vertexCount: geo.vertexCount, aabb: geo.aabb, galleon: true, port: ship.key } : { vertexCount: geo.vertexCount, aabb: geo.aabb, port: ship.key };
        decoded.set(key, geo);
      }
      Object.assign(anim.overrides, g.animation.overrides);
      Object.assign(anim.clips, g.animation.clips);
    }
    components = [...prefabs.components, ...added];
  }
  return {
    prefabs: prefabTable,
    components,
    meshes: meshTable,
    materials,
    animation: anim,
    /** GALLEON: whether hull 2 is the new galleon (the art's registration, a probe's reading). */
    galleon: !!galleon,
    /** SHIPS-2: whether hull 4 is the new carrack, and hull 1 the new large boat. */
    carrack: !!carrack,
    largeBoat: !!largeBoat,
    /** The prefab tree DFU's MeshReplacement answers `id` with, or null (TryImportGameObject's false). */
    prefab: (/** @type {number} */ id) => prefabTable[String(id)] ?? null,
    /** A mesh decoded to the port's shape, once; null for a key the files do not carry. */
    geometry(/** @type {string} */ key) {
      if (decoded.has(key)) return decoded.get(key);
      const entry = meshes[key];
      const g = entry ? decodeMeshGeometry(entry, bin) : null;
      decoded.set(key, g);
      return g;
    },
  };
}

/** AUDIT GN2-PF4: HER PREFAB, BUILT ONCE A PROCESS. galleonPrefab is a long task (150-340 ms, bakedPartGeometry 126 of
 *  it) and every world scene's pool loads the models anew, so it is built once and held: keyed by her bake's sha256 (her
 *  source's hash), served again only for the same bake to the byte over the same mod table - a bake edited under the same
 *  hash builds anew (the loader's broken-model pin). What it holds is read, never written: a boat instances her tree and
 *  components by copy (world/prefabNode.js instantiatePrefab), and her meshes are drawn, baked and stood on, never changed
 *  (test/auditgalleon2_prefab.test.js PF4). SHIPS-2: every port ship's so, each its own entry - keyed too by the place in
 *  the table its components take (`base`: the galleon's before them) and every mod prefab its builder reads. */
const _built = new Map();   // ship key -> { sha256, bake, base, old, built }
function shipBuilt(ship, json, prefabs, base) {
  const bake = JSON.stringify(json), old = JSON.stringify(ship.reads.map((id) => prefabs.prefabs[String(id)] ?? null));
  const was = _built.get(ship.key);
  if (was && was.sha256 === json.sha256 && was.bake === bake && was.base === base && was.old === old) return was.built;
  if (ship.key === 'galleon' && base !== prefabs.components.length) throw new Error('come-sail-away: the galleon\'s components come first');
  const built = ship.build(json, prefabs, base);
  _built.set(ship.key, { sha256: json.sha256, bake, base, old, built });
  return built;
}

/**
 * Unity's Matrix4x4 as serialized (e00 e01 e02 e03 e10 ... e33, row by row)
 * as the port's column-major array.
 * @param {number[]} m
 */
export function matrixFromUnityRows(m) {
  const out = new Float32Array(16);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) out[c * 4 + r] = m[r * 4 + c];
  return out;
}

/**
 * One mesh out of meshes.bin.
 * @param {any} entry - meshes.json's record
 * @param {Uint8Array} bin
 */
export function decodeMeshGeometry(entry, bin) {
  const n = entry.vertexCount;
  const at = (/** @type {any} */ a, count) => new Float32Array(bin.buffer.slice(bin.byteOffset + a.offset, bin.byteOffset + a.offset + count * 4));
  const positions = at(entry.attributes.position, n * 3);
  const nd = entry.attributes.normal?.dim ?? 3;
  const rawNormals = entry.attributes.normal ? at(entry.attributes.normal, n * nd) : null;
  let normals = rawNormals;
  if (rawNormals && nd !== 3) {
    normals = new Float32Array(n * 3);
    for (let v = 0; v < n; v++) for (let d = 0; d < 3; d++) normals[v * 3 + d] = rawNormals[v * nd + d];
  }
  if (!normals) normals = new Float32Array(n * 3);
  const uvs = entry.attributes.uv0 ? at(entry.attributes.uv0, n * 2) : new Float32Array(n * 2);
  const ix = entry.indices;
  const raw = ix.type === 'u32'
    ? new Uint32Array(bin.buffer.slice(bin.byteOffset + ix.offset, bin.byteOffset + ix.offset + ix.count * 4))
    : new Uint16Array(bin.buffer.slice(bin.byteOffset + ix.offset, bin.byteOffset + ix.offset + ix.count * 2));
  const indices = new Uint32Array(ix.count);
  const subMeshes = [];
  for (const s of entry.submeshes) {
    for (let i = s.start; i < s.start + s.count; i++) indices[i] = raw[i] + s.baseVertex;
    subMeshes.push({ startIndex: s.start, primitiveCount: s.count / 3 });
  }
  const bi = entry.attributes.blendIndices;
  const blendIndices = bi ? new Uint16Array(bin.buffer.slice(bin.byteOffset + bi.offset, bin.byteOffset + bi.offset + n * 2)) : null;
  return {
    vertexCount: n,
    positions, normals, uvs, indices, subMeshes,
    blendIndices,
    bindPoses: entry.bindPoses ? entry.bindPoses.map(matrixFromUnityRows) : null,
    aabb: entry.aabb,
  };
}

/** The renderer's slots as the bundle left them: `{ bundle: name }`, or null for an empty slot. */
export function bundleSlots(renderer) {
  return (renderer.m_Materials ?? []).map((m) => (m && m.material ? { bundle: m.material } : null));
}
/** A Daggerfall material - MaterialReader.GetMaterial(archive, record) (alphaIndex -1, opaque). */
export const dfMaterial = (archive, record) => ({ archive, record });
export const isDfMaterial = (slot) => !!slot && Number.isInteger(slot.archive) && Number.isInteger(slot.record);

/**
 * RuntimeMaterials.ApplyMaterials on one node: every RuntimeMaterials the
 * node carries, in its order, each entry into its slot. The C# writes into a
 * copy of the renderer's materials and assigns the copy after its loop, so
 * an entry whose slot is out of range (its IndexOutOfRange lands in its own
 * catch) leaves that component's writes unassigned, every one; its finally
 * marks it applied, and the next still runs (CSA-J's audit: the port had kept
 * the writes before the bad entry).
 * @param {{ components: any[] }} node
 * @returns {number} how many slots were written
 */
export function applyRuntimeMaterials(node) {
  const renderer = node.components.find((c) => c.type === 'MeshRenderer');
  if (!renderer) return 0;
  renderer.materials ??= bundleSlots(renderer);
  let written = 0;
  for (const c of node.components) {
    if (c.type !== 'MonoBehaviour' || c.m_Script?.script !== 'RuntimeMaterials') continue;
    if (!c.Materials?.length || c.hasAppliedMaterials) continue;
    const materials = [...renderer.materials];   // meshRenderer.sharedMaterials: a copy
    let n = 0;
    let inRange = true;
    for (const m of c.Materials) {
      if (!(m.Index >= 0 && m.Index < materials.length)) { inRange = false; break; }
      materials[m.Index] = dfMaterial(m.Archive, m.Record);
      n++;
    }
    if (inRange) { renderer.materials = materials; written += n; }   // meshRenderer.sharedMaterials = materials, past the loop
    c.hasAppliedMaterials = 1;   // finally
  }
  return written;
}

/**
 * ApplyGameTextures' reading of a child's name - `AAA_RRR`: the archive
 * before the first '_', the record after it, each Convert.ToInt32 (a
 * leading or trailing space is allowed, anything else throws, and the
 * port answers null where the C# would).
 * @param {string} name
 */
export function gameTextureFromName(name) {
  const i = name.indexOf('_');
  if (i < 0) return null;
  const toInt = (/** @type {string} */ s) => (/^\s*[+-]?\d+\s*$/.test(s) ? Number.parseInt(s.trim(), 10) : null);
  const archive = toInt(name.substring(0, i)), record = toInt(name.substring(i + 1));
  return archive == null || record == null ? null : dfMaterial(archive, record);
}

/**
 * The model createMesh draws for one renderer: the mesh's geometry with each
 * slot's texture on the submesh Unity draws it on. A slot the port does not
 * draw (no Daggerfall material) leaves its submesh out; an empty result is
 * null.
 * @param {ReturnType<typeof decodeMeshGeometry>} g
 * @param {any[]} slots
 */
export function rendererModel(g, slots) {
  if (!g || !slots?.length || !g.subMeshes.length) return null;
  const subMeshes = [];
  for (let k = 0; k < slots.length; k++) {
    const s = slots[k];
    if (!isDfMaterial(s)) continue;
    const sm = g.subMeshes[Math.min(k, g.subMeshes.length - 1)];
    if (!sm.primitiveCount) continue;
    subMeshes.push({ textureArchive: s.archive, textureRecord: s.record, startIndex: sm.startIndex, primitiveCount: sm.primitiveCount });
  }
  if (!subMeshes.length) return null;
  return { positions: g.positions, normals: g.normals, uvs: g.uvs, indices: g.indices, subMeshes, doors: [] };
}

/** A cache key for one renderer's drawn model: the mesh and its slots' textures. */
export function rendererModelKey(meshKey, slots) {
  return `csa:${meshKey}|${(slots ?? []).map((s) => (isDfMaterial(s) ? `${s.archive}_${s.record}` : '-')).join(',')}`;
}
