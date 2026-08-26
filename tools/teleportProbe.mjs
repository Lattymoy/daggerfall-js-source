// G5 probe: does the Mages Guild TELEPORT service land the player, in
// the live world host?
//
// The unit tests drive the popup and the map's fork over fixtures;
// this proves the two halves actually meet - the map opens ARMED
// through the host's own door, a pick opens the TELEPORT box rather
// than the travel one, YES lands the player at the destination pixel,
// and the JOURNEY is skipped: no gold spent, no time passed. Those
// last two are the whole difference between this and fast travel and
// they can only be seen against a live clock and a live purse.
import { createServer } from 'vite';
import { chromium } from 'playwright';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const server = await createServer({ server: { port: 5217, strictPort: true } });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
page.on('console', (m) => {
  if (m.type() === 'error' && !/status of 404/.test(m.text())) errors.push(`[console] ${m.text()}`);
});

await page.goto('http://localhost:5217/play/?world&nomenu&class=0&novideo&shot&play');
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
const map = () => page.evaluate(() => { const s = window.__travelMap(); return s ? JSON.parse(s) : null; });
const until = async (pred, cap = 30000) => {
  const t0 = Date.now();
  for (;;) {
    const st = await map();
    if (pred(st)) return st;
    if (Date.now() - t0 > cap) return st;
    await frames(1, 5000);
  }
};
const clickNative = (x, y) => page.mouse.click(x * 4, y * 4);
const fail = (m) => { console.log('FAIL:', m); process.exit(1); };

// Drain the quest arc's boot boxes before driving keys.
for (let i = 0, quiet = 0; i < 30 && quiet < 2; i++) {
  const up = await page.evaluate(() => JSON.parse(window.__talk()).overlay);
  if (up) { quiet = 0; await page.keyboard.press('Escape'); } else quiet++;
  await frames(2);
}

const before = await page.evaluate(() => JSON.parse(window.__travelProbe()));
const dest = await page.evaluate(() => JSON.parse(window.__travelNearest()));
console.log('start:', JSON.stringify(before));
console.log('destination:', JSON.stringify({ name: dest.name, region: dest.region, pixel: dest.pixel }));
if (dest.pixel.x === before.pixel.x && dest.pixel.y === before.pixel.y) {
  fail('the nearest destination is where we already stand - nothing to prove');
}

console.log('\n== THE MAP OPENS ARMED, through the host door the guild service uses ==');
const opened = await page.evaluate(() => { const s = window.__openTeleportMap(); return s ? JSON.parse(s) : null; });
if (!opened) fail('openTeleportMap answered null - the G5 host door is dead');
console.log('armed:', opened.armed, '| telePopUp:', opened.telePopUp);
if (!opened.armed) fail('the map opened UNarmed - activateTeleportationTravel never ran');

// Region page, then find the destination by name - the same walk a
// player makes, and the same one travelProbe makes for fast travel.
if (!opened.identifying) await clickNative(25, 191);
await page.keyboard.press('Enter');
await frames(1);
let st = await map();
if (!st?.regionSelected) { await clickNative(25, 191); await page.keyboard.press('Enter'); await frames(1); st = await map(); }
if (!st?.regionSelected) fail('could not open the region page');
if (!st.armed) fail('the arm did not survive opening a region page');

await page.keyboard.press('f');
await frames(1);
for (const c of dest.name) {
  if (c === ' ') await page.keyboard.press('Space');
  else if (/[a-zA-Z0-9'-]/.test(c)) await page.keyboard.press(c);
  await page.waitForTimeout(30);
}
await page.keyboard.press('Enter');
await frames(1);
if ((await map())?.picker) { await page.keyboard.press('Enter'); await frames(1); }

console.log('\n== THE PICK OPENS THE TELEPORT BOX, not the travel one ==');
st = await until((s) => s?.top === 'confirm' || s?.telePopUp || s?.popUp, 40000);
if (st?.top === 'confirm') { await page.keyboard.press('y'); await frames(1); st = await map(); }
console.log('telePopUp:', JSON.stringify(st?.telePopUp), '| popUp:', st?.popUp);
if (!st?.telePopUp) fail('no teleport box - the fork did not fire');
if (st.popUp) fail('the TRAVEL popup opened as well; the fork must pick one');
if (st.telePopUp.name !== dest.name) fail(`the box names ${st.telePopUp.name}, not ${dest.name}`);

// the save envelope is still three booleans with the box up
console.log('save envelope with the box up:', JSON.stringify(st.save));
for (const k of ['sleepInn', 'speedCautious', 'travelShip']) {
  if (typeof st.save[k] !== 'boolean') fail(`${k} is ${st.save[k]} - the box reached the envelope`);
}

console.log('\n== NO leaves the map open and still armed ==');
st = JSON.parse(await page.evaluate(() => window.__teleportAnswer(false)));
if (st.telePopUp) fail('No did not close the box');
if (!st.armed) fail('No disarmed the map - another destination must still be pickable');

console.log('\n== YES lands the player, and the JOURNEY is skipped ==');
// pick the same place again, then say yes
await page.keyboard.press('f');
await frames(1);
for (const c of dest.name) {
  if (c === ' ') await page.keyboard.press('Space');
  else if (/[a-zA-Z0-9'-]/.test(c)) await page.keyboard.press(c);
  await page.waitForTimeout(30);
}
await page.keyboard.press('Enter');
await frames(1);
if ((await map())?.picker) { await page.keyboard.press('Enter'); await frames(1); }
st = await until((s) => s?.top === 'confirm' || s?.telePopUp, 40000);
if (st?.top === 'confirm') { await page.keyboard.press('y'); await frames(1); }
if (!(await map())?.telePopUp) fail('the box did not reopen');
await page.evaluate(() => window.__teleportAnswer(true));
await frames(8, 60000);
await until((s) => s === null, 60000);

const after = await page.evaluate(() => JSON.parse(window.__travelProbe()));
console.log('after:', JSON.stringify(after));
if (after.pixel.x !== dest.pixel.x || after.pixel.y !== dest.pixel.y) {
  fail(`landed at ${after.pixel.x},${after.pixel.y}, wanted ${dest.pixel.x},${dest.pixel.y}`);
}
// THE TWO THINGS THAT MAKE IT A TELEPORT
if (after.gold !== before.gold) fail(`teleporting cost ${before.gold - after.gold} gold - it is free`);
if (after.minutes !== before.minutes) {
  fail(`the clock moved ${after.minutes - before.minutes} minutes - no time passes`);
}
console.log(`gold ${before.gold} -> ${after.gold} (unchanged), clock ${before.minutes} -> ${after.minutes} (unchanged)`);

if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
console.log('\nOK: the guild teleport lands the player free of gold and free of time.');
await browser.close();
await server.close();
process.exit(0);
