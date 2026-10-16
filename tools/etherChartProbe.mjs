// ETHER-CHART2 and AUDIT ETHER-CHART2 (2026-10-12; bible/03-World/Eltheric-Ocean.md ETHER-CHART2,
// bible/01-Overview/audits/Audit-Ether-Chart2.md): THE CHART OF THE ELTHERIC OCEAN, MEASURED IN A BROWSER.
//
// node has no layout engine and no font, so what the chart's pins cannot hold is measured here, in Chromium, over the
// real module (`ui/etherChartWindow.js` mounted alone - it needs no game data: the sea is a pure function of its pixel,
// the isles are named off one hash):
//   1. THE MEAN LETTER - LABEL_CHAR_PX, the width a name's letter is given where no canvas measures (node): the 755
//      isles within 200 pixels west of Veilhaven, in CHART_FONT.name with CHART_TRACKING, name by name and letter by
//      letter. The constant is the first, rounded.
//   2. THE WINDOW FITS - at a desktop, a short desktop, a phone held upright and on its side, nothing in the window
//      scrolls (AUDIT ETHER-CHART2 U1: the key and the zoom were under the fold on a phone on its side) and the title
//      is never cut.
//   3. THE FACE LANDS - a window opened before the fonts' stylesheet came is painted again when the face lands
//      (U10): its canvas, once the face has loaded, is pixel for pixel the canvas of a window opened after it.
//   4. A FULL CAPTAIN - a repaint's time with every isle within 400 pixels of Veilhaven charted, at each zoom.
//
//     node tools/etherChartProbe.mjs [out-dir]
//
// With an out-dir, a screenshot of each size is written there (never under the tree: nothing here is committed).
// Needs network for the game's own font request (NODE_USE_ENV_PROXY=1 / NODE_EXTRA_CA_CERTS where a proxy stands in
// front of fonts.googleapis.com); offline it says so and exits 1 - a measurement of the fallback face is not one of
// the face. Exit 1 on any failure.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { LABEL_CHAR_PX } from '../src/ui/etherChartWindow.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = process.argv[2] ?? null;
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#1b241b}</style></head><body><script type="module">
import { mountEtherChartWindow } from '/src/ui/etherChartWindow.js';
import { veilhaven, islesNear, VEIL_X, LEAGUE_PX } from '/src/world/ethericSea.js';
const q = new URLSearchParams(location.search), h = veilhaven();
const charted = new Set([h.key]);
if (q.get('captain') === 'full') for (const i of islesNear(h.px - 400, h.py, 400)) { if (charted.size >= 4096) break; charted.add(i.key); }
else { for (const i of islesNear(h.px - 40, h.py, 70)) charted.add(i.key); for (const i of islesNear(Math.round(VEIL_X - 30 * LEAGUE_PX), h.py, 40)) charted.add(i.key); }
const word = { px: h.px - 18, py: h.py + 3, yaw: -1.87, charted: [...charted], day: 100, stats: { charted: charted.size, deepest: 31, crossings: 2, legends: 1 },
  legends: [{ id: 'queen', name: 'The Drowned Queen', trait: 'mends', sails: false }, { id: 'wake', name: "Sorrow's Wake", trait: 'swift', sails: true }, { id: 'hunger', name: 'Ninefold Hunger', trait: 'boarders', sails: true }] };
window.__charted = charted.size;
window.__chart = mountEtherChartWindow(document.body, { word: () => word, overworld: () => true });   // ETHER-OW: the Overworld's door stands, as it does for an enhanced captain in the open
window.__ready = true;
</script></body></html>`;

let failed = false;
const fail = (m) => { console.log(`FAIL: ${m}`); failed = true; };

const server = await createServer({
  root: ROOT, logLevel: 'silent', server: { port: 5217, strictPort: true },
  plugins: [{ name: 'ether-chart-page', configureServer(s) { s.middlewares.use('/__etherchart', (_, res) => { res.setHeader('content-type', 'text/html'); res.end(PAGE); }); } }],
});
await server.listen();
const browser = await chromium.launch();
const fonts = new Map();
/** The game's own font request, answered from node; `cssDelay` holds the stylesheet back. */
const route = (cssDelay = 0) => async (r) => {
  const url = r.request().url();
  try {
    let hit = fonts.get(url);
    if (!hit) {
      const res = await fetch(url, { headers: { 'user-agent': UA } });
      hit = { status: res.status, headers: { 'content-type': res.headers.get('content-type') ?? '', 'access-control-allow-origin': '*' }, body: Buffer.from(await res.arrayBuffer()) };
      fonts.set(url, hit);
    }
    if (cssDelay && /googleapis/.test(url)) await new Promise((ok) => setTimeout(ok, cssDelay));
    await r.fulfill(hit);
  } catch (e) { console.log(`the fonts could not be fetched (${e.message}) - offline, nothing measured`); process.exit(1); }
};
async function open({ w, h, dpr = 1, touch = false, q = '', cssDelay = 0 }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => fail(`page error: ${e.message}`));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route(cssDelay));
  await page.goto(`http://localhost:5217/__etherchart${q}`);
  await page.waitForFunction(() => window.__ready);
  return { ctx, page };
}
const settle = async (page) => { await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(400); };

try {
  // 1. the mean letter
  {
    const { ctx, page } = await open({ w: 800, h: 600 });
    await settle(page);
    const m = await page.evaluate(async () => {
      const { CHART_FONT, CHART_TRACKING, capFirst } = await import('/src/ui/etherChartWindow.js');
      const { veilhaven, islesNear } = await import('/src/world/ethericSea.js');
      const h = veilhaven();
      const names = islesNear(h.px - 200, h.py, 200).map((i) => capFirst(i.name));
      await document.fonts.load(CHART_FONT.name);
      const g = document.createElement('canvas').getContext('2d');
      g.font = CHART_FONT.name; g.letterSpacing = CHART_TRACKING;
      let px = 0, chars = 0, byName = 0;
      for (const n of names) { const wd = g.measureText(n).width; px += wd; chars += n.length; byName += wd / n.length; }
      return { names: names.length, byName: byName / names.length, byLetter: px / chars, face: document.fonts.check(CHART_FONT.name) };
    });
    console.log(`1. the mean letter over ${m.names} names: ${m.byName.toFixed(3)} name by name, ${m.byLetter.toFixed(3)} letter by letter (LABEL_CHAR_PX ${LABEL_CHAR_PX})`);
    if (!m.face) fail('the face never loaded - measured the fallback');
    if (m.names !== 755) fail(`the sample is ${m.names} names, not 755`);
    if (Math.round(m.byName * 10) / 10 !== LABEL_CHAR_PX) fail(`LABEL_CHAR_PX ${LABEL_CHAR_PX} is not the name-by-name mean rounded (${m.byName.toFixed(3)})`);
    await ctx.close();
  }
  // 2. the window fits
  for (const s of [{ name: 'desktop', w: 1280, h: 860 }, { name: 'short', w: 1280, h: 600 }, { name: 'phone', w: 390, h: 844, dpr: 3, touch: true }, { name: 'phone-side', w: 844, h: 390, dpr: 3, touch: true }, { name: 'wide', w: 2560, h: 1440 }]) {
    const { ctx, page } = await open(s);
    await settle(page);
    const r = await page.evaluate(() => {
      const body = document.querySelector('.dfchart-win .dfnaval-winbody'), h2 = document.querySelector('.dfnaval-wintitle h2');
      const tools = document.querySelector('.dfchart-tools').getBoundingClientRect(), win = document.querySelector('.dfchart-win').getBoundingClientRect();
      const map = document.querySelector('.dfchart-map').getBoundingClientRect();
      const door = document.querySelector('.dfchart-over').getBoundingClientRect();   // ETHER-OW: the fourth press of the row
      return { scroll: body.scrollHeight - body.clientHeight, cut: h2.scrollWidth > h2.clientWidth, toolsIn: tools.bottom <= win.bottom + 0.5, map: [Math.round(map.width), Math.round(map.height)],
        doorIn: door.width >= 44 && door.left >= win.left - 0.5 && door.right <= win.right + 0.5 && door.bottom <= win.bottom + 0.5 };
    });
    console.log(`2. ${s.name} ${s.w}x${s.h}: chart ${r.map.join('x')}, body scroll ${r.scroll}, title cut ${r.cut}, tools in view ${r.toolsIn}, the Overworld's door in view ${r.doorIn}`);
    if (r.scroll > 0) fail(`${s.name}: the window scrolls ${r.scroll}px`);
    if (r.cut) fail(`${s.name}: the title is cut`);
    if (!r.toolsIn) fail(`${s.name}: the zoom and Ship are out of the window`);
    if (!r.doorIn) fail(`${s.name}: the Overworld's door is out of the window`);
    if (OUT) await page.screenshot({ path: join(OUT, `etherchart-${s.name}.png`) });
    await ctx.close();
  }
  // 3. the face lands
  {
    const late = await open({ w: 1280, h: 860, cssDelay: 1500 });
    await late.page.waitForTimeout(1500 + 2500);
    const after = await open({ w: 1280, h: 860 });
    await settle(after.page);
    const pix = (p) => p.evaluate(() => document.querySelector('.dfchart-map').toDataURL());
    const [a, b] = [await pix(late.page), await pix(after.page)];
    console.log(`3. a window opened before the fonts' stylesheet came, once the face has landed: ${a === b ? 'the same canvas' : 'A DIFFERENT CANVAS'} as one opened after`);
    if (a !== b) fail('the late window kept another face');
    await late.ctx.close(); await after.ctx.close();
  }
  // 4. a full captain
  {
    const { ctx, page } = await open({ w: 1280, h: 860, q: '?captain=full' });
    await settle(page);
    for (const [zoom, keys] of [['x1', ['Minus', 'Minus']], ['x2', ['Equal']], ['x4', ['Equal']], ['x8', ['Equal']], ['x16', ['Equal']]]) {
      for (const k of keys) await page.keyboard.press(k);
      const t = await page.evaluate(() => { const out = []; for (let i = 0; i < 15; i++) { const t0 = performance.now(); window.__chart.repaint(); out.push(performance.now() - t0); } out.sort((x, y) => x - y); return { median: out[7], max: out[14], n: window.__charted }; });
      console.log(`4. ${t.n} isles charted, ${zoom}: a repaint ${t.median.toFixed(1)} ms (the slowest of 15 ${t.max.toFixed(1)})`);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  await server.close();
}
console.log(failed ? 'FAILED' : 'ok');
process.exit(failed ? 1 : 0);
