// H3 probe: the two deeds, sold in a live bank.
//
// The laws are unit-pinned; what only a live run can show is that the
// three host producers see anything at all. All three shipped as
// literals - `houseSellPrice: () => 0`, `ownsShip: () => false`,
// `isPortTown: () => false` - so the bank drew a Sell House button
// that offered nothing and a Buy Ship that could never be in a port,
// and no test noticed because there was nothing to test.
//
// Run: ARENA2_PATH=/path/to/arena2 node tools/deedProbe.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';

const PORT = 5241;
const server = await createServer({
  root: '/home/user/project-dagger',
  server: { port: PORT, strictPort: true, hmr: false, watch: null },
});
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const pageErrors = [];
const notes = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') notes.push(m.text()); });

const out = { failures: [] };
const check = (name, ok, detail) => {
  if (!ok) out.failures.push(name);
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail !== undefined ? `  ${JSON.stringify(detail)}` : ''}`);
};
const waitFrames = async (n) => {
  const f = await page.evaluate(() => window.__frame);
  await page.waitForFunction(([f0, k]) => window.__frame > f0 + k, [f, n], { timeout: 60000 });
};

// class=16 skips the chargen wizard (T2's rule).
await page.goto(`http://localhost:${PORT}/?world&shot&play&class=16&novideo`);
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 300000 });
await waitFrames(4);

const bank = async () => JSON.parse(await page.evaluate(() => window.__bankOverlay()) ?? 'null');

// A house to own. The market list is the host's own, so the probe
// takes the first one on it rather than inventing a key.
const market = JSON.parse(await page.evaluate(() => JSON.stringify(window.__housesForSale?.() ?? [])) ?? '[]');
check('the town has houses on the market', market.length > 0, { onMarket: market.length, first: market[0]?.buildingKey });
if (!market.length) {
  console.log('\nH3 PROBE: no market in this town - nothing to sell');
  await browser.close(); await server.close(); process.exit(1);
}
const key = market[0].buildingKey;
const bought = await page.evaluate(([k, r]) => window.__ownHouse?.(k, r) ?? false, [key, market[0].regionIndex ?? 0]);
check('the deed is written', bought === true, { buildingKey: key });

const open1 = await page.evaluate(() => window.__openBank()) && await bank();
check('the bank opens', !!open1?.bank);
// THE POINT OF THE LANE: a real price, measured off the owned house's
// own mesh radius, where the producer used to answer 0.
check('the sell price is REAL, not the stubbed zero',
  (open1?.deeds?.houseSellPrice ?? 0) > 0, open1?.deeds);
const price = open1.deeds.houseSellPrice;

// SELL IT. The offer is a Yes/No box and Yes has to do the deed.
const accountBefore = open1.deeds.accountGold;
await page.evaluate(() => window.__bankClick('sellHouse'));
await waitFrames(2);
const offered = await bank();
check('the Sell House button raises a Yes/No offer', offered?.box?.buttons === 'YesNo',
  { box: offered?.box?.rows?.slice(0, 2) });
// ...and the window's own keyboard answers it. A real keypress does
// not reach interiorOverlay from the world host unless the player is
// inside a building, which is why this goes through the window.
await page.evaluate(() => window.__bankKey('KeyY'));
await waitFrames(3);
const sold = await bank();
// ASSERT THE TRANSITION, not the end state: the first draft checked
// `ownsHouse === false` after a run where it had been false all
// along, and passed without a sale happening.
check('...and taking it sells the house',
  open1.deeds.ownsHouse === true && sold?.deeds?.ownsHouse === false,
  { owned: open1.deeds.ownsHouse, after: sold?.deeds?.ownsHouse });
// A DEED IS PAID INTO THE BANK, not into the purse (:458).
check('the price landed in the ACCOUNT, not the purse',
  (sold?.deeds?.accountGold ?? 0) === accountBefore + price,
  { before: accountBefore, after: sold?.deeds?.accountGold, price });

// THE SHIP. Ownership was a literal false; the sell price rides the
// same table the unit pins cover, so what matters live is that the
// window can now see a ship at all.
await page.evaluate(() => { window.__playerEntity.ownedShip = 1; });   // Large
await waitFrames(2);
const withShip = await bank();
check('the window sees an owned ship', withShip?.deeds?.ownsShip === true && withShip?.deeds?.ownedShip === 1,
  withShip?.deeds);
const accountBeforeShip = withShip.deeds.accountGold;
await page.evaluate(() => window.__bankClick('sellShip'));
await waitFrames(2);
const shipOffer = await bank();
check('the Sell Ship button raises its offer', shipOffer?.box?.buttons === 'YesNo',
  { box: shipOffer?.box?.rows?.slice(0, 2) });
await page.evaluate(() => window.__bankKey('KeyY'));
await waitFrames(3);
const shipSold = await bank();
check('...and taking it sells the ship for 85% of 200000',
  shipSold?.deeds?.ownsShip === false
  && (shipSold?.deeds?.accountGold ?? 0) === accountBeforeShip + 170000,
  { ownsShip: shipSold?.deeds?.ownsShip, before: accountBeforeShip, after: shipSold?.deeds?.accountGold });

if (notes.length) console.log(`  [note] ${notes.length} handled console line(s)`);
check('zero UNCAUGHT page errors', pageErrors.length === 0, { errors: pageErrors.slice(0, 3) });
console.log(`\n${'='.repeat(49)}`);
console.log(out.failures.length ? `H3 PROBE: ${out.failures.length} FAILED` : 'H3 PROBE: all green');
await browser.close();
await server.close();
process.exit(out.failures.length ? 1 : 0);
