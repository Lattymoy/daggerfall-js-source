// WB6c - THE GATE'S VEIL, COMPILED, LINKED, DRAWN AND STEPPED THROUGH IN A REAL BROWSER.
//
// node holds the veil's law and its layer over a fake page (test/wb6c_gate_veil.test.js); what node cannot answer is
// whether the GLSL COMPILES and LINKS in a real WebGL2 context, whether the fire it draws is where the law says - the
// screen clear before it closes, the corners taken first, all of it fire when shut with the eye burning at the middle,
// the middle opened first - and whether the real layer on a real page closes, answers, opens and hides. So: the repo's
// own modules served as they are (no bundler), the pass drawn at the law's moments and read back, then the layer
// itself stepped through on the page's own frame clock.
//
//     node tools/gateVeilProbe.mjs [--shots <dir>]     (writes closing.png / shut.png / opening.png there when given)
import { chromium } from 'playwright';
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const shotsAt = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
const out = []; const check = (n, ok, d = '') => { out.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${d ? ` - ${d}` : ''}`); };
const W = 640, H = 360;

const PAGE = `<!doctype html><html><body style="margin:0;background:#1a2a3a"><canvas id=c width=${W} height=${H}></canvas><script type=module>
import { GateVeilRenderer, veilAt, VEIL_CLOSE_S, VEIL_OPEN_S } from '/src/render/gateVeil.js';
import { createGateVeil } from '/src/ui/gateVeil.js';
const gl = document.getElementById('c').getContext('webgl2', { alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true });
let pass = null, err = null;
try { pass = new GateVeilRenderer(gl); } catch (e) { err = String(e.message ?? e); }
window.probe = { err, linked: pass ? gl.getProgramParameter(pass.prog, gl.LINK_STATUS) : false };
window.draw = (phase, s, t) => {
  const v = veilAt(phase, s);
  pass.draw(${W}, ${H}, t, v);
  const px = (x, y) => { const b = new Uint8Array(4); gl.readPixels(x, ${H} - 1 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, b); return Array.from(b); };
  const corners = [[2, 2], [${W} - 3, 2], [2, ${H} - 3], [${W} - 3, ${H} - 3]].map(([x, y]) => px(x, y));
  return { error: gl.getError(), v, centre: px(${W} / 2 | 0, ${H} / 2 | 0), corners };
};
// the layer itself, on this page's own frame clock
window.step = async () => {
  const veil = createGateVeil({ engine: { soundIndexForId: () => -1, playOneShot: () => undefined } });
  const t0 = performance.now();
  const shut = await veil.cover();
  const closedIn = (performance.now() - t0) / 1000;
  const canvas = [...document.querySelectorAll('canvas')].find((c) => c.id !== 'c');
  const shown = canvas?.style.display;
  const phaseShut = veil.phase;
  veil.reveal();
  const t1 = performance.now();
  await new Promise((resolve) => { const w = () => (veil.phase === 'idle' ? resolve() : requestAnimationFrame(w)); requestAnimationFrame(w); });
  return { shut, closedIn, shown, phaseShut, openedIn: (performance.now() - t1) / 1000, hidden: canvas?.style.display, z: canvas ? getComputedStyle(canvas).zIndex : null, pointer: canvas ? getComputedStyle(canvas).pointerEvents : null, VEIL_CLOSE_S, VEIL_OPEN_S };
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
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/probe/`);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
  const p = await page.evaluate(() => window.probe);
  check('the veil builds', !p.err, p.err ?? '');
  check('its program links in a real WebGL2', p.linked === true);
  const a = (c) => c[3];
  const start = await page.evaluate(() => window.draw('closing', 0, 0.5));
  check('no GL error drawing it', start.error === 0, `error ${start.error}`);
  check('before it closes, the screen is clear - the corners and the middle', start.corners.every((c) => a(c) < 8) && a(start.centre) < 8, JSON.stringify([start.centre, ...start.corners].map(a)));
  const mid = await page.evaluate(() => window.draw('closing', 0.8, 0.9));
  if (shotsAt) await page.locator('#c').screenshot({ path: join(shotsAt, 'closing.png') });
  check('closing, the corners are taken first - fire - and the middle is still the world\'s, reddened', mid.corners.every((c) => a(c) > 240 && c[0] > c[2]) && a(mid.centre) < 200, JSON.stringify({ centre: mid.centre, corners: mid.corners }));
  const shut = await page.evaluate(() => window.draw('shut', 0.3, 1.6));
  if (shotsAt) await page.locator('#c').screenshot({ path: join(shotsAt, 'shut.png') });
  check('shut, all of it fire', [shut.centre, ...shut.corners].every((c) => a(c) > 250), JSON.stringify([shut.centre, ...shut.corners].map(a)));
  check('the eye burns at the middle, brighter than the corners', shut.centre[0] + shut.centre[1] + shut.centre[2] > Math.max(...shut.corners.map((c) => c[0] + c[1] + c[2])) + 150, JSON.stringify({ centre: shut.centre, corners: shut.corners }));
  const opening = await page.evaluate(() => window.draw('opening', 0.5, 2.3));
  if (shotsAt) await page.locator('#c').screenshot({ path: join(shotsAt, 'opening.png') });
  check('opening, the middle first - the new place through the eye, the fire\'s red on it fading as the cover goes - the corners still fire', a(opening.centre) < 0.5 * 255 * opening.v.cover + 8 && opening.corners.some((c) => a(c) > 200), JSON.stringify({ centre: opening.centre, cover: opening.v.cover, corners: opening.corners.map(a) }));
  const done = await page.evaluate(() => window.draw('opening', 1.7, 3.2));
  check('opened, the screen is clear again', done.corners.every((c) => a(c) < 8) && a(done.centre) < 8, JSON.stringify([done.centre, ...done.corners].map(a)));
  const step = await page.evaluate(() => window.step());
  check('the layer on a real page: the fire closes and the promise answers when it has', step.shut === true && step.phaseShut === 'shut' && step.closedIn >= step.VEIL_CLOSE_S - 0.05, JSON.stringify(step));
  check('shown while it stands, over the world under the chat, never a pointer', step.shown === 'block' && step.z === '4' && step.pointer === 'none', JSON.stringify(step));
  check('it opens and hides', step.hidden === 'none' && step.openedIn >= step.VEIL_OPEN_S - 0.05, JSON.stringify(step));
  check('no page error', errs.length === 0, errs.join('; '));
} finally {
  await browser.close();
  server.close();
}
const failed = out.filter((o) => !o).length;
console.log(`\n${out.length - failed}/${out.length} checks passed`);
process.exit(failed ? 1 : 0);
