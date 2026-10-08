// SD16 - THE HOUR'S BLOWS SEEN, DRAWN IN A REAL BROWSER (the motes' probe's method, tools/sdMotesProbe.mjs).
//
// node holds the bursts' law (test/sd16_fx.test.js - which kinds, where, when, the shakes and the lights); what node
// cannot answer is whether the gate's spark pass, fed the Hour's bursts in the dungeon's frame, lights the frame where
// they stand. So: the repo's own modules served as they are, a fight turned through its landings and turns on a fake
// link, scenes/sdFx.js's own draw over a cleared frame from the arena's rim, the frame read back about each burst. It runs
// on Vite's own dev server (tools/qs3Probe.mjs's reason): the scene's graph reaches `import.meta.glob`, Vite's macro.
//
//     node tools/sdFxProbe.mjs
import { chromium } from 'playwright';
import { writeFile, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = []; const check = (n, ok, d = '') => { out.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${d ? ` - ${d}` : ''}`); };
const W = 640, H = 400;
const PAGE_NAME = 'sdfx-probe.tmp.html', PAGE_PATH = join(ROOT, 'tools', PAGE_NAME);

const PAGE = `<!doctype html><html><body style="margin:0;background:#000"><canvas id=c width=${W} height=${H}></canvas><script type=module>
import { createSdFx, SD_FX_KINDS } from '/src/scenes/sdFx.js';
import { SD_BLOWS, SD_BODY } from '/src/net/sdRemnant.js';
import { SD_ARENA, realmToDungeon } from '/src/net/sdBrain.js';
const gl = document.getElementById('c').getContext('webgl2', { alpha: false, preserveDrawingBuffer: true });
const persp = (f, a, n, fa) => { const t = 1 / Math.tan(f / 2); return new Float32Array([t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0]); };
const look = (e, c) => {
  const u = [0, 1, 0], z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]]; const lz = Math.hypot(...z); for (let i = 0; i < 3; i++) z[i] /= lz;
  const x = [u[1] * z[2] - u[2] * z[1], u[2] * z[0] - u[0] * z[2], u[0] * z[1] - u[1] * z[0]]; const lx = Math.hypot(...x); for (let i = 0; i < 3; i++) x[i] /= lx;
  const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]), -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]), -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]), 1]);
};
const mul = (a, b) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
const T0 = 1_800_000_000_000;
let t = T0;
const s = { fi: 2, ph: 1, op: T0 - 60_000, su: 0, h: 1000, m: 1000, rem: { x: 0, z: 0, yw: 0, mv: null, atk: null }, ec: null, clk: null, cx: null, fell: null, lost: 0 };
const fx = createSdFx({ link: { state: () => s, now: () => t }, feet: () => null });
fx.frame();
const eyeR = [SD_ARENA.x, 6, SD_ARENA.z - 26], atR = [SD_ARENA.x, 1, SD_ARENA.z];
const eye = realmToDungeon(...eyeR), P = persp(1.1, ${W} / ${H}, 0.1, 500), V = look(eye, realmToDungeon(...atR)), VP = mul(P, V);
const atk = (A, i, more = {}) => ({ k: 'atk', b: SD_BODY.remnant, i, a: A.id, at: t + 5, x: 0, z: 0, yw: 0, tg: [], ...more });
const shots = {
  stomp: () => { s.rem.atk = atk(SD_BLOWS.stomp, 1, { x: -6, z: 2 }); },
  volley: () => { s.rem.atk = atk(SD_BLOWS.volley, 2, { tg: [[6, -4], [8, 6]] }); },
  pulse: () => { s.clk = { ...atk(SD_BLOWS.pulse, 3), b: SD_BODY.hour }; },
  hearts: () => { s.ph = 3; s.cx = { i: 9, m: 50, c: [[-8, -8, 50], [8, -8, 50], [0, 10, 50]] }; },
  fall: () => { s.rem = { x: 4, z: 0, yw: 0, mv: null, atk: null }; s.fell = { at: t + 5, top: [], n: 1 }; },
};
window.shoot = (name, ahead) => {
  fx.leave(); fx.frame();   // each shot alone on the frame
  shots[name]();
  t += 10; fx.frame();
  t += ahead; fx.frame();
  gl.clearColor(0, 0, 0, 1); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const drew = fx.draw(gl, P, V, eye, t, null, ${H});
  const glErr = gl.getError();
  const px = new Uint8Array(${W} * ${H} * 4); gl.readPixels(0, 0, ${W}, ${H}, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let lit = 0; for (let i = 0; i < px.length; i += 4) if (px[i] + px[i + 1] + px[i + 2] > 24) lit++;
  const each = fx.bursts(t).map((b) => {
    const c = [0, 1, 2, 3].map((r) => VP[r] * b.at[0] + VP[4 + r] * b.at[1] + VP[8 + r] * b.at[2] + VP[12 + r]);
    const sx = Math.round((c[0] / c[3] * 0.5 + 0.5) * ${W}), sy = Math.round((c[1] / c[3] * 0.5 + 0.5) * ${H});
    let best = 0, warm = 0, green = 0;
    for (let dy = -18; dy <= 18; dy++) for (let dx = -18; dx <= 18; dx++) {
      const yy = sy + dy, xx = sx + dx; if (yy < 0 || xx < 0 || yy >= ${H} || xx >= ${W}) continue;
      const o = (yy * ${W} + xx) * 4, v = px[o] + px[o + 1] + px[o + 2];
      best = Math.max(best, v); warm += px[o] - px[o + 2]; green += px[o + 1] - px[o];   // the core saturates white; the halo is the colour's
    }
    return { kind: Object.keys(SD_FX_KINDS).find((k) => SD_FX_KINDS[k] === b.kind), sx, sy, best, warm, green, color: b.color };
  });
  return { drew, glErr, lit, each, lights: fx.lights(t).length };
};
window.ready = true;
</script></body></html>`;

const vite = await createServer({ root: ROOT, server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await vite.listen();
const port = vite.httpServer.address().port;
const browser = await chromium.launch();
try {
  await writeFile(PAGE_PATH, PAGE);
  const page = await browser.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/tools/${PAGE_NAME}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 }); } catch (e) { console.log(errs.join('\n')); throw e; }
  const want = { stomp: ['stomp'], volley: ['volley'], pulse: ['pulse'], hearts: ['heartRise'], fall: ['fall'] };
  for (const [name, kinds] of Object.entries(want)) {
    const r = await page.evaluate(([n]) => window.shoot(n, 120), [name]);
    check(`${name}: drawn by the gate's spark pass, no GL error, the frame lit`, r.drew && r.glErr === 0 && r.lit > 30, `lit ${r.lit} px, error ${r.glErr}`);
    const mine = r.each.filter((b) => kinds.includes(b.kind));
    check(`${name}: every burst of it lit where the law stands it`, mine.length > 0 && mine.every((b) => b.best > 60), mine.map((b) => `${b.kind}@${b.sx},${b.sy}: ${b.best}`).join(' '));
    if (name === 'stomp' || name === 'fall') check(`${name}: the brass's warmth (red over blue, about it)`, mine.every((b) => b.warm > 0), mine.map((b) => b.warm).join(' '));
    if (name === 'hearts') check('hearts: their green (green over red, about them)', mine.every((b) => b.green > 0), mine.map((b) => b.green).join(' '));
    if (name !== 'hearts') check(`${name}: its flash in the Hour's light`, r.lights > 0, `${r.lights}`);
  }
  check('no page error', errs.length === 0, errs.join('; '));
} finally {
  await browser.close();
  await vite.close();
  await unlink(PAGE_PATH).catch(() => {});
}
const failed = out.filter((o) => !o).length;
console.log(`\n${out.length - failed}/${out.length} checks passed`);
process.exit(failed ? 1 : 0);
