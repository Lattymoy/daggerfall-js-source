// WALLET-UI (2026-10-07, Mac: "Polish and organize the ingame wallet item for ease of readability"), MEASURED: the real
// enhanced pack (ui/inventoryDoor.js - the door the game opens) over the real sheet in Chromium, a character carrying the
// wallet and everything it holds (test/wallet1.test.js's own pack: the purse's gold, two letters of credit, a stack of
// Deadlands Embers, the Welkynd Shards), its Valuables page opened and the Wallet picked - at a desktop's width and a
// phone's, with the account's silver counted and with it kept online. The sheet must stand inside the viewport with
// nothing spilling sideways, its figures in one column. Photographs to tools/shots/ (or SHOT_DIR).
//
//     node tools/walletProbe.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const OUT = process.env.SHOT_DIR ?? 'tools/shots';
mkdirSync(OUT, { recursive: true });
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); if (!ok) fails++; };
const server = await createServer({ server: { port: 5248, strictPort: true }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch({ headless: true });
const errors = [];

for (const [W, H, width] of [[1280, 800, 'desktop'], [390, 760, 'phone']]) for (const silver of ['counted', 'online']) {
  const tag = `${width} ${silver}`;
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', (e) => errors.push(String(e.message)));
  await page.goto('http://localhost:5248/play/?skin=enhanced&touch=off&nointro');
  await page.evaluate(async (silver) => {
    const { createInventoryWindow } = await import('/src/ui/inventoryDoor.js');
    const { mintWallet, setWalletSilver } = await import('/src/systems/walletItem.js');
    const { letterOfCredit } = await import('/src/systems/inventory.js');
    const { sigilStone, welkyndShards, portalStones } = await import('/src/systems/gateSpoils.js');
    document.getElementById('intro')?.remove();
    document.getElementById('enhanced-menu')?.remove();
    document.body.style.cssText = 'margin:0;background:#0b0d10;height:100vh';
    // online the marks book answers the silver; offline (or before it is struck) nothing counts it here
    setWalletSilver(silver === 'counted' ? () => 35 : null);
    const e = { name: 'Aelwyn', career: { name: 'Spellsword' }, stats: { strength: 50, endurance: 48 }, goldPieces: 1240, items: [] };
    e.items = [{ group: 'Weapons', templateIndex: 121, name: 'Katana' }, letterOfCredit(5000), Object.assign(sigilStone(), { stackCount: 12 }),
      mintWallet(), welkyndShards(40), letterOfCredit(7000), portalStones(3)];
    globalThis.__pack = createInventoryWindow({ entity: e, items: () => e.items, wagonItems: () => [] });
  }, silver);
  await page.waitForSelector('#enhanced-inventory .itemrow', { timeout: 20000 });
  await page.locator('#enhanced-inventory .packtab', { hasText: /valu/i }).first().click();
  await page.locator('#enhanced-inventory .packpage .itemrow, #enhanced-inventory .itemrow', { hasText: 'Wallet' }).first().click();
  await page.waitForSelector('#enhanced-inventory .walletsheet', { timeout: 10000 });
  await page.waitForTimeout(150);
  const r = await page.evaluate(() => {
    const sheet = document.querySelector('#enhanced-inventory .walletsheet');
    const card = sheet.closest('.packdetail') ?? sheet.parentElement;
    const box = sheet.getBoundingClientRect(), col = card.getBoundingClientRect();
    const spills = [];
    for (const n of sheet.querySelectorAll('*')) {
      const q = n.getBoundingClientRect();
      if (q.width === 0 && q.height === 0) continue;
      if (q.left < col.left - 0.5 || q.right > col.right + 0.5) spills.push(`${n.className}: ${Math.round(q.left)}..${Math.round(q.right)} of ${Math.round(col.left)}..${Math.round(col.right)}`);
    }
    const figures = [...sheet.querySelectorAll('.wallet-v')].map((v) => Math.round(v.getBoundingClientRect().right));
    return {
      inView: box.left >= -0.5 && box.right <= innerWidth + 0.5,
      spills, pageScroll: document.documentElement.scrollWidth > innerWidth,
      rows: [...sheet.querySelectorAll('.wallet-row')].map((row) => row.textContent),
      figuresAligned: figures.length > 1 && Math.max(...figures) - Math.min(...figures) <= 1,
      pieces: sheet.querySelectorAll('.walletpieces .itemrow').length,
    };
  });
  check(`${tag}: the sheet stands inside the viewport`, r.inView);
  check(`${tag}: nothing spills sideways`, r.spills.length === 0 && !r.pageScroll, r.spills.slice(0, 3).join('; '));
  check(`${tag}: a row for every currency`, r.rows.length >= 5, JSON.stringify(r.rows));
  check(`${tag}: the figures stand in one column`, r.figuresAligned);
  check(`${tag}: the pieces it holds, each a row of the pack's own`, r.pieces === 4, `${r.pieces}`);
  // the card scrolled to the sheet, the pointer off every tile (a tile's hover card is not the sheet), then photographed
  await page.evaluate(() => document.querySelector('#enhanced-inventory .walletsheet')?.scrollIntoView({ block: 'center' }));
  await page.mouse.move(2, H - 2);
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT}/wallet-${width}-${silver}.png` });
  await page.close();
}
check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
await server.close();
console.log(fails ? `\n${fails} FAILED` : '\nall checks passed');
process.exit(fails ? 1 : 0);
