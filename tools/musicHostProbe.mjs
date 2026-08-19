// AUDIT 21 F1: does the MUSIC actually change when you go inside?
//
// The four scene hosts have no execution coverage in node, and that is
// exactly where this defect lived: the music context was fed AFTER the
// modal early return, so it ran only on frames where the mode host's
// overlay was guaranteed null. Entering a tavern kept the street song and
// the director stopped being fed at all. Nothing but a real boot can see
// it, so this drives one - positioning the player at a real door the way
// shopProbe does, entering, and reading the resolved environment.
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const server = await createServer({ server: { port: 5211, strictPort: true } });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5211/?shot&play&exterior&novideo&time=12:00');
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 120000 });
await page.mouse.click(500, 320);                       // a gesture, so audio may run
await page.waitForTimeout(2500);

const read = () => page.evaluate(async () => ({
  song: (await import('/src/systems/music.js')).music.current,
  ctx: window.__musicCtx ?? null,
  mode: window.__mode?.() ?? 'n/a',
}));
console.log('outdoors :', JSON.stringify(await read()));

// Stand at a real building door, facing it - the shopProbe recipe.
const doors = await page.evaluate(() => window.__doors());
let entered = false;
for (const d of doors) {
  const b = JSON.parse(await page.evaluate((i) => window.__buildingAt(i), d.i) ?? 'null');
  if (!b) continue;
  const { pos, normal } = d;
  await page.evaluate(([x, y, z, yaw]) => window.__pose(x, y, z, yaw, -0.05),
    [pos[0] + normal[0] * 1.5, pos[1] - 1.2, pos[2] + normal[2] * 1.5, Math.atan2(-normal[0], -normal[2])]);
  if (await page.evaluate(() => window.__enter())) {
    console.log(`entered door ${d.i}, building type ${b.buildingType}`);
    entered = true;
    break;
  }
}
if (!entered) { console.log('ENTER FAILED - no door opened'); process.exit(1); }
await page.waitForTimeout(3000);
console.log('inside   :', JSON.stringify(await read()));

await page.evaluate(() => window.__exit());
await page.waitForTimeout(3000);
console.log('back out :', JSON.stringify(await read()));

await browser.close();
await server.close();
