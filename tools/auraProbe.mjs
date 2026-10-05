// WB9g - DAGON'S FIRE, COMPILED, LINKED AND DRAWN IN A REAL BROWSER.
//
// node holds the aura's law (test/wb9g_insignia.test.js: who is drawn, the clock's wrap, the pass over a fake GL); what
// node cannot answer is whether the GLSL COMPILES and LINKS in a real WebGL2 context, and whether what it draws is the
// fire it says: the ring burning at its radius and dim inside it, nothing past its edge, flames standing up out of it,
// no seam where the angle's noise closes behind the wearer, no jump where the clock wraps, and nothing at all before it
// has kindled. So: the repo's own module served as it is (no bundler), a grey floor drawn by a stand-in shader, the pass
// drawn by its own class over it, and the frame read back.
//
// AEGIS (2026-10-03): and THE OBLIVION WARD, the second aura, through the same pass - its ring whole and violet round
// the feet, dark within the runes and past its edge, no seam where the ring closes, no jump at the clock's wrap, its
// veil standing up off the ring, nothing before it kindles, and half of it drawn round at half kindled; and its floating
// symbols aloft over the ring, to the chest, where the fire has nothing.
//
// PRIMARCH (2026-10-04): and THE GOLDEN RADIANCE, the third - its ring whole and golden round the feet, its pool bright
// at the feet and gone past its reach, its column standing to past the crown and brightest at its two edges (light ROUND
// the body, never a wash over it), dark over the crown, no seam where the ring closes, no jump at the wrap, nothing
// before it kindles and the column risen to the waist at half kindled - and from inside it (the wearer's own first
// person) no gold veil over the view.
//
// SHADOW-CLOAK (2026-10-04): and THE HOLO SHADOW CLOAK, the fourth - a cape with its hood up, drawn premultiplied, so
// over a lit floor its shadow DARKENS: the pool dark round the feet and the floor past it untouched; from behind the
// cloth over the floor darker than the floor beside it and the wearer's glyph on its back - the wolf lit, beside it dark;
// from the front its opening (no trim across its middle) with its embroidery lit either side and its clasp lit; turned
// with its wearer; no jump at the wrap; nothing before it kindles and drawn to the waist at half; torn when its wearer
// turns beast - the cloth gone, its shreds floating round them; emblems aloft; and from the wearer's own eye no shadow
// over the view. AUDIT: every cloak read is STRICT (a point off the canvas throws, never reads black), compared against
// the frame with NO aura (not the cloak unkindled), its hood read against the lit floor; and its two sides drawn by
// its winding are checked as this probe draws (unmirrored, CCW) and as the game does (world/mat4.js
// mirrorProjectionX, CW). The shots are unmirrored - the wolf faces left in them; in the game it faces right.
//
//     node tools/auraProbe.mjs [--shots <dir>]     (writes aura.png / aura_side.png / ward.png / ward_side.png /
//                                                   radiance.png / radiance_side.png / cloak_back.png /
//                                                   cloak_front.png / cloak_top.png / cloak_torn.png /
//                                                   wings_back.png there)
import { chromium } from 'playwright';
import { glyphEdges, CLOAK_GLYPH } from '../src/render/auraRing.js';   // SHADOW-CLOAK: where the wearer's glyph is, to read it back
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const shotsAt = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
const out = []; const check = (n, ok, d = '') => { out.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${d ? ` - ${d}` : ''}`); };

const PAGE = `<!doctype html><html><body style="margin:0;background:#000"><canvas id=c width=640 height=480></canvas><script type=module>
import { AuraRingRenderer, AURA_RING_R, AURA_CLOCK_PERIOD, WARD_RING_R, WARD_RUNE_R, RADIANCE_R, RADIANCE_H, RADIANCE_POOL_R, CLOAK_POOL_R, CLOAK_SIGIL_Y, CLOAK_SIGIL_R, CLOAK_H, CLOAK_CLASP_Y, CLOAK_RIP_S } from '/src/render/auraRing.js';
const gl = document.getElementById('c').getContext('webgl2', { alpha: false, preserveDrawingBuffer: true });
const vs = \`#version 300 es
layout(location=0) in vec2 p; uniform mat4 vp; void main(){ gl_Position = vp * vec4(p.x, 0.0, p.y, 1.0); }\`;
const fs = \`#version 300 es
precision highp float; uniform float lit; out vec4 o; void main(){ o = vec4(vec3(0.08, 0.075, 0.07) * lit, 1.0); }\`;
const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-20, -20, 20, -20, 20, 20, -20, -20, 20, 20, -20, 20]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.bindVertexArray(null);
let pass = null, err = null;
try { pass = new AuraRingRenderer(gl); } catch (e) { err = String(e.message ?? e); }
const persp = (f, a, n, fa) => { const t = 1 / Math.tan(f / 2); return new Float32Array([t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0]); };
const look = (e, c) => { const u = [0, 1, 0]; const z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]]; let l = Math.hypot(...z); z.forEach((v, i) => { z[i] = v / l; }); const x = [u[1] * z[2] - u[2] * z[1], u[2] * z[0] - u[0] * z[2], u[0] * z[1] - u[1] * z[0]]; l = Math.hypot(...x); x.forEach((v, i) => { x[i] = v / l; }); const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]]; return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]), -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]), -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]), 1]); };
const mul = (a, b) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
window.probe = { err, linked: pass ? gl.getProgramParameter(pass.program, gl.LINK_STATUS) : false, ringR: AURA_RING_R, period: AURA_CLOCK_PERIOD, wardR: WARD_RING_R, runeR: WARD_RUNE_R, radR: RADIANCE_R, radH: RADIANCE_H, poolR: RADIANCE_POOL_R, cloakPoolR: CLOAK_POOL_R, cloakSigilY: CLOAK_SIGIL_Y, cloakSigilR: CLOAK_SIGIL_R, cloakH: CLOAK_H, cloakClaspY: CLOAK_CLASP_Y, cloakRipS: CLOAK_RIP_S };
/** Draw the floor and the aura at the origin from \`eye\` at \`t\` seconds, kindled \`kindle\`; read back \`pts\` (world). */
window.draw = (eye, t, kindle, pts, aura, at = [0, 0.2, 0], yaw = 0, lit = 1, torn = -1, extra = null, opts = {}) => {   // SHADOW-CLOAK (AUDIT): \`opts\` - strict (a point off the canvas throws, never reads black), mirror (the game's own projection and CW front face), none (the same frame with no aura at all)   // PRIMARCH: \`at\` - where the eye looks (the first person looks level); SHADOW-CLOAK: the wearer's facing, and the floor lit brighter so a shadow shows
  const proj = persp(0.9, 640 / 480, 0.05, 100), view = look(eye, at);
  if (opts.mirror) proj[0] = -proj[0];   // world/mat4.js mirrorProjectionX: the frame as the game shows it
  const vp = mul(proj, view);
  gl.enable(gl.DEPTH_TEST); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  if (lit !== 1) gl.disable(gl.CULL_FACE);   // SHADOW-CLOAK: the lit floor drawn whichever way it faces (the pass leaves culling on behind it)
  gl.useProgram(pr); gl.uniformMatrix4fv(gl.getUniformLocation(pr, 'vp'), false, vp); gl.uniform1f(gl.getUniformLocation(pr, 'lit'), lit); gl.bindVertexArray(vao); gl.drawArrays(gl.TRIANGLES, 0, 6); gl.bindVertexArray(null);
  if (opts.mirror) gl.frontFace(gl.CW);   // the renderer's own front face under the mirror
  pass.draw(opts.none ? [] : [{ at: [0, 0, 0], seed: 0.37, kindle, aura, yaw, torn, ...(extra ?? {}) }], proj, view, new Float32Array(eye), t, null);
  gl.frontFace(gl.CCW);   // SHADOW-CLOAK: torn, its wearer turned beast; \`extra\` its swing and its pose
  const px = (w) => {
    const c = [0, 1, 2, 3].map((r) => vp[r] * w[0] + vp[4 + r] * w[1] + vp[8 + r] * w[2] + vp[12 + r]);
    const x = Math.round((c[0] / c[3] * 0.5 + 0.5) * 640), y = Math.round((c[1] / c[3] * 0.5 + 0.5) * 480);
    if (opts.strict && (!(c[3] > 0) || x < 0 || x > 639 || y < 0 || y > 479)) throw new Error(\`a point off the canvas: \${w} at \${x},\${y}\`);
    const o = new Uint8Array(4); gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, o); return Array.from(o);
  };
  return { error: gl.getError(), drawn: pass.drawn, px: pts.map(px) };
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
  check('the pass builds', !p.err, p.err ?? '');
  check('its program links in a real WebGL2', p.linked === true);
  const lum = (c) => c[0] + c[1] + c[2];
  const R = p.ringR, above = [0, 3.2, 3.2];
  // round the ring at 24 bearings, the centre, and past the edge
  const ring = Array.from({ length: 24 }, (_, i) => { const a = (i / 24) * Math.PI * 2; return [Math.cos(a) * R, 0.05, Math.sin(a) * R]; });
  const top = await page.evaluate(([eye, pts]) => window.draw(eye, 3.5, 1, pts), [above, [...ring, [0, 0.05, 0], [2.2, 0.05, 0], [0, 0.05, -2.2]]]);
  if (shotsAt) await page.locator('#c').screenshot({ path: join(shotsAt, 'aura.png') });
  check('no GL error drawing it', top.error === 0 && top.drawn === 1, `error ${top.error}, drawn ${top.drawn}`);
  const ringLum = top.px.slice(0, 24).map(lum), mean = ringLum.reduce((a, b) => a + b, 0) / 24;
  check('the ring burns round the feet', mean > 180 && ringLum.filter((v) => v > 90).length >= 18, `mean ${mean.toFixed(0)}: ${ringLum.join(' ')}`);
  const reds = top.px.slice(0, 24).filter((c) => c[0] > c[2] * 1.4).length;
  check('in fire\'s colours - red over blue', reds >= 20, `${reds}/24`);
  check('dim within it, dark past its edge', lum(top.px[24]) < mean / 2 && lum(top.px[25]) < 60 && lum(top.px[26]) < 60, `${JSON.stringify(top.px.slice(24))}`);
  // the seam where the angle wraps (the -x axis): from straight above, on the ground inside the flames' wall, the fire
  // either side of it differs no more than the fire beside it does - at three moments, three rings in
  const over = [0, 3.4, 0.001], rr = [R - 0.06, R - 0.1, R - 0.14];
  let dSeam = 0, dNear = 0;
  for (const t of [2.5, 7.25, 31.75]) {
    const pts = rr.flatMap((r) => [[-r, 0.05, -0.02], [-r, 0.05, 0.02], [Math.cos(2.2) * r, 0.05, Math.sin(2.2) * r], [Math.cos(2.2 + 0.047) * r, 0.05, Math.sin(2.2 + 0.047) * r]]);
    const got = await page.evaluate(([eye, pts, tt]) => window.draw(eye, tt, 1, pts), [over, pts, t]);
    for (let k = 0; k < rr.length; k++) { dSeam += Math.abs(lum(got.px[k * 4]) - lum(got.px[k * 4 + 1])); dNear += Math.abs(lum(got.px[k * 4 + 2]) - lum(got.px[k * 4 + 3])); }
  }
  check('no seam behind the wearer where the ring closes', dSeam <= Math.max(90, dNear * 2), `across the seam ${dSeam}, beside it ${dNear} (summed over nine pairs)`);
  // the clock's wrap: a breath before it and a breath after, the same fire
  const wrapPts = ring.slice(0, 12);
  const before = await page.evaluate(([eye, pts, t]) => window.draw(eye, t, 1, pts), [above, wrapPts, p.period - 1 / 240]);
  const after = await page.evaluate(([eye, pts, t]) => window.draw(eye, t, 1, pts), [above, wrapPts, 1 / 240]);
  const jump = before.px.map((c, i) => Math.abs(lum(c) - lum(after.px[i])));
  check('no jump where the clock wraps', Math.max(...jump) <= 45, jump.join(' '));
  // the flames stand up out of the ring (from the side, a point a quarter up the flame at the near side)
  const side = await page.evaluate(([eye, pts]) => window.draw(eye, 3.5, 1, pts), [[0, 0.9, 3.4], [[0, 0.14, R], [0, 0.14, R + 0.8], [0, 1.2, R]]]);
  if (shotsAt) await page.locator('#c').screenshot({ path: join(shotsAt, 'aura_side.png') });
  check('flames stand up out of it', lum(side.px[0]) > lum(side.px[1]) + 60 && lum(side.px[2]) < 60, JSON.stringify(side.px));
  const cold = await page.evaluate(([eye, pts]) => window.draw(eye, 3.5, 0, pts), [above, ring.slice(0, 6)]);
  check('unkindled, nothing burns', cold.px.every((c) => lum(c) < 70), JSON.stringify(cold.px));
  // ── AEGIS: THE OBLIVION WARD ──
  const W = p.wardR, wardAt = (eye, t, k, pts) => page.evaluate(([e, tt, kk, ps]) => window.draw(e, tt, kk, ps, 'oblivionward'), [eye, t, k, pts]);
  const wring = Array.from({ length: 24 }, (_, i) => { const a = (i / 24) * Math.PI * 2; return [Math.cos(a) * W, 0.05, Math.sin(a) * W]; });
  const wtop = await wardAt(above, 3.5, 1, [...wring, [0, 0.05, 0], [0.45, 0.05, 0], [W + 0.32, 0.05, 0], [0, 0.05, -(W + 0.32)]]);
  if (shotsAt) await page.locator('#c').screenshot({ path: join(shotsAt, 'ward.png') });
  check('the ward draws without a GL error', wtop.error === 0 && wtop.drawn === 1, `error ${wtop.error}, drawn ${wtop.drawn}`);
  const wLum = wtop.px.slice(0, 24).map(lum), wMean = wLum.reduce((a, b) => a + b, 0) / 24;
  check('its ring is WHOLE round the feet - every bearing lit', wLum.every((v) => v > 300), `mean ${wMean.toFixed(0)}: ${wLum.join(' ')}`);
  const halo = await wardAt(above, 3.5, 1, Array.from({ length: 24 }, (_, i) => { const a = (i / 24) * Math.PI * 2; return [Math.cos(a) * (W + 0.025), 0.05, Math.sin(a) * (W + 0.025)]; }));
  const violets = halo.px.filter((c) => c[2] > c[0] && c[0] > c[1] * 1.3).length;
  check('in violet - blue over red over green, in the glow beside the white heart', violets >= 22, `${violets}/24: ${JSON.stringify(halo.px.slice(0, 4))}`);
  check('dark under the feet and past its edge', lum(wtop.px[24]) < 80 && lum(wtop.px[26]) < 60 && lum(wtop.px[27]) < 60, JSON.stringify(wtop.px.slice(24)));
  // no seam where the angle wraps (-x), on the ring and through the runes, at three moments
  let wSeam = 0, wNear = 0;
  for (const t of [2.5, 7.25, 31.75]) for (const r of [W - 0.004, p.runeR]) {
    const got = await wardAt(over, t, 1, [[-r, 0.05, -0.012], [-r, 0.05, 0.012], [Math.cos(2.2) * r, 0.05, Math.sin(2.2) * r], [Math.cos(2.2 + 0.025) * r, 0.05, Math.sin(2.2 + 0.025) * r]]);
    wSeam += Math.abs(lum(got.px[0]) - lum(got.px[1])); wNear += Math.abs(lum(got.px[2]) - lum(got.px[3]));
  }
  check('no seam behind the wearer where the ward closes', wSeam <= Math.max(120, wNear * 2), `across the seam ${wSeam}, beside it ${wNear}`);
  const wBefore = await wardAt(above, p.period - 1 / 240, 1, wring.slice(0, 12)), wAfter = await wardAt(above, 1 / 240, 1, wring.slice(0, 12));
  const wJump = wBefore.px.map((c, i) => Math.abs(lum(c) - lum(wAfter.px[i])));
  check('no jump where the clock wraps', Math.max(...wJump) <= 45, wJump.join(' '));
  const wside = await wardAt([0, 0.9, 3.4], 3.5, 1, [[0, 0.06, W], [0, 0.06, W + 0.9], [0, 0.9, W]]);
  if (shotsAt) await page.locator('#c').screenshot({ path: join(shotsAt, 'ward_side.png') });
  check('its veil stands up off the ring, gone by the shins', lum(wside.px[0]) > lum(wside.px[1]) + 60 && lum(wside.px[2]) < 60, JSON.stringify(wside.px));
  const wcold = await wardAt(above, 3.5, 0, wring.slice(0, 6));
  check('unkindled, nothing is drawn', wcold.px.every((c) => lum(c) < 70), JSON.stringify(wcold.px));
  // half kindled: drawn round from behind the wearer (-x) - the half it has reached lit, the half it has not dark
  const wHalf = await wardAt(above, 3.5, 0.5, [[-Math.cos(0.6) * W, 0.05, Math.sin(-0.6) * W], [Math.cos(0.6) * W, 0.05, Math.sin(0.6) * W]]);
  check('half kindled, half drawn round', lum(wHalf.px[0]) > 150 && lum(wHalf.px[1]) < 70, JSON.stringify(wHalf.px));
  // the floating symbols: from the side, the air from the knee to the chest over the ring - lit by the ward's symbols at
  // every moment, and never by the fire, whose flames end below it
  const air = []; for (let x = -1.4; x <= 1.401; x += 0.1) for (let y = 0.8; y <= 1.601; y += 0.1) air.push([x, y, 0]);
  const aloft = async (aura, t) => (await page.evaluate(([e, tt, ps, au]) => window.draw(e, tt, 1, ps, au), [[0, 0.9, 3.4], t, air, aura])).px.filter((c) => lum(c) > 60).length;
  const wardAir = [], fireAir = [];
  for (const t of [2.0, 5.3, 9.1, 47.7]) { wardAir.push(await aloft('oblivionward', t)); fireAir.push(await aloft(undefined, t)); }
  if (shotsAt) { await page.evaluate(([e]) => window.draw(e, 5.3, 1, [], 'oblivionward'), [[0, 0.9, 3.4]]); await page.locator('#c').screenshot({ path: join(shotsAt, 'ward_symbols.png') }); }
  check('symbols float over the ward, to the chest', wardAir.every((n) => n >= 3), `lit points of ${air.length} at four moments: ${wardAir.join(' ')}`);
  check('and none over the fire', fireAir.every((n) => n === 0), fireAir.join(' '));
  // ── PRIMARCH: THE GOLDEN RADIANCE ──
  const RR = p.radR, radAt = (eye, t, k, pts, at) => page.evaluate(([e, tt, kk, ps, a]) => window.draw(e, tt, kk, ps, 'radiance', a ?? undefined), [eye, t, k, pts, at ?? null]);
  const rring = Array.from({ length: 24 }, (_, i) => { const a = (i / 24) * Math.PI * 2; return [Math.cos(a) * RR, 0.05, Math.sin(a) * RR]; });
  const rtop = await radAt(above, 3.5, 1, [...rring, [0.2, 0.05, 0.1], [p.poolR + 0.1, 0.05, 0], [0, 0.05, -(p.poolR + 0.1)]]);
  if (shotsAt) await page.locator('#c').screenshot({ path: join(shotsAt, 'radiance.png') });
  check('the radiance draws without a GL error', rtop.error === 0 && rtop.drawn === 1, `error ${rtop.error}, drawn ${rtop.drawn}`);
  const rLum = rtop.px.slice(0, 24).map(lum);
  check('its ring is whole round the feet', rLum.every((v) => v > 300), rLum.join(' '));
  const golds = rtop.px.slice(0, 24).filter((c) => c[0] >= c[1] && c[1] > c[2] && c[0] > c[2] * 1.15).length;
  check('in gold - red, then green, over blue', golds >= 22, `${golds}/24: ${JSON.stringify(rtop.px.slice(0, 3))}`);
  check('its pool lit at the feet, dark past its reach', lum(rtop.px[24]) > 90 && lum(rtop.px[25]) < 60 && lum(rtop.px[26]) < 60, JSON.stringify(rtop.px.slice(24)));
  let rSeam = 0, rNear = 0;
  for (const t of [2.5, 7.25, 31.75]) for (const r of [RR, RR + 0.3]) {
    const got = await radAt(over, t, 1, [[-r, 0.05, -0.012], [-r, 0.05, 0.012], [Math.cos(2.2) * r, 0.05, Math.sin(2.2) * r], [Math.cos(2.2 + 0.025) * r, 0.05, Math.sin(2.2 + 0.025) * r]]);
    rSeam += Math.abs(lum(got.px[0]) - lum(got.px[1])); rNear += Math.abs(lum(got.px[2]) - lum(got.px[3]));
  }
  check('no seam behind the wearer where the radiance closes', rSeam <= Math.max(90, rNear * 2), `across the seam ${rSeam}, beside it ${rNear}`);
  const rBefore = await radAt(above, p.period - 1 / 240, 1, rring.slice(0, 12)), rAfter = await radAt(above, 1 / 240, 1, rring.slice(0, 12));
  const rJump = rBefore.px.map((c, i) => Math.abs(lum(c) - lum(rAfter.px[i])));
  check('no jump where the clock wraps', Math.max(...rJump) <= 45, rJump.join(' '));
  // from the side at the chest: the column's two edges bright, its middle (where it crosses the body) faint, the air
  // beside it and over the crown dark - at four moments, so a mote passing is not mistaken for the column
  const sideEye = [0, 1.2, 4], sidePts = [[-RR, 1.0, 0], [RR, 1.0, 0], [0, 1.0, RR], [-(RR + 0.45), 1.0, 0], [RR + 0.45, 1.0, 0], [0, p.radH + 0.35, 0]];
  let edge = 0, middle = 0, beside = 0, crown = 0;
  for (const t of [2.0, 5.3, 9.1, 47.7]) {
    const got = await radAt(sideEye, t, 1, sidePts, [0, 1.1, 0]);
    edge += Math.min(lum(got.px[0]), lum(got.px[1])); middle += lum(got.px[2]); beside += Math.max(lum(got.px[3]), lum(got.px[4])); crown += lum(got.px[5]);
  }
  if (shotsAt) { await radAt(sideEye, 5.3, 1, [], [0, 1.1, 0]); await page.locator('#c').screenshot({ path: join(shotsAt, 'radiance_side.png') }); }
  check('the column stands about the body - bright at its edges, faint across it', edge > 4 * 120 && edge > 2 * middle, `edges ${edge}, across ${middle} (summed over four moments)`);
  check('dark beside the column and over the crown', beside < 4 * 60 && crown < 4 * 60, `beside ${beside}, over the crown ${crown}`);
  const rcold = await radAt(above, 3.5, 0, rring.slice(0, 6));
  check('unkindled, nothing is drawn', rcold.px.every((c) => lum(c) < 70), JSON.stringify(rcold.px));
  const rHalf = await radAt(sideEye, 9.1, 0.5, [[-RR, 0.3, 0], [RR, 0.3, 0], [-RR, 1.9, 0], [RR, 1.9, 0]], [0, 1.1, 0]);
  check('half kindled, the column risen to the waist and no higher', Math.min(lum(rHalf.px[0]), lum(rHalf.px[1])) > 90 && Math.max(lum(rHalf.px[2]), lum(rHalf.px[3])) < 60, JSON.stringify(rHalf.px));
  // the wearer's own first person: the eye inside the column, looking level - the view not veiled in gold
  const veil = [];
  for (const t of [2.0, 5.3, 9.1, 47.7]) veil.push((await radAt([0, 1.65, 0], t, 1, [[0, 1.6, -3], [1.5, 1.4, -3], [-1.5, 1.4, -3], [0, 2.2, -3]], [0, 1.6, -3])).px.map(lum).reduce((a, b) => a + b, 0));
  check('from inside it, no gold veil over the view', veil.every((v) => v < 4 * 60), veil.join(' '));
  // ── SHADOW-CLOAK: THE HOLO SHADOW CLOAK ──
  // over a floor lit bright enough that a shadow can be seen: 0.08 * 6 is a mid grey
  const LIT = 6, Q = 13.2, cl = (eye, t, k, pts, at, yaw = 0, torn = -1, opts = {}) => page.evaluate(([e, tt, kk, ps, a, y, l, tr, o]) => window.draw(e, tt, kk, ps, 'shadowcloak', a ?? undefined, y, l, tr, null, { strict: true, ...o }), [eye, t, k, pts, at ?? null, yaw, LIT, torn, opts]);
  const bare = (eye, pts, at) => page.evaluate(([e, ps, a, l]) => window.draw(e, 13.2, 1, ps, 'shadowcloak', a, 0, l, -1, null, { strict: true, none: true }), [eye, pts, at, LIT]);   // the same frame with NO aura at all (AUDIT: not the cloak unkindled - that compared a frame with itself)
  const CP = p.cloakPoolR;
  // from straight above: the pool round the hem darker than the floor past it, and the floor past it untouched
  const poolPts = Array.from({ length: 8 }, (_, i) => { const a = (i / 8 + 1 / 16) * Math.PI * 2; return [Math.cos(a) * 0.62, 0.0, Math.sin(a) * 0.62]; });
  const ctop = await cl([0, 4.2, 0.001], Q, 1, [[CP + 0.12, 0, 0], [0, 0, -(CP + 0.12)], [-(CP + 0.12), 0, 0], [1.3, 0, 0.6], ...poolPts], [0, 0, 0]);
  if (shotsAt) await page.locator('#c').screenshot({ path: join(shotsAt, 'cloak_top.png') });
  check('the cloak draws without a GL error', ctop.error === 0 && ctop.drawn === 1, `error ${ctop.error}, drawn ${ctop.drawn}`);
  const floorLum = lum(ctop.px[3]);
  check('the floor past its pool untouched', ctop.px.slice(0, 3).every((c) => Math.abs(lum(c) - floorLum) < 6), JSON.stringify(ctop.px.slice(0, 4)));
  const poolLum = ctop.px.slice(4).map(lum);
  check('a shadow pooled round it - the floor round the hem darker than past it', poolLum.filter((v) => v < floorLum * 0.9).length >= 6, `${poolLum.join(' ')} round the hem vs ${floorLum}`);
  // from behind (the wearer faces +z): the cloth over the floor darker than the floor beside it; the wearer's glyph on
  // its back - inside the wolf lit, beside it in the disc dark; nothing over the hood
  const behind = [0, 1.1, -3.2], cAt = [0, 1.0, 0];
  const E = glyphEdges(CLOAK_GLYPH);
  const inside = ([x, y]) => { let n = 0; for (const [ax, ay, bx, by] of E) if ((ay <= y) !== (by <= y) && x < ax + (y - ay) * (bx - ax) / (by - ay)) n++; return n % 2 === 1; };
  const segD = ([ax, ay, bx, by], [x, y]) => { const ex = bx - ax, ey = by - ay, h = Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / (ex * ex + ey * ey))); return Math.hypot(x - ax - ex * h, y - ay - ey * h); };
  const box = Array.from({ length: 31 * 31 }, (_, i) => [0.5 + (i % 31) * 0.5, 0.5 + Math.floor(i / 31) * 0.5]).filter((g) => Math.min(...E.map((e) => segD(e, g))) > 0.7 && Math.hypot(g[0] - 8, g[1] - 8) < 6.8);
  const onBack = (g) => [((g[0] - 8) / 7) * p.cloakSigilR / 1.4, p.cloakSigilY + ((8 - g[1]) / 7) * p.cloakSigilR / 1.4, -0.4];   // the wearer's right is +x: the glyph's own right
  const wolf = box.filter(inside).filter((_, i) => i % 6 === 0), besideWolf = box.filter((g) => !inside(g));
  const cback = await cl(behind, Q, 1, [[0.12, 0.35, -0.42], [1.4, 0.0, -0.6], [0, p.cloakH + 0.15, -0.1], ...wolf.map(onBack), ...besideWolf.map(onBack)], cAt);
  if (shotsAt) await page.locator('#c').screenshot({ path: join(shotsAt, 'cloak_back.png') });
  check('from behind the cloth shades what is behind it', lum(cback.px[0]) < lum(cback.px[1]) * 0.8, `${lum(cback.px[0])} on the cloth vs ${lum(cback.px[1])} on the floor beside`);
  check('nothing over the hood\'s peak', lum(cback.px[2]) < 30, JSON.stringify(cback.px[2]));   // and against the lit floor, below (AUDIT 2)
  const wolfLum = cback.px.slice(3, 3 + wolf.length).map(lum), besideLum = cback.px.slice(3 + wolf.length).map(lum);
  const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
  check('the wearer\'s glyph on its back - the wolf lit, beside it dark, in red', besideWolf.length >= 8 && med(wolfLum) > med(besideLum) + 40 && cback.px.slice(3, 3 + wolf.length).filter((c) => c[0] > 2 * c[1]).length > wolf.length * 0.8, `the wolf ${med(wolfLum)} (of ${wolf.length}) vs beside ${med(besideLum)} (of ${besideWolf.length})`);
  // from the front: across the knees, the opening's embroidery either side of its middle and none across it; the clasp
  // lit at the throat
  const knees = [0.55, 0.75, 0.95].flatMap((y) => Array.from({ length: 401 }, (_, i) => [-0.4 + i * 0.002, y, 0.5]));   // every 2 mm at three heights: a line is a pixel or two wide
  const redOf = (px) => px.map((c) => (c[0] > c[1] * 1.6 ? c[0] : 0));
  const cfront = await cl([0, 0.9, 3.2], Q, 1, [...knees, [0, p.cloakClaspY - 0.012, 0.3], [0.13, p.cloakClaspY - 0.012, 0.3]], [0, 0.9, 0]);
  const K = knees.length;
  if (shotsAt) await page.locator('#c').screenshot({ path: join(shotsAt, 'cloak_front.png') });
  const peakOf = (a) => a.reduce((x, y) => Math.max(x, y), 0), rows = [0, 1, 2].map((r) => redOf(cfront.px.slice(r * 401, r * 401 + 401)));
  const leftPeak = peakOf(rows.map((fr) => peakOf(fr.slice(0, 175)))), rightPeak = peakOf(rows.map((fr) => peakOf(fr.slice(226)))), mid = peakOf(rows.map((fr) => peakOf(fr.slice(175, 226))));   // the middle 10 cm
  check('open at the front - its embroidery either side of its middle, none across it, its lining seen through', leftPeak > mid + 20 && rightPeak > mid + 20 && mid > 40, `edges ${leftPeak} and ${rightPeak}, the middle ${mid}`);
  check('its clasp lit at the throat', lum(cfront.px[K]) > lum(cfront.px[K + 1]) + 60, `${JSON.stringify(cfront.px[K])} the clasp vs ${JSON.stringify(cfront.px[K + 1])} beside`);
  // turned: the same eye and the wearer facing away - the glyph on their back faces the eye now
  const turnedPts = wolf.map((g) => { const q = onBack(g); return [-q[0], q[1], 0.4]; });
  const tTurned = await cl([0, 1.1, 3.2], Q, 1, turnedPts, [0, 1.0, 0], Math.PI), tFacing = await cl([0, 1.1, 3.2], Q, 1, turnedPts, [0, 1.0, 0], 0);
  check('turned with its wearer - faced away, the wolf on its back toward the eye', med(tTurned.px.map(lum)) > med(tFacing.px.map(lum)) + 40, `${med(tTurned.px.map(lum))} turned vs ${med(tFacing.px.map(lum))} facing`);
  // the wrap, on the cloth and the ground
  const cwp = [[0.3, 0.6, -0.4], [-0.3, 0.9, -0.38], [0, 0.4, -0.45], [0.25, 1.2, -0.3], [0.7, 0, -0.3], [-0.6, 0, -0.4]];
  const cBefore = await cl(behind, p.period - 1 / 240, 1, cwp, cAt), cAfter = await cl(behind, 1 / 240, 1, cwp, cAt);
  const cJump = cBefore.px.map((c, i) => Math.abs(lum(c) - lum(cAfter.px[i])));
  check('no jump where the clock wraps', Math.max(...cJump) <= 45, cJump.join(' '));
  const coldPts = [[0.12, 0.35, -0.42], [0, 0.8, -0.4], [0.3, 0.0, -0.55]];   // every one over the lit floor (AUDIT 2: one was sky in both frames)
  const ccold = await cl(behind, Q, 0, coldPts, cAt);
  const cfloor = await bare(behind, coldPts, cAt);
  check('unkindled, nothing is drawn', ccold.px.every((c, i) => Math.abs(lum(c) - lum(cfloor.px[i])) < 6), JSON.stringify(ccold.px));
  // the hood read against the LIT floor (AUDIT: against the black sky a shadow cannot show): from above and behind
  const high = [0, 3.4, -2.4], hoodPts = [[0, 1.75, -0.12], [0.08, 1.7, -0.14], [-0.08, 1.7, -0.14]], overPeak = [[0, p.cloakH + 0.04, -0.06], [0, p.cloakH + 0.08, -0.06], [0.06, p.cloakH + 0.04, -0.06], [-0.06, p.cloakH + 0.04, -0.06]];
  const hoodBare = await bare(high, [[0.12, 0.45, -0.42], ...hoodPts], cAt), hoodWhole = await cl(high, Q, 1, [[0.12, 0.45, -0.42], ...hoodPts], cAt), chalf = await cl(high, Q, 0.5, [[0.12, 0.45, -0.42], ...hoodPts], cAt);
  const dHood = (f) => Math.max(...hoodPts.map((_, i) => Math.abs(lum(f.px[i + 1]) - lum(hoodBare.px[i + 1]))));
  check('half kindled, drawn to the waist and not to the hood', lum(chalf.px[0]) < lum(hoodBare.px[0]) * 0.85 && dHood(chalf) < 12 && dHood(hoodWhole) > 60, `waist ${lum(chalf.px[0])} vs ${lum(hoodBare.px[0])}; the hood ${dHood(chalf)} half kindled, ${dHood(hoodWhole)} whole`);
  const peakBare = await bare(high, overPeak, cAt), peakWhole = await cl(high, Q, 1, overPeak, cAt);
  check('nothing over the hood\'s peak, read against the lit floor', peakWhole.px.every((c, i) => Math.abs(lum(c) - lum(peakBare.px[i])) < 6), `${peakWhole.px.map(lum).join(' ')} vs ${peakBare.px.map(lum).join(' ')}`);
  // the emblems aloft: over the back, from behind, at four moments something there that the bare frame has not
  const overBack = Array.from({ length: 300 }, (_, i) => [-0.9 + (i % 20) * 0.095, 1.2 + Math.floor(i / 20) * 0.075, -0.6]);
  const aloftBare = await bare(behind, overBack, cAt);
  const aloftN = [];
  for (const t of [3.1, 17.9, 44.4, 90.2]) { const f = await cl(behind, t, 1, overBack, cAt); aloftN.push(f.px.filter((c, i) => c[0] > lum(aloftBare.px[i]) / 3 + 25 && c[0] > 1.8 * c[1]).length); }
  check('the wearer\'s emblems aloft over its back, in red', aloftN.every((n) => n >= 3), aloftN.join(' '));
  // TORN: its wearer turned beast - mid-tear the cloth splitting with embers along it; torn through, no cloth over the
  // floor behind it, its shreds round the beast
  const clothPts = Array.from({ length: 60 }, (_, i) => [-0.25 + (i % 10) * 0.05, 0.4 + Math.floor(i / 10) * 0.12, -0.45]);
  const whole = await cl(behind, Q, 1, clothPts, cAt), clothBare = await bare(behind, clothPts, cAt);
  const tearing = await cl(behind, Q, 1, clothPts, cAt, 0, 0.35 * p.cloakRipS);
  const torn = await cl(behind, Q, 1, clothPts, cAt, 0, p.cloakRipS + 6);
  if (shotsAt) await page.locator('#c').screenshot({ path: join(shotsAt, 'cloak_torn.png') });
  const shaded = (f) => f.px.filter((c, i) => lum(c) < lum(clothBare.px[i]) - 40).length;
  const emberOf = (f) => Math.max(...f.px.map((c) => (c[0] > 2 * c[1] ? c[0] : 0)));
  check('torn when its wearer turns beast - splitting mid-tear, embers along it; torn through, no cloth over the floor (a shred passing at most)', shaded(whole) >= 50 && shaded(tearing) < shaded(whole) * 0.5 && emberOf(tearing) > emberOf(whole) + 40 && shaded(torn) <= 10, `${shaded(whole)} shaded whole, ${shaded(tearing)} mid-tear, ${shaded(torn)} torn; embers ${emberOf(tearing)} mid-tear vs ${emberOf(whole)} whole`);
  const ringPts = Array.from({ length: 400 }, (_, i) => [-1.4 + (i % 20) * 0.147, 0.35 + Math.floor(i / 20) * 0.1, 0]);   // none whose ray ends in the pool at the feet (AUDIT 2: it counted the ground for shreds)
  const ringBare = await bare([0, 1.2, -4], ringPts, [0, 1.1, 0]);
  const shredN = [];
  for (const t of [3.1, 17.9, 44.4]) { const f = await cl([0, 1.2, -4], t, 1, ringPts, [0, 1.1, 0], 0, p.cloakRipS + t); shredN.push(f.px.filter((c, i) => Math.abs(lum(c) - lum(ringBare.px[i])) > 40).length); }
  check('its shreds float round the beast', shredN.every((n) => n >= 6), shredN.join(' '));
  // it swings: from the side, a run's trail carries its hem out behind the wearer over floor it left bare at rest
  const trailPts = Array.from({ length: 12 }, (_, i) => [0, 0.08 + (i % 3) * 0.12, -0.62 - Math.floor(i / 3) * 0.06]);
  const swingAt = (extra) => page.evaluate(([e, ps, a, l, x]) => window.draw(e, 13.2, 1, ps, 'shadowcloak', a, 0, l, -1, x, { strict: true }), [[3.2, 0.9, 0], trailPts, [0, 0.6, 0], LIT, extra]);
  const still = await swingAt(null), running = await swingAt({ swing: { x: 0, z: -0.35, lift: 0, twist: 0 } }), trailBare = await bare([3.2, 0.9, 0], trailPts, [0, 0.6, 0]);
  const covered = (f) => f.px.filter((c, i) => lum(c) < lum(trailBare.px[i]) - 40).length;
  check('it swings with its wearer - a run trails its hem out behind them', covered(running) >= covered(still) + 4, `${covered(still)} of ${trailPts.length} behind it covered still, ${covered(running)} running`);
  // the wearer's own eye, looking level and looking down: no shadow over the view, no red over it
  const own = [];
  for (const [look, pts] of [[[0, 1.6, -3], [[0, 0, -6], [1, 0, -5], [-1, 0, -7], [0, 1.0, -3]]], [[0, 0, -0.9], [[0, 0, -0.7], [0.25, 0, -0.75]]]]) {   // AUDIT: every point in the frame (strict)
    const on = await cl([0, 1.65, 0], Q, 1, pts, look), off = await bare([0, 1.65, 0], pts, look);
    own.push(...on.px.map((c, i) => Math.abs(lum(c) - lum(off.px[i]))));
  }
  check('from the wearer\'s own eye, nothing over the view past the ground at the feet', own.slice(0, 4).every((d) => d < 20), own.join(' '));
  // ITS SIDES BY ITS WINDING, as the game draws it too - mirrored (world/mat4.js mirrorProjectionX) and its front face
  // CW: from behind the back's outside (a dark shadow), from the front its lining (red) through the opening, either way
  const windPts = [[0, 0.7, -0.5]];
  for (const mirror of [false, true]) {
    const backSeen = await cl(behind, Q, 1, windPts, cAt, 0, -1, { mirror }), frontSeen = await cl([0, 0.9, 3.2], Q, 1, windPts.map(([x, y]) => [x, y, -0.5]), [0, 0.9, 0], 0, -1, { mirror });
    const [b, f] = [backSeen.px[0], frontSeen.px[0]];
    check(`its two sides by its own winding${mirror ? ', as the game mirrors it' : ''} - its outside dark from behind, its lining red from the front`, lum(b) < 120 && f[0] > 2 * f[1] && f[0] > b[0] + 25, `${JSON.stringify(b)} from behind, ${JSON.stringify(f)} from the front`);
  }
  // ── SERAPH-WINGS: THE SERAPH WINGS ──
  // from behind, over the wLitNow floor: gold light out to either side of the wearer and over the head, gold in colour,
  // nothing wPast their reach; flowing (another moment, another picture) and the same at the wrap; nothing unkindled and
  // less half kindled; from the wearer's own eye looking wAhead nothing over the view; as the game mirrors it, the same
  const wg = (eye, t, k, pts, at, swOpts = {}) => page.evaluate(([e, tt, kk, ps, a, l, o]) => window.draw(e, tt, kk, ps, 'seraphwings', a, 0, l, -1, null, { strict: true, ...o }), [eye, t, k, pts, at, LIT, swOpts]);
  const wBehind = [0, 1.6, -4.6], wAt = [0, 1.5, 0];
  const wGrid = Array.from({ length: 41 * 28 }, (_, i) => [-2 + (i % 41) * 0.1, 0.4 + Math.floor(i / 41) * 0.1, -0.35]);   // WINGS-FIT: every 0.1 m - slim strands fall between a coarser grid's points
  const wBare = await wg(wBehind, 13.2, 1, wGrid, wAt, { none: true }), wWhole = await wg(wBehind, 13.2, 1, wGrid, wAt);
  if (shotsAt) await page.locator('#c').screenshot({ path: join(shotsAt, 'wings_back.png') });
  check('the wings draw without a GL error', wWhole.error === 0 && wWhole.drawn === 1, `error ${wWhole.error}, drawn ${wWhole.drawn}`);
  const wLit = (f) => f.px.map((c, i) => lum(c) > lum(wBare.px[i]) + 60);
  const wLitNow = wLit(wWhole), wSide = (pred) => wGrid.filter((q, i) => wLitNow[i] && pred(q)).length;
  // WINGS-FIT: slim, shorter strands with dark between them (the old blaze lit 12 a side on a grid twice as coarse) - out
  // past the shoulders either side, and over the crown of the rest pose (CLOAK_H 1.88 m)
  check('gold light out to either side of the wearer and over the head', wSide((q) => q[0] < -0.5) >= 4 && wSide((q) => q[0] > 0.5) >= 4 && wSide((q) => q[1] > 1.95) >= 4, `left ${wSide((q) => q[0] < -0.5)}, right ${wSide((q) => q[0] > 0.5)}, over the head ${wSide((q) => q[1] > 1.95)}`);
  const wGolds = wWhole.px.filter((c, i) => wLitNow[i]), wGoldN = wGolds.filter((c) => c[0] >= c[1] && c[1] >= c[2]).length, wWarm = wGolds.filter((c) => c[0] > c[2] + 20).length;
  check('in gold - red over green over blue, white only where it burns hottest', wGoldN === wGolds.length && wWarm >= wGolds.length * 0.6, `${wGoldN} gold or white, ${wWarm} warm, of ${wGolds.length}`);
  const wPast = [[1.8, 1.4, -0.35], [-1.8, 1.4, -0.35], [1.7, 0.6, -0.35], [-1.6, 2.7, -0.35]];   // WINGS-FIT: their shorter reach (1.3 m; at 2.2 m these lay inside it)
  const wPBare = await wg(wBehind, 13.2, 1, wPast, wAt, { none: true }), wPWhole = await wg(wBehind, 13.2, 1, wPast, wAt);
  check('nothing past their reach', wPWhole.px.every((c, i) => Math.abs(lum(c) - lum(wPBare.px[i])) < 12), wPWhole.px.map(lum).join(' '));
  const wLater = await wg(wBehind, 14.7, 1, wGrid, wAt), wFlow = wWhole.px.reduce((a, c, i) => a + Math.abs(lum(c) - lum(wLater.px[i])), 0);
  check('flowing - another moment, another picture', wFlow > 2000, `${wFlow}`);
  const wB = await wg(wBehind, p.period - 1 / 240, 1, wGrid, wAt), wA = await wg(wBehind, 1 / 240, 1, wGrid, wAt);
  const swWJump = Math.max(...wB.px.map((c, i) => Math.abs(lum(c) - lum(wA.px[i]))));
  const wMidA = await wg(wBehind, 60 - 1 / 240, 1, wGrid, wAt), wMidB = await wg(wBehind, 60 + 1 / 240, 1, wGrid, wAt);
  const wStep = Math.max(...wMidA.px.map((c, i) => Math.abs(lum(c) - lum(wMidB.px[i]))));
  check('no jump where the clock wraps - no more than their own motion over the same moment', swWJump <= Math.max(45, 1.5 * wStep + 10), `${swWJump} at the wrap, ${wStep} mid-clock`);
  const wCold = await wg(wBehind, 13.2, 0, wGrid, wAt), swWHalf = await wg(wBehind, 13.2, 0.5, wGrid, wAt);
  const wHalfN = wLit(swWHalf).filter(Boolean).length, wWholeN = wLitNow.filter(Boolean).length;
  check('unkindled nothing, half kindled less', wCold.px.every((c, i) => Math.abs(lum(c) - lum(wBare.px[i])) < 6) && wHalfN > 0 && wHalfN < wWholeN * 0.7, `half ${wHalfN} of ${wWholeN}`);
  const wAhead = [[0, 1.6, 2], [0.6, 1.9, 2], [-0.6, 1.3, 2], [0.9, 1.6, 2.5], [-0.9, 1.6, 2.5]];
  const wFpBare = await wg([0, 1.7, 0.05], 13.2, 1, wAhead, [0, 1.65, 3], { none: true }), wFp = await wg([0, 1.7, 0.05], 13.2, 1, wAhead, [0, 1.65, 3]);
  check('from the wearer\'s own eye looking ahead, nothing over the view', wFp.px.every((c, i) => Math.abs(lum(c) - lum(wFpBare.px[i])) < 6), wFp.px.map(lum).join(' '));
  const wm = await wg(wBehind, 13.2, 1, wGrid, wAt, { mirror: true }), wLitM = wm.px.map((c, i) => lum(c) > lum(wBare.px[i]) + 60).filter(Boolean).length;
  check('as the game mirrors it, the same light', wm.error === 0 && Math.abs(wLitM - wWholeN) <= wWholeN * 0.25, `${wLitM} vs ${wWholeN}`);
  check('no page error', errs.length === 0, errs.join('; '));
} finally {
  await browser.close();
  server.close();
}
const failed = out.filter((o) => !o).length;
console.log(`\n${out.length - failed}/${out.length} checks passed`);
process.exit(failed ? 1 : 0);
