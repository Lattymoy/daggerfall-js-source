// THE DOOR IN FRONT OF THE DOOR (U60), in a real browser.
//
// Three claims a source sweep cannot make:
//   1. The landing page at / is the enhanced skin's page: the tokens on
//      it are the skin's own block, injected - a computed colour on the
//      page IS brass - and the page reaches the game at /play/.
//   2. /play/ still opens the enhanced front door with NO ARENA2 (the
//      U49 claim, re-proven one directory down, and the picker stays
//      away).
//   3. The dev server answers the game's RELATIVE data fetch from its
//      new home: /play/arena2/* serves ARENA2_PATH exactly as /arena2/*
//      does. A fake folder with one fake file proves the mount; no game
//      data is involved.
//
// Boots vite itself (two servers: one with no data folder, one with the
// fake one) and screenshots desktop, phone and the game's menu:
//     node tools/landingProbe.mjs
import { createServer } from 'vite';
import { chromium, devices } from 'playwright';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const shots = process.env.PROBE_SHOTS ?? '/tmp';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

// ── 1 + 2: no data folder anywhere ───────────────────────────────
delete process.env.ARENA2_PATH;
const bare = await createServer({ server: { port: 5230, strictPort: true }, logLevel: 'error' });
await bare.listen();
const BASE = 'http://127.0.0.1:5230';

const browser = await chromium.launch();

async function landing(label, ctxOpts) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });

  const tokens = await page.locator('style#enhanced-tokens').textContent();
  check(`${label}: the skin's token block is on the page`, /--brass:\s*#c08a3e/.test(tokens ?? ''));
  const sub = await page.locator('.brand .sub').evaluate((el) => getComputedStyle(el).color);
  check(`${label}: a computed colour on the page IS brass`, sub === 'rgb(192, 138, 62)', sub);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check(`${label}: the ground is ink`, bg === 'rgb(14, 16, 19)', bg);
  check(`${label}: the fonts link is the skin's`,
    (await page.locator('link[rel=stylesheet][href*="fonts.googleapis.com"]').count()) === 1);
  check(`${label}: no script, no image, no canvas on the landing`,
    (await page.locator('script:not([src^="/@vite/"]), img, canvas, video').count()) === 0);   // vite's own HMR client is the dev server's, not the page's
  const play = await page.locator('.gate a.act.primary').getAttribute('href');
  check(`${label}: Play points one directory down`, play === './play/', play);
  check(`${label}: no page errors`, errors.length === 0, errors.join(' | '));
  await page.screenshot({ path: `${shots}/landing-${label}.png`, fullPage: true });
  console.log(`  ${shots}/landing-${label}.png`);
  return { ctx, page };
}

const desk = await landing('desktop', { viewport: { width: 1400, height: 900 } });
check('desktop: the rail foot (source + build) shows',
  await desk.page.locator('.foot').isVisible());
check('desktop: the phone bar does not',
  !(await desk.page.locator('.thumb').isVisible()));

// The door behind the door: press Play, land in the enhanced menu with
// no data, no picker.
await desk.page.locator('.gate a.act.primary').click();
await desk.page.waitForSelector('#enhanced-menu .railbtn', { timeout: 15000 });
check('desktop: Play opens /play/', new URL(desk.page.url()).pathname.endsWith('/play/'), desk.page.url());
check('desktop: the enhanced menu draws with no ARENA2',
  (await desk.page.locator('#enhanced-menu .railbtn').count()) === 6);
check('desktop: the folder pick has NOT been asked for',
  (await desk.page.locator('#pick').count()) === 0);
await desk.page.screenshot({ path: `${shots}/landing-desktop-play.png` });
console.log(`  ${shots}/landing-desktop-play.png`);
await desk.ctx.close();

const phone = await landing('phone', { ...devices['Pixel 5'] });
check('phone: the rail foot hides', !(await phone.page.locator('.foot').isVisible()));
check('phone: Play sits in the thumb bar', await phone.page.locator('.thumb a.act.primary').isVisible());
const thumb = await phone.page.locator('.thumb a.act.primary').boundingBox();
check('phone: the thumb bar Play is a 44px target', !!thumb && thumb.height >= 44, `${thumb?.height}px`);
await phone.ctx.close();

await browser.close();
await bare.close();

// ── 3: the mount, against a fake folder ──────────────────────────
const fake = mkdtempSync(join(tmpdir(), 'fake-arena2-'));
writeFileSync(join(fake, 'ART_PAL.COL'), 'not a palette');
process.env.ARENA2_PATH = fake;
const data = await createServer({ server: { port: 5231, strictPort: true }, logLevel: 'error' });
await data.listen();
try {
  for (const path of ['/arena2/ART_PAL.COL', '/play/arena2/ART_PAL.COL', '/play/arena2/art_pal.col']) {
    const r = await fetch(`http://127.0.0.1:5231${path}`);
    check(`dev serves ${path}`, r.status === 200 && (await r.text()) === 'not a palette', `${r.status}`);
  }
  const miss = await fetch('http://127.0.0.1:5231/play/arena2/NOPE.BSA');
  check('dev 404s a missing name under /play/arena2/', miss.status === 404, `${miss.status}`);
} finally {
  await data.close();
  rmSync(fake, { recursive: true, force: true });
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
