// THE SITE'S PICTURES (U60c), taken by a tool so they can be retaken.
//
// Port-Doctrine: a render of game data is game data. So the only
// screens the site may show are the ones that draw with NO ARENA2 - the
// enhanced skin's own type-and-layout screens - and this tool is how
// that is guaranteed rather than trusted: it boots vite with no data
// folder, PROVES the dev server has none to give (the game's own data
// fetch must 404), and aborts if the folder pick ever appears. What it
// writes into public/site/ is the doctrine allow-list's business, one
// row per file, and test/landing.test.js checks the page shows nothing
// else.
//
// Three pictures:
//   menu-home.png       the PIXEL HOME (PX1): the wordmark over the
//                       dithered night, the centered list, the foot
//   menu-phone.png      the same home on a phone
//   menu-settings.png   the settings shell, desktop
//
// U63: the pack shot is gone. It was reachable only through a test seam
// (a hand-built entity, the doll forced to its no-art schematic), and
// with PX16's inventory it would need rebuilding on a new seam to show a
// screen the player cannot reach without game files anyway. Three
// pictures of screens that draw themselves is a truer set than four
// with one staged.
//
//     node tools/siteShots.mjs            (writes public/site/*.png)
import { createServer } from 'vite';
import { chromium, devices } from 'playwright';
import { mkdirSync, statSync } from 'node:fs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
delete process.env.ARENA2_PATH;
const OUT = 'public/site';
mkdirSync(OUT, { recursive: true });

const server = await createServer({ server: { port: 5233, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = 'http://127.0.0.1:5233';

// THE GUARD. If the dev server can serve one game file, these shots
// could carry game data, and nothing below may run.
const probe = await fetch(`${BASE}/play/arena2/ART_PAL.COL`);
if (probe.status !== 404) {
  await server.close();
  console.error(`ABORT: the dev server serves game data (${probe.status}) - unset ARENA2_PATH and remove the default folder`);
  process.exit(2);
}

const browser = await chromium.launch();
const written = [];

async function shot(name, page, opts = {}) {
  if (await page.locator('#pick').count()) throw new Error(`${name}: the folder pick is on screen - this is not a data-free shot`);
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path, ...opts });
  written.push([path, statSync(path).size]);
}

// 1. The pixel home, desktop. The face the game opens on.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/play/?skin=enhanced`, { waitUntil: 'load' });
  await page.waitForSelector('.px-menu button', { timeout: 20000 });
  await page.waitForTimeout(1200);   // the web fonts, and one tick of the sky
  await shot('menu-home', page);
  await ctx.close();
}

// 2. The same home on a phone.
{
  const ctx = await browser.newContext({ ...devices['Pixel 5'], deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/play/?skin=enhanced`, { waitUntil: 'load' });
  await page.waitForSelector('.px-menu button', { timeout: 20000 });
  await page.waitForTimeout(1200);
  await shot('menu-phone', page);
  await ctx.close();
}

// 3. Settings, desktop.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/play/?skin=enhanced`, { waitUntil: 'load' });
  await page.waitForSelector('.px-menu button', { timeout: 20000 });
  await page.locator('.px-menu button', { hasText: 'Settings' }).first().click();
  await page.waitForTimeout(1200);
  await shot('menu-settings', page);
  await ctx.close();
}

await browser.close();
await server.close();
for (const [path, size] of written) console.log(`${path}  ${(size / 1024).toFixed(0)} KB`);
