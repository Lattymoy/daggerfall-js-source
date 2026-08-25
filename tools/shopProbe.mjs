// E2 probe: find a shop door in Daggerfall city, enter, E a shelf,
// and BUY - the browse window lists stocked goods with live prices,
// gold deducts, the item lands in the player entity.
import { createServer } from 'vite';
import { chromium } from 'playwright';
const SHOP_TYPES = new Set([0, 2, 5, 6, 7, 8, 9, 12, 13]);   // RMBLayout.IsShop
const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5199, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
// T2: `class=16` SKIPS THE CHARGEN WIZARD. Without it the wizard holds
// townTalk's overlay slot and townTalk.keydown - FIRST in this host's
// keydown ladder (exterior.js:1046-1047) - swallows every
// page.keyboard.press below, so this probe pressed its keys into a
// character-creation screen it never knew was up.
await page.goto('http://localhost:5199/?shot&play&exterior&time=12:00&class=16');
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 180000 });
await page.evaluate(() => {
  window.__playerEntity.items = window.__playerEntity.items ?? [];
  window.__playerEntity.items.push({ group: 'Currency', name: 'Gold pieces', stackCount: 20000 });
});
const doors = JSON.parse(await page.evaluate(() => JSON.stringify(window.__doors())));
let pick = null;
for (let i = 0; i < doors.length && !pick; i++) {
  const b = JSON.parse(await page.evaluate((j) => window.__buildingAt(j), i));
  if (b && SHOP_TYPES.has(b.buildingType)) pick = { i, b, door: doors[i] };
}
if (!pick) { console.log('NO SHOP DOOR'); process.exit(1); }
console.log('shop door:', pick.i, 'type', pick.b.buildingType, 'quality', pick.b.quality, JSON.stringify(pick.b.name ?? ''));
const { pos, normal } = pick.door;
// pos is the door CENTER - drop the feet so the eye ray crosses the box
await page.evaluate(([x, y, z, yaw]) => window.__pose(x, y, z, yaw, -0.05),
  [pos[0] + normal[0] * 1.5, pos[1] - 1.2, pos[2] + normal[2] * 1.5, Math.atan2(-normal[0], -normal[2])]);
const entered = await page.evaluate(() => window.__enter());
console.log('entered:', entered);
if (!entered) { console.log('ENTER FAILED'); process.exit(1); }
const waitFrames = async (n) => {
  const f = await page.evaluate(() => window.__frame);
  await page.waitForFunction(([f0, k]) => window.__frame > f0 + k, [f, n], { timeout: 60000 });
};
await waitFrames(6);
const sh = JSON.parse(await page.evaluate(() => window.__shelves()));
console.log('interior:', JSON.stringify({ name: sh.building?.name, type: sh.building?.buildingType, quality: sh.building?.quality, shelves: sh.shelves.length }));
if (!sh.shelves.length) { console.log('NO SHELVES IN THIS SHOP'); process.exit(1); }
const overlay = JSON.parse(await page.evaluate(() => window.__openShelf(0)));
console.log('browse:', JSON.stringify(overlay));
if (!overlay) { console.log('NO BROWSE WINDOW'); process.exit(1); }
await waitFrames(3);
await page.screenshot({ path: '/home/claude/shop-browse.png' });
const goldBefore = await page.evaluate(() => window.__playerEntity.items.find((i) => i.group === 'Currency')?.stackCount ?? 0);
const itemsBefore = await page.evaluate(() => window.__playerEntity.items.length);
if (overlay.options.some((o) => o.startsWith('1 -'))) {
  const press = async (code) => { await page.keyboard.down(code); await waitFrames(3); await page.keyboard.up(code); await waitFrames(2); };
  await press('Digit1');
  const after = JSON.parse(await page.evaluate(() => window.__shopOverlay()));
  const goldAfter = await page.evaluate(() => window.__playerEntity.items.find((i) => i.group === 'Currency')?.stackCount ?? 0);
  const itemsAfter = await page.evaluate(() => window.__playerEntity.items.length);
  console.log('after buy:', JSON.stringify(after), 'gold', goldBefore, '->', goldAfter, 'items', itemsBefore, '->', itemsAfter);
  if (!(goldAfter < goldBefore && itemsAfter > itemsBefore)) { console.log('BUY FAILED'); process.exit(1); }
  await page.screenshot({ path: '/home/claude/shop-bought.png' });
  // E3: sell the bought item straight back - S opens the sell list
  await press('KeyS');
  const sellList = JSON.parse(await page.evaluate(() => window.__shopOverlay()));
  console.log('sell list:', JSON.stringify(sellList));
  if (!sellList?.options?.some((o) => o.startsWith('1 -'))) { console.log('NO SELLABLE LISTED'); process.exit(1); }
  await press('Digit1');
  const goldSold = await page.evaluate(() => window.__playerEntity.items.find((i) => i.group === 'Currency')?.stackCount ?? 0);
  const itemsSold = await page.evaluate(() => window.__playerEntity.items.length);
  console.log('after sell: gold', goldAfter, '->', goldSold, 'items', itemsAfter, '->', itemsSold);
  if (!(goldSold > goldAfter && itemsSold < itemsAfter)) { console.log('SELL FAILED'); process.exit(1); }
  await page.screenshot({ path: '/home/claude/shop-sold.png' });
} else {
  console.log('empty shelf - stock rolled nothing (valid); the window rendered');
}
console.log('SHOP OK');
await browser.close(); await server.close();
