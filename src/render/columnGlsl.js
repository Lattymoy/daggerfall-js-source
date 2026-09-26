// @ts-check
// DW-F (2026-09-26): THE WATER COLUMN'S SHARE, ONE HOME. Iliac Puddle No
// More's TransparentWaterSurfaceTop reads Unity's camera depth texture for
// the column behind the surface - alpha = a + (1 - a) min(behind / vision,
// 1) - and the port's world pass has no depth texture to read, so the sum
// is split across two draws (deepWatersRender.js's header; Port-Ledger, the
// Iliac Puddle No More row, (3)): what the top covers is carried toward the
// top's colour by min(behind / vision, 1) at its own fragment, and the top
// is blended at `a`. Everything the depth texture holds takes it: the
// mod's floor and its decorations (deepWatersRender.js), and DFU's own
// billboards - `Daggerfall/Billboard` is `alphatest:_Cutoff addshadow`, so
// a foe under the sea is in the depth texture the top reads (renderer.js's
// billboard programs, a batch the host flags as standing in a carved sea).
// A leaf over one leaf, so the classic page's graph grows by these two.
// The caller declares uCamPos, uFogColor and FOG_GLSL first.

import { SURFACE_TEXTURE_TILING } from '../world/deepWaterLook.js';

// what the top covers, carried toward the top's colour by min(behind /
// vision, 1); the top's colour is the one the top draws at the ray's entry,
// the world's fog there over it (TOP_FS), so the split sum stays the blend's
export const COLUMN_GLSL = `
uniform sampler2D uSurfaceTex;
uniform vec3 uDwCamFwd;        // the camera's forward (uCamFwd is the lane's light clusters' vec4 - one program holds both)
uniform float uColumnOn;       // 1 while the camera is over the sea and the surfaces are drawn
uniform float uSeaY;           // the surface's world height
uniform vec4 uTopColor;        // the top's _Color (rgb tint, a alpha)
uniform float uTopVision;      // the top's _WaterSurfaceVisionDistance
uniform vec2 uSurfaceScroll;   // the top's texture offset now, in repeats
uniform vec3 uPixelOrigin;     // this pixel's world origin (the surface's uv is pixel-local)
vec3 dwColumn(vec3 col, vec3 worldPos) {
  if (uColumnOn > 0.5 && worldPos.y < uSeaY && uCamPos.y > worldPos.y) {
    // where the view ray crosses the sea, and the eye depth behind it
    vec3 toFrag = worldPos - uCamPos;
    float s = clamp((uSeaY - uCamPos.y) / min(toFrag.y, -1e-4), 0.0, 1.0);
    vec3 entry = uCamPos + toFrag * s;
    float behind = max(dot(worldPos - entry, uDwCamFwd), 0.0);
    float t = min(behind / max(uTopVision, 1.0), 1.0);
    vec2 uv = (entry.xz - uPixelOrigin.xz) / 819.2 * ${SURFACE_TEXTURE_TILING.toFixed(1)} + uSurfaceScroll;
    vec3 st = texture(uSurfaceTex, uv).rgb * uTopColor.rgb;
    st = mix(st, uTopColor.rgb * 0.32, 0.22);
    st = mix(uFogColor, st, fogFactorAt(entry));
    col = mix(col, st, t);
  }
  return col;
}`;
