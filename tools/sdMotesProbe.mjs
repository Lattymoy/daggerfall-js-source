// SD14c - THE HOUR'S MOTES, COMPILED, LINKED AND DRAWN IN A REAL BROWSER (the Deadlands' probe's method,
// tools/deadlandsProbe.mjs).
//
// node holds the motes' law (test/sd14c_motes.test.js - sdMoteAt, the shader's own in JS); what node cannot answer is
// whether the GLSL COMPILES and LINKS in a real WebGL2 context, whether the points light the frame, and whether the
// shader puts each mote where the JS law says. So: the repo's own modules served as they are, the pass drawn by its own
// class over a cleared frame from the hall, the Steps and the arena, the frame read back - and, for motes of every kind
// standing in view, the pixels where sdMoteAt projects them read.
//
//     node tools/sdMotesProbe.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = []; const check = (n, ok, d = '') => { out.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${d ? ` - ${d}` : ''}`); };
const W = 640, H = 400;

const PAGE = `<!doctype html><html><body style="margin:0;background:#000"><canvas id=c width=${W} height=${H}></canvas><script type=module>
import { SdMotesRenderer, sdMoteVertices, sdMoteAt, SD_MOTES_TOTAL } from '/src/render/sdMotes.js';
import { realmToDungeon } from '/src/net/sdBrain.js';
const gl = document.getElementById('c').getContext('webgl2', { alpha: false, preserveDrawingBuffer: true });
let pass = null, err = null;
try { pass = new SdMotesRenderer(gl); } catch (e) { err = String(e.message ?? e); }
const persp = (f, a, n, fa) => { const t = 1 / Math.tan(f / 2); return new Float32Array([t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0]); };
const look = (e, c) => {
  const u = [0, 1, 0], z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]]; const lz = Math.hypot(...z); for (let i = 0; i < 3; i++) z[i] /= lz;
  const x = [u[1] * z[2] - u[2] * z[1], u[2] * z[0] - u[0] * z[2], u[0] * z[1] - u[1] * z[0]]; const lx = Math.hypot(...x); for (let i = 0; i < 3; i++) x[i] /= lx;
  const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]), -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]), -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]), 1]);
};
const mul = (a, b) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
window.probe = { err, linked: pass ? gl.getProgramParameter(pass.prog, gl.LINK_STATUS) : false, total: SD_MOTES_TOTAL };
window.draw = (eyeR, atR, t) => {
  const eye = realmToDungeon(...eyeR), at = realmToDungeon(...atR);
  gl.clearColor(0, 0, 0, 1); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const P = persp(1.1, ${W} / ${H}, 0.1, 500), V = look(eye, at), VP = mul(P, V);
  const drew = pass.draw(P, V, t, null, 1, ${H});
  const glErr = gl.getError();
  const whole = new Uint8Array(${W} * ${H} * 4); gl.readPixels(0, 0, ${W}, ${H}, gl.RGBA, gl.UNSIGNED_BYTE, whole);
  let lit = 0; for (let i = 0; i < whole.length; i += 4) if (whole[i] + whole[i + 1] + whole[i + 2] > 24) lit++;
  // motes of each kind standing in view, bright: is the screen lit where the JS law projects them?
  const v = sdMoteVertices(), hits = [0, 0, 0, 0], asked = [0, 0, 0, 0];
  for (let i = 0; i < v.length; i += 4) {
    const k = v[i], m = sdMoteAt(k, v[i + 1], v[i + 2], v[i + 3], t);
    if (m.alpha < 0.45 || asked[k] >= 12) continue;
    const w = realmToDungeon(...m.p), c = [0, 1, 2, 3].map((r) => VP[r] * w[0] + VP[4 + r] * w[1] + VP[8 + r] * w[2] + VP[12 + r]);
    if (c[3] < 0.5 || c[3] > 120) continue;
    const sx = Math.round((c[0] / c[3] * 0.5 + 0.5) * ${W}), sy = Math.round((c[1] / c[3] * 0.5 + 0.5) * ${H});
    if (sx < 2 || sy < 2 || sx > ${W} - 3 || sy > ${H} - 3) continue;
    asked[k]++;
    let best = 0, wide = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const o = ((sy + dy) * ${W} + sx + dx) * 4; best = Math.max(best, whole[o] + whole[o + 1] + whole[o + 2]); }
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) { const yy = sy + dy, xx = sx + dx; if (yy < 0 || xx < 0 || yy >= ${H} || xx >= ${W}) continue; const o = (yy * ${W} + xx) * 4; wide = Math.max(wide, whole[o] + whole[o + 1] + whole[o + 2]); }
    if (best > 6) hits[k]++; else (window.miss ??= []).push({ k, i: i / 4, p: m.p, w: c[3], best, wide, alpha: m.alpha, size: m.size });
  }
  return { drew, drawn: pass.drawn, glErr, lit, hits, asked };
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
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(`http://127.0.0.1:${server.address().port}/probe/`);
  try { await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 }); } catch (e) { console.log(errs.join('\n')); throw e; }
  const p = await page.evaluate(() => window.probe);
  check('the motes\' program compiles and links', !p.err && p.linked === true, p.err ?? '');
  check('over a thousand of them', p.total > 1000, `${p.total}`);
  const views = { hall: [[0, 3, 14], [0, 3, 42]], steps: [[0, 2, 100], [0, -6, 160]], arena: [[0, 4, 212], [0, 4, 246]], sky: [[0, 2, 120], [0, 40, 160]] };
  for (const [name, [eye, at]] of Object.entries(views)) {
    for (const t of [37.5, 400.25]) {
      const r = await page.evaluate(([e, a, tt]) => window.draw(e, a, tt), [eye, at, t]);
      check(`${name} at ${t} s: drawn, no GL error, the air lit`, r.drew && r.drawn === p.total && r.glErr === 0 && r.lit > 40, `lit ${r.lit} px, error ${r.glErr}`);
      const kinds = r.asked.map((n, k) => [k, n, r.hits[k]]).filter(([, n]) => n > 0);
      check(`${name} at ${t} s: every mote asked lit where the law puts it`, kinds.length > 0 && kinds.every(([, n, h]) => h === n), kinds.map(([k, n, h]) => `kind ${k}: ${h}/${n}`).join(', '));
    }
  }
  const miss = await page.evaluate(() => window.miss ?? []);
  if (miss.length) console.log(JSON.stringify(miss.slice(0, 6)));
  check('no page error', errs.length === 0, errs.join('; '));
} finally {
  await browser.close();
  server.close();
}
const failed = out.filter((o) => !o).length;
console.log(`\n${out.length - failed}/${out.length} checks passed`);
process.exit(failed ? 1 : 0);
