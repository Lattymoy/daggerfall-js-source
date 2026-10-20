// NODE-OUTLINE - A GATHERING NODE'S OUTLINE, COMPILED, LINKED AND DRAWN IN A REAL BROWSER.
//
// node holds the outline's law (test/scenes/nodeoutline.test.js: who is ringed and how, the pictures the host hands it, the
// rectangles, the pass over a fake GL); what node cannot answer is whether the two programs - the mask's (the billboard
// program's own vertex stage, the node's rectangle stretched over its tile of a depth-only atlas) and the ring's -
// COMPILE and LINK in a real WebGL2 context, and whether what they draw is the outline they say: a ring of the
// profession's colour just outside the picture's own cut silhouette and never over it (a 3D tree's crossed cards ring
// nothing over each other), a couple of pixels wide, one flat of a batch and not its neighbour, a 3D tree ringed through
// the door's own buffers, hidden by a wall in front, one even ring, and the frame's target and GL baseline handed back.
// So: the repo's own modules served as they are (no bundler), a floor, the node's own picture drawn by a stand-in of the
// billboard placement (depth written, cut at a half), the pass drawn by its own class over them, and the frame read back.
//
//     node tools/nodeOutlineProbe.mjs [--shots <dir>]     (writes node_outline.png there when given)
import { chromium } from 'playwright';
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const shotsAt = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
const out = []; const check = (n, ok, d = '') => { out.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${d ? ` - ${d}` : ''}`); };

const PAGE = `<!doctype html><html><body style="margin:0;background:#000"><canvas id=c width=640 height=480></canvas><script type=module>
import { NodeOutlineRenderer, outlinePx } from '/src/render/nodeOutline.js';
import { nodeMarkRgb } from '/src/ui/nodeMarks.js';
const W = 640, H = 480;
const gl = document.getElementById('c').getContext('webgl2', { alpha: false, preserveDrawingBuffer: true, antialias: false });
const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
const prog = (vs, fs) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); return p; };
// the floor and the wall: flat colour
const flat = prog(\`#version 300 es
layout(location=0) in vec3 p; uniform mat4 vp; void main(){ gl_Position = vp * vec4(p, 1.0); }\`, \`#version 300 es
precision highp float; uniform vec3 c; out vec4 o; void main(){ o = vec4(c, 1.0); }\`);
// THE NODE'S OWN PICTURE, as the world draws it: a flat placed by the billboard law (renderer.js BB_VS - the centre, the
// basis, the size, its foot at its base) and a 3D tree turned and scaled at its root; cut at a half, depth written
const own = prog(\`#version 300 es
layout(location=0) in vec3 aCenter; layout(location=1) in vec2 aCorner;
uniform mat4 vp; uniform vec3 uRight; uniform vec2 uSize; uniform vec4 uInst; uniform float uMesh; out vec2 vUV;
void main(){
  vec3 w = aCenter + uRight * (aCorner.x * uSize.x) + vec3(0.0, (aCorner.y + 0.5) * uSize.y, 0.0);
  vUV = aCorner + 0.5;
  if (uMesh > 0.5) { float c = cos(uInst.w), s = sin(uInst.w); w = vec3(c * aCenter.x + s * aCenter.z, aCenter.y, -s * aCenter.x + c * aCenter.z) + uInst.xyz; vUV = aCorner; }
  gl_Position = vp * vec4(w, 1.0);
}\`, \`#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D t; out vec4 o;
void main(){ vec4 c = texture(t, vUV); if (c.a < 0.5) discard; o = vec4(0.25, 0.55, 0.2, 1.0); }\`);
const vao = (data, layout, idx) => { const v = gl.createVertexArray(); gl.bindVertexArray(v); const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW); for (const [loc, n, stride, off] of layout) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, stride, off); } let ib = null; if (idx) { ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx), gl.STATIC_DRAW); } gl.bindVertexArray(null); return { v, b, ib, n: data.length / 3 }; };
const quad = (a, b, c, d) => [...a, ...b, ...c, ...a, ...c, ...d];
const floor = vao(quad([-20, 0, -20], [20, 0, -20], [20, 0, 20], [-20, 0, 20]), [[0, 3, 12, 0]]);
const wall = vao(quad([0.15, 0, 2.6], [2.8, 0, 2.6], [2.8, 2.5, 2.6], [0.15, 2.5, 2.6]), [[0, 3, 12, 0]]);   // the tree wholly behind it, the herb wholly beside it
// the sprite: a disc on a clear square (every texel 0 or 255, as a classic record's)
const S = 32, px = new Uint8Array(S * S * 4);
for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const i = (y * S + x) * 4, inside = Math.hypot(x + 0.5 - S / 2, y + 0.5 - S / 2) < S * 0.42; px[i] = 90; px[i + 1] = 160; px[i + 2] = 60; px[i + 3] = inside ? 255 : 0; }
const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, S, S, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
// A BATCH OF TWO FLATS, the renderer's own layout (createBillboardBatch: [centre xyz, corner xy], six indices a flat):
// flat 0 at x -1.6 (not the node), flat 1 at x -0.4 (the herb)
const CORNERS = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
const centers = [[-1.6, 0, 0], [-0.4, 0, 0]], bv = [], bi = [];
centers.forEach((c, f) => { for (const k of CORNERS) bv.push(...c, ...k); const b = f * 4; bi.push(b, b + 2, b + 1, b, b + 3, b + 2); });
const batchVao = vao(bv, [[0, 3, 20, 0], [1, 2, 20, 12]], bi);
const batch = { archive: 500, record: 9, frame: null, vao: batchVao.v, _ibOff: 0, size: { w: 1, h: 1 }, origin: null, sway: 0 };
// A 3D TREE, the door's own layout (lowPolyTreesRender.js: f32 x 8 - position, normal, uv - and u32 indices): two crossed
// cards 1.6 across and 2 up about its root, at x +1.4
const tv = [], ti = [];
const card = (ax, az) => { const o = tv.length / 8; for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) tv.push((u - 0.5) * 1.6 * ax, v * 2.0, (u - 0.5) * 1.6 * az, 0, 0, 1, u, v); ti.push(o, o + 1, o + 2, o, o + 2, o + 3); };
card(1, 0); card(0, 1);
const treeVao = vao(tv, [[0, 3, 32, 0], [2, 3, 32, 12], [1, 2, 32, 24]], ti);
const gpu = { vb: treeVao.b, ib: treeVao.ib };
const handle = { proto: 'a tree' }, root = [1.4, 0, 0];
const tset = { trees: new Float32Array([0, ...root, 1, 0.35]), centers: [root], handles: [handle], ox: 0, oy: 0, oz: 0 };
const frame = { eye: [0, 0, 0], radius: 140, band: 20, gpu, cut: new Set([handle]), runs: [{ run: { handle }, scale: [1, 1, 1], size: [1.6, 2], sway: 0, subs: [{ offset: 0, count: ti.length, tex, alpha: 1, color: [1, 1, 1], cull: 0 }] }] };
let pass = null, err = null;
try { pass = new NodeOutlineRenderer(gl); } catch (e) { err = String(e.message ?? e); }
const persp = (f, a, n, fa) => { const t = 1 / Math.tan(f / 2); return new Float32Array([t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0]); };
const look = (e, c) => { const u = [0, 1, 0]; const z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]]; let l = Math.hypot(...z); z.forEach((v, i) => { z[i] = v / l; }); const x = [u[1] * z[2] - u[2] * z[1], u[2] * z[0] - u[0] * z[2], u[0] * z[1] - u[1] * z[0]]; l = Math.hypot(...x); x.forEach((v, i) => { x[i] = v / l; }); const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]]; return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]), -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]), -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]), 1]); };
const mul = (a, b) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
window.probe = { err, linked: pass ? gl.getProgramParameter(pass.mask, gl.LINK_STATUS) && gl.getProgramParameter(pass.ring, gl.LINK_STATUS) : false, atlas: pass ? (gl.bindFramebuffer(gl.FRAMEBUFFER, pass.fb), gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE) : false, ringPx: outlinePx(H), orchid: nodeMarkRgb('herbalism'), sap: nodeMarkRgb('logging') };
gl.bindFramebuffer(gl.FRAMEBUFFER, null);   // the atlas's status asked: the canvas back
/** The floor, the node's own pictures (and \`walled\` the wall), then (\`ring\`) the pass over them at \`alpha\`; the whole
 *  frame read back, row 0 at the bottom, with the pass's count and the GL state it left. */
window.draw = ({ walled = false, ring = true, alpha = 1, lpt = true } = {}) => {
  const eye = [0, 1.0, 5.5], proj = persp(0.9, W / H, 0.05, 100), view = look(eye, [0, 0.8, 0]), vp = mul(proj, view);
  const right = new Float32Array([view[0], view[4], view[8]]);
  gl.viewport(0, 0, W, H);
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE);
  gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.disable(gl.CULL_FACE);
  gl.useProgram(flat); gl.uniformMatrix4fv(gl.getUniformLocation(flat, 'vp'), false, vp);
  gl.uniform3f(gl.getUniformLocation(flat, 'c'), 0.1, 0.09, 0.08); gl.bindVertexArray(floor.v); gl.drawArrays(gl.TRIANGLES, 0, floor.n);
  gl.useProgram(own); gl.uniformMatrix4fv(gl.getUniformLocation(own, 'vp'), false, vp); gl.uniform3fv(gl.getUniformLocation(own, 'uRight'), right);
  gl.uniform2f(gl.getUniformLocation(own, 'uSize'), 1, 1); gl.uniform1f(gl.getUniformLocation(own, 'uMesh'), 0); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.bindVertexArray(batchVao.v); gl.drawElements(gl.TRIANGLES, 12, gl.UNSIGNED_INT, 0);
  gl.uniform1f(gl.getUniformLocation(own, 'uMesh'), 1); gl.uniform4f(gl.getUniformLocation(own, 'uInst'), root[0], root[1], root[2], 0.35);
  gl.bindVertexArray(treeVao.v); gl.drawElements(gl.TRIANGLES, ti.length, gl.UNSIGNED_INT, 0);
  if (walled) { gl.useProgram(flat); gl.uniform3f(gl.getUniformLocation(flat, 'c'), 0.12, 0.12, 0.12); gl.bindVertexArray(wall.v); gl.drawArrays(gl.TRIANGLES, 0, wall.n); }
  gl.bindVertexArray(null);
  gl.enable(gl.CULL_FACE);
  let drawn = 0, trees = 0;
  if (ring) {
    frame.eye = eye;
    const r = { gl, _proj: proj, _view: view, _camPos: new Float32Array(eye), _bbRight: right, _bbUp: new Float32Array([0, 1, 0]), _fogMode: 0, _fogDensity: 0, _haze: new Float32Array(8),
      _fogRange: new Float32Array([0, 1]), textures: new Map([['500_9', tex]]), lptDrawnFrames: () => (lpt ? [frame, null] : []) };
    drawn = pass.draw([
      { alpha, rgb: nodeMarkRgb('herbalism'), mark: { pictures: [{ batch, first: 1, count: 1, centers: [centers[1]] }] } },
      { alpha, rgb: nodeMarkRgb('logging'), mark: { pictures: [{ batch: { ...batch, vao: null }, first: 0, count: 0, center: root, entry: { lowPolyTrees: tset } }] } },
    ], r, 0, false);
    trees = pass.trees;
  }
  const state = { depthFunc: gl.getParameter(gl.DEPTH_FUNC) === gl.LESS, depthMask: gl.getParameter(gl.DEPTH_WRITEMASK) === true, blend: gl.isEnabled(gl.BLEND), cull: gl.isEnabled(gl.CULL_FACE) };
  const pix = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, pix);
  return { error: gl.getError(), drawn, trees, state, pix: Array.from(pix) };
};
window.ready = true;
</script></body></html>`;

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/probe/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE); return; }
  const f = join(ROOT, url);
  if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': extname(f) === '.js' ? 'text/javascript' : extname(f) === '.json' ? 'application/json' : 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const W = 640, H = 480;
try {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/probe/`);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 }).catch((e) => { throw new Error(`the page never stood: ${errs.join('; ') || e.message}`); });
  const p = await page.evaluate(() => window.probe);
  check('the pass builds', !p.err, p.err ?? '');
  check('its programs link in a real WebGL2', p.linked === true);
  check('its depth atlas is a complete framebuffer', p.atlas === true);
  const bare = await page.evaluate(() => window.draw({ ring: false }));
  const lit = await page.evaluate(() => window.draw());
  if (shotsAt) await page.locator('#c').screenshot({ path: join(shotsAt, 'node_outline.png') });
  check('no GL error drawing it; both nodes ringed, one as its 3D tree', lit.error === 0 && lit.drawn === 2 && lit.trees === 1, `error ${lit.error}, drawn ${lit.drawn}, trees ${lit.trees}`);
  check('the GL baseline handed back: depth LESS and written, blend off, faces culled', lit.state.depthFunc && lit.state.depthMask && !lit.state.blend && lit.state.cull, JSON.stringify(lit.state));
  // the frame read as masks: what the pass changed, the pictures' own pixels (the stand-ins' green), by column halves
  const at = (a, x, y) => { const i = (y * W + x) * 4; return [a[i], a[i + 1], a[i + 2]]; };
  const changed = (x, y) => { const a = at(bare.pix, x, y), b = at(lit.pix, x, y); return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) > 30; };
  const isPicture = (x, y) => { const c = at(bare.pix, x, y); return c[1] > 100 && c[1] > c[0] + 40; };
  const near = (x, y, r, f) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && f(xx, yy)) return true; } return false; };
  const reach = Math.ceil(p.ringPx) + 1;
  let ring = 0, overPicture = 0, far = 0, flat0 = 0, flat1 = 0, tree = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!changed(x, y)) continue;
    ring++;
    if (isPicture(x, y)) { overPicture++; if (process.env.DEBUG) console.log('over the picture at', x, y, at(bare.pix, x, y), at(lit.pix, x, y)); }
    if (!near(x, y, reach, isPicture)) far++;
    if (x < W * 0.33) flat0++; else if (x < W * 0.56) flat1++; else tree++;   // the herb reaches past the middle; the tree starts past 0.56
  }
  check('a ring stands round the herb and round the tree', flat1 > 40 && tree > 60, `herb ${flat1} px, tree ${tree} px`);
  // a pixel or two where the stand-in's own program and the mask's rasterise one sliver of an edge apart is rounding; the
  // shifted copies' 18% (a 3D tree's front cards ringed over its back ones) and the unsnapped tile's 6% are not
  check('never over the picture itself (its silhouette\'s mask, not its depth)', overPicture <= ring * 0.005, `${overPicture} of ${ring}`);
  check(`within ${reach} px of the picture: an outline, not a halo`, far === 0, `${far} of ${ring} past it`);
  check('one flat of the batch: its neighbour (flat 0) unringed', flat0 === 0, `${flat0} px`);
  // the ring's colour: Herbalism's orchid over the herb, Logging's sap green over the tree, nearly whole
  let orchid = null, sap = null;
  for (let y = 0; y < H && (!orchid || !sap); y++) for (let x = 0; x < W; x++) {
    if (!changed(x, y)) continue;
    if (!orchid && x >= W * 0.33 && x < W * 0.56) orchid = at(lit.pix, x, y);
    if (!sap && x >= W * 0.56) sap = at(lit.pix, x, y);
  }
  const near255 = (c, rgb) => c && c.every((v, i) => Math.abs(v - rgb[i] * 255) < 26);
  check('in Herbalism\'s orchid round the herb', near255(orchid, p.orchid), JSON.stringify(orchid));
  check('in Logging\'s green round the tree', near255(sap, p.sap), JSON.stringify(sap));
  // half kindled: every ring pixel the same - a pixel two copies cover is lit once, never twice
  const half = await page.evaluate(() => window.draw({ alpha: 0.5 }));
  const lums = [];
  for (let y = 0; y < H; y++) for (let x = Math.floor(W * 0.33); x < W * 0.56; x++) {
    const a = at(bare.pix, x, y), b = at(half.pix, x, y);
    if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) > 30 && !isPicture(x, y)) lums.push(b[0] + b[1] + b[2]);
  }
  const spread = Math.max(...lums) - Math.min(...lums);
  check('half kindled, one even ring (a pixel lit once)', lums.length > 20 && spread < 40, `${lums.length} px, spread ${spread}`);
  // a wall in front hides the tree's ring; the herb's (left of the wall) stands
  const wb = await page.evaluate(() => window.draw({ walled: true, ring: false }));
  const wl = await page.evaluate(() => window.draw({ walled: true }));
  let behind = 0, herbStill = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const a = at(wb.pix, x, y), b = at(wl.pix, x, y);
    if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) <= 30) continue;
    if (x >= W * 0.56) behind++; else herbStill++;
  }
  check('a wall in front hides it', behind === 0 && herbStill > 40, `behind the wall ${behind} px, the herb's ${herbStill} px`);
  // a far picture inside its 3D tree's radius gives way: the flat of a tree's handle draws no ring of its own there
  const nolpt = await page.evaluate(() => window.draw({ lpt: false }));
  check('no 3D tree drawn this frame: no tree ring (the frame\'s, never a stale one)', nolpt.trees === 0, `trees ${nolpt.trees}`);
  check('no page error', errs.length === 0, errs.join('; '));
} finally {
  await browser.close();
  server.close();
}
const failed = out.filter((o) => !o).length;
console.log(`\n${out.length - failed}/${out.length} checks passed`);
process.exit(failed ? 1 : 0);
