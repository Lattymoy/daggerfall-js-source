// MENU live probe: the settings screen in a real browser, on a
// DESKTOP and on a PHONE.
//
// Every tap uses the rects the screen itself reports through
// window.__settings - the same layout() its draw and its clicks read.
// Guessing coordinates is how the audit's first touch check reported
// "TRAPPED" after the fix had already landed, and how the launcher
// once drew PLAY where no finger could reach.
//
// Usage: node tools/settingsProbe.mjs
import { createServer } from 'vite';
import { chromium, devices } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const server = await createServer({ server: { port: 5217, strictPort: true } });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});

let fails = 0;
const check = (ok, label) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`); if (!ok) fails++; };

async function openScreen(ctx, label) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`); });
  await page.goto('http://localhost:5217/play/?launcher&novideo');
  const until = Date.now() + 90000;
  let st = null;
  while (Date.now() < until) {
    st = await page.evaluate(() => (window.__settings ? JSON.parse(window.__settings()) : null));
    if (st?.up) break;
    await page.waitForTimeout(500);
  }
  check(!!st?.up, `[${label}] the settings screen is UP before the game`);
  return { page, errors, st };
}
const read = (page) => page.evaluate(() => JSON.parse(window.__settings()));
// a reported PAGE rect -> the CSS point a finger would touch
async function centreOf(page, rect) {
  const st = await read(page);
  const box = await page.evaluate(() => {
    const c = document.querySelector('canvas').getBoundingClientRect();
    return { left: c.left, top: c.top, w: c.width, h: c.height };
  });
  const { ox, oy, s } = st.metric;
  const sx = ox + (rect[0] + rect[2] / 2) * s;
  const sy = oy + (rect[1] + rect[3] / 2) * s;
  return [box.left + sx * (box.w / st.canvas.w), box.top + sy * (box.h / st.canvas.h)];
}

// ---------------- DESKTOP ----------------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const { page, errors, st } = await openScreen(ctx, 'desktop');
  if (st?.up) {
    check(st.mode === 'classic' && st.scale >= 3, `[desktop] classic metric at scale ${st.scale} (text ${7 * st.scale}px)`);
    check(/work now/.test(st.tallyText), `[desktop] the header states the truth: "${st.tallyText}"`);
    const gs = st.groups.map((g) => `${g.title}(${g.count})${g.open ? '' : ' folded'}`);
    check(st.groups.length >= 2 && st.groups.some((g) => !g.open),
      `[desktop] tier is a GROUP: ${gs.join('  ')}`);
    check(st.rows.every((r) => !/^[A-Z][a-z]+[A-Z]|_/.test(r.label)),
      '[desktop] no row shows a raw ini identifier');
    // every category is reachable, and each reports its own tally
    const cats = st.hit.filter((h) => h.kind === 'category');
    check(cats.length === 7, `[desktop] all seven categories on the rail (${cats.length})`);
    for (const c of cats) {
      await page.mouse.click(...await centreOf(page, c.rect));
      await page.waitForTimeout(120);
    }
    const afterTour = await read(page);
    check(!!afterTour.tallyText, `[desktop] every category opens (last: "${afterTour.tallyText}")`);
    // change a LIVE setting through the real control, and check it sticks
    await page.mouse.click(...await centreOf(page, cats[2].rect));   // Audio
    await page.waitForTimeout(200);
    const audio = await read(page);
    const liveRow = audio.rows.find((r) => r.tier === 'live');
    check(!!liveRow, `[desktop] Audio has a WORKS NOW row (${liveRow?.label} = ${liveRow?.value})`);
    if (liveRow) {
      const ctrl = audio.hit.find((h) => h.id === `ctrl:${liveRow.key}`);
      await page.mouse.click(...await centreOf(page, ctrl.rect));
      await page.waitForTimeout(250);
      const after = await read(page);
      const now = after.rows.find((r) => r.key === liveRow.key);
      check(now.value !== liveRow.value, `[desktop] a click CHANGED it: ${liveRow.value} -> ${now.value}`);
      const stored = await page.evaluate(() => !!localStorage.getItem('dagger.settings.v1'));
      check(stored, '[desktop] and it persisted');
    }
    const real = errors.filter((e) => !/CURSOR\.IMG|Failed to load resource|ANIM0001/.test(e));
    check(real.length === 0, real.length ? `[desktop] page errors: ${real.slice(0, 2).join(' | ')}` : '[desktop] zero page errors');
  }
  await ctx.close();
}

// ---------------- PHONE (the scar) ----------------
{
  const ctx = await browser.newContext({ ...devices['Pixel 5'], hasTouch: true });
  const { page, st } = await openScreen(ctx, 'phone');
  if (st?.up) {
    check(st.scale >= 2, `[phone] text is ${7 * st.scale}px, not the 7px nativeMetrics would give`);
    check(st.mode === 'comfort', `[phone] the elastic COMFORT page (${st.page[2]}x${st.page[3]})`);
    // Every reported target is inside the canvas AND >= 44 CSS px on its
    // short axis. Canvas pixels are NOT CSS pixels - a DPR-scaled canvas
    // makes a 44-canvas-px target a 16-CSS-px one on a 2.75x phone - so
    // convert through the element's real box before judging a finger.
    const box = await page.evaluate(() => {
      const b = document.querySelector('canvas').getBoundingClientRect();
      return { w: b.width, h: b.height };
    });
    const cssPerCanvas = box.w / st.canvas.w;
    check(cssPerCanvas > 0.9, `[phone] canvas ${st.canvas.w}x${st.canvas.h} -> ${box.w}x${box.h} CSS (${cssPerCanvas.toFixed(2)} CSS px per canvas px)`);
    const bad = st.hit.filter((h) => {
      const { ox, oy, s } = st.metric;
      const x = ox + h.rect[0] * s, y = oy + h.rect[1] * s, w = h.rect[2] * s, hh = h.rect[3] * s;
      return x < 0 || y < 0 || x + w > st.canvas.w + 1 || y + hh > st.canvas.h + 1
        || Math.min(w, hh) * cssPerCanvas < 44;
    });
    check(bad.length === 0, bad.length ? `[phone] ${bad.length} targets off-canvas or under 44px: ${bad.slice(0, 3).map((b) => b.id).join(', ')}` : '[phone] every target is on-canvas and >= 44 CSS px');
    // a finger can drive it: tap a row, tap PLAY
    const row = st.hit.find((h) => h.kind === 'row');
    if (row) { await page.touchscreen.tap(...await centreOf(page, row.rect)); await page.waitForTimeout(200); }
    const play = (await read(page)).hit.find((h) => h.id === 'btn:play');
    await page.touchscreen.tap(...await centreOf(page, play.rect));
    await page.waitForTimeout(700);
    const gone = await read(page);
    check(gone.up === false, '[phone] tapping PLAY leaves the screen - the trap stays fixed');
  }
  await ctx.close();
}

await browser.close();
await server.close();
console.log(fails === 0 ? 'MENU SETTINGS PROBE: ALL GREEN' : `MENU SETTINGS PROBE: ${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
