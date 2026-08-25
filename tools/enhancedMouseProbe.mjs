// EVERY enhanced surface, clicked with a REAL MOUSE.
//
// THE REASON THIS EXISTS. Mac reported that the province map took no
// clicks in the game, and every walk this project had written said it
// worked - because every one of them dispatched a synthetic click
// straight at the element, or used Playwright's element click, and
// neither takes the path a mouse takes.
//
// What a mouse does is move, press and release, and a click only
// EXISTS if the press and the release land on the same node. The map's
// hover handler set a flag and repainted the whole screen, which
// destroyed the node under the pointer and built a new one - so the
// browser fired pointerenter on the fresh node, which repainted again,
// forever. No mousedown ever survived to its mouseup.
//
// So this probe moves first, then presses, on every surface. A test
// that clicks an element by handle can never see a bug in the space
// between those two events.
//
//     ARENA2_PATH=... npx vite --port 5199 &
//     node tools/enhancedMouseProbe.mjs
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto('http://127.0.0.1:5199/chargen.html', { waitUntil: 'networkidle' });
await p.waitForSelector('.prov', { timeout: 20000 });
const st = async () => JSON.parse(await p.evaluate(() => window.__chargen()));
const realClick = async (sel, nth = 0, fx = 0.5, fy = 0.5) => {
  const box = await p.locator(sel).nth(nth).boundingBox();
  if (!box) throw new Error('no box for ' + sel);
  await p.mouse.move(box.x + box.width * fx, box.y + box.height * fy);
  await p.waitForTimeout(60);
  await p.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
  await p.waitForTimeout(160);
};
await realClick('.prov:not(.inert)', 1, 0.5, 0.6);
console.log('map click     ->', (await st()).race, (await st()).confirming);
await realClick('.act.primary');
console.log('accept race   ->', (await st()).state);
await realClick('.bigbtn', 1);
console.log('sex           ->', (await st()).state);
await realClick('.bigbtn', 0);
console.log('class method  ->', (await st()).state);
await realClick('.row-main', 1);
await realClick('.act.primary');
await realClick('.act.primary');
console.log('class chosen  ->', (await st()).state);
await realClick('.bigbtn', 1);
await p.waitForTimeout(200);
if (await p.locator('.repbox').count()) await realClick('.act.primary');
console.log('history       ->', (await st()).state);
await realClick('.act', 1);                       // suggest a name
await realClick('.act.primary');
console.log('name          ->', (await st()).state);
await p.waitForTimeout(700);
await realClick('.facecell', 4);
await realClick('.act.primary');
console.log('face          ->', (await st()).state);
for (let i = 0; i < 40; i++) {
  if (!(await p.locator('.act.primary').isDisabled())) break;
  await realClick('.row .step', 1);
}
await realClick('.act.primary');
console.log('attributes    ->', (await st()).state);
const end = (await st()).state;
console.log('ERRORS:', errs.length ? errs.slice(0, 3) : 'none');
await b.close();
if (end !== 'skills' || errs.length) process.exit(1);
