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
//   menu-settings.png   the enhanced menu's Settings pane, desktop
//   menu-phone.png      the enhanced menu on a phone - the rail in the
//                       thumb's arc, the New Game pane
//   pack-sample.png     the enhanced pack, desktop, with a SAMPLE
//                       character built through the test seam
//                       enhancedDollProbe uses: no game files means no
//                       real character, so the caption on the page says
//                       so. The doll is the real no-art schematic.
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

// 1. Settings, desktop.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/play/?skin=enhanced`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#enhanced-menu .railbtn', { timeout: 20000 });
  await page.locator('#enhanced-menu .railbtn', { hasText: 'Settings' }).first().click();
  await page.waitForSelector('#enhanced-menu .row');
  await page.waitForTimeout(600);   // the web fonts
  await shot('menu-settings', page);
  await ctx.close();
}

// 2. The menu on a phone.
{
  const ctx = await browser.newContext({ ...devices['Pixel 5'], deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/play/?skin=enhanced`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#enhanced-menu .railbtn', { timeout: 20000 });
  await page.locator('#enhanced-menu .railbtn', { hasText: 'New Game' }).first().click();
  await page.waitForTimeout(600);
  await shot('menu-phone', page);
  await ctx.close();
}

// 3. The pack, desktop, with a sample character. The route and the
//    seam are enhancedDollProbe's; the doll is left to the schematic.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/play/?skin=enhanced`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#enhanced-menu .railbtn', { timeout: 20000 });
  await page.locator('#enhanced-menu .railbtn', { hasText: 'New Game' }).first().click();
  await page.getByRole('button', { name: 'Begin', exact: true }).click();
  await page.waitForSelector('#enhanced-menu', { state: 'detached', timeout: 20000 });
  // The boot asks for the folder now; that overlay is the one thing
  // that must NOT be in the picture, so it is removed and the pack is
  // mounted on top of the bare page.
  await page.waitForSelector('#pick', { timeout: 20000 });
  await page.evaluate(() => document.querySelector('#dz')?.parentElement?.remove());   // ensureArena2's overlay: div > #dz > #pick
  await page.evaluate(async () => {
    const { createInventoryWindow } = await import('/src/ui/inventoryDoor.js');
    const { ITEM_TEMPLATES } = await import('/src/characters/paperdoll.js');
    const pd = await import('/src/ui/paperDoll.js');
    pd._setPaperDollPixelsForTests(null);   // no art: the schematic stands in
    const t = (n) => ITEM_TEMPLATES.find((x) => x.name === n);
    const mk = (n, group = 'Weapons') => {
      const tp = t(n);
      return tp && {
        name: tp.name, templateIndex: tp.index, group, stackCount: 1,
        currentCondition: tp.hitPoints ?? 50, maxCondition: tp.hitPoints ?? 50,
      };
    };
    const e = {
      name: 'Sample', career: { name: 'Spellsword' },
      stats: { strength: 50, endurance: 48 }, items: [],
    };
    e.items = [mk('Longsword'), mk('Dagger'), mk('Short Bow'), mk('Cuirass', 'Armor'), mk('Helm', 'Armor'),
      mk('Boots', 'Armor'), mk('Greaves', 'Armor'), mk('Gauntlets', 'Armor')].filter(Boolean);
    globalThis.__slot = createInventoryWindow({ entity: e, items: () => e.items, wagonItems: () => [] });
  });
  await page.waitForSelector('#enhanced-inventory .wornrow', { timeout: 20000 });
  // Dress the sample through the pack's own controls, as the doll probe
  // does, so the schematic lights its nodes and the worn list fills.
  for (const name of ['Cuirass', 'Helm', 'Boots', 'Greaves', 'Gauntlets', 'Longsword']) {
    await page.locator('#enhanced-inventory .packcol:not(.packremote) .itemrow', { hasText: name }).first().click();
    const wear = page.locator('#enhanced-inventory .acts button', { hasText: 'Wear' }).first();
    if (await wear.count()) await wear.click();
    const lid = page.locator('#enhanced-inventory .packdetail .sheet-close');
    if (await lid.isVisible()) await lid.click();
  }
  await page.waitForTimeout(600);
  await shot('pack-sample', page);
  await ctx.close();
}

await browser.close();
await server.close();
for (const [path, size] of written) console.log(`${path}  ${(size / 1024).toFixed(0)} KB`);
