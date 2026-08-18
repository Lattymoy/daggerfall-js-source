// U8g probe: EQUIP mode live - click items to wear them (they leave
// the list and appear ON the paperdoll with dyes), REMOVE mode
// clicks the doll to take them off (the GetEquipIndex mask).
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5199, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5199/?shot&play&exterior&time=12:00');
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 180000 });
const waitFrames = async (n) => {
  const f = await page.evaluate(() => window.__frame);
  await page.waitForFunction(([f0, k]) => window.__frame > f0 + k, [f, n], { timeout: 60000 });
};
const press = async (code) => { await page.keyboard.down(code); await waitFrames(3); await page.keyboard.up(code); await waitFrames(2); };
let lastY = null;
for (;;) {
  await waitFrames(10);
  const y = (await page.evaluate(() => window.__player.pos))[1];
  if (lastY !== null && Math.abs(y - lastY) < 1e-4) break;
  lastY = y;
}
const S = 4, OX = 60, OY = 50;
const click = async (vx, vy) => { await page.mouse.click(OX + vx * S, OY + vy * S); await waitFrames(4); };
await page.evaluate(() => {
  // clear the boot-seeded interim dagger so the probe's loadout is
  // the whole story (it would otherwise dual-wield with the sword)
  const slots = window.__playerEntity.equip?.slots;
  if (slots?.[19]) { delete slots[19].equipSlot; slots[19] = null; }
  window.__playerEntity.items = [
    { group: 'Armor', templateIndex: 102, material: 0x0200, variant: 1, name: 'Iron Cuirass' },
    { group: 'Weapons', templateIndex: 120, material: 0, name: 'Longsword' },
    { group: 'MensClothing', templateIndex: 151, variant: 0, dye: 2, name: 'Casual Pants' },
  ];
});
await press('F6');
const worn = () => page.evaluate(() => (window.__playerEntity.equip?.slots ?? []).filter(Boolean).map((i) => i.name));
// EQUIP is the default mode: click the cuirass, then the sword
await click(163 + 9 + 25, 48 + 19);
await click(163 + 9 + 25, 48 + 19);   // the list shifted up - slot 0 is now the sword
console.log('worn after weapon-tab equips:', JSON.stringify(await worn()));
// the pants live on the clothing tab
await click(208, 5);
await click(163 + 9 + 25, 48 + 19);
await waitFrames(10);   // record loads + recompose
const w1 = await worn();
console.log('worn after pants:', JSON.stringify(w1));
if (w1.length !== 3) { console.log('EQUIP FAILED'); process.exit(1); }
await page.screenshot({ path: '/home/claude/equip-worn.png' });
// AUDIT 17e F8: a REMOVE-mode doll click is INERT in DFU
// (PaperDoll_OnMouseClick has no Remove branch) - this probe used to
// assert the inverted behaviour the port shipped.
await click(226 + 15, 80 + 7);      // REMOVE
await click(49 + 55, 13 + 70);      // the doll's chest
await waitFrames(6);
const inert = await worn();
console.log('worn after REMOVE-mode doll click (must be unchanged):', JSON.stringify(inert));
if (!inert.includes('Iron Cuirass')) { console.log('REMOVE-MODE DOLL CLICK SHOULD BE INERT'); process.exit(1); }
// EQUIP mode is what unequips (DaggerfallInventoryWindow.cs:1939-1943)
await click(226 + 15, 58 + 7);      // EQUIP
await click(49 + 55, 13 + 70);
await waitFrames(10);
const w2 = await worn();
console.log('worn after EQUIP-mode doll click:', JSON.stringify(w2));
if (w2.includes('Iron Cuirass')) { console.log('UNEQUIP FAILED'); process.exit(1); }
await page.screenshot({ path: '/home/claude/equip-removed.png' });
await press('Escape');
// U8h: the FP rig now swings the WORN weapon - ready it (Z) and the
// longsword art should draw (not the old interim dagger)
await press('KeyZ');
await waitFrames(6);
await page.screenshot({ path: '/home/claude/equip-fp.png' });
console.log('EQUIP OK');
await browser.close(); await server.close();
