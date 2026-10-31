// ARMORY (2026-10-28; bible/04-Characters/Aura-Armory.md section 9) - THE AURA ARMORY'S PIECES, COMPILED, LINKED AND DRAWN
// IN A REAL BROWSER, on the two bodies the game draws them over: a stand-in rig (render/auraPreview.js's figure, posed at
// rest) and an Eye of the Beholder sprite - its own idle picture on a card through its feet that writes depth, as the game
// stands one. Every piece's program must link; each must light its own part and not another's (the crown over the head,
// the heart on the chest from the front and none of it from behind, the legs' fire at the shins); nothing before it has
// kindled; no jump at the clock's wrap; and on the sprite, nothing of the chest from behind the card (THE CARD LAW).
// AUDIT ARMORY: and THE MORROWIND BODY - retail's own skeleton (test/fixtures/mw/retailRig.mjs) read by the game's own
// reader (fpArm armBonesInBody, what thirdBones and a peer's bonesOf answer), a mannequin on its bones for the eye, the
// pieces on its pose. Its mesh is Bethesda's and never ships; the bones are what the pieces hang on.
//
//     node tools/armoryProbe.mjs [--shots <dir>]
import { chromium } from 'playwright';
import http from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARMORY_PIECES } from '../src/net/armoryLaw.js';
import { AURA_CLOCK_PERIOD } from '../src/render/auraRing.js';
import { REST_POINTS, POSE_AT, newPose, poseFromBones } from '../src/render/armoryPose.js';
import { glowSpec, ARMORY_LEVEL, armoryWeaponStage as weaponStageOf } from '../src/systems/weaponGlow.js';
import { parseNif } from '../src/formats/morrowind/mwNifFile.js';
import { buildSkeleton, skeletonSpaceMatrices, GRAPH_ROOT } from '../src/formats/morrowind/mwSkin.js';
import { armBonesInBody } from '../src/combat/fpArm.js';
import { retailSkeleton } from '../test/fixtures/mw/retailRig.mjs';
import { ARMORY_BONES } from '../src/render/armoryPose.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const shotsAt = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
if (shotsAt) mkdirSync(shotsAt, { recursive: true });
const out = [];
const check = (n, ok, d = '') => {
  out.push(ok);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${d ? ` - ${d}` : ''}`);
};
const SPRITE = '/vendor/eye-of-the-beholder/Textures/112364/112364_0-0.png';
const MW_SK = buildSkeleton(parseNif(retailSkeleton()));
const MW_BONES = armBonesInBody(
  { skeleton: MW_SK, mats: skeletonSpaceMatrices(MW_SK, new Map(), GRAPH_ROOT) },
  ARMORY_BONES,
);
const BACK = '/vendor/eye-of-the-beholder/Textures/112364/112364_4-0.png';

const PAGE = `<!doctype html><html><body style="margin:0;background:#000"><canvas id=c width=480 height=640></canvas><script type=module>
import { ArmoryRenderer, armoryMotionStep, armoryPrograms } from '/src/render/armoryPass.js';
import { newPose, poseAtRest, poseFromFigure, poseFromBones, spriteMarks, POSE_AT as PT } from '/src/render/armoryPose.js';
import { previewMesh } from '/src/render/auraPreview.js';
import { ARMORY_PIECES } from '/src/net/armoryLaw.js';
const W = 480, H = 640;
const gl = document.getElementById('c').getContext('webgl2', { alpha: false, preserveDrawingBuffer: true, antialias: false });
const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
const prog = (vs, fs) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); return p; };
const boxes = prog(\`#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec3 aN; uniform mat4 vp; uniform float yaw; out vec3 n;
void main(){ float c = cos(yaw), s = sin(yaw); vec3 p = vec3(c * aP.x + s * aP.z, aP.y, -s * aP.x + c * aP.z); n = vec3(c * aN.x + s * aN.z, aN.y, -s * aN.x + c * aN.z); gl_Position = vp * vec4(p, 1.0); }\`, \`#version 300 es
precision highp float; in vec3 n; out vec4 o; void main(){ o = vec4(vec3(0.05, 0.05, 0.06) + vec3(0.06) * max(dot(normalize(n), normalize(vec3(0.3, 0.8, 0.5))), 0.0), 1.0); }\`);
const card = prog(\`#version 300 es
layout(location=0) in vec2 aC; uniform mat4 vp; uniform vec3 right; uniform vec2 size; out vec2 uv;
void main(){ uv = vec2(aC.x, 1.0 - aC.y); vec3 p = right * (aC.x - 0.5) * size.x + vec3(0.0, aC.y * size.y, 0.0); gl_Position = vp * vec4(p, 1.0); }\`, \`#version 300 es
precision highp float; in vec2 uv; uniform sampler2D tex; uniform float dim; out vec4 o; void main(){ vec4 c = texture(tex, uv); if (c.a < 0.5) discard; o = vec4(c.rgb * dim, 1.0); }\`);
const mesh = previewMesh();
const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, mesh.data, gl.STATIC_DRAW);
gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
const cvao = gl.createVertexArray(); gl.bindVertexArray(cvao);
const cb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, cb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.bindVertexArray(null);
// the picture's marks as the game reads them at its upload: its color32 pixels, bottom-up
const marksOf = (im) => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, im.width, im.height).data; const u = new Uint32Array(im.width * im.height); for (let r = 0; r < im.height; r++) for (let q = 0; q < im.width; q++) { const i = ((im.height - 1 - r) * im.width + q) * 4; u[r * im.width + q] = (d[i] | (d[i + 1] << 8) | (d[i + 2] << 16) | (d[i + 3] << 24)) >>> 0; } return spriteMarks(u, im.width, im.height); };
const load = (src) => new Promise((res) => { const im = new Image(); im.onload = () => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); res({ t, w: im.width, h: im.height, marks: marksOf(im) }); }; im.src = src; });
const sprites = { front: await load('${SPRITE}'), back: await load('${BACK}') };
// THE MORROWIND BODY: retail's skeleton's bones as the game reads them, and a mannequin of boxes on them for the eye
const MW_BONES = ${JSON.stringify(MW_BONES)};
const mwPose = newPose(); poseFromBones(MW_BONES, mwPose);
const mwMesh = (() => {
  const q = (n) => [mwPose.pts[PT[n]], mwPose.pts[PT[n] + 1], mwPose.pts[PT[n] + 2]];
  const sub = (a, b) => a.map((v, i) => v - b[i]), add = (a, b, k = 1) => a.map((v, i) => v + b[i] * k), nrm = (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const out = [];
  const box = (a, b, rx, rz) => {
    const u = nrm(sub(b, a)), s = nrm(cross(u, Math.abs(u[1]) > 0.9 ? [0, 0, 1] : [0, 1, 0])), t = cross(u, s);
    const c = (e, i, j) => add(add(e, s, i * rx), t, j * rz), A = [a, b];
    const quad = (p0, p1, p2, p3, n) => { for (const p of [p0, p1, p2, p0, p2, p3]) out.push(...p, ...n); };
    for (const [i, j, k, l, n] of [[[0, -1, -1], [1, -1, -1], [1, 1, -1], [0, 1, -1], t.map((v) => -v)], [[0, -1, 1], [1, -1, 1], [1, 1, 1], [0, 1, 1], t], [[0, -1, -1], [1, -1, -1], [1, -1, 1], [0, -1, 1], s.map((v) => -v)], [[0, 1, -1], [1, 1, -1], [1, 1, 1], [0, 1, 1], s]])
      quad(c(A[i[0]], i[1], i[2]), c(A[j[0]], j[1], j[2]), c(A[k[0]], k[1], k[2]), c(A[l[0]], l[1], l[2]), n);
    quad(c(a, -1, -1), c(a, 1, -1), c(a, 1, 1), c(a, -1, 1), u.map((v) => -v)); quad(c(b, -1, -1), c(b, 1, -1), c(b, 1, 1), c(b, -1, 1), u);
  };
  const head = q('head'), neck = q('neck');
  box(add(head, [0, -0.1, 0]), add(head, [0, 0.11, 0]), 0.085, 0.1);   // the head
  box(neck, add(head, [0, -0.08, 0]), 0.05, 0.05);
  box(q('pelvis'), add(neck, [0, -0.02, 0]), 0.16, 0.1);   // the trunk
  for (const s of ['L', 'R']) {
    box(q('sh' + s), q('el' + s), 0.052, 0.052); box(q('el' + s), q('wa' + s), 0.042, 0.042); box(q('wa' + s), add(q('wa' + s), [0, -0.1, 0.01]), 0.035, 0.045);
    box(q('hip' + s), q('kn' + s), 0.07, 0.07); box(q('kn' + s), add(q('ft' + s), [0, 0.02, 0]), 0.055, 0.055); box(add(q('ft' + s), [0, 0.03, -0.04]), add(q('ft' + s), [0, 0.03, 0.17]), 0.045, 0.03);
  }
  return new Float32Array(out);
})();
const mvao = gl.createVertexArray(); gl.bindVertexArray(mvao);
const mb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, mb); gl.bufferData(gl.ARRAY_BUFFER, mwMesh, gl.STATIC_DRAW);
gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12); gl.bindVertexArray(null);
let pass = null, err = null;
try { pass = new ArmoryRenderer(gl); } catch (e) { err = String(e.message ?? e); }
const logOf = (i) => { const [[vs, fs]] = armoryPrograms(i); const lg = []; for (const [t, s] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) lg.push(gl.getShaderInfoLog(x)); } if (!lg.length) { const pp = gl.createProgram(); for (const [t, s] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); gl.attachShader(pp, x); } gl.linkProgram(pp); if (!gl.getProgramParameter(pp, gl.LINK_STATUS)) lg.push(gl.getProgramInfoLog(pp)); } return lg.join(' / ') || 'no log'; };
const linked = pass ? ARMORY_PIECES.map((_, i) => { try { const P = pass.programOf(i, true); return (!!P && gl.getProgramParameter(P.prog, gl.LINK_STATUS)) || logOf(i); } catch (e) { return String(e.message ?? e); } }) : [];
const persp = (f, a, n, fa) => { const t = 1 / Math.tan(f / 2); return new Float32Array([t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0]); };
const look = (e, c) => { const u = [0, 1, 0]; const z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]]; let l = Math.hypot(...z); z.forEach((v, i) => { z[i] = v / l; }); const x = [u[1] * z[2] - u[2] * z[1], u[2] * z[0] - u[0] * z[2], u[0] * z[1] - u[1] * z[0]]; l = Math.hypot(...x); x.forEach((v, i) => { x[i] = v / l; }); const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]]; return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]), -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]), -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]), 1]); };
const mul = (a, b) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
/** Draw a body - 'mw' (retail's Morrowind skeleton, a mannequin on its bones), 'rig' (the stand-in, at rest) or 'sprite' (its picture on a card, 'front' or 'back') - wearing \`kit\` from
 *  \`eye\` at \`t\`, kindled \`kindle\`; read back \`pts\` (world) and the frame's brightest pixels in \`box\` rows. */
window.draw = ({ body = 'rig', kit, eye, t = 5.3, kindle = 1, pts = [], yaw = 0, side = 'front', at = [0, 1.0, 0], torn = -1, walk = 0, plain = false, arms = undefined, pixel = false }) => {   // AURA-PIXEL: \`pixel\` the law on - the designs are read per pixel
  const proj = persp(0.8, W / H, 0.05, 100), view = look(eye, at), vp = mul(proj, view);
  gl.viewport(0, 0, W, H); gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
  gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const pose = newPose();
  if (body === 'mw') {
    gl.useProgram(boxes); gl.uniformMatrix4fv(gl.getUniformLocation(boxes, 'vp'), false, vp); gl.uniform1f(gl.getUniformLocation(boxes, 'yaw'), yaw);
    gl.bindVertexArray(mvao); gl.drawArrays(gl.TRIANGLES, 0, mwMesh.length / 6);
    poseFromBones(MW_BONES, pose);
  } else if (body === 'rig') {
    gl.useProgram(boxes); gl.uniformMatrix4fv(gl.getUniformLocation(boxes, 'vp'), false, vp); gl.uniform1f(gl.getUniformLocation(boxes, 'yaw'), yaw);
    gl.bindVertexArray(vao); gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
    poseAtRest(pose);
  } else {
    const sp = sprites[side], mpp = 0.019;
    const right = [view[0], view[4], view[8]];
    gl.useProgram(card); gl.uniformMatrix4fv(gl.getUniformLocation(card, 'vp'), false, vp); gl.uniform3fv(gl.getUniformLocation(card, 'right'), right);
    gl.uniform2f(gl.getUniformLocation(card, 'size'), sp.w * mpp, sp.h * mpp); gl.uniform1f(gl.getUniformLocation(card, 'dim'), plain ? 1 : 0.35);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, sp.t); gl.uniform1i(gl.getUniformLocation(card, 'tex'), 0);
    gl.bindVertexArray(cvao); gl.drawArrays(gl.TRIANGLES, 0, 6);
    poseFromFigure({ base: 0, mpp, beast: false, marks: sp.marks, shift: 0 }, pose);
  }
  gl.bindVertexArray(null);
  const w = { at: [0, 0, 0], yaw, kit, pose, seed: 0.37, kindle, torn, mounted: false, _d: Math.hypot(...eye), ...(arms !== undefined ? { arms } : {}) };   // GUILD-SHOP: the armlet's guild's arms
  for (let i = 0; i <= 8; i++) { w.at[2] = walk * i * 0.1; armoryMotionStep(w, t - 0.8 + i * 0.1); }
  w.at[2] = walk * 0.8; w.at[2] = 0;
  pass.pixel = pixel;
  pass.draw([w], proj, view, new Float32Array(eye), t, null, true);
  pass.pixel = false;
  const px = (p) => {
    const c = [0, 1, 2, 3].map((r) => vp[r] * p[0] + vp[4 + r] * p[1] + vp[8 + r] * p[2] + vp[12 + r]);
    const x = Math.round((c[0] / c[3] * 0.5 + 0.5) * W), y = Math.round((c[1] / c[3] * 0.5 + 0.5) * H);
    if (!(c[3] > 0) || x < 0 || x >= W || y < 0 || y >= H) throw new Error('a point off the canvas: ' + p);
    let best = 0; const o = new Uint8Array(4);
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { gl.readPixels(x + dx, y + dy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, o); best = Math.max(best, o[0] + o[1] + o[2]); }
    return best;
  };
  const rows = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, rows);
  let lit = 0; for (let i = 0; i < rows.length; i += 4) if (rows[i] + rows[i + 1] + rows[i + 2] > 120) lit++;
  let glow = 0, same = 0;   // AURA-PIXEL: the lit pixels the same as their right-hand neighbour
  for (let i = 0; i < rows.length - 4; i += 4) if (rows[i] + rows[i + 1] + rows[i + 2] > 120 && (i / 4) % W !== W - 1) { glow++; if (rows[i] === rows[i + 4] && rows[i + 1] === rows[i + 5] && rows[i + 2] === rows[i + 6]) same++; }
  return { error: gl.getError(), drawn: pass.drawn, lit, same: glow ? same / glow : 0, px: pts.map(px), pose: Array.from(pose.pts), dx: Array.from(pose.dx), right: [view[0], view[4], view[8]], marks: body === 'sprite' ? sprites[side].marks : null };
};
window.probe = { err, linked };
window.ready = true;
</script></body></html>`;
/** The weapon piece's stage alone (render/weaponPiecePreview.js): a canvas the size the shop gives it, read at the blade's
 *  middle, a hair beside its edge and far off it. */
const STAGE_PAGE = `<!doctype html><html><body style="margin:0;background:#000"><canvas id=s style="width:300px;height:400px;display:block"></canvas><script type=module>
import { startWeaponPiecePreview, weaponPieceLayout } from '/src/render/weaponPiecePreview.js';
window.stageOf = (spec) => {
  const c = document.getElementById('s');
  window.live?.stop();
  const fresh = c.cloneNode(); c.replaceWith(fresh);
  const s = startWeaponPiecePreview(fresh, spec, { now: () => 1.5 });
  if (!s) return { ok: false };
  window.live = s; s.step();
  const gl = fresh.getContext('webgl2'), W = fresh.width, H = fresh.height, L = weaponPieceLayout(W, H, Math.max(...spec.win));
  const px = (x, y) => { const o = new Uint8Array(4); gl.readPixels(Math.round(x), Math.round(H - 1 - y), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, o); return Array.from(o.slice(0, 3)); };
  const mid = L.y + L.h * 0.4, edgeX = L.x + 10 * L.cell + L.cell * 0.5;
  return { ok: true, error: gl.getError(), blade: px(L.x + 7.5 * L.cell, mid), beside: px(edgeX, mid), far: [...px(4, 4), ...px(W - 5, H - 5)] };
};
</script></body></html>`;

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/probe/') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(PAGE);
    return;
  }
  if (url === '/stage/') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(STAGE_PAGE);
    return;
  }
  const f = join(ROOT, url);
  if (!f.startsWith(ROOT) || !existsSync(f)) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, {
    'content-type':
      extname(f) === '.js'
        ? 'text/javascript'
        : extname(f) === '.json'
          ? 'application/json'
          : extname(f) === '.png'
            ? 'image/png'
            : 'application/octet-stream',
  });
  res.end(readFileSync(f));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const at = (name) => {
  const i = POSE_AT[name];
  return [REST_POINTS[i], REST_POINTS[i + 1], REST_POINTS[i + 2]];
};
const MW_POSE = newPose();
poseFromBones(MW_BONES, MW_POSE);
try {
  const page = await browser.newPage({ viewport: { width: 480, height: 640 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text());
  });
  await page.goto(`http://127.0.0.1:${port}/probe/`);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 30000 });
  const p = await page.evaluate(() => window.probe);
  check('the pass builds', !p.err, p.err ?? '');
  ARMORY_PIECES.forEach((pc, i) =>
    check(
      `${pc.key}: its program links in a real WebGL2`,
      p.linked[i] === true,
      typeof p.linked[i] === 'string' ? p.linked[i].slice(0, 400) : '',
    ),
  );
  const draw = (o) => page.evaluate((x) => window.draw(x), o);
  const shot = async (name) => {
    if (shotsAt) await page.locator('#c').screenshot({ path: join(shotsAt, `${name}.png`) });
  };
  const FRONT = [0, 1.25, 2.6],
    BEHIND = [0, 1.25, -2.6],
    SIDE = [2.6, 1.25, 0.4];
  const head = at('head'),
    crownTop = [0, at('crown')[1] + 0.12, 0],
    chest = at('chest'),
    knee = at('knL'),
    shin = [at('ftL')[0], at('ftL')[1] + 0.1, 0.09];
  const rigKit = { full: 'aaaa0', eternal: 'bbbb0', none: null };
  // the rig, every Dagonfire piece at once
  const bare = await draw({ kit: '00000', eye: FRONT, pts: [crownTop, chest, shin] });
  const r = await draw({ kit: 'aaaa0', eye: FRONT, pts: [crownTop, chest, shin, [0.6, 1.0, 0], [0.5, 1.6, 0]] });
  await shot('rig_dagonfire_front');
  check(
    'the rig in Dagonfire: drawn without a GL error',
    r.error === 0 && r.drawn === 4,
    `error ${r.error}, drawn ${r.drawn}`,
  );
  check("the crown's horns burn over the head", r.px[0] > bare.px[0] + 90, `${r.px[0]} against ${bare.px[0]}`);
  check('the Ember Heart burns on the chest', r.px[1] > bare.px[1] + 90, `${r.px[1]} against ${bare.px[1]}`);
  check('the Cinderstride burns at the shins', r.px[2] > bare.px[2] + 60, `${r.px[2]} against ${bare.px[2]}`);
  check('nothing beside the body or beside the head', r.px[3] < 60 && r.px[4] < 60, `${r.px[3]}, ${r.px[4]}`);
  const backBare = await draw({ kit: '00000', eye: BEHIND, pts: [[chest[0], chest[1], -0.05]] });
  const back = await draw({ kit: '0a000', eye: BEHIND, pts: [[chest[0], chest[1], -0.05]] });
  await shot('rig_heart_behind');
  check(
    'the Ember Heart from behind: none of it through the body',
    back.px[0] <= backBare.px[0] + 12,
    `${back.px[0]} against the bare body's ${backBare.px[0]}`,
  );
  const cold = await draw({ kit: 'aaaa0', eye: FRONT, kindle: 0, pts: [crownTop, chest, shin] });
  check('nothing at all before it kindles', cold.lit === 0 && cold.drawn === 0, `${cold.lit} lit, ${cold.drawn} drawn`);
  const beast = await draw({ kit: 'aaaa0', eye: FRONT, torn: 1, pts: [crownTop, chest, shin] });
  await shot('rig_beast_dagonfire_front');
  check(
    'WOLF-KIT turned beast: the crown off, the heart and the stride still worn',
    beast.px[0] < bare.px[0] + 30 &&
      beast.px[1] > bare.px[1] + 90 &&
      beast.px[2] > bare.px[2] + 60 &&
      beast.drawn === 3,
    `${beast.px.join(', ')}, drawn ${beast.drawn}`,
  );
  const e = await draw({
    kit: 'bbbb0',
    eye: FRONT,
    pts: [[0, at('crown')[1] + 0.05, 0.17], chest, shin, [0.6, 1.0, 0]],
  });
  await shot('rig_eternal_front');
  check(
    'the rig in Eternal: drawn without a GL error',
    e.error === 0 && e.drawn === 4,
    `error ${e.error}, drawn ${e.drawn}`,
  );
  check(
    "the halo's spark at its front, the sigil on the chest, the greaves at the shins",
    e.px[0] > 120 && e.px[1] > 90 && e.px[2] > 60,
    e.px.join(', '),
  );
  check('the Eternal line beside the body: nothing', e.px[3] < 60, `${e.px[3]}`);
  const sideE = await draw({ kit: 'bbbb0', eye: SIDE, pts: [] });
  await shot('rig_eternal_side');
  const sideD = await draw({ kit: 'aaaa0', eye: SIDE, pts: [] });
  await shot('rig_dagonfire_side');
  check('from the side, both lines drawn', sideE.lit > 300 && sideD.lit > 300, `${sideE.lit}, ${sideD.lit}`);
  // the clock's wrap: the frame a hair before and after it nearly the same
  const before = await draw({ kit: 'aaaa0', eye: FRONT, t: AURA_CLOCK_PERIOD - 1 / 240, pts: [crownTop, chest, shin] });
  const after = await draw({ kit: 'aaaa0', eye: FRONT, t: 1 / 240, pts: [crownTop, chest, shin] });
  check(
    "no jump at the clock's wrap",
    before.px.every((v, i) => Math.abs(v - after.px[i]) < 60),
    `${before.px} against ${after.px}`,
  );
  // THE SPRITE: its own picture on a card through its feet
  const sb = await draw({ body: 'sprite', kit: '00000', eye: FRONT, pts: [] });
  const sf = await draw({ body: 'sprite', kit: 'aaaa0', eye: FRONT, pts: [], plain: true });
  await shot('sprite_dagonfire_front');
  const sp = sf.pose,
    spt = (n) => [
      sp[POSE_AT[n]] + sf.right[0] * sf.dx[POSE_AT[n] / 3],
      sp[POSE_AT[n] + 1],
      sp[POSE_AT[n] + 2] + sf.right[2] * sf.dx[POSE_AT[n] / 3],
    ];
  console.log('marks', JSON.stringify(sf.marks));
  const sc = await draw({ body: 'sprite', kit: '0a000', eye: FRONT, pts: [spt('chest')] });
  const sbkBare = await draw({
    body: 'sprite',
    kit: '00000',
    eye: BEHIND,
    side: 'back',
    yaw: 0,
    pts: [[spt('chest')[0], spt('chest')[1], 0]],
  });
  const sbk = await draw({
    body: 'sprite',
    kit: '0a000',
    eye: BEHIND,
    side: 'back',
    yaw: 0,
    pts: [[spt('chest')[0], spt('chest')[1], 0]],
  });
  await shot('sprite_heart_behind');
  check(
    'the sprite: drawn without a GL error',
    sf.error === 0 && sf.drawn === 4 && sb.lit < sf.lit,
    `error ${sf.error}, drawn ${sf.drawn}`,
  );
  check("THE CARD LAW: the heart on the sprite's chest from the front", sc.px[0] > 120, `${sc.px[0]}`);
  check(
    'THE CARD LAW: none of the heart through the card from behind',
    sbk.px[0] <= sbkBare.px[0] + 12,
    `${sbk.px[0]} against the bare card's ${sbkBare.px[0]}`,
  );
  await draw({ body: 'sprite', kit: 'bbbb0', eye: FRONT, pts: [], plain: true });
  await shot('sprite_eternal_front');
  await draw({ body: 'sprite', kit: 'aa000', eye: [0, 1.75, 1.3], at: [0, 1.7, 0], pts: [], plain: true });
  await shot('sprite_head_close');
  await draw({ body: 'sprite', kit: 'ba000', eye: [0.9, 1.75, 1.0], at: [0, 1.7, 0], pts: [], plain: true });
  await shot('sprite_halo_close');
  await draw({ body: 'sprite', kit: 'aaaa0', eye: [1.9, 1.3, 1.9], pts: [], plain: true });
  await shot('sprite_dagonfire_threequarter');
  await draw({ body: 'sprite', kit: 'bbbb0', eye: [1.9, 1.3, 1.9], pts: [], plain: true });
  await shot('sprite_eternal_threequarter');
  // GUILD-SHOP: THE INSIGNIA ARMLET - the wearer's left upper arm alone, its crest the guild's arms
  const ARMS = {
    heraldry: { field: 'crimson', border: 'gold', device: 'dragon', division: 'quarterly', field2: 'sable' },
    logo: null,
  };
  const armL = [at('shL')[0] - 0.02, at('shL')[1] - 0.1, 0.06],
    armR = [at('shR')[0] + 0.02, at('shR')[1] - 0.1, 0.06];
  const armBare = await draw({ kit: '00000', eye: FRONT, pts: [armL, armR] });
  const arm = await draw({ kit: '00c00', eye: FRONT, arms: ARMS, pts: [armL, armR] });
  await shot('rig_armlet_front');
  check(
    'the Insignia Armlet: drawn without a GL error',
    arm.error === 0 && arm.drawn === 1,
    `error ${arm.error}, drawn ${arm.drawn}`,
  );
  check(
    'the Insignia Armlet on the left upper arm, never the right',
    arm.px[0] > armBare.px[0] + 90 && arm.px[1] <= armBare.px[1] + 12,
    `${arm.px} against ${armBare.px}`,
  );
  await draw({ kit: '00c00', eye: [-1.2, 1.35, 1.1], at: [-0.22, 1.25, 0], arms: ARMS, pts: [] });
  await shot('rig_armlet_close');
  await draw({ kit: '00c00', eye: [-1.2, 1.35, 1.1], at: [-0.22, 1.25, 0], arms: null, pts: [] });
  await shot('rig_armlet_plain_close');
  await draw({ body: 'sprite', kit: '00c00', eye: FRONT, arms: ARMS, pts: [], plain: true });
  await shot('sprite_armlet_front');
  await draw({ body: 'sprite', kit: '00c00', eye: [0, 1.45, 1.2], at: [0, 1.3, 0], arms: ARMS, pts: [], plain: true });
  await shot('sprite_armlet_close');
  // THE MORROWIND BODY: the pieces on retail's skeleton as the game reads it
  const mw = (n) => {
    const i = POSE_AT[n];
    return [MW_POSE.pts[i], MW_POSE.pts[i + 1], MW_POSE.pts[i + 2]];
  };
  const mwBare = await draw({
    body: 'mw',
    kit: '00000',
    eye: FRONT,
    at: [0, 1.0, 0],
    pts: [[0, mw('crown')[1] - 0.04, 0.02], mw('chest'), [mw('ftR')[0], mw('ftR')[1] + 0.12, mw('ftR')[2] + 0.08]],
  });
  const mwD = await draw({
    body: 'mw',
    kit: 'aaaa0',
    eye: FRONT,
    at: [0, 1.0, 0],
    pts: [[0, mw('crown')[1] - 0.04, 0.02], mw('chest'), [mw('ftR')[0], mw('ftR')[1] + 0.12, mw('ftR')[2] + 0.08]],
  });
  await shot('mw_dagonfire_front');
  check(
    'the Morrowind body in Dagonfire: posed off its bones, drawn without a GL error',
    mwD.error === 0 && mwD.drawn === 4,
    `error ${mwD.error}, drawn ${mwD.drawn}`,
  );
  check(
    'on the Morrowind body: the crown over its head, the heart on its chest, the fire at its shins',
    mwD.px.every((v, i) => v > mwBare.px[i] + 60),
    `${mwD.px} against ${mwBare.px}`,
  );
  const mwE = await draw({ body: 'mw', kit: 'bbbb0', eye: FRONT, at: [0, 1.0, 0], pts: [mw('chest')] });
  const backAt = [mw('chest')[0], mw('chest')[1], mw('chest')[2] - 0.27];
  const mwBackBare = await draw({ body: 'mw', kit: '00000', eye: BEHIND, at: [0, 1.0, 0], pts: [backAt] });
  const mwBack = await draw({ body: 'mw', kit: '0b000', eye: BEHIND, at: [0, 1.0, 0], pts: [backAt] });
  check(
    "the Eternal Sigil burns on the Morrowind body's back, clear of its torso (AUDIT ARMORY)",
    mwBack.px[0] > mwBackBare.px[0] + 60,
    `${mwBack.px[0]} against ${mwBackBare.px[0]}`,
  );
  await shot('mw_eternal_front');
  check('the Morrowind body in Eternal: drawn', mwE.error === 0 && mwE.drawn === 4 && mwE.lit > 300, `${mwE.lit}`);
  await draw({ body: 'mw', kit: '00c00', eye: [-1.4, 1.45, 1.4], at: [-0.2, 1.3, 0], arms: ARMS, pts: [] });
  await shot('mw_armlet_close');
  for (const [kit, name] of [
    ['aaaa0', 'dagonfire'],
    ['bbbb0', 'eternal'],
  ]) {
    await draw({ body: 'mw', kit, eye: [0, 1.3, 3.1], at: [0, 1.1, 0], pts: [] });
    await shot(`mw_${name}_framed`);
    await draw({ body: 'mw', kit, eye: [2.2, 1.4, 2.2], at: [0, 1.1, 0], pts: [] });
    await shot(`mw_${name}_threequarter`);
    await draw({ body: 'mw', kit, eye: [0, 1.3, -3.1], at: [0, 1.1, 0], pts: [] });
    await shot(`mw_${name}_behind`);
    await draw({ body: 'mw', kit, eye: [0.5, 1.85, 1.1], at: [0, 1.7, 0], pts: [] });
    await shot(`mw_${name}_head`);
    await draw({ body: 'sprite', kit, eye: [0, 1.3, 3.1], at: [0, 1.1, 0], pts: [], plain: true });
    await shot(`sprite_${name}_framed`);
  }
  await draw({ body: 'mw', kit: 'baab0', eye: [2.2, 1.4, 2.2], at: [0, 1.1, 0], pts: [] });
  await shot('mw_mixed_threequarter');
  // each body piece alone on the Morrowind body, three-quarters on (the weapon's on its stage, below)
  for (const pc of ARMORY_PIECES.filter((x) => x.slot !== 'weapon')) {
    const kit = ['head', 'torso', 'arms', 'legs', 'weapon'].map((sl) => (sl === pc.slot ? pc.code : '0')).join('');
    await draw({ body: 'mw', kit, eye: [2.2, 1.4, 2.2], at: [0, 1.1, 0], pts: [] });
    await shot(`piece_${pc.key}`);
  }
  // the walk: a Cinderstride's footfall embers on the ground behind
  const walk = await draw({ kit: '000a0', eye: [0, 1.6, 2.6], walk: 1, pts: [] });
  await shot('rig_cinderstride_walk');
  check('the Cinderstride walking: drawn', walk.error === 0 && walk.lit > 100, `${walk.lit}`);
  // THE WEAPON PIECE'S STAGE (render/weaponPiecePreview.js): the blade and the classic hand's own outline round it
  const stage = await browser.newPage({ viewport: { width: 320, height: 420 } });
  stage.on('pageerror', (x) => errs.push(x.message));
  await stage.goto(`http://127.0.0.1:${port}/stage/`);
  for (const [key, look] of [
    ['eternaledge', 'edge'],
    ['breachbrand', 'brand'],
  ]) {
    const s = await stage.evaluate((spec) => window.stageOf(spec), glowSpec(look, ARMORY_LEVEL));
    if (shotsAt) await stage.locator('#s').screenshot({ path: join(shotsAt, `stage_${key}.png`) });
    check(
      `${key}: its stage starts and draws without a GL error`,
      s.ok && s.error === 0,
      JSON.stringify(s).slice(0, 200),
    );
    check(
      `${key}: the blade stands in the middle, steel`,
      s.blade[0] > 90 && Math.abs(s.blade[0] - s.blade[2]) < 60,
      s.blade.join(', '),
    );
    const [r, , b] = s.beside;
    check(
      `${key}: its light beside the blade, in its own colours`,
      look === 'edge' ? b > 150 && b > r : r > 150 && r > b,
      s.beside.join(', '),
    );
    check(
      `${key}: nothing far from the blade`,
      s.far.every((v) => v < 30),
      s.far.join(', '),
    );
  }
  check(
    "an Eternal Edge kit alone takes the weapon's stage, any other kit the figure's",
    weaponStageOf('0000b') === 'edge' && weaponStageOf('b000b') === null && weaponStageOf(null) === null,
  );
  // AURA-PIXEL (2026-10-31): the pieces in Daggerfall's pixels - each kit drawn close with the law on: no GL error, as much
  // of it lit as per pixel, and in texels (a lit pixel the same as its neighbour more often); a shot of each
  for (const [name, kit] of [['dagonfire', 'aaaa0'], ['eternal', 'bbbb0'], ['spurs', '00d00']]) {
    const close = { kit, eye: [0, 1.3, 1.5], at: [0, 1.1, 0] };
    const flat = await draw(close), px = await draw({ ...close, pixel: true });
    await shot(`pixel_${name}`);
    check(`${name}: in pixels, drawn without a GL error`, px.error === 0 && px.drawn > 0, `error ${px.error}, drawn ${px.drawn}`);
    check(`${name}: as much of it lit`, px.lit > flat.lit * 0.6, `${px.lit} lit, per pixel ${flat.lit}`);
    check(`${name}: in texels`, px.same > flat.same + 0.05, `${px.same.toFixed(2)} as their neighbour, per pixel ${flat.same.toFixed(2)}`);
  }
  const real = errs.filter((x) => !/GPU stall|fallback to software WebGL|404 \(Not Found\)/.test(x)); // the driver's own notes, and the page's missing favicon
  check('no page error', real.length === 0, real.join(' | ').slice(0, 600));
} finally {
  await browser.close();
  server.close();
}
const failed = out.filter((x) => !x).length;
console.log(`${out.length - failed}/${out.length}`);
process.exitCode = failed ? 1 : 0;
