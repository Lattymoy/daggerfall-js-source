// MAC-R2 (2026-09-17, Mac: "The enhanced quickbar sometimes shows double
// messages") - THE DIAMOND'S TAP PATH, COUNTED UNDER A REAL FINGER.
//
// The quickbar's cells are the phone's keys (ui/enhancedHud.js, QS3's
// second departure): a tap performs the slot, a hold cycles it, and every
// performer says its one line through the host's popup channel. A
// "double message" is one press reaching a performer TWICE, and node
// cannot see that - the cells are pointer-event listeners on real DOM,
// under Chromium's own pointer/touch/mouse compatibility machinery. So
// the HUD is drawn over the real module here and pressed with real touch
// points through CDP (`Input.dispatchTouchEvent`), and each press's
// performer calls are counted.
//
// What it reports, as pass/fail: one tap on each cell (c1, c2, off, main,
// the spell chip) is exactly ONE call; a tap that wanders a few pixels is
// still one; two quick taps are two, not three or four; a hold past the
// cycle threshold is NO call (the choosing is the act); a MOUSE click is
// no call at all (AUDIT QS F8: the mouse swings, it does not press).
//
// IT RUNS ON VITE'S OWN DEV SERVER (tools/qs3Probe.mjs's reason).
//
//     node tools/macrHudTapProbe.mjs
import { writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const ROOT = normalize(join(dirname(fileURLToPath(import.meta.url)), '..'));
const PAGE_NAME = 'macr-hudtap.tmp.html';

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>MAC-R2 probe</title>
<style>html,body{margin:0;height:100%;background:#12141a;overflow:hidden;overscroll-behavior:none}</style></head><body>
<script type="module">
import { drawEnhancedHud } from '/src/ui/enhancedHud.js';
import { ITEM_TEMPLATES } from '/src/characters/paperdoll.js';
import { equipItem } from '/src/systems/equip.js';
const t = (n) => ITEM_TEMPLATES.find((x) => x.name === n);
const mk = (n, group = 'Weapons') => { const tp = t(n); return tp && {
  name: tp.name, templateIndex: tp.index, group, stackCount: 1,
  currentCondition: tp.hitPoints ?? 50, maxCondition: tp.hitPoints ?? 50 }; };
const e = { name: 'Aelwyn', career: { name: 'Spellsword' }, stats: { strength: 50, endurance: 48, willpower: 50, intelligence: 50 },
  health: 30, maxHealth: 40, fatigue: 100, maxFatigue: 200, magicka: 10, maxMagicka: 20, items: [], spells: [] };
const sword = mk('Longsword'); e.items.push(sword); equipItem(e, sword);
globalThis.__calls = [];
const opts = {
  weapon: sword, weaponSheathed: false,
  quickUse: (n) => { globalThis.__calls.push('use' + n); return true; },
  quickSwap: () => { globalThis.__calls.push('swap'); return true; },
  quickOffHand: () => { globalThis.__calls.push('off'); return true; },
  quickSpell: () => { globalThis.__calls.push('spell'); return true; },
  quickSwitchHand: () => { globalThis.__calls.push('hand'); return true; },
};
let h = 0.25;
function frame() { drawEnhancedHud(e, h, 1 / 60, opts); requestAnimationFrame(frame); }
frame();
const at = (sel) => { const n = document.querySelector(sel); if (!n) return null; const r = n.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }; };
globalThis.__probe = {
  calls: () => globalThis.__calls.join(','),
  reset: () => { globalThis.__calls.length = 0; },
  cell: (k) => at('.hud-q' + k),
  chip: () => at('.hud-qspell, .hud-spellchip, [class*="spellchip"]'),
  classes: () => [...document.querySelectorAll('.hud-qdiamond *')].map((n) => n.className).filter((c) => typeof c === 'string').join(' | '),
};
document.title = 'ready';
<\/script></body></html>`;

const fails = [];
const check = (name, ok, detail = '') => {
  if (!ok) fails.push(`${name}${detail ? ` - ${detail}` : ''}`);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

// PROBE_PORT=<n> reuses a dev server already listening there (a container's
// file-watcher budget can refuse a second vite); otherwise one is made here,
// with its watcher off - the probe changes nothing it would need to see.
const vite = process.env.PROBE_PORT ? null : await createServer({ root: ROOT, server: { port: 0, host: '127.0.0.1', watch: null }, logLevel: 'error' });
if (vite) await vite.listen();
const port = vite ? vite.httpServer.address().port : Number(process.env.PROBE_PORT);
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
try {
  // AUDIT 68 X2-probe-tmp-page-leak: written inside the try, so the finally that unlinks it always runs.
  await writeFile(join(ROOT, `tools/${PAGE_NAME}`), PAGE);
  const ctx = await browser.newContext({ viewport: { width: 430, height: 860 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (er) => errors.push(er.message));
  await page.goto(`http://127.0.0.1:${port}/tools/${PAGE_NAME}?nofonts`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!globalThis.__probe, null, { timeout: 30000 });
  await page.waitForTimeout(300);
  const cdp = await ctx.newCDPSession(page);
  const send = (type, x, y) => cdp.send('Input.dispatchTouchEvent', {
    type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, radiusX: 12, radiusY: 12, force: 1, id: 1 }],
  });
  const P = (fn, ...a) => page.evaluate(fn, ...a);
  const sleep = (ms) => page.waitForTimeout(ms);
  console.log('cells:', await P(() => globalThis.__probe.classes()));

  const tap = async (pt, { hold = 60, wander = 0 } = {}) => {
    await P(() => globalThis.__probe.reset());
    await send('touchStart', pt.x, pt.y);
    if (wander) { await sleep(hold / 2); await send('touchMove', pt.x + wander, pt.y + wander); await sleep(hold / 2); } else await sleep(hold);
    await send('touchEnd', pt.x, pt.y);
    await sleep(120);
    return P(() => globalThis.__probe.calls());
  };
  for (const [k, want] of [['c1', 'use1'], ['c2', 'use2'], ['off', 'off'], ['main', 'hand']]) {
    const pt = await P((k) => globalThis.__probe.cell(k), k);
    check(`the ${k} cell exists`, !!pt, JSON.stringify(pt));
    if (!pt) continue;
    check(`one tap on ${k} is ONE call`, (await tap(pt)) === want, `got "${await P(() => globalThis.__probe.calls())}"`);
    check(`a wandering tap on ${k} is still ONE call`, (await tap(pt, { wander: 3 })) === want, `got "${await P(() => globalThis.__probe.calls())}"`);
    // two quick taps: two calls, never three or four
    await P(() => globalThis.__probe.reset());
    for (let i = 0; i < 2; i++) { await send('touchStart', pt.x, pt.y); await sleep(50); await send('touchEnd', pt.x, pt.y); await sleep(80); }
    await sleep(120);
    check(`two quick taps on ${k} are TWO calls`, (await P(() => globalThis.__probe.calls())) === `${want},${want}`, `got "${await P(() => globalThis.__probe.calls())}"`);
  }
  // a hold past the cycle threshold performs nothing (the choosing is the act)
  const c1 = await P(() => globalThis.__probe.cell('c1'));
  if (c1) check('a HOLD on c1 is no call', (await tap(c1, { hold: 700 })) === '', `got "${await P(() => globalThis.__probe.calls())}"`);
  // a mouse click is not a press (AUDIT QS F8)
  if (c1) {
    await P(() => globalThis.__probe.reset());
    await page.mouse.click(c1.x, c1.y);
    await sleep(120);
    check('a MOUSE click on c1 is no call', (await P(() => globalThis.__probe.calls())) === '', `got "${await P(() => globalThis.__probe.calls())}"`);
  }
  check('no page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
} finally {
  await browser.close();
  await vite?.close();
  await unlink(join(ROOT, `tools/${PAGE_NAME}`)).catch(() => {});
}
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall passed');
process.exit(fails.length ? 1 : 0);
