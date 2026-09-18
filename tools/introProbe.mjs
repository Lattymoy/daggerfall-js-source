// INTRO2: live browser/audio integration, independent of the rendered preview.
// Run: node tools/introProbe.mjs [output-directory]. Starts its own Vite server.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, devices } from 'playwright';
import { createServer } from 'vite';
import { TITLE_IMPACT_TIME } from '../src/ui/introCue.js';
import { MENU_THEME_GAIN } from '../src/systems/introTheme.js';

const out = process.argv[2] ?? 'test-harness/intro';
mkdirSync(out, { recursive: true });
const server = await createServer({ server: { port: 5201, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: [
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
] });
const base = 'http://localhost:5201/play/';
const results = [], errors = [];
const check = (name, ok, detail = null) => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'ok' : 'FAIL'} ${name}`, detail ?? ''); };
const ready = async (page) => page.waitForFunction(() => !document.querySelector('.intro-begin')?.disabled && window.__intro?.state.landscapeReady !== undefined, null, { timeout: 30000 });
const shot = (page, name) => page.screenshot({ path: `${out}/${name}.png` });
const follow = (page) => page.on('pageerror', e => errors.push(e.message));
const seek = async (page, time) => {
  const n = await page.evaluate(t => window.__intro.seek(t), time);
  await page.waitForFunction(({ n, time }) => window.__intro.state.frames > n && window.__intro.state.time === time, { n, time });
};
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); follow(page);
  await page.goto(`${base}?introdebug`); await ready(page);
  check('autoplay gate holds at time zero with no source', await page.evaluate(() => !window.__intro.theme.source && window.__intro.theme.time() === 0));
  check('landscape compiled and initialized', await page.evaluate(() => window.__intro.state.landscapeReady));
  await shot(page, '01-begin');
  await page.locator('.intro-begin').click();
  await page.waitForFunction(() => window.__intro.theme.source !== null);
  await page.evaluate(() => {
    window.__sourceBefore = window.__intro.theme.source;
    window.__samples = [];
    const sample = () => {
      const state = window.__intro.state, theme = window.__intro.theme;
      if (state.phase === 'menu' || state.phase === 'disposed') return;
      window.__samples.push({ ...state, audioTime: theme.time() });
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.waitForFunction(() => window.__intro.state.phase === 'hold', null, { timeout: 60000 });
  await page.waitForFunction(() => window.__intro.state.time > 23.2);
  await shot(page, '06-final-title');
  const live = await page.evaluate(() => ({ samples: window.__samples, snapshot: window.__intro.snapshot() }));
  writeFileSync(`${out}/live-timing.json`, JSON.stringify(live, null, 2));
  const before = live.samples.findLast(s => s.time < TITLE_IMPACT_TIME && s.time > 20);
  const landed = live.samples.find(s => s.time >= TITLE_IMPACT_TIME);
  // SwiftShader can present only one frame during the short title fade. The
  // useful live invariant is that the last pre-attack presentation is already
  // visibly descending and has not landed; exact opacity is covered by the
  // deterministic cue tests and frame-by-frame review render.
  check('logo is visibly above its landing before the musical attack', before?.titleY < 0 && before?.titleOpacity > 0.9, {
    time: before?.time, opacity: before?.titleOpacity, y: before?.titleY,
  });
  check('first frame after the attack lands exactly at rest', landed?.titleY === 0 && landed?.titleOpacity === 1, landed?.time);
  // A display cannot present between refreshes. On a hardware runner this is
  // normally one 16.7 ms frame; SwiftShader can take longer. The invariant is
  // that the first available presentation after the decoded onset is landed,
  // with no application-authored offset hidden inside a slow renderer.
  const landingDelay = landed?.time - TITLE_IMPACT_TIME;
  check('logo lands on the first available presentation frame after the measured attack',
    landed && landingDelay >= 0 && landingDelay <= landed.frameMs / 1000 + 0.01,
    { delayMs: landingDelay * 1000, frameMs: landed?.frameMs });
  check('final splash holds for player input', live.snapshot.phase === 'hold' && await page.locator('#enhanced-menu').count() === 0);
  const beforeMenuTime = live.snapshot.time;
  await page.locator('.intro-continue').click();
  check('menu is inert beneath the fade', await page.evaluate(() => document.querySelector('#enhanced-menu')?.inert));
  await page.keyboard.press('Enter'); await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__intro.state.phase === 'menu');
  check('same source advances into the menu at the lower gain', await page.evaluate(({ time, gain }) => {
    const t = window.__intro.theme;
    return t.source === window.__sourceBefore && t.time() > time && t.level === gain && t.gain.gain.value < 0.3 && t.context.state === 'running';
  }, { time: beforeMenuTime, gain: MENU_THEME_GAIN }));
  check('transition input cannot activate a menu action', await page.locator('#pick').count() === 0 && await page.locator('#enhanced-menu').count() === 1);
  check('shared supplied logo loads in the main menu', await page.locator('.px-wordmark .enhanced-logo').evaluate(img => img.complete && img.naturalWidth === 1536));
  await shot(page, '07-main-menu');
  await page.evaluate(async () => { const { setValue } = await import('/src/systems/settings.js'); setValue('Controls', 'MusicVolume', 0); });
  await page.waitForFunction(() => window.__intro.theme.gain.gain.value < 0.001);
  check('menu music obeys live volume settings', true);
  await page.locator('.px-menu button').filter({ hasText: /New Game/ }).first().click();
  await page.locator('#enhanced-menu .act.primary', { hasText: 'Begin' }).click();
  await page.waitForSelector('#pick');
  check('starting a game releases audio before the data picker', await page.evaluate(() => window.__intro.theme.disposed && !window.__intro.theme.context && !window.__intro.theme.source && !window.__intro.theme.buffer));
  await ctx.close();

  // Audio interruption is isolated from the sync measurement above: resume
  // must continue the same score position rather than substituting wall time.
  const pausedContext = await browser.newContext({ viewport: { width: 960, height: 540 } });
  const pausedPage = await pausedContext.newPage(); follow(pausedPage);
  await pausedPage.goto(`${base}?introdebug`); await ready(pausedPage);
  await pausedPage.locator('.intro-begin').click();
  await pausedPage.waitForFunction(() => window.__intro.state.time >= 2.4);
  await pausedPage.evaluate(async () => {
    await window.__intro.theme.pause();
    window.__pause = { time: window.__intro.theme.time(), wall: performance.now() };
  });
  await pausedPage.waitForFunction(() => window.__intro.state.phase === 'paused' && performance.now() - window.__pause.wall > 250);
  check('audio suspension freezes the film', await pausedPage.evaluate(() => window.__intro.theme.time() === window.__pause.time));
  await pausedPage.locator('.intro-begin').click();
  await pausedPage.waitForFunction(() => window.__intro.state.phase === 'playing' && window.__intro.theme.time() > window.__pause.time + 0.05);
  check('resuming continues the score instead of jumping by wall time', await pausedPage.evaluate(() => window.__intro.theme.time() < window.__pause.time + 1));
  await pausedContext.close();

  // Stills use the same renderer at explicit score times. They prove
  // composition and sizing, not live synchronization (tested above).
  for (const [name, options] of [
    ['desktop', { viewport: { width: 1280, height: 720 } }],
    ['phone', { ...devices['Pixel 5'] }],
    ['landscape-phone', { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 }],
    ['reduced-motion', { viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' }],
  ]) {
    const c = await browser.newContext(options), p = await c.newPage(); follow(p);
    await p.goto(`${base}?introdebug&introat=0`); await ready(p);
    if (name === 'desktop') {
      for (const [t, label] of [[3, '02-interkarma'], [7, '03-nexus'], [12.5, '04-cloud-rise'], [18.9, '05-bay']]) { await seek(p, t); await shot(p, label); }
    }
    await seek(p, 24);
    const layout = await p.evaluate(() => {
      const logo = document.querySelector('.intro-title img'), button = document.querySelector('.intro-continue');
      const a = logo.getBoundingClientRect(), b = button.getBoundingClientRect();
      return { width: innerWidth, height: innerHeight, logo: { x: a.x, y: a.y, width: a.width, height: a.height, bottom: a.bottom, right: a.right }, button: { y: b.y, bottom: b.bottom, height: b.height }, loaded: logo.naturalWidth === 1536 };
    });
    check(`${name}: logo fits at its original aspect and clears the tap target`, layout.loaded && layout.logo.x >= 0 && layout.logo.right <= layout.width + 1 && Math.abs(layout.logo.width / layout.logo.height - 3) < 0.01 && layout.logo.bottom < layout.button.y && layout.button.bottom < layout.height && layout.button.height >= 44, layout);
    await shot(p, `title-${name}`);
    await p.locator('.intro-continue').click(); await p.waitForSelector('#intro', { state: 'detached' });
    await shot(p, `menu-${name}`);
    check(`${name}: handoff opens a usable menu`, await p.locator('.px-menu button').count() > 0 && !await p.locator('#enhanced-menu').evaluate(el => el.inert));
    await c.close();
  }

  const failure = await browser.newContext(), fp = await failure.newPage(); follow(fp);
  await fp.route('**/theme.mp3*', route => route.abort());
  await fp.goto(`${base}?introdebug`); await ready(fp); await fp.locator('.intro-begin').click();
  await fp.waitForFunction(() => window.__intro.state.phase === 'hold');
  check('missing score offers the final card with an explicit message', (await fp.locator('.intro-footer').textContent()).includes('couldn’t load'));
  await fp.locator('.intro-continue').click(); await fp.waitForSelector('#intro', { state: 'detached' });
  check('missing score never blocks the menu', await fp.locator('.px-menu button').count() > 0);
  await failure.close();

  const slow = await browser.newContext(), sp = await slow.newPage(); follow(sp);
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  await sp.route('**/theme.mp3*', async route => { await blocked; await route.continue().catch(() => {}); });
  await sp.goto(`${base}?introdebug`); await sp.waitForSelector('.intro-skip');
  await sp.locator('.intro-skip').click(); await sp.waitForSelector('#intro', { state: 'detached' });
  check('skip works while audio is still loading', await sp.locator('.px-menu button').count() > 0);
  release();
  await sp.waitForFunction(() => window.__intro.theme.source !== null, null, { timeout: 30000 });
  check('late audio joins the menu at the menu level', await sp.evaluate(gain => window.__intro.theme.level === gain, MENU_THEME_GAIN));
  await slow.close();
  check('no uncaught page errors', errors.length === 0, errors);
} catch (error) { check('probe completed', false, error.stack); }
finally {
  writeFileSync(`${out}/browser-report.json`, JSON.stringify({ results, errors }, null, 2));
  await browser.close(); await server.close();
}
assert.ok(results.every(r => r.ok), `${results.filter(r => !r.ok).length} cinematic checks failed; see ${out}/browser-report.json`);
