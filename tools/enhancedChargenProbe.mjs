// A COMPLETE KEYBOARD-ONLY CHARGEN. Not one pointer event.
//
// The classic wizard answers a full keyboard, and while ENHANCED is
// the default skin a pointer-only wizard is a regression against the
// path it replaced. U14 made the same point in reverse when the
// dungeon host had no pointer seam at all and chargen there was
// keyboard-only, and it wrote a click-only walk to prove the fix. This
// is that walk from the other side.
//
// It proves the thing a source sweep cannot: that every stage has an
// arm for the keys the shared table produces, and that the wizard
// reaches `done` without a mouse. Two behaviours it relies on are
// laws rather than conveniences - an EMPTY name refuses to advance
// (AcceptName), and the pools gate their screens - so the walk types a
// name and spends with the spinner's own plus rather than hammering
// Enter.
//
//     ARENA2_PATH=... npx vite --port 5199 &
//     node tools/enhancedChargenProbe.mjs
import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto('http://127.0.0.1:5199/chargen.html', { waitUntil: 'networkidle' });
await p.waitForSelector('.prov', { timeout: 20000 });
const st = async () => JSON.parse(await p.evaluate(() => window.__chargen()));
const key = async (k, n = 1) => { for (let i = 0; i < n; i++) { await p.keyboard.press(k); await p.waitForTimeout(45); } };
const say = async (l) => { const s = await st(); console.log(`${l.padEnd(18)} ${s.state}`); return s.state; };
await say('start');
await key('ArrowDown', 2); await key('Enter');            // pick a race, open the box
await say('race box');
await key('Enter');                                        // accept
await say('gender');
await key('ArrowDown'); await key('Enter');
await say('after gender');
const seen = [];
for (let i = 0; i < 200; i++) {
  const s = await st();
  if (s.state === 'done') break;
  if (seen[seen.length - 1] !== s.state) { seen.push(s.state); console.log('  ->', s.state); }
  if (s.state === 'name') { await p.keyboard.type('Vaerin'); await key('Enter'); continue; }
  if (s.state === 'stats' || s.state === 'skills' || s.state === 'summary') {
    // spend the pools with the classic keys: the spinner's own plus
    await key('+', 3);
    await key('ArrowDown');
    await key('Enter');
    continue;
  }
  await key('Enter');
  if ((await st()).state === s.state) await key('ArrowDown');
}
await say('reached');
await p.screenshot({ path: '/tmp/kb-state.png' });
const state = (await st()).state;
console.log('ERRORS:', errs.length ? errs : 'none');
await b.close();
if (state !== 'done' || errs.length) process.exit(1);
