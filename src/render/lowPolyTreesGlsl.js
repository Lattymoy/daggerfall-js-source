// @ts-check
// LPT1 (bible/07-Rendering/Low-Poly-Trees.md): THE BILLBOARD PROGRAM'S FRAGMENT HALF OF A LOW-POLY TREE - one home for
// both lanes' billboard shaders (render/renderer.js BB_FS, render/enhancedLighting.js EL_BB_FS), which the vertex
// shader's mesh mode feeds (renderer.js BB_VS: vShade, vAlpha, vFade - 1, 1 and 1 on every flat, so a flat's texel is
// what it was).
//
// - The texel as sampled (`lptTexel`, LPT_FS_KEEP): a tree's uv wraps as the mod's own (REPEAT) - the flats' margin
//   clear, which a widened elite's quad needs, never takes a tree's texel past 1 (AUDIT LPT A7).
// - vShade: the tree's own faces lit and its material's colour, laid on the texel before either lane lights it.
// - vAlpha: what the texel's alpha is multiplied by - its material's cut brought to the flats' 0.5 (AUDIT LPT A4), and 0
//   an opaque card (the mod's *_Opaque materials), never cut by alpha.
// - vFade: THE CROSSFADE between a far picture and its 3D tree, a screen-door over bayer4 (the port's one ordered
//   dither - render/orderedDither.js): a far picture keeps a fragment where the threshold stands under its share (vFade
//   below 1), a tree where it does not (vFade 2 plus the tree's share, 1 less the picture's: 3 less it), so across the
//   band every pixel is one of the two, never both and never neither. 1 (every flat) and 3 (a tree inside the radius)
//   keep every fragment. Wants bayer4 above it.

/** The three inputs, before main. */
export const LPT_FS_HEAD = `
in vec3 vShade;   // LPT1 (render/lowPolyTreesGlsl.js)
in float vAlpha;
in float vFade;
`;

/** CANOPY-SEE (Mac, 2026-10-31: "a sort of transparency when your overworld traveling in valenwood. Under the tall
 *  trees"): under the travel view a 3D tree between the eye and the traveller (render/fogGlsl.js uFocus) is a veil, never
 *  a wall. The window is a cone about the sight line: open inside `core` (rad), shut past `core + rim`; open to `near`
 *  plus `ease` m short of the traveller, whole by `near`, so what stands at the traveller is whole. A tree in it keeps
 *  `keep` of its fragments by the screen-door (EG-ZN's 4 of 16, scenes/eliteGates/egOcclude.js). LPT_FS_TEXEL reads it,
 *  and wants vBBWorld, uCamPos and uFocus above main. */
export const TREE_SEE = Object.freeze({ core: 0.11, rim: 0.06, near: 2, ease: 10, keep: 0.25 });
const f4 = (v) => v.toFixed(4);

/** The texel as sampled, kept before the flats' margin clear - straight after both maps are sampled. */
export const LPT_FS_KEEP = `  vec4 lptTexel = tex;   // LPT1: a tree's texel, kept from the flats' margin clear (render/lowPolyTreesGlsl.js)
`;

/** On the texel, after both maps are sampled and the quad's margin cleared (SPRITE-GRAD's law: no branch before). */
export const LPT_FS_TEXEL = `
  // LPT1: a low-poly tree's own texel, its light and colour, its cut, and the crossfade with its far picture
  // (render/lowPolyTreesGlsl.js)
  if (vFade > 1.5) tex = lptTexel;
  tex.rgb *= vShade;
  tex.a = vAlpha > 0.0 ? tex.a * vAlpha : 1.0;
  if (vFade < 1.0 ? bayer4(gl_FragCoord.xy) + 0.03125 >= vFade : (vFade > 1.5 && vFade < 3.0 && bayer4(gl_FragCoord.xy) + 0.03125 < 3.0 - vFade)) discard;
  // CANOPY-SEE: a 3D tree between the travel view's eye and its traveller, seen through (TREE_SEE). The cut takes the
  // threshold's low end, as the handover's does, so a tree in both keeps the lesser of the two shares.
  if (vFade > 1.5 && uFocus.w > 0.5) {
    vec3 seeAx = uFocus.xyz - uCamPos, seeR = vBBWorld - uCamPos;
    float seeD = max(length(seeAx), 1e-3), seeAlong = dot(seeR, seeAx) / seeD;
    float seeOff = length(seeR - seeAx * (seeAlong / seeD));
    float seeOpen = step(0.0, seeAlong) * (1.0 - smoothstep(${f4(TREE_SEE.core)}, ${f4(TREE_SEE.core + TREE_SEE.rim)}, atan(seeOff, max(seeAlong, 1e-3))))
      * (1.0 - smoothstep(seeD - ${f4(TREE_SEE.near + TREE_SEE.ease)}, seeD - ${f4(TREE_SEE.near)}, seeAlong));
    if (bayer4(gl_FragCoord.xy) + 0.03125 < ${f4(1 - TREE_SEE.keep)} * seeOpen) discard;
  }
`;
