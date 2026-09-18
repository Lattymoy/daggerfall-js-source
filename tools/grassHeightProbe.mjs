// GRASS3 (2026-09-18): CAN A SHADER STAND A BLADE ON THE GROUND?
//
// The question a GPU-placed grass field turns on. Today every blade's
// root height is computed on the CPU and uploaded as an attribute; a
// derived field has no attributes at all, so a vertex shader has to
// work the height out from a heightmap TEXTURE - and if it cannot
// reproduce the drawn surface exactly, every blade floats or sinks and
// the whole approach is dead. This probe answers it on a real WebGL2
// context before anything is built on the assumption.
//
// It reports two numbers:
//
//   bilinearVsTriangle  how far the placer's old bilinear read sat from
//                       the drawn triangles. NOTE the terrain here is
//                       deliberately extreme (a 311% grade) to exercise
//                       the saddle term; on real grades of 7-75% the
//                       gap is 0.003 to 0.08 world units and no blade
//                       is off by a sixth of its height. The fix is
//                       correctness, not a rescue - see
//                       test/grass3_surface.test.js, which pins both.
//   shaderVsCpu         whether GLSL can match `surfaceHeightAt` - the
//                       law the mesh is actually built from, pinned
//                       against the real index buffer in
//                       test/grass3_surface.test.js.
//
//     node tools/grassHeightProbe.mjs
//
// The heightmap here is SYNTHETIC: this container has no ARENA2, so the
// probe builds terrain with deliberate saddles rather than pretending to
// read Daggerfall's. What it proves is the ARITHMETIC - the texture
// layout, the indexing convention and the float precision - which is
// exactly the part that does not depend on whose terrain it is.
import { createServer } from 'vite';
import { chromium } from 'playwright';
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const server = await createServer({ server: { port: 5301, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
await page.goto('http://localhost:5301/play/');
const out = await page.evaluate(async () => {
  const { HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, DEFAULT_TERRAIN_SCALE, TERRAIN_SIZE } = await import('/src/world/terrainSampler.js');
  const hDim = HEIGHTMAP_DIMENSION;                  // 129
  const cell = TERRAIN_SIZE / (hDim - 1);            // 6.4
  const worldH = MAX_TERRAIN_HEIGHT * DEFAULT_TERRAIN_SCALE;   // 2308.5

  // A synthetic heightmap with plausible rolling terrain PLUS deliberate
  // saddles, so the bilinear/triangle gap is exercised rather than hoped for.
  const data = new Float32Array(hDim * hDim);
  const h = (x, z) => 0.5
    + 0.020 * Math.sin(x * 0.11) * Math.cos(z * 0.09)
    + 0.008 * Math.sin(x * 0.37 + 1.3) * Math.sin(z * 0.41)
    + 0.003 * Math.sin((x + z) * 0.9);
  for (let x = 0; x < hDim; x++) for (let z = 0; z < hDim; z++) data[x * hDim + z] = h(x, z);

  const S = (x, z) => data[Math.max(0, Math.min(hDim - 1, x)) * hDim + Math.max(0, Math.min(hDim - 1, z))];
  // TODAY'S PLACER: bilinear (scenes/world.js keep())
  const bilinear = (lx, lz) => {
    const fx = lx / cell, fz = lz / cell;
    const x0 = Math.min(hDim - 2, Math.floor(fx)), z0 = Math.min(hDim - 2, Math.floor(fz));
    const ax = fx - x0, az = fz - z0;
    return ((S(x0, z0) * (1 - ax) + S(x0 + 1, z0) * ax) * (1 - az)
          + (S(x0, z0 + 1) * (1 - ax) + S(x0 + 1, z0 + 1) * ax) * az) * worldH;
  };
  // THE RENDERED SURFACE: two triangles a quad, diagonal (x,z)-(x+1,z+1),
  // matching buildTerrainIndices' i0,i2,i3 / i0,i3,i1.
  const triangle = (lx, lz) => {
    const fx = lx / cell, fz = lz / cell;
    const x0 = Math.min(hDim - 2, Math.floor(fx)), z0 = Math.min(hDim - 2, Math.floor(fz));
    const ax = fx - x0, az = fz - z0;
    const h00 = S(x0, z0), h10 = S(x0 + 1, z0), h01 = S(x0, z0 + 1), h11 = S(x0 + 1, z0 + 1);
    return (az >= ax ? h00 + az * (h01 - h00) + ax * (h11 - h01)
                     : h00 + ax * (h10 - h00) + az * (h11 - h10)) * worldH;
  };

  // sample points across one terrain pixel
  const pts = [];
  let s = 12345;
  const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  for (let i = 0; i < 20000; i++) pts.push([rnd() * (TERRAIN_SIZE - cell), rnd() * (TERRAIN_SIZE - cell)]);

  let maxGap = 0, sumGap = 0;
  for (const [x, z] of pts) { const g = Math.abs(bilinear(x, z) - triangle(x, z)); maxGap = Math.max(maxGap, g); sumGap += g; }

  // ---- THE GPU SIDE: can a shader reproduce `triangle` exactly? ----
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
  const gl = canvas.getContext('webgl2');
  if (!gl) return { error: 'no webgl2' };
  if (!gl.getExtension('EXT_color_buffer_float')) return { error: 'no float render target' };
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  // texel (x, z) IS data[x*hDim + z] - the port's own x-major order
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, hDim, hDim, 0, gl.RED, gl.FLOAT, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  const N = pts.length;
  const W = 256, H = Math.ceil(N / W);
  const ptBuf = new Float32Array(W * H * 2);
  for (let i = 0; i < N; i++) { ptBuf[i * 2] = pts[i][0]; ptBuf[i * 2 + 1] = pts[i][1]; }
  const ptTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, ptTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, W, H, 0, gl.RG, gl.FLOAT, ptBuf);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  const VS = `#version 300 es
in vec2 aP; void main(){ gl_Position = vec4(aP, 0.0, 1.0); }`;
  const FS = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D;
uniform sampler2D uH; uniform sampler2D uPts;
uniform float uCell, uWorldH; uniform int uDim, uW;
out vec4 o;
// THE RENDERED SURFACE, in the shader: the same two triangles a quad the
// terrain mesh is built from, diagonal (x,z)-(x+1,z+1).
float sampleH(int x, int z){
  int xi = clamp(x, 0, uDim - 1), zi = clamp(z, 0, uDim - 1);
  // TRANSPOSED ON PURPOSE. The port stores the heightmap x-MAJOR -
  // data[x * hDim + z] - and a texture is indexed row * width + col,
  // so the port's x index is the texture's ROW and its z is the COLUMN.
  // Fetching ivec2(x, z) reads data[z * hDim + x] instead, which is a
  // different point on the ground and was wrong by up to 79 units.
  return texelFetch(uH, ivec2(zi, xi), 0).r;
}
float terrainAt(vec2 l){
  vec2 f = l / uCell;
  int x0 = min(uDim - 2, int(floor(f.x))), z0 = min(uDim - 2, int(floor(f.y)));
  float ax = f.x - float(x0), az = f.y - float(z0);
  float h00 = sampleH(x0, z0), h10 = sampleH(x0 + 1, z0);
  float h01 = sampleH(x0, z0 + 1), h11 = sampleH(x0 + 1, z0 + 1);
  float h = az >= ax ? h00 + az * (h01 - h00) + ax * (h11 - h01)
                     : h00 + ax * (h10 - h00) + az * (h11 - h10);
  return h * uWorldH;
}
void main(){
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec2 l = texelFetch(uPts, p, 0).rg;
  o = vec4(terrainAt(l), 0.0, 0.0, 1.0);
}`;
  const mk = (t, src) => { const sh = gl.createShader(t); gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
  const prog = gl.createProgram();
  gl.attachShader(prog, mk(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, FS));
  gl.bindAttribLocation(prog, 0, 'aP'); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));

  const out = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, out);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, W, H, 0, gl.RED, gl.FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, out, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) return { error: 'fb incomplete' };

  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  gl.viewport(0, 0, W, H);
  gl.useProgram(prog);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.uniform1i(gl.getUniformLocation(prog, 'uH'), 0);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, ptTex);
  gl.uniform1i(gl.getUniformLocation(prog, 'uPts'), 1);
  gl.uniform1f(gl.getUniformLocation(prog, 'uCell'), cell);
  gl.uniform1f(gl.getUniformLocation(prog, 'uWorldH'), worldH);
  gl.uniform1i(gl.getUniformLocation(prog, 'uDim'), hDim);
  gl.uniform1i(gl.getUniformLocation(prog, 'uW'), W);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  const px = new Float32Array(W * H);
  gl.readPixels(0, 0, W, H, gl.RED, gl.FLOAT, px);

  let maxErr = 0, sumErr = 0, worst = null;
  for (let i = 0; i < N; i++) {
    const want = triangle(pts[i][0], pts[i][1]);
    const got = px[i];
    const e = Math.abs(want - got);
    if (e > maxErr) { maxErr = e; worst = { p: pts[i], want, got }; }
    sumErr += e;
  }
  return {
    worldH, cell, hDim, n: N,
    bilinearVsTriangle: { max: maxGap, mean: sumGap / N },
    shaderVsCpu: { max: maxErr, mean: sumErr / N, worst },
    glError: gl.getError(),
  };
});
await browser.close();
await server.close();

if (out.error) { console.log('FAIL', out.error); process.exit(1); }
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); };
const BLADE = 0.5;   // a mid blade at the port's height of 38, in world units

console.log(`  heightmap ${out.hDim}x${out.hDim}, quad ${out.cell}u, full height ${out.worldH}u, ${out.n} points`);
console.log(`  bilinear against the drawn mesh: max ${out.bilinearVsTriangle.max.toFixed(2)}u, mean ${out.bilinearVsTriangle.mean.toFixed(3)}u`);
console.log(`  the shader against surfaceHeightAt: max ${out.shaderVsCpu.max.toExponential(2)}u, mean ${out.shaderVsCpu.mean.toExponential(2)}u`);

check('no GL error', out.glError === 0, String(out.glError));
// THE ANSWER. Float32 rounding, and nothing else: a blade is 0.25..0.72
// world units tall, so an error this size is a thousandth of a blade.
check('a shader CAN stand a blade on the drawn ground - the height law reproduces exactly',
  out.shaderVsCpu.max < BLADE / 100, `${out.shaderVsCpu.max.toExponential(2)}u against a blade of ${BLADE}u`);
check('...and it is float rounding rather than a near miss', out.shaderVsCpu.max < 1e-3);
// THE BUG THAT WAS ALREADY THERE. Bilinear is a different surface from
// the triangles the terrain is drawn as, and on ground with any saddle
// in it the gap is a real fraction of a blade.
// ON THIS CLIFF the two surfaces are a blade apart - which is what
// makes them provably different surfaces rather than two spellings of
// one. It is NOT a claim about what a player would have seen: the same
// measurement on real grades is in the pins, and it is a fraction of a
// blade.
check('bilinear and the drawn triangles are genuinely different surfaces (on terrain chosen to show it)',
  out.bilinearVsTriangle.max > BLADE, `up to ${out.bilinearVsTriangle.max.toFixed(2)}u apart at a 311% grade; on real grades it is under 0.08u`);

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
