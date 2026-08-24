// V1 probe: a real bite, a real dream, a real turn - in a live town.
//
// The unit tests drive the two gates and the cancels over fixtures.
// This proves the HOST half, which is where every previous slice's
// bugs lived: that the infection is minted through the producer, that
// the magic round the host already runs carries it (nothing new is
// called from a frame body), that the two ARENA2 dream videos are in
// the diet and DECODE, and that the turn lands a clan read off the
// region the bite happened in.
import { createServer } from 'vite';
import { chromium } from 'playwright';

const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5219, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.message); });
await page.goto('http://localhost:5219/?shot&play&exterior&time=22:00');
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 180000 });

const fail = (m) => { console.log('FAIL:', m); process.exit(1); };
const state = async () => JSON.parse(await page.evaluate(() => window.__infection()));
const videos = async () => (await state()).videos;

console.log('== THE BITE ==');
// DiseaseEffect.Start's gate first, on the character the probe boots
// with: a level-1 player cannot be turned any more than they can
// catch plague.
console.log('level:', await page.evaluate(() => window.__playerEntity.level));
if (await page.evaluate(() => window.__playerEntity.level) < 2) {
  const cub = JSON.parse(await page.evaluate(() => window.__infect('Vampirism-Infection')));
  if (cub) fail('a level-1 player took an infection - base.Start\'s gate is not being reached');
  console.log('level-1 bite:', cub, '(refused, DiseaseEffect.Start:89)');
}
await page.evaluate(() => { window.__playerEntity.level = 5; });
const bitten = JSON.parse(await page.evaluate(() => window.__infect('Vampirism-Infection')));
if (!bitten) fail('__infect minted nothing - startInfection refused a live player');
console.log('entry:', JSON.stringify(bitten));
if (bitten.disease !== null) fail('an infection carries no classic disease row');
if (bitten.daysOfSymptomsLeft !== 255) fail('a permanent no-effect disease is 0xFF days');
let s = await state();
if (s.diseases !== 1) fail(`the temple counts it as a disease: got ${s.diseases}`);
console.log('diseaseCount:', s.diseases, '(this is the Ledger correction: it was already counted)');

console.log('\n== ONE DAY: THE WARNING DREAM ==');
await page.evaluate(() => window.__advanceDays(1));
await page.waitForFunction(() => (window.__infectionVideos ?? []).length >= 1, null, { timeout: 240000 });
console.log('pushed:', JSON.stringify(await videos()));
await page.waitForFunction(() => (window.__infectionVideos ?? []).length >= 1
  && window.__infectionVideos[0].played !== undefined, null, { timeout: 240000 });
let v = await videos();
if (v[0].name !== 'ANIM0004.VID') fail(`the vampire dream is ANIM0004.VID, got ${v[0].name}`);
if (v[0].played !== true) fail('ANIM0004.VID did not decode - the diet did not feed it');
s = await state();
if (!s.entry.dreamPlayed) fail('the dream closed without setting the flag the turn waits on');
if (s.pending) fail('turned at the dream - the second gate is not being read');

console.log('\n== THREE DAYS LATER: STILL NOT TURNED ==');
await page.evaluate(() => window.__advanceDays(2));
s = await state();
if (s.pending) fail('turned on day 3 - the gate is `daysPast > 3`, not >=');
console.log('day 3 pending:', s.pending);

console.log('\n== THE FOURTH DAY: THE FAKE DEATH, THEN THE TURN ==');
await page.evaluate(() => window.__advanceDays(1));
await page.waitForFunction(() => (window.__infectionVideos ?? []).length >= 2, null, { timeout: 240000 });
await page.waitForFunction(() => window.__playerEntity.racialOverridePending != null, null, { timeout: 240000 });
v = await videos();
console.log('videos:', JSON.stringify(v));
if (v[1].name !== 'ANIM0012.VID') fail(`the fake death is ANIM0012.VID, got ${v[1].name}`);
s = await state();
console.log('pending:', JSON.stringify(s.pending));
if (s.pending.key !== 'Vampirism-Infection') fail('the turn did not land the racial-override marker');
if (!(s.pending.clan >= 150 && s.pending.clan <= 158)) fail(`the clan is a real faction id, got ${s.pending.clan}`);
if (s.diseases !== 0) fail(`EndDisease is the turn's last line - nothing left to cure, got ${s.diseases}`);
console.log('the temple can no longer cure it:', s.diseases);

console.log('\n== A SECOND BITE DOES NOTHING ==');
const again = JSON.parse(await page.evaluate(() => window.__infect('Werewolf-Infection')));
if (again) fail('a racial override in place must cancel an incoming infection');
console.log('werewolf bite on a vampire:', again);

if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
console.log('\nPASS');
await browser.close();
await server.close();
process.exit(0);
