// S23 probe: THE CAREER EQUIP RESTRICTIONS, driven live by clicks.
//
// The same loadout the U8g equip probe wears as a WARRIOR (?class=16,
// the one classic class with no restrictions) is refused piece by piece
// to a MAGE (?class=0), who may wear neither plate nor chain, carry no
// shield but a buckler, and swing no axe. 17 of the 18 classic classes
// carry restrictions like these and the port enforced none of them
// until this slice.
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5207, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (e) => { console.log('[pageerror]', e.message); process.exitCode = 1; });
await page.goto('http://localhost:5207/play/?shot&play&exterior&time=12:00&class=0');   // Mage
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
const die = (m, x) => { console.log('FAIL:', m, x ?? ''); process.exit(1); };

const career = await page.evaluate(() => window.__playerEntity.career?.name);
console.log('career:', career);
if (career !== 'Mage') die('THE HEADLESS SKIP DID NOT MAKE A MAGE', career);

await page.evaluate(() => {
  window.__playerEntity.equip = null;
  window.__playerEntity.armorValues = null;
  window.__playerEntity.items = [
    { group: 'Armor', templateIndex: 102, material: 0x0200, variant: 1, name: 'Iron Cuirass' },   // PLATE - refused
    // a Mage forbids longBlade, axe AND missileWeapon, so the allowed
    // weapon has to be a SHORT blade - the probe's first draft reached
    // for a Longsword and was rightly refused
    { group: 'Weapons', templateIndex: 113, material: 0, name: 'Dagger' },
    { group: 'MensClothing', templateIndex: 151, variant: 0, dye: 2, name: 'Casual Pants' },
  ];
});
await press('F6');
const worn = () => page.evaluate(() => (window.__playerEntity.equip?.slots ?? []).filter(Boolean).map((i) => i.name));
const popup = () => page.evaluate(() => JSON.parse(window.__talk()).overlayBox);

// the cuirass is first in the weapons-and-armor tab: PLATE, refused
await click(163 + 9 + 25, 48 + 19);
let w = await worn();
console.log('after clicking the Iron Cuirass:', JSON.stringify(w));
if (w.includes('Iron Cuirass')) die('THE MAGE WORE PLATE - the career gate did not fire');
await page.screenshot({ path: '/home/claude/s23-refused.png' });

// the refusal is not silent
const p = await popup();
console.log('refusal popup:', JSON.stringify(p));
if (!p || !String(p[0]).length) die('THE REFUSAL WAS SILENT');
await click(160, 100);   // dismiss

// a LONG blade is refused too - the Mage's forbidden proficiencies
await page.evaluate(() => { window.__playerEntity.items.push({ group: 'Weapons', templateIndex: 120, material: 0, name: 'Longsword' }); });
await page.evaluate(() => { window.__playerEntity.items = window.__playerEntity.items.filter((i) => i.name !== 'Iron Cuirass'); });
await waitFrames(4);
await click(163 + 9 + 25, 48 + 19);   // row 0 is the Dagger now
w = await worn();
console.log('after clicking the Dagger:', JSON.stringify(w));
if (!w.includes('Dagger')) die('THE MAGE COULD NOT DRAW A DAGGER - the gate over-blocks', JSON.stringify(w));

console.log('\nS23 PROBE PASSED: the Mage is refused plate, told why, and keeps the short blade.');
await browser.close();
await server.close();
