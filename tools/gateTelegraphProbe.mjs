// WB4a - THE BOSS'S TELEGRAPH, COMPILED, LINKED AND DRAWN IN A REAL BROWSER.
//
// node holds the telegraph's law (test/wb4_gate_boss.test.js: the shader's own reading held to the strike's law at
// every point of the floor, the pass over a fake GL); what node cannot answer is whether the GLSL COMPILES and LINKS in
// a real WebGL2 context, whether the targets' array survives as a uniform the optimiser did not drop, and whether the
// shape actually lands on the court's floor - bright where the slam lands, dark past its edge, dim through its
// wind-up, the nova's ring lit and its heart safe. So: the repo's own modules served as they are (no bundler), the
// court drawn with its own art by a stand-in shader, the pass drawn by its own class, and the frame read back.
//
//     node tools/gateTelegraphProbe.mjs [--shots <dir>]     (writes slam.png / windup.png / nova.png there when given)
import { chromium } from 'playwright';
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const shotsAt = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
const out = []; const check = (n, ok, d = '') => { out.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${d ? ` - ${d}` : ''}`); };

const PAGE = `<!doctype html><html><body style="margin:0;background:#000"><canvas id=c width=640 height=480></canvas><script type=module>
import { buildCourtModel, courtToDungeon } from '/src/world/gateArena.js';
import { courtArt, gateArt } from '/src/world/gateArt.js';
import { GateTelegraphRenderer, telegraphShape } from '/src/render/gateTelegraph.js';
import { ATTACKS } from '/src/net/gateBrain.js';
const m = buildCourtModel();
const gl = document.getElementById('c').getContext('webgl2', { alpha: false, preserveDrawingBuffer: true });
const vs = \`#version 300 es
layout(location=0) in vec3 p; layout(location=1) in vec3 n; layout(location=2) in vec2 uv; uniform mat4 vp; out vec3 vn; out vec2 vuv;
void main(){ vn=n; vuv=uv; gl_Position=vp*vec4(p,1.0); }\`;
const fs = \`#version 300 es
precision highp float; in vec3 vn; in vec2 vuv; uniform sampler2D alb; uniform sampler2D emi; out vec4 o;
void main(){ float l = 0.15 + 0.3*max(dot(normalize(vn), normalize(vec3(0.3,0.9,0.3))),0.0); o = vec4(texture(alb,vuv).rgb*l + texture(emi,vuv).rgb*0.3, 1.0); }\`;
const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
for (const [a, loc, k] of [[m.positions, 0, 3], [m.normals, 1, 3], [m.uvs, 2, 2]]) { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, a, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, k, gl.FLOAT, false, 0, 0); }
gl.bindVertexArray(null);
const tex = (img) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, img.width, img.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, img.colors); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT); return t; };
const T = new Map([...courtArt().map(([rec, a]) => [\`38111/\${rec}\`, a]), ...gateArt().map(([rec, a]) => [\`38101/\${rec}\`, a])].map(([k, a]) => [k, { alb: tex(a.albedo), emi: tex(a.emission) }]));
let pass = null, err = null;
try { pass = new GateTelegraphRenderer(gl); } catch (e) { err = String(e.message ?? e); }
const persp = (f, a, n, fa) => { const t = 1 / Math.tan(f / 2); return new Float32Array([t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0]); };
const look = (e, c) => { const u = [0, 1, 0]; const z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]]; let l = Math.hypot(...z); z.forEach((v, i) => { z[i] = v / l; }); const x = [u[1] * z[2] - u[2] * z[1], u[2] * z[0] - u[0] * z[2], u[0] * z[1] - u[1] * z[0]]; l = Math.hypot(...x); x.forEach((v, i) => { x[i] = v / l; }); const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]]; return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]), -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]), -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]), 1]); };
const mul = (a, b) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
window.probe = { err, linked: pass ? gl.getProgramParameter(pass.program, gl.LINK_STATUS) : false, pts: pass ? !!pass.u.uPts : false };
window.draw = (atk, phase, now) => {
  gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const eye = courtToDungeon(0, 30, 16), proj = persp(1.0, 640 / 480, 0.1, 600), view = look(eye, courtToDungeon(0, 0, 0)), vp = mul(proj, view);
  gl.useProgram(pr); gl.uniformMatrix4fv(gl.getUniformLocation(pr, 'vp'), false, vp);
  gl.uniform1i(gl.getUniformLocation(pr, 'alb'), 0); gl.uniform1i(gl.getUniformLocation(pr, 'emi'), 1); gl.bindVertexArray(vao);
  for (const s of m.subMeshes) { const t = T.get(\`\${s.textureArchive}/\${s.textureRecord}\`); if (!t) continue; gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t.alb); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, t.emi); gl.drawArrays(gl.TRIANGLES, s.startIndex, s.primitiveCount * 3); }
  gl.bindVertexArray(null); gl.activeTexture(gl.TEXTURE0);
  pass.draw(telegraphShape(atk, phase, now), proj, view, new Float32Array(eye), 3.5, null);
  // a point of the court (its frame, on the floor) to its pixel, read back
  const px = (cx, cz) => {
    const w = courtToDungeon(cx, 0, cz), c = [0, 1, 2, 3].map((r) => vp[r] * w[0] + vp[4 + r] * w[1] + vp[8 + r] * w[2] + vp[12 + r]);
    const x = Math.round((c[0] / c[3] * 0.5 + 0.5) * 640), y = Math.round((c[1] / c[3] * 0.5 + 0.5) * 480);
    const b = new Uint8Array(4); gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, b); return Array.from(b);
  };
  return { error: gl.getError(), drawn: pass.drawn, at: px(atk.x, atk.z), near: px(atk.x + 2, atk.z + 1), off: px(atk.x + 12, atk.z - 6), ring: px(atk.x + 10, atk.z) };
};
window.W = (key, over) => ({ i: 1, a: ATTACKS[key].id, at: 10000, x: 0, z: 0, yw: 0, tg: [], ...over });
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
  check('its program links in a real WebGL2', p.linked === true);
  check('the targets\' array is a live uniform', p.pts);
  const lum = (c) => c[0] + c[1] + c[2];
  const land = await page.evaluate(() => window.draw(window.W('slam', { x: -2, z: 1 }), 1, 10050));
  if (shotsAt) await page.locator('#c').screenshot({ path: join(shotsAt, 'slam.png') });
  check('no GL error drawing it', land.error === 0 && land.drawn === 1, `error ${land.error}, drawn ${land.drawn}`);
  check('the slam lands bright and hot where it lands', land.at[0] > 150 && land.at[0] > land.at[2] * 2, JSON.stringify(land.at));
  check('and not past its edge', lum(land.off) < lum(land.at) / 3, `${JSON.stringify(land.off)} vs ${JSON.stringify(land.at)}`);
  const wind = await page.evaluate(() => window.draw(window.W('slam', { x: -2, z: 1 }), 1, 10000 - 400));
  if (shotsAt) await page.locator('#c').screenshot({ path: join(shotsAt, 'windup.png') });
  check('through its wind-up it is dimmer than its landing', lum(wind.at) < lum(land.at), `${JSON.stringify(wind.at)} vs ${JSON.stringify(land.at)}`);
  const nova = await page.evaluate(() => window.draw(window.W('nova', { x: 0, z: 0 }), 2, 10050));
  if (shotsAt) await page.locator('#c').screenshot({ path: join(shotsAt, 'nova.png') });
  check('the nova\'s ring burns and its heart is safe', lum(nova.ring) > lum(nova.at) * 3, `${JSON.stringify(nova.ring)} vs ${JSON.stringify(nova.at)}`);
  check('no page error', errs.length === 0, errs.join('; '));
} finally {
  await browser.close();
  server.close();
}
const failed = out.filter((o) => !o).length;
console.log(`\n${out.length - failed}/${out.length} checks passed`);
process.exit(failed ? 1 : 0);
