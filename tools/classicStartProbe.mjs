// U31: THE CLASSIC START CAN BE LEFT.
//
// The bug this proves fixed: the bare-URL start booted scenes/dungeon.js,
// which has no exit branch at all, so Privateer's Hold was a sealed box.
// The classic start now boots the WORLD host at the settings' own start
// cell and enters that location's dungeon, which makes the tested
// worldModes.tryExitDungeon the way out.
//
// Nothing here is faked: the exit is the same raycast pick a player
// makes, taken while standing at the real exit door.
//
// Usage: ARENA2_PATH=... node tools/classicStartProbe.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const server = await createServer({ server: { port: 5219, strictPort: true } });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));

let fails = 0;
const check = (ok, label) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`); if (!ok) fails++; };

// ?world+?shot reaches the world host WITH the probe surface; ?classic is
// the new start path; ?class=1 is the headless chargen skip.
await page.goto('http://localhost:5219/play/?world&shot&classic&class=1&novideo&nofoes');

const until = Date.now() + 240000;
let mode = null;
while (Date.now() < until) {
  mode = await page.evaluate(() => (window.__mode ? window.__mode() : null));
  if (mode) break;
  await page.waitForTimeout(1000);
}
check(mode === 'dungeon', `the classic start begins INSIDE the dungeon (mode: ${mode})`);

const dungeon = await page.evaluate(() => (window.__dungeon ? JSON.parse(window.__dungeon()) : null));
check(!!dungeon && dungeon.exits.length > 0, `the start location's dungeon has ${dungeon?.exits?.length ?? 0} exit door(s)`);

if (dungeon?.exits?.length) {
  // Stand where a player who walked to the door would stand: on the
  // door's own normal side (the normal faces INTO the dungeon), close,
  // looking back at it.
  //
  // The -0.5 is not a fudge. player.spawn puts the EYE about 1.2 above
  // the position it is given, and the exit-door AABB is centred near
  // its reported y - so a stand at the door's own height leaves the eye
  // roughly 2.3 above the door centre and the activation ray sails over
  // the box. Measured, not guessed: the first draft of this probe stood
  // at pos[1] + 0.6 and reported the exit as broken when it was not.
  const { pos, normal } = dungeon.exits[0];
  const stand = [pos[0] + normal[0] * 0.8, pos[1] - 0.5, pos[2] + normal[2] * 0.8];
  const yaw = Math.atan2(-normal[0], -normal[2]);
  await page.evaluate(([p, y]) => window.__warpTo(p, y), [stand, yaw]);
  await page.waitForTimeout(300);

  const left = await page.evaluate(() => window.__dungeonExit());
  check(left === true, 'the exit door answers the activation a player would make');
  await page.waitForTimeout(1200);
  const after = await page.evaluate(() => window.__mode());
  check(after === 'exterior', `and the player is OUT, standing in the world (mode: ${after})`);
}

const real = errors.filter((e) => !/CURSOR\.IMG|Failed to load resource/.test(e));
check(real.length === 0, real.length ? `page errors: ${real.slice(0, 2).join(' | ')}` : 'zero page errors');

await browser.close();
await server.close();
console.log(fails === 0 ? 'CLASSIC START PROBE: ALL GREEN' : `CLASSIC START PROBE: ${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
