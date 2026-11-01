// @ts-check
// IIL2 - IMPROVED INTERIOR LIGHTING'S SHADOWS, WITHOUT ENHANCED LIGHTING'S LOOK.
//
// Mac (2026-09-27): "I don't want Enhanced Lighting to do the shadows - the mod should." In Daggerfall Unity the mod
// never draws a shadow itself: it sets `light.shadows = LightShadows.Soft` on its lights (and turns the NPCs' and
// enemies' billboards to cast, BillboardShadows.cs) and Unity's engine draws them - shadow maps, depth compares, the
// soft edge. The port's engine already has that machinery (render/shadowPass.js: a cube map per light, the casters
// recorded as the world draws, a soft compare on the receivers); what it lacked was a way to have it WITHOUT the
// Enhanced Lighting lane's look - linear colour, the tonemap, the inverse-square flame, specular, the eye adaptation.
//
// This is that lane: the Enhanced Lighting lane's programs with their look put back to Daggerfall's -
//   elDecode / elEncode  the identity (display-space colour, as the classic shaders light in);
//   elTonemapRGB         a clamp (no curve);
//   elAttenuation        the classic shaders' (1 - d/r)^2 falloff;
//   elSpecLobe           zero (the classic shaders have no highlight);
//   elAdapt              one (no eye adaptation);
// and on the CPU side no colour decode, no in-scatter, no air pass (no ambient occlusion, bloom or glow). What stays
// is exactly the mod's ask: every light's shadow map and the soft compare that reads it, and billboards casting.
//
// The renderer treats it as a lane (it builds its programs, its ShadowPass and its light clusters) and tells the hosts
// it is NOT Enhanced Lighting (`renderer.lightingLane` answers null for a `classicLook` lane), so every host keeps its
// classic colours, ambients and fog.

import { EL_LANE } from './enhancedLighting.js';

/** Replace a GLSL function's body, found by its signature, brace-matched. Throws if the signature is missing - a
 *  lane shader that changed shape must fail here, loudly, not ship with the Enhanced look half undone. */
export function replaceGlslFunction(src, signature, body) {
  const at = src.indexOf(signature);
  if (at < 0) throw new Error(`classic shadow lane: '${signature}' is not in the shader`);
  const open = src.indexOf('{', at);
  let depth = 0,
    i = open;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) break;
  }
  return `${src.slice(0, open)}{\n  ${body}\n}${src.slice(i + 1)}`;
}

/** The overrides, signature -> body. elSpecLobe is absent from the far ring (it has no highlight to lose).
 *  @type {ReadonlyArray<[string, string, { optional?: boolean }?]>} */
export const CLASSIC_LOOK = Object.freeze([
  ['vec3 elDecode(vec3 c)', 'return c;'],
  ['vec3 elEncode(vec3 c)', 'return clamp(c, 0.0, 1.0);'],
  ['vec3 elTonemapRGB(vec3 c)', 'return clamp(c, 0.0, 1.0);'],
  ['float elAttenuation(float d, float range)', 'float a = clamp(1.0 - d / max(range, 1e-4), 0.0, 1.0); return a * a;'],
  ['float elAdapt()', 'return 1.0;'],
  ['float elSpecLobe(float x)', 'return 0.0;', { optional: true }],
]);

/** One lane shader with the classic look. */
export function classicLook(src) {
  let out = src;
  for (const [sig, body, opts] of CLASSIC_LOOK) {
    if (opts?.optional && !out.includes(sig)) continue;
    out = replaceGlslFunction(out, sig, body);
  }
  return out;
}

const identity3 = (src, out) => {
  out[0] = src[0];
  out[1] = src[1];
  out[2] = src[2];
  return out;
};
const identityN = (src, out, count) => {
  for (let i = 0; i < count * 3; i++) out[i] = src[i];
  return out.subarray ? out.subarray(0, count * 3) : out;
};

let _lane = null;
/** The lane, built on first ask (the shader rewrites run once). */
export function classicShadowLane() {
  _lane ??= Object.freeze({
    ...EL_LANE,
    key: 'classic-shadows',
    classicLook: true, // renderer.lightingLane answers null for it: the hosts stay classic
    meshFs: classicLook(EL_LANE.meshFs),
    bbFs: classicLook(EL_LANE.bbFs),
    terrainFs: classicLook(EL_LANE.terrainFs),
    charFs: classicLook(EL_LANE.charFs),
    decalFs: classicLook(EL_LANE.decalFs),
    farRingFs: classicLook(EL_LANE.farRingFs),
    shadows: true,
    air: false,
    decode3: identity3,
    decodeN: identityN,
    scatter: 0,
    scatterDensity: () => 0,
  });
  return _lane;
}

/**
 * Put the lane on the renderer, or take it off - never touching Enhanced Lighting's. `want`: this frame is one the
 * mod's shadows should light. Called by the hosts every frame before they compose their lights (setLightingLane is a
 * no-op when nothing changes).
 */
export function syncClassicShadowLane(renderer, want) {
  const key = renderer.installedLaneKey;
  if (key && key !== 'classic-shadows') return false; // Enhanced Lighting is on: its lane, its shadows
  if (want && key !== 'classic-shadows') {
    renderer.setLightingLane(classicShadowLane());
    renderer.setExposure?.(1);
    renderer.setAir?.(false);
    renderer.setContact?.(false);
    renderer.setVolumetrics?.(false);
    renderer.setHaze?.(false);
  } else if (!want && key === 'classic-shadows') {
    renderer.setLightingLane(null);
  }
  return want;
}
