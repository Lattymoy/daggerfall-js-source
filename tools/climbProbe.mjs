// M3 live probe: does CLIMBING actually climb in a real browser?
// Boots ?world at the classic start, turns the player at a wall
// (four compass tries - Daggerfall city has buildings in most
// directions), HOLDS W through the real key path, and watches
// window.__climb: the 14-unit countdown, the skill check on the
// LIVE Climbing skill, and the capsule rising up real geometry.
// Releasing W must abort the climb (the classic abort key).
//
// Frame-synced (the process doctrine): SwiftShader crawls, so every
// wait is in FRAMES via window.__frame.
//
// Usage: node tools/climbProbe.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const server = await createServer({ server: { port: 5214, strictPort: true } });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`); });

await page.goto('http://localhost:5214/?world&nomenu&class=0&novideo&shot&play');
await page.waitForTimeout(Number(process.env.BOOT_WAIT ?? 15000));

const frame = () => page.evaluate(() => window.__frame ?? 0);
const waitFrames = async (n, cond = null, capMs = 180000) => {
  const f0 = await frame();
  const t0 = Date.now();
  for (;;) {
    if (Date.now() - t0 > capMs) return false;
    const f = await frame();
    if (cond) { const v = await cond(); if (v) return v; }
    else if (f - f0 >= n) return true;
    await page.waitForTimeout(350);
  }
};

await waitFrames(5, async () => page.evaluate(() => !!window.__climb && !!window.__pose && !!window.__player && !!window.__people));
const climb = async () => JSON.parse(await page.evaluate(() => window.__climb()));

let fails = 0;
const check = (ok, label) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`); if (!ok) fails++; };

// a building DOOR is a wall with a known outward normal - stand a
// step outside it, face square INTO the wall, and hold W (the blind
// compass walk slid along angled walls and the 0.12 stationarity
// gate faithfully refused the drift)
const doors = JSON.parse(await page.evaluate(() => window.__doorSpots()));
check(doors.length > 0, `door spots streamed (${doors.length})`);
if (!doors.length) { await browser.close(); await server.close(); process.exit(1); }

let climbed = null;
for (const d of doors.slice(0, 8)) {
  const stand = [d.pos[0] + d.n[0] * 1.2, d.pos[1], d.pos[2] + d.n[2] * 1.2];
  const yaw = Math.atan2(-d.n[0], -d.n[2]);   // face INTO the wall
  await page.evaluate(([p, y]) => window.__pose(p[0], p[1], p[2], y, 0), [stand, yaw]);
  await waitFrames(4);
  await page.keyboard.down('KeyW');
  const rose = await waitFrames(0, async () => {
    const c = await climb();
    return (c.climbing && !c.slipping) ? c : null;
  }, 30000);
  if (rose) {
    const y0 = rose.y;
    const high = await waitFrames(0, async () => {
      const c = await climb();
      return (c.climbing && c.y > y0 + 0.8) ? c : null;
    }, 30000);
    if (high) { climbed = { yaw, y0, high }; break; }
  }
  await page.keyboard.up('KeyW');
  await waitFrames(3);
}
check(!!climbed, climbed
  ? `the player CLIMBED a real wall (yaw ${climbed.yaw.toFixed(2)}: y ${climbed.y0} -> ${climbed.high.y})`
  : 'no wall climbed in any direction');

if (climbed) {
  // the classic abort: release W -> the machine stops and the player
  // falls back to the ground
  await page.keyboard.up('KeyW');
  const released = await waitFrames(0, async () => {
    const c = await climb();
    return !c.climbing ? c : null;
  }, 30000);
  check(!!released, `releasing W ABORTS the climb (climbing=${released ? released.climbing : '?'})`);
  const landed = await waitFrames(0, async () => {
    const c = await climb();
    return c.grounded ? c : null;
  }, 30000);
  check(!!landed, `the drop LANDED (grounded=${landed ? landed.grounded : '?'}, y=${landed ? landed.y : '?'})`);
}

const realErrors = errors.filter((e) => !/CURSOR\.IMG|Failed to load resource/.test(e));
check(realErrors.length === 0, realErrors.length ? `page errors: ${realErrors.slice(0, 3).join(' | ')}` : 'zero page errors');

await browser.close();
await server.close();
console.log(fails === 0 ? 'M3 CLIMB PROBE: ALL GREEN' : `M3 CLIMB PROBE: ${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
