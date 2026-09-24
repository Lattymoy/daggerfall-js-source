// OVH1/OVH2 - THE OVERHAULS PANE, in a real browser, WITH NO ARENA2. What the suite cannot say: the three cards stand
// side by side at a desktop and stack on a phone with nothing spilling sideways; the arrows browse without wearing; a
// look worn from its button reads back as the card's look in use; a mix made on Features reads "Custom"; GrimoireUI's
// card shows the pack's own art (the file served, the picture decoded); and wearing GrimoireUI reloads onto the
// classic skin with the pack on the shelf, the card saying so.
//
//     node tools/overhaulsProbe.mjs          (stands its own dev server; SHOT_DIR for the pictures)
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const OUT = process.env.SHOT_DIR ?? 'tools/shots';
mkdirSync(OUT, { recursive: true });
let fails = 0, checks = 0;
const check = (name, ok, detail = '') => { checks++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); if (!ok) fails++; };
const server = await createServer({ server: { port: 5241, strictPort: true }, logLevel: 'silent' });
await server.listen();
const BASE = 'http://localhost:5241';
const browser = await chromium.launch({ headless: true });
const errors = [];

const open = async (page) => {
  await page.goto(`${BASE}/play/?nointro`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.px-menu button', { timeout: 20000 });
  await closeAccount(page);
  await page.locator('.px-menu .door-overhauls').click();
  await page.waitForSelector('#enhanced-menu .look-panel', { timeout: 10000 });
};
/** The first-run account prompt stands over the doors on a fresh profile - put it away. */
async function closeAccount(page) {
  const close = page.locator('.px-acctstage button', { hasText: /^close$/i });
  if (await close.count()) { await close.first().click(); await page.waitForTimeout(100); }
}
const cards = (page) => page.$$eval('#enhanced-menu .look-panel', (cs) => cs.map((c) => ({
  panel: c.dataset.panel, state: c.dataset.state, name: c.querySelector('.look-name')?.textContent,
  use: c.querySelector('.look-use')?.textContent, disabled: c.querySelector('.look-use')?.disabled,
  box: (({ left, right, top, width }) => ({ left, right, top, width }))(c.getBoundingClientRect()),
})));
const spills = (page) => page.evaluate(() => {
  const out = [];
  for (const n of document.querySelectorAll('#enhanced-menu .look-panel, #enhanced-menu .look-panel *')) {
    const q = n.getBoundingClientRect();
    if (q.width && (q.right > innerWidth + 0.5 || q.left < -0.5)) out.push(`${n.className} ${Math.round(q.left)}-${Math.round(q.right)}`);
  }
  return out;
});

// ── the desktop: three across ─────────────────────────────────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  let cs = await cards(page);
  check('three cards: Texture, Sound, UI', cs.map((c) => c.panel).join('|') === 'texture|sound|ui', cs.map((c) => c.panel).join('|'));
  check('...side by side at a desktop', new Set(cs.map((c) => Math.round(c.box.top))).size === 1 && cs[0].box.right <= cs[1].box.left, JSON.stringify(cs.map((c) => c.box)));
  check('the Texture card stands empty - no texture pack ships yet', cs[0].state === 'empty' && !cs[0].name && !cs[0].use && (await page.locator('.look-panel[data-panel="texture"] .look-emptyline', { hasText: 'No texture packs yet.' }).count()) === 1, JSON.stringify(cs[0]));
  check('a fresh shelf wears Enhanced on Sound and UI', cs.slice(1).every((c) => c.state === 'on' && c.name === 'Enhanced' && c.disabled), JSON.stringify(cs.map((c) => [c.state, c.name])));
  check('no lead paragraph over the cards', (await page.locator('#enhanced-menu .body > p').count()) === 0);
  await page.screenshot({ path: `${OUT}/look-desktop.png` });

  // the arrows BROWSE - nothing is worn by them
  await page.locator('.look-panel[data-panel="sound"] .look-arrow').first().click(); await page.waitForTimeout(80);
  cs = await cards(page);
  const snd = cs.find((c) => c.panel === 'sound');
  const pref = () => page.evaluate(async () => (await import('/src/systems/uiPrefs.js')).getPref('soundEnhancements'));
  check('an arrow browses to Classic without wearing it', snd.name === 'Classic' && snd.state === 'browse' && snd.use === 'Use Classic' && (await pref()) === true, JSON.stringify(snd));
  // the button WEARS it: both rows it covers move, and the card reads it back
  await page.locator('.look-panel[data-panel="sound"] .look-use').click(); await page.waitForTimeout(120);
  const wrote = await page.evaluate(async () => ({ sounds: (await import('/src/systems/uiPrefs.js')).getPref('soundEnhancements'), steps: (await import('/src/systems/modSettings.js')).modSetting('immersive-footsteps', 'Enabled') }));
  cs = await cards(page);
  check('Use Classic wears it: the port\'s sounds and Immersive Footsteps off', wrote.sounds === false && wrote.steps === false, JSON.stringify(wrote));
  check('...and the card reads Classic in use', cs.find((c) => c.panel === 'sound').state === 'on' && cs.find((c) => c.panel === 'sound').name === 'Classic');
  // a mix of the player's own reads Custom
  await page.evaluate(async () => (await import('/src/systems/uiPrefs.js')).setPref('soundEnhancements', true));
  await page.locator('#enhanced-menu .railbtn', { hasText: 'Features' }).click(); await page.waitForTimeout(80);
  await page.locator('#enhanced-menu .railbtn', { hasText: 'Overhauls' }).click(); await page.waitForTimeout(80);
  cs = await cards(page);
  check('one row turned back on Features: the Sound card reads Custom', cs.find((c) => c.panel === 'sound').state === 'custom' && (await page.locator('.look-panel[data-panel="sound"] .look-note', { hasText: 'Custom' }).count()) === 1);
  await page.evaluate(async () => { (await import('/src/systems/uiPrefs.js')).setPref('soundEnhancements', true); (await import('/src/systems/modSettings.js')).setModSetting('immersive-footsteps', 'Enabled', true); });

  // GrimoireUI's card: the pack's own art, served and decoded
  await page.locator('.look-panel[data-panel="ui"] .look-arrow').last().click(); await page.waitForTimeout(300);   // Enhanced -> GrimoireUI
  const g = await page.$eval('.look-panel[data-panel="ui"]', (c) => ({ name: c.querySelector('.look-name').textContent, by: c.querySelector('.look-by').textContent, img: c.querySelector('.look-pic img')?.naturalWidth ?? 0 }));
  check('the UI card browses to GrimoireUI with its author', g.name === 'GrimoireUI' && /LordSquacquerone/.test(g.by), JSON.stringify(g));
  check('...and shows the pack\'s own inventory, 960 wide', g.img === 960, `${g.img}`);
  await page.screenshot({ path: `${OUT}/look-desktop-grimoire.png` });
  // the keyboard browses too
  const was = (await cards(page)).find((c) => c.panel === 'sound').name;
  await page.locator('.look-panel[data-panel="sound"]').focus();
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(80);
  const now = (await cards(page)).find((c) => c.panel === 'sound').name;
  check('ArrowRight on a focused card browses it', now !== was && ['Classic', 'Enhanced'].includes(now), `${was} -> ${now}`);

  // wearing GrimoireUI reloads onto the classic skin with the pack on the shelf
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }), page.locator('.look-panel[data-panel="ui"] .look-use').click()]);
  const worn = await page.evaluate(async () => ({ skin: (await import('/src/systems/uiSkin.js')).uiSkin(), pack: (await import('/src/systems/uiPack.js')).activeUiPack()?.id ?? null, url: location.search }));
  check('Use GrimoireUI reloads onto the classic skin wearing the pack', worn.skin === 'classic' && worn.pack === 'grimoire' && !/skin|uipack/.test(worn.url), JSON.stringify(worn));
  await page.waitForSelector('.px-menu button', { timeout: 20000 });
  await closeAccount(page);
  check('...the classic rail carries Overhauls too', (await page.locator('.px-menu .door-overhauls').count()) === 1);
  await page.locator('.px-menu .door-overhauls').click();
  await page.waitForSelector('#enhanced-menu .look-panel');
  cs = await cards(page);
  check('...and the UI card reads GrimoireUI in use', cs.find((c) => c.panel === 'ui').state === 'on' && cs.find((c) => c.panel === 'ui').name === 'GrimoireUI', JSON.stringify(cs.find((c) => c.panel === 'ui')));
  // and back to Enhanced (GrimoireUI -> Enhanced is one step back)
  await page.locator('.look-panel[data-panel="ui"] .look-arrow').first().click(); await page.waitForTimeout(80);
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle' }), page.locator('.look-panel[data-panel="ui"] .look-use').click()]);
  check('Use Enhanced reloads onto the enhanced skin', (await page.evaluate(async () => (await import('/src/systems/uiSkin.js')).uiSkin())) === 'enhanced');
  await ctx.close();
}

// ── a phone: one column, nothing sideways ─────────────────────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 760 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  const cs = await cards(page);
  check('a phone stacks the cards in one column', cs[1].box.top > cs[0].box.top && cs[2].box.top > cs[1].box.top, JSON.stringify(cs.map((c) => Math.round(c.box.top))));
  const sp = await spills(page);
  check('...with nothing spilling sideways', sp.length === 0, sp.slice(0, 5).join(' | '));
  const arrow = await page.$eval('.look-arrow', (b) => b.getBoundingClientRect().height);
  check('...and a finger\'s 44px arrow', arrow >= 44, `${arrow}`);
  await page.screenshot({ path: `${OUT}/look-phone.png`, fullPage: true });
  await ctx.close();
}

check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
await server.close();
console.log(`\n${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);
