// NODE-MARKS - A GATHERING NODE'S GLOW, COMPILED, LINKED AND DRAWN IN A REAL BROWSER.
//
// node holds the glow's law (test/scenes/nodemarks.test.js: who glows and how bright, the shader run through test/glsl.mjs, the
// pass over a fake GL); what node cannot answer is whether the GLSL COMPILES and LINKS in a real WebGL2 context, and
// whether what it draws is the glow it says: light low on the node in its profession's colour, nothing past its crown,
// lying OVER the node's own picture (its card stood toward the eye), hidden by a wall in front of it, no jump where the
// clock wraps, and nothing before it has kindled. So: the repo's own module served as it is (no bundler), a grey floor
// and an opaque stand-in for the node's sprite drawn by a stand-in shader (depth written), the pass drawn by its own
// class over them, and the frame read back.
//
//     node tools/nodeGlowProbe.mjs [--shots <dir>]     (writes node_glow.png there when given)
import { chromium } from 'playwright';
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const shotsAt = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
const out = []; const check = (n, ok, d = '') => { out.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${d ? ` - ${d}` : ''}`); };

const PAGE = `<!doctype html><html><body style="margin:0;background:#000"><canvas id=c width=640 height=480></canvas><script type=module>
import { NodeGlowRenderer, NODE_GLOW_PERIOD, NODE_GLOW_PULL, createNodeGlowPass } from '/src/render/nodeGlow.js';
import { nodeMarkRgb } from '/src/ui/nodeMarks.js';
const gl = document.getElementById('c').getContext('webgl2', { alpha: false, preserveDrawingBuffer: true });
const vs = \`#version 300 es
layout(location=0) in vec3 p; uniform mat4 vp; void main(){ gl_Position = vp * vec4(p, 1.0); }\`;
const fs = \`#version 300 es
precision highp float; uniform vec3 c; out vec4 o; void main(){ o = vec4(c, 1.0); }\`;
const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
const quad = (a, b, c, d) => [...a, ...b, ...c, ...a, ...c, ...d];
const mesh = (tris) => { const v = gl.createVertexArray(); gl.bindVertexArray(v); const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(tris), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0); gl.bindVertexArray(null); return { v, n: tris.length / 3 }; };
const floor = mesh(quad([-20, 0, -20], [20, 0, -20], [20, 0, 20], [-20, 0, 20]));
// the node's own picture: an opaque upright card at the herb's place (x -1.5), a metre across and 0.8 up, facing the eye
const sprite = mesh(quad([-2.0, 0, 0], [-1.0, 0, 0], [-1.0, 0.8, 0], [-2.0, 0.8, 0]));
// a wall between the eye and the school (x +1.5)
const wall = mesh(quad([0.6, 0, 2.2], [2.6, 0, 2.2], [2.6, 2.5, 2.2], [0.6, 2.5, 2.2]));
let pass = null, err = null;
try { pass = new NodeGlowRenderer(gl); } catch (e) { err = String(e.message ?? e); }
const persp = (f, a, n, fa) => { const t = 1 / Math.tan(f / 2); return new Float32Array([t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0]); };
const look = (e, c) => { const u = [0, 1, 0]; const z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]]; let l = Math.hypot(...z); z.forEach((v, i) => { z[i] = v / l; }); const x = [u[1] * z[2] - u[2] * z[1], u[2] * z[0] - u[0] * z[2], u[0] * z[1] - u[1] * z[0]]; l = Math.hypot(...x); x.forEach((v, i) => { x[i] = v / l; }); const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]]; return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]), -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]), -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]), 1]); };
const mul = (a, b) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
window.probe = { err, linked: pass ? gl.getProgramParameter(pass.program, gl.LINK_STATUS) : false, period: NODE_GLOW_PERIOD, pull: NODE_GLOW_PULL };
/** The floor, the herb's own picture and (\`walled\`) the wall; then a herb patch at x -1.5 and a school at x +1.5, from
 *  \`eye\` at \`t\` seconds, kindled \`alpha\`, with or without \`glow\`; read back \`pts\` (world). */
window.draw = (eye, t, alpha, pts, { walled = false, glow = true } = {}) => {
  const proj = persp(0.9, 640 / 480, 0.05, 100), view = look(eye, [0, 0.5, 0]), vp = mul(proj, view);
  gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.CULL_FACE); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);   // the stand-ins are double-sided; the pass hands culling back on, as the renderer keeps it
  gl.useProgram(pr); gl.uniformMatrix4fv(gl.getUniformLocation(pr, 'vp'), false, vp);
  const put = (m, c) => { gl.uniform3f(gl.getUniformLocation(pr, 'c'), ...c); gl.bindVertexArray(m.v); gl.drawArrays(gl.TRIANGLES, 0, m.n); };
  put(floor, [0.08, 0.075, 0.07]); put(sprite, [0.12, 0.16, 0.08]); if (walled) put(wall, [0.1, 0.1, 0.1]);
  gl.bindVertexArray(null);
  if (glow) pass.draw([
    { at: [-1.5, 0, 0], w: 2.2, h: 1.3, rgb: nodeMarkRgb('herbalism'), alpha, seed: 0.31 },
    { at: [1.5, 0, 0], w: 4.4, h: 0.8, rgb: nodeMarkRgb('fishing'), alpha, seed: 0.77 },
  ], proj, view, new Float32Array(eye), t, null);
  const px = (w) => {
    const c = [0, 1, 2, 3].map((r) => vp[r] * w[0] + vp[4 + r] * w[1] + vp[8 + r] * w[2] + vp[12 + r]);
    const x = Math.round((c[0] / c[3] * 0.5 + 0.5) * 640), y = Math.round((c[1] / c[3] * 0.5 + 0.5) * 480);
    const o = new Uint8Array(4); gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, o); return Array.from(o);
  };
  return { error: gl.getError(), drawn: glow ? pass.drawn : 0, px: pts.map(px) };
};
/** AUDIT NODE-MARKS: THE WORLD HOST'S OWN PATH - createNodeGlowPass over a renderer stand-in holding the camera as the
 *  renderer does (a Float32Array _camPos), "frames" frames a quarter second apart (the program built at the first
 *  node marked, the kindling run whole), then the herb's pixel read back. */
window.throughPass = (eye, frames, pts) => {
  const proj = persp(0.9, 640 / 480, 0.05, 100), view = look(eye, [0, 0.5, 0]), vp = mul(proj, view);
  let t = 50, foreign = 0, lit = 0;
  const r = { gl, _proj: proj, _view: view, _camPos: new Float32Array(eye), _fogMode: 0, _fogDensity: 0, _fogRange: new Float32Array([0, 1]), _focus: new Float32Array(4), markForeignPass: () => { foreign++; } };
  const p2 = createNodeGlowPass(r, { now: () => t, idle: (fn) => fn(), reduced: () => false });
  const marks = [{ key: 'herb:400:150:20500:0', profession: 'herbalism', at: [-1.5, 0, 0], w: 2.2, h: 1.3 }];
  for (let i = 0; i < frames; i++) {
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.CULL_FACE); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(pr); gl.uniformMatrix4fv(gl.getUniformLocation(pr, 'vp'), false, vp);
    gl.uniform3f(gl.getUniformLocation(pr, 'c'), 0.08, 0.075, 0.07); gl.bindVertexArray(floor.v); gl.drawArrays(gl.TRIANGLES, 0, floor.n);
    gl.uniform3f(gl.getUniformLocation(pr, 'c'), 0.12, 0.16, 0.08); gl.bindVertexArray(sprite.v); gl.drawArrays(gl.TRIANGLES, 0, sprite.n); gl.bindVertexArray(null);
    lit = p2.draw(marks); t += 0.25;
  }
  const px = (w) => {
    const c = [0, 1, 2, 3].map((k) => vp[k] * w[0] + vp[4 + k] * w[1] + vp[8 + k] * w[2] + vp[12 + k]);
    const x = Math.round((c[0] / c[3] * 0.5 + 0.5) * 640), y = Math.round((c[1] / c[3] * 0.5 + 0.5) * 480);
    const o = new Uint8Array(4); gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, o); return Array.from(o);
  };
  return { error: gl.getError(), lit, foreign, px: pts.map(px) };
};
window.ready = true;
</script></body></html>`;

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/probe/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE); return; }   // not the root: U60 keeps that the landing page's
  const f = join(ROOT, url);
  if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': extname(f) === '.js' ? 'text/javascript' : extname(f) === '.json' ? 'application/json' : 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/probe/`);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 20000 });
  const p = await page.evaluate(() => window.probe);
  check('the pass builds', !p.err, p.err ?? '');
  check('its program links in a real WebGL2', p.linked === true);
  const lum = (c) => c[0] + c[1] + c[2];
  const eye = [0, 1.1, 5];
  // on each node's card (stood NODE_GLOW_PULL toward the eye): low on the herb (over its own picture), its crown's top,
  // its sides; the school's middle; and the bare floor between them
  const toward = (x) => { const d = Math.hypot(eye[0] - x, eye[2]); return [x + ((eye[0] - x) / d) * p.pull, (eye[2] / d) * p.pull]; };
  const [hx, hz] = toward(-1.5), [sx, sz] = toward(1.5);
  const pts = [[hx, 0.3, hz], [hx, 1.29, hz], [hx - 1.08, 0.3, hz], [sx, 0.2, sz], [0, 0.02, 3.2]];
  const bare = await page.evaluate(([e, q]) => window.draw(e, 7.25, 1, q, { glow: false }), [eye, pts]);
  const lit = await page.evaluate(([e, q]) => window.draw(e, 7.25, 1, q), [eye, pts]);
  if (shotsAt) await page.locator('#c').screenshot({ path: join(shotsAt, 'node_glow.png') });
  check('no GL error drawing it', lit.error === 0 && lit.drawn === 2, `error ${lit.error}, drawn ${lit.drawn}`);
  const add = lit.px.map((c, i) => [c[0] - bare.px[i][0], c[1] - bare.px[i][1], c[2] - bare.px[i][2]]);
  check('light low on the herb, over its own picture', lum(add[0]) > 40, `added ${JSON.stringify(add[0])} over ${JSON.stringify(bare.px[0])}`);
  check('slight - never a beacon', Math.max(...add[0]) < 140, JSON.stringify(add[0]));
  check('in Herbalism\'s orchid: red and blue over green', add[0][0] > add[0][1] && add[0][2] > add[0][1], JSON.stringify(add[0]));
  check('next to nothing at its crown and its sides', lum(add[1]) < 12 && lum(add[2]) < 12, `${JSON.stringify(add[1])} ${JSON.stringify(add[2])}`);
  check('the school in Fishing\'s blue', lum(add[3]) > 25 && add[3][2] > add[3][0], JSON.stringify(add[3]));
  check('the floor between them untouched', lum(add[4]) < 6, JSON.stringify(add[4]));
  // a wall in front hides the school's glow (depth-tested); the herb's stays
  const walled = await page.evaluate(([e, q]) => window.draw(e, 7.25, 1, q, { walled: true }), [eye, pts]);
  const wallBare = await page.evaluate(([e, q]) => window.draw(e, 7.25, 1, q, { walled: true, glow: false }), [eye, pts]);
  check('a wall in front hides it', Math.abs(lum(walled.px[3]) - lum(wallBare.px[3])) < 6 && lum(walled.px[0]) - lum(wallBare.px[0]) > 40, `behind the wall ${JSON.stringify(walled.px[3])} vs ${JSON.stringify(wallBare.px[3])}`);
  // the clock's wrap: a breath before it and a breath after, the same light
  const before = await page.evaluate(([e, q, t]) => window.draw(e, t, 1, q), [eye, pts, p.period - 1 / 240]);
  const after = await page.evaluate(([e, q, t]) => window.draw(e, t, 1, q), [eye, pts, 1 / 240]);
  const jump = before.px.map((c, i) => Math.abs(lum(c) - lum(after.px[i])));
  check('no jump where the clock wraps', Math.max(...jump) <= 12, jump.join(' '));
  const cold = await page.evaluate(([e, q]) => window.draw(e, 7.25, 0, q), [eye, pts]);
  check('unkindled, nothing glows', cold.px.every((c, i) => Math.abs(lum(c) - lum(bare.px[i])) < 3), JSON.stringify(cold.px));
  // AUDIT NODE-MARKS (the independent pass): the world host's own path, with the renderer's own typed camera - the pass
  // picked nothing for a Float32Array eye, so the glow was never built and never lit in the game
  const through = await page.evaluate(([e, q]) => window.throughPass(e, 5, q), [eye, [pts[0]]]);
  const throughBare = await page.evaluate(([e, q]) => window.draw(e, 7.25, 1, q, { glow: false }), [eye, [pts[0]]]);
  check('through the world host\'s pass, with a Float32Array camera, the herb is lit', through.lit === 1 && through.error === 0 && lum(through.px[0]) - lum(throughBare.px[0]) > 40, `lit ${through.lit}, foreign ${through.foreign}, ${JSON.stringify(through.px[0])} over ${JSON.stringify(throughBare.px[0])}`);
  check('no page error', errs.length === 0, errs.join('; '));
} finally {
  await browser.close();
  server.close();
}
const failed = out.filter((o) => !o).length;
console.log(`\n${out.length - failed}/${out.length} checks passed`);
process.exit(failed ? 1 : 0);
