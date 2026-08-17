// Standing monster-sprite probe (C11): boot the dungeon shot scene,
// find a live monster foe, pose the camera in front of it, and
// screenshot close-up - the sprite-orientation doctrine check
// (compare the crop against the RAW record art via the scratchpad
// record dumper; the facing must match the foe's yaw on screen).
// Run: ARENA2_PATH=... node tools/monsterProbe.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';

const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5199, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('console', (m) => console.log('[page]', m.text().slice(0, 200)));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5199/?shot&class=0');
await page.waitForFunction(() => window.__frame > 10, null, { timeout: 120000 });
const foes = JSON.parse(await page.evaluate(() => window.__foes()));
const monsters = foes.filter((f) => f.type <= 42 && !f.dead && f.pos);
console.log('monster foes:', monsters.length, 'first:', JSON.stringify(monsters[0]));
// C12: the behaviour motors - report the flyers/swimmers so hover
// height and water gating are visible in the probe output.
const SPECIAL = { 1: 'fly', 3: 'fly', 13: 'fly', 34: 'fly', 40: 'fly', 18: 'spectral', 23: 'spectral', 11: 'swim', 41: 'swim', 42: 'swim' };
for (const m of monsters) {
  if (SPECIAL[m.type]) console.log(`  ${SPECIAL[m.type]} type ${m.type} at [${m.pos.map((v) => v.toFixed(1))}]`);
}
// C17: the humanoid pivot - close-up a CLASS foe too (the same
// sprite-orientation doctrine; crop vs the raw record art).
const humans = foes.filter((f) => f.type >= 128 && !f.dead && f.pos);
console.log('class foes:', humans.length, 'first:', JSON.stringify(humans[0]));
if (humans.length) {
  const h = humans[0];
  const cx = h.pos[0], cz = h.pos[2] + 2.5;
  const yaw = Math.atan2(h.pos[0] - cx, h.pos[2] - cz);
  await page.evaluate(([x, y, z, yw]) => window.__pose(x, y, z, yw, -0.1), [cx, h.pos[1] + 1.5, cz, yaw]);
  await page.waitForFunction((f0) => window.__frame > f0 + 20, await page.evaluate(() => window.__frame), { timeout: 60000 });
  await page.screenshot({ path: '/home/claude/human-closeup.png' });
  const after = JSON.parse(await page.evaluate(() => window.__foes())).find((f) => f.i === h.i);
  console.log('human closeup of type', h.type, 'yaw', after.yaw, 'sprite', JSON.stringify(after.sprite));
}
if (monsters.length) {
  const m = monsters[0];
  // camera 2.5 units south of the foe at eye height, facing it (yaw toward -z if we stand at +z)
  const cx = m.pos[0], cz = m.pos[2] + 2.5;
  const yaw = Math.atan2(m.pos[0] - cx, m.pos[2] - cz);   // looking -z
  await page.evaluate(([x, y, z, yw]) => window.__pose(x, y, z, yw, -0.1), [cx, m.pos[1] + 1.5, cz, yaw]);
  await page.waitForFunction((f0) => window.__frame > f0 + 20, await page.evaluate(() => window.__frame), { timeout: 60000 });
  await page.screenshot({ path: '/home/claude/monster-closeup.png' });
  const after = JSON.parse(await page.evaluate(() => window.__foes())).find((f) => f.i === m.i);
  console.log('closeup taken of type', m.type, 'yaw', after.yaw, 'sprite', JSON.stringify(after.sprite));
}
await browser.close(); await server.close();
