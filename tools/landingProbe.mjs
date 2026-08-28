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
  // U63: the gem on the rule is the brass one, drawn the pixel face's
  // way (a box-shadow cross), so the colour is read off its background.
  const gem = await page.locator('.rule .gem').first().evaluate((el) => getComputedStyle(el).backgroundColor);
  check(`${label}: a computed colour on the page IS brass`, gem === 'rgb(192, 138, 62)', gem);
  const face = await page.locator('h1.wordmark').evaluate((el) => getComputedStyle(el).fontFamily);
  check(`${label}: the wordmark is the MENU's face`, /Jacquard 12/.test(face), face);
  check(`${label}: ...and it loaded`, await page.evaluate(() => document.fonts.check("40px 'Jacquard 12'")));
  const body = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  check(`${label}: the body is the menu's list face`, /Pixelify Sans/.test(body), body);
  // U63: the night is the menu's own - a fixed layer with the ramp, the
  // fog and a star field from pixelGround's seed, all in CSS.
  const night = await page.locator('.night').evaluate((el) => {
    const cs = getComputedStyle(el), after = getComputedStyle(el, '::after');
    return { fixed: cs.position === 'fixed', layers: (cs.backgroundImage.match(/gradient/g) || []).length,
      stars: (after.boxShadow.match(/rgb/g) || []).length };
  });
  check(`${label}: the night is the menu's sky, in CSS`, night.fixed && night.layers >= 3 && night.stars >= 90, JSON.stringify(night));
  // U63: the ground is the PIXEL home's own base (#0a0c11), not the
  // enhanced shell's --ink - the night is painted over it.
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check(`${label}: the ground is the pixel home's base`, bg === 'rgb(10, 12, 17)', bg);
  const fontHref = await page.locator('link[rel=stylesheet][href*="fonts.googleapis.com"]').getAttribute('href') ?? '';
  check(`${label}: one fonts link, and it is the SKIN's own request`,
    (await page.locator('link[rel=stylesheet][href*="fonts.googleapis.com"]').count()) === 1
    && /Jacquard\+12/.test(fontHref) && /Pixelify\+Sans/.test(fontHref));
  // The face RESOLVED, not merely was asked for (needs the network; the
  // page itself never traps on it - Georgia is the fallback).
  const h1Face = await page.locator('h1').evaluate((el) => getComputedStyle(el).fontFamily);
  check(`${label}: the headline is set in the brand face`, /Grenze Gotisch/.test(h1Face), h1Face);
  check(`${label}: ...and the brand face loaded`,
    await page.evaluate(() => document.fonts.check("300 40px 'Grenze Gotisch'")));
  check(`${label}: no script, no canvas on the landing`,
    (await page.locator('script:not([src^="/@vite/"]), canvas, video').count()) === 0);   // vite's own HMR client is the dev server's, not the page's
  // U60c: the three pictures resolve and paint at their declared size.
  await page.locator('#look').scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);   // the pictures are lazy; they are below the door
  const pics = await page.locator('#look figure img').evaluateAll((els) => els.map((i) => [i.getAttribute('src'), i.complete && i.naturalWidth > 0, i.naturalWidth === Number(i.getAttribute('width'))]));
  check(`${label}: the three pictures load at their declared size`, pics.length === 3 && pics.every(([, ok, sized]) => ok && sized), JSON.stringify(pics));
  const strip = await page.locator('.foot .stat').evaluateAll((els) => els.map((e) => e.textContent));
  check(`${label}: the foot carries two figures`, strip.length === 2 && strip.every((t) => /^[\d,]{4,}$/.test(t)), strip.join(' / '));
  const play = await page.locator('a.plaque').getAttribute('href');
  check(`${label}: Play points one directory down`, play === './play/', play);
  check(`${label}: no page errors`, errors.length === 0, errors.join(' | '));
  await page.screenshot({ path: `${shots}/landing-${label}.png`, fullPage: true });
  console.log(`  ${shots}/landing-${label}.png`);
  return { ctx, page };
}

const desk = await landing('desktop', { viewport: { width: 1400, height: 900 } });
check('desktop: the foot carries build, tests, lines and Source',
  await desk.page.locator('.foot').isVisible()
  && (await desk.page.locator('.foot .stat').count()) === 2);

// The door behind the door: press Play, land on the PIXEL HOME with no
// data, no picker.
await desk.page.locator('a.plaque').click();
await desk.page.waitForSelector('.px-menu button', { timeout: 15000 });
check('desktop: Play opens /play/', new URL(desk.page.url()).pathname.endsWith('/play/'), desk.page.url());
check('desktop: the pixel home draws with no ARENA2',
  (await desk.page.locator('.px-menu button').count()) === 5);
check('desktop: the folder pick has NOT been asked for',
  (await desk.page.locator('#pick').count()) === 0);
await desk.page.screenshot({ path: `${shots}/landing-desktop-play.png` });
console.log(`  ${shots}/landing-desktop-play.png`);
await desk.ctx.close();

const phone = await landing('phone', { ...devices['Pixel 5'] });
check('phone: the foot stacks and still carries its figures',
  await phone.page.locator('.foot').isVisible()
  && (await phone.page.locator('.foot .stat').count()) === 2);
const plaque = await phone.page.locator('a.plaque').boundingBox();
check('phone: Play is a 44px target', !!plaque && plaque.height >= 44, `${plaque?.height}px`);
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
