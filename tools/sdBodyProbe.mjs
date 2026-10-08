// SD17 - THE BODY MOVED, DRAWN IN A REAL BROWSER (the motes' and the sparks' probes' method, tools/sdFxProbe.mjs; on
// Vite's own server - the scene's graph reaches `import.meta.glob`).
//
// node holds the rig's law (test/sd17_body.test.js - the states, the joints kept, every blow moved); what node cannot
// answer is what the body LOOKS like in each pose, and whether the beam's pass compiles, links and lights the frame. So:
// the Remnant's own seven parts (world/sdRemnantModel.js buildRemnantParts) stood by the rig's own matrices
// (scenes/sdRemnantRig.js) in a plain lit pass, one pose a tile - and the Hour-Hand's beam (render/sdBeam.js) out of its
// hand mid-sweep. Each pose must draw its body and differ from its rest; the beam must light the frame along its line.
// SD_BODY_SHOT=<file.png> writes the tiles.
//
//     node tools/sdBodyProbe.mjs
import { chromium } from 'playwright';
import { writeFile, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = []; const check = (n, ok, d = '') => { out.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${d ? ` - ${d}` : ''}`); };
const TW = 240, TH = 300, COLS = 6;
const POSES = ['dormant', 'still', 'walk', 'stompRaise', 'stompLand', 'handRaise', 'handSweep', 'volleyGather', 'volleyThrow', 'pulse', 'resetRaise', 'resetSlam', 'end', 'stunned', 'rising', 'slip', 'fallen', 'beam'];
const ROWS = Math.ceil(POSES.length / COLS);
const PAGE_NAME = 'sdbody-probe.tmp.html', PAGE_PATH = join(ROOT, 'tools', PAGE_NAME);

const PAGE = `<!doctype html><html><body style="margin:0;background:#000"><canvas id=c width=${TW * COLS} height=${TH * ROWS}></canvas><script type=module>
import { buildRemnantParts, SD_REMNANT_PARTS } from '/src/world/sdRemnantModel.js';
import { remnantRig, rigMatrices, arenaBase, sdBeamDraws, gearFlightOf, SD_WAKE_MS, SD_SLIP_EVERY_MS } from '/src/scenes/sdRemnantRig.js';
import { SdBeamRenderer } from '/src/render/sdBeam.js';
import { SD_BLOWS, SD_BODY } from '/src/net/sdRemnant.js';
import { SD_ARENA, realmToDungeon } from '/src/net/sdBrain.js';
const gl = document.getElementById('c').getContext('webgl2', { alpha: false, preserveDrawingBuffer: true, antialias: true });
const VS = \`#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec3 aN;
uniform mat4 uVP, uM; out vec3 vN;
void main() { vN = mat3(uM) * aN; gl_Position = uVP * uM * vec4(aP, 1.0); }\`;
const FS = \`#version 300 es
precision highp float; in vec3 vN; uniform vec3 uC; out vec4 o;
void main() { vec3 n = normalize(vN); float l = 0.3 + 0.7 * max(0.0, dot(n, normalize(vec3(0.4, 0.8, 0.5)))); o = vec4(uC * l, 1.0); }\`;
const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
const prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
const U = { vp: gl.getUniformLocation(prog, 'uVP'), m: gl.getUniformLocation(prog, 'uM'), c: gl.getUniformLocation(prog, 'uC') };
const meshes = buildRemnantParts('brass').map((m) => {
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, m.positions, gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  const n = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, n); gl.bufferData(gl.ARRAY_BUFFER, m.normals, gl.STATIC_DRAW); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
  return { vao, count: m.positions.length / 3 };
});
const COLORS = [[0.75, 0.5, 0.2], [0.9, 0.62, 0.25], [0.8, 0.55, 0.22], [0.95, 0.7, 0.3], [0.7, 0.5, 0.25], [1, 0.75, 0.35], [0.85, 0.6, 0.25]];
const persp = (f, a, n, fa) => { const t = 1 / Math.tan(f / 2); return new Float32Array([t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0]); };
const look = (e, c) => {
  const u = [0, 1, 0], z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]]; const lz = Math.hypot(...z); for (let i = 0; i < 3; i++) z[i] /= lz;
  const x = [u[1] * z[2] - u[2] * z[1], u[2] * z[0] - u[0] * z[2], u[0] * z[1] - u[1] * z[0]]; const lx = Math.hypot(...x); for (let i = 0; i < 3; i++) x[i] /= lx;
  const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]), -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]), -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]), 1]);
};
const mul = (a, b) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
const T0 = 1_800_000_000_000;
const F = (o = {}) => ({ fi: 2, ph: 1, op: T0 - 60000, ou: 0, su: 0, h: 1000, m: 1000, rem: { x: 0, z: 0, yw: 0, mv: null, atk: null }, ec: null, clk: null, cx: null, fell: null, lost: 0, ...o });
const atk = (A, at, more = {}) => ({ k: 'atk', b: 0, i: 1, a: A.id, at, x: 0, z: 0, yw: 0, tg: [[4, 12]], ...more });
const vw = SD_BLOWS.volley.windup, go = T0 + vw - gearFlightOf(vw);
const SCENES = {
  dormant: [F({ op: T0 + 5000 }), T0], still: [F(), T0 + 1000],
  walk: [F({ rem: { x: 0, z: 0, yw: 0, mv: { x: 0, z: 0, tx: 0, tz: 20, v: 2.6, at: T0 }, atk: null } }), T0 + (6.4 / 2.6) * 1000],
  stompRaise: [F({ rem: { x: 0, z: 0, yw: 0, mv: null, atk: atk(SD_BLOWS.stomp, T0 + 600) } }), T0],
  stompLand: [F({ rem: { x: 0, z: 0, yw: 0, mv: null, atk: atk(SD_BLOWS.stomp, T0 - 100) } }), T0],
  handRaise: [F({ rem: { x: 0, z: 0, yw: 0, mv: null, atk: atk(SD_BLOWS.hand, T0 + 400, { sw: 1 }) } }), T0],
  handSweep: [F({ rem: { x: 0, z: 0, yw: 0, mv: null, atk: atk(SD_BLOWS.hand, T0 - 1400, { sw: 1 }) } }), T0],
  volleyGather: [F({ rem: { x: 0, z: 0, yw: 0, mv: null, atk: atk(SD_BLOWS.volley, T0 + vw) } }), go - 10],
  volleyThrow: [F({ rem: { x: 0, z: 0, yw: 0, mv: null, atk: atk(SD_BLOWS.volley, T0 + vw) } }), go + 300],
  pulse: [F({ clk: { ...atk(SD_BLOWS.pulse, T0 + 10), b: SD_BODY.hour } }), T0],
  resetRaise: [F({ ph: 3, rem: { x: 0, z: 0, yw: 0, mv: null, atk: atk(SD_BLOWS.reset, T0 + 4000) } }), T0],
  resetSlam: [F({ ph: 3, rem: { x: 0, z: 0, yw: 0, mv: null, atk: atk(SD_BLOWS.reset, T0 - 100) } }), T0],
  end: [F({ clk: { ...atk(SD_BLOWS.end, T0 + 1000), b: SD_BODY.hour } }), T0],
  stunned: [F({ su: T0 + 4000 }), T0], rising: [F({ ph: 3, ou: T0 + 1200 }), T0],
  slip: [F({ h: 150 }), null], fallen: [F({ fell: { at: T0 - 2500, top: [], n: 1 } }), T0],
  beam: [F({ rem: { x: 0, z: 0, yw: 0, mv: null, atk: atk(SD_BLOWS.hand, T0 - 2000, { sw: 1 }) } }), T0],
};
// the slip's moment: the first within two beats
{ const [s] = SCENES.slip; for (let t = T0; t < T0 + 2 * SD_SLIP_EVERY_MS; t += 10) if (remnantRig(s, -1, t).state === 'slip' && remnantRig(s, -1, t + 200).state === 'slip') { SCENES.slip[1] = t + 200; break; } }
let beamPass = null, beamErr = null;
try { beamPass = new SdBeamRenderer(gl); } catch (e) { beamErr = String(e.message ?? e); }
window.probe = { beamErr, beamLinked: beamPass ? gl.getProgramParameter(beamPass.program, gl.LINK_STATUS) : false, bodyLinked: gl.getProgramParameter(prog, gl.LINK_STATUS) };
const tileOf = (k) => [(k % ${COLS}) * ${TW}, (${ROWS} - 1 - Math.floor(k / ${COLS})) * ${TH}];
window.drawAll = (names) => {
  gl.enable(gl.SCISSOR_TEST); gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE);
  const res = {};
  names.forEach((name, k) => {
    const [s, t] = SCENES[name], [tx, ty] = tileOf(k);
    gl.viewport(tx, ty, ${TW}, ${TH}); gl.scissor(tx, ty, ${TW}, ${TH});
    gl.clearColor(0.06, 0.06, 0.09, 1); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // a three-quarter view from its right front, the floor at the arena's
    const at = [0, 4, 0], eye = name === 'beam' ? [-22, 14, -14] : [-11, 6.5, 13];
    const P = persp(0.9, ${TW} / ${TH}, 0.1, 200), V = look(eye, name === 'beam' ? [0, 2, 12] : at), VP = mul(P, V);
    gl.useProgram(prog); gl.uniformMatrix4fv(U.vp, false, VP);
    const rig = remnantRig(s, -1, t), base = arenaBase(0, 0, 0), parts = rigMatrices(base, rig);
    const mats = [base, ...parts];
    mats.forEach((m, i) => { gl.uniformMatrix4fv(U.m, false, Float32Array.from(m)); gl.uniform3fv(U.c, COLORS[i]); gl.bindVertexArray(meshes[i].vao); gl.drawArrays(gl.TRIANGLES, 0, meshes[i].count); });
    let beamDrew = false;
    if (name === 'beam' && beamPass) {
      // the beam in the arena's frame here (the probe stands the body at the arena's origin)
      const to = (p) => { const d = realmToDungeon(SD_ARENA.x, 0, SD_ARENA.z); return [p[0] - d[0], p[1] - d[1], p[2] - d[2]]; };
      const beams = sdBeamDraws(s, t).map((g) => ({ ...g, a: to(g.a), b: to(g.b), f0: to(g.f0), f1: to(g.f1) }));   // AUDIT SD III (V2): and its band on the floor
      beamDrew = beamPass.draw(beams, P, V, eye, 3.5, null);
      res.beamLine = beams[0];
      res.beamVP = Array.from(VP);
    }
    res[name] = { state: rig.state, beamDrew, glErr: gl.getError() };
  });
  return res;
};
window.ready = true;
</script></body></html>`;

const vite = await createServer({ root: ROOT, server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await vite.listen();
const port = vite.httpServer.address().port;
const browser = await chromium.launch();
try {
  await writeFile(PAGE_PATH, PAGE);
  const page = await browser.newPage({ viewport: { width: TW * COLS, height: TH * ROWS } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/tools/${PAGE_NAME}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 }); } catch (e) { console.log(errs.join('\n')); throw e; }
  const p = await page.evaluate(() => window.probe);
  check('the beam\'s program compiles and links', !p.beamErr && p.beamLinked === true, p.beamErr ?? '');
  const r = await page.evaluate((names) => window.drawAll(names), POSES);
  for (const name of POSES.filter((n) => n !== 'beam')) check(`${name}: the rig names it so, no GL error`, r[name].state === name && r[name].glErr === 0, `${r[name].state}`);
  // the pixels: each tile's body drawn, and differing from its rest ('still')
  const px = await page.evaluate(([W, H, C, R, names]) => {
    const gl = document.getElementById('c').getContext('webgl2');
    const all = new Uint8Array(W * C * H * R * 4); gl.readPixels(0, 0, W * C, H * R, gl.RGBA, gl.UNSIGNED_BYTE, all);
    const tile = (k) => { const x0 = (k % C) * W, y0 = (R - 1 - Math.floor(k / C)) * H, m = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = ((y0 + y) * W * C + x0 + x) * 4; m.push(all[o] + all[o + 1] + all[o + 2] > 60 ? 1 : 0); } return m; };
    const tiles = names.map((_, k) => tile(k)), still = tiles[names.indexOf('still')];
    return names.map((n, k) => ({ n, body: tiles[k].reduce((a, v) => a + v, 0), diff: tiles[k].reduce((a, v, i) => a + (v !== still[i] ? 1 : 0), 0) }));
  }, [TW, TH, COLS, ROWS, POSES]);
  for (const t of px) {
    if (t.n === 'beam') continue;
    check(`${t.n}: the body drawn${t.n === 'still' ? '' : ', and moved from its rest'}`, t.body > 2000 && (t.n === 'still' || t.diff > 150), `${t.body} px, ${t.diff} px from rest`);
  }
  const beamTile = px.find((t) => t.n === 'beam');
  check('the beam drawn by its pass, out of its hand along the sweep', r.beam.beamDrew && r.beam.glErr === 0 && beamTile.body > px.find((t) => t.n === 'handSweep').body * 0.5, `${beamTile.body} px lit`);
  if (process.env.SD_BODY_SHOT) { await page.screenshot({ path: process.env.SD_BODY_SHOT }); console.log(`tiles: ${process.env.SD_BODY_SHOT}`); }
  check('no page error', errs.length === 0, errs.join('; '));
} finally {
  await browser.close();
  await vite.close();
  await unlink(PAGE_PATH).catch(() => {});
}
const failed = out.filter((o) => !o).length;
console.log(`\n${out.length - failed}/${out.length} checks passed`);
process.exit(failed ? 1 : 0);
