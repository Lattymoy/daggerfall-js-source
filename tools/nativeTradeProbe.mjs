// U8c probe: the NATIVE trade screen - enter a shop, E a shelf,
// and BUY + SELL by CLICKING the classic item lists (INVE00I0 +
// TRAD00I0 + SHOP00I0 with real item icons).
// U10: ?class=16 is the HEADLESS chargen skip. S3c put the chargen
// overlay on a fresh town boot and wedged this probe too - AUDIT 17f
// found three of the six, this is the rest.
import { createServer } from 'vite';
import { chromium } from 'playwright';
const SHOP_TYPES = new Set([0, 2, 5, 6, 7, 8, 9, 12, 13]);
const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5199, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5199/?shot&play&exterior&time=12:00&class=16');
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 180000 });
await page.evaluate(() => {
  window.__playerEntity.items = window.__playerEntity.items ?? [];
  // U10 / TEST THE SHAPE THE PRODUCER MINTS: this pushed a hand-built
  // Currency literal with no templateIndex. Since AUDIT 17f gold is
  // Currency.Gold_pieces (276) and stacksWith compares the template,
  // so the literal no longer MERGED with the starting kit's stack -
  // it sat behind it as a second pile goldAmount never reached, and
  // the buy was refused for lack of funds. Add gold the way the game
  // does.
  window.__addGold(20000);
});
const doors = JSON.parse(await page.evaluate(() => JSON.stringify(window.__doors())));
let pick = null;
for (let i = 0; i < doors.length && !pick; i++) {
  const b = JSON.parse(await page.evaluate((j) => window.__buildingAt(j), i));
  if (b && SHOP_TYPES.has(b.buildingType)) pick = { i, b, door: doors[i] };
}
if (!pick) { console.log('NO SHOP DOOR'); process.exit(1); }
console.log('shop:', JSON.stringify(pick.b.name ?? ''), 'type', pick.b.buildingType, 'q', pick.b.quality);
const { pos, normal } = pick.door;
await page.evaluate(([x, y, z, yaw]) => window.__pose(x, y, z, yaw, -0.05),
  [pos[0] + normal[0] * 1.5, pos[1] - 1.2, pos[2] + normal[2] * 1.5, Math.atan2(-normal[0], -normal[2])]);
if (!await page.evaluate(() => window.__enter())) { console.log('ENTER FAILED'); process.exit(1); }
const waitFrames = async (n) => {
  const f = await page.evaluate(() => window.__frame);
  await page.waitForFunction(([f0, k]) => window.__frame > f0 + k, [f, n], { timeout: 60000 });
};
await waitFrames(6);
let o = JSON.parse(await page.evaluate(() => window.__openShelf(0)));
console.log('opened:', JSON.stringify(o));
if (!o?.native) { console.log('NOT THE NATIVE TRADE SCREEN'); process.exit(1); }
await waitFrames(12);   // icons warm async
await page.screenshot({ path: '/home/claude/trade-native.png' });
const S = 4, OX = 60, OY = 50;
const click = async (vx, vy) => { await page.mouse.click(OX + vx * S, OY + vy * S); await waitFrames(3); };
const gold = () => page.evaluate(() => window.__playerEntity.items.find((i) => i.group === 'Currency')?.stackCount ?? 0);
const g0 = await gold();
if (o.remote > 0) {
  await click(290, 68);   // remote slot 0 (below the scroll band)
  o = JSON.parse(await page.evaluate(() => window.__shopOverlay()));
  // STAGE, THEN COMMIT. This probe asserted that ONE click took the
  // gold, and had been failing quietly ever since the basket landed
  // (nativeTrade.js:13 - "a click STAGES an item and the MODE ACTION
  // button commits the lot"). It read `basket:1, cost:4426,
  // canCommit:true, gold unchanged` and called the game broken. Found
  // by V4's playthrough probe, which had inherited the same wrong
  // model and was corrected against the screenshot.
  console.log('after the stage click:', JSON.stringify(o));
  if (!(o.basket > 0 && o.cost > 0 && o.canCommit)) { console.log('STAGE CLICK FAILED'); process.exit(1); }
  await click(226 + 15, 134 + 7);   // TRADE_RECTS.modeAction - the BUY button
  // ...and BUY raises the merchant's HAGGLE OFFER, a Yes/No box
  // ("I can sell for no less than N gold pieces") - ShowTradePopup's
  // three bands, ported at systems/tradeModes.js:280. So a purchase is
  // THREE gestures: stage, ask, agree.
  o = JSON.parse(await page.evaluate(() => window.__shopOverlay()));
  if (!(o.box?.buttons === 'YesNo')) { console.log('NO HAGGLE OFFER', JSON.stringify(o.box)); process.exit(1); }
  console.log('the offer:', o.box.rows.join(' '));
  await page.keyboard.press('y');
  await waitFrames(4);
  o = JSON.parse(await page.evaluate(() => window.__shopOverlay()));
  const g1 = await gold();
  console.log('after BUY:', JSON.stringify(o), 'gold', g0, '->', g1);
  if (!(g1 < g0)) { console.log('BUY COMMIT FAILED'); process.exit(1); }
  await waitFrames(8);
  await page.screenshot({ path: '/home/claude/trade-native-bought.png' });
  // THE SELL HALF NEEDS THE SELL WINDOW. In Buy mode a click on the
  // LOCAL list unstages a basket item back onto the shelf
  // (nativeTrade.js:197) - it does not sell, and this probe used to
  // assert that it did. Selling is its own mode, opened the way the
  // merchant's own offer opens it.
  o = JSON.parse(await page.evaluate(() => window.__openMerchantSell()));
  await waitFrames(8);
  console.log('sell window:', JSON.stringify(o));
  if (o?.mode !== 'Sell') { console.log('SELL MODE DID NOT OPEN'); process.exit(1); }
  if (o.local > 0) {
    await click(192, 68);   // local slot 0 -> stage it for sale
    o = JSON.parse(await page.evaluate(() => window.__shopOverlay()));
    console.log('after the stage click:', JSON.stringify(o));
    if (!(o.staged > 0 && o.cost > 0)) { console.log('SELL STAGE FAILED'); process.exit(1); }
    await click(226 + 15, 134 + 7);   // the mode action - now SELL
    o = JSON.parse(await page.evaluate(() => window.__shopOverlay()));
    if (o.box?.buttons === 'YesNo') { await page.keyboard.press('y'); await waitFrames(4); }
    o = JSON.parse(await page.evaluate(() => window.__shopOverlay()));
    const g2 = await gold();
    console.log('after SELL:', JSON.stringify(o), 'gold', g1, '->', g2);
    if (!(g2 > g1)) { console.log('SELL COMMIT FAILED'); process.exit(1); }
  }
} else {
  console.log('empty shelf (valid stock roll) - the screen rendered');
}
await click(241, 188);   // exit
o = JSON.parse(await page.evaluate(() => window.__shopOverlay()));
console.log('after exit:', o);
if (o) { console.log('DID NOT CLOSE'); process.exit(1); }
console.log('NATIVE TRADE OK');
await browser.close(); await server.close();
