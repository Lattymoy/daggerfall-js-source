// U8d probe: F6 in the exterior host opens the CLASSIC inventory -
// INVE00I0.IMG with the INVE01I0 selected-state highlights, the tab
// filter, and the shared ItemListScroller (icons + stack counts).
// AUDIT 17f: ?class=16 is the HEADLESS chargen skip. S3c put the
// chargen overlay on a fresh town boot, which silently wedged this
// probe (the overlay ate every key and Escape does not dismiss it) -
// and the exterior hosts had no skip at all until 17f wired one.
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5199, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5199/?shot&play&exterior&time=12:00&class=16');
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 180000 });
const waitFrames = async (n) => {
  const f = await page.evaluate(() => window.__frame);
  await page.waitForFunction(([f0, k]) => window.__frame > f0 + k, [f, n], { timeout: 60000 });
};
const press = async (code) => { await page.keyboard.down(code); await waitFrames(3); await page.keyboard.up(code); await waitFrames(2); };
// the probe bag: one per tab + a stack (the FONT0004 label)
await page.evaluate(() => {
  window.__playerEntity.items = [
    { group: 'Weapons', templateIndex: 113, name: 'Dagger', material: 0 },
    { group: 'Armor', templateIndex: 103, name: 'Buckler', material: 0 },
    { group: 'Books', templateIndex: 277, name: 'Book', stackCount: 3 },
    { group: 'PlantIngredients1', templateIndex: 0, name: 'Twigs' },
  ];
});
await press('F6');
const t = JSON.parse(await page.evaluate(() => window.__talk()));
console.log('overlay:', t.overlay);
if (!t.overlay) { console.log('INVENTORY DID NOT OPEN'); process.exit(1); }
await waitFrames(6);   // icon warm (getTexture + uploadRecord round trip)
await page.screenshot({ path: '/home/claude/inventory-weapons.png' });
// click the Clothing & Misc tab (163,0,91,10 -> center 208,5; s4 ox60 oy50)
const S = 4, OX = 60, OY = 50;
const click = async (vx, vy) => { await page.mouse.click(OX + vx * S, OY + vy * S); await waitFrames(3); };
await click(208, 5);
await waitFrames(6);
await page.screenshot({ path: '/home/claude/inventory-clothing.png' });
// info mode (226,36) then slot 0 of the local list -> the interim popup
await click(241, 43);
await click(163 + 9 + 25, 48 + 19);
await page.screenshot({ path: '/home/claude/inventory-info.png' });
// popup clears on the next click; Escape closes the window
await click(160, 100);
await press('Escape');
const closed = JSON.parse(await page.evaluate(() => window.__talk()));
console.log('after Escape, overlay:', closed.overlay);
if (closed.overlay) { console.log('INVENTORY DID NOT CLOSE'); process.exit(1); }
console.log('NATIVE INVENTORY OK');
await browser.close(); await server.close();
