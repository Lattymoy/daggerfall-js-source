// WB9c / WB9e - THE COURT'S CRYSTALS AND HIS BLOWS' FALL, COMPILED, LINKED AND DRAWN IN A REAL BROWSER.
//
// node holds both passes' law (test/net/gate/wb9c_gate_reckoning.test.js, test/net/gate/wb9e_gate_blows.test.js: the cluster's model,
// its growth, the sparks' flight and the meteor's fall in JS, the passes over a fake GL); what node cannot answer is
// whether their GLSL COMPILES and LINKS in a real WebGL2 context (GLSL ES 3.00 asks every uniform shared by the two
// stages to carry one precision - the crystal's glow once failed exactly there), and whether what they draw lands
// where the fight says: a crystal standing up out of the floor in its aspect's colour, gone to the floor once broken;
// a landing's sparks lighting the stone about it; the meteor burning in the sky over its mark. So: the repo's own
// modules served as they are (no bundler), the court drawn with its own art by a stand-in shader, each pass drawn by
// its own class, and the frame read back.
//
//     node tools/gateCourtFxProbe.mjs [--shots <dir>]     (writes crystal.png / burst.png / meteor.png there when given)
import { chromium } from 'playwright';
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const shotsAt = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
const out = []; const check = (n, ok, d = '') => { out.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${d ? ` - ${d}` : ''}`); };

const PAGE = `<!doctype html><html><body style="margin:0;background:#000"><canvas id=c width=640 height=480></canvas><script type=module>
import { buildCourtModel, courtToDungeon } from '/src/world/gate/gateArena.js';
import { courtArt, gateArt } from '/src/world/gate/gateArt.js';
import { CourtCrystalRenderer } from '/src/render/courtCrystals.js';
import { GateFxRenderer, FX_KINDS, meteorFall } from '/src/render/gate/gateFx.js';
import { ATTACKS, CRYSTAL_H } from '/src/net/gate/gateBrain.js';
const m = buildCourtModel();
const gl = document.getElementById('c').getContext('webgl2', { alpha: false, preserveDrawingBuffer: true });
const vs = \`#version 300 es
layout(location=0) in vec3 p; layout(location=1) in vec3 n; layout(location=2) in vec2 uv; uniform mat4 vp; out vec3 vn; out vec2 vuv;
void main(){ vn=n; vuv=uv; gl_Position=vp*vec4(p,1.0); }\`;
const fs = \`#version 300 es
precision highp float; in vec3 vn; in vec2 vuv; uniform sampler2D alb; uniform sampler2D emi; out vec4 o;
void main(){ float l = 0.1 + 0.2*max(dot(normalize(vn), normalize(vec3(0.3,0.9,0.3))),0.0); o = vec4(texture(alb,vuv).rgb*l + texture(emi,vuv).rgb*0.2, 1.0); }\`;
const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
for (const [a, loc, k] of [[m.positions, 0, 3], [m.normals, 1, 3], [m.uvs, 2, 2]]) { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, a, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, k, gl.FLOAT, false, 0, 0); }
gl.bindVertexArray(null);
const tex = (img) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, img.width, img.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, img.colors); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT); return t; };
const T = new Map([...courtArt().map(([rec, a]) => [\`38111/\${rec}\`, a]), ...gateArt().map(([rec, a]) => [\`38101/\${rec}\`, a])].map(([k, a]) => [k, { alb: tex(a.albedo), emi: tex(a.emission) }]));
let crystals = null, fx = null, err = null;
try { crystals = new CourtCrystalRenderer(gl); fx = new GateFxRenderer(gl); } catch (e) { err = String(e.message ?? e); }
const linked = (p) => !!p && gl.getProgramParameter(p, gl.LINK_STATUS) === true;
const persp = (f, a, n, fa) => { const t = 1 / Math.tan(f / 2); return new Float32Array([t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0]); };
const look = (e, c) => { const u = [0, 1, 0]; const z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]]; let l = Math.hypot(...z); z.forEach((v, i) => { z[i] = v / l; }); const x = [u[1] * z[2] - u[2] * z[1], u[2] * z[0] - u[0] * z[2], u[0] * z[1] - u[1] * z[0]]; l = Math.hypot(...x); x.forEach((v, i) => { x[i] = v / l; }); const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]]; return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]), -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]), -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]), 1]); };
const mul = (a, b) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
window.probe = { err, crystal: crystals ? [linked(crystals.program), linked(crystals.glowProgram)] : [false, false], fx: fx ? [linked(fx.sparks), linked(fx.meteor)] : [false, false] };
const eye = courtToDungeon(0, 18, 22), proj = persp(1.0, 640 / 480, 0.1, 600), view = look(eye, courtToDungeon(0, 2, 0)), vp = mul(proj, view);
const court = () => {
  gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.useProgram(pr); gl.uniformMatrix4fv(gl.getUniformLocation(pr, 'vp'), false, vp);
  gl.uniform1i(gl.getUniformLocation(pr, 'alb'), 0); gl.uniform1i(gl.getUniformLocation(pr, 'emi'), 1); gl.bindVertexArray(vao);
  for (const s of m.subMeshes) { const t = T.get(\`\${s.textureArchive}/\${s.textureRecord}\`); if (!t) continue; gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t.alb); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, t.emi); gl.drawArrays(gl.TRIANGLES, s.startIndex, s.primitiveCount * 3); }
  gl.bindVertexArray(null); gl.activeTexture(gl.TEXTURE0);
};
// a point of the court (its frame) to its pixel, read back
const px = (cx, cy, cz) => {
  const w = courtToDungeon(cx, cy, cz), c = [0, 1, 2, 3].map((r) => vp[r] * w[0] + vp[4 + r] * w[1] + vp[8 + r] * w[2] + vp[12 + r]);
  const x = Math.round((c[0] / c[3] * 0.5 + 0.5) * 640), y = Math.round((c[1] / c[3] * 0.5 + 0.5) * 480);
  const b = new Uint8Array(4); gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, b); return Array.from(b);
};
// one crystal on the floor at (4, 0, -2), in the Reckoning's crimson; broke: seconds since it broke (< 0 standing)
window.crystal = (broke) => {
  court();
  crystals.draw([{ at: courtToDungeon(4, 0, -2), yaw: 0.4, seed: 0.2, grow: 1, broke, hp: 1, flash: 0, color: [1, 0.18, 0.34], beam: courtToDungeon(0, 6, 0) }], proj, view, new Float32Array(eye), 3.5, null);
  return { error: gl.getError(), drawn: crystals.drawn, glowed: crystals.glowed, body: px(4, CRYSTAL_H * 0.4, -2), off: px(-6, 0, 5) };
};
// a slam's burst at (0, 0, 0), t seconds after it landed; and the meteor over its mark (-5, 3) at now
window.burst = (t) => {
  court();
  const before = [px(0.8, 0.6, 0.5), px(-0.6, 1.2, -0.4), px(0.3, 0.3, -0.9)];
  fx.draw([{ at: courtToDungeon(0, 0.1, 0), t, kind: FX_KINDS.slam, color: [1, 0.4, 0.08] }], null, proj, view, new Float32Array(eye), 3.5, null, 480);
  return { error: gl.getError(), bursts: fx.bursts, before, after: [px(0.8, 0.6, 0.5), px(-0.6, 1.2, -0.4), px(0.3, 0.3, -0.9)] };
};
window.meteor = (now) => {
  court();
  const fall = meteorFall({ a: ATTACKS.meteor.id, at: 10000, tg: [[-5, 3]] }, now);
  const at = fall ? fall.at : null, before = at ? px(at[0], at[1], at[2]) : null;
  fx.draw([], fall ? { at: courtToDungeon(at[0], at[1], at[2]), color: [1, 0.56, 0.06] } : null, proj, view, new Float32Array(eye), 3.5, null, 480);
  return { error: gl.getError(), meteors: fx.meteors, before, head: at ? px(at[0], at[1], at[2]) : null };
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
  check('both passes build', !p.err, p.err ?? '');
  check('the crystal and its glow link in a real WebGL2', p.crystal[0] && p.crystal[1], JSON.stringify(p.crystal));
  check('the sparks and the meteor link in a real WebGL2', p.fx[0] && p.fx[1], JSON.stringify(p.fx));
  const lum = (c) => c[0] + c[1] + c[2];
  const stand = await page.evaluate(() => window.crystal(-1));
  if (shotsAt) await page.locator('#c').screenshot({ path: join(shotsAt, 'crystal.png') });
  check('no GL error drawing a crystal, its pool and its beam', stand.error === 0 && stand.drawn === 1 && stand.glowed === 2, `error ${stand.error}, drawn ${stand.drawn}, glowed ${stand.glowed}`);
  check('it stands up out of the floor in its crimson', stand.body[0] > 90 && stand.body[0] > stand.body[1] * 1.6, JSON.stringify(stand.body));
  const gone = await page.evaluate(() => window.crystal(5));
  check('long broken, it is gone to the floor', lum(gone.body) < lum(stand.body) / 2 && gone.glowed === 0, `${JSON.stringify(gone.body)} vs ${JSON.stringify(stand.body)}`);
  const land = await page.evaluate(() => window.burst(0.12));
  if (shotsAt) await page.locator('#c').screenshot({ path: join(shotsAt, 'burst.png') });
  check('no GL error drawing a landing\'s sparks', land.error === 0 && land.bursts === 1, `error ${land.error}, bursts ${land.bursts}`);
  const lit = land.after.reduce((s, c) => s + lum(c), 0) - land.before.reduce((s, c) => s + lum(c), 0);
  check('the sparks light the stone about the landing', lit > 60, `${lit} added over ${JSON.stringify(land.before)}`);
  const spent = await page.evaluate(() => window.burst(5));
  check('spent, a burst draws nothing', spent.bursts === 0);
  const fall = await page.evaluate(() => window.meteor(10000 - 60));   // the last of its fall, over the court in view
  if (shotsAt) await page.locator('#c').screenshot({ path: join(shotsAt, 'meteor.png') });
  check('no GL error drawing the meteor', fall.error === 0 && fall.meteors === 1, `error ${fall.error}, meteors ${fall.meteors}`);
  check('its stone burns bright where it is falling', !!fall.head && fall.head[0] > 200 && lum(fall.head) > lum(fall.before) + 150, `${JSON.stringify(fall.head)} over ${JSON.stringify(fall.before)}`);
  check('no page error', errs.length === 0, errs.join('; '));
} finally {
  await browser.close();
  server.close();
}
const failed = out.filter((o) => !o).length;
console.log(`\n${out.length - failed}/${out.length} checks passed`);
process.exit(failed ? 1 : 0);
