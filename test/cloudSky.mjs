// THE CLOUD SHADERS' OWN FUNCTIONS, RUN IN JS (AUDIT-VC7, lens 4: the pins
// quoted the shader's lines, so a wrong line and a wrong pin agreed). A sky
// of cells is packed by the source's own packCells and handed to the GLSL
// evaluator (test/glsl.mjs) as the march's uniforms; a test then checks a
// LAW on what the shader computes - a veil's Beer transmittance against a
// brute-force integral of its declared density, a stride's evidence against
// every column it claims to bound - instead of its text.

import { glslFunctions } from './glsl.mjs';
import { MARCH_FS, CLOUD_FIELD_GLSL, packCells, MAX_CELLS } from '../src/render/volumetricClouds.js';

const rows = (arr) => Array.from({ length: MAX_CELLS }, (_, i) => Array.from(arr.subarray(i * 4, i * 4 + 4)));

/** The uniforms the cells pack to, as the shader's arrays. */
export function cellUniforms(cells) {
  const k = packCells(cells, MAX_CELLS);
  return {
    uCellCount: k.count, uCell: rows(k.c), uCellA: rows(k.a), uCellB: rows(k.b), uCellC: rows(k.t), uCellK: rows(k.k),
    uCellS: rows(k.s), uCellU: rows(k.u), uCellKS: rows(k.ks), uCellKU: rows(k.ku), uCellF: rows(k.f),
  };
}

/** A zone's own terms (a sunny row's), the sky map's size and the colours, over which `over` is laid. */
export const ZONE = Object.freeze({
  uBase: 1400, uTop: 3200, uCover: 0.32, uDensity: 0.6, uFlat: 0.1, uShear: 0, uDark: 0, uVary: 0.5, uSoft: 0.5,
  uSlabBase: 500, uSlabTop: 4200, uShift: [0, 0], uDrift: [0, 0], uEvolve: [0, 0, 0], uCoverDrift: [0, 0], uCamXZ: [0, 0],
  uMapSize: [2048, 512], uCloudShade: [0.3, 0.3, 0.35], uCloudLit: [0.9, 0.9, 0.9], uHorizonColor: [0.6, 0.7, 0.8],
  uLightDir: [0, 0.6, 0.8], uLightColor: [1, 1, 1], uSkyTint: [0.4, 0.5, 0.8], uDusk: 0, uSteps: 48, uLightSteps: 6,
  uCirrus: [0, 0, 0, 0], uCirrusLight: [1, 1, 1], uCirrusDir: [0, 1, 0],
});

/** The march's functions over `cells` and the zone, with `over` laid on the uniforms; `textureLod` is a
 *  (sampler, coord, lod) -> vec4 stand-in for the noise volumes (default: a flat 0.5 everywhere). */
export function marchFns(cells = [], over = {}) {
  return glslFunctions(MARCH_FS, { ...ZONE, ...cellUniforms(cells), textureLod: () => [0.5, 0.5, 0.5, 0.5], ...over });
}

/** The same over the field alone - what both marches share. */
export function fieldFns(cells = [], over = {}) {
  return glslFunctions(CLOUD_FIELD_GLSL, { ...ZONE, ...cellUniforms(cells), textureLod: () => [0.5, 0.5, 0.5, 0.5], ...over });
}

/** A unit vector. */
export const unit = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
