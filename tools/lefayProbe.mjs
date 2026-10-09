// LEFAY1 - THE MONUMENT TO JULIAN LEFAY, DRAWN IN A REAL BROWSER.
//
// node holds its law (test/lefay1_monument.test.js: the spot, the faces outward, the plaque's corners, the art); what
// node cannot answer is what lands on the pixels drawn AS THE GAME DRAWS (world/mat4.js THE HANDEDNESS LAW: the
// projection mirrored in x, the front faces clockwise on screen) with the back faces culled: its steps, its pedestal,
// the cornice's underside and its obelisk all drawn from outside, and the plaque's inscription READING the right way
// round - not mirrored, not upside down - where the viewer sees it on the screen. AUDIT LEFAY1 A1: the first cut drew
// with a plain projection, the mirror of the game's, and so certified a plaque the game shows backwards. So: the repo's own modules served as they are, the stone drawn with
// its own art by a stand-in shader (riteProbe.mjs's), the flowers' rests marked by small swatches (their pictures are
// the player's ARENA2, which no probe carries), and the frame read back.
//
//     node tools/lefayProbe.mjs [--shots <dir>]     (writes front / quarter / plaque / above .png there)
import { chromium } from 'playwright';
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const shotsAt = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
const out = []; const check = (n, ok, d = '') => { out.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${d ? ` - ${d}` : ''}`); };

const PAGE = `<!doctype html><html><body style="margin:0;background:#000"><canvas id=c width=640 height=480></canvas><script type=module>
import { buildLefayModel, flowerPlace, FLOWER_RINGS, PLAQUE, PEDESTAL } from '/src/world/lefayMonument.js';
import { lefayArt, LEFAY_PLAQUE_W, LEFAY_PLAQUE_H } from '/src/world/lefayArt.js';
import { mirrorProjectionX } from '/src/world/mat4.js';
const m = buildLefayModel();
const gl = document.getElementById('c').getContext('webgl2', { alpha: false, preserveDrawingBuffer: true });
const vs = \`#version 300 es
layout(location=0) in vec3 p; layout(location=1) in vec3 n; layout(location=2) in vec2 uv; uniform mat4 vp; out vec3 vn; out vec2 vuv;
void main(){ vn=n; vuv=uv; gl_Position=vp*vec4(p,1.0); }\`;
const fs = \`#version 300 es
precision highp float; in vec3 vn; in vec2 vuv; uniform sampler2D alb; uniform vec4 uFlat; uniform float lit; out vec4 o;
void main(){
  if (uFlat.a > 0.0) { o = vec4(uFlat.rgb, 1.0); return; }
  float l = lit > 0.5 ? 0.35 + 0.65*max(dot(normalize(vn), normalize(vec3(0.5,0.7,0.4))),0.0) : 1.0;
  o = vec4(texture(alb, vuv).rgb*l, 1.0);
}\`;
const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
const mesh = (pos, nor, uv) => { const vao = gl.createVertexArray(); gl.bindVertexArray(vao); for (const [a, loc, k] of [[pos, 0, 3], [nor, 1, 3], [uv, 2, 2]]) { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, a, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, k, gl.FLOAT, false, 0, 0); } gl.bindVertexArray(null); return vao; };
const vao = mesh(m.positions, m.normals, m.uvs);
const G = 400, ground = mesh(new Float32Array([-G, 0, -G, G, 0, G, G, 0, -G, -G, 0, -G, -G, 0, G, G, 0, G]), new Float32Array(18).map((_, i) => (i % 3 === 1 ? 1 : 0)), new Float32Array(12));
// the flowers' rests: a small upright cross at each of a few, one on each ring
const fl = []; const rests = [[0, 0, 0, 4], [40, 1, 1, 5], [80, 2, 2, 3], [120, 3, 3, 6], [330, 4, 0, 9], [300, 0, 1, 0], [270, 1, 2, 9], [250, 2, 3, 0]];
for (const e of rests) { const [x, y, z] = flowerPlace(e), s = 0.12, h = 0.3; fl.push(x - s, y, z, x + s, y, z, x + s, y + h, z, x - s, y, z, x + s, y + h, z, x - s, y + h, z, x, y, z - s, x, y, z + s, x, y + h, z + s, x, y, z - s, x, y + h, z + s, x, y + h, z - s); }
const flowers = mesh(new Float32Array(fl), new Float32Array(fl.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), new Float32Array(fl.length / 3 * 2));
const tex = (img) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, img.width, img.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, img.colors); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); return t; };
const art = lefayArt();
const T = new Map(art.map(([rec, a]) => [rec, tex(a)]));
const plaqueImg = art.find(([rec]) => rec === 3)[1];
const persp = (f, a, n, fa) => { const t = 1 / Math.tan(f / 2); return new Float32Array([t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0]); };
const look = (e, c, u = [0, 1, 0]) => { const z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]]; let l = Math.hypot(...z); z.forEach((v, i) => { z[i] = v / l; }); const x = [u[1] * z[2] - u[2] * z[1], u[2] * z[0] - u[0] * z[2], u[0] * z[1] - u[1] * z[0]]; l = Math.hypot(...x); x.forEach((v, i) => { x[i] = v / l; }); const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]]; return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]), -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]), -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]), 1]); };
const mul = (a, b) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
const ux = (k) => gl.getUniformLocation(pr, k);
/** one frame from \`eye\` at \`centre\`, culled as the world's pass culls; \`lit\` off draws the art flat (for the plaque's read) */
window.draw = ({ eye, centre, up, fov = 0.9, lit = true, at = [] }) => {
  gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(gl.CW);   // the renderer's own (HANDEDNESS)
  gl.clearColor(0.62, 0.72, 0.86, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const proj = mirrorProjectionX(persp(fov, 640 / 480, 0.05, 1000)), view = look(eye, centre, up), vp = mul(proj, view);   // the game's lens
  gl.useProgram(pr); gl.uniformMatrix4fv(ux('vp'), false, vp); gl.uniform1i(ux('alb'), 0); gl.uniform1f(ux('lit'), lit ? 1 : 0);
  gl.uniform4f(ux('uFlat'), 0.32, 0.36, 0.2, 1); gl.bindVertexArray(ground); gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.disable(gl.CULL_FACE); gl.uniform4f(ux('uFlat'), 0.85, 0.12, 0.2, 1); gl.bindVertexArray(flowers); gl.drawArrays(gl.TRIANGLES, 0, fl.length / 3); gl.enable(gl.CULL_FACE);
  gl.uniform4f(ux('uFlat'), 0, 0, 0, 0); gl.bindVertexArray(vao);
  for (const s of m.subMeshes) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T.get(s.textureRecord)); gl.drawArrays(gl.TRIANGLES, s.startIndex, s.primitiveCount * 3); }   // its indices are its vertices in order
  gl.bindVertexArray(null);
  const scr = ([x, y, z]) => { const c = [0, 1, 2, 3].map((r) => vp[r] * x + vp[4 + r] * y + vp[8 + r] * z + vp[12 + r]); return [(c[0] / c[3] * 0.5 + 0.5) * 640, (0.5 - c[1] / c[3] * 0.5) * 480]; };
  const all = new Uint8Array(640 * 480 * 4); gl.readPixels(0, 0, 640, 480, gl.RGBA, gl.UNSIGNED_BYTE, all);
  const px = ([x, y]) => { const i = ((480 - 1 - Math.round(y)) * 640 + Math.round(x)) * 4; return [all[i], all[i + 1], all[i + 2]]; };
  return { error: gl.getError(), at: at.map((p) => px(scr(p))), scr: at.map(scr) };
};
/** THE PLAQUE READ BACK, on each face: looked at square, the plaque's rectangle ON THE SCREEN found from its corners,
 *  and the screen sampled across it left to right and top to bottom - what the viewer reads - set against the picture
 *  as drawn, mirrored, and upside down: each a correlation of luminance. Nothing here asks the mesh where a texel is. */
window.readPlaque = (k = 0) => {
  const d = PEDESTAL.dieHalf + PLAQUE.proud, a = (k * Math.PI) / 2, c = Math.cos(a), s = Math.sin(a);
  const eye = [c * (d + 1.6), PLAQUE.mid, s * (d + 1.6)], centre = [c * d, PLAQUE.mid, s * d];
  window.draw({ eye, centre, lit: false });
  const all = new Uint8Array(640 * 480 * 4); gl.readPixels(0, 0, 640, 480, gl.RGBA, gl.UNSIGNED_BYTE, all);
  const vp = mul(mirrorProjectionX(persp(0.9, 640 / 480, 0.05, 1000)), look(eye, centre));
  const scr = ([x, y, z]) => { const q = [0, 1, 2, 3].map((r) => vp[r] * x + vp[4 + r] * y + vp[8 + r] * z + vp[12 + r]); return [(q[0] / q[3] * 0.5 + 0.5) * 640, (0.5 - q[1] / q[3] * 0.5) * 480]; };
  const corners = [-1, 1].flatMap((sa) => [-1, 1].map((sy) => scr([c * d - s * sa * PLAQUE.w / 2, PLAQUE.mid + sy * PLAQUE.h / 2, s * d + c * sa * PLAQUE.w / 2])));
  const left = Math.min(...corners.map((p) => p[0])), right = Math.max(...corners.map((p) => p[0]));
  const top = Math.min(...corners.map((p) => p[1])), bottom = Math.max(...corners.map((p) => p[1]));
  const lumAt = (img, x, y) => { const i = (y * img.width + x) * 4; return img.colors[i] + img.colors[i + 1] + img.colors[i + 2]; };
  const seen = [], drawn = [], mirrored = [], flipped = [];
  for (let ty = 2; ty < LEFAY_PLAQUE_H; ty += 3) for (let tx = 2; tx < LEFAY_PLAQUE_W; tx += 3) {
    const sx = left + ((tx + 0.5) / LEFAY_PLAQUE_W) * (right - left), sy = top + ((ty + 0.5) / LEFAY_PLAQUE_H) * (bottom - top);
    const i = ((480 - 1 - Math.round(sy)) * 640 + Math.round(sx)) * 4;
    seen.push(all[i] + all[i + 1] + all[i + 2]);
    drawn.push(lumAt(plaqueImg, tx, ty)); mirrored.push(lumAt(plaqueImg, LEFAY_PLAQUE_W - 1 - tx, ty)); flipped.push(lumAt(plaqueImg, tx, LEFAY_PLAQUE_H - 1 - ty));
  }
  const corr = (a, b) => { const n = a.length, ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n; let c = 0, va = 0, vb = 0; for (let i = 0; i < n; i++) { c += (a[i] - ma) * (b[i] - mb); va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; } return c / Math.sqrt(va * vb); };
  return { drawn: corr(seen, drawn), mirrored: corr(seen, mirrored), flipped: corr(seen, flipped) };
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
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/probe/`);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 20000 }).catch((e) => { throw new Error(`${e.message}: ${errs.join('; ')}`); });
  const shot = async (name) => { if (shotsAt) await page.locator('#c').screenshot({ path: join(shotsAt, `${name}.png`) }); };
  const SKY = [158, 184, 219];
  const near = (a, b, t = 12) => a.every((v, i) => Math.abs(v - b[i]) <= t);
  // from the east, a few paces off: every part of it drawn from outside with the back faces culled
  const front = await page.evaluate(() => window.draw({ eye: [9, 1.7, 0], centre: [0, 2.6, 0],
    at: [[0.73, 1.45, 0.3], [0.4, 4.2, 0], [0.12, 6.6, 0], [2.5, 0.15, 0], [1.9, 0.45, 0], [1.4, 0.75, 0.2], [-3, 5, 3]] }));   // the plaque under its lines, clear of the letters
  await shot('front');
  check('no GL error drawing it', front.error === 0, `error ${front.error}`);
  const [plaque, obelisk, gilt, step0, step1, step2, over] = front.at;
  check('the plaque drawn, bronze', plaque[0] > plaque[2] + 20 && plaque[0] < 220, JSON.stringify(plaque));
  check('the obelisk drawn, pale marble', obelisk.every((c) => c > 110) && Math.abs(obelisk[0] - obelisk[2]) < 40, JSON.stringify(obelisk));
  check('its point drawn, gilt', gilt[0] > gilt[2] + 40, JSON.stringify(gilt));
  for (const [n, c] of [['lowest', step0], ['middle', step1], ['top', step2]]) check(`the ${n} step drawn, granite (not culled away to the sky or the ground)`, !near(c, SKY) && Math.abs(c[0] - c[2]) < 30 && c[0] > 30, JSON.stringify(c));
  check('the sky beside its point', near(over, SKY), JSON.stringify(over));
  // from the other three sides: the plaque there too
  for (const [n, eye, p] of [['north', [0, 1.7, 9], [-0.3, 1.45, 0.73]], ['west', [-9, 1.7, 0], [-0.73, 1.45, -0.3]], ['south', [0, 1.7, -9], [0.3, 1.45, -0.73]]]) {
    const r = await page.evaluate(({ eye, p }) => window.draw({ eye, centre: [0, 2.6, 0], at: [p] }), { eye, p });
    check(`the ${n} face's plaque drawn`, r.at[0][0] > r.at[0][2] + 20, JSON.stringify(r.at[0]));
  }
  // THE INSCRIPTION READS, on every face: looked at square, the face is the picture - not its mirror, not upside down
  for (let k = 0; k < 4; k++) {
    const read = await page.evaluate((k) => window.readPlaque(k), k);
    if (k === 0) await shot('plaque');
    check(`face ${k}: the inscription reads the right way round`, read.drawn > 0.6 && read.drawn > read.mirrored + 0.3 && read.drawn > read.flipped + 0.3,
      `as drawn ${read.drawn.toFixed(2)}, mirrored ${read.mirrored.toFixed(2)}, upside down ${read.flipped.toFixed(2)}`);
  }
  // AUDIT LEFAY1 A2: the cornice's underside, from the ground under its overhang - stone, never the sky through it
  const under = await page.evaluate(() => window.draw({ eye: [3, 1.7, 0], centre: [0.78, 2.45, 0], at: [[0.78, 2.449, 0], [0.78, 2.449, 0.3]] }));
  for (const c of under.at) check('the cornice\'s underside drawn, marble', !near(c, SKY) && c[0] > 60, JSON.stringify(c));
  if (shotsAt) {
    await page.evaluate(() => window.draw({ eye: [7, 3.2, 6], centre: [0, 2.4, 0] }));
    await shot('quarter');
    await page.evaluate(() => window.draw({ eye: [0.01, 16, 0], centre: [0, 0, 0], up: [0, 0, -1] }));
    await shot('above');
  }
  check('no page error', errs.length === 0, errs.join('; '));
} finally {
  await browser.close();
  server.close();
}
const failed = out.filter((o) => !o).length;
console.log(failed ? `${failed} FAILED` : 'all ok');
process.exit(failed ? 1 : 0);
