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

// EVERY NiNode-derived record is recursed into: nifloader.cpp:932-937 walks
// `ninode->mChildren` for anything that casts to Nif::NiNode, and the switch
// and LOD classes get their own osg wrapper first (:907-924) rather than a
// pruned subtree. Four of these were parsed and then dropped on the floor.
const NODE_TYPES = new Set([
  'NiNode',
  'NiBSAnimationNode',
  'NiBSParticleNode',
  'NiBillboardNode',
  'AvoidNode',
  'NiSwitchNode',
  'NiLODNode',
  'NiSortAdjustNode',
  'NiCollisionSwitch',
]);

/**
 * The one child a selector node shows, or null for a plain node that shows
 * all of them. NiSwitchNode: `setSingleChildOn(mInitialIndex)` on a switch
 * whose new-child default is false (nifloader.cpp:568-575) - the index the
 * file names, nothing else. NiLODNode: osg::LOD with one range per level
 * and DISTANCE_FROM_EYE_POINT (:553-565), whose traversal draws child i
 * when `range[i].min <= distance < range[i].max`. A flattener bakes one
 * static scene and has no eye, so it reads the LOD at its own centre -
 * distance 0, the nearest level, which is how Morrowind authors level 0.
 * NiSortAdjustNode and NiCollisionSwitch are plain NiNodes in the
 * reference (no Switch/LOD wrapper), so they keep every child.
 */
function selectedChild(rec) {
  if (rec.type === 'NiLODNode') {
    const levels = rec.lodLevels;
    if (Array.isArray(levels)) {
      for (let i = 0; i < levels.length; i++) {
        if (levels[i].near <= 0 && levels[i].far > 0) return i;
      }
      // No level covers the centre: nothing is in range, exactly as
      // osg::LOD's traversal draws nothing when no range matches.
      if (levels.length) return -1;
    }
    return 0;
  }
  // An index past the last child leaves NO branch on, which is what an
  // out-of-range setSingleChildOn leaves behind too.
  if (rec.type === 'NiSwitchNode') return Number.isInteger(rec.index) ? rec.index : 0;
  return null;
}

/** The geometry classes this flattener draws. NiLines is parsed and is NOT
 *  here: the reference gives it a LINES primitive set (nifloader.cpp:1624-
 *  1631) and a batch here is a triangle list by contract, so a line shape
 *  has no honest home downstream - it is dropped rather than drawn as
 *  triangles. */
const GEOMETRY_TYPES = new Set(['NiTriShape', 'NiTriStrips']);

/** MAC-Q (2026-09-17, Mac: "the torch doesn't emit fire"): the PARTICLE
 *  geometries. A batch here is a triangle list by contract, and a particle
 *  system is not one - it is an emitter and a law, drawn as quads that do
 *  not exist until the clock runs - so they do not become batches. They
 *  are handed WHOLE to `opts.effects` when a caller brings a sink, with the
 *  same composed transform and property chain a shape gets, and the
 *  NiBSParticleNode's flags the reference reads for AutoPlay and
 *  LocalSpace (nifloader.cpp:786-787 sets `args.mAnimFlags` from the
 *  enclosing NiBSAnimationNode or NiBSParticleNode). formats/mwParticles.js
 *  turns a bundle into a system. A caller with no sink gets exactly what
 *  it always got: nothing. */
const PARTICLE_TYPES = new Set(['NiParticles', 'NiAutoNormalParticles', 'NiRotatingParticles']);
const ANIM_FLAG_NODES = new Set(['NiBSAnimationNode', 'NiBSParticleNode']);

/** nifloader.cpp:1609-1621: one TRIANGLE_STRIP primitive per strip, strips
 *  shorter than 3 skipped, and a shape whose strips are ALL short draws
 *  nothing. Unrolled to the triangle list this module emits, with GL's own
 *  winding flip on odd triangles and the degenerate joins (a repeated index,
 *  which GL drops) left out. */
function stripsToTriangles(data) {
  const out = [];
  for (const strip of data.strips ?? []) {
    if (!strip || strip.length < 3) continue;
    for (let i = 0; i + 2 < strip.length; i++) {
      const a = strip[i], b = strip[i + 1], c = strip[i + 2];
      if (a === b || b === c || a === c) continue;
      if (i & 1) out.push(b, a, c);
      else out.push(a, b, c);
    }
  }
  return Uint16Array.from(out);
}

/** Row-major 3x3 multiply: out = a*b. */
export function mat33Mul(a, b) {
  const o = new Float32Array(9);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
    }
  }
  return o;
}

/** Row-major 3x3 applied to [x,y,z]. */
export function mat33Apply(m, x, y, z) {
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
export function composeTransform(p, node) {
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
export function resolveMaterial(nif, props, hasVertexColors = false) {
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
    // MAC-Q: the blend FUNCTION, which a particle drawable is the first
    // consumer of. NiAlphaProperty's own bitfield (nif/property.hpp):
    // bits 1-4 the source factor, bits 5-8 the destination, each an
    // index into nifloader.cpp getBlendMode's table (:1899-1929); the
    // reference's default on the ONE/ZERO pair is a NIF with no alpha
    // property at all, which draws opaque. Kept as the file's index -
    // the renderer owns the GL names.
    srcBlend: 6, dstBlend: 7,
    // NiZBufferProperty (:2542-2548, handleDepthFlags :2143-2154): bit 0
    // tests, bit 1 writes; a file without the property does both.
    depthTest: true, depthWrite: true,
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
        out.srcBlend = (prop.flags >> 1) & 0xF;   // MAC-Q: sourceBlendMode()
        out.dstBlend = (prop.flags >> 5) & 0xF;   // MAC-Q: destinationBlendMode()
        break;
      case 'NiZBufferProperty':   // MAC-Q
        out.depthTest = (prop.flags & 0x1) !== 0;
        out.depthWrite = (prop.flags & 0x2) !== 0;
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
 * MWT2 (2026-09-17, Mac: the Morrowind model's torch "isnt lit") - THE
 * EMISSION, which this file has always RESOLVED and nobody has ever read.
 *
 * `resolveMaterial` above already ports the reference's two emissive laws
 * exactly: `LightMode_Emissive` forces the DIFFUSE and the AMBIENT to
 * BLACK ("the surface is lit only by its emissive term", :2895-2902), and
 * `VertexMode_SrcEmissive` names the vertex colour as the emission. Then
 * `packFpArm` wrote only `diffuseAt` into the buffer and the character
 * fragment had no emission term at all (its own comment said so - "C4b -
 * no emission", written when the only meshes on that program were the
 * voxel rigs). So a self-illuminated Morrowind surface was drawn with a
 * BLACK diffuse, times a texture, times the scene's light: black. The
 * torch's flame is that surface, and a torch whose flame is black is a
 * stick.
 *
 * This is `diffuseAt`'s mirror, on the reference's own substitution law
 * (rule 63): the vertex colour IS the emission where the mode names it,
 * the material's own emissive otherwise.
 *
 * @param material resolveMaterial's output
 * @param colors the geometry's colour array, or null
 * @param i vertex index
 * @returns the EMISSION colour for that vertex, [r,g,b]
 */
export function emissiveAt(material, colors, i) {
  const m = material ? material.vertexColorMode : VERTEX_COLOR_MODE.None;
  if (colors && m === VERTEX_COLOR_MODE.Emission) {
    return [colors[i * 4], colors[i * 4 + 1], colors[i * 4 + 2]];
  }
  // A material with no emissive field at all reads as NO emission rather
  // than throwing: `resolveMaterial` always writes one, but this is the
  // channel whose absence must never cost a frame, and a missing glow is
  // the safe direction where a thrown pack is a rig that does not draw.
  return material?.emissive ?? [0, 0, 0];
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
  // WS1: the scabbard files. `underNode` emits only the geometry BELOW
  // the node of that name (case-insensitive exact - the reference's
  // FindByNameVisitor test), `excludeNode` everything but that subtree;
  // both keep the full transform chain from the file root, because the
  // reference attaches the WHOLE file and masks one node
  // (actoranimation.cpp updateHolsteredWeapon: `weaponNode->setNodeMask(0)`).
  const underNode = opts.underNode ? String(opts.underNode).toLowerCase() : null;
  const excludeNode = opts.excludeNode ? String(opts.excludeNode).toLowerCase() : null;
  const batches = [];

  function emit(shape, world, props) {
    const data = deref(nif, shape.data);
    if (!data || !data.vertices) return;
    let indices;
    if (shape.type === 'NiTriStrips') {
      indices = stripsToTriangles(data);
      if (!indices.length) return;   // no strip of 3: the reference draws none
    } else {
      indices = Uint16Array.from(data.triangles);
    }
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
      indices,
      material: resolveMaterial(nif, props, !!data.colors),
    });
  }

  // Rule 59: mHasMarkers, set from the ROOT's own extra chain and from
  // nowhere else, then carried down the whole traversal.
  let hasMarkers = false;

  function walk(ref, world, props, isRoot = false, inside = !underNode, animFlags = 0) {
    const rec = deref(nif, ref);
    if (!rec) return;
    if (ANIM_FLAG_NODES.has(rec.type)) animFlags = rec.flags | 0;   // MAC-Q: nifloader.cpp:786-787
    const lname = String(rec.name || '').toLowerCase();
    if (excludeNode && lname === excludeNode) return;   // WS1: the masked subtree
    if (underNode && lname === underNode) inside = true;   // WS1: from here down
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
    if (GEOMETRY_TYPES.has(rec.type)) {
      // Rule 59's skip list, applied where the reference applies it: at
      // the GEOMETRY, by NAME, after the transforms and properties have
      // been composed. The node is still walked - it simply emits
      // nothing - which is the difference between skipping a drawable
      // and pruning a subtree.
      if (inside && !skipGeometryName(rec.name, hasMarkers)) emit(rec, nextWorld, nextProps);
      return;
    }
    if (PARTICLE_TYPES.has(rec.type)) {
      // MAC-Q: a particle system takes the same gates a shape does (the
      // hidden flag above, the name skip here) and goes to the sink whole.
      if (inside && opts.effects && !skipGeometryName(rec.name, hasMarkers)) {
        opts.effects.push({ ref, rec, world: nextWorld, props: nextProps, animFlags });
      }
      return;
    }
    if (NODE_TYPES.has(rec.type) && rec.children) {
      // AUDIT 39r R18: a switch and a LOD hold every branch but SHOW one.
      // nifloader.cpp:907-924 hangs their children off an osg::Switch
      // (`setNewChildDefaultValue(false); setSingleChildOn(mInitialIndex)`,
      // :568-575) or an osg::LOD with one DISTANCE_FROM_EYE_POINT range per
      // level (:553-565), so exactly one subtree ever draws. This flattener
      // emits drawables, so the selection has to happen here - walking all
      // of them superimposed every branch and every LOD level at once.
      const only = selectedChild(rec);
      if (only !== null) {
        const child = rec.children[only];
        if (child !== undefined && child >= 0) walk(child, nextWorld, nextProps, false, inside, animFlags);
        return;
      }
      for (const child of rec.children) {
        if (child >= 0) walk(child, nextWorld, nextProps, false, inside, animFlags);
      }
    }
  }

  for (const root of nif.roots) {
    if (root >= 0) walk(root, IDENTITY, [], true);
  }
  return batches;
}
