// MAC-R4 (2026-09-17, Mac: "Hold to drag in the enhanced inventory
// sometimes doesn't work properly") - THE HOLD UNDER A REPAINT, MEASURED.
//
// A touch pointer implicitly captures the row it lands on. The pane
// repaints (`render()`) on things a hold cannot see coming - an archive
// icon landing, the doll settling, the arm rig rebuilding - and a
// repaint detaches the captured row, which raises `lostpointercapture`,
// which AUDIT INV2 read as "the pointer taken back" and ended the
// session. So a press that overlapped a repaint died with no ghost:
// the "sometimes". MAC-R4 gives the capture back at the press and stops
// reading its loss as an end. This probe is the fact under a real
// finger: a hold with a repaint 120ms into it still arms, still carries,
// and still releases; a flick still scrolls; and the long-press's
// context menu does not take the pointer.
//
// tools/invDragProbe.mjs is the shape (a real phone context, real touch
// points through CDP, vite's own server for the module graph).
//
//     node tools/macrHoldRepaintProbe.mjs
import { writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const ROOT = normalize(join(dirname(fileURLToPath(import.meta.url)), '..'));
const PAGE_NAME = 'macr-holdrepaint.tmp.html';
const TRIALS = Number(process.env.MACR_TRIALS ?? 8);

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>MAC-R4 probe</title>
<style>html,body{margin:0;height:100%;background:#12141a;overflow:hidden;overscroll-behavior:none}
#host{position:fixed;inset:0}</style></head><body><div id="host"></div>
<script type="module">
import { mountEnhancedInventory } from '/src/ui/enhancedInventory.js';
import { ITEM_TEMPLATES } from '/src/characters/paperdoll.js';
import { equipItem } from '/src/systems/equip.js';
const t = (n) => ITEM_TEMPLATES.find((x) => x.name === n);
const mk = (n, group = 'Weapons') => { const tp = t(n); return tp && {
  name: tp.name, templateIndex: tp.index, group, stackCount: 1,
  currentCondition: tp.hitPoints ?? 50, maxCondition: tp.hitPoints ?? 50 }; };
const e = { name: 'Aelwyn', career: { name: 'Spellsword' }, stats: { strength: 50, endurance: 48 }, items: [] };
for (let i = 0; i < 12; i++) for (const n of ['Longsword', 'Dagger', 'Broadsword', 'Battle Axe'])
  { const it = mk(n); if (it) e.items.push(it); }
const worn = mk('Cuirass', 'Armor'); e.items.push(worn); equipItem(e, worn);
e.goldPieces = 1287;
globalThis.__dropped = [];
const pane = mountEnhancedInventory(document.getElementById('host'), {
  entity: e, items: () => e.items, onExit: () => {}, dropItem: (it) => globalThis.__dropped.push(it),
});
globalThis.__ev = [];
for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture', 'gotpointercapture', 'contextmenu'])
  addEventListener(type, (ev) => globalThis.__ev.push(type), true);
const list = () => document.querySelector('.packlists');
globalThis.__probe = {
  reset() {
    globalThis.__ev.length = 0; globalThis.__dropped.length = 0;
    for (let i = 0; i < 4; i++) { const on = document.querySelector('.itemrow.on, .wornrow.on'); if (!on) break; on.click(); }
    const n = list(); if (n) n.scrollTop = 0;
  },
  repaint: () => { pane?.repaint?.(); return typeof pane?.repaint === 'function'; },
  ev: () => globalThis.__ev.join(','),
  ghost: () => !!document.querySelector('.dragghost'),
  dropped: () => globalThis.__dropped.length,
  top: () => list()?.scrollTop ?? -1,
  rows: () => document.querySelectorAll('.pack-dock .itemrow').length,
  tile() {
    const n = list(); if (!n) return null;
    const lr = n.getBoundingClientRect();
    for (const row of document.querySelectorAll('.pack-dock .itemrow')) {
      const r = row.getBoundingClientRect();
      const x = r.x + r.width / 2, y = r.y + r.height / 2;
      if (y > lr.top + 8 && y < lr.bottom - 8 && document.elementFromPoint(x, y)?.closest('.itemrow') === row) return { x, y };
    }
    return null;
  },
};
document.title = 'ready';
<\/script></body></html>`;

const fails = [];
const check = (name, ok, detail = '') => {
  if (!ok) fails.push(`${name}${detail ? ` - ${detail}` : ''}`);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

await writeFile(join(ROOT, `tools/${PAGE_NAME}`), PAGE);
// PROBE_PORT=<n> reuses a dev server already listening there (a container's
// file-watcher budget can refuse a second vite); otherwise one is made here,
// with its watcher off - the probe changes nothing it would need to see.
const vite = process.env.PROBE_PORT ? null : await createServer({ root: ROOT, server: { port: 0, host: '127.0.0.1', watch: null }, logLevel: 'error' });
if (vite) await vite.listen();
const port = vite ? vite.httpServer.address().port : Number(process.env.PROBE_PORT);
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
try {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 860 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (er) => errors.push(er.message));
  await page.goto(`http://127.0.0.1:${port}/tools/${PAGE_NAME}?nofonts`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!globalThis.__probe, null, { timeout: 30000 });
  const cdp = await ctx.newCDPSession(page);
  const send = (type, x, y) => cdp.send('Input.dispatchTouchEvent', {
    type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, radiusX: 14, radiusY: 14, force: 1, id: 1 }],
  });
  const P = (fn, ...a) => page.evaluate(fn, ...a);
  const sleep = (ms) => page.waitForTimeout(ms);
  const settle = async () => {
    for (let i = 0; i < 12; i++) {
      await P(() => globalThis.__probe.reset());
      await sleep(60);
      const t = await P(() => globalThis.__probe.tile());
      if (t && (await P(() => globalThis.__probe.top())) === 0) return t;
    }
    return null;
  };
  check('the pane exposes repaint()', await P(() => globalThis.__probe.repaint()));
  console.log(`   ${await P(() => globalThis.__probe.rows())} tiles`);

  // ── THE HOLD UNDER A REPAINT ─────────────────────────────────────
  let armed = 0, carried = 0, released = 0; const evs = [];
  for (let i = 0; i < TRIALS; i++) {
    const t = await settle();
    if (!t) { fails.push('no tile to press'); break; }
    await send('touchStart', t.x, t.y);
    await sleep(120);
    await P(() => globalThis.__probe.repaint());   // the row under the finger is detached and rebuilt
    await sleep(40);
    await P(() => globalThis.__probe.repaint());   // and again - two async landings in one hold
    await sleep(260);
    if (await P(() => globalThis.__probe.ghost())) armed++;
    for (let k = 1; k <= 6; k++) { await send('touchMove', t.x + k * 14, t.y - k * 10); await sleep(16); }
    if (await P(() => globalThis.__probe.ghost())) carried++;
    evs.push(await P(() => globalThis.__probe.ev()));
    await send('touchEnd', t.x + 84, t.y - 60);
    await sleep(80);
    if (!(await P(() => globalThis.__probe.ghost()))) released++;
  }
  console.log(`   hold with two repaints inside it: armed ${armed}/${TRIALS}, carried ${carried}/${TRIALS}, released ${released}/${TRIALS}`);
  console.log(`   events of the last trial: ${evs.at(-1)}`);
  check('a hold ARMS through a repaint', armed === TRIALS, `${armed}/${TRIALS}`);
  check('and CARRIES through it', carried === TRIALS, `${carried}/${TRIALS}`);
  check('and the release ends it', released === TRIALS, `${released}/${TRIALS}`);
  check('the session never held a capture to lose', !evs.some((s) => s.includes('lostpointercapture')), evs.at(-1));

  // ── THE LONG PRESS'S MENU ────────────────────────────────────────
  const t2 = await settle();
  if (t2) {
    await send('touchStart', t2.x, t2.y);
    await sleep(900);   // past Android's long-press
    const ghost = await P(() => globalThis.__probe.ghost());
    const ev = await P(() => globalThis.__probe.ev());
    await send('touchEnd', t2.x, t2.y);
    await sleep(80);
    check('a long press still holds the ghost past the context-menu time', ghost, ev);
    check('and no cancel took the pointer', !ev.includes('pointercancel'), ev);
  }

  // ── AND A FLICK STILL SCROLLS ────────────────────────────────────
  const ft = await settle();
  if (ft) {
    const before = await P(() => globalThis.__probe.top());
    await send('touchStart', ft.x, ft.y);
    let sawGhost = false;
    for (let i = 1; i <= 10; i++) { await sleep(10); await send('touchMove', ft.x, ft.y - i * 14); if (await P(() => globalThis.__probe.ghost())) sawGhost = true; }
    await send('touchEnd', ft.x, ft.y - 140);
    await sleep(160);
    const after = await P(() => globalThis.__probe.top());
    check('a flick SCROLLS the pack', after > before, `${before} -> ${after}`);
    check('and is never a drag', !sawGhost);
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
