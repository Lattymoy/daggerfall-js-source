// TRADE-VIRT (2026-10-20, a player's audit of the trading windows, handed on by the owner: "Someone also sent this") -
// THE TRADE COUNTERS, DRIVEN IN A BROWSER AND TIMED, OVER THE PLAYER'S OWN PICTURES.
//
// The enhanced shop counter (ui/enhanced/enhancedTrade.js) and the player-to-player window (ui/enhanced/
// enhancedPlayerTrade.js) mounted as the game mounts them, over a pack of N real items (every weapon in every metal,
// every armour piece in every material - all on the first page, Weapons & Armor), a shelf of 0.65 N beside it at a
// counter that sells, and the real TradeSession over the real pack adapter (systems/tradePack.js) for a trade between
// players. The pictures are the freeware ARENA2's own (ARENA2_PATH, default /home/claude/dfdata/arena2), served to the
// page by intercepting its fetches. For each window and size, in a fresh page (the pictures cold):
//   - the open, to the frame, and to SETTLED (every row's picture in), with the full repaints counted (a MutationObserver
//     on the host: every new `.trade-shell` is one) and the long tasks summed;
//   - a warm open, to the frame;
//   - seven single clicks down the pack's list (each a preview), each to the frame, and that the strip shows the piece;
//   - a double click that moves a piece (an offer, a sale staged), to the frame, and that it moved;
//   - where the rows carry their piece (`_tradeItem`), the list at five depths: every drawn row at its piece's own place
//     in the whole list, none in view missing.
// The timings are this machine's Chromium, said as such; run it on a tree without the change for the before.
//
//     ARENA2_PATH=... node tools/tradePerfProbe.mjs            SIZES=30,100,300,700,1000  WINDOWS=sell,buy,p2p  OUT=<file>
//     REPAINTS=<k>: the window repainted k times, each timed;  PROFILE=<dir>: the clicks (and the repaints) under a CPU
//     profile, a file a run (<window>-<n>.cpuprofile)
import { writeFile, unlink, readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const ROOT = process.env.TREE || normalize(join(dirname(fileURLToPath(import.meta.url)), '..'));   // TREE: another worktree, the before
const ARENA2 = process.env.ARENA2_PATH || '/home/claude/dfdata/arena2';
const PAGE_NAME = 'tradeperf.tmp.html';
const SIZES = (process.env.SIZES ?? '30,100,300,700,1000').split(',').map(Number);
const WINDOWS = (process.env.WINDOWS ?? 'sell,buy,p2p').split(',');
const SETTLE_S = Number(process.env.SETTLE_S ?? 180);
const REPAINTS = Number(process.env.REPAINTS || 0);   // a count: the window repainted that many times, each timed
const PROFILE = process.env.PROFILE || null;   // a directory: the clicks' (and the repaints') CPU profile a run, <window>-<n>.cpuprofile

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>TRADE-VIRT probe</title>
<style>html,body{margin:0;height:100%;overflow:hidden;background:#333}</style></head><body>
<script type="module">
import { createWeapon } from '/src/combat/enemyEquipment.js';
import { setItemFields, mintCondition } from '/src/systems/item/itemTemplates.js';
import { ARMOR_MATERIAL } from '/src/systems/armorMaterials.js';
import { mountEnhancedTrade } from '/src/ui/enhanced/enhancedTrade.js';
import { mountEnhancedPlayerTrade } from '/src/ui/enhanced/enhancedPlayerTrade.js';
import { TradeSession } from '/src/net/tradeSession.js';
import { createTradePack } from '/src/systems/tradePack.js';

// _mods.weightMult: the buyer's allowance past any pack laid here (a thousand pieces of armour weigh tonnes, and a
// strength stops at 100) - the buy window's move is a piece taken, never "You cannot carry any more stuff"
const e = { isPlayer: true, name: 'Aelwyn', career: { name: 'Spellsword' }, level: 12, goldPieces: 5000, _mods: { weightMult: 1000 },
  stats: { strength: 90, endurance: 90, willpower: 50, intelligence: 50, agility: 50, speed: 50, personality: 50, luck: 50 },
  skills: new Array(35).fill(40), health: 60, maxHealth: 100, fatigue: 150, maxFatigue: 200, magicka: 14, maxMagicka: 20,
  items: [], spells: [], activeEffects: [], career2: null };
// every weapon in every metal and every armour piece in every material: the counter's first page holds them all
const kinds = [];
for (let t = 113; t <= 131; t++) for (let m = 0; m <= 9; m++) kinds.push(() => createWeapon(t, m));
for (let t = 102; t <= 111; t++) for (const m of Object.values(ARMOR_MATERIAL)) kinds.push(() => mintCondition(setItemFields({ group: 'Armor', templateIndex: t, material: m, flags: 0 })));
const pile = (n, salt = 0) => Array.from({ length: n }, (_, i) => kinds[(i * 7 + salt) % kinds.length]());
globalThis.__kinds = kinds.length;

let view = null, shelf = [], session = null, host = null, shells = 0, observer = null;
const frame = () => new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0)));
const close = () => { view?.unmount(); view = null; observer?.disconnect(); host?.remove(); host = null; document.querySelectorAll('.inv-tip').forEach((n) => n.remove()); };
globalThis.__close = close;
/** Mount a window over n pieces; the time to its rows, its layout and its frame. */
globalThis.__open = async (n, which) => {
  close();
  e.items = pile(n);
  shelf = which === 'buy' ? pile(Math.ceil(n * 0.65), 3) : [];
  host = document.createElement('div');
  host.id = 'enhanced-trade';
  host.style.cssText = 'position:fixed;inset:0;z-index:13;overflow:hidden';
  document.body.append(host);
  shells = 0;
  observer = new MutationObserver((ms) => { for (const m of ms) for (const a of m.addedNodes) if (a.classList?.contains('trade-shell')) shells++; });
  observer.observe(host, { childList: true });
  const t0 = performance.now();
  if (which === 'p2p') {
    session = new TradeSession({ sid: 'probe00001', me: 'peerAAAA', peer: 'peerBBBB', peerName: 'Brenna', pack: createTradePack(e), send: () => true, near: () => true });
    view = mountEnhancedPlayerTrade(host, { session, deps: { items: () => e.items, entity: e, gold: () => e.goldPieces, onExit: () => {} } });
  } else {
    view = mountEnhancedTrade(host, { mode: which === 'buy' ? 'Buy' : 'Sell', shopName: 'The Probe', entity: e, shelfItems: () => shelf, packItems: () => e.items,
      accepts: () => true, enchanted: () => false, isEquipped: () => false, gold: () => e.goldPieces,
      priceCtx: () => ({ quality: 10, priceAdjustment: 1000, skills: { mercantile: 50, personality: 50 } }), onExit: () => {} });
  }
  const built = performance.now() - t0;
  document.body.offsetHeight;
  const laid = performance.now() - t0;
  await frame();
  return { built, laid, framed: performance.now() - t0 };
};
const packList = () => host?.querySelector('.packcol .remotelist');
const packRows = () => [...(packList()?.querySelectorAll('.itemrow') ?? [])];
const counts = () => [...host.querySelectorAll('.packcol')].map((c) => c.querySelectorAll('.itemrow').length);
globalThis.__state = () => {
  if (!host) return null;
  const rows = [...host.querySelectorAll('.itemrow')];
  return { rows: rows.length, perCol: counts(), initials: rows.filter((r) => !r.querySelector('.tile.has-icon')).length, shells, nodes: host.getElementsByTagName('*').length };
};
/** A pack row a share down the list, as drawn: the first whose top is below the list's top plus a margin. */
const rowAt = async (frac) => {
  const l = packList(), s = l.closest('.packcol') ?? l;
  const scroller = [l, s].find((x) => x.scrollHeight > x.clientHeight + 1) ?? l;
  scroller.scrollTop = Math.round((scroller.scrollHeight - scroller.clientHeight) * frac);
  await frame(); await frame();
  const top = scroller.getBoundingClientRect().top;
  return packRows().find((r) => r.getBoundingClientRect().top > top + 20) ?? packRows()[0];
};
const nameOf = (r) => r?.querySelector('.itemname span')?.textContent ?? '';
/** Seven single clicks down the list, each to the frame: the strip names the piece clicked. */
globalThis.__selects = async () => {
  const out = [];
  let t = 1000;
  for (let i = 0; i < 7; i++) {
    const r = await rowAt(0.2 + i * 0.1);
    const name = nameOf(r);
    t += 1000;
    const t0 = performance.now();
    r.onclick({ timeStamp: t });
    const clicked = performance.now() - t0;
    await frame();
    const framed = performance.now() - t0;
    const strip = host.querySelector('.trade-detail h4')?.textContent ?? '';
    out.push({ clicked, framed, did: !!name && strip.startsWith(name) });
  }
  return out;
};
/** A double click on a row halfway down: it moves (a sale staged, an offer made - the pack's list one shorter; in the buy
 *  window a piece off the shelf into the basket - the shelf one shorter). */
globalThis.__move = async (which) => {
  const buy = which === 'buy';
  const shelf = () => [...(host?.querySelectorAll('.packremote .remotelist .itemrow') ?? [])];
  const rows = buy ? shelf : packRows;
  const r = buy ? shelf()[Math.floor(shelf().length / 2)] : await rowAt(0.5);
  const name = nameOf(r);
  const count = (sel) => Number(/\\d+/.exec(host.querySelector(sel)?.textContent ?? '')?.[0] ?? NaN);
  const head = buy ? '.packremote .meta' : '.trade-ownhead .meta';
  const before = which === 'p2p' ? session.mine.entries.length : count(head);
  const at = rows().indexOf(r);   // a repaint draws the same rows in the same order: the second click finds it here
  const t0 = performance.now();
  r.onclick({ timeStamp: 50000 });
  (rows()[at] ?? r).onclick({ timeStamp: 50100 });
  const clicked = performance.now() - t0;
  await frame();
  const framed = performance.now() - t0;
  const did = which === 'p2p' ? session.mine.entries.length === before + 1 : count(head) === before - 1;
  return { clicked, framed, did, name, before, after: host.querySelector(head)?.textContent ?? null, box: host.querySelector('.sb-ask')?.textContent ?? null };
};
/** A repaint alone, k times over (the window's own repaint): each one's synchronous time. */
globalThis.__repaints = (k) => {
  const out = [];
  for (let i = 0; i < k; i++) { const t0 = performance.now(); view.repaint(); out.push(performance.now() - t0); }
  return out;
};
/** At a share of the scroll, every drawn pack row is its piece's own row of the whole list, in its place, and every
 *  piece whose place meets the list's band is drawn - read where the rows carry their piece. */
globalThis.__placed = async (frac) => {
  const r0 = packRows()[0];
  if (!r0 || !('_tradeItem' in r0)) return null;
  await rowAt(frac);
  const rows = packRows();
  const all = e.items;   // before a move, every window's pack column is the pack as it stands, in its order
  const idx = rows.map((r) => all.indexOf(r._tradeItem));
  const ordered = idx.every((v, i) => v >= 0 && (i === 0 || v > idx[i - 1]));
  const contiguous = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  const l = packList(), lb = l.getBoundingClientRect();
  const sc = [l, l.closest('.packcol')].find((x) => x && x.scrollHeight > x.clientHeight + 1) ?? l;
  const band = sc.getBoundingClientRect();
  const boxes = rows.map((r) => r.getBoundingClientRect());
  const coversBand = boxes.length > 0 && boxes[0].top <= Math.max(band.top, lb.top) + 1 && boxes.at(-1).bottom >= Math.min(band.bottom, lb.bottom) - 1;
  return { rows: rows.length, ordered, contiguous, coversBand, first: idx[0], last: idx.at(-1), total: all.length };
};
globalThis.__ready = true;
</script></body></html>`;

/** The page's ARENA2 fetch, answered off the disk, case as the folder has it. */
async function arena2Index() {
  const map = new Map();
  for (const f of await readdir(ARENA2)) map.set(f.toUpperCase(), f);
  return map;
}

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };

const server = await createServer({ root: ROOT, server: { port: Number(process.env.PROBE_PORT ?? 5247), strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const port = server.config.server.port;
const browser = await chromium.launch();
const files = await arena2Index();
const out = { kinds: null, runs: [] };
let failed = [];
try {
  await writeFile(join(ROOT, `tools/${PAGE_NAME}`), PAGE);
  for (const which of WINDOWS) {
    for (const n of SIZES) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (er) => errors.push(er.message));
      await page.route('**/arena2/**', async (route) => {
        const name = decodeURIComponent(route.request().url().split('/').pop().split('?')[0]).toUpperCase();
        const f = files.get(name);
        if (!f) return route.fulfill({ status: 404, body: '' });
        return route.fulfill({ status: 200, body: await readFile(join(ARENA2, f)) });
      });
      await page.goto(`http://127.0.0.1:${port}/tools/${PAGE_NAME}?skin=enhanced`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.waitForFunction(() => globalThis.__ready === true, null, { timeout: 120000 });
      out.kinds = await page.evaluate(() => globalThis.__kinds);
      // warm the modules (not the pictures): a three-piece window opened and shut
      await page.evaluate((w) => globalThis.__open(3, w), which);
      await page.evaluate(() => globalThis.__close());
      await page.evaluate(() => { globalThis.__long = []; new PerformanceObserver((l) => { for (const t of l.getEntries()) globalThis.__long.push(t.duration); }).observe({ type: 'longtask' }); });
      const r = { which, n, errors };
      const t0 = Date.now();
      r.cold = await page.evaluate(([k, w]) => globalThis.__open(k, w), [n, which]);
      let last = null, still = 0;
      for (let i = 0; i < SETTLE_S * 10 && still < 30; i++) {
        await page.waitForTimeout(100);
        const s = await page.evaluate(() => globalThis.__state());
        if (!s) continue;
        if (s.initials === 0) { last = s; break; }
        still = last && last.initials === s.initials && last.shells === s.shells ? still + 1 : 0;
        last = s;
      }
      r.settleMs = Date.now() - t0;
      r.settled = last;
      r.longTasks = await page.evaluate(() => ({ count: globalThis.__long.length, ms: Math.round(globalThis.__long.reduce((a, b) => a + b, 0)), worst: Math.round(Math.max(0, ...globalThis.__long)) }));
      r.warm = await page.evaluate(([k, w]) => globalThis.__open(k, w), [n, which]);
      r.warmState = await page.evaluate(() => globalThis.__state());
      const cdp = PROFILE ? await ctx.newCDPSession(page) : null;
      if (cdp) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 100 }); await cdp.send('Profiler.start'); }
      r.selects = await page.evaluate(() => globalThis.__selects());
      if (REPAINTS) r.repaints = await page.evaluate((k) => globalThis.__repaints(k), REPAINTS);
      if (cdp) await writeFile(join(PROFILE, `${which}-${n}.cpuprofile`), JSON.stringify((await cdp.send('Profiler.stop')).profile));
      r.placed = [];
      for (const f of [0, 0.25, 0.5, 0.9, 1]) r.placed.push(await page.evaluate((x) => globalThis.__placed(x), f));
      r.move = await page.evaluate((w) => globalThis.__move(w), which);
      out.runs.push(r);
      const sel = r.selects.map((s) => s.framed);
      console.log(`${which.padEnd(4)} n=${String(n).padStart(4)}: cold ${r.cold.framed.toFixed(0)} ms to the frame, settled in ${r.settleMs} ms (${r.settled?.shells} repaints, long tasks ${r.longTasks.count} = ${r.longTasks.ms} ms, worst ${r.longTasks.worst}); rows ${r.warmState?.rows} (${r.warmState?.perCol?.join('/')}), nodes ${r.warmState?.nodes}; warm ${r.warm.framed.toFixed(0)} ms; a click ${median(sel).toFixed(1)} ms median, ${Math.max(...sel).toFixed(1)} worst; a move ${r.move.framed.toFixed(1)} ms;${r.repaints ? ` a repaint ${median(r.repaints).toFixed(1)} ms median;` : ''} errors ${errors.length}${r.move.did ? '' : ` (move: ${r.move.box ?? r.move.after})`}`);
      const bad = [];
      if (errors.length) bad.push(`threw: ${errors[0]}`);
      if (r.settled?.initials) bad.push(`${r.settled.initials} rows never took their picture`);
      if (!r.selects.every((s) => s.did)) bad.push('a click did not preview its piece');
      if (!r.move.did) bad.push(`the double click did not move the piece (${JSON.stringify(r.move)})`);
      for (const p of r.placed) if (p && p.ordered === false) bad.push('a drawn row out of its place');
      for (const p of r.placed) if (p && p.coversBand === false) bad.push('a piece in view not drawn');
      if (bad.length) failed.push(`${which} n=${n}: ${bad.join('; ')}`);
      await ctx.close();
    }
  }
  if (process.env.OUT) await writeFile(process.env.OUT, JSON.stringify(out, null, 1));
} finally {
  await unlink(join(ROOT, `tools/${PAGE_NAME}`)).catch(() => {});
  await browser.close(); await server.close();
}
if (failed.length) throw new Error(`tradePerfProbe: ${failed.join(' | ')}`);
