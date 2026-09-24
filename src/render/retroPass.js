// @ts-check
// RETRO1 (2026-09-24, Mac: "Can we get retro mode from DFU ported
// over?") - DFU'S RETRO MODE: THE PASS.
//
// systems/retroMode.js reads the settings and does the arithmetic; this
// is the GL half, a leaf the renderer builds on the first retro frame
// (the air pass's pattern: it is handed the renderer's program builder
// and imports nothing of the renderer).
//
// THE IMAGE. On a retro frame the world pass draws into a small texture
// with its own depth - RetroRenderer.UpdateRenderTarget's
// `MainCamera.targetTexture` (:414-447) - instead of the canvas. With
// the Enhanced Lighting lane on, the lane's own frame image is simply
// made that small (its passes run at the retro size, as Unity's post
// stack did on DFU's retro camera) and its resolve writes into this
// texture rather than to the canvas. Either way the frame's first
// screen quad then PRESENTS it: the canvas is cleared black (DFU's
// retroClearerCamera, ViewportChanger.cs:142-146, which only the
// pillarbox needs - the port clears always, since nothing else clears
// the canvas on a retro frame), and one quad over the world rect
// samples the texture point-filtered through DFU's 640x400
// presentation target - OnPostRender's Blit into RetroPresentation
// (:495-506) and RetroPresentation's Blit to the screen, both Point,
// folded into one fetch by snapping the coordinate to the presentation
// texel first. The effect runs in that same fetch: the first Blit is
// the one that carries the material.
//
// THE EFFECTS (Shaders/DaggerfallRetroPosterization.shader,
// DaggerfallRetroPalettization.shader). DFU's target holds LINEAR
// colour and both shaders work in gamma space (LinearToGammaSpace in,
// GammaToLinearSpace out); the port's frame is already display-encoded
// bytes, so the gamma-space arithmetic is applied as it stands:
//   posterize   round(c * 15) / 15 per channel ("4 bits per
//               component"); c is a byte over 255 and a byte never
//               lands on a half, so the rounding cannot tie
//   palettize   the LUT: `size = 256 >> PalettizationLUTShift` texels a
//               side, texel (r,g,b) holding the palette colour nearest
//               to (r,g,b) << shift (InitLut :324-366), looked up at
//               floor(c * size) - Point filtering, clamped - which is
//               exactly (byte * size) / 255 in integers, so the shader
//               fetches the texel by index and no sampler rounding can
//               move a colour across a cell
//   -sky        EXCLUDE_SKY: a pixel whose depth is the far plane is
//               left as it is - "Sky untouched"
//
// THE PALETTE is art_pal (:53-314): Daggerfall's ART_PAL.COL less its
// transparent index, and three grey levels DFU adds ("Add a few missing
// grey levels"). The nearest colour is DFU's FastColorPalette
// (Utility/FastColorPalette.cs) - a k-d tree cut at ten colours a leaf,
// splitting on r, g, b by depth, the leaf taking the first of equal
// distances and a split keeping its own side's answer on a tie. Where
// the nearest colour is unique any exact search agrees with that tree,
// so the LUT is filled by a faster exact search (a candidate list per
// 8x8x8 block of texels) and asks the TREE only where two colours tie -
// the same bytes DFU writes, in about a quarter of DFU's time (DFU: "1 - 8MB,
// 850ms init"). The one thing not reproduced is the order .NET's
// unstable Array.Sort leaves equal channel values in, which can only
// decide between two colours at exactly equal distance inside one leaf.
// DFU builds the LUT once a session whatever the shift later says
// (`if (lut) return;`); the port rebuilds it when the shift changes.
//
// THE MIP CHAINS are the renderer's (Renderer.setRetro): TextureReader
// builds no mip chain in retro mode unless UseMipMapsInRetroMode. The
// albedo's retro mip bias (-0.75, TextureReader.cs:271-274) is NOT
// ported - WebGL2 has no sampler LOD bias, and a bias in every world
// shader is a change this pass is not worth (Ledger A, RETRO1).

import { setFrameTarget } from './renderTarget.js';

/** RetroPresentation.renderTexture's size - every mode is shown through it. */
export const RETRO_PRESENTATION = Object.freeze([640, 400]);

/** art_pal (RetroRenderer.cs:53-314), r, g, b per colour, in DFU's order. */
export const ART_PAL = Object.freeze([
  255, 229, 129,   255, 206, 107,   255, 206, 99,   247, 206, 115,   255, 206, 90,   247, 206, 107,
  239, 206, 115,   231, 206, 123,   255, 198, 99,   255, 197, 86,   231, 198, 122,   222, 198, 128,
  247, 189, 79,   208, 185, 134,   228, 178, 80,   186, 174, 147,   176, 164, 148,   206, 159, 73,
  179, 160, 121,   165, 156, 156,   185, 148, 76,   161, 147, 125,   164, 141, 94,   164, 130, 67,
  140, 129, 119,   137, 121, 94,   132, 119, 107,   132, 114, 82,   137, 112, 66,   118, 105, 93,
  112, 94, 72,   244, 202, 167,   227, 180, 144,   207, 152, 118,   193, 133, 100,   180, 113, 80,
  165, 100, 70,   152, 93, 63,   140, 86, 55,   129, 79, 48,   122, 75, 43,   112, 70, 40,
  103, 64, 39,   91, 67, 38,   79, 63, 43,   66, 54, 41,   54, 50, 40,   232, 188, 200,
  220, 166, 188,   204, 146, 170,   188, 127, 158,   175, 111, 144,   155, 98, 130,   143, 84, 119,
  127, 77, 106,   109, 69, 102,   101, 65, 96,   86, 58, 77,   75, 52, 71,   67, 51, 63,
  63, 47, 56,   56, 45, 52,   46, 44, 46,   245, 212, 172,   229, 193, 150,   213, 174, 128,
  196, 154, 105,   183, 140, 88,   173, 127, 78,   160, 118, 74,   151, 110, 69,   134, 103, 65,
  123, 92, 60,   109, 85, 54,   96, 76, 51,   83, 71, 44,   69, 63, 42,   61, 54, 38,
  50, 45, 34,   205, 205, 224,   188, 188, 199,   165, 165, 174,   145, 145, 159,   135, 135, 149,
  122, 122, 137,   114, 114, 127,   103, 103, 116,   94, 94, 109,   85, 85, 96,   75, 75, 85,
  68, 68, 80,   61, 61, 67,   53, 53, 59,   48, 48, 50,   44, 44, 45,   176, 205, 255,
  147, 185, 244,   123, 164, 230,   104, 152, 217,   87, 137, 205,   68, 124, 192,   68, 112, 179,
  62, 105, 167,   55, 97, 154,   49, 90, 142,   45, 82, 122,   51, 77, 102,   52, 69, 87,
  50, 62, 73,   47, 59, 60,   44, 48, 49,   220, 220, 220,   197, 197, 197,   185, 185, 185,
  174, 174, 174,   162, 162, 162,   147, 147, 147,   132, 132, 132,   119, 119, 119,   110, 110, 110,
  99, 99, 99,   87, 87, 87,   78, 78, 78,   67, 67, 67,   58, 58, 58,   51, 51, 51,
  44, 44, 44,   182, 218, 227,   158, 202, 202,   134, 187, 187,   109, 170, 170,   87, 154, 154,
  77, 142, 142,   70, 135, 135,   62, 124, 124,   54, 112, 112,   46, 103, 103,   39, 91, 91,
  40, 83, 83,   45, 72, 72,   47, 63, 63,   50, 55, 55,   45, 48, 48,   255, 246, 103,
  241, 238, 45,   226, 220, 0,   212, 203, 0,   197, 185, 0,   183, 168, 0,   168, 150, 0,
  154, 133, 0,   139, 115, 0,   127, 106, 4,   116, 97, 7,   104, 87, 11,   93, 78, 14,
  81, 69, 18,   69, 60, 21,   58, 51, 25,   202, 221, 196,   175, 200, 168,   148, 176, 141,
  123, 156, 118,   107, 144, 109,   93, 130, 94,   82, 116, 86,   77, 110, 78,   68, 99, 67,
  61, 89, 53,   52, 77, 45,   46, 68, 37,   39, 60, 39,   30, 55, 30,   34, 51, 34,
  40, 47, 40,   179, 107, 83,   175, 95, 75,   175, 87, 67,   163, 79, 59,   155, 75, 51,
  147, 71, 47,   155, 91, 47,   139, 83, 43,   127, 75, 39,   115, 67, 35,   99, 63, 31,
  87, 55, 27,   75, 47, 23,   59, 39, 19,   47, 31, 15,   35, 23, 11,   216, 227, 162,
  185, 205, 127,   159, 183, 101,   130, 162, 77,   109, 146, 66,   101, 137, 60,   92, 127, 54,
  84, 118, 48,   76, 108, 42,   65, 98, 37,   53, 87, 34,   51, 75, 35,   45, 64, 37,
  43, 56, 39,   38, 51, 40,   43, 46, 45,   179, 115, 79,   175, 111, 75,   171, 107, 71,
  167, 103, 67,   159, 99, 63,   155, 95, 59,   151, 91, 55,   143, 87, 51,   40, 40, 40,
  38, 38, 38,   35, 35, 35,   31, 31, 31,   27, 27, 27,   23, 23, 23,   19, 19, 19,
  15, 15, 15,   254, 255, 199,   254, 245, 185,   254, 235, 170,   254, 225, 156,   255, 215, 141,
  255, 205, 127,   255, 195, 112,   255, 185, 98,   255, 175, 83,   241, 167, 54,   234, 155, 50,
  226, 143, 46,   219, 131, 43,   212, 119, 39,   205, 107, 35,   198, 95, 31,   190, 84, 27,
  183, 72, 23,   176, 60, 19,   169, 48, 15,   162, 36, 12,   154, 24, 8,   147, 12, 4,
  130, 22, 0,   111, 34, 0,   102, 33, 1,   92, 33, 3,   83, 32, 10,   74, 39, 27,
  65, 41, 33,   57, 43, 39,   0, 0, 0,   4, 4, 4,   8, 8, 8,   12, 12, 12,
]);
/** 258 - ART_PAL.COL's 255 opaque colours and DFU's three greys. */
export const ART_PAL_COUNT = ART_PAL.length / 3;

/** FastColorPalette's PaletteCutoff (:106): a list this short is a leaf. */
export const PALETTE_CUTOFF = 10;

/** InitLut's size (:470). */
export const retroLutSize = (shift) => 256 >> shift;

/** Point sampling's texel for a byte: floor(byte / 255 * size), clamped. */
export const retroLutTexel = (byte, size) => Math.min(size - 1, Math.floor((byte * size) / 255));

/** The posterize shader's arithmetic on one byte (the shader's own
 *  floor(x * 15 + 0.5) / 15, back to a byte). */
export const posterizeByte = (byte) => Math.round((Math.floor((byte / 255) * 15 + 0.5) / 15) * 255);

/**
 * BuildPalette (:108-135) over palette INDICES. A node is a leaf
 * `{ leaf: [i...] }` or a split `{ axis, split, below, above }`; a split
 * that would leave one side empty is retried on the next axis (the
 * `IsDegenerated` arm), over the list as that failed split SORTED it -
 * SplitPalette sorts in place.
 */
export function buildPaletteTree(pal = ART_PAL, indices = null, depth = 0) {
  const list = indices ?? Array.from({ length: pal.length / 3 }, (_, i) => i);
  if (list.length <= PALETTE_CUTOFF) return { leaf: list.slice() };
  const axis = depth % 3;
  const proj = (i) => pal[i * 3 + axis];
  list.sort((a, b) => Math.sign(proj(a) - proj(b)));
  const middle = (list.length + 1) >> 1;
  const split = Math.trunc((proj(list[middle - 1]) + proj(list[middle])) / 2);
  const below = [], above = [];
  for (const i of list) (proj(i) >= split ? above : below).push(i);
  if (!below.length || !above.length) return buildPaletteTree(pal, list, depth + 1);
  return { axis, split, below: buildPaletteTree(pal, below, depth + 1), above: buildPaletteTree(pal, above, depth + 1) };
}

/** GetNearestColor (:25-40, :84-103): [index, squared distance]. */
export function nearestPaletteIndex(tree, r, g, b, pal = ART_PAL) {
  if (tree.leaf) {
    let best = tree.leaf[0], bestFit = -1;
    for (const i of tree.leaf) {
      const dr = r - pal[i * 3], dg = g - pal[i * 3 + 1], db = b - pal[i * 3 + 2];
      const fit = dr * dr + dg * dg + db * db;
      if (bestFit < 0 || fit < bestFit) { best = i; bestFit = fit; }
    }
    return [best, bestFit];
  }
  const diff = (tree.axis === 0 ? r : tree.axis === 1 ? g : b) - tree.split;
  const major = nearestPaletteIndex(diff >= 0 ? tree.above : tree.below, r, g, b, pal);
  if (major[1] >= diff * diff) {
    const minor = nearestPaletteIndex(diff >= 0 ? tree.below : tree.above, r, g, b, pal);
    if (minor[1] < major[1]) return minor;
  }
  return major;
}

let _tree = null;
const artPalTree = () => (_tree ??= buildPaletteTree());

/**
 * InitLut's texels (:338-360): RGBA8, r fastest then g then b, each the
 * palette colour nearest to (r, g, b) << shift - as FastColorPalette
 * answers it (see the header: a candidate search per block, the tree
 * wherever two colours tie).
 */
export function buildRetroLut(shift) {
  const size = retroLutSize(shift);
  const out = new Uint8Array(size * size * size * 4);
  if (!(size > 0)) return { size: 0, data: out };
  const pal = Int32Array.from(ART_PAL), n = ART_PAL_COUNT, tree = artPalTree();   // typed: the frozen array's elements are the slow kind
  const B = Math.min(8, size);
  const cand = new Int32Array(n);
  const far = (c, lo, hi) => Math.max((c - lo) * (c - lo), (c - hi) * (c - hi));
  const gap = (c, lo, hi) => (c < lo ? lo - c : c > hi ? c - hi : 0);
  for (let b0 = 0; b0 < size; b0 += B) {
    for (let g0 = 0; g0 < size; g0 += B) {
      for (let r0 = 0; r0 < size; r0 += B) {
        // the block's texels stand for the values [lo, hi] on each axis:
        // every colour that could be nearest to one of them is no farther
        // from the box than the best colour's farthest corner
        const rl = r0 << shift, rh = (r0 + B - 1) << shift;
        const gl0 = g0 << shift, gh = (g0 + B - 1) << shift;
        const bl = b0 << shift, bh = (b0 + B - 1) << shift;
        let bound = Infinity;
        for (let i = 0; i < n; i++) {
          const d = far(pal[i * 3], rl, rh) + far(pal[i * 3 + 1], gl0, gh) + far(pal[i * 3 + 2], bl, bh);
          if (d < bound) bound = d;
        }
        let k = 0;
        for (let i = 0; i < n; i++) {
          const dr = gap(pal[i * 3], rl, rh), dg = gap(pal[i * 3 + 1], gl0, gh), db = gap(pal[i * 3 + 2], bl, bh);
          if (dr * dr + dg * dg + db * db <= bound) cand[k++] = i;
        }
        for (let bz = b0; bz < b0 + B; bz++) {
          for (let gy = g0; gy < g0 + B; gy++) {
            for (let rx = r0; rx < r0 + B; rx++) {
              const R = rx << shift, G = gy << shift, Bv = bz << shift;
              let best = -1, bestFit = Infinity, ties = 0;
              for (let j = 0; j < k; j++) {
                const i = cand[j];
                const dr = R - pal[i * 3], dg = G - pal[i * 3 + 1], db = Bv - pal[i * 3 + 2];
                const fit = dr * dr + dg * dg + db * db;
                if (fit < bestFit) { best = i; bestFit = fit; ties = 1; } else if (fit === bestFit) ties++;
              }
              if (ties > 1) best = nearestPaletteIndex(tree, R, G, Bv)[0];   // a tie: the tree's own answer
              const o = ((bz * size + gy) * size + rx) * 4;
              out[o] = pal[best * 3]; out[o + 1] = pal[best * 3 + 1]; out[o + 2] = pal[best * 3 + 2]; out[o + 3] = 255;
            }
          }
        }
      }
    }
  }
  return { size, data: out };
}

/** The present pass's kind for a PostProcessingInRetroMode value. */
export function retroPostKind(post) {
  return {
    kind: post === 1 || post === 2 ? 1 : post === 3 || post === 4 ? 2 : 0,   // 1 posterize, 2 palettize
    noSky: post === 2 || post === 4,                                          // the "-sky" pair: EXCLUDE_SKY
  };
}

export const RETRO_VS = `#version 300 es
layout(location = 0) in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export const RETRO_FS = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler3D;
uniform sampler2D uColor;   // the world's retro image
uniform sampler2D uDepth;   // its depth - the far plane is the sky
uniform sampler3D uLut;     // the palette's LUT
uniform vec4 uRect;         // the world rect on the canvas, px, bottom-left
uniform vec2 uPresent;      // RetroPresentation's 640x400
uniform int uKind;          // 0 plain Blit, 1 posterize, 2 palettize
uniform int uNoSky;         // EXCLUDE_SKY
uniform int uLutSize;
out vec4 outColor;
void main() {
  // the screen pixel's presentation texel, and that texel's centre - two
  // Point blits (source -> 640x400 -> screen) in one fetch
  vec2 uv = (floor((gl_FragCoord.xy - uRect.xy) / uRect.zw * uPresent) + 0.5) / uPresent;
  vec4 c = texture(uColor, uv);
  outColor = c;
  if (uKind == 0) return;
  if (uNoSky == 1 && texture(uDepth, uv).r >= 1.0) return;   // "Sky untouched"
  if (uKind == 1) { outColor = vec4(floor(c.rgb * 15.0 + 0.5) / 15.0, c.a); return; }
  ivec3 v = ivec3(floor(c.rgb * 255.0 + 0.5));
  outColor = vec4(texelFetch(uLut, min(v * uLutSize / 255, ivec3(uLutSize - 1)), 0).rgb, c.a);
}
`;

/**
 * THE PASS. `build(vs, fs)` is the renderer's program builder (it
 * throws on a compile or link failure - the pass then presents with a
 * plain NEAREST blitFramebuffer, which needs no program, and says so
 * once: a retro world without its effect, never a black one).
 */
export class RetroPass {
  constructor(gl, { build }) {
    this.gl = gl;
    this._build = build;
    this.target = null;    // { fbo, tex, depth, w, h } - the world's retro image and its depth
    this.pending = false;  // a retro frame is bound and not yet presented
    this.lut = null;       // { tex, shift, size }
    this.failed = false;   // the program would not build: blit instead
    this.P = null;
  }

  /** The image for a W x H world, (re)allocated when the size changes.
   *  A DRAW path (it binds a framebuffer), reached from beginFrameTarget
   *  and resolveTarget alone. */
  _ensureTarget(W, H) {
    const gl = this.gl;
    if (this.target && this.target.w === W && this.target.h === H) return this.target;
    if (this.target) { gl.deleteTexture(this.target.tex); gl.deleteTexture(this.target.depth); gl.deleteFramebuffer(this.target.fbo); }
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);   // m_FilterMode 0: Point
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);   // m_WrapU 1: Clamp
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const depth = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, depth);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, W, H);   // m_DepthFormat 2 (24-bit); a texture, for EXCLUDE_SKY
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
    this.target = { fbo, tex, depth, w: W, h: H };
    return this.target;
  }

  /** The classic lane's frame: bind the image for the world pass and make
   *  it the frame target every pass restores to. Returns its fbo. */
  beginFrameTarget(W, H) {
    if (!(W > 0 && H > 0)) return null;
    const t = this._ensureTarget(W, H);
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, t.fbo);
    setFrameTarget(t.fbo);
    this.pending = true;
    return t.fbo;
  }

  /** The lane's frame: the image its resolve writes into instead of the
   *  canvas (AirPass.resolveTo). Leaves the caller's framebuffer bound. */
  resolveTarget(W, H, restoreFbo = null) {
    if (!(W > 0 && H > 0)) return null;
    const t = this._ensureTarget(W, H);
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, restoreFbo);
    this.pending = true;
    return { fbo: t.fbo, w: W, h: H };
  }

  _program() {
    if (this.P || this.failed) return this.P;
    const gl = this.gl;
    try {
      const p = this._build(RETRO_VS, RETRO_FS);
      const u = (n) => gl.getUniformLocation(p, n);
      this.P = { p, uColor: u('uColor'), uDepth: u('uDepth'), uLut: u('uLut'), uRect: u('uRect'), uPresent: u('uPresent'), uKind: u('uKind'), uNoSky: u('uNoSky'), uLutSize: u('uLutSize') };
      // every sampler on its own unit, set once - a sampler2D and the
      // sampler3D left sharing unit 0 is an INVALID_OPERATION per draw
      gl.useProgram(p);
      gl.uniform1i(this.P.uColor, 0);
      gl.uniform1i(this.P.uDepth, 1);
      gl.uniform1i(this.P.uLut, 2);
      gl.uniform2f(this.P.uPresent, RETRO_PRESENTATION[0], RETRO_PRESENTATION[1]);
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
      this.P.vao = vao;
    } catch (e) {
      this.failed = true;
      this.P = null;
      console.warn('[retro] the present program would not build - presenting without the effect:', e?.message ?? e);
    }
    return this.P;
  }

  /** The palette's LUT for a shift, built on the CPU and uploaded once
   *  per shift (an upload inside the present's draw path). */
  _lut(shift) {
    if (this.lut && this.lut.shift === shift) return this.lut;
    const gl = this.gl;
    const { size, data } = buildRetroLut(shift);
    if (this.lut) gl.deleteTexture(this.lut.tex);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, size, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);   // lut.filterMode = Point (:336)
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);   // lut.wrapMode = Clamp
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    return (this.lut = { tex, shift, size });
  }

  /**
   * PRESENT the image to the canvas. `rect` is the world rect in canvas
   * pixels, bottom-left ([x, y, w, h]); `depth` the depth texture the
   * frame wrote (this image's own, or the lane's frame's); `post`
   * PostProcessingInRetroMode after the toggle; `clear` the renderer's
   * clear-colour shadow, put back after the black clear. Leaves the
   * canvas bound, the viewport at the full canvas and the draw-state
   * baseline (depth test, depth writes and culling on, blending off).
   */
  present({ depth, rect, canvasW, canvasH, post = 0, lutShift = 1, clear = null }) {
    this.pending = false;
    const gl = this.gl, t = this.target;
    setFrameTarget(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvasW, canvasH);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (clear) gl.clearColor(clear[0], clear[1], clear[2], clear[3]);
    if (!t || !(rect[2] > 0) || !(rect[3] > 0)) return;
    const P = this._program();
    if (!P) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, t.fbo);
      gl.blitFramebuffer(0, 0, t.w, t.h, rect[0], rect[1], rect[0] + rect[2], rect[1] + rect[3], gl.COLOR_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      return;
    }
    const { kind, noSky } = retroPostKind(post);
    const lut = kind === 2 ? this._lut(lutShift) : null;
    gl.viewport(rect[0], rect[1], rect[2], rect[3]);
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    gl.useProgram(P.p);
    gl.bindVertexArray(P.vao);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t.tex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, depth ?? t.depth);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_3D, lut ? lut.tex : null);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform4f(P.uRect, rect[0], rect[1], rect[2], rect[3]);
    gl.uniform1i(P.uKind, kind);
    gl.uniform1i(P.uNoSky, noSky ? 1 : 0);
    gl.uniform1i(P.uLutSize, lut ? lut.size : 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_3D, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.viewport(0, 0, canvasW, canvasH);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
  }

  /** Drop the frame target without presenting (retro switched off mid-frame). */
  release() {
    if (this.pending) setFrameTarget(null);
    this.pending = false;
  }
}
