import { createServer } from 'vite';
import { chromium } from 'playwright';
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const server = await createServer({ server: { port: 5199, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 900, height: 640 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5199/?world&shot&play&voxelfolk&piece');
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 180000 });
const setup = await page.evaluate(async () => {
  const doors = window.__doors();
  const d = doors[doors.findIndex((x) => x.type === 1 && x.block.startsWith('TVRN'))];
  const [px, py, pz] = d.pos; const [nx, , nz] = d.normal;
  window.__player.warp(px + nx * 2, py - 1.5, pz + nz * 2);
  window.__pose(px + nx * 2, py + 0.2, pz + nz * 2, Math.atan2(-nx * 2, -nz * 2), 0);
  if (!await window.__enter()) return { err: 'enter' };
  return JSON.parse(window.__peopleList())[0];
});
if (setup.err) { console.log('SETUP FAIL'); process.exit(1); }
async function shoot(angleDeg, file) {
  await page.evaluate(({ t, angleDeg }) => {
    const a = angleDeg * Math.PI / 180;
    const ox = Math.sin(a) * 2.4, oz = Math.cos(a) * 2.4;
    const eyeY = t.y + 1.55;
    const ddx = -ox, ddy = (t.y + 0.9) - eyeY, ddz = -oz;
    window.__player.warp(t.x + ox, t.y, t.z + oz);
    window.__pose(t.x + ox, eyeY, t.z + oz, Math.atan2(ddx, ddz), Math.atan2(ddy, Math.hypot(ddx, ddz)));
  }, { t: setup, angleDeg });
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: file });
}
await shoot(45, '/home/claude/back-front.png');
await shoot(225, '/home/claude/back-rear.png');
console.log('SHOTS OK');
await browser.close(); await server.close();
