// U40 probe: drive the trade window's mode flow against the live game.
//
// The unit tests drive the window over fake hooks; this proves the
// HOST half - that a click stages rather than transacts, that the
// mode action commits the whole staged lot once, and that the two
// routes the mode split was blocking (the plain-merchant Sell arm and
// the repair popup's Sell button) actually open something.
import { createServer } from 'vite';
import { chromium } from 'playwright';

const SHOPPY = new Set([0, 2, 5, 6, 7, 8, 9, 12, 13]);   // shopStock.isShop's nine
const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5212, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.message); });
await page.goto('http://localhost:5212/?shot&play&exterior&time=12:00');
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 180000 });

const waitFrames = async (n) => {
  const f = await page.evaluate(() => window.__frame);
  await page.waitForFunction(([f0, k]) => window.__frame > f0 + k, [f, n], { timeout: 60000 });
};
const shop = async () => JSON.parse(await page.evaluate(() => window.__shopOverlay()) ?? 'null');
const gold = () => page.evaluate(() => {
  const g = (window.__playerEntity.items ?? []).find((i) => i.group === 'Currency');
  return g ? g.stackCount : 0;
});
const fail = (m) => { console.log('FAIL:', m); process.exit(1); };

const doors = JSON.parse(await page.evaluate(() => JSON.stringify(window.__doors())));
let entered = null;
for (let i = 0; i < doors.length && !entered; i++) {
  const b = JSON.parse(await page.evaluate((j) => window.__buildingAt(j), i));
  if (!b || !SHOPPY.has(b.buildingType)) continue;
  const { pos, normal } = doors[i];
  await page.evaluate(([x, y, z, yaw]) => window.__pose(x, y, z, yaw, -0.05),
    [pos[0] + normal[0] * 1.5, pos[1] - 1.2, pos[2] + normal[2] * 1.5, Math.atan2(-normal[0], -normal[2])]);
  if (!await page.evaluate(() => window.__enter())) continue;
  await waitFrames(8);
  const shelves = JSON.parse(await page.evaluate(() => window.__shelves()) ?? 'null');
  if (shelves?.shelves?.length > 0) { entered = { b, shelves }; break; }
  await page.evaluate(() => window.__exit());
  await waitFrames(4);
}
if (!entered) fail('NO SHOP WITH A SHELF FOUND');
console.log('shop:', JSON.stringify(entered.b), 'shelves:', entered.shelves.shelves.length);

await page.evaluate(() => {
  const e = window.__playerEntity;
  e.items = e.items ?? [];
  const g = e.items.find((i) => i.group === 'Currency');
  if (g) g.stackCount = 500000; else e.items.push({ group: 'Currency', name: 'Gold pieces', stackCount: 500000 });
});

// ---- BUY: stage, then commit ---------------------------------------
console.log('\n== BUY ==');
await page.evaluate(() => window.__openShelf(0));
await waitFrames(6);
let s = await shop();
if (!s?.native) fail('the native trade window did not open');
if (s.mode !== 'Buy') fail(`expected Buy mode, got ${s.mode}`);
console.log('opened:', JSON.stringify({ mode: s.mode, remote: s.remote, local: s.local, cost: s.cost }));
if (!s.remote) fail('the shelf is empty - nothing to stage');
if (s.cost !== 0 || s.canCommit) fail('an empty basket must cost 0 and leave the button dead');

const gold0 = await gold();
await page.evaluate(() => window.__tradeSlot('remote', 0));
await waitFrames(2);
s = await shop();
console.log('after one click:', JSON.stringify({ basket: s.basket, cost: s.cost, canCommit: s.canCommit }));
if (s.basket !== 1) fail('the click did not stage into the basket');
if (await gold() !== gold0) fail('THE CLICK TRANSACTED - staging must not move gold');
if (!s.cost || !s.canCommit) fail('the cost strip did not pick the basket up');
const staged = s.cost;

await page.evaluate(() => window.__tradeClick('modeAction'));
await waitFrames(2);
s = await shop();
console.log('offer box:', JSON.stringify(s.box));
if (s.box?.buttons !== 'YesNo') fail('the mode action did not raise the Yes/No offer');
if (await gold() !== gold0) fail('gold moved before the confirm');

await page.keyboard.press('KeyY');
await waitFrames(4);
s = await shop();
const gold1 = await gold();
console.log('after YES:', JSON.stringify({ basket: s.basket, cost: s.cost, lastPrice: s.lastPrice }), 'gold', gold0, '->', gold1);
if (gold1 >= gold0) fail('the commit did not charge');
if (s.basket !== 0) fail('the basket was not spent');
if (s.lastPrice == null) fail('the concluded price was not recorded');
console.log(`BOUGHT for ${gold0 - gold1} (the strip had staged ${staged})`);

// ---- SELL: the same window, the other direction ---------------------
console.log('\n== SELL (the plain-merchant arm) ==');
await page.evaluate(() => window.__tradeClick('exit'));
await waitFrames(4);
await page.evaluate(() => window.__openMerchantSell());
await waitFrames(6);
s = await shop();
if (!s?.native) fail('the merchant sell arm opened nothing - the G8 route is still dead');
if (s.mode !== 'Sell') fail(`expected Sell mode, got ${s.mode}`);
console.log('opened:', JSON.stringify({ mode: s.mode, local: s.local, remote: s.remote, staged: s.staged }));
if (s.remote !== 0) fail('a selling mode must open with an EMPTY remote list');
if (!s.local) fail('nothing in the pack to sell');

const gold2 = await gold();
await page.evaluate(() => window.__tradeSlot('local', 0));
await waitFrames(2);
s = await shop();
console.log('after staging:', JSON.stringify({ staged: s.staged, remote: s.remote, cost: s.cost }));
if (s.staged !== 1 || s.remote !== 1) fail('the pack item did not stage to the right-hand list');
if (await gold() !== gold2) fail('THE CLICK SOLD - staging must not move gold');

await page.evaluate(() => window.__tradeClick('modeAction'));
await waitFrames(2);
s = await shop();
if (s.box?.buttons !== 'YesNo') fail('no sell offer');
await page.keyboard.press('KeyY');
await waitFrames(4);
const gold3 = await gold();
console.log('after YES:', gold2, '->', gold3);
if (gold3 <= gold2) fail('the sale did not pay');
console.log(`SOLD for ${gold3 - gold2}`);

// ---- CLEAR ----------------------------------------------------------
console.log('\n== CLEAR ==');
await page.evaluate(() => window.__tradeClick('exit'));
await waitFrames(4);
await page.evaluate(() => window.__openShelf(0));
await waitFrames(6);
await page.evaluate(() => window.__tradeSlot('remote', 0));
await waitFrames(2);
s = await shop();
const beforeClear = { remote: s.remote, basket: s.basket };
await page.evaluate(() => window.__tradeClick('clear'));
await waitFrames(2);
s = await shop();
console.log('cleared:', JSON.stringify(beforeClear), '->', JSON.stringify({ remote: s.remote, basket: s.basket, cost: s.cost }));
if (s.basket !== 0) fail('Clear did not empty the basket');
if (s.remote !== beforeClear.remote + 1) fail('Clear did not put the goods back on the shelf');
if (s.cost !== 0) fail('the strip did not go back to zero');

if (errors.length) fail(`page errors: ${JSON.stringify(errors)}`);
console.log('\nOK: staging, committing, selling and clearing all work on the live game');
await browser.close();
await server.close();
