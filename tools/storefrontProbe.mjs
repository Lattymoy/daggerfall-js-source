// STOREFRONT (2026-10-29; bible/06-Systems/Storefront.md section 9) - THE STOREFRONT, SEEN in a real browser.
//
// The pause face through its real painter (tools/pauseShopProbe.mjs's way), its /v1/account answered here with every
// ware, a featured schedule and a season's card: the carousel (its slides, arrows, dots, keys and pause), each section's
// panels with their live stages (a kill effect and a portal skin on the stand-in, a horse in its look), a bundle's
// contents and the Folios (a cover opened, a page turned, Back); on a desktop and a 390 phone. No console error, no page
// wider than its screen.
// Frames go to STOREFRONT_OUT, never the tree.
//
//     npx vite --port 5199 &
//     STOREFRONT_OUT=/tmp/storefront node tools/storefrontProbe.mjs
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
import { SHOP_WARES } from '../src/net/shopLaw.js';

const BASE = process.env.PROBE_BASE ?? 'http://127.0.0.1:5199';
const OUT = process.env.STOREFRONT_OUT ?? '/tmp/storefront-probe';
mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); };

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
const BUY = (id) => `https://accounts.invalid/v1/shop/buy?t=${encodeURIComponent(id)}`;
const DAY = 86_400_000;
const answer = () => {
  const now = Date.now();
  return {
    account: { id: 'a1', name: 'Aelwyn', kind: 'linked', handle: 'Aelwyn' },
    wardrobe: { titles: [], title: null, glyphs: ['oblivion'], auras: [], aura: null, icons: [], icon: null, armoryHeld: [], armory: null,
      effectsHeld: { kill: ['pyre'], portal: [], mount: [] }, effects: 'c00' },
    shop: {
      on: true,
      wares: SHOP_WARES.filter((w) => w.alone).map((w) => ({ id: w.id, sale: true, held: w.id === 'kill:pyre', buy: w.id === 'kill:pyre' ? null : BUY(w.id),
        cents: w.id === 'bundle:daedricchampion' ? 3000 : w.cents, ...(w.id === 'kill:pyre' ? { until: now + 3 * DAY, limited: true } : w.id === 'portal:aetheric' ? { until: now + 9 * DAY } : {}) })),
      featured: ['portal:aetheric', 'kill:voidrend', 'mount:warhorse', 'bundle:lordofoblivion'],   // PASS-PANELS: no pass is a ware
    },
    pass: { season: 's1', open: true, stage: 1, tracks: { premium: true }, bought: ['glyph:cog', 'icon:aetherium', 'glyph:tonalfork'], today: 60,
      challenges: [{ key: 'halls-constructs', n: 22, paid: false }, { key: 'halls-elites', n: 10, paid: true }] },
    aurum: { open: true, balance: 1450, daily: { until: now + DAY, wares: [] }, week: { until: now + 3 * DAY, deeds: {} } },
  };
};

async function toPause(page) {
  await page.route(/\/v1\/(?!account)/, (route) => route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: '{"saves":[]}' }));
  await page.route(/\/v1\/account(\/.*)?$/, (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(answer()) });
  });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('dagger.quicksave', JSON.stringify({ v: 1, name: 'Aelwyn', chargenDone: true, career: { name: 'Spellsword' }, level: 4, items: [] }));
      localStorage.setItem('dagger.account.session', JSON.stringify({ id: 'a1', name: 'Aelwyn', kind: 'linked', sessionId: 's1', secret: 'probe-secret' }));
    } catch { /* storage off */ }
  });
  await page.goto(`${BASE}/play/?nointro`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.px-menu', { timeout: 120000 });
  if (await page.locator('.px-acctstage').count()) await page.keyboard.press('Escape');
  await page.evaluate(async () => {
    const { openPauseFlow } = await import('/src/ui/pauseDoor.js');
    const clock = { now: Date.now(), rows: [], seatsOpen: false, zero: false, doors: {} };
    const box = { version: 1, waiting: 0, state: 'in', post: [], refresh: async () => {} };
    openPauseFlow(() => {}, { exitToMenu: () => {}, textLines: () => null, timers: () => clock, post: () => box });
  });
  await page.waitForSelector('.px-shopmark', { timeout: 15000 });
}
/** How much of each canvas is lit, read off the screen: a stage's context keeps no drawing buffer (characterStage.js,
 *  preserveDrawingBuffer false), so the canvas copied between frames is its cleared buffer, whatever it showed. */
const canvasLit = async (page, sel) => {
  const out = [];
  for (const el of await page.locator(sel).all()) {
    const png = (await el.screenshot()).toString('base64');
    out.push(await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const t = document.createElement('canvas'); t.width = img.width; t.height = img.height;
      const g = t.getContext('2d'); g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, t.width, t.height).data;
      let lit = 0; for (let i = 0; i < d.length; i += 16) if (d[i] + d[i + 1] + d[i + 2] > 120) lit++;
      return lit;
    }, png));
  }
  return out;
};

const browser = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [label, opts] of [['desktop', { viewport: { width: 1280, height: 900 } }], ['phone', devices['iPhone 13']]]) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_|404|net::/.test(m.text())) errors.push(m.text()); });
  await toPause(page);
  await page.locator('.px-shopmark').click();
  await page.waitForSelector('.px-shopwin .sh-slide', { timeout: 15000 });
  await page.waitForTimeout(1500);
  const order = await page.evaluate(() => [...document.querySelector('.px-shopwin .px-body').children].map((n) => n.className.split(' ')[0]));
  check(`${label}: the disclaimer, then the carousel, then the sections`, order.indexOf('sh-proceeds') < order.indexOf('sh-carousel') && order.indexOf('sh-carousel') < order.indexOf('sh-tabs'), order.join(' > '));
  const dots = await page.locator('.sh-cdot').count();
  check(`${label}: a dot a featured ware`, dots === 4, String(dots));
  const first = await page.locator('.sh-slide').getAttribute('data-ware');
  const portalLit = await canvasLit(page, '.sh-slide canvas');
  check(`${label}: the portal skin plays on its stage`, portalLit.some((n) => n > 50), JSON.stringify(portalLit));
  await page.screenshot({ path: `${OUT}/${label}-carousel-portal.png` });
  await page.locator('.sh-cnext').click();
  await page.waitForTimeout(500);
  const second = await page.locator('.sh-slide').getAttribute('data-ware');
  check(`${label}: the arrow steps the carousel`, first === 'portal:aetheric' && second === 'kill:voidrend', `${first} -> ${second}`);
  await page.screenshot({ path: `${OUT}/${label}-carousel-kill-early.png` });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/${label}-carousel-kill.png` });
  await page.locator('.sh-cnext').click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${label}-carousel-mount.png` });
  // the sections
  for (const [i, name] of ['pass', 'kills', 'portals', 'mounts', 'names', 'auras', 'armory', 'bundles', 'aurum'].entries()) {
    await page.locator('.sh-tab').nth(i).click();
    await page.waitForTimeout(name === 'kills' || name === 'portals' ? 1400 : 700);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`${label}: ${name} - no page wider than its screen`, wide <= 0, String(wide));
    await page.locator('.sh-panels').screenshot({ path: `${OUT}/${label}-section-${name}.png` }).catch(() => {});
    if (name !== 'pass') continue;
    // PASS-PANELS: a cover opens its folio, a page turns, Back closes it
    await page.locator('.sh-fcover-free').click();
    await page.waitForTimeout(600);
    check(`${label}: the Brass Folio opens on a page`, (await page.locator('.sh-spread .sh-page').count()) === 1);
    await page.locator('.sh-pagenext').click();
    await page.waitForTimeout(400);
    await page.locator('.sh-panels').screenshot({ path: `${OUT}/${label}-section-folio.png` }).catch(() => {});
    await page.locator('.sh-fback').click();
    check(`${label}: Back to the covers`, (await page.locator('.sh-fcover').count()) === 2);
  }
  check(`${label}: no error on the page`, errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}
await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} ok - frames in ${OUT}`);
process.exit(bad.length ? 1 : 0);
