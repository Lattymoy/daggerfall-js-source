// THE WIZARD, IN THE RUNNING GAME.
//
// tools/enhancedChargenProbe.mjs walks the wizard at /chargen.html,
// where a prototype host hands it a flow. This asks the only question
// that one cannot: does the GAME mount it? The path is the real one -
// the enhanced front door, New Game, the world host booting, ARENA2
// loading, and createChargenWindow choosing a skin.
//
//     ARENA2_PATH=... npx vite --port 5199 &
//     node tools/enhancedIntegrationProbe.mjs
//
// A NOTE ON TIME. The host keeps rendering the world behind the
// overlay, and under SwiftShader that is seconds per frame - so the
// generous timeouts here are the software renderer's, not the port's.
// For the same reason this probe checks the MOUNT and the skin fork
// rather than walking to `done`; the walk itself is the chargen
// probe's job and it runs where the world is not being drawn.
import { chromium, devices } from 'playwright';

const BASE = process.env.PROBE_BASE ?? 'http://127.0.0.1:5199';
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

const browser = await chromium.launch();

for (const [label, opts] of [
  ['desktop', { viewport: { width: 1400, height: 900 } }],
  ['phone', { ...devices['Pixel 5'] }],
]) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${BASE}/play/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#enhanced-menu .railbtn', { timeout: 30000 });
  await page.locator('#enhanced-menu .railbtn', { hasText: 'New Game' }).click();
  await page.locator('#enhanced-menu .act.primary', { hasText: 'Begin' }).click();

  const mounted = await page.waitForSelector('#enhanced-chargen .prov', { timeout: 180000 })
    .then(() => true, () => false);
  check(`${label}: New Game mounts the ENHANCED wizard`, mounted);
  if (mounted) {
    // the map is traced from the player's OWN files, so this also
    // proves the art path reaches the view inside the game
    const provs = await page.locator('#enhanced-chargen .prov').count();
    check(`${label}: the map traced from the game's ARENA2`, provs === 9, `${provs} regions`);
    const st = JSON.parse(await page.evaluate(() => window.__chargen()));
    check(`${label}: the wizard starts on Homeland`, st.state === 'race', st.state);
  }
  check(`${label}: no page errors`, errs.length === 0, errs.slice(0, 2).join(' | '));
  await ctx.close();
}

// AND THE CLASSIC SKIN IS UNTOUCHED: ?skin=classic must never mount it.
{
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/play/?skin=classic`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(20000);
  const dom = await page.evaluate(() => !!document.querySelector('#enhanced-chargen'));
  check('classic: the DOM wizard never mounts', !dom);
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
if (failed) process.exit(1);
