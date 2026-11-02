// STOREFRONT (2026-10-29; bible/06-Systems/Battle-Pass.md section 6) - A BRASS FISSURE, DRAWN IN A REAL BROWSER.
//
// node holds the fissure's law and its model over fakes (test/scenes/season_world.test.js); what node cannot answer is
// what lands on the pixels with the faces culled as the world culls them: every slab, cog, pipe and pillar wound to face
// out (a face wound in is a hole you see through), the crack's blue lit on a night's dark ground, the scorch darker than
// the land past it. So: the repo's own modules served as they are (the rite's probe's way, tools/riteProbe.mjs), the
// floor and the wreckage drawn with their own art by a stand-in shader, back faces culled, and the frame read back.
//
//     node tools/fissureProbe.mjs [--shots <dir>]     (writes near / night / above / low .png there; CHROMIUM=<path> for a
//                                                      browser outside Playwright's own)
import { chromium } from 'playwright';
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const shotsAt = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
const out = []; const check = (n, ok, d = '') => { out.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${d ? ` - ${d}` : ''}`); };

const PAGE = `<!doctype html><html><body style="margin:0;background:#000"><canvas id=c width=640 height=480></canvas><script type=module>
import { buildFissureModel, fissureLayout } from '/src/world/fissureModel.js';
import { fissureArt } from '/src/world/fissureArt.js';
const F = { n: 1, stage: 2, region: 17, k: 0 };
const h = (x, z) => 0.04 * x + 0.12 * Math.sin(z * 0.5);
const floorM = buildFissureModel(F, h, { solid: false }), solidM = buildFissureModel(F, h, { ground: false });
const gl = document.getElementById('c').getContext('webgl2', { alpha: false, preserveDrawingBuffer: true });
const vs = \`#version 300 es
layout(location=0) in vec3 p; layout(location=1) in vec3 n; layout(location=2) in vec2 uv; uniform mat4 vp; out vec3 vn; out vec2 vuv;
void main(){ vn=n; vuv=uv; gl_Position=vp*vec4(p,1.0); }\`;
const fs = \`#version 300 es
precision highp float; in vec3 vn; in vec2 vuv; uniform sampler2D alb; uniform sampler2D emi; uniform float light; uniform vec4 uFlat; uniform vec3 uFace; out vec4 o;
void main(){
  if (uFace.x > 0.0) { o = gl_FrontFacing ? vec4(0.0, 1.0, 0.0, 1.0) : vec4(1.0, 0.0, 0.0, 1.0); return; }
  if (uFlat.a > 0.0) { o = vec4(uFlat.rgb * light, 1.0); return; }
  vec4 a = texture(alb, vuv);
  float l = (0.2 + 0.6*max(dot(normalize(vn), normalize(vec3(0.5,0.6,0.6))),0.0)) * light;
  o = vec4(a.rgb*l + texture(emi,vuv).rgb, 1.0);
}\`;
const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
const mesh = (pos, nor, uv) => { const vao = gl.createVertexArray(); gl.bindVertexArray(vao); for (const [a, loc, k] of [[pos, 0, 3], [nor, 1, 3], [uv, 2, 2]]) { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, a, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, k, gl.FLOAT, false, 0, 0); } gl.bindVertexArray(null); return vao; };
const floor = mesh(floorM.positions, floorM.normals, floorM.uvs), solid = mesh(solidM.positions, solidM.normals, solidM.uvs);
const G = 3000, groundY = -0.02, ground = mesh(new Float32Array([-G, groundY, -G, G, groundY, G, G, groundY, -G, -G, groundY, -G, -G, groundY, G, G, groundY, G]), new Float32Array(18).map((_, i) => (i % 3 === 1 ? 1 : 0)), new Float32Array(12));
const tex = (img) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, img.width, img.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, img.colors); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT); return t; };
const T = new Map(fissureArt().map(([rec, a]) => [rec, { alb: tex(a.albedo), emi: tex(a.emission) }]));
const persp = (f, a, n, fa) => { const t = 1 / Math.tan(f / 2); return new Float32Array([t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0]); };
const look = (e, c, u = [0, 1, 0]) => { const z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]]; let l = Math.hypot(...z); z.forEach((v, i) => { z[i] = v / l; }); const x = [u[1] * z[2] - u[2] * z[1], u[2] * z[0] - u[0] * z[2], u[0] * z[1] - u[1] * z[0]]; l = Math.hypot(...x); x.forEach((v, i) => { x[i] = v / l; }); const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]]; return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]), -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]), -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]), 1]); };
const mul = (a, b) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
const L = fissureLayout(F);
window.layout = { pillar: [L.pillar.x, L.pillar.z], pipe: [L.pipe.x, L.pipe.z], cogs: L.cogs.map((c) => [c.x, c.z, c.r]), mid: [L.spine[13].x, L.spine[13].z] };
/** one frame: the land, the floor pulled toward the eye and the wreckage, lit by \`light\`; \`faces\` paints each face green
 *  seen from its front and red from its back, the culling off - a face wound in shows red */
window.draw = ({ eye, centre, up, sky, light, faces = false, at = [] }) => {
  gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND);
  if (faces) gl.disable(gl.CULL_FACE); else { gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); }
  gl.clearColor(...sky, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const proj = persp(0.9, 640 / 480, 0.1, 8000), view = look(eye, centre, up), vp = mul(proj, view);
  gl.useProgram(pr); gl.uniformMatrix4fv(gl.getUniformLocation(pr, 'vp'), false, vp); gl.uniform1f(gl.getUniformLocation(pr, 'light'), light);
  gl.uniform1i(gl.getUniformLocation(pr, 'alb'), 0); gl.uniform1i(gl.getUniformLocation(pr, 'emi'), 1);
  gl.uniform3f(gl.getUniformLocation(pr, 'uFace'), 0, 0, 0);
  gl.uniform4f(gl.getUniformLocation(pr, 'uFlat'), 0.32, 0.36, 0.2, 1); gl.bindVertexArray(ground); gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.uniform4f(gl.getUniformLocation(pr, 'uFlat'), 0, 0, 0, 0);
  const draw = (vao, m) => { gl.bindVertexArray(vao); for (const s of m.subMeshes) { const t = T.get(s.textureRecord); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t.alb); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, t.emi); gl.drawArrays(gl.TRIANGLES, s.startIndex, s.primitiveCount * 3); } };
  gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -4); draw(floor, floorM); gl.disable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(0, 0);
  if (faces) gl.uniform3f(gl.getUniformLocation(pr, 'uFace'), 1, 0, 0);
  draw(solid, solidM);
  gl.bindVertexArray(null); gl.activeTexture(gl.TEXTURE0);
  const px = (x, y) => { const b = new Uint8Array(4); gl.readPixels(Math.round(x), Math.round(480 - 1 - y), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, b); return Array.from(b); };
  const scr = ([x, y, z]) => { const c = [0, 1, 2, 3].map((r) => vp[r] * x + vp[4 + r] * y + vp[8 + r] * z + vp[12 + r]); return [(c[0] / c[3] * 0.5 + 0.5) * 640, (0.5 - c[1] / c[3] * 0.5) * 480]; };
  const all = new Uint8Array(640 * 480 * 4); gl.readPixels(0, 0, 640, 480, gl.RGBA, gl.UNSIGNED_BYTE, all);
  let blue = 0, red = 0, green = 0;
  for (let i = 0; i < all.length; i += 4) { if (all[i + 2] > 120 && all[i + 2] > all[i] * 1.8) blue++; if (all[i] === 255 && all[i + 1] === 0) red++; if (all[i + 1] === 255 && all[i] === 0) green++; }
  return { error: gl.getError(), at: at.map((p) => px(...scr(p))), blue, red, green };
};
window.ready = true;
</script></body></html>`;

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/probe/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE); return; }
  const f = join(ROOT, url);
  if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': extname(f) === '.js' ? 'text/javascript' : extname(f) === '.json' ? 'application/json' : 'application/octet-stream' });   // the law's tables are JSON modules
  res.end(readFileSync(f));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM, args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] } : {});   // CHROMIUM: a browser of another install
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/probe/`);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 20000 }).catch((e) => { throw new Error(`${e.message}: ${errs.join('; ')}`); });
  const lay = await page.evaluate(() => window.layout);
  const lum = (c) => c[0] + c[1] + c[2];
  const shot = async (name) => { if (shotsAt) await page.locator('#c').screenshot({ path: join(shotsAt, `${name}.png`) }); };
  const DAY = [0.62, 0.72, 0.86], NIGHT = [0.035, 0.04, 0.07];
  const near = await page.evaluate(() => window.draw({ eye: [9, 5, 14], centre: [0, 0.5, 0], sky: [0.62, 0.72, 0.86], light: 1, at: [] }));
  await shot('near');
  check('no GL error drawing it', near.error === 0, `error ${near.error}`);
  const night = await page.evaluate(() => window.draw({ eye: [9, 5, 14], centre: [0, 0.5, 0], sky: [0.035, 0.04, 0.07], light: 0.15 }));
  await shot('night');
  check('at night the crack\'s aetherium burns blue', night.blue > 600, `${night.blue} px`);
  const above = await page.evaluate(({ mid }) => window.draw({ eye: [0.01, 30, 0.02], centre: [0, 0, 0], up: [1, 0, 0], sky: [0, 0, 0], light: 1, at: [[mid[0], 0.1, mid[1]], [0, 0, 5.2], [14, 0, 10]] }), { mid: lay.mid });
  await shot('above');
  check('the scorch darker than the land past it', lum(above.at[1]) < lum(above.at[2]) * 0.8, `${JSON.stringify(above.at[1])} against ${JSON.stringify(above.at[2])}`);
  check('the crack\'s middle lit', above.at[0][2] > 120, JSON.stringify(above.at[0]));
  // every face wound outward: seen from all round, low and high, nothing of the wreckage shows its back
  let red = 0, green = 0;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    for (const [r, y] of [[16, 1.5], [14, 7]]) {
      const f = await page.evaluate(({ eye }) => window.draw({ eye, centre: [0, 0.6, 0], sky: [0, 0, 0], light: 1, faces: true }), { eye: [Math.cos(a) * r, y, Math.sin(a) * r] });
      red += f.red; green += f.green;
    }
  }
  check('every slab, cog, pipe and pillar face wound outward - none seen from its back', red === 0 && green > 20_000, `${red} back-facing px, ${green} front-facing`);
  if (shotsAt) {
    await page.evaluate(() => window.draw({ eye: [-12, 1.4, 7], centre: [0, 0.8, 0], sky: [0.62, 0.72, 0.86], light: 1 }));
    await shot('low');
  }
  check('no page error', errs.length === 0, errs.join('; '));
} finally {
  await browser.close();
  server.close();
}
const failed = out.filter((o) => !o).length;
console.log(failed ? `${failed} FAILED` : 'all ok');
process.exit(failed ? 1 : 0);
