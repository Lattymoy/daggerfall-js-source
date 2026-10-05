// SUPPORT1 - THE DOOR'S ASKS AND THE CORNERS' BAND, in a real browser, WITH NO ARENA2.
//
// First the asks themselves: two icons top-left of the front door, Patreon then Ko-fi at SUPPORT_ASKS' addresses,
// and a PRESS on one opens its page in a new one - the door's outside-tap and key handling must not swallow a link
// (the desktop app hands that new window to the system browser, app/main.cjs setWindowOpenHandler). That the pause
// face draws none (PX4: no foot, no corner asks over a game) is pinned in node, where it mounts without a world
// (test/support1_asks.test.js).
//
// Then the band.
// The front door carries a mark in each top corner - the asks (Patreon, Ko-fi) top-left, the profile top-right - over
// a stage whose wordmark is a picture as wide as 540px or 84% of the screen. Whether a mark stands ON the logo is a
// question about the logo's own pixels (its corners are transparent), so this answers it the way the bible's
// ground-truth probes do: the logo PNG's alpha is read here, mapped onto the screen through the <img>'s own box, and
// every opaque pixel under a mark's box (the Plus frame's outset included) is counted. Swept across 176 viewport
// sizes on one page (a resize, not a reload), under the Plus skin and the classic one.
//
// It also proves the band costs nothing it must not: the asks cover no menu row, no About and no profile mark, each
// ask is a 44px target, and where the band applies the LAST menu row stands whole on the screen once the stage is
// scrolled to its end (PX8's law - a row the band pushed down must stay reachable).
//
// Run against a dev server:
//     npx vite --port 5199 &
//     node tools/supportAsksProbe.mjs
//
// THE CLAIM IS SCOPED, AND SO IS THE CHECK. The band (ui/enhancedStyle.js, SUPPORT1) is derived from the asks' reach,
// so it holds BOTH marks clear of the logo below 784px and the asks clear everywhere. The profile mark's caption
// reaches further in than the asks (its width is its text's), and where it meets the logo above 783px it did before
// SUPPORT1 too: those are counted and printed as the profile's own, and do not fail this probe. So are the short
// desktop windows (784px and wider, 561 to about 700 tall) where the door, centred and not a scroller, overflows BOTH
// ends - the wordmark's top off the screen, and the last row's foot, or under about 620 the whole row, with no way to
// scroll to it. That is PX8's 560px threshold, set before the menu grew to eight rows (the classic rail's five still
// fit), and the band does not reach those widths: printed, not failed.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { OUTSET } from '../src/ui/enhancedFrame.js';
import { SUPPORT_ASKS } from '../src/ui/supportAsks.js';

const BASE = process.env.PROBE_BASE ?? 'http://127.0.0.1:5199';
const BAND_MAX = 783;   // the band's own media query (ui/enhancedStyle.js, SUPPORT1)
const logo = PNG.sync.read(readFileSync(new URL('../src/assets/branding/daggerfall-online.png', import.meta.url)));
const opaque = (x, y) => logo.data[(y * logo.width + x) * 4 + 3] > 40;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

const SIZES = [];
for (const w of [320, 360, 375, 390, 412, 430, 480, 540, 600, 700, 768, 800, 900, 1024, 1280, 1366, 1920]) for (const h of [568, 640, 667, 720, 768, 844, 900, 1080]) SIZES.push([w, h]);
for (const w of [568, 640, 667, 740, 812, 851, 915, 932]) for (const h of [320, 360, 375, 393, 414]) SIZES.push([w, h]);

/** CSS px² of opaque logo under a box (the frame's outset added when the skin draws one). */
function logoUnder(img, box, outset) {
  const b = { l: box.l - outset, t: box.t - outset, r: box.r + outset, b: box.b + outset };
  const sx = (img.r - img.l) / logo.width, sy = (img.b - img.t) / logo.height;
  const x0 = Math.max(0, Math.floor((b.l - img.l) / sx)), x1 = Math.min(logo.width - 1, Math.ceil((b.r - img.l) / sx));
  const y0 = Math.max(0, Math.floor((b.t - img.t) / sy)), y1 = Math.min(logo.height - 1, Math.ceil((b.b - img.t) / sy));
  let n = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (opaque(x, y)) n++;
  return Math.round(n * sx * sy);
}
const meets = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

const browser = await chromium.launch();

// THE ASKS ON THE DOOR, and a press on each.
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  // the pages the asks open are another site's: answered here, so the check is the press and not the network
  await ctx.route(/patreon\.com|ko-fi\.com/, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>ask</title>' }));
  await page.goto(`${BASE}/play/?nointro`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.px-menu button', { timeout: 90000 });
  if (await page.locator('.px-acctstage').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
  const links = await page.locator('.px-support a.px-supportlink').evaluateAll((els) => els.map((a) => ({ href: a.href, target: a.target, label: a.getAttribute('aria-label') })));
  check('the door carries the asks, Patreon then Ko-fi, at SUPPORT_ASKS\' addresses, each opening a new page',
    JSON.stringify(links) === JSON.stringify(SUPPORT_ASKS.map((a) => ({ href: a.url, target: '_blank', label: a.label }))), JSON.stringify(links));
  for (const ask of SUPPORT_ASKS) {
    const [opened] = await Promise.all([ctx.waitForEvent('page', { timeout: 15000 }).catch(() => null), page.locator(`.px-support-${ask.id}`).click()]);
    check(`a press on ${ask.name} opens ${ask.url}`, opened?.url() === ask.url, opened?.url() ?? 'no page opened');
    await opened?.close();
  }
  check('the door is still the door after both presses', (await page.locator('.px-menu button').count()) > 0 && (await page.locator('.px-support').count()) === 1);
  await ctx.close();
}

for (const [skin, query, outset] of [['plus', '', OUTSET], ['classic', '&skin=classic', 0]]) {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}/play/?nointro${query}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.px-menu button', { timeout: 90000 });
  if (await page.locator('.px-acctstage').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
  await page.waitForFunction(() => document.querySelector('.px-wordmark img')?.complete);
  const onLogo = { support: [], profileBand: [], profileBeyond: [] };
  const covers = [], small = [], unreachable = [], clipped = [];
  for (const [w, h] of SIZES) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const g = await page.evaluate(() => {
      const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
      const stage = document.querySelector('.px-home:not(.px-over) > .px-stage:not(.px-acctstage)');
      const rows = [...document.querySelectorAll('.px-menu button')];
      const out = { img: r(document.querySelector('.px-wordmark img')), support: r(document.querySelector('.px-support')),
        profile: r(document.querySelector('.px-profile')), about: r(document.querySelector('.px-about')),
        links: [...document.querySelectorAll('.px-supportlink')].map(r), rows: rows.map(r) };
      // the last row, once the stage is scrolled to its end: does a press at its centre land on it?
      stage.scrollTop = stage.scrollHeight;
      const last = rows.at(-1).getBoundingClientRect();
      // pressed where it SHOWS: the row's middle, or the last on-screen line of it
      const hit = document.elementFromPoint(last.left + last.width / 2, Math.min(last.top + last.height / 2, innerHeight - 1));
      out.lastPressed = !!hit && rows.at(-1).contains(hit);
      out.lastWhole = last.bottom <= innerHeight;
      stage.scrollTop = 0;
      out.wordmarkTop = document.querySelector('.px-wordmark').getBoundingClientRect().top;
      return out;
    });
    const at = `${w}x${h}`;
    const s = logoUnder(g.img, g.support, outset);
    if (s) onLogo.support.push(`${at}(${s}px²)`);
    const p = logoUnder(g.img, g.profile, outset);
    if (p) (w <= BAND_MAX ? onLogo.profileBand : onLogo.profileBeyond).push(`${at}(${p}px²)`);
    for (const [name, box] of [['the profile', g.profile], ['About', g.about], ...g.rows.map((b, i) => [`row ${i + 1}`, b])]) {
      if (meets(g.support, box)) covers.push(`${at}: ${name}`);
    }
    for (const l of g.links) if (l.r - l.l < 44 || l.b - l.t < 44) small.push(`${at}: ${Math.round(l.r - l.l)}x${Math.round(l.b - l.t)}`);
    if (w <= BAND_MAX && (!g.lastPressed || !g.lastWhole)) unreachable.push(at);
    else if (!g.lastPressed) clipped.push(`${at}(row off the screen)`);
    else if (!g.lastWhole || g.wordmarkTop < 0) clipped.push(at);
  }
  check(`${skin}: the asks stand on no opaque pixel of the logo, at ${SIZES.length} sizes`, onLogo.support.length === 0, onLogo.support.join(' '));
  check(`${skin}: below ${BAND_MAX + 1}px the profile mark stands clear of it too`, onLogo.profileBand.length === 0, onLogo.profileBand.join(' '));
  check(`${skin}: the asks cover no menu row, no About and no profile mark`, covers.length === 0, covers.slice(0, 8).join('; '));
  check(`${skin}: each ask is a 44px target`, small.length === 0, small.slice(0, 8).join('; '));
  check(`${skin}: below ${BAND_MAX + 1}px, where the band costs height, the last menu row stands whole and takes a press, scrolled to the end`, unreachable.length === 0, unreachable.join(' '));
  check(`${skin}: no page error`, errors.length === 0, errors.join(' | '));
  console.log(`  (the profile's own, from ${BAND_MAX + 1}px up - its caption's reach, not the band's: ${onLogo.profileBeyond.length ? onLogo.profileBeyond.join(' ') : 'none'})`);
  console.log(`  (PX8's, outside the band - the door overflowing a short window at both ends: ${clipped.length ? clipped.join(' ') : 'none'})`);
  await page.close();
}
await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exit(1);
