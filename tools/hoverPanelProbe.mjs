// U47 probe: the inventory's hover info panel, live.
//
// The unit tests drive the panel over fixtures. What this proves is
// the SEAM: that a real mousemove over a real inventory window
// reaches the window's new hover(vx,vy) at all. townTalk's hover
// channel has existed since U37 and gated on `overlay?.hover` - so
// until this slice the inventory was the window it skipped, and a
// method nothing calls is the failure this project keeps finding.
import { createServer } from 'vite';
import { chromium } from 'playwright';

const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5222, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.message); });
await page.goto('http://localhost:5222/play/?shot&play&exterior&time=12:00&class=1');
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 180000 });

const fail = (m) => { console.log('FAIL:', m); process.exit(1); };
const waitFrames = async (n) => {
  const f = await page.evaluate(() => window.__frame);
  await page.waitForFunction(([f0, k]) => window.__frame > f0 + k, [f, n], { timeout: 60000 });
};
/** Move the real mouse to a VIRTUAL (320x200) point. */
const moveTo = async (vx, vy) => {
  const at = await page.evaluate(async ([x, y]) => {
    const { nativeMetrics } = await import('/src/ui/nativePanel.js');
    const c = document.querySelector('canvas');
    const m = nativeMetrics(c);
    const r = c.getBoundingClientRect();
    return [r.left + (m.ox + x * m.s) * (r.width / c.width), r.top + (m.oy + y * m.s) * (r.height / c.height)];
  }, [vx, vy]);
  await page.mouse.move(at[0], at[1]);
  await waitFrames(2);
};

console.log('== OPEN THE REAL INVENTORY ==');
await page.keyboard.press('F6');
await waitFrames(6);
const talk = JSON.parse(await page.evaluate(() => window.__talk()));
if (!talk.overlay) fail('F6 opened nothing');
console.log('overlay open:', talk.overlay, 'native:', talk.native);

console.log('\n== A REAL MOUSEMOVE OVER A REAL SLOT ==');
const before = await page.evaluate(() => window.__invInfo?.() ?? 'null');
console.log('before:', before);
await moveTo(163 + 30, 48 + 10);          // list slot 0
const after = await page.evaluate(() => window.__invInfo?.() ?? 'null');
console.log('after slot 0:', after);
if (after === 'null') fail('no probe surface for the panel - add window.__invInfo');
const a = JSON.parse(after);
if (!a.item) fail('hovering a real slot did not fill the panel - the seam does not reach the window');

console.log('\n== STICKY, AND CLEARED BY A TAB ==');
await moveTo(20, 100);                     // dead space
const stuck = JSON.parse(await page.evaluate(() => window.__invInfo()));
console.log('over dead space:', JSON.stringify(stuck));
if (stuck.item !== a.item) fail('the panel must be sticky');
await moveTo(226 + 15, 126 + 7);           // the GOLD button
const gold = JSON.parse(await page.evaluate(() => window.__invInfo()));
console.log('over gold:', JSON.stringify(gold));
if (!gold.gold) fail('the gold button did not take the panel');
await page.mouse.click(...(await page.evaluate(async () => {
  const { nativeMetrics } = await import('/src/ui/nativePanel.js');
  const c = document.querySelector('canvas');
  const m = nativeMetrics(c);
  const r = c.getBoundingClientRect();
  return [r.left + (m.ox + 260 * m.s) * (r.width / c.width), r.top + (m.oy + 5 * m.s) * (r.height / c.height)];
})));
await waitFrames(4);
const tabbed = JSON.parse(await page.evaluate(() => window.__invInfo()));
console.log('after a tab click:', JSON.stringify(tabbed));
if (tabbed.item !== null || tabbed.gold) fail('a tab change must empty the panel');

if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
console.log('\nPASS');
await browser.close();
await server.close();
process.exit(0);
