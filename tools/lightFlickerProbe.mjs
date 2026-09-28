// LIGHT-AUDIT (2026-09-26, Mac: "a deep audit on the enhanced lighting system, look for flickering issues, performance
// improvements"): THE FLICKER, MEASURED IN THE REAL GAME. DISC15's lesson ("Opus seemingly always considers it solved.
// Its not solved") is that a flicker is a number or it is a guess. This drives the WORLD host - the one players run -
// over the user's own ARENA2 in headless Chromium (ANGLE over SwiftShader), walks into a tavern, a dungeon and a night
// street, and reads EVERY FRAME back while the camera stands still, walks and turns on a script:
//   - `c12`/`c4`: the share of the screen whose luma moved 12+ / 4+ levels since the last frame (DISC15's measure);
//   - `flip`: the share that moved 8+ levels one way and then 8+ back the next frame - the flicker's own signature,
//     which a moving camera's honest parallax rarely makes;
//   - `ms`: the frame callback's CPU time; and the renderer's and the shadow pass's own counters.
// A still camera should read `c12` near zero (a flame's sprite and a walker aside); a walk should never spike.
//
// Usage: ARENA2_PATH=/home/user/dfdata/arena2 node tools/lightFlickerProbe.mjs [--scene tavern,dungeon,street]
//          [--lighting classic] [--out scratch/flicker] [--frames 60] [--w 800 --h 500] [--tod 21:30] [--label base]
//          [--still-max 1] [--port 5241] [--extra url&params] [--keep4 N] [--boot-s 900]
// Exits 1 (FAIL - ...) when the world never booted, a scene was not reached (the street: no tavern to stand before), a
// pass ran short, left its scene's mode, went black or threw, a walk did not walk or a turn did not turn, the HUD
// flashed red or the player was hurt in a pass (LA-AUDIT D), the page threw, or a still frame moved
// (tools/lightFlickerVerdict.mjs - LA-AUDIT F1).
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { summarize, judge } from './lightFlickerVerdict.mjs';   // LA-AUDIT F1: the summary and the verdict, pinned

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const SCENES = arg('scene', 'tavern,dungeon,street').split(',');
const LIGHTING = arg('lighting', '');
const OUT = arg('out', 'scratch/flicker');
const FRAMES = Number(arg('frames', 60));
const W = Number(arg('w', 800)), H = Number(arg('h', 500));
const TOD = arg('tod', '21:30');
const LABEL = arg('label', LIGHTING || 'lane');
const PORT = Number(arg('port', 5241));
const EXTRA = arg('extra', '');
const STILL_MAX = Number(arg('still-max', 1));   // percent of the screen a still frame may move by 12+ levels
const KEEP4 = Number(arg('keep4', 0)) / 100;   // also keep a frame pair when this share of the screen moved 4+ levels (0: off)
const BOOT_S = Number(arg('boot-s', 900));   // LA-AUDIT F1: how long the world may take to boot and stream idle (SwiftShader: ~310 s at night)
/** The verdict's one exit: what failed, and a nonzero code. */
function fail(msg) { console.error(`FAIL - ${msg}`); process.exit(1); }
mkdirSync(OUT, { recursive: true });
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';

// ---- a PNG writer (RGBA8, readPixels rows are bottom-up) -------------------
function crc32(buf) { let c, crc = 0xffffffff; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'ascii'), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + (h - 1 - y) * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const server = await createServer({ server: { port: PORT, strictPort: true, hmr: false, watch: null }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.stack ?? e.message)));
page.on('console', (m) => { if (m.type() === 'error' && !/CURSOR\.IMG|status of 404|ERR_CERT|net::/.test(m.text())) errors.push(`[console] ${m.text()}`); });
await page.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());   // nothing leaves the machine

// THE FRAME TAP: every game frame (the callback that moved window.__frame) is followed, in the same task, by a read of
// the drawing buffer - no preserveDrawingBuffer needed - and a plan's `before(k)` runs ahead of it to place the camera.
await page.addInitScript(() => {
  // THE GL LEDGER: every WebGL2 call counted by name, per frame - the CPU side of a frame in a unit no machine changes
  const G = window.__lfpGl = { calls: 0, by: Object.create(null) };
  const proto = window.WebGL2RenderingContext?.prototype;
  if (proto) for (const name of Object.getOwnPropertyNames(proto)) {
    const d = Object.getOwnPropertyDescriptor(proto, name);
    if (!d || typeof d.value !== 'function' || name === 'constructor') continue;
    const fn = d.value;
    proto[name] = function (...a) { G.calls++; G.by[name] = (G.by[name] ?? 0) + 1; return fn.apply(this, a); };
  }
  const P = window.__lfp = { on: false, k: 0, plan: null, rows: [], prev: null, prev2: null, keep: [], w: 0, h: 0 };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((t) => {
    const f0 = window.__frame;
    if (P.on && P.plan) { try { P.plan(P.k); } catch (e) { P.err = String(e); } }
    const G = window.__lfpGl, g0 = G.calls, by0 = P.on ? { ...G.by } : null;
    const t0 = performance.now();
    cb(t);
    const ms = performance.now() - t0;
    if (!P.on || window.__frame === f0) return;
    const gl1 = G.calls - g0;
    const top = {}; for (const k of ['uniform4fv', 'uniform3fv', 'uniform4f', 'uniform1i', 'uniform1f', 'uniformMatrix4fv', 'bindTexture', 'activeTexture', 'useProgram', 'drawElements', 'drawElementsInstanced', 'drawArrays', 'bindFramebuffer', 'clear', 'enable', 'disable', 'blendFunc', 'texSubImage2D', 'bufferSubData']) top[k] = (G.by[k] ?? 0) - (by0[k] ?? 0);   // LA-AUDIT D: and the 2D pass's own calls
    const canvas = document.querySelector('canvas');
    const gl = canvas?.getContext('webgl2');
    if (!gl) return;
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    if (!P.buf || P.w !== w || P.h !== h) { P.buf = new Uint8Array(w * h * 4); P.w = w; P.h = h; P.prev = null; P.prev2 = null; }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, P.buf);
    const n = w * h, Y = new Uint8Array(n), b = P.buf;
    for (let i = 0, j = 0; i < n; i++, j += 4) Y[i] = (54 * b[j] + 183 * b[j + 1] + 19 * b[j + 2]) >> 8;
    let c12 = 0, c4 = 0, sum = 0, flip = 0, lum = 0;
    for (let i = 0; i < n; i++) lum += Y[i];   // LA-AUDIT F1: the frame's own mean - a black frame is no picture
    const GX = 16, GY = 10, grid = new Float32Array(GX * GY);
    if (P.prev) {
      for (let i = 0; i < n; i++) {
        const d = Y[i] - P.prev[i], a = d < 0 ? -d : d;
        sum += a; if (a >= 4) c4++;
        if (a >= 12) { c12++; const x = i % w, y = (i / w) | 0; grid[((y * GY / h) | 0) * GX + ((x * GX / w) | 0)]++; }
        if (P.prev2) { const d0 = P.prev[i] - P.prev2[i]; if (a >= 8 && (d0 >= 8 || d0 <= -8) && (d > 0) !== (d0 > 0)) flip++; }
      }
    }
    const r = window.__renderer, s = r?.stats ?? {}, sp = r?._shadowPass?.stats ?? {};
    // THE LIGHT SET'S CHURN: how many lights joined and left the renderer's set since the last frame, and how far off the
    // farthest one stands. LA-AUDIT F1: a count cannot tell a light that switched on from one LA-LIGHTS2 brought in at
    // no share, so `lInW`/`lOutW` weigh each join and leave by the light's share (its colour's largest channel, held
    // to 1); the hand's lights (the carried mask) move with the eye and weigh nothing; and a floating-origin recentre
    // (the eye jumping 50+ units) moves every light's place at once, so that frame's churn is not counted.
    const PL = r?._pointLights ?? [], PC = r?._pointColors, PK = r?._pointCarried, cp = r?._camPos ?? [0, 0, 0], keys = new Map();
    let lFar = 0;
    for (let i = 0; i + 3 < PL.length; i += 4) {
      const j = i >> 2, w = PK && PK[j] ? 0 : PC && PC.length >= j * 3 + 3 ? Math.min(1, Math.max(PC[j * 3], PC[j * 3 + 1], PC[j * 3 + 2])) : 1;
      keys.set(`${Math.round(PL[i] * 10)},${Math.round(PL[i + 1] * 10)},${Math.round(PL[i + 2] * 10)}`, w);
      lFar = Math.max(lFar, Math.hypot(PL[i] - cp[0], PL[i + 1] - cp[1], PL[i + 2] - cp[2]));
    }
    let lIn = 0, lOut = 0, lInW = 0, lOutW = 0;
    const shift = !!P.prevCam && Math.hypot(cp[0] - P.prevCam[0], cp[1] - P.prevCam[1], cp[2] - P.prevCam[2]) > 50;
    if (P.lightKeys && !shift) {
      for (const [k, w] of keys) if (!P.lightKeys.has(k)) { lIn++; lInW += w; }
      for (const [k, w] of P.lightKeys) if (!keys.has(k)) { lOut++; lOutW += w; }
    }
    P.lightKeys = keys; P.prevCam = [cp[0], cp[1], cp[2]];
    P.rows.push({ k: P.k, ms: +ms.toFixed(1), gl: gl1, glBy: top, c12: +(c12 / n).toFixed(4), c4: +(c4 / n).toFixed(4), mean: +(sum / n).toFixed(2), flip: +(flip / n).toFixed(4),
      draws: s.draws, prog: s.programBinds, tex: s.texBinds, sh: JSON.parse(JSON.stringify(sp)), lights: (r?._pointLights?.length ?? 0) / 4, cap: r?.maxPointLights ?? 0, lIn, lOut, lInW: +lInW.toFixed(3), lOutW: +lOutW.toFixed(3), shift, lFar: +lFar.toFixed(1), mode: window.__mode?.(), grid: P.prev ? Array.from(grid, (v) => +(v / (n / (GX * GY))).toFixed(3)) : null,
      lum: +(lum / n).toFixed(1), cam: [+cp[0].toFixed(2), +cp[1].toFixed(2), +cp[2].toFixed(2)], yaw: window.__lfpYaw?.() ?? null,   // LA-AUDIT F1
      hp: window.__playerEntity?.health ?? null, flash: window.__lfpFlash ? +window.__lfpFlash.alpha.toFixed(3) : null });   // LA-AUDIT D: the HUD's red flash, drawn this frame when over 0
    if (P.keepEvery && P.k % P.keepEvery === 0) P.keep.push({ k: P.k, px: b.slice() });
    if (P.keepIf && P.prev && (c12 / n >= P.keepIf || (P.keep4If && c4 / n >= P.keep4If))) P.keep.push({ k: P.k, px: b.slice(), prev: P.prevPx });
    P.prevPx = b.slice();
    P.prev2 = P.prev; P.prev = Y; P.k++;
  });
});

const ev = (fn, a) => page.evaluate(fn, a);
const sleep = (ms) => page.waitForTimeout(ms);
const frameNo = () => ev(() => window.__frame ?? 0);
async function waitFrames(n, cap = 120000) { const f0 = await frameNo(); const t0 = Date.now(); while (Date.now() - t0 < cap) { if (await frameNo() >= f0 + n) return true; await sleep(100); } return false; }
async function dismiss() { for (let i = 0; i < 40; i++) { const t = await ev(() => { try { return JSON.parse(window.__talk?.() ?? 'null'); } catch { return null; } }); if (!t?.overlay) return; await page.keyboard.press('Space'); await sleep(250); } }

/** Run one scripted pass: `plan` is a page-side function body (k) => void; returns the rows. */
async function run(name, planSrc, frames, { keepIf = 0.02 } = {}) {
  console.log(`run ${name} (${frames} frames)`);
  // LA-AUDIT D (2026-09-27): THE BLIP WAS THE HUD'S. Lens D found the one-frame blips of the LA runs were BLOOD2e's bleed
  // flash - a full-screen red quad at 0.05 a drip, drawn while the player stands under half health - a character the
  // night street had mauled; the flash is the same in every tree. Each pass starts whole, and the verdict refuses a pass
  // the HUD flashed in (a blow's or a bleed's): what it moved was not the lighting.
  await ev(() => { const e = window.__playerEntity; if (e && e.maxHealth > 0) e.health = e.maxHealth; });
  await ev(([src, keep, keep4]) => { const P = window.__lfp; P.rows = []; P.keep = []; P.k = 0; P.prev = null; P.prev2 = null; P.lightKeys = null; P.prevCam = null; P.err = null; P.keepIf = keep; P.keep4If = keep4; P.plan = src ? new Function('k', src) : null; P.on = true; }, [planSrc, keepIf, KEEP4]);
  const t0 = Date.now();
  while (Date.now() - t0 < 600000) { const k = await ev(() => window.__lfp.k); if (k >= frames) break; await sleep(150); }
  const out = await ev(() => { const P = window.__lfp; P.on = false; P.plan = null; return { rows: P.rows, err: P.err ?? null, w: P.w, h: P.h, keep: P.keep.slice(0, 6).map((x) => ({ k: x.k, px: Array.from(x.px), prev: x.prev ? Array.from(x.prev) : null })) }; });
  for (const x of out.keep) {
    writeFileSync(`${OUT}/${LABEL}-${name}-f${x.k}.png`, png(out.w, out.h, Uint8Array.from(x.px)));
    if (x.prev) writeFileSync(`${OUT}/${LABEL}-${name}-f${x.k}-prev.png`, png(out.w, out.h, Uint8Array.from(x.prev)));
  }
  const rows = out.rows.slice(1);   // the first frame has no predecessor
  const summary = summarize(name, rows, out.err);   // LA-AUDIT F1
  writeFileSync(`${OUT}/${LABEL}-${name}.json`, JSON.stringify({ summary, rows }, null, 1));
  console.log(JSON.stringify(summary));
  return summary;
}

/** The three passes at the camera where it stands: still, a walk along its facing, a turn in place. Each step is taken
 *  from where the player stands NOW (the floating origin recentres under a walk, and a pose from an old frame's numbers
 *  lands in another place). */
async function passes(scene, { walkStep = 0.06, turnStep = 0.02, open = false } = {}) {
  let yaw = await ev(() => window.__lfpYaw?.() ?? 0);
  if (open) yaw = await openHeading(yaw, walkStep);
  const res = [];
  res.push(await run(`${scene}-still`, null, FRAMES));
  // the walk is a pendulum - out along the heading for half the frames and back - so it never ends against a wall
  res.push(await run(`${scene}-walk`, `const yaw=${yaw}; const s=(k < ${FRAMES} ? 1 : -1) * ${walkStep}; const p=window.__player.pos; window.__pose(p[0]-Math.sin(yaw)*s, p[1], p[2]-Math.cos(yaw)*s, yaw, 0);`, FRAMES * 2));
  res.push(await run(`${scene}-turn`, `const p=window.__player.pos; window.__pose(p[0], p[1], p[2], ${yaw}+${turnStep}*k, 0);`, FRAMES * 2));
  return res;
}

/** Indoors the street's yaw names nothing (a room has its own axes): try eight headings from where the player stands,
 *  a dozen steps each, and face the one the body got furthest along - the room's most open line. */
async function openHeading(yaw0, step) {
  const start = await ev(() => window.__player.pos);
  let best = yaw0, bestD = -1;
  for (let a = 0; a < 8; a++) {
    const yaw = yaw0 + (a * Math.PI) / 4;
    await ev(([x, y, z, yw]) => window.__pose(x, y, z, yw, 0), [start[0], start[1], start[2], yaw]);
    await waitFrames(3);
    for (let i = 0; i < 12; i++) {
      await ev(([yw, st]) => { const p = window.__player.pos; window.__pose(p[0] - Math.sin(yw) * st, p[1], p[2] - Math.cos(yw) * st, yw, 0); }, [yaw, step]);
      await waitFrames(1);
    }
    const p = await ev(() => window.__player.pos);
    const d = Math.hypot(p[0] - start[0], p[2] - start[2]);
    if (d > bestD) { bestD = d; best = yaw; }
  }
  await ev(([x, y, z, yw]) => window.__pose(x, y, z, yw, 0), [start[0], start[1], start[2], best]);
  await waitFrames(20);
  say(`open heading ${best.toFixed(2)} (${bestD.toFixed(2)} in 12 steps)`);
  return best;
}

const url = `http://localhost:${PORT}/play/?world&shot&play&region=Daggerfall&loc=Daggerfall&class=1&novideo&weather=sunny&tod=${encodeURIComponent(TOD)}${LIGHTING ? `&lighting=${LIGHTING}` : ''}${EXTRA ? `&${EXTRA}` : ''}`;
const T00 = Date.now();
const say = (...a) => console.log(`[${((Date.now() - T00) / 1000).toFixed(0)}s]`, ...a);
await page.goto(url);
say('boot', url);
let booted = false;   // LA-AUDIT F1: a boot that never came is a failure, not a run from wherever the page stood
for (const until = Date.now() + BOOT_S * 1000; Date.now() < until;) {
  booted = await ev(() => !!(window.__mode && window.__mode() === 'exterior' && window.__streamIdle?.() && window.__pose)).catch(() => false);
  if (booted) break;
  await sleep(1000);
}
say('booted', booted, await ev(() => window.__mode?.()));
if (!booted) fail(`the world never booted (${BOOT_S} s)`);
await ev(async () => { window.__lfpFlash = (await import('/src/ui/damageFlash.js')).playerDamageFlash; });   // LA-AUDIT D: the HUD's flash, watched
await dismiss();
await waitFrames(20);
say('ready');
// the yaw the camera faces: read back off the pose door's own camera (the probe surface carries no yaw getter, so the
// yaw is kept here from the last pose this probe set)
await ev(() => { let yaw = 0; const pose = window.__pose; window.__pose = (x, y, z, yw, p) => { yaw = yw; return pose(x, y, z, yw, p); }; window.__lfpYaw = () => yaw; });

const all = [];
const doors = await ev(() => window.__doors());
const standAt = async (door, back = 1.5) => {
  const { pos, normal } = door;
  const yaw = Math.atan2(-normal[0], -normal[2]);
  await ev(([x, y, z, yw]) => window.__pose(x, y, z, yw, -0.05), [pos[0] + normal[0] * back, pos[1] - 1.2, pos[2] + normal[2] * back, yaw]);
  await waitFrames(3);
};

let streetTavern = true;
const tavernDoors = async () => JSON.parse(await ev(() => JSON.stringify(window.__doors().map((d, i) => ({ d, b: JSON.parse(window.__buildingAt(i) ?? 'null') })).filter((x) => x.b && x.b.buildingType === 15).map((x) => x.d))));

if (SCENES.includes('street')) {
  // the street before the first tavern: six metres out from its door, facing it (the facade, its lamps and windows)
  const t = await tavernDoors();
  say(`street: ${t.length} taverns`);
  streetTavern = t.length > 0;   // LA-AUDIT F1: the street is the one before a tavern, or the passes compare nothing
  if (t.length) await standAt(t[0], 6);
  say('street: standing', JSON.stringify(await ev(() => window.__player.pos)));
  await waitFrames(30);
  all.push(...await passes('street', { walkStep: 0.08 }));
}

if (SCENES.includes('tavern')) {
  const taverns = await tavernDoors();
  console.log(`taverns in reach: ${taverns.length}`);
  let inside = false;
  for (const d of taverns.slice(0, 5)) {
    await standAt(d);
    if (await ev(() => window.__enter())) { await waitFrames(30); inside = (await ev(() => window.__mode())) === 'interior'; }
    if (inside) break;
  }
  if (inside) {
    await dismiss();
    await waitFrames(30);
    const yaw = await ev(() => window.__lfpYaw());
    const p = await ev(() => window.__player.pos);
    await ev(([x, y, z, yw]) => window.__pose(x, y, z, yw, 0), [p[0], p[1], p[2], yaw]);
    await waitFrames(20);
    all.push(...await passes('tavern', { walkStep: 0.05, open: true }));
    await ev(() => window.__exit());
    await waitFrames(30);
  } else console.log('no tavern entered');
}

if (SCENES.includes('dungeon')) {
  const ent = (await ev(() => window.__doors())).filter((d) => d.type === 2);
  let inDg = false;
  for (const d of ent.slice(0, 2)) {
    await standAt(d, 1.0);
    if (await ev(() => window.__enter())) { for (let i = 0; i < 60 && !inDg; i++) { await sleep(1000); inDg = (await ev(() => window.__mode())) === 'dungeon'; } }
    if (inDg) break;
  }
  if (inDg) {
    await dismiss();
    await waitFrames(40);
    const yaw = await ev(() => window.__lfpYaw());
    const p = await ev(() => window.__player.pos);
    await ev(([x, y, z, yw]) => window.__pose(x, y, z, yw, 0), [p[0], p[1], p[2], yaw]);
    await waitFrames(20);
    all.push(...await passes('dungeon', { walkStep: 0.05, open: true }));
  } else console.log('no dungeon entered');
}

writeFileSync(`${OUT}/${LABEL}-summary.json`, JSON.stringify({ url, all, errors: errors.slice(0, 20) }, null, 1));
await browser.close();
await server.close();
// THE VERDICT (tools/lightFlickerVerdict.mjs, LA-AUDIT F1): every scene reached, in its own mode, every pass whole,
// lit and unthrown, the walks walked and the turns turned, the page quiet, and a camera standing still moved no more
// than STILL_MAX of the screen by 12 levels in any frame (a flame's sprite and a walker aside - DISC15's measure).
const bad = judge({ scenes: SCENES, all, errors, frames: FRAMES, stillMax: STILL_MAX, booted, streetTavern });
if (bad.length) fail(bad.join('\n'));
console.log(`OK - ${all.length} passes, every still frame under ${STILL_MAX}%`);
process.exit(0);
