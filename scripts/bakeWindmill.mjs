// Bake vendor/windmills-kamer/*.dae (Kamer's rotor geometry, vendored
// WITH THE AUTHOR'S PERMISSION - see the vendor README) into
// src/world/windmillMesh.js, in the port's own model shape. Run:
//   node scripts/bakeWindmill.mjs
// test/windmillmesh.test.js pins baked === vendored, so a drifted bake
// fails rather than shipping geometry nobody re-derived.
//
// WHY A BAKE AND NOT A LOADER: a COLLADA parser at runtime would be a
// second mesh path in a port that already has one, for two small static
// meshes that never change. Baked, the rotor arrives in exactly the
// shape src/world/meshReader.js produces - positions/normals/uvs/
// indices/subMeshes - so every consumer treats it as one more model.
//
// NO TRANSFORM IS APPLIED, and that is a measured claim, not a hope:
// Blender writes up_axis Z_UP and bakes the object transform into the
// node matrix, and that matrix (x,y,z -> x,-z,y) composed with the
// standard Z-up-to-Y-up conversion is the identity. The bake ASSERTS
// the node matrix is the one it expects, so a re-export with a
// different object rotation fails here instead of turning the sails
// into a ceiling fan somewhere downstream.
//
// TEXTURES ARE THE PLAYER'S, NOT OURS. Each material names a classic
// Daggerfall texture (TEXTURE.000 record 77, TEXTURE.067 record 1);
// the bake records the (archive, record) pair and nothing else, and the
// port loads those from the player's ARENA2 like any other model.

import { readFileSync, writeFileSync } from 'node:fs';

/** The Z_UP node matrix a Blender export writes for these parts. Its
 *  composition with the Z-up-to-Y-up conversion is the identity, which
 *  is the whole reason this bake applies no transform. */
const EXPECTED_NODE_MATRIX = [1, 0, 0, 0, 0, -0, -1, 0, 0, 1, -0, 0, 0, 0, 0, 1];

const floats = (s) => s.trim().split(/\s+/).map(Number);
const ints = (s) => s.trim().split(/\s+/).map((v) => parseInt(v, 10));

/**
 * Parse one COLLADA file into the port's model shape.
 *
 * Deliberately a narrow reader, not a COLLADA implementation: it
 * accepts exactly the shape these two files have (one geometry, one
 * node, triangle primitives with VERTEX/NORMAL/TEXCOORD inputs) and
 * THROWS on anything else. A permissive parser that silently ignored an
 * input it did not understand would bake a mesh missing its normals and
 * nothing would say so.
 */
export function parseCollada(text, materialTextures = null) {
  const geoms = [...text.matchAll(/<geometry id="([^"]+)"[^>]*>([\s\S]*?)<\/geometry>/g)];
  if (geoms.length !== 1) throw new Error(`expected 1 geometry, found ${geoms.length}`);
  const [, geomId, geom] = geoms[0];

  const src = new Map();
  for (const m of geom.matchAll(/<source id="([^"]+)"[\s\S]*?<float_array[^>]*>([\s\S]*?)<\/float_array>[\s\S]*?<accessor[^>]*stride="(\d+)"/g)) {
    src.set(m[1], { data: floats(m[2]), stride: Number(m[3]) });
  }

  // <vertices> aliases a source under another id; resolve it or the
  // VERTEX input below dangles.
  const vm = geom.match(/<vertices id="([^"]+)">\s*<input semantic="POSITION" source="#([^"]+)"/);
  if (!vm) throw new Error('no <vertices> POSITION alias');
  src.set(vm[1], src.get(vm[2]));

  // Material -> (archive, record), read from the effect's image name.
  const images = new Map();
  for (const m of text.matchAll(/<image id="([^"]+)"[^>]*>\s*<init_from>([^<]+)<\/init_from>/g)) {
    images.set(m[1], m[2].trim());
  }
  const effectImage = new Map();
  for (const m of text.matchAll(/<effect id="([^"]+)">([\s\S]*?)<\/effect>/g)) {
    const ref = m[2].match(/<init_from>([^<\s]+)/);
    if (ref) effectImage.set(m[1], images.get(ref[1]) ?? ref[1]);
  }
  //
  // A DAE carries a texture per material only when the artist bound one
  // there. The rotor does; the MILL BODY does not - four of its five
  // materials are bound in the Unity PREFAB's material list instead, so
  // the mapping has to be supplied. `materialTextures` is that, keyed by
  // material id, and when it is given it is AUTHORITATIVE and must be
  // COMPLETE: a material it does not name throws, exactly as an unbound
  // one does, because a silently untextured submesh draws as garbage.
  const matTexture = new Map();
  for (const m of text.matchAll(/<material id="([^"]+)"[^>]*>\s*<instance_effect url="#([^"]+)"/g)) {
    if (materialTextures) {
      const given = materialTextures[m[1]];
      if (!given) throw new Error(`material ${m[1]} has no entry in the supplied material map`);
      matTexture.set(m[1], { textureArchive: given[0], textureRecord: given[1] });
      continue;
    }
    const name = effectImage.get(m[2]) ?? '';
    const t = /TEXTURE[._](\d+)[._](\d+)/.exec(name);
    if (!t) throw new Error(`material ${m[1]} names no classic texture (got "${name}")`);
    matTexture.set(m[1], { textureArchive: Number(t[1]), textureRecord: Number(t[2]) });
  }

  // The node transform, asserted rather than applied.
  const nm = text.match(/<node id="([^"]+)"[^>]*>\s*<matrix[^>]*>([^<]+)<\/matrix>/);
  if (!nm) throw new Error('no <node> with a <matrix>');
  const matrix = floats(nm[2]);
  matrix.forEach((v, i) => {
    if (Math.abs(v - EXPECTED_NODE_MATRIX[i]) > 1e-6) {
      throw new Error(`node matrix differs at ${i}: ${v} vs ${EXPECTED_NODE_MATRIX[i]} - `
        + 'this export is rotated differently and the no-transform bake would be wrong');
    }
  });

  const positions = [], normals = [], uvs = [], indices = [], subMeshes = [];
  const seen = new Map();

  for (const tri of geom.matchAll(/<triangles material="([^"]+)" count="(\d+)">([\s\S]*?)<\/triangles>/g)) {
    const [, material, count, body] = tri;
    const inputs = [...body.matchAll(/<input semantic="(\w+)" source="#([^"]+)" offset="(\d+)"/g)]
      .map((m) => ({ semantic: m[1], source: m[2], offset: Number(m[3]) }));
    const want = ['VERTEX', 'NORMAL', 'TEXCOORD'];
    for (const w of want) {
      if (!inputs.some((i) => i.semantic === w)) throw new Error(`triangles for ${material} has no ${w} input`);
    }
    const stride = Math.max(...inputs.map((i) => i.offset)) + 1;
    const p = ints(body.match(/<p>([\s\S]*?)<\/p>/)[1]);

    const tex = matTexture.get(material.replace(/-material$/, '') + '-material')
      ?? matTexture.get(material);
    if (!tex) throw new Error(`no texture for material ${material}`);

    const startIndex = indices.length;
    for (let i = 0; i < p.length; i += stride) {
      const key = inputs.map((inp) => p[i + inp.offset]).join('/');
      let vi = seen.get(key);
      if (vi === undefined) {
        vi = positions.length / 3;
        seen.set(key, vi);
        for (const inp of inputs) {
          const s = src.get(inp.source);
          const base = p[i + inp.offset] * s.stride;
          if (inp.semantic === 'VERTEX') positions.push(s.data[base], s.data[base + 1], s.data[base + 2]);
          else if (inp.semantic === 'NORMAL') normals.push(s.data[base], s.data[base + 1], s.data[base + 2]);
          // V is flipped: COLLADA's origin is bottom-left, the port's
          // texture sampling is top-left like every other DF model.
          else if (inp.semantic === 'TEXCOORD') uvs.push(s.data[base], 1 - s.data[base + 1]);
        }
      }
      indices.push(vi);
    }
    subMeshes.push({ ...tex, startIndex, primitiveCount: Number(count) });
  }

  // The sail must be flat in exactly ONE axis, and that axis is the one
  // it turns about. If a re-export ever makes it flat in two (or none),
  // the rotor law's axis is no longer derivable and this must fail.
  const axisSpan = [0, 1, 2].map((a) => {
    const v = positions.filter((_, i) => i % 3 === a);
    return Math.max(...v) - Math.min(...v);
  });
  const thin = axisSpan.indexOf(Math.min(...axisSpan));
  const others = axisSpan.filter((_, i) => i !== thin);
  const flat = others.every((v) => v > Math.min(...axisSpan) * 3);

  return {
    geomId,
    node: nm[1],
    positions,
    normals,
    uvs,
    indices,
    subMeshes,
    flatAxis: flat ? 'xyz'[thin] : null,
    bounds: {
      min: [0, 1, 2].map((a) => Math.min(...positions.filter((_, i) => i % 3 === a))),
      max: [0, 1, 2].map((a) => Math.max(...positions.filter((_, i) => i % 3 === a))),
    },
  };
}

// THE PARTS. The rotor's textures are bound in its own DAE; the body's
// are bound in the Unity PREFAB (Models/Finished/41600.prefab), whose
// MeshRenderer lists five materials in the DAE's own triangle order -
// Walls, Plank, Roof, Windmill, Door - resolved through the mod's .mat
// files, whose names ARE the classic (archive, record) pair. Read once
// and written down here, because the prefab is not vendored.
//
// Roller.dae is not baked: interior machinery, three materials with no
// texture at all, and the strict reader above rejected it outright -
// the reader behaving exactly as intended.
const BODY_MATERIALS = {
  'Walls-material': [364, 2],
  'Plank-material': [67, 1],
  'Roof-material': [369, 3],
  'Windmill-material': [67, 1],
  'Door-material': [332, 0],
};
const PARTS = [
  ['ROTOR', 'Blade.dae', null],
  ['BODY', 'Windmill.dae', BODY_MATERIALS],
];
const arr = (a, digits = 6) => `[${a.map((v) => (Number.isInteger(v) ? v : +v.toFixed(digits))).join(', ')}]`;

const blocks = PARTS.map(([name, file, mats]) => {
  const m = parseCollada(readFileSync(new URL(`../vendor/windmills-kamer/${file}`, import.meta.url), 'utf8'), mats);
  return `/** ${name} - \`${file}\`, node \`${m.node}\`, geometry \`${m.geomId}\`.
 *  ${m.positions.length / 3} vertices, ${m.indices.length / 3} triangles${m.flatAxis ? `, flat in ${m.flatAxis.toUpperCase()}` : ''}. */
export const ${name} = Object.freeze({
  positions: new Float32Array(${arr(m.positions)}),
  normals: new Float32Array(${arr(m.normals)}),
  uvs: new Float32Array(${arr(m.uvs)}),
  indices: new Uint32Array(${arr(m.indices)}),
  subMeshes: Object.freeze([${m.subMeshes.map((sm) => `
    Object.freeze({ textureArchive: ${sm.textureArchive}, textureRecord: ${sm.textureRecord}, startIndex: ${sm.startIndex}, primitiveCount: ${sm.primitiveCount} }),`).join('')}
  ]),
  flatAxis: ${m.flatAxis ? `'${m.flatAxis}'` : 'null'},
  bounds: Object.freeze({ min: Object.freeze(${arr(m.bounds.min)}), max: Object.freeze(${arr(m.bounds.max)}) }),
});`;
}).join('\n\n');

// WHERE THE MILLS STAND - the six placements Kamer chose, carried as the
// RAW record fields rather than baked matrices, so the placement MATH
// stays in world/rmbLayout.js where every other model's lives.
const placements = JSON.parse(
  readFileSync(new URL('../vendor/windmills-kamer/placements.json', import.meta.url), 'utf8')
).placements;
const placementRows = placements.map((p) => `  Object.freeze({ block: '${p.block}', `
  + `subX: ${p.subX}, subZ: ${p.subZ}, subRot: ${p.subRot}, `
  + `x: ${p.x}, y: ${p.y}, z: ${p.z}, rotY: ${p.rotY} }),`).join('\n');

writeFileSync(new URL('../src/world/windmillMesh.js', import.meta.url),
  `// GENERATED by scripts/bakeWindmill.mjs from vendor/windmills-kamer/
// (Kamer's "Windmills of Daggerfall" models and placements, vendored
// WITH THE AUTHOR'S PERMISSION - see vendor/windmills-kamer/README.md).
// Do not hand-edit; re-run the bake. test/windmillmesh.test.js pins this
// file against the vendored source, so a drifted bake fails.
//
// Shape is src/world/meshReader.js's own: positions/normals/uvs/indices
// plus subMeshes carrying the (textureArchive, textureRecord) pair - so
// both parts draw through the same path as every other model, and their
// TEXTURES come from the player's own ARENA2 at runtime. No Daggerfall
// art is in this file or this repository.
//
// Coordinates are as exported and UNTRANSFORMED: the export's node
// matrix composed with Z-up-to-Y-up is the identity, so these are the
// port's world units already. The rotor's hub is the ORIGIN and its
// turning axis is the axis it is flat in - see src/world/windmills.js.

${blocks}

/** WHERE THE MILLS STAND. Classic Daggerfall places NO windmill - these
 *  six blocks each gain one, which is what Kamer's WorldData overrides
 *  do on his side and what world/rmbLayout.js does on ours. Raw record
 *  fields in Daggerfall's own units; the matrix is built where every
 *  other model's is. */
export const PLACEMENTS = Object.freeze([
${placementRows}
]);
`);
console.log('wrote src/world/windmillMesh.js');
