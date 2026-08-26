// U26 probe: the DUNGEON opens the same classic inventory the exterior
// hosts have had since U8d. Until this slice it opened ui/inventory.js's
// keyed text window - no tabs, no paperdoll, no info panel and, after
// U25, no point-and-click Use either, which is where a torch is lit.
//
// It also exercises the two things the swap needed: RAW KEY CODES
// through routeKey (the action map cannot express F6 or a mode
// button), and a GROUND PILE for Remove-mode drops.
import { createServer } from 'vite';
import { chromium } from 'playwright';

const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5202, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5202/play/?shot&class=0');
await page.waitForFunction(() => window.__frame > 10, null, { timeout: 180000 });
const waitFrames = async (n) => {
  const f = await page.evaluate(() => window.__frame);
  await page.waitForFunction(([f0, k]) => window.__frame > f0 + k, [f, n], { timeout: 60000 });
};

await page.evaluate(() => {
  window.__playerEntity.items = [
    { group: 'Weapons', templateIndex: 118, name: 'Broadsword', material: 1, currentCondition: 30, maxCondition: 60 },
    { group: 'UselessItems2', templateIndex: 247, name: 'Torch', currentCondition: 16, maxCondition: 16 },
    { group: 'Armor', templateIndex: 102, name: 'Iron Cuirass', material: 0x0200 },
  ];
});

// F6 through the REAL key path - routeKey has to hand the window a raw
// code, not an action.
await page.keyboard.press('F6');
await waitFrames(8);
let ov = JSON.parse(await page.evaluate(() => window.__overlay()) ?? 'null');
console.log('overlay:', JSON.stringify(ov));
if (ov?.kind !== 'NativeInventoryWindow') { console.log('THE DUNGEON DID NOT OPEN THE NATIVE WINDOW'); process.exit(1); }
await page.screenshot({ path: '/home/claude/dungeon-inventory.png' });

// the info panel, on the real TEXT.RSC record for a weapon
await page.evaluate(() => window.__overlayClick(230, 43));      // info mode
await page.evaluate(() => window.__overlayClick(163 + 9 + 25, 48 + 5));
await waitFrames(4);
console.log('info:', JSON.parse(await page.evaluate(() => window.__overlay())).box);
await page.screenshot({ path: '/home/claude/dungeon-inventory-info.png' });
await page.evaluate(() => window.__overlayClick(10, 190));      // dismiss

// USE: light the torch (clothing & misc tab, equip-mode click)
await page.evaluate(() => window.__overlayClick(163 + 5, 5));   // clothing tab
await page.evaluate(() => window.__overlayClick(230, 65));      // equip mode
await page.evaluate(() => window.__overlayClick(163 + 9 + 25, 48 + 5));
await waitFrames(4);
console.log('after equip-click on the torch:', JSON.parse(await page.evaluate(() => window.__overlay())).box,
  'lightSource=', await page.evaluate(() => window.__playerEntity.lightSource?.name ?? null));
await page.evaluate(() => window.__overlayClick(10, 190));

// REMOVE the sword to the ground: the pile is what the dungeon never had
await page.evaluate(() => window.__overlayClick(0 + 5, 5));     // weapons tab
await page.evaluate(() => window.__overlayClick(230, 87));      // remove mode
await page.evaluate(() => window.__overlayClick(163 + 9 + 25, 48 + 5));
await waitFrames(4);
ov = JSON.parse(await page.evaluate(() => window.__overlay()));
console.log('after remove:', JSON.stringify(ov));
await page.keyboard.press('Escape');
await waitFrames(8);
console.log('closed:', await page.evaluate(() => window.__overlay()));
console.log('ground piles:', await page.evaluate(() => window.__piles()));
const piles = JSON.parse(await page.evaluate(() => window.__piles()));
if (!piles.length || !piles[0].n) { console.log('THE DROPPED ITEM VANISHED - no ground pile'); process.exit(1); }
await waitFrames(10);
await page.screenshot({ path: '/home/claude/dungeon-pile.png' });

// and the pile is activatable, opening the window with it as the target
const took = await page.evaluate(() => window.__activate());
await waitFrames(6);
console.log('after activating the pile:', await page.evaluate(() => window.__overlay()), 'activate ->', took);

console.log('OK');
await browser.close();
await server.close();
process.exit(0);
