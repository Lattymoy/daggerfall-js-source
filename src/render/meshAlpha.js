// @ts-check
// ═══════════════════════════════════════════════════════════════════
// POI-2 (2026-10-14) - A MESH SEEN THROUGH: THE RENDERER'S TRANSLUCENT DRAW, AND A TEXTURE'S OWN SAMPLING.
//
// The POI editor's materials (bible/06-Systems/POI-Editor-Arc.md; src/poi/poiLaw.js) promise what an imported glTF
// carries - alpha BLEND, wrap per axis (repeat, clamp, mirror), the filter (nearest, linear) - and the renderer had
// none of them for a mesh: INCIDENT 2026-09-04's law is that the mesh shader clips nothing and writes alpha 1, and every
// world texture is REPEAT/NEAREST. So both are added here as the renderer's own, opt-in, every other draw unchanged:
//
//   - MESH_ALPHA_GLSL: `uMeshAlpha`, nought (every uniform's own start) for the opaque world - alpha 1 written, as ever -
//     and above nought for a translucent draw: the texel's alpha times it (`meshAlphaOf`). Both mesh programs (the
//     classic FS and the Enhanced Lighting lane's) end on it.
//   - drawMesh(..., { translucent }) (renderer.js): blending on (straight alpha over, the destination's own alpha kept at
//     one), depth tested and never written, no shadow cast - a pane of glass is not a wall - drawn by its owner after the
//     opaque world, back to front (scenes/poiHost.js).
//   - samplerParams / samplerKey: a texture's wrap per axis and its filter, its mips as world art's, keyed apart (AUDIT
//     19 F10's law: the sampling is part of the key) - a POI's material asks for the key through its texRemap.
// ═══════════════════════════════════════════════════════════════════

export const MESH_ALPHA_GLSL = `uniform float uMeshAlpha;   // POI-2: 0 the opaque world (alpha 1, INCIDENT 2026-09-04's law); above 0 a translucent draw (render/meshAlpha.js)
float meshAlphaOf(float a) { return uMeshAlpha > 0.0 ? a * uMeshAlpha : 1.0; }`;

/** The sampler a texture may ask for (poiLaw.js POI_WRAP, POI_FILTER). */
export const SAMPLER_WRAPS = Object.freeze(['repeat', 'clamp', 'mirror']);
export const SAMPLER_FILTERS = Object.freeze(['nearest', 'linear']);

/**
 * A sampler's GL parameters - `{ wrapS, wrapT, mag, min }` - its mip chain (`mips`) the min filter's: NEAREST's mips
 * nearest (the world's own, DFU's FilterMode.Point), LINEAR's trilinear. Pure. An unknown word is the world's default.
 * @param {any} gl @param {{ wrapS?: string, wrapT?: string, filter?: string }} s @param {boolean} mips
 */
export function samplerParams(gl, s, mips) {
  const wrap = (w) => (w === 'clamp' ? gl.CLAMP_TO_EDGE : w === 'mirror' ? gl.MIRRORED_REPEAT : gl.REPEAT);
  const linear = s?.filter === 'linear';
  const mag = linear ? gl.LINEAR : gl.NEAREST;
  const min = mips ? (linear ? (gl.LINEAR_MIPMAP_LINEAR ?? mag) : (gl.NEAREST_MIPMAP_NEAREST ?? mag)) : mag;
  return { wrapS: wrap(s?.wrapS), wrapT: wrap(s?.wrapT), mag, min };
}

/** A sampler's suffix on a texture's cache key - `#s:<wrapS>,<wrapT>,<filter>` - so a picture uploaded under two
 *  samplers is two textures, never the first asker's. @param {{ wrapS?: string, wrapT?: string, filter?: string }} s */
export const samplerKey = (s) => `#s:${SAMPLER_WRAPS.includes(s?.wrapS) ? s.wrapS : 'repeat'},${SAMPLER_WRAPS.includes(s?.wrapT) ? s.wrapT : 'repeat'},${SAMPLER_FILTERS.includes(s?.filter) ? s.filter : 'nearest'}`;
