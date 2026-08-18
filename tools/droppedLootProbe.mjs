// U8e probe: drop an item through the inventory's Remove mode, see
// the archive-216 treasure flat mint at the player's feet, E it to
// reopen the inventory as a loot target, take the item back, and
// watch the emptied pile vanish.
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
// the motor must SETTLE before the drop - the collider streams in
// after __shotReady, and an early F6 freezes the sim with the player
// still suspended at spawn height (the ground raycast has no tris)
let lastY = null;
for (;;) {
  await waitFrames(10);
  const y = (await page.evaluate(() => window.__player.pos))[1];
  if (lastY !== null && Math.abs(y - lastY) < 1e-4) break;
  lastY = y;
}
console.log('motor settled at y', lastY);
const S = 4, OX = 60, OY = 50;
const click = async (vx, vy) => { await page.mouse.click(OX + vx * S, OY + vy * S); await waitFrames(3); };
await page.evaluate(() => { window.__playerEntity.items = [{ group: 'Weapons', templateIndex: 113, name: 'Dagger', material: 0 }]; });
// F6 -> Remove mode -> drop the dagger -> close (the pile mints)
await press('F6');
await click(226 + 15, 80 + 7);      // the Remove button
await click(163 + 9 + 25, 48 + 19); // local slot 0
await press('Escape');
let piles = JSON.parse(await page.evaluate(() => window.__droppedLoot()));
console.log('piles after drop:', JSON.stringify(piles));
if (piles.length !== 1 || piles[0].n !== 1) { console.log('PILE DID NOT MINT'); process.exit(1); }
await waitFrames(8);   // the flat warms
piles = JSON.parse(await page.evaluate(() => window.__droppedLoot()));
if (!piles[0].flat) { console.log('FLAT DID NOT MOUNT'); process.exit(1); }
// approach the pile from each side until the motor stands LEVEL with
// it (the drop spot can sit on a ledge - a fallen pose leaves the eye
// below the box and the downward ray passes under it)
let opened = false;
for (const [dx, dz, yaw] of [[0, 1.2, Math.PI], [0, -1.2, 0], [1.2, 0, -Math.PI / 2], [-1.2, 0, Math.PI / 2]]) {
  await page.evaluate(([x, y, z, ddx, ddz, yy]) => window.__pose(x + ddx, y + 0.1, z + ddz, yy, -0.75), [...piles[0].pos, dx, dz, yaw]);
  await waitFrames(6);
  const py = (await page.evaluate(() => window.__player.pos))[1];
  if (py < piles[0].pos[1] - 0.4) continue;   // fell off the ledge - try the next side
  await page.screenshot({ path: '/home/claude/dropped-pile.png' });
  await press('KeyE');
  opened = JSON.parse(await page.evaluate(() => window.__talk())).overlay;
  if (opened) break;
}
console.log('loot inventory open:', opened);
if (!opened) { console.log('PILE DID NOT OPEN'); process.exit(1); }
await waitFrames(6);
await page.screenshot({ path: '/home/claude/dropped-pickup.png' });
// remote slot 0 -> takes the dagger back; close; the pile vanishes
await click(261 + 9 + 25, 48 + 19);
await press('Escape');
const bag = await page.evaluate(() => (window.__playerEntity.items ?? []).map((i) => i.name));
piles = JSON.parse(await page.evaluate(() => window.__droppedLoot()));
console.log('bag after pickup:', JSON.stringify(bag), 'piles:', JSON.stringify(piles));
if (bag[0] !== 'Dagger') { console.log('DAGGER NOT RECOVERED'); process.exit(1); }
// AUDIT 17e F28: DFU's RemoveLootContainer fires on WINDOW CLOSE, so
// an emptied pile is GONE (batch freed, entry dropped) rather than
// lingering as an empty husk - the stronger assertion.
if (piles.length !== 0) { console.log('EMPTIED PILE NOT RELEASED', JSON.stringify(piles)); process.exit(1); }
await waitFrames(4);
await page.screenshot({ path: '/home/claude/dropped-gone.png' });
console.log('DROPPED LOOT OK');
await browser.close(); await server.close();
