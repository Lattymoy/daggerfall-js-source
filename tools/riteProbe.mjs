// AUDIT WB12d - THE FAITHFUL'S CIRCLE, COMPILED, LINKED AND DRAWN IN A REAL BROWSER.
//
// node holds the circle's law (test/net/gate/wb12d_rite_world.test.js drives the smoke's shaders through test/glsl.mjs and the
// stone over fakes); what node cannot answer is whether the smoke's GLSL COMPILES and LINKS in a real WebGL2 context,
// whether the frame's light survives as a uniform the optimiser did not drop, and what lands on the pixels: the
// fire's glow over the altar, the plume dark on a clear sky a kilometre and a half off and on the night's, gone in
// weather's fog; the sigil's burned earth from above, its cuts alight, the land showing past its ragged rim. So: the
// repo's own modules served as they are, the ground and the stone drawn with their own art by a stand-in shader (its
// alpha a cutout, as the world's), the smoke drawn by its own class, and the frame read back.
//
//     node tools/riteProbe.mjs [--shots <dir>]     (writes near / far / night / fog / side / mid / under / above .png there)
import { chromium } from 'playwright';
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FACING = 0.6;
const shotsAt = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
const out = []; const check = (n, ok, d = '') => { out.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${d ? ` - ${d}` : ''}`); };

const PAGE = `<!doctype html><html><body style="margin:0;background:#000"><canvas id=c width=640 height=480></canvas><script type=module>
import { buildRiteModel } from '/src/world/riteModel.js';
import { gateArt, riteArt } from '/src/world/gate/gateArt.js';
import { RiteSmokeRenderer } from '/src/render/riteSmoke.js';
const m = buildRiteModel(${FACING}, () => 0);
const gl = document.getElementById('c').getContext('webgl2', { alpha: false, preserveDrawingBuffer: true });
const vs = \`#version 300 es
layout(location=0) in vec3 p; layout(location=1) in vec3 n; layout(location=2) in vec2 uv; uniform mat4 vp; out vec3 vn; out vec2 vuv;
void main(){ vn=n; vuv=uv; gl_Position=vp*vec4(p,1.0); }\`;
const fs = \`#version 300 es
precision highp float; in vec3 vn; in vec2 vuv; uniform sampler2D alb; uniform sampler2D emi; uniform float light; uniform vec4 uFlat; out vec4 o;
void main(){
  if (uFlat.a > 0.0) { o = vec4(uFlat.rgb * light, 1.0); return; }
  vec4 a = texture(alb, vuv); if (a.a < 0.5) discard;
  float l = (0.2 + 0.6*max(dot(normalize(vn), normalize(vec3(0.5,0.6,0.6))),0.0)) * light;
  o = vec4(a.rgb*l + texture(emi,vuv).rgb, 1.0);
}\`;
const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
const mesh = (pos, nor, uv) => { const vao = gl.createVertexArray(); gl.bindVertexArray(vao); for (const [a, loc, k] of [[pos, 0, 3], [nor, 1, 3], [uv, 2, 2]]) { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, a, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, k, gl.FLOAT, false, 0, 0); } gl.bindVertexArray(null); return vao; };
const vao = mesh(m.positions, m.normals, m.uvs);
const G = 3000, ground = mesh(new Float32Array([-G, 0, -G, G, 0, G, G, 0, -G, -G, 0, -G, -G, 0, G, G, 0, G]), new Float32Array(18).map((_, i) => (i % 3 === 1 ? 1 : 0)), new Float32Array(12));
const tex = (img) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, img.width, img.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, img.colors); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); return t; };
const T = new Map([...gateArt(), ...riteArt()].map(([rec, a]) => [rec, { alb: tex(a.albedo), emi: tex(a.emission) }]));
let pass = null, err = null;
try { pass = new RiteSmokeRenderer(gl); } catch (e) { err = String(e.message ?? e); }
const persp = (f, a, n, fa) => { const t = 1 / Math.tan(f / 2); return new Float32Array([t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0]); };
const look = (e, c, u = [0, 1, 0]) => { const z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]]; let l = Math.hypot(...z); z.forEach((v, i) => { z[i] = v / l; }); const x = [u[1] * z[2] - u[2] * z[1], u[2] * z[0] - u[0] * z[2], u[0] * z[1] - u[1] * z[0]]; l = Math.hypot(...x); x.forEach((v, i) => { x[i] = v / l; }); const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]]; return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]), -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]), -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]), 1]); };
const mul = (a, b) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
window.probe = { err, linked: pass ? gl.getProgramParameter(pass.program, gl.LINK_STATUS) : false, lightLoc: pass ? !!pass.u.uLight : false };
/** one frame: the ground and the circle lit by \`light\`, the sky \`sky\`, the smoke under \`fog\`; the pixels at \`at\` world points read back */
window.draw = ({ eye, centre, up, sky, light, fog, smoke = true, at = [] }) => {
  gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.depthMask(true); gl.disable(gl.BLEND);
  gl.clearColor(...sky, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const proj = persp(0.9, 640 / 480, 0.1, 8000), view = look(eye, centre, up), vp = mul(proj, view);
  gl.useProgram(pr); gl.uniformMatrix4fv(gl.getUniformLocation(pr, 'vp'), false, vp); gl.uniform1f(gl.getUniformLocation(pr, 'light'), light);
  gl.uniform1i(gl.getUniformLocation(pr, 'alb'), 0); gl.uniform1i(gl.getUniformLocation(pr, 'emi'), 1);
  gl.uniform4f(gl.getUniformLocation(pr, 'uFlat'), 0.32, 0.36, 0.2, 1); gl.bindVertexArray(ground); gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.uniform4f(gl.getUniformLocation(pr, 'uFlat'), 0, 0, 0, 0); gl.bindVertexArray(vao);
  for (const s of m.subMeshes) { const t = T.get(s.textureRecord); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t.alb); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, t.emi); gl.drawArrays(gl.TRIANGLES, s.startIndex, s.primitiveCount * 3); }
  gl.bindVertexArray(null); gl.activeTexture(gl.TEXTURE0);
  if (smoke) pass.draw([{ origin: [0, 0, 0], fade: 1 }], proj, view, new Float32Array(eye), 37, fog ? { ...fog, camPos: new Float32Array(eye), light } : { mode: 0, camPos: new Float32Array(eye), light });
  const px = (x, y) => { const b = new Uint8Array(4); gl.readPixels(Math.round(x), Math.round(480 - 1 - y), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, b); return Array.from(b); };
  const scr = ([x, y, z]) => { const c = [0, 1, 2, 3].map((r) => vp[r] * x + vp[4 + r] * y + vp[8 + r] * z + vp[12 + r]); return [(c[0] / c[3] * 0.5 + 0.5) * 640, (0.5 - c[1] / c[3] * 0.5) * 480]; };
  const all = new Uint8Array(640 * 480 * 4); gl.readPixels(0, 0, 640, 480, gl.RGBA, gl.UNSIGNED_BYTE, all);
  let hot = 0; for (let i = 0; i < all.length; i += 4) if (all[i] > 90 && all[i] > all[i + 1] * 2) hot++;
  return { error: gl.getError(), drawn: pass.drawn, at: at.map((p) => px(...scr(p))), hot };
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
  await page.waitForFunction(() => window.ready === true, null, { timeout: 20000 }).catch((e) => { throw new Error(`${e.message}: ${errs.join('; ')}`); });
  const p = await page.evaluate(() => window.probe);
  check('the smoke\'s pass builds', !p.err, p.err ?? '');
  check('its program links in a real WebGL2', p.linked === true);
  check('the frame\'s light is a live uniform', p.lightLoc);
  const lum = (c) => c[0] + c[1] + c[2];
  const shot = async (name) => { if (shotsAt) await page.locator('#c').screenshot({ path: join(shotsAt, `${name}.png`) }); };
  const DAY = [0.62, 0.72, 0.86];
  // near: a fighter's eye 30 m off, the altar's top and the plume's first metres over it
  const near = await page.evaluate((sky) => window.draw({ eye: [0, 2.2, 30], centre: [0, 4, 0], sky, light: 1, at: [[0, 1.6, 0], [0, 14, 0], [0, 14, 60]] }), DAY);
  await shot('near');
  check('no GL error drawing it', near.error === 0, `error ${near.error}`);
  check('drawn', near.drawn === 1);
  check('the fire glows over the altar', near.at[0][0] > 90 && near.at[0][0] > near.at[0][2] * 1.6, JSON.stringify(near.at[0]));
  check('and is gone a few metres up, the smoke dark on the sky there', lum(near.at[1]) < lum(near.at[2]) * 0.6 && near.at[1][0] < near.at[1][2] * 1.4, `${JSON.stringify(near.at[1])} against ${JSON.stringify(near.at[2])}`);
  // far: a clear day's distance fog over 1.5 km - a dark line on the sky
  const fog = { mode: 1, range: new Float32Array([200, 1200]), density: 0 };
  const strip = [...Array(16).keys()].map((i) => { const h = (40 + i * 12) / 340; return [60 * h * h, 40 + i * 12, 24 * h * h]; });
  const mean = (px) => px.reduce((n, c) => n + lum(c), 0) / px.length;
  const beside = [[0, 160, 420]];
  const far = await page.evaluate(({ sky, fog, at }) => window.draw({ eye: [1500, 30, 0], centre: [0, 160, 0], sky, light: 1, fog, at }), { sky: DAY, fog, at: [...strip, ...beside] });
  await shot('far');
  check('a kilometre and a half off on a clear day, the plume dark on the sky', mean(far.at.slice(0, -1)) < lum(far.at.at(-1)) * 0.9, `${mean(far.at.slice(0, -1)).toFixed(0)} against ${lum(far.at.at(-1))}`);
  const NIGHT = [0.035, 0.04, 0.07];
  const night = await page.evaluate(({ sky, fog, at }) => window.draw({ eye: [1500, 30, 0], centre: [0, 160, 0], sky, light: 0, fog, at }), { sky: NIGHT, fog, at: [...strip, ...beside] });
  await shot('night');
  check('at night, darker than the sky - never a light in it', mean(night.at.slice(0, -1)) < lum(night.at.at(-1)) && night.at.every((c) => lum(c) <= lum(night.at.at(-1))), `${mean(night.at.slice(0, -1)).toFixed(1)} against ${lum(night.at.at(-1))}`);
  const thick = { mode: 2, range: new Float32Array([0, 1]), density: 0.01 };
  const fogged = await page.evaluate(({ sky, fog, at }) => window.draw({ eye: [1500, 30, 0], centre: [0, 160, 0], sky, light: 1, fog, at }), { sky: DAY, fog: thick, at: [...strip, ...beside] });
  await shot('fog');
  check('weather\'s fog takes it whole', fogged.at.every((c) => Math.abs(lum(c) - lum(fogged.at.at(-1))) <= 3), `${mean(fogged.at.slice(0, -1)).toFixed(1)} against ${lum(fogged.at.at(-1))}`);
  // and for the eye alone: from the north, where its lean shows; from 400 m; from under it at the altar
  if (shotsAt) {
    for (const [name, eye, centre] of [['side', [0, 30, 1200], [0, 170, 0]], ['mid', [0, 20, 400], [0, 120, 0]], ['under', [0, 2, 14], [0, 30, 0]]]) {
      await page.evaluate(({ eye, centre, sky, fog }) => window.draw({ eye, centre, sky, light: 1, fog }), { eye, centre, sky: DAY, fog });
      await shot(name);
    }
  }
  // above: the sigil from over the circle, the smoke left out to see it
  const r = 6.5, ang = FACING + Math.PI / 2;
  const above = await page.evaluate(({ ang }) => window.draw({ eye: [0, 26, 0.01], centre: [0, 0, 0], up: [Math.sin(0.6), 0, Math.cos(0.6)], sky: [0, 0, 0], light: 1, smoke: false,
    at: [[Math.sin(ang) * 3.4, 0, Math.cos(ang) * 3.4], [Math.sin(ang) * 7.6, 0, Math.cos(ang) * 7.6], [Math.sin(0.6) * 10, 0, Math.cos(0.6) * 10]] }), { ang });
  await shot('above');
  check('the burned earth within it', lum(above.at[0]) < lum(above.at[2]) * 0.8, `${JSON.stringify(above.at[0])} against the land ${JSON.stringify(above.at[2])}`);
  check('the land past its rim', lum(above.at[1]) === lum(above.at[2]), `${JSON.stringify(above.at[1])} against ${JSON.stringify(above.at[2])} (${r} m)`);
  check('its cuts alight', above.hot > 400, `${above.hot} px`);
  check('no page error', errs.length === 0, errs.join('; '));
} finally {
  await browser.close();
  server.close();
}
const failed = out.filter((o) => !o).length;
console.log(`\n${out.length - failed}/${out.length} checks passed`);
process.exit(failed ? 1 : 0);
