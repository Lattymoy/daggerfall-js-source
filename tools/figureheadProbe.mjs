// FIGUREHEAD - THE CARVINGS AT EACH HULL'S STEM, DRAWN IN A REAL BROWSER.
//
// node holds the law and the mount (test/systems/naval/figurehead.test.js); what node cannot answer is how a carving
// looks where it stands, drawn as the game draws (world/mat4.js THE HANDEDNESS LAW: the projection mirrored in x, front
// faces clockwise on screen, back faces culled) - its faces outward, its pictures on it, clear of her bowsprit. So: each
// hull's drawn surface (the pool's hullSurface, over Come Sail Away's real models) and the carving stood on its mount,
// drawn by a stand-in shader (lefayProbe.mjs's) in a flat brown for her planking and a grey for her other parts, the
// carving in its own pictures (world/ships/figureheadArt.js); the frame read back where the carving stands.
//
//     node tools/figureheadProbe.mjs [--shots <dir>] [--mod]   (writes <hull>-<carving>.png and a sheet; --mod: the mod's own hulls)
import { chromium } from 'playwright';
import { join } from 'node:path';
import '../test/modsOff.js';
import { freshPool, modShipsPool } from '../test/navalSea.mjs';
import { hullBuild } from '../src/systems/naval/navalShips.js';
import { plankingOf } from '../src/scenes/comeSailAway/shipPlaque.js';
import { fitCarving } from '../src/scenes/comeSailAway/shipFigurehead.js';
import { paintedCarving } from '../src/world/ships/figureheadModels.js';
import { carvingArt } from '../src/world/ships/figureheadArt.js';
import { FIGUREHEADS } from '../src/systems/naval/figurehead.js';

const shotsAt = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
const mod = process.argv.includes('--mod');
const out = [];
const check = (n, ok, d = '') => {
  out.push(ok);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${d ? ` - ${d}` : ''}`);
};

const { pool, restore } = mod ? await modShipsPool() : { pool: await freshPool(), restore: () => {} };
/** A hull's surface as triangles, each mesh's own, and a carving stood on its mount - plain arrays for the page. */
function scene(hull, n, paint) {
  const surface = pool.hullSurface(hull),
    build = hullBuild(hull),
    pi = plankingOf(surface, build),
    mount = fitCarving(surface, build);
  const hullTris = surface.map((m, i) => ({
    plank: i === pi,
    p: Array.from(m.indices, (k) => [m.positions[k * 3], m.positions[k * 3 + 1], m.positions[k * 3 + 2]]).flat(),
  }));
  if (!mount) return { hullTris, mount: null };
  const m = paintedCarving(FIGUREHEADS[n], paint),
    M = mount.matrix;
  const at = (i) => {
    const x = m.positions[i * 3],
      y = m.positions[i * 3 + 1],
      z = m.positions[i * 3 + 2];
    return [
      M[0] * x + M[4] * y + M[8] * z + M[12],
      M[1] * x + M[5] * y + M[9] * z + M[13],
      M[2] * x + M[6] * y + M[10] * z + M[14],
    ];
  };
  const dir = (i) => {
    const x = m.normals[i * 3],
      y = m.normals[i * 3 + 1],
      z = m.normals[i * 3 + 2];
    return [M[0] * x + M[4] * y + M[8] * z, M[1] * x + M[5] * y + M[9] * z, M[2] * x + M[6] * y + M[10] * z];
  };
  const groups = m.subMeshes.map((s) => {
    const idx = Array.from(m.indices.slice(s.startIndex, s.startIndex + s.primitiveCount * 3));
    return {
      rec: s.textureRecord,
      p: idx.flatMap(at),
      n: idx.flatMap(dir),
      uv: idx.flatMap((i) => [m.uvs[i * 2], m.uvs[i * 2 + 1]]),
    };
  });
  return {
    hullTris,
    mount: { at: mount.at, size: mount.size, lean: mount.lean },
    groups,
    build: { bowZ: build.bowZ, aftZ: build.aftZ, top: build.top },
  };
}

const PAGE = `<!doctype html><html><body style="margin:0;background:#000"><canvas id=c width=640 height=480></canvas><script type=module>
import { mirrorProjectionX } from '/src/world/mat4.js';
const gl = document.getElementById('c').getContext('webgl2', { alpha: false, preserveDrawingBuffer: true });
const vs = \`#version 300 es
layout(location=0) in vec3 p; layout(location=1) in vec3 n; layout(location=2) in vec2 uv; uniform mat4 vp; out vec3 vn; out vec2 vuv; out vec3 vw;
void main(){ vn=n; vuv=uv; vw=p; gl_Position=vp*vec4(p,1.0); }\`;
const fs = \`#version 300 es
precision highp float; in vec3 vn; in vec2 vuv; in vec3 vw; uniform sampler2D alb; uniform vec4 uFlat; out vec4 o;
void main(){
  vec3 L = normalize(vec3(0.5, 0.75, 0.45));
  if (uFlat.a > 0.0) { vec3 fn = normalize(cross(dFdx(vw), dFdy(vw))); o = vec4(uFlat.rgb * (0.45 + 0.55 * abs(dot(fn, L))), 1.0); return; }
  o = vec4(texture(alb, vuv).rgb * (0.35 + 0.65 * max(dot(normalize(vn), L), 0.0)), 1.0);
}\`;
const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
const mesh = (pos, nor, uv) => { const vao = gl.createVertexArray(); gl.bindVertexArray(vao); for (const [a, loc, k] of [[pos, 0, 3], [nor, 1, 3], [uv, 2, 2]]) { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(a), gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, k, gl.FLOAT, false, 0, 0); } gl.bindVertexArray(null); return { vao, count: pos.length / 3 }; };
const persp = (f, a, n, fa) => { const t = 1 / Math.tan(f / 2); return new Float32Array([t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0]); };
const look = (e, c) => { const u = [0, 1, 0], z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]]; let l = Math.hypot(...z); z.forEach((v, i) => { z[i] = v / l; }); const x = [u[1] * z[2] - u[2] * z[1], u[2] * z[0] - u[0] * z[2], u[0] * z[1] - u[1] * z[0]]; l = Math.hypot(...x); x.forEach((v, i) => { x[i] = v / l; }); const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]]; return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]), -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]), -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]), 1]); };
const mul = (a, b) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
const ux = (k) => gl.getUniformLocation(pr, k);
const tex = new Map();
window.art = (list) => { for (const [rec, w, h, c] of list) { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(c)); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); tex.set(rec, t); } };
/** one frame of scene \`s\` from \`eye\` at \`centre\`, culled as the world's pass culls; the pixels at \`at\` read back */
window.draw = (s, { eye, centre, fov = 0.7, at = [] }) => {
  gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(gl.CW);   // the renderer's own (HANDEDNESS)
  gl.clearColor(0.62, 0.72, 0.86, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const vp = mul(mirrorProjectionX(persp(fov, 640 / 480, 0.05, 2000)), look(eye, centre));
  gl.useProgram(pr); gl.uniformMatrix4fv(ux('vp'), false, vp); gl.uniform1i(ux('alb'), 0);
  for (const h of s.hullTris) { const g = mesh(h.p, new Array(h.p.length).fill(0), new Array((h.p.length / 3) * 2).fill(0)); gl.uniform4f(ux('uFlat'), ...(h.plank ? [0.42, 0.29, 0.18] : [0.55, 0.53, 0.5]), 1); gl.disable(gl.CULL_FACE); gl.bindVertexArray(g.vao); gl.drawArrays(gl.TRIANGLES, 0, g.count); }
  gl.enable(gl.CULL_FACE); gl.uniform4f(ux('uFlat'), 0, 0, 0, 0);
  for (const g of s.groups ?? []) { const m = mesh(g.p, g.n, g.uv); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex.get(g.rec)); gl.bindVertexArray(m.vao); gl.drawArrays(gl.TRIANGLES, 0, m.count); }
  gl.bindVertexArray(null);
  const scr = ([x, y, z]) => { const c = [0, 1, 2, 3].map((r) => vp[r] * x + vp[4 + r] * y + vp[8 + r] * z + vp[12 + r]); return [(c[0] / c[3] * 0.5 + 0.5) * 640, (0.5 - c[1] / c[3] * 0.5) * 480]; };
  const all = new Uint8Array(640 * 480 * 4); gl.readPixels(0, 0, 640, 480, gl.RGBA, gl.UNSIGNED_BYTE, all);
  const px = ([x, y]) => { const i = ((480 - 1 - Math.round(y)) * 640 + Math.round(x)) * 4; return [all[i], all[i + 1], all[i + 2]]; };
  return { error: gl.getError(), at: at.map((p) => px(scr(p))), all };
};
/** the pixels the carving changes - drawn with it and without - and how many of them are lit faces (its outsides) */
window.carved = (s, view) => {
  const bare = window.draw({ ...s, groups: [] }, view).all, full = window.draw(s, view);
  let changed = 0;
  for (let i = 0; i < bare.length; i += 4) if (bare[i] !== full.all[i] || bare[i + 1] !== full.all[i + 1] || bare[i + 2] !== full.all[i + 2]) changed++;
  return { error: full.error, changed };
};
window.ready = true;
</script></body></html>`;

import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/probe/') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(PAGE);
    return;
  }
  const f = join(ROOT, url);
  if (!f.startsWith(ROOT) || !existsSync(f)) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { 'content-type': extname(f) === '.js' ? 'text/javascript' : 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/probe/`);
  await page
    .waitForFunction(() => window.ready === true, null, { timeout: 20000 })
    .catch((e) => {
      throw new Error(`${e.message}: ${errs.join('; ')}`);
    });
  await page.evaluate(
    (list) => window.art(list),
    carvingArt().map(([rec, pic]) => [rec, pic.width, pic.height, Array.from(pic.colors)]),
  );
  const hulls = mod ? [1, 4] : [1, 2, 3, 4];
  for (const hull of hulls) {
    for (let n = 1; n < FIGUREHEADS.length; n++) {
      const paint = n % 3 === 1 ? 0 : n % 3 === 2 ? 2 : 5; // as built, crimson, Bay blue in turn
      const s = scene(hull, n, paint);
      check(
        `hull ${hull}: a mount at her stem`,
        !!s.mount,
        s.mount ? `at ${s.mount.at.map((v) => v.toFixed(2))}, size ${s.mount.size.toFixed(2)}` : '',
      );
      if (!s.mount) continue;
      const S = s.mount.size,
        a = s.mount.at;
      // from her starboard bow, a few of its sizes off, and looking at it
      const eye = [a[0] + 3.2 * S, a[1] + 0.9 * S, a[2] + 2.6 * S],
        centre = [0, a[1] + 0.45 * S, a[2] + 0.45 * S];
      const r = await page.evaluate(({ s, eye, centre }) => window.carved(s, { eye, centre }), { s, eye, centre });
      check(`hull ${hull} ${FIGUREHEADS[n]}: no GL error`, r.error === 0, `error ${r.error}`);
      check(
        `hull ${hull} ${FIGUREHEADS[n]}: drawn where it stands, a share of the frame`,
        r.changed > 640 * 480 * 0.02,
        `${r.changed} pixels`,
      );
      if (shotsAt)
        await page
          .locator('#c')
          .screenshot({ path: join(shotsAt, `${mod ? 'mod-' : ''}hull${hull}-${FIGUREHEADS[n]}.png`) });
      if (n === 1 && shotsAt) {
        // and the whole of her, from abeam her bow
        const L = s.build.bowZ - s.build.aftZ;
        await page.evaluate(({ s, eye, centre }) => window.draw(s, { eye, centre, fov: 0.8 }), {
          s,
          eye: [L * 0.9, s.build.top * 0.9, a[2] + L * 0.15],
          centre: [0, s.build.top * 0.35, a[2] - L * 0.35],
        });
        await page.locator('#c').screenshot({ path: join(shotsAt, `${mod ? 'mod-' : ''}hull${hull}-whole.png`) });
      }
    }
  }
  check('no page errors', !errs.length, errs.join('; '));
} finally {
  await browser.close();
  server.close();
  restore();
}
const bad = out.filter((ok) => !ok).length;
console.log(bad ? `${bad} FAILED` : `all ${out.length} ok`);
process.exit(bad ? 1 : 0);
