// P1 probe: an interior REMEMBERS across a visit.
//
// The port rebuilt every interior from block data on entry, so a
// shelf the player emptied restocked and anything dropped inside was
// gone. This walks into a shop, empties a shelf, steps outside, walks
// back in, and reads the shelf back.
import { createServer } from 'vite';
import { chromium } from 'playwright';

const SHOPPY = new Set([0, 2, 5, 6, 7, 8, 9, 12, 13]);
const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5214, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.message); });
await page.goto('http://localhost:5214/play/?shot&play&exterior&time=12:00');
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 180000 });

const waitFrames = async (n) => {
  const f = await page.evaluate(() => window.__frame);
  await page.waitForFunction(([f0, k]) => window.__frame > f0 + k, [f, n], { timeout: 60000 });
};
const cache = async () => JSON.parse(await page.evaluate(() => window.__sceneCache()));
const fail = (m) => { console.log('FAIL:', m); process.exit(1); };

const doors = JSON.parse(await page.evaluate(() => JSON.stringify(window.__doors())));
let pick = null;
for (let i = 0; i < doors.length && !pick; i++) {
  const b = JSON.parse(await page.evaluate((j) => window.__buildingAt(j), i));
  if (!b || !SHOPPY.has(b.buildingType)) continue;
  const { pos, normal } = doors[i];
  const pose = [pos[0] + normal[0] * 1.5, pos[1] - 1.2, pos[2] + normal[2] * 1.5, Math.atan2(-normal[0], -normal[2])];
  await page.evaluate(([x, y, z, yaw]) => window.__pose(x, y, z, yaw, -0.05), pose);
  if (!await page.evaluate(() => window.__enter())) continue;
  await waitFrames(10);
  const shelves = JSON.parse(await page.evaluate(() => window.__shelves()) ?? 'null');
  if (shelves?.shelves?.length > 0) pick = { b, pose };
  else { await page.evaluate(() => window.__exit()); await waitFrames(4); }
}
if (!pick) fail('no shop with a shelf found');
console.log('shop:', pick.b.name, '| type', pick.b.buildingType);

console.log('\n== STOCK IT ==');
await page.evaluate(() => window.__openShelf(0));
await waitFrames(6);
let c = await cache();
console.log('scene:', c.scene);
if (!c.scene) fail('the interior has no scene name - it cannot be cached');
const stocked = c.shelves[0];
console.log('shelf 0 stocked:', stocked);
if (!stocked) fail('the shelf did not stock');
await page.evaluate(() => window.__tradeClick('exit'));
await waitFrames(2);
// CHANGE the shelf, so the pin is not "3 equals 3" - a shelf that
// simply restocked on re-entry would pass that, which is the vacuous
// shape this repo has caught before.
const changed = await page.evaluate(() => window.__takeFromShelf(0));
console.log('shelf 0 after taking one:', changed);
if (changed == null || changed !== stocked - 1) fail('could not change the shelf');

console.log('\n== LEAVE ==');
await page.evaluate(() => window.__exit());
await waitFrames(8);
c = await cache();
console.log('cached scenes:', c.cached.length, JSON.stringify(c.cached));
if (c.cached.length !== 1) fail(`expected exactly one cached scene, got ${c.cached.length}`);

console.log('\n== COME BACK ==');
await page.evaluate(([x, y, z, yaw]) => window.__pose(x, y, z, yaw, -0.05), pick.pose);
if (!await page.evaluate(() => window.__enter())) fail('could not get back in');
await waitFrames(10);
c = await cache();
console.log('shelf 0 on return:', c.shelves[0], '| left it at', changed, '| a restock would say', stocked);
if (c.shelves[0] === stocked) fail('the shelf RESTOCKED - the cache did not restore it');
if (c.shelves[0] !== changed) fail(`the shelf came back as ${c.shelves[0]}, not the ${changed} it was left at`);
if (c.cached.length !== 0) fail('restoring must CONSUME the cache entry');
console.log('and the cache entry was consumed, as DFU consumes it');

console.log('\n== A SECOND VISIT RE-CACHES ==');
await page.evaluate(() => window.__exit());
await waitFrames(8);
c = await cache();
if (c.cached.length !== 1) fail('leaving again must cache again');

if (errors.length) fail(`page errors: ${JSON.stringify(errors)}`);
console.log('\nOK: an interior is cached on the way out and restored on the way in');
await browser.close();
await server.close();
