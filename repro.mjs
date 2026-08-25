import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
p.on('pageerror', e => console.log('PAGEERR', e.message.slice(0, 120)));
await p.goto('http://127.0.0.1:5199/', { waitUntil: 'domcontentloaded' });
await p.waitForSelector('#enhanced-menu .railbtn', { timeout: 30000 });
await p.locator('#enhanced-menu .railbtn', { hasText: 'New Game' }).click();
await p.locator('#enhanced-menu .act.primary', { hasText: 'Begin' }).click();
await p.waitForSelector('#enhanced-chargen .prov', { timeout: 180000 });
const st = async () => JSON.parse(await p.evaluate(() => window.__chargen()));
const key = async (k, n = 1) => { for (let i = 0; i < n; i++) { await p.keyboard.press(k); await p.waitForTimeout(60); } };
await key('ArrowDown', 2); await key('Enter'); await key('Enter');
await key('ArrowDown'); await key('Enter');
for (let i = 0; i < 200; i++) {
  const s = await st().catch(() => ({ state: 'gone' }));
  if (s.state === 'done' || s.state === 'gone') break;
  if (s.state === 'name') { await p.keyboard.type('Vaerin'); await key('Enter'); continue; }
  if (s.state === 'stats' || s.state === 'skills' || s.state === 'summary') {
    await key('+', 3); await key('ArrowDown'); await key('Enter'); continue;
  }
  await key('Enter');
  const now = await st().catch(() => ({ state: 'gone' }));
  if (now.state === s.state) await key('ArrowDown');
}
console.log('wizard finished');
await p.waitForTimeout(6000);
const probe = async (label) => console.log(label, await p.evaluate(() => ({
  wizardGone: !document.querySelector('#enhanced-chargen'),
  lock: document.pointerLockElement ? document.pointerLockElement.tagName : null,
  cursorCss: document.documentElement.style.cursor ? 'classic' : 'default',
})));
await probe('right after done: ');
await p.keyboard.press('KeyW'); await p.waitForTimeout(2500);
await probe('after pressing W: ');
await p.mouse.click(700, 450); await p.waitForTimeout(2500);
await probe('after a click:    ');
await p.screenshot({ path: '/tmp/afterchargen.png' });
await b.close();
