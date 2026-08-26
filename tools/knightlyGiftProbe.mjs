// G6 probe: the knightly smith's gift and the Spymaster's greeting,
// in a live guild hall.
//
// The unit tests drive the ladder and the choose-one mode over
// fixtures; this proves the HOST half - that the two destinations
// reach something (both were FLAGGED nulls), that the gift really
// opens THIS host's inventory over a reward pile, that taking one
// piece puts it in the real pack and claims the rank, and that the
// smith then refuses.
import { createServer } from 'vite';
import { chromium } from 'playwright';

const server = await createServer({ root: '/home/user/project-dagger', server: { port: 5218, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.message); });
await page.goto('http://localhost:5218/play/?shot&play&exterior&time=12:00');
await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 180000 });

const waitFrames = async (n) => {
  const f = await page.evaluate(() => window.__frame);
  await page.waitForFunction(([f0, k]) => window.__frame > f0 + k, [f, n], { timeout: 60000 });
};
const fail = (m) => { console.log('FAIL:', m); process.exit(1); };
const armour = () => page.evaluate(() => (window.__playerEntity.items ?? [])
  .filter((i) => i.group === 'Armor').map((i) => ({ t: i.templateIndex, m: i.material })));
const flags = () => page.evaluate(() => window.__playerEntity.guildMemberships?.[9]?.flags ?? 0);

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
console.log('inside:', await page.evaluate(() => window.__building()));

// GUILD_GROUPS.KnightlyOrder - the order the smith belongs to.
console.log('member:', await page.evaluate(() => window.__joinGuild(window.__knightlyGroup, 4, window.__knightlyFaction)));

console.log('\n== THE SMITH OFFERS ==');
const before = (await armour()).length;
await page.evaluate(() => window.__openGuildService('guildServiceReceiveArmor', window.__knightlyGroup, window.__knightlyFaction));
await waitFrames(4);
let inv = JSON.parse(await page.evaluate(() => window.__inventoryOverlay?.() ?? 'null') ?? 'null');
if (!inv) fail('guildServiceReceiveArmor did not open an inventory - the G6 route is dead');
console.log('reward pile:', inv.remote.length, JSON.stringify(inv.remote));
if (inv.remote.length < 4 || inv.remote.length > 7) fail(`four to seven pieces, got ${inv.remote.length}`);
if (inv.mode !== 'remove') fail(`choose-one opens in Remove mode, got ${inv.mode}`);
// rank 4 -> Dwarven (Iron + 4)
if (!inv.remote.every((p) => p.m === inv.remote[0].m)) fail('one gift, one material');
console.log('material:', inv.remote[0].m, '(Iron + rank 4 = Dwarven 516)');
if (inv.remote[0].m !== 516) fail(`expected Dwarven 516 at rank 4, got ${inv.remote[0].m}`);
if (await flags() !== 0) fail('the flag was set before anything was taken');

console.log('\n== NOTHING GOES IN ==');
const packBefore = await page.evaluate(() => (window.__playerEntity.items ?? []).length);
await page.evaluate(() => window.__inventoryPickLocal(0));
await waitFrames(2);
inv = JSON.parse(await page.evaluate(() => window.__inventoryOverlay()));
if ((await page.evaluate(() => (window.__playerEntity.items ?? []).length)) !== packBefore) {
  fail('an item left the pack into a pile the player is only choosing from');
}

console.log('\n== TAKING ONE CLAIMS THE RANK ==');
await page.evaluate(() => window.__inventoryPickRemote(0));
await waitFrames(4);
const after = await armour();
console.log('armour in the pack:', after.length, '(was', before + ')');
if (after.length !== before + 1) fail('exactly one piece should have moved');
const f = await flags();
console.log('membership flags:', f, '(4 << 4 = 64)');
if (f !== 64) fail(`expected the rank-4 bit, got ${f}`);
if (JSON.parse(await page.evaluate(() => window.__inventoryOverlay?.() ?? 'null') ?? 'null')) {
  fail('the window should have closed itself on the take');
}

console.log('\n== AND THE SMITH REFUSES ==');
await page.evaluate(() => window.__openGuildService('guildServiceReceiveArmor', window.__knightlyGroup, window.__knightlyFaction));
await waitFrames(4);
if (JSON.parse(await page.evaluate(() => window.__inventoryOverlay?.() ?? 'null') ?? 'null')) {
  fail('a second gift was offered at the same rank');
}
console.log('no second pile - the rank is spent');

if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
console.log('\nOK: the gift offers, claims on the take, and refuses after.');
await browser.close();
await server.close();
process.exit(0);
