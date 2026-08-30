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

/** Copy a translation triple into a plain array. */
function bt3(t) {
  return [t[0], t[1], t[2]];
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
/**
 * RULE 63/66's COLOUR MODES (SceneUtil::VertexColorModes,
 * material.hpp:18-25; colormodes.glsl:4-9). The numbers reach the shader,
 * so they are the numbers.
 */
export const VERTEX_COLOR_MODE = Object.freeze({
  None: 0, Emission: 1, AmbientAndDiffuse: 2, Ambient: 3, Diffuse: 4, Specular: 5,
});

/** NiVertexColorProperty's two enums (nif/property.hpp:558-576). */
export const VERT_MODE = Object.freeze({ SrcIgnore: 0, SrcEmissive: 1, SrcAmbDif: 2 });
export const LIGHT_MODE = Object.freeze({ Emissive: 0, EmiAmbDif: 1 });

/** NiStencilProperty::DrawMode (nif/property.hpp:539-545). */
export const DRAW_MODE = Object.freeze({ Default: 0, CounterClockwise: 1, Clockwise: 2, Both: 3 });

/**
 * applyDrawableProperties (nifloader.cpp:2731-2934), which is a WALK OVER
 * AN ORDERED LIST and not a lookup per type.
 *
 * MW-D13 replaced a Map keyed by property type with the ordered chain the
 * reference builds - root first, the drawable's own properties last -
 * because ONE rule reads state the last property did not set.
 * `lightmode` is only assigned inside the SrcAmbDif branch (:2805), so an
 * ancestor NiVertexColorProperty that was SrcAmbDif + LightMode_Emissive
 * still blacks the surface out even when a NEARER property has since
 * chosen Emission. A per-type map loses the ancestor and the blackout
 * with it. Every other property is nearest-wins, which an ordered walk
 * gives for free.
 *
 * @param props ordered property records, ROOT FIRST
 * @param hasVertexColors whether the geometry carries a colour array -
 *   which decides the DEFAULT mode and undoes it again at the end
 */
function resolveMaterial(nif, props, hasVertexColors = false) {
  const out = {
    name: null,
    // "NIF material defaults don't match OpenGL defaults" (:2740-2742):
    // diffuse and ambient are explicitly re-set to white before the loop.
    diffuse: [1, 1, 1],
    ambient: [1, 1, 1],
    emissive: [0, 0, 0],
    // RULE 66's last line: at or below VER_MW (0x04000002) specular is
    // unconditionally zeroed with the comment "Morrowind has its support
    // disabled", so a Morrowind mesh's specular and glossiness are
    // parsed and thrown away. This reader is 4.0.0.2 only, so the field
    // is a constant 0 and NOT the file's value.
    glossiness: 0,
    alpha: 1,
    textureFile: null,
    clampMode: 3,
    alphaBlend: false,
    alphaTest: false,
    alphaThreshold: 0,
    // Rule 64: the mode is the ONE thing set before the loop that is not
    // a default.
    vertexColorMode: hasVertexColors
      ? VERTEX_COLOR_MODE.AmbientAndDiffuse : VERTEX_COLOR_MODE.None,
    // Rule 65: DrawMode 3 (Both) is the ONLY two-sided value. Default is
    // a synonym for counter-clockwise WITH backface culling, not for
    // two-sided.
    twoSided: false,
    clockwise: false,
  };
  // The running light mode, which outlives the property that set it.
  let lightmode = LIGHT_MODE.EmiAmbDif;

  for (const prop of props) {
    switch (prop.type) {
      case 'NiMaterialProperty':
        out.name = prop.name || null;
        out.diffuse = prop.diffuse.slice();
        out.ambient = prop.ambient.slice();
        out.emissive = prop.emissive.slice();
        // mAlpha becomes diffuse.a (:2768); ambient, emissive and
        // specular keep alpha 1.
        out.alpha = prop.alpha;
        break;
      case 'NiTexturingProperty': {
        const base = prop.textures[TEX_SLOT.base];
        if (base) {
          const src = deref(nif, base.source);
          if (src && src.external && src.fileName) {
            out.textureFile = src.fileName;
            out.clampMode = base.clampMode;
          }
        }
        break;
      }
      case 'NiAlphaProperty':
        // Two INDEPENDENT bitfields (rule 62): bit 0 = blending on,
        // bit 9 = testing on - and assigning both here is what makes a
        // nearer property with blending off STRIP an ancestor's blend.
        out.alphaBlend = (prop.flags & 0x0001) !== 0;
        out.alphaTest = (prop.flags & 0x0200) !== 0;
        out.alphaThreshold = prop.threshold;
        break;
      case 'NiVertexColorProperty':
        if (prop.vertexMode === VERT_MODE.SrcIgnore) {
          out.vertexColorMode = VERTEX_COLOR_MODE.None;
        } else if (prop.vertexMode === VERT_MODE.SrcEmissive) {
          out.vertexColorMode = VERTEX_COLOR_MODE.Emission;
        } else if (prop.vertexMode === VERT_MODE.SrcAmbDif) {
          lightmode = prop.lightingMode;
          out.vertexColorMode = lightmode === LIGHT_MODE.Emissive
            ? VERTEX_COLOR_MODE.None : VERTEX_COLOR_MODE.AmbientAndDiffuse;
        }
        break;
      case 'NiStencilProperty':
        // mDrawMode is acted on even when stencilling itself is off.
        out.clockwise = prop.drawMode === DRAW_MODE.Clockwise;
        out.twoSided = prop.drawMode === DRAW_MODE.Both;
        break;
      default:
        break;
    }
  }

  // AFTER the loop, in the reference's order.
  if (lightmode === LIGHT_MODE.Emissive) {
    // ":2895-2902" - diffuse RGB forced to black KEEPING its alpha, and
    // ambient forced to the zero vector. The surface is lit only by its
    // emissive term.
    out.diffuse = [0, 0, 0];
    out.ambient = [0, 0, 0];
  }
  if (!hasVertexColors) {
    // ":2907-2926" - "If we're told to use vertex colors but there are
    // none to use, use a default color instead": the named channel goes
    // WHITE and the mode is forced to None. A NiVertexColorProperty on a
    // colourless mesh yields plain white, never black.
    switch (out.vertexColorMode) {
      case VERTEX_COLOR_MODE.Diffuse:
      case VERTEX_COLOR_MODE.AmbientAndDiffuse:
        out.diffuse = [1, 1, 1];
        if (out.vertexColorMode === VERTEX_COLOR_MODE.AmbientAndDiffuse) out.ambient = [1, 1, 1];
        break;
      case VERTEX_COLOR_MODE.Ambient:
        out.ambient = [1, 1, 1];
        break;
      case VERTEX_COLOR_MODE.Emission:
        out.emissive = [1, 1, 1];
        break;
      default:
        break;
    }
    out.vertexColorMode = VERTEX_COLOR_MODE.None;
  }
  return out;
}

/**
 * RULE 63, and this is the single most likely place for a port to be
 * silently wrong: OpenMW does not MODULATE the material by the vertex
 * colour, it SUBSTITUTES the whole vec4 for whichever channel the mode
 * names (vertexcolors.glsl:6-32). Getting it backwards tints every
 * surface twice and darkens every mesh that carries colours at all.
 *
 * @param material resolveMaterial's output
 * @param colors the geometry's colour array, or null
 * @param i vertex index
 * @returns the DIFFUSE colour for that vertex, [r,g,b]
 */
export function diffuseAt(material, colors, i) {
  const m = material ? material.vertexColorMode : VERTEX_COLOR_MODE.None;
  if (colors && (m === VERTEX_COLOR_MODE.AmbientAndDiffuse || m === VERTEX_COLOR_MODE.Diffuse)) {
    return [colors[i * 4], colors[i * 4 + 1], colors[i * 4 + 2]];
  }
  return material ? material.diffuse : [1, 1, 1];
}

/**
 * Flatten a parsed NIF into draw-ready batches.
 * @param {{records:object[], roots:number[]}} nif - from parseNif.
 * @param {{includeHidden?: boolean}} [opts]
 * @returns {{name:string, skinned:boolean, positions:Float32Array,
 *   normals:Float32Array|null, uvs:Float32Array|null,
 *   colors:Float32Array|null, indices:Uint16Array, material:object}[]}
 */
/**
 * RULE 59's marker gate. A node's extra-data chain is the legacy singly
 * linked list (`mExtra` -> `next` -> ...), walked whole, and the payload
 * comparisons are EXACT AND CASE-SENSITIVE - `sd->mData == "MRK"`, not
 * ciEqual (nifloader.cpp:742-768). "MRK" is honoured ONLY when the node
 * carrying it is the ROOT (`args.mRootNode == node`), which is why this
 * takes one node rather than scanning the file.
 */
export function hasMarkerFlag(nif, rec) {
  for (let ref = rec ? rec.extra : -1; ref >= 0;) {
    const e = deref(nif, ref);
    if (!e) break;
    if (e.type === 'NiStringExtraData' && e.string === 'MRK') return true;
    ref = e.next ?? -1;
  }
  return false;
}

const ciStartsWith = (name, prefix) => String(name || '').toLowerCase().startsWith(prefix);

/**
 * RULE 59's GEOMETRY NAME SKIP LIST (nifloader.cpp:855-861), for
 * Morrowind-version files - which is every file this reader handles:
 *
 *   skip = (mHasMarkers && ciStartsWith(name, "tri editormarker"))
 *       || ciStartsWith(name, "shadow")
 *       || ciStartsWith(name, "tri shadow");
 *
 * TWO OF THE THREE ARE UNCONDITIONAL. A port that gates all of them on
 * the MRK flag draws every shadow-caster mesh in the game as solid
 * geometry - a black slab under the model - because "shadow" and
 * "tri shadow" are skipped whether or not the root says MRK.
 */
export function skipGeometryName(name, hasMarkers) {
  if (hasMarkers && ciStartsWith(name, 'tri editormarker')) return true;
  return ciStartsWith(name, 'shadow') || ciStartsWith(name, 'tri shadow');
}

export function flattenNif(nif, opts = {}) {
  const includeHidden = opts.includeHidden === true;
  const batches = [];

  function emit(shape, world, props) {
    const data = deref(nif, shape.data);
    if (!data || !data.vertices) return;
    const skinned = shape.skin >= 0;
    const n = data.numVertices;
    const positions = new Float32Array(n * 3);
    let normals = null;
    if (skinned) {
      // A skinned shape's verts stay as authored - the bones place them
      // (mwSkin.js). Its own transform is NOT baked here and NOT ignored:
      // it rides the skin payload as `shapeTransform`, because the
      // reference's render chain applies it AFTER the blend and its
      // skin-root cancellation deliberately stops short of it (MW-D20;
      // riggeometry.cpp:303-309). "NetImmerse ignores a skinned shape's
      // own transform", which stood here, is folk wisdom the reference's
      // own code contradicts.
      positions.set(data.vertices);
      if (data.normals) normals = Float32Array.from(data.normals);
    } else {
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
    }
    let skin = null;
    if (skinned) {
      const si = deref(nif, shape.skin);
      const sd = deref(nif, si.data);
      skin = {
        skeletonRoot: si.skeletonRoot,
        rootBone: si.skeletonRoot,
        transform: sd.transform,
        // MW-D20: the shape's OWN local transform, which the reference's
        // render chain applies to the blend's output and its skin-root
        // cancellation deliberately stops short of (riggeometry.cpp:
        // 303-309). Carried as data; skinBatch composes it outermost.
        shapeTransform: {
          rotation: shape.rotation ?? [1, 0, 0, 0, 1, 0, 0, 0, 1],
          translation: shape.translation ?? [0, 0, 0],
          scale: shape.scale ?? 1,
        },
        bones: si.bones.map((ref, i) => ({
          ref,
          name: (deref(nif, ref)?.name || '').toLowerCase(),
          invBind: {
            a: (() => {
              const bt = sd.bones[i].transform;
              const a = new Float32Array(9);
              for (let k = 0; k < 9; k++) a[k] = bt.rotation[k] * bt.scale;
              return a;
            })(),
            t: bt3(sd.bones[i].transform.translation),
          },
          indices: sd.bones[i].indices,
          weights: sd.bones[i].weights,
        })),
      };
    }
    batches.push({
      name: shape.name || '',
      skinned,
      skin,
      positions,
      normals,
      uvs: data.uvSets.length ? Float32Array.from(data.uvSets[0]) : null,
      colors: data.colors ? Float32Array.from(data.colors) : null,
      indices: Uint16Array.from(data.triangles),
      material: resolveMaterial(nif, props, !!data.colors),
    });
  }

  // Rule 59: mHasMarkers, set from the ROOT's own extra chain and from
  // nowhere else, then carried down the whole traversal.
  let hasMarkers = false;

  function walk(ref, world, props, isRoot = false) {
    const rec = deref(nif, ref);
    if (!rec) return;
    // RULE 58 (1): "Bounding Box", case-insensitive EXACT, and the node
    // AND ITS WHOLE SUBTREE never enter the scene at all. The guard is
    // `args.mRootNode && ...` and mRootNode is null on the first call, so
    // a NIF whose ROOT is named "Bounding Box" is NOT skipped - which
    // reads like an oversight and is load-bearing, because such a file
    // would otherwise load as nothing.
    if (!isRoot && String(rec.name || '').toLowerCase() === 'bounding box') return;
    // RULE 58 (2): RootCollisionNode is hidden - node mask set to the
    // hidden mask, mSkipMeshes set - rather than deleted; the subgraph is
    // still built and still animated. This flattener produces DRAWABLES,
    // and a hidden subgraph contributes none, so returning here is that
    // rule's observable half. Nothing downstream animates collision.
    if (rec.type === 'RootCollisionNode') return;
    if (!includeHidden && (rec.flags & 0x0001) !== 0) return;
    if (isRoot) hasMarkers = hasMarkerFlag(nif, rec);

    const nextWorld = composeTransform(world, rec);
    let nextProps = props;
    if (rec.properties && rec.properties.length) {
      // Root-first APPEND, never a per-type overwrite - see
      // resolveMaterial's header for the one rule that can tell.
      nextProps = props.slice();
      for (const pRef of rec.properties) {
        const prop = deref(nif, pRef);
        if (prop) nextProps.push(prop);
      }
    }
    if (rec.type === 'NiTriShape') {
      // Rule 59's skip list, applied where the reference applies it: at
      // the GEOMETRY, by NAME, after the transforms and properties have
      // been composed. The node is still walked - it simply emits
      // nothing - which is the difference between skipping a drawable
      // and pruning a subtree.
      if (!skipGeometryName(rec.name, hasMarkers)) emit(rec, nextWorld, nextProps);
      return;
    }
    if (NODE_TYPES.has(rec.type) && rec.children) {
      for (const child of rec.children) {
        if (child >= 0) walk(child, nextWorld, nextProps);
      }
    }
  }

  for (const root of nif.roots) {
    if (root >= 0) walk(root, IDENTITY, [], true);
  }
  return batches;
}
