// WB6a - THE DEADLANDS' SKY AND SEA, COMPILED, LINKED AND DRAWN IN A REAL BROWSER.
//
// node holds the pass's law (test/wb6a_deadlands.test.js drives it over a fake GL); what node cannot answer is whether
// the GLSL COMPILES and LINKS in a real WebGL2 context, whether the sky lands only where the court left the far plane
// clear (PERF2's law), and whether what lands is the Deadlands: a red overcast over the horizon, the beam standing over
// the great tower, the fire of the sea under the rim, and no edge between the sea and the sky. So: the repo's own
// modules served as they are (no bundler - every import in this chain is relative), the court drawn with its own art by
// a stand-in shader, the pass drawn by its own class after it, and the frame read back.
//
//     node tools/deadlandsProbe.mjs [--shots <dir>]     (writes arrive.png / up.png / over.png there when given)
import { chromium } from 'playwright';
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const shotsAt = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
const out = []; const check = (n, ok, d = '') => { out.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${d ? ` - ${d}` : ''}`); };
const W = 640, H = 400;

const PAGE = `<!doctype html><html><body style="margin:0;background:#000"><canvas id=c width=${W} height=${H}></canvas><script type=module>
import { buildCourtModel, courtToDungeon, COURT_FOG, LAVA_Y } from '/src/world/gateArena.js';
import { gateArt, courtArt } from '/src/world/gateArt.js';
import { DeadlandsRenderer, SIGIL_TOWER, VORTEX_ELEV } from '/src/render/deadlands.js';
const m = buildCourtModel();
const gl = document.getElementById('c').getContext('webgl2', { alpha: false, preserveDrawingBuffer: true });
const vs = \`#version 300 es
layout(location=0) in vec3 p; layout(location=1) in vec3 n; layout(location=2) in vec2 uv; uniform mat4 vp; out vec3 vn; out vec2 vuv;
void main(){ vn=n; vuv=uv; gl_Position=vp*vec4(p,1.0); }\`;
const fs = \`#version 300 es
precision highp float; in vec3 vn; in vec2 vuv; uniform sampler2D alb; uniform sampler2D emi; out vec4 o;
void main(){ float l = 0.25 + 0.5*max(dot(normalize(vn), normalize(vec3(0.2,0.6,-0.8))),0.0); o = vec4(texture(alb,vuv).rgb*l + texture(emi,vuv).rgb, 1.0); }\`;
const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
for (const [a, loc, k] of [[m.positions, 0, 3], [m.normals, 1, 3], [m.uvs, 2, 2]]) { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, a, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, k, gl.FLOAT, false, 0, 0); }
gl.bindVertexArray(null);
const tex = (img) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, img.width, img.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, img.colors); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT); return t; };
const T = new Map([...gateArt().map(([rec, a]) => ['38101/' + rec, a]), ...courtArt().map(([rec, a]) => ['38111/' + rec, a])].map(([k, a]) => [k, { alb: tex(a.albedo), emi: tex(a.emission) }]));
let pass = null, err = null;
try { pass = new DeadlandsRenderer(gl); } catch (e) { err = String(e.message ?? e); }
const persp = (f, a, n, fa) => { const t = 1 / Math.tan(f / 2); return new Float32Array([t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0]); };
const look = (e, c) => { const u = [0, 1, 0]; const z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]]; let l = Math.hypot(...z); z.forEach((v, i) => { z[i] = v / l; }); const x = [u[1] * z[2] - u[2] * z[1], u[2] * z[0] - u[0] * z[2], u[0] * z[1] - u[1] * z[0]]; l = Math.hypot(...x); x.forEach((v, i) => { x[i] = v / l; }); const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]]; return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]), -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]), -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]), 1]); };
const mul = (a, b) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
window.probe = { err, linked: pass ? [pass.sky, pass.sea].map((p) => gl.getProgramParameter(p, gl.LINK_STATUS)) : [] };
// where on the screen a direction lands, for a camera at eye looking at c
const project = (P, V, eye, d) => { const w = [eye[0] + d[0] * 1000, eye[1] + d[1] * 1000, eye[2] + d[2] * 1000, 1]; const m4 = mul(P, V); const c = [0, 1, 2, 3].map((r) => m4[r] * w[0] + m4[4 + r] * w[1] + m4[8 + r] * w[2] + m4[12 + r]); return [Math.round((c[0] / c[3] * 0.5 + 0.5) * ${W}), Math.round((0.5 - c[1] / c[3] * 0.5) * ${H})]; };
window.draw = (eyeL, atL, t) => {
  const eye = courtToDungeon(...eyeL), at = courtToDungeon(...atL);
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.depthMask(true); gl.enable(gl.CULL_FACE); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const P = persp(1.1, ${W} / ${H}, 0.1, 500), V = look(eye, at);
  gl.useProgram(pr); gl.uniformMatrix4fv(gl.getUniformLocation(pr, 'vp'), false, mul(P, V));
  gl.uniform1i(gl.getUniformLocation(pr, 'alb'), 0); gl.uniform1i(gl.getUniformLocation(pr, 'emi'), 1); gl.bindVertexArray(vao);
  for (const s of m.subMeshes) { const tt = T.get(s.textureArchive + '/' + s.textureRecord); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tt.alb); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tt.emi); gl.drawArrays(gl.TRIANGLES, s.startIndex, s.primitiveCount * 3); }
  gl.bindVertexArray(null); gl.activeTexture(gl.TEXTURE0);
  pass.draw(P, V, courtToDungeon(0, LAVA_Y, 0), t, { mode: 2, density: COURT_FOG.density, range: [0, 1], color: COURT_FOG.color, camPos: eye }, 1);
  const px = (xy) => { const b = new Uint8Array(4); gl.readPixels(xy[0], ${H} - 1 - xy[1], 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, b); return Array.from(b); };
  const dir = (az, el) => [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];
  const beamAt = project(P, V, eye, dir(SIGIL_TOWER.az, (SIGIL_TOWER.top + VORTEX_ELEV) / 2));
  return { error: gl.getError(), drawn: pass.drawn, beamAt, beam: px(beamAt), sky: px([${W} / 2 | 0, 12]), top: px([40, 12]), floor: px([${W} / 2 | 0, ${H} - 20]), below: [0.05, 0.12, 0.19, 0.26, 0.74, 0.81, 0.88, 0.95].flatMap((fx) => [0.62, 0.72, 0.82, 0.92].map((fy) => px([Math.round(${W} * fx), Math.round(${H} * fy)]))), mid: px([${W} / 2 | 0, ${H} / 2 | 0]),
    rim: [0.2, 0.35, 0.5, 0.65, 0.8].map((f) => px([Math.round(${W} * f), 8])) };
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
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/probe/`);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
  const p = await page.evaluate(() => window.probe);
  check('the pass builds', !p.err, p.err ?? '');
  check('both programs link in a real WebGL2', p.linked.length === 2 && p.linked.every(Boolean), JSON.stringify(p.linked));
  const lum = (c) => c[0] + c[1] + c[2];
  const red = (c) => c[0] > c[1] && c[0] > c[2];
  const arrive = await page.evaluate(() => window.draw([0, 1.7, 18], [0, 4, 0], 40));
  if (shotsAt) await page.locator('#c').screenshot({ path: join(shotsAt, 'arrive.png') });
  check('no GL error drawing it', arrive.error === 0, `error ${arrive.error}`);
  check('the sea, then the sky', JSON.stringify(arrive.drawn) === JSON.stringify(['sea', 'sky']), JSON.stringify(arrive.drawn));
  check('the overcast is the Deadlands\' red, and lit', red(arrive.sky) && lum(arrive.sky) > 30, JSON.stringify(arrive.sky));
  check('the beam burns over the great tower', arrive.beam[0] > 200 && arrive.beam[1] > 90, `${JSON.stringify(arrive.beam)} at ${JSON.stringify(arrive.beamAt)}`);
  check('the court\'s floor stands in front of the sky (its own dark, not the sky\'s red)', lum(arrive.floor) < lum(arrive.sky) + 60, `${JSON.stringify(arrive.floor)} vs ${JSON.stringify(arrive.sky)}`);
  const up = await page.evaluate(() => window.draw([0, 1.7, 18], [4, 30, -20], 120));
  if (shotsAt) await page.locator('#c').screenshot({ path: join(shotsAt, 'up.png') });
  check('the vortex\'s eye burns bright', lum(up.mid) > 250 || lum(up.beam) > 400, `${JSON.stringify(up.mid)} ${JSON.stringify(up.beam)}`);
  const over = await page.evaluate(() => window.draw([34, 30, 40], [0, -6, 0], 300));
  if (shotsAt) await page.locator('#c').screenshot({ path: join(shotsAt, 'over.png') });
  const hottest = over.below.reduce((a, c) => (lum(c) > lum(a) ? c : a));
  check('the sea burns round the court - crust plates over molten fire', red(hottest) && lum(hottest) > 200 && over.below.some((c) => lum(c) < lum(hottest) * 0.5), `hottest ${JSON.stringify(hottest)} of ${over.below.length}`);
  // no edge: along the top of the overview, where the sea's rim meets the sky, the colour moves smoothly
  const steps = over.rim.map((c, i, a) => (i ? Math.abs(lum(c) - lum(a[i - 1])) : 0));
  check('the sea\'s rim meets the sky with no edge', Math.max(...steps) < 60, JSON.stringify(over.rim));
  check('no page error', errs.length === 0, errs.join('; '));
} finally {
  await browser.close();
  server.close();
}
const failed = out.filter((o) => !o).length;
console.log(`\n${out.length - failed}/${out.length} checks passed`);
process.exit(failed ? 1 : 0);
