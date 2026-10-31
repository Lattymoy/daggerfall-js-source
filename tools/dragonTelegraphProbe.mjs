// DRAGON3 - THE DRAGON'S DRAPED TELEGRAPH, COMPILED, LINKED AND DRAWN IN A REAL BROWSER.
//
// node holds the grid's law (test/net/dragon/dragon3_client.test.js drapeGrid); what node cannot answer is whether the draped
// stage COMPILES and LINKS against the gate's fragment stage in a real WebGL2 context, and whether a shape lands ON the land
// - here a steep slope - and not on the flat floor the gate's quad assumes. The repo's own modules are served as they are, the
// pass drawn by its own class over an empty frame, and the frame read back.
//
//     node tools/dragonTelegraphProbe.mjs        (CHROMIUM=<path> for a browser of the machine's own)
import { chromium } from 'playwright';
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = [];
const check = (n, ok, d = '') => {
  out.push(ok);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${d ? ` - ${d}` : ''}`);
};

const PAGE = `<!doctype html><html><body style="margin:0;background:#000"><canvas id=c width=640 height=480></canvas><script type=module>
import { DragonTelegraphPass, drapeGrid, drapeBounds } from '/src/render/dragon/dragonTelegraph.js';
import { TELEGRAPH_KIND, TELEGRAPH_POOL, TELEGRAPH_EDGE } from '/src/render/gate/gateTelegraph.js';
const gl = document.getElementById('c').getContext('webgl2', { alpha: false, preserveDrawingBuffer: true });
const persp = (fov, a, n, f) => { const t = 1 / Math.tan(fov / 2); return [t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, (2 * f * n) / (n - f), 0]; };
function look(e, c) {
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], nrm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
  const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const z = nrm(sub(e, c)), x = nrm(cr([0, 1, 0], z)), y = cr(z, x);
  return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1];
}
const proj = new Float32Array(persp(1.0, 640 / 480, 0.5, 2000)), eye = [0, 60, -60], view = new Float32Array(look(eye, [0, 10, 0]));
const r = { gl, _proj: proj, _view: view, _camPos: new Float32Array(eye), _fogMode: 0, _fogDensity: 0, _fogRange: new Float32Array([0, 1]), marked: 0, markForeignPass() { this.marked++; } };
const slope = (x, z) => 0.8 * z + 20;   // a hillside rising to the north, 20 m up at the site
const disc = { kind: TELEGRAPH_KIND.disc, origin: [0, 10], yaw: 0, r: 6, halfArc: 0, body: 0, end: [0, 0], halfW: 0, r0: 0, r1: 0, points: [], n: 0, t: 1, flash: 1, alpha: 1, color: [1, 0.62, 0.22], edge: TELEGRAPH_EDGE, court: 0, style: 0, since: 2, span: 2, after: 0.05, runS: 0, pool: TELEGRAPH_POOL.blow };
const res = {};
try {
  const pass = new DragonTelegraphPass(gl);
  gl.clearColor(0, 0, 0, 1); gl.clearDepth(1); gl.enable(gl.DEPTH_TEST); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const mesh = drapeGrid(drapeBounds(disc), slope, 0);
  res.drew = pass.draw([{ sh: disc, mesh }], r, [0, 0, 0]);
  res.shapes = pass.drawn; res.marked = r.marked; res.err = gl.getError();
  // where the disc's heart projects: on the slope (y = 28) and, were it laid flat, at y = 0
  const at = (p) => { const m = (i, j) => proj[j * 4 + i]; const v = (i, j) => view[j * 4 + i];
    const w4 = [0, 1, 2, 3].map((i) => v(i, 0) * p[0] + v(i, 1) * p[1] + v(i, 2) * p[2] + v(i, 3));
    const c = [0, 1, 2, 3].map((i) => m(i, 0) * w4[0] + m(i, 1) * w4[1] + m(i, 2) * w4[2] + m(i, 3) * w4[3]);
    return [Math.round((c[0] / c[3] * 0.5 + 0.5) * 640), Math.round((c[1] / c[3] * 0.5 + 0.5) * 480)]; };
  const px = (q) => { const b = new Uint8Array(4); gl.readPixels(q[0], q[1], 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, b); return b[0] + b[1] + b[2]; };
  res.onSlope = px(at([0, slope(0, 10), 10])); res.flat = px(at([0, 0, 10])); res.away = px(at([30, slope(30, 40), 40]));
  pass.destroy();
} catch (e) { res.error = String(e?.message ?? e); }
window.__probe = res;
</script></body></html>`;

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/probe/') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(PAGE);
    return;
  } // not the root: U60 keeps that the landing page's
  const p = join(ROOT, url);
  if (!p.startsWith(ROOT) || !existsSync(p)) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, {
    'content-type':
      extname(p) === '.js'
        ? 'text/javascript'
        : extname(p) === '.json'
          ? 'application/json'
          : 'application/octet-stream',
  }); // a JSON module served as JSON (the gate probe's WB9e)
  res.end(readFileSync(p));
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}),
}); // a browser of the machine's own, as the armory's probe takes one
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('page error:', e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('console:', m.text());
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/probe/`);
  await page.waitForFunction(() => window.__probe, null, { timeout: 60_000 });
  const r = await page.evaluate(() => window.__probe);
  check("the draped stage compiles and links against the gate's fragment stage", !r.error, r.error ?? '');
  check(
    'the shape is drawn, the pass marked foreign',
    r.drew === true && r.shapes > 0 && r.marked === 1,
    JSON.stringify({ drew: r.drew, shapes: r.shapes, marked: r.marked }),
  );
  check('no GL error', r.err === 0, String(r.err));
  check('it lies ON the hillside: lit where the slope is', r.onSlope > 150, `brightness ${r.onSlope}`);
  check('not on the flat floor under it', r.flat < 30, `brightness ${r.flat}`);
  check('and dark away from it', r.away < 30, `brightness ${r.away}`);
} finally {
  await browser.close();
  server.close();
}
process.exit(out.every(Boolean) ? 0 : 1);
