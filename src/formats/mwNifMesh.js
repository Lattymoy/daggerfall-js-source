// Morrowind NIF scene flattener - slice 2 of the import arc. Walks a
// parsed NIF (src/formats/mwNifFile.js), composes node transforms down the
// graph, and emits draw-ready batches: baked world-space positions and
// normals, UV/color passthrough, the accumulated material and base
// texture, and the alpha-property state. Pure data in, pure data out -
// no GL, no DOM - so the same module feeds the viewer prototype now and
// the game's character/item pipeline in later slices.
//
// NetImmerse semantics honored here:
//   - transforms compose as R,S,T per node: world(v) = Rw*(Sw*v) + Tw
//     with Rw = Rp*Rl, Sw = Sp*Sl, Tw = Rp*(Sp*Tl) + Tp (uniform scale).
//   - flags bit 0 on any NiAVObject hides that node AND its subtree.
//   - RootCollisionNode subtrees are collision, never drawn.
//   - NiProperty records ACCUMULATE down the graph; a nearer record of
//     the same type overrides an ancestor's.
//   - Skinned shapes are emitted as-authored (bind pose) and marked
//     `skinned` - live deformation is the animation slice's work.

import { deref, TEX_SLOT } from './mwNifFile.js';

const NODE_TYPES = new Set([
  'NiNode',
  'NiBSAnimationNode',
  'NiBSParticleNode',
  'NiBillboardNode',
  'AvoidNode',
]);

/** Row-major 3x3 multiply: out = a*b. */
function mat33Mul(a, b) {
  const o = new Float32Array(9);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
    }
  }
  return o;
}

/** Row-major 3x3 applied to [x,y,z]. */
function mat33Apply(m, x, y, z) {
  return [
    m[0] * x + m[1] * y + m[2] * z,
    m[3] * x + m[4] * y + m[5] * z,
    m[6] * x + m[7] * y + m[8] * z,
  ];
}

const IDENTITY = Object.freeze({
  rotation: Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]),
  translation: [0, 0, 0],
  scale: 1,
});

/** Compose parent world transform with a node's local transform. */
function composeTransform(p, node) {
  const rotation = mat33Mul(p.rotation, node.rotation);
  const [tx, ty, tz] = mat33Apply(
    p.rotation,
    node.translation[0] * p.scale,
    node.translation[1] * p.scale,
    node.translation[2] * p.scale,
  );
  return {
    rotation,
    translation: [p.translation[0] + tx, p.translation[1] + ty, p.translation[2] + tz],
    scale: p.scale * node.scale,
  };
}

/** Resolve a shape's effective material/texture/alpha from accumulated props. */
function resolveMaterial(nif, props) {
  const out = {
    name: null,
    diffuse: [1, 1, 1],
    ambient: [1, 1, 1],
    emissive: [0, 0, 0],
    glossiness: 0,
    alpha: 1,
    textureFile: null,
    clampMode: 3,
    alphaBlend: false,
    alphaTest: false,
    alphaThreshold: 0,
  };
  const mat = props.get('NiMaterialProperty');
  if (mat) {
    out.name = mat.name || null;
    out.diffuse = mat.diffuse.slice();
    out.ambient = mat.ambient.slice();
    out.emissive = mat.emissive.slice();
    out.glossiness = mat.glossiness;
    out.alpha = mat.alpha;
  }
  const texp = props.get('NiTexturingProperty');
  const base = texp ? texp.textures[TEX_SLOT.base] : null;
  if (base) {
    const src = deref(nif, base.source);
    if (src && src.external && src.fileName) {
      out.textureFile = src.fileName;
      out.clampMode = base.clampMode;
    }
  }
  const alpha = props.get('NiAlphaProperty');
  if (alpha) {
    // NiAlphaProperty flags: bit 0 = blending on, bit 9 = testing on.
    out.alphaBlend = (alpha.flags & 0x0001) !== 0;
    out.alphaTest = (alpha.flags & 0x0200) !== 0;
    out.alphaThreshold = alpha.threshold;
  }
  return out;
}

/**
 * Flatten a parsed NIF into draw-ready batches.
 * @param {{records:object[], roots:number[]}} nif - from parseNif.
 * @param {{includeHidden?: boolean}} [opts]
 * @returns {{name:string, skinned:boolean, positions:Float32Array,
 *   normals:Float32Array|null, uvs:Float32Array|null,
 *   colors:Float32Array|null, indices:Uint16Array, material:object}[]}
 */
export function flattenNif(nif, opts = {}) {
  const includeHidden = opts.includeHidden === true;
  const batches = [];

  function emit(shape, world, props) {
    const data = deref(nif, shape.data);
    if (!data || !data.vertices) return;
    const n = data.numVertices;
    const positions = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const [x, y, z] = mat33Apply(
        world.rotation,
        data.vertices[i * 3] * world.scale,
        data.vertices[i * 3 + 1] * world.scale,
        data.vertices[i * 3 + 2] * world.scale,
      );
      positions[i * 3] = x + world.translation[0];
      positions[i * 3 + 1] = y + world.translation[1];
      positions[i * 3 + 2] = z + world.translation[2];
    }
    let normals = null;
    if (data.normals) {
      normals = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const [x, y, z] = mat33Apply(
          world.rotation,
          data.normals[i * 3],
          data.normals[i * 3 + 1],
          data.normals[i * 3 + 2],
        );
        normals[i * 3] = x;
        normals[i * 3 + 1] = y;
        normals[i * 3 + 2] = z;
      }
    }
    batches.push({
      name: shape.name || '',
      skinned: shape.skin >= 0,
      positions,
      normals,
      uvs: data.uvSets.length ? Float32Array.from(data.uvSets[0]) : null,
      colors: data.colors ? Float32Array.from(data.colors) : null,
      indices: Uint16Array.from(data.triangles),
      material: resolveMaterial(nif, props),
    });
  }

  function walk(ref, world, props) {
    const rec = deref(nif, ref);
    if (!rec) return;
    if (rec.type === 'RootCollisionNode') return;
    if (!includeHidden && (rec.flags & 0x0001) !== 0) return;

    const nextWorld = composeTransform(world, rec);
    let nextProps = props;
    if (rec.properties && rec.properties.length) {
      nextProps = new Map(props);
      for (const pRef of rec.properties) {
        const prop = deref(nif, pRef);
        if (prop) nextProps.set(prop.type, prop);
      }
    }
    if (rec.type === 'NiTriShape') {
      emit(rec, nextWorld, nextProps);
      return;
    }
    if (NODE_TYPES.has(rec.type) && rec.children) {
      for (const child of rec.children) {
        if (child >= 0) walk(child, nextWorld, nextProps);
      }
    }
  }

  for (const root of nif.roots) {
    if (root >= 0) walk(root, IDENTITY, new Map());
  }
  return batches;
}
