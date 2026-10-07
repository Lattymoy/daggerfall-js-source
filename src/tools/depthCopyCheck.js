// CACHE-COPY (2026-10-07, Mac: "Ive noticed certain nivida cards have the issue. Like rapid flickering, epileptic
// inducing"): THE SHADOW CACHE'S COPY, CHECKED ON THIS MACHINE'S GPU - with no flickering frame on screen.
//
// SC1's static cache reached the live shadow layers by a depth BLIT out of a layer of one DEPTH_COMPONENT24 array into a
// layer of another. On Direct3D 11 (ANGLE - every browser on Windows) that blit reads the layer through a view its
// shader does not declare, and what comes back is the driver's (bible/07-Rendering/Enhanced-Lighting-Arc.md CACHE-COPY).
// This fills a cache-shaped array with a known depth in every texel of every layer, copies it into a live-shaped one
// both ways - the old blit, and CACHE-COPY's draw with shadowPass.js's own DEPTH_COPY_VS / DEPTH_COPY_FS - and reads
// every texel back. Round after round, a new pattern each time: a read that is merely wrong and one that changes from
// frame to frame (the strobe) are both caught. And a CONTROL every round - the draw copy aimed one layer off on purpose -
// which the check must find wrong in every texel, as another layer's value: a check that cannot see a wrong copy proves
// nothing by finding none. tools/fixtures/depth-copy-check.html shows the answer; tools/depthCopyProbe.mjs runs it headless.
import { DEPTH_COPY_VS, DEPTH_COPY_FS } from '../render/shadowPass.js';

/** The known depth: a value per texel, layer and round, every one a whole step of 1/4096 (24-bit depth holds it to
 *  a 4096th of a step) - two layers' values differ by thousands of 24-bit units, so a texel copied from another layer
 *  is told from a wrong one. */
export const PATTERN_GLSL = `int patternOf(ivec2 p, int layer, int round) { return (p.x * 7 + p.y * 13 + layer * 31 + round * 101) % 4093; }`;
/** @param {number} x @param {number} y @param {number} layer @param {number} round */
export const patternOf = (x, y, layer, round) => (x * 7 + y * 13 + layer * 31 + round * 101) % 4093;
/** The 24-bit depth a pattern value is stored as. */
export const unitsOf = (v) => Math.round(((v + 1) / 4096) * 16777215);
/** The 24-bit depth a clear to 1 leaves - a layer the copy never wrote. */
export const CLEARED = 16777215;

const FILL_FS = `#version 300 es
precision highp float;
precision highp int;
uniform int uLayer;
uniform int uRound;
${PATTERN_GLSL}
void main() {
  gl_FragDepth = float(patternOf(ivec2(gl_FragCoord.xy), uLayer, uRound) + 1) / 4096.0;
}`;
/** Reads layer uLayer of a depth array back as its 24 bits, one byte a channel. */
const READ_FS = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2DArray;
uniform sampler2DArray uTex;
uniform int uLayer;
out vec4 outColor;
void main() {
  float d = texelFetch(uTex, ivec3(gl_FragCoord.xy, uLayer), 0).r;
  uint u = uint(clamp(d, 0.0, 1.0) * 16777215.0 + 0.5);
  outColor = vec4(float((u >> 16) & 255u), float((u >> 8) & 255u), float(u & 255u), 255.0) / 255.0;
}`;

/** @param {WebGL2RenderingContext} gl @param {string} vs @param {string} fs */
function program(gl, vs, fs) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(type);
    if (!s || !p) throw new Error('no shader');
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`compile: ${gl.getShaderInfoLog(s)}`);
    gl.attachShader(p, s);
  }
  if (!p) throw new Error('no program');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`link: ${gl.getProgramInfoLog(p)}`);
  return p;
}

/** A DEPTH_COMPONENT24 array, as shadowPass.js makes them - the cache's NEAREST, the live layers' LINEAR and compared -
 *  and a depth-only framebuffer a layer.
 *  @param {WebGL2RenderingContext} gl @param {number} size @param {number} layers @param {boolean} live */
function depthArray(gl, size, layers, live) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
  gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.DEPTH_COMPONENT24, size, size, layers);
  const filter = live ? gl.LINEAR : gl.NEAREST;
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, filter);
  if (live) {
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
  }
  const fbos = [];
  for (let l = 0; l < layers; l++) {
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, tex, 0, l);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    fbos.push(fbo);
  }
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
  return { tex, fbos };
}

/**
 * Copy a known depth both ways and read every texel back.
 * @param {WebGL2RenderingContext} gl
 * @param {{ size?: number, layers?: number, rounds?: number }} [opts] the cache's shape: shadowPass.js's is 512 square
 *   and 72 layers (twelve lamps of six faces); a smaller square reads back faster and the view is no different
 */
export function runDepthCopyCheck(gl, { size = 128, layers = 72, rounds = 4 } = {}) {
  const fill = program(gl, DEPTH_COPY_VS, FILL_FS);
  const copy = program(gl, DEPTH_COPY_VS, DEPTH_COPY_FS);
  const read = program(gl, DEPTH_COPY_VS, READ_FS);
  const src = depthArray(gl, size, layers, false), dst = depthArray(gl, size, layers, true);
  const vao = gl.createVertexArray();
  const colour = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, colour);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, size, size);
  gl.bindTexture(gl.TEXTURE_2D, null);
  const readFbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, readFbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colour, 0);
  const px = new Uint8Array(size * size * 4);
  gl.bindVertexArray(vao);
  gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND); gl.disable(gl.SCISSOR_TEST);
  gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
  const loc = (p, n) => gl.getUniformLocation(p, n);
  const clearDst = () => {
    gl.colorMask(false, false, false, false); gl.clearDepth(1);
    for (const fbo of dst.fbos) { gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.viewport(0, 0, size, size); gl.clear(gl.DEPTH_BUFFER_BIT); }
  };
  const fillSrc = (round) => {
    gl.useProgram(fill); gl.colorMask(false, false, false, false); gl.depthFunc(gl.ALWAYS);
    gl.uniform1i(loc(fill, 'uRound'), round);
    for (let l = 0; l < layers; l++) { gl.bindFramebuffer(gl.FRAMEBUFFER, src.fbos[l]); gl.viewport(0, 0, size, size); gl.uniform1i(loc(fill, 'uLayer'), l); gl.drawArrays(gl.TRIANGLES, 0, 3); }
  };
  const byBlit = () => {
    for (let l = 0; l < layers; l++) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, src.fbos[l]);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dst.fbos[l]);
      gl.blitFramebuffer(0, 0, size, size, 0, 0, size, size, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
    }
  };
  const byDraw = (shift = 0) => {   // render/shadowPass.js _blitSlot, face by face; `shift` the control's wrong layer
    gl.useProgram(copy); gl.colorMask(false, false, false, false); gl.depthFunc(gl.ALWAYS);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, src.tex);
    gl.uniform1i(loc(copy, 'uCache'), 0);
    for (let l = 0; l < layers; l++) { gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbos[l]); gl.viewport(0, 0, size, size); gl.uniform1i(loc(copy, 'uLayer'), (l + shift) % layers); gl.drawArrays(gl.TRIANGLES, 0, 3); }
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
  };
  /** Every texel of every layer of the live array against the round's pattern: wrong ones counted, and told apart -
   *  another layer's value, the clear's (never written), or neither. */
  const check = (round) => {
    // a shadow sampler reads a comparison, not a depth: the live array is read raw, NEAREST (a depth texture is no
    // linear-filterable format without its compare), then put back as shadowPass.js keeps it
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, dst.tex);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_COMPARE_MODE, gl.NONE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.useProgram(read); gl.colorMask(true, true, true, true); gl.disable(gl.DEPTH_TEST);
    gl.uniform1i(loc(read, 'uTex'), 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, readFbo); gl.viewport(0, 0, size, size);
    const r = { wrong: 0, otherLayer: 0, cleared: 0, other: 0, firstWrong: null };   // firstWrong: { layer, x, y, got, want } of the first wrong texel
    const near = (a, b) => Math.abs(a - b) <= 2;   // a unorm through a float and back, rounded either way
    for (let l = 0; l < layers; l++) {
      gl.uniform1i(loc(read, 'uLayer'), l);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, px);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4, got = px[i] * 65536 + px[i + 1] * 256 + px[i + 2];
        const want = unitsOf(patternOf(x, y, l, round));
        if (near(got, want)) continue;
        r.wrong++;
        if (!r.firstWrong) r.firstWrong = { layer: l, x, y, got, want };
        if (near(got, CLEARED)) { r.cleared++; continue; }
        let other = false;
        for (let k = 0; k < layers && !other; k++) if (k !== l && near(got, unitsOf(patternOf(x, y, k, round)))) other = true;
        if (other) r.otherLayer++; else r.other++;
      }
    }
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
    gl.enable(gl.DEPTH_TEST);
    return r;
  };
  const blit = [], draw = [], control = [];
  for (let round = 0; round < rounds; round++) {
    fillSrc(round);
    clearDst(); byBlit(); blit.push(check(round));
    clearDst(); byDraw(); draw.push(check(round));
    clearDst(); byDraw(1); control.push(check(round));
  }
  gl.depthFunc(gl.LESS); gl.colorMask(true, true, true, true);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.bindVertexArray(null);
  for (const t of [src.tex, dst.tex, colour]) gl.deleteTexture(t);
  for (const f of [...src.fbos, ...dst.fbos, readFbo]) gl.deleteFramebuffer(f);
  gl.deleteVertexArray(vao);
  for (const p of [fill, copy, read]) gl.deleteProgram(p);
  const total = size * size * layers;
  const sum = (rs, k) => rs.reduce((n, r) => n + r[k], 0);
  return {
    size, layers, rounds, texels: total * rounds, error: gl.getError(),
    blit: { wrong: sum(blit, 'wrong'), otherLayer: sum(blit, 'otherLayer'), cleared: sum(blit, 'cleared'), other: sum(blit, 'other'), byRound: blit.map((r) => r.wrong), firstWrong: blit.find((r) => r.firstWrong)?.firstWrong ?? null },
    draw: { wrong: sum(draw, 'wrong'), otherLayer: sum(draw, 'otherLayer'), cleared: sum(draw, 'cleared'), other: sum(draw, 'other'), byRound: draw.map((r) => r.wrong), firstWrong: draw.find((r) => r.firstWrong)?.firstWrong ?? null },
    control: { wrong: sum(control, 'wrong'), otherLayer: sum(control, 'otherLayer') },
  };
}

/** The verdict a result reads as, in a sentence - a blind check first, then a wrong DRAW copy, whatever else is wrong.
 *  @param {{ error: number, texels: number, blit: { wrong: number, byRound: number[] }, draw: { wrong: number }, control: { wrong: number, otherLayer: number } }} r */
export function verdictOf(r) {
  if (r.error) return `GL error ${r.error}: the check did not run cleanly - report this page's text.`;
  if (r.control.wrong !== r.texels || r.control.otherLayer !== r.texels) return `THE CHECK COULD NOT SEE A WRONG COPY here (its control: ${r.control.wrong} of ${r.texels} found wrong) - its other numbers mean nothing; report this page's text.`;
  if (r.draw.wrong) return `THE DRAW COPY CAME BACK WRONG HERE (${r.draw.wrong} of ${r.texels} texels). CACHE-COPY is not safe on this machine - report this page's text.`;
  if (r.blit.wrong) return `The old blit is broken on this GPU (${r.blit.wrong} of ${r.texels} texels wrong${new Set(r.blit.byRound).size > 1 ? ', a different count every round - the strobe' : ''}) and the draw copy is exact: CACHE-COPY fixes this machine.`;
  return 'Both copies exact on this GPU: its driver reads the blit right (or its browser does not run ANGLE over Direct3D 11), and the draw copy is exact too.';
}
