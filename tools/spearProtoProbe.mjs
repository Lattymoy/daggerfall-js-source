// THE SPEAR LAB, IN A REAL BROWSER, WITH NO ARENA2 - tools/pistolProtoProbe.mjs's method for the third lab
// (bible/05-Combat/Spear-Lab.md).
//
// What a source sweep cannot claim about spear-proto.html: the strip loads and every strike frame is drawn in the page,
// the spear sits where FPSWeapon's rect puts the owner's rest frame, each strike plays every one of its frames in order
// on the game's machine and lands its hit on the table's frame, the blow takes the swing law's time, a drag in each
// direction plays the strike the game's gesture law picks, and the thrust's point lands on the crosshair.
//
//     node tools/spearProtoProbe.mjs [shots-dir]      (npm run spearproto)
//
// Writes each strike's hit frame and the rest pose as PNGs to a scratch dir, never public/ (AUDIT 21's law).
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { SPEAR_STRIKES, SPEAR_NUM_FRAMES, spearFrameSeconds } from '../src/tools/spearLab.js';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const shots = process.argv[2] || 'scratch/spear-proto';
await mkdir(shots, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

const server = await createServer({ server: { port: 5198, strictPort: true }, logLevel: 'warn' });
await server.listen();
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});   // a browser of the machine's own, as auraProbe.mjs takes one
const VW = 1280, VH = 800;
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`${m.text()} ${m.location()?.url ?? ''}`); });

const set = (vals) => page.evaluate((v) => {
  for (const [id, value] of Object.entries(v)) {
    const el = document.getElementById(id);
    if (!el) throw new Error(`no control ${id}`);
    if (el.type === 'checkbox') el.checked = !!value; else el.value = String(value);
    el.dispatchEvent(new Event('input'));
  }
}, vals);
const read = () => page.evaluate(() => globalThis.__spearLab);
const idle = () => page.waitForFunction(() => globalThis.__spearLab?.state === 'Idle', null, { timeout: 20000 });
const logLength = async () => (await read()).log.length;
/** The page's log from entry `from` on, once the strike it started has ended. */
const strikeLog = async (from) => {
  await page.waitForFunction((n) => {
    const s = globalThis.__spearLab;
    return s.state === 'Idle' && s.log.slice(n).some((e) => e.state && e.state !== 'Idle');
  }, from, { timeout: 30000 });
  return (await read()).log.slice(from);
};
const STILL = { modBob: false, modInertia: false, walk: false, loop: false, slow: 1, sfxOn: false };
const near = (a, b, eps = 1.5) => Math.abs(a - b) <= eps;

await page.goto('http://127.0.0.1:5198/spear-proto.html', { waitUntil: 'load' });
await page.waitForFunction(() => globalThis.__spearLab?.ready, null, { timeout: 60000 });
await set(STILL);
await page.keyboard.press('Tab');   // the panels come off for the shots
await idle();

// ── THE ART AND THE REST POSE ──
let s = await read();
const want = Object.fromEntries(Object.entries(SPEAR_STRIKES).map(([k, v]) => [k, v.frames.length]));
check('every strike frame was drawn in the page', JSON.stringify(s.frames) === JSON.stringify(want), `${JSON.stringify(s.frames)} in ${s.composeMs} ms`);
check('native size: the rest frame is its art width on the 320-wide surface', near(s.anchorRect.w, 149 * VW / 320), `${s.anchorRect.w.toFixed(1)}px`);
check('the owner\'s canvas corner on the view\'s corner', near(s.anchorRect.x + s.anchorRect.w, VW) && near(s.anchorRect.y + s.anchorRect.h, VH),
  `right ${(s.anchorRect.x + s.anchorRect.w).toFixed(1)}, bottom ${(s.anchorRect.y + s.anchorRect.h).toFixed(1)}`);
await page.screenshot({ path: `${shots}/rest.png` });

// ── EACH STRIKE ON THE GAME'S MACHINE ──
const KEY = { left: '1', right: '2', thrust: '3' };
const STATE = { left: 'StrikeLeft', right: 'StrikeRight', thrust: 'StrikeUp' };
for (const name of ['left', 'right', 'thrust']) {
  await set({ slow: 0.25 });   // four times slower, so every frame is drawn at least once
  await idle();
  const from = await logLength();
  await page.keyboard.press(KEY[name]);
  const log = await strikeLog(from);
  const shown = log.filter((e) => e.state === STATE[name]).map((e) => e.frame);
  const n = SPEAR_NUM_FRAMES[STATE[name]];
  check(`${name}: every one of its ${n} frames reached the screen, in order`,
    JSON.stringify(shown) === JSON.stringify(Array.from({ length: n }, (_, k) => k)), shown.join(','));
  const hit = log.find((e) => e.hit);
  check(`${name}: the blow lands on the table's hit frame`, hit?.frame === SPEAR_STRIKES[name].hit, `hit on frame ${hit?.frame}`);
  const start = log.find((e) => e.state === STATE[name]), end = log.find((e) => e.state === 'Idle' && e.t > start.t);
  const took = (end.t - start.t) / 1000 * 0.25, law = spearFrameSeconds(STATE[name]) * n;
  check(`${name}: the blow takes the swing law's time (five classic frames)`, Math.abs(took - law) < 0.06, `${took.toFixed(3)} s, the law ${law.toFixed(3)} s`);
  const atHit = log.filter((e) => e.state === STATE[name] && e.frame === SPEAR_STRIKES[name].hit)[0];
  if (name === 'thrust') {
    check('thrust: the point lands on the crosshair', Math.hypot(atHit.tipPx[0] - VW / 2, atHit.tipPx[1] - VH / 2) < 24,
      `${atHit.tipPx.map((v) => v.toFixed(0)).join(', ')} against ${VW / 2}, ${VH / 2}`);
  } else {
    const xs = log.filter((e) => e.state === STATE[name]).map((e) => e.tipPx[0]);
    const across = name === 'left' ? xs[2] > VW / 2 && xs[xs.length - 5] < VW / 2 : xs[2] < VW / 2 && xs[xs.length - 5] > VW / 2;
    check(`${name}: the point sweeps across the aim the way the drag went`, across, `${xs[2].toFixed(0)} -> ${xs[xs.length - 5].toFixed(0)}`);
  }
  await set({ slow: 0.05 });
  await page.keyboard.press(KEY[name]);
  await page.waitForFunction((args) => globalThis.__spearLab.state === args.st && globalThis.__spearLab.frame === args.hit, { st: STATE[name], hit: SPEAR_STRIKES[name].hit }, { timeout: 30000 });
  await page.screenshot({ path: `${shots}/${name}-hit.png` });
  await set({ slow: 1 });
  await idle();
}

// ── THE DRAG: the game's gesture law picks the strike ──
await set({ slow: 1 });
const drag = async (dx, dy) => {
  await idle();
  const from = await logLength();
  await page.mouse.move(VW / 2, VH / 2);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(VW / 2 + dx * i / 8, VH / 2 + dy * i / 8);
  await page.mouse.up();
  return (await strikeLog(from)).find((e) => e.state && e.state !== 'Idle')?.state;
};
for (const [dx, dy, st] of [[-240, 0, 'StrikeLeft'], [240, 0, 'StrikeRight'], [0, -240, 'StrikeUp'], [0, 240, 'StrikeDown'], [-200, 160, 'StrikeDownLeft']]) {
  check(`a drag (${dx}, ${dy}) plays ${st}`, (await drag(dx, dy)) === st);
}

// ── A CLICK ATTACK rolls a direction ──
await idle();
let from = await logLength();
await page.keyboard.press('Space');
const clicked = (await strikeLog(from)).find((e) => e.state && e.state !== 'Idle')?.state;
check('Space is a click attack: one of the six strikes', ['StrikeUp', 'StrikeLeft', 'StrikeRight', 'StrikeDownLeft', 'StrikeDown', 'StrikeDownRight'].includes(clicked), clicked);

// ── THE SCRUB steps a strike's frames while idle ──
await idle();
await set({ strike: 'thrust' });
from = await logLength();
for (let i = 0; i < 3; i++) {   // a frame drawn between presses: three in one frame would log only the last
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction((k) => globalThis.__spearLab.log.at(-1).scrub === k, i);
}
const scrubbed = (await read()).log.slice(from).map((e) => e.scrub);
check('the arrows scrub the chosen strike\'s frames', JSON.stringify(scrubbed.slice(-3)) === '[0,1,2]', scrubbed.join(','));
await page.keyboard.press('Escape');

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
await server.close();
console.log(`\nshots in ${shots}/`);
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} ok`);
process.exit(failed ? 1 : 0);
