// NODE-GLINT - A GATHERING NODE'S GLINT, COMPILED, LINKED AND DRAWN IN A REAL BROWSER.
//
// node holds the glint's law (test/scenes/nodeglint.test.js: who is lit and how, the pictures the host hands it, the
// rectangles, the pass over a fake GL); what node cannot answer is whether the two programs - the mask's (the billboard
// program's own vertex stage, the node's rectangle stretched over its tile of a depth-only atlas) and the light's -
// COMPILE and LINK in a real WebGL2 context, and whether what they draw is the glint they say: light added onto the
// picture (never darkening a pixel), its glints' cores on the picture's own cut silhouette and their rays no further
// than a glint's reach from it, one flat of a batch and not its neighbour, a 3D tree lit through the door's own buffers,
// hidden by a wall in front, half as bright half kindled, held still under reduced motion and moving without it, and
// the sheen crossing a far picture from its foot to its crown but never a near one; and the frame's target and GL
// baseline handed back. AUDIT NODE-GLINT: and a node behind the eye costs nothing, the rays reach past the picture at
// their glint's depth, no glint moves across the clock's wrap, two nodes of one picture glint apart, and on a leafy
// picture a glint holds its place as the eye moves a pixel at a time. GLINT-LIGHT: and it is as bright as the light where
// the node stands (the renderer's own flatLightAt) - whole at a clear noon, a quarter at night and still clear, held at the
// night's by the flats' floor in a black mine, and no sheen crossing the far picture at night. NODE-CROWN (FIELD BUGS
// 2026-10-25i): and the 3D tree, a prefab the mod scales (its run as the door makes it), lit to its top. So: the repo's own modules served as they are (no bundler), a floor, the node's own picture
// drawn by a stand-in of the billboard placement (depth written, cut at a half), the pass drawn by its own class over
// them, and the frame read back.
//
//     node tools/nodeGlintProbe.mjs [--shots <dir>]     (writes node_glint_near.png and node_glint_far.png there when given)
import { chromium } from 'playwright';
import http from 'node:http';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const shotsAt = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
const out = []; const check = (n, ok, d = '') => { out.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${d ? ` - ${d}` : ''}`); };

const PAGE = `<!doctype html><html><body style="margin:0;background:#000"><canvas id=c width=640 height=480></canvas><script type=module>
import { NodeGlintRenderer, glintPx, glintPxMax, GLINT_SHEEN_HZ, GLINT_CROWN_GROWTH } from '/src/render/nodeGlint.js';
import { Renderer } from '/src/render/renderer.js';
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
// basis, the size, its foot at its base) and a 3D tree turned and scaled at its root (NODE-CROWN: by its prefab's own
// scale, BB_VS's uMeshScale, as the door's trees are); cut at a half, depth written
const own = prog(\`#version 300 es
layout(location=0) in vec3 aCenter; layout(location=1) in vec2 aCorner;
uniform mat4 vp; uniform vec3 uRight; uniform vec2 uSize; uniform vec4 uInst; uniform vec3 uMeshScale; uniform float uMesh; out vec2 vUV;
void main(){
  vec3 w = aCenter + uRight * (aCorner.x * uSize.x) + vec3(0.0, (aCorner.y + 0.5) * uSize.y, 0.0);
  vUV = aCorner + 0.5;
  if (uMesh > 0.5) { vec3 p = aCenter * uMeshScale; float c = cos(uInst.w), s = sin(uInst.w); w = vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z) + uInst.xyz; vUV = aCorner; }
  gl_Position = vp * vec4(w, 1.0);
}\`, \`#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D t; out vec4 o;
void main(){ vec4 c = texture(t, vUV); if (c.a < 0.5) discard; o = vec4(0.25, 0.55, 0.2, 1.0); }\`);
const vao = (data, layout, idx) => { const v = gl.createVertexArray(); gl.bindVertexArray(v); const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW); for (const [loc, n, stride, off] of layout) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, stride, off); } let ib = null; if (idx) { ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx), gl.STATIC_DRAW); } gl.bindVertexArray(null); return { v, b, ib, n: data.length / 3 }; };
const quad = (a, b, c, d) => [...a, ...b, ...c, ...a, ...c, ...d];
const floor = vao(quad([-40, 0, -40], [40, 0, -40], [40, 0, 40], [-40, 0, 40]), [[0, 3, 12, 0]]);
const wall = vao(quad([0.15, 0, 2.6], [2.8, 0, 2.6], [2.8, 2.5, 2.6], [0.15, 2.5, 2.6]), [[0, 3, 12, 0]]);   // the tree wholly behind it, the herb wholly beside it
// the sprite: a disc on a clear square (every texel 0 or 255, as a classic record's)
const S = 32, px = new Uint8Array(S * S * 4);
for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const i = (y * S + x) * 4, inside = Math.hypot(x + 0.5 - S / 2, y + 0.5 - S / 2) < S * 0.42; px[i] = 90; px[i + 1] = 160; px[i + 2] = 60; px[i + 3] = inside ? 255 : 0; }
const mkTex = (bytes) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, S, S, 0, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
const tex = mkTex(px);
// AUDIT NODE-GLINT: a leafy cutout - the disc dappled with holes (a third of its texels), a herb's or a crown's picture
let s0 = 12345; const rnd = () => { s0 = (Math.imul(s0, 1103515245) + 12345) >>> 0; return s0 / 4294967296; };
const lpx = new Uint8Array(px); for (let i = 0; i < S * S; i++) if (rnd() < 0.35) lpx[i * 4 + 3] = 0;
const leafyTex = mkTex(lpx);
// A BATCH OF TWO FLATS, the renderer's own layout (createBillboardBatch: [centre xyz, corner xy], six indices a flat):
// flat 0 at x -1.6 (not the node), flat 1 at x -0.4 (the herb)
const CORNERS = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
const centers = [[-1.6, 0, 0], [-0.4, 0, 0]], bv = [], bi = [];
centers.forEach((c, f) => { for (const k of CORNERS) bv.push(...c, ...k); const b = f * 4; bi.push(b, b + 2, b + 1, b, b + 3, b + 2); });
const batchVao = vao(bv, [[0, 3, 20, 0], [1, 2, 20, 12]], bi);
const batch = { archive: 500, record: 9, frame: null, vao: batchVao.v, _ibOff: 0, size: { w: 1, h: 1 }, origin: null, sway: 0 };
// A 3D TREE, the door's own layout (lowPolyTreesRender.js: f32 x 8 - position, normal, uv - and u32 indices): two crossed
// cards 1.6 across and 2 up about its root, at x +1.4. NODE-CROWN: a prefab of the mod's own scale (half - as 504_16's,
// one of the temperate woods' trees), so its mesh is 3.2 across and 4 up, and its run is as the door makes it
// (systems/lowPolyTreesAssets.js frame): that scale, and the standing size the prototype carries with it in already
// (world/lowPolyTrees.js readLowPolyTrees)
const tv = [], ti = [];
const TREE_SCALE = [0.5, 0.5, 0.5];
const card = (ax, az) => { const o = tv.length / 8; for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) tv.push((u - 0.5) * 3.2 * ax, v * 4.0, (u - 0.5) * 3.2 * az, 0, 0, 1, u, v); ti.push(o, o + 1, o + 2, o, o + 2, o + 3); };
card(1, 0); card(0, 1);
const treeVao = vao(tv, [[0, 3, 32, 0], [2, 3, 32, 12], [1, 2, 32, 24]], ti);
const gpu = { vb: treeVao.b, ib: treeVao.ib };
const handle = { proto: 'a tree' }, root = [1.4, 0, 0];
const tset = { trees: new Float32Array([0, ...root, 1, 0.35]), centers: [root], handles: [handle], ox: 0, oy: 0, oz: 0 };
const frame = { eye: [0, 0, 0], radius: 140, band: 20, gpu, cut: new Set([handle]), runs: [{ run: { handle }, scale: TREE_SCALE, size: [3.2 * TREE_SCALE[0], 4 * TREE_SCALE[1]], sway: 0, subs: [{ offset: 0, count: ti.length, tex, alpha: 1, color: [1, 1, 1], cull: 0 }] }] };
let pass = null, err = null;
try { pass = new NodeGlintRenderer(gl); } catch (e) { err = String(e.message ?? e); }
const persp = (f, a, n, fa) => { const t = 1 / Math.tan(f / 2); return new Float32Array([t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0]); };
const look = (e, c) => { const u = [0, 1, 0]; const z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]]; let l = Math.hypot(...z); z.forEach((v, i) => { z[i] = v / l; }); const x = [u[1] * z[2] - u[2] * z[1], u[2] * z[0] - u[0] * z[2], u[0] * z[1] - u[1] * z[0]]; l = Math.hypot(...x); x.forEach((v, i) => { x[i] = v / l; }); const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]]; return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]), -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]), -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]), 1]); };
const mul = (a, b) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
window.probe = { err, linked: pass ? gl.getProgramParameter(pass.mask, gl.LINK_STATUS) && gl.getProgramParameter(pass.light, gl.LINK_STATUS) : false, atlas: pass ? (gl.bindFramebuffer(gl.FRAMEBUFFER, pass.fb), gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE) : false, reachMax: glintPxMax(H), crownMax: glintPxMax(H) * GLINT_CROWN_GROWTH, sheenPeriod: 1 / GLINT_SHEEN_HZ };
gl.bindFramebuffer(gl.FRAMEBUFFER, null);   // the atlas's status asked: the canvas back
/** The floor, the node's own pictures (and \`walled\` the wall), then (\`lit\`) the pass over them at \`alpha\`, its clock
 *  \`seconds\` (\`still\` reduced motion), seen from \`far\` (25 m off, a long lens on the herb) or near; the whole frame read
 *  back, row 0 at the bottom, with the pass's count, the glints' reach on the herb and the GL state it left. */
window.draw = ({ walled = false, lit = true, alpha = 1, lpt = true, seconds = 0, still = false, far = false, leafy = false, strafe = 0, twin = false, behind = false, ambient = null, highlight = undefined } = {}) => {
  const eye = far ? [-0.4, 1.0, 25] : [strafe, 1.0, 5.5];
  const proj = persp(far ? 0.1 : 0.9, W / H, 0.05, 100), view = look(eye, far ? [-0.4, 0.5, 0] : [strafe, 0.8, 0]), vp = mul(proj, view);
  const herbTex = leafy ? leafyTex : tex;
  const right = new Float32Array([view[0], view[4], view[8]]);
  gl.viewport(0, 0, W, H);
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE);
  gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.disable(gl.CULL_FACE);
  gl.useProgram(flat); gl.uniformMatrix4fv(gl.getUniformLocation(flat, 'vp'), false, vp);
  gl.uniform3f(gl.getUniformLocation(flat, 'c'), 0.1, 0.09, 0.08); gl.bindVertexArray(floor.v); gl.drawArrays(gl.TRIANGLES, 0, floor.n);
  gl.useProgram(own); gl.uniformMatrix4fv(gl.getUniformLocation(own, 'vp'), false, vp); gl.uniform3fv(gl.getUniformLocation(own, 'uRight'), right);
  gl.uniform2f(gl.getUniformLocation(own, 'uSize'), 1, 1); gl.uniform1f(gl.getUniformLocation(own, 'uMesh'), 0); gl.bindTexture(gl.TEXTURE_2D, herbTex);
  gl.bindVertexArray(batchVao.v); gl.drawElements(gl.TRIANGLES, 12, gl.UNSIGNED_INT, 0);
  gl.uniform1f(gl.getUniformLocation(own, 'uMesh'), 1); gl.uniform4f(gl.getUniformLocation(own, 'uInst'), root[0], root[1], root[2], 0.35); gl.uniform3fv(gl.getUniformLocation(own, 'uMeshScale'), TREE_SCALE); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.bindVertexArray(treeVao.v); gl.drawElements(gl.TRIANGLES, ti.length, gl.UNSIGNED_INT, 0);
  if (walled) { gl.useProgram(flat); gl.uniform3f(gl.getUniformLocation(flat, 'c'), 0.12, 0.12, 0.12); gl.bindVertexArray(wall.v); gl.drawArrays(gl.TRIANGLES, 0, wall.n); }
  gl.bindVertexArray(null);
  gl.enable(gl.CULL_FACE);
  let drawn = 0, trees = 0, ringed = 0, reach = 0, reaches = [], counts = [];
  if (lit) {
    frame.eye = eye;
    const r = { gl, _proj: proj, _view: view, _camPos: new Float32Array(eye), _bbRight: right, _bbUp: new Float32Array([0, 1, 0]), _fogMode: 0, _fogDensity: 0, _haze: new Float32Array(8),
      _fogRange: new Float32Array([0, 1]), textures: new Map([['500_9', herbTex]]), lptDrawnFrames: () => (lpt ? [frame, null] : []) };
    // GLINT-LIGHT: \`ambient\` a scene lit by that alone (the clock's, no sun, no lamp) - the renderer's own flatLightAt over it
    if (ambient) Object.assign(r, { flatLightAt: Renderer.prototype.flatLightAt, _pointColorData: Renderer.prototype._pointColorData, _clockLit: true, _ambient: ambient,
      _moonColor: [0, 0, 0], _moonScale: 0, _sunColor: [0, 0, 0], _sunScale: 0, _pointLights: new Float32Array(0), _pointColors: null, _pointColor: [1, 1, 1],
      _pointColorScratch: new Float32Array(48), _lane: null, _indirect: [0, 0, 0, 0], _indirectColor: [0, 0, 0] });
    const list = [
      { alpha, seed: 0.37, at: centers[1], rgb: nodeMarkRgb('herbalism'), mark: { pictures: [{ batch, first: 1, count: 1, centers: [centers[1]] }] } },
      { alpha, seed: 0.61, at: root, rgb: nodeMarkRgb('logging'), mark: { pictures: [{ batch: { ...batch, vao: null }, first: 0, count: 0, center: root, entry: { lowPolyTrees: tset } }] } },
    ];
    // AUDIT NODE-GLINT: flat 0 a node of its own (another seed); a node 15 m behind the eye (it was a full-screen pass)
    if (twin) list.push({ alpha, seed: 0.83, at: centers[0], rgb: nodeMarkRgb('herbalism'), mark: { pictures: [{ batch, first: 0, count: 1, centers: [centers[0]] }] } });
    if (behind) list.push({ alpha, seed: 0.5, at: [0, 0, 20], rgb: nodeMarkRgb('herbalism'), mark: { pictures: [{ batch, first: 1, count: 1, centers: [[0, 0, 20]] }] } });
    drawn = pass.draw(list, r, seconds, still, highlight);   // RESOURCE-HIGHLIGHTS: \`highlight\` the glints (the default), the ring, or both
    trees = pass.trees; ringed = pass.ringed;
    reach = pass._nodes?.[0] ? Math.max(...pass._nodes.slice(0, 2).map((s) => s.glint)) : 0;
    reaches = pass._nodes.slice(0, 2).map((s) => s.glint); counts = pass._nodes.slice(0, 2).map((s) => s.count);   // NODE-CROWN: the herb's, the tree's
  }
  const state = { depthFunc: gl.getParameter(gl.DEPTH_FUNC) === gl.LESS, depthMask: gl.getParameter(gl.DEPTH_WRITEMASK) === true, blend: gl.isEnabled(gl.BLEND), cull: gl.isEnabled(gl.CULL_FACE) };
  const pix = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, pix);
  return { error: gl.getError(), drawn, trees, ringed, reach, reaches, counts, state, pix: Array.from(pix) };
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
  const draw = (o) => page.evaluate((a) => window.draw(a), o);
  const at = (a, x, y) => { const i = (y * W + x) * 4; return [a[i], a[i + 1], a[i + 2]]; };
  const rise = (a, b, x, y) => { const u = at(a, x, y), v = at(b, x, y); return v[0] - u[0] + v[1] - u[1] + v[2] - u[2]; };
  const isPicture = (bare) => (x, y) => { const c = at(bare.pix, x, y); return c[1] > 100 && c[1] > c[0] + 40; };
  const nearOf = (f) => (x, y, r) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && f(xx, yy)) return true; } return false; };
  const herbCol = (x) => x >= W * 0.33 && x < W * 0.56, treeCol = (x) => x >= W * 0.56, flat0Col = (x) => x < W * 0.33;   // the herb reaches past the middle; the tree starts past 0.56

  // NEAR: a run of moments over the glints' lives - every pixel the light touched, read against the bare frame
  const bare = await draw({ lit: false });
  const onPic = isPicture(bare), nearPic = nearOf(onPic);
  const first = await draw({ seconds: 0 });
  check('no GL error drawing it; both nodes lit, one as its 3D tree', first.error === 0 && first.drawn === 2 && first.trees === 1, `error ${first.error}, drawn ${first.drawn}, trees ${first.trees}`);
  check('the GL baseline handed back: depth LESS and written, blend off, faces culled', first.state.depthFunc && first.state.depthMask && !first.state.blend && first.state.cull, JSON.stringify(first.state));
  const reach = Math.ceil(first.reach) + 1;
  check('a glint\'s reach on screen is its law\'s (a few pixels, never past the image\'s most)', first.reaches[0] > 1 && first.reaches[0] <= p.reachMax, `the herb's ${first.reaches[0].toFixed(2)} px of ${p.reachMax.toFixed(2)}`);
  // NODE-CROWN (AUDIT FB1025i C1, the report's "Needs to be size aware"): a big 3D crown's glints grown - twice as many,
  // twice the reach; the herb's six as they were
  check('NODE-CROWN: a big 3D crown glints twice as many, reaching twice as far; the herb its six', first.counts[0] === 6 && first.counts[1] === 12 && Math.abs(first.reaches[1] - p.crownMax) < 1e-6, `counts ${first.counts.join(', ')}; the tree's reach ${first.reaches[1].toFixed(2)} px of ${p.crownMax.toFixed(2)}`);
  // NODE-CROWN: the tree's rows on screen (row 0 the bottom), and the top two fifths of them - its crown's upper reach
  let treeLo = H, treeHi = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (treeCol(x) && onPic(x, y)) { if (y < treeLo) treeLo = y; if (y > treeHi) treeHi = y; }
  const crownFrom = treeLo + 0.6 * (treeHi - treeLo);
  let herb = 0, tree = 0, treeTop = 0, flat0 = 0, darker = 0, farOff = 0, strongOff = 0, touched = 0, offPic = 0, frames = 0, herbHearts = 0, treeHearts = 0;
  for (let t = 0; t < 6; t += 0.25) {
    const f = await draw({ seconds: t });
    frames++;
    if (shotsAt && Math.abs(t - 1.5) < 1e-9) await page.locator('#c').screenshot({ path: join(shotsAt, 'node_glint_near.png') });
    // NODE-CROWN: each glint's heart - a local peak of 300 or more, one within 2 px of another the same
    const hs = [];
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
      if (!herbCol(x) && !treeCol(x)) continue;
      const v = rise(bare.pix, f.pix, x, y);
      if (v < 300) continue;
      let top = true;
      for (let dy = -2; dy <= 2 && top; dy++) for (let dx = -2; dx <= 2; dx++) if ((dx || dy) && rise(bare.pix, f.pix, x + dx, y + dy) > v) { top = false; break; }
      if (top && !hs.some((h) => Math.abs(h[0] - x) <= 2 && Math.abs(h[1] - y) <= 2)) hs.push([x, y]);
    }
    for (const h of hs) if (herbCol(h[0])) herbHearts++; else treeHearts++;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const d = rise(bare.pix, f.pix, x, y);
      if (d < -6) darker++;
      if (d <= 24) continue;
      touched++;
      if (treeCol(x) && y >= crownFrom) treeTop++;
      if (herbCol(x)) herb++; else if (treeCol(x)) tree++; else if (flat0Col(x)) flat0++;
      if (!nearPic(x, y, reach)) farOff++;
      if (!onPic(x, y)) offPic++;
      if (d >= 300 && !nearPic(x, y, 3)) strongOff++;
    }
  }
  check('over the glints\' lives the herb glints, and the tree', herb > 40 && tree > 40, `herb ${herb} px, tree ${tree} px over ${frames} frames`);
  // FIELD BUGS 2026-10-25i NODE-CROWN ("Big trees hide resource node particles"): a prefab of the mod's own scale glints to
  // its top - its scale counted once (it stood the crown at its scale's share of the tree: half of this one, the top bare)
  check('NODE-CROWN (AUDIT FB1025i C1): the big crown\'s glint hearts a frame more than the herb\'s six make', treeHearts > herbHearts * 1.3, `the tree's ${(treeHearts / frames).toFixed(2)} a frame, the herb's ${(herbHearts / frames).toFixed(2)}`);
  check('NODE-CROWN: a scaled prefab\'s 3D tree glints to its top - its crown\'s upper two fifths lit', treeTop > 40 && treeTop < tree, `${treeTop} px of the tree's ${tree} in its rows ${Math.ceil(crownFrom)}-${treeHi} (the tree ${treeLo}-${treeHi})`);
  check('light only added: no pixel darker', darker === 0, `${darker} px`);
  check(`within a glint's reach (${reach} px) of the picture: a glint, not a halo`, farOff === 0, `${farOff} of ${touched} past it`);
  check('every glint\'s heart on the picture (its brightest pixels within 3 px of it)', strongOff === 0, `${strongOff} px`);
  check('one flat of the batch: its neighbour (flat 0) unlit', flat0 === 0, `${flat0} px`);
  check('the rays reach past the picture\'s edge, at their glint\'s depth (not the background\'s)', offPic > 20, `${offPic} px off the picture`);
  // near, no sheen: the light on the picture is the glints' alone - few of its pixels at any moment
  let maxShare = 0, picPx = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (herbCol(x) && onPic(x, y)) picPx++;
  for (let t = 0; t < p.sheenPeriod; t += 0.5) {
    const f = await draw({ seconds: t });
    let lit = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (herbCol(x) && onPic(x, y) && rise(bare.pix, f.pix, x, y) > 24) lit++;
    maxShare = Math.max(maxShare, lit / picPx);
  }
  check('near, no sheen crosses the picture (none within GLINT_SHEEN_NEAR_M; the node an act works is quiet whole - the host\'s, test/scenes/nodeglint.test.js)', maxShare < 0.12, `at most ${(maxShare * 100).toFixed(1)}% of the herb's ${picPx} px lit at once`);
  // half kindled: half the light, near enough (a saturated pixel holds a little more back)
  const full = await draw({ seconds: 1.5 }), half = await draw({ seconds: 1.5, alpha: 0.5 });
  let sumFull = 0, sumHalf = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { sumFull += Math.max(0, rise(bare.pix, full.pix, x, y)); sumHalf += Math.max(0, rise(bare.pix, half.pix, x, y)); }
  check('half kindled, half the light', sumFull > 0 && sumHalf / sumFull > 0.4 && sumHalf / sumFull < 0.65, `${sumHalf} of ${sumFull} (${(sumHalf / sumFull).toFixed(3)})`);
  // GLINT-LIGHT: the light where the node stands, through the renderer's own flatLightAt - a clear noon's (whole), the
  // night's (the clock's own night ambient, 0.25: a quarter, and its brightest still clear on the picture) and a black
  // mine's (no light at all: the flats' floor holds it at the night's)
  const noon = await draw({ seconds: 1.5, ambient: [1, 1, 1] }), night = await draw({ seconds: 1.5, ambient: [0.25, 0.25, 0.25] }), mine = await draw({ seconds: 1.5, ambient: [0, 0, 0] });
  let sumNoon = 0, sumNight = 0, sumMine = 0, peakFull = 0, peakNight = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = rise(bare.pix, night.pix, x, y);
    sumNoon += Math.max(0, rise(bare.pix, noon.pix, x, y)); sumNight += Math.max(0, n); sumMine += Math.max(0, rise(bare.pix, mine.pix, x, y));
    peakFull = Math.max(peakFull, rise(bare.pix, full.pix, x, y)); peakNight = Math.max(peakNight, n);
  }
  check('a clear noon\'s light: the glints whole', sumNoon === sumFull, `${sumNoon} of ${sumFull}`);
  check('at night a quarter of the light, its brightest still clear on the picture', sumNight / sumFull > 0.18 && sumNight / sumFull < 0.32 && peakNight >= 120, `${sumNight} of ${sumFull} (${(sumNight / sumFull).toFixed(3)}), brightest ${peakNight} of the day's ${peakFull}`);
  check('in a black mine the flats\' floor holds it at the night\'s', sumMine === sumNight, `${sumMine} against the night's ${sumNight}`);
  // reduced motion: still - the same frame at any moment, and a lit one; without it, the glints move
  const s0 = await draw({ seconds: 0.5, still: true }), s1 = await draw({ seconds: 3.75, still: true });
  const m0 = await draw({ seconds: 0.5 }), m1 = await draw({ seconds: 3.75 });
  let stillDiff = 0, stillLit = 0, moveDiff = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (Math.abs(rise(s0.pix, s1.pix, x, y)) > 6) stillDiff++;
    if (rise(bare.pix, s0.pix, x, y) > 24) stillLit++;
    if (Math.abs(rise(m0.pix, m1.pix, x, y)) > 24) moveDiff++;
  }
  check('under reduced motion it stands still, and still glints', stillDiff === 0 && stillLit > 20, `${stillDiff} px moved, ${stillLit} px lit`);
  check('without it the glints live and die', moveDiff > 20, `${moveDiff} px changed between two moments`);
  // a wall in front hides the tree's light; the herb's (left of the wall) stands
  const wb = await draw({ walled: true, lit: false });
  let behind = 0, herbStill = 0;
  for (let t = 0; t < 4; t += 0.5) {
    const wl = await draw({ walled: true, seconds: t });
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (Math.abs(rise(wb.pix, wl.pix, x, y)) <= 24) continue;
      if (treeCol(x)) behind++; else herbStill++;
    }
  }
  check('a wall in front hides it', behind === 0 && herbStill > 40, `behind the wall ${behind} px, the herb's ${herbStill} px`);
  // a far picture inside its 3D tree's radius gives way: no tree drawn this frame, no tree lit
  let treeLit = 0;
  for (const t of [0.5, 1.5, 2.5]) {
    const f = await draw({ lpt: false, seconds: t });
    if (f.trees !== 0) treeLit += 1e6;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (treeCol(x) && rise(bare.pix, f.pix, x, y) > 24) treeLit++;
  }
  check('no 3D tree drawn this frame: no tree lit, in its pixels too (the frame\'s, never a stale one)', treeLit === 0, `${treeLit} px`);
  // AUDIT NODE-GLINT: a node behind the eye is none - it was the whole screen's rectangle, a full-screen pass a frame
  const back = await draw({ behind: true, seconds: 1.5 });
  check('a node behind the eye costs nothing (none of its rectangle drawn)', back.drawn === 2, `drawn ${back.drawn} of 3`);
  // AUDIT NODE-GLINT: the life at the clock's wrap is the life at zero - every glint jumped once a minute
  const w0 = await draw({ seconds: 59.9999 }), w1 = await draw({ seconds: 0 });
  let jumped = 0, wrapLit = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (Math.abs(rise(w0.pix, w1.pix, x, y)) > 24) jumped++; if (rise(bare.pix, w1.pix, x, y) > 24) wrapLit++; }
  check('across the clock\'s wrap no glint moves', jumped === 0 && wrapLit > 20, `${jumped} px changed, ${wrapLit} px lit`);
  // AUDIT NODE-GLINT: each node its own glints - two flats of one picture, two seeds, two patterns (in each picture's frame)
  const heartsOf = (b, f, col) => {
    let x0 = W, y0 = H;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (col(x) && onPic(x, y)) { if (x < x0) x0 = x; if (y < y0) y0 = y; }
    const R = (x, y) => rise(b.pix, f.pix, x, y), hs = [];
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
      if (!col(x)) continue;
      const v = R(x, y);
      if (v < 300) continue;
      let top = true;
      for (let dy = -2; dy <= 2 && top; dy++) for (let dx = -2; dx <= 2; dx++) if ((dx || dy) && R(x + dx, y + dy) > v) { top = false; break; }
      if (top && !hs.some((h) => Math.abs(h[0] - (x - x0)) <= 2 && Math.abs(h[1] - (y - y0)) <= 2)) hs.push([x - x0, y - y0]);
    }
    return hs;
  };
  let shared = 0, twinHearts = 0;
  for (const t of [0.5, 1.5, 2.5, 3.5]) {
    const f = await draw({ twin: true, seconds: t });
    const a = heartsOf(bare, f, flat0Col), b = heartsOf(bare, f, herbCol);
    twinHearts += a.length + b.length;
    shared += a.filter((h) => b.some((k) => Math.hypot(h[0] - k[0], h[1] - k[1]) <= 2)).length;
  }
  check('each node its own glints (two seeds, two patterns)', twinHearts >= 8 && shared <= twinHearts * 0.2, `${shared} of ${twinHearts} hearts at the same place`);
  // AUDIT NODE-GLINT: a glint holds its place as the eye moves a pixel - on a leafy picture its spot was chosen again each
  // frame against the moving silhouette, and came and went at a leaf's edge (12 events over 20 steps before). A heart is
  // a local peak of 300 or more; it has GONE when the other frame holds no glint light (120) within 2.5 px of its place in
  // the picture - a peak only dimming under the 300 as it slides across a pixel is the same glint
  const leafCol = (x) => x >= W * 0.35 && x < W * 0.56;   // the herb alone, its neighbour flat clear of it at every step
  let prev = null, events = 0, held = 0;
  for (let k = 0; k <= 12; k++) {
    const b = await draw({ lit: false, leafy: true, strafe: k * 0.012 }), f = await draw({ leafy: true, strafe: k * 0.012, seconds: 1.5 });
    const onLeaf = isPicture(b);
    let x0 = W, y0 = H;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (leafCol(x) && onLeaf(x, y)) { if (x < x0) x0 = x; if (y < y0) y0 = y; }
    const R = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? rise(b.pix, f.pix, x, y) : 0), hs = [];
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
      if (!leafCol(x)) continue;
      const v = R(x, y);
      if (v < 300) continue;
      let top = true;
      for (let dy = -2; dy <= 2 && top; dy++) for (let dx = -2; dx <= 2; dx++) if ((dx || dy) && R(x + dx, y + dy) > v) { top = false; break; }
      if (top && !hs.some((h) => Math.abs(h[0] - (x - x0)) <= 2 && Math.abs(h[1] - (y - y0)) <= 2)) hs.push([x - x0, y - y0]);
    }
    held += hs.length;
    const cur = { hs, R, x0, y0 };
    const lit = (fr, h) => { let m = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) m = Math.max(m, fr.R(fr.x0 + h[0] + dx, fr.y0 + h[1] + dy)); return m >= 120; };
    if (prev) {
      for (const h of cur.hs) if (!lit(prev, h)) events++;
      for (const h of prev.hs) if (!lit(cur, h)) events++;
    }
    prev = cur;
  }
  check('on a leafy picture a glint holds its place as the eye moves a pixel at a time', held >= 13 && events === 0, `${events} comings and goings over 12 steps, ${held} hearts seen`);

  // FAR: the herb 25 m off through a long lens - the sheen crosses it, rising: each moment the row of its picture most lit
  // (by the row's median - a glint is a few pixels of a row, the sheen the whole of it)
  const fbare = await draw({ lit: false, far: true });
  const fPic = isPicture(fbare), herbFar = (x) => x >= W * 0.3 && x < W * 0.7;   // the herb the lens is on, its neighbours apart
  const rows = [];
  for (let y = 0; y < H; y++) { let n = 0; for (let x = 0; x < W; x++) if (herbFar(x) && fPic(x, y)) n++; if (n > 20) rows.push(y); }
  const peaks = [];
  let wrote = false;
  for (let t = 0; t < p.sheenPeriod; t += 0.25) {
    const f = await draw({ seconds: t, far: true });
    let best = 0, bestY = -1;
    for (const y of rows) {
      const v = [];
      for (let x = 0; x < W; x++) if (herbFar(x) && fPic(x, y)) v.push(rise(fbare.pix, f.pix, x, y));
      v.sort((a, b) => a - b);
      const med = v[v.length >> 1];
      if (med > best) { best = med; bestY = y; }
    }
    peaks.push({ t, best, y: bestY });
    if (shotsAt && !wrote && best > 60 && bestY > rows[0] + (rows.at(-1) - rows[0]) * 0.4) { await page.locator('#c').screenshot({ path: join(shotsAt, 'node_glint_far.png') }); wrote = true; }
  }
  const crossing = peaks.filter((k) => k.best > 30);
  check('far, a sheen crosses the picture', rows.length > 60 && crossing.length >= 4, `${crossing.length} of ${peaks.length} moments lit across a row (${rows.length} rows of picture)`);
  let up = 0, down = 0;
  for (let i = 1; i < crossing.length; i++) if (crossing[i].t - crossing[i - 1].t < 0.3) { if (crossing[i].y > crossing[i - 1].y) up++; else if (crossing[i].y < crossing[i - 1].y) down++; }
  check('rising, from its foot toward its crown', up >= 3 && down <= 1, `${up} steps up, ${down} down`);
  const dark = peaks.filter((k) => k.best <= 8).length;
  check('and dark between crossings', dark >= peaks.length * 0.3, `${dark} of ${peaks.length} moments unlit`);
  // GLINT-LIGHT: the same far herb at night - no sheen crosses it at any moment (the glints are a few pixels of a row)
  let nightBest = 0;
  for (const k of crossing) {
    const f = await draw({ seconds: k.t, far: true, ambient: [0.25, 0.25, 0.25] });
    for (const y of rows) {
      const v = [];
      for (let x = 0; x < W; x++) if (herbFar(x) && fPic(x, y)) v.push(rise(fbare.pix, f.pix, x, y));
      v.sort((a, b) => a - b);
      nightBest = Math.max(nightBest, v[v.length >> 1]);
    }
  }
  check('far, at night, no sheen crosses it (at every moment it crossed by day)', crossing.length >= 4 && nightBest <= 8, `the most lit row's median ${nightBest} over the day's ${crossing.length} crossing moments`);
  // RESOURCE-HIGHLIGHTS (2026-10-26): NODE-OUTLINE's ring, back as a choice - round each picture in its profession's colour,
  // never over it, within its width of it, hidden by a wall, the glints off; and with both, the ring and the glints
  const RING = { glint: false, ring: true }, BOTH = { glint: true, ring: true };
  const ringed = await draw({ seconds: 1.5, highlight: RING });
  if (shotsAt) await page.locator('#c').screenshot({ path: join(shotsAt, 'node_outline_near.png') });
  check('RESOURCE-HIGHLIGHTS: the outline builds and draws with no GL error; both nodes ringed, the baseline handed back', ringed.error === 0 && ringed.ringed === 2 && ringed.state.depthFunc && ringed.state.depthMask && !ringed.state.blend && ringed.state.cull,
    `error ${ringed.error}, ringed ${ringed.ringed}, ${JSON.stringify(ringed.state)}`);
  let rOn = 0, rHerb = 0, rTree = 0, rFlat0 = 0, rFar = 0, rRgb = [0, 0, 0];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (Math.abs(rise(bare.pix, ringed.pix, x, y)) <= 24) continue;
    if (onPic(x, y)) { rOn++; continue; }
    if (herbCol(x)) { rHerb++; const c = at(ringed.pix, x, y); rRgb = rRgb.map((v, i) => v + c[i]); if (!nearPic(x, y, 4)) rFar++; } else if (treeCol(x)) rTree++; else if (flat0Col(x)) rFlat0++;
  }
  check('RESOURCE-HIGHLIGHTS: the ring stands round the pictures - the herb\'s and the tree\'s - and never over them', rHerb > 20 && rTree > 20 && rOn === 0, `herb ${rHerb} px, tree ${rTree} px, ${rOn} px over a picture`);
  check('RESOURCE-HIGHLIGHTS: within its width of the herb\'s picture; its neighbour flat unringed', rFar === 0 && rFlat0 === 0, `${rFar} px past it, flat 0 ${rFlat0} px`);
  const hue = rRgb.map((v) => v / Math.max(1, rHerb));
  check('RESOURCE-HIGHLIGHTS: the herb\'s ring in Herbalism\'s orchid (red and blue over green)', hue[0] > hue[1] + 30 && hue[2] > hue[1] + 30, `mean ${hue.map((v) => v.toFixed(0)).join(', ')}`);
  const wr = await draw({ walled: true, seconds: 1.5, highlight: RING });
  let rBehind = 0, rStill = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (Math.abs(rise(wb.pix, wr.pix, x, y)) <= 24) continue; if (treeCol(x)) rBehind++; else rStill++; }
  check('RESOURCE-HIGHLIGHTS: a wall in front hides the ring', rBehind === 0 && rStill > 20, `behind the wall ${rBehind} px, the herb's ${rStill} px`);
  let bothOn = 0, bothOff = 0, ringOver = 0, ringTree = 0;
  for (let t = 0; t < 3; t += 0.5) {
    const b = await draw({ seconds: t, highlight: BOTH }), g = await draw({ seconds: t });
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      // the ring is what Both adds to the glints at the same moment: never on a picture - the tree's tile is FITTED here
      // (the glints' room round it), its texels coarser than its pixels
      if (Math.abs(rise(g.pix, b.pix, x, y)) > 24) { if (onPic(x, y)) ringOver++; else if (treeCol(x)) ringTree++; }
      if (rise(bare.pix, b.pix, x, y) <= 24 || !herbCol(x)) continue;
      if (onPic(x, y)) bothOn++; else bothOff++;
    }
  }
  check('RESOURCE-HIGHLIGHTS: both - the glints on the picture and the ring round it', bothOn > 20 && bothOff > 20, `${bothOn} px on the herb, ${bothOff} round it`);
  check('RESOURCE-HIGHLIGHTS: both - the ring round the tree fitted into its tile, never over a picture', ringTree > 20 && ringOver === 0, `${ringTree} px round the tree, ${ringOver} px over a picture`);
  check('no page error', errs.length === 0, errs.join('; '));
  if (process.env.DEBUG) writeFileSync('/dev/stderr', JSON.stringify(peaks) + '\n');
} finally {
  await browser.close();
  server.close();
}
const failed = out.filter((o) => !o).length;
console.log(`\n${out.length - failed}/${out.length} checks passed`);
process.exit(failed ? 1 : 0);
