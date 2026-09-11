// ECV1 - THE CONCEALED FOE'S DRAW CONSTANTS (2026-09-07), split out of
// systems/combatVisuals.js by AUDIT 65 PN-3.
//
// A LEAF: this module imports nothing, on purpose. render/renderer.js
// interpolates SHADE_DARK into its billboard fragment shader (ONE DFU
// MEMBER, ONE EXPORT - the shader used to restate 0.12 as a second
// literal), and combatVisuals.js reaches effects.js, which reaches
// inventory, spellcast, enchantments, paperdoll and the save/BSA
// readers: importing it from the renderer took renderer.js's static
// closure from 13 modules to 69, and src/tools/waterLab.js from 18 to
// 73. The numbers live here; systems/combatVisuals.js re-exports them
// and stays their one public home, so every reader keeps its import.

/** Chameleon: the base opacity, and the shimmer's swing and rate. */
export const BLEND_ALPHA = 0.22;
export const BLEND_SHIMMER = 0.08;
export const BLEND_HZ = 1.3;
/** Shadow: a dark silhouette - the opacity and how far the lit colour
 *  is pulled toward black (the shader's multiplier). Interpolated into
 *  renderer.js's BB_FS, so it must stay a DECIMAL - GLSL ES 3.00 will
 *  not multiply a vec3 by an int literal. */
export const SHADE_ALPHA = 0.55;
export const SHADE_DARK = 0.12;
/** The hit reveal: how long the flash lasts and how bright it starts. */
export const REVEAL_SECONDS = 0.35;
export const REVEAL_ALPHA = 0.8;
