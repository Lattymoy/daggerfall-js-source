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
//   4. SUPPORT1: the corner asks are Patreon's and Ko-fi's, in that order,
//      at SUPPORT_ASKS' addresses, each mark drawn by the game's own rules
//      (injected) and lit gold under the pointer - and at every width the
//      two stay ONE row, clear of everything the door says under them.
//
// Boots vite itself (two servers: one with no data folder, one with the
// fake one) and screenshots desktop, phone and the game's menu:
//     node tools/landingProbe.mjs
import { createServer } from 'vite';
import { chromium, devices } from 'playwright';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SUPPORT_ASKS } from '../src/ui/supportAsks.js';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const shots = process.env.PROBE_SHOTS ?? '/tmp';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

// ── 1 + 2: no data folder anywhere ───────────────────────────────
delete process.env.ARENA2_PATH;
const bare = await createServer({ server: { host: '127.0.0.1', port: 5230, strictPort: true }, logLevel: 'error' });
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
  // BR2: the gem has a ruby core with four brass tips. Check both
  // computed colours so a stale all-brass gem cannot pass.
  const gem = await page.locator('.rule .gem').first().evaluate((el) => {
    const style = getComputedStyle(el);
    return { core: style.backgroundColor, tips: style.boxShadow };
  });
  check(`${label}: the gem's computed core IS ruby`, gem.core === 'rgb(185, 19, 9)', gem.core);
  check(`${label}: the gem retains four brass tips`,
    (gem.tips.match(/rgb\(192, 138, 62\)/g) ?? []).length === 4, gem.tips);
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
  // The DA site cleanup retired the pictures: the page draws in CSS
  // alone, and a returning <img> is a regression, not a decoration.
  check(`${label}: the page carries no pictures at all`, (await page.locator('img').count()) === 0);
  const strip = await page.locator('.foot .stat').evaluateAll((els) => els.map((e) => e.textContent));
  check(`${label}: the foot carries two figures`, strip.length === 2 && strip.every((t) => /^[\d,]{4,}$/.test(t)), strip.join(' / '));
  // The door's three: Play into the browser, Install onto the desk, Discord for the people (DISC1).
  // REL5: Install lands on the desktop app's entry, where each platform's installer is one click.
  const plaques = await page.locator('a.plaque').evaluateAll((els) => els.map((e) => [e.textContent, e.getAttribute('href')]));
  check(`${label}: Play, Install and Discord stand together on the door`,
    plaques.length === 3 && plaques[0][0] === 'Play' && plaques[0][1] === './play/'
    && plaques[1][0] === 'Install' && plaques[1][1] === '#desktop' && plaques[2][0] === 'Discord', JSON.stringify(plaques));
  const downloads = await page.locator('#desktop + dd .dl a').evaluateAll((els) => els.map((e) => [e.textContent, e.getAttribute('href')]));
  check(`${label}: Install lands on three direct downloads`,
    downloads.length === 3 && downloads.every(([, h]) => /\/releases\/latest\/download\/DaggerfallOnline-[\w-]+\.(exe|dmg|AppImage)$/.test(h)), JSON.stringify(downloads));
  // SUPPORT1: the asks - the addresses, the order, the marks the game draws, a thumb's target, gold under the pointer
  const asks = await page.locator('.asks a.ask').evaluateAll((els) => els.map((e) => {
    const mark = e.querySelector('.supmark'), b = e.getBoundingClientRect(), m = mark?.getBoundingClientRect();
    return { href: e.getAttribute('href'), mark: mark?.className, h: b.height, shadow: mark ? getComputedStyle(mark, '::before').boxShadow : 'none',
      inside: !!m && m.top >= b.top + 2 && m.bottom <= b.bottom - 2 };
  }));
  check(`${label}: the corner asks are Patreon then Ko-fi, at SUPPORT_ASKS' addresses`,
    JSON.stringify(asks.map((a) => a.href)) === JSON.stringify(SUPPORT_ASKS.map((a) => a.url)), JSON.stringify(asks.map((a) => a.href)));
  check(`${label}: each ask's mark is drawn by the injected rules, whole inside its plaque`,
    asks.length === 2 && asks.every((a, i) => a.mark === `supmark supmark-${SUPPORT_ASKS[i].id}` && a.shadow !== 'none' && a.inside), JSON.stringify(asks));
  check(`${label}: each ask is a 44px target`, asks.every((a) => a.h >= 44), asks.map((a) => `${a.h}px`).join(' / '));
  await page.locator('.asks a.ask').nth(1).hover();
  const lit = await page.locator('.asks .supmark-kofi').evaluate((m) => getComputedStyle(m).getPropertyValue('--mk-hi').trim());
  check(`${label}: a mark lights in the classic pair's gold under the pointer`, lit === 'rgb(243,239,44)', lit);
  await page.mouse.move(0, 0);
  check(`${label}: no page errors`, errors.length === 0, errors.join(' | '));
  await page.screenshot({ path: `${shots}/landing-${label}.png`, fullPage: true });
  console.log(`  ${shots}/landing-${label}.png`);
  return { ctx, page };
}

const desk = await landing('desktop', { viewport: { width: 1400, height: 900 } });

// SUPPORT1: THE ASKS' ROW, at every width - one row (two would come down over the wordmark), inside the screen, and
// clear of everything the door says under it: the door's top is the asks' room (index.html, .door).
{
  const page = await browser.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  const bad = [];
  for (const w of [320, 360, 375, 390, 412, 430, 480, 600, 768, 860, 861, 1024, 1280, 1366, 1920]) {
    for (const h of [568, 640, 720, 900]) {
      await page.setViewportSize({ width: w, height: h });
      const g = await page.evaluate(() => {
        const r = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
        const asks = [...document.querySelectorAll('.asks a.ask')].map(r);
        const under = [...document.querySelectorAll('.door > :not(.asks):not(.foot)')].map(r);
        return { asks, under };
      });
      const [a, k] = g.asks;
      const row = { t: Math.min(a.t, k.t), b: Math.max(a.b, k.b), l: Math.min(a.l, k.l), r: Math.max(a.r, k.r) };
      if (a.t !== k.t) bad.push(`${w}x${h}: two rows`);
      else if (row.l < 0 || row.r > w) bad.push(`${w}x${h}: off the screen`);
      else if (g.under.some((u) => u.t < row.b && u.l < row.r && row.l < u.r)) bad.push(`${w}x${h}: over the door`);
    }
  }
  check('the asks stand one row, on the screen and clear of the door, at 60 sizes from 320px to 1920px', bad.length === 0, bad.join('; '));
  await page.close();
}
check('desktop: the foot carries build, tests, lines and Source',
  await desk.page.locator('.foot').isVisible()
  && (await desk.page.locator('.foot .stat').count()) === 2);

// The door behind the door: press Play (the door's FIRST plaque - the
// second is Install, which lands on the downloads), land on the PIXEL HOME
// with no data, no picker.
await desk.page.locator('a.plaque', { hasText: 'Play' }).click();
// The current front door presents the cinematic before the menu. Use
// its real Skip intro control, retaining the no-data boot assertions.
// A cold dev server must transform the game's imports before it mounts.
const skipIntro = desk.page.getByRole('button', { name: 'Skip intro', exact: true });
await skipIntro.waitFor({ state: 'visible', timeout: 90000 });
check('desktop: Play opens the cinematic before the menu', await skipIntro.isVisible());
await skipIntro.click();
await desk.page.waitForSelector('.px-menu button', { timeout: 30000 });
check('desktop: Play opens /play/', new URL(desk.page.url()).pathname.endsWith('/play/'), desk.page.url());
// The CORE entries, not an exact count - the menu gains and loses
// rows as arcs land (a hardcoded 5 rotted the moment Test Room and
// Enhanced joined) and this probe's law is "the home DRAWS with no
// data", not "the menu is frozen".
const menuLabels = await desk.page.locator('.px-menu button').evaluateAll((els) => els.map((e) => e.textContent));
check('desktop: the pixel home draws with no ARENA2',
  ['New Game', 'Load Game', 'Settings'].every((core) => menuLabels.some((l) => l.includes(core))), JSON.stringify(menuLabels));
check('desktop: the folder pick has NOT been asked for',
  (await desk.page.locator('#pick').count()) === 0);
await desk.page.screenshot({ path: `${shots}/landing-desktop-play.png` });
console.log(`  ${shots}/landing-desktop-play.png`);
await desk.ctx.close();

const phone = await landing('phone', { ...devices['Pixel 5'] });
check('phone: the foot stacks and still carries its figures',
  await phone.page.locator('.foot').isVisible()
  && (await phone.page.locator('.foot .stat').count()) === 2);
// Both door plaques are thumb targets now, not just Play.
const plaqueBoxes = await Promise.all([
  phone.page.locator('a.plaque', { hasText: 'Play' }).boundingBox(),
  phone.page.locator('a.plaque', { hasText: 'Install' }).boundingBox(),
]);
check('phone: Play and Install are 44px targets',
  plaqueBoxes.every((b) => !!b && b.height >= 44), plaqueBoxes.map((b) => `${b?.height}px`).join(' / '));
await phone.ctx.close();

await browser.close();
await bare.close();

// ── 3: the mount, against a fake folder ──────────────────────────
const fake = mkdtempSync(join(tmpdir(), 'fake-arena2-'));
writeFileSync(join(fake, 'ART_PAL.COL'), 'not a palette');
process.env.ARENA2_PATH = fake;
const data = await createServer({ server: { host: '127.0.0.1', port: 5231, strictPort: true }, logLevel: 'error' });
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
