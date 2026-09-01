// ═══════════════════════════════════════════════════════════════════
// THE GAME'S RENDER GATE.
//
// AUDIT 46: a black world shipped, and every gate said pass. The lab's
// render gate loads grass-proto.html, which needs no game data - the
// GAME page needs ARENA2 and so was never gated at all. That gap is
// what let EE8's fault through: an unsized texture format made
// generateMipmap fail, the sampler was mipmap-incomplete, and an
// incomplete sampler returns BLACK for every tile. Nothing in eslint,
// the node suite or a vite build can see a GL state error, because
// none of them has a GL context.
//
// This runs the renderer's REAL upload path against a real WebGL2
// context and fails on:
//   - a GL error raised by any upload, in either ground mode;
//   - a program that did not link;
//   - a texture that came back null.
//
// It needs no game data: the layers are synthetic, because the fault
// class here is about FORMATS and COMPLETENESS, which do not care what
// the pixels are.
//
//   node tools/glGate.mjs
//
// Requires the dev server:  (setsid npx vite --port 5199 &)
import { chromium } from 'playwright';

const URL = process.argv.includes('--url')
  ? process.argv[process.argv.indexOf('--url') + 1]
  : 'http://127.0.0.1:5199/sky.html';   // AUDIT 47: a LIGHT page - the lab at a million blades starves the probe under a software rasteriser

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await (await browser.newContext({ ignoreHTTPSErrors: true })).newPage();
const fails = [];
page.on('pageerror', (e) => fails.push(`pageerror: ${e.message}`));
page.setDefaultTimeout(120000);
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);

const result = await page.evaluate(async () => {
  const out = [];
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 64;
  const { Renderer } = await import('/src/render/renderer.js');
  let r;
  try { r = new Renderer(canvas); } catch (e) { return [`Renderer failed to construct: ${e.message}`]; }
  const gl = r.gl;
  // drain anything the constructor left, so what follows is ours
  while (gl.getError() !== gl.NO_ERROR) { /* drain */ }

  const layer = (n) => {
    const c = new Uint8ClampedArray(64 * 64 * 4);
    for (let k = 0; k < 64 * 64; k++) {
      c[k * 4] = (n * 37) & 255; c[k * 4 + 1] = (n * 91) & 255;
      c[k * 4 + 2] = (n * 143) & 255; c[k * 4 + 3] = 255;
    }
    return { width: 64, height: 64, colors: c };
  };
  const layers = Array.from({ length: 56 }, (_, i) => layer(i));

  for (const enhanced of [false, true]) {
    r.enhancedGround = enhanced;
    const label = enhanced ? 'enhanced' : 'classic';
    let tex = null;
    try { tex = r.uploadTileArray(`gate-${label}`, layers); } catch (e) {
      out.push(`${label}: uploadTileArray threw: ${e.message}`); continue;
    }
    if (!tex) out.push(`${label}: no texture came back`);
    const err = gl.getError();
    if (err !== gl.NO_ERROR) out.push(`${label}: GL error 0x${err.toString(16)} after upload`);
    // AUDIT 47: COMPLETENESS IS PROVED BY DRAWING, not by asking. The
    // first cut re-called generateMipmap and read the error - which
    // succeeds even when the SAMPLER is incomplete, so it proved
    // nothing. A texture that samples black is only visible if you
    // sample it, so the gate now draws a quad through the array with
    // the filters the upload chose and reads the pixel back. Black is
    // the failure, and black is exactly what the player reported.
    const vs = `#version 300 es
layout(location=0) in vec2 aP; out vec2 vUV;
void main(){ vUV = aP * 0.5 + 0.5; gl_Position = vec4(aP, 0.0, 1.0); }`;
    const fs = `#version 300 es
precision highp float; precision highp sampler2DArray;
in vec2 vUV; uniform sampler2DArray uArr; out vec4 o;
void main(){ o = vec4(texture(uArr, vec3(vUV, 3.0)).rgb, 1.0); }`;
    const mk = (t, src2) => { const sh = gl.createShader(t); gl.shaderSource(sh, src2); gl.compileShader(sh); return sh; };
    const prog = gl.createProgram();
    gl.attachShader(prog, mk(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { out.push(`${label}: probe program: ${gl.getProgramInfoLog(prog)}`); continue; }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
    gl.clearColor(1, 0, 1, 1); gl.clear(gl.COLOR_BUFFER_BIT);   // magenta, so "did not draw" is not "black"
    gl.useProgram(prog);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
    gl.uniform1i(gl.getUniformLocation(prog, 'uArr'), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
    const px = new Uint8Array(4);
    gl.readPixels(gl.drawingBufferWidth >> 1, gl.drawingBufferHeight >> 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const drawErr = gl.getError();
    if (drawErr !== gl.NO_ERROR) out.push(`${label}: GL error 0x${drawErr.toString(16)} sampling the array`);
    if (px[0] === 255 && px[1] === 0 && px[2] === 255) out.push(`${label}: the probe never drew`);
    else if (px[0] + px[1] + px[2] === 0) out.push(`${label}: THE ARRAY SAMPLES BLACK - this is the void`);
    out.push(`ok ${label}: sampled ${px[0]},${px[1]},${px[2]}`);
  }
  return out;
});

await browser.close();
for (const f of [...fails, ...result]) { if (f.startsWith('ok ')) { console.log(f); continue; } console.error(`GL GATE FAIL: ${f}`); process.exitCode = 1; }
if (!process.exitCode) console.log('gl gate ok - both ground modes upload clean and complete');
