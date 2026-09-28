// SET7 (2026-09-26, Sigil Sets - bible/11-Multiplayer/Sigil-Sets.md section 7; Mac: "Sigil stones become a currency to
// trade for daily reset sigil items at a new NPC vendor that stands outside the oblivion gate") - THE SIGIL BROKER,
// DRAWN AND MEASURED.
//
// A pin can say she stands at a spot in the gate's frame and her window lays out six rows; only a renderer and a layout
// engine can say she is SEEN there - her sprite, at her size, beside the gate and off its plinth - and that the window
// reads at a desk and on a phone. So:
//   - THE WORLD: the REAL Renderer (render/renderer.js), the REAL gate pool (scenes/gatePool.js) standing an open gate,
//     and the REAL Broker pool (scenes/sigilBrokerPool.js) on the REAL data pipeline (scenes/dataPipeline.js - her
//     TEXTURE.284 off the dev server's ARENA2), shot from the approach, up close and from her side: she stands, her
//     sprite loaded, an idle record, her height a person's, and her pixels ON the frame (a frame drawn without her
//     differs where she stands);
//   - THE WINDOW: the REAL door (ui/brokerDoor.js - the lazy chunk through the one home) over the day's REAL stock, a
//     pack of seven spendable stones in one stack and a locked one (SS1), at a desktop, a laptop and a phone: it fits the screen; its title,
//     the line under it, the purse and Close clear of each other; six rows, each row's picture, name, set, price and Buy
//     clear of each other (a refusal's sentence on the Buy once starved the name to "Ruh..." and ran the set into the
//     price), every Buy inside its row and pressable or saying why not in a word, the pictures landed (the pack's own icon door), the
//     pressed offer's card with its set block and its sigil block, a sale that says so and takes its stones, and the
//     back key that shuts it.
// Every state is photographed.
//
// IT RUNS ON VITE'S OWN DEV SERVER (tools/qs3Probe.mjs's reason), with ARENA2 behind it (vite.config.js - ARENA2_PATH).
//
//     node tools/brokerProbe.mjs                    -> shots (tools/shots/, or SHOT_DIR) and a report
//     PROBE_PORT=<n> node tools/brokerProbe.mjs     -> reuse a dev server already listening there
import { mkdirSync } from 'node:fs';
import { writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const ROOT = normalize(join(dirname(fileURLToPath(import.meta.url)), '..'));
const PAGE_NAME = 'broker.tmp.html';
const OUT = process.env.SHOT_DIR ?? join(ROOT, 'tools/shots');

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>SET7 probe</title>
<style>html,body{margin:0;height:100%;overflow:hidden;background:#0d0f14}canvas{position:fixed;left:0;top:0}</style></head><body>
<canvas id="c" width="960" height="540" style="width:960px;height:540px"></canvas>
<script type="module">
import { Renderer } from '/src/render/renderer.js';
import { DFPalette } from '/src/formats/dfPalette.js';
import { getBytes } from '/src/scenes/dataSource.js';
import { createDataPipeline } from '/src/scenes/dataPipeline.js';
import { createGatePool, gateLocal } from '/src/scenes/gatePool.js';
import { createSigilBroker, BROKER_SPOT } from '/src/scenes/sigilBrokerPool.js';
import { IDLE_ANIMS } from '/src/characters/mobileUnit.js';
import { perspective, mirrorProjectionX, lookAt } from '/src/world/mat4.js';
import { brokerStock, brokerDay, brokerBought, makeBrokerSale, spendableStonesIn, lockedStonesIn, stoneCount } from '/src/systems/sigilBroker.js';
import { sigilStone } from '/src/systems/gateSpoils.js';
import { setLocked } from '/src/systems/itemLock.js';
import { setSigilOnline, setSigilRenown } from '/src/systems/sigil.js';
import { setSetsWearer } from '/src/systems/sigilSets.js';
import { itemLongName } from '/src/systems/itemInfo.js';
import { setPref } from '/src/systems/uiPrefs.js';
import { playerEntity } from '/src/characters/playerEntity.js';
import { createBrokerOverlay, brokerDoorOpen } from '/src/ui/brokerDoor.js';

setPref('lootRarity', true);
setSigilOnline(true); setSigilRenown(12);
setSetsWearer(() => playerEntity);
window.__errs = [];
try {
  // ── THE WORLD ──
  const canvas = document.getElementById('c');
  const r = new Renderer(canvas);
  const palette = new DFPalette();
  palette.load(await getBytes('ART_PAL.COL'), 'ART_PAL.COL');
  const pipe = createDataPipeline({ renderer: r, arch: null, palette, fetch: getBytes });
  const now = Date.now();
  const g = { day: 5, px: 0, py: 0, spot: [0, 0], near: 'Probe', phase: 'open', t: { omenAt: now - 1e7, riseAt: now - 9e6, openAt: now - 1000, sealAt: now + 1e7, wrathAt: now + 2e7 }, fellAt: null };
  const gate = createGatePool({ renderer: r, gl: r.gl, standing: () => g, pixelTranslation: () => [0, 0, 0], heightAt: () => 0, now: () => Date.now() });
  let eye = [0, 1.7, 30];
  const broker = createSigilBroker({ renderer: r, getTexture: pipe.getTexture, uploadRecordFrame: pipe.uploadRecordFrame,
    place: () => gate.state().place, heightAt: () => 0, now: () => Date.now(), cam: () => eye, feet: () => null });
  gate.frame(0.016); broker.frame(0.016);
  for (let i = 0; i < 200 && broker.state().body !== 'loaded' && broker.state().body !== 'failed'; i++) await new Promise((res) => setTimeout(res, 50));
  /** gate-local to the scene (gatePool.js gateLocal, undone) */
  const toScene = (lx, ly, lz) => { const p = gate.state().place; const c = Math.cos(p.yaw), s = Math.sin(p.yaw); return [p.origin[0] + c * lx + s * lz, p.origin[1] + ly, p.origin[2] - s * lx + c * lz]; };
  window.__world = { toScene, spot: BROKER_SPOT, idle: IDLE_ANIMS.map((a) => a.record) };
  window.__shoot = (e, at, withBroker = true) => {
    eye = e;
    gate.frame(0.016);
    const b = broker.frame(0.016);
    const proj = mirrorProjectionX(perspective(1.0, 960 / 540, 0.1, 2000));
    const view = lookAt(new Float32Array(e), new Float32Array(at), new Float32Array([0, 1, 0]));
    const yaw = Math.atan2(at[0] - e[0], at[2] - e[2]);
    r.setClearColor([0.1, 0.1, 0.4, 1]);
    r.beginFrame(proj, view, new Float32Array([0.3, 0.8, 0.5]), { world: true });
    gate.draw(r);
    const bb = broker.batches();
    if (withBroker && bb.length) r.drawBillboards(bb, new Float32Array([Math.cos(yaw), 0, -Math.sin(yaw)]), new Float32Array([0, 1, 0]));
    const gl = r.gl;
    const px = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const st = broker.state();
    return { stands: !!b, feet: b?.feet ?? null, local: b ? gateLocal(gate.state().place, b.feet) : null, body: st.body, batch: bb[0] ? { record: bb[0].record, w: bb[0].size.w, h: bb[0].size.h, origin: [...bb[0].origin] } : null,
      px: Array.from(px), w: gl.drawingBufferWidth, h: gl.drawingBufferHeight };
  };
  // ── THE WINDOW ──
  const pack = [Object.assign(sigilStone(), { stackCount: 7 }), sigilStone()];   // SS1: the stones stack - seven in one, and a locked one
  setLocked(pack[1], true);
  playerEntity.items = pack;
  const day = () => brokerDay(Date.now());
  const stock = brokerStock(day());
  let win = null;
  window.__open = () => {
    canvas.style.display = 'none';
    win = createBrokerOverlay({
      stock: () => stock, day, now: () => Date.now(),
      items: () => spendableStonesIn(playerEntity.items), locked: () => stoneCount(lockedStonesIn(playerEntity.items)),
      bought: () => brokerBought(day()),
      buy: (o) => makeBrokerSale(o, { items: playerEntity.items, day: day() }),
      wearer: playerEntity, nameOf: (it) => itemLongName(it),
    });
    return !!win;
  };
  window.__win = () => {
    const box = (el) => { if (!el) return null; const q = el.getBoundingClientRect(); return { x: q.x, y: q.y, r: q.x + q.width, b: q.y + q.height, w: q.width, h: q.height }; };
    const w = document.querySelector('.broker-win');
    if (!w) return null;
    const rows = [...w.querySelectorAll('.broker-offer')].map((row) => {
      const buy = row.querySelector('.broker-buy');
      const cs = buy ? getComputedStyle(buy) : null;
      /** the text's own box (a Range's), not its element's - an ellipsised line's element is its column, its text is what shows */
      const ink = (el) => { if (!el) return null; const rg = document.createRange(); rg.selectNodeContents(el); const q = rg.getBoundingClientRect(); const e = el.getBoundingClientRect(); const x = Math.max(q.x, e.x), r = Math.min(q.x + q.width, e.x + e.width); return { x, y: q.y, r, b: q.y + q.height, w: r - x, h: q.height }; };
      return { slot: row.dataset.slot, box: box(row), buy: box(buy), buyText: buy?.textContent, buyTitle: buy?.getAttribute('title') ?? null, disabled: !!buy?.disabled, visible: !!cs && cs.visibility !== 'hidden' && cs.display !== 'none',
        parts: { name: ink(row.querySelector('.broker-name')), set: ink(row.querySelector('.broker-set')), price: ink(row.querySelector('.broker-price')), buy: box(buy), frame: box(row.querySelector('.broker-frame')) },
        img: !!row.querySelector('.tile img'), name: row.querySelector('.broker-name')?.textContent, set: row.querySelector('.broker-set')?.textContent, price: row.querySelector('.broker-price')?.textContent,
        nameColour: getComputedStyle(row.querySelector('.broker-name')).color, rune: getComputedStyle(row.querySelector('.broker-frame'), '::after').backgroundImage.slice(0, 40) };
    });
    const card = w.querySelector('.broker-card');
    const head = { title: box(w.querySelector('.broker-title h2')), sub: box(w.querySelector('.broker-sub')), purse: box(w.querySelector('.broker-purse')), close: box(w.querySelector('.broker-close')) };
    return { win: box(w), head, rows, purse: w.querySelector('.broker-purse')?.textContent, sub: w.querySelector('.broker-sub')?.textContent, note: w.querySelector('.broker-note')?.textContent ?? null,
      card: box(card), cardTitle: card?.querySelector('h3')?.textContent, setbox: !!card?.querySelector('.setbox'), sigilbox: !!card?.querySelector('.sigilbox'), cardText: card?.textContent ?? '',
      font: getComputedStyle(w).fontFamily, border: getComputedStyle(w).borderTopStyle };
  };
  window.__buyFirst = () => { const b = [...document.querySelectorAll('.broker-buy')].find((x) => !x.disabled); if (!b) return null; const slot = b.closest('.broker-offer').dataset.slot; b.click(); return slot; };
  window.__press = (slot) => { document.querySelector('.broker-offer[data-slot="' + slot + '"]')?.click(); };
  window.__doorOpen = () => brokerDoorOpen();
  window.__stones = () => ({ spendable: stoneCount(spendableStonesIn(playerEntity.items)), locked: stoneCount(lockedStonesIn(playerEntity.items)), items: playerEntity.items.length });
} catch (e) { window.__errs.push(String(e?.stack ?? e)); }
window.__ready = true;
</script></body></html>`;

const VIEWS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 } },
  { name: 'laptop', viewport: { width: 1024, height: 700 } },
  { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  // AUDIT SET U1: the skin is the player's choice online - the window lays its own sheet on the classic skin
  { name: 'desktop-classic', skin: 'classic', viewport: { width: 1440, height: 900 } },
  { name: 'phone-classic', skin: 'classic', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
];

mkdirSync(OUT, { recursive: true });
const vite = process.env.PROBE_PORT ? null : await createServer({ root: ROOT, server: { port: 0, host: '127.0.0.1', watch: null }, logLevel: 'error' });
if (vite) await vite.listen();
const port = vite ? vite.httpServer.address().port : Number(process.env.PROBE_PORT);
const browser = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const fails = [];
let checks = 0;
const check = (ok, what) => { checks++; if (!ok) fails.push(what); };
const settle = (page) => page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));
/** Do two boxes overlap (by more than a hair)? */
const overlap = (a, b) => !!a && !!b && Math.min(a.r, b.r) - Math.max(a.x, b.x) > 1 && Math.min(a.b, b.b) - Math.max(a.y, b.y) > 1;
/** Every pair of named boxes that overlaps. */
const clashes = (boxes) => { const k = Object.keys(boxes).filter((n) => boxes[n]); const out = []; for (let i = 0; i < k.length; i++) for (let j = i + 1; j < k.length; j++) if (overlap(boxes[k[i]], boxes[k[j]])) out.push(`${k[i]}/${k[j]}`); return out; };
const inside = (a, w) => !!a && a.x >= w.x - 0.5 && a.r <= w.r + 0.5 && a.y >= w.y - 0.5 && a.b <= w.b + 0.5;
/** How many pixels of two frames differ, and the box they differ in. */
const diff = (a, b, w, h) => {
  let n = 0, x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let i = 0; i < a.length; i += 4) {
    if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) < 24) continue;
    n++;
    const p = i / 4, x = p % w, y = h - 1 - Math.floor(p / w);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  return { n, box: n ? { x0, y0, x1, y1 } : null };
};
try {
  await writeFile(join(ROOT, `tools/${PAGE_NAME}`), PAGE);
  // ── THE WORLD ──
  {
    const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
    const page = await ctx.newPage();
    page.on('pageerror', (err) => fails.push(`world: page error ${err.message}`));
    await page.route('**/tools/arena2/**', (route) => route.continue({ url: route.request().url().replace('/tools/arena2/', '/arena2/') }));   // dataSource fetches ./arena2/ RELATIVE to the page
    await page.goto(`http://127.0.0.1:${port}/tools/${PAGE_NAME}?skin=enhanced`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => globalThis.__ready === true, null, { timeout: 120000 });
    const errs = await page.evaluate(() => globalThis.__errs);
    check(errs.length === 0, `world: page errors ${errs.join(' | ')}`);
    const W = await page.evaluate(() => ({ spot: globalThis.__world.spot, idle: globalThis.__world.idle }));
    const at = (lx, ly, lz) => page.evaluate(([a, b, c]) => globalThis.__world.toScene(a, b, c), [lx, ly, lz]);
    for (const [name, eyeL, lookL] of [
      ['approach', [0, 1.7, 34], [3, 4, 0]],
      ['near', [W.spot.lx - 1.5, 1.6, W.spot.lz + 5], [W.spot.lx, 1.1, W.spot.lz]],
      ['side', [W.spot.lx + 9, 2.2, W.spot.lz + 1], [W.spot.lx - 2, 2, W.spot.lz - 3]],
    ]) {
      const eye = await at(...eyeL), look = await at(...lookL);
      const withB = await page.evaluate(([e, a]) => globalThis.__shoot(e, a, true), [eye, look]);
      await page.screenshot({ path: join(OUT, `broker-world-${name}.png`) });
      const without = await page.evaluate(([e, a]) => globalThis.__shoot(e, a, false), [eye, look]);
      const d = diff(withB.px, without.px, withB.w, withB.h);
      console.log(`world ${name}: stands ${withB.stands} body ${withB.body} local ${withB.local?.map((v) => v.toFixed(2)).join(',')} batch ${JSON.stringify(withB.batch && { ...withB.batch, origin: withB.batch.origin.map((v) => +v.toFixed(2)) })} - her pixels ${d.n} in ${JSON.stringify(d.box)}`);
      check(withB.stands, `world ${name}: she does not stand`);
      check(withB.body === 'loaded', `world ${name}: her sprite is ${withB.body}`);
      check(withB.local && Math.abs(withB.local[0] - W.spot.lx) < 1e-3 && Math.abs(withB.local[2] - W.spot.lz) < 1e-3, `world ${name}: she stands at ${withB.local} in the gate's frame`);
      check(withB.batch && W.idle.some((r) => withB.batch.record === `${r}#0`), `world ${name}: her record ${withB.batch?.record} is not an idle one`);
      check(withB.batch && withB.batch.h > 1.9 && withB.batch.h < 2.3, `world ${name}: she is ${withB.batch?.h} m tall`);
      check(d.n > (name === 'approach' ? 60 : 1500), `world ${name}: a frame without her differs in ${d.n} pixels - she is not on the screen`);
      if (name === 'near') check(d.box && d.box.x0 < 480 && d.box.x1 > 480, `world near: she is not in the middle of the frame (${JSON.stringify(d.box)})`);
    }
    await ctx.close();
  }
  // ── THE WINDOW ──
  for (const v of VIEWS) {
    const ctx = await browser.newContext({ viewport: v.viewport, isMobile: !!v.isMobile, hasTouch: !!v.hasTouch, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on('pageerror', (err) => fails.push(`${v.name}: page error ${err.message}`));
    await page.route('**/tools/arena2/**', (route) => route.continue({ url: route.request().url().replace('/tools/arena2/', '/arena2/') }));
    await page.goto(`http://127.0.0.1:${port}/tools/${PAGE_NAME}?skin=${v.skin ?? 'enhanced'}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => globalThis.__ready === true, null, { timeout: 120000 });
    check(await page.evaluate(() => globalThis.__open()), `${v.name}: the door did not open`);
    if (v.skin === 'classic') {
      await page.waitForSelector('.broker-win', { timeout: 30000 });
      const sheets = await page.evaluate(() => ({ own: !!document.getElementById('broker-skin-style'), plus: !!document.getElementById('enhanced-plus-style') }));
      check(sheets.own && !sheets.plus, `${v.name}: the classic page lays ${JSON.stringify(sheets)} - its own sheet, and never the Plus sheet`);
    }
    await page.waitForSelector('.broker-win .broker-offer', { timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    // the pictures land through the pack's own icon door and repaint the window
    await page.waitForFunction(() => document.querySelectorAll('.broker-offer .tile img').length === 6, null, { timeout: 30000 }).catch(() => {});
    await settle(page);
    let s = await page.evaluate(() => globalThis.__win());
    console.log(`${v.name}: window ${s.win.w.toFixed(0)}x${s.win.h.toFixed(0)} purse "${s.purse}" - ${s.rows.map((r) => `${r.slot}:${r.name} (${r.set}) ${r.price} [${r.buyText}]${r.img ? '' : ' NO PICTURE'}`).join(' | ')}`);
    check(s.win.x >= -0.5 && s.win.r <= v.viewport.width + 0.5 && s.win.y >= -0.5 && s.win.b <= v.viewport.height + 0.5, `${v.name}: the window runs off the screen ${JSON.stringify(s.win)}`);
    check(s.rows.length === 6, `${v.name}: ${s.rows.length} rows`);
    check(s.purse === '7 Sigil Stones · 1 locked', `${v.name}: the purse reads "${s.purse}"`);
    check(/^Sigil Stones buy the day's stock · it turns in \d+(h \d\dm|m)$/.test(s.sub), `${v.name}: the sub line reads "${s.sub}"`);
    check(/Pixel|monospace|VT323|Press/i.test(s.font) || s.font.length > 0, `${v.name}: the window has no font (${s.font})`);
    check(s.border !== 'none', `${v.name}: the kit did not dress the window (border ${s.border})`);
    // the header: the title, the line under it, the purse and Close each clear of the others, all inside the window
    const hc = clashes(s.head);
    check(hc.length === 0, `${v.name}: the header's pieces overlap: ${hc.join(', ')} ${JSON.stringify(s.head)}`);
    for (const [k, b] of Object.entries(s.head)) check(inside(b, s.win), `${v.name}: the header's ${k} runs out of the window ${JSON.stringify(b)}`);
    check(s.head.title && s.head.title.h < 40, `${v.name}: the title wraps (${s.head.title?.h}px tall)`);
    check(s.head.sub && s.head.sub.h < 64, `${v.name}: the line under the title wraps to ${s.head.sub?.h}px`);
    for (const r of s.rows) {
      check(r.img, `${v.name}: row ${r.slot} (${r.name}) has no picture`);
      check(r.buy && r.visible && r.buy.x >= r.box.x - 0.5 && r.buy.r <= r.box.r + 0.5 && r.buy.y >= r.box.y - 0.5 && r.buy.b <= r.box.b + 0.5, `${v.name}: row ${r.slot}'s Buy is outside its row ${JSON.stringify({ buy: r.buy, row: r.box })}`);
      check(r.buy && r.buy.h >= 22 && r.buy.w >= 44, `${v.name}: row ${r.slot}'s Buy is ${r.buy?.w}x${r.buy?.h} - too small to press`);
      check(r.rune.startsWith('url('), `${v.name}: row ${r.slot} wears no set rune (${r.rune})`);
      const rc = clashes(r.parts);
      check(rc.length === 0, `${v.name}: row ${r.slot}'s pieces overlap: ${rc.join(', ')} ${JSON.stringify(r.parts)}`);
      check(r.parts.name && r.parts.name.w >= 80, `${v.name}: row ${r.slot}'s name is starved to ${r.parts.name?.w}px`);
      check(r.name && !/null|undefined|NaN/.test(`${r.name}${r.set}${r.price}`), `${v.name}: row ${r.slot} says ${r.name} / ${r.set} / ${r.price}`);
    }
    const priceXs = s.rows.map((r) => r.parts.price?.x ?? NaN);
    check(Math.max(...priceXs) - Math.min(...priceXs) < 2, `${v.name}: the prices do not stand in a line: ${priceXs.map((x) => x.toFixed(0)).join(', ')}`);
    const buyWs = s.rows.map((r) => r.buy?.w ?? NaN);
    check(Math.max(...buyWs) - Math.min(...buyWs) < 1, `${v.name}: the Buys are not one width: ${buyWs.map((x) => x.toFixed(0)).join(', ')}`);
    check(s.rows[5].buyText === 'Need 5 more' && s.rows[5].buyTitle === 'Not enough Sigil Stones' && s.rows[5].disabled, `${v.name}: the Regalia at twelve, a purse of seven: "${s.rows[5].buyText}" (${s.rows[5].buyTitle})`);
    check(s.card && s.setbox && s.sigilbox, `${v.name}: the card has ${s.setbox ? '' : 'no set block '}${s.sigilbox ? '' : 'no sigil block'}`);
    check(s.card && s.card.x >= -0.5 && s.card.r <= v.viewport.width + 0.5, `${v.name}: the card runs off the screen sideways`);
    check(!/null|undefined|NaN/.test(s.cardText), `${v.name}: the card says null/undefined: ${s.cardText.slice(0, 200)}`);
    await page.screenshot({ path: join(OUT, `broker-${v.name}-window.png`) });
    // the Regalia's card
    await page.evaluate(() => globalThis.__press('5'));
    await settle(page);
    await page.waitForTimeout(600);   // a phone's press scrolls the card up, smoothly
    s = await page.evaluate(() => globalThis.__win());
    check(/Ruhn's Regalia/.test(s.cardText) && s.rows[5].box, `${v.name}: the Regalia's card does not read Ruhn's Regalia`);
    if (v.isMobile) check(s.card && s.card.y < v.viewport.height * 0.6 && s.card.y > -1, `${v.name}: a press left the card off the screen (its top at ${s.card?.y?.toFixed(0)})`);   // AUDIT SET U4
    await page.screenshot({ path: join(OUT, `broker-${v.name}-regalia.png`) });
    // a sale
    const before = await page.evaluate(() => globalThis.__stones());
    const slot = await page.evaluate(() => globalThis.__buyFirst());
    await settle(page);
    s = await page.evaluate(() => globalThis.__win());
    const after = await page.evaluate(() => globalThis.__stones());
    const sold = s.rows.find((r) => r.slot === slot);
    console.log(`${v.name}: bought slot ${slot} - "${s.note}" stones ${before.spendable}->${after.spendable} (locked ${after.locked}) purse "${s.purse}"`);
    check(slot != null && /^Bought: .+, for \d+ Sigil Stones?\.$/.test(s.note ?? ''), `${v.name}: the sale says "${s.note}"`);
    const paid = Number(/for (\d+) Sigil/.exec(s.note ?? '')?.[1]);
    // SS1: the price out of the one stack, which keeps the rest - a record more in the pack (the piece), none fewer
    check(after.locked === 1 && before.spendable - after.spendable === paid && after.items === before.items + 1, `${v.name}: the stones ${JSON.stringify({ before, after, paid })}`);
    check(sold?.buyText === 'Bought' && sold.buyTitle === 'Bought today' && sold.disabled, `${v.name}: the bought row reads "${sold?.buyText}" (${sold?.buyTitle})`);
    await page.screenshot({ path: join(OUT, `broker-${v.name}-sold.png`) });
    // the back key shuts it through the door
    await page.keyboard.press('Escape');
    await settle(page);
    check(!(await page.evaluate(() => globalThis.__doorOpen())) && !(await page.$('.broker-win')), `${v.name}: Escape did not shut the window`);
    await ctx.close();
  }
} finally {
  await browser.close();
  await vite?.close();
  await unlink(join(ROOT, `tools/${PAGE_NAME}`)).catch(() => {});
}
console.log(`\n${checks - fails.length}/${checks} checks passed${fails.length ? `:\n  ${fails.join('\n  ')}` : ''}`);
process.exitCode = fails.length ? 1 : 0;
