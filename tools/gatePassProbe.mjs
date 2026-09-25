// WB2 - THE GATE'S FIRE AND BEACON, COMPILED, LINKED AND DRAWN IN A REAL BROWSER.
//
// node holds the pass's law (test/wb2_gate.test.js drives it over a fake GL); what node cannot answer is whether the
// GLSL COMPILES and LINKS in a real WebGL2 context, whether the arch's profile survives as a uniform the optimiser did
// not drop, and whether the fire actually lands on the pixels between the horns - bright and hot when open, an ember
// when sealed - and the beacon on the sky over the crown. So: the repo's own modules served as they are (no bundler -
// every import in this chain is relative), the stone drawn with its own art by a stand-in shader, the pass drawn by
// its own class, and the frame read back.
//
//     node tools/gatePassProbe.mjs [--shots <dir>]     (writes open.png / sealed.png / far.png there when given)
import { chromium } from 'playwright';
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const shotsAt = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
const out = []; const check = (n, ok, d = '') => { out.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${d ? ` - ${d}` : ''}`); };

const PAGE = `<!doctype html><html><body style="margin:0;background:#000"><canvas id=c width=640 height=480></canvas><script type=module>
import { buildGateModel, gateArchProfile } from '/src/world/gateModel.js';
import { gateArt } from '/src/world/gateArt.js';
import { GatePassRenderer } from '/src/render/gatePass.js';
const m = buildGateModel();
const gl = document.getElementById('c').getContext('webgl2', { alpha: false, preserveDrawingBuffer: true });
const vs = \`#version 300 es
layout(location=0) in vec3 p; layout(location=1) in vec3 n; layout(location=2) in vec2 uv; uniform mat4 vp; out vec3 vn; out vec2 vuv;
void main(){ vn=n; vuv=uv; gl_Position=vp*vec4(p,1.0); }\`;
const fs = \`#version 300 es
precision highp float; in vec3 vn; in vec2 vuv; uniform sampler2D alb; uniform sampler2D emi; out vec4 o;
void main(){ float l = 0.2 + 0.6*max(dot(normalize(vn), normalize(vec3(0.5,0.6,0.6))),0.0); o = vec4(texture(alb,vuv).rgb*l + texture(emi,vuv).rgb, 1.0); }\`;
const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
for (const [a, loc, k] of [[m.positions, 0, 3], [m.normals, 1, 3], [m.uvs, 2, 2]]) { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, a, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, k, gl.FLOAT, false, 0, 0); }
gl.bindVertexArray(null);
const tex = (img) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, img.width, img.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, img.colors); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); return t; };
const T = new Map(gateArt().map(([rec, a]) => [rec, { alb: tex(a.albedo), emi: tex(a.emission) }]));
let pass = null, err = null;
try { pass = new GatePassRenderer(gl, gateArchProfile(m)); } catch (e) { err = String(e.message ?? e); }
const persp = (f, a, n, fa) => { const t = 1 / Math.tan(f / 2); return new Float32Array([t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0]); };
const look = (e, c) => { const u = [0, 1, 0]; const z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]]; let l = Math.hypot(...z); z.forEach((v, i) => { z[i] = v / l; }); const x = [u[1] * z[2] - u[2] * z[1], u[2] * z[0] - u[0] * z[2], u[0] * z[1] - u[1] * z[0]]; l = Math.hypot(...x); x.forEach((v, i) => { x[i] = v / l; }); const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]]; return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]), -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]), -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]), 1]); };
const mul = (a, b) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
window.probe = { err, linked: pass ? [pass.membrane, pass.beacon].map((p) => gl.getProgramParameter(p, gl.LINK_STATUS)) : [], profileLoc: pass ? !!pass.mu.uProfile : false };
window.draw = (eye, centre, open) => {
  gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.clearColor(0.05, 0.05, 0.08, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const proj = persp(0.9, 640 / 480, 0.1, 5000), view = look(eye, centre);
  gl.useProgram(pr); gl.uniformMatrix4fv(gl.getUniformLocation(pr, 'vp'), false, mul(proj, view));
  gl.uniform1i(gl.getUniformLocation(pr, 'alb'), 0); gl.uniform1i(gl.getUniformLocation(pr, 'emi'), 1); gl.bindVertexArray(vao);
  for (const s of m.subMeshes) { const t = T.get(s.textureRecord); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t.alb); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, t.emi); gl.drawArrays(gl.TRIANGLES, s.startIndex, s.primitiveCount * 3); }
  gl.bindVertexArray(null); gl.activeTexture(gl.TEXTURE0);
  pass.draw([{ origin: [0, 0, 0], yaw: 0, open, fade: 1 }], proj, view, new Float32Array(eye), 3.5, null);
  const px = (x, y) => { const b = new Uint8Array(4); gl.readPixels(x, 480 - 1 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, b); return Array.from(b); };
  return { error: gl.getError(), drawn: pass.drawn, centre: px(320, 250), sky: px(320, 30), corner: px(10, 470) };
};
window.ready = true;
</script></body></html>`;

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/probe/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE); return; }   // not the root: U60 keeps that the landing page's
  const f = join(ROOT, url);
  if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': extname(f) === '.js' ? 'text/javascript' : 'application/octet-stream' });
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
  check('both programs link in a real WebGL2', p.linked.length === 2 && p.linked.every(Boolean), JSON.stringify(p.linked));
  check('the arch\'s profile is a live uniform', p.profileLoc);
  const lum = (c) => c[0] + c[1] + c[2];
  const open = await page.evaluate(() => window.draw([0, 6.5, 24], [0, 6.5, 0], 1));
  if (shotsAt) await page.locator('#c').screenshot({ path: join(shotsAt, 'open.png') });
  check('no GL error drawing it', open.error === 0, `error ${open.error}`);
  check('the fire stands between the horns, hot and red', open.centre[0] > 150 && open.centre[0] > open.centre[2] * 2, JSON.stringify(open.centre));
  check('and not where no gate is', lum(open.corner) < 60, JSON.stringify(open.corner));
  const sealed = await page.evaluate(() => window.draw([0, 6.5, 24], [0, 6.5, 0], 0));
  if (shotsAt) await page.locator('#c').screenshot({ path: join(shotsAt, 'sealed.png') });
  check('sealed, the fire is an ember - dimmer than open', lum(sealed.centre) < lum(open.centre), `${JSON.stringify(sealed.centre)} vs ${JSON.stringify(open.centre)}`);
  const far = await page.evaluate(() => window.draw([0, 40, 900], [0, 200, 0], 1));
  if (shotsAt) await page.locator('#c').screenshot({ path: join(shotsAt, 'far.png') });
  check('nine hundred metres off, the beacon still stands on the sky', far.centre[0] > far.centre[2] + 20 || far.sky[0] > far.sky[2] + 20, `${JSON.stringify(far.centre)} ${JSON.stringify(far.sky)}`);
  check('no page error', errs.length === 0, errs.join('; '));
} finally {
  await browser.close();
  server.close();
}
const failed = out.filter((o) => !o).length;
console.log(`\n${out.length - failed}/${out.length} checks passed`);
process.exit(failed ? 1 : 0);
