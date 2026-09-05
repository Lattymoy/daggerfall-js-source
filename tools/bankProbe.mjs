// B2 probe: drive the banking window against the live game.
//
// The unit tests drive it over fake hooks; this proves the HOST half -
// that the accounts mint at the right size, that a deposit really
// moves gold off the entity, that a loan lands with a readable due
// date, and that the whole thing survives a quicksave and reload.
import { createServer } from 'vite';
import { chromium } from 'playwright';

const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5213, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.message); });
// T2: `class=16` SKIPS THE CHARGEN WIZARD. Without it the wizard holds
// townTalk's overlay slot and townTalk.keydown - FIRST in this host's
// keydown ladder (exterior.js:1965-1967) - swallows every
// page.keyboard.press below, so this probe pressed its keys into a
// character-creation screen it never knew was up.
await page.goto('http://localhost:5213/play/?shot&play&exterior&time=12:00&class=16');
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 180000 });

const waitFrames = async (n) => {
  const f = await page.evaluate(() => window.__frame);
  await page.waitForFunction(([f0, k]) => window.__frame > f0 + k, [f, n], { timeout: 60000 });
};
const bank = async () => JSON.parse(await page.evaluate(() => window.__bankOverlay()) ?? 'null');
const gold = () => page.evaluate(() => (window.__playerEntity.items ?? [])
  .find((i) => i.group === 'Currency')?.stackCount ?? 0);
const fail = (m) => { console.log('FAIL:', m); process.exit(1); };

// Any interior will do - the bank window needs the host's accounts and
// purse, not a bank. Use the same enterable types the other probes
// use, and confirm the interior actually MOUNTED rather than trusting
// __enter()'s return: a door can open onto a building whose context
// never builds, and __exit() then throws on a null context.
const ENTERABLE = new Set([0, 2, 5, 6, 7, 8, 9, 12, 13, 15]);
const doors = JSON.parse(await page.evaluate(() => JSON.stringify(window.__doors())));
let inside = false;
for (let i = 0; i < doors.length && !inside; i++) {
  const b = JSON.parse(await page.evaluate((j) => window.__buildingAt(j), i));
  if (!b || !ENTERABLE.has(b.buildingType)) continue;
  const { pos, normal } = doors[i];
  await page.evaluate(([x, y, z, yaw]) => window.__pose(x, y, z, yaw, -0.05),
    [pos[0] + normal[0] * 1.5, pos[1] - 1.2, pos[2] + normal[2] * 1.5, Math.atan2(-normal[0], -normal[2])]);
  if (!await page.evaluate(() => window.__enter())) continue;
  await waitFrames(10);
  if (JSON.parse(await page.evaluate(() => window.__building()) ?? 'null')) inside = true;
}
if (!inside) fail('could not get inside any building');
const building = JSON.parse(await page.evaluate(() => window.__building()));
console.log('inside:', JSON.stringify(building));

await page.evaluate(() => {
  const e = window.__playerEntity;
  e.items = e.items ?? [];
  const g = e.items.find((i) => i.group === 'Currency');
  if (g) g.stackCount = 50000; else e.items.push({ group: 'Currency', name: 'Gold pieces', stackCount: 50000 });
  e.level = 5;
});

console.log('\n== OPEN ==');
await page.evaluate(() => window.__openBank());
await waitFrames(6);
let s = await bank();
if (!s?.bank) {
  const why = await page.evaluate(() => JSON.stringify({
    art: typeof window.__openBank, mode: window.__mode?.(),
  }));
  fail(`the bank window did not open (${why}) - the G8 route is still dead`);
}
console.log('opened:', JSON.stringify({ region: s.region, labels: s.labels, enabled: s.enabled }));
if (s.enabled.loanRepay) fail('Repay must be dead with no loan');
const accounts = await page.evaluate(() => (window.__playerEntity.bankAccounts ?? []).length);
console.log('accounts minted:', accounts);
if (accounts !== 62) fail(`expected 62 regional accounts, got ${accounts}`);

console.log('\n== DEPOSIT ==');
const gold0 = await gold();
await page.evaluate(() => window.__bankClick('depositGold'));
await waitFrames(2);
s = await bank();
if (s.type !== 'Depositing_gold') fail(`the field did not open: ${s.type}`);
if (s.enabled.withdrawGold) fail('every other button must die while a field is open');
for (const ch of '20000') await page.keyboard.press(`Digit${ch}`);
await waitFrames(2);
s = await bank();
console.log('typed:', s.value);
if (s.value !== '20000') fail(`the field read ${s.value}`);
await page.keyboard.press('Enter');
await waitFrames(4);
s = await bank();
const gold1 = await gold();
console.log('after deposit:', JSON.stringify(s.labels), 'gold', gold0, '->', gold1);
if (gold1 !== gold0 - 20000) fail('the gold did not leave the purse');
if (s.labels.account !== '20000') fail(`the account label reads ${s.labels.account}`);
if (s.type !== 'None') fail('the field did not close behind the commit');

console.log('\n== WITHDRAW TOO HEAVY ==');
await page.evaluate(() => window.__bankClick('withdrawGold'));
for (const ch of '20000') await page.keyboard.press(`Digit${ch}`);
await page.keyboard.press('Enter');
await waitFrames(4);
s = await bank();
console.log('withdrawal:', JSON.stringify(s.box), 'account now', s.labels.account);
// whether it lands or is refused for weight depends on what the
// character is carrying - both are correct, but it must do ONE of them
if (s.box == null && s.labels.account !== '0') fail('the withdrawal neither landed nor was refused');
if (s.box) {
  console.log('  (refused - the encumbrance gate fired, which is the law)');
  await page.keyboard.press('Enter');   // a click-anywhere box
  await waitFrames(2);
}

console.log('\n== BORROW ==');
await page.evaluate(() => window.__bankClick('loanBorrow'));
await waitFrames(2);
s = await bank();
if (s.type !== 'Borrowing_loan') fail('the borrow field did not open');
for (const ch of '10000') await page.keyboard.press(`Digit${ch}`);
await page.keyboard.press('Enter');
await waitFrames(4);
s = await bank();
console.log('after borrowing:', JSON.stringify(s.labels));
if (s.labels.loanDue !== '11000') fail(`the loan should be 11000, got ${s.labels.loanDue}`);
if (!s.labels.loanBy || !/of/.test(s.labels.loanBy)) fail(`the due date did not render: ${s.labels.loanBy}`);
if (!s.enabled.loanRepay) fail('Repay must come alive once there is a loan');

console.log('\n== BORROW AGAIN IS REFUSED ==');
await page.evaluate(() => window.__bankClick('loanBorrow'));
await waitFrames(2);
s = await bank();
console.log('refusal:', JSON.stringify(s.box?.rows));
if (!s.box) fail('a second loan must be refused');
if (s.type !== 'None') fail('and no field may open behind the refusal');
await page.keyboard.press('Enter');
await waitFrames(2);

// The save round-trip is pinned in banking.test.js rather than here:
// this host has no quicksave hook, and a snapshot/restore is exactly
// the kind of thing a deterministic unit test proves better than a
// browser does.

if (errors.length) fail(`page errors: ${JSON.stringify(errors)}`);
console.log('\nOK: accounts mint, deposits move gold, and loans land with a readable due date');
await browser.close();
await server.close();
