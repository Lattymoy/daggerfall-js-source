// @ts-check
// ═══════════════════════════════════════════════════════════════════
// BANTHA1 (2026-10-18, the owner: "Bantha, north of daggerfall is going to be the first region in the continent to
// recieve a biome expansion. Using the attached file, populate the area in a dense jungle like format ... This needs to
// be insanely detailed and not hurt performance. No band aids") - THE JUNGLE'S TREES, READ. bible/03-World/
// Bantha-Jungle.md is the design and the record.
//
// The owner's five trees (src/assets/jungle/source/, their Blender 5.2 exports as they handed them over: an OBJ, its MTL and
// one 252x164 picture each, cut out by its alpha) read into the shape Low Poly Trees' pipeline already draws
// (world/lowPolyTrees.js readLowPolyTrees's answer): every mesh in one vertex run of f32 x 8 a vertex - position,
// normal, uv - and one run of u16 indices, a prototype a tree with its one material, and its standing size. So the
// near 3D tree, its far picture (impostorSteps), its instanced draw and its handover are LPT1's own code, never a copy
// (THE ONE CONSTRUCTION SEAM): systems/jungleTreesAssets.js hands this to the same door with the pictures decoded
// instead of painted.
//
// THIS MODULE IS PURE (no GL, no fetch, no DOM): the node tests read the very files the game reads.
//
// THE FRAME. An OBJ is right-handed (Blender's export: y up, -z forward); the port's meshes are Unity's, left-handed
// (render/renderer.js draws them under frontFace CW). A tree is mirrored in x on the way in, as Unity's own OBJ importer
// mirrors it, so the tree stands as the owner drew it and its picture never reads backwards; its faces are drawn on
// both sides (each tree is crossed cards and a shell, cut by the picture's alpha - its own back is its own front).
// Each tree stood somewhere in the owner's Blender scene (one 34 m off the origin): it is moved so its ROOT - the middle
// of what it stands on, its lowest 2.5 m - is the origin, its ground (y 0, their ground plane) kept: the roots they sank
// below it stay sunk.
// ═══════════════════════════════════════════════════════════════════

/** The archive a jungle tree is a flat of: the rainforest's nature archive (ClimateSwaps Nature_RainForest) - its
 *  Trees are what Logging fells, its cover what grows under them. */
export const JUNGLE_ARCHIVE = 500;

/**
 * THE FIVE TREES, in the order the layout numbers them (world/terrain/jungleNature.js `species`). `file` the OBJ's name
 * under src/assets/jungle/source/; `record` the rainforest Tree record (TREE_RECORDS[500]) the tree is a flat of - what
 * Logging, cover and the wind read it as; `key` its name in the code. The names are what the owner's pictures show.
 */
export const JUNGLE_SPECIES = Object.freeze([
  Object.freeze({ key: 'banyan', file: 'jungle_tree', record: 12 }),     // aerial roots hung from a wide dome
  Object.freeze({ key: 'kapok', file: 'jungle_tree2', record: 13 }),     // a buttressed column under layered parasols
  Object.freeze({ key: 'fig', file: 'jungle_tree3', record: 14 }),       // a strangler's braided trunk, a round crown, vines
  Object.freeze({ key: 'flame', file: 'jungle_tree4', record: 15 }),     // the lowest: palmate leaves, red blooms, moss curtains
  Object.freeze({ key: 'mahogany', file: 'jungle_tree5', record: 16 }),  // a twisted trunk under a dense, tall crown
]);

/** The URL-safe paths of a species' files, relative to src/assets/jungle/source/. */
export const jungleFiles = (s) => ({ obj: `${s.file}.obj`, mtl: `${s.file}.mtl` });

/** The record a jungle tree's far picture goes up under (systems/lowPolyTreesAssets.js: `${record}#lpt${source}`). */
export const jungleRecord = (s) => `jungle-${s.key}`;

/** How high above the lowest vertex the root is read (m): the middle of what the tree stands on. */
export const JUNGLE_ROOT_BAND = 2.5;

/**
 * AN OBJ, READ: its positions, uvs and normals as written (1-based references made 0-based, a negative one counted
 * back from the end), its faces as corner lists `[v, vt, vn]` (-1 where a corner names none), and the material each
 * face was drawn with (`usemtl`). Polygons are kept whole; the mesh triangulates them.
 * @param {string} text
 */
export function parseObj(text) {
  const positions = [], uvs = [], normals = [], faces = [];
  let material = null, mtllib = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();   // AUDIT BANTHA1 TREE-7: a comment ends any line - a face's too
    if (!line) continue;
    const p = line.split(/\s+/);
    switch (p[0]) {
      case 'v': positions.push(+p[1], +p[2], +p[3]); break;
      case 'vt': uvs.push(+p[1], +(p[2] ?? 0)); break;
      case 'vn': normals.push(+p[1], +p[2], +p[3]); break;
      case 'usemtl': material = p[1] ?? null; break;
      case 'mtllib': mtllib = p[1] ?? null; break;
      case 'f': {
        const at = (s, count) => {
          if (s == null || s === '') return -1;
          const n = Number.parseInt(s, 10);
          return n < 0 ? count + n : n - 1;
        };
        const corners = p.slice(1).map((c) => {
          const [v, vt, vn] = c.split('/');
          return [at(v, positions.length / 3), at(vt, uvs.length / 2), at(vn, normals.length / 3)];
        });
        if (corners.length >= 3) faces.push({ corners, material });
        break;
      }
      default: break;
    }
  }
  return { positions, uvs, normals, faces, mtllib };
}

/**
 * AN MTL, READ: each material's diffuse picture (`map_Kd`) and alpha picture (`map_d`), by name.
 * @param {string} text
 * @returns {Map<string, { mapKd: string|null, mapD: string|null }>}
 */
/** A map statement's file: what follows its options (`-o 0 0 0`, `-clamp on`, `-bm 1` ...), spaces and all (AUDIT
 *  BANTHA1 TREE-7: the last word alone cut "bark tree.png" to "tree.png"). */
function mapName(words) {
  let i = 0;
  while (i < words.length && words[i][0] === '-') { i++; while (i < words.length && /^(?:-?[\d.]+|on|off)$/.test(words[i])) i++; }
  return i < words.length ? words.slice(i).join(' ') : null;
}
export function parseMtl(text) {
  const out = new Map();
  let cur = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line[0] === '#') continue;
    const [k, ...rest] = line.split(/\s+/);
    if (k === 'newmtl') { cur = { mapKd: null, mapD: null }; out.set(rest.join(' '), cur); } else if (cur && k === 'map_Kd') cur.mapKd = mapName(rest);
    else if (cur && k === 'map_d') cur.mapD = mapName(rest);
  }
  return out;
}

/**
 * A TREE'S MESH in the port's frame: the OBJ's polygons fanned into triangles, each distinct (position, uv, normal)
 * corner one vertex - `vertices` f32 x 8 ([x, y, z, nx, ny, nz, u, v]), `indices` u16 - mirrored in x and moved so its
 * root is the origin (the file's head). `root` where the root stood in the owner's scene, `min`/`max` the mesh's box.
 * A corner with no normal takes its face's.
 * @param {ReturnType<typeof parseObj>} obj
 */
export function jungleMesh(obj) {
  const materials = new Set(obj.faces.map((f) => f.material));
  if (materials.size > 1) throw new Error(`jungle: a tree is one picture - this one names ${materials.size} materials`);   // AUDIT BANTHA1 TREE-7: never its first face's picture on all of them
  const P = obj.positions;
  let minY = Infinity;
  for (let i = 1; i < P.length; i += 3) minY = Math.min(minY, P[i]);
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < P.length; i += 3) {
    if (P[i + 1] > minY + JUNGLE_ROOT_BAND) continue;
    x0 = Math.min(x0, P[i]); x1 = Math.max(x1, P[i]); z0 = Math.min(z0, P[i + 2]); z1 = Math.max(z1, P[i + 2]);
  }
  const rx = (x0 + x1) / 2, rz = (z0 + z1) / 2;
  const verts = [], idx = [], seen = new Map();
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const vertexOf = (c, fn) => {
    const key = `${c[0]}/${c[1]}/${c[2]}`;
    let i = seen.get(key);
    if (i != null) return i;
    i = verts.length / 8;
    seen.set(key, i);
    const x = -(P[c[0] * 3] - rx), y = P[c[0] * 3 + 1], z = P[c[0] * 3 + 2] - rz;
    const n = c[2] >= 0 ? [-obj.normals[c[2] * 3], obj.normals[c[2] * 3 + 1], obj.normals[c[2] * 3 + 2]] : fn;
    const u = c[1] >= 0 ? obj.uvs[c[1] * 2] : 0, v = c[1] >= 0 ? obj.uvs[c[1] * 2 + 1] : 0;
    verts.push(x, y, z, n[0], n[1], n[2], u, v);
    if (x < min[0]) min[0] = x; if (y < min[1]) min[1] = y; if (z < min[2]) min[2] = z;
    if (x > max[0]) max[0] = x; if (y > max[1]) max[1] = y; if (z > max[2]) max[2] = z;
    return i;
  };
  for (const f of obj.faces) {
    // the face's own normal, in the port's frame (mirrored x), for a corner the file gives none
    const a = f.corners[0][0] * 3, b = f.corners[1][0] * 3, c = f.corners[2][0] * 3;
    const e1 = [-(P[b] - P[a]), P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]], e2 = [-(P[c] - P[a]), P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]];
    const fn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const fl = Math.hypot(fn[0], fn[1], fn[2]) || 1;
    fn[0] /= fl; fn[1] /= fl; fn[2] /= fl;
    const ids = f.corners.map((k) => vertexOf(k, fn));
    // mirrored, a polygon's turn reverses: fanned the other way round so a face's front stays the face the file meant -
    // and WOUND AS ITS NORMALS SAY: a polygon whose corners' normals (the light's word) point against its turn is fanned
    // the other way again (the owner's kapok, jungle_tree2, is 99 of its 103 triangles so: its normals and its faces
    // were turned apart in the export). A tree's faces are drawn on both sides, so only its light and the two words'
    // agreement ride on this
    let nx = 0, ny = 0, nz = 0;
    for (const id of ids) { nx += verts[id * 8 + 3]; ny += verts[id * 8 + 4]; nz += verts[id * 8 + 5]; }
    const turned = -(fn[0] * nx + fn[1] * ny + fn[2] * nz) < 0;   // fn is the file's turn mirrored; the fan below reverses it
    for (let k = 1; k + 1 < ids.length; k++) {
      if (turned) idx.push(ids[0], ids[k], ids[k + 1]); else idx.push(ids[0], ids[k + 1], ids[k]);
    }
  }
  if (verts.length / 8 > 65535) throw new Error('jungle: a tree over 65535 vertices cannot ride the u16 index run');
  return { vertices: Float32Array.from(verts), indices: Uint16Array.from(idx), root: [rx, rz], min, max, material: obj.faces[0]?.material ?? null };
}

/**
 * A TREE AS IT STANDS, MEASURED off what it draws - its picture's opaque texels carried onto its faces in 3D, not its
 * cards' corners (a card reaches far past the leaves cut into it). Each triangle is sampled on a grid of `step` (m) in
 * its own plane; each sample whose texel is drawn (alpha at least half) lands at its height and its distance from the
 * root. Answers, in metres at the tree's own size:
 *   - `foot`: how far its drawn parts reach from the root below FOOT_TOP - its roots and buttresses (what a road must
 *     keep clear of, never its crown overhead);
 *   - `crown`: how far its drawn parts reach at all - its crown;
 *   - `crownFrom`: the lowest height its drawn width reaches half its crown's - where its crown begins;
 *   - `trunk`: the trunk's girth - a low quantile of the drawn radii between FOOT_TOP and the crown, so the hanging vines
 *     and aerial roots about it count for little.
 * @param {{vertices: Float32Array, indices: Uint16Array}} mesh jungleMesh's
 * @param {{width: number, height: number, data: Uint8Array}} pic the picture, top-down RGBA
 * @param {number} [step] the sample spacing (m)
 */
export function measureTree(mesh, pic, step = 0.1) {
  const V = mesh.vertices, I = mesh.indices;
  const samples = [];
  for (let t = 0; t + 2 < I.length; t += 3) {
    const a = I[t] * 8, b = I[t + 1] * 8, c = I[t + 2] * 8;
    const l1 = Math.hypot(V[b] - V[a], V[b + 1] - V[a + 1], V[b + 2] - V[a + 2]);
    const l2 = Math.hypot(V[c] - V[a], V[c + 1] - V[a + 1], V[c + 2] - V[a + 2]);
    const n1 = Math.max(1, Math.ceil(l1 / step)), n2 = Math.max(1, Math.ceil(l2 / step));
    for (let i = 0; i <= n1; i++) {
      for (let j = 0; j <= n2; j++) {
        const s = i / n1, r = j / n2;
        if (s + r > 1) continue;
        const w0 = 1 - s - r;
        const u = w0 * V[a + 6] + s * V[b + 6] + r * V[c + 6], v = w0 * V[a + 7] + s * V[b + 7] + r * V[c + 7];
        const tx = Math.min(pic.width - 1, Math.max(0, Math.floor((u - Math.floor(u)) * pic.width)));
        const ty = Math.min(pic.height - 1, Math.max(0, Math.floor((1 - (v - Math.floor(v))) * pic.height)));   // uv's v=0 is the picture's bottom
        if (pic.data[(ty * pic.width + tx) * 4 + 3] < 128) continue;
        const x = w0 * V[a] + s * V[b] + r * V[c], y = w0 * V[a + 1] + s * V[b + 1] + r * V[c + 1], z = w0 * V[a + 2] + s * V[b + 2] + r * V[c + 2];
        samples.push(y, Math.hypot(x, z));
      }
    }
  }
  let crown = 0, foot = 0, top = 0;
  for (let i = 0; i < samples.length; i += 2) {
    crown = Math.max(crown, samples[i + 1]);
    top = Math.max(top, samples[i]);
    if (samples[i] < FOOT_TOP) foot = Math.max(foot, samples[i + 1]);
  }
  // the drawn width by half-metre band, from the ground up: the crown begins at the first band past FOOT_TOP that
  // reaches half the crown's reach
  const bands = new Float32Array(Math.ceil(top / 0.5) + 1);
  for (let i = 0; i < samples.length; i += 2) {
    const k = Math.max(0, Math.floor(samples[i] / 0.5));
    if (k < bands.length) bands[k] = Math.max(bands[k], samples[i + 1]);
  }
  let crownFrom = top;
  for (let k = Math.ceil(FOOT_TOP / 0.5); k < bands.length; k++) if (bands[k] >= crown * 0.5) { crownFrom = k * 0.5; break; }
  // the trunk: what is drawn between the foot and the crown - or, where the crown begins at the foot's top (a banyan's
  // roots, a flame tree's curtains hang from it), the TRUNK_BAND above the foot (AUDIT BANTHA1 TREE-5: an empty window
  // read a default, half the banyan's drawn girth)
  const trunkTo = crownFrom > FOOT_TOP ? crownFrom : FOOT_TOP + TRUNK_BAND;
  const trunkRadii = [];
  for (let i = 0; i < samples.length; i += 2) if (samples[i] >= FOOT_TOP && samples[i] < trunkTo) trunkRadii.push(samples[i + 1]);
  trunkRadii.sort((p, q) => p - q);
  const trunk = trunkRadii.length ? trunkRadii[Math.floor(trunkRadii.length * TRUNK_QUANTILE)] : 0.5;
  return { foot, crown, crownFrom, trunk: Math.min(TRUNK_MAX, Math.max(TRUNK_MIN, trunk)), height: top };
}
/** The height (m) below which a tree's drawn parts are its foot. */
export const FOOT_TOP = 3;
/** Where a crown begins at the foot's top, the band (m) above it the trunk is read in. */
export const TRUNK_BAND = 3;
/** The quantile of the drawn radii under the crown read as the trunk's girth, and its bounds (m). */
export const TRUNK_QUANTILE = 0.3;
export const TRUNK_MIN = 0.35;
export const TRUNK_MAX = 1.6;

/**
 * EACH TREE AS IT STANDS, MEASURED (measureTree at its own 0.1 m, off the owner's files - test/world/
 * bantha1_jungle.test.js measures them again and holds this table to them): JUNGLE_SPECIES's order, metres at the
 * owner's size - a tree's foot (what a road keeps clear of: pixelBuild's verge), its crown, where its crown begins and its
 * trunk's girth (its cover - ai/cover.js), and its height. A constant of the files, so the stream reads it with no
 * picture decoded: a jungle tree is stood, and taken as cover, before its door has loaded.
 */
export const JUNGLE_MEASURES = Object.freeze([
  Object.freeze({ foot: 8.3, crown: 8.73, crownFrom: 3, trunk: 1.44, height: 22.54 }),   // banyan - its aerial roots reach the ground at its crown's rim
  Object.freeze({ foot: 8.53, crown: 9.63, crownFrom: 9, trunk: 0.99, height: 21.41 }),   // kapok - its buttresses
  Object.freeze({ foot: 7.58, crown: 9.42, crownFrom: 8, trunk: 1.1, height: 22.53 }),   // fig
  Object.freeze({ foot: 5.6, crown: 7.8, crownFrom: 3, trunk: 0.43, height: 16.23 }),   // flame - its moss curtains hang to the ground
  Object.freeze({ foot: 6.37, crown: 9.48, crownFrom: 8, trunk: 1.33, height: 22.54 }),   // mahogany
]);

/**
 * A JUNGLE TREE AS COVER (TACT1, ai/cover.js coverProxies' shape - AUDIT TACT B2's trunk and crown): its trunk's girth
 * up to where its crown begins, its crown's reach from there to its top - each at the tree's own scale. A jungle trunk is
 * a metre or two thick, and a body behind it is hidden; its crown is a crown, at TACT1's own share of it
 * (JUNGLE_CROWN_COVER - AUDIT BANTHA1 LAY-6: the crown's whole reach was 1.43x the rule every other tree keeps).
 * @param {number[]} base the flat's base, by reference (FELLED keys on it) @param {number} species @param {number} scale
 */
export function jungleCover(base, species, scale) {
  const m = JUNGLE_MEASURES[species];
  return [
    { c: base, r: m.trunk * scale, h: m.crownFrom * scale, lift: 0 },
    { c: base, r: m.crown * JUNGLE_CROWN_COVER * scale, h: (m.height - m.crownFrom) * scale, lift: m.crownFrom * scale },
  ];
}
/** A crown's cover radius as a share of its reach - ai/cover.js COVER_RADIUS_FRAC of its whole width (0.35 x 2): a
 *  crown's edges are mostly air, as a flat's are (held equal by test/world/bantha1_jungle.test.js; ai/cover.js is not
 *  imported here - this module is the terrain worker's too). */
export const JUNGLE_CROWN_COVER = 0.7;

/**
 * THE JUNGLE IN LOW POLY TREES' SHAPE - what readLowPolyTrees answers for the mod, made from the five trees: `json`
 * (`vertexBytes`, `meshes` [{ vertex, vertices, index, subs: [[0, n]], min, max }], `materials`), `treesBin` (every
 * vertex, then every index), `atlases` (one a picture, cut by its alpha), and `protos` - each tree a prototype of
 * archive JUNGLE_ARCHIVE keyed `500_${jungleRecord(s)}` (so the door's `proto(archive, record)` finds it), drawn on
 * both faces, cut at a half (the picture's alpha is 0 or 255), at its own size (scale 1). `size` is LPT1's: w its
 * whole reach about the root across, h its height above the ground.
 * @param {{ obj: string, mtl: string }[]} sources each species' OBJ and MTL text, JUNGLE_SPECIES's order
 */
export function readJungleTrees(sources) {
  if (sources.length !== JUNGLE_SPECIES.length) throw new Error(`jungle: ${JUNGLE_SPECIES.length} trees expected, ${sources.length} handed`);
  const meshes = sources.map((s) => jungleMesh(parseObj(s.obj)));
  let vCount = 0, iCount = 0;
  for (const m of meshes) { vCount += m.vertices.length / 8; iCount += m.indices.length; }
  const vertexBytes = vCount * 32;
  const treesBin = new Uint8Array(vertexBytes + iCount * 2);
  const vf = new Float32Array(treesBin.buffer, 0, vCount * 8);
  const iv = new Uint16Array(treesBin.buffer, vertexBytes, iCount);
  const json = { version: 1, vertexBytes, meshes: [], materials: {}, atlases: {}, prefabs: {} };
  const atlases = {}, protos = new Map(), pictures = [];
  let vAt = 0, iAt = 0;
  meshes.forEach((m, k) => {
    const s = JUNGLE_SPECIES[k];
    vf.set(m.vertices, vAt * 8);
    iv.set(m.indices, iAt);
    json.meshes.push({ name: s.file, vertex: vAt, vertices: m.vertices.length / 8, index: iAt, subs: [[0, m.indices.length]], min: m.min, max: m.max });
    vAt += m.vertices.length / 8; iAt += m.indices.length;
    const mtl = parseMtl(sources[k].mtl);
    const mat = mtl.get(m.material ?? '') ?? [...mtl.values()][0];
    if (!mat?.mapKd) throw new Error(`jungle: ${s.file}.mtl names no picture`);
    pictures.push(mat.mapKd);
    atlases[s.key] = { alpha: true, picture: mat.mapKd };
    json.materials[s.key] = { tex: s.key, cutoff: 0.5, cull: 0 };
    const record = jungleRecord(s), key = `${JUNGLE_ARCHIVE}_${record}`;
    json.prefabs[key] = { mesh: k, scale: [1, 1, 1], materials: [s.key] };
    const reach = Math.max(Math.abs(m.min[0]), Math.abs(m.max[0]), Math.abs(m.min[2]), Math.abs(m.max[2]));
    protos.set(key, {
      key, archive: JUNGLE_ARCHIVE, record, species: k, mesh: k, scale: [1, 1, 1],
      subs: [{ atlas: s.key, opaque: false, cutoff: 0.5, cull: 0, color: [1, 1, 1] }],
      size: { w: reach * 2, h: Math.max(0.5, m.max[1]) },
    });
  });
  json.atlases = atlases;
  return { json, treesBin, atlasesBin: null, atlases, protos, meshes: json.meshes, pictures, models: meshes };
}
