// TACT4 - A FOE'S TELEGRAPH, COMPILED, LINKED AND DRAWN IN A REAL BROWSER.
//
// node holds the law (test/tact4.test.js: the shader's reading held to inBlow point for point); what node cannot
// answer is whether the GLSL compiles and links in a real WebGL2 context and whether the shape lands on the ground -
// lit inside, dark outside, dim through its wind-up, bright at the landing. So: the repo's own modules served as they
// are, a grey ground drawn by a stand-in shader, the pass drawn by its own class, and the frame read back.
//
//     node tools/foeTelegraphProbe.mjs [--shots <dir>]     (writes lunge.png / sweep.png / slam.png there when given)
import { chromium } from 'playwright';
import http from 'node:http';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const shotsAt = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
const out = []; const check = (n, ok, d = '') => { out.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${d ? ` - ${d}` : ''}`); };

const PAGE = `<!doctype html><html><body style="margin:0;background:#000"><canvas id=c width=512 height=512></canvas><script type=module>
import { FoeTelegraphPass } from '/src/render/foeTelegraph.js';
import { makeBlow, blowPhase } from '/src/ai/foeBlows.js';
import { perspective, lookAt } from '/src/world/mat4.js';
const gl = document.getElementById('c').getContext('webgl2', { alpha: false, preserveDrawingBuffer: true });
const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
const pr = gl.createProgram();
gl.attachShader(pr, sh(gl.VERTEX_SHADER, '#version 300 es\\nlayout(location=0) in vec2 p; uniform mat4 vp; void main(){ gl_Position = vp * vec4(p.x, 0.0, p.y, 1.0); }'));
gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, '#version 300 es\\nprecision highp float; out vec4 o; void main(){ o = vec4(0.18, 0.18, 0.18, 1.0); }'));
gl.linkProgram(pr);
const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-20,-20, 20,-20, 20,20, -20,-20, 20,20, -20,20]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.bindVertexArray(null);
const proj = perspective(1.0, 1, 0.1, 100);
const view = lookAt([0, 14, 0.001], [0, 0, 0], [0, 1, 0]);
const vp = new Float32Array(16);
for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) vp[c*4+r] = proj[r]*view[c*4] + proj[4+r]*view[c*4+1] + proj[8+r]*view[c*4+2] + proj[12+r]*view[c*4+3];
const pass = new FoeTelegraphPass(gl);
window.err = gl.getError();
window.draw = (kind, when, fog = null, slope = null, nearFloor = 0, guard = 'poise', contrast = false) => {
  gl.viewport(0, 0, 512, 512);
  gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.useProgram(pr); gl.uniformMatrix4fv(gl.getUniformLocation(pr, 'vp'), false, vp);
  gl.bindVertexArray(vao); gl.drawArrays(gl.TRIANGLES, 0, 6); gl.bindVertexArray(null);
  const blow = makeBlow(kind, [0, 0, 0], 0, 10, null, guard);   // at the origin, facing +z (TELL3: its guard; one colour for both, so the shape alone tells them)
  const share = when === 'mid' ? 0.5 : when === 'now' ? 0.95 : 0.4;   // TELL2: halfway, and inside the last stretch
  const at = when === 'land' ? blow.land + 0.02 : 10 + (blow.land - 10) * share;   // the landing's flash, or that far through the wind-up
  if (slope) blow.slope = slope;
  if (kind === 'leap') blow.ahead = 3;   // TELL6: its point, 3 m out
  if (kind === 'aimed') blow.ahead = 6;   // TELL6: its line, 6 m to its target
  const phase = when === 'shatter' ? { t: 0.5, flash: 0, shatter: 1 } : when === 'shatter-late' ? { t: 0.5, flash: 0, shatter: 0.3 } : blowPhase(blow, at);   // AUDIT TELL (3.2): a broken one, going out
  const n = pass.draw([{ blow, phase, nearFloor }], proj, view, fog, { contrast });   // TELL9: the preference said outright
  // read the ground at a world point
  const px = (x, z) => { const v = [x, 0, z, 1]; const c = [0,0,0,0]; for (let r = 0; r < 4; r++) c[r] = vp[r]*v[0] + vp[4+r]*v[1] + vp[8+r]*v[2] + vp[12+r]*v[3];
    const sx = Math.round((c[0]/c[3]*0.5+0.5)*511), sy = Math.round((c[1]/c[3]*0.5+0.5)*511); const o = new Uint8Array(4); gl.readPixels(sx, sy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, o); return ch === 2 ? o[2] : o[0]; };
  let ch = 0;
  const blue = (x, z) => { ch = 2; const v = px(x, z); ch = 0; return v; };   // TELL9: white is lit in blue too, the amber line is not
  return { n, err: gl.getError(), probes: { ahead: px(0, 1.8), beside: px(3.5, 1.8), behind: px(0, -2.5), far: px(0, 4.0), wide: px(1.5, 1.5), keyline: px(0.70, 1.8), keyW: px(0.78, 1.8), keyWBlue: blue(0.78, 1.8), keyD: px(0.745, 1.8), aheadBlue: blue(0, 1.8), rear: px(0, -0.49), rearOut: px(0, -0.62), inner: px(0.35, 1.8), feet: px(0, 0.8), out: px(0, 4.9), lane7: px(0, 7.0), laneWide: px(0.7, 3.0), hatch: Array.from({ length: 13 }, (_, i) => px(0, 2.5 + i * 0.03)) }, png: document.getElementById('c').toDataURL() };
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
  const page = await browser.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/probe/`);
  await page.waitForFunction(() => window.ready || window.err === undefined, null, { timeout: 15000 }).catch(() => {});
  check('the page and the pass build (the GLSL compiles and links)', await page.evaluate(() => window.ready === true), errs.join(' | '));
  const shot = (name, png) => { if (shotsAt) writeFileSync(join(shotsAt, `${name}.png`), Buffer.from(png.split(',')[1], 'base64')); };
  const GROUND = 46;   // 0.18 grey
  for (const kind of ['lunge', 'sweep', 'slam']) {
    const wind = await page.evaluate((k) => window.draw(k, 'wind'), kind);
    const land = await page.evaluate((k) => window.draw(k, 'land'), kind);   // past every wind-up, inside the flash
    shot(kind, land.png);
    check(`${kind}: drawn, no GL error`, wind.n === 1 && wind.err === 0 && land.err === 0, JSON.stringify({ n: wind.n, err: wind.err }));
    check(`${kind}: lit ahead, dark beside and behind`, land.probes.ahead > GROUND + 60 && Math.abs(land.probes.beside - GROUND) < 6 && Math.abs(land.probes.behind - GROUND) < 6, JSON.stringify(land.probes));
    check(`${kind}: dimmer in the wind-up than at the landing`, wind.probes.ahead > GROUND && wind.probes.ahead < land.probes.ahead, `${wind.probes.ahead} < ${land.probes.ahead}`);
  }
  const lunge = await page.evaluate(() => window.draw('lunge', 'land'));
  check('the lunge reaches past the slam\'s disc and stays in its lane', lunge.probes.far > GROUND + 60 && Math.abs(lunge.probes.wide - GROUND) < 6, JSON.stringify(lunge.probes));
  const sweep = await page.evaluate(() => window.draw('sweep', 'land'));
  const fogged = await page.evaluate(() => window.draw('lunge', 'land', { mode: 1, range: new Float32Array([2, 16]), density: 0, camPos: new Float32Array([0, 14, 0]) }));
  check('fogged: the mark dims in the frame\'s fog (AUDIT TACT D9)', fogged.probes.ahead < 255 && fogged.probes.ahead > 46, JSON.stringify(fogged.probes));
  const down = await page.evaluate(() => window.draw('lunge', 'land', null, [0, -0.5]));   // told the ground falls away ahead: over this flat ground its lane sinks under it, hidden
  const up = await page.evaluate(() => window.draw('lunge', 'land', null, [0, 0.5]));   // told it rises: the lane stands over the flat ground, seen to its end
  check('tilted: the mark follows the slope it is given (AUDIT TACT D8)', Math.abs(down.probes.ahead - 46) < 6 && Math.abs(down.probes.far - 46) < 6 && up.probes.ahead > 46 + 60 && up.probes.far > 46 + 60, JSON.stringify({ down: down.probes, up: up.probes }));
  check('the sweep\'s cone holds the diagonal ahead', sweep.probes.wide > GROUND + 60, JSON.stringify(sweep.probes));
  // TELL2 (bible/12-Enhanced-AI/Feud-Arc.md 4.4): the boss's readable line at a foe's scale
  const wind = await page.evaluate(() => window.draw('lunge', 'wind'));
  check('TELL2: a dark keyline just outside the line darkens the floor (the blend is premultiplied, not additive)', wind.probes.keyline < GROUND - 8, JSON.stringify(wind.probes));
  const mid = await page.evaluate(() => window.draw('lunge', 'mid'));
  const now = await page.evaluate(() => window.draw('lunge', 'now'));
  check('TELL2: the last stretch brightens it ("now")', now.probes.ahead > mid.probes.ahead + 20, `${mid.probes.ahead} -> ${now.probes.ahead}`);
  const thick = { mode: 1, range: new Float32Array([1, 3]), density: 0, camPos: new Float32Array([0, 14, 0]) };
  const lost = await page.evaluate((f) => window.draw('lunge', 'land', { ...f, range: new Float32Array(f.range), camPos: new Float32Array(f.camPos) }), { ...thick, range: [...thick.range], camPos: [...thick.camPos] });
  const kept = await page.evaluate((f) => window.draw('lunge', 'land', { ...f, range: new Float32Array(f.range), camPos: new Float32Array(f.camPos) }, null, 0.6), { ...thick, range: [...thick.range], camPos: [...thick.camPos] });
  check('TELL2: a mark near the player keeps its floor through thick fog', Math.abs(lost.probes.ahead - GROUND) < 6 && kept.probes.ahead > GROUND + 40, JSON.stringify({ lost: lost.probes.ahead, kept: kept.probes.ahead }));
  // TELL6: the ring - lit about its feet, dark at them (the hug answers it) and past its outer edge
  const ringW = await page.evaluate(() => window.draw('ring', 'wind'));
  const ringL = await page.evaluate(() => window.draw('ring', 'land'));
  check('TELL6: the ring is drawn, no GL error', ringW.n === 1 && ringW.err === 0 && ringL.err === 0, JSON.stringify({ n: ringW.n, err: ringW.err }));
  check('TELL6: the ring lights its annulus, all round', ringL.probes.ahead > GROUND + 60 && ringL.probes.beside > GROUND + 60 && ringL.probes.behind > GROUND + 60, JSON.stringify(ringL.probes));
  check('TELL6: the ring leaves its feet and past its edge dark', Math.abs(ringL.probes.feet - GROUND) < 6 && Math.abs(ringL.probes.out - GROUND) < 6, JSON.stringify(ringL.probes));
  // TELL6: the charge - a lane past the lunge's reach and wider than it
  const chargeL = await page.evaluate(() => window.draw('charge', 'land'));
  const lungeL = await page.evaluate(() => window.draw('lunge', 'land'));
  check('TELL6: the charge\'s lane reaches past the lunge\'s and is wider', chargeL.n === 1 && chargeL.err === 0 && chargeL.probes.lane7 > GROUND + 60 && Math.abs(lungeL.probes.lane7 - GROUND) < 6 && chargeL.probes.laneWide > GROUND + 60 && Math.abs(lungeL.probes.laneWide - GROUND) < 30, JSON.stringify({ charge: chargeL.probes, lunge: lungeL.probes }));
  // TELL6: the leap - a disc at its point, its foe's own feet dark
  const leapL = await page.evaluate(() => window.draw('leap', 'land'));
  check('TELL6: the leap lights a disc at its point, nothing at its foe\'s feet', leapL.n === 1 && leapL.err === 0 && leapL.probes.ahead > GROUND + 60 && leapL.probes.far > GROUND + 60 && Math.abs(leapL.probes.feet - GROUND) < 6 && Math.abs(leapL.probes.out - GROUND) < 6, JSON.stringify(leapL.probes));
  // TELL6: the aimed shot - a thin line to its target, no further
  const aimedL = await page.evaluate(() => window.draw('aimed', 'land'));
  check('TELL6: the aimed line runs to its target, thin, and stops there', aimedL.n === 1 && aimedL.err === 0 && aimedL.probes.far > GROUND + 60 && Math.abs(aimedL.probes.lane7 - GROUND) < 30 && Math.abs(aimedL.probes.laneWide - GROUND) < 6, JSON.stringify(aimedL.probes));
  // TELL3: an iron blow is never told by colour alone - a second line a quarter-metre inside, a hatch across its fill
  const poiseW = await page.evaluate(() => window.draw('lunge', 'wind'));
  const ironW = await page.evaluate(() => window.draw('lunge', 'wind', null, null, 0, 'iron'));
  check('TELL3: the iron mark draws a second rim inside its outline', ironW.probes.inner > poiseW.probes.inner + 15, `${poiseW.probes.inner} -> ${ironW.probes.inner}`);
  const spread = (a) => Math.max(...a) - Math.min(...a);
  check('TELL3: the iron mark hatches its fill; the poise mark\'s is even', spread(ironW.probes.hatch) > 10 && spread(poiseW.probes.hatch) < 4, JSON.stringify({ iron: ironW.probes.hatch, poise: poiseW.probes.hatch }));
  // TELL9: telegraph contrast - the line twice as thick, a white keyline outside it, a pattern for every guard
  const boldW = await page.evaluate(() => window.draw('lunge', 'wind', null, null, 0, 'poise', true));
  const boldIron = await page.evaluate(() => window.draw('lunge', 'wind', null, null, 0, 'iron', true));
  console.log(JSON.stringify({ plain: { keyline: poiseW.probes.keyline, keyW: poiseW.probes.keyW, keyWBlue: poiseW.probes.keyWBlue }, bold: { keyline: boldW.probes.keyline, keyW: boldW.probes.keyW, keyWBlue: boldW.probes.keyWBlue } }));
  check('TELL9: contrast draws, no GL error', boldW.n === 1 && boldW.err === 0 && boldIron.err === 0, JSON.stringify({ n: boldW.n, err: boldW.err }));
  check('TELL9: contrast - the line twice as thick (where the dark keyline was, the line)', boldW.probes.keyline > GROUND + 30 && poiseW.probes.keyline < GROUND - 8, `${poiseW.probes.keyline} -> ${boldW.probes.keyline}`);
  check('TELL9: contrast - a white keyline outside it (lit in blue as in red)', boldW.probes.keyW > GROUND + 40 && boldW.probes.keyWBlue > GROUND + 40 && poiseW.probes.keyWBlue < GROUND + 12, JSON.stringify({ plain: [poiseW.probes.keyW, poiseW.probes.keyWBlue], bold: [boldW.probes.keyW, boldW.probes.keyWBlue] }));
  check('TELL9: contrast - a poise mark\'s fill dotted; iron keeps its hatch alone', spread(boldW.probes.hatch) > 10 && boldIron.probes.hatch.every((v, i) => Math.abs(v - ironW.probes.hatch[i]) < 4), JSON.stringify({ poise: boldW.probes.hatch, iron: boldIron.probes.hatch, ironPlain: ironW.probes.hatch }));
  // AUDIT TELL U2: the contrast keeps a dark band between its line and its white keyline - white on snow is no edge
  check('AUDIT TELL U2: contrast - a dark band between the line and the white keyline', boldW.probes.keyD < GROUND - 4, JSON.stringify({ keyline: boldW.probes.keyline, keyD: boldW.probes.keyD, keyW: boldW.probes.keyW }));
  // AUDIT TELL U8: the sweep's disc at its feet wears the outline behind the arc, and the floor past it is the floor's
  const sweepW = await page.evaluate(() => window.draw('sweep', 'wind'));
  check('AUDIT TELL U8: the sweep\'s rear disc is outlined behind its foe', sweepW.probes.rear > sweepW.probes.ahead + 30 && sweepW.probes.rearOut < GROUND, JSON.stringify({ rear: sweepW.probes.rear, rearOut: sweepW.probes.rearOut, ahead: sweepW.probes.ahead }));
  // AUDIT TELL (3.2): a broken wind-up shatters - white (lit in blue, as the amber fill is not), cracked, going out
  const shat = await page.evaluate(() => window.draw('lunge', 'shatter'));
  const shatLate = await page.evaluate(() => window.draw('lunge', 'shatter-late'));
  check('AUDIT TELL (3.2): the shatter draws, no GL error', shat.n === 1 && shat.err === 0 && shatLate.err === 0, JSON.stringify({ n: shat.n, err: shat.err }));
  check('AUDIT TELL (3.2): the shatter is white and cracked - never the landing\'s whole flash', shat.probes.aheadBlue > GROUND + 40 && poiseW.probes.aheadBlue < GROUND + 12 && spread(shat.probes.hatch) > 10, JSON.stringify({ aheadBlue: shat.probes.aheadBlue, hatch: shat.probes.hatch }));
  check('AUDIT TELL (3.2): the shatter goes out', shatLate.probes.ahead < shat.probes.ahead - 30 && shatLate.probes.ahead >= GROUND - 2, `${shat.probes.ahead} -> ${shatLate.probes.ahead}`);
  if (shotsAt) { for (const [n, r] of [['contrast-poise', boldW], ['contrast-iron', boldIron], ['plain-poise', poiseW], ['shatter', shat], ['sweep-wind', sweepW]]) writeFileSync(join(shotsAt, `${n}.png`), Buffer.from(r.png.split(',')[1], 'base64')); }
} finally {
  await browser.close();
  server.close();
}
const failed = out.filter((x) => !x).length;
console.log(failed ? `\n${failed} FAILED` : `\nall ${out.length} held`);
process.exit(failed ? 1 : 0);
