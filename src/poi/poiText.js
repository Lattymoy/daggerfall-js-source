// @ts-check
// ═══════════════════════════════════════════════════════════════════
// POI-3 (2026-10-14) - WHAT THE EDITOR SAYS, IN THE BUILDER'S LANGUAGE.
//
// The law (poi/poiLaw.js), the glTF reader (poi/gltfImport.js), the mesh (poi/poiMesh.js) and the picture header
// (poi/poiImage.js) speak in CODES - a stable word and the numbers it turns on - so the service, the game and the
// editor share one law and no reader carries English (L10N4). Here each code is a sentence, through the text core
// (systems/textManager.js t: the catalog's row in the player's language, the English as written here else), and a
// problem's PATH (`parts[2].materials[0].alpha`) is where to look, said as the builder sees it - the part by its name.
// A code this table has not heard of is still said, as itself: never a blank line in a list of what is wrong.
//
// Not a DFU member. Ledger A (POI).
// ═══════════════════════════════════════════════════════════════════

import { t, intlLocale } from '../systems/textManager.js';   // L10N4: the words through the text core
import { POI_MESH_LIMITS } from './poiMesh.js';
import { POI_IMAGE_LIMITS } from './poiImage.js';

/** @type {Record<string, (a: any) => string>} */
const PROBLEM = {
  'not-object': () => t('poi.problem.notObject', 'This is not a POI document.'),
  'not-json': () => t('poi.problem.notJson', 'The document cannot be written out.'),
  'too-large': (a) => t('poi.problem.tooLarge', 'The document is too large ({bytes, number} bytes; at most {max, number}).', a),
  version: () => t('poi.problem.version', 'Made for another version of the editor.'),
  id: () => t('poi.problem.id', 'Its id is malformed.'),
  name: (a) => t('poi.problem.name', 'Give it a name of up to {max} characters.', a),
  about: (a) => t('poi.problem.about', 'The description is too long (at most {max} characters).', a),
  tags: (a) => t('poi.problem.tags', 'At most {max} tags.', a),
  tag: (a) => t('poi.problem.tag', 'A tag is 1 to {max} characters.', a),
  missing: () => t('poi.problem.missing', 'Its place on the map is missing.'),
  px: () => t('poi.problem.px', 'It stands off the map, east or west.'),
  py: () => t('poi.problem.py', 'It stands off the map, north or south.'),
  'in-pixel': () => t('poi.problem.inPixel', 'Its spot is outside its map square.'),
  height: (a) => t('poi.problem.height', 'It stands too high or too low (at most {max} m).', a),
  ground: () => t('poi.problem.ground', 'Choose how it stands: on the ground, or at a fixed height.'),
  quat: () => t('poi.problem.quat', 'Its rotation is not valid.'),
  size: (a) => t('poi.problem.size', 'Its size is between {min} and {max}.', a),
  'parts-none': () => t('poi.problem.partsNone', 'Add at least one part.'),
  'parts-many': (a) => t('poi.problem.partsMany', 'At most {max} parts.', a),
  key: () => t('poi.problem.key', 'A part\'s key is malformed.'),
  'key-twice': (a) => t('poi.problem.keyTwice', 'Two parts share the key {key}.', a),
  'part-name': (a) => t('poi.problem.partName', 'A part\'s name is too long (at most {max} characters).', a),
  'mesh-ref': () => t('poi.problem.meshRef', 'A part names no model.'),
  offset: (a) => t('poi.problem.offset', 'It is too far from the POI\'s origin (at most {max} m).', a),
  scale: (a) => t('poi.problem.scale', 'Each side\'s scale is between {min} and {max}.', a),
  collide: () => t('poi.problem.collide', 'Choose whether it is solid.'),
  bool: () => t('poi.problem.bool', 'A switch is neither on nor off.'),
  materials: (a) => t('poi.problem.materials', 'A part has 1 to {max} materials.', a),
  'texture-ref': () => t('poi.problem.textureRef', 'A material names a picture wrongly.'),
  color4: () => t('poi.problem.color4', 'A color is out of range.'),
  color3: () => t('poi.problem.color3', 'A light\'s color is out of range.'),
  'emissive-color': (a) => t('poi.problem.emissiveColor', 'A glow\'s color is between 0 and {max}.', a),
  alpha: () => t('poi.problem.alpha', 'Choose opaque, cutout or see-through.'),
  cutoff: () => t('poi.problem.cutoff', 'A cutout\'s threshold is between 0 and 1.'),
  wrap: () => t('poi.problem.wrap', 'Choose repeat, clamp or mirror for each side of a picture.'),
  filter: () => t('poi.problem.filter', 'Choose smooth or pixelated.'),
  uv: () => t('poi.problem.uv', 'A picture\'s placement is out of range.'),
  unknown: () => t('poi.problem.unknown', 'It holds a field the editor does not know.'),
  lights: (a) => t('poi.problem.lights', 'At most {max} lights.', a),
  radius: (a) => t('poi.problem.radius', 'A light reaches between {min} and {max} m.', a),
  intensity: (a) => t('poi.problem.intensity', 'A light\'s strength is between 0 and {max}.', a),
  label: (a) => t('poi.problem.label', 'The map label is too long (at most {max} characters).', a),
  'not-uploaded': () => t('poi.problem.notUploaded', 'A model or picture it names has not been uploaded.'),
  'not-a-mesh': () => t('poi.problem.notAMesh', 'It names a picture where a model belongs.'),
  'not-a-texture': () => t('poi.problem.notATexture', 'It names a model where a picture belongs.'),
  // AUDIT POI U13: the count in its plural ("Its model has 1 materials" no more)
  'material-count': (a) => t('poi.problem.materialCount', 'Its model has {want, plural, one {# material} other {# materials}}; the part has {have}.', a),
  // AUDIT POI S6: the POI as a whole (poiLaw.js POI_BUDGET)
  'budget-triangles': (a) => t('poi.problem.budgetTriangles', 'It draws too many triangles ({have, number}; at most {max, number}). Simplify a model, or stand fewer parts.', a),
  'budget-vertices': (a) => t('poi.problem.budgetVertices', 'Its parts hold too many vertices together ({have, number}; at most {max, number}). Simplify a model, or stand fewer parts.', a),
  'budget-bytes': (a) => t('poi.problem.budgetBytes', 'Its models and pictures are too large together ({have, number} MB; at most {max, number} MB).', { have: Math.ceil(a.have / 1048576), max: Math.floor(a.max / 1048576) }),
  'budget-pixels': (a) => t('poi.problem.budgetPixels', 'Its pictures are too large together ({have, number} megapixels; at most {max, number}). Use smaller pictures, or fewer.', { have: Math.ceil(a.have / 1e6), max: Math.floor(a.max / 1e6) }),
  'budget-reach': (a) => t('poi.problem.budgetReach', 'It reaches too far from its place ({have, number} m; at most {max, number} m).', a),
};

/** @type {Record<string, (a: any) => string>} */
const GLTF = {
  'not-gltf': () => t('poi.gltf.notGltf', 'This is not a glTF 2.0 file.'),
  'not-gltf2': () => t('poi.gltf.notGltf2', 'This glTF file is not version 2.0. Export it again as glTF 2.0.'),
  'glb-chunk': () => t('poi.gltf.glbChunk', 'This .glb file is damaged: a part of it is missing or cut short.'),
  'glb-no-json': () => t('poi.gltf.glbNoJson', 'This .glb file has no scene in it.'),
  'glb-no-bin': () => t('poi.gltf.glbNoBin', 'This .glb file is missing its binary data.'),
  'data-uri': () => t('poi.gltf.dataUri', 'A file embedded in this model cannot be read.'),
  compressed: (a) => t('poi.gltf.compressed', 'This model is compressed ({ext}). Export it again with compression off.', a),
  extension: (a) => t('poi.gltf.extension', 'This model needs {ext}, which the editor does not support.', a),
  'file-missing': (a) => t('poi.gltf.fileMissing', 'This model needs the file {uri}. Choose it together with the .gltf.', a),
  // AUDIT POI U13: glTF's own object names said as words of each language, never dropped in ("a accessor", in English in
  // every language)
  missing: (a) => t('poi.gltf.missing', 'This model refers to {what, select, accessor {an accessor} bufferView {a buffer view} buffer {a buffer} image {an image} texture {a texture} node {a node} skin {a skin} joint {a joint} vertex {a vertex} other {a piece of itself}} that is not there.', a),
  'past-end': (a) => t('poi.gltf.pastEnd', 'This model\'s data is cut short: {what, select, accessor {an accessor} bufferView {a buffer view} other {a piece of it}} runs past its end.', a),
  'node-cycle': () => t('poi.gltf.nodeCycle', 'This model\'s node tree loops back on itself.'),
  'accessor-type': () => t('poi.gltf.accessorType', 'This model stores a mesh attribute in a form glTF does not allow.'),
  // AUDIT POI G3: a file that asks for more than any POI could hold, a node of two parents, and anything else malformed
  'too-large': () => t('poi.gltf.tooLarge', 'This model is too large to import. Simplify it, or import it in pieces.'),
  'node-parents': () => t('poi.gltf.nodeParents', 'An object in this model\'s node tree has two parents.'),
  'too-many-parts': (a) => t('poi.gltf.tooManyParts', 'This model has {n, number} objects, and a POI holds at most {max} parts. Make it one part, or import it in pieces.', a),
  malformed: () => t('poi.gltf.malformed', 'This model\'s file is damaged or does not follow glTF 2.0. Export it again.'),
};

/** @type {Record<string, (a: any) => string>} */
const GLTF_WARN = {
  'points-lines': () => t('poi.gltfWarn.pointsLines', 'Points and lines were left out: only triangles are imported.'),
  'no-positions': () => t('poi.gltfWarn.noPositions', 'A mesh with no positions was left out.'),
  'vertex-colours': () => t('poi.gltfWarn.vertexColours', 'Vertex colors were not imported: bake them into a texture.'),
  maps: () => t('poi.gltfWarn.maps', 'Normal, occlusion and metal/roughness maps were left out: the game does not draw them.'),
  skin: () => t('poi.gltfWarn.skin', 'A skinned model was imported in its saved pose.'),
  animation: () => t('poi.gltfWarn.animation', 'Animations were not imported.'),
  'camera-light': () => t('poi.gltfWarn.cameraLight', 'Cameras and lights in the file were left out: add lights in the editor.'),
  'no-uvs': () => t('poi.gltfWarn.noUvs', 'A textured material\'s mesh has no UVs: unwrap it in the UV editor.'),
  'emission-uv-set': () => t('poi.gltfWarn.emissionUvSet', 'A glow map uses a second UV set; it is drawn with the first.'),
  'image-format': () => t('poi.gltfWarn.imageFormat', 'A picture that is not PNG, JPEG or WebP was left out.'),
  // AUDIT POI G5, G8: a glow placed unlike its picture; an extension used and not read
  'emission-transform': () => t('poi.gltfWarn.emissionTransform', 'A glow map is placed or repeated differently from its picture; it is drawn as the picture is.'),
  instancing: () => t('poi.gltfWarn.instancing', 'Objects repeated by GPU instancing were imported once each. Export again with GPU instancing off.'),
  'extension-ignored': (a) => t('poi.gltfWarn.extensionIgnored', 'This model uses {ext}, which the editor does not read: what it adds was left out.', a),
};

/** @type {Record<string, (a: any) => string>} */
const MESH = {
  'too-many-vertices': (a) => t('poi.mesh.tooManyVertices', 'A part has too many vertices (at most {max, number}). Split it, or simplify it.', a),
  'too-many-indices': (a) => t('poi.mesh.tooManyIndices', 'A part has too many triangles (at most {max, number}). Split it, or simplify it.', a),
  'too-many-submeshes': (a) => t('poi.mesh.tooManySubmeshes', 'A part has too many materials (at most {max}).', a),
  'too-large': (a) => t('poi.mesh.tooLarge', 'A part is too large (at most {max} m from its origin).', a),
  'too-many-bytes': () => t('poi.mesh.tooManyBytes', 'A part\'s model is too large a file.'),
  // AUDIT POI (the lead's; lane E's note): the two an import can meet in a damaged file, said as what they are
  'not-finite': () => t('poi.mesh.notFinite', 'A part\'s model holds an invalid number (NaN or infinity). Export it again.'),
  'index-range': () => t('poi.mesh.indexRange', 'A part\'s model names a vertex it does not have. Export it again.'),
};

/** @type {Record<string, (a: any) => string>} */
const IMAGE = {
  'not-an-image': () => t('poi.image.notAnImage', 'Not a PNG, JPEG or WebP picture.'),
  size: () => t('poi.image.size', 'The picture has no width or height.'),
  'too-large': (a) => t('poi.image.tooLarge', 'The picture is more than {max} pixels on a side.', a),
  'too-many-bytes': () => t('poi.image.tooManyBytes', 'The picture is too large a file.'),
  jpeg: () => t('poi.image.jpeg', 'The JPEG file is damaged.'),
  webp: () => t('poi.image.webp', 'The WebP file is damaged.'),
};

/** POI-6: what a submission changes (poi/poiDiff.js codes). @type {Record<string, (a: any) => string>} */
const DIFF = {
  new: (a) => t('poi.diff.new', 'A new POI: {parts, plural, one {# part} other {# parts}}, {lights, plural, one {# light} other {# lights}}.', a),
  retire: () => t('poi.diff.retire', 'Takes it out of the world.'),
  name: (a) => t('poi.diff.name', 'Renamed from "{from}" to "{to}".', a),
  about: () => t('poi.diff.about', 'Its description changed.'),
  // AUDIT POI U13: none left is said in words of its own ("Its tags are now: ." no more); a list of them as the reader's
  // language lists (poiDiff's `tags`)
  tags: (a) => {
    const to = listText(Array.isArray(a.tags) ? a.tags : []);
    return to ? t('poi.diff.tags', 'Its tags are now: {to}.', { to }) : t('poi.diff.tagsNone', 'Its tags were all taken off.');
  },
  moved: (a) => t('poi.diff.moved', 'Moved {m, number} m.', a),
  ground: (a) => (a.to === 'snap' ? t('poi.diff.groundSnap', 'Now stands on the ground.') : t('poi.diff.groundAbsolute', 'Now stands at a fixed height.')),
  turned: (a) => t('poi.diff.turned', 'Turned {deg, number}°.', a),
  sized: (a) => t('poi.diff.sized', 'Resized from {from, number} to {to, number}.', a),
  'part-added': (a) => t('poi.diff.partAdded', 'Part added: {name}.', a),
  'part-removed': (a) => t('poi.diff.partRemoved', 'Part taken away: {name}.', a),
  // AUDIT POI U13: what changed listed as the reader's language lists it, not with an English comma
  'part-changed': (a) => t('poi.diff.partChanged', 'Part {name}: {what}.', { name: a.name, what: listText(a.what.map((w) => PART_WHAT[w]?.() ?? w)) }),
  lights: (a) => t('poi.diff.lights', 'Its lights changed ({from} to {to}).', a),
  // AUDIT POI U13: a mark with no label said so (it read 'shown, ""')
  marker: (a) => (!a.show ? t('poi.diff.markerHidden', 'Its mark on the map: hidden.')
    : a.label ? t('poi.diff.markerShown', 'Its mark on the map: shown, "{label}".', a) : t('poi.diff.markerShownBare', 'Its mark on the map: shown, with no label.')),
};
/** Words as one list, the reader's language's way (Intl.ListFormat, its separators - ui/credits.js's way); joined with a
 *  comma where the runtime has none. @param {string[]} words */
function listText(words) {
  try { return new Intl.ListFormat(intlLocale(), { type: 'unit', style: 'short' }).format(words); } catch { return words.join(', '); }
}
/** What changed in a part, in a word each. */
const PART_WHAT = {
  model: () => t('poi.diff.what.model', 'its model'),
  moved: () => t('poi.diff.what.moved', 'moved'),
  turned: () => t('poi.diff.what.turned', 'turned'),
  sized: () => t('poi.diff.what.sized', 'resized'),
  materials: () => t('poi.diff.what.materials', 'its materials'),
  solidity: () => t('poi.diff.what.solidity', 'its solidity or shadow'),
  name: () => t('poi.diff.what.name', 'its name'),
};

/** POI-6: a pack refused (poi/poiPack.js codes). @type {Record<string, (a: any) => string>} */
const PACK = {
  'pack-not-a-pack': () => t('poi.pack.notAPack', 'This is not a POI pack.'),
  'pack-version': () => t('poi.pack.version', 'This pack was made by another version of the editor.'),
  'pack-too-large': () => t('poi.pack.tooLarge', 'This pack holds too much to read at once.'),
  'pack-bad-poi': (a) => t('poi.pack.badPoi', 'A POI in the pack is not valid ({name}).', a),
  'pack-bad-entry': (a) => t('poi.pack.badEntry', 'A library entry in the pack is not valid ({name}).', a),
  'pack-asset-hash': () => t('poi.pack.assetHash', 'A model or picture in the pack is not what its name says.'),
  'pack-asset-bad': () => t('poi.pack.assetBad', 'A model or picture in the pack is damaged.'),
  'pack-missing-asset': () => t('poi.pack.missingAsset', 'The pack names a model or picture it does not carry.'),
  // AUDIT POI P7: an id once in a pack
  'pack-poi-twice': (a) => t('poi.pack.poiTwice', 'The pack holds two POIs under one id ({name}).', a),
  'pack-entry-twice': (a) => t('poi.pack.entryTwice', 'The pack holds two library entries under one id ({name}).', a),
};

const said = (table, fallback) => (code, args = {}) => {
  const f = table[code];
  return f ? f(args ?? {}) : fallback(code);
};
const unknownCode = (code) => t('poi.text.unknownCode', 'Something is wrong ({code}).', { code });

/** A law problem's sentence. @param {{ code: string, [k: string]: any }} p */
export const problemText = (p) => said(PROBLEM, unknownCode)(p.code, p);
/** A glTF refusal's sentence (gltfImport.js GltfError's `code` and `args`). */
export const gltfErrorText = said(GLTF, unknownCode);
/** A glTF warning's sentence (bakeGltf's `warnings`). */
export const gltfWarningText = said(GLTF_WARN, unknownCode);
const MESH_MAX = { 'too-many-vertices': POI_MESH_LIMITS.vertices, 'too-many-indices': POI_MESH_LIMITS.indices / 3, 'too-many-submeshes': POI_MESH_LIMITS.submeshes, 'too-large': POI_MESH_LIMITS.extent };
/** A mesh's refusal (poiMesh.js poiMeshError / decodePoiMesh's bare code): the limits by name, with their numbers;
 *  every other a damaged model. @param {string} code */
export const meshErrorText = (code) => said(MESH, () => t('poi.mesh.malformed', 'A part\'s model is malformed.'))(code, { max: MESH_MAX[code] });
/** POI-6: a change a submission makes, as the approver reads it. @param {{ code: string, [k: string]: any }} c */
export const diffText = (c) => said(DIFF, unknownCode)(c.code, c);
/** POI-6: a pack's refusal. @param {{ code: string, [k: string]: any }} r */
export const packErrorText = (r) => said(PACK, unknownCode)(r.code, r);
/** A picture's refusal (poiImage.js poiImageMetaOf's). @param {string} code */
export const imageErrorText = (code) => said(IMAGE, unknownCode)(code, { max: POI_IMAGE_LIMITS.side });

/**
 * Where a problem is, as the builder sees it - "Part Roof · material 2", "Light 3" - or '' for the POI itself.
 * @param {string} path @param {any} [doc] the document (a part is named by its name, else its key)
 */
export function problemWhere(path, doc = null) {
  const bits = [];
  const part = /^parts\[(\d+)\]/.exec(path);
  if (part) {
    const p = doc?.parts?.[Number(part[1])];
    const name = (p?.name || p?.key) ?? null;
    bits.push(name ? t('poi.where.partNamed', 'Part {name}', { name }) : t('poi.where.part', 'Part {n}', { n: Number(part[1]) + 1 }));
    const mat = /\.materials\[(\d+)\]/.exec(path);
    if (mat) bits.push(t('poi.where.material', 'material {n}', { n: Number(mat[1]) + 1 }));
  }
  const light = /^lights\[(\d+)\]/.exec(path);
  if (light) bits.push(t('poi.where.light', 'Light {n}', { n: Number(light[1]) + 1 }));
  const tag = /^tags\[(\d+)\]/.exec(path);
  if (tag) bits.push(t('poi.where.tag', 'Tag {n}', { n: Number(tag[1]) + 1 }));
  if (path === 'thumb') bits.push(t('poi.where.thumb', 'Its library picture'));
  return bits.join(' · ');
}
