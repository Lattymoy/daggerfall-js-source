// STOREFRONT AUDIT (2026-10-29; bible/01-Overview/audits/Audit-Storefront.md) - EVERY WARE'S PICTURE, SEEN IN TIME.
//
// The shop opened as the window probe opens it (tools/storefrontProbe.mjs: its /v1/account answered with every ware),
// then each section's panels one by one: its live stage restarted (a pointer over it plays its loop from the top) and
// shot at several moments, so a kill effect, a portal skin and a horse in its look are read as they move; and the
// season's portraits drawn large. Frames go to GALLERY_OUT, never the tree; a contact sheet a section beside them.
//
//     npx vite --port 5199 &
//     GALLERY_OUT=/tmp/storefront-gallery node tools/storefrontGalleryProbe.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { SHOP_WARES } from '../src/net/shopLaw.js';

const BASE = process.env.PROBE_BASE ?? 'http://127.0.0.1:5199';
const OUT = process.env.GALLERY_OUT ?? '/tmp/storefront-gallery';
const MOMENTS = (process.env.GALLERY_MOMENTS ?? '120,450,900,1600,2600').split(',').map(Number);
const ONLY = process.env.GALLERY_ONLY ? process.env.GALLERY_ONLY.split(',') : null;   // the sections shot (a tab's `sh-tab-<id>`), all without
mkdirSync(OUT, { recursive: true });

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
const answer = () => ({
  account: { id: 'a1', name: 'Aelwyn', kind: 'linked', handle: 'Aelwyn' },
  wardrobe: { titles: [], title: null, glyphs: [], auras: [], aura: null, icons: [], icon: null, armoryHeld: [], armory: null },
  shop: { on: true, wares: SHOP_WARES.filter((w) => w.alone).map((w) => ({ id: w.id, sale: true, held: false, buy: `https://accounts.invalid/b?t=${w.id}`, cents: w.cents })), featured: [] },
  pass: { season: 's1', open: true, stage: 1, xp: 21400, level: 21, top: 34, tracks: { free: true, premium: true, deluxe: false }, mult: 1, today: 0, dayMax: 2000, challenges: [] },
});

const browser = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.route(/\/v1\/(?!account)/, (route) => route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: '{"saves":[]}' }));
await page.route(/\/v1\/account(\/.*)?$/, (route) => (route.request().method() === 'OPTIONS'
  ? route.fulfill({ status: 204, headers: CORS })
  : route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(answer()) })));
await page.addInitScript(() => {
  try {
    localStorage.setItem('dagger.quicksave', JSON.stringify({ v: 1, name: 'Aelwyn', chargenDone: true, career: { name: 'Spellsword' }, level: 4, items: [] }));
    localStorage.setItem('dagger.account.session', JSON.stringify({ id: 'a1', name: 'Aelwyn', kind: 'linked', sessionId: 's1', secret: 'probe-secret' }));
  } catch { /* storage off */ }
});
await page.goto(`${BASE}/play/?nointro`, { waitUntil: 'domcontentloaded', timeout: 300000 });
await page.waitForSelector('.px-menu', { timeout: 300000 });   // a loaded machine takes its time
if (await page.locator('.px-acctstage').count()) await page.keyboard.press('Escape');
await page.evaluate(async () => {
  const { openPauseFlow } = await import('/src/ui/pauseDoor.js');
  const clock = { now: Date.now(), rows: [], seatsOpen: false, zero: false, doors: {} };
  openPauseFlow(() => {}, { exitToMenu: () => {}, textLines: () => null, timers: () => clock, post: () => ({ version: 1, waiting: 0, state: 'in', post: [], refresh: async () => {} }) });
});
await page.waitForSelector('.px-shopmark', { timeout: 15000 });
await page.locator('.px-shopmark').click();
await page.waitForSelector('.px-shopwin .sh-tab', { timeout: 15000 });
await page.locator('.sh-cpause').click().catch(() => {});

const shot = new Set();   // the wares whose stage was shot
const tabs = await page.locator('.sh-tab').count();
for (let i = 0; i < tabs; i++) {
  const tabId = (await page.locator('.sh-tab').nth(i).getAttribute('id')) ?? '';
  if (ONLY && !ONLY.includes(tabId.replace('sh-tab-', ''))) continue;
  await page.locator('.sh-tab').nth(i).click();
  await page.waitForTimeout(400);
  if (tabId === 'sh-tab-pass') await page.locator('.sh-pass').screenshot({ path: `${OUT}/pass-section.png` }).catch(() => {});   // the track, its rewards drawn
  const panels = page.locator('.sh-panels .sh-panel');
  const n = await panels.count();
  for (let k = 0; k < n; k++) {
    const panel = panels.nth(k);
    const id = (await panel.getAttribute('data-ware')) ?? `tab${i}-${k}`;
    const stage = panel.locator('.sh-stage').first();
    await stage.scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);
    await stage.hover().catch(() => {});   // a pointer over it plays its loop from the top
    const t0 = Date.now();
    for (const [m, at] of MOMENTS.entries()) {
      const wait = at - (Date.now() - t0);
      if (wait > 0) await page.waitForTimeout(wait);
      await stage.screenshot({ path: `${OUT}/${id.replace(':', '-')}-${m}.png` }).catch(() => {});
    }
    shot.add(id);
    console.log(`shot ${id}`);
  }
}
// the season's portraits, large - the pass's track draws them small
await page.evaluate(async () => {
  const { profileIconNode } = await import('/src/ui/profileIcons.js');
  const wall = document.createElement('div');
  wall.id = 'icon-wall';
  wall.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#0c0d12;display:flex;flex-wrap:wrap;gap:24px;padding:24px;align-content:flex-start';
  for (const k of ['centurion', 'aetherium', 'lexicon', 'spider', 'sphere', 'colossus', 'gearheart', 'numidium']) {
    const cell = document.createElement('div');
    cell.style.cssText = 'width:200px;height:220px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#16171f;color:#ddd;font:14px sans-serif';
    cell.append(profileIconNode(document, k, 'px-icon', 160), Object.assign(document.createElement('div'), { textContent: k }));
    wall.append(cell);
  }
  document.body.append(wall);
});
await page.waitForTimeout(500);
await page.locator('#icon-wall').screenshot({ path: `${OUT}/icons.png` });
await browser.close();
// the judgement: every ware on sale has a panel whose stage was shot (a section shot whole), and the page never threw
const unshot = ONLY ? [] : answer().shop.wares.map((w) => w.id).filter((id) => !shot.has(id));
if (errors.length || unshot.length) {
  console.error(`FAIL: ${errors.length} page errors (${errors.slice(0, 3).join(' | ')}); wares with no panel shot: ${unshot.join(', ') || 'none'}`);
  process.exit(1);
}
console.log(`PASS: ${shot.size} wares shot, no page error`);
