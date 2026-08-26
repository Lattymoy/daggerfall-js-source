// G3 probe: kill a city guard through the real death path, E on the
// corpse, and watch the loot transfer into the player entity live.
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5199, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
// T2: `class=16` SKIPS THE CHARGEN WIZARD. Without it the wizard holds
// townTalk's overlay slot and townTalk.keydown - FIRST in this host's
// keydown ladder (exterior.js:1046-1047) - swallows every
// page.keyboard.press below, so this probe pressed its keys into a
// character-creation screen it never knew was up.
await page.goto('http://localhost:5199/play/?shot&play&exterior&time=12:00&class=16');
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 180000 });
await new Promise((r) => setTimeout(r, 8000));
await page.evaluate(() => { window.__playerEntity.crimeCommitted = 'Pickpocketing'; window.__crime(); });
await page.waitForFunction(() => JSON.parse(window.__guards()).length > 0, null, { timeout: 60000 });
const before = await page.evaluate(() => (window.__playerEntity.items ?? []).length);
console.log('guards up; player items before:', before);
// Kill guard 0 through the REAL damageGuard path (corpse + loot stay)
await page.evaluate(() => window.__guardDamage(0, 9999));
const waitFrames = async (n) => {
  const f = await page.evaluate(() => window.__frame);
  await page.waitForFunction(([f0, k]) => window.__frame > f0 + k, [f, n], { timeout: 60000 });
};
await waitFrames(5);
const g0 = JSON.parse(await page.evaluate(() => window.__guards()))[0];
console.log('corpse:', JSON.stringify(g0));
if (!g0.dead) { console.log('GUARD NOT DEAD'); process.exit(1); }
// Face the corpse box (feet..+0.6) from 1.6 units south, pitch down
await page.evaluate(([x, y, z]) => window.__pose(x, y, z, Math.PI, -0.65), [g0.pos[0], g0.pos[1] + 0.1, g0.pos[2] + 1.6]);
await waitFrames(8);
const press = async (code) => { await page.keyboard.down(code); await waitFrames(3); await page.keyboard.up(code); await waitFrames(2); };
await press('KeyE');
const after = await page.evaluate(() => (window.__playerEntity.items ?? []).map((it) => `${it.name ?? it.group}${it.stackCount ? ` x${it.stackCount}` : ''}`));
console.log('player items after E:', JSON.stringify(after));
await page.screenshot({ path: '/home/claude/guard-loot.png' });
// The corpse must be EMPTY now: a second E takes nothing
await press('KeyE');
const after2 = await page.evaluate(() => (window.__playerEntity.items ?? []).length);
console.log('items after second E:', after2, '(no double takes)');
if (after.length <= before) { console.log('NO LOOT TAKEN'); process.exit(1); }
if (after2 !== after.length) { console.log('DOUBLE TAKE'); process.exit(1); }
console.log('GUARD LOOT OK');
await browser.close(); await server.close();
