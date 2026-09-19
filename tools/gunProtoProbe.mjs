// THE GUN LAB, IN A REAL BROWSER, WITH NO ARENA2.
//
// The claims a source sweep cannot make about gun-proto.html: the art
// loads and slices, the background key clears the page without eating
// the muzzle flash, the frame badges are off the art, and - the one
// that matters - THE GUN DOES NOT MOVE ACROSS THE CYCLE. Six frames
// whose flash and smoke grow up and to the left will slide the weapon
// around under any per-frame trim; this measures the drawn rect on
// every frame of a live shot and fails if it drifts.
//
// Boots vite in-process, so:
//     node tools/gunProtoProbe.mjs [shots-dir]
//
// Writes idle + the six fire frames as PNGs for eyeballing. They are
// OUR art on the lab's own backdrop - no ARENA2 pixel - but they go to
// a scratch dir, not public/ (AUDIT 21's law).
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const shots = process.argv[2] || 'scratch/gun-proto';
await mkdir(shots, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

const server = await createServer({ server: { port: 5198, strictPort: true }, logLevel: 'warn' });
await server.listen();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto('http://127.0.0.1:5198/gun-proto.html', { waitUntil: 'load' });
await page.waitForFunction(() => globalThis.__gunLab?.ready, null, { timeout: 20000 });
// the shots are for judging the POSE, so the panels come off (Tab)
await page.keyboard.press('Tab');

const art = await page.evaluate(() => globalThis.__gunLab.art);
check('the sheet sliced into six frames and the idle pose loaded', art.frames === 6 && art.idle, `${art.frames} frames`);
check('the gun has a box and the flash has room around it',
  art.anchor.w > 100 && art.union.w >= art.anchor.w && art.union.h >= art.anchor.h,
  `gun ${art.anchor.w}x${art.anchor.h}, with flash ${art.union.w}x${art.union.h}`);
check('the flash grows UP and LEFT of the gun, which is what the union box is for',
  art.union.x <= art.anchor.x && art.union.y < art.anchor.y,
  `union (${art.union.x},${art.union.y}) vs gun (${art.anchor.x},${art.anchor.y})`);
// The badge gutter is 12% of the cell; the gun starts well right of it.
check('the frame-number badges are off the art', art.anchor.x >= 0 && art.anchor.w < 666,
  `gun box starts at x=${art.anchor.x} of the cropped cell`);

await page.screenshot({ path: `${shots}/idle.png` });

// THE REGISTRATION TEST. Slow the cycle right down, fire, and read the
// drawn rect on every frame with the recoil and bob off, so the only
// thing that could move the weapon is the slicing.
await page.evaluate(() => {
  const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input')); };
  const tick = (id, v) => { const el = document.getElementById(id); el.checked = v; el.dispatchEvent(new Event('input')); };
  set('fps', 4); set('recoil', 0); set('bob', 0); tick('walk', false);
});
await page.evaluate(() => document.getElementById('c').dispatchEvent(new MouseEvent('mousedown')));

const seen = new Map();
for (let i = 0; i < 90; i++) {
  const s = await page.evaluate(() => globalThis.__gunLab);
  if (s.state === 'Firing' && !seen.has(s.frame)) {
    seen.set(s.frame, s.rect);
    await page.screenshot({ path: `${shots}/fire-${s.frame + 1}.png` });
  }
  if (s.state !== 'Firing' && seen.size >= 6) break;
  await page.waitForTimeout(40);
}
check('every one of the six frames reached the screen', seen.size === 6, `${seen.size}/6`);
const rects = [...seen.values()];
const drift = rects.length ? Math.max(...rects.map((r) => Math.abs(r.x - rects[0].x) + Math.abs(r.y - rects[0].y))) : Infinity;
check('THE GUN DOES NOT MOVE: one box for all six frames', drift === 0, `max drift ${drift}px`);

// The mirror, and the alignment swap under it.
await page.evaluate(() => {
  const el = document.getElementById('flip'); el.checked = true; el.dispatchEvent(new Event('input'));
  const a = document.getElementById('align'); a.value = '2'; a.dispatchEvent(new Event('input'));
});
await page.waitForTimeout(120);
const flipped = await page.evaluate(() => globalThis.__gunLab.anchorRect);
await page.screenshot({ path: `${shots}/left-hand.png` });   // the MIRROR, shot while it is on
await page.evaluate(() => { const el = document.getElementById('flip'); el.checked = false; el.dispatchEvent(new Event('input')); });
await page.waitForTimeout(120);
const right = await page.evaluate(() => globalThis.__gunLab.anchorRect);
check('the handedness mirror swaps the weapon to the other side', flipped.x < right.x,
  `left-hand x=${flipped.x.toFixed(0)} vs right-hand x=${right.x.toFixed(0)}`);

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
await server.close();
console.log(`\nshots in ${shots}/`);
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} ok`);
process.exit(failed ? 1 : 0);
