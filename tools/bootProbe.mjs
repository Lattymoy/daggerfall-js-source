// THE CHEAPEST PIN THERE IS, and the fleet did not have it: DOES THE
// GAME BOOT? A shader that fails to compile takes the Renderer's
// constructor down with it, and a constructor that throws is a black
// page - no menu, no anything - while eslint, the node suite and a
// vite build all pass, because node never compiles GLSL.
//
// So this asks the one question every other probe assumes: the page
// loads, the menu's buttons exist, and nothing threw. It needs no
// ARENA2 - the boot door draws before any game data is touched, which
// is exactly why a break here is total.
//
//     npx vite --port 5199 &
//     node tools/bootProbe.mjs
import { chromium } from 'playwright';

const BASE = process.env.PROBE_BASE ?? 'http://127.0.0.1:5199';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

const browser = await chromium.launch();
for (const [label, skin] of [['enhanced', 'enhanced'], ['classic', 'classic']]) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // A 404 is not a throw. The classic skin fetches art it may not have
  // without ARENA2 and says so in the UI, which is the never-traps law
  // working - this probe is about the page DYING, not about missing
  // data, and folding the two together makes it cry wolf.
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/Failed to load resource|404/.test(t)) return;
    errors.push(t);
  });
  await page.goto(`${BASE}/play/?skin=${skin}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const body = (await page.evaluate(() => document.body.textContent)).trim();
  // main.js's catch REPLACES the body with this, so its presence is the
  // black screen itself rather than a hint of one.
  check(`${label}: the boot did not fail`, !body.includes('boot failed'), body.slice(0, 160));
  check(`${label}: the door drew its buttons`,
    await page.locator('#enhanced-menu button').count() > 0 || skin === 'classic');
  check(`${label}: nothing threw`, errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}
await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} checks passed`);
process.exit(bad.length ? 1 : 0);
