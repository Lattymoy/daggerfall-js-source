// PISTOL-PORT (2026-10-22; bible/05-Combat/Dwarven-Pistolet.md "PISTOL-PORT"; the owner: "I want the prototype itself
// implemented just like we did with thunderlock"): THE PROTOTYPE AND THE GAME, MEASURED ON ONE CLOCK - FIELD-GUN10's
// measurement, kept.
//
// 1. THE NUMBERS. pistol-proto.html in Chromium, its performance.now and requestAnimationFrame the probe's own (one frame
//    a call, at 60 Hz, the page computing its dt as it always does), at 1280x800 and dpr 1; the script's pulls and walks
//    dispatched as the page's own events. Then the GAME's real rig (createWeaponRig in Node, test/combat/weapon/
//    pistolRigHarness.js's stubs) fed EVERY dt the page used, from its first frame, the same pulls through the host's
//    attack door and the same walk through the camera. Every drawn hand is compared: its rect, its picture, the order.
//    Before the port this script measured 51 px apart; it must be nothing now. A pair, then one pistol.
// 2. THE PICTURES. The same rig drawn by the REAL renderer (WebGL) on a page of its own beside the prototype's page, both
//    on the same clock, shot at the same frames - the prototype left, the game right - so the eye can judge it too.
//
//     node tools/pistolPortProbe.mjs [shots-dir]
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { writeFile, unlink } from 'node:fs/promises';
import { readPng, writePng } from './pngIO.mjs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const OUT = process.argv[2] || 'scratch/pistol-port';
mkdirSync(OUT, { recursive: true });
const W = 1280, H = 800, WARM = 60;
const results = [];
const check = (name, ok, detail = '') => { results.push(!!ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); };
/** The script: frame -> what happens before it steps - rest, a shot and the other pistol pulled MID-SHOT six frames on
 *  (both firing at once), both reloads, a walk with a shot in it, a stop; then (AUDIT PISTOL-PORT B1 D6) a strafe, a turn
 *  of the head and a jump, the page's own keys and mouse. (Until the audit the second pull came 40 frames on - after the
 *  first shot's frames - and no frame of the run had both pistols firing.) */
const SCRIPT = new Map([[30, ['pull']], [36, ['pull']], [260, ['walk']], [330, ['pull']], [410, ['stop']],
  [420, ['strafe']], [440, ['stop']], [446, ['turn']], [447, ['turn']], [448, ['turn']], [449, ['turn']], [450, ['turn']], [455, ['jump']]]);
const FRAMES = 490;
const TURN_PX = 12;   // a turn: the mouse moved this far in a frame
/** The fixed clock, laid before either page's scripts run. */
const CLOCK = () => {
  let T = 0; const q = [];
  performance.now = () => T;
  window.requestAnimationFrame = (cb) => { q.push(cb); return q.length; };
  window.__dts = [];
  window.__step = () => { const was = T; T += 1000 / 60; window.__dts.push((T - was) / 1000); const cbs = q.splice(0); for (const cb of cbs) cb(T); };
  HTMLCanvasElement.prototype.requestPointerLock = function () {};
  // the mouse held: the page reads its look only while the canvas has the pointer
  Object.defineProperty(Document.prototype, 'pointerLockElement', { get: () => document.getElementById('c') });
};

// AUDIT 68 X2 / U60: the rig's page beside the probe (tools/, ignored as every *.tmp.html is), written inside the try
// whose finally unlinks it, and driven at its own path - never the site root
const RIG_PAGE_NAME = 'pistolport.tmp.html';
const RIG_PAGE = `tools/${RIG_PAGE_NAME}`;
const RIG_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>pistol port probe</title>
<style>html,body{margin:0;height:100%;overflow:hidden;background:#000}canvas{display:block;width:100vw;height:100vh}</style></head><body><canvas id="c"></canvas>
<script type="module">
import { Renderer } from '/src/render/renderer.js';
import { perspective, lookAt } from '/src/world/mat4.js';
import { createWeaponRig } from '/src/combat/weapon/weaponRig.js';
import { createPistolet } from '/src/systems/pistolet.js';
import { createPellets } from '/src/systems/thunderlock.js';
import { equipItem } from '/src/systems/equip.js';
import { walkSpeed } from '/src/player/motor.js';
const canvas = document.getElementById('c');
canvas.width = innerWidth; canvas.height = innerHeight;
const renderer = new Renderer(canvas);
const audio = { playOneShot() {}, registerSound: async () => true, play() {}, stop() {} };
const entity = { isPlayer: true, name: 'Probe', level: 10, career: { name: 'Archer' },
  stats: { strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 },
  skills: new Array(35).fill(50), health: 100, maxHealth: 100, fatigue: 100, maxFatigue: 100, magicka: 10, maxMagicka: 10,
  items: [], spells: [], activeEffects: [], equipCountdown: 0 };
// AUDIT PISTOL-PORT B8: a host's camera, standing - with none the rig reads a walk at speed ratio 1, and its picture bobbed
// beside a prototype standing still
const rig = createWeaponRig({ renderer, canvas, fetchBytes: null, palette: null, audio, entity,
  camera: () => ({ pos: [0, 1.6, 0], yaw: 0, pitch: 0, climbing: false, move: { grounded: true, running: false, standing: true, speedField: walkSpeed(50) } }) });
globalThis.__wear = (kind) => {
  const items = kind === 'pair' ? [createPistolet(), createPistolet()] : [createPistolet()];
  for (const it of items) entity.items.push(it);
  entity.items.push(createPellets(30));
  for (const it of items) equipItem(entity, it);
  entity.equipCountdown = 0;
  rig.playerWeapon.sheathed = false;
};
globalThis.__fire = () => rig.clickAttack();
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  renderer.setClearColor([0.16, 0.14, 0.12, 1]);
  renderer.beginFrame(perspective(Math.PI / 3, canvas.width / canvas.height, 0.1, 100), lookAt([0, 1.6, 0], [0, 1.6, 1], [0, 1, 0]), [0.3, -1, 0.2]);
  rig.frame(dt, {});
  rig.draw({});
  renderer.resolveFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
globalThis.__ready = true;
</script></body></html>`;

const vite = await createServer({ server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await vite.listen();
const base = `http://127.0.0.1:${vite.httpServer.address().port}`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
const open = async (url) => {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(CLOCK);
  await page.goto(url, { waitUntil: 'load', timeout: 600000 });
  return page;
};
const event = (page, e) => page.evaluate((what) => {
  if (what === 'pull') { document.getElementById('c').dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true })); dispatchEvent(new MouseEvent('mouseup')); }
  if (what === 'walk') dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
  if (what === 'stop') dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS' }));
  if (what === 'strafe') dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
  if (what === 'jump') dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ' }));
  if (what.turn) dispatchEvent(new MouseEvent('mousemove', { movementX: what.turn }));
}, e === 'turn' ? { turn: TURN_PX } : e);

/** The prototype's run: its dts from the first frame, and each frame's hands. */
async function labRun(kind) {
  const page = await open(`${base}/pistol-proto.html`);
  await page.waitForFunction(() => { window.__step(); return globalThis.__pistolLab?.ready; }, null, { timeout: 60000, polling: 100 });
  if (kind === 'single') await page.evaluate(() => dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1' })));
  for (let i = 0; i < WARM; i++) await page.evaluate(() => window.__step());
  const warm = await page.evaluate(() => window.__dts.slice());
  const rows = [];
  for (let f = 0; f < FRAMES; f++) {
    for (const e of SCRIPT.get(f) ?? []) await event(page, e);
    rows.push(await page.evaluate(() => {
      window.__step();
      const L = globalThis.__pistolLab;
      const hand = (h) => (L[h].drawn && L[h].rect ? { h, frame: L[h].frame, rect: L[h].rect } : null);
      return { hands: L.order.map(hand).filter(Boolean), dt: window.__dts.at(-1) };
    }));
  }
  await page.context().close();
  return { warm, rows };
}
/** The game's run, on the prototype's own dts. */
async function gameRun(kind, lab) {
  const { pistolRig } = await import('../test/combat/weapon/pistolRigHarness.js');
  const { createPistolet } = await import('../src/systems/pistolet.js');
  const { LookFilter } = await import('../src/player/lookFilter.js');
  const { lookScale } = await import('../src/ui/lookSettings.js');
  const { pistolJumpClimb } = await import('../src/tools/pistolLab.js');
  const { r, frame, walk } = await pistolRig({ right: createPistolet(), left: kind === 'pair' ? createPistolet() : null, size: [W, H], dts: lab.warm });
  const head = new LookFilter();   // the host's mouse look, latched for the rig as the camera's radians
  const rows = [];
  let jumpT = -1;
  for (let f = 0; f < FRAMES; f++) {
    for (const e of SCRIPT.get(f) ?? []) {
      if (e === 'pull') r.clickAttack();
      if (e === 'walk') walk.on = true;
      if (e === 'strafe') walk.strafe = 1;
      if (e === 'stop') { walk.on = false; walk.strafe = 0; }
      if (e === 'jump') jumpT = 0;
      if (e === 'turn') head.add(TURN_PX * lookScale(), 0);
    }
    walk.vertical = jumpT >= 0 ? pistolJumpClimb(jumpT) : null;
    if (walk.vertical === null) jumpT = -1; else jumpT += lab.rows[f].dt;
    const q = await frame(lab.rows[f].dt);
    rows.push(q.map((x) => ({ h: x.uv ? 'L' : 'R', frame: Number(String(x.tex).split(':').pop()), rect: x.rect })));
  }
  return rows;
}

try {
  // ── 1. the numbers ──
  for (const kind of ['pair', 'single']) {
    const lab = await labRun(kind);
    const game = await gameRun(kind, lab);
    let worst = 0, at = -1, pictures = 0, fired = 0;
    for (let f = 0; f < FRAMES; f++) {
      const want = lab.rows[f].hands, got = game[f];
      if (want.map((x) => `${x.h}${x.frame}`).join() !== got.map((x) => `${x.h}${x.frame}`).join()) pictures++;
      if (want.some((x) => x.frame > 0)) fired++;
      for (const w of want) {   // AUDIT PISTOL-PORT D6: hand by hand, by NAME - by index a swapped order read as 1,000 px
        const g = got.find((x) => x.h === w.h);
        if (!g) continue;
        for (const k of ['x', 'y', 'w', 'h']) { const d = Math.abs(g.rect[k] - w.rect[k]); if (d > worst) { worst = d; at = f; } }
      }
    }
    check(`${kind}: the script fired on the prototype`, fired > 10, `${fired} frames with a shot drawn`);
    check(`${kind}: every frame the same hands, pictures and order`, pictures === 0, `${pictures} of ${FRAMES} differ`);
    check(`${kind}: every hand at the prototype's rect`, worst < 1e-6, `worst ${worst.toExponential(2)} px${at >= 0 ? ` (frame ${at})` : ''}`);
  }

  // ── 2. the pictures ──
  await writeFile(RIG_PAGE, RIG_HTML);
  const SHOTS = { rest: 25, 'right-flash': 35, 'flurry-both-firing': 44, 'both-reloading': 100 };
  const lab = await open(`${base}/pistol-proto.html`);
  const game = await open(`${base}/tools/${RIG_PAGE_NAME}`);
  await game.waitForFunction(() => globalThis.__ready, null, { timeout: 600000 });
  await game.evaluate(() => globalThis.__wear('pair'));
  // both pages wait for their art on the network, not the clock, then step the same frames
  await lab.waitForTimeout(4000);
  for (let i = 0; i < 200; i++) { await lab.evaluate(() => window.__step()); await game.evaluate(() => window.__step()); }
  const shots = [];
  for (let f = 0; f <= Math.max(...Object.values(SHOTS)); f++) {
    for (const e of SCRIPT.get(f) ?? []) { await event(lab, e); if (e === 'pull') await game.evaluate(() => globalThis.__fire()); }
    await lab.evaluate(() => window.__step()); await game.evaluate(() => window.__step());
    const name = Object.keys(SHOTS).find((k) => SHOTS[k] === f);
    if (!name) continue;
    const a = readPng(await lab.screenshot()), b = readPng(await game.screenshot());
    const side = { width: W * 2, height: H, data: new Uint8ClampedArray(W * 2 * H * 4) };
    for (let y = 0; y < H; y++) {
      side.data.set(a.data.subarray(y * W * 4, (y + 1) * W * 4), y * W * 2 * 4);
      side.data.set(b.data.subarray(y * W * 4, (y + 1) * W * 4), (y * W * 2 + W) * 4);
    }
    writeFileSync(`${OUT}/${name}.png`, writePng(side));
    shots.push(name);
  }
  check('the pictures: the prototype left, the game right', shots.length === Object.keys(SHOTS).length, shots.join(', '));
  check('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
} finally {
  await browser.close(); await vite.close();
  await unlink(RIG_PAGE).catch(() => {});
}
const ok = results.every(Boolean);
console.log(`\n${results.filter(Boolean).length}/${results.length} ${ok ? 'ok' : 'FAILED'} - shots in ${OUT}/`);
process.exit(ok ? 0 : 1);
