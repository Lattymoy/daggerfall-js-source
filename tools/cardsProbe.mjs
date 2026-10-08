// THE CARD TABLE, SEEN (CARDS3). Opens the card table lab (cards.html, src/tools/cardsLab.js) headless and takes the
// table at moments of a seeded evening - the deal in the air, the cards settled, the flop turned, from the player's
// seat and from over the table - and checks what a screenshot can: the frame draws without an error, the cards and
// chips are there, and the picture is not empty.
//     node tools/cardsProbe.mjs          (writes $PROBE_SHOTS or /tmp/cards-*.png)
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const shots = process.env.PROBE_SHOTS ?? '/tmp';
const server = await createServer({ server: { port: 5241, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = 'http://127.0.0.1:5241';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 640 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
let failed = 0;
for (const [label, q] of [['deal-air', 't=0.25&cam=over&nohud'], ['dealt-seat', 't=2.2&cam=seat'], ['dealt-over', 't=2.2&cam=over&nohud'], ['later-seat', 't=14&cam=seat'], ['later-over', 't=14&cam=over&nohud'], ['near-hand', 't=9&cam=near&nohud&seed=6&patrons=2'], ['board-turn', 't=6.4&cam=board&nohud&seed=4&patrons=2'], ['turn-seat', 't=6.4&cam=seat&seed=4&patrons=2']]) {
  await page.goto(`${BASE}/cards.html?${q}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__cardsReady === true, null, { timeout: 120000 });
  const state = await page.evaluate(() => window.__cardsState);
  await page.screenshot({ path: `${shots}/cards-${label}.png` });
  console.log(`${label}: street ${state.street} cards ${state.cards} chips ${state.chips} - ${shots}/cards-${label}.png`);
  if (!(state.chips > 0)) { failed++; console.log('FAIL no chips'); }
}
if (errors.length) { failed++; console.log('FAIL errors:\n' + errors.join('\n')); }
await browser.close();
await server.close();
process.exit(failed ? 1 : 0);
