// F-slice: does FAST TRAVEL work in the live world host? Opens the
// real window on V, types the nearest real destination's name, and
// travels - then verifies the clock advanced, the pixel moved, the
// gold paid, and no page errors. Frame-synced like castProbe.
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const server = await createServer({ server: { port: 5210, strictPort: true } });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
page.on('console', (m) => {
  // A resource 404 (this box's ARENA2 lacks CURSOR.IMG) is not a page
  // error - the cursor module logs and falls back. Real errors gate.
  if (m.type() === 'error' && !/status of 404/.test(m.text())) errors.push(`[console] ${m.text()}`);
});

await page.goto('http://localhost:5210/?world&nomenu&class=0&novideo&shot&play');
await page.waitForTimeout(Number(process.env.BOOT_WAIT ?? 14000));
await page.mouse.click(640, 400);
await page.waitForTimeout(800);

const frames = async (n, cap = 30000) => {
  const f0 = await page.evaluate(() => window.__frame ?? 0);
  const t0 = Date.now();
  while (Date.now() - t0 < cap) {
    await page.waitForTimeout(150);
    if (await page.evaluate(() => window.__frame ?? 0) >= f0 + n) break;
  }
};

const out = { steps: {} };
// Drain the quest arc's boot boxes (the start letter + the tutorial
// YesNo) before driving keys - Escape advances a plain box and
// declines a YesNo. Same guard as castProbe's.
for (let i = 0, quiet = 0; i < 30 && quiet < 2; i++) {
  const up = await page.evaluate(() => JSON.parse(window.__talk()).overlay);
  if (up) { quiet = 0; await page.keyboard.press('Escape'); } else quiet++;
  await frames(2);
}
out.steps.overlayAfterDrain = await page.evaluate(() => JSON.parse(window.__talk()).overlay);
out.steps.before = await page.evaluate(() => JSON.parse(window.__travelProbe()));
const dest = await page.evaluate(() => JSON.parse(window.__travelNearest()));
out.steps.dest = { name: dest.name, region: dest.region, pixel: dest.pixel };

await page.keyboard.press('v');
await frames(2);
out.steps.overlayAfterV = await page.evaluate(() => JSON.parse(window.__talk()).overlay);
for (const c of dest.name) {
  if (c === ' ') await page.keyboard.press('Space');
  else if (/[a-zA-Z0-9'-]/.test(c)) await page.keyboard.press(c);
  await page.waitForTimeout(30);
}
await frames(1);
await page.keyboard.press('Enter');   // pick
await frames(1);
await page.keyboard.press('Enter');   // travel (cautious/inns defaults)
await frames(8, 60000);               // arrival: rebuild + the ticker jump
out.steps.after = await page.evaluate(() => JSON.parse(window.__travelProbe()));

const b = out.steps.before, a = out.steps.after;
out.ok = !!(a.minutes > b.minutes                                      // the clock advanced
  && (a.pixel.x !== b.pixel.x || a.pixel.y !== b.pixel.y)              // the player moved pixels
  && Math.abs(a.pixel.x - dest.pixel.x) <= 1 && Math.abs(a.pixel.y - dest.pixel.y) <= 1   // to the destination
  && a.gold <= b.gold                                                  // the trip was paid (inns cost)
  && errors.length === 0);
out.minutesAdvanced = a.minutes - b.minutes;
out.errors = errors.slice(0, 8);
console.log(JSON.stringify(out, null, 2));
await browser.close();
await server.close();
process.exit(out.ok ? 0 : 1);
