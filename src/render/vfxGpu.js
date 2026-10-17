// @ts-check
// MW-SPELLFX1 (2026-10-07): A MORROWIND EFFECT'S STREAMS ON THE GPU.
//
// formats/morrowind/mwVfx.js answers an effect's frame as packed streams in the particle program's own format; this holds the
// GL side of ONE running effect: a renderer particle effect per stream (render/renderer.js createParticleEffect),
// made the first time the stream is seen at the size the effect can ever need (vfxCapacity), its draw state the
// stream's, its texture set by FILE each frame - a flipbook changes it, the particle texture overrides it - each file's
// GL texture made once and OWNED here, so the release frees exactly what this made and nothing a neighbour shares.
// The arm (combat/fpArm.js, VFX_Hands on the hands) and the world layer (scenes/mwMagicFx.js) both drive one.

import { wrapModes } from '../formats/morrowind/mwTexture.js';

/** A stream's floats a vertex (render/renderer.js createParticleEffect's layout) and where its colour starts in them
 *  (`aColor`, location 3, at byte 28). */
export const VFX_VERTEX_FLOATS = 12;
export const VFX_COLOR_AT = 7;
/**
 * EG-ZG (2026-10-12; bible/11-Multiplayer/Elite-Gates.md section 25.4 - THE QUIET COMPANY): a stream's quads at `alpha` of
 * themselves, into `out` (the caller's, kept): each vertex's colour - its alpha where the blend reads the source's alpha
 * (NiAlphaProperty's SRC_ALPHA and every other), all four where it adds the source as it is (`srcBlend` 0, ONE). The
 * particle program multiplies the texel by this colour (render/renderer.js PARTICLE_FS), so an ally's effect draws at
 * that share. Answers `out`. Pure but for `out`.
 * @param {Float32Array} packed @param {number} count vertices @param {number} alpha @param {number} srcBlend @param {Float32Array} out
 */
export function vfxFade(packed, count, alpha, srcBlend, out) {
  const n = count * VFX_VERTEX_FLOATS;
  for (let i = 0; i < n; i++) out[i] = packed[i];
  for (let v = 0; v < count; v++) {
    const o = v * VFX_VERTEX_FLOATS + VFX_COLOR_AT;
    if (srcBlend === 0) { out[o] *= alpha; out[o + 1] *= alpha; out[o + 2] *= alpha; }
    out[o + 3] *= alpha;
  }
  return out;
}

/**
 * `renderer` the port's; `textures` a Map from a texture file to its decoded entry ({ image: { mips } } -
 * fpArm.collectArmTextures' shape); `capacity` vfxCapacity's Map from a stream key to its most vertices.
 * @param {any} renderer render/renderer.js's (its particle effects and character textures)
 * @param {Map<string, any> | null | undefined} textures
 * @param {Map<string, number> | null | undefined} capacity
 */
export function createVfxGpu(renderer, textures, capacity) {
  const effects = new Map();   // stream key -> the renderer's particle effect
  const texs = new Map();      // `${file}|${clamp}` -> GL texture, owned here
  let released = false;

  function textureFor(file, clampMode) {
    if (!file) return null;
    const key = `${file}|${clampMode}`;
    if (texs.has(key)) return texs.get(key);
    const entry = textures?.get?.(file);
    const tex = entry && entry.image && entry.image.mips ? renderer.createCharacterTexture(entry.image.mips, wrapModes(clampMode)) : null;
    texs.set(key, tex);
    return tex;
  }

  return {
    /** This frame's streams onto the GPU. Answers the live effects in stream order; a stream absent this frame is
     *  hidden, not freed - it comes back the frame its node is visible again. EG-ZG: `alpha` the effect's share of itself
     *  (an ally's during a Spire trial - vfxFade). */
    sync(streams, alpha = 1) {
      if (released) return [];
      const live = new Set();
      const out = [];
      for (const s of streams ?? []) {
        let e = effects.get(s.key);
        if (!e) {
          const vertices = capacity?.get?.(s.key) ?? s.count;
          e = renderer.createParticleEffect(Math.ceil(Math.max(vertices, s.count) / 6), s.drawState);
          effects.set(s.key, e);
        }
        e.tex = textureFor(s.texture, s.drawState?.clampMode ?? 3);
        e.blend = !!s.drawState?.blend; e.srcBlend = s.drawState?.srcBlend ?? 6; e.dstBlend = s.drawState?.dstBlend ?? 7;
        e.alphaCut = s.drawState?.alphaCut ?? 0; e.depthTest = s.drawState?.depthTest !== false; e.depthWrite = s.drawState?.depthWrite !== false;
        e.hidden = false;
        if (alpha < 1 && s.count > 0) { const need = s.count * VFX_VERTEX_FLOATS; if (!e.faded || e.faded.length < need) e.faded = new Float32Array(need); renderer.updateParticleEffect(e, vfxFade(s.packed, s.count, alpha, e.blend ? e.srcBlend : -1, e.faded), s.count); }   // EG-ZG
        else renderer.updateParticleEffect(e, s.packed, s.count);
        live.add(s.key);
        out.push(e);
      }
      for (const [key, e] of effects) if (!live.has(key)) e.hidden = true;
      return out;
    },
    /** Every effect this holds, hidden or not - what a mesh's `effects` list carries. */
    effects() { return [...effects.values()]; },
    /** Frees the effects and the textures. The textures are this holder's, so each effect lets go of its own first:
     *  releaseParticleEffect deletes the texture an effect points at. */
    release() {
      if (released) return;
      released = true;
      for (const e of effects.values()) { e.tex = null; renderer.releaseParticleEffect(e); }
      effects.clear();
      for (const tex of texs.values()) if (tex) renderer.releaseCharacterTexture(tex);
      texs.clear();
    },
    get released() { return released; },
  };
}
